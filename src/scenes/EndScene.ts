import Phaser from 'phaser';
import { audio } from '../audio';
import { VICTIM, state } from '../state';
import { H, W, fadeTo, txt } from '../ui';
import { autoStand, lastChapter } from '../progress/save';
import { Btn } from './ShopScene';
import { drawRain, hGradient, kalleAtTable, vGradient } from './screenFx';
import { loadAuto, loadChapter, newGame } from './TitleScene';
import { resetAlley } from './AlleyScene';
import { BAR_TRESEN_SPAWN } from './BarScene';

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create() {
    // Glanz ist verfüttert: kein Siegesbildschirm mehr, sondern Feierabend mit Kalle an der Theke, danach geht es
    // leicht angetrunken in die offene Welt
    if (state.gameOver === 'win') return this.feierabend();
    state.running = false;
    audio.setRain(false);
    audio.music('verloren');
    audio.sfx(state.gameOver === 'polizei' ? 'siren' : 'gameover');
    this.cameras.main.setBackgroundColor('#0a0a14').fadeIn(500);
    this.lose();
  }

  /** Nach dem Sieg: Feierabend mit Kalle (Zwischensequenz), dann freies Spiel in der Kneipe, mit einem Bier im Kopf */
  private feierabend() {
    state.flags.glanzErledigt = true;
    state.gameOver = null;
    state.carrying = false;
    state.bodyDeadline = null;
    state.running = true;
    resetAlley();
    this.cameras.main.setBackgroundColor('#000000');
    this.time.delayedCall(10, () => fadeTo(this, 'Cutscene', { script: 'feierabend', next: { scene: 'Bar', data: { spawn: BAR_TRESEN_SPAWN, rausch: 1 } } }));
  }

  /** Verloren: Polizeifoto vom Wirt, Blaulicht im Regen, Kalle kommentiert aus dem Hintergrund. */
  private lose() {
    const polizei = state.gameOver === 'polizei';
    const felix = polizei && state.caughtBy === 'felix';
    const bulle = polizei && state.caughtBy === 'bulle';

    // ---------------------------------------------------------------- Kulisse: Straße vor der Kneipe, Blaulicht, Regen
    this.add.image(0, 0, 'csStreet').setOrigin(0).setTint(0x4a5a8a);
    const neon = txt(this, 240, 102, 'ZUM GOLDENEN EIMER', '#ff6ab4').setOrigin(0.5).setAlpha(0.35);
    this.tweens.add({ targets: neon, alpha: 0.1, duration: 80, yoyo: true, repeat: -1, repeatDelay: 1400 });
    const red = this.add.image(90, 60, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(5, 3).setTint(0xff2020).setAlpha(0).setDepth(5);
    const blue = this.add.image(390, 60, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(5, 3).setTint(0x2050ff).setAlpha(0).setDepth(5);
    if (polizei) {
      this.tweens.add({ targets: red, alpha: 0.35, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: blue, alpha: 0.35, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 380 });
    }

    // Kalle im Hintergrund am Tisch, blass im Regenlicht
    const KX = 444, TY = 218;
    const k = kalleAtTable(this, KX, TY, { depth: 8, tint: 0x8a90b8 });
    k.kalle.setAlpha(0.9);
    const rain = this.add.graphics().setDepth(20);
    const onUpdate = (t: number) => drawRain(rain, t, 0, 0, W, H, 60, 0x9ab0e0, 0.3);
    this.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
    vGradient(this, 0, W, 0, 40, 0x000000, 0.8, 0, 21);
    vGradient(this, 0, W, 200, H, 0x000000, 0, 0.9, 21);
    hGradient(this, 0, 330, 0, H, 0x05040a, 0.75, 0.05, 21);

    // ---------------------------------------------------------------- Polizeifoto
    const BX = 22, BY = 52, BWD = 128, BHT = 150;
    const board = this.add.graphics().setDepth(30);
    board.fillStyle(0x2a2e3a).fillRect(BX, BY, BWD, BHT);
    board.lineStyle(1, 0x5a6278, 1);
    for (let y = BY + 8; y < BY + BHT; y += 12) board.lineBetween(BX, y, BX + (((y - BY) / 12) % 2 ? 10 : 18), y);
    for (let y = BY + 8; y < BY + BHT; y += 12) board.lineBetween(BX + BWD, y, BX + BWD - (((y - BY) / 12) % 2 ? 10 : 18), y);
    board.lineStyle(2, 0x8a6a3a, 1).strokeRect(BX, BY, BWD, BHT);
    const mug = this.add.image(BX + BWD / 2, BY + BHT, 'bustWirt').setOrigin(0.5, 1).setScale(0.72).setDepth(31);
    // Nummernschild vor der Brust
    const plate = this.add.container(BX + BWD / 2, BY + BHT - 22).setDepth(32);
    plate.add(this.add.rectangle(0, 0, 76, 22, 0x101014).setStrokeStyle(1, 0xd8d8d8));
    plate.add(txt(this, 0, -5, 'HORST W.', '#f0f0f0', 8).setOrigin(0.5));
    plate.add(txt(this, 0, 6, `#${String(Math.floor(state.time * 7) % 9000 + 1000)}`, '#c8c8c8', 8).setOrigin(0.5));
    // Kamerablitz beim Erscheinen
    this.time.delayedCall(350, () => {
      this.cameras.main.flash(180, 255, 255, 255);
      audio.sfx('click');
      mug.setTint(0xffffff);
    });

    // ---------------------------------------------------------------- Titel und Grund
    const head = felix || bulle || polizei ? 'ERWISCHT' : 'ER IST WEG';
    const TX = 164;
    const glitchR = txt(this, TX + 2, 38, head, '#ff2a4a', 24).setDepth(39).setAlpha(0.6);
    const glitchB = txt(this, TX - 2, 38, head, '#2a8aff', 24).setDepth(39).setAlpha(0.6);
    const title = txt(this, TX, 38, head, '#f4ead0', 24).setDepth(40).setStroke('#120c0b', 4);
    this.time.addEvent({
      delay: 90, loop: true,
      callback: () => {
        const j = Math.random() < 0.12 ? 3 : 1;
        glitchR.setX(TX + j); glitchB.setX(TX - j);
        title.setX(Math.random() < 0.05 ? TX + 1 : TX);
      },
    });
    const why = felix
      ? 'Polizist Felix hatte\n„ein Gespür für so was“.\nSchlagstock. Handschellen.\nAus.'
      : bulle
        ? 'Polizist Felix hat\nalles gesehen. Blaulicht.\nHandschellen. Aus.'
        : polizei
          ? 'Jemand hat die Leiche\nin der Gasse gefunden.\nBlaulicht. Handschellen.'
          : `${VICTIM} hat\nLunte gerochen und ist\nzur Polizei gerannt.`;
    // Textspalte bleibt links von Kalle (max. ~26 Zeichen pro Zeile)
    txt(this, TX, 74, why, '#f4ead0', 8).setDepth(40);
    txt(this, TX, 124, 'Die Katze bleibt hungrig.', '#9ad070', 8).setDepth(40);
    const m = Math.floor(state.time / 60), s = Math.floor(state.time % 60);
    txt(this, TX, 140, `ZEIT ${m}:${String(s).padStart(2, '0')}   KASSE €${state.money}`, '#8a8aa8', 8).setDepth(40);
    const tip = felix ? 'Felix urteilt nicht nach Taten. Leider.' : bulle ? 'Achte auf die Taschenlampe von Felix.' : polizei ? 'Leichen gehören in den Müll. Schnell.' : 'Gib ihm, was er will. Nicht zu schnell.';
    txt(this, TX, 158, `TIPP: ${tip}`, '#c9a24a', 8).setDepth(40).setWordWrapWidth(212);

    // Kalle meldet sich aus dem Hintergrund
    const kalleSays = felix || bulle
      ? 'Hab ich doch\ngesagt, Chef.'
      : polizei
        ? 'Leichen in den\nMüll, Chef.'
        : 'Nicht so hastig,\nChef.';
    this.time.delayedCall(1400, () => {
      // über Kalles Kopf, rechts neben dem Titel
      const bubble = this.add.container(KX - 54, 22).setDepth(41).setScale(0);
      const label = txt(this, 0, 0, kalleSays, '#1a1212', 8).setOrigin(0.5).setAlign('center');
      const bw = label.width + 6, bh = label.height + 2;
      bubble.add(this.add.rectangle(0, 0, bw, bh, 0xf4ead0).setStrokeStyle(1, 0x1a1212));
      bubble.add(this.add.triangle(18, bh / 2 + 3, 0, 0, 8, 0, 6, 6, 0xf4ead0));
      bubble.add(label);
      this.tweens.add({ targets: bubble, scale: 1, duration: 260, ease: 'Back.easeOut' });
    });

    // ---------------------------------------------------------------- Nochmal: ab dem letzten Speicherpunkt
    // (Zwischenstand der offenen Welt oder letztes Kapitel); nur ohne jeden Stand ganz von vorn
    let gone = false;
    const last = lastChapter();
    const stand = !!autoStand() || !!last;
    const again = () => {
      if (gone) return;
      gone = true;
      if (!(loadAuto(this) || (last && loadChapter(this, last.id)))) newGame(this);
    };
    const btn = new Btn(this, TX + 70, 200, 140, 22, 'NOCHMAL', 0xa8342a, again);
    btn.box.setDepth(45).setAlpha(0);
    this.tweens.add({ targets: btn.box, alpha: 1, duration: 400, delay: 800 });
    this.tweens.add({ targets: btn.box, scale: 1.05, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 1300 });
    txt(this, TX + 70, 214, stand ? 'ab dem letzten Speicherpunkt' : 'oder Leertaste', '#6a6a88', 8).setOrigin(0.5, 0).setDepth(45);
    if (stand) {
      const neu = new Btn(this, TX + 70, 240, 140, 16, 'NEUES SPIEL', 0x3a3040, () => {
        if (gone) return;
        gone = true;
        newGame(this);
      });
      neu.box.setDepth(45).setAlpha(0);
      this.tweens.add({ targets: neu.box, alpha: 1, duration: 400, delay: 800 });
    }
    this.time.delayedCall(800, () => {
      this.input.keyboard!.once('keydown-SPACE', again);
      this.input.keyboard!.once('keydown-ENTER', again);
    });
    // Scanlines wie auf dem Titelbildschirm
    const scan = this.add.graphics().setDepth(60);
    for (let y = 0; y < H; y += 2) scan.fillStyle(0x000000, 0.12).fillRect(0, y, W, 1);
  }
}
