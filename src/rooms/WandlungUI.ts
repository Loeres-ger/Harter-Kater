import Phaser from 'phaser';
import { H, W, txt } from '../ui';

/** Kinobalken, Untertitel und Hinweis über einer Zwischensequenz in der Welt (eigene Szene, damit der Kamera-Zoom
 *  sie nicht erfasst). Benutzt von der Verwandlung im Keller. */
export class WandlungUI extends Phaser.Scene {
  private name!: Phaser.GameObjects.Text;
  private text!: Phaser.GameObjects.Text;
  private oben!: Phaser.GameObjects.Rectangle;
  private unten!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('WandlungUI');
  }

  create() {
    // Balken fahren herein
    this.oben = this.add.rectangle(0, -22, W, 22, 0x000000).setOrigin(0);
    this.unten = this.add.rectangle(0, H, W, 36, 0x000000, 0.94).setOrigin(0);
    this.tweens.add({ targets: this.oben, y: 0, duration: 400, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: this.unten, y: H - 36, duration: 400, ease: 'Quad.easeOut' });
    this.name = txt(this, 12, H - 32, '', '#ff5040');
    this.text = txt(this, 12, H - 20, '', '#f4ead0').setWordWrapWidth(W - 24);
    const skip = txt(this, W - 8, 6, 'ESC: überspringen', '#6a5a4a').setOrigin(1, 0).setAlpha(0);
    this.time.delayedCall(2500, () => skip.setAlpha(0.6));
  }

  zeige(wer: string, farbe: string, text: string) {
    if (!this.text) return;
    this.name.setText(wer).setColor(farbe);
    this.text.setText(text).setAlpha(0);
    this.tweens.add({ targets: this.text, alpha: 1, duration: 200 });
  }

  leer() {
    this.name?.setText('');
    this.text?.setText('');
  }
}
