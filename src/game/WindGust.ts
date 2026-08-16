import * as THREE from 'three';

export type GustState = 'calm' | 'telegraph' | 'gusting';

const CALM_SECONDS = 4;
const TELEGRAPH_SECONDS = 1.2; // a real, generous warning window — climbing hazards must be fair
const GUST_SECONDS = 0.8;
const GUST_FORCE = 3.5; // m/s of lateral push while gusting

/**
 * calm -> telegraph -> gusting -> calm, looping. The telegraph window is
 * long enough that a player mid-climb has real time to brace/reposition —
 * same fairness principle as EnemyAI's combat telegraph, independently
 * implemented since this isn't a combat AI.
 */
export class WindGust {
  state: GustState = 'calm';
  private timeInState = 0;
  private direction = new THREE.Vector3(1, 0, 0.3).normalize();

  update(delta: number): void {
    this.timeInState += delta;
    switch (this.state) {
      case 'calm':
        if (this.timeInState >= CALM_SECONDS) this.enter('telegraph');
        break;
      case 'telegraph':
        if (this.timeInState >= TELEGRAPH_SECONDS) this.enter('gusting');
        break;
      case 'gusting':
        if (this.timeInState >= GUST_SECONDS) this.enter('calm');
        break;
    }
  }

  forceVector(): THREE.Vector3 {
    if (this.state !== 'gusting') return new THREE.Vector3(0, 0, 0);
    return this.direction.clone().multiplyScalar(GUST_FORCE);
  }

  private enter(state: GustState): void {
    this.state = state;
    this.timeInState = 0;
  }
}
