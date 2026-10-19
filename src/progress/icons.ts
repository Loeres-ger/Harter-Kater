import Phaser from 'phaser';
import { Ctx, blob, outline, p, r, tex2x } from '../gfx';

// Kleine Pixel-Symbole (12×12) für die Achievements.

const S = 12;

const ICONS: Record<string, (c: Ctx) => void> = {
  ach_skull: (c) => {
    blob(c, 6, 5, 4.5, 4.2, '#e8e4d4');
    r(c, 3, 8, 6, 3, '#e8e4d4');
    r(c, 3, 4, 2, 2, '#1a1212'); r(c, 7, 4, 2, 2, '#1a1212');
    p(c, 6, 7, '#1a1212');
    for (let x = 4; x < 9; x += 2) p(c, x, 10, '#8a8478');
  },
  ach_fist: (c) => {
    blob(c, 6, 6, 4.5, 4, '#f0c08a');
    for (let i = 0; i < 4; i++) r(c, 2 + i * 2, 2, 2, 3, '#f0c08a');
    for (let i = 0; i < 4; i++) p(c, 2 + i * 2, 4, '#c8905a');
    r(c, 3, 10, 6, 2, '#e8e8e2');
  },
  ach_pill: (c) => {
    for (let i = 0; i < 6; i++) { r(c, 1 + i, 7 - i, 3, 3, '#3a70d0'); r(c, 5 + i, 3 - i + 4, 3, 3, '#d03a3a'); }
    p(c, 3, 6, '#a0c8ff'); p(c, 8, 5, '#ffb0a0');
  },
  ach_baton: (c) => {
    for (let i = 0; i < 9; i++) r(c, 1 + i, 9 - i, 2, 2, '#1a1a22');
    r(c, 2, 9, 3, 1, '#4a4a5a');
    blob(c, 9, 3, 2, 2, '#f8e070'); p(c, 9, 3, '#ffffff'); // Stern: aua
  },
  ach_heart: (c) => {
    blob(c, 4, 4, 2.6, 2.6, '#e04a6a'); blob(c, 8, 4, 2.6, 2.6, '#e04a6a');
    for (let y = 5; y < 11; y++) r(c, 1 + (y - 5), y, 10 - (y - 5) * 2, 1, '#e04a6a');
    p(c, 3, 3, '#ffb0c0');
  },
  ach_roll: (c) => {
    // Klopapierrolle, fast leer
    r(c, 2, 3, 8, 7, '#f4f2ea'); blob(c, 2, 6.5, 1.5, 3.5, '#d8d4c8'); blob(c, 2, 6.5, 0.8, 1.6, '#8a7a5a');
    r(c, 10, 3, 1, 7, '#c8c4b8'); r(c, 6, 10, 4, 1, '#f4f2ea');
  },
  ach_glass: (c) => {
    r(c, 3, 2, 6, 9, '#a8d0e8'); r(c, 3, 2, 6, 3, '#d8f0ff'); r(c, 4, 5, 4, 5, '#7ab0d8');
    r(c, 2, 1, 8, 1, '#c8e0f0'); p(c, 4, 3, '#ffffff');
  },
  ach_pretzel: (c) => {
    // Brezel
    for (const [x, y] of [[2, 4], [2, 5], [2, 6], [3, 3], [3, 7], [4, 2], [4, 8], [5, 2], [5, 7], [6, 5], [6, 6], [7, 2], [7, 7], [8, 2], [8, 8], [9, 3], [9, 7], [10, 4], [10, 5], [10, 6], [4, 9], [8, 9], [3, 10], [9, 10]] as const) { p(c, x, y, '#a0602a'); p(c, x, y + 1, '#7a4418'); }
    p(c, 4, 4, '#f8f8f0'); p(c, 8, 5, '#f8f8f0'); p(c, 6, 3, '#f8f8f0');
  },
  ach_lock: (c) => {
    r(c, 3, 2, 6, 1, '#8a8478'); r(c, 3, 2, 1, 4, '#8a8478'); r(c, 8, 2, 1, 4, '#8a8478');
    r(c, 2, 6, 8, 5, '#6a6458'); r(c, 5, 7, 2, 2, '#1a1212'); p(c, 5, 9, '#1a1212');
  },
};

export function makeAchievementIcons(scene: Phaser.Scene) {
  for (const [key, draw] of Object.entries(ICONS)) tex2x(scene, key, S, S, (c) => { draw(c); outline(c, 0, 0, S, S); });
}
