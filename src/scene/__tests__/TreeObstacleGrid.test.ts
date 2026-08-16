import { describe, it, expect } from 'vitest';
import { TreeObstacleGrid, type TreeObstacle } from '../TreeObstacleGrid';

describe('TreeObstacleGrid', () => {
  const obstacles: TreeObstacle[] = [
    { x: 0, z: 0, radius: 0.1, height: 2 },
    { x: 5, z: 5, radius: 0.1, height: 2 },
    { x: -18, z: 18, radius: 0.1, height: 2 },
  ];

  it('nearby() returns obstacles close to the query point', () => {
    const grid = new TreeObstacleGrid(obstacles, 3);
    const results = grid.nearby(0.2, 0.2, 1);
    expect(results.some((o) => o.x === 0 && o.z === 0)).toBe(true);
  });

  it('nearby() excludes obstacles far from the query point', () => {
    const grid = new TreeObstacleGrid(obstacles, 3);
    const results = grid.nearby(0, 0, 1);
    expect(results.some((o) => o.x === -18 && o.z === 18)).toBe(false);
  });

  it('nearby() finds obstacles across a cell boundary (neighbor-cell lookup)', () => {
    // cellSize=3: point (2.9, 0) and obstacle (3.1, 0) sit in adjacent cells but are 0.2m apart
    const grid = new TreeObstacleGrid([{ x: 3.1, z: 0, radius: 0.1, height: 2 }], 3);
    const results = grid.nearby(2.9, 0, 1);
    expect(results.length).toBe(1);
  });

  it('handles an empty obstacle list without throwing', () => {
    const grid = new TreeObstacleGrid([], 3);
    expect(grid.nearby(0, 0, 5)).toEqual([]);
  });
});
