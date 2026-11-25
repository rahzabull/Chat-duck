const { app, BrowserWindow } = require('electron');
const { resolve } = require('node:path');
const { writeFileSync } = require('node:fs');
const root = process.argv.at(-1);
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1200, height: 1500, webPreferences: { offscreen: true, sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    await win.loadFile(resolve(root, 'out/figma-check/index.html'));
    const result = await win.webContents.executeJavaScript('FigmaChecks.runChecks()');
    writeFileSync(resolve(root, 'out/figma-check/results.json'), JSON.stringify(result));
    await win.webContents.executeJavaScript('FigmaChecks.showGallery()');
    await new Promise(r => setTimeout(r, 200));
    writeFileSync(resolve(root, 'out/figma-check/adapter.png'), (await win.webContents.capturePage()).toPNG());
    await win.loadFile(resolve(root, 'assets/characters/ducky/preview.html'));
    await new Promise(r => setTimeout(r, 200));
    writeFileSync(resolve(root, 'out/figma-check/preview.png'), (await win.webContents.capturePage()).toPNG());
    win.destroy(); app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
