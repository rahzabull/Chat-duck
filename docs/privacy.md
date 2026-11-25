# Privacy

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
text may include app names. Conversation focus does not capture a native window
handle or application identity. Closing hides and immediately shows the duck
inactive, letting Windows activate the next window in z-order.

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
  seconds while visible, awake and unpaused, solely to suppress fullscreen activity.

No keyboard input, clipboard, microphone, camera, browser history, screenshots,
web page content, window titles, or personal documents are read.

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
4. Writes exactly one `exeName|0` or `exeName|1` record to stdout. Inaccessible,
   excluded, and self-owned windows use anonymous `unknown`, `private`, or `self`
   sentinels instead of an app name.

There are no title-reading or screen-capture APIs. Ducky cannot tell which web
page, document, chat, design, or tab is open. With awareness off, the same helper
runs a geometry-only script: no foreground process ID, executable name or path
is queried. It emits only anonymous `unknown|0` or `unknown|1`. This suppresses
autonomous activities in fullscreen without collecting identity. The helper
stops while hidden, paused, asleep or quitting. Detection uses three-second
samples; Hide/Pause provides immediate suppression.

Main supplies its own process IDs (including Electron child processes) through
stdin. Owned `electron.exe` / `Ducky.exe` windows are ignored. A managed background
thread waits on this pipe without polling; foreground sampling remains every
three seconds. A parent-process handle and closed-input check make the helper
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
website inside a browser. Such websites are indistinguishable from other browser
use because Ducky does not read URLs, titles, or content. Disable awareness when
executable-name filtering is insufficient for your needs.

Other unrecognized executables get a display name derived from the basename and
category `other`. They have no category-entry joke, but can receive a generic
long-session comment. All low/medium speech, including pending follow-ups, is
suppressed when a fullscreen sample arrives (up to the three-second polling lag).

## Memory and storage

Awareness holds only the current app's display name/category, current session
start/threshold, fullscreen flag, and switch timestamps from the last two minutes.
No prior app-name list is retained. Session thresholds are 30/60/120 continuous
minutes. Switching apps, going private, sleeping, or stopping awareness resets
session duration. App-comment cooldowns are shared by category, enforcing at
least ten minutes per app without retaining an app history. Switching comments
have a separate fifteen-minute cooldown.

The current speech bubble and its pending second beat are transient strings.
App speech is dismissed on app changes or revocation. The built-in director stores
authored templates. The hybrid brain additionally holds the last 20 actually
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
authored voice examples and recent spoken dialogue. Cursor coordinates, window
titles, paths, screenshots, observed user names and other context fields are not sent.
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
