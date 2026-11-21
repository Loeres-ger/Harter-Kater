import Phaser from 'phaser';
import { Ctx, blob, p, r, rng, tex, tex2x } from '../gfx';
import { makeKellerTextures } from './kellerGfx';
import { makeDaemonTextures } from './daemonGfx';

// Grafiken für den Nick-Strang „Bornas Business“: Pflanze, Plantage, Kellertreppe, Inventar-Symbole.
// Kacheln und Objekte in doppelter Auflösung (tex2x, Anzeige mit Skalierung 0.5) wie im restlichen Spiel.

/** Hanfblatt: fünf bis sieben schmale Finger, die aus einem Punkt fächern */
export function leaf(c: Ctx, x: number, y: number, s: number, col: string, col2: string, fingers = 5) {
  const angles = fingers === 7 ? [-90, -55, -125, -25, -155, 5, -185] : [-90, -50, -130, -15, -165];
  angles.forEach((a, i) => {
    const len = s * (i === 0 ? 1 : i < 3 ? 0.85 : i < 5 ? 0.62 : 0.45);
    const rad = (a * Math.PI) / 180;
    for (let k = 1; k <= len; k++) {
      const px = Math.round(x + Math.cos(rad) * k), py = Math.round(y + Math.sin(rad) * k);
      p(c, px, py, k < len * 0.6 ? col : col2);
      // Finger in der Mitte etwas breiter
      if (k > 1 && k < len - 1 && len > 3) p(c, px + (Math.abs(Math.cos(rad)) < 0.5 ? 1 : 0), py + (Math.abs(Math.cos(rad)) >= 0.5 ? 1 : 0), col2);
    }
  });
}

/** Tontopf mit Erde */
function topf(c: Ctx, x: number, y: number, w: number, h: number) {
  r(c, x, y, w, 2, '#c86a3a');
  r(c, x + 1, y + 2, w - 2, h - 2, '#a8522a');
  r(c, x + 1, y + 2, 1, h - 2, '#c86a3a');
  r(c, x + w - 2, y + 2, 1, h - 2, '#7a3a1c');
  r(c, x + 1, y, w - 2, 1, '#3a2414');
}

export function makeNickTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('nickPflanze')) return;
  const make = (key: string, w: number, h: number, draw: (c: Ctx) => void) => tex2x(scene, key, w, h, draw);

  // ---------------------------------------------------------------- Inventar
  make('icon_pflanze', 16, 16, (c) => {
    topf(c, 4, 10, 8, 6);
    r(c, 7, 6, 2, 5, '#3a6a2a');
    leaf(c, 8, 7, 6, '#4a9a3a', '#2e6a24');
    leaf(c, 5, 9, 3, '#5aaa48', '#3a7a2a');
    leaf(c, 11, 9, 3, '#5aaa48', '#3a7a2a');
    p(c, 8, 10, '#8a5a30'); p(c, 6, 10, '#6a3e20');
  });
  make('icon_koks', 16, 16, (c) => {
    // kleines Zip-Tütchen mit weißem Pulver
    r(c, 3, 3, 10, 11, '#d8e0e8'); r(c, 3, 3, 10, 2, '#e04040'); r(c, 3, 5, 10, 1, '#b8c0c8');
    r(c, 4, 7, 8, 6, '#f8f8f8'); r(c, 5, 8, 3, 2, '#ffffff'); r(c, 9, 10, 2, 2, '#e8e8f0');
    r(c, 12, 4, 1, 10, '#a8b0b8'); r(c, 3, 13, 10, 1, '#a8b0b8');
    p(c, 6, 11, '#d8d8e0'); p(c, 10, 8, '#ffffff');
  });

  // ---------------------------------------------------------------- Dachboden
  // einzelne junge Pflanze im Topf neben der Matratze
  make('nickTopf', 16, 18, (c) => {
    topf(c, 4, 12, 8, 6);
    r(c, 7, 4, 2, 9, '#3a6a2a');
    leaf(c, 8, 5, 5, '#4a9a3a', '#2e6a24');
    leaf(c, 6, 8, 4, '#5aaa48', '#3a7a2a');
    leaf(c, 10, 9, 4, '#5aaa48', '#3a7a2a');
  });
  // ausgewachsene Pflanze der Plantage (zwei Varianten)
  for (const [key, seed] of [['nickPflanze', 3], ['nickPflanze2', 9]] as const) {
    make(key, 16, 28, (c) => {
      const rnd = rng(seed);
      topf(c, 3, 21, 10, 7);
      r(c, 7, 4, 2, 18, '#2e5a22'); r(c, 7, 4, 1, 18, '#3e7a2e');
      for (let i = 0; i < 6; i++) {
        const y = 5 + i * 3, side = i % 2 ? 1 : -1;
        leaf(c, 8 + side * (2 + Math.floor(rnd() * 2)), y + 2, 4 + Math.floor(rnd() * 2), '#4a9a3a', '#2e6a24');
      }
      leaf(c, 8, 4, 5, '#5ab048', '#3a7a2a', 7);
      // Blüten
      for (let i = 0; i < 5; i++) p(c, 5 + Math.floor(rnd() * 7), 3 + Math.floor(rnd() * 14), '#c8d070');
    });
  }
  // Pflanzenlampe: Balken mit lila LEDs an zwei Ketten
  make('nickLampe', 40, 10, (c) => {
    r(c, 4, 0, 1, 5, '#5a5a62'); r(c, 35, 0, 1, 5, '#5a5a62');
    r(c, 1, 5, 38, 3, '#2a2a30'); r(c, 1, 5, 38, 1, '#4a4a54');
    for (let x = 3; x < 38; x += 3) { p(c, x, 8, '#e070ff'); p(c, x + 1, 8, '#ff60c0'); }
  });
  // Bornas Kisten ohne Boden darunter: werden weggeschoben
  make('nickKiste', 16, 16, (c) => {
    r(c, 1, 4, 9, 10, '#b08a50'); r(c, 1, 4, 9, 2, '#c8a060'); r(c, 3, 8, 5, 2, '#f0e8d0');
    r(c, 8, 1, 7, 7, '#a07a44'); r(c, 8, 1, 7, 1, '#c09050'); r(c, 8, 8, 7, 6, '#8a6234'); r(c, 1, 14, 14, 1, 'rgba(0,0,0,0.35)');
  });
  // Treppe nach unten hinter Bornas Kisten: dunkles Loch, Stufen, ganz unten rotes Glimmen
  make('kellerTreppe', 16, 16, (c) => {
    r(c, 0, 0, 16, 16, '#3a2a1c');
    r(c, 1, 1, 14, 14, '#0c0608');
    const steps: [number, string][] = [[2, '#6a4a30'], [5, '#4a3222'], [8, '#32221a'], [11, '#221612']];
    for (const [y, col] of steps) { r(c, 2, y, 12, 2, col); r(c, 2, y + 2, 12, 1, '#080406'); }
    r(c, 3, 13, 10, 2, '#5a0a0a'); r(c, 5, 14, 6, 1, '#a01818');
    r(c, 0, 0, 1, 16, '#5a4230'); r(c, 15, 0, 1, 16, '#2a1c12');
  });

  // ---------------------------------------------------------------- Hintergasse
  make('erdloch', 16, 8, (c) => {
    blob(c, 8, 4, 6.5, 3.2, '#3a2a1c');
    blob(c, 8, 4, 4, 1.8, '#1a120c');
    for (const [x, y] of [[2, 5], [13, 3], [4, 2], [11, 6]]) p(c, x, y, '#5a4230');
  });
  tex(scene, 'krume', 2, 2, (c) => r(c, 0, 0, 2, 2, '#5a3e24'));
  makeKellerTextures(scene);
  makeDaemonTextures(scene);
}
