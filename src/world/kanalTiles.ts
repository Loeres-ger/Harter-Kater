import Phaser from 'phaser';
import { Ctx, Pal, WIRT_PAL, blob, drawHuman, eyeShine, folds, humanSheet, outline, p, r, rng, sideLight, strands, tex2x } from '../gfx';
import { drawBust } from '../guests/gfx';
import type { BustLook } from '../guests/data';

// Kacheln der Kanalisation (Karte „kanal“, im Map-Editor bearbeitbar): nasse Backsteinwände mit Moos und
// Kalkspuren, Rohre, Gitterschacht mit Licht von oben, Leiter zum Gully, Kreide-Wand, rostiges Gitter, Stahltür;
// Betonstege, trübes Abwasser, Brücke, Schleim, Nischen; Fass, Müll, Schieber. Dazu die Saugnapf-Ente, der offene
// Gullydeckel für die Gasse und das Kanal-Paket fürs Inventar.

const T = 16;

function speckle(c: Ctx, cols: string[], n: number, seed: number, w = T, h = T, x0 = 0, y0 = 0) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) p(c, x0 + Math.floor(rnd() * w), y0 + Math.floor(rnd() * h), cols[Math.floor(rnd() * cols.length)]);
}

/** nasse Backsteinwand: Fugen, Moos unten, Kalkläufer */
function wand(c: Ctx, seed: number) {
  r(c, 0, 0, T, T, '#2e3a40');
  for (let y = 0; y < T; y += 4) {
    r(c, 0, y + 3, T, 1, '#1a2226');
    for (let x = (y / 4) % 2 ? 0 : 4; x < T; x += 8) r(c, x, y, 1, 3, '#1a2226');
  }
  speckle(c, ['#3a4a52', '#26323a', '#44545c'], 14, seed);
  const rnd = rng(seed + 7);
  const lx = Math.floor(rnd() * 12) + 2;
  for (let y = 2; y < 12; y++) p(c, lx, y, y % 3 ? '#5a6a6a' : '#7a8a86'); // Kalkläufer
  r(c, 0, 13, T, 3, '#2a4a2a');
  for (let x = 0; x < T; x += 2) p(c, x, 12 + ((x * 7 + seed) % 2), '#3a6a32');
  r(c, 0, 15, T, 1, '#1a2a18');
}

/** Der Wirt in Tuncays Kanal-Paket: grüne Wathose bis zur Brust mit Trägern, Stirnlampe, Gullyhaken in der Hand */
const WATHOSE = '#3e6a3a', WATHOSE_D = '#2c4e2a', WATHOSE_H = '#5e8a56';
const WIRT_KANAL: Pal = { ...WIRT_PAL, pants: WATHOSE, shoes: '#22361f', boots: true };

function wirtKanal(c: Ctx, ox: number, dir: number, step: number) {
  drawHuman(c, ox, dir, step, WIRT_KANAL);
  const s = step === 1 ? 1 : step === 2 ? -1 : 0;
  // Latz der Wathose über dem weißen Hemd, Träger über die Schultern
  if (dir === 2) {
    r(c, ox + 5, 12, 6, 4, WATHOSE); r(c, ox + 10, 12, 1, 4, WATHOSE_D);
    r(c, ox + 6, 9, 1, 3, WATHOSE_D);
    p(c, ox + 6, 13, WATHOSE_H);
    r(c, ox + 7 + s, 12, 2, 2, WATHOSE); // Arm vor dem Latz bleibt sichtbar
  } else {
    r(c, ox + 4, 12, 8, 4, WATHOSE); r(c, ox + 10, 12, 2, 4, WATHOSE_D);
    if (dir === 0) {
      r(c, ox + 5, 9, 1, 3, WATHOSE_D); r(c, ox + 10, 9, 1, 3, WATHOSE_D);
      r(c, ox + 6, 12, 4, 2, WATHOSE_H); r(c, ox + 7, 12, 2, 1, '#8aa880'); // Brusttasche
    } else {
      for (let i = 0; i < 3; i++) { p(c, ox + 5 + i, 9 + i, WATHOSE_D); p(c, ox + 10 - i, 9 + i, WATHOSE_D); }
    }
  }
  // Stirnlampe: Gummiband um den Kopf, Lampe vorn
  r(c, ox + 4, 3, 8, 1, '#1c1c20');
  if (dir === 0) { r(c, ox + 6, 2, 4, 2, '#2a2a30'); r(c, ox + 7, 2, 2, 1, '#fff4b0'); p(c, ox + 7, 3, '#ffe070'); }
  else if (dir === 2) { r(c, ox + 10, 2, 2, 2, '#2a2a30'); p(c, ox + 11, 2, '#fff4b0'); p(c, ox + 12, 3, '#fff4b0'); }
  else r(c, ox + 7, 3, 2, 1, '#3a3a42');
  // Gullyhaken: Eisenstange mit Haken oben, in der Hand
  const metall = '#9a9aa4', metallD = '#5a5a64';
  if (dir === 0) { const hy = 14 - s; r(c, ox + 13, hy - 8, 1, 10, metall); r(c, ox + 13, hy - 9, 2, 1, metall); p(c, ox + 14, hy - 8, metallD); }
  else if (dir === 1) { const hy = 14 + s; r(c, ox + 2, hy - 8, 1, 10, metall); r(c, ox + 1, hy - 9, 2, 1, metall); p(c, ox + 1, hy - 8, metallD); }
  else { r(c, ox + 9 + s, 10, 1, 9, metall); r(c, ox + 9 + s, 9, 3, 1, metall); p(c, ox + 11 + s, 10, metallD); } // unter dem Kinn, nicht vor dem Gesicht
}

/** Haltung einer Kanal-Ente für ein Bild der Animation */
interface EntePose {
  /** Schrittphase 0..3 (Tentakel setzen abwechselnd auf), -1 = steht, -2 = keine (schwimmt) */
  bein: number;
  /** Leib hoch/runter */
  dy: number;
  /** Kopf vor/zurück und hoch/runter (Kopfnicken beim Watscheln, Picken, Zustoßen) */
  kx: number;
  ky: number;
  /** wie weit der Schnabel offen ist (0..3) */
  schnabel: number;
  fluegel: 'zu' | 'hoch' | 'runter';
  /** schwimmt: Wellenphase */
  schwimm?: number;
  /** gründelt: Kopf unter Wasser, Hinterteil und Tentakel in der Luft */
  gruendeln?: boolean;
  /** aufgeplustert (Schütteln) */
  plustern?: boolean;
}

/** Bilder der Ente: 0–3 Watscheln, 4 Stehen, 5 Picken, 6–7 Angriff, 8–9 Schwimmen, 10 Gründeln, 11 Schütteln, 12 Quaken */
export const ENTE_BILDER: EntePose[] = [
  { bein: 0, dy: 0, kx: 1, ky: 0, schnabel: 0, fluegel: 'zu' },
  { bein: 1, dy: -1, kx: 0, ky: -0.5, schnabel: 0, fluegel: 'zu' },
  { bein: 2, dy: 0, kx: -0.5, ky: 0, schnabel: 0, fluegel: 'zu' },
  { bein: 3, dy: -1, kx: 0, ky: -0.5, schnabel: 0, fluegel: 'zu' },
  { bein: -1, dy: 0, kx: 0, ky: 0, schnabel: 0, fluegel: 'zu' },
  { bein: -1, dy: 0.5, kx: 1.5, ky: 6.5, schnabel: 1, fluegel: 'zu' },
  { bein: 0, dy: -1, kx: 2.5, ky: -0.5, schnabel: 3, fluegel: 'hoch' },
  { bein: 2, dy: 0, kx: 2.5, ky: 0.5, schnabel: 2, fluegel: 'runter' },
  { bein: -2, dy: 2, kx: 0, ky: 1, schnabel: 0, fluegel: 'zu', schwimm: 0 },
  { bein: -2, dy: 2.5, kx: 0.5, ky: 1.5, schnabel: 0, fluegel: 'zu', schwimm: 1 },
  { bein: -2, dy: 2, kx: 0, ky: 0, schnabel: 0, fluegel: 'zu', gruendeln: true },
  { bein: -1, dy: -1, kx: -1, ky: 0.5, schnabel: 1, fluegel: 'hoch', plustern: true },
  { bein: -1, dy: 0, kx: 0.5, ky: -1, schnabel: 2, fluegel: 'zu' },
];
const EW = 24, EH = 16;

/** mutierte Ente (24x16), Kopf nach rechts: räudig, Eiterbeulen, Rippen, Knochenstacheln, sechs Augen, Zahnschnabel, Tentakel */
function muttiEnte(c: Ctx, ox: number, pose: EntePose) {
  const rnd = rng(4711);
  const fed = '#5a5e3c', fed2 = '#3e4228', fed3 = '#6e7448', haut = '#c08474', bone = '#ddd4b2', rot = '#4a1212';
  const ten = '#7a3a6a', ten2 = '#9a4a8a', napf = '#f0b0c8';
  const X = (x: number) => ox + x;
  const by = 8 + pose.dy;
  const wasser = pose.schwimm !== undefined || pose.gruendeln;

  if (pose.gruendeln) {
    // Kopf unter Wasser: der Leib kippt nach vorn, das Hinterteil ragt hoch, die Tentakel zappeln in der Luft
    blob(c, X(12), 11, 5.5, 3, fed); blob(c, X(13), 12, 4, 1.5, fed3);
    for (let i = 0; i < 5; i++) p(c, X(8 + Math.floor(rnd() * 9)), 9 + Math.floor(rnd() * 3), fed2);
    blob(c, X(9), 10, 1.8, 1.3, haut); p(c, X(9), 10, '#d8e050');
    for (const [sx, h] of [[10, 2], [13, 2]]) for (let k = 0; k < h; k++) p(c, X(sx), 8 - k, bone);
    p(c, X(7), 8, fed2); p(c, X(6), 7, fed2); p(c, X(6), 6, fed); // Bürzel
    for (let k = 0; k < 4; k++)
      for (let t = 0; t < 5; t++) {
        const x = 7 + k * 1.6 + Math.sin(t * 1.1 + k * 2) * 1.2, y = 9 - t * 1.6;
        p(c, X(Math.round(x)), Math.round(y), t % 2 ? ten2 : ten);
        if (t === 3) p(c, X(Math.round(x) + 1), Math.round(y), napf);
      }
    c.clearRect(X(0), 13, EW, EH - 13);
    r(c, X(5), 13, 14, 1, '#4a6a48'); p(c, X(7), 13, '#8aa080'); p(c, X(15), 13, '#8aa080');
    blob(c, X(17), 13, 1.5, 0.6, '#6a9a60'); // Blasen, wo der Kopf ist
    outline(c, ox, 0, EW, EH);
    return;
  }

  // Ekelpfütze unter den Tentakeln
  if (!wasser) { blob(c, X(10), 15, 8, 1.2, '#4e7a22'); blob(c, X(10), 15, 5.5, 0.8, '#6a9a30'); }
  // Tentakel statt Füßen: zwei Paare setzen abwechselnd auf, das angehobene Paar krümmt sich nach vorn
  if (pose.bein > -2) {
    for (let k = 0; k < 4; k++) {
      const paarA = k % 2 === 0;
      let vor = 0, hoch = 0;
      if (pose.bein >= 0) {
        const ph = pose.bein;
        vor = ph === 0 ? (paarA ? 1.5 : -1.5) : ph === 2 ? (paarA ? -1.5 : 1.5) : 0;
        hoch = (ph === 1 && paarA) || (ph === 3 && !paarA) ? 2 : 0;
      }
      const basis = 5.5 + k * 2.4, oben = by + 2.5, unten = 15 - hoch;
      const n = Math.max(2, Math.round(unten - oben));
      for (let t = 0; t <= n; t++) {
        const u = t / n;
        const x = basis + vor * u + Math.sin(u * 3 + k) * 0.6 + (hoch ? u * u * 1.5 : 0);
        p(c, X(Math.round(x)), Math.round(oben + t), t % 2 ? ten2 : ten);
        if (t === n - 1 || t === Math.floor(n / 2)) p(c, X(Math.round(x) + 1), Math.round(oben + t), napf);
      }
    }
  }
  // Bürzel
  p(c, X(2), by - 2, fed2); p(c, X(3), by - 2, fed); p(c, X(2), by - 3, fed2); p(c, X(3), by - 1, fed);
  // räudiger Leib (aufgeplustert etwas größer und zerzaust)
  const rx = pose.plustern ? 7.5 : 6.5, ry = pose.plustern ? 4.6 : 3.8;
  blob(c, X(9), by, rx, ry, fed);
  blob(c, X(9), by + 2, rx - 2, 1.6, fed3);
  for (let i = 0; i < 8; i++) p(c, X(4 + Math.floor(rnd() * 11)), by - 2 + Math.floor(rnd() * 5), fed2);
  if (pose.plustern) for (const [x, y] of [[2, -2], [5, -4], [12, -4], [15, -1], [3, 2]]) p(c, X(x), Math.round(by + y), fed2);
  // kahle Stelle mit Eiterbeulen
  blob(c, X(6), by - 1, 2.2, 1.6, haut); p(c, X(5), by - 1, '#d8e050'); p(c, X(7), by - 2, '#f4f8a0'); p(c, X(6), by, '#d8e050');
  // freiliegende Rippen
  blob(c, X(11), by + 1, 2, 1.3, rot); for (const x of [10, 12]) r(c, X(x), Math.round(by), 1, 3, bone);
  // Knochenstacheln auf dem Rücken
  for (const [sx, h] of [[5, 2], [8, 3], [11, 2]]) for (let k = 0; k < h; k++) p(c, X(sx + (k > 1 ? 1 : 0)), Math.round(by - 4 - k + (sx === 8 ? 0 : 1)), bone);
  // zerrupfter Flügel: angelegt, hochgerissen oder ausgeschlagen nach unten
  if (pose.fluegel === 'zu') { blob(c, X(8), by, 3.2, 1.6, fed2); p(c, X(5), by + 1, fed3); }
  else {
    const hoch = pose.fluegel === 'hoch';
    for (let i = 0; i < 6; i++) {
      const x = 9 - i, y = hoch ? by - 2 - i * 0.9 : by + 1 + i * 0.5;
      r(c, X(x), Math.round(y), 2, 2, i % 2 ? fed2 : fed);
      if (i > 2) p(c, X(x), Math.round(y) + (hoch ? 2 : -1), bone); // Knochen schaut durch die kahlen Federn
    }
  }
  // Hals und schiefer Kopf
  const hx = 15.5 + pose.kx, hy = 4 + pose.ky + Math.min(0, pose.dy);
  for (let i = 1; i <= 3; i++) blob(c, X(13 + (hx - 13) * (i / 4)), by - 2 + (hy - by + 2) * (i / 4), 1.9, 1.9, fed);
  blob(c, X(hx), hy, 3.4, 3, fed); blob(c, X(hx - 1.5), hy - 1.4, 1.4, 1, haut);
  // breiter Entenschnabel voller Zähne
  const sx = Math.round(hx) + 2, sy = Math.round(hy) - 2, auf = pose.schnabel;
  r(c, X(sx), sy, 4, 2, '#d8a030'); p(c, X(sx + 3), sy + 1, '#b08020'); p(c, X(sx + 1), sy, '#8a6010');
  if (auf) r(c, X(sx), sy + 2, 4, auf, '#200606');
  r(c, X(sx), sy + 2 + auf, 4, 1, '#b88a28'); p(c, X(sx + 3), sy + 2 + auf, '#8a6010');
  p(c, X(sx), sy + 2, bone); p(c, X(sx + 2), sy + 2, bone);
  if (auf > 1) { p(c, X(sx + 1), sy + 1 + auf, bone); p(c, X(sx + 3), sy + 1 + auf, bone); }
  // grüner Sabber
  r(c, X(sx + 1), sy + 3 + auf, 1, 1 + Math.min(auf, 2), '#8ac83a'); p(c, X(sx + 1), sy + 4 + auf + Math.min(auf, 2), '#b8f060');
  // sechs Augen, gelb und rot, das große mit Pupille
  const ax = Math.round(hx), ay = Math.round(hy);
  for (const [ex, ey, col] of [[-2, -1, '#f0e840'], [1, -3, '#ff3a10'], [-1, 1, '#ff3a10'], [-3, 0, '#f0e840'], [-1, -3, '#dfe6d8']] as [number, number, string][]) p(c, X(ax + ex), ay + ey, col);
  blob(c, X(hx), hy - 1, 1.3, 1.3, '#f0e840'); p(c, X(ax + 1), ay - 1, '#200606');
  // im Wasser: unten abschneiden, Wellen
  if (wasser) {
    c.clearRect(X(0), 12, EW, EH - 12);
    const w = pose.schwimm ?? 0;
    r(c, X(3), 12, 14, 1, '#4a6a48');
    for (const x of [4 + w, 9 + w, 14 - w]) p(c, X(x), 12, '#8aa080');
    p(c, X(1 + w), 13, '#4a6a48'); p(c, X(18 - w), 13, '#4a6a48');
  }
  outline(c, ox, 0, EW, EH);
}

/** Tentakelratte (18x12), Kopf nach rechts. f: 0–2 Rennen, 3 Schnuppern, 4 Aufbäumen (Arme gespreizt) */
const RW = 18, RH = 12;
function tentakelRatte(c: Ctx, ox: number, f: number) {
  const fell = '#5a5248', fell2 = '#3e3832', fell3 = '#7a7064', haut = '#d89a9a', bone = '#ddd4b2';
  const ten = '#a04a90', ten2 = '#d070c0';
  const X = (x: number) => ox + x;
  const auf = f === 4, schnupper = f === 3, schritt = f <= 2 ? f : 0;
  const by = auf ? 6.5 : 8, kopfY = auf ? 4 : schnupper ? 8 : 7;
  // nackter Schwanz
  for (let t = 0; t < 8; t++) p(c, X(Math.max(0, Math.round(3.5 - t * 0.45))), Math.round(by + 1 + Math.sin(t * 0.9 + schritt * 1.4) * 1.4 + t * 0.15), t % 2 ? haut : '#c08080');
  // Beine (Rennen: abwechselnd vor und zurück)
  const v = schritt === 1 ? 1 : schritt === 2 ? -1 : 0;
  for (const [lx, s] of [[5, v], [7, -v], [11, -v], [12, v]] as [number, number][]) { p(c, X(lx + s), 10, fell2); p(c, X(lx + s), 11, haut); }
  if (auf) { p(c, X(6), 9, fell2); p(c, X(6), 10, fell2); }
  // Leib, räudig, kahle Stelle mit Beule
  blob(c, X(8), by, 5, auf ? 3 : 2.6, fell);
  blob(c, X(8), by + 1.3, 3.6, 1.2, fell3);
  for (const [x, y] of [[5, -1], [7, -2], [10, -1], [6, 1], [9, 0]]) p(c, X(x), Math.round(by + y), fell2);
  blob(c, X(7), by - 1, 1.4, 1, haut); p(c, X(7), Math.round(by - 1), '#d8e050');
  // Tentakelarme an der Schulter
  for (let k = 0; k < 3; k++)
    for (let t = 0; t < 5; t++) {
      const spreiz = auf ? (k - 1) * 1.4 : (k - 1) * 0.7;
      const x = 11 + t * (auf ? 0.6 : 0.9), y = by - 0.5 + t * spreiz + (auf ? -t * 0.8 : 0) + Math.sin(t + k + f) * 0.5;
      p(c, X(Math.round(x)), Math.round(y), t % 2 ? ten2 : ten);
      if (t === 2 || t === 4) p(c, X(Math.round(x)), Math.round(y) + 1, '#f0b0c8');
    }
  // Kopf mit spitzer Schnauze, Ohr, roten Augen, Zähnen
  blob(c, X(13.5), kopfY, 2.6, 2, fell);
  r(c, X(15), kopfY, 2, 1, fell3); p(c, X(17), kopfY + (schnupper && f === 3 ? 1 : 0), haut);
  blob(c, X(12.5), kopfY - 2, 1.1, 1.1, '#b07070');
  p(c, X(14), kopfY - 1, '#ff2a1a'); p(c, X(13), kopfY - 1, '#ff2a1a');
  p(c, X(16), kopfY + 1, bone); if (auf) p(c, X(15), kopfY + 1, bone);
  outline(c, ox, 0, RW, RH);
}

const BIANCA_PAL: Pal = { skin: '#e8b890', hair: '#2a1a14', coat: '#30c0a0', coat2: '#209080', pants: '#e8b890', shoes: '#101010', longHair: true, lips: '#c0204a', skirt: '#1a1a1a', fishnet: true, boots: true };
const BIANCA_BUST: BustLook = { skin: '#e8b890', hair: '#2a1a14', style: 'long', outfit: 'jacket', top: '#30c0a0', top2: '#209080', accent: '#1a1a1a', lips: '#c0204a', earrings: '#d0d0d8' };

/**
 * Die Katze im Kanal (24x16): größer als früher, aber wieder Katze. Räudiges graugrünes Fell, kahle Stelle mit Narbe,
 * zerrissenes Ohr, ein glühendes und ein blindes Auge, knochiger, geknickter Schwanz. Kopf nach rechts.
 * Bilder: 0–3 Laufen, 4–5 Sitzen (Schwanzspitze zuckt), 6 Sprung, 7 Fressen.
 */
const KW = 24, KH = 16;
function kanalKatze(c: Ctx, ox: number, f: number) {
  const fur = '#565c4a', fur2 = '#43483a', fur3 = '#6a705a', skin = '#c4887a', bone = '#d8d0b0';
  const X = (x: number) => ox + x;
  const kopf = (hx: number, hy: number, maulAuf: boolean) => {
    blob(c, X(hx), hy, 3.4, 3, fur);
    blob(c, X(hx + 2.4), hy + 1, 1.6, 1.2, fur3); // Schnauze
    p(c, X(Math.round(hx + 3.6)), Math.round(hy), '#2a1010'); // Nase
    // Ohren: eins spitz, eins zerrissen
    for (let k = 0; k < 3; k++) { p(c, X(Math.round(hx - 2 + k * 0.3)), Math.round(hy - 3 - k), fur); p(c, X(Math.round(hx - 1)), Math.round(hy - 3), fur2); }
    p(c, X(Math.round(hx + 1)), Math.round(hy - 3), fur); p(c, X(Math.round(hx + 2)), Math.round(hy - 4), fur); p(c, X(Math.round(hx + 2)), Math.round(hy - 3), skin);
    p(c, X(Math.round(hx)), Math.round(hy - 1), '#ff3a10'); p(c, X(Math.round(hx)) + 0, Math.round(hy - 2), '#ff9a40'); // glühendes Auge
    p(c, X(Math.round(hx + 2)), Math.round(hy - 1), '#dfe6d8'); // blindes Auge
    if (maulAuf) { r(c, X(Math.round(hx + 1)), Math.round(hy + 2), 3, 1, '#2a1010'); p(c, X(Math.round(hx + 1)), Math.round(hy + 2), bone); p(c, X(Math.round(hx + 3)), Math.round(hy + 2), bone); }
    else p(c, X(Math.round(hx + 2)), Math.round(hy + 2), bone);
    for (const dx of [3, 4]) p(c, X(Math.round(hx + dx)), Math.round(hy + 1), '#8a8a7a'); // Schnurrhaare
  };
  if (f === 4 || f === 5) {
    // sitzt: Hinterteil links, Brust aufrecht, Schwanz um die Pfoten gelegt
    blob(c, X(9), 11, 5, 4, fur); blob(c, X(13), 8, 3.4, 4.6, fur); blob(c, X(13.5), 9, 2, 3, fur3);
    r(c, X(13), 12, 2, 4, fur2); r(c, X(15), 12, 1, 4, fur2); p(c, X(13), 15, fur3); p(c, X(15), 15, fur3);
    blob(c, X(8), 10, 1.8, 1.4, skin); p(c, X(8), 10, '#8a1a1a');
    for (let t = 0; t < 8; t++) p(c, X(3 + t), 15, fur2);
    if (f === 5) { p(c, X(3), 14, fur2); p(c, X(2), 13, fur2); p(c, X(2), 12, bone); } else { p(c, X(2), 15, fur2); p(c, X(1), 14, bone); }
    kopf(15, 4, false);
    outline(c, ox, 0, KW, KH);
    return;
  }
  const sprung = f === 6, frisst = f === 7;
  const by = sprung ? 7 : 9;
  // Schwanz: knochig, geknickt, wippt beim Laufen
  const w = f < 4 ? [0, 1, 0, -1][f] : sprung ? -2 : 0;
  for (let t = 0; t < 6; t++) p(c, X(Math.max(0, 4 - t)), by - 1 - Math.min(t, 3) + (t > 3 ? w : 0), fur2);
  p(c, X(0), by - 4 + w, bone);
  // Beine: Laufphasen, im Sprung lang gestreckt
  if (sprung) {
    for (let i = 0; i < 4; i++) { p(c, X(16 + i), by + 1 + Math.floor(i / 2), fur2); p(c, X(17 + i), by + 1 + Math.floor(i / 2), fur2); }
    for (let i = 0; i < 4; i++) { p(c, X(6 - i), by + 2 + Math.floor(i / 2), fur2); p(c, X(5 - i), by + 2 + Math.floor(i / 2), fur2); }
  } else {
    const ph = f < 4 ? f : 0;
    const vor = [1, 0, -1, 0][ph], hoch = [0, 1, 0, 1][ph];
    for (const [lx, s] of [[6, vor], [8, -vor], [14, -vor], [16, vor]] as [number, number][]) {
      const len = 4 - (s > 0 ? hoch : 0);
      r(c, X(lx + s), by + 2, 1, len, fur2); p(c, X(lx + s), by + 1 + len, fur3);
    }
  }
  // Leib, mager mit Rippen, kahle Stelle mit Narbe
  blob(c, X(11), by, 7, sprung ? 2.6 : 3.2, fur);
  blob(c, X(11), by + 1.6, 5, 1.2, fur3);
  for (let x = 9; x < 15; x += 2) r(c, X(x), by - 1, 1, 3, fur2);
  blob(c, X(7), by - 1, 1.8, 1.3, skin); p(c, X(7), by - 1, '#8a1a1a'); r(c, X(6), by - 2, 3, 1, '#8a1a1a');
  // Kopf: beim Fressen gesenkt, mit Rattenschwanz im Maul
  if (frisst) { kopf(18.5, by + 2, true); r(c, X(22), by + 4, 1, 2, '#d89a9a'); p(c, X(23), by + 6, '#d89a9a'); }
  else kopf(sprung ? 19.5 : 18.5, by - 3, sprung);
  outline(c, ox, 0, KW, KH);
}

/**
 * Felix im Griff des Tentakels (14x24, von hinten-oben, Kopf oben, Füße zum Wasser): 0 Arme nach vorn gestreckt,
 * 1 Finger krallen sich in den Boden, 2 Kopf hoch, schreit.
 */
const FW = 14, FH = 24;
function felixLiegt(c: Ctx, ox: number, f: number) {
  const skin = '#f8d4b8', hair = '#e8c860', coat = '#1e3a8a', coat2 = '#16306e', pants = '#1a2440', shoes = '#0a0a0a';
  const X = (x: number) => ox + x;
  // Arme nach vorn (oben), Hände, Finger
  const lh = f === 1 ? 4 : 1, rh = f === 1 ? 1 : f === 2 ? 3 : 2;
  r(c, X(2), lh + 2, 2, 9 - lh, coat2); r(c, X(10), rh + 2, 2, 9 - rh, coat2);
  for (const [hx, hy] of [[3, lh], [11, rh]] as [number, number][]) {
    blob(c, X(hx), hy + 1, 1.4, 1.2, skin);
    for (const dx of [-1, 0, 1]) p(c, X(hx + dx), hy - (f === 1 && hx === 11 ? 0 : 1), skin); // Finger
  }
  // Kopf
  if (f === 2) {
    blob(c, X(7), 7, 3, 2.8, skin); r(c, X(4), 4, 7, 2, hair);
    p(c, X(6), 7, '#ffffff'); p(c, X(8), 7, '#ffffff'); p(c, X(6), 7, '#ffffff'); p(c, X(5), 7, '#1a1a1a'); p(c, X(9), 7, '#1a1a1a');
    blob(c, X(7), 9, 1.2, 1, '#3a0a0a'); // schreiender Mund
  } else {
    blob(c, X(7), 7, 3, 2.6, hair); p(c, X(4), 8, skin); p(c, X(10), 8, skin);
    for (const x of [5, 7, 9]) p(c, X(x), 6, '#c8a040');
  }
  // Rumpf, Gürtel, Beine, Schuhe
  r(c, X(3), 10, 8, 7, coat); r(c, X(9), 10, 2, 7, coat2); r(c, X(6), 10, 2, 1, '#9ab0e0');
  r(c, X(3), 16, 8, 1, shoes); p(c, X(7), 16, '#d8b040');
  r(c, X(4), 17, 2, 5, pants); r(c, X(8), 17, 2, 5, pants);
  r(c, X(4), 22, 2, 2, shoes); r(c, X(8), 22, 2, 2, shoes);
  // Schleim auf dem Rücken
  blob(c, X(5), 13, 1.4, 1, '#6ad04a'); p(c, X(9), 19, '#6ad04a');
  outline(c, ox, 0, FW, FH);
}

export function makeKanalTiles(scene: Phaser.Scene) {
  if (scene.textures.exists('kanalWandFront')) return;
  const wk = tex2x(scene, 'wirtKanal', 16 * 9, 20, (c) => {
    for (let d = 0; d < 3; d++) for (let s = 0; s < 3; s++) wirtKanal(c, (d * 3 + s) * 16, d, s);
  }, { detail: (c) => { strands(c, WIRT_KANAL.beard); folds(c, WIRT_KANAL.coat); eyeShine(c, ['#1a1212']); } });
  for (let i = 0; i < 9; i++) wk.add(i, 0, i * 32, 0, 32, 40);
  const a = scene.anims;
  a.create({ key: 'wirtKanal_down', frames: [1, 0, 2, 0].map((f) => ({ key: 'wirtKanal', frame: f })), frameRate: 8, repeat: -1 });
  a.create({ key: 'wirtKanal_up', frames: [4, 3, 5, 3].map((f) => ({ key: 'wirtKanal', frame: f })), frameRate: 8, repeat: -1 });
  a.create({ key: 'wirtKanal_side', frames: [7, 6, 8, 6].map((f) => ({ key: 'wirtKanal', frame: f })), frameRate: 8, repeat: -1 });
  const make = (key: string, draw: (c: Ctx) => void, w = T, h = T) => tex2x(scene, key, w, h, draw);

  make('kanalWandFront', (c) => wand(c, 3101));
  // Mauerkrone von oben: dunkle Decksteine mit Fugen, damit sie im Lampenlicht nicht wie Boden aussieht
  make('kanalWandTop', (c) => {
    r(c, 0, 0, T, T, '#0e1316');
    for (const [x, y, w] of [[0, 0, 8], [8, 0, 8], [4, 8, 8], [0, 8, 4], [12, 8, 4]]) { r(c, x + 1, y + 1, w - 2, 6, '#182024'); r(c, x + 1, y + 1, w - 2, 1, '#222c30'); }
    speckle(c, ['#0a0e10', '#1e262a'], 8, 3102);
  });
  make('kanalRohrFront', (c) => {
    wand(c, 3103);
    r(c, 0, 5, T, 4, '#6a5a4a'); r(c, 0, 5, T, 1, '#9a8a6a'); r(c, 0, 8, T, 1, '#3a2e24');
    r(c, 6, 4, 3, 6, '#5a4a3a'); r(c, 6, 4, 3, 1, '#8a7a5a');
    for (const [x, y] of [[2, 7], [11, 6], [13, 8]]) p(c, x, y, '#a85a2a');
    r(c, 10, 9, 1, 3, '#7ab0c0'); p(c, 10, 12, '#a8d8e8'); // Tropfen
  });
  make('kanalGitterFront', (c) => {
    wand(c, 3104);
    r(c, 3, 1, 10, 9, '#0a0e10'); r(c, 3, 1, 10, 1, '#8a98a0');
    for (let x = 4; x < 13; x += 2) r(c, x, 1, 1, 9, '#6a7880');
    r(c, 3, 9, 10, 1, '#4a5860');
    for (let y = 2; y < 9; y++) p(c, 5 + (y % 3) * 3, y, '#c8e0f0'); // Licht und Regen von oben
  });
  make('kanalLeiterFront', (c) => {
    wand(c, 3105);
    r(c, 4, 0, 8, 2, '#c8d8e0');
    r(c, 4, 0, 1, T, '#8a7a6a'); r(c, 11, 0, 1, T, '#8a7a6a');
    for (let y = 2; y < T; y += 3) r(c, 4, y, 8, 1, '#a89878');
    for (const y of [5, 11]) p(c, 7, y, '#a85a2a');
  });
  make('kanalKreideFront', (c) => {
    wand(c, 3106);
    const w = '#e8e4d8';
    r(c, 2, 3, 5, 1, w); r(c, 2, 5, 3, 1, w); r(c, 9, 3, 4, 1, w); r(c, 9, 5, 5, 1, w); r(c, 3, 7, 9, 1, w);
    for (let i = 0; i < 4; i++) p(c, 12 + i % 2, 8 + i, w); // Pfeil
    p(c, 11, 10, w); p(c, 14, 10, w);
  });
  make('kanalTuerFront', (c) => {
    wand(c, 3107);
    r(c, 2, 1, 12, 15, '#3a4048'); r(c, 2, 1, 12, 1, '#6a7480'); r(c, 3, 2, 10, 13, '#4a525c');
    for (const y of [4, 12]) r(c, 3, y, 10, 1, '#2a3038');
    r(c, 11, 8, 1, 3, '#a8a8b0');
    r(c, 4, 5, 8, 4, '#d8c020'); r(c, 5, 6, 6, 2, '#1a1a1a'); // Warnschild
    for (const [x, y] of [[3, 3], [12, 3], [3, 13], [12, 13]]) p(c, x, y, '#8a8a92');
  });
  // Rostgitter quer im Gang: dahinter Dunkelheit
  make('kanalTor', (c) => {
    r(c, 0, 0, T, T, '#0a0e10');
    r(c, 0, 0, T, 2, '#1a2226');
    for (let x = 2; x < 15; x += 3) { r(c, x, 0, 1, T, '#7a4a2a'); p(c, x, 5, '#a8602a'); p(c, x, 11, '#5a3018'); }
    r(c, 1, 4, 14, 1, '#6a3a20'); r(c, 1, 11, 14, 1, '#6a3a20');
  });
  // Schatten unter einer Wand, Kante eines Stegs zur Rinne (mit Tropfen)
  make('kanalSchatten', (c) => { r(c, 0, 0, T, 2, '#00000070'); r(c, 0, 2, T, 2, '#00000040'); r(c, 0, 4, T, 1, '#00000020'); });
  make('kanalKante', (c) => {
    r(c, 0, 13, T, 2, '#3a4042'); r(c, 0, 13, T, 1, '#6a7072'); r(c, 0, 15, T, 1, '#1a2022');
    for (const x of [3, 10]) p(c, x, 15, '#6a8a98');
  });
  // Boden
  const steg = (seed: number, pfuetze: boolean) => (c: Ctx) => {
    r(c, 0, 0, T, T, '#4a5052');
    speckle(c, ['#545a5c', '#3e4446', '#5c6264'], 22, seed);
    r(c, 0, 0, T, 1, '#3a4042');
    if (pfuetze) { blob(c, 9, 10, 4, 2, '#2e3a44'); p(c, 7, 9, '#7a8a98'); }
    for (const [x, y] of [[3, 4], [12, 6]]) p(c, x, y, '#2a6a2a');
  };
  make('kanalSteg0', steg(3110, false));
  make('kanalSteg1', steg(3111, true));
  make('kanalSteg2', steg(3112, false));
  const wasser = (seed: number) => (c: Ctx) => {
    r(c, 0, 0, T, T, '#2a3a2a');
    speckle(c, ['#324432', '#22301f', '#3a4a30'], 20, seed);
    const rnd = rng(seed);
    for (let i = 0; i < 3; i++) { const x = Math.floor(rnd() * 12), y = Math.floor(rnd() * 14); r(c, x, y, 4, 1, '#4a6a48'); }
    p(c, 4 + seed % 7, 3, '#8a9a60'); // Schaum
  };
  make('kanalWasser0', wasser(3113));
  make('kanalWasser1', wasser(3114));
  make('kanalBruecke', (c) => {
    r(c, 0, 0, T, T, '#2a3a2a');
    r(c, 2, 0, 12, T, '#6a4a2a');
    for (let y = 0; y < T; y += 4) r(c, 2, y + 3, 12, 1, '#3a2814');
    r(c, 2, 0, 1, T, '#4a3018'); r(c, 13, 0, 1, T, '#4a3018');
    for (const [x, y] of [[4, 2], [11, 6], [6, 10], [9, 14]]) p(c, x, y, '#8a6a3a');
  });
  make('kanalSchleimBoden', (c) => {
    steg(3115, false)(c);
    blob(c, 8, 8, 6, 4, '#3a8a2a'); blob(c, 8, 8, 4.5, 2.8, '#6ad04a'); p(c, 6, 7, '#c8ffb0'); blob(c, 14, 13, 1.5, 1, '#6ad04a');
  });
  make('kanalNische', (c) => {
    r(c, 0, 0, T, T, '#262c2e'); speckle(c, ['#2e3436', '#1e2224'], 16, 3116);
    r(c, 0, 0, T, 2, '#14181a');
  });
  // Gegenstände
  make('kanalFass', (c) => {
    blob(c, 8, 14, 5.5, 1.6, '#00000060');
    r(c, 3, 3, 10, 11, '#4a6a3a'); r(c, 3, 3, 10, 1, '#6a8a5a');
    for (const y of [5, 9, 12]) r(c, 3, y, 10, 1, '#2a3a22');
    r(c, 4, 6, 2, 3, '#a85a2a'); p(c, 10, 10, '#a85a2a');
    blob(c, 8, 3, 5, 1.5, '#5a7a4a'); p(c, 9, 2, '#d8e030'); // Warnzeichen
  });
  make('kanalMuell', (c) => {
    blob(c, 8, 12, 7, 3.5, '#3a3a2a');
    blob(c, 5, 10, 3, 2.5, '#5a5a6a'); blob(c, 11, 9, 3.2, 2.6, '#2a2a30'); blob(c, 8, 12, 2.5, 1.6, '#8a6a3a');
    r(c, 9, 6, 1, 4, '#3a6a3a'); p(c, 9, 5, '#a8c8a8'); // Flasche
    p(c, 4, 9, '#c8c8c8'); p(c, 12, 11, '#e0a040');
  });
  make('kanalSchieber', (c) => {
    r(c, 7, 6, 2, 9, '#5a5048'); r(c, 5, 14, 6, 2, '#3a3430');
    blob(c, 8, 6, 5, 5, '#8a3a2a'); blob(c, 8, 6, 3.5, 3.5, '#3a2a24');
    r(c, 3, 6, 10, 1, '#a84a32'); r(c, 8, 1, 1, 10, '#a84a32');
    blob(c, 8, 6, 1.5, 1.5, '#d8c8a0');
  });

  // Saugnapf-Ente, mutiert wie die Katze: räudige Federn, kahle Haut mit Eiterbeulen, Rippen, Knochenstacheln,
  // sechs Augen, ein Schnabel voller Zähne, grüner Sabber, Tentakel mit Saugnäpfen statt Füßen. Bilder und Abläufe: Watscheln mit Kopfnicken,
  // Jagen, Picken, Schütteln, Quaken, Angriff mit Flügelschlagen, Schwimmen, Gründeln (siehe ENTE_BILDER).
  const ente = tex2x(scene, 'kanalEnte', EW * ENTE_BILDER.length, EH, (c) => ENTE_BILDER.forEach((pose, i) => muttiEnte(c, i * EW, pose)));
  ENTE_BILDER.forEach((_, i) => ente.add(i, 0, i * EW * 2, 0, EW * 2, EH * 2));
  const anim = (key: string, frames: number[], frameRate: number, repeat = -1) =>
    scene.anims.create({ key: `kanalEnte_${key}`, frames: frames.map((frame) => ({ key: 'kanalEnte', frame })), frameRate, repeat });
  anim('lauf', [0, 1, 2, 3], 8);
  anim('jagd', [0, 1, 2, 3], 13);
  anim('angriff', [6, 7], 10);
  anim('schwimm', [8, 9], 2.5);
  anim('pick', [5, 4, 5, 4], 6, 0);
  anim('schuettel', [11, 4, 11, 4, 11, 4], 12, 0);
  anim('quak', [12, 12, 4], 8, 0);

  // ---------------------------------------------------------------- Phase 3: hinter dem Rostgitter
  // Spülrinne (trocken, mit Rinnsal und Abfluss), trockene Rinne der Schieberkammer, tiefer Schacht (Süd, leer)
  make('kanalRinne', (c) => {
    r(c, 0, 0, T, T, '#343a3a');
    speckle(c, ['#2c3232', '#3e4444', '#283030'], 18, 3201);
    r(c, 0, 0, T, 1, '#4a5252'); r(c, 0, 15, T, 1, '#1e2424');
    r(c, 0, 7, T, 2, '#2e3e2c'); for (let x = 0; x < T; x += 3) p(c, x, 7, '#4a6a48'); // Rinnsal
    for (const x of [2, 11]) p(c, x, 4, '#2a6a2a');
  });
  make('kanalRinneTrocken', (c) => {
    r(c, 0, 0, T, T, '#3a3428');
    speckle(c, ['#2e2a20', '#4a4234', '#342e24'], 22, 3202);
    blob(c, 5, 9, 3, 1.5, '#2e3a2a'); p(c, 4, 8, '#6a7a60'); blob(c, 12, 4, 2, 1, '#2e3a2a');
    for (const [x, y] of [[9, 12], [13, 10]]) p(c, x, y, '#8a7a5a'); // Knöchelchen, Kronkorken
    r(c, 0, 0, T, 1, '#4a4234');
  });
  make('kanalSchacht', (c) => {
    r(c, 0, 0, T, T, '#060808');
    r(c, 0, 0, T, 3, '#1e2424'); r(c, 0, 3, T, 2, '#121616'); r(c, 0, 5, T, 2, '#0c1010');
    for (const x of [3, 9, 14]) { r(c, x, 3, 1, 4, '#2a3a2a'); p(c, x, 7, '#3aa02a'); } // Schleimfäden in die Tiefe
  });
  // Schieber mit Farbschild; das Rad liegt als eigenes Bild darüber (es dreht sich)
  const schieber = (key: string, farbe: string, hell: string) => make(key, (c) => {
    r(c, 7, 6, 2, 9, '#5a5048'); r(c, 5, 14, 6, 2, '#3a3430');
    r(c, 5, 11, 6, 3, farbe); r(c, 5, 11, 6, 1, hell); p(c, 6, 12, '#ffffff');
    blob(c, 8, 6, 5, 5, '#3a3430'); blob(c, 8, 6, 3.5, 3.5, '#2a2420');
  });
  schieber('kanalSchieberRot', '#c03028', '#ff6a5a');
  schieber('kanalSchieberGelb', '#d0a818', '#ffe070');
  schieber('kanalSchieberGruen', '#2a9a3a', '#6ae07a');
  make('kanalRad', (c) => {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const d = Math.hypot(x - 7.5, y - 7.5); if (d > 3.2 && d < 5.4) p(c, x, y, '#c8c0b0'); }
    blob(c, 8, 8, 1.6, 1.6, '#e8e0d0');
    r(c, 3, 8, 10, 1, '#d8d0c0'); r(c, 8, 3, 1, 10, '#d8d0c0');
  });
  make('kanalHebel', (c) => {
    r(c, 4, 9, 8, 6, '#4a4a52'); r(c, 4, 9, 8, 1, '#6a6a74'); r(c, 5, 15, 6, 1, '#2a2a30');
    r(c, 5, 11, 6, 2, '#d8c020'); r(c, 6, 11, 1, 2, '#1a1a1a'); r(c, 9, 11, 1, 2, '#1a1a1a');
  });
  make('kanalHebelGriff', (c) => { r(c, 7, 2, 2, 8, '#9a9aa4'); blob(c, 8, 2, 2, 2, '#c03028'); p(c, 7, 1, '#ff8a7a'); });
  // Fass als Floß (liegt quer im Wasser)
  make('kanalFassFloss', (c) => {
    r(c, 1, 3, 14, 9, '#4a6a3a'); r(c, 1, 3, 14, 1, '#6a8a5a'); r(c, 1, 11, 14, 1, '#2a3a22');
    for (const x of [3, 8, 12]) r(c, x, 3, 1, 9, '#2a3a22');
    blob(c, 1.5, 7.5, 1.5, 4.5, '#5a7a4a'); p(c, 1, 7, '#d8e030'); r(c, 5, 6, 2, 3, '#a85a2a');
  });
  // Rattenloch in der Wand: dunkles Loch, rote Augenpaare, abgenagte Knochen davor
  make('kanalRattenlochFront', (c) => {
    wand(c, 3203);
    blob(c, 8, 13, 5.5, 4, '#050606'); r(c, 2, 14, 12, 2, '#050606');
    for (const [x, y] of [[5, 11], [7, 11], [10, 12], [12, 12]]) p(c, x, y, '#ff2a1a');
    p(c, 3, 15, '#ddd4b2'); p(c, 13, 15, '#ddd4b2'); r(c, 6, 15, 3, 1, '#ddd4b2');
  });
  // Gitter mit verhaktem Porsche-Schlüssel
  make('kanalGitterSchluesselFront', (c) => {
    wand(c, 3104);
    r(c, 3, 1, 10, 9, '#0a0e10'); r(c, 3, 1, 10, 1, '#8a98a0');
    for (let x = 4; x < 13; x += 2) r(c, x, 1, 1, 9, '#6a7880');
    r(c, 3, 9, 10, 1, '#4a5860');
    r(c, 8, 4, 1, 5, '#e8c040'); r(c, 8, 9, 2, 1, '#e8c040'); r(c, 6, 2, 4, 3, '#1a1a1a'); p(c, 7, 3, '#d02a2a'); p(c, 8, 3, '#e8c040');
  });
  make('kanalMuellRolex', (c) => {
    blob(c, 8, 12, 7, 3.5, '#3a3a2a');
    blob(c, 5, 10, 3, 2.5, '#5a5a6a'); blob(c, 11, 9, 3.2, 2.6, '#2a2a30'); blob(c, 8, 12, 2.5, 1.6, '#8a6a3a');
    blob(c, 12, 12, 1.6, 1.6, '#e8c040'); p(c, 12, 12, '#f8f0c0'); r(c, 13, 12, 2, 1, '#c8a030'); p(c, 11, 11, '#ffffff');
  });
  // Schleimkokon mit einer Frau darin (Hand mit pinken Nägeln schaut heraus); aufgeschnitten leer
  make('kanalKokon', (c) => {
    blob(c, 8, 15, 6, 1.4, '#4e7a22');
    blob(c, 8, 8, 5.5, 7.5, '#3a8a2a'); blob(c, 8, 8, 4.5, 6.5, '#5ab03a');
    blob(c, 8, 6, 2.2, 2.4, '#2a5a1a'); r(c, 6, 8, 4, 6, '#2a5a1a'); // Umriss der Frau
    for (const [x, y] of [[5, 4], [11, 7], [6, 12], [10, 3]]) p(c, x, y, '#a8f080');
    r(c, 12, 9, 2, 2, '#e8b890'); p(c, 14, 9, '#ff4a9a'); p(c, 14, 10, '#ff4a9a'); // Hand
    for (const x of [4, 12]) r(c, x, 0, 1, 3, '#5ab03a');
  });
  make('kanalKokonLeer', (c) => {
    blob(c, 8, 15, 6, 1.4, '#4e7a22');
    blob(c, 8, 11, 5.5, 4, '#3a8a2a'); blob(c, 8, 12, 4, 2.5, '#1a3a12');
    for (const [x, y] of [[3, 6], [4, 4], [12, 5], [13, 7], [8, 6]]) r(c, x, y, 1, 4, '#5ab03a');
    p(c, 6, 14, '#a8f080');
  });
  // aufgehebeltes Rostgitter: Stäbe zur Seite gebogen
  make('kanalTorOffen', (c) => {
    r(c, 0, 0, T, T, '#0a0e10');
    r(c, 0, 0, T, 2, '#1a2226');
    for (const [x, b] of [[2, -1], [5, -2], [11, 2], [14, 1]]) for (let y = 0; y < T; y++) p(c, x + Math.round(Math.sin((y / T) * Math.PI) * b), y, '#7a4a2a');
    r(c, 1, 4, 3, 1, '#6a3a20'); r(c, 12, 11, 3, 1, '#6a3a20');
  });
  // Funde fürs Inventar
  make('icon_porsche', (c) => {
    r(c, 2, 3, 6, 9, '#1a1a1a'); r(c, 2, 3, 6, 1, '#3a3a3a'); blob(c, 5, 7, 1.8, 2, '#d8a020'); p(c, 5, 7, '#c02a2a');
    r(c, 8, 6, 6, 2, '#d0d0d8'); r(c, 12, 8, 1, 2, '#d0d0d8'); r(c, 10, 8, 1, 1, '#d0d0d8'); p(c, 9, 6, '#ffffff');
  });
  make('icon_rolex', (c) => {
    r(c, 6, 1, 4, 14, '#c8a030'); r(c, 6, 1, 4, 1, '#e8c860');
    blob(c, 8, 8, 4, 4, '#e8c040'); blob(c, 8, 8, 3, 3, '#1a3a2a'); r(c, 8, 6, 1, 2, '#f0f0e0'); r(c, 8, 8, 2, 1, '#f0f0e0'); p(c, 7, 6, '#ffffff');
  });
  // Tentakelratte: räudig, nackter rosa Schwanz, kleine Tentakelarme an den Schultern, rote Augen. 0–2 Rennen, 3 Schnuppern, 4 Aufbäumen
  const ratte = tex2x(scene, 'kanalRatte', RW * 5, RH, (c) => {
    for (let i = 0; i < 5; i++) tentakelRatte(c, i * RW, i);
  });
  for (let i = 0; i < 5; i++) ratte.add(i, 0, i * RW * 2, 0, RW * 2, RH * 2);
  scene.anims.create({ key: 'kanalRatte_renn', frames: [0, 1, 2, 1].map((frame) => ({ key: 'kanalRatte', frame })), frameRate: 12, repeat: -1 });
  scene.anims.create({ key: 'kanalRatte_schnupper', frames: [3, 3, 0, 3].map((frame) => ({ key: 'kanalRatte', frame })), frameRate: 4, repeat: -1 });
  // Bianca: Figur und Brustbild, verschleimt
  humanSheet(scene, 'bianca', BIANCA_PAL);
  for (const [k, f] of [['down', [1, 0, 2, 0]], ['up', [4, 3, 5, 3]], ['side', [7, 6, 8, 6]]] as const)
    scene.anims.create({ key: `bianca_${k}`, frames: f.map((frame) => ({ key: 'bianca', frame })), frameRate: 8, repeat: -1 });
  tex2x(scene, 'nbust_bianca', 64, 96, (c) => {
    drawBust(c, BIANCA_BUST, 'sad');
    for (const [x, y, rx, ry] of [[18, 20, 4, 2], [44, 26, 3, 5], [26, 70, 6, 3], [40, 80, 5, 2], [14, 40, 2, 4]]) blob(c, x, y, rx, ry, '#6ad04a');
    for (const [x, y] of [[20, 22], [45, 30], [28, 72]]) p(c, x, y, '#c8ffb0');
  }, { detail: (c) => { strands(c, BIANCA_BUST.hair); folds(c, BIANCA_BUST.top); eyeShine(c, ['#1c120a']); sideLight(c); } });

  // Dialog-Hintergrund in der Kanalisation: Tunnelbogen aus Backstein, Rinne, Stege, Schleim
  tex2x(scene, 'csKanal', 240, 135, (c) => {
    r(c, 0, 0, 240, 135, '#151c1e');
    for (let y = 0; y < 135; y += 6) {
      r(c, 0, y + 5, 240, 1, '#0c1214');
      for (let x = (y / 6) % 2 ? 0 : 6; x < 240; x += 12) r(c, x, y, 1, 5, '#0c1214');
    }
    speckle(c, ['#202a2e', '#1a2226', '#26302e'], 500, 3301, 240, 135);
    blob(c, 120, 100, 80, 86, '#2a3438');
    for (let a = 0; a < 40; a++) { const t = (a / 40) * Math.PI; p(c, Math.round(120 - Math.cos(t) * 78), Math.round(100 - Math.sin(t) * 84), '#0c1214'); }
    for (const [ry, col] of [[78, '#0a1012'], [64, '#080c0e'], [48, '#06090a'], [30, '#040607']] as [number, string][]) blob(c, 120, 100, ry * 0.92, ry, col);
    blob(c, 120, 78, 10, 8, '#16261a');
    r(c, 0, 100, 60, 6, '#4a5052'); r(c, 180, 100, 60, 6, '#4a5052'); r(c, 0, 100, 60, 1, '#6a7072'); r(c, 180, 100, 60, 1, '#6a7072');
    r(c, 0, 106, 240, 29, '#1c2a1c');
    for (let i = 0; i < 40; i++) r(c, (i * 37) % 236, 108 + ((i * 13) % 26), 4 + (i % 3) * 2, 1, i % 4 ? '#2e4a2c' : '#4a6a48');
    for (const x of [44, 70, 95, 150, 172, 200]) { const h = 4 + (x % 7); r(c, x, 20 + (x % 9), 1, h, '#3aa02a'); p(c, x, 20 + (x % 9) + h, '#8aff6a'); }
    r(c, 8, 30, 30, 4, '#5a4a3a'); r(c, 8, 30, 30, 1, '#8a7a5a'); r(c, 202, 50, 30, 4, '#5a4a3a'); r(c, 202, 50, 30, 1, '#8a7a5a');
  });

  // die Katze, Felix' Taschenlampe
  const kz = tex2x(scene, 'katzeKanal', KW * 8, KH, (c) => { for (let i = 0; i < 8; i++) kanalKatze(c, i * KW, i); });
  for (let i = 0; i < 8; i++) kz.add(i, 0, i * KW * 2, 0, KW * 2, KH * 2);
  scene.anims.create({ key: 'katzeKanal_lauf', frames: [0, 1, 2, 3].map((frame) => ({ key: 'katzeKanal', frame })), frameRate: 10, repeat: -1 });
  scene.anims.create({ key: 'katzeKanal_sitz', frames: [4, 4, 4, 5, 4, 5].map((frame) => ({ key: 'katzeKanal', frame })), frameRate: 3, repeat: -1 });
  // Felix im Griff des Tentakels, seine Mütze, seine Hand aus dem Wasser, sein Notizblock
  const fl = tex2x(scene, 'felixLiegt', FW * 3, FH, (c) => { for (let i = 0; i < 3; i++) felixLiegt(c, i * FW, i); });
  for (let i = 0; i < 3; i++) fl.add(i, 0, i * FW * 2, 0, FW * 2, FH * 2);
  make('felixMuetze', (c) => {
    blob(c, 8, 9, 6, 2.6, '#14244a'); r(c, 3, 9, 10, 2, '#0a1430'); r(c, 4, 11, 8, 1, '#050a18');
    blob(c, 8, 8, 1.4, 1.2, '#e8c040'); p(c, 8, 8, '#fff0a0'); r(c, 5, 7, 6, 1, '#2a3a6a');
  });
  const hand = tex2x(scene, 'felixHand', 20, 10, (c) => {
    for (let f = 0; f < 2; f++) {
      const o = f * 10;
      r(c, o + 3, 5, 4, 5, '#1e3a8a'); r(c, o + 3, 5, 4, 1, '#9ab0e0');
      blob(c, o + 5, 4, 2.2, 1.6, '#f8d4b8');
      for (let i = 0; i < 4; i++) { const x = o + 2 + i * 2 - (f ? 0 : 1) + (f && i > 1 ? -1 : 0); r(c, x, f ? 2 : 0, 1, f ? 2 : 3, '#f8d4b8'); }
      r(c, o + 7, 3, 2, 1, '#f8d4b8');
      blob(c, o + 5, 9, 3.5, 1, '#4a6a48');
      outline(c, o, 0, 10, 10);
    }
  });
  hand.add(0, 0, 0, 0, 20, 20);
  hand.add(1, 0, 20, 0, 20, 20);
  make('felixBlock', (c) => { r(c, 4, 4, 7, 8, '#f4f0e0'); r(c, 4, 4, 7, 1, '#c02a2a'); for (const y of [6, 8, 10]) r(c, 5, y, 5, 1, '#8a8a9a'); });
  make('kanalTaschenlampe', (c) => { r(c, 3, 6, 8, 4, '#1a1a1e'); r(c, 3, 6, 8, 1, '#3a3a42'); r(c, 11, 5, 2, 6, '#5a5a62'); r(c, 12, 6, 1, 4, '#fff4b0'); blob(c, 8, 11, 6, 1.2, '#4a6a48'); });

  // offener Gully in der Gasse: Deckel beiseite, Loch mit Leiter, grüner Schimmer
  make('kanalGullyOffen', (c) => {
    blob(c, 8, 8, 6.5, 6.5, '#0a0c0a'); blob(c, 8, 8, 5.5, 5.5, '#141a14');
    r(c, 5, 4, 1, 9, '#6a5a4a'); r(c, 10, 4, 1, 9, '#6a5a4a');
    for (let y = 5; y < 13; y += 2) r(c, 5, y, 6, 1, '#8a7a5a');
    blob(c, 8, 11, 3, 1.5, '#3aa02a');
  });
  make('kanalDeckel', (c) => {
    blob(c, 9, 9, 6.5, 6.5, '#0a0a0c');
    blob(c, 8, 8, 6.5, 6.5, '#7a7e86'); blob(c, 8, 8, 5.5, 5.5, '#6a6e76');
    for (let y = 4; y < 13; y += 2) r(c, 4, y, 8, 1, '#4a4e56');
    p(c, 5, 4, '#a8acb4'); p(c, 4, 5, '#a8acb4'); r(c, 7, 7, 2, 2, '#3a3c40');
  });
  // Inventar: Kanal-Paket (Wathose, Stirnlampe, Haken)
  make('icon_kanalpaket', (c) => {
    r(c, 2, 4, 5, 10, '#3a5a3a'); r(c, 2, 12, 6, 2, '#2a3a2a'); r(c, 2, 4, 5, 1, '#5a7a5a'); r(c, 3, 2, 1, 2, '#2a2a2a'); r(c, 6, 2, 1, 2, '#2a2a2a');
    blob(c, 11, 5, 3, 2.4, '#2a2a30'); blob(c, 12, 5, 1.6, 1.4, '#fff0a0'); r(c, 8, 4, 6, 1, '#1a1a1a');
    r(c, 10, 9, 1, 6, '#8a8a92'); r(c, 10, 9, 4, 1, '#8a8a92'); r(c, 13, 9, 1, 2, '#8a8a92');
  });
}
