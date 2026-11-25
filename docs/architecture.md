# Milestone 1 architecture

The main process owns all position, movement, behaviour and persistent state.
The sandboxed renderer presents that state. Pure TypeScript core modules have no
Electron imports and are tested with synthetic clocks, RNGs and display layouts.

## Modules and process boundaries

| Module | Responsibility |
| --- | --- |
| `src/main/index.ts` | Single-instance lock, lifecycle, window/tray wiring, display and resume listeners, clean shutdown |
| `src/main/windows` | Companion/settings creation, navigation and popup denial, session permission/network boundaries |
| `src/main/platform` | Electron display work areas in DIP; cursor poller |
| `src/main/companion/CompanionController.ts` | Authoritative body, active timers, interaction interpretation, event reactions, `setBounds`, speech presentation |
| `src/main/settings` | Validated JSON load, 750 ms debounce, synchronous temp-write/rename, final flush |
| `src/main/ipc` | Named channel allowlist, sender/frame/page checks, strict payload validation, role restrictions |
| `src/main/tray` | Hand-drawn 32 px bitmap converted to PNG, dynamic native menus |
| `src/preload/index.ts` | Typed `window.ducky`, explicit methods and removable subscriptions; no raw IPC or Node exposure |
| `src/renderer/companion` | Adapter host, shape-based hit decisions, pointer capture, bubble presentation |
| `src/renderer/settings` | React controls and live settings; normal focused window |
| `src/core/physics` | Gravity, friction, bounded throws, two-bounce cap, safe display selection, walking and recovery |
| `src/core/behaviour` | Weighted idle/look/sit/walk decisions with injectable clock and RNG |
| `src/core/events` | Typed bus for all section-28 event names |
| `src/core/interruptions` | One visible speech slot, priority/cooldown/mute/block rules, no backlog |
| `src/core/dialogue` | Category pools excluding the last three selections |
| `src/animation` | Replaceable adapter contract and self-contained SVG implementation; Rive README only |
| `src/shared` | Settings/IPC types, defaults, channel names and strict validators |
| `src/ai/providers/index.ts` | Type-only M2 provider/proposal contract; no runtime provider |

## Window and coordinate model

The companion is one 320 × 300 DIP transparent window at size 1.0. The SVG occupies
the whole viewport, with the duck at the bottom and bubble room above. Size scales
both dimensions from 0.6 to 1.6. Physics coordinates are the window's bottom-centre:
`window.x = body.x - width / 2`, `window.y = body.y - height`.
Ground positions are floored to integer DIP. Final window x is rounded and y is
floored, so a fractional work-area floor cannot round the window into the taskbar.
Display scale factors are not applied a second time; Electron screen positions
and work areas already use DIP.

Bounds deliberately reserve space for the **whole window**, which is more
conservative than clamping just the duck's silhouette. Compatible adjacent
same-floor work areas form a walking corridor. Unequal floors cause walking to
turn around. An airborne duck can cross a seam in the displays' vertical overlap;
on reaching unequal ground, the nearest valid display is selected and the window
is fitted there before continuing the fall. This can cause a small positional
correction at a seam. Gaps are never treated as valid floors.

Dragging uses the nearest valid display/corridor and clamps there. Reset uses the
primary work area's bottom-right, with a 24 DIP margin. Startup retains a valid
saved position (falling if airborne), or resets if no display contains it. Display
addition/removal/metrics changes and resume recover to the nearest safe ground.

## Data flow

```mermaid
flowchart LR
  Screen[Electron screen cursor] --> Poll[Main cursor poller]
  Poll -->|moved cursor and origin| Host[Companion renderer]
  Host -->|eye target / shape hit-test| Adapter[Animation adapter]
  Host -->|pointer capture + drag start/end| IPC[Validated IPC]
  IPC --> Controller[CompanionController]
  Poll -->|60 Hz drag samples| Controller
  Controller --> Physics[Pure physics]
  Physics --> Controller
  Controller --> Bounds[BrowserWindow.setBounds]
  Bounds -->|new origin| Host
  Controller -->|state / bubble| Host
  Settings[React settings] --> IPC
  Controller --> Store[Local settings JSON]
```

Cursor polling runs at 20 Hz within 600 DIP of the companion window or for one
second after movement, otherwise at 4 Hz. It sends only changed cursor positions,
preserving the last point across capture mode changes. During a candidate or
active drag, it samples at 60 Hz, including stationary samples to avoid stale
release velocity. Window movement has a separate origin-only notification, so
eyes and hit-tests remain correct even under a stationary cursor.

The renderer uses `document.elementFromPoint` **inside the adapter** against
painted SVG hit shapes, plus the visible bubble in its own HTML. Transparent
regions are not rectangular hitboxes. It sends hit-state changes to main, with
explicit resynchronization after capture/visibility transitions. While capture
is active, main keeps mouse input enabled. Forwarded mouse moves and cursor
updates allow hit-testing even when the window ignores clicks.

On pointer-down, the renderer captures the pointer and main records a grab offset.
Main stops walking immediately, then waits for four DIP of cursor movement before
entering picked-up state. Releases/capture loss/blur terminate the drag once. A
short velocity history feeds physics. Single-click reactions wait 500 ms so native
double-click can cancel their annoyance counts and open Settings.

## Timers and event handling

- Motion: 60 Hz only while falling, sliding or walking. Dragging uses the cursor timer instead.
- Cursor: adaptive 4/20 Hz while visible and unpaused; 60 Hz during capture; stopped otherwise.
- Behaviour: two-second tick while active; decisions are spaced 5–15 seconds apart.
- Idle: 30-second poll while active; threshold defaults to five minutes.
- Blink: one adapter timeout at a random 2–6 second interval, with occasional double blink.
- Breath: four discrete SVG poses spaced 400 ms apart, then eight seconds at rest;
  no ambient CSS animation or transition. Sleep letters stay static. Hide, pause,
  reduced motion and non-ambient poses cancel the breath timeout. Background
  throttling remains enabled; stationary idle has no 60 Hz animation/timer.
- Reactions and speech: bounded one-shot timers. Hide/pause clears them; the adapter stops its timers and CSS animation activity.
- Settings: 750 ms debounce; position changes are saved on release, settle, recovery and quit rather than each frame.

`EventBus` defines every brief section-28 event. M1 emits app start/resume, character
hover/click/pickup/drop/landing, user idle/return, and animation completion. The
controller subscribes to interaction/landing/idle events to drive reactions and
speech. Future task, awareness and AI events are types only. No event invokes AI in M1.

The speech slot rejects new messages while occupied, including high priority;
there is no hidden queue to replay later. High priority bypasses cooldown when
the slot is empty, but never bypasses pause/hide/sleep/top-edge suppression.

## Security boundary

Both renderers use context isolation, disabled Node integration, sandboxing and
web security. The preload builds to a single CommonJS file requiring only Electron.
Only static, validated channels are registered; output channels and unknown names
are not accepted as requests. Invocations verify the exact expected main frame,
webContents and page URL. Companion input methods are unavailable to the settings
renderer at the main-process boundary. Settings patches cannot write position or
the first-launch flag.

Windows block navigation, redirects, popups and webview attachment. The session
denies permissions and downloads. Production requests are limited to local
resources; development additionally permits the configured Vite loopback origin
and its WebSocket. There is no Node networking code, shell execution or external
content. CSP denies inline scripts, objects, forms and arbitrary resource origins.
Inline styles are allowed for SVG/CSS adapter properties and React styles.

## Later milestones

| Milestone | Attachment point; not implemented in M1 |
| --- | --- |
| M2: brain | Implement `AIProvider` in `src/ai/providers` and an optional local transport in `src/ai/ollama`; validate proposals, discard aborted/stale results, then pass permitted speech through `SpeechQueue` |
| M3: personality | Add pure emotion/personality state and memory interfaces; extend scheduler weights and dialogue selection through the bus |
| M4: awareness | Add separately permission-gated collectors under `src/awareness`; emit typed events without changing physics/renderers |
| M5: productivity | Add `src/main/database` SQLite repository and `src/main/scheduler` durable reminder service; task/reminder/focus events feed existing interruption rules |
| M6: vision | Add separately authorized selected-window capture under `src/awareness/vision`, transient data and validated AI context; no current capture permission or pipeline |
| M7: art | Replace `PlaceholderDuck` with the Rive implementation of the same adapter/surface contract |
| M8: release | Installer/signing, resource budgets, long-duration testing, crash recovery and security/accessibility review |

Future productivity timers must have their own lifetime: hiding the companion
must not implicitly stop reminders. There is no database, reminder scheduler,
awareness collector, or local AI connection in this build.
