import { createElement as h, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { CATEGORIES, type LibraryAction, type UserMemory, type Category } from '../../core/conversation/types';
import { flipPronouns } from '../../core/conversation/intents';
import type { CompanionState, EditableSettings } from '../../shared/types';
function MemoryRow({ memory, act }: { memory: UserMemory; act: (action: LibraryAction) => void }) {
  const [text, setText] = useState(memory.text); const [category, setCategory] = useState(memory.category);
  const [editing, setEditing] = useState(false);
  return h('div', { className: 'memory-row' },
    !editing && h('p', null, flipPronouns(memory.text)),
    !editing && h('button', { onClick: () => setEditing(true) }, 'Edit'),
    editing && h('textarea', { 'aria-label': 'Memory text', rows: 2, maxLength: 4000, value: text, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value) }),
    editing && h('select', { 'aria-label': 'Memory category', value: category, onChange: (e: ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value as Category) }, ...CATEGORIES.map(c => h('option', { key: c, value: c }, c.replace('_', ' ')))),
    editing && h('button', { disabled: !text.trim(), onClick: () => act({ action: 'edit', id: memory.id, text, category }) }, 'Save'),
    h('button', { onClick: () => act({ action: 'delete-memory', id: memory.id }) }, 'Delete'));
}
export function MemoryEditor({ state }: { state: CompanionState }) {
  const [text, setText] = useState(''); const [category, setCategory] = useState<Category>('other'); const [error, setError] = useState('');
  function act(action: LibraryAction): void { setError(''); void window.ducky.libraryAction(action).catch(() => setError('Could not save or delete that memory. Please try again.')); }
  return h('div', null,
    error && h('p', { role: 'alert' }, error),
    ...(state.library?.memories ?? []).map(m => h(MemoryRow, { key: `${m.id}:${m.text}:${m.category}`, memory: m, act })),
    h('fieldset', { disabled: !state.settings.memoryEnabled }, h('legend', null, 'Add a memory'),
      h('textarea', { 'aria-label': 'New memory', placeholder: 'Something you want Ducky to remember', rows: 2, maxLength: 4000, value: text, onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value) }),
      h('select', { 'aria-label': 'New memory category', value: category, onChange: (e: ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value as Category) }, ...CATEGORIES.map(c => h('option', { key: c, value: c }, c.replace('_', ' ')))),
      h('button', { disabled: !text.trim(), onClick: () => { setError(''); void window.ducky.libraryAction({ action: 'add', text, category }).then(() => setText('')).catch(() => setError('Could not save that memory.')); } }, 'Add memory')));
}
export function ConversationSettings({ state, save }: { state: CompanionState; save: (patch: Partial<EditableSettings>) => void }) {
  const [selected, setSelected] = useState(''); const [error, setError] = useState(''); const [deleting, setDeleting] = useState(false);
  const conversations = [...(state.library?.conversations ?? [])].sort((a, b) => b.endedAt - a.endedAt);
  const viewed = conversations.find(c => c.id === selected);
  function act(action: LibraryAction): void { setError(''); void window.ducky.libraryAction(action).catch(() => setError('That archive operation failed. Please try again.')); }
  function record(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Tab') return;
    event.preventDefault();
    const key = event.key.toUpperCase();
    if (!/^(?:[A-Z0-9]|F(?:[1-9]|1[0-2]))$/.test(key)) return;
    const modifiers = [event.ctrlKey ? 'Ctrl' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : '', event.metaKey ? 'Super' : ''].filter(Boolean);
    if (modifiers.length > 0 && modifiers.length <= 3) save({ conversationShortcut: [...modifiers, key].join('+') });
  }
  return h('section', { 'aria-labelledby': 'conversation-settings' }, h('h2', { id: 'conversation-settings' }, 'Conversation'),
    h('button', { onClick: () => { void window.ducky.command('talk'); } }, 'Talk to Ducky'),
    h('label', { htmlFor: 'shortcut' }, 'Conversation shortcut (press a key combination)'),
    h('input', { id: 'shortcut', readOnly: true, value: state.settings.conversationShortcut, onKeyDown: record }),
    state.conversation?.shortcutError && h('p', { role: 'alert' }, state.conversation.shortcutError),
    h('label', { htmlFor: 'retention' }, 'Conversation retention'),
    h('select', { id: 'retention', value: state.settings.conversationRetention, onChange: (e: ChangeEvent<HTMLSelectElement>) => save({ conversationRetention: e.target.value as EditableSettings['conversationRetention'] }) },
      ...['off', '7 days', '30 days'].map(r => h('option', { key: r, value: r }, r))),
    h('p', { className: 'hint' }, 'Double-click Ducky to talk. Enter sends, Shift+Enter adds a line, Esc ends. Only the current reply appears beside him. Memory off deletes the archive too.'),
    h('h3', null, 'Conversation archive'), error && h('p', { role: 'alert' }, error),
    !conversations.length && h('p', null, 'No saved conversations.'),
    ...conversations.map(c => h('article', { key: c.id, className: 'archive-row' },
      h('time', { dateTime: new Date(c.endedAt).toISOString() }, new Date(c.endedAt).toLocaleString()),
      h('p', null, c.summary ?? c.topics?.join(', ') ?? 'Conversation'),
      h('button', { onClick: () => setSelected(c.id) }, 'View'), h('button', { onClick: () => act({ action: 'export', id: c.id }) }, 'Export .txt'),
      h('button', { onClick: () => act({ action: 'delete-conversation', id: c.id }) }, 'Delete'))),
    conversations.length > 0 && h('button', { onClick: () => setDeleting(true) }, 'Delete all conversations'),
    deleting && h('div', { role: 'alert' }, 'Delete every saved conversation?',
      h('button', { onClick: () => { act({ action: 'delete-conversations' }); setDeleting(false); setSelected(''); } }, 'Delete all'),
      h('button', { onClick: () => setDeleting(false) }, 'Cancel')),
    viewed && h('div', { className: 'archive-view', role: 'region', 'aria-label': 'Archived conversation' },
      h('button', { onClick: () => setSelected('') }, 'Close archive view'),
      ...viewed.turns.map((t, i) => h('p', { key: i, style: { whiteSpace: 'pre-wrap' } }, h('strong', null, t.role === 'user' ? 'You: ' : 'Ducky: '), t.text))));
}
