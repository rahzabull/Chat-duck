import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

// Isolated hidden Electron renderer: no Ducky profile, helper or user data.
it.skipIf(process.env.DUCKY_NATIVE_UI_TEST !== '1')('native renderer handles Escape and close-button hits with the bundled UI styles', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ducky-keyboard-'));
  let child: ReturnType<typeof spawn> | undefined; let timer: ReturnType<typeof setTimeout> | undefined;
  let exited: Promise<number | null> | undefined;
  try {
    const { build } = await import('vite');
    await build({ configFile: false, logLevel: 'silent', build: {
      outDir: directory, emptyOutDir: false,
      lib: { entry: resolve('tests/fixtures/conversation-keyboard.ts'), formats: ['iife'], name: 'KeyboardFixture', fileName: () => 'fixture.js', cssFileName: 'fixture' },
    } });
    writeFileSync(join(directory, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="fixture.css"></head><body><script src="fixture.js"></script></body></html>');
    writeFileSync(join(directory, 'main.cjs'), `
      const { app, BrowserWindow } = require('electron');
      const { join } = require('node:path');
      const assert = require('node:assert/strict');
      app.setPath('userData', join(__dirname, 'profile'));
      app.commandLine.appendSwitch('disable-background-networking');
      app.whenReady().then(async () => {
        const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true } });
        try {
          await win.loadFile(join(__dirname, 'index.html'));
          win.webContents.debugger.attach('1.3');
          const evaluate = expression => win.webContents.executeJavaScript(expression);
          const escape = async () => {
            for (const type of ['keyDown', 'keyUp']) await win.webContents.debugger.sendCommand('Input.dispatchKeyEvent', {
              type, key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27
            });
          };
          assert.equal(await evaluate('keyboardFixture.activeTag()'), 'TEXTAREA');
          assert.equal(await evaluate('keyboardFixture.activeOwner()'), 'card');
          await escape();
          assert.deepEqual(await evaluate('keyboardFixture.calls'), ['close-card']);
          await evaluate('keyboardFixture.focusConversation()');
          assert.equal(await evaluate('keyboardFixture.activeTag()'), 'TEXTAREA');
          assert.equal(await evaluate('keyboardFixture.activeOwner()'), 'conversation');
          await escape();
          assert.deepEqual(await evaluate('keyboardFixture.calls'), ['close-card', 'end-conversation']);
          await evaluate('keyboardFixture.showReminder()');
          await evaluate('document.fonts.ready');
          assert.equal(await evaluate('getComputedStyle(document.querySelector("#productivity-card")).width'), '320px');
          assert.equal(await evaluate('getComputedStyle(document.querySelector(".ducky-quip")).fontSize'), '20px');
          assert.equal(await evaluate('document.fonts.check("20px \\\"Gochi Hand\\\"")'), true);
          assert.equal(await evaluate('getComputedStyle(document.querySelector("#talk-input-shell")).height'), '44px');
          const clickClose = async selector => {
            const info = await evaluate('keyboardFixture.closeInfo(' + JSON.stringify(selector) + ')');
            assert.equal(info.hit, true, selector + ' participates in hit testing');
            assert.equal(info.label, 'Close'); assert.equal(info.tabIndex, 0);
            assert.ok(info.width >= 24 && info.height >= 24);
            for (const type of ['mousePressed', 'mouseReleased']) await win.webContents.debugger.sendCommand('Input.dispatchMouseEvent', { type, x: info.x, y: info.y, button: 'left', clickCount: 1 });
          };
          await clickClose('#productivity-card');
          assert.equal(await evaluate('keyboardFixture.calls.at(-1)'), 'close-card');
          await evaluate('keyboardFixture.showReading()');
          assert.equal(await evaluate('getComputedStyle(document.querySelector("#reading-panel")).width'), '380px');
          await clickClose('#reading-panel');
          assert.equal(await evaluate('keyboardFixture.calls.at(-1)'), 'close-panel');
          await clickClose('#talk-input-shell');
          assert.equal(await evaluate('keyboardFixture.calls.at(-1)'), 'end-conversation');
          win.destroy(); app.exit(0);
        } catch (error) { console.error(error); win.destroy(); app.exit(1); }
      }).catch(error => { console.error(error); app.exit(1); });
    `);
    const electron = createRequire(import.meta.url)('electron') as string;
    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    child = spawn(electron, [join(directory, 'main.cjs')], { windowsHide: true, env, stdio: 'pipe' });
    let errors = ''; child.stderr!.on('data', chunk => { errors += String(chunk); }); child.stdout!.resume();
    exited = new Promise((resolve, reject) => { child!.once('close', resolve); child!.once('error', reject); });
    const code = await Promise.race([exited, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Keyboard fixture timed out')), 15000); })]);
    expect(code, errors).toBe(0);
  } finally {
    clearTimeout(timer);
    if (child && child.exitCode === null) child.kill();
    await exited;
    rmSync(directory, { recursive: true, force: true });
  }
}, 30000);
