import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { rngKit, trs } from '../core/util.js';
import { cel, flat } from '../core/toon.js';
import { Batch, M } from './kit.js';
import { fluffTex } from '../core/textures.js';

/* ------------------------------------------------------------------ *
 * Деревья и пух.
 *
 * Тополь -- главное дерево советского двора: высокий, узкий, с крупной
 * кроной из множества фасетных комков.  Приём тот же, что у сакуры в
 * оригинале: мелкие лоу-поли сферы трёх тонов, светлые наверху, тёмные
 * внизу.  Крона *не принимает* тень (иначе самозатенение даёт тёмные дыры),
 * но отбрасывает -- это и даёт пятнистую тень на асфальте.
 * ------------------------------------------------------------------ */

export function buildTrees(ctx, spots) {
  const wood = [];
  const blobs = [[], [], []];
  const trunkGeo = new THREE.CylinderGeometry(0.7, 1.0, 1, 7, 1);
  const blobGeo = new THREE.IcosahedronGeometry(1, 0);

  for (const s of spots) {
    const rng = rngKit(s.seed ?? Math.round(s.x * 31 + s.z * 17));
    const kind = s.kind ?? 'poplar';
    const S = s.scale ?? 1;
    if (kind === 'poplar') {
      const H = rng.range(13, 17) * S;
      const tr = 0.3 * S;
      wood.push({ geometry: trunkGeo, matrix: trs(s.x, H * 0.3, s.z, 0, 0, 0, tr, H * 0.6, tr) });
      // несколько ветвей-«метёлок» вверх
      for (let i = 0; i < 4; i++) {
        const a = rng.range(0, Math.PI * 2);
        wood.push({
          geometry: trunkGeo,
          matrix: trs(s.x + Math.cos(a) * 0.5, H * 0.52, s.z + Math.sin(a) * 0.5, Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25, tr * 0.4, H * 0.3, tr * 0.4),
        });
      }
      // крона: вытянутое облако комков от 30% до 100% высоты
      const n = 46 + rng.int(0, 14);
      for (let i = 0; i < n; i++) {
        const t = rng.range(0.28, 1.0);
        const y = H * t;
        const rad = (2.4 * Math.sin(Math.PI * Math.min(1, (t - 0.2) / 0.85)) + 0.6) * S;
        const a = rng.range(0, Math.PI * 2);
        const rr = rad * Math.sqrt(rng.next());
        const r = rng.range(0.85, 1.45) * S;
        const tone = t > 0.72 ? 0 : t > 0.46 ? (rng.chance(0.6) ? 1 : 0) : (rng.chance(0.65) ? 2 : 1);
        blobs[tone].push(trs(s.x + Math.cos(a) * rr, y, s.z + Math.sin(a) * rr, rng.range(0, 3), rng.range(0, 3), 0, r, r * 1.15, r));
      }
    } else {
      // клён / липа: ниже и шире
      const H = rng.range(6, 8) * S;
      const tr = 0.22 * S;
      wood.push({ geometry: trunkGeo, matrix: trs(s.x, H * 0.25, s.z, 0, 0, 0, tr, H * 0.5, tr) });
      const n = 26 + rng.int(0, 8);
      for (let i = 0; i < n; i++) {
        const t = rng.range(0.42, 1.0);
        const a = rng.range(0, Math.PI * 2);
        const rr = 2.6 * S * Math.sqrt(rng.next()) * Math.sin(Math.PI * Math.min(1, t * 0.95));
        const r = rng.range(0.7, 1.2) * S;
        const tone = t > 0.78 ? 0 : t > 0.58 ? 1 : 2;
        blobs[tone].push(trs(s.x + Math.cos(a) * rr, H * t, s.z + Math.sin(a) * rr, rng.range(0, 3), rng.range(0, 3), 0, r, r, r));
      }
    }
    ctx.collide(s.x - 0.35 * S, s.z - 0.35 * S, s.x + 0.35 * S, s.z + 0.35 * S);
  }

  const b = new Batch();
  for (const p of wood) b.geo(p.geometry, M(PAL.trunkPoplar), p.matrix);
  b.flush(ctx.root, 'trunks');

  const tones = [PAL.leafLight, PAL.leaf, PAL.leafDeep];
  blobs.forEach((list, i) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(blobGeo, cel({ color: tones[i], tint: PAL.shadowTint, bands: 'soft3' }), list.length);
    list.forEach((m, k) => mesh.setMatrixAt(k, m));
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.name = 'canopy';
    ctx.root.add(mesh);
  });
}

/** Кусты сирени/акации вдоль фасадов. */
export function buildShrubs(ctx, rows) {
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const list = [];
  for (const [x0, z0, x1, z1, seed] of rows) {
    const rng = rngKit(seed);
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.floor(len / 0.8);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const r = rng.range(0.55, 0.95);
      list.push(trs(x0 + (x1 - x0) * t + rng.range(-0.3, 0.3), r * 0.7, z0 + (z1 - z0) * t + rng.range(-0.3, 0.3),
        rng.range(0, 3), rng.range(0, 3), 0, r, r * 0.9, r));
    }
  }
  const mesh = new THREE.InstancedMesh(geo, cel({ color: PAL.leafDeep, tint: PAL.shadowTint, bands: 3 }), list.length);
  list.forEach((m, k) => mesh.setMatrixAt(k, m));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  ctx.root.add(mesh);
}

/**
 * Тополиный пух.
 *
 * Пушинки -- спрайты, живущие не в плоском мире, а прямо вокруг камеры в
 * мировом пространстве: облако радиусом ~22 м, которое медленно дрейфует по
 * ветру и пересобирается вокруг игрока, если он ушёл.  Поэтому пуху не нужна
 * проекция на планету: он всегда там, где смотрят.
 */
const Y_AXIS = new THREE.Vector3(0, 1, 0);

export function buildFluff(scene, camera, { count = 700, radius = 22 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() * 2 - 1) * radius;
    pos[i * 3 + 1] = Math.random() * 10 - 1;
    pos[i * 3 + 2] = (Math.random() * 2 - 1) * radius;
    seed[i] = Math.random() * 100;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: fluffTex(),
    color: PAL.fluff,
    size: 0.16,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    alphaTest: 0.02,
    fog: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  scene.add(points);

  const center = new THREE.Vector3();
  const up = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let t = 0;
  let first = true;
  return {
    points,
    update(dt) {
      t += dt;
      // опора облака -- камера; «вверх» -- от центра планеты
      up.copy(camera.up);
      if (first || center.distanceTo(camera.position) > radius * 0.5) {
        const shift = tmp.copy(camera.position).sub(center);
        if (!first) {
          // сдвиг в локальную рамку облака, чтобы пушинки не прыгнули
          shift.applyQuaternion(points.quaternion.clone().invert());
          for (let i = 0; i < count; i++) {
            pos[i * 3] -= shift.x; pos[i * 3 + 1] -= shift.y; pos[i * 3 + 2] -= shift.z;
          }
        }
        center.copy(camera.position);
        first = false;
      }
      points.position.copy(center);
      // облако ориентировано по местной вертикали планеты, иначе на краю
      // двора пух падал бы наискосок
      points.quaternion.setFromUnitVectors(Y_AXIS, up.normalize());
      const wind = 0.55;
      for (let i = 0; i < count; i++) {
        const s = seed[i];
        let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        x += (wind + Math.sin(t * 0.7 + s) * 0.35) * dt;
        z += (Math.cos(t * 0.5 + s * 1.3) * 0.3 - 0.15) * dt;
        y += (Math.sin(t * 1.1 + s * 0.7) * 0.25 - 0.08) * dt;
        // дрейф в локальной рамке камеры-без-наклона не нужен: облако маленькое,
        // а ветер условный.  Заворачиваем в куб вокруг центра.
        if (x > radius) x -= radius * 2; else if (x < -radius) x += radius * 2;
        if (z > radius) z -= radius * 2; else if (z < -radius) z += radius * 2;
        if (y < -2) y += 12; else if (y > 10) y -= 12;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
