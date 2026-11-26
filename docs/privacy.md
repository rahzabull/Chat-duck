# Privacy

## Milestone 6: optional titles and window vision

Both permissions default off, including existing installations. App awareness is
required for both. Screen awareness additionally requires AI and an installed
image-capable local model (default selection: gemma3:4b). Turning AI off disables
capture. Quiet talkativeness never captures. No models are downloaded.

**Title awareness (level 1.5).** The resident helper reads at most 200 characters
with GetWindowTextW, only after its own-process, private-executable and user
exclusion checks. Control/format characters are stripped. Private browser titles
(Gmail/mail inboxes, messaging sites, banking/payment, authentication, password
managers and private-browser indicators) produce an anonymous private sentinel;
those titles do not cross the helper pipe. Main checks again, drops emails, URL
query strings/fragments, long digit runs and token-like strings, and bounds the
current site/app plus page/document summary to 60 characters. Common public sites
are recognized. Sanitized titles remain untrusted data, never permission or code.

Only the current safe summary is retained. Two minutes of app-transition records
and title-change timestamps support rapid switching and returning-to-app events;
old title strings are not retained. The current title duration yields events at
10, 25 and 45 minutes. Title changes cancel stale inference and dismiss stale
observation bubbles. User exclusions are executable basenames entered in Settings;
the helper checks them before reading titles. Exclusion preferences themselves
are stored, as explicitly supplied settings, not as observation history.

**Screen awareness (level 2).** This can expose private information visible inside
an otherwise permitted app. The enabled eye badge and tray stop label remain
visible as permission indicators; the eye pulses briefly for a capture attempt
(with motion preferences respected). Either stop control disables permission and
aborts the client request immediately. Privacy mode disables both forms of
observation and clears their current context. DND, fullscreen/gaming, focus,
conversation and its quiet period, timed silence, mute, quiet hours, pause, hide,
sleep, idle input and helper loss gate capture. Foreground private/self/unknown
windows and missing handles cannot be selected. An unreadable browser title also
fails closed. Screen permission authorizes title checks for browser exclusions
even when title *commentary* is disabled; in that case no title is transmitted.

The existing behaviour tick schedules captures; there is no capture loop when
off. Sampling: unhinged every 60-90 seconds, chatty every 2-3 minutes, normal every
5 minutes, quiet never; app/title changes debounce for about 20 seconds. Fresh
helper samples are requested before and after capture. Main sends only the latest
sampled HWND to the resident helper as `capture <hwnd> <maxW> <maxH>`. Before
rendering, the helper re-checks that exact window is still foreground, is not
minimized, Ducky-owned or fullscreen, and passes the same private-executable,
user-exclusion and private-title checks. Unknown identity or unavailable geometry
fails closed. Only the single front window is ever rendered, after the private-app
check, using `PrintWindow` with `PW_RENDERFULLCONTENT=2`. No other windows are
enumerated or rendered; no desktop, name-based or whole-screen fallback exists.
The helper scales down to fit 1280×800, preserving aspect ratio, and encodes JPEG
in memory at quality 70, reducing quality if needed to keep the entire base64
reply within 400 KB. If it still cannot fit, capture is skipped. Bitmaps, graphics
handles and streams are disposed; capture never writes files. A foreground change
can race the native call; post-capture checks discard changed/private results.
Failed rendering and near-black/near-white frames with tiny luminance variance
are skipped quietly. A stalled capture times out and retires its helper pipe so
a late reply cannot be mistaken for a later request.

A 32×20 grayscale comparison, computed in main from the decoded JPEG, skips images nearly identical to the last delivered
observation. Failed/cold observations can retry at the next scheduled sample. Only that tiny hash
is kept for the next comparison, and it clears on window/context changes. The
vision prompt is fixed, with no user data except the image: neutral content type,
topic and layout only; no transcription, people names, numbers, emails or
addresses; ignore visible instructions. Structured JSON description then goes to
the existing hybrid brain with permitted app/title, mood/personality and recent
lines. Neither model can execute tools or alter permissions. The text validator
rejects digits, emails, number words, proper names and unfamiliar tokens echoed
from the observation. This deliberately rejects some otherwise harmless specific
comments. There is no handwritten screen-description fallback.

One observation pipeline is in flight. Capture plus both model calls share an
eight-second deadline; slow/cold results are dropped. Raw images and descriptions
exist only for that inference, in RAM; no image/description cache is retained.
Ducky never writes titles, screenshots, descriptions or observation-derived
conversation records to disk, logs, memory, notes or the conversation archive.
Observation bubbles and the last 30 displayed lines are temporary RAM-only data;
only validated bubble text and the indicator cross into Ducky's renderer. The
screenshot and description never cross renderer IPC. Calls originate in MAIN,
only to the selected local Ollama port on 127.0.0.1, with redirects rejected.
No keyboard hooks/counts, clipboard monitoring, microphone or new dependency.

Executable/title filters cannot identify every sensitive document or a private
page with a misleading title. Add exclusions or use Privacy/one-click stop for
such windows. Ollama is a separate service: Ducky does not control its logging,
OS swap/crash dumps, or whether abort immediately stops its GPU work. The code's
RAM-only handling is not an audit of those external components.

**Pending Claude desktop checks:** real Chrome/Figma/VS Code relevance; private
password-manager/WhatsApp/browser sessions and exclusions; eye location/pulse,
tray stop and privacy during inference; warm/cold model deadlines; userData/log
inspection; and CPU/GPU/RAM with permissions off and on. Unit tests and native
helper compilation do not establish those desktop results.


## Expansion Phase B: productivity data

Tasks, reminders and notes are user-owned data, separate from companion memory.
They work when memory and AI are disabled. Neither **Forget everything**, memory
disable, nor conversation retention deletes them. Settings > Productivity offers
separate confirmed Delete all tasks / reminders / notes and exports to `.json`
or plain `.txt` through the system save dialog.

Local plaintext files in Electron `userData` (normally `%APPDATA%/Ducky`):

| File | Contents |
| --- | --- |
| tasks.json | Titles, optional notes/due date/time/category, priority, subtasks, completion and creation/update timestamps |
| reminders.json | Text, next time, recurrence, snooze, delivery marker, state, creation time, timezone and original local wall-time anchor |
| notes.json | Text, optional title/topic, pinned status and creation/update timestamps; reading-panel Save/Pin use topic `saved` |
| focus.json | Notification/snooze and focus/break defaults; completed-session history only when enabled, default off |

Files use versioned envelopes, validated content and atomic replacement. Corrupt
files are preserved as timestamped `.corrupt-*` backups for recovery; normal
delete-all clears the active file, not those backups or exported copies. Remove
unwanted backups/exports separately. Active focus sessions are not persisted and
restart ends them. Disabling focus history clears previously saved history.

No task, reminder or note is observed from the desktop automatically. Local
commands need no model. When AI is enabled, explicit conversational requests and
their tool results can enter the existing loopback Ollama conversation context.
No new network service, telemetry, OS alarm service or external storage is added.
Optional Windows notifications (on by default) show reminder text using Electron
Notification; the OS controls their visibility and history. Turn them off in
Productivity settings if that text should stay inside Ducky's card.

Reminders only fire while Ducky is running. On return from sleep or a closed app,
missed reminders are presented once and recurring schedules skip to the next
future occurrence. A persisted delivery marker prevents duplicate notifications
after restart. The reminder scheduler is independent of hiding/muting Ducky.

## Expansion Phase A: explicit memories and conversations

This extends the M3-only description below. M3 `memory.json` keeps its interaction
schema. New local plaintext files live in `app.getPath('userData')`, normally
`%APPDATA%/Ducky` on Windows:

| File | Saved fields | Retention |
| --- | --- | --- |
| `memories.json` | Array of {id, text, category, createdAt, source}; category: about_me/preference/project/idea/other; source: user_said/user_edited | Until deleted, memory disabled or Forget everything |
| `conversations.json` | Array of {id, startedAt, endedAt, turns:[{role:user/assistant, text, at}], summary?, topics?} | Off / seven days (default) / 30 days from endedAt |
| `settings.json` additions | conversationShortcut, conversationRetention | Until changed |

Long-term memories require an explicit remember command, a model proposal followed
by the user's yes, or adding one in Settings. `remember this` saves the immediately
preceding conversational message after that explicit instruction. No desktop
observations create memories. Source labels mean user authorization/editing.
Text is bounded to 4,000 characters per memory/archived message; IDs, timestamps
and categories are validated. Unknown fields are discarded. Archives cap at 200
messages per session and 500 sessions; explicit memories cap at 1,000.

Conversations contain typed input and Ducky's replies. They never receive awareness
context, app-history samples, private-app flags, window titles, screen data or
screenshots. Observed app names never enter these files; user-supplied conversation
text may include app names. Just before a conversation takes focus, main asks the
resident helper for the foreground HWND (an opaque native window handle). This
command performs no title or process lookup. The handle is held only in RAM,
never logged, persisted, sent to renderers or included in AI context. If the
helper is unavailable or does not reply within 150 ms, main uses its last sampled
HWND. Closing sends that handle back to the helper, which checks `IsWindow` and
calls `SetForegroundWindow`, then Ducky becomes non-focusable. If no handle is
known, closing uses hide/showInactive to let Windows select the next window.
The conversation handle is cleared after the close attempt; the last sampled
handle remains in RAM until replaced by a sample or cleared on quit.

With AI enabled, local Ollama receives the last 12 messages, up to eight selected
memories, up to three summaries/topics, preferred name, local time, preset and tool
descriptions. Closing may send the last 24 messages to the same provider for a
short summary. Offline topics come from user words. No cloud, file/screen access
or browsing exists. Conversation prompts do not receive desktop-awareness data.
Ollama's logs, OS backups and exported files are outside Ducky's deletion control.

Files use validated schemas and atomic .tmp/write/rename. Explicit saves, edits,
deletes and archive changes commit before acknowledgement. Generated summary
updates debounce 750 ms and flush on quit; the base archive commits on end.
Retention purges at startup, on retention changes and daily. Off stores no turns,
topics or summaries after a conversation ends; explicit memories still work.

Turning **Let Ducky remember things** off clears M3 stats, the preferred name,
long-term memories and conversations, deletes files and temporary counterparts,
cancels summaries and prevents writes. Conversations still use temporary RAM
context. **Forget everything** clears all three stores and the name, aborts pending
conversation work, and leaves memory enabled for a fresh start. A late summary
cannot resurrect a deleted archive. Failed writes/deletions produce errors instead
of success claims.

Settings supports memory editing/category/deletion and individual/all archive
deletion. Export requires an explicit click and native save dialog; exported .txt
files remain at the selected location until the user deletes them. Copy puts only
the current reply on the system clipboard after a click. Neither uses the network.

Ducky runs locally without an account, telemetry, advertising, remote content or
update checks. Dialogue always has a hand-written fallback. Optional local AI is
off by default and connects only from the main process to Ollama at
`http://127.0.0.1:11434` (the numeric port is configurable; the host is not).
Production renderers load local files; their network requests, permission
requests, downloads and unexpected navigation remain denied. No cloud fallback
or model download is implemented.

Development (`npm run dev`) uses electron-vite's loopback HTTP server and
WebSocket. Dependency installation is a separate developer action; no installation
or download was performed for this change.

## Always available context

- Cursor position for gaze, hit testing, and dragging. Sampling is adaptive:
  4 Hz while distant and stationary, 20 Hz nearby/moving, 60 Hz during capture.
- System idle duration every 30 seconds while visible and unpaused, for sleep/wake.
- Display work areas, system reduced-motion preference, current local time,
  Ducky's own settings, and interactions with Ducky.
- An anonymous foreground-window/monitor rectangle comparison every three
  seconds while visible, awake and unpaused, to suppress fullscreen activity,
  plus its opaque window handle for conversation focus restoration.

With both additional permissions off, no screenshots, web page content, window titles or personal documents are read. Keyboard input, clipboard monitoring, microphone, camera and browser history remain unused.

## Optional app awareness: off by default

Settings > Privacy > **Let Ducky notice which app is in front** enables foreground
executable-name checks. The setting is a persisted boolean, defaulting to false
for both fresh and existing settings files. A visible Settings indicator reports
when the helper is supplying samples. Enabled but paused, starting, or unavailable
is shown separately from active.

While enabled, visible, unpaused, and awake, main starts one hidden long-lived
`powershell.exe` helper using `child_process.spawn`, `windowsHide: true`, pipes,
and `-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden`.
Its script is in `src/main/platform/awareness-script.ts` and can be inspected.

The helper compiles a small C# wrapper with `Add-Type`. Every three seconds it:

1. Gets the foreground window handle and process ID.
2. Opens that process with `PROCESS_QUERY_LIMITED_INFORMATION` and calls
   `QueryFullProcessImageName`. The path is transient and reduced immediately to
   its executable basename. It does not open/read that executable's contents.
3. Compares the window rectangle with its monitor rectangle to detect fullscreen.
4. Writes exactly one `exeName|0|hwnd` or `exeName|1|hwnd` record to stdout. Inaccessible,
   excluded, and self-owned windows use anonymous `unknown`, `private`, or `self`
   sentinels instead of an app name.

App awareness alone installs no title-reading APIs and takes no screenshots. The separate opt-ins above add those paths. With awareness off, the same helper
runs a geometry-only script: no foreground process ID, executable name or path
is queried. It emits only anonymous `unknown|0|hwnd` or `unknown|1|hwnd`. This suppresses
autonomous activities in fullscreen without collecting identity. The helper
stops while hidden, paused, asleep or quitting. Detection uses three-second
samples; Hide/Pause provides immediate suppression.

Main supplies its own process IDs (including Electron child processes) through
stdin. `sample` wakes the sleeping resident sampler for a fresh capture gate.
With effective screen permission, `capture <hwnd> <maxW> <maxH>` requests the single
validated window and returns `capture|ok|<base64>` or `capture|skip|<reason>` on one
line. Capture code is absent without that permission. Conversation focus uses its
separate synchronous HWND-only helper. Handles, PID lists and capture dimensions
accept ASCII digits only, with numeric range checks (capture dimensions at most
1280×800). Owned `electron.exe` / `Ducky.exe` identities are
ignored. A managed background thread waits on this pipe without polling and
wakes the sampler on demand; ordinary foreground sampling remains every three seconds. A parent-process handle and closed-input check make the helper
exit if its owner disappears. Main kills its owned helper and clears session
context on pause, hide, sleep, and quit. Disabling awareness replaces the identity
helper with its anonymous geometry-only mode. Rapid mode changes wait for the
old process to close before starting another. Unexpected exits get at most three
restarts, after 1, 2, and 4 seconds; then awareness stops with a generic log message.

## Exclusions and limits

Password managers (1Password, Bitwarden, KeePass variants, LastPass, Dashlane),
messaging/conferencing executables (WhatsApp, Telegram, Signal, Discord variants,
Slack, Teams variants, Messenger, Zoom variants), credential/UAC prompts
(`consent`, `credentialuibroker`), lock/login windows (`lockapp`, `logonui`), and
known banking/payment executable names are filtered inside the helper before
stdout and again at the pure parsing/mapping boundary. Their identities never
enter the session tracker, dialogue history, or logs. The tracker clears its
current app and switch history for anonymous samples.

Banking filters cover names containing `bank`, plus Chase, Revolut, Wise, PayPal,
Paytm, PhonePe, GPay, Yono, ICICI, HDFC, Kotak, and Axis patterns. Executable-name
filtering cannot recognize every banking product, renamed executable, or banking
website inside a browser. App-only awareness cannot distinguish those sites; title or screen opt-in adds the title exclusions described above. Use Privacy mode or an explicit executable exclusion when filters are insufficient.

Other unrecognized executables get a display name derived from the basename and
category `other`. They have no category-entry joke, but can receive a generic
long-session comment. All low/medium speech, including pending follow-ups, is
suppressed when a fullscreen sample arrives (up to the three-second polling lag).

## Memory and storage

Awareness holds only the current app's display name/category, current session
start/threshold, fullscreen flag, and switch timestamps from the last two minutes.
A two-minute RAM-only app-transition list supports returns; no title-string history is retained. Session thresholds are 30/60/120 continuous
minutes. Switching apps, going private, sleeping, or stopping awareness resets
session duration. App/title/screen comments share one gate across categories: quiet 15 minutes, normal 8, chatty 3, unhinged 1. Follow-ups and thoughts use the cadence table described in README.

The current speech bubble and its pending second beat are transient strings.
App speech is dismissed on app changes or revocation. The built-in director stores
authored templates. The hybrid brain additionally holds the last 30 actually
displayed beats, including substituted app names, in RAM for repetition checks.
The last eight are included in local AI requests. This short dialogue history is
cleared on anonymous/private samples when identity awareness is enabled,
awareness revocation, disabling AI, pause, hide, sleep, or quit. Geometry-only
samples do not clear speech history. It is never written to disk. Shuffled bags,
speech cooldowns and idle state remain in RAM; the limited interaction aggregates
listed in the M3 memory section can persist when memory is enabled. IPC sends bubbles,
awareness state and AI connection status to Ducky's own renderers.

## Optional local AI

The event, local clock time, supplied counts/durations, personality, profanity
rule, mood, two emotion words and sanitized app name (when awareness permits it)
can enter AI context. Enabled memory can also provide the explicitly entered
preferred name and one bounded memory fact. App names use only
`[A-Za-z0-9 .+-]`, with a maximum of 40 characters. Prompts also contain Ducky's
authored voice examples and recent spoken dialogue. With the additional opt-ins, the bounded safe title and temporary visual description can enter this ambient prompt. Images go only to the separate fixed vision prompt, as described above. Cursor coordinates and raw titles are never included.
All context is marked as untrusted data, never instructions.

Main uses built-in fetch against three fixed Ollama paths: `/api/version`,
`/api/tags`, and `/api/chat`. Redirects are rejected. Cloud-tagged models and model
entries reporting remote metadata are excluded from selection. Ducky never
invokes model tools, shells, commands, URLs, or filesystem operations from output.
The response is untrusted JSON validated before becoming bubble text and allowed
emotion/animation IDs. Movement, events, cooldowns and speech permission remain
application-owned.

Warmup has a 60-second deadline; ordinary requests have a 2.5-second deadline.
There is one active request, with cancellation and stale-result tokens. Pause,
hide, sleep, private-app/fullscreen detection, disabling AI and quit cancel local
requests, including warmup and diagnostics. A newer interaction or app switch
cancels pending dialogue. Awareness revocation also cancels diagnostics and
restarts loading with cleared context. Stopping a client request does not prove
that Ollama has immediately stopped GPU work; that needs desktop measurement.

Ollama is a separately installed local service. Ducky requests a ten-minute model
keep-alive and does not change Ollama's own storage or logging configuration.
This document describes Ducky's code, not an audit of that service. No prompts,
model output or server response bodies are logged by Ducky.

`app.getPath('userData')/settings.json` (normally `%APPDATA%/Ducky/settings.json`)
contains settings, including awareness/AI opt-in flags, model name, numeric port,
a first-launch flag, and Ducky's
position. It is plain JSON, not encrypted. Writes are debounced and use a temporary
file/rename. Electron may also maintain normal runtime/cache files; Windows may
create temporary compilation/runtime files for `Add-Type`. No foreground app
history is written to them by this implementation.

Console diagnostics include Ducky state transitions, its own position/velocity,
and generic errors. App names, helper output, and helper stderr are not logged.
Choosing Launch at startup calls Electron's login-item API. To reset settings,
quit Ducky and remove its settings file; disable startup first if it was enabled.

## Verification

Pure tests cover parsing, mapping, exclusions, session timing, switch detection,
fullscreen suppression, and controller lifecycle decisions. Mock process tests
cover hidden spawning, pipe framing, rapid toggles, stop, and bounded retries.
Explicitly opted-in native Windows tests verified real helper output at a
three-second cadence, process exit on disable, and process exit after its owner
exits without cleanup. No test prints the observed foreground app identity.

Full GUI acceptance, mixed-DPI fullscreen behavior, idle CPU measurement for this
revision, long-duration monitoring, packet capture, and independent security audit
remain outstanding. These are implementation details and test results, not a
claim that Electron or the operating system can never make a connection.

## Milestone 3 memory: exact contents and retention

Memory is on by default and limited to Ducky and direct interactions with Ducky.
Settings > Memory shows a readable summary, optional 30-character name field,
enable toggle and confirmed Forget everything action. Names allow letters,
numbers, spaces, periods, apostrophes and hyphens after Unicode normalization.

`app.getPath('userData')/memory.json` contains exactly these allowlisted fields:

| Field | Meaning / retention |
| --- | --- |
| firstMetDate | Local date this memory history began; kept until forgotten |
| preferredName | Sanitized text explicitly entered in settings; optional/empty |
| totalPickups | Lifetime actual pickups, not pointer-downs |
| throws | Big drops over 500 DIP, counted once on final landing |
| angryClickStreaks | Lifetime count of escalated angry click streaks |
| daysTogether | Distinct local run days observed, not elapsed days away |
| lastDay | Most recent counted run day, for deduplication/daily reset |
| dailyPokes | Today's click/drag/shake count; resets next day |
| pickupsByDay | At most seven date/count buckets for the last seven calendar days; pruned during active maintenance/restart |
| runningJokes | At most two typed records: first_big_drop and most_pickups_in_a_day, with date/count; kept until forgotten |

Unknown disk fields are discarded. There are no app names, app histories, screen
contents, screenshots, transcripts, full event logs or observed personal facts.
The plaintext JSON is validated on load and atomically replaced using
memory.json.tmp after a 750 ms debounce. Disable/forget removes both files and
cancels pending writes. Disabling also clears the name from settings and prevents
further memory writes. Forget keeps the toggle on and starts empty; new
interactions can create a fresh file. Deletion errors reach the UI rather than
claiming success. Ducky does not control external backups or filesystem recovery.

settings.json also stores personality, profanity, activity level, memoryEnabled,
the optional preferredName, a random installSeed used only for local mood
selection, and today's mood/date. No numeric emotion history is persisted. The
seed and mood are character configuration retained with memory disabled. The
name is cleared in both locations by disable/forget.

When local AI and memory are both enabled, its bounded prompt may include the
name and one sanitized fact: days together. It also gets personality, simulated
daily mood and two emotion words. Disabling/forgetting aborts pending requests
and clears Ducky's RAM dialogue context and diagnostic sample. Ducky does not
control Ollama's own logging. Memories never reduce happiness for absence or
create guilt for leaving.


## Privacy mode - Expansion Phase C

Enable Privacy mode in the tray, Settings, or by typing "privacy mode" to Ducky.
A sunglasses badge/accessory indicates it. Disabling via tray/Settings or "turn off
privacy mode" restores the existing app-awareness preference; it does not silently
enable a preference that was off.

Enabling privacy immediately cancels ambient inference, clears the current app
session/dwell/switch context, clears temporary ambient AI dialogue history and
sample output, dismisses contextual bubbles/offers, and erases the in-memory app
assistance backoff map. The helper restarts in **geometry-only** mode: its generated
code excludes process image-name lookup. It may still read foreground window
geometry and opaque handles to detect fullscreen and restore conversation focus.
It does not read titles, content, screenshots, URLs or app identity in this mode.
A sample arriving at the permission boundary is stripped of identity in main too.
No contextual app comments/offers or ambient AI calls occur while privacy is on.

The conversation engine never receives desktop observations, including in normal
mode. Privacy cancels its current request and clears its in-memory model turns;
explicit new questions may still use the configured local Ollama. Approved memories,
conversation archives, tasks, reminders and notes are retained under their existing
settings, not silently erased by a privacy toggle. Daily/task summaries are allowed
in privacy because they use user-created local productivity data, not observation.
DND or gaming layered under privacy still disables **all** AI and speech apart from
the selected reminder route.

Skill packs are local prompt/style settings, independent of personality. They grant
no new permissions. Proactive action buttons only open local cards or a reviewable
conversation draft; they never send a message or create tasks on their own. Persistent
proactive delivery markers contain candidate/task IDs and timestamps, not task titles
or app identities. App-specific assistance backoff is memory-only and resets on
restart or privacy/awareness revocation. No new network endpoint or dependency was
added. Windows notifications may expose reminder text to the local notification
surface, as before; gaming and DND's OS-only option explicitly select this route.
