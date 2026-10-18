import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { H, W, floatText, txt } from '../ui';
import { GuestDef, guestById } from './data';
import { roster } from './roster';

export interface FightData {
  guestId: string;
  resume: string;
}

const PLAYER_HP = 100;
/** so viele Schläge kurz vor seinem Treffer blocken ihn */
const BLOCK_TAPS = 3;
const BLOCK_WINDOW = 650;
const HITS_WORDS = ['BAM!', 'POW!', 'WUMMS!', 'KLATSCH!', 'ZACK!', 'BÄM!'];

/** Kneipenschlägerei: so schnell wie möglich tippen/klicken. */
export class FightScene extends Phaser.Scene {
  private cfg!: FightData;
  private g!: GuestDef;
  private foe!: Phaser.GameObjects.Image;
  private fists: Phaser.GameObjects.Image[] = [];
  private hp = PLAYER_HP;
  private hits = 0;
  private taps: number[] = [];
  private nextFist = 0;
  private over = false;
  private winding = false;
  private wasRunning = false;
  private foeBar!: Phaser.GameObjects.Graphics;
  private hpBar!: Phaser.GameObjects.Graphics;
  private foeX = W / 2;
  private attackTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('Fight');
  }

  create(data: FightData) {
    this.cfg = data;
    this.g = guestById(data.guestId);
    this.hp = PLAYER_HP;
    this.hits = 0;
    this.taps = [];
    this.over = false;
    this.winding = false;
    this.fists = [];
    this.wasRunning = state.running;
    state.running = false;

    // Kulisse: die Kneipe, leicht abgedunkelt, der Gast steht vor dem Tresen
    this.add.image(0, 0, 'tresenBg').setOrigin(0);
    this.add.image(0, 186, 'counterFront').setOrigin(0);
    this.add.rectangle(0, 0, W, H, 0x000000, 0.35).setOrigin(0);
    this.add.image(W / 2, 90, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2.4).setAlpha(0.35);
    this.foe = this.add.image(this.foeX, 262, `gbust_${this.g.id}`).setOrigin(0.5, 1).setScale(2);
    this.tweens.add({ targets: this.foe, y: 258, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Fäuste des Wirts
    for (const [x, flip] of [[110, false], [370, true]] as const) {
      const f = this.add.image(x, H + 44, 'fist').setOrigin(0.5, 1).setScale(2).setFlipX(flip).setDepth(20);
      this.fists.push(f);
    }

    // Anzeigen
    this.add.rectangle(W / 2, 14, 236, 30, 0x120c0b, 0.85).setOrigin(0.5, 0).setStrokeStyle(1, 0xc04040).setDepth(30);
    txt(this, W / 2, 18, this.g.name.toUpperCase(), '#ff8a7a').setOrigin(0.5, 0).setDepth(31);
    this.foeBar = this.add.graphics().setDepth(31);
    this.add.rectangle(12, H - 30, 150, 22, 0x120c0b, 0.85).setOrigin(0).setStrokeStyle(1, 0xf0c030).setDepth(30);
    txt(this, 18, H - 26, 'WIRT', '#f0c030').setDepth(31);
    this.hpBar = this.add.graphics().setDepth(31);
    this.drawBars();

    const hint = txt(this, W / 2, H - 22, 'TIPPEN! TIPPEN! TIPPEN!', '#ffffff').setOrigin(0.5).setDepth(31).setStroke('#000000', 4);
    this.tweens.add({ targets: hint, alpha: 0.2, duration: 250, yoyo: true, repeat: -1 });

    // Kampfbeginn
    this.cameras.main.flash(250, 255, 60, 60);
    this.cameras.main.shake(250, 0.01);
    audio.sfx('angry');
    this.say(Phaser.Utils.Array.GetRandom(this.g.fight));
    const ready = txt(this, W / 2, H / 2 - 20, 'KAMPF!', '#ff4040', 24).setOrigin(0.5).setDepth(40).setStroke('#000000', 6).setScale(2).setAlpha(0);
    this.tweens.add({ targets: ready, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut', yoyo: true, hold: 500, onComplete: () => ready.destroy() });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.hit(p.x, p.y));
    this.input.keyboard!.on('keydown-SPACE', () => this.hit(this.foeX + Phaser.Math.Between(-40, 40), 120 + Phaser.Math.Between(-30, 30)));
    this.time.delayedCall(1100, () => this.scheduleAttack());
  }

  private drawBars() {
    const left = Math.max(0, this.g.hits - this.hits);
    this.foeBar.clear().fillStyle(0x2a1010).fillRect(W / 2 - 110, 30, 220, 8);
    this.foeBar.fillStyle(0xe04040).fillRect(W / 2 - 110, 30, Math.round((220 * left) / this.g.hits), 8);
    this.hpBar.clear().fillStyle(0x2a2010).fillRect(56, H - 24, 98, 10);
    this.hpBar.fillStyle(this.hp > 30 ? 0x6ad06a : 0xe0a030).fillRect(56, H - 24, Math.round((98 * this.hp) / PLAYER_HP), 10);
  }

  private say(s: string) {
    // rechts neben dem Kopf, umbrechend, damit nichts aus dem Bild läuft
    const t = txt(this, this.foeX + 62, 100, s, '#1a1212').setOrigin(0, 1).setDepth(35).setBackgroundColor('#f4f0e4').setPadding(6, 4, 6, 4).setWordWrapWidth(150);
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 300, onComplete: () => t.destroy() });
  }

  private hit(x: number, y: number) {
    if (this.over) return;
    this.hits++;
    this.taps.push(this.time.now);
    // abwechselnd links/rechts zuschlagen
    const f = this.fists[this.nextFist];
    const home = this.nextFist === 0 ? 110 : 370;
    this.nextFist = 1 - this.nextFist;
    this.tweens.killTweensOf(f);
    f.setPosition(home, H + 44);
    this.tweens.add({ targets: f, y: H - 10, x: home + (home < W / 2 ? 40 : -40), duration: 70, yoyo: true, onComplete: () => f.setX(home) });
    // Treffer-Feedback
    floatText(this, x, y, Phaser.Utils.Array.GetRandom(HITS_WORDS), Phaser.Utils.Array.GetRandom(['#ffffff', '#f8e070', '#ff8a6a']));
    audio.sfx(this.hits % 3 ? 'slap' : 'thud');
    if (!this.winding) {
      this.foe.setTint(0xffffff).setTintFill(0xffffff);
      this.time.delayedCall(40, () => !this.winding && !this.over && this.foe.clearTint());
    }
    this.foe.x = this.foeX + Phaser.Math.Between(-6, 6);
    this.time.delayedCall(60, () => !this.over && (this.foe.x = this.foeX));
    this.drawBars();
    if (this.hits >= this.g.hits) this.win();
  }

  private scheduleAttack() {
    if (this.over) return;
    const delay = this.g.attackEvery * (0.75 + Math.random() * 0.5);
    this.attackTimer = this.time.delayedCall(delay, () => this.windUp());
  }

  /** Ausholen (Warnung), dann zuschlagen – wer gerade spammt, blockt. */
  private windUp() {
    if (this.over) return;
    this.winding = true;
    this.foe.setTint(0xff6060);
    const warn = txt(this, this.foeX, 70, '!', '#ff2020', 24).setOrigin(0.5).setDepth(36).setStroke('#000000', 5);
    this.tweens.add({ targets: this.foe, scale: 2.12, duration: 380, yoyo: true });
    this.time.delayedCall(420, () => {
      warn.destroy();
      this.winding = false;
      if (this.over) return;
      this.foe.clearTint();
      const now = this.time.now;
      const recent = this.taps.filter((t) => now - t < BLOCK_WINDOW).length;
      this.taps = this.taps.filter((t) => now - t < 2000);
      if (recent >= BLOCK_TAPS) {
        floatText(this, W / 2, 150, 'GEBLOCKT!', '#9ae09a');
        audio.sfx('click');
      } else {
        this.hp = Math.max(0, this.hp - this.g.damage);
        this.cameras.main.shake(220, 0.018);
        this.cameras.main.flash(160, 255, 0, 0);
        audio.sfx('thud');
        floatText(this, W / 2, 200, `-${this.g.damage}`, '#ff4040');
        if (Math.random() < 0.35) this.say(Phaser.Utils.Array.GetRandom(this.g.fight));
        this.drawBars();
        if (this.hp <= 0) return this.lose();
      }
      this.scheduleAttack();
    });
  }

  private win() {
    this.over = true;
    this.attackTimer?.remove();
    this.tweens.killTweensOf(this.foe);
    this.foe.clearTint().setTint(0xb0b0b0);
    audio.sfx('thud');
    this.cameras.main.shake(300, 0.015);
    // Er kippt um, Sterne kreisen
    this.tweens.add({ targets: this.foe, angle: 24, x: this.foeX + 30, duration: 400, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.foe, y: 480, delay: 380, duration: 500, ease: 'Quad.easeIn' });
    for (let i = 0; i < 4; i++) {
      const s = txt(this, this.foeX, 70, '*', '#f8e070', 16).setOrigin(0.5).setDepth(36);
      this.tweens.addCounter({ from: 0, to: 360, duration: 900, repeat: 1, onUpdate: (tw) => {
        const a = Phaser.Math.DegToRad((tw.getValue() ?? 0) + i * 90);
        s.setPosition(this.foeX + Math.cos(a) * 34, 70 + Math.sin(a) * 10);
      }, onComplete: () => s.destroy() });
    }
    const reward = this.g.reward + Phaser.Math.Between(0, 5);
    state.money += reward;
    this.time.delayedCall(500, () => {
      audio.sfx('kaching');
      this.banner(`ERLEDIGT!\n+${reward}€`, '#f8e070');
    });
    this.finish(true, reward, 2300);
  }

  private lose() {
    this.over = true;
    this.attackTimer?.remove();
    const lost = Math.ceil(state.money * 0.25);
    state.money -= lost;
    audio.sfx('gameover');
    this.cameras.main.shake(500, 0.02);
    const red = this.add.rectangle(0, 0, W, H, 0x600000, 0).setOrigin(0).setDepth(38);
    this.tweens.add({ targets: red, fillAlpha: 0.45, duration: 600 });
    this.fists.forEach((f) => this.tweens.add({ targets: f, y: H + 160, duration: 400 }));
    this.banner(`DU BIST K.O.\n${lost ? `-${lost}€` : ''}`, '#ff6a5a');
    this.finish(false, lost, 2500);
  }

  private banner(s: string, color: string) {
    const t = txt(this, W / 2, H / 2 - 10, s, color, 16).setOrigin(0.5).setDepth(40).setAlign('center').setStroke('#000000', 6).setScale(0.3);
    this.tweens.add({ targets: t, scale: 1, duration: 260, ease: 'Back.easeOut' });
  }

  private finish(won: boolean, amount: number, delay: number) {
    roster.lastFight = { id: this.g.id, won, amount };
    this.time.delayedCall(delay, () => {
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        state.running = this.wasRunning;
        this.scene.resume(this.cfg.resume);
        this.scene.stop();
      });
    });
  }
}
