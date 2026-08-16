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

  it('sampleClip clamps to first keyframe when t is before all keyframes', () => {
    const partialClip: Clip = {
      name: 'partial',
      duration: 1,
      loop: false,
      ease: linear,
      keyframes: [
        { time: 0.3, joint: 'head', rotation: [0, Math.PI / 2, 0] },
        { time: 0.6, joint: 'head', rotation: [0, Math.PI, 0] },
      ],
    };
    const sample = sampleClip(partialClip, 0.1); // before first keyframe
    expect(sample.get('head')?.rotation).toEqual([0, Math.PI / 2, 0]); // should hold first keyframe
  });

  it('sampleClip clamps to last keyframe when t is after all keyframes', () => {
    const partialClip: Clip = {
      name: 'partial',
      duration: 1,
      loop: false,
      ease: linear,
      keyframes: [
        { time: 0.3, joint: 'head', rotation: [0, Math.PI / 2, 0] },
        { time: 0.6, joint: 'head', rotation: [0, Math.PI, 0] },
      ],
    };
    const sample = sampleClip(partialClip, 0.9); // after last keyframe
    expect(sample.get('head')?.rotation).toEqual([0, Math.PI, 0]); // should hold last keyframe
  });

  it('sampleClip holds rotation channel when only prev has rotation', () => {
    const mixedClip: Clip = {
      name: 'mixed',
      duration: 1,
      loop: false,
      ease: linear,
      keyframes: [
        { time: 0.2, joint: 'spine', rotation: [0, 0.5, 0] }, // only rotation
        { time: 0.8, joint: 'spine', position: [1, 2, 3] }, // only position
      ],
    };
    const sample = sampleClip(mixedClip, 0.5); // between keyframes
    expect(sample.get('spine')?.rotation).toEqual([0, 0.5, 0]); // should hold prev's rotation
    expect(sample.get('spine')?.position).toEqual([1, 2, 3]); // should hold next's position
  });
});
