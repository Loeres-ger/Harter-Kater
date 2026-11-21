// „Hölle mit Rücken“ – Nicks Keller-Song. Eigene Komposition für Harter Karter, E-Moll, 160 BPM, 112 Takte (2:48 plus
// Ausklang = 2:50). Instrumental-Metal: Galopp-Riff, Strophe mit Lead-Melodie als „Gesang“, Pre-Chorus, Refrain, Soli
// (Nick spielt vor, der Wirt antwortet, dann im Wechsel), Breakdown, letzter Refrain, Schluss.
//
// Aus denselben Ereignissen entstehen Musik (audio.ts spielt sie Schritt für Schritt) und die Noten des Gitarrenduells
// (CHART). Deshalb liegt jede Note exakt auf dem Takt.

export const KELLER_BPM = 160;
export const SONG_BARS = 112;
/** Sekunden pro Sechzehntel */
export const STEP_S = 60 / KELLER_BPM / 4;

type Kind = 'gtr' | 'mute' | 'lead' | 'bass' | 'kick' | 'snare' | 'hat' | 'crash' | 'tom' | 'chor';
export interface Ev {
  /** Schritt (Sechzehntel ab Songbeginn) */
  s: number;
  k: Kind;
  n: number;
  /** Länge in Sechzehnteln */
  len: number;
  v: number;
  /** Nicks Solo-Töne (im Duell nur zum Zuschauen) */
  nick?: boolean;
}

/** Was audio.ts zum Abspielen anbietet (keine Abhängigkeit in die andere Richtung) */
export interface SongSpieler {
  gtr(note: number, t: number, dur: number, vol: number, muted?: boolean, clean?: boolean): void;
  lead(note: number, t: number, dur: number, vol: number, clean?: boolean): void;
  bass(note: number, t: number, dur: number, vol: number): void;
  kickM(t: number, vol?: number): void;
  snareM(t: number, vol?: number): void;
  hat(t: number, vol?: number): void;
  crash(t: number, vol?: number): void;
  tom(note: number, t: number, vol?: number): void;
  chor(note: number, t: number, dur: number, vol: number): void;
}

const E = 40, F = 41, Fs = 42, G = 43, A = 45, B = 47, C = 48, D = 50;

// ---------------------------------------------------------------- Abschnitte

export interface Abschnitt { name: string; von: number; bis: number; chart: 'nick' | 'rhythmus' | 'lead' | 'pause'; ohneChugs?: boolean }
export const ABSCHNITTE: Abschnitt[] = [
  { name: 'NICK LEGT VOR', von: 0, bis: 4, chart: 'nick' },
  { name: 'INTRO', von: 4, bis: 16, chart: 'rhythmus' },
  { name: 'STROPHE', von: 16, bis: 32, chart: 'lead' },
  { name: 'PRE-CHORUS', von: 32, bis: 40, chart: 'rhythmus' },
  { name: 'REFRAIN', von: 40, bis: 56, chart: 'lead' },
  { name: 'RIFF', von: 56, bis: 64, chart: 'rhythmus' },
  { name: 'NICKS SOLO', von: 64, bis: 72, chart: 'nick' },
  { name: 'DEIN SOLO', von: 72, bis: 80, chart: 'lead' },
  { name: 'SOLO-DUELL', von: 80, bis: 88, chart: 'lead' },
  { name: 'BREAKDOWN', von: 88, bis: 96, chart: 'rhythmus', ohneChugs: true },
  { name: 'LETZTER REFRAIN', von: 96, bis: 108, chart: 'lead' },
  { name: 'FINALE', von: 108, bis: 112, chart: 'rhythmus' },
];
export const abschnittBei = (bar: number) => ABSCHNITTE.find((a) => bar >= a.von && bar < a.bis) ?? ABSCHNITTE[ABSCHNITTE.length - 1];

// ---------------------------------------------------------------- Komposition

const ev: Ev[] = [];
const put = (bar: number, step: number, k: Kind, n = 0, len = 1, v = 1, nick = false) => ev.push({ s: bar * 16 + step, k, n, len, v, nick });
type Mel = [number, number, number][]; // Schritt, Note, Länge
const mel = (bar: number, m: Mel, shift = 0, nick = false, v = 1) => { for (const [s, n, l] of m) put(bar, s, 'lead', n + shift, l, v, nick); };

function hats(bar: number, every = 2, v = 1) { for (let i = 0; i < 16; i += every) put(bar, i, 'hat', 0, 1, (i % 4 === 0 ? 1 : 0.6) * v); }
function rock(bar: number, o: { double?: boolean; crash?: boolean } = {}) {
  if (o.crash) put(bar, 0, 'crash');
  hats(bar);
  if (o.double) for (let i = 0; i < 16; i += 1) put(bar, i, 'kick', 0, 1, 0.75);
  else for (const i of [0, 3, 6, 8, 10, 11]) put(bar, i, 'kick');
  put(bar, 4, 'snare'); put(bar, 12, 'snare');
}
function galoppDrums(bar: number, crash = false) {
  if (crash) put(bar, 0, 'crash');
  for (const i of [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]) put(bar, i, 'kick', 0, 1, 0.85);
  put(bar, 4, 'snare'); put(bar, 12, 'snare');
  hats(bar);
}
function fill(bar: number) {
  for (const i of [0, 4]) put(bar, i, 'kick');
  put(bar, 4, 'snare');
  [64, 64, 62, 62, 59, 59, 55, 55].forEach((n, k) => put(bar, 8 + k, 'tom', n, 1, 0.9));
}
function wirbel(bar: number) { for (let i = 0; i < 16; i++) put(bar, i, 'snare', 0, 1, 0.35 + i * 0.04); for (let i = 0; i < 16; i += 2) put(bar, i, 'kick', 0, 1, 0.8); }

/** Hauptriff: Galopp auf E, dann G–F# bzw. C–B–A */
function riff(bar: number, variant: number, root = E) {
  const t = root - E;
  for (const i of [0, 2, 3, 4, 6, 7]) put(bar, i, i === 0 ? 'gtr' : 'mute', root, i === 0 ? 2 : 1);
  if (variant % 2 === 0) { put(bar, 8, 'gtr', G + t, 2); put(bar, 10, 'gtr', Fs + t, 2); for (const i of [12, 14, 15]) put(bar, i, 'mute', root); }
  else { put(bar, 8, 'gtr', C + t, 3); put(bar, 11, 'gtr', B + t, 3); put(bar, 14, 'gtr', A + t, 2); }
}

/** Strophe: Sechzehntel-Chug auf E, am Taktanfang ein Akzent */
function strophe(bar: number, i: number) {
  const acc = [E, G, E, A, E, C, B, B][i % 8];
  put(bar, 0, 'gtr', acc, 3);
  for (let s = 3; s < 16; s++) put(bar, s, 'mute', E, 1, s % 4 === 0 ? 0.95 : 0.75);
}

const M_STROPHE: Mel[] = [
  [[0, 71, 4], [4, 71, 2], [6, 69, 2], [8, 67, 4], [12, 69, 4]],
  [[0, 71, 6], [6, 74, 2], [8, 71, 8]],
  [[0, 76, 4], [4, 74, 2], [6, 71, 2], [8, 69, 4], [12, 67, 4]],
  [[0, 69, 12]],
  [[0, 67, 4], [4, 67, 2], [6, 69, 2], [8, 71, 4], [12, 72, 4]],
  [[0, 71, 4], [4, 69, 4], [8, 67, 4], [12, 66, 4]],
  [[0, 64, 4], [4, 66, 2], [6, 67, 2], [8, 69, 4], [12, 71, 4]],
  [[0, 71, 14]],
];
const M_REFRAIN: Mel[] = [
  [[0, 76, 6], [6, 74, 2], [8, 71, 4], [12, 74, 4]],
  [[0, 76, 6], [6, 79, 2], [8, 76, 8]],
  [[0, 74, 6], [6, 71, 2], [8, 67, 4], [12, 71, 4]],
  [[0, 69, 6], [6, 71, 2], [8, 66, 8]],
  [[0, 76, 4], [4, 78, 4], [8, 79, 6], [14, 78, 2]],
  [[0, 76, 6], [6, 74, 2], [8, 76, 8]],
  [[0, 71, 4], [4, 74, 4], [8, 79, 4], [12, 78, 4]],
  [[0, 76, 14]],
];
const M_DEIN_SOLO: Mel[] = [
  [[0, 67, 2], [2, 69, 2], [4, 71, 4], [8, 76, 4], [12, 74, 2], [14, 71, 2]],
  [[0, 72, 6], [6, 71, 2], [8, 69, 8]],
  [[0, 69, 2], [2, 71, 2], [4, 72, 4], [8, 74, 4], [12, 72, 2], [14, 69, 2]],
  [[0, 71, 12], [12, 75, 4]],
  [[0, 76, 2], [2, 78, 2], [4, 79, 4], [8, 78, 2], [10, 76, 2], [12, 75, 4]],
  [[0, 76, 4], [4, 71, 4], [8, 67, 4], [12, 64, 4]],
  [[0, 66, 2], [2, 67, 2], [4, 69, 2], [6, 71, 2], [8, 72, 2], [10, 75, 2], [12, 76, 4]],
  [[0, 83, 16]],
];
/** E harmonisch Moll für Nicks Läufe */
const HM = [64, 66, 67, 69, 71, 72, 75, 76, 78, 79, 81, 83, 84, 87, 88];

/** Nicks Lauf: Sechzehntel rauf, runter, Zickzack – mit einem gezogenen Ton am Ende */
function nickLauf(bar: number, art: number) {
  const start = [7, 14, 9, 11][art % 4];
  for (let i = 0; i < 14; i++) {
    let idx: number;
    if (art % 4 === 0) idx = start + i % 8;
    else if (art % 4 === 1) idx = start - i;
    else if (art % 4 === 2) idx = start + ((i % 4) < 2 ? i % 4 : 4 - (i % 4)) + Math.floor(i / 4);
    else idx = start - (i % 3) + Math.floor(i / 3) % 3;
    put(bar, i, 'lead', HM[Math.max(0, Math.min(HM.length - 1, idx))], 1, 0.95, true);
  }
  put(bar, 14, 'lead', HM[Math.min(HM.length - 1, start + 3)], 2, 1, true);
}

function akkord(bar: number, root: number, mutes = true) {
  put(bar, 0, 'gtr', root, 8);
  put(bar, 8, 'gtr', root, 8);
  if (mutes) for (let i = 2; i < 16; i += 2) if (i !== 8) put(bar, i, 'mute', root, 1, 0.55);
}

// Intro: Nick legt vor (Takte 0–3), dann die ganze Band
put(0, 0, 'crash'); put(0, 0, 'gtr', E, 16, 0.8);
for (let i = 0; i < 16; i++) put(0, i, 'lead', 76, 1, 0.5 + i * 0.03, true); // Tremolo auf dem hohen E
nickLauf(1, 1);
nickLauf(2, 0);
put(3, 0, 'lead', 83, 8, 1, true); put(3, 8, 'lead', 84, 4, 1, true); put(3, 12, 'lead', 83, 4, 1, true);
fill(3);
for (let b = 4; b < 16; b++) { riff(b, b % 2); galoppDrums(b, b % 4 === 0); }
// Zwillingsgitarren-Harmonie über dem Riff
mel(12, [[0, 76, 4], [4, 74, 4], [8, 71, 4], [12, 69, 4]], 0, false, 0.6);
mel(13, [[0, 67, 4], [4, 69, 4], [8, 71, 8]], 0, false, 0.6);
mel(14, [[0, 76, 4], [4, 78, 4], [8, 79, 4], [12, 78, 4]], 0, false, 0.6);
mel(15, [[0, 76, 12]], 0, false, 0.6);
fill(15);
// Strophe
for (let i = 0; i < 16; i++) { strophe(16 + i, i); rock(16 + i, { crash: i === 0 }); mel(16 + i, M_STROPHE[i % 8]); }
// Pre-Chorus: C – C – D – D – E – E – B – B
[C, C, D, D, E, E, B, B].forEach((root, i) => { akkord(32 + i, root); if (i < 6) rock(32 + i, { crash: i % 2 === 0, double: i >= 4 }); });
wirbel(38); wirbel(39);
// Refrain: Em – C – G – D
const REF = [E, C, G, D];
const refrain = (von: number, takte: number, hoch = false) => {
  for (let i = 0; i < takte; i++) {
    akkord(von + i, REF[i % 4], false);
    rock(von + i, { crash: true, double: true });
    mel(von + i, M_REFRAIN[i % 8]);
    if (hoch) mel(von + i, M_REFRAIN[i % 8], 4, false, 0.35); // Terz darüber, leise
    if (i % 4 === 0) put(von + i, 0, 'chor', REF[i % 4] + 24, 16, 0.6);
  }
};
refrain(40, 16);
// Riff in A, Harmonien darüber
for (let b = 56; b < 64; b++) { riff(b, b % 2, A); galoppDrums(b, b % 4 === 0); }
mel(60, [[0, 81, 4], [4, 79, 4], [8, 76, 4], [12, 74, 4]], 0, false, 0.55);
mel(61, [[0, 72, 4], [4, 74, 4], [8, 76, 8]], 0, false, 0.55);
fill(63);
// Soli über Em – C – D – B (Galopp darunter)
const SOLO = [E, E, C, C, D, D, B, B];
const soloRhythmus = (bar: number, i: number) => {
  const root = SOLO[i % 8];
  put(bar, 0, 'gtr', root, 2);
  for (const s of [2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]) put(bar, s, 'mute', root, 1, 0.7);
  galoppDrums(bar, i % 2 === 0);
};
for (let i = 0; i < 8; i++) { soloRhythmus(64 + i, i); nickLauf(64 + i, i); }
for (let i = 0; i < 8; i++) { soloRhythmus(72 + i, i); mel(72 + i, M_DEIN_SOLO[i]); }
for (let i = 0; i < 8; i++) {
  soloRhythmus(80 + i, i);
  if (Math.floor(i / 2) % 2 === 0) nickLauf(80 + i, i + 1);
  else mel(80 + i, M_DEIN_SOLO[(i % 4) + (i >= 4 ? 2 : 0)]);
}
// Breakdown: halbes Tempo, tief und schwer
for (let i = 0; i < 8; i++) {
  const bar = 88 + i;
  if (i === 7) { wirbel(bar); put(bar, 0, 'gtr', E, 8); continue; }
  for (const s of [0, 3, 6, 10, 12]) put(bar, s, 'gtr', E, 2, 1);
  for (const s of [1, 4, 7, 8, 11, 13, 14]) put(bar, s, 'mute', E, 1, 0.6);
  put(bar, 0, 'crash'); if (i % 2) put(bar, 8, 'crash', 0, 1, 0.7);
  for (const s of [0, 3, 6, 10, 12]) put(bar, s, 'kick');
  put(bar, 8, 'snare');
  hats(bar, 4);
  if (i % 4 === 0) put(bar, 0, 'chor', 64, 32, 0.7);
}
// Letzter Refrain mit zweiter Stimme
refrain(96, 8, true);
[E, E, C, D].forEach((root, i) => { akkord(104 + i, root, false); rock(104 + i, { crash: true, double: true }); });
mel(104, [[0, 79, 8], [8, 78, 8]]); mel(105, [[0, 76, 16]]); mel(106, [[0, 76, 4], [4, 79, 4], [8, 84, 8]]); mel(107, [[0, 83, 8], [8, 81, 4], [12, 78, 4]]);
// Finale: Riff, drei Schläge, Schlussakkord
riff(108, 0); galoppDrums(108, true);
riff(109, 1); galoppDrums(109);
for (const s of [0, 4, 8]) { put(110, s, 'gtr', E, 3); put(110, s, 'kick'); put(110, s, 'crash', 0, 1, 0.7); }
fill(110);
put(111, 0, 'gtr', E, 32, 1); put(111, 0, 'crash'); put(111, 0, 'kick'); put(111, 0, 'chor', 64, 32, 0.7);
put(111, 0, 'lead', 88, 24, 0.8);

// Bass verdoppelt alle Gitarren-Grundtöne eine Oktave tiefer
for (const e of ev.slice()) if (e.k === 'gtr' || e.k === 'mute') ev.push({ s: e.s, k: 'bass', n: e.n - 12, len: e.len, v: e.k === 'gtr' ? 1 : 0.7 });

export const SONG: Ev[] = ev.sort((a, b) => a.s - b.s);
const PRO_SCHRITT = new Map<number, Ev[]>();
for (const e of SONG) { const l = PRO_SCHRITT.get(e.s); if (l) l.push(e); else PRO_SCHRITT.set(e.s, [e]); }

// ---------------------------------------------------------------- Abspielen

export interface SongOpt {
  /** clean: ohne Verzerrung (Nick in Weiß) */
  clean?: boolean;
  /** Lead leiser (Hintergrund im Keller) */
  leadVol?: number;
}

export function spieleSchritt(a: SongSpieler, step: number, t: number, d: number, o: SongOpt = {}) {
  const list = PRO_SCHRITT.get(step);
  if (!list) return;
  for (const e of list) {
    const dur = e.len * d;
    switch (e.k) {
      case 'gtr': a.gtr(e.n, t, dur, 0.15 * e.v, false, o.clean); break;
      case 'mute': a.gtr(e.n, t, dur, 0.12 * e.v, true, o.clean); break;
      case 'lead': a.lead(e.n, t, dur, 0.085 * e.v * (o.leadVol ?? 1), o.clean); break;
      case 'bass': a.bass(e.n, t, dur, 0.16 * e.v); break;
      case 'kick': a.kickM(t, 0.42 * e.v); break;
      case 'snare': a.snareM(t, 0.2 * e.v); break;
      case 'hat': a.hat(t, 0.035 * e.v); break;
      case 'crash': a.crash(t, 0.07 * e.v); break;
      case 'tom': a.tom(e.n, t, 0.3 * e.v); break;
      case 'chor': a.chor(e.n, t, dur, 0.05 * e.v); break;
    }
  }
}

/** Hintergrundmusik im Keller: Intro, Strophe und Refrain in Schleife (ab Takt 4, 52 Takte) */
export const KELLER_LOOP = { von: 4, takte: 52 };
/** Clean-Version (Nick in Weiß): Refrain ohne Zerre, gemütlich */
export const CLEAN_LOOP = { von: 40, takte: 16 };

// ---------------------------------------------------------------- Noten fürs Gitarrenduell

export interface ChartNote {
  /** Schritt und Zeit ab Songbeginn (Sekunden) */
  step: number;
  t: number;
  lane: number;
  /** Haltedauer in Sekunden (0 = antippen) */
  hold: number;
  /** Nicks Töne: nur zum Zuschauen */
  nick: boolean;
}

/** Spur nach Grundton: E links, dann G/F#, A/B, C/D rechts */
const laneRoot = (n: number) => ({ 4: 0, 6: 1, 7: 1, 9: 2, 11: 2, 0: 3, 2: 3, 5: 3, 3: 3 } as Record<number, number>)[((n % 12) + 12) % 12] ?? 1;

export function baueChart(): ChartNote[] {
  const out: Omit<ChartNote, 't'>[] = [];
  for (const sec of ABSCHNITTE) {
    const evs = SONG.filter((e) => e.s >= sec.von * 16 && e.s < sec.bis * 16);
    if (sec.chart === 'rhythmus') {
      const akzent = new Set(evs.filter((e) => e.k === 'gtr').map((e) => e.s));
      for (const e of evs) {
        if (e.k === 'gtr') out.push({ step: e.s, lane: laneRoot(e.n), hold: e.len >= 6 ? e.len : 0, nick: false });
        else if (e.k === 'mute' && !sec.ohneChugs && e.s % 4 === 0 && !akzent.has(e.s)) out.push({ step: e.s, lane: (e.s / 4) % 2, hold: 0, nick: false });
      }
    } else if (sec.chart === 'lead' || sec.chart === 'nick') {
      const leads = evs.filter((e) => e.k === 'lead' && (e.nick || e.v >= 0.9));
      // Spur nach Tonhöhe innerhalb einer Zwei-Takt-Phrase: tief links, hoch rechts
      for (let p = sec.von; p < sec.bis; p += 2) {
        const ph = leads.filter((e) => e.s >= p * 16 && e.s < (p + 2) * 16);
        const tone = [...new Set(ph.map((e) => e.n))].sort((a, b) => a - b);
        for (const e of ph) {
          const rank = tone.indexOf(e.n);
          const lane = tone.length === 1 ? 1 + (p % 2) : Math.round((rank * 3) / (tone.length - 1));
          out.push({ step: e.s, lane, hold: e.len >= 6 ? e.len : 0, nick: !!e.nick });
        }
      }
    }
  }
  const seen = new Set<number>();
  return out
    .sort((a, b) => a.step - b.step)
    .filter((n) => (seen.has(n.step) ? false : (seen.add(n.step), true)))
    .map((n) => ({ ...n, t: n.step * STEP_S, hold: n.hold * STEP_S }));
}
