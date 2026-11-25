export interface Point { x: number; y: number }
export interface WorkArea extends Point { width: number; height: number; id: number }
export type Direction = 'left' | 'right';
export interface Settings {
  conversationShortcut: string;
  conversationRetention: import('../../core/conversation/types').Retention;
  personality: 'wholesome' | 'playful' | 'sarcastic' | 'unhinged';
  profanity: boolean;
  activityLevel: 'calm' | 'normal' | 'lively';
  memoryEnabled: boolean;
  preferredName: string;
  installSeed: number;
  dailyMood: { date: string; mood: import('../../core/emotions').Mood } | null;
  alwaysOnTop: boolean;
  desktopOnly: boolean;
  characterSize: number;
  launchAtStartup: boolean;
  walking: boolean;
  talkativeness: 'quiet' | 'normal' | 'chatty';
  idleToSleepMinutes: number;
  reducedMotion: boolean;
  mute: boolean;
  appAwareness: boolean;
  aiEnabled: boolean;
  aiModel: string;
  ollamaPort: number;
  firstLaunchDone: boolean;
  position: Point | null;
}
export type EditableSettings = Omit<Settings, 'firstLaunchDone' | 'position' | 'installSeed' | 'dailyMood'>;
export interface BrainState {
  phase: 'disabled' | 'offline' | 'warming' | 'connected' | 'error' | 'suspended';
  message: string;
  models: string[];
  version?: string;
  sample?: string;
}
export interface CompanionState {
  productivity?: import('../../core/productivity/types').ProductivityView;
  productivitySpeech?: string;
  conversation?: import('../../core/conversation/types').ConversationView;
  library?: { memories: import('../../core/conversation/types').UserMemory[]; conversations: import('../../core/conversation/types').Conversation[] };
  visible: boolean; paused: boolean; sleeping: boolean; dragging: boolean;
  sunglasses: boolean; mood: string; memory: string[];
  awarenessActive: boolean;
  brain: BrainState;
  animation: string; animationRevision: number; emotion: string; direction: Direction; movementSpeed: number;
  bubble: string | null; settings: Settings; debugHitbox: boolean; version: string;
}
export interface CursorUpdate { cursor: Point; origin: Point }
export type Command = 'talk' | 'tasks' | 'add-task' | 'add-reminder' | 'focus' | 'notes' | 'show' | 'hide' | 'pause' | 'mute' | 'reset' | 'settings' | 'quit';
export interface DuckyAPI {
  readonly placeholderDuck?: boolean;
  productivity(action: import('../../core/productivity/types').ProductivityAction): Promise<import('../../core/productivity/types').ProductivityResult>;
  talkSave(pinned: boolean): Promise<import('../../core/productivity/types').ProductivityResult>;
  talkCopy(): Promise<void>;
  talkSend(text: string): Promise<void>;
  talkEnd(): Promise<void>;
  talkTyping(): void;
  talkPanel(expanded: boolean): void;
  libraryAction(action: import('../../core/conversation/types').LibraryAction): Promise<void>;
  getState(): Promise<CompanionState>;
  testAI(): Promise<void>;
  forgetMemory(): Promise<CompanionState>;
  updateSettings(patch: Partial<EditableSettings>): Promise<CompanionState>;
  command(command: Command): Promise<void>;
  hitTest(interactive: boolean): void;
  hover(active: boolean): void;
  dragStart(point: Point): Promise<void>;
  dragEnd(): Promise<void>;
  doubleClick(): void;
  contextMenu(): void;
  dismissBubble(): void;
  animationComplete(animation: string): void;
  onState(callback: (state: CompanionState) => void): () => void;
  onCursor(callback: (update: CursorUpdate) => void): () => void;
  onPosition(callback: (origin: Point) => void): () => void;
}
declare global { interface Window { ducky: DuckyAPI } }
