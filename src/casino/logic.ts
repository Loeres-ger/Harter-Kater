// Spiellogik der Automaten – ohne Phaser, damit sie sich simulieren und abstimmen lässt.
// grid[spalte][zeile], Zeile 0 = oben.

export type Grid = string[][];
export type Rand = () => number;

/** Reproduzierbarer Zufall für die Walzenstreifen (feste, abgestimmte Walzen) */
function seeded(seed: number): Rand {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function strip(weights: Record<string, number>, rand: Rand) {
  const s: string[] = [];
  for (const [k, n] of Object.entries(weights)) for (let i = 0; i < n; i++) s.push(k);
  // gemischt, damit gleiche Symbole nicht nebeneinander kleben
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]];
  }
  return s;
}

function spinStrips(strips: string[][], rows: number, rand: Rand): Grid {
  return strips.map((s) => {
    const pos = Math.floor(rand() * s.length);
    return Array.from({ length: rows }, (_, r) => s[(pos + r) % s.length]);
  });
}

export interface LineWin {
  line: number;
  cells: [number, number][];
  win: number;
}

// ---------------------------------------------------------------- ALLES SAHNE (3×3, 5 Linien)

export const SAHNE_LINES = [
  [1, 1, 1],
  [0, 0, 0],
  [2, 2, 2],
  [0, 1, 2],
  [2, 1, 0],
];
const SAHNE_WEIGHTS = { fs_kirsche: 5, fs_zitrone: 4, fs_pflaume: 4, fs_melone: 3, fs_glocke: 2, fs_sieben: 1, fs_sahne: 1 };
/** Auszahlung für drei Gleiche auf einer Linie, als Vielfaches des Einsatzes */
export const SAHNE_PAY: Record<string, number> = { fs_kirsche: 2, fs_zitrone: 5, fs_pflaume: 4, fs_melone: 10, fs_glocke: 20, fs_sieben: 60, fs_sahne: 150 };
export const SAHNE_SYMBOLS = Object.keys(SAHNE_WEIGHTS);

/** Feste Walzen; Startwert per Simulation gewählt: Auszahlungsquote ≈ 93 % */
export function makeSahneStrips() {
  const rand = seeded(1);
  return [0, 1, 2].map(() => strip(SAHNE_WEIGHTS, rand));
}

export function spinSahne(strips: string[][], rand: Rand) {
  return spinStrips(strips, 3, rand);
}

export function evalSahne(g: Grid, bet: number) {
  const wins: LineWin[] = [];
  SAHNE_LINES.forEach((rows, line) => {
    const s = g[0][rows[0]];
    if (g[1][rows[1]] === s && g[2][rows[2]] === s) {
      wins.push({ line, cells: rows.map((r, c) => [c, r] as [number, number]), win: SAHNE_PAY[s] * bet });
    }
  });
  return { wins, total: wins.reduce((a, w) => a + w.win, 0) };
}

/** Risikoleiter: Chance, dass das Verdoppeln klappt */
export const RISK_CHANCE = 0.48;
export const RISK_STEPS = 5;

// ---------------------------------------------------------------- BUCH DER RATTE (5×3, 10 Linien)

export const RATTE_LINES = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [1, 2, 2, 2, 1],
  [1, 0, 0, 0, 1],
  [2, 2, 1, 0, 0],
  [0, 0, 1, 2, 2],
  [2, 1, 1, 1, 0],
];
export const BOOK = 'br_buch';
const RATTE_WEIGHTS = { br_10: 11, br_j: 11, br_q: 9, br_k: 7, br_a: 7, br_kaese: 4, br_tonne: 4, br_ratte: 3, br_koenig: 2, br_buch: 2 };
/** Gewinn pro Linie (Vielfaches des Linieneinsatzes) für 2..5 Gleiche von links */
export const RATTE_PAY: Record<string, Record<number, number>> = {
  br_10: { 3: 5, 4: 20, 5: 100 },
  br_j: { 3: 5, 4: 20, 5: 100 },
  br_q: { 3: 4, 4: 20, 5: 100 },
  br_k: { 3: 5, 4: 30, 5: 125 },
  br_a: { 3: 5, 4: 30, 5: 125 },
  br_kaese: { 3: 20, 4: 80, 5: 400 },
  br_tonne: { 3: 20, 4: 80, 5: 400 },
  br_ratte: { 2: 5, 3: 30, 4: 100, 5: 750 },
  br_koenig: { 2: 10, 3: 100, 4: 1000, 5: 5000 },
};
/** Scatter-Gewinn (Vielfaches des Gesamteinsatzes) für 3..5 Bücher irgendwo */
export const BOOK_SCATTER: Record<number, number> = { 3: 2, 4: 20, 5: 200 };
export const FREE_SPINS = 10;
export const RATTE_SYMBOLS = Object.keys(RATTE_WEIGHTS);
export const EXPANDABLE = Object.keys(RATTE_PAY);

/** Feste Walzen; Startwert per Simulation gewählt: Auszahlungsquote ≈ 93 %, Freispiele etwa alle 110 Drehungen */
export function makeRatteStrips() {
  const rand = seeded(4);
  return [0, 1, 2, 3, 4].map(() => strip(RATTE_WEIGHTS, rand));
}

export function spinRatte(strips: string[][], rand: Rand) {
  return spinStrips(strips, 3, rand);
}

export interface RatteResult {
  wins: LineWin[];
  books: number;
  scatter: number;
  /** Felder des sich ausbreitenden Symbols (nur in Freispielen) */
  expanded: number[];
  expandWin: number;
  total: number;
}

export function evalRatte(g: Grid, bet: number, expand: string | null = null): RatteResult {
  const lineBet = bet / 10;
  const wins: LineWin[] = [];
  RATTE_LINES.forEach((rows, line) => {
    const syms = rows.map((r, c) => g[c][r]);
    const first = syms.find((s) => s !== BOOK);
    if (!first) return; // fünf Bücher: zählt nur als Scatter
    let n = 0;
    while (n < 5 && (syms[n] === first || syms[n] === BOOK)) n++;
    const pay = RATTE_PAY[first]?.[n];
    if (pay) wins.push({ line, cells: rows.slice(0, n).map((r, c) => [c, r] as [number, number]), win: pay * lineBet });
  });
  const books = g.flat().filter((s) => s === BOOK).length;
  const scatter = (BOOK_SCATTER[books] ?? 0) * bet;

  // Freispiele: das gewählte Symbol breitet sich über ganze Walzen aus und zahlt auf allen Linien
  let expanded: number[] = [];
  let expandWin = 0;
  if (expand) {
    const reels = g.map((col, c) => (col.includes(expand) ? c : -1)).filter((c) => c >= 0);
    const pay = RATTE_PAY[expand][reels.length];
    if (pay) {
      expanded = reels;
      expandWin = pay * lineBet * 10;
    }
  }
  const total = wins.reduce((a, w) => a + w.win, 0) + scatter + expandWin;
  return { wins, books, scatter, expanded, expandWin, total };
}

// ---------------------------------------------------------------- KLEPPER-DERBY

export const HORSE_NAMES = ['Blitz-Berta', 'Alte Mähre', 'Kalles Glück', 'Gaul Gustav', 'Schnecke', 'Bauträger'];
const BASE_ODDS = [3, 4, 5, 7, 10, 15];

/** Neue Quoten für ein Rennen: Favoriten werden jedes Mal neu verteilt. */
export function makeOdds(rand: Rand) {
  const o = [...BASE_ODDS];
  for (let i = o.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [o[i], o[j]] = [o[j], o[i]];
  }
  return o;
}

/** Gewinner ziehen: Wahrscheinlichkeit proportional zu 1/Quote (Buchmacher-Marge ≈ 9 %). */
export function pickWinner(odds: number[], rand: Rand) {
  const w = odds.map((o) => 1 / o);
  const sum = w.reduce((a, b) => a + b, 0);
  let x = rand() * sum;
  for (let i = 0; i < w.length; i++) {
    x -= w[i];
    if (x <= 0) return i;
  }
  return w.length - 1;
}
