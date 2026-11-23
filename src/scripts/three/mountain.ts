// Sport-Seite: ein kleines Berg-Diorama mit Skilift, das zwischen Winter und Sommer wechselt.
// Im Winter fahren Skifahrer die Piste hinunter, im Sommer Biker den Trail. Der Lift bringt alle wieder hoch.
import * as THREE from 'three';
import { Stage, reducedMotion, damp, COLORS } from './stage';

/* ---------- Rauschen ---------- */
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (t: number) => t * t * (3 - 2 * t);
function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
function fbm(x: number, y: number, oct = 5) {
  let v = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    v += amp * noise(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return v;
}
const ridged = (x: number, y: number) => {
  let v = 0;
  let amp = 0.55;
  let f = 1;
  for (let i = 0; i < 4; i++) {
    v += amp * (1 - Math.abs(noise(x * f, y * f) * 2 - 1));
    f *= 2.1;
    amp *= 0.5;
  }
  return v;
};

const R = 7;
const LAKE = 0.16;
const sstep = (a: number, b: number, x: number) => smooth(THREE.MathUtils.clamp((x - a) / (b - a), 0, 1));

function rawHeight(x: number, z: number) {
  const r = Math.hypot(x, z);
  const mask = sstep(R, R * 0.62, r);
  const peak = (cx: number, cz: number, h: number, w: number) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * w * w));
  let h = peak(-0.6, -0.4, 4.4, 1.55) + peak(2.6, -1.6, 2.7, 1.25) + peak(-3.0, 1.2, 1.9, 1.3) + peak(0.8, 2.6, 0.9, 1.6);
  h *= 0.72 + 0.6 * ridged(x * 0.42 + 3.1, z * 0.42 + 1.7);
  h += fbm(x * 0.5 + 9, z * 0.5 + 4) * 0.9 - 0.25;
  // See im Vordergrund
  h -= 1.1 * Math.exp(-((x - 3.1) ** 2 + (z - 2.9) ** 2) / 2.2);
  return Math.max(h, LAKE - 0.4) * mask;
}
export const heightAt = (x: number, z: number) => Math.max(LAKE, rawHeight(x, z));

export type Season = 'winter' | 'sommer';

export function initMountain(el: HTMLElement, startSeason: Season) {
  const stage = new Stage(el, { fov: 32, envIntensity: 0.45, shadows: true });
  const scene = stage.scene;
  const world = new THREE.Group();
  scene.add(world);

  /* ---------- Licht ---------- */
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(7, 11, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 34 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 5;
  const sky = new THREE.HemisphereLight(0xcfe4ff, 0x5a6b55, 0.9);
  scene.add(sun, sky);

  /* ---------- Gelände: Quadrat-Gitter, auf eine Scheibe abgebildet ---------- */
  const N = 150;
  const geo = new THREE.PlaneGeometry(2, 2, N, N);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const count = pos.count;
  const cWinter = new Float32Array(count * 3);
  const cSummer = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = pos.getX(i);
    const v = pos.getZ(i);
    const x = u * Math.sqrt(1 - (v * v) / 2) * R;
    const z = v * Math.sqrt(1 - (u * u) / 2) * R;
    pos.setXYZ(i, x, heightAt(x, z), z);
  }
  const c = new THREE.Color();
  const tmpC = new THREE.Color();
  const C = (hex: number) => new THREE.Color(hex);
  const snow = C(0xf6f9ff);
  const snowShade = C(0xd5e3f7);
  const rockW = C(0x5c6883);
  const ice = C(0xbfe1f3);
  const grass = C(0x86bf63);
  const meadow = C(0xa9cf6b);
  const forest = C(0x4f8f55);
  const rockS = C(0x8d919b);
  const water = C(0x3fa9de);
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const e = 0.09;
    const slope = Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
    const n = fbm(x * 1.3 + 20, z * 1.3 + 7, 3);
    const lake = rawHeight(x, z) <= LAKE + 0.004 && Math.hypot(x, z) < R * 0.9;
    // Winter: Schnee, an steilen Stellen schaut der Fels durch
    const rockW_ = sstep(1.0, 1.75, slope + (n - 0.5) * 0.7);
    c.copy(snow).lerp(snowShade, THREE.MathUtils.clamp(n * 1.3 - 0.2 + (y < 0.6 ? 0.25 : 0), 0, 1)).lerp(rockW, rockW_);
    if (lake) c.copy(ice);
    cWinter.set([c.r, c.g, c.b], i * 3);
    // Sommer: Wiese → Wald → Fels → Schneekappe
    const forestAmt = sstep(0.9, 1.5, y + n * 0.6);
    const rockS_ = Math.max(sstep(0.95, 1.55, slope + (n - 0.5) * 0.5), sstep(2.4, 3.0, y + n * 0.8));
    const snowAmt = sstep(3.3, 3.75, y + n * 0.5) * (1 - sstep(1.6, 2.1, slope));
    c.copy(grass).lerp(meadow, THREE.MathUtils.clamp(n * 1.6 - 0.3, 0, 1));
    c.lerp(tmpC.copy(forest).lerp(grass, 0.4), forestAmt).lerp(rockS, rockS_).lerp(snow, snowAmt);
    if (lake) c.copy(water);
    cSummer.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
  terrain.castShadow = terrain.receiveShadow = true;
  world.add(terrain);

  const skirtMat = new THREE.MeshStandardMaterial({ color: COLORS.ink, roughness: 0.6 });
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.999, R * 0.93, 0.9, 96, 1, true), skirtMat);
  skirt.position.y = LAKE - 0.45;
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(R * 0.93, 64).rotateX(Math.PI / 2), skirtMat);
  bottom.position.y = LAKE - 0.9;
  world.add(skirt, bottom);

  /* ---------- Bäume ---------- */
  const treeGeo = new THREE.ConeGeometry(0.13, 0.42, 6).translate(0, 0.27, 0);
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3f, flatShading: true, roughness: 0.9 });
  const TREES = 340;
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, TREES);
  trees.castShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let placed = 0;
  let seed = 3;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let tries = 0; placed < TREES && tries < 9000; tries++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * R * 0.9;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = heightAt(x, z);
    const slope = Math.abs(heightAt(x + 0.2, z) - y) + Math.abs(heightAt(x, z + 0.2) - y);
    if (y < LAKE + 0.03 || y > 2.0 || slope > 0.3 || fbm(x * 0.8, z * 0.8, 2) < 0.42) continue;
    const s = 0.75 + rnd() * 0.9;
    m.compose(new THREE.Vector3(x, y - 0.04, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6), new THREE.Vector3(s, s * (0.9 + rnd() * 0.5), s));
    trees.setMatrixAt(placed++, m);
  }
  trees.count = placed;
  world.add(trees);
  const treeWinter = C(0xbcd4cc);
  const treeSummer = C(0x2f6b3f);

  /* ---------- Gipfel-Markierung (wie die Pistenstange auf dem Foto) ---------- */
  const summit = new THREE.Vector3(-0.6, 0, -0.4);
  let best = 0;
  for (let dx = -1; dx <= 1; dx += 0.05)
    for (let dz = -1; dz <= 1; dz += 0.05) {
      const h = heightAt(-0.6 + dx, -0.4 + dz);
      if (h > best) {
        best = h;
        summit.set(-0.6 + dx, h, -0.4 + dz);
      }
    }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), new THREE.MeshStandardMaterial({ color: COLORS.orange, roughness: 0.5 }));
  pole.position.copy(summit).add(new THREE.Vector3(0, 0.3, 0));
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.02), new THREE.MeshStandardMaterial({ color: COLORS.blue, roughness: 0.5 }));
  sign.position.copy(summit).add(new THREE.Vector3(0, 0.55, 0.03));
  pole.castShadow = true;
  world.add(pole, sign);

  /* ---------- Abfahrt / Wanderweg ---------- */
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 90; i++) {
    const t = i / 90;
    const ang = 0.9 + t * 2.4 + Math.sin(t * 16) * 0.16;
    const rad = 0.25 + t * 5.3;
    const x = summit.x + Math.cos(ang) * rad;
    const z = summit.z + Math.sin(ang) * rad;
    pts.push(new THREE.Vector3(x, heightAt(x, z) + 0.05, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const trailMat = new THREE.MeshStandardMaterial({ color: COLORS.blue, roughness: 0.6, emissive: COLORS.blue, emissiveIntensity: 0.25 });
  const trailGeo = new THREE.TubeGeometry(curve, 320, 0.035, 6);
  const trail = new THREE.Mesh(trailGeo, trailMat);
  world.add(trail);
  const trailIndexCount = trailGeo.index!.count;
  /* ---------- Skilift: Talstation → Stützen → Bergstation ---------- */
  const U_TOP = 0.07;
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.55, metalness: 0.35 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: COLORS.orange, roughness: 0.5 });
  const ground = (x: number, z: number) => new THREE.Vector3(x, heightAt(x, z), z);
  const pTop = curve.getPointAt(U_TOP);
  const pBot = curve.getPointAt(1);
  const dir = new THREE.Vector3(pTop.x - pBot.x, 0, pTop.z - pBot.z).normalize();
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const sBot = ground(pBot.x + side.x * 0.5 + dir.x * 0.15, pBot.z + side.z * 0.5 + dir.z * 0.15);
  const sTop = ground(pTop.x + side.x * 0.32, pTop.z + side.z * 0.32);
  const TOWERS = 7;
  const base: THREE.Vector3[] = [];
  const hgt: number[] = [];
  for (let i = 0; i <= TOWERS + 1; i++) {
    const f = i / (TOWERS + 1);
    base.push(ground(THREE.MathUtils.lerp(sBot.x, sTop.x, f), THREE.MathUtils.lerp(sBot.z, sTop.z, f)));
    hgt.push(i === 0 || i === TOWERS + 1 ? 0.42 : 0.72);
  }
  // Stützen so hoch machen, dass das Seil nirgends im Hang verschwindet
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i <= TOWERS; i++) {
      for (let k = 1; k < 6; k++) {
        const f = k / 6;
        const x = THREE.MathUtils.lerp(base[i].x, base[i + 1].x, f);
        const z = THREE.MathUtils.lerp(base[i].z, base[i + 1].z, f);
        const cableY = THREE.MathUtils.lerp(base[i].y + hgt[i], base[i + 1].y + hgt[i + 1], f);
        const lack = heightAt(x, z) + 0.36 - cableY;
        if (lack > 0) {
          if (i > 0) hgt[i] += lack * (1 - f) * 1.1;
          if (i + 1 <= TOWERS) hgt[i + 1] += lack * f * 1.1;
        }
      }
    }
  }
  const centre = base.map((b, i) => new THREE.Vector3(b.x, b.y + hgt[i], b.z));
  const yaw = Math.atan2(-dir.z, dir.x);
  for (let i = 1; i <= TOWERS; i++) {
    const h = hgt[i] + 0.2;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.034, h, 8), steel);
    mast.position.set(base[i].x, base[i].y + h / 2 - 0.2, base[i].z);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.3), steel);
    arm.position.copy(centre[i]);
    arm.rotation.y = yaw;
    mast.castShadow = true;
    world.add(mast, arm);
  }
  const station = (at: THREE.Vector3, cableY: number) => {
    const g = new THREE.Group();
    const house = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.4), new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.8 }));
    house.position.y = 0.1;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.5), orangeMat);
    roof.position.y = 0.25;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, cableY - at.y, 8), steel);
    post.position.y = (cableY - at.y) / 2;
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 20), steel);
    wheel.position.y = cableY - at.y;
    g.add(house, roof, post, wheel);
    g.traverse((o) => (o.castShadow = true));
    g.position.copy(at);
    g.rotation.y = yaw;
    world.add(g);
    return wheel;
  };
  const wheels = [station(sBot, centre[0].y), station(sTop, centre[TOWERS + 1].y)];
  const HALF = 0.1;
  for (const sign of [1, -1]) {
    const linePts = centre.map((c) => c.clone().addScaledVector(side, HALF * sign));
    world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({ color: 0x2a3142 })));
  }
  const cum = [0];
  for (let i = 1; i < centre.length; i++) cum.push(cum[i - 1] + centre[i].distanceTo(centre[i - 1]));
  const liftLen = cum[cum.length - 1];
  /** Punkt auf dem Umlauf: 0 … 0.5 = bergauf, 0.5 … 1 = talwärts */
  const liftPoint = (q: number, out: THREE.Vector3) => {
    const up = q < 0.5;
    const f = up ? q * 2 : (1 - q) * 2;
    const d = f * liftLen;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const k = (d - cum[i - 1]) / (cum[i] - cum[i - 1]);
    return out.copy(centre[i - 1]).lerp(centre[i], k).addScaledVector(side, up ? HALF : -HALF);
  };
  const CHAIRS = 10;
  const chairs: THREE.Group[] = [];
  const taken: boolean[] = [];
  const chairS: number[] = [];
  for (let i = 0; i < CHAIRS; i++) {
    const c = new THREE.Group();
    const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), steel);
    hanger.position.y = -0.1;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.016, 0.2), orangeMat);
    seat.position.y = -0.2;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.08, 0.2), steel);
    back.position.set(-0.035, -0.16, 0);
    c.add(hanger, seat, back);
    world.add(c);
    chairs.push(c);
    taken.push(false);
    chairS.push(i / CHAIRS);
  }

  /* ---------- Skifahrer (Winter) bzw. Biker (Sommer) ---------- */
  interface Rider {
    g: THREE.Group;
    skis: THREE.Object3D;
    bike: THREE.Object3D;
    body: THREE.Object3D;
    state: 'run' | 'wait' | 'lift';
    u: number;
    chair: number;
    pace: number;
  }
  const mkRider = (helmetColor: number, jacket: number, u: number, pace: number): Rider => {
    const g = new THREE.Group();
    const body = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.11, 4, 8), new THREE.MeshStandardMaterial({ color: jacket, roughness: 0.6 }));
    torso.position.y = 0.14;
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.054, 12, 10), new THREE.MeshStandardMaterial({ color: helmetColor, roughness: 0.4 }));
    helmet.position.y = 0.285;
    body.add(torso, helmet);
    const skis = new THREE.Group();
    for (const z of [-0.035, 0.035]) {
      const ski = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.028), steel);
      ski.position.set(0.02, 0.008, z);
      skis.add(ski);
    }
    const bike = new THREE.Group();
    for (const x of [-0.11, 0.11]) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.014, 6, 14), steel);
      w.position.set(x, 0.075, 0);
      bike.add(w);
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.02, 0.02), orangeMat);
    frame.position.y = 0.12;
    bike.add(frame);
    g.add(body, skis, bike);
    g.traverse((o) => (o.castShadow = true));
    g.scale.setScalar(1.2);
    world.add(g);
    return { g, skis, bike, body, state: 'run', u, chair: -1, pace };
  };
  const riders: Rider[] = [
    mkRider(COLORS.orange, 0x5a4a32, 0.3, 1), // das bin ich: oranger Helm
    mkRider(0xf2f2f2, 0x6f8f86, 0.62, 0.88),
    mkRider(COLORS.blue, 0xb8433a, 0.85, 1.12),
    mkRider(0xf0c53a, 0x2d3b55, 0.12, 0.95),
    mkRider(0x7bd3c8, 0x3a3340, 0.45, 1.05),
    mkRider(0xe9e4d8, 0x8a5a3c, 0.74, 0.92),
  ];
  const runLen = curve.getLength();
  const tmpV = new THREE.Vector3();
  const updateLift = (dt: number) => {
    const liftSpeed = 0.75 / (2 * liftLen);
    wheels.forEach((w) => (w.rotation.y += dt * 4));
    for (let i = 0; i < CHAIRS; i++) {
      const before = chairS[i];
      chairS[i] = (before + dt * liftSpeed) % 1;
      liftPoint(chairS[i], chairs[i].position);
      chairs[i].rotation.y = chairS[i] < 0.5 ? yaw : yaw + Math.PI;
      // Sessel fährt gerade durch die Talstation → der Nächste in der Schlange steigt ein
      if (chairS[i] < before && !taken[i]) {
        const next = riders.find((r) => r.state === 'wait');
        if (next) {
          next.state = 'lift';
          next.chair = i;
          taken[i] = true;
        }
      }
    }
    let queue = 0;
    for (const r of riders) {
      if (r.state === 'run') {
        const v = THREE.MathUtils.lerp(1.55, 1.15, s) * r.pace;
        r.u += (dt * v) / runLen;
        if (r.u >= 1) {
          r.u = 1;
          r.state = 'wait';
        }
        const u = Math.min(1, r.u);
        r.g.position.copy(curve.getPointAt(u));
        r.g.position.y -= 0.04;
        const tan = curve.getTangentAt(u);
        r.g.rotation.set(0, Math.atan2(-tan.z, tan.x), Math.asin(THREE.MathUtils.clamp(tan.y, -0.9, 0.9)));
      } else if (r.state === 'wait') {
        liftPoint(0, tmpV);
        const wx = tmpV.x - dir.x * 0.16 * queue;
        const wz = tmpV.z - dir.z * 0.16 * queue;
        r.g.position.set(wx, heightAt(wx, wz), wz);
        r.g.rotation.set(0, yaw, 0);
        queue++;
      } else {
        const c = chairs[r.chair];
        r.g.position.set(c.position.x, c.position.y - 0.34, c.position.z);
        r.g.rotation.set(0, yaw, 0);
        if (chairS[r.chair] >= 0.5) {
          taken[r.chair] = false;
          r.chair = -1;
          r.state = 'run';
          r.u = U_TOP;
        }
      }
    }
  };

  /* ---------- Berghütte mit rauchendem Kamin ---------- */
  let hutAt: THREE.Vector3 | null = null;
  let hutScore = 9;
  for (let i = 0; i < 700; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 2.4 + rnd() * 2.8;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const y = heightAt(x, z);
    if (y < 0.45 || y > 1.5) continue;
    const slope = Math.abs(heightAt(x + 0.25, z) - y) + Math.abs(heightAt(x, z + 0.25) - y) + Math.abs(heightAt(x - 0.25, z) - y);
    let near = 99;
    for (let k = 0; k < pts.length; k += 3) near = Math.min(near, Math.hypot(pts[k].x - x, pts[k].z - z));
    for (const c of centre) near = Math.min(near, Math.hypot(c.x - x, c.z - z));
    if (near < 1.1) continue;
    if (slope < hutScore) {
      hutScore = slope;
      hutAt = new THREE.Vector3(x, y, z);
    }
  }
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b3a2a, roughness: 0.8 });
  const smoke: THREE.Mesh[] = [];
  if (hutAt) {
    const hut = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.38), new THREE.MeshStandardMaterial({ color: 0xa9713f, roughness: 0.85 }));
    walls.position.y = 0.11;
    const tri = new THREE.Shape();
    tri.moveTo(-0.32, 0);
    tri.lineTo(0.32, 0);
    tri.lineTo(0, 0.24);
    tri.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.48, bevelEnabled: false }), roofMat);
    roof.position.set(0, 0.24, -0.24);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), new THREE.MeshStandardMaterial({ color: 0x77706a, roughness: 0.9 }));
    chimney.position.set(0.14, 0.42, 0.05);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.02), new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb84a, emissiveIntensity: 1.3 }));
    win.position.set(-0.1, 0.13, 0.195);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.02), new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.9 }));
    door.position.set(0.1, 0.07, 0.195);
    hut.add(walls, roof, chimney, win, door);
    hut.traverse((o) => (o.castShadow = true));
    hut.position.copy(hutAt);
    hut.position.y -= 0.03;
    hut.rotation.y = Math.atan2(hutAt.x, hutAt.z);
    hut.scale.setScalar(1.25);
    world.add(hut);
    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
      puff.userData.o = new THREE.Vector3(0.14, 0.52, 0.05).multiplyScalar(1.25).applyAxisAngle(new THREE.Vector3(0, 1, 0), hut.rotation.y).add(hut.position);
      smoke.push(puff);
      world.add(puff);
    }
  }

  /* ---------- Wolken ---------- */
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const clouds: THREE.Group[] = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 + rnd() * 0.36, 1), cloudMat);
      s.position.set((k - n / 2) * 0.55, rnd() * 0.2, rnd() * 0.4);
      s.scale.y = 0.7;
      s.castShadow = true;
      g.add(s);
    }
    g.userData = { a: rnd() * 6.28, r: 3 + rnd() * 3.4, y: 4.6 + rnd() * 1.6, sp: 0.03 + rnd() * 0.04 };
    clouds.push(g);
    world.add(g);
  }

  /* ---------- Schnee ---------- */
  const FL = 900;
  const flake = new Float32Array(FL * 3);
  for (let i = 0; i < FL; i++) flake.set([(rnd() - 0.5) * 16, rnd() * 9, (rnd() - 0.5) * 16], i * 3);
  const flakeGeo = new THREE.BufferGeometry();
  flakeGeo.setAttribute('position', new THREE.BufferAttribute(flake, 3));
  const flakeMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.075, transparent: true, opacity: 0.9, depthWrite: false });
  const flakes = new THREE.Points(flakeGeo, flakeMat);
  flakes.frustumCulled = false;
  scene.add(flakes);

  /* ---------- Kamera + Drehteller ---------- */
  const layout = () => {
    const narrow = stage.width < 760;
    if (narrow) {
      stage.camera.position.set(0, 9, 27);
      stage.camera.lookAt(0, 4.6, 0);
      world.position.set(0, 0, 0);
      world.scale.setScalar(0.66);
    } else {
      stage.camera.position.set(0, 8.4, 22);
      stage.camera.lookAt(0, 2.2, 0);
      world.position.set(Math.min(3.4, stage.viewAt(0).w * 0.16), 0, 0);
      world.scale.setScalar(1);
    }
  };
  stage.onResize(layout);

  let rotY = -0.5;
  let rotV = 0;
  let dragging = false;
  let lastX = 0;
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    rotV = dx * 0.006 * 60;
    rotY += dx * 0.006;
  });
  const end = () => {
    dragging = false;
    el.classList.remove('is-dragging');
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  /* ---------- Saison ---------- */
  let target = startSeason === 'sommer' ? 1 : 0;
  let s = target;
  let applied = -1;
  const sunW = C(0xeaf3ff);
  const sunS = C(0xfff1d6);
  const trailW = C(COLORS.blue);
  const trailS = C(0xe9a23b);
  const apply = () => {
    for (let i = 0; i < col.length; i++) col[i] = cWinter[i] + (cSummer[i] - cWinter[i]) * s;
    geo.attributes.color.needsUpdate = true;
    treeMat.color.copy(treeWinter).lerp(treeSummer, s);
    flakeMat.opacity = 0.9 * (1 - s);
    flakes.visible = s < 0.98;
    sun.color.copy(sunW).lerp(sunS, s);
    sky.groundColor.set(0x8fa3c4).lerp(C(0x5a7a4a), s);
    trailMat.color.copy(trailW).lerp(trailS, s);
    trailMat.emissive.copy(trailMat.color);
    for (const r of riders) {
      r.skis.visible = s < 0.5;
      r.bike.visible = s >= 0.5;
      r.body.position.y = s >= 0.5 ? 0.09 : 0;
    }
    roofMat.color.set(0xf4f7fc).lerp(C(0x6b3a2a), s);
    applied = s;
  };
  apply();

  let draw = reducedMotion ? 1 : 0;
  stage.onFrame((dt, t) => {
    s = damp(s, target, 3.2, dt);
    if (Math.abs(s - target) < 0.002) s = target;
    if (Math.abs(s - applied) > 0.001) apply();

    if (!dragging) {
      rotV = damp(rotV, reducedMotion ? 0 : 0.07, 2, dt);
      rotY += rotV * dt;
    }
    world.rotation.y = rotY;

    draw = Math.min(1, draw + dt * 0.35);
    trailGeo.setDrawRange(0, Math.floor((trailIndexCount * draw) / 3) * 3);

    updateLift(dt);
    smoke.forEach((p, i) => {
      const k = (t * 0.22 + i / smoke.length) % 1;
      const o = p.userData.o as THREE.Vector3;
      p.position.set(o.x + Math.sin(k * 5 + i) * 0.05 + k * 0.12, o.y + k * 0.75, o.z);
      p.scale.setScalar(0.035 + k * 0.1);
      (p.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
    });

    for (const g of clouds) {
      const u = g.userData;
      u.a += dt * u.sp * (reducedMotion ? 0 : 1);
      g.position.set(Math.cos(u.a) * u.r, u.y, Math.sin(u.a) * u.r);
      g.rotation.y = -u.a;
    }

    if (flakes.visible && !reducedMotion) {
      for (let i = 0; i < FL; i++) {
        let y = flake[i * 3 + 1] - dt * (0.7 + (i % 5) * 0.12);
        if (y < 0) y += 9;
        flake[i * 3 + 1] = y;
        flake[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.12;
      }
      flakeGeo.attributes.position.needsUpdate = true;
    }
  });

  return {
    stage,
    setSeason(season: Season) {
      target = season === 'sommer' ? 1 : 0;
    },
  };
}
