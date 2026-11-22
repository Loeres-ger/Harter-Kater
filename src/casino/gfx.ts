import Phaser from 'phaser';
import { Ctx, blob, outline, p, r, tex2x } from '../gfx';

// Pixel-Grafiken für die drei Spielautomaten: Wandgehäuse, Walzensymbole, Pferde.

const S = 16; // Symbolgröße

function sym(scene: Phaser.Scene, key: string, draw: (c: Ctx) => void) {
  tex2x(scene, key, S, S, (c) => {
    draw(c);
    outline(c, 0, 0, S, S);
  });
}

/** Kartenwert als Pixel-Schrift (10, J, Q, K, A) */
function card(scene: Phaser.Scene, key: string, label: string, col: string, dark: string) {
  tex2x(scene, key, S, S, (c) => {
    c.font = '8px "Press Start 2P"';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const x = label.length > 1 ? 8 : 8.5;
    c.fillStyle = dark;
    c.fillText(label, x + 1, 9.5);
    c.fillStyle = col;
    c.fillText(label, x, 8.5);
    outline(c, 0, 0, S, S);
  });
}

// ---------------------------------------------------------------- ALLES SAHNE (Glückssymbole, Joker, Teufel)

function sahneSymbols(scene: Phaser.Scene) {
  // leeres Feld: nur ein matter Strich
  tex2x(scene, 'as_leer', S, S, (c) => { r(c, 5, 8, 6, 1, '#5a4a3a'); });
  // Kleeblatt: vier Herzblätter, Stiel
  sym(scene, 'as_klee', (c) => {
    for (const [x, y] of [[5, 5], [10, 5], [5, 10], [10, 10]]) blob(c, x, y, 2.8, 2.8, '#2a9a3a');
    for (const [x, y] of [[5, 5], [10, 5], [5, 10], [10, 10]]) p(c, x - 1, y - 1, '#6ad06a');
    r(c, 7, 7, 2, 2, '#1a7a2a');
    for (let i = 0; i < 3; i++) p(c, 9 + i, 12 + i, '#1a6a2a');
  });
  // Glücksmünze: Goldrand, Prägung, Glanz
  sym(scene, 'as_muenze', (c) => {
    blob(c, 8, 8, 6.5, 6.5, '#b88a10'); blob(c, 8, 8, 5.5, 5.5, '#f0c030'); blob(c, 8, 8, 4, 4, '#e0b020');
    r(c, 7, 5, 2, 6, '#b88a10'); r(c, 6, 6, 4, 1, '#b88a10'); r(c, 6, 9, 4, 1, '#b88a10');
    p(c, 5, 4, '#fff4c0'); p(c, 4, 5, '#fff4c0');
  });
  // Marienkäfer: rote Flügel mit Punkten, schwarzer Kopf, Fühler
  sym(scene, 'as_kaefer', (c) => {
    blob(c, 8, 9.5, 6, 5.5, '#d02020');
    r(c, 8, 4, 1, 11, '#1a1010');
    for (const [x, y] of [[5, 8], [11, 8], [5, 12], [11, 12], [8, 10]]) blob(c, x, y, 1.2, 1.2, '#1a1010');
    blob(c, 8, 4, 3, 2, '#1a1010');
    p(c, 7, 4, '#f4f4f4'); p(c, 9, 4, '#f4f4f4');
    p(c, 6, 1, '#1a1010'); p(c, 6, 2, '#1a1010'); p(c, 10, 1, '#1a1010'); p(c, 10, 2, '#1a1010');
    p(c, 5, 7, '#ff7a6a');
  });
  // Joker: Sahnehäubchen im Glas mit Kirsche
  sym(scene, 'as_joker', (c) => {
    r(c, 4, 9, 8, 5, '#c8e8f0');
    r(c, 5, 14, 6, 1, '#a8c8d0');
    r(c, 5, 10, 6, 3, '#d88a5a');
    blob(c, 8, 7, 5, 3, '#ffffff');
    blob(c, 8, 5, 3.5, 2.5, '#f8f4ec');
    blob(c, 8, 3, 2, 1.6, '#ffffff');
    blob(c, 9, 1.5, 1.4, 1.4, '#d02030');
  });
  // Teufel: rote Fratze mit Hörnern, gelben Augen und breitem Grinsen
  sym(scene, 'as_teufel', (c) => {
    for (let i = 0; i < 4; i++) { p(c, 3 + Math.floor(i / 2), 4 - i, '#f0e0c0'); p(c, 12 - Math.floor(i / 2), 4 - i, '#f0e0c0'); }
    blob(c, 8, 9, 5.8, 5.8, '#c01818'); blob(c, 7, 8, 4, 4, '#e02a2a');
    r(c, 4, 6, 3, 1, '#2a0606'); r(c, 9, 6, 3, 1, '#2a0606');
    r(c, 5, 7, 2, 2, '#f8e040'); r(c, 9, 7, 2, 2, '#f8e040'); p(c, 6, 8, '#1a0606'); p(c, 9, 8, '#1a0606');
    r(c, 4, 11, 8, 2, '#2a0606'); for (let x = 5; x < 12; x += 2) p(c, x, 11, '#f4f0e0');
    p(c, 3, 10, '#2a0606'); p(c, 12, 10, '#2a0606');
    r(c, 7, 14, 2, 2, '#7a0a0a'); // Spitzbart
  });
}

// ---------------------------------------------------------------- BUCH DER RATTE

function ratteSymbols(scene: Phaser.Scene) {
  card(scene, 'br_10', '10', '#6ab0ff', '#1a3a6a');
  card(scene, 'br_j', 'J', '#9ae060', '#2a5a1a');
  card(scene, 'br_q', 'Q', '#ff8ad0', '#6a1a4a');
  card(scene, 'br_k', 'K', '#ffb040', '#6a3a0a');
  card(scene, 'br_a', 'A', '#ff5a4a', '#6a1010');
  sym(scene, 'br_kaese', (c) => {
    for (let y = 0; y < 9; y++) r(c, 2, 5 + y, 3 + Math.floor(y * 1.2), 1, '#f8d040');
    r(c, 2, 13, 12, 2, '#e8b820');
    blob(c, 6, 10, 1.2, 1.2, '#c89a10');
    blob(c, 10, 12, 1, 1, '#c89a10');
    r(c, 2, 5, 1, 9, '#fff0a0');
  });
  sym(scene, 'br_tonne', (c) => {
    r(c, 3, 5, 10, 10, '#6a6e74');
    r(c, 2, 3, 12, 3, '#8a8e94');
    for (let x = 5; x < 12; x += 3) r(c, x, 7, 1, 7, '#55595e');
    p(c, 6, 2, '#c0a040'); p(c, 9, 1, '#9ad040'); p(c, 10, 2, '#a04040');
  });
  sym(scene, 'br_ratte', (c) => {
    blob(c, 7, 10, 5, 3.5, '#7a6a62');
    blob(c, 12, 8, 3, 2.5, '#7a6a62');
    p(c, 15, 8, '#f0a0a0');
    blob(c, 11, 5.5, 1.5, 1.5, '#d0a0a0');
    p(c, 13, 7, '#ff3020');
    for (let i = 0; i < 5; i++) p(c, 1 + i, 12 + Math.floor(i / 3), '#c08a8a');
    r(c, 5, 13, 1, 2, '#5a4a42'); r(c, 10, 13, 1, 2, '#5a4a42');
  });
  // Top-Symbol: Rattenkönig mit Krone
  sym(scene, 'br_koenig', (c) => {
    blob(c, 8, 10, 6, 4.5, '#5a4a42');
    blob(c, 8, 7, 4, 3.5, '#6a5a52');
    p(c, 6, 6, '#ff3020'); p(c, 10, 6, '#ff3020');
    p(c, 8, 9, '#f0a0a0');
    r(c, 4, 1, 8, 3, '#f0c030');
    p(c, 4, 0, '#f0c030'); p(c, 8, 0, '#f0c030'); p(c, 11, 0, '#f0c030');
    p(c, 6, 2, '#c02030'); p(c, 9, 2, '#3060c0');
  });
  // Buch: Joker + Scatter
  sym(scene, 'br_buch', (c) => {
    r(c, 2, 2, 12, 13, '#6a1a1a');
    r(c, 3, 3, 10, 11, '#8a2a20');
    r(c, 12, 3, 1, 11, '#e8dcc0');
    r(c, 4, 4, 8, 9, '#c8a040');
    r(c, 5, 5, 6, 7, '#8a2a20');
    blob(c, 8, 8, 2, 2, '#f0c030');
    p(c, 8, 8, '#6a1a1a');
    r(c, 2, 14, 12, 1, '#3a0a0a');
  });
}

// ---------------------------------------------------------------- KLEPPER-DERBY

export const JOCKEY_COLORS = ['#e02828', '#2860e0', '#f0c030', '#30a040', '#a040c0', '#f08020'];

function horses(scene: Phaser.Scene) {
  JOCKEY_COLORS.forEach((jc, i) => {
    const t = tex2x(scene, `horse${i}`, 48, 20, (c) => {
      for (let f = 0; f < 2; f++) {
        const o = f * 24;
        const coat = ['#7a4a2a', '#3a2a1a', '#a87a4a', '#5a3a2a', '#e8e0d0', '#2a2018'][i];
        // Körper + Hals + Kopf
        r(c, o + 5, 8, 13, 6, coat);
        r(c, o + 16, 4, 3, 6, coat);
        r(c, o + 17, 2, 6, 4, coat);
        p(c, o + 22, 4, '#1a1010');
        p(c, o + 20, 3, '#0a0a0a');
        r(c, o + 15, 3, 2, 5, '#2a1a10'); // Mähne
        // Schweif
        r(c, o + 2, 8, 3, 2, '#2a1a10');
        r(c, o + 1, 10, 2, 3, '#2a1a10');
        // Beine (Galopp)
        const legs = f === 0 ? [[6, 14, -2], [9, 14, 1], [14, 14, -1], [16, 14, 2]] : [[6, 14, 2], [9, 14, -1], [14, 14, 1], [16, 14, -2]];
        for (const [lx, ly, dx] of legs) {
          r(c, o + lx, ly, 1, 3, coat);
          p(c, o + lx + dx, ly + 3, coat);
          p(c, o + lx + dx, ly + 4, '#1a1010');
        }
        // Jockey
        r(c, o + 10, 3, 4, 5, jc);
        r(c, o + 11, 0, 3, 3, '#f0c090');
        r(c, o + 11, 0, 3, 1, jc);
        r(c, o + 13, 5, 3, 1, jc);
        outline(c, o, 0, 24, 20);
      }
    });
    t.add(0, 0, 0, 0, 48, 40);
    t.add(1, 0, 48, 0, 48, 40);
    scene.anims.create({ key: `horse${i}_run`, frames: [{ key: `horse${i}`, frame: 0 }, { key: `horse${i}`, frame: 1 }], frameRate: 10, repeat: -1 });
  });
}

// ---------------------------------------------------------------- Wandgehäuse in der Bar (16x16, wie Wandkacheln)

function cabinet(scene: Phaser.Scene, key: string, body: string, trim: string, screen: (c: Ctx) => void) {
  tex2x(scene, key, 16, 16, (c) => {
    r(c, 0, 0, 16, 16, '#4a2c2c'); // Ziegelwand dahinter
    r(c, 0, 0, 16, 2, '#1f1616');
    r(c, 1, 1, 14, 15, body);
    r(c, 1, 1, 14, 2, trim);
    r(c, 3, 4, 10, 6, '#0a0a14');
    screen(c);
    r(c, 3, 11, 10, 2, '#1a1414');
    p(c, 4, 12, '#40ff40'); p(c, 7, 12, '#ff4040'); p(c, 10, 12, '#f0d040');
    r(c, 2, 14, 12, 2, trim);
  });
}

export function makeCasinoTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('as_klee')) return;
  sahneSymbols(scene);
  ratteSymbols(scene);
  horses(scene);
  cabinet(scene, 'cab_sahne', '#a01828', '#f0c030', (c) => {
    p(c, 5, 6, '#d02030'); p(c, 8, 6, '#f0d830'); p(c, 11, 6, '#d02030');
    r(c, 4, 8, 8, 1, '#f0c030');
  });
  cabinet(scene, 'cab_ratte', '#1a2a5a', '#c8a040', (c) => {
    r(c, 6, 5, 4, 4, '#8a2a20');
    p(c, 8, 7, '#f0c030');
  });
  cabinet(scene, 'cab_derby', '#1a5a2a', '#e8e0c0', (c) => {
    r(c, 3, 8, 10, 2, '#3a8a3a');
    r(c, 5, 6, 3, 2, '#7a4a2a');
    r(c, 9, 7, 3, 1, '#e8e0d0');
  });
}
