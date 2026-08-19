import * as THREE from 'three';

export type AttireStyle = 'formal-collar' | 'informal-cord' | 'ceremonial-beads' | 'none';

// A real crowd doesn't read as "diverse" if every spectator is a bare wild-form clone — but a
// fitted garment (a shirt, a sash draped over a shoulder) needs per-species tailoring to look
// right on a body plan as different as a legless viper vs. a bulky bear vs. a perched owl. A
// collar/torque sitting at the neck is the one accessory shape that reads correctly on ANY body
// plan without bespoke tailoring — it's just a ring around wherever the "neck" narrows, whether
// that's a quadruped's throat, a snake's own head-to-body taper, or a bird's collar line. Three
// real, distinct looks stand in for "formal vs. informal vs. ceremonial", the honest buildable
// version of "different attires" for a flat-shaded low-poly animal cast, not literal human
// garment categories that don't translate onto animal anatomy in this art style.
const ATTIRE_LOOK: Record<Exclude<AttireStyle, 'none'>, { color: number; roughness: number; metalness: number }> = {
  'formal-collar': { color: 0xc9973a, roughness: 0.35, metalness: 0.6 }, // gold court torque
  'informal-cord': { color: 0x6b5030, roughness: 0.9, metalness: 0 }, // plain rope cord
  'ceremonial-beads': { color: 0x3a5a78, roughness: 0.5, metalness: 0.2 }, // indigo beaded drape
};

/** Adds a real neck collar/cord to `group` (a static background figure, not an animated rig — see
 * createJungleLevel.ts's coronation audience) sized off the group's own bounding box, so it scales
 * correctly regardless of species without per-species tuning. Call BEFORE positioning the group
 * into the scene — the bounding box must be measured in the group's own local space. */
export function applyAttire(group: THREE.Object3D, style: AttireStyle): void {
  if (style === 'none') return;
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const look = ATTIRE_LOOK[style];
  const mat = new THREE.MeshStandardMaterial({ color: look.color, flatShading: true, roughness: look.roughness, metalness: look.metalness });
  const radius = Math.max(size.x, size.z) * 0.32;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(radius, Math.max(radius * 0.16, 0.008), 8, 16), mat);
  collar.rotation.x = Math.PI / 2;
  collar.position.set(0, box.min.y + size.y * 0.62, size.z * 0.08);
  collar.name = `attire-${style}`;
  group.add(collar);
}
