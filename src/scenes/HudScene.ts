import Phaser from 'phaser';
import { VICTIM, bulky, rauschStufe, speedy, state, tript } from '../state';
import { H, W, txt } from '../ui';
import { addTouchControls } from '../touch';
import { freiesSpiel } from '../progress/flags';

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
  private seenToast = 0;
  private trip!: Phaser.GameObjects.Rectangle;

  constructor() {
    super('Hud');
  }

  create() {
    this.seenToast = hud.toastSeq;
    // „Zeug“: die Welt wird bunt (liegt unter allen Anzeigen)
    this.trip = this.add.rectangle(0, 0, W, H, 0xff00ff, 0).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    // oben links nur noch das Geld; die Waren liegen im Inventar (Knopf oben rechts unter Pause, Taste I)
    this.add.rectangle(4, 4, 50, 14, 0x120c0b, 0.75).setOrigin(0).setStrokeStyle(1, 0x5a4430);
    this.money = txt(this, 9, 7, '', '#f8e070');
    // Sucht und Misstrauen nur während der Glanz-Handlung; rechts bleibt Platz für Pause- und Inventar-Knopf
    this.status = txt(this, 60, 7, '', '#e0b0b0').setStroke('#120c0b', 3);
    this.add.rectangle(0, H - 18, W, 18, 0x120c0b, 0.65).setOrigin(0);
    this.goal = txt(this, 6, H - 12, '', '#b8a888');
    this.prompt = txt(this, W / 2, H - 34, '', '#ffffff').setOrigin(0.5).setStroke('#120c0b', 4);
    this.alertT = txt(this, W / 2, 62, '', '#ff4040', 16).setOrigin(0.5).setStroke('#120c0b', 5);
    this.boostT = txt(this, 9, 22, '', '#80d0ff').setStroke('#120c0b', 3);
    this.toastT = txt(this, W / 2, 40, '', '#f4ead0').setOrigin(0.5).setAlpha(0).setAlign('center').setWordWrapWidth(W - 40).setStroke('#120c0b', 4);
    addTouchControls(this);
  }

  update() {
    this.money.setText(`€${state.money}`);
    if (tript()) {
      const c = Phaser.Display.Color.HSVToRGB((this.time.now / 2200) % 1, 0.9, 1) as Phaser.Types.Display.ColorObject;
      this.trip.setFillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 0.13 + 0.05 * Math.sin(this.time.now / 300));
    } else this.trip.setFillStyle(0xff00ff, 0);
    // Sucht, Misstrauen und Glanz-Anzeigen gibt es nur während der Glanz-Handlung, in der offenen Welt nicht mehr
    this.status.setText(
      freiesSpiel(state.flags)
        ? ''
        : state.dead ? `${VICTIM}: tot` : `SUCHT ${Math.round(state.sucht)}  MISSTRAUEN ${Math.round(state.misstrauen)}`,
    );
    this.goal.setText(hud.goal);
    const left = (until: number) => Math.max(0, Math.ceil(until - state.time));
    const fast = speedy(), broad = bulky();
    const rausch = rauschStufe();
    this.boostT.setText([fast ? `TEMPO ${left(state.boost.speed)}s` : '', broad ? `BREIT ${left(state.boost.bulk)}s` : '', rausch ? `RAUSCH ${'●'.repeat(rausch)}` : ''].filter(Boolean).join('  '));
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
