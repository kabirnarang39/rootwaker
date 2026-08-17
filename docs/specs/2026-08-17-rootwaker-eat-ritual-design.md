# Eat-to-Gain-Power Ritual — design

Date: 2026-08-17. Roadmap item 3 of the second redesign wave.

User ask, verbatim: *"Fox should actually eat the animals after killing them to gain the power."*

## The problem

Every ability unlock in the game today is instantaneous and invisible. A boar or bear drops to 0 HP
inside `meleeSweep()`, and on that same frame its group is removed from the scene and
`abilityKit.unlock(...)` fires. The creature does not fall, there is no body, and nothing connects
"I killed that animal" to "I now have that animal's power" except a HUD toast. The user's note is
precise: the *acquisition* has no moment.

## The beat

Between the kill and the unlock, insert a short, real, visible ritual:

1. **The fall (0.35s).** The defeated creature is no longer removed instantly. It tips over — a real
   collapse rotation on its own group — and stops animating.
2. **The feast (1.1s).** The fox turns to face the body, crouches, and lowers its head over it with
   three quick tug motions (a real fox tugging at a carcass — this is the shape of the animation,
   not a generic nuzzle). Player movement input is suspended for this window.
3. **The absorption (0.5s, overlapping the feast's tail).** Glowing essence motes lift off the body
   and stream into the fox's own chest core — which already exists and already glows
   (`createFox.ts`'s `chestCore` + `chestLight`). The body fades and sinks, then is removed.
4. **Only then** the existing `abilityKit.unlock(...)` fires, with its existing toast and chime.

Total ~1.6s. Short enough that it is a beat, not a cutscene; long enough to read.

## Design decisions

**Movement lock, not a full input lock.** During the feast the fox holds position (its move input is
zeroed) but the world keeps running: other enemies keep chasing, the wind gust keeps blowing, and
damage still lands. Eating in the middle of a fight is a real risk you take, which is more
interesting than an invulnerability window and far less code than one.

**One ritual at a time.** If a second animal dies while a ritual is running (a wide `bear-swipe`
catching two, or a venom tick landing during a feast), its unlock is queued and runs its own ritual
when the current one finishes. A queue of pending unlocks is the honest model; dropping the second
kill's ability would be a silent bug, and running two rituals at once would fight over the fox's rig.

**The King is included.** The coronation sequence currently unlocks `kings-roar` silently on the same
frame the boss dies. It gets the same ritual — the fox consumes the Elder Bear King before the crown
is revealed — which is exactly the beat the user is asking for at the game's climax. `revealCrown()`
and the arc-complete chime fire after the ritual completes, not before.

**The wraith is excluded.** It is a root-spirit, not an animal, and it grants no ability. Nothing to
eat, nothing to gain.

**The hare is included.** The stealth-pounce that grants `keen-ear` is already a kill; today it too
unlocks silently. It gets the ritual.

## Shape of the implementation

A single small state machine, `src/game/EatRitual.ts`, with no THREE dependency in its logic core so
it is genuinely unit-testable:

```ts
export type RitualPhase = 'idle' | 'falling' | 'feasting' | 'absorbing';
export class EatRitual {
  phase: RitualPhase;
  /** Queues a kill. Starts immediately if idle; otherwise runs after the current one. */
  begin(id: AbilityId | null, at: THREE.Vector3, onComplete: (id: AbilityId | null) => void): void;
  update(delta: number): void;
  isBusy(): boolean;              // Game.ts zeroes move input while true
  get bodyProgress(): number;     // 0..1 across fall+feast+absorb, drives the body's tip/sink/fade
}
```

`Game.ts` calls `ritual.begin(...)` from each `onDefeat` handler (the enemy registry added in roadmap
item 2 means there is exactly one place per species, not four), zeroes `moveInput` while
`ritual.isBusy()`, and fires the unlock from the completion callback.

The fox side is one optional parameter, not a new system: `Fox.update(time, delta, moveSpeed,
feastTime?: number)` — when `feastTime` is a number, a new `feastClip` from `foxClips.ts` is applied
instead of the idle/walk blend.

The motes are one small new class, `src/game/EssenceMotes.ts`: a handful of glowing points spawned at
the body that lerp toward a live target position (the fox's chest, which moves), fading as they
arrive. The existing `Bursts.ts` supplies the single expanding flash at the moment of absorption —
it is already written and already correct, it just has to be added to the scene (it currently is
not) and updated with `worldDz = 0`, since its `worldDz` parameter is a leftover from the retired
endless-runner build.

## Conventions this work must not violate

- **Anything added to the fox's rig must be set to render layer 1** (`obj.layers.set(1)`), matching
  the sweep at the bottom of `createFox.ts`. The first-person view hides the fox by disabling that
  layer; a mote or mesh parented to the fox and left on layer 0 would hang in the middle of the
  first-person camera. Motes that travel *toward* the fox but live in world space stay on layer 0 —
  that is correct and intentional; only things parented into the fox's own rig get layer 1.
- `captureBasePose()` / clip-offsets rule as always: `feastClip`'s position keyframes are offsets.
- New audio synthesized in `Audio.ts` with a smoke test each: a wet tearing/crunch for the feast and
  a rising shimmer for the absorption. Neither may be a re-tuned copy of `playHit()`.
