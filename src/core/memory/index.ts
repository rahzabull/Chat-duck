import { localDay } from '../emotions';
export const sanitizeName = (value: string): string => value.normalize('NFKC').replace(/[^\p{L}\p{N} .'-]/gu, '').trim().slice(0, 30);
export interface Memory {
  firstMetDate: string; preferredName: string; totalPickups: number; throws: number; angryClickStreaks: number;
  daysTogether: number; lastDay: string; dailyPokes: number;
  pickupsByDay: { date: string; count: number }[];
  runningJokes: { kind: 'first_big_drop' | 'most_pickups_in_a_day'; date: string; count: number }[];
}
export const freshMemory = (now: number): Memory => ({ firstMetDate: localDay(now), preferredName: '', totalPickups: 0, throws: 0, angryClickStreaks: 0, daysTogether: 1, lastDay: localDay(now), dailyPokes: 0, pickupsByDay: [], runningJokes: [] });
const dateOK = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const count = (v: unknown): number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? Math.min(v, 1e9) : 0;
export function parseMemory(input: unknown, now: number): Memory {
  const m = freshMemory(now);
  if (!input || typeof input !== 'object' || Array.isArray(input)) return m;
  const v = input as Record<string, unknown>;
  for (const key of ['firstMetDate', 'lastDay'] as const) if (dateOK(v[key])) m[key] = v[key];
  if (typeof v.preferredName === 'string') m.preferredName = sanitizeName(v.preferredName);
  for (const key of ['totalPickups', 'throws', 'angryClickStreaks', 'daysTogether', 'dailyPokes'] as const) m[key] = count(v[key]);
  m.daysTogether = Math.max(1, m.daysTogether);
  if (Array.isArray(v.pickupsByDay)) for (const item of v.pickupsByDay.slice(-7)) {
    if (item && dateOK(item.date) && !m.pickupsByDay.some(d => d.date === item.date)) m.pickupsByDay.push({ date: item.date, count: count(item.count) });
  }
  if (Array.isArray(v.runningJokes)) for (const item of v.runningJokes.slice(-2)) {
    if (item && dateOK(item.date) && ['first_big_drop', 'most_pickups_in_a_day'].includes(item.kind) && !m.runningJokes.some(j => j.kind === item.kind)) m.runningJokes.push({ kind: item.kind, date: item.date, count: count(item.count) });
  }
  return m;
}
export function visit(m: Memory, now: number): void {
  const day = localDay(now);
  if (day > m.lastDay) { m.daysTogether++; m.lastDay = day; m.dailyPokes = 0; }
  m.pickupsByDay = m.pickupsByDay.filter(d => Date.parse(day) - Date.parse(d.date) < 7 * 86400000 && d.date <= day);
}
export function remember(m: Memory, event: 'pickup' | 'throw' | 'angry', now: number): void {
  visit(m, now); const date = localDay(now);
  if (event === 'pickup') {
    m.totalPickups++;
    let day = m.pickupsByDay.find(d => d.date === date);
    if (!day) m.pickupsByDay.push(day = { date, count: 0 });
    day.count++;
    const best = m.runningJokes.find(j => j.kind === 'most_pickups_in_a_day');
    if (!best) m.runningJokes.push({ kind: 'most_pickups_in_a_day', date, count: day.count });
    else if (day.count > best.count) Object.assign(best, { date, count: day.count });
  }
  if (event === 'throw') { m.throws++; if (!m.runningJokes.some(j => j.kind === 'first_big_drop')) m.runningJokes.push({ kind: 'first_big_drop', date, count: 1 }); }
  if (event === 'angry') m.angryClickStreaks++;
}
export function memorySummary(m: Memory): string[] {
  return [`First met: ${m.firstMetDate}`, ...(m.preferredName ? [`Preferred name: ${m.preferredName}`] : []), `${m.daysTogether} days together`, `${m.totalPickups} pickups`, `${m.throws} big drops`, `${m.angryClickStreaks} angry click streaks`, `${m.dailyPokes} pokes or drags today`, `${m.pickupsByDay.reduce((n, d) => n + d.count, 0)} pickups in the last seven days`, ...m.runningJokes.map(j => `${j.kind === 'first_big_drop' ? 'First big drop' : 'Most pickups in a day'}: ${j.date}${j.kind === 'most_pickups_in_a_day' ? ` (${j.count})` : ''}`)];
}
