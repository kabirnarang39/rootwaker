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

  it('applyClipToRig applies a position keyframe as an OFFSET from the captured bind pose, not an absolute overwrite (regression: every creature\'s rig was silently losing its bind-pose position the instant a clip ran)', () => {
    const rig = new Rig(['root', 'spine']);
    rig.setLocalPosition('spine', 0, 0.55, 0); // e.g. createFox.ts's real spine bind-pose offset
    rig.captureBasePose();

    const bobClip: Clip = {
      name: 'bob',
      duration: 1,
      loop: true,
      ease: linear,
      keyframes: [{ time: 0, joint: 'spine', position: [0, 0.04, 0] }],
    };
    applyClipToRig(rig, bobClip, 0);

    // base (0.55) + clip delta (0.04) = 0.59, not just the clip's raw 0.04
    expect(rig.getJoint('spine').position.y).toBeCloseTo(0.59, 5);
  });

  it('blendClips applies position keyframes as offsets from the bind pose too, in all three weight branches', () => {
    const rig = new Rig(['root', 'spine']);
    rig.setLocalPosition('spine', 0, 0.5, 0);
    rig.captureBasePose();

    const a: Clip = { name: 'a', duration: 1, loop: true, ease: linear, keyframes: [{ time: 0, joint: 'spine', position: [0, 0, 0] }] };
    const b: Clip = { name: 'b', duration: 1, loop: true, ease: linear, keyframes: [{ time: 0, joint: 'spine', position: [0, 0.1, 0] }] };

    blendClips(rig, a, 0, b, 0, 0.5); // both branch: base 0.5 + lerp(0, 0.1, 0.5)=0.05 -> 0.55
    expect(rig.getJoint('spine').position.y).toBeCloseTo(0.55, 5);

    const rigA = new Rig(['root', 'spine']);
    rigA.setLocalPosition('spine', 0, 0.5, 0);
    rigA.captureBasePose();
    const aOnly: Clip = { name: 'aOnly', duration: 1, loop: true, ease: linear, keyframes: [{ time: 0, joint: 'spine', rotation: [0, 0, 0] }] };
    blendClips(rigA, a, 0, aOnly, 0, 0.5); // sa-only branch: base 0.5 + a's 0 -> 0.5
    expect(rigA.getJoint('spine').position.y).toBeCloseTo(0.5, 5);

    const rigB = new Rig(['root', 'spine']);
    rigB.setLocalPosition('spine', 0, 0.5, 0);
    rigB.captureBasePose();
    blendClips(rigB, aOnly, 0, b, 0, 0.5); // sb-only branch: base 0.5 + b's 0.1 -> 0.6
    expect(rigB.getJoint('spine').position.y).toBeCloseTo(0.6, 5);
  });

  it('applyClipToRig silently skips a joint the rig does not have, instead of throwing (regression: a shared clip authored against the fox\'s full joint set, e.g. the eat ritual, would crash on a leaner rig like the tailless bear)', () => {
    const rig = new Rig(['root', 'head']); // deliberately no 'tail0'
    const clipWithTail: Clip = {
      name: 'has-tail-joint',
      duration: 1,
      loop: true,
      ease: linear,
      keyframes: [
        { time: 0, joint: 'head', rotation: [0, 0.4, 0] },
        { time: 0, joint: 'tail0', rotation: [0, 0.9, 0] },
      ],
    };
    expect(() => applyClipToRig(rig, clipWithTail, 0)).not.toThrow();
    expect(rig.getJoint('head').rotation.y).toBeCloseTo(0.4, 5); // the joint it DOES have still applies
  });

  it('blendClips silently skips a joint the rig does not have, instead of throwing', () => {
    const rig = new Rig(['root', 'head']); // deliberately no 'tail0'
    const a: Clip = { name: 'a', duration: 1, loop: true, ease: linear, keyframes: [{ time: 0, joint: 'tail0', rotation: [0, 0.2, 0] }] };
    const b: Clip = { name: 'b', duration: 1, loop: true, ease: linear, keyframes: [{ time: 0, joint: 'tail0', rotation: [0, 0.8, 0] }] };
    expect(() => blendClips(rig, a, 0, b, 0, 0.5)).not.toThrow();
  });
});
