import type { TrackPalette } from '../scene/createTrackSegment';

export interface Biome {
  name: string;
  minDistance: number;
  palette: TrackPalette;
  fogColor: number;
  bgColor: number;
  /** Hazard spacing divides by this — higher tiers run denser. */
  hazardDensity: number;
}

export const BIOMES: Biome[] = [
  {
    name: 'waking-glade',
    minDistance: 0,
    fogColor: 0x030509,
    bgColor: 0x030509,
    hazardDensity: 1,
    palette: {
      barkColor: 0x2c1e14,
      barkDark: 0x1a120c,
      foliageColors: [0x1f4d3a, 0x2c6b4a, 0x14392a],
      floorColor: 0x0f2318,
      pathColor: 0x1b3626,
      moteGlow: 0x8affc2,
    },
  },
  {
    name: 'ember-hollow',
    minDistance: 150,
    fogColor: 0x0a0509,
    bgColor: 0x0a0509,
    hazardDensity: 1.15,
    palette: {
      barkColor: 0x3a1a1e,
      barkDark: 0x220d10,
      foliageColors: [0x5a1f3d, 0x7a2c4a, 0x3a1428],
      floorColor: 0x230f1a,
      pathColor: 0x341527,
      moteGlow: 0xff9ad6,
    },
  },
  {
    name: 'hollow-bloom',
    minDistance: 350,
    fogColor: 0x04080c,
    bgColor: 0x04080c,
    hazardDensity: 1.3,
    palette: {
      barkColor: 0x1c2530,
      barkDark: 0x0f151c,
      foliageColors: [0x1a4a52, 0x2c6b78, 0x123842],
      floorColor: 0x0a1c22,
      pathColor: 0x123038,
      moteGlow: 0xb8e8ff,
    },
  },
  {
    name: 'root-cathedral',
    minDistance: 600,
    fogColor: 0x0a0612,
    bgColor: 0x0a0612,
    hazardDensity: 1.5,
    palette: {
      barkColor: 0x2e1a3a,
      barkDark: 0x180d20,
      foliageColors: [0x4a1f6b, 0x6b2c8a, 0x38145a],
      floorColor: 0x180a24,
      pathColor: 0x261238,
      moteGlow: 0xffd66b,
    },
  },
];

export function biomeForDistance(distance: number): Biome {
  let current = BIOMES[0];
  for (const b of BIOMES) {
    if (distance >= b.minDistance) current = b;
  }
  return current;
}
