import Phaser from 'phaser';
import { state } from '../state';

// Kapitel-Spielstände: Jedes Mal, wenn eine Kapitel-Einblendung erscheint, wird ein Schnappschuss des
// Spielstands (state inkl. Story-Flags, Geld, Inventar, Glanz-Werte) unter diesem Kapitel gespeichert.
// Pro Speicherpunkt genau ein Stand, dazu „zuletzt gespeichert“. Achievements liegen getrennt (achievements.ts).
// Dazu ein stiller Zwischenstand der offenen Welt (nach der Glanz-Mission): bei jedem Raumwechsel und Questschritt,
// nur wenn der Wirt frei herumläuft. „Fortsetzen“ nimmt ihn, wenn er neuer ist als der letzte Kapitelstand.
// Neue Kapitel: Eintrag in CHAPTERS ergänzen; die Einblendung muss denselben Titeltext verwenden.

export interface ChapterDef {
  id: string;
  /** Text der Kapitel-Einblendung in story.ts, z. B. „KAPITEL 1“ */
  title: string;
  name: string;
  /** wo das Spiel nach dem Laden weitergeht */
  scene: string;
  spawn: [number, number];
}

export const CHAPTERS: ChapterDef[] = [
  { id: 'k1', title: 'KAPITEL 1', name: 'Der letzte Abend', scene: 'Bar', spawn: [3, 2] },
  { id: 'k2', title: 'KAPITEL 2', name: 'Der Anruf', scene: 'Bar', spawn: [4, 2] },
  { id: 'k3', title: 'KAPITEL 3', name: 'Ganz unten', scene: 'Bar', spawn: [4, 2] },
  { id: 'k4', title: 'KAPITEL 4', name: 'Futterzeit', scene: 'Bar', spawn: [4, 2] },
  // offene Welt: Ende der Anfangsquest, danach die Ereignisse in der Reihenfolge, in der sie kommen
  { id: 'welt', title: 'ES IST ERWACHT', name: 'Die Stadt ist offen', scene: 'Bar', spawn: [4, 2] },
  { id: 'k5', title: 'KAPITEL 5', name: 'Die Wahrheit hat Hausverbot', scene: 'Alley', spawn: [17, 18] },
  { id: 'xavi', title: 'XAVI IST WEG', name: 'Xavi ist weg', scene: 'Alley', spawn: [17, 18] },
  { id: 'xaviClub', title: 'LENI BLUME', name: 'Leni Blume', scene: 'Alley', spawn: [17, 18] },
  { id: 'nick', title: 'BORNAS BUSINESS', name: 'Bornas Business', scene: 'Dach', spawn: [6, 5] },
  { id: 'nickKeller', title: 'DER KELLER', name: 'Der Keller', scene: 'Keller', spawn: [11, 14] },
  { id: 'nickFrei', title: 'NICK IST CLEAN', name: 'Nick ist clean', scene: 'Keller', spawn: [11, 14] },
  // Teil 1 „Unter dem Eimer“
  { id: 'k6', title: 'KAPITEL 6', name: 'Ein Tentakel zu viel', scene: 'Club', spawn: [18, 16] },
  { id: 'k7', title: 'KAPITEL 7', name: 'Unter dem Eimer', scene: 'Alley', spawn: [-21, 18] },
  { id: 'k8', title: 'KAPITEL 8', name: 'Der Oktopushirsch', scene: 'Klaerwerk', spawn: [0, 0] },
];

const KEY = 'harterkarter.saves.v1';
const VERSION = 1;

interface Snapshot {
  chapter: string;
  savedAt: string;
  data: Record<string, unknown>;
}

export interface AutoSnap {
  savedAt: string;
  scene: string;
  spawn: [number, number];
  data: Record<string, unknown>;
}

interface SaveFile {
  version: number;
  last: string | null;
  chapters: Record<string, Snapshot>;
  /** Zwischenstand der offenen Welt */
  auto: AutoSnap | null;
}

/** Meldet „gespeichert“ / „fehlgeschlagen“ (NotifyScene blendet es ein). */
export const saveEvents = new Phaser.Events.EventEmitter();

function empty(): SaveFile {
  return { version: VERSION, last: null, chapters: {}, auto: null };
}

/** Liest den Speicher robust: kaputte, fremde oder ältere Daten führen nie zum Absturz. */
function read(): SaveFile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const f = JSON.parse(raw) as Partial<SaveFile>;
    if (!f || typeof f !== 'object' || typeof f.chapters !== 'object' || !f.chapters) return empty();
    // nur bekannte Kapitel mit gültigem Datenobjekt übernehmen (begrenzt die Größe)
    const chapters: Record<string, Snapshot> = {};
    for (const c of CHAPTERS) {
      const s = f.chapters[c.id];
      if (s && typeof s === 'object' && s.data && typeof s.data === 'object') chapters[c.id] = s;
    }
    const last = typeof f.last === 'string' && chapters[f.last] ? f.last : null;
    const a = f.auto as Partial<AutoSnap> | null | undefined;
    const auto = a && typeof a === 'object' && typeof a.scene === 'string' && typeof a.savedAt === 'string' && Array.isArray(a.spawn) && a.data && typeof a.data === 'object' ? (a as AutoSnap) : null;
    return { version: VERSION, last, chapters, auto };
  } catch (err) {
    console.warn('[Harter Karter] Spielstand nicht lesbar, wird ignoriert:', err);
    return empty();
  }
}

function write(f: SaveFile) {
  localStorage.setItem(KEY, JSON.stringify(f));
}

/** Kapitel zu einem Einblendungstext (oder undefined, wenn es keine Kapitel-Einblendung ist). */
export function chapterByTitle(title: string) {
  return CHAPTERS.find((c) => c.title === title);
}

/** Schnappschuss des aktuellen Spielstands unter diesem Kapitel speichern. */
export function saveChapter(id: string) {
  const def = CHAPTERS.find((c) => c.id === id);
  if (!def) return false;
  try {
    const f = read();
    const data = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    f.chapters[id] = { chapter: id, savedAt: new Date().toISOString(), data };
    f.last = id;
    write(f);
    saveEvents.emit('saved', def);
    return true;
  } catch (err) {
    console.error('[Harter Karter] Speichern fehlgeschlagen:', err);
    saveEvents.emit('failed', def);
    return false;
  }
}

/** Zwischenstand der offenen Welt speichern (still, ohne Einblendung). */
export function saveAuto(scene: string, spawn: [number, number]) {
  try {
    const f = read();
    if (!f.last) return false;
    f.auto = { savedAt: new Date().toISOString(), scene, spawn, data: JSON.parse(JSON.stringify(state)) as Record<string, unknown> };
    write(f);
    return true;
  } catch (err) {
    console.warn('[Harter Karter] Zwischenstand nicht gespeichert:', err);
    return false;
  }
}

/** Zwischenstand verwerfen (neues Spiel, Kapitel bewusst neu geladen) */
export function clearAuto() {
  try {
    const f = read();
    if (!f.auto) return;
    f.auto = null;
    write(f);
  } catch {
    /* nicht verfügbar */
  }
}

/** Zwischenstand, falls er neuer ist als der letzte Kapitelstand (Kopie), sonst null */
export function autoStand(): AutoSnap | null {
  const f = read();
  if (!f.auto) return null;
  const last = f.last ? f.chapters[f.last] : undefined;
  return !last || f.auto.savedAt > last.savedAt ? (JSON.parse(JSON.stringify(f.auto)) as AutoSnap) : null;
}

export function hasSave() {
  return read().last !== null;
}

export function lastChapter(): ChapterDef | undefined {
  const id = read().last;
  return CHAPTERS.find((c) => c.id === id);
}

/** Alle Kapitel mit Speicherzeitpunkt (null = noch nicht erreicht, also gesperrt). */
export function chapterList() {
  const f = read();
  return CHAPTERS.map((c) => ({ def: c, savedAt: f.chapters[c.id] ? new Date(f.chapters[c.id].savedAt) : null }));
}

/** Gespeicherte Daten eines Kapitels (Kopie) oder null. */
export function snapshotData(id: string): Record<string, unknown> | null {
  const s = read().chapters[id];
  return s ? (JSON.parse(JSON.stringify(s.data)) as Record<string, unknown>) : null;
}

/** Alle Kapitelstände löschen. Achievements bleiben erhalten. */
export function deleteSaves() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nicht verfügbar */
  }
}
