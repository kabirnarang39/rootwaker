export interface FoxSkin {
  id: string;
  name: string;
  furColor: number;
  furDark: number;
  bellyColor: number;
  glowColor: number;
  glowRim: number;
}

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

export function skinById(id: string): FoxSkin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
