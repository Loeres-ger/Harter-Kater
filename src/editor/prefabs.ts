import type { MapData, MapObject, MapZone } from '../maps/types';

// Gebäudevorlagen für den Map-Editor. Kacheln als Zeichenblock (Leerzeichen = Untergrund bleibt), dazu Objekte
// (Pixel relativ zur linken oberen Ecke) und Zonen (Kacheln relativ). Die Gebäude der Stadt werden direkt aus der
// aktuellen Karte ausgeschnitten (mit Schildern, Markisen und Türtexten), dazu schlichte Fassaden je Material.

export interface Prefab {
  name: string;
  rows: string[];
  objects?: Omit<MapObject, 'id'>[];
  zones?: Omit<MapZone, 'id'>[];
  hinweis?: string;
  eigen?: boolean;
}

/** Ausschnitt aus einer Karte als Vorlage */
export function ausschnitt(rows: string[], x: number, y: number, w: number, h: number) {
  return rows.slice(y, y + h).map((r) => r.slice(x, x + w).padEnd(w, ' '));
}

/** Bereich der Karte samt Objekten (Schilder, Markisen, Türtexte) als Vorlage */
function ausKarte(map: MapData, name: string, x: number, y: number, w: number, h: number, hinweis?: string): Prefab {
  const T = 16;
  const objects = map.objects
    .filter((o) => o.x >= x * T && o.x < (x + w) * T && o.y > y * T && o.y <= (y + h) * T + 6)
    .map(({ id: _id, ...o }) => ({ ...o, x: o.x - x * T, y: o.y - y * T }));
  return { name, rows: ausschnitt(map.rows, x, y, w, h), objects, hinweis };
}

/** Schlichte Fassade eines Materials: Dach/Obergeschoss (E) und zwei Reihen Erdgeschoss mit Fenstern und Tür */
function fassade(name: string, wand: string, fenster: string, w: number): Prefab {
  const muster = Array.from({ length: w }, (_, i) => (i === Math.floor(w / 2) ? 'd' : i % 3 === 1 ? 'x' : 'w'));
  const reihe = (unten: boolean) => muster.map((m) => (m === 'x' ? fenster : m === 'd' && unten ? 'd' : wand)).join('');
  return { name, rows: ['E'.repeat(w), 'E'.repeat(w), 'E'.repeat(w), 'E'.repeat(w), reihe(false), reihe(true)], hinweis: 'Erdgeschoss, Obergeschoss und Gesims entstehen automatisch.' };
}

/** Bereiche der Stadt (Kacheln) – stimmen mit der ausgelieferten Karte überein; nach größeren Umbauten ggf. anpassen */
const BEREICHE: [string, number, number, number, number, string?][] = [
  ['Kneipe „Goldener Eimer“', 35, 22, 18, 12, 'Einmalig: Tür, Hintertür und Automat gibt es nur einmal. Zum Verschieben Bereich ausschneiden.'],
  ['Feinkostladen (Maya)', 55, 22, 7, 12, 'Einmalig: der Eingang führt in Mayas Laden.'],
  ['Masala Basar (Indischer Laden)', 14, 15, 9, 9],
  ['Wohnhaus', 0, 15, 14, 9],
  ['Muskelkater (Stripclub)', 0, 27, 11, 8],
  ['Shisha 1001', 11, 27, 12, 10],
  ['Özen Markt (Türkischer Markt)', 62, 27, 11, 8],
  ['Leerstand', 75, 27, 6, 8],
  ['Waschsalon', 67, 8, 13, 7],
  ['Botschaft', 82, 8, 8, 9],
  ['Altbau (Finale)', 72, 0, 18, 6, 'Für das Finale reserviert.'],
  ['Innenhof mit Tor (Kult)', 67, 17, 16, 10, 'Zone „quest“ mit Flag kultHof hält ihn verschlossen.'],
  ['Tunnel mit WC im Fels', 81, 27, 9, 10],
  ['Parkplatz', 0, 0, 23, 13],
];

export function eingebaut(map: MapData): Prefab[] {
  const stadt = map.origin?.x ? BEREICHE.map(([n, x, y, w, h, hint]) => ausKarte(map, n, x, y, w, h, hint)) : [];
  return [
    ...stadt,
    fassade('Fassade Putz', 'F', 'H', 7),
    fassade('Fassade Ziegel', 'N', 'O', 7),
    fassade('Fassade Beton', 'M', 'W', 7),
    fassade('Fassade Ocker', 'P', 'S', 7),
    fassade('Fassade Violett', 'J', 'I', 7),
    fassade('Fassade Holz', 'h', 'i', 7),
    fassade('Fassade Kacheln', 'k', 'q', 7),
    fassade('Fassade Safran', 'a', 'e', 7),
    fassade('Fassade Quaderstein', 'y', 't', 7),
    { name: 'Baustellen-Absperrung 2×4', rows: ['  ', '  ', '  ', '  '], zones: [{ x: 0, y: 0, w: 2, h: 4, state: 'baustelle', label: 'GLANZBAU' }], hinweis: 'Offen nach der Glanz-Mission' },
    { name: 'Laternen-Gehweg', rows: [',,,,,,', ',,l,,,', ',,,,,,'] },
    { name: 'Gassenecke mit Müll', rows: ['#####', '#bbm.', '#T...', '#....'] },
  ];
}
