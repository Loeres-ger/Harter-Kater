import Phaser from 'phaser';
import { Ctx, blob, humanSheet, p, r, rng, tex, tex2x } from '../gfx';
import { bust } from '../guests/gfx';
import type { BustLook } from '../guests/data';

// Grafiken für „Mayas Feinkost“: altmodischer deutscher Wurst- und Käseladen.
// Kacheln 16×16 (doppelte Auflösung über tex2x), Kulisse 480×270, Maya als Figur und Brustbild.

const T = 16;

function speckle(c: Ctx, cols: string[], n: number, seed: number, w = T, h = T, x0 = 0, y0 = 0) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) p(c, x0 + Math.floor(rnd() * w), y0 + Math.floor(rnd() * h), cols[Math.floor(rnd() * cols.length)]);
}

/** Wand: Edelweiß-Tapete oben, Holzvertäfelung unten */
function wall(c: Ctx, seed: number) {
  r(c, 0, 0, T, 9, '#e8dcb8');
  for (let y = 2; y < 9; y += 5) for (let x = (y % 2) * 2 + 2; x < T; x += 6) { p(c, x, y, '#ffffff'); p(c, x - 1, y, '#c8d0b0'); p(c, x + 1, y, '#c8d0b0'); p(c, x, y - 1, '#c8d0b0'); p(c, x, y + 1, '#c8d0b0'); }
  r(c, 0, 9, T, 7, '#7a4a28'); r(c, 0, 9, T, 1, '#a06a3a');
  for (let x = 2; x < T; x += 5) r(c, x, 11, 3, 4, '#6a3e20');
  speckle(c, ['#d8ccaa'], 4, seed, T, 9);
}

/** Wurst: kleiner Ring bzw. Stange */
function wurst(c: Ctx, x: number, y: number, col: string) {
  r(c, x, y, 4, 2, col); p(c, x, y, '#ffffff44'); p(c, x + 3, y + 1, '#00000033');
}

function drawLaden(c: Ctx) {
  const rnd = rng(77);
  // Tapete mit Edelweiß, Holzvertäfelung
  r(c, 0, 0, 480, 150, '#e8dcb8');
  for (let y = 10; y < 150; y += 18) for (let x = (y / 18 % 2) * 9 + 6; x < 480; x += 18) {
    p(c, x, y, '#ffffff'); r(c, x - 2, y, 5, 1, '#c8d0b0'); r(c, x, y - 2, 1, 5, '#c8d0b0'); p(c, x, y, '#f0e070');
  }
  r(c, 0, 150, 480, 50, '#7a4a28'); r(c, 0, 150, 480, 3, '#a06a3a');
  for (let x = 8; x < 480; x += 40) { r(c, x, 160, 30, 34, '#6a3e20'); r(c, x, 160, 30, 1, '#8a5a30'); }
  // Wimpelkette in Weiß-Blau
  for (let x = 0; x < 480; x += 16) {
    const y = 18 + Math.round(Math.sin(x / 70) * 4);
    for (let i = 0; i < 7; i++) r(c, x + i, y + i, 12 - i * 2 > 0 ? 12 - i * 2 : 1, 1, (x / 16) % 2 ? '#3a7ad0' : '#f4f4f4');
  }
  // Kuckucksuhr
  r(c, 220, 40, 40, 44, '#5a3418'); for (let i = 0; i < 10; i++) r(c, 218 + i * 2, 40 - i, 44 - i * 4, 1, '#4a2a12');
  blob(c, 240, 62, 13, 13, '#f0e8d0'); r(c, 240, 52, 1, 10, '#1a1a1a'); r(c, 240, 62, 7, 1, '#1a1a1a');
  r(c, 234, 86, 2, 30, '#c0a040'); r(c, 244, 86, 2, 22, '#c0a040'); blob(c, 235, 118, 3, 5, '#a08020'); blob(c, 245, 110, 3, 5, '#a08020');
  // Geweih
  r(c, 120, 60, 24, 14, '#5a3418');
  for (const s of [-1, 1]) for (let i = 0; i < 18; i++) { p(c, 132 + s * (4 + i), 58 - Math.floor(i * 0.9), '#e8dcc0'); if (i % 6 === 3) for (let k = 0; k < 5; k++) p(c, 132 + s * (4 + i), 58 - Math.floor(i * 0.9) - k, '#e8dcc0'); }
  // Regale mit Gläsern, Senf, Dosen
  for (const sx of [20, 340]) {
    r(c, sx, 40, 110, 4, '#6a3e20'); r(c, sx, 80, 110, 4, '#6a3e20'); r(c, sx, 120, 110, 4, '#6a3e20');
    for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) {
      const x = sx + 4 + i * 12, y = 40 + row * 40;
      const col = ['#e8c040', '#c84a2a', '#8ab04a', '#e8e0d0', '#a04a8a'][Math.floor(rnd() * 5)];
      r(c, x, y - 14, 8, 14, col); r(c, x + 1, y - 16, 6, 2, '#c8c8c8'); r(c, x + 1, y - 10, 6, 3, '#f8f4e8');
    }
  }
  // hängende Salamis
  for (let i = 0; i < 8; i++) { const x = 160 + i * 9; r(c, x, 26, 1, 12, '#8a7a5a'); r(c, x - 2, 38, 5, 18 + (i % 3) * 4, '#8a2a2a'); p(c, x - 1, 42, '#e8c8b8'); p(c, x + 1, 48, '#e8c8b8'); }
  for (let i = 0; i < 6; i++) { const x = 280 + i * 9; r(c, x, 26, 1, 10, '#8a7a5a'); r(c, x - 2, 36, 5, 22, '#c08a5a'); }
  // Theke: Glasvitrine mit Würsten und Käse, Preisschilder
  r(c, 0, 196, 480, 74, '#f0ece0'); r(c, 0, 196, 480, 4, '#c8c4b8');
  r(c, 10, 204, 460, 36, '#c8dce8'); r(c, 10, 204, 460, 2, '#ffffff');
  for (let i = 0; i < 26; i++) wurst(c, 18 + i * 17, 218 + (i % 3) * 5, ['#c84a3a', '#d8a080', '#8a3a2a', '#e0c0a0'][i % 4]);
  for (let i = 0; i < 6; i++) { blob(c, 300 + i * 26, 230, 10, 5, '#f0c840'); r(c, 300 + i * 26 - 8, 229, 4, 2, '#e0a820'); }
  for (let i = 0; i < 9; i++) { r(c, 24 + i * 50, 238, 14, 7, '#ffffff'); r(c, 26 + i * 50, 240, 10, 1, '#c02020'); r(c, 26 + i * 50, 242, 6, 1, '#c02020'); }
}

const MAYA_PAL = { skin: '#f4d0b0', hair: '#6a3a1e', coat: '#2a6a3a', coat2: '#1e5a2e', pants: '#f4d0b0', shoes: '#3a2010', shirt: '#f8f6ee', skirt: '#8a2a3a', apron: '#c03a4a', longHair: true, lips: '#c02a3a' };
const MAYA: BustLook = { skin: '#f4d0b0', hair: '#6a3a1e', style: 'long', outfit: 'dirndl', top: '#2a6a3a', top2: '#c03a4a', accent: '#f0d040', lips: '#c02a3a', earrings: '#f0d040' };

export function makeLadenTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('ladenFloor')) return;
  const make = (key: string, draw: (c: Ctx) => void, w = T, h = T) => tex2x(scene, key, w, h, draw);

  make('ladenFloor', (c) => {
    // altes Schachbrett-Linoleum
    for (let y = 0; y < T; y += 8) for (let x = 0; x < T; x += 8) r(c, x, y, 8, 8, (x + y) % 16 ? '#d8ccb0' : '#8a6a4a');
    speckle(c, ['#c8bca0', '#7a5a3a'], 8, 81);
  });
  make('ladenWallFront', (c) => wall(c, 82));
  make('ladenWallTop', (c) => { r(c, 0, 0, T, T, '#2a1a10'); speckle(c, ['#3a2416'], 8, 83); });
  make('ladenShelf', (c) => {
    wall(c, 84);
    r(c, 0, 6, T, 1, '#5a3418'); r(c, 0, 12, T, 1, '#5a3418');
    for (let i = 0; i < 4; i++) { r(c, 1 + i * 4, 2, 3, 4, ['#e8c040', '#c84a2a', '#8ab04a', '#e8e0d0'][i]); r(c, 1 + i * 4, 8, 3, 4, ['#a04a8a', '#e8c040', '#c8c8c8', '#c84a2a'][i]); }
  });
  make('ladenFridge', (c) => {
    wall(c, 85);
    r(c, 1, 0, 14, 16, '#e8e8f0'); r(c, 2, 1, 12, 13, '#a8c8d8');
    for (let y = 2; y < 14; y += 4) for (let x = 3; x < 13; x += 3) { r(c, x, y, 2, 3, '#6a4a1a'); p(c, x, y, '#e0c040'); } // Bierflaschen
    r(c, 13, 6, 1, 3, '#8a8a90');
  });
  make('ladenClock', (c) => {
    wall(c, 86);
    r(c, 4, 1, 8, 8, '#5a3418'); for (let i = 0; i < 3; i++) r(c, 3 + i, 1 - i + 2, 10 - i * 2, 1, '#4a2a12');
    blob(c, 8, 5, 2.5, 2.5, '#f0e8d0'); p(c, 8, 4, '#1a1a1a'); p(c, 9, 5, '#1a1a1a');
    r(c, 6, 9, 1, 4, '#c0a040'); r(c, 9, 9, 1, 3, '#c0a040');
  });
  make('ladenFlag', (c) => {
    wall(c, 87);
    // weiß-blaue Rauten, davor eine Brezel
    for (let y = 1; y < 9; y++) for (let x = 2; x < 14; x++) p(c, x, y, ((x + y) >> 1) % 2 ? '#3a7ad0' : '#f4f4f4');
    for (const [x, y] of [[6, 4], [7, 3], [8, 3], [9, 4], [8, 5], [7, 5], [6, 6], [9, 6], [5, 5], [10, 5]]) p(c, x, y, '#a0602a');
  });
  make('ladenAntlers', (c) => {
    wall(c, 88);
    r(c, 6, 4, 4, 4, '#5a3418');
    for (let i = 0; i < 5; i++) { p(c, 5 - i, 4 - Math.floor(i / 2), '#e8dcc0'); p(c, 10 + i, 4 - Math.floor(i / 2), '#e8dcc0'); }
    p(c, 3, 1, '#e8dcc0'); p(c, 12, 1, '#e8dcc0'); p(c, 2, 0, '#e8dcc0'); p(c, 13, 0, '#e8dcc0');
  });
  make('ladenCounter', (c) => {
    // Theke von oben: Glasvitrine mit Würsten, Preisschild
    r(c, 0, 0, T, T, '#f0ece0'); r(c, 0, 0, T, 2, '#c8c4b8');
    r(c, 1, 3, 14, 9, '#c8dce8'); r(c, 1, 3, 14, 1, '#ffffff');
    wurst(c, 2, 5, '#c84a3a'); wurst(c, 8, 6, '#d8a080'); wurst(c, 4, 9, '#8a3a2a'); wurst(c, 10, 9, '#e0c0a0');
    r(c, 11, 12, 4, 3, '#ffffff'); r(c, 12, 13, 2, 1, '#c02020');
  });
  make('ladenCheese', (c) => {
    r(c, 0, 0, T, T, '#f0ece0'); r(c, 0, 0, T, 2, '#c8c4b8');
    blob(c, 5, 7, 4, 3, '#f0c840'); r(c, 1, 7, 8, 3, '#e0a820'); p(c, 4, 6, '#d09810');
    r(c, 10, 3, 5, 6, '#c8c8c8'); r(c, 11, 2, 3, 1, '#a8a8a8'); r(c, 11, 4, 3, 2, '#2a3a2a'); // Waage
    r(c, 2, 12, 4, 3, '#ffffff'); r(c, 3, 13, 2, 1, '#c02020');
  });
  make('ladenCrates', (c) => {
    r(c, 0, 0, T, T, '#00000000');
    r(c, 1, 3, 14, 12, '#c8a020'); r(c, 1, 3, 14, 2, '#e0c040');
    for (let x = 3; x < 14; x += 3) for (let y = 6; y < 14; y += 3) { r(c, x, y, 2, 2, '#4a2a0a'); p(c, x, y, '#e0c040'); }
    r(c, 5, 9, 6, 2, '#ffffff'); // Etikett
  });
  make('ladenStand', (c) => {
    r(c, 1, 1, 14, 14, '#6a3e20'); r(c, 1, 1, 14, 2, '#8a5a30');
    for (let i = 0; i < 3; i++) { r(c, 3 + i * 4, 4, 3, 4, ['#c84a2a', '#e8c040', '#8ab04a'][i]); r(c, 3 + i * 4, 10, 3, 4, ['#c8c8c8', '#a04a8a', '#e8e0d0'][i]); }
  });
  make('ladenDoor', (c) => {
    r(c, 0, 0, T, T, '#2a1a10');
    r(c, 2, 0, 12, 16, '#e0c070'); r(c, 3, 0, 10, 15, '#7a4a28');
    r(c, 4, 2, 8, 5, '#a8c8d8'); r(c, 11, 9, 1, 2, '#f0d050');
    r(c, 7, 0, 2, 2, '#f0d050'); // Türglocke
  });
  // Ladentür und Schild draußen an der Fassade
  make('ladenEntrance', (c) => {
    r(c, 0, 0, T, T, '#6a3a2c');
    for (let y = 0; y < T; y += 4) { r(c, 0, y + 3, T, 1, '#38221a'); r(c, (y / 4) % 2 ? 4 : 0, y, 1, 3, '#38221a'); }
    r(c, 3, 2, 10, 14, '#e0c070'); r(c, 4, 3, 8, 13, '#7a4a28');
    r(c, 5, 4, 6, 5, '#f0d890'); // warmes Licht im Fenster
    r(c, 10, 10, 1, 2, '#f0d050');
  });
  // Schild ohne Schrift, der Schriftzug kommt als Text darüber (AlleyScene)
  tex2x(scene, 'ladenSign', 80, 13, (c) => {
    r(c, 0, 0, 80, 13, '#2a6a3a'); r(c, 1, 1, 78, 11, '#f4f0e0');
    r(c, 70, 5, 7, 3, '#c84a3a'); p(c, 70, 5, '#ffffff'); p(c, 76, 7, '#8a2a2a'); // Wurst
  });

  // Maya: Figur (Dirndl) und Brustbilder
  humanSheet(scene, 'maya', MAYA_PAL);
  scene.anims.create({ key: 'maya_wipe', frames: [1, 0, 2, 0].map((f) => ({ key: 'maya', frame: f })), frameRate: 4, repeat: 1 });
  bust(scene, 'nbust_maya', MAYA, 'smug');
  bust(scene, 'nbust_mayaHappy', MAYA, 'happy');

  tex(scene, 'csLaden', 480, 270, drawLaden);
}
