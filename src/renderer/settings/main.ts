import { createElement as h, useEffect, useState, type ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { Command, CompanionState, EditableSettings } from '../../shared/types';
import './style.css';

function SettingsApp() {
  const [state, setState] = useState<CompanionState>();
  const [error, setError] = useState('');
  useEffect(() => {
    const unsubscribe = window.ducky.onState(setState);
    void window.ducky.getState().then(setState).catch(() => setError('Could not load settings. Please restart Ducky.'));
    return unsubscribe;
  }, []);
  function save(patch: Partial<EditableSettings>): void {
    setError('');
    void window.ducky.updateSettings(patch).then(setState).catch(() => setError('That change could not be applied. Please try again.'));
  }
  function command(value: Command): void { void window.ducky.command(value).catch(() => setError('That action could not be completed.')); }
  if (!state) return h('p', { role: 'status' }, error || 'Waking up the settings…');
  const settings = state.settings;
  function check(key: 'alwaysOnTop' | 'desktopOnly' | 'launchAtStartup' | 'walking' | 'reducedMotion' | 'mute', label: string) {
    return h('label', { className: 'check', key },
      h('input', { type: 'checkbox', checked: settings[key], onChange: (event: ChangeEvent<HTMLInputElement>) => save({ [key]: event.target.checked }) }), label);
  }
  return h('main', null,
    h('header', null, h('h1', null, 'Ducky Settings'), h('p', null, 'A small duck. Your rules.')),
    error && h('p', { role: 'alert', className: 'error' }, error),
    h('section', { 'aria-labelledby': 'general' }, h('h2', { id: 'general' }, 'General'),
      check('alwaysOnTop', 'Always on top'), check('desktopOnly', 'Desktop-only mode'),
      h('p', { className: 'hint' }, 'Desktop-only turns off always on top; ordinary windows can cover Ducky.'),
      check('launchAtStartup', 'Launch at startup'),
      h('label', { htmlFor: 'size' }, `Character size — ${settings.characterSize.toFixed(1)}×`),
      h('input', { id: 'size', type: 'range', min: 0.6, max: 1.6, step: 0.1, value: settings.characterSize,
        onChange: (event: ChangeEvent<HTMLInputElement>) => save({ characterSize: Number(event.target.value) }) }),
      h('button', { type: 'button', onClick: () => command('reset') }, 'Reset position')),
    h('section', { 'aria-labelledby': 'behaviour' }, h('h2', { id: 'behaviour' }, 'Behaviour'),
      check('walking', 'Let Ducky walk around'),
      h('label', { htmlFor: 'talkativeness' }, 'Talkativeness'),
      h('select', { id: 'talkativeness', value: settings.talkativeness,
        onChange: (event: ChangeEvent<HTMLSelectElement>) => save({ talkativeness: event.target.value as EditableSettings['talkativeness'] }) },
      h('option', { value: 'quiet' }, 'Quiet'), h('option', { value: 'normal' }, 'Normal'), h('option', { value: 'chatty' }, 'Chatty')),
      h('label', { htmlFor: 'sleep' }, 'Sleep after inactivity (minutes)'),
      h('input', { id: 'sleep', type: 'number', min: 1, max: 120, step: 1, value: settings.idleToSleepMinutes,
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
          const value = Number(event.target.value); if (value >= 1 && value <= 120) save({ idleToSleepMinutes: value });
        } }), check('reducedMotion', 'Reduce motion'),
      h('p', { className: 'hint' }, 'Your system’s reduced-motion preference is also respected.')),
    h('section', { 'aria-labelledby': 'audio' }, h('h2', { id: 'audio' }, 'Audio'),
      check('mute', 'Mute'), h('p', { className: 'hint' }, 'Sound is not implemented in Milestone 1. Mute suppresses low-priority speech bubbles; direct interactions can still receive a reply.')),
    h('section', { 'aria-labelledby': 'about' }, h('h2', { id: 'about' }, 'About'),
      h('p', null, `Ducky.exe ${state.version} · Milestone 1 prototype`), h('p', null, 'Made by Ente'),
      h('p', null, 'Local only. No telemetry. No network access in this build.')),
    h('footer', null,
      h('button', { type: 'button', onClick: () => command(state.visible ? 'hide' : 'show') }, state.visible ? 'Hide Ducky' : 'Show Ducky'),
      h('button', { type: 'button', onClick: () => command('pause') }, state.paused ? 'Resume' : 'Pause'),
      h('button', { type: 'button', onClick: () => command('quit') }, 'Quit Ducky')));
}
createRoot(document.getElementById('root')!).render(h(SettingsApp));
