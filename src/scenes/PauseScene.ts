import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { H, W, txt } from '../ui';
import { Btn } from './ShopScene';
import { menuNav } from './menuNav';

/** Pausemenü über allem: Weiterspielen, Achievements, Ton an/aus, Impressum, Datenschutz. */
export class PauseScene extends Phaser.Scene {
  private paused: string[] = [];
  private wasRunning = false;
  private soundBtn!: Btn;
  private closing = false;

  constructor() {
    super('Pause');
  }

  /** Spiel anhalten und Menü öffnen (von außen aufrufbar). */
  static open(game: Phaser.Game) {
    if (game.scene.isActive('Pause')) return;
    game.scene.start('Pause');
  }

  create() {
    this.closing = false;
    // alle laufenden Szenen anhalten und merken
    this.paused = this.game.scene
      .getScenes(true)
      .map((s) => s.scene.key)
      .filter((k) => k !== 'Pause');
    this.paused.forEach((k) => this.scene.pause(k));
    this.wasRunning = state.running;
    state.running = false;
    this.scene.bringToTop();

    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.7, duration: 150 });

    const PW = 220, PH = 220;
    const panel = this.add.container(W / 2, H / 2);
    const bg = this.add.rectangle(0, 0, PW, PH, 0x1a1210).setStrokeStyle(2, 0xc9a24a).setInteractive();
    const inner = this.add.rectangle(0, 0, PW - 8, PH - 8, 0x000000, 0).setStrokeStyle(1, 0x3a2a1e);
    const title = txt(this, 0, -PH / 2 + 18, 'PAUSE', '#f0c030', 16).setOrigin(0.5).setStroke('#5a2a0a', 4);
    panel.add([bg, inner, title]);

    const BW = 170;
    const toggleSound = () => {
      audio.unlock();
      audio.toggleMute();
      this.refreshSound();
    };
    const doClose = () => this.close();
    const doAch = () => this.openAchievements();
    const doImp = () => this.openPage('impressum');
    const doDsg = () => this.openPage('datenschutz');
    const resume = new Btn(this, 0, -50, BW, 24, 'WEITERSPIELEN', 0x3a6a2a, doClose);
    const ach = new Btn(this, 0, -20, BW, 20, 'ACHIEVEMENTS', 0x6a5020, doAch);
    this.soundBtn = new Btn(this, 0, 6, BW, 20, '', 0x5a4a2a, toggleSound);
    const imp = new Btn(this, 0, 38, BW, 18, 'IMPRESSUM', 0x3a3040, doImp);
    const dsg = new Btn(this, 0, 62, BW, 18, 'DATENSCHUTZ', 0x3a3040, doDsg);
    const hint = txt(this, 0, PH / 2 - 16, 'öffnet neuen Tab', '#6a5a4a').setOrigin(0.5);
    panel.add([resume.box, ach.box, this.soundBtn.box, imp.box, dsg.box, hint]);
    this.refreshSound();
    // Tastatur: Pfeile wählen, Enter bestätigt
    menuNav(this, panel, [
      { btn: resume, w: BW, h: 24, act: doClose },
      { btn: ach, w: BW, h: 20, act: doAch },
      { btn: this.soundBtn, w: BW, h: 20, act: toggleSound },
      { btn: imp, w: BW, h: 18, act: doImp },
      { btn: dsg, w: BW, h: 18, act: doDsg },
    ]);

    panel.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 160, ease: 'Back.easeOut' });

    // Klick neben das Menü oder ESC: weiterspielen (P schaltet main.ts um)
    dim.on('pointerdown', () => this.close());
    this.input.keyboard!.on('keydown-ESC', () => this.close());
  }

  private refreshSound() {
    this.soundBtn.setLabel(audio.muted ? 'TON: AUS' : 'TON: AN');
  }

  private openAchievements() {
    if (this.closing) return;
    this.scene.launch('Achievements');
    this.scene.pause();
  }

  private openPage(page: 'impressum' | 'datenschutz') {
    // neuer Tab, damit der Spielstand erhalten bleibt
    window.open(`./${page}.html`, '_blank', 'noopener');
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    state.running = this.wasRunning;
    this.paused.forEach((k) => this.scene.resume(k));
    this.scene.stop();
  }
}
