# Ducky implementation status

## Milestone 3 - Give Ducky a personality (2026-11-25)

| Feature | Implemented | Unit-tested | Verified-on-desktop |
| --- | --- | --- | --- |
| Four preset cards, talkativeness, activity level, profanity | Yes; presets.ts text preserved | Schemas, seeded voice differences, 75%/30% selection, shared recent exclusion | Pending Claude |
| AI preset style/examples, mild language, strong/slur and guilt rejection | Yes | Prompt allowlist and language cases; model event restrictions | Pending Claude |
| Seven numeric emotions, weighted daily mood, MOOD_CHANGED, idle faces | Yes | Decay, inputs, caps, daily stability, no away penalty, timer suspension | Pending Claude |
| Weighted finite activities and cooldowned Easter eggs | Yes | Frequency, sleepiness gate, cooldowns, visitor long-run rate, controller durations/cancellation | Pending Claude |
| Fullscreen suppression with app awareness off | Yes; geometry-only helper mode | Generated API boundary and suppression | Pending Claude |
| memory.json, readable settings, name, confirmed forget/disable | Yes | Validation, retention, aggregates, atomic debounce, deletion/canceled writes | Pending Claude |
| Memory greetings, pickup receipts, 7/30/100 run-day milestones | Yes | Templates, cooldowns, controller milestone handling | Pending Claude |
| Shorter daily click/drag patience; gentle hovers and daily reset | Yes | Input, interaction and controller tests | Pending Claude |
| Development --debug-activity flag | Yes; ignored when packaged | Allowlist, forced activity, packaged rejection | Pending Claude |
| Adapter boundary and idle performance | Finite clips/static props; no new continuous idle animation | IDs, activity duration and cancellation | Pending Claude / CPU measurement |

Validation for M3:

- `npm run typecheck`: passed.
- `npm test`: 447 passed in 21 files; two existing opt-in native helper tests
  skipped. The manual Ollama bake-off remains excluded from the default run.
- `npm run build`: passed for main, preload and both renderers.
- `git diff --check`: clean.
- No commit, new dependency, network request, Notion or MCP use.

Desktop handoff: see animation-contract.md for the debug command and IDs. Compare
the four voices; toggle profanity and memory; inspect memory.json; confirm Forget
everything removes it and clears the name; screenshot each new activity; repeat
the stationary-idle CPU measurement with settings closed. Include the geometry
helper in process CPU/memory totals. Fullscreen detection retains a three-second
sampling delay and startup compilation delay. Autonomous activity waits for a
known safe sample and stops if the helper becomes unavailable. No native, visual
or performance acceptance is claimed by unit tests.

Some supplied preset lines conflict with no guilt or never-at-you swearing. They
remain untouched in source and are excluded at selection time and from AI
examples. Numeric emotions remain transient; only mood/date, install seed and
bounded interaction aggregates persist. Real-model voice comparison is pending.

## Milestone 2 — Local hybrid brain (2026-11-25)

This section supersedes historical claims below that no AI is connected or that
click dialogue waits 500 ms. No git commit, dependency addition, model download,
MCP call or real Ollama request was made by Codex for this implementation.
Claude separately ran the real-model bake-off described below.

| Feature | Implemented | Unit-tested | Verified on desktop |
| --- | --- | --- | --- |
| Main-only Ollama version/tags/chat, fixed 127.0.0.1 host, numeric port, no redirects | Yes | Fake fetch: options, success, errors, deadlines, abort, one active transport | Pending Claude |
| Disabled-by-default settings, preferred installed model selection, manual connection/sample test | Yes | Settings persistence, schemas and main lifecycle; visual controls pending | Pending Claude |
| Background 60 s warmup, 2.5 s warm deadline, ten-minute keep-alive, automatic offline/cold-load recovery | Yes | Fake timers: backoff, single warmup, pause/hide cancellation and resume | Pending Claude |
| Immediate built-in physical reactions; AI-first slow/ambient routing after director gates | Yes | Routing and mocked controller, including click under 100 ms and sustained hold | Pending Claude |
| Same-situation examples, bounded recent dialogue, allowlisted context and sanitized app name | Yes | Prompt builder across every eligible situation | Pending Claude |
| JSON/shape/text/observation/profanity/repetition/time validation; fragment removal; quote cleanup; enum defaults; model silence | Yes | Rule-by-rule tests | Round-1 repeat rejection verified by Claude; new rules pending desktop |
| New-event cancellation and stale-result discard, including non-cooperative fake providers | Yes | Request tokens and controller transitions | Pending Claude |
| Pause/hide/sleep/privacy/fullscreen/disable/revoke/quit cancellation | Yes | Main lifecycle and mocked Electron | Pending Claude |
| Settings/tray connected versus built-in indicator | Yes | Main status transitions; native UI inspection pending | Pending Claude |
| No output execution, independent renderer animation/physics, unchanged CSP | Yes | Static boundaries, build, controller tests; live traffic/performance pending | Pending Claude |

Verification for this revision:

- `npm run typecheck`: passed.
- `npm test`: 363 passed in 17 files; two existing opt-in native-awareness tests
  in one file skipped. The manual Ollama bake-off is excluded from the default run.
- `npm run build`: passed (main, preload, companion and settings bundles).
- `git diff --check`: clean. Renderer bundles contain no Ollama transport.
- Codex's automated tests use fake providers/fetch; real Ollama was not contacted
  during this revision. Desktop recovery acceptance and frame smoothness remain
  pending; Claude's earlier model measurement follows.

Claude's real-model bake-off (round-1 validator, actual prompt builder + provider +
validator; original results `.codex-logs/bakeoff.txt`):

- `qwen3:8b`: **22/28 valid**, approximately **235 ms warm**; clearly funnier.
- `gemma3:4b`: **16/28 valid**; flat delivery and invented clock time
  ("Twelve thirty" when context said `14:20`).
- The validator correctly rejected repeats. These are Claude's measurements,
  not a new bake-off or evidence that round-2 validation has been measured live.
- Default selection when AI is enabled and the saved model is empty or missing:
  first installed of `qwen3:8b`, `qwen3:4b`, `gemma3:4b`, otherwise the first model
  returned by `/api/tags`. An installed saved choice is preserved. Automatic
  selection is saved and shown in Settings; no models are downloaded.
- The script now lives at `tests/manual/ollama-bakeoff.test.ts`, is opt-in via
  `DUCKY_OLLAMA_BAKEOFF=1`, and writes to an environment-specified path or OS temp.
  Normal tests exclude it; see `testing.md` for the command.

Decisions and limitations:

- Optional AI follow-up beats for instant reactions are omitted. Existing authored
  follow-ups and validated ambient AI `then` beats still work.
- Added short authored examples to small situation pools so each AI-eligible pool
  supplies 4–6 distinct examples. The model is told not to copy them or infer facts
  from them. Heuristic validation cannot prove every claim is true; voice quality
  and unsupported observations beyond the explicit blacklist need desktop review.
- New click reactions use a zero-delay timer instead of the old 500 ms debounce.
  Double-click still opens Settings; its first reaction may already be visible.
- A long hold now interrupts pickup speech/cooldown before the director decides,
  so sustained-drag dialogue can actually run during a typical hold.
- Connection failures enter `offline` and use built-in lines while `/api/version`
  retries after 15 s, 30 s, 60 s, then every 120 s. Success refreshes installed
  models and re-warms before returning to `connected`. Retries stop when AI is
  disabled, hidden, paused, otherwise suspended, or disposed. A 2.5 s inference
  timeout falls back for that line and enters `warming`, with one background
  warmup at a time; it does not report an error. Warmup timeouts retry with backoff.
- Fullscreen/private-app cancellation depends on the existing opt-in helper and
  its polling interval. Self/unknown foreground samples clear context without
  blocking Settings diagnostics; private samples suspend AI without exposing an
  app identity. Cancellation stops the client; Ollama GPU cancellation is unverified.
- Recent displayed dialogue is bounded RAM-only history, cleared at privacy
  boundaries. This is not persistent memory or an open-ended chat interface.
- Existing Vite CommonJS/native-config warning remains non-fatal.

Desktop acceptance for Claude: enable each installed model; inspect connection
status/sample; trigger thoughts, app comments, hover linger and long holds; release
or change apps during inference; pause/hide/disable during a cold load; stop Ollama
mid-session; confirm built-in reactions, automatic reconnection, cold-load recovery, repetition quality,
renderer smoothness and immediate clicks/double-click Settings behavior.

The personality and opt-in app-awareness update below supersedes the corresponding
Milestone 1 dialogue/fullscreen limitations. Earlier desktop results remain
historical; they do not verify the new interaction behavior.

## Personality and app awareness ? 2026-11-25

Implemented:

- Curated `DialogueDirector`, one tuning table, injected RNG/clock, all template
  slots (including local time and human away durations), weighted shuffled bags,
  last-twelve exclusion, talkativeness scaling, and situation cooldowns. Only
  accepted speech consumes a line. Small exhausted pools stay silent.
- Hover enter/linger/revisits, four-second click escalation and forgiveness,
  repeated pickups, long holds, fast horizontal shake detection, final-settle
  big/small/wall landings, away-duration wakes, walking remarks, first launch,
  local-time thoughts, and forty-five-minute late-night gating.
- Two-beat speech replaces the first bubble after 1.5?2.5 seconds. Speech expiry
  is length-based; the conversational follow-up intentionally replaces its first
  beat sooner. Clicking/dragging/dismissal or higher-priority speech cancels the
  follow-up. Talking stays adapter-owned and continuous between beats.
- Opt-in Settings > Privacy checkbox, active indicator, hidden persistent
  PowerShell/C# helper, three-second foreground identity/fullscreen checks,
  private-name filtering, mapped categories, session thresholds, switching
  comments, fullscreen suppression, bounded restart, and cleanup.
- No model, dependencies, network use, commits, or SVG-boundary changes. The
  authored `lines.ts` is unchanged. Its one self-identifying AI sentence is
  excluded by the director; the remaining app-ai lines can still mention the
  actual foreground app by name.

Verification:

- `npm run typecheck`: passed.
- `npm test`: 145 passed in 13 files; two native checks in one file are skipped
  by default because they deliberately inspect the current foreground executable.
- `DUCKY_NATIVE_HELPER_TEST=1 npm test -- tests/awareness-native.test.ts`:
  both native checks passed separately on Windows (use PowerShell env syntax).
- `npm run build`: passed; `git diff --check`: clean.
- The existing Vite future-config-loader warning is unchanged and non-fatal.
- Real Windows helper tests pass: valid samples three seconds apart, PID gone
  after disable, and no orphan helper after its owner exits without disposal.
- Controller tests use mocked Electron and real dialogue/context/physics logic:
  first launch and follow-up interruption, click escalation/forgiveness, hover
  linger, landing once after bounces, awareness lifecycle, and fullscreen gating.
- The native check exposed a blocking Console.In.ReadLineAsync implementation in
  Windows PowerShell; a blocking pipe reader on a managed background thread fixes
  startup without adding foreground polling.

Decisions and pending acceptance:

- Ten-minute app gates are shared by category (including its long-session lines),
  which is stricter than per-app cooldowns and avoids historical app-name storage.
- Exclusions are executable-name patterns, not a complete banking-app registry.
  Banking websites cannot be recognized without reading forbidden content. See
  `privacy.md` for the exact limits and retained data.
- Fullscreen suppression works only while opt-in awareness runs. Native fullscreen
  geometry across mixed DPI/monitors still needs desktop verification.
- The new voice timing, shake/drop gestures, visual Settings indicator, actual app
  switching, real GUI Quit, and full-app idle CPU require desktop acceptance.
  Historical round-2 CPU measurements below are not measurements of this update.
- Preserve double-click-to-open-Settings behavior; rapid double-clicks can cancel
  delayed click replies. Use spaced single clicks within four seconds for the
  click-escalation desktop check.

## Historical Milestone 1 status

Implemented as a local prototype on 2026-11-25. Claude tested round 1 on Windows 11
with two 4K monitors at 150% scaling. Results below describe that desktop test;
round-2 fixes were re-checked on the desktop (see below). Milestones 2–8 are not implemented.

| Feature | Implemented | Unit-tested | Verified on real desktop |
| --- | --- | --- | --- |
| One transparent 320 × 300 DIP non-focusable companion window | Yes | No; Electron boundary | Verified: transparency and no focus stealing |
| Always-on-top / desktop-only / size | Yes, live | Size schema; native behaviour pending | Verified: live size change; z-order modes not yet verified on desktop |
| Painted-shape click-through and bubble interaction | Yes, adapter-owned SVG hit-test | No; renderer/native input | Verified: click-through; bubble interaction not yet verified on desktop |
| Debug hitbox outlines and `[ducky]` main logs | Yes | No; visual diagnostics | not yet verified on desktop |
| Cursor eye tracking and stationary-cursor window updates | Yes | No; renderer/native integration | Verified: eye tracking; stationary-cursor walking not yet verified on desktop |
| Random blink and occasional double blink | Yes | No; visual/timer integration | not yet verified on desktop |
| Idle, look, sit-ish and walking scheduler | Yes | Yes, seeded RNG, weights, cooldown, paused/sleep/busy gating | not yet verified on desktop |
| P0 SVG poses, reactions, independent talking | Yes | No; visual review required | Wing detachment found; round-2 fix awaits idle/walking/landing screenshots |
| Pointer capture, threshold, release and cancellation | Yes | Release-history math; native capture pending | Verified: drag on both monitors; cancellation edge cases not yet verified on desktop |
| Single/repeated clicks, annoyance, double-click Settings | Yes | No; native click sequencing pending | Settings window verified; click sequencing not yet verified on desktop |
| Gravity, throw velocity, friction, two-bounce settle | Yes | Yes | Verified: fall and land on both monitors; round-2 taskbar alignment awaits re-test |
| Top-edge clamping | Yes | Physics bounds | Verified on both monitors |
| Exterior wall bounce, gaps, negative coordinates | Yes | Yes, 1,250 seeded random drops over five layouts | not yet verified on desktop |
| Offset dual 2560 × 1440 and mixed-DPI layout logic | Yes, all DIP | Yes, including airborne seam crossing | Verified: drag/fall/land on two 4K monitors at 150%; listed synthetic layouts not yet verified on desktop |
| Walking turn-around and same-floor monitor crossing | Yes | Yes | not yet verified on desktop |
| Monitor change/resume recovery and reset | Yes | Recovery/reset math; OS event delivery pending | not yet verified on desktop |
| Valid saved position restore / disconnected-display reset | Yes | Persistence and geometry separately; startup integration pending | not yet verified on desktop |
| Sleep after idle and return greeting | Yes, 30-second polling | Scheduler sleep gate; OS idle integration pending | not yet verified on desktop |
| One speech bubble, timeout, cooldown, mute and suppression | Yes | Queue/priority/duration rules; bubble layout pending | not yet verified on desktop |
| Fallback dialogue with last-three exclusion | Yes | Yes, across/within categories | not yet verified on desktop |
| One first-launch greeting | Yes, persisted flag | Flag persistence; UI integration pending | not yet verified on desktop |
| Tray icon, matching duck menu, dynamic labels, show/hide | Yes | No; native menus | Verified: context menu and hide/show; tray left-click not yet verified on desktop |
| Pause/resume and hidden timer shutdown | Yes | Scheduler gate; controller/adapter timer lifetime pending | not yet verified on desktop |
| React settings and keyboard-accessible controls | Yes | Validation; UI/accessibility pending | Verified: settings window and live size change; keyboard accessibility not yet verified on desktop |
| Launch at startup | Yes, login-item API | No; Windows login required | not yet verified on desktop |
| OS and app reduced-motion support | Yes | Physical no-bounce path; animation/accessibility pending | not yet verified on desktop |
| Validated JSON, partial recovery, debounce, atomic replace, final flush | Yes | Yes, schema and filesystem store | not yet verified on desktop |
| Typed event bus and reserved future events | Yes | Yes, delivery/unsubscribe | not yet verified on desktop |
| Validated minimal IPC and sandboxed CommonJS preload | Yes | Payload/channel tests; built preload inspected; native sender checks pending | Verified: IPC validation |
| Navigation/popups/permissions/downloads denied; local-only production requests | Yes | No integration/traffic audit | not yet verified on desktop |
| Single instance and clean Quit | Yes | No; native process lifetime | Verified: clean quit; single instance not yet verified on desktop |
| Windows unpacked directory packaging | Yes, offline packaging passed | Build check; unsigned/default executable resources | not yet verified on desktop |

## Automated results

- `npm test`: **43 passed**, nine test files (round 2).
- `npm run typecheck`: passed, no TypeScript errors.
- `npm run build`: passed, main/preload/companion/settings outputs generated.
- `npm run pack:win`: passed in round 1 using the locally installed Electron distribution; not re-run in round 2.
- No dependency versions, electron-vite configuration or Vitest configuration changed.
- Vitest prints a non-fatal future Vite native-config warning about ESM syntax in
  the existing CommonJS project configuration. Current tests/builds succeed.

## Round-2 fixes and pending measurements

- Static wing rotations now live on wrapping SVG groups. Only the inner ellipses
  use CSS transforms and shoulder origins. The remaining attribute transforms
  (pupil translations) have no CSS transform-origin; no other collision was found.
  Claude must check attached wings in idle, sitting, walking and landing.
- Removed continuous breathing and floating sleep-letter CSS animations. Breathing
  now uses four discrete pose changes, 400 ms apart, followed by eight seconds
  without ambient updates. Sleep letters are static; discrete blinks remain.
  Breath timers stop on hide, pause, reduced motion, moving/reaction poses and dispose.
- Cursor sampling stays at 20 Hz within 600 DIP of the companion window or for one
  second after movement; distant stationary sampling drops to 4 Hz. Drag capture
  retains 60 Hz velocity samples. Unchanged points never send duplicate cursor IPC
  while active, including when switching capture modes. Hide/pause stops polling.
- Motion's 60 Hz timer still exists only during falling, sliding or walking;
  stationary idle has no 60 Hz animation/timer. The two-second behaviour tick is
  unchanged and publishes only a changed behaviour. Background throttling stays on.
  No frame-rate cap was added: the installed Electron API documents setFrameRate
  for offscreen rendering, whereas this companion uses a normal native window.
- Ground positions use floored integer DIP, and window origins floor y before
  Electron receives bounds. Regression tests cover fractional 150% floors,
  including negative coordinates, walking/recovery/reset and odd window heights.
- Idle CPU, measured by Claude on the real desktop (duck grounded, settings closed, cursor still, 15 s): round 1 about 2.5 CPU-seconds (~16% of one core); **round 2 0.09 CPU-seconds (~0.6% of one core)**, about 157 MB private memory across five Electron processes. Not a long-duration profile.
- Round 2 re-verified on the desktop: wings attached in idle and while falling; drag, fall and land still work; focus not stolen. On the primary monitor the window bottom now lands exactly on the taskbar top (y=2088 px). On the second monitor (offset 203 px) the transparent window still extends 2 px over the taskbar; the drawn feet do not, and that strip is click-through.
- Tray left-click, first-launch bubble, idle-to-sleep, launch-at-startup, monitor
  disconnect and resume are **not yet verified on desktop**.

## Decisions and known limitations

- Bounds protect the entire window, not just the body, leaving a roughly half-window
  margin at exterior edges. Moving across unequal-height seams or disconnected
  displays may visibly clamp/snap into the nearest valid area. Airborne crossing
  is allowed where the displays have enough vertical overlap; walking only crosses
  adjacent same-floor work areas. A work area smaller than the requested window
  dimensions is not a supported target for this prototype.
- Desktop-only means `alwaysOnTop = false`. It does not embed in Explorer or
  guarantee that the duck stays behind every ordinary window.
- Single-click reactions use a fixed 500 ms delay. Test unusually slow customized
  Windows double-click settings: a very slow double-click may already have produced
  one single-click reaction. Rapid repeated clicks can naturally form double-clicks
  and open Settings; use spaced single clicks to test annoyance.
- Claude verified transparency, click-through, no focus stealing, eye tracking,
  drag/fall/land on both monitors, top-edge clamping, context menu, settings,
  live size change, hide/show, IPC validation and clean quit. Fullscreen z-order,
  mixed scale factors and unlisted native edge cases remain unverified.
- Historical limitation, superseded above: fullscreen detection now works while
  optional awareness runs. Hide/Pause remain available through the tray.
- The renderer is hidden if it crashes; automatic renderer restart is not implemented.
  Quit/relaunch recovers the app. No long-duration CPU/GPU/memory profiling was done.
- Speech is deliberately sparse and rejected while busy rather than queued.
  Mute suppresses low priority; Pause suppresses all speech. No sound exists.
- The art is intentionally basic. No Rive asset/runtime is included. `happy` and
  several emotion IDs are available to later event producers; not every available
  animation is selected by today's small scheduler.
- Packaging produces an unsigned unpacked directory, not an installer. Executable
  icon/resource editing is skipped for offline packaging; the tray has its duck icon.
- Startup registration points to the executable location used when the setting was
  enabled. If moving an unpacked build, disable/re-enable startup from the new copy.

No desktop acceptance criterion is claimed verified by these unit tests.
