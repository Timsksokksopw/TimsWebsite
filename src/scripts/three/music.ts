// Musik-Seite: die spielbare Gitarre auf der Bühne.
// Saiten anschlagen, Griffbrett greifen, Tremolohebel und Regler ziehen, Effektpedale treten,
// mit der Band jammen und das Gespielte im Looper aufnehmen.
import * as THREE from 'three';
import { Stage, reducedMotion, damp } from './stage';
import { buildGuitar, SCALE, STRING_Z } from './guitar-model';
import { GuitarAudio, CHORDS, POWER, SOLOS, RIFFS, noteName, type FxName, type PluckOptions } from './audio';
import { makePick } from './objects';

function beam(color: number) {
  const geo = new THREE.ConeGeometry(2.6, 16, 40, 1, true);
  geo.translate(0, -8, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uPower;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float fall = pow(vUv.y, 2.2);
        gl_FragColor = vec4(uColor, edge * fall * 0.34 * uPower);
      }`,
  });
  return new THREE.Mesh(geo, mat);
}

/** Kabel als Schlauch entlang einer Bézierkurve, wird jedes Bild neu gelegt */
function makeCable() {
  const SEG = 30;
  const RAD = 6;
  const pos = new THREE.BufferAttribute(new Float32Array((SEG + 1) * RAD * 3), 3);
  const idx: number[] = [];
  for (let s = 0; s < SEG; s++)
    for (let r = 0; r < RAD; r++) {
      const a = s * RAD + r;
      const b = s * RAD + ((r + 1) % RAD);
      idx.push(a, a + RAD, b, b, a + RAD, b + RAD);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', pos);
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x0a0b0e, roughness: 0.5, metalness: 0.2 }));
  mesh.frustumCulled = false;
  const curve = new THREE.CubicBezierCurve3();
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  const n = new THREE.Vector3();
  const b = new THREE.Vector3();
  const up = new THREE.Vector3(0, 0, 1);
  return {
    mesh,
    update(a: THREE.Vector3, c1: THREE.Vector3, c2: THREE.Vector3, d: THREE.Vector3, radius: number) {
      curve.v0.copy(a);
      curve.v1.copy(c1);
      curve.v2.copy(c2);
      curve.v3.copy(d);
      const arr = pos.array as Float32Array;
      for (let s = 0; s <= SEG; s++) {
        const u = s / SEG;
        curve.getPoint(u, p);
        curve.getTangent(u, t);
        n.crossVectors(t, up).normalize();
        b.crossVectors(t, n).normalize();
        for (let r = 0; r < RAD; r++) {
          const ang = (r / RAD) * Math.PI * 2;
          const cx = Math.cos(ang) * radius;
          const sx = Math.sin(ang) * radius;
          const i = (s * RAD + r) * 3;
          arr[i] = p.x + n.x * cx + b.x * sx;
          arr[i + 1] = p.y + n.y * cx + b.y * sx;
          arr[i + 2] = p.z + n.z * cx + b.z * sx;
        }
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
}

interface LoopEvent {
  t: number;
  s: number;
  f: number;
  v: number;
  o: PluckOptions;
}

export function initMusic(el: HTMLElement, ui: HTMLElement) {
  const host = el.parentElement!;
  const textEl = host.querySelector<HTMLElement>('[data-music-text]');
  const tipEl = host.querySelector<HTMLElement>('[data-music-tip]');
  const q = <T extends HTMLElement>(s: string) => ui.querySelector<T>(s);
  const qa = <T extends HTMLElement>(s: string) => Array.from(ui.querySelectorAll<T>(s));
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const stage = new Stage(el, { fov: 30, envIntensity: 0.5, exposure: 1.1 });
  stage.camera.position.set(0, 0, 15);
  const scene = stage.scene;

  /* ---------- Bühnenlicht ---------- */
  scene.add(new THREE.AmbientLight(0x8899ff, 0.25));
  const key = new THREE.SpotLight(0xffffff, 300, 40, 0.5, 0.6, 1.6);
  key.position.set(2, 9, 10);
  const teal = new THREE.PointLight(0x2ce0d2, 160, 40, 1.6);
  teal.position.set(-9, 3, 5);
  const red = new THREE.PointLight(0xff4a2e, 150, 40, 1.6);
  red.position.set(9, -2, 5);
  const back = new THREE.DirectionalLight(0x6c93ff, 1.2);
  back.position.set(0, 4, -8);
  scene.add(key, key.target, teal, red, back);

  const beams = [beam(0x2ce0d2), beam(0xff4a2e), beam(0x6c93ff)];
  beams.forEach((b, i) => {
    b.position.set([-6.5, 6.5, 0][i], 8.5, -5 - i);
    scene.add(b);
  });

  const dustN = 260;
  const dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) dustPos.set([(Math.random() - 0.5) * 26, (Math.random() - 0.5) * 14, -6 + Math.random() * 9], i * 3);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: 0xbfe9ff, size: 0.045, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  scene.add(dust);

  /* ---------- Gitarre, Plektrum, Kabel ---------- */
  const guitar = buildGuitar({ glow: 0x2ce0d2 });
  const rig = new THREE.Group();
  rig.add(guitar.group);
  scene.add(rig);

  const pick = new THREE.Group();
  const pickModel = makePick(0xff4a2e);
  pickModel.scale.setScalar(0.2);
  pickModel.rotation.set(0.95, 0, 0.35);
  pick.add(pickModel);
  pick.visible = false;
  guitar.local.add(pick);

  const cable = makeCable();
  scene.add(cable.mesh);

  /* ---------- Einpassen: so gross wie möglich, ohne Text oder Pedalboard zu berühren ---------- */
  const base = new THREE.Euler(-0.4, -0.14, 0.3);
  const sil = guitar.silhouette;
  const tmp = new THREE.Vector3();
  const px = new Float32Array(sil.length * 2);
  let vertical = false;
  const project = () => {
    rig.updateMatrixWorld(true);
    let i = 0;
    for (const p of sil) {
      tmp.copy(p).applyMatrix4(guitar.local.matrixWorld).project(stage.camera);
      px[i++] = (tmp.x * 0.5 + 0.5) * stage.width;
      px[i++] = (-tmp.y * 0.5 + 0.5) * stage.height;
    }
  };
  type Rect = { x0: number; y0: number; x1: number; y1: number };
  const bounds = (): Rect => {
    const r = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    for (let i = 0; i < px.length; i += 2) {
      r.x0 = Math.min(r.x0, px[i]);
      r.x1 = Math.max(r.x1, px[i]);
      r.y0 = Math.min(r.y0, px[i + 1]);
      r.y1 = Math.max(r.y1, px[i + 1]);
    }
    return r;
  };
  const touches = (r: Rect | null, dx: number, dy: number) => {
    if (!r) return false;
    for (let i = 0; i < px.length; i += 2) {
      const x = px[i] + dx;
      const y = px[i + 1] + dy;
      if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) return true;
    }
    return false;
  };

  const fit = () => {
    const W = stage.width;
    const H = stage.height;
    if (W < 10 || H < 10) return;
    vertical = W < 760;
    const hostR = el.getBoundingClientRect();
    const rel = (node: Element | null, pad: number): Rect | null => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { x0: r.left - hostR.left - pad, y0: r.top - hostR.top - pad, x1: r.right - hostR.left + pad, y1: r.bottom - hostR.top + pad };
    };
    const text = rel(textEl, vertical ? 4 : 26);
    const board = rel(ui.querySelector('.board__panel') ?? ui, 0)!;
    const edge = vertical ? 6 : 20;
    const safe: Rect = { x0: edge, y0: vertical ? 72 : 96, x1: W - edge, y1: board.y0 - (vertical ? 8 : 16) };
    if (text && vertical) safe.y0 = Math.max(safe.y0, text.y1);
    const obstacle = vertical ? null : text;
    const ppu = H / stage.viewAt(0).h; // Pixel pro Welt-Einheit auf der Ebene z = 0
    const tilt = vertical ? [-0.12, 0.1] : [-0.4, -0.14];
    const angles = vertical ? [Math.PI / 2 - 0.05] : [0.2, 0.3, 0.4, 0.5, 0.62];
    stage.camera.updateMatrixWorld();
    guitar.group.position.set(0, 0, 0);
    let best = { s: 0, tx: 0, ty: 0, a: angles[0] };
    for (const a of angles) {
      guitar.group.rotation.set(tilt[0], tilt[1], a);
      rig.position.set(0, 0, 0);
      for (let s = 1.5; s > 0.2; s *= 0.965) {
        if (s <= best.s) break;
        rig.scale.setScalar(s);
        project();
        const b = bounds();
        const tx0 = safe.x0 - b.x0;
        const tx1 = safe.x1 - b.x1;
        const ty0 = safe.y0 - b.y0;
        const ty1 = safe.y1 - b.y1;
        if (tx0 > tx1 || ty0 > ty1) continue;
        // bevorzugt: etwas rechts der Mitte, vertikal mittig
        const wantX = tx0 + (tx1 - tx0) * 0.6;
        const wantY = (ty0 + ty1) / 2;
        let hit: { tx: number; ty: number; d: number } | null = null;
        for (let iy = 0; iy <= 8; iy++)
          for (let ix = 0; ix <= 10; ix++) {
            const tx = tx0 + ((tx1 - tx0) * ix) / 10;
            const ty = ty0 + ((ty1 - ty0) * iy) / 8;
            const d = Math.hypot(tx - wantX, ty - wantY);
            if (hit && d >= hit.d) continue;
            if (!touches(obstacle, tx, ty)) hit = { tx, ty, d };
          }
        if (hit) {
          best = { s, tx: hit.tx, ty: hit.ty, a };
          break;
        }
      }
    }
    if (!best.s) best = { s: 0.3, tx: 0, ty: 0, a: angles[0] };
    base.set(tilt[0], tilt[1], best.a);
    guitar.group.rotation.copy(base);
    rig.scale.setScalar(best.s);
    rig.position.set(best.tx / ppu, -best.ty / ppu, 0);
    // Nachkontrolle mit echter Projektion (die Suche oben verschiebt nur näherungsweise)
    for (let k = 0; k < 10; k++) {
      project();
      const b = bounds();
      const over = b.x0 < safe.x0 - 1 || b.x1 > safe.x1 + 1 || b.y0 < safe.y0 - 1 || b.y1 > safe.y1 + 1;
      if (!over && !touches(obstacle, 0, 0)) break;
      rig.scale.multiplyScalar(0.97);
    }
  };
  stage.onResize(fit);
  new ResizeObserver(fit).observe(ui);
  (document as any).fonts?.ready?.then(fit);

  /* ---------- Zustand ---------- */
  const audio = new GuitarAudio();
  const chordNames = Object.keys(CHORDS);
  let chordName: string | null = null;
  let frets = [0, 0, 0, 0, 0, 0];
  let flash = 0;
  let plucks = 0;
  const loop = { state: 'idle' as 'idle' | 'rec' | 'play', events: [] as LoopEvent[], start: 0, len: 0, last: 0 };

  /* ---------- Anzeige ---------- */
  const lcdChord = q('[data-lcd-chord]');
  const lcdLabel = q('[data-lcd-label]');
  const lcdChart = q('[data-lcd-chart]');
  const noteCells = qa<HTMLElement>('[data-lcd-notes] span');
  const scope = q<HTMLCanvasElement>('[data-scope]');
  const scopeCtx = scope?.getContext('2d') ?? null;

  const drawChart = () => {
    if (!lcdChart) return;
    const X = (i: number) => 8 + i * 9.6;
    const Y = (f: number) => 15 + f * 10.4;
    let s = `<rect x="7" y="13.2" width="50" height="2.6" rx="1.2" fill="currentColor"/>`;
    for (let f = 1; f <= 4; f++) s += `<line x1="8" x2="56" y1="${Y(f)}" y2="${Y(f)}" stroke="currentColor" stroke-opacity=".3"/>`;
    for (let i = 0; i < 6; i++) s += `<line x1="${X(i)}" x2="${X(i)}" y1="15" y2="${Y(4)}" stroke="currentColor" stroke-opacity=".5"/>`;
    frets.forEach((f, i) => {
      if (f < 0) s += `<path d="M${X(i) - 2.2} 5.2l4.4 4.4m0-4.4l-4.4 4.4" stroke="#ff6a52" stroke-width="1.3" fill="none"/>`;
      else if (f === 0) s += `<circle cx="${X(i)}" cy="7.4" r="2.3" fill="none" stroke="currentColor" stroke-opacity=".7" stroke-width="1.1"/>`;
      else s += `<circle cx="${X(i)}" cy="${Y(f) - 5.2}" r="3.7" fill="var(--accent)"/>`;
    });
    lcdChart.innerHTML = s;
  };
  const showNotes = () => noteCells.forEach((c, i) => (c.textContent = frets[i] < 0 ? '×' : noteName(i, frets[i])));
  const showProgress = (current?: string) => {
    if (!lcdLabel) return;
    const band = audio.band;
    if (band?.running) lcdLabel.innerHTML = band.progression.map((c) => (c === current ? `<b>${c}</b>` : c)).join(' · ');
    else lcdLabel.textContent = 'Akkord';
  };

  /* ---------- Spielen ---------- */
  const pluck = (i: number, velocity = 0.8, fret = frets[i], o: PluckOptions = {}) => {
    if (fret < 0) return;
    guitar.strings[i].pluck(velocity, fret);
    audio.pluck(i, fret, velocity, o);
    plucks++;
    flash = Math.min(1, flash + 0.25 * velocity);
    const cell = noteCells[i];
    if (cell) {
      cell.textContent = noteName(i, fret);
      cell.classList.remove('is-hit');
      void cell.offsetWidth;
      cell.classList.add('is-hit');
    }
    if (loop.state === 'rec' && o.group !== 'loop') {
      loop.events.push({ t: audio.time - loop.start, s: i, f: fret, v: velocity, o: { ...o, mute: o.mute ?? audio.palmMute, group: 'loop' } });
    }
  };
  const strum = (shape: number[], velocity = 0.85, up = false, o: PluckOptions = {}) => {
    const order = up ? [5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5];
    order.forEach((i, k) => window.setTimeout(() => pluck(i, velocity * (0.85 + Math.random() * 0.3), shape[i], o), k * 15));
  };

  const chordBtns = qa<HTMLButtonElement>('[data-chord]');
  const setChord = (name: string | null, play = true) => {
    chordName = name && CHORDS[name] ? name : null;
    frets = chordName ? CHORDS[chordName] : [0, 0, 0, 0, 0, 0];
    chordBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.chord === chordName)));
    if (lcdChord) lcdChord.textContent = chordName ?? 'offen';
    guitar.setFingering(chordName ? frets : null);
    drawChart();
    showNotes();
    if (play) strum(frets);
  };
  chordBtns.forEach((b) => b.addEventListener('click', () => setChord(b.dataset.chord === chordName ? null : b.dataset.chord!)));

  /* ---------- Amp ---------- */
  const ampBtn = q<HTMLButtonElement>('[data-amp]');
  const bandBtn = q<HTMLButtonElement>('[data-band]');
  const loopBtn = q<HTMLButtonElement>('[data-loop]');
  const loopLabel = q('[data-loop-label]');
  const setLoop = (s: typeof loop.state) => {
    loop.state = s;
    if (loopBtn) loopBtn.dataset.state = s;
    if (loopLabel) loopLabel.textContent = s === 'rec' ? 'Aufnahme' : s === 'play' ? 'Loop läuft' : 'Looper';
  };
  const stopBand = () => {
    audio.band?.stop();
    bandBtn?.setAttribute('aria-pressed', 'false');
    ui.classList.remove('is-jam');
    showProgress();
  };
  const setAmp = async (on: boolean, hello = true) => {
    if (on === audio.on) return;
    if (on) {
      await audio.enable();
      if (pendingBpm) audio.band!.bpm = pendingBpm;
      pendingBpm = 0;
      audio.setVolume(knob.volume);
      audio.setTone(knob.tone);
      audio.setPickup(pickupPos);
      audio.setTempo(audio.band!.bpm);
    } else {
      stopBand();
      audio.chokeGroup('loop');
      setLoop('idle');
      audio.disable();
    }
    ampBtn?.setAttribute('aria-pressed', String(on));
    ui.classList.toggle('is-live', on);
    if (on && hello) strum(chordName ? frets : POWER.E5, 0.9);
  };
  ampBtn?.addEventListener('click', () => setAmp(!audio.on));

  /* ---------- Effektpedale ---------- */
  qa<HTMLButtonElement>('[data-fx]').forEach((b) => {
    const name = b.dataset.fx as FxName;
    b.setAttribute('aria-pressed', String(audio.fx[name]));
    b.addEventListener('click', () => {
      audio.setFx(name, !audio.fx[name]);
      b.setAttribute('aria-pressed', String(audio.fx[name]));
    });
  });
  const muteBtn = q<HTMLButtonElement>('[data-mute]');
  const toggleMute = () => {
    audio.palmMute = !audio.palmMute;
    muteBtn?.setAttribute('aria-pressed', String(audio.palmMute));
  };
  muteBtn?.addEventListener('click', toggleMute);

  /* ---------- Strum, Riff, Solo ---------- */
  let lastStrum = 0;
  let strumUp = false;
  const doStrum = () => {
    const now = performance.now();
    strumUp = now - lastStrum < 380 ? !strumUp : false;
    lastStrum = now;
    strum(frets, 0.9, strumUp);
  };
  q('[data-strum]')?.addEventListener('click', doStrum);

  let seq: number[] = [];
  const stopSeq = () => {
    seq.forEach(clearTimeout);
    seq = [];
  };
  const sixteenth = () => (60 / (audio.band?.bpm ?? 104) / 4) * 1000;
  const lead = () => (audio.band?.running ? audio.band.untilNextEighth() * 1000 : 0);
  let soloIndex = 0;
  const solo = () => {
    stopSeq();
    const lick = SOLOS[soloIndex++ % SOLOS.length];
    let t = lead();
    const d = sixteenth();
    for (const n of lick) {
      seq.push(
        window.setTimeout(() => {
          pluck(n.s, 0.95, n.f, { mute: false, bend: n.bend, vibrato: n.vib });
          guitar.flashNote(n.s, n.f);
        }, t),
      );
      t += n.d * d;
    }
  };
  let riffIndex = 0;
  const riff = () => {
    stopSeq();
    const steps = RIFFS[riffIndex++ % RIFFS.length];
    let t = lead();
    const d = sixteenth();
    for (const [what, dur] of steps) {
      seq.push(
        window.setTimeout(() => {
          if (typeof what === 'number') pluck(0, 0.9, what, { mute: true });
          else strum(POWER[what], 0.95, false, { mute: false });
        }, t),
      );
      t += dur * d;
    }
  };
  q('[data-solo]')?.addEventListener('click', solo);
  q('[data-riff]')?.addEventListener('click', riff);

  /* ---------- Looper ---------- */
  const toggleLoop = async () => {
    await setAmp(true, false);
    if (loop.state === 'idle') {
      loop.events = [];
      loop.start = audio.time;
      setLoop('rec');
    } else if (loop.state === 'rec') {
      let len = audio.time - loop.start;
      if (!loop.events.length || len < 0.3) return setLoop('idle');
      const bar = audio.band?.running ? audio.band.barDur : 0;
      if (bar) len = Math.max(1, Math.round(len / bar)) * bar; // auf ganze Takte runden
      loop.len = len;
      loop.last = audio.time - loop.start;
      setLoop('play');
    } else {
      audio.chokeGroup('loop');
      setLoop('idle');
    }
  };
  loopBtn?.addEventListener('click', toggleLoop);
  const tickLoop = () => {
    if (loop.state !== 'play') return;
    const now = audio.time - loop.start;
    for (const ev of loop.events) {
      const k = Math.max(1, Math.floor((loop.last - ev.t) / loop.len) + 1);
      const when = ev.t + k * loop.len;
      if (when > loop.last && when <= now) pluck(ev.s, ev.v, ev.f, ev.o);
    }
    loop.last = now;
  };

  /* ---------- Band ---------- */
  const bpmOut = q('[data-bpm]');
  const toggleBand = async () => {
    await setAmp(true, false);
    const band = audio.band!;
    if (band.running) return stopBand();
    band.onBar = (chord) => {
      setChord(chord, false);
      showProgress(chord);
    };
    band.onBeat = () => {
      bandBtn?.classList.remove('is-beat');
      void bandBtn?.offsetWidth;
      bandBtn?.classList.add('is-beat');
    };
    band.start();
    bandBtn?.setAttribute('aria-pressed', 'true');
    ui.classList.add('is-jam');
    showProgress();
  };
  bandBtn?.addEventListener('click', toggleBand);
  qa<HTMLButtonElement>('[data-tempo]').forEach((b) =>
    b.addEventListener('click', () => {
      const band = audio.band;
      const bpm = THREE.MathUtils.clamp((band?.bpm ?? 104) + Number(b.dataset.tempo), 72, 152);
      if (band) band.bpm = bpm;
      else pendingBpm = bpm;
      audio.setTempo(bpm);
      if (bpmOut) bpmOut.textContent = String(bpm);
    }),
  );
  let pendingBpm = 0;

  // Takt der Seite: unabhängig vom Zeichnen, damit Band und Looper auch beim Scrollen weiterlaufen
  window.setInterval(() => {
    if (!audio.on) return;
    audio.band?.flush();
    tickLoop();
  }, 16);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    stopBand();
    if (loop.state !== 'idle') {
      audio.chokeGroup('loop');
      setLoop('idle');
    }
  });

  /* ---------- Tremolo, Regler, Wahlschalter ---------- */
  const knob = { volume: 1, tone: 1 };
  let pickupPos = 0;
  const pickupNames = ['Steg', 'Mitte', 'Hals'];
  guitar.setKnob('volume', 1);
  guitar.setKnob('tone', 1);
  let wh = 0;
  let whV = 0;
  let whTarget = 0;
  let whHeld = false;
  let whLast = 0;
  const holdWhammy = (on: boolean) => {
    whHeld = on;
    whTarget = on ? 1 : 0;
  };
  const whammyBtn = q<HTMLButtonElement>('[data-whammy]');
  whammyBtn?.addEventListener('pointerdown', () => holdWhammy(true));
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) whammyBtn?.addEventListener(ev, () => holdWhammy(false));

  ui.addEventListener('pointerup', (e) => e.pointerType === 'mouse' && (document.activeElement as HTMLElement | null)?.blur?.());

  /* ---------- Tastatur ---------- */
  const inView = () => {
    const r = host.getBoundingClientRect();
    return r.bottom > 160 && r.top < innerHeight - 160;
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || !inView()) return;
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select')) return;
    const digit = /^Digit([1-8])$/.exec(e.code);
    if (digit) {
      const name = chordNames[Number(digit[1]) - 1];
      return setChord(name === chordName ? null : name);
    }
    const s = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH'].indexOf(e.code);
    if (s >= 0) return pluck(s, 0.85);
    if (e.code === 'Space') {
      // Knöpfe des Pedalboards löst man mit Enter aus, damit die Leertaste fürs Anschlagen frei bleibt
      if (target.closest('button, a') && !target.closest('[data-music-ui]')) return;
      e.preventDefault();
      return doStrum();
    }
    if (e.code === 'KeyQ') solo();
    else if (e.code === 'KeyW') riff();
    else if (e.code === 'KeyE') toggleLoop();
    else if (e.code === 'KeyR') toggleBand();
    else if (e.code === 'KeyT') toggleMute();
    else if (e.code === 'KeyX') holdWhammy(true);
  });
  window.addEventListener('keyup', (e) => e.code === 'KeyX' && holdWhammy(false));

  /* ---------- Zeiger: zupfen, greifen, ziehen ---------- */
  const plane = new THREE.Plane();
  const inv = new THREE.Matrix4();
  const localRay = new THREE.Ray();
  const hitPoint = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const localPoint = (): THREE.Vector3 | null => {
    guitar.local.updateWorldMatrix(true, false);
    inv.copy(guitar.local.matrixWorld).invert();
    localRay.copy(stage.setRay()).applyMatrix4(inv);
    plane.set(zAxis, -STRING_Z);
    return localRay.intersectPlane(plane, hitPoint) ? hitPoint.clone() : null;
  };
  const partAt = (): string | null => {
    stage.setRay();
    const hit = stage.raycaster.intersectObjects(guitar.parts, true)[0];
    return hit ? (hit.object.userData.part as string) : null;
  };
  const aim = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    stage.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
  };
  const tip = (text: string | null, e?: PointerEvent) => {
    if (!tipEl) return;
    if (!text || !e) return tipEl.classList.remove('is-on');
    const r = host.getBoundingClientRect();
    tipEl.textContent = text;
    tipEl.style.transform = `translate3d(${e.clientX - r.left + 18}px, ${e.clientY - r.top - 34}px, 0)`;
    tipEl.classList.add('is-on');
  };
  const cursor = (kind: 'pick' | 'grab' | 'grabbing' | 'pointer' | 'turn') => {
    host.dataset.cursor = kind === 'pick' ? 'hide' : kind === 'grab' || kind === 'grabbing' ? 'grab' : 'none';
    host.style.cursor = kind === 'pick' ? 'none' : kind === 'turn' ? 'ns-resize' : kind;
  };

  type Mode = 'none' | 'rotate' | 'whammy' | 'knob' | 'fret';
  let mode: Mode = 'none';
  let activeKnob: 'volume' | 'tone' = 'volume';
  let prev: THREE.Vector3 | null = null;
  let lastX = 0;
  let lastY = 0;
  let startY = 0;
  let userRx = 0;
  let userRy = 0;
  let fretKey = '';
  let overStrings = false;
  const pickAt = new THREE.Vector3();
  let pickKick = 0;

  const sweep = (p: THREE.Vector3 | null, speedPx: number) => {
    if (p && prev && p.x > -0.3 && p.x < SCALE + 0.2 && Math.abs(p.y) < 1.2 && p.distanceTo(prev) < 1.5) {
      for (const s of guitar.strings) {
        const a = prev.y - s.yAt(prev.x);
        const b = p.y - s.yAt(p.x);
        if (a * b < 0) {
          pluck(s.index, THREE.MathUtils.clamp(0.35 + speedPx / 40, 0.35, 1));
          pickKick = b > 0 ? 1 : -1;
        }
      }
    }
    prev = p;
  };
  const playFret = (p: THREE.Vector3 | null, velocity: number) => {
    const loc = p ? guitar.locate(p) : null;
    if (!loc) return false;
    const k = `${loc.string}:${loc.fret}`;
    if (k !== fretKey) {
      fretKey = k;
      pluck(loc.string, velocity, loc.fret, { mute: false });
      guitar.flashNote(loc.string, loc.fret);
    }
    return true;
  };
  const knobTip = (e: PointerEvent) => tip(`${activeKnob === 'volume' ? 'Volume' : 'Tone'} ${Math.round(knob[activeKnob] * 10)}`, e);

  host.addEventListener('pointermove', (e) => {
    aim(e);
    if (mode === 'rotate') {
      userRy = THREE.MathUtils.clamp(userRy + (e.clientX - lastX) * 0.005, -0.85, 0.85);
      userRx = THREE.MathUtils.clamp(userRx + (e.clientY - lastY) * 0.005, -0.7, 0.7);
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }
    if (mode === 'whammy') {
      whTarget = THREE.MathUtils.clamp((e.clientY - startY) / 130, -0.4, 1);
      return tip(whTarget > 0.05 ? 'Dive' : whTarget < -0.05 ? 'Pull-up' : 'Tremolo', e);
    }
    if (mode === 'knob') {
      knob[activeKnob] = THREE.MathUtils.clamp(knob[activeKnob] - (e.clientY - lastY) * 0.006, 0, 1);
      lastY = e.clientY;
      guitar.setKnob(activeKnob, knob[activeKnob]);
      if (activeKnob === 'volume') audio.setVolume(knob.volume);
      else audio.setTone(knob.tone);
      return knobTip(e);
    }
    if ((e.target as HTMLElement).closest('[data-music-ui]')) {
      overStrings = false;
      prev = null;
      return tip(null);
    }
    const p = localPoint();
    if (mode === 'fret') {
      playFret(p, 0.8);
      if (p) pickAt.copy(p);
      return;
    }
    if (e.pointerType === 'touch') return sweep(p, Math.hypot(e.movementX, e.movementY));
    const near = !!p && p.x > -2.2 && p.x < SCALE + 2.8 && Math.abs(p.y) < 1.9;
    const part = near ? partAt() : null;
    if (part) {
      overStrings = false;
      prev = null;
      cursor(part === 'selector' ? 'pointer' : 'turn');
      const names: Record<string, string> = {
        whammy: 'Tremolohebel: ziehen',
        volume: `Volume ${Math.round(knob.volume * 10)}: ziehen`,
        tone: `Tone ${Math.round(knob.tone * 10)}: ziehen`,
        selector: `Tonabnehmer: ${pickupNames[pickupPos]}`,
      };
      return tip(names[part], e);
    }
    const loc = p ? guitar.locate(p) : null;
    overStrings = !!p && p.x > -0.35 && p.x < SCALE + 0.05 && Math.abs(p.y) < 0.95;
    if (overStrings && p) pickAt.copy(p);
    cursor(overStrings ? 'pick' : 'grab');
    tip(loc ? `${noteName(loc.string, loc.fret, true)} · Bund ${loc.fret}` : null, e);
    sweep(p, Math.hypot(e.movementX, e.movementY));
  });

  host.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button, a, [data-music-ui]')) return;
    aim(e);
    const part = partAt();
    const p = localPoint();
    if (part === 'selector') {
      pickupPos = (pickupPos + 1) % 3;
      guitar.setSelector(pickupPos);
      audio.setPickup(pickupPos);
      return tip(`Tonabnehmer: ${pickupNames[pickupPos]}`, e);
    }
    if (e.pointerType === 'touch') {
      // Auf dem Handy: antippen. Ziehen bleibt dem Scrollen der Seite überlassen.
      fretKey = '';
      if (playFret(p, 0.85)) return;
      prev = p;
      if (p && p.x > -0.3 && p.x < SCALE && Math.abs(p.y) < 0.7) {
        let bestString = 0;
        let bd = 9;
        for (const s of guitar.strings) {
          const d = Math.abs(p.y - s.yAt(p.x));
          if (d < bd) {
            bd = d;
            bestString = s.index;
          }
        }
        pluck(bestString, 0.8);
      }
      return;
    }
    if (e.button !== 0) return;
    host.setPointerCapture(e.pointerId);
    lastX = e.clientX;
    lastY = startY = e.clientY;
    if (part === 'whammy') {
      mode = 'whammy';
      whHeld = true;
      whTarget = 0;
    } else if (part === 'volume' || part === 'tone') {
      mode = 'knob';
      activeKnob = part;
      knobTip(e);
    } else {
      fretKey = '';
      if (playFret(p, 0.9)) mode = 'fret';
      else {
        mode = 'rotate';
        overStrings = false;
        cursor('grabbing');
        tip(null);
      }
    }
  });
  const release = () => {
    if (mode === 'whammy') holdWhammy(false);
    if (mode !== 'none') tip(null);
    mode = 'none';
    prev = null;
    fretKey = '';
    if (finePointer) cursor('grab');
  };
  host.addEventListener('pointerup', release);
  host.addEventListener('pointercancel', release);
  host.addEventListener('pointerleave', () => {
    prev = null;
    overStrings = false;
    tip(null);
  });
  if (finePointer) cursor('grab');

  /* ---------- Bild für Bild ---------- */
  let intro = reducedMotion ? 1 : 0;
  const anchor = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const c1 = new THREE.Vector3();
  const c2 = new THREE.Vector3();
  const end = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  stage.onFrame((dt, t) => {
    intro = Math.min(1, intro + dt * 0.7);
    const e = 1 - Math.pow(1 - intro, 3);
    if (mode !== 'rotate') {
      userRx = damp(userRx, 0, 0.9, dt);
      userRy = damp(userRy, 0, 0.9, dt);
    }
    const idle = reducedMotion ? 0 : 1;
    const calm = mode === 'none' && stage.pointerInside && !overStrings;
    const mx = calm ? stage.pointer.x : 0;
    const my = calm ? stage.pointer.y : 0;
    guitar.group.rotation.set(
      base.x + userRx + Math.sin(t * 0.5) * 0.025 * idle - my * 0.04,
      base.y + userRy + Math.sin(t * 0.37) * 0.05 * idle + mx * 0.06 + (1 - e) * 1.4,
      base.z + Math.sin(t * 0.3) * 0.01 * idle,
    );
    guitar.group.position.y = Math.sin(t * 0.8) * 0.05 * idle - (1 - e) * 3;

    // Tremolo: folgt dem Zug, federt beim Loslassen mit einem kleinen Flattern zurück
    if (whHeld) {
      wh = damp(wh, whTarget, 28, dt);
      whV = 0;
    } else {
      whV += (-560 * wh - 7 * whV) * dt;
      wh += whV * dt;
      if (Math.abs(wh) < 0.002 && Math.abs(whV) < 0.02) wh = whV = 0;
    }
    if (wh !== whLast) {
      whLast = wh;
      guitar.setWhammy(wh);
      audio.setWhammy(wh > 0 ? -10 * wh : -3 * wh);
    }
    if (audio.fx.wah) audio.setWah(finePointer && stage.pointerInside ? stage.pointer.y * 0.5 + 0.5 : 0.5 + 0.45 * Math.sin(t * 3.2));

    guitar.update(dt);

    // Plektrum folgt dem Zeiger über den Saiten
    pick.visible = finePointer && overStrings && (mode === 'none' || mode === 'fret');
    if (pick.visible) {
      pick.position.set(pickAt.x, pickAt.y + 0.12, STRING_Z + 0.16);
      pickKick = damp(pickKick, 0, 12, dt);
      pick.rotation.set(pickKick * 0.35, 0, 0);
    }

    // Kabel von der Buchse nach unten aus dem Bild
    guitar.cableAnchor.getWorldPosition(anchor);
    dir.set(1, 0, 0).applyQuaternion(guitar.cableAnchor.getWorldQuaternion(quat));
    const s = rig.scale.x;
    const view = stage.viewAt(0);
    end.set(anchor.x + (vertical ? 0.4 : -1.4) * s, -view.h / 2 - 1.5, anchor.z + 0.4);
    c1.copy(anchor).addScaledVector(dir, 1.5 * s);
    c1.y -= 0.5 * s;
    c2.set(end.x + 0.5 * s, end.y + 2.6 * s, end.z);
    cable.update(anchor, c1, c2, end, 0.036 * s);

    // Licht reagiert auf das, was wirklich aus dem Amp kommt
    const level = audio.level();
    flash = Math.max(damp(flash, 0, 3.5, dt), Math.min(1, level * 1.6));
    teal.intensity = 160 + flash * 280 + Math.sin(t * 1.3) * 20;
    red.intensity = 150 + flash * 240 + Math.cos(t * 1.1) * 20;
    beams.forEach((b, i) => {
      b.rotation.z = Math.sin(t * 0.35 + i * 2.1) * 0.32 + [0.35, -0.35, 0][i];
      (b.material as THREE.ShaderMaterial).uniforms.uPower.value = 0.75 + flash * 1.6 + Math.sin(t * 0.9 + i) * 0.12;
    });
    dust.rotation.y = t * 0.012;
    dust.position.y = Math.sin(t * 0.2) * 0.3;

    // Oszilloskop in der Anzeige
    if (scopeCtx && scope) {
      const w = scope.width;
      const h = scope.height;
      scopeCtx.clearRect(0, 0, w, h);
      scopeCtx.strokeStyle = audio.on ? 'rgba(44, 224, 210, 0.9)' : 'rgba(255, 255, 255, 0.25)';
      scopeCtx.lineWidth = 2;
      scopeCtx.beginPath();
      const wave = audio.wave;
      for (let x = 0; x <= w; x += 4) {
        const v = audio.on ? (wave[Math.floor((x / w) * (wave.length - 1))] - 128) / 128 : 0;
        const y = h / 2 + v * h * 0.9;
        if (x === 0) scopeCtx.moveTo(x, y);
        else scopeCtx.lineTo(x, y);
      }
      scopeCtx.stroke();
    }
  });

  setChord(null, false);
  showProgress();
  // Griff für Tests und zum Ausprobieren in der Konsole
  (window as any).__music = { audio, loop, plucks: () => plucks, fit, rig, base, guitar, camera: stage.camera, state: () => ({ wh, volume: knob.volume, tone: knob.tone, pickup: pickupPos, chord: chordName }) };
  return { stage, audio };
}
