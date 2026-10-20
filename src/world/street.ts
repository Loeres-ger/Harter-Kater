import Phaser from 'phaser';
import { Ctx, bevel, blob, r, p, rng, tex, tex2x } from '../gfx';

// Straßenansicht: Materialien für die Außenwelt in der festen Perspektive „schräg von vorn, ohne Dächer“.
// Art Direction:
//  - Nacht, kühles Blau-Violett als Umgebung, warmes Natriumlicht (#ffc870) an Laternen, rosa Neon an der Kneipe.
//  - Materialien unterscheiden sich über Form und Struktur, nicht über Sättigung: Asphalt fein gekörnt, Gehweg in Platten,
//    Putz weich mit Wasserflecken, Ziegel mit Fugen, Holz mit Maserung, Metall mit harter Kante und einem Glanzpunkt.
//  - Licht kommt von oben (Laternen) bzw. aus Fenstern: Kanten oben hell, unten dunkel; Kontaktschatten am Wandfuß.
//  - Gebäude: Erdgeschoss zwei Kacheln hoch (Türen 32 px, Figuren 20 px), darüber ein Obergeschoss und das Gesims.
//    Was über dem Gesims liegt (Dachflächen, Rückseiten), bleibt dunkel: Die Kamera zeigt nie Dächer oder Innenräume.

const T = 16;

function speckle(c: Ctx, cols: string[], n: number, seed: number, x0 = 0, y0 = 0, w = T, h = T) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) p(c, x0 + Math.floor(rnd() * w), y0 + Math.floor(rnd() * h), cols[Math.floor(rnd() * cols.length)]);
}

// ---------------------------------------------------------------- Boden

function asphalt(c: Ctx, seed: number) {
  r(c, 0, 0, T, T, '#25262d');
  speckle(c, ['#2e2f37', '#1d1e24', '#34353d', '#292a31'], 46, seed);
  const rnd = rng(seed + 3);
  // nasser Glanz: kurze, kühle Lichtkanten
  for (let i = 0; i < 3; i++) r(c, Math.floor(rnd() * 13), Math.floor(rnd() * 15), 2 + Math.floor(rnd() * 2), 1, '#363b4c');
}

function slab(c: Ctx, seed: number) {
  const rnd = rng(seed);
  const tones = ['#5a5c64', '#60626a', '#56585f', '#5d5f66'];
  for (const [sx, sy] of [[0, 0], [8, 0], [0, 8], [8, 8]]) {
    r(c, sx, sy, 8, 8, tones[Math.floor(rnd() * tones.length)]);
    r(c, sx, sy, 8, 1, '#6c6e76'); r(c, sx, sy, 1, 8, '#686a72'); // Kante oben/links im Licht
    r(c, sx, sy + 7, 8, 1, '#3e4048'); r(c, sx + 7, sy, 1, 8, '#41434b'); // Fuge
    speckle(c, ['#66686f', '#4f5158', '#6a6b70'], 4, seed + sx + sy * 3, sx + 1, sy + 1, 6, 6);
  }
}

// ---------------------------------------------------------------- Fassaden

/** Putz: warm, nachts gedämpft, mit Wasserflecken und weichen Farbschwankungen */
function putz(c: Ctx, seed: number) {
  r(c, 0, 0, T, T, '#9c8e72');
  speckle(c, ['#a59779', '#93856a', '#a89a7e', '#8e8166'], 34, seed);
  const rnd = rng(seed + 9);
  for (let i = 0; i < 2; i++) {
    const x = Math.floor(rnd() * 14);
    for (let y = Math.floor(rnd() * 6); y < 16; y += 1 + Math.floor(rnd() * 2)) p(c, x + (y % 5 === 0 ? 1 : 0), y, '#86795e'); // Regenspur
  }
}

/** Sockel aus Naturstein am Wandfuß */
function sockel(c: Ctx, y: number) {
  r(c, 0, y, T, T - y, '#56524a');
  r(c, 0, y, T, 1, '#6e695e');
  for (let x = 2; x < T; x += 7) r(c, x, y + 1, 1, T - y - 1, '#423e37');
  r(c, 0, T - 1, T, 1, '#2e2b26');
}

function ziegel(c: Ctx, seed: number, base = '#5e3428', fuge = '#2e1c16') {
  r(c, 0, 0, T, T, base);
  const rnd = rng(seed);
  for (let y = 0; y < T; y += 4) {
    r(c, 0, y + 3, T, 1, fuge);
    const o = (y / 4) % 2 ? 4 : 0;
    for (let x = o; x < T + 8; x += 8) {
      r(c, x, y, 1, 3, fuge);
      // Steine leicht unterschiedlich gebrannt
      const t = rnd();
      if (t < 0.3) r(c, x + 1, y, 6, 3, '#673a2c');
      else if (t < 0.45) r(c, x + 1, y, 6, 3, '#522e23');
      p(c, x + 1, y, '#76463a'); // Kante im Licht
    }
  }
}

/** Fenster im Obergeschoss: Laibung, Sprossen, Fensterbank; beleuchtet mit Vorhang */
function sprossenFenster(c: Ctx, lit: boolean, rahmen: string, x0 = 4, y0 = 3, w = 8, h = 9) {
  r(c, x0 - 1, y0 - 1, w + 2, h + 2, '#1a1210'); // Laibung
  r(c, x0, y0, w, h, lit ? '#d89848' : '#1c2436');
  if (lit) {
    r(c, x0, y0, w, 3, '#b06a38'); // Vorhang oben
    r(c, x0, y0, 2, h, '#a8623a');
    r(c, x0 + 2, y0 + 3, w - 2, h - 3, '#e8b060');
    p(c, x0 + 4, y0 + 5, '#5a3a20'); // Schatten einer Topfpflanze
    r(c, x0 + 3, y0 + h - 2, 3, 2, '#5a3a20');
  } else {
    r(c, x0 + 1, y0 + 1, 2, 1, '#3a4a6a'); p(c, x0 + 1, y0 + 2, '#2e3c58'); // Spiegelung
  }
  r(c, x0 + Math.floor(w / 2), y0, 1, h, rahmen);
  r(c, x0, y0 + Math.floor(h / 2), w, 1, rahmen);
  r(c, x0 - 2, y0 + h + 1, w + 4, 1, '#8a8274'); // Fensterbank
  r(c, x0 - 2, y0 + h + 2, w + 4, 1, '#2a2420');
}

/** Gesims oben: Kranzleiste mit Zahnschnitt, darüber die Dachkante (Rinne) */
function gesims(c: Ctx, wall: () => void) {
  wall();
  r(c, 0, 0, T, 2, '#0b0a10');
  r(c, 0, 2, T, 1, '#6a6a74'); // Regenrinne
  r(c, 0, 3, T, 1, '#3a3a44');
  r(c, 0, 4, T, 2, '#8a8270'); // Kranzleiste
  r(c, 0, 4, T, 1, '#a49c88');
  for (let x = 1; x < T; x += 3) r(c, x, 6, 2, 1, '#6e6656'); // Zahnschnitt
  r(c, 0, 7, T, 1, '#3e3a32');
}

export function makeStreetTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('asph0')) return;
  const make = (key: string, draw: (c: Ctx) => void, detail?: (c: Ctx) => void) => tex2x(scene, key, T, T, draw, detail ? { detail } : {});
  const overlay = (key: string, draw: (c: Ctx) => void) => tex2x(scene, key, T, T, draw, { rim: false, grain: 0 });

  // ---- Boden
  make('asph0', (c) => asphalt(c, 81));
  make('asph1', (c) => {
    asphalt(c, 82);
    // vergossener Riss (Bitumen)
    for (const [x, y] of [[1, 9], [2, 9], [3, 8], [4, 8], [5, 8], [6, 9], [7, 9], [8, 10], [9, 10], [10, 10], [11, 9], [12, 9], [13, 9], [14, 8]]) { p(c, x, y, '#141419'); p(c, x, y - 1, '#1b1c22'); }
  });
  make('asph2', (c) => {
    asphalt(c, 83);
    r(c, 3, 4, 9, 7, '#2b2c33'); // Flickstelle
    r(c, 3, 4, 9, 1, '#34353d'); r(c, 3, 10, 9, 1, '#1d1e24');
    speckle(c, ['#30313a', '#24252c'], 10, 84, 3, 4, 9, 7);
  });
  make('asphDash', (c) => { asphalt(c, 85); r(c, 7, 1, 2, 13, '#cfc7a0'); for (const y of [3, 8, 11]) p(c, 7 + (y % 2), y, '#25262d'); });
  make('asphDashH', (c) => { asphalt(c, 86); r(c, 1, 7, 13, 2, '#cfc7a0'); for (const x of [4, 9]) p(c, x, 7 + (x % 2), '#25262d'); });
  make('slab0', (c) => slab(c, 91), (c) => bevel(c, '#3e4048', 0.12));
  make('slab1', (c) => {
    slab(c, 92);
    for (const [x, y] of [[9, 2], [10, 3], [10, 4], [11, 5], [12, 5]]) p(c, x, y, '#34363d'); // Riss
    blob(c, 4, 12, 1.3, 0.9, '#3c3c40'); // Kaugummi
  }, (c) => bevel(c, '#3e4048', 0.12));
  make('slab2', (c) => {
    slab(c, 93);
    blob(c, 11, 11, 3.2, 1.6, '#4a4c56'); blob(c, 11, 11, 2.2, 1, '#545868'); // Wasserfleck
  }, (c) => bevel(c, '#3e4048', 0.12));

  // Bordsteine und Kontaktschatten als Überlagerung (Seite = wo die Straße bzw. die Wand liegt)
  overlay('curbS', (c) => {
    r(c, 0, 12, T, 1, '#a2a4ac'); r(c, 0, 13, T, 1, '#8a8c94'); r(c, 0, 14, T, 1, '#5c5e66'); r(c, 0, 15, T, 1, '#16171c');
    for (const x of [5, 13]) r(c, x, 12, 1, 3, '#4e5058');
  });
  overlay('curbN', (c) => {
    r(c, 0, 0, T, 1, '#16171c'); r(c, 0, 1, T, 1, '#8a8c94'); r(c, 0, 2, T, 1, '#a2a4ac');
    for (const x of [5, 13]) r(c, x, 1, 1, 2, '#4e5058');
  });
  overlay('curbW', (c) => {
    r(c, 0, 0, 1, T, '#16171c'); r(c, 1, 0, 1, T, '#5c5e66'); r(c, 2, 0, 1, T, '#8a8c94'); r(c, 3, 0, 1, T, '#a2a4ac');
    for (const y of [6, 14]) r(c, 1, y, 3, 1, '#4e5058');
  });
  overlay('curbE', (c) => {
    r(c, 15, 0, 1, T, '#16171c'); r(c, 14, 0, 1, T, '#5c5e66'); r(c, 13, 0, 1, T, '#8a8c94'); r(c, 12, 0, 1, T, '#a2a4ac');
    for (const y of [6, 14]) r(c, 12, y, 3, 1, '#4e5058');
  });
  const ao = ['rgba(6,4,12,0.62)', 'rgba(6,4,12,0.42)', 'rgba(6,4,12,0.26)', 'rgba(6,4,12,0.14)', 'rgba(6,4,12,0.06)'];
  overlay('aoN', (c) => ao.forEach((col, i) => r(c, 0, i, T, 1, col)));
  overlay('aoW', (c) => ao.slice(1).forEach((col, i) => r(c, i, 0, 1, T, col)));
  overlay('aoE', (c) => ao.slice(1).forEach((col, i) => r(c, T - 1 - i, 0, 1, T, col)));

  // ---- Gebäude: was über dem Gesims liegt, bleibt dunkel
  make('void', (c) => { r(c, 0, 0, T, T, '#0b0a10'); speckle(c, ['#0e0d14', '#09080d'], 10, 101); });
  // Oberkante eines Hauses, dessen Rückseite zur Gasse zeigt: Attika mit Abdeckblech, keine Dachfläche
  make('backEdge', (c) => {
    r(c, 0, 0, T, T, '#0b0a10');
    r(c, 0, 0, T, 1, '#5c5964'); r(c, 0, 1, T, 1, '#3e3c46'); r(c, 0, 2, T, 1, '#24222b'); r(c, 0, 3, T, 1, '#060509');
    speckle(c, ['#0e0d14'], 6, 102, 0, 4, T, 12);
  });
  // Hintertür von oben: Lichtschein aus der Türöffnung, kleines Vordach
  make('backDoorTop', (c) => {
    r(c, 0, 0, T, T, '#0b0a10');
    r(c, 0, 0, T, 1, '#5c5964'); r(c, 0, 1, T, 1, '#3e3c46'); r(c, 0, 2, T, 1, '#24222b');
    r(c, 2, 0, 12, 3, '#6a6a74'); r(c, 2, 0, 12, 1, '#9a9aa4'); // Vordach aus Blech
    r(c, 4, 3, 8, 4, '#3a2410'); r(c, 5, 3, 6, 3, '#e0a050'); // offene Tür, Licht fällt heraus
    r(c, 7, 2, 2, 1, '#fff0b0'); // Lampe
  });

  // ---- Putzfassade (F, H, D, A): Erdgeschoss mit Sockel und Gesimsband, Obergeschoss mit Sprossenfenstern
  make('putz0', (c) => { putz(c, 111); sockel(c, 12); });
  make('putz0b', (c) => { putz(c, 112); sockel(c, 12); r(c, 15, 0, 1, 12, '#8a7d62'); });
  make('putz1', (c) => { putz(c, 113); r(c, 0, 0, T, 2, '#857860'); r(c, 0, 0, T, 1, '#b0a284'); r(c, 0, 2, T, 1, '#6a5e48'); });
  make('putzWin0', (c) => {
    putz(c, 114); sockel(c, 13);
    r(c, 2, 0, 12, 12, '#3a2414'); r(c, 3, 0, 10, 11, '#e8b060'); // unterer Teil des Schaufensters, warm erleuchtet
    for (let x = 4; x < 12; x += 2) { r(c, x, 5, 1, 4, ['#3b7a3b', '#7a1a2a', '#c8a03a', '#3a5a8a'][x % 4]); p(c, x, 4, '#2a1a10'); } // Flaschen
    r(c, 3, 9, 10, 2, '#5a3a20'); // Theke dahinter
    r(c, 1, 12, 14, 1, '#8a8274'); // Fensterbank
  });
  make('putzWin1', (c) => {
    putz(c, 115); r(c, 0, 0, T, 2, '#857860'); r(c, 0, 0, T, 1, '#b0a284');
    r(c, 2, 3, 12, 13, '#3a2414'); r(c, 3, 4, 10, 12, '#e8b060');
    r(c, 3, 4, 10, 3, '#a85a3a'); for (let x = 3; x < 13; x += 2) p(c, x, 7, '#8a4a2e'); // Gardine mit Bogenkante
    r(c, 8, 4, 1, 12, '#3a2414'); // Mittelpfosten
    p(c, 5, 10, '#fff0c0'); // Glanz einer Lampe drinnen
  });
  make('putzUp', (c) => { putz(c, 116); sprossenFenster(c, false, '#2a2018'); });
  make('putzUpLit', (c) => { putz(c, 117); sprossenFenster(c, true, '#3a2414'); });
  make('putzWall', (c) => putz(c, 118));
  make('putzCornice', (c) => gesims(c, () => putz(c, 119)));
  // Kneipentür, zwei Kacheln hoch: Messingrahmen, Holzkassetten, beleuchtetes Glas
  make('pubDoor0', (c) => {
    putz(c, 121); sockel(c, 13);
    r(c, 1, 0, 14, 16, '#c8962e'); r(c, 2, 0, 12, 16, '#2a1408'); r(c, 3, 0, 10, 15, '#6e3c1c');
    r(c, 4, 0, 8, 5, '#f8d880'); r(c, 8, 0, 1, 5, '#6e3c1c'); // Glas, unterer Teil
    r(c, 4, 7, 3, 6, '#5a2e14'); r(c, 9, 7, 3, 6, '#5a2e14'); // Kassetten
    r(c, 4, 7, 3, 1, '#8a5030'); r(c, 9, 7, 3, 1, '#8a5030');
    r(c, 11, 5, 1, 3, '#ffe060'); p(c, 12, 6, '#ffe060'); // Klinke
    r(c, 2, 15, 12, 1, '#3a3a3a'); // Schwelle
  });
  make('pubDoor1', (c) => {
    putz(c, 122); r(c, 0, 0, T, 2, '#857860');
    r(c, 1, 2, 14, 14, '#c8962e'); r(c, 2, 3, 12, 13, '#2a1408'); r(c, 3, 3, 10, 13, '#6e3c1c');
    r(c, 3, 3, 10, 3, '#f0c060'); r(c, 3, 3, 10, 1, '#fff0b0'); for (let x = 4; x < 13; x += 3) r(c, x, 3, 1, 3, '#6e3c1c'); // Oberlicht
    r(c, 4, 8, 8, 8, '#f8d880'); r(c, 8, 8, 1, 8, '#6e3c1c'); // Glas, oberer Teil
  });
  // Zigarettenautomat, oberer Teil mit Leuchtfeld
  make('automatTop', (c) => {
    putz(c, 123); r(c, 0, 0, T, 2, '#857860');
    r(c, 2, 4, 12, 12, '#7a1e1e'); r(c, 2, 4, 12, 1, '#b03030'); r(c, 13, 4, 1, 12, '#4a1010');
    r(c, 3, 6, 10, 4, '#f4e8c8'); r(c, 4, 7, 8, 2, '#c02a2a'); // Leuchtfeld
    for (let x = 4; x < 12; x += 2) r(c, x, 11, 1, 4, ['#e8e0c0', '#3a6ab0', '#e0c040', '#3aa060'][x % 4]); // Packungen
  });

  // ---- Ziegelfassade (N, O, U und die Rückwände der Nachbarhäuser)
  make('ziegel0', (c) => { ziegel(c, 131); sockel(c, 13); });
  make('ziegel1', (c) => { ziegel(c, 132); r(c, 0, 0, T, 2, '#7a7468'); r(c, 0, 0, T, 1, '#948e80'); r(c, 0, 2, T, 1, '#3a2a22'); });
  make('ziegelWin0', (c) => {
    ziegel(c, 133); sockel(c, 13);
    r(c, 2, 0, 12, 12, '#1a1010'); r(c, 3, 0, 10, 11, '#1e2a40');
    r(c, 3, 8, 10, 3, '#6a5a40'); for (let x = 4; x < 12; x += 3) blob(c, x + 1, 8, 1.4, 1.2, ['#e8c060', '#c86a3a', '#8aa040'][x % 3]); // Auslage
    r(c, 1, 12, 14, 1, '#8a8274');
  });
  make('ziegelWin1', (c) => {
    ziegel(c, 134); r(c, 0, 0, T, 2, '#7a7468');
    r(c, 2, 3, 12, 13, '#1a1010'); r(c, 3, 4, 10, 12, '#1e2a40');
    r(c, 3, 4, 3, 2, '#3a4a6a'); p(c, 4, 6, '#2e3c58'); // Spiegelung
    r(c, 8, 4, 1, 12, '#1a1010');
  });
  make('ladenTop', (c) => {
    ziegel(c, 135); r(c, 0, 0, T, 2, '#7a7468');
    r(c, 2, 3, 12, 13, '#2a3a24'); r(c, 3, 4, 10, 12, '#3a5a34'); // grün gestrichene Ladentür
    r(c, 4, 5, 8, 4, '#f0d890'); r(c, 8, 5, 1, 4, '#2a3a24'); // Oberlicht
    r(c, 4, 11, 8, 5, '#f8e8b0'); // Glas
  });
  make('ziegelUp', (c) => { ziegel(c, 136); sprossenFenster(c, false, '#e0dcd0'); });
  make('ziegelUpLit', (c) => { ziegel(c, 137); sprossenFenster(c, true, '#e0dcd0'); });
  make('ziegelWall', (c) => ziegel(c, 138));
  make('ziegelCornice', (c) => gesims(c, () => ziegel(c, 139)));

  // ---- Requisiten für Kneipe und Feinkostladen (als Deko-Objekte in maps/alley.json platziert)
  // Markise des Feinkostladens: orange-weiß gestreift, 3 Kacheln breit
  tex2x(scene, 'awningShop', 48, 14, (c) => {
    for (let x = 0; x < 48; x += 6) r(c, x, 0, 3, 10, '#e08a2a');
    for (let x = 3; x < 48; x += 6) r(c, x, 0, 3, 10, '#f0e8d8');
    r(c, 0, 0, 48, 1, '#5a3a20');
    for (let x = 0; x < 48; x += 4) { r(c, x, 10, 3, 2, x % 8 ? '#f0e8d8' : '#e08a2a'); p(c, x + 1, 12, x % 8 ? '#f0e8d8' : '#e08a2a'); } // Volant
    r(c, 0, 9, 48, 1, 'rgba(0,0,0,0.25)');
  });
  // Gemüsekiste vor dem Laden
  tex2x(scene, 'crateVeg', 16, 12, (c) => {
    r(c, 1, 4, 14, 8, '#7a5230'); r(c, 1, 4, 14, 1, '#9a6a40'); r(c, 1, 8, 14, 1, '#5a3a20');
    for (let i = 0; i < 6; i++) blob(c, 3 + i * 2, 3 + (i % 2), 1.6, 1.4, ['#c83a2a', '#e8a030', '#6a9a30'][i % 3]);
  });
  // Bierfass neben der Kneipentür
  tex2x(scene, 'barrel', 12, 16, (c) => {
    r(c, 1, 2, 10, 13, '#6e4424'); r(c, 0, 4, 12, 9, '#7a4c28');
    for (const y of [3, 8, 13]) r(c, 0, y, 12, 1, '#3a3a40');
    r(c, 2, 4, 1, 9, '#946038'); r(c, 1, 1, 10, 2, '#4a2e18');
    r(c, 0, 15, 12, 1, 'rgba(0,0,0,0.4)');
  });
  // Laterne über der Kneipentür (Wandlampe aus Messing)
  tex2x(scene, 'pubLantern', 8, 12, (c) => {
    r(c, 3, 0, 2, 2, '#3a3a40'); r(c, 1, 2, 6, 1, '#c8962e'); r(c, 1, 3, 6, 6, '#f8d880'); r(c, 1, 3, 1, 6, '#c8962e'); r(c, 6, 3, 1, 6, '#c8962e');
    r(c, 2, 9, 4, 1, '#c8962e'); p(c, 3, 10, '#c8962e');
  });

  // ---- Licht: weicher Lichtkegel (für die Lichtkarte) und dezenter Schein (für das Leuchten selbst)
  if (!scene.textures.exists('lightSoft')) {
    tex(scene, 'lightSoft', 128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,0.42)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.18)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    });
  }
  if (!scene.textures.exists('lightPool')) {
    tex(scene, 'lightPool', 128, 128, (c) => {
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.45, 'rgba(255,255,255,0.75)');
      g.addColorStop(0.8, 'rgba(255,255,255,0.2)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 128, 128);
    });
  }
}
