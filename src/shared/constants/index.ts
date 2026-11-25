export const WINDOW = { width: 320, height: 300 } as const;
export const CHANNELS = {
  productivity: 'ducky:productivity', talkSave: 'ducky:talk-save',
  talkCopy: 'ducky:talk-copy', talkSend: 'ducky:talk-send', talkEnd: 'ducky:talk-end', talkTyping: 'ducky:talk-typing', talkPanel: 'ducky:talk-panel', libraryAction: 'ducky:library-action',
  forgetMemory: 'ducky:forget-memory',
  testAI: 'ducky:test-ai',
  getState: 'ducky:get-state', updateSettings: 'ducky:update-settings', command: 'ducky:command',
  hitTest: 'ducky:hit-test', hover: 'ducky:hover', dragStart: 'ducky:drag-start', dragEnd: 'ducky:drag-end',
  doubleClick: 'ducky:double-click', contextMenu: 'ducky:context-menu', dismissBubble: 'ducky:dismiss-bubble',
  animationComplete: 'ducky:animation-complete', state: 'ducky:state', cursor: 'ducky:cursor', position: 'ducky:position',
} as const;
