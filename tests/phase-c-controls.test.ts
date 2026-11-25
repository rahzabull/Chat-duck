import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExpansionSettings } from '../src/renderer/settings/expansion';
import { DuckyTray } from '../src/main/tray';
import { DEFAULT_SETTINGS } from '../src/shared/schemas/settings';
import { SKILL_PACK_IDS, SKILL_PACKS } from '../src/core/skills';
import type { CompanionState } from '../src/shared/types';

vi.mock('electron', () => ({
  nativeImage: { createFromBitmap: () => ({ toPNG: () => Buffer.alloc(1) }), createFromBuffer: () => ({}) },
  Menu: { buildFromTemplate: (template: unknown) => template },
  Tray: class { setToolTip() {} on() {} setContextMenu() {} destroy() {} },
}));
describe('Phase C tray and settings', () => {
  const state = { settings: { ...DEFAULT_SETTINGS, privacyMode: true, skillPack: 'creative' }, mode: 'privacy', dnd: true, brain: { phase: 'disabled' } } as CompanionState;
  it('routes every duration, privacy toggle and independent skill pack selection', () => {
    const command = vi.fn(), settings = vi.fn(); const tray = new DuckyTray(() => state, command, settings);
    type Item = { label: string; checked?: boolean; submenu?: Item[]; click?: () => void };
    const menu = tray.menu() as unknown as Item[];
    expect(menu[0].label).toBe('Mode: privacy');
    const dnd = menu.find(i => i.label.startsWith('Do not disturb'))!;
    for (const item of dnd.submenu!) item.click!();
    expect(command.mock.calls.map(c => c[0])).toEqual(['dnd-30', 'dnd-60', 'dnd-until-off', 'dnd-off']);
    const privacy = menu.find(i => i.label === 'Privacy mode')!; expect(privacy.checked).toBe(true); privacy.click!();
    expect(command).toHaveBeenLastCalledWith('privacy');
    const packs = menu.find(i => i.label === 'Skill pack')!.submenu!;
    expect(packs.map(p => p.label)).toEqual(SKILL_PACK_IDS.map(id => SKILL_PACKS[id].label));
    expect(packs.find(p => p.label === 'Creative')?.checked).toBe(true);
    packs.find(p => p.label === 'Developer')!.click!(); expect(settings).toHaveBeenCalledWith({ skillPack: 'developer' });
    tray.dispose();
  });
  it('renders mode controls, quiet windows, proactive opt-outs and separate skill cards', () => {
    const html = renderToStaticMarkup(createElement(ExpansionSettings, { state, save: () => {} }));
    for (const text of ['Current mode: privacy', 'Windows notification only', 'Stay visible, freeze animations', 'Quiet hours start', 'Briefing window ends', 'Evening summary after 18:00', 'Deadline and overdue nudges']) expect(html).toContain(text);
    for (const pack of Object.values(SKILL_PACKS)) expect(html).toContain(pack.description);
    expect(html.match(/name="skill-pack"/g)).toHaveLength(5);
  });
});
