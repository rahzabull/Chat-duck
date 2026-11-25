import { createElement as h, type ChangeEvent } from 'react';
import type { CompanionState, EditableSettings } from '../../shared/types';
import { SKILL_PACK_IDS, SKILL_PACKS } from '../../core/skills';

export function ExpansionSettings({ state, save }: { state: CompanionState; save: (patch: Partial<EditableSettings>) => void }) {
  const s = state.settings;
  const check = (key: 'privacyMode' | 'quietHoursEnabled' | 'morningBriefing' | 'eveningSummary' | 'deadlineNudges' | 'assistanceOffers', label: string) => h('label', { className: 'check', key },
    h('input', { type: 'checkbox', checked: s[key], onChange: (e: ChangeEvent<HTMLInputElement>) => save({ [key]: e.target.checked }) }), label);
  const time = (key: 'quietHoursStart' | 'quietHoursEnd' | 'briefingStart' | 'briefingEnd', label: string) => h('label', { key }, label,
    h('input', { type: 'time', value: s[key], onChange: (e: ChangeEvent<HTMLInputElement>) => { if (e.target.value) save({ [key]: e.target.value }); } }));
  return h('div', null,
    h('section', { 'aria-labelledby': 'modes' }, h('h2', { id: 'modes' }, 'Modes'),
      h('p', { role: 'status' }, `Current mode: ${state.mode?.replaceAll('_', ' ') ?? 'companion'}`),
      h('label', { className: 'check' }, h('input', { type: 'checkbox', checked: !!state.dnd, onChange: (e: ChangeEvent<HTMLInputElement>) => save({ dndUntil: e.target.checked ? -1 : 0 }) }), 'Do not disturb'),
      h('div', { className: 'mode-durations' }, ...[30, 60].map(minutes => h('button', { key: minutes, onClick: () => save({ dndUntil: Date.now() + minutes * 60000 }) }, `${minutes} minutes`))),
      state.dnd && h('p', { className: 'hint' }, s.dndUntil === -1 ? 'Until you turn it off.' : `Quiet until ${new Date(s.dndUntil).toLocaleTimeString()}.`),
      check('privacyMode', 'Privacy mode'),
      h('p', { className: 'hint' }, 'Stops app identity collection and clears temporary app context and related AI history. Geometry-only fullscreen detection continues. Your saved tasks and conversations stay local.'),
      h('label', null, 'During fullscreen / gaming', h('select', { value: s.gamingBehaviour, onChange: (e: ChangeEvent<HTMLSelectElement>) => save({ gamingBehaviour: e.target.value as EditableSettings['gamingBehaviour'] }) },
        h('option', { value: 'hide' }, 'Hide Ducky'), h('option', { value: 'freeze' }, 'Stay visible, freeze animations'))),
      h('label', null, 'Reminders during do not disturb', h('select', { value: s.dndReminders, onChange: (e: ChangeEvent<HTMLSelectElement>) => save({ dndReminders: e.target.value as EditableSettings['dndReminders'] }) },
        h('option', { value: 'notification' }, 'Windows notification only'), h('option', { value: 'bubble' }, 'Allow reminder bubble and card'))),
      check('quietHoursEnabled', 'Quiet hours for proactive speech'), time('quietHoursStart', 'Quiet hours start'), time('quietHoursEnd', 'Quiet hours end')),
    h('section', { 'aria-labelledby': 'proactive' }, h('h2', { id: 'proactive' }, 'Proactive help'),
      check('morningBriefing', 'Morning briefing'), time('briefingStart', 'Briefing window starts (after 05:00)'), time('briefingEnd', 'Briefing window ends'),
      check('eveningSummary', 'Evening summary after 18:00'), check('deadlineNudges', 'Deadline and overdue nudges'), check('assistanceOffers', 'Occasional assistance offers'),
      h('p', { className: 'hint' }, 'Offers need app awareness and time in a supported app. No backs off for three hours. Mute silences proactive speech; quiet hours and focus keep it quiet too.')),
    h('section', { 'aria-labelledby': 'skill-pack' }, h('h2', { id: 'skill-pack' }, 'Skill pack'),
      h('p', { className: 'hint' }, 'What Ducky helps with. His personality is a separate choice.'),
      ...SKILL_PACK_IDS.map(id => h('label', { key: id, className: 'preset-card' },
        h('input', { type: 'radio', name: 'skill-pack', checked: s.skillPack === id, onChange: () => save({ skillPack: id }) }),
        h('strong', null, SKILL_PACKS[id].label), h('span', null, SKILL_PACKS[id].description)))));
}
