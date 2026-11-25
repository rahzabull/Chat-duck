# Ducky.exe — Product Expansion & Updated UX Direction (from Rahul, 2026-11-25)

Condensed faithfully from Rahul's expansion brief. Supersedes `product-brief.md` where they differ.

**We are not building an AI assistant that looks like a duck. We are building a duck who happens to be an incredibly capable AI assistant.**
Traditional AI applications are designed around messages. Ducky is designed around moments.

## 1-2. Vision and capabilities
Full personal AI companion: intelligence, personality, productivity, contextual awareness, emotional expression, physical desktop
presence, can start interactions himself.
- Core: general questions and conversation, brainstorming, writing/copywriting, learning/explanations, coding/debugging, personal
  advice, problem-solving, planning/decisions, casual chat, humour, design feedback, ongoing projects, remembering preferences and
  previous discussions.
- Advanced (modular, progressive): image analysis, document/PDF analysis, web research, calendar, email assistance, file assistance,
  authorised computer automation, custom skills.

## 3. No conventional chat UI
- Double-click Ducky or a keyboard shortcut starts a conversation. A small text input appears near him. User types (or speaks).
- He answers in a speech bubble. Only the current response is visible; previous messages disappear. Context is kept internally.
- When the conversation ends the UI disappears and he returns to his own activities.
- Avoid: scrolling threads, sidebars, session management, stacked bubbles, large permanent chat windows, chatbot chrome.
- Optional conversation archive in settings for retrieval/export/deletion, according to privacy and retention preferences.

## 4. Conversational continuity + memory
"Remember that Christmas campaign we discussed yesterday?" must work without reopening a conversation.
Memory layers: immediate context, recent conversations, long-term user-approved memories, preferences, ongoing projects, saved ideas
and notes, tasks and reminders, shared jokes/past interactions. Local, configurable, editable, deletable.
User can ask: "What do you remember about me?", "Remember this.", "Forget that.", "What were we discussing yesterday?"
Never silently retain sensitive desktop observations.

## 5. Conversational animation states (adapter-exposed, placeholder now, Rive later)
Waiting = idle; user typing = looks attentively at user; user speaking = listens and nods; thinking = scratches head / looks up;
responding = mouth + wing gestures; confused = head tilt; explaining = expressive gestures; amused = laughs; sarcastic = side-eye;
unsure = shrug; interrupted = stops and listens; finished = returns to previous activity.

## 6. Context-sensitive response interfaces (temporary, dismissable)
Casual/simple → speech bubble; complex explanation → expandable reading panel; to-do list → interactive task card; schedule →
agenda card; reminder → confirmation card; writing → editable document panel; code → code panel; comparison → table; image →
image feedback panel; brainstorming → idea cards; saved info → notes panel.
Actions: expand, collapse, copy, save, pin, export where appropriate, dismiss, recall saved outputs later.
"The conversation is temporary. The useful work can be permanent."

## 7. Productivity (must all work without AI)
- To-dos: create/edit/delete, due dates, priorities, categories, subtasks, completion, overdue, today/upcoming views, natural language.
- Reminders: one-time, recurring, relative, daily/weekly/monthly, snooze, reschedule, missed recovery, optional OS notifications.
- Notes: save ideas via conversation, personal notes, natural retrieval, by topic/project, edit/delete.
- Focus: pomodoro, custom durations, breaks, pause/resume, fewer interruptions, optional history, quiet animations.
- Daily planning: morning briefing, upcoming deadlines, pending tasks, priorities, end-of-day summary, optional calendar.

## 8. Proactive intelligence
Occasionally starts conversations, offers help, has thoughts ("Good morning. You've got four tasks today. I've got none. Life is
beautiful."; "That presentation is due tomorrow. Shall we collectively panic or make a plan?"; "Oi. Remember that thing you said
you'd do?"; "Holy shit. You actually did it."). Considers mood, preferences, time, permitted app context, tasks, deadlines, past
interactions, recent dialogue, interruption frequency, focus, do-not-disturb. Can decide to say nothing.

## 9. Contextual assistance
Awareness serves jokes and help: "Want me to brainstorm some alternatives?", "Need help writing copy for this?", "Should I save this
idea?". Visual analysis of a selected window only with separate authorisation. All privacy rules stand; awareness off by default.

## 10. Modes (behavioural states of one character)
Companion, Conversation, Productivity, Focus, Privacy (no observation or related AI), Gaming/Do-not-disturb (suppress animations,
dialogue, interruptions, AI usage).

## 11. Voice (eventually primary)
Push-to-talk shortcut → he turns to user → listens → thinks → answers in his character voice → interruptible, follow-ups → back to
activities. Local STT/TTS where possible, character voice, natural pauses, optional subtitles, mute, explicit mic permission,
visible listening indicator, never always-listening by default. Text stays fully supported.

## 12. Interchangeable brain
Local by default (Ollama, offline, local memory/vision). Optional cloud only by explicit opt-in, configurable provider, transparent
about what is sent; never silent fallback to cloud; never auto-send desktop observations, memories or screenshots.
Common intelligence layer: conversation, memory retrieval, context, personality, tool selection, structured responses, proactive
behaviour, permission enforcement.

## 13. Agent capabilities
Restricted, permission-based tools: tasks, reminders, notes, search permitted files, read provided documents, web research, draft
emails, authorised calendar, approved workflows. Confirmation for sensitive/destructive/external actions. Never claim success unless
the operation actually succeeded.

## 14. Skill packs (independent of personality)
Creative, Developer, Productivity, Student, Companion. E.g. creative assistant + unhinged personality.

## 15. Engineering additions
Conversation engine, persistent context, memory retrieval, provider abstraction, structured tool execution, permission management,
dynamic response panels, temporary conversation UI, saved outputs, notes, proactive scheduler, STT adapter, TTS adapter,
conversational animation states, extensible skills. Keep the modular Rive architecture; placeholder must demonstrate the states.

## 16. Priorities
- P0: desktop companion, placeholder animations, full local AI conversation, current-response-only UI, conversational context, basic
  persistent memory, to-dos, scheduled + recurring reminders, notes, focus timer, autonomous thoughts, personality settings, optional
  app awareness, contextual AI humour, privacy controls.
- P1: dynamic response panels, advanced memory retrieval, image/document analysis, selected-window vision, voice, daily briefings,
  calendar, final Rive character.
- P2: web research, optional cloud AI, file and email assistance, authorised automation, custom skills, multiple characters,
  cross-device.

## 17. Non-negotiable UX principles
1. The character is the primary interface. 2. No persistent chat history by default. 3. Natural, continuous conversation.
4. Initiative without being annoying. 5. Useful intelligence, not only jokes. 6. Important things can be saved apart from
conversations. 7. Animations communicate emotion and intent. 8. User controls privacy and interruptions. 9. Productivity is
reliable without AI. 10. Never a dashboard with a mascot attached.
