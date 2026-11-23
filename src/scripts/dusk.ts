// Übergang auf der Startseite: Es wird Abend. Beim Scrollen steigen Goldfunken auf,
// zuerst vereinzelt, nach unten (Richtung Goldstaub-Story) immer dichter.

export function initDusk(section: HTMLElement, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const N = 130;
  // fester Zufall, damit die Funken bei jedem Besuch gleich verteilt sind
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const sparks = Array.from({ length: N }, () => ({
    x: rnd(),
    y: rnd(),
    r: 0.6 + rnd() * 1.8,
    speed: 0.02 + rnd() * 0.05,
    sway: rnd() * Math.PI * 2,
    // je tiefer der Funke im Abschnitt beheimatet ist, desto früher erscheint er
    at: rnd(),
  }));
  let w = 0;
  let h = 0;
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(devicePixelRatio, 2);
    w = section.clientWidth;
    h = section.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  };
  new ResizeObserver(resize).observe(section);
  resize();

  let visible = false;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) requestAnimationFrame(frame);
  }).observe(section);

  let last = performance.now();
  function frame(now: number) {
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const rect = section.getBoundingClientRect();
    // 0 = Abschnitt beginnt unten im Bild, 1 = Abschnitt ist ganz durchgescrollt
    const p = Math.min(1, Math.max(0, (innerHeight - rect.top) / (rect.height + innerHeight)));
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, w, h);
    ctx!.globalCompositeOperation = 'lighter';
    for (const s of sparks) {
      if (!reduced) {
        s.y -= s.speed * dt;
        s.sway += dt * 1.3;
        if (s.y < -0.05) s.y += 1.1;
      }
      // Funken erscheinen, sobald es dunkel genug ist; unten im Abschnitt mehr als oben
      const depth = s.y;
      const show = Math.min(1, Math.max(0, (p * 1.6 - (1 - depth) * 0.9 - s.at * 0.35) * 2.5));
      if (show <= 0.01) continue;
      const x = (s.x + Math.sin(s.sway) * 0.008) * w;
      const y = s.y * h;
      const flicker = 0.75 + 0.25 * Math.sin(now * 0.004 + s.sway * 5);
      const g = ctx!.createRadialGradient(x, y, 0, x, y, s.r * 5);
      g.addColorStop(0, `rgba(255, 226, 160, ${0.95 * show * flicker})`);
      g.addColorStop(0.3, `rgba(233, 170, 60, ${0.45 * show * flicker})`);
      g.addColorStop(1, 'rgba(233, 170, 60, 0)');
      ctx!.fillStyle = g;
      ctx!.beginPath();
      ctx!.arc(x, y, s.r * 5, 0, Math.PI * 2);
      ctx!.fill();
    }
    requestAnimationFrame(frame);
  }
}
