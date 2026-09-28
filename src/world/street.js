import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { rngKit } from '../core/util.js';
import { hullOutline } from '../core/outline.js';
import { Batch, M, F, decal, V, wires } from './kit.js';
import { CIRCUMFERENCE, CENTER, R, wrapX, wrapDelta } from './planet.js';
import { tramRouteSign, tramNumber } from '../core/textures.js';
import { tramNote } from '../content/inscriptions.js';

/* ------------------------------------------------------------------ *
 * Улица и трамвай.
 *
 * Пути лежат на экваторе (z = 0) и обходят планету целиком -- как железная
 * дорога в оригинале.  Правило то же: **конструкция идёт по всему кругу,
 * обстановка -- нет**.  Рельсы, шпальная полоса и контактный провод замкнуты;
 * асфальт, тротуары, опоры и остановка есть только возле двора.  На дальней
 * стороне планеты трамвай идёт по голым рельсам через траву.
 *
 * Трамвай строится один раз в плоских координатах при x = 0, изгибается
 * вместе со всем миром, а потом *вращается* вокруг оси Z планеты: движение по
 * экватору и есть такой поворот, поэтому никакой перепроекции по кадрам.
 * ------------------------------------------------------------------ */

const GAUGE = 1.524;          // русская колея
const WIRE_Y = 6.0;
export const STOP_X = -22;    // остановка «ул. Строителей»

export function buildStreet(ctx) {
  const b = new Batch();
  const C = CIRCUMFERENCE;

  // ---- кольцо: шпальная полоса и рельсы (на всю окружность) ----
  b.slab(-C / 2, -1.6, C / 2, 1.6, -0.04, 0.0, M(0x8d8778, { bands: 3 }), { cast: false });
  for (const s of [-1, 1]) {
    b.slab(-C / 2, s * GAUGE / 2 - 0.04, C / 2, s * GAUGE / 2 + 0.04, 0.0, 0.07, M(PAL.metal), { cast: false });
  }
  // контактный провод -- тоже по всему кругу
  b.slab(-C / 2, -0.012, C / 2, 0.012, WIRE_Y, WIRE_Y + 0.024, M(PAL.wire), { cast: false, receive: false });

  // ---- возле двора: асфальт с рельсами заподлицо, тротуары ----
  const X0 = -90, X1 = 90;
  b.slab(X0, -6.5, X1, 8.5, -0.02, 0.03, M(PAL.asphalt, { bands: 3 }), { cast: false });
  // межрельсовое пространство чуть темнее -- «тропа» трамвая
  b.slab(X0, -1.1, X1, 1.1, 0.03, 0.034, M(PAL.asphaltDark, { bands: 3 }), { cast: false });
  for (const s of [-1, 1]) {
    // рельс шире и светлее асфальта под ним, чтобы читался с дальней камеры
    b.slab(X0, s * GAUGE / 2 - 0.05, X1, s * GAUGE / 2 + 0.05, 0.028, 0.09, M(PAL.chrome, { bands: 2 }), { cast: false });
  }
  // разметка: прерывистая осевая по обе стороны от путей
  for (let x = X0; x < X1; x += 6) {
    b.slab(x, -2.6, x + 3, -2.48, 0.03, 0.036, M(PAL.white), { cast: false });
    b.slab(x, 2.48, x + 3, 2.6, 0.03, 0.036, M(PAL.white), { cast: false });
  }
  // тротуары
  b.slab(X0, 8.5, X1, 12, 0, 0.14, M(PAL.concrete), { cast: false });
  b.slab(X0, 8.5, X1, 8.7, 0, 0.18, M(PAL.curb));
  b.slab(X0, -10, X1, -6.5, 0, 0.14, M(PAL.concrete), { cast: false });
  b.slab(X0, -6.7, X1, -6.5, 0, 0.18, M(PAL.curb));
  ctx.pad(X0, 8.5, X1, 12, 0.14);
  ctx.pad(X0, -10, X1, -6.5, 0.14);

  // ---- опоры контактной сети: бетонные, с кронштейном над путями ----
  const pole = M(PAL.concrete), arm = M(PAL.metalDark);
  const runs = [];
  for (let x = X0 + 6; x < X1; x += 24) {
    b.cyl(0.13, 0.18, 8.2, 8, pole, x, 4.1, 9.3);
    b.pipe(V(x, 7.0, 9.3), V(x, 6.45, 0), 0.035, arm);
    b.pipe(V(x, 7.6, 9.3), V(x, 6.6, 3), 0.02, arm);
    // фонарь-«кобра» на той же опоре
    b.pipe(V(x, 7.9, 9.3), V(x, 8.2, 7.4), 0.04, arm);
    b.box(0.35, 0.14, 0.7, M(PAL.metal), x, 8.08, 7.2);
    ctx.collide(x - 0.2, 9.1, x + 0.2, 9.5);
    runs.push(V(x, 7.4, 9.3));
  }
  // телефонная линия вдоль опор
  wires(b, [{ points: runs, sag: 0.6, r: 0.016 }], M(PAL.wire));

  // ---- остановка: павильон с навесом и табличкой ----
  const sx = STOP_X;
  b.slab(sx - 5, 8.5, sx + 5, 10.6, 0, 0.22, M(PAL.concreteDark), { cast: false });
  ctx.pad(sx - 5, 8.5, sx + 5, 10.6, 0.22);
  const frame = M(PAL.paintBlue);
  for (const dx of [-2.2, 2.2]) {
    b.box(0.08, 2.4, 0.08, frame, sx + dx, 0.22, 11.6);
    b.box(0.08, 2.4, 0.08, frame, sx + dx, 0.22, 10.2);
    ctx.collide(sx + dx - 0.06, 10.15, sx + dx + 0.06, 11.65);
  }
  b.box(4.8, 0.1, 1.9, M(PAL.metal), sx, 2.62, 10.9, 0, -0.06);
  b.box(4.4, 1.9, 0.04, M(PAL.glass, { transparent: true, opacity: 0.4 }), sx, 0.5, 11.62);
  b.box(3.2, 0.05, 0.36, M(PAL.wood), sx, 0.64, 11.3);
  b.box(3.2, 0.42, 0.06, M(PAL.metalDark), sx, 0.22, 11.3);
  // табличка «Т» на столбике
  b.cyl(0.04, 0.04, 2.6, 6, M(PAL.metal), sx + 3.4, 1.52, 9.2);
  b.box(0.5, 0.5, 0.04, M(PAL.white), sx + 3.4, 2.6, 9.2);
  ctx.inscription(decal(ctx.root, tramRouteSign(7, 'ул. Строителей'), 1.1, 0.2, sx + 3.4, 2.4, 9.15, Math.PI), {
    original: '7 · ул. Строителей', translation: 'Route 7 · Builders Street',
    context: 'The stop names the street by the courtyard. “Строителей” means “of the builders,” a common street name honouring construction workers.',
  });
  b.box(0.3, 0.3, 0.042, M(0xd23a33), sx + 3.4, 2.7, 9.2);

  b.flush(ctx.root, 'street');
}

/* ================================ ТРАМВАЙ ================================ */

/**
 * Трамвай в духе Tatra T3: красный низ, кремовый верх, тёмная лента окон,
 * скошенные торцы, пантограф.  Двигатель -- поворот вокруг оси планеты.
 */
export function buildTram(ctx) {
  const g = new THREE.Group();
  g.name = 'tram';
  const b = new Batch();
  const L = 14.6, W = 2.5, H0 = 0.55, H1 = 3.15;
  const red = M(PAL.tramRed), cream = M(PAL.tramCream), dark = M(PAL.glassDark, { bands: 2 });
  const y0 = 0.07;
  // кузов
  b.box(L - 1.2, 1.0, W, red, 0, y0 + H0, 0);
  b.box(L - 1.2, 0.95, W, cream, 0, y0 + H0 + 1.0, 0);
  b.box(L - 1.2, 0.18, W, red, 0, y0 + H0 + 1.95, 0);
  b.box(L - 1.2, 0.5, W - 0.2, cream, 0, y0 + H0 + 2.13, 0);
  // лента окон -- чуть утоплена
  b.box(L - 1.6, 0.85, W + 0.02, dark, 0, y0 + H0 + 1.07, 0);
  for (let i = -5; i <= 5; i++) b.box(0.1, 0.85, W + 0.05, cream, i * 1.15, y0 + H0 + 1.07, 0);
  // торцы: скошенные, со стеклом
  for (const s of [-1, 1]) {
    const xe = s * (L / 2 - 0.6);
    b.box(1.2, 1.0, W - 0.3, red, xe + s * 0.05, y0 + H0, 0);
    b.box(0.9, 1.1, W - 0.4, dark, xe + s * 0.25, y0 + H0 + 1.0, 0, 0, 0, s * 0.18);
    b.box(1.0, 0.45, W - 0.4, cream, xe + s * 0.05, y0 + H0 + 2.05, 0);
    // фары и бампер
    for (const dz of [-0.75, 0.75]) b.cyl(0.11, 0.11, 0.06, 10, F(0xfff4d0), xe + s * 0.66, y0 + H0 + 0.45, dz, 0, 0, Math.PI / 2);
    b.box(0.12, 0.2, W - 0.2, M(PAL.metalDark), xe + s * 0.62, y0 + 0.4, 0);
    // маршрутный указатель
    b.box(0.08, 0.26, 1.3, F(0xf4f2ea), xe + s * 0.57, y0 + H0 + 2.25, 0);
  }
  // двери -- три пары на правом борту (+z), тёмные
  for (const dx of [-5.2, 0, 5.2]) {
    b.box(1.3, 2.25, 0.04, M(0x7a2a25), dx, y0 + H0 - 0.2, W / 2 + 0.01);
    b.box(0.04, 2.1, 0.05, M(PAL.metalDark), dx, y0 + H0 - 0.1, W / 2 + 0.02);
  }
  // тележки
  for (const dx of [-3.8, 3.8]) {
    b.box(2.6, 0.45, W - 0.5, M(PAL.metalDark), dx, y0 + 0.1, 0);
    for (const wx of [-0.9, 0.9]) {
      for (const s of [-1, 1]) b.cyl(0.35, 0.35, 0.12, 12, M(PAL.tyre), dx + wx, y0 + 0.35, s * GAUGE / 2, Math.PI / 2, 0, 0);
    }
  }
  // крыша: пантограф и короба
  b.box(3.0, 0.3, 1.4, M(PAL.metal), -1.0, y0 + H1, 0);
  b.box(2.2, 0.25, 1.2, M(PAL.metal), 3.8, y0 + H1, 0);
  const pm = M(PAL.metalDark);
  b.pipe(V(-2.0, y0 + H1 + 0.3, -0.5), V(-1.0, WIRE_Y - 0.9, 0), 0.03, pm);
  b.pipe(V(-2.0, y0 + H1 + 0.3, 0.5), V(-1.0, WIRE_Y - 0.9, 0), 0.03, pm);
  b.pipe(V(-1.0, WIRE_Y - 0.9, 0), V(-0.2, WIRE_Y - 0.05, -0.5), 0.025, pm);
  b.pipe(V(-1.0, WIRE_Y - 0.9, 0), V(-0.2, WIRE_Y - 0.05, 0.5), 0.025, pm);
  b.box(0.12, 0.05, 1.6, pm, -0.2, WIRE_Y - 0.05, 0);
  b.flush(g, 'tramBody');

  for (const s of [-1, 1]) {
    const xe = s * (L / 2 - 0.6);
    const sign = decal(g, tramRouteSign(7, 'Завод'), 1.25, 0.24, xe + s * 0.62, y0 + H0 + 2.25, 0, s * Math.PI / 2, { lit: false });
    sign.userData.noShadow = true;
    ctx.inscription(sign, tramNote);
  }
  decal(g, tramNumber(1047), 0.7, 0.35, 2.5, y0 + H0 + 0.55, W / 2 + 0.01, 0, { lit: false });
  decal(g, tramNumber(1047), 0.7, 0.35, -2.5, y0 + H0 + 0.55, -W / 2 - 0.01, Math.PI, { lit: false });

  // трамвай стоит на плоскости «при x = 0», z = 0; смещение по ширине пути 0
  g.userData.maxEdge = 1.5;
  g.traverse((o) => { if (o.isMesh) o.userData.maxEdge = 1.5; });
  ctx.root.add(g);

  /* После изгиба: переподвешиваем на ось планеты и запускаем. */
  let pivot = null;
  let x = 60;             // текущая долгота
  let v = 9.0;            // м/с
  let dwell = 0;
  const VMAX = 9.0;
  ctx.afterBake(() => {
    pivot = new THREE.Group();
    pivot.position.copy(CENTER);
    ctx.scene.add(pivot);
    ctx.scene.attach(g); // сохраняет мировую позицию (она identity после bake)
    pivot.add(g);
    g.position.set(0, R, 0);
    g.traverse((o) => {
      if (o.isMesh && o.name === 'tramBody') hullOutline(o, { thickness: 0.0032 });
    });
  });

  // Трамвай едет на восток (+x), тормозит к остановке, стоит, уезжает.
  // Круг ~1070 м: мимо двора он проходит примерно раз в две минуты.
  ctx.tick((dt) => {
    if (!pivot) return;
    const d = wrapDelta(STOP_X, x); // сколько осталось до остановки
    if (dwell > 0) {
      dwell -= dt;
      v = 0;
      if (dwell <= 0) x += 0.3; // чтобы не залипнуть на остановке
    } else if (d > 0 && d < 30) {
      v = Math.max(0.6, Math.min(VMAX, Math.sqrt(2 * 1.3 * d)));
      if (d < 0.25) { dwell = 7; v = 0; }
    } else {
      v = Math.min(VMAX, v + dt * 1.1);
    }
    x = wrapX(x + v * dt);
    pivot.rotation.z = -x / R;
  });

  return {
    get x() { return x; },
    set x(val) { x = wrapX(val); if (pivot) pivot.rotation.z = -x / R; },
  };
}
