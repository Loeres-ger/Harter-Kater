import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { addTouchControls, isTouchDevice, touch } from '../touch';
import { H, W, fadeTo, txt } from '../ui';
import { Btn } from '../scenes/ShopScene';
import { saveAuto } from '../progress/save';
import { KELLER_SPAWN } from './spawns';
import { DaemonFigur } from './daemonFigur';

// Endkampf gegen den Dämon (Nick, verschmolzen mit dem Teufel): „Der Lieferant“.
// Der Wirt kämpft, wie ein Wirt kämpft – mit einem Barhocker. Laufen, Hechtsprung (kurz unverwundbar), Zuschlagen.
// Grundprinzip: ausweichen, kontern, auf den Kopf. Die Faust des Dämons kracht in den Boden und steckt fest:
// dreimal draufhauen, dann knallt sein Kopf auf den Boden – jetzt gibt es richtig Schaden.
//  Phase 1 „Der Lieferant“: Faust, Krallen, Feuerwalze.
//  Phase 2 „Der Koks-Schild“: fünf Koks-Kristalle an den Spitzen des Pentagramms schützen ihn. Zertrümmern, dann Kopf.
//  Phase 3 „Höllenfahrt“: Er hebt ab und stürzt sich auf den Wirt (nur sein Schatten warnt), Lava, Bierkisten.
//  Finale: Nicks rote Flying V aufheben und ihm über den Schädel ziehen. Checkpoint pro Phase.

interface Zone { x: number; y: number; r: number; ab: number; bis: number }
interface Band { y0: number; y1: number; von: number; dauer: number; rechts: boolean; ende: number }
interface Schuss { sp: Phaser.GameObjects.Sprite; vx: number; vy: number }
interface Kristall { sp: Phaser.GameObjects.Image; licht: Phaser.GameObjects.Image; hp: number }
interface Faust { sp: Phaser.GameObjects.Image; x: number; y: number; bis: number; treffer: number }
interface Kiste { sp: Phaser.GameObjects.Image; x: number; y: number }

const AX0 = 26, AX1 = 454, AY0 = 150, AY1 = 258;
const DX = W / 2, DY = 156;
const HP_PHASE = 100;
const PHASEN = [
  { name: 'PHASE 1: DER LIEFERANT', pause: 1500, tempo: 1 },
  { name: 'PHASE 2: DER KOKS-SCHILD', pause: 1200, tempo: 0.9 },
  { name: 'PHASE 3: HÖLLENFAHRT', pause: 1000, tempo: 0.8 },
];
type Angriff = 'faust' | 'krallen' | 'feuer' | 'schaedel' | 'sturz';
const POOL: Angriff[][] = [
  ['faust', 'faust', 'krallen', 'feuer'],
  ['krallen', 'feuer', 'schaedel'],
  ['sturz', 'faust', 'krallen', 'feuer', 'schaedel'],
];

export class HoellenbossScene extends Phaser.Scene {
  private horst!: Phaser.GameObjects.Sprite;
  private schatten!: Phaser.GameObjects.Image;
  private hocker!: Phaser.GameObjects.Image;
  private daemon!: DaemonFigur;
  private g!: Phaser.GameObjects.Graphics;
  private feuerG!: Phaser.GameObjects.Graphics;
  private hiebG!: Phaser.GameObjects.Graphics;
  private lavaG!: Phaser.GameObjects.Graphics;
  private zonen: Zone[] = [];
  private baender: Band[] = [];
  private schuesse: Schuss[] = [];
  private lava: Phaser.Geom.Rectangle[] = [];
  private kristalle: Kristall[] = [];
  private schild?: Phaser.GameObjects.Image;
  private faust?: Faust;
  private kiste?: Kiste;
  private gitarre?: Phaser.GameObjects.Image;
  private hatGitarre = false;
  private phase = 0;
  private hp = 300;
  private leben = 5;
  private maxLeben = 5;
  private unverwundbarBis = 0;
  private naechster = 0;
  private letzter: Angriff | null = null;
  /** Kopf liegt am Boden (Schadensfenster) bis … */
  private betaeubtBis = 0;
  private kopfX = DX;
  private laeuft = false;
  private vorbei = false;
  private finale = false;
  private fliegt = false;
  private haertetest = 1;
  private blick = { x: 0, y: 1 };
  private sprungBis = 0;
  private sprungBereit = 0;
  private schlagBereit = 0;
  private schlagBis = 0;
  private stopBis = 0;
  private kisteT = 0;
  private zeitlupe = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpGhost!: Phaser.GameObjects.Rectangle;
  private herzT!: Phaser.GameObjects.Text;
  private phaseT!: Phaser.GameObjects.Text;
  private hinweisT!: Phaser.GameObjects.Text;
  private hinweisBg!: Phaser.GameObjects.Rectangle;
  private banner!: Phaser.GameObjects.Text;
  private box?: Phaser.GameObjects.Container;
  private primary: (() => void) | null = null;
  private stepT = 0;
  /** Niederlagen in dieser Sitzung: jedes Mal ein Herz mehr und etwas langsamere Angriffe */
  private static niederlagen = 0;

  constructor() {
    super('Hoellenboss');
  }

  create() {
    this.zonen = []; this.baender = []; this.schuesse = []; this.lava = []; this.kristalle = [];
    this.schild = undefined; this.faust = undefined; this.kiste = undefined; this.gitarre = undefined; this.hatGitarre = false;
    this.vorbei = false; this.finale = false; this.laeuft = false; this.fliegt = false; this.box = undefined; this.primary = null;
    this.betaeubtBis = 0; this.sprungBis = 0; this.sprungBereit = 0; this.schlagBereit = 0; this.schlagBis = 0; this.stopBis = 0;
    this.zeitlupe = false;
    this.blick = { x: 0, y: -1 };
    state.running = false;
    this.scene.stop('Hud');
    this.phase = Math.min(2, state.flags.nickBossPhase ?? 0);
    this.haertetest = 1 + HoellenbossScene.niederlagen * 0.08;
    this.maxLeben = Math.min(8, 5 + HoellenbossScene.niederlagen);
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    audio.stufe = this.phase + 1;
    audio.music('hoelle');

    // Kulisse: der zerstörte Keller, rote Glut, die Grube
    this.add.image(0, 0, 'csKeller').setOrigin(0).setTint(0xff8070);
    this.add.rectangle(0, 0, W, H, 0x200404, 0.45).setOrigin(0);
    this.add.ellipse(W / 2, 146, 300, 46, 0x050102).setDepth(1);
    const grubenGlut = this.add.image(W / 2, 140, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff3010).setScale(3.4, 0.9).setAlpha(0.6).setDepth(1);
    this.tweens.add({ targets: grubenGlut, alpha: 0.35, duration: 800, yoyo: true, repeat: -1 });
    this.daemon = new DaemonFigur(this, DX, DY, 1, 2);
    this.add.rectangle(0, 148, W, H - 148, 0x160c0c).setOrigin(0).setDepth(3);
    this.add.rectangle(0, 147, W, 3, 0xff3a10).setOrigin(0).setDepth(3);
    // das Pentagramm auf dem Arenaboden: klar gezogen, dunkelrot glimmend (an den Spitzen wachsen in Phase 2 die Kristalle)
    const pg = this.add.graphics().setDepth(3.2);
    const spitzen: [number, number][] = [];
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; spitzen.push([DX + Math.cos(a) * 150, 206 + Math.sin(a) * 44]); }
    for (const [w, col, al] of [[3, 0x5a0808, 0.9], [1, 0xff3a18, 0.55]] as const) {
      pg.lineStyle(w, col, al).beginPath();
      [0, 2, 4, 1, 3, 0].forEach((i, k) => (k ? pg.lineTo(spitzen[i][0], spitzen[i][1]) : pg.moveTo(spitzen[i][0], spitzen[i][1])));
      pg.strokePath();
      pg.strokeEllipse(DX, 206, 330, 104);
    }
    this.tweens.add({ targets: pg, alpha: 0.7, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.lavaG = this.add.graphics().setDepth(3.5);
    this.g = this.add.graphics().setDepth(4);
    this.feuerG = this.add.graphics().setDepth(300).setBlendMode(Phaser.BlendModes.ADD);
    this.hiebG = this.add.graphics().setDepth(320);
    this.add.particles(0, 0, 'light', {
      x: { min: 20, max: W - 20 }, y: { min: 150, max: 262 }, lifespan: 2000, speedY: { min: -40, max: -15 },
      scale: { start: 0.04, end: 0 }, alpha: { start: 0.6, end: 0 }, tint: [0xff5010, 0xffb020], blendMode: 'ADD', frequency: 200,
    }).setDepth(250);

    // der Wirt mit seinem Barhocker
    this.schatten = this.add.image(W / 2, 220, 'shadow').setScale(1.6).setDepth(5);
    this.horst = this.add.sprite(W / 2, 220, 'wirt', 3).setOrigin(0.5, 1).setScale(1).setDepth(220);
    this.hocker = this.add.image(W / 2, 210, 'hocker').setDepth(221);
    // saubere Pixel: keine Zwischenpositionen
    this.cameras.main.setRoundPixels(true);

    // Anzeigen
    this.add.rectangle(W / 2, 12, 302, 9, 0x1a0606).setStrokeStyle(1, 0xc02020).setDepth(400);
    this.hpGhost = this.add.rectangle(W / 2 - 150, 12, 300, 7, 0xffe0c0).setOrigin(0, 0.5).setDepth(400);
    this.hpBar = this.add.rectangle(W / 2 - 150, 12, 300, 7, 0xd01818).setOrigin(0, 0.5).setDepth(401);
    for (const k of [1, 2]) this.add.rectangle(W / 2 - 150 + k * 100, 12, 1, 9, 0x000000).setDepth(402);
    txt(this, W / 2, 20, 'NICK & DER LIEFERANT', '#ffb020').setOrigin(0.5, 0).setDepth(400).setStroke('#120c0b', 3);
    this.herzT = txt(this, 8, 6, '', '#ff4a5a', 16).setDepth(400).setStroke('#120c0b', 3);
    this.phaseT = txt(this, W - 8, 6, '', '#c97a4a').setOrigin(1, 0).setDepth(400);
    this.hinweisBg = this.add.rectangle(W / 2, H - 12, 10, 14, 0x000000, 0.65).setDepth(399).setVisible(false);
    this.hinweisT = txt(this, W / 2, H - 12, '', '#f4ead0').setOrigin(0.5).setDepth(400).setStroke('#120c0b', 3);
    this.banner = txt(this, W / 2, 96, '', '#ffffff', 16).setOrigin(0.5).setDepth(450).setStroke('#4a0808', 6).setAlpha(0);

    // Steuerung
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,E,SPACE,ENTER,SHIFT') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.E.on('down', () => (this.box ? this.primary?.() : this.schlag()));
    this.keys.ENTER.on('down', () => this.box && this.primary?.());
    this.keys.SPACE.on('down', () => (this.box ? this.primary?.() : this.sprung()));
    this.keys.SHIFT.on('down', () => !this.box && this.sprung());
    this.input.keyboard!.on('keydown-ESC', () => { if (!this.box && this.laeuft) this.aufgebenFrage(); });
    addTouchControls(this);
    touch.onAction = () => (this.box ? this.primary?.() : this.schlag());
    if (isTouchDevice(this)) {
      // zweiter Knopf: Hechtsprung
      const bx = W - 108, by = H - 44;
      const b = this.add.circle(bx, by, 19, 0x5a8ac0, 0.75).setStrokeStyle(2, 0x000000, 0.8).setDepth(9500).setInteractive();
      txt(this, bx, by, 'SPRUNG', '#0a1018').setOrigin(0.5).setDepth(9501);
      b.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); this.sprung(); });
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { touch.onAction = null; touch.vx = touch.vy = 0; this.time.timeScale = 1; this.tweens.timeScale = 1; });

    this.hp = 300 - this.phase * HP_PHASE;
    this.leben = this.maxLeben;
    this.lavaFuerPhase();
    this.anzeigen();
    this.cameras.main.fadeIn(400, 255, 255, 255);
    this.intro();
  }

  // ---------------------------------------------------------------- Start, Phasen

  private intro() {
    const box = this.add.container(W / 2, H / 2).setDepth(500);
    const t = isTouchDevice(this);
    box.add(this.add.rectangle(0, 0, 370, 172, 0x120608, 0.96).setStrokeStyle(2, 0xff3a10));
    box.add(txt(this, 0, -68, this.phase ? `WEITER AB PHASE ${this.phase + 1}` : 'ENDKAMPF: DER LIEFERANT', '#ff6a3a', 16).setOrigin(0.5));
    const regeln = [
      `${t ? 'Joystick' : 'WASD'}: laufen.   ${t ? 'SPRUNG' : 'LEERTASTE'}: Hechtsprung (kurz unverwundbar).   E: mit dem Barhocker zuschlagen.`,
      'Rot am Boden = gleich knallt es. Wegspringen!',
      'Steckt seine Faust im Boden fest: draufhauen! Dann kracht sein KOPF auf den Boden – da tut es richtig weh.',
      `${this.maxLeben} Herzen. Jede Phase ist ein Checkpoint.`,
    ];
    let y = -46;
    for (const r of regeln) { const tt = txt(this, -174, y, r, '#d8c8b0').setWordWrapWidth(348); box.add(tt); y += tt.height + 3; }
    const go = new Btn(this, 0, 66, 150, 20, 'KÄMPFEN', 0xa8342a, () => this.los());
    box.add(go.box);
    this.box = box;
    this.primary = () => this.los();
  }

  private los() {
    this.box?.destroy();
    this.box = undefined;
    this.primary = null;
    this.laeuft = true;
    this.zeigeBanner(PHASEN[this.phase].name);
    this.naechster = this.time.now + 2000;
    this.kisteT = this.time.now + 20000;
    if (this.phase === 1) this.time.delayedCall(1200, () => this.kristalleWachsen());
    this.speichern();
  }

  private speichern() {
    state.flags.nickBossPhase = this.phase;
    saveAuto('Keller', KELLER_SPAWN);
  }

  private lavaFuerPhase() {
    this.lava = [];
    if (this.phase >= 2) this.lava.push(new Phaser.Geom.Rectangle(150, 168, 54, 24), new Phaser.Geom.Rectangle(300, 222, 60, 22), new Phaser.Geom.Rectangle(48, 236, 50, 18));
    const g = this.lavaG;
    g.clear();
    for (const r of this.lava) {
      g.fillStyle(0x3a0402, 1).fillRoundedRect(r.x - 3, r.y - 3, r.width + 6, r.height + 6, 6);
      g.fillStyle(0xff4a10, 1).fillRoundedRect(r.x, r.y, r.width, r.height, 5);
      g.fillStyle(0xffb020, 0.8).fillRoundedRect(r.x + 4, r.y + 4, r.width - 8, r.height - 8, 4);
      const l = this.add.image(r.centerX, r.centerY, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff4010).setScale(r.width / 70, r.height / 60).setAlpha(0.6).setDepth(250);
      this.tweens.add({ targets: l, alpha: 0.35, duration: 600, yoyo: true, repeat: -1 });
    }
  }

  private phaseWechsel() {
    this.phase++;
    audio.stufe = this.phase + 1;
    this.aufraeumen();
    this.daemon.setPose('bruell');
    audio.sfx('demon');
    this.wackel(1200, 0.012);
    this.cameras.main.flash(300, 255, 60, 20);
    this.zeigeBanner(PHASEN[this.phase].name);
    if (this.phase === 2) this.time.delayedCall(600, () => { audio.sfx('crack'); this.lavaFuerPhase(); this.ausLava(); });
    if (this.phase === 1) this.time.delayedCall(1500, () => this.kristalleWachsen());
    this.time.delayedCall(1300, () => !this.finale && this.daemon.setPose('idle'));
    this.naechster = this.time.now + 2600;
    this.leben = Math.min(this.maxLeben, this.leben + 2);
    this.anzeigen();
    this.speichern();
  }

  private aufraeumen() {
    this.zonen = []; this.baender = [];
    for (const s of this.schuesse) s.sp.destroy();
    this.schuesse = [];
    if (this.faust) { this.faust.sp.destroy(); this.faust = undefined; }
  }

  private ausLava() {
    for (const r of this.lava) if (r.contains(this.horst.x, this.horst.y)) this.horst.y = r.bottom + 8 > AY1 ? r.top - 8 : r.bottom + 8;
  }

  // ---------------------------------------------------------------- Schleife

  update(_t: number, delta: number) {
    const dt = Math.min(delta, 50);
    this.daemon.update(dt);
    this.zeichneGefahren();
    this.hockerFolgt();
    if (!this.laeuft || this.vorbei) return;
    const now = this.time.now;
    if (now < this.stopBis) return; // Hit-Stop
    this.bewegen(dt);
    this.schatten.setPosition(this.horst.x, this.horst.y - 1);
    this.horst.setDepth(this.horst.y);
    this.horst.setAlpha(now < this.unverwundbarBis && now > this.sprungBis ? (Math.floor(now / 80) % 2 ? 0.35 : 1) : 1);
    this.gefahren(now, dt);
    this.hinweis();
    // Faust steckt fest: nach Ablauf zieht er sie zurück
    if (this.faust && now > this.faust.bis) this.faustZurueck();
    // Kopf liegt am Boden: wieder aufrichten
    if (this.betaeubtBis && now > this.betaeubtBis && !this.finale) this.aufrichten();
    // Bierkiste
    if (this.phase >= 1 && now > this.kisteT && !this.kiste && !this.finale) this.kisteFaellt();
    if (!this.finale && !this.betaeubtBis && !this.faust && !this.fliegt && now >= this.naechster) this.angreifen();
  }

  private hinweis() {
    let s = '';
    if (this.finale) s = this.hatGitarre ? 'Zieh sie ihm über den Schädel! (E am Kopf)' : 'Nicks Gitarre! Heb sie auf (E)';
    else if (this.betaeubtBis) s = 'SEIN KOPF! DRAUFHAUEN! (E)';
    else if (this.faust) s = `Faust steckt fest! Draufhauen! (${this.faust.treffer}/3)`;
    else if (this.schild) s = `Zertrümmer die Koks-Kristalle! Noch ${this.kristalle.length}.`;
    else if (this.kiste && Phaser.Math.Distance.Between(this.horst.x, this.horst.y, this.kiste.x, this.kiste.y) < 22) s = '[E] Bier trinken: ein Herz zurück';
    if (this.hinweisT.text === s) return;
    this.hinweisT.setText(s);
    this.hinweisBg.setVisible(!!s).setSize(this.hinweisT.width + 6, 14).setPosition(W / 2, H - 12);
    this.hinweisBg.setOrigin(0.5);
  }

  private bewegen(dt: number) {
    const p = this.horst;
    if (this.time.now < this.sprungBis) return; // der Sprung bewegt ihn selbst
    const k = this.keys, c = this.cursors;
    let vx = touch.vx, vy = touch.vy;
    if (k.A.isDown || c.left.isDown) vx -= 1;
    if (k.D.isDown || c.right.isDown) vx += 1;
    if (k.W.isDown || c.up.isDown) vy -= 1;
    if (k.S.isDown || c.down.isDown) vy += 1;
    const len = Math.hypot(vx, vy);
    if (len > 0.1) {
      this.blick = { x: vx / len, y: vy / len };
      const sp = ((this.hatGitarre ? 80 : 104) * dt) / 1000;
      p.x = Phaser.Math.Clamp(p.x + (vx / Math.max(1, len)) * sp, AX0, AX1);
      p.y = Phaser.Math.Clamp(p.y + (vy / Math.max(1, len)) * sp, AY0, AY1);
      const dir = Math.abs(vx) > Math.abs(vy) ? 'side' : vy < 0 ? 'up' : 'down';
      if (dir === 'side') p.setFlipX(vx < 0);
      if (this.time.now > this.schlagBis) p.anims.play(`wirt_${dir}`, true);
      this.stepT -= dt;
      if (this.stepT <= 0) { audio.sfx('step'); this.stepT = 250; }
    } else if (this.time.now > this.schlagBis) {
      p.anims.stop();
      p.setFrame(Math.abs(this.blick.x) > Math.abs(this.blick.y) ? 6 : this.blick.y < 0 ? 3 : 0);
    }
  }

  /** Der Hocker (bzw. die Gitarre) hängt an Horsts Hand, außer gerade beim Zuschlagen */
  private hockerFolgt() {
    if (this.time.now < this.schlagBis || this.zeitlupe) return;
    const p = this.horst, h = this.hocker;
    const seite = p.flipX ? -1 : 1;
    const hinten = this.blick.y < -0.5 && Math.abs(this.blick.x) < 0.7;
    h.setPosition(p.x + seite * 9, p.y - 9).setAngle(seite * 20).setFlipX(p.flipX).setDepth(p.depth + (hinten ? -1 : 1));
  }

  // ---------------------------------------------------------------- Hechtsprung und Schlag

  private sprung() {
    const now = this.time.now;
    if (!this.laeuft || this.vorbei || now < this.sprungBereit || now < this.stopBis) return;
    this.sprungBereit = now + 650;
    this.sprungBis = now + 230;
    this.unverwundbarBis = Math.max(this.unverwundbarBis, now + 330);
    const p = this.horst;
    const bx = this.blick.x, by = this.blick.x || this.blick.y ? this.blick.y : 1;
    const zx = Phaser.Math.Clamp(p.x + bx * 50, AX0, AX1), zy = Phaser.Math.Clamp(p.y + by * 38, AY0, AY1);
    audio.sfx('whoosh');
    // Geisterbilder
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 45, () => {
        const gh = this.add.image(p.x, p.y, p.texture.key, p.frame.name).setOrigin(0.5, 1).setFlipX(p.flipX).setTint(0xffa060).setAlpha(0.5).setDepth(p.depth - 1);
        this.tweens.add({ targets: gh, alpha: 0, duration: 260, onComplete: () => gh.destroy() });
      });
    }
    this.staub(p.x, p.y, 3);
    this.tweens.add({
      targets: p, x: zx, y: zy, duration: 230, ease: 'Quad.easeOut',
      onComplete: () => { this.staub(p.x, p.y, 4); audio.sfx('step'); this.ausLava(); },
    });
  }

  private schlag() {
    const now = this.time.now;
    if (!this.laeuft || this.vorbei || now < this.schlagBereit || now < this.sprungBis || now < this.stopBis) return;
    const p = this.horst;
    // Bier trinken statt zuschlagen, wenn eine Kiste daneben steht
    if (this.kiste && Phaser.Math.Distance.Between(p.x, p.y, this.kiste.x, this.kiste.y) < 22) return this.bierTrinken();
    // Finale: Gitarre aufheben
    if (this.finale && !this.hatGitarre && this.gitarre && Phaser.Math.Distance.Between(p.x, p.y, this.gitarre.x, this.gitarre.y + 4) < 24) return this.gitarreAufheben();
    this.schlagBereit = now + 380;
    this.schlagBis = now + 200;
    const bx = Math.abs(this.blick.x) > 0.35 ? Math.sign(this.blick.x) : 0;
    const by = bx ? 0 : this.blick.y < 0 ? -1 : 1;
    // Ausholen und Durchziehen: der Hocker schwingt im Bogen vor dem Wirt
    const h = this.hocker;
    const basis = bx ? (bx > 0 ? 0 : 180) : by < 0 ? -90 : 90;
    const r = 13;
    const o = { a: basis - 80 };
    p.anims.stop();
    p.setFrame(bx ? 6 : by < 0 ? 3 : 0).setFlipX(bx < 0);
    this.tweens.add({
      targets: o, a: basis + 70, duration: 130, ease: 'Quad.easeIn',
      onUpdate: () => {
        const rad = Phaser.Math.DegToRad(o.a);
        h.setPosition(p.x + Math.cos(rad) * r, p.y - 9 + Math.sin(rad) * r * 0.8).setAngle(o.a + 90).setDepth(p.depth + (Math.sin(rad) < -0.3 ? -1 : 1));
      },
    });
    // Hiebspur
    this.time.delayedCall(60, () => {
      const g = this.hiebG;
      g.clear().setAlpha(1).lineStyle(2, 0xffffff, 0.7).beginPath();
      for (let k = 0; k <= 8; k++) { const a = Phaser.Math.DegToRad(basis - 60 + k * 15); const x = p.x + Math.cos(a) * 17, y = p.y - 9 + Math.sin(a) * 13; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
      g.strokePath();
      this.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.clear() });
    });
    audio.sfx('whoosh');
    this.time.delayedCall(70, () => this.trefferPruefen(p.x + bx * 15, p.y - 8 + by * 12));
  }

  /** Was der Hocker trifft: Gitarren-Finisher, Kopf, Kristall, festsitzende Faust */
  private trefferPruefen(x: number, y: number) {
    const nah = (tx: number, ty: number, r: number) => Phaser.Math.Distance.Between(x, y, tx, ty) < r;
    const ky = this.daemon.c.y - 100;
    if (this.finale && this.hatGitarre && nah(this.kopfX, ky, 36)) return this.finisher();
    if (this.betaeubtBis && nah(this.kopfX, ky, 34) && !this.finale) {
      if (this.schild) return this.abgeprallt(x, y);
      this.schaden(this.phase === 2 ? 11 : 13, x, y, true);
      return;
    }
    for (const k of this.kristalle) {
      if (!nah(k.sp.x, k.sp.y - 8, 18)) continue;
      k.hp--;
      this.hitStop(55);
      this.funken(k.sp.x, k.sp.y - 10, 0xe0e8ff, 8);
      audio.sfx('clang');
      k.sp.setTintFill(0xffffff);
      this.time.delayedCall(70, () => k.sp.active && k.sp.clearTint());
      this.tweens.add({ targets: k.sp, x: k.sp.x + 2, duration: 40, yoyo: true, repeat: 1 });
      if (k.hp <= 0) this.kristallBricht(k);
      return;
    }
    const f = this.faust;
    if (f && nah(f.x, f.y - 10, 26)) {
      f.treffer++;
      this.hitStop(60);
      this.funken(f.x, f.y - 12, 0xff8040, 10);
      audio.sfx('thud'); audio.sfx('slap');
      this.zahl(f.x, f.y - 26, `${f.treffer}/3`, '#ffb070');
      f.sp.setTintFill(0xffffff);
      this.time.delayedCall(70, () => f.sp.active && f.sp.clearTint());
      this.wackel(90, 0.006);
      this.daemon.blitz(this, 60);
      if (f.treffer >= 3) {
        this.tweens.killTweensOf(f.sp);
        f.sp.destroy();
        this.faust = undefined;
        this.kopfRunter(DX, this.phase === 2 ? 2600 : 3200);
      }
    }
  }

  private abgeprallt(x: number, y: number) {
    audio.sfx('clang');
    this.funken(x, y, 0xff3020, 6);
    this.zahl(x, y - 12, 'SCHILD!', '#ff6a5a');
  }

  // ---------------------------------------------------------------- Der Kopf am Boden

  /** Der Dämon knallt mit dem Kopf auf den Boden: Schadensfenster */
  private kopfRunter(x: number, dauer: number) {
    const d = this.daemon;
    this.betaeubtBis = this.time.now + dauer * this.haertetest;
    this.kopfX = x;
    this.aufraeumen();
    d.setPose('treffer');
    audio.sfx('demon');
    this.zeigeBanner('KOPF! DRAUFHAUEN!');
    d.c.setDepth(140);
    this.tweens.add({
      targets: d.c, x, y: 272, duration: 360, ease: 'Quad.easeIn',
      onComplete: () => {
        d.setPose('kaputt');
        audio.sfx('thud'); audio.sfx('crack');
        this.wackel(380, 0.016);
        this.staub(x, d.c.y - 96, 14);
        this.welle(x, d.c.y - 96, 0xffb070);
      },
    });
  }

  private aufrichten() {
    const d = this.daemon;
    this.betaeubtBis = 0;
    d.setPose('bruell');
    audio.sfx('roar');
    this.tweens.add({
      targets: d.c, x: DX, y: DY, duration: 600, ease: 'Back.easeOut',
      onComplete: () => { d.c.setDepth(2); if (!this.finale) d.setPose('idle'); },
    });
    this.fliegt = false;
    this.naechster = this.time.now + 1300 * this.haertetest;
    // Phase 2: der Schild wächst nach, solange noch genug Leben übrig ist
    if (this.phase === 1 && this.hp > HP_PHASE + 10) this.time.delayedCall(1400, () => this.kristalleWachsen());
  }

  // ---------------------------------------------------------------- Angriffe

  private tempo() { return PHASEN[this.phase].tempo * this.haertetest; }

  private angreifen() {
    const pool = POOL[this.phase].filter((a) => a !== this.letzter || a === 'faust');
    const a = Phaser.Utils.Array.GetRandom(pool);
    this.letzter = a;
    const t = this.tempo();
    let dauer = 0;
    if (a === 'faust') dauer = this.faustSchlag(t);
    else if (a === 'krallen') dauer = this.krallen(t);
    else if (a === 'feuer') dauer = this.feuer(t);
    else if (a === 'schaedel') dauer = this.schaedel(t);
    else dauer = this.sturz(t);
    this.naechster = this.time.now + dauer + PHASEN[this.phase].pause * this.haertetest;
  }

  /** Faust: holt aus, rote Markierung am Wirt, kracht runter und steckt fest */
  private faustSchlag(t: number) {
    const auf = 1000 * t;
    this.daemon.setPose('hebe');
    audio.sfx('growl');
    const z: Zone = { x: this.horst.x, y: this.horst.y, r: 30, ab: this.time.now + auf, bis: this.time.now + auf + 150 };
    if (this.phase >= 1) this.time.addEvent({ delay: 40, repeat: Math.floor((auf * 0.4) / 40), callback: () => { z.x = this.horst.x; z.y = this.horst.y; } });
    this.zonen.push(z);
    this.time.delayedCall(auf - 160, () => {
      if (this.vorbei || this.betaeubtBis || this.finale) return;
      this.daemon.setPose('schlag');
      const f = this.add.image(z.x, -60, 'daemonFaust').setOrigin(0.5, 1).setScale(0.5).setDepth(z.y + 1);
      this.tweens.add({
        targets: f, y: z.y + 6, duration: 160, ease: 'Quad.easeIn',
        onComplete: () => {
          if (this.vorbei || this.finale) { f.destroy(); return; }
          audio.sfx('thud'); audio.sfx('crack');
          this.wackel(300, 0.014);
          this.welle(z.x, z.y, 0xff6a20);
          this.staub(z.x, z.y, 10);
          // Faust steckt im Boden fest: Konterchance (der Wirt kann davor stehen)
          f.setDepth(z.y - 6);
          this.faust = { sp: f, x: z.x, y: z.y + 6, bis: this.time.now + 2300 / this.haertetest, treffer: 0 };
          this.tweens.add({ targets: f, angle: { from: -3, to: 3 }, duration: 90, yoyo: true, repeat: -1 });
        },
      });
    });
    return auf + 400;
  }

  private faustZurueck() {
    const f = this.faust!;
    this.faust = undefined;
    audio.sfx('growl');
    this.tweens.killTweensOf(f.sp);
    this.tweens.add({ targets: f.sp, y: -60, duration: 380, ease: 'Quad.easeIn', onComplete: () => f.sp.destroy() });
    this.time.delayedCall(300, () => !this.betaeubtBis && !this.finale && this.daemon.setPose('idle'));
    this.naechster = Math.max(this.naechster, this.time.now + 900);
  }

  private krallen(t: number) {
    const n = [4, 6, 7][this.phase];
    const auf = 820 * t;
    audio.sfx('rumble');
    const punkte: [number, number][] = [[this.horst.x, this.horst.y]];
    for (let i = 1; i < n; i++) {
      const a = (i / (n - 1)) * Math.PI * 2 + Math.random(), d = 28 + Math.random() * 40;
      punkte.push([Phaser.Math.Clamp(this.horst.x + Math.cos(a) * d, AX0, AX1), Phaser.Math.Clamp(this.horst.y + Math.sin(a) * d * 0.6, AY0, AY1)]);
    }
    punkte.forEach(([x, y], i) => {
      const ab = this.time.now + auf + i * 60;
      this.zonen.push({ x, y, r: 15, ab, bis: ab + 380 });
      this.time.delayedCall(auf + i * 60, () => {
        if (this.vorbei) return;
        const h = this.add.sprite(x, y + 4, 'daemonHand', 0).setOrigin(0.5, 1).setScale(0.5, 0).setDepth(y + 2);
        this.tweens.add({ targets: h, scaleY: 0.5, duration: 140, ease: 'Back.easeOut', onComplete: () => { h.setFrame(1); this.tweens.add({ targets: h, scaleY: 0, duration: 220, delay: 280, onComplete: () => h.destroy() }); } });
        if (i % 2 === 0) audio.sfx('crack');
      });
    });
    return auf + n * 60 + 400;
  }

  private feuer(t: number) {
    const auf = 1000 * t;
    this.daemon.setPose('feuer');
    audio.sfx('whoosh');
    const anz = this.phase >= 1 ? 2 : 1;
    const hoehe = 30;
    const ys = [Phaser.Math.Clamp(this.horst.y - hoehe / 2, AY0 - 6, AY1 - hoehe + 6)];
    if (anz > 1) ys.push(ys[0] < (AY0 + AY1) / 2 ? ys[0] + 52 : ys[0] - 52);
    const rechts = Math.random() < 0.5;
    for (const y0 of ys) this.baender.push({ y0, y1: y0 + hoehe, von: this.time.now + auf, dauer: 700 * t, rechts, ende: this.time.now + auf + 700 * t + 350 });
    this.time.delayedCall(auf, () => { if (!this.vorbei) { audio.sfx('roar'); this.wackel(700, 0.005); } });
    this.time.delayedCall(auf + 900, () => !this.betaeubtBis && !this.finale && this.daemon.setPose('idle'));
    return auf + 900;
  }

  private schaedel(t: number) {
    const auf = 700 * t;
    this.daemon.setPose('bruell');
    audio.sfx('demon');
    const salven = this.phase >= 2 ? 2 : 1;
    for (let s = 0; s < salven; s++) {
      this.time.delayedCall(auf + s * 650, () => {
        if (this.vorbei || this.betaeubtBis || this.finale) return;
        const ox = DX, oy = 60;
        const ziel = Math.atan2(this.horst.y - 10 - oy, this.horst.x - ox);
        const n = 5 + this.phase * 2;
        for (let i = 0; i < n; i++) {
          const a = ziel + (i - (n - 1) / 2) * 0.17 + (s ? 0.085 : 0);
          const sp = this.add.sprite(ox, oy, 'schaedel', 0).setScale(0.5).setDepth(290);
          this.tweens.add({ targets: sp, angle: { from: -8, to: 8 }, duration: 120, yoyo: true, repeat: -1 });
          this.time.addEvent({ delay: 90, loop: true, callback: () => sp.active && sp.setFrame(Number(sp.frame.name) === 0 ? 1 : 0) });
          const v = 115 + this.phase * 15;
          this.schuesse.push({ sp, vx: Math.cos(a) * v, vy: Math.sin(a) * v });
        }
        audio.sfx('whoosh');
      });
    }
    this.time.delayedCall(auf + salven * 650 + 200, () => !this.betaeubtBis && !this.finale && this.daemon.setPose('idle'));
    return auf + salven * 650 + 600;
  }

  /** Phase 3: Er hebt ab, sein Schatten jagt den Wirt, dann stürzt er herab und bleibt mit dem Kopf am Boden liegen */
  private sturz(t: number) {
    const d = this.daemon;
    this.fliegt = true;
    d.setPose('bruell');
    d.aufschlag();
    audio.sfx('demon');
    this.tweens.add({ targets: d.c, y: -230, duration: 700, ease: 'Quad.easeIn' });
    const sch = this.add.ellipse(this.horst.x, this.horst.y, 20, 8, 0x000000, 0.35).setDepth(6);
    const jagd = 1700 * t;
    this.tweens.add({ targets: sch, scaleX: 4, scaleY: 3.4, alpha: 0.6, duration: jagd + 300 });
    const folge = this.time.addEvent({ delay: 30, loop: true, callback: () => { sch.x += (this.horst.x - sch.x) * 0.08; sch.y += (this.horst.y - sch.y) * 0.08; } });
    this.time.delayedCall(700 + jagd, () => {
      folge.remove();
      if (this.vorbei || this.finale) { sch.destroy(); return; }
      sch.setFillStyle(0xff2010, 0.45);
      audio.sfx('whoosh');
      this.time.delayedCall(320, () => {
        if (this.vorbei || this.finale) { sch.destroy(); return; }
        // Aufprall
        d.c.setPosition(sch.x, -200).setDepth(140);
        d.setPose('kaputt');
        this.tweens.add({
          targets: d.c, y: sch.y + 100, duration: 200, ease: 'Quad.easeIn',
          onComplete: () => {
            this.zonen.push({ x: sch.x, y: sch.y, r: 44, ab: this.time.now - 1, bis: this.time.now + 120 });
            audio.sfx('thud'); audio.sfx('crack'); audio.sfx('roar');
            this.wackel(500, 0.022);
            this.cameras.main.flash(120, 255, 120, 60);
            this.welle(sch.x, sch.y, 0xff6a20);
            this.staub(sch.x, sch.y, 18);
            // er liegt mit dem Kopf am Boden: Schadensfenster
            this.betaeubtBis = this.time.now + 2400 * this.haertetest;
            this.kopfX = sch.x;
            sch.destroy();
            this.zeigeBanner('JETZT! AUF DEN KOPF!');
          },
        });
      });
    });
    return 700 + jagd + 900;
  }

  // ---------------------------------------------------------------- Phase 2: Koks-Kristalle

  private kristalleWachsen() {
    if (this.vorbei || this.finale || this.phase !== 1 || this.kristalle.length) return;
    this.zeigeBanner('DER KOKS-SCHILD!');
    audio.sfx('glocke');
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const x = DX + Math.cos(a) * 150, y = 206 + Math.sin(a) * 44;
      const licht = this.add.image(x, y - 8, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xc0d0ff).setScale(0.35).setAlpha(0.6).setDepth(249);
      const sp = this.add.image(x, y + 2, 'kristall').setOrigin(0.5, 1).setScale(1, 0).setDepth(y);
      this.tweens.add({ targets: sp, scaleY: 1, duration: 420, delay: i * 120, ease: 'Back.easeOut' });
      this.tweens.add({ targets: licht, alpha: 0.3, duration: 700, yoyo: true, repeat: -1 });
      this.kristalle.push({ sp, licht, hp: 3 });
    }
    // roter Schild um den Dämon
    const s = this.add.image(DX, 80, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff2010).setScale(3.6, 3).setAlpha(0).setDepth(2.5);
    this.schild = s;
    this.tweens.add({ targets: s, alpha: 0.55, duration: 500, onComplete: () => { if (this.schild === s) this.tweens.add({ targets: s, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 }); } });
  }

  private kristallBricht(k: Kristall) {
    this.kristalle = this.kristalle.filter((x) => x !== k);
    audio.sfx('crack');
    audio.sfx('demon');
    this.wackel(200, 0.01);
    this.daemon.blitz(this, 120);
    // weiße Staubexplosion und Splitter
    for (let i = 0; i < 16; i++) {
      const s = this.add.rectangle(k.sp.x, k.sp.y - 10, 2, 2, i % 3 ? 0xffffff : 0xa8b8e0).setDepth(300);
      const a = Math.random() * Math.PI * 2, v = 14 + Math.random() * 26;
      this.tweens.add({ targets: s, x: s.x + Math.cos(a) * v, y: s.y + Math.sin(a) * v * 0.7, alpha: 0, angle: 360, duration: 500, onComplete: () => s.destroy() });
    }
    for (let i = 0; i < 6; i++) {
      const w = this.add.image(k.sp.x + Phaser.Math.Between(-6, 6), k.sp.y - 6, 'light').setTint(0xffffff).setAlpha(0.5).setScale(0.05).setDepth(301);
      this.tweens.add({ targets: w, scale: 0.25, alpha: 0, y: w.y - 10, duration: 800, onComplete: () => w.destroy() });
    }
    k.sp.destroy();
    this.tweens.killTweensOf(k.licht);
    k.licht.destroy();
    if (!this.kristalle.length && this.schild) {
      // Schild platzt
      const s = this.schild;
      this.schild = undefined;
      this.tweens.killTweensOf(s);
      this.tweens.add({ targets: s, scale: 6, alpha: 0, duration: 400, onComplete: () => s.destroy() });
      this.cameras.main.flash(250, 255, 80, 40);
      audio.sfx('roar');
      this.zeigeBanner('SCHILD KAPUTT!');
      this.time.delayedCall(500, () => !this.vorbei && this.kopfRunter(DX, 3200));
    }
  }

  // ---------------------------------------------------------------- Bier und Gitarre

  private kisteFaellt() {
    const x = Phaser.Math.Between(AX0 + 20, AX1 - 20), y = Phaser.Math.Between(AY0 + 20, AY1 - 10);
    if (this.lava.some((r) => r.contains(x, y))) { this.kisteT = this.time.now + 2000; return; }
    const sch = this.add.ellipse(x, y, 16, 6, 0x000000, 0.4).setDepth(5);
    const sp = this.add.image(x, -20, 'bierkiste').setOrigin(0.5, 1).setDepth(y);
    this.tweens.add({
      targets: sp, y, duration: 700, ease: 'Bounce.easeOut',
      onComplete: () => { sch.destroy(); audio.sfx('clang'); this.kiste = { sp, x, y }; this.zahl(x, y - 16, 'BIER!', '#ffe070'); },
    });
    this.kisteT = this.time.now + 26000;
  }

  private bierTrinken() {
    const k = this.kiste!;
    this.kiste = undefined;
    audio.sfx('glug');
    this.tweens.add({ targets: k.sp, alpha: 0, y: k.sp.y + 4, duration: 300, onComplete: () => k.sp.destroy() });
    this.leben = Math.min(this.maxLeben, this.leben + 1);
    this.anzeigen();
    this.zahl(this.horst.x, this.horst.y - 30, 'Prost! ♥+1', '#ff8aa0');
    this.tweens.add({ targets: this.horst, scaleY: 1.08, duration: 120, yoyo: true, repeat: 2 });
  }

  private gitarreAufheben() {
    const g = this.gitarre!;
    this.hatGitarre = true;
    audio.sfx('stab');
    this.tweens.killTweensOf(g);
    g.destroy();
    this.gitarre = undefined;
    this.events.emit('gitarreWeg');
    // statt des Hockers trägt der Wirt jetzt die Flying V
    this.hocker.setTexture('nickGit').setScale(1);
    this.zeigeBanner('NICKS GITARRE!');
  }

  // ---------------------------------------------------------------- Schaden, Treffer am Wirt

  private schaden(n: number, x: number, y: number, kopf: boolean) {
    if (this.vorbei || this.finale) return;
    const vorher = this.hp;
    this.hp = Math.max(0, this.hp - n);
    this.hitStop(kopf ? 85 : 50);
    this.daemon.blitz(this);
    audio.sfx('thud'); audio.sfx('slap');
    if (kopf) audio.sfx('demon');
    this.wackel(140, 0.01);
    this.funken(x, y, 0xffd080, 12);
    this.zahl(x + Phaser.Math.Between(-8, 8), y - 18, `-${n}`, '#fff0a0');
    this.anzeigen();
    const grenze = 300 - (this.phase + 1) * HP_PHASE;
    if (this.hp <= grenze && vorher > grenze) {
      this.betaeubtBis = 0;
      if (this.phase < 2) {
        this.tweens.add({ targets: this.daemon.c, x: DX, y: DY, duration: 500, ease: 'Back.easeOut', onComplete: () => this.daemon.c.setDepth(2) });
        this.fliegt = false;
        this.phaseWechsel();
      } else this.finaleStart();
    }
  }

  private treffer() {
    const now = this.time.now;
    if (now < this.unverwundbarBis || this.vorbei || this.finale) return;
    this.unverwundbarBis = now + 1300;
    this.leben--;
    audio.sfx('slap');
    audio.sfx('angry');
    this.hitStop(70);
    this.wackel(220, 0.012);
    this.cameras.main.flash(120, 255, 30, 30);
    const p = this.horst;
    p.setTintFill(0xffffff);
    this.time.delayedCall(80, () => p.clearTint());
    this.zahl(p.x, p.y - 34, ['AUA!', 'MEIN RÜCKEN!', 'HEISS!', 'NICHT DAS GESICHT!'][Math.floor(Math.random() * 4)], '#ff8a7a');
    this.anzeigen();
    if (this.leben <= 0) this.niederlage();
  }

  private gefahren(now: number, dt: number) {
    const hx = this.horst.x, hy = this.horst.y - 4;
    for (const z of this.zonen) if (now >= z.ab && now <= z.bis && Phaser.Math.Distance.Between(hx, hy, z.x, z.y) < z.r) this.treffer();
    this.zonen = this.zonen.filter((z) => now <= z.bis);
    for (const b of this.baender) {
      if (now < b.von) continue;
      const k = Math.min(1, (now - b.von) / b.dauer);
      const front = b.rechts ? AX0 - 20 + (AX1 - AX0 + 40) * k : AX1 + 20 - (AX1 - AX0 + 40) * k;
      if (hy > b.y0 && hy < b.y1 && (b.rechts ? hx < front : hx > front) && now < b.ende) this.treffer();
    }
    this.baender = this.baender.filter((b) => now <= b.ende);
    for (const s of this.schuesse) {
      s.sp.x += (s.vx * dt) / 1000;
      s.sp.y += (s.vy * dt) / 1000;
      if (Phaser.Math.Distance.Between(hx, hy - 8, s.sp.x, s.sp.y) < 10) { this.treffer(); s.sp.destroy(); }
    }
    this.schuesse = this.schuesse.filter((s) => {
      const drin = s.sp.active && s.sp.y < H + 20 && s.sp.x > -20 && s.sp.x < W + 20;
      if (!drin) s.sp.destroy();
      return drin;
    });
    for (const r of this.lava) if (r.contains(hx, hy + 4)) this.treffer();
  }

  private zeichneGefahren() {
    const g = this.g, f = this.feuerG, now = this.time.now;
    g.clear();
    f.clear();
    for (const z of this.zonen) {
      if (now > z.ab) continue;
      const rest = z.ab - now, pulse = 0.5 + 0.5 * Math.sin(now / 60);
      g.fillStyle(0xff1a10, 0.16 + (rest < 250 ? 0.3 : 0.1 * pulse)).fillEllipse(z.x, z.y, z.r * 2, z.r * 1.1);
      g.lineStyle(2, rest < 250 ? 0xfff0a0 : 0xff3a20, 0.9).strokeEllipse(z.x, z.y, z.r * 2, z.r * 1.1);
      const k = 1 - Math.min(1, rest / 900);
      g.lineStyle(1, 0xffb070, 0.8).strokeEllipse(z.x, z.y, z.r * 2 * (1.6 - k * 0.6), z.r * 1.1 * (1.6 - k * 0.6));
    }
    for (const b of this.baender) {
      if (now < b.von) {
        g.fillStyle(0xff2010, 0.14 + 0.1 * Math.sin(now / 50)).fillRect(AX0 - 20, b.y0, AX1 - AX0 + 40, b.y1 - b.y0);
        g.lineStyle(1, 0xff6a30, 0.9).strokeRect(AX0 - 20, b.y0, AX1 - AX0 + 40, b.y1 - b.y0);
        continue;
      }
      const k = Math.min(1, (now - b.von) / b.dauer);
      const front = b.rechts ? AX0 - 20 + (AX1 - AX0 + 40) * k : AX1 + 20 - (AX1 - AX0 + 40) * k;
      const x0 = b.rechts ? AX0 - 20 : front, x1 = b.rechts ? front : AX1 + 20;
      const fade = now > b.ende - 300 ? (b.ende - now) / 300 : 1;
      f.fillStyle(0xff4010, 0.55 * fade).fillRect(x0, b.y0, x1 - x0, b.y1 - b.y0);
      f.fillStyle(0xffb020, 0.45 * fade).fillRect(x0, b.y0 + 6, x1 - x0, b.y1 - b.y0 - 12);
      for (let x = x0; x < x1; x += 10) f.fillStyle(0xffe080, 0.4 * fade).fillTriangle(x, b.y1, x + 5, b.y0 - 6 - Math.random() * 10, x + 10, b.y1);
    }
    // Kopf am Boden und festsitzende Faust: gelber Ring als Ziel
    if ((this.betaeubtBis || this.finale) && !this.vorbei) {
      const ky = this.daemon.c.y - 100;
      g.lineStyle(2, 0xffe060, 0.6 + 0.4 * Math.sin(now / 80)).strokeEllipse(this.kopfX, ky + 8, 70, 26);
    }
    if (this.faust) g.lineStyle(2, 0xffe060, 0.5 + 0.5 * Math.sin(now / 70)).strokeEllipse(this.faust.x, this.faust.y - 2, 44, 16);
  }

  // ---------------------------------------------------------------- Effekte

  /** Kamera wackelt, gedämpft: Wucht ja, Durcheinander nein */
  private wackel(ms: number, staerke: number) {
    this.cameras.main.shake(ms * 0.8, staerke * 0.55);
  }

  /** kurzer Stillstand beim Aufprall: macht Treffer wuchtig */
  private hitStop(ms: number) {
    this.stopBis = this.time.now + ms;
    this.tweens.timeScale = 0.05;
    window.setTimeout(() => { if (this.sys.isActive() && !this.zeitlupe) this.tweens.timeScale = 1; }, ms);
  }

  private funken(x: number, y: number, farbe: number, n: number) {
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(farbe).setScale(0.05).setDepth(330);
      const a = Math.random() * Math.PI * 2, v = 10 + Math.random() * 24;
      this.tweens.add({ targets: s, x: x + Math.cos(a) * v, y: y + Math.sin(a) * v * 0.7, scale: 0.01, alpha: 0, duration: 250 + Math.random() * 200, onComplete: () => s.destroy() });
    }
  }

  private staub(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x + Phaser.Math.Between(-8, 8), y, 'light').setTint(0x8a6a5a).setAlpha(0.45).setScale(0.05).setDepth(y + 3);
      this.tweens.add({ targets: s, x: s.x + Phaser.Math.Between(-22, 22), y: s.y - Phaser.Math.Between(2, 12), scale: 0.18, alpha: 0, duration: 700, onComplete: () => s.destroy() });
    }
  }

  private welle(x: number, y: number, col: number) {
    const r = this.add.ellipse(x, y, 20, 8, col, 0).setStrokeStyle(3, col).setDepth(270);
    this.tweens.add({ targets: r, scaleX: 4, scaleY: 4, alpha: 0, duration: 420, onComplete: () => r.destroy() });
  }

  private zahl(x: number, y: number, s: string, farbe: string) {
    const t = txt(this, x, y, s, farbe).setOrigin(0.5).setDepth(460).setStroke('#120c0b', 3);
    this.tweens.add({ targets: t, y: y - 14, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------- Finale

  private finaleStart() {
    this.finale = true;
    this.aufraeumen();
    for (const k of this.kristalle) { k.sp.destroy(); k.licht.destroy(); }
    this.kristalle = [];
    this.schild?.destroy();
    this.schild = undefined;
    const d = this.daemon;
    d.setPose('kaputt');
    d.c.setDepth(140);
    this.kopfX = DX;
    this.tweens.add({ targets: d.c, x: DX, y: 272, duration: 500, ease: 'Quad.easeIn', onComplete: () => { audio.sfx('thud'); this.wackel(500, 0.016); } });
    audio.sfx('demon');
    this.zeigeBanner('ER LIEGT AM BODEN!');
    // Nicks Flying V landet in der Arena
    this.time.delayedCall(1200, () => {
      const x = this.horst.x < DX ? AX1 - 60 : AX0 + 60, y = AY1 - 20;
      const g = this.add.image(x, -20, 'nickGit').setScale(1).setDepth(y);
      this.gitarre = g;
      const l = this.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff4030).setScale(0.5).setAlpha(0).setDepth(249);
      this.tweens.add({
        targets: g, y, angle: 720, duration: 800, ease: 'Bounce.easeOut',
        onComplete: () => {
          if (!g.active) return;
          audio.sfx('stab');
          this.tweens.add({ targets: l, alpha: 0.7, duration: 300, yoyo: true, repeat: -1 });
          this.tweens.add({ targets: g, y: y - 3, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        },
      });
      this.events.once('gitarreWeg', () => l.destroy());
    });
  }

  /** Zeitlupe, die Gitarre kracht auf den Schädel: SCHEISSE! SCHEISSE! SCHEISSE! */
  private finisher() {
    this.laeuft = false;
    this.hinweisT.setText('');
    this.hinweisBg.setVisible(false);
    this.zeitlupe = true;
    this.time.timeScale = 0.3;
    this.tweens.timeScale = 0.3;
    const d = this.daemon;
    const ky = d.c.y - 100;
    const h = this.hocker;
    this.tweens.add({ targets: h, angle: h.angle + 200, x: this.kopfX, y: ky - 6, scale: 2, duration: 260 });
    this.time.delayedCall(240, () => {
      this.time.timeScale = 1;
      this.tweens.timeScale = 1;
      this.zeitlupe = false;
      audio.sfx('stab'); audio.crash(audio.now(), 0.14); audio.sfx('thud');
      this.cameras.main.flash(500, 255, 255, 255);
      this.wackel(900, 0.03);
      this.funken(this.kopfX, ky, 0xffffff, 30);
      this.funken(this.kopfX, ky, 0xff3020, 20);
      h.setVisible(false);
      // die Gitarre zerbricht
      for (let i = 0; i < 8; i++) {
        const s = this.add.rectangle(this.kopfX, ky, 3, 2, i % 2 ? 0xb81818 : 0x2a1a12).setDepth(330);
        this.tweens.add({ targets: s, x: s.x + Phaser.Math.Between(-60, 60), y: s.y + Phaser.Math.Between(-40, 30), angle: 720, alpha: 0, duration: 900, onComplete: () => s.destroy() });
      }
      ['SCHEISSE!', 'SCHEISSE!', 'SCHEISSE!'].forEach((s, i) => this.time.delayedCall(300 + i * 450, () => {
        audio.sfx('demon');
        const t = txt(this, W / 2 + (i - 1) * 110, 70 + i * 18, s, '#ff3a2a', 16).setOrigin(0.5).setDepth(470).setStroke('#120c0b', 5).setScale(0.4);
        this.tweens.add({ targets: t, scale: 1.2, duration: 220, ease: 'Back.easeOut' });
        this.tweens.add({ targets: t, alpha: 0, delay: 1200, duration: 400, onComplete: () => t.destroy() });
        this.wackel(250, 0.012);
      }));
      this.time.delayedCall(1800, () => this.sieg());
    });
  }

  private sieg() {
    this.vorbei = true;
    audio.music('none');
    const cam = this.cameras.main;
    const d = this.daemon;
    audio.sfx('demon');
    this.wackel(2600, 0.02);
    // Lichtstrahlen brechen aus dem Dämon
    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(i * 160, () => {
        const s = this.add.image(this.kopfX + Phaser.Math.Between(-60, 60), Phaser.Math.Between(140, 240), 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff8e0).setScale(0.2, 3).setAngle(Phaser.Math.Between(-60, 60)).setAlpha(0).setDepth(300);
        this.tweens.add({ targets: s, alpha: 0.9, scaleX: 0.5, duration: 300 });
        audio.sfx('crack');
      });
    }
    this.time.delayedCall(1800, () => {
      cam.flash(900, 255, 255, 255);
      audio.sfx('thunder');
      this.tweens.add({ targets: d.c, scale: 0.05, alpha: 0, duration: 900, ease: 'Quad.easeIn' });
      this.add.particles(this.kopfX, 190, 'light', {
        lifespan: 1600, speed: { min: 60, max: 220 }, scale: { start: 0.3, end: 0 }, alpha: { start: 1, end: 0 },
        tint: [0xffffff, 0xfff0a0, 0xff6a20], blendMode: 'ADD', emitting: false,
      }).setDepth(310).explode(120);
    });
    this.time.delayedCall(3600, () => {
      state.flags.nick = 'frei';
      state.flags.nickBossPhase = undefined;
      HoellenbossScene.niederlagen = 0;
      audio.stufe = 1;
      fadeTo(this, 'Cutscene', { script: 'nickFrei', next: { scene: 'Keller', data: { spawn: KELLER_SPAWN } } });
    });
  }

  private niederlage() {
    this.vorbei = true;
    this.laeuft = false;
    HoellenbossScene.niederlagen = Math.min(4, HoellenbossScene.niederlagen + 1);
    this.horst.setAngle(90);
    audio.sfx('gameover');
    this.daemon.setPose('bruell');
    const box = this.add.container(W / 2, H / 2).setDepth(500);
    box.add(this.add.rectangle(0, 0, 300, 120, 0x120608, 0.96).setStrokeStyle(2, 0xc02020));
    box.add(txt(this, 0, -40, 'DER DÄMON GEWINNT', '#ff6a5a', 16).setOrigin(0.5));
    box.add(txt(this, 0, -14, `„ZAHLUNGSVERZUG, WIRT.“ Weiter ab Phase ${this.phase + 1}, mit einem Herz mehr.`, '#d8c8b0').setOrigin(0.5).setWordWrapWidth(280));
    const again = new Btn(this, -70, 34, 120, 20, 'NOCHMAL', 0xa8342a, () => this.scene.restart());
    const weg = new Btn(this, 70, 34, 120, 20, 'IN DEN KELLER', 0x3a3040, () => this.zurueck());
    box.add([again.box, weg.box]);
    this.box = box;
    this.primary = () => this.scene.restart();
  }

  private aufgebenFrage() {
    this.laeuft = false;
    const box = this.add.container(W / 2, H / 2).setDepth(500);
    box.add(this.add.rectangle(0, 0, 260, 90, 0x120608, 0.96).setStrokeStyle(2, 0xc02020));
    box.add(txt(this, 0, -26, 'Kampf abbrechen?', '#ff6a5a').setOrigin(0.5));
    const weiter = () => { box.destroy(); this.box = undefined; this.primary = null; this.laeuft = true; };
    box.add([new Btn(this, -62, 18, 110, 20, 'WEITER', 0xa8342a, weiter).box, new Btn(this, 62, 18, 110, 20, 'IN DEN KELLER', 0x3a3040, () => this.zurueck()).box]);
    this.box = box;
    this.primary = weiter;
  }

  private zurueck() {
    this.vorbei = true;
    audio.stufe = 1;
    state.running = true;
    fadeTo(this, 'Keller', { spawn: KELLER_SPAWN });
  }

  // ---------------------------------------------------------------- Anzeigen

  private anzeigen() {
    this.herzT.setText('♥'.repeat(Math.max(0, this.leben)) + '♡'.repeat(Math.max(0, this.maxLeben - this.leben)));
    const w = 300 * (this.hp / 300);
    this.hpBar.width = w;
    this.tweens.add({ targets: this.hpGhost, width: w, duration: 500, delay: 200 });
    this.phaseT.setText(`PHASE ${this.phase + 1}/3`);
  }

  private zeigeBanner(s: string) {
    this.banner.setText(s).setAlpha(1).setScale(1.6);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 1300, duration: 400 });
  }
}
