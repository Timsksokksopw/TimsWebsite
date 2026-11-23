// Die fünf Formen der Scroll-Story: Logo-T, Browserfenster (Wendico), Plattform-Stack (Swisscom),
// Portrait (nur Goldstaub und Foto) und Plektrum (Freizeit).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeLogoT } from '../logo';
import { makePick } from '../objects';
import { buildStackModel } from '../stack-model';
import {
  DISSOLVE_FRAGMENT_PARS,
  DISSOLVE_FRAGMENT_TEST,
  DISSOLVE_VERTEX_PARS,
  dissolveUniforms,
  makeDissolvable,
  type DissolveUniforms,
} from './dissolve';
import type { PointSet } from './sampling';

export interface StoryShape {
  /** Koordinatensystem der Form; darin liegen auch die Punkte des Goldstaubs */
  root: THREE.Group;
  /** Platzbedarf in Einheiten der Form – daraus ergibt sich die Grösse im Layout */
  fit: { w: number; h: number };
  /** Grundausrichtung */
  rot: THREE.Euler;
  /** wie stark die Form dem Mauszeiger folgt */
  sway: number;
  /** true: kein massives Objekt, die Partikel bleiben in Ruhe sichtbar */
  dustOnly: boolean;
  /** Sichtbarkeit des ruhenden Staubs (nur bei dustOnly), 0 … 1 */
  dustVis: number;
  u: DissolveUniforms;
  set?: PointSet;
  /** local: Fortschritt in der Haltezone; plain: ohne Partikel (reduzierte Bewegung) */
  tick?(dt: number, local: number, t: number, plain: boolean, visible: boolean): void;
}

type Kind = 'gold' | 'pale' | 'dark' | 'mid' | 'glow';
/** Helligkeit der Partikel, die von einer Fläche dieses Materials stammen */
const DUST: Record<Kind, number> = { gold: 1, pale: 1.1, dark: 0.36, mid: 0.5, glow: 1.3 };

// Jede Form bekommt eigene Material-Instanzen, weil das Auflösen pro Form gesteuert wird.
function palette(): Record<Kind, THREE.Material> {
  return {
    gold: new THREE.MeshPhysicalMaterial({ color: 0xf0b244, metalness: 1, roughness: 0.24, clearcoat: 0.3, clearcoatRoughness: 0.2 }),
    pale: new THREE.MeshPhysicalMaterial({ color: 0xf7dc9c, metalness: 1, roughness: 0.36 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x26272c, metalness: 0.5, roughness: 0.5 }),
    mid: new THREE.MeshStandardMaterial({ color: 0x3a3b43, metalness: 0.5, roughness: 0.45 }),
    glow: new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb84a, emissiveIntensity: 1.5 }),
  };
}
const paint = (o: THREE.Object3D, mats: Record<Kind, THREE.Material>, kind: Kind) => {
  (o as THREE.Mesh).material = mats[kind];
  o.userData.dust = DUST[kind];
};
const rb = (w: number, h: number, d: number, r: number) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r));

function finish(root: THREE.Group, o: Pick<StoryShape, 'fit' | 'rot' | 'sway'> & Partial<StoryShape>, dissolvable = true): StoryShape {
  const u = o.u ?? dissolveUniforms();
  if (dissolvable) makeDissolvable(root, u);
  return { dustOnly: false, dustVis: 1, ...o, root, u };
}

/* ---------- 0: das goldene T ---------- */
export function shapeLogo(): StoryShape {
  const m = palette();
  const root = makeLogoT(m.gold, 2.7);
  root.traverse((o) => (o.userData.dust = 1));
  return finish(root, { fit: { w: 2.7, h: 3.05 }, rot: new THREE.Euler(0.04, -0.4, 0), sway: 1.2 });
}

/* ---------- 1: Browserfenster mit echten Projekt-Screenshots ---------- */
export function shapeBrowser(urls: string[]): StoryShape {
  const m = palette();
  const root = new THREE.Group();
  const W = 3.5;
  const H = 2.56;
  const add = (mesh: THREE.Mesh, kind: Kind, x = 0, y = 0, z = 0) => {
    paint(mesh, m, kind);
    mesh.position.set(x, y, z);
    root.add(mesh);
    return mesh;
  };
  add(rb(W + 0.12, H + 0.12, 0.1, 0.11), 'gold', 0, 0, -0.035);
  add(rb(W, H, 0.14, 0.085), 'dark');
  const barY = H / 2 - 0.15;
  (['gold', 'pale', 'mid'] as Kind[]).forEach((k, i) => {
    const dot = add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12)), k, -W / 2 + 0.2 + i * 0.15, barY, 0.072);
    dot.scale.z = 0.5;
  });
  add(rb(1.5, 0.11, 0.03, 0.05), 'mid', 0.2, barY, 0.066);

  // Bildschirm: blendet zwischen zwei Screenshots und löst sich wie die übrigen Teile auf
  const u = dissolveUniforms();
  const uniforms = { ...u, uA: { value: null as THREE.Texture | null }, uB: { value: null as THREE.Texture | null }, uMix: { value: 0 }, uLoaded: { value: 0 } };
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(3.3, 2.2),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        ${DISSOLVE_VERTEX_PARS}
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vGdPos = (uRootInv * modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        ${DISSOLVE_FRAGMENT_PARS}
        uniform sampler2D uA; uniform sampler2D uB; uniform float uMix; uniform float uLoaded;
        varying vec2 vUv;
        void main() {
          ${DISSOLVE_FRAGMENT_TEST}
          vec3 col = mix(texture2D(uA, vUv).rgb, texture2D(uB, vUv).rgb, uMix);
          col = mix(vec3(0.015), col * 0.94, uLoaded) + uGlow * gdEdge * 0.9;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  screen.position.set(0, -0.12, 0.073);
  screen.userData.dust = 0.85;
  root.add(screen);

  const loader = new THREE.TextureLoader();
  const tex: (THREE.Texture | null)[] = urls.map(() => null);
  urls.forEach((url, i) =>
    loader.load(url, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      tex[i] = t;
      if (i === 0) uniforms.uLoaded.value = 1;
    }),
  );
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  return finish(root, {
    u,
    fit: { w: 3.9, h: 2.95 },
    rot: new THREE.Euler(-0.06, -0.42, 0.015),
    sway: 0.9,
    tick(_dt, local) {
      // beim Scrollen durch die Haltezone wechseln die Projekte
      const n = urls.length;
      const f = Math.min(n - 1e-4, local * n);
      const i = Math.floor(f);
      const j = Math.min(n - 1, i + 1);
      uniforms.uA.value = tex[i] ?? tex[0];
      uniforms.uB.value = tex[j] ?? tex[i] ?? tex[0];
      uniforms.uMix.value = i === j ? 0 : smooth(0.78, 1, f - i);
    },
  });
}

/* ---------- 2: Plattform-Stack in Gold und Anthrazit ---------- */
export function shapeStack(): StoryShape {
  const m = palette();
  const model = buildStackModel();
  const EXPLODE = 0.85;
  model.update(0, EXPLODE, -1);
  const slabs = new Map<THREE.Object3D, number>();
  model.layers.forEach((l, i) => slabs.set(l.g.children[0], i));
  const hsl = { h: 0, s: 0, l: 0 };
  model.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = false;
    const slab = slabs.get(mesh);
    if (slab !== undefined) return paint(mesh, m, slab % 2 ? 'mid' : 'dark');
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat.transparent) return paint(mesh, m, 'mid');
    if (mat.emissive && mat.emissive.getHex() !== 0) return paint(mesh, m, 'glow');
    mat.color.getHSL(hsl);
    paint(mesh, m, hsl.l < 0.25 ? 'dark' : hsl.s < 0.3 && hsl.l > 0.6 ? 'pale' : 'gold');
  });
  const root = new THREE.Group();
  model.root.position.y = -1.3;
  root.add(model.root);
  return finish(root, {
    fit: { w: 5.9, h: 6.2 },
    rot: new THREE.Euler(0.5, -0.64, 0),
    sway: 0.45,
    tick: (dt) => model.update(dt, EXPLODE, -1),
  });
}

/* ---------- 3: Portrait – Goldstaub, der zum echten Foto wird ---------- */
export function shapePortrait(photo: HTMLCanvasElement, mask: HTMLCanvasElement | null, w: number, h: number): StoryShape {
  const root = new THREE.Group();
  const map = new THREE.CanvasTexture(photo);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  if (mask) mat.alphaMap = new THREE.CanvasTexture(mask);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  plane.userData.noDust = true;
  plane.renderOrder = 1;
  root.add(plane);
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const shape = finish(
    root,
    {
      fit: { w: w + 0.3, h: h + 0.2 },
      rot: new THREE.Euler(0, -0.1, 0),
      sway: 0.35,
      dustOnly: true,
      tick(dt, local, _t, plain, visible) {
        // in der Mitte der Haltezone geht der Staub in das Foto über, am Ende wieder zurück
        const mix = plain ? (visible ? 1 : 0) : smooth(0.12, 0.42, local) * (1 - smooth(0.84, 0.98, local));
        mat.opacity += (mix - mat.opacity) * (plain ? Math.min(1, dt * 6) : 1);
        plane.visible = mat.opacity > 0.01;
        shape.dustVis = 1 - mix;
      },
    },
    false,
  );
  return shape;
}

/* ---------- 4: Plektrum ---------- */
export function shapePick(): StoryShape {
  const m = palette();
  const pick = makePick();
  // seidenmattes Gold: eine grosse flache Fläche würde als Spiegel nur den dunklen Raum zeigen
  pick.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const body = o === pick.children[0];
    if (body) (o as THREE.Mesh).material = new THREE.MeshPhysicalMaterial({ color: 0xf0b244, metalness: 0.72, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    else (o as THREE.Mesh).material = m.dark;
    o.userData.dust = body ? DUST.gold : DUST.dark;
  });
  const root = new THREE.Group();
  root.add(pick);
  return finish(root, { fit: { w: 3.5, h: 3.7 }, rot: new THREE.Euler(0.1, -0.42, 0.2), sway: 1.1 });
}
