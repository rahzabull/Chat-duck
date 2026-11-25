import type { AnimationId, EmotionId } from '../../animation/adapter';
import type { Priority } from '../../core/interruptions';

/** M2 extension contract only. No provider, transport, or inference exists in M1. */
export interface CharacterProposal {
  shouldSpeak: boolean;
  dialogue: string;
  animation: AnimationId;
  emotion: EmotionId;
  priority: Priority;
  cooldownSeconds: number;
}
export interface AIProvider {
  readonly id: string;
  generate(context: Readonly<{ prompt: string; recentDialogue: readonly string[] }>, signal: AbortSignal): Promise<CharacterProposal>;
  dispose(): Promise<void>;
}
