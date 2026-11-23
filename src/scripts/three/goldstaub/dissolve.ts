// Auflösen und Entstehen der massiven Objekte.
// Partikel und Objekte benutzen dieselbe Funktion gdFront(): Sie sagt für jeden Punkt einer Form,
// wie früh er sich auflöst (0 = zuerst, 1 = zuletzt). So verschwindet ein Stück Oberfläche genau
// in dem Moment, in dem sein Goldstaub davonfliegt.
import * as THREE from 'three';

export const GD_GLSL = /* glsl */ `
  float gdHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float gdNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(gdHash(i), gdHash(i + vec3(1, 0, 0)), f.x), mix(gdHash(i + vec3(0, 1, 0)), gdHash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(gdHash(i + vec3(0, 0, 1)), gdHash(i + vec3(1, 0, 1)), f.x), mix(gdHash(i + vec3(0, 1, 1)), gdHash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
  // von oben nach unten, mit etwas Rauschen, damit die Kante lebendig ausfranst
  float gdFront(vec3 p, vec3 bmin, vec3 bsize) {
    vec3 q = (p - bmin) / bsize;
    return clamp(0.55 * (1.0 - q.y) + 0.33 * gdNoise(p * 2.2) + 0.12 * gdNoise(p * 7.0), 0.0, 1.0);
  }
`;

export interface DissolveUniforms {
  [name: string]: THREE.IUniform;
  /** Welt → Koordinaten der Form */
  uRootInv: { value: THREE.Matrix4 };
  uBoxMin: { value: THREE.Vector3 };
  uBoxSize: { value: THREE.Vector3 };
  /** alles mit gdFront < uHide ist schon aufgelöst */
  uHide: { value: number };
  /** alles mit gdFront > uShow ist noch nicht entstanden */
  uShow: { value: number };
  uGlow: { value: THREE.Color };
}

export function dissolveUniforms(): DissolveUniforms {
  return {
    uRootInv: { value: new THREE.Matrix4() },
    uBoxMin: { value: new THREE.Vector3(-1, -1, -1) },
    uBoxSize: { value: new THREE.Vector3(2, 2, 2) },
    uHide: { value: -1 },
    uShow: { value: 2 },
    uGlow: { value: new THREE.Color(0xffb84a) },
  };
}

export const DISSOLVE_VERTEX_PARS = /* glsl */ `uniform mat4 uRootInv;\nvarying vec3 vGdPos;`;
export const DISSOLVE_FRAGMENT_PARS = /* glsl */ `${GD_GLSL}
  uniform vec3 uBoxMin; uniform vec3 uBoxSize; uniform float uHide; uniform float uShow; uniform vec3 uGlow;
  varying vec3 vGdPos;`;
/** verwirft aufgelöste Stellen; gdEdge = 1 direkt an der Kante (für die Glut) */
export const DISSOLVE_FRAGMENT_TEST = /* glsl */ `
  float gdF = gdFront(vGdPos, uBoxMin, uBoxSize);
  if (gdF < uHide || gdF > uShow) discard;
  float gdEdge = max(1.0 - smoothstep(0.0, 0.05, gdF - uHide), 1.0 - smoothstep(0.0, 0.05, uShow - gdF));`;

/** Alle Standard-Materialien unter `root` so erweitern, dass sie sich mit den Uniforms auflösen lassen. */
export function makeDissolvable(root: THREE.Object3D, u: DissolveUniforms) {
  const seen = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (seen.has(mat) || (mat as THREE.ShaderMaterial).isShaderMaterial) continue;
      seen.add(mat);
      mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, u);
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>\n${DISSOLVE_VERTEX_PARS}`)
          .replace('#include <project_vertex>', '#include <project_vertex>\nvGdPos = (uRootInv * modelMatrix * vec4(transformed, 1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\n${DISSOLVE_FRAGMENT_PARS}`)
          .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${DISSOLVE_FRAGMENT_TEST}`)
          .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uGlow * gdEdge * 2.4;');
      };
      mat.customProgramCacheKey = () => 'gd-dissolve';
      mat.needsUpdate = true;
    }
  });
}
