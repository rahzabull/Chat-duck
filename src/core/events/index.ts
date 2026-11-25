import type { Point } from '../../shared/types';
export interface EventMap {
  APP_STARTED: undefined; APP_RESUMED: undefined;
  CHARACTER_CLICKED: { count: number }; CHARACTER_HOVERED: { active: boolean };
  CHARACTER_PICKED_UP: Point; CHARACTER_DROPPED: { position: Point; velocity: Point }; CHARACTER_LANDED: Point;
  USER_BECAME_IDLE: undefined; USER_RETURNED: undefined;
  ACTIVE_APP_CHANGED: { applicationId: string }; APP_SESSION_THRESHOLD: { seconds: number };
  FULLSCREEN_ENTERED: undefined; FULLSCREEN_EXITED: undefined;
  TASK_CREATED: { id: string }; TASK_COMPLETED: { id: string }; TASK_OVERDUE: { id: string };
  REMINDER_DUE: { id: string }; REMINDER_SNOOZED: { id: string };
  FOCUS_STARTED: { id: string }; FOCUS_COMPLETED: { id: string };
  RANDOM_THOUGHT_DUE: undefined; MOOD_CHANGED: { mood: string }; PRIVACY_MODE_ENABLED: undefined;
  AI_RESPONSE_RECEIVED: { dialogue: string; animation: string }; ANIMATION_COMPLETED: { animation: string };
}
export class EventBus {
  private listeners = new Map<keyof EventMap, Set<(payload: never) => void>>();
  on<K extends keyof EventMap>(event: K, callback: (payload: EventMap[K]) => void): () => void {
    const callbacks = this.listeners.get(event) ?? new Set();
    callbacks.add(callback as (payload: never) => void); this.listeners.set(event, callbacks);
    return () => { callbacks.delete(callback as (payload: never) => void); };
  }
  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.listeners.get(event)?.forEach(callback => callback(payload as never));
  }
}
