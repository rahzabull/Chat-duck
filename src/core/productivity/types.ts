export interface Task {
  id: string; title: string; notes?: string; due?: string; dueTime?: string;
  priority: 'low' | 'normal' | 'high'; category?: string;
  subtasks: { id: string; title: string; done: boolean }[];
  done: boolean; doneAt?: string; createdAt: string; updatedAt: string;
}
export interface Recurrence {
  kind: 'daily' | 'weekly' | 'monthly' | 'custom' | 'interval';
  weekdays?: number[]; dayOfMonth?: number; intervalDays?: number;
  intervalMinutes?: number;
  /** Local, same-day window; end is exclusive. */
  window?: { start: string; end: string };
}
export interface Reminder {
  id: string; text: string; at: string; recurrence?: Recurrence; snoozedUntil?: string;
  lastFiredAt?: string; state: 'scheduled' | 'due' | 'done' | 'dismissed'; createdAt: string; timezone: string;
  /** Original wall time survives spring-forward gaps. */
  wallTime?: string;
}
export interface Note { id: string; title?: string; text: string; topic?: string; createdAt: string; updatedAt: string; pinned: boolean }
export interface FocusSettings {
  notifications: boolean; defaultSnooze: number; focusMinutes: number; shortMinutes: number; longMinutes: number;
  autoBreak: boolean; keepHistory: boolean;
}
export interface FocusData { settings: FocusSettings; history: { startedAt: string; endedAt: string; minutes: number }[] }
export interface FocusSession { endAt: number; remaining: number; paused: boolean; kind: 'focus' | 'break'; startedAt: number; minutes: number }
export const FOCUS_DEFAULTS: FocusSettings = { notifications: true, defaultSnooze: 10, focusMinutes: 25, shortMinutes: 5, longMinutes: 15, autoBreak: false, keepHistory: false };
export type Card = 'tasks' | 'task-created' | 'reminders' | 'reminder-created' | 'reminder-due' | 'notes' | 'add-task' | 'add-reminder' | null;
export interface ProductivityView {
  revision: number; card: Card; selected?: string; filter?: string; tasks: Task[]; reminders: Reminder[]; notes: Note[];
  settings: FocusSettings; focus?: FocusSession; queue: number; message: string; undoUntil?: number;
  breakMinutes?: number;
  layout?: import('../conversation/layout').ReturnLayout;
}
export interface ProductivityAction { name: string; args: Record<string, unknown>; token?: string }
export interface ProductivityResult { ok: boolean; message: string; token?: string; data?: unknown }
export const localDate = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const localTime = (date: Date): string => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
