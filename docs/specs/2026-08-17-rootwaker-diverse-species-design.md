# Diverse Real Animal Species — design

Date: 2026-08-17. Roadmap item 2 of the second redesign wave (see memory `project_rootwaker.md`).

User ask, verbatim: *"It should not only be bear it should be real animals all of them different
species... There should be owls birds squirels other small animals as well. Currently there is
nothing snakes all different species of animals."*

## Goal

Four new, genuinely distinct species — **not** reskinned bears. Two are real fightable enemies that
reuse the proven `EnemyAI` + `EnemyChase.chaseTowardPlayer` + `computeStrikeRange` pursuit contract
(so they chase and land real hits, never regressing to the stationary-turret bug fixed in `9ed1214`),
each granting its own new activatable `AbilityId` on kill. Two are ambient wildlife, because that is
what those animals really are — a squirrel and a finch flock do not fight a fox, they flee it, and
faking combat for them would read as less authentic, not more.

## Real-animal research (drives the mechanics, not just the mesh)

**Owl (barn/tawny).** Hunts from a perch, not on the wing: sits still, locates prey by sound (facial
disc funnels sound to asymmetric ear openings), then drops in a near-silent glide — comb-like
leading-edge feather serrations break up the turbulence that makes other birds audible — with legs
swung forward and talons spread at the last moment. Large forward-facing eyes give binocular depth.
Barn-owl voice is not a hoot but a harsh, rasping shriek.
→ **Mechanics:** perches ~3.2m up, motionless while idle. On aggro it *descends* toward strike height
while closing horizontally, strikes with talons, and climbs back toward its perch when it loses the
player. Fastest horizontal closer in the game (5.0 m/s). Sound: rasping descending screech (filtered
noise + falling high tone), never a tonal hoot.

**Viper (pit-viper family).** Ambush predator: lies coiled and still, strikes over roughly a third of
its body length in under 100ms — the fastest attack of any animal in this roster — injects venom, and
often releases rather than holding on. Locomotion is lateral serpentine undulation, a travelling
S-wave down the body. A hiss is forced air, broadband noise with no pitch at all.
→ **Mechanics:** the shortest telegraph in the game (0.32s vs. the 0.6s default) — it is the enemy
that punishes standing still — but the shortest reach and the lowest HP. Chases at 5.5 m/s with a
visible S-wave clip down its body segments. Sound: pure bandpass noise, no oscillator.

**Squirrel.** Intermittent locomotion: dart, freeze, scan, dart again — it never flees in a straight
continuous line. Alarm behaviour is tail-flagging plus a "kuk-kuk-kuk" chatter aimed *at* the
predator, which is why a real squirrel is loud but never a threat.
→ **Mechanics:** ambient, reuses `WildlifeAI` (the grove-hare's own state machine) but flees in
burst/freeze cycles rather than the hare's constant sprint, with a tail-flick clip and a chatter cue.

**Small birds (finch flock).** Ground/low-perch foragers that flush explosively as a group when a
predator crosses their flush distance, circle, and resettle once it passes.
→ **Mechanics:** one flock entity, N birds. Perched → flushed (rise + scatter outward) → circling →
resettle when the player is far again. Contact calls are short high chirps.

## Roster

| Species | Kind | HP | Telegraph | Chase | Damage | Grants |
|---|---|---|---|---|---|---|
| Canopy Owl | enemy | 34 | 0.5s | 5.0 m/s + vertical dive | 10 | `owl-dive` |
| Vine Viper | enemy | 26 | 0.32s | 5.5 m/s | 9 | `viper-venom` |
| Grove Squirrel | ambient | — | — | flees 4.0 m/s in bursts | — | — |
| Dusk Finch flock | ambient | — | — | flush/circle/resettle | — | — |

Both enemies sit *below* the bear (65 HP, 12 dmg) — they are variety and pressure, not a difficulty
spike, and the jungle already has bears and boars as the heavy encounters.

## New powers (real activatable moves, per the standing rule)

**`owl-dive` — "Owl's Descent"** (Digit 5, 6s cooldown). The fox leaps in a real arc: a
forward+upward parabola over 0.45s using the same position-override idiom `boar-charge` already uses
(and `WindGust` used before it), then an AOE talon-strike on landing — 18 damage, 2.2m radius,
outward knockback. Distinct from `boar-charge`, which is a flat ground dash with a forward capsule.

**`viper-venom` — "Viper Venom"** (Digit 6, 9s cooldown). Envenoms every enemy within 3.5m for 6s;
each ticks 4 damage per second. The first damage-over-time in the game, and the first source of kills
that does not originate in `meleeSweep()` — which is exactly why the enemy registry below has to
exist first.

## Structural prerequisite: one enemy registry

`Game.ts` currently repeats a per-species block in four places (the `animate()` chase/damage loops,
`meleeSweep()`, `roarStagger()`, and the King's own guarded branch). Adding two species would make
that six copies in four places, and venom adds a fifth consumer with its own kill path — the exact
shape of duplication that has produced real bugs in this codebase before (a fix landing in one copy
and not its siblings).

So, before any species is added: extract a single private `enemyEntries()` on `Game` returning, for
every live enemy, `{ combatant, position, ai, onDefeat? }`. `meleeSweep()`, `roarStagger()` and the
venom tick all walk that one list; `onDefeat` carries the per-species removal + ability unlock. This
is a behaviour-preserving refactor and must be reviewed as one, with the existing suite green before
any new species lands on top of it.

## Conventions this work must not violate

- `rig.captureBasePose()` exactly once, after every `setLocalPosition` establishing the bind pose.
  Clips author positions as **offsets**, never absolutes.
- `ai.strikeRange = computeStrikeRange(combatant.hitbox.radius)` (and any phase-dependent
  `ai.telegraphSeconds`) is set **before** `ai.update()` in the same frame, never after.
- Real anatomy, no bare primitives-as-blobs: every creature gets legs or wings, a snout or beak,
  eyes, and ears/tufts where the real animal has them (see the `5b812b5` postmortem).
- All audio synthesized in `Audio.ts`, one smoke test per new method (`Audio.test.ts` pattern).
- New `JointName` members needed: `wingL`, `wingR`. Everything else reuses the existing union
  (`tail0..tail4` serves both the viper's body chain and the squirrel's bushy tail).
- Anything attached to the **fox's** rig later must be set to render layer 1 (see `createFox.ts`) —
  relevant to item 3, not this one, but noted here so it is not forgotten.

## Explicitly out of scope

Nesting/perch geometry authored per-owl (owls perch at a height above their own spawn point, not on a
specific modelled branch); enemy-vs-enemy interaction; ambient species being huntable (the hare
already fills the stealth-pounce role, and adding a second pounce target would dilute `keen-ear`
rather than add anything).
