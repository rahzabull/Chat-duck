// Read-only extraction of literal application constants. Never starts Electron.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
if (process.argv.includes('--help')) {
  console.log('node scripts/extract_app.cjs APP_REPO\nPrint a source-hashed contract snapshot to stdout.');
  process.exit(0);
}
const root = path.resolve(process.argv[2]);
const {stripTypeScriptTypes} = require('node:module');
const hashes = {}, sources = {}, scope = {};
function read(file) {
  const s = fs.readFileSync(path.join(root, file), 'utf8');
  sources[file] = s; hashes[file] = crypto.createHash('sha256').update(s).digest('hex');
  return s;
}
function constant(file, name) {
  const source = stripTypeScriptTypes(read(file), {mode:'transform'});
  const match = source.match(new RegExp('(?:export\\s+)?const\\s+'+name+'\\s*=\\s*([\\s\\S]*?);(?:\\r?\\n|$)'));
  if (!match) throw Error(`Missing ${name} in ${file}`);
  const js = `globalThis.result = (${match[1]});`;
  const context = {...scope}; vm.runInNewContext(js, context, {timeout: 2000});
  scope[name] = context.result; return context.result;
}
const lines = constant('src/core/dialogue/lines.ts', 'LINES');
const talk = constant('src/core/dialogue/lines.ts', 'TALK_LINES');
const presets = constant('src/core/dialogue/presets.ts', 'PRESETS');
const animations = constant('src/animation/adapter/index.ts', 'ANIMATION_IDS');
const emotions = constant('src/animation/adapter/index.ts', 'EMOTION_IDS');
const moods = constant('src/core/emotions/index.ts', 'MOODS');
const policies = constant('src/core/dialogue/index.ts', 'POLICIES');
const skills = constant('src/core/skills/index.ts', 'SKILL_PACKS');
const tones = constant('src/core/conversation/types.ts', 'TONES');
const categories = constant('src/core/conversation/types.ts', 'CATEGORIES');
const system = constant('src/ai/prompts/index.ts', 'SYSTEM_PROMPT');
const schema = constant('src/ai/ollama/index.ts', 'RESPONSE_SCHEMA');
const bakeoff = constant('tests/manual/ollama-bakeoff.test.ts', 'cases');
const safety = read('src/core/content-safety/index.ts');
const vision = read('src/core/awareness/vision.ts');
const validator = read('src/ai/response-validation/index.ts');
const conversation = read('src/main/conversation/engine.ts');
read('src/core/conversation/validation.ts'); read('src/core/conversation/output.ts');
read('src/core/conversation/intents.ts'); read('src/main/conversation/store.ts');
const controller = read('src/main/conversation/controller.ts');
const productivity = read('src/main/productivity/service.ts');
read('src/core/productivity/validation.ts'); read('src/main/tools/index.ts');
const brief = read('docs/product-brief.md');
const voice = brief.slice(brief.indexOf('# 3.'), brief.indexOf('# 4.'));
const lineGuide = sources['src/core/dialogue/lines.ts'].split('*/')[0].slice(3);
const toolDescriptions = {};
for (const m of controller.matchAll(/name: '([^']+)', description: '([^']+)', permission: '([^']+)'/g)) toolDescriptions[m[1]] = `${m[1]}: ${m[2]} [${m[3]}]`;
for (const m of productivity.matchAll(/tool\('([^']+)', '([^']+)'/g)) toolDescriptions[m[1]] = `${m[1]}: ${m[2]} [${/confirm/.test(m[2])?'confirm':'safe'}]`;
for (const n of ['pause', 'resume', 'stop', 'status']) {const name=n === 'status' ? 'focus_status' : n+'_focus';toolDescriptions[name] = `${name}: ${n} focus timer [safe]`;}
if (Object.keys(lines).some(k => !policies[k])) throw Error('Situation/policy mismatch');
console.log(JSON.stringify({version:1, hashes, lines, talk, presets, animations, emotions, moods, policies, skills, tones, categories, system, schema, bakeoff, safety, vision, validator, conversation, voice, lineGuide, toolDescriptions}, null, 2));
