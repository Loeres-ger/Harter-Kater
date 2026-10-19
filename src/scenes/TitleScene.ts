import Phaser from 'phaser';
import { audio } from '../audio';
import { makeAllTextures } from '../gfx';
import { makeCasinoTextures } from '../casino/gfx';
import { makeGuestTextures } from '../guests/gfx';
import { makeWorldTextures } from '../world/textures';
import { makeLeonardTextures } from '../world/leonard';
import { makeAchievementIcons } from '../progress/icons';
import { makeRoomTextures } from '../rooms/gfx';
import { makeLadenTextures } from '../rooms/ladenGfx';
import { makeAnneTextures } from '../events/anne';
import { VICTIM, resetState, state } from '../state';
import { H, W, fadeTo, txt } from '../ui';
import { resetAlley } from './AlleyScene';
import { BAR_START_SPAWN, resetBar } from './BarScene';
import { isTouchDevice } from '../touch';

/** Impressum-/Datenschutz-Links nur auf dem Titelbildschirm zeigen. */
function showLegalLinks(on: boolean) {
  document.getElementById('legal')?.classList.toggle('hidden', !on);
}

export function newGame(scene: Phaser.Scene) {
  showLegalLinks(false);
  resetState();
  resetBar();
  resetAlley();
  state.running = true;
  fadeTo(scene, 'Cutscene', { script: 'prolog', next: { scene: 'Bar', data: { spawn: BAR_START_SPAWN } } });
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    if (!this.textures.exists('wirt')) makeAllTextures(this);
    makeCasinoTextures(this);
    makeGuestTextures(this);
    makeWorldTextures(this);
    makeLeonardTextures(this);
    makeAchievementIcons(this);
    makeRoomTextures(this);
    makeLadenTextures(this);
    makeAnneTextures(this);
    // Achievement-Einblendungen laufen dauerhaft über allen Szenen
    if (!this.scene.isActive('Notify')) this.scene.launch('Notify');
    showLegalLinks(true);
    audio.music('title');
    // Audio darf erst nach einer Nutzeraktion starten
    this.input.once('pointerdown', () => audio.unlock());
    this.input.keyboard!.once('keydown', () => audio.unlock());
    this.cameras.main.setBackgroundColor('#0d0b0a').fadeIn(400);

    const title = txt(this, W / 2, 46, 'DIE KÖNIGSKATZE', '#f0c030', 24).setOrigin(0.5);
    title.setStroke('#5a2a0a', 6).setShadow(0, 4, '#000', 0, true, true);
    txt(this, W / 2, 76, 'Ein Spiel über Gastfreundschaft', '#b8a888').setOrigin(0.5);

    // Die Pestkatze: fauliges Glimmen, glühendes Auge, Fliegen
    this.add.image(W / 2, 120, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setTint(0x40a020).setAlpha(0.45);
    const cat = this.add.sprite(W / 2, 156, 'cat', 0).setScale(2.5).play('cat_idle');
    const eye = this.add.image(W / 2 - 40 + 11 * 5 + 2, 156 - 70 + 4 * 5 + 2, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(0.25).setTint(0xff3010);
    this.tweens.add({ targets: eye, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
    for (let i = 0; i < 5; i++) {
      const f = this.add.rectangle(W / 2, 110, 2, 2, 0x0a0a0a);
      const sp = 250 + i * 60, ph = i * 1.3;
      this.events.on(Phaser.Scenes.Events.UPDATE, (t: number) => f.setPosition(W / 2 + Math.cos(t / sp + ph) * 50, 115 + Math.sin(t / (sp * 0.7) + ph) * 25));
    }
    this.add.image(W / 2 - 120, 146, 'bustWirt').setScale(0.5);
    this.add.image(W / 2 + 120, 146, 'bust0').setScale(0.5);
    void cat;

    txt(this, W / 2, 206, `Du bist der Wirt. Mach deinen feinsten Gast,\n${VICTIM}, zum Wrack. Die Katze hat Hunger.`, '#f4ead0')
      .setOrigin(0.5).setAlign('center');
    const mobile = isTouchDevice(this);
    txt(this, W / 2, 232, mobile ? 'Joystick: laufen   E-Knopf: benutzen' : 'WASD/Pfeile: laufen   E: benutzen   Maus: kaufen', '#8a7a5a').setOrigin(0.5);
    const start = txt(this, W / 2, 252, mobile ? '[ ZUM STARTEN TIPPEN ]' : '[ KLICKEN ZUM STARTEN ]', '#ffffff').setOrigin(0.5);
    this.tweens.add({ targets: start, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });

    const go = () => {
      audio.unlock();
      // Auf dem Handy: Vollbild und Querformat erzwingen (wo der Browser es erlaubt)
      if (mobile) {
        try {
          if (!this.scale.isFullscreen) this.scale.startFullscreen();
          (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
        } catch {
          /* nicht unterstützt */
        }
      }
      newGame(this);
    };
    this.input.keyboard!.once('keydown-SPACE', go);
    this.input.keyboard!.once('keydown-ENTER', go);
    this.input.once('pointerup', go); // Vollbild klappt nur aus einem pointerup heraus
    void H;
  }
}
