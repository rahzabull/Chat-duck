import { describe, expect, it } from 'vitest';
import { parseIntent, flipPronouns } from '../src/core/conversation/intents';
import { guardedReply } from '../src/core/conversation/output';
import { TALK_LINES } from '../src/core/dialogue/lines';
import { KeywordRetrieval, purgeConversations, score } from '../src/core/conversation/retrieval';
import { needsReadingPanel, parseMarkdown, readingTime, splitBeats } from '../src/core/conversation/presentation';
import { validateReply } from '../src/core/conversation/validation';
import { conversationLayout } from '../src/core/conversation/layout';
import { renderMarkdown } from '../src/renderer/companion/markdown';
import { validatePayload } from '../src/shared/schemas/ipc';
import { CHANNELS } from '../src/shared/constants';
import { isSettingsPatch, parseSettings } from '../src/shared/schemas/settings';
import type { Conversation, UserMemory } from '../src/core/conversation/types';
const now = Date.now();
const memory = (id: string, text: string, days: number): UserMemory => ({ id, text, category: 'other', createdAt: now - days * 86400000, source: 'user_said' });
const conversation = (id: string, days: number): Conversation => ({ id, turns: [], startedAt: now - days * 86400000, endedAt: now - days * 86400000, topics: ['design', 'campaign', 'Christmas'] });
describe('local intent parser', () => {
  it.each(['remember I prefer nights', 'remember that I prefer nights', 'Remember this: I prefer nights.', 'please remember that I prefer nights!'])('saves only explicit imperative %s', input => expect(parseIntent(input)).toEqual({ kind: 'remember', text: 'I prefer nights' }));
  it.each(['do you remember when we met?', 'I remember that night', "don't remember that", 'can you remember when?', 'remember', 'what do you remember?', 'forgetting is hard'])('does not save %s', input => expect(parseIntent(input).kind).not.toBe('remember'));
  it.each(['remember this', 'Remember that.'])('resolves an explicit reference %s', input => expect(parseIntent(input)).toEqual({ kind: 'remember', text: '' }));
  it.each(['forget that', 'forget that.'])('recognizes recent forgetting %s', input => expect(parseIntent(input)).toEqual({ kind: 'forget', query: '' }));
  it.each(['forget about nights', 'forget nights'])('recognizes query forgetting %s', input => expect(parseIntent(input)).toEqual({ kind: 'forget', query: 'nights' }));
  it.each(['what do you remember?', 'What do you remember about me?'])('lists memories %s', input => expect(parseIntent(input).kind).toBe('memories'));
  it.each(['yesterday', 'last time', 'earlier'])('recalls %s', when => expect(parseIntent(`what were we discussing about ${when}?`)).toEqual({ kind: 'conversations', when }));
  it.each([['shut up for 5 minutes', 5], ['be quiet for an hour', 60], ['be quiet', 30], ['please be quiet for 2 minutes', 2], ['shut up for 99999 minutes', 1440]] as const)('mutes %s', (text, minutes) => expect(parseIntent(text)).toEqual({ kind: 'mute', minutes }));
  it.each(['bye', "that's all", "thanks, that's it", 'thanks that’s it'])('ends %s', input => expect(parseIntent(input).kind).toBe('end'));
  it('flips simple pronouns without changing embedded words', () => {
    expect(flipPronouns('I prefer my evenings to myself')).toBe('you prefer your evenings to yourself');
    expect(flipPronouns("I'm making my project myself. I've saved mine.")).toBe('you are making your project yourself. you have saved yours.');
    expect(flipPronouns('Mysterious items')).toBe('Mysterious items');
  });
});
describe('retrieval and retention', () => {
  it('weights relevant older memories above irrelevant new ones, breaking ties by recency', () => {
    const values = [memory('a', 'tea preference', 0), memory('b', 'Christmas campaign design', 20), memory('c', 'Christmas campaign design', 1)];
    expect(new KeywordRetrieval().memories('Christmas design', values, now).map(v => v.id)).toEqual(['c', 'b', 'a']);
    expect(score('work', 'working', now, now)).toBe(1);
    expect(values[0].id).toBe('a');
  });
  it('caps context at eight memories and three summaries', () => {
    const retrieval = new KeywordRetrieval();
    expect(retrieval.memories('', Array.from({ length: 20 }, (_, i) => memory(String(i), 'tea', i)), now)).toHaveLength(8);
    expect(retrieval.conversations('campaign', Array.from({ length: 20 }, (_, i) => conversation(String(i), i)), now)).toHaveLength(3);
  });
  it('purges at exact retention boundaries and rejects future records', () => {
    const values = [-1, 0, 6, 7, 29, 30].map(day => conversation(String(day), day));
    expect(purgeConversations(values, '7 days', now).map(c => c.id)).toEqual(['0', '6']);
    expect(purgeConversations(values, '30 days', now).map(c => c.id)).toEqual(['0', '6', '7', '29']);
    expect(purgeConversations(values, 'off', now)).toEqual([]);
  });
});
describe('presentation and safe markdown', () => {
  it.each(['{"reply":"hello"}', 'Here: {"query":"tea"}', '{ "query": "tea" }', '[1, 2]', '```json\n{"x":1}\n```', 'recall_memories', 'recall_conversations', 'TOOL_RESULT', 'remember(text)', 'forget(query)', 'Use `remember`'])('replaces technical output %s with talk_error', text => {
    expect(TALK_LINES.talk_error).toContain(guardedReply(text));
  });
  it.each(["Forget 'you prefer nights'? Reply yes or no.", 'Forgot that you prefer nights.', "I'll remember: your favourite colour is green", '- one\n- two', '```js\nconsole.log(1)\n```'])('preserves ordinary prose and non-JSON code %s', text => {
    expect(guardedReply(text)).toBe(text);
  });
  it('splits replies into bounded readable beats and sets reading time', () => {
    expect(splitBeats('Hello there. How are you? Fine!')).toEqual(['Hello there.', 'How are you?', 'Fine!']);
    expect(splitBeats('word '.repeat(75)).every(b => b.length <= 180)).toBe(true);
    expect(readingTime('hi')).toBe(2200); expect(readingTime('x'.repeat(100))).toBe(4500);
  });
  it.each(['x'.repeat(421), '- Item', '1. Item', '```js\nalert(1)\n```'])('uses a reading panel for rich/long replies', text => expect(needsReadingPanel(text)).toBe(true));
  it('keeps ordinary replies in beats', () => expect(needsReadingPanel('A short helpful answer.')).toBe(false));
  it('parses only the authored subset', () => {
    expect(parseMarkdown('**Hello** `world`\n- one\n- two\n```js\n<img onerror=evil>\n```').map(b => b.kind)).toEqual(['p', 'ul', 'pre']);
  });
  it('renders hostile HTML as text nodes with no script/image element or attributes', () => {
    class Node {
      children: Node[] = []; textContent = '';
      constructor(readonly tag: string) {}
      appendChild(child: Node) { this.children.push(child); return child; }
      replaceChildren() { this.children = []; }
    }
    const created: string[] = [];
    const doc = { createElement(tag: string) { created.push(tag); return new Node(tag); }, createTextNode(text: string) { const n = new Node('#text'); n.textContent = text; return n; } };
    const target = new Node('section'); const malicious = '<img src=x onerror=alert(1)> <script>evil()</script>';
    renderMarkdown(target as unknown as HTMLElement, malicious + '\n**bold** `code`', doc as unknown as Document);
    expect(created).toEqual(['p', 'p', 'strong', 'code']); expect(target.children[0].children[0].textContent).toBe(malicious);
  });
  it.each([{ x: 1600, y: 700, width: 320, height: 300 }, { x: 0, y: 0, width: 320, height: 300 }, { x: 0, y: 700, width: 512, height: 480 }])('grows without moving feet and clamps to work area', base => {
    const area = { x: 0, y: 0, width: 1920, height: 1200 };
    const { bounds, layout } = conversationLayout(base, area, true);
    expect(bounds.x + layout.x).toBe(base.x); expect(bounds.y + layout.y + layout.height).toBe(base.y + base.height);
    expect(bounds.x).toBeGreaterThanOrEqual(area.x); expect(bounds.y).toBeGreaterThanOrEqual(area.y);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(area.width); expect(bounds.y + bounds.height).toBeLessThanOrEqual(area.height);
  });
  it('reserves three input lines below the reply and above the hat', () => {
    const base = { x: 400, y: 700, width: 320, height: 300 };
    const { bounds, layout } = conversationLayout(base, { x: 0, y: 0, width: 1920, height: 1080 }, true);
    const replyBottom = bounds.y + bounds.height - layout.contentBottom;
    const inputBottom = replyBottom + 84;
    expect(inputBottom - 76 - replyBottom).toBeGreaterThanOrEqual(8);
    expect(inputBottom).toBeLessThan(base.y + 143);
  });
});
describe('conversation boundaries', () => {
  it('strips controls, defaults tone, and rejects unknown tools and malformed output', () => {
    expect(validateReply(JSON.stringify({ reply: '\u0000 Hi\nthere', tone: 'odd', tool: null }))).toEqual({ reply: 'Hi\nthere', tone: 'neutral', tool: null });
    for (const value of ['no JSON', '{}', JSON.stringify({ reply: '', tone: 'warm', tool: null }), JSON.stringify({ reply: 'x'.repeat(4001), tone: 'warm', tool: null }), JSON.stringify({ reply: 'Hi', tone: 'warm', tool: { name: 'shell', args: {} } })]) expect(() => validateReply(value)).toThrow();
  });
  it('validates shortcut, retention and strict IPC arguments', () => {
    expect(parseSettings({}).conversationRetention).toBe('7 days');
    expect(isSettingsPatch({ conversationShortcut: 'Ctrl+Alt+D', conversationRetention: 'off' })).toBe(true);
    expect(isSettingsPatch({ conversationShortcut: 'Ctrl+Ctrl+D' })).toBe(false);
    expect(validatePayload(CHANNELS.talkSend, 'hello')).toBe(true);
    expect(validatePayload(CHANNELS.talkSend, 'x'.repeat(4001))).toBe(false);
    expect(validatePayload(CHANNELS.libraryAction, { action: 'edit', id: 'a', text: 'hi', category: 'other', path: 'elsewhere' })).toBe(false);
    expect(validatePayload(CHANNELS.libraryAction, { action: 'add', text: 'hi', category: 'preference' })).toBe(true);
  });
});
