import * as THREE from 'three';
import { cel, flat } from '../core/toon.js';
import { PAL } from '../core/palette.js';
import { bake, trs, sagCurve } from '../core/util.js';

/* ------------------------------------------------------------------ *
 * Набор инструментов для билдеров мира.
 *
 * Мир авторится на плоскости: x -- восток, z -- север, y -- вверх, метры.
 * Всё статичное складывается в Batch и в конце сливается по материалам:
 * несколько десятков draw call'ов вместо тысяч.  Текстурированное и
 * анимированное добавляется отдельными мешами.
 * ------------------------------------------------------------------ */

/** Материал по цвету -- cel с общей сине-зелёной тенью. */
export const M = (color, opts = {}) => cel({ color, tint: PAL.shadowTint, ...opts });
export const F = (color, opts = {}) => flat({ color, ...opts });

const boxCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  if (!boxCache.has(k)) boxCache.set(k, new THREE.BoxGeometry(w, h, d));
  return boxCache.get(k);
}

export class Batch {
  constructor() {
    this.parts = new Map();
  }
  /** Добавить геометрию (в локальных координатах) с матрицей. */
  geo(geometry, mat, matrix = null, { cast = true, receive = true } = {}) {
    const key = mat.uuid + (cast ? 'c' : '') + (receive ? 'r' : '');
    if (!this.parts.has(key)) this.parts.set(key, { mat, cast, receive, list: [] });
    this.parts.get(key).list.push({ geometry, matrix: matrix ? matrix.clone() : null });
  }
  /**
   * Коробка, стоящая основанием на y.  ry -- поворот вокруг вертикали,
   * rx/rz -- наклоны (для откосов, горок, козырьков).
   */
  box(w, h, d, mat, x, y, z, ry = 0, rx = 0, rz = 0, opts) {
    const m = trs(0, 0, 0).compose(
      new THREE.Vector3(x, y + h / 2, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
      new THREE.Vector3(1, 1, 1)
    );
    // пересчёт: хотим, чтобы основание было на y даже при наклоне -- для
    // небольших наклонов этого достаточно
    this.geo(boxGeo(w, h, d), mat, m, opts);
  }
  /** Коробка по двум углам в плане (x0..x1, z0..z1) и высотам y0..y1. */
  slab(x0, z0, x1, z1, y0, y1, mat, opts) {
    this.box(Math.abs(x1 - x0), y1 - y0, Math.abs(z1 - z0), mat, (x0 + x1) / 2, y0, (z0 + z1) / 2, 0, 0, 0, opts);
  }
  cyl(rt, rb, h, seg, mat, x, y, z, rx = 0, ry = 0, rz = 0, opts) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1)
    );
    // y здесь -- центр цилиндра, а не основание: так проще для труб и перекладин
    this.geo(g, mat, m, opts);
  }
  /** Труба между двумя точками. */
  pipe(a, b, r, mat, seg = 6, opts) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    this.geo(g, mat, new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)), opts);
  }
  flush(root, name = 'batch') {
    for (const { mat, cast, receive, list } of this.parts.values()) {
      if (!list.length) continue;
      const mesh = new THREE.Mesh(bake(list), mat);
      mesh.castShadow = cast && !mat.transparent;
      mesh.receiveShadow = receive;
      mesh.name = name;
      root.add(mesh);
    }
    this.parts.clear();
  }
}

/**
 * Провода: провисающие трубки между точками.  Очень тонкая геометрия, в тень
 * не идёт.
 */
export function wires(batch, runs, mat) {
  for (const { points, sag = 0.5, r = 0.022 } of runs) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const d = a.distanceTo(b);
      const curve = sagCurve(a, b, sag * Math.min(2.2, d / 14), 16);
      batch.geo(new THREE.TubeGeometry(curve, 18, r, 4, false), mat, null, { cast: false, receive: false });
    }
  }
}

/** Плоскость с текстурой, повёрнутая лицом по ry (0 = лицом на +z). */
export function decal(root, tex, w, h, x, y, z, ry = 0, { alpha = false, lit = true, rx = 0 } = {}) {
  const mat = lit
    ? cel({ map: tex, tint: PAL.shadowTint, transparent: alpha, alphaTest: alpha ? 0.35 : 0, cache: false })
    : flat({ map: tex, transparent: alpha, alphaTest: alpha ? 0.35 : 0, cache: false });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, 0, 'YXZ');
  m.receiveShadow = true;
  m.userData.noShadow = true;
  root.add(m);
  return m;
}

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
