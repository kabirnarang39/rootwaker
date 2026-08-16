export type AbilityId = 'keen-ear' | 'boar-charge' | 'bear-swipe' | 'kings-roar';

export interface Ability {
  id: AbilityId;
  name: string;
  description: string;
  cooldownSeconds: number;
  key: string; // keybind hint shown in the HUD power bar
}

export const ABILITIES: Record<AbilityId, Ability> = {
  'keen-ear': {
    id: 'keen-ear',
    name: 'Keen Ear',
    description: 'Hear hidden prey through the undergrowth, the way a real fox triangulates by sound.',
    cooldownSeconds: 8,
    key: '1',
  },
  'boar-charge': {
    id: 'boar-charge',
    name: "Boar's Charge",
    description: 'A low, driving charge-dash, learned from the tusk-boar itself.',
    cooldownSeconds: 4,
    key: '2',
  },
  'bear-swipe': {
    id: 'bear-swipe',
    name: 'Bear Swipe',
    description: "A heavier claw strike, learned from the Grove Bear's own weight and reach.",
    cooldownSeconds: 3,
    key: '3',
  },
  'kings-roar': {
    id: 'kings-roar',
    name: "King's Roar",
    description: 'A commanding roar, earned from the Elder Bear King — nearby foes falter at its sound.',
    cooldownSeconds: 10,
    key: '4',
  },
};

// Fixed HUD/keybind order — Digit1..Digit4 map to this array by index.
export const ABILITY_SLOTS: AbilityId[] = ['keen-ear', 'boar-charge', 'bear-swipe', 'kings-roar'];

export class AbilityKit {
  private unlocked = new Set<AbilityId>();
  private pendingReport: AbilityId | null = null;
  private readyAt = new Map<AbilityId, number>();

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

  /** Seconds until `id` is off cooldown; 0 if it's ready right now. */
  cooldownRemaining(id: AbilityId, now: number): number {
    const ready = this.readyAt.get(id) ?? 0;
    return Math.max(0, ready - now);
  }

  /** True and starts the cooldown if `id` is unlocked and off cooldown; false (no side effect) otherwise. */
  activate(id: AbilityId, now: number): boolean {
    if (!this.has(id) || this.cooldownRemaining(id, now) > 0) return false;
    this.readyAt.set(id, now + ABILITIES[id].cooldownSeconds);
    return true;
  }
}
