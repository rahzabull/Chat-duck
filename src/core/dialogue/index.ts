import { TALK_CADENCE, between } from './cadence';
import { PRESETS } from './presets';
import { sanitizeName } from '../memory';
import type { Mood } from '../emotions';
import type { AnimationId, EmotionId } from '../../animation/adapter';
import type { Settings } from '../../shared/types';
import type { Priority } from '../interruptions';
import { LINES, type Line, type Situation } from './lines';
export type { Situation } from './lines';

export interface DialogueContext {
  safeTitle?: string; screenDescription?: string; ambient?: boolean; observation?: boolean;
  overdue?: number; remaining?: number; reminder?: string; task?: string; deadline?: string;
  personality?: Settings['personality']; profanity?: boolean; speechScale?: number;
  mood?: Mood; emotions?: string[]; memoryEnabled?: boolean; name?: string; memoryFact?: string;
  talkativeness?: Settings['talkativeness']; app?: string; minutes?: number; hours?: number;
  count?: number; awayMs?: number; fullscreen?: boolean;
}
export interface DirectedSpeech { text: string; then?: string; priority: Priority; emotion: EmotionId; animation: AnimationId }
type Policy = readonly [chance: number, cooldownSeconds: number, priority: Priority, emotion: EmotionId, animation: AnimationId];
/** All speech probabilities and per-situation cooldowns live here. */
export const POLICIES: Record<Situation, Policy> = {
  title_switch: [1, 60, 'low', 'curious', 'look_right'],
  title_long: [1, 60, 'low', 'suspicious', 'look_left'],
  still_here_mutter: [1, 60, 'low', 'curious', 'idle'],
  app_return: [1, 60, 'low', 'curious', 'idle'],
  screen_comment: [1, 60, 'low', 'curious', 'look_right'],
  briefing_morning: [.95, 3600, 'low', 'happy', 'idle'],
  summary_evening: [.9, 3600, 'low', 'happy', 'idle'],
  deadline_nudge: [.85, 1800, 'low', 'curious', 'idle'],
  overdue_nudge: [.7, 3600, 'low', 'curious', 'idle'],
  assist_offer_design: [.7, 10800, 'low', 'curious', 'idle'],
  assist_offer_writing: [.7, 10800, 'low', 'curious', 'idle'],
  assist_offer_code: [.7, 10800, 'low', 'curious', 'idle'],
  gaming_back: [.3, 3600, 'low', 'curious', 'idle'],
  dnd_on: [1, 60, 'low', 'neutral', 'idle'],
  privacy_on: [1, 60, 'low', 'neutral', 'idle'],
  thought_tasks: [.2, 7200, 'low', 'curious', 'idle'],
  activity_yawn: [.2, 600, 'low', 'sleepy', 'yawn'],
  activity_stretch: [.2, 600, 'low', 'neutral', 'stretch'],
  activity_dance: [.35, 600, 'low', 'happy', 'dance'],
  event_strike: [1, 3600, 'low', 'suspicious', 'strike'],
  event_sunglasses: [1, 3600, 'low', 'neutral', 'sunglasses'],
  event_bread: [.7, 1800, 'low', 'happy', 'bread_snack'],
  event_visitor: [1, 43200, 'low', 'curious', 'visitor'],
  memory_pickups: [.15, 86400, 'low', 'suspicious', 'idle'],
  memory_anniversary: [1, 86400, 'low', 'happy', 'idle'],
  memory_name: [.2, 3600, 'medium', 'happy', 'idle'],
  first_launch: [1, 0, 'high', 'curious', 'idle'],
  hover: [.15, 45, 'low', 'curious', 'idle'],
  hover_linger: [.7, 60, 'medium', 'suspicious', 'look_left'],
  hover_again: [.65, 60, 'medium', 'suspicious', 'look_right'],
  click: [.4, 1, 'medium', 'startled', 'startled'],
  click_escalate: [.75, 1, 'medium', 'suspicious', 'startled'],
  click_angry: [1, 4, 'high', 'angry', 'angry'],
  click_forgive: [.5, 30, 'low', 'happy', 'idle'],
  pickup: [.8, 2, 'medium', 'startled', 'picked_up'],
  pickup_again: [.95, 3, 'high', 'angry', 'picked_up'],
  drag_long: [.85, 15, 'medium', 'startled', 'picked_up'],
  drag_shaken: [.98, 10, 'high', 'angry', 'picked_up'],
  drop_small: [.2, 10, 'medium', 'neutral', 'landing'],
  drop_big: [.95, 5, 'high', 'angry', 'landing'],
  thrown_wall: [.95, 10, 'high', 'angry', 'landing'],
  wake_short: [.65, 60, 'medium', 'happy', 'waking_up'],
  wake_long: [.9, 60, 'medium', 'happy', 'waking_up'],
  sleepy_late: [.6, 2700, 'low', 'sleepy', 'idle'],
  walk_mutter: [.1, 180, 'low', 'neutral', 'walking'],
  thought: [1, 240, 'low', 'curious', 'idle'],
  thought_morning: [1, 240, 'low', 'sleepy', 'look_right'],
  thought_late: [1, 240, 'low', 'curious', 'look_left'],
  app_browser: [.5, 600, 'low', 'curious', 'look_right'],
  app_browser_long: [.7, 600, 'low', 'suspicious', 'look_left'],
  app_code: [.5, 600, 'low', 'curious', 'look_right'],
  app_code_long: [.7, 600, 'low', 'suspicious', 'look_left'],
  app_design: [.5, 600, 'low', 'curious', 'look_right'],
  app_design_long: [.7, 600, 'low', 'suspicious', 'look_left'],
  app_video_edit: [.5, 600, 'low', 'curious', 'look_right'],
  app_3d: [.5, 600, 'low', 'curious', 'look_right'],
  app_ai: [.5, 600, 'low', 'curious', 'look_right'],
  app_office: [.4, 600, 'low', 'curious', 'look_right'],
  app_files: [.2, 600, 'low', 'curious', 'look_right'],
  app_terminal: [.4, 600, 'low', 'curious', 'look_right'],
  app_music: [.5, 600, 'low', 'happy', 'idle'],
  app_switching: [.65, 900, 'low', 'suspicious', 'look_left'],
  app_generic_long: [.7, 600, 'low', 'curious', 'idle'],
  late_night_working: [.7, 2700, 'low', 'sleepy', 'idle'],
};
export function thoughtSituation(date: Date): Situation {
  const hour = date.getHours();
  return hour >= 6 && hour < 10 ? 'thought_morning' : hour < 4 ? 'thought_late' : 'thought';
}
export function thoughtDelay(talk: Settings['talkativeness'], rng = Math.random): number {
  return between(TALK_CADENCE[talk].thoughts, rng);
}
const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
function numberWords(n: number): string {
  if (n < 20) return words[n];
  if (n < 100) return ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'][Math.floor(n / 10)] + (n % 10 ? `-${words[n % 10]}` : '');
  return String(n);
}
export function timeAway(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 10) return 'a few minutes';
  if (minutes < 50) return `${numberWords(Math.round(minutes / 5) * 5)} minutes`;
  if (minutes < 90) return 'about an hour';
  return `${numberWords(Math.round(minutes / 60))} hours`;
}
export function fillTemplate(text: string, context: DialogueContext, now: number): string {
  const slots: Record<string, string> = {
    overdue: String(context.overdue ?? 0), remaining: String(context.remaining ?? 0), reminder: context.reminder ?? 'none today',
    task: context.task ?? 'That task', deadline: context.deadline ?? 'soon',
    app: context.app ?? 'that app', minutes: String(context.minutes ?? 0), hours: String(context.hours ?? Math.floor((context.minutes ?? 0) / 60)),
    name: sanitizeName(context.name ?? 'friend'), count: String(context.count ?? 1), timeAway: timeAway(context.awayMs ?? 0),
    time: new Date(now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
  return text.replace(/\{(\w+)\}/g, (slot, key: string) => slots[key] ?? slot);
}

export function eligibleLine(line: Line): boolean {
  return !/Talking to another AI\?|I missed you|can't stay away|wrong with you|what the hell are you doing/i.test(line.text + ' ' + (line.then ?? ''));
}
export class DialogueDirector {
  private bags = new Map<string, Line[]>();
  // Store authored templates only: never historical foreground app names.
  private recent: Line[] = [];
  private rubberDuckUsed = false;
  private cooldowns = new Map<Situation, number>();
  private appAllowed = 0;
  constructor(private rng = Math.random, private clock = Date.now) {}
  canObserve(): boolean { return this.clock() >= this.appAllowed; }
  observeScreen(accept: () => boolean, talk: Settings['talkativeness']): boolean {
    if (this.clock() < this.appAllowed || !accept()) return false;
    this.appAllowed = this.clock() + TALK_CADENCE[talk].app;
    return true;
  }
  decide(situation: Situation, context: DialogueContext = {}, accept: (speech: DirectedSpeech) => boolean = () => true): DirectedSpeech | null {
    const now = this.clock();
    const [chance, cooldown, priority, emotion, animation] = POLICIES[situation];
    if (context.fullscreen && priority !== 'high') return null;
    const appComment = context.observation || situation.startsWith('app_') || situation.startsWith('title_') || situation === 'screen_comment';
    const cadence = TALK_CADENCE[context.talkativeness ?? 'normal'];
    if ((!context.ambient && !appComment && now < (this.cooldowns.get(situation) ?? 0)) || (appComment && now < this.appAllowed)) return null;
    const scale = context.talkativeness === 'quiet' ? .5 : context.talkativeness === 'chatty' ? 1.5 : context.talkativeness === 'unhinged' ? 2 : 1;
    // Strong physical reactions remain dependable even for a quiet duck.
    if (!context.ambient && this.rng() >= Math.min(1, (chance >= .9 ? chance : chance * scale) * (priority === 'high' ? 1 : context.speechScale ?? 1))) return null;
    const preset = PRESETS[context.personality ?? 'sarcastic'];
    const overlays = preset.lines[situation]?.filter(eligibleLine);
    const profane = context.profanity ? preset.profane?.[situation]?.filter(eligibleLine) : undefined;
    const kind = profane?.length && this.rng() < .3 ? 'profane' : overlays?.length && this.rng() < .75 ? 'preset' : 'base';
    const recentTexts = this.recent.flatMap(line => [line.text, line.then].filter(Boolean));
    let bag: Line[] = [], index = -1;
    for (const candidate of kind === 'base' ? ['base'] : [kind, 'base']) {
      const key = [situation, preset.id, candidate].join(':');
      bag = this.bags.get(key) ?? [];
      if (!bag.length) {
        const pool = (candidate === 'profane' ? profane! : candidate === 'preset' ? overlays! : LINES[situation]).filter(line => eligibleLine(line) && !(this.rubberDuckUsed && /rubber-duck/.test(line.text)));
        bag = pool.map(line => ({ line, key: -Math.log(Math.max(Number.EPSILON, this.rng())) / (line.weight ?? 1) }))
          .sort((a, b) => a.key - b.key).map(entry => entry.line);
        this.bags.set(key, bag);
      }
      index = bag.findIndex(line => !(this.rubberDuckUsed && /rubber-duck/.test(line.text)) && !recentTexts.includes(line.text) && (!line.then || !recentTexts.includes(line.then)));
      if (index >= 0) break;
    }
    // Exhausted pools stay silent rather than repeating a recent beat.
    if (index < 0) return null;
    const line = bag[index];
    const speech: DirectedSpeech = { text: fillTemplate(line.text, context, now), then: line.then ? fillTemplate(line.then, context, now) : undefined, priority, emotion: context.mood === 'grumpy' && emotion === 'neutral' ? 'suspicious' : emotion,
      animation: situation === 'thought' ? (['idle', 'look_left', 'look_right'] as const)[Math.floor(this.rng() * 3)] : animation };
    if (!accept(speech)) return null;
    if (/rubber-duck/.test(line.text)) this.rubberDuckUsed = true;
    bag.splice(index, 1); this.recent = [...this.recent, line].slice(-30);
    this.cooldowns.set(situation, now + cooldown * 1000);
    // One observation gate across categories; rapid switching cannot bypass it.
    if (appComment) this.appAllowed = now + cadence.app;
    return speech;
  }
}
