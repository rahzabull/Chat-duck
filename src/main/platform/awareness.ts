import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { parseForegroundLine, type ForegroundSample } from '../../core/awareness';
import { awarenessScript } from './awareness-script';

/** One owned helper, no overlapping restarts. No application identities in logs. */
export class AppAwareness {
  private child?: ChildProcessWithoutNullStreams;
  private wanted = false;
  private identity = true;
  private stopping = false;
  private retries = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  constructor(private sample: (sample: ForegroundSample) => void, private status: (active: boolean) => void,
    private ownPids: () => number[], private launch = spawn) {}
  configure(enabled: boolean, identity = true): void {
    if (identity !== this.identity) { this.configure(false, this.identity); this.identity = identity; }
    if (enabled === this.wanted) return;
    this.wanted = enabled;
    if (!enabled) {
      if (this.retryTimer) clearTimeout(this.retryTimer); this.retryTimer = undefined;
      this.status(false);
      if (this.child) { this.stopping = true; this.child.stdin.destroy(); this.child.kill(); }
    } else { this.retries = 0; if (!this.child) this.start(); }
  }
  private start(): void {
    if (!this.wanted || this.child) return;
    this.stopping = false;
    let child: ChildProcessWithoutNullStreams;
    try {
      child = this.launch('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', awarenessScript(process.pid, this.ownPids(), this.identity)],
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
      if (buffer.length > 4096) { buffer = ''; return; }
      let end: number;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        const sample = parseForegroundLine(line);
        if (!sample) continue;
        this.status(true); this.sample(this.identity ? sample : { app: null, fullscreen: sample.fullscreen });
        if (!child.stdin.destroyed) child.stdin.write([process.pid, ...this.ownPids()].join(',') + '\n');
      }
    });
    child.on('error', () => { /* close follows errors, including failed spawn */ });
    child.once('close', () => {
      if (this.child !== child) return;
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
