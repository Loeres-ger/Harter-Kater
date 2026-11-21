import Phaser from 'phaser';
import { Ctx, outline, p, r, tex2x } from '../gfx';

// Emilian in groß: Leni Blumes Leibwächter für den Endkampf. Kreuz wie ein Kleiderschrank, V-Form, Brust, Sixpack,
// dicke Arme, Ölglanz, Tarnhose, Hundemarke, Mütze. Gezeichnet mit Formen statt einzelner Pixel, damit die Muskeln
// sauber sitzen; tex2x verdoppelt und schattiert.

const FW = 84, FH = 110;
type P2 = [number, number];

const SK = '#d9a273', SK2 = '#bd8556', SK3 = '#986640', HL = '#f2cda0', OIL = '#fff7ea';
const CAMO = '#56603a', CAMO_D = '#3c4528', CAMO_B = '#6e5a3a', CAMO_L = '#7a824e';
const BOOT = '#1e1c18', BELT = '#2a2418', GOLD = '#d8b860', CHAIN = '#c8ccd4';
const CAP = '#56603a', BRIM = '#3c4528', HAIR = '#3a2a1a', EYE = '#1a1210', LIP = '#9a5a44', TEETH = '#f4f0e8';

type Face = 'smirk' | 'angry' | 'grin' | 'ouch' | 'ko';
interface Pose {
  lean: number;
  crouch: number;
  face: Face;
  L: [P2, P2];
  R: [P2, P2];
  fistL?: number;
  fistR?: number;
  bottle?: boolean;
}

const POSES: Record<string, Pose> = {
  idle: { lean: 0, crouch: 0, face: 'smirk', L: [[12, 52], [15, 65]], R: [[72, 52], [69, 65]] },
  windL: { lean: -4, crouch: 0, face: 'angry', L: [[6, 40], [13, 24]], R: [[66, 51], [55, 45]] },
  windR: { lean: 4, crouch: 0, face: 'angry', L: [[18, 51], [29, 45]], R: [[78, 40], [71, 24]] },
  punchL: { lean: -6, crouch: 2, face: 'angry', L: [[9, 47], [5, 58]], R: [[68, 51], [57, 45]], fistL: 8 },
  punchR: { lean: 6, crouch: 2, face: 'angry', L: [[16, 51], [27, 45]], R: [[75, 47], [79, 58]], fistR: 8 },
  up: { lean: 0, crouch: -4, face: 'angry', L: [[13, 16], [32, 5]], R: [[71, 16], [52, 5]] },
  slam: { lean: 0, crouch: 12, face: 'angry', L: [[15, 60], [24, 86]], R: [[69, 60], [60, 86]] },
  oil: { lean: 0, crouch: 4, face: 'grin', L: [[13, 54], [35, 47]], R: [[71, 54], [49, 47]], bottle: true },
  flex: { lean: 0, crouch: 0, face: 'grin', L: [[3, 31], [9, 13]], R: [[81, 31], [75, 13]] },
  hurt: { lean: 4, crouch: 3, face: 'ouch', L: [[9, 46], [4, 59]], R: [[75, 46], [80, 59]] },
  hug: { lean: 0, crouch: 2, face: 'grin', L: [[3, 41], [2, 60]], R: [[81, 41], [82, 60]] },
  down: { lean: 0, crouch: 22, face: 'ko', L: [[16, 66], [19, 90]], R: [[68, 66], [65, 90]] },
};

/** Reihenfolge der Bilder im Blatt „emilBig“ */
export const EMIL_FRAMES = Object.keys(POSES);
export const EMIL = Object.fromEntries(EMIL_FRAMES.map((k, i) => [k, i])) as Record<string, number>;

export function poly(c: Ctx, pts: P2[], col: string) {
  const ys = pts.map((q) => q[1]);
  const y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.round(xs[k]), b = Math.round(xs[k + 1]);
      if (b > a) r(c, a, y, b - a, 1, col);
    }
  }
}

export function disc(c: Ctx, cx: number, cy: number, rx: number, ry: number, col: string) {
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
    const t = 1 - (y * y) / (ry * ry);
    if (t < 0) continue;
    const h = rx * Math.sqrt(t);
    const a = Math.round(cx - h), b = Math.round(cx + h);
    if (b >= a) r(c, a, Math.round(cy + y), b - a + 1, 1, col);
  }
}

export function limb(c: Ctx, x1: number, y1: number, x2: number, y2: number, w1: number, w2: number, col: string) {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
  for (let i = 0; i <= n; i++) {
    const t = i / n, w = w1 + (w2 - w1) * t;
    disc(c, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, w / 2, w / 2, col);
  }
}

export function line(c: Ctx, x1: number, y1: number, x2: number, y2: number, col: string) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));
  for (let i = 0; i <= n; i++) p(c, Math.round(x1 + ((x2 - x1) * i) / n), Math.round(y1 + ((y2 - y1) * i) / n), col);
}

function drawEmil(c: Ctx, ox: number, oy: number, P: Pose) {
  const X = (x: number) => ox + x, Y = (y: number) => oy + y;
  const cr = P.crouch, lean = P.lean;
  const tx = (x: number) => X(x + lean), ty = (y: number) => Y(y + cr);

  // ---- Beine in Tarnhose
  const hip = 66 + cr, kneeY = 86 + cr * 0.35, kn = Math.max(0, cr) * 0.55, cx = 42;
  poly(c, [[X(cx - 15), Y(hip)], [X(cx - 1), Y(hip)], [X(cx - 3 - kn * 0.3), Y(kneeY)], [X(40), Y(101)], [X(27), Y(101)], [X(cx - 18 - kn), Y(kneeY)]], CAMO);
  poly(c, [[X(cx + 1), Y(hip)], [X(cx + 15), Y(hip)], [X(cx + 18 + kn), Y(kneeY)], [X(57), Y(101)], [X(44), Y(101)], [X(cx + 3 + kn * 0.3), Y(kneeY)]], CAMO);
  const blots: [number, number, string][] = [[-10, 5, CAMO_D], [-6, 14, CAMO_B], [-12, 22, CAMO_L], [-7, 29, CAMO_D], [7, 6, CAMO_B], [11, 15, CAMO_D], [6, 24, CAMO_L], [12, 30, CAMO_B]];
  for (const [dx, dy, col] of blots) disc(c, X(cx + dx), Y(hip + dy * (1 - cr / 60)), 2.6, 1.6, col);
  line(c, X(cx - 1), Y(hip + 2), X(cx - 2), Y(kneeY), CAMO_D);
  line(c, X(cx + 1), Y(hip + 2), X(cx + 2), Y(kneeY), CAMO_D);
  r(c, X(26), Y(100), 16, 8, BOOT); r(c, X(42), Y(100), 16, 8, BOOT);
  r(c, X(26), Y(100), 16, 1, '#3a3630'); r(c, X(42), Y(100), 16, 1, '#3a3630');
  for (const bx of [29, 33, 45, 49]) p(c, X(bx), Y(102), '#5a5650');

  // ---- Oberkörper: breite Schultern, schmale Taille
  poly(c, [[tx(20), ty(28)], [tx(64), ty(28)], [tx(71), ty(34)], [tx(67), ty(45)], [tx(56), ty(65)], [tx(28), ty(65)], [tx(17), ty(45)], [tx(13), ty(34)]], SK);
  poly(c, [[tx(60), ty(30)], [tx(64), ty(28)], [tx(71), ty(34)], [tx(67), ty(45)], [tx(56), ty(65)], [tx(52), ty(65)], [tx(60), ty(45)], [tx(63), ty(35)]], SK2);
  // Nacken und Trapez
  poly(c, [[tx(29), ty(29)], [tx(36), ty(19)], [tx(48), ty(19)], [tx(55), ty(29)]], SK);
  r(c, tx(36), ty(16), 12, 12, SK); r(c, tx(46), ty(17), 2, 11, SK2);
  line(c, tx(36), ty(20), tx(30), ty(28), SK2); line(c, tx(48), ty(20), tx(54), ty(28), SK2);
  // Schultern (Deltas)
  disc(c, tx(19), ty(35), 7.5, 7.5, SK); disc(c, tx(65), ty(35), 7.5, 7.5, SK2);
  disc(c, tx(65), ty(34), 6, 6, SK);
  disc(c, tx(17), ty(32), 3, 2, HL); disc(c, tx(63), ty(31), 2.5, 1.6, HL);
  // Brust
  disc(c, tx(33), ty(40), 9.5, 6.2, SK); disc(c, tx(51), ty(40), 9.5, 6.2, SK);
  for (let x = 24; x <= 40; x++) p(c, tx(x), ty(46 - Math.round(((x - 32) * (x - 32)) / 40)), SK3);
  for (let x = 44; x <= 60; x++) p(c, tx(x), ty(46 - Math.round(((x - 52) * (x - 52)) / 40)), SK3);
  r(c, tx(41), ty(33), 2, 14, SK2);
  r(c, tx(27), ty(35), 10, 1, HL); r(c, tx(46), ty(35), 9, 1, HL);
  // Sixpack
  r(c, tx(41), ty(48), 2, 17, SK3);
  for (let j = 0; j < 3; j++) {
    const y = 49 + j * 5;
    r(c, tx(33), ty(y - 1), 18, 1, SK2);
    r(c, tx(35), ty(y + 1), 3, 1, HL); r(c, tx(46), ty(y + 1), 3, 1, HL);
  }
  // Seiten: schräge Bauchmuskeln und Sägezahnmuskel
  for (let i = 0; i < 8; i++) { p(c, tx(29 + Math.floor(i / 2)), ty(48 + i * 2), SK2); p(c, tx(55 - Math.floor(i / 2)), ty(48 + i * 2), SK3); }
  for (const y of [41, 44, 47]) { r(c, tx(21), ty(y), 4, 1, SK2); r(c, tx(59), ty(y), 4, 1, SK3); }
  // Gürtel
  r(c, tx(28), ty(65), 28, 4, BELT); r(c, tx(39), ty(65), 6, 4, GOLD); r(c, tx(41), ty(66), 2, 2, '#a88a40');

  // ---- Arme (vor dem Körper)
  for (const side of ['L', 'R'] as const) {
    const [[ex, ey], [hx, hy]] = P[side];
    const sx = side === 'L' ? 19 : 65, sy = 35;
    const sX = tx(sx), sY = ty(sy), eX = X(ex), eY = Y(ey + cr), hX = X(hx), hY = Y(hy + cr);
    const shade = side === 'R' ? SK2 : SK;
    limb(c, sX, sY, eX, eY, 12, 10, SK);
    limb(c, eX, eY, hX, hY, 10, 8, SK);
    if (side === 'R') limb(c, sX + 2, sY + 1, eX + 2, eY, 4, 3, shade);
    // Bizeps: Wölbung in der Mitte des Oberarms, nach außen
    const mx = (sX + eX) / 2, my = (sY + eY) / 2;
    const len = Math.hypot(eX - sX, eY - sY) || 1;
    const nx = -(eY - sY) / len, ny = (eX - sX) / len;
    const outward = (side === 'L' ? -1 : 1) * Math.sign(nx || 1);
    disc(c, mx + nx * 3 * outward, my + ny * 3 * outward, 5.5, 4.5, SK);
    disc(c, mx + nx * 3.5 * outward - 1, my + ny * 3.5 * outward - 1, 2, 1.5, HL);
    p(c, Math.round(mx + nx * 4 * outward), Math.round(my + ny * 4 * outward - 2), OIL);
    // Unterarm: Ader und Schatten
    line(c, Math.round((eX + hX) / 2) - 1, Math.round((eY + hY) / 2) - 2, Math.round(hX) - 1, Math.round(hY) - 3, HL);
    // Faust
    const f = (side === 'L' ? P.fistL : P.fistR) ?? 5.5;
    disc(c, hX, hY, f, f * 0.82, SK);
    for (let k = -2; k <= 2; k++) p(c, Math.round(hX + k * (f / 3)), Math.round(hY - f * 0.5), SK2);
    disc(c, hX - f * 0.35, hY - f * 0.3, f * 0.3, f * 0.25, HL);
  }

  // ---- Hundemarke
  line(c, tx(37), ty(24), tx(42), ty(37), CHAIN);
  line(c, tx(47), ty(24), tx(42), ty(37), CHAIN);
  r(c, tx(40), ty(37), 4, 5, CHAIN); r(c, tx(41), ty(38), 2, 1, '#8a8e96');

  // ---- Ölglanz
  for (const [x, y] of [[30, 37], [53, 37], [36, 51], [47, 56], [36, 61], [17, 31], [66, 31]] as P2[]) p(c, tx(x), ty(y), OIL);

  // ---- Kopf: klein auf dem Kreuz, kantiges Kinn, Dreitagebart, Mütze
  const hxC = 42 + lean * 1.2 + (P.face === 'ouch' ? 3 : 0), hyC = 12 + cr + (P.face === 'ko' ? 4 : 0);
  const HX = (x: number) => X(hxC + x), HY = (y: number) => Y(hyC + y);
  r(c, HX(-7), HY(-6), 14, 14, SK);
  r(c, HX(-8), HY(1), 16, 7, SK);
  r(c, HX(-6), HY(8), 12, 1, SK2);
  r(c, HX(4), HY(-5), 3, 12, SK2);
  disc(c, HX(-8), HY(1), 1.5, 2.5, SK2); disc(c, HX(8), HY(1), 1.5, 2.5, SK3);
  for (let y = 4; y <= 8; y++) for (let x = -7; x <= 7; x += 2) p(c, HX(x + (y % 2)), HY(y), '#b38558');
  r(c, HX(0), HY(1), 1, 3, SK2); p(c, HX(-1), HY(3), SK2);
  r(c, HX(-8), HY(-9), 16, 6, CAP); r(c, HX(-10), HY(-4), 20, 2, BRIM); r(c, HX(-6), HY(-8), 6, 1, '#6e7a48');
  r(c, HX(-7), HY(-3), 2, 2, HAIR); r(c, HX(5), HY(-3), 2, 2, HAIR);
  switch (P.face) {
    case 'smirk':
      r(c, HX(-6), HY(-1), 4, 1, HAIR); r(c, HX(2), HY(-1), 4, 1, HAIR);
      p(c, HX(-4), HY(1), EYE); p(c, HX(4), HY(1), EYE); p(c, HX(-3), HY(1), '#ffffff');
      r(c, HX(-3), HY(6), 6, 1, LIP); p(c, HX(3), HY(5), LIP);
      break;
    case 'angry':
      line(c, HX(-6), HY(-2), HX(-2), HY(0), HAIR); line(c, HX(6), HY(-2), HX(2), HY(0), HAIR);
      p(c, HX(-4), HY(1), EYE); p(c, HX(4), HY(1), EYE);
      r(c, HX(-3), HY(5), 6, 2, TEETH); r(c, HX(-3), HY(4), 6, 1, LIP); r(c, HX(-3), HY(7), 6, 1, LIP);
      break;
    case 'grin':
      r(c, HX(-6), HY(-2), 4, 1, HAIR); r(c, HX(2), HY(-2), 4, 1, HAIR);
      r(c, HX(-5), HY(1), 3, 1, EYE); r(c, HX(3), HY(1), 3, 1, EYE);
      r(c, HX(-4), HY(5), 8, 2, TEETH); p(c, HX(-5), HY(4), LIP); p(c, HX(4), HY(4), LIP);
      break;
    case 'ouch':
      line(c, HX(-6), HY(0), HX(-2), HY(-1), HAIR); line(c, HX(6), HY(0), HX(2), HY(-1), HAIR);
      r(c, HX(-5), HY(1), 3, 1, EYE); r(c, HX(3), HY(1), 3, 1, EYE);
      disc(c, HX(0), HY(6), 1.6, 1.6, '#4a1a14');
      break;
    case 'ko':
      for (const sx of [-4, 4]) { p(c, HX(sx - 1), HY(0), EYE); p(c, HX(sx + 1), HY(2), EYE); p(c, HX(sx), HY(1), EYE); p(c, HX(sx + 1), HY(0), EYE); p(c, HX(sx - 1), HY(2), EYE); }
      for (let x = -3; x <= 3; x++) p(c, HX(x), HY(6 + (x % 2 ? 1 : 0)), LIP);
      break;
  }

  // ---- Babyöl in den Händen
  if (P.bottle) {
    r(c, X(38), Y(38 + cr), 8, 12, '#f0d040'); r(c, X(40), Y(35 + cr), 4, 3, '#c03030');
    r(c, X(39), Y(42 + cr), 6, 3, '#fff6d0'); p(c, X(39), Y(39 + cr), '#ffffff');
  }
  outline(c, ox, oy, FW, FH);
}

export function makeEmilianTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('emilBig')) return;
  const t = tex2x(scene, 'emilBig', FW * EMIL_FRAMES.length, FH, (c) => EMIL_FRAMES.forEach((k, i) => drawEmil(c, i * FW, 0, POSES[k])));
  EMIL_FRAMES.forEach((_, i) => t.add(i, 0, i * FW * 2, 0, FW * 2, FH * 2));
  // Brustbild für die Gespräche: Doppelbizeps, Ausschnitt Kopf bis Gürtel
  tex2x(scene, 'nbust_emilian', 64, 96, (c) => drawEmil(c, -10, 4, POSES.flex));
}
