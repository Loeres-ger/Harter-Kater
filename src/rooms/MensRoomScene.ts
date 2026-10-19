import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { T, TileInfo, TopDown } from '../scenes/TopDown';
import { unlock } from '../progress/achievements';
import { BAR_HERREN_SPAWN } from './spawns';

// Herrentoilette: Waschbecken, Pissoirs, zwei Kabinen. Kabine 1 ist abgeschlossen (darin: Kurdischer Kevin),
// Kabine 2 ist frei. Wer Kabine 2 benutzt, löst einmalig Kevins Auftritt aus.
//  k Waschbecken  u Pissoir  j Fliesenwand  q WC  l Kabinenwand  z Kabinenboden
//  X verschlossene Kabine  Y freie Kabine  D Tür zur Kneipe  e Pflanze
const MAP = [
  '#############',
  '#kkjuuujjqlq#',
  '#.......jzlz#',
  '#.......jXlY#',
  '#...........#',
  '#...........#',
  '#e..........#',
  '######D######',
];

/** wo Kevin nach seinem Auftritt steht (Kachel) */
const KEVIN_TILE: [number, number] = [6, 4];

export class MensRoomScene extends TopDown {
  private kevin?: Phaser.GameObjects.Sprite;

  constructor() {
    super('HerrenWC');
  }

  init() {
    super.init();
    this.kevin = undefined;
  }

  protected mapRows() { return MAP; }
  protected isWall(ch: string) { return '#kjuD'.includes(ch); }
  protected darkness() { return 0.28; }
  protected floorKey(x: number, y: number) { return (x * 3 + y * 5) % 11 === 0 ? 'wcFloorDirty' : 'wcFloor'; }

  protected tileFor(ch: string): TileInfo {
    switch (ch) {
      case '#': case 'j': return { key: 'tileWallFront', solid: true };
      case 'k': return { key: 'sinkMirror', solid: true };
      case 'u': return { key: 'urinal', solid: true };
      case 'D': return { key: 'wcExit', solid: true };
      case 'q': return { key: 'wcBowl', solid: true };
      case 'l': return { key: 'stallWall', solid: true };
      case 'z': return { key: '', solid: true };
      case 'X': return { key: 'stallDoorLocked', solid: true };
      case 'Y': return { key: 'stallDoorFree', solid: true };
      case 'e': return { key: 'plant', solid: true, object: true };
      default: return { key: '', solid: false };
    }
  }

  protected goalText() {
    return state.flags.kevinAuftritt ? 'Kevin dehnt sich vor dem Spiegel.' : 'Herrentoilette. Kabine 1 ist besetzt. Seit Stunden.';
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
    this.interacts.push({ x: dx * T + 8, y: dy * T, r: 18, label: () => 'Zurück in die Kneipe', act: () => this.go('Bar', { spawn: BAR_HERREN_SPAWN }) });

    // flackernde Neonröhre
    const lamp = this.addLight(6 * T, 3 * T, 1.1, 0.55).setTint(0xd0f0d0);
    this.tweens.killTweensOf(lamp);
    this.time.addEvent({ delay: 120, loop: true, callback: () => lamp.setAlpha(Math.random() < 0.1 ? 0.08 : 0.45 + Math.random() * 0.12) });

    const [xx, xy] = this.find('X');
    this.interacts.push({
      x: xx * T + 8, y: (xy + 1) * T + 4, r: 14,
      label: () => 'Kabine 1',
      act: () => this.toast(state.flags.kevinAuftritt
        ? 'Wieder abgeschlossen. Wie? Keine Ahnung. Es riecht nach Kokosöl.'
        : Phaser.Utils.Array.GetRandom(['Abgeschlossen. Von drinnen: tiefes, zufriedenes Atmen.', 'Abgeschlossen. Unter der Tür: zwei riesige Badelatschen.', 'Abgeschlossen. Jemand summt da drin sehr selbstbewusst.'])),
    });
    const [yx, yy] = this.find('Y');
    this.interacts.push({
      x: yx * T + 8, y: (yy + 1) * T + 4, r: 14,
      label: () => 'Kabine 2 benutzen',
      act: () => this.useStall(),
    });
    for (const [ch, label, text] of [
      ['k', 'Waschbecken', 'Im Spiegel: ein Wirt, der dringend Urlaub braucht.'],
      ['u', 'Pissoir', 'Jemand hat einen Kaugummi reingeklebt. Mit Absicht.'],
    ] as const) {
      const [x, y] = this.find(ch);
      this.interacts.push({ x: x * T + 8, y: (y + 1) * T + 6, r: 12, label: () => label, act: () => this.toast(text) });
    }

    if (state.flags.kevinAuftritt) this.placeKevin(KEVIN_TILE[0] * T + 8, KEVIN_TILE[1] * T + 14);
  }

  /** Kabine 2: Seitenansicht als Zwischensequenz. Beim ersten Mal meldet sich der Nachbar. */
  private useStall() {
    if (state.flags.kevinAuftritt) {
      this.toast(Phaser.Utils.Array.GetRandom(['Fünf Minuten Ruhe. Von nebenan: Kevin summt.', 'Kein Papier. Immer noch nicht.']));
      return;
    }
    if (this.leaving) return;
    this.scene.launch('Cutscene', { script: 'kabine', resume: 'HerrenWC', music: 'bar', onDone: () => this.kevinEntrance() });
    this.scene.bringToTop('Cutscene');
    this.scene.pause();
  }

  /** Kevins großer Auftritt aus Kabine 1. Läuft nur einmal (Story-Flag kevinAuftritt). */
  private kevinEntrance() {
    if (state.flags.kevinAuftritt) return;
    state.flags.kevinAuftritt = true;
    this.leaving = true; // Wirt erstarrt
    const [xx, xy] = this.find('X');
    const door = this.add.image(xx * T, xy * T, 'stallDoorOpen').setOrigin(0).setScale(0.5).setDepth(xy * T + T + 1);
    this.cameras.main.shake(250, 0.01);
    audio.sfx('clang');
    const k = this.add.sprite(xx * T + 8, xy * T + 14, 'kevin', 0).setOrigin(0.5, 1).setScale(0.5).setAlpha(0).setDepth(xy * T + 16);
    this.tweens.add({ targets: k, alpha: 1, duration: 300 });
    // Rot, Weiß, Grün blitzen auf, dann stolziert er heraus
    const flashes: [number, number, number][] = [[255, 60, 60], [255, 255, 255], [60, 200, 90]];
    flashes.forEach(([r, g, b], i) => this.time.delayedCall(300 + i * 220, () => this.cameras.main.flash(160, r, g, b)));
    this.time.delayedCall(1000, () => {
      audio.sfx('sting');
      this.tweens.add({
        targets: k, x: KEVIN_TILE[0] * T + 8, y: KEVIN_TILE[1] * T + 14, duration: 1300, ease: 'Sine.easeInOut',
        onUpdate: () => k.setDepth(k.y),
        onComplete: () => {
          door.destroy();
          k.setFrame(1);
          this.cameras.main.shake(200, 0.008);
          const bam = this.add.text(k.x, k.y - 34, 'TADAAA!', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#f8e070' }).setOrigin(0.5).setDepth(6001).setStroke('#000', 3);
          this.tweens.add({ targets: bam, y: bam.y - 8, alpha: 0, delay: 700, duration: 600, onComplete: () => bam.destroy() });
          unlock('bruderEntspann');
          this.time.delayedCall(900, () => {
            k.destroy();
            this.placeKevin(KEVIN_TILE[0] * T + 8, KEVIN_TILE[1] * T + 14);
            this.leaving = false;
            this.talk('kevin');
          });
        },
      });
      // schwerer, stolzer Gang
      this.tweens.add({ targets: k, angle: { from: -4, to: 4 }, duration: 220, yoyo: true, repeat: 2 });
    });
  }

  /** Kevin steht vor dem Spiegel und posiert ab und zu. */
  private placeKevin(x: number, y: number) {
    const k = this.add.sprite(x, y, 'kevin', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    this.add.image(x, y - 1, 'shadow').setDepth(1).setScale(1.3, 0.9);
    this.kevin = k;
    this.tweens.add({ targets: k, scaleY: 0.51, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({
      delay: 2800, loop: true,
      callback: () => {
        if (!k.active) return;
        k.setFrame(1);
        this.time.delayedCall(1000, () => k.active && k.setFrame(0));
      },
    });
    this.interacts.push({ x, y: y - 4, r: 20, label: () => (k.active ? 'Mit Kevin reden' : null), act: () => this.talk('kevin') });
  }
}
