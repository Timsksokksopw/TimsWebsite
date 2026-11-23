// Tims Cord-Cap: sechs Panels mit Nähten, gebogener Schirm mit heller Paspel,
// Patch vorne, Verschluss hinten. Alles prozedural, Cord-Struktur aus einer Canvas-Textur.
import * as THREE from 'three';

const R = 0.8; // Radius der Krone an der Basis
const H = 0.7; // Höhe der Krone
const ZS = 1.1; // vorne-hinten etwas länger als breit
const BRIM_A = 1.22; // halber Öffnungswinkel des Schirms (rad)
const BRIM_L = 0.74; // Schirmlänge vorne

/** Punkt auf der Krone. v = Winkel um die Hochachse (0 = vorne), u = 0 (oben) … 1 (Rand) */
function crown(v: number, u: number, out: THREE.Vector3, offset = 0) {
  const th = (u * Math.PI) / 2;
  const front = Math.max(0, Math.cos(v)) ** 2;
  const back = Math.max(0, -Math.cos(v));
  // vorne steiler und höher (verstärkte Frontpanels), hinten runder
  const p = THREE.MathUtils.lerp(0.86, 0.66, front);
  const r = (R + offset) * Math.pow(Math.sin(th), p) * (1 + 0.035 * front * Math.sin(2 * th));
  const y = (H + offset) * Math.pow(Math.cos(th), 0.92) * (1 + 0.07 * front - 0.05 * back);
  return out.set(r * Math.sin(v), y, r * Math.cos(v) * ZS);
}

/** Punkt auf dem Schirm. a = Winkel (-A … A), d = 0 (an der Krone) … 1 (Vorderkante) */
function brim(a: number, d: number, out: THREE.Vector3, drop = 0) {
  const k = a / BRIM_A;
  const len = BRIM_L * Math.pow(Math.max(0, Math.cos((k * Math.PI) / 2)), 0.5);
  const ix = R * 0.95 * Math.sin(a);
  const iz = R * 0.95 * Math.cos(a) * ZS;
  const x = ix + d * len * Math.sin(a) * 0.3;
  const z = iz + d * len * (0.55 + 0.45 * Math.cos(a));
  // am Ansatz flach (liegt am Kronenrand an), nach aussen seitlich nach unten gebogen
  const y = -0.4 * (x / R) ** 2 * d * (len / BRIM_L) - 0.07 * d * len + 0.04 * Math.sin(Math.PI * d) * (1 - k * k) - drop;
  return out.set(x, y + 0.03, z);
}

function grid(fn: (s: number, t: number, out: THREE.Vector3) => void, ns: number, nt: number, uvS = 1, uvT = 1, closed = false) {
  const pos = new Float32Array((ns + 1) * (nt + 1) * 3);
  const uv = new Float32Array((ns + 1) * (nt + 1) * 2);
  const idx: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= ns; i++) {
    for (let j = 0; j <= nt; j++) {
      const k = i * (nt + 1) + j;
      fn(i / ns, j / nt, p);
      pos.set([p.x, p.y, p.z], k * 3);
      uv.set([(i / ns) * uvS, (j / nt) * uvT], k * 2);
      if (i < ns && j < nt) idx.push(k, k + 1, k + nt + 1, k + 1, k + nt + 2, k + nt + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  if (closed) {
    // Naht bei s = 0 / s = 1 glätten
    const n = g.attributes.normal;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (let j = 0; j <= nt; j++) {
      const k0 = j;
      const k1 = ns * (nt + 1) + j;
      a.fromBufferAttribute(n, k0).add(b.fromBufferAttribute(n, k1)).normalize();
      n.setXYZ(k0, a.x, a.y, a.z);
      n.setXYZ(k1, a.x, a.y, a.z);
    }
  }
  return g;
}

function cordTextures() {
  const W = 512;
  const mk = (draw: (ctx: CanvasRenderingContext2D) => void, h = 8) => {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = h;
    draw(cv.getContext('2d')!);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  };
  const RIBS = 8;
  const bump = mk((ctx) => {
    for (let x = 0; x < W; x++) {
      const s = Math.abs(Math.sin((x / W) * Math.PI * RIBS));
      const v = Math.round(40 + 215 * Math.pow(s, 0.55));
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, 0, 1, 8);
    }
  });
  const color = mk((ctx) => {
    for (let x = 0; x < W; x++) {
      const s = Math.pow(Math.abs(Math.sin((x / W) * Math.PI * RIBS)), 0.5);
      // Rillen dunkler, Rippen heller – warmes Cord-Braun
      const r = Math.round(108 + 58 * s);
      const g = Math.round(74 + 46 * s);
      const b = Math.round(44 + 30 * s);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, 0, 1, 8);
    }
  });
  color.colorSpace = THREE.SRGBColorSpace;
  return { bump, color };
}

function patchTexture() {
  const cv = document.createElement('canvas');
  cv.width = 384;
  cv.height = 240;
  const c = cv.getContext('2d')!;
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    c.beginPath();
    c.roundRect(x, y, w, h, r);
  };
  c.fillStyle = '#efe6cf';
  c.fillRect(0, 0, 384, 240);
  // gestickter Rand
  c.strokeStyle = '#d8ccae';
  c.lineWidth = 4;
  c.setLineDash([10, 6]);
  rr(10, 10, 364, 220, 22);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = '#16305c';
  rr(26, 26, 332, 188, 16);
  c.fill();
  c.strokeStyle = '#efe6cf';
  c.lineWidth = 3;
  rr(36, 36, 312, 168, 10);
  c.stroke();
  // kleine Berg-Welle + Initialen
  c.fillStyle = '#efe6cf';
  c.beginPath();
  c.moveTo(70, 150);
  c.lineTo(118, 86);
  c.lineTo(146, 122);
  c.lineTo(166, 100);
  c.lineTo(204, 150);
  c.closePath();
  c.fill();
  c.font = '700 74px "Schibsted Grotesk Variable", "Segoe UI", sans-serif';
  c.textBaseline = 'middle';
  c.fillText('TB', 216, 122);
  c.font = '600 19px "Segoe UI", sans-serif';
  c.fillText('WEINLAND  ·  SEIT IMMER', 70, 180);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function makeCap() {
  const g = new THREE.Group();
  const { bump, color } = cordTextures();
  const mkCord = (repeat: number, tint = 0xffffff) => {
    const m = new THREE.MeshStandardMaterial({ color: tint, map: color.clone(), bumpMap: bump.clone(), bumpScale: 2.2, roughness: 0.95, side: THREE.DoubleSide });
    m.map!.repeat.set(repeat, 1);
    m.bumpMap!.repeat.set(repeat, 1);
    m.map!.needsUpdate = m.bumpMap!.needsUpdate = true;
    return m;
  };
  const p = new THREE.Vector3();

  /* ---------- Krone ---------- */
  const crownGeo = grid((s, t, o) => crown(s * Math.PI * 2, 0.02 + t * 0.98, o), 96, 30, 1, 1, true);
  g.add(new THREE.Mesh(crownGeo, mkCord(12)));
  // Innenfutter, damit man von unten nicht auf die Cord-Rückseite schaut
  const liningGeo = grid((s, t, o) => crown(s * Math.PI * 2, 0.02 + t * 0.98, o, -0.014), 64, 20, 1, 1, true);
  g.add(new THREE.Mesh(liningGeo, new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 1, side: THREE.DoubleSide })));
  const bandGeo = grid((s, t, o) => crown(s * Math.PI * 2, 0.86 + t * 0.14, o, -0.022), 64, 2, 1, 1, true);
  g.add(new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({ color: 0x1d1a17, roughness: 0.9, side: THREE.DoubleSide })));

  // Nähte zwischen den sechs Panels
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x8c5a2b, roughness: 0.9 });
  for (let k = 0; k < 6; k++) {
    const v = (k * Math.PI) / 3;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) pts.push(crown(v, 0.03 + (i / 24) * 0.97, new THREE.Vector3(), 0.006));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.011, 6), seamMat));
  }
  // Saumband am unteren Rand
  const hem: THREE.Vector3[] = [];
  for (let i = 0; i <= 96; i++) hem.push(crown((i / 96) * Math.PI * 2, 1, new THREE.Vector3(), 0.004));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hem, true), 120, 0.018, 6, true), seamMat));

  // Knopf oben
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), mkCord(1));
  button.scale.y = 0.55;
  button.position.copy(crown(0, 0, p)).y += 0.004;
  g.add(button);

  // Luftösen
  const eyeletMat = new THREE.MeshStandardMaterial({ color: 0x3d2613, roughness: 0.6, metalness: 0.3 });
  for (const deg of [90, 150, 210, 270]) {
    const v = (deg * Math.PI) / 180;
    const c0 = crown(v, 0.42, new THREE.Vector3(), 0.004);
    const n = crown(v, 0.42, new THREE.Vector3(), 0.1).sub(c0).normalize();
    const e = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.009, 8, 16), eyeletMat);
    e.position.copy(c0);
    e.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    g.add(e);
  }

  /* ---------- Schirm ---------- */
  const brimMat = mkCord(9);
  const T = 0.045;
  const top = grid((s, t, o) => brim((s * 2 - 1) * BRIM_A, t, o), 64, 14, 1, 1);
  const bottom = grid((s, t, o) => brim((s * 2 - 1) * BRIM_A, t, o, T), 64, 14, 1, 1);
  const edge = grid((s, t, o) => brim((s * 2 - 1) * BRIM_A, 1, o, t * T), 64, 1, 1, 1);
  g.add(new THREE.Mesh(top, brimMat), new THREE.Mesh(bottom, mkCord(9, 0xd9c9b0)), new THREE.Mesh(edge, brimMat));
  // helle Paspel an der Vorderkante + Ziernaht
  const cream = new THREE.MeshStandardMaterial({ color: 0xefe6cf, roughness: 0.8 });
  const line = (d: number, r: number, lift: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const q = brim((i / 64) * 2 * BRIM_A * 0.985 - BRIM_A * 0.985, d, new THREE.Vector3());
      q.y += lift;
      pts.push(q);
    }
    return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, r, 6), cream);
  };
  g.add(line(1, 0.024, -T / 2), line(0.84, 0.008, 0.004));

  /* ---------- Patch vorne ---------- */
  const patchGeo = grid((s, t, o) => crown((s - 0.5) * 0.92, 0.44 + (1 - t) * 0.36, o, 0.024), 20, 10);
  const patch = new THREE.Mesh(patchGeo, new THREE.MeshStandardMaterial({ map: patchTexture(), roughness: 0.85, side: THREE.DoubleSide }));
  g.add(patch);

  /* ---------- Verschluss hinten ---------- */
  const openGeo = grid((s, t, o) => {
    const v = Math.PI + (s - 0.5) * 0.62;
    const arch = Math.sqrt(Math.max(0, 1 - (2 * s - 1) ** 2));
    crown(v, 1 - t * 0.26 * arch, o, 0.006);
  }, 20, 6);
  g.add(new THREE.Mesh(openGeo, new THREE.MeshStandardMaterial({ color: 0x1b120a, roughness: 1, side: THREE.DoubleSide })));
  const strapGeo = grid((s, t, o) => crown(Math.PI + (s - 0.5) * 0.74, 0.985 - t * 0.075, o, 0.012), 20, 2);
  g.add(new THREE.Mesh(strapGeo, new THREE.MeshStandardMaterial({ color: 0x9a6634, roughness: 0.9, side: THREE.DoubleSide })));
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.075, 0.02), new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 1, roughness: 0.3 }));
  buckle.position.copy(crown(Math.PI, 0.95, p, 0.02));
  g.add(buckle);

  // Schwerpunkt in die Mitte rücken, damit sich die Cap schön um sich selbst dreht
  g.position.set(0, -0.3, -0.22);
  const wrap = new THREE.Group();
  wrap.add(g);
  return wrap;
}
