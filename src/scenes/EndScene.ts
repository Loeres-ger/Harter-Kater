import Phaser from 'phaser';
import { audio } from '../audio';
import { VICTIM, state } from '../state';
import { W, txt } from '../ui';
import { newGame } from './TitleScene';

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create() {
    state.running = false;
    const win = state.gameOver === 'win';
    audio.setRain(false);
    audio.music(win ? 'monster' : 'none');
    if (!win) audio.sfx(state.gameOver === 'polizei' ? 'siren' : 'gameover');
    this.cameras.main.setBackgroundColor(win ? '#140e06' : '#0a0a14').fadeIn(500);

    if (win) {
      // Kulisse: die Gasse bei Nacht, in doppelter Pixelgröße
      const FLOOR = 116, FEET = 196;
      this.add.tileSprite(0, 0, W, FLOOR, 'brickFront').setOrigin(0).setTileScale(1);
      this.add.tileSprite(0, FLOOR, W, 270 - FLOOR, 'cobble0').setOrigin(0).setTileScale(1);
      this.add.rectangle(0, FLOOR - 4, W, 4, 0x1a1414).setOrigin(0);
      for (const [x, k] of [[40, 'trash'], [400, 'crate'], [436, 'crate'], [72, 'dumpster'], [104, 'dumpster']] as const)
        this.add.image(x, FLOOR + 14, k).setOrigin(0.5, 1).setScale(1).setAngle(k === 'trash' ? 90 : 0);
      this.add.rectangle(0, 0, W, 270, 0x05030a, 0.62).setOrigin(0);
      // Schatten und Leuchten am Boden
      this.add.image(W / 2, FEET - 2, 'shadow').setScale(13, 3).setAlpha(0.9);
      this.add.image(W / 2, FEET - 6, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2.8, 0.6).setTint(0x60ff30).setAlpha(0.5);
      this.add.image(W / 2, 120, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2.6).setTint(0x50d030).setAlpha(0.45);
      this.add.particles(W / 2, 150, 'light', {
        lifespan: 2600, speed: { min: 8, max: 30 }, angle: { min: 230, max: 310 }, scale: { start: 0.06, end: 0.4 },
        alpha: { start: 0.4, end: 0 }, tint: [0x60c030, 0x90e040, 0x406020], frequency: 90, blendMode: 'ADD',
      });
      const monster = this.add.sprite(W / 2, FEET, 'mutant', 0).setOrigin(0.5, 1).setScale(1).play('mutant_idle');
      monster.setTint(0xb8c8b0); // vom fahlen Gassenlicht abgedunkelt
      this.tweens.add({ targets: monster, scaleY: 1.03, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add.rectangle(0, 14, W, 32, 0x000000, 0.55).setOrigin(0);
      this.add.rectangle(0, 204, W, 60, 0x000000, 0.55).setOrigin(0);
      txt(this, W / 2, 30, 'ES IST ERWACHT', '#b8f060', 16).setOrigin(0.5).setStroke('#0a1a04', 5);
      const m = Math.floor(state.time / 60), s = Math.floor(state.time % 60);
      txt(this, W / 2, 222, `${VICTIM} wurde restlos verfüttert.\nZeit: ${m}:${String(s).padStart(2, '0')}   Kohle übrig: €${state.money}`, '#f4ead0')
        .setOrigin(0.5).setAlign('center');
    } else {
      const polizei = state.gameOver === 'polizei';
      if (polizei) {
        const siren = this.add.rectangle(0, 0, W, 270, 0xff2020, 0.15).setOrigin(0);
        this.time.addEvent({ delay: 400, loop: true, callback: () => siren.setFillStyle(siren.fillColor === 0xff2020 ? 0x2040ff : 0xff2020, 0.15) });
      }
      txt(this, W / 2, 70, 'ERWISCHT', '#e05a4a', 24).setOrigin(0.5).setStroke('#2a0a0a', 6);
      const why = polizei
        ? state.caughtBy === 'felix'
          ? 'Polizist Felix hatte „ein Gespür für so was“.\nSchlagstock. Handschellen. Aus.'
          : state.caughtBy === 'bulle'
            ? 'Polizist Felix hat alles gesehen.\nBlaulicht. Handschellen. Aus.'
            : 'Jemand hat die Leiche in der Gasse gefunden.\nBlaulicht. Handschellen. Aus.'
        : `${VICTIM} hat Lunte gerochen\nund ist zur Polizei gerannt.`;
      txt(this, W / 2, 130, `${why}\n\nDie Katze bleibt heute hungrig.`, '#f4ead0')
        .setOrigin(0.5).setAlign('center');
      this.add.sprite(W / 2, 200, 'cat', 0).setScale(1.5).setTint(0x8888aa).play('cat_idle');
      const tip = state.caughtBy === 'felix' ? 'Felix urteilt nicht nach Taten. Leider.' : state.caughtBy === 'bulle' ? 'Achte auf die Taschenlampe von Felix.' : 'Leichen gehören in den Müll. Schnell.';
      txt(this, W / 2, 222, `Tipp: ${polizei ? tip : 'Gib ihm, was er will. Und nicht zu schnell.'}`, '#8a7a5a').setOrigin(0.5);
    }

    const again = txt(this, W / 2, 250, '[ LEERTASTE: NOCHMAL ]', '#ffffff').setOrigin(0.5);
    this.tweens.add({ targets: again, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
    this.time.delayedCall(800, () => {
      this.input.keyboard!.once('keydown-SPACE', () => newGame(this));
      this.input.once('pointerdown', () => newGame(this));
    });
  }
}
