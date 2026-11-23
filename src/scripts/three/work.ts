// Arbeit-Seite: (1) Plattform-Stack als Explosionszeichnung, (2) 3D-Karussell der Wendico-Projekte.
import * as THREE from 'three';
import { Stage, addStudioLights, COLORS, damp, reducedMotion } from './stage';
import { buildStackModel } from './stack-model';

/* ==========================================================================
   1) Plattform-Stack
   ========================================================================== */
export function initStack(el: HTMLElement, items: HTMLElement[]) {
  const stage = new Stage(el, { fov: 26, shadows: true });
  const lights = addStudioLights(stage.scene, true);
  lights.key.position.set(5, 12, 6);
  const rig = new THREE.Group();
  stage.scene.add(rig);

  const model = buildStackModel();
  const layers = model.layers;
  rig.add(model.root);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.receiveShadow = true;
  stage.scene.add(ground);

  const layout = () => {
    const narrow = stage.width < 520;
    stage.camera.position.set(9.5, 8.6, 12).multiplyScalar(narrow ? 1.5 : 1.22);
    stage.camera.lookAt(0, 0.95, 0);
  };
  stage.onResize(layout);

  /* ---------- Aktive Ebene ---------- */
  let active = -1;
  let userAt = -10;
  const setActive = (i: number, fromUser = false) => {
    active = i;
    if (fromUser) userAt = stage.time;
    items.forEach((it, k) => it.classList.toggle('is-active', k === i));
  };
  items.forEach((it, i) => {
    it.addEventListener('pointerenter', () => setActive(i, true));
    it.addEventListener('focusin', () => setActive(i, true));
    it.addEventListener('click', () => setActive(i, true));
  });
  el.addEventListener('pointermove', () => {
    stage.setRay();
    const all = stage.raycaster.intersectObjects(layers.map((l) => l.g), true);
    if (!all.length) return;
    let o: THREE.Object3D | null = all[0].object;
    while (o && !layers.some((l) => l.g === o)) o = o.parent;
    const idx = layers.findIndex((l) => l.g === o);
    if (idx >= 0 && idx !== active) setActive(idx, true);
  });

  let explode = reducedMotion ? 1 : 0;
  let auto = 0;
  stage.onFrame((dt, t) => {
    explode = damp(explode, 1, 1.6, dt);
    if (t - userAt > 6 && !reducedMotion) {
      auto += dt;
      if (auto > 2.6) {
        auto = 0;
        setActive((active + 1) % layers.length);
      }
    }
    model.update(dt, explode, active);
    ground.position.y = model.bottom - 0.9;
    const px = stage.pointerInside ? stage.pointer.x : 0;
    rig.rotation.y = damp(rig.rotation.y, -0.2 + px * 0.35 + (reducedMotion ? 0 : Math.sin(t * 0.25) * 0.12), 3, dt);
  });
  if (reducedMotion) setActive(0);
  return stage;
}

/* ==========================================================================
   2) Projekt-Karussell
   ========================================================================== */
export interface Project {
  name: string;
  url: string;
  tag: string;
  img: string;
}

export function initCarousel(el: HTMLElement, projects: Project[], ui: { title: HTMLElement; tag: HTMLElement; link: HTMLAnchorElement; count: HTMLElement; prev: HTMLElement; next: HTMLElement }) {
  const stage = new Stage(el, { fov: 30 });
  const n = projects.length;
  const W = 3.3;
  const H = W / 1.5;
  const GAP = 0.42;
  const R = ((W + GAP) * n) / (Math.PI * 2);
  const step = (Math.PI * 2) / n;
  const ring = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.add(ring);
  stage.scene.add(tilt);

  const loader = new THREE.TextureLoader();
  const cards: THREE.Mesh[] = [];
  projects.forEach((p, i) => {
    const geo = new THREE.PlaneGeometry(W, H, 28, 1);
    const pos = geo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const a = i * step + pos.getX(k) / R;
      pos.setXYZ(k, Math.sin(a) * R, pos.getY(k), Math.cos(a) * R);
    }
    geo.computeVertexNormals();
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: null },
        uLoaded: { value: 0 },
        uFocus: { value: 0 },
        uAspect: { value: W / H },
        uTint: { value: new THREE.Color(COLORS.paper) },
      },
      alphaToCoverage: true,
      toneMapped: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying float vFacing;
        void main(){
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          vFacing = normalize(normalMatrix * normal).z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform float uLoaded; uniform float uFocus; uniform float uAspect; uniform vec3 uTint;
        varying vec2 vUv; varying float vFacing;
        float box(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
        void main(){
          vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
          float d = box(p, vec2(uAspect, 1.0) * 0.5, 0.06);
          float a = 1.0 - smoothstep(-0.006, 0.006, d);
          vec3 tex = texture2D(uMap, vUv).rgb;
          vec3 col = mix(vec3(0.84, 0.85, 0.88), tex, uLoaded);
          float side = smoothstep(0.35, 1.0, vFacing);
          col = mix(uTint, col, 0.35 + 0.65 * mix(side, 1.0, uFocus));
          col *= 0.94 + 0.06 * uFocus;
          gl_FragColor = vec4(col, a);
          #include <colorspace_fragment>
        }`,
    });
    loader.load(p.img, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      mat.uniforms.uMap.value = tex;
      mat.uniforms.uLoaded.value = 1;
    });
    const m = new THREE.Mesh(geo, mat);
    m.userData.index = i;
    ring.add(m);
    cards.push(m);
  });

  const layout = () => {
    const v = stage.camera;
    const narrow = stage.width < 760;
    // so weit weg, dass eine Karte gut ins Bild passt
    const fit = narrow ? W * 1.12 : W * 2.9;
    const dist = fit / (2 * Math.tan((v.fov * Math.PI) / 360) * v.aspect);
    v.position.set(0, 0.25, R + Math.max(dist, 5.2));
    v.lookAt(0, 0, R * 0.6);
  };
  stage.onResize(layout);

  let rot = 0;
  let vel = 0;
  let targetIndex: number | null = 0;
  let current = -1;
  let dragging = false;
  let lastX = 0;
  let moved = 0;
  let idle = 0;

  const show = (i: number) => {
    if (i === current) return;
    current = i;
    const p = projects[i];
    ui.title.textContent = p.name;
    ui.tag.textContent = p.tag;
    ui.link.href = p.url;
    ui.link.querySelector('span')!.textContent = p.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    ui.count.textContent = `${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
  };
  const nearest = () => ((Math.round(-rot / step) % n) + n) % n;
  const goTo = (i: number) => {
    // kürzester Weg
    const cur = -rot / step;
    let d = (((i - cur) % n) + n) % n;
    if (d > n / 2) d -= n;
    targetIndex = cur + d;
    idle = 0;
  };
  ui.prev.addEventListener('click', () => goTo(nearest() - 1));
  ui.next.addEventListener('click', () => goTo(nearest() + 1));

  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    moved = 0;
    targetIndex = null;
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    moved += Math.abs(dx);
    const k = 2.2 / Math.max(320, stage.width);
    rot += dx * k;
    vel = dx * k * 60;
  });
  const up = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    idle = 0;
    if (moved < 6) {
      const r = el.getBoundingClientRect();
      stage.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      stage.setRay();
      const h = stage.raycaster.intersectObjects(cards, false)[0];
      if (h) {
        const i = h.object.userData.index as number;
        if (i === nearest()) window.open(projects[i].url, '_blank', 'noopener');
        else goTo(i);
      }
    }
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', () => (dragging = false));
  el.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo(nearest() - 1);
    if (e.key === 'ArrowRight') goTo(nearest() + 1);
  });

  stage.onFrame((dt, t) => {
    if (!dragging) {
      if (targetIndex !== null) {
        rot = damp(rot, -targetIndex * step, 6, dt);
        vel = 0;
        idle += dt;
        if (idle > 3.2 && !reducedMotion) {
          targetIndex += 1;
          idle = 0;
        }
      } else {
        rot += vel * dt;
        vel = damp(vel, 0, 2.6, dt);
        if (Math.abs(vel) < 0.25) targetIndex = Math.round(-rot / step);
      }
    }
    ring.rotation.y = rot;
    const px = stage.pointerInside ? stage.pointer.x : 0;
    const py = stage.pointerInside ? stage.pointer.y : 0;
    tilt.rotation.x = damp(tilt.rotation.x, 0.05 - py * 0.05, 4, dt);
    tilt.rotation.y = damp(tilt.rotation.y, px * 0.06, 4, dt);
    tilt.position.y = reducedMotion ? 0 : Math.sin(t * 0.7) * 0.05;
    const front = nearest();
    show(front);
    cards.forEach((c, i) => {
      const u = (c.material as THREE.ShaderMaterial).uniforms;
      u.uFocus.value = damp(u.uFocus.value, i === front ? 1 : 0, 8, dt);
    });
  });
  return stage;
}
