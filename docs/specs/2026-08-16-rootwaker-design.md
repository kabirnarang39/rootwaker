# Rootwaker — Design Spec

**Date**: 2026-08-16
**Status**: Approved for prototyping
**Genre**: 3D endless runner (Three.js, browser, no install)
**Benchmark**: Subway Surfers / Temple Run browser versions — matched or beaten on *feel, visual identity, and polish*, not on live-ops/monetization infra a solo build can't replicate honestly.

## Premise

You are a fox-spirit courier in a forest where old myths are waking. Every meter you run is the forest — and the reclaiming god behind it — waking further. There is no "outrunning" it permanently; the run itself IS the myth advancing. Distance = story progression, not just a number.

## Non-negotiable: graphics

This is the load-bearing requirement, not a stretch goal. Every phase in the roadmap ships real, polished visuals for what exists at that point — no placeholder gray boxes carried forward "to fix later." If a phase can't hit real visual quality for its scope, the scope shrinks; the bar never does.

Concretely, non-negotiable from the first prototype onward:
- Custom stylized low-poly fox-spirit model with a real bioluminescent glow shader (not a stock primitive).
- A living track: vines/bioluminescent triggers visibly erupting behind the player as they pass — a persistent visual trail, not a one-shot particle burst.
- Progressive biome shift every ~200m — palette, density, and hazard silhouette change, not just a speed increase.
- Real lighting: emissive glow sources, no flat/unlit materials.

## Core loop

- 3-lane track, forward auto-run.
- Input: swipe (touch) / arrow keys (desktop) to change lane, jump, slide, dash.
- Obstacles: forest hazards — roots (dodge/lane-change), boulders (jump), ravines (slide under a fallen trunk or jump a gap).
- Collectibles: light-motes (score currency, not "coins" — story-native).
- Power-ups (story-native, not generic): Spirit Dash (brief intangibility burst through one hazard), Light-Seed Magnet, Elder Root Shield (temporary invincibility).
- Death: single hit ends the run (classic genre convention) — shows distance + light-motes collected, run again.

## Progression / difficulty

- Speed ramps continuously with distance (standard genre pacing).
- Biome tiers gate new hazard types in — each tier is a real, distinct visual identity, not a recolor.
- No lives/hearts system for v1 — pure score-chase, matches the genre's actual retention mechanic (one more run).

## Tech stack

- **Three.js** — rendering, no other 3D engine.
- **TypeScript + Vite** — build tooling, fast local iteration, single-page deploy target (static hosting, no backend required to play).
- **No backend for v1.** High score stored in `localStorage`. A real global leaderboard is a deliberately later phase (see roadmap) — this is the exact trap that stalled the last project; core gameplay ships fully playable with zero network dependency.
- Mobile-first input handling (touch swipe) alongside keyboard — this is the platform the marketing plan (short-form video clips) actually gets shared on.

## Explicitly out of scope for v1

- Multiplayer / leaderboards / accounts — no networking at all in the core game.
- Character/skin selection — one character, done extremely well, beats three done adequately.
- Monetization (ads, IAP) — not part of this build's goal.
- Level editor / user-generated content.

## Success criteria

A stranger who has played Subway Surfers or Temple Run in a browser, given this game with no context, should not describe it as "a student project" or "a clone" — the visual identity and the "world reacting to you" mechanic should read as a genuinely distinct, polished thing worth a second run.
