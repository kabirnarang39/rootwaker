import { describe, it, expect } from 'vitest';
import { Rig } from '../Rig';
import { sampleClip, applyClipToRig, blendClips, linear, type Clip } from '../Clip';

const simpleClip: Clip = {
  name: 'test-swing',
  duration: 1,
  loop: true,
  ease: linear,
  keyframes: [
    { time: 0, joint: 'head', rotation: [0, 0, 0] },
    { time: 0.5, joint: 'head', rotation: [0, Math.PI, 0] },
    { time: 1, joint: 'head', rotation: [0, 0, 0] },
  ],
};

describe('Clip', () => {
  it('sampleClip interpolates linearly between surrounding keyframes', () => {
    const sample = sampleClip(simpleClip, 0.25);
    const head = sample.get('head');
    expect(head?.rotation?.[1]).toBeCloseTo(Math.PI / 2, 5);
  });

  it('sampleClip wraps time for looping clips', () => {
    const sample = sampleClip(simpleClip, 1.25); // same as 0.25
    expect(sample.get('head')?.rotation?.[1]).toBeCloseTo(Math.PI / 2, 5);
  });

  it('applyClipToRig writes the sampled rotation onto the rig joint', () => {
    const rig = new Rig(['root', 'head']);
    applyClipToRig(rig, simpleClip, 0.5);
    expect(rig.getJoint('head').rotation.y).toBeCloseTo(Math.PI, 5);
  });

  it('blendClips mixes two clips by weight', () => {
    const rig = new Rig(['root', 'head']);
    const still: Clip = { name: 'still', duration: 1, loop: true, ease: linear, keyframes: [{ time: 0, joint: 'head', rotation: [0, 0, 0] }] };
    blendClips(rig, still, 0, simpleClip, 0.5, 0.5);
    // still contributes 0, simpleClip contributes PI at t=0.5 -> blended halfway = PI/2
    expect(rig.getJoint('head').rotation.y).toBeCloseTo(Math.PI / 2, 5);
  });
});
