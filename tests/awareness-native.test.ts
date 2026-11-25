import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { expect, it } from 'vitest';
import { AppAwareness } from '../src/main/platform/awareness';

// Explicit opt-in only: this checks the actual Windows API/helper and discards app identity.
it.skipIf(process.platform !== 'win32' || process.env.DUCKY_NATIVE_HELPER_TEST !== '1')('native helper emits a valid sample and exits on disable', async () => {
  let child: ChildProcessWithoutNullStreams | undefined;
  let stderr = '';
  let exited: Promise<void> | undefined;
  let resolveSample!: () => void;
  const sampleTimes: number[] = [];
  const sample = new Promise<void>(resolve => { resolveSample = resolve; });
  const launch = ((...args: Parameters<typeof spawn>) => {
    child = spawn(...args) as ChildProcessWithoutNullStreams;
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    exited = new Promise<void>(resolve => child!.once('close', () => resolve()));
    return child;
  }) as typeof spawn;
  const helper = new AppAwareness(() => { sampleTimes.push(Date.now()); if (sampleTimes.length === 2) resolveSample(); }, () => {}, () => [process.pid], launch);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    helper.configure(true);
    const result = await Promise.race([
      sample.then(() => 'sample'),
      exited!.then(() => 'exit'),
      new Promise<string>(resolve => { timeout = setTimeout(() => resolve('timeout'), 15000); }),
    ]);
    expect(result, stderr || 'No valid helper sample').toBe('sample');
    expect(sampleTimes[1] - sampleTimes[0]).toBeGreaterThanOrEqual(2900);
    // Command is handled by the resident reader, not the three-second sample loop.
    const capturedAt = Date.now();
    await new Promise<void>(resolve => helper.captureForeground(() => resolve()));
    expect(Date.now() - capturedAt).toBeLessThan(150);
    helper.configure(false);
    await exited;
    expect(child!.exitCode !== null || child!.signalCode !== null).toBe(true);
    expect(() => process.kill(child!.pid!, 0)).toThrow();
  } finally {
    if (timeout) clearTimeout(timeout);
    helper.dispose();
    await exited;
  }
}, 20000);

it.skipIf(process.platform !== 'win32' || process.env.DUCKY_NATIVE_HELPER_TEST !== '1')('native helper exits when its owner exits without disposing it', async () => {
  // The fixture owns its helper; no existing system process is terminated.
  const { awarenessScript } = await import('../src/main/platform/awareness-script');
  const template = awarenessScript(987654321, []);
  const code = `
    const { spawn } = require('node:child_process');
    const script = ${JSON.stringify(template)}.replaceAll('987654321', String(process.pid));
    const helper = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', script], {windowsHide: true, stdio: 'pipe'});
    process.stdout.write(String(helper.pid) + '\\n');
    helper.stdout.once('data', () => { process.stdout.write('ready\\n'); process.exit(0); });
    helper.stderr.resume();
  `;
  const owner = spawn(process.execPath, ['-e', code], { windowsHide: true, stdio: 'pipe' });
  let output = ''; let helperPid: number | undefined;
  owner.stdout.setEncoding('utf8'); owner.stdout.on('data', chunk => { output += chunk; helperPid = Number(output.split('\n')[0]); });
  owner.stderr.resume();
  const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let poll: ReturnType<typeof setInterval> | undefined;
  try {
    await Promise.race([
      new Promise<void>(resolve => owner.once('close', () => resolve())),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Owner fixture timed out')), 12000); }),
    ]);
    if (timer) clearTimeout(timer);
    expect(output).toContain('ready'); expect(helperPid).toBeGreaterThan(0);
    await Promise.race([
      new Promise<void>(resolve => { poll = setInterval(() => { if (!alive(helperPid!)) resolve(); }, 100); }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Owned helper remained after parent exit')), 6000); }),
    ]);
    expect(alive(helperPid!)).toBe(false);
  } finally {
    if (timer) clearTimeout(timer); if (poll) clearInterval(poll);
    if (owner.exitCode === null && owner.signalCode === null) owner.kill();
    if (helperPid && alive(helperPid)) process.kill(helperPid);
  }
}, 20000);
