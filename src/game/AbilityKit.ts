export type AbilityId = 'keen-ear' | 'boar-charge';

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
