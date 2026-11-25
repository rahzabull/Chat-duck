# Character animation contract

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
