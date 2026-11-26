"""Generate teacher candidates using only local qwen3:14b."""
from __future__ import annotations
import argparse
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
import logging
from pathlib import Path
import time
from common import ROOT, append_jsonl, digest, file_hash, load_contract, logging_run, manifest, messages_for, ollama_chat, read_jsonl, schema_for

from voice import candidate_count, teacher_messages, voice_hashes

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--contexts',type=Path,default=ROOT/'data/round2/contexts.jsonl'); p.add_argument('--contract',type=Path,default=ROOT/'data/round2/app_contract.json')
    p.add_argument('--output',type=Path,default=ROOT/'data/round2/raw.jsonl'); p.add_argument('--model',choices=['qwen3:14b'],default='qwen3:14b')
    p.add_argument('--candidates',type=int,default=0,help='0: four for unhinged/sarcastic, two otherwise'); p.add_argument('--concurrency',type=int,default=2)
    p.add_argument('--port',type=int,default=11434); p.add_argument('--timeout',type=float,default=180)
    p.add_argument('--retries',type=int,default=3); p.add_argument('--limit',type=int,default=0); p.add_argument('--dry-run',action='store_true')
    a=p.parse_args(); run=logging_run('generate')
    if a.candidates<0 or min(a.concurrency,a.retries)<1: p.error('candidates/concurrency/retries must be positive')
    contract=load_contract(a.contract); rows=read_jsonl(a.contexts)
    config={'contexts':file_hash(a.contexts),'contract':digest(contract),'model':a.model,'candidates':a.candidates,'temperature':{'unhinged':1.0,'other':.9},'voice':voice_hashes(),
            'commonCode':file_hash(Path(__file__).with_name('common.py')),'generatorCode':file_hash(__file__)}
    if a.dry_run:
        from common import write_json
        write_json(run/'request-preview.json',{'model':a.model,'think':False,'format':schema_for(rows[0],contract),'messages':teacher_messages(rows[0],contract),'temperature':1.0 if rows[0]['personality']=='unhinged' else .9})
        logging.info('Preview written; no HTTP calls'); return
    manifest(a.output.with_suffix('.manifest.json'),config)
    existing=read_jsonl(a.output,recover_tail=True)
    done={(r['id'],r['candidate']) for r in existing if 'raw' in r}
    todo=[(r,k) for r in rows for k in range(candidate_count(r,a.candidates)) if (r['id'],k) not in done]
    if a.limit: todo=todo[:a.limit]
    logging.info('%d candidate requests pending, %d already complete',len(todo),len(done))
    def generate(item):
        row,k=item; seed=int(digest([row['id'],k])[:8],16)%2147483647
        for attempt in range(a.retries):
            try:
                response,ms=ollama_chat(a.model,teacher_messages(row,contract,k),schema_for(row,contract),port=a.port,timeout=a.timeout,seed=seed,temperature=1.0 if row['personality']=='unhinged' else .9,num_predict=220 if row['kind']=='ambient' else 1100)
                if response.get('done_reason')=='length': raise ValueError('Output hit token limit')
                return {'id':row['id'],'candidate':k,'contextHash':digest(row['context']),'model':a.model,'seed':seed,'raw':response['message']['content'],'latency_ms':ms,'response':response}
            except Exception as e:
                if attempt==a.retries-1: return {'id':row['id'],'candidate':k,'error':type(e).__name__+': '+str(e)}
                time.sleep(min(2**attempt,8))
    failures=0
    with ThreadPoolExecutor(max_workers=a.concurrency) as pool:
        # Bounded queue: Ctrl+C never waits for thousands of queued requests.
        items=iter(todo); futures={}; n=0
        def submit():
            item=next(items,None)
            if item is not None: futures[pool.submit(generate,item)]=item
        for _ in range(a.concurrency): submit()
        while futures:
            completed,_=wait(futures,return_when=FIRST_COMPLETED)
            for future in completed:
                futures.pop(future); result=future.result(); n+=1
                if 'error' in result:
                    failures+=1; append_jsonl(run/'errors.jsonl',result); logging.warning('%s candidate %s: %s',result['id'],result['candidate'],result['error'])
                else: append_jsonl(a.output,result)
                if n%10==0 or n==len(todo): logging.info('%d/%d requests finished; %d failed (retry on rerun)',n,len(todo),failures)
                submit()
    if failures: raise SystemExit(1)

if __name__=='__main__': main()
