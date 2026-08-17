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
  // Mutable, defaults to the module constant — every existing enemy (root-wraith, tusk-boar,
  // mountain-guard) constructs with `new EnemyAI()` and never touches this field, so their
  // behavior is byte-identical to before. A boss with combat phases (e.g. an enraged state
  // with a shorter reaction window) can reassign this at runtime without recreating the
  // instance mid-fight, which would otherwise reset the whole state machine mid-attack.
  telegraphSeconds = TELEGRAPH_SECONDS;
  // How close the player must actually be for a completed telegraph to launch the attack.
  // Defaults to Infinity — every enemy built before real chase movement existed never sets
  // this, so a telegraph that finishes its timer always fires regardless of distance, exactly
  // as before (byte-identical). Enemies with real pursuit (EnemyChase.ts) set this to their own
  // melee contact distance so a telegraph that finishes while still far away (aggro was only
  // just triggered, chase hasn't closed the gap yet) holds in telegraph — still visibly winding
  // up and still closing distance — instead of guaranteeing a whiff.
  strikeRange = Infinity;
  private timeInState = 0;
  private justDealtDamage = false;
  private stunTimer = 0;

  /** Freezes the state machine (no aggro/telegraph/attack progression) for `seconds` — a
   * roar/fear-style power. Never called by an enemy that doesn't grant this ability, so
   * every pre-existing enemy stays byte-identical (stunTimer never leaves 0). */
  stun(seconds: number): void {
    this.stunTimer = Math.max(this.stunTimer, seconds);
    this.enter('idle');
  }

  isStunned(): boolean {
    return this.stunTimer > 0;
  }

  update(distanceToPlayer: number, delta: number): void {
    this.justDealtDamage = false;
    if (this.stunTimer > 0) {
      this.stunTimer -= delta;
      return;
    }
    // Telegraph's own wind-up clock only advances once the player is actually within
    // strikeRange (every other state's timer advances unconditionally, same as before). Without
    // this, a fast enemy's telegraph timer keeps ticking while it's still closing distance — by
    // the time it arrives in range the timer has often already elapsed, so the attack fires on
    // the very frame contact becomes possible, with zero real wind-up visible to the player. The
    // telegraph is this game's whole fairness mechanic (see the class doc comment); a telegraph
    // that can silently complete before the enemy is even close enough to matter defeats it. For
    // any enemy still on the default strikeRange (Infinity), distanceToPlayer <= Infinity is
    // always true, so this is a no-op — byte-identical to before.
    if (this.state !== 'telegraph' || distanceToPlayer <= this.strikeRange) {
      this.timeInState += delta;
    }

    switch (this.state) {
      case 'idle':
        if (distanceToPlayer <= AGGRO_RANGE) this.enter('telegraph');
        break;
      case 'telegraph':
        if (this.timeInState >= this.telegraphSeconds && distanceToPlayer <= this.strikeRange) {
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
