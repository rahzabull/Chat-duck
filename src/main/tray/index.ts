import { Menu, nativeImage, Tray } from 'electron';
import type { Command, CompanionState } from '../../shared/types';

function duckIcon(): Electron.NativeImage {
  const size = 32; const bitmap = Buffer.alloc(size * size * 4);
  const ellipse = (cx: number, cy: number, rx: number, ry: number, color: number[]): void => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) {
        const offset = (y * size + x) * 4;
        bitmap[offset] = color[2]; bitmap[offset + 1] = color[1]; bitmap[offset + 2] = color[0]; bitmap[offset + 3] = 255;
      }
    }
  };
  ellipse(15, 23, 12, 8, [255, 211, 52]); ellipse(17, 13, 9, 9, [255, 221, 64]);
  ellipse(26, 16, 5, 3, [247, 135, 35]); ellipse(16, 5, 8, 4, [40, 132, 70]);
  ellipse(21, 11, 2, 2, [28, 34, 28]);
  const png = nativeImage.createFromBitmap(bitmap, { width: size, height: size }).toPNG();
  return nativeImage.createFromBuffer(png);
}
export class DuckyTray {
  private tray = new Tray(duckIcon());
  constructor(private state: () => CompanionState, private command: (command: Command) => void) {
    this.tray.setToolTip('Ducky — Made by Ente');
    this.tray.on('click', () => command(state().visible ? 'hide' : 'show'));
    this.refresh();
  }
  menu(): Menu {
    const state = this.state();
    return Menu.buildFromTemplate([
      { label: 'Show Ducky', enabled: !state.visible, click: () => this.command('show') },
      { label: 'Hide Ducky', enabled: state.visible, click: () => this.command('hide') },
      { label: state.paused ? 'Resume' : 'Pause', click: () => this.command('pause') },
      { label: state.settings.mute ? 'Unmute' : 'Mute', click: () => this.command('mute') },
      { type: 'separator' },
      { label: 'Reset position', click: () => this.command('reset') },
      { label: 'Settings…', click: () => this.command('settings') },
      { type: 'separator' }, { label: 'Quit', click: () => this.command('quit') },
    ]);
  }
  refresh(): void { this.tray.setContextMenu(this.menu()); }
  popup(): void { this.menu().popup(); }
  dispose(): void { this.tray.destroy(); }
}
