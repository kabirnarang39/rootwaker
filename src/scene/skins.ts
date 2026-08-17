export interface CharacterSkin {
  id: string;
  name: string;
  furColor: number;
  furDark: number;
  bellyColor: number;
  glowColor: number;
  glowRim: number;
}

/** Kept as an alias, not a rename — every existing import site (HUD.ts, createFox.ts) already
 * spells it FoxSkin, and this shape is identical across species, so there is nothing to migrate. */
export type FoxSkin = CharacterSkin;

export const SKINS: FoxSkin[] = [
  {
    id: 'ember',
    name: 'Ember Fox',
    furColor: 0xd9622b,
    furDark: 0x7a3418,
    bellyColor: 0xf2ead2,
    glowColor: 0x5ff7ff,
    glowRim: 0xbfffef,
  },
  {
    id: 'moonlit',
    name: 'Moonlit Fox',
    furColor: 0x8a9bb0,
    furDark: 0x445164,
    bellyColor: 0xe4edf5,
    glowColor: 0x9dd4ff,
    glowRim: 0xe6f4ff,
  },
  {
    id: 'bloodmoon',
    name: 'Bloodmoon Fox',
    furColor: 0x6b1f2e,
    furDark: 0x350f16,
    bellyColor: 0xd9a9a0,
    glowColor: 0xff6ba8,
    glowRim: 0xffd1e8,
  },
];

export const BEAR_SKINS: CharacterSkin[] = [
  {
    id: 'loam',
    name: 'Loam Bear',
    furColor: 0x5a4530,
    furDark: 0x3a2c1c,
    bellyColor: 0x8a7256,
    glowColor: 0xffb84d,
    glowRim: 0xffe0b0,
  },
  {
    id: 'ash',
    name: 'Ash Bear',
    furColor: 0x4a4640,
    furDark: 0x2a2622,
    bellyColor: 0x6e6a62,
    glowColor: 0x9dd4ff,
    glowRim: 0xdff0ff,
  },
];

export const VIPER_SKINS: CharacterSkin[] = [
  {
    id: 'vine',
    name: 'Vine Viper',
    furColor: 0x224a26,
    furDark: 0x0e150e,
    bellyColor: 0xc9c07a,
    glowColor: 0xd8ff4a,
    glowRim: 0xeaffb0,
  },
  {
    id: 'ember-scale',
    name: 'Ember-scale Viper',
    furColor: 0x7a2e1f,
    furDark: 0x3d160f,
    bellyColor: 0xd9a45a,
    glowColor: 0xff8a4d,
    glowRim: 0xffd2b0,
  },
];

export function skinById(id: string): FoxSkin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
