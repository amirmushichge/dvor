import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { rngKit } from '../core/util.js';
import { Batch, M, F, decal, V } from './kit.js';
import { carpetTex, mushroomTex, hopscotchTex, graffiti } from '../core/textures.js';
import { graffitiNotes, hopscotchNote } from '../content/inscriptions.js';

/* ------------------------------------------------------------------ *
 * Двор: земля, дорожки, детская площадка, выбивалка, лавочки, бельё.
 *
 * Мировые координаты (плоскость до изгиба на планету):
 *   x -- восток, z -- север.  Трамвай идёт по z = 0.
 *   Девятиэтажка -- южная сторона двора, дворовый фасад на z = 24.
 *   Хрущёвка     -- западная сторона, фасад на x = -31.
 *   Вторая хрущёвка -- северная сторона, фасад на z = 78.
 *   «Ракушки»    -- восточная сторона.
 * Камера на старте стоит в арке (x = 0, z ≈ 18.5) и смотрит на север.
 * ------------------------------------------------------------------ */

/** Плоский пласт земли/асфальта: толщина 4 см, верх на y. */
function pad(b, x0, z0, x1, z1, y, mat) {
  b.slab(x0, z0, x1, z1, y - 0.04, y, mat, { cast: false, receive: true });
}

export function buildYardGround(ctx) {
  const b = new Batch();
  const asph = M(PAL.asphalt, { bands: 3 });
  const asphOld = M(PAL.asphaltOld, { bands: 3 });
  const curb = M(PAL.curb);
  const dirt = M(PAL.dirt, { bands: 3 });
  const grassDeep = M(PAL.grassDeep, { bands: 3 });
  const grassDry = M(PAL.grassDry, { bands: 3 });

  // проезд вдоль девятиэтажки со стороны двора
  pad(b, -30, 24, 30, 30.5, 0.02, asph);
  // тротуар-отмостка вдоль фасада
  b.slab(-30, 24, 30, 25.6, 0, 0.12, M(PAL.concrete), { cast: false });
  ctx.pad(-30, 24, 30, 25.6, 0.12);
  // проезд вдоль хрущёвки
  pad(b, -30.5, 30.5, -24, 78, 0.021, asph);
  b.slab(-31, 26, -29.6, 78, 0, 0.12, M(PAL.concrete), { cast: false });
  ctx.pad(-31, 26, -29.6, 78, 0.12);
  // проезд вдоль северного дома и к гаражам
  pad(b, -24, 70, 22, 76, 0.022, asphOld);
  pad(b, 12, 30.5, 17.5, 70, 0.023, asphOld);
  b.slab(-26, 76.6, 22, 78, 0, 0.12, M(PAL.concrete), { cast: false });
  ctx.pad(-26, 76.6, 22, 78, 0.12);

  // бордюры по краю проездов -- дают тушью чёткую линию
  const kerb = (x0, z0, x1, z1) => b.slab(x0, z0, x1, z1, 0, 0.14, curb, { cast: false });
  kerb(-24, 30.5, -1.6, 30.7);
  kerb(1.6, 30.5, 12, 30.7);
  kerb(-24.2, 30.7, -24, 70);
  kerb(-24, 69.8, 12, 70);
  kerb(11.8, 30.7, 12, 69.8);

  // дорожка из арки через двор к площадке: старый асфальт, местами трещины
  pad(b, -1.6, 12, 1.6, 30.6, 0.024, asphOld);
  pad(b, -1.3, 30.6, 1.3, 40, 0.025, asphOld);
  // площадка: утрамбованная земля, песок под качелями
  pad(b, -12, 38, 11, 60, 0.012, dirt);
  // вытоптанные тропинки и лысины в траве
  pad(b, -24, 45, -12, 46.4, 0.01, dirt);
  pad(b, 11, 50, 12, 51.3, 0.01, dirt);
  pad(b, -20, 62, -8, 68, 0.006, grassDry);
  pad(b, 13, 72, 20, 78, 0.006, grassDry);
  pad(b, -23, 32, -14, 40, 0.005, grassDeep);

  // газонное ограждение: низкие гнутые трубы, выкрашенные в два цвета
  const pipeA = M(PAL.paintGreen), pipeB = M(PAL.paintYellow);
  for (let x = -23; x < -2; x += 1.4) {
    const m = (Math.round(x) % 2 === 0) ? pipeA : pipeB;
    b.pipe(V(x, 0, 31.2), V(x, 0.45, 31.2), 0.025, m, 5);
    b.pipe(V(x + 1.4, 0, 31.2), V(x + 1.4, 0.45, 31.2), 0.025, m, 5);
    b.pipe(V(x, 0.45, 31.2), V(x + 1.4, 0.45, 31.2), 0.025, m, 5);
  }

  // классики мелом на проезде у арки
  const hop = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.8),
    F(0xffffff, { map: hopscotchTex(), transparent: true, depthWrite: false, cache: false }));
  hop.rotation.x = -Math.PI / 2;
  hop.rotation.z = 0.2;
  hop.position.set(5.2, 0.035, 27.3);
  hop.renderOrder = 1;
  ctx.root.add(hop);
  ctx.inscription(hop, hopscotchNote);

  b.flush(ctx.root, 'yardGround');
}

/* ============================== ДЕТСКАЯ ПЛОЩАДКА ============================== */

/**
 * Горка-ракета: трубчатый каркас из колец, конус-обтекатель, стабилизаторы
 * и скат.  Самый узнаваемый предмет советского двора -- главная фигура кадра.
 */
function rocket(ctx, x, z) {
  const b = new Batch();
  const red = M(PAL.paintRed), yellow = M(PAL.paintYellow), blue = M(PAL.paintBlue), white = M(PAL.paintWhite);
  const R = 0.95, H = 5.2;
  const nPost = 6;
  for (let i = 0; i < nPost; i++) {
    const a = (i / nPost) * Math.PI * 2;
    b.pipe(V(x + Math.cos(a) * R, 0, z + Math.sin(a) * R), V(x + Math.cos(a) * R * 0.92, H, z + Math.sin(a) * R * 0.92), 0.04, white, 6);
  }
  // кольца-обручи разного цвета
  const rings = [0.5, 1.2, 1.9, 2.5, 3.2, 3.9, 4.5, H];
  rings.forEach((y, i) => {
    const t = new THREE.TorusGeometry(R * (1 - (y / H) * 0.08), 0.045, 5, 20);
    t.rotateX(Math.PI / 2);
    b.geo(t, [red, yellow, blue][i % 3], new THREE.Matrix4().makeTranslation(x, y, z));
  });
  // площадка внутри на 2.5 м
  b.cyl(R * 0.9, R * 0.9, 0.08, 16, M(PAL.metal), x, 2.5, z);
  // обтекатель
  const cone = new THREE.ConeGeometry(R * 0.95, 1.8, 16);
  b.geo(cone, red, new THREE.Matrix4().makeTranslation(x, H + 0.9, z));
  b.cyl(0.03, 0.03, 0.9, 5, white, x, H + 2.2, z);
  // стабилизаторы
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0.9, 0); s.lineTo(0, 1.6); s.closePath();
    const fin = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false });
    fin.translate(0, 0, -0.025);
    const m = new THREE.Matrix4().compose(
      V(x + Math.cos(a) * R * 0.95, 0, z + Math.sin(a) * R * 0.95),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)),
      V(1, 1, 1)
    );
    b.geo(fin, blue, m);
  }
  // лесенка внутри
  for (let y = 0.3; y < 2.5; y += 0.32) b.box(0.6, 0.04, 0.04, M(PAL.metal), x, y, z + R * 0.75);
  // скат: наклонный жёлоб с бортиками -- толще и с видимым металлом торца,
  // чтобы не читался плоской наклейкой на земле
  const L = 4.6, ang = Math.atan2(2.5, 3.9);
  const dir = new THREE.Vector3(Math.cos(-0.45), 0, Math.sin(-0.45)); // в сторону арки
  const cx = x + dir.x * (R + 1.95), cz = z + dir.z * (R + 1.95);
  const ry = Math.atan2(-dir.z, dir.x);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, -ang, 'YXZ'));
  const slideGeo = new THREE.BoxGeometry(L, 0.12, 0.62);
  b.geo(slideGeo, M(PAL.chrome), new THREE.Matrix4().compose(V(cx, 1.25 + 0.1, cz), q, V(1, 1, 1)));
  for (const s of [-1, 1]) {
    const side = new THREE.BoxGeometry(L, 0.18, 0.04);
    const off = new THREE.Vector3(0, 0.1, s * 0.3).applyQuaternion(q);
    b.geo(side, yellow, new THREE.Matrix4().compose(V(cx + off.x, 1.25 + 0.1 + off.y, cz + off.z), q, V(1, 1, 1)));
  }
  b.pipe(V(cx + dir.x * 1.9, 0, cz + dir.z * 1.9), V(cx + dir.x * 1.9, 0.3, cz + dir.z * 1.9), 0.035, white);
  b.flush(ctx.root, 'rocket');
  ctx.collide(x - R, z - R, x + R, z + R);
}

/**
 * Качели-лодочка: две А-образные стойки, перекладина, лодка на четырёх
 * тягах.  Лодка -- жёсткий риг с шарниром на перекладине, раскачивается по E.
 */
function boatSwing(ctx, x, z) {
  const b = new Batch();
  const frame = M(PAL.paintBlue);
  const H = 2.7, W = 1.9, spread = 1.1;
  for (const sx of [-W / 2, W / 2]) {
    b.pipe(V(x + sx, 0, z - spread), V(x + sx, H, z), 0.05, frame);
    b.pipe(V(x + sx, 0, z + spread), V(x + sx, H, z), 0.05, frame);
    b.pipe(V(x + sx, 0.9, z - spread * 0.67), V(x + sx, 0.9, z + spread * 0.67), 0.03, frame);
  }
  b.pipe(V(x - W / 2 - 0.1, H, z), V(x + W / 2 + 0.1, H, z), 0.055, frame);
  b.flush(ctx.root, 'swingFrame');

  // риг: pivot на перекладине
  const rig = new THREE.Group();
  rig.position.set(x, H, z);
  rig.userData.planetRigid = true;
  const pivot = new THREE.Group();
  rig.add(pivot);
  const hullMat = M(PAL.paintOrange), rodMat = M(PAL.metal), seatMat = M(PAL.wood);
  const chainMat = M(PAL.chrome, { bands: 2 });
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.3, 1.9), hullMat);
  hull.position.set(0, -2.25, 0);
  pivot.add(hull);
  for (const s of [-1, 1]) {
    const bow = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.5, 0.08), hullMat);
    bow.position.set(0, -2.05, s * 0.95);
    pivot.add(bow);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.3), seatMat);
    seat.position.set(0, -2.0, s * 0.62);
    pivot.add(seat);
    for (const sx of [-0.62, 0.62]) {
      // цепь толще и светлее корпуса лодки -- иначе на фоне тёмного оранжевого
      // борта она пропадает и лодка выглядит подвешенной в воздухе без опоры
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.95, 6), chainMat);
      rod.position.set(sx, -0.98, s * 0.3);
      rod.rotation.x = -s * 0.28;
      pivot.add(rod);
    }
  }
  rig.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 2.1), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, -2.1, 0);
  pivot.add(hit);
  ctx.root.add(rig);

  let amp = 0.22, phase = 0;
  ctx.interact(hit, 'Rock the boat', () => { amp = Math.min(0.75, amp + 0.35); });
  ctx.tick((dt) => {
    phase += dt * 2.05;
    amp = Math.max(0.03, amp * Math.exp(-0.12 * dt));
    pivot.rotation.x = Math.sin(phase) * amp;
  });
  ctx.collide(x - W / 2 - 0.1, z - spread, x - W / 2 + 0.1, z + spread);
  ctx.collide(x + W / 2 - 0.1, z - spread, x + W / 2 + 0.1, z + spread);
}

/** Песочница с грибком. */
function sandbox(ctx, x, z) {
  const b = new Batch();
  const S = 3.2;
  const wood = M(PAL.paintGreen);
  b.slab(x - S / 2, z - S / 2, x + S / 2, z + S / 2, 0, 0.18, M(PAL.sand), { cast: false });
  for (const [x0, z0, x1, z1] of [
    [x - S / 2, z - S / 2, x + S / 2, z - S / 2 + 0.22], [x - S / 2, z + S / 2 - 0.22, x + S / 2, z + S / 2],
    [x - S / 2, z - S / 2, x - S / 2 + 0.22, z + S / 2], [x + S / 2 - 0.22, z - S / 2, x + S / 2, z + S / 2],
  ]) b.slab(x0, z0, x1, z1, 0, 0.32, wood);
  // забытые игрушки: ведёрко и совок
  b.cyl(0.1, 0.075, 0.16, 8, M(PAL.paintRed), x + 0.6, 0.26, z - 0.4);
  b.box(0.08, 0.02, 0.35, M(PAL.paintBlue), x + 0.3, 0.19, z - 0.7, 0.6);
  // грибок
  b.cyl(0.07, 0.08, 2.1, 8, M(PAL.paintWhite), x, 1.05, z);
  b.flush(ctx.root, 'sandbox');
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.45, 0.7, 16, 1, true),
    M(0xffffff, { map: mushroomTex(), cache: false, side: THREE.DoubleSide }));
  cap.position.set(x, 2.35, z);
  cap.castShadow = true;
  cap.receiveShadow = true;
  ctx.root.add(cap);
  // коллайдер под шляпкой грибка -- радиус самой шляпки (1.45 м), а не
  // одного столбика: иначе машина или игрок проходят прямо под красной
  // шляпкой, которая по кадру нависает у самой земли
  ctx.collide(x - 1.3, z - 1.3, x + 1.3, z + 1.3, 2.35);
}

/** Карусель: диск на оси с поручнями, крутится по E. */
function carousel(ctx, x, z) {
  const rig = new THREE.Group();
  rig.position.set(x, 0, z);
  rig.userData.planetRigid = true;
  const spin = new THREE.Group();
  rig.add(spin);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.3, 8), M(PAL.metalDark));
  base.position.y = 0.15;
  rig.add(base);
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 0.07, 20), M(PAL.paintYellow));
  disk.position.y = 0.4;
  spin.add(disk);
  const railMat = M(PAL.paintRed);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6), railMat);
    post.position.set(Math.cos(a) * 1.1, 0.78, Math.sin(a) * 1.1);
    spin.add(post);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), railMat);
    bar.rotation.z = Math.PI / 2;
    bar.rotation.y = -a;
    bar.position.set(Math.cos(a) * 0.55, 1.12, Math.sin(a) * 0.55);
    spin.add(bar);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 8), railMat);
  hub.position.y = 0.8;
  spin.add(hub);
  rig.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.2, 12), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.7;
  rig.add(hit);
  ctx.root.add(rig);
  let w = 0.25;
  ctx.interact(hit, 'Spin the roundabout', () => { w = Math.min(4.5, w + 1.8); });
  ctx.tick((dt) => {
    w = Math.max(0.0, w * Math.exp(-0.35 * dt));
    spin.rotation.y += w * dt;
  });
  ctx.collide(x - 1.2, z - 1.2, x + 1.2, z + 1.2, 0.5);
}

/** Турник и шведская стенка -- «спортивный уголок». */
function sportCorner(ctx, x, z) {
  const b = new Batch();
  const m = M(PAL.paintTeal);
  b.pipe(V(x - 1, 0, z), V(x - 1, 2.3, z), 0.045, m);
  b.pipe(V(x + 1, 0, z), V(x + 1, 2.3, z), 0.045, m);
  b.pipe(V(x - 1.05, 2.3, z), V(x + 1.05, 2.3, z), 0.025, M(PAL.metal));
  // шведская стенка
  const x2 = x + 3.2;
  b.pipe(V(x2 - 0.5, 0, z), V(x2 - 0.5, 2.6, z), 0.04, m);
  b.pipe(V(x2 + 0.5, 0, z), V(x2 + 0.5, 2.6, z), 0.04, m);
  for (let y = 0.3; y < 2.6; y += 0.3) b.pipe(V(x2 - 0.5, y, z), V(x2 + 0.5, y, z), 0.022, M(PAL.metal), 5);
  b.flush(ctx.root, 'sport');
  ctx.collide(x - 1.05, z - 0.05, x - 0.95, z + 0.05);
  ctx.collide(x + 0.95, z - 0.05, x + 1.05, z + 0.05);
  ctx.collide(x2 - 0.55, z - 0.06, x2 + 0.55, z + 0.06);
}

export function buildPlayground(ctx) {
  rocket(ctx, 4.6, 49);
  boatSwing(ctx, -6.2, 43.5);
  sandbox(ctx, 7.8, 41.2);
  carousel(ctx, -3.2, 54.5);
  sportCorner(ctx, -9.5, 57.8);
}

/* =============================== БЫТ ДВОРА =============================== */

/** Советская лавочка: бетонные ноги, зелёные рейки, спинка. */
export function bench(ctx, x, z, ry = 0, { bag = false } = {}) {
  const b = new Batch();
  const c = Math.cos(ry), s = Math.sin(ry);
  const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const legM = M(PAL.concrete), slat = M(PAL.paintGreen);
  for (const lx of [-0.8, 0.8]) {
    const [px, pz] = P(lx, 0);
    b.box(0.12, 0.42, 0.5, legM, px, 0, pz, ry);
    const [bx, bz] = P(lx, 0.22);
    b.box(0.1, 0.5, 0.1, legM, bx, 0.42, bz, ry);
  }
  for (let i = 0; i < 3; i++) {
    const [px, pz] = P(0, -0.15 + i * 0.13);
    b.box(1.9, 0.04, 0.1, slat, px, 0.42, pz, ry);
  }
  for (let i = 0; i < 2; i++) {
    const [px, pz] = P(0, 0.25);
    b.box(1.9, 0.1, 0.035, slat, px, 0.6 + i * 0.16, pz, ry);
  }
  if (bag) {
    // пакет с семечками и газета
    const [px, pz] = P(0.45, -0.02);
    b.box(0.2, 0.22, 0.12, M(0xe9e2d0), px, 0.46, pz, ry + 0.3);
    const [nx, nz] = P(-0.3, -0.05);
    b.box(0.35, 0.02, 0.25, M(0xdedbd0), nx, 0.465, nz, ry - 0.2);
  }
  b.flush(ctx.root, 'bench');
  const [ax, az] = P(-0.95, -0.28), [bx2, bz2] = P(0.95, 0.3);
  ctx.collide(Math.min(ax, bx2), Math.min(az, bz2), Math.max(ax, bx2), Math.max(az, bz2), 0.5);
}

/** Выбивалка с ковром. */
function carpetBeater(ctx, x, z) {
  const b = new Batch();
  const m = M(PAL.paintSky);
  const W = 2.8, H = 2.05;
  for (const sx of [-W / 2, W / 2]) b.pipe(V(x + sx, 0, z), V(x + sx, H + 0.1, z), 0.04, m);
  b.pipe(V(x - W / 2, H, z), V(x + W / 2, H, z), 0.035, m);
  b.pipe(V(x - W / 2, 1.3, z), V(x + W / 2, 1.3, z), 0.03, m);
  // хлопушка, прислонённая к стойке
  b.pipe(V(x + W / 2 + 0.1, 0, z + 0.25), V(x + W / 2 + 0.02, 0.9, z + 0.05), 0.015, M(PAL.woodDark));
  b.flush(ctx.root, 'beater');
  // ковёр, перекинутый через перекладину: два полотна
  const mat = M(0xffffff, { map: carpetTex(), side: THREE.DoubleSide, cache: false, bands: 3 });
  for (const s of [-1, 1]) {
    const g = new THREE.PlaneGeometry(2.1, 1.55);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(x, H - 0.76, z + s * 0.07);
    mesh.rotation.x = s * 0.07;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    ctx.root.add(mesh);
  }
  ctx.collide(x - W / 2 - 0.05, z - 0.12, x + W / 2 + 0.05, z + 0.12, 2.2);
}

/** Бельевые верёвки: две Т-стойки и бельё. */
function laundry(ctx, x, z, len = 7) {
  const b = new Batch();
  const m = M(PAL.metal);
  const rng = rngKit(55);
  for (const dz of [0, len]) {
    b.pipe(V(x, 0, z + dz), V(x, 2.2, z + dz), 0.04, m);
    b.pipe(V(x - 0.9, 2.2, z + dz), V(x + 0.9, 2.2, z + dz), 0.03, m);
  }
  const cols = [0xf6f4ee, 0x9cc0dc, 0xe7b8a6, 0xe9df9a, 0xb7d0a8, 0xf0f0e8];
  for (const lx of [-0.7, 0, 0.7]) {
    b.pipe(V(x + lx, 2.18, z), V(x + lx, 2.05, z + len / 2), 0.008, M(0xe8e8e0), 3, { cast: false });
    b.pipe(V(x + lx, 2.05, z + len / 2), V(x + lx, 2.18, z + len), 0.008, M(0xe8e8e0), 3, { cast: false });
    let zz = z + 0.6;
    while (zz < z + len - 0.8) {
      const w = rng.range(0.4, 1.3);
      if (rng.chance(0.6)) {
        const h = rng.range(0.4, 0.9);
        b.box(0.015, h, w, M(rng.pick(cols), { side: THREE.DoubleSide }), x + lx, 2.1 - h, zz + w / 2);
      }
      zz += w + rng.range(0.1, 0.6);
    }
  }
  b.flush(ctx.root, 'laundry');
  ctx.collide(x - 0.05, z - 0.05, x + 0.05, z + 0.05);
  ctx.collide(x - 0.05, z + len - 0.05, x + 0.05, z + len + 0.05);
}

/** Клумба из покрышки, покрашенной в белый, и «лебедь» из шины. */
function tyreBeds(ctx, list) {
  const b = new Batch();
  for (const [x, z, col, swan] of list) {
    const t = new THREE.TorusGeometry(0.42, 0.14, 6, 14);
    t.rotateX(Math.PI / 2);
    b.geo(t, M(col), new THREE.Matrix4().makeTranslation(x, 0.14, z));
    b.cyl(0.36, 0.36, 0.2, 10, M(PAL.dirtDark), x, 0.12, z);
    // цветы -- бархатцы
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      b.box(0.12, 0.12, 0.12, M(i % 2 ? PAL.paintOrange : PAL.paintYellow), x + Math.cos(a) * 0.2, 0.22, z + Math.sin(a) * 0.2);
    }
    if (swan) {
      b.pipe(V(x + 0.35, 0.2, z), V(x + 0.45, 0.85, z), 0.07, M(PAL.paintWhite));
      b.box(0.22, 0.1, 0.08, M(PAL.paintRed), x + 0.52, 0.86, z);
    }
  }
  b.flush(ctx.root, 'tyres');
}

/** Столик для домино со скамейками. */
function dominoTable(ctx, x, z) {
  const b = new Batch();
  b.box(1.2, 0.72, 0.1, M(PAL.metalDark), x, 0, z);
  b.box(1.4, 0.05, 0.9, M(PAL.wood), x, 0.72, z);
  for (const s of [-1, 1]) {
    b.box(1.3, 0.42, 0.08, M(PAL.metalDark), x, 0, z + s * 0.75);
    b.box(1.4, 0.04, 0.3, M(PAL.wood), x, 0.42, z + s * 0.75);
  }
  // забытые кости домино
  for (let i = 0; i < 5; i++) b.box(0.05, 0.015, 0.1, M(0xf2efe6), x - 0.3 + i * 0.12, 0.77, z + (i % 2) * 0.08);
  b.flush(ctx.root, 'domino');
  ctx.collide(x - 0.7, z - 0.95, x + 0.7, z + 0.95, 0.75);
}

export function buildYardLife(ctx) {
  // лавочка у подъезда № 3 девятиэтажки (справа от арки)
  bench(ctx, -16.8, 27.3, Math.PI, { bag: true });
  bench(ctx, -7.5, 27.3, Math.PI);
  bench(ctx, 11.2, 44.5, Math.PI / 2);
  bench(ctx, -27.2, 50, -Math.PI / 2, { bag: false });
  carpetBeater(ctx, -17.5, 35.5);
  laundry(ctx, -19, 60);
  tyreBeds(ctx, [
    [-4.5, 32.2, PAL.paintWhite, false], [-6.3, 32.4, PAL.paintSky, true], [-8.1, 32.2, PAL.paintWhite, false],
    [4.2, 32.3, PAL.paintYellow, false], [6.0, 32.2, PAL.paintWhite, true],
    [-27.8, 36, PAL.paintWhite, false], [-27.8, 38, PAL.paintSky, false],
  ]);
  dominoTable(ctx, -13.5, 64);
  // забытый мяч
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), M(PAL.paintRed));
  ball.position.set(1.8, 0.12, 36.5);
  ball.castShadow = true;
  ctx.root.add(ball);
  // миски для кошек у продуха
  const b = new Batch();
  b.cyl(0.1, 0.08, 0.05, 8, M(0xd9d6cc), -21.6, 0.145, 25.9);
  b.cyl(0.1, 0.08, 0.05, 8, M(0x7aa0b8), -21.2, 0.145, 25.8);
  b.flush(ctx.root, 'bowls');
  // мелом на стене у подъезда
  ctx.inscription(decal(ctx.root, graffiti('Спартак — чемпион', '#f4f1e8', { chalk: true, tilt: 0.02 }), 2.2, 0.6, -25.5, 1.25, 23.96, 0, { alpha: true }), graffitiNotes.spartak);
}
