# Roadmap

A real audit of gaps and limitations, what's fixed, and what's deliberately deferred (with why).
Last updated 2026-08-18.

## Fixed in this pass

- **No README/LICENSE/package.json metadata** — added `README.md`, MIT `LICENSE`, and
  `description`/`repository`/`homepage`/`license` fields in `package.json`.
- **No `<meta description>`/Open Graph tags** — added to `index.html` for the public deploy.
- **Confirmed-dead endless-runner code** — `TrackManager.ts`, `Player.ts` (distinct from the real
  `PlayerController.ts`), `WakeTrail.ts`, `biomes.ts`, `Bursts.ts`, `constants.ts`,
  `createTrackSegment.ts`, `createObstacle.ts`, `createPowerUp.ts`, `createCollectible.ts` — a
  pre-pivot cluster (tracks/obstacles/power-ups) fully superseded by the current jungle-level
  system, confirmed via import-graph analysis to have zero live references. Deleted.
- **No WebGL context-loss handling** — a GPU driver reset or too many open 3D tabs used to leave
  the game silently frozen on a black canvas. Now shows a real "graphics connection lost, reload"
  message and stops the dead render loop instead of spinning it.
- **Oversized single JS bundle** — the duel system (challenge gate, WebRTC session, chat, voice)
  is now dynamically imported only when a player actually presses `M`, instead of shipping in
  every session's initial bundle. Split ~14kB of rarely-used code out of the main chunk.
- **Leaderboard was local-only** — rebuilt as a real distributed CRDT (gossip-synced over
  `trystero`'s serverless WebRTC matchmaking), encrypted locally per device. See the commit
  `a4324e7` message for the full design. Live-verified across two real browser sessions.
- **No chat/voice during duels** — added, scoped 1:1 to the two duel participants, riding the
  same WebRTC connection the duel itself already opens.

## Deliberately deferred (real gaps, not silently dropped)

- **No touch/mobile input** — `Input.ts` is keyboard+mouse only; the existing `isTouchPrimary`
  check only adjusts render quality, never wires actual touch controls. A touch-primary device
  cannot move or act at all. This deserves its own design pass (on-screen stick/buttons, a
  genuinely different interaction model), not a quick patch — scoped as its own future item.
- **P2P discovery ceiling** — the distributed leaderboard's gossip mesh is a real full-mesh
  WebRTC topology, which scales to roughly 20-50 concurrent peers before per-peer bandwidth
  degrades. Fine for a niche game's realistic concurrent player count; sharding by room/region is
  the future upgrade if that ceiling is ever actually hit.
- **`createPlayableBear.ts`/`createPlayableViper.ts` mesh naming** — the enemy versions of these
  species have every anatomy part named (fixed in an earlier pass, commit `2cf6d9c`); the
  player-controlled variants still don't. Lower priority since the player never sees their own
  model read as "a shapeless rock" the way an approaching enemy would.
- **No TURN relay server** — WebRTC connections between two players behind symmetric NATs can
  fail with no fallback. A TURN server would itself be backend infrastructure this project
  deliberately doesn't run; documented as an accepted, honest limitation of pure P2P.

## In progress / next

- **Combat depth round 3** — real KO/finishing moves beyond the existing finisher-stagger, full
  combat sound design (impacts/roars/KOs), hunting-encounter sound design, ability/power sounds.
- **Enterprise-readiness hardening** — an ongoing pass testing realistic combinations of systems
  together (species × abilities × weather × multiplayer, edge cases in each) and fixing whatever
  gaps that surfaces.
