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
import { Btn } from './ShopScene';
import { bigTitle, drawRain, hGradient, kalleAtTable, vGradient } from './screenFx';

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
    // Alle Grafiken werden hier einmalig gemalt. Jede Gruppe ist einzeln abgesichert: Scheitert eine
    // (z. B. auf einem exotischen Handy-Browser), laufen die anderen trotzdem und die Konsole sagt, welche.
    const groups: [string, () => void][] = [
      ['Grundgrafiken', () => { if (!this.textures.exists('wirt')) makeAllTextures(this); }],
      ['Spielautomaten', () => makeCasinoTextures(this)],
      ['Stammgäste', () => makeGuestTextures(this)],
      ['Außenwelt', () => makeWorldTextures(this)],
      ['Leonard', () => { if (!this.textures.exists('leonard')) makeLeonardTextures(this); }],
      ['Achievement-Symbole', () => { if (!this.textures.exists('ach_lock')) makeAchievementIcons(this); }],
      ['Dachboden und Toiletten', () => makeRoomTextures(this)],
      ['Feinkostladen', () => makeLadenTextures(this)],
      ['Anne', () => makeAnneTextures(this)],
    ];
    for (const [name, make] of groups) {
      try {
        make();
      } catch (err) {
        console.error(`[Harter Karter] Grafiken „${name}“ konnten nicht erzeugt werden:`, err);
      }
    }
    // Achievement-Einblendungen laufen dauerhaft über allen Szenen
    if (!this.scene.isActive('Notify')) this.scene.launch('Notify');
    showLegalLinks(true);
    audio.music('title');
    // Audio darf erst nach einer Nutzeraktion starten
    this.input.once('pointerdown', () => audio.unlock());
    this.input.keyboard!.once('keydown', () => audio.unlock());
    this.cameras.main.setBackgroundColor('#0d0b0a').fadeIn(400);

    // ---------------------------------------------------------------- Kulisse: die Kneipe bei Nacht
    this.add.image(0, 0, 'tresenBg').setOrigin(0).setTint(0x8a7a9a);
    this.add.rectangle(0, 200, W, 70, 0x120a08).setOrigin(0);
    // Regen am Fenster, draußen glühen zwei Katzenaugen
    const rain = this.add.graphics().setDepth(1);
    const eyes = [this.add.rectangle(64, 104, 2, 1, 0x9aff60), this.add.rectangle(70, 104, 2, 1, 0x9aff60)];
    eyes.forEach((e) => e.setDepth(1));
    this.time.addEvent({ delay: 2600, loop: true, callback: () => { eyes.forEach((e) => e.setVisible(false)); this.time.delayedCall(140, () => eyes.forEach((e) => e.setVisible(true))); } });
    const onUpdate = (t: number) => drawRain(rain, t, 28, 32, 96, 80);
    this.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));

    // Hängelampe über Kalles Tisch mit Lichtkegel und tanzendem Staub
    const KX = 392, TY = 204;
    const lamp = this.add.graphics().setDepth(20);
    lamp.fillStyle(0x1a1410).fillRect(KX - 1, 0, 2, 22);
    lamp.fillStyle(0x2a3a2a).fillTriangle(KX - 16, 32, KX + 16, 32, KX, 20);
    lamp.fillStyle(0xfff0b0).fillRect(KX - 4, 31, 8, 3);
    const cone = this.add.image(KX, 120, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2.2, 3.4).setTint(0xffc870).setAlpha(0.35).setDepth(15);
    this.tweens.add({ targets: cone, alpha: 0.27, duration: 120, yoyo: true, repeat: -1, repeatDelay: 2600 });
    this.add.particles(0, 0, 'light', {
      x: { min: KX - 60, max: KX + 60 }, y: { min: 40, max: 190 }, lifespan: 4000, speedX: { min: -3, max: 3 }, speedY: { min: -2, max: 2 },
      scale: { start: 0.015, end: 0.03 }, alpha: { start: 0.5, end: 0 }, tint: 0xffe0a0, frequency: 120, blendMode: 'ADD',
    }).setDepth(16);

    // Kalle pennt am Tisch
    kalleAtTable(this, KX, TY, { depth: 10 });

    // dunkler Verlauf links (Platz für Schrift), dunkle Ränder oben und unten
    hGradient(this, 0, 300, 0, H, 0x0a0608, 0.94, 0, 30);
    vGradient(this, 0, W, 0, 30, 0x000000, 0.7, 0, 30);
    vGradient(this, 0, W, 210, H, 0x000000, 0, 0.85, 30);

    // ---------------------------------------------------------------- Schrift und Menü
    const LX = 26;
    const tag = txt(this, LX, 30, 'KNEIPE.  PLAN.  KATZE.', '#c9a24a', 8).setDepth(40).setAlpha(0);
    const title = bigTitle(this, LX, 46, ['HARTER', 'KARTER'], 32).setDepth(40).setAlpha(0);
    const sub = txt(this, LX, 132, 'Ein Spiel über Gastfreundschaft.', '#b8a888', 8).setDepth(40).setAlpha(0);
    const line = this.add.rectangle(LX, 148, 0, 1, 0xc9a24a).setOrigin(0).setDepth(40);
    const blurb = txt(this, LX, 156, `Du bist der Wirt.\nMach ${VICTIM} zum Wrack.\nDie Katze hat Hunger.`,'#8a7a6a', 8).setDepth(40).setAlpha(0);
    // Glühen hinter dem Titel, ab und zu flackert der Schriftzug wie eine Neonröhre
    const glow = this.add.image(LX + 100, 82, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2.4, 1.2).setTint(0xff9a30).setAlpha(0).setDepth(39);
    this.tweens.add({ targets: [tag, sub, blurb], alpha: 1, duration: 600, delay: 500 });
    this.tweens.add({ targets: title, alpha: 1, x: { from: LX - 12, to: LX }, duration: 700, ease: 'Cubic.easeOut', delay: 150 });
    this.tweens.add({ targets: line, width: 150, duration: 700, delay: 700, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: glow, alpha: 0.28, duration: 900, delay: 400 });
    this.time.addEvent({
      delay: 3800, loop: true,
      callback: () => {
        title.setAlpha(0.55);
        this.time.delayedCall(60, () => title.setAlpha(1));
        this.time.delayedCall(140, () => title.setAlpha(0.7));
        this.time.delayedCall(200, () => title.setAlpha(1));
      },
    });

    const mobile = isTouchDevice(this);
    let started = false;
    const go = () => {
      if (started || this.scene.isActive('Achievements')) return;
      started = true;
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
      this.cameras.main.flash(250, 255, 220, 160);
      newGame(this);
    };
    const openAch = () => {
      if (started || this.scene.isActive('Achievements')) return;
      audio.unlock();
      this.scene.launch('Achievements');
    };
    const startBtn = new Btn(this, LX + 75, 208, 150, 22, mobile ? 'ZUM STARTEN TIPPEN' : 'SPIEL STARTEN', 0xa8342a, go);
    const achBtn = new Btn(this, LX + 75, 233, 150, 16, 'ACHIEVEMENTS', 0x3a3040, openAch);
    for (const b of [startBtn, achBtn]) b.box.setDepth(41).setAlpha(0);
    this.tweens.add({ targets: [startBtn.box, achBtn.box], alpha: 1, duration: 500, delay: 900 });
    this.tweens.add({ targets: startBtn.box, scale: 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 1400 });
    txt(this, LX, 253, mobile ? 'Joystick: laufen   E: benutzen' : 'WASD: laufen   E: benutzen   Enter: Start', '#5a4a3a', 8).setDepth(40);

    // feine Scanlines über allem: Röhrenfernseher-Look
    const scan = this.add.graphics().setDepth(60);
    for (let y = 0; y < H; y += 2) scan.fillStyle(0x000000, 0.12).fillRect(0, y, W, 1);

    this.input.keyboard!.on('keydown-SPACE', go);
    this.input.keyboard!.on('keydown-ENTER', go);
    void H;
  }
}
