// Globale Interaktionen: Smooth Scroll, Reveals, Cursor, Tilt, Magnet, Menü, Lightbox.
import Lenis from 'lenis';
import { loader } from './loader';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------- Smooth Scroll ---------- */
let lenis: Lenis | null = null;
if (!reduced && finePointer) {
  lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, anchors: true });
  const raf = (t: number) => {
    lenis!.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}
(window as any).__lenis = lenis;
// solange der Loader steht, bleibt die Seite stehen
if (loader.active) {
  lenis?.stop();
  loader.whenDone(() => lenis?.start());
}

document.querySelectorAll<HTMLAnchorElement>('[data-to-top]').forEach((a) =>
  a.addEventListener('click', (e) => {
    e.preventDefault();
    if (lenis) lenis.scrollTo(0, { duration: 1.4 });
    else window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }),
);

/* ---------- Text in Wörter splitten ---------- */
document.querySelectorAll<HTMLElement>('[data-split]').forEach((el) => {
  let i = 0;
  const wrap = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      (node.textContent ?? '').split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          frag.append(' ');
          return;
        }
        const w = document.createElement('span');
        w.className = 'w';
        const inner = document.createElement('span');
        inner.textContent = part;
        inner.style.setProperty('--i', String(i++));
        w.append(inner);
        frag.append(w);
      });
      node.parentNode?.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE && !(node as HTMLElement).classList.contains('w')) {
      Array.from(node.childNodes).forEach(wrap);
    }
  };
  Array.from(el.childNodes).forEach(wrap);
  el.classList.add('split');
});

/* ---------- Reveal beim Scrollen ---------- */
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }
  },
  { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
);
// Einblendungen starten erst, wenn der Loader weg ist, sonst liefen sie unsichtbar hinter ihm ab
loader.whenDone(() => document.querySelectorAll('[data-reveal], .split').forEach((el) => io.observe(el)));

/* ---------- Navigation: Leiste und Vollbild-Menü ---------- */
const navEl = document.querySelector<HTMLElement>('[data-nav]');
const menu = document.querySelector<HTMLElement>('[data-menu]');
const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const menuOpen = () => document.documentElement.classList.contains('menu-open');
let lastY = window.scrollY;
// Abschnitte mit dunklem Hintergrund (data-nav-tone="dark"): dort wird die Leiste hell beschriftet.
// Massgebend ist der Abschnitt, der unter der Leiste wirklich zuoberst liegt. Auf der Startseite
// schieben sich die Türen übereinander, deshalb reicht die Position allein nicht.
const mainEl = document.querySelector<HTMLElement>('main');
const hasDarkZones = !!document.querySelector('[data-nav-tone="dark"]');
const onScroll = () => {
  const y = window.scrollY;
  if (navEl && !menuOpen()) {
    navEl.classList.toggle('is-hidden', y > lastY && y > 500);
    navEl.classList.toggle('is-scrolled', y > 40);
  }
  if (navEl && mainEl && hasDarkZones) {
    const probe = navEl.offsetHeight / 2;
    const top = document.elementsFromPoint(innerWidth / 2, probe).find((el) => mainEl.contains(el));
    navEl.classList.toggle('bar--dark', top?.closest<HTMLElement>('[data-nav-tone]')?.dataset.navTone === 'dark');
  }
  lastY = y;
};
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Vorschaubild rechts im Menü wechselt mit der Zeile unter dem Zeiger bzw. im Fokus
const previewImgs = menu ? Array.from(menu.querySelectorAll<HTMLImageElement>('[data-preview-img]')) : [];
const showPreview = (key: string) => previewImgs.forEach((img) => img.classList.toggle('is-on', img.dataset.previewImg === key));
menu?.querySelectorAll<HTMLElement>('[data-preview]').forEach((row) => {
  const key = row.dataset.preview!;
  row.addEventListener('pointerenter', () => showPreview(key));
  row.addEventListener('focusin', () => showPreview(key));
});

const menuLabel = toggle?.querySelector<HTMLElement>('[data-menu-label]');
let menuTimer = 0;
function setMenu(open: boolean) {
  if (!menu || !toggle || open === menuOpen()) return;
  toggle.setAttribute('aria-expanded', String(open));
  if (menuLabel) menuLabel.textContent = open ? 'Schliessen' : 'Menü';
  document.documentElement.classList.toggle('menu-open', open);
  clearTimeout(menuTimer);
  if (open) {
    menu.hidden = false;
    showPreview(menu.dataset.active ?? '');
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
    lenis?.stop();
    document.documentElement.style.overflow = 'hidden';
    menu.focus({ preventScroll: true });
  } else {
    menu.classList.remove('is-open');
    lenis?.start();
    document.documentElement.style.overflow = '';
    toggle.focus({ preventScroll: true });
    menuTimer = window.setTimeout(() => (menu.hidden = true), reduced ? 0 : 800);
  }
}
toggle?.addEventListener('click', () => setMenu(!menuOpen()));
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') return setMenu(false);
  // Der Fokus bleibt im offenen Menü: Knopf und Links im Kreis
  if (e.key === 'Tab' && menu && toggle && menuOpen()) {
    const items = [toggle, ...Array.from(menu.querySelectorAll<HTMLElement>('a[href]'))];
    const i = items.indexOf(document.activeElement as HTMLElement);
    // vom Dialog selbst aus (i = -1) geht es zum ersten bzw. letzten Link
    const next = i < 0 ? (e.shiftKey ? items.length - 1 : 1) : e.shiftKey ? (i === 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1;
    e.preventDefault();
    items[next].focus();
  }
});

/* ---------- Cursor-Begleiter ---------- */
const cursor = document.querySelector<HTMLElement>('[data-cursor-el]');
if (cursor && finePointer && !reduced) {
  let x = innerWidth / 2,
    y = innerHeight / 2,
    cx = x,
    cy = y;
  window.addEventListener('pointermove', (e) => {
    x = e.clientX;
    y = e.clientY;
    cursor.classList.add('is-on');
    const t = (e.target as HTMLElement | null)?.closest?.('a, button, [data-cursor], input, label');
    const kind = t?.getAttribute('data-cursor');
    cursor.classList.toggle('is-link', !!t && kind !== 'grab' && kind !== 'none' && kind !== 'hide');
    cursor.classList.toggle('is-grab', kind === 'grab');
    cursor.classList.toggle('is-off', kind === 'hide');
  });
  document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
  const loop = () => {
    cx += (x - cx) * 0.2;
    cy += (y - cy) * 0.2;
    cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(loop);
  };
  loop();
}

/* ---------- Magnetische Elemente ---------- */
if (finePointer && !reduced) {
  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
    const strength = Number(el.dataset.magnetic) || 0.3;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
    });
    el.addEventListener('pointerleave', () => (el.style.transform = ''));
  });

  /* ---------- 3D-Tilt-Karten ---------- */
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    const max = Number(el.dataset.tilt) || 9;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.classList.add('is-tilting');
      el.style.setProperty('--ry', `${(px - 0.5) * 2 * max}deg`);
      el.style.setProperty('--rx', `${(0.5 - py) * 2 * max}deg`);
      el.style.setProperty('--gx', `${px * 100}%`);
      el.style.setProperty('--gy', `${py * 100}%`);
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-tilting');
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--rx', '0deg');
    });
  });
}

/* ---------- Lightbox ---------- */
const lb = document.querySelector<HTMLDialogElement>('[data-lightbox]');
if (lb) {
  const img = lb.querySelector('img')!;
  const cap = lb.querySelector('p')!;
  document.querySelectorAll<HTMLElement>('[data-lightbox-src]').forEach((item) => {
    item.addEventListener('click', () => {
      img.src = item.dataset.lightboxSrc!;
      img.alt = item.dataset.lightboxAlt ?? '';
      cap.textContent = item.dataset.lightboxAlt ?? '';
      lb.showModal();
      lenis?.stop();
    });
  });
  const close = () => lb.close();
  lb.addEventListener('click', (e) => {
    if (e.target === lb || (e.target as HTMLElement).closest('[data-lightbox-close]') || e.target === img.parentElement) close();
  });
  lb.addEventListener('close', () => lenis?.start());
}

/* ---------- WebGL-Check ---------- */
try {
  const c = document.createElement('canvas');
  if (!(c.getContext('webgl2') || c.getContext('webgl'))) document.documentElement.classList.add('no-webgl');
} catch {
  document.documentElement.classList.add('no-webgl');
}
