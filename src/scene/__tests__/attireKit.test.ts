import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyAttire } from '../attireKit';

function bodyGroup(width: number, height: number, depth: number): THREE.Group {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth));
  mesh.position.y = height / 2; // feet at y=0, same convention every real species rig uses
  group.add(mesh);
  return group;
}

describe('applyAttire', () => {
  it('style "none" adds nothing', () => {
    const group = bodyGroup(0.5, 0.6, 1);
    applyAttire(group, 'none');
    expect(group.children.length).toBe(1);
  });

  it('a real style adds one collar mesh, named after the style', () => {
    const group = bodyGroup(0.5, 0.6, 1);
    applyAttire(group, 'formal-collar');
    expect(group.children.length).toBe(2);
    expect(group.children.some((c) => c.name === 'attire-formal-collar')).toBe(true);
  });

  it('each real style has its own distinct color — a formal collar and a plain cord must not read as the same thing', () => {
    const a = bodyGroup(0.5, 0.6, 1);
    applyAttire(a, 'formal-collar');
    const b = bodyGroup(0.5, 0.6, 1);
    applyAttire(b, 'informal-cord');
    const colorOf = (g: THREE.Group) => ((g.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHex();
    expect(colorOf(a)).not.toBe(colorOf(b));
  });

  it('the collar radius scales with the body — a real audience shouldn\'t wear one fixed-size necklace regardless of species', () => {
    const small = bodyGroup(0.3, 0.3, 0.5);
    applyAttire(small, 'formal-collar');
    const big = bodyGroup(1.2, 1.2, 2);
    applyAttire(big, 'formal-collar');
    const radiusOf = (g: THREE.Group) => ((g.children[1] as THREE.Mesh).geometry as THREE.TorusGeometry).parameters.radius;
    expect(radiusOf(big)).toBeGreaterThan(radiusOf(small));
  });

  it('never throws on an empty group (no mesh geometry to measure)', () => {
    const group = new THREE.Group();
    expect(() => applyAttire(group, 'ceremonial-beads')).not.toThrow();
  });
});
