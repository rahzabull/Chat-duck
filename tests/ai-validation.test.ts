import { describe, expect, it } from 'vitest';
import { validateResponse, similarity } from '../src/ai/response-validation';
import type { AIContext } from '../src/ai/prompts';

const context: AIContext = { event: 'thought', localTime: '12:34', count: 6 };
const value = { shouldSpeak: true, dialogue: "I'm considering a career in sitting.", then: '', emotion: 'curious', animation: 'idle' };
const check = (patch = {}, recent: string[] = [], data = context) => validateResponse(JSON.stringify({ ...value, ...patch }), data, recent);
describe('AI response validation', () => {
  it('accepts a short conversational beat and a distinct second beat', () => {
    expect(check({ then: 'The interview seems manageable.' }).kind).toBe('speech');
    expect(check({ dialogue: `A ${'a'.repeat(108)}`, then: `B ${'b'.repeat(88)}` }).kind).toBe('speech');
  });
  it.each(['oops', '```json\n{}\n```', 'null', '[]', '{}', JSON.stringify({ ...value, command: 'run' }), JSON.stringify({ ...value, shouldSpeak: 'true' }), JSON.stringify({ ...value, then: null }), JSON.stringify({ ...value, emotion: 12 }), JSON.stringify({ ...value, animation: [] })])('rejects malformed JSON/schema %s', raw => {
    expect(validateResponse(raw, context, []).kind).toBe('invalid');
  });
  it('respects schema-valid silence even with empty dialogue', () => {
    expect(check({ shouldSpeak: false, dialogue: '' }).kind).toBe('silent');
  });
  it.each(['', '   ', 'a'.repeat(111), Array(29).fill('a').join(' '), 'Hello\nfriend', 'Hello\rfriend', 'Hi\u2028friend', 'Hi\u0000friend', '\nHello friend.', 'Hello friend.\n',
    'Visit https://example.com', 'Visit ftp://localhost', 'Open data:text/plain,hi', 'Visit www.example.org', 'Visit example.org/path', 'Ask duck@example.com',
    '```hello```', '*hello*', '**hello**', '#hello', '[hello](somewhere)', '<b>hello</b>', '_hello_', '- a list', '1. a list', '---',
    'Hi 🦆', 'Hi 🇮🇳', 'Hi 1️⃣', 'Hi ©', 'Seriously? Again?', 'Ugh. Again.', 'Oh great, again.', 'Well, again.', 'As a duck, hello.', 'As an AI, hello.',
    'Shit happens.', 'Fuck that.', 'You bastard.', 'What an asshole.', 'Damn it.', 'That makes 7.', 'That makes ٧.'])('rejects unsafe beat %s', dialogue => {
    expect(check({ dialogue }).kind).toBe('invalid');
  });
  it.each(['tab', 'tabs', 'website', 'site', 'page', 'video', 'email', 'message', 'cat', 'dog', 'file'])('rejects invented observation %s in either beat', word => {
    expect(check({ dialogue: `That ${word} seems familiar.` }).kind).toBe('invalid');
    expect(check({ then: `That ${word} seems familiar.` }).kind).toBe('invalid');
    expect(check({ dialogue: `That ${word} seems familiar.` }, [], { ...context, app: word }).kind).toBe('speech');
  });
  it('only allows whole supplied numeric tokens, with clock time restricted to time events', () => {
    expect(check({ dialogue: "It's 12:34. That's 6 pokes." }).kind).toBe('invalid');
    expect(check({ dialogue: "It's 12:34. That's 6 pokes." }, [], { ...context, event: 'thought_late' }).kind).toBe('speech');
    expect(check({ dialogue: 'That makes 6.' }).kind).toBe('speech');
    expect(check({ dialogue: 'That makes 2.' }).kind).toBe('invalid');
    expect(check({ dialogue: 'That makes 34.' }).kind).toBe('invalid');
  });
  it('rejects long/unsafe/duplicate second beats', () => {
    for (const then of [`A ${'a'.repeat(89)}`, 'Ugh. Again.', 'One\nmore.', value.dialogue]) expect(check({ then }).kind).toBe('invalid');
  });
  it.each(['Hello.', 'Hmm...', '...', '"Quack!"'])('rejects dialogue with fewer than two words: %s', dialogue => {
    expect(check({ dialogue }).kind).toBe('invalid');
  });
  it.each(['and a tiny crown.', 'perhaps tomorrow.', 'évidemment oui.', 'Fine.', '...', '   ', '"maybe later."'])('drops only a fragmentary second beat: %s', then => {
    expect(check({ then })).toMatchObject({ kind: 'speech', speech: { text: value.dialogue, then: undefined } });
  });
  it.each(['"Hello there."', '“Hello there.”', 'Hello there.”', '”Hello there.', 'Hello” there.', "'Hello there.'"])(
    'strips surrounding quotes and stray closing quotes: %s', dialogue => {
      expect(check({ dialogue, then: '“A tiny kingdom.”' })).toMatchObject({ kind: 'speech', speech: { text: 'Hello there.', then: 'A tiny kingdom.' } });
      expect(check({ dialogue }, ['Hello there.']).kind).toBe('invalid');
    });
  it.each(['Twelve thirty already.', "It's five o'clock.", 'Already 02:15 somehow.', 'Already 14:20 somehow.',
    'Already 2 pm somehow.', 'Already midnight somehow.', 'Already 20:14 somehow.'])(
    'rejects clock mentions on ordinary thoughts: %s', dialogue => {
      expect(check({ dialogue }, [], { event: 'thought', localTime: '14:20', count: 2, minutes: 15 }).kind).toBe('invalid');
    });
  it.each(['late_night_working', 'sleepy_late', 'thought_late', 'thought_morning'] as const)(
    'accepts the given local time only for %s', event => {
      const data = { event, localTime: '02:15' };
      expect(check({ dialogue: '02:15' }, [], data).kind).toBe('invalid');
      expect(check({ then: '02:15' }, [], data)).toMatchObject({ kind: 'speech', speech: { then: undefined } });
      for (const dialogue of ['Already 02:15 somehow.', "It's two fifteen.", "It's 2:15 am."]) {
        expect(check({ dialogue }, [], data).kind).toBe('speech');
      }
      for (const dialogue of ['Already 15:02 somehow.', 'Already 02:02 somehow.', "It's twelve thirty.", "It's 2:15 pm."]) {
        expect(check({ dialogue }, [], data).kind).toBe('invalid');
      }
      expect(check({ then: 'Twelve thirty already.' }, [], data).kind).toBe('invalid');
    });
  it.each(['app_code', 'wake_long', 'hover_linger', 'drag_long'] as const)('does not leak localTime into %s', event => {
    expect(check({ dialogue: 'Already 12:34 somehow.' }, [], { ...context, event }).kind).toBe('invalid');
  });
  it('compares spelled times and meridiems with the supplied whole time', () => {
    const data: AIContext = { event: 'thought_late', localTime: '17:00' };
    expect(check({ dialogue: "It's five o'clock." }, [], data).kind).toBe('speech');
    expect(check({ dialogue: "It's five pm." }, [], data).kind).toBe('speech');
    expect(check({ dialogue: "It's five am." }, [], data).kind).toBe('invalid');
    expect(check({ dialogue: 'Twelve thirty already.' }, [], { ...data, localTime: '12:30' }).kind).toBe('speech');
    expect(check({ dialogue: 'Noon already somehow.' }, [], { ...data, localTime: '12:00' }).kind).toBe('speech');
    expect(check({ dialogue: "It's two oh five." }, [], { ...data, localTime: '02:05' }).kind).toBe('speech');
    expect(check({ dialogue: "It's 02:15 already." }, [], { ...data, localTime: '14:15' }).kind).toBe('invalid');
  });
  it('defaults unknown emotion and animation to the situation policy', () => {
    expect(check({ emotion: 'evil', animation: 'execute' })).toMatchObject({ kind: 'speech', speech: { emotion: 'curious', animation: 'idle' } });
  });
  it('rejects normalized duplicates and Jaccard >= .6 from the last thirty spoken beats', () => {
    expect(similarity('one two three', 'one two three four five')).toBe(.6);
    expect(check({}, ["I’m considering a career in sitting!"]).kind).toBe('invalid');
    expect(check({ dialogue: 'One two three.' }, ['one two three four five']).kind).toBe('invalid');
    expect(check({}, [value.dialogue, ...Array(19).fill('Something different')]).kind).toBe('invalid');
    expect(check({}, [value.dialogue, ...Array(30).fill('Something different')]).kind).toBe('speech');
    expect(check({ then: 'Some other thought.' }, ['Some other thought!']).kind).toBe('invalid');
  });
});
