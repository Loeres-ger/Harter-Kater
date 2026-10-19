import Phaser from 'phaser';
import { audio } from '../audio';
import { AchievementDef, achievementEvents } from '../progress/achievements';
import { W, txt } from '../ui';

/** Läuft dauerhaft über allem und blendet neu freigeschaltete Achievements kurz oben ein. */
export class NotifyScene extends Phaser.Scene {
  private queue: AchievementDef[] = [];
  private showing = false;

  constructor() {
    super('Notify');
  }

  create() {
    this.queue = [];
    this.showing = false;
    achievementEvents.on('unlocked', this.enqueue, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => achievementEvents.off('unlocked', this.enqueue, this));
  }

  private enqueue(def: AchievementDef) {
    this.queue.push(def);
    if (!this.showing) this.next();
  }

  private next() {
    const def = this.queue.shift();
    if (!def) {
      this.showing = false;
      return;
    }
    this.showing = true;
    this.scene.bringToTop();
    audio.sfx('chime');
    const BW = Math.max(256, def.name.length * 8 + 52), BH = 30;
    const bg = this.add.rectangle(0, 0, BW, BH, 0x1a1210, 0.94).setStrokeStyle(2, 0xc9a24a);
    const icon = this.add.image(-BW / 2 + 18, 0, def.icon).setScale(1);
    const head = txt(this, -BW / 2 + 34, -11, 'ACHIEVEMENT FREIGESCHALTET', '#c9a24a');
    const name = txt(this, -BW / 2 + 34, 1, def.name, '#f4ead0');
    const box = this.add.container(W / 2, -24, [bg, icon, head, name]).setDepth(10);
    this.tweens.add({ targets: icon, angle: { from: -12, to: 12 }, duration: 260, yoyo: true, repeat: 3 });
    this.tweens.add({
      targets: box, y: 36, duration: 300, ease: 'Back.easeOut',
      onComplete: () => this.tweens.add({
        targets: box, y: -24, delay: 2600, duration: 250, ease: 'Quad.easeIn',
        onComplete: () => { box.destroy(); this.next(); },
      }),
    });
  }
}
