import Phaser from 'phaser';
import { Ctx, blob, eyeShine, folds, humanSheet, outline, p, r, rng, sideLight, strands, tex, tex2x } from '../gfx';
import { bust } from '../guests/gfx';
import type { BustLook } from '../guests/data';

// Grafiken für Dachboden, Toiletten und ihre Bewohner: Kacheln (16×16), Figuren, Brustbilder
// und Kulissen für Gespräche und Zwischensequenzen (480×270).

const T = 16;
const BW = 64, BH = 96;

function speckle(c: Ctx, cols: string[], n: number, seed: number, w = T, h = T, x0 = 0, y0 = 0) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) p(c, x0 + Math.floor(rnd() * w), y0 + Math.floor(rnd() * h), cols[Math.floor(rnd() * cols.length)]);
}

function planks(c: Ctx, seed: number, w = T, h = T, x0 = 0, y0 = 0) {
  r(c, x0, y0, w, h, '#5a4030');
  const rnd = rng(seed);
  for (let y = 0; y < h; y += 4) {
    r(c, x0, y0 + y + 3, w, 1, '#3a2818');
    const s = Math.floor(rnd() * w);
    r(c, x0 + s, y0 + y, 1, 3, '#3a2818');
  }
  speckle(c, ['#6a4c38', '#4a3424', '#705240'], Math.floor(w * h / 12), seed + 1, w, h, x0, y0);
}

function tiles(c: Ctx, base: string, line: string, seed: number) {
  r(c, 0, 0, T, T, base);
  for (let i = 0; i < T; i += 4) { r(c, 0, i, T, 1, line); r(c, i, 0, 1, T, line); }
  speckle(c, ['#9a9070', '#b8b090', '#8a8060'], 16, seed);
}

// ---------------------------------------------------------------- Figuren (Draufsicht)

/** Borna im Schneidersitz: Mütze, Hoodie, Bart. Bild 1: zieht am Joint. */
function drawBornaSit(c: Ctx, ox: number, puff: boolean) {
  const cx = ox + 8;
  const SK = '#d8a880', HO = '#5a4a6a', HO2 = '#4a3a5a';
  // Schneidersitz
  r(c, cx - 6, 11, 12, 3, '#3a3a4a'); r(c, cx - 7, 12, 3, 2, '#2a2a34'); r(c, cx + 4, 12, 3, 2, '#2a2a34');
  // Hoodie, leicht zusammengesunken
  r(c, cx - 5, 5, 10, 7, HO); r(c, cx + 2, 5, 3, 7, HO2);
  r(c, cx - 2, 9, 4, 2, HO2); // Bauchtasche
  // Kopf mit Mozart-Lockenpracht: Volumen oben, Locken an den Seiten, lang über die Schultern
  const HAIR = '#7a4a26';
  r(c, cx - 3, 1, 6, 5, SK);
  r(c, cx - 4, 0, 8, 2, HAIR);
  r(c, cx - 6, 1, 2, 9, HAIR); r(c, cx + 4, 1, 2, 9, HAIR);
  blob(c, cx - 6, 2, 1.4, 1.4, HAIR); blob(c, cx + 5, 2, 1.4, 1.4, HAIR);
  blob(c, cx - 6, 5, 1.4, 1.4, HAIR); blob(c, cx + 5, 5, 1.4, 1.4, HAIR);
  p(c, cx - 6, 3, '#5a3418'); p(c, cx + 5, 6, '#5a3418');
  r(c, cx - 2, 3, 1, 1, '#e03030'); r(c, cx + 1, 3, 1, 1, '#e03030'); // knallrote Augen
  if (puff) {
    r(c, cx + 2, 4, 3, 3, SK); r(c, cx + 3, 4, 3, 1, '#f0f0e8'); p(c, cx + 6, 4, '#ff8030');
  } else {
    r(c, cx + 4, 8, 3, 2, SK); r(c, cx + 6, 8, 3, 1, '#f0f0e8'); p(c, cx + 9, 8, '#c06020');
  }
  outline(c, ox, 0, 16, 14);
}

/** Lily sitzt am Boden: 0 = Kopf auf den Knien, 1 = schluchzt, 2 = aufrecht und froh */
function drawLilySit(c: Ctx, ox: number, pose: number) {
  const cx = ox + 8;
  const SK = '#f0c8a8', HAIR = '#6a4026', CARD = '#5a7a8a', CARD2 = '#4a6a7a', JEANS = '#3a3a4a';
  if (pose < 2) {
    // Knie angezogen, Arme drumherum
    r(c, cx - 4, 8, 8, 5, JEANS); r(c, cx - 5, 12, 3, 2, '#2a2020'); r(c, cx + 2, 12, 3, 2, '#2a2020');
    r(c, cx - 5, 6, 10, 5, CARD); r(c, cx + 2, 6, 3, 5, CARD2);
    r(c, cx - 4, 8, 8, 2, SK); // Hände um die Knie
    const hy = pose === 0 ? 3 : 2;
    r(c, cx - 4, hy, 8, 5, HAIR); r(c, cx - 3, hy + 3, 6, 2, SK);
    r(c, cx - 3, hy + 3, 6, 1, '#1a1a1a'); // Brille
    if (pose === 1) p(c, cx + 3, hy + 5, '#a8d8ff');
  } else {
    r(c, cx - 5, 11, 10, 3, JEANS); r(c, cx - 6, 12, 3, 2, '#2a2020'); r(c, cx + 3, 12, 3, 2, '#2a2020');
    r(c, cx - 5, 5, 10, 7, CARD); r(c, cx + 2, 5, 3, 7, CARD2);
    r(c, cx - 4, 0, 8, 7, HAIR); r(c, cx - 3, 1, 6, 5, SK);
    r(c, cx - 3, 2, 6, 1, '#1a1a1a');
    r(c, cx - 1, 4, 2, 1, '#c05050'); // Lächeln
  }
  outline(c, ox, 0, 16, 14);
}

/** Kurdischer Kevin: riesig, lockig, behaart, Tanga in Rot-Weiß-Grün mit gelber Sonne. Bild 1: Pose. */
function drawKevin(c: Ctx, ox: number, flex: boolean) {
  const cx = ox + 11;
  const SK = '#c89068', SKD = '#a8704c', HAIR = '#1a1210';
  // Beine (kräftig, behaart) mit Badelatschen
  r(c, cx - 6, 18, 5, 6, SK); r(c, cx + 1, 18, 5, 6, SK);
  for (let i = 0; i < 4; i++) { p(c, cx - 5 + (i % 2) * 2, 19 + i, SKD); p(c, cx + 2 + (i % 2) * 2, 19 + i, SKD); }
  r(c, cx - 7, 24, 6, 2, '#2a2a6a'); r(c, cx + 1, 24, 6, 2, '#2a2a6a');
  // Tanga: Rot / Weiß / Grün, Sonne vorne
  r(c, cx - 6, 16, 12, 1, '#d02a2a'); r(c, cx - 4, 17, 8, 1, '#f4f4f0'); r(c, cx - 2, 18, 4, 1, '#2a9a3a');
  p(c, cx, 17, '#f0c020'); p(c, cx - 1, 17, '#f0c020');
  // Bauch und Brust, mächtig
  r(c, cx - 8, 7, 16, 9, SK);
  r(c, cx - 7, 15, 14, 1, SK);
  r(c, cx + 4, 7, 4, 9, SKD);
  for (let i = 0; i < 9; i++) p(c, cx - 4 + ((i * 3) % 8), 8 + (i % 5), HAIR); // Brusthaar
  r(c, cx - 1, 12, 2, 1, SKD); // Bauchnabel
  if (!flex) {
    r(c, cx - 11, 7, 3, 8, SK); r(c, cx + 8, 7, 3, 8, SK);
    r(c, cx - 11, 14, 3, 2, SKD); r(c, cx + 8, 14, 3, 2, SKD);
  } else {
    r(c, cx - 12, 6, 4, 2, SK); r(c, cx + 8, 6, 4, 2, SK);
    r(c, cx - 12, 1, 3, 5, SK); r(c, cx + 9, 1, 3, 5, SK);
    blob(c, cx - 10, 4, 1.6, 1.4, '#e0a880'); blob(c, cx + 10, 4, 1.6, 1.4, '#e0a880');
  }
  // Kopf mit Locken und Bart
  r(c, cx - 3, 2, 6, 5, SK);
  r(c, cx - 3, 5, 6, 2, HAIR);
  for (const [x, y] of [[-4, 0], [-2, -0], [0, 0], [2, 0], [3, 1], [-4, 2], [3, 2]]) blob(c, cx + x + 0.5, y + 1, 1.2, 1.2, HAIR);
  p(c, cx - 1, 4, '#1a1a1a'); p(c, cx + 1, 4, '#1a1a1a');
  outline(c, ox, 0, 22, 26);
}

// ---------------------------------------------------------------- Brustbilder

const LOOKS: Record<string, BustLook> = {
  borna: { skin: '#e0b090', hair: '#7a4a26', style: 'mozart', outfit: 'hoodie', top: '#5a4a6a', top2: '#4a3a5a', accent: '#c8c0a0' },
  lily: { skin: '#f0c8a8', hair: '#6a4026', style: 'long', outfit: 'cardigan', top: '#5a7a8a', top2: '#4a6a7a', accent: '#e8e0d0', glasses: true },
  leni: { skin: '#f4c8a8', hair: '#d8a050', style: 'long', outfit: 'jacket', top: '#c03a6a', top2: '#a02a5a', accent: '#202020', lips: '#d02a4a', earrings: '#f0d040' },
};

// ---------------------------------------------------------------- Kulissen (480×270, Pixel 1:1)

/** Dachboden von innen: Dachschrägen, Fenster mit Mond, Matratze, Kisten, Kerze. leer = Bornas Platz ist verlassen. */
function drawDach(c: Ctx, leer: boolean) {
  const rnd = rng(12);
  // Rückwand aus Brettern
  for (let x = 0; x < 480; x += 24) {
    r(c, x, 0, 24, 230, x % 48 ? '#3a2a1e' : '#35261a');
    r(c, x, 0, 1, 230, '#22180e');
    for (let i = 0; i < 6; i++) p(c, x + 3 + Math.floor(rnd() * 18), Math.floor(rnd() * 220), '#4a3626');
  }
  // Dachschrägen links und rechts
  for (let y = 0; y < 200; y++) {
    const w = Math.max(0, 150 - y * 0.85);
    r(c, 0, y, w, 1, '#2a1c12'); r(c, 480 - w, y, w, 1, '#2a1c12');
    if (y % 18 === 0) { r(c, 0, y, w, 2, '#4a3220'); r(c, 480 - w, y, w, 2, '#4a3220'); }
  }
  // Dämmwolle zwischen den Sparren
  for (let i = 0; i < 40; i++) { const y = Math.floor(rnd() * 150); const w = Math.max(0, 150 - y * 0.85); if (w > 6) blob(c, rnd() * (w - 4) + 2, y, 3, 2, '#c89a80'); }
  // Querbalken
  r(c, 0, 26, 480, 8, '#4a3220'); r(c, 0, 33, 480, 2, '#22180e');
  // Fenster mit Nachthimmel und Mond
  const wx = 290, wy = 52;
  r(c, wx - 4, wy - 4, 88, 66, '#2a1c12');
  r(c, wx, wy, 80, 58, leer ? '#2a3448' : '#16203a');
  for (let i = 0; i < 18; i++) p(c, wx + Math.floor(rnd() * 80), wy + Math.floor(rnd() * 40), '#d8d8f0');
  blob(c, wx + 58, wy + 16, 7, 7, '#f0ecd0'); blob(c, wx + 61, wy + 14, 5, 5, leer ? '#2a3448' : '#16203a');
  for (let i = 0; i < 6; i++) { const bh = 8 + Math.floor(rnd() * 14); r(c, wx + i * 14, wy + 58 - bh, 12, bh, '#0c1222'); }
  r(c, wx + 38, wy, 4, 58, '#2a1c12'); r(c, wx, wy + 27, 80, 3, '#2a1c12');
  if (leer) {
    // offenes Fenster, Vorhang weht nach innen
    r(c, wx + 40, wy, 40, 58, '#3a4a68');
    for (let y = 0; y < 50; y++) r(c, wx + 2 + Math.floor(Math.sin(y / 6) * 3), wy + y, 10, 1, '#8a8aa0');
  }
  // Wäscheleine mit Socken
  for (let x = 160; x < 270; x++) p(c, x, 46 + Math.floor(Math.sin((x - 160) / 35) * 4 + 4), '#8a7a6a');
  if (!leer) for (const [x, col] of [[180, '#c84a4a'], [205, '#e8e8e0'], [232, '#4a7ac8']] as const) r(c, x, 52, 6, 10, col);
  // Poster mit grünem Blatt
  if (!leer) {
    r(c, 60, 84, 46, 58, '#1a1a1a'); r(c, 62, 86, 42, 54, '#2a4a2a');
    for (let i = 0; i < 7; i++) { const a = (i / 6) * Math.PI - Math.PI; for (let k = 0; k < 16; k++) p(c, 83 + Math.round(Math.cos(a) * k), 120 + Math.round(Math.sin(a) * k * 1.2), '#5ac04a'); }
    r(c, 82, 120, 2, 14, '#3a8a2a');
  }
  // Boden
  for (let y = 200; y < 270; y += 6) { r(c, 0, y, 480, 6, y % 12 ? '#4a3424' : '#523a28'); r(c, 0, y + 5, 480, 1, '#2a1c12'); }
  // Matratze mit Decke
  r(c, 40, 196, 170, 18, leer ? '#8a8270' : '#a89a80'); r(c, 40, 212, 170, 4, '#6a6050');
  blob(c, 90, 202, 18, 5, '#9a8a6a'); blob(c, 150, 206, 12, 4, '#8a7a5a'); // Flecken
  r(c, 46, 188, 34, 10, '#d8d0c0'); // Kissen
  if (!leer) { r(c, 110, 186, 90, 14, '#4a5a7a'); r(c, 110, 186, 90, 3, '#5a6a8a'); }
  else {
    // Zettel auf der Matratze
    r(c, 120, 190, 22, 16, '#f0ead8'); for (let i = 0; i < 4; i++) r(c, 123, 193 + i * 3, 14 - i * 2, 1, '#5a5a6a');
  }
  // Kisten, Pizzakartons, Kerze
  r(c, 330, 160, 56, 46, '#8a6234'); r(c, 330, 160, 56, 3, '#a87a44'); r(c, 344, 176, 28, 8, '#e8dcb0');
  r(c, 392, 176, 46, 30, '#a0703c'); r(c, 392, 176, 46, 3, '#c08850');
  for (let i = 0; i < 4; i++) { r(c, 240, 202 - i * 5, 44, 5, '#d8b070'); r(c, 240, 202 - i * 5, 44, 1, '#a07a40'); }
  r(c, 18, 182, 18, 22, '#6a4a2a'); // Kerzenkiste
  if (!leer) { r(c, 24, 172, 5, 10, '#f0e8d0'); r(c, 25, 168, 3, 4, '#ffb040'); p(c, 26, 167, '#fff0a0'); }
  else { r(c, 24, 176, 5, 6, '#c8c0a8'); }
  // Lavalampe
  if (!leer) { r(c, 222, 182, 10, 4, '#3a3a3a'); r(c, 223, 160, 8, 22, '#c03a8a'); blob(c, 227, 168, 2.5, 3, '#ff7ac0'); blob(c, 226, 176, 2, 2, '#ff7ac0'); }
}

/** Toilette (Seitenansicht): Fliesen, Spiegel, Waschbecken, Kabinentüren, Neonröhre. */
function drawWC(c: Ctx) {
  const rnd = rng(31);
  for (let y = 0; y < 270; y += 12) for (let x = 0; x < 480; x += 12) {
    r(c, x, y, 12, 12, (x + y) % 24 ? '#a8b8a4' : '#9cac98');
    r(c, x, y + 11, 12, 1, '#6a7a68'); r(c, x + 11, y, 1, 12, '#6a7a68');
  }
  for (let i = 0; i < 30; i++) p(c, Math.floor(rnd() * 480), Math.floor(rnd() * 200), '#7a8a78');
  r(c, 0, 0, 480, 14, '#2a2424'); r(c, 140, 10, 200, 4, '#e8f8e8'); // Neonröhre
  // Spiegel und Waschbecken
  for (const x of [40, 150]) {
    r(c, x, 50, 70, 64, '#4a4a4a'); r(c, x + 3, 53, 64, 58, '#8aa0aa');
    r(c, x + 10, 60, 2, 40, '#c0d0d8'); r(c, x + 40, 58, 1, 50, '#6a7a80');
    r(c, x + 5, 130, 60, 14, '#ecece4'); r(c, x + 9, 132, 52, 6, '#b8c8d0');
    r(c, x + 32, 120, 6, 10, '#9a9aa0'); r(c, x + 32, 144, 6, 40, '#6a5040');
  }
  // Graffiti
  r(c, 240, 60, 40, 2, '#3a3a8a'); for (let i = 0; i < 6; i++) p(c, 244 + i * 6, 56 + (i % 2) * 2, '#3a3a8a');
  // Kabinentüren rechts
  for (const x of [320, 400]) {
    r(c, x, 30, 72, 206, '#5a7a5a'); r(c, x + 4, 34, 64, 190, '#6a8a6a');
    r(c, x + 54, 128, 8, 4, '#c8c8c8'); r(c, x + 50, 60, 10, 6, x === 320 ? '#c02a2a' : '#2a9a3a');
  }
  // Boden
  for (let x = 0; x < 480; x += 16) { r(c, x, 236, 16, 34, x % 32 ? '#c8c4b0' : '#b8b4a0'); r(c, x, 236, 1, 34, '#8a8878'); }
  blob(c, 210, 252, 30, 6, '#c8b860');
}

/** In der Kabine (Seitenansicht): WC, leerer Papierhalter, Trennwand mit riesigen Füßen von nebenan (das Loch zeichnet StallScene). */
function drawKabine(c: Ctx) {
  for (let y = 0; y < 270; y += 12) for (let x = 0; x < 480; x += 12) {
    r(c, x, y, 12, 12, (x + y) % 24 ? '#c8c4b0' : '#bcb8a4');
    r(c, x, y + 11, 12, 1, '#8a8878'); r(c, x + 11, y, 1, 12, '#8a8878');
  }
  // Boden liegt höher, damit er über der Textbox sichtbar bleibt
  const F = 170;
  // Trennwand rechts mit Spalt unten
  r(c, 330, 0, 40, F - 22, '#6a8a6a'); r(c, 330, 0, 4, F - 22, '#8aaa8a'); r(c, 366, 0, 4, F - 22, '#4a6a4a');
  // Boden
  for (let x = 0; x < 480; x += 16) { r(c, x, F, 16, 270 - F, x % 32 ? '#c8c4b0' : '#b8b4a0'); r(c, x, F, 1, 270 - F, '#8a8878'); }
  // Riesige behaarte Füße in Badelatschen, die unter der Trennwand herüberschauen
  for (const fx of [348, 410]) {
    blob(c, fx + 18, F - 6, 20, 7, '#c89068');
    r(c, fx, F - 3, 40, 5, '#2a2a6a'); r(c, fx + 14, F - 13, 4, 10, '#2a2a6a');
    for (let i = 0; i < 6; i++) p(c, fx + 6 + i * 5, F - 12 + (i % 2), '#1a1210');
  }
  // WC
  r(c, 120, 36, 60, 44, '#ecece4'); r(c, 120, 36, 60, 4, '#ffffff'); r(c, 168, 42, 8, 3, '#c8c8c8'); // Spülkasten
  r(c, 140, 80, 20, 44, '#e0e0d8');
  blob(c, 150, 130, 40, 10, '#ecece4'); r(c, 112, 122, 76, 8, '#f4f4ee'); r(c, 112, 130, 76, 4, '#c8c8c0');
  r(c, 130, 134, 40, F - 134, '#e0e0d8');
  // leerer Papierhalter
  r(c, 230, 100, 30, 6, '#8a8a90'); r(c, 236, 106, 18, 4, '#6a6a70');
  // Kritzeleien
  for (let i = 0; i < 9; i++) p(c, 240 + i * 4, 50 + (i % 3), '#3a3a8a');
  r(c, 240, 58, 36, 1, '#3a3a8a'); blob(c, 286, 54, 3, 3, '#c02a4a'); // „KEVIN WAR HIER“ mit Herz
  r(c, 0, 0, 480, 10, '#2a2424'); r(c, 180, 4, 120, 3, '#e8f8e8');
}

// ---------------------------------------------------------------- alles erzeugen

const LILY_PAL = { skin: '#f0c8a8', hair: '#6a4026', coat: '#5a7a8a', coat2: '#4a6a7a', pants: '#3a3a4a', shoes: '#2a2020', longHair: true };
const LENI_PAL = { skin: '#f4c8a8', hair: '#d8a050', coat: '#c03a6a', coat2: '#a02a5a', pants: '#f4c8a8', shoes: '#101010', longHair: true, lips: '#d02a4a', skirt: '#202020', boots: true };

export function makeRoomTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('atticFloor')) return;
  const make = (key: string, draw: (c: Ctx) => void, w = T, h = T, detail?: (c: Ctx) => void) => tex2x(scene, key, w, h, draw, detail ? { detail } : {});

  // ---- Dachboden
  make('atticFloor', (c) => planks(c, 41));
  make('atticWallFront', (c) => { r(c, 0, 0, T, T, '#3a2a1e'); r(c, 0, 0, 1, T, '#22180e'); r(c, 8, 0, 1, T, '#22180e'); });
  make('atticWallTop', (c) => { r(c, 0, 0, T, T, '#1a120c'); speckle(c, ['#24180e'], 10, 42); });
  make('atticRoofFront', (c) => {
    r(c, 0, 0, T, T, '#2a1c12');
    for (let i = 0; i < T; i += 2) r(c, i, T - 1 - i, 2, 1 + i, '#3a2818'); // Schräge
    r(c, 0, 0, 3, T, '#4a3220'); r(c, 13, 0, 3, T, '#4a3220'); // Sparren
    blob(c, 8, 5, 3, 2, '#c89a80'); blob(c, 7, 8, 2.5, 1.5, '#b88a70'); // Dämmwolle
    r(c, 0, 14, T, 2, '#1a120c');
  });
  make('atticWindow', (c) => {
    r(c, 0, 0, T, T, '#2a1c12');
    r(c, 2, 2, 12, 10, '#4a3220'); r(c, 3, 3, 10, 8, '#16203a');
    p(c, 10, 5, '#f0ecd0'); p(c, 5, 4, '#d8d8f0'); p(c, 7, 8, '#d8d8f0');
    r(c, 7, 3, 1, 8, '#4a3220'); r(c, 3, 7, 10, 1, '#4a3220');
    r(c, 0, 14, T, 2, '#1a120c');
  });
  make('atticHatch', (c) => {
    planks(c, 43);
    r(c, 2, 2, 12, 12, '#1a100a'); r(c, 2, 2, 12, 1, '#7a5a3a');
    r(c, 4, 3, 1, 11, '#8a6a3a'); r(c, 11, 3, 1, 11, '#8a6a3a');
    for (let y = 5; y < 14; y += 3) r(c, 4, y, 8, 1, '#8a6a3a');
  });
  make('mattressL', (c) => {
    planks(c, 44);
    r(c, 1, 3, 15, 11, '#a89a80'); r(c, 1, 12, 15, 2, '#6a6050');
    r(c, 2, 4, 6, 4, '#d8d0c0'); blob(c, 11, 9, 2.5, 1.5, '#8a7a5a');
  });
  make('mattressR', (c) => {
    planks(c, 45);
    r(c, 0, 3, 14, 11, '#a89a80'); r(c, 0, 12, 14, 2, '#6a6050');
    r(c, 0, 4, 12, 7, '#4a5a7a'); r(c, 0, 4, 12, 1, '#5a6a8a'); blob(c, 4, 12, 2, 1, '#8a7a5a');
  });
  make('atticJunk', (c) => {
    planks(c, 46);
    // Schaukelpferd mit einem Auge
    r(c, 3, 13, 11, 1, '#6a3a1a'); r(c, 2, 12, 2, 1, '#6a3a1a'); r(c, 13, 12, 2, 1, '#6a3a1a');
    r(c, 4, 9, 2, 4, '#a07040'); r(c, 11, 9, 2, 4, '#a07040');
    r(c, 4, 6, 8, 4, '#e8dcc0'); r(c, 10, 2, 4, 5, '#e8dcc0'); r(c, 9, 2, 2, 3, '#8a3a2a');
    p(c, 12, 3, '#1a1a1a');
  }, T, T);
  make('armchair', (c) => {
    planks(c, 47);
    r(c, 2, 2, 12, 12, '#4a6a3a'); r(c, 1, 5, 3, 9, '#3a5a2a'); r(c, 12, 5, 3, 9, '#3a5a2a');
    r(c, 4, 7, 8, 5, '#5a7a4a'); r(c, 6, 9, 3, 2, '#c8b890'); // Füllung quillt raus
  });
  make('candleCrate', (c) => {
    planks(c, 48);
    r(c, 2, 5, 12, 10, '#8a6234'); r(c, 2, 5, 12, 2, '#a87a44');
    r(c, 6, 1, 3, 5, '#f0e8d0'); p(c, 7, 0, '#ffb040');
    r(c, 9, 4, 3, 2, '#3a3a3a'); // Aschenbecher
  });
  make('atticBoxes', (c) => {
    planks(c, 49);
    r(c, 1, 4, 9, 10, '#b08a50'); r(c, 1, 4, 9, 2, '#c8a060'); r(c, 3, 8, 5, 2, '#f0e8d0');
    r(c, 8, 1, 7, 7, '#a07a44'); r(c, 8, 1, 7, 1, '#c09050');
  });
  make('bornaSit', (c) => { drawBornaSit(c, 0, false); drawBornaSit(c, 16, true); }, 32, 14);
  scene.textures.get('bornaSit').add(0, 0, 0, 0, 32, 28);
  scene.textures.get('bornaSit').add(1, 0, 32, 0, 32, 28);
  make('lilySit', (c) => { drawLilySit(c, 0, 0); drawLilySit(c, 16, 1); drawLilySit(c, 32, 2); }, 48, 14);
  for (let i = 0; i < 3; i++) scene.textures.get('lilySit').add(i, 0, i * 32, 0, 32, 28);

  // ---- Bar: Leiter zum Dachboden, Türen zu den Toiletten
  make('barLadder', (c) => {
    r(c, 0, 0, T, 7, '#b89a5a'); for (let x = 1; x < T; x += 4) r(c, x, 1, 1, 5, '#a8884a');
    r(c, 0, 7, T, 9, '#4a2e1c'); r(c, 0, 7, T, 1, '#6a4a2e');
    r(c, 2, 0, 12, 2, '#1a1010');
    r(c, 3, 0, 1, T, '#9a7a4a'); r(c, 12, 0, 1, T, '#9a7a4a');
    for (let y = 2; y < T; y += 3) r(c, 3, y, 10, 1, '#b08a5a');
  });
  const wcDoor = (c: Ctx, sign: string, herr: boolean) => {
    tiles(c, '#a8b8a4', '#6a7a68', herr ? 61 : 62);
    r(c, 0, 0, T, 1, '#1f1616');
    r(c, 2, 2, 12, 14, '#e0c070'); r(c, 3, 3, 10, 13, '#7a5a3a');
    r(c, 11, 9, 1, 2, '#f0d050');
    r(c, 5, 4, 6, 6, sign);
    // Piktogramm: Mann bzw. Frau
    p(c, 8, 5, '#ffffff'); r(c, 7, 6, 3, 2, '#ffffff');
    if (herr) { p(c, 7, 8, '#ffffff'); p(c, 9, 8, '#ffffff'); }
    else { r(c, 6, 8, 5, 1, '#ffffff'); }
  };
  make('doorHerren', (c) => wcDoor(c, '#2a3a6a', true));
  make('doorDamen', (c) => wcDoor(c, '#8a2a4a', false));

  // ---- Toiletten
  make('wcExit', (c) => {
    tiles(c, '#a8b8a4', '#6a7a68', 63);
    r(c, 2, 0, 12, 14, '#e0c070'); r(c, 3, 0, 10, 13, '#6a3a1a');
    r(c, 4, 2, 8, 3, '#2a6a3a'); r(c, 5, 3, 6, 1, '#f0e8d0'); // „BAR“-Schild
  });
  const stallDoor = (c: Ctx, dark: boolean, light: string) => {
    tiles(c, '#c8c4b0', '#8a8878', dark ? 64 : 65);
    r(c, 1, 1, 14, 14, dark ? '#3a3030' : '#6a8a6a'); r(c, 1, 1, 14, 1, dark ? '#5a4a4a' : '#8aaa8a');
    r(c, 10, 7, 3, 3, light); p(c, 11, 8, '#ffffff');
    r(c, 3, 7, 2, 1, '#c8c8c8');
  };
  make('stallDoorLocked', (c) => stallDoor(c, true, '#d02a2a'));
  make('stallDoorFree', (c) => stallDoor(c, false, '#2aa04a'));
  make('stallDoorOpen', (c) => {
    tiles(c, '#c8c4b0', '#8a8878', 66);
    r(c, 1, 1, 14, 14, '#1a1414'); r(c, 1, 1, 3, 14, '#3a3030'); // offen, dahinter dunkel
  });

  // ---- Figuren
  make('kevin', (c) => { drawKevin(c, 0, false); drawKevin(c, 22, true); }, 44, 26);
  scene.textures.get('kevin').add(0, 0, 0, 0, 44, 52);
  scene.textures.get('kevin').add(1, 0, 44, 0, 44, 52);
  humanSheet(scene, 'lilyWalk', LILY_PAL);
  humanSheet(scene, 'leni', LENI_PAL);
  for (const k of ['lilyWalk', 'leni']) {
    scene.anims.create({ key: `${k}_down`, frames: [1, 0, 2, 0].map((f) => ({ key: k, frame: f })), frameRate: 8, repeat: -1 });
    scene.anims.create({ key: `${k}_side`, frames: [7, 6, 8, 6].map((f) => ({ key: k, frame: f })), frameRate: 8, repeat: -1 });
    scene.anims.create({ key: `${k}_stagger`, frames: [7, 6, 8, 6].map((f) => ({ key: k, frame: f })), frameRate: 5, repeat: -1 });
  }

  // ---- Brustbilder
  bust(scene, 'nbust_borna', LOOKS.borna, 'stoned');
  bust(scene, 'nbust_bornaHappy', LOOKS.borna, 'happy');
  bust(scene, 'nbust_lily', LOOKS.lily, 'sad');
  bust(scene, 'nbust_lilyHappy', LOOKS.lily, 'happy');
  bust(scene, 'nbust_leni', LOOKS.leni, 'drunk');

  // ---- Kulissen
  tex(scene, 'csDach', 480, 270, (c) => drawDach(c, false));
  tex(scene, 'csDachLeer', 480, 270, (c) => drawDach(c, true));
  tex(scene, 'csWC', 480, 270, drawWC);
  tex(scene, 'csKabine', 480, 270, drawKabine);
}
