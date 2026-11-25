import { build } from 'vite';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'out/figma-check');
await build({ configFile: false, logLevel: 'error', build: { outDir: out, emptyOutDir: true,
  lib: { entry: resolve(root, 'tests/fixtures/figma-browser.ts'), name: 'FigmaChecks', formats: ['iife'], fileName: () => 'checks.js' } } });
writeFileSync(resolve(out, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="ducky-exe.css"></head><body><script src="checks.js"></script></body></html>');
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const chrome = [process.env.FIGMA_CHECK_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => p && existsSync(p));
if (chrome) {
  // Test-only isolated headless process: no server, user profile, or external assets.
  const flags = ['--headless', '--disable-gpu', '--in-process-gpu', '--no-sandbox', '--no-first-run', '--disable-background-networking', '--disable-extensions', '--disable-component-update', '--disable-sync', '--metrics-recording-only', `--user-data-dir=${out}/profile`, '--window-size=1200,1500'];
  writeFileSync(resolve(out, 'check.html'), readFileSync(resolve(out, 'index.html'), 'utf8').replace('</body>', `<script>const result=document.createElement('pre');result.id='result';try{result.textContent=JSON.stringify(FigmaChecks.runChecks())}catch(error){result.textContent=JSON.stringify({error:error.stack})}document.body.append(result);</script></body>`));
  const html = execFileSync(chrome, [...flags, '--dump-dom', pathToFileURL(resolve(out, 'check.html')).href], { env, windowsHide: true, timeout: 30000, encoding: 'utf8', stdio: 'pipe', maxBuffer: 4 * 1024 * 1024 });
  const result = JSON.parse(html.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1].replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&') ?? '{}');
  if (!result.assertions || result.error) throw new Error(result.error ?? 'Browser checks did not execute');
  writeFileSync(resolve(out, 'results.json'), JSON.stringify(result));
  writeFileSync(resolve(out, 'gallery.html'), readFileSync(resolve(out, 'index.html'), 'utf8').replace('</body>', '<script>FigmaChecks.showGallery()</script></body>'));
  for (const [page, png] of [[resolve(out, 'gallery.html'), 'adapter.png'], [resolve(root, 'assets/characters/ducky/preview.html'), 'preview.png']]) {
    execFileSync(chrome, [...flags, `--screenshot=${resolve(out, png)}`, pathToFileURL(page).href], { env, windowsHide: true, timeout: 15000, stdio: 'pipe' });
  }
} else {
  execFileSync(createRequire(import.meta.url)('electron'), [`--user-data-dir=${out}/profile`, resolve(root, 'scripts/figma/check-electron.cjs'), root], { env, windowsHide: true, timeout: 45000, stdio: 'pipe' });
}
console.log(readFileSync(resolve(out, 'results.json'), 'utf8'));
