import Phaser from 'phaser';
import { Ctx, blob, eyeShine, folds, p, r, sideLight, strands, tex2x } from '../gfx';
import { Mood, drawBust } from '../guests/gfx';
import type { BustLook } from '../guests/data';

// Grafiken für „Unter dem Eimer“, Kapitel 6: Jan (Brustbilder; die Figur ist ein Tänzer in clubGfx), der
// Stinkekäse, Hochzeitsbuffet und Bierkiste im Muskelkater, der Ölablauf auf der Bühne (heil und aufgeplatzt)
// und die leuchtende Schleimspur in der Gasse.

/** Jan: groß, Muskelpaket, freundliches Gesicht, Glitzerfliege */
export const JAN_HAUT = '#c08a62', JAN_HAUT_D = '#a06e48', JAN_HAAR = '#2a1a12';
const JAN: BustLook = { skin: JAN_HAUT, hair: JAN_HAAR, style: 'short', outfit: 'shirt', top: JAN_HAUT, top2: JAN_HAUT_D, accent: JAN_HAUT };

function janBust(scene: Phaser.Scene, key: string, mood: Mood) {
  const cx = 32;
  tex2x(scene, key, 64, 96, (c) => {
    drawBust(c, JAN, mood);
    const h = JAN_HAUT, d = JAN_HAUT_D;
    // breiter, nackter Oberkörper: Kragen und Knopfleiste übermalen, Schultern verbreitern
    r(c, cx - 28, 58, 56, 38, h);
    blob(c, cx - 24, 60, 8, 7, h); blob(c, cx + 24, 60, 8, 7, h);
    r(c, cx - 8, 44, 16, 14, h);
    // Brust und Bauchmuskeln
    for (let i = 0; i < 12; i++) { p(c, cx - 14 + i, 70 + Math.round(Math.sin(i / 3.8) * 3), d); p(c, cx + 2 + i, 70 + Math.round(Math.sin(i / 3.8) * 3), d); }
    r(c, cx, 62, 1, 12, d);
    for (const y of [78, 85, 92]) { r(c, cx - 7, y, 6, 1, d); r(c, cx + 2, y, 6, 1, d); }
    r(c, cx, 76, 1, 20, d);
    // Ölglanz
    for (const [x, y] of [[cx - 10, 64], [cx + 9, 64], [cx - 18, 80], [cx + 16, 82]]) { p(c, x, y, '#f0d0b0'); p(c, x + 1, y, '#e8c098'); }
    // Glitzerfliege am Hals
    r(c, cx - 5, 47, 4, 4, '#c040ff'); r(c, cx + 2, 47, 4, 4, '#c040ff'); r(c, cx - 1, 48, 3, 2, '#e090ff');
    for (const [x, y] of [[cx - 4, 48], [cx + 3, 49], [cx + 4, 47]]) p(c, x, y, '#ffffff');
  }, { detail: (c) => { strands(c, JAN_HAAR); folds(c, undefined); eyeShine(c, ['#1c120a']); sideLight(c); } });
}

export function makeKanalTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('nbust_jan')) return;
  janBust(scene, 'nbust_jan', 'happy');
  janBust(scene, 'nbust_janAngst', 'angry');

  const make = (key: string, w: number, h: number, draw: (c: Ctx) => void) => tex2x(scene, key, w, h, draw);
  // Premium-Stinkekäse „Alter Schwede“: dicke Ecke, Rinde, grüne Duftwellen
  make('icon_stinkekaese', 16, 16, (c) => {
    for (let y = 0; y < 8; y++) r(c, 2 + Math.floor(y / 2), 7 + y, 12 - Math.floor(y / 2), 1, '#e8c860');
    r(c, 2, 6, 12, 2, '#f0d880'); r(c, 2, 14, 12, 1, '#a88a20'); r(c, 13, 6, 1, 9, '#c8a030');
    for (const [x, y, rr] of [[5, 10, 1.3], [9, 12, 1], [11, 8, 0.9]]) blob(c, x, y, rr, rr, '#b89a28');
    r(c, 4, 7, 6, 1, '#8aa040');
    for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) p(c, 4 + i * 4 + (k % 2), 4 - k, '#7ad04a');
  });
  // Hochzeitsbuffet: Tisch mit weißer Decke, zwei Curry-Töpfe, Blumen, Herzchen-Fähnchen
  make('hz_buffet', 32, 16, (c) => {
    r(c, 1, 6, 30, 8, '#f4f0e8'); r(c, 1, 6, 30, 1, '#ffffff'); r(c, 1, 13, 30, 1, '#c8c0b0');
    for (let x = 2; x < 31; x += 4) p(c, x, 13, '#e0d8c8');
    r(c, 3, 14, 2, 2, '#5a3a22'); r(c, 27, 14, 2, 2, '#5a3a22');
    for (const x of [7, 17]) { blob(c, x, 5, 4, 2.5, '#c8a040'); blob(c, x, 4, 3.2, 1.6, '#e0801a'); p(c, x - 1, 3, '#f4f0e0'); }
    r(c, 24, 1, 1, 5, '#3a8a3a'); blob(c, 24, 1, 1.6, 1.4, '#ff6aa0'); blob(c, 26, 2, 1.3, 1.2, '#ffd040');
    for (const x of [3, 12, 21, 29]) { p(c, x, 0, '#ff4a8a'); p(c, x + 1, 0, '#ff4a8a'); p(c, x, 1, '#ff4a8a'); }
  });
  // Bierkiste von Kalle (drei Flaschen fehlen)
  make('hz_kiste', 14, 10, (c) => {
    r(c, 0, 3, 14, 7, '#c8a030'); r(c, 0, 3, 14, 1, '#e8c860'); r(c, 0, 6, 14, 1, '#a88a20');
    for (let i = 0; i < 6; i++) { if (i === 1 || i === 4) continue; r(c, 1 + i * 2, 0, 1, 4, '#5a3a1a'); p(c, 1 + i * 2, 0, '#e8e0c0'); }
    r(c, 3, 7, 8, 2, '#d02a2a');
  });
  // Rosenbogen für die Trauung auf dem Laufsteg: zwei Säulen mit Rosen, Herz obendrauf
  make('hz_bogen', 40, 36, (c) => {
    for (const x of [3, 35]) { r(c, x, 10, 2, 26, '#f4f0e8'); r(c, x, 10, 1, 26, '#ffffff'); }
    for (let a = 0; a <= 20; a++) {
      const t = (a / 20) * Math.PI, x = 20 - Math.cos(t) * 16, y = 14 - Math.sin(t) * 10;
      blob(c, x, y, 2.2, 2.2, a % 3 ? '#e8406a' : '#ff9ac0'); p(c, Math.round(x), Math.round(y) - 1, '#ffd0e0');
      if (a % 4 === 0) r(c, Math.round(x) + 1, Math.round(y) + 2, 2, 1, '#3a8a3a');
    }
    for (const y of [16, 22, 28, 33]) for (const x of [3, 35]) { blob(c, x + 1, y, 1.8, 1.6, '#e8406a'); r(c, x - 1, y + 1, 2, 1, '#3a8a3a'); }
    for (const [x, y] of [[18, 0], [19, 0], [21, 0], [22, 0]]) p(c, x, y, '#ff2a6a');
    r(c, 17, 1, 7, 2, '#ff2a6a'); r(c, 18, 3, 5, 1, '#ff2a6a'); r(c, 19, 4, 3, 1, '#ff2a6a'); p(c, 20, 5, '#ff2a6a'); p(c, 18, 1, '#ffc0d0');
  });
  // Jans Glitzerfliege, die nach der Entführung im Schleim liegt
  make('hz_fliege', 10, 6, (c) => {
    blob(c, 5, 4, 4.5, 1.8, '#3aa02a');
    r(c, 1, 1, 3, 3, '#c040ff'); r(c, 6, 1, 3, 3, '#c040ff'); r(c, 4, 2, 2, 2, '#e090ff'); p(c, 2, 1, '#ffffff'); p(c, 7, 2, '#ffffff');
  });
  // Phase 5: Adshayans großer Topf (der von der Eröffnung), voll mit Curry, das brodelt und glüht
  make('curryTopf', 20, 16, (c) => {
    blob(c, 10, 14, 8, 1.6, '#00000050');
    r(c, 2, 5, 16, 9, '#b0602a'); r(c, 2, 5, 16, 1, '#e09050'); r(c, 15, 5, 3, 9, '#7a3a18'); r(c, 2, 13, 16, 1, '#5a2a10');
    for (const x of [6, 11]) r(c, x, 6, 1, 7, '#c8783a'); // Hammerschläge
    r(c, 0, 7, 2, 2, '#5a3a1a'); r(c, 18, 7, 2, 2, '#5a3a1a'); // Griffe
    blob(c, 10, 5, 7.5, 2, '#d0401a'); blob(c, 10, 5, 6, 1.4, '#f07a20');
    for (const [x, y] of [[6, 4], [12, 5], [9, 4], [14, 4]]) p(c, x, y, '#ffd040'); // Blasen
    p(c, 8, 5, '#3a8a2a'); p(c, 13, 4, '#ff3a1a'); // Koriander, Chili
    for (const [x, h] of [[5, 3], [10, 4], [15, 3]]) for (let i = 0; i < h; i++) p(c, x + (i % 2), 3 - i, '#f4e8d8'); // Dampf
  });
  make('curryFlamme', 14, 8, (c) => {
    for (const [x, h, f] of [[3, 5, '#3a7aff'], [7, 7, '#ff8a1a'], [11, 5, '#3a7aff'], [5, 6, '#ffd040'], [9, 6, '#ff5a1a']] as [number, number, string][]) {
      for (let i = 0; i < h; i++) { p(c, x, 7 - i, f); if (i < h - 2) p(c, x + 1, 7 - i, f); }
    }
    r(c, 1, 7, 12, 1, '#4a4a52');
  });
  make('chili', 7, 4, (c) => { r(c, 1, 1, 5, 2, '#e02a1a'); p(c, 6, 1, '#e02a1a'); r(c, 0, 1, 1, 1, '#2a8a2a'); p(c, 2, 1, '#ff8a7a'); });

  // Schleimklecks für die Spur in der Gasse
  make('hz_schleim', 10, 6, (c) => {
    blob(c, 5, 3, 4.5, 2.4, '#3aa02a'); blob(c, 5, 3, 3.4, 1.7, '#6aff4a'); p(c, 4, 2, '#c8ffb0'); blob(c, 9, 4, 1, 0.8, '#6aff4a');
  });
}
