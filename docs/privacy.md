# Privacy

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
page, document, chat, design, or tab is open. Fullscreen detection is available
only while awareness is running; with awareness off, Hide/Pause remain the way
to silence Ducky during fullscreen use.

Main supplies its own process IDs (including Electron child processes) through
stdin. Owned `electron.exe` / `Ducky.exe` windows are ignored. A managed background
thread waits on this pipe without polling; foreground sampling remains every
three seconds. A parent-process handle and closed-input check make the helper
exit if its owner disappears. Main kills its owned helper and clears session
context on disable, pause, hide, sleep, and quit. Rapid off/on changes wait for the
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
cleared on anonymous/private app samples, awareness revocation, disabling AI,
pause, hide, sleep, or quit. It is never written to disk. Interaction counts,
shuffled bags, cooldowns and idle state also remain in memory. IPC sends bubbles,
awareness state and AI connection status to Ducky's own renderers.

## Optional local AI

Only the event, local clock time, supplied counts/durations, and sanitized app name
(when awareness permits it) enter the AI context. App names use only
`[A-Za-z0-9 .+-]`, with a maximum of 40 characters. Prompts also contain Ducky's
authored voice examples and recent spoken dialogue. Cursor coordinates, window
titles, paths, screenshots, user names and other context fields are not sent.
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
