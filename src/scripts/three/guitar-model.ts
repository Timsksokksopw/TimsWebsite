// Tims blaue Superstrat als 3D-Modell, komplett im Code gebaut.
// Vorbild sind die Studiofotos: dunkelblaue Metallic-Decke mit heller Kante, Ahorn-Zargen,
// zwei Humbucker, doppelt arretierendes Tremolo, Klemmsattel, spitze Kopfplatte.
// Koordinaten (lokal): x = entlang der Saiten (Steg 0 → Sattel 6.48), y = quer (Bass-Seite +), z = aus der Decke heraus.
// 1 Einheit entspricht 10 cm.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { damp } from './stage';

export const SCALE = 6.48;
export const FRET_COUNT = 24;
export const STRING_Z = 0.135;
const BOARD_END = 1.5;
const BOARD_TOP = 0.1;
const W_HEEL = 0.58;
const W_NUT = 0.43;
const SPREAD_BRIDGE = 0.105;
const SPREAD_NUT = 0.071;
const TREM_PIVOT = new THREE.Vector3(0.2, 0, 0.03);

export const fretX = (n: number) => SCALE / Math.pow(2, n / 12);
const neckW = (x: number) => THREE.MathUtils.mapLinear(Math.min(x, SCALE), BOARD_END, SCALE, W_HEEL, W_NUT);
const sstep = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const v2 = (a: number[][]) => a.map(([x, y]) => new THREE.Vector2(x, y));

/* ==========================================================================
   Saite: ein Schlauch, dessen Punkte jedes Bild neu berechnet werden
   ========================================================================== */
export class GuitarString {
  mesh: THREE.Mesh;
  amp = 0;
  phase = 0;
  fretU = 1;
  private pos: THREE.BufferAttribute;
  private static SEG = 40;
  private static RAD = 5;
  private dirty = true;

  constructor(
    public index: number,
    public a: THREE.Vector3,
    public b: THREE.Vector3,
    public radius: number,
    mat: THREE.MeshStandardMaterial,
  ) {
    const { SEG, RAD } = GuitarString;
    const geo = new THREE.BufferGeometry();
    const count = (SEG + 1) * RAD;
    this.pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    const nrm = new Float32Array(count * 3);
    const idx: number[] = [];
    for (let s = 0; s <= SEG; s++) {
      for (let r = 0; r < RAD; r++) {
        const ang = (r / RAD) * Math.PI * 2;
        const i = (s * RAD + r) * 3;
        nrm[i + 1] = Math.cos(ang);
        nrm[i + 2] = Math.sin(ang);
        if (s < SEG) {
          const p0 = s * RAD + r;
          const p1 = s * RAD + ((r + 1) % RAD);
          idx.push(p0, p0 + RAD, p1, p1, p0 + RAD, p1 + RAD);
        }
      }
    }
    geo.setAttribute('position', this.pos);
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.write();
  }

  /** y-Position der ruhenden Saite an der Stelle x */
  yAt(x: number) {
    return THREE.MathUtils.mapLinear(x, this.a.x, this.b.x, this.a.y, this.b.y);
  }

  pluck(velocity = 1, fret = 0) {
    this.amp = Math.min(0.085, 0.03 + velocity * 0.05);
    this.fretU = fret > 0 ? (fretX(fret - 0.35) - this.a.x) / (this.b.x - this.a.x) : 1;
    this.phase = Math.PI / 2;
    this.dirty = true;
  }

  update(dt: number) {
    if (this.amp < 0.0006 && !this.dirty) return;
    this.amp *= Math.exp(-dt * 1.9);
    this.phase += dt * (62 + this.index * 9);
    if (this.amp < 0.0006) this.amp = 0;
    this.write();
    (this.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.min(1.6, this.amp * 30);
    this.dirty = false;
  }

  private write() {
    const { SEG, RAD } = GuitarString;
    const arr = this.pos.array as Float32Array;
    const s1 = Math.sin(this.phase);
    const s2 = Math.sin(this.phase * 2.03 + 1);
    for (let s = 0; s <= SEG; s++) {
      const u = s / SEG;
      const x = this.a.x + (this.b.x - this.a.x) * u;
      let y = this.a.y + (this.b.y - this.a.y) * u;
      let z = this.a.z + (this.b.z - this.a.z) * u;
      if (this.amp > 0 && u < this.fretU) {
        const k = u / this.fretU;
        const d = this.amp * (Math.sin(Math.PI * k) * s1 + 0.28 * Math.sin(2 * Math.PI * k) * s2);
        y += d;
        z += d * 0.35;
      } else if (this.amp > 0 && this.fretU < 1) {
        z -= 0.016 * Math.min(1, (u - this.fretU) * 30);
      }
      for (let r = 0; r < RAD; r++) {
        const ang = (r / RAD) * Math.PI * 2;
        const i = (s * RAD + r) * 3;
        arr[i] = x;
        arr[i + 1] = y + Math.cos(ang) * this.radius;
        arr[i + 2] = z + Math.sin(ang) * this.radius;
      }
    }
    this.pos.needsUpdate = true;
  }
}

/* ==========================================================================
   Texturen
   ========================================================================== */
function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Metallic-Flocken im Lack: zufällige kleine Kippungen der Oberfläche */
function flakeNormalMap() {
  return canvasTexture(256, 256, (c) => {
    const img = c.createImageData(256, 256);
    for (let i = 0; i < 256 * 256; i++) {
      const a = Math.random() * Math.PI * 2;
      const m = Math.pow(Math.random(), 2.2);
      img.data[i * 4] = 128 + Math.cos(a) * m * 120;
      img.data[i * 4 + 1] = 128 + Math.sin(a) * m * 120;
      img.data[i * 4 + 2] = 255;
      img.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  });
}

/** geflammter Ahorn für die Zargen */
function flameMaple() {
  const t = canvasTexture(512, 64, (c) => {
    c.fillStyle = '#c58a48';
    c.fillRect(0, 0, 512, 64);
    const k = (Math.PI * 2) / 512;
    for (let x = 0; x < 512; x++) {
      const v = Math.sin(x * k * 16 + Math.sin(x * k * 3) * 2.2) * 0.5 + 0.5;
      c.fillStyle = `rgba(72, 36, 8, ${0.08 + 0.44 * Math.pow(v, 1.6)})`;
      c.fillRect(x, 0, 1, 64);
    }
    for (let i = 0; i < 36; i++) {
      c.fillStyle = `rgba(255, 216, 150, ${0.04 + Math.random() * 0.06})`;
      c.fillRect(0, Math.random() * 64, 512, 1);
    }
  });
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function knurlBump() {
  return canvasTexture(64, 4, (c) => {
    for (let x = 0; x < 64; x++) {
      const v = Math.round(128 + 110 * Math.sin((x / 64) * Math.PI * 2 * 8));
      c.fillStyle = `rgb(${v},${v},${v})`;
      c.fillRect(x, 0, 1, 4);
    }
  });
}

/* ==========================================================================
   Korpus: Umriss → Ringe → Fläche (mit abgerundeter Kante und Armauflage)
   ========================================================================== */
function bodyOutline() {
  // Umriss im Uhrzeigersinn ab dem Halsansatz (Bass-Seite). Drei eng gesetzte Punkte bilden jeweils eine Hornspitze.
  const pts = new THREE.CatmullRomCurve3(
    [
      [2.3, 0.29], [2.33, 0.5], [2.45, 0.72], [2.68, 0.88], [2.98, 0.98], [3.22, 1.07],
      [3.36, 1.15], [3.4, 1.2], [3.36, 1.26],
      [3.15, 1.37], [2.8, 1.46], [2.35, 1.47], [1.9, 1.4], [1.45, 1.27], [1.05, 1.17], [0.6, 1.22], [0.1, 1.42],
      [-0.5, 1.6], [-1.05, 1.57], [-1.5, 1.33], [-1.8, 0.9], [-1.95, 0.35], [-1.97, -0.25], [-1.85, -0.85],
      [-1.55, -1.38], [-1.05, -1.66], [-0.45, -1.7], [0.1, -1.56], [0.6, -1.34], [1.05, -1.24], [1.5, -1.3],
      [1.95, -1.42], [2.3, -1.46],
      [2.5, -1.4], [2.56, -1.34], [2.53, -1.28],
      [2.38, -1.16], [2.2, -0.98], [2.06, -0.76], [1.98, -0.52], [1.95, -0.29],
    ].map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    'centripetal',
  )
    .getPoints(246)
    .map((q) => new THREE.Vector2(q.x, q.y));
  if (pts[pts.length - 1].distanceTo(pts[0]) < 1e-6) pts.pop();
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % pts.length];
    area += p0.x * p1.y - p1.x * p0.y;
  }
  if (area < 0) pts.reverse(); // gegen den Uhrzeigersinn: «links» ist innen
  return pts;
}

function buildBody(materials: THREE.Material[]) {
  const P = bodyOutline();
  const N = P.length;
  const nx = new Float32Array(N);
  const ny = new Float32Array(N);
  const arc = new Float32Array(N);
  const w = new Float32Array(N);
  const drop = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = P[(i - 1 + N) % N];
    const b = P[(i + 1) % N];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    nx[i] = -ty / l;
    ny[i] = tx / l;
    arc[i] = i ? arc[i - 1] + P[i].distanceTo(P[i - 1]) : 0;
  }
  const total = arc[N - 1] + P[0].distanceTo(P[N - 1]);
  for (let i = 0; i < N; i++) {
    // Armauflage: breite, flache Fase hinten auf der Bass-Seite
    const arm = sstep(0.55, 1.25, P[i].y) * (1 - sstep(-0.1, 0.9, P[i].x));
    // an schmalen Stellen (Hornspitzen) darf die Rundung nicht über die Mitte hinaus
    let thick = 9;
    for (let j = 0; j < N; j++) {
      const da = Math.abs(arc[i] - arc[j]);
      // «gegenüber» heisst: die Kante schaut uns entgegen (z. B. die andere Seite eines Horns)
      if (Math.min(da, total - da) < 0.12 || nx[i] * nx[j] + ny[i] * ny[j] > -0.3) continue;
      thick = Math.min(thick, P[i].distanceTo(P[j]));
    }
    w[i] = Math.min(0.085 + 0.5 * arm, thick * 0.4);
    drop[i] = 0.045 + 0.13 * arm;
  }

  const ZB = -0.44;
  const T = [0.1, 0.24, 0.42, 0.64, 0.85, 1];
  const rings = 5 + T.length;
  const pos = new Float32Array(rings * N * 3);
  const uv = new Float32Array(rings * N * 2);
  const set = (r: number, i: number, inset: number, z: number, planar: boolean) => {
    const x = P[i].x + nx[i] * inset;
    const y = P[i].y + ny[i] * inset;
    const k = r * N + i;
    pos.set([x, y, z], k * 3);
    uv.set(planar ? [(x + 2.1) / 5.6, (y + 1.8) / 3.6] : [arc[i] * 0.4, (z - ZB) * 1.5], k * 2);
  };
  for (let i = 0; i < N; i++) {
    const e = Math.min(1, w[i] / 0.085);
    set(0, i, 0.075 * e, ZB, false);
    set(1, i, 0.022 * e, ZB + 0.022, false);
    set(2, i, 0, ZB + 0.075, false);
    set(3, i, 0, -drop[i] - 0.024, false);
    set(4, i, 0, -drop[i], false);
    T.forEach((t, k) => set(5 + k, i, w[i] * t, -drop[i] * Math.pow(1 - t, 1.6), true));
  }

  const groups: number[][] = [[], [], [], []]; // 0 Zarge, 1 helle Kante, 2 Decke, 3 Boden
  const loft = (a: number, b: number, g: number) => {
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      groups[g].push(a * N + i, a * N + j, b * N + j, a * N + i, b * N + j, b * N + i);
    }
  };
  loft(0, 1, 3);
  loft(1, 2, 0);
  loft(2, 3, 0);
  loft(3, 4, 1);
  loft(4, 5, 1);
  for (let r = 5; r < rings - 1; r++) loft(r, r + 1, 2);
  const cap = (r: number, g: number, up: boolean) => {
    const contour: THREE.Vector2[] = [];
    for (let i = 0; i < N; i++) contour.push(new THREE.Vector2(pos[(r * N + i) * 3], pos[(r * N + i) * 3 + 1]));
    const ring = contour.slice();
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      const A = ring[a];
      const B = ring[b];
      const C = ring[c];
      const ccw = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x) > 0;
      if (ccw === up) groups[g].push(r * N + a, r * N + b, r * N + c);
      else groups[g].push(r * N + a, r * N + c, r * N + b);
    }
  };
  cap(0, 3, false);
  cap(rings - 1, 2, true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(groups.flat());
  let o = 0;
  groups.forEach((g, m) => {
    geo.addGroup(o, g.length, m);
    o += g.length;
  });
  geo.computeVertexNormals();
  return { mesh: new THREE.Mesh(geo, materials), outline: P, nx, ny };
}

function headShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.225);
  s.splineThru(v2([[0.08, -0.29], [0.3, -0.36], [0.75, -0.36], [1.3, -0.24], [1.9, -0.06], [2.42, 0.14], [2.56, 0.2]])); // Spitze
  s.splineThru(v2([[2.36, 0.36], [2.2, 0.54], [2.16, 0.58]]));
  s.lineTo(0.3, 0.33);
  s.quadraticCurveTo(0.08, 0.31, 0, 0.225);
  s.closePath();
  return s;
}
const headEdgeY = (x: number) => 0.33 + (x - 0.3) * 0.1344;

/* ==========================================================================
   Das Modell
   ========================================================================== */
export interface GuitarModel {
  /** Äussere Gruppe – Drehpunkt in der Mitte der Gitarre */
  group: THREE.Group;
  /** Innere Gruppe im Gitarren-Koordinatensystem (Steg bei x = 0) */
  local: THREE.Group;
  strings: GuitarString[];
  /** Umrisspunkte (lokal) – für das Einpassen ins Layout */
  silhouette: THREE.Vector3[];
  /** Teile, die man anfassen kann. userData.part = 'whammy' | 'volume' | 'tone' | 'selector' */
  parts: THREE.Object3D[];
  /** Ende des Klinkensteckers, lokale +x-Achse zeigt vom Korpus weg */
  cableAnchor: THREE.Object3D;
  setWhammy(v: number): void;
  setKnob(which: 'volume' | 'tone', v: number): void;
  setSelector(pos: number): void;
  setFingering(frets: number[] | null): void;
  flashNote(string: number, fret: number): void;
  /** Griffbrett-Treffer: welche Saite, welcher Bund? */
  locate(p: THREE.Vector3): { string: number; fret: number } | null;
  update(dt: number): void;
}

export function buildGuitar(opts: { glow?: number } = {}): GuitarModel {
  const local = new THREE.Group();
  const put = <T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0, parent: THREE.Object3D = local) => {
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const box = (w: number, h: number, d: number, r: number, mat: THREE.Material) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
  /** Zylinder mit Achse z */
  const cylZ = (r: number, h: number, mat: THREE.Material, seg = 16, rTop = r) =>
    new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, seg).rotateX(Math.PI / 2), mat);
  /** Zylinder mit Achse x */
  const cylX = (r: number, h: number, mat: THREE.Material, seg = 14) =>
    new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg).rotateZ(-Math.PI / 2), mat);
  const seg = (from: THREE.Vector3, to: THREE.Vector3, r: number, mat: THREE.Material, parent: THREE.Object3D = local) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, from.distanceTo(to), 5), mat);
    m.position.copy(from).lerp(to, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    parent.add(m);
    return m;
  };

  /* ---------- Materialien ---------- */
  const flake = flakeNormalMap();
  flake.repeat.set(2.2, 1.4);
  const blue = new THREE.MeshPhysicalMaterial({
    color: 0x1436a2,
    metalness: 0.55,
    roughness: 0.36,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    normalMap: flake,
    normalScale: new THREE.Vector2(0.09, 0.09),
  });
  const wood = new THREE.MeshPhysicalMaterial({ map: flameMaple(), roughness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.12 });
  const cream = new THREE.MeshPhysicalMaterial({ color: 0xf2e8d2, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.15 });
  const maple = new THREE.MeshPhysicalMaterial({ color: 0xe4bd84, roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3 });
  const ebony = new THREE.MeshStandardMaterial({ color: 0x17120f, roughness: 0.55 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e9ee, metalness: 1, roughness: 0.14 });
  const nickel = new THREE.MeshStandardMaterial({ color: 0xcdd0d4, metalness: 1, roughness: 0.34 });
  const fretWire = new THREE.MeshStandardMaterial({ color: 0xdfe2e6, metalness: 1, roughness: 0.22 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.45, metalness: 0.3 });
  const pearl = new THREE.MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.35 });
  const knurl = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.3, bumpMap: knurlBump(), bumpScale: 1.4 });
  knurl.bumpMap!.repeat.set(5, 1);

  /* ---------- Korpus ---------- */
  const backWood = new THREE.MeshPhysicalMaterial({ color: 0xb87a40, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const body = buildBody([wood, cream, blue, backWood]);
  local.add(body.mesh);

  /* ---------- Saiten (früh angelegt, weil viele Teile ihre Lage brauchen) ---------- */
  const strings: GuitarString[] = [];
  const glow = new THREE.Color(opts.glow ?? 0x2ce0d2);
  for (let i = 0; i < 6; i++) {
    // i = 0 → tiefe E-Saite (oben, +y)
    const wound = i < 3;
    const mat = new THREE.MeshStandardMaterial({
      color: wound ? 0xc9b48a : 0xe8ecf2,
      metalness: 1,
      roughness: wound ? 0.4 : 0.2,
      emissive: glow,
      emissiveIntensity: 0,
    });
    const str = new GuitarString(
      i,
      new THREE.Vector3(0, (2.5 - i) * SPREAD_BRIDGE, STRING_Z),
      new THREE.Vector3(SCALE, (2.5 - i) * SPREAD_NUT, STRING_Z + 0.004),
      0.02 - i * 0.0023,
      mat,
    );
    local.add(str.mesh);
    strings.push(str);
  }

  /* ---------- Hals ---------- */
  const hw = W_HEEL / 2;
  const prof = new THREE.Shape();
  prof.moveTo(-hw, 0.04);
  prof.lineTo(hw, 0.04);
  prof.bezierCurveTo(hw, -0.2, 0.15, -0.23, 0, -0.23);
  prof.bezierCurveTo(-0.15, -0.23, -hw, -0.2, -hw, 0.04);
  const NECK_END = SCALE + 0.15;
  const taper = (geo: THREE.BufferGeometry, thin = false) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setY(i, (p.getY(i) * neckW(x)) / W_HEEL);
      if (thin && p.getZ(i) < 0) p.setZ(i, p.getZ(i) * THREE.MathUtils.mapLinear(Math.min(x, SCALE), BOARD_END, SCALE, 1, 0.84));
    }
    geo.computeVertexNormals();
  };
  const neckGeo = new THREE.ExtrudeGeometry(prof, { depth: NECK_END - BOARD_END, bevelEnabled: false, steps: 1, curveSegments: 12 });
  // Profil (x,y) → Gitarre (y,z); Extrusion (z) → Gitarre (x)
  neckGeo.applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
  neckGeo.translate(BOARD_END, 0, 0);
  taper(neckGeo, true);
  local.add(new THREE.Mesh(neckGeo, maple));

  const fbLen = SCALE - BOARD_END;
  const fbGeo = new THREE.BoxGeometry(fbLen, W_HEEL, BOARD_TOP - 0.04);
  fbGeo.translate(BOARD_END + fbLen / 2, 0, (BOARD_TOP + 0.04) / 2);
  taper(fbGeo);
  local.add(new THREE.Mesh(fbGeo, ebony));

  /* ---------- Bünde, Griffbrett-Punkte ---------- */
  const frets = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 8), fretWire, FRET_COUNT);
  const m4 = new THREE.Matrix4();
  for (let n = 1; n <= FRET_COUNT; n++) {
    const x = fretX(n);
    m4.makeScale(1, neckW(x) * 0.995, 0.8).setPosition(x, 0, BOARD_TOP - 0.003);
    frets.setMatrixAt(n - 1, m4);
  }
  local.add(frets);
  const dotGeo = new THREE.CylinderGeometry(0.027, 0.027, 0.004, 14).rotateX(Math.PI / 2);
  const sideGeo = new THREE.SphereGeometry(0.012, 8, 6);
  const mid = (n: number) => (fretX(n) + fretX(n - 1)) / 2;
  // versetzte Punkte nahe der Bass-Kante, Doppelpunkt am 12. und 24. Bund
  for (const n of [3, 5, 7, 9, 12, 15, 17, 19, 21, 24]) {
    const x = mid(n);
    const wide = neckW(x);
    const dbl = n % 12 === 0;
    put(new THREE.Mesh(dotGeo, pearl), x, wide * (dbl ? 0.36 : 0.3), BOARD_TOP + 0.0015);
    if (dbl) put(new THREE.Mesh(dotGeo, pearl), x, wide * 0.17, BOARD_TOP + 0.0015);
    put(new THREE.Mesh(sideGeo, cream), x, wide / 2 + 0.001, 0.072);
  }

  /* ---------- Klemmsattel ---------- */
  put(box(0.15, W_NUT + 0.03, 0.09, 0.012, chrome), SCALE + 0.065, 0, 0.085);
  for (const k of [-1, 0, 1]) {
    put(box(0.12, 0.125, 0.03, 0.01, chrome), SCALE + 0.065, k * 0.142, 0.152);
    put(cylZ(0.03, 0.026, black, 6), SCALE + 0.065, k * 0.142, 0.176);
  }

  /* ---------- Kopfplatte ---------- */
  const head = new THREE.Group();
  head.position.set(SCALE + 0.14, 0, 0.02);
  head.rotation.y = 0.16;
  local.add(head);
  const hs = headShape();
  const headGeo = new THREE.ExtrudeGeometry(hs, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 16 });
  headGeo.translate(0, 0, -0.112);
  const blueHead = blue.clone();
  blueHead.normalMap = flake.clone();
  blueHead.normalMap.repeat.set(0.45, 0.45);
  blueHead.normalMap.needsUpdate = true;
  head.add(new THREE.Mesh(headGeo, [blueHead, maple]));
  // Rückseite in Ahorn
  const backGeo = new THREE.ShapeGeometry(hs, 16);
  const headBack = new THREE.Mesh(backGeo, maple);
  headBack.rotation.x = Math.PI;
  headBack.scale.y = -1;
  headBack.position.z = -0.1245;
  head.add(headBack);

  // Halsstab-Abdeckung
  const cover = put(box(0.42, 0.18, 0.014, 0.006, black), 0.62, -0.03, 0.004, head);
  cover.rotation.z = 0.13;

  // Schriftzug: Tims eigene Signatur statt eines Herstellerlogos
  const logoCanvas = document.createElement('canvas');
  logoCanvas.width = 768;
  logoCanvas.height = 224;
  const logoTex = new THREE.CanvasTexture(logoCanvas);
  logoTex.colorSpace = THREE.SRGBColorSpace;
  logoTex.anisotropy = 8;
  const drawLogo = () => {
    const c = logoCanvas.getContext('2d')!;
    c.clearRect(0, 0, 768, 224);
    c.fillStyle = '#eef1f5';
    c.textBaseline = 'alphabetic';
    c.font = 'italic 500 44px "Libre Bodoni Variable", "Bodoni MT", Didot, Georgia, serif';
    c.fillText('Signature', 250, 62);
    c.font = 'italic 600 128px "Libre Bodoni Variable", "Bodoni MT", Didot, Georgia, serif';
    c.fillText('Biedermann', 14, 180);
    logoTex.needsUpdate = true;
  };
  drawLogo();
  (document as any).fonts?.load?.('italic 600 128px "Libre Bodoni Variable"').then(drawLogo, () => {});
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.86, 0.251),
    new THREE.MeshStandardMaterial({ map: logoTex, transparent: true, metalness: 0.85, roughness: 0.3, depthWrite: false }),
  );
  logo.position.set(1.4, -0.03, 0.0135);
  logo.rotation.z = 0.2;
  head.add(logo);

  // Saitenniederhalter
  const barY = 0.06;
  put(cylZ(0.022, 0.5, chrome, 10), 0.28, barY, 0.05, head).rotation.x = Math.PI / 2;
  put(cylZ(0.022, 0.012, black, 8), 0.28, barY + 0.2, 0.074, head);
  put(cylZ(0.022, 0.012, black, 8), 0.28, barY - 0.2, 0.074, head);

  // Mechaniken: Achsen auf der Vorderseite, Flügel an der Bass-Kante
  head.updateMatrix();
  const buttonGeo = new THREE.SphereGeometry(0.075, 14, 10);
  const posts: THREE.Vector3[] = [];
  const tunerTips: THREE.Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    const px = 0.5 + i * 0.3;
    const py = headEdgeY(px) - 0.15;
    put(cylZ(0.062, 0.014, chrome, 16), px, py, 0.007, head);
    put(cylZ(0.03, 0.11, chrome, 12), px, py, 0.07, head);
    put(cylZ(0.036, 0.02, chrome, 12), px, py, 0.118, head);
    put(box(0.17, 0.2, 0.07, 0.025, chrome), px, py + 0.02, -0.15, head);
    const edge = headEdgeY(px);
    seg(new THREE.Vector3(px, py + 0.1, -0.15), new THREE.Vector3(px, edge + 0.1, -0.15), 0.018, chrome, head);
    const btn = put(new THREE.Mesh(buttonGeo, chrome), px, edge + 0.14, -0.15, head);
    btn.scale.set(1.05, 0.62, 0.36);
    posts.push(new THREE.Vector3(px, py, 0.09));
    tunerTips.push(new THREE.Vector3(px, edge + 0.2, -0.15).applyMatrix4(head.matrix));
  }
  // Saiten vom Sattel unter dem Niederhalter durch zu den Mechaniken
  strings.forEach((s, i) => {
    const nutRear = new THREE.Vector3(SCALE + 0.14, s.b.y, s.b.z);
    const k = 0.28 / posts[i].x;
    const under = new THREE.Vector3(0.28, s.b.y + (posts[i].y - s.b.y) * k, 0.03).applyMatrix4(head.matrix);
    const post = posts[i].clone().applyMatrix4(head.matrix);
    seg(s.b, nutRear, s.radius, s.mesh.material as THREE.Material);
    seg(nutRear, under, s.radius, s.mesh.material as THREE.Material);
    seg(under, post, s.radius, s.mesh.material as THREE.Material);
  });

  /* ---------- Tonabnehmer: gekapselte Humbucker, direkt in die Decke geschraubt ---------- */
  const screwGeo = new THREE.CylinderGeometry(0.027, 0.027, 0.012, 10).rotateX(Math.PI / 2);
  const slotGeo = new THREE.BoxGeometry(0.04, 0.008, 0.004);
  const pickup = (x: number, side: number) => {
    put(box(0.5, 0.88, 0.014, 0.006, black), x, 0, 0.003);
    put(box(0.4, 0.76, 0.11, 0.035, nickel), x, 0, 0.04);
    strings.forEach((s, i) => {
      const y = s.yAt(x + side * 0.1);
      put(new THREE.Mesh(screwGeo, chrome), x + side * 0.1, y, 0.098);
      put(new THREE.Mesh(slotGeo, black), x + side * 0.1, y, 0.1045).rotation.z = i * 1.3;
    });
  };
  pickup(0.46, -1);
  pickup(1.26, 1);

  /* ---------- Tremolo (kippt um die Messerkante vorne) ---------- */
  put(box(0.9, 0.98, 0.014, 0.006, black), -0.22, 0, 0.003);
  put(cylZ(0.055, 0.1, chrome, 16), TREM_PIVOT.x, 0.47, 0.05);
  put(cylZ(0.055, 0.1, chrome, 16), TREM_PIVOT.x, -0.47, 0.05);
  const trem = new THREE.Group();
  trem.position.copy(TREM_PIVOT);
  local.add(trem);
  const T = <O extends THREE.Object3D>(o: O, x: number, y: number, z: number) => put(o, x - TREM_PIVOT.x, y, z - TREM_PIVOT.z, trem);
  T(box(0.8, 0.9, 0.05, 0.02, chrome), -0.22, 0, 0.05);
  T(box(0.1, 0.84, 0.06, 0.02, chrome), -0.42, 0, 0.1);
  strings.forEach((s) => {
    const y = s.a.y;
    T(box(0.2, 0.086, 0.075, 0.018, chrome), -0.04, y, 0.105);
    T(box(0.07, 0.06, 0.02, 0.006, black), -0.06, y, 0.146);
    T(cylX(0.017, 0.26, black, 8), -0.27, y, 0.11);
    T(cylZ(0.04, 0.085, black, 12, 0.036), -0.56, y, 0.14);
  });
  // Hebel
  const armPts = [new THREE.Vector3(0.02, -0.5, 0.07), new THREE.Vector3(0.03, -0.52, 0.21), new THREE.Vector3(0.32, -0.57, 0.3), new THREE.Vector3(1.3, -0.72, 0.31)];
  const armCurve = new THREE.CatmullRomCurve3(armPts.map((p) => p.clone().sub(TREM_PIVOT)));
  trem.add(new THREE.Mesh(new THREE.TubeGeometry(armCurve, 28, 0.024, 8), black));
  T(cylZ(0.05, 0.05, chrome, 14), 0.02, -0.5, 0.085);
  T(new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), black), 1.3, -0.72, 0.31);
  const armGrip = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 10, 0.14, 6), black);
  armGrip.visible = false;
  armGrip.userData.part = 'whammy';
  trem.add(armGrip);

  /* ---------- Regler und Wahlschalter ---------- */
  const makeKnob = (part: string) => {
    const g = new THREE.Group();
    const skirt = cylZ(0.108, 0.1, knurl, 30, 0.1);
    skirt.position.z = 0.05;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), chrome);
    dome.scale.z = 0.3;
    dome.position.z = 0.1;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.06, 0.006), black);
    mark.position.set(0, 0.055, 0.126);
    const grip = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), black);
    grip.visible = false;
    grip.position.z = 0.06;
    g.add(skirt, dome, mark, grip);
    g.traverse((o) => (o.userData.part = part));
    return g;
  };
  const knobs = {
    volume: put(makeKnob('volume'), 0.36, -0.84, 0),
    tone: put(makeKnob('tone'), 0.0, -1.27, 0),
  };
  const selector = new THREE.Group();
  selector.position.set(0.17, -1.07, 0);
  selector.rotation.z = -0.9;
  local.add(selector);
  put(box(0.32, 0.07, 0.012, 0.005, black), 0, 0, 0.003, selector);
  const lever = new THREE.Group();
  lever.position.z = 0.004;
  selector.add(lever);
  put(cylZ(0.016, 0.15, black, 8), 0, 0, 0.075, lever);
  put(box(0.055, 0.075, 0.06, 0.018, black), 0, 0, 0.165, lever);
  const selGrip = put(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), black), 0, 0, 0.1, selector);
  selGrip.visible = false;
  selGrip.userData.part = 'selector';
  let selTarget = -0.38;
  lever.rotation.y = selTarget;

  /* ---------- Gurtpins, Klinkenbuchse ---------- */
  const pin = () => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 12), chrome);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.022, 16), chrome);
    b.position.y = 0.05;
    g.add(a, b);
    return g;
  };
  put(pin(), -1.99, -0.2, -0.2).rotation.z = Math.PI / 2;
  put(pin(), 3.1, 1.28, -0.46).rotation.x = -Math.PI / 2;

  // Rückseite: Federkammer-Deckel und Halsschrauben
  put(box(1.15, 0.72, 0.012, 0.005, black), -0.25, 0, -0.444);
  for (const [bx, by] of [[1.6, 0.2], [1.6, -0.2], [1.98, 0.2], [1.86, -0.2]]) put(cylZ(0.05, 0.014, chrome, 14), bx, by, -0.446);

  let jk = 0;
  let jd = 9;
  body.outline.forEach((p, i) => {
    const d = Math.hypot(p.x + 0.9, p.y + 1.68);
    if (d < jd) {
      jd = d;
      jk = i;
    }
  });
  const jack = new THREE.Group();
  jack.position.set(body.outline[jk].x, body.outline[jk].y, -0.2);
  jack.rotation.z = Math.atan2(-body.ny[jk], -body.nx[jk]);
  local.add(jack);
  put(cylX(0.085, 0.03, chrome, 16), 0.012, 0, 0, jack);
  put(cylX(0.05, 0.28, black, 12), 0.16, 0, 0, jack);
  put(cylX(0.034, 0.16, black, 10), 0.37, 0, 0, jack);
  const cableAnchor = put(new THREE.Object3D(), 0.44, 0, 0, jack);

  /* ---------- Griffbild: leuchtende Punkte für die Finger, Kreuze für stumme Saiten ---------- */
  const fingerMat = new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 1.5, roughness: 0.4 });
  const fingerGeo = new THREE.SphereGeometry(0.05, 16, 10);
  const muteMat = new THREE.MeshStandardMaterial({ color: 0xff4a2e, emissive: 0xff4a2e, emissiveIntensity: 1.2 });
  const marks = strings.map((s) => {
    const dot = put(new THREE.Mesh(fingerGeo, fingerMat), 0, 0, STRING_Z + 0.012);
    const mute = new THREE.Group();
    const xm = fretX(0.5);
    mute.position.set(xm, s.yAt(xm), STRING_Z + 0.02);
    for (const r of [0.78, -0.78]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.014, 0.008), muteMat);
      bar.rotation.z = r;
      mute.add(bar);
    }
    local.add(mute);
    dot.visible = mute.visible = false;
    return { dot, mute, k: 0, m: 0, on: false, muted: false };
  });
  const ringGeo = new THREE.TorusGeometry(0.06, 0.012, 8, 24);
  const flashes = strings.map(() => {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false;
    local.add(m);
    return { m, life: 0 };
  });
  const fingerX = (f: number) => fretX(f) + 0.32 * (fretX(f - 1) - fretX(f));

  /* ---------- Umriss für das Layout ---------- */
  const silhouette: THREE.Vector3[] = [];
  body.outline.forEach((p, i) => i % 4 === 0 && silhouette.push(new THREE.Vector3(p.x, p.y, 0)));
  for (let x = 2.2; x < SCALE; x += 0.35) {
    silhouette.push(new THREE.Vector3(x, neckW(x) / 2, BOARD_TOP), new THREE.Vector3(x, -neckW(x) / 2, BOARD_TOP));
  }
  hs.getPoints(4).forEach((p) => silhouette.push(new THREE.Vector3(p.x, p.y, 0).applyMatrix4(head.matrix)));
  silhouette.push(...tunerTips, new THREE.Vector3(1.3, -0.72, 0.31));

  const group = new THREE.Group();
  local.position.set(-3.35, 0, 0.1);
  group.add(local);

  return {
    group,
    local,
    strings,
    silhouette,
    parts: [armGrip, knobs.volume, knobs.tone, selGrip],
    cableAnchor,
    setWhammy(v) {
      trem.rotation.y = v * 0.2;
    },
    setKnob(which, v) {
      knobs[which].rotation.z = THREE.MathUtils.lerp(2.4, -2.4, THREE.MathUtils.clamp(v, 0, 1));
    },
    setSelector(p) {
      selTarget = (p - 1) * 0.38;
    },
    setFingering(fr) {
      marks.forEach((mk, i) => {
        const f = fr ? fr[i] : 0;
        mk.on = f > 0;
        mk.muted = f < 0;
        if (f > 0) {
          const x = fingerX(f);
          mk.dot.position.set(x, strings[i].yAt(x), STRING_Z + 0.012);
        }
      });
    },
    flashNote(i, f) {
      const x = f > 0 ? fingerX(f) : SCALE - 0.1;
      flashes[i].m.position.set(x, strings[i].yAt(x), STRING_Z + 0.02);
      flashes[i].life = 1;
    },
    locate(p) {
      if (p.x < fretX(FRET_COUNT) - 0.06 || p.x > SCALE + 0.02) return null;
      if (Math.abs(p.y) > neckW(p.x) / 2 + 0.03) return null;
      let best = 0;
      let bd = 9;
      for (const s of strings) {
        const d = Math.abs(p.y - s.yAt(p.x));
        if (d < bd) {
          bd = d;
          best = s.index;
        }
      }
      const fret = p.x >= SCALE ? 0 : THREE.MathUtils.clamp(Math.ceil(12 * Math.log2(SCALE / p.x) - 1e-6), 1, FRET_COUNT);
      return { string: best, fret };
    },
    update(dt) {
      for (const s of strings) s.update(dt);
      lever.rotation.y = damp(lever.rotation.y, selTarget, 18, dt);
      for (const mk of marks) {
        mk.k = damp(mk.k, mk.on ? 1 : 0, 16, dt);
        mk.m = damp(mk.m, mk.muted ? 1 : 0, 16, dt);
        mk.dot.visible = mk.k > 0.03;
        mk.dot.scale.set(1.1 * mk.k, 0.95 * mk.k, 0.45 * mk.k);
        mk.mute.visible = mk.m > 0.03;
        mk.mute.scale.setScalar(mk.m);
      }
      for (const f of flashes) {
        if (f.life <= 0) continue;
        f.life -= dt * 2.2;
        f.m.visible = f.life > 0;
        f.m.scale.setScalar(1 + (1 - f.life) * 2.2);
        (f.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, f.life) * 0.9;
      }
    },
  };
}
