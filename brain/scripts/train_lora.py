"""Windows bf16/SDPA LoRA, local files only; assistant completion loss, no packing."""
from __future__ import annotations
import os
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_DATASETS_OFFLINE='1',TOKENIZERS_PARALLELISM='false',WANDB_DISABLED='true')
import argparse
import json
import logging
import math
from pathlib import Path
from common import ROOT, append_jsonl, file_hash, logging_run, manifest, read_jsonl, write_json

TARGETS=['q_proj','k_proj','v_proj','o_proj','gate_proj','up_proj','down_proj']

def encode_example(tokenizer,messages,max_length):
    if [m['role'] for m in messages]!=['system','user','assistant']: raise ValueError('Expected one system/user/assistant training turn')
    prefix=tokenizer.apply_chat_template(messages[:-1],tokenize=True,add_generation_prompt=True,return_dict=False)
    full=tokenizer.apply_chat_template(messages,tokenize=True,add_generation_prompt=False,return_dict=False)
    # Fail closed if template changes or token boundaries disagree; never guess masks.
    if full[:len(prefix)]!=prefix: raise ValueError('Chat template prefix does not align with assistant tokens')
    if len(full)>max_length: return None
    labels=[-100]*len(prefix)+full[len(prefix):]
    if not any(x!=-100 for x in labels): raise ValueError('No assistant loss tokens')
    return {'input_ids':full,'attention_mask':[1]*len(full),'labels':labels}

class CompletionCollator:
    def __init__(self,pad): self.pad=pad
    def __call__(self,features):
        import torch
        width=max(len(f['input_ids']) for f in features)
        return {k:torch.tensor([f[k]+[padding]*(width-len(f[k])) for f in features],dtype=torch.long)
                for k,padding in [('input_ids',self.pad),('attention_mask',0),('labels',-100)]}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--base',type=Path,default=ROOT/'models/Qwen3-4B-Instruct-2507'); p.add_argument('--train',type=Path,default=ROOT/'data/train.jsonl'); p.add_argument('--val',type=Path,default=ROOT/'data/val.jsonl')
    p.add_argument('--run-dir',type=Path,help='Reuse this directory to resume its latest complete checkpoint; completed runs no-op')
    p.add_argument('--batch-size',type=int,default=2); p.add_argument('--effective-batch',type=int,default=32); p.add_argument('--epochs',type=float,default=2)
    p.add_argument('--max-length',type=int,default=768); p.add_argument('--lr',type=float,default=2e-4); p.add_argument('--seed',type=int,default=42)
    p.add_argument('--prepare-only',action='store_true',help='CPU tokenization/mask audit only; no model or CUDA load')
    a=p.parse_args(); run=logging_run('train',a.run_dir)
    if a.batch_size<1 or a.effective_batch%a.batch_size or a.epochs<=0: p.error('Effective batch must be divisible by positive microbatch; epochs must be positive')
    from transformers import AutoTokenizer
    tokenizer=AutoTokenizer.from_pretrained(a.base,local_files_only=True,trust_remote_code=False)
    if tokenizer.pad_token_id is None: tokenizer.pad_token=tokenizer.eos_token
    config={'base':str(a.base.resolve()),'baseConfig':file_hash(a.base/'config.json'),'tokenizer':file_hash(a.base/'tokenizer_config.json'),
            'train':file_hash(a.train),'val':file_hash(a.val),'batch':a.batch_size,'effectiveBatch':a.effective_batch,'epochs':a.epochs,
            'maxLength':a.max_length,'lr':a.lr,'seed':a.seed,'r':16,'alpha':32,'dropout':.05,'targets':TARGETS,'code':file_hash(__file__)}
    manifest(run/'config.json',config)
    if (run/'COMPLETE.json').exists(): logging.info('Training already complete: %s',run/'adapter'); return
    datasets={}; rejected=[]; stats={}
    for split,path in [('train',a.train),('val',a.val)]:
        rows=read_jsonl(path); encoded=[]
        for row in rows:
            value=encode_example(tokenizer,row['messages'],a.max_length)
            if value is None: rejected.append({'id':row['id'],'split':split,'reason':'over_max_length'}); continue
            encoded.append(value)
        if not encoded: raise ValueError(f'{split} is empty after tokenization. Generate/filter more data; never train without a validation set.')
        datasets[split]=encoded
        stats[split]={'input_rows':len(rows),'kept':len(encoded),'dropped':len(rows)-len(encoded),'supervised_tokens':sum(sum(x!=-100 for x in r['labels']) for r in encoded),'max_tokens':max(len(r['input_ids']) for r in encoded)}
    write_json(run/'tokenization.json',stats)
    from common import write_jsonl
    write_jsonl(run/'overlength.jsonl',rejected)
    logging.info('Tokenization: %s',stats)
    if a.prepare_only: return
    import torch
    from datasets import Dataset
    from transformers import AutoModelForCausalLM, Trainer, TrainerCallback, TrainingArguments, set_seed
    from peft import LoraConfig, get_peft_model
    if not torch.cuda.is_available() or not torch.cuda.is_bf16_supported(): raise RuntimeError('A CUDA GPU with bf16 is required. CPU training is intentionally disabled.')
    if int(os.environ.get('WORLD_SIZE','1'))!=1: raise RuntimeError('This runbook supports one Windows GPU; effective batch assumes world_size=1')
    set_seed(a.seed)
    model=AutoModelForCausalLM.from_pretrained(a.base,local_files_only=True,trust_remote_code=False,dtype=torch.bfloat16,attn_implementation='sdpa')
    model.config.use_cache=False
    model=get_peft_model(model,LoraConfig(r=16,lora_alpha=32,lora_dropout=.05,target_modules=TARGETS,bias='none',task_type='CAUSAL_LM'))
    model.enable_input_require_grads(); model.print_trainable_parameters()
    accumulation=a.effective_batch//a.batch_size; steps_per_epoch=math.ceil(math.ceil(len(datasets['train'])/a.batch_size)/accumulation)
    half_epoch=max(1,math.ceil(steps_per_epoch/2))
    args=TrainingArguments(output_dir=str(run),per_device_train_batch_size=a.batch_size,per_device_eval_batch_size=1,
        gradient_accumulation_steps=accumulation,num_train_epochs=a.epochs,learning_rate=a.lr,lr_scheduler_type='cosine',warmup_steps=max(1,round(steps_per_epoch*a.epochs*.03)),
        bf16=True,bf16_full_eval=True,optim='adamw_torch',gradient_checkpointing=True,gradient_checkpointing_kwargs={'use_reentrant':False},
        eval_strategy='steps',eval_steps=half_epoch,save_strategy='steps',save_steps=half_epoch,save_total_limit=3,
        logging_steps=max(1,min(10,half_epoch)),logging_first_step=True,report_to='none',dataloader_num_workers=0,
        prediction_loss_only=True,seed=a.seed,data_seed=a.seed,remove_unused_columns=False,load_best_model_at_end=True,metric_for_best_model='eval_loss',greater_is_better=False)
    class LossLog(TrainerCallback):
        def on_log(self,args,state,control,logs=None,**kwargs):
            if logs: append_jsonl(run/'metrics.jsonl',{'step':state.global_step,'epoch':state.epoch,**logs})
    trainer=Trainer(model=model,args=args,train_dataset=Dataset.from_list(datasets['train']),eval_dataset=Dataset.from_list(datasets['val']),
                    processing_class=tokenizer,data_collator=CompletionCollator(tokenizer.pad_token_id),callbacks=[LossLog()])
    checkpoints=sorted((d for d in run.glob('checkpoint-*') if (d/'trainer_state.json').exists() and (d/'optimizer.pt').exists() and (d/'scheduler.pt').exists() and (d/'adapter_model.safetensors').exists()),key=lambda d:int(d.name.split('-')[-1]))
    if checkpoints: logging.info('Resuming %s',checkpoints[-1])
    trainer.train(resume_from_checkpoint=str(checkpoints[-1]) if checkpoints else None)
    metrics=trainer.evaluate(); trainer.save_model(str(run/'adapter')); tokenizer.save_pretrained(run/'adapter')
    trainer.save_state(); write_json(run/'COMPLETE.json',{'metrics':metrics,'adapter':str(run/'adapter'),'config':config})
    logging.info('Adapter saved at %s',run/'adapter')

if __name__=='__main__': main()
