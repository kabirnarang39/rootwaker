import { describe, it, expect } from 'vitest';
import { StoryBeatTracker, STORY_BEATS } from '../StoryBeats';

describe('StoryBeatTracker', () => {
  it('returns the real beat content the first time an id is consumed', () => {
    const tracker = new StoryBeatTracker();
    const beat = tracker.consume('bear');
    expect(beat).toEqual(STORY_BEATS.bear);
  });

  it('returns null on every subsequent consume of the same id (fires once per playthrough, not once per fight)', () => {
    const tracker = new StoryBeatTracker();
    tracker.consume('bear');
    expect(tracker.consume('bear')).toBeNull();
    expect(tracker.consume('bear')).toBeNull();
  });

  it('tracks each id independently — consuming one does not affect another', () => {
    const tracker = new StoryBeatTracker();
    expect(tracker.consume('boar')).toEqual(STORY_BEATS.boar);
    expect(tracker.consume('viper')).toEqual(STORY_BEATS.viper);
    expect(tracker.consume('boar')).toBeNull();
    expect(tracker.consume('owl')).toEqual(STORY_BEATS.owl);
  });

  it('every real story beat id has non-empty eyebrow and text content', () => {
    for (const id of Object.keys(STORY_BEATS) as Array<keyof typeof STORY_BEATS>) {
      expect(STORY_BEATS[id].eyebrow.length).toBeGreaterThan(0);
      expect(STORY_BEATS[id].text.length).toBeGreaterThan(0);
    }
  });
});
