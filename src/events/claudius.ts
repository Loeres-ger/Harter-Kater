import Phaser from 'phaser';
import { Ctx, blob, folds, outline, p, r, sideLight, tex2x } from '../gfx';

// Grafiken für Kapitel 5: Captain Claudius (Figur und Brustbild) und sein versteckter Rechner auf dem Dachboden.
// Claudius ist eine eigene Figur: blaue Galauniform, goldene Schulterstücke, weißer Umhang mit blauen Sternchen,
// hoher Helm mit Federbusch, verspiegelte Brille, Megafon statt Schild. Bewusst keine Anlehnung an bekannte Comicfiguren.

const BLUE = '#2a5ab0', BLUE_D = '#1e4290', WHITE = '#eef1f8', GOLD = '#e0b030', GOLD_D = '#b08820';
const SKIN = '#f0c49a', SKIN_D = '#d8a880';

/** Figur 20×28, Bild 0: steht stramm, Bild 1: brüllt ins Megafon. */
function drawClaudius(c: Ctx, ox: number, shout: boolean) {
  const cx = ox + 10;
  // Umhang hinter dem Körper, mit Sternchen
  r(c, cx - 6, 10, 12, 13, WHITE);
  for (const [x, y] of [[-5, 13], [4, 15], [-4, 19], [3, 21], [0, 22]]) p(c, cx + x, y, BLUE);
  // Stiefel und weiße Hose mit Goldstreifen
  r(c, cx - 4, 24, 3, 4, '#f8f8ff'); r(c, cx + 1, 24, 3, 4, '#f8f8ff');
  r(c, cx - 4, 27, 3, 1, '#9aa0b0'); r(c, cx + 1, 27, 3, 1, '#9aa0b0');
  r(c, cx - 4, 18, 3, 6, '#dfe4ee'); r(c, cx + 1, 18, 3, 6, '#dfe4ee');
  p(c, cx - 4, 20, GOLD); p(c, cx + 3, 20, GOLD);
  // Uniformjacke, Gürtel, Orden
  r(c, cx - 4, 10, 8, 8, BLUE); r(c, cx + 2, 10, 2, 8, BLUE_D);
  r(c, cx - 4, 17, 8, 1, GOLD);
  p(c, cx - 3, 12, '#f0c040'); p(c, cx - 2, 12, '#c8ccd8'); p(c, cx - 3, 13, '#f0c040');
  p(c, cx + 1, 12, '#ffffff'); p(c, cx, 13, '#ffffff'); p(c, cx + 1, 13, '#ffffff'); p(c, cx + 2, 13, '#ffffff'); // Stern
  // Schulterstücke
  r(c, cx - 6, 10, 2, 2, GOLD); r(c, cx + 4, 10, 2, 2, GOLD);
  // Arme: links unten, rechts unten oder mit Megafon nach oben
  r(c, cx - 6, 12, 2, 5, BLUE); p(c, cx - 6, 17, SKIN);
  if (shout) {
    r(c, cx + 4, 6, 2, 5, BLUE);
    r(c, cx + 5, 3, 3, 3, '#d8dce4'); r(c, cx + 8, 2, 2, 5, '#f4f6fa'); p(c, cx + 10, 1, '#f8e070'); p(c, cx + 10, 7, '#f8e070');
  } else {
    r(c, cx + 4, 12, 2, 5, BLUE_D); p(c, cx + 5, 17, SKIN);
  }
  // Kopf: kantiges Kinn, verspiegelte Brille
  r(c, cx - 2, 5, 5, 5, SKIN); r(c, cx - 2, 9, 5, 1, SKIN_D); p(c, cx + 2, 6, SKIN_D);
  r(c, cx - 2, 6, 5, 1, '#101018'); p(c, cx - 1, 6, '#7ab0ff'); p(c, cx + 2, 6, '#7ab0ff');
  if (shout) r(c, cx - 1, 8, 3, 1, '#6a1a1a');
  else p(c, cx, 8, '#8a4a3a');
  // Helm mit Goldband und Federbusch
  r(c, cx - 3, 2, 7, 3, BLUE); r(c, cx - 3, 4, 7, 1, GOLD); p(c, cx, 3, '#ffffff');
  r(c, cx, 0, 1, 2, '#ffffff'); p(c, cx + 1, 0, '#ffffff'); p(c, cx + 2, 1, '#dfe4ee');
  outline(c, ox, 0, 20, 28);
}

/** Brustbild 64×96. angry: brüllt mit gerunzelter Stirn. */
function drawClaudiusBust(c: Ctx, angry: boolean) {
  const cx = 32;
  // Umhangkragen mit Sternchen
  r(c, 2, 58, 60, 38, WHITE);
  for (const [x, y] of [[6, 66], [56, 70], [8, 84], [58, 88], [5, 76]]) { p(c, x, y, BLUE); p(c, x - 1, y, BLUE); p(c, x + 1, y, BLUE); p(c, x, y - 1, BLUE); p(c, x, y + 1, BLUE); }
  // Uniform
  r(c, 10, 54, 44, 42, BLUE); r(c, 44, 56, 10, 40, BLUE_D);
  r(c, cx - 1, 56, 2, 40, BLUE_D); // Knopfleiste
  for (let y = 62; y < 94; y += 7) p(c, cx, y, GOLD);
  // Schärpe quer über die Brust
  for (let i = 0; i < 34; i++) r(c, 14 + i, 56 + Math.floor(i * 1.1), 5, 2, '#f4f6fa');
  // Schulterstücke mit Fransen
  r(c, 6, 51, 15, 5, GOLD); r(c, 43, 51, 15, 5, GOLD);
  for (let x = 6; x < 21; x += 2) r(c, x, 56, 1, 4, GOLD_D);
  for (let x = 43; x < 58; x += 2) r(c, x, 56, 1, 4, GOLD_D);
  // Ordenssammlung links
  for (let k = 0; k < 6; k++) {
    const x = 15 + (k % 3) * 5, y = 70 + Math.floor(k / 3) * 9;
    r(c, x - 1, y - 4, 3, 3, k % 2 ? '#7ab0ff' : '#ffffff');
    blob(c, x, y + 1, 1.8, 1.8, k % 2 ? '#f0c040' : '#c8ccd8');
  }
  // großer weißer Stern rechts
  const star = ['...X...', '...X...', 'XXXXXXX', '.XXXXX.', '..XXX..', '.XX.XX.', '.X...X.'];
  star.forEach((row, y) => [...row].forEach((ch, x) => ch === 'X' && r(c, 38 + x, 66 + y, 1, 1, '#ffffff')));
  // Hals und Kopf mit kantigem Kinn
  r(c, cx - 6, 44, 12, 12, SKIN);
  r(c, cx - 13, 16, 26, 28, SKIN); r(c, cx - 14, 32, 28, 10, SKIN); r(c, cx - 11, 42, 22, 3, SKIN);
  r(c, cx + 8, 18, 5, 24, SKIN_D);
  p(c, cx, 43, '#c8946a'); // Kinngrübchen
  r(c, cx - 15, 26, 2, 7, SKIN); r(c, cx + 13, 26, 2, 7, SKIN_D); // Ohren
  // Helm: hoch, blau, Goldband, Stern, Federbusch
  r(c, cx - 15, 4, 30, 14, BLUE); r(c, cx + 6, 4, 9, 14, BLUE_D);
  r(c, cx - 17, 14, 34, 5, BLUE); r(c, cx - 17, 17, 34, 2, GOLD);
  r(c, cx - 1, 7, 3, 5, '#ffffff'); r(c, cx - 3, 9, 7, 1, '#ffffff');
  r(c, cx - 2, 0, 4, 5, '#ffffff'); blob(c, cx + 4, 2, 4, 2, '#f4f6fa'); blob(c, cx + 8, 4, 3, 1.6, '#dfe4ee');
  // Augenbrauen über der Brille
  if (angry) {
    for (let i = 0; i < 8; i++) { p(c, cx - 11 + i, 21 + Math.floor(i / 3), '#5a4030'); p(c, cx + 10 - i, 21 + Math.floor(i / 3), '#5a4030'); }
  } else {
    r(c, cx - 11, 21, 8, 1, '#5a4030'); r(c, cx + 3, 20, 8, 1, '#5a4030');
  }
  // verspiegelte Pilotenbrille
  r(c, cx - 12, 25, 10, 6, '#203050'); r(c, cx + 2, 25, 10, 6, '#203050');
  r(c, cx - 2, 26, 4, 1, '#c0c4cc');
  r(c, cx - 11, 26, 4, 1, '#9ad0ff'); r(c, cx + 3, 26, 4, 1, '#9ad0ff'); p(c, cx - 5, 29, '#6a90c0'); p(c, cx + 9, 29, '#6a90c0');
  // Mund: selbstgefälliges Grinsen oder Gebrüll
  if (angry) {
    r(c, cx - 6, 35, 12, 6, '#5a1010'); r(c, cx - 5, 35, 10, 2, '#ffffff'); r(c, cx - 3, 39, 6, 2, '#a03030');
  } else {
    r(c, cx - 5, 37, 10, 2, '#8a3a2a'); p(c, cx + 5, 36, '#8a3a2a'); r(c, cx - 3, 37, 6, 1, '#ffffff');
  }
}

/** Alter Röhrenmonitor auf einer Kiste (Kachel 16×16). */
function drawPc(c: Ctx) {
  r(c, 1, 9, 14, 7, '#6a4a2a'); r(c, 1, 9, 14, 1, '#8a6234'); r(c, 1, 12, 14, 1, '#4a3418');
  r(c, 2, 1, 12, 9, '#c8c0a8'); r(c, 12, 1, 2, 9, '#a8a088');
  r(c, 3, 2, 9, 6, '#103020');
  r(c, 4, 3, 5, 1, '#40e070'); r(c, 4, 5, 3, 1, '#40e070'); p(c, 8, 5, '#40e070');
  r(c, 5, 10, 6, 1, '#8a8478');
  r(c, 3, 13, 10, 2, '#d8d0b8'); for (let x = 4; x < 12; x += 2) p(c, x, 13, '#a8a090');
  outline(c, 0, 0, 16, 16);
}

export function makeClaudiusTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('claudius')) return;
  const t = tex2x(scene, 'claudius', 40, 28, (c) => { drawClaudius(c, 0, false); drawClaudius(c, 20, true); });
  t.add(0, 0, 0, 0, 40, 56);
  t.add(1, 0, 40, 0, 40, 56);
  const detail = (c: Ctx) => { folds(c, BLUE); folds(c, WHITE); sideLight(c); };
  tex2x(scene, 'nbust_claudius', 64, 96, (c) => drawClaudiusBust(c, false), { detail });
  tex2x(scene, 'nbust_claudiusAngry', 64, 96, (c) => drawClaudiusBust(c, true), { detail });
  tex2x(scene, 'atticPc', 16, 16, drawPc);
}
