import { nativeImage } from 'electron';
import type { ForegroundSample } from '../../core/awareness';
import { blankCapture, captureEligible, grayHash, nearIdentical } from '../../core/awareness/vision';
import { CAPTURE_MAX_HEIGHT, CAPTURE_MAX_WIDTH } from './capture-protocol';
import { between, TALK_CADENCE } from '../../core/dialogue/cadence';
import type { Settings } from '../../shared/types';
import type { DialogueContext, DirectedSpeech } from '../../core/dialogue';

export interface VisionInput {
  allowed: boolean; talk: Settings['talkativeness']; model: string;
  sample: ForegroundSample; context: DialogueContext;
}
export interface CapturedWindow { jpeg: string; hash: Uint8Array }
/** The resident helper renders one allowed HWND. Main only decodes that JPEG for hashing. */
export async function captureWindow(sample: ForegroundSample, request: (hwnd: string, maxW: number, maxH: number) => Promise<string | undefined>): Promise<CapturedWindow | undefined> {
  if (!captureEligible(sample)) return;
  const jpeg = await request(sample.hwnd!, CAPTURE_MAX_WIDTH, CAPTURE_MAX_HEIGHT);
  if (!jpeg) return;
  const image = nativeImage.createFromBuffer(Buffer.from(jpeg, 'base64'));
  if (image.isEmpty()) return;
  const hash = grayHash(image.resize({ width: 32, height: 20 }).toBitmap());
  if (blankCapture(hash)) return;
  return { jpeg, hash };
}

/** Driven by the existing behaviour tick: zero timers/captures when disabled. */
export class ScreenAwareness {
  private pending?: AbortController;
  private next = 0;
  private changedAt?: number;
  private key = '';
  private hash?: Uint8Array;
  private epoch = 0;
  constructor(
    private input: () => VisionInput,
    private infer: (jpeg: string, model: string, context: DialogueContext, signal: AbortSignal) => Promise<DirectedSpeech | undefined>,
    private present: (speech: DirectedSpeech) => boolean,
    private pulse: () => void,
    private capture: (sample: ForegroundSample) => Promise<CapturedWindow | undefined>,
    private clock = Date.now,
    private rng = Math.random,
  ) {}
  /** Abort in-flight work only. Transient blocks (a minute of reading, a quick conversation) must not restart the cadence. */
  pause(): void { this.epoch++; this.pending?.abort(); }
  cancel(): void {
    this.epoch++; this.pending?.abort(); this.hash = undefined; this.key = ''; this.changedAt = undefined; this.next = 0;
    // Keep the in-flight lock until capture/inference actually settles.
  }
  changed(): void { this.epoch++; this.pending?.abort(); this.changedAt = this.clock() + 20000; this.hash = undefined; }
  tick(): void {
    const input = this.input(), range = TALK_CADENCE[input.talk].vision;
    if (!input.allowed || !range || !captureEligible(input.sample)) { this.pause(); return; }
    const key = `${input.sample.hwnd}|${input.sample.safeTitle ?? ''}|${input.model}`;
    if (key !== this.key) { this.changed(); this.key = key; }
    if (!this.next) this.next = this.clock() + between(range, this.rng);
    if (this.pending || this.clock() < (this.changedAt ?? this.next)) return;
    this.changedAt = undefined; this.next = this.clock() + between(range, this.rng);
    const controller = new AbortController(); this.pending = controller;
    const epoch = this.epoch, started = this.clock();
    const valid = () => !controller.signal.aborted && this.epoch === epoch && this.input().allowed && this.clock() - started < 8000;
    const deadline = setTimeout(() => controller.abort(), 8000);
    this.pulse();
    void (async () => {
      let frame: CapturedWindow | undefined;
      try {
        frame = await this.capture(input.sample);
        if (!valid() || !frame || nearIdentical(this.hash, frame.hash)) return;
        const inference = this.infer(frame.jpeg, input.model, input.context, controller.signal);
        frame.jpeg = '';
        const result = await inference;
        // A cold/failed/dropped observation can retry at the next scheduled sample.
        // Only successful delivery establishes the unchanged-frame baseline.
        if (valid() && result && this.present(result)) this.hash = frame.hash;
      } catch { /* Never log OS errors, titles, image bytes, descriptions or model output. */ }
      finally { if (frame) frame.jpeg = ''; frame = undefined; clearTimeout(deadline); if (this.pending === controller) this.pending = undefined; }
    })();
  }
}
