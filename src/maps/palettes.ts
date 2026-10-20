// Kachel-Tabellen je Karte: welches Zeichen welche Grafik hat, ob es fest ist und ob es eine Wand ist.
// Spiel (AlleyScene) und Map-Editor lesen dieselbe Tabelle, deshalb sieht der Editor genau das, was das Spiel baut.

export interface TileDef {
  label: string;
  /** Textur; Funktion für Varianten je Position */
  key: string | ((x: number, y: number) => string);
  solid: boolean;
  /** Wand: eigene Kachel mit Front-/Draufsicht statt Boden darunter */
  wall?: boolean;
  /** Objekt auf dem Boden (nach y sortiert) */
  object?: boolean;
  group: 'Boden' | 'Mauern & Fassaden' | 'Dächer' | 'Objekte' | 'Figuren & Spezial';
  /** Vorschaubild im Editor, wenn die Kachel selbst leer ist (Figuren, Laternen, Autos werden im Spiel eigens gezeichnet) */
  preview?: string;
}

export interface MapDef {
  id: string;
  name: string;
  tiles: Record<string, TileDef>;
  /** Zeichen für leeren, begehbaren Boden (Radierer) */
  empty: string;
  floor: (rows: string[], x: number, y: number) => string;
}

const v = (a: string, b: string, f: (x: number, y: number) => boolean) => (x: number, y: number) => (f(x, y) ? a : b);

export const ALLEY_TILES: Record<string, TileDef> = {
  '.': { label: 'Kopfsteinpflaster', key: '', solid: false, group: 'Boden' },
  ',': { label: 'Gehweg', key: '', solid: false, group: 'Boden' },
  _: { label: 'Straße', key: '', solid: false, group: 'Boden' },
  '=': { label: 'Mittelstreifen (senkrecht)', key: '', solid: false, group: 'Boden' },
  '-': { label: 'Mittelstreifen (waagrecht)', key: '', solid: false, group: 'Boden' },
  o: { label: 'Gullydeckel', key: '', solid: false, group: 'Boden' },
  x: { label: 'Riss im Pflaster', key: '', solid: false, group: 'Boden' },
  u: { label: 'Pfütze', key: 'puddle', solid: false, group: 'Boden' },
  '#': { label: 'Ziegelwand', key: 'brickFront', solid: true, wall: true, group: 'Mauern & Fassaden' },
  w: { label: 'Ziegelwand mit Fenster', key: v('brickWin', 'brickWinLit', (x) => (x * 3 + 1) % 4 !== 0), solid: true, wall: true, group: 'Mauern & Fassaden' },
  L: { label: 'Wandlampe', key: 'lampWall', solid: true, wall: true, group: 'Mauern & Fassaden' },
  g: { label: 'Graffiti', key: 'brickGraffiti', solid: true, wall: true, group: 'Mauern & Fassaden' },
  p: { label: 'Rohre', key: 'brickPipe', solid: true, wall: true, group: 'Mauern & Fassaden' },
  F: { label: 'Fassade', key: v('facade', 'facade2', (x, y) => (x + y) % 3 !== 0), solid: true, wall: true, group: 'Mauern & Fassaden' },
  H: { label: 'Fassade mit Fenster', key: 'facadeWin', solid: true, wall: true, group: 'Mauern & Fassaden' },
  D: { label: 'Kneipentür (Eingang)', key: 'barDoor', solid: true, wall: true, group: 'Mauern & Fassaden' },
  A: { label: 'Kippenautomat', key: 'automat', solid: true, wall: true, group: 'Mauern & Fassaden' },
  N: { label: 'Backsteinfassade', key: 'brickFacade', solid: true, wall: true, group: 'Mauern & Fassaden' },
  O: { label: 'Backsteinfassade mit Fenster', key: 'brickFacadeWin', solid: true, wall: true, group: 'Mauern & Fassaden' },
  U: { label: 'Ladeneingang (Mayas Feinkost)', key: 'ladenEntrance', solid: true, wall: true, group: 'Mauern & Fassaden' },
  B: { label: 'Rückseite Kneipe', key: 'roofBack', solid: true, group: 'Dächer' },
  Q: { label: 'Hintertür Kneipe', key: 'backDoor', solid: true, group: 'Dächer' },
  R: { label: 'Dach', key: 'roof', solid: true, group: 'Dächer' },
  C: { label: 'Schornstein', key: 'chimney', solid: true, group: 'Dächer' },
  V: { label: 'Lüftung', key: 'vent', solid: true, group: 'Dächer' },
  r: { label: 'Traufe', key: 'eaves', solid: true, group: 'Dächer' },
  E: { label: 'Dunkles Dach', key: 'roofDark', solid: true, group: 'Dächer' },
  G: { label: 'Container', key: 'dumpster', solid: true, object: true, group: 'Objekte' },
  T: { label: 'Mülltonne (durchsuchbar)', key: 'trash', solid: true, object: true, group: 'Objekte' },
  b: { label: 'Kisten', key: 'crate', solid: true, object: true, group: 'Objekte' },
  m: { label: 'Müllsäcke', key: 'bags', solid: true, object: true, group: 'Objekte' },
  n: { label: 'Bank', key: 'bench', solid: true, object: true, group: 'Objekte' },
  l: { label: 'Straßenlaterne', key: '', solid: true, group: 'Objekte', preview: 'lampPost' },
  z: { label: 'Auto (linke Hälfte)', key: '', solid: true, group: 'Objekte', preview: 'car' },
  Z: { label: 'Auto (rechte Hälfte)', key: '', solid: true, group: 'Objekte' },
  K: { label: 'Katze (Glanz-Mission)', key: '', solid: false, group: 'Figuren & Spezial', preview: 'cat' },
  X: { label: 'Dealer', key: '', solid: false, group: 'Figuren & Spezial', preview: 'dealer' },
  Y: { label: 'Dame der Nacht', key: '', solid: false, group: 'Figuren & Spezial', preview: 'dame0' },
};

/** Grundbelag einer Kachel (für Objekte und Figuren: der Belag der Nachbarn). */
function base(ch: string | undefined): 'road' | 'walk' | 'cobble' | null {
  if (ch === undefined) return null;
  if ('_=-'.includes(ch)) return 'road';
  if (ch === ',') return 'walk';
  if ('.oxu'.includes(ch)) return 'cobble';
  return null;
}

export function alleyFloor(rows: string[], x: number, y: number) {
  const ch = rows[y]?.[x];
  if (ch === '=') return 'roadDash';
  if (ch === '-') return 'roadDashH';
  if (ch === 'o') return 'manhole';
  if (ch === 'x') return 'crackCobble';
  const b = base(ch) ?? base(rows[y]?.[x - 1]) ?? base(rows[y]?.[x + 1]) ?? base(rows[y + 1]?.[x]) ?? base(rows[y - 1]?.[x]) ?? 'cobble';
  if (b === 'road') return 'road';
  if (b === 'walk') return (x * 7 + y * 3) % 5 ? 'walk' : 'walk2';
  return `cobble${(x * 5 + y * 11) % 3}`;
}

export const MAP_DEFS: Record<string, MapDef> = {
  alley: { id: 'alley', name: 'Straße und Gasse', tiles: ALLEY_TILES, empty: '.', floor: alleyFloor },
};

export function tileKey(def: TileDef | undefined, x: number, y: number) {
  if (!def) return '';
  return typeof def.key === 'function' ? def.key(x, y) : def.key;
}
