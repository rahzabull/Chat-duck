import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent, type BrowserWindow } from 'electron';
import { CHANNELS } from '../../shared/constants';
import { validatePayload } from '../../shared/schemas/ipc';
import type { Command, EditableSettings, Point } from '../../shared/types';
import type { CompanionController } from '../companion/CompanionController';
import { isTrustedFrame } from '../windows';

export function registerIPC(controller: CompanionController, getSettings: () => BrowserWindow | undefined,
  command: (command: Command) => void, contextMenu: () => void): () => void {
  const disposers: Array<() => void> = [];
  function authorized(event: IpcMainEvent | IpcMainInvokeEvent, channel: string, payload: unknown, companionOnly: boolean): boolean {
    const sender = event.sender;
    const companion = sender === controller.window.webContents;
    const settings = sender === getSettings()?.webContents;
    const frame = event.senderFrame;
    return !!frame && frame === sender.mainFrame && (companion || (!companionOnly && settings)) &&
      isTrustedFrame(frame.url, companion ? 'companion' : 'settings') && validatePayload(channel, payload);
  }
  function handle(channel: string, handler: (payload: unknown) => unknown, companionOnly = false): void {
    ipcMain.handle(channel, (event, payload: unknown, ...extra: unknown[]) => {
      if (extra.length || !authorized(event, channel, payload, companionOnly)) { console.warn('[ducky] Rejected IPC:', channel); throw new Error('Invalid IPC request'); }
      return handler(payload);
    });
    disposers.push(() => ipcMain.removeHandler(channel));
  }
  function listen(channel: string, handler: (payload: unknown) => void): void {
    const listener = (event: IpcMainEvent, payload: unknown, ...extra: unknown[]): void => {
      if (extra.length || !authorized(event, channel, payload, true)) { console.warn('[ducky] Rejected IPC:', channel); return; }
      handler(payload);
    };
    ipcMain.on(channel, listener); disposers.push(() => ipcMain.removeListener(channel, listener));
  }
  handle(CHANNELS.getState, () => controller.state);
  handle(CHANNELS.testAI, () => controller.testAI());
  handle(CHANNELS.updateSettings, payload => { controller.updateSettings(payload as Partial<EditableSettings>); return controller.state; });
  handle(CHANNELS.command, payload => command(payload as Command));
  handle(CHANNELS.dragStart, payload => controller.startDrag(payload as Point), true);
  handle(CHANNELS.dragEnd, () => controller.endDrag(), true);
  listen(CHANNELS.hitTest, payload => controller.setInteractive(payload as boolean));
  listen(CHANNELS.hover, payload => controller.hover(payload as boolean));
  listen(CHANNELS.doubleClick, () => { controller.cancelClicks(); command('settings'); });
  listen(CHANNELS.contextMenu, () => { controller.endDrag(false); controller.cancelClicks(); contextMenu(); });
  listen(CHANNELS.dismissBubble, () => controller.dismissBubble());
  listen(CHANNELS.animationComplete, payload => controller.animationComplete(payload as string));
  return () => disposers.forEach(dispose => dispose());
}
