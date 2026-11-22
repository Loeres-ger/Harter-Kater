import Phaser from 'phaser';
import { audio } from '../audio';
import { chapterList, lastChapter } from '../progress/save';
import { state } from '../state';
import { isTouchDevice } from '../touch';
import { H, W, txt } from '../ui';
import { hud } from './HudScene';
import { Btn } from './ShopScene';
import { menuNav } from './menuNav';
import { loadChapter, newGame } from './TitleScene';
import { bigTitle, scanlines, tavernBackdrop } from './screenFx';

/**
 * Pausemenü im Look des Titelbildschirms (Kneipe bei Nacht, Kalle pennt, Schriftzug links):
 * Weiterspielen, Kapitel wählen, Erfolge, Ton, Neustart, Impressum, Datenschutz.
 * Oben rechts neben dem Pause-Knopf erscheint dazu der Vollbild-Knopf (HTML, siehe main.ts).
 */
export class PauseScene extends Phaser.Scene {
  private paused: string[] = [];
  private wasRunning = false;
  private soundBtn!: Btn;
  private restartBtn!: Btn;
  /** Neustart erst nach Bestätigung (zweiter Klick) */
  private restartArmed = false;
  private closing = false;

  constructor() {
    super('Pause');
  }

  /** Spiel anhalten und Menü öffnen (von außen aufrufbar). */
  static open(game: Phaser.Game) {
    // auch nicht neu starten, solange darüber Erfolge oder Kapitel offen sind
    if (game.scene.isActive('Pause') || game.scene.isPaused('Pause')) return;
    game.scene.start('Pause');
  }

  create() {
    this.closing = false;
    this.restartArmed = false;
    // alle laufenden Szenen anhalten und merken
    this.paused = this.game.scene
      .getScenes(true)
      .map((s) => s.scene.key)
      .filter((k) => k !== 'Pause');
    this.paused.forEach((k) => this.scene.pause(k));
    this.wasRunning = state.running;
    state.running = false;
    this.scene.bringToTop();
    this.cameras.main.setBackgroundColor('#0d0b0a').fadeIn(180);

    // Kulisse wie auf dem Titelbildschirm; die Fläche dahinter fängt Klicks ab
    this.add.rectangle(0, 0, W, H, 0x0d0b0a).setOrigin(0).setInteractive();
    tavernBackdrop(this);

    // ---------------------------------------------------------------- Schrift
    const LX = 26;
    txt(this, LX, 20, 'PAUSE', '#c9a24a', 8).setDepth(40);
    const title = bigTitle(this, LX, 32, ['HARTER', 'KARTER'], 24).setDepth(40);
    this.add.image(LX + 80, 60, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2, 1).setTint(0xff9a30).setAlpha(0.26).setDepth(39);
    this.add.rectangle(LX, 94, 150, 1, 0xc9a24a).setOrigin(0).setDepth(40);
    let y = 100;
    const last = lastChapter();
    if (last) y += txt(this, LX, y, `${last.title}: ${last.name}`, '#c9a24a', 8).setWordWrapWidth(250).setMaxLines(2).setDepth(40).height + 4;
    if (hud.goal) txt(this, LX, y, hud.goal, '#8a7a6a', 8).setWordWrapWidth(250).setMaxLines(2).setDepth(40);
    // wie auf dem Titel: der Schriftzug flackert ab und zu wie eine Neonröhre
    this.time.addEvent({
      delay: 3800, loop: true,
      callback: () => {
        title.setAlpha(0.55);
        this.time.delayedCall(60, () => title.setAlpha(1));
        this.time.delayedCall(140, () => title.setAlpha(0.7));
        this.time.delayedCall(200, () => title.setAlpha(1));
      },
    });

    // ---------------------------------------------------------------- Menü
    const toggleSound = () => {
      audio.unlock();
      audio.toggleMute();
      this.refreshSound();
    };
    const doClose = () => this.close();
    const doChapters = () => this.openChapters();
    const doAch = () => this.openAchievements();
    const doRestart = () => this.restart();
    const CX = LX + 75, BW = 150;
    const resume = new Btn(this, CX, 170, BW, 18, 'WEITERSPIELEN', 0xa8342a, doClose);
    const chapters = new Btn(this, CX, 191, BW, 14, 'KAPITEL WÄHLEN', 0x3a3040, doChapters);
    chapters.setEnabled(chapterList().some((c) => c.savedAt));
    const ach = new Btn(this, LX + 37, 209, 74, 14, 'ERFOLGE', 0x3a3040, doAch);
    this.soundBtn = new Btn(this, LX + 113, 209, 74, 14, '', 0x3a3040, toggleSound);
    this.restartBtn = new Btn(this, CX, 227, BW, 14, 'NEUSTART', 0x5a3a2a, doRestart);
    const menu = this.add.container(0, 0).setDepth(41);
    menu.add([resume.box, chapters.box, ach.box, this.soundBtn.box, this.restartBtn.box]);
    menu.add(txt(this, LX, H - 14, isTouchDevice(this) ? 'Tippen: auswählen' : 'ESC/P: weiter   F: Vollbild', '#5a4a3a', 8));
    this.refreshSound();
    menuNav(this, menu, [
      { btn: resume, w: BW, h: 18, act: doClose },
      { btn: chapters, w: BW, h: 14, act: doChapters },
      { btn: ach, w: 74, h: 14, act: doAch },
      { btn: this.soundBtn, w: 74, h: 14, act: toggleSound },
      { btn: this.restartBtn, w: BW, h: 14, act: doRestart },
    ]);
    this.tweens.add({ targets: resume.box, scale: 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Impressum und Datenschutz unten rechts wie die Links auf dem Titel (öffnen einen neuen Tab, das Spiel bleibt)
    const link = (x: number, label: string, page: 'impressum' | 'datenschutz') => {
      const t = txt(this, x, H - 14, label, '#a89878', 8).setOrigin(1, 0).setDepth(41).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor('#f0c030'));
      t.on('pointerout', () => t.setColor('#a89878'));
      t.on('pointerup', () => window.open(`./${page}.html`, '_blank', 'noopener'));
      return t;
    };
    const dsg = link(W - 10, 'Datenschutz', 'datenschutz');
    txt(this, dsg.x - dsg.width - 6, H - 14, '·', '#6a5a4a', 8).setOrigin(1, 0).setDepth(41);
    link(dsg.x - dsg.width - 18, 'Impressum', 'impressum');

    scanlines(this);

    menu.setAlpha(0);
    this.tweens.add({ targets: menu, alpha: 1, duration: 250, delay: 80 });
    this.input.keyboard!.on('keydown-ESC', () => this.close());
  }

  private refreshSound() {
    this.soundBtn.setLabel(audio.muted ? 'TON: AUS' : 'TON: AN');
  }

  /** Erster Klick fragt nach, zweiter startet ein neues Spiel (Achievements bleiben erhalten). */
  private restart() {
    if (this.closing) return;
    if (!this.restartArmed) {
      this.restartArmed = true;
      this.restartBtn.setLabel('WIRKLICH NEUSTART?');
      this.restartBtn.setColor(0xa03020);
      // ohne Bestätigung nach ein paar Sekunden wieder entschärfen
      this.time.delayedCall(3000, () => {
        if (this.closing) return;
        this.restartArmed = false;
        this.restartBtn.setLabel('NEUSTART');
        this.restartBtn.setColor(0x5a3a2a);
      });
      return;
    }
    this.closing = true;
    this.stopGame();
    newGame(this);
  }

  /** alle angehaltenen Spielszenen beenden; die Achievement-Einblendung läuft weiter */
  private stopGame() {
    for (const k of this.paused) {
      if (k === 'Notify') this.scene.resume(k);
      else this.scene.stop(k);
    }
  }

  private openChapters() {
    if (this.closing) return;
    this.scene.launch('Saves', { from: 'Pause' });
    this.scene.pause();
  }

  /** Aus der Kapitelliste: laufendes Spiel beenden und das gewählte Kapitel laden. */
  startChapter(id: string) {
    if (this.closing) return;
    this.closing = true;
    this.stopGame();
    loadChapter(this, id);
  }

  private openAchievements() {
    if (this.closing) return;
    this.scene.launch('Achievements');
    this.scene.pause();
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    state.running = this.wasRunning;
    this.paused.forEach((k) => this.scene.resume(k));
    this.scene.stop();
  }
}
