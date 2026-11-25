import { describe, expect, it } from 'vitest';
import { AppSessionTracker, mapExe, parseForegroundLine } from '../src/core/awareness';

describe('foreground parsing and privacy', () => {
  it('accepts one bounded exe/flag record, rejects garbage and never accepts paths or titles', () => {
    expect(parseForegroundLine('chrome.exe|0\r')).toEqual({ app: { name: 'Chrome', category: 'browser' }, fullscreen: false });
    expect(parseForegroundLine('private|1')).toEqual({ app: null, fullscreen: true });
    for (const line of ['', 'garbage', 'chrome.exe|2', 'chrome.exe|0|title', 'C:\\chrome.exe|0', 'chrome.exe|0\ncode.exe|0', 'x'.repeat(110) + '.exe|0', 'x<script>.exe|0'])
      expect(parseForegroundLine(line)).toBeNull();
  });
  it.each([
    ['chrome', 'Chrome', 'browser'], ['msedge', 'Edge', 'browser'], ['firefox', 'Firefox', 'browser'], ['brave', 'Brave', 'browser'], ['opera', 'Opera', 'browser'], ['vivaldi', 'Vivaldi', 'browser'], ['arc', 'Arc', 'browser'],
    ['code', 'VS Code', 'code'], ['cursor', 'Cursor', 'code'], ['windsurf', 'Windsurf', 'code'], ['devenv', 'Visual Studio', 'code'], ['idea64', 'IntelliJ IDEA', 'code'], ['pycharm64', 'PyCharm', 'code'], ['webstorm64', 'WebStorm', 'code'], ['sublime_text', 'Sublime Text', 'code'], ['notepad++', 'Notepad++', 'code'],
    ['figma', 'Figma', 'design'], ['photoshop', 'Photoshop', 'design'], ['illustrator', 'Illustrator', 'design'], ['xd', 'Adobe XD', 'design'], ['affinityphoto2', 'Affinityphoto2', 'design'], ['canva', 'Canva', 'design'],
    ['afterfx', 'After Effects', 'video_edit'], ['adobe premiere pro', 'Premiere Pro', 'video_edit'], ['resolve', 'DaVinci Resolve', 'video_edit'], ['capcut', 'CapCut', 'video_edit'], ['blender', 'Blender', '3d'],
    ['claude', 'Claude', 'ai'], ['chatgpt', 'ChatGPT', 'ai'], ['codex', 'Codex', 'ai'],
    ['winword', 'Word', 'office'], ['excel', 'Excel', 'office'], ['powerpnt', 'PowerPoint', 'office'], ['onenote', 'OneNote', 'office'], ['notion', 'Notion', 'office'], ['explorer', 'File Explorer', 'files'],
    ['windowsterminal', 'Windows Terminal', 'terminal'], ['wt', 'Windows Terminal', 'terminal'], ['powershell', 'PowerShell', 'terminal'], ['pwsh', 'PowerShell', 'terminal'], ['cmd', 'Command Prompt', 'terminal'], ['spotify', 'Spotify', 'music'], ['my_tool', 'My Tool', 'other'],
  ])('maps %s', (exe, name, category) => expect(mapExe(exe.toUpperCase() + '.EXE')).toEqual({ name, category }));
  it.each(['1password', 'bitwarden', 'keepass', 'keepassxc', 'lastpass', 'dashlane', 'whatsapp', 'telegram', 'signal', 'discord', 'slack', 'teams', 'ms-teams', 'messenger', 'zoom', 'mybank', 'revolut', 'chase', 'yono', 'consent', 'credentialuibroker', 'lockapp', 'logonui', 'private', 'unknown', 'self'])('never retains or comments on %s', exe => {
    let now = 0; const tracker = new AppSessionTracker(() => now);
    tracker.observe(parseForegroundLine('chrome.exe|0')!);
    for (let i = 0; i < 10; i++) {
      now += 3600000; const sample = parseForegroundLine(exe.includes('.') || ['private', 'unknown', 'self'].includes(exe) ? `${exe}|0` : `${exe}.exe|0`)!;
      expect(sample.app).toBeNull(); expect(tracker.observe(sample)).toEqual([]); expect(tracker.current).toBeNull();
    }
    expect(JSON.stringify(tracker)).not.toContain(exe);
  });
});
describe('foreground sessions', () => {
  it('comments on category changes only and resets continuous duration on an app change', () => {
    let now = 0; const tracker = new AppSessionTracker(() => now);
    expect(tracker.observe(parseForegroundLine('chrome.exe|0')!)[0].situation).toBe('app_browser');
    now += 29 * 60000; expect(tracker.observe(parseForegroundLine('chrome.exe|0')!)).toEqual([]);
    expect(tracker.observe(parseForegroundLine('msedge.exe|0')!)).toEqual([]);
    now += 60000; expect(tracker.observe(parseForegroundLine('msedge.exe|0')!)).toEqual([]);
    expect(tracker.observe(parseForegroundLine('code.exe|0')!)[0].situation).toBe('app_code');
  });
  it('emits each 30/60/120 minute threshold once and falls back for categories without long lines', () => {
    for (const [exe, expected] of [['figma', 'app_design_long'], ['code', 'app_code_long'], ['chrome', 'app_browser_long'], ['spotify', 'app_generic_long'], ['random', 'app_generic_long']]) {
      let now = 0; const tracker = new AppSessionTracker(() => now); const sample = parseForegroundLine(`${exe}.exe|0`)!;
      tracker.observe(sample);
      for (const minutes of [30, 60, 120]) {
        now = minutes * 60000;
        const events = tracker.observe(sample); expect(events).toHaveLength(1); expect(events[0].situation).toBe(expected); expect(events[0].context?.minutes).toBe(minutes);
        expect(tracker.observe(sample)).toEqual([]);
      }
      now = 180 * 60000; expect(tracker.observe(sample)).toEqual([]);
    }
  });
  it('detects six switches in two minutes and prunes stale switch history', () => {
    let now = 0; const tracker = new AppSessionTracker(() => now); tracker.observe(parseForegroundLine('chrome.exe|0')!);
    for (let i = 1; i <= 6; i++) {
      now += 1000;
      const events = tracker.observe(parseForegroundLine(`${i % 2 ? 'figma' : 'chrome'}.exe|0`)!);
      expect(events[0].situation).toBe(i === 6 ? 'app_switching' : i % 2 ? 'app_design' : 'app_browser');
    }
    now += 120001; expect(tracker.observe(parseForegroundLine('figma.exe|0')!)[0].situation).toBe('app_design');
  });
  it('suppresses fullscreen comments, consumes missed thresholds, and clears all session context', () => {
    let now = 0; const tracker = new AppSessionTracker(() => now);
    expect(tracker.observe(parseForegroundLine('chrome.exe|1')!)).toEqual([]); expect(tracker.fullscreen).toBe(true);
    now = 30 * 60000; expect(tracker.observe(parseForegroundLine('chrome.exe|1')!)).toEqual([]);
    expect(tracker.observe(parseForegroundLine('chrome.exe|0')!)).toEqual([]);
    tracker.clear(); expect(tracker.current).toBeNull(); expect(tracker.fullscreen).toBe(false);
  });
});
