import { sanitizeTitle } from '../../core/awareness/title';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { parseForegroundLine, type ForegroundSample } from '../../core/awareness';
import { awarenessScript } from './awareness-script';
import { ForegroundFocus } from './foreground';
import { CAPTURE_MAX_HEIGHT, CAPTURE_MAX_LINE, CAPTURE_MAX_WIDTH, captureCommand, captureReply } from './capture-protocol';

// Keep opaque handles as decimal strings: never send them into app context or logs.
const validHwnd = (value: string): boolean => value.length > 0 && value.length <= 19 && !/[^0-9]/.test(value) && BigInt(value) <= 9223372036854775807n;
/** One owned helper, no overlapping restarts. No application identities in logs. */
export class AppAwareness {
  private child?: ChildProcessWithoutNullStreams;
  private wanted = false;
  private identity = true;
  private titles = false;
  private screen = false;
  private excludedApps: string[] = [];
  private stopping = false;
  private retries = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private latest?: ForegroundSample;
  private captured?: (jpeg: string | undefined) => void;
  private captureBlocked = false;
  captureForeground(): string | undefined { return this.focus.capture(); }
  restoreForeground(hwnd: string): boolean { return this.focus.restore(hwnd); }
  constructor(private sample: (sample: ForegroundSample) => void, private status: (active: boolean) => void,
    private ownPids: () => number[], private launch = spawn, private focus = new ForegroundFocus()) {}
  private fresh?: (sample: ForegroundSample | undefined) => void;
  async capture(hwnd: string, maxW = CAPTURE_MAX_WIDTH, maxH = CAPTURE_MAX_HEIGHT): Promise<string | undefined> {
    const command = captureCommand(hwnd, maxW, maxH);
    if (!command || !this.child || !this.wanted || this.stopping || !this.identity || !this.screen
      || this.captured || this.captureBlocked || this.latest?.hwnd !== hwnd || !this.latest.app || this.latest.private || this.latest.fullscreen) return;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        // Replies have no request ID. Retire this pipe before permitting another request,
        // so a timed-out PrintWindow can never satisfy a later window's capture.
        this.captureBlocked = true; this.captured?.(undefined); this.child?.kill();
      }, 5000);
      this.captured = jpeg => { clearTimeout(timer); this.captured = undefined; resolve(jpeg); };
      this.child!.stdin.write(command);
    });
  }
  async sampleFresh(): Promise<ForegroundSample | undefined> {
    if (!this.child || !this.wanted || this.stopping || !this.identity || this.fresh) return;
    return new Promise(resolve => {
      const timer = setTimeout(() => { this.fresh = undefined; resolve(undefined); }, 1000);
      this.fresh = sample => { clearTimeout(timer); this.fresh = undefined; resolve(sample); };
      this.child!.stdin.write('sample\n');
    });
  }
  configure(enabled: boolean, identity = true, titles = false, screen = false, excludedApps: string[] = []): void {
    if (identity !== this.identity || titles !== this.titles || screen !== this.screen || excludedApps.join(',') !== this.excludedApps.join(',')) { this.configure(false, this.identity, this.titles, this.screen, this.excludedApps); this.identity = identity; this.titles = titles; this.screen = screen; this.excludedApps = [...excludedApps]; }
    if (enabled === this.wanted) return;
    this.wanted = enabled;
    if (!enabled) {
      this.fresh?.(undefined);
      this.captured?.(undefined); this.latest = undefined;
      if (this.retryTimer) clearTimeout(this.retryTimer); this.retryTimer = undefined;
      this.status(false);
      if (this.child) { this.stopping = true; this.child.stdin.destroy(); this.child.kill(); }
    } else { this.retries = 0; if (!this.child) this.start(); }
  }
  private start(): void {
    if (!this.wanted || this.child) return;
    this.stopping = false;
    this.captureBlocked = false;
    let child: ChildProcessWithoutNullStreams;
    try {
      child = this.launch('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', awarenessScript(process.pid, this.ownPids(), this.identity, this.titles, this.screen, this.excludedApps)],
        { windowsHide: true, stdio: 'pipe' });
    } catch { this.failed(); return; }
    this.child = child;
    let buffer = '';
    child.stdin.on('error', () => { /* Process may close between sample and PID refresh. */ });
    child.stderr.on('data', () => { /* Drain; do not log potentially identifying OS errors. */ });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (!this.wanted || this.stopping || this.child !== child) return;
      buffer += chunk;
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end).replace(/\r$/, ''); buffer = buffer.slice(end + 1);
        if (line.length > CAPTURE_MAX_LINE) { buffer = ''; this.captureBlocked = true; this.captured?.(undefined); child.kill(); return; }
        if (line.startsWith('capture|')) { this.captured?.(captureReply(line)); continue; }
        if (line.length > 4096) continue;
        const parts = line.split('|');
        if (parts.length < 2 || parts.length > 4 || parts.length >= 3 && !validHwnd(parts[2])) continue;
        let sample = parseForegroundLine(parts.slice(0, 2).join('|'));
        if (!sample) continue;
        if (this.identity && sample.app && parts.length >= 3) sample.hwnd = parts[2];
        if (this.titles && sample.app && parts[3]) {
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(parts[3]) || parts[3].length > 1600) continue;
          const title = sanitizeTitle(Buffer.from(parts[3], 'base64').toString('utf8'), sample.app);
          sample = title.private ? { app: null, fullscreen: sample.fullscreen, private: true } : { ...sample, safeTitle: title.summary };
        }
        this.latest = this.identity ? sample : undefined;
        this.status(true); this.sample(this.identity ? sample : { app: null, fullscreen: sample.fullscreen });
        this.fresh?.(this.identity ? sample : undefined);
        if (!child.stdin.destroyed) child.stdin.write([process.pid, ...this.ownPids()].join(',') + '\n');
      }
      if (buffer.length > CAPTURE_MAX_LINE) { buffer = ''; this.captureBlocked = true; this.captured?.(undefined); child.kill(); }
    });
    child.on('error', () => { /* close follows errors, including failed spawn */ });
    child.once('close', () => {
      if (this.child !== child) return;
      buffer = ''; this.captured?.(undefined); this.fresh?.(undefined); this.latest = undefined;
      this.child = undefined; this.status(false);
      if (this.stopping) { this.stopping = false; if (this.wanted) this.start(); }
      else if (this.wanted) this.failed();
    });
  }
  private failed(): void {
    this.status(false);
    if (!this.wanted) return;
    if (this.retries >= 3) { console.warn('[ducky] App awareness stopped after three restart attempts'); return; }
    const delay = 1000 * 2 ** this.retries++;
    this.retryTimer = setTimeout(() => { this.retryTimer = undefined; this.start(); }, delay);
  }
  dispose(): void { this.configure(false); }
}
