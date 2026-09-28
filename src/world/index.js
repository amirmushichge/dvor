import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { Batch, M, F, V, wires, decal } from './kit.js';
import { buildPlanet, bakeToPlanet } from './planet.js';
import { makePanel9, makeKhrush } from './buildings.js';
import { buildYardGround, buildPlayground, buildYardLife } from './yard.js';
import { buildStreet, buildTram } from './street.js';
import { buildGarages } from './garages.js';
import { buildTrees, buildShrubs } from './nature.js';
import { facadeTex } from '../core/textures.js';

/* ------------------------------------------------------------------ *
 * Сборка мира.
 *
 * Расстановка здесь -- работа композиции, а не симуляции: каждый предмет
 * стоит там, где он работает на стартовый кадр из арки.  Ракета -- чуть
 * правее центра, выбивалка с ковром слева, «семёрка» у открытого гаража
 * справа, тополя закрывают верхние углы, провода уводят взгляд вверх.
 *
 * План (плоские координаты, x -- восток, z -- север):
 *
 *        z=90  ┌──────── хрущёвка №9 (север) ────────┐
 *              │                                      │
 *   хрущёвка   │   домино   бельё      клён           │  ракушки
 *   №5 (запад) │      карусель  турник                │  x = 21
 *   x = -31    │   лодочка     РАКЕТА   песочница     │  «семёрка»
 *              │   выбивалка         мяч              │
 *        z=24  └──── девятиэтажка ул. Строителей 7 ───┘
 *                       АРКА (x = 0)  ← камера
 *        z=0   ═══════════ трамвайные пути ═══════════
 * ------------------------------------------------------------------ */

/** Поставить дом из локальных координат в мир: поворот ry, начало (ox, oz). */
function place(ctx, { group, boxes }, ox, oz, ry) {
  group.position.set(ox, 0, oz);
  group.rotation.y = ry;
  ctx.root.add(group);
  for (const { mesh, note } of group.userData.inscriptions || []) ctx.inscription(mesh, note);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const bx of boxes) {
    const pts = [[bx.x0, bx.z0], [bx.x1, bx.z0], [bx.x0, bx.z1], [bx.x1, bx.z1]]
      .map(([lx, lz]) => [ox + lx * c + lz * s, oz - lx * s + lz * c]);
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    ctx.collide(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs));
  }
}

/** Дальний дом: коробка с текстурным фасадом, без деталей. */
function farBlock(ctx, x0, z0, x1, z1, h, kind, seed, faces = 'all') {
  const w = x1 - x0, d = z1 - z0;
  const floors = Math.round(h / 2.8);
  const texX = facadeTex(kind, seed).clone();
  texX.needsUpdate = true;
  texX.wrapS = texX.wrapT = THREE.RepeatWrapping;
  texX.repeat.set(Math.max(1, Math.round(w / 3.2)) / 4, floors / 4);
  const texZ = facadeTex(kind, seed + 1).clone();
  texZ.needsUpdate = true;
  texZ.wrapS = texZ.wrapT = THREE.RepeatWrapping;
  texZ.repeat.set(Math.max(1, Math.round(d / 3.2)) / 4, floors / 4);
  const fx = M(0xffffff, { map: texX, cache: false });
  const fz = M(0xffffff, { map: texZ, cache: false });
  const roof = M(PAL.roofTar);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [fz, fz, roof, roof, fx, fx]);
  mesh.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  ctx.root.add(mesh);
  ctx.collide(x0, z0, x1, z1);
}

export function buildWorld(scene) {
  const root = new THREE.Group();
  root.name = 'world';
  scene.add(root);

  const colliders = [];
  const pads = [];
  const interactables = [];
  const ticks = [];
  const after = [];

  const ctx = {
    scene,
    root,
    add: (o) => root.add(o),
    collide(x0, z0, x1, z1, top) {
      colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), top });
    },
    /** Прямоугольник, по которому ходят на высоте top (крыльцо, тротуар). */
    pad(x0, z0, x1, z1, top) {
      pads.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), top });
    },
    interact(hitbox, label, action) { interactables.push({ hitbox, label, action }); },
    inscription(hitbox, note) { interactables.push({ hitbox, label: 'Read inscription', note }); },
    tick(fn) { ticks.push(fn); },
    afterBake(fn) { after.push(fn); },
  };

  /* ---------------------------------- дома ---------------------------------- */
  // Девятиэтажка: лицом во двор (на север), задом на улицу.  Арка по центру.
  const panel = makePanel9({
    len: 60, depth: 12, floors: 9, seed: 7,
    arch: { x0: 28.2, x1: 31.8, h: 3.8 },
    entrances: [
      { x: 9.2, n: 1, flats: [1, 36], color: PAL.paintTeal },
      { x: 38.0, n: 2, flats: [37, 72], color: PAL.paintBrown },
      { x: 47.6, n: 3, flats: [73, 108], color: PAL.paintGreen },
    ],
    address: ['ул. Строителей', 7],
    graffitiArch: true,
  });
  place(ctx, panel, 30, 24, Math.PI);

  // Хрущёвка на западе -- лицом на восток, во двор.
  const kw = makeKhrush({
    len: 42, depth: 11.5, seed: 11,
    entrances: [{ x: 8, n: 1, flats: [1, 20] }, { x: 21, n: 2, flats: [21, 40] }, { x: 34, n: 3, flats: [41, 60] }],
    address: ['ул. Строителей', 5],
    endGraffiti: 'Ария',
  });
  place(ctx, kw, -31, 30, -Math.PI / 2);

  // Хрущёвка на севере -- лицом на юг.
  const kn = makeKhrush({
    len: 46, depth: 11.5, seed: 23, brick: 0xc99a6e,
    entrances: [{ x: 8, n: 1, flats: [1, 20] }, { x: 23, n: 2, flats: [21, 40] }, { x: 38, n: 3, flats: [41, 60] }],
    address: ['ул. Гагарина', 12],
  });
  place(ctx, kn, -26, 78, 0);

  /* ------------------------------- двор, улица ------------------------------- */
  buildYardGround(ctx);
  buildPlayground(ctx);
  buildYardLife(ctx);
  buildGarages(ctx);
  buildStreet(ctx);
  const tram = buildTram(ctx);

  /* ------------------------------- деревья ------------------------------- */
  buildTrees(ctx, [
    // тополя по периметру двора
    { x: -21.5, z: 41, seed: 3 }, { x: -22, z: 54, seed: 4 }, { x: -20.5, z: 67.5, seed: 5 },
    { x: -12.5, z: 33.6, seed: 6, scale: 0.9 }, { x: 10.2, z: 34.2, seed: 7 }, { x: 9.8, z: 66.5, seed: 8 },
    { x: -9, z: 68.2, seed: 9, scale: 1.05 },
    // за гаражами
    { x: 27, z: 38, seed: 10 }, { x: 27.5, z: 52, seed: 11, scale: 1.1 }, { x: 26.5, z: 66, seed: 12 },
    // вдоль улицы, за путями
    { x: -40, z: -8.5, seed: 13 }, { x: -14, z: -8.3, seed: 14 }, { x: 14, z: -8.6, seed: 15 }, { x: 42, z: -8.4, seed: 16 },
    // за северным домом и по краям
    { x: -38, z: 96, seed: 17 }, { x: -8, z: 97, seed: 18 }, { x: 24, z: 95, seed: 19 },
    { x: 36, z: 30, seed: 20 }, { x: 38, z: 58, seed: 21 }, { x: -48, z: 50, seed: 22 },
    // клёны
    { x: -1.5, z: 63.5, kind: 'maple', seed: 30 }, { x: 4.5, z: 61.8, kind: 'maple', seed: 31, scale: 0.9 },
    { x: -16, z: 47.5, kind: 'maple', seed: 32, scale: 0.85 },
  ]);
  buildShrubs(ctx, [
    [-23.4, 32, -23.4, 44, 101], [-23.4, 58, -23.4, 68, 102],
    [-22, 69.3, -10, 69.3, 103], [-6, 69.3, 11, 69.3, 104],
    [-28, 11, -5, 11, 105], [5, 11, 28, 11, 106],
  ]);

  /* --------------------- столбы и провода над двором --------------------- */
  const b = new Batch();
  const poleM = M(PAL.concrete);
  const polePts = [V(-24.6, 0, 32), V(-24.6, 0, 50), V(-24.6, 0, 68), V(12.6, 0, 69), V(12.6, 0, 47), V(12.6, 0, 31.4)];
  for (const p of polePts) {
    b.cyl(0.11, 0.15, 8.5, 8, poleM, p.x, 4.25, p.z);
    b.box(1.2, 0.08, 0.08, M(PAL.metalDark), p.x, 8.0, p.z);
    b.box(0.35, 0.12, 0.6, M(PAL.metal), p.x + (p.x < 0 ? 0.4 : -0.4), 7.3, p.z);
    ctx.collide(p.x - 0.18, p.z - 0.18, p.x + 0.18, p.z + 0.18);
  }
  const top = (p, dx = 0, h = 8.05) => V(p.x + dx, h, p.z);
  wires(b, [
    { points: polePts.slice(0, 3).map((p) => top(p, -0.5)), sag: 0.7 },
    { points: polePts.slice(0, 3).map((p) => top(p, 0.5)), sag: 0.75 },
    { points: polePts.slice(3).map((p) => top(p, -0.5)), sag: 0.7 },
    { points: polePts.slice(3).map((p) => top(p, 0.5)), sag: 0.72 },
    { points: [top(polePts[2], 0.5), top(polePts[3], -0.5)], sag: 1.0 },
    // вводы к домам -- провода, которые уводят взгляд вверх в стартовом кадре
    { points: [top(polePts[0], 0.5), V(-8, 12.5, 24.1)], sag: 0.9 },
    { points: [top(polePts[5], -0.5), V(6, 11.8, 24.1)], sag: 0.8 },
    { points: [top(polePts[1], 0.5), V(-31.1, 9.5, 46)], sag: 0.4 },
    { points: [top(polePts[4], -0.5), top(polePts[1], 0.5)], sag: 1.6 },
  ], M(PAL.wire));
  b.flush(root, 'poles');

  /* ------------------------- окружение за пределами ------------------------- */
  // квартал продолжается: дальние дома -- коробки с текстурными фасадами
  farBlock(ctx, 40, 20, 52, 80, 25.2, 'panel', 3);
  farBlock(ctx, -80, 22, -68, 76, 14, 'brick', 4);
  farBlock(ctx, -30, 104, 30, 116, 25.2, 'white', 5);
  farBlock(ctx, 60, 90, 72, 140, 14, 'brick', 6);
  farBlock(ctx, -64, 96, -44, 108, 14, 'brick', 7);
  // за трамвайными путями: другая сторона улицы
  farBlock(ctx, -70, -34, -18, -22, 14, 'brick', 8);
  farBlock(ctx, -8, -36, 48, -24, 25.2, 'panel', 9);
  farBlock(ctx, 60, -32, 84, -20, 14, 'white', 10);

  /* -------------------------------- планета -------------------------------- */
  buildPlanet(scene);
  const stats = bakeToPlanet(root);
  after.forEach((fn) => fn());

  // Высота под ногами: верх самого высокого пада, на который можно шагнуть.
  const heightAt = (x, z, curY = 0) => {
    let h = 0.03;
    for (const p of pads) {
      if (x < p.x0 || x > p.x1 || z < p.z0 || z > p.z1) continue;
      if (p.top > h && p.top <= curY + 0.45) h = p.top;
    }
    return h;
  };

  return {
    root,
    colliders,
    interactables,
    heightAt,
    bounds: { z0: -9.8, z1: 100 },
    tram,
    stats,
    update(dt) { for (const t of ticks) t(dt); },
  };
}
