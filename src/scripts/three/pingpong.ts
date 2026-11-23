// Mini-Spiel auf der Sport-Seite: den Tischtennisball so lange wie möglich oben halten.
import * as THREE from 'three';
import { Stage, addStudioLights, clay, damp } from './stage';
import { makePaddle } from './objects';
import { GuitarAudio } from './audio';

const BEST_KEY = 'tb-pingpong-best';

export function initPingPong(el: HTMLElement, ui: HTMLElement) {
  const stage = new Stage(el, { fov: 34 });
  stage.camera.position.set(0, 0.6, 12);
  stage.camera.lookAt(0, 0.2, 0);
  addStudioLights(stage.scene);

  const scoreEl = ui.querySelector<HTMLElement>('[data-pp-score]')!;
  const bestEl = ui.querySelector<HTMLElement>('[data-pp-best]')!;
  const overlay = ui.querySelector<HTMLElement>('[data-pp-overlay]')!;
  const startBtn = ui.querySelector<HTMLButtonElement>('[data-pp-start]')!;
  const msg = ui.querySelector<HTMLElement>('[data-pp-msg]')!;

  let best = 0;
  try {
    best = Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {}
  bestEl.textContent = String(best);

  /* ---------- Objekte ---------- */
  const paddle = makePaddle(false);
  const paddleRig = new THREE.Group();
  paddle.rotation.x = -Math.PI / 2 + 0.28;
  paddle.scale.setScalar(1.05);
  paddleRig.add(paddle);
  stage.scene.add(paddleRig);

  const R = 0.2;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 24), clay(0xff9b3d, { roughness: 0.35 }));
  stage.scene.add(ball);

  const FLOOR = -2.7;
  const shadowTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(13,19,34,0.55)');
    grad.addColorStop(1, 'rgba(13,19,34,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  })();
  const mkShadow = () => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    s.position.y = FLOOR;
    stage.scene.add(s);
    return s;
  };
  const ballShadow = mkShadow();
  const paddleShadow = mkShadow();

  /* ---------- Zustand ---------- */
  const pos = new THREE.Vector2(0, 2);
  const vel = new THREE.Vector2(0, 0);
  const pad = new THREE.Vector2(0, -1);
  const padPrev = new THREE.Vector2(0, -1);
  const padVel = new THREE.Vector2();
  let tilt = 0;
  let squash = 0;
  let score = 0;
  let playing = false;
  let audioCtx: AudioContext | null = null;
  const HALF = 0.82;
  const G = -15;

  const setScore = (n: number) => {
    score = n;
    scoreEl.textContent = String(n);
    scoreEl.classList.remove('is-pop');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('is-pop');
  };

  const start = () => {
    try {
      audioCtx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtx.resume();
    } catch {}
    playing = true;
    setScore(0);
    pos.set(pad.x, 2.6);
    vel.set(0, 0);
    overlay.classList.add('is-hidden');
  };
  startBtn.addEventListener('click', start);

  const gameOver = () => {
    playing = false;
    if (score > best) {
      best = score;
      bestEl.textContent = String(best);
      try {
        localStorage.setItem(BEST_KEY, String(best));
      } catch {}
      msg.textContent = `Neuer Rekord: ${score}!`;
    } else {
      msg.textContent = score === 0 ? 'Knapp daneben.' : `${score} Mal getroffen.`;
    }
    startBtn.textContent = 'Nochmal';
    overlay.classList.remove('is-hidden');
  };

  /* ---------- Steuerung ---------- */
  const target = new THREE.Vector2(0, -1);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  const aim = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    stage.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    if (stage.setRay().intersectPlane(plane, hit)) {
      const v = stage.viewAt(0);
      target.set(THREE.MathUtils.clamp(hit.x, -v.w / 2 + 0.7, v.w / 2 - 0.7), THREE.MathUtils.clamp(hit.y, -1.9, 1.6));
    }
  };
  ui.addEventListener('pointermove', aim);
  ui.addEventListener('pointerdown', aim);

  /* ---------- Frame ---------- */
  stage.onFrame((dt, t) => {
    if (dt <= 0) return;
    const v = stage.viewAt(0);
    const wall = v.w / 2 - R;

    if (!playing) {
      // Demo: der Schläger folgt dem Ball von selbst
      target.set(THREE.MathUtils.clamp(pos.x + Math.sin(t * 2.1) * 0.25, -wall + 1, wall - 1), -1.1);
    }
    padPrev.copy(pad);
    pad.x = damp(pad.x, target.x, 18, dt);
    pad.y = damp(pad.y, target.y, 18, dt);
    padVel.copy(pad).sub(padPrev).divideScalar(dt);
    tilt = damp(tilt, THREE.MathUtils.clamp(-padVel.x * 0.035, -0.5, 0.5), 10, dt);

    // Ball
    const steps = 3;
    for (let i = 0; i < steps; i++) {
      const h = dt / steps;
      vel.y += G * h;
      pos.addScaledVector(vel, h);
      if (pos.x > wall) {
        pos.x = wall;
        vel.x = -Math.abs(vel.x) * 0.8;
      } else if (pos.x < -wall) {
        pos.x = -wall;
        vel.x = Math.abs(vel.x) * 0.8;
      }
      // Kollision mit dem Schlägerblatt
      const nx = -Math.sin(tilt);
      const ny = Math.cos(tilt);
      const dx = pos.x - pad.x;
      const dy = pos.y - pad.y;
      const dist = dx * nx + dy * ny;
      const along = dx * ny - dy * nx;
      const rel = (vel.x - padVel.x) * nx + (vel.y - padVel.y) * ny;
      if (dist < R + 0.06 && dist > -0.35 && Math.abs(along) < HALF + R * 0.6 && rel < 0) {
        const bounce = Math.max(7.6, -rel * 0.86 + Math.max(0, padVel.y) * 0.35);
        vel.x += (bounce - rel) * nx + padVel.x * 0.18 + along * 0.9;
        vel.y += (bounce - rel) * ny;
        vel.x = THREE.MathUtils.clamp(vel.x, -7, 7);
        vel.y = Math.min(vel.y, 12.5);
        pos.x = pad.x + nx * (R + 0.07) + ny * along;
        pos.y = pad.y + ny * (R + 0.07) - nx * along;
        squash = 1;
        if (playing) {
          setScore(score + 1);
          if (audioCtx) GuitarAudio.tock(audioCtx, 820 + Math.random() * 160);
        }
      }
    }
    if (pos.y < FLOOR - 1.5) {
      if (playing) gameOver();
      pos.set(pad.x, 2.4);
      vel.set(0, 0);
    }

    squash = damp(squash, 0, 14, dt);
    ball.position.set(pos.x, pos.y, 0);
    ball.scale.set(1 + squash * 0.22, 1 - squash * 0.28, 1 + squash * 0.22);
    ball.rotation.z -= vel.x * dt * 2;

    paddleRig.position.set(pad.x, pad.y, 0);
    paddleRig.rotation.z = tilt;

    const hgt = Math.max(0, pos.y - FLOOR);
    const k = 1 / (1 + hgt * 0.35);
    ballShadow.position.x = pos.x;
    ballShadow.scale.setScalar(0.5 + hgt * 0.3);
    (ballShadow.material as THREE.MeshBasicMaterial).opacity = k;
    paddleShadow.position.set(pad.x, FLOOR, 0.4);
    paddleShadow.scale.set(2.6, 1, 2.4);
    (paddleShadow.material as THREE.MeshBasicMaterial).opacity = 0.55;
  });

  return stage;
}
