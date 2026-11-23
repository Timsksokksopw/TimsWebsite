// Der Goldstaub: eine Punktwolke, die von Form A zu Form B fliegt.
// Der Weg jedes Partikels hängt nur vom Fortschritt uMorph ab (nicht von der Zeit),
// deshalb läuft beim Zurückscrollen alles exakt rückwärts.
import * as THREE from 'three';
import { GD_GLSL } from './dissolve';
import type { PointSet } from './sampling';

const VERT = /* glsl */ `
  attribute vec4 aFrom;
  attribute vec4 aTo;
  attribute vec4 aSeed;
  uniform float uMorph;
  uniform float uTime;
  uniform mat4 uFromM;
  uniform mat4 uToM;
  uniform vec3 uFromMin; uniform vec3 uFromSize;
  uniform vec3 uToMin; uniform vec3 uToSize;
  uniform float uFromDust;
  uniform float uToDust;
  uniform float uSize;
  uniform float uProj;
  uniform float uScale;
  varying float vShade;
  varying float vAlpha;
  varying float vSeed;
  ${GD_GLSL}

  void main() {
    // jedes Partikel startet, wenn seine Stelle sich auflöst, und landet, wenn das Ziel dort entsteht
    float tS = 0.42 * gdFront(aFrom.xyz, uFromMin, uFromSize);
    float tE = 0.58 + 0.42 * gdFront(aTo.xyz, uToMin, uToSize);
    float p = clamp((uMorph - tS) / max(0.001, tE - tS), 0.0, 1.0);
    float e = p * p * (3.0 - 2.0 * p);
    float s = sin(3.14159265 * p);

    vec3 A = (uFromM * vec4(aFrom.xyz, 1.0)).xyz;
    vec3 B = (uToM * vec4(aTo.xyz, 1.0)).xyz;
    vec3 c = mix(uFromM[3].xyz, uToM[3].xyz, e);
    vec3 r = mix(A, B, e) - c;

    // unterwegs: Wirbel um die Hochachse, auffächern, etwas Unruhe
    float ang = s * (1.5 + 1.7 * aSeed.z);
    float ca = cos(ang);
    float sa = sin(ang);
    r.xz = mat2(ca, -sa, sa, ca) * r.xz;
    r *= 1.0 + s * (0.35 + 0.75 * aSeed.w);
    vec3 q = (c + r) * 0.7 + aSeed.xyz * 7.0 + p * 1.5;
    vec3 wob = vec3(gdNoise(q), gdNoise(q + 3.1), gdNoise(q + 5.7)) - 0.5;
    vec3 P = c + r + wob * s * 1.2 * uScale;
    // in Ruhe ein kaum sichtbares Atmen
    P += (aSeed.xyz - 0.5) * 0.02 * uScale * sin(uTime * 0.9 + aSeed.w * 40.0) * (1.0 - s);

    vec4 mv = viewMatrix * vec4(P, 1.0);
    gl_Position = projectionMatrix * mv;

    float a = smoothstep(tS - 0.03, tS, uMorph);
    float b = smoothstep(tE, tE + 0.03, uMorph);
    vAlpha = (mix(uFromDust, 1.0, a) * (1.0 - b) + uToDust * b) * (1.0 - 0.5 * s);
    vShade = mix(aFrom.w, aTo.w, e);
    vSeed = aSeed.x;
    gl_PointSize = uSize * uScale * (0.55 + 0.9 * aSeed.y) * (0.7 + 0.45 * vShade) * (1.0 + 0.2 * s) * uProj / -mv.z;
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uGoldDeep;
  uniform vec3 uGoldHi;
  varying float vShade;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    if (vAlpha < 0.004) discard;
    float d = length(gl_PointCoord - 0.5);
    float disc = smoothstep(0.5, 0.1, d);
    float twinkle = 0.78 + 0.55 * pow(0.5 + 0.5 * sin(uTime * (1.5 + vSeed * 4.0) + vSeed * 90.0), 8.0);
    vec3 col = mix(uGoldDeep, uGoldHi, clamp(vShade, 0.0, 1.0)) * twinkle * (0.55 + 0.6 * vShade);
    gl_FragColor = vec4(col, disc * vAlpha * uIntensity);
  }
`;

export class Dust {
  points: THREE.Points;
  uniforms: Record<string, THREE.IUniform>;
  count: number;
  private geo = new THREE.BufferGeometry();
  private attrs: THREE.BufferAttribute[];
  private sets: PointSet[];
  private pair = [-1, -1];

  constructor(sets: PointSet[], rng: () => number) {
    this.sets = sets;
    this.count = sets[0].data.length / 4;
    // alle Formen einmal hochladen; ein Kapitelwechsel tauscht nur, welche Puffer «von» und «zu» sind
    this.attrs = sets.map((s) => new THREE.BufferAttribute(s.data, 4));
    const seed = new Float32Array(this.count * 4);
    for (let i = 0; i < seed.length; i++) seed[i] = rng();
    this.geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.geo.setAttribute('position', this.attrs[0]);
    this.uniforms = {
      uMorph: { value: 0 },
      uTime: { value: 0 },
      uFromM: { value: new THREE.Matrix4() },
      uToM: { value: new THREE.Matrix4() },
      uFromMin: { value: new THREE.Vector3() },
      uFromSize: { value: new THREE.Vector3(1, 1, 1) },
      uToMin: { value: new THREE.Vector3() },
      uToSize: { value: new THREE.Vector3(1, 1, 1) },
      uFromDust: { value: 0 },
      uToDust: { value: 0 },
      uSize: { value: 0.03 },
      uProj: { value: 1000 },
      uScale: { value: 1 },
      uIntensity: { value: 0.6 },
      uGoldDeep: { value: new THREE.Color(0xb8741a) },
      uGoldHi: { value: new THREE.Color(0xffe2a0) },
    };
    this.points = new THREE.Points(
      this.geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    this.setPair(0, Math.min(1, sets.length - 1));
  }

  setPair(a: number, b: number) {
    if (this.pair[0] === a && this.pair[1] === b) return;
    this.pair = [a, b];
    this.geo.setAttribute('aFrom', this.attrs[a]);
    this.geo.setAttribute('aTo', this.attrs[b]);
    this.uniforms.uFromMin.value.copy(this.sets[a].min);
    this.uniforms.uFromSize.value.copy(this.sets[a].size);
    this.uniforms.uToMin.value.copy(this.sets[b].min);
    this.uniforms.uToSize.value.copy(this.sets[b].size);
  }

  /** Anteil der gezeichneten Partikel (für schwache Geräte) */
  setShare(share: number) {
    this.geo.setDrawRange(0, Math.floor(this.count * share));
  }
}
