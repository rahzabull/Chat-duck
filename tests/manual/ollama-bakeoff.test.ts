import { it } from 'vitest';
import { OllamaProvider } from '../../src/ai/ollama';
import { buildPrompt, type AIContext } from '../../src/ai/prompts';
import { validateResponse } from '../../src/ai/response-validation';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const cases: AIContext[] = [
  { event: 'thought', localTime: '14:20' }, { event: 'thought', localTime: '14:25' }, { event: 'thought', localTime: '14:30' },
  { event: 'thought_late', localTime: '01:40' }, { event: 'wake_long', localTime: '09:10', minutes: 130 },
  { event: 'hover_linger', localTime: '15:00' }, { event: 'drag_long', localTime: '15:00' },
  { event: 'app_browser', localTime: '22:10', app: 'Chrome' }, { event: 'app_browser_long', localTime: '23:40', app: 'Chrome', minutes: 47 },
  { event: 'app_design', localTime: '11:00', app: 'Figma' }, { event: 'app_code_long', localTime: '16:00', app: 'VS Code', minutes: 60 },
  { event: 'app_3d', localTime: '20:00', app: 'Blender' }, { event: 'app_switching', localTime: '12:00' }, { event: 'late_night_working', localTime: '02:15', app: 'Photoshop' },
];
it.skipIf(process.env.DUCKY_OLLAMA_BAKEOFF !== '1')('bakeoff', async () => {
  let out = '';
  for (const model of ['gemma3:4b', 'qwen3:8b']) {
    const p = new OllamaProvider(11434); const recent: string[] = [];
    let ok = 0, bad = 0, ms = 0; out += `\n=== ${model}\n`;
    for (let round = 0; round < 2; round++) for (const c of cases) {
      const req = buildPrompt(model, c, recent); const t = Date.now();
      let raw = ''; try { raw = await p.generate(req, AbortSignal.timeout(60000)); } catch (e) { raw = 'ERR ' + e; }
      const dt = Date.now() - t; if (round || c !== cases[0]) ms += dt;
      const v = validateResponse(typeof raw === 'string' ? raw : JSON.stringify(raw), c, recent);
      if (v.kind === 'speech') { ok++; recent.push(v.speech.text); if (v.speech.then) recent.push(v.speech.then); out += `OK  ${dt}ms [${c.event}] ${v.speech.text}${v.speech.then ? ' || ' + v.speech.then : ''}\n`; }
      else { bad++; out += `${v.kind.toUpperCase()} ${dt}ms [${c.event}] ${String(typeof raw === 'string' ? raw : JSON.stringify(raw)).slice(0, 160)}\n`; }
    }
    out += `valid ${ok}/${ok + bad}, avg warm ${Math.round(ms / (ok + bad - 1))}ms\n`;
  }
  const output = process.env.DUCKY_OLLAMA_BAKEOFF_OUTPUT || join(tmpdir(), `ducky-ollama-bakeoff-${Date.now()}.txt`);
  writeFileSync(output, out);
  console.log(`Ollama bake-off results: ${output}`);
}, 600000);
