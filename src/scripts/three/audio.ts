// Der Sound der Gitarre, komplett im Browser erzeugt (keine Audiodateien):
// Saiten per Karplus-Strong-Synthese, dahinter eine kleine Effektkette wie auf einem Pedalboard
// (Wah → Verzerrer → Chorus → Delay → Hall) und eine Begleitband aus Schlagzeug und Bass.

export const OPEN_HZ = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63]; // E A D G H E
const OPEN_MIDI = [40, 45, 50, 55, 59, 64];
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];

/** Notenname in deutscher Schreibweise (H statt B), optional mit Oktave */
export function noteName(string: number, fret: number, octave = false) {
  const m = OPEN_MIDI[string] + fret;
  return NAMES[m % 12] + (octave ? Math.floor(m / 12) - 1 : '');
}

export type FxName = 'drive' | 'chorus' | 'delay' | 'wah' | 'reverb';

export interface PluckOptions {
  /** eigene Stimmen-Gruppe, damit z. B. der Looper das Live-Spiel nicht abschneidet */
  group?: string;
  mute?: boolean;
  /** Bending in Cent (200 = Ganzton) */
  bend?: number;
  vibrato?: boolean;
}

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
  lfo?: OscillatorNode;
}

export class GuitarAudio {
  on = false;
  fx: Record<FxName, boolean> = { drive: true, chorus: false, delay: false, wah: false, reverb: false };
  palmMute = false;
  band: Band | null = null;
  private ctx: AudioContext | null = null;
  private n!: Record<string, any>;
  private cache = new Map<string, AudioBuffer>();
  private voices = new Map<string, Voice>();
  private rate = 1;
  private smooth = 0;
  private scope = new Uint8Array(512);

  /** Zeit der Audio-Uhr in Sekunden */
  get time() {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  async enable() {
    if (!this.ctx) this.build();
    await this.ctx!.resume();
    this.on = true;
  }

  disable() {
    this.on = false;
    this.band?.stop();
    for (const key of [...this.voices.keys()]) this.choke(key, 0.05);
  }

  private build() {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = (this.ctx = new Ctx({ latencyHint: 'interactive' }) as AudioContext);
    const g = (v = 1) => {
      const node = ctx.createGain();
      node.gain.value = v;
      return node;
    };
    const biq = (type: BiquadFilterType, freq: number, q = 0.7, gain = 0) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      f.gain.value = gain;
      return f;
    };

    /* ---------- Ausgang ---------- */
    const master = g(0.9);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -15;
    comp.knee.value = 10;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    comp.connect(master).connect(analyser).connect(ctx.destination);

    /* ---------- Hall ---------- */
    const len = Math.floor(ctx.sampleRate * 2.4);
    const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = impulse.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const verb = ctx.createConvolver();
    verb.buffer = impulse;
    verb.connect(g(0.9)).connect(comp);

    /* ---------- Gitarre: Tonabnehmer → Tone → Volume ---------- */
    const input = g(1);
    const pickLow = biq('lowshelf', 220, 0.7, -2);
    const pickMid = biq('peaking', 2600, 0.9, 4);
    const tone = biq('lowpass', 6500, 0.5);
    const volume = g(1);
    input.connect(pickLow).connect(pickMid).connect(tone).connect(volume);

    /* ---------- Wah ---------- */
    const wahBand = biq('bandpass', 900, 3.4);
    const wahWet = g(0);
    const wahDry = g(1);
    const postWah = g(1);
    volume.connect(wahDry).connect(postWah);
    volume.connect(wahBand).connect(wahWet).connect(postWah);

    /* ---------- Clean-Kanal und Verzerrer ---------- */
    const amp = g(1);
    const cleanOut = g(0);
    postWah.connect(biq('lowpass', 5200)).connect(cleanOut).connect(amp);
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(2.6 * x) * 0.9 + 0.1 * Math.tanh(9 * x);
    }
    shaper.curve = curve;
    shaper.oversample = '4x';
    const driveOut = g(0.24);
    postWah
      .connect(biq('highpass', 120))
      .connect(g(14))
      .connect(shaper)
      .connect(biq('peaking', 900, 0.8, 5))
      .connect(biq('lowpass', 3400, 0.9))
      .connect(driveOut)
      .connect(amp);

    /* ---------- Chorus ---------- */
    const mod = g(1);
    const chDelay = ctx.createDelay(0.05);
    chDelay.delayTime.value = 0.017;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.75;
    lfo.connect(g(0.0034)).connect(chDelay.delayTime);
    lfo.start();
    const chWet = g(0);
    amp.connect(mod);
    amp.connect(chDelay).connect(chWet).connect(mod);

    /* ---------- Delay ---------- */
    const mix = g(1);
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.43;
    const delayTone = biq('lowpass', 2400);
    const delayWet = g(0);
    mod.connect(mix);
    mod.connect(delay).connect(delayTone).connect(g(0.38)).connect(delay);
    delayTone.connect(delayWet).connect(mix);

    const verbSend = g(0.1);
    mix.connect(comp);
    mix.connect(verbSend).connect(verb);

    /* ---------- Band ---------- */
    const bandBus = g(0.85);
    bandBus.connect(comp);
    bandBus.connect(g(0.07)).connect(verb);
    this.band = new Band(ctx, bandBus);

    this.n = { analyser, input, pickLow, pickMid, tone, volume, wahBand, wahWet, wahDry, cleanOut, driveOut, chWet, delay, delayWet, verbSend };
    (Object.keys(this.fx) as FxName[]).forEach((k) => this.setFx(k, this.fx[k]));
  }

  private ramp(p: AudioParam, v: number, tc = 0.02) {
    p.setTargetAtTime(v, this.ctx!.currentTime, tc);
  }

  setFx(name: FxName, on: boolean) {
    this.fx[name] = on;
    if (!this.ctx) return;
    const n = this.n;
    if (name === 'drive') {
      this.ramp(n.cleanOut.gain, on ? 0 : 0.75);
      this.ramp(n.driveOut.gain, on ? 0.24 : 0);
    } else if (name === 'chorus') this.ramp(n.chWet.gain, on ? 0.7 : 0);
    else if (name === 'delay') this.ramp(n.delayWet.gain, on ? 0.36 : 0);
    else if (name === 'wah') {
      this.ramp(n.wahWet.gain, on ? 2.6 : 0);
      this.ramp(n.wahDry.gain, on ? 0.12 : 1);
    } else if (name === 'reverb') this.ramp(n.verbSend.gain, on ? 0.45 : 0.1);
  }

  /** 0 = Steg (bissig), 1 = beide, 2 = Hals (warm) */
  setPickup(pos: number) {
    if (!this.ctx) return;
    const low = [-2, 1, 4][pos];
    const mid = [4, -3, -7][pos];
    const freq = [2600, 1800, 3000][pos];
    this.ramp(this.n.pickLow.gain, low);
    this.ramp(this.n.pickMid.gain, mid);
    this.ramp(this.n.pickMid.frequency, freq);
  }

  setVolume(v: number) {
    if (this.ctx) this.ramp(this.n.volume.gain, Math.pow(v, 1.6));
  }

  setTone(v: number) {
    if (this.ctx) this.ramp(this.n.tone.frequency, 700 * Math.pow(6500 / 700, v));
  }

  /** Stellung des Wah-Pedals, 0 = zu, 1 = offen */
  setWah(pos: number) {
    if (this.ctx && this.fx.wah) this.ramp(this.n.wahBand.frequency, 450 * Math.pow(2400 / 450, pos), 0.03);
  }

  /** Tremolohebel: verstimmt alle klingenden Saiten gemeinsam (in Halbtönen) */
  setWhammy(semitones: number) {
    this.rate = Math.pow(2, semitones / 12);
    if (!this.ctx) return;
    for (const v of this.voices.values()) v.src.playbackRate.setTargetAtTime(this.rate, this.ctx.currentTime, 0.012);
  }

  /** Delay-Zeit passend zum Tempo: punktierte Achtel */
  setTempo(bpm: number) {
    if (this.ctx) this.ramp(this.n.delay.delayTime, (60 / bpm) * 0.75, 0.05);
  }

  /** Lautstärke des Ausgangs, geglättet (0 … ca. 1) */
  level() {
    if (!this.ctx || !this.on) return (this.smooth *= 0.9);
    this.n.analyser.getByteTimeDomainData(this.scope);
    let sum = 0;
    for (let i = 0; i < this.scope.length; i += 4) {
      const v = (this.scope[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / (this.scope.length / 4));
    this.smooth = Math.max(rms * 2.4, this.smooth * 0.88);
    return this.smooth;
  }

  /** Wellenform des letzten level()-Aufrufs (Werte 0 … 255, Mitte 128) */
  get wave() {
    return this.scope;
  }

  private buffer(freq: number): AudioBuffer {
    const key = freq.toFixed(2);
    const hit = this.cache.get(key);
    if (hit) return hit;
    const ctx = this.ctx!;
    const sr = ctx.sampleRate;
    const dur = freq < 200 ? 3.8 : 3.0;
    const n = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, n, sr);
    const d = buf.getChannelData(0);
    const blend = Math.min(0.5, Math.max(0.14, 0.5 - (freq - 82) / 900));
    const N = Math.max(2, Math.round(sr / freq - blend));
    // Anschlag: tiefpassgefiltertes Rauschen, Plektrum-Position als Kammfilter
    let lp = 0;
    const bright = freq < 200 ? 0.5 : 0.7;
    for (let i = 0; i < N; i++) {
      lp += bright * (Math.random() * 2 - 1 - lp);
      d[i] = lp;
    }
    const pickPos = Math.max(1, Math.floor(N * 0.16));
    for (let i = N - 1; i >= pickPos; i--) d[i] -= d[i - pickPos] * 0.7;
    let mean = 0;
    for (let i = 0; i < N; i++) mean += d[i];
    mean /= N;
    let peak = 0;
    for (let i = 0; i < N; i++) {
      d[i] -= mean;
      peak = Math.max(peak, Math.abs(d[i]));
    }
    for (let i = 0; i < N; i++) d[i] /= peak || 1;
    const decay = 0.9972;
    for (let i = N; i < n; i++) d[i] = decay * ((1 - blend) * d[i - N] + blend * d[Math.max(0, i - N - 1)]);
    const fade = Math.floor(sr * 0.25);
    for (let i = 0; i < fade; i++) d[n - 1 - i] *= i / fade;
    this.cache.set(key, buf);
    return buf;
  }

  private choke(key: string, time = 0.02) {
    const v = this.voices.get(key);
    if (!v || !this.ctx) return;
    const t = this.ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setTargetAtTime(0, t, time / 3);
    v.src.stop(t + time * 2);
    v.lfo?.stop(t + time * 2);
    this.voices.delete(key);
  }

  chokeGroup(group: string) {
    for (const key of [...this.voices.keys()]) if (key.startsWith(group + ':')) this.choke(key, 0.06);
  }

  /** string: 0 = tiefe E-Saite … 5 = hohe E-Saite */
  pluck(string: number, fret = 0, velocity = 0.8, o: PluckOptions = {}) {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx;
    const group = o.group ?? 'live';
    const key = `${group}:${string}`;
    this.choke(key);
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.buffer(OPEN_HZ[string] * Math.pow(2, fret / 12));
    src.playbackRate.value = this.rate;
    const gain = ctx.createGain();
    const level = (0.35 + 0.65 * Math.min(1, velocity)) * (group === 'loop' ? 0.85 : 1);
    gain.gain.setValueAtTime(level, t);
    let head: AudioNode = src;
    if (o.mute ?? this.palmMute) {
      // Handballen auf den Saiten: dumpf und kurz
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1100;
      src.connect(lp);
      head = lp;
      gain.gain.setTargetAtTime(0, t + 0.035, 0.075);
    }
    head.connect(gain).connect(this.n.input);
    let lfo: OscillatorNode | undefined;
    if (src.detune) {
      if (o.bend) {
        src.detune.setValueAtTime(0, t + 0.03);
        src.detune.linearRampToValueAtTime(o.bend, t + 0.2);
      }
      if (o.vibrato) {
        lfo = ctx.createOscillator();
        lfo.frequency.value = 5.4;
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, t + 0.22);
        depth.gain.linearRampToValueAtTime(26, t + 0.55);
        lfo.connect(depth).connect(src.detune);
        lfo.start(t);
      }
    }
    src.start(t);
    const voice: Voice = { src, gain, lfo };
    this.voices.set(key, voice);
    src.onended = () => {
      try {
        lfo?.stop();
      } catch {}
      if (this.voices.get(key) === voice) this.voices.delete(key);
    };
  }

  /** kurzer «Tock» – für das Tischtennis-Spiel */
  static tock(ctx: AudioContext, freq = 900) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + 0.06);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.1);
  }
}

/* ==========================================================================
   Begleitband: Schlagzeug und Bass, taktgenau über die Audio-Uhr geplant
   ========================================================================== */
const ROOT_HZ: Record<string, number> = { E: 82.41, F: 87.31, G: 98.0, A: 55.0, H: 61.74, C: 65.41, D: 73.42 };

export class Band {
  bpm = 104;
  running = false;
  progression = ['Em', 'C', 'G', 'D'];
  /** wird zum Taktbeginn aufgerufen (über flush(), also im Takt der Seite) */
  onBar: ((chord: string, bar: number) => void) | null = null;
  onBeat: ((beat: number) => void) | null = null;
  private timer = 0;
  private next = 0;
  private step = 0;
  private bar = 0;
  private queue: { time: number; fn: () => void }[] = [];
  private noise: AudioBuffer;

  constructor(
    private ctx: AudioContext,
    private out: AudioNode,
  ) {
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  get stepDur() {
    return 60 / this.bpm / 4;
  }
  get barDur() {
    return this.stepDur * 16;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.step = 0;
    this.bar = 0;
    this.next = this.ctx.currentTime + 0.1;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), 25);
  }

  stop() {
    this.running = false;
    clearInterval(this.timer);
    this.queue = [];
  }

  /** fällige Rückrufe (Akkordwechsel, Taktschlag) ausführen */
  flush() {
    const now = this.ctx.currentTime;
    while (this.queue.length && this.queue[0].time <= now) this.queue.shift()!.fn();
  }

  /** Sekunden bis zur nächsten Achtel – damit Riffs und Solos im Takt einsetzen */
  untilNextEighth() {
    if (!this.running) return 0;
    const now = this.ctx.currentTime;
    let t = this.next;
    let s = this.step;
    while (t - this.stepDur > now) {
      t -= this.stepDur;
      s = (s + 15) % 16;
    }
    if (s % 2) t += this.stepDur;
    return Math.max(0, t - now);
  }

  private tick() {
    while (this.next < this.ctx.currentTime + 0.12) {
      this.schedule(this.step, this.bar, this.next);
      this.next += this.stepDur;
      if (++this.step === 16) {
        this.step = 0;
        this.bar++;
      }
    }
  }

  private schedule(step: number, bar: number, t: number) {
    const chord = this.progression[bar % this.progression.length];
    if (step === 0) this.queue.push({ time: t, fn: () => this.onBar?.(chord, bar) });
    if (step % 4 === 0) this.queue.push({ time: t, fn: () => this.onBeat?.(step / 4) });
    const last = bar % 4 === 3;
    if (step === 0 && bar % 4 === 0) this.cymbal(t);
    if (step === 0 || step === 8 || step === 10 || (step === 14 && bar % 2 === 1 && !last)) this.kick(t);
    if (step === 4 || step === 12) this.snare(t, 0.8);
    if (last && (step === 13 || step === 14 || step === 15)) this.snare(t, 0.45 + (step - 13) * 0.12);
    if (step % 2 === 0) this.hat(t, step % 4 === 0 ? 0.2 : 0.12);
    if (step % 2 === 0) this.bass(t, ROOT_HZ[chord[0]] ?? 82.41, this.stepDur * 1.8, step % 8 === 0 ? 0.5 : 0.36);
  }

  private env(t: number, peak: number, dur: number) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    g.connect(this.out);
    return g;
  }

  private noiseSrc(t: number, dur: number) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.start(t, Math.random() * 0.5, dur + 0.05);
    return s;
  }

  private kick(t: number) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    o.connect(this.env(t, 0.95, 0.24));
    o.start(t);
    o.stop(t + 0.26);
  }

  private snare(t: number, level: number) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2100;
    f.Q.value = 0.6;
    this.noiseSrc(t, 0.17).connect(f).connect(this.env(t, level * 0.7, 0.17));
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.08);
    o.connect(this.env(t, level * 0.4, 0.1));
    o.start(t);
    o.stop(t + 0.12);
  }

  private hat(t: number, level: number) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7200;
    this.noiseSrc(t, 0.05).connect(f).connect(this.env(t, level, 0.05));
  }

  private cymbal(t: number) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 5200;
    this.noiseSrc(t, 0.9).connect(f).connect(this.env(t, 0.26, 0.9));
  }

  private bass(t: number, freq: number, dur: number, level: number) {
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(260, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(level, t + 0.008);
    g.gain.setValueAtTime(level, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
}

/* ==========================================================================
   Griffe, Licks und Riffs
   ========================================================================== */
/** Bund pro Saite (tiefe E → hohe E), -1 = Saite wird nicht gespielt */
export const CHORDS: Record<string, number[]> = {
  Em: [0, 2, 2, 0, 0, 0],
  G: [3, 2, 0, 0, 0, 3],
  D: [-1, -1, 0, 2, 3, 2],
  C: [-1, 3, 2, 0, 1, 0],
  Am: [-1, 0, 2, 2, 1, 0],
  A: [-1, 0, 2, 2, 2, 0],
  E: [0, 2, 2, 1, 0, 0],
  E5: [0, 2, 2, -1, -1, -1],
};

export const POWER: Record<string, number[]> = {
  E5: [0, 2, 2, -1, -1, -1],
  G5: [3, 5, 5, -1, -1, -1],
  A5: [5, 7, 7, -1, -1, -1],
  C5: [-1, 3, 5, 5, -1, -1],
  D5: [-1, 5, 7, 7, -1, -1],
};

export interface LickNote {
  s: number;
  f: number;
  /** Dauer in Sechzehnteln */
  d: number;
  bend?: number;
  vib?: boolean;
}
const L = (s: number, f: number, d: number, x: Partial<LickNote> = {}): LickNote => ({ s, f, d, ...x });

/** Solo-Licks in E-Moll-Pentatonik */
export const SOLOS: LickNote[][] = [
  [
    L(2, 7, 1), L(2, 9, 1), L(3, 7, 1), L(3, 9, 1), L(4, 8, 1), L(4, 10, 1), L(5, 7, 1), L(5, 10, 1),
    L(5, 12, 2, { vib: true }), L(5, 10, 1), L(4, 10, 1), L(4, 8, 1), L(3, 9, 1), L(3, 7, 2), L(4, 8, 1), L(5, 7, 1),
    L(5, 10, 6, { bend: 200, vib: true }),
  ],
  [
    L(3, 14, 1), L(4, 12, 1), L(4, 15, 1), L(5, 12, 1), L(5, 15, 3, { bend: 200 }), L(5, 12, 1), L(4, 15, 1), L(4, 12, 1),
    L(3, 14, 1), L(3, 12, 1), L(2, 14, 2), L(3, 12, 1), L(3, 14, 1), L(4, 12, 1), L(3, 14, 6, { bend: 200, vib: true }),
  ],
  [
    L(0, 0, 1), L(0, 3, 1), L(1, 0, 1), L(1, 2, 1), L(2, 0, 1), L(2, 2, 1), L(3, 0, 1), L(3, 2, 1),
    L(4, 0, 1), L(4, 3, 1), L(5, 0, 1), L(5, 3, 2), L(5, 0, 1), L(4, 3, 1), L(4, 0, 1), L(3, 2, 1), L(3, 0, 5, { vib: true }),
  ],
];

/** Riffs: Zahl = abgedämpfte tiefe E-Saite in diesem Bund, Name = Powerchord. Zweiter Wert: Dauer in Sechzehnteln */
export const RIFFS: [number | string, number][][] = [
  [
    [0, 2], [0, 2], ['G5', 2], [0, 2], [0, 2], ['A5', 2], [0, 2], ['G5', 2],
    [0, 2], [0, 2], ['G5', 2], [0, 2], [0, 1], [0, 1], ['D5', 2], ['E5', 4],
  ],
  [
    ['E5', 2], [0, 1], [0, 1], ['E5', 2], [0, 1], [0, 1], ['G5', 2], [0, 2], ['A5', 2], [0, 2],
    ['E5', 2], [0, 1], [0, 1], ['E5', 2], [0, 1], [0, 1], ['D5', 4], ['C5', 4],
  ],
];
