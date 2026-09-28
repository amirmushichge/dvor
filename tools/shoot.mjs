/**
 * Съёмка ревью-кадров собранной версии.
 *
 *   npm run build && node tools/shoot.mjs [имя ...]
 *
 * Поднимает vite preview, открывает страницу в локальном Chrome (headless,
 * с GPU через ANGLE), собирает ошибки консоли и сохраняет кадры в
 * docs/shots/.  Выход с кодом 1, если в консоли были ошибки.
 */
import puppeteer from 'puppeteer-core';
import { preview } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));

export const SHOTS = {
  // стартовый кадр: из арки во двор
  '01-arch': { pos: [0.2, 0, 16.2], yaw: Math.PI - 0.06, pitch: 0.07 },
  // от выбивалки через площадку на ракету и гаражи (камера отодвинута от
  // тополя на (-12.5, 33.6): вплотную его ствол закрывал левую треть кадра)
  '02-playground': { pos: [-15.5, 0, 38.5], yaw: Math.PI + 0.95, pitch: 0.06 },
  // от гаражей на «семёрку», лавочку и девятиэтажку
  '03-garages': { pos: [9.6, 0, 53.5], yaw: -0.18, pitch: 0.04 },
  // с середины двора назад, на девятиэтажку с аркой (вне кустов у северного дома)
  '04-panel': { pos: [-4.5, 0, 64.5], yaw: 0.05, pitch: 0.13 },
  // улица с трамваем у остановки
  '05-tram': { pos: [-6, 0, 10.4], yaw: Math.PI / 2 - 0.35, pitch: 0.06, tramX: -40, advance: 0.2 },
  // вид на всю планету
  '06-planet': { orbit: 0.55, dist: 2.9 },
};

const OUT = path.resolve('docs/shots');
fs.mkdirSync(OUT, { recursive: true });

const server = await preview({ preview: { port: 5189, host: '127.0.0.1', open: false }, logLevel: 'silent' });
const url = 'http://127.0.0.1:5189/';
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--window-size=1600,900'],
  defaultViewport: { width: 1600, height: 900 },
});
const errors = [];
try {
  const page = await browser.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction('window.__ready === true', { timeout: 120000 });
  console.log(`scene ready in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const info = await page.evaluate(() => {
    const r = window.__scene.renderer;
    const gl = r.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a',
      stats: window.__scene.world.stats,
      calls: r.info.render.calls, tris: r.info.render.triangles,
    };
  });
  console.log(JSON.stringify(info));
  const want = process.argv.slice(2);
  for (const [name, opts] of Object.entries(SHOTS)) {
    if (want.length && !want.some((w) => name.includes(w))) continue;
    const data = await page.evaluate((o) => window.__shot(o), opts);
    const file = path.join(OUT, name + '.jpg');
    fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    console.log('saved', file);
  }
  // замер fps в стартовом кадре
  const fps = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t = performance.now();
    const f = () => { n++; if (performance.now() - t < 3000) requestAnimationFrame(f); else res(n / 3); };
    requestAnimationFrame(f);
  }));
  console.log('fps (headless, 1600x900):', fps.toFixed(1));
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
if (errors.length) {
  console.log('CONSOLE ERRORS/WARNINGS:\n' + errors.join('\n'));
  process.exitCode = errors.some((e) => !e.startsWith('[warning]')) ? 1 : 0;
} else {
  console.log('console: clean');
}
