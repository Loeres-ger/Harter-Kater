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
  ach_kaese: (c) => {
    // Käseecke mit Herz
    for (let y = 0; y < 6; y++) r(c, 1 + Math.floor(y / 2), 5 + y, 10 - Math.floor(y / 2), 1, '#f0c840');
    r(c, 1, 4, 10, 1, '#f8dc70'); p(c, 4, 7, '#c89820'); p(c, 7, 9, '#c89820');
    r(c, 7, 1, 2, 2, '#ff4a8a'); r(c, 10, 1, 2, 2, '#ff4a8a'); r(c, 8, 2, 3, 2, '#ff4a8a'); p(c, 9, 4, '#ff4a8a');
  },
  ach_ente: (c) => {
    // Ente mit Saugnapf-Tentakeln statt Füßen
    blob(c, 5, 6, 4, 2.4, '#d8c890'); blob(c, 8.5, 3.5, 2, 1.8, '#3a7a4a');
    r(c, 10, 3, 2, 1, '#e0a020'); p(c, 9, 3, '#101010'); r(c, 3, 5, 4, 1, '#b8a870');
    for (const x of [3, 5, 7]) { r(c, x, 8, 1, 3, '#8a4aaa'); p(c, x + 1, 10, '#8a4aaa'); p(c, x, 10, '#f0b0c8'); }
  },
  ach_schleuse: (c) => {
    // Schieberrad über Wasserwellen
    r(c, 0, 9, 12, 3, '#3a6a8a'); for (let x = 0; x < 12; x += 3) p(c, x, 9, '#8ac0e0');
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const d = Math.hypot(x - 6, y - 5); if (d > 2.6 && d < 4.4) p(c, x, y, '#c03028'); }
    r(c, 2, 5, 9, 1, '#e05a4a'); r(c, 6, 1, 1, 9, '#e05a4a'); p(c, 6, 5, '#f0e0c0');
  },
  ach_katzenwirt: (c) => {
    // grüne Monsterkatze mit Reiter
    blob(c, 6, 8, 5, 2.6, '#4e5a3c'); blob(c, 10, 6.5, 2, 1.8, '#66734c'); p(c, 10, 6, '#f0e840'); p(c, 11, 6, '#ff3a10');
    for (const x of [3, 5, 8, 10]) r(c, x, 10, 1, 2, '#38412a');
    r(c, 5, 2, 3, 4, '#3a5a2a'); r(c, 5, 1, 3, 1, '#e8b48a'); p(c, 1, 6, '#c08474'); p(c, 0, 5, '#c08474');
  },
  ach_geweih: (c) => {
    // gebrochenes Knochengeweih über grüner Brühe
    r(c, 0, 10, 12, 2, '#2a7a1a'); p(c, 3, 10, '#8ac83a'); p(c, 8, 10, '#8ac83a');
    for (let k = 0; k < 7; k++) { p(c, 3 - Math.floor(k / 3), 9 - k, '#ddd4b2'); p(c, 8 + Math.floor(k / 3), 9 - k, '#ddd4b2'); }
    p(c, 1, 4, '#ddd4b2'); p(c, 0, 3, '#ddd4b2'); p(c, 10, 4, '#ddd4b2'); p(c, 11, 2, '#ddd4b2'); p(c, 9, 1, '#7a2a2a'); p(c, 5, 6, '#b040ff');
  },
  ach_sponge: (c) => {
    // Schwamm mit grüner Scheuerseite und Schaum
    r(c, 1, 4, 10, 4, '#f0d040'); r(c, 1, 4, 10, 1, '#f8e880'); p(c, 3, 6, '#c8a820'); p(c, 7, 5, '#c8a820');
    r(c, 1, 8, 10, 2, '#3a9a4a');
    blob(c, 3, 2.5, 1.5, 1.3, '#ffffff'); blob(c, 7, 2, 1.2, 1, '#e8f4ff'); p(c, 10, 2, '#ffffff');
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
  ach_18: (c) => {
    // 18 im roten Kreis: erst ab 18
    for (let a = 0; a < 40; a++) p(c, Math.round(6 + Math.cos(a / 40 * Math.PI * 2) * 5), Math.round(6 + Math.sin(a / 40 * Math.PI * 2) * 5), '#d02a2a');
    r(c, 3, 4, 1, 5, '#f4f0e0'); p(c, 2, 5, '#f4f0e0');
    r(c, 5, 4, 4, 5, '#f4f0e0'); p(c, 6, 5, '#d02a2a'); p(c, 7, 5, '#d02a2a'); p(c, 6, 7, '#d02a2a'); p(c, 7, 7, '#d02a2a');
  },
  ach_file: (c) => {
    // Aktenmappe mit Stempel
    r(c, 1, 3, 10, 8, '#c8a050'); r(c, 1, 2, 4, 1, '#c8a050'); r(c, 2, 4, 8, 6, '#e0c070');
    r(c, 3, 5, 5, 1, '#6a5030'); r(c, 3, 7, 4, 1, '#6a5030');
    r(c, 7, 7, 3, 2, '#c02a2a');
  },
  ach_mic: (c) => {
    // Mikrofon mit Schallwellen
    blob(c, 5, 3.5, 2.5, 2.5, '#9aa0b0'); r(c, 3, 4, 5, 3, '#9aa0b0'); p(c, 4, 2, '#e8ecf4');
    r(c, 5, 7, 1, 3, '#4a4a5a'); r(c, 3, 10, 5, 1, '#4a4a5a');
    p(c, 9, 2, '#f8e070'); p(c, 10, 3, '#f8e070'); p(c, 10, 4, '#f8e070'); p(c, 9, 5, '#f8e070');
  },
  ach_lock: (c) => {
    r(c, 3, 2, 6, 1, '#8a8478'); r(c, 3, 2, 1, 4, '#8a8478'); r(c, 8, 2, 1, 4, '#8a8478');
    r(c, 2, 6, 8, 5, '#6a6458'); r(c, 5, 7, 2, 2, '#1a1212'); p(c, 5, 9, '#1a1212');
  },
};

export function makeAchievementIcons(scene: Phaser.Scene) {
  for (const [key, draw] of Object.entries(ICONS)) tex2x(scene, key, S, S, (c) => { draw(c); outline(c, 0, 0, S, S); });
}
