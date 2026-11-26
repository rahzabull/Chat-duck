# Ducky implementation status

## Milestone 6 — livelier talk, titles and window vision (2026-11-26)

| Area | Implementation | Verification |
|---|---|---|
| Talk levels | One cadence table; livelier Chatty; Won't shut up; bounded personality scaling; authored thought/mutter/activity mix | Fake clocks cover 45 minutes at three random values, 60–180 second spacing, and suppression gates |
| Activity reactions | App returns, rapid title switches, 10/25/45 minute title dwell, same-app follow-ups, short-break returns | Pure tracker and controller tests; perceived desktop liveliness pending Claude |
| Title opt-in | Default off; requires app awareness; 200-character native read after exclusions; private-site filtering; 60-character sanitized summary | Protocol, sanitization, exclusion-order tests; both native C# variants compile on Windows |
| Screen opt-in | Default off; requires AI and app awareness; installed-model picker; resident helper renders one checked HWND via PrintWindow; no screen fallback | Protocol, exclusion-order, native synthetic-window and JPEG/hash tests; real Chrome/Figma/VS Code relevance pending Claude |
| Capture scheduling | Existing tick, periodic cadence and 20-second change debounce, 32×20 grayscale skip, one pipeline, eight-second total deadline | Fake clocks cover rates, unchanged frames, slow capture, late responses and no work when off |
| Local AI | Fixed image-only observation prompt; structured description then existing hybrid comment; leak/repetition checks; no visual fallback | Mock provider tests cover prompt separation, ordering, rejection and abort; live model latency/quality pending Claude |
| Privacy controls | User executable exclusions before title reads; mode and permission revocation; no observation persistence path | Unit/controller tests cover privacy abort, private/self/fullscreen selection and strict settings storage; userData/log audit pending Claude |
| Visible controls | Eye badge with bounded pulse; badge and tray one-click stop; strong Settings explanation | Source wiring implemented; desktop appearance/hit testing pending Claude |
| Performance | No continuous capture, no new capture polling timer, no image/description cache, no new dependency | Off-state zero-capture tests; real idle CPU, GPU, memory and cold-load measurements pending Claude |

Validation: `npm run typecheck`, `npm test` and `npm run build` pass after the
single-window capture replacement. Windows tests compile both title-enabled and
guard-only capture helpers and exercise native refusals and JPEG scaling with
synthetic Win32 APIs, without inspecting or capturing any real window. The existing
non-fatal Vite native-config warning remains. No commits, npm dependencies, MCP
tools or live network requests were made.

**Desktop acceptance is pending Claude.** Enable both permissions with qwen3:8b
for dialogue and gemma3:4b for vision; check real topic-specific bubbles in
Chrome/Figma/VS Code, password-manager/WhatsApp/private web pages and user
exclusions, privacy/stop while inference runs, eye pulse/tray hit testing,
userData/log contents, and CPU/GPU with features off/on. Cold requests exceeding
eight seconds intentionally produce no screen comment.

**Round 2 capture:** Electron thumbnail enumeration is removed. The resident
helper validates a digits-only capture command, checks the exact HWND and private
exe/title exclusions before PrintWindow, and returns one in-memory JPEG capped
at 400 KB. Main skips blank and near-duplicate images. Native window/tab changes
can still race capture; fresh checks and epoch cancellation discard stale results.
This must not be represented as an OS-level exclusion guarantee. See
[privacy.md](privacy.md) for filtering and local-service limitations.

## Expansion Phase C (2026-11-25)

| Area | Implementation | Verification |
| --- | --- | --- |
| Mode resolver | Privacy > DND > gaming > focus > conversation > companion; independent suppression flags | Priority, timed expiry and hysteresis fake-clock tests pass |
| DND | Tray durations/off, Settings, local conversation intent, moon badge, calm body, no AI | Main/controller and UI routing tests pass; native desktop pending |
| Privacy | One-click tray/Settings, local intent, sunglasses, identity helper stopped, app context/history cleared | Cancellation and permission-boundary tests pass; native desktop pending |
| Gaming/fullscreen | 10-second entry, 5-second exit, hide/freeze, paused animation/cursor/motion, rare comeback | Transition and native-hide simulation tests pass; fullscreen desktop pending |
| Reminders | Durable scheduler preserved; OS-only during gaming or selected DND route; no return burst | Notification/retry/exception tests pass; Windows delivery pending |
| Proactive help | Morning agenda, optional evening summary, deadline/overdue nudges, 45-minute app offers, rare task thoughts | Every candidate tested with fake clocks for once/cooldown/mode/quiet/silence; real facts and persistence covered |
| Skill packs | Five independent prompt/style/offer packs, hand-written fallback lines, Settings cards and tray | Pack x personality prompt matrix and controls tests pass; local-model comparison pending |
| Debug preview | Unpackaged-only --debug-proactive allowlist; real data and interruption gates retained | Morning preview and packaged rejection tests pass |
| Performance | Reuses existing 2-second behaviour / 3-second geometry / 15-second reminder cadence; gaming disables fast work | Timer/cancellation tests pass; fresh idle CPU measurement pending |

Validation: `npm run typecheck` passed; `npm test` passed with **854 passed, 3
skipped**, 35 passing files and 2 skipped files; `npm run build` passed, including
Figma asset generation. The existing non-fatal Vite native-config warning remains.
No commits, new dependencies, MCP access or network calls were used for this job.

**Desktop verification remains pending.** Follow the Phase C checklist in
[testing.md](testing.md): tray toggles/badges, forced real morning briefing, a task
due in two hours, fullscreen hide/freeze/return, Windows notifications, pack answer
comparison and idle CPU against the committed baseline. Tests simulate native
window/helper events; they do not establish native performance or visual results.
Factual proactive summaries currently remain hand-written even with AI enabled;
rare task thoughts retain the optional hybrid route. App-specific offer backoff
lasts for this process only; daily/deadline delivery markers persist locally.


## Rahul's Figma Ducky (2026-11-25)

- Default character is now the parts-based Figma adapter. The old placeholder
  remains selectable in development with `--placeholder-duck`. No Rive runtime,
  npm dependency, network asset or character DOM access outside adapters was added.
  The development-only `--debug-activity` allowlist now includes all adapter IDs,
  including focus/alarm and the new coffee/gaming/gesture states.
- Dependency-free splitter and commit-ready outputs: 20 tightly cropped SVGs,
  312 preserved character paths, part manifest, static raw-import map and a
  labeled `assets/characters/ducky/preview.html` grid. The source assets were
  already untracked when this job began; neither source nor generated work was
  committed or staged by this job.
- State/conversation/emotion mappings, directional and prolonged drag poses,
  shallow/deep sleep, two-stage big-drop recovery, blinking, clamped gaze,
  discrete breathing, walking feet, mouth pulses and finite gestures implemented.
  Painted height remains about 160 DIP at size 1 with the existing foot anchor.
- Future full-pose SVGs in `ducky/extra/` override fallback art and props after
  regeneration/rebuild. Fallback clock, laptop, controller, coffee, confetti,
  placard, sunglasses, bread and visitor use outlined palette-matched SVG overlays.
- `npm run typecheck`: passed. `npm test`: **755 passed, 3 skipped** across
  33 passing and 2 skipped files. `npm run build`: passed, including automatic
  asset generation. Existing non-fatal Vite native-config warning remains.
- New browser fixture performs over 500 assertions using actual Chromium SVG
  parsing/geometry, all 20 poses and exact idle part counts, gaze/mirror and
  shared head pivots, alternating feet, state priorities, timer cancellation,
  deep sleep, drag direction/repeated pickups, big/small drops, extra overrides,
  painted hit testing and reduced motion. Static pose and activity grids were
  rendered locally and visually inspected. Generated test captures are in
  ignored `out/figma-check/`.
- The offscreen Electron runner hit a Windows AppContainer ACL restriction on
  the installed Electron directory. No ACLs were changed. Verification used
  an isolated, local-only headless Chromium process instead. The test harness's
  sandbox/GPU flags do not alter application BrowserWindow security settings.
- **Pending Claude:** real desktop drag/drop/hover screenshots at sizes
  0.6/1.0/1.6 and both directions; continuous-motion shoulder attachment; native
  click-through and fresh idle CPU measurement. Automated idle verification finds
  only blink/breath timers and zero running CSS animations; it is not a CPU profile.
- Classification caveat: flattened fallen supporting contours and small
  toothpick/mouth details have no certain idle counterpart and remain `extra`.
  Bored expression strokes are labeled brows; closed/smile strokes are eye arcs.
  Plain unannotated future extras have coarse palette-based painted hits and
  whole-pose motion; detailed parts should follow the extra-folder README.

The animation contract contains the complete pose/part list, state mapping,
extra-art workflow and M7 integration notes.

## Expansion Phase B — productivity (2026-11-25)

| Area | Implementation / automated verification | Desktop verification |
| --- | --- | --- |
| Local language | chrono-node dates, tasks/reminders/notes/focus before AI, missing dates and numbered title choices; phrasing/ambiguity tests | Pending Claude, AI off and on |
| Stores | Version 1 JSON, validation, cloned snapshots, serialized debounced durable writes, fsync/rename, corrupt backups, failed-write tests | Pending Claude, inspect userData |
| Reminders | 15s scheduler, startup/resume/unlock, clock jump/timezone detection, missed collapse, marker-before-notify, queue, snooze and recurrence | Pending Claude, one-minute/sleep/restart/Windows notification |
| Calendar math | Daily/selected weekdays/monthly 31/custom intervals, spring/fall DST and timezone tests | Pending Claude |
| Task cards | Today/Upcoming/Overdue/Done/search, edits/priority/subtasks, Add/Undo/confirmed Delete and Clear completed | Pending Claude, keyboard and celebration |
| Reminder cards | Confirmation/Edit/Undo, list, due card with Done/Snooze/custom/Reschedule/Dismiss and waiting count | Pending Claude |
| Notes | Editable plain text, search/Copy/Pin/Delete; reading Save/Pin writes one note with topic saved | Pending Claude, save and retrieve an answer |
| Focus | Countdown, pause/resume/stop, quiet static pose, celebration, optional breaks and opt-in history | Pending Claude, short timer and four-session break |
| Tools / IPC | Live tool names in model schema, confirm permission for destructive operations, bound single-use UI tokens, truthful mutation results | Pending Claude, local model requests |
| Settings / tray | Productivity preferences, running-only notice, separate delete-all and JSON/text save-dialog export; memory independent | Pending Claude |
| Safe rendering / layout | DOM text/value rendering tests, native controls and Escape handling, shared fixed-feet/clamped layout | Pending Claude, mixed DPI / edges |
| Performance | Reminder interval only every 15s; active focus deadline and active-only countdown; no new idle animation loop | Pending Claude, idle CPU including helper |

Automated checks: typecheck passed; 744 tests passed and two existing native/manual
tests skipped; production build passed for main, preload and both renderers.
`git diff --check` passed. The existing Vite CommonJS/config-loader warning is non-fatal.
No commit, dependency installation, network access, Notion or MCP use.

Reminders only fire while Ducky is running; there is no OS-level scheduling.
Active focus sessions/cycle count are in RAM and end on restart. A crash between
persisting a fired marker and notifying leaves a due card for the next launch
without a repeated alarm. Windows notification policy and actual activation,
rendering, mixed-display layout, timer sleep behavior and CPU are **not** proven
by mocks: desktop verification is pending Claude.

## Expansion Phase A — talk to Ducky (2026-11-25)

| Area | Implementation / automated verification | Desktop verification |
| --- | --- | --- |
| Entry and focus | Synchronous activation, one 300 ms retry, click-to-type fallback, hide/showInactive on close; fake-window order and renderer tests | Round 2 desktop retest pending Claude |
| Current reply | Attached one-to-three-line input, Enter/Shift+Enter/Esc, 20s blur/90s inactivity, interruption, beats, safe markdown reading panel/Expand/Copy/Close | verified on desktop: pending Claude |
| Geometry | Clamped upward/sideways expansion, fixed feet; boundary tests | verified on desktop: pending Claude |
| Engine | Same main-only loopback provider/model; JSON, 700 tokens, 0.8 temperature, 45s timeout, 8s thinking line; fake-provider tests | verified on desktop: pending Claude |
| Output safety | Shared mandatory blocklist, leetspeak normalization, short/directed insult rejection, one conversation regeneration then authored error; ambient fallback and summary/tool-argument checks | Round 2 desktop retest pending Claude |
| Short/garbled input | Under two visible characters or no letters gets one of four authored talk_huh lines without reply inference; numeric memory choices remain local | Round 2 desktop retest pending Claude |
| Local commands | Remember/forget/disambiguate/recall/mute/bye without AI; parser, pronoun and error tests | verified on desktop: pending Claude |
| Tool registry | safe/confirm/blocked, two execution rounds, actual results fed back, authoritative mutation acknowledgements and failure tests | verified on desktop: pending Claude |
| Continuity | Last 12 messages, 8 memories, 3 summaries; replaceable retrieval interface; archive/summary/retention/deletion tests | verified on desktop: pending Claude |
| Settings | Memory add/edit/category/delete; archive View/Export/Delete/Delete all; Forget everything includes stats | verified on desktop: pending Claude |
| Animation | Ten adapter conversation states, SVG/CSS placeholder poses; shared shoulder pivots fix stretch detachment | verified on desktop: pending Claude |
| Idle resources | No new continuous idle loop, daily purge only, timers cancelled, ambient AI suspended during summary | verified on desktop: pending Claude |

Round 2 automated checks: typecheck passed; 620 tests passed, two opt-in/manual tests skipped;
production build passed. The existing Vite CommonJS/config-loader future warning
is non-fatal. No dependency added, external service used, or commit created.

Desktop acceptance still needs Windows focus return, shortcut conflicts, reading
panel/input layout near edges and on mixed-DPI monitors, real qwen3:8b general/code/
brainstorm replies, restart continuity, stopped-Ollama behavior, every animation
state screenshot and idle CPU. Round 2 removes native HWND capture/restore;
Windows selects the next window in z-order on close. Mocks do not prove activation. Summary failures
preserve user-derived topics. Retention/deletion cannot erase exported copies or
external backups. Earlier milestone double-click instructions are superseded:
double-click now opens conversation, with Settings available in native menus.

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
