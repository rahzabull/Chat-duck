import { expect, it } from 'vitest';
import { DialoguePool, LINES, type DialogueCategory } from '../src/core/dialogue';
it('does not repeat any of the last three lines across categories', () => {
  const dialogue = new DialoguePool(() => 0, 3); const recent: string[] = [];
  for (let i = 0; i < 100; i++) {
    const category = Object.keys(LINES)[i % 5] as DialogueCategory; const line = dialogue.pick(category);
    expect(recent.slice(-3)).not.toContain(line); recent.push(line);
  }
});
it('excludes recent lines within one category as well', () => {
  const dialogue = new DialoguePool(() => 0.95, 3); const history: string[] = [];
  for (let i = 0; i < 30; i++) { const line = dialogue.pick('click'); expect(history.slice(-3)).not.toContain(line); history.push(line); }
});
