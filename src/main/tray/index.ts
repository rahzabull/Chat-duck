import { SKILL_PACK_IDS, SKILL_PACKS } from '../../core/skills';
import { Menu, nativeImage, Tray } from 'electron';
import type { Command, CompanionState, EditableSettings } from '../../shared/types';

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
  constructor(private state: () => CompanionState, private command: (command: Command) => void, private settings: (patch: Partial<EditableSettings>) => void = () => {}) {
    this.tray.setToolTip('Ducky — Made by Ente');
    this.tray.on('click', () => command(state().visible ? 'hide' : 'show'));
    this.refresh();
  }
  menu(): Menu {
    const state = this.state();
    return Menu.buildFromTemplate([
      { label: `Mode: ${state.mode?.replaceAll('_', ' ') ?? 'companion'}`, enabled: false },
      { label: state.dnd ? 'Do not disturb - on' : 'Do not disturb', submenu: [
        { label: '30 minutes', click: () => this.command('dnd-30') },
        { label: '1 hour', click: () => this.command('dnd-60') },
        { label: 'Until I turn it off', click: () => this.command('dnd-until-off') },
        { label: 'Turn off', enabled: state.dnd, click: () => this.command('dnd-off') },
      ] },
      { label: 'Privacy mode', type: 'checkbox', checked: state.settings.privacyMode, click: () => this.command('privacy') },
      { label: 'Skill pack', submenu: SKILL_PACK_IDS.map(id => ({ label: SKILL_PACKS[id].label, type: 'radio' as const, checked: state.settings.skillPack === id, click: () => this.settings({ skillPack: id }) })) },
      { label: 'Talk to Ducky', click: () => this.command('talk') },
      { label: 'Tasks', click: () => this.command('tasks') },
      { label: 'Add task…', click: () => this.command('add-task') },
      { label: 'Add reminder…', click: () => this.command('add-reminder') },
      { label: 'Start focus (25 min)', click: () => this.command('focus') },
      { label: 'Notes', click: () => this.command('notes') },
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
  refresh(): void {
    const brain = this.state().brain;
    this.tray.setToolTip(`Ducky — ${brain.phase === 'connected' ? brain.message : 'Built-in lines active'}`);
    this.tray.setContextMenu(this.menu());
  }
  popup(): void { this.menu().popup(); }
  dispose(): void { this.tray.destroy(); }
}
