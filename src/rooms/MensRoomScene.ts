import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { T, TileInfo, TopDown } from '../scenes/TopDown';
import { hud } from '../scenes/HudScene';
import { unlock } from '../progress/achievements';
import { BAR_HERREN_SPAWN } from './spawns';

// Herrentoilette: Waschbecken, Pissoirs, zwei Kabinen. Kabine 1 ist abgeschlossen (darin: Kurdischer Kevin),
// Kabine 2 ist frei und hat ein Loch in der Trennwand (StallScene). Wer dagegen klopft und die Kabine
// danach verlässt, sieht einmalig Kevin herauskommen und panisch aus der Kneipe flüchten.
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

/** wo Kevin nach dem Herauskommen stehen bleibt und wo danach sein Badelatschen liegt (Kachel) */
const KEVIN_STOP: [number, number] = [9, 4];

export class MensRoomScene extends TopDown {
  constructor() {
    super('HerrenWC');
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
    return state.flags.kevinFlucht ? 'Herrentoilette. Kabine 1 steht offen. Leer.' : 'Herrentoilette. Kabine 1 ist besetzt. Seit Stunden.';
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
    if (state.flags.kevinFlucht) this.add.image(xx * T, xy * T, 'stallDoorOpen').setOrigin(0).setScale(0.5).setDepth(xy * T + T + 1);
    this.interacts.push({
      x: xx * T + 8, y: (xy + 1) * T + 4, r: 14,
      label: () => 'Kabine 1',
      act: () => this.toast(state.flags.kevinFlucht
        ? 'Leer. Es riecht nach Kokosöl und Panik.'
        : Phaser.Utils.Array.GetRandom(['Abgeschlossen. Von drinnen: tiefes, zufriedenes Atmen.', 'Abgeschlossen. Unter der Tür: zwei riesige Badelatschen.', 'Abgeschlossen. Jemand summt da drin sehr selbstbewusst.'])),
    });
    const [yx, yy] = this.find('Y');
    this.interacts.push({
      x: yx * T + 8, y: (yy + 1) * T + 4, r: 14,
      label: () => 'Kabine 2 betreten',
      act: () => this.enterStall(),
    });
    for (const [ch, label, text] of [
      ['k', 'Waschbecken', 'Im Spiegel: ein Wirt, der dringend Urlaub braucht.'],
      ['u', 'Pissoir', 'Jemand hat einen Kaugummi reingeklebt. Mit Absicht.'],
    ] as const) {
      const [x, y] = this.find(ch);
      this.interacts.push({ x: x * T + 8, y: (y + 1) * T + 6, r: 12, label: () => label, act: () => this.toast(text) });
    }
    if (state.flags.kevinFlucht) this.addSlipper();
  }

  /** Kabine 2 in Seitenansicht. Kevins Flucht startet erst beim Verlassen und nur, wenn das Loch angetippt wurde. */
  private enterStall() {
    if (this.leaving) return;
    if (state.flags.kevinFlucht) {
      this.toast('Jemand hat das Loch in der Wand mit Kaugummi zugeklebt. Gut so.');
      return;
    }
    hud.prompt = '';
    this.scene.launch('Kabine', {
      resume: 'HerrenWC',
      onLeave: () => { if (state.flags.kevinLoch && !state.flags.kevinFlucht) this.kevinFlees(); },
    });
    this.scene.bringToTop('Kabine');
    this.scene.pause();
  }

  /** Einmalig: Kabine 1 geht auf, Kevin starrt den Wirt wortlos an und rennt panisch aus der Kneipe. */
  private kevinFlees() {
    state.flags.kevinFlucht = true;
    this.leaving = true; // Wirt erstarrt, keine weiteren Interaktionen
    hud.prompt = '';
    const cam = this.cameras.main;
    cam.zoomTo(2.6, 500, 'Sine.easeInOut');

    const [xx, xy] = this.find('X');
    const [dx, dy] = this.find('D');
    const door = this.add.image(xx * T, xy * T, 'stallDoorOpen').setOrigin(0).setScale(0.5).setDepth(xy * T + T + 1).setAlpha(0);
    const k = this.add.sprite(xx * T + 8, xy * T + 14, 'kevin', 0).setOrigin(0.5, 1).setScale(0.5).setAlpha(0).setDepth(xy * T + 16);
    const bubble = (who: Phaser.GameObjects.Sprite, s: string, color = '#ffffff') => {
      const b = this.add.text(who.x, who.y - 32, s, { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color }).setOrigin(0.5).setDepth(6001).setStroke('#000', 3);
      this.tweens.add({ targets: b, y: b.y - 4, duration: 300, ease: 'Back.easeOut' });
      return b;
    };

    // Tür auf, Kevin tritt heraus und bleibt stehen
    this.time.delayedCall(500, () => {
      audio.sfx('clang');
      door.setAlpha(1);
      this.tweens.add({ targets: k, alpha: 1, duration: 200 });
      this.tweens.add({
        targets: k, x: KEVIN_STOP[0] * T + 8, y: KEVIN_STOP[1] * T + 14, duration: 600, delay: 250, ease: 'Sine.easeOut',
        onUpdate: () => k.setDepth(k.y),
      });
    });
    // Blickkontakt. Wortlos.
    const dots: Phaser.GameObjects.Text[] = [];
    this.time.delayedCall(1500, () => dots.push(bubble(k, '...')));
    this.time.delayedCall(2300, () => dots.push(bubble(this.player, '...')));
    // Panik
    this.time.delayedCall(4200, () => {
      dots.forEach((d) => d.destroy());
      const bang = bubble(k, '!!!', '#ff4040');
      audio.sfx('scream');
      cam.shake(200, 0.01);
      const sweat = this.add.particles(0, 0, 'sweat', {
        follow: k, followOffset: { x: 0, y: -18 }, lifespan: 500, speedX: { min: -40, max: 40 }, speedY: { min: -50, max: -20 },
        gravityY: 200, scale: { start: 0.6, end: 0.2 }, frequency: 60,
      }).setDepth(6000);
      this.time.delayedCall(400, () => bang.destroy());
      // erst zur Raummitte, dann durch die Tür hinaus
      this.tweens.add({ targets: k, angle: { from: -10, to: 10 }, duration: 80, yoyo: true, repeat: -1 });
      this.tweens.chain({
        targets: k,
        tweens: [
          { x: dx * T + 8, y: (dy - 1) * T + 14, duration: 450, ease: 'Quad.easeIn', delay: 300, onUpdate: () => k.setDepth(k.y) },
          { y: dy * T + 20, alpha: 0, duration: 200 },
        ],
        onComplete: () => {
          k.destroy();
          sweat.destroy();
          audio.sfx('thud');
          cam.shake(250, 0.012);
          this.addSlipper();
          this.time.delayedCall(900, () => {
            this.toast('Draußen knallen Türen. Dann ist es still. Kevin ist weg.');
            unlock('bruderEntspann');
            cam.zoomTo(2, 500, 'Sine.easeInOut');
            this.leaving = false;
          });
        },
      });
    });
  }

  /** Was von Kevin bleibt: ein einzelner Badelatschen. */
  private addSlipper() {
    const x = KEVIN_STOP[0] * T + 4, y = KEVIN_STOP[1] * T + 12;
    this.add.rectangle(x, y, 5, 3, 0x2a2a6a).setDepth(y);
    this.interacts.push({ x, y, r: 12, label: () => 'Badelatschen', act: () => this.toast('Ein einzelner Badelatschen. Größe 49.') });
  }
}
