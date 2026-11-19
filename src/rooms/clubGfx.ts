import Phaser from 'phaser';
import { Ctx, blob, folds, outline, p, r, rng, strands, tex, tex2x } from '../gfx';

// Grafiken für den „Muskelkater“: Stripclub mit Ladies Night. Samt, Pink, Neon, Spiegelkugel, Bühne mit Stangen.
// Die Tänzer tragen Kostüme (Feuerwehr, Polizei, Matrose, Bau, Cowboy) und sind nie ganz nackt.
// Figuren 16×20 wie überall im Spiel, 16 Bilder pro Blatt:
//   0–2 vorne laufen, 3–5 hinten, 6–8 seitlich, 9 sitzt (vorne), 10 sitzt (seitlich), 11 sitzt (von hinten),
//   12 Arme hoch, 13 Bizeps, 14 Arme hoch von hinten, 15 seitlich mit Arm hoch (Hüftschwung)

const T = 16;
const EYE = '#1a1212';

function speckle(c: Ctx, cols: string[], n: number, seed: number, w = T, h = T, x0 = 0, y0 = 0) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) p(c, x0 + Math.floor(rnd() * w), y0 + Math.floor(rnd() * h), cols[Math.floor(rnd() * cols.length)]);
}

export interface Look {
  skin: string;
  skinD: string;
  hair: string;
  hairStyle?: 'short' | 'long' | 'bun' | 'curly' | 'bald' | 'bob';
  /** Oberteil; ohne: nackter Oberkörper */
  top?: string;
  top2?: string;
  sleeves?: boolean;
  bottom: string;
  /** Kleid oder Rock statt Hose */
  skirt?: boolean;
  legs?: string;
  shoes: string;
  hat?: 'helmet' | 'cap' | 'sailor' | 'hard' | 'cowboy' | 'veil' | 'headphones';
  hatCol?: string;
  hatCol2?: string;
  suspenders?: string;
  bow?: string;
  collar?: boolean;
  cuffs?: boolean;
  vest?: string;
  vestStripe?: string;
  belt?: string;
  /** Reflexstreifen an der Hose */
  stripe?: string;
  /** Halstuch */
  neck?: string;
  glasses?: string;
  lips?: string;
  beard?: string;
  blush?: string;
  /** Schärpe quer über die Brust */
  sash?: string;
  /** Aufdruck auf dem Shirt */
  print?: string;
}

function drawPerson(c: Ctx, ox: number, f: number, L: Look) {
  let dir = 0, step = 0, sit = false;
  let arms: 'walk' | 'up' | 'flex' = 'walk';
  if (f < 9) { dir = Math.floor(f / 3); step = f % 3; }
  else if (f === 9) sit = true;
  else if (f === 10) { dir = 2; sit = true; }
  else if (f === 11) { dir = 1; sit = true; }
  else if (f === 12) arms = 'up';
  else if (f === 13) arms = 'flex';
  else if (f === 14) { dir = 1; arms = 'up'; }
  else { dir = 2; arms = 'up'; step = 1; }

  const R = (x: number, y: number, w: number, h: number, col: string) => r(c, ox + x, y, w, h, col);
  const P = (x: number, y: number, col: string) => p(c, ox + x, y, col);
  const bare = !L.top;
  const body = L.top ?? L.skin, body2 = L.top2 ?? L.skinD;
  const legCol = L.skirt ? L.legs ?? L.skin : L.bottom;

  // Beine
  if (sit) {
    if (dir === 2) {
      R(5, 15, 7, 2, L.bottom);
      if (L.skirt) R(10, 15, 2, 2, legCol);
      R(10, 17, 2, 2, legCol);
      R(10, 19, 3, 1, L.shoes);
    } else if (dir === 0) {
      R(4, 15, 3, 2, L.bottom); R(9, 15, 3, 2, L.bottom);
      R(5, 17, 2, 2, legCol); R(9, 17, 2, 2, legCol);
      R(5, 19, 2, 1, L.shoes); R(9, 19, 2, 1, L.shoes);
    } else {
      R(5, 15, 2, 3, legCol); R(9, 15, 2, 3, legCol);
      R(5, 18, 2, 1, L.shoes); R(9, 18, 2, 1, L.shoes);
    }
  } else if (dir === 2) {
    const a = step === 1 ? 1 : step === 2 ? -1 : 0;
    R(6 - a, 15, 2, 3, legCol); R(6 - a, 18, 3, 1, L.shoes);
    R(8 + a, 15, 2, 3, legCol); R(8 + a, 18, 3, 1, L.shoes);
    if (L.stripe) { R(6 - a, 17, 2, 1, L.stripe); R(8 + a, 17, 2, 1, L.stripe); }
  } else {
    const ll = step === 1 ? 3 : 4, rl = step === 2 ? 3 : 4;
    R(5, 15, 2, ll - 1, legCol); R(5, 14 + ll, 2, 1, L.shoes);
    R(9, 15, 2, rl - 1, legCol); R(9, 14 + rl, 2, 1, L.shoes);
    if (L.stripe) { R(5, 16, 2, 1, L.stripe); R(9, 16, 2, 1, L.stripe); }
  }

  // Körper
  R(4, 9, 8, 7, body);
  R(10, 9, 2, 7, body2);
  if (L.skirt) { R(4, 13, 8, sit ? 2 : 3, L.bottom); R(4, 13, 8, 1, '#ffffff33'); }
  else R(4, 15, 8, 1, L.bottom);
  if (bare) {
    if (dir === 0) { R(5, 11, 2, 1, L.skinD); R(9, 11, 2, 1, L.skinD); P(7, 13, L.skinD); P(8, 13, L.skinD); P(7, 14, L.skinD); }
    else if (dir === 1) R(7, 11, 1, 4, L.skinD);
  }
  if (L.vest) {
    if (dir === 0) { R(4, 9, 2, 6, L.vest); R(10, 9, 2, 6, L.vest); if (L.vestStripe) { R(4, 12, 2, 1, L.vestStripe); R(10, 12, 2, 1, L.vestStripe); } }
    else if (dir === 1) { R(4, 9, 8, 6, L.vest); if (L.vestStripe) R(4, 12, 8, 1, L.vestStripe); }
    else { R(5, 9, 5, 6, L.vest); if (L.vestStripe) R(5, 12, 5, 1, L.vestStripe); }
  }
  if (L.suspenders) {
    const s = L.suspenders;
    if (dir === 0) { R(6, 9, 1, 6, s); R(9, 9, 1, 6, s); }
    else if (dir === 1) for (let i = 0; i < 6; i++) { P(5 + i, 9 + i, s); P(10 - i, 9 + i, s); }
    else R(7, 9, 1, 6, s);
  }
  if (L.print && dir === 0) R(6, 11, 4, 2, L.print);
  if (L.sash && dir === 0) for (let i = 0; i < 6; i++) { P(4 + i, 9 + i, L.sash); P(5 + i, 9 + i, L.sash); }
  if (L.collar && dir !== 1) R(6, 9, 4, 1, '#f4f4f0');
  if (L.bow && dir !== 1) { R(6, 9, 1, 2, L.bow); R(9, 9, 1, 2, L.bow); R(7, 9, 2, 1, L.bow); }
  if (L.neck) {
    if (dir === 0) { R(6, 9, 4, 1, L.neck); R(7, 10, 2, 1, L.neck); }
    else if (dir === 1) R(5, 9, 6, 2, L.neck);
    else R(8, 9, 3, 2, L.neck);
  }
  if (L.belt) { R(4, 15, 8, 1, L.belt); if (dir === 0) P(7, 15, '#e8c040'); }

  // Arme
  const s = step === 1 ? 1 : step === 2 ? -1 : 0;
  const up = L.sleeves || !bare ? body2 : L.skin;
  const low = L.sleeves ? body2 : L.skin;
  if (arms === 'up') {
    if (dir === 2) { R(8, 3, 2, 4, low); R(8, 7, 2, 3, up); P(8, 2, L.skin); }
    else { R(3, 4, 1, 4, low); R(12, 4, 1, 4, low); R(3, 8, 1, 2, up); R(12, 8, 1, 2, up); P(3, 3, L.skin); P(12, 3, L.skin); }
  } else if (arms === 'flex') {
    R(1, 9, 3, 2, up); R(12, 9, 3, 2, up);
    R(1, 6, 2, 3, low); R(13, 6, 2, 3, low);
    P(1, 5, L.skin); P(14, 5, L.skin); P(2, 8, L.skinD); P(13, 8, L.skinD);
  } else if (dir === 2) {
    R(7 + s, 10, 2, 2, up); R(7 + s, 12, 2, 2, low); P(7 + s, 14, L.skin);
    if (L.cuffs) R(7 + s, 13, 2, 1, '#f4f4f0');
  } else {
    R(3, 10 + s, 1, 2, up); R(3, 12 + s, 1, 2, low); P(3, 14 + s, L.skin);
    R(12, 10 - s, 1, 2, up); R(12, 12 - s, 1, 2, low); P(12, 14 - s, L.skin);
    if (L.cuffs) { P(3, 13 + s, '#f4f4f0'); P(12, 13 - s, '#f4f4f0'); }
  }

  // Kopf
  R(4, 2, 8, 7, L.skin);
  const H = L.hair, st = L.hairStyle ?? 'short';
  if (dir === 0) {
    if (st !== 'bald') { R(4, 1, 8, 2, H); R(4, 3, 1, 3, H); R(11, 3, 1, 3, H); }
    if (st === 'long') { R(3, 2, 1, 8, H); R(12, 2, 1, 8, H); }
    if (st === 'bob') { R(3, 1, 10, 2, H); R(3, 3, 1, 4, H); R(12, 3, 1, 4, H); }
    if (st === 'bun') R(6, 0, 4, 2, H);
    if (st === 'curly') for (const x of [4, 6, 8, 10, 12]) blob(c, ox + x, 1.5, 1.3, 1.3, H);
    P(6, 5, EYE); P(9, 5, EYE);
    if (L.glasses) { R(5, 5, 6, 1, L.glasses); P(6, 5, '#e8f0ff'); }
    if (L.beard) R(5, 7, 6, 2, L.beard);
    if (L.lips) R(7, 7, 2, 1, L.lips);
    if (L.blush) { P(5, 6, L.blush); P(10, 6, L.blush); }
  } else if (dir === 1) {
    if (st !== 'bald') R(4, 1, 8, st === 'long' ? 11 : st === 'bob' ? 7 : 6, H);
    if (st === 'bun') R(6, 0, 4, 3, H);
    if (st === 'curly') for (const x of [4, 6, 8, 10, 12]) blob(c, ox + x, 1.5, 1.3, 1.3, H);
  } else {
    if (st !== 'bald') { R(4, 1, 7, 2, H); R(4, 3, 3, st === 'long' ? 8 : st === 'bob' ? 5 : 3, H); }
    if (st === 'bun') R(4, 0, 3, 2, H);
    if (st === 'curly') for (const x of [4, 6, 8, 10]) blob(c, ox + x, 1.5, 1.3, 1.3, H);
    P(9, 5, EYE); P(12, 6, L.skin);
    if (L.glasses) R(8, 5, 4, 1, L.glasses);
    if (L.beard) R(8, 7, 4, 2, L.beard);
    if (L.lips) R(10, 7, 2, 1, L.lips);
  }

  // Kopfbedeckung
  const hc = L.hatCol ?? '#c02020', hc2 = L.hatCol2 ?? hc;
  switch (L.hat) {
    case 'helmet':
      R(4, 0, 8, 3, hc); R(3, 2, 10, 1, hc2);
      if (dir === 0) { P(7, 1, '#f0d040'); P(8, 1, '#f0d040'); }
      if (dir === 2) R(2, 3, 2, 1, hc2);
      break;
    case 'cap':
      R(4, 0, 8, 2, hc);
      if (dir === 0) { R(4, 2, 8, 1, '#101018'); P(7, 0, '#f0d040'); P(8, 0, '#f0d040'); }
      else if (dir === 2) R(10, 2, 4, 1, '#101018');
      break;
    case 'sailor': R(4, 0, 8, 2, '#f4f4f4'); R(4, 2, 8, 1, hc); break;
    case 'hard': R(4, 0, 8, 3, hc); R(3, 2, 10, 1, hc2); break;
    case 'cowboy': R(4, 0, 8, 2, hc); R(2, 2, 12, 1, hc2); break;
    case 'veil':
      R(5, 1, 6, 1, '#e8e8f8');
      if (dir === 0) { R(3, 2, 1, 10, '#f4f4f8'); R(12, 2, 1, 10, '#f4f4f8'); }
      else if (dir === 1) R(4, 1, 8, 12, '#f4f4f8');
      else R(3, 2, 2, 10, '#f4f4f8');
      break;
    case 'headphones': R(4, 1, 8, 1, '#303038'); R(3, 3, 1, 3, '#202028'); R(12, 3, 1, 3, '#202028'); break;
  }
  outline(c, ox, 0, 16, 20);
}

export function personSheet(scene: Phaser.Scene, key: string, L: Look) {
  const t = tex2x(scene, key, 16 * 16, 20, (c) => { for (let f = 0; f < 16; f++) drawPerson(c, f * 16, f, L); }, {
    detail: (c) => { strands(c, L.hair); if (L.top) folds(c, L.top); },
  });
  for (let i = 0; i < 16; i++) t.add(i, 0, i * 32, 0, 32, 40);
  const walk: [string, number[]][] = [['down', [1, 0, 2, 0]], ['up', [4, 3, 5, 3]], ['side', [7, 6, 8, 6]]];
  for (const [n, fr] of walk) if (!scene.anims.exists(`${key}_${n}`)) scene.anims.create({ key: `${key}_${n}`, frames: fr.map((f) => ({ key, frame: f })), frameRate: 7, repeat: -1 });
}

// ---------------------------------------------------------------- Figuren

/** Tänzer: immer mit Hose, Kostüm erkennbar an Helm, Mütze, Weste, Hosenträgern */
export const DANCER_LOOKS: Record<string, Look> = {
  feuerwehr: { skin: '#e8b48a', skinD: '#c8926a', hair: '#3a2416', bottom: '#d8b040', stripe: '#e8f0a0', suspenders: '#d02a2a', shoes: '#141414', hat: 'helmet', hatCol: '#c82020', hatCol2: '#a01818' },
  polizei: { skin: '#a8724c', skinD: '#88583a', hair: '#141010', bottom: '#1e2a5a', belt: '#101010', shoes: '#0a0a0a', hat: 'cap', hatCol: '#1e2a5a', glasses: '#28323e', bow: '#1e2a5a' },
  matrose: { skin: '#f0c8a0', skinD: '#d0a47c', hair: '#e8c860', bottom: '#f4f4f4', neck: '#2a4aa0', shoes: '#f4f4f4', hat: 'sailor', hatCol: '#2a4aa0' },
  bau: { skin: '#c88c5c', skinD: '#a86c40', hair: '#2a1a10', beard: '#2a1a10', bottom: '#3a5a8a', vest: '#ff7a1a', vestStripe: '#e8f0e0', belt: '#6a4a2a', shoes: '#5a3a1a', hat: 'hard', hatCol: '#f0c820', hatCol2: '#d0a810' },
  cowboy: { skin: '#e0aa80', skinD: '#c08a60', hair: '#6a4024', bottom: '#2a3a6a', vest: '#7a4a24', belt: '#3a2010', neck: '#c02a2a', shoes: '#5a3418', hat: 'cowboy', hatCol: '#8a5a30', hatCol2: '#6a4220' },
};

export const STAFF_LOOKS: Record<string, Look> = {
  /** Kellner: Kragen, Fliege, Manschetten, schwarze Hose */
  kellner: { skin: '#d4a07a', skinD: '#b4805a', hair: '#1a1210', bottom: '#141418', collar: true, bow: '#101010', cuffs: true, shoes: '#0a0a0a' },
  barfrau: { skin: '#f0c8a8', skinD: '#d0a888', hair: '#e04a9a', hairStyle: 'bob', top: '#141418', top2: '#0a0a0e', bottom: '#141418', shoes: '#0a0a0a', lips: '#e02a6a' },
  tuersteher: { skin: '#8a5a3a', skinD: '#6a4228', hair: '#141010', hairStyle: 'bald', top: '#16161c', top2: '#0e0e12', sleeves: true, bottom: '#16161c', collar: true, shoes: '#050505', glasses: '#101014', beard: '#141010' },
  dj: { skin: '#f0c8a0', skinD: '#d0a880', hair: '#3a2a20', top: '#2a2a3a', top2: '#1e1e2c', print: '#40d0f0', bottom: '#2a2a30', shoes: '#f4f4f4', hat: 'headphones', beard: '#3a2a20' },
};

const PINK = '#ff5ab0', PINK2 = '#d84090';
/** Gäste: ein Junggesellinnenabschied (Braut und „Team Braut“), Stammgäste, zwei VIPs */
export const GUEST_LOOKS: Record<string, Look> = {
  braut: { skin: '#f4d0b0', skinD: '#d8b090', hair: '#c88a3a', hairStyle: 'long', top: '#f8f6f0', top2: '#dcd8d0', bottom: '#f8f6f0', skirt: true, shoes: '#f0f0f0', hat: 'veil', sash: PINK, lips: '#e0305a' },
  team1: { skin: '#f0c8a0', skinD: '#d0a880', hair: '#3a2416', hairStyle: 'long', top: PINK, top2: PINK2, print: '#f8f8f8', bottom: '#2a3a6a', shoes: '#f8f8f8', lips: '#d0305a' },
  team2: { skin: '#b07a50', skinD: '#905e3a', hair: '#141010', hairStyle: 'bun', top: PINK, top2: PINK2, print: '#f8f8f8', bottom: '#141418', skirt: true, shoes: '#141418', lips: '#c02a5a' },
  team3: { skin: '#f4d4b8', skinD: '#d8b498', hair: '#f0d070', hairStyle: 'bob', top: PINK, top2: PINK2, print: '#f8f8f8', bottom: '#3a5a9a', shoes: PINK, lips: '#e0305a' },
  team4: { skin: '#e8b890', skinD: '#c89870', hair: '#a03a1a', hairStyle: 'long', top: PINK, top2: PINK2, print: '#f8f8f8', bottom: '#202020', skirt: true, legs: '#202028', shoes: '#101010', lips: '#c02a3a' },
  oma: { skin: '#f0d0b8', skinD: '#d0b098', hair: '#c8c8d0', hairStyle: 'bun', top: '#7a4a9a', top2: '#5a3a7a', sleeves: true, bottom: '#c8b898', skirt: true, legs: '#e8d0c0', shoes: '#4a3a2a', blush: '#f0a0a0' },
  rot: { skin: '#e8b890', skinD: '#c89870', hair: '#141010', hairStyle: 'bob', top: '#c81830', top2: '#a01020', bottom: '#c81830', skirt: true, shoes: '#141010', lips: '#e0103a' },
  mann: { skin: '#e0b088', skinD: '#c09068', hair: '#5a4030', top: '#ff8ac8', top2: '#e070b0', bottom: '#d8d0c0', shoes: '#6a4a2a', beard: '#5a4030' },
  leo: { skin: '#f0c4a0', skinD: '#d0a480', hair: '#e8b040', hairStyle: 'long', top: '#d8a040', top2: '#b88030', print: '#5a3410', bottom: '#141418', shoes: '#c02020', lips: '#e0103a' },
  blazer: { skin: '#a8724c', skinD: '#88583a', hair: '#1a1010', hairStyle: 'long', top: '#3a3a4a', top2: '#2a2a38', sleeves: true, bottom: '#3a3a4a', skirt: true, shoes: '#101010', lips: '#c0305a' },
  gruen: { skin: '#f4d0b0', skinD: '#d8b090', hair: '#6a3a1a', hairStyle: 'bun', top: '#2a9a6a', top2: '#1e7a52', bottom: '#2a9a6a', skirt: true, shoes: '#f0d040', lips: '#e0305a' },
  glitzer: { skin: '#d8a070', skinD: '#b88050', hair: '#f0e0c0', hairStyle: 'bob', top: '#c0c0d8', top2: '#9898b8', bottom: '#c0c0d8', skirt: true, shoes: '#c0c0d8', lips: '#ff2a8a' },
  jeans: { skin: '#f0c8a8', skinD: '#d0a888', hair: '#8a4a2a', hairStyle: 'long', top: '#f4f4f4', top2: '#d8d8d8', bottom: '#3a5a9a', shoes: '#f4f4f4', lips: '#d0305a' },
  punk: { skin: '#f4d4bc', skinD: '#d8b49c', hair: '#9a40e0', top: '#141418', top2: '#0a0a0e', print: PINK, bottom: '#141418', shoes: '#141418', lips: '#5a1a6a' },
  kollegin1: { skin: '#e8b890', skinD: '#c89870', hair: '#2a1a10', hairStyle: 'long', top: '#40a0d0', top2: '#2a80b0', bottom: '#f0ece0', shoes: '#f0ece0', lips: '#d0305a' },
  kollegin2: { skin: '#c8906a', skinD: '#a8704c', hair: '#141010', hairStyle: 'curly', top: '#f0d040', top2: '#d0b020', bottom: '#141418', skirt: true, shoes: '#141418', lips: '#c02a5a' },
  vip1: { skin: '#f0c8a8', skinD: '#d0a888', hair: '#f0e0b0', hairStyle: 'long', top: '#e8c040', top2: '#c8a020', bottom: '#e8c040', skirt: true, shoes: '#e8c040', glasses: '#202020', lips: '#c0103a' },
  vip2: { skin: '#8a5a3a', skinD: '#6a4228', hair: '#141010', hairStyle: 'bun', top: '#141418', top2: '#0a0a0e', bottom: '#141418', skirt: true, shoes: '#c0c0c0', lips: '#a0103a' },
};

/** Kevin sitzt seitlich auf einem Stuhl (Blick nach rechts): 0 mit Cocktail, 1 winkt mit einem Schein */
function drawKevinSit(c: Ctx, ox: number, wave: boolean) {
  const SK = '#c89068', SKD = '#a8704c', HAIR = '#1a1210';
  const R = (x: number, y: number, w: number, h: number, col: string) => r(c, ox + x, y, w, h, col);
  // Bein: Oberschenkel waagerecht, Unterschenkel nach unten, Badelatsche
  R(6, 16, 10, 3, SK); R(15, 18, 3, 5, SK); R(15, 23, 5, 1, '#2a2a6a');
  for (let i = 0; i < 4; i++) p(c, ox + 15 + (i % 2), 19 + i, SKD);
  // Tanga: Rot / Weiß / Grün
  R(5, 15, 4, 1, '#d02a2a'); R(9, 15, 3, 1, '#f4f4f0'); R(12, 15, 3, 1, '#2a9a3a');
  // Rumpf mit Bauch nach vorne
  R(5, 8, 9, 7, SK); R(13, 10, 3, 5, SK); R(5, 8, 2, 7, SKD);
  for (let i = 0; i < 6; i++) p(c, ox + 9 + (i % 3) * 2, 9 + Math.floor(i / 3) * 2, HAIR);
  // Kopf: Locken, Bart
  R(7, 1, 7, 7, SK);
  for (const [x, y] of [[7, 1], [9, 0], [11, 0], [13, 1], [6, 3], [6, 5]]) blob(c, ox + x, y + 0.5, 1.3, 1.3, HAIR);
  R(10, 5, 4, 2, HAIR); p(c, ox + 12, 3, '#1a1a1a'); p(c, ox + 14, 4, SK);
  if (!wave) {
    // Arm nach vorne, pinker Cocktail mit Strohhalm
    R(8, 9, 2, 4, SK); R(9, 12, 4, 2, SKD);
    R(13, 9, 2, 3, '#f070c0'); R(13, 8, 2, 1, '#c0e0f0'); p(c, ox + 14, 7, '#40d0f0');
  } else {
    // Arm hoch, grüner Schein
    R(9, 7, 2, 2, SK); R(10, 4, 2, 3, SK); R(11, 1, 2, 3, SK);
    R(12, -1 + 1, 5, 3, '#5aa04a'); p(c, ox + 14, 1, '#2a6a2a');
  }
  outline(c, ox, 0, 22, 24);
}

// ---------------------------------------------------------------- Kulisse im Gespräch

function drawClubBackdrop(c: Ctx) {
  const rnd = rng(311);
  r(c, 0, 0, 480, 270, '#140814');
  // Bühnenvorhang mit Falten und Goldfransen
  for (let x = 0; x < 480; x++) {
    const k = (x % 14);
    r(c, x, 14, 1, 176, k < 3 ? '#6a0a30' : k < 9 ? '#9a1444' : k < 11 ? '#c0306a' : '#8a1040');
  }
  for (let x = 0; x < 480; x += 24) blob(c, x + 12, 16, 13, 7, '#c0306a');
  r(c, 0, 0, 480, 14, '#3a0a24');
  for (let x = 0; x < 480; x += 2) r(c, x, 186, 1, 4 + (x % 4 ? 0 : 2), '#e0b040');
  // Lichtkegel von oben
  c.save();
  for (const [x, col] of [[110, '#ff4ac0'], [240, '#ffffff'], [370, '#9a5aff']] as const) {
    c.globalAlpha = 0.12;
    c.fillStyle = col;
    c.beginPath(); c.moveTo(x - 6, 0); c.lineTo(x + 6, 0); c.lineTo(x + 60, 230); c.lineTo(x - 60, 230); c.closePath(); c.fill();
  }
  c.restore();
  // Spiegelkugel
  blob(c, 240, 30, 11, 11, '#a8a8c0');
  for (let i = 0; i < 40; i++) p(c, 230 + Math.floor(rnd() * 21), 20 + Math.floor(rnd() * 21), rnd() < 0.5 ? '#f8f8ff' : '#6a6a88');
  r(c, 239, 0, 2, 19, '#606070');
  // Bühne: glänzend schwarz, Kante mit LEDs
  r(c, 0, 190, 480, 34, '#100c16');
  for (let x = 0; x < 480; x += 7) r(c, x, 192 + (x % 3), 4, 1, '#221c30');
  r(c, 0, 222, 480, 10, '#2a1430');
  for (let x = 3; x < 480; x += 6) r(c, x, 226, 2, 2, x % 12 < 6 ? '#ff4ac0' : '#ffb0e0');
  // Stange
  r(c, 238, 30, 4, 194, '#c8c8d8'); r(c, 238, 30, 1, 194, '#ffffff'); r(c, 241, 30, 1, 194, '#8a8aa0');
  blob(c, 240, 222, 9, 3, '#a0a0b8');
  // Publikum: Hinterköpfe im Gegenlicht
  r(c, 0, 232, 480, 38, '#1a0c1c');
  for (let x = 10; x < 480; x += 34) {
    const hx = x + Math.floor(rnd() * 10);
    blob(c, hx, 252, 10, 12, '#0a040a');
    if (rnd() < 0.5) blob(c, hx, 246, 11, 8, ['#3a2416', '#c88a3a', '#141010', '#a03a1a'][Math.floor(rnd() * 4)]);
  }
}

// ---------------------------------------------------------------- Texturen

export function makeClubTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('clubFloor0')) return;
  const make = (key: string, draw: (c: Ctx) => void, w = T, h = T) => tex2x(scene, key, w, h, draw);

  // Teppich: dunkles Pflaume mit Rosettenmuster und Goldsprenkeln
  for (let v = 0; v < 2; v++)
    make(`clubFloor${v}`, (c) => {
      r(c, 0, 0, T, T, '#24102a');
      for (let y = v * 4; y < T; y += 8) for (let x = v * 4; x < T; x += 8) { p(c, x, y, '#4a1a4a'); p(c, x + 1, y, '#3a1438'); p(c, x - 1, y, '#3a1438'); p(c, x, y + 1, '#3a1438'); p(c, x, y - 1, '#3a1438'); }
      speckle(c, ['#6a4a2a', '#30142e'], 6, 900 + v);
    });
  make('clubVip', (c) => {
    r(c, 0, 0, T, T, '#3a0a1c');
    for (let i = 0; i < T; i++) { p(c, i, i, '#7a5a2a'); p(c, T - 1 - i, i, '#7a5a2a'); }
    speckle(c, ['#4a1026'], 8, 903);
  });
  make('clubStage', (c) => {
    r(c, 0, 0, T, T, '#120e18');
    for (let i = 0; i < 3; i++) for (let k = 0; k < 6; k++) p(c, i * 6 + k, 12 - k + i, '#221c30');
    speckle(c, ['#2a2440', '#0c0a10'], 6, 904);
  });
  make('clubStairs', (c) => {
    r(c, 0, 0, T, T, '#120e18');
    for (const y of [1, 6, 11]) { r(c, 1, y, 14, 4, '#2a2236'); r(c, 1, y + 3, 14, 1, '#ff4ac0'); }
  });
  // Wand: getufteter Samt in Pink, Goldleiste, Sockel mit LED-Band
  const velvet = (c: Ctx) => {
    r(c, 0, 0, T, T, '#7a1a5a');
    for (const [y, o] of [[3, 0], [8, 4], [13, 0]] as const) for (let x = o; x < T; x += 8) { p(c, x + 2, y, '#4a0a36'); p(c, x + 3, y - 1, '#a03a7a'); }
    r(c, 0, 0, T, 1, '#d0a040');
    r(c, 0, 14, T, 2, '#140a14'); r(c, 0, 14, T, 1, '#ff5ad0');
  };
  make('clubWallFront', velvet);
  make('clubWallTop', (c) => { r(c, 0, 0, T, T, '#160a16'); speckle(c, ['#24102a'], 8, 905); });
  make('clubNeon0', (c) => {
    velvet(c);
    // Neonherz
    for (const [x, y] of [[5, 4], [6, 3], [7, 4], [8, 4], [9, 3], [10, 4], [4, 5], [11, 5], [4, 6], [11, 6], [5, 8], [10, 8], [6, 9], [9, 9], [7, 10], [8, 10]]) p(c, x, y, '#ff8ae0');
  });
  make('clubNeon1', (c) => {
    velvet(c);
    // Neonmund
    for (let x = 4; x < 12; x++) { p(c, x, 6 - (x === 7 || x === 8 ? 1 : 0), '#60e8ff'); p(c, x, 8 + (x > 5 && x < 10 ? 1 : 0), '#60e8ff'); }
    p(c, 3, 7, '#60e8ff'); p(c, 12, 7, '#60e8ff');
  });
  make('clubCurtain', (c) => {
    for (let x = 0; x < T; x++) { const k = x % 4; r(c, x, 0, 1, T, k === 0 ? '#700a30' : k === 2 ? '#c83a6a' : '#a01848'); }
    r(c, 0, 0, T, 2, '#80103a');
    for (let x = 0; x < T; x += 2) r(c, x, 13, 1, 3, '#e0b040');
  });
  make('clubBackstage', (c) => {
    r(c, 0, 0, T, T, '#1a0a1a');
    const rnd = rng(906);
    for (let x = 1; x < T - 1; x++) r(c, x, 1, 1, 11 + Math.floor(rnd() * 4), x % 2 ? '#c8c8e0' : '#8888a8');
    for (let i = 0; i < 5; i++) p(c, 1 + Math.floor(rnd() * 14), 2 + Math.floor(rnd() * 10), '#ff8ae0');
    r(c, 0, 0, T, 1, '#d0a040');
  });
  make('clubShelf', (c) => {
    r(c, 0, 0, T, T, '#2a1a30');
    r(c, 1, 0, 14, 14, '#4a3a60'); p(c, 2, 1, '#8a7aa0'); p(c, 3, 2, '#8a7aa0');
    const rnd = rng(907);
    for (const y of [6, 12]) {
      for (let x = 1; x < T - 1; x += 3) { const col = ['#e8c040', '#40c060', '#c84a2a', '#e8e0d0', '#60a0e0', '#ff70c0'][Math.floor(rnd() * 6)]; r(c, x, y - 5, 2, 5, col); p(c, x, y - 6, '#202020'); }
      r(c, 0, y, T, 1, '#c0c0d0'); r(c, 0, y + 1, T, 1, '#ff4ac0');
    }
    r(c, 0, 14, T, 2, '#140a14');
  });
  make('clubDoor', (c) => {
    r(c, 0, 0, T, T, '#160a16');
    r(c, 2, 2, 12, 14, '#3a1a3a'); r(c, 2, 2, 12, 1, '#d0a040'); r(c, 8, 3, 1, 13, '#1a0a1a');
    r(c, 3, 9, 4, 1, '#c0c0c8'); r(c, 9, 9, 4, 1, '#c0c0c8');
    r(c, 5, 0, 6, 2, '#30d060');
  });
  make('clubWc', (c) => {
    r(c, 0, 0, T, T, '#160a16');
    r(c, 3, 2, 10, 14, '#4a2a4a'); r(c, 3, 2, 10, 1, '#d0a040');
    r(c, 5, 4, 6, 4, '#f4f4f0'); for (const x of [6, 8, 9]) p(c, x, 5, '#2a1a2a'); p(c, 7, 6, '#2a1a2a'); p(c, 9, 6, '#2a1a2a');
    r(c, 11, 10, 1, 2, '#d0a040');
  });
  for (let v = 0; v < 2; v++)
    make(`clubCounter${v}`, (c) => {
      // Theke: schwarzer Marmor, Front mit LED-Band, Gläser
      r(c, 0, 0, T, 9, '#1a141c'); r(c, 0, 0, T, 1, '#5a4a60');
      speckle(c, ['#3a3040', '#0e0a10'], 6, 908 + v, T, 9);
      r(c, 0, 9, T, 7, '#2a1a2a'); r(c, 0, 9, T, 1, '#d0a040'); r(c, 0, 14, T, 1, '#ff4ac0');
      if (v) { r(c, 3, 3, 2, 3, '#f070c0'); r(c, 3, 2, 2, 1, '#c0e0f0'); }
      else { r(c, 10, 2, 2, 4, '#f0e070'); r(c, 10, 1, 2, 1, '#c0e0f0'); r(c, 4, 4, 3, 2, '#c0c0d0'); }
    });
  make('clubStool', (c) => {
    r(c, 7, 8, 2, 6, '#a0a0b0'); r(c, 7, 8, 1, 6, '#d0d0e0');
    blob(c, 8, 14, 4, 1.5, '#808090');
    blob(c, 8, 7, 4.5, 2.5, '#e04a9a'); r(c, 5, 6, 4, 1, '#ff8ac8');
  });
  make('clubTable', (c) => {
    // rundes Bistrotischchen: Chromfuß, dunkle Glasplatte mit silbernem Rand, Teelicht, zwei Gläser
    r(c, 7, 10, 2, 4, '#9090a0'); blob(c, 8, 14, 3.5, 1.3, '#707080');
    blob(c, 8, 8, 6.5, 3.6, '#a8a8b8'); blob(c, 8, 8, 6, 3.1, '#2a1e34');
    r(c, 4, 6, 4, 1, '#4a3a5a');
    r(c, 7, 8, 2, 1, '#f0e8d0'); p(c, 7, 7, '#ffb040');
    r(c, 3, 7, 2, 2, '#f070c0'); p(c, 3, 6, '#c0e0f0');
    r(c, 11, 6, 1, 3, '#e8d8a0'); p(c, 11, 5, '#c0e0f0');
  });
  // Stühle: pinker Samt, Goldrahmen. Seitlich (Lehne links, Blick nach rechts) und von hinten (Blick zur Bühne)
  make('clubChairSide', (c) => {
    r(c, 2, 2, 3, 11, '#c02a7a'); r(c, 2, 2, 3, 1, '#d0a040');
    p(c, 3, 5, '#80104a'); p(c, 3, 9, '#80104a');
    r(c, 4, 9, 9, 4, '#e03a8a'); r(c, 4, 9, 9, 1, '#ff7ab8');
    r(c, 3, 13, 1, 3, '#d0a040'); r(c, 12, 13, 1, 3, '#d0a040');
  });
  make('clubChairSeat', (c) => {
    r(c, 3, 5, 10, 7, '#e03a8a'); r(c, 3, 5, 10, 1, '#ff7ab8');
    r(c, 3, 12, 1, 3, '#d0a040'); r(c, 12, 12, 1, 3, '#d0a040');
  });
  make('clubChairBack', (c) => {
    r(c, 2, 6, 12, 9, '#c02a7a'); r(c, 2, 6, 12, 1, '#d0a040'); r(c, 12, 7, 2, 8, '#a01e66');
    for (const x of [4, 8, 12]) { p(c, x - 1, 9, '#80104a'); p(c, x - 1, 12, '#80104a'); }
  });
  make('clubSofa', (c) => {
    r(c, 0, 0, 5, T, '#b02a72'); r(c, 0, 0, 5, 1, '#d0a040');
    for (const y of [3, 9, 15]) p(c, 2, y, '#70104a');
    r(c, 5, 2, 9, 13, '#d8408a'); r(c, 5, 2, 9, 1, '#ff7ab8');
    r(c, 13, 2, 1, 13, '#a02a6a');
  });
  make('clubPost', (c) => {
    blob(c, 8, 14, 3, 1.3, '#a08030');
    r(c, 7, 4, 2, 10, '#e0c050'); r(c, 7, 4, 1, 10, '#fff0a0');
    blob(c, 8, 4, 2, 1.6, '#f0d060');
  });
  make('clubDj', (c) => {
    r(c, 0, 8, 32, 10, '#1a1a22'); r(c, 0, 8, 32, 1, '#4a4a5a');
    for (const x of [7, 25]) { blob(c, x, 13, 5, 3.2, '#2a2a30'); blob(c, x, 13, 4, 2.5, '#0a0a0a'); p(c, x, 13, '#e04a9a'); }
    r(c, 14, 10, 5, 6, '#3a3a4a');
    for (let i = 0; i < 6; i++) p(c, 15 + (i % 3), 11 + Math.floor(i / 3) * 2, ['#ff4ac0', '#40d0f0', '#f0e040'][i % 3]);
    r(c, 0, 18, 32, 12, '#2a1030'); r(c, 0, 18, 32, 1, '#d0a040');
    for (let x = 2; x < 30; x += 3) r(c, x, 22, 2, 4, x % 6 ? '#ff4ac0' : '#9a5aff');
    r(c, 0, 29, 32, 1, '#ff4ac0');
  }, 32, 32);
  make('clubPole', (c) => {
    r(c, 0, 0, 6, 2, '#606070');
    r(c, 2, 2, 2, 40, '#d0d0e0'); r(c, 2, 2, 1, 40, '#ffffff'); r(c, 3, 2, 1, 40, '#9090a8');
    blob(c, 3, 42, 3, 1.4, '#a0a0b8');
  }, 6, 44);
  make('clubBall', (c) => {
    blob(c, 5, 5, 5, 5, '#9898b0');
    for (let y = 1; y < 10; y += 2) for (let x = 1; x < 10; x += 2) if ((x - 5) ** 2 + (y - 5) ** 2 < 20) p(c, x, y, (x + y) % 4 ? '#f8f8ff' : '#6a6a88');
  }, 10, 10);
  make('clubBill', (c) => { r(c, 0, 0, 6, 3, '#5aa04a'); p(c, 2, 1, '#2a6a2a'); p(c, 3, 1, '#2a6a2a'); }, 6, 3);
  make('clubHeart', (c) => { for (const [x, y] of [[1, 0], [2, 0], [4, 0], [5, 0]]) p(c, x, y, '#ff5ab0'); r(c, 0, 1, 7, 2, '#ff5ab0'); r(c, 1, 3, 5, 1, '#ff5ab0'); r(c, 2, 4, 3, 1, '#ff5ab0'); p(c, 3, 5, '#ff5ab0'); p(c, 1, 1, '#ffc0e0'); }, 7, 6);
  make('clubTray', (c) => { r(c, 0, 2, 7, 1, '#c0c0d0'); r(c, 1, 0, 1, 2, '#f070c0'); r(c, 4, 0, 1, 2, '#f0e070'); }, 7, 3);

  // Figuren
  for (const [id, L] of Object.entries(DANCER_LOOKS)) personSheet(scene, `cd_${id}`, L);
  for (const [id, L] of Object.entries(STAFF_LOOKS)) personSheet(scene, `cs_${id}`, L);
  for (const [id, L] of Object.entries(GUEST_LOOKS)) personSheet(scene, `cg_${id}`, L);
  const k = make('kevinSit', (c) => { drawKevinSit(c, 0, false); drawKevinSit(c, 22, true); }, 44, 24);
  k.add(0, 0, 0, 0, 44, 48);
  k.add(1, 0, 44, 0, 44, 48);

  tex(scene, 'csClub', 480, 270, drawClubBackdrop);
}
