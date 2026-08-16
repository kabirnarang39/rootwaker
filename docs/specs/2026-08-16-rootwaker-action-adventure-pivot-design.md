# Rootwaker — Action-Adventure Pivot Design

**Date**: 2026-08-16
**Status**: Draft — pending user review
**Supersedes**: the endless-runner core loop in `2026-08-16-rootwaker-design.md` (premise, visual identity, and "non-negotiable graphics" rule below carry forward unchanged; core loop, structure, and success criteria are replaced by this doc)
**Scope**: multi-year project, explicitly approved at this scope by the user (2026-08-16) — not a scope creep accident.

## Why this pivot

The original spec deliberately chose endless-runner as the *smallest* genre that could carry the "myth waking" premise, specifically to avoid the trap that stalled the previous project (Vanguard — full multiplayer UE5 scope judged too large for solo+AI). The user has now explicitly asked for real climbing, real monster combat, real animations, real collected items — "not a plain walking story" — and confirmed this can be a multi-year project. That is a genre change, not a feature add: free 3D traversal and real-time combat cannot be bolted onto a 3-lane auto-runner without the runner constraints (fixed lanes, single-hit death, auto-forward pacing) actively fighting the new mechanics. This doc treats it honestly as a new core design, reusing everything from the original project that still fits.

**Calibration, stated plainly so it doesn't drift into an inflated promise later:** the target is *God of War / Zelda-lite on feel and readability*, built with hand-authored procedural animation and custom lightweight collision — not their animation pipelines, physics engines, or art team headcount. "Real" means: real hit reactions, real climb traversal, real enemy behavior, real story beats — achieved through disciplined, reused systems, not one-off spectacle per encounter.

The user has also asked for the world itself to read as a real jungle — real sky, real water, physics/nature laws respected — not just the character/combat systems. Same calibration applies: *dense, physically-grounded, believable jungle*, achievable in a real-time browser renderer (PBR materials, shader-driven water and foliage, hand-rolled Newtonian motion) — not literal photorealism, which no browser-based engine delivers in real time regardless of budget. See **Environmental realism, physics & water** below.

## What carries over unchanged

- **Premise**: fox-spirit courier, forest where an old myth/god is waking. Now a real, structured story arc instead of an ambient "distance = progress" abstraction.
- **Non-negotiable graphics rule**: every phase ships real polished visuals for what exists at that point — no placeholder boxes carried forward. This governed the runner build and governs this one identically.
- **Visual identity**: custom stylized low-poly fox-spirit (`createFox.ts`), bioluminescent glow shader (`shaders/glow.ts`), biome palette system (`biomes.ts`), bloom postprocessing pipeline (`EffectComposer` + `UnrealBloomPass`), the sky/atmosphere work from this session. All of it is reused, not rebuilt. **Deliberate split**: the fox (and enemies, built the same way) stay stylized low-poly — that's the character identity. The *environment* around them (jungle density, water, sky) pushes toward grounded realism per the new ask below. Stylized character against a physically-grounded world is an intentional contrast, not a contradiction — it's also how the visual-identity goal ("reads as distinct, not a clone") stays intact even as the world gets denser.
- **Tech stack**: Three.js + TypeScript + Vite, static single-page deploy, no backend, no external 3D model/animation files — the "everything is code" identity stays. This decision matters more now: it keeps bundle size and load time low for a game that leans on instant-play, no-install distribution.
- **"No external model" discipline**: extended, not dropped — see Procedural Rig below.

## What's replaced

The following runner-specific systems are retired (code stays in git history, not deleted destructively, but no longer wired into the live game once the new loop ships):

- `TrackManager.ts`, `createTrackSegment.ts` — infinite scrolling segment generation. Replaced by hand-built (or procedurally-assembled-once, not scrolling) level geometry.
- Lane system (`LANE_X`, `Player.changeLane`) — replaced by free-roam movement.
- `Input.ts` swipe/4-action mapping — extended into full analog directional input (see Input below), keyboard WASD + touch virtual stick, not discarded, just widened.
- `createObstacle.ts` lane/clear-rule model, `createCollectible.ts`/`createPowerUp.ts` lane-spawn logic — replaced by level-authored placement and real pickups tied to story/upgrades.
- Distance-based biome switching, distance-based scoring, `MockLeaderboardClient`/localStorage high-score chase — replaced by chapter/level progression. A "best clear time" per level is a plausible far-future addition, explicitly deferred, not designed here.

## Game structure

**Level-based, chapters, real ending.** The myth's waking is told across a fixed sequence of levels ("chapters"), each a hand-authored bounded space (not infinite, not fully open-world — a contained forest region sized for the content in it, in the vein of a Zelda dungeon-region rather than an open-world map). Each chapter:

- Has 1-3 concrete objectives (reach a location, defeat a guardian, retrieve an object) — real objectives, shown in a minimal HUD prompt, not a checklist screen.
- Escalates the "corruption" of the world visually (this is where the existing biome palette system gets reused: palette now keys off chapter, not distance).
- Ends with either a boss-tier encounter or a story beat that advances the myth, then transitions to the next chapter.

The full story has a real ending: the myth finishes waking, and what that means (the fox stops it, joins it, is too late — undecided, a narrative decision for later) resolves the arc. This replaces the old "there is no outrunning it" infinite framing with an actual finishable story, which is what "not a plain walking story" requires.

**Phase 1 scope is one chapter.** Exactly one level, one climbing sequence, one enemy archetype, the full combat loop (attack, dodge, hit reaction, death) proven end to end. This mirrors the original spec's discipline: prove the graphics *and now the feel* bar on the smallest real slice before building chapter 2. Given multi-year scope, chapter count is intentionally not fixed here — it's a roadmap decision, made after phase 1 proves the loop is fun.

## Core character controller

Free 3D movement (walk/run/jump/dodge) within the bounded level, plus two special locomotion states:

- **Climbing.** Certain surfaces are tagged climbable (a `climbable: true` flag on specific meshes — trees, root-walls, cliff faces authored into the level). On approach + input, the player transitions into a climb state: movement maps to vertical/lateral traversal along the surface, camera reorients to look up/along the climb axis, gravity is suspended until dismount (reach top, jump off, or fall if a climb-hazard hits you — real risk, not a free elevator).
- **Combat.** Entering combat (proximity to an aggroed enemy) narrows the camera slightly and enables attack/dodge inputs. Not a hard mode-lock — you can disengage by moving away, matching the "explore, then fight, then explore" rhythm of the genre this is now borrowing from.
- **Swimming.** Water bodies are a real traversal medium, not backdrop. Entering water transitions to a swim state: gravity replaced by buoyancy toward the surface, movement damped by drag, a current vector (per water body) that pushes the player, and a splash/ripple effect on entry (see Water below). Combat and climbing are unavailable while swimming; standard combat resumes back on land or a bank.

State machine: `grounded → climbing → grounded`, `grounded → swimming → grounded`, `grounded ⇄ combat`. Combat, climbing, and swimming are all interruptible by taking damage or falling. One state machine, not several independent ones, so transitions (e.g., knocked off a climb mid-fight, knocked into water) are handled centrally instead of as special cases.

## Procedural animation & rig

The fox is already built as independently-posable `THREE.Object3D`/`Group` parts (legs, tail segments, head, torso) driven by hand-coded per-frame math (`createFox.ts`'s `update()`). This is a real procedural puppet already — it's extended into a proper reusable system rather than replaced:

- **`Rig` module** (new: `src/scene/rig/Rig.ts`): a named set of joint pivots (spine, shoulders, forepaws, hindpaws, head, tail, jaw) that any procedural character (fox, and later each enemy archetype) is built from. Wraps the same `Object3D`-pivot-chain pattern the fox's tail already uses, generalized.
- **`Clip` module** (new: `src/scene/rig/Clip.ts`): a small keyframe/easing player — named clips (`walk`, `run`, `climb`, `attack-swipe`, `dodge`, `hit`, `death`) as arrays of `{ time, joint, rotation/position, ease }` keyframes, sampled per frame and applied to the `Rig`'s joints. This is a hand-rolled equivalent of an `AnimationMixer`, driving transforms directly instead of skinned bone weights — no skeleton, no imported animation format, consistent with "no external model."
- Each new creature (player fox, each enemy archetype) is a `Rig` + a small clip set. Clips are authored once per archetype and reused across every encounter of that type — this is the resourcing discipline that keeps "2-3 enemy archetypes done extremely well" actually achievable solo+AI, the same discipline the original spec applied to skins ("one character done extremely well beats three done adequately").

This is real engineering work — a keyframe/clip player with blending between states (e.g., blend `walk` → `attack-swipe` without a pop) is a non-trivial system — but it's scoped, reusable, and matches the project's established code-only identity.

## Combat system

- **Player moveset (phase 1):** light claw-swipe attack, dodge/dash (reuses the existing Spirit Dash power-up concept, now a core move not a pickup), a charged spirit-bite for a heavier hit. Kept small on purpose — three real, well-animated moves beat eight shallow ones.
- **Enemy behavior:** simple finite-state AI per archetype — idle/patrol → aggro (player in range) → telegraph (wind-up, visually readable via the existing glow-shader language, e.g. a corrupted enemy's weak point pulses before it attacks) → attack → recover. Telegraphed attacks are the core fairness mechanic (same principle as the genre benchmark: readable, dodgeable, not a damage-sponge stat check).
- **Health/damage:** simple numeric HP on player and enemies for phase 1 — no stat/leveling system (explicitly out of scope below). Death (player) restarts the current chapter checkpoint, not the whole game.
- **Collision/hit detection:** custom lightweight capsule-vs-capsule and capsule-vs-box overlap tests (new: `src/game/collision.ts`) driven off each `Rig`'s current joint transforms for attack hitboxes — no physics engine (Rapier/Cannon rejected, see Tech Notes). This is a handful of vector-math functions, not a physics simulation.

## Enemy / monster design

Tied directly to the existing "waking myth" lore, not generic fantasy filler — enemies are the forest's corruption given form, which also means their design reuses the existing glow-shader/bioluminescent visual language instead of needing a new art style:

- **Root-wraiths** (phase 1 archetype): corrupted root-tangles animated into a crawling, multi-limbed shape. Ground-based, telegraphed lunge attack. Reuses the tail-segment chain technique already built for the fox's tail — same code pattern, different creature.
- Further archetypes (canopy-stalkers, hollow-guardians, a chapter-ending "aspect of the god" boss) are named here for continuity but **not designed in this doc** — each gets its own short design pass when its chapter is actually being built, so design effort tracks build order instead of front-loading a monster bible for chapters that are years out.

## Environmental realism, physics & water

The user asked explicitly for a real jungle, real sky, real water, and for physics/nature laws to hold throughout — this raises the environmental bar alongside the combat/climbing pivot, and is treated as a first-class part of this design rather than a later art pass.

**Jungle density & realism.** Replace the runner's sparse, repeating segment-based foliage with real density: instanced foliage (one geometry, thousands of GPU instances — cheap draw-call-wise, standard technique for dense vegetation in real-time engines) for undergrowth/ferns/canopy, layered fog/light-shaft volumes for the "light through canopy" read a real jungle has, and terrain that actually varies (slopes, root-buttressed ground, riverbanks) instead of a flat lane-plane. PBR materials (already available via `MeshStandardMaterial`, in use throughout) with real roughness/normal variation instead of flat stylized color fills. The sky/atmosphere work from earlier this session (sky dome, visible moon, stars) is the foundation this sits on top of, and now matters more — a free-roam camera sees far more sky than the runner's fixed alley view ever did.

**Water.** A real water system, not a flat blue plane: shader-driven surface (Three.js's `Water` addon or a hand-rolled Gerstner-wave normal-mapped shader — consistent with the "no external model, code-driven" identity) with reflection and gentle wave motion, splash/ripple particles on entity entry, and a current that actually pushes floating objects and the swimming player (see Swimming state above). Water bodies are level-authored (a river, a flooded root-cathedral chamber) rather than a single ocean plane — keeps it purposeful rather than decorative, and keeps phase-1 scope bounded (one small water feature, not a full hydrology system).

**Physics & nature laws.** Not a full physics engine (see Tech notes' rejection of Rapier/Cannon — still holds), but real hand-rolled Newtonian behavior applied consistently:
- Constant gravity (a single `GRAVITY` constant) applied to the player, enemies, and any physics-driven props (a knocked boulder, a falling branch) — no per-system special-cased "fake" gravity like the runner's sine-wave jump arc.
- Velocity/acceleration integration (real momentum — the player doesn't stop instantly, wind-affected foliage doesn't snap back instantly) instead of the runner's pure position-tweening.
- Wind: a lightweight global wind vector driving foliage sway (vertex-shader-level, cheap) and giving water its wave direction — one shared value, two systems reading it, so the world feels like one physically consistent place instead of independently-animated pieces.
- Collision response uses real reflection/sliding math off surface normals (already partially true of the capsule overlap tests in Combat), not teleport-style snapping.

This is scoped as **hand-rolled classical mechanics**, not a simulation framework — a `physics.ts` module with gravity, integration, and basic collision response functions, reused by player, enemies, and props alike. Re-evaluate the "no physics engine" call specifically if water buoyancy + wind + prop physics together prove too fiddly to hand-roll well; that's a real go/no-go checkpoint alongside the combat-feel checkpoint in Risks below, not a foregone conclusion.

## Camera & input

- **Camera**: new `CameraRig` module — third-person follow (behind-and-above), softens/narrows on combat engage, reorients along the climb axis while climbing. Replaces the runner's fixed lane-relative camera lerp in `Game.ts`.
- **Input**: `Input.ts` widens from 4-action swipe to full directional — keyboard WASD/arrows for movement + dedicated attack/dodge/jump/interact keys (desktop), on-screen virtual joystick + action buttons (touch). The swipe gesture layer is dropped; free-roam movement doesn't map to discrete swipes.

## Tech notes

**Rejected: pulling in a physics engine (Rapier/Cannon) or a skeletal/GLTF animation pipeline.** Considered for robustness (real character controllers, real IK for climbing, real ragdoll on death) and rejected for phase 1: meaningful bundle-size and load-time cost against the instant-play distribution goal, and a real learning-curve/integration cost that isn't justified until the hand-rolled procedural approach demonstrably can't sell the feel. Revisit explicitly if phase 1's combat/climbing prototype doesn't feel good enough with the procedural rig — that's a real go/no-go checkpoint, not a rule set in stone.

**Ground/level collision**: raycast-down against the level's terrain mesh for grounding (same technique many browser 3D platformers use without a physics engine), tagged climbable meshes for climb-surface detection, custom capsule overlap for combat — all hand-rolled, all inside the existing "no external model" code style.

## Explicitly out of scope (phase 1, and likely much longer)

- Open-world / seamless traversal between chapters — chapters are discrete, loaded separately.
- RPG systems: inventory grids, skill trees, leveling, stat gear. "Collecting real things" means story-relevant pickups (a key, a relic that unlocks a chapter's ending, light-motes as a soft currency), not an itemization system.
- Branching story/choices — one linear arc for the full v1 story. Branching is a plausible future idea, not designed here.
- Multiplayer/leaderboards/accounts — unchanged from the original spec, still fully out of scope.
- More than one phase-1 enemy archetype — root-wraiths only, until the loop is proven fun.

## Success criteria

Phase 1 (first playable chapter) succeeds if: a stranger with no context, given this chapter, describes it as a real, atmospheric mini action-adventure with a genuine sense of place and a fight that feels fair and readable — not "a tech demo," not "a runner with a sword bolted on." Full-project success criteria (multi-chapter story payoff) get defined once phase 1 proves the core loop is worth building years on top of.

## Biggest risks

- **Feel risk**: procedural (non-skeletal) animation for real combat is genuinely harder to make feel good than skinned/rigged animation. Mitigation: phase 1 exists specifically to test this before any story/chapter content investment — if the fight doesn't feel good with one enemy archetype, it won't feel good with ten.
- **Scope creep risk**: this is the exact shape of risk that stalled Vanguard, now compounded by also raising the environmental-realism bar (dense jungle, real water, hand-rolled physics) in the same pivot. Mitigation: phase 1 is deliberately one level, one enemy, one climb sequence, and *one small water feature* — not a river network or full hydrology. The roadmap doc (next step after this spec) must gate chapter 2 behind phase 1 actually shipping and feeling right, not behind a fixed calendar date.
- **Physics-without-an-engine risk**: hand-rolled gravity/water/wind is fine in isolation but can get fiddly once player physics, water buoyancy, and prop physics all need to agree with each other. Mitigation: the go/no-go checkpoint in Environmental realism above — if it fights the code more than it should, revisit pulling in a physics library then, not preemptively.
