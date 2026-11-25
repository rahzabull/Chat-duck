import type { DialogueContext } from '../dialogue';
import { dndActive, inTimeWindow, quietHours, type Mode } from '../modes';
import { localDate, localTime, type Reminder, type Task } from '../productivity/types';
import { SKILL_PACKS, type Assistance } from '../skills';
import type { ForegroundApp } from '../awareness';
import type { Settings } from '../../shared/types';

export const PROACTIVE_IDS = ['briefing_morning', 'summary_evening', 'deadline_nudge', 'overdue_nudge', 'assist_offer_design', 'assist_offer_writing', 'assist_offer_code', 'gaming_back'] as const;
export type ProactiveId = typeof PROACTIVE_IDS[number];
export interface Candidate {
  id: ProactiveId; key: string; context: DialogueContext;
  label: string; detail?: string; dismissLabel: string;
  action: { kind: 'today' | 'overdue' } | { kind: 'plan'; prompt: string };
  app?: string;
}
export interface ProactiveInput {
  settings: Settings; mode: Mode; fullscreen: boolean; active: boolean;
  tasks: Task[]; reminders: Reminder[]; app?: ForegroundApp | null; appMinutes?: number;
}
export const dueAt = (task: Task): number => task.due ? new Date(`${task.due}T${task.dueTime ? task.dueTime + ':00' : '23:59:59.999'}`).getTime() : Infinity;
/** Pure local candidates. An accepted delivery is persisted by the owner, never every tick. */
export class ProactiveScheduler {
  private attempts = new Map<string, number>();
  private apps = new Map<string, number>();
  private history: Record<string, number>;
  private comebackUntil = 0;
  constructor(history: Record<string, number> = {}, private clock = Date.now, private rng = Math.random,
    private saved: (history: Record<string, number>) => void = () => {}) { this.history = { ...history }; }
  clearContext(): void { this.apps.clear(); }
  returnedFromGaming(): void { this.comebackUntil = this.clock() + 60000; }
  decline(candidate: Candidate): void { if (candidate.app) this.apps.set(candidate.app, this.clock() + 3 * 3600000); }
  evaluate(input: ProactiveInput, offer: (candidate: Candidate) => boolean, debug?: ProactiveId): Candidate | undefined {
    const now = this.clock(), date = new Date(now), s = input.settings;
    if (!input.active || input.fullscreen || dndActive(s, now) || quietHours(s, now) || s.mute || !['companion', 'privacy'].includes(input.mode)) return;
    const day = localDate(date), tomorrow = new Date(date); tomorrow.setDate(tomorrow.getDate() + 1);
    const pending = input.tasks.filter(t => !t.done), today = pending.filter(t => t.due === day);
    const overdue = pending.filter(t => dueAt(t) < now);
    const done = input.tasks.filter(t => t.done && t.doneAt && localDate(new Date(t.doneAt)) === day).length;
    const first = input.reminders.filter(r => r.state === 'scheduled' && Date.parse(r.snoozedUntil ?? r.at) >= now && localDate(new Date(r.snoozedUntil ?? r.at)) === day).sort((a, b) => Date.parse(a.snoozedUntil ?? a.at) - Date.parse(b.snoozedUntil ?? b.at))[0];
    const reminder = first ? localTime(new Date(first.snoozedUntil ?? first.at)) : 'none today';
    const candidates: Candidate[] = [];
    const daily = (id: ProactiveId) => this.history[id] === undefined || localDate(new Date(this.history[id])) !== day;
    if (s.morningBriefing && (debug === 'briefing_morning' || date.getHours() >= 5 && inTimeWindow(date, s.briefingStart, s.briefingEnd)) && (debug === 'briefing_morning' || daily('briefing_morning'))) candidates.push({ id: 'briefing_morning', key: 'briefing_morning', context: { count: today.length, overdue: overdue.length, reminder }, label: 'Today', detail: `${today.length} due today · ${overdue.length} overdue · First reminder: ${reminder}`, dismissLabel: 'Later', action: { kind: 'today' } });
    if (s.eveningSummary && (date.getHours() >= 18 || debug === 'summary_evening') && (debug === 'summary_evening' || daily('summary_evening'))) candidates.push({ id: 'summary_evening', key: 'summary_evening', context: { count: done, remaining: pending.length }, label: 'Today', detail: `${done} completed today · ${pending.length} left`, dismissLabel: 'Later', action: { kind: 'today' } });
    if (s.deadlineNudges) {
      const deadline = pending.filter(t => dueAt(t) > now && (t.due === localDate(tomorrow) || dueAt(t) - now <= 3 * 3600000)).sort((a, b) => dueAt(a) - dueAt(b)).find(t => !this.history[`deadline:${t.id}:${t.due}:${t.dueTime ?? ''}`]);
      if (deadline) candidates.push({ id: 'deadline_nudge', key: `deadline:${deadline.id}:${deadline.due}:${deadline.dueTime ?? ''}`, context: { task: deadline.title.slice(0, 120), deadline: deadline.due === localDate(tomorrow) ? 'tomorrow' : 'within 3 hours' }, label: 'Plan it', dismissLabel: 'Later', action: { kind: 'plan', prompt: `Help me plan this task: ${deadline.title}. Due ${deadline.due} ${deadline.dueTime ?? ''}. ${SKILL_PACKS[s.skillPack].opener}` } });
      if (overdue.length && daily('overdue_nudge')) candidates.push({ id: 'overdue_nudge', key: 'overdue_nudge', context: { count: overdue.length }, label: 'Review tasks', dismissLabel: 'Later', action: { kind: 'overdue' } });
    }
    if (s.assistanceOffers && s.appAwareness && !s.privacyMode && input.app && (input.appMinutes ?? 0) >= 45 && now >= (this.apps.get(input.app.name) ?? 0)) {
      const category: Assistance | undefined = input.app.category === 'design' ? 'design' : input.app.category === 'office' ? 'writing' : ['code', 'terminal'].includes(input.app.category) ? 'code' : undefined;
      if (category && SKILL_PACKS[s.skillPack].offers.includes(category)) candidates.push({ id: `assist_offer_${category}`, key: `assist_offer_${category}`, app: input.app.name, context: {}, label: 'Yes', dismissLabel: 'No', action: { kind: 'plan', prompt: `${category === 'design' ? 'Help me think through a layout.' : category === 'writing' ? 'Help me write some copy.' : 'Help me debug a problem.'} ${SKILL_PACKS[s.skillPack].opener}` } });
    }
    if (now < this.comebackUntil) candidates.push({ id: 'gaming_back', key: 'gaming_back', context: {}, label: '', dismissLabel: 'Later', action: { kind: 'today' } });
    for (const candidate of candidates) {
      if (debug && candidate.id !== debug || now < (this.attempts.get(candidate.key) ?? 0)) continue;
      // Failed rolls/director refusals back off too: silence is a decision, not a two-second retry.
      this.attempts.set(candidate.key, now + (candidate.id === 'gaming_back' ? 60000 : 10 * 60000));
      const chance = candidate.id === 'gaming_back' ? .15 : candidate.app ? .4 : .8;
      if (!debug && this.rng() >= chance * (s.talkativeness === 'quiet' ? .5 : s.talkativeness === 'chatty' ? 1.2 : 1)) continue;
      if (!offer(candidate)) return;
      if (candidate.app) this.apps.set(candidate.app, now + 3 * 3600000);
      else if (candidate.id === 'gaming_back') this.comebackUntil = 0;
      else {
        this.history[candidate.key] = now;
        this.history = Object.fromEntries(Object.entries(this.history).sort((a, b) => a[1] - b[1]).slice(-512));
        this.saved({ ...this.history });
      }
      return candidate;
    }
  }
}
