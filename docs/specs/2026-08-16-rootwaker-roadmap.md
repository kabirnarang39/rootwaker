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

**Status: shipped 2026-08-16 — live at https://kabirnarang39.github.io/rootwaker/**

---

## Phase 7 — Global leaderboard (v2, post-launch)

**Goal:** the one thing the design spec named as "a deliberately later phase" from day one — a real global leaderboard, without repeating the networking trap that stalled Vanguard.

**Why this is the right next phase, not scope creep:** the spec explicitly reserved this — v1 shipped with zero network dependency on purpose, so the core game was never blocked on backend infra. Now that v1 is live and provably playable standalone, adding a network-dependent feature on top is safe: if the backend has problems, the game still fully works offline (`localStorage` high score stays as the fallback).

**Build:**
- `LeaderboardClient` interface, decoupled from the game loop — the death screen and HUD talk to an interface, not a concrete backend. Same reason the fox model is decoupled from the game loop: swap the implementation without touching gameplay code.
- Prototype ships against a mock/local implementation first (seeded fake entries + the player's own local runs) to prove the UX — top-10 list, player's rank if outside top 10, name entry on a new high score — before committing to real backend infra.
- Real backend is a deliberate follow-up decision, not bundled into this phase: needs an actual account (Cloudflare Workers KV, Supabase, Firebase, or similar) that I can't create on the user's behalf. Swapping the mock client for a real one is a small, isolated change once that account exists.
- Abuse-resistance from day one once real: score submission needs basic sanity bounds (distance can't exceed max possible speed × elapsed time) — client-side cheating won't be eliminated by a solo build, but obviously-impossible scores get rejected.

**Graphics gate:** the leaderboard panel matches the world's visual identity (glow/forest-myth styling, not a generic browser modal) — same rule as every other phase, UI included.

**Explicitly out of scope for this phase:** accounts/auth, anti-cheat beyond basic bounds-checking, real-time updates (poll-on-death is enough), regional leaderboards.

---

## How this differs from a generic MVP roadmap

A generic plan defers art to "polish phase 5." This one can't — the design spec makes graphics the load-bearing requirement, so every phase above ships real shaded/lit/glowing assets for exactly what exists at that point. Scope per phase is kept narrow specifically to make that affordable solo+AI; breadth is the thing that flexes, never visual quality.
