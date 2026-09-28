/**
 * Все цвета сцены в одном месте.
 *
 * Июньский вечер 2001 года: песочно-серые панели, охристый кирпич, масляная
 * краска подъездов, сочная зелень тополей.  Тени уходят не в фиолетовый, как
 * в оригинальном Sakura Crossing, а в холодный сине-зелёный -- так выглядят
 * советские открытки и выгоревшая плёнка «Свемы».
 *
 * Имена ключей, которые читает движок из src/core (sky, post, outline, toon),
 * сохранены: skyTop/skyMid/skyHaze, cloud/cloudShade, fog, sun/fill,
 * hemiSky/hemiGround, ink, glassDark, hill/hillFar.
 */
export const PAL = {
  // --- небо и воздух ---
  skyTop: 0x78acdc,
  skyMid: 0xc9e0ef,
  skyHaze: 0xf8e2c6,     // тёплая дымка к вечеру
  cloud: 0xfff8ee,
  cloudShade: 0xe9dfd6,
  fog: 0xe8e2d4,
  hill: 0xc3d0cf,
  hillFar: 0xd6dddb,

  // --- свет ---
  sun: 0xffdcb0,         // низкое вечернее солнце
  fill: 0x96c8d2,        // холодный отражённый свет с противоположной стороны
  hemiSky: 0xd6eaf0,
  hemiGround: 0x9db3a6,
  shadowTint: 0x4d7d86,  // куда уходит тень в cel-рампе

  // --- тушь ---
  ink: 0x2c3842,
  inkSoft: 0x44525c,

  // --- земля ---
  asphalt: 0x8d9092,
  asphaltOld: 0x9a9b98,
  asphaltDark: 0x767a7e,
  curb: 0xc9c6bc,
  curbDark: 0xaaa79e,
  grass: 0x8fae5c,
  grassDeep: 0x78984c,
  grassDry: 0xa9b36c,
  dirt: 0xb9a584,
  dirtDark: 0x9c8a6c,
  sand: 0xe2cf9e,

  // --- дома ---
  panel: 0xd8d1c0,        // панель девятиэтажки
  panelAlt: 0xcfc7b4,
  panelSeam: 0xa9a292,
  plinth: 0x8f8a80,       // цоколь
  brick: 0xc68a5c,        // хрущёвка, кирпич «под охру»
  brickDark: 0xa66f48,
  brickWhite: 0xe3dccb,
  roofTar: 0x5c5f63,
  roofSlate: 0x7d8580,
  concrete: 0xc4c0b6,
  concreteDark: 0x9e9a90,
  glass: 0x8fb3c2,
  glassDark: 0x3f5563,
  glassWarm: 0xe9c98a,
  frameWhite: 0xeeebe2,
  frameWood: 0x8a5a3a,
  frameAlu: 0xb8bcbc,
  tile: 0x9fb2b4,          // кафель в арке
  archPlaster: 0xb7b2a6,

  // --- масляная краска ---
  paintTeal: 0x3f9c95,
  paintGreen: 0x7fae5a,
  paintBlue: 0x5b8fc4,
  paintSky: 0x9cc7dc,
  paintYellow: 0xefc240,
  paintRed: 0xd4473c,
  paintOrange: 0xe0803a,
  paintWhite: 0xf1eee6,
  paintBrown: 0x7a4a32,

  // --- металл ---
  metal: 0x8e959a,
  metalDark: 0x4d5357,
  rust: 0xa65f38,
  rustDark: 0x7d4428,
  wire: 0x2c3036,

  // --- машины и трамвай ---
  aubergine: 0x4a2a4c,     // «баклажан»
  chrome: 0xd6dadb,
  tyre: 0x2c2e31,
  tramRed: 0xcf3f36,
  tramCream: 0xf1e1b4,
  tramYellow: 0xefc04a,

  // --- зелень ---
  leafLight: 0x9fc764,
  leaf: 0x7aa64b,
  leafDeep: 0x55803c,
  trunk: 0x7c7466,
  trunkPoplar: 0x8f8c80,

  // --- мелочи ---
  wood: 0xa7784c,
  woodDark: 0x7b5534,
  fluff: 0xfdfcf6,
  black: 0x2e3033,
  white: 0xf6f4ee,
};
