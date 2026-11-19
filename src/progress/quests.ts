import { unlock } from './achievements';
import type { StoryFlags } from './flags';
import { PC_FILES, gelesen } from '../dialog/pcFiles';

// Offene Welt: Die Glanz-Mission ist der Anfang; danach ist der Eimer gerettet und die Stadt offen. Ereignisse, die auf
// bereits Erlebtem aufbauen, kommen in zufälliger Reihenfolge. Neues Ereignis: Eintrag in STRAENGE ergänzen
// (Voraussetzung, Start-/Fertig-Flag, Einleitungs-Skript in story.ts) – den Rest erledigt naechsterStrang().
//
// Zustände (werden aus den Story-Flags abgeleitet, nicht doppelt gespeichert, deshalb laden alte Spielstände ohne Migration):
//   Seiten-Ereignis entdeckt  → seitenEreignisse[].gefunden(f) bzw. Liste f.entdeckt (Easter Eggs)
//   Strang gesperrt           → Voraussetzung (braucht) noch nicht erfüllt
//   Strang verfügbar          → Voraussetzung erfüllt, noch nicht begonnen (= mögliche Story-Fortsetzung)
//   Strang aktiv              → Einleitung gesehen, Aufgabe läuft
//   Strang abgeschlossen      → Ziel erreicht
// Welche verfügbare Fortsetzung als Nächstes kommt, entscheidet naechsterStrang() per Zufall (nie derselbe zweimal hintereinander).

export type StrangStatus = 'gesperrt' | 'verfuegbar' | 'aktiv' | 'abgeschlossen';

export interface Strang {
  id: string;
  /** Text der Einblendung am Ende der Einleitung (zugleich Speicherpunkt, siehe save.ts) */
  titel: string;
  /** Einleitung (Skript in story.ts) */
  script: string;
  /** echte inhaltliche Abhängigkeit: was der Spieler vorher erlebt haben muss */
  braucht: (f: StoryFlags) => boolean;
  gestartet: (f: StoryFlags) => boolean;
  fertig: (f: StoryFlags) => boolean;
  /** markiert den Strang als begonnen (vor der Einleitung, damit nichts doppelt startet) */
  starten: (f: StoryFlags) => void;
  /** Zieltext unten im HUD, solange der Strang läuft */
  ziel: (f: StoryFlags) => string;
  /** wo es nach der Einleitung weitergeht (sonst in der aktuellen Szene) */
  danach?: { scene: string; spawn: [number, number] };
}

const VOR_DER_TUER = { scene: 'Alley', spawn: [17, 18] as [number, number] };

export const STRAENGE: Strang[] = [
  {
    id: 'wahrheit', titel: 'KAPITEL 5', script: 'kapitel5',
    braucht: (f) => !!f.kevinFlucht,
    gestartet: (f) => !!f.claudius,
    fertig: (f) => f.claudius === 'veroeffentlicht',
    starten: (f) => { f.claudius = 'getroffen'; },
    ziel: (f) => (gelesen(f.pcGelesen).length >= PC_FILES.length ? 'Dachboden: Claudius’ Mails abschicken.' : `Claudius’ Rechner (Dachboden): ${gelesen(f.pcGelesen).length}/${PC_FILES.length} Dateien.`),
    danach: VOR_DER_TUER,
  },
];

export function status(s: Strang, f: StoryFlags): StrangStatus {
  if (s.fertig(f)) return 'abgeschlossen';
  if (s.gestartet(f)) return 'aktiv';
  return f.glanzErledigt && s.braucht(f) ? 'verfuegbar' : 'gesperrt';
}

/** Pause zwischen zwei Einleitungen (Spielsekunden), damit nicht mehrere Stränge auf einmal hereinplatzen */
const PAUSE = 45;

/**
 * Nächste Story-Fortsetzung: zufällig aus den verfügbaren Strängen, nicht derselbe wie zuletzt, sofern es andere gibt.
 * Ohne Kandidaten: null, die Welt bleibt frei bespielbar.
 */
export function naechsterStrang(f: StoryFlags, time: number): Strang | null {
  if (!f.glanzErledigt || (f.strangPauseBis ?? 0) > time) return null;
  let kandidaten = STRAENGE.filter((s) => status(s, f) === 'verfuegbar');
  if (kandidaten.length > 1) kandidaten = kandidaten.filter((s) => s.id !== f.letzterStrang);
  return kandidaten.length ? kandidaten[Math.floor(Math.random() * kandidaten.length)] : null;
}

export function starteStrang(s: Strang, f: StoryFlags, time: number) {
  s.starten(f);
  f.letzterStrang = s.id;
  f.strangPauseBis = time + PAUSE;
}

/** Zieltext für die offene Welt: der zuletzt begonnene laufende Strang. */
export function weltZiel(f: StoryFlags) {
  const aktiv = STRAENGE.filter((s) => status(s, f) === 'aktiv');
  const s = aktiv.find((x) => x.id === f.letzterStrang) ?? aktiv[0];
  return s ? s.ziel(f) : 'Offene Stadt. Schau dich um, red mit den Leuten.';
}

// ---------------------------------------------------------------- Seiten-Ereignisse und Easter Eggs

export interface SeitenEreignis {
  id: string;
  /** wie man es auslöst (nur Doku, für den Bericht) */
  ausloeser: string;
  gefunden: (f: StoryFlags) => boolean;
  /** schaltet diesen Strang frei (falls überhaupt) */
  oeffnet?: string;
}

export const SEITEN: SeitenEreignis[] = [
  { id: 'kevin', ausloeser: 'Herrentoilette, Kabine 2: ans Loch klopfen, dann rausgehen', gefunden: (f) => !!f.kevinFlucht, oeffnet: 'wahrheit' },
  { id: 'borna', ausloeser: 'Dachboden: Borna ansprechen', gefunden: (f) => !!f.bornaGetroffen },
  { id: 'lilly', ausloeser: 'Hintergasse (erst nach Borna): mit Lilly reden', gefunden: (f) => !!f.lily },
  { id: 'maya', ausloeser: 'Mayas Feinkost: im Dialekt antworten', gefunden: (f) => !!f.mayaTraum },
  { id: 'leni', ausloeser: 'Damentoilette: mit Leni reden', gefunden: (f) => f.leniGekotzt !== undefined },
  { id: 'anne', ausloeser: 'Kneipe ein paar Mal betreten', gefunden: (f) => !!f.anne },
  { id: 'felix', ausloeser: 'Gasse: Felix ansprechen', gefunden: (f) => !!f.felixVerhoer },
];

/** Reine Easter Eggs ohne Strang: gefunden, wenn ihre id in f.entdeckt steht. */
export const EASTER_EGGS = ['gully', 'golf', 'karton', 'jukebox'];

/** Easter Egg registrieren (einmalig). Alle gefunden: Achievement. */
export function entdecke(f: StoryFlags, id: string) {
  const list = f.entdeckt ?? [];
  if (list.includes(id)) return false;
  f.entdeckt = [...list, id];
  if (EASTER_EGGS.every((e) => f.entdeckt!.includes(e))) unlock('neugierig');
  return true;
}

/** Wie oft etwas in dieser Sitzung benutzt wurde (für Easter Eggs, die erst beim x-ten Mal auftauchen). */
const zaehler = new Map<string, number>();
export function zaehle(id: string) {
  const n = (zaehler.get(id) ?? 0) + 1;
  zaehler.set(id, n);
  return n;
}
