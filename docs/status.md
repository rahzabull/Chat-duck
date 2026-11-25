# Milestone 1 status

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
- Fullscreen detection and automatic fullscreen suppression are later milestones.
  Hide/Pause remain available manually through the tray.
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
