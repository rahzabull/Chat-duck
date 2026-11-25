import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '../shared/constants';
import type { CompanionState, CursorUpdate, DuckyAPI, Point } from '../shared/types';

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
const api: DuckyAPI = {
  productivity: action => ipcRenderer.invoke(CHANNELS.productivity, action),
  talkSave: pinned => ipcRenderer.invoke(CHANNELS.talkSave, pinned),
  talkCopy: () => ipcRenderer.invoke(CHANNELS.talkCopy),
  talkSend: text => ipcRenderer.invoke(CHANNELS.talkSend, text),
  talkEnd: () => ipcRenderer.invoke(CHANNELS.talkEnd),
  talkTyping: () => ipcRenderer.send(CHANNELS.talkTyping),
  talkPanel: expanded => ipcRenderer.send(CHANNELS.talkPanel, expanded),
  libraryAction: action => ipcRenderer.invoke(CHANNELS.libraryAction, action),
  forgetMemory: () => ipcRenderer.invoke(CHANNELS.forgetMemory),
  testAI: () => ipcRenderer.invoke(CHANNELS.testAI),
  getState: () => ipcRenderer.invoke(CHANNELS.getState),
  updateSettings: patch => ipcRenderer.invoke(CHANNELS.updateSettings, patch),
  command: command => ipcRenderer.invoke(CHANNELS.command, command),
  hitTest: interactive => ipcRenderer.send(CHANNELS.hitTest, interactive),
  hover: active => ipcRenderer.send(CHANNELS.hover, active),
  dragStart: point => ipcRenderer.invoke(CHANNELS.dragStart, point),
  dragEnd: () => ipcRenderer.invoke(CHANNELS.dragEnd),
  doubleClick: () => ipcRenderer.send(CHANNELS.doubleClick),
  contextMenu: () => ipcRenderer.send(CHANNELS.contextMenu),
  dismissBubble: () => ipcRenderer.send(CHANNELS.dismissBubble),
  animationComplete: animation => ipcRenderer.send(CHANNELS.animationComplete, animation),
  onState: callback => subscribe<CompanionState>(CHANNELS.state, callback),
  onCursor: callback => subscribe<CursorUpdate>(CHANNELS.cursor, callback),
  onPosition: callback => subscribe<Point>(CHANNELS.position, callback),
};
contextBridge.exposeInMainWorld('ducky', api);
