import Phaser from 'phaser';
import { Ctx, bevel, blob, grain, outline, p, r, rng, tex2x } from '../gfx';

// Texturen für die erweiterte Welt: Straße, Gehweg, Gebäudehülle, Fassade, Inneneinrichtung, Toilette.
// Alle 16×16 (bzw. größer) gemalt und über tex2x in doppelter Auflösung erzeugt.

const T = 16;

function speckle(c: Ctx, cols: string[], n: number, seed: number, w = T, h = T) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) p(c, Math.floor(rnd() * w), Math.floor(rnd() * h), cols[Math.floor(rnd() * cols.length)]);
}

function brick(c: Ctx, base = '#5a3428', mortar = '#2e1c16', seed = 21) {
  r(c, 0, 0, T, T, base);
  for (let y = 0; y < T; y += 4) {
    r(c, 0, y + 3, T, 1, mortar);
    const o = (y / 4) % 2 ? 4 : 0;
    r(c, o, y, 1, 3, mortar);
    r(c, o + 8, y, 1, 3, mortar);
  }
  speckle(c, ['#6a4030', '#4a2a20'], 10, seed);
}

function plaster(c: Ctx, seed: number) {
  r(c, 0, 0, T, T, '#b4a486');
  speckle(c, ['#a89878', '#c4b494', '#9a8a6a'], 26, seed);
  const rnd = rng(seed + 7);
  // Wasserflecken und Schmutz unten
  for (let i = 0; i < 3; i++) blob(c, rnd() * 16, 4 + rnd() * 10, 1.5 + rnd() * 2, 2 + rnd() * 2, '#9c8c6c');
  r(c, 0, 13, T, 3, '#8a7a5c');
  p(c, 3 + Math.floor(rnd() * 8), 5, '#7a6a4c');
  p(c, 4 + Math.floor(rnd() * 8), 6, '#7a6a4c'); // kleiner Riss
}

function panel(c: Ctx, seed: number) {
  // oben vergilbte Tapete, unten dunkle Holzvertäfelung
  r(c, 0, 0, T, 7, '#b89a5a');
  for (let x = 1; x < T; x += 4) r(c, x, 1, 1, 5, '#a8884a');
  speckle(c, ['#9a7c40', '#c8aa6a'], 8, seed, T, 7);
  r(c, 0, 0, T, 1, '#1f1616');
  r(c, 0, 7, T, 1, '#3a2010');
  r(c, 0, 8, T, 8, '#5a3420');
  for (let x = 0; x < T; x += 4) { r(c, x, 8, 1, 8, '#3a2010'); r(c, x + 1, 8, 1, 8, '#6e442a'); }
  r(c, 0, 15, T, 1, '#2a1408');
}

export function makeWorldTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('road')) return;
  const make = (key: string, draw: (c: Ctx) => void, w = T, h = T, detail?: (c: Ctx) => void) => tex2x(scene, key, w, h, draw, detail ? { detail } : {});

  // ---------------------------------------------------------------- Straße & Boden
  make('road', (c) => { r(c, 0, 0, T, T, '#2a2a30'); speckle(c, ['#34343c', '#222228', '#3a3a40'], 30, 3); });
  make('roadDash', (c) => { r(c, 0, 0, T, T, '#2a2a30'); speckle(c, ['#34343c', '#222228'], 24, 4); r(c, 7, 2, 2, 11, '#d8d0a0'); });
  make('roadDashH', (c) => { r(c, 0, 0, T, T, '#2a2a30'); speckle(c, ['#34343c', '#222228'], 24, 5); r(c, 2, 7, 11, 2, '#d8d0a0'); });
  make('walk', (c) => {
    r(c, 0, 0, T, T, '#6c6c72');
    r(c, 0, 0, T, 1, '#4c4c54'); r(c, 0, 0, 1, T, '#4c4c54');
    r(c, 8, 0, 1, T, '#56565e');
    speckle(c, ['#7a7a80', '#5e5e66', '#84847e'], 18, 6);
  }, T, T, (c) => bevel(c, '#4c4c54', 0.18));
  make('walk2', (c) => {
    r(c, 0, 0, T, T, '#6c6c72');
    r(c, 0, 0, T, 1, '#4c4c54'); r(c, 0, 0, 1, T, '#4c4c54');
    r(c, 8, 0, 1, T, '#56565e');
    speckle(c, ['#7a7a80', '#5e5e66'], 18, 7);
    r(c, 10, 4, 1, 1, '#3a3a40'); r(c, 11, 5, 2, 1, '#3a3a40'); r(c, 13, 6, 1, 2, '#3a3a40'); // Riss
    blob(c, 4, 11, 1.4, 1, '#3a3a3a'); // Kaugummi
  }, T, T, (c) => bevel(c, '#4c4c54', 0.18));
  make('manhole', (c) => {
    r(c, 0, 0, T, T, '#2c2c34');
    blob(c, 8, 8, 6.5, 6.5, '#3e3e46');
    blob(c, 8, 8, 5.5, 5.5, '#4a4a52');
    for (let y = 4; y < 13; y += 2) r(c, 4, y, 9, 1, '#34343a');
    p(c, 6, 5, '#6a6a72');
  });
  make('crackCobble', (c) => {
    r(c, 0, 0, T, T, '#2c2c34');
    const rnd = rng(44);
    for (let y = 0; y < T; y += 4) for (let x = (y / 4) % 2 ? -2 : 0; x < T; x += 5) {
      const g = 60 + Math.floor(rnd() * 22);
      r(c, x + 1, y + 1, 4, 3, `rgb(${g},${g},${g + 8})`);
    }
    for (const [x, y] of [[3, 2], [4, 3], [5, 4], [5, 5], [6, 6], [8, 7], [9, 8], [9, 9], [11, 10]]) p(c, x, y, '#141418');
  }, T, T, (c) => bevel(c, '#2c2c34', 0.26));

  // ---------------------------------------------------------------- Nachbarhäuser & Gassenwände
  make('brickWin', (c) => {
    brick(c);
    r(c, 3, 3, 10, 9, '#1a1010');
    r(c, 4, 4, 8, 7, '#24304c');
    r(c, 8, 4, 1, 7, '#1a1010'); r(c, 4, 7, 8, 1, '#1a1010');
    p(c, 5, 5, '#5a6a90'); p(c, 10, 9, '#3a4a6a');
    r(c, 2, 12, 12, 1, '#8a7a6a');
  });
  make('brickWinLit', (c) => {
    brick(c);
    r(c, 3, 3, 10, 9, '#1a1010');
    r(c, 4, 4, 8, 7, '#d8a050');
    r(c, 8, 4, 1, 7, '#1a1010'); r(c, 4, 7, 8, 1, '#1a1010');
    r(c, 4, 4, 3, 3, '#a86a3a'); // Vorhang
    r(c, 2, 12, 12, 1, '#8a7a6a');
  });
  make('brickGraffiti', (c) => {
    brick(c, '#5a3428', '#2e1c16', 31);
    const cols = ['#e04aa0', '#4ad0a0', '#f0d040'];
    for (let i = 0; i < 9; i++) r(c, 1 + Math.round(i * 1.6), 5 + Math.round(Math.sin(i) * 2), 1, 5, cols[i % 3]);
    r(c, 1, 11, 14, 1, '#e04aa0');
    p(c, 13, 4, '#f0d040'); p(c, 14, 3, '#f0d040');
  });
  make('brickPipe', (c) => {
    brick(c, '#5a3428', '#2e1c16', 41);
    r(c, 10, 0, 3, T, '#7a7a80'); r(c, 10, 0, 1, T, '#9a9aa0');
    for (const y of [3, 11]) r(c, 9, y, 5, 1, '#4a4a50');
    r(c, 2, 6, 5, 4, '#6a6a70'); for (let y = 7; y < 10; y++) r(c, 3, y, 3, 1, '#3a3a40'); // Lüftung
    r(c, 0, 13, 9, 1, '#2a2a2a'); // Kabel
  });
  make('brickFacade', (c) => brick(c, '#6a3a2c', '#38221a', 51));
  make('brickFacadeWin', (c) => {
    brick(c, '#6a3a2c', '#38221a', 52);
    r(c, 3, 2, 10, 11, '#1a1010');
    r(c, 4, 3, 8, 9, '#1e2a40');
    r(c, 4, 3, 8, 1, '#3a4a6a');
    r(c, 8, 3, 1, 9, '#1a1010');
    r(c, 2, 13, 12, 1, '#9a8a7a');
  });
  // zugenagelte Nachbartür: klar nicht begehbar

  // ---------------------------------------------------------------- Dach & Gebäudehülle
  const shingles = (c: Ctx, base: string, dark: string, light: string, seed: number) => {
    r(c, 0, 0, T, T, base);
    for (let y = 0; y < T; y += 4) {
      r(c, 0, y + 3, T, 1, dark);
      const o = (y / 4) % 2 ? 2 : 0;
      for (let x = o; x < T; x += 4) { r(c, x, y, 1, 3, dark); p(c, x + 1, y, light); }
    }
    speckle(c, [dark, light], 8, seed);
  };
  make('roof', (c) => shingles(c, '#6a3434', '#4a2222', '#8a4a44', 61), T, T, (c) => bevel(c, '#4a2222', 0.16));
  make('roofDark', (c) => shingles(c, '#3e3e48', '#2a2a32', '#55555f', 62), T, T, (c) => bevel(c, '#2a2a32', 0.16));
  make('chimney', (c) => {
    shingles(c, '#6a3434', '#4a2222', '#8a4a44', 63);
    r(c, 3, 2, 10, 11, '#7a4030');
    for (let y = 4; y < 13; y += 3) r(c, 3, y, 10, 1, '#4a2418');
    r(c, 2, 1, 12, 2, '#3a3a3a');
    r(c, 5, 1, 6, 1, '#141414');
    outline(c, 0, 0, T, T);
  });
  make('vent', (c) => {
    shingles(c, '#6a3434', '#4a2222', '#8a4a44', 64);
    r(c, 4, 4, 8, 8, '#8a8a92');
    for (let y = 5; y < 11; y += 2) r(c, 5, y, 6, 1, '#4a4a52');
    r(c, 4, 4, 8, 1, '#aaaab2');
  });
  // Traufe über der Fassade: Dachkante mit Regenrinne
  make('eaves', (c) => {
    shingles(c, '#6a3434', '#4a2222', '#8a4a44', 65);
    r(c, 0, 12, T, 2, '#8a8a92'); r(c, 0, 12, T, 1, '#b0b0b8');
    r(c, 0, 14, T, 2, '#1a1212');
  });
  // Rückseite des Hauses: Dachkante, Rinne, Backsteinstreifen
  make('roofBack', (c) => {
    shingles(c, '#6a3434', '#4a2222', '#8a4a44', 66);
    r(c, 0, 0, T, 2, '#1a1212');
    r(c, 0, 2, T, 2, '#8a8a92');
    brickStrip(c);
  });
  function brickStrip(c: Ctx) {
    r(c, 0, 4, T, 12, '#5a3428');
    for (let y = 4; y < T; y += 3) { r(c, 0, y + 2, T, 1, '#2e1c16'); r(c, ((y / 3) % 2) * 4 + 2, y, 1, 2, '#2e1c16'); r(c, ((y / 3) % 2) * 4 + 10, y, 1, 2, '#2e1c16'); }
  }
  // Hintertür (Lieferzugang) – hell gerahmt, mit Lampe
  make('backDoor', (c) => {
    shingles(c, '#6a3434', '#4a2222', '#8a4a44', 67);
    r(c, 0, 0, T, 2, '#1a1212');
    r(c, 0, 2, T, 2, '#8a8a92');
    brickStrip(c);
    r(c, 2, 5, 12, 11, '#e0c070'); // Rahmen
    r(c, 3, 6, 10, 10, '#4a5a6a'); // Metalltür
    r(c, 3, 9, 10, 1, '#3a4a5a');
    r(c, 11, 11, 1, 2, '#f0d050'); // Griff
    r(c, 6, 4, 4, 1, '#f8e8a0'); // Lampe
  });

  // ---------------------------------------------------------------- Fassade der Kneipe
  make('facade', (c) => plaster(c, 71));
  make('facade2', (c) => plaster(c, 72));
  make('facadeWin', (c) => {
    plaster(c, 73);
    r(c, 2, 2, 12, 11, '#3a2414');
    r(c, 3, 3, 10, 9, '#e8b060');
    r(c, 3, 3, 10, 2, '#a85a3a'); // Gardine
    r(c, 8, 3, 1, 9, '#3a2414');
    for (let x = 4; x < 12; x += 2) r(c, x, 8, 1, 3, ['#3b7a3b', '#7a1a2a', '#c8a03a'][x % 3]); // Flaschen
    r(c, 1, 13, 14, 1, '#8a7a6a');
  });
  // Haupteingang: Messingrahmen, Holztür mit hellem Glas, Fußmatte – hebt sich klar ab
  make('barDoor', (c) => {
    plaster(c, 74);
    r(c, 1, 0, 14, 16, '#f0c040');
    r(c, 2, 1, 12, 15, '#2a1408');
    r(c, 3, 1, 10, 15, '#7a4220');
    r(c, 4, 2, 8, 6, '#f8d880'); // beleuchtetes Glas
    r(c, 8, 2, 1, 6, '#7a4220');
    r(c, 4, 10, 8, 1, '#5a2e14'); r(c, 4, 13, 8, 1, '#5a2e14');
    r(c, 11, 9, 1, 3, '#ffe060'); // Klinke
    p(c, 12, 10, '#ffe060');
  });

  // Schild über dem Eingang (Text in Pixel-Schrift)
  tex2x(scene, 'barSign', 92, 14, (c) => {
    r(c, 0, 0, 92, 14, '#2a1408');
    r(c, 1, 1, 90, 12, '#140a04');
    r(c, 0, 0, 92, 1, '#c8a050'); r(c, 0, 13, 92, 1, '#c8a050');
    c.font = '8px "Press Start 2P"';
    c.textBaseline = 'middle';
    c.textAlign = 'center';
    c.fillStyle = '#7a1a3a';
    c.fillText('GOLDENER EIMER', 47, 8.5);
    c.fillStyle = '#ff6ab4';
    c.fillText('GOLDENER EIMER', 46, 7.5);
  }, { rim: false, grain: 0 });

  // ---------------------------------------------------------------- Straßenmöbel
  tex2x(scene, 'lampPost', T, 44, (c) => {
    r(c, 7, 6, 2, 36, '#2a2a32');
    r(c, 7, 6, 1, 36, '#4a4a52');
    r(c, 5, 40, 6, 4, '#2a2a32');
    r(c, 4, 2, 8, 4, '#3a3a42');
    r(c, 5, 5, 6, 2, '#f8e8a0');
    outline(c, 0, 0, T, 44);
  });
  make('bench', (c) => {
    for (const y of [4, 7, 10]) { r(c, 1, y, 14, 2, '#8a5a30'); r(c, 1, y, 14, 1, '#a87040'); }
    r(c, 2, 12, 2, 3, '#2a2a30'); r(c, 12, 12, 2, 3, '#2a2a30');
    outline(c, 0, 0, T, T);
  });
  make('bags', (c) => {
    blob(c, 5, 10, 4.5, 4, '#1e1e22'); blob(c, 11, 11, 4, 3.5, '#26262c'); blob(c, 8, 6, 3.5, 3, '#2a3a6a');
    p(c, 4, 8, '#5a5a62'); p(c, 10, 9, '#5a5a62'); p(c, 7, 5, '#5a6a9a');
    r(c, 8, 3, 1, 2, '#1e1e22');
    outline(c, 0, 0, T, T);
  });
  tex2x(scene, 'car', 32, 22, (c) => {
    r(c, 2, 3, 28, 16, '#8a1e24');
    r(c, 1, 5, 30, 12, '#8a1e24');
    r(c, 9, 4, 13, 14, '#6a141a'); // Dach
    r(c, 7, 5, 3, 12, '#9ac0d8'); r(c, 22, 5, 3, 12, '#7aa0b8'); // Scheiben
    r(c, 1, 6, 1, 2, '#f8f0c0'); r(c, 1, 14, 1, 2, '#f8f0c0'); // Scheinwerfer
    r(c, 30, 6, 1, 2, '#e02020'); r(c, 30, 14, 1, 2, '#e02020');
    for (const [x, y] of [[5, 1], [23, 1], [5, 19], [23, 19]]) r(c, x, y, 5, 3, '#141414');
    r(c, 3, 4, 26, 1, '#b03036');
    outline(c, 0, 0, 32, 22);
  });

  // ---------------------------------------------------------------- Kneipe innen
  make('panelFront', (c) => panel(c, 81));
  make('panelTop', (c) => { r(c, 0, 0, T, T, '#1f1616'); speckle(c, ['#2a1e1e', '#181111'], 14, 82); });
  make('panelPoster', (c) => {
    panel(c, 83);
    r(c, 3, 1, 10, 11, '#e8dcb0'); r(c, 3, 1, 10, 11, '#e8dcb0');
    r(c, 4, 2, 8, 2, '#b02020'); // Titel
    r(c, 6, 5, 4, 5, '#d8a030'); r(c, 6, 5, 4, 1, '#ffffff'); r(c, 10, 6, 1, 3, '#d8a030'); // Bierkrug
    p(c, 12, 11, '#b8a880'); p(c, 3, 1, '#b8a880'); // Ecke eingerissen
  });
  make('panelClock', (c) => {
    panel(c, 84);
    blob(c, 8, 4, 3.6, 3.6, '#3a2a1a');
    blob(c, 8, 4, 2.8, 2.8, '#f0e8d0');
    r(c, 8, 2, 1, 3, '#1a1a1a'); r(c, 8, 4, 2, 1, '#1a1a1a');
  });
  make('panelDart', (c) => {
    panel(c, 85);
    blob(c, 8, 4, 3.8, 3.8, '#1a1a1a');
    blob(c, 8, 4, 3, 3, '#e8dcb0');
    blob(c, 8, 4, 2, 2, '#b02020');
    blob(c, 8, 4, 1, 1, '#2a8a3a');
    p(c, 9, 3, '#f0d040'); p(c, 6, 5, '#f0d040'); // Pfeile
  });
  make('panelTV', (c) => {
    panel(c, 86);
    r(c, 2, 1, 12, 7, '#1a1a1e');
    r(c, 3, 2, 10, 5, '#2a8a3a');
    r(c, 3, 4, 10, 1, '#e8e8e8'); p(c, 7, 3, '#ffffff'); p(c, 10, 5, '#e02020');
    r(c, 7, 8, 2, 1, '#3a3a3a');
  });
  make('panelNeon', (c) => {
    panel(c, 87);
    r(c, 3, 1, 10, 5, '#1a0a0a');
    r(c, 4, 2, 8, 1, '#ff5a40'); r(c, 4, 4, 8, 1, '#f0d040'); // „PILS“-Leuchtschrift
  });
  make('floorWorn', (c) => {
    r(c, 0, 0, T, T, '#6b4a2f');
    for (let y = 3; y < T; y += 4) r(c, 0, y, T, 1, '#4f3520');
    blob(c, 6, 9, 3.5, 2.2, '#5a3c24'); // Fleck
    blob(c, 11, 4, 1.4, 1, '#3a2a1a'); // Brandloch
  }, T, T, (c) => { grain(c, '#6b4a2f', 11); bevel(c, '#4f3520', 0.14); });
  make('tableB', (c) => {
    c.fillStyle = '#7a5032';
    c.beginPath();
    c.arc(8, 7, 6.5, 0, Math.PI * 2);
    c.fill();
    r(c, 6, 12, 4, 3, '#4a2e18');
    blob(c, 5, 6, 1.6, 1.6, '#e8dcb0'); // Bierdeckel
    r(c, 4, 4, 2, 3, '#5a2e0e'); p(c, 4, 3, '#d8b040'); // Flasche
    r(c, 9, 6, 2, 3, '#e8c060'); r(c, 9, 6, 2, 1, '#ffffff'); // Bierglas
    blob(c, 10, 10, 1.3, 1, '#8a8a8a'); p(c, 10, 10, '#d0d0d0'); // Aschenbecher
    outline(c, 0, 0, T, T);
  }, T, T, (c) => grain(c, '#7a5032', 13));
  make('coatRack', (c) => {
    r(c, 7, 2, 2, 13, '#4a2e18');
    r(c, 4, 14, 8, 2, '#3a2010');
    blob(c, 5, 6, 2.5, 4, '#3a4a6a'); blob(c, 11, 7, 2.5, 4.5, '#6a3a2a'); r(c, 6, 1, 4, 2, '#5a5a3a');
    outline(c, 0, 0, T, T);
  });
  make('bin', (c) => {
    r(c, 5, 6, 6, 8, '#5a5a62'); r(c, 4, 5, 8, 2, '#7a7a82');
    p(c, 6, 4, '#e8dcb0'); p(c, 9, 4, '#3b7a3b');
    outline(c, 0, 0, T, T);
  });
  make('plant', (c) => {
    r(c, 5, 10, 6, 5, '#8a4a2a'); r(c, 5, 10, 6, 1, '#a85a3a');
    blob(c, 8, 7, 4.5, 3.5, '#5a7a2a'); blob(c, 6, 5, 2, 2, '#7a8a3a'); blob(c, 10, 5, 2, 2, '#9a9a3a');
    p(c, 11, 8, '#b8a040'); // gelbes Blatt
    outline(c, 0, 0, T, T);
  });
  make('clutter', (c) => {
    r(c, 2, 9, 5, 2, '#3b7a3b'); p(c, 7, 10, '#2a5a2a'); // liegende Flasche
    r(c, 10, 4, 3, 3, '#f4f0e4'); p(c, 11, 5, '#c8c0b0'); // Serviette
    p(c, 12, 11, '#e8d0a0'); p(c, 13, 11, '#c87030'); p(c, 5, 4, '#e8d0a0'); // Kippen
  });
  // Ausgangstür innen: helles Holz, Schild „RAUS“-Pfeil
  make('doorBottom', (c) => {
    r(c, 0, 0, T, T, '#1f1616');
    r(c, 1, 0, 14, 16, '#f0c040');
    r(c, 2, 0, 12, 16, '#6a3a1a');
    r(c, 3, 3, 10, 9, '#8a5a30');
    r(c, 3, 12, 10, 3, '#3a6a3a'); r(c, 6, 13, 4, 1, '#e8e8e8'); p(c, 9, 12, '#e8e8e8'); p(c, 9, 14, '#e8e8e8'); // Notausgang-Schild
  });

  // ---------------------------------------------------------------- Toilette (bewusst schäbig)
  const tiles = (c: Ctx, base: string, line: string, seed: number) => {
    r(c, 0, 0, T, T, base);
    for (let i = 0; i < T; i += 4) { r(c, 0, i, T, 1, line); r(c, i, 0, 1, T, line); }
    speckle(c, ['#9a9070', '#b8b090', '#8a8060'], 16, seed);
  };
  make('wcFloor', (c) => tiles(c, '#c8c4b0', '#8a8878', 91));
  make('wcFloorDirty', (c) => {
    tiles(c, '#c8c4b0', '#8a8878', 90);
    blob(c, 10, 11, 3, 2, '#c8b860'); // verdächtige Pfütze
    r(c, 4, 4, 3, 3, '#6a6a5a'); // gesprungene Fliese
  });
  make('tileWallFront', (c) => {
    tiles(c, '#a8b8a4', '#6a7a68', 92);
    r(c, 0, 0, T, 1, '#1f1616');
    r(c, 9, 5, 3, 3, '#5a5a4a'); // fehlende Fliese
    p(c, 3, 9, '#5a5a4a'); p(c, 4, 10, '#5a5a4a'); p(c, 5, 11, '#5a5a4a'); // Riss
    r(c, 0, 13, T, 3, '#8a9480'); // Schmutzrand
  });
  make('tileWallTop', (c) => { r(c, 0, 0, T, T, '#1f1a1a'); speckle(c, ['#2a2424'], 12, 93); });
  make('sinkMirror', (c) => {
    tiles(c, '#a8b8a4', '#6a7a68', 94);
    r(c, 0, 0, T, 1, '#1f1616');
    r(c, 3, 1, 10, 6, '#5a5a5a'); r(c, 4, 2, 8, 4, '#8aa0aa'); // Spiegel
    p(c, 6, 3, '#c0d0d8'); r(c, 9, 2, 1, 4, '#5a6a70'); p(c, 5, 5, '#6a7a70'); // Sprung, Schliere
    r(c, 3, 10, 10, 3, '#e8e8e0'); r(c, 4, 11, 8, 1, '#a8a8a0'); // Becken
    r(c, 7, 8, 2, 2, '#9a9aa0'); // Hahn
    r(c, 7, 13, 2, 3, '#6a5040'); // rostiges Rohr
    r(c, 13, 6, 2, 3, '#e8e8e8'); p(c, 13, 9, '#c8c8c8'); // schiefer Seifenspender
  });
  make('urinal', (c) => {
    tiles(c, '#a8b8a4', '#6a7a68', 95);
    r(c, 0, 0, T, 1, '#1f1616');
    r(c, 5, 4, 6, 9, '#ecece4'); r(c, 6, 6, 4, 6, '#c8c8b8');
    r(c, 7, 1, 2, 3, '#8a8a90'); p(c, 7, 11, '#c8b060');
  });
  make('stallWall', (c) => { tiles(c, '#c8c4b0', '#8a8878', 96); r(c, 6, 0, 4, T, '#7a8070'); r(c, 6, 0, 1, T, '#9aa090'); });
  make('wcBowl', (c) => {
    tiles(c, '#c8c4b0', '#8a8878', 97);
    r(c, 0, 0, 1, T, '#7a8070'); r(c, 15, 0, 1, T, '#7a8070'); // Kabinenwände
    r(c, 4, 1, 8, 4, '#ecece4'); // Spülkasten
    blob(c, 8, 9, 4, 4.5, '#ecece4');
    blob(c, 8, 9.5, 2.5, 3, '#9ab0b8');
    p(c, 8, 9, '#b8a060');
    r(c, 13, 6, 2, 3, '#5a5a5a'); // leerer Papierhalter
  });
  const stallDoor = (c: Ctx, sign: string, letter: number[][]) => {
    tiles(c, '#c8c4b0', '#8a8878', 98);
    // schief hängende Tür
    for (let y = 2; y < 15; y++) r(c, 1 + Math.floor((y - 2) / 6), y, 13, 1, '#6a8a6a');
    r(c, 1, 2, 13, 1, '#8aaa8a');
    r(c, 10, 8, 2, 1, '#c8c8c8');
    r(c, 5, 4, 5, 5, sign);
    for (const [x, y] of letter) p(c, 6 + x, 5 + y, '#ffffff');
  };
  make('stallDoorH', (c) => stallDoor(c, '#2a3a6a', [[0, 0], [0, 1], [0, 2], [1, 1], [2, 0], [2, 1], [2, 2]])); // H
  make('stallDoorD', (c) => stallDoor(c, '#8a2a4a', [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 1]])); // D
  // Durchgang zur Toilette: heller Rahmen, Schild „WC“
  make('wcDoor', (c) => {
    r(c, 0, 0, T, T, '#c8c4b0');
    r(c, 0, 0, 2, T, '#e0b060'); r(c, 14, 0, 2, T, '#e0b060');
    r(c, 2, 0, 12, 2, '#e0b060');
    r(c, 3, 4, 10, 5, '#2a6aa0');
    for (const [x, y] of [[0, 0], [0, 1], [1, 2], [2, 1], [3, 2], [4, 1], [4, 0], [6, 0], [7, 0], [6, 1], [6, 2], [7, 2]]) p(c, 4 + x, 5 + y, '#ffffff'); // „WC“
    r(c, 12, 4, 2, 10, '#6a4a2a'); // offenes Türblatt
  });
  make('exitDoor', (c) => {
    tiles(c, '#a8b8a4', '#6a7a68', 99);
    r(c, 0, 0, T, 1, '#1f1616');
    r(c, 2, 2, 12, 14, '#e0c070');
    r(c, 3, 3, 10, 13, '#4a5a4a');
    r(c, 3, 7, 10, 1, '#3a4a3a');
    r(c, 11, 10, 1, 2, '#f0d050');
    r(c, 4, 4, 8, 2, '#2a9a4a'); r(c, 5, 4, 3, 1, '#ffffff'); p(c, 9, 5, '#ffffff'); // grünes Notausgang-Schild
  });
}
