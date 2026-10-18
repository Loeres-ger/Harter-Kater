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
/** Treffer, die schneller als das aufeinander folgen, zählen als Combo */
const COMBO_GAP = 350;
const HIT_WORDS = ['BAM!', 'POW!', 'WUMMS!', 'KLATSCH!', 'ZACK!', 'BÄM!'];
const KALLE_CHEERS = ['Hau rein, Chef!', 'Auf die Zwölf!', 'Links! LINKS!', 'Gib ihm Saures!'];

// Gegner-Container: Brustbild steht mit den Füßen auf FOE_Y; lokale Koordinaten = (Bildpixel − Mitte) × 2
const FOE_X = W / 2, FOE_Y = 262;
const HEAD = { x: 0, y: -150 };
const FIST_HOME: [number, number][] = [[110, H + 44], [370, H + 44]];

/** Kneipenschlägerei: so schnell wie möglich tippen/klicken. */
export class FightScene extends Phaser.Scene {
  private cfg!: FightData;
  private g!: GuestDef;
  private foeC!: Phaser.GameObjects.Container;
  private foe!: Phaser.GameObjects.Image;
  private idle?: Phaser.Tweens.Tween;
  private fists: Phaser.GameObjects.Image[] = [];
  private hp = PLAYER_HP;
  private hits = 0;
  private taps: number[] = [];
  private nextFist = 0;
  private combo = 0;
  private lastHit = 0;
  private over = false;
  private winding = false;
  private wasRunning = false;
  private foeBar!: Phaser.GameObjects.Graphics;
  private hpBar!: Phaser.GameObjects.Graphics;
  private vignette!: Phaser.GameObjects.Image;
  private comboT!: Phaser.GameObjects.Text;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sweat!: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private injuries: { at: number; img: Phaser.GameObjects.Image }[] = [];
  private dizzy: Phaser.GameObjects.Image[] = [];
  private attackTimer?: Phaser.Time.TimerEvent;

  constructor() {
    super('Fight');
  }

  create(data: FightData) {
    this.cfg = data;
    this.g = guestById(data.guestId);
    this.hp = PLAYER_HP;
    this.hits = this.combo = this.lastHit = 0;
    this.taps = [];
    this.over = this.winding = false;
    this.fists = [];
    this.injuries = [];
    this.dizzy = [];
    this.wasRunning = state.running;
    state.running = false;

    // ---------------------------------------------------------------- Kulisse
    this.add.image(0, 0, 'tresenBg').setOrigin(0);
    // Kalle feuert im Hintergrund an
    const kalle = this.add.image(432, 210, 'bustPenner').setOrigin(0.5, 1).setScale(0.5);
    this.tweens.add({ targets: kalle, y: 202, duration: 220, yoyo: true, repeat: -1, ease: 'Quad.easeOut' });
    this.time.addEvent({ delay: 2600, loop: true, callback: () => !this.over && floatText(this, 432, 112, Phaser.Utils.Array.GetRandom(KALLE_CHEERS), '#f8e070') });
    this.add.image(0, 186, 'counterFront').setOrigin(0);
    this.add.rectangle(0, 0, W, H, 0x000000, 0.4).setOrigin(0);
    this.add.image(FOE_X, 100, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2.6).setAlpha(0.4); // Spot auf den Gegner

    // ---------------------------------------------------------------- Gegner + Verletzungen
    this.foe = this.add.image(0, 0, `gbust_${this.g.id}`).setOrigin(0.5, 1).setScale(1);
    this.foeC = this.add.container(FOE_X, FOE_Y, [this.foe]);
    const injury = (at: number, key: string, x: number, y: number, angle = 0) => {
      const img = this.add.image(x, y, key).setScale(1).setAngle(angle).setAlpha(0);
      this.foeC.add(img);
      this.injuries.push({ at, img });
    };
    injury(0.35, 'bruise', -10, -140); // blaues Auge
    injury(0.6, 'bandaid', 8, -160, -18); // Pflaster auf der Stirn
    injury(0.8, 'bruise', 16, -128); // geschwollene Wange
    this.startIdle();

    // Partikel: Funken, Schweiß, Staub
    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 80, max: 220 }, lifespan: 380, scale: { start: 1.6, end: 0 }, gravityY: 300, emitting: false,
      tint: [0xffffff, 0xfff4a0, 0xffb040],
    }).setDepth(25);
    this.sweat = this.add.particles(0, 0, 'sweat', {
      speed: { min: 60, max: 140 }, angle: { min: 200, max: 340 }, gravityY: 500, lifespan: 700, scale: 2, emitting: false,
    }).setDepth(24);
    this.dust = this.add.particles(0, 0, 'dust', {
      speed: { min: 30, max: 120 }, angle: { min: 180, max: 360 }, lifespan: 900, scale: { start: 2.5, end: 0 }, alpha: { start: 0.8, end: 0 }, emitting: false,
    }).setDepth(26);

    // ---------------------------------------------------------------- Fäuste + Anzeigen
    FIST_HOME.forEach(([x, y], i) => this.fists.push(this.add.image(x, y, 'fist').setOrigin(0.5, 1).setScale(1).setFlipX(i === 1).setDepth(20)));
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(28).setAlpha(0);

    this.add.rectangle(W / 2, 14, 236, 30, 0x120c0b, 0.85).setOrigin(0.5, 0).setStrokeStyle(1, 0xc04040).setDepth(30);
    txt(this, W / 2, 18, this.g.name.toUpperCase(), '#ff8a7a').setOrigin(0.5, 0).setDepth(31);
    this.foeBar = this.add.graphics().setDepth(31);
    this.add.rectangle(12, H - 30, 150, 22, 0x120c0b, 0.85).setOrigin(0).setStrokeStyle(1, 0xf0c030).setDepth(30);
    txt(this, 18, H - 26, 'WIRT', '#f0c030').setDepth(31);
    this.hpBar = this.add.graphics().setDepth(31);
    this.comboT = txt(this, 70, 96, '', '#f8e070', 16).setOrigin(0.5).setDepth(32).setStroke('#000000', 5).setAlign('center');
    this.drawBars();

    const hint = txt(this, W / 2, H - 22, 'TIPPEN! TIPPEN! TIPPEN!', '#ffffff').setOrigin(0.5).setDepth(31).setStroke('#000000', 4);
    this.tweens.add({ targets: hint, alpha: 0.2, duration: 250, yoyo: true, repeat: -1 });

    // ---------------------------------------------------------------- Intro: Kamera-Ruck + „KAMPF!“
    const cam = this.cameras.main;
    cam.setZoom(1.25);
    cam.zoomTo(1, 450, 'Back.easeOut');
    cam.flash(250, 255, 60, 60);
    cam.shake(250, 0.01);
    audio.sfx('angry');
    this.say(Phaser.Utils.Array.GetRandom(this.g.fight));
    this.slam('KAMPF!', '#ff4040', 24, W / 2, H / 2 - 20, 900);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.hit(p.x, p.y));
    this.input.keyboard!.on('keydown-SPACE', () => this.hit(FOE_X + Phaser.Math.Between(-40, 40), 120 + Phaser.Math.Between(-30, 30)));
    this.time.delayedCall(1100, () => this.scheduleAttack());
  }

  // ---------------------------------------------------------------- Bausteine

  private startIdle() {
    this.idle?.stop();
    this.foeC.setScale(1).setAngle(0).setPosition(FOE_X, FOE_Y);
    // nervöses Wippen wie ein Boxer
    this.idle = this.tweens.add({ targets: this.foeC, y: FOE_Y - 5, angle: { from: -1.5, to: 1.5 }, duration: 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private drawBars() {
    const left = Math.max(0, this.g.hits - this.hits);
    this.foeBar.clear().fillStyle(0x2a1010).fillRect(W / 2 - 110, 30, 220, 8);
    this.foeBar.fillStyle(left / this.g.hits > 0.3 ? 0xe04040 : 0xff8020).fillRect(W / 2 - 110, 30, Math.round((220 * left) / this.g.hits), 8);
    this.hpBar.clear().fillStyle(0x2a2010).fillRect(56, H - 24, 98, 10);
    this.hpBar.fillStyle(this.hp > 30 ? 0x6ad06a : 0xe0a030).fillRect(56, H - 24, Math.round((98 * this.hp) / PLAYER_HP), 10);
    // je weniger Leben, desto röter der Rand
    if (!this.winding) this.vignette.setAlpha((1 - this.hp / PLAYER_HP) * 0.55);
  }

  private say(s: string) {
    // rechts neben dem Kopf, umbrechend, damit nichts aus dem Bild läuft
    const t = txt(this, FOE_X + 62, 100, s, '#1a1212').setOrigin(0, 1).setDepth(35).setBackgroundColor('#f4f0e4').setPadding(6, 4, 6, 4).setWordWrapWidth(150);
    this.tweens.add({ targets: t, alpha: 0, delay: 1800, duration: 300, onComplete: () => t.destroy() });
  }

  /** Großer Comic-Schriftzug mit Zacken-Explosion dahinter. */
  private slam(s: string, color: string, size: number, x: number, y: number, hold: number, burstScale = 2.4) {
    const b = this.add.image(x, y, 'burst').setDepth(39).setScale(0).setAngle(Phaser.Math.Between(-20, 20));
    const t = txt(this, x, y, s, color, size).setOrigin(0.5).setDepth(40).setStroke('#000000', 6).setScale(2).setAlpha(0).setAlign('center');
    this.tweens.add({ targets: b, scale: burstScale, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    if (hold > 0) this.tweens.add({ targets: [b, t], alpha: 0, delay: hold, duration: 250, onComplete: () => { b.destroy(); t.destroy(); } });
    return { b, t };
  }

  // ---------------------------------------------------------------- Zuschlagen

  private hit(x: number, y: number) {
    if (this.over) return;
    const now = this.time.now;
    this.hits++;
    this.taps.push(now);
    this.combo = now - this.lastHit < COMBO_GAP ? this.combo + 1 : 1;
    this.lastHit = now;

    // Faust schlägt gezielt in Richtung Treffpunkt und kommt nach vorne
    const i = this.nextFist;
    this.nextFist = 1 - i;
    const f = this.fists[i];
    const [hx, hy] = FIST_HOME[i];
    this.tweens.killTweensOf(f);
    f.setPosition(hx, hy).setScale(1).setAngle(0);
    // nur bis zum Kinn: die Faust soll das Gesicht nicht verdecken
    const tx = Phaser.Math.Linear(hx, x, 0.55), ty = Math.max(232, y + 130);
    this.tweens.add({ targets: f, x: tx, y: ty, scale: 1.125, angle: i ? -12 : 12, duration: 65, yoyo: true, ease: 'Quad.easeOut', onComplete: () => f.setPosition(hx, hy).setScale(1).setAngle(0) });

    // Einschlag: Explosion, Wort, Funken
    const b = this.add.image(x, y, 'burst').setDepth(22).setScale(0.3).setAngle(Phaser.Math.Between(0, 360));
    this.tweens.add({ targets: b, scale: 0.9 + Math.random() * 0.4, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => b.destroy() });
    const word = txt(this, x, y, Phaser.Utils.Array.GetRandom(HIT_WORDS), Phaser.Utils.Array.GetRandom(['#ffffff', '#fff4a0', '#ffd060']), 8)
      .setOrigin(0.5).setDepth(23).setStroke('#120c0b', 4).setAngle(Phaser.Math.Between(-15, 15)).setScale(1.8);
    this.tweens.add({ targets: word, scale: 1, y: y - 18, alpha: 0, delay: 120, duration: 380, onComplete: () => word.destroy() });
    this.sparks.explode(6, x, y);
    if (Math.random() < 0.3) this.sweat.explode(3, this.foeC.x + HEAD.x, this.foeC.y + HEAD.y);
    audio.sfx(this.hits % 3 ? 'slap' : 'thud');
    this.cameras.main.shake(40, 0.003);

    // Gegner reagiert: kippt vom Treffer weg, gestaucht, rot
    if (!this.winding) {
      const side = x < this.foeC.x ? 1 : -1;
      this.idle?.pause();
      this.tweens.killTweensOf(this.foeC);
      this.foeC.setPosition(FOE_X + side * 8, FOE_Y).setAngle(side * 6).setScale(1.06, 0.94);
      this.foe.setTint(0xff9a8a);
      this.tweens.add({
        targets: this.foeC, x: FOE_X, angle: 0, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.easeOut',
        onComplete: () => {
          if (this.over || this.winding) return;
          this.foe.clearTint();
          this.startIdle();
        },
      });
    }

    // Combo-Anzeige ab 5 schnellen Treffern
    if (this.combo >= 5) {
      this.comboT.setText(`${this.combo}x\nCOMBO`).setAlpha(1).setScale(1.4);
      this.tweens.killTweensOf(this.comboT);
      this.tweens.add({ targets: this.comboT, scale: 1, duration: 120, ease: 'Back.easeOut' });
      this.tweens.add({ targets: this.comboT, alpha: 0, delay: 600, duration: 300 });
    }

    this.updateInjuries();
    this.drawBars();
    if (this.hits >= this.g.hits) this.win();
  }

  /** Verletzungen nach Fortschritt einblenden, am Ende torkelt er mit Sternen. */
  private updateInjuries() {
    const prog = this.hits / this.g.hits;
    for (const inj of this.injuries) {
      if (prog >= inj.at && inj.img.alpha === 0) {
        inj.img.setAlpha(1).setScale(1.5);
        this.tweens.add({ targets: inj.img, scale: 1, duration: 160, ease: 'Back.easeOut' });
      }
    }
    if (prog >= 0.85 && !this.dizzy.length) {
      for (let k = 0; k < 3; k++) {
        const s = this.add.image(0, 0, 'star').setScale(2);
        this.foeC.add(s);
        this.dizzy.push(s);
        this.tweens.addCounter({
          from: 0, to: 360, duration: 900, repeat: -1,
          onUpdate: (tw) => {
            const a = Phaser.Math.DegToRad((tw.getValue() ?? 0) + k * 120);
            s.setPosition(HEAD.x + Math.cos(a) * 34, HEAD.y - 34 + Math.sin(a) * 8);
          },
        });
      }
    }
  }

  // ---------------------------------------------------------------- Gegenangriff

  private scheduleAttack() {
    if (this.over) return;
    const delay = this.g.attackEvery * (0.75 + Math.random() * 0.5);
    this.attackTimer = this.time.delayedCall(delay, () => this.windUp());
  }

  /** Ausholen (zurückziehen, rot pulsieren, Rand glüht), dann nach vorne springen. */
  private windUp() {
    if (this.over) return;
    this.winding = true;
    this.idle?.pause();
    this.tweens.killTweensOf(this.foeC);
    this.foe.setTint(0xff5050);
    const warn = txt(this, FOE_X, FOE_Y + HEAD.y - 70, '!', '#ff2020', 24).setOrigin(0.5).setDepth(36).setStroke('#000000', 6);
    this.tweens.add({ targets: warn, y: warn.y - 8, duration: 110, yoyo: true, repeat: 1 });
    this.tweens.add({ targets: this.foeC, scale: 0.9, y: FOE_Y + 6, angle: -4, duration: 380, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: this.vignette, alpha: 0.6, duration: 380 });
    this.time.delayedCall(420, () => {
      warn.destroy();
      if (this.over) return;
      // Ausfallschritt Richtung Kamera
      this.tweens.add({ targets: this.foeC, scale: 1.28, y: FOE_Y + 34, angle: 3, duration: 90, yoyo: true, hold: 60, ease: 'Quad.easeIn', onComplete: () => {
        this.winding = false;
        if (this.over) return;
        this.foe.clearTint();
        this.startIdle();
        this.drawBars();
      } });
      this.time.delayedCall(90, () => this.strike());
    });
  }

  private strike() {
    if (this.over) return;
    const now = this.time.now;
    const recent = this.taps.filter((t) => now - t < BLOCK_WINDOW).length;
    this.taps = this.taps.filter((t) => now - t < 2000);
    if (recent >= BLOCK_TAPS) {
      // Block: blauer Schild-Blitz und Funken
      const ring = this.add.circle(W / 2, 170, 20).setStrokeStyle(4, 0x80d0ff).setDepth(27);
      this.tweens.add({ targets: ring, radius: 120, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
      this.sparks.explode(14, W / 2, 170);
      floatText(this, W / 2, 150, 'GEBLOCKT!', '#9ae0ff');
      audio.sfx('clang');
      this.fists.forEach((f, i) => this.tweens.add({ targets: f, y: FIST_HOME[i][1] - 40, duration: 80, yoyo: true }));
    } else {
      this.hp = Math.max(0, this.hp - this.g.damage);
      this.cameras.main.shake(260, 0.02);
      this.vignette.setAlpha(1);
      this.tweens.add({ targets: this.vignette, alpha: (1 - this.hp / PLAYER_HP) * 0.55, duration: 450 });
      audio.sfx('thud');
      floatText(this, W / 2, 210, `-${this.g.damage}`, '#ff4040');
      this.fists.forEach((f, i) => this.tweens.add({ targets: f, y: FIST_HOME[i][1] + 30, x: FIST_HOME[i][0] + (i ? 20 : -20), duration: 90, yoyo: true }));
      if (Math.random() < 0.35) this.say(Phaser.Utils.Array.GetRandom(this.g.fight));
      this.combo = 0;
      this.drawBars();
      if (this.hp <= 0) return this.lose();
    }
    this.scheduleAttack();
  }

  // ---------------------------------------------------------------- Ende

  private win() {
    this.over = true;
    this.attackTimer?.remove();
    this.idle?.stop();
    this.tweens.killTweensOf(this.foeC);
    const cam = this.cameras.main;
    // Freeze-Frame: weißer Blitz, kurz Stillstand
    cam.flash(160, 255, 255, 255);
    this.foe.setTint(0xffffff).setTintFill(0xffffff);
    audio.sfx('thud');
    this.time.delayedCall(260, () => {
      this.foe.clearTint().setTint(0xc0b0b0);
      cam.shake(400, 0.02);
      audio.sfx('slap');
      this.slam('K.O.!', '#ffffff', 24, FOE_X, FOE_Y + HEAD.y - 10, 1500, 3);
      // dreht sich weg und kippt nach hinten aus dem Bild
      this.tweens.add({ targets: this.foeC, angle: 80, x: FOE_X + 70, duration: 650, ease: 'Quad.easeIn' });
      this.tweens.add({ targets: this.foeC, y: FOE_Y + 220, delay: 420, duration: 450, ease: 'Quad.easeIn', onComplete: () => this.dust.explode(24, FOE_X + 60, FOE_Y) });
      this.time.delayedCall(700, () => cam.shake(250, 0.015));
    });
    const reward = this.g.reward + Phaser.Math.Between(0, 5);
    state.money += reward;
    this.time.delayedCall(1100, () => {
      audio.sfx('kaching');
      this.slam(`ERLEDIGT!\n+${reward}€`, '#f8e070', 16, W / 2, H / 2 + 10, 0, 3.2);
    });
    this.finish(true, reward, 2900);
  }

  private lose() {
    this.over = true;
    this.attackTimer?.remove();
    const lost = Math.ceil(state.money * 0.25);
    state.money -= lost;
    audio.sfx('gameover');
    const cam = this.cameras.main;
    cam.shake(500, 0.02);
    // Bild kippt und wird rot: der Wirt geht zu Boden
    this.tweens.add({ targets: cam, rotation: 0.18, zoom: 1.12, duration: 700, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.vignette, alpha: 1, duration: 500 });
    this.fists.forEach((f) => this.tweens.add({ targets: f, y: H + 160, duration: 400 }));
    this.slam(`DU BIST K.O.\n${lost ? `-${lost}€` : ''}`, '#ff6a5a', 16, W / 2, H / 2 - 10, 0, 3.2);
    this.finish(false, lost, 2600);
  }

  private finish(won: boolean, amount: number, delay: number) {
    roster.lastFight = { id: this.g.id, won, amount };
    this.time.delayedCall(delay, () => {
      const cam = this.cameras.main;
      cam.fadeOut(250, 0, 0, 0);
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        cam.setRotation(0).setZoom(1);
        state.running = this.wasRunning;
        this.scene.resume(this.cfg.resume);
        this.scene.stop();
      });
    });
  }
}
