"""Merge a local LoRA adapter to bf16 safetensors and prepare an Ollama import."""
from __future__ import annotations
import os
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',TOKENIZERS_PARALLELISM='false')
import argparse
import json
import logging
from pathlib import Path
from common import ROOT, DEFAULT_SYSTEM, atomic_text, digest, file_hash, logging_run, manifest, write_json

TEMPLATE = r'''{{- if .Messages -}}
{{- range .Messages }}{{ "<|im_start|>" }}{{ .Role }}{{ "\n" }}{{ .Content }}{{ "<|im_end|>\n" }}{{ end -}}
{{ "<|im_start|>assistant\n" }}
{{- else -}}
{{- if .System }}{{ "<|im_start|>system\n" }}{{ .System }}{{ "<|im_end|>\n" }}{{ end -}}
{{ "<|im_start|>user\n" }}{{ .Prompt }}{{ "<|im_end|>\n<|im_start|>assistant\n" }}
{{- end }}{{ .Response }}'''

def verify_template(tokenizer):
    fixtures=[ [{'role':'user','content':'hello'}],
        [{'role':'system','content':DEFAULT_SYSTEM},{'role':'user','content':'{"event":"thought"}'}],
        [{'role':'system','content':'Ducky'},{'role':'user','content':'hi'},{'role':'assistant','content':'{"reply":"Hello there, friend.","tone":"warm","tool":null}'},{'role':'user','content':'again'}],
        [{'role':'system','content':'Ducky'},{'role':'user','content':'do it'},{'role':'assistant','content':'request'},{'role':'system','content':'TOOL_RESULT data'}]]
    for messages in fixtures:
        expected=''.join('<|im_start|>'+m['role']+'\n'+m['content']+'<|im_end|>\n' for m in messages)+'<|im_start|>assistant\n'
        actual=tokenizer.apply_chat_template(messages,tokenize=False,add_generation_prompt=True)
        if actual!=expected: raise ValueError('HF template differs from supported non-native-tool ChatML. Refusing to export a mismatched template.')
    return len(fixtures)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--adapter',type=Path,help='runs/train/<timestamp>/adapter; required for merge')
    p.add_argument('--base',type=Path,default=ROOT/'models/Qwen3-4B-Instruct-2507')
    p.add_argument('--output',type=Path,default=ROOT/'export/round2/ducky-4b-v2-merged')
    p.add_argument('--model-tag',default='ducky:4b-v2')
    p.add_argument('--device',choices=['cpu','cuda'],default='cpu',help='CPU default needs roughly 20-30 GB free RAM; CUDA uses the GPU')
    p.add_argument('--prepare-only',action='store_true',help='Verify tokenizer and write Modelfile only; no model load')
    a=p.parse_args(); run=logging_run('merge_export')
    from transformers import AutoTokenizer
    tokenizer=AutoTokenizer.from_pretrained(a.base,local_files_only=True,trust_remote_code=False)
    fixtures=verify_template(tokenizer)
    model_dir=a.output.resolve(); export=model_dir.parent
    modelfile=f'FROM ./{model_dir.name}\n\nSYSTEM """{DEFAULT_SYSTEM}"""\n\nTEMPLATE """{TEMPLATE}"""\n\nPARAMETER temperature 0.8\nPARAMETER top_p 0.95\nPARAMETER repeat_penalty 1.15\nPARAMETER num_ctx 4096\nPARAMETER num_predict 700\nPARAMETER stop "<|im_end|>"\nPARAMETER stop "<|im_start|>"\nPARAMETER stop "<|endoftext|>"\n'
    atomic_text(export/'Modelfile',modelfile)
    write_json(run/'template-verification.json',{'fixtures':fixtures,'hfTemplateHash':digest(tokenizer.chat_template),'scope':'system/user/assistant messages with text; Ducky tools are JSON payloads, not HF native tools/tool_calls'})
    if a.prepare_only: logging.info('Template verified and Modelfile written; no weights merged'); return
    if not a.adapter or not (a.adapter/'adapter_config.json').exists(): p.error('--adapter must be a completed PEFT adapter directory')
    weights=a.adapter/'adapter_model.safetensors'
    config={'base':str(a.base.resolve()),'baseConfig':file_hash(a.base/'config.json'),'baseIndex':file_hash(a.base/'model.safetensors.index.json'),
            'adapterConfig':file_hash(a.adapter/'adapter_config.json'),'adapterWeights':file_hash(weights),'dtype':'bfloat16','template':digest(tokenizer.chat_template)}
    if model_dir.exists():
        complete=model_dir/'export_manifest.json'
        if complete.exists() and json.loads(complete.read_text(encoding='utf-8'))==config:
            logging.info('Matching export already complete')
        else: raise ValueError('Output exists but is incomplete or has different inputs. Use a different --output; no export is overwritten.')
    else:
        stage=model_dir.with_name(model_dir.name+'.staging'); stage.mkdir(parents=True,exist_ok=True)
        manifest(stage/'merge_inputs.json',config)
        import torch
        from transformers import AutoModelForCausalLM
        from peft import PeftModel
        base=AutoModelForCausalLM.from_pretrained(a.base,local_files_only=True,trust_remote_code=False,torch_dtype=torch.bfloat16,attn_implementation='sdpa',device_map={'':a.device})
        model=PeftModel.from_pretrained(base,a.adapter,local_files_only=True,is_trainable=False)
        merged=model.merge_and_unload(safe_merge=True); merged.to(dtype=torch.bfloat16)
        merged.save_pretrained(stage,safe_serialization=True,max_shard_size='4GB'); tokenizer.save_pretrained(stage)
        # Check every referenced shard exists before publishing the directory.
        idx=stage/'model.safetensors.index.json'
        shards=set(json.loads(idx.read_text())['weight_map'].values()) if idx.exists() else {'model.safetensors'}
        if any(not (stage/s).is_file() or (stage/s).stat().st_size==0 for s in shards): raise RuntimeError('Incomplete merged shards')
        write_json(stage/'export_manifest.json',config); stage.rename(model_dir)
        logging.info('Merged bf16 weights: %s',model_dir)
    command=f'ollama create {a.model_tag} -q q4_K_M -f Modelfile'
    atomic_text(export/'create-command.txt',f'Run in {export}\n{command}\n')
    print(f'\nRun from: {export}\n{command}')

if __name__=='__main__': main()
