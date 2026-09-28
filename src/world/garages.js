import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { rngKit } from '../core/util.js';
import { hullOutline } from '../core/outline.js';
import { Batch, M, F, decal, V } from './kit.js';
import { plateTex, graffiti } from '../core/textures.js';
import { graffitiNotes } from '../content/inscriptions.js';

/* ------------------------------------------------------------------ *
 * Гаражи-«ракушки» и машины.
 *
 * «Ракушка» -- сборный стальной гараж с полукруглой крышей и воротами
 * спереди.  Красили кто во что горазд, ржавчина лезет снизу.
 * ------------------------------------------------------------------ */

const SHELL_COLS = [0x6f8f7a, 0x7c9cb4, 0xa9a58f, 0x8b6a55, 0x5f7c8c, 0xb4a27a, 0x6e7f5a];

/**
 * Одна ракушка.  Ворота смотрят на -x (во двор).  x, z -- центр основания.
 * open -- на сколько приоткрыта одна створка (0..1).
 */
function shell(b, root, rng, x, z, { col, open = 0 } = {}) {
  const L = 5.6, W = 3.0, Hw = 1.55;   // длина (по x), ширина (по z), высота стенки
  const mat = M(col ?? rng.pick(SHELL_COLS));
  const rust = M(PAL.rust);
  // стенки
  b.box(L, Hw, 0.05, mat, x, 0, z - W / 2);
  b.box(L, Hw, 0.05, mat, x, 0, z + W / 2);
  b.box(0.05, Hw, W, mat, x + L / 2, 0, z);
  // полукруглая крыша: половина цилиндра вдоль x
  const roof = new THREE.CylinderGeometry(W / 2, W / 2, L, 14, 1, true, 0, Math.PI);
  roof.rotateZ(Math.PI / 2);
  roof.rotateX(Math.PI / 2);
  // после поворотов полуцилиндр лежит вдоль x выпуклостью вверх, сплющиваем по высоте
  const m = new THREE.Matrix4().compose(V(x, Hw, z), new THREE.Quaternion(), V(1, 0.5, 1));
  b.geo(roof, M(col ?? SHELL_COLS[0], { side: THREE.DoubleSide }), m);
  // рёбра жёсткости на крыше
  for (let i = -2; i <= 2; i++) {
    const t = new THREE.TorusGeometry(W / 2 + 0.02, 0.025, 4, 12, Math.PI);
    t.rotateY(Math.PI / 2);
    b.geo(t, mat, new THREE.Matrix4().compose(V(x + i * 1.2, Hw, z), new THREE.Quaternion(), V(1, 0.5, 1)));
  }
  // ржавый низ
  b.box(L + 0.02, 0.3, W + 0.04, rust, x, 0, z);
  // ворота: фронтон-полукруг и две створки
  const gx = x - L / 2;
  const tymp = new THREE.CircleGeometry(W / 2, 14, 0, Math.PI);
  tymp.rotateY(-Math.PI / 2);
  b.geo(tymp, mat, new THREE.Matrix4().compose(V(gx, Hw, z), new THREE.Quaternion(), V(1, 0.5, 1)));
  const leaf = W / 2 - 0.02;
  // левая створка -- закрыта
  b.box(0.05, Hw, leaf, mat, gx, 0, z - leaf / 2 - 0.01);
  // правая -- приоткрыта на угол
  const ang = open * 1.1;
  const hx = gx, hz = z + W / 2;
  const cx = hx - Math.sin(ang) * leaf / 2, cz = hz - Math.cos(ang) * leaf / 2;
  b.box(0.05, Hw, leaf, mat, cx, 0, cz, ang);
  // замок-«ухо», ручки
  b.box(0.08, 0.2, 0.1, M(PAL.metalDark), gx - 0.04, 0.9, z - 0.08);
  if (open > 0) {
    // тёмная щель, но не пустая: слабый тёплый отблеск в глубине --
    // иначе приоткрытый гараж читается как чёрная дыра, а не как помещение
    b.box(0.04, Hw, W - 0.2, F(0x33363c), gx + 0.5, 0, z);
    b.box(0.5, 0.5, 0.06, F(0x5a4a38), gx + 0.35, 0.6, z + 0.6);
  }
  return { x0: x - L / 2, z0: z - W / 2, x1: x + L / 2, z1: z + W / 2 };
}

/**
 * ВАЗ-2107 цвета «баклажан»: угловатый трёхобъёмник, хромированные бамперы,
 * вертикальная решётка радиатора.  Смотрит капотом на -z (вдоль проезда).
 */
export function makeZhiguli(color = PAL.aubergine, plate = 'а 347 кс 73') {
  const g = new THREE.Group();
  const b = new Batch();
  const body = M(color), chrome = M(PAL.chrome), glass = M(PAL.glassDark, { bands: 2 }), tyre = M(PAL.tyre);
  const L = 4.13, W = 1.62;
  // нижний объём
  b.box(W, 0.62, L, body, 0, 0.3, 0);
  // салон: крыша чуть уже, стойки, стёкла
  b.box(W - 0.14, 0.56, 1.9, glass, 0, 0.92, 0.15);
  b.box(W - 0.2, 0.06, 1.75, body, 0, 1.48, 0.18);
  for (const dz of [-0.72, 0.15, 1.02]) {
    for (const s of [-1, 1]) b.box(0.06, 0.56, 0.08, body, s * (W / 2 - 0.1), 0.92, dz);
  }
  // лобовое и заднее стекло -- наклонённые пластины
  b.box(W - 0.2, 0.62, 0.05, glass, 0, 0.9, -0.92, 0, -0.55);
  b.box(W - 0.2, 0.58, 0.05, glass, 0, 0.9, 1.25, 0, 0.5);
  // бамперы, решётка, фары
  b.box(W + 0.04, 0.1, 0.1, chrome, 0, 0.42, -L / 2 - 0.02);
  b.box(W + 0.04, 0.1, 0.1, chrome, 0, 0.42, L / 2 + 0.02);
  b.box(0.8, 0.22, 0.03, M(PAL.metalDark), 0, 0.6, -L / 2 - 0.005);
  for (let i = 0; i < 9; i++) b.box(0.02, 0.2, 0.035, chrome, -0.36 + i * 0.09, 0.61, -L / 2 - 0.01);
  for (const s of [-1, 1]) {
    b.box(0.28, 0.2, 0.04, F(0xf6efd8), s * 0.6, 0.62, -L / 2 - 0.01);
    b.box(0.3, 0.15, 0.04, M(0xc0322d), s * 0.6, 0.64, L / 2 + 0.01);
    // молдинг
    b.box(0.02, 0.04, L - 0.4, chrome, s * (W / 2 + 0.005), 0.62, 0);
  }
  // колёса с колпаками
  for (const [dx, dz] of [[-1, -1.25], [1, -1.25], [-1, 1.2], [1, 1.2]]) {
    b.cyl(0.3, 0.3, 0.18, 12, tyre, dx * (W / 2 - 0.08), 0.3, dz, 0, 0, Math.PI / 2);
    b.cyl(0.16, 0.16, 0.19, 10, chrome, dx * (W / 2 - 0.07), 0.3, dz, 0, 0, Math.PI / 2);
  }
  b.flush(g, 'zhiguli');
  decal(g, plateTex(plate), 0.52, 0.11, 0, 0.42, -L / 2 - 0.085, Math.PI);
  decal(g, plateTex(plate), 0.52, 0.11, 0, 0.55, L / 2 + 0.03, 0);
  return g;
}

/** «Москвич-2141» -- округлый хэтчбек, для разнообразия. */
function makeMoskvich(color) {
  const g = new THREE.Group();
  const b = new Batch();
  const body = M(color), glass = M(PAL.glassDark, { bands: 2 }), tyre = M(PAL.tyre);
  b.box(1.68, 0.66, 4.3, body, 0, 0.3, 0);
  b.box(1.52, 0.55, 2.3, glass, 0, 0.96, 0.35);
  b.box(1.45, 0.06, 2.0, body, 0, 1.5, 0.35);
  b.box(1.5, 0.66, 0.05, glass, 0, 0.9, 1.75, 0, 0.75);
  b.box(1.72, 0.14, 0.12, M(PAL.metalDark), 0, 0.3, -2.17);
  b.box(1.72, 0.14, 0.12, M(PAL.metalDark), 0, 0.3, 2.17);
  for (const [dx, dz] of [[-1, -1.35], [1, -1.35], [-1, 1.3], [1, 1.3]]) {
    b.cyl(0.31, 0.31, 0.19, 12, tyre, dx * 0.76, 0.31, dz, 0, 0, Math.PI / 2);
  }
  b.flush(g, 'moskvich');
  return g;
}

export function buildGarages(ctx) {
  const b = new Batch();
  const rng = rngKit(2001);
  // ряд ракушек вдоль восточной стороны двора, воротами на запад (к проезду)
  const x = 21;
  const zs = [33, 36.2, 39.4, 42.6, 45.8, 49.0, 52.2, 55.4, 58.6, 61.8, 65.0];
  zs.forEach((z, i) => {
    const box = shell(b, ctx.root, rng, x, z, { col: SHELL_COLS[(i * 3) % SHELL_COLS.length], open: i === 3 ? 0.55 : 0 });
    ctx.collide(box.x0, box.z0, box.x1, box.z1);
  });
  // граффити на крайнем гараже
  ctx.inscription(decal(ctx.root, graffiti('ГАЗ-53 — сила!', '#f4f1e8', { chalk: true }), 2.0, 0.5, 18.18, 1.0, 36.2, -Math.PI / 2, { alpha: true }), graffitiNotes.gaz);
  ctx.inscription(decal(ctx.root, graffiti('НЕ ПАРКОВАТЬСЯ!', '#c23a30', { tilt: 0.03 }), 2.2, 0.6, 18.17, 1.05, 52.2, -Math.PI / 2, { alpha: true }), graffitiNotes.parking);
  // старая покрышка и бочка у открытого гаража
  const t = new THREE.TorusGeometry(0.3, 0.12, 6, 12);
  t.rotateX(Math.PI / 2);
  b.geo(t, M(PAL.tyre), new THREE.Matrix4().makeTranslation(17.4, 0.12, 44.4));
  b.geo(t, M(PAL.tyre), new THREE.Matrix4().makeTranslation(17.4, 0.36, 44.4));
  b.cyl(0.3, 0.3, 0.9, 10, M(PAL.rust), 17.6, 0.45, 40.8);
  ctx.collide(17.1, 40.5, 18.0, 41.1);
  b.flush(ctx.root, 'garages');

  // «семёрка» у открытого гаража -- второй главный предмет кадра.
  // Отодвинута на 0.6 м от гаражного ряда (было впритык к стене на 0.9 м
  // при длине кузова 4.13 м -- капот на скриншоте казался утопленным в стену)
  const car = makeZhiguli(PAL.aubergine);
  car.position.set(15.2, 0.02, 43.4);
  car.rotation.y = 0.08;
  ctx.root.add(car);
  car.traverse((o) => { if (o.isMesh && o.name === 'zhiguli') hullOutline(o, { thickness: 0.003 }); });
  ctx.collide(14.3, 41.2, 16.1, 45.6);

  // ещё машины во дворе
  const m1 = makeMoskvich(0x9fb3a8);
  m1.position.set(-27.0, 0.02, 57);
  ctx.root.add(m1);
  // раньше пятно коллайдера машины залезало под соседнюю клумбу и грибок --
  // сдвинуто и сужено по факту габаритов «Москвича» (1.68 x 4.3 м + запас)
  ctx.collide(-27.9, 54.9, -26.1, 59.1);
  const z2 = makeZhiguli(0xd9d2b8, 'в 912 ор 73');
  z2.position.set(-9.8, 0.02, 73.0);
  z2.rotation.y = Math.PI / 2;
  ctx.root.add(z2);
  ctx.collide(-11.9, 72.1, -7.7, 73.9);
  const z3 = makeZhiguli(0x3f6f9a, 'к 208 ва 73');
  z3.position.set(8.0, 0.02, 27.4);
  z3.rotation.y = -Math.PI / 2;
  ctx.root.add(z3);
  ctx.collide(5.9, 26.5, 10.1, 28.3);
}
