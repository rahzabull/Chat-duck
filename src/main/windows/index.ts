import { BrowserWindow, session } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export type Page = 'companion' | 'settings';
function pageURL(page: Page): string {
  const dev = process.env.ELECTRON_RENDERER_URL;
  if (dev) {
    const url = new URL(dev);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Only loopback development URLs are allowed');
    return `${url.origin}/${page}/index.html`;
  }
  return pathToFileURL(join(__dirname, `../renderer/${page}/index.html`)).href;
}
export function isTrustedFrame(url: string, page: Page): boolean { return url === pageURL(page); }

export function secureSession(): void {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.on('will-download', event => event.preventDefault());
  // Production is file-only. Development permits only the existing Vite loopback origin.
  const dev = process.env.ELECTRON_RENDERER_URL ? new URL(pageURL('companion')).origin : null;
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = new URL(details.url);
    const localDev = dev && (url.origin === dev ||
      (url.protocol === 'ws:' && `http://${url.host}` === dev));
    callback({ cancel: !['file:', 'data:', 'devtools:'].includes(url.protocol) && !localDev });
  });
}
function secureWindow(win: BrowserWindow): void {
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-redirect', event => event.preventDefault());
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}
const webPreferences = () => ({ preload: join(__dirname, '../preload/index.js'), contextIsolation: true,
  nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false });

export function createCompanion(): BrowserWindow {
  const win = new BrowserWindow({ width: 320, height: 300, transparent: true, frame: false,
    resizable: false, hasShadow: false, skipTaskbar: true, focusable: false, show: false,
    backgroundColor: '#00000000', autoHideMenuBar: true, webPreferences: webPreferences() });
  secureWindow(win); win.setIgnoreMouseEvents(true, { forward: true });
  void win.loadURL(pageURL('companion'));
  return win;
}
export function createSettings(): BrowserWindow {
  const win = new BrowserWindow({ width: 460, height: 560, minWidth: 400, minHeight: 420,
    title: 'Ducky Settings', show: false, autoHideMenuBar: true, webPreferences: webPreferences() });
  secureWindow(win); win.removeMenu();
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  void win.loadURL(pageURL('settings'));
  return win;
}
