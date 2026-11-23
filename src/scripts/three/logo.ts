// Das Logo-T als massives 3D-Objekt, extrudiert aus denselben Pfaden wie das flache Logo (src/data/logo.ts).
import * as THREE from 'three';
import { T_PARTS, T_SIZE } from '../../data/logo';

/** Pfad mit den Befehlen M, L, C, Z (absolute Koordinaten) → THREE.Shape, y gespiegelt */
function shapeFromPath(d: string) {
  const s = new THREE.Shape();
  const tok = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? [];
  let i = 0;
  let cmd = '';
  const num = () => parseFloat(tok[i++]);
  while (i < tok.length) {
    if (/[MLCZ]/.test(tok[i])) {
      cmd = tok[i++];
      if (cmd === 'Z') {
        s.closePath();
        continue;
      }
    }
    if (cmd === 'M') {
      s.moveTo(num(), -num());
      cmd = 'L';
    } else if (cmd === 'L') s.lineTo(num(), -num());
    else if (cmd === 'C') s.bezierCurveTo(num(), -num(), num(), -num(), num(), -num());
    else i++;
  }
  return s;
}

/** Höhe = `height` Welt-Einheiten, Mitte im Ursprung. Der Stamm liegt vor den Armen. */
export function makeLogoT(mat: THREE.Material, height = 2.6) {
  const g = new THREE.Group();
  const k = height / T_SIZE.h;
  const part = (d: string, depth: number) => {
    const bevel = 1.3;
    const geo = new THREE.ExtrudeGeometry(shapeFromPath(d), {
      depth,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelOffset: -bevel,
      bevelSegments: 3,
      curveSegments: 20,
    });
    geo.translate(-T_SIZE.w / 2, T_SIZE.h / 2, -depth / 2);
    geo.scale(k, k, k);
    g.add(new THREE.Mesh(geo, mat));
  };
  part(T_PARTS.left, 9);
  part(T_PARTS.right, 9);
  part(T_PARTS.stem, 14);
  return g;
}
