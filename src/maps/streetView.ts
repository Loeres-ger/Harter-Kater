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

/** Material einer Fassade nach ihrem Zeichen (Wand oder Fenster); Türen 'd' übernehmen das Material der Nachbarwand */
const MAT: Record<string, string> = {
  F: 'putz', H: 'putz', D: 'putz', A: 'putz',
  N: 'ziegel', O: 'ziegel', U: 'ziegel', '#': 'ziegel', w: 'ziegel', L: 'ziegel', g: 'ziegel', p: 'ziegel',
  M: 'beton', W: 'beton', P: 'ocker', S: 'ocker', J: 'violett', I: 'violett', h: 'holz', i: 'holz',
  k: 'kachel', q: 'kachel', a: 'safran', e: 'safran', y: 'stein', t: 'stein', j: 'leer', s: 'mauer', f: 'fels',
};
/** Wand- und Fensterzeichen der neuen Materialien */
const NEU_WAND = 'MPJhkay';
const NEU_FENSTER = 'WSIiqetj';
/** Lichtfarbe aus Schaufenstern je Material */
const LICHT: Record<string, number> = { putz: 0xffb860, ziegel: 0xffd890, ocker: 0xf0c070, violett: 0xff5ac8, holz: 0xff7a3a, kachel: 0xe8f0d8, safran: 0xf8c060, beton: 0xc8d4e0, stein: 0x8a6ad0 };
const hash = (x: number, y: number) => ((x * 73856093) ^ (y * 19349663)) >>> 0;

/** Material einer Gebäudespalte (Fuß), bei Türen das der Nachbarwand */
export function materialAt(rows: string[], x: number, y: number) {
  for (const dx of [0, -1, 1, -2, 2]) {
    const m = MAT[rows[y]?.[x + dx] ?? ''];
    if (m) return m;
  }
  return 'ziegel';
}
/** Türmaterial: Putz und Ziegel haben eigene, schlichte Türen (die Kneipentür D bleibt einmalig) */
const doorMat = (m: string) => (m === 'putz' ? 'putzG' : m === 'ziegel' ? 'ziegelG' : m === 'mauer' || m === 'fels' ? 'ziegelG' : m);

function floorType(rows: string[], def: MapDef, x: number, y: number): 'road' | 'walk' | 'other' | null {
  const ch = rows[y]?.[x];
  if (ch === undefined || isBuilding(def, ch)) return null;
  const k = def.floor(rows, x, y);
  return k.startsWith('asph') || k === 'parkLine' ? 'road' : k.startsWith('slab') ? 'walk' : 'other';
}

/** Innenraum (z. B. Kanalisation): Wand mit Front, wenn darunter Boden liegt, sonst Draufsicht; Boden mit Schatten und Kanten */
function raumCell(rows: string[], def: MapDef, x: number, y: number): Cell {
  const raum = def.raum!;
  const ch = rows[y]?.[x] ?? def.empty;
  const td = def.tiles[ch];
  const below = rows[y + 1]?.[x];
  if (td?.wall) {
    const front = below !== undefined && !def.tiles[below]?.wall;
    return { key: front ? tileKey(td, x, y) : raum.wandOben, overlays: [], building: true };
  }
  const overlays: string[] = [];
  const above = rows[y - 1]?.[x];
  const istWasser = ch === raum.wasser;
  if (raum.schatten && above !== undefined && def.tiles[above]?.wall) overlays.push(raum.schatten);
  if (raum.kante && !istWasser && below === raum.wasser) overlays.push(raum.kante);
  const key = tileKey(td, x, y);
  // Wasser liegt schon als Boden darunter, eine zweite Lage braucht es nicht
  return { floor: def.floor(rows, x, y), key: istWasser ? undefined : key || undefined, object: td?.object, overlays, building: false };
}

export function streetCell(rows: string[], def: MapDef, x: number, y: number): Cell {
  if (def.raum) return raumCell(rows, def, x, y);
  const ch = rows[y]?.[x] ?? def.empty;
  const td = def.tiles[ch];
  if (isBuilding(def, ch)) {
    const { d, bottom } = heightInColumn(rows, def, x, y);
    const fuss = materialAt(rows, x, bottom);
    const mat = fuss === 'mauer' || fuss === 'fels' ? 'ziegel' : fuss;
    const above = rows[y - 1]?.[x];
    const obenOffen = above !== undefined && !isBuilding(def, above);
    const below = rows[y + 1]?.[x];
    // Sonderfälle mit eigener Höhe: Fels, hohe Mauer, Tor, Tunnelportal, Türen
    if (ch === 'f') return { key: obenOffen ? 'rockTop' : hash(x, y) % 3 ? 'rock0' : 'rock1', overlays: [], building: true };
    if (ch === 's') {
      if (d === 0) return { key: 'mauer0', overlays: [], building: true };
      if (d < 3) return { key: 'mauer1', overlays: [], building: true };
      // Mauerkrone von oben: quer, wenn die Mauer seitlich offen ist und senkrecht weiterläuft, sonst längs
      const seitlichOffen = !isBuilding(def, rows[y]?.[x - 1]) || !isBuilding(def, rows[y]?.[x + 1]);
      const senkrecht = rows[y - 1]?.[x] === 's' || rows[y + 1]?.[x] === 's';
      return { key: seitlichOffen && senkrecht ? 'mauerTopV' : 'mauerTop', overlays: [], building: true };
    }
    if (ch === '+') return { key: d === 0 ? 'tor0' : d === 1 ? 'tor1' : 'mauer1', overlays: [], building: true };
    if (ch === '[' || ch === ']' || ch === '^') {
      const key = d >= 4 ? 'rock0' : d === 3 ? 'portalTop' : ch === '[' ? 'portalL' : ch === ']' ? 'portalR' : d === 2 ? 'tunnelArch' : 'tunnelDark';
      return { key, overlays: [], building: true };
    }
    if (ch === 'd') return { key: `${doorMat(materialAt(rows, x, y))}${d === 0 ? 'Door0' : 'Door1'}`, overlays: [], building: true };
    if (below === 'd' && d < FASSADE) return { key: `${doorMat(materialAt(rows, x, y + 1))}Door1`, overlays: [], building: true };
    if (NEU_WAND.includes(ch) || NEU_FENSTER.includes(ch)) {
      const m = MAT[ch];
      const fenster = NEU_FENSTER.includes(ch);
      const key = d >= FASSADE ? (obenOffen ? 'backEdge' : 'void')
        : d === 3 ? `${m}Cornice`
        : d === 2 ? (fenster || hash(x, y) % 3 === 0 ? `${m}UpLit` : `${m}Up`)
        : fenster ? (d === 0 ? `${m}Win0` : `${m}Win1`) : d === 0 ? `${m}0` : `${m}1`;
      return { key, overlays: [], building: true };
    }
    if (d >= FASSADE) {
      return { key: obenOffen ? (ch === 'Q' ? 'backDoorTop' : 'backEdge') : 'void', overlays: [], building: true };
    }
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
  if (def.lichter) return def.lichter(rows);
  if (def.raum) return [];
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
            if (c.key?.endsWith('Win0') && !c.key.startsWith('leer')) {
              const m = c.key.slice(0, -4);
              out.push({ x: cx, y: (y + 1) * T + 6, scale: 0.55, alpha: 0.42, tint: LICHT[m] ?? 0xffb860, pool: true, kind: 'window' });
            }
            if (ch === 'd') out.push({ x: cx, y: (y + 1) * T + 3, scale: 0.6, alpha: 0.6, tint: 0xffd890, pool: true, kind: 'door' });
            if (c.key?.endsWith('UpLit')) out.push({ x: cx, y: y * T + 8, scale: 0.22, alpha: 0.5, tint: 0xffc070, pool: false, kind: 'window' });
          }
      }
    }
  return out;
}
