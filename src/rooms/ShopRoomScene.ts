import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { T, TileInfo, TopDown } from '../scenes/TopDown';
import { hud } from '../scenes/HudScene';
import { unlock } from '../progress/achievements';
import type { DialogAction } from '../dialog/data';
import { ALLEY_LADEN_SPAWN } from './spawns';

// „Mayas Feinkost“: kleiner, altmodischer Wurst- und Käseladen im Haus rechts neben der Kneipe.
// Hinter der Theke steht Meisternutte Maya. Bei ihr gibt es dasselbe Bier wie an der Kneipentheke.
//  R Regal  K Kühlschrank  U Kuckucksuhr  B Rautenfahne mit Brezel  G Geweih
//  T Wursttheke  C Käse und Waage  b Bierkisten  s Regal  p Pflanze  D Tür
const MAP = [
  '##############',
  '#RRKKRRUBBRRG#',
  '#............#',
  '#TTTTCCTTTTTT#',
  '#............#',
  '#s...b..b...s#',
  '#s..........p#',
  '######D#######',
];

/** Mayas Platz hinter der Theke (Kachel) */
const MAYA_TILE: [number, number] = [6, 2];

export class ShopRoomScene extends TopDown {
  constructor() {
    super('Laden');
  }

  protected mapRows() { return MAP; }
  protected isWall(ch: string) { return '#RKUBGD'.includes(ch); }
  protected darkness() { return 0.12; }
  protected floorKey() { return 'ladenFloor'; }

  protected tileFor(ch: string): TileInfo {
    switch (ch) {
      case '#': return { key: 'ladenWallFront', solid: true };
      case 'R': return { key: 'ladenShelf', solid: true };
      case 'K': return { key: 'ladenFridge', solid: true };
      case 'U': return { key: 'ladenClock', solid: true };
      case 'B': return { key: 'ladenFlag', solid: true };
      case 'G': return { key: 'ladenAntlers', solid: true };
      case 'D': return { key: 'ladenDoor', solid: true };
      case 'T': return { key: 'ladenCounter', solid: true, object: true };
      case 'C': return { key: 'ladenCheese', solid: true, object: true };
      case 'b': return { key: 'ladenCrates', solid: true, object: true };
      case 's': return { key: 'ladenStand', solid: true, object: true };
      case 'p': return { key: 'plant', solid: true, object: true };
      default: return { key: '', solid: false };
    }
  }

  protected goalText() {
    return 'Mayas Feinkost. Wurst, Käse, Bier. Und angeblich mehr.';
  }

  private find(ch: string): [number, number] {
    for (let y = 0; y < this.rows.length; y++) {
      const x = this.rows[y].indexOf(ch);
      if (x >= 0) return [x, y];
    }
    return [1, 1];
  }

  protected setupWorld() {
    audio.music('bar');
    const [dx, dy] = this.find('D');
    this.interacts.push({ x: dx * T + 8, y: dy * T, r: 18, label: () => 'Laden verlassen', act: () => this.go('Alley', { spawn: ALLEY_LADEN_SPAWN }) });
    // warmes Licht über Theke und Regalen
    for (const [x, y] of [[4, 3], [9, 3], [3, 5], [10, 5]]) this.addLight(x * T, y * T, 1, 0.55).setTint(0xffe0a0);

    for (const [ch, label, text] of [
      ['K', 'Kühlschrank', 'Bier. Nur Bier. Und ein einsamer Joghurt von 2017.'],
      ['U', 'Kuckucksuhr', 'Der Kuckuck kommt raus, sieht dich und geht wieder rein.'],
      ['G', 'Geweih', 'Auf dem Schild: „Erlegt von Maya. Mit bloßen Händen.“'],
      ['C', 'Käsetheke', 'Bergkäse, Butterkäse, Harzer. Der Harzer riecht nach Kalle.'],
    ] as const) {
      const [x, y] = this.find(ch);
      const below = 'KUG'.includes(ch) ? 1 : 0;
      this.interacts.push({ x: x * T + 8, y: (y + below) * T + 10, r: 14, label: () => label, act: () => this.toast(text) });
    }
    this.addMaya();
  }

  /** Maya hinter der Theke: wiegt sich, poliert ab und zu den Tresen. */
  private addMaya() {
    const [mx, my] = MAYA_TILE;
    const x = mx * T + 8, y = my * T + 14;
    const maya = this.add.sprite(x, y, 'maya', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    this.tweens.add({ targets: maya, angle: { from: -2, to: 2 }, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({ delay: 4200, loop: true, callback: () => maya.active && maya.play('maya_wipe') });
    // von der Kundenseite der Theke aus ansprechbar
    this.interacts.push({ x, y: y + 18, r: 26, label: () => 'Mit Maya reden', act: () => this.talk('maya', (a) => this.mayaDone(a)) });
  }

  private mayaDone(a?: DialogAction) {
    if (a === 'shop') {
      audio.sfx('click');
      this.scene.launch('Shop', { shop: 'laden', resume: 'Laden' });
      this.scene.bringToTop('Shop');
      this.scene.pause();
    } else if (a === 'mayaTraum' && !state.flags.mayaTraum) {
      // einmalig; das Achievement gibt es erst nach der Szene
      state.flags.mayaTraum = true;
      hud.prompt = '';
      this.scene.launch('Cutscene', { script: 'deutscherTraum', resume: 'Laden', music: 'bar', onDone: () => unlock('deutscherTraum') });
      this.scene.bringToTop('Cutscene');
      this.scene.pause();
    }
  }
}
