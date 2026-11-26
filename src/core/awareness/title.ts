import type { ForegroundApp } from './index';
import type { SituationEvent } from '../dialogue/context';

// Used before title transmission by the helper and again at the main boundary.
export const PRIVATE_TITLE_PATTERN = '(gmail|google mail|outlook|proton\\s?mail|yahoo mail|whatsapp|telegram|slack|discord|messenger|signal|teams|bank|banking|payment|checkout|paypal|paytm|phonepe|revolut|chase|hdfc|icici|kotak|axis|password|1password|bitwarden|keepass|lastpass|dashlane|sign[ -]?in|log[ -]?in|authentication|incognito|inprivate|private browsing|direct message|inbox)';
const privateTitle = new RegExp(PRIVATE_TITLE_PATTERN, 'i');
const sites: Array<[RegExp, string]> = [
  [/youtube/i, 'YouTube'], [/linkedin/i, 'LinkedIn'], [/twitter|(?:^|[|–—-] )X(?:$| )/i, 'X'],
  [/reddit/i, 'Reddit'], [/github/i, 'GitHub'], [/figma/i, 'Figma'],
  [/google docs/i, 'Google Docs'], [/google sheets/i, 'Google Sheets'], [/google slides/i, 'Google Slides'],
  [/netflix/i, 'Netflix'], [/chatgpt/i, 'ChatGPT'], [/claude/i, 'Claude'],
];
export function sanitizeTitle(raw: string, app: ForegroundApp): { private: boolean; summary?: string } {
  const title = raw.slice(0, 200).normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '');
  if (privateTitle.test(title)) return { private: true };
  const site = sites.find(([pattern]) => pattern.test(title))?.[1] ?? app.name;
  const page = title
    .replace(/\b[\w.+-]+@[\w.-]+\.[\p{L}]{2,}\b/giu, '')
    .replace(/https?:\/\/[^\s]+/gi, url => url.split(/[?#]/)[0])
    .replace(/[?&][^\s]*/g, '')
    .replace(/\b(?:bearer\s+\S+|(?:sk|pk|ghp|github_pat|token|key|secret)[_:= -]+\S+)/gi, '')
    .replace(/\b[\w+/=-]{24,}\b/g, '')
    .replace(/\b(?=[\w-]{12,}\b)(?=[\w-]*[a-z])(?=[\w-]*\d)[\w-]+\b/gi, '')
    .replace(/\p{N}{4,}/gu, '')
    .replace(/https?:\/\//gi, '')
    .replace(/[^\p{L}\p{N} ._–—:/+-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return { private: false, summary: `${site}: ${page}`.slice(0, 60) };
}

/** Current summary plus two minutes of transition fingerprints; no persistence or raw titles. */
export class TitleActivity {
  summary?: string;
  private app?: string;
  private started = 0;
  private threshold = 0;
  private history: Array<{ key: string; at: number }> = [];
  constructor(private clock = Date.now) {}
  clear(): void { this.summary = undefined; this.app = undefined; this.history = []; this.threshold = 0; this.started = 0; }
  observe(app: ForegroundApp | null, summary?: string): { changed: boolean; events: SituationEvent[] } {
    if (!app) { const changed = !!this.app; this.clear(); return { changed, events: [] }; }
    const now = this.clock();
    this.history = this.history.filter(item => now - item.at < 120000);
    const changed = this.app !== app.name || this.summary !== summary;
    const events: SituationEvent[] = [];
    if (changed) {
      if (this.app && this.app !== app.name && this.history.some(item => item.key === app.name)) events.push({ situation: 'app_return', context: { app: app.name } });
      if (this.app) this.history.push({ key: this.app, at: now });
      if (summary && this.summary && this.history.length >= 4) events.push({ situation: 'title_switch' });
      this.app = app.name; this.summary = summary; this.started = now; this.threshold = 0;
    }
    const thresholds = [10, 25, 45];
    const minutes = (now - this.started) / 60000;
    if (summary && this.threshold < thresholds.length && minutes >= thresholds[this.threshold]) {
      while (this.threshold < thresholds.length && minutes >= thresholds[this.threshold]) this.threshold++;
      events.push({ situation: 'title_long' });
    }
    return { changed, events };
  }
}
