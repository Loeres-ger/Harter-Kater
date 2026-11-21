import Phaser from 'phaser';
import { Ctx, Pal, blob, humanSheet, p, r, rng, tex, tex2x } from '../gfx';
import { bust } from '../guests/gfx';
import type { BustLook } from '../guests/data';
import { Look, personSheet } from './clubGfx';

// Grafiken für die Shisha-Bar „Shisha 1001“: Mosaikfliesen, Messing, niedrige Sofas, Wasserpfeifen, Laternen.
// Dazu Cemo (Chef der Bar) als Figur und Brustbild, ein paar Gäste und die Kulisse für Gespräche.

const T = 16;

function speckle(c: Ctx, cols: string[], n: number, seed: number, w = T, h = T, x0 = 0, y0 = 0) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) p(c, x0 + Math.floor(rnd() * w), y0 + Math.floor(rnd() * h), cols[Math.floor(rnd() * cols.length)]);
}

const CEMO_PAL: Pal = { skin: '#c8956a', hair: '#1a1210', coat: '#23262e', coat2: '#181a20', pants: '#2a2c34', shoes: '#101010', beard: '#1a1210', shirt: '#d8c090' };
const CEMO: BustLook = { skin: '#c8956a', hair: '#1a1210', style: 'short', outfit: 'shirt', top: '#23262e', top2: '#181a20', accent: '#e0c040', beard: '#1a1210' };

/** Stammgäste der Shisha-Bar (sitzen auf den Sofas) */
export const SHISHA_GUESTS: Record<string, Look> = {
  trainer: { skin: '#e0b088', skinD: '#c09068', hair: '#2a1a10', top: '#18181c', top2: '#101014', sleeves: true, print: '#f4f4f4', bottom: '#18181c', stripe: '#f4f4f4', shoes: '#f4f4f4' },
  hoodie: { skin: '#a8724c', skinD: '#88583a', hair: '#141010', top: '#5a6a3a', top2: '#4a5a2e', sleeves: true, bottom: '#3a3a44', shoes: '#e8e8e8', beard: '#141010' },
  opa: { skin: '#e8c8a8', skinD: '#c8a888', hair: '#c8c8c8', hairStyle: 'bald', top: '#7a6a5a', top2: '#5a4a3a', sleeves: true, bottom: '#4a4a4a', shoes: '#3a2a1a', beard: '#d8d8d8' },
  studentin: { skin: '#f0c8a8', skinD: '#d0a888', hair: '#6a3a1a', hairStyle: 'long', top: '#c86a3a', top2: '#a8552a', sleeves: true, bottom: '#2a3a5a', shoes: '#f0f0f0', lips: '#c0305a' },
  freundin: { skin: '#c8906a', skinD: '#a8704c', hair: '#141010', hairStyle: 'bun', top: '#e8e0d0', top2: '#c8c0b0', bottom: '#202024', skirt: true, legs: '#202024', shoes: '#101010', lips: '#a0203a' },
};

function mosaic(c: Ctx, seed: number) {
  // türkisblaue Fliesen mit goldenem Rautenmuster, unten ein Holzpaneel
  r(c, 0, 0, T, 11, '#1e5a62');
  for (let y = 0; y < 11; y += 4) for (let x = (y / 4) % 2 ? 2 : 0; x < T; x += 4) { p(c, x + 1, y + 1, '#d8b050'); p(c, x, y + 1, '#2a7a82'); p(c, x + 2, y + 1, '#2a7a82'); p(c, x + 1, y, '#2a7a82'); p(c, x + 1, y + 2, '#2a7a82'); }
  speckle(c, ['#18505a'], 6, seed, T, 11);
  r(c, 0, 11, T, 1, '#d8b050');
  r(c, 0, 12, T, 4, '#5a3220'); r(c, 0, 12, T, 1, '#7a4a2a');
}

function drawBackdrop(c: Ctx) {
  const rnd = rng(1001);
  r(c, 0, 0, 480, 270, '#1a0e0a');
  // Mosaikwand
  r(c, 0, 0, 480, 170, '#1e5a62');
  for (let y = 0; y < 170; y += 10) for (let x = (y / 10) % 2 ? 5 : 0; x < 480; x += 10) {
    r(c, x + 4, y + 2, 2, 6, '#2a7a82'); r(c, x + 2, y + 4, 6, 2, '#2a7a82'); r(c, x + 4, y + 4, 2, 2, '#d8b050');
  }
  // Bögen mit Spiegeln
  for (const x of [60, 240, 420]) {
    r(c, x - 34, 40, 68, 120, '#d8b050'); r(c, x - 31, 43, 62, 117, '#2a1a12');
    blob(c, x, 46, 34, 26, '#d8b050'); blob(c, x, 46, 31, 23, '#2a1a12');
    r(c, x - 26, 52, 52, 104, '#3a4a58'); blob(c, x, 52, 26, 18, '#3a4a58');
    for (let i = 0; i < 8; i++) p(c, x - 20 + Math.floor(rnd() * 40), 60 + Math.floor(rnd() * 90), '#6a8a9a');
  }
  // Holzpaneel und Sitzpolster
  r(c, 0, 170, 480, 100, '#4a2a1a'); r(c, 0, 170, 480, 3, '#d8b050');
  for (let x = 0; x < 480; x += 60) { r(c, x + 4, 190, 52, 40, '#8a1a2a'); r(c, x + 4, 190, 52, 4, '#c03040'); for (let i = 0; i < 4; i++) p(c, x + 12 + i * 12, 206, '#d8b050'); }
  // Wasserpfeifen auf dem Boden
  for (const x of [130, 350]) {
    blob(c, x, 250, 14, 12, '#3a8a7a'); blob(c, x - 4, 246, 4, 3, '#7acaba');
    r(c, x - 2, 196, 4, 44, '#c8a040'); r(c, x - 2, 196, 1, 44, '#f0d080');
    r(c, x - 8, 190, 16, 6, '#c8a040'); blob(c, x, 186, 7, 5, '#5a3a2a'); blob(c, x, 182, 4, 2, '#e05a2a');
  }
  // Laternen
  for (const x of [150, 330]) {
    r(c, x - 1, 0, 2, 20, '#3a2a1a');
    r(c, x - 8, 20, 16, 22, '#c8a040'); r(c, x - 6, 22, 12, 18, '#ffb050'); r(c, x - 10, 42, 20, 3, '#c8a040');
    for (let i = 0; i < 3; i++) r(c, x - 5 + i * 4, 23, 1, 16, '#c8a040');
  }
}

export function makeShishaTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('shishaFloor')) return;
  const make = (key: string, draw: (c: Ctx) => void, w = T, h = T) => tex2x(scene, key, w, h, draw);

  make('shishaFloor', (c) => {
    // Terrakotta-Fliesen mit kleinem Stern
    r(c, 0, 0, T, T, '#8a4a2a');
    r(c, 0, 0, T, 1, '#6a3420'); r(c, 0, 0, 1, T, '#6a3420'); r(c, 8, 0, 1, T, '#6a3420'); r(c, 0, 8, T, 1, '#6a3420');
    for (const [x, y] of [[4, 4], [12, 12]]) { p(c, x, y, '#d8b050'); p(c, x - 1, y, '#b8803a'); p(c, x + 1, y, '#b8803a'); p(c, x, y - 1, '#b8803a'); p(c, x, y + 1, '#b8803a'); }
    speckle(c, ['#9a5a34', '#7a4024'], 8, 1101);
  });
  make('shishaRug', (c) => {
    r(c, 0, 0, T, T, '#8a1a2a');
    r(c, 1, 1, T - 2, T - 2, '#a02a3a');
    for (let i = 0; i < 6; i++) { p(c, 8 - i, 2 + i, '#d8b050'); p(c, 8 + i, 2 + i, '#d8b050'); p(c, 8 - i, 13 - i, '#d8b050'); p(c, 8 + i, 13 - i, '#d8b050'); }
    speckle(c, ['#701020'], 6, 1102);
  });
  make('shishaWallFront', (c) => mosaic(c, 1103));
  make('shishaWallTop', (c) => { r(c, 0, 0, T, T, '#1a0e0a'); speckle(c, ['#2a1610'], 8, 1104); });
  make('shishaArch', (c) => {
    mosaic(c, 1105);
    // Spiegel im goldenen Bogen
    r(c, 3, 2, 10, 10, '#d8b050'); r(c, 4, 4, 8, 8, '#3a4a58'); r(c, 5, 2, 6, 2, '#3a4a58');
    p(c, 5, 5, '#8aa8b8'); p(c, 6, 6, '#8aa8b8');
  });
  make('shishaShelf', (c) => {
    mosaic(c, 1106);
    // Regal mit bunten Wasserpfeifen
    r(c, 0, 10, T, 1, '#5a3220');
    for (const [x, col] of [[2, '#3a8a7a'], [7, '#8a3a6a'], [12, '#3a5aa0']] as const) {
      blob(c, x + 1, 8, 2.2, 2, col); r(c, x + 1, 2, 1, 5, '#c8a040'); r(c, x, 1, 3, 1, '#c8a040');
    }
  });
  make('shishaCounter0', (c) => {
    r(c, 0, 0, T, 8, '#6a3a22'); r(c, 0, 0, T, 1, '#8a5a32');
    r(c, 2, 2, 3, 4, '#c8803a'); r(c, 2, 2, 3, 1, '#f0e0c0'); // Teeglas
    blob(c, 11, 4, 3, 2, '#c8a040'); // Messingtablett
    r(c, 0, 8, T, 8, '#4a2a1a'); r(c, 0, 8, T, 1, '#d8b050');
    for (let x = 2; x < T; x += 5) r(c, x, 10, 3, 4, '#3a1e12');
  });
  make('shishaCounter1', (c) => {
    r(c, 0, 0, T, 8, '#6a3a22'); r(c, 0, 0, T, 1, '#8a5a32');
    r(c, 8, 1, 5, 5, '#b0b0b8'); r(c, 9, 0, 3, 1, '#d0d0d8'); // Samowar
    r(c, 3, 3, 3, 3, '#c8803a'); r(c, 3, 3, 3, 1, '#f0e0c0');
    r(c, 0, 8, T, 8, '#4a2a1a'); r(c, 0, 8, T, 1, '#d8b050');
    for (let x = 2; x < T; x += 5) r(c, x, 10, 3, 4, '#3a1e12');
  });
  make('shishaSofa', (c) => {
    // niedriges Sitzpolster mit Kissen, Lehne an der Seite (Blick nach rechts)
    r(c, 1, 6, 14, 8, '#8a1a2a'); r(c, 1, 6, 14, 1, '#c03040');
    r(c, 1, 2, 4, 12, '#a02a3a'); r(c, 1, 2, 4, 1, '#d84a5a');
    for (const x of [6, 10]) { p(c, x, 9, '#d8b050'); p(c, x + 1, 10, '#d8b050'); }
    r(c, 1, 14, 14, 1, '#4a0a14');
  });
  make('shishaTable', (c) => {
    // runder Messingtisch, niedrig
    blob(c, 8, 9, 6.5, 4, '#a07a2a'); blob(c, 8, 8, 6, 3.6, '#d8b050');
    for (let i = 0; i < 5; i++) p(c, 4 + i * 2, 8, '#b8902a');
    r(c, 3, 6, 2, 2, '#c8803a'); p(c, 3, 6, '#f0e0c0'); // Tee
    r(c, 6, 12, 1, 3, '#7a5a1a'); r(c, 10, 12, 1, 3, '#7a5a1a');
  });
  make('shishaStool', (c) => {
    r(c, 7, 9, 2, 5, '#5a3220'); blob(c, 8, 14, 3.5, 1.2, '#3a2010');
    blob(c, 8, 8, 4.5, 2.4, '#8a1a2a'); r(c, 5, 7, 4, 1, '#c03040');
  });
  make('shishaPipe', (c) => {
    // Wasserpfeife: Glasbowl, Messingsäule, Kopf mit Kohle, Schlauch
    blob(c, 6, 24, 5, 4, '#3a8a7a'); blob(c, 4, 23, 1.5, 1.2, '#8adaca');
    r(c, 5, 6, 2, 15, '#c8a040'); r(c, 5, 6, 1, 15, '#f0d080');
    r(c, 2, 9, 8, 1, '#c8a040');
    r(c, 3, 3, 6, 3, '#6a4a2a'); r(c, 4, 2, 4, 1, '#e05a2a'); p(c, 5, 2, '#ffb050');
    for (let i = 0; i < 6; i++) p(c, 7 + Math.floor(i / 2), 12 + i, '#2a5a3a');
  }, 12, 28);
  make('shishaDoor', (c) => {
    r(c, 0, 0, T, T, '#1a0e0a');
    r(c, 3, 1, 10, 15, '#d8b050'); r(c, 4, 2, 8, 14, '#5a3220');
    blob(c, 8, 4, 4, 3, '#5a3220'); r(c, 6, 5, 4, 4, '#ffb050'); // Fenster mit Licht
    r(c, 10, 10, 1, 2, '#d8b050');
  });

  // Cemo und die Gäste
  humanSheet(scene, 'cemo', CEMO_PAL);
  bust(scene, 'nbust_cemo', CEMO, 'smug');
  bust(scene, 'nbust_cemoSad', CEMO, 'sad');
  for (const [id, L] of Object.entries(SHISHA_GUESTS)) personSheet(scene, `sg_${id}`, L);

  tex(scene, 'csShisha', 480, 270, drawBackdrop);
}
