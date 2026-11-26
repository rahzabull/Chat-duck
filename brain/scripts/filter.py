"""Validate and deduplicate teacher candidates; emit weighted gold + synthetic chat data."""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import json
import logging
from pathlib import Path
import random
from common import ROOT, digest, dumps, eligible, file_hash, fill, load_contract, logging_run, messages_for, read_jsonl, write_json, write_jsonl
from make_contexts import ambient, conversation_context
from validation import DuplicateIndex, Validator, beats, generic_count, output_text, similarity

def gold_inventory(contract):
    """Every authored line is inventoried. Unsafe/ineligible originals are quarantined, never rewritten by an API."""
    rng=random.Random(731); inventory=[]
    sources=[('sarcastic',False,contract['lines'],'LINES')]
    for personality,preset in contract['presets'].items():
        sources += [(personality,False,preset['lines'],'PRESETS.lines'),(personality,True,preset.get('profane',{}),'PRESETS.profane')]
    for personality,profanity,mapping,source in sources:
        for event,lines in mapping.items():
            for i,line in enumerate(lines):
                c=ambient(event,personality,profanity,i+1,contract,rng)
                if not event.startswith('title_') and event!='screen_comment':
                    c.pop('safeTitle',None); c.pop('screenDescription',None)
                # Gold templates get all their supported slots; never claim unsupplied app facts.
                c.update(app=c.get('app','Figma'),minutes=30,hours=1,count=3,overdue=1,remaining=3,reminder='18:45')
                if '{name}' in dumps(line): c['name']='{name}'
                value={'shouldSpeak':True,'dialogue':fill(line['text'],c),'then':fill(line.get('then',''),c),
                       'emotion':contract['policies'][event][3],'animation':contract['policies'][event][4]}
                row={'id':'gold-'+digest([source,personality,event,i,line])[:20],'kind':'ambient','situation':event,'personality':personality,'context':c,
                     'source':'gold','sourceLocation':f'{source}/{personality}/{event}/{i}','template':line,'split':'train'}
                inventory.append((row,value,None if eligible(line) else 'ineligible_authored'))
    talk_prompts={'talk_hint':'What can I ask you to do?','talk_huh':'?', 'talk_greeting':'hello ducky',
                  'talk_signoff':'bye for now','talk_still_thinking':'Are you still thinking?',
                  'talk_error':'Your previous answer failed. What happened?', 'talk_tool_failed':'The tool failed. Did that work?',
                  'talk_offline':'The local model connection is offline. What can you do?'}
    for category,lines in contract['talk'].items():
        for i,line in enumerate(lines):
            c=conversation_context('sarcastic',False,i,contract,rng,talk_prompts[category])
            if category=='talk_tool_failed': c['toolResult']={'ok':False,'message':'Operation failed; completion unconfirmed.'}
            row={'id':'gold-'+digest([category,i,line])[:20],'kind':'conversation','situation':category,'personality':'sarcastic','context':c,
                 'source':'gold','sourceLocation':f'TALK_LINES/{category}/{i}','template':line,'split':'train'}
            inventory.append((row,{'reply':line,'tone':'neutral','tool':None},None))
    return inventory

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--contexts',type=Path,default=ROOT/'data/contexts.jsonl'); p.add_argument('--raw',type=Path,default=ROOT/'data/raw.jsonl')
    p.add_argument('--contract',type=Path,default=ROOT/'data/app_contract.json'); p.add_argument('--output-dir',type=Path,default=ROOT/'data')
    p.add_argument('--seed',type=int,default=42); p.add_argument('--allow-partial',action='store_true',help='Allow missing candidate slots for offline smoke tests or interrupted generation')
    p.add_argument('--candidates',type=int,default=3); a=p.parse_args(); run=logging_run('filter')
    contract=load_contract(a.contract); validator=Validator(contract); contexts=read_jsonl(a.contexts); context_map={r['id']:r for r in contexts}
    raw=read_jsonl(a.raw); by_id=defaultdict(dict); reject=Counter(); inventory=[]
    if not a.raw.exists() and not a.allow_partial: p.error('No raw candidates; run generate.py first')
    for r in raw:
        if r['id'] not in context_map: raise ValueError('Raw candidate has unknown context id')
        if r.get('model') not in ('qwen3:14b','qwen3:8b'): raise ValueError('Teacher provenance must be a permitted local Qwen model')
        if r.get('contextHash')!=digest(context_map[r['id']]['context']): raise ValueError('Raw candidate/context hash mismatch')
        if r['candidate'] in by_id[r['id']]: raise ValueError('Duplicate candidate journal key')
        by_id[r['id']][r['candidate']]=r
    missing=[r['id'] for r in contexts if any(k not in by_id[r['id']] for k in range(a.candidates))]
    if missing and not a.allow_partial: p.error(f'{len(missing)} contexts have incomplete candidates. Resume generation or use --allow-partial.')
    # Reserve all accepted gold in the global duplicate index, including against held-out outputs.
    index=DuplicateIndex(); accepted=[]; gold_reasons=Counter()
    for row,value,error in gold_inventory(contract):
        if error is None: value,error=validator.validate(dumps(value),row,strict=True)
        inventory.append({'id':row['id'],'sourceLocation':row['sourceLocation'],'template':row['template'],'status':error or 'accepted'})
        if error: gold_reasons[error]+=1; continue
        # Authored duplicates are intentionally preserved as gold; all remain in train.
        for line in beats(value): index.add(line)
        accepted.append((row,value))
    valid=defaultdict(list); frequency=Counter()
    for row in contexts:
        for candidate in by_id[row['id']].values():
            value,error=validator.validate(candidate['raw'],row,strict=True)
            if error:
                reject[error]+=1; append_rejection={'id':row['id'],'candidate':candidate['candidate'],'reason':error}
                inventory.append(append_rejection); continue
            valid[row['id']].append((value,candidate['candidate']))
            for line in beats(value): frequency[line]+=1
    common=[line for line,count in frequency.most_common(30)]
    # Keep one representative of common lines, reject subsequent near-paraphrases globally.
    common_index=DuplicateIndex(); common_seen=set()
    for line in common: common_index.add(line)
    order=list(contexts); random.Random(a.seed).shuffle(order)
    # Val gets first choice after gold, so train cannot steal its accepted target.
    order.sort(key=lambda r:r['split']!='val')
    silent=0
    for row in order:
        ranked=sorted(valid[row['id']],key=lambda item:(generic_count(output_text(item[0])),sum(frequency[s] for s in beats(item[0])),-len(set(output_text(item[0]).lower().split())),item[1]))
        for value,k in ranked:
            lines=beats(value)
            if not lines:
                # Prevent silence collapse: retain a small, auditable number of teacher silences.
                if silent>=max(1,len(contexts)//50): reject['silence_cap']+=1; continue
            if any(index.duplicate(line) for line in lines): reject['global_near_duplicate']+=1; continue
            if any(common_index.duplicate(line) and any(similarity(line,s)>=.6 for s in common_seen) for line in lines):
                reject['common_30_duplicate']+=1; continue
            for line in lines:
                index.add(line)
                if common_index.duplicate(line): common_seen.add(line)
            if not lines: silent+=1
            accepted.append((dict(row,source='ollama',candidate=k),value)); break
        else: reject['context_dropped']+=1
    train=[]; val=[]; counts=Counter(); heldout_ids={r['id'] for r in contexts if r['split']=='val'}
    for row,value in accepted:
        record={'messages':messages_for(row,contract,'short')+[{'role':'assistant','content':dumps(value)}],
                'id':row['id'],'kind':row['kind'],'situation':row['situation'],'personality':row['personality'],'source':row['source'],
                'split':row['split'],'weight':3 if row['source']=='gold' else 1,'context':row['context']}
        counts[f"{row['split']}/{row['source']}/{row['situation']}/{row['personality']}"]+=1
        if row['split']=='val': val.append(record)
        else:
            if row['id'] in heldout_ids: raise AssertionError('Heldout leakage')
            train.extend([dict(record,replica=i) for i in range(record['weight'])])
    random.Random(a.seed).shuffle(train); random.Random(a.seed).shuffle(val)
    write_jsonl(a.output_dir/'train.jsonl',train); write_jsonl(a.output_dir/'val.jsonl',val)
    write_jsonl(a.output_dir/'gold_inventory.jsonl',[r for r in inventory if 'template' in r]); write_jsonl(run/'rejections.jsonl',[r for r in inventory if 'reason' in r])
    write_jsonl(run/'samples.jsonl',[{'id':r['id'],'kind':r['kind'],'personality':r['personality'],'context':r['context'],'answer':v} for r,v in accepted])
    report={'contexts':len(contexts),'missing_candidate_contexts':len(missing),'raw_candidates':len(raw),'accepted_unique':len(accepted),'train_weighted':len(train),'validation':len(val),
            'rejection_reasons':dict(reject),'gold_rejections':dict(gold_reasons),'counts':dict(sorted(counts.items())),'common_30':frequency.most_common(30),
            'inputs':{'contexts':file_hash(a.contexts),'contract':digest(contract),'raw':file_hash(a.raw) if a.raw.exists() else None},
            'gold_policy':'Every authored line inventoried; eligible validator-passing gold only, train-only, 3 physical replicas. Gold is exempt from dedup against other gold. Synthetic outputs dedup against all gold and both splits.'}
    write_json(run/'report.json',report); write_json(a.output_dir/'dataset_manifest.json',dict(report,trainHash=file_hash(a.output_dir/'train.jsonl'),valHash=file_hash(a.output_dir/'val.jsonl')))
    md=['# Ducky filter report',f"Accepted {len(accepted)} unique examples; {len(train)} weighted train rows; {len(val)} validation rows.",
        f"Missing candidates for {len(missing)} contexts. Gold exclusions: {dict(gold_reasons)}.",
        'Split is reserved before generation, grouped by question across personalities. Gold stays in training; validation contains only unseen synthetic targets. Evaluation uses the ENTIRE held-out input set, including rejected targets.',
        '## Rejections','| Reason | Count |','|---|---:|']
    md += [f'| {k} | {v} |' for k,v in reject.most_common()]
    md += ['## Coverage','| Split / source / situation / personality | Count |','|---|---:|']+[f'| {k} | {v} |' for k,v in sorted(counts.items())]
    for personality in ('wholesome','playful','sarcastic','unhinged'):
        sample=[(r,v) for r,v in accepted if r['personality']==personality]; random.Random(a.seed).shuffle(sample)
        md += ['## '+personality]+[f"- [{r['kind']}/{r['situation']}/{r['source']}] {output_text(v)}" for r,v in sample[:20]]
    from common import atomic_text
    atomic_text(run/'report.md','\n\n'.join(md)+'\n'); logging.info('Wrote %d train rows, %d val rows. Read %s',len(train),len(val),run/'report.md')

if __name__=='__main__': main()
