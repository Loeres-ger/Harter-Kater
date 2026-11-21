import Phaser from 'phaser';
import { Ctx, blob, p, r, tex2x } from '../gfx';
import { bust } from '../guests/gfx';
import type { BustLook } from '../guests/data';
import { Look, personSheet } from './clubGfx';
import { makeEmilianTextures } from './emilianGfx';

// Figuren für den Xavi-Strang: Xavi (Lenis Freund), Tuncay (handelt aus dem Kofferraum), Leni Blume (Chefin des
// Muskelkaters) und Emilian (ihr Leibwächter, tanzt als Soldat). Emilians Figur steht in clubGfx (DANCER_LOOKS.soldat).

export const XAVI_LOOKS: Record<string, Look> = {
  /** schüchtern, braune Haare, brauner Bart, beiger Hoodie */
  xavi: { skin: '#e8c0a0', skinD: '#c8a080', hair: '#6a4428', top: '#c8b48a', top2: '#a8946a', sleeves: true, bottom: '#3a4a6a', shoes: '#6a4a2a', beard: '#6a4428' },
  /** Trödler mit Lederjacke und Schiebermütze */
  tuncay: { skin: '#c8956a', skinD: '#a8754a', hair: '#2a1a12', top: '#3a2418', top2: '#2a180e', sleeves: true, bottom: '#3a3a40', shoes: '#1a1210', beard: '#2a1a12', hat: 'cap', hatCol: '#5a4a3a' },
  /** Leni Blume: platinblond, schwarzer Hosenanzug, rote Lippen */
  leni2: { skin: '#f4d0b8', skinD: '#d8b098', hair: '#ece4d4', hairStyle: 'bob', top: '#141418', top2: '#0a0a0e', sleeves: true, bottom: '#141418', shoes: '#c02030', lips: '#c0102a' },
};

const BUSTS: Record<string, BustLook> = {
  xavi: { skin: '#e8c0a0', hair: '#6a4428', style: 'short', outfit: 'hoodie', top: '#c8b48a', top2: '#a8946a', accent: '#6a4428', beard: '#6a4428' },
  tuncay: { skin: '#c8956a', hair: '#2a1a12', style: 'cap', outfit: 'leather', top: '#3a2418', top2: '#2a180e', accent: '#c8a040', beard: '#2a1a12', hat: '#5a4a3a' },
  leni2: { skin: '#f4d0b8', hair: '#ece4d4', style: 'long', outfit: 'jacket', top: '#141418', top2: '#0a0a0e', accent: '#e0c040', lips: '#c0102a', earrings: '#e0c040' },
};

/** Tuncays Ware vor dem Kofferraum: Kisten mit Handys, ein Fahrrad ohne Sattel */
function drawKram(c: Ctx) {
  r(c, 1, 9, 9, 6, '#8a6a3a'); r(c, 1, 9, 9, 1, '#a88a5a');
  for (let i = 0; i < 3; i++) { r(c, 2 + i * 3, 6, 2, 3, '#202024'); p(c, 2 + i * 3, 6, '#60a0e0'); }
  r(c, 12, 11, 7, 4, '#5a5a62'); r(c, 12, 11, 7, 1, '#7a7a82');
  // Fahrrad
  blob(c, 24, 12, 3, 3, '#202024'); blob(c, 24, 12, 2, 2, '#4a3a2a');
  blob(c, 31, 12, 3, 3, '#202024'); blob(c, 31, 12, 2, 2, '#4a3a2a');
  r(c, 24, 9, 7, 1, '#c03030'); r(c, 27, 9, 1, 4, '#c03030'); r(c, 30, 7, 1, 3, '#a0a0a8');
  // Pappschild
  r(c, 13, 3, 8, 6, '#c8a878'); p(c, 15, 5, '#2a1a10'); p(c, 16, 5, '#2a1a10'); p(c, 18, 6, '#2a1a10');
}

export function makeXaviTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('xavi')) return;
  for (const [id, L] of Object.entries(XAVI_LOOKS)) personSheet(scene, id, L);
  bust(scene, 'nbust_xavi', BUSTS.xavi, 'sad');
  bust(scene, 'nbust_xaviHappy', BUSTS.xavi, 'happy');
  bust(scene, 'nbust_tuncay', BUSTS.tuncay, 'smug');
  bust(scene, 'nbust_tuncaySad', BUSTS.tuncay, 'sad');
  bust(scene, 'nbust_leni2', BUSTS.leni2, 'smug');
  bust(scene, 'nbust_leni2Sad', BUSTS.leni2, 'sad');
  makeEmilianTextures(scene);
  tex2x(scene, 'tuncayKram', 36, 16, drawKram);
}
