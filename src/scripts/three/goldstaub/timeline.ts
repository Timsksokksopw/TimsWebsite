// Zeitachse der Scroll-Story, gemessen in Bildschirmhöhen.
// Jedes Kapitel hat eine Haltezone (Objekt in Ruhe, Text lesbar), dazwischen liegt je eine Verwandlung.

/** Länge der Haltezonen pro Kapitel */
export const HOLDS = [0.7, 1.6, 0.8, 1.3, 0.8];
/** Länge einer Verwandlung */
export const MORPH = 1;
export const CHAPTERS = HOLDS.length;
export const TOTAL = HOLDS.reduce((a, b) => a + b, 0) + MORPH * (CHAPTERS - 1);

export interface StoryState {
  /** Form, aus der die Partikel kommen */
  a: number;
  /** Form, zu der sie fliegen */
  b: number;
  /** Fortschritt der Verwandlung a → b, 0 … 1 */
  m: number;
  /** Fortschritt innerhalb der Haltezone, 0 … 1 */
  local: number;
  /** Kapitel, dessen Text gerade gilt */
  chapter: number;
}

export function resolve(u: number): StoryState {
  let pos = 0;
  for (let k = 0; k < CHAPTERS; k++) {
    const last = k === CHAPTERS - 1;
    if (last || u < pos + HOLDS[k]) {
      const local = Math.min(1, Math.max(0, (u - pos) / HOLDS[k]));
      return last ? { a: k - 1, b: k, m: 1, local, chapter: k } : { a: k, b: k + 1, m: 0, local, chapter: k };
    }
    pos += HOLDS[k];
    if (u < pos + MORPH) {
      const m = (u - pos) / MORPH;
      return { a: k, b: k + 1, m, local: m < 0.5 ? 1 : 0, chapter: m < 0.5 ? k : k + 1 };
    }
    pos += MORPH;
  }
  return { a: CHAPTERS - 2, b: CHAPTERS - 1, m: 1, local: 1, chapter: CHAPTERS - 1 };
}

/** Mitte der Haltezone eines Kapitels (Sprungziel der Kapitelanzeige) */
export function holdCentre(k: number) {
  let pos = 0;
  for (let i = 0; i < k; i++) pos += HOLDS[i] + MORPH;
  return pos + HOLDS[k] / 2;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Sichtbarkeit des Textes von Kapitel k: in der Haltezone 1, in der Verwandlung blendet er aus bzw. ein */
export function textVisibility(k: number, s: StoryState) {
  if (s.m <= 0 || s.m >= 1) return s.chapter === k ? 1 : 0;
  if (k === s.a) return 1 - smooth(0, 0.3, s.m);
  if (k === s.b) return smooth(0.7, 1, s.m);
  return 0;
}
