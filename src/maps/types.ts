// Kartendaten für Spiel und Map-Editor (editor.html). Kacheln bleiben im bewährten Zeichenformat (ein Zeichen = 16×16),
// dazu kommen frei platzierte Objekte, Zonen und Kollisions-Korrekturen. Alle Koordinaten von Objekten in Weltpixeln.

export type ZoneState = 'offen' | 'baustelle' | 'quest' | 'gesperrt' | 'reserviert';

export type ObjectKind = 'deko' | 'schild' | 'npc' | 'interaktion' | 'spawn';

export interface MapObject {
  id: string;
  kind: ObjectKind;
  x: number;
  y: number;
  /** Textur (Deko, NPC) und Bild der Textur */
  key?: string;
  frame?: number;
  scale?: number;
  flipX?: boolean;
  /** blockiert die Kachel unter dem Fuß */
  solid?: boolean;
  /** Ebene: boden (unter allem), normal (nach y sortiert), vorne (über allem) */
  ebene?: 'boden' | 'normal' | 'vorne';
  /** Schild: Text; Interaktion: Beschriftung und Text, der beim Benutzen erscheint */
  text?: string;
  label?: string;
  /** leuchtet in dieser Farbe (z. B. '#ff5ac8' für ein Neonschild) */
  glow?: string;
  /** NPC: Gespräch aus dialog/data.ts (SPEAKERS) */
  talk?: string;
  /** nur sichtbar/aktiv, wenn dieses Story-Flag gesetzt ist (z. B. glanzErledigt); mit ! davor: nur solange es fehlt */
  bedingung?: string;
}

export interface MapZone {
  id: string;
  /** in Kacheln */
  x: number;
  y: number;
  w: number;
  h: number;
  state: ZoneState;
  /** bei state 'quest': Story-Flag, das den Bereich öffnet */
  flag?: string;
  label?: string;
}

export interface MapData {
  version: 1;
  id: string;
  rows: string[];
  objects: MapObject[];
  zones: MapZone[];
  /** Kollisions-Korrekturen je Kachel „x,y“: block = immer fest, free = immer begehbar */
  collision: { block: string[]; free: string[] };
  /** um so viele Kacheln wurde die Karte nach links/oben erweitert (feste Punkte im Spielcode werden verschoben) */
  origin?: { x: number; y: number };
}

/** Story-Flag-Bedingung auswerten: 'flag' oder '!flag' (leer = immer). */
export function bedingungErfuellt(flags: object, bedingung?: string) {
  if (!bedingung) return true;
  const neg = bedingung.startsWith('!');
  const v = !!(flags as Record<string, unknown>)[neg ? bedingung.slice(1) : bedingung];
  return neg ? !v : v;
}

/** Ist eine Zone im aktuellen Spielstand gesperrt? Baustellen öffnen sich mit dem Abschluss der Glanz-Mission. */
export function zoneGesperrt(z: MapZone, flags: object) {
  switch (z.state) {
    case 'offen': return false;
    case 'baustelle': return !bedingungErfuellt(flags, 'glanzErledigt');
    case 'quest': return !bedingungErfuellt(flags, z.flag);
    default: return true; // gesperrt, reserviert
  }
}
