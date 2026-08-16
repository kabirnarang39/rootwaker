import * as THREE from 'three';

/**
 * Bioluminescent glow: emissive core color plus a view-angle Fresnel rim
 * that brightens toward silhouette edges. Pulses gently over time so the
 * fox-spirit reads as alive, not lit.
 */
export interface GlowUniforms {
  [key: string]: THREE.IUniform;
  uTime: THREE.IUniform<number>;
  uColor: THREE.IUniform<THREE.Color>;
  uRimColor: THREE.IUniform<THREE.Color>;
  uIntensity: THREE.IUniform<number>;
  uPulseSpeed: THREE.IUniform<number>;
  uFresnelPower: THREE.IUniform<number>;
}

export function createGlowMaterial(options: {
  color?: THREE.ColorRepresentation;
  rimColor?: THREE.ColorRepresentation;
  intensity?: number;
  pulseSpeed?: number;
  fresnelPower?: number;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
}): THREE.ShaderMaterial {
  const uniforms: GlowUniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(options.color ?? 0x6ff2ff) },
    uRimColor: { value: new THREE.Color(options.rimColor ?? 0x9dffe8) },
    uIntensity: { value: options.intensity ?? 1.4 },
    uPulseSpeed: { value: options.pulseSpeed ?? 1.6 },
    uFresnelPower: { value: options.fresnelPower ?? 2.2 },
  };

  return new THREE.ShaderMaterial({
    uniforms,
    transparent: options.transparent ?? true,
    depthWrite: false,
    side: options.side ?? THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vec4 viewPos = viewMatrix * worldPos;
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-viewPos.xyz);
        gl_Position = projectionMatrix * viewPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uRimColor;
      uniform float uIntensity;
      uniform float uPulseSpeed;
      uniform float uFresnelPower;

      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        float fresnel = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0), uFresnelPower);
        float pulse = 0.75 + 0.25 * sin(uTime * uPulseSpeed);
        vec3 core = uColor * uIntensity * pulse;
        vec3 rim = uRimColor * fresnel * uIntensity * 1.6;
        gl_FragColor = vec4(core * 0.35 + rim, clamp(fresnel * 1.2 + 0.25, 0.0, 1.0) * pulse);
      }
    `,
    opacity: options.opacity ?? 1,
  });
}
