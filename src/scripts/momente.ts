// Foto-Tisch auf «Über mich»: Fotos anfassen, werfen, umdrehen und mit einem Klick neu anordnen.
// Alle Positionen werden aus Tischbreite und Fotoanzahl berechnet, darum funktioniert es mit 6 wie mit 40 Fotos.

type Mode = 'streuen' | 'stapel' | 'faecher' | 'raster' | 'thema';

interface Card {
  el: HTMLElement;
  tilt: HTMLElement;
  thema: string;
  /** aktuelle Lage (Mitte des Fotos, Pixel im Tisch), Drehung in Grad, Grösse */
  x: number;
  y: number;
  r: number;
  s: number;
  /** Ziel der aktuellen Anordnung */
  tx: number;
  ty: number;
  tr: number;
  ts: number;
  vx: number;
  vy: number;
  spin: number;
  held: boolean;
  /** fliegt nach einem Wurf frei über den Tisch */
  free: boolean;
  /** Sekunden, bis das Foto losfliegt (für gestaffelte Bewegungen) */
  delay: number;
  dim: boolean;
}

const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function initMomente(root: HTMLElement) {
  const table = root.querySelector<HTMLElement>('[data-mom-table]');
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-mo]'));
  if (!table || !els.length) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(hover: none), (pointer: coarse)').matches;
  const labels = Array.from(root.querySelectorAll<HTMLElement>('[data-mom-label]'));
  const countEl = root.querySelector<HTMLElement>('[data-mom-count]');
  const layoutBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-layout]'));
  const filterBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-filter]'));
  const themeOrder = labels.map((l) => l.dataset.momLabel!);

  const cards: Card[] = els.map((el) => ({
    el,
    tilt: el.querySelector<HTMLElement>('.mo__tilt')!,
    thema: el.dataset.thema ?? '',
    x: 0, y: 0, r: 0, s: 1,
    tx: 0, ty: 0, tr: 0, ts: 1,
    vx: 0, vy: 0, spin: 0,
    held: false, free: false, delay: 0, dim: false,
  }));
  let order = cards.map((_, i) => i);
  let mode: Mode = coarse || innerWidth < 700 ? 'raster' : 'streuen';
  let filter = '';
  let seed = 11;
  let W = 0;
  let H = 0;
  let cw = 220;
  let ch = 270;
  let topZ = cards.length + 2;
  root.classList.add('is-live');

  /** reproduzierbarer Zufall: gleiche Anordnung, bis «Mischen» gedrückt wird */
  const rng = (n: number) => {
    let a = (seed * 9301 + n * 49297) | 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ---------- Anordnungen: geben für n Fotos Positionen und die nötige Tischhöhe zurück ---------- */
  type Spot = { x: number; y: number; r: number };
  const layouts: Record<Mode, (list: Card[]) => { spots: Spot[]; h: number; labels?: Record<string, Spot> }> = {
    streuen(list) {
      const n = list.length;
      const cols = clamp(Math.floor((W - cw * 0.3) / (cw * 0.94)), 2, 8);
      const rows = Math.ceil(n / cols);
      const pad = W < 600 ? 0 : cw * 0.15;
      const cellW = (W - 2 * pad) / cols;
      const cellH = ch * 0.97;
      const rnd = rng(1);
      const spots = list.map((_, i) => {
        const c = i % cols;
        const row = Math.floor(i / cols);
        // letzte, nicht volle Reihe mittig setzen
        const inRow = row === rows - 1 ? n - row * cols : cols;
        const shift = ((cols - inRow) * cellW) / 2;
        return {
          x: clamp(pad + shift + (c + 0.5) * cellW + (rnd() - 0.5) * Math.max(0, cellW - cw * 0.86), cw * 0.6, W - cw * 0.6),
          y: ch * 0.62 + row * cellH + (rnd() - 0.5) * ch * 0.12,
          r: (rnd() - 0.5) * 14,
        };
      });
      return { spots, h: ch * 1.24 + (rows - 1) * cellH };
    },
    stapel(list) {
      const rnd = rng(2);
      return {
        spots: list.map(() => ({ x: W / 2 + (rnd() - 0.5) * 34, y: ch * 0.68 + (rnd() - 0.5) * 26, r: (rnd() - 0.5) * 16 })),
        h: ch * 1.36,
      };
    },
    faecher(list) {
      const n = list.length;
      const spread = (Math.min(84, 10 * n) * Math.PI) / 180;
      const R = Math.min(ch * 2.6, (W / 2 - cw * 0.62) / Math.sin(spread / 2));
      const topY = ch * 0.72;
      const spots = list.map((_, i) => {
        const a = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread;
        return { x: W / 2 + Math.sin(a) * R, y: topY + R - Math.cos(a) * R, r: (a * 180) / Math.PI };
      });
      return { spots, h: topY + R * (1 - Math.cos(spread / 2)) + ch * 0.78 };
    },
    raster(list) {
      const gap = W < 600 ? 12 : 22;
      const cols = Math.max(2, Math.floor((W - gap) / (cw + gap)));
      const rows = Math.ceil(list.length / cols);
      const x0 = (W - (cols * cw + (cols - 1) * gap)) / 2 + cw / 2;
      return {
        spots: list.map((_, i) => ({ x: x0 + (i % cols) * (cw + gap), y: gap + ch / 2 + Math.floor(i / cols) * (ch + gap), r: 0 })),
        h: gap + rows * (ch + gap),
      };
    },
    thema(list) {
      const groups = themeOrder.map((t) => list.filter((c) => c.thema === t)).filter((g) => g.length);
      const perRow = clamp(Math.floor(W / (cw + 26)), 1, groups.length || 1);
      const colW = W / perRow;
      const step = Math.min(ch * 0.34, 74);
      const head = 44;
      const spots = new Map<Card, Spot>();
      const lab: Record<string, Spot> = {};
      let top = 0;
      for (let g0 = 0; g0 < groups.length; g0 += perRow) {
        const rowGroups = groups.slice(g0, g0 + perRow);
        const offset = ((perRow - rowGroups.length) * colW) / 2;
        rowGroups.forEach((g, k) => {
          const cx = offset + (k + 0.5) * colW;
          lab[g[0].thema] = { x: cx - cw / 2, y: top + 8, r: 0 };
          g.forEach((c, j) => spots.set(c, { x: cx + (j % 2 ? 7 : -7), y: top + head + ch / 2 + j * step, r: j % 2 ? 2.2 : -2.2 }));
        });
        top += head + ch + (Math.max(...rowGroups.map((g) => g.length)) - 1) * step + 34;
      }
      return { spots: list.map((c) => spots.get(c)!), h: top, labels: lab };
    },
  };

  /* ---------- Ziele setzen ---------- */
  const measure = () => {
    W = table.clientWidth;
    cw = W < 600 ? Math.floor((W - 3 * 12) / 2) : clamp(W * 0.165, 170, 236);
    table.style.setProperty('--cw', `${cw}px`);
    ch = cards[0].el.offsetHeight || cw * 1.2;
  };

  const arrange = (stagger = true) => {
    const list = order.map((i) => cards[i]);
    const active = list.filter((c) => !filter || c.thema === filter);
    const rest = list.filter((c) => filter && c.thema !== filter);
    const res = layouts[mode](active);
    // ausgefilterte Fotos liegen klein und blass in einer Reihe am unteren Rand
    H = res.h + (rest.length ? ch * 0.52 : 0);
    active.forEach((c, i) => {
      Object.assign(c, { tx: res.spots[i].x, ty: res.spots[i].y, tr: res.spots[i].r, ts: 1, dim: false, free: false });
      c.delay = stagger && !reduced ? i * 0.022 : 0;
      c.el.style.zIndex = String(i + 2);
    });
    const stepX = Math.min(cw * 0.34, (W - cw * 0.6) / Math.max(1, rest.length));
    rest.forEach((c, i) => {
      Object.assign(c, { tx: W - cw * 0.32 - i * stepX, ty: H - ch * 0.27, tr: i % 2 ? 4 : -4, ts: 0.46, dim: true, free: false, delay: 0 });
      c.el.style.zIndex = '1';
    });
    cards.forEach((c) => {
      c.el.classList.toggle('is-dim', c.dim);
      c.el.tabIndex = c.dim ? -1 : 0;
    });
    topZ = cards.length + 2;
    table.style.height = `${Math.ceil(H)}px`;
    root.dataset.mode = mode;
    labels.forEach((l) => {
      const p = res.labels?.[l.dataset.momLabel!];
      l.style.transform = p ? `translate(${p.x}px, ${p.y}px)` : '';
      l.style.visibility = p ? 'visible' : 'hidden';
    });
    if (countEl) countEl.textContent = String(active.length);
    if (reduced) cards.forEach((c) => Object.assign(c, { x: c.tx, y: c.ty, r: c.tr, s: c.ts }));
    wake();
  };

  /* ---------- Bewegung ---------- */
  const paint = (c: Card) => {
    c.el.style.transform = `translate3d(${c.x - cw / 2}px, ${c.y - ch / 2}px, 0) rotate(${c.r}deg) scale(${c.s * (c.held ? 1.06 : 1)})`;
  };
  let running = false;
  let last = 0;
  let visible = false;
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let busy = false;
    for (const c of cards) {
      if (c.held) {
        c.r = damp(c.r, clamp(c.vx * 0.012, -14, 14), 10, dt);
        busy = true;
      } else if (c.free) {
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.r += c.spin * dt;
        const k = Math.exp(-dt * 2.4);
        c.vx *= k;
        c.vy *= k;
        c.spin *= Math.exp(-dt * 3);
        // an den Tischkanten prallt das Foto ab
        const minX = cw * 0.4;
        const maxX = W - cw * 0.4;
        const minY = ch * 0.4;
        const maxY = H - ch * 0.4;
        if (c.x < minX) (c.x = minX), (c.vx = Math.abs(c.vx) * 0.5);
        if (c.x > maxX) (c.x = maxX), (c.vx = -Math.abs(c.vx) * 0.5);
        if (c.y < minY) (c.y = minY), (c.vy = Math.abs(c.vy) * 0.5);
        if (c.y > maxY) (c.y = maxY), (c.vy = -Math.abs(c.vy) * 0.5);
        if (Math.hypot(c.vx, c.vy) < 14) {
          c.free = false;
          Object.assign(c, { tx: c.x, ty: c.y, tr: c.r });
        }
        busy = true;
      } else if (c.delay > 0) {
        c.delay -= dt;
        busy = true;
      } else {
        c.x = damp(c.x, c.tx, 7.5, dt);
        c.y = damp(c.y, c.ty, 7.5, dt);
        c.r = damp(c.r, c.tr, 7.5, dt);
        c.s = damp(c.s, c.ts, 9, dt);
        if (Math.abs(c.x - c.tx) + Math.abs(c.y - c.ty) > 0.4 || Math.abs(c.r - c.tr) > 0.1 || Math.abs(c.s - c.ts) > 0.004) busy = true;
        else Object.assign(c, { x: c.tx, y: c.ty, r: c.tr, s: c.ts });
      }
      paint(c);
    }
    if (busy && visible) requestAnimationFrame(frame);
    else running = false;
  };
  function wake() {
    if (running || !visible) {
      if (!visible) cards.forEach(paint);
      return;
    }
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  /* ---------- Umdrehen ---------- */
  const flip = (c: Card) => {
    const on = c.el.classList.toggle('is-flipped');
    c.el.setAttribute('aria-pressed', String(on));
  };

  /* ---------- Anfassen, werfen ---------- */
  cards.forEach((c) => {
    const el = c.el;
    let id = -1;
    let ox = 0;
    let oy = 0;
    let sx = 0;
    let sy = 0;
    let moved = 0;
    let downAt = 0;
    let lastT = 0;
    let lastX = 0;
    let lastY = 0;
    let press = 0;
    let touch = false;

    const local = (e: PointerEvent) => {
      const r = table.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const grab = (e: PointerEvent) => {
      c.held = true;
      c.free = false;
      c.delay = 0;
      c.vx = c.vy = 0;
      const p = local(e);
      ox = c.x - p.x;
      oy = c.y - p.y;
      lastX = p.x;
      lastY = p.y;
      lastT = performance.now();
      el.style.zIndex = String(++topZ);
      el.classList.add('is-held');
      c.tilt.style.setProperty('--rx', '0deg');
      c.tilt.style.setProperty('--ry', '0deg');
      wake();
    };

    el.addEventListener('pointerdown', (e) => {
      if (c.dim || (e.pointerType === 'mouse' && e.button !== 0)) return;
      id = e.pointerId;
      touch = e.pointerType === 'touch';
      sx = e.clientX;
      sy = e.clientY;
      moved = 0;
      downAt = performance.now();
      if (touch) {
        // am Handy: erst nach langem Drücken verschieben, damit die Seite scrollbar bleibt
        press = window.setTimeout(() => {
          grab(e);
          navigator.vibrate?.(12);
        }, 350);
      } else {
        el.setPointerCapture(id);
        grab(e);
      }
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId === id) {
        moved = Math.max(moved, Math.hypot(e.clientX - sx, e.clientY - sy));
        if (touch && !c.held && moved > 10) clearTimeout(press);
      }
      if (c.held && e.pointerId === id) {
        const p = local(e);
        const now = performance.now();
        const dt = Math.max(8, now - lastT) / 1000;
        c.vx = damp(c.vx, (p.x - lastX) / dt, 22, dt);
        c.vy = damp(c.vy, (p.y - lastY) / dt, 22, dt);
        lastX = p.x;
        lastY = p.y;
        lastT = now;
        c.x = clamp(p.x + ox, cw * 0.25, W - cw * 0.25);
        c.y = clamp(p.y + oy, ch * 0.25, H - ch * 0.25);
        return;
      }
      // leichte Neigung zum Mauszeiger
      if (!coarse && !reduced && e.pointerType === 'mouse' && !c.dim) {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        c.tilt.style.setProperty('--ry', `${px * 16}deg`);
        c.tilt.style.setProperty('--rx', `${-py * 16}deg`);
      }
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      clearTimeout(press);
      id = -1;
      const quick = performance.now() - downAt < 350 && moved < 8;
      if (c.held) {
        c.held = false;
        el.classList.remove('is-held');
        // war die Maus seit der letzten Bewegung still, ist es kein Wurf
        if (performance.now() - lastT > 90) c.vx = c.vy = 0;
        const speed = Math.hypot(c.vx, c.vy);
        if (speed > 140 && !reduced) {
          const k = Math.min(1, 2600 / speed);
          c.vx *= k;
          c.vy *= k;
          c.spin = clamp(c.vx * 0.05, -220, 220);
          c.free = true;
        } else Object.assign(c, { tx: c.x, ty: c.y, tr: clamp(c.r, -12, 12) });
        wake();
      }
      // am Handy dreht ein kurzes Antippen das Foto um
      if (touch && quick && e.type === 'pointerup') flip(c);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', () => {
      c.tilt.style.setProperty('--rx', '0deg');
      c.tilt.style.setProperty('--ry', '0deg');
    });
    el.addEventListener('dblclick', () => !c.dim && flip(c));
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      flip(c);
    });
    // solange ein Foto gehalten wird, scrollt die Seite nicht mit
    el.addEventListener('touchmove', (e) => c.held && e.preventDefault(), { passive: false });
    el.addEventListener('contextmenu', (e) => touch && e.preventDefault());
  });

  /* ---------- Bedienleiste ---------- */
  const setMode = (m: Mode) => {
    mode = m;
    layoutBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === m)));
    arrange();
  };
  layoutBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.layout as Mode)));
  filterBtns.forEach((b) =>
    b.addEventListener('click', () => {
      filter = b.dataset.filter ?? '';
      filterBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      arrange();
    }),
  );
  root.querySelector('[data-mom-mix]')?.addEventListener('click', () => {
    seed = (seed * 31 + 7) % 9973;
    const rnd = rng(9);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    arrange();
  });

  /* ---------- Start ---------- */
  measure();
  layoutBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === mode)));
  arrange(false);
  // die Fotos warten neben dem Tisch und fliegen herein, sobald er ins Bild kommt
  let entered = reduced;
  if (!reduced) {
    cards.forEach((c, i) => Object.assign(c, { x: i % 2 ? W + cw : -cw, y: c.ty + (i % 3) * 30 - 30, r: i % 2 ? 28 : -28 }));
    cards.forEach(paint);
  }
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !entered) {
        entered = true;
        cards.forEach((c, i) => (c.delay = i * 0.055));
      }
      if (visible) wake();
    },
    { rootMargin: '0px 0px -12% 0px' },
  ).observe(table);
  let lastW = W;
  new ResizeObserver(() => {
    if (Math.abs(table.clientWidth - lastW) < 2) return;
    measure();
    lastW = W;
    arrange(false);
  }).observe(root);
  // die Höhe der Fotos steht erst fest, wenn die Schrift geladen ist
  (document as any).fonts?.ready?.then(() => {
    measure();
    arrange(false);
  });

  // Griff für Tests
  (window as any).__momente = {
    cards,
    get mode() {
      return mode;
    },
    size: () => ({ W, H, cw, ch }),
    get running() {
      return running;
    },
  };
}
