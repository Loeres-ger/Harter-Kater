import Phaser from 'phaser';
import { ITEMS, VICTIM, bulky, speedy, state } from '../state';
import { H, W, txt } from '../ui';
import { addTouchControls } from '../touch';

/** Von den Draufsicht-Szenen beschrieben, vom HUD angezeigt. */
export const hud = { prompt: '', goal: '', toast: '', toastSeq: 0, alert: '' };

export function toast(s: string) {
  hud.toast = s;
  hud.toastSeq++;
}

/** Ungezoomtes Overlay über Bar und Gasse. */
export class HudScene extends Phaser.Scene {
  private money!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private goal!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private toastT!: Phaser.GameObjects.Text;
  private alertT!: Phaser.GameObjects.Text;
  private boostT!: Phaser.GameObjects.Text;
  private boostWas = { speed: false, bulk: false };
  private icons: Phaser.GameObjects.Image[] = [];
  private counts: Phaser.GameObjects.Text[] = [];
  private seenToast = 0;

  constructor() {
    super('Hud');
  }

  create() {
    this.icons = [];
    this.counts = [];
    this.seenToast = hud.toastSeq;
    this.add.rectangle(0, 0, W, 22, 0x120c0b, 0.8).setOrigin(0);
    this.money = txt(this, 6, 7, '', '#f8e070');
    ITEMS.forEach((it, i) => {
      const x = 62 + i * 30;
      this.icons.push(this.add.image(x, 11, `icon_${it.id}`).setScale(0.5));
      this.counts.push(txt(this, x + 6, 12, ''));
    });
    // rechts Platz lassen: dort liegt der Pause-Knopf, wenn das Bild den ganzen Bildschirm füllt
    this.status = txt(this, W - 26, 7, '', '#e0b0b0').setOrigin(1, 0);
    this.add.rectangle(0, H - 18, W, 18, 0x120c0b, 0.65).setOrigin(0);
    this.goal = txt(this, 6, H - 12, '', '#b8a888');
    this.prompt = txt(this, W / 2, H - 34, '', '#ffffff').setOrigin(0.5).setStroke('#120c0b', 4);
    this.alertT = txt(this, W / 2, 62, '', '#ff4040', 16).setOrigin(0.5).setStroke('#120c0b', 5);
    this.boostT = txt(this, W - 26, 19, '', '#80d0ff').setOrigin(1, 0).setStroke('#120c0b', 3);
    this.toastT = txt(this, W / 2, 40, '', '#f4ead0').setOrigin(0.5).setAlpha(0).setAlign('center').setWordWrapWidth(W - 40).setStroke('#120c0b', 4);
    addTouchControls(this);
  }

  update() {
    this.money.setText(`€${state.money}`);
    ITEMS.forEach((it, i) => {
      const n = state.inv[it.id];
      this.icons[i].setAlpha(n > 0 ? 1 : 0.25);
      this.counts[i].setText(n > 0 ? String(n) : '');
    });
    this.status.setText(
      state.dead ? `${VICTIM}: tot` : `SUCHT ${Math.round(state.sucht)}  WÜRDE ${Math.round(state.wuerde)}  MISSTR ${Math.round(state.misstrauen)}`,
    );
    this.goal.setText(hud.goal);
    const left = (until: number) => Math.max(0, Math.ceil(until - state.time));
    const fast = speedy(), broad = bulky();
    this.boostT.setText([fast ? `TEMPO ${left(state.boost.speed)}s` : '', broad ? `BREIT ${left(state.boost.bulk)}s` : ''].filter(Boolean).join('  '));
    if ((this.boostWas.speed && !fast) || (this.boostWas.bulk && !broad)) toast('Die Wirkung lässt nach. Alles tut weh.');
    this.boostWas = { speed: fast, bulk: broad };
    this.prompt.setText(hud.prompt);
    this.alertT.setText(hud.alert).setAlpha(hud.alert ? 0.6 + 0.4 * Math.abs(Math.sin(this.time.now / 150)) : 0);
    if (hud.toastSeq !== this.seenToast) {
      this.seenToast = hud.toastSeq;
      this.toastT.setText(hud.toast).setAlpha(1);
      this.tweens.killTweensOf(this.toastT);
      this.tweens.add({ targets: this.toastT, alpha: 0, delay: 2400, duration: 500 });
    }
  }
}
