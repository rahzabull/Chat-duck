# Character animation contract

## Rahul Figma adapter (default, November 2026)

`src/animation/figma/FigmaDuck` now implements `CharacterSurface`. The original
`CharacterAnimationAdapter` interface is unchanged. All character DOM, painted
hit regions, gaze conversion, pose selection and animation timers belong to the
adapter. The renderer only constructs a surface and supplies state. The sections
below describing the placeholder remain historical/reference material for M7.

The development flag `--placeholder-duck` selects the original adapter. Main
forwards it to the sandboxed preload only in unpackaged builds; the renderer
reads the immutable `ducky.placeholderDuck` value. Normal launches use Rahul's
art. Example: `electron . --placeholder-duck --debug-activity stretch`.

`--debug-activity` now accepts every animation ID as well as the existing
scheduler IDs. New adapter IDs are gaming, laptop, coffee, shrug, laughing,
confused, thinking, thought and bread. For example, launch
`electron . --debug-activity coffee` to inspect the fallback or supplied extra.
Non-scheduler previews hold main's reaction state for ten seconds (sleeping for
75 seconds so deep sleep can be checked); finite adapter clips still finish at
their normal duration. The additional IDs are not added to autonomous scheduling.

### Assets and build

Run `npm run figma:split` after changing the sheet, pose rectangles or extras.
It also runs before `npm run dev`, `npm run build` and `npm run pack:win`.
The dependency-free script samples absolute M/L/H/V/C/Q path coordinates,
includes half the stroke width in approximate bounds, assigns paths by their
centres to the scaled pose rectangles, and writes tight SVGs with six-pixel
padding. It deliberately rejects unsupported path commands/transforms. Nine
label paths and all sheet rectangles/clips are omitted; **312 character paths**
are retained, including white toothpicks and blue sleep bubbles.

Commit-ready outputs live in `assets/characters/ducky/poses/`, `parts.json`,
`assets.generated.ts` and `preview.html`. Open the preview directly from disk.
The static import map uses Vite `?raw`; only trusted build assets and fixed local
prop markup enter `innerHTML`. There is no runtime fetch or SVG from model text.

All 20 pose names:
`idle`, `bored`, `smile`, `dragged_disgusted`, `not_interested`, `sleepy`,
`deep_sleep_a`, `deep_sleep_b`, `dragged_up_down`, `emote`, `listening`,
`interested`, `happy`, `dragged_right`, `thinking_a`, `thinking_b`, `chilling`,
`dragged_left`, `fallen_a`, `fallen_b`.

Parts: `tail`, `foot-left`, `foot-right`, `body`, `head`, `wing-left`,
`wing-right`, `tuft`, `eye-left`, `eye-right`, `beak`, `nostril`, `brow`,
`eye-arc`, `extra`. Every path is annotated. Consecutive paths of one part share
an animated group, especially each wing's separate fill and outline. Idle has
one of each named structural part, two wing paths per wing and two nostril
paths: 15 paths total. It has no brow, eye-arc or extra. `parts.json` records
per-pose path counts and whether both eyes are dots. Fallen supporting contours
and toothpick/mouth details have ambiguous correspondence to idle and are kept
as `extra`; they do not get wing or eye motion.

### State to pose

| Input | Pose / behavior |
| --- | --- |
| idle / walking | idle; walking alternates the feet |
| bored / not_interested / suspicious | bored / not_interested / not_interested |
| curious / interested | interested |
| happy / amused / laughing | happy / smile / smile; finite laugh bounce |
| angry / annoyed | bored, lowered brows and one short shake |
| startled / interrupted | emote, short flinch |
| sleeping / nap | sleepy; sustained sleep becomes deep_sleep_a at 60 seconds, then alternates a/b every 8 seconds |
| conversation listening | listening |
| conversation thinking / thinking / thought | thinking_a/b every 3 seconds |
| responding / explaining | idle with independent mouth / emote with finite wing gestures |
| conversation confused / unsure / sarcastic | interested with head tilt / emote with shrug / not_interested |
| conversation_end | idle, then clearing conversation resumes underlying activity |
| sitting / focus / laptop / coffee / sunglasses | chilling plus applicable overlay |
| gaming / visitor | interested with controller / listening with small visitor |
| alarm / celebrate / shrug | emote with clock / happy with confetti and finite flap / emote with lifted wings |
| yawn / stretch / dance / bread_snack / strike | sleepy / emote / happy / happy / bored, with gesture or prop |
| dragged | horizontal origin delta selects dragged_left/right; predominantly vertical selects dragged_up_down |
| long or repeated drag | dragged_disgusted after 3 seconds or three pickups within 15 seconds |
| falling | dragged_up_down with flapping wings |
| landing | short squash; drops of at least 60 DIP use fallen_a for 550 ms, fallen_b until 1200 ms, then idle |

Physical dragging, falling and landing take priority over conversation; sleep
also takes priority. Conversation temporarily overrides the underlying activity.
A big-drop recovery retains its visual through main's existing 430 ms physical
recovery/idle update. A new action, pause or hide cancels it. Finite reactions
emit one completion; cancellation does not emit stale completion events.

`CharacterSurface` has one optional extension, `setMotionPosition(x,y)`, for
world-space window origin samples already delivered by cursor/position IPC.
This avoids confusing local cursor gaze with drag velocity. No new timer or IPC
channel is added. Horizontal delta sign chooses drag direction; greatest downward
travel from the fall apex distinguishes big drops. A stationary drag retains
its last direction until the three-second disgust transition.

### Motion, sizing and hit testing

The surrounding logical artboard remains 320x300. Standing art is about 160 DIP
tall at size 1, matching the placeholder's painted height, with feet anchored at
y=300. All Rahul poses share one scale, so fallen poses lie down without growing.
Existing character-size and conversation/productivity layout scaling still apply.
Direction uses an outer SVG group mirrored about x=160. Cursor targets are
converted with the inverse screen CTM, including direction and layout scaling,
and eye dots move at most three source pixels.

Part groups use CSS fill-box origins. Wings pivot about the midpoint of their
open shoulder edge. Static SVG translation/mirroring uses separate outer groups;
no element combines an SVG transform attribute with CSS transform-origin. Head
rig wrappers use a shared fixed view-box pivot so moving eye/mouth child bounds
cannot change the head pivot. The original painter order is preserved.

Blink closes eye dots for 120 ms at random 2–6 second intervals; line/arc poses
do not blink. Breathing has four discrete steps, 400 ms apart, with eight seconds
at rest. There is no continuous idle animation, transition or requestAnimationFrame
loop. Walking/dragging/falling/talking loops exist only during those active states;
celebration, laughter and gestures are finite. Hide/pause/dispose clear every
adapter timer. Reduced motion disables motion loops and breath/thinking/deep-sleep
alternation; the one-time deep-sleep transition and static expressions remain.

Only painted body/head/wings/feet/tuft/beak paths have `data-duck-hit`.
Props, labels, tail and transparent canvas are click-through. Eyes and nostrils
do not steal hits from the head/beak beneath them.

### Adding extra full poses and future Rive art

Drop trusted SVGs in `assets/characters/ducky/extra/<activity>.svg` and regenerate
the static map. See `assets/characters/ducky/extra/README.md` for filenames and
part annotations. Exact activity names win, followed by aliases such as laptop
for focus and bread for bread_snack. A supplied full pose replaces both fallback
art and its prop without adapter code changes. Plain palette-colored exports
get painted hits; annotated groups enable detailed part motion. Fallback props
are separate SVG overlays using #232323 outlines, #FFC954 and #F7673B.

M7 can replace this surface at construction without renderer/business-logic
changes. Preserve the existing trigger/emotion/conversation tables below, painted
hits, completion cancellation, independent mouth/accessories and low idle work.
Map `setMotionPosition` to `dragVelocityX/Y` and a big-drop trigger internally if
Rive needs it; the optional extension can otherwise be ignored. The 320x300
artboard and bottom anchor remain the integration coordinates, not sheet units.

The automated Chromium fixture parses all poses and exercises real SVG geometry,
shared tilt pivots, gaze/mirroring, foot alternation, timer lifecycle, priorities,
sleep/drag/landing transitions, extra overrides and reduced motion. Static
preview/activity screenshots were inspected. Native desktop drag/drop acceptance
and a fresh idle CPU measurement remain for Claude.

## Expansion Phase B productivity states

The adapter `play` allowlist now includes these IDs. Renderer business logic must
continue to use CharacterSurface rather than inspect SVG internals.

| ID | Placeholder | Lifetime / priority |
| --- | --- | --- |
| `alarm` | Tiny held clock; bounded ringing wiggle | 3 seconds, then prior focus/idle pose; main turns toward the screen-centre side without walking |
| `focus` | Seated duck with a tiny laptop | Mostly static for the focus or break session; no continuous CSS loop |
| `celebrate` | Small CSS confetti burst | 1.2 seconds, with a roughly one-second burst; task completion or focus end |

Reduced motion shows static props/confetti. Alarm and celebration completion use
the existing animation-complete callback. Focus stops when its timer is stopped or
completed. Reminders may temporarily replace focus; focus resumes afterwards.
No new idle animation timer is introduced. The one-second focus countdown is a
renderer badge timer, present only for a running, unpaused focus/break session.

Authored sets live in `core/productivity/lines.ts`: seven `reminder_due` lines,
clean `task_done` variants, a separate profanity-enabled completion line, and
`focus_done` lines. They bypass the ambient model. Missed delivery prepends
“You missed this while I was asleep: …”. The stronger task-completion line is
selected only with profanity enabled; it does not broaden model profanity rules.
Desktop screenshots and reduced-motion verification: pending Claude.

## Expansion Phase A conversation layer (animator handoff)

`setConversationState(state: ConversationState | null)` is independent of `play`.
Null removes the conversation layer and resumes the underlying activity. Renderer
never inspects SVG. Art remains 320×300; the surrounding window can grow without
moving or scaling the foot anchor.

| Adapter state | Placeholder appearance / timing | Proposed Rive state / trigger |
| --- | --- | --- |
| listening | Attentive eyes, slight turn toward input; nod every four seconds | Listening / enterListening |
| thinking | Looks up; right wing scratches at head on a slow three-second cycle | Thinking / enterThinking |
| responding | Talking beak during a beat; four small wing gestures | Responding / enterResponding |
| confused | Static 14-degree head tilt | Confused / enterConfused |
| explaining | Larger shoulder gestures, finite five/six cycles | Explaining / enterExplaining |
| amused | Squinted eyes; four short body bounces | Amused / enterAmused |
| sarcastic | Half-lidded side-eye and uneven brows | Sarcastic / enterSarcastic |
| unsure | Both wings lift into a held shrug | Unsure / enterUnsure |
| interrupted | Mouth stops immediately; 300 ms lean back, listening at 350 ms | Interrupted / interruptConversation |
| conversation_end | 300 ms head reset; optional sign-off, then previous activity | ConversationEnd / endConversation |

Proposed additions to Rive `DuckyState`:

- `conversationActive` boolean enables the Conversation layer; false stops all loops.
- `conversationState` number: 0 none, 1 listening, 2 thinking, 3 responding,
  4 confused, 5 explaining, 6 amused, 7 sarcastic, 8 unsure, 9 interrupted,
  10 conversation_end. These are stable animator-facing IDs.
- Named triggers above restart discrete entrances, never on unrelated state updates.
- `speaking` boolean controls the independent Mouth layer; false on typing,
  close, final-beat completion or panel dismissal. Thinking does not move the mouth.
- `inputDirectionX/Y` numbers (-1…1) can target input in future art; placeholder
  uses an attentive tilt.
- `reducedMotion` disables loops, bounces and gesture motion, preserving readable
  static facial poses. Visibility/pause stops activity. Explicit conversations
  can listen while ambient activities are paused.

Neutral/warm tones map to responding; other validated tones map to named states.
Thinking/listening are lifecycle states. The placeholder beak speaks timed bubbles;
reading panels hold the tone pose with finite gestures. All conversation loops
cease on exit. There is no new continuous idle animation.

Shoulder fix: wings use view-box pivots (113,230) and (201,230), shared by base
rotations and pose transforms. Stretch, shrug, scratch and flapping rotate around
those anchors. No wing translation may separate shoulder and body. Validate
stretch in both directions and sizes 0.6/1.0/1.6 when supplying Rive art.

All ten states, stretch attachment and reduced-motion appearances:
**verified on desktop: pending Claude**. No Rive runtime or asset is added.

The required section-20 interface is preserved, with a completion subscription:

```typescript
interface CharacterAnimationAdapter {
  setConversationState(state: ConversationState | null): void;
  play(animation: string): void;
  setEmotion(emotion: string): void;
  setEyeTarget(x: number, y: number): void;
  setDirection(direction: 'left' | 'right'): void;
  setMovementSpeed(speed: number): void;
  setDragging(active: boolean): void;
  setSleeping(active: boolean): void;
  setVisible(visible: boolean): void;
  dispose(): void;
  onAnimationComplete(cb: (animation: string) => void): () => void;
}
```

Source of truth: `src/animation/adapter/index.ts`. Eye targets are window-local
DIP coordinates. The adapter converts them to artboard coordinates and clamps
pupils. Movement speed is a positive DIP/second magnitude; direction is separate.
Completion subscriptions return an unsubscribe function. Completion events concern
finite reactions, not every cycle of breathing/walking/talking. Hiding, pausing
or replacing a reaction cancels its pending completion. Dispose clears timers,
subscriptions and owned DOM.

`CharacterSurface` additionally defines `hitTest(x,y)`, `setReducedMotion`,
`setPaused`, `setTalking`, `setSunglasses`, and `setDebugHitbox`. These preserve the boundary for
hit shapes, accessibility, overlapping mouth animation and diagnostics. No code
outside the placeholder adapter reads or changes SVG elements. The renderer
constructs a surface and otherwise depends only on this contract.

## Animation IDs and placeholder appearances

| ID | Tier | Placeholder behaviour |
| --- | --- | --- |
| `idle` | P0 | Slow breathing from the foot anchor |
| `blink` | P0 | Briefly closed eyes; autonomous blinks every 2–6 seconds, occasional double blink |
| `look_left` | P0 | Small left head shift/tilt, continuing cursor tracking |
| `look_right` | P0 | Small right head shift/tilt |
| `walking` | P0 | Alternating feet, gentle body bob, directional mirror; speed controls cadence |
| `startled` | P0 | Short upward flinch on a single click |
| `picked_up` | P0 | Dangling body, alternating kicking feet and flapping wings |
| `falling` | P0 | Slight vertical stretch and flapping wings while main moves the window |
| `landing` | P0 | Squash then recovery; each landing restarts it |
| `sleeping` | P0 | Closed eyes and floating z letters; blink timer stopped |
| `waking_up` | P0 | Brief stretch and reopening eyes |
| `angry` | P0 | Inward eyebrows and short side-to-side shake |
| `happy` | P0 | Softened eyes and a short waddle; available to future reactions |
| `talking` | P0 | Beak opening; also an independent layer for the duration of a bubble |
| `sitting` | Minimal P1 / M1 sit-ish idle | Lower, slightly compressed static body |

The M3 table below extends these IDs. Unknown animation/emotion IDs are ignored by
the adapter and rejected at the incoming animation-completion IPC boundary.
Blinking and talking are independent layers; a talking duck can still walk or fall.
Dragging/sleep flags communicate sustained states alongside `play`.

Current emotion IDs:

| ID | Appearance |
| --- | --- |
| `neutral` | Normal eyes and relaxed face |
| `curious` | Raised eyebrows |
| `suspicious` | Uneven raised eyebrow; hover expression |
| `startled` | Neutral open face with the startled body reaction |
| `angry` | Inward tilted eyebrows |
| `happy` | Gently narrowed happy eyes |
| `sleepy` | Half-closed eyes; full sleep/nap also shows closed-eye paths |

At three single clicks within four seconds the face becomes annoyed; at five it
uses the angry animation. Double-clicks cancel pending single-click reactions.
Main state includes an animation revision so repeated discrete reactions restart
without restarting animations on unrelated cursor/settings updates.

The reduced-motion setting OR the OS preference disables bobbing, squash,
shaking, flapping and bubble pop-in. Poses, expressions, eye tracking and simple
blinks remain. Main also disables physical landing bounces under reduced motion.
Pause holds a static idle pose, stops blinking and all adapter timers. Hide stops
timers and animation activity; show resumes without creating duplicate timers.

## Proposed M7 Rive delivery contract

This is a proposal for the art team. No `.riv` asset, runtime or state machine exists yet.

- File: `assets/characters/ducky.riv`.
- Artboard: `Ducky`, logical 320 × 300, foot anchor `(160,300)`, keep all artwork within bounds.
- Primary state machine: `DuckyState`.
- Major states: `Idle`, `Walking`, `Sitting`, `Dragging`, `Falling`, `Landing`, `Sleeping`, `Talking`, `Reacting`, `PerformingActivity`.
- Independent layers: `EyeTracking`, `Blinking`, `Breathing`, `FacialExpression`, `Mouth`, `Accessories`.
- Hit shapes: artboard-owned `BodyHit`, `HeadHit`, `HatHit`, `BeakHit`, `FeetHit`, `WingsHit`; export or mirror these through the adapter's hit-test API. Transparent artboard pixels must not intercept clicks.

| Input | Type | Meaning |
| --- | --- | --- |
| `eyeX`, `eyeY` | number, -1…1 | Normalized, clamped gaze |
| `direction` | number, -1 or 1 | Left or right facing |
| `movementSpeed` | number, DIP/s | Walking cadence |
| `emotion` | number, 0…6 | Order of the emotion ID array above |
| `dragging` | boolean | Sustained picked-up state |
| `sleeping` | boolean | Sustained sleep state |
| `talking` | boolean | Independent mouth motion |
| `visible` | boolean | Adapter suspends runtime when false |
| `paused` | boolean | Static idle, no active playback |
| `reducedMotion` | boolean | Static/minimal alternatives for all active states |
| `activity` | number | Future explicit activity selector, 0 = none |

`play(id)` should map to named triggers `play_idle`, `play_blink`,
`play_look_left`, `play_look_right`, `play_walking`, `play_startled`,
`play_picked_up`, `play_falling`, `play_landing`, `play_sleeping`,
`play_waking_up`, `play_angry`, `play_happy`, `play_talking`, `play_sitting`.

Finite clips emit `complete_blink`, `complete_look_left`, `complete_look_right`,
`complete_startled`, `complete_landing`, `complete_waking_up`, `complete_angry`,
and `complete_happy`. The adapter converts these to `onAnimationComplete(id)`;
the renderer forwards the validated ID as `ANIMATION_COMPLETED`. Loop states
must not emit a completion every frame/cycle. Interruptions cancel obsolete
completion callbacks. Future activities use the same `complete_<id>` convention.

The Rive adapter must preserve hit-testing, gaze, reduced motion, independent
talking, no timers while hidden/paused and deterministic cleanup. Physics and
dialogue never access a Rive artboard or state machine directly.

## Milestone 3 activity contract

| Animation ID | Placeholder / duration | Proposed Rive trigger |
| --- | --- | --- |
| look_around | Three discrete head directions, 2.4 s | play_look_around |
| sitting | Existing compressed static pose, held 5 s | play_sitting |
| yawn | Closed eyes and open lower beak, 1.8 s | play_yawn |
| stretch | Wings raised, body extended, 1.8 s | play_stretch |
| dance | Side-to-side bob, four 0.5 s repetitions | play_dance |
| side_eye | Narrow eyes tracking cursor and slanted brows, 2 s | play_side_eye |
| nap | Static doze with z letters, 15 s; scheduler requires sleepiness > 70 | play_nap |
| strike | Static tiny ON STRIKE placard, 8 s | play_strike |
| sunglasses | Donning pose, 2 s; independent glasses accessory remains about 120 s | play_sunglasses |
| bread_snack | Tiny bread near beak, five discrete nibbles in 3.5 s | play_bread_snack |
| visitor | Smaller grey duckling enters at window's left edge, looks toward Ducky, leaves in 10 s | play_visitor |

Rive should emit `complete_<id>` for each finite clip; glasses completion means
the donning clip, not accessory removal. Add a boolean `sunglasses` input on the
Accessories layer, driven by `CharacterSurface.setSunglasses(active)`. Main owns
expiry; the renderer never inspects SVG groups or schedules behaviour. The visitor
lives in the existing 320 x 300 artboard/window. It and props are click-through,
without extra native windows or hit regions.

Main activity timeouts return to idle even if renderer completion is throttled.
Completion is informational, not authority to start events. Glasses coexist with
ordinary poses. Pause/hide/sleep, drag and fullscreen cancel active clips.
Reduced motion uses static poses and a stationary visible visitor. New CSS loops
are finite; signs, naps and glasses have no per-frame work. Idle breath remains
four discrete poses followed by eight seconds at rest.

For Claude's screenshots, quit the existing instance, build, then launch:

```powershell
npm run build
.\node_modules\.bin\electron.cmd . --debug-activity yawn
```

Repeat with each ID above. `idle`, `walk_left` and `walk_right` are also accepted
scheduler IDs; walking uses adapter ID `walking`. The request runs once after the
first non-fullscreen geometry sample and is ignored in packaged builds. There is
no settings list of Easter eggs or debug IPC. Verify clipping, reduced motion,
gaze, click-through, interruptions and expiry on desktop; unit tests do not claim
visual acceptance.
