export const CONVERSATION_STATES = ['listening', 'thinking', 'responding', 'confused', 'explaining', 'amused', 'sarcastic', 'unsure', 'interrupted', 'conversation_end'] as const;
export type ConversationState = typeof CONVERSATION_STATES[number];
export const ANIMATION_IDS = [
  'alarm', 'focus', 'celebrate',
  'gaming', 'laptop', 'coffee', 'shrug', 'laughing', 'confused', 'thinking', 'thought', 'bread',
  'look_around', 'yawn', 'stretch', 'dance', 'side_eye', 'nap', 'strike', 'sunglasses', 'bread_snack', 'visitor',
  'idle', 'blink', 'look_left', 'look_right', 'walking', 'startled', 'picked_up',
  'falling', 'landing', 'sleeping', 'waking_up', 'angry', 'happy', 'talking', 'sitting',
] as const;
export type AnimationId = typeof ANIMATION_IDS[number];
export const EMOTION_IDS = ['neutral', 'curious', 'suspicious', 'startled', 'angry', 'happy', 'sleepy'] as const;
export type EmotionId = typeof EMOTION_IDS[number];

export interface CharacterAnimationAdapter {
  setConversationState(state: ConversationState | null): void;
  play(animation: string): void;
  setEmotion(emotion: string): void;
  setEyeTarget(x: number, y: number): void;
  setDirection(direction: 'left' | 'right'): void;
  setMovementSpeed(speed: number): void;
  setDragging(active: boolean): void;
  setSleeping(active: boolean): void;
  setVisible(visible: boolean): void;
  dispose(): void;
  onAnimationComplete(cb: (animation: string) => void): () => void;
}

/** Surface concerns belong to the adapter too; callers never inspect its SVG. */
export interface CharacterSurface extends CharacterAnimationAdapter {
  /** Optional world-space window origin samples for drag direction and drop distance. */
  setMotionPosition?(x: number, y: number): void;
  hitTest(x: number, y: number): boolean;
  setReducedMotion(active: boolean): void;
  setPaused(active: boolean): void;
  setTalking(active: boolean): void;
  setSunglasses(active: boolean): void;
  setDebugHitbox(active: boolean): void;
}
