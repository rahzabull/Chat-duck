import { ConversationController } from './conversation/controller';
import { ConversationStore } from './conversation/store';
import { app, globalShortcut, BrowserWindow, powerMonitor, screen, Notification, dialog, clipboard } from 'electron';
import { writeFile } from 'node:fs/promises';
import { ProductivityService } from './productivity/service';
import { ProductivityStore } from './productivity/store';
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
let productivity: ProductivityService | undefined;
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
    case 'privacy': controller.updateSettings({ privacyMode: !controller.state.settings.privacyMode }); conversation?.configure(); break;
    case 'dnd-off': case 'dnd-30': case 'dnd-60': case 'dnd-until-off':
      controller.updateSettings({ dndUntil: command === 'dnd-off' ? 0 : command === 'dnd-until-off' ? -1 : Date.now() + (command === 'dnd-30' ? 30 : 60) * 60000 }); conversation?.configure(); break;
    case 'proactive-accept': controller.proactiveAction(true); break;
    case 'proactive-later': controller.proactiveAction(false); break;
    case 'tasks': case 'notes': case 'add-task': case 'add-reminder':
      controller.setVisible(true); productivity?.open(command); controller.window.setFocusable(true); controller.window.show(); controller.window.focus(); break;
    case 'focus': void productivity?.action({ name: 'start_focus', args: { minutes: 25 } }); break;
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
  powerMonitor.removeListener('unlock-screen', unlocked);
  disposeIPC?.(); productivity?.dispose(); conversation?.dispose(); globalShortcut.unregisterAll(); controller?.dispose(); tray?.dispose();
  for (const window of BrowserWindow.getAllWindows()) window.destroy();
}
function displayChanged(): void { controller?.recover('display configuration changed'); }
function resumed(): void { controller?.resume(); void productivity?.tick(true); }
function unlocked(): void { void productivity?.tick(true); }

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
    productivity = new ProductivityService(new ProductivityStore(app.getPath('userData')), {
      changed: view => controller?.presentProductivity(view),
      attention: (kind, text) => controller?.productivityAttention(kind, text),
      doNotDisturb: () => controller?.notificationsOnly() ?? false,
      notificationOnly: () => controller?.notificationsOnly() ?? false,
      copy: text => clipboard.writeText(text),
      notify: (reminder, click) => {
        if (!Notification.isSupported()) return false;
        const notification = new Notification({ title: 'Ducky reminder', body: reminder.text, silent: true });
        notification.on('click', () => { controller?.setVisible(true); click(); controller?.window.setFocusable(true); controller?.window.show(); controller?.window.focus(); });
        notification.show(); return true;
      },
      export: async (kind, data, format) => {
        const result = await dialog.showSaveDialog({ title: `Export ${kind}`, defaultPath: `Ducky-${kind}.${format}`, filters: [{ name: format === 'json' ? 'JSON' : 'Text', extensions: [format] }] });
        if (result.canceled || !result.filePath) return false;
        const text = format === 'json' ? JSON.stringify({ version: 1, data }, null, 2) : data.map(row => Object.entries(row as Record<string, unknown>).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join('\n')).join('\n\n');
        await writeFile(result.filePath, text, 'utf8'); return true;
      },
    });
    conversation = new ConversationController(controller, new ConversationStore(app.getPath('userData'), store.value.memoryEnabled, store.value.conversationRetention), productivity);
    controller.window.once('ready-to-show', () => productivity?.start());
    controller.onConversationClose = () => conversation?.end();
    controller.onModeChanged = () => { conversation?.modeChanged(); if (controller?.aiBlocked()) productivity?.open(null); };
    controller.onProactiveAction = action => {
      if (action.kind === 'plan') conversation?.openWithPrompt(action.prompt);
      else { productivity?.open('tasks', undefined, action.kind === 'today' ? 'today' : 'overdue'); controller?.window.setFocusable(true); controller?.window.show(); controller?.window.focus(); }
    };
    tray = new DuckyTray(() => controller!.state, command, patch => { controller?.updateSettings(patch); conversation?.configure(); });
    let menuKey = '';
    controller.onChanged = () => {
      const state = controller!.state; const key = `${state.visible}:${state.paused}:${state.settings.mute}:${state.mode}:${state.dnd}:${state.settings.dndUntil}:${state.settings.privacyMode}:${state.settings.skillPack}`;
      if (key !== menuKey) { menuKey = key; tray?.refresh(); }
    };
    disposeIPC = registerIPC(controller, () => settingsWindow, command, () => tray?.popup(), conversation, productivity);
    screen.on('display-added', displayChanged); screen.on('display-removed', displayChanged);
    screen.on('display-metrics-changed', displayChanged); powerMonitor.on('resume', resumed);
    powerMonitor.on('unlock-screen', unlocked);
    console.log('[ducky] Started Milestone 1', app.getVersion());
  }).catch(error => { console.error('[ducky] Startup failed', error); app.quit(); });
}
