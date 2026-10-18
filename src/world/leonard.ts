import Phaser from 'phaser';
import { Ctx, blob, eyeShine, folds, outline, p, r, sideLight, tex2x } from '../gfx';

// Der kräftige Leonard: 1,38 m, fast genauso breit, Tanktop zwei Nummern zu klein.
// Dazu der Wirt nach den roten Pillen.

const SK = '#c8865a', SKD = '#a06640', SKH = '#e8aa7c';
const TANK = '#f4f2ea', TANKD = '#cfcac0';
const HAIR = '#2a1a10', SHADES = '#101018', GOLD = '#f0d040';
const BW = 64, BH = 96;

/** Draufsicht, 20×16 je Bild: 0 = lässig, 1 = Doppelbizeps */
function drawLeonard(c: Ctx, ox: number, flex: boolean) {
  const cx = ox + 10;
  // Stummelbeine
  r(c, cx - 4, 13, 3, 2, '#3a4a6a'); r(c, cx + 1, 13, 3, 2, '#3a4a6a');
  r(c, cx - 5, 15, 4, 1, '#181818'); r(c, cx + 1, 15, 4, 1, '#181818');
  r(c, cx - 4, 11, 8, 2, '#3a4a6a'); r(c, cx - 4, 11, 8, 1, '#2a2018');
  // Tanktop über breitem Kreuz, spannt an allen Ecken
  r(c, cx - 5, 6, 10, 5, TANK);
  r(c, cx + 2, 6, 3, 5, TANKD);
  p(c, cx - 3, 8, TANKD); p(c, cx + 1, 9, TANKD);
  // Trapez bis zu den Ohren, Schultern wie Kanonenkugeln
  r(c, cx - 7, 5, 14, 2, SK);
  r(c, cx - 3, 4, 6, 1, SK);
  blob(c, cx - 7.5, 6.5, 1.5, 1.5, SK); blob(c, cx + 6.5, 6.5, 1.5, 1.5, SK);
  if (!flex) {
    // Arme hängen breit ab, die Lats lassen sie nicht ran
    r(c, cx - 9, 7, 3, 5, SK); r(c, cx + 6, 7, 3, 5, SK);
    p(c, cx - 8, 8, SKH); p(c, cx + 7, 8, SKH);
    r(c, cx - 9, 11, 3, 2, SKD); r(c, cx + 6, 11, 3, 2, SKD);
  } else {
    // Doppelbizeps
    r(c, cx - 10, 5, 4, 2, SK); r(c, cx + 6, 5, 4, 2, SK);
    r(c, cx - 10, 1, 2, 4, SK); r(c, cx + 8, 1, 2, 4, SK);
    blob(c, cx - 8, 4, 1.4, 1.2, SKH); blob(c, cx + 7, 4, 1.4, 1.2, SKH);
    r(c, cx - 10, 0, 2, 1, SKD); r(c, cx + 8, 0, 2, 1, SKD);
  }
  // winziger Kopf ohne Hals, Stoppelschnitt, Sonnenbrille
  r(c, cx - 2, 1, 4, 4, SK);
  r(c, cx - 2, 1, 4, 1, HAIR);
  r(c, cx - 2, 2, 4, 1, SHADES);
  outline(c, ox, 0, 20, 16);
}

function drawLeonardBust(c: Ctx) {
  const cx = 32;
  // Bizeps und Schultern sprengen fast das Bild
  blob(c, 9, 70, 10, 15, SK); blob(c, 55, 70, 10, 15, SK);
  blob(c, 8, 88, 8, 10, SKD); blob(c, 56, 88, 8, 10, SKD);
  blob(c, 7, 64, 4, 5, SKH); blob(c, 53, 64, 3, 4, SKH);
  // Trapez steigt fast bis zu den Ohren
  blob(c, cx, 54, 22, 12, SK);
  r(c, cx - 20, 58, 40, 38, SK);
  // Tanktop: viel zu eng, tiefer Ausschnitt, dünne Träger
  r(c, cx - 17, 64, 34, 32, TANK);
  r(c, cx + 10, 64, 7, 32, TANKD);
  r(c, cx - 17, 52, 4, 13, TANK); r(c, cx + 13, 52, 4, 13, TANK);
  for (let i = 0; i < 9; i++) r(c, cx - 6 + Math.floor(i * 0.6), 64 + i, Math.max(0, 12 - Math.floor(i * 1.3)), 1, SK);
  // Brustmuskeln drücken durch, Nähte reißen
  r(c, cx - 14, 77, 12, 1, TANKD); r(c, cx + 2, 77, 12, 1, TANKD);
  r(c, cx - 15, 78, 2, 1, TANKD); r(c, cx + 13, 78, 2, 1, TANKD);
  for (const [x, y] of [[cx - 16, 70], [cx - 16, 74], [cx + 15, 72], [cx - 4, 86], [cx + 3, 90]]) { p(c, x, y, SK); p(c, x + 1, y + 1, SK); }
  // Goldkette im Ausschnitt
  for (let i = 0; i < 13; i++) p(c, cx - 6 + i, 60 + Math.round(Math.abs(i - 6) * -0.5 + 3), GOLD);
  // Adern auf den Armen
  for (const [x, y, h] of [[6, 72, 9], [9, 80, 7], [57, 74, 8], [54, 82, 6]]) for (let i = 0; i < h; i++) p(c, x + (i % 3 === 0 ? 1 : 0), y + i, SKD);
  // kleiner Kopf
  r(c, cx - 7, 26, 14, 18, SK);
  r(c, cx - 8, 30, 16, 10, SK);
  p(c, cx - 9, 34, SK); p(c, cx + 8, 34, SK);
  r(c, cx - 7, 24, 14, 4, HAIR);
  for (let i = 0; i < 6; i++) p(c, cx - 6 + i * 2, 28, HAIR);
  r(c, cx - 7, 32, 6, 3, SHADES); r(c, cx + 1, 32, 6, 3, SHADES); r(c, cx - 1, 32, 2, 1, SHADES);
  p(c, cx - 6, 32, '#8090c0'); p(c, cx + 2, 32, '#8090c0');
  r(c, cx - 1, 35, 2, 3, SKD);
  // selbstgefälliges Grinsen, Stoppeln
  r(c, cx - 3, 40, 6, 1, '#7a3a28'); p(c, cx + 3, 39, '#7a3a28');
  for (let i = 0; i < 8; i++) p(c, cx - 6 + ((i * 5) % 13), 41 + (i % 3), SKD);
  outline(c, 0, 0, BW, BH);
}

/** Wirt Horst nach den roten Pillen: Hemd platzt, Weste nur noch ein Lätzchen. */
function drawWirtBulk(c: Ctx) {
  const cx = 32;
  const SKW = '#f0c08a';
  blob(c, 8, 72, 10, 16, '#e8e8e2'); blob(c, 56, 72, 10, 16, '#e8e8e2');
  blob(c, cx, 58, 24, 10, '#e8e8e2');
  r(c, cx - 22, 60, 44, 36, '#e8e8e2');
  r(c, cx + 12, 62, 10, 34, '#c4c4bc');
  // aufgeplatzte Nähte, Haut darunter
  r(c, 4, 70, 4, 2, SKW); r(c, 57, 76, 4, 2, SKW); r(c, cx - 2, 66, 4, 10, SKW);
  r(c, cx - 3, 68, 1, 6, '#e8e8e2'); r(c, cx + 2, 70, 1, 4, '#e8e8e2');
  // Weste viel zu klein, ein Knopf fliegt gleich
  r(c, cx - 12, 74, 24, 22, '#2a2a30');
  r(c, cx - 2, 74, 4, 22, SKW);
  p(c, cx - 4, 80, '#c8a040'); p(c, cx + 5, 85, '#c8a040');
  r(c, cx - 4, 58, 8, 3, '#202020'); // Fliege
  // Kopf (wie immer), Halsmuskeln
  r(c, cx - 8, 46, 16, 12, SKW);
  r(c, cx - 10, 22, 20, 28, SKW);
  r(c, cx - 11, 26, 22, 18, SKW);
  r(c, cx - 11, 26, 3, 8, '#2a2a2a'); r(c, cx + 8, 26, 3, 8, '#2a2a2a');
  r(c, cx - 4, 22, 8, 2, '#fff8e055');
  r(c, cx - 6, 32, 3, 1, '#2a2a2a'); r(c, cx + 3, 32, 3, 1, '#2a2a2a'); // finster
  r(c, cx - 6, 33, 3, 2, '#2a2a2a'); r(c, cx + 3, 33, 3, 2, '#2a2a2a');
  r(c, cx - 1, 34, 3, 5, '#e0a870');
  r(c, cx - 8, 40, 16, 3, '#2a2a2a');
  r(c, cx - 9, 42, 2, 2, '#2a2a2a'); r(c, cx + 7, 42, 2, 2, '#2a2a2a');
  r(c, cx - 7, 48, 1, 8, '#d8a070'); r(c, cx + 6, 48, 1, 8, '#d8a070');
  outline(c, 0, 0, BW, BH);
}

export function makeLeonardTextures(scene: Phaser.Scene) {
  const t = tex2x(scene, 'leonard', 40, 16, (c) => {
    drawLeonard(c, 0, false);
    drawLeonard(c, 20, true);
  });
  t.add(0, 0, 0, 0, 40, 32);
  t.add(1, 0, 40, 0, 40, 32);
  tex2x(scene, 'nbust_leonard', BW, BH, drawLeonardBust, {
    detail: (c) => { folds(c, TANK); eyeShine(c, ['#8090c0']); sideLight(c, 0.16); },
  });
  tex2x(scene, 'bustWirtBulk', BW, BH, drawWirtBulk, { detail: (c) => { folds(c, '#e8e8e2'); sideLight(c); } });
}
