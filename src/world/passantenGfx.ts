import Phaser from 'phaser';
import { Ctx, Pal, blob, drawHuman, eyeShine, folds, p, r, strands, tex2x } from '../gfx';
import { bust } from '../guests/gfx';
import type { BustLook } from '../guests/data';

// Figuren für die Straße: zehn Passanten, zwei weitere Damen der Nacht (Desirée, Roxy), zwei Streifenpolizisten
// (Petra, Kai), Chihuahua Tyson und das Zubehör (Rollator, Einkaufswagen, Pakete, Megafon, Becher, Pfandtüte,
// Bauchladen). Figuren als 16×20-Bogen wie alle anderen (vorne, hinten, seitlich × drei Schritte).

type Extra = (c: Ctx, ox: number, dir: number, step: number) => void;

const PALS: Record<string, [Pal, Extra?]> = {
  // Zappel-Ronny: graue Kapuze, dürr, Augenringe
  ps_ronny: [{ skin: '#d8b8a0', hair: '#5a4a3a', coat: '#6a6a72', coat2: '#4a4a52', pants: '#3a3a44', shoes: '#e8e8e8', hat: '#6a6a72', hat2: '#4a4a52' },
    (c, ox, d) => { if (d === 0) { p(c, ox + 6, 6, '#8a6a7a'); p(c, ox + 9, 6, '#8a6a7a'); } }],
  // Mandy: gefärbte Haare, verwaschene Jacke
  ps_mandy: [{ skin: '#e0b898', hair: '#b04a6a', coat: '#7a3a5a', coat2: '#5a2a42', pants: '#2a2a3a', shoes: '#4a3a2a', longHair: true }],
  // Pfand-Günther: Schiebermütze, grauer Bart, beiger Parka
  ps_guenther: [{ skin: '#e8c0a0', hair: '#c8c8c8', coat: '#8a7a50', coat2: '#6a5a38', pants: '#4a4a4a', shoes: '#2a2a2a', hat: '#4a5a40', hat2: '#3a4a30', beard: '#d0d0d0' }],
  // Oma Hildegard: weiße Dauerwelle, lila Mantel, Rock
  ps_hildegard: [{ skin: '#f0d0b8', hair: '#e8e8f0', coat: '#7a5a8a', coat2: '#5a3e6a', pants: '#c8b0a0', shoes: '#2a1a1a', skirt: '#5a4a5a', lips: '#c06070' },
    (c, ox, d) => { if (d !== 1) r(c, ox + 4, 0, 8, 2, '#e8e8f0'); }],
  // Hipster-Jannik: Mütze, Vollbart, senfgelbe Jacke, helle Sneaker
  ps_jannik: [{ skin: '#f0c8a8', hair: '#8a5a2a', coat: '#c8a060', coat2: '#a8803a', pants: '#2a3a5a', shoes: '#f0f0f0', hat: '#3a3a3a', hat2: '#2a2a2a', beard: '#7a4a20' }],
  // Paket-Paule: braune Uniform mit Kappe
  ps_paule: [{ skin: '#c89070', hair: '#2a1a10', coat: '#7a5a30', coat2: '#5a4020', pants: '#6a4a2a', shoes: '#1a1a1a', hat: '#7a5a30', hat2: '#5a4020' }],
  // Junggesellen-Dennis: weißes Hasenkostüm, rosa Wangen, Hasenohren
  ps_dennis: [{ skin: '#f4c8b0', hair: '#e8d070', coat: '#f4f0f0', coat2: '#d8d0d0', pants: '#f4f0f0', shoes: '#f0a0b0', blush: '#f09090' },
    (c, ox, d) => {
      for (const ex of [5, 9]) { r(c, ox + ex, 0, 2, 3, '#f4f0f0'); if (d !== 1) p(c, ox + ex + (ex === 5 ? 1 : 0), 1, '#f0a0b0'); }
      if (d === 0) { p(c, ox + 7, 6, '#f0a0b0'); p(c, ox + 8, 6, '#f0a0b0'); }
    }],
  // Fitness-Fabian: Neon-Shirt, schwarze Tights, pinkes Stirnband
  ps_fabian: [{ skin: '#f0c8a8', hair: '#3a2a1a', coat: '#40f070', coat2: '#20c050', pants: '#202020', shoes: '#ff5ac8' },
    (c, ox, d) => { r(c, ox + 4, 2, 8, 1, '#ff5ac8'); if (d === 2) r(c, ox + 3, 3, 1, 2, '#ff5ac8'); }],
  // Jacqueline: blondierte lange Haare, rosa Jogginganzug
  ps_jacqueline: [{ skin: '#f0c0a0', hair: '#e8c860', coat: '#ff8ac8', coat2: '#e070a8', pants: '#ff8ac8', shoes: '#f4f4f4', longHair: true, lips: '#d0306a' }],
  // Prediger Bernd: zerschlissener Mantel, grauer Bart, Hemd und Krawatte
  ps_bernd: [{ skin: '#e8c0a0', hair: '#7a6a5a', coat: '#3a3a2a', coat2: '#2a2a1e', pants: '#3a3a3a', shoes: '#2a1a10', shirt: '#f0f0e8', tie: '#8a2a2a', beard: '#8a7a6a' }],
  // Polizistin Petra: Uniform, roter Dutt
  ps_petra: [{ skin: '#f0c8a8', hair: '#b0502a', coat: '#1e3a8a', coat2: '#16306e', pants: '#1a2440', shoes: '#0a0a0a', hat: '#14244a', hat2: '#0a1430', shirt: '#9ab0e0', lips: '#a03040' },
    (c, ox, d) => { if (d === 1) blob(c, ox + 8, 3, 2.2, 1.8, '#b0502a'); else if (d === 2) blob(c, ox + 4, 4, 1.6, 1.6, '#b0502a'); }],
  // Polizeianwärter Kai: etwas hellere Uniform, rote Wangen, zu große Mütze
  ps_kai: [{ skin: '#f4d0b8', hair: '#c8a060', coat: '#3a5aaa', coat2: '#2a4a8a', pants: '#1a2a4a', shoes: '#0a0a0a', hat: '#1e2e5a', hat2: '#121e40', shirt: '#b0c4ea', blush: '#f0a0a0' }],
  // Desirée: Pelzmantel, schwarze Sonnenbrille, dunkle lange Haare
  dame2: [{ skin: '#e8b898', hair: '#2a1410', coat: '#c8a080', coat2: '#a8805a', pants: '#e8b898', shoes: '#101010', longHair: true, lips: '#a0102a', skirt: '#1a1010', boots: true },
    (c, ox, d) => { if (d === 0) r(c, ox + 5, 4, 6, 2, '#101010'); else if (d === 2) r(c, ox + 8, 4, 3, 2, '#101010'); }],
  // Roxy: türkise Haare, pinke Jacke, Plateaustiefel
  dame3: [{ skin: '#f0c8a8', hair: '#40d0e0', coat: '#ff40a0', coat2: '#d02a80', pants: '#f0c8a8', shoes: '#f4f4f4', longHair: true, lips: '#ff2a6a', skirt: '#202020', fishnet: true, boots: true }],
};

const DAMEN_BUESTEN: Record<string, BustLook> = {
  nbust_dame2: { skin: '#e8b898', hair: '#2a1410', style: 'long', outfit: 'jacket', top: '#c8a080', top2: '#a8805a', accent: '#1a1010', lips: '#a0102a', earrings: '#f0d040', glasses: true },
  nbust_dame3: { skin: '#f0c8a8', hair: '#40d0e0', style: 'long', outfit: 'jacket', top: '#ff40a0', top2: '#d02a80', accent: '#202020', lips: '#ff2a6a', earrings: '#e8e8f0' },
};

function sheet(scene: Phaser.Scene, key: string, pal: Pal, extra?: Extra) {
  const t = tex2x(scene, key, 16 * 9, 20, (c) => {
    for (let d = 0; d < 3; d++) for (let s = 0; s < 3; s++) {
      drawHuman(c, (d * 3 + s) * 16, d, s, pal);
      extra?.(c, (d * 3 + s) * 16, d, s);
    }
  }, { detail: (c) => { strands(c, pal.hair); strands(c, pal.beard); folds(c, pal.coat); eyeShine(c, ['#1a1212']); } });
  for (let i = 0; i < 9; i++) t.add(i, 0, i * 32, 0, 32, 40);
  const a = scene.anims;
  a.create({ key: `${key}_down`, frames: [1, 0, 2, 0].map((f) => ({ key, frame: f })), frameRate: 8, repeat: -1 });
  a.create({ key: `${key}_up`, frames: [4, 3, 5, 3].map((f) => ({ key, frame: f })), frameRate: 8, repeat: -1 });
  a.create({ key: `${key}_side`, frames: [7, 6, 8, 6].map((f) => ({ key, frame: f })), frameRate: 8, repeat: -1 });
}

export function makePassantenTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('ps_ronny')) return;
  for (const [key, [pal, extra]] of Object.entries(PALS)) sheet(scene, key, pal, extra);
  for (const [key, look] of Object.entries(DAMEN_BUESTEN)) bust(scene, key, look, 'smug');

  const make = (key: string, w: number, h: number, draw: (c: Ctx) => void) => tex2x(scene, key, w, h, draw);
  // Rollator: Rohrgestell, Körbchen, Räder (Seitenansicht, Griffe hinten links)
  make('ps_rollator', 12, 10, (c) => {
    r(c, 1, 2, 1, 6, '#a8a8b0'); r(c, 1, 2, 3, 1, '#2a2a2a');
    r(c, 1, 5, 9, 1, '#a8a8b0'); r(c, 9, 3, 1, 5, '#a8a8b0');
    r(c, 4, 3, 5, 2, '#6a3a3a'); r(c, 4, 3, 5, 1, '#8a4a4a');
    for (const x of [2, 9]) { blob(c, x, 8.5, 1.4, 1.4, '#2a2a2a'); p(c, x, 8, '#6a6a6a'); }
  });
  // Einkaufswagen voller Krempel
  make('ps_wagen', 16, 12, (c) => {
    r(c, 0, 1, 2, 1, '#a8a8b0'); r(c, 1, 2, 1, 2, '#a8a8b0');
    r(c, 2, 3, 12, 6, '#a8a8b0'); r(c, 3, 4, 10, 4, '#5a5a62');
    for (let x = 4; x < 13; x += 2) r(c, x, 4, 1, 4, '#a8a8b0');
    r(c, 4, 0, 4, 4, '#c8a060'); r(c, 8, 1, 3, 3, '#3a6aa0'); blob(c, 12, 2, 2, 1.6, '#e8e8e8'); r(c, 5, 1, 1, 2, '#3a8a3a');
    for (const x of [4, 12]) { blob(c, x, 10.5, 1.3, 1.3, '#2a2a2a'); }
  });
  // Pakete: drei braune Kartons übereinander
  make('ps_pakete', 9, 10, (c) => {
    r(c, 0, 5, 9, 5, '#a8783a'); r(c, 1, 1, 7, 4, '#c08a48'); r(c, 2, 0, 5, 1, '#c08a48');
    r(c, 0, 7, 9, 1, '#d8c890'); r(c, 4, 1, 1, 4, '#d8c890'); r(c, 1, 5, 7, 1, '#7a5a2a');
  });
  // Megafon
  make('ps_megafon', 8, 6, (c) => {
    r(c, 0, 2, 2, 2, '#2a2a2a'); r(c, 2, 1, 2, 4, '#e8e8e8'); r(c, 4, 0, 3, 6, '#e8e8e8'); r(c, 7, 0, 1, 6, '#c02020'); p(c, 2, 5, '#2a2a2a');
  });
  // Coffee-to-go mit Deckel
  make('ps_becher', 4, 6, (c) => { r(c, 0, 1, 4, 5, '#f4f0e8'); r(c, 0, 0, 4, 1, '#2a2a2a'); r(c, 0, 3, 4, 1, '#8a5a2a'); });
  // Pfandtüte mit Flaschenhälsen
  make('ps_tuete', 6, 8, (c) => {
    r(c, 0, 3, 6, 5, '#e8e8e0'); r(c, 1, 2, 1, 2, '#e8e8e0'); r(c, 4, 2, 1, 2, '#e8e8e0');
    r(c, 1, 0, 1, 3, '#3a8a3a'); r(c, 3, 1, 1, 2, '#8a5a2a'); r(c, 4, 0, 1, 2, '#3a8a3a');
  });
  // Bauchladen mit Schnapsfläschchen
  make('ps_bauchladen', 12, 6, (c) => {
    r(c, 0, 3, 12, 3, '#a8783a'); r(c, 0, 3, 12, 1, '#c89a5a');
    for (let x = 1; x < 11; x += 2) { r(c, x, 0, 1, 3, x % 4 === 1 ? '#3a8a3a' : '#c8a040'); p(c, x, 0, '#e8e8e8'); }
    r(c, 2, -1, 1, 1, '#f4f0f0');
  });
  // Chihuahua Tyson: zwei Laufbilder, Glubschaugen, Stachelhalsband
  const hund = tex2x(scene, 'ps_hund', 24, 8, (c) => {
    for (let f = 0; f < 2; f++) {
      const ox = f * 12;
      r(c, ox + 2, 3, 6, 3, '#d8a868'); blob(c, ox + 9, 3, 2.5, 2.2, '#d8a868');
      r(c, ox + 8, 0, 1, 2, '#d8a868'); r(c, ox + 10, 0, 1, 2, '#d8a868');
      p(c, ox + 10, 3, '#101010'); p(c, ox + 11, 4, '#3a2a1a');
      r(c, ox + 7, 5, 2, 1, '#c02020');
      const a = f ? 1 : 0;
      r(c, ox + 2 + a, 6, 1, 2, '#c8985a'); r(c, ox + 6 - a, 6, 1, 2, '#c8985a');
      r(c, ox + 1, 2, 1, 2, '#d8a868');
    }
  });
  hund.add(0, 0, 0, 0, 24, 16);
  hund.add(1, 0, 24, 0, 24, 16);
  scene.anims.create({ key: 'ps_hund_lauf', frames: [{ key: 'ps_hund', frame: 0 }, { key: 'ps_hund', frame: 1 }], frameRate: 10, repeat: -1 });
}
