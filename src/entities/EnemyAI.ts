export type AiState = 'idle' | 'aggro' | 'telegraph' | 'attacking' | 'recovering';

const AGGRO_RANGE = 4;
const TELEGRAPH_SECONDS = 0.6;
const ATTACK_SECONDS = 0.3;
const RECOVER_SECONDS = 0.8;

/**
 * idle -> aggro -> telegraph -> attacking -> recovering -> idle.
 * Telegraph is the fairness mechanic: the enemy visibly winds up before
 * the hit registers, giving the player a real dodge window.
 */
export class EnemyAI {
  state: AiState = 'idle';
  private timeInState = 0;
  private justDealtDamage = false;

  update(distanceToPlayer: number, delta: number): void {
    this.timeInState += delta;
    this.justDealtDamage = false;

    switch (this.state) {
      case 'idle':
        if (distanceToPlayer <= AGGRO_RANGE) this.enter('telegraph');
        break;
      case 'telegraph':
        if (this.timeInState >= TELEGRAPH_SECONDS) {
          this.enter('attacking');
          this.justDealtDamage = true;
        }
        break;
      case 'attacking':
        if (this.timeInState >= ATTACK_SECONDS) this.enter('recovering');
        break;
      case 'recovering':
        if (this.timeInState >= RECOVER_SECONDS) {
          this.enter(distanceToPlayer <= AGGRO_RANGE ? 'telegraph' : 'idle');
        }
        break;
      case 'aggro':
        this.enter('telegraph');
        break;
    }
  }

  shouldDealDamageThisFrame(): boolean {
    return this.justDealtDamage;
  }

  private enter(state: AiState): void {
    this.state = state;
    this.timeInState = 0;
  }
}
