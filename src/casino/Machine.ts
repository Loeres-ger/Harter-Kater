import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { H, W, txt } from '../ui';
import { Btn } from '../scenes/ShopScene';

export interface MachineData {
  /** pausierte Szene, die nach dem Schließen weiterläuft */
  resume: string;
}

export interface Theme {
  title: string;
  body: number;
  trim: number;
  titleColor: string;
  glow: string;
}

/** Grundgerüst eines Automaten: Gehäuse, Leuchtschrift, Anzeigen, Schließen-Knopf. */
export abstract class Machine extends Phaser.Scene {
  protected cfg!: MachineData;
  protected moneyT!: Phaser.GameObjects.Text;
  protected busy = false;
  private wasRunning = false;
  private closing = false;

  protected abstract theme(): Theme;
  protected abstract build(): void;
  /** Wird beim Schließen aufgerufen, z. B. um offene Gewinne auszuzahlen. */
  protected onClose() {}

  create(data: MachineData) {
    this.cfg = data;
    this.busy = false;
    this.closing = false;
    this.wasRunning = state.running;
    state.running = false;
    const th = this.theme();

    this.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0).setInteractive();
    // Gehäuse
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.5).fillRoundedRect(24, 10, W - 44, H - 16, 10);
    g.fillStyle(th.body).fillRoundedRect(20, 6, W - 40, H - 14, 10);
    g.lineStyle(3, th.trim).strokeRoundedRect(20, 6, W - 40, H - 14, 10);
    g.fillStyle(0x000000, 0.25).fillRect(28, 50, W - 56, 2);
    // Leuchtschrift mit Glühbirnen
    g.fillStyle(0x140c08).fillRoundedRect(110, 12, W - 220, 32, 6);
    const title = txt(this, W / 2, 28, th.title, th.titleColor, 16).setOrigin(0.5).setShadow(0, 0, th.glow, 8, true, true);
    this.tweens.add({ targets: title, alpha: 0.75, duration: 110, yoyo: true, repeat: -1, repeatDelay: 1800 });
    const bulbs: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 14; i++) {
      const bx = 116 + i * ((W - 232) / 13);
      bulbs.push(this.add.circle(bx, 14, 2, 0xf8e070), this.add.circle(bx, 42, 2, 0xf8e070));
    }
    let tick = 0;
    this.time.addEvent({
      delay: 160, loop: true,
      callback: () => {
        tick++;
        bulbs.forEach((b, i) => b.setFillStyle((Math.floor(i / 2) + tick) % 2 ? 0xf8e070 : 0x5a3a10));
      },
    });

    this.moneyT = txt(this, 40, H - 24, '', '#f8e070');
    const close = new Btn(this, W - 44, 28, 26, 22, 'X', 0x5a2a20, () => this.close());
    close.box.setDepth(50);

    this.build();
    this.refreshMoney();
    this.cameras.main.fadeIn(150);
  }

  protected refreshMoney() {
    this.moneyT.setText(`KASSE: ${state.money}€`);
  }

  /** Große Meldung mitten auf dem Bildschirm. */
  protected banner(s: string, color = '#f8e070', size = 16) {
    const t = txt(this, W / 2, H / 2, s, color, size).setOrigin(0.5).setDepth(60).setStroke('#000000', 6).setScale(0.3).setAlign('center');
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1300, duration: 300, onComplete: () => t.destroy() });
  }

  /** Anzeige-Kästchen (z. B. EINSATZ, GEWINN). */
  protected display(x: number, y: number, w: number, label: string) {
    this.add.rectangle(x, y, w, 26, 0x0a0806).setOrigin(0).setStrokeStyle(1, 0x5a4430);
    txt(this, x + 4, y + 3, label, '#8a7a5a');
    return txt(this, x + w - 4, y + 14, '', '#ff5040').setOrigin(1, 0);
  }

  protected pay(amount: number) {
    if (amount <= 0) return;
    state.money += amount;
    this.refreshMoney();
    audio.sfx(amount >= 20 ? 'chime' : 'coin');
    if (amount >= 20) this.time.delayedCall(200, () => audio.sfx('kaching'));
  }

  protected charge(amount: number) {
    if (state.money < amount) {
      audio.sfx('error');
      this.banner('ZU WENIG GELD', '#ff6a5a', 8);
      return false;
    }
    state.money -= amount;
    this.refreshMoney();
    return true;
  }

  close() {
    if (this.closing || this.busy) return;
    this.closing = true;
    this.onClose();
    state.running = this.wasRunning;
    this.scene.resume(this.cfg.resume);
    this.scene.stop();
  }
}
