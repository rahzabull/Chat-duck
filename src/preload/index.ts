import { contextBridge } from 'electron';
contextBridge.exposeInMainWorld('ducky', { version: '0.1.0' });
