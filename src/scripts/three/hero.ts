// Startseite, Einstieg: das Gitarrenfoto mit Tiefe. Die Landschaft verschiebt sich leicht mit dem Mauszeiger,
// der Schriftzug «BIEDERMANN» liegt wie Glas darüber und bricht das Bild.
// Hell und warm abgestimmt: kein dunkler Schleier, das Foto soll einladend wirken.
import * as THREE from 'three';
import { Stage, reducedMotion, damp } from './stage';
import { loader } from '../loader';

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform sampler2D uMask;
  uniform vec2 uRes;
  uniform vec2 uImg;
  uniform vec2 uFocus;
  uniform vec2 uPointer;
  uniform float uScroll;
  uniform float uReveal;
  varying vec2 vUv;

  // wie CSS object-fit: cover
  vec2 cover(vec2 uv) {
    float ra = uRes.x / uRes.y;
    float ia = uImg.x / uImg.y;
    vec2 s = ra > ia ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
    return (uv - 0.5) * s + uFocus;
  }

  // r = scharfe Buchstaben, g = weichgezeichnet (für die Wölbung des Glases)
  vec2 mask(vec2 uv) {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec2(0.0);
    return texture2D(uMask, uv).rg;
  }

  void main() {
    // Tiefe: unten nah (Wiese, Bank), oben fern (Hügel, Himmel)
    float depth = pow(1.0 - vUv.y, 1.25);
    float zoom = mix(1.14, 1.06, uReveal) + uScroll * 0.05;
    vec2 uv = (vUv - 0.5) / zoom + 0.5;
    uv += uPointer * vec2(-0.016, -0.011) * (depth - 0.32);
    uv.y += uScroll * 0.04;

    // Glas-Schriftzug als eigene Ebene vor dem Bild
    vec2 mUv = vUv + uPointer * vec2(0.007, 0.005);
    mUv.y -= uScroll * 0.2;
    vec2 px = 1.0 / uRes;
    float m = mask(mUv).r;
    vec2 w = px * 5.0;
    vec2 n = vec2(mask(mUv + vec2(w.x, 0.0)).g - mask(mUv - vec2(w.x, 0.0)).g, mask(mUv + vec2(0.0, w.y)).g - mask(mUv - vec2(0.0, w.y)).g);
    vec2 e = px * 1.2;
    float rim = clamp(length(vec2(mask(mUv + vec2(e.x, 0.0)).r - mask(mUv - vec2(e.x, 0.0)).r, mask(mUv + vec2(0.0, e.y)).r - mask(mUv - vec2(0.0, e.y)).r)) * 1.4, 0.0, 1.0);

    // Linse: im Buchstaben leicht vergrössert und zur Kante hin gebrochen
    vec2 g = (uv - 0.5) * (1.0 - 0.05 * m) + 0.5 - n * 0.045 * m;
    vec2 ca = n * 0.006 * m;
    vec3 col;
    col.r = texture2D(uTex, cover(g + ca)).r;
    col.g = texture2D(uTex, cover(g)).g;
    col.b = texture2D(uTex, cover(g - ca)).b;
    vec3 soft = (texture2D(uTex, cover(g + vec2(0.003, 0.0))).rgb + texture2D(uTex, cover(g - vec2(0.003, 0.0))).rgb
               + texture2D(uTex, cover(g + vec2(0.0, 0.004))).rgb + texture2D(uTex, cover(g - vec2(0.0, 0.004))).rgb) * 0.25;
    col = mix(col, soft, m * 0.4);

    // Farbstimmung: heller, warm, fast ohne Vignette
    col = pow(col, vec3(0.84));
    col = (col - 0.5) * 1.07 + 0.5;
    col *= vec3(1.1, 1.04, 0.95);
    float vig = smoothstep(1.45, 0.45, length((vUv - 0.5) * vec2(1.0, 0.8)));
    col *= mix(0.9, 1.0, vig);

    // Glas: heller Film, Kante fängt das Licht
    col = mix(col, col * 1.04 + vec3(0.24, 0.23, 0.21), m);
    vec2 ldir = normalize(vec2(-0.5 + uPointer.x * 0.8, 0.7 + uPointer.y * 0.4));
    float facing = 0.55 + 0.45 * dot(normalize(n + 1e-5), -ldir);
    col += rim * facing * 0.36;

    gl_FragColor = vec4(mix(vec3(0.953, 0.941, 0.914), col, uReveal), 1.0);
    #include <colorspace_fragment>
  }
`;

export interface HeroOptions {
  photo: string;
  word: string;
  /** Bildausschnitt (x, y von oben), 0…1 */
  focus?: [number, number];
  /** Ausschnitt im Hochformat (Handy) */
  focusNarrow?: [number, number];
}

export function initHero(el: HTMLElement, section: HTMLElement, opts: HeroOptions) {
  const stage = new Stage(el, { fov: 40, dprMax: 1.75 });

  const maskCanvas = document.createElement('canvas');
  const maskTex = new THREE.CanvasTexture(maskCanvas);
  maskTex.minFilter = THREE.LinearFilter;
  maskTex.generateMipmaps = false;

  const uniforms = {
    uTex: { value: null as THREE.Texture | null },
    uMask: { value: maskTex },
    uRes: { value: new THREE.Vector2(1, 1) },
    uImg: { value: new THREE.Vector2(4, 3) },
    uFocus: { value: new THREE.Vector2(0.5, 0.5) },
    uPointer: { value: new THREE.Vector2() },
    uScroll: { value: 0 },
    uReveal: { value: 0 },
  };
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: FRAG,
    }),
  );
  quad.frustumCulled = false;
  stage.scene.add(quad);

  /* ---------- Schriftzug als Maske: rot scharf, grün weich ---------- */
  const drawMask = () => {
    const w = Math.min(2048, Math.round(stage.width * Math.min(devicePixelRatio, 2)));
    const h = Math.round((w * stage.height) / stage.width);
    maskCanvas.width = w;
    maskCanvas.height = h;
    const c = maskCanvas.getContext('2d')!;
    c.fillStyle = '#000';
    c.fillRect(0, 0, w, h);
    const narrow = stage.width < 760;
    const family = '"Schibsted Grotesk Variable", "Segoe UI", system-ui, sans-serif';
    let size = 200;
    const setFont = () => {
      c.font = `700 ${size}px ${family}`;
      try {
        (c as any).letterSpacing = `${-size * 0.015}px`;
      } catch {}
    };
    setFont();
    size *= (w * (narrow ? 0.94 : 0.9)) / c.measureText(opts.word).width;
    setFont();
    const tw = c.measureText(opts.word).width;
    const x = (w - tw) / 2;
    const y = h * (narrow ? 0.16 : 0.12) + size * 0.72;
    c.textBaseline = 'alphabetic';
    c.globalCompositeOperation = 'lighter';
    c.filter = `blur(${Math.max(2, size * 0.04)}px)`;
    c.fillStyle = '#00ff00';
    c.fillText(opts.word, x, y);
    c.filter = 'none';
    c.fillStyle = '#ff0000';
    c.fillText(opts.word, x, y);
    c.globalCompositeOperation = 'source-over';
    maskTex.needsUpdate = true;
  };
  const fontReady = (document as any).fonts?.load ? (document as any).fonts.load('700 100px "Schibsted Grotesk Variable"') : Promise.resolve();
  fontReady.then(drawMask, drawMask);

  stage.onResize(() => {
    uniforms.uRes.value.set(stage.width, stage.height);
    const f = (stage.width < 760 ? opts.focusNarrow : opts.focus) ?? opts.focus ?? [0.5, 0.5];
    uniforms.uFocus.value.set(f[0], 1 - f[1]);
    drawMask();
  });

  /* ---------- Foto ---------- */
  let loaded = false;
  // das Foto blendet erst ein, wenn der Loader den Blick freigibt
  let go = false;
  loader.whenDone(() => (go = true));
  let photoDone = () => {};
  loader.track('foto', new Promise<void>((res) => (photoDone = res)));
  new THREE.TextureLoader().load(opts.photo, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    uniforms.uTex.value = tex;
    uniforms.uImg.value.set(tex.image.width, tex.image.height);
    loaded = true;
    section.classList.add('is-gl');
    photoDone();
  }, undefined, () => photoDone());

  let scroll = 0;
  window.addEventListener('scroll', () => (scroll = Math.min(1.2, window.scrollY / Math.max(1, section.offsetHeight))), { passive: true });

  const pointer = new THREE.Vector2();
  stage.onFrame((dt) => {
    const tx = stage.pointerInside && !reducedMotion ? stage.pointer.x : 0;
    const ty = stage.pointerInside && !reducedMotion ? stage.pointer.y : 0;
    pointer.x = damp(pointer.x, tx, 3.5, dt);
    pointer.y = damp(pointer.y, ty, 3.5, dt);
    uniforms.uPointer.value.copy(pointer);
    uniforms.uScroll.value = damp(uniforms.uScroll.value, scroll, 8, dt);
    if (loaded && go) uniforms.uReveal.value = reducedMotion ? 1 : Math.min(1, uniforms.uReveal.value + dt * 0.9);
  });
  return stage;
}
