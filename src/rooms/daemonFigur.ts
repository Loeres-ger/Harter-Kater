import Phaser from 'phaser';
import { DAUGEN_ZU, DF, DKOPF, DSPANN, FL_H, FL_PX, FL_PY, FL_W } from './daemonGfx';

// Der Dämon als bewegliche Figur: Körper in Posen, zwei Flügel als eigene Teile (schlagen, spannen sich beim Brüllen),
// glühende Augen und ein pulsierendes Pentagramm auf der Brust. Ursprung unten Mitte (Hüfte). s = Bildpixel je Kunstpixel.
// Wird in der Verwandlung im Keller und im Endkampf benutzt.

export class DaemonFigur {
  readonly c: Phaser.GameObjects.Container;
  private koerper: Phaser.GameObjects.Image;
  private fl: Phaser.GameObjects.Image;
  private fr: Phaser.GameObjects.Image;
  private augen: Phaser.GameObjects.Image[];
  private brust: Phaser.GameObjects.Image;
  private s: number;
  private spann = 0.7;
  private zielSpann = 0.7;
  private zeit = Math.random() * 1000;
  /** zusätzlicher Flügelschlag (Brüllen, Abheben) */
  private schlag = 0;
  pose = 'idle';

  constructor(scene: Phaser.Scene, x: number, y: number, s: number, depth = 0) {
    this.s = s;
    const k = s / 2; // Texturen in doppelter Auflösung
    this.c = scene.add.container(x, y).setDepth(depth);
    // Schultergelenke: Körperbild 200×150, Ursprung unten Mitte, Schultern bei (100 ± 34, 52)
    this.fl = scene.add.image(-34 * s, -98 * s, 'daemonFluegel').setOrigin(FL_PX / FL_W, FL_PY / FL_H).setScale(-k, k);
    this.fr = scene.add.image(34 * s, -98 * s, 'daemonFluegel').setOrigin(FL_PX / FL_W, FL_PY / FL_H).setScale(k);
    this.koerper = scene.add.image(0, 0, 'daemon', DF.idle).setOrigin(0.5, 1).setScale(k);
    this.brust = scene.add.image(0, -70 * s, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff6010).setScale(0.28 * s).setAlpha(0.5);
    this.augen = [-10.5, 10.5].map((dx) => scene.add.image(dx * s, 0, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc030).setScale(0.07 * s).setAlpha(0.9));
    this.c.add([this.fl, this.fr, this.koerper, this.brust, ...this.augen]);
    this.setPose('idle');
  }

  setPose(name: string) {
    this.pose = name;
    this.koerper.setFrame(DF[name]);
    this.zielSpann = DSPANN[name] ?? 0.7;
    const ay = (36 + (DKOPF[name] ?? 0) - 150) * this.s;
    for (const a of this.augen) a.setY(ay).setVisible(!DAUGEN_ZU[name]);
    if (name === 'bruell') this.schlag = 1;
    return this;
  }

  /** jedes Bild aufrufen: atmen, Flügel schlagen, Glut flackern */
  update(delta: number) {
    this.zeit += delta;
    this.spann += (this.zielSpann - this.spann) * Math.min(1, delta / 160);
    this.schlag = Math.max(0, this.schlag - delta / 900);
    const k = this.s / 2;
    const flap = Math.sin(this.zeit / 420) * (0.09 + this.schlag * 0.25);
    const sx = k * (0.45 + this.spann * 0.6), sy = k * (0.7 + this.spann * 0.35);
    this.fr.setScale(sx, sy).setRotation(flap - this.schlag * 0.3);
    // linker Flügel: negativ skaliert, also ums Schultergelenk gespiegelt
    this.fl.setScale(-sx, sy).setRotation(-flap + this.schlag * 0.3);
    this.koerper.setScale(k, k * (1 + Math.sin(this.zeit / 650) * 0.01));
    this.brust.setAlpha(0.35 + 0.25 * Math.sin(this.zeit / 260));
    for (const a of this.augen) a.setAlpha(0.7 + Math.random() * 0.3);
  }

  /** kurz weiß aufblitzen (Treffer) */
  blitz(scene: Phaser.Scene, ms = 90) {
    this.koerper.setTintFill(0xffffff);
    this.fl.setTintFill(0xffd0c0);
    this.fr.setTintFill(0xffd0c0);
    scene.time.delayedCall(ms, () => { this.koerper.clearTint(); this.fl.clearTint(); this.fr.clearTint(); });
  }

  /** Flügel weit aufschlagen (Abheben, Phasenwechsel) */
  aufschlag() {
    this.schlag = 1;
  }

  destroy() {
    this.c.destroy();
  }
}
