import * as THREE from 'three';

export function createSky(): THREE.Group {
  const group = new THREE.Group();

  const domeGeo = new THREE.SphereGeometry(48, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uTopColor: { value: new THREE.Color(0x0a1830) },
      uBottomColor: { value: new THREE.Color(0x1a2e4a) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTopColor;
      uniform vec3 uBottomColor;
      varying vec3 vWorldPos;
      void main() {
        float h = clamp(normalize(vWorldPos).y, 0.0, 1.0);
        gl_FragColor = vec4(mix(uBottomColor, uTopColor, h), 1.0);
      }
    `,
  });
  group.add(new THREE.Mesh(domeGeo, domeMat));

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xd8e6ff }),
  );
  moon.position.set(-14, 20, 10);
  group.add(moon);

  const starGeo = new THREE.BufferGeometry();
  const STAR_COUNT = 600;
  const starPositions = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const radius = 47;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.5;
    starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * Math.cos(phi);
    starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, sizeAttenuation: true }));
  group.add(stars);

  return group;
}
