// Gemeinsame Basis für alle 3D-Szenen: Renderer, Kamera, Licht-Umgebung,
// Resize, Pointer und eine Render-Schleife, die nur läuft, wenn die Szene sichtbar ist.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { loader } from '../loader';

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouch = matchMedia('(pointer: coarse)').matches;

export const COLORS = {
  paper: 0xf3f0e9,
  ink: 0x0d1322,
  blue: 0x1e46d8,
  blueDeep: 0x0f2a7a,
  orange: 0xff6427,
  maple: 0xe6b56e,
  teal: 0x14b8b0,
  white: 0xfdfcf8,
  wood: 0xc98f52,
};

export interface StageOptions {
  fov?: number;
  envIntensity?: number;
  exposure?: number;
  dprMax?: number;
  shadows?: boolean;
}

type FrameFn = (dt: number, t: number) => void;

export class Stage {
  el: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  raycaster = new THREE.Raycaster();
  /** Pointer in NDC (-1..1) relativ zum Container */
  pointer = new THREE.Vector2(0, 0);
  pointerInside = false;
  width = 1;
  height = 1;
  time = 0;
  private frames: FrameFn[] = [];
  private resizers: (() => void)[] = [];
  private running = false;
  private static count = 0;
  /** meldet dem Loader, dass die Szene ihr erstes Bild gezeichnet hat (oder gar nicht im Bild ist) */
  private firstFrame: (() => void) | null = null;
  private inView = false;
  private raf = 0;
  private last = 0;

  constructor(el: HTMLElement, opts: StageOptions = {}) {
    this.el = el;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.dprMax ?? 2));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = opts.exposure ?? 1;
    if (opts.shadows) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
    }
    el.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');

    this.camera = new THREE.PerspectiveCamera(opts.fov ?? 35, 1, 0.1, 200);
    this.camera.position.set(0, 0, 12);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = opts.envIntensity ?? 0.55;
    pmrem.dispose();

    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();

    window.addEventListener(
      'pointermove',
      (e) => {
        const r = el.getBoundingClientRect();
        this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
        this.pointerInside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      },
      { passive: true },
    );

    loader.track(`szene-${Stage.count++}`, new Promise<void>((res) => (this.firstFrame = res)));
    new IntersectionObserver(
      ([entry]) => {
        this.inView = entry.isIntersecting;
        if (!entry.isIntersecting) this.markReady();
        this.updateRunning();
      },
      { rootMargin: '80px' },
    ).observe(el);
    document.addEventListener('visibilitychange', () => this.updateRunning());
  }

  onFrame(fn: FrameFn) {
    this.frames.push(fn);
  }
  onResize(fn: () => void) {
    this.resizers.push(fn);
    fn();
  }

  /** Sichtbare Breite/Höhe der Welt auf der Ebene z (Kamera schaut entlang -z) */
  viewAt(z = 0) {
    const d = this.camera.position.z - z;
    const h = 2 * Math.tan((this.camera.fov * Math.PI) / 360) * d;
    return { w: h * this.camera.aspect, h };
  }

  setRay() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray;
  }

  private resize() {
    const w = Math.max(1, this.el.clientWidth);
    const h = Math.max(1, this.el.clientHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.resizers.forEach((f) => f());
    if (!this.running) this.renderOnce();
  }

  renderOnce() {
    this.frames.forEach((f) => f(0, this.time));
    this.renderer.render(this.scene, this.camera);
  }

  private markReady() {
    this.firstFrame?.();
    this.firstFrame = null;
  }

  private updateRunning() {
    const should = this.inView && !document.hidden;
    if (should && !this.running) {
      this.running = true;
      this.last = performance.now();
      const loop = (now: number) => {
        if (!this.running) return;
        const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
        this.last = now;
        this.time += dt;
        for (const f of this.frames) f(dt, this.time);
        this.renderer.render(this.scene, this.camera);
        this.markReady();
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    } else if (!should && this.running) {
      this.running = false;
      cancelAnimationFrame(this.raf);
    }
  }
}

/** Glänzendes «Clay»-Material – der Look aller Objekte auf den hellen Seiten. */
export function clay(color: number, o: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.35,
    ...o,
  });
}

export function chrome(o: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 1, roughness: 0.18, ...o });
}

export function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Standard-Lichtsetup für helle Szenen */
export function addStudioLights(scene: THREE.Scene, shadows = false) {
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(4, 7, 8);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    const s = 7;
    Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s });
    key.shadow.radius = 6;
    key.shadow.bias = -0.0004;
  }
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.5);
  fill.position.set(-6, 2, 4);
  const rim = new THREE.DirectionalLight(0xffd9b0, 0.7);
  rim.position.set(-2, 5, -6);
  scene.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.3));
  return { key, fill, rim };
}
