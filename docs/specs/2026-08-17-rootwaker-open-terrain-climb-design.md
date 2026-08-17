# Rootwaker — Open-Terrain Mountain Climb Design

**Date**: 2026-08-17
**Status**: Draft — design-only, not yet planned or implemented
**Supersedes**: nothing structural — extends `docs/specs/2026-08-16-rootwaker-mountain-ascent-chapter-design.md` (the stamina/ledge/wind-gust/branch system it designed is kept intact; this doc only replaces the flat-wall-segment terrain those systems climb along) and follows the same real-rock-face visual work already shipped this session (`buildRockFaceMesh`, commit `82595ba`).
**Scope**: replace the climb's underlying terrain representation only. The stamina system, ledge rest points, wind-gust hazard, and the segment-2 branch choice are explicitly kept as-is — this is a geometry/path change, not a new mechanic.

## Why this exists

The user's original ask ("reach the mountain by climbing it not the wall") had two parts. The visual half — the climb reading as a smooth man-made box rather than real rock — shipped this session (`buildRockFaceMesh`, real jagged chunks replacing flat `BoxGeometry`). The second half is still open: even with real rock-face *visuals*, the climb's actual *path* is still a perfectly straight vertical line up a flat plane (`ClimbableWall.bounds`/`topY`/`normal` describe one infinite flat surface; `updateClimb()` moves the player straight up it). A real mountain has no perfectly flat, perfectly vertical faces at this scale — a genuine climb winds, angles, and follows the rock's own contours.

This was deliberately deferred rather than attempted inline, for a concrete reason: it is the single highest-risk remaining item in the whole roadmap. It touches `PlayerController.ts`'s climbing state machine, the stamina drain/regen loop, ledge-rest proximity checks, the wind-gust hazard's force application, and Game.ts's `groundHeightWithLedges`/camera-obstacle-avoidance geometry — five already-proven, already-tested systems at once. This project's own history is blunt about that risk category: the throne-room chapter found 2 Critical bugs in far simpler floor-bounds geometry, and the camera work found 12 real bugs across 6 review rounds. A rewrite this size deserves its own brainstorm → spec → plan → SDD cycle, not an inline change under session-end time pressure — the same discipline this project has followed for every prior chapter-scale addition.

## What this adds

- **A real climb path, not a flat plane.** Each `ClimbableWall` gains a real horizontal drift as height increases — the path the player's paws actually follow winds left/right (and could, in a later iteration, vary in overhang/depth) as they ascend, instead of holding a single fixed X. Concretely: widen `ClimbableWall` with a `pathAt(heightAboveBase: number): { x: number; z: number }` function (or a small ordered list of control points the caller interpolates) that returns the real X/Z offset at a given climbed height, replacing the current single fixed `bounds`/`normal` pair for movement purposes. `bounds`/`topY` stay for entry-detection (the grounded-mode proximity check that triggers `beginClimb` in the first place) — only the *in-climb* movement math changes.
- **`updateClimb()` follows the path, not a straight line.** Instead of `position.x += input.x * CLIMB_SPEED * delta * 0.5` (free lateral shuffle) plus `position.y += input.z * CLIMB_SPEED * delta` (pure vertical), the player's height still advances from `input.z` exactly as today (preserves the proven stamina-drain-per-second-of-climbing feel), but X/Z are driven by the wall's `pathAt(height)` function plus a bounded player-steerable offset (the existing manual shuffle, now added on top of the path's own natural drift rather than being the only source of horizontal movement) — so climbing without touching lateral input still follows a winding route, and the player can still nudge left/right within a real corridor around that route (matching segment 2's existing branch-choice design, which becomes two different `pathAt` functions instead of two different fixed X values).
- **Rock-face geometry matches the path.** `buildRockFaceMesh`'s chunk placement is regenerated to bulge/recede along the same path the player follows (protrusions the player's route visually threads between, not a random scatter unrelated to where the player actually goes) — what you see should be what you climb.
- **Ledges anchor at the path's real endpoint.** `buildLedge` calls move to wherever the path's `pathAt(height)` lands at each segment boundary, not a hand-picked fixed X — removing the current implicit assumption that every segment/ledge shares one X-invariant column.

## What stays exactly as built

- The climbing **locomotion mode** itself (`beginClimb`/`updateClimb`, distinct from `grounded`) — not eliminated, not merged into open-world sloped walking. Climbing keeps feeling deliberately different/effortful, exactly as the original mountain-ascent design intended.
- **Stamina** (`STAMINA_DRAIN_PER_SECOND`/`STAMINA_REGEN_PER_SECOND`, the fall-to-last-ledge-on-empty behavior) — untouched. Height still advances the same way from `input.z`; only what X/Z do in response changes.
- **Ledge rest points and their proximity-radius check** (`MOUNTAIN_LEDGE_RADIUS`) — untouched in mechanism, just re-anchored to real path endpoints instead of fixed coordinates.
- **The wind-gust hazard** (`WindGust.ts`, `forceVector()` pushed into `body.position` during climbing) — untouched; a lateral force is still a lateral force regardless of what the "neutral" path shape is.
- **The segment-2 branch choice** — kept, reframed as two distinct paths rather than two fixed X offsets.
- **Guards relocated to the jungle** (the animal-guardians-redesign decision) — not revisited; this doc is purely about the climb's terrain shape.
- **The summit gate, throne room, rock-face visual style, and ceremony/audience work already shipped** — untouched.

## Explicitly out of scope for this pass

- **Eliminating climbing mode in favor of walking up a sloped terrain mesh with normal grounded movement.** This was the other candidate design (a true open-world mountain you just walk up, no separate mode) and was rejected for this pass: it would remove the stamina/ledge/wind-gust system's entire reason to exist (those mechanics only make sense as a distinct, risk-bearing climbing state) and would require rebuilding gravity/ground-snapping/jump behavior for steep slopes from scratch — a far larger and riskier rewrite than winding an existing path. If a genuinely open free-climb (no discrete mode at all) is still wanted after this pass ships, it is its own future decision, not folded in here.
- **Overhangs, real 3D climbing surfaces (moving *into* the rock face, not just along it), or a jump/dyno mechanic.** The path stays a 2D (height, lateral-offset) curve — real winding, not true 3D free-climbing.
- **New hazards or guard encounters tied to the new path shape.** No new content, only a terrain-shape change to existing content.
- **Re-tuning stamina numbers, ledge radii, or wind-gust force** to "fit" the new path better — if the existing numbers turn out not to fit once this is built and playtested, that's a finding from implementation, not a pre-decided part of this design.

## Real risk this design specifically must hand-verify at implementation time

Per this project's own established discipline for geometry work (never trust plausible-sounding reasoning, always hand-trace the actual numbers):

- **Segment-transition detection.** Game.ts's `nearSegmentWall` check (in the `grounded`-mode block, gating `beginClimb`) tests player X/Z against a segment's `wall.bounds` — a fixed Box2. If a path's drift moves the *player's actual climbing position* outside the footprint that same segment's `bounds` describes, the transition-detection math and the movement-along-path math would disagree about where the segment "is." The implementer must verify, with real numbers, that every point the path visits stays within (or that `bounds` is redefined to describe) the same segment's own footprint.
- **Camera obstacle-avoidance raycasting** (`climbObstacleMeshes`, used by hawkEye's overhead sightline and follow/closeUp's obstacle pull-in) reads real Mesh geometry. If the rock-face mesh's chunk placement is regenerated per-path, the camera-avoidance behavior tuned during the hawk-eye/fox-eye plan (6 review rounds, 12 bugs) must be re-verified against the new geometry, not assumed unaffected.
- **`groundHeightWithLedges`'s ledge candidate-floor logic** — already fragile once before (a Critical bug where the throne room's own floor-candidate check lacked an altitude guard). Re-anchoring ledges to path endpoints changes their real-world coordinates; the same class of "does this candidate floor apply at every altitude, or only near its own ledge" bug must be actively checked for, not assumed safe by analogy.

## Success criteria

A player climbing the mountain should be able to describe the route they took — "I went left around that outcrop, then had to cut right near the top" — the same way a real climber describes a real route, rather than "I held W." Reaching a ledge should feel like arriving at a specific spot on a specific rock face, not an interchangeable checkpoint. The stamina/wind-gust/branch-choice tension already proven in the original mountain-ascent chapter should feel unchanged — a player who played before this change and after it should say the climb feels the same in stakes, more real in shape.
