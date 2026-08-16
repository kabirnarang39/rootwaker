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

  it('climbObstacleMeshes excludes the mountain guards (regression: a defeated guard removed from the scene would otherwise block camera sightlines forever, since this list is a one-time snapshot never kept in sync with guard removal)', () => {
    const level = createJungleLevel();
    const guardObjects = new Set<unknown>();
    for (const guard of level.mountain.guards) {
      guard.group.traverse((obj) => guardObjects.add(obj));
    }
    for (const obj of level.climbObstacleMeshes) {
      expect(guardObjects.has(obj)).toBe(false);
    }
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
});
