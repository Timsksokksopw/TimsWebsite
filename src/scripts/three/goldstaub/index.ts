// Startseite: Scroll-Story. Ein goldenes T zerfällt beim Scrollen zu Goldstaub und setzt sich
// Kapitel für Kapitel neu zusammen (Wendico, Swisscom, Portrait, Freizeit).
// Die Scrollposition steuert alles; die Zeit sorgt nur für Funkeln und leichtes Schweben.
import * as THREE from 'three';
import { Stage, damp, reducedMotion } from '../stage';
import { loader } from '../../loader';
import { resolve, holdCentre, textVisibility, TOTAL, type StoryState } from './timeline';
import { mulberry32, sampleObject, sampleImage, arrange } from './sampling';
import { Dust } from './dust';
import { shapeLogo, shapeBrowser, shapeStack, shapePortrait, shapePick, type StoryShape } from './shapes';

export interface GoldstaubData {
  /** Projekt-Screenshots für das Browserfenster */
  shots: string[];
  /** Studioportrait */
  portrait: string;
}

/**
 * Lichtumgebung wie in einem Fotostudio: dunkler Raum mit wenigen hellen, warmen Flächen.
 * Erst diese Kontraste lassen das Gold wie Metall aussehen (gleichmässiges Licht wirkt wie Plastik).
 */
function studioEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: 0x33261a, side: THREE.BackSide })));
  const panel = (w: number, h: number, color: number, power: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }),
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  panel(16, 9, 0xfff0d8, 7, 0, 15, 7); // grosse Lichtwanne oben
  panel(5, 18, 0xffe2b4, 4.5, -15, 2, 7); // Streifen links
  panel(4, 16, 0xffbe6a, 3.5, 15, 1, -5); // Kante rechts hinten
  panel(9, 9, 0xfff6e6, 2.2, 5, 5, 17); // Aufheller hinter der Kamera
  panel(20, 7, 0x70491c, 1.3, 0, -13, 6); // warmer Boden
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.03).texture;
  pmrem.dispose();
  return tex;
}

const FOV = 30;
const DIST = 12;
const VIEW_H = 2 * Math.tan((FOV * Math.PI) / 360) * DIST;

export function initGoldstaub(section: HTMLElement, data: GoldstaubData) {
  const q = <T extends HTMLElement>(s: string) => section.querySelector<T>(s)!;
  const stageEl = q('[data-gd-stage]');
  const slot = q('[data-gd-slot]');
  const copies = Array.from(section.querySelectorAll<HTMLElement>('[data-ch]'));
  const dots = Array.from(section.querySelectorAll<HTMLButtonElement>('[data-gd-go]'));
  const hint = section.querySelector<HTMLElement>('[data-gd-hint]');
  const touch = matchMedia('(pointer: coarse)').matches;
  const low = (navigator.hardwareConcurrency ?? 8) <= 4 || ((navigator as any).deviceMemory ?? 8) <= 4;
  const N = touch || innerWidth < 760 ? 10000 : low ? 14000 : 22000;

  const stage = new Stage(stageEl, { fov: FOV, dprMax: touch ? 1.5 : 1.75 });
  stage.scene.environment = studioEnvironment(stage.renderer);
  stage.scene.environmentIntensity = 1;
  stage.camera.position.set(0, 0, DIST);
  // deckender Hintergrund: additives Gold sieht auf einer transparenten Fläche je nach Browser anders aus
  stage.scene.background = new THREE.Color(0x0f1012);

  /* ---------- Licht ---------- */
  const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
  key.position.set(4, 6, 8);
  const rim = new THREE.DirectionalLight(0xffc98a, 1.5);
  rim.position.set(-6, 3, -4);
  const fill = new THREE.DirectionalLight(0x9fb4ff, 0.35);
  fill.position.set(-5, -2, 6);
  const spark = new THREE.PointLight(0xffe2a8, 26, 30, 1.8); // folgt dem Mauszeiger
  spark.position.set(0, 1, 5);
  stage.scene.add(key, rim, fill, spark, new THREE.AmbientLight(0xffffff, 0.2));

  // warmer Schein hinter dem Objekt
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(15, 15),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uPower: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'uniform float uPower; varying vec2 vUv; void main(){ float d = length(vUv - 0.5); gl_FragColor = vec4(0.5, 0.33, 0.11, (1.0 - smoothstep(0.0, 0.5, d)) * 0.2 * uPower); }',
    }),
  );
  halo.position.z = -3.5;
  halo.renderOrder = -1;
  stage.scene.add(halo);

  /* ---------- Formen ---------- */
  const shapes: (StoryShape | null)[] = [shapeLogo(), shapeBrowser(data.shots), shapeStack(), null, shapePick()];
  const anchors = shapes.map((s, i) => {
    const a = new THREE.Group();
    if (s) a.add(s.root);
    a.visible = i === 0;
    stage.scene.add(a);
    return a;
  });

  /* ---------- Layout: das Objekt sitzt immer in der Mitte des freien Feldes (.gd__slot) ---------- */
  let dust: Dust | null = null;
  const layout = () => {
    const W = stage.width;
    const H = stage.height;
    if (W < 10 || H < 10) return;
    const sr = stageEl.getBoundingClientRect();
    const r = slot.getBoundingClientRect();
    const cx = r.left - sr.left + r.width / 2;
    const cy = r.top - sr.top + r.height / 2;
    stage.camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    const ppu = H / VIEW_H;
    shapes.forEach((s, i) => s && anchors[i].scale.setScalar(0.92 * Math.min(r.width / ppu / s.fit.w, r.height / ppu / s.fit.h)));
    if (dust) dust.uniforms.uProj.value = (H * stage.renderer.getPixelRatio() * DIST) / VIEW_H;
  };
  stage.onResize(layout);
  new ResizeObserver(layout).observe(slot);
  (document as any).fonts?.ready?.then(layout);

  /* ---------- Goldstaub vorbereiten (verteilt, damit die Seite sofort reagiert) ---------- */
  let ready = false;
  const rng = mulberry32(20261123);
  const idle = () =>
    new Promise<void>((res) => ('requestIdleCallback' in window ? (window as any).requestIdleCallback(() => res(), { timeout: 250 }) : setTimeout(res, 30)));
  const viewDir = (s: StoryShape) => new THREE.Vector3(0, 0, 1).applyQuaternion(new THREE.Quaternion().setFromEuler(s.rot).invert());
  const prepare = async () => {
    const img = new Image();
    img.decoding = 'async';
    img.src = data.portrait;
    await img.decode();
    // Ausschnitt: Kopf und Schultern
    const crop = document.createElement('canvas');
    const sy = img.naturalHeight * 0.1;
    const sh = img.naturalHeight * 0.68;
    crop.width = 640;
    crop.height = Math.round((640 * sh) / img.naturalWidth);
    crop.getContext('2d')!.drawImage(img, 0, sy, img.naturalWidth, sh, 0, 0, crop.width, crop.height);
    const p = sampleImage(crop, N, rng, 3.3);
    const portrait = shapePortrait(crop, p.mask, p.width, p.height);
    portrait.set = p.set;
    shapes[3] = portrait;
    anchors[3].add(portrait.root);
    for (const i of [0, 1, 2, 4]) {
      await idle();
      const s = shapes[i]!;
      s.set = sampleObject(s.root, N, rng, viewDir(s));
    }
    await idle();
    const all = shapes as StoryShape[];
    arrange(all.map((s) => s.set!), rng);
    all.forEach((s) => {
      s.u.uBoxMin.value.copy(s.set!.min);
      s.u.uBoxSize.value.copy(s.set!.size);
    });
    dust = new Dust(all.map((s) => s.set!), rng);
    dust.points.visible = false;
    stage.scene.add(dust.points);
    layout();
    // Shader vorab übersetzen, damit die erste Verwandlung nicht ruckelt
    const was = anchors.map((a) => a.visible);
    anchors.forEach((a) => (a.visible = true));
    dust.points.visible = true;
    stage.renderer.compile(stage.scene, stage.camera);
    anchors.forEach((a, i) => (a.visible = was[i]));
    dust.points.visible = false;
    ready = true;
  };
  const prepared = prepare().catch((err) => console.warn('Goldstaub: Vorbereitung fehlgeschlagen, es bleibt bei der Überblendung', err));
  loader.track('goldstaub', prepared);

  /* ---------- Kapitelanzeige ---------- */
  const lenis = () => (window as any).__lenis as { scrollTo(y: number, o?: object): void } | null;
  dots.forEach((b) =>
    b.addEventListener('click', () => {
      const k = Number(b.dataset.gdGo);
      const y = section.getBoundingClientRect().top + window.scrollY + holdCentre(k) * window.innerHeight;
      const l = lenis();
      if (l) l.scrollTo(y, { duration: 1.3 });
      else window.scrollTo({ top: y, behavior: reducedMotion ? 'auto' : 'smooth' });
    }),
  );

  /* ---------- Bild für Bild ---------- */
  let u = 0;
  let frozen: number | null = null;
  let frozenTime: number | null = null;
  let state: StoryState = resolve(0);
  let chapterShown = -1;
  const shown = copies.map(() => -1);
  let slowFrames = 0;
  let morphFrames = 0;
  let reduced = false;
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  stage.onFrame((dt, clock) => {
    const t = frozenTime ?? clock;
    const target = Math.min(TOTAL, Math.max(0, -section.getBoundingClientRect().top / window.innerHeight));
    u = frozen ?? (touch ? damp(u, target, 16, dt) : target);
    const s = (state = resolve(u));
    const useDust = ready && !reducedMotion && !!dust;
    const px = stage.pointerInside ? stage.pointer.x : 0;
    const py = stage.pointerInside ? stage.pointer.y : 0;
    const idleSway = reducedMotion ? 0 : 1;
    const localOf = (i: number) => (i === s.chapter ? s.local : i < s.chapter ? 1 : 0);

    shapes.forEach((sh, i) => {
      if (!sh) return;
      const an = anchors[i];
      const isA = i === s.a;
      const isB = i === s.b && s.b !== s.a;
      let hide = -1;
      let show = 2;
      let vis = false;
      if (useDust) {
        if (isA) {
          hide = s.m > 0 ? s.m / 0.42 : -1;
          vis = hide < 1;
        } else if (isB) {
          show = s.m >= 1 ? 2 : (s.m - 0.58) / 0.42;
          vis = show > 0;
        }
      } else {
        // ohne Partikel: einfacher Wechsel in der Mitte der Verwandlung
        vis = isA ? s.m < 0.5 : isB && s.m >= 0.5;
      }
      sh.u.uHide.value = hide;
      sh.u.uShow.value = show;
      an.visible = vis || (sh.dustOnly && (isA || isB));
      if (!isA && !isB) return;
      const turn = (localOf(i) - (i === 0 ? 0 : 0.5)) * 0.55;
      an.rotation.set(
        sh.rot.x - py * 0.1 * sh.sway,
        sh.rot.y + turn + px * 0.3 * sh.sway + Math.sin(t * 0.45 + i) * 0.07 * sh.sway * idleSway,
        sh.rot.z,
      );
      an.position.y = Math.sin(t * 0.7 + i * 2) * 0.05 * idleSway;
      an.updateMatrixWorld(true);
      sh.u.uRootInv.value.copy(sh.root.matrixWorld).invert();
      sh.tick?.(dt, localOf(i), t, !useDust, vis || (sh.dustOnly && (isA ? s.m < 0.5 : s.m >= 0.5)));
    });

    if (dust) {
      const A = shapes[s.a];
      const B = shapes[s.b];
      const on = useDust && !!A && !!B && ((s.m > 0 && s.m < 1) || A.dustOnly || B.dustOnly);
      dust.points.visible = on;
      if (on && A && B) {
        dust.setPair(s.a, s.b);
        const du = dust.uniforms;
        du.uMorph.value = s.m;
        du.uTime.value = t;
        du.uFromM.value.copy(A.root.matrixWorld);
        du.uToM.value.copy(B.root.matrixWorld);
        du.uFromDust.value = A.dustOnly ? A.dustVis : 0;
        du.uToDust.value = B.dustOnly ? B.dustVis : 0;
        du.uScale.value = (anchors[s.a].scale.x + anchors[s.b].scale.x) / 2;
        // schwache Geräte: erst Auflösung, dann Partikelzahl senken
        if (s.m > 0 && s.m < 1 && !reduced) {
          morphFrames++;
          if (dt > 0.026) slowFrames++;
          if (morphFrames > 50) {
            if (slowFrames > 30) {
              reduced = true;
              stage.renderer.setPixelRatio(1);
              dust.setShare(0.6);
              layout();
            }
            morphFrames = slowFrames = 0;
          }
        }
      }
    }

    spark.position.set(px * 4.5, 1 + py * 3, 5);
    (halo.material as THREE.ShaderMaterial).uniforms.uPower.value = 1 + 0.5 * Math.sin(Math.PI * s.m);

    // Texte folgen der Zeitachse
    copies.forEach((el, k) => {
      const v = Math.round(textVisibility(k, s) * 50) / 50;
      if (v === shown[k]) return;
      shown[k] = v;
      const dir = k === s.a && s.m > 0 && s.m < 1 ? -1 : 1;
      el.style.opacity = String(v);
      el.style.transform = `translate3d(0, ${(1 - v) * 26 * dir}px, 0)`;
      el.classList.toggle('is-on', v > 0.5);
      el.toggleAttribute('inert', v <= 0.5);
    });
    if (s.chapter !== chapterShown) {
      chapterShown = s.chapter;
      dots.forEach((b, k) => (k === s.chapter ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    }
    if (hint) hint.style.opacity = String(1 - smooth(0.04, 0.25, u));
  });

  // Griff für Tests und zum Ausprobieren in der Konsole
  (window as any).__gd = {
    N,
    stage,
    anchors,
    shapes,
    slot,
    get ready() {
      return ready;
    },
    get dust() {
      return dust;
    },
    state: () => ({ u, ...state }),
    /** Scrollposition (in Bildschirmhöhen) und optional die Zeit festhalten; null gibt wieder frei */
    freeze(v: number | null, time: number | null = null) {
      frozen = v;
      frozenTime = time;
    },
  };
  return stage;
}
