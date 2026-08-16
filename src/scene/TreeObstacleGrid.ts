export interface TreeObstacle {
  x: number;
  z: number;
  radius: number;
  height: number;
}

const DEFAULT_CELL_SIZE = 3; // meters — larger than typical query radius, keeps neighbor-cell lookup at a fixed 3x3

function cellKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/**
 * Trees never move after placement — this grid is built once at level
 * creation and queried every frame, not rebuilt.
 */
export class TreeObstacleGrid {
  private cells = new Map<string, TreeObstacle[]>();
  private cellSize: number;

  constructor(obstacles: TreeObstacle[], cellSize: number = DEFAULT_CELL_SIZE) {
    this.cellSize = cellSize;
    for (const o of obstacles) {
      const cx = Math.floor(o.x / cellSize);
      const cz = Math.floor(o.z / cellSize);
      const key = cellKey(cx, cz);
      const list = this.cells.get(key) ?? [];
      list.push(o);
      this.cells.set(key, list);
    }
  }

  nearby(x: number, z: number, radius: number): TreeObstacle[] {
    void radius; // reserved for a future variable-radius query; current 3x3-neighbor sweep already covers the default query shapes this game uses
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    const results: TreeObstacle[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const list = this.cells.get(cellKey(cx + dx, cz + dz));
        if (list) results.push(...list);
      }
    }
    return results;
  }
}
