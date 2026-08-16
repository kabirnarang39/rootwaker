import { describe, it, expect } from 'vitest';
import { WildlifeAI } from '../WildlifeAI';

describe('WildlifeAI', () => {
  it('starts grazing and stays grazing when the player is far away', () => {
    const ai = new WildlifeAI();
    ai.update(20, 4.5, 0.1);
    expect(ai.state).toBe('graze');
  });

  it('a fast approach at moderate range triggers alert', () => {
    const ai = new WildlifeAI();
    ai.update(6, 4.5, 0.1); // close + running speed
    expect(ai.state).toBe('alert');
  });

  it('a slow stalk lets the player get much closer before alert triggers', () => {
    const ai = new WildlifeAI();
    ai.update(6, 0.5, 0.1); // same distance, near-stationary speed
    expect(ai.state).toBe('graze');
    ai.update(2, 0.5, 0.1); // much closer, still slow
    expect(ai.state).toBe('alert');
  });

  it('alert escalates to fleeing after a short reaction delay', () => {
    const ai = new WildlifeAI();
    ai.update(6, 4.5, 0.1); // triggers alert
    expect(ai.state).toBe('alert');
    ai.update(6, 4.5, 0.5); // hold alert past the reaction window
    expect(ai.state).toBe('fleeing');
  });

  it('fleeing returns to graze once the player is far and slow again', () => {
    const ai = new WildlifeAI();
    ai.update(6, 4.5, 0.1);
    ai.update(6, 4.5, 0.5);
    expect(ai.state).toBe('fleeing');
    ai.update(20, 0, 3);
    expect(ai.state).toBe('graze');
  });
});
