import { ConversationController } from './conversation/controller';
import { ConversationStore } from './conversation/store';
import { app, globalShortcut, BrowserWindow, powerMonitor, screen } from 'electron';
import { join } from 'node:path';
import { CHANNELS } from '../shared/constants';
import type { Command, CompanionState } from '../shared/types';
import { CompanionController } from './companion/CompanionController';
import { registerIPC } from './ipc';
import { MemoryStore } from './memory/store';
import { SettingsStore } from './settings/store';
import { DuckyTray } from './tray';
import { createCompanion, createSettings, secureSession } from './windows';

app.setName('Ducky');
app.commandLine.appendSwitch('disable-background-networking');
let conversation: ConversationController | undefined;
let controller: CompanionController | undefined;
let settingsWindow: BrowserWindow | undefined;
let tray: DuckyTray | undefined;
let disposeIPC: (() => void) | undefined;
let quitting = false;

function broadcast(state: CompanionState): void {
  for (const window of [controller?.window, settingsWindow]) {
    if (window && !window.isDestroyed() && !window.webContents.isLoadingMainFrame()) {
      window.webContents.send(CHANNELS.state, window === controller?.window ? { ...state, library: undefined } : state);
    }
  }
}
function showSettings(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    if (settingsWindow.isMinimized()) settingsWindow.restore();
    settingsWindow.show(); settingsWindow.focus(); return;
  }
  settingsWindow = createSettings(); settingsWindow.on('closed', () => { settingsWindow = undefined; });
}
function command(command: Command): void {
  if (!controller) return;
  switch (command) {
    case 'talk': void conversation?.open(); break;
    case 'show': controller.setVisible(true); break;
    case 'hide': controller.setVisible(false); break;
    case 'pause': controller.togglePause(); break;
    case 'mute': controller.updateSettings({ mute: !controller.state.settings.mute }); break;
    case 'reset': controller.recover('user reset', true); break;
    case 'settings': showSettings(); break;
    case 'quit': app.quit(); break;
  }
}
function cleanup(): void {
  if (quitting) return;
  quitting = true; console.log('[ducky] Quitting; flushing settings and stopping timers');
  screen.removeListener('display-added', displayChanged);
  screen.removeListener('display-removed', displayChanged);
  screen.removeListener('display-metrics-changed', displayChanged);
  powerMonitor.removeListener('resume', resumed);
  disposeIPC?.(); conversation?.dispose(); globalShortcut.unregisterAll(); controller?.dispose(); tray?.dispose();
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
}
function displayChanged(): void { controller?.recover('display configuration changed'); }
function resumed(): void { controller?.resume(); }

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    console.log('[ducky] Second launch received'); controller?.setVisible(true);
    if (settingsWindow) showSettings();
  });
  app.on('window-all-closed', () => { /* Tray owns application lifetime. */ });
  app.on('before-quit', cleanup);
  app.whenReady().then(() => {
    secureSession();
    const store = new SettingsStore(join(app.getPath('userData'), 'settings.json'));
    controller = new CompanionController(createCompanion(), store, broadcast, new MemoryStore(join(app.getPath('userData'), 'memory.json'), store.value.memoryEnabled));
    conversation = new ConversationController(controller, new ConversationStore(app.getPath('userData'), store.value.memoryEnabled, store.value.conversationRetention));
    controller.onConversationClose = () => conversation?.end();
    tray = new DuckyTray(() => controller!.state, command);
    let menuKey = '';
    controller.onChanged = () => {
      const state = controller!.state; const key = `${state.visible}:${state.paused}:${state.settings.mute}`;
      if (key !== menuKey) { menuKey = key; tray?.refresh(); }
    };
    disposeIPC = registerIPC(controller, () => settingsWindow, command, () => tray?.popup(), conversation);
    screen.on('display-added', displayChanged); screen.on('display-removed', displayChanged);
    screen.on('display-metrics-changed', displayChanged); powerMonitor.on('resume', resumed);
    console.log('[ducky] Started Milestone 1', app.getVersion());
  }).catch(error => { console.error('[ducky] Startup failed', error); app.quit(); });
}
