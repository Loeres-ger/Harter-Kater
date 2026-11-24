import type { LightHint } from './streetView';

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
  /** Dunkelheit der Lichtkarte (0..1), gilt für Spiel und Editor-Spielansicht */
  dunkel: number;
  /** Innenraum statt Straßenansicht: Wände zeigen vorn ihre Front, sonst die Draufsicht (wandOben); ohne Fassaden-Regel */
  raum?: {
    wandOben: string;
    /** Schatten auf dem Boden direkt unter einer Wand */
    schatten?: string;
    /** Kante auf begehbarem Boden, wenn darunter das Zeichen wasser liegt */
    kante?: string;
    wasser?: string;
  };
  /** Lichter der Karte (Spiel und Editor-Spielansicht); sonst die der Straßenansicht */
  lichter?: (rows: string[]) => LightHint[];
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
  // ---- Stadterweiterung: Boden
  v: { label: 'Gras', key: '', solid: false, group: 'Boden' },
  '|': { label: 'Parkplatz-Markierung', key: '', solid: false, group: 'Boden' },
  // ---- Fassaden je Material: Wand und Fenster (Erdgeschoss unten, darüber Dachkacheln E für Obergeschoss und Gesims)
  M: { label: 'Beton (Botschaft) – Wand', key: 'beton0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  W: { label: 'Beton (Botschaft) – Fenster', key: 'betonWin0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  P: { label: 'Ocker (Markt) – Wand', key: 'ocker0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  S: { label: 'Ocker (Markt) – Fenster', key: 'ockerWin0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  J: { label: 'Violett (Club) – Wand', key: 'violett0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  I: { label: 'Violett (Club) – Fenster', key: 'violettWin0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  h: { label: 'Dunkles Holz (Shisha) – Wand', key: 'holz0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  i: { label: 'Dunkles Holz (Shisha) – Fenster', key: 'holzWin0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  k: { label: 'Kacheln (Waschsalon) – Wand', key: 'kachel0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  q: { label: 'Kacheln (Waschsalon) – Fenster', key: 'kachelWin0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  a: { label: 'Safran (Gewürzladen) – Wand', key: 'safran0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  e: { label: 'Safran (Gewürzladen) – Fenster', key: 'safranWin0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  y: { label: 'Quaderstein (Altbau) – Wand', key: 'stein0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  t: { label: 'Quaderstein (Altbau) – Fenster', key: 'steinWin0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  j: { label: 'Vernageltes Fenster (Leerstand)', key: 'leerWin0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  d: { label: 'Tür (Material der Nachbarwand)', key: 'putzGDoor0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  s: { label: 'Hohe Mauer', key: 'mauer0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  '+': { label: 'Eisentor (verschlossen)', key: 'tor0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  f: { label: 'Fels', key: 'rock0', solid: true, wall: true, group: 'Mauern & Fassaden' },
  '[': { label: 'Tunnelportal links', key: 'portalL', solid: true, wall: true, group: 'Mauern & Fassaden' },
  ']': { label: 'Tunnelportal rechts', key: 'portalR', solid: true, wall: true, group: 'Mauern & Fassaden' },
  '^': { label: 'Tunnel (gesperrt)', key: 'tunnelDark', solid: true, wall: true, group: 'Mauern & Fassaden' },
};

/** Grundbelag einer Kachel (für Objekte und Figuren: der Belag der Nachbarn). */
function base(ch: string | undefined): 'road' | 'walk' | 'cobble' | 'grass' | null {
  if (ch === undefined) return null;
  if (ch === 'v') return 'grass';
  if ('_=-|'.includes(ch)) return 'road';
  if (ch === ',') return 'walk';
  if ('.oxu'.includes(ch)) return 'cobble';
  return null;
}

export function alleyFloor(rows: string[], x: number, y: number) {
  const ch = rows[y]?.[x];
  if (ch === '=') return 'asphDash';
  if (ch === '-') return 'asphDashH';
  if (ch === 'o') return 'manhole';
  if (ch === 'x') return 'crackCobble';
  if (ch === '|') return 'parkLine';
  const b = base(ch) ?? base(rows[y]?.[x - 1]) ?? base(rows[y]?.[x + 1]) ?? base(rows[y + 1]?.[x]) ?? base(rows[y - 1]?.[x]) ?? 'cobble';
  const h = (x * 7 + y * 13) % 11;
  if (b === 'road') return h === 0 ? 'asph1' : h === 5 ? 'asph2' : 'asph0';
  if (b === 'walk') return h === 3 ? 'slab1' : h === 8 ? 'slab2' : 'slab0';
  if (b === 'grass') return h % 3 ? 'grass0' : 'grass1';
  return `cobble${(x * 5 + y * 11) % 3}`;
}

// ---------------------------------------------------------------- Kanalisation („Unter dem Eimer“)

/** Kanalisation unter der Stadt: Betonstege, Abwasserrinnen, nasse Backsteinwände */
export const KANAL_TILES: Record<string, TileDef> = {
  '.': { label: 'Betonsteg', key: '', solid: false, group: 'Boden' },
  '~': { label: 'Abwasser (nicht begehbar)', key: v('kanalWasser0', 'kanalWasser1', (x, y) => (x * 3 + y) % 4 !== 0), solid: true, group: 'Boden' },
  b: { label: 'Holzbrücke', key: 'kanalBruecke', solid: false, group: 'Boden' },
  x: { label: 'Schleim', key: 'kanalSchleimBoden', solid: false, group: 'Boden' },
  n: { label: 'Nische (Schutz vor Spülwellen)', key: 'kanalNische', solid: false, group: 'Boden' },
  '#': { label: 'Backsteinwand', key: 'kanalWandFront', solid: true, wall: true, group: 'Mauern & Fassaden' },
  H: { label: 'Wand mit Rohr', key: 'kanalRohrFront', solid: true, wall: true, group: 'Mauern & Fassaden' },
  G: { label: 'Lichtschacht (Gitter nach oben)', key: 'kanalGitterFront', solid: true, wall: true, group: 'Mauern & Fassaden' },
  K: { label: 'Kreide-Graffiti', key: 'kanalKreideFront', solid: true, wall: true, group: 'Mauern & Fassaden' },
  L: { label: 'Leiter zum Gully', key: 'kanalLeiterFront', solid: true, wall: true, group: 'Figuren & Spezial' },
  D: { label: 'Stahltür (Klärwerk)', key: 'kanalTuerFront', solid: true, wall: true, group: 'Figuren & Spezial' },
  Z: { label: 'Rostgitter (versperrt)', key: 'kanalTor', solid: true, group: 'Figuren & Spezial' },
  f: { label: 'Fass', key: 'kanalFass', solid: true, object: true, group: 'Objekte' },
  m: { label: 'Müllhaufen', key: 'kanalMuell', solid: true, object: true, group: 'Objekte' },
  S: { label: 'Schieber (hier wacht man nach Ohnmacht/Spülwelle auf)', key: 'kanalSchieber', solid: true, object: true, group: 'Objekte' },
  r: { label: 'Spülrinne (trocken, hier rollen die Wellen)', key: 'kanalRinne', solid: false, group: 'Boden' },
  P: { label: 'Rattenloch (Rudel)', key: 'kanalRattenlochFront', solid: true, wall: true, group: 'Figuren & Spezial' },
  '1': { label: 'Schieberkammer: Rinne Nord', key: 'kanalWasser0', solid: true, group: 'Figuren & Spezial' },
  '2': { label: 'Schieberkammer: Rinne Mitte', key: 'kanalWasser0', solid: true, group: 'Figuren & Spezial' },
  '3': { label: 'Schieberkammer: Rinne Süd (tief, Fass)', key: 'kanalWasser1', solid: true, group: 'Figuren & Spezial' },
  q: { label: 'Schieber Rot (Nord → Mitte)', key: 'kanalSchieberRot', solid: true, object: true, group: 'Figuren & Spezial' },
  w: { label: 'Schieber Gelb (Mitte → Süd)', key: 'kanalSchieberGelb', solid: true, object: true, group: 'Figuren & Spezial' },
  e: { label: 'Schieber Grün (Süd → Nord)', key: 'kanalSchieberGruen', solid: true, object: true, group: 'Figuren & Spezial' },
  h: { label: 'Hebel: alles auf Anfang', key: 'kanalHebel', solid: true, object: true, group: 'Figuren & Spezial' },
  k: { label: 'Gitter mit Porsche-Schlüssel', key: 'kanalGitterSchluesselFront', solid: true, wall: true, group: 'Figuren & Spezial' },
  u: { label: 'Müll mit Rolex', key: 'kanalMuellRolex', solid: true, object: true, group: 'Figuren & Spezial' },
  c: { label: 'Schleimkokon (Bianca)', key: 'kanalKokon', solid: true, object: true, group: 'Figuren & Spezial' },
};

export function kanalFloor(rows: string[], x: number, y: number) {
  const ch = rows[y]?.[x];
  if (ch === '~' || ch === 'b' || ch === '1' || ch === '2' || ch === '3') return (x * 3 + y) % 4 ? 'kanalWasser0' : 'kanalWasser1';
  const h = (x * 7 + y * 13) % 9;
  return h === 0 ? 'kanalSteg1' : h === 4 ? 'kanalSteg2' : 'kanalSteg0';
}

/** Kaltes Licht fällt durch die Gitter der Lichtschächte, die Leiter bekommt etwas Schein vom Gully */
export function kanalLichter(rows: string[]): LightHint[] {
  const out: LightHint[] = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === 'G') out.push({ x: x * 16 + 8, y: (y + 1) * 16 + 6, scale: 0.9, alpha: 0.55, tint: 0x9ac8e8, pool: true });
    if (ch === 'L') out.push({ x: x * 16 + 8, y: (y + 1) * 16 + 2, scale: 0.6, alpha: 0.45, tint: 0xd8e0c8, pool: true });
    if (ch === 'x') out.push({ x: x * 16 + 8, y: y * 16 + 8, scale: 0.3, alpha: 0.5, tint: 0x6aff4a, pool: false });
  }));
  return out;
}

export const MAP_DEFS: Record<string, MapDef> = {
  alley: { id: 'alley', name: 'Straße und Gasse', tiles: ALLEY_TILES, empty: '.', floor: alleyFloor, dunkel: 0.66 },
  kanal: {
    id: 'kanal', name: 'Kanalisation', tiles: KANAL_TILES, empty: '.', floor: kanalFloor, dunkel: 0.9, lichter: kanalLichter,
    raum: { wandOben: 'kanalWandTop', schatten: 'kanalSchatten', kante: 'kanalKante', wasser: '~' },
  },
};

export function tileKey(def: TileDef | undefined, x: number, y: number) {
  if (!def) return '';
  return typeof def.key === 'function' ? def.key(x, y) : def.key;
}
