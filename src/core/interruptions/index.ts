export type Priority = 'low' | 'medium' | 'high';
export interface Speech { text: string; priority: Priority; expiresAt: number }
export interface SpeechOptions { muted: boolean; blocked: boolean; cooldownMs: number; then?: string; followUpDelayMs?: number; fullscreen?: boolean }
export const speechDuration = (text: string): number => Math.max(3000, text.length * 65);
const rank: Record<Priority, number> = { low: 0, medium: 1, high: 2 };
export class SpeechQueue {
  current: Speech | null = null;
  private nextAllowed = 0;
  private followUp?: { text: string; at: number; cooldownMs: number };
  constructor(private clock = Date.now) {}
  canOffer(priority: Priority, options: SpeechOptions): boolean {
    this.tick();
    if (options.blocked || (options.fullscreen && priority !== 'high') || (options.muted && priority === 'low')) return false;
    return !(this.current ? rank[priority] <= rank[this.current.priority] : priority !== 'high' && this.clock() < this.nextAllowed);
  }
  offer(text: string, priority: Priority, options: SpeechOptions): boolean {
    if (!text || !this.canOffer(priority, options)) return false;
    this.followUp = undefined;
    this.current = { text, priority, expiresAt: this.clock() + speechDuration(text) };
    if (options.then) {
      // The follow-up replaces the first beat after a short conversational pause.
      const at = this.clock() + Math.max(1500, Math.min(2500, options.followUpDelayMs ?? 2000));
      this.followUp = { text: options.then, at, cooldownMs: options.cooldownMs };
    }
    this.nextAllowed = this.current.expiresAt + options.cooldownMs;
    return true;
  }
  dismiss(): void { this.current = null; this.followUp = undefined; }
  /** A fresh click/drag replaces the conversation, including its cooldown. */
  interrupt(): void { this.dismiss(); this.nextAllowed = 0; }
  get nextChangeAt(): number | undefined { return this.followUp?.at ?? this.current?.expiresAt; }
  tick(): boolean {
    if (this.current && this.followUp && this.clock() >= this.followUp.at) {
      const follow = this.followUp; this.followUp = undefined;
      this.current = { text: follow.text, priority: this.current.priority, expiresAt: this.clock() + speechDuration(follow.text) };
      this.nextAllowed = this.current.expiresAt + follow.cooldownMs; return true;
    }
    if (this.current && this.clock() >= this.current.expiresAt) { this.current = null; return true; }
    return false;
  }
}
