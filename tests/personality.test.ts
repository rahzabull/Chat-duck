import { describe, expect, it } from 'vitest';
import { DialogueDirector, eligibleLine, fillTemplate, type Situation } from '../src/core/dialogue';
import { PRESETS, type PresetId } from '../src/core/dialogue/presets';
import { LINES } from '../src/core/dialogue/lines';
import { buildContext, buildPrompt } from '../src/ai/prompts';
import { rejectedLanguage, validateResponse } from '../src/ai/response-validation';
import { DEFAULT_SETTINGS, isSettingsPatch, parseSettings } from '../src/shared/schemas/settings';
const seeded = (seed: number) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
describe('personality voices', () => {
  it('produces mostly different spoken lines for the same seeded event sequence', () => {
    const events: Situation[] = ['hover', 'click', 'pickup', 'drop_big', 'thought', 'hover_linger', 'click_angry', 'drag_long', 'wake_long', 'app_browser'];
    const sequences = Object.keys(PRESETS).map(personality => {
      let now = 0; const d = new DialogueDirector(seeded(91), () => now);
      return Array.from({ length: 500 }, (_, i) => { now += 3600000; return d.decide(events[i % events.length], { personality: personality as PresetId })?.text; });
    });
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      const pairs = sequences[a].map((line, i) => [line, sequences[b][i]]).filter(([a, b]) => a && b);
      expect(pairs.length).toBeGreaterThan(150);
      expect(pairs.filter(([a, b]) => a !== b).length / pairs.length).toBeGreaterThan(.65);
    }
  });
  it('uses overlays about 75% and enabled profane pools about 30% when all pools are fresh', () => {
    let overlays = 0, profane = 0; const random = seeded(987);
    for (let i = 0; i < 4000; i++) {
      const a = new DialogueDirector(random, () => 0).decide('click_angry', { personality: 'playful' });
      if (PRESETS.playful.lines.click_angry!.some(l => l.text === a?.text)) overlays++;
      const b = new DialogueDirector(random, () => 0).decide('click_angry', { personality: 'unhinged', profanity: true });
      if (PRESETS.unhinged.profane!.click_angry!.some(l => l.text === b?.text)) profane++;
    }
    expect(overlays / 4000).toBeGreaterThan(.72); expect(overlays / 4000).toBeLessThan(.78);
    expect(profane / 4000).toBeGreaterThan(.27); expect(profane / 4000).toBeLessThan(.33);
  });
  it('keeps recent exclusion across presets and base/profane pools', () => {
    let now = 0; const d = new DialogueDirector(seeded(431), () => now), recent: string[] = [];
    for (let i = 0; i < 300; i++) {
      now += 3600000;
      const line = d.decide(i % 2 ? 'click_angry' : 'thought', { personality: Object.keys(PRESETS)[i % 4] as PresetId, profanity: i % 3 === 0 });
      if (line) { expect(recent.slice(-12)).not.toContain(line.text); recent.push(line.text); }
    }
  });
  it('filters guilt and directed swearing without modifying authored presets', () => {
    expect(eligibleLine(PRESETS.wholesome.lines.wake_long![0])).toBe(false);
    expect(eligibleLine(PRESETS.unhinged.profane!.drag_shaken![0])).toBe(false);
    expect(PRESETS.wholesome.lines.wake_long![0].text).toContain('missed you');
    expect(new DialogueDirector(() => 0, () => 0).decide('event_strike')?.text).toBe(LINES.event_strike[0].text);
  });
  it('validates settings, protects internal mood/seed and sanitizes names', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ personality: 'sarcastic', profanity: false, activityLevel: 'normal', memoryEnabled: true });
    expect(isSettingsPatch({ personality: 'wholesome', profanity: true, activityLevel: 'calm' })).toBe(true);
    for (const patch of [{ personality: 'evil' }, { activityLevel: 'wild' }, { profanity: 1 }, { preferredName: 'a'.repeat(31) }, { installSeed: 42 }, { dailyMood: null }]) expect(isSettingsPatch(patch)).toBe(false);
    expect(parseSettings({ preferredName: '<Alex>\n{}', personality: 'wrong' })).toMatchObject({ preferredName: 'Alex', personality: 'sarcastic' });
    expect(fillTemplate('Hello {name}, {count}.', { name: '<Alex>', count: 7 }, 0)).toBe('Hello Alex, 7.');
  });
});
describe('personality AI boundaries', () => {
  it.each(Object.keys(PRESETS) as PresetId[])('uses %s style and examples', personality => {
    const request = buildPrompt('m', buildContext('thought', { personality, profanity: true, mood: 'grumpy', emotions: ['irritated', 'sleepy', 'secret'] }), [], seeded(5));
    expect(request.messages[0].content).toContain(PRESETS[personality].promptStyle);
    expect(request.messages[0].content).toContain('Mild swearing allowed, never at the user, never slurs');
    const examples = JSON.parse(request.messages[1].content.split('EXAMPLES OF HIS VOICE, DO NOT COPY\n')[1].split('\nRECENT')[0]) as { dialogue: string }[];
    expect(examples.every(e => (PRESETS[personality].lines.thought ?? LINES.thought).some(l => l.text === e.dialogue))).toBe(true);
    expect(request.messages[1].content).not.toContain('secret');
    expect(buildPrompt('m', buildContext('thought', { personality }), []).messages[0].content).toContain('No swearing');
  });
  it('only includes bounded name and one memory fact when enabled', () => {
    const context = { name: '<Alex>\n', memoryFact: '7 days together<script>', memoryEnabled: false };
    expect(buildContext('thought', context)).not.toHaveProperty('name');
    expect(buildContext('thought', context)).not.toHaveProperty('memoryFact');
    expect(buildContext('thought', { ...context, memoryEnabled: true })).toMatchObject({ name: 'Alex', memoryFact: '7 days togetherscript' });
  });
  it.each(['Damn!', 'Well that is shit.', 'What the hell.', 'Oh crap.', 'Bloody gravity.', 'For f\u2014 sake.'])('allows exact mild swearing only when enabled: %s', line => {
    expect(rejectedLanguage(line, true)).toBe(false); expect(rejectedLanguage(line, false)).toBe(true);
  });
  it.each(['fuck', 'bullshit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'piss', 'wtf', 'stfu', 'shithead', 'damned', 'faggot', 'nigger', 'retard', 'f\u200buck', 'sh!thead', 'You are shit.'])('rejects strong/slur/targeted language in either mode: %s', line => {
    expect(rejectedLanguage(line, true)).toBe(true); expect(rejectedLanguage(line, false)).toBe(true);
  });
  it('rejects guilt and prevents models from creating rare events or naps', () => {
    const raw = (dialogue: string) => JSON.stringify({ shouldSpeak: true, dialogue, then: '', emotion: 'happy', animation: 'visitor' });
    const context = buildContext('thought', { profanity: true });
    expect(validateResponse(raw('I missed you.'), context, []).kind).toBe('invalid');
    const result = validateResponse(raw('Gravity has terrible manners.'), context, []);
    expect(result.kind === 'speech' && result.speech.animation).toBe('idle');
  });
});
