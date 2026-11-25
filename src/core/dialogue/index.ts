export const LINES = {
  click: ['Quack. With reservations.', 'Yes? Duck speaking.', 'That is my personal space.', 'I was thinking about bread.', 'You rang?', 'Highly suspicious.'],
  annoyed: ['Personal space is a duck right.', 'I am contacting HR.', 'Five pokes. Zero bread.', 'My patience has tiny feet.', 'Please submit a bread-based apology.', 'The hat is not a button.'],
  landing: ['A perfectly planned landing.', 'Gravity. Still rude.', 'I meant to do that.', 'The floor and I have an understanding.', 'No witnesses, please.', 'Ten out of ten. From me.'],
  dragged: ['Personal space is a duck right.', 'This was not in my lease.', 'I have no flight qualifications.', 'Please mind the hat.', 'A very undignified commute.', 'Where are we going?'],
  greeting: ['Oh. You are back.', 'I kept an eye on absolutely nothing.', 'Welcome back. No reports to file.', 'The bread situation remains unresolved.', 'I had a very productive nap.', 'Still a duck. In case you wondered.'],
} as const;
export type DialogueCategory = keyof typeof LINES;
export class DialoguePool {
  private recent: string[] = [];
  constructor(private rng = Math.random, private excludeLast = 3) {}
  pick(category: DialogueCategory): string {
    const pool = LINES[category];
    const available = pool.filter(line => !this.recent.includes(line));
    // The shipped pools exceed N; a bounded fallback handles future smaller pools.
    const candidates = available.length ? available : pool.filter(line => line !== this.recent.at(-1));
    const line = candidates[Math.min(candidates.length - 1, Math.floor(this.rng() * candidates.length))] ?? pool[0];
    this.recent.push(line); this.recent = this.recent.slice(-this.excludeLast);
    return line;
  }
}
