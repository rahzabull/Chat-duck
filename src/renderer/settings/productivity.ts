import { createElement as h, useState, type ChangeEvent } from 'react';
import type { CompanionState } from '../../shared/types';
export function ProductivitySettings({ state }: { state: CompanionState }) {
  const [message, setMessage] = useState(''); const [confirmation, setConfirmation] = useState<{ token: string; name: string }>();
  const settings = state.productivity?.settings; if (!settings) return null;
  async function run(name: string, args: Record<string, unknown> = {}, token?: string) {
    try { const result = await window.ducky.productivity({ name, args, token }); setMessage(result.message); setConfirmation(result.token ? { token: result.token, name } : undefined); }
    catch { setMessage('Could not complete that change.'); }
  }
  return h('section', { 'aria-labelledby': 'productivity-settings' }, h('h2', { id: 'productivity-settings' }, 'Productivity'),
    h('p', null, 'Reminders only fire while Ducky is running. There is no OS-level scheduling yet. After sleep or restart, missed reminders appear once. Keep Ducky in the tray for reminders.'),
    ...([['notifications', 'Windows notifications for reminders'], ['autoBreak', 'Automatically start a break after focus'], ['keepHistory', 'Keep focus session history (off by default)']] as const).map(([key, label]) => h('label', { key, className: 'check' }, h('input', { type: 'checkbox', checked: settings[key], onChange: (e: ChangeEvent<HTMLInputElement>) => { void run('settings', { [key]: e.target.checked }); } }), label)),
    ...([['defaultSnooze', 'Default snooze (minutes)'], ['focusMinutes', 'Focus duration (minutes)'], ['shortMinutes', 'Short break (minutes)'], ['longMinutes', 'Long break after four sessions (minutes)']] as const).map(([key, label]) => h('label', { key }, label, h('input', { type: 'number', min: .05, max: 1440, step: .05, defaultValue: settings[key], key: settings[key], onBlur: (e: ChangeEvent<HTMLInputElement>) => { const n = Number(e.target.value); if (n >= .05 && n <= 1440) void run('settings', { [key]: n }); else setMessage('Use a duration from 0.05 to 1440 minutes.'); } }))),
    h('p', null, 'Tasks, reminders and notes are your data. Forget everything does not delete them. Turning off focus history deletes its saved entries.'),
    ...(['tasks', 'reminders', 'notes'] as const).map(kind => h('div', { key: kind },
      h('button', { type: 'button', onClick: () => { void run(`delete_all_${kind}`); } }, `Delete all ${kind}`),
      ...(['json', 'txt'] as const).map(format => h('button', { key: format, type: 'button', onClick: () => { void run('export', { kind, format }); } }, `Export ${kind} .${format}`)))),
    h('p', { role: 'status' }, message),
    confirmation && h('div', { role: 'alert' }, h('p', null, 'Permanently delete these items?'), h('button', { type: 'button', onClick: () => { void run(confirmation.name, {}, confirmation.token); } }, 'Confirm deletion'), h('button', { type: 'button', onClick: () => { setConfirmation(undefined); setMessage('Cancelled.'); } }, 'Cancel')));
}
