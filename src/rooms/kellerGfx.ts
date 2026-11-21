import Phaser from 'phaser';
import { Ctx, blob, eyeShine, folds, outline, p, r, rng, sideLight, strands, tex, tex2x } from '../gfx';
import { Look, personSheet } from './clubGfx';
import { disc, limb, line, poly } from './emilianGfx';

// Nicks Keller: Kacheln, Bühne, Verstärker, Poster, Publikum (Goths, Emos, Metaller, Rocker) und Nick selbst:
// als Laufgrafik, in groß mit Gitarre (Duell, Zwischensequenzen) und als Brustbild – als Metal-Satanist und später
// clean in Weiß. Gleiches Gesicht, damit man ihn wiedererkennt.

const T = 16;
type P2 = [number, number];

function speckle(c: Ctx, cols: string[], n: number, seed: number, w = T, h = T, x0 = 0, y0 = 0) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) p(c, x0 + Math.floor(rnd() * w), y0 + Math.floor(rnd() * h), cols[Math.floor(rnd() * cols.length)]);
}

// ---------------------------------------------------------------- Farben

interface NickPal {
  skin: string; skin2: string; skin3: string;
  hair: string; hair2: string;
  top: string; top2: string; chest: boolean;
  pants: string; pants2: string; boot: string; lace: string;
  belt: string; stud: string;
  guit: string; guit2: string; neck: string; trim: string;
  ink: boolean; metal: boolean;
}
const METAL: NickPal = {
  skin: '#ecdcd2', skin2: '#cdb8ad', skin3: '#a89086', hair: '#121016', hair2: '#2a2836',
  top: '#18141a', top2: '#2c2630', chest: true, pants: '#1c1c24', pants2: '#2e2e3a', boot: '#0c0a0c', lace: '#c01818',
  belt: '#141014', stud: '#c8ccd4', guit: '#b81818', guit2: '#5a0808', neck: '#2a1a12', trim: '#101010', ink: true, metal: true,
};
const WEISS: NickPal = {
  skin: '#ecdcd2', skin2: '#cdb8ad', skin3: '#a89086', hair: '#121016', hair2: '#2a2836',
  top: '#f4f2ec', top2: '#d6d4cc', chest: false, pants: '#f0eee8', pants2: '#d2d0c8', boot: '#fafaf6', lace: '#e8e6e0',
  belt: '#f0eee8', stud: '#d8b850', guit: '#f6f4ee', guit2: '#c8a848', neck: '#e8dcc0', trim: '#d8b850', ink: false, metal: false,
};
const INK = '#3a3046', INKR = '#8a1a20', SILVER = '#c8ccd4', STRING = '#e0e4ea';

// ---------------------------------------------------------------- Nick in groß (80×112 pro Bild)

export const NFW = 80, NFH = 112;
type Mund = 'zu' | 'grins' | 'schrei' | 'schnoesel';
interface NPose {
  /** Gitarrenwinkel zusätzlich zur Grundhaltung */
  ga: number;
  /** Schlaghand 0 = oben, 1 = unten */
  strum: number;
  /** Greifhand entlang des Halses */
  fret: number;
  /** Kopf nach vorn, Haare fallen übers Gesicht */
  bang: number;
  /** Haare schwingen */
  sway: number;
  mund: Mund;
  horns?: boolean;
  lean?: number;
  rot?: boolean;
}
const NPOSES: Record<string, NPose> = {
  idle: { ga: 0, strum: 0.3, fret: 0.35, bang: 0, sway: 0, mund: 'grins' },
  shred1: { ga: -0.1, strum: 0, fret: 0.6, bang: 0.15, sway: 0.8, mund: 'schrei' },
  shred2: { ga: 0.07, strum: 1, fret: 0.25, bang: 0.1, sway: -0.8, mund: 'zu' },
  bang: { ga: 0.14, strum: 0.8, fret: 0.4, bang: 1, sway: 0, mund: 'schrei' },
  horns: { ga: 0.32, strum: 0.5, fret: 0, bang: 0, sway: 0.3, mund: 'schrei', horns: true },
  rage: { ga: -0.5, strum: 0.2, fret: 0.75, bang: 0, sway: -0.5, mund: 'schrei', rot: true, lean: -2 },
  schnoesel: { ga: 0.05, strum: 0.4, fret: 0.3, bang: 0, sway: 0, mund: 'schnoesel' },
};
export const NICK_FRAMES = Object.keys(NPOSES);
export const NF = Object.fromEntries(NICK_FRAMES.map((k, i) => [k, i])) as Record<string, number>;

function drawNick(c: Ctx, ox: number, oy: number, P: NPose, C: NickPal) {
  const X = (x: number) => ox + x, Y = (y: number) => oy + y;
  const lean = P.lean ?? 0;
  const hx = 40 + lean + P.bang * 2, hy = 17 + P.bang * 6;
  const sw = P.sway * 4;

  // Haare hinten (lang bis über die Schulterblätter); clean: glatt nach hinten, kurzer Zopf
  if (C.metal) poly(c, [[X(hx - 9), Y(hy - 6)], [X(hx + 9), Y(hy - 6)], [X(hx + 13 + sw), Y(52)], [X(hx - 13 + sw), Y(52)]], C.hair);
  else limb(c, X(hx + 6), Y(hy), X(hx + 9), Y(hy + 16), 4, 3, C.hair);

  // Beine, Stiefel
  limb(c, X(35), Y(64), X(31), Y(102), 10, 8, C.pants);
  limb(c, X(46), Y(64), X(50), Y(102), 10, 8, C.pants);
  line(c, X(36), Y(70), X(33), Y(98), C.pants2);
  line(c, X(47), Y(70), X(50), Y(98), C.pants2);
  if (C.metal) { r(c, X(30), Y(82), 4, 2, C.skin2); r(c, X(48), Y(86), 3, 1, C.skin2); } // Risse in der Jeans
  r(c, X(26), Y(100), 11, 9, C.boot); r(c, X(45), Y(100), 11, 9, C.boot);
  r(c, X(25), Y(107), 13, 2, C.metal ? '#2a2a2a' : '#e0ded8'); r(c, X(44), Y(107), 13, 2, C.metal ? '#2a2a2a' : '#e0ded8');
  for (let y = 101; y < 106; y += 2) { r(c, X(29), Y(y), 4, 1, C.lace); r(c, X(48), Y(y), 4, 1, C.lace); }

  // Oberkörper
  const tL = 26 + lean, tR = 54 + lean;
  poly(c, [[X(tL), Y(32)], [X(tR), Y(32)], [X(tR - 2), Y(50)], [X(tR - 6), Y(66)], [X(tL + 6), Y(66)], [X(tL + 2), Y(50)]], C.top);
  if (C.chest) {
    // offene Lederweste: blasse Brust mit Pentagramm-Tattoo
    poly(c, [[X(35 + lean), Y(32)], [X(45 + lean), Y(32)], [X(43 + lean), Y(64)], [X(37 + lean), Y(64)]], C.skin);
    line(c, X(40 + lean), Y(48), X(40 + lean), Y(62), C.skin2);
    for (const yy of [52, 56, 60]) line(c, X(38 + lean), Y(yy), X(42 + lean), Y(yy), C.skin2);
    const sx = 40 + lean, sy = 41, star: P2[] = [];
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; star.push([sx + Math.cos(a) * 3.5, sy + Math.sin(a) * 3.5]); }
    for (let i = 0; i < 5; i++) line(c, X(star[i][0]), Y(star[i][1]), X(star[(i + 1) % 5][0]), Y(star[(i + 1) % 5][1]), INKR);
    line(c, X(tL + 3), Y(34), X(tL + 6), Y(62), C.top2); line(c, X(tR - 3), Y(34), X(tR - 6), Y(62), C.top2);
    for (let y = 36; y < 62; y += 5) { p(c, X(35 + lean), Y(y), SILVER); p(c, X(45 + lean), Y(y), SILVER); }
  } else {
    // weißer Anzug: Hemd, Revers, goldene Nadel
    poly(c, [[X(37 + lean), Y(32)], [X(43 + lean), Y(32)], [X(41 + lean), Y(50)], [X(39 + lean), Y(50)]], '#ffffff');
    line(c, X(36 + lean), Y(32), X(39 + lean), Y(52), C.top2); line(c, X(44 + lean), Y(32), X(41 + lean), Y(52), C.top2);
    r(c, X(39 + lean), Y(33), 2, 5, '#d8d8e0');
    p(c, X(32 + lean), Y(38), C.stud); p(c, X(33 + lean), Y(38), C.stud);
    for (const yy of [54, 59]) p(c, X(40 + lean), Y(yy), '#c8c6be');
  }
  // Gürtel
  r(c, X(tL + 6), Y(62), tR - tL - 12, 4, C.belt);
  for (let x = tL + 7; x < tR - 6; x += 3) p(c, X(x), Y(63), C.stud);
  r(c, X(38 + lean), Y(62), 4, 4, C.stud);

  // Gitarre: Flying-V (clean: weiß mit Gold), um den Korpus gedreht
  const B: P2 = [33 + lean, 68];
  const th = -0.6 + P.ga, cs = Math.cos(th), sn = Math.sin(th);
  const G = (x: number, y: number): P2 => [X(B[0] + x * cs - y * sn), Y(B[1] + x * sn + y * cs)];
  const body: P2[] = [[9, -2], [9, 2], [-17, 14], [-21, 11], [-6, 1.5], [-6, -1.5], [-22, -9], [-19, -12]];
  poly(c, body.map(([x, y]) => G(x, y)), C.guit);
  poly(c, [[7, -1], [7, 1], [-15, 12], [-17, 11]].map(([x, y]) => G(x, y) as P2), C.guit2);
  poly(c, [[7, -1], [7, 1], [-18, -10], [-17, -11]].map(([x, y]) => G(x, y) as P2), C.guit2);
  for (const px of [-3, 2]) { const a = G(px, -2), b = G(px + 2, 2); r(c, Math.min(a[0], b[0]), Math.min(a[1], b[1]), 3, 3, C.trim); }
  const n0 = G(9, 0), n1 = G(42, 0);
  limb(c, n0[0], n0[1], n1[0], n1[1], 3, 3, C.neck);
  for (let k = 14; k < 42; k += 5) { const a = G(k, -1.5), b = G(k, 1.5); line(c, a[0], a[1], b[0], b[1], C.metal ? '#a8a8a8' : '#b89838'); }
  poly(c, [[42, -2], [51, -5], [50, 2], [42, 2]].map(([x, y]) => G(x, y) as P2), C.metal ? '#101010' : C.guit2);
  const s0 = G(-8, 0), s1 = G(44, 0);
  line(c, s0[0], s0[1], s1[0], s1[1], STRING);

  // Arme: Schlagarm (rechts vom Betrachter aus links), Greifarm
  const shL: P2 = [X(28 + lean), Y(35)], shR: P2 = [X(52 + lean), Y(35)];
  const hS = G(-3, -6 + P.strum * 11);
  const eS: P2 = [shL[0] - 7, (shL[1] + hS[1]) / 2 + 4];
  const arm = C.metal ? C.skin : C.top;
  limb(c, shL[0], shL[1], eS[0], eS[1], 7, 6, arm);
  limb(c, eS[0], eS[1], hS[0], hS[1], 6, 5, arm);
  let hF: P2, eF: P2;
  if (P.horns) {
    eF = [shR[0] + 9, shR[1] - 12];
    hF = [shR[0] + 6, shR[1] - 27];
  } else {
    hF = G(9 + P.fret * 30, -2.5);
    eF = [(shR[0] + hF[0]) / 2 + 6, (shR[1] + hF[1]) / 2 + 7];
  }
  limb(c, shR[0], shR[1], eF[0], eF[1], 7, 6, arm);
  limb(c, eF[0], eF[1], hF[0], hF[1], 6, 5, arm);
  if (C.ink) {
    // Tattoo-Ärmel: Ranken und rote Akzente entlang der Arme
    for (const [a, b] of [[shL, eS], [eS, hS], [shR, eF], [eF, hF]] as [P2, P2][]) {
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]));
      for (let i = 1; i < n - 2; i += 2) {
        const t = i / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        p(c, Math.round(x + ((i * 7) % 3) - 1), Math.round(y + ((i * 5) % 3) - 1), i % 6 === 1 ? INKR : INK);
      }
    }
    // Nietenarmbänder
    for (const [h, e] of [[hS, eS], [hF, eF]] as [P2, P2][]) {
      const wx = h[0] + (e[0] - h[0]) * 0.3, wy = h[1] + (e[1] - h[1]) * 0.3;
      disc(c, wx, wy, 3, 2.4, '#101010');
      p(c, Math.round(wx - 2), Math.round(wy), SILVER); p(c, Math.round(wx), Math.round(wy - 2), SILVER); p(c, Math.round(wx + 2), Math.round(wy), SILVER);
    }
  } else {
    // Manschetten
    for (const [h, e] of [[hS, eS], [hF, eF]] as [P2, P2][]) disc(c, h[0] + (e[0] - h[0]) * 0.25, h[1] + (e[1] - h[1]) * 0.25, 2.6, 2.2, '#ffffff');
  }
  disc(c, hS[0], hS[1], 2.6, 2.4, C.skin);
  disc(c, hF[0], hF[1], 2.6, 2.4, C.skin);
  if (P.horns) {
    // Teufelshörner: Zeigefinger und kleiner Finger hoch
    r(c, Math.round(hF[0] - 2), Math.round(hF[1] - 6), 1, 5, C.skin); r(c, Math.round(hF[0] + 2), Math.round(hF[1] - 6), 1, 5, C.skin);
  }

  // Hals, Kopf
  r(c, X(37 + lean), Y(25 + P.bang * 4), 6, 9, C.skin2);
  if (C.metal) for (let x = 36; x < 45; x += 2) p(c, X(x + lean), Y(31), SILVER); // Nietenhalsband
  disc(c, X(hx), Y(hy), 8, 10, C.skin);
  poly(c, [[X(hx - 7), Y(hy + 2)], [X(hx + 7), Y(hy + 2)], [X(hx + 3), Y(hy + 10)], [X(hx - 3), Y(hy + 10)]], C.skin);
  if (P.bang < 0.6) {
    const ey = Math.round(hy - 1);
    if (C.metal) { r(c, X(hx - 6), Y(ey - 1), 5, 3, '#1a1018'); r(c, X(hx + 1), Y(ey - 1), 5, 3, '#1a1018'); }
    const pup = P.rot ? '#ff2020' : C.metal ? '#c8c8d0' : '#3a4a6a';
    if (P.mund === 'schnoesel') {
      // halb geschlossene Augen, eine Braue oben
      r(c, X(hx - 5), Y(ey), 3, 1, '#2a2020'); r(c, X(hx + 2), Y(ey), 3, 1, '#2a2020');
      r(c, X(hx + 2), Y(ey - 4), 4, 1, C.hair);
      r(c, X(hx - 6), Y(ey - 3), 4, 1, C.hair);
    } else {
      r(c, X(hx - 5), Y(ey), 3, 1, '#f4f0ec'); r(c, X(hx + 2), Y(ey), 3, 1, '#f4f0ec');
      p(c, X(hx - 4), Y(ey), pup); p(c, X(hx + 3), Y(ey), pup);
      const brow = P.mund === 'schrei' || P.rot ? 1 : 0;
      line(c, X(hx - 6), Y(ey - 3 + brow), X(hx - 2), Y(ey - 3 - brow + 1), C.hair);
      line(c, X(hx + 6), Y(ey - 3 + brow), X(hx + 2), Y(ey - 3 - brow + 1), C.hair);
    }
    line(c, X(hx), Y(ey + 1), X(hx), Y(ey + 4), C.skin3);
    const my = ey + 6;
    if (P.mund === 'schrei') { r(c, X(hx - 2), Y(my - 1), 5, 4, '#4a0a10'); r(c, X(hx - 2), Y(my - 1), 5, 1, '#f0ece4'); }
    else if (P.mund === 'grins') { line(c, X(hx - 2), Y(my), X(hx + 2), Y(my - 1), '#5a2a2a'); }
    else if (P.mund === 'schnoesel') { line(c, X(hx - 1), Y(my), X(hx + 2), Y(my - 1), '#8a5a5a'); }
    else r(c, X(hx - 1), Y(my), 3, 1, '#5a2a2a');
    if (C.metal) { p(c, X(hx + 5), Y(ey - 4), SILVER); p(c, X(hx + 1), Y(ey + 4), SILVER); p(c, X(hx - 2), Y(my + 1), SILVER); p(c, X(hx + 2), Y(my + 1), SILVER); }
  }

  // Haare vorne
  if (C.metal) {
    poly(c, [[X(hx - 9), Y(hy - 8)], [X(hx + 9), Y(hy - 8)], [X(hx + 9), Y(hy - 3)], [X(hx - 9), Y(hy - 3)]], C.hair);
    disc(c, X(hx), Y(hy - 6), 9, 5, C.hair);
    if (P.bang >= 0.6) {
      // Headbang: die Mähne fällt nach vorne über Gesicht und Brust
      poly(c, [[X(hx - 9), Y(hy - 6)], [X(hx + 9), Y(hy - 6)], [X(hx + 11), Y(hy + 24)], [X(hx + 3), Y(hy + 28)], [X(hx - 4), Y(hy + 27)], [X(hx - 11), Y(hy + 22)]], C.hair);
    } else {
      poly(c, [[X(hx - 9), Y(hy - 5)], [X(hx - 6), Y(hy - 5)], [X(hx - 7 + sw), Y(hy + 26)], [X(hx - 12 + sw), Y(hy + 24)]], C.hair);
      poly(c, [[X(hx + 6), Y(hy - 5)], [X(hx + 9), Y(hy - 5)], [X(hx + 12 + sw), Y(hy + 24)], [X(hx + 7 + sw), Y(hy + 26)]], C.hair);
    }
    for (let i = 0; i < 6; i++) line(c, X(hx - 7 + i * 3), Y(hy - 9), X(hx - 8 + i * 3 + sw * 0.5), Y(hy - 3), C.hair2);
  } else {
    // wie geleckt: glatt nach hinten, Glanzlicht
    disc(c, X(hx), Y(hy - 5), 8.5, 5.5, C.hair);
    r(c, X(hx - 8), Y(hy - 5), 2, 5, C.hair); r(c, X(hx + 7), Y(hy - 5), 2, 5, C.hair);
    line(c, X(hx - 4), Y(hy - 9), X(hx + 4), Y(hy - 8), '#5a5a6e');
    line(c, X(hx - 5), Y(hy - 7), X(hx + 5), Y(hy - 6), C.hair2);
  }
  outline(c, ox, oy, NFW, NFH);
}

/** Brustbild 64×96 für Gespräche und Zwischensequenzen */
function drawNickBust(c: Ctx, C: NickPal, mood: 'normal' | 'wut' | 'schnoesel') {
  const cx = 32;
  if (C.metal) poly(c, [[14, 16], [50, 16], [56, 84], [8, 84]], C.hair);
  else limb(c, 44, 30, 48, 52, 5, 4, C.hair);
  // Schultern und Oberkörper
  poly(c, [[2, 96], [5, 72], [18, 62], [46, 62], [59, 72], [62, 96]], C.top);
  if (C.chest) {
    r(c, 4, 66, 10, 14, C.skin); r(c, 50, 66, 10, 14, C.skin);
    for (const [x, y, col] of [[6, 68, INK], [9, 71, INKR], [7, 75, INK], [11, 77, INK], [52, 69, INK], [55, 73, INKR], [57, 70, INK], [53, 77, INK]] as const) r(c, x, y, 2, 2, col);
    poly(c, [[24, 62], [40, 62], [37, 96], [27, 96]], C.skin);
    const star: P2[] = [];
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; star.push([32 + Math.cos(a) * 6, 80 + Math.sin(a) * 6]); }
    for (let i = 0; i < 5; i++) line(c, star[i][0], star[i][1], star[(i + 1) % 5][0], star[(i + 1) % 5][1], INKR);
    for (let y = 66; y < 96; y += 6) { p(c, 24, y, SILVER); p(c, 40, y, SILVER); }
  } else {
    poly(c, [[27, 62], [37, 62], [34, 90], [30, 90]], '#ffffff');
    line(c, 25, 62, 31, 92, C.top2); line(c, 39, 62, 33, 92, C.top2);
    r(c, 30, 63, 4, 9, '#dcdce4');
    r(c, 16, 74, 2, 2, C.stud);
  }
  // Hals
  r(c, 26, 48, 12, 16, C.skin2);
  if (C.metal) { r(c, 25, 56, 14, 3, '#101010'); for (let x = 26; x < 39; x += 3) p(c, x, 57, SILVER); }
  else { r(c, 24, 58, 16, 3, '#ffffff'); }
  // Kopf
  disc(c, cx, 32, 12, 15, C.skin);
  poly(c, [[cx - 11, 36], [cx + 11, 36], [cx + 5, 50], [cx - 5, 50]], C.skin);
  r(c, cx - 11, 34, 2, 6, C.skin2); r(c, cx + 9, 34, 2, 6, C.skin2);
  // Augen
  const ey = 32;
  if (C.metal) { r(c, cx - 10, ey - 2, 8, 5, '#1a1018'); r(c, cx + 2, ey - 2, 8, 5, '#1a1018'); r(c, cx - 9, ey + 3, 5, 1, '#3a2a3a'); r(c, cx + 4, ey + 3, 5, 1, '#3a2a3a'); }
  const pup = mood === 'wut' ? '#ff2020' : C.metal ? '#b8b8c8' : '#3a4a6a';
  if (mood === 'schnoesel') {
    r(c, cx - 8, ey, 5, 2, '#f4f0ec'); r(c, cx + 3, ey, 5, 2, '#f4f0ec');
    r(c, cx - 8, ey - 1, 5, 1, C.skin3); r(c, cx + 3, ey - 1, 5, 1, C.skin3);
    p(c, cx - 6, ey + 1, pup); p(c, cx + 5, ey + 1, pup);
    line(c, cx - 9, ey - 5, cx - 3, ey - 4, C.hair); line(c, cx + 3, ey - 6, cx + 9, ey - 7, C.hair);
  } else {
    r(c, cx - 8, ey, 5, 2, '#f4f0ec'); r(c, cx + 3, ey, 5, 2, '#f4f0ec');
    r(c, cx - 6, ey, 2, 2, pup); r(c, cx + 4, ey, 2, 2, pup);
    if (mood === 'wut') { line(c, cx - 9, ey - 6, cx - 3, ey - 3, C.hair); line(c, cx + 9, ey - 6, cx + 3, ey - 3, C.hair); }
    else { line(c, cx - 9, ey - 5, cx - 3, ey - 4, C.hair); line(c, cx + 3, ey - 4, cx + 9, ey - 5, C.hair); }
  }
  // Nase, Wangenknochen
  line(c, cx, ey + 3, cx + 1, ey + 9, C.skin3); p(c, cx - 1, ey + 10, C.skin3);
  line(c, cx - 9, ey + 8, cx - 6, ey + 11, C.skin2); line(c, cx + 9, ey + 8, cx + 6, ey + 11, C.skin2);
  // Mund
  const my = 45;
  if (mood === 'wut') { r(c, cx - 4, my - 2, 9, 6, '#4a0a10'); r(c, cx - 4, my - 2, 9, 1, '#f0ece4'); r(c, cx - 2, my + 3, 5, 1, '#f0ece4'); }
  else if (mood === 'schnoesel') { line(c, cx - 3, my, cx + 4, my - 1, '#9a6a6a'); p(c, cx + 4, my - 2, '#9a6a6a'); }
  else { line(c, cx - 4, my, cx + 4, my - 1, '#5a2a2a'); p(c, cx + 4, my - 2, '#5a2a2a'); }
  if (C.metal) {
    // Piercings: Braue, Nase, Lippe, Ohren
    p(c, cx + 9, ey - 5, SILVER); p(c, cx + 9, ey - 3, SILVER);
    p(c, cx + 2, ey + 10, SILVER);
    p(c, cx - 3, my + 1, SILVER); p(c, cx + 3, my + 1, SILVER);
    r(c, cx - 13, 40, 1, 3, SILVER); r(c, cx + 12, 40, 1, 3, SILVER);
  }
  // Haare vorne
  if (C.metal) {
    disc(c, cx, 21, 13, 8, C.hair);
    poly(c, [[cx - 13, 20], [cx - 8, 20], [cx - 9, 70], [cx - 16, 68]], C.hair);
    poly(c, [[cx + 8, 20], [cx + 13, 20], [cx + 16, 68], [cx + 9, 70]], C.hair);
    line(c, cx, 14, cx - 1, 24, C.hair2);
    for (let i = 0; i < 4; i++) { line(c, cx - 12 + i * 2, 24, cx - 14 + i * 2, 64, C.hair2); line(c, cx + 9 + i * 2, 24, cx + 11 + i * 2, 64, C.hair2); }
  } else {
    disc(c, cx, 22, 12.5, 8, C.hair);
    r(c, cx - 12, 22, 2, 8, C.hair); r(c, cx + 11, 22, 2, 8, C.hair);
    line(c, cx - 8, 16, cx + 8, 17, '#5a5a6e');
    for (let i = 0; i < 5; i++) line(c, cx - 9 + i * 4, 15, cx - 6 + i * 4, 26, C.hair2);
  }
  outline(c, 0, 0, 64, 96);
}

// ---------------------------------------------------------------- Publikum

export const KELLER_LOOKS: Record<string, Look> = {
  goth: { skin: '#ecdcd4', skinD: '#cbb8ae', hair: '#0e0c10', hairStyle: 'long', top: '#151218', top2: '#3a0a1a', bottom: '#151218', skirt: true, legs: '#2a2030', shoes: '#0a0a0a', lips: '#4a0a3a' },
  gothM: { skin: '#e8d8d0', skinD: '#c8b4aa', hair: '#0e0c10', hairStyle: 'long', top: '#141216', top2: '#0c0a0e', sleeves: true, bottom: '#141216', belt: '#c8ccd4', shoes: '#0a0a0a' },
  emo: { skin: '#f0d0bc', skinD: '#d0ae9a', hair: '#121014', hairStyle: 'bob', top: '#1a1a22', top2: '#ff4aa0', sleeves: true, bottom: '#26263a', shoes: '#e8e8e8', print: '#ff4aa0' },
  metal: { skin: '#d8a888', skinD: '#b8886a', hair: '#5a3a20', hairStyle: 'long', beard: '#5a3a20', top: '#141414', top2: '#0c0c0c', bottom: '#34466a', belt: '#2a2018', shoes: '#2a2018', print: '#d0d0d0' },
  rocker: { skin: '#c89070', skinD: '#a87050', hair: '#2a1a10', hairStyle: 'short', beard: '#2a1a10', vest: '#1a1410', top: '#6a6a70', top2: '#4a4a50', bottom: '#2a3a5a', belt: '#1a1410', shoes: '#0a0a0a' },
  punk: { skin: '#f0c8b0', skinD: '#d0a890', hair: '#e02a6a', hairStyle: 'curly', top: '#2a2a2a', top2: '#1a1a1a', bottom: '#a01818', skirt: true, legs: '#1a1a1a', shoes: '#0a0a0a', lips: '#a01848' },
  metal2: { skin: '#a8724c', skinD: '#88583a', hair: '#141010', hairStyle: 'long', top: '#1a1414', top2: '#0e0a0a', sleeves: true, bottom: '#1a1a1a', belt: '#c8ccd4', shoes: '#0a0a0a', print: '#c02020' },
};

// ---------------------------------------------------------------- Kulisse für Gespräche und Zwischensequenzen

function drawKellerBackdrop(c: Ctx) {
  const rnd = rng(666);
  // Ziegelwand, schwarz mit dunkelroten Fugen
  r(c, 0, 0, 480, 270, '#0e0a0e');
  for (let y = 0; y < 190; y += 8) for (let x = ((y / 8) % 2) * 9; x < 480; x += 18) { r(c, x, y, 17, 7, rnd() < 0.5 ? '#161016' : '#1a1218'); }
  for (let y = 7; y < 190; y += 8) r(c, 0, y, 480, 1, '#2a0a10');
  // Poster: Totenkopf, Pentagramm, Blitz, Flammen
  const posters: [number, number, string][] = [[24, 30, '#e8e0d0'], [104, 46, '#c01818'], [376, 34, '#f0c020'], [430, 60, '#e85010']];
  for (const [x, y, col] of posters) {
    r(c, x, y, 34, 46, '#0a0808'); r(c, x + 2, y + 2, 30, 42, '#16100e');
    blob(c, x + 17, y + 18, 8, 9, col);
    r(c, x + 12, y + 16, 4, 4, '#0a0808'); r(c, x + 19, y + 16, 4, 4, '#0a0808');
    r(c, x + 13, y + 26, 9, 3, col); for (let i = 0; i < 4; i++) p(c, x + 14 + i * 2, y + 27, '#0a0808');
    r(c, x + 6, y + 36, 22, 3, col);
  }
  // Bühne: schwarze Bretter, rote LED-Kante
  r(c, 0, 176, 480, 40, '#141014');
  for (let x = 0; x < 480; x += 24) r(c, x, 176, 1, 40, '#0a080a');
  r(c, 0, 176, 480, 2, '#2a2228');
  r(c, 0, 214, 480, 3, '#ff2020'); r(c, 0, 217, 480, 2, '#7a0a0a');
  // Verstärkertürme links und rechts
  for (const ax of [14, 70, 392, 438]) {
    for (let k = 0; k < 2; k++) {
      const ay = 96 + k * 40;
      r(c, ax, ay, 40, 38, '#0c0c0e'); r(c, ax + 2, ay + 2, 36, 34, '#1c1c20');
      for (let gy = ay + 4; gy < ay + 34; gy += 3) for (let gx = ax + 4; gx < ax + 36; gx += 3) p(c, gx, gy, '#2c2c32');
      r(c, ax + 14, ay + 3, 12, 3, '#c8b070');
    }
    r(c, ax, 84, 40, 12, '#0c0c0e'); for (let k = 0; k < 6; k++) r(c, ax + 4 + k * 6, 88, 3, 3, '#c8c8c8');
    r(c, ax + 30, 86, 2, 2, '#ff2020');
  }
  // Schlagzeug in der Mitte hinten
  blob(c, 240, 160, 26, 16, '#1a0a0e'); blob(c, 240, 160, 20, 12, '#e8e0d0'); blob(c, 240, 160, 6, 4, '#c01818');
  for (const [x, y] of [[200, 138], [280, 138]]) { blob(c, x, y, 12, 6, '#1a0a0e'); blob(c, x, y - 1, 9, 4, '#d8d0c0'); }
  for (const [x, y] of [[178, 112], [302, 112]]) { r(c, x, y, 1, 40, '#8a8a90'); blob(c, x, y, 14, 2.5, '#d8b040'); }
  // Kabel über die Bühne
  for (let i = 0; i < 5; i++) {
    let x = 60 + i * 90, y = 190;
    for (let k = 0; k < 60; k++) { p(c, x, y, '#06060a'); x += rnd() < 0.5 ? 1 : 2; y += rnd() < 0.5 ? 0 : rnd() < 0.5 ? 1 : -1; y = Math.max(180, Math.min(212, y)); }
  }
  // Publikum als Silhouetten davor, Hände mit Teufelshörnern
  for (let i = 0; i < 26; i++) {
    const x = 6 + i * 18 + Math.floor(rnd() * 8), y = 232 + Math.floor(rnd() * 12);
    blob(c, x, y, 7, 8, '#050306'); r(c, x - 9, y + 6, 18, 40, '#050306');
    if (rnd() < 0.45) { const hx = x + (rnd() < 0.5 ? -6 : 6); r(c, hx, y - 22, 2, 18, '#050306'); r(c, hx - 2, y - 26, 1, 5, '#050306'); r(c, hx + 2, y - 26, 1, 5, '#050306'); }
  }
  // Nebelstreifen
  for (let i = 0; i < 6; i++) blob(c, 40 + i * 80, 200 + (i % 2) * 6, 60, 6, 'rgba(200,160,170,0.08)');
}

// ---------------------------------------------------------------- Texturen

export function makeKellerTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('nickBig')) return;
  const make = (key: string, w: number, h: number, draw: (c: Ctx) => void) => tex2x(scene, key, w, h, draw);

  // Nick groß: Metal und clean
  for (const [key, pal] of [['nickBig', METAL], ['nickWeissBig', WEISS]] as const) {
    const t = tex2x(scene, key, NFW * NICK_FRAMES.length, NFH, (c) => NICK_FRAMES.forEach((k, i) => drawNick(c, i * NFW, 0, NPOSES[k], pal)), {
      detail: (c) => { strands(c, pal.hair); folds(c, pal.top); sideLight(c, 0.18); },
    });
    NICK_FRAMES.forEach((_, i) => t.add(i, 0, i * NFW * 2, 0, NFW * 2, NFH * 2));
  }
  const bustOpt = (pal: NickPal) => ({ detail: (c: Ctx) => { strands(c, pal.hair); folds(c, pal.top); eyeShine(c, ['#1a1018', '#3a4a6a']); sideLight(c); } });
  tex2x(scene, 'nbust_nick', 64, 96, (c) => drawNickBust(c, METAL, 'normal'), bustOpt(METAL));
  tex2x(scene, 'nbust_nickWut', 64, 96, (c) => drawNickBust(c, METAL, 'wut'), bustOpt(METAL));
  tex2x(scene, 'nbust_nickWeiss', 64, 96, (c) => drawNickBust(c, WEISS, 'schnoesel'), bustOpt(WEISS));

  // Nick als Laufgrafik (Draufsicht) und seine kleine Gitarre
  personSheet(scene, 'nickWalk', { skin: METAL.skin, skinD: METAL.skin2, hair: METAL.hair, hairStyle: 'long', top: '#18141a', top2: '#2c2630', bottom: '#1c1c24', belt: '#c8ccd4', shoes: '#0c0a0c', print: '#c01818' });
  personSheet(scene, 'nickWeissWalk', { skin: WEISS.skin, skinD: WEISS.skin2, hair: WEISS.hair, hairStyle: 'short', top: '#f4f2ec', top2: '#d6d4cc', sleeves: true, collar: true, cuffs: true, bottom: '#f0eee8', belt: '#d8b850', shoes: '#fafaf6' });
  for (const [key, body, trim] of [['nickGit', '#b81818', '#101010'], ['nickGitWeiss', '#f6f4ee', '#c8a848']] as const) {
    make(key, 16, 8, (c) => {
      poly(c, [[6, 3], [6, 5], [0, 8], [0, 6], [3, 4], [0, 2], [0, 0]], body);
      r(c, 2, 3, 2, 2, trim);
      r(c, 6, 3, 8, 2, '#2a1a12'); r(c, 13, 2, 3, 3, trim);
    });
  }
  for (const [id, L] of Object.entries(KELLER_LOOKS)) personSheet(scene, `kg_${id}`, L);
  // die Gitarre des Wirts im Duell: alte Strat in Sonnenuntergang-Lack
  make('horstGit', 48, 18, (c) => {
    blob(c, 10, 10, 9, 7, '#2a1408'); blob(c, 10, 10, 7, 5.5, '#a8501a'); blob(c, 10, 10, 4, 3, '#e8a040');
    r(c, 6, 9, 8, 2, '#e8e0d0'); r(c, 14, 8, 2, 4, '#c0c0c8');
    r(c, 18, 8, 24, 3, '#c89860'); for (let x = 21; x < 42; x += 4) p(c, x, 9, '#8a8a90');
    poly(c, [[42, 6], [48, 5], [47, 13], [42, 12]], '#c89860');
    line(c, 4, 10, 46, 9, '#e0e4ea');
  });

  // ---- Kacheln
  for (let v = 0; v < 2; v++) {
    make(`kellerBoden${v}`, T, T, (c) => {
      r(c, 0, 0, T, T, v ? '#1c1517' : '#191315');
      speckle(c, ['#241a1d', '#120d0f', '#2a1416'], 14, 31 + v * 7);
      if (v) { line(c, 2, 11, 7, 9, '#0e0a0b'); line(c, 7, 9, 9, 12, '#0e0a0b'); }
      r(c, 0, 15, T, 1, '#120c0e'); r(c, 15, 0, 1, T, '#120c0e');
    });
  }
  const ziegel = (c: Ctx, seed: number) => {
    r(c, 0, 0, T, T, '#2a0a10');
    for (let y = 0; y < T; y += 4) for (let x = ((y / 4) % 2) * 4 - 4; x < T; x += 8) r(c, x, y, 7, 3, (x + y + seed) % 3 ? '#161016' : '#1c1218');
    r(c, 0, 15, T, 1, '#0a0608');
  };
  make('kellerWandFront', T, T, (c) => ziegel(c, 0));
  make('kellerWandTop', T, T, (c) => { r(c, 0, 0, T, T, '#0c080a'); speckle(c, ['#160e12'], 6, 77); });
  const posterCols = ['#e8e0d0', '#c01818', '#f0c020', '#e85010', '#9a40e0'];
  posterCols.forEach((col, i) => {
    make(`kellerPoster${i}Front`, T, T, (c) => {
      ziegel(c, i);
      r(c, 2, 1, 12, 13, '#0a0808'); r(c, 3, 2, 10, 11, '#1a1210');
      if (i === 1) {
        // Pentagramm
        const st: P2[] = [];
        for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5; st.push([8 + Math.cos(a) * 4, 7 + Math.sin(a) * 4]); }
        for (let k = 0; k < 5; k++) line(c, st[k][0], st[k][1], st[(k + 1) % 5][0], st[(k + 1) % 5][1], col);
      } else if (i === 2) {
        line(c, 9, 3, 6, 8, col); line(c, 6, 8, 10, 8, col); line(c, 10, 8, 7, 12, col);
      } else if (i === 3) {
        for (let k = 0; k < 5; k++) { r(c, 4 + k * 2, 8 - (k % 2) * 3, 2, 5 + (k % 2) * 3, col); }
      } else {
        blob(c, 8, 6, 3.5, 3.5, col); r(c, 6, 5, 1, 2, '#0a0808'); r(c, 9, 5, 1, 2, '#0a0808'); r(c, 6, 10, 5, 1, col);
      }
      r(c, 4, 12, 8, 1, col);
    });
  });
  make('kellerBuehne', T, T, (c) => {
    r(c, 0, 0, T, T, '#141014');
    for (let y = 0; y < T; y += 4) r(c, 0, y, T, 1, '#0a080a');
    speckle(c, ['#1e181e'], 6, 91);
  });
  make('kellerKante', T, T, (c) => {
    r(c, 0, 0, T, 9, '#141014'); r(c, 0, 0, T, 1, '#0a080a');
    r(c, 0, 9, T, 2, '#ff2a2a'); r(c, 0, 11, T, 5, '#1a0a0e');
    for (let x = 1; x < T; x += 4) p(c, x, 12, '#5a0a10');
  });
  make('kellerTreppeHoch', T, T, (c) => {
    ziegel(c, 2);
    r(c, 2, 0, 12, 16, '#0a0608');
    for (let y = 1; y < 16; y += 3) { r(c, 3, y, 10, 2, y < 8 ? '#3a2a1c' : '#4a3626'); }
    r(c, 2, 0, 12, 3, '#06040a');
  });

  // ---- Objekte (y-sortiert)
  make('kellerAmp', 16, 26, (c) => {
    for (let k = 0; k < 2; k++) {
      const y = 6 + k * 10;
      r(c, 0, y, 16, 10, '#0c0c0e'); r(c, 1, y + 1, 14, 8, '#1c1c20');
      for (let gy = y + 2; gy < y + 9; gy += 2) for (let gx = 2; gx < 14; gx += 2) p(c, gx, gy, '#2e2e36');
    }
    r(c, 0, 0, 16, 6, '#0c0c0e'); for (let k = 0; k < 5; k++) p(c, 2 + k * 3, 2, '#d0d0d0');
    r(c, 5, 4, 6, 1, '#c8b070'); p(c, 14, 1, '#ff2020');
    r(c, 0, 25, 16, 1, 'rgba(0,0,0,0.4)');
  });
  make('kellerDrums', 32, 24, (c) => {
    blob(c, 16, 15, 9, 7, '#1a0a0e'); blob(c, 16, 15, 7, 5, '#e8e0d0'); blob(c, 16, 15, 2, 1.5, '#c01818');
    for (const x of [5, 27]) { blob(c, x, 11, 5, 3, '#1a0a0e'); blob(c, x, 10, 4, 2, '#d8d0c0'); }
    for (const x of [2, 30]) { r(c, x, 2, 1, 12, '#8a8a90'); blob(c, x, 2, 4, 1, '#d8b040'); }
    r(c, 12, 4, 8, 3, '#1a0a0e'); blob(c, 16, 4, 3.5, 1.5, '#d8d0c0');
  });
  make('kellerMikro', 8, 22, (c) => {
    r(c, 3, 4, 1, 17, '#8a8a90'); blob(c, 3.5, 3, 2, 2.5, '#2a2a30'); r(c, 0, 21, 8, 1, '#4a4a50'); p(c, 3, 2, '#c0c0c8');
  });
  make('kellerSofa', 32, 18, (c) => {
    r(c, 0, 4, 32, 13, '#1a1214'); r(c, 2, 0, 28, 8, '#241618'); r(c, 0, 4, 4, 12, '#2a1a1c'); r(c, 28, 4, 4, 12, '#2a1a1c');
    r(c, 4, 9, 11, 5, '#2e1e22'); r(c, 17, 9, 11, 5, '#2e1e22');
    r(c, 8, 10, 3, 2, '#c8b090'); r(c, 22, 3, 4, 1, '#c8b090'); // Risse, Schaumstoff
    r(c, 0, 17, 32, 1, 'rgba(0,0,0,0.4)');
  });
  make('kellerKisten', 16, 16, (c) => {
    r(c, 1, 4, 14, 11, '#3a2a1c'); r(c, 1, 4, 14, 2, '#4a3624');
    for (let k = 0; k < 4; k++) { blob(c, 3.5 + k * 3, 3, 1.2, 1.6, '#2a5a2a'); p(c, 3 + k * 3, 1, '#d8c070'); }
    r(c, 1, 15, 14, 1, 'rgba(0,0,0,0.4)');
  });
  make('kellerKerzen', 16, 14, (c) => {
    blob(c, 8, 9, 4, 3.5, '#e8e0d0'); r(c, 6, 8, 1, 2, '#1a1010'); r(c, 9, 8, 1, 2, '#1a1010'); r(c, 7, 11, 3, 1, '#a8a090');
    for (const [x, h] of [[2, 6], [13, 8], [4, 4]]) { r(c, x, 13 - h, 2, h, '#f0e8d8'); p(c, x, 12 - h, '#ffb030'); p(c, x + 1, 11 - h, '#ffe070'); }
    r(c, 0, 13, 16, 1, '#5a0a10');
  });
  make('kellerNebelMaschine', 16, 10, (c) => {
    r(c, 0, 2, 14, 8, '#2a2a30'); r(c, 0, 2, 14, 1, '#4a4a54'); r(c, 14, 4, 2, 3, '#1a1a20'); p(c, 3, 4, '#ff3030');
  });
  make('kellerKabel', T, T, (c) => {
    const rnd = rng(55);
    let x = 0, y = 8;
    while (x < T) { p(c, x, y, '#2a2a30'); p(c, x, y + 1, '#0a0a0e'); x++; if (rnd() < 0.25) y += rnd() < 0.5 ? 1 : -1; }
  });
  make('kellerPentagramm', 48, 32, (c) => {
    // auf den Boden gekreidet (dezent), wird in der Verwandlung mit Pulver nachgezogen
    const st: P2[] = [];
    for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k * 4 * Math.PI) / 5; st.push([24 + Math.cos(a) * 20, 16 + Math.sin(a) * 13]); }
    for (let k = 0; k < 5; k++) line(c, st[k][0], st[k][1], st[(k + 1) % 5][0], st[(k + 1) % 5][1], '#3a1a1e');
    for (let a = 0; a < Math.PI * 2; a += 0.05) p(c, Math.round(24 + Math.cos(a) * 22), Math.round(16 + Math.sin(a) * 15), '#3a1a1e');
  });
  tex(scene, 'csKeller', 480, 270, drawKellerBackdrop);
}
