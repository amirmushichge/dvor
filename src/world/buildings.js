import * as THREE from 'three';
import { PAL } from '../core/palette.js';
import { rngKit } from '../core/util.js';
import { Batch, M, F, decal } from './kit.js';
import { entrancePlate, doorTex, tileTex, graffiti, noticeSheet, addressPlate } from '../core/textures.js';
import { graffitiNotes, noticeNote, entranceNote, addressNote } from '../content/inscriptions.js';

/* ------------------------------------------------------------------ *
 * Дома.
 *
 * Каждый билдер строит дом в ЛОКАЛЬНЫХ координатах:
 *   x  -- вдоль фасада, от 0 до len
 *   z  -- в глубину, от 0 (лицевой, дворовый фасад, смотрит в -z) до depth
 *   y  -- вверх
 * и возвращает { group, boxes } -- группу и коллайдеры в тех же локальных
 * координатах.  index.js ставит группу на место и переводит коробки в мир.
 *
 * Почти всё, что делает дом «постсоветским», -- это разнобой, который
 * жильцы навели сами за тридцать лет: каждая лоджия застеклена по-своему,
 * тарелки, решётки на первом этаже, разные шторы.  Поэтому здесь много rng.
 * ------------------------------------------------------------------ */

const CURTAINS = [0xd9b86a, 0xc9795a, 0x8fae9e, 0xe6d9b8, 0xb98fb0, 0x9fb4cc, 0xefe6d0];

/** Окно на фасаде.  s = -1 -- лицевой фасад (нормаль -z), +1 -- задний. */
function windowAt(b, rng, x, y, zFace, s, w, h, { frame = PAL.frameWhite, tee = false, frameMat = null } = {}) {
  const fm = frameMat || M(frame);
  // стекло: тёмное, голубое «с небом» или со шторой
  const r = rng.next();
  const glassCol = r < 0.38 ? PAL.glassDark : r < 0.7 ? PAL.glass : rng.pick(CURTAINS);
  b.box(w, h, 0.05, M(glassCol, { bands: 2 }), x, y, zFace + s * 0.02);
  const t = 0.075, d = 0.1, zf = zFace + s * 0.045;
  b.box(w + t, t, d, fm, x, y + h - t / 2, zf);           // верх
  b.box(w + t, t, d, fm, x, y - t / 2, zf);               // низ
  b.box(t, h, d, fm, x - w / 2, y, zf);                   // лево
  b.box(t, h, d, fm, x + w / 2, y, zf);                   // право
  if (tee) {
    // Т-образный переплёт, как у деревянных окон хрущёвок
    b.box(t * 0.8, h * 0.72, d, fm, x, y, zf);
    b.box(w, t * 0.8, d, fm, x, y + h * 0.72, zf);
  } else {
    b.box(t * 0.8, h, d, fm, x - w * 0.12, y, zf);
  }
  // отлив
  b.box(w + 0.12, 0.05, 0.2, M(PAL.metal), x, y - 0.06, zFace + s * 0.1);
}

/** Спутниковая тарелка на кронштейне. */
function dish(b, x, y, z, s) {
  const mat = M(0xdedcd6);
  b.cyl(0.36, 0.36, 0.04, 14, mat, x, y, z + s * 0.35, s * 1.15, 0, 0.35);
  b.box(0.05, 0.05, 0.4, M(PAL.metalDark), x, y - 0.05, z + s * 0.18);
  b.cyl(0.02, 0.02, 0.5, 5, M(PAL.metalDark), x - 0.1, y + 0.05, z + s * 0.55, s * 0.9, 0, 0);
}

/** Коллективная ТВ-антенна на крыше: мачта и «ёлка» перекладин. */
function antenna(b, rng, x, y, z) {
  const mat = M(PAL.metalDark);
  const h = rng.range(2.2, 3.6);
  b.cyl(0.03, 0.035, h, 5, mat, x, y + h / 2, z);
  const n = rng.int(2, 4);
  const ry = rng.range(0, Math.PI);
  for (let i = 0; i < n; i++) {
    const yy = y + h - 0.15 - i * 0.42;
    const L = rng.range(1.0, 1.7) * (1 - i * 0.12);
    b.box(L, 0.03, 0.03, mat, x, yy, z, ry);
    for (let k = -2; k <= 2; k++) {
      b.box(0.03, 0.03, 0.55, mat, x + Math.cos(ry) * k * L * 0.2, yy, z - Math.sin(ry) * k * L * 0.2, ry);
    }
  }
  // растяжки не рисуем: при таком масштабе они всё равно ниже пикселя
}

/**
 * Лоджия с одним из вариантов «доделки» жильцами.
 * xc -- центр пролёта, y -- уровень пола, w -- ширина.  Всегда на лицевом фасаде.
 */
function loggia(b, rng, xc, y, w, depth, { top = false } = {}) {
  const slabMat = M(PAL.panelAlt);
  const zOut = -depth;
  b.box(w, 0.14, depth, slabMat, xc, y - 0.14, -depth / 2);
  // боковые экраны
  b.box(0.1, 2.66, depth, M(PAL.panel), xc - w / 2 + 0.05, y, -depth / 2);
  b.box(0.1, 2.66, depth, M(PAL.panel), xc + w / 2 - 0.05, y, -depth / 2);
  if (top) b.box(w, 0.14, depth, slabMat, xc, y + 2.66, -depth / 2);

  const v = rng.next();
  const pw = w - 0.2;
  if (v < 0.22) {
    // как построили: бетонный экран и ничего больше, иногда тарелка
    b.box(pw, 1.0, 0.1, M(PAL.panelAlt), xc, y, zOut + 0.05);
    b.box(pw, 0.03, 0.02, M(PAL.panelSeam), xc, y + 0.5, zOut - 0.001);
    if (rng.chance(0.45)) dish(b, xc + rng.range(-0.5, 0.5), y + 1.5, zOut + 0.25, -1);
    // бельё на верёвке внутри
    if (rng.chance(0.5)) {
      for (let i = 0; i < 3; i++) {
        b.box(rng.range(0.3, 0.6), rng.range(0.4, 0.7), 0.02, M(rng.pick([0xf3f1ea, 0x9cc0dc, 0xe7b8a6, 0xe9df9a])),
          xc - pw / 2 + 0.5 + i * 0.7, y + 1.45, zOut + 0.5);
      }
    }
    return;
  }
  // низ: крашеный профлист или панель
  const lower = v < 0.45 ? PAL.panelAlt : rng.pick([0x6f9ab8, 0x7ea06a, 0xcfc4a2, 0xb96a50, 0x9aa7a4, 0xe8e0cc]);
  b.box(pw, 1.0, 0.08, M(lower), xc, y, zOut + 0.04);
  if (v >= 0.45) {
    // рёбра профлиста -- мелкие вертикальные рейки, дают тушь
    for (let i = 0; i < Math.floor(pw / 0.24); i++) {
      b.box(0.04, 1.0, 0.03, M(lower), xc - pw / 2 + 0.12 + i * 0.24, y, zOut - 0.01);
    }
  }
  // остекление: дерево, белый пластик или алюминий
  const glazing = rng.next();
  const frame = glazing < 0.45 ? PAL.frameWood : glazing < 0.8 ? PAL.frameWhite : PAL.frameAlu;
  const fm = M(frame);
  const gh = 1.5;
  b.box(pw, gh, 0.04, M(rng.chance(0.5) ? PAL.glass : PAL.glassDark, { bands: 2 }), xc, y + 1.02, zOut + 0.06);
  b.box(pw, 0.07, 0.1, fm, xc, y + 1.0, zOut + 0.04);
  b.box(pw, 0.07, 0.1, fm, xc, y + 1.0 + gh, zOut + 0.04);
  const n = Math.max(2, Math.round(pw / 0.8));
  for (let i = 0; i <= n; i++) b.box(0.06, gh, 0.1, fm, xc - pw / 2 + (i * pw) / n, y + 1.0, zOut + 0.04);
  if (rng.chance(0.25)) dish(b, xc + pw / 2 - 0.4, y + 2.2, zOut, -1);
}

/* =========================== ПАНЕЛЬНАЯ ДЕВЯТИЭТАЖКА =========================== */

/**
 * @param o.len, o.depth   габариты в плане
 * @param o.floors         этажей
 * @param o.arch           { x0, x1, h } -- сквозная арка (или null)
 * @param o.entrances      [{ x, n, flats: [a, b] }] -- подъезды на лицевом фасаде
 * @param o.seed
 * @param o.detailBack     детализировать ли задний фасад
 * @param o.graffitiArch   надписи в арке
 */
export function makePanel9(o) {
  const { len, depth, floors = 9, arch = null, entrances = [], seed = 1, detailBack = true, loggias = true } = o;
  const rng = rngKit(seed);
  const g = new THREE.Group();
  const inscriptions = [];
  const inscribe = (mesh, note) => { inscriptions.push({ mesh, note }); return mesh; };
  g.userData.inscriptions = inscriptions;
  const b = new Batch();
  const FH = 2.8, PL = 1.0;             // высота этажа, цоколь
  const H = PL + floors * FH;
  const BAY = 3.2;
  const wall = M(PAL.panel);
  const boxes = [];

  // ---- объём ----
  if (arch) {
    b.slab(0, 0, arch.x0, depth, 0, H, wall);
    b.slab(arch.x1, 0, len, depth, 0, H, wall);
    b.slab(arch.x0, 0, arch.x1, depth, arch.h, H, wall);
    boxes.push({ x0: 0, z0: 0, x1: arch.x0, z1: depth }, { x0: arch.x1, z0: 0, x1: len, z1: depth });
    // арка: кафель понизу, штукатурка, лампа, трубы под потолком
    const aw = arch.x1 - arch.x0;
    const tile = M(0xffffff, { map: tileTex(), cache: false });
    for (const [xx, s] of [[arch.x0 + 0.03, 1], [arch.x1 - 0.03, -1]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, depth - 0.2), tile);
      m.position.set(xx, 0.75, depth / 2);
      m.receiveShadow = true;
      g.add(m);
      b.box(0.08, 0.08, depth - 0.2, M(PAL.plinth), xx + s * 0.01, 1.5, depth / 2);
      b.box(0.08, 0.3, depth, M(PAL.plinth), xx, 0, depth / 2);
    }
    b.box(aw, 0.04, depth, M(PAL.archPlaster), (arch.x0 + arch.x1) / 2, arch.h - 0.04, depth / 2);
    b.pipe(new THREE.Vector3(arch.x0 + 0.35, arch.h - 0.25, 0), new THREE.Vector3(arch.x0 + 0.35, arch.h - 0.25, depth), 0.09, M(PAL.metal));
    b.pipe(new THREE.Vector3(arch.x0 + 0.65, arch.h - 0.2, 0), new THREE.Vector3(arch.x0 + 0.65, arch.h - 0.2, depth), 0.05, M(PAL.rust));
    b.box(0.35, 0.12, 0.25, M(PAL.metalDark), (arch.x0 + arch.x1) / 2, arch.h - 0.16, depth / 2);
    b.box(0.25, 0.06, 0.18, F(0xfff1c8), (arch.x0 + arch.x1) / 2, arch.h - 0.2, depth / 2);
    if (o.graffitiArch) {
      inscribe(decal(g, graffiti('ЦОЙ ЖИВ', '#1f2328'), 2.6, 0.8, arch.x0 + 0.07, 2.05, depth * 0.62, Math.PI / 2, { alpha: true }), graffitiNotes.tsoi);
      inscribe(decal(g, graffiti('КИНО', '#b0302a', { tilt: 0.06 }), 1.2, 0.5, arch.x0 + 0.07, 1.1, depth * 0.3, Math.PI / 2, { alpha: true }), graffitiNotes.kino);
      inscribe(decal(g, graffiti('Лена + Дима = ♥', '#2d4f8a', { tilt: -0.08 }), 1.9, 0.55, arch.x1 - 0.07, 1.9, depth * 0.45, -Math.PI / 2, { alpha: true }), graffitiNotes.lena);
      inscribe(decal(g, noticeSheet(0), 0.3, 0.38, arch.x1 - 0.07, 1.55, depth * 0.78, -Math.PI / 2), noticeNote(0));
      inscribe(decal(g, noticeSheet(2), 0.3, 0.38, arch.x1 - 0.07, 1.6, depth * 0.84, -Math.PI / 2), noticeNote(2));
    }
  } else {
    b.slab(0, 0, len, depth, 0, H, wall);
    boxes.push({ x0: 0, z0: 0, x1: len, z1: depth });
  }

  const inArch = (x0, x1, y) => arch && y < arch.h + 0.3 && x1 > arch.x0 - 0.2 && x0 < arch.x1 + 0.2;

  // ---- цоколь ----
  const pl = M(PAL.plinth);
  const segs = arch ? [[0, arch.x0], [arch.x1, len]] : [[0, len]];
  for (const [a, c] of segs) {
    b.box(c - a, PL, 0.08, pl, (a + c) / 2, 0, -0.04);
    b.box(c - a, PL, 0.08, pl, (a + c) / 2, 0, depth + 0.04);
    // продухи подвала
    for (let x = a + 1.6; x < c - 1; x += BAY) {
      b.box(0.5, 0.25, 0.04, M(PAL.metalDark), x, 0.35, -0.09);
      if (detailBack) b.box(0.5, 0.25, 0.04, M(PAL.metalDark), x, 0.35, depth + 0.09);
    }
  }
  b.box(0.08, PL, depth + 0.16, pl, -0.04, 0, depth / 2);
  b.box(0.08, PL, depth + 0.16, pl, len + 0.04, 0, depth / 2);

  // ---- швы панелей: плоские полосы, без выступа, чтобы тушь их не обводила ----
  const seam = M(PAL.panelSeam, { bands: 2 });
  for (let f = 0; f <= floors; f++) {
    const y = PL + f * FH;
    for (const [a, c] of segs.map((s) => (inArch(s[0], s[1], y) ? s : s))) {
      if (!(arch && y < arch.h)) {
        b.box(len, 0.035, 0.012, seam, len / 2, y, -0.006);
      } else {
        b.box(c - a, 0.035, 0.012, seam, (a + c) / 2, y, -0.006);
      }
    }
    if (detailBack) b.box(len, 0.035, 0.012, seam, len / 2, y, depth + 0.006);
  }
  for (let x = BAY; x < len - 0.1; x += BAY) {
    const y0 = arch && x > arch.x0 && x < arch.x1 ? arch.h : PL;
    b.box(0.03, H - y0, 0.012, seam, x, y0, -0.006);
    if (detailBack) b.box(0.03, H - PL, 0.012, seam, x, PL, depth + 0.006);
  }

  // ---- окна и лоджии ----
  const nb = Math.floor(len / BAY);
  const x0b = (len - nb * BAY) / 2;
  const entranceBays = new Set(entrances.map((e) => Math.floor((e.x - x0b) / BAY)));
  for (let i = 0; i < nb; i++) {
    const xc = x0b + i * BAY + BAY / 2;
    const isEntrance = entranceBays.has(i);
    const isLoggia = loggias && !isEntrance && (i % 3 === 1);
    for (let f = 0; f < floors; f++) {
      const y = PL + f * FH;
      if (inArch(xc - BAY / 2, xc + BAY / 2, y + 0.5)) continue;
      if (isEntrance) {
        // окна лестничной клетки -- на пол-этажа ниже, узкие
        if (f > 0) windowAt(b, rng, xc, y - FH / 2 + 0.9, 0, -1, 0.9, 1.1, { frame: PAL.frameWhite });
        continue;
      }
      if (isLoggia && f > 0) {
        windowAt(b, rng, xc - 0.45, y + 0.2, 0, -1, 0.75, 2.1);
        windowAt(b, rng, xc + 0.55, y + 0.85, 0, -1, 1.0, 1.45);
        loggia(b, rng, xc, y, BAY - 0.1, 1.15, { top: f === floors - 1 });
      } else {
        const frame = rng.chance(0.3) ? PAL.frameWood : rng.chance(0.25) ? PAL.frameAlu : PAL.frameWhite;
        windowAt(b, rng, xc, y + 0.85, 0, -1, 1.5, 1.45, { frame });
        // решётки на первом этаже -- примета конца девяностых
        if (f === 0 && rng.chance(0.55)) {
          for (let k = 0; k < 6; k++) b.box(0.025, 1.5, 0.025, M(PAL.metalDark), xc - 0.7 + k * 0.28, y + 0.82, -0.14);
          b.box(1.5, 0.03, 0.03, M(PAL.metalDark), xc, y + 1.55, -0.14);
        }
        if (f > 1 && rng.chance(0.06)) {
          // кондиционер -- в 2001-м ещё редкость
          b.box(0.8, 0.5, 0.3, M(0xe9e7e0), xc + 0.9, y + 0.3, -0.16);
        }
      }
    }
    if (detailBack) {
      for (let f = 0; f < floors; f++) {
        const y = PL + f * FH;
        windowAt(b, rng, xc, y + 0.85, depth, 1, 1.5, 1.45, { frame: rng.chance(0.3) ? PAL.frameWood : PAL.frameWhite });
      }
    }
  }

  // ---- подъезды ----
  for (const e of entrances) {
    const doorCol = e.color ?? rng.pick([PAL.paintTeal, PAL.paintBrown, PAL.paintGreen, PAL.paintBlue]);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.15, 0.08), [
      M(doorCol), M(doorCol), M(doorCol), M(doorCol),
      M(doorCol), M(0xffffff, { map: doorTex(doorCol), cache: false }),
    ]);
    // лицевая грань BoxGeometry -- +z, а нам нужна -z: разворачиваем
    door.rotation.y = Math.PI;
    door.position.set(e.x, 1.075 + 0.15, -0.05);
    door.castShadow = true; door.receiveShadow = true;
    g.add(door);
    b.box(1.6, 0.08, 0.12, M(PAL.metalDark), e.x, 2.4, -0.06);
    // крыльцо и козырёк
    b.box(2.6, 0.15, 1.6, M(PAL.concrete), e.x, 0, -0.8);
    b.box(2.9, 0.14, 1.8, M(PAL.concrete), e.x, 2.85, -0.9);
    b.box(0.12, 2.85, 0.12, M(PAL.metal), e.x - 1.3, 0, -1.65);
    b.box(0.12, 2.85, 0.12, M(PAL.metal), e.x + 1.3, 0, -1.65);
    inscribe(decal(g, entrancePlate(e.n, e.flats[0], e.flats[1]), 0.56, 0.28, e.x, 2.62, -0.1, Math.PI), entranceNote(e));
    inscribe(decal(g, noticeSheet(e.n + 1), 0.24, 0.3, e.x + 0.95, 1.55, -0.09, Math.PI), noticeNote(e.n + 1));
    b.box(0.4, 0.15, 0.5, M(PAL.concreteDark), e.x + 1.8, 0, -0.3); // урна-подставка
  }

  // ---- крыша ----
  const roofY = H;
  b.box(len, 0.08, depth, M(PAL.roofTar), len / 2, roofY, depth / 2);
  const par = M(PAL.panelAlt);
  b.box(len + 0.1, 0.6, 0.2, par, len / 2, roofY, 0.1);
  b.box(len + 0.1, 0.6, 0.2, par, len / 2, roofY, depth - 0.1);
  b.box(0.2, 0.6, depth, par, 0.1, roofY, depth / 2);
  b.box(0.2, 0.6, depth, par, len - 0.1, roofY, depth / 2);
  b.box(len + 0.2, 0.08, 0.3, M(PAL.metal), len / 2, roofY + 0.6, 0.1);
  for (const e of entrances) {
    b.box(3.4, 2.8, 4.2, M(PAL.panelAlt), e.x, roofY, depth / 2 + 1);
    b.box(3.5, 0.12, 4.3, M(PAL.roofTar), e.x, roofY + 2.8, depth / 2 + 1);
    b.box(0.8, 1.6, 0.05, M(PAL.metalDark), e.x, roofY + 0.1, depth / 2 - 1.12);
  }
  const nAnt = Math.floor(len / 5);
  for (let i = 0; i < nAnt; i++) antenna(b, rng, rng.range(1.5, len - 1.5), roofY + 0.08, rng.range(2, depth - 2));

  // ---- адрес на углу ----
  if (o.address) inscribe(decal(g, addressPlate(o.address[0], o.address[1]), 1.3, 0.33, 0.9, PL + FH * 1.4, -0.03, Math.PI), addressNote(...o.address));

  b.flush(g, 'panel9');
  return { group: g, boxes, height: H };
}

/* ================================ ХРУЩЁВКА ================================ */

/**
 * Кирпичная пятиэтажка серии 1-447: охристый кирпич, деревянные окна с
 * Т-образным переплётом, маленькие балконы с решёткой, пологая шиферная крыша.
 */
export function makeKhrush(o) {
  const { len, depth, floors = 5, entrances = [], seed = 7, detailBack = true } = o;
  const rng = rngKit(seed);
  const g = new THREE.Group();
  const inscriptions = [];
  const inscribe = (mesh, note) => { inscriptions.push({ mesh, note }); return mesh; };
  g.userData.inscriptions = inscriptions;
  const b = new Batch();
  const FH = 2.7, PL = 0.7;
  const H = PL + floors * FH;
  const brick = M(o.brick ?? PAL.brick);
  const boxes = [{ x0: 0, z0: 0, x1: len, z1: depth }];

  b.slab(0, 0, len, depth, 0, H, brick);
  // цоколь и межэтажные пояски -- полосы кирпича потемнее
  b.box(len + 0.1, PL, depth + 0.1, M(PAL.brickDark), len / 2, 0, depth / 2);
  for (const y of [PL + FH - 0.1, H - 0.35]) {
    b.box(len + 0.06, 0.12, 0.05, M(PAL.brickWhite), len / 2, y, -0.02);
    if (detailBack) b.box(len + 0.06, 0.12, 0.05, M(PAL.brickWhite), len / 2, y, depth + 0.02);
  }

  const entrX = entrances.map((e) => e.x);
  const nearEntrance = (x) => entrX.some((ex) => Math.abs(ex - x) < 1.3);
  const step = 2.9;
  const n = Math.floor((len - 1.2) / step);
  const x0 = (len - (n - 1) * step) / 2;
  const railMat = M(rng.pick([0x4f6e5a, 0x3e4a55, 0x5f5a52]));

  for (let i = 0; i < n; i++) {
    const xc = x0 + i * step;
    const front = !nearEntrance(xc);
    const balconyCol = i % 2 === 1;
    for (let f = 0; f < floors; f++) {
      const y = PL + f * FH;
      if (front) {
        const frame = rng.chance(0.18) ? PAL.frameWhite : rng.chance(0.2) ? 0xeeeeea : 0xe8e4d8;
        windowAt(b, rng, xc, y + 0.85, 0, -1, 1.35, 1.4, { frame, tee: true });
        if (balconyCol && f > 0) {
          // балкон: плита, решётка из прутьев, у кого-то застеклён деревом
          b.box(2.3, 0.12, 0.95, M(PAL.concrete), xc, y - 0.02, -0.47);
          if (rng.chance(0.3)) {
            b.box(2.2, 0.95, 0.05, M(rng.pick([0x7aa0b8, 0xd8cfb2, 0x8fa878])), xc, y + 0.1, -0.93);
            b.box(2.2, 1.25, 0.04, M(PAL.glass, { bands: 2 }), xc, y + 1.05, -0.92);
            for (let k = 0; k <= 4; k++) b.box(0.06, 1.25, 0.08, M(PAL.frameWood), xc - 1.1 + k * 0.55, y + 1.05, -0.92);
            b.box(2.3, 0.06, 1.0, M(PAL.rust), xc, y + 2.3, -0.5);
          } else {
            b.box(2.25, 0.05, 0.05, railMat, xc, y + 1.0, -0.93);
            for (let k = 0; k < 16; k++) b.box(0.025, 0.9, 0.025, railMat, xc - 1.08 + k * 0.144, y + 0.1, -0.93);
            for (const s of [-1, 1]) b.box(0.05, 0.05, 0.9, railMat, xc + s * 1.12, y + 1.0, -0.47);
            if (rng.chance(0.4)) {
              // хозяйство на балконе: лыжи, банки, коробки
              b.box(0.5, 0.6, 0.4, M(rng.pick([0xc9b48a, 0x9a8a70])), xc + rng.range(-0.7, 0.7), y + 0.1, -0.5);
            }
            if (rng.chance(0.35)) dish(b, xc + 0.8, y + 1.3, -0.95, -1);
          }
        }
      }
      if (detailBack) windowAt(b, rng, xc, y + 0.85, depth, 1, 1.35, 1.4, { frame: 0xe8e4d8, tee: true });
    }
  }

  // ---- подъезды: дверь, козырёк, окна лестницы, табличка ----
  for (const e of entrances) {
    const doorCol = e.color ?? rng.pick([PAL.paintGreen, PAL.paintTeal, PAL.paintBrown]);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.1, 0.08), [
      M(doorCol), M(doorCol), M(doorCol), M(doorCol),
      M(doorCol), M(0xffffff, { map: doorTex(doorCol), cache: false }),
    ]);
    door.rotation.y = Math.PI;
    door.position.set(e.x, 1.05 + 0.2, -0.05);
    door.castShadow = true; door.receiveShadow = true;
    g.add(door);
    b.box(1.5, 0.2, 1.2, M(PAL.concrete), e.x, 0, -0.6);
    b.box(2.0, 0.12, 1.3, M(PAL.concrete), e.x, 2.65, -0.65);
    b.box(2.02, 0.05, 1.32, M(PAL.rust), e.x, 2.77, -0.65);
    for (let f = 1; f < floors; f++) {
      windowAt(b, rng, e.x, PL + f * FH - FH / 2 + 0.95, 0, -1, 1.0, 1.2, { frame: 0xe8e4d8, tee: true });
    }
    inscribe(decal(g, entrancePlate(e.n, e.flats[0], e.flats[1]), 0.5, 0.25, e.x, 2.45, -0.06, Math.PI), entranceNote(e));
    if (rng.chance(0.7)) inscribe(decal(g, noticeSheet(e.n), 0.24, 0.3, e.x - 0.85, 1.5, -0.06, Math.PI), noticeNote(e.n));
  }

  // ---- пологая двускатная крыша ----
  const rise = 1.5, over = 0.45;
  const sh = new THREE.Shape();
  sh.moveTo(-over, 0);
  sh.lineTo(depth + over, 0);
  sh.lineTo(depth / 2, rise);
  sh.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(sh, { depth: len + over * 2, bevelEnabled: false });
  roofGeo.rotateY(Math.PI / 2);
  roofGeo.translate(-over, H, depth);
  b.geo(roofGeo, M(PAL.roofSlate));
  // фронтоны
  const gsh = new THREE.Shape();
  gsh.moveTo(0, 0); gsh.lineTo(depth, 0); gsh.lineTo(depth / 2, rise * (depth / (depth + over * 2)));
  gsh.closePath();
  for (const xx of [0.02, len - 0.02]) {
    const gg = new THREE.ExtrudeGeometry(gsh, { depth: 0.1, bevelEnabled: false });
    gg.rotateY(Math.PI / 2);
    gg.translate(xx - 0.05, H, depth);
    b.geo(gg, brick);
  }
  for (let i = 0; i < Math.floor(len / 6); i++) antenna(b, rng, rng.range(2, len - 2), H + rise * 0.6, depth / 2 + rng.range(-1, 1));
  // вентшахты
  for (const e of entrances) b.box(0.9, 1.4, 0.6, brick, e.x + 1.5, H + 0.6, depth / 2);

  if (o.address) inscribe(decal(g, addressPlate(o.address[0], o.address[1]), 1.2, 0.3, 0.8, PL + FH * 1.35, -0.03, Math.PI), addressNote(...o.address));
  if (o.endGraffiti) inscribe(decal(g, graffiti(o.endGraffiti, '#2a3a6a'), 3.2, 1.0, -0.03, 1.4, depth * 0.5, -Math.PI / 2, { alpha: true }), graffitiNotes.aria);

  b.flush(g, 'khrush');
  return { group: g, boxes, height: H };
}
