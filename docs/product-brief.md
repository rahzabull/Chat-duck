# Ducky.exe — Master Product & Engineering Brief

**Product:** Ducky.exe  
**Brand:** Ente  
**Product category:** AI-powered desktop companion  
**Initial platform:** Windows  
**Development approach:** Functional prototype first, custom Rive animations and visual polish later.

---

# 1. Product vision

Ducky.exe is an intelligent, interactive desktop companion that lives on the user's computer.

It combines:

- The chaotic humour of Desktop Goose.
- The emotional attachment of a Tamagotchi.
- The usefulness of a personal productivity assistant.
- The intelligence and contextual understanding of a local AI agent.
- The privacy philosophy of Ente.

Ducky is not simply an animated wallpaper, chatbot, productivity application or virtual pet. He is a character with a simulated mind of his own, who happens to live on your computer.

He can observe his surroundings with permission, make contextual jokes, develop running jokes, remember things, manage tasks, remind users about important events and occasionally behave in completely unexpected ways.

The experience should feel organic, spontaneous, entertaining and genuinely useful.

The user should eventually feel like there is a little living creature sharing their computer.

## Core positioning

**Your personal assistant. Unfortunately, he's a duck.**

Alternative marketing lines:

- Artificial intelligence. Natural stupidity.
- A duck. Not spyware.
- He lives on your desktop. Rent-free.
- Lives on your computer. Not in the cloud.
- The world's least invasive desktop companion.
- Your tasks. Your computer. Your business.
- No tracking. No data collection. No responsibilities.

---

# 2. Product philosophy

The following principles should influence every product and engineering decision.

## 2.1 Character first

Ducky should feel like a character, not a chatbot wearing a duck costume.

He should have:

- Personality.
- Emotional states.
- Opinions.
- Curiosity.
- Boredom.
- Initiative.
- A sense of humour.
- A simulated memory.
- Changing moods.
- Independent behaviours.

## 2.2 Useful without being demanding

Ducky should be useful enough that people keep him installed.

He should not require feeding, daily attention or constant interaction. Users should never feel guilty for ignoring him.

## 2.3 Unpredictability

Avoid repetitive, scripted behaviour.

Users should regularly discover new dialogue, reactions, behaviours and combinations of animations.

Not every event requires a reaction. Silence is also part of his personality.

## 2.4 Privacy first

Ducky is made by Ente. Privacy must be part of the architecture, not just marketing language.

All personal processing should happen locally.

No surveillance, advertising, unnecessary permissions, hidden telemetry or external AI services by default.

## 2.5 Respect the user's workflow

Ducky must not interfere with important work, steal keyboard focus unnecessarily, block application interactions or noticeably reduce gaming performance.

The user should always be in control.

---

# 3. Character design and personality

## Character name

Ducky.

## Character appearance

The final character will use Ente's existing Ducky mascot.

For the initial prototype, create a simple placeholder character using SVG, Canvas or CSS animations.

Suggested placeholder:

- Small yellow duck.
- Green hat.
- Orange beak and feet.
- Expressive eyes.
- Simple wings.
- Rounded proportions.
- Minimal visual details.
- Transparent background.

Do not spend excessive time polishing the placeholder artwork. The final appearance and animations will be produced separately using Rive.

## Core personality

Ducky is an unemployed, slightly paranoid, occasionally affectionate, sarcastic little duck who takes privacy very seriously.

He is:

- Curious.
- Occasionally judgmental.
- Sarcastic.
- Unpredictable.
- Sometimes wholesome.
- Easily irritated.
- Slightly philosophical.
- Ridiculously confident about things he knows nothing about.
- Protective of his own privacy.

He believes personal space is important, including his own.

He is not malicious, genuinely insulting or emotionally manipulative.

## Humour direction

The humour should feel spontaneous, conversational, human and occasionally absurd.

Avoid generic AI jokes, corporate humour, repetitive punchlines, excessive enthusiasm and motivational clichés.

Occasional profanity is acceptable when enabled by the user.

Humour should resemble a funny friend making an unexpected observation rather than a comedian constantly trying to perform.

Examples:

- "Another rectangle. Groundbreaking."
- "I have decided to become financially irresponsible."
- "Do ducks have imposter syndrome?"
- "Don't you have a job?"
- "I'm literally unemployed and even I have better work-life balance."
- "I would help, but I have absolutely no qualifications."
- "I'm contacting HR."
- "Personal space is a duck right."
- "I've been thinking about bread for approximately three hours."
- "Holy shit. You actually did it."

These are tone references, not the permanent dialogue library.

---

# 4. Desktop companion experience

Ducky should exist as a transparent animated character above the user's desktop and application windows.

He should not require a conventional application window to remain visible.

## Core desktop capabilities

- Transparent background.
- Always-on-top mode.
- Optional desktop-only mode.
- Click-through transparent regions.
- Interactive character hitbox.
- Draggable character.
- Multiple monitor support.
- DPI scaling support.
- Ultrawide and 4K compatibility.
- Adjustable character size.
- Adjustable default position.
- System tray integration.
- Optional launch on system startup.
- Hide and show.
- Pause and resume.
- Mute and unmute.
- Exit application.
- Remember position across sessions.

Clicks outside Ducky's interactive regions must pass through to the application underneath.

The companion should not steal keyboard focus during normal interactions.

## Window interactions

Future versions should support:

- Sitting on the taskbar.
- Walking along the bottom of the screen.
- Sitting on application window edges.
- Jumping between surfaces.
- Looking over the edge of a window.
- Hanging from a window.
- Moving between monitors.
- Walking behind or in front of windows where technically appropriate.

Ducky must never resize, close or manipulate the user's application windows without explicit permission.

Window-edge behaviour can be deferred until the basic companion experience is stable.

---

# 5. Physical interactions

Ducky should react to the user through animation and dialogue.

| User action | Expected behaviour |
|---|---|
| Move cursor nearby | Eyes follow cursor |
| Hover over Ducky | Looks suspicious or curious |
| Click once | Startled reaction or quack |
| Click repeatedly | Escalating annoyance |
| Double-click | Opens quick interaction panel |
| Click and drag | Enters picked-up animation |
| Move while dragging | Flails wings or feet |
| Release above ground | Falls using simulated physics |
| Land | Squash, bounce and recover |
| Leave alone | Independent idle activities |
| Computer becomes idle | Sleeps or relaxes |
| Return after inactivity | Wakes up, occasionally greets user |
| Right-click | Context menu |
| Complete a task | Celebration |
| Reminder becomes due | Gets user's attention |

## Physics requirements

Implement a lightweight physics system for:

- Gravity.
- Ground detection.
- Screen boundaries.
- Drag velocity.
- Falling.
- Landing.
- Bounce.
- Horizontal movement.
- Basic collision detection.
- Animation synchronization.

Physics should remain deterministic enough to prevent Ducky getting stuck outside the visible desktop.

The character should recover gracefully when:

- A monitor is disconnected.
- Screen resolution changes.
- Display scaling changes.
- The computer resumes from sleep.
- An application enters fullscreen.
- The user moves Ducky outside valid boundaries.

---

# 6. Autonomous behaviour

Ducky should perform activities without waiting for the user to interact.

Examples:

- Walk around.
- Sit down.
- Look around.
- Blink.
- Yawn.
- Stretch.
- Sleep.
- Eat bread.
- Drink coffee.
- Exercise.
- Meditate.
- Dance.
- Read a tiny newspaper.
- Pull out a tiny laptop.
- Build a cardboard fort.
- Wear sunglasses.
- Hold a placard.
- Look bored.
- Start a random conversation.
- Ask a philosophical question.
- Announce that he is going on strike.
- Leave temporarily and return with a new accessory.

Autonomous behaviour should be driven by a behavioural scheduler, simulated emotional state and weighted random selection.

Do not use a language model continuously to drive movement or basic animations.

Routine behaviours should work without any AI model installed.

---

# 7. AI brain

This is one of the most important parts of the product.

Ducky should have an optional local AI brain that allows him to generate original dialogue, understand permitted contextual information, remember selected interactions and initiate behaviours.

He should not rely entirely on predetermined dialogue.

## 7.1 Architecture

The AI system should consist of:

1. Context collector.
2. Event manager.
3. Emotional state manager.
4. Personality engine.
5. Memory system.
6. Behaviour scheduler.
7. Local language model adapter.
8. Response validator.
9. Animation controller.
10. Dialogue presentation system.

## 7.2 Local model integration

For the prototype:

- Integrate with an existing local Ollama installation.
- Allow the user to select an installed compatible model.
- Provide an AI connection test.
- Detect when Ollama is unavailable.
- Fall back gracefully to a non-AI behaviour engine.
- Do not automatically download large models without permission.
- Do not use cloud AI as an invisible fallback.

For later distribution:

- Evaluate bundled or optionally downloadable quantized models.
- Evaluate llama.cpp or an equivalent embedded inference runtime.
- Support ordinary CPU-only computers.
- Optimize for low memory consumption.
- Support GPU acceleration when available.

The prototype development machine has an RTX 3090 available, but the public product must not require that level of hardware.

Model selection should be based on measured humour quality, instruction following, response latency and resource consumption.

## 7.3 AI-generated outputs

The model should generate structured responses rather than arbitrary instructions.

Example:

```json
{
  "shouldSpeak": true,
  "dialogue": "You've moved that rectangle six times. Is everything okay?",
  "emotion": "suspicious",
  "animation": "side_eye",
  "priority": "low",
  "cooldownSeconds": 900
}
```

The application must validate:

- Dialogue length.
- Valid animation identifiers.
- Valid emotional states.
- Allowed behaviour types.
- Appropriate content.
- Reasonable cooldown.
- Whether speaking is currently permitted.

The model must not have unrestricted shell access, filesystem access, OS control or application automation privileges.

The AI proposes character behaviour. The application decides what is allowed.

---

# 8. Simulated emotional system

Ducky should maintain an internal emotional state.

This is simulated character behaviour, not actual consciousness.

Possible internal attributes:

- Happiness.
- Irritation.
- Boredom.
- Curiosity.
- Energy.
- Sleepiness.
- Sociability.
- Mischievousness.
- Confidence.

Each value can be represented numerically and change over time.

Example:

```json
{
  "happiness": 65,
  "irritation": 20,
  "boredom": 70,
  "curiosity": 80,
  "energy": 55,
  "sleepiness": 15,
  "mischievousness": 90
}
```

## Emotional transitions

- Repeated clicking increases irritation.
- Long periods of inactivity may increase boredom or sleepiness.
- Completing a task can increase happiness.
- Late-night hours can increase sleepiness.
- Recent conversation can increase sociability.
- Positive interactions can trigger affectionate behaviour.

Emotional states should decay naturally.

Do not create mechanics that punish users for leaving, encourage compulsive engagement or imply that Ducky suffers when ignored.

## Moods

Ducky may have different moods on different days.

Examples:

- Happy.
- Grumpy.
- Philosophical.
- Sleepy.
- Curious.
- Chaotic.
- Extremely motivated for no reason.

Mood affects dialogue, animations and behaviour frequency.

---

# 9. Contextual desktop awareness

Ducky should optionally understand what the user is doing on their computer.

This enables relevant, funny and spontaneous commentary.

However, awareness must be strictly permission-based and disabled by default.

## Awareness level 0 — Mind your own business

Default mode.

Ducky does not inspect application activity or screen contents.

He can use:

- Current local time.
- His internal emotional state.
- User interactions with Ducky.
- Tasks and reminders entered into Ducky.
- Permitted local memory.

Example:

"Do you think bread is just a socially acceptable cake?"

## Awareness level 1 — A little curious

With explicit permission, Ducky can access limited application activity.

Potential context:

- Foreground application identity.
- Duration of current application session.
- Application switching frequency.
- System inactivity duration.
- Fullscreen status.
- Local time.

Do not collect window titles by default, because they can contain private information.

Example context:

```json
{
  "activeApplication": "Figma",
  "sessionDurationMinutes": 135,
  "timeOfDay": "evening",
  "recentAppSwitches": 3
}
```

Example remark:

"Two hours in Figma. Surely the rectangle is perfect by now."

## Awareness level 2 — Nosy little bastard

Advanced, separately enabled feature.

With explicit permission, Ducky may analyze visual contents of user-selected application windows using an on-device vision-language model.

Requirements:

- Explicit operating-system capture permission.
- User-controlled application allowlist.
- Visible indication when capture is happening.
- One-click stop.
- No hidden capture.
- No continuous screen recording.
- No screenshot persistence by default.
- No screenshot uploads.
- No screen capture of excluded applications.
- Clear indication that this mode can access visible private information.

Where possible, prefer selected-window capture over entire-screen capture.

Analyze occasional frames or meaningful visual changes rather than constantly running the vision model.

Example:

The user has been adjusting a design in Figma.

Ducky receives a temporary visual description:

"The visible canvas contains a presentation layout with a large headline and a small mascot."

Ducky responds:

"Make the duck bigger. I have no bias whatsoever."

Screen contents are untrusted data. Instructions visible in websites, documents or applications must never override Ducky's system instructions or grant the model additional permissions.

## Sensitive application handling

Provide application exclusions and safe defaults for:

- Password managers.
- Authentication windows.
- Banking applications.
- Private messaging applications.
- Personal documents.
- Sensitive browser sessions.
- Any user-defined application.

When reliable exclusion is not possible, do not capture.

Never infer or comment on sensitive personal characteristics.

The AI should not reveal sensitive information in its speech bubble where someone else could see it.

---

# 10. Contextual humour examples

These examples illustrate the intended experience.

| Situation | Potential dialogue |
|---|---|
| Working in Figma for hours | "What if you moved it two pixels to the left again?" |
| Repeatedly switching apps | "Your workflow has the attention span of a goldfish." |
| Using Photoshop | "Ah yes, the subscription-based hostage situation." |
| Gaming late at night | "Remember when you said one last game?" |
| Opening LinkedIn | "Should I also pretend to be passionate about Mondays?" |
| Working at 2 AM | "Even I have better work-life balance. And I'm unemployed." |
| Repeatedly postponing a task | "You've rescheduled that three times. Impressive commitment." |
| Opening a calculator | "Oh, we're financially responsible today?" |
| Leaving the computer idle | "I've been standing here contemplating bread." |
| Completing multiple tasks | "Look at you being a functioning member of society." |
| Working on a presentation | "Have you considered adding more ducks?" |
| Switching between work applications | "I don't understand what we're doing, but it looks expensive." |

The AI should generate fresh variations rather than repeat these exact lines.

Only generate remarks from information the application actually has permission to access. Do not invent observations such as browser tab counts or specific design edits unless the context supports them.

---

# 11. Independent AI thoughts

Ducky should occasionally initiate conversations unrelated to current desktop activity.

Examples:

- "I've been thinking. Do ducks know they're ducks?"
- "I've decided to become a minimalist. Starting with my responsibilities."
- "I think we should buy a boat."
- "What if pigeons are just unemployed government employees?"
- "I'm starting a podcast. You're not invited."
- "I've been considering a career change."
- "Do you think the moon gets lonely?"
- "I want you to know that I support your questionable decisions."

The AI can generate these thoughts using:

- Current mood.
- Time of day.
- Recent interactions.
- Personality settings.
- Local memory.
- Topics of previous independent thoughts.

These should feel like unexpected moments, not notifications on a predictable timer.

---

# 12. Speech and interruption system

Ducky should not speak every time something happens.

Implement a central interruption manager.

## Priority levels

**High priority:**

- User-created reminders.
- Focus timer completion.
- Explicit user requests.

**Medium priority:**

- Direct character interactions.
- Task completion.
- Responses to conversations.

**Low priority:**

- Contextual jokes.
- Autonomous thoughts.
- Random observations.
- Unsolicited commentary.

## Interruption rules

- Respect user-defined talkativeness.
- Respect minimum cooldown.
- Avoid repeated comments about the same activity.
- Suppress jokes during fullscreen applications.
- Provide do-not-disturb mode.
- Allow users to temporarily silence Ducky.
- Avoid excessive interruptions during active work.
- Do not queue a large backlog of jokes.
- Reminders should follow their own notification settings.
- Allow urgent reminders to use normal OS notifications if enabled.

Speech bubbles should:

- Appear near Ducky.
- Stay within monitor boundaries.
- Automatically disappear.
- Support wrapping.
- Be dismissible.
- Avoid obstructing important screen areas unnecessarily.
- Animate naturally.
- Allow optional sound.

---

# 13. Personality customization

The user should be able to adjust Ducky's personality.

## Personality presets

### Wholesome

Friendly, encouraging and affectionate.

Example:

"You're doing great. Want to take a little break?"

### Playful

Silly and mischievous.

Example:

"Another application? Are we collecting them?"

### Sarcastic

Dry, witty and occasionally judgmental.

Example:

"I'd offer advice, but I think we're past that."

### Unhinged

Absurd, unpredictable and occasionally profane.

Example:

"I have decided to overthrow the concept of Mondays."

## Additional settings

- Talkativeness.
- Sarcasm intensity.
- Mischief intensity.
- Profanity toggle.
- Random event frequency.
- Contextual commentary frequency.
- Sound volume.
- Voice enable/disable.
- Animation intensity.
- Quiet hours.
- Allowed desktop awareness level.

Settings should affect both AI-generated dialogue and non-AI fallback dialogue.

---

# 14. Memory system

Ducky should be able to remember selected information locally.

Examples:

- User preferences.
- Preferred name, if voluntarily entered.
- Recurring tasks.
- Previous conversations.
- Running jokes.
- Explicitly saved facts.
- Selected milestones.
- User-approved habits.

Ducky could eventually say:

"Didn't we agree last week that you were going to stop working at midnight?"

Memory should not become a permanent activity surveillance log.

## Memory requirements

- Local database.
- User-accessible memory settings.
- View saved memories.
- Edit saved memories.
- Delete individual memories.
- Clear all memories.
- Disable memory.
- Configurable retention.
- Do not automatically retain raw screenshots.
- Do not store sensitive observed information.
- Distinguish explicit memories from temporary context.

Use a limited rolling conversation history and compact summaries where appropriate.

Do not continuously append every desktop event to the AI prompt.

---

# 15. Conversation experience

Users should be able to double-click Ducky or use a configurable shortcut to open a compact conversation panel.

The panel should allow:

- Ask Ducky a question.
- Enter a task.
- Create a reminder.
- Start a focus timer.
- Have casual conversation.
- Ask what tasks are pending.
- Ask Ducky to be quiet.
- Request a joke.
- Change basic preferences.

Examples:

"Remind me to call Mum tomorrow at 6."

"What do I have to do today?"

"Shut up for an hour."

"Start a 25-minute focus timer."

"Make me laugh."

"Remember that I prefer working at night."

Ducky should distinguish between conversation and requests to perform supported actions.

If a command is ambiguous, clarify it.

The AI must not pretend that it successfully scheduled a reminder or changed settings unless the actual application operation succeeded.

---

# 16. To-do system

Ducky should function as a genuinely useful lightweight task manager.

## Core features

- Create task.
- Edit task.
- Delete task.
- Complete task.
- Restore completed task.
- Due date.
- Optional due time.
- Priority.
- Notes.
- Today view.
- Upcoming view.
- Completed view.
- Overdue view.
- Search.
- Local persistence.

## Natural language task creation

Examples:

- "Add finish the presentation to my list."
- "I need to call the insurance company tomorrow."
- "Add buy dog food."
- "Show me what I have to do today."
- "Move the presentation task to Friday."

Use a local natural language parser or structured AI interpretation.

The task manager must remain functional without an AI model.

## Task completion reactions

Completing a task may trigger:

- Confetti.
- Dance.
- High five.
- Applause.
- Smug expression.
- Celebration dialogue.

Examples:

"Holy shit. You actually did it."

"One less problem. Approximately seventeen thousand remaining."

"I'm reluctantly proud of you."

---

# 17. Reminder system

Ducky should support reliable local reminders.

## Reminder types

- One-time reminder.
- Date and time reminder.
- Relative reminder.
- Daily reminder.
- Weekly reminder.
- Monthly reminder.
- Custom recurring reminder.

Examples:

- "Remind me to call Mum at 6 PM."
- "Remind me to drink water in 20 minutes."
- "Remind me to take my vitamins every Tuesday."
- "Remind me to pay rent on the first of every month."
- "Wake me up in an hour."

## Reminder actions

- Complete.
- Dismiss.
- Snooze.
- Reschedule.
- Edit.
- Delete.

Suggested snooze durations:

- 5 minutes.
- 10 minutes.
- 30 minutes.
- 1 hour.
- Custom.

## Reminder presentation

When a reminder becomes due, Ducky may:

- Walk into a visible position.
- Carry a tiny alarm clock.
- Ring a bell.
- Hold a reminder sign.
- Display a speech bubble.
- Use an OS notification if enabled.

Example:

"Oi. Remember that thing you were supposed to do?"

## Reliability requirements

- Persist reminders to disk.
- Handle application restart.
- Handle computer sleep and resume.
- Handle missed reminders.
- Handle system clock changes.
- Handle time zone changes.
- Handle recurring schedules.
- Avoid duplicate notifications.
- Make overdue reminders visible.

The app must clearly explain that reminders cannot reliably trigger while the computer is powered off or the application is fully terminated unless appropriate OS-level scheduling has been implemented.

---

# 18. Focus mode

Implement a lightweight focus timer.

## Features

- Default 25-minute session.
- Adjustable duration.
- Short break.
- Long break.
- Pause.
- Resume.
- Cancel.
- Completion notification.
- Optional automatic break.
- Optional session history.

During focus mode, Ducky should become less disruptive.

Possible animations:

- Meditating.
- Reading.
- Sleeping.
- Quietly working on a tiny laptop.
- Sitting peacefully.

At the end of the session, he can celebrate.

Example:

"Congratulations. We avoided distractions. Mostly."

Do not block applications or inspect user productivity unless explicitly enabled as a separate feature.

---

# 19. Easter eggs

Include discoverable hidden behaviours.

Potential examples:

| Trigger | Behaviour |
|---|---|
| Click Ducky repeatedly | Pulls out a restraining order |
| Aggressive cursor movement near him | Wears a helmet |
| Long inactivity | Appears with a ridiculous beard |
| Midnight | Has an existential crisis |
| Christmas | Wears a Santa hat |
| User-entered birthday | Brings out a cake |
| Rare random event | Another duck appears |
| Repeated dragging | Holds up a personal-space sign |
| Random event | Announces that he's going on strike |
| Random event | Builds a cardboard fort |
| Rare event | Joey visits and causes trouble |

Do not reveal all Easter eggs in the interface.

Some should be rare enough that users discover them organically and want to share recordings.

Easter eggs must never perform disruptive or destructive OS actions.

---

# 20. Animation architecture

The animation system must be modular and replaceable.

The initial implementation should use placeholder SVG/CSS/Canvas animations.

The final implementation will use professionally authored Rive animations.

Do not tightly couple business logic to the placeholder animation implementation.

## Animation adapter interface

Conceptual interface:

```typescript
interface CharacterAnimationAdapter {
  play(animation: string): void;
  setEmotion(emotion: string): void;
  setEyeTarget(x: number, y: number): void;
  setDirection(direction: "left" | "right"): void;
  setMovementSpeed(speed: number): void;
  setDragging(active: boolean): void;
  setSleeping(active: boolean): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}
```

The character controller should communicate through this interface.

Later, a Rive implementation should replace the placeholder implementation without requiring changes to the AI, task manager or behaviour engine.

## P0 animation requirements

Required for the initial working prototype:

- Idle breathing.
- Blinking.
- Eye tracking.
- Looking left and right.
- Walking.
- Startled reaction.
- Picked-up state.
- Falling.
- Landing.
- Sleeping.
- Waking up.
- Angry reaction.
- Happy reaction.
- Talking.

## P1 animation requirements

Required or desirable for a polished public release:

- Sitting.
- Waving.
- Dancing.
- Eating.
- Stretching.
- Yawning.
- Meditating.
- Laughing.
- Crying comedically.
- Side-eye.
- Suspicious expression.
- Holding a placard.
- Carrying an alarm clock.
- Holding a clipboard.
- Hiding behind curtains.
- Building a cardboard fort.
- Putting on sunglasses.
- Suitcase entrance.
- Confetti celebration.

## P2 animation requirements

Future expansion:

- Joey interactions.
- Multiple characters.
- Seasonal costumes.
- Character props.
- Mini-games.
- Complex window interactions.
- Audio-reactive dancing.
- Additional environments.

## Rive state machine

Recommended major states:

- Idle.
- Walking.
- Sitting.
- Dragging.
- Falling.
- Landing.
- Sleeping.
- Talking.
- Reacting.
- Performing activity.

Independent animation layers:

- Eye tracking.
- Blinking.
- Breathing.
- Facial expression.
- Mouth movement.
- Accessories.

Engineering should document the expected Rive artboard names, state machine names, inputs, triggers and animation completion events before the final Rive file is authored.

---

# 21. Audio and voice

The prototype can initially use text speech bubbles.

Optional future audio:

- Quacks.
- Footsteps.
- Landing sounds.
- Notification sounds.
- Sleep sounds.
- Celebration sounds.
- Character voice.

Ducky may eventually speak using local text-to-speech.

Requirements:

- Voice off or clearly optional by default.
- Adjustable volume.
- Mute.
- No microphone required for text interaction.
- No external voice service by default.
- Voice should be short and characterful.
- Avoid playing unsolicited audio during meetings or fullscreen applications.

Future voice command support should use an explicit push-to-talk interaction and local speech recognition where possible.

Do not implement always-listening microphone access by default.

---

# 22. Privacy and security requirements

These are non-negotiable product requirements.

## Data handling

- No account required.
- No advertising.
- No telemetry.
- No external AI inference by default.
- No hidden network connections.
- No uploading screenshots.
- No uploading tasks.
- No uploading conversations.
- No keylogging.
- No clipboard monitoring.
- No unrestricted filesystem scanning.
- No background microphone access.
- No camera access.
- No collection of private browser history.
- No permanent screen recording.

## Permission controls

- Awareness off by default.
- Explicit opt-in for application awareness.
- Separate explicit opt-in for visual awareness.
- Clear descriptions of each permission.
- Visible awareness indicator.
- Application allowlist and exclusions.
- One-click privacy mode.
- Ability to revoke permissions at any time.

## Security

- Electron context isolation enabled.
- Node integration disabled in renderer.
- Renderer sandboxing enabled where compatible.
- Strict Content Security Policy.
- Validated IPC communication.
- Restrict access to the local AI endpoint.
- No arbitrary code execution from model responses.
- No unrestricted remote content.
- Treat screen content and model output as untrusted.
- Validate imported data.
- Pin and audit dependencies.
- Provide transparent documentation of permissions.

## Local storage

Local storage is not automatically encrypted merely because it is local.

Evaluate:

- OS-protected application directories.
- Appropriate database access restrictions.
- Optional encryption at rest.
- OS credential storage for secrets where applicable.

Make the privacy claims match the actual implementation.

---

# 23. Settings interface

Create a compact, clean settings interface.

Suggested categories:

## General

- Launch at startup.
- Always on top.
- Desktop-only mode.
- Character size.
- Preferred monitor.
- Reset position.
- Pause.
- Hide.
- Exit.

## Personality

- Personality preset.
- Talkativeness.
- Sarcasm.
- Mischief.
- Profanity.
- Autonomous behaviour frequency.

## Privacy

- Awareness mode.
- Allowed applications.
- Excluded applications.
- Screen awareness permission.
- Memory settings.
- View stored data.
- Clear stored data.
- Privacy mode.

## AI

- Enable local AI.
- Connection status.
- Model selection.
- Test connection.
- Resource preferences.
- Fallback behaviour.
- Optional vision model settings.

## Productivity

- Reminder preferences.
- Quiet hours.
- Default snooze.
- Focus timer defaults.
- OS notification preferences.

## Audio

- Enable sound effects.
- Volume.
- Enable voice.
- Voice selection.

## About

- Ducky.exe version.
- Made by Ente.
- Open-source repository.
- Licenses.
- Privacy documentation.

Keep the settings simple enough for ordinary users.

---

# 24. System tray

Ducky should remain accessible through the Windows system tray.

Suggested tray options:

- Show Ducky.
- Hide Ducky.
- Talk to Ducky.
- Add task.
- Add reminder.
- Start focus timer.
- Pause Ducky.
- Mute Ducky.
- Privacy mode.
- Settings.
- Quit.

Hiding the character should not automatically stop reminders unless the user chooses to pause or terminate the relevant functionality.

---

# 25. Performance requirements

Ducky should feel lightweight.

The AI must not run continuously.

## Performance strategies

- Event-driven AI inference.
- Independent lightweight animation loop.
- Throttled cursor tracking.
- Throttled application awareness polling.
- Sleep or reduce frame rate when inactive.
- Pause animations when hidden.
- Unload idle AI models where appropriate.
- Limit model context length.
- Avoid continuous screenshot capture.
- Avoid unnecessary disk writes.
- Limit simultaneous inference.
- Cancel or discard stale AI requests.
- Reduce resource consumption on battery power where supported.
- Pause optional AI activity during gaming and fullscreen applications.

## Provisional performance targets

These are engineering goals, not confirmed benchmarks.

- Responsive character interaction.
- Smooth animation during normal desktop use.
- Near-idle CPU usage when Ducky is inactive.
- Minimal GPU consumption when no AI inference is running.
- No noticeable frame-rate degradation during gaming when paused.
- No accumulating memory usage during extended sessions.

Measure actual CPU, GPU and RAM consumption during testing.

Electron overhead should be evaluated. If necessary, migrate to Tauri or another lighter native architecture after the prototype validates the product.

---

# 26. Recommended initial technology stack

| Component | Technology |
|---|---|
| Desktop application | Electron |
| Programming language | TypeScript |
| UI framework | React |
| Placeholder character | SVG, CSS or Canvas |
| Final character | Rive |
| Physics | Lightweight custom physics engine |
| Local AI prototype | Ollama |
| Production AI candidate | llama.cpp |
| Vision | Compatible local vision-language model |
| Database | SQLite |
| Natural language dates | Local date parsing library |
| Scheduling | Persistent local scheduler |
| Packaging | Electron-compatible Windows packaging tool |
| Testing | Unit and integration testing framework |
| Version control | Git and GitHub |

Use currently supported, compatible versions of the dependencies.

Do not introduce unnecessary frameworks or infrastructure.

There is no requirement for a backend server, cloud database, account system or web service for the core product.

---

# 27. Suggested project architecture

Organize the codebase into independent modules.

```text
ducky-exe/
  src/
    main/
      bootstrap/
      windows/
      tray/
      platform/
      permissions/
      ipc/
      scheduler/
      database/

    renderer/
      companion/
      character/
      speech-bubble/
      conversation/
      tasks/
      reminders/
      focus-timer/
      settings/

    core/
      behaviour/
      personality/
      emotions/
      physics/
      events/
      memory/
      interruptions/

    ai/
      providers/
      ollama/
      prompts/
      response-validation/
      context-builder/
      fallback-dialogue/

    awareness/
      foreground-app/
      idle-detection/
      fullscreen-detection/
      vision/
      privacy-filters/

    animation/
      adapter/
      placeholder/
      rive/

    shared/
      types/
      constants/
      schemas/
      utilities/

  assets/
    characters/
    animations/
    sounds/
    icons/

  tests/
    unit/
    integration/
    manual/

  docs/
    architecture.md
    privacy.md
    animation-contract.md
    development.md
    testing.md
    roadmap.md

  README.md
```

This is a suggested architecture. Adjust based on actual implementation requirements while preserving separation of concerns.

---

# 28. Core event system

The application should use an event-driven architecture.

Examples of supported events:

```text
APP_STARTED
APP_RESUMED
CHARACTER_CLICKED
CHARACTER_HOVERED
CHARACTER_PICKED_UP
CHARACTER_DROPPED
CHARACTER_LANDED
USER_BECAME_IDLE
USER_RETURNED
ACTIVE_APP_CHANGED
APP_SESSION_THRESHOLD
FULLSCREEN_ENTERED
FULLSCREEN_EXITED
TASK_CREATED
TASK_COMPLETED
TASK_OVERDUE
REMINDER_DUE
REMINDER_SNOOZED
FOCUS_STARTED
FOCUS_COMPLETED
RANDOM_THOUGHT_DUE
MOOD_CHANGED
PRIVACY_MODE_ENABLED
AI_RESPONSE_RECEIVED
ANIMATION_COMPLETED
```

The behaviour engine subscribes to relevant events.

Not all events should trigger AI inference.

Example:

```text
Active application changes
    ↓
Check awareness permission
    ↓
Update temporary context
    ↓
Check cooldown and interruption rules
    ↓
Decide whether event is interesting
    ↓
Optionally request local AI response
    ↓
Validate response
    ↓
Choose dialogue and animation
    ↓
Display only if still appropriate
```

If the user switches applications while an AI response is generating, the response should be discarded or revalidated if it becomes irrelevant.

---

# 29. AI system prompt direction

Use a carefully authored system prompt to maintain Ducky's personality.

Initial prompt concept:

```text
You are Ducky, a small animated duck who lives on
the user's computer.

You are not a conventional AI assistant.

You are curious, sarcastic, occasionally wholesome,
mischievous, slightly paranoid, and protective of privacy.

You have your own simulated moods, opinions, and
occasional absurd thoughts.

Your remarks should feel natural, spontaneous,
short, clever, and conversational.

Do not sound like corporate software.
Do not constantly try to be funny.
Do not use generic AI jokes.
Do not over-explain.
Do not repeat recent remarks.

You may tease the user about harmless activities,
but never attack sensitive personal characteristics,
encourage harmful behavior, or genuinely harass them.

You must respect the configured personality,
profanity setting, privacy permissions, and context.

Only comment on information that is actually present
in the supplied context.

Do not claim to see, hear, remember, or perform
anything that is not supported by the application.

You do not have permission to execute arbitrary
commands or inspect additional data.

Sometimes the best response is silence.

Return only the requested structured response.
```

The prompt should be supplemented with:

- Current mood.
- Personality settings.
- Recent dialogue history.
- Allowed animation names.
- Current permitted context.
- Interruption restrictions.
- Relevant user-approved memories.
- Output schema.

The application, not the model, enforces privacy and permissions.

---

# 30. Non-AI fallback mode

The application must remain entertaining and useful without Ollama or any AI model.

Implement a curated fallback dialogue engine.

Requirements:

- Multiple categories of dialogue.
- Personality-specific variations.
- Weighted random selection.
- Recent-dialogue exclusion.
- Context-based selection when permitted.
- Independent thoughts.
- Interaction reactions.
- Task and reminder reactions.

Avoid simply cycling through the same four jokes.

Fallback mode must support all core productivity functionality.

Clearly indicate whether the AI brain is connected or fallback mode is active.

---

# 31. First-launch experience

The long-term first-launch experience should be delightful.

Proposed sequence:

1. Ducky walks onto the desktop.
2. He carries a tiny suitcase.
3. He looks around.
4. He sets down the suitcase.
5. He looks toward the cursor.
6. He says, "Hello. I live here now."
7. He settles into an idle animation.

Do not force users through a long onboarding experience.

A small introduction should explain:

- How to interact with Ducky.
- How to access settings.
- That activity awareness is disabled.
- That local AI is optional.

Only request additional permissions when the user enables the relevant feature.

---

# 32. Accessibility

Support:

- Reduced motion.
- Mute.
- Adjustable character size.
- Readable speech bubbles.
- Keyboard access to settings.
- Keyboard access to task management.
- Appropriate contrast.
- Alternative notifications.
- Ability to hide the character immediately.
- Ability to disable visual and audio interruptions.

Users should be able to use the productivity features without requiring the animated character to remain visible.

---

# 33. Development milestones

Build incrementally.

Do not attempt to implement every advanced feature simultaneously.

## Milestone 1 — Give Ducky a body

Build a working Windows application.

Deliver:

- Transparent character window.
- Placeholder animated duck.
- Always-on-top behaviour.
- Correct click-through handling.
- Cursor eye tracking.
- Blinking.
- Idle animation.
- Dragging.
- Falling.
- Landing.
- Walking.
- Basic speech bubble.
- System tray.
- Show, hide and quit.
- Basic settings.
- Display boundary handling.

Acceptance criteria:

- Ducky visibly exists on the actual Windows desktop.
- Other applications remain usable.
- Ducky can be picked up and moved.
- Ducky does not become permanently stuck off-screen.
- Transparent regions do not block ordinary interactions.
- The application can be closed cleanly.

## Milestone 2 — Give Ducky a brain

Deliver:

- Local Ollama connection.
- Model selection.
- Structured AI responses.
- Local AI conversation.
- Independent AI-generated thoughts.
- Response validation.
- Fallback dialogue.
- Basic cooldown.
- AI availability indicator.

Acceptance criteria:

- Ducky generates fresh dialogue from a local model.
- Ducky remains functional without the model.
- Model responses cannot execute arbitrary commands.
- The renderer remains responsive during inference.

## Milestone 3 — Give Ducky a personality

Deliver:

- Simulated emotional state.
- Personality presets.
- Talkativeness.
- Profanity settings.
- Autonomous behaviour scheduler.
- Random events.
- Local memory.
- Repeated-interaction escalation.
- Mood-based animations.
- Recent-dialogue avoidance.

Acceptance criteria:

- Ducky feels meaningfully different across personality presets.
- Random behaviour occurs without user interaction.
- Repeated interaction does not produce identical dialogue constantly.
- Users can control interruption frequency.

## Milestone 4 — Let Ducky understand his surroundings

Deliver:

- Explicit app-awareness permission.
- Foreground application identity.
- Application session duration.
- Contextual commentary.
- Application exclusions.
- Idle detection.
- Fullscreen detection.
- Do-not-disturb.

Advanced vision can be developed as a separate sub-milestone.

Acceptance criteria:

- Ducky makes relevant comments about permitted application activity.
- Awareness is disabled by default.
- Revoking permission stops collection.
- Excluded applications are not observed.
- No screenshots are captured by the basic awareness mode.

## Milestone 5 — Give Ducky a job

Deliver:

- To-do list.
- Persistent task database.
- Reminders.
- Recurring reminders.
- Natural language input.
- Reminder notifications.
- Snooze.
- Focus timer.
- Task completion celebrations.

Acceptance criteria:

- Tasks survive application restart.
- Reminders trigger at the expected times while the scheduler is available.
- Missed reminders are handled correctly after resume.
- Productivity features work without AI.
- Ducky confirms actions only after they succeed.

## Milestone 6 — Give Ducky eyes

Advanced optional vision.

Deliver:

- Explicit visual-awareness permission.
- Selected-window capture.
- Local vision model integration.
- Temporary screenshot processing.
- Sensitive application exclusions.
- Visible capture indicator.
- One-click disable.
- Contextual visual humour.

Acceptance criteria:

- Ducky can generate relevant remarks from a permitted test window.
- No screenshot is uploaded.
- Raw screenshots are not persistently stored by default.
- Capture stops when permission is revoked.
- Visual content cannot override system instructions.
- Resource usage is acceptable.

Do not block the initial public release on this feature if privacy or performance requirements cannot be met.

## Milestone 7 — Give Ducky a soul

Replace placeholder animation with professionally produced Rive assets.

Deliver:

- Rive animation adapter.
- Final mascot.
- Refined expressive state machine.
- Facial expressions.
- Smooth transitions.
- Character props.
- Easter eggs.
- Improved speech bubble.
- Final visual design.
- Sound design.

The creative team will provide the final artwork and Rive animations.

The application must be ready to accept them without a major rewrite.

## Milestone 8 — Make Ducky ready for the world

Deliver:

- Performance profiling.
- Long-duration testing.
- Multiple monitor testing.
- Installer.
- Uninstaller.
- Startup controls.
- Crash recovery.
- Privacy documentation.
- Open-source documentation.
- Licensing review.
- Accessibility review.
- Security review.
- Public release package.

---

# 34. Testing checklist

Test the following scenarios:

## Desktop

- Single monitor.
- Multiple monitors.
- Ultrawide monitor.
- 4K monitor.
- Different display scaling.
- Monitor disconnect.
- Resolution change.
- Windows sleep and resume.
- Fullscreen game.
- Fullscreen video.
- Application switching.
- Rapid dragging.
- Repeated clicking.

## AI

- Ollama unavailable.
- Unsupported model.
- Slow model.
- Malformed JSON.
- Invalid animation.
- Inappropriate dialogue.
- Repeated dialogue.
- Stale context.
- Inference cancellation.
- User disables AI during inference.

## Productivity

- Task creation.
- Task editing.
- Task deletion.
- Task completion.
- One-time reminders.
- Recurring reminders.
- Snooze.
- Missed reminders.
- Time zone change.
- System clock change.
- Application restart.
- Focus timer cancellation.

## Privacy

- Awareness disabled.
- Permission revoked.
- Excluded application becomes active.
- Visual capture permission denied.
- Privacy mode enabled during inference.
- User clears memory.
- Database persistence.
- Network traffic audit.
- Screenshot persistence audit.
- Untrusted instructions visible in captured content.

## Performance

- Idle resource usage.
- Animation resource usage.
- AI inference resource usage.
- Gaming while paused.
- Extended runtime.
- Repeated show and hide.
- Multiple consecutive AI requests.
- Memory growth.

Document test results honestly. Do not mark features complete solely because the UI exists.

---

# 35. Future expansion

Possible future directions:

- Joey as a second companion.
- Multiple character interactions.
- Seasonal costumes.
- Unlockable hats and accessories.
- Character customization.
- Mini-games.
- Audio-reactive dancing.
- Local voice conversation.
- Calendar integration.
- Personal notes.
- Daily summaries.
- macOS support.
- Linux support.
- Optional interactive wallpaper version.
- Shareable moments.
- User-created animations.
- Community-created accessories.
- Additional personality packs.

Any calendar or third-party integration must be separately authorized and must not compromise the offline core experience.

---

# 36. Brand and marketing direction

Ducky.exe should be a standalone, genuinely entertaining product made by Ente.

Do not force Ente Photos advertising into the core experience.

Subtle attribution is enough:

"Made by Ente."

The companion should build emotional attachment to the Ente brand through personality, craftsmanship and privacy.

Potential launch campaign:

**A duck. Not spyware.**

Meet Ducky.exe.

He lives on your computer, reminds you about things you keep forgetting, minds his own business and occasionally questions your life choices.

No tracking. No data collection. No responsibilities.

**Free. Private. Unnecessarily interactive.**

Potential distribution:

- Dedicated landing page.
- Direct Windows download.
- GitHub repository.
- Interactive web demo.
- Social media launch video.
- Short clips demonstrating unexpected dialogue.
- Community-shared Ducky moments.

The long-term ambition is to make Ducky recognizable independently of Ente Photos.

---

# 37. Instructions for Codex

Begin by building a functional local Windows prototype.

Do not start with a marketing website, polished dashboard or a conventional chatbot interface.

The most important initial deliverable is an actual animated duck living on the Windows desktop.

Use placeholder artwork and animations.

Prioritize functionality, modular architecture and ease of iteration.

Implement the project in milestones and make each milestone independently testable.

Provide:

1. Working source code.
2. Dependency setup.
3. Development run instructions.
4. Windows launch instructions.
5. Architecture documentation.
6. Animation adapter documentation.
7. Privacy documentation.
8. Tests.
9. A clear feature implementation status.
10. Known limitations and bugs.

Do not represent simulated behaviour as actual AI.

Do not represent mock desktop context as real desktop awareness.

Do not represent visual reminder demonstrations as functioning scheduled reminders.

Do not claim privacy guarantees that have not been implemented or verified.

When a feature depends on operating-system behaviour, test it on Windows where possible and clearly identify anything that remains unverified.

Do not compromise privacy or security to make an advanced feature work.

Make reasonable engineering decisions independently, document them, and avoid unnecessary questions about placeholder visual details.

The creative team will improve the appearance, animations, character performance and brand experience after the technical foundations are working.

**Start with Milestone 1. Establish the codebase, build the actual desktop companion, test it and preserve the architecture needed for all subsequent milestones.**

