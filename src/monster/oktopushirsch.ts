import Phaser from 'phaser';
import { Ctx, blob, outline, p, r, rng, tex2x } from '../gfx';

// Der OKTOPUSHIRSCH (Endgegner von Teil 1, siehe story/drehbuch-teil1.md, 8.2). Ein Zombie: halb Skelett, halb
// verrottetes Fleisch, im Stil der Katze und der Kanal-Enten. Von vorn, wie er aus dem Klärbecken steigt.
//  - Hirschschädel, auf einer Seite blanker, rissiger Knochen mit leerer, glühender Augenhöhle, auf der anderen
//    verrottetes Fell mit Maden und einem milchigen Glotzauge; der Kiefer hängt schief, voller Menschenzähne
//  - ein gebrochenes Knochengeweih mit herabhängenden Fleischfetzen, Tentakel winden sich darum, an den Enden
//    wachsen blutunterlaufene Augen aus dem Knochen
//  - ein verwester, violett-grauer Krakenleib mit offenem Brustkorb (Rippen, pulsierendes Herz), acht Arme mit
//    Geschwüren und Knochenstacheln, zwei davon enden in rissigen Hufen
//  - ein zerfledderter Jägerhut mit Gamsbart und die gelbe Ohrmarke „EIGENTUM DER STADT“
//
// Für die Animation (monster/hirschRig.ts) ist er in Teile zerlegt, alle auf derselben Leinwand (160x96, Wasserlinie
// unten): Leib, Kopf, Kiefer, linkes und rechtes Geweih; dazu kleine Bilder für Herz und Augen. Die Arme zeichnet das
// Rig selbst (sie bewegen sich). drawOktopushirsch zeichnet das ganze Standbild (Entwurf, Vorschau).

export const OKTO_W = 160, OKTO_H = 120;
/** Wasserlinie im Bild (darunter ist er im Becken); Teile-Leinwand ist so hoch */
export const OKTO_WASSER = 96;
/** Augen an den Geweihenden */
export const OKTO_AUGEN: [number, number][] = [[33, 20], [41, 5], [57, 9], [48, 30], [127, 21], [119, 5], [103, 9], [112, 30]];
/** Drehpunkte (Bildkoordinaten): Hals, Kiefergelenk, Rosenstöcke, Herz, leere Augenhöhle */
export const OKTO_HALS: [number, number] = [80, 60];
export const OKTO_KIEFER: [number, number] = [86, 67];
export const OKTO_GEWEIH_L: [number, number] = [73, 31];
export const OKTO_GEWEIH_R: [number, number] = [87, 31];
export const OKTO_HERZ: [number, number] = [80, 84];
export const OKTO_HOEHLE: [number, number] = [71, 44];

type Pt = [number, number];

export const HAUT = '#4e2846', HAUT_D = '#1e0a1a', BAUCH = '#a86a84', GLANZ = '#7a4a72', NAPF = '#e0b0c4', NAPF_D = '#5a1a3a';
export const KNOCHEN = '#d8cca8', KNOCHEN_S = '#a89a78', KNOCHEN_D = '#6a5e48', RISS = '#3a3024';
export const FLEISCH = '#7a2a2a', ROH = '#a83a3a', TROCKEN = '#4a1a1a';

/** Punkte einer quadratischen Bezierkurve, ungefähr alle 0,6 Pixel */
function kurve(a: Pt, b: Pt, c: Pt): Pt[] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]);
  const n = Math.max(4, Math.ceil(len / 0.6));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    out.push([(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * b[0] + u * u * c[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * b[1] + u * u * c[1]]);
  }
  return out;
}

/** Tentakel entlang einer Kurve: dunkle Kante, faulige Haut, blasse Unterseite, Saugnäpfe, Geschwüre */
function tentakel(c: Ctx, pts: Pt[], r0: number, r1: number, unten = 1, seed = 1) {
  const rnd = rng(seed);
  const n = pts.length;
  const geo = pts.map(([x, y], i) => {
    const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(n - 1, i + 1)];
    const tl = Math.hypot(bx - ax, by - ay) || 1;
    return { x, y, r: r0 + (r1 - r0) * (i / (n - 1)), nx: (-(by - ay) / tl) * unten, ny: ((bx - ax) / tl) * unten };
  });
  for (const q of geo) blob(c, q.x, q.y, q.r + 0.9, q.r + 0.9, HAUT_D);
  for (const q of geo) blob(c, q.x, q.y, q.r, q.r, HAUT);
  for (const q of geo) blob(c, q.x + q.nx * q.r * 0.45, q.y + q.ny * q.r * 0.45, q.r * 0.5, q.r * 0.5, BAUCH);
  geo.forEach((q, i) => {
    p(c, Math.round(q.x - q.nx * q.r * 0.5), Math.round(q.y - q.ny * q.r * 0.5), GLANZ);
    if (i % 5 === 2 && q.r > 1.1) {
      const sx = Math.round(q.x + q.nx * q.r * 0.7), sy = Math.round(q.y + q.ny * q.r * 0.7);
      p(c, sx, sy, NAPF);
      if (q.r > 2.2) { p(c, sx + 1, sy, NAPF); p(c, sx, sy + 1, NAPF_D); }
    }
    if (i % 17 === 8 && q.r > 1.8) {
      const gx = Math.round(q.x - q.nx * q.r * 0.3), gy = Math.round(q.y - q.ny * q.r * 0.3);
      blob(c, gx, gy, 1.4, 1.2, FLEISCH); p(c, gx, gy, '#d8e050');
    }
    if (i % 23 === 15 && q.r > 2 && rnd() < 0.8) {
      const bx = q.x - q.nx * (q.r + 1), by = q.y - q.ny * (q.r + 1);
      p(c, Math.round(bx), Math.round(by), KNOCHEN); p(c, Math.round(bx - q.nx), Math.round(by - q.ny), KNOCHEN_S);
    }
  });
}

/** ein Knochenstück von a nach b: vergilbt, mit Schatten und Rissen */
function knochen(c: Ctx, a: Pt, b: Pt, d0: number, d1: number) {
  const n = Math.max(3, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.6));
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u, d = d0 + (d1 - d0) * u;
      if (pass === 0) blob(c, x, y, d + 0.8, d + 0.8, '#1a140c');
      else if (pass === 1) blob(c, x, y, d, d, KNOCHEN);
      else { p(c, Math.round(x + d * 0.5), Math.round(y + d * 0.3), KNOCHEN_S); if (i % 4 === 1) p(c, Math.round(x), Math.round(y), RISS); }
    }
  }
}

/** Fleischfetzen, die von einem Knochen hängen */
function fetzen(c: Ctx, x: number, y: number, len: number) {
  for (let i = 0; i < len; i++) p(c, Math.round(x + Math.sin(i * 0.9) * 0.6), Math.round(y + i), i % 3 ? FLEISCH : TROCKEN);
  p(c, Math.round(x), Math.round(y + len), ROH);
}

/** blutunterlaufenes Auge, das aus dem Knochen wächst; leuchtet violett */
function knochenAuge(c: Ctx, x: number, y: number) {
  blob(c, x, y, 2.9, 2.7, '#3a0a1e');
  blob(c, x, y, 2.2, 2, '#e8dcd8');
  for (const [dx, dy] of [[-2, 0], [1, -2], [2, 1], [-1, 2]] as Pt[]) p(c, Math.round(x + dx), Math.round(y + dy), '#c02a3a');
  blob(c, x, y, 1.2, 1.2, '#b040ff');
  p(c, Math.round(x), Math.round(y), '#140420');
  p(c, Math.round(x) - 1, Math.round(y) - 1, '#ffffff');
}

/** rissiger Huf am Ende eines Arms */
function huf(c: Ctx, x: number, y: number) {
  blob(c, x, y, 3.2, 2.6, '#2a1a12');
  r(c, Math.round(x), Math.round(y) - 2, 1, 5, '#5a4a3a');
  p(c, Math.round(x) - 2, Math.round(y) - 1, '#4a3a2a'); p(c, Math.round(x) + 2, Math.round(y), RISS);
  p(c, Math.round(x) - 1, Math.round(y) + 2, KNOCHEN_D);
}

/** Tentakel, der sich um ein Knochenstück windet (nur die vorderen Windungen sind zu sehen) */
function umwinden(c: Ctx, a: Pt, b: Pt, wind: number, dicke: number) {
  const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.5);
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  for (let i = 0; i <= n; i++) {
    const u = i / n, s = Math.sin(u * Math.PI * wind);
    if (s < -0.2) continue;
    const x = a[0] + dx * u + nx * s * 2.2, y = a[1] + dy * u + ny * s * 2.2;
    blob(c, x, y, dicke + 0.5, dicke + 0.5, HAUT_D);
    blob(c, x, y, dicke, dicke, HAUT);
    if (i % 4 === 0) p(c, Math.round(x + nx), Math.round(y + ny), NAPF);
  }
}

// ---------------------------------------------------------------- Teile

/** verwester Krakenleib mit offenem Brustkorb (das Herz ist ein eigenes Bild) */
export function drawLeib(c: Ctx, umriss = true) {
  const rnd = rng(8888);
  blob(c, 80, 76, 40, 24, '#2e1a2c');
  blob(c, 80, 74, 38, 22, '#4a2a46');
  blob(c, 80, 58, 27, 18, '#4a2a46');
  for (let i = 0; i < 26; i++) blob(c, 46 + rnd() * 68, 52 + rnd() * 40, 1.5 + rnd() * 3, 1 + rnd() * 2, i % 3 ? '#3a4a30' : '#5a3a3a');
  for (let i = 0; i < 7; i++) { const x = 48 + rnd() * 64, y = 58 + rnd() * 30; blob(c, x, y, 2.2, 1.5, FLEISCH); p(c, Math.round(x), Math.round(y), '#d8e050'); p(c, Math.round(x) + 1, Math.round(y), '#f0ecd8'); }
  for (let i = 0; i < 6; i++) { const x = 56 + i * 9.6, h = 3 + (i % 2) * 2; for (let k = 0; k < h; k++) p(c, Math.round(x), 41 - k + Math.round(Math.abs(i - 2.5)), k ? KNOCHEN : KNOCHEN_S); }
  for (const [x, y] of [[50, 72], [52, 78], [108, 72], [106, 78]] as Pt[]) r(c, x, y, 5, 1, '#1a0a14');
  // offener Brustkorb: Loch, grüner Schein, Adern, Brustbein, Rippen (eine gebrochen)
  blob(c, 80, 82, 15, 10, '#140810');
  blob(c, 80, 84, 10, 6, '#1e3a1a');
  for (const dx of [-3, 3]) for (let k = 0; k < 4; k++) p(c, 80 + dx + (dx > 0 ? k : -k), 80 + k, '#4a0a1a');
  r(c, 79, 72, 3, 20, KNOCHEN_S); r(c, 80, 72, 1, 20, KNOCHEN);
  for (let k = 0; k < 5; k++) {
    const y0 = 74 + k * 3.6;
    for (const s of [-1, 1]) {
      for (let t = 0; t <= 14; t++) {
        const x = 80 + s * (2 + t), y = y0 + Math.sin((t / 14) * Math.PI) * -2.2 + t * 0.18;
        p(c, Math.round(x), Math.round(y), t % 5 === 4 ? KNOCHEN_S : KNOCHEN);
      }
      if (k === 2) { p(c, 80 + s * 11, Math.round(y0), RISS); p(c, 80 + s * 12, Math.round(y0) + 1, '#140810'); }
    }
  }
  if (umriss) outline(c, 0, 0, OKTO_W, OKTO_WASSER);
}

/** das kranke Herz im Brustkorb (12x10, Mitte bei 6/5) */
export function drawHerz(c: Ctx, x = 6, y = 5) {
  blob(c, x, y, 4.2, 3.6, '#6a1a2a'); blob(c, x - 1, y - 1, 2.6, 2.2, '#a83a4a'); p(c, x - 2, y - 2, '#e07080');
  p(c, x + 2, y - 3, '#4a0a1a'); p(c, x + 3, y - 2, '#4a0a1a'); p(c, x - 3, y + 2, '#4a0a1a');
}

/** Knochengeweih einer Seite: Stangen, Enden, Tentakel darum, Fleischfetzen (Augen sind eigene Bilder) */
export function drawGeweih(c: Ctx, seite: 'L' | 'R', umriss = true) {
  if (seite === 'L') {
    knochen(c, [73, 31], [56, 22], 2.2, 1.6);
    knochen(c, [56, 22], [44, 10], 1.6, 1.2);
    knochen(c, [60, 24], [46, 28], 1.4, 1); knochen(c, [46, 28], [35, 21], 1, 0.8);
    knochen(c, [50, 16], [42, 6], 1.2, 0.8);
    knochen(c, [53, 19], [57, 10], 1.1, 0.8);
    knochen(c, [66, 27], [48, 31], 1, 0.7);
    umwinden(c, [72, 31], [46, 12], 5, 1);
    umwinden(c, [60, 25], [37, 21], 3, 0.7);
    for (const [x, y, l] of [[62, 25, 6], [52, 18, 4], [44, 29, 5], [70, 30, 3]] as [number, number, number][]) fetzen(c, x, y, l);
  } else {
    knochen(c, [87, 31], [104, 22], 2.2, 1.6);
    knochen(c, [104, 22], [116, 10], 1.6, 1.2);
    knochen(c, [100, 24], [114, 28], 1.4, 1); knochen(c, [114, 28], [125, 20], 1, 0.8);
    knochen(c, [110, 16], [118, 6], 1.2, 0.8);
    knochen(c, [107, 19], [103, 10], 1.1, 0.8);
    knochen(c, [94, 27], [112, 31], 1, 0.7);
    umwinden(c, [88, 31], [114, 12], 5, 1);
    umwinden(c, [100, 25], [123, 21], 3, 0.7);
    for (const [x, y, l] of [[98, 25, 6], [108, 18, 4], [116, 29, 5], [90, 30, 3]] as [number, number, number][]) fetzen(c, x, y, l);
  }
  if (umriss) outline(c, 0, 0, OKTO_W, OKTO_WASSER);
}

/** Hirschschädel ohne Unterkiefer: links Knochen, rechts Fäulnis; Maulhöhle, Ohrmarke, Hut */
export function drawKopf(c: Ctx, umriss = true) {
  blob(c, 62, 34, 3, 2, FLEISCH); p(c, 60, 34, KNOCHEN_S);
  blob(c, 100, 33, 6.5, 2.8, '#4a3826'); blob(c, 100, 33, 4.2, 1.5, '#9a5a5a'); p(c, 104, 32, '#0a0606'); p(c, 105, 34, '#0a0606');
  blob(c, 73, 31, 2.6, 2.2, '#8a6a4a'); blob(c, 87, 31, 2.6, 2.2, '#8a6a4a'); // Rosenstöcke
  blob(c, 80, 39, 12.5, 8.5, '#1a140c');
  blob(c, 80, 38, 12, 8, KNOCHEN);
  blob(c, 80, 48, 10.5, 9, KNOCHEN);
  blob(c, 80, 57, 7.5, 8.5, KNOCHEN);
  blob(c, 72, 49, 3, 7, KNOCHEN_S);
  for (let y = 30; y <= 66; y++) {
    const rand = 80 + Math.round(Math.sin(y * 0.7) * 1.5 + Math.sin(y * 1.9) * 1);
    const [cy, ry, rx] = y < 46 ? [38, 8, 12] : y < 56 ? [48, 9, 10.5] : [57, 8.5, 7.5];
    for (let x = rand; x <= 94; x++) {
      const dx = (x - 80) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      p(c, x, y, (x + y) % 5 ? '#5a4632' : '#3e3020');
    }
    p(c, rand, y, ROH); p(c, rand + 1, y, FLEISCH);
  }
  for (const [x, y] of [[86, 40], [88, 52], [84, 58], [90, 44], [85, 49]] as Pt[]) { p(c, x, y, '#f0ecd8'); p(c, x + 1, y, '#d8d0b8'); }
  for (const [x, y, l] of [[74, 34, 5], [70, 40, 4], [76, 52, 6]] as [number, number, number][]) for (let i = 0; i < l; i++) p(c, x + (i % 2), y + i, RISS);
  blob(c, 71, 44, 3.4, 3, '#0a0606'); p(c, 71, 44, '#b040ff'); p(c, 72, 45, '#5a1a8a');
  blob(c, 89, 45, 3.2, 2.8, '#2a0a0a');
  blob(c, 89, 45, 2.6, 2.3, '#d0d8d8');
  for (const [dx, dy] of [[-2, 0], [2, 1], [0, -2]] as Pt[]) p(c, 89 + dx, 45 + dy, '#c02a3a');
  p(c, 90, 45, '#8a9498'); p(c, 88, 44, '#ffffff');
  for (let i = 0; i < 4; i++) r(c, 77 - Math.floor(i / 2), 58 + i, 2 + i, 1, '#0a0606');
  blob(c, 84, 63, 2.6, 2, '#1e1410'); p(c, 84, 62, '#6a5a5a');
  // Schlund zwischen Oberkiefer und geschlossenem Unterkiefer (geöffnet zeichnet das Rig die Maulhöhle selbst)
  for (let x = 66; x <= 88; x++) { const y1 = 69 + Math.round((86 - x) * 0.35); for (let y = 65; y < y1; y++) p(c, x, y, '#1a0404'); }
  for (let x = 72; x <= 89; x++) {
    const y = 64 + Math.round((x - 72) * 0.1);
    if ((x - 72) % 3 !== 2 && x !== 80) { r(c, x, y, 1, 2, '#ece4d2'); p(c, x, y + 1, '#c8bca0'); }
    else p(c, x, y, '#2a0606');
  }
  p(c, 83, 64, '#e8c040'); p(c, 83, 65, '#b89020');
  p(c, 102, 35, '#8a8a92');
  r(c, 100, 36, 7, 5, '#d8b020'); r(c, 100, 36, 7, 1, '#f0e070'); r(c, 100, 40, 7, 1, '#a88010');
  for (const [x, y] of [[101, 38], [103, 38], [105, 38], [102, 39], [104, 39]] as Pt[]) p(c, x, y, '#3a2a0a');
  p(c, 106, 41, '#7a2a2a');
  // zerfledderter Jägerhut mit Gamsbart
  r(c, 74, 29, 14, 2, '#2a3a20'); r(c, 74, 30, 14, 1, '#1a2614'); p(c, 76, 30, '#0a0a06'); p(c, 85, 29, '#0a0a06');
  blob(c, 81, 26, 5, 3.2, '#34482a'); r(c, 76, 27, 10, 1, '#4a3018'); p(c, 79, 25, '#0a0a06');
  for (let i = 0; i < 7; i++) r(c, 85 + (i % 3), 18 + i, 1, 4, i % 2 ? '#c8c0b0' : '#7a7060');
  if (umriss) outline(c, 0, 0, OKTO_W, OKTO_WASSER);
}

/** schief hängender Unterkiefer mit Menschenzähnen und Sabber (Gelenk bei OKTO_KIEFER) */
export function drawKiefer(c: Ctx, umriss = true) {
  for (let x = 66; x <= 86; x++) {
    const y = 69 + Math.round((86 - x) * 0.35);
    r(c, x, y, 1, 3, KNOCHEN_S); p(c, x, y + 2, KNOCHEN_D);
    if ((x - 66) % 3 !== 1) { p(c, x, y - 1, '#ece4d2'); p(c, x, y - 2, x % 2 ? '#ece4d2' : '#c8bca0'); }
  }
  for (const [x, len] of [[68, 8], [71, 12], [75, 6], [84, 5]] as Pt[]) { r(c, x, 74, 1, len, '#8ac83a'); p(c, x, 74 + len, '#b8f060'); }
  if (umriss) outline(c, 0, 0, OKTO_W, OKTO_WASSER);
}

/** ein Geweih-Auge (8x8, Mitte bei 4/4) */
export function drawAuge(c: Ctx) {
  knochenAuge(c, 4, 4);
}

/** die sechs sichtbaren Arme als Standbild (das Rig zeichnet sie bewegt) */
function drawArme(c: Ctx, hinten: boolean) {
  const Y = OKTO_WASSER;
  if (hinten) {
    tentakel(c, kurve([40, Y + 2], [12, 64], [28, 34]), 4.4, 1.2, 1, 3);
    tentakel(c, kurve([120, Y + 2], [150, 66], [132, 36]), 4.4, 1.2, -1, 4);
    return;
  }
  tentakel(c, kurve([60, Y - 2], [36, 82], [16, 92]), 4.6, 2.2, 1, 5);
  huf(c, 14, 92);
  tentakel(c, kurve([100, Y - 2], [126, 82], [144, 92]), 4.6, 2.2, -1, 6);
  huf(c, 146, 92);
  tentakel(c, kurve([66, Y + 2], [52, 84], [62, 76]), 4, 1.3, 1, 7);
  tentakel(c, kurve([94, Y + 2], [108, 84], [98, 76]), 4, 1.3, -1, 8);
  tentakel(c, kurve([52, Y + 4], [40, 98], [28, 100]), 3.6, 1.6, 1, 9);
  tentakel(c, kurve([108, Y + 4], [120, 98], [132, 100]), 3.6, 1.6, -1, 10);
}

/** das ganze Standbild (160x120, Wasserlinie bei OKTO_WASSER) */
export function drawOktopushirsch(c: Ctx) {
  drawArme(c, true);
  drawLeib(c, false);
  drawHerz(c, OKTO_HERZ[0], OKTO_HERZ[1]);
  drawGeweih(c, 'L', false);
  drawGeweih(c, 'R', false);
  drawKopf(c, false);
  drawKiefer(c, false);
  drawArme(c, false);
  c.clearRect(0, OKTO_WASSER + 1, OKTO_W, OKTO_H - OKTO_WASSER);
  for (let x = 30; x < 130; x += 2) p(c, x, OKTO_WASSER, x % 4 ? '#8aa080' : '#c8e0c0');
  for (const [x, y] of OKTO_AUGEN) knochenAuge(c, x, y);
  outline(c, 0, 0, OKTO_W, OKTO_WASSER);
}

/** alle Bilder des Oktopushirschs (Standbild und Teile für die Animation) */
export function makeOktopushirschTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('okto_leib')) return;
  tex2x(scene, 'oktopushirsch', OKTO_W, OKTO_H, drawOktopushirsch);
  tex2x(scene, 'okto_leib', OKTO_W, OKTO_WASSER, drawLeib);
  tex2x(scene, 'okto_kopf', OKTO_W, OKTO_WASSER, drawKopf);
  tex2x(scene, 'okto_kiefer', OKTO_W, OKTO_WASSER, drawKiefer);
  tex2x(scene, 'okto_geweihL', OKTO_W, OKTO_WASSER, (c) => drawGeweih(c, 'L'));
  tex2x(scene, 'okto_geweihR', OKTO_W, OKTO_WASSER, (c) => drawGeweih(c, 'R'));
  tex2x(scene, 'okto_herz', 12, 10, (c) => { drawHerz(c); outline(c, 0, 0, 12, 10); });
  tex2x(scene, 'okto_auge', 8, 8, (c) => { drawAuge(c); outline(c, 0, 0, 8, 8); });
}
