# Rootwaker — "Grow Strong in the Jungle" Chapter Design

**Date**: 2026-08-16
**Status**: Draft — pending user review
**Supersedes**: nothing structural — this extends `2026-08-16-rootwaker-action-adventure-pivot-design.md`'s phase-1 chapter with a real hunting/ability system, inside the same jungle level already built and shipped.
**Scope**: one buildable chapter-slice of a larger, explicitly multi-saga vision (see "The larger arc" below) — deliberately NOT the whole saga at once.

## Why this chapter, why now

Across this session the user described a full saga: the fox survives and grows stronger hunting in the jungle, then climbs a mountain, defeats a boss ("king of the mountain"), and claims the trust of a mountain village — a shape like a long-running adventure series (One Piece was the named reference: recurring arcs, escalating stakes, a final arc that closes the story), built around a jungle theme, not a literal copy of that story.

That is real, multi-chapter scope. Building it all at once repeats the exact mistake that stalled this project's predecessor (Vanguard) and that this project's own design spec explicitly warns against. So this doc scopes only the first slice: **hunting and the fox's growing power**, built inside the jungle level phase 1 already shipped. The mountain, the boss, and the village-trust payoff are named here for continuity but designed later, as their own chapter, once this slice is proven fun — the same discipline that made phase 1 itself work.

## The larger arc (context only, not designed here)

1. **This chapter**: the fox survives and grows in the jungle — ambient wildlife, hunting, earned abilities.
2. **Next chapter (not designed yet)**: the mountain ascent — a real climbing challenge, harder than phase 1's one wall.
3. **Chapter after that (not designed yet)**: the boss fight — "king of the mountain" — and the story payoff: defeating it claims the village's trust, animals and villagers alike. Worldbuilding note captured for that pass: the mountain's tougher defenders are the king's guards, not random monsters — the ascent is fighting through a real chain of command up to the king, not just a gauntlet.
4. **Beyond that**: further sagas, unscoped. The user's own framing: not literally recreating any existing story, but that shape — arc, bigger arc, an arc that eventually closes the whole game.

Nothing below designs 2-4. This doc is scoped to (1) only.

## What this chapter adds

- **Ambient wildlife**: small, non-hostile animals living in the jungle (birds, rodents, deer-like grazers) that flee when approached, giving the level a sense of a living place — not just set dressing, since some of them are also huntable.
- **Hunting, two tiers**:
  - **Stealth prey** (skittish, non-aggressive animals): approach slowly/stay out of their sightline, then a real pounce action ends the hunt in one decisive beat. This is the primary, most common hunting interaction — matches how a real fox actually hunts.
  - **Tougher prey** (aggressive or larger animals): the stealth approach still matters (a good stalk grants an opening-strike advantage), but the animal fights back with a real, lighter version of the existing telegraph/dodge/attack combat loop already built for the root-wraith — reusing that system, not inventing a second one.
- **Fox abilities earned from hunting**: each huntable animal species grants a specific, thematically-tied ability the first time it's hunted (not a generic XP/skill-point currency) — e.g., a bird grants a short glide/double-jump, a boar-like animal grants a charge-dash attack. This is where "real fox powers" comes from in this design, and it's also the strategic layer requested: which earned ability suits which situation becomes a real in-combat choice against tougher enemies (including a future mountain boss).
- **Strategy layer on top of existing real-time combat**: enemies (root-wraith and the new tougher prey) have a real exploitable weakness or a terrain/positioning element, so combat rewards reading the situation, not just reflexes — built on top of the phase-1 `Combat`/`EnemyAI` telegraph system, not a replacement for it.

## What stays exactly as built in phase 1

- Real-time combat model (telegraph → dodge/attack window) — unchanged, reused for tougher hunted animals.
- `PlayerController` locomotion (grounded/climbing/swimming) — unchanged.
- The jungle level itself (terrain, trees, water, sky, climbable wall) — reused, not rebuilt. Wildlife populates the existing space.
- HUD visual language (vitality bar, objective prompt) — extended, not replaced, for a new ability/hunt-prompt element.

## Explicitly out of scope for this chapter

- The mountain, the boss, and the village-trust story payoff — next chapters, not designed here.
- A full ability roster — 2-3 real, well-animated abilities beat eight shallow ones, same discipline phase 1 applied to enemy archetypes and skins.
- Any weather/mood system (rain, wind, clouds, evening/scary tone) — a real, separate visual-system request from this same session, tracked but not designed in this doc; likely its own small design pass since it touches lighting/sky/particles broadly rather than gameplay.
- Grass/rocks as fine-grained set dressing — real, tracked, likely folded into whichever pass revisits the level's environmental density, not a gameplay system, doesn't need its own design section here.

## Open questions for the next pass (not blocking this doc, but worth naming)

- Exact huntable species roster and which ability each grants — proposed at build-plan time, not here, so design effort tracks build order (same pattern phase 1 used for future enemy archetypes).
- Whether ambient (non-huntable) wildlife exists at all, or every visible animal is potentially huntable — leaning toward "every visible animal is potentially huntable" for simplicity, confirm at build-plan time.
