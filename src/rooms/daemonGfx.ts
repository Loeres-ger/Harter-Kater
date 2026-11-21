import Phaser from 'phaser';
import { Ctx, blob, outline, p, r, rng, sideLight, strands, tex, tex2x } from '../gfx';
import { disc, limb, line, poly } from './emilianGfx';

// Nick wird zum Dämon: Verwandlungsstufen (Mensch → Teufel), der Riesendämon für den Endkampf (Oberkörper aus der
// Grube, Flügel, Hörner, Nicks Mähne, brennendes Pentagramm auf der Brust), Krallenhände aus den Rissen, Riesenfaust,
// Flammenschädel, Risse im Boden.

type P2 = [number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function mix(c1: string, c2: string, t: number) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const ch = (s: number) => Math.round(lerp((a >> s) & 255, (b >> s) & 255, t));
  return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
}
const HAIR = '#121016', HAIR2 = '#2a2836', BONE = '#e8dcc0', BONE2 = '#a89878', CLAW = '#140a0a';
const GLUT = '#ffb020', GLUT2 = '#ff5a10';

// ---------------------------------------------------------------- Verwandlung (120×150 pro Stufe)

export const MW = 120, MH = 150, WANDEL_STUFEN = 7;

/** m = 0 Nick (Mensch, schwebend, Arme ausgebreitet) … 1 fast Dämon */
function drawWandel(c: Ctx, ox: number, oy: number, m: number) {
  const X = (x: number) => ox + x, Y = (y: number) => oy + y;
  const sf = 1 + m * 0.42;
  const cx = 60, foot = 146;
  const S = (dx: number, dy: number): P2 => [X(cx + dx * sf), Y(foot - dy * sf)];
  const skin = mix('#ecdcd2', '#a81e18', Math.min(1, m * 1.2)), skin2 = mix('#cdb8ad', '#6a0e0c', Math.min(1, m * 1.2));
  const vene = m > 0.15 ? mix('#ff4020', GLUT, m) : skin2;

  // Flügel wachsen hinter dem Rücken
  if (m > 0.55) {
    const w = (m - 0.55) / 0.45;
    for (const s of [-1, 1]) {
      const sh = S(s * 12, 74);
      const tip: P2 = [sh[0] + s * 52 * w, sh[1] - 50 * w];
      const low: P2 = [sh[0] + s * 46 * w, sh[1] + 28 * w];
      poly(c, [sh, tip, [lerp(tip[0], low[0], 0.35), lerp(tip[1], low[1], 0.35) + 8 * w], [lerp(tip[0], low[0], 0.7), lerp(tip[1], low[1], 0.7) + 4 * w], low, [sh[0] + s * 8, sh[1] + 24]], '#3a0a10');
      line(c, sh[0], sh[1], tip[0], tip[1], '#6a1a1a');
      line(c, sh[0], sh[1], lerp(tip[0], low[0], 0.5), lerp(tip[1], low[1], 0.5) + 6 * w, '#5a1414');
    }
  }
  // Mähne schwebt nach oben
  const hb = S(0, 92);
  poly(c, [[hb[0] - 9 * sf, hb[1] - 4], [hb[0] + 9 * sf, hb[1] - 4], [hb[0] + (14 + m * 14) * sf, hb[1] - (8 + m * 20) * sf], [hb[0] + 12 * sf, hb[1] + 26 * sf], [hb[0] - 12 * sf, hb[1] + 26 * sf], [hb[0] - (14 + m * 14) * sf, hb[1] - (8 + m * 20) * sf]], HAIR);

  // Beine, Stiefel (bleiben dunkel)
  for (const s of [-1, 1]) {
    const hip = S(s * 6, 46), kn = S(s * (8 + m * 2), 22), ft = S(s * 9, 2);
    limb(c, hip[0], hip[1], kn[0], kn[1], 10 * sf, 8 * sf, '#1c1c24');
    limb(c, kn[0], kn[1], ft[0], ft[1], 8 * sf, 7 * sf, '#1c1c24');
    r(c, Math.round(ft[0] - 5 * sf), Math.round(ft[1] - 3), Math.round(10 * sf), Math.round(5 * sf), '#0c0a0c');
  }
  // Oberkörper: wird breiter, die Weste reißt
  const sh = 14 + m * 8;
  poly(c, [S(-sh, 76), S(sh, 76), S(sh - 3, 60), S(9, 44), S(-9, 44), S(-sh + 3, 60)], skin);
  if (m < 0.45) {
    const a = 1 - m / 0.45;
    poly(c, [S(-sh, 76), S(-4, 76), S(-4 - 2 * a, 46), S(-sh + 4, 50)], mix('#18141a', skin, 1 - a));
    poly(c, [S(sh, 76), S(4, 76), S(4 + 2 * a, 46), S(sh - 4, 50)], mix('#18141a', skin, 1 - a));
  } else {
    // Brustmuskeln, Bauch
    const pl = S(-6, 66), pr = S(6, 66);
    disc(c, pl[0], pl[1], 7 * sf, 5 * sf, skin2); disc(c, pl[0], pl[1] - 1, 6 * sf, 4 * sf, skin);
    disc(c, pr[0], pr[1], 7 * sf, 5 * sf, skin2); disc(c, pr[0], pr[1] - 1, 6 * sf, 4 * sf, skin);
    for (const yy of [56, 51]) { const a = S(-5, yy), b = S(5, yy); line(c, a[0], a[1], b[0], b[1], skin2); }
  }
  // brennendes Pentagramm auf der Brust
  const pc = S(0, 66), pr0 = 4 * sf + m * 3;
  const st: P2[] = [];
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; st.push([pc[0] + Math.cos(a) * pr0, pc[1] + Math.sin(a) * pr0]); }
  for (let i = 0; i < 5; i++) line(c, st[i][0], st[i][1], st[(i + 1) % 5][0], st[(i + 1) % 5][1], m > 0.2 ? GLUT : '#8a1a20');
  // Gürtel
  { const a = S(-10, 46), b = S(10, 46); r(c, Math.round(a[0]), Math.round(a[1] - 2), Math.round(b[0] - a[0]), 4, '#141014'); }

  // Arme: ausgebreitet, steigen mit der Verwandlung
  for (const s of [-1, 1]) {
    const shp = S(s * (sh - 2), 74), el = S(s * (sh + 12 + m * 6), 70 + m * 10), hd = S(s * (sh + 22 + m * 8), 78 + m * 22);
    limb(c, shp[0], shp[1], el[0], el[1], (7 + m * 6) * sf * 0.8, (6 + m * 5) * sf * 0.8, skin);
    limb(c, el[0], el[1], hd[0], hd[1], (6 + m * 5) * sf * 0.8, (5 + m * 4) * sf * 0.8, skin);
    disc(c, hd[0], hd[1], 3 * sf, 3 * sf, skin);
    if (m > 0.35) for (let k = -1; k <= 1; k++) line(c, hd[0] + k * 2, hd[1] - 2, hd[0] + k * 3 + s * 2, hd[1] - 6 - m * 4, CLAW);
    // Adern glühen
    if (m > 0.15) { line(c, shp[0], shp[1] + 1, el[0], el[1] + 1, vene); line(c, el[0], el[1], hd[0], hd[1], vene); }
  }
  // Hals, Kopf
  const nk = S(0, 82);
  r(c, Math.round(nk[0] - 3 * sf), Math.round(nk[1] - 2), Math.round(6 * sf), Math.round(7 * sf), skin2);
  const hd = S(0, 92);
  disc(c, hd[0], hd[1], 8 * sf, 10 * sf, skin);
  poly(c, [[hd[0] - 7 * sf, hd[1] + 2], [hd[0] + 7 * sf, hd[1] + 2], [hd[0] + 3 * sf, hd[1] + 10 * sf], [hd[0] - 3 * sf, hd[1] + 10 * sf]], skin);
  // Augen: erst rot, dann gelbe Glut
  const eyeC = m < 0.4 ? '#ff2020' : GLUT;
  r(c, Math.round(hd[0] - 6 * sf), Math.round(hd[1] - 2), Math.round(4 * sf), 2, eyeC);
  r(c, Math.round(hd[0] + 2 * sf), Math.round(hd[1] - 2), Math.round(4 * sf), 2, eyeC);
  // Mund: wird zum Maul
  const my = hd[1] + 6 * sf;
  r(c, Math.round(hd[0] - (2 + m * 3) * sf), Math.round(my - 1), Math.round((4 + m * 6) * sf), Math.round(2 + m * 4), '#3a0608');
  if (m > 0.3) for (const dx of [-2, 2]) r(c, Math.round(hd[0] + dx * sf), Math.round(my - 1), 1, Math.round(2 + m * 2), BONE);
  // Hörner wachsen aus der Stirn
  if (m > 0.2) {
    const h = (m - 0.2) / 0.8;
    for (const s of [-1, 1]) {
      const b0: P2 = [hd[0] + s * 5 * sf, hd[1] - 7 * sf];
      const b1: P2 = [b0[0] + s * 8 * h * sf, b0[1] - 6 * h * sf];
      const b2: P2 = [b1[0] + s * 4 * h * sf, b1[1] - 9 * h * sf];
      limb(c, b0[0], b0[1], b1[0], b1[1], 4 * sf, 3 * sf, BONE);
      limb(c, b1[0], b1[1], b2[0], b2[1], 3 * sf, 1, BONE2);
    }
  }
  // Haare vorne
  poly(c, [[hd[0] - 9 * sf, hd[1] - 6 * sf], [hd[0] + 9 * sf, hd[1] - 6 * sf], [hd[0] + 9 * sf, hd[1] - 2], [hd[0] - 9 * sf, hd[1] - 2]], HAIR);
  for (const s of [-1, 1]) poly(c, [[hd[0] + s * 6 * sf, hd[1] - 4], [hd[0] + s * 9 * sf, hd[1] - 4], [hd[0] + s * (12 + m * 6) * sf, hd[1] + 22 * sf - m * 10], [hd[0] + s * 7 * sf, hd[1] + 24 * sf - m * 10]], HAIR);
  outline(c, ox, oy, MW, MH);
}

// ---------------------------------------------------------------- Verwandlung in Spielgröße (26×38 pro Stufe)

export const MINI_W = 26, MINI_H = 38;
function drawWandelMini(c: Ctx, ox: number, m: number) {
  const P = (x: number, y: number, col: string) => p(c, ox + x, y, col);
  const R = (x: number, y: number, w: number, h: number, col: string) => r(c, ox + x, y, w, h, col);
  const cx = 13, fuss = 37;
  const h = Math.round(20 + m * 12);
  const top = fuss - h + 1;
  const haut = mix('#ecdcd2', '#b02018', Math.min(1, m * 1.3)), haut2 = mix('#cdb8ad', '#6a0e0c', Math.min(1, m * 1.3));
  const bein = Math.round(h * 0.34), rumpf = Math.round(h * 0.3);
  const breit = 3 + Math.round(m * 2);
  const kopfY = top + 3, kopfH = 6 + Math.round(m);
  const rumpfY = kopfY + kopfH, beinY = rumpfY + rumpf;
  // Flügel hinter dem Rücken
  if (m > 0.5) {
    const sp = Math.round((m - 0.5) * 18);
    for (let s of [-1, 1]) {
      for (let i = 0; i <= sp; i++) {
        const x = cx + s * (breit + i), y0 = rumpfY - Math.round(i * 0.7), y1 = rumpfY + 3 + Math.round(i * 0.3);
        R(Math.min(x, x), y0, 1, Math.max(1, y1 - y0), i % 3 === 0 ? '#6a1a1a' : '#3a0a10');
      }
      void s;
    }
  }
  // Haare hinten (schweben mit der Verwandlung nach oben)
  const flug = Math.round(m * 4);
  R(cx - 4, kopfY - 1 - flug, 8, kopfH + 4, HAIR);
  // Beine
  R(cx - 3, beinY, 2 + (m > 0.6 ? 1 : 0), bein, '#1c1c24');
  R(cx + 1, beinY, 2 + (m > 0.6 ? 1 : 0), bein, '#1c1c24');
  R(cx - 3, fuss - 1, 3, 2, '#0c0a0c'); R(cx + 1, fuss - 1, 3, 2, '#0c0a0c');
  // Rumpf: Weste reißt auf, darunter rote Haut mit glühendem Pentagramm
  R(cx - breit, rumpfY, breit * 2, rumpf, m < 0.45 ? '#18141a' : haut);
  R(cx - 1, rumpfY, 2, rumpf - 1, haut);
  if (m >= 0.45) { R(cx - breit, rumpfY + rumpf - 1, breit * 2, 1, haut2); P(cx - 2, rumpfY + 2, haut2); P(cx + 1, rumpfY + 2, haut2); }
  if (m > 0.2) { P(cx - 1, rumpfY + 2, GLUT); P(cx, rumpfY + 2, GLUT); P(cx, rumpfY + 1, GLUT2); P(cx - 1, rumpfY + 3, GLUT2); }
  R(cx - breit, beinY - 1, breit * 2, 1, '#101010');
  // Arme: hängen, dann breiten sie sich aus
  const hoch = m > 0.35;
  for (const s of [-1, 1]) {
    const ax = s < 0 ? cx - breit - 2 : cx + breit;
    if (!hoch) { R(ax, rumpfY, 2, rumpf, m < 0.15 ? haut : haut); R(ax, rumpfY + rumpf, 2, 1, haut2); }
    else {
      for (let i = 0; i < rumpf; i++) R(ax + s * Math.round(i * 0.6), rumpfY + Math.round(i * 0.5), 2, 1, haut);
      const hx = ax + s * Math.round(rumpf * 0.6), hy = rumpfY + Math.round(rumpf * 0.5);
      if (m > 0.4) { P(hx + (s > 0 ? 2 : -1), hy - 1, CLAW); P(hx + (s > 0 ? 2 : -1), hy + 1, CLAW); }
    }
  }
  // Kopf
  R(cx - 3, kopfY, 6 + (m > 0.5 ? 1 : 0), kopfH, haut);
  R(cx - 3, kopfY + kopfH - 1, 6, 1, haut2);
  const auge = m < 0.4 ? '#ff2020' : GLUT;
  P(cx - 2, kopfY + 2, m > 0.1 ? auge : '#2a1a1a'); P(cx + 1, kopfY + 2, m > 0.1 ? auge : '#2a1a1a');
  R(cx - 1, kopfY + 4, 2 + (m > 0.5 ? 1 : 0), 1, '#3a0608');
  if (m > 0.5) { P(cx - 1, kopfY + 5, BONE); P(cx + 1, kopfY + 5, BONE); }
  // Haare vorne
  R(cx - 4, kopfY - 1, 8, 2, HAIR); R(cx - 4, kopfY + 1, 1, kopfH + 2, HAIR); R(cx + 3, kopfY + 1, 1, kopfH + 2, HAIR);
  P(cx - 2, kopfY - 1, HAIR2); P(cx + 1, kopfY - 1, HAIR2);
  // Hörner wachsen
  if (m > 0.2) {
    const l = Math.round((m - 0.2) * 6);
    for (const s of [-1, 1]) for (let i = 0; i < l; i++) P(cx + (s < 0 ? -3 : 2) + s * Math.round(i * 0.6), kopfY - 1 - i, i < l - 1 ? BONE : BONE2);
  }
  outline(c, ox, 0, MINI_W, MINI_H);
}

// ---------------------------------------------------------------- Riesendämon (200×150, Oberkörper aus der Grube)

export const DW = 200, DH = 150;
interface DPose {
  /** Hände (Fäuste) links/rechts vom Betrachter */
  hl: P2; hr: P2;
  el: P2; er: P2;
  maul: number;
  kopf: number;
  fluegel: number;
  treffer?: boolean;
  kaputt?: boolean;
  feuer?: boolean;
}
const DPOSES: Record<string, DPose> = {
  idle: { hl: [40, 128], hr: [160, 128], el: [34, 96], er: [166, 96], maul: 0.2, kopf: 0, fluegel: 0.7 },
  atem: { hl: [42, 130], hr: [158, 130], el: [36, 98], er: [164, 98], maul: 0.35, kopf: 2, fluegel: 0.62 },
  hebe: { hl: [40, 128], hr: [176, 6], el: [34, 96], er: [178, 44], maul: 0.6, kopf: -2, fluegel: 0.8 },
  schlag: { hl: [44, 128], hr: [130, 146], el: [38, 98], er: [168, 100], maul: 0.9, kopf: 6, fluegel: 0.9 },
  bruell: { hl: [6, 64], hr: [194, 64], el: [26, 74], er: [174, 74], maul: 1, kopf: -4, fluegel: 1 },
  feuer: { hl: [52, 120], hr: [148, 120], el: [36, 92], er: [164, 92], maul: 1, kopf: 10, fluegel: 0.75, feuer: true },
  treffer: { hl: [62, 100], hr: [138, 100], el: [36, 104], er: [164, 104], maul: 0.5, kopf: -8, fluegel: 0.5, treffer: true },
  kaputt: { hl: [50, 146], hr: [150, 146], el: [40, 116], er: [160, 116], maul: 0.4, kopf: 16, fluegel: 0.3, kaputt: true },
};
export const DAEMON_FRAMES = Object.keys(DPOSES);
export const DF = Object.fromEntries(DAEMON_FRAMES.map((k, i) => [k, i])) as Record<string, number>;

const RED = '#a01c18', RED2 = '#6a0e0c', RED3 = '#4a0808', REDL = '#d0402a';

/** Kopfhöhe und Flügelspannung je Pose (für Glühschichten und bewegliche Flügel, siehe daemonFigur.ts) */
export const DKOPF = Object.fromEntries(Object.entries(DPOSES).map(([k, v]) => [k, v.kopf])) as Record<string, number>;
export const DSPANN = Object.fromEntries(Object.entries(DPOSES).map(([k, v]) => [k, v.fluegel])) as Record<string, number>;
export const DAUGEN_ZU = Object.fromEntries(Object.entries(DPOSES).map(([k, v]) => [k, !!(v.treffer || v.kaputt)])) as Record<string, boolean>;

function drawDaemon(c: Ctx, ox: number, oy: number, P: DPose, fluegel = true) {
  const X = (x: number) => ox + x, Y = (y: number) => oy + y;
  const kx = 100, ky = 36 + P.kopf;
  // Flügel (in der beweglichen Figur eigene Teile)
  if (fluegel) for (const s of [-1, 1]) {
    const sh: P2 = [X(100 + s * 34), Y(52)];
    const f = P.fluegel;
    const tip: P2 = [sh[0] + s * 92 * f, sh[1] - 50 * f];
    const r1: P2 = [sh[0] + s * 96 * f, sh[1] + 10 * f], r2: P2 = [sh[0] + s * 78 * f, sh[1] + 52 * f], r3: P2 = [sh[0] + s * 46 * f, sh[1] + 78 * f];
    poly(c, [sh, tip, [lerp(tip[0], r1[0], 0.5) - s * 8, lerp(tip[1], r1[1], 0.5)], r1, [lerp(r1[0], r2[0], 0.5) - s * 8, lerp(r1[1], r2[1], 0.5)], r2, [lerp(r2[0], r3[0], 0.5) - s * 6, lerp(r2[1], r3[1], 0.5)], r3, [sh[0] + s * 6, sh[1] + 70]], '#320810');
    for (const q of [tip, r1, r2, r3]) limb(c, sh[0], sh[1], q[0], q[1], 3, 1.5, '#5a1418');
    disc(c, tip[0], tip[1], 2, 2, BONE2);
  }
  // Mähne hinter Kopf und Schultern (Nicks Haare)
  poly(c, [[X(kx - 26), Y(ky - 14)], [X(kx + 26), Y(ky - 14)], [X(kx + 40), Y(ky + 56)], [X(kx + 22), Y(ky + 66)], [X(kx - 22), Y(ky + 66)], [X(kx - 40), Y(ky + 56)]], HAIR);
  // Oberkörper: gewaltiges V
  poly(c, [[X(48), Y(52)], [X(152), Y(52)], [X(140), Y(96)], [X(124), Y(150)], [X(76), Y(150)], [X(60), Y(96)]], RED);
  // Brust, Bauch, Schatten
  disc(c, X(80), Y(72), 22, 15, RED2); disc(c, X(80), Y(70), 20, 13, RED);
  disc(c, X(120), Y(72), 22, 15, RED2); disc(c, X(120), Y(70), 20, 13, RED);
  line(c, X(100), Y(58), X(100), Y(148), RED2);
  for (const yy of [96, 110, 124, 138]) { line(c, X(84), Y(yy), X(98), Y(yy + 1), RED2); line(c, X(102), Y(yy + 1), X(116), Y(yy), RED2); }
  line(c, X(64), Y(64), X(96), Y(60), REDL); line(c, X(104), Y(60), X(136), Y(64), REDL);
  // Brust: Licht oben links, Schatten darunter; Bauchmuskeln einzeln mit Lichtkante
  for (const bx of [80, 120]) { line(c, X(bx - 14), Y(64), X(bx - 4), Y(60), REDL); line(c, X(bx - 16), Y(83), X(bx + 14), Y(84), RED3); }
  for (const yy of [99, 113, 127]) for (const bx of [88, 105]) { line(c, X(bx), Y(yy), X(bx + 6), Y(yy), REDL); p(c, X(bx), Y(yy + 1), REDL); }
  line(c, X(70), Y(98), X(78), Y(140), RED2); line(c, X(130), Y(98), X(122), Y(140), RED2);
  // brennendes Pentagramm (Nicks Tattoo)
  const st: P2[] = [];
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; st.push([X(100) + Math.cos(a) * 15, Y(80) + Math.sin(a) * 15]); }
  for (let i = 0; i < 5; i++) { line(c, st[i][0], st[i][1], st[(i + 1) % 5][0], st[(i + 1) % 5][1], GLUT2); line(c, st[i][0] + 1, st[i][1], st[(i + 1) % 5][0] + 1, st[(i + 1) % 5][1], GLUT); }
  // Lava-Risse in der Haut
  const rnd = rng(13);
  for (let i = 0; i < 9; i++) {
    let x = 60 + rnd() * 80, y = 60 + rnd() * 80;
    for (let k = 0; k < 6; k++) { const nx = x + (rnd() - 0.5) * 8, ny = y + rnd() * 6; line(c, X(x), Y(y), X(nx), Y(ny), P.kaputt ? '#fff0c0' : GLUT2); x = nx; y = ny; }
  }
  // Arme
  for (const [sh, el, hd] of [[[56, 58], P.el, P.hl], [[144, 58], P.er, P.hr]] as [P2, P2, P2][]) {
    disc(c, X(sh[0]), Y(sh[1]), 17, 15, RED);
    limb(c, X(sh[0]), Y(sh[1]), X(el[0]), Y(el[1]), 24, 20, RED);
    limb(c, X(el[0]), Y(el[1]), X(hd[0]), Y(hd[1]), 20, 18, RED);
    line(c, X(sh[0]), Y(sh[1] + 6), X(el[0]), Y(el[1] + 4), RED2);
    line(c, X(el[0]), Y(el[1]), X(hd[0]), Y(hd[1]), RED3);
    // Faust mit Krallen
    disc(c, X(hd[0]), Y(hd[1]), 12, 10, RED2); disc(c, X(hd[0]), Y(hd[1] - 1), 11, 9, RED);
    for (let k = -2; k <= 2; k++) poly(c, [[X(hd[0] + k * 4 - 1), Y(hd[1] + 6)], [X(hd[0] + k * 4 + 2), Y(hd[1] + 6)], [X(hd[0] + k * 5), Y(hd[1] + 14)]], CLAW);
    // Adern am Unterarm glühen
    for (let k = 1; k < 4; k++) p(c, X(lerp(el[0], hd[0], k / 4) + 2), Y(lerp(el[1], hd[1], k / 4) - 2), GLUT2);
    // Nietenarmband aus Nicks Zeit, jetzt riesig
    const wx = lerp(hd[0], el[0], 0.28), wy = lerp(hd[1], el[1], 0.28);
    disc(c, X(wx), Y(wy), 11, 7, '#101010');
    for (let k = -2; k <= 2; k++) p(c, X(wx + k * 4), Y(wy - 2), '#c8ccd4');
  }
  // Knochenstacheln auf den Schultern
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const bx = 100 + s * (36 + k * 7), by = 50 + k * 3;
    poly(c, [[X(bx - 3), Y(by)], [X(bx + 3), Y(by)], [X(bx + s * 5), Y(by - 12 + k * 2)]], k === 0 ? BONE : BONE2);
  }
  // Hals, Kopf
  r(c, X(84), Y(ky + 14), 32, 20, RED2);
  // Nicks Nietenhalsband, jetzt riesig
  r(c, X(80), Y(ky + 26), 40, 6, '#101010');
  for (let k = 0; k < 6; k++) poly(c, [[X(82 + k * 7), Y(ky + 26)], [X(86 + k * 7), Y(ky + 26)], [X(84 + k * 7), Y(ky + 21)]], '#c8ccd4');
  disc(c, X(kx), Y(ky), 23, 25, RED);
  poly(c, [[X(kx - 21), Y(ky + 6)], [X(kx + 21), Y(ky + 6)], [X(kx + 11), Y(ky + 28)], [X(kx - 11), Y(ky + 28)]], RED);
  // Hörner: gewaltig, gebogen
  for (const s of [-1, 1]) {
    const pts: P2[] = [[kx + s * 14, ky - 16], [kx + s * 32, ky - 30], [kx + s * 52, ky - 32], [kx + s * 64, ky - 46], [kx + s * 62, ky - 64]];
    for (let i = 0; i < pts.length - 1; i++) limb(c, X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]), 12 - i * 2.6, 10 - i * 2.6, i < 2 ? BONE : i < 3 ? BONE2 : '#3a2a20');
    for (let i = 1; i < 4; i++) line(c, X(pts[i][0] - 2), Y(pts[i][1] + 3), X(pts[i][0] + 2), Y(pts[i][1] - 2), '#8a7a60');
  }
  // Stirnwulst, Augen
  poly(c, [[X(kx - 20), Y(ky - 8)], [X(kx + 20), Y(ky - 8)], [X(kx + 16), Y(ky - 2)], [X(kx - 16), Y(ky - 2)]], RED3);
  if (P.treffer || P.kaputt) {
    line(c, X(kx - 15), Y(ky - 1), X(kx - 6), Y(ky + 1), '#1a0404'); line(c, X(kx + 6), Y(ky + 1), X(kx + 15), Y(ky - 1), '#1a0404');
  } else {
    poly(c, [[X(kx - 16), Y(ky - 2)], [X(kx - 5), Y(ky)], [X(kx - 8), Y(ky + 3)], [X(kx - 15), Y(ky + 1)]], GLUT);
    poly(c, [[X(kx + 16), Y(ky - 2)], [X(kx + 5), Y(ky)], [X(kx + 8), Y(ky + 3)], [X(kx + 15), Y(ky + 1)]], GLUT);
    r(c, X(kx - 11), Y(ky), 3, 1, '#fff8d0'); r(c, X(kx + 8), Y(ky), 3, 1, '#fff8d0');
  }
  // Nase, Wangen
  line(c, X(kx - 3), Y(ky + 4), X(kx - 4), Y(ky + 10), RED3); line(c, X(kx + 3), Y(ky + 4), X(kx + 4), Y(ky + 10), RED3);
  line(c, X(kx - 18), Y(ky + 6), X(kx - 12), Y(ky + 16), GLUT2); line(c, X(kx + 18), Y(ky + 6), X(kx + 12), Y(ky + 16), GLUT2);
  // Maul mit Reißzähnen
  const mo = Math.round(2 + P.maul * 12);
  poly(c, [[X(kx - 13), Y(ky + 14)], [X(kx + 13), Y(ky + 14)], [X(kx + 9), Y(ky + 14 + mo)], [X(kx - 9), Y(ky + 14 + mo)]], P.feuer ? '#ffb020' : '#2a0204');
  if (P.feuer) poly(c, [[X(kx - 8), Y(ky + 16)], [X(kx + 8), Y(ky + 16)], [X(kx + 5), Y(ky + 12 + mo)], [X(kx - 5), Y(ky + 12 + mo)]], '#fff0a0');
  for (let k = -3; k <= 3; k++) {
    poly(c, [[X(kx + k * 4 - 1.5), Y(ky + 14)], [X(kx + k * 4 + 1.5), Y(ky + 14)], [X(kx + k * 4), Y(ky + 18 + (k % 3 === 0 ? 3 : 0))]], BONE);
    if (mo > 6) poly(c, [[X(kx + k * 4 - 1.5), Y(ky + 14 + mo)], [X(kx + k * 4 + 1.5), Y(ky + 14 + mo)], [X(kx + k * 4), Y(ky + 10 + mo)]], BONE);
  }
  // Haare vorne über die Schultern
  for (const s of [-1, 1]) poly(c, [[X(kx + s * 16), Y(ky - 18)], [X(kx + s * 24), Y(ky - 14)], [X(kx + s * 34), Y(ky + 50)], [X(kx + s * 22), Y(ky + 54)]], HAIR);
  poly(c, [[X(kx - 22), Y(ky - 16)], [X(kx + 22), Y(ky - 16)], [X(kx + 18), Y(ky - 22)], [X(kx - 18), Y(ky - 22)]], HAIR);
  for (let i = 0; i < 8; i++) line(c, X(kx - 20 + i * 6), Y(ky - 22), X(kx - 22 + i * 6), Y(ky - 12), HAIR2);
  if (P.kaputt) for (let i = 0; i < 14; i++) { const x = 60 + rnd() * 80, y = 20 + rnd() * 120; line(c, X(x), Y(y), X(x + (rnd() - 0.5) * 20), Y(y + rnd() * 20), '#fffbe8'); }
  outline(c, ox, oy, DW, DH);
}

/** Ein Flügel (rechts), Gelenk links bei (6, 60): wird in der Figur gedreht und gespiegelt */
export const FL_W = 100, FL_H = 136, FL_PX = 6, FL_PY = 60;
function drawFluegel(c: Ctx) {
  const sh: P2 = [FL_PX, FL_PY];
  const tip: P2 = [84, 18], r1: P2 = [88, 68], r2: P2 = [72, 104], r3: P2 = [45, 126];
  const haut = '#3a0a14', haut2 = '#2a060e';
  poly(c, [sh, tip, [86, 46], r1, [74, 88], r2, [56, 112], r3, [12, 110]], haut);
  // Membranfelder zwischen den Fingerknochen etwas dunkler, Risse
  poly(c, [sh, r1, [74, 88], r2], haut2);
  poly(c, [sh, r2, [56, 112], r3], haut);
  for (const [x, y] of [[60, 70], [50, 98], [70, 52]]) c.clearRect(x - 1, y - 1, 3, 2); // Risse in der Flughaut
  // Adern
  const rnd = rng(77);
  for (const q of [tip, r1, r2, r3]) {
    const m: P2 = [lerp(sh[0], q[0], 0.6), lerp(sh[1], q[1], 0.6)];
    for (let k = 0; k < 2; k++) line(c, m[0], m[1], m[0] + (rnd() - 0.5) * 16, m[1] + rnd() * 12, '#5a1018');
  }
  // Fingerknochen
  for (const q of [tip, r1, r2, r3]) limb(c, sh[0], sh[1], q[0], q[1], 4, 1.6, '#6a1a1e');
  limb(c, sh[0], sh[1], tip[0], tip[1], 2, 1, '#8a2a2a');
  // Kralle an der Spitze, Gelenk
  poly(c, [[tip[0] - 2, tip[1] + 2], [tip[0] + 2, tip[1] - 1], [tip[0] + 6, tip[1] - 9]], BONE);
  disc(c, sh[0], sh[1], 5, 5, '#5a1418');
  outline(c, 0, 0, FL_W, FL_H);
}

// ---------------------------------------------------------------- Texturen

export function makeDaemonTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('daemon')) return;
  const make = (key: string, w: number, h: number, draw: (c: Ctx) => void) => tex2x(scene, key, w, h, draw);
  // Körper ohne Flügel (die Flügel sind eigene, bewegliche Teile)
  const t = tex2x(scene, 'daemon', DW * DAEMON_FRAMES.length, DH, (c) => DAEMON_FRAMES.forEach((k, i) => drawDaemon(c, i * DW, 0, DPOSES[k], false)), {
    detail: (c) => { strands(c, HAIR); sideLight(c, 0.34); }, grain: 0.1,
  });
  DAEMON_FRAMES.forEach((_, i) => t.add(i, 0, i * DW * 2, 0, DW * 2, DH * 2));
  tex2x(scene, 'daemonFluegel', FL_W, FL_H, drawFluegel, { detail: (c) => sideLight(c, 0.25), grain: 0.12 });
  const w = tex2x(scene, 'wandel', MW * WANDEL_STUFEN, MH, (c) => { for (let i = 0; i < WANDEL_STUFEN; i++) drawWandel(c, i * MW, 0, i / (WANDEL_STUFEN - 1)); }, {
    detail: (c) => { strands(c, HAIR); sideLight(c, 0.2); },
  });
  for (let i = 0; i < WANDEL_STUFEN; i++) w.add(i, 0, i * MW * 2, 0, MW * 2, MH * 2);
  const mini = tex2x(scene, 'wandelMini', MINI_W * WANDEL_STUFEN, MINI_H, (c) => { for (let i = 0; i < WANDEL_STUFEN; i++) drawWandelMini(c, i * MINI_W, i / (WANDEL_STUFEN - 1)); }, {
    detail: (c) => { strands(c, HAIR); sideLight(c, 0.2); },
  });
  for (let i = 0; i < WANDEL_STUFEN; i++) mini.add(i, 0, i * MINI_W * 2, 0, MINI_W * 2, MINI_H * 2);

  // Krallenhand aus dem Riss (zwei Bilder: offen, zupacken)
  const hand = (c: Ctx, ox: number, zu: boolean) => {
    limb(c, ox + 14, 46, ox + 14, 22, 10, 9, RED);
    line(c, ox + 12, 44, ox + 12, 24, RED2);
    disc(c, ox + 14, 18, 9, 7, RED);
    const fs: [number, number][] = zu ? [[-8, 10], [-3, 6], [3, 6], [8, 10]] : [[-12, 2], [-5, -4], [5, -4], [12, 2]];
    for (const [dx, dy] of fs) {
      limb(c, ox + 14 + dx * 0.4, 14, ox + 14 + dx, 14 + dy - 6, 3.4, 2.6, RED);
      poly(c, [[ox + 13 + dx, 10 + dy - 6], [ox + 16 + dx, 10 + dy - 6], [ox + 14 + dx + (dx > 0 ? 2 : -2), 3 + dy - 6 + (zu ? 8 : 0)]], CLAW);
    }
    limb(c, ox + 6, 22, ox + 1, 14, 3.4, 2.6, RED);
    line(c, ox + 10, 30, ox + 18, 34, GLUT2);
    outline(c, ox, 0, 28, 48);
  };
  const h = tex2x(scene, 'daemonHand', 56, 48, (c) => { hand(c, 0, false); hand(c, 28, true); });
  h.add(0, 0, 0, 0, 56, 96); h.add(1, 0, 56, 0, 56, 96);
  // Riesenfaust von oben
  make('daemonFaust', 64, 56, (c) => {
    limb(c, 32, 0, 32, 20, 30, 28, RED);
    line(c, 24, 0, 24, 20, RED2);
    disc(c, 32, 34, 26, 20, RED2); disc(c, 32, 32, 24, 18, RED);
    for (let k = -1; k <= 2; k++) { line(c, 32 + k * 10 - 5, 40, 32 + k * 10 - 5, 50, RED3); }
    for (let k = -2; k <= 2; k++) poly(c, [[30 + k * 9, 46], [35 + k * 9, 46], [32 + k * 10, 55]], CLAW);
    disc(c, 32, 10, 15, 6, '#101010'); for (let k = -3; k <= 3; k++) p(c, 32 + k * 4, 8, '#c8ccd4');
    line(c, 14, 28, 26, 36, GLUT2); line(c, 40, 24, 50, 30, GLUT2);
    outline(c, 0, 0, 64, 56);
  });
  // Flammenschädel (zwei Bilder für das Flackern)
  const schaedel = (c: Ctx, ox: number, f: number) => {
    for (let i = 0; i < 6; i++) disc(c, ox + 8 + (i % 3) - 1, 4 + i * 0.6 - f, 5 - i * 0.5, 4, i < 3 ? GLUT2 : GLUT);
    disc(c, ox + 8, 10, 6, 5.5, BONE);
    r(c, ox + 4, 9, 3, 3, '#1a0404'); r(c, ox + 9, 9, 3, 3, '#1a0404');
    p(c, ox + 5, 10, '#ff3010'); p(c, ox + 10, 10, '#ff3010');
    r(c, ox + 5, 14, 6, 2, BONE2); for (let k = 0; k < 3; k++) p(c, ox + 6 + k * 2, 15, '#1a0404');
  };
  const sk = tex2x(scene, 'schaedel', 32, 18, (c) => { schaedel(c, 0, 0); schaedel(c, 16, 2); });
  sk.add(0, 0, 0, 0, 32, 36); sk.add(1, 0, 32, 0, 32, 36);
  // Risse im Kellerboden nach der Verwandlung (Draufsicht)
  make('wandlungRisse', 96, 64, (c) => {
    const rnd = rng(66);
    const st: P2[] = [];
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5; st.push([48 + Math.cos(a) * 24, 32 + Math.sin(a) * 16]); }
    for (let k = 0; k < 5; k++) line(c, st[k][0], st[k][1], st[(k + 1) % 5][0], st[(k + 1) % 5][1], '#f0e8e0');
    for (let a = 0; a < Math.PI * 2; a += 0.04) p(c, Math.round(48 + Math.cos(a) * 27), Math.round(32 + Math.sin(a) * 19), '#f0e8e0');
    for (let i = 0; i < 8; i++) {
      let x = 48, y = 32;
      const ang = (i / 8) * Math.PI * 2 + rnd() * 0.4;
      for (let k = 0; k < 14; k++) {
        const nx = x + Math.cos(ang) * 3.2 + (rnd() - 0.5) * 3, ny = y + Math.sin(ang) * 2.2 + (rnd() - 0.5) * 2;
        line(c, x, y, nx, ny, '#0a0204'); line(c, x, y + 1, nx, ny + 1, '#ff3a10');
        x = nx; y = ny;
      }
    }
  });
  // Endkampf: Horsts Barhocker (Waffe), Koks-Kristalle (Schild des Dämons), Bierkiste (Herz zurück)
  make('hocker', 8, 10, (c) => {
    r(c, 1, 0, 6, 2, '#c02424'); r(c, 1, 0, 3, 1, '#e05040'); r(c, 0, 1, 8, 1, '#8a1818');
    r(c, 3, 2, 2, 5, '#b8bcc4'); p(c, 3, 2, '#e8ecf0');
    r(c, 1, 6, 6, 1, '#8a8e96');
    p(c, 1, 7, '#9a9ea6'); p(c, 0, 8, '#9a9ea6'); p(c, 0, 9, '#7a7e86');
    p(c, 6, 7, '#9a9ea6'); p(c, 7, 8, '#9a9ea6'); p(c, 7, 9, '#7a7e86');
    outline(c, 0, 0, 8, 10);
  });
  make('kristall', 16, 22, (c) => {
    const spitze = (x: number, y0: number, h: number, w: number, a: string, b: string) => {
      poly(c, [[x - w, y0], [x + w, y0], [x + w * 0.4, y0 - h], [x - w * 0.2, y0 - h - 2]], a);
      poly(c, [[x, y0], [x + w, y0], [x + w * 0.4, y0 - h]], b);
    };
    blob(c, 8, 20, 7, 2, 'rgba(0,0,0,0.4)');
    spitze(4, 20, 10, 2.5, '#e8f0ff', '#a8b8e0');
    spitze(12, 20, 12, 2.5, '#e8f0ff', '#a8b8e0');
    spitze(8, 20, 17, 3.5, '#ffffff', '#c0d0f0');
    line(c, 8, 17, 8, 8, '#ff4030'); line(c, 7, 13, 9, 13, '#ff4030');
    p(c, 7, 6, '#ffffff'); p(c, 3, 13, '#ffffff');
  });
  make('bierkiste', 14, 12, (c) => {
    r(c, 0, 4, 14, 8, '#c8a020'); r(c, 0, 4, 14, 1, '#e8c840'); r(c, 0, 11, 14, 1, '#8a6a10');
    for (let i = 0; i < 4; i++) { r(c, 1 + i * 3, 0, 2, 5, '#5a3a14'); p(c, 1 + i * 3, 0, '#e8d8a0'); }
    r(c, 4, 7, 6, 2, '#a01818');
  });

  // Bühnenboden der Arena: Lava-Kachel
  tex(scene, 'lava', 16, 16, (c) => {
    const rnd = rng(5);
    r(c, 0, 0, 16, 16, '#5a0a04');
    for (let i = 0; i < 26; i++) r(c, Math.floor(rnd() * 15), Math.floor(rnd() * 15), 2, 2, rnd() < 0.5 ? '#ff5a10' : '#ffb020');
    for (let i = 0; i < 6; i++) r(c, Math.floor(rnd() * 15), Math.floor(rnd() * 15), 1, 1, '#fff0a0');
  });
}
