import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerIPC } from '../src/main/ipc';
import { CHANNELS } from '../src/shared/constants';
import { ConversationController } from '../src/main/conversation/controller';
import { ConversationStore } from '../src/main/conversation/store';
import type { CompanionController } from '../src/main/companion/CompanionController';
import type { CompanionState } from '../src/shared/types';
import { DEFAULT_SETTINGS } from '../src/shared/schemas/settings';
import { TALK_LINES } from '../src/core/dialogue/lines';
const driver = vi.hoisted(() => ({ generate: vi.fn(), cancel: vi.fn(), register: vi.fn((_shortcut: string, _callback: () => void) => true), unregister: vi.fn(), focused: true }));
vi.mock('../src/main/windows', () => ({ isTrustedFrame: () => true }));
const ipc = vi.hoisted(() => ({ handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn(), removeListener: vi.fn() }));
vi.mock('electron', () => ({ ipcMain: ipc, clipboard: { writeText: vi.fn() }, dialog: { showSaveDialog: vi.fn(async () => ({ canceled: true })) }, globalShortcut: { register: driver.register, unregister: driver.unregister } }));
vi.mock('../src/ai/ollama', () => ({ OllamaError: class extends Error { reason = 'Not running'; }, OllamaProvider: class { generate = driver.generate; cancel = driver.cancel; } }));
let directory: string; let service: ConversationController; let store: ConversationStore;
function setup(aiEnabled = false) {
  const calls: string[] = [];
  const call = (name: string) => vi.fn(() => { calls.push(name); });
  const window = Object.assign(new EventEmitter(), { calls, setFocusable: vi.fn((value: boolean) => { calls.push(`focusable:${value}`); }), focus: call('focus'), show: call('show'), hide: call('hide'), showInactive: call('showInactive'), setAlwaysOnTop: vi.fn((_value: boolean, _level: string) => { calls.push('topmost'); }), moveTop: call('moveTop'), webContents: { focus: call('contents.focus') }, isFocused: () => driver.focused });
  const companion = { state: { settings: { ...DEFAULT_SETTINGS, aiEnabled, aiModel: 'qwen3:8b' } } as CompanionState, window,
    releaseConversationFocus: vi.fn(() => { window.setFocusable(false); window.hide(); window.showInactive(); window.setAlwaysOnTop(companion.state.settings.alwaysOnTop && !companion.state.settings.desktopOnly, 'screen-saver'); }),
    setConversationInference: vi.fn(), beginConversation: vi.fn(), finishConversation: vi.fn(), muteFor: vi.fn(),
    presentConversation: vi.fn((view: NonNullable<CompanionState['conversation']>) => { companion.state.conversation = view; calls.push(view.inputReady ? 'renderer:focus' : 'renderer:waiting'); }),
  };
  store = new ConversationStore(directory, true, '7 days'); service = new ConversationController(companion as unknown as CompanionController, store);
  return companion;
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); driver.focused = true; driver.register.mockReturnValue(true);
  driver.generate.mockReset(); directory = mkdtempSync(join(tmpdir(), 'ducky-talk-'));
});
afterEach(() => { service?.dispose(); rmSync(directory, { recursive: true, force: true }); vi.useRealTimers(); });
describe('conversation main controller', () => {
  it.each(['Esc', 'bye', 'blur-timeout', 'inactivity-timeout'])('uses the same complete close path for %s', async path => {
    const companion = setup(); service.open();
    const end = vi.spyOn(service, 'end');
    companion.window.calls.length = 0;
    if (path === 'Esc') {
      // Escape's talkEnd IPC uses the same controller path as the other exits.
      const cleanup = registerIPC(companion as unknown as CompanionController, () => undefined, () => {}, () => {}, service);
      const frame = { url: 'file:///companion/index.html' };
      Object.assign(companion.window.webContents, { mainFrame: frame });
      const handler = ipc.handle.mock.calls.find(([channel]) => channel === CHANNELS.talkEnd)![1];
      handler({ sender: companion.window.webContents, senderFrame: frame }, undefined);
      cleanup();
    } else if (path === 'bye') await service.send('bye');
    else if (path === 'blur-timeout') { companion.window.emit('blur'); await vi.advanceTimersByTimeAsync(20000); }
    else await vi.advanceTimersByTimeAsync(90000);
    expect(end).toHaveBeenCalledOnce(); expect(companion.releaseConversationFocus).toHaveBeenCalledOnce();
    const calls = companion.window.calls.filter(c => !c.startsWith('renderer:'));
    expect(calls.slice(-4)).toEqual(['focusable:false', 'hide', 'showInactive', 'topmost']);
    expect(companion.window.setAlwaysOnTop).toHaveBeenLastCalledWith(true, 'screen-saver');
    expect(companion.state.conversation).toMatchObject({ active: false, inputReady: false, focusFailed: false, panel: false, forceBubble: false });
    await vi.advanceTimersByTimeAsync(3100);
    expect(companion.state.conversation).toMatchObject({ state: null, reply: '' });
    expect(companion.finishConversation).toHaveBeenCalledOnce();
  });
  it('keeps local intents out of inference and later model history with AI enabled', async () => {
    const companion = setup(true); service.open();
    await service.send('remember that I prefer working at night');
    await service.send('remember that my favourite colour is green');
    await service.send('what do you remember about me?');
    expect(companion.state.conversation?.reply).toContain('your favourite colour is green');
    expect(store.memories[1].text).toBe('my favourite colour is green');
    await service.send('forget that');
    const revision = companion.state.conversation!.revision;
    await vi.advanceTimersByTimeAsync(16000);
    expect(driver.generate).not.toHaveBeenCalled(); expect(companion.state.conversation!.revision).toBe(revision);
    driver.generate.mockResolvedValueOnce(JSON.stringify({ reply: 'Hello.', tone: 'warm', tool: null }));
    await service.send('Hello');
    const turns = driver.generate.mock.calls[0][0].messages.slice(1);
    expect(turns).toEqual([{ role: 'user', content: 'Hello' }]);
  });
  it('does not ask the model to summarize a session of local commands', async () => {
    setup(true); service.open(); await service.send('remember that I prefer tea'); await service.send('forget that'); await service.send('bye');
    await vi.advanceTimersByTimeAsync(16000); expect(driver.generate).not.toHaveBeenCalled();
  });
  it('a local forget cancels an older reply even when its provider ignores abort', async () => {
    const companion = setup(true); service.open(); await service.send('remember that I prefer working at night');
    let resolve!: (s: string) => void;
    driver.generate.mockImplementationOnce(() => new Promise<string>(r => { resolve = r; }));
    const pending = service.send('Tell me something'); await service.send('forget that');
    resolve(JSON.stringify({ reply: 'May I forget?', tone: 'unsure', tool: { name: 'forget', args: { query: 'I prefer working at night' } } }));
    await pending; await vi.advanceTimersByTimeAsync(16000);
    expect(companion.state.conversation?.reply).toBe('Forgot that you prefer working at night.');
    expect(driver.generate).toHaveBeenCalledOnce(); expect(store.memories).toEqual([]);
  });
  it.each([false, true])('discards a late reply after close (reopened=%s)', async reopened => {
    const companion = setup(true); service.open();
    let resolve!: (s: string) => void;
    driver.generate.mockImplementationOnce(() => new Promise<string>(r => { resolve = r; }));
    const pending = service.send('Explain the stars'); service.end(false);
    if (reopened) service.open();
    const view = { ...companion.state.conversation };
    resolve(JSON.stringify({ reply: 'STALE ANSWER', tone: 'warm', tool: null })); await pending;
    expect(companion.state.conversation).toEqual(view);
  });
  it.each(['Here: {"query":"tea"}', '[1, 2]', 'Use recall_memories', 'forget({query: tea})'])('guards final prose %s before publishing', async reply => {
    const companion = setup(true); driver.generate.mockResolvedValueOnce(JSON.stringify({ reply, tone: 'warm', tool: null }));
    service.open(); await service.send('Hello'); expect(TALK_LINES.talk_error).toContain(companion.state.conversation?.reply);
  });
  it('authors a forget confirmation and flips the completed result', async () => {
    const companion = setup(true); store.add('I prefer working at night'); service.open();
    driver.generate.mockResolvedValueOnce(JSON.stringify({ reply: 'Ignore this model prose', tone: 'warm', tool: { name: 'forget', args: { query: 'I prefer working at night' } } }));
    await service.send('Remove my night preference please');
    expect(companion.state.conversation?.reply).toBe("Forget 'you prefer working at night'? Reply yes or no.");
    expect(store.memories).toHaveLength(1); await service.send('yes');
    expect(companion.state.conversation?.reply).toBe('Forgot that you prefer working at night.');
    expect(store.memories).toEqual([]); expect(driver.generate).toHaveBeenCalledOnce();
  });
  it('activates synchronously inside the shortcut callback, yields focus on close and clears timers', async () => {
    const companion = setup(); expect(driver.register).toHaveBeenCalledWith('Ctrl+Alt+D', expect.any(Function));
    companion.window.calls.length = 0;
    driver.register.mock.calls[0][1](); // Assert before yielding even one microtask.
    expect(companion.window.calls.slice(0, 4)).toEqual(['focusable:true', 'show', 'focus', 'contents.focus']);
    expect(companion.window.calls.indexOf('renderer:focus')).toBeGreaterThan(3);
    expect(companion.state.conversation?.inputReady).toBe(true);
    companion.window.calls.length = 0;
    service.end(); expect(companion.window.calls.slice(0, 4)).toEqual(['focusable:false', 'hide', 'showInactive', 'topmost']);
    await vi.advanceTimersByTimeAsync(3100); expect(companion.finishConversation).toHaveBeenCalledOnce();
    service.dispose(); expect(driver.unregister).toHaveBeenCalledWith('Ctrl+Alt+D'); expect(vi.getTimerCount()).toBe(0);
  });
  it('does not steal focus back when the user has already selected another app', async () => {
    const companion = setup(); service.open(); companion.window.focus.mockClear(); driver.focused = false; service.end();
    expect(companion.window.focus).not.toHaveBeenCalled(); expect(companion.window.showInactive).toHaveBeenCalledOnce();
  });
  it('retries once after 300ms, keeps the input hidden on failure, and accepts a later click', async () => {
    const companion = setup(); driver.focused = false; service.open();
    expect(companion.state.conversation?.inputReady).toBe(false);
    await vi.advanceTimersByTimeAsync(299); expect(companion.window.moveTop).not.toHaveBeenCalled();
    companion.window.calls.length = 0;
    await vi.advanceTimersByTimeAsync(1);
    expect(companion.window.calls.slice(0, 4)).toEqual(['topmost', 'moveTop', 'focus', 'contents.focus']);
    expect(companion.window.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
    await vi.advanceTimersByTimeAsync(1000);
    expect(companion.window.focus).toHaveBeenCalledTimes(2); expect(companion.state.conversation?.inputReady).toBe(false);
    await service.send('Hello'); expect(driver.generate).not.toHaveBeenCalled();
    driver.focused = true; companion.window.emit('focus');
    expect(companion.state.conversation?.inputReady).toBe(false); // Failed activation requires an explicit duck/bubble click.
    companion.window.calls.length = 0; service.open();
    expect(companion.window.calls.slice(0, 4)).toEqual(['focusable:true', 'show', 'focus', 'contents.focus']);
    expect(companion.state.conversation?.inputReady).toBe(true);
  });
  it('reveals the input when the single retry succeeds and restores the topmost preference', async () => {
    const companion = setup(); companion.state.settings.alwaysOnTop = false; driver.focused = false;
    companion.window.focus.mockImplementationOnce(() => {}).mockImplementationOnce(() => { driver.focused = true; companion.window.emit('focus'); });
    service.open(); await vi.advanceTimersByTimeAsync(300);
    expect(companion.state.conversation?.inputReady).toBe(true);
    await vi.advanceTimersByTimeAsync(300); expect(companion.window.setAlwaysOnTop).toHaveBeenLastCalledWith(false, 'screen-saver');
  });
  it('cancels the focus retry on close', async () => {
    const companion = setup(); driver.focused = false; service.open(); service.end();
    await vi.advanceTimersByTimeAsync(1000); expect(companion.window.moveTop).not.toHaveBeenCalled();
  });
  it.each(['a', 'é', 'e\u0301', '你', '1', '123', '?!', '🦆', '\u200b', 'a\u200b', 'a   ', 'a\u034f'])('uses an authored clarification without inference for %j', async text => {
    const companion = setup(true); service.open(); await service.send(text);
    expect(TALK_LINES.talk_huh).toContain(companion.state.conversation?.reply); expect(driver.generate).not.toHaveBeenCalled();
  });
  it.each(['hi', '你好', 'éé'])('still sends a meaningful short message %s to the model', async text => {
    const companion = setup(true); driver.generate.mockResolvedValueOnce(JSON.stringify({ reply: 'Hello there.', tone: 'warm', tool: null }));
    service.open(); await service.send(text); expect(driver.generate).toHaveBeenCalledOnce(); expect(companion.state.conversation?.reply).toBe('Hello there.');
  });
  it('reports shortcut registration conflicts', () => {
    driver.register.mockReturnValue(false); const companion = setup(); expect(companion.state.conversation?.shortcutError).toContain('unavailable');
  });
  it('closes after 20 seconds of continuous blur and cancels blur timeout on refocus', async () => {
    const companion = setup(); await service.open(); companion.window.emit('blur');
    await vi.advanceTimersByTimeAsync(19000); expect(companion.state.conversation?.active).toBe(true);
    companion.window.emit('focus'); await vi.advanceTimersByTimeAsync(5000); expect(companion.state.conversation?.active).toBe(true);
    companion.window.emit('blur'); await vi.advanceTimersByTimeAsync(20001); expect(companion.state.conversation?.active).toBe(false);
  });
  it('resets 90-second inactivity on typing and closes afterwards', async () => {
    const companion = setup(); await service.open(); await vi.advanceTimersByTimeAsync(80000); service.typing();
    await vi.advanceTimersByTimeAsync(80000); expect(companion.state.conversation?.active).toBe(true);
    await vi.advanceTimersByTimeAsync(10001); expect(companion.state.conversation?.active).toBe(false);
  });
  it('completes remember / recall / forget without AI and only after successful disk writes', async () => {
    const companion = setup(); await service.open();
    await service.send('remember that I prefer working at night'); expect(store.memories[0].text).toBe('I prefer working at night'); expect(companion.state.conversation?.reply).toContain('you prefer');
    await service.send('what do you remember about me?'); expect(companion.state.conversation?.panel).toBe(true); expect(companion.state.conversation?.reply).toContain('working at night');
    await service.send('forget that'); expect(store.memories).toEqual([]); expect(companion.state.conversation?.reply).toBe('Forgot that you prefer working at night.'); expect(driver.generate).not.toHaveBeenCalled();
    mkdirSync(join(directory, 'memories.json.tmp')); await service.send('remember that I prefer tea'); expect(companion.state.conversation?.reply).not.toContain("I'll remember"); expect(store.memories).toEqual([]);
  });
  it('disambiguates multiple matches and respects none / number / all', async () => {
    const companion = setup(); await service.open(); store.add('night writing'); store.add('night coding');
    await service.send('forget about night'); expect(store.memories).toHaveLength(2); expect(companion.state.conversation?.forceBubble).toBe(true);
    await service.send('none'); expect(store.memories).toHaveLength(2);
    await service.send('forget night'); await service.send('2'); expect(store.memories.map(m => m.text)).toEqual(['night writing']);
    store.add('night reading'); await service.send('forget night'); await service.send('all'); expect(store.memories).toEqual([]);
  });
  it('uses recent topics offline, mutes, ends and persists the conversation', async () => {
    const companion = setup(); const now = Date.now(); store.saveConversation({ id: 'prior', startedAt: now, endedAt: now, turns: [], topics: ['campaign', 'winter', 'Christmas'] });
    await service.open(); await service.send('what were we talking about earlier?'); expect(companion.state.conversation?.reply).toContain('Christmas');
    await service.send('be quiet for an hour'); expect(companion.muteFor).toHaveBeenCalledWith(60);
    await service.send('bye'); expect(companion.state.conversation?.active).toBe(false); expect(store.conversations).toHaveLength(2);
  });
  it('keeps conversation available when memory is disabled without storing turns', async () => {
    const companion = setup(); companion.state.settings.memoryEnabled = false; service.configure(); await service.open();
    await service.send('remember tea'); expect(companion.state.conversation?.reply).toContain('Memory is off');
    await service.send('hello'); expect(companion.state.conversation?.reply.length).toBeGreaterThan(0);
    service.end(); expect(store.memories).toEqual([]); expect(store.conversations).toEqual([]);
  });
  it('shows thinking once after eight seconds and interrupts without publishing stale answers', async () => {
    const companion = setup(true); let resolve!: (s: string) => void;
    driver.generate.mockImplementationOnce(() => new Promise<string>(r => { resolve = r; }));
    await service.open(); const pending = service.send('Explain something');
    expect(companion.state.conversation?.state).toBe('thinking'); expect(companion.state.conversation?.reply).toBe('');
    await vi.advanceTimersByTimeAsync(8000); const revision = companion.state.conversation!.revision;
    expect(companion.state.conversation?.reply).not.toBe(''); await vi.advanceTimersByTimeAsync(1000); expect(companion.state.conversation?.revision).toBe(revision);
    service.typing(); expect(companion.state.conversation?.state).toBe('interrupted');
    resolve(JSON.stringify({ reply: 'STALE', tone: 'neutral', tool: null })); await pending;
    expect(companion.state.conversation?.reply).not.toContain('STALE'); await vi.advanceTimersByTimeAsync(350); expect(companion.state.conversation?.state).toBe('listening');
  });
  it('requires a user yes for model-requested memories and reports the result locally', async () => {
    const companion = setup(true);
    driver.generate.mockResolvedValueOnce(JSON.stringify({ reply: 'Saved already', tone: 'warm', tool: { name: 'remember', args: { text: 'tea', category: 'preference' } } })).mockResolvedValueOnce(JSON.stringify({ reply: 'Saved tea.', tone: 'warm', tool: null }));
    await service.open(); await service.send('Can you keep this preference?'); expect(store.memories).toEqual([]); expect(companion.state.conversation?.reply).toContain('yes or no');
    await service.send('yes'); expect(store.memories[0].text).toBe('tea'); expect(companion.state.conversation?.reply).toBe('Saved: tea');
    expect(driver.generate).toHaveBeenCalledOnce();
  });
  it('ignores late summaries after forgetting everything', async () => {
    setup(true); driver.generate.mockResolvedValueOnce(JSON.stringify({ reply: 'Hello.', tone: 'warm', tool: null }));
    await service.open(); await service.send('Hello'); let resolve!: (s: string) => void;
    driver.generate.mockImplementationOnce(() => new Promise<string>(r => { resolve = r; })); service.end();
    service.forgetEverything(); resolve(JSON.stringify({ summary: 'Old private text', topics: ['old', 'private', 'text'] }));
    await vi.advanceTimersByTimeAsync(1000); expect(store.conversations).toEqual([]); expect(store.memories).toEqual([]);
  });
  it('keeps ambient inference suspended until the summary completes', async () => {
    const companion = setup(true); driver.generate.mockResolvedValueOnce(JSON.stringify({ reply: 'Hello.', tone: 'warm', tool: null }));
    await service.open(); await service.send('Hello'); let resolve!: (s: string) => void;
    driver.generate.mockImplementationOnce(() => new Promise<string>(r => { resolve = r; })); service.end();
    expect(companion.setConversationInference).toHaveBeenLastCalledWith(true);
    await vi.advanceTimersByTimeAsync(3100); expect(companion.finishConversation).toHaveBeenCalled();
    expect(companion.setConversationInference).toHaveBeenLastCalledWith(true);
    resolve(JSON.stringify({ summary: 'We greeted each other.', topics: ['hello', 'greeting', 'conversation'] }));
    await vi.advanceTimersByTimeAsync(1); expect(companion.setConversationInference).toHaveBeenLastCalledWith(false);
  });
});
