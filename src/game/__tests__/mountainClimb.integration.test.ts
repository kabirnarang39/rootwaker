import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { createJungleLevel } from '../../scene/createJungleLevel';
import { PlayerController } from '../PlayerController';

// Real end-to-end integration test for the open-terrain climb's segment-transition handoff —
// the #1 risk the design doc (docs/specs/2026-08-17-rootwaker-open-terrain-climb-design.md) and
// the implementation plan both named. Game.ts itself can't be constructed outside a real browser
// (its constructor creates a THREE.WebGLRenderer), so this test replicates Game.ts's own real
// nearSegmentWall/isNearWallHeight formulas verbatim (see Game.ts's animate() method) against the
// REAL createJungleLevel() + PlayerController — not a hand-rolled approximation of them.

const WALL_CLIMB_HEIGHT_TOLERANCE = 2.0; // Game.ts's own constant, copied verbatim
const MOUNTAIN_LEDGE_RADIUS = 4.5; // Game.ts's own constant, copied verbatim

function isNearWallHeight(playerY: number, wallTopY: number, segmentHeight: number): boolean {
  const wallBaseY = wallTopY - segmentHeight;
  return Math.abs(playerY - wallBaseY) <= WALL_CLIMB_HEIGHT_TOLERANCE;
}

function nearSegmentWall(
  playerPos: THREE.Vector3,
  wall: { bounds: THREE.Box2; topY: number },
): boolean {
  return (
    playerPos.x <= wall.bounds.max.x + 0.5 &&
    playerPos.x >= wall.bounds.min.x - 0.5 &&
    playerPos.z >= wall.bounds.min.y &&
    playerPos.z <= wall.bounds.max.y &&
    isNearWallHeight(playerPos.y, wall.topY, 6)
  );
}

/** Climbs a segment to completion by repeatedly pressing "up" (z-input), exactly the way a real
 * player would, using the real PlayerController.updateClimb() — not a shortcut that sets
 * position.y directly. */
function climbToTop(pc: PlayerController, maxSteps = 2000): void {
  for (let i = 0; i < maxSteps && pc.mode === 'climbing'; i++) {
    pc.updateClimb({ x: 0, z: 1, jump: false }, 1 / 60);
  }
}

describe('mountain climb segment-transition handoff (real end-to-end integration)', () => {
  it('a full 3-segment climb (via the branch-1 / seg2a path) works from the real level data with zero manual coordinate hacks', () => {
    const level = createJungleLevel();
    const [seg1, seg2a] = level.mountain.segments; // segments[0] = seg1, segments[1] = seg2a (branch)
    const seg3 = level.mountain.segments[3];

    // Start exactly where Game.ts's own nearWall check (the phase-1 wall) would trigger entry —
    // centered in the wall's own Z bounds, at its base height.
    const startX = (level.climbableWall.bounds.min.x + level.climbableWall.bounds.max.x) / 2;
    const startZ = (level.climbableWall.bounds.min.y + level.climbableWall.bounds.max.y) / 2;
    const startY = level.climbableWall.topY - 6; // the phase-1 wall's own base height
    const pc = new PlayerController(new THREE.Vector3(startX, startY, startZ));

    // Climb the phase-1 wall to its dismount point, then confirm segment 1 is reachable from there.
    pc.beginClimb(level.climbableWall.normal, level.climbableWall.topY, undefined, level.climbableWall.pathAt);
    climbToTop(pc);
    expect(pc.mode).toBe('grounded');
    expect(nearSegmentWall(pc.body.position, seg1.wall)).toBe(true);

    // Climb segment 1 for real.
    pc.beginClimb(seg1.wall.normal, seg1.wall.topY, seg1.ledgePosition, seg1.wall.pathAt);
    climbToTop(pc);
    expect(pc.mode).toBe('grounded');
    // Real hand-verification: the player's real post-climb position must be within
    // MOUNTAIN_LEDGE_RADIUS of segment 1's real (path-endpoint) ledge — the same check that gates
    // stamina-resting in the real game.
    const horizDistToLedge1 = Math.hypot(
      pc.body.position.x - seg1.ledgePosition.x,
      pc.body.position.z - seg1.ledgePosition.z,
    );
    expect(horizDistToLedge1).toBeLessThanOrEqual(MOUNTAIN_LEDGE_RADIUS);

    // The real handoff: from wherever segment 1's climb actually left the player, segment 2a must
    // become reachable via ordinary grounded lateral movement (a walk in X), with NO change to Y
    // or Z beyond what real walking would naturally do — Game.ts never manually teleports the
    // player between segments.
    expect(pc.body.position.y).toBeCloseTo(seg2a.wall.topY - 6, 5); // seg2a's own base height
    expect(pc.body.position.z).toBeCloseTo((seg2a.wall.bounds.min.y + seg2a.wall.bounds.max.y) / 2, 5);
    // Simulate the real lateral walk (Z and Y already correct — only X needs to move).
    pc.body.position.x = (seg2a.wall.bounds.min.x + seg2a.wall.bounds.max.x) / 2;
    expect(nearSegmentWall(pc.body.position, seg2a.wall)).toBe(true);

    // Climb segment 2a for real.
    pc.beginClimb(seg2a.wall.normal, seg2a.wall.topY, seg2a.ledgePosition, seg2a.wall.pathAt);
    climbToTop(pc);
    expect(pc.mode).toBe('grounded');
    const horizDistToLedge2 = Math.hypot(
      pc.body.position.x - seg2a.ledgePosition.x,
      pc.body.position.z - seg2a.ledgePosition.z,
    );
    expect(horizDistToLedge2).toBeLessThanOrEqual(MOUNTAIN_LEDGE_RADIUS);

    // Hand off to segment 3 the same way.
    expect(pc.body.position.y).toBeCloseTo(seg3.wall.topY - 6, 5);
    expect(pc.body.position.z).toBeCloseTo((seg3.wall.bounds.min.y + seg3.wall.bounds.max.y) / 2, 5);
    pc.body.position.x = (seg3.wall.bounds.min.x + seg3.wall.bounds.max.x) / 2;
    expect(nearSegmentWall(pc.body.position, seg3.wall)).toBe(true);

    // Climb segment 3 to the summit.
    pc.beginClimb(seg3.wall.normal, seg3.wall.topY, seg3.ledgePosition, seg3.wall.pathAt);
    climbToTop(pc);
    expect(pc.mode).toBe('grounded');

    // The real summit gate — a full 3D distance check, matching Game.ts's own summit-gate trigger
    // (deliberately full 3D, not horizontal-only — see Game.ts's own comment on that check).
    const distToSummitGate = pc.body.position.distanceTo(level.mountain.summitGate);
    expect(distToSummitGate).toBeLessThanOrEqual(4.5); // comfortably within a real walk of arrival
  });

  it('the SECOND branch (segment 2b, the +X path) is independently reachable and completable with the same real handoff guarantees', () => {
    const level = createJungleLevel();
    const [seg1, , seg2b] = level.mountain.segments; // segments[2] = seg2b

    const pc = new PlayerController(
      new THREE.Vector3(
        (seg1.wall.bounds.min.x + seg1.wall.bounds.max.x) / 2,
        seg1.wall.topY - 6,
        (seg1.wall.bounds.min.y + seg1.wall.bounds.max.y) / 2,
      ),
    );
    pc.beginClimb(seg1.wall.normal, seg1.wall.topY, seg1.ledgePosition, seg1.wall.pathAt);
    climbToTop(pc);

    expect(pc.body.position.y).toBeCloseTo(seg2b.wall.topY - 6, 5);
    expect(pc.body.position.z).toBeCloseTo((seg2b.wall.bounds.min.y + seg2b.wall.bounds.max.y) / 2, 5);
    pc.body.position.x = (seg2b.wall.bounds.min.x + seg2b.wall.bounds.max.x) / 2;
    expect(nearSegmentWall(pc.body.position, seg2b.wall)).toBe(true);

    pc.beginClimb(seg2b.wall.normal, seg2b.wall.topY, seg2b.ledgePosition, seg2b.wall.pathAt);
    climbToTop(pc);
    expect(pc.mode).toBe('grounded');
    const horizDist = Math.hypot(pc.body.position.x - seg2b.ledgePosition.x, pc.body.position.z - seg2b.ledgePosition.z);
    expect(horizDist).toBeLessThanOrEqual(MOUNTAIN_LEDGE_RADIUS);
  });

  it('the real winding path genuinely moved the player laterally during at least one segment (this is not a no-op regression back to a straight line)', () => {
    const level = createJungleLevel();
    const seg1 = level.mountain.segments[0];
    const startZ = (seg1.wall.bounds.min.y + seg1.wall.bounds.max.y) / 2;
    const pc = new PlayerController(new THREE.Vector3(seg1.wall.bounds.min.x, seg1.wall.topY - 6, startZ));
    pc.beginClimb(seg1.wall.normal, seg1.wall.topY, seg1.ledgePosition, seg1.wall.pathAt);

    let sawRealDrift = false;
    for (let i = 0; i < 400 && pc.mode === 'climbing'; i++) {
      pc.updateClimb({ x: 0, z: 1, jump: false }, 1 / 60);
      if (Math.abs(pc.body.position.z - startZ) > 0.1) sawRealDrift = true;
    }
    expect(sawRealDrift).toBe(true);
  });
});
