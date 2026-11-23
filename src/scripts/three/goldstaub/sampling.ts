// Aus Objekten und Bildern werden Punktwolken: jede Form bekommt gleich viele Punkte,
// damit die Goldpartikel von einer Form zur nächsten fliegen können.
import * as THREE from 'three';

/** kleiner, reproduzierbarer Zufallsgenerator (gleicher Seed = gleiche Punkte) */
export function mulberry32(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PointSet {
  /** N × (x, y, z, Helligkeit) im Koordinatensystem der Form */
  data: Float32Array;
  min: THREE.Vector3;
  size: THREE.Vector3;
}

function bounds(data: Float32Array): Pick<PointSet, 'min' | 'size'> {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < data.length; i += 4) {
    min.x = Math.min(min.x, data[i]);
    min.y = Math.min(min.y, data[i + 1]);
    min.z = Math.min(min.z, data[i + 2]);
    max.x = Math.max(max.x, data[i]);
    max.y = Math.max(max.y, data[i + 1]);
    max.z = Math.max(max.z, data[i + 2]);
  }
  const size = max.sub(min);
  size.x = Math.max(size.x, 1e-3);
  size.y = Math.max(size.y, 1e-3);
  size.z = Math.max(size.z, 1e-3);
  return { min, size };
}

/**
 * Punkte gleichmässig auf der Oberfläche aller Meshes einer Gruppe verteilen.
 * Flächen, die zur Kamera schauen, bekommen mehr Punkte; `mesh.userData.dust` steuert die Helligkeit.
 */
export function sampleObject(root: THREE.Object3D, N: number, rng: () => number, viewDir = new THREE.Vector3(0, 0, 1)): PointSet {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const light = viewDir.clone().add(new THREE.Vector3(-0.35, 0.6, 0.25)).normalize();
  const tri: number[] = [];
  const cum: number[] = [];
  let total = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const e = new THREE.Vector3();
  const m = new THREE.Matrix4();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.noDust || !mesh.geometry?.attributes.position) return;
    const pos = mesh.geometry.attributes.position;
    const idx = mesh.geometry.index;
    const bright = (mesh.userData.dust as number | undefined) ?? 1;
    m.multiplyMatrices(inv, mesh.matrixWorld);
    const count = idx ? idx.count : pos.count;
    for (let i = 0; i + 2 < count; i += 3) {
      a.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m);
      b.fromBufferAttribute(pos, idx ? idx.getX(i + 1) : i + 1).applyMatrix4(m);
      c.fromBufferAttribute(pos, idx ? idx.getX(i + 2) : i + 2).applyMatrix4(m);
      n.subVectors(b, a).cross(e.subVectors(c, a));
      const area = n.length() / 2;
      if (area < 1e-8) continue;
      n.normalize();
      total += area * (0.25 + 0.75 * Math.max(0, n.dot(viewDir)));
      cum.push(total);
      tri.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, bright * (0.3 + 0.7 * Math.max(0, n.dot(light))));
    }
  });
  const data = new Float32Array(N * 4);
  if (!cum.length) return { data, ...bounds(data) };
  for (let i = 0; i < N; i++) {
    const r = rng() * total;
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const t = lo * 10;
    const r1 = Math.sqrt(rng());
    const r2 = rng();
    const wa = 1 - r1;
    const wb = r1 * (1 - r2);
    const wc = r1 * r2;
    data[i * 4] = tri[t] * wa + tri[t + 3] * wb + tri[t + 6] * wc;
    data[i * 4 + 1] = tri[t + 1] * wa + tri[t + 4] * wb + tri[t + 7] * wc;
    data[i * 4 + 2] = tri[t + 2] * wa + tri[t + 5] * wb + tri[t + 8] * wc;
    data[i * 4 + 3] = tri[t + 9];
  }
  return { data, ...bounds(data) };
}

/**
 * Punkte aus einem Bild: helle Stellen und Kanten bekommen mehr Punkte.
 * Der gleichmässige Studio-Hintergrund wird vom Rand her weggefüllt, damit nur die Person bleibt.
 * Gibt zusätzlich die Maske zurück (weiss = Person), z. B. als Alpha für das echte Foto.
 */
export function sampleImage(source: HTMLCanvasElement, N: number, rng: () => number, height: number) {
  const W = 200;
  const H = Math.round((W * source.height) / source.width);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  const lum = new Float32Array(W * H);
  const sat = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = px[i * 4];
    const g = px[i * 4 + 1];
    const bl = px[i * 4 + 2];
    lum[i] = (0.299 * r + 0.587 * g + 0.114 * bl) / 255;
    sat[i] = (Math.max(r, g, bl) - Math.min(r, g, bl)) / 255;
  }
  // Helligkeit des Hintergrunds: Median der oberen Randzeile und der oberen Seitenränder
  const edgeLum: number[] = [];
  for (let x = 0; x < W; x++) edgeLum.push(lum[x]);
  for (let y = 0; y < H * 0.5; y++) edgeLum.push(lum[y * W], lum[y * W + W - 1]);
  edgeLum.sort((p, q) => p - q);
  const bgLum = edgeLum[edgeLum.length >> 1];

  // Flood-Fill vom Rand: grau, ähnlich hell wie der Hintergrund und ohne harte Kante zum Nachbarn
  const bg = new Uint8Array(W * H);
  const stack: number[] = [];
  const isBg = (i: number, from: number) => sat[i] < 0.16 && Math.abs(lum[i] - bgLum) < 0.2 && Math.abs(lum[i] - lum[from]) < 0.045;
  const seed = (i: number) => {
    if (!bg[i] && sat[i] < 0.16 && Math.abs(lum[i] - bgLum) < 0.2) {
      bg[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < W; x++) seed(x);
  for (let y = 0; y < H * 0.7; y++) {
    seed(y * W);
    seed(y * W + W - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % W;
    const y = (i / W) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
    for (const j of nb) {
      if (j >= 0 && !bg[j] && isBg(j, i)) {
        bg[j] = 1;
        stack.push(j);
      }
    }
  }
  let person = 0;
  for (let i = 0; i < W * H; i++) person += bg[i] ? 0 : 1;
  const frac = person / (W * H);
  const useMask = frac > 0.15 && frac < 0.85;

  // unten läuft das Bild weich aus statt mit einer harten Kante
  const fadeY = (y: number) => {
    const t = Math.min(1, Math.max(0, (H - 1 - y) / (H * 0.2)));
    return t * t * (3 - 2 * t);
  };

  // Dichte: Maske × (Grundwert + Helligkeit + Kanten)
  const dens = new Float32Array(W * H);
  let total = 0;
  const cum = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      let edge = 0;
      if (x > 0 && x < W - 1 && y > 0 && y < H - 1) {
        const gx = lum[i + 1] - lum[i - 1];
        const gy = lum[i + W] - lum[i - W];
        edge = Math.min(1, Math.hypot(gx, gy) * 4);
      }
      const inside = (useMask ? (bg[i] ? 0 : 1) : 1) * fadeY(y);
      dens[i] = inside * (0.2 + 0.6 * lum[i] + 0.55 * edge);
      total += dens[i];
      cum[i] = total;
    }
  }
  const w = (height * W) / H;
  const data = new Float32Array(N * 4);
  for (let k = 0; k < N; k++) {
    const r = rng() * total;
    let lo = 0;
    let hi = W * H - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    const x = (lo % W) + rng();
    const y = ((lo / W) | 0) + rng();
    data[k * 4] = (x / W - 0.5) * w;
    data[k * 4 + 1] = (0.5 - y / H) * height;
    data[k * 4 + 2] = (lum[lo] - 0.5) * 0.16 + (rng() - 0.5) * 0.03;
    data[k * 4 + 3] = Math.min(1.25, 0.3 + 1.05 * lum[lo]);
  }

  // weich gezeichnete Maske für das echte Foto
  let mask: HTMLCanvasElement | null = null;
  if (useMask) {
    const raw = document.createElement('canvas');
    raw.width = W;
    raw.height = H;
    const rctx = raw.getContext('2d')!;
    const img = rctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const v = bg[i] ? 0 : Math.round(255 * fadeY((i / W) | 0));
      img.data.set([v, v, v, 255], i * 4);
    }
    rctx.putImageData(img, 0, 0);
    mask = document.createElement('canvas');
    mask.width = W * 2;
    mask.height = H * 2;
    const mctx = mask.getContext('2d')!;
    mctx.fillStyle = '#000';
    mctx.fillRect(0, 0, mask.width, mask.height);
    mctx.filter = 'blur(3px)';
    mctx.drawImage(raw, 0, 0, mask.width, mask.height);
  }
  return { set: { data, ...bounds(data) } as PointSet, mask, width: w, height };
}

/** Position auf der Hilbert-Kurve: benachbarte Werte liegen auch im Bild nah beieinander */
function hilbert(x: number, y: number, order = 10) {
  const n = 1 << order;
  let d = 0;
  for (let s = n >> 1; s > 0; s >>= 1) {
    const rx = (x & s) > 0 ? 1 : 0;
    const ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        x = n - 1 - x;
        y = n - 1 - y;
      }
      const t = x;
      x = y;
      y = t;
    }
  }
  return d;
}

/**
 * Punkte aller Formen einander zuordnen: jede Form wird entlang der Hilbert-Kurve sortiert,
 * so fliegt «oben links» zu «oben links». Danach werden alle gleich gemischt, damit jeder
 * Ausschnitt der Liste gleichmässig über die Form verteilt ist.
 */
export function arrange(sets: PointSet[], rng: () => number) {
  if (!sets.length) return;
  const N = sets[0].data.length / 4;
  const perm = Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (const set of sets) {
    const d = set.data;
    const key = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const x = Math.min(1023, Math.max(0, Math.floor(((d[i * 4] - set.min.x) / set.size.x) * 1023 + (rng() - 0.5) * 6)));
      const y = Math.min(1023, Math.max(0, Math.floor(((d[i * 4 + 1] - set.min.y) / set.size.y) * 1023 + (rng() - 0.5) * 6)));
      key[i] = hilbert(x, y);
    }
    const order = Array.from({ length: N }, (_, i) => i).sort((p, q) => key[p] - key[q]);
    const out = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      const src = order[perm[i]] * 4;
      out[i * 4] = d[src];
      out[i * 4 + 1] = d[src + 1];
      out[i * 4 + 2] = d[src + 2];
      out[i * 4 + 3] = d[src + 3];
    }
    set.data = out;
  }
}
