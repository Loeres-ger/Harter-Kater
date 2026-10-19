import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { H, W, txt } from '../ui';
import { Btn } from '../scenes/ShopScene';

export interface StallData {
  /** pausierte Szene, die nach dem Verlassen weiterläuft */
  resume: string;
  /** wird nach dem Verlassen der Kabine aufgerufen */
  onLeave?: () => void;
}

const BAR_H = 22;
/** das Loch in der Trennwand (Bildschirmkoordinaten der Kulisse csKabine) */
const HOLE: [number, number] = [350, 95];

/**
 * Kabine 2 der Herrentoilette in Seitenansicht. In der Trennwand ist ein Loch.
 * Klopft der Wirt dagegen, wird es nebenan sehr laut. Was dort passiert, bleibt offen.
 * Bedienung: Buttons (Maus/Touch), E/Leertaste = Loch, ESC = Kabine verlassen.
 */
export class StallScene extends Phaser.Scene {
  private cfg!: StallData;
  private busy = false;
  private closing = false;
  private wasRunning = false;
  private line!: Phaser.GameObjects.Text;
  private lineBox!: Phaser.GameObjects.Rectangle;
  private holeBtn!: Btn;
  private leaveBtn!: Btn;
  private ring!: Phaser.GameObjects.Arc;

  constructor() {
    super('Kabine');
  }

  create(data: StallData) {
    this.cfg = data;
    this.busy = this.closing = false;
    this.wasRunning = state.running;
    state.running = false;

    this.add.image(0, 0, 'csKabine').setOrigin(0);
    const tube = this.add.image(240, 8, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2.5, 1).setTint(0xd0f0d0).setAlpha(0.35);
    this.time.addEvent({ delay: 130, loop: true, callback: () => tube.setAlpha(Math.random() < 0.1 ? 0.05 : 0.35) });

    // Das Loch: dunkel, rund, leicht ausgefranst. Ein Ring pulsiert, solange man es noch nicht angetippt hat.
    const [hx, hy] = HOLE;
    this.add.circle(hx, hy, 9, 0x2a3a2a);
    this.add.circle(hx, hy, 7, 0x050505);
    this.ring = this.add.circle(hx, hy, 12).setStrokeStyle(1, 0xf8e070).setAlpha(0);
    if (!state.flags.kevinLoch) this.tweens.add({ targets: this.ring, alpha: 0.8, scale: 1.3, duration: 700, yoyo: true, repeat: -1 });
    const hint = txt(this, hx, hy - 24, state.flags.kevinLoch ? '' : 'LOCH IN DER WAND', '#f8e070').setOrigin(0.5).setStroke('#120c0b', 3);
    const spot = this.add.circle(hx, hy, 16, 0x000000, 0).setInteractive({ useHandCursor: true });
    spot.on('pointerup', () => this.tapHole());

    // Der Wirt sitzt links im Bild
    this.add.image(76, 184, 'bustWirt').setOrigin(0.5, 1);

    // Kinobalken, Textzeile, Buttons
    this.add.rectangle(0, 0, W, BAR_H, 0x000000).setOrigin(0).setDepth(900);
    this.add.rectangle(0, H - BAR_H, W, BAR_H, 0x000000).setOrigin(0).setDepth(900);
    this.lineBox = this.add.rectangle(8, 186, W - 16, 30, 0x120c0b, 0.92).setOrigin(0).setStrokeStyle(2, 0x8a6a3a).setDepth(800);
    this.line = txt(this, 16, 194, '', '#f4ead0').setDepth(801).setWordWrapWidth(W - 40);
    this.holeBtn = new Btn(this, W / 2 - 80, H - 11, 140, 14, '[E] LOCH ANTIPPEN', 0x6a5020, () => this.tapHole());
    this.leaveBtn = new Btn(this, W / 2 + 80, H - 11, 140, 14, '[ESC] RAUSGEHEN', 0x3a3040, () => this.leave());
    this.holeBtn.box.setDepth(901);
    this.leaveBtn.box.setDepth(901);
    if (state.flags.kevinLoch) this.holeBtn.setEnabled(false);
    this.events.once('hole-done', () => hint.destroy());

    const kb = this.input.keyboard!;
    kb.on('keydown-E', () => this.tapHole());
    kb.on('keydown-SPACE', () => this.tapHole());
    kb.on('keydown-ESC', () => this.leave());

    this.cameras.main.fadeIn(250);
    this.say('(Endlich. Fünf Minuten Ruhe vor allen Irren dieser Kneipe.)');
  }

  private say(s: string) {
    this.line.setText(s).setAlpha(0);
    this.tweens.add({ targets: this.line, alpha: 1, duration: 200 });
  }

  /** Klopfen, Lärm von nebenan, Reaktion, Schwarzblende. Läuft einmal. */
  private tapHole() {
    if (this.busy || this.closing) return;
    if (state.flags.kevinLoch) return this.say('(Nein. Einmal reicht. Für dieses Leben.)');
    state.flags.kevinLoch = true;
    this.busy = true;
    this.holeBtn.setEnabled(false);
    this.leaveBtn.setEnabled(false);
    this.tweens.killTweensOf(this.ring);
    this.ring.setAlpha(0);
    this.events.emit('hole-done');
    this.say('(Was ist denn das für ein Loch?)');

    const [hx, hy] = HOLE;
    const cam = this.cameras.main;
    // Die Faust des Wirts klopft zweimal neben das Loch
    const fist = this.add.image(hx - 70, H + 40, 'fist').setScale(0.5).setAngle(-20).setDepth(700);
    this.tweens.add({ targets: fist, x: hx - 22, y: hy + 20, duration: 300, ease: 'Quad.easeOut' });
    for (const t of [420, 700]) {
      this.time.delayedCall(t, () => {
        this.tweens.add({ targets: fist, x: fist.x + 7, duration: 60, yoyo: true });
        audio.sfx('thud');
        cam.shake(80, 0.004);
      });
    }
    this.time.delayedCall(1000, () => this.tweens.add({ targets: fist, x: hx - 90, y: H + 60, duration: 300, ease: 'Quad.easeIn', onComplete: () => fist.destroy() }));

    // Stille. Dann bricht nebenan das Chaos los.
    const wow = txt(this, hx + 50, hy - 30, '', '#ffffff', 16).setOrigin(0.5).setStroke('#120c0b', 4).setDepth(700);
    const chaos: [number, () => void][] = [
      [1700, () => { wow.setText('?!'); audio.sfx('clang'); cam.shake(150, 0.008); }],
      [2000, () => { audio.sfx('thud'); cam.shake(200, 0.012); }],
      [2250, () => { wow.setText('!!'); audio.sfx('rummage'); }],
      [2600, () => { audio.sfx('thud'); audio.sfx('clang'); cam.shake(250, 0.014); }],
      [2950, () => { wow.setText('?!?!'); audio.sfx('rummage'); }],
      [3300, () => { audio.sfx('splash'); wow.setText(''); }],
    ];
    for (const [t, fn] of chaos) this.time.delayedCall(t, fn);
    this.time.delayedCall(4000, () => this.say('(...)'));
    this.time.delayedCall(5200, () => this.say('(Ich hab nichts gehört. Ich hab nichts gesehen. Ich war nie hier.)'));
    // Schwarzblende
    this.time.delayedCall(7200, () => {
      cam.fadeOut(450, 0, 0, 0);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        wow.destroy();
        this.time.delayedCall(700, () => {
          cam.fadeIn(450);
          this.say('(Zeit, hier rauszukommen.)');
          this.busy = false;
          this.leaveBtn.setEnabled(true);
        });
      });
    });
  }

  private leave() {
    if (this.busy || this.closing) return;
    this.closing = true;
    audio.sfx('click');
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      state.running = this.wasRunning;
      this.scene.resume(this.cfg.resume);
      this.scene.stop();
      this.cfg.onLeave?.();
    });
  }
}
