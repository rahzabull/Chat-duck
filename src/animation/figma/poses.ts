import type { ConversationState } from '../adapter';

export const ACTIVITY_POSES: Record<string, string> = {
  idle: 'idle', walking: 'idle', blink: 'idle', talking: 'idle',
  look_left: 'interested', look_right: 'interested', look_around: 'interested',
  startled: 'emote', picked_up: 'dragged_up_down', falling: 'dragged_up_down',
  sleeping: 'sleepy', nap: 'sleepy', waking_up: 'emote', angry: 'bored', happy: 'happy',
  sitting: 'chilling', focus: 'chilling', laptop: 'chilling', gaming: 'interested', coffee: 'chilling',
  alarm: 'emote', celebrate: 'happy', shrug: 'emote', laughing: 'smile', confused: 'interested',
  thought: 'thinking_a', thinking: 'thinking_a', yawn: 'sleepy', stretch: 'emote', dance: 'happy',
  side_eye: 'not_interested', strike: 'bored', sunglasses: 'chilling', bread_snack: 'happy', bread: 'happy', visitor: 'listening',
};
export const CONVERSATION_POSES: Record<ConversationState, string> = {
  listening: 'listening', thinking: 'thinking_a', responding: 'idle', confused: 'interested',
  explaining: 'emote', amused: 'smile', sarcastic: 'not_interested', unsure: 'emote',
  interrupted: 'emote', conversation_end: 'idle',
};
export const EMOTION_POSES: Record<string, string> = {
  neutral: 'idle', curious: 'interested', interested: 'interested', suspicious: 'not_interested',
  startled: 'emote', angry: 'bored', annoyed: 'bored', happy: 'happy', amused: 'smile',
  sleepy: 'sleepy', bored: 'bored', not_interested: 'not_interested', 'not-interested': 'not_interested',
};
export const EXTRA_NAMES: Record<string, string> = { focus: 'laptop', bread_snack: 'bread', unsure: 'shrug', amused: 'laughing', explaining: 'shrug', sarcastic: 'strike', nap: 'yawn' };

/** Velocity comes from window position samples, never from the window-local gaze target. */
export function dragPose(dx: number, dy: number): string {
  return Math.abs(dx) > Math.abs(dy) * 1.2 && Math.abs(dx) > .5 ? (dx < 0 ? 'dragged_left' : 'dragged_right') : 'dragged_up_down';
}
