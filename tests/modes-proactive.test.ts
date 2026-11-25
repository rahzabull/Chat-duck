import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dndActive, ModeResolver, quietHours, resolveMode } from '../src/core/modes';
import { ProactiveScheduler, PROACTIVE_IDS, type ProactiveId, type ProactiveInput } from '../src/core/proactive';
import { DEFAULT_SETTINGS, isSettingsPatch, parseSettings } from '../src/shared/schemas/settings';
import { DialogueDirector, fillTemplate } from '../src/core/dialogue';
import { LINES } from '../src/core/dialogue/lines';
import { SpeechQueue } from '../src/core/interruptions';
import { parseIntent } from '../src/core/conversation/intents';
import { SKILL_PACKS, SKILL_PACK_IDS } from '../src/core/skills';
import { conversationPrompt } from '../src/main/conversation/engine';
import { ToolRegistry } from '../src/main/tools';
import { PRESETS } from '../src/core/dialogue/presets';
import { buildContext } from '../src/ai/prompts';
import { validateResponse } from '../src/ai/response-validation';

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 25, 9)); });
afterEach(() => vi.useRealTimers());
const task = (due: string, dueTime?: string) => ({ id: 't1', title: 'Presentation', due, dueTime, done: false, priority: 'normal' as const, subtasks: [], createdAt: '2026-11-25T08:00:00Z', updatedAt: '2026-11-25T08:00:00Z' });
function scenario(id: ProactiveId): ProactiveInput {
  const input: ProactiveInput = { settings: { ...DEFAULT_SETTINGS, proactiveHistory: {}, morningBriefing: id === 'briefing_morning', eveningSummary: id === 'summary_evening', deadlineNudges: ['deadline_nudge', 'overdue_nudge'].includes(id), appAwareness: true }, mode: 'companion', fullscreen: false, active: true, tasks: [], reminders: [] };
  if (id === 'summary_evening') { vi.setSystemTime(new Date(2026, 10, 25, 19)); input.tasks = [{ ...task('2026-11-25'), done: true, doneAt: new Date().toISOString() }, { ...task('2026-11-26'), id: 't2' }]; }
  if (id === 'deadline_nudge') input.tasks = [task('2026-11-25', '11:00')];
  if (id === 'overdue_nudge') input.tasks = [task('2026-11-24')];
  if (id.startsWith('assist_offer_')) { input.app = { name: 'Allowed app', category: id.endsWith('design') ? 'design' : id.endsWith('writing') ? 'office' : 'code' }; input.appMinutes = 45; }
  return input;
}
function scheduler(id: ProactiveId, roll = 0) {
  const value = new ProactiveScheduler({}, Date.now, () => roll);
  if (id === 'gaming_back') value.returnedFromGaming();
  return value;
}
describe('mode arbitration and clocks', () => {
  it('resolves the full priority chain without discarding underlying states', () => {
    const input = { privacy: true, dnd: true, gaming: true, focus: true, conversation: true };
    expect(resolveMode(input)).toBe('privacy'); input.privacy = false;
    expect(resolveMode(input)).toBe('do_not_disturb'); input.dnd = false;
    expect(resolveMode(input)).toBe('gaming'); input.gaming = false;
    expect(resolveMode(input)).toBe('focus'); input.focus = false;
    expect(resolveMode(input)).toBe('conversation'); input.conversation = false;
    expect(resolveMode(input)).toBe('companion');
  });
  it('requires ten continuous fullscreen seconds and five continuous exit seconds', () => {
    const modes = new ModeResolver();
    expect(modes.observe(true, 0)).toBe(false); expect(modes.observe(true, 9999)).toBe(false);
    modes.observe(false, 10000); expect(modes.observe(true, 12000)).toBe(false);
    expect(modes.observe(true, 22000)).toBe(true); expect(modes.observe(false, 23000)).toBe(true);
    expect(modes.observe(false, 27999)).toBe(true); modes.observe(true, 28000);
    expect(modes.observe(false, 30000)).toBe(true); expect(modes.observe(false, 35000)).toBe(false);
  });
  it('expires timed DND, keeps indefinite DND, and parses local mode commands', () => {
    const s = { ...DEFAULT_SETTINGS, dndUntil: Date.now() + 3600000 };
    expect(dndActive(s)).toBe(true); vi.advanceTimersByTime(3600000); expect(dndActive(s)).toBe(false);
    expect(dndActive({ dndUntil: -1 })).toBe(true);
    expect(parseIntent("don't disturb me for an hour")).toEqual({ kind: 'dnd', minutes: 60, enabled: true });
    expect(parseIntent('do not disturb for 30 minutes')).toEqual({ kind: 'dnd', minutes: 30, enabled: true });
    expect(parseIntent('privacy mode')).toEqual({ kind: 'privacy', enabled: true });
    expect(parseIntent('turn off privacy mode')).toEqual({ kind: 'privacy', enabled: false });
  });
  it('handles overnight and daytime quiet windows with exact boundaries', () => {
    const s = { ...DEFAULT_SETTINGS, quietHoursEnabled: true };
    for (const [hour, minute, quiet] of [[22, 59, false], [23, 0, true], [7, 59, true], [8, 0, false]] as const) {
      vi.setSystemTime(new Date(2026, 10, 25, hour, minute)); expect(quietHours(s)).toBe(quiet);
    }
    s.quietHoursStart = '09:00'; s.quietHoursEnd = '17:00'; vi.setSystemTime(new Date(2026, 10, 25, 12)); expect(quietHours(s)).toBe(true);
  });
});
describe.each(PROACTIVE_IDS)('%s fake-clock candidate', id => {
  it('fires once, then respects its cooldown', () => {
    const input = scenario(id), engine = scheduler(id), offer = vi.fn(() => true);
    expect(engine.evaluate(input, offer)?.id).toBe(id);
    vi.advanceTimersByTime(2000); expect(engine.evaluate(input, offer)).toBeUndefined();
    expect(offer).toHaveBeenCalledOnce();
  });
  it.each(['do_not_disturb', 'gaming', 'focus', 'conversation'] as const)('respects %s without consuming delivery', mode => {
    const input = scenario(id), engine = scheduler(id), offer = vi.fn(() => true);
    expect(engine.evaluate({ ...input, mode }, offer)).toBeUndefined(); expect(offer).not.toHaveBeenCalled();
    expect(engine.evaluate(input, offer)?.id).toBe(id);
  });
  it('respects quiet hours, mute, inactivity and fullscreen even in privacy mode', () => {
    const input = scenario(id), engine = scheduler(id), offer = vi.fn(() => true);
    for (const patch of [{ fullscreen: true }, { active: false }, { settings: { ...input.settings, mute: true } }, { settings: { ...input.settings, quietHoursEnabled: true, quietHoursStart: '00:00', quietHoursEnd: '00:00' } }, { mode: 'privacy' as const, settings: { ...input.settings, dndUntil: -1 } }]) expect(engine.evaluate({ ...input, ...patch }, offer)).toBeUndefined();
    expect(offer).not.toHaveBeenCalled();
  });
  it('can choose silence and does not reroll on every tick', () => {
    const input = scenario(id), roll = vi.fn(() => .999), offer = vi.fn(() => true);
    const engine = new ProactiveScheduler({}, Date.now, roll); if (id === 'gaming_back') engine.returnedFromGaming();
    expect(engine.evaluate(input, offer)).toBeUndefined(); vi.advanceTimersByTime(2000); engine.evaluate(input, offer);
    expect(roll).toHaveBeenCalledOnce(); expect(offer).not.toHaveBeenCalled();
  });
  it('requires the director and interruption queue to accept a line', () => {
    const input = scenario(id), engine = scheduler(id), director = new DialogueDirector(() => 0), queue = new SpeechQueue();
    const offer = () => !!director.decide(id, {}, line => queue.offer(line.text, line.priority, { muted: true, blocked: false, cooldownMs: 10000 }));
    expect(engine.evaluate(input, offer)).toBeUndefined();
    vi.advanceTimersByTime(2000); expect(engine.evaluate(input, () => true)).toBeUndefined();
  });
});
describe('proactive facts, consent and persistence', () => {
  it('uses real morning counts and first future reminder, and persists once-per-day across restarts', () => {
    const input = scenario('briefing_morning'); input.tasks = [task('2026-11-25'), { ...task('2026-11-24'), id: 'old' }];
    input.reminders = [{ id: 'r', text: 'Call', at: new Date(2026, 10, 25, 10).toISOString(), state: 'scheduled', timezone: 'Asia/Calcutta', createdAt: new Date().toISOString() }];
    const saved = vi.fn(); const engine = new ProactiveScheduler({}, Date.now, () => 0, saved);
    const candidate = engine.evaluate(input, () => true)!;
    expect(candidate.context).toEqual({ count: 1, overdue: 1, reminder: '10:00' }); expect(candidate.detail).toContain('10:00');
    const restored = new ProactiveScheduler(saved.mock.calls[0][0], Date.now, () => 0);
    expect(restored.evaluate(input, () => true)).toBeUndefined();
    vi.advanceTimersByTime(86400000); expect(restored.evaluate(input, () => true)?.id).toBe('briefing_morning');
    expect(JSON.stringify(saved.mock.calls[0])).not.toContain('Presentation');
  });
  it('counts completions today separately from pending work', () => {
    const input = scenario('summary_evening'); const result = scheduler('summary_evening').evaluate(input, () => true)!;
    expect(result.context).toEqual({ count: 1, remaining: 1 });
  });
  it('only offers deadlines for tomorrow or within three hours, once per due date', () => {
    const input = scenario('deadline_nudge'), saved = vi.fn(), engine = new ProactiveScheduler({}, Date.now, () => 0, saved);
    input.tasks = [task('2026-11-27')]; expect(engine.evaluate(input, () => true)).toBeUndefined();
    input.tasks = [task('2026-11-26')]; expect(engine.evaluate(input, () => true)?.context.deadline).toBe('tomorrow');
    const restored = new ProactiveScheduler(saved.mock.calls[0][0], Date.now, () => 0);
    expect(restored.evaluate(input, () => true)).toBeUndefined();
    input.tasks = [task('2026-11-25', '11:00')]; expect(restored.evaluate(input, () => true)?.context.deadline).toBe('within 3 hours');
    input.tasks[0].done = true; expect(new ProactiveScheduler({}, Date.now, () => 0).evaluate(input, () => true)).toBeUndefined();
  });
  it('requires permission, 45 minutes and a matching pack; No backs off three hours for the app', () => {
    const input = scenario('assist_offer_design'), engine = scheduler('assist_offer_design');
    for (const patch of [{ appMinutes: 44 }, { settings: { ...input.settings, appAwareness: false } }, { settings: { ...input.settings, privacyMode: true } }, { settings: { ...input.settings, skillPack: 'developer' as const } }]) expect(engine.evaluate({ ...input, ...patch }, () => true)).toBeUndefined();
    const candidate = engine.evaluate(input, () => true)!; vi.advanceTimersByTime(60000); engine.decline(candidate);
    vi.advanceTimersByTime(3 * 3600000 - 1); expect(engine.evaluate(input, () => true)).toBeUndefined();
    vi.advanceTimersByTime(1); expect(engine.evaluate(input, () => true)?.id).toBe('assist_offer_design');
  });
  it('all candidate pools have four or more authored lines and fill real facts', () => {
    for (const id of [...PROACTIVE_IDS, 'privacy_on', 'dnd_on'] as const) expect(LINES[id].length).toBeGreaterThanOrEqual(4);
    expect(fillTemplate(LINES.summary_evening[0].text, { count: 7, remaining: 3 }, Date.now())).toContain('7 tasks');
    const context = buildContext('briefing_morning', { count: 4, overdue: 2, remaining: 3, reminder: '10:00' });
    const raw = (text: string) => JSON.stringify({ shouldSpeak: true, dialogue: text, then: '', emotion: 'happy', animation: 'idle' });
    expect(validateResponse(raw('You have 4 tasks today.'), context, []).kind).toBe('speech');
    expect(validateResponse(raw('You have 9 tasks today.'), context, []).kind).toBe('invalid');
  });
});
describe('skill pack and settings boundaries', () => {
  it('includes each pack independently of every personality', () => {
    for (const skillPack of SKILL_PACK_IDS) for (const personality of Object.keys(PRESETS) as Array<keyof typeof PRESETS>) {
      const prompt = conversationPrompt({ settings: { ...DEFAULT_SETTINGS, skillPack, personality }, turns: [], memories: [], summaries: [], now: Date.now() }, new ToolRegistry([]));
      expect(prompt).toContain(SKILL_PACKS[skillPack].prompt); expect(prompt).toContain(PRESETS[personality].promptStyle);
    }
  });
  it('migrates old settings and rejects malformed settings/forged delivery markers', () => {
    expect(parseSettings({ personality: 'unhinged' }).skillPack).toBe('companion');
    expect(isSettingsPatch({ quietHoursStart: '25:00' })).toBe(false); expect(isSettingsPatch({ skillPack: 'hacker' })).toBe(false);
    expect(isSettingsPatch({ proactiveHistory: {} })).toBe(false); expect(isSettingsPatch({ dndUntil: -2 })).toBe(false);
    expect(isSettingsPatch({ dndUntil: -1, skillPack: 'creative', privacyMode: true })).toBe(true);
  });
});


describe('calendar and opt-out edges', () => {
  it('keeps date-only tasks current through the last minute of their local day', () => {
    const input = scenario('overdue_nudge'); input.tasks = [task('2026-11-25')];
    vi.setSystemTime(new Date(2026, 10, 25, 23, 59, 59));
    const engine = new ProactiveScheduler({}, Date.now, () => 0);
    expect(engine.evaluate(input, () => true)?.id).toBe('deadline_nudge');
    vi.setSystemTime(new Date(2026, 10, 26)); expect(engine.evaluate(input, () => true)?.context.count).toBe(1);
  });
  it('honors each feature switch and morning/evening time window', () => {
    for (const id of PROACTIVE_IDS.filter(id => id !== 'gaming_back')) {
      const input = scenario(id); input.settings.morningBriefing = false; input.settings.eveningSummary = false;
      input.settings.deadlineNudges = false; input.settings.assistanceOffers = false;
      expect(scheduler(id).evaluate(input, () => true)).toBeUndefined();
    }
    const morning = scenario('briefing_morning'); morning.settings.briefingStart = '07:00'; morning.settings.briefingEnd = '10:00';
    for (const hour of [4, 6, 10, 14]) { vi.setSystemTime(new Date(2026, 10, 25, hour)); expect(scheduler('briefing_morning').evaluate(morning, () => true)).toBeUndefined(); }
    const evening = scenario('summary_evening'); vi.setSystemTime(new Date(2026, 10, 25, 17, 59)); expect(scheduler('summary_evening').evaluate(evening, () => true)).toBeUndefined();
  });
  it.each(['summary_evening', 'overdue_nudge'] as const)('allows %s again the next day, but not later the same day', id => {
    const input = scenario(id), saved = vi.fn(); const engine = new ProactiveScheduler({}, Date.now, () => 0, saved);
    expect(engine.evaluate(input, () => true)?.id).toBe(id); vi.advanceTimersByTime(3600000);
    expect(engine.evaluate(input, () => true)).toBeUndefined(); vi.advanceTimersByTime(23 * 3600000);
    expect(engine.evaluate(input, () => true)?.id).toBe(id); expect(saved).toHaveBeenCalledTimes(2);
  });
});
