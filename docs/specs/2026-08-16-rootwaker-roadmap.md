# Rootwaker — Phased Roadmap

**Date**: 2026-08-16
**Status**: Active
**Calibration**: Subway Surfers/Temple Run browser-version *feel, visual identity, polish* — solo+AI achievable. Not their live-ops, monetization infra, or studio art pipeline (dozens of artists, years of asset libraries). Every phase below states honestly what that means for scope.

Graphics is a **gate**, not a milestone at the end of a phase. A phase is not "done" until its graphics bar is met — if it can't be met, the phase's functional scope shrinks, not the bar.

---

## Phase 0 — Prototype (proves the bar is real)

**Goal:** one living, glowing scene exists and looks like the target, before any more code gets written.

**Build:**
- Vite + TypeScript + Three.js scaffold, single-page.
- Custom stylized low-poly fox-spirit model (hand-built geometry or sculpted via primitives/extrusion — not a stock GLTF sample), rigged for basic run pose.
- Bioluminescent glow shader on the fox (emissive core + Fresnel rim glow via custom `ShaderMaterial`, bloom post-processing pass).
- One track segment: forest floor, tree walls either side, procedural-ready module boundary.
- Real lighting: emissive glow sources + ambient/hemisphere fill, no flat MeshBasicMaterial placeholders.

**Graphics gate:** fox glow + bloom + lit forest segment must look intentional in a static screenshot — this is the visual identity the whole game rides on. If it looks like a tech demo, phase isn't done.

**Explicitly not here yet:** running, input, obstacles, collectibles, scoring. Pure visual proof.

---

## Phase 1 — Core loop, one biome

**Goal:** the game is playable start-to-death, in one fully polished biome.

**Build:**
- 3-lane forward auto-run, speed ramps with distance.
- Input: swipe (touch) + arrow keys (desktop), lane-change/jump/slide/dash.
- Obstacles: roots (dodge), boulders (jump), ravines (slide/jump gap) — modeled and shaded to the Phase 0 bar, not boxes.
- Light-motes (collectible) with glow/attract-on-near feel.
- Procedural segment spawning/recycling from the Phase 0 module.
- Death → distance + light-motes readout, restart.

**Graphics gate:** every obstacle and collectible on screen matches the fox's polish level — a run through this biome should look finished, not "gameplay in, art later."

---

## Phase 2 — Living track + power-ups

**Goal:** the world visibly reacts to the player — the spec's core differentiator.

**Build:**
- Living-track system: vines/glow triggers erupt from the ground in the fox's wake as a persistent trail (shader-driven growth, not a one-shot particle burst) — despawns behind camera range.
- Power-ups, story-native: Spirit Dash (intangibility burst + trail VFX), Light-Seed Magnet (attract radius + visual field), Elder Root Shield (temporary invincibility + shell VFX).
- Second biome unlocked by distance, palette/density/hazard-silhouette swap (not a recolor).

**Graphics gate:** the wake trail must read clearly at running speed (not just in a paused screenshot) — this is the one mechanic a short-form clip has to sell in under 2 seconds.

---

## Phase 3 — Progression + full biome set

**Goal:** the full run arc exists, each biome tier a distinct visual identity.

**Build:**
- 3–4 total biomes gating in new hazard types, tiered by distance.
- Difficulty ramp tuned (speed curve, hazard density curve) against the biome pacing.
- No lives/hearts — pure score-chase per spec.

**Graphics gate:** each biome transition itself must be a visual beat (a few seconds of transformation, not an instant palette swap) — this is the "myth waking" premise made visible.

---

## Phase 4 — Game feel / juice pass

**Goal:** the moment-to-moment feel matches genre benchmarks, not just the wide shots.

**Build:**
- Camera: run-speed FOV push, landing/hit shake, lane-change lean.
- Particle/VFX polish on every hit/collect/death event.
- Audio: footfalls, whoosh, collect chime, ambient forest bed, biome-transition sting.
- UI: main menu, HUD (distance/light-motes/power-up state), death screen — styled to match the world, not default browser UI.

**Graphics gate:** a 10-second clip from any random point in a run should be clip-shareable without narration — this phase exists specifically to earn that.

---

## Phase 5 — Performance + mobile polish

**Goal:** it runs well on the actual devices the marketing plan targets (mobile browsers via short-form video traffic).

**Build:**
- LOD / draw-call budget pass, texture atlasing, instance-mesh the track modules.
- Mobile touch-input latency and hitbox tuning (Phase 1 keyboard-first assumptions get re-tested on touch).
- Load-time budget (single-page, static hosting) — asset compression, first-paint target.

**Graphics gate:** the mobile build must hit the SAME visual bar as desktop at a stable frame rate — graphics never get stripped down for mobile as a shortcut; the scope (draw distance, particle count) tunes instead.

---

## Phase 6 — Ship

**Goal:** launch-ready static build, high score persisted locally, ready for the short-form clip marketing push.

**Build:**
- `localStorage` high score, no backend.
- Static hosting deploy (single-page).
- Final QA pass across the success criterion: a stranger who's played Subway Surfers/Temple Run shouldn't call this "a student project" or "a clone."

**Explicitly deferred beyond v1 (per design spec):** multiplayer/leaderboards/accounts, character selection, monetization, level editor/UGC.

---

## How this differs from a generic MVP roadmap

A generic plan defers art to "polish phase 5." This one can't — the design spec makes graphics the load-bearing requirement, so every phase above ships real shaded/lit/glowing assets for exactly what exists at that point. Scope per phase is kept narrow specifically to make that affordable solo+AI; breadth is the thing that flexes, never visual quality.
