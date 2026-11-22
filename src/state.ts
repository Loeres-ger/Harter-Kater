// Gemeinsamer Spielzustand: Inventar, Geld und die Werte des Schnösels.

import type { StoryFlags } from './progress/flags';

export type ItemId = 'bier' | 'kippe' | 'schnaps' | 'fusel' | 'pillen' | 'zeug' | 'wurst' | 'kaese' | 'curry' | 'lassi' | 'pflanze' | 'koks';

export interface ItemDef {
  id: ItemId;
  name: string;
  price: number; // Einkaufspreis (bzw. Wert, falls nicht kaufbar)
  sucht: number;
  minSucht: number; // ab dieser Sucht nimmt er es an
  shop: 'wirt' | 'automat' | 'dealer' | 'laden' | 'basar' | null;
  /** Inventar: Knopf, Beschreibung, Wirkung auf den Wirt */
  verb: string;
  text: string;
  wirkung: string;
  /** Quest-Ware: lässt sich nicht selbst benutzen, taucht im Inventar nur auf, wenn man sie hat */
  quest?: boolean;
  /** höchstens so viele (Laden) */
  max?: number;
  /** nur dann im Laden */
  zeigen?: () => boolean;
  /** Antwort, wenn man sie selbst benutzen will */
  nein?: string;
}

export const ITEMS: ItemDef[] = [
  { id: 'bier', name: 'Bier', price: 3, sucht: 6, minSucht: 0, shop: 'wirt', verb: 'TRINKEN', text: 'Ein kühles Blondes. Macht kurz glücklich und dann ein bisschen schief.', wirkung: 'Rausch +1' },
  { id: 'kippe', name: 'Kippen', price: 4, sucht: 5, minSucht: 0, shop: 'automat', verb: 'RAUCHEN', text: 'Eine Kippe. Danach riecht die Jacke wieder nach Zuhause.', wirkung: 'Qualm, kurz Ruhe' },
  { id: 'schnaps', name: 'Schnaps', price: 5, sucht: 9, minSucht: 15, shop: 'wirt', verb: 'TRINKEN', text: 'Ein Klarer. Brennt zweimal: einmal im Hals, einmal im Gewissen.', wirkung: 'Rausch +2' },
  { id: 'fusel', name: 'Fusel', price: 4, sucht: 11, minSucht: 25, shop: 'wirt', verb: 'TRINKEN', text: 'Selbstgebrannt. Schmeckt nach Tankstelle, wirkt wie ein Tritt.', wirkung: 'Rausch +3' },
  { id: 'pillen', name: 'Pillen', price: 12, sucht: 16, minSucht: 50, shop: 'dealer', verb: 'SCHLUCKEN', text: 'Bunte Pillen vom Dealer. Danach läufst du schneller, als du denken kannst.', wirkung: 'Tempo, 30 Sekunden' },
  { id: 'zeug', name: 'Zeug', price: 25, sucht: 22, minSucht: 72, shop: 'dealer', verb: 'NEHMEN', text: 'Keiner weiß, was drin ist. Die Wände wissen es gleich.', wirkung: 'Alles wird bunt, 25 Sekunden' },
];

/** Waren, die nicht über den Tresen an Glanz gehen, sondern nur ins Inventar (Mayas Feinkost) */
export const EXTRA_ITEMS: ItemDef[] = [
  { id: 'wurst', name: 'Wurst', price: 4, sucht: 0, minSucht: 0, shop: 'laden', verb: 'ESSEN', text: 'Mayas Hausmacher. Macht satt und ein bisschen nüchtern.', wirkung: 'Rausch -1' },
  { id: 'kaese', name: 'Käse', price: 5, sucht: 0, minSucht: 0, shop: 'laden', verb: 'ESSEN', text: 'Bergkäse vom Stück. Riecht nach Kalle, schmeckt besser.', wirkung: 'Rausch -1' },
  // Masala Basar (Adshayan)
  { id: 'curry', name: 'Curry', price: 5, sucht: 0, minSucht: 0, shop: 'basar', verb: 'ESSEN', text: 'Adshayans Hauscurry mit Reis. Scharf, aber ehrlich. Diesmal bleibt es drin.', wirkung: 'Rausch -1' },
  { id: 'lassi', name: 'Lassi', price: 4, sucht: 0, minSucht: 0, shop: 'basar', verb: 'TRINKEN', text: 'Mango-Lassi, kalt und dick wie Pudding. Löscht jedes Feuer, auch das vom Fusel.', wirkung: 'Rausch -2' },
];
/** Quest-Waren (Nick-Strang): nicht benutzbar */
export const QUEST_ITEMS: ItemDef[] = [
  { id: 'pflanze', name: 'Pflanze', price: 0, sucht: 0, minSucht: 0, shop: null, quest: true, verb: 'FINGER WEG', text: 'Bornas Pflanze aus dem Busch hinter der Bar. Noch klein, riecht aber schon nach Ärger.', wirkung: 'Für Borna auf dem Dachboden', nein: 'Die ist für Borna. Nicht rauchen, nicht gießen, nicht mit ihr reden.' },
  { id: 'koks', name: 'Koks', price: 20, sucht: 0, minSucht: 0, shop: 'dealer', quest: true, max: 5, zeigen: () => state.flags.nick === 'koks', verb: 'FINGER WEG', text: 'Eine Ladung vom Dealer hinten. Für Nick. Nur für Nick.', wirkung: 'Nick will fünf Stück', nein: 'Das ist für Nick, Horst. Finger weg.' },
];
export const ALL_ITEMS: ItemDef[] = [...ITEMS, ...EXTRA_ITEMS, ...QUEST_ITEMS];

export const item = (id: ItemId) => ALL_ITEMS.find((i) => i.id === id)!;

export const VICTIM = 'Dr. von Glanz';
/** Sekunden, die er auf seinen Wunsch wartet, bevor er ungeduldig wird */
export const PATIENCE = 12;
/** Verfall pro Sucht-Punkt einer Gabe: etwa sechs Gaben vom ersten Bier bis zur Todesszene */
export const VERFALL_FAKTOR = 1.6;

function freshState() {
  return {
    running: false,
    time: 0,
    money: 10,
    inv: { bier: 1, kippe: 1, schnaps: 0, fusel: 0, pillen: 0, zeug: 0, wurst: 0, kaese: 0, curry: 0, lassi: 0, pflanze: 0, koks: 0 } as Record<ItemId, number>,
    uses: { bier: 0, kippe: 0, schnaps: 0, fusel: 0, pillen: 0, zeug: 0, wurst: 0, kaese: 0, curry: 0, lassi: 0, pflanze: 0, koks: 0 } as Record<ItemId, number>,
    /** was der Wirt selbst genommen hat: bis wann Rausch, Qualm und bunte Wände anhalten (Spielzeit) */
    wirt: { rauschBis: 0, rauchBis: 0, tripBis: 0 },
    sucht: 0,
    misstrauen: 0,
    /** wie weit Glanz heruntergekommen ist (0..100, bei 100 stirbt er) */
    verfall: 0,
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

/** Gespeicherten Kapitelstand übernehmen. Fehlende oder neue Felder kommen aus einem frischen Spielstand,
 *  damit auch Stände aus älteren Versionen laden. */
export function loadState(data: Record<string, unknown>) {
  const fresh = freshState();
  const d = data as Partial<typeof fresh>;
  const obj = <T extends object>(base: T, v: unknown): T => ({ ...base, ...(v && typeof v === 'object' ? v : {}) });
  state = {
    ...fresh,
    ...d,
    inv: obj(fresh.inv, d.inv),
    uses: obj(fresh.uses, d.uses),
    story: obj(fresh.story, d.story),
    boost: obj(fresh.boost, d.boost),
    wirt: obj(fresh.wirt, d.wirt),
    flags: obj(fresh.flags, d.flags),
    consumed: Array.isArray(d.consumed) ? d.consumed : [],
  };
  // Stände vor dem Umbau kannten nur Würde (100 = tipptopp): daraus den Verfall ableiten
  const alt = data as { wuerde?: unknown };
  if (typeof d.verfall !== 'number' && typeof alt.wuerde === 'number') state.verfall = Math.max(0, Math.min(99, 100 - alt.wuerde));
  if (state.dead) state.verfall = 100;
  state.running = true;
  state.gameOver = null;
}

// ---------------------------------------------------------------- Inventar: der Wirt nimmt selbst

/** Sekunden Rausch pro Stufe */
const RAUSCH_STUFE = 20;
/** Rausch des Wirts, 0 (nüchtern) bis 5 (sternhagelvoll) */
export const rauschStufe = () => Math.max(0, Math.min(5, Math.ceil((state.wirt.rauschBis - state.time) / RAUSCH_STUFE)));
export const raucht = () => state.time < state.wirt.rauchBis;
export const tript = () => state.time < state.wirt.tripBis;
/** Animationen, die die laufende Draufsicht-Szene am Wirt abspielt (TopDown) */
export const wirtAktionen: ItemId[] = [];

/** Ein Item aus dem Inventar selbst benutzen. false, wenn keins mehr da ist. */
export function benutze(id: ItemId) {
  if (state.inv[id] <= 0 || item(id).quest) return false;
  state.inv[id]--;
  const w = state.wirt, now = state.time;
  const rausch = (n: number) => { w.rauschBis = Math.max(w.rauschBis, now) + n * RAUSCH_STUFE; };
  if (id === 'bier') rausch(1);
  else if (id === 'schnaps') rausch(2);
  else if (id === 'fusel') rausch(3);
  else if (id === 'kippe') w.rauchBis = now + 9;
  else if (id === 'pillen') state.boost.speed = Math.max(state.boost.speed, now) + 30;
  else if (id === 'zeug') w.tripBis = Math.max(w.tripBis, now) + 25;
  else if (id === 'lassi') w.rauschBis = Math.max(now, w.rauschBis - 2 * RAUSCH_STUFE);
  else w.rauschBis = Math.max(now, w.rauschBis - RAUSCH_STUFE); // Essen macht nüchterner
  wirtAktionen.push(id);
  return true;
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

/** Aussehen-Stufe 0..4 aus dem Verfall (steigt nur, sinkt nie), auch nach dem Tod. */
export function lookStage(): number {
  const v = state.verfall;
  if (v < 20) return 0;
  if (v < 40) return 1;
  if (v < 60) return 2;
  if (v < 80) return 3;
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
  state.misstrauen = Math.max(0, state.misstrauen - 0.6 * dt);
  // Ungeduld: wer zu lange auf seinen Wunsch wartet, wird misstrauisch
  if (impatient()) {
    state.misstrauen += 1.5 * dt;
    checkFlucht();
  }

  state.wishTimer -= dt;
  if (state.wishTimer <= 0) {
    if (state.wish && state.sucht >= 40) state.misstrauen += 4; // Entzug macht ihn misstrauisch
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
  // Verfall: wenige Runden bis zum Ende. Er klammert sich ans Leben, bis Kapitel 3 gelaufen ist.
  state.verfall = Math.min(state.story.kapitel3 ? 100 : 99, state.verfall + def.sucht * tol * mult * VERFALL_FAKTOR);

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
  if (state.verfall >= 100) {
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
