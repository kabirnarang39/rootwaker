# Rootwaker — "The Ascent" Mountain-Climb Chapter Design

**Date**: 2026-08-16
**Status**: Draft — pending user review
**Supersedes**: nothing structural — extends `docs/specs/2026-08-16-rootwaker-action-adventure-pivot-design.md`'s climbing locomotion and `docs/specs/2026-08-16-rootwaker-hunting-chapter-design.md`'s "larger arc" context.
**Scope**: one buildable chapter-slice of the larger saga (mountain → boss → village-trust) — this doc covers ONLY the ascent itself, ending at the mountain's summit gate. The boss fight and village-trust payoff are named for continuity but deliberately not designed here — their own chapter, once the climb is proven fun, same discipline as every prior chapter in this project.

## Why this chapter, why this scope

The saga vision (captured in the hunting-chapter doc's "larger arc" section) names: jungle growth → mountain climb → boss fight → village trust. This doc designs the mountain climb only. Two reasons to stop there rather than design the whole arc at once:

1. **The climb itself is a real, non-trivial system.** Phase 1 shipped exactly one climbable wall — a single continuous ascent with no risk, no obstacles, no encounters. "A real mountain climb, harder than phase 1's one wall" (the user's own framing) means real climbing challenges: multiple linked segments, stamina, hazards, and guard encounters along the way — not a taller version of the same trivial mechanic. That's enough scope for one chapter.
2. **The boss fight and village-trust payoff depend on how the climb feels.** Same reasoning phase 1 used for the root-wraith and chapter 2 used for hunting: prove the new mechanic (real climbing risk/stamina) before building the content that sits on top of it (a boss encounter, a story resolution).

## What this chapter adds

- **A real mountain, not one wall.** The climb is a sequence of linked segments — climbable rock faces connected by ledges (rest points) — spanning real vertical distance. Route has at least one branch (two viable paths up a given segment, differing in difficulty/risk), so the ascent reads as a real mountain, not a corridor.
- **Stamina, the core new risk.** Climbing drains a stamina resource in real time (extends `PlayerController`'s existing `updateClimb` — currently unlimited, no risk). Resting on a ledge recovers stamina. Running out mid-climb causes the fox to lose its grip and fall to the last-reached ledge (not a full checkpoint reset — a real setback, not a punishing restart) with a real fall-impact animation/sound, not a teleport. This is the literal mechanical answer to "real climbing challenges."
- **Environmental hazards during the climb.** At least one hazard type tied to the mountain's own identity (not reused jungle content) — a real wind-gust event that pushes the fox laterally during a climb (testing route-holding, not just patience), telegraphed visually/audibly before it hits, matching this project's established "telegraphed, fair" combat/hazard philosophy.
- **Guard encounters on the ledges.** The "king's guards" (named in the hunting-chapter doc's worldbuilding note) appear as a new enemy archetype stationed at rest-ledges — reusing `EnemyAI`'s telegraph/combat pattern (same proven system as the root-wraith and tusk-boar), but visually and thematically distinct: armored/rock-hewn guardians, not jungle creatures. A ledge encounter must be resolved (or bypassed via stealth, reusing the hunting chapter's stalk mechanics where a guard can be avoided by staying out of its detection range) before continuing the climb from that ledge.
- **A mountain-specific atmosphere.** Not the full deferred weather system (rain/clouds/storm-mood — still out of scope), but the mountain's own real identity: thinner, colder-toned lighting/fog distinct from the jungle's palette, real wind-sound layered into the ambience (extends chapter 2's layered-ambience `AudioFX` pattern with a mountain-specific wind layer), bare rock/scree terrain instead of jungle foliage.
- **The summit gate.** The chapter's ending: reaching a real, visually distinct threshold — a gate or entrance into the mountain kingdom — with a clear "you've arrived, the next chapter begins here" beat. No boss fight yet; this is the doorstep, not the throne room.

## What stays exactly as built

- `PlayerController`'s climbing locomotion state (`beginClimb`/`updateClimb`) — extended with stamina, not replaced.
- `EnemyAI`'s telegraph/combat pattern — reused directly for guards, same as root-wraith/tusk-boar.
- The stealth/detection math from chapter 2 (`Stalking.ts`, `WildlifeAI`-style alert logic) — reused for the option to bypass a guard rather than fight it, since "strategy layer" (the user's own confirmed combat framing) includes choosing when NOT to fight.
- `AudioFX`'s synthesized, no-external-files sound identity — extended with a wind layer, not replaced.
- HUD's established glow-panel visual language — extended with a stamina meter (parallel to the existing vitality bar, not a new UI style).

## Explicitly out of scope for this chapter

- The boss fight ("king of the mountain") and the village-trust story payoff — next chapter, not designed here.
- The full weather/mood system (rain, storm clouds, dynamic time-of-day) — the mountain's own atmosphere here is real but bounded (fog/lighting/wind-sound), not a general weather engine.
- A third earned fox ability from this chapter — 2-3 abilities total was the phase-2 target; whether the mountain grants a new one (e.g., a climbing-specific ability from surviving a guard encounter) is a build-time decision, not designed here, matching the "design effort tracks build order" discipline already established for future enemy archetypes.
- Multiple alternate summit routes beyond the one branch point named above — one real branch is enough to prove the "real mountain, not a corridor" bar; more routes are a future revisit, not this chapter's job.

## Success criteria

A player who's completed the jungle chapters, given this ascent with no further context, should describe it as a real climb with real stakes — remembering a specific moment (a stamina-drain scare, a wind gust, a guard fight or a successful stealth bypass) rather than "I held W and reached the top." Reaching the summit gate should feel like arriving somewhere, not finishing a corridor.
