import * as THREE from 'three';
import { PAL } from './core/palette.js';
import { Pipeline } from './core/post.js';
import { buildSky } from './core/sky.js';
import { R, CENTER, basisAt, positionAt } from './world/planet.js';
import { setOutlineResolution } from './core/outline.js';
import { Player } from './core/player.js';
import { createHud } from './core/hud.js';
import { createMusic } from './core/audio.js';
import { buildWorld } from './world/index.js';
import { buildFluff } from './world/nature.js';

/* ------------------------------------------------------------------ *
 * Двор. Улица Строителей, 7 -- точка входа.
 *
 * Движок стиля -- из Sakura Crossing (Kenton Wang, MIT): cel-материалы,
 * тушь по второй производной глубины, грейд, мир-планета.  Свет переставлен
 * под июньский вечер: низкое тёплое солнце с северо-запада светит *в* арку,
 * против камеры, -- контровой свет, длинные тени к зрителю; холодный
 * сине-зелёный отражённый свет несёт всю теневую сторону.
 * ------------------------------------------------------------------ */

const canvas = document.getElementById('view');

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, powerPreference: 'high-performance', stencil: false,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(new THREE.Color(PAL.fog), 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PAL.fog, 60, 230);

const camera = new THREE.PerspectiveCamera(50, 1, 0.2, 700);
camera.rotation.order = 'YXZ';

/* ---------------------------------- свет ---------------------------------- */
// Солнце: запад-северо-запад, низко.  В локальной рамке: x -- восток, z -- север.
const SUN_LOCAL = new THREE.Vector3(-58, 34, 42);
const FILL_LOCAL = new THREE.Vector3(50, 24, -40);
const BOUNCE_LOCAL = new THREE.Vector3(10, -18, -40);

const sun = new THREE.DirectionalLight(PAL.sun, 2.35);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const SH = 52;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 260 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const fill = new THREE.DirectionalLight(PAL.fill, 1.15);
scene.add(fill, fill.target);
const bounce = new THREE.DirectionalLight(0xcfe0d8, 0.32);
scene.add(bounce, bounce.target);
const hemi = new THREE.HemisphereLight(PAL.hemiSky, PAL.hemiGround, 1.05);
scene.add(hemi);

/* ---------------------------------- мир ---------------------------------- */
const sky = buildSky(scene, 560);
const world = buildWorld(scene);
const fluff = buildFluff(scene, camera);

// Старт: в арке, лицом во двор (на север, +z).  yaw = PI смотрит на +z.
const player = new Player(camera, canvas, world, { pos: new THREE.Vector3(0.2, 0, 16.2), yaw: Math.PI - 0.06, pitch: 0.07 });

const hud = createHud({ volume: 0.34 });
const music = createMusic({ volume: 0.34, fadeIn: 3.0 });
hud.onStart = () => { music.start(); player.lock(); };
player.onLockChange = (locked) => hud.setLocked(locked);
canvas.addEventListener('click', () => { music.start(); if (!player.locked) player.lock(); });
player.onInteract = (target) => {
  if (hud.noteOpen) { hud.closeNote(); return; }
  if (target?.note) hud.showNote(target.note);
  else target?.action?.();
};

/* -------------------------------- пайплайн -------------------------------- */
const pipeline = new Pipeline(renderer, scene, camera);
// тени и тушь -- под более спокойную, «открыточную» картинку
Object.assign(pipeline.grade.mat.uniforms, {});
pipeline.grade.mat.uniforms.uShadowTint.value.set(0x9fc0c4);   // сине-зелёные тени
pipeline.grade.mat.uniforms.uLightTint.value.set(0xfff0dc);    // тёплый бумажный свет
pipeline.grade.mat.uniforms.uWarmth.value = 0.085;
pipeline.grade.mat.uniforms.uSaturation.value = 1.06;
pipeline.grade.mat.uniforms.uLift.value = 0.038;
pipeline.grade.mat.uniforms.uVignette.value = 0.2;
pipeline.ink.mat.uniforms.uFadeStart.value = 45;
pipeline.ink.mat.uniforms.uFadeEnd.value = 120;
pipeline.ink.mat.uniforms.uSkyDepth.value = 520;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  pipeline.setSize(w, h);
  setOutlineResolution(pipeline.size.x, pipeline.size.y);
}
window.addEventListener('resize', resize);
resize();

/* --------------------------------- цикл --------------------------------- */
const clock = new THREE.Clock();
const shadowTarget = new THREE.Vector3();
const off = new THREE.Vector3();
function seatLight(light, local, basis, origin) {
  off.set(0, 0, 0).addScaledVector(basis.east, local.x).addScaledVector(basis.up, local.y).addScaledVector(basis.north, local.z);
  light.target.position.copy(origin);
  light.position.copy(origin).add(off);
}
function seatLights() {
  // тень захватывает область перед камерой, а не только под ногами
  const fx = -Math.sin(player.yaw) * 22, fz = -Math.cos(player.yaw) * 22;
  const cx = player.pos.x + fx, cz = player.pos.z + fz;
  const b = basisAt(cx, cz);
  positionAt(cx, 0, cz, shadowTarget);
  seatLight(sun, SUN_LOCAL, b, shadowTarget);
  seatLight(fill, FILL_LOCAL, b, shadowTarget);
  seatLight(bounce, BOUNCE_LOCAL, b, shadowTarget);
  hemi.position.copy(b.up);
}

let planetView = false, orbit = 0.6;
const savedFog = scene.fog, savedFar = camera.far;
function setPlanetView(on) {
  planetView = on;
  scene.fog = on ? null : savedFog;
  camera.far = on ? 1800 : savedFar;
  camera.updateProjectionMatrix();
  const s = sun.shadow.camera, half = on ? R * 1.15 : SH;
  Object.assign(s, { left: -half, right: half, top: half, bottom: -half, far: on ? R * 6 : 260 });
  s.updateProjectionMatrix();
  hud.setPlanetView(on);
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyM') {
    const offM = music.toggle();
    hud.setMuted(offM);
    if (music.available) hud.flash(offM ? '♪  music off' : '♪  music on');
    else hud.flash('No music in this version');
  }
  if (e.code === 'KeyP') { setPlanetView(!planetView); hud.flash(planetView ? 'Planet view · P to return' : 'Back in the yard'); }
  if (e.code === 'KeyT') { world.tram.x = player.pos.x - 70; hud.flash('Tram called'); }
  if (e.code === 'KeyO') pipeline.enabled.ink = !pipeline.enabled.ink;
  if (e.code === 'KeyG') pipeline.enabled.grade = !pipeline.enabled.grade;
});

function placeOrbitCamera(o = orbit, dist = 3.2, tilt = 0.8) {
  const dir = new THREE.Vector3(Math.sin(o) * tilt, 1.0, Math.cos(o) * tilt).normalize();
  camera.position.copy(CENTER).addScaledVector(dir, R * dist);
  camera.up.set(0, 1, 0);
  camera.lookAt(CENTER);
  sun.target.position.copy(CENTER);
  sun.position.copy(CENTER).add(new THREE.Vector3(-1.05, 0.95, 0.75).multiplyScalar(R * 2.2));
}

function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  player.update(dt);
  world.update(dt);
  if (planetView) {
    orbit += dt * 0.09;
    placeOrbitCamera();
  } else {
    seatLights();
  }
  sky.dome.position.copy(camera.position);
  sky.clouds.position.copy(camera.position);
  fluff.update(dt);
  const hovered = !planetView && player.locked ? player.pick(world.interactables) : null;
  hud.setPrompt(hud.noteOpen ? 'E  ·  Close translation' : hovered ? `E  ·  ${hovered.label}` : '');
  hud.update(dt, player.locked);
  hud.setCoords(player.pos, player.yaw, player.pitch, dt);
  pipeline.render();
  requestAnimationFrame(frame);
}
frame();

window.__scene = { scene, camera, renderer, pipeline, world, player, sun, fill, hemi, fluff, THREE };

/**
 * Съёмка кадра для ревью: ставит камеру, дожидается, прокручивает мир
 * на `advance` секунд (трамвай, пух) и возвращает dataURL.  Используется
 * tools/shoot.mjs -- работает и в dev, и в собранной версии.
 */
window.__shot = async (opts = {}) => {
  const W = opts.W || 1600, H = opts.H || 900;
  if (opts.tramX !== undefined) world.tram.x = opts.tramX;
  for (let i = 0; i < (opts.advance || 0) * 30; i++) { world.update(1 / 30); fluff.update(1 / 30); }
  if (opts.pos) { player.pos.x = opts.pos[0]; player.pos.z = opts.pos[2]; }
  if (opts.yaw !== undefined) player.yaw = opts.yaw;
  if (opts.pitch !== undefined) player.pitch = opts.pitch;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  pipeline.forceScale = opts.scale || 1.5;
  pipeline.setSize(W, H);
  setOutlineResolution(pipeline.size.x, pipeline.size.y);
  if (opts.orbit !== undefined) {
    if (!planetView) setPlanetView(true);
    placeOrbitCamera(opts.orbit, opts.dist ?? 3.2);
  } else {
    if (planetView) setPlanetView(false);
    player.pos.y = world.heightAt(player.pos.x, player.pos.z, 0.3);
    player.bob = 0;
    player.applyCamera(0);
    seatLights();
  }
  sky.dome.position.copy(camera.position);
  sky.clouds.position.copy(camera.position);
  fluff.update(0.001);
  pipeline.render();
  return canvas.toDataURL('image/jpeg', opts.quality || 0.9);
};
window.__ready = true;
