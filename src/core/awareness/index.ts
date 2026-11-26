import type { SituationEvent } from '../dialogue/context';
export type AppCategory = 'browser' | 'code' | 'design' | 'video_edit' | '3d' | 'ai' | 'office' | 'files' | 'terminal' | 'music' | 'other';
export interface ForegroundApp { name: string; category: AppCategory }
export interface ForegroundSample { app: ForegroundApp | null; fullscreen: boolean; private?: boolean; hwnd?: string; safeTitle?: string }
// Also embedded into the helper so private names never cross its stdout pipe.
export const PRIVATE_EXE_PATTERN = '^(1password|bitwarden|keepass.*|lastpass|dashlane|whatsapp|telegram|signal|discord.*|slack|teams|ms-teams|msteams|messenger|zoom.*|consent|credentialuibroker|lockapp|logonui|.*bank.*|chase|revolut|wise|paypal|paytm|phonepe|gpay|yono.*|icici.*|hdfc.*|kotak.*|axis.*)(\\.exe)?$';
const privateExe = new RegExp(PRIVATE_EXE_PATTERN, 'i');
const mappings: Array<[AppCategory, Record<string, string>]> = [
  ['browser', { chrome: 'Chrome', msedge: 'Edge', firefox: 'Firefox', brave: 'Brave', opera: 'Opera', vivaldi: 'Vivaldi', arc: 'Arc' }],
  ['code', { code: 'VS Code', cursor: 'Cursor', windsurf: 'Windsurf', devenv: 'Visual Studio', idea64: 'IntelliJ IDEA', pycharm64: 'PyCharm', webstorm64: 'WebStorm', sublime_text: 'Sublime Text', 'notepad++': 'Notepad++' }],
  ['design', { figma: 'Figma', photoshop: 'Photoshop', illustrator: 'Illustrator', xd: 'Adobe XD', canva: 'Canva' }],
  ['video_edit', { afterfx: 'After Effects', 'adobe premiere pro': 'Premiere Pro', resolve: 'DaVinci Resolve', capcut: 'CapCut' }],
  ['3d', { blender: 'Blender' }], ['ai', { claude: 'Claude', chatgpt: 'ChatGPT', codex: 'Codex' }],
  ['office', { winword: 'Word', excel: 'Excel', powerpnt: 'PowerPoint', onenote: 'OneNote', notion: 'Notion' }],
  ['files', { explorer: 'File Explorer' }],
  ['terminal', { windowsterminal: 'Windows Terminal', wt: 'Windows Terminal', powershell: 'PowerShell', pwsh: 'PowerShell', cmd: 'Command Prompt' }],
  ['music', { spotify: 'Spotify' }],
];
export function mapExe(exe: string): ForegroundApp | null {
  const key = exe.toLowerCase().replace(/\.exe$/, '');
  if (key === 'private' || key === 'unknown' || key === 'self' || privateExe.test(key)) return null;
  for (const [category, apps] of mappings) if (Object.hasOwn(apps, key)) return { name: apps[key], category };
  const name = key.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  return { name, category: key.startsWith('affinity') ? 'design' : 'other' };
}
export function parseForegroundLine(line: string): ForegroundSample | null {
  const match = /^([a-zA-Z0-9][a-zA-Z0-9 ._+()-]{0,100}\.exe|private|unknown|self)\|([01])$/.exec(line.trim());
  return match ? { app: mapExe(match[1]), fullscreen: match[2] === '1',
    ...(match[1] === 'private' || privateExe.test(match[1]) ? { private: true } : {}) } : null;
}
/** No previous app names: only current identity, session timing and switch timestamps. */
export class AppSessionTracker {
  current: ForegroundApp | null = null;
  fullscreen = false;
  private started = 0;
  private threshold = 0;
  private switches: number[] = [];
  constructor(private clock = Date.now) {}
  get minutes(): number { return this.current ? Math.max(0, Math.floor((this.clock() - this.started) / 60000)) : 0; }
  clear(): void { this.current = null; this.fullscreen = false; this.started = 0; this.threshold = 0; this.switches = []; }
  observe(sample: ForegroundSample): SituationEvent[] {
    const now = this.clock(); this.fullscreen = sample.fullscreen;
    this.switches = this.switches.filter(time => now - time < 120000);
    if (!sample.app) { this.current = null; this.started = 0; this.threshold = 0; this.switches = []; return []; }
    const events: SituationEvent[] = [];
    if (this.current?.name !== sample.app.name) {
      const previousCategory = this.current?.category;
      if (this.current) this.switches.push(now);
      this.current = sample.app; this.started = now; this.threshold = 0;
      if (this.switches.length >= 6) {
        events.push({ situation: 'app_switching' }); this.switches = [];
      } else if (previousCategory !== sample.app.category && sample.app.category !== 'other') {
        events.push({ situation: `app_${sample.app.category}`, context: { app: sample.app.name } });
      }
    }
    const minutes = Math.floor((now - this.started) / 60000);
    const thresholds = [30, 60, 120];
    if (this.threshold < thresholds.length && minutes >= thresholds[this.threshold]) {
      while (this.threshold < thresholds.length && minutes >= thresholds[this.threshold]) this.threshold++;
      const category = this.current.category;
      events.push({ situation: category === 'browser' || category === 'code' || category === 'design' ? `app_${category}_long` : 'app_generic_long',
        context: { app: this.current.name, minutes, hours: Math.floor(minutes / 60) } });
    }
    // Thresholds crossed in fullscreen are consumed, never queued for later.
    return this.fullscreen ? [] : events;
  }
}
