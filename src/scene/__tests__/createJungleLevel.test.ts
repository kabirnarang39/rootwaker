import { describe, it, expect } from 'vitest';
import { createJungleLevel } from '../createJungleLevel';

describe('createJungleLevel', () => {
  it('exposes a queryable ground height function', () => {
    const level = createJungleLevel();
    expect(typeof level.groundHeightAt(0, 0)).toBe('number');
  });

  it('defines a climbable wall with a top height above the ground at its base', () => {
    const level = createJungleLevel();
    const groundAtWall = level.groundHeightAt(level.climbableWall.bounds.min.x, level.climbableWall.bounds.min.y);
    expect(level.climbableWall.topY).toBeGreaterThan(groundAtWall);
  });

  it('defines one water body inside the chapter bounds', () => {
    const level = createJungleLevel();
    expect(level.chapterBounds.containsBox(level.water.bounds)).toBe(true);
  });

  it('climbObstacleMeshes contains only real Meshes (no Groups), so a non-recursive raycast can actually see every entry', () => {
    const level = createJungleLevel();
    expect(level.climbObstacleMeshes.length).toBeGreaterThan(0);
    for (const obj of level.climbObstacleMeshes) {
      expect((obj as { isMesh?: boolean }).isMesh).toBe(true);
    }
  });

  it('the mountain no longer has guards (guards relocated into the jungle as Grove Bears; ledges are hazard-free rest points again)', () => {
    const level = createJungleLevel();
    expect(level.mountain).not.toHaveProperty('guards');
  });

  it('bears are placed in the jungle (not on the mountain) and the throne-room king is a real animal', () => {
    const level = createJungleLevel();
    expect(level.bears.length).toBeGreaterThan(0);
    expect(level.throneRoom.king.combatant.hp).toBe(220);
  });

  it('the throne room sits beyond the summit gate, with the king positioned further still, and the village hidden until openGate() is called', () => {
    const level = createJungleLevel();
    expect(level.throneRoom.kingSpawn.z).toBeGreaterThan(level.mountain.summitGate.z);
    expect(level.throneRoom.gateOpen).toBe(false);
    const firstVillager = level.throneRoom.villageMeshes[0];
    expect(firstVillager.visible).toBe(false);

    level.throneRoom.openGate();
    expect(level.throneRoom.gateOpen).toBe(true);
    expect(firstVillager.visible).toBe(true);
  });

  it('the throne room floor does not overlap the summit ledge it sits beyond (regression: a circular floor previously bulged sideways and overlapped the ledge\'s footprint)', () => {
    const level = createJungleLevel();
    // ledge3 (== the summit gate's own platform, from buildMountain's buildLedge call) is a
    // 4m-deep slab CENTERED on summitGate.z, so its far edge sits at summitGate.z + 2 — the
    // throne-room floor's near edge must start at or beyond that, with no overlap.
    const ledgeFarZ = level.mountain.summitGate.z + 2;
    // Box2's second axis holds world z (same convention as ClimbableWall.bounds elsewhere in
    // this file — Box2 only has x/y, so world z is stored in .y).
    expect(level.throneRoom.bounds.min.y).toBeGreaterThan(ledgeFarZ);
  });

  it('every village figure and the king spawn fall within the throne-room floor\'s bounds (regression: a circular floor previously left the farthest villager outside its own radius)', () => {
    const level = createJungleLevel();
    const { bounds, kingSpawn, villageMeshes } = level.throneRoom;
    expect(kingSpawn.x).toBeGreaterThanOrEqual(bounds.min.x);
    expect(kingSpawn.x).toBeLessThanOrEqual(bounds.max.x);
    expect(kingSpawn.z).toBeGreaterThanOrEqual(bounds.min.y);
    expect(kingSpawn.z).toBeLessThanOrEqual(bounds.max.y);
    for (const villager of villageMeshes) {
      expect(villager.position.x).toBeGreaterThanOrEqual(bounds.min.x);
      expect(villager.position.x).toBeLessThanOrEqual(bounds.max.x);
      expect(villager.position.z).toBeGreaterThanOrEqual(bounds.min.y);
      expect(villager.position.z).toBeLessThanOrEqual(bounds.max.y);
    }
  });

  it('diverse-species wildlife arrays exist and are non-empty (owls, vipers, squirrels, one finch flock)', () => {
    const level = createJungleLevel();
    expect(level.owls.length).toBeGreaterThan(0);
    expect(level.vipers.length).toBeGreaterThan(0);
    expect(level.squirrels.length).toBeGreaterThan(0);
    expect(level.finchFlock).toBeDefined();
  });

  it('every owl/viper/squirrel spawn sits inside chapterBounds and outside the water/wall exclusion', () => {
    const level = createJungleLevel();
    const outsideWater = (x: number, z: number) =>
      x < level.water.bounds.min.x || x > level.water.bounds.max.x ||
      z < level.water.bounds.min.z || z > level.water.bounds.max.z;
    const outsideWall = (x: number, z: number) =>
      x < level.climbableWall.bounds.min.x || x > level.climbableWall.bounds.max.x ||
      z < level.climbableWall.bounds.min.y || z > level.climbableWall.bounds.max.y;

    for (const owl of level.owls) {
      const { x, z } = owl.group.position;
      expect(level.chapterBounds.containsPoint(owl.group.position)).toBe(true);
      expect(outsideWater(x, z) && outsideWall(x, z)).toBe(true);
    }
    for (const viper of level.vipers) {
      const { x, z } = viper.group.position;
      expect(level.chapterBounds.containsPoint(viper.group.position)).toBe(true);
      expect(outsideWater(x, z) && outsideWall(x, z)).toBe(true);
    }
    for (const squirrel of level.squirrels) {
      const { x, z } = squirrel.position;
      expect(level.chapterBounds.containsPoint(squirrel.position)).toBe(true);
      expect(outsideWater(x, z) && outsideWall(x, z)).toBe(true);
    }
  });

  it('owls spawn above ground height, at their own perchY (a flying animal, not glued to the floor)', () => {
    const level = createJungleLevel();
    for (const owl of level.owls) {
      const ground = level.groundHeightAt(owl.group.position.x, owl.group.position.z);
      expect(owl.group.position.y).toBeGreaterThan(ground);
      expect(owl.perchY).toBeCloseTo(owl.group.position.y, 5);
    }
  });
});
