import Phaser from 'phaser';
import { Ctx, Pal, blob, drawHuman, eyeShine, folds, p, r, rng, sideLight, strands, tex, tex2x } from '../gfx';
import { Mood, drawBust } from '../guests/gfx';
import type { BustLook } from '../guests/data';

// Grafiken für den „Masala Basar“: Safranwände mit gemaltem Rand, Gewürzregale, Gewürzkegel, Reissäcke,
// Kühlschrank mit Lassi, Theke mit Chai-Kanne. Dazu Adshayan (Figur und Brustbilder), die Curry-Flecken
// und der Schwamm fürs Putz-Minispiel, die Kulisse für Gespräche und die Inventar-Symbole.

const T = 16;

function speckle(c: Ctx, cols: string[], n: number, seed: number, w = T, h = T, x0 = 0, y0 = 0) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) p(c, x0 + Math.floor(rnd() * w), y0 + Math.floor(rnd() * h), cols[Math.floor(rnd() * cols.length)]);
}

const ADSHAYAN_PAL: Pal = { skin: '#6a4028', hair: '#120c0a', coat: '#e09a1a', coat2: '#b87a10', pants: '#ece4d2', shoes: '#3a2414', shirt: '#f4e8c8' };
const ADSHAYAN: BustLook = { skin: '#6a4028', hair: '#120c0a', style: 'short', outfit: 'shirt', top: '#e09a1a', top2: '#b87a10', accent: '#f4e8c8' };
/** Vollbart: etwas wärmer als das Kopfhaar, damit die Strähnen-Details ihn eigens erfassen */
const BART = '#1e140e';

/** Adshayan als Figur (16×20 je Bild): die normale Figur, darüber runder Bauch, Pausbacken und Vollbart.
 *  Die Konturen setzt tex2x erst am Ende, sie umschließen also auch Bauch und Bart. */
function adshayanSheet(scene: Phaser.Scene) {
  const P = ADSHAYAN_PAL;
  const t = tex2x(scene, 'adshayan', 16 * 9, 20, (c) => {
    for (let d = 0; d < 3; d++) for (let s = 0; s < 3; s++) {
      const ox = (d * 3 + s) * 16, sw = s === 1 ? 1 : s === 2 ? -1 : 0;
      drawHuman(c, ox, d, s, P);
      if (d === 2) {
        // seitlich: Bauch wölbt sich nach vorne, Arm davor, Bart steht übers Kinn hinaus
        blob(c, ox + 9, 12.5, 4, 3.4, P.coat); r(c, ox + 5, 9, 4, 7, P.coat);
        r(c, ox + 6, 13, 2, 3, P.coat2);
        r(c, ox + 7 + sw, 10, 2, 4, P.coat2); r(c, ox + 7 + sw, 14, 2, 1, P.skin);
        r(c, ox + 8, 6, 4, 3, BART); r(c, ox + 12, 6, 1, 3, BART); r(c, ox + 7, 8, 5, 2, BART);
        p(c, ox + 11, 7, '#9a5a4a');
      } else {
        // vorne/hinten: breiter, runder Bauch, die Arme hängen außen daran
        blob(c, ox + 8, 12.5, 5.2, 3.6, P.coat); r(c, ox + 3, 10, 10, 5, P.coat);
        r(c, ox + 11, 10, 2, 6, P.coat2);
        r(c, ox + 2, 10 + sw, 1, 4, P.coat2); p(c, ox + 2, 14 + sw, P.skin);
        r(c, ox + 13, 10 - sw, 1, 4, P.coat2); p(c, ox + 13, 14 - sw, P.skin);
        if (d === 0) {
          r(c, ox + 7, 10, 2, 4, P.shirt!); // Knopfleiste der Kurta
          // Pausbacken und Vollbart vom Ohr bis auf die Brust, kleiner Mund darin
          r(c, ox + 3, 4, 1, 4, P.skin); r(c, ox + 12, 4, 1, 4, P.skin);
          r(c, ox + 3, 5, 1, 4, BART); r(c, ox + 12, 5, 1, 4, BART);
          r(c, ox + 4, 6, 1, 3, BART); r(c, ox + 11, 6, 1, 3, BART);
          r(c, ox + 4, 7, 8, 3, BART); r(c, ox + 6, 6, 4, 1, BART);
          r(c, ox + 7, 7, 2, 1, '#9a5a4a');
        } else {
          r(c, ox + 3, 4, 1, 4, P.hair); r(c, ox + 12, 4, 1, 4, P.hair);
        }
      }
    }
  }, { detail: (c) => { strands(c, P.hair); strands(c, BART); folds(c, P.coat); eyeShine(c, ['#1a1212']); } });
  for (let i = 0; i < 9; i++) t.add(i, 0, i * 32, 0, 32, 40);
}

/** Brustbild 64×96: normales Brustbild, darüber runder Bauch, volle Wangen und ein dichter Vollbart mit Schnauzer */
function adshayanBust(scene: Phaser.Scene, key: string, mood: Mood) {
  const L = ADSHAYAN, cx = 32;
  const ell = (x: number, y: number, ex: number, ey: number, rx: number, ry: number) => ((x - ex) / rx) ** 2 + ((y - ey) / ry) ** 2 <= 1;
  tex2x(scene, key, 64, 96, (c) => {
    drawBust(c, L, mood);
    // runder Bauch unter der Kurta, rechts im Schatten, Knopfleiste mit Messingknöpfen
    for (let y = 58; y < 96; y++) for (let x = 0; x < 64; x++) {
      if (!ell(x, y, cx, 88, 31, 27)) continue;
      p(c, x, y, ell(x, y, cx - 6, 86, 26, 26) ? L.top : L.top2);
    }
    r(c, cx - 2, 50, 4, 30, L.accent);
    for (const y of [56, 63, 70, 77]) p(c, cx, y, '#c8a040');
    r(c, cx - 22, 70, 7, 1, L.top2); r(c, cx + 14, 72, 7, 1, '#8a5a08');
    // Pausbacken
    blob(c, cx - 12, 33, 4, 6, L.skin); blob(c, cx + 12, 33, 4, 6, L.skin);
    // Vollbart: von den Ohren bis auf die Brust, Gesicht (Augen, Nase) und Mund bleiben frei
    for (let y = 22; y < 56; y++) for (let x = cx - 17; x <= cx + 17; x++) {
      if (!ell(x, y, cx, 40, 15.5, 14.5) || ell(x, y, cx, 27, 9.5, 8.6)) continue;
      if (Math.abs(x - cx) <= 3 && y >= 36 && y <= 38) continue;
      p(c, x, y, BART);
    }
    // Schnauzer über dem Mund, an den Enden etwas hängend
    r(c, cx - 7, 33, 14, 3, BART); p(c, cx - 7, 36, BART); p(c, cx + 6, 36, BART);
    // Mund im Bart
    if (mood === 'happy') { r(c, cx - 3, 36, 6, 2, '#5a1a1a'); r(c, cx - 2, 36, 4, 1, '#f4f0e0'); }
    else if (mood === 'sad') { r(c, cx - 3, 37, 6, 1, '#4a1a14'); p(c, cx - 3, 38, '#4a1a14'); p(c, cx + 2, 38, '#4a1a14'); }
    else r(c, cx - 2, 37, 4, 1, '#5a2a1a');
  }, {
    detail: (c) => { strands(c, L.hair); strands(c, BART); folds(c, L.top); eyeShine(c, ['#1c120a']); sideLight(c); },
  });
}

/** Gewürzfarben: Chili, Kurkuma, Kardamom, Kreuzkümmel, Paprika */
const GEWUERZ = ['#c8301e', '#f0b020', '#6a9a2a', '#8a5a2a', '#e0602a'];

function wand(c: Ctx, seed: number) {
  // Safranwand, oben ein gemalter Zackenrand, unten ein Holzpaneel
  r(c, 0, 0, T, 11, '#d0702a');
  speckle(c, ['#c0641e', '#da7c34'], 10, seed, T, 11);
  r(c, 0, 0, T, 2, '#7a1a3a');
  for (let x = 0; x < T; x += 4) { p(c, x + 1, 2, '#7a1a3a'); p(c, x + 2, 2, '#7a1a3a'); p(c, x + 1, 3, '#7a1a3a'); p(c, x + 2, 1, '#f0c040'); }
  r(c, 0, 11, T, 1, '#f0c040');
  r(c, 0, 12, T, 4, '#5a2a18'); r(c, 0, 12, T, 1, '#7a3e22');
}

function fleck(c: Ctx, seed: number) {
  // Curry auf Fliesen: unregelmäßige Lache, dunkler Rand, Stückchen (Erbsen, Karotte, Reis), Glanzpunkt
  const rnd = rng(seed);
  const parts: [number, number, number][] = [[24, 24, 15]];
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2, d = 7 + rnd() * 9;
    parts.push([24 + Math.cos(a) * d, 24 + Math.sin(a) * d * 0.85, 4 + rnd() * 6]);
  }
  for (const [x, y, s] of parts) blob(c, x, y, s + 1.5, s * 0.85 + 1.5, '#9a5a0a');
  for (const [x, y, s] of parts) blob(c, x, y, s, s * 0.85, '#d8901a');
  for (const [x, y, s] of parts) blob(c, x - 1, y - 1, s * 0.6, s * 0.5, '#e8a82a');
  for (let i = 0; i < 4; i++) blob(c, 6 + rnd() * 36, 6 + rnd() * 36, 1.4, 1.2, '#d8901a'); // Spritzer
  for (let i = 0; i < 9; i++) {
    const x = 14 + Math.floor(rnd() * 20), y = 14 + Math.floor(rnd() * 20);
    const col = ['#5a9a2a', '#e8602a', '#f4f0e0'][i % 3];
    r(c, x, y, 2, 2, col);
  }
  blob(c, 19, 18, 3, 1.5, '#f8d070'); p(c, 18, 17, '#fff4c0');
}

function drawBackdrop(c: Ctx) {
  const rnd = rng(2024);
  r(c, 0, 0, 480, 270, '#2a140c');
  // Safranwand mit Zackenrand
  r(c, 0, 0, 480, 170, '#d0702a');
  for (let i = 0; i < 900; i++) p(c, Math.floor(rnd() * 480), Math.floor(rnd() * 170), rnd() < 0.5 ? '#c0641e' : '#da7c34');
  r(c, 0, 0, 480, 10, '#7a1a3a');
  for (let x = 0; x < 480; x += 16) { for (let i = 0; i < 6; i++) r(c, x + i, 10 + i, 16 - i * 2, 1, '#7a1a3a'); r(c, x + 7, 4, 2, 2, '#f0c040'); }
  // Gewürzregale links und rechts
  for (const x0 of [16, 330]) {
    for (let s = 0; s < 3; s++) {
      const y = 40 + s * 40;
      r(c, x0, y + 30, 134, 4, '#5a2a18'); r(c, x0, y + 30, 134, 1, '#8a4a28');
      for (let j = 0; j < 8; j++) {
        const jx = x0 + 6 + j * 16, col = GEWUERZ[(j + s) % GEWUERZ.length];
        r(c, jx, y + 12, 11, 18, '#e8e0d0'); r(c, jx + 1, y + 16, 9, 13, col); r(c, jx, y + 9, 11, 4, '#b8302a'); r(c, jx + 2, y + 20, 6, 4, '#f4ecd8');
      }
    }
  }
  // Filmplakat in der Mitte
  r(c, 190, 26, 100, 128, '#f0c040'); r(c, 194, 30, 92, 120, '#a01a5a');
  blob(c, 240, 70, 40, 30, '#e0507a');
  blob(c, 226, 82, 9, 10, '#5a3020'); r(c, 219, 92, 15, 34, '#2a5aa0'); // Held
  blob(c, 254, 80, 9, 10, '#7a4028'); r(c, 247, 90, 15, 36, '#f0c040'); r(c, 244, 104, 21, 22, '#d02a4a'); // Heldin
  for (let i = 0; i < 18; i++) p(c, 200 + Math.floor(rnd() * 80), 36 + Math.floor(rnd() * 30), '#fff0a0');
  r(c, 202, 132, 76, 5, '#fff0a0'); r(c, 212, 141, 56, 3, '#f0c040');
  // Lichterkette
  for (let x = 0; x < 480; x += 12) {
    const y = 18 + Math.round(Math.sin(x / 40) * 4);
    p(c, x, y - 1, '#3a2a1a');
    blob(c, x, y + 2, 2, 2, ['#ff5a5a', '#ffd040', '#5ad0ff', '#7aff7a'][(x / 12) % 4]);
  }
  // Theke mit Chai-Kanne und Curry-Schalen
  r(c, 0, 170, 480, 100, '#5a2a18'); r(c, 0, 170, 480, 4, '#f0c040');
  for (let x = 0; x < 480; x += 40) { r(c, x + 4, 186, 32, 70, '#6a3420'); r(c, x + 8, 190, 24, 62, '#4a2010'); blob(c, x + 20, 220, 6, 6, '#f0c040'); blob(c, x + 20, 220, 3, 3, '#a01a5a'); }
  blob(c, 110, 160, 16, 12, '#c8a040'); r(c, 98, 146, 24, 6, '#c8a040'); r(c, 122, 154, 14, 3, '#c8a040'); blob(c, 110, 144, 5, 3, '#e8c860');
  for (let i = 0; i < 4; i++) { const sx = 350 + i * 24; blob(c, sx, 164, 10, 5, '#c8a040'); blob(c, sx, 161, 9, 3, '#e0801a'); blob(c, sx - 3, 160, 3, 1.5, '#f4f0e0'); }
}

export function makeBasarTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('basarFloor')) return;
  const make = (key: string, draw: (c: Ctx) => void, w = T, h = T) => tex2x(scene, key, w, h, draw);

  make('basarFloor', (c) => {
    // helle Terrazzo-Fliesen mit kleiner Blüte in der Mitte
    r(c, 0, 0, T, T, '#e4d0a8');
    speckle(c, ['#d4bc90', '#ecdcb8', '#c8a878'], 18, 2101);
    r(c, 0, 0, T, 1, '#b8986a'); r(c, 0, 0, 1, T, '#b8986a');
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) p(c, 8 + dx, 8 + dy, '#c8402a');
    p(c, 8, 8, '#f0b020');
  });
  make('basarWallFront', (c) => wand(c, 2102));
  make('basarWallTop', (c) => { r(c, 0, 0, T, T, '#2a140c'); speckle(c, ['#3a1c10'], 8, 2103); });
  make('basarShelf', (c) => {
    wand(c, 2104);
    // Regalbrett mit Gewürzgläsern
    r(c, 0, 10, T, 1, '#5a2a18');
    for (let j = 0; j < 3; j++) {
      const x = 1 + j * 5;
      r(c, x, 4, 4, 6, '#ece4d4'); r(c, x, 6, 4, 4, GEWUERZ[(j * 2) % GEWUERZ.length]); r(c, x, 3, 4, 1, '#b8302a');
    }
  });
  make('basarPoster', (c) => {
    wand(c, 2105);
    // Filmplakat: Goldrahmen, Held und Heldin vor einem Wasserfall
    r(c, 3, 1, 10, 11, '#f0c040'); r(c, 4, 2, 8, 9, '#a01a5a');
    r(c, 7, 2, 2, 6, '#7ac8f0');
    p(c, 5, 4, '#5a3020'); r(c, 5, 5, 1, 4, '#2a5aa0');
    p(c, 10, 4, '#7a4028'); r(c, 10, 5, 1, 4, '#d02a4a');
    r(c, 5, 9, 6, 1, '#fff0a0');
  });
  make('basarFridge', (c) => {
    // Glastür-Kühlschrank voller Mango-Lassi
    r(c, 1, 0, 14, 16, '#d8dce0'); r(c, 1, 0, 14, 1, '#f4f6f8');
    r(c, 2, 2, 12, 12, '#9ad0e0');
    for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) { r(c, 3 + x * 3, 3 + y * 4, 2, 3, '#f0a030'); p(c, 3 + x * 3, 3 + y * 4, '#f8e0b0'); }
    r(c, 13, 6, 1, 4, '#8a9098');
  });
  const theke = (variante: number) => (c: Ctx) => {
    r(c, 0, 0, T, 8, '#7a3a1e'); r(c, 0, 0, T, 1, '#9a5a2e');
    if (variante === 0) {
      // Messing-Chaikanne und Glas
      blob(c, 6, 4, 3.5, 2.6, '#c8a040'); r(c, 9, 3, 3, 1, '#c8a040'); p(c, 6, 1, '#e8c860');
      r(c, 12, 3, 2, 3, '#c8803a'); p(c, 12, 3, '#f0e0c0');
    } else {
      // großer Curry-Topf mit Kelle, es dampft
      r(c, 3, 2, 10, 5, '#8a8a92'); r(c, 3, 2, 10, 1, '#b8b8c0'); r(c, 2, 3, 1, 2, '#6a6a72'); r(c, 13, 3, 1, 2, '#6a6a72');
      r(c, 4, 2, 8, 1, '#e0801a'); p(c, 6, 2, '#f4f0e0'); p(c, 9, 2, '#5a9a2a');
      r(c, 10, 0, 1, 3, '#5a3a22');
      p(c, 5, 0, '#ffffff80'); p(c, 7, 1, '#ffffff60');
    }
    r(c, 0, 8, T, 8, '#5a2a18'); r(c, 0, 8, T, 1, '#f0c040');
    blob(c, 8, 12, 2.5, 2.5, '#f0c040'); blob(c, 8, 12, 1.2, 1.2, '#a01a5a');
  };
  make('basarCounter0', theke(0));
  make('basarCounter1', theke(1));
  make('basarSacks', (c) => {
    // Jutesäcke mit Basmati und roten Linsen
    for (const [x, col] of [[1, '#f4f0e4'], [8, '#e0602a']] as const) {
      r(c, x, 5, 7, 10, '#b8925a'); r(c, x, 14, 7, 1, '#7a5a30');
      for (let y = 6; y < 14; y += 2) r(c, x + 1, y, 5, 1, '#a8824a');
      blob(c, x + 3.5, 5, 3.5, 1.6, col); speckle(c, [col], 4, 2106 + x, 6, 2, x + 1, 4);
    }
  });
  make('basarSpice', (c) => {
    // offene Schalen mit Gewürzkegeln
    for (const [x, col] of [[1, GEWUERZ[0]], [8, GEWUERZ[1]]] as const) {
      r(c, x, 11, 7, 3, '#8a4a28'); r(c, x, 11, 7, 1, '#b8703a');
      for (let y = 0; y < 7; y++) r(c, x + 3 - Math.floor(y / 2), 4 + y, 1 + Math.floor(y / 2) * 2, 1, col);
      p(c, x + 3, 4, '#ffffff80');
    }
    r(c, 4, 14, 8, 1, '#4a2410');
  });
  make('basarDoor', (c) => {
    r(c, 0, 0, T, T, '#2a140c');
    r(c, 3, 1, 10, 15, '#f0c040'); r(c, 4, 2, 8, 14, '#7a1a3a');
    r(c, 5, 3, 6, 5, '#ffd070'); // Fenster mit Licht
    for (let x = 4; x < 12; x += 2) p(c, x, 1, '#f0c040'); // Glöckchen
    r(c, 10, 10, 1, 2, '#f0c040');
  });

  // Curry-Flecken (drei Formen) und der Schwamm
  for (let i = 0; i < 3; i++) tex(scene, `basarFleck${i}`, 48, 48, (c) => fleck(c, 2110 + i * 7));
  tex(scene, 'basarSchwamm', 22, 16, (c) => {
    r(c, 1, 1, 20, 9, '#f0d040'); r(c, 1, 1, 20, 1, '#f8e880');
    speckle(c, ['#d8b830', '#c8a820'], 14, 2120, 20, 9, 1, 1);
    r(c, 1, 10, 20, 5, '#3a9a4a'); r(c, 1, 14, 20, 1, '#2a6a32');
  });

  // Inventar-Symbole: Curry mit Reis, Mango-Lassi
  make('icon_curry', (c) => {
    // Schale mit Reis links und Curry rechts, ein bisschen Dampf
    blob(c, 8, 10, 7, 4, '#c8a040'); r(c, 2, 9, 13, 1, '#e8c860');
    blob(c, 5.5, 8.5, 3.5, 2, '#f4f0e0'); p(c, 4, 8, '#ffffff');
    blob(c, 10.5, 8.5, 4, 2, '#e0801a'); p(c, 10, 8, '#5a9a2a'); p(c, 12, 9, '#f0a040'); p(c, 9, 9, '#c86010');
    r(c, 5, 13, 6, 1, '#8a6a20');
    p(c, 7, 3, '#ffffff90'); p(c, 8, 2, '#ffffff70'); p(c, 10, 4, '#ffffff80');
  });
  make('icon_lassi', (c) => {
    r(c, 4, 4, 8, 11, '#e8f4f8'); r(c, 5, 6, 6, 8, '#f0a030'); r(c, 5, 6, 6, 1, '#f8d090');
    r(c, 4, 14, 8, 1, '#b8c8d0');
    for (let i = 0; i < 5; i++) p(c, 10 + Math.floor(i / 2), 4 - i, '#d02a4a'); // Strohhalm
  });

  // Adshayan
  adshayanSheet(scene);
  adshayanBust(scene, 'nbust_adshayan', 'happy');
  adshayanBust(scene, 'nbust_adshayanSad', 'sad');

  tex(scene, 'csBasar', 480, 270, drawBackdrop);
}
