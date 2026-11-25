# Testing

## Milestone 2 local AI

`npm test` uses fake providers/fetch and fake timers for local AI. It covers
offline recovery (15 s, 30 s, 60 s, then every 120 s), cancellation while hidden
or paused, cold-load re-warming, installed-model defaults, and response validation.
The normal include pattern is `tests/*.test.ts`, excluding `tests/manual/`.

The real-model bake-off is `tests/manual/ollama-bakeoff.test.ts`. It uses the
actual prompt builder, Ollama provider and validator against local Ollama on
port 11434. Install `qwen3:8b` and `gemma3:4b` yourself before running it; the
script does not download models. It requires `DUCKY_OLLAMA_BAKEOFF=1` both to
include manual tests and to enable the test itself:

```powershell
$env:DUCKY_OLLAMA_BAKEOFF = '1'
$env:DUCKY_OLLAMA_BAKEOFF_OUTPUT = Join-Path ([System.IO.Path]::GetTempPath()) 'ducky-bakeoff.txt'
try { npm test -- tests/manual/ollama-bakeoff.test.ts }
finally {
  Remove-Item Env:\DUCKY_OLLAMA_BAKEOFF
  Remove-Item Env:\DUCKY_OLLAMA_BAKEOFF_OUTPUT
}
```

`DUCKY_OLLAMA_BAKEOFF_OUTPUT` is optional; without it the script writes a
timestamped `ducky-ollama-bakeoff-*.txt` in the OS temp directory. It prints the
output path. The supplied output file is overwritten; its parent must exist.
The run makes 28 requests per model and excludes each model's first request
from the warm latency average. Cold-load requests retain the production 2.5 s
deadline; warm the models first when comparing steady-state response quality.
See `status.md` for Claude's round-1 measurements, which predate round-2 validation.

## Curated personality and optional app awareness

Current automated result: **145 passed**, with two native Windows checks skipped
by default. `npm run typecheck` and `npm run build` pass. The two native checks
were explicitly enabled and passed separately on Windows.

Default tests do not read the actual foreground application. They cover seeded
dialogue selection, last-twelve exclusion, shuffled bags, templates, cooldowns,
interaction context, two-beat interruption, mapping/exclusions, session thresholds,
fullscreen suppression, process lifecycle/retry, settings opt-in, and controller
wiring using mocked Electron. Existing physics/settings/IPC tests remain included.

To explicitly opt into native helper verification (samples are discarded, never
printed or persisted):

```powershell
$env:DUCKY_NATIVE_HELPER_TEST = '1'
try { npm test -- tests/awareness-native.test.ts }
finally { Remove-Item Env:\DUCKY_NATIVE_HELPER_TEST }
```

These checks spawn owned hidden helpers, verify samples three seconds apart,
verify their PID disappears on disable, and verify parent exit leaves no helper.
They do not launch the full Electron GUI or establish idle CPU performance.

Additional desktop acceptance for this revision:

- [ ] Hover briefly, linger over 2.5 seconds, and revisit three times in a minute.
- [ ] Click five times within four seconds; wait twenty seconds for possible forgiveness.
- [ ] Pick up three times in two minutes; hold over four seconds; shake rapidly.
- [ ] Drop from above 500 DIP and throw into an exterior wall; speak once after settling.
- [ ] Verify two beats share one bubble, talking continues, and a new click/drag cancels the second beat.
- [ ] Check short/long away greetings, time-of-day thoughts, and talkativeness.
- [ ] Enable Privacy > app awareness, confirm the active indicator, and switch app categories.
- [ ] Confirm private apps do not receive comments and clear the previous app bubble.
- [ ] Check fullscreen suppression across monitors/DPI while awareness is enabled.
- [ ] Disable, pause, hide, and quit; confirm the owned PowerShell helper exits each time.
- [ ] Re-measure full-app idle CPU with awareness off and on after helper startup.

## Historical Milestone 1 testing

Automated checks use Vitest in Node without launching Electron. Cursor tests mock
Electron's screen API and use fake timers to check 4/20/60 Hz sampling, duplicate
IPC suppression, capture transitions and shutdown. Other checks cover physics,
scheduling, interruption rules, dialogue exclusion, event subscriptions, settings
validation/persistence and IPC validators. The local settings store is tested
using temporary test-owned files and mocked time; these tests do not touch live
application settings.

```powershell
npm test
npm run typecheck
npm run build
npm run pack:win
```

Current round-2 result: 43 tests in nine files pass; typecheck and build pass.
Offline unpacked packaging passed in round 1 and was not re-run in round 2.
Vitest's warning about a future native Vite config loader is
non-fatal and comes from the unchanged supplied configuration.

Physics includes 250 seeded drops on each of five layouts: single monitor,
aligned dual monitors, dual 2560 × 1440 monitors with the second at y=135,
4K at 1.5× next to 1080p at 1× (converted to DIP), and negative coordinates with
a gap. Tests verify valid positions during drops, final ground, bounce limits,
velocity/friction, recovery after display removal, exact walking distance,
walking seam rules and airborne offset-seam crossing. Round-2 tests add fractional
work-area floors at 150% scaling, negative origins and separately rounded native
window origin/height, including odd DIP heights, to prevent taskbar overlap.

These tests do not validate native input forwarding, Windows focus, visual layout,
tray behaviour, actual DPI transitions, startup registration, or process exit.
Claude verified the round-1 subset recorded in `docs/status.md` on Windows 11 with
two 4K monitors at 150% scaling. The checklist below remains the full acceptance
matrix; unchecked entries are not a claim that every sub-case has been tested.
Round-2 wing appearance, physical taskbar alignment and idle CPU need re-testing.

## Manual acceptance checklist

Preparation:

- [ ] Build, then run `npm run start:debug` from a terminal; keep `[ducky]` output available.
- [ ] Launch Electron normally for manual tests. Launching it from a script with
  a hidden window style (for example PowerShell `Start-Process -WindowStyle Hidden`)
  makes Windows apply `SW_HIDE` to the first normal `show()`, so Settings stays
  invisible. This launch artifact can look like a settings-window failure.
- [ ] Test Windows 11 with two 2560 × 1440 displays, the second 135 px lower, initially scale 1×.
- [ ] Record Windows version, display rectangles/work areas/DPI, taskbar position, and whether taskbar auto-hide is enabled.
- [ ] Put a text editor behind Ducky with a visible typing caret. Note the focused app before each test.

Window, transparency and gaze:

- [ ] Ducky appears at bottom-right above the primary taskbar; no solid background, native frame or taskbar button.
- [ ] The first-launch line is exactly “Hello. I live here now.”; it dismisses, and does not recur after Quit/relaunch.
- [ ] Move across hat, head, beak, wings, body and feet: each shape interacts. Eye whites/pupils still hit the underlying head.
- [ ] Click through empty corners, between separate shapes, and the former bubble area after dismissal; the underlying app receives the click.
- [ ] Move quickly from outside to the duck, click, then move away; no sticky rectangle captures later clicks.
- [ ] Leave the cursor stationary while Ducky walks underneath: hit-testing and gaze update with window position.
- [ ] Hover, click, drag, release, show/hide and reset never steal keyboard focus from the text editor. Explicit Settings is allowed to focus.
- [ ] Eye pupils track in all directions, remain inside eyes, and look correctly after sprite mirroring.
- [ ] Blinks vary between roughly 2–6 seconds, with occasional double blinks.

Interactions and speech:

- [ ] One click produces a startled reaction after the double-click delay; not every click speaks.
- [ ] Five single clicks roughly 600 ms apart produce annoyance/anger, without being classified as double-clicks.
- [ ] A normal double-click opens one Settings window and does not produce two annoyance counts. Repeat at the user's configured Windows double-click speed.
- [ ] Right-click the duck and the tray: matching Show, Hide, Pause/Resume, Mute/Unmute, Reset position, Settings and Quit actions.
- [ ] Pick up from different body locations: the initial grab offset is preserved; less than 4 DIP movement remains a click.
- [ ] Picked-up state dangles/flaps/kicks. Walk motion stops immediately on grabbing.
- [ ] Move fast, stop for at least 150 ms, then release: no stale throw. Fling and release immediately: velocity carries.
- [ ] Release inside/outside the current window, lose capture, or switch foreground app during drag: no stuck drag and no duplicate release.
- [ ] Falling lands with at most two small bounces and settles. Release from near the top and throw toward both outer edges.
- [ ] Bubbles wrap and remain inside the window at sizes 0.6, 1.0 and 1.6. No overlapping bubbles or clipped fallback lines.
- [ ] Click a bubble to dismiss it. Cooldown prevents immediate replacement; rejected messages never reappear as a backlog.
- [ ] Drag near a display's top: no new bubbles appear there.
- [ ] Quiet/Normal/Chatty change speech frequency over multiple interactions. Mute suppresses unsolicited low-priority bubbles; direct interaction replies may remain.

Walking, displays and recovery:

- [ ] Let Ducky idle for a few minutes: look/sit/walk decisions vary; walking is gentle and flips direction at edges.
- [ ] On the 135 px offset seam, walking turns around. Drag to the other monitor and release: correct work-area ground.
- [ ] Temporarily align the monitors' work-area bottoms: walking crosses their seam.
- [ ] Throw through the overlapping vertical region of the offset displays: Ducky reaches valid ground, with no indefinite floating over a gap.
- [ ] Test a monitor gap and a monitor left/above primary (negative coordinates). No loss outside all displays.
- [ ] Test 4K at 150% beside 1080p at 100%; no doubled scale factor, broken grab offset, or off-screen recovery.
- [ ] Disconnect the display containing Ducky, change resolution/scaling, reconnect it, and sleep/resume Windows: Ducky re-clamps to valid ground.
- [ ] Reset position from both tray and Settings returns to primary bottom-right.
- [ ] Quit/relaunch after moving: valid position restored. Relaunch after removing that display: reset to primary.
- [ ] Exercise fullscreen video/game and app switching; note z-order behaviour. Automatic fullscreen detection is not implemented.

Settings, idle and accessibility:

- [ ] Double-click or choose Settings repeatedly: only one normal settings window; close it and Ducky continues.
- [ ] Tab/Shift+Tab, Space, arrow keys and Enter operate real labelled controls; focus indicator is visible and content scrolls.
- [ ] Always-on-top toggles live; desktop-only overrides it and allows ordinary windows to cover Ducky.
- [ ] Size slider applies live and retains safe ground. Walking off stops any current walk.
- [ ] Reduce motion via both the app setting and Windows accessibility preference: no body bob/squash/flapping/pop-in, no physical bounce; expressions remain clear.
- [ ] Set idle-to-sleep to one minute, stop input, wait through the next 30-second poll: closed eyes/z letters. Resume input and wait up to 30 seconds: waking and sometimes greeting.
- [ ] Pause while walking and falling: static idle at the current position, no motion/bubbles/gaze polling. Resume continues safely.
- [ ] Hide/show repeatedly from tray left-click and menu. Hiding suspends animation and polling; showing is inactive and does not create duplicate timers.
- [ ] Edit settings, Quit, relaunch: persistence. With Ducky stopped, try malformed/partial JSON: safe defaults merged, no crash.
- [ ] Enable startup from the unpacked build and verify after Windows sign-in; disable and verify its startup registration is removed.

Lifecycle, security and resource checks:

- [ ] Launch a second copy: first shows Ducky/focuses existing Settings; second exits without another duck/tray icon.
- [ ] Quit using tray, duck context menu and Settings in separate runs. Windows and tray icon disappear; settings JSON is complete.
- [ ] After quitting, confirm no child Electron/Ducky processes belonging to this app remain. Avoid counting unrelated Electron applications.
- [ ] Run the unpacked `release/win-unpacked/Ducky.exe` with and without `--debug-hitbox`; repeat focus, capture, tray and quit checks.
- [ ] Inspect built preload: CommonJS `require('electron')`, no Node/filesystem/network APIs exposed to renderer.
- [ ] Try malformed IPC using a controlled developer test: unknown channel, extra keys, invalid enums, invalid sender/frame all fail/are ignored safely.
- [ ] Confirm navigation, new windows, permission requests and downloads cannot escape the intended app pages.
- [ ] Monitor production network traffic separately; no application connections expected. Development intentionally uses loopback Vite traffic.
- [ ] Measure idle, moving, hidden and paused CPU/GPU/memory; repeat show/hide and drag cycles for leak checks. No performance budget has been claimed verified.

Round-2 regression checks on the same two 4K / 150% monitors:

- [ ] Screenshot idle, sitting, walking and landing: both wings stay attached.
- [ ] Check physical window bounds after landing, walking, resizing and reset on
  each monitor: the window bottom must not exceed its taskbar work-area bottom.
- [ ] Measure aggregate CPU time across all app Electron processes for 15 seconds
  while grounded, settings closed and cursor stationary. Record whether a walk or
  reaction occurred; repeat a stationary sample if needed. Test with the cursor
  near the duck and more than 600 DIP away. Target: <0.30 CPU-seconds (<2% of one
  core), versus round 1's ~2.5 CPU-seconds. Recheck gaze/drag responsiveness after
  distant polling has slowed, plus hide/show and pause/resume timer shutdown.

## Reporting a round-2 issue

Include the exact build/command, initial settings, display layout and scaling,
reproduction steps, expected/observed result, relevant `[ducky]` logs and whether
the original app retained focus. Screenshots or screen recordings should capture
the debug hitbox when investigating hit-testing. Keep personal desktop content
out of shared evidence. Do not mark an OS feature verified solely because its
core unit test passed.
