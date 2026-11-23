// Ein einzelnes Objekt zum Anfassen: dreht sich von selbst, lässt sich mit Schwung anstossen.
import * as THREE from 'three';
import { Stage, addStudioLights, damp, reducedMotion } from './stage';
import { makePick, makeGolfBall, makePaddle } from './objects';
import { makeCap } from './cap';

const MAKERS = {
  cap: () => makeCap(),
  pick: () => makePick(),
  golf: () => makeGolfBall(true),
  paddle: () => makePaddle(true),
};
export type ViewerKind = keyof typeof MAKERS;

export function initViewer(el: HTMLElement, kind: ViewerKind, opts: { scale?: number; tilt?: number } = {}) {
  const stage = new Stage(el, { fov: 30 });
  stage.camera.position.set(0, 0, 7.5);
  addStudioLights(stage.scene);
  const obj = MAKERS[kind]();
  const spin = new THREE.Group();
  const rig = new THREE.Group();
  spin.add(obj);
  rig.add(spin);
  rig.rotation.x = opts.tilt ?? 0.25;
  rig.scale.setScalar(opts.scale ?? 1.5);
  stage.scene.add(rig);

  let vy = 0.6;
  let vx = 0;
  let dragging = false;
  let lx = 0;
  let ly = 0;
  el.addEventListener('pointerdown', (e) => {
    dragging = true;
    lx = e.clientX;
    ly = e.clientY;
    el.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lx;
    const dy = e.clientY - ly;
    lx = e.clientX;
    ly = e.clientY;
    spin.rotation.y += dx * 0.012;
    rig.rotation.x = THREE.MathUtils.clamp(rig.rotation.x + dy * 0.008, -1.1, 1.1);
    vy = dx * 0.012 * 60;
    vx = dy * 0.008 * 60;
  });
  const end = () => {
    dragging = false;
    el.classList.remove('is-dragging');
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);

  stage.onFrame((dt, t) => {
    if (!dragging) {
      vy = damp(vy, reducedMotion ? 0 : 0.55, 1.4, dt);
      vx = damp(vx, 0, 3, dt);
      spin.rotation.y += vy * dt;
      rig.rotation.x = damp(rig.rotation.x + vx * dt, opts.tilt ?? 0.25, 1.2, dt);
    }
    rig.position.y = reducedMotion ? 0 : Math.sin(t * 1.1) * 0.08;
  });
  return stage;
}
