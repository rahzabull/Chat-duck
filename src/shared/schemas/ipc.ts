import { CHANNELS } from '../constants';
import { ANIMATION_IDS } from '../../animation/adapter';
import { isPoint, isSettingsPatch } from './settings';

const empty = new Set<string>([
  CHANNELS.testAI, CHANNELS.forgetMemory,
  CHANNELS.getState, CHANNELS.dragEnd, CHANNELS.doubleClick, CHANNELS.contextMenu, CHANNELS.dismissBubble,
]);
export function validatePayload(channel: string, value: unknown): boolean {
  if (empty.has(channel)) return value === undefined;
  switch (channel) {
    case CHANNELS.updateSettings: return isSettingsPatch(value);
    case CHANNELS.command: return ['show', 'hide', 'pause', 'mute', 'reset', 'settings', 'quit'].includes(value as string);
    case CHANNELS.hitTest:
    case CHANNELS.hover: return typeof value === 'boolean';
    case CHANNELS.dragStart: return isPoint(value);
    case CHANNELS.animationComplete: return (ANIMATION_IDS as readonly unknown[]).includes(value);
    default: return false;
  }
}
