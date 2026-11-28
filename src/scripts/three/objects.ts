// Kleine, prozedural gebaute «Clay»-Objekte – jedes steht für einen Teil von Tims Welt.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLORS, clay } from './stage';
import { makeLogoT } from './logo';

const box = (w: number, h: number, d: number, r: number, mat: THREE.Material) =>
  new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat);

/* ---------- Plektrum mit dem Logo-T ---------- */
const PICK_GOLD = 0xe2a437;
export function makePick(color = PICK_GOLD, mark = color === PICK_GOLD ? COLORS.ink : COLORS.white) {
  const s = new THREE.Shape();
  s.moveTo(-0.52, 0.78);
  s.quadraticCurveTo(0, 0.98, 0.52, 0.78);
  s.bezierCurveTo(0.95, 0.6, 0.92, 0.1, 0.62, -0.35);
  s.quadraticCurveTo(0.3, -0.85, 0.12, -1.0);
  s.quadraticCurveTo(0, -1.1, -0.12, -1.0);
  s.quadraticCurveTo(-0.3, -0.85, -0.62, -0.35);
  s.bezierCurveTo(-0.92, 0.1, -0.95, 0.6, -0.52, 0.78);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.05, bevelSegments: 5, curveSegments: 24 });
  geo.translate(0, 0.05, -0.025);
  const g = new THREE.Group();
  const body =
    color === PICK_GOLD
      ? new THREE.MeshPhysicalMaterial({ color, metalness: 0.65, roughness: 0.36, clearcoat: 0.7, clearcoatRoughness: 0.2 })
      : clay(color, { roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
  g.add(new THREE.Mesh(geo, body));
  const markMat = clay(mark, { roughness: 0.35 });
  for (const side of [1, -1]) {
    const t = makeLogoT(markMat, 0.98);
    t.scale.z = 0.3;
    t.position.set(0, 0.12, 0.072 * side);
    t.rotation.y = side > 0 ? 0 : Math.PI;
    g.add(t);
  }
  return g;
}

/* ---------- Golfball (mit echten Dellen) + Tee ---------- */
export function makeGolfBall(withTee = true) {
  let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(0.62, 22);
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo, 1e-4);
  const N = 190;
  const centers: THREE.Vector3[] = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const r = Math.sqrt(1 - y * y);
    const phi = i * Math.PI * (3 - Math.sqrt(5));
    centers.push(new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r));
  }
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  const dimple = 0.115;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let best = -1;
    for (const cc of centers) {
      const d = v.dot(cc);
      if (d > best) best = d;
    }
    const ang = Math.acos(Math.min(1, best));
    const k = Math.max(0, 1 - ang / dimple);
    const depth = 0.022 * (k * k * (3 - 2 * k));
    v.multiplyScalar(0.62 - depth);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const g = new THREE.Group();
  const ball = new THREE.Mesh(geo, clay(COLORS.white, { roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
  g.add(ball);
  if (withTee) {
    const pts = [
      [0.0, -1.55], [0.045, -1.5], [0.06, -0.9], [0.075, -0.72], [0.2, -0.6], [0.24, -0.55], [0.16, -0.56], [0.0, -0.6],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const tee = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), clay(COLORS.orange, { roughness: 0.4 }));
    g.add(tee);
    g.position.y = 0.3;
  }
  const wrap = new THREE.Group();
  wrap.add(g);
  return wrap;
}

/* ---------- Tischtennis-Schläger + Ball ---------- */
export function makePaddle(withBall = true) {
  const g = new THREE.Group();
  const wood = clay(COLORS.wood, { roughness: 0.55, clearcoat: 0.3 });
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.07, 56).rotateX(Math.PI / 2), wood);
  blade.scale.y = 1.06;
  const red = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.035, 56).rotateX(Math.PI / 2), clay(0xe5382b, { roughness: 0.65, clearcoat: 0.15 }));
  red.scale.y = 1.06;
  red.position.z = 0.05;
  const black = new THREE.Mesh(red.geometry, clay(0x16181d, { roughness: 0.65, clearcoat: 0.15 }));
  black.scale.y = 1.06;
  black.position.z = -0.05;
  const hGeo = new RoundedBoxGeometry(0.26, 0.9, 0.22, 4, 0.08);
  const hp = hGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const t = THREE.MathUtils.clamp(0.5 - hp.getY(i) / 0.9, 0, 1);
    hp.setX(i, hp.getX(i) * (1 + 0.32 * t * t));
  }
  hGeo.computeVertexNormals();
  const handle = new THREE.Mesh(hGeo, wood);
  handle.position.y = -1.14;
  const neck = box(0.34, 0.26, 0.12, 0.04, wood);
  neck.position.y = -0.78;
  g.add(blade, red, black, handle, neck);
  g.position.y = 0.35;
  const wrap = new THREE.Group();
  wrap.add(g);
  if (withBall) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 24), clay(0xff9b3d, { roughness: 0.4 }));
    ball.position.set(0.72, 0.95, 0.5);
    ball.name = 'ball';
    wrap.add(ball);
  }
  return wrap;
}

/* ---------- Browser-Fenster (Wendico) ---------- */
export function makeBrowser() {
  const g = new THREE.Group();
  g.add(box(2.1, 1.5, 0.14, 0.1, clay(COLORS.white, { roughness: 0.35 })));
  // Browserfenster für den Plattform-Stack der Arbeit-Seite, in den Farben der Swisscom-Welt
  const bar = box(1.94, 0.24, 0.03, 0.012, clay(0x001155, { roughness: 0.4 }));
  bar.position.set(0, 0.53, 0.075);
  g.add(bar);
  [0xffffff, 0xb9d4ff, 0x1fb9ff].forEach((c, i) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), clay(c, { roughness: 0.3 }));
    d.scale.z = 0.5;
    d.position.set(-0.82 + i * 0.15, 0.53, 0.095);
    g.add(d);
  });
  const hero = box(0.86, 0.72, 0.05, 0.04, clay(0x0445c8, { roughness: 0.3 }));
  hero.position.set(-0.46, -0.08, 0.08);
  g.add(hero);
  const grey = clay(0xcfd3dc, { roughness: 0.5 });
  [0.62, 0.78, 0.5].forEach((w, i) => {
    const line = box(w, 0.085, 0.03, 0.014, i === 0 ? clay(0x001155, { roughness: 0.5 }) : grey);
    line.position.set(0.1 + w / 2, 0.18 - i * 0.17, 0.08);
    g.add(line);
  });
  const btn = box(0.42, 0.16, 0.05, 0.024, clay(0x1fb9ff, { roughness: 0.3 }));
  btn.position.set(0.31, -0.36, 0.085);
  g.add(btn);
  return g;
}
