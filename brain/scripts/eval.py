"""Paired local evaluation of all held-out inputs plus the app bake-off, with resume."""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import json
import logging
import math
from pathlib import Path
import random
import statistics
import time
from common import ROOT, append_jsonl, atomic_text, digest, file_hash, load_contract, logging_run, manifest, messages_for, ollama_chat, read_jsonl, schema_for, write_json
from validation import Validator, beats, generic_count, output_text

def metrics(rows):
    n=len(rows); lat=[r['latency_ms'] for r in rows if r.get('latency_ms') is not None]; lat.sort()
    lines=[line for r in rows for line in r.get('lines',[])]
    return {'requests':n,'json_valid_pct':100*sum(r['json_valid'] for r in rows)/max(1,n),
            'validator_pass_pct':100*sum(r['validator_pass'] for r in rows)/max(1,n),
            'dataset_rules_pass_pct':100*sum(r['strict_pass'] for r in rows)/max(1,n),
            'spoken_pct':100*sum(bool(r.get('lines')) for r in rows)/max(1,n),
            'avg_latency_ms':statistics.mean(lat) if lat else None,'p95_latency_ms':lat[max(0,math.ceil(.95*len(lat))-1)] if lat else None,
            'distinct_lines_pct':100*len({s.lower().strip() for s in lines})/max(1,len(lines)),
            'generic_phrase_rate_pct':100*sum(generic_count(s)>0 for s in lines)/max(1,len(lines)),
            'errors':sum('error' in r for r in rows),'rejections':dict(Counter(r.get('rejection') for r in rows if r.get('rejection')))}

def report(run,results,seed):
    by_arm=defaultdict(list)
    for r in results: by_arm[r['arm']].append(r)
    summary={arm:metrics(rows) for arm,rows in by_arm.items()}; write_json(run/'summary.json',summary)
    md=['# Ducky local evaluation','All held-out inputs are included, including contexts for which the teacher produced no accepted target. Transport failures count as failures. Warm-up requests are excluded from all metrics. Latencies include JSON generation; do not compare across different hardware/load conditions.',
        '| Arm | Requests | JSON % | App validator % | Dataset rules % | Spoken % | Avg ms | P95 ms | Distinct % | Generic % |',
        '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
    for arm,m in summary.items():
        def f(k): return 'n/a' if m[k] is None else f'{m[k]:.1f}'
        md.append(f"| {arm} | {m['requests']} | {f('json_valid_pct')} | {f('validator_pass_pct')} | {f('dataset_rules_pass_pct')} | {f('spoken_pct')} | {f('avg_latency_ms')} | {f('p95_latency_ms')} | {f('distinct_lines_pct')} | {f('generic_phrase_rate_pct')} |")
    md+=['\nApp validator reproduces normalization/fallback behavior; stricter dataset checks also enforce enums, configured conversation profanity, audited tool arguments, and unverified action claims. Silent ambient objects pass the app validator but are shown separately in Spoken %. Distinct and generic metrics use accepted visible beats only.',
        '\n`short` uses the compact JSON training contract. `app` uses the existing application long-prompt structure. The ducky/app arm is the deployment compatibility check: changing only the model name should be judged using that arm. This is not a factual-correctness benchmark; review knowledge, code, refusals and tool semantics manually.']
    for arm,rows in by_arm.items():
        md+=['\n## '+arm]
        for subset in ['ambient','conversation','bakeoff']:
            selected=[r for r in rows if (r['suite']=='bakeoff' if subset=='bakeoff' else r['kind']==subset and r['suite']=='heldout')]
            md += [f'\n{subset}: `{json.dumps(metrics(selected),ensure_ascii=False)}`']
        for personality in ('wholesome','playful','sarcastic','unhinged'):
            pool=[r for r in rows if r['personality']==personality and r.get('lines')]; random.Random(seed).shuffle(pool)
            md += ['\n### '+personality+f' ({min(20,len(pool))} samples)']
            for r in pool[:20]:
                md += [f"- `{r['id']}` [{r['kind']}/{r['situation']}] "+' / '.join(r['lines']).replace('\n',' ↵ ')]
        failures=[r for r in rows if not r['validator_pass']]
        md += ['\n### Rejected samples']+[f"- `{r['id']}` {r.get('rejection',r.get('error'))}: {r.get('raw','')[:220].replace(chr(10),' ')}" for r in failures[:15]]
    # Same contexts side by side, not independently cherry-picked model examples.
    pairs=defaultdict(dict)
    for r in results: pairs[r['id']][r['arm']]=r
    keys=sorted(pairs); random.Random(seed).shuffle(keys)
    md+=['\n## Paired review']
    for key in keys[:40]:
        md+=['\n### '+key]
        for arm,r in pairs[key].items(): md += [f"- **{arm}**: "+(' / '.join(r.get('lines',[])) or r.get('raw','')[:200]).replace('\n',' ↵ ')]
    atomic_text(run/'report.md','\n'.join(md)+'\n')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--heldout',type=Path,default=ROOT/'data/heldout.jsonl'); p.add_argument('--bakeoff',type=Path,default=ROOT/'data/bakeoff.jsonl'); p.add_argument('--contract',type=Path,default=ROOT/'data/app_contract.json')
    p.add_argument('--candidate',default='ducky:4b'); p.add_argument('--baseline',default='qwen3:8b'); p.add_argument('--run-dir',type=Path,help='Reuse to resume results without repeating completed calls')
    p.add_argument('--port',type=int,default=11434); p.add_argument('--timeout',type=float,default=180); p.add_argument('--seed',type=int,default=42)
    p.add_argument('--limit',type=int,default=0,help='Smoke-test contexts; zero uses all'); p.add_argument('--skip-native-arm',action='store_true')
    p.add_argument('--dry-run',action='store_true'); p.add_argument('--report-only',action='store_true'); a=p.parse_args(); run=logging_run('eval',a.run_dir)
    contract=load_contract(a.contract); validator=Validator(contract)
    contexts=[dict(r,suite='heldout') for r in read_jsonl(a.heldout)]+[dict(r,suite='bakeoff') for r in read_jsonl(a.bakeoff)]
    if not contexts: p.error('No evaluation contexts')
    if a.limit: contexts=contexts[:a.limit]
    arms=[(a.candidate,'short'),(a.baseline,'app')]
    if not a.skip_native_arm: arms.insert(1,(a.candidate,'app'))
    config={'heldout':file_hash(a.heldout),'bakeoff':file_hash(a.bakeoff),'contract':digest(contract),'arms':arms,'seed':a.seed,'limit':a.limit,
            'code':file_hash(__file__),'commonCode':file_hash(Path(__file__).with_name('common.py')),'validatorCode':file_hash(Path(__file__).with_name('validation.py'))}
    # JSON-normalize tuples before comparing manifests on resume.
    config=json.loads(json.dumps(config)); manifest(run/'config.json',config)
    results=read_jsonl(run/'results.jsonl',recover_tail=True)
    if a.report_only: report(run,results,a.seed); return
    if a.dry_run:
        write_json(run/'request-preview.json',[{'arm':model+'/'+mode,'messages':messages_for(contexts[0],contract,mode),'schema':schema_for(contexts[0],contract)} for model,mode in arms]); return
    done={(r['arm'],r['id']):r for r in results}
    for model,mode in arms:
        arm=model+'/'+mode
        if all((arm,r['id']) in done for r in contexts): continue
        logging.info('Warming up %s (excluded from metrics)',arm)
        try: ollama_chat(model,messages_for(contexts[0],contract,mode),schema_for(contexts[0],contract),port=a.port,timeout=a.timeout,seed=a.seed,num_predict=80)
        except Exception as e: logging.warning('Warm-up failed: %s',e)
        recent=[]; suite=None
        for i,row in enumerate(contexts):
            if row['suite']!=suite: recent=[]; suite=row['suite']
            if (arm,row['id']) in done:
                recent.extend(done[(arm,row['id'])].get('lines',[]) if row['kind']=='ambient' else []); continue
            result={'id':row['id'],'arm':arm,'model':model,'mode':mode,'kind':row['kind'],'situation':row['situation'],'personality':row['personality'],'suite':row['suite'],
                    'json_valid':False,'validator_pass':False,'strict_pass':False,'lines':[],'latency_ms':None}
            start=time.perf_counter()
            try:
                response,ms=ollama_chat(model,messages_for(row,contract,mode,recent),schema_for(row,contract),port=a.port,timeout=a.timeout,
                    seed=a.seed+i,temperature=.8 if row['kind']=='conversation' else .9,num_predict=700 if row['kind']=='conversation' else 80)
                raw=response['message']['content']; result.update(raw=raw,latency_ms=ms,done_reason=response.get('done_reason'))
                try: json.loads(raw,parse_constant=lambda s: (_ for _ in ()).throw(ValueError(s))); result['json_valid']=True
                except ValueError: pass
                value,error=validator.validate(raw,row,recent); strict,strict_error=validator.validate(raw,row,recent,strict=True)
                result.update(validator_pass=value is not None,strict_pass=strict is not None,rejection=error,strict_rejection=strict_error)
                if value is not None:
                    result['lines']=beats(value); result['value']=value
                    if row['kind']=='ambient': recent.extend(result['lines'])
            except Exception as e: result.update(error=type(e).__name__+': '+str(e),rejection='transport',latency_ms=(time.perf_counter()-start)*1000)
            append_jsonl(run/'results.jsonl',result); results.append(result)
            if (i+1)%10==0: logging.info('%s %d/%d',arm,i+1,len(contexts)); report(run,results,a.seed)
        report(run,results,a.seed)
    logging.info('Report: %s',run/'report.md')

if __name__=='__main__': main()
