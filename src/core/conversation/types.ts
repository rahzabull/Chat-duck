export const CATEGORIES = ['about_me', 'preference', 'project', 'idea', 'other'] as const;
export type Category = typeof CATEGORIES[number];
export interface UserMemory { id: string; text: string; category: Category; createdAt: number; source: 'user_said' | 'user_edited' }
export interface Turn { role: 'user' | 'assistant'; text: string; at: number }
export interface Conversation { id: string; startedAt: number; endedAt: number; turns: Turn[]; summary?: string; topics?: string[] }
export type Retention = 'off' | '7 days' | '30 days';
export const TONES = ['neutral', 'amused', 'sarcastic', 'unsure', 'confused', 'explaining', 'warm'] as const;
export type Tone = typeof TONES[number];
export interface ToolCall { name: string; args: Record<string, unknown> }
export interface Reply { reply: string; tone: Tone; tool: ToolCall | null }
export const TOOL_NAMES = ['remember', 'forget', 'recall_memories', 'recall_conversations'] as const;
export const cleanText = (text: string): string => text.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').trim();
export interface ConversationView {
  active: boolean; state: import('../../animation/adapter').ConversationState | null;
  forceBubble?: boolean;
  draft?: { text: string; revision: number };
  inputReady?: boolean; focusRequest?: number; focusFailed?: boolean;
  reply: string; revision: number; panel: boolean; shortcutError: string;
  layout?: { x: number; y: number; width: number; height: number; contentX: number; contentBottom: number; contentWidth: number; contentHeight: number };
}
export type LibraryAction =
  | { action: 'add'; text: string; category: Category }
  | { action: 'edit'; id: string; text: string; category: Category }
  | { action: 'delete-memory' | 'delete-conversation' | 'export'; id: string }
  | { action: 'delete-conversations' };
