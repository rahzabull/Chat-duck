"""Python port of app validation, with separately labelled stricter dataset checks.

regex supplies the Unicode properties used by the TypeScript regular expressions.
Conversation does NOT inherit ambient grounding/markdown/length restrictions.
"""
from __future__ import annotations
import json
import unicodedata
from datetime import datetime
from collections import defaultdict
import regex as re
from common import dumps, effective_profanity, settings

GENERIC = ("seriously", "ugh", "oh great", "i'm just a duck", 'as a duck')
PROFANITY = re.compile(r'\b(fuck\w*|shit\w*|bullshit|bitch\w*|ass|asshole\w*|arse\w*|bastard\w*|cunt\w*|dick\w*|piss\w*|damn\w*|crap|wtf|stfu)\b',re.I)
STRONG = re.compile(r'\b(fuck\w*|bullshit|bitch\w*|ass|asshole\w*|arse\w*|bastard\w*|cunt\w*|dick\w*|piss\w*|wtf|stfu|nigg\w*|fagg\w*|retard\w*|kike\w*|chink\w*|trann\w*|spic)\b',re.I)
EMOJI = re.compile(r'[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\uFE0F\u200D\U000E0020-\U000E007F]')
SMALL = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
NUMBERS = SMALL + [t + (' '+SMALL[i] if i else '') for t in ['twenty','thirty','forty','fifty'] for i in range(10)]
def alternatives(xs): return '|'.join(sorted(xs,key=len,reverse=True)).replace(' ','[ -]')
HOUR = '(?:'+alternatives(NUMBERS[1:24])+r'|zero|\d{1,2})'
MINUTE = '(?:'+alternatives(NUMBERS)+'|(?:oh|zero)[ -](?:'+'|'.join(SMALL[1:10])+'))'
SUFFIX = r"(?:o['’]?clock|[ap]\.?m\.?)"
CLOCK = re.compile(r'\b(?:(\d{1,2}):(\d{2})(?:\s*('+SUFFIX+'))?|('+HOUR+')(?:[ -]('+MINUTE+r')(?:\s*('+SUFFIX+r'))?|\s*('+SUFFIX+r'))|noon|midnight)\b',re.I)
TIME_EVENTS = {'late_night_working','sleepy_late','thought_late','thought_morning'}

def words(text): return set(re.findall(r'[\p{L}\p{N}]+',text.lower().replace("'",'').replace('’','')))
def similarity(a,b):
    a,b=words(a),words(b); return len(a&b)/len(a|b) if a|b else 1.
def generic_count(text):
    text=text.lower().replace('’',"'"); return sum(bool(re.search(r'(?<!\w)'+re.escape(s)+r'(?!\w)',text)) for s in GENERIC)
def js_length(text): return len(text.encode('utf-16-le'))//2
def normalize(text):
    text=unicodedata.normalize('NFKD',text).lower()
    text=re.sub(r'[\p{M}\p{Cf}\x00-\x08\x0b-\x1f\x7f-\x9f]','',text)
    return re.sub(r'!(?=[a-z])','i',text).translate(str.maketrans('0@13457$','oaieasts'))
def number_value(value):
    value=re.sub(r'^(?:oh|zero) ','',value.lower().replace('-',' '))
    return int(value) if value.isdigit() else NUMBERS.index(value)
def clock_value(m):
    if m[0].lower() in ('noon','midnight'): return (12 if m[0].lower()=='noon' else 0,0,True)
    hour=number_value(m[1] or m[4]); minute=number_value(m[2] or m[5]) if m[2] or m[5] else 0
    suffix=(m[3] or m[6] or m[7] or '').replace('.','').lower(); meridiem=suffix in ('am','pm')
    if meridiem: hour=-1 if not 1<=hour<=12 else hour%12+(12 if suffix=='pm' else 0)
    return hour,minute,meridiem
def js_string(v):
    if isinstance(v,list): return ','.join(js_string(x) for x in v)
    if isinstance(v,bool): return str(v).lower()
    if isinstance(v,dict): return '[object Object]'
    return str(v)
def action_claim(text):
    prose=re.sub(r'```[\s\S]*?```|`[^`]*`','',text)
    return bool(re.search(r"\bI(?:'ve|’ve| have)?\s+(?:(?:successfully|already|just)\s+)?(?:saved|stored|remembered|deleted|removed|forgotten|sent|emailed|booked|scheduled|installed|downloaded|uploaded|opened|browsed|created|added|updated|completed|rescheduled|snoozed|started|stopped)\b|\bI(?:'ll|’ll| will) remember\b|\b(?:memory|reminder|email|file|appointment|task|note|timer)\s+(?:(?:has been|was|is)\s+)?(?:saved|deleted|sent|scheduled|created|added|updated|completed|snoozed|started|stopped)\b",prose,re.I))

class Validator:
    def __init__(self,contract):
        self.c=contract; safety=contract['safety']
        def literal(name):
            m=re.search(r'const '+name+r' = /(.*)/i;',safety)
            if not m: raise ValueError('Cannot extract safety regex '+name)
            return re.compile(m[1],re.I)
        self.blocked=literal('blockedWords'); self.self_harm=literal('selfHarm')
        insult=re.search(r"const insultWords = '(.*)';",safety)[1].replace('\\\\','\\')
        self.insults=re.compile(r'\b(?:'+insult+r')\b',re.I)
        self.directed=re.compile(r'\b(?:you|your|youre|ur|u)\b.{0,60}\b(?:'+insult+r')\b|\b(?:'+insult+r')\b.{0,25}\b(?:you|your)\b',re.I)
        vision=contract['vision']
        self.ordinary=set(re.search(r"const ordinary = new Set\(\('(.*?)'\.toLowerCase",vision,re.S)[1].lower().split())
        self.topics=set(re.search(r"const topics = new Set\(\('(.*?)'\)\.split",vision,re.S)[1].split())
        # Synthetic fixtures never contain personal names. Fail closed on unfamiliar
        # capitalized tokens in generated prose, including common coding example names.
        corpus=dumps(contract['lines'])+' '+dumps(contract['presets'])+' '+dumps(contract['talk'])
        self.public_words=words(corpus)|self.ordinary|self.topics|set('python javascript typescript html css sql json api utc iso true false none earth sun moon monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december first second third fourth step example return input output result note tip option idea summary because although while try start begin choose check sort count reverse remove define function const let var class print list set dict array map number string boolean use here sure absolutely certainly sorry unfortunately maybe yes no consider write keep divide multiply subtract add imagine focus take aim break avoid remember delete next finally however otherwise for if else def import from with except raise assert lambda'.split())
        from make_contexts import prompt_bank, APPS
        self.public_words |= words(dumps(prompt_bank())) | words(dumps(APPS))
        # Authored v2 vocabulary is allowed, without weakening the app validator.
        from voice import gold_rows, TOPIC_SEEDS
        self.public_words |= words(dumps(gold_rows())) | words(dumps(TOPIC_SEEDS))
        self.person_names=re.compile(r'\b(?:alice|bob|charlie|david|emma|john|jane|mary|michael|rahul|priya|sarah|smith|doe)\b',re.I)

    def personal_data(self,value):
        if isinstance(value,dict): return any(self.personal_data(v) for v in value.values())
        if isinstance(value,list): return any(self.personal_data(v) for v in value)
        if not isinstance(value,str): return False
        if self.person_names.search(value): return True
        if re.search(r'\b[\w.+-]+@[\w.-]+\.\w+\b|\b(?:\+?\d[ -]?){10,15}\b|\b(?:api[_ -]?key|password)\s*[:=]\s*\S+',value,re.I): return True
        for token in re.findall(r"(?<![\w])([A-Z][a-z]{2,}(?:['’][A-Za-z]+)?)(?![\w])",value):
            if token.lower().replace("'",'').replace('’','') not in self.public_words: return True
        return False

    def blocked_text(self,text):
        normalized=normalize(text); joined=re.sub(r'(?<=[a-z])[._*\-]+(?=[a-z])','',normalized)
        if any(self.blocked.search(v) or self.self_harm.search(re.sub(r'[^a-z\s]',' ',v)) for v in (normalized,joined)): return True
        return bool(self.insults.search(normalized) and (len(re.findall(r'[\p{L}\p{N}]+',normalized))<=8 or self.directed.search(re.sub(r'\s+',' ',normalized))))

    def blocked_output(self,value):
        if isinstance(value,str): return self.blocked_text(value)
        if isinstance(value,list): return any(self.blocked_output(x) for x in value)
        if isinstance(value,dict): return any(self.blocked_text(k) or self.blocked_output(v) for k,v in value.items())
        return False

    def rejected_language(self,text,allowed):
        if self.blocked_text(text): return True
        norm=normalize(text)
        if STRONG.search(norm): return True
        if not allowed: return bool(PROFANITY.search(norm) or re.search(r'\b(hell|bloody)\b|for f[—–-]',norm,re.I))
        rest=re.sub(r'\b(damn|hell|shit|crap|bloody)\b','',norm,flags=re.I)
        rest=re.sub(r'for f[—–-]+(?:\s*sake)?','',rest,flags=re.I)
        return bool(PROFANITY.search(rest) or re.search(r"\b(?:you(?:'re| are)?|your)\b.{0,25}\b(?:damn|hell|shit|crap|bloody)\b|\b(?:damn|hell|shit|crap|bloody)\b.{0,25}\b(?:you|your)\b",norm,re.I))

    def observation_leaks(self,text,source):
        if re.search(r'[\p{N}@]|https?:|www\.|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\b',text,re.I): return True
        norm=lambda w:w.lower().replace("'",'')
        proper=lambda s:re.findall(r"\b[A-Z][\p{L}'-]+\b",s)
        sensitive={w.lower() for w in proper(source) if norm(w) not in self.ordinary}
        sensitive.update(w.lower() for w in re.findall(r"[\p{L}'-]+",source) if norm(w) not in self.ordinary and w.lower() not in self.topics)
        for m in re.finditer(r"\b(?:named|called|by|person|user|author|contact)\s+([\p{L}'-]+(?:\s+[\p{L}'-]+)?)",source,re.I): sensitive.update(m[1].lower().split())
        return any(w.lower() in sensitive for w in re.findall(r"[\p{L}'-]+",text)) or any(norm(w) not in self.ordinary for w in proper(text))

    def beat(self,text,limit,c,recent):
        if (c.get('safeTitle') or c.get('screenDescription')) and self.observation_leaks(text,c.get('safeTitle','')+' '+c.get('screenDescription','')): return 'observation_leak'
        if js_length(text)>limit or len(text.strip().split())>18: return 'length'
        if re.search(r'[\r\n\u2028\u2029\x00-\x1f\x7f\x85]',text) or EMOJI.search(text): return 'emoji_control'
        if any(ord(x)>127 for x in re.findall(r'\p{N}',text)): return 'unicode_number'
        if re.search(r'(?:\b[a-z][a-z0-9+.-]*://|(?:https?|mailto|data|javascript|file):|www\.|\b[\w.-]+\.[a-z]{2,}(?:\b|/)|\b\S+@\S+)|[`*_#<>\[\]{}|~]|^\s*(?:[-+>]\s|\d+[.)]\s|[-=]{3,}\s*$)',text,re.I): return 'markdown_url'
        if re.search(r'^\s*(?:seriously\b|ugh\b|oh great\b|well,|as a duck\b|as an ai\b)',text,re.I): return 'banned_opener'
        if self.rejected_language(text,c.get('profanity') is True): return 'language'
        if re.search(r'miss(?:ed)? you|lonely without|abandon(?:ed)? me|why did you leave',text,re.I): return 'guilt'
        facts=' '.join(js_string(v) for k,v in c.items() if k not in ('localTime','event'))
        supplied=[clock_value(m) for m in CLOCK.finditer(facts)]
        if c['event'] in TIME_EVENTS: supplied += [clock_value(m) for m in CLOCK.finditer(c['localTime'])]
        for m in CLOCK.finditer(text):
            h,n,mer=clock_value(m)
            if not (0<=h<=23 and 0<=n<=59) or not any(n==fn and (fh==h or (not m[1] and not mer and h<=12 and fh%12==h%12)) for fh,fn,_ in supplied): return 'ungrounded_time'
        without=CLOCK.sub('',text)
        facts=' '.join(js_string(v) for k,v in c.items() if k!='localTime')
        if set(re.findall(r'\d+',without))-set(re.findall(r'\d+',facts)): return 'ungrounded_digit'
        if any(w.lower() not in words(facts) for w in re.findall(r'\b(tabs?|websites?|sites?|pages?|videos?|emails?|messages?|cats?|dogs?|files?)\b',text,re.I)): return 'invented_observation'
        if any(similarity(text,line)>=.6 for line in list(recent)[-30:]): return 'recent_duplicate'
        return None

    def validate(self,raw,row,recent=(),strict=False):
        c=row['context']; ambient=row['kind']=='ambient'
        if js_length(raw)>(8192 if ambient else 24000): return None,'raw_length'
        try: v=json.loads(raw,parse_constant=lambda s: (_ for _ in ()).throw(ValueError(s)))
        except (ValueError,TypeError): return None,'json'
        if self.blocked_output(v): return None,'blocklist'
        if not isinstance(v,dict): return None,'shape'
        if ambient:
            if set(v)!={'animation','dialogue','emotion','shouldSpeak','then'} or type(v['shouldSpeak']) is not bool or any(not isinstance(v[k],str) for k in ('animation','dialogue','emotion','then')): return None,'shape'
            if strict and (v['emotion'] not in self.c['emotions'] or v['animation'] not in self.c['animations']): return None,'enum'
            if not v['shouldSpeak']:
                if strict and (v['dialogue'] or v['then']): return None,'silent_nonempty'
                return v,None
            clean=lambda s:re.sub(r'^ *["“\x27]+|["“\x27]+ *$','',s.replace('”','')).strip(' ')
            dialogue=clean(v['dialogue']); then=clean(v['then'])
            wc=lambda s:sum(bool(re.search(r'[\p{L}\p{N}]',w)) for w in s.split())
            if then and (re.match(r'^\p{Ll}',then) or wc(then)<2): then=''
            if wc(dialogue)<2: return None,'too_short'
            for text,limit in ((dialogue,110),(then,90)):
                if text:
                    error=self.beat(text,limit,c,recent)
                    if error: return None,error
            if then and similarity(dialogue,then)>=.6: return None,'duplicate_beats'
            emotion=v['emotion'] if v['emotion'] in self.c['emotions'] else self.c['policies'][c['event']][3]
            animation=v['animation'] if v['animation'] in self.c['animations'] and v['animation'] not in ('strike','sunglasses','bread_snack','visitor','nap') else self.c['policies'][c['event']][4]
            v=dict(v,dialogue=dialogue,then=then,emotion=emotion,animation=animation)
        else:
            if set(v)!={'reply','tone','tool'} or not isinstance(v['reply'],str) or js_length(v['reply'])>4000: return None,'shape'
            tool=v['tool']
            if tool is not None and (not isinstance(tool,dict) or set(tool)!={'name','args'} or not isinstance(tool['name'],str) or tool['name'] not in c['availableTools'] or not isinstance(tool['args'],dict)): return None,'tool_shape'
            reply=re.sub(r'[\x00-\x08\x0b-\x1f\x7f-\x9f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]','',EMOJI.sub('',v['reply'])).strip()
            if len(re.findall(r"[\p{L}\p{N}]+(?:['’][\p{L}]+)*",reply))<3: return None,'too_short'
            if strict and v['tone'] not in self.c['tones']: return None,'enum'
            v=dict(v,reply=reply,tone=v['tone'] if v['tone'] in self.c['tones'] else 'neutral')
        if strict:
            text=output_text(v)
            if EMOJI.search(raw): return None,'dataset_emoji'
            if self.rejected_language(text,effective_profanity(settings(row))): return None,'dataset_profanity'
            if self.personal_data(v): return None,'pii_or_unfamiliar_name'
            if not ambient:
                if action_claim(text) and not c.get('toolResult',{}).get('ok'): return None,'unverified_action'
                if v['tool']:
                    error=validate_tool(v['tool'],c,self.c)
                    if error: return None,error
                expected=row.get('expectedTool')
                if expected and (not v['tool'] or v['tool']['name']!=expected): return None,'expected_tool'
                if row.get('expectedInterval') and v['tool']['args'].get('recurrence',{}).get('intervalMinutes')!=row['expectedInterval']: return None,'wrong_interval'
                if row.get('expectedAt'):
                    try:
                        actual=datetime.fromisoformat(v['tool']['args']['at'].replace('Z','+00:00'))
                        if actual!=datetime.fromisoformat(row['expectedAt']): return None,'wrong_reminder_time'
                    except (KeyError,ValueError,TypeError): return None,'wrong_reminder_time'
                if row.get('expectedDue') and (v['tool']['args'].get('due')!=row['expectedDue'] or v['tool']['args'].get('dueTime')!=row['expectedDueTime']): return None,'wrong_task_due'
                if row.get('expectNoTool') and v['tool'] is not None: return None,'unexpected_tool'
        return v,None

def validate_tool(tool,c,contract):
    a=tool['args']; name=tool['name']
    nonempty=lambda v,maxlen=4000:isinstance(v,str) and bool(v.strip()) and len(v)<=maxlen
    iso=lambda v:isinstance(v,str) and bool(re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)',v))
    def day(v):
        try: return isinstance(v,str) and datetime.strptime(v,'%Y-%m-%d').strftime('%Y-%m-%d')==v
        except ValueError: return False
    def clock(v): return isinstance(v,str) and bool(re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d',v))
    if name=='remember':
        if not nonempty(a.get('text')) or a.get('category','other') not in contract['categories']: return 'tool_args'
        if not re.search(r'\b(remember|save|keep|store)\b',c['turns'][-1]['text'],re.I): return 'memory_without_request'
    elif name in ('forget','recall_memories','recall_conversations'):
        if not isinstance(a.get('query'),str) or (name=='forget' and not nonempty(a['query'])): return 'tool_args'
    elif name=='add_task':
        if not nonempty(a.get('title')) or a.get('priority','normal') not in ('low','normal','high'): return 'tool_args'
        if 'due' in a and not day(a['due']) or 'dueTime' in a and not clock(a['dueTime']): return 'tool_args'
        if any(k in a and (not isinstance(a[k],str) or len(a[k])>n) for k,n in (('notes',4000),('category',100))): return 'tool_args'
    elif name=='add_reminder':
        if not nonempty(a.get('text')) or not iso(a.get('at')): return 'tool_args'
        try:
            at=datetime.fromisoformat(a['at'].replace('Z','+00:00')); now=datetime.fromisoformat(c['localDateTime'])
            if at<=now: return 'reminder_past'
        except ValueError: return 'tool_args'
        r=a.get('recurrence')
        if r is not None:
            if not isinstance(r,dict): return 'tool_args'
            kind=r.get('kind'); integer=lambda x:type(x) is int
            valid=(kind=='daily' or kind=='weekly' and isinstance(r.get('weekdays'),list) and 1<=len(r['weekdays'])<=7 and all(integer(x) and 0<=x<=6 for x in r['weekdays']) or kind=='monthly' and integer(r.get('dayOfMonth')) and 1<=r['dayOfMonth']<=31 or kind=='custom' and integer(r.get('intervalDays')) and 1<=r['intervalDays']<=3650 or kind=='interval' and integer(r.get('intervalMinutes')) and 5<=r['intervalMinutes']<=2**53-1 and now.timestamp()*1000+r['intervalMinutes']*60000<=8640000000000000)
            if not valid: return 'tool_args'
            if kind=='interval' and 'window' in r:
                w=r['window']
                if not isinstance(w,dict) or not clock(w.get('start')) or not clock(w.get('end')) or w['start']>=w['end']: return 'tool_args'
    else:
        # Dataset only trains audited tool argument contracts, never blindly accepts arbitrary tools.
        return 'unaudited_tool'
    return None

def output_text(v): return (v['dialogue']+' '+v['then']).strip() if 'dialogue' in v else v['reply']
def beats(v): return [s for s in (v.get('dialogue'),v.get('then'),v.get('reply')) if s]

class DuplicateIndex:
    """Exact Jaccard >= threshold, using an inverted word index (no approximate misses)."""
    def __init__(self,threshold=.6): self.threshold=threshold; self.tokens=[]; self.index=defaultdict(set)
    def duplicate(self,text):
        tokens=words(text); candidates=set()
        for word in tokens: candidates.update(self.index[word])
        if not tokens: return any(not t for t in self.tokens)
        for i in candidates:
            other=self.tokens[i]
            if min(len(tokens),len(other))/max(len(tokens),len(other))>=self.threshold and len(tokens&other)/len(tokens|other)>=self.threshold: return True
        return False
    def add(self,text):
        tokens=words(text); i=len(self.tokens); self.tokens.append(tokens)
        for word in tokens: self.index[word].add(i)
