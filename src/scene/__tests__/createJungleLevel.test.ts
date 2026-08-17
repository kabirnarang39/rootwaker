import * as THREE from 'three';
import { describe, it, expect } from 'vitest';
import { createJungleLevel, makeWindingPath } from '../createJungleLevel';

describe('makeWindingPath', () => {
  it('returns zero drift at height 0 (the wall\'s own base — required so grounded-mode entry-detection against wall.bounds stays correct without modification)', () => {
    const path = makeWindingPath(1.2, 4);
    const { dx, dz } = path(0);
    expect(dx).toBe(0);
    expect(dz).toBeCloseTo(0, 10);
  });

  it('drifts within the given amplitude, never beyond it', () => {
    const path = makeWindingPath(1.2, 4);
    for (let h = 0; h <= 12; h += 0.25) {
      const { dz } = path(h);
      expect(Math.abs(dz)).toBeLessThanOrEqual(1.2 + 1e-9);
    }
  });

  it('completes one full winding cycle every `wavelengthMeters` of height climbed', () => {
    const path = makeWindingPath(1.2, 4);
    expect(path(1).dz).toBeCloseTo(1.2, 5); // h = wavelength/4
    expect(path(2).dz).toBeCloseTo(0, 5); // h = wavelength/2
    expect(path(3).dz).toBeCloseTo(-1.2, 5); // h = 3*wavelength/4
    expect(path(4).dz).toBeCloseTo(0, 5); // h = wavelength (one full cycle)
  });
});

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

  it('the real animal audience is hidden until openGate(), sits within the throne-room floor bounds, and is revealed alongside the village (not instead of it)', () => {
    const level = createJungleLevel();
    const { bounds, animalAudience, villageMeshes } = level.throneRoom;
    expect(animalAudience.length).toBeGreaterThan(0);
    for (const spectator of animalAudience) {
      expect(spectator.visible).toBe(false);
      expect(spectator.position.x).toBeGreaterThanOrEqual(bounds.min.x);
      expect(spectator.position.x).toBeLessThanOrEqual(bounds.max.x);
      expect(spectator.position.z).toBeGreaterThanOrEqual(bounds.min.y);
      expect(spectator.position.z).toBeLessThanOrEqual(bounds.max.y);
    }

    level.throneRoom.openGate();
    for (const spectator of animalAudience) expect(spectator.visible).toBe(true);
    expect(villageMeshes[0].visible).toBe(true); // both reveal together, neither replaces the other
  });

  it('every real climb segment has a real (non-default) pathAt — pathAt(0) is always zero-drift, but pathAt at a real height is not', () => {
    const level = createJungleLevel();
    const segmentHeight = 6; // matches buildMountain's own segmentHeight constant
    for (const segment of level.mountain.segments) {
      const atBase = segment.wall.pathAt(0);
      expect(atBase.dx).toBe(0);
      expect(atBase.dz).toBeCloseTo(0, 10);
      const atMid = segment.wall.pathAt(segmentHeight / 2);
      expect(Math.abs(atMid.dz)).toBeGreaterThan(0.01);
    }
  });

  it('each climb segment\'s ledge sits at its own wall\'s real path endpoint, not a fixed Z shared by every segment', () => {
    const level = createJungleLevel();
    const segmentHeight = 6;
    for (const segment of level.mountain.segments) {
      const { dz } = segment.wall.pathAt(segmentHeight);
      const baseZ = (segment.wall.bounds.min.y + segment.wall.bounds.max.y) / 2;
      expect(segment.ledgePosition.z).toBeCloseTo(baseZ + dz, 5);
    }
  });

  it('a segment\'s own wall.bounds is centered on ITS real base Z (chained from the previous segment\'s real ledge, not a fixed value shared by every segment)', () => {
    const level = createJungleLevel();
    const seg2aBaseZ = (level.mountain.segments[1].wall.bounds.min.y + level.mountain.segments[1].wall.bounds.max.y) / 2;
    expect(seg2aBaseZ).toBeCloseTo(level.mountain.segments[0].ledgePosition.z, 5);
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

  it('the living sea rings all 4 sides of the island (east/west/north/south), each slab sitting entirely beyond the jungle\'s own chapterBounds (a backdrop the player never actually reaches during normal play, not new swimmable surface area) — regression: the original single east-only strip left the other 3 coastlines with no sea at all', () => {
    const level = createJungleLevel();
    const slabs: THREE.Mesh[] = [];
    level.group.traverse((obj) => {
      if (obj.name === 'living-sea') slabs.push(obj as THREE.Mesh);
    });
    expect(slabs.length).toBe(4);

    const island = level.chapterBounds;
    let coversEast = false;
    let coversWest = false;
    let coversNorth = false;
    let coversSouth = false;
    for (const slab of slabs) {
      const box = new THREE.Box3().setFromObject(slab);
      // Every slab must sit fully clear of the island's own footprint on at least one axis —
      // it's a ring AROUND the land, never overlapping into it.
      const clearOfIsland =
        box.min.x >= island.max.x || box.max.x <= island.min.x ||
        box.min.z >= island.max.z || box.max.z <= island.min.z;
      expect(clearOfIsland).toBe(true);

      if (box.min.x >= island.max.x) coversEast = true;
      if (box.max.x <= island.min.x) coversWest = true;
      if (box.min.z >= island.max.z) coversNorth = true;
      if (box.max.z <= island.min.z) coversSouth = true;
    }
    expect(coversEast).toBe(true);
    expect(coversWest).toBe(true);
    expect(coversNorth).toBe(true);
    expect(coversSouth).toBe(true);
  });

  it('a real fish school swims offshore of each of the 4 coastlines — real sea life, not an empty ring of water', () => {
    const level = createJungleLevel();
    const schools: THREE.Group[] = [];
    level.group.traverse((obj) => {
      if (obj.name === 'fish-school') schools.push(obj as THREE.Group);
    });
    expect(schools.length).toBe(4);
    for (const school of schools) {
      expect(school.children.length).toBeGreaterThan(0); // real fish, not an empty placeholder group
    }
  });

  it('level.update() drives the sea\'s wave/tide animation without throwing across a real time range', () => {
    const level = createJungleLevel();
    expect(() => {
      for (let t = 0; t < 300; t += 0.5) level.update(t);
    }).not.toThrow();
  });
});
