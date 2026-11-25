import { ConversationSettings, MemoryEditor } from './conversation';
import { ProductivitySettings } from './productivity';
import { createElement as h, useEffect, useState, type ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import type { Command, CompanionState, EditableSettings } from '../../shared/types';
import { PRESETS } from '../../core/dialogue/presets';
import './style.css';

function SettingsApp() {
  const [state, setState] = useState<CompanionState>();
  const [error, setError] = useState('');
  const [forgetting, setForgetting] = useState(false);
  const [testing, setTesting] = useState(false);
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
  function check(key: 'alwaysOnTop' | 'desktopOnly' | 'launchAtStartup' | 'walking' | 'reducedMotion' | 'mute' | 'appAwareness' | 'aiEnabled' | 'profanity' | 'memoryEnabled', label: string) {
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
    h('section', { 'aria-labelledby': 'behaviour' }, h('h2', { id: 'behaviour' }, 'Personality'),
      ...Object.values(PRESETS).map(preset => h('label', { key: preset.id, className: 'preset-card' }, h('input', { type: 'radio', name: 'personality', value: preset.id, checked: settings.personality === preset.id, onChange: () => save({ personality: preset.id }) }), h('strong', null, preset.label), h('span', null, preset.description))),
      h('p', { className: 'hint' }, `Today's mood: ${state.mood}`),
      h('label', { htmlFor: 'activity-level' }, 'Activity level'),
      h('select', { id: 'activity-level', value: settings.activityLevel, onChange: (event: ChangeEvent<HTMLSelectElement>) => save({ activityLevel: event.target.value as EditableSettings['activityLevel'] }) }, ...['calm', 'normal', 'lively'].map(level => h('option', { key: level, value: level }, level))),
      check('profanity', 'Allow mild swearing'), h('p', { className: 'hint' }, 'Mild swearing only. Never at you.'),
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
    h('section', { 'aria-labelledby': 'brain' }, h('h2', { id: 'brain' }, 'Brain (local AI)'),
      check('aiEnabled', 'Use local AI for conversation and fresh lines'),
      h('p', { className: 'hint' }, 'Runs on this computer through Ollama. Nothing is sent to the internet.'),
      h('label', { htmlFor: 'ai-model' }, 'Installed model'),
      h('select', { id: 'ai-model', disabled: !settings.aiEnabled, value: settings.aiModel,
        onChange: (event: ChangeEvent<HTMLSelectElement>) => save({ aiModel: event.target.value }) },
        h('option', { value: '' }, 'Select a model'),
        settings.aiModel && !state.brain.models.includes(settings.aiModel) && h('option', { value: settings.aiModel }, `${settings.aiModel} (unavailable)`),
        ...state.brain.models.map(model => h('option', { key: model, value: model }, model))),
      h('label', { htmlFor: 'ollama-port' }, 'Ollama port (127.0.0.1 only)'),
      h('input', { id: 'ollama-port', type: 'number', min: 1, max: 65535, step: 1, disabled: !settings.aiEnabled, value: settings.ollamaPort,
        onChange: (event: ChangeEvent<HTMLInputElement>) => {
          const port = Number(event.target.value); if (Number.isInteger(port) && port >= 1 && port <= 65535) save({ ollamaPort: port });
        } }),
      h('button', { type: 'button', disabled: !settings.aiEnabled || testing || state.brain.phase === 'warming' || state.brain.phase === 'suspended', onClick: () => {
        setTesting(true); void window.ducky.testAI().catch(() => setError('Could not test the local connection.')).finally(() => setTesting(false));
      } }, testing ? 'Testing...' : 'Test connection'),
      h('p', { role: 'status' }, state.brain.message),
      state.brain.phase === 'warming' && h('p', { className: 'hint' }, 'Using built-in lines while the model loads (up to 60 seconds).'),
      state.brain.version && h('p', { className: 'hint' }, `Ollama ${state.brain.version}`),
      state.brain.sample && h('p', { className: 'hint' }, `Sample: ${state.brain.sample}`),
      h('p', { className: 'hint' }, 'Install Ollama and pull a model yourself, then test the connection to refresh this list. Ducky never downloads models.')),
    h(ConversationSettings, { state, save }),
    h(ProductivitySettings, { state }),
    h('section', { 'aria-labelledby': 'memory' }, h('h2', { id: 'memory' }, 'Memory'),
      check('memoryEnabled', 'Let Ducky remember things'),
      h('label', { htmlFor: 'preferred-name' }, 'What should Ducky call you?'),
      h('input', { id: 'preferred-name', type: 'text', maxLength: 30, disabled: !settings.memoryEnabled, defaultValue: settings.preferredName, key: settings.preferredName, onBlur: (event: ChangeEvent<HTMLInputElement>) => save({ preferredName: event.target.value }) }),
      h(MemoryEditor, { state }),
      h('h3', null, 'Interaction memories'),
      h('ul', null, ...state.memory.map(line => h('li', { key: line }, line))),
      h('p', { className: 'hint' }, 'Your explicit memories, retained conversations, interactions with Ducky and the name you enter. No desktop observations or screen data. Pickup counts roll off after seven days; totals and notable moments stay until forgotten. Turning memory off deletes them and your name.'),
      h('button', { type: 'button', onClick: () => setForgetting(true) }, 'Forget everything'),
      forgetting && h('div', { role: 'alert' }, h('p', null, 'Forget all memories, conversation archives, interaction stats and your preferred name?'),
        h('button', { type: 'button', onClick: () => { void window.ducky.forgetMemory().then(next => { setState(next); setForgetting(false); }).catch(() => setError('Could not delete memory. Please try again.')); } }, 'Yes, forget everything'),
        h('button', { type: 'button', onClick: () => setForgetting(false) }, 'Cancel'))),
    h('section', { 'aria-labelledby': 'privacy' }, h('h2', { id: 'privacy' }, 'Privacy'),
      check('appAwareness', 'Let Ducky notice which app is in front'),
      h('p', { className: 'hint' }, "Ducky checks the name of the app in front every few seconds (like 'Chrome' or 'Figma') so he can comment on it. He never reads window titles, web pages, or screen contents. When local AI is enabled, the app name can go to Ollama on this computer. Recent lines stay temporarily in memory. Some apps are always ignored (password managers, banking, messaging)."),
      h('p', { role: 'status', className: 'hint' }, state.awarenessActive ? '● App awareness active' : settings.appAwareness ? 'App awareness waiting or paused' : 'App awareness off')),
    h('section', { 'aria-labelledby': 'audio' }, h('h2', { id: 'audio' }, 'Audio'),
      check('mute', 'Mute'), h('p', { className: 'hint' }, 'Sound is not implemented. Mute suppresses low-priority speech bubbles; direct interactions can still receive a reply.')),
    h('section', { 'aria-labelledby': 'about' }, h('h2', { id: 'about' }, 'About'),
      h('p', null, `Ducky.exe ${state.version} · Curated companion prototype`), h('p', null, 'Made by Ente'),
      h('p', null, 'Local only. No telemetry. Optional AI connects only to Ollama on this computer.')),
    h('footer', null,
      h('button', { type: 'button', onClick: () => command(state.visible ? 'hide' : 'show') }, state.visible ? 'Hide Ducky' : 'Show Ducky'),
      h('button', { type: 'button', onClick: () => command('pause') }, state.paused ? 'Resume' : 'Pause'),
      h('button', { type: 'button', onClick: () => command('quit') }, 'Quit Ducky')));
}
createRoot(document.getElementById('root')!).render(h(SettingsApp));
