# Ducky.exe

## Productivity — Expansion Phase B

Tasks, reminders, notes and focus work with **AI off**. Use temporary cards near
Ducky; there is no dashboard or separate list window. The tray has Tasks, Add
task…, Add reminder…, Start focus (25 min), and Notes. Tab reaches controls,
Enter/Space activates buttons, and Escape closes the current card.

Try:

- `add urgent finish the presentation tomorrow to my list`
- `what do I have today?` / `what's due this week?` / `overdue?`
- `move the presentation task to Friday` / `mark presentation done`
- `remind me to drink water in 1 minute`
- `remind me to call Mum tomorrow at 6pm`
- `every Tuesday take vitamins` (9am by default, displayed on the confirmation)
- `pay rent on the first of every month` / `remind me to stretch every 3 days at 9am`
- `snooze that 10 minutes` / `cancel the rent reminder` (confirmation required)
- `note: campaign idea — ducks in space` / `what notes do I have about the campaign?`
- `start a 25 minute focus timer` / `focus for an hour`
- `pause the timer` / `resume the timer` / `how long is left?` / `stop the timer`

Missing reminder times get “When?”; ambiguous titles get numbered choices.
Unqualified `at 6` chooses the next 6 o'clock (6pm if 6am has passed); an explicit
time earlier today moves to tomorrow. Use AM/PM to remove ambiguity. Task cards
support title/date/priority/notes/category/subtask edits, completion, search and
Today/Upcoming/Overdue/Done views. Delete, clear completed, and Undo require an
explicit confirmation. Undo is offered for ten seconds after creation.

**Reminders only fire while Ducky is running. There is no OS-level scheduling
yet.** Keep Ducky in the tray. Start, resume and unlock check immediately; the
running scheduler checks every 15 seconds, so a reminder may appear up to 15
seconds after its time. Missed occurrences collapse into one card; recurring
reminders advance to the next future date. Local wall times survive timezone
changes, DST and shorter months. Windows notifications are optional and on by
default. Reminders bypass mute and quiet talkativeness. Only one reminder card
appears at a time, with a count of waiting reminders.

Focus shows a small countdown with pause/resume/stop and quiets ambient behavior.
At completion Ducky celebrates and offers a break (5 minutes, or 15 after four
sessions); durations and automatic breaks are configurable. Active timers and the
four-session counter last for this app run. Completed-session history is off by
default. Reading-panel **Save** creates a note with topic `saved`; **Pin** saves
and pins it. Find it again through Notes.

Settings > Productivity controls notifications, snooze, focus and history, and
provides confirmed delete-all and `.json`/`.txt` export through a save dialog.
Tasks/reminders/notes are user data: **Forget everything does not delete them**.
They live in schema-versioned local JSON files under Electron `userData`.
Desktop verification (including notifications, mixed-DPI cards and CPU) is
**pending Claude**; see [status](docs/status.md).

## Talk to Ducky — Expansion Phase A

Double-click Ducky, press **Ctrl+Alt+D**, or choose **Talk to Ducky** in the tray or
right-click menu. A small input appears beside him. Enter sends, Shift+Enter adds
a line (up to three visible lines), and Escape ends. Conversation also ends after
90 seconds without input or 20 seconds continuously blurred. Settings > Conversation
records a different shortcut and reports registration conflicts. Settings remains
in the native menus.

Only the current reply is visible. Short replies appear in timed beats; click to
advance. Replies over 420 characters, lists and code use a temporary reading panel
with Expand/Collapse, Copy and Close. Typing interrupts. Ducky's feet stay in place
as the window grows. There is no companion transcript or chat window.

Try these with AI off as well as on:

- `remember that I prefer working at night`
- `what do you remember about me?`
- `forget that` or `forget about night` (multiple matches ask which)
- `what were we talking about earlier?`
- `be quiet for 10 minutes`
- `bye`

Enable local AI and select an installed model to ask general questions, brainstorm,
get explanations or help with code. Conversation uses the existing main-process
loopback Ollama provider, a 45-second deadline and an authored thinking line after
eight seconds. No web, file-reading or screen access exists. When AI is unavailable,
Ducky says so and local commands continue working.

Settings > Memory supports add/edit/category/delete. The conversation archive in
Settings supports View, Export .txt and deletion. Retention defaults to seven days,
optionally 30 days or off. Turning memory off deletes all memories, conversations
and M3 stats. Forget everything also clears the preferred name. See
[privacy](docs/privacy.md) for exact storage and deletion behavior.

The companion attempts focus synchronously when conversation opens, with one
300 ms retry. If activation fails, it shows "Click me to type." with the input
hidden until a duck/bubble click grants focus. Closing makes it non-focusable,
then immediately hides and shows it inactive so Windows activates the next window
in z-order (normally the previous app), and reapplies the always-on-top preference.
No PowerShell focus capture/restore is used. Native focus return, qwen3:8b quality,
animation screenshots, mixed-display layout and idle CPU:
**verified on desktop: pending Claude**. Automated tests do not prove desktop behavior.

The following sections describe the earlier prototype foundations and setup.

A local desktop companion by Ente. **Milestone 2 prototype: “Give Ducky a brain.”**
A small animated SVG duck lives in a transparent Electron window, walks, follows
your cursor with his eyes, reacts to clicks, and can be dragged and dropped.
Optional local Ollama AI writes fresh lines alongside the hand-written voice.
App awareness is separately opt-in. Sound is not implemented. Task management is
provided by Phase B above.

## Optional local AI

1. Install Ollama for Windows manually from [Ollama](https://ollama.com/download/windows)
   and start its local service. Ducky does not install it or download models.
2. In your own terminal, pull a local model (this manual download uses the internet):

   ```powershell
   ollama pull gemma3:4b
   # Or:
   ollama pull qwen3:8b
   ```

3. Open Ducky Settings > **Brain (local AI)**. Enable **Use local AI for fresh
   lines**, then select an installed model. The list is loaded only after opt-in.
4. Wait for **Warming up...** to become **Connected: <model>**. The first load can
   take up to 60 seconds. Built-in lines keep working throughout.
5. Use **Test connection** to see the Ollama version and a validated sample line,
   refresh installed models, or reconnect after an error. A rejected sample is
   labeled and replaced with a built-in example; silence is also a valid result.

Only main connects to `http://127.0.0.1:11434`. The port can be changed to match
your local Ollama setup; the host cannot. No cloud fallback exists. The tray and
Settings show whether the brain is connected or built-in fallback is active.
If Ollama stops, a request fails, or the model's text fails validation, Ducky uses
his built-in line. Warm dialogue requests time out after 2.5 seconds. After a
transport error, use Test connection to reconnect. Ollama may unload the model
after ten idle minutes; a later cold request can time out and need reconnection.

Click/pickup/drop/shake reactions always use the hand-written voice immediately.
Thoughts, sustained holds and other slow situations may use AI after the director
decides to speak. AI only proposes text and allowed expressions; it never drives
movement or executes commands. Pause, Hide, sleep, privacy/fullscreen detection,
and disabling AI cancel pending work. Fullscreen/private-app detection still
requires opt-in app awareness. Real-model quality and desktop performance for
this milestone are pending Claude's verification.

## Requirements and running

- Windows 10/11, Node.js 24, npm.
- The supplied project already has its dependencies installed. No install is needed in this workspace.
- For a fresh checkout, dependency setup is `npm install` (requires access to the package registry and Electron distribution).

```powershell
npm run dev
```

Development uses electron-vite's local loopback server. Production loads local files:

```powershell
npm run build && npm start
```

In Windows PowerShell 5.1, which does not support `&&`, run the two commands on separate lines.
For a built app with faint outlines of the actual interactive shapes:

```powershell
npm run build
npm run start:debug
```

`start:debug` runs `electron . --debug-hitbox`. The unpacked executable also accepts
`--debug-hitbox`. Main-process state changes are logged with `[ducky]`.

```powershell
npm test
npm run typecheck
npm run build
npm run pack:win
```

Packaging runs electron-builder with `--win --dir`, uses the already-installed
Electron distribution, and produces `release/win-unpacked/Ducky.exe`.
Offline directory packaging was verified. The executable is unsigned, uses the
default executable icon/metadata, and has **not been launched or desktop-tested here**.
Resource editing and signing are disabled to avoid downloading Windows signing tools.
There is no installer in M1.

## Controls

- Hover: suspicious eyes; move the cursor: eyes follow.
- Click: immediate startled reaction and sometimes a short bubble (no AI wait).
- Repeated single clicks: escalating annoyance; five within four seconds makes Ducky angry. Space clicks about 600 ms apart to test this without double-clicking.
- Double-click: talk to Ducky; the first click may already have produced a reaction.
- Drag with the left button: pick up Ducky, then release to fall and bounce. Movement under 4 DIP counts as a click.
- Right-click the duck: native menu, with the same actions as the tray.
- Click a bubble: dismiss it. Bubbles otherwise disappear after at least three seconds.
- Left-click the tray icon: show/hide. Right-click it: Show, Hide, Pause/Resume, Mute/Unmute, Reset position, Settings, Quit.
- Idle for five minutes by default: sleep. Return: wake on the next idle poll (up to 30 seconds).

The companion window is non-focusable outside conversation. Opening Settings
focuses its normal window. Transparent regions pass clicks through; the duck,
visible reply and attached input interact.

Settings apply immediately. Desktop-only mode turns off always-on-top; it does not
attach Ducky to Explorer's wallpaper. Mute suppresses low-priority bubbles; direct
interaction replies and the first-launch greeting can still appear. Pause suppresses
all speech and freezes motion. Hide suspends the companion timers.

## Local files and quitting

Settings and the bottom-centre DIP position are stored in
`app.getPath('userData')/settings.json`, normally `%APPDATA%/Ducky/settings.json`
on Windows. This is plain, unencrypted JSON. Writes are debounced and use a temporary
file plus rename. Malformed or partial settings recover with validated defaults.

Choose **Quit** from the tray, the duck's context menu, or Settings to stop the
application and flush settings. Closing Settings leaves Ducky running in the tray.

See [status and limitations](docs/status.md), [architecture](docs/architecture.md),
[animation contract](docs/animation-contract.md), [privacy](docs/privacy.md),
[development](docs/development.md), and [desktop test checklist](docs/testing.md).
