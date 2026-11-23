// Der Plattform-Stack als Modell: vier Ebenen (Netzwerk, Cloud, Plattform, Web & Apps)
// mit Eck-Stützen und wandernden Datenpaketen. Genutzt auf der Arbeit-Seite (interaktiv)
// und in der Goldstaub-Story der Startseite.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { clay, COLORS, damp } from './stage';
import { makeBrowser } from './objects';

export function buildStackModel() {
  const root = new THREE.Group();
  const rig = root;

  const S = 3.3;
  const T = 0.3;
  const rb = (w: number, h: number, d: number, r: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat);
    m.castShadow = true;
    return m;
  };
  const glow = (c: number, i = 1.6) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i });

  const layers: { g: THREE.Group; y: number; lift: number; spin?: THREE.Object3D[] }[] = [];
  const mkLayer = (color: number) => {
    const g = new THREE.Group();
    const slab = rb(S, T, S, 0.12, clay(color, { roughness: 0.38 }));
    slab.receiveShadow = true;
    g.add(slab);
    rig.add(g);
    const l = { g, y: 0, lift: 0, spin: [] as THREE.Object3D[] };
    layers.push(l);
    return l;
  };

  // 0 Netzwerk: Knoten und Leitungen
  {
    const l = mkLayer(COLORS.ink);
    const nodes: [number, number][] = [[-1.1, -1.0], [0.2, -1.15], [1.1, -0.5], [-0.6, 0.1], [0.55, 0.35], [-1.15, 1.05], [0.1, 1.15], [1.15, 1.0]];
    const links = [[0, 1], [1, 2], [0, 3], [3, 4], [2, 4], [3, 5], [4, 6], [5, 6], [6, 7], [4, 7]];
    const lineMat = clay(0x3b4a72, { roughness: 0.5 });
    for (const [a, b] of links) {
      const A = new THREE.Vector3(nodes[a][0], T / 2 + 0.02, nodes[a][1]);
      const B = new THREE.Vector3(nodes[b][0], T / 2 + 0.02, nodes[b][1]);
      const seg = new THREE.Mesh(new THREE.BoxGeometry(A.distanceTo(B), 0.03, 0.05), lineMat);
      seg.position.copy(A).lerp(B, 0.5);
      seg.rotation.y = -Math.atan2(B.z - A.z, B.x - A.x);
      l.g.add(seg);
    }
    nodes.forEach(([x, z], i) => {
      const n = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), glow(i % 3 === 0 ? COLORS.orange : COLORS.teal, 1.2));
      n.position.set(x, T / 2 + 0.07, z);
      n.castShadow = true;
      l.g.add(n);
    });
  }
  // 1 Cloud: Server-Racks
  {
    const l = mkLayer(COLORS.blue);
    for (let i = 0; i < 6; i++) {
      const x = -1.0 + (i % 3) * 1.0;
      const z = i < 3 ? -0.7 : 0.7;
      const rack = rb(0.7, 0.42, 0.9, 0.07, clay(COLORS.white, { roughness: 0.35 }));
      rack.position.set(x, T / 2 + 0.21, z);
      l.g.add(rack);
      for (let k = 0; k < 3; k++) {
        const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), glow(k === 0 ? COLORS.orange : COLORS.teal));
        led.position.set(x - 0.2 + k * 0.1, T / 2 + 0.3, z + 0.455);
        l.g.add(led);
      }
    }
  }
  // 2 Plattform: Zahnräder + Pipeline
  {
    const l = mkLayer(COLORS.white);
    const gear = (r: number, color: number) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 28), clay(color, { roughness: 0.35 }));
      body.castShadow = true;
      g.add(body);
      const teeth = Math.round(r * 16);
      for (let i = 0; i < teeth; i++) {
        const t = rb(0.16, 0.16, 0.2, 0.03, body.material as THREE.Material);
        const a = (i / teeth) * Math.PI * 2;
        t.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        t.rotation.y = -a;
        g.add(t);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, 0.2, 16), clay(COLORS.white, { roughness: 0.3 }));
      g.add(hub);
      return g;
    };
    const g1 = gear(0.62, COLORS.orange);
    g1.position.set(-0.75, T / 2 + 0.1, -0.5);
    const g2 = gear(0.42, COLORS.ink);
    g2.position.set(0.3, T / 2 + 0.1, -0.02);
    const g3 = gear(0.34, COLORS.blue);
    g3.position.set(0.98, T / 2 + 0.1, 0.5);
    l.g.add(g1, g2, g3);
    l.spin = [g1, g2, g3];
    const pipe = rb(2.3, 0.14, 0.2, 0.06, clay(COLORS.maple, { roughness: 0.4 }));
    pipe.position.set(-0.2, T / 2 + 0.07, 1.15);
    l.g.add(pipe);
  }
  // 3 Web & Apps: Browser + Handy
  {
    const l = mkLayer(COLORS.maple);
    const br = makeBrowser();
    br.traverse((o) => ((o as THREE.Mesh).castShadow = true));
    br.scale.setScalar(0.95);
    br.rotation.set(-0.5, 0, 0);
    br.position.set(-0.4, T / 2 + 0.75, -0.25);
    const phone = rb(0.5, 0.98, 0.08, 0.07, clay(COLORS.ink, { roughness: 0.3 }));
    phone.position.set(1.05, T / 2 + 0.5, 0.75);
    phone.rotation.set(-0.5, -0.25, 0);
    const screen = rb(0.42, 0.86, 0.02, 0.05, glow(COLORS.blue, 0.5));
    screen.position.set(1.05, T / 2 + 0.52, 0.79);
    screen.rotation.copy(phone.rotation);
    l.g.add(br, phone, screen);
  }

  // Eck-Stützen mit «Datenpaketen»
  const postMat = clay(0xc9cdd6, { roughness: 0.5, transparent: true, opacity: 0.55 });
  const posts: THREE.Mesh[] = [];
  const packets: { m: THREE.Mesh; post: number; t: number; sp: number }[] = [];
  const corners: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  corners.forEach(([cx, cz], i) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8), postMat);
    p.position.set(cx * (S / 2 - 0.3), 0, cz * (S / 2 - 0.3));
    rig.add(p);
    posts.push(p);
    for (let k = 0; k < 2; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), glow(k ? COLORS.orange : COLORS.teal, 2));
      rig.add(m);
      packets.push({ m, post: i, t: (i * 0.23 + k * 0.5) % 1, sp: (k ? -1 : 1) * (0.16 + i * 0.03) });
    }
  });

  return {
    root,
    layers,
    /** Höhe der untersten Ebene (für Boden und Schatten) */
    bottom: 0,
    /** Ebenen setzen: explode 0…1 zieht den Stapel auseinander, active hebt eine Ebene an (-1 = keine) */
    update(dt: number, explode: number, active = -1) {
      const gap = 0.16 + explode * 0.95;
      const total = (layers.length - 1) * (T + gap);
      layers.forEach((l, i) => {
        l.lift = damp(l.lift, i === active ? 1 : 0, 7, dt);
        let y = i * (T + gap) - total / 2 + 0.9;
        // Ebenen über der aktiven rücken etwas nach oben, damit man hineinsieht
        layers.forEach((o, k) => {
          if (k < i) y += o.lift * 0.5;
        });
        l.y = y + l.lift * 0.12;
        l.g.position.y = l.y;
        const sc = 1 + l.lift * 0.04;
        l.g.scale.set(sc, 1, sc);
        l.spin?.forEach((g, k) => (g.rotation.y += dt * (k % 2 ? -1.3 : 0.9) * (0.35 + l.lift)));
      });
      const y0 = layers[0].y;
      const y1 = layers[layers.length - 1].y;
      posts.forEach((p) => {
        p.scale.y = Math.max(0.01, y1 - y0);
        p.position.y = (y0 + y1) / 2;
      });
      for (const p of packets) {
        p.t = (p.t + dt * p.sp + 1) % 1;
        const post = posts[p.post];
        p.m.position.set(post.position.x, y0 + (y1 - y0) * p.t, post.position.z);
      }
      this.bottom = y0;
    },
  };
}
