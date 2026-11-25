export type Priority = 'low' | 'medium' | 'high';
export interface Speech { text: string; priority: Priority; expiresAt: number }
export class SpeechQueue {
  current: Speech | null = null;
  private nextAllowed = 0;
  constructor(private clock = Date.now) {}
  offer(text: string, priority: Priority, options: { muted: boolean; blocked: boolean; cooldownMs: number }): boolean {
    this.tick();
    if (!text || options.blocked || (options.muted && priority === 'low')) return false;
    if (this.current || (priority !== 'high' && this.clock() < this.nextAllowed)) return false;
    this.current = { text, priority, expiresAt: this.clock() + Math.max(3000, text.length * 65) };
    this.nextAllowed = this.current.expiresAt + options.cooldownMs;
    return true;
  }
  dismiss(): void { this.current = null; }
  tick(): boolean {
    if (this.current && this.clock() >= this.current.expiresAt) { this.current = null; return true; }
    return false;
  }
}
