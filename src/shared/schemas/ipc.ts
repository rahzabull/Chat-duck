import { CATEGORIES } from '../../core/conversation/types';
import { validAction } from '../../core/productivity/validation';
import { isRecord } from './settings';
import { CHANNELS } from '../constants';
import { ANIMATION_IDS } from '../../animation/adapter';
import { isPoint, isSettingsPatch } from './settings';

const empty = new Set<string>([
  CHANNELS.talkCopy, CHANNELS.talkEnd, CHANNELS.talkTyping, CHANNELS.testAI, CHANNELS.forgetMemory,
  CHANNELS.getState, CHANNELS.dragEnd, CHANNELS.doubleClick, CHANNELS.contextMenu, CHANNELS.dismissBubble,
]);
export function validatePayload(channel: string, value: unknown): boolean {
  if (empty.has(channel)) return value === undefined;
  switch (channel) {
    case CHANNELS.productivity: return validAction(value);
    case CHANNELS.talkSave: return typeof value === 'boolean';
    case CHANNELS.talkSend: return typeof value === 'string' && value.trim().length > 0 && value.length <= 4000;
    case CHANNELS.talkPanel: return typeof value === 'boolean';
    case CHANNELS.libraryAction: {
      if (!isRecord(value)) return false;
      const keys = Object.keys(value).sort().join(',');
      const id = typeof value.id === 'string' && /^[\w-]{1,80}$/.test(value.id);
      if (value.action === 'delete-conversations') return keys === 'action';
      if (['delete-memory', 'delete-conversation', 'export'].includes(value.action as string)) return id && keys === 'action,id';
      if (!['add', 'edit'].includes(value.action as string) || typeof value.text !== 'string' || !value.text.trim() || value.text.length > 4000 || !CATEGORIES.includes(value.category as never)) return false;
      return value.action === 'add' ? keys === 'action,category,text' : id && keys === 'action,category,id,text';
    }
    case CHANNELS.updateSettings: return isSettingsPatch(value);
    case CHANNELS.command: return ['talk', 'tasks', 'add-task', 'add-reminder', 'focus', 'notes', 'show', 'hide', 'pause', 'mute', 'reset', 'settings', 'quit'].includes(value as string);
    case CHANNELS.hitTest:
    case CHANNELS.hover: return typeof value === 'boolean';
    case CHANNELS.dragStart: return isPoint(value);
    case CHANNELS.animationComplete: return (ANIMATION_IDS as readonly unknown[]).includes(value);
    default: return false;
  }
}
