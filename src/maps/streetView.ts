import { MapDef, tileKey } from './palettes';

// Straßenansicht: EINE Regel, wie eine Karte aussieht – das Spiel (TopDown) und der Map-Editor zeichnen damit.
//
// Perspektive: schräg von vorn (Süden). Sichtbar sind die nach Süden zeigenden Fassaden. Ein Gebäude ist eine
// zusammenhängende Spalte aus Wand-/Dachkacheln; von unten gezählt sind die ersten FASSADE Kacheln die Fassade
// (Erdgeschoss 2, Obergeschoss 1, Gesims 1). Alles darüber ist Dachfläche oder Rückseite und bleibt dunkel.
// Grenzt ein Gebäude oben an begehbaren Boden (Rückseite zur Gasse), zeigt die Kante nur die Attika.
// Die Kartendaten (Zeichen, Kollision, Interaktionen) bleiben unverändert – nur die Darstellung folgt dieser Regel.

const T = 16;
export const FASSADE = 4;

export interface Cell {
  floor?: string;
  key?: string;
  /** Objekt auf dem Boden (nach Tiefe sortiert) */
  object?: boolean;
  /** Überlagerungen (Bordstein, Kontaktschatten) */
  overlays: string[];
  building: boolean;
}

export interface LightHint {
  x: number;
  y: number;
  scale: number;
  alpha: number;
  tint: number;
  /** hellt die Umgebung auf (Lichtkarte); sonst nur ein kleiner Schein */
  pool: boolean;
  /** Spiegelung auf nassem Boden */
  reflect?: boolean;
  kind?: 'lamp' | 'window' | 'door';
}

export function isBuilding(def: MapDef, ch: string | undefined) {
  const d = ch === undefined ? undefined : def.tiles[ch];
  return !!d && (!!d.wall || d.group === 'Dächer');
}

/** Höhe über dem Fuß der Gebäudespalte (0 = unterste Kachel) und Zeile des Fußes */
export function heightInColumn(rows: string[], def: MapDef, x: number, y: number) {
  let b = y;
  while (b + 1 < rows.length && isBuilding(def, rows[b + 1]?.[x])) b++;
  return { d: b - y, bottom: b };
}

const PUTZ = 'FHDA';
const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

function floorType(rows: string[], def: MapDef, x: number, y: number): 'road' | 'walk' | 'other' | null {
  const ch = rows[y]?.[x];
  if (ch === undefined || isBuilding(def, ch)) return null;
  const k = def.floor(rows, x, y);
  return k.startsWith('asph') ? 'road' : k.startsWith('slab') ? 'walk' : 'other';
}

export function streetCell(rows: string[], def: MapDef, x: number, y: number): Cell {
  const ch = rows[y]?.[x] ?? def.empty;
  const td = def.tiles[ch];
  if (isBuilding(def, ch)) {
    const { d, bottom } = heightInColumn(rows, def, x, y);
    const mat = PUTZ.includes(rows[bottom][x]) ? 'putz' : 'ziegel';
    if (d >= FASSADE) {
      const above = rows[y - 1]?.[x];
      const offen = above !== undefined && !isBuilding(def, above);
      return { key: offen ? (ch === 'Q' ? 'backDoorTop' : 'backEdge') : 'void', overlays: [], building: true };
    }
    const below = rows[y + 1]?.[x];
    let key: string;
    if (d === FASSADE - 1 && !td.wall) key = `${mat}Cornice`;
    else if (below === 'D' && ch !== 'D') key = 'pubDoor1';
    else if (below === 'U' && ch !== 'U') key = 'ladenTop';
    else if (below === 'A' && ch !== 'A') key = 'automatTop';
    else {
      switch (ch) {
        case 'D': key = 'pubDoor0'; break;
        case 'A': key = 'automat'; break;
        case 'U': key = 'ladenEntrance'; break;
        case 'H': key = d === 0 ? 'putzWin0' : below === 'H' ? 'putzWin1' : 'facadeWin'; break;
        case 'O': key = d === 0 ? 'ziegelWin0' : below === 'O' ? 'ziegelWin1' : 'brickFacadeWin'; break;
        case 'F': key = d === 0 ? (hash(x, y) % 3 ? 'putz0' : 'putz0b') : d === 1 ? 'putz1' : d === FASSADE - 1 ? 'putzCornice' : 'putzWall'; break;
        case 'N': key = d === 0 ? 'ziegel0' : d === 1 ? 'ziegel1' : d === FASSADE - 1 ? 'ziegelCornice' : 'ziegelWall'; break;
        default:
          // Rückwände der Nachbarhäuser (#, w, L, g, p) behalten ihr Bild; Dachkacheln innerhalb der Fassade = Obergeschoss
          key = td.wall ? tileKey(td, x, y) : d === 2 ? (hash(x, y) % 3 === 0 ? `${mat}UpLit` : `${mat}Up`) : `${mat}Wall`;
      }
    }
    return { key, overlays: [], building: true };
  }

  // Boden mit Bordsteinen (Gehweg an Straße) und Kontaktschatten (Boden an Hauswand)
  const floor = def.floor(rows, x, y);
  const overlays: string[] = [];
  if (floorType(rows, def, x, y) === 'walk') {
    if (floorType(rows, def, x, y + 1) === 'road') overlays.push('curbS');
    if (floorType(rows, def, x, y - 1) === 'road') overlays.push('curbN');
    if (floorType(rows, def, x - 1, y) === 'road') overlays.push('curbW');
    if (floorType(rows, def, x + 1, y) === 'road') overlays.push('curbE');
  }
  if (isBuilding(def, rows[y - 1]?.[x])) overlays.push('aoN');
  if (isBuilding(def, rows[y]?.[x - 1])) overlays.push('aoW');
  if (isBuilding(def, rows[y]?.[x + 1])) overlays.push('aoE');
  const k = tileKey(td, x, y);
  return { floor, key: k || undefined, object: !!td?.object, overlays, building: false };
}

/** Lichtquellen, die sich aus der Karte ergeben (Laternen, Fenster, Türen). */
export function streetLights(rows: string[], def: MapDef): LightHint[] {
  const out: LightHint[] = [];
  for (let y = 0; y < rows.length; y++)
    for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x], cx = x * T + 8;
      switch (ch) {
        case 'L': out.push({ x: cx, y: (y + 1) * T + 8, scale: 1.25, alpha: 0.85, tint: 0xffd890, pool: true, kind: 'lamp' }); break;
        case 'l':
          out.push({ x: cx, y: y * T + 10, scale: 1.3, alpha: 0.85, tint: 0xfff0c0, pool: true, reflect: true, kind: 'lamp' });
          out.push({ x: cx, y: y * T - 24, scale: 0.28, alpha: 0.75, tint: 0xfff0c0, pool: false, kind: 'lamp' });
          break;
        case 'D': out.push({ x: cx, y: (y + 1) * T + 3, scale: 0.9, alpha: 0.8, tint: 0xffd080, pool: true, reflect: true, kind: 'door' }); break;
        case 'Q': out.push({ x: cx, y: y * T - 4, scale: 0.65, alpha: 0.7, tint: 0xfff0b0, pool: true, kind: 'door' }); break;
        case 'U': out.push({ x: cx, y: (y + 1) * T + 3, scale: 0.7, alpha: 0.65, tint: 0xffe0a0, pool: true, kind: 'door' }); break;
        case 'A': out.push({ x: cx, y: (y + 1) * T + 4, scale: 0.5, alpha: 0.55, tint: 0xff6060, pool: true, kind: 'door' }); break;
        default:
          if (isBuilding(def, ch)) {
            const c = streetCell(rows, def, x, y);
            if (c.key === 'putzWin0') out.push({ x: cx, y: (y + 1) * T + 6, scale: 0.55, alpha: 0.42, tint: 0xffb860, pool: true, kind: 'window' });
            if (c.key?.endsWith('UpLit')) out.push({ x: cx, y: y * T + 8, scale: 0.22, alpha: 0.5, tint: 0xffc070, pool: false, kind: 'window' });
          }
      }
    }
  return out;
}
