export type AbilityId = 'keen-ear' | 'boar-charge' | 'bear-swipe' | 'kings-roar';

export interface Ability {
  id: AbilityId;
  name: string;
  description: string;
}

export const ABILITIES: Record<AbilityId, Ability> = {
  'keen-ear': {
    id: 'keen-ear',
    name: 'Keen Ear',
    description: 'Hear hidden prey through the undergrowth, the way a real fox triangulates by sound.',
  },
  'boar-charge': {
    id: 'boar-charge',
    name: "Boar's Charge",
    description: 'A low, driving charge-dash, learned from the tusk-boar itself.',
  },
  'bear-swipe': {
    id: 'bear-swipe',
    name: 'Bear Swipe',
    description: "A heavier claw strike, learned from the Grove Bear's own weight and reach.",
  },
  'kings-roar': {
    id: 'kings-roar',
    name: "King's Roar",
    description: 'A commanding roar, earned from the Elder Bear King — nearby foes falter at its sound.',
  },
};

export class AbilityKit {
  private unlocked = new Set<AbilityId>();
  private pendingReport: AbilityId | null = null;

  unlock(id: AbilityId): void {
    if (this.unlocked.has(id)) return;
    this.unlocked.add(id);
    this.pendingReport = id;
  }

  has(id: AbilityId): boolean {
    return this.unlocked.has(id);
  }

  unlockedThisFrame(): Ability | null {
    if (!this.pendingReport) return null;
    const ability = ABILITIES[this.pendingReport];
    this.pendingReport = null;
    return ability;
  }
}
