// Gemeinsamer Spielzustand: Inventar, Geld und die Werte des Schnösels.

import type { StoryFlags } from './progress/flags';

export type ItemId = 'bier' | 'kippe' | 'schnaps' | 'fusel' | 'pillen' | 'zeug';

export interface ItemDef {
  id: ItemId;
  name: string;
  price: number; // Einkaufspreis (bzw. Wert, falls nicht kaufbar)
  sucht: number;
  health: number;
  wuerde: number;
  minSucht: number; // ab dieser Sucht nimmt er es an
  shop: 'wirt' | 'automat' | 'dealer' | null;
}

export const ITEMS: ItemDef[] = [
  { id: 'bier', name: 'Bier', price: 3, sucht: 6, health: 4, wuerde: 2, minSucht: 0, shop: 'wirt' },
  { id: 'kippe', name: 'Kippen', price: 4, sucht: 5, health: 3, wuerde: 2, minSucht: 0, shop: 'automat' },
  { id: 'schnaps', name: 'Schnaps', price: 5, sucht: 9, health: 7, wuerde: 3, minSucht: 15, shop: 'wirt' },
  { id: 'fusel', name: 'Fusel', price: 4, sucht: 11, health: 9, wuerde: 4, minSucht: 25, shop: 'wirt' },
  { id: 'pillen', name: 'Pillen', price: 12, sucht: 16, health: 14, wuerde: 6, minSucht: 50, shop: 'dealer' },
  { id: 'zeug', name: 'Zeug', price: 25, sucht: 22, health: 22, wuerde: 8, minSucht: 72, shop: 'dealer' },
];

export const item = (id: ItemId) => ITEMS.find((i) => i.id === id)!;

export const VICTIM = 'Dr. von Glanz';
export const MAX_HEALTH = 260;
/** Sekunden, die er auf seinen Wunsch wartet, bevor er ungeduldig wird */
export const PATIENCE = 12;

function freshState() {
  return {
    running: false,
    time: 0,
    money: 10,
    inv: { bier: 1, kippe: 1, schnaps: 0, fusel: 0, pillen: 0, zeug: 0 } as Record<ItemId, number>,
    uses: { bier: 0, kippe: 0, schnaps: 0, fusel: 0, pillen: 0, zeug: 0 } as Record<ItemId, number>,
    sucht: 0,
    health: MAX_HEALTH,
    wuerde: 100,
    misstrauen: 0,
    wish: null as ItemId | null,
    wishTimer: 6,
    wishSince: 0,
    lastGive: -99,
    consumed: [] as ItemId[],
    dead: false,
    carrying: false,
    bodyInAlley: false,
    gameOver: null as null | 'win' | 'flucht' | 'polizei',
    /** Frist, bis zu der eine Leiche in der Gasse entsorgt sein muss */
    bodyDeadline: null as number | null,
    /** wer dich erwischt hat (bei gameOver 'polizei') */
    caughtBy: 'zeit' as 'zeit' | 'bulle' | 'felix',
    /** bereits gezeigte Story-Zwischenspiele */
    story: { kapitel2: false, kapitel3: false },
    /** Leonards Pillen: bis wann sie wirken (Spielzeit) */
    boost: { speed: 0, bulk: 0 },
    /** Story-Flags der Nebenhandlungen (siehe progress/flags.ts) */
    flags: {} as StoryFlags,
  };
}

export let state = freshState();

/** Leonards Pillen: Preis und Wirkdauer */
export const PILLS = { speed: 12, bulk: 18, duration: 60 };
/** Blaue Pille: 1,5-mal so schnell */
export const speedy = () => state.time < state.boost.speed;
/** Rote Pille: der Wirt ist richtig breit */
export const bulky = () => state.time < state.boost.bulk;

export function resetState() {
  state = freshState();
}

/** 0 = tipptopp … 4 = Wrack, 5 = tot */
export function stage(): number {
  if (state.dead) return 5;
  return lookStage();
}

/** Ist er ungeduldig, weil er zu lange auf seinen Wunsch wartet? */
/** ab dieser Sucht nimmt er unerfüllte Wünsche übel (vorher sind es nur Vorlieben) */
export const WISH_PRESSURE = 8;

export function impatient() {
  return !!state.wish && !state.dead && state.sucht >= WISH_PRESSURE && state.time - state.wishSince > PATIENCE;
}

/** Aussehen-Stufe 0..4, auch nach dem Tod. */
export function lookStage(): number {
  const w = state.wuerde;
  if (w > 80) return 0;
  if (w > 60) return 1;
  if (w > 38) return 2;
  if (w > 15) return 3;
  return 4;
}

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function tick(dt: number) {
  if (!state.running || state.gameOver) return;
  state.time += dt;
  if (state.bodyDeadline !== null && state.time > state.bodyDeadline) {
    state.gameOver = 'polizei';
    return;
  }
  if (state.dead) return;
  state.sucht = Math.max(0, state.sucht - 0.35 * dt);
  // Ohne Nachschub fängt er sich langsam wieder
  if (state.time - state.lastGive > 8) state.wuerde = Math.min(100, state.wuerde + 0.12 * dt);
  state.misstrauen = Math.max(0, state.misstrauen - 0.6 * dt);
  // Ungeduld: wer zu lange auf seinen Wunsch wartet, wird misstrauisch
  if (impatient()) {
    state.misstrauen += 1.5 * dt;
    checkFlucht();
  }

  state.wishTimer -= dt;
  if (state.wishTimer <= 0) {
    // Unerfüllter Wunsch bei starker Sucht: Entzug nagt an ihm
    if (state.wish && state.sucht >= 40) state.wuerde = Math.max(0, state.wuerde - 3);
    state.wishTimer = 10 + Math.random() * 5;
    // Er wünscht sich immer etwas, das er gerade annehmen würde. Früher kam bei Sucht unter 8 gar kein
    // Wunsch: Wer ihn noch nicht bedient hatte, sah nie, was er trinken will.
    const ok = ITEMS.filter((i) => i.minSucht <= state.sucht);
    state.wish = pick(ok.slice(-3)).id;
    state.wishSince = state.time;
  }
}

const LINES: string[][] = [
  ['Hm. Eigentlich trinke ich nur Champagner.', 'Na gut. Aber nur eins.', 'Wie ... rustikal.', 'Mein Butler darf das nicht erfahren.'],
  ['Ach, warum nicht. Harte Woche.', 'Ich hab morgen ein Meeting ...', 'Noch eins schadet ja nicht.', 'Du bist gar nicht so übel, Kumpel.'],
  ['Meeting? Scheiß aufs Meeting!', 'Hast du noch mehr davon?', 'Meine Frau ruft dauernd an. Egal.', 'Hehe ... das knallt.'],
  ['MEHR. Ich brauch MEHR.', 'Mein Porsche? Verkauft. Für das hier.', 'Die Kanzlei hat mich gefeuert. Prost!', 'Kumpel ... du bist mein einziger Freund.'],
  ['Hrrgh ... gib her ...', '*hust* ... danke ... *hust*', 'Ich seh Farben, Kumpel ...', 'Wo ... wo sind meine Schuhe?'],
];

const REFUSE: Partial<Record<ItemId, string>> = {
  schnaps: 'Schnaps? Um diese Uhrzeit? Erst mal was Leichtes.',
  fusel: 'Fusel?! So tief bin ich noch nicht gesunken.',
  pillen: 'Pillen? Ich bin doch kein Junkie!',
  zeug: 'Was ist DAS denn? Sind Sie wahnsinnig?!',
};

export interface GiveResult {
  ok: boolean;
  text: string;
  paid: number;
  wished: boolean;
  stageChanged: boolean;
  died: boolean;
}

export function give(id: ItemId): GiveResult | null {
  if (state.inv[id] <= 0 || state.dead || state.gameOver) return null;
  const def = item(id);
  const before = stage();

  if (state.sucht < def.minSucht) {
    state.misstrauen += 15;
    checkFlucht();
    return { ok: false, text: `${REFUSE[id] ?? 'Nein danke.'} (ab Sucht ${def.minSucht})`, paid: 0, wished: false, stageChanged: false, died: false };
  }

  state.inv[id]--;
  const tol = Math.max(0.4, 1 - state.uses[id] * 0.08);
  state.uses[id]++;
  const wished = state.wish === id;
  const mult = wished ? 1.5 : 1;

  state.sucht = Math.min(100, state.sucht + def.sucht * tol * mult);
  state.health -= def.health * mult * (1 + state.sucht / 150);
  // Er klammert sich ans Leben, bis er ganz unten ist
  if (lookStage() < 4) state.health = Math.max(1, state.health);
  state.wuerde = Math.max(0, state.wuerde - def.wuerde * mult);

  if (!wished && state.time - state.lastGive < 5) state.misstrauen += 16;
  if (wished) {
    state.misstrauen = Math.max(0, state.misstrauen - 15);
    state.wish = null;
    state.wishTimer = 4;
  }
  state.lastGive = state.time;
  state.consumed.push(id);

  // Er zahlt immer, aber nur für Wunsch-Ware richtig gut
  const paid = Math.round(def.price * (wished ? 1.6 : 0.8));
  state.money += paid;

  let died = false;
  if (state.health <= 0) {
    state.health = 0;
    state.dead = true;
    died = true;
  }
  checkFlucht();
  const now = stage();
  const text = died ? '...urgh ...' : pick(LINES[Math.min(now, 4)]);
  return { ok: true, text, paid, wished, stageChanged: now !== before, died };
}

function checkFlucht() {
  if (state.misstrauen >= 100) {
    state.misstrauen = 100;
    state.gameOver = 'flucht';
  }
}
