import type { MapObject, MapZone } from '../maps/types';

// Gebäudevorlagen für den Map-Editor. Kacheln als Zeichenblock (Leerzeichen = Untergrund bleibt), dazu Objekte
// (Pixel relativ zur linken oberen Ecke) und Zonen (Kacheln relativ). Kneipe und Feinkostladen stammen direkt aus der
// aktuellen Karte. Für Gebäude, die es im Spiel noch nicht gibt, bauen die Vorlagen eine Fassade aus vorhandenen
// Kacheln und hängen ein Namensschild dran (Platzhalter, bis es eigene Grafiken gibt).

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

function fassade(name: string, w: number, stil: 'ziegel' | 'putz', hoehe = 2): Prefab {
  const muster = stil === 'ziegel' ? ['N', 'O'] : ['F', 'H'];
  const reihe = (o: number) => Array.from({ length: w }, (_, i) => muster[(i + o) % 3 === 1 ? 1 : 0]).join('');
  const rows = ['E'.repeat(w), 'E'.repeat(w), 'r'.repeat(w), ...Array.from({ length: hoehe }, (_, i) => reihe(i))];
  return {
    name,
    rows,
    objects: [{ kind: 'schild', x: (w * 16) / 2, y: 3 * 16 + 4, text: name.toUpperCase() }],
    hinweis: 'Platzhalter aus vorhandenen Fassaden, mit Namensschild',
  };
}

export function eingebaut(alley: string[]): Prefab[] {
  return [
    { name: 'Kneipe „Goldener Eimer“', rows: ausschnitt(alley, 9, 5, 18, 12), hinweis: 'Einmalig: Tür, Hintertür und Automat gibt es nur einmal. Zum Verschieben Bereich ausschneiden.' },
    { name: 'Feinkostladen (Maya)', rows: ausschnitt(alley, 29, 5, 7, 12), hinweis: 'Einmalig: der Eingang führt in Mayas Laden.' },
    fassade('Türkischer Markt', 7, 'putz'),
    fassade('Indischer Laden', 6, 'putz'),
    fassade('Shisha-Bar', 7, 'ziegel'),
    fassade('Stripclub', 8, 'ziegel'),
    fassade('Waschsalon', 7, 'putz'),
    fassade('Botschaft', 8, 'ziegel', 3),
    fassade('Gebäude (Finale)', 9, 'ziegel', 3),
    { ...fassade('Öffentliches WC', 3, 'ziegel'), objects: [{ kind: 'schild', x: 24, y: 52, text: 'WC' }] },
    {
      name: 'Parkplatz',
      rows: ['________', '_zZ__zZ_', '_------_', '_zZ__zZ_', '________'],
      hinweis: 'Autos aus dem Spiel, Asphalt mit Markierung',
    },
    {
      name: 'Innenhof (abgesperrt)',
      rows: ['########', '#......#', '#..u...#', '#......#', '#......#', '###..###'],
      zones: [{ x: 1, y: 1, w: 6, h: 5, state: 'quest', flag: '', label: 'ABGESPERRT' }],
      hinweis: 'Zone öffnet sich mit dem eingetragenen Story-Flag',
    },
    {
      name: 'Tunnel (gesperrt)',
      rows: ['EEEE', 'EEEE', 'r..r', '#..#'],
      zones: [{ x: 1, y: 2, w: 2, h: 2, state: 'gesperrt', label: 'TUNNEL' }],
    },
    { name: 'Baustellen-Absperrung 4×3', rows: ['    ', '    ', '    '], zones: [{ x: 0, y: 0, w: 4, h: 3, state: 'baustelle' }], hinweis: 'Offen nach der Glanz-Mission' },
    { name: 'Laternen-Gehweg', rows: [',,,,,,', ',,l,,,', ',,,,,,'] },
    { name: 'Gassenecke mit Müll', rows: ['#####', '#bbm.', '#T...', '#G...'] },
  ];
}
