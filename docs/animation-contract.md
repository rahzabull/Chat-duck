# Character animation contract

The required section-20 interface is preserved, with a completion subscription:

```typescript
interface CharacterAnimationAdapter {
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
`setPaused`, `setTalking`, and `setDebugHitbox`. These preserve the boundary for
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

These are all current animation IDs. Unknown animation/emotion IDs are ignored by
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
| `sleepy` | Reserved expression identifier; closed eyes are controlled by sleeping state |

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
