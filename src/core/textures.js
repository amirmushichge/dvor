import * as THREE from 'three';
import { PAL } from './palette.js';

/* ------------------------------------------------------------------ *
 * Процедурные canvas-текстуры.
 *
 * Как и в оригинале: ни одной картинки в src/ -- каждая табличка,
 * объявление, ковёр и надпись мелом рисуется Canvas2D при загрузке.
 * Всё плоское и низкочастотное: чёткие формы и шрифт, никакого
 * фотографического шума.
 * ------------------------------------------------------------------ */

const FONT = `'Arial', 'Segoe UI', 'Helvetica Neue', sans-serif`;
const HAND = `'Comic Sans MS', 'Segoe Print', 'Arial', sans-serif`;
const cache = new Map();

function make(w, h, draw, { srgb = true, repeat = null, aniso = 4 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const c = cv.getContext('2d');
  draw(c, w, h);
  const tex = new THREE.CanvasTexture(cv);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.needsUpdate = true;
  return tex;
}

const cached = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
};

const hex = (n) => '#' + n.toString(16).padStart(6, '0');

function fit(c, text, maxW, size, font = FONT, weight = 'bold') {
  let s = size;
  do {
    c.font = `${weight} ${s}px ${font}`;
    if (c.measureText(text).width <= maxW) break;
    s -= 2;
  } while (s > 6);
  return s;
}

function text(c, str, x, y, maxW, size, color, { font = FONT, weight = 'bold', align = 'center' } = {}) {
  fit(c, str, maxW, size, font, weight);
  c.fillStyle = color;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(str, x, y);
}

/** Мягкое облако для неба -- тот же приём, что в оригинале. */
export const cloudTex = () =>
  cached('cloud', () =>
    make(512, 256, (c, w, h) => {
      const puffs = [
        [0.22, 0.62, 0.15], [0.36, 0.46, 0.2], [0.52, 0.4, 0.24],
        [0.68, 0.5, 0.19], [0.82, 0.63, 0.14], [0.45, 0.66, 0.2], [0.6, 0.68, 0.17],
      ];
      c.fillStyle = '#ffffff';
      for (const [x, y, r] of puffs) {
        c.beginPath();
        c.ellipse(x * w, y * h, r * w * 0.55, r * h * 1.1, 0, 0, Math.PI * 2);
        c.fill();
      }
      c.globalCompositeOperation = 'destination-out';
      c.fillRect(0, h * 0.78, w, h * 0.22);
    }, { srgb: false })
  );

/** Синяя эмалированная табличка над дверью: «Подъезд 3 · кв. 37–54». */
export const entrancePlate = (n, a, b) =>
  cached(`pod${n}`, () =>
    make(256, 128, (c, w, h) => {
      c.fillStyle = '#2f5fa0';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#f2f2ee';
      c.lineWidth = 6;
      c.strokeRect(8, 8, w - 16, h - 16);
      text(c, `${n}`, 52, h / 2, 70, 80, '#f7f7f2');
      text(c, 'кв.', 168, 42, 150, 28, '#f7f7f2', { weight: 'normal' });
      text(c, `${a}–${b}`, 168, 84, 150, 40, '#f7f7f2');
    })
  );

/** Адресная табличка на углу: «ул. Строителей, 7». */
export const addressPlate = (street, num) =>
  cached(`addr${street}${num}`, () =>
    make(512, 128, (c, w, h) => {
      c.fillStyle = '#f1efe8';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#23407a';
      c.fillRect(0, 0, w, 10);
      c.fillRect(0, h - 10, w, 10);
      text(c, street, 190, h / 2, 340, 48, '#23407a');
      c.fillStyle = '#23407a';
      c.fillRect(372, 18, 6, h - 36);
      text(c, `${num}`, 445, h / 2, 110, 84, '#23407a');
    })
  );

/** Надпись на стене / гараже: баллончик или мел. */
export const graffiti = (str, color = '#2b2f36', { chalk = false, w = 512, h = 160, tilt = -0.05 } = {}) =>
  cached(`gr${str}${color}${chalk}`, () =>
    make(w, h, (c) => {
      c.clearRect(0, 0, w, h);
      c.save();
      c.translate(w / 2, h / 2);
      c.rotate(tilt);
      fit(c, str, w * 0.9, h * 0.72, HAND, 'bold');
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      if (chalk) {
        c.globalAlpha = 0.85;
        c.fillStyle = color;
        c.fillText(str, 0, 0);
      } else {
        // потёки краски
        c.fillStyle = color;
        c.fillText(str, 0, 0);
        c.globalAlpha = 0.6;
        const m = c.measureText(str).width;
        for (let i = 0; i < 7; i++) {
          const x = -m / 2 + ((i * 97) % m);
          c.fillRect(x, h * 0.18, 3, 12 + ((i * 37) % 26));
        }
      }
      c.restore();
    }, { srgb: true })
  );

/** Доска объявлений: «Продам гараж», «Сниму квартиру», с отрывными телефонами. */
export const noticeSheet = (seed = 0) =>
  cached(`notice${seed}`, () =>
    make(256, 320, (c, w, h) => {
      const lines = [
        ['ПРОДАМ', 'гараж-ракушку', 'недорого'],
        ['СНИМУ', 'квартиру', 'без посредников'],
        ['РЕМОНТ', 'телевизоров', 'на дому'],
        ['ПОТЕРЯЛСЯ', 'кот рыжий', 'вознагр.'],
      ][seed % 4];
      c.fillStyle = '#f6f3e8';
      c.fillRect(0, 0, w, h);
      text(c, lines[0], w / 2, 50, w - 30, 44, '#1e1e24');
      text(c, lines[1], w / 2, 104, w - 30, 30, '#2a2a33', { weight: 'normal' });
      text(c, lines[2], w / 2, 146, w - 30, 26, '#2a2a33', { weight: 'normal' });
      // отрывные язычки
      c.strokeStyle = '#8a877e';
      c.lineWidth = 2;
      const n = 7;
      for (let i = 0; i < n; i++) {
        const x = (i / n) * w;
        c.beginPath();
        c.moveTo(x, 200);
        c.lineTo(x, h);
        c.stroke();
        if (i === 2 || i === 5) {
          c.clearRect(x + 2, 202, w / n - 3, h - 202); // уже оторвали
          continue;
        }
        c.save();
        c.translate(x + w / n / 2, 262);
        c.rotate(-Math.PI / 2);
        text(c, '2-14-37', 0, 0, 110, 20, '#2a2a33', { weight: 'normal' });
        c.restore();
      }
    })
  );

/** Ковёр на выбивалке -- красный, с медальоном, «как у всех». */
export const carpetTex = () =>
  cached('carpet', () =>
    make(256, 384, (c, w, h) => {
      c.fillStyle = '#9c2b2a';
      c.fillRect(0, 0, w, h);
      // кайма
      c.strokeStyle = '#e3c78a';
      c.lineWidth = 10;
      c.strokeRect(10, 10, w - 20, h - 20);
      c.strokeStyle = '#2d3558';
      c.lineWidth = 16;
      c.strokeRect(30, 30, w - 60, h - 60);
      // узор по кайме
      c.fillStyle = '#e3c78a';
      for (let y = 50; y < h - 40; y += 22) {
        c.fillRect(34, y, 8, 8);
        c.fillRect(w - 42, y, 8, 8);
      }
      // центральный медальон
      c.save();
      c.translate(w / 2, h / 2);
      c.fillStyle = '#2d3558';
      c.beginPath();
      c.moveTo(0, -110); c.lineTo(70, 0); c.lineTo(0, 110); c.lineTo(-70, 0);
      c.closePath();
      c.fill();
      c.fillStyle = '#e3c78a';
      c.beginPath();
      c.moveTo(0, -70); c.lineTo(42, 0); c.lineTo(0, 70); c.lineTo(-42, 0);
      c.closePath();
      c.fill();
      c.fillStyle = '#9c2b2a';
      c.beginPath();
      c.arc(0, 0, 18, 0, Math.PI * 2);
      c.fill();
      c.restore();
      // угловые розетки
      c.fillStyle = '#d98a3a';
      for (const [x, y] of [[64, 70], [w - 64, 70], [64, h - 70], [w - 64, h - 70]]) {
        c.beginPath();
        c.arc(x, y, 14, 0, Math.PI * 2);
        c.fill();
      }
    })
  );

/** Шляпка грибка в песочнице: красная, в белый горох. */
export const mushroomTex = () =>
  cached('mushroom', () =>
    make(256, 128, (c, w, h) => {
      c.fillStyle = hex(PAL.paintRed);
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#f7f3ea';
      const dots = [[20, 30], [70, 70], [120, 25], [170, 80], [220, 40], [45, 100], [150, 110], [240, 100], [95, 115]];
      for (const [x, y] of dots) {
        c.beginPath();
        c.arc(x, y, 11, 0, Math.PI * 2);
        c.fill();
      }
    })
  );

/** Маршрутный указатель трамвая. */
export const tramRouteSign = (num, dest) =>
  cached(`route${num}${dest}`, () =>
    make(512, 96, (c, w, h) => {
      c.fillStyle = '#f4f2ea';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#1f2a3a';
      c.fillRect(0, 0, 96, h);
      text(c, `${num}`, 48, h / 2, 80, 72, '#f4f2ea');
      text(c, dest, 300, h / 2, 380, 44, '#1f2a3a');
    })
  );

/** Бортовой номер трамвая. */
export const tramNumber = (num) =>
  cached(`tramnum${num}`, () =>
    make(128, 64, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      text(c, `${num}`, w / 2, h / 2, w - 8, 52, '#f4f2ea');
    }, { srgb: true })
  );

/** Номер советского образца. */
export const plateTex = (str) =>
  cached(`plate${str}`, () =>
    make(256, 56, (c, w, h) => {
      c.fillStyle = '#f5f5f0';
      c.fillRect(0, 0, w, h);
      c.strokeStyle = '#1b1b1f';
      c.lineWidth = 4;
      c.strokeRect(3, 3, w - 6, h - 6);
      text(c, str, w / 2, h / 2 + 2, w - 24, 40, '#1b1b1f');
    })
  );

/** Одна пушинка: мягкое белое пятно с «лучами». */
export const fluffTex = () =>
  cached('fluff', () =>
    make(64, 64, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.85)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.beginPath();
      c.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.3;
        c.beginPath();
        c.moveTo(w / 2, h / 2);
        c.lineTo(w / 2 + Math.cos(a) * w * 0.48, h / 2 + Math.sin(a) * h * 0.48);
        c.stroke();
      }
    }, { srgb: false })
  );

/**
 * Фасад дальнего дома одной текстурой: сетка окон, часть горит тёплым,
 * часть со шторами, швы панелей.  Для силуэтов у горизонта, где честная
 * геометрия окон стоила бы тысячи коробок и всё равно была бы меньше пикселя.
 */
export const facadeTex = (kind = 'panel', seed = 1) =>
  cached(`facade${kind}${seed}`, () =>
    make(256, 256, (c, w, h) => {
      let s = seed * 9301 + 49297;
      const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
      c.fillStyle = kind === 'brick' ? hex(PAL.brick) : kind === 'white' ? '#e4e2da' : hex(PAL.panel);
      c.fillRect(0, 0, w, h);
      const cols = 4, rows = 4;
      const cw = w / cols, rh = h / rows;
      c.strokeStyle = 'rgba(80,80,72,0.28)';
      c.lineWidth = 2;
      for (let i = 0; i <= rows; i++) { c.beginPath(); c.moveTo(0, i * rh); c.lineTo(w, i * rh); c.stroke(); }
      if (kind !== 'brick') for (let i = 0; i <= cols; i++) { c.beginPath(); c.moveTo(i * cw, 0); c.lineTo(i * cw, h); c.stroke(); }
      for (let r = 0; r < rows; r++) {
        for (let q = 0; q < cols; q++) {
          const v = rnd();
          c.fillStyle = v < 0.5 ? '#44596a' : v < 0.72 ? '#8fb3c2' : v < 0.86 ? '#e9c98a' : '#c9795a';
          c.fillRect(q * cw + cw * 0.22, r * rh + rh * 0.3, cw * 0.56, rh * 0.48);
          c.fillStyle = '#ecebe4';
          c.fillRect(q * cw + cw * 0.2, r * rh + rh * 0.78, cw * 0.6, rh * 0.04);
        }
      }
    })
  );

/** Кафель в арке -- сетка швов поверх голубовато-серого. */
export const tileTex = () =>
  cached('tile', () =>
    make(128, 128, (c, w, h) => {
      c.fillStyle = hex(PAL.tile);
      c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(60,72,76,0.45)';
      c.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        c.beginPath(); c.moveTo(0, (i * h) / 4); c.lineTo(w, (i * h) / 4); c.stroke();
        c.beginPath(); c.moveTo((i * w) / 4, 0); c.lineTo((i * w) / 4, h); c.stroke();
      }
    }, { repeat: [6, 1] })
  );

/** Классики мелом на асфальте. */
export const hopscotchTex = () =>
  cached('hopscotch', () =>
    make(256, 512, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = 'rgba(250,250,245,0.9)';
      c.fillStyle = 'rgba(250,250,245,0.9)';
      c.lineWidth = 7;
      const cell = 80;
      const rows = [[1], [2], [3], [4, 5], [6], [7, 8], [9], ['НЕБО']];
      let y = h - 20;
      for (const row of rows) {
        const n = row.length;
        const rw = n === 2 ? cell * 2 : cell;
        const x0 = w / 2 - rw / 2;
        for (let i = 0; i < n; i++) {
          c.strokeRect(x0 + i * cell, y - cell, cell, cell);
          c.font = `bold ${typeof row[i] === 'string' ? 22 : 40}px ${HAND}`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(String(row[i]), x0 + i * cell + cell / 2, y - cell / 2);
        }
        y -= cell * 0.78;
        if (y < cell) break;
      }
    }, { srgb: false })
  );

/** Железная дверь подъезда с домофоном -- просто линии по краске. */
export const doorTex = (color) =>
  cached(`door${color}`, () =>
    make(128, 256, (c, w, h) => {
      c.fillStyle = hex(color);
      c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(20,24,28,0.45)';
      c.lineWidth = 4;
      c.strokeRect(10, 10, w - 20, h - 20);
      c.strokeRect(22, 24, w - 44, 90);
      c.strokeRect(22, 134, w - 44, 100);
      // кодовый замок
      c.fillStyle = '#b8bcbc';
      c.fillRect(w - 34, 120, 18, 30);
      c.fillStyle = '#3a3e42';
      for (let r = 0; r < 4; r++) for (let q = 0; q < 3; q++) c.fillRect(w - 32 + q * 5, 123 + r * 6, 3, 3);
      // ручка
      c.fillStyle = '#d0d3d2';
      c.fillRect(w - 30, 160, 12, 5);
    })
  );
