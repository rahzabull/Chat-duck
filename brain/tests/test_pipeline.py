"""Offline correctness checks; no Ollama calls and no GPU model load."""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from common import APP, ROOT, dumps, load_contract, read_jsonl, append_jsonl, file_hash
from validation import Validator, DuplicateIndex, similarity, validate_tool
from train_lora import encode_example, CompletionCollator

class PipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract=load_contract(); cls.validator=Validator(cls.contract)
        cls.ambient={'kind':'ambient','context':{'event':'thought','localTime':'14:20','personality':'sarcastic','profanity':False}}
        cls.response={'shouldSpeak':True,'dialogue':'My hat has filed a complaint.','then':'','emotion':'curious','animation':'idle'}

    def test_context_coverage_and_split(self):
        rows=read_jsonl(ROOT/'data/contexts.jsonl'); self.assertEqual(len(rows),3700)
        ambient=[r for r in rows if r['kind']=='ambient']
        self.assertEqual(len({(r['situation'],r['personality'],r['context']['profanity']) for r in ambient}),len(self.contract['lines'])*8)
        held=[r for r in rows if r['split']=='val']; self.assertEqual(len(held),185)
        train_prompts={r['context']['turns'][-1]['text'] for r in rows if r['kind']=='conversation' and r['split']=='train'}
        val_prompts={r['context']['turns'][-1]['text'] for r in held if r['kind']=='conversation'}
        self.assertFalse(train_prompts&val_prompts)
        allowed={'safeTitle','screenDescription','overdue','remaining','reminder','personality','profanity','mood','emotions','name','memoryFact','event','localTime','app','count','minutes','hours'}
        self.assertTrue(all(set(r['context'])<=allowed for r in ambient))

    def test_differential_app_validator(self):
        fixtures=[]
        texts=['My hat has filed a complaint.','Seriously, another afternoon.','Ugh, this again.','Oh great, more standing.','Well, here we are.',
            'As a duck I stand here.','Your tabs look suspicious.','My files are gone.','There are 7 crumbs.','It is 14:20 already.',
            'It is two twenty pm.','It is two twenty.','It is midnight.','A quiet little thought.','I missed you.','You abandoned me.',
            'Damn this hat.','Your damn hat.','For f— sake, gravity.','This is r.e.t.a.r.d nonsense.',
            'Small duck 🦆 here.','Tiny **duck** thoughts.','See example.com today.','A newline\nshould fail.','Hi.',
            'A quiet thought with ٢ wings.','"My hat needs a holiday."','The sky looks blue.','Nice layout, I suppose.',
            'Look at the sidebar.','That video looks quiet.','I have two wings.','I have 2 wings.']
        for event,extra in [('thought',{}),('thought_late',{}),('thought',{'count':7}),('title_switch',{'safeTitle':'Figma – Landing page'})]:
            for profanity in (False,True):
                row=copy.deepcopy(self.ambient); row['context'].update(event=event,profanity=profanity,**extra)
                for text in texts:
                    value=dict(self.response,dialogue=text); fixtures.append({'row':row,'raw':dumps(value)})
        for changes in [{'then':'one'},{'then':'small second beat'},{'then':'A quiet second beat.'},{'emotion':'unknown'},{'animation':'nap'},{'shouldSpeak':False,'emotion':'bad'},{'extra':1}]:
            fixtures.append({'row':self.ambient,'raw':dumps(dict(self.response,**changes))})
        fixtures.append({'row':self.ambient,'raw':dumps(self.response),'recent':['My hat has filed another complaint.']})
        conv={'kind':'conversation','context':{'availableTools':['remember'],'settings':{'personality':'sarcastic','profanity':False}}}
        for reply in ['Hello there friend.','Hi 🦆','Here is code:\n```python\nprint(2)\n```','That is r.e.t.a.r.d stuff.','I saved the task.']:
            fixtures.append({'row':conv,'raw':dumps({'reply':reply,'tone':'bad','tool':None})})
        oracle=subprocess.run(['node',str(ROOT/'tests/app_oracle.cjs'),str(APP),str(ROOT/'data/app_contract.json')],input=dumps(fixtures),capture_output=True,text=True,encoding='utf-8')
        self.assertEqual(oracle.returncode,0,oracle.stderr)
        actual=json.loads(oracle.stdout)
        for fixture,js in zip(fixtures,actual):
            with self.subTest(raw=fixture['raw'],context=fixture['row']['context']):
                py,error=self.validator.validate(fixture['raw'],fixture['row'],fixture.get('recent',[]))
                self.assertEqual(py is not None,js['kind']!='invalid',f'Python rejection: {error}; JS: {js}')
                if py is not None and js['kind']=='speech':
                    self.assertEqual(py['dialogue'],js['speech']['text']); self.assertEqual(py['then'],js['speech'].get('then',''))
                if py is not None and js['kind']=='conversation': self.assertEqual(py,js['value'])

    def test_stricter_rules_and_tools(self):
        row=copy.deepcopy(self.ambient); row['context'].update(personality='wholesome',profanity=True)
        self.assertEqual(self.validator.validate(dumps(dict(self.response,dialogue='Damn this hat.')),row,strict=True)[1],'dataset_profanity')
        c={'localDateTime':'2026-11-26T09:00:00+05:30','turns':[{'text':'remind me to drink water every half an hour'}]}
        tool={'name':'add_reminder','args':{'text':'drink water','at':'2026-11-26T09:30:00+05:30','recurrence':{'kind':'interval','intervalMinutes':30}}}
        self.assertIsNone(validate_tool(tool,c,self.contract))
        tool['args']['recurrence']['intervalMinutes']=True; self.assertEqual(validate_tool(tool,c,self.contract),'tool_args')
        tool['args']['recurrence']['intervalMinutes']=1; self.assertEqual(validate_tool(tool,c,self.contract),'tool_args')
        self.assertEqual(validate_tool({'name':'remember','args':{'text':'likes tea'}},c,self.contract),'memory_without_request')

    def test_jaccard_and_crash_journal(self):
        idx=DuplicateIndex(); idx.add('My tiny hat is on strike.')
        self.assertTrue(idx.duplicate('My little hat is on strike.')); self.assertFalse(idx.duplicate('The sky looks rather cloudy.'))
        with tempfile.TemporaryDirectory(dir=ROOT/'runs') as d:
            p=Path(d)/'journal.jsonl'; append_jsonl(p,{'id':'a'})
            with p.open('ab') as f:f.write(b'{"id":')
            self.assertEqual(read_jsonl(p,recover_tail=True),[{'id':'a'}]); append_jsonl(p,{'id':'b'})
            self.assertEqual(len(read_jsonl(p)),2)

    def test_completion_mask_real_tokenizer(self):
        from transformers import AutoTokenizer
        tokenizer=AutoTokenizer.from_pretrained(ROOT/'models/Qwen3-4B-Instruct-2507',local_files_only=True)
        messages=[{'role':'system','content':'You are Ducky.'},{'role':'user','content':'Say hello.'},{'role':'assistant','content':dumps(self.response)}]
        encoded=encode_example(tokenizer,messages,768)
        supervised=[x for x in encoded['labels'] if x!=-100]
        text=tokenizer.decode(supervised)
        self.assertEqual(text,dumps(self.response)+'<|im_end|>\n')
        self.assertIsNone(encode_example(tokenizer,messages,8))
        short=encode_example(tokenizer,[*messages[:2],{'role':'assistant','content':'{}'}],768)
        batch=CompletionCollator(tokenizer.pad_token_id)([encoded,short])
        self.assertTrue(all(x==-100 for x in batch['labels'][1,len(short['labels']):].tolist()))

    def test_generation_resume_without_network(self):
        import generate
        from common import digest, write_jsonl
        row=dict(self.ambient,id='test-source-only',situation='thought',personality='sarcastic',split='train')
        # The mock response comes directly from authored source, never from a hosted model.
        response=dict(self.response,dialogue=self.contract['lines']['thought'][0]['text'])
        with tempfile.TemporaryDirectory(dir=ROOT/'runs') as d:
            contexts=Path(d)/'contexts.jsonl'; output=Path(d)/'raw.jsonl'; write_jsonl(contexts,[row])
            args=['generate.py','--contexts',str(contexts),'--output',str(output),'--limit','2']
            with patch.object(generate,'ollama_chat',return_value=({'message':{'content':dumps(response)},'done_reason':'stop'},12.0)) as chat:
                with patch.object(sys,'argv',args): generate.main()
                self.assertEqual(chat.call_count,2)
                with patch.object(sys,'argv',args): generate.main()
                self.assertEqual(chat.call_count,3)
                with patch.object(sys,'argv',args): generate.main()
                self.assertEqual(chat.call_count,3)
            rows=read_jsonl(output); self.assertEqual({r['candidate'] for r in rows},{0,1,2})
            self.assertTrue(all(r['contextHash']==digest(row['context']) for r in rows))

    def test_evaluation_resume_without_network(self):
        import importlib.util
        spec=importlib.util.spec_from_file_location('ducky_eval',ROOT/'scripts/eval.py'); module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        from common import write_jsonl
        row=dict(self.ambient,id='test-eval',situation='thought',personality='sarcastic',split='val')
        response=dict(self.response,dialogue=self.contract['lines']['thought'][0]['text'])
        # Logging files stay outside TemporaryDirectory because Windows keeps log handles open.
        with tempfile.TemporaryDirectory(dir=ROOT/'runs') as d:
            held=Path(d)/'heldout.jsonl'; bake=Path(d)/'bakeoff.jsonl'; write_jsonl(held,[row]); write_jsonl(bake,[])
            run=Path(d)/'eval'; args=['eval.py','--heldout',str(held),'--bakeoff',str(bake),'--run-dir',str(run)]
            with patch.object(module,'ollama_chat',return_value=({'message':{'content':dumps(response)},'done_reason':'stop'},12.0)) as chat:
                with patch.object(sys,'argv',args): module.main()
                self.assertEqual(chat.call_count,6)  # Three excluded warmups and three measured calls.
                with patch.object(sys,'argv',args): module.main()
                self.assertEqual(chat.call_count,6)
            self.assertEqual(len(read_jsonl(run/'results.jsonl')),3); self.assertTrue((run/'report.md').exists())
            import logging
            logging.shutdown()

if __name__=='__main__': unittest.main()
