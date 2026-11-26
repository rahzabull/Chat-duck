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
from voice import TARGET_MIX, assistant_penalty, motifs, voice_hashes

def gold_inventory(contract):
    """Every authored line is inventoried. Unsafe/ineligible originals are quarantined, never rewritten by an API."""
    rng=random.Random(731); inventory=[]
    sources=[('sarcastic',False,contract['lines'],'LINES')]
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
    from voice import gold_rows
    ambient_gold, chat_gold = gold_rows()
    for i,line in enumerate(ambient_gold):
        event=line['situation']; personality=line['personality']
        if event not in contract['policies']:
            inventory.append(({'id':'gold-v2-'+digest(line)[:20],'sourceLocation':f'gold/unhinged-v2.jsonl:{i+1}',
                               'template':line},None,'unknown_app_situation'))
            continue
        c=ambient(event,personality,False,i+1,contract,rng)
        c.pop('safeTitle',None); c.pop('screenDescription',None)
        c.update(app=c.get('app','Figma'),minutes=30,hours=0,count=3,overdue=1,remaining=3,reminder='18:45')
        row={'id':'gold-v2-'+digest(line)[:20],'kind':'ambient','situation':event,'personality':personality,
             'context':c,'source':'gold_v2','sourceLocation':f'gold/unhinged-v2.jsonl:{i+1}','template':line,'split':'train'}
        value={'shouldSpeak':True,'dialogue':fill(line['text'],c),'then':fill(line.get('then',''),c),
               'emotion':contract['policies'][event][3],'animation':contract['policies'][event][4]}
        error='identity_roast' if 'Men never ask' in line['text'] else None
        inventory.append((row,value,error))
    for i,line in enumerate(chat_gold):
        c=conversation_context(line['personality'],False,i+1,contract,rng,line['user'])
        c['turns']=c['turns'][-1:]; c['memories']=[]; c['summaries']=[]; c['availableTools']=[]
        row={'id':'gold-chat-v2-'+digest(line)[:20],'kind':'conversation','situation':'gold_chat_v2',
             'personality':line['personality'],'context':c,'source':'gold_v2',
             'sourceLocation':f'gold/conversation-unhinged-v2.jsonl:{i+1}','template':line,'split':'train'}
        inventory.append((row,{'reply':line['reply'],'tone':line['tone'],'tool':None},None))
    return inventory

def weight(row):
    return 5 if row['source']=='gold_v2' else 3 if row['source']=='gold' else 1

def cap_motifs(accepted):
    """Cap each motif at 4% of unique AND weighted visible beats, per personality/split.

    Start with motif-free lines, then greedily admit motif lines. The integer inequality
    is checked for every motif: later admissions cannot invalidate an earlier cap.
    """
    groups=defaultdict(list); kept=[]; rejected=[]
    for row,value in accepted: groups[(row['personality'],row['split'])].append((row,value))
    for group in groups.values():
        plain=[x for x in group if not motifs(output_text(x[1]))]
        themed=[x for x in group if motifs(output_text(x[1]))]
        themed.sort(key=lambda x:(x[0]['source']!='gold_v2',x[0]['source']=='ollama',-x[0].get('score',10),x[0]['id']))
        n=sum(len(beats(v)) for r,v in plain); total=sum(len(beats(v))*weight(r) for r,v in plain)
        counts=Counter(); weighted=Counter(); kept.extend(plain)
        for row,value in themed:
            additions=Counter(m for beat in beats(value) for m in motifs(beat)); w=weight(row)
            new_n=n+len(beats(value)); new_total=total+len(beats(value))*w
            if any(25*(counts[m]+additions[m])>new_n or 25*(weighted[m]+additions[m]*w)>new_total for m in ('bread','pigeon','hat')):
                rejected.append({'id':row['id'],'reason':'motif_cap'}); continue
            kept.append((row,value)); counts.update(additions); weighted.update({m:k*w for m,k in additions.items()})
            n=new_n; total=new_total
    return kept,rejected

def balance_train(records, seed):
    """Keep gold at exactly 5x/3x; upsample motif-free synthetic rows to target mix.

    Unique accepted examples are never thrown away just to meet a ratio. Replicas
    stay in their original train split. Validation is never balanced or replicated.
    """
    import math
    groups={p:[r for r in records if r['personality']==p] for p in TARGET_MIX}
    counts={p:sum(r['weight'] for r in rs) for p,rs in groups.items()}
    target_total=math.ceil(max((counts[p]/fraction for p,fraction in TARGET_MIX.items()),default=0))
    train=[]; deficits={}
    for p,rs in groups.items():
        for r in rs: train.extend([dict(r,replica=i) for i in range(r['weight'])])
        deficit=max(0,round(target_total*TARGET_MIX[p])-counts[p])
        pool=[r for r in rs if r['source']=='ollama' and not motifs(output_text(json.loads(r['messages'][-1]['content'])))]
        random.Random(str(seed)+p).shuffle(pool)
        if deficit and not pool: deficits[p]=deficit; continue
        for i in range(deficit):
            r=pool[i%len(pool)]; train.append(dict(r,replica=r['weight']+i//len(pool),balanceReplica=True))
    random.Random(seed).shuffle(train)
    return train,deficits

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--contexts',type=Path,default=ROOT/'data/round2/contexts.jsonl')
    p.add_argument('--raw',type=Path,default=ROOT/'data/round2/raw.jsonl')
    p.add_argument('--judged',type=Path,default=ROOT/'data/round2/judged.jsonl')
    p.add_argument('--contract',type=Path,default=ROOT/'data/round2/app_contract.json')
    p.add_argument('--output-dir',type=Path,default=ROOT/'data/round2')
    p.add_argument('--seed',type=int,default=42)
    p.add_argument('--gold-only',action='store_true',help='Offline inspection only; write to a separate preview directory')
    a=p.parse_args(); run=logging_run('round2/filter')
    contract=load_contract(a.contract); validator=Validator(contract); contexts=read_jsonl(a.contexts)
    context_map={r['id']:r for r in contexts}; rejected=[]; inventory=[]; accepted=[]; index=DuplicateIndex()
    if not contexts: p.error('No contexts; run make_contexts.py first')
    if a.gold_only and a.output_dir.resolve()==a.contexts.parent.resolve(): p.error('Gold preview needs a separate output directory')
    for row,value,error in gold_inventory(contract):
        if error is None: value,error=validator.validate(dumps(value),row,strict=True)
        if not error and assistant_penalty(row,output_text(value)): error='ambient_assistant_phrase'
        inventory.append({'id':row['id'],'sourceLocation':row['sourceLocation'],'template':row['template'],'status':error or 'accepted'})
        if error: continue
        accepted.append((row,value))
        for beat in beats(value): index.add(beat)
    if not a.gold_only:
        from judge import HumourJudge
        complete=json.loads(a.judged.with_suffix('.complete.json').read_text(encoding='utf-8'))
        expected={'selectedHash':file_hash(a.judged),'contexts':file_hash(a.contexts),'raw':file_hash(a.raw),
                  'judge':HumourJudge(a.output_dir/'judge-cache.jsonl',contract).version,'missingContexts':0}
        if any(complete.get(k)!=v for k,v in expected.items()): raise ValueError('Incomplete/stale judged data; finish generation and judge again')
        selected=read_jsonl(a.judged)
        if len({r['id'] for r in selected})!=len(selected): raise ValueError('Duplicate judged context')
        random.Random(a.seed).shuffle(selected); selected.sort(key=lambda x:context_map[x['id']]['split']!='val')
        for item in selected:
            row=context_map[item['id']]
            if item.get('contextHash')!=digest(row['context']) or not 6<=item['score']<=10: raise ValueError('Invalid judged selection')
            value,error=validator.validate(dumps(item['value']),row,strict=True)
            if not error and assistant_penalty(row,output_text(value)): error='ambient_assistant_phrase'
            if not error and any(index.duplicate(line) for line in beats(value)): error='global_near_duplicate'
            if error: rejected.append({'id':row['id'],'reason':error}); continue
            accepted.append((dict(row,source='ollama',candidate=item['candidate'],score=item['score']),value))
            for line in beats(value): index.add(line)
    accepted,motif_rejections=cap_motifs(accepted); rejected.extend(motif_rejections)
    rejected_ids={r['id']:r['reason'] for r in motif_rejections}
    for r in inventory:
        if r['id'] in rejected_ids: r['status']=rejected_ids[r['id']]
    train_unique=[]; val=[]
    for row,value in accepted:
        record={'messages':messages_for(row,contract,'short')+[{'role':'assistant','content':dumps(value)}],
            **{k:row[k] for k in ('id','kind','situation','personality','source','split','context')},'weight':weight(row)}
        if 'score' in row: record['humourScore']=row['score']
        (val if row['split']=='val' else train_unique).append(record)
    train,deficits=balance_train(train_unique,a.seed)
    if deficits and not a.gold_only: raise ValueError(f'Insufficient motif-free synthetic data to balance: {deficits}; generate more candidates')
    counts=Counter(r['personality'] for r in train)
    motif_report={}
    for personality in TARGET_MIX:
        group=[(r,v) for r,v in accepted if r['personality']==personality]
        lines=[b for r,v in group for b in beats(v)]
        motif_report[personality]={'visible_beats':len(lines),**{m:sum(m in motifs(b) for b in lines)/max(1,len(lines)) for m in ('bread','pigeon','hat')}}
    report={'contexts':len(contexts),'accepted_unique':len(accepted),'train_weighted':len(train),'validation':len(val),
        'target_mix':TARGET_MIX,'actual_mix':{p:counts[p]/max(1,len(train)) for p in TARGET_MIX},'weighted_counts':dict(counts),
        'balance_deficits':deficits,'motifs_unique':motif_report,'gold_status':dict(Counter(r['status'] for r in inventory)),
        'rejections':dict(Counter(r['reason'] for r in rejected)),'goldOnly':a.gold_only,'voice':voice_hashes(),
        'inputs':{'contexts':file_hash(a.contexts),'contract':digest(contract),'raw':file_hash(a.raw) if not a.gold_only else None,
                  'judged':file_hash(a.judged) if not a.gold_only else None},
        'policy':'Gold v2 exactly five physical replicas; lines.ts gold three. Balance replicates motif-free synthetic train examples only. All gold stays in train. Motifs <=4% of unique and weighted visible beats per personality/split.'}
    write_jsonl(a.output_dir/'train.jsonl',train); write_jsonl(a.output_dir/'val.jsonl',val)
    write_jsonl(a.output_dir/'gold_inventory.jsonl',inventory); write_jsonl(run/'rejections.jsonl',rejected)
    write_jsonl(run/'samples.jsonl',[{'id':r['id'],'kind':r['kind'],'personality':r['personality'],'context':r['context'],'answer':v} for r,v in accepted])
    write_json(run/'report.json',report)
    write_json(a.output_dir/'dataset_manifest.json',dict(report,trainHash=file_hash(a.output_dir/'train.jsonl'),valHash=file_hash(a.output_dir/'val.jsonl')))
    md=['# Round-two filtering',f'{len(accepted)} unique examples; {len(train)} weighted training rows; {len(val)} validation rows.',
        'Gold exclusions are explicit in gold_inventory.jsonl. The complete held-out input set is preserved for evaluation.',
        '## Mix','| Personality | Target | Actual |','|---|---:|---:|']
    md += [f"| {p} | {TARGET_MIX[p]:.0%} | {report['actual_mix'][p]:.1%} |" for p in TARGET_MIX]
    md += ['## Gold status',dumps(report['gold_status']),'## Rejections',dumps(report['rejections'])]
    for personality in TARGET_MIX:
        sample=[(r,v) for r,v in accepted if r['personality']==personality]; random.Random(a.seed).shuffle(sample)
        md += ['## '+personality]+[f"- [{r['source']}/{r['situation']}] {output_text(v)}" for r,v in sample[:20]]
    from common import atomic_text
    atomic_text(run/'report.md','\n\n'.join(md)+'\n'); logging.info('Read %s',run/'report.md')

if __name__=='__main__': main()
