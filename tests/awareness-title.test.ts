import { describe, expect, it } from 'vitest';
import { sanitizeTitle, TitleActivity } from '../src/core/awareness/title';
import { awarenessScript } from '../src/main/platform/awareness-script';
import { DEFAULT_SETTINGS, isSettingsPatch, parseSettings } from '../src/shared/schemas/settings';
import { TALK_CADENCE, ambientDelay } from '../src/core/dialogue/cadence';
import { DialogueDirector } from '../src/core/dialogue';
import { observationLeaks } from '../src/core/awareness/vision';
import { validateResponse } from '../src/ai/response-validation';
const browser = { name: 'Chrome', category: 'browser' as const };

describe('title privacy boundary', () => {
  it('defaults both permissions off and strictly validates settings', () => {
    expect(DEFAULT_SETTINGS.titleAwareness).toBe(false); expect(DEFAULT_SETTINGS.screenAwareness).toBe(false);
    expect(parseSettings({ titleAwareness: 'yes', screenAwareness: 1 }).screenAwareness).toBe(false);
    expect(isSettingsPatch({ titleAwareness: true, screenAwareness: true, visionModel: 'gemma3:4b', talkativeness: 'unhinged' })).toBe(true);
    expect(isSettingsPatch({ excludedApps: ['secret-editor.exe'] })).toBe(true);
    expect(isSettingsPatch({ excludedApps: ['evil";.exe'] })).toBe(false);
    expect(parseSettings({ safeTitle: 'NEVER PERSIST', screenDescription: 'NEVER PERSIST', screenshot: 'NEVER PERSIST' })).toEqual(DEFAULT_SETTINGS);
  });
  it.each(['Gmail', 'G\u200bmail', 'WhatsApp Web', 'Telegram', 'Slack', 'Discord', 'Bank of somewhere', 'online banking', 'PayPal', 'Bitwarden', 'Sign in', 'Incognito', 'Private Browsing', 'Inbox - Outlook', 'Google Mail'])('skips private browser title %s', title => {
    expect(sanitizeTitle(title, browser)).toEqual({ private: true });
  });
  it.each(['YouTube', 'LinkedIn', 'Twitter', 'Reddit', 'GitHub', 'Figma', 'Google Docs', 'Google Sheets', 'Google Slides', 'Netflix', 'ChatGPT', 'Claude'])('recognizes public site %s', title => {
    expect(sanitizeTitle(`Landing page – ${title}`, browser)).toMatchObject({ private: false, summary: expect.stringContaining(title === 'Twitter' ? 'X:' : title) });
  });
  it('drops emails, query strings, digit runs, tokens and control characters before bounding the summary', () => {
    for (const raw of ['a.person@example.com lofi beats - YouTube', 'https://github.com/repo?secret=unsafe#fragment', 'Figma 123456789', 'Figma sk-secretvalue0123456789', 'Figma eyJabcdefghijklm0123456789ABCDE', 'Figma\u0001\u202ehome']) {
      const result = sanitizeTitle(raw, browser);
      expect(result.private).toBe(false); expect(result.summary!.length).toBeLessThanOrEqual(60);
      expect(result.summary).not.toMatch(/@|secret|unsafe|\d{4}|eyJ|\p{Cc}|\p{Cf}/u);
    }
  });
  it('reads titles only after self, private and user exclusions, and never installs title APIs in level one', () => {
    expect(awarenessScript(1, [])).not.toContain('GetWindowText');
    expect(awarenessScript(1, [], false, true, true)).not.toContain('GetWindowText');
    const script = awarenessScript(1, [2], true, true, false, ['secret-editor.exe']);
    const read = script.indexOf('      GetWindowTextW(hwnd');
    expect(read).toBeGreaterThan(script.indexOf('return "self" + suffix'));
    expect(read).toBeGreaterThan(script.indexOf('return "private" + suffix'));
    expect(read).toBeGreaterThan(script.indexOf('secret-editor.exe'));
    expect(script).toContain('new StringBuilder(201)'); expect(script).toContain('GetWindowTextW(hwnd, titleBuffer, 201)');
    expect(script).toContain('\\p{Cc}'); expect(script).toContain('gmail');
    const guard = awarenessScript(1, [], true, false, true);
    expect(guard).toContain('GetWindowTextW'); expect(guard).not.toContain('Convert.ToBase64String(Encoding.UTF8.GetBytes(title))');
    expect(guard).toContain('return exe + suffix + "|" + "";');
  });
  it('tracks title switches, app returns and 10/25/45 minute thresholds only in RAM', () => {
    let now = 0; const activity = new TitleActivity(() => now);
    activity.observe(browser, 'page');
    for (const minute of [10, 25, 45]) {
      now = minute * 60000; expect(activity.observe(browser, 'page').events.map(e => e.situation)).toEqual(['title_long']);
      expect(activity.observe(browser, 'page').events).toEqual([]);
    }
    for (let n = 0; n < 4; n++) { now += 5000; activity.observe(browser, `page ${n}`); }
    expect(activity.observe(browser, 'another').events[0].situation).toBe('title_switch');
    activity.observe({ name: 'Figma', category: 'design' }, 'canvas'); now += 3000;
    expect(activity.observe(browser, 'page').events.some(e => e.situation === 'app_return')).toBe(true);
    now += 120001; activity.observe({ name: 'Figma', category: 'design' }, 'canvas'); now += 120001;
    expect(activity.observe(browser, 'page').events).toEqual([]);
    activity.observe(null); expect(activity.summary).toBeUndefined(); expect(JSON.stringify(activity)).not.toContain('page');
  });
});

describe('cadence and observation output', () => {
  it.each(['quiet', 'normal', 'chatty', 'unhinged'] as const)('%s stays in its thought range and shares an app gate across categories', talk => {
    const range = TALK_CADENCE[talk].thoughts;
    for (const scale of [.1, .7, 1, 3]) for (const random of [0, .5, 1]) {
      expect(ambientDelay(talk, scale, () => random)).toBeGreaterThanOrEqual(range[0]);
      expect(ambientDelay(talk, scale, () => random)).toBeLessThanOrEqual(range[1]);
    }
    let now = 0; const director = new DialogueDirector(() => 0, () => now);
    expect(director.decide('app_code', { talkativeness: talk })).not.toBeNull();
    now = TALK_CADENCE[talk].app - 1;
    expect(director.decide('app_design', { talkativeness: talk })).toBeNull();
    expect(director.observeScreen(() => true, talk)).toBe(false);
    now++; expect(director.decide('app_design', { talkativeness: talk })).not.toBeNull();
  });
  it.each(['Alice is doing great.', 'Tell Jane hello.', 'That has 1234 pixels.', 'The number is ９９.', 'Mail alice@example.com.'])('rejects sensitive observation output %s', text => {
    const source = 'A layout by Alice and Jane, showing 1234 and alice@example.com.';
    expect(observationLeaks(text, source)).toBe(true);
    expect(validateResponse(JSON.stringify({ shouldSpeak: true, dialogue: text, then: '', emotion: 'curious', animation: 'idle' }),
      { event: 'screen_comment', localTime: '12:00', screenDescription: source }, []).kind).toBe('invalid');
  });
  it('allows a grounded topic/layout comment and never invents a visual fallback', () => {
    expect(observationLeaks('That layout could use a tiny duck.', 'A page layout with a large headline.')).toBe(false);
    expect(new DialogueDirector(() => 0).decide('screen_comment')).toBeNull();
  });
});
