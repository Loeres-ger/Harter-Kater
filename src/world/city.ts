import Phaser from 'phaser';
import { Ctx, blob, p, r, rng, tex2x } from '../gfx';
import { signText } from './textures';

// Stadterweiterung: Fassadenmaterialien für die neuen Gebäude, Schilder, Bäume, Baustelle, Fels, Tunnel, Mauer.
// Gleiche Regeln wie world/street.ts: Licht von oben, Kanten oben hell, Erdgeschoss 2 Kacheln, Obergeschoss, Gesims.
// Jedes Material liefert dieselben Bausteine: <m>0, <m>1, <m>Wall, <m>Up, <m>UpLit, <m>Cornice, <m>Win0, <m>Win1, <m>Door0, <m>Door1.

const T = 16;

function speckle(c: Ctx, cols: string[], n: number, seed: number, x0 = 0, y0 = 0, w = T, h = T) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) p(c, x0 + Math.floor(rnd() * w), y0 + Math.floor(rnd() * h), cols[Math.floor(rnd() * cols.length)]);
}

type Kind = 'putz' | 'ziegel' | 'holz' | 'kachel' | 'quader' | 'beton';

export interface Material {
  kind: Kind;
  base: string;
  light: string;
  dark: string;
  sockel: string;
  frame: string;
  glass: string;
  lit: string;
  door: string;
  trim: string;
  /** was im Schaufenster zu sehen ist */
  ware: (c: Ctx, x: number, y: number, w: number, h: number) => void;
}

/** Fläche des Materials (16×16) */
function surface(c: Ctx, m: Material, seed: number) {
  r(c, 0, 0, T, T, m.base);
  const rnd = rng(seed);
  switch (m.kind) {
    case 'putz':
      speckle(c, [m.light, m.dark, m.base], 30, seed);
      for (let i = 0; i < 2; i++) { const x = Math.floor(rnd() * 14); for (let y = Math.floor(rnd() * 6); y < 16; y += 2) p(c, x, y, m.dark); }
      break;
    case 'ziegel':
      for (let y = 0; y < T; y += 4) {
        r(c, 0, y + 3, T, 1, m.dark);
        for (let x = (y / 4) % 2 ? 4 : 0; x < T + 8; x += 8) { r(c, x, y, 1, 3, m.dark); if (rnd() < 0.35) r(c, x + 1, y, 6, 3, m.light); p(c, x + 1, y, m.light); }
      }
      break;
    case 'holz':
      for (let x = 0; x < T; x += 4) { r(c, x, 0, 1, T, m.dark); r(c, x + 1, 0, 1, T, m.light); }
      for (let i = 0; i < 6; i++) p(c, 2 + Math.floor(rnd() * 3) * 4, Math.floor(rnd() * 16), m.dark); // Maserung, Astlöcher
      p(c, 2, 2, '#1a1410'); p(c, 2, 13, '#1a1410'); p(c, 10, 2, '#1a1410'); p(c, 10, 13, '#1a1410'); // Nägel
      break;
    case 'kachel':
      for (let y = 0; y < T; y += 4) r(c, 0, y, T, 1, m.dark);
      for (let x = 0; x < T; x += 4) r(c, x, 0, 1, T, m.dark);
      for (let y = 1; y < T; y += 4) for (let x = 1; x < T; x += 4) { p(c, x, y, m.light); if (rnd() < 0.2) r(c, x, y, 3, 3, m.light); }
      break;
    case 'quader':
      for (let y = 0; y < T; y += 5) {
        r(c, 0, y + 4, T, 1, m.dark);
        for (let x = (y / 5) % 2 ? 5 : 0; x < T + 10; x += 10) { r(c, x, y, 1, 4, m.dark); r(c, x + 1, y, 8, 1, m.light); }
      }
      speckle(c, [m.dark, m.light], 8, seed);
      break;
    case 'beton':
      speckle(c, [m.light, m.dark], 18, seed);
      r(c, 0, 15, T, 1, m.dark); r(c, 15, 0, 1, T, m.dark); // Plattenfuge
      for (const [x, y] of [[4, 4], [11, 4], [4, 11], [11, 11]]) p(c, x, y, m.dark); // Ankerlöcher
      break;
  }
}

function sockel(c: Ctx, m: Material, y: number) {
  r(c, 0, y, T, T - y, m.sockel);
  r(c, 0, y, T, 1, m.trim);
  for (let x = 3; x < T; x += 7) r(c, x, y + 1, 1, T - y - 1, 'rgba(0,0,0,0.25)');
  r(c, 0, T - 1, T, 1, 'rgba(0,0,0,0.45)');
}

function band(c: Ctx, m: Material) {
  r(c, 0, 0, T, 2, m.trim); r(c, 0, 0, T, 1, 'rgba(255,255,255,0.18)'); r(c, 0, 2, T, 1, 'rgba(0,0,0,0.35)');
}

function upWindow(c: Ctx, m: Material, lit: boolean) {
  r(c, 3, 2, 10, 11, '#141016');
  r(c, 4, 3, 8, 9, lit ? m.lit : m.glass);
  if (lit) { r(c, 4, 3, 8, 2, 'rgba(0,0,0,0.25)'); r(c, 4, 3, 2, 9, 'rgba(0,0,0,0.18)'); }
  else { r(c, 5, 4, 2, 1, 'rgba(255,255,255,0.18)'); }
  r(c, 8, 3, 1, 9, m.frame); r(c, 4, 7, 8, 1, m.frame);
  r(c, 2, 13, 12, 1, m.trim); r(c, 2, 14, 12, 1, 'rgba(0,0,0,0.4)');
}

function makeMaterial(scene: Phaser.Scene, name: string, m: Material, seed: number) {
  const make = (key: string, draw: (c: Ctx) => void) => tex2x(scene, `${name}${key}`, T, T, draw);
  make('0', (c) => { surface(c, m, seed); sockel(c, m, 12); });
  make('1', (c) => { surface(c, m, seed + 1); band(c, m); });
  make('Wall', (c) => surface(c, m, seed + 2));
  make('Up', (c) => { surface(c, m, seed + 3); upWindow(c, m, false); });
  make('UpLit', (c) => { surface(c, m, seed + 4); upWindow(c, m, true); });
  make('Cornice', (c) => {
    surface(c, m, seed + 5);
    r(c, 0, 0, T, 2, '#0b0a10');
    r(c, 0, 2, T, 1, '#6a6a74'); r(c, 0, 3, T, 1, '#3a3a44');
    r(c, 0, 4, T, 2, m.trim); r(c, 0, 4, T, 1, 'rgba(255,255,255,0.2)');
    for (let x = 1; x < T; x += 3) r(c, x, 6, 2, 1, 'rgba(0,0,0,0.35)');
  });
  // Schaufenster, unterer Teil (mit Ware) und oberer Teil
  make('Win0', (c) => {
    surface(c, m, seed + 6); sockel(c, m, 13);
    r(c, 1, 0, 14, 13, '#141016'); r(c, 2, 0, 12, 12, m.lit);
    m.ware(c, 2, 0, 12, 12);
    r(c, 1, 12, 14, 1, m.trim);
  });
  make('Win1', (c) => {
    surface(c, m, seed + 7); band(c, m);
    r(c, 1, 3, 14, 13, '#141016'); r(c, 2, 4, 12, 12, m.lit);
    r(c, 2, 4, 12, 2, 'rgba(0,0,0,0.3)'); // Sturz-Schatten
    r(c, 8, 4, 1, 12, m.frame);
    r(c, 3, 7, 3, 1, 'rgba(255,255,255,0.35)'); // Spiegelung
  });
  make('Door0', (c) => {
    surface(c, m, seed + 8); sockel(c, m, 13);
    r(c, 2, 0, 12, 16, '#141016'); r(c, 3, 0, 10, 15, m.door);
    r(c, 4, 0, 8, 5, m.lit); r(c, 8, 0, 1, 5, m.door);
    r(c, 4, 7, 3, 6, 'rgba(0,0,0,0.25)'); r(c, 9, 7, 3, 6, 'rgba(0,0,0,0.25)');
    r(c, 11, 5, 1, 3, '#e0c060');
    r(c, 2, 15, 12, 1, '#2a2a2a');
  });
  make('Door1', (c) => {
    surface(c, m, seed + 9); band(c, m);
    r(c, 2, 3, 12, 13, '#141016'); r(c, 3, 4, 10, 12, m.door);
    r(c, 3, 4, 10, 2, m.lit); // Oberlicht
    r(c, 4, 8, 8, 8, m.lit); r(c, 8, 8, 1, 8, m.door);
  });
}

// Schaufenster-Inhalte: zeigen, was der Laden ist
const ware = {
  /** Waschsalon: Trommeln der Maschinen */
  waesche: (c: Ctx, x: number, y: number, w: number) => {
    for (let i = 0; i < w - 4; i += 6) { r(c, x + 1 + i, y + 4, 5, 7, '#e8ece8'); blob(c, x + 3.5 + i, y + 7.5, 1.8, 1.8, '#3a4a5a'); p(c, x + 3 + i, y + 7, '#9ab8d0'); }
  },
  /** Gewürzladen: Säcke und bunte Gläser */
  gewuerz: (c: Ctx, x: number, y: number, w: number) => {
    const cols = ['#d84a1a', '#e8b020', '#8a3a1a', '#4a8a2a', '#c86a20'];
    for (let i = 0; i < w - 2; i += 3) { blob(c, x + 2 + i, y + 9, 1.6, 2, cols[(i / 3) % cols.length]); p(c, x + 2 + i, y + 7, '#f0d090'); }
    for (let i = 0; i < w - 2; i += 2) r(c, x + 1 + i, y + 3, 1, 2, cols[i % cols.length]);
  },
  /** Markt: Obst- und Gemüsekisten */
  obst: (c: Ctx, x: number, y: number, w: number) => {
    r(c, x, y + 8, w, 4, '#6a4626');
    for (let i = 0; i < w - 1; i += 2) blob(c, x + 1 + i, y + 7, 1.2, 1.2, ['#d03a2a', '#e8a030', '#7aaa30', '#f0d040'][i % 4]);
    for (let i = 0; i < w; i += 3) r(c, x + i, y + 2, 2, 3, '#3a6a2a'); // Kräuter hängen oben
  },
  /** Club: rosa Licht, Vorhang, Silhouette mit Fliege */
  club: (c: Ctx, x: number, y: number, w: number) => {
    r(c, x, y, w, 3, '#8a1a5a'); for (let i = 0; i < w; i += 2) p(c, x + i, y + 3, '#6a1048');
    r(c, x + 5, y + 5, 3, 6, '#2a0a20'); blob(c, x + 6.5, y + 4.5, 1.6, 1.6, '#2a0a20'); r(c, x + 5, y + 7, 3, 1, '#ff5ac8');
  },
  /** Shisha: rotes Glimmen, Rauch, Wasserpfeife */
  shisha: (c: Ctx, x: number, y: number, w: number) => {
    r(c, x, y, w, 12, 'rgba(60,10,10,0.25)');
    r(c, x + 4, y + 9, 3, 3, '#3a8a8a'); r(c, x + 5, y + 4, 1, 5, '#c8a040'); r(c, x + 4, y + 3, 3, 1, '#e86a2a');
    for (let i = 0; i < 5; i++) p(c, x + 7 + i, y + 2 + (i % 2), 'rgba(255,230,220,0.5)');
    r(c, x + 9, y + 8, 3, 4, '#5a2a1a');
  },
  /** Botschaft: Lamellenjalousien */
  amt: (c: Ctx, x: number, y: number, w: number, h: number) => { for (let i = 1; i < h; i += 2) r(c, x, y + i, w, 1, 'rgba(40,50,70,0.55)'); },
  /** Altbau: farbiges Bleiglas */
  bleiglas: (c: Ctx, x: number, y: number, w: number, h: number) => {
    const cols = ['#3a2a6a', '#5a2a4a', '#2a4a6a', '#6a5a2a'];
    for (let yy = 0; yy < h; yy += 3) for (let xx = 0; xx < w; xx += 3) r(c, x + xx, y + yy, 2, 2, cols[(xx + yy) % 4]);
  },
  leer: (c: Ctx, x: number, y: number, w: number, h: number) => { r(c, x, y, w, h, '#1a1a20'); for (let i = 0; i < w; i += 3) r(c, x + i, y + 2, 2, h - 3, '#8a7a5a'); }, // vernagelt
};

export const MATERIALS: Record<string, Material> = {
  beton: { kind: 'beton', base: '#868a90', light: '#9a9ea4', dark: '#6a6e74', sockel: '#55585e', frame: '#3a3e46', glass: '#22303e', lit: '#c8d4e0', door: '#3a4656', trim: '#b8bcc2', ware: ware.amt },
  ocker: { kind: 'putz', base: '#a8824a', light: '#b8925a', dark: '#8e6c3a', sockel: '#5a4a36', frame: '#3a2a18', glass: '#26303e', lit: '#f0c070', door: '#2e5a3a', trim: '#c8a870', ware: ware.obst },
  violett: { kind: 'putz', base: '#4e3a5a', light: '#5e4a6a', dark: '#3a2a46', sockel: '#2e2434', frame: '#1a1020', glass: '#20182a', lit: '#e060b0', door: '#2a1a2e', trim: '#8a6a9a', ware: ware.club },
  holz: { kind: 'holz', base: '#3a2a24', light: '#4e3a30', dark: '#241a16', sockel: '#2a2420', frame: '#1a1410', glass: '#241a1a', lit: '#d8703a', door: '#5a2a1a', trim: '#7a5a3a', ware: ware.shisha },
  kachel: { kind: 'kachel', base: '#9ab8b0', light: '#b8d4cc', dark: '#6e8a84', sockel: '#4a5a58', frame: '#3a4a4a', glass: '#2a3a40', lit: '#e8f0d8', door: '#8a2a2a', trim: '#d8e0d8', ware: ware.waesche },
  safran: { kind: 'putz', base: '#c07838', light: '#d08848', dark: '#9a5e28', sockel: '#5a3a24', frame: '#3a1a10', glass: '#2a2030', lit: '#f8c060', door: '#6a2a5a', trim: '#e8b060', ware: ware.gewuerz },
  stein: { kind: 'quader', base: '#4e4a56', light: '#625e6a', dark: '#36323e', sockel: '#2e2a34', frame: '#1a1820', glass: '#1a1828', lit: '#5a4a8a', door: '#2a2430', trim: '#6e6a76', ware: ware.bleiglas },
  leer: { kind: 'ziegel', base: '#4e3428', light: '#5e4032', dark: '#2e1c16', sockel: '#3a3430', frame: '#2a2018', glass: '#1a1a22', lit: '#2a2a30', door: '#3a3028', trim: '#6a625a', ware: ware.leer },
};

function sign(scene: Phaser.Scene, key: string, text: string, w: number, bg: string, fg: string, edge: string) {
  tex2x(scene, key, w, 10, (c) => {
    r(c, 0, 0, w, 10, edge); r(c, 1, 1, w - 2, 8, bg);
  }, { rim: false, grain: 0, detail: (c) => signText(c, text, w, 10, fg, 'rgba(0,0,0,0.6)') });
}

function awning(scene: Phaser.Scene, key: string, a: string, b: string, w = 48) {
  tex2x(scene, key, w, 14, (c) => {
    for (let x = 0; x < w; x += 6) { r(c, x, 0, 3, 10, a); r(c, x + 3, 0, 3, 10, b); }
    r(c, 0, 0, w, 1, '#2a1a10');
    for (let x = 0; x < w; x += 4) { r(c, x, 10, 3, 2, x % 8 ? b : a); p(c, x + 1, 12, x % 8 ? b : a); }
    r(c, 0, 0, w, 3, 'rgba(255,255,255,0.12)'); r(c, 0, 8, w, 2, 'rgba(0,0,0,0.25)');
  });
}

export function makeCityTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('betonWall')) return;
  let seed = 300;
  for (const [name, m] of Object.entries(MATERIALS)) makeMaterial(scene, name, m, (seed += 20));
  // Türen für Putz und Ziegel (die Kneipentür bleibt einmalig)
  makeMaterial(scene, 'putzG', { kind: 'putz', base: '#9c8e72', light: '#a59779', dark: '#86795e', sockel: '#56524a', frame: '#2a2018', glass: '#1c2436', lit: '#e8b060', door: '#5a3420', trim: '#b0a284', ware: ware.obst }, 500);
  makeMaterial(scene, 'ziegelG', { kind: 'ziegel', base: '#5e3428', light: '#673a2c', dark: '#2e1c16', sockel: '#56524a', frame: '#e0dcd0', glass: '#1e2a40', lit: '#f0d890', door: '#3a5a34', trim: '#948e80', ware: ware.obst }, 520);

  const make = (key: string, draw: (c: Ctx) => void, w = T, h = T) => tex2x(scene, key, w, h, draw);

  // ---- Boden
  for (const [k, s] of [['grass0', 601], ['grass1', 602]] as const)
    make(k, (c) => {
      r(c, 0, 0, T, T, '#2a3a24');
      speckle(c, ['#34482c', '#22301e', '#3e5232', '#2e4228'], 60, s);
      const rnd = rng(s + 5);
      for (let i = 0; i < 7; i++) { const x = Math.floor(rnd() * 15), y = 2 + Math.floor(rnd() * 13); p(c, x, y, '#4a6238'); p(c, x, y - 1, '#567044'); } // Halme
      if (s === 602) { p(c, 4, 5, '#c8c0d8'); p(c, 11, 10, '#d8d0a0'); } // Kleeblüte
    });
  make('parkLine', (c) => {
    r(c, 0, 0, T, T, '#25262d');
    speckle(c, ['#2e2f37', '#1d1e24', '#34353d'], 40, 611);
    r(c, 7, 0, 2, T, '#c8c2a4'); for (const y of [3, 10]) p(c, 7 + (y % 2), y, '#25262d');
  });

  // ---- Fels (rechter Rand), hohe Mauer (Innenhof), Tor, Tunnel
  for (const [k, s] of [['rock0', 621], ['rock1', 622]] as const)
    make(k, (c) => {
      r(c, 0, 0, T, T, '#3e3c44');
      const rnd = rng(s);
      for (let i = 0; i < 5; i++) {
        const x = Math.floor(rnd() * 12), y = Math.floor(rnd() * 12), w = 3 + Math.floor(rnd() * 5), h = 2 + Math.floor(rnd() * 4);
        r(c, x, y, w, h, '#4a4852'); r(c, x, y, w, 1, '#5e5c66'); r(c, x, y + h, w, 1, '#2a2830');
      }
      speckle(c, ['#34323a', '#54525c'], 12, s + 1);
      if (s === 622) { p(c, 3, 12, '#3a5a2a'); p(c, 4, 12, '#4a6a32'); } // Moos
    });
  make('rockTop', (c) => {
    r(c, 0, 0, T, T, '#3e3c44'); speckle(c, ['#34323a', '#54525c'], 14, 631);
    r(c, 0, 0, T, 3, '#2e4228'); for (let x = 0; x < T; x += 2) p(c, x, 3, '#3e5232'); // Grasnarbe oben
  });
  const mauer = (c: Ctx, seed: number) => {
    r(c, 0, 0, T, T, '#5a5650');
    for (let y = 0; y < T; y += 4) { r(c, 0, y + 3, T, 1, '#3a3632'); for (let x = (y / 4) % 2 ? 3 : 0; x < T + 6; x += 6) { r(c, x, y, 1, 3, '#3a3632'); p(c, x + 1, y, '#6e6a62'); } }
    speckle(c, ['#4a6a32', '#3a5a2a'], 6, seed); // Moos
  };
  make('mauer0', (c) => { mauer(c, 641); r(c, 0, 14, T, 2, '#2e2a26'); for (let x = 1; x < T; x += 3) p(c, x, 13, '#3a5a2a'); });
  make('mauer1', (c) => mauer(c, 642));
  make('mauerTop', (c) => {
    r(c, 0, 0, T, T, '#0b0a10');
    r(c, 0, 5, T, 6, '#6e6a62'); r(c, 0, 5, T, 1, '#8a867c'); r(c, 0, 10, T, 1, '#3a3632'); // Abdeckung von oben
    for (let x = 2; x < T; x += 5) { p(c, x, 6, '#4a6a32'); p(c, x + 1, 5, '#3a5a2a'); } // Efeu
  });
  // Mauerkrone einer seitlichen Mauer (läuft von oben nach unten durchs Bild)
  make('mauerTopV', (c) => {
    r(c, 0, 0, T, T, '#0b0a10');
    r(c, 5, 0, 6, T, '#6e6a62'); r(c, 5, 0, 1, T, '#8a867c'); r(c, 10, 0, 1, T, '#3a3632');
    for (let y = 2; y < T; y += 5) { p(c, 6, y, '#4a6a32'); p(c, 5, y + 1, '#3a5a2a'); }
  });
  make('tor0', (c) => {
    mauer(c, 651); r(c, 1, 0, 14, 16, '#16141a');
    for (let x = 2; x < 15; x += 3) { r(c, x, 0, 1, 16, '#3a3a42'); p(c, x, 0, '#5a5a62'); }
    r(c, 1, 8, 14, 1, '#4a4a52'); r(c, 6, 7, 4, 3, '#8a6a2a'); p(c, 7, 8, '#1a1410'); // Kette und Schloss
  });
  make('tor1', (c) => {
    mauer(c, 652); r(c, 1, 3, 14, 13, '#16141a');
    for (let x = 2; x < 15; x += 3) { r(c, x, 3, 1, 13, '#3a3a42'); p(c, x, 2, '#5a5a62'); p(c, x, 1, '#7a7a82'); } // Spitzen
    r(c, 1, 3, 14, 1, '#4a4a52');
    r(c, 3, 1, 10, 2, '#5a5650'); r(c, 6, 0, 4, 2, '#6e6a62'); // Torbogen-Schlussstein
  });
  make('portalL', (c) => { r(c, 0, 0, T, T, '#3e3c44'); r(c, 9, 0, 7, T, '#5e5a52'); for (let y = 0; y < T; y += 5) r(c, 9, y + 4, 7, 1, '#3a3632'); r(c, 15, 0, 1, T, '#2a2830'); });
  make('portalR', (c) => { r(c, 0, 0, T, T, '#3e3c44'); r(c, 0, 0, 7, T, '#5e5a52'); for (let y = 0; y < T; y += 5) r(c, 0, y + 4, 7, 1, '#3a3632'); r(c, 0, 0, 1, T, '#2a2830'); });
  make('tunnelDark', (c) => {
    r(c, 0, 0, T, T, '#060508');
    r(c, 0, 12, T, 4, '#141418'); for (let x = 0; x < T; x += 4) r(c, x, 13, 2, 1, '#3a3a2a'); // Fahrbahn verschwindet im Dunkel
    p(c, 8, 4, '#2a3040'); // ferne Lampe
  });
  make('tunnelArch', (c) => {
    r(c, 0, 0, T, T, '#060508');
    r(c, 0, 0, T, 5, '#5e5a52'); r(c, 0, 4, T, 1, '#3a3632'); for (let x = 0; x < T; x += 4) r(c, x, 0, 1, 4, '#3a3632'); // Bogensteine
    r(c, 0, 5, T, 2, 'rgba(0,0,0,0.6)');
  });
  make('portalTop', (c) => {
    r(c, 0, 0, T, T, '#3e3c44'); r(c, 0, 6, T, 10, '#5e5a52'); r(c, 0, 6, T, 1, '#7a766c');
    for (let x = 0; x < T; x += 8) r(c, x, 7, 1, 9, '#3a3632');
  });

  // ---- Bäume und Büsche (Deko-Objekte, stehen mit dem Stamm auf dem Boden)
  make('tree', (c) => {
    r(c, 14, 30, 4, 12, '#3a2a1e'); r(c, 14, 30, 1, 12, '#5a4230'); r(c, 12, 41, 8, 2, '#2a1e16');
    const crown: [number, number, number, string][] = [[16, 18, 13, '#1e3020'], [10, 22, 8, '#22362a'], [22, 22, 8, '#22362a'], [16, 14, 10, '#2a4430'], [12, 12, 6, '#345238'], [20, 16, 6, '#2e4a34'], [15, 9, 5, '#3e6040']];
    for (const [x, y, rr, col] of crown) blob(c, x, y, rr, rr * 0.9, col);
    speckle(c, ['#4a7048', '#3a5a3c'], 24, 661, 6, 4, 20, 18);
    for (let i = 0; i < 6; i++) p(c, 8 + i * 3, 27 + (i % 2), '#14201a'); // Unterkante dunkel
  }, 32, 44);
  make('bush', (c) => {
    blob(c, 8, 8, 7, 4.5, '#22362a'); blob(c, 5, 6, 4, 3, '#2a4430'); blob(c, 11, 6, 4, 3, '#2e4a34');
    speckle(c, ['#4a7048', '#3a5a3c'], 10, 671, 2, 3, 12, 6);
    r(c, 2, 11, 12, 1, 'rgba(0,0,0,0.35)');
  }, 16, 12);
  make('grave', (c) => {
    r(c, 3, 2, 8, 12, '#6a6670'); blob(c, 7, 3, 4, 2.5, '#6a6670'); r(c, 3, 2, 1, 12, '#827e88');
    r(c, 6, 5, 2, 5, '#4a4650'); r(c, 4, 7, 6, 1, '#4a4650'); // Kreuz eingemeißelt
    r(c, 1, 13, 12, 2, '#2e3a26'); p(c, 3, 12, '#4a6a32');
  }, 14, 16);

  // ---- Baustelle der Glanzbau Corporation
  make('bauzaun', (c) => {
    r(c, 0, 17, 3, 3, '#7a7a7a'); r(c, 13, 17, 3, 3, '#7a7a7a'); // Betonfüße
    r(c, 1, 2, 1, 16, '#9a9aa0'); r(c, 14, 2, 1, 16, '#9a9aa0'); r(c, 1, 2, 14, 1, '#9a9aa0');
    for (let y = 3; y < 17; y += 2) for (let x = 2; x < 14; x += 2) p(c, x + (y % 4 ? 1 : 0), y, '#6a6a72'); // Gitter
    r(c, 2, 7, 12, 5, '#f0d020'); r(c, 2, 7, 12, 1, '#fff070'); for (let x = 3; x < 13; x += 2) p(c, x, 9, '#1a1a1a'); // Banner GLANZBAU
    r(c, 2, 10, 12, 1, '#c8a810');
  }, 16, 20);
  make('bake', (c) => {
    r(c, 2, 4, 4, 11, '#f4f0e8'); for (let y = 5; y < 15; y += 4) r(c, 2, y, 4, 2, '#d02a2a');
    r(c, 1, 15, 6, 2, '#2a2a2a'); r(c, 2, 1, 4, 3, '#f0a020'); r(c, 3, 1, 2, 1, '#fff0a0'); // Warnleuchte
  }, 8, 17);
  make('poller', (c) => { r(c, 1, 2, 4, 9, '#3a3e46'); r(c, 1, 2, 4, 1, '#6a6e76'); r(c, 1, 5, 4, 1, '#c8c8c8'); r(c, 0, 11, 6, 1, 'rgba(0,0,0,0.4)'); }, 6, 12);
  make('cafeTable', (c) => {
    r(c, 3, 3, 10, 2, '#8a6a4a'); r(c, 7, 5, 2, 6, '#3a3a3a'); r(c, 5, 11, 6, 1, '#2a2a2a');
    r(c, 0, 6, 3, 2, '#5a3a2a'); r(c, 0, 8, 1, 4, '#3a2a1a'); r(c, 13, 6, 3, 2, '#5a3a2a'); r(c, 15, 8, 1, 4, '#3a2a1a'); // Hocker
    r(c, 9, 0, 2, 3, '#3a8a8a'); p(c, 10, 0, '#e86a2a'); // kleine Wasserpfeife
  }, 16, 12);
  make('posterBox', (c) => {
    r(c, 0, 0, 12, 16, '#1a0a1e'); r(c, 1, 1, 10, 14, '#ff5ac8'); r(c, 2, 2, 8, 12, '#3a0a30');
    blob(c, 6, 5, 2, 2, '#f0c0a0'); r(c, 4, 7, 4, 5, '#f0c0a0'); r(c, 4, 8, 4, 1, '#1a0a1e'); // Muskelmann mit Fliege
    r(c, 3, 7, 1, 3, '#f0c0a0'); r(c, 8, 7, 1, 3, '#f0c0a0');
  }, 12, 16);

  // ---- Schilder (Pixel-Schrift)
  sign(scene, 'signIndia', 'MASALA BASAR', 58, '#3a1a2a', '#f8c040', '#e8b060');
  sign(scene, 'signShisha', 'SHISHA 1001', 52, '#1a1210', '#ff7a3a', '#7a5a3a');
  sign(scene, 'signStrip', 'MUSKELKATER', 54, '#1a0a1e', '#ff5ac8', '#8a3a7a');
  sign(scene, 'signMarkt', 'ÖZEN MARKT', 50, '#1a3a24', '#f0e8c0', '#c8a870');
  sign(scene, 'signWasch', 'WASCHSALON', 50, '#f0f0e8', '#c02a2a', '#8a2a2a');
  sign(scene, 'signBotschaft', 'BOTSCHAFT', 46, '#e8ecf0', '#1a3a7a', '#8a9ab0');
  sign(scene, 'signWC', 'WC', 14, '#1a3a7a', '#ffffff', '#c8d0e0');
  sign(scene, 'signGlanzbau', 'GLANZBAU CORP.', 64, '#f0d020', '#1a1a1a', '#1a1a1a');
  sign(scene, 'signGesperrt', 'GESPERRT', 42, '#c02020', '#ffffff', '#f4f0e8');
  sign(scene, 'signVermieten', 'ZU VERMIETEN', 56, '#f0e8d0', '#2a2a2a', '#8a7a5a');
  sign(scene, 'signParken', 'P', 12, '#1a4aa0', '#ffffff', '#e8ecf0');
  sign(scene, 'signAlt', 'ANNO 1888', 40, '#3a3640', '#c8c0a8', '#6e6a76');
  awning(scene, 'awningRed', '#8a1a1a', '#d8c8a8');
  awning(scene, 'awningGreen', '#2a6a3a', '#f0e8d8');
  awning(scene, 'awningPurple', '#5a1a5a', '#ff7ad0', 32);
  awning(scene, 'awningSaffron', '#d07020', '#f0d890', 32);
}
