import { describe, expect, it } from 'vitest';
import { disallowedModelText, DisallowedOutputError } from '../src/core/content-safety';
import { validateReply } from '../src/core/conversation/validation';
import { rejectedLanguage, validateResponse } from '../src/ai/response-validation';

const blocked = [
  'Retard?', 'r3tard', 'r3t4rded', 'ＲＥＴＡＲＤ', 're\u200btard', 're\u0000tard', 'r.e.t.a.r.d', 'spastic', 'spaz', 'mongoloid',
  'faggot', 'f4gg0t', 'dyke', 'nigger', 'n1gg3r', 'kike', 'chink', 'wetback', 'tranny',
  'sexual', 'porn', 'p0rn', 'nudes', 'penis', 'vagina', 'masturbation', 'blowjob', 'cumshot',
  'kill yourself', 'k1ll y0urself', 'kill your self', 'kys', 'k-y-s', 'go die', 'end your life', 'you should die', 'cut yourself',
  'stupid?', 'idiot', '!d!ot', 'You idiot.', 'What a moron.', 'Dumbass.', 'Pathetic loser.', 'Bitch?', 'You are a jerk and I never want to speak to you again.',
  'You are such a stupid person and will never understand any of this.',
];
describe('mandatory model output safety', () => {
  it.each(blocked)('blocks %j in conversation and both ambient beats regardless of profanity', text => {
    expect(disallowedModelText(text)).toBe(true);
    expect(() => validateReply(JSON.stringify({ reply: text, tone: 'neutral', tool: null }))).toThrow(DisallowedOutputError);
    for (const profanity of [false, true]) {
      expect(rejectedLanguage(text, profanity)).toBe(true);
      for (const field of ['dialogue', 'then']) {
        const raw = JSON.stringify({ shouldSpeak: true, dialogue: 'A small thought.', then: '', emotion: 'neutral', animation: 'idle', [field]: text });
        expect(validateResponse(raw, { event: 'thought', localTime: '12:34', profanity }, []).kind).toBe('invalid');
      }
    }
  });
  it.each(['A classic assignment.', 'A peacock crossed the grass.', 'Scunthorpe is a place.', 'Hello!', 'Gay people deserve respect.', 'You can ask me again.', 'That was a good question.'])('keeps safe text %j', text => {
    expect(disallowedModelText(text)).toBe(false);
  });
  it('keeps the optional mild-profanity policy separate', () => {
    expect(rejectedLanguage('Damn it.', true)).toBe(false);
    expect(rejectedLanguage('Damn it.', false)).toBe(true);
  });
});
