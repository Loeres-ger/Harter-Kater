import Phaser from 'phaser';
import { audio } from '../audio';
import { AchievementDef, achievementEvents } from '../progress/achievements';
import { ChapterDef, saveEvents } from '../progress/save';
import { H, W, txt } from '../ui';

/** Läuft dauerhaft über allem: blendet neu freigeschaltete Achievements oben und Speichermeldungen unten rechts ein. */
export class NotifyScene extends Phaser.Scene {
  private queue: AchievementDef[] = [];
  private showing = false;
  private saveBox?: Phaser.GameObjects.Container;

  constructor() {
    super('Notify');
  }

  create() {
    this.queue = [];
    this.showing = false;
    this.saveBox = undefined;
    achievementEvents.on('unlocked', this.enqueue, this);
    saveEvents.on('saved', this.onSaved, this);
    saveEvents.on('failed', this.onFailed, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      achievementEvents.off('unlocked', this.enqueue, this);
      saveEvents.off('saved', this.onSaved, this);
      saveEvents.off('failed', this.onFailed, this);
    });
  }

  private onSaved(def: ChapterDef) {
    this.saveNote(`GESPEICHERT: ${def.title}`, '#9ae09a');
  }

  private onFailed() {
    this.saveNote('SPEICHERN NICHT MÖGLICH', '#ff8a6a');
  }

  /** Kurze Meldung unten rechts, z. B. nach dem automatischen Speichern an einer Kapitel-Einblendung. */
  private saveNote(text: string, color: string) {
    this.saveBox?.destroy();
    this.scene.bringToTop();
    const w = text.length * 8 + 24;
    const bg = this.add.rectangle(0, 0, w, 16, 0x120c0b, 0.9).setStrokeStyle(1, 0x8a6a3a).setOrigin(1, 0.5);
    const disk = this.add.rectangle(-w + 9, 0, 7, 7, 0x3a6ab0).setStrokeStyle(1, 0x101018);
    const label = txt(this, -w + 17, 0, text, color).setOrigin(0, 0.5);
    const box = this.add.container(W - 6, H - 30, [bg, disk, label]).setDepth(20).setAlpha(0);
    this.saveBox = box;
    this.tweens.add({
      targets: box, alpha: 1, duration: 200,
      onComplete: () => this.tweens.add({ targets: box, alpha: 0, delay: 1800, duration: 400, onComplete: () => box.destroy() }),
    });
    this.tweens.add({ targets: disk, angle: 360, duration: 600 });
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
