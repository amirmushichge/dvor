import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { cel } from '../core/toon.js';

/* ------------------------------------------------------------------ *
 * Планета.
 *
 * Слой проекции взят из Sakura Crossing (Kenton Wang, MIT) и упрощён:
 * без рельефа, без канала.  Весь двор по-прежнему *авторится* на плоской
 * плоскости XZ -- каждый билдер, коллайдер и запрос высоты работают на
 * плоскости, а этот модуль один раз после постройки изгибает мир на шар.
 *
 *     x -> долгота  (замыкается ровно через одну окружность)
 *     z -> широта
 *
 * Трамвайные пути проложены вдоль X при z = 0 -- это экватор, большой круг,
 * поэтому кольцо замыкается без шва и без искажений.  Двор лежит при
 * z = 10..140; на R = 150 сжатие по x там не больше 3 % (cos(40/150) = 0.965).
 * ------------------------------------------------------------------ */

export const R = 150;
export const CIRCUMFERENCE = 2 * Math.PI * R;
export const CENTER = new THREE.Vector3(0, -R, 0);
export const horizonFor = (h) => Math.sqrt(2 * R * h + h * h);

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _m = new THREE.Matrix4();

export function normalAt(x, z, out = new THREE.Vector3()) {
  const la = x / R, ph = z / R, cp = Math.cos(ph);
  return out.set(Math.sin(la) * cp, Math.cos(la) * cp, Math.sin(ph));
}

export function positionAt(x, y, z, out = new THREE.Vector3()) {
  return normalAt(x, z, out).multiplyScalar(R + y).add(CENTER);
}

export function basisAt(x, z, up = new THREE.Vector3(), east = new THREE.Vector3(), north = new THREE.Vector3()) {
  const la = x / R, ph = z / R;
  const sl = Math.sin(la), cl = Math.cos(la);
  const sp = Math.sin(ph), cp = Math.cos(ph);
  up.set(sl * cp, cl * cp, sp);
  east.set(cl, -sl, 0);
  north.set(-sl * sp, -cl * sp, cp);
  return { up, east, north };
}

export function frameAt(x, z, y = 0, out = new THREE.Matrix4()) {
  const b = basisAt(x, z);
  out.makeBasis(b.east, b.up, b.north);
  out.setPosition(positionAt(x, y, z, _v));
  return out;
}

export function flatAt(worldPos, out = { x: 0, z: 0, y: 0 }) {
  _v.copy(worldPos).sub(CENTER);
  const r = _v.length() || 1;
  _v.multiplyScalar(1 / r);
  out.z = R * Math.asin(THREE.MathUtils.clamp(_v.z, -1, 1));
  out.x = R * Math.atan2(_v.x, _v.y);
  out.y = r - R;
  return out;
}

export function wrapDelta(a, b) {
  let d = a - b;
  while (d > CIRCUMFERENCE / 2) d -= CIRCUMFERENCE;
  while (d < -CIRCUMFERENCE / 2) d += CIRCUMFERENCE;
  return d;
}

export function wrapX(x) {
  const c = CIRCUMFERENCE;
  return ((((x + c / 2) % c) + c) % c) - c / 2;
}

/* ---------------------------- изгиб геометрии ---------------------------- */

/**
 * Делит каждый треугольник с ребром длиннее maxEdge.  Без этого 940-метровый
 * рельс из двух вершин по длине прошёл бы хордой сквозь планету.  Группы
 * материалов протаскиваются через все проходы (см. длинный комментарий в
 * оригинале: без них меш с массивом материалов просто перестаёт рисоваться).
 */
function subdivideLongEdges(geo, maxEdge) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const max2 = maxEdge * maxEdge;
  const names = Object.keys(g.attributes);
  let arrays = names.map((n) => ({ name: n, size: g.attributes[n].itemSize, src: g.attributes[n].array }));
  let count = g.attributes.position.count;

  const srcGroups = geo.groups && geo.groups.length ? geo.groups : null;
  let gid = new Int32Array(count / 3);
  if (srcGroups) {
    for (const grp of srcGroups) {
      const t0 = Math.floor(grp.start / 3);
      const t1 = Math.min(gid.length, t0 + Math.floor(grp.count / 3));
      for (let t = t0; t < t1; t++) gid[t] = grp.materialIndex ?? 0;
    }
  }

  for (let pass = 0; pass < 14; pass++) {
    const pos = arrays.find((a) => a.name === 'position').src;
    let splits = 0;
    const out = arrays.map((a) => ({ name: a.name, size: a.size, src: a.src, dst: [] }));
    const gidOut = [];
    for (let t = 0; t < count; t += 3) {
      let worst = -1, wi = 0;
      for (let e = 0; e < 3; e++) {
        const a = t + e, b = t + ((e + 1) % 3);
        const dx = pos[a * 3] - pos[b * 3];
        const dy = pos[a * 3 + 1] - pos[b * 3 + 1];
        const dz = pos[a * 3 + 2] - pos[b * 3 + 2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > worst) { worst = d2; wi = e; }
      }
      if (worst <= max2) {
        for (const a of out) {
          for (let e = 0; e < 3; e++) for (let k = 0; k < a.size; k++) a.dst.push(a.src[(t + e) * a.size + k]);
        }
        gidOut.push(gid[t / 3]);
        continue;
      }
      splits++;
      gidOut.push(gid[t / 3], gid[t / 3]);
      const i0 = t + wi, i1 = t + ((wi + 1) % 3), i2 = t + ((wi + 2) % 3);
      for (const a of out) {
        const s = a.src, n = a.size;
        const mid = [];
        for (let k = 0; k < n; k++) mid.push((s[i0 * n + k] + s[i1 * n + k]) * 0.5);
        const push = (idx) => { for (let k = 0; k < n; k++) a.dst.push(s[idx * n + k]); };
        push(i0); a.dst.push(...mid); push(i2);
        a.dst.push(...mid); push(i1); push(i2);
      }
    }
    arrays = out.map((a) => ({ name: a.name, size: a.size, src: Float32Array.from(a.dst) }));
    gid = Int32Array.from(gidOut);
    count = arrays.find((a) => a.name === 'position').src.length / 3;
    if (!splits) break;
  }

  const result = new THREE.BufferGeometry();
  for (const a of arrays) result.setAttribute(a.name, new THREE.BufferAttribute(a.src, a.size));
  if (srcGroups) {
    let start = 0;
    for (let t = 1; t <= gid.length; t++) {
      if (t === gid.length || gid[t] !== gid[start]) {
        result.addGroup(start * 3, (t - start) * 3, gid[start]);
        start = t;
      }
    }
  }
  if (g !== geo) g.dispose();
  return result;
}

export function wrapGeometry(geo, maxEdge = 3.0) {
  const g = subdivideLongEdges(geo, maxEdge);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    positionAt(pos.getX(i), pos.getY(i), pos.getZ(i), v);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * Переносит уже построенный плоский мир на планету.
 *  - InstancedMesh        -> каждый экземпляр жёстко пересаживается на поверхность
 *  - userData.planetRigid -> группа пересаживается целиком, риг внутри цел
 *  - всё остальное        -> дробится и изгибается по вершинам
 */
export function bakeToPlanet(root, { maxEdge = 3.0 } = {}) {
  root.updateMatrixWorld(true);
  const underRigid = (o) => {
    for (let p = o.parent; p && p !== root.parent; p = p.parent) if (p.userData.planetRigid) return true;
    return false;
  };
  const rigid = [];
  root.traverse((o) => {
    if (o.userData.planetRigid && !underRigid(o)) rigid.push({ obj: o, world: o.matrixWorld.clone() });
  });
  const jobs = [];
  root.traverse((o) => {
    if (!o.isMesh && !o.isLine) return;
    if (o.userData.planetRigid || underRigid(o)) return;
    jobs.push({ obj: o, world: o.matrixWorld.clone() });
  });

  const stats = { wrapped: 0, instanced: 0, rigid: rigid.length, tris: 0 };
  for (const { obj, world } of jobs) {
    if (obj.isInstancedMesh) {
      const im = obj.instanceMatrix;
      for (let i = 0; i < obj.count; i++) {
        _m.fromArray(im.array, i * 16).premultiply(world);
        _m.decompose(_v, _q, _s);
        const b = basisAt(_v.x, _v.z);
        const fq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(b.east, b.up, b.north));
        const p = positionAt(_v.x, _v.y, _v.z, new THREE.Vector3());
        _m.compose(p, fq.multiply(_q), _s);
        _m.toArray(im.array, i * 16);
      }
      im.needsUpdate = true;
      obj.frustumCulled = false;
      stats.instanced += obj.count;
    } else {
      const flat = obj.geometry.clone().applyMatrix4(world);
      const bent = wrapGeometry(flat, obj.userData.maxEdge ?? maxEdge);
      flat.dispose();
      obj.geometry = bent;
      obj.frustumCulled = true;
      stats.wrapped++;
      stats.tris += bent.attributes.position.count / 3;
    }
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();
    obj.scale.set(1, 1, 1);
  }
  root.traverse((o) => {
    if (o === root || o.isMesh || o.isLine) return;
    if (o.userData.planetRigid || underRigid(o)) return;
    o.position.set(0, 0, 0);
    o.quaternion.identity();
    o.scale.set(1, 1, 1);
  });
  const fm = new THREE.Matrix4();
  for (const { obj, world } of rigid) {
    world.decompose(_v, _q, _s);
    const b = basisAt(_v.x, _v.z);
    fm.makeBasis(b.east, b.up, b.north);
    obj.position.copy(positionAt(_v.x, _v.y, _v.z, new THREE.Vector3()));
    obj.quaternion.setFromRotationMatrix(fm).multiply(_q);
    obj.scale.copy(_s);
  }
  return stats;
}

/* ------------------------------- сама сфера ------------------------------- */

/**
 * Земля планеты -- трава.  Лежит на 5 см ниже плоскости, на которую ставятся
 * все пятна асфальта и дорожки, поэтому им не с чем z-файтиться.
 * Нормали радиальные: иначе терминатор на cel-рампе лестницей.
 * Тень не отбрасывает: замкнутая сфера уронила бы весь мир в собственную тень.
 */
export function buildPlanet(scene) {
  const geo = new THREE.IcosahedronGeometry(R - 0.05, 36);
  const pos = geo.attributes.position;
  const nrm = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    nrm[i * 3] = v.x; nrm[i * 3 + 1] = v.y; nrm[i * 3 + 2] = v.z;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.translate(CENTER.x, CENTER.y, CENTER.z);
  const land = new THREE.Mesh(geo, cel({ color: PAL.grass, bands: 4, tint: PAL.shadowTint, flat: false }));
  land.receiveShadow = true;
  land.castShadow = false;
  land.frustumCulled = false;
  land.name = 'planetLand';
  scene.add(land);
  return land;
}
