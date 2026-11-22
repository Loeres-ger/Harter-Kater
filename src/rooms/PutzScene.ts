import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { isTouchDevice } from '../touch';
import { H, W, txt } from '../ui';
import { Btn } from '../scenes/ShopScene';

// Putz-Minispiel im Masala Basar: Adshayans Curry von den Fliesen schrubben. Mit gedrückter Maus oder dem
// Finger über die Flecken wischen (oder den Schwamm mit den Pfeiltasten bewegen). Adshayan torkelt dabei oben
// über die Fliesen, wird sechsmal grün und spuckt einen Curry-Strahl quer über den Boden (gern dorthin, wo gerade
// geschrubbt wird). Flecken, die zu lange liegen, trocknen an und brauchen länger. Zweimal spritzt es auf den
// Bildschirm. Nach der letzten Attacke alles sauber, bevor die Zeit abläuft: gewonnen.

export interface PutzData {
  resume: string;
  onDone?: (win: boolean) => void;
}

/** Spielfläche (Fliesen) und Zeit */
const FX = 14, FY = 34, FW = 340, FH = 222;
const ZEIT = 45;
const START_FLECKEN = 5;
/** Kotzattacken: wann (Sekunden nach Beginn) und wie viele Flecken der Strahl hinterlässt */
const NACHSCHUB = [2.5, 9.5, 16.5, 23, 29.5, 35.5];
const STRAHL_FLECKEN = [2, 2, 3, 3, 3, 4];
/** bei diesen Attacken (Index) spritzt es auch auf den Bildschirm */
const SPRITZ_AUF_SCHIRM = [2, 4];
/** so viele Pixel Schrubben braucht ein Fleck je Pixel Radius; angetrocknet (nach TROCKEN s) das 1,6-Fache */
const ARBEIT = 40, TROCKEN = 9, TROCKEN_FAKTOR = 1.6;
/** Pfeiltasten: Tempo des Schwamms und wie stark das Schrubben zählt */
const TASTEN_TEMPO = 220, TASTEN_FAKTOR = 3.2;
/** Adshayan läuft oben auf dieser Höhe (Füße) hin und her */
const AY = FY + 52, A_SCALE = 1.25;
/** neue Flecken nur unterhalb von Adshayan */
const BODEN_OBEN = FY + 70;
const CURRY_FARBEN = [0xd8901a, 0xe8a82a, 0xc07010, 0xb86a10];

interface Fleck { img: Phaser.GameObjects.Image; r: number; dreck: number; fertig: boolean; seit: number; trocken: boolean }

const LOB = ['Danke!', 'Du bist ein Engel!', 'Der glänzt ja!', 'Nicht hinsehen, nur wischen!', 'Ich schäme mich so.', 'Wie neu!', 'Du hast Talent!'];

export class PutzScene extends Phaser.Scene {
  private cfg!: PutzData;
  private wasRunning = false;
  private flecken: Fleck[] = [];
  private schwamm!: Phaser.GameObjects.Image;
  private bar!: Phaser.GameObjects.Rectangle;
  private stand!: Phaser.GameObjects.Text;
  private spruch!: Phaser.GameObjects.Text;
  private bustImg!: Phaser.GameObjects.Image;
  private ui?: Phaser.GameObjects.Container;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private laeuft = false;
  private zeit = 0;
  private nachschub = 0;
  private letzte?: Phaser.Math.Vector2;
  private geraeusch = 0;
  private spruchBis = 0;
  /** Adshayan ist gerade dabei, nachzulegen */
  private kommtNoch = false;
  /** zählt die Runden, damit verspätete Ereignisse einer alten Runde nichts mehr tun */
  private rundeNr = 0;
  /** Adshayan auf den Fliesen: Figur, Ziel beim Torkeln, ob er gerade spuckt */
  private adsh!: Phaser.GameObjects.Sprite;
  private adshZiel = 0;
  private spuckt = false;
  private spritzer: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Putzen');
  }

  create(data: PutzData) {
    audio.zwischen(this, 'putzen');
    this.cfg = data;
    this.wasRunning = state.running;
    state.running = false;
    this.flecken = [];
    this.laeuft = false;
    this.ui = undefined;
    this.letzte = undefined;
    this.scene.bringToTop();
    // der Raum dahinter muss nicht mitgezeichnet werden (spart auf dem Handy viel)
    this.scene.setVisible(false, data.resume);

    this.add.rectangle(0, 0, W, H, 0x1a0c08).setOrigin(0);
    this.boden();
    txt(this, FX, 10, 'CURRY-ALARM IM MASALA BASAR', '#f0c040', 8);
    this.stand = txt(this, FX + FW, 10, '', '#f4ead0').setOrigin(1, 0);
    this.add.rectangle(FX, 24, FW, 5, 0x3a2016).setOrigin(0);
    this.bar = this.add.rectangle(FX, 24, FW, 5, 0xf0b020).setOrigin(0);

    // rechts: Adshayan feuert an (und wird manchmal grün)
    this.add.rectangle(FX + FW + 6, FY, W - FX - FW - 20, FH, 0x2a140c).setOrigin(0).setStrokeStyle(1, 0x7a3a1e);
    const bx = (FX + FW + W - 14) / 2 + 3;
    this.bustImg = this.add.image(bx, FY + FH - 2, 'nbust_adshayanSad').setOrigin(0.5, 1).setScale(0.5);
    this.spruch = txt(this, bx, FY + 30, '', '#f8e0a0').setOrigin(0.5).setWordWrapWidth(98).setAlign('center');

    this.schwamm = this.add.image(FX + FW / 2, FY + FH / 2, 'basarSchwamm').setDepth(50).setVisible(false);
    if (!this.anims.exists('adshayan_side')) {
      this.anims.create({ key: 'adshayan_side', frames: [7, 6, 8, 6].map((n) => ({ key: 'adshayan', frame: n })), frameRate: 7, repeat: -1 });
    }
    this.adsh = this.add.sprite(FX + FW / 2, AY, 'adshayan', 0).setOrigin(0.5, 1).setScale(A_SCALE).setDepth(30);
    this.add.ellipse(0, 0, 18, 5, 0x000000, 0.25).setDepth(29).setName('adshSchatten');
    this.adshZiel = this.adsh.x;

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({ up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D }) as typeof this.keys;
    kb.on('keydown-ESC', () => this.close(false));
    kb.on('keydown-SPACE', () => this.uiAktion?.());
    kb.on('keydown-ENTER', () => this.uiAktion?.());

    this.input.on('pointermove', (pt: Phaser.Input.Pointer) => this.zeiger(pt));
    this.input.on('pointerdown', (pt: Phaser.Input.Pointer) => { this.letzte = new Phaser.Math.Vector2(pt.x, pt.y); this.zeiger(pt); });
    this.input.on('pointerup', () => { this.letzte = undefined; });

    this.intro();
    this.cameras.main.fadeIn(150);
  }

  private uiAktion?: () => void;

  /** Fliesenboden der Spielfläche, mit Rand aus Regalen */
  private boden() {
    const g = this.add.graphics();
    g.fillStyle(0x5a2a18).fillRect(FX - 4, FY - 4, FW + 8, FH + 8);
    const S = 37;
    for (let y = 0; y < FH; y += S) for (let x = 0; x < FW; x += S) {
      g.fillStyle(((x + y) / S) % 2 ? 0xe4d0a8 : 0xdcc496).fillRect(FX + x, FY + y, Math.min(S, FW - x), Math.min(S, FH - y));
      g.fillStyle(0xc8402a).fillRect(FX + x + S / 2 - 1, FY + y + S / 2 - 1, 2, 2);
    }
    g.lineStyle(1, 0xb8986a, 0.8);
    for (let x = 0; x <= FW; x += S) g.lineBetween(FX + x, FY, FX + x, FY + FH);
    for (let y = 0; y <= FH; y += S) g.lineBetween(FX, FY + y, FX + FW, FY + y);
  }

  private intro() {
    const touch = isTouchDevice(this);
    this.zeigeUi([
      'ADSHAYAN BRAUCHT HILFE',
      '',
      touch ? 'Wisch mit dem Finger über die' : 'Halt die Maustaste gedrückt und',
      touch ? 'Curry-Flecken, bis sie weg sind.' : 'schrubb über die Flecken.',
      touch ? '' : '(Oder Pfeiltasten: Schwamm bewegen.)',
      '',
      `Du hast ${ZEIT} Sekunden. Und Adshayan`,
      'ist noch lange nicht über den Berg.',
    ], 'LOS', () => this.runde());
    this.sag('Bitte, bitte hilf mir!', 99999);
  }

  /** Fenster in der Mitte der Spielfläche mit Text und Knopf (und optional einem zweiten) */
  private zeigeUi(zeilen: string[], knopf: string, los: () => void, zweit?: [string, () => void]) {
    this.ui?.destroy();
    const box = this.add.container(FX + FW / 2, FY + FH / 2).setDepth(100);
    box.add(this.add.rectangle(0, 0, 300, 160, 0x1a0c08, 0.94).setStrokeStyle(2, 0xf0b020));
    zeilen.forEach((z, i) => box.add(txt(this, 0, -64 + i * 13, z, i === 0 ? '#f0c040' : '#f4ead0').setOrigin(0.5)));
    const a = () => { this.uiAktion = undefined; box.destroy(); this.ui = undefined; los(); };
    box.add(new Btn(this, zweit ? -70 : 0, 56, 120, 22, knopf, 0x3a7a2a, a).box);
    if (zweit) box.add(new Btn(this, 70, 56, 120, 22, zweit[0], 0x5a2a20, () => { this.uiAktion = undefined; zweit[1](); }).box);
    this.uiAktion = a;
    this.ui = box;
  }

  private runde() {
    for (const f of this.flecken) f.img.destroy();
    for (const o of this.spritzer) o.destroy();
    this.spritzer = [];
    this.flecken = [];
    this.spuckt = false;
    this.adsh.clearTint().setScale(A_SCALE).setFrame(0);
    this.zeit = ZEIT;
    for (let i = 0; i < START_FLECKEN; i++) this.neuerFleck(false);
    this.nachschub = 0;
    this.kommtNoch = false;
    this.rundeNr++;
    this.laeuft = true;
    this.schwamm.setVisible(true);
    this.bustImg.setTexture('nbust_adshayanSad').clearTint();
    this.sag('Danke, danke, danke!');
    this.anzeige();
  }

  /** neuer Fleck an einer freien Stelle; mit Platsch, wenn er gerade erst entsteht */
  private neuerFleck(platsch: boolean, wo?: { x: number; y: number }) {
    let x = 0, y = 0, rr = 0;
    if (wo) {
      rr = Phaser.Math.Between(13, 19);
      x = Phaser.Math.Clamp(wo.x, FX + rr + 2, FX + FW - rr - 2);
      y = Phaser.Math.Clamp(wo.y, BODEN_OBEN + rr, FY + FH - rr - 2);
    } else for (let tries = 0; tries < 40; tries++) {
      rr = Phaser.Math.Between(15, 22);
      x = Phaser.Math.Between(FX + rr + 4, FX + FW - rr - 4);
      y = Phaser.Math.Between(BODEN_OBEN + rr, FY + FH - rr - 4);
      if (this.flecken.every((f) => f.fertig || Phaser.Math.Distance.Between(x, y, f.img.x, f.img.y) > f.r + rr + 6)) break;
    }
    const img = this.add.image(x, y, `basarFleck${Phaser.Math.Between(0, 2)}`).setDepth(10)
      .setAngle(Phaser.Math.Between(0, 3) * 90).setFlipX(Math.random() < 0.5);
    const scale = (rr * 2) / 40;
    if (platsch) {
      img.setScale(0);
      this.tweens.add({ targets: img, scale, duration: 220, ease: 'Back.easeOut' });
      for (let i = 0; i < 6; i++) {
        const d = this.add.circle(x, y, 2, 0xd8901a).setDepth(11);
        this.tweens.add({ targets: d, x: x + Phaser.Math.Between(-30, 30), y: y + Phaser.Math.Between(-24, 24), alpha: 0, duration: 380, onComplete: () => d.destroy() });
      }
    } else img.setScale(scale);
    this.flecken.push({ img, r: rr, dreck: 1, fertig: false, seit: this.zeit, trocken: false });
  }

  private zeiger(pt: Phaser.Input.Pointer) {
    if (!this.laeuft) return;
    const x = Phaser.Math.Clamp(pt.x, FX, FX + FW), y = Phaser.Math.Clamp(pt.y, FY, FY + FH);
    this.schwamm.setPosition(x, y);
    if (!pt.isDown) return;
    if (this.letzte) this.schrubb(Phaser.Math.Distance.Between(this.letzte.x, this.letzte.y, x, y));
    this.letzte = new Phaser.Math.Vector2(x, y);
  }

  /** Schrubben an der Position des Schwamms: jeder Fleck unter dem Schwamm wird blasser */
  private schrubb(weg: number) {
    if (weg <= 0 || !this.laeuft) return;
    const { x, y } = this.schwamm;
    let traf = false;
    for (const f of this.flecken) {
      if (f.fertig || Phaser.Math.Distance.Between(x, y, f.img.x, f.img.y) > f.r + 9) continue;
      traf = true;
      f.dreck -= weg / (ARBEIT * f.r * (f.trocken ? TROCKEN_FAKTOR : 1));
      f.img.setAlpha(0.15 + 0.85 * Math.max(0, f.dreck));
      if (f.dreck <= 0) this.sauber(f);
    }
    if (!traf) return;
    this.schwamm.setAngle(Phaser.Math.Between(-12, 12));
    if (Math.random() < Math.min(1, weg / 18)) {
      const b = this.add.circle(x + Phaser.Math.Between(-9, 9), y + Phaser.Math.Between(-6, 6), Phaser.Math.Between(1, 3), 0xffffff, 0.85).setDepth(40);
      this.tweens.add({ targets: b, y: b.y - 6, alpha: 0, scale: 1.6, duration: 450, onComplete: () => b.destroy() });
    }
    if (this.time.now > this.geraeusch) { audio.sfx('rummage'); this.geraeusch = this.time.now + 320; }
  }

  private sauber(f: Fleck) {
    f.fertig = true;
    audio.sfx('chime');
    this.tweens.add({ targets: f.img, alpha: 0, duration: 200, onComplete: () => f.img.destroy() });
    // kurzes Glitzern
    for (let i = 0; i < 4; i++) {
      const s = this.add.star(f.img.x + Phaser.Math.Between(-f.r, f.r), f.img.y + Phaser.Math.Between(-f.r, f.r), 4, 1, 3, 0xffffff).setDepth(41);
      this.tweens.add({ targets: s, scale: 0, angle: 90, duration: 500, delay: i * 60, onComplete: () => s.destroy() });
    }
    this.bustImg.setTexture('nbust_adshayan');
    this.sag(Phaser.Utils.Array.GetRandom(LOB));
    this.anzeige();
    if (!this.flecken.every((x) => x.fertig) || this.kommtNoch) return;
    if (this.nachschub >= NACHSCHUB.length) return this.gewonnen();
    // alles sauber, aber Adshayan ist noch nicht fertig: dann eben jetzt
    this.kommtNoch = true;
    const nr = this.rundeNr;
    this.time.delayedCall(700, () => this.laeuft && nr === this.rundeNr && this.schlecht());
  }

  private sag(s: string, ms = 1600) {
    this.spruch.setText(s);
    this.spruchBis = this.time.now + ms;
  }

  private anzeige() {
    const offen = this.flecken.filter((f) => !f.fertig).length;
    this.stand.setText(`FLECKEN: ${offen}`);
  }

  /** Adshayan wird grün, zittert ... und spuckt einen Curry-Strahl quer über die Fliesen */
  private schlecht() {
    const welle = this.nachschub++;
    this.kommtNoch = true;
    this.spuckt = true;
    const nr = this.rundeNr;
    const a = this.adsh;
    a.anims.stop();
    a.setFrame(0).setTint(0xb8e0a0);
    this.bustImg.setTexture('nbust_adshayanSad').setTint(0xb8e0a0);
    this.sag(Phaser.Utils.Array.GetRandom(['Oh nein ... nicht schon wieder ...', 'Ich glaub ... da kommt noch was ...', 'WEG DA! WEG DA!', 'Es tut mir so leid ...']), 2200);
    audio.sfx('retch');
    // Vorwarnung: zittern, Backen blähen, Ausrufezeichen
    const warn = txt(this, a.x, a.y - 66, '!!', '#ff4a3a', 16).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: warn, y: warn.y - 4, duration: 120, yoyo: true, repeat: 3, onComplete: () => warn.destroy() });
    this.tweens.add({ targets: a, x: a.x + 2, duration: 50, yoyo: true, repeat: 8 });
    this.tweens.add({ targets: a, scaleX: A_SCALE * 1.12, scaleY: A_SCALE * 0.92, duration: 450, ease: 'Sine.easeIn' });
    this.time.delayedCall(900, () => {
      if (!this.laeuft || nr !== this.rundeNr) return;
      this.strahl(welle, nr);
    });
  }

  /** Der Strahl: Tropfen fliegen im Bogen aus Adshayans Mund und wandern dabei über den Boden */
  private strahl(welle: number, nr: number) {
    const a = this.adsh;
    audio.sfx('puke');
    this.cameras.main.shake(260, 0.006);
    this.tweens.add({ targets: a, scaleX: A_SCALE * 0.95, scaleY: A_SCALE * 1.08, duration: 120, yoyo: true, repeat: 4 });
    const mx = a.x + 2, my = a.y - 34 * A_SCALE;
    // Strahl-Linie auf dem Boden: oft quer durch die Stelle, an der gerade geschrubbt wird
    const sw = this.schwamm;
    const quer = Phaser.Math.FloatBetween(-0.5, 0.5);
    let cx = sw.x, cy = sw.y;
    if (!sw.visible || Math.random() < 0.4 || cy < BODEN_OBEN) { cx = Phaser.Math.Between(FX + 50, FX + FW - 50); cy = Phaser.Math.Between(BODEN_OBEN + 30, FY + FH - 30); }
    const len = Phaser.Math.Between(110, 180);
    const ax = cx - Math.cos(quer) * len / 2, ay = cy - Math.sin(quer) * len / 2;
    const bx = cx + Math.cos(quer) * len / 2, by = cy + Math.sin(quer) * len / 2;
    const dauer = 1300, tropfen = 78;
    const n = STRAHL_FLECKEN[welle] ?? 3;
    const fleckBei = new Set(Array.from({ length: n }, (_, i) => Math.round(((i + 0.5) / n) * (tropfen - 1))));
    for (let i = 0; i < tropfen; i++) {
      this.time.delayedCall((i / tropfen) * dauer, () => {
        if (!this.laeuft || nr !== this.rundeNr) return;
        const t = i / (tropfen - 1);
        const zx = Phaser.Math.Linear(ax, bx, t) + Phaser.Math.Between(-6, 6), zy = Phaser.Math.Linear(ay, by, t) + Phaser.Math.Between(-5, 5);
        this.tropfen(mx, my, zx, zy, fleckBei.has(i));
      });
    }
    // Spritzer auf den Bildschirm
    if (SPRITZ_AUF_SCHIRM.includes(welle)) this.time.delayedCall(dauer * 0.6, () => this.laeuft && nr === this.rundeNr && this.aufDenSchirm());
    this.time.delayedCall(dauer + 500, () => {
      if (!this.laeuft || nr !== this.rundeNr) return;
      this.kommtNoch = false;
      this.spuckt = false;
      a.clearTint();
      this.tweens.add({ targets: a, scaleX: A_SCALE, scaleY: A_SCALE, duration: 200 });
      this.bustImg.clearTint();
      this.sag(Phaser.Utils.Array.GetRandom(['ENTSCHULDIGUNG!', 'Das war das letzte Mal! ... Vielleicht.', 'Schneller! Bevor es antrocknet!']), 1800);
      this.anzeige();
    });
  }

  /** ein Tropfen im Bogen von (mx, my) nach (zx, zy); beim Aufprall spritzt es, ggf. entsteht ein Fleck */
  private tropfen(mx: number, my: number, zx: number, zy: number, fleck: boolean) {
    const r = Phaser.Math.FloatBetween(2.4, 4.8);
    const d = this.add.circle(mx, my, r, Phaser.Utils.Array.GetRandom(CURRY_FARBEN)).setDepth(32);
    const bogen = Phaser.Math.Between(36, 62), dauer = Phaser.Math.Between(330, 430);
    this.tweens.addCounter({
      from: 0, to: 1, duration: dauer,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        d.setPosition(Phaser.Math.Linear(mx, zx, t), Phaser.Math.Linear(my, zy, t) - bogen * 4 * t * (1 - t));
        d.setScale(1 + 0.4 * Math.sin(t * Math.PI));
      },
      onComplete: () => {
        d.destroy();
        if (!this.laeuft) return;
        // Aufprall: kleine Spritzer nach außen
        for (let k = 0; k < 3; k++) {
          const sp = this.add.circle(zx, zy, Phaser.Math.FloatBetween(0.8, 1.8), Phaser.Utils.Array.GetRandom(CURRY_FARBEN)).setDepth(12);
          this.tweens.add({ targets: sp, x: zx + Phaser.Math.Between(-14, 14), y: zy + Phaser.Math.Between(-9, 9), alpha: 0, duration: Phaser.Math.Between(220, 380), onComplete: () => sp.destroy() });
        }
        if (fleck) {
          audio.sfx('splash');
          this.neuerFleck(true, { x: zx, y: zy });
          this.anzeige();
        }
      },
    });
  }

  /** Ein Schwall landet auf dem Bildschirm: große Kleckse, die langsam herunterlaufen und verblassen */
  private aufDenSchirm() {
    audio.sfx('splash');
    this.sag('IGITT! Sorry! SORRY!', 1600);
    for (let k = 0; k < Phaser.Math.Between(2, 3); k++) {
      const x = Phaser.Math.Between(FX + 40, FX + FW - 40), y = Phaser.Math.Between(FY + 40, FY + FH - 40);
      const b = this.add.image(x, y, `basarFleck${Phaser.Math.Between(0, 2)}`).setDepth(95).setAlpha(0.92)
        .setScale(0.2).setAngle(Phaser.Math.Between(0, 359));
      this.spritzer.push(b);
      const gross = Phaser.Math.FloatBetween(2.4, 3.4);
      this.tweens.add({ targets: b, scale: gross, duration: 140, ease: 'Back.easeOut' });
      this.tweens.add({ targets: b, y: y + 26, scaleY: gross * 1.15, duration: 3600, delay: 300, ease: 'Sine.easeIn' });
      this.tweens.add({ targets: b, alpha: 0, duration: 900, delay: 2800, onComplete: () => b.destroy() });
    }
  }

  /** Adshayan torkelt oben über die Fliesen, solange er nicht spuckt */
  private torkeln(dt: number) {
    const a = this.adsh;
    const schatten = this.children.getByName('adshSchatten') as Phaser.GameObjects.Ellipse | null;
    schatten?.setPosition(a.x, a.y - 1);
    if (this.spuckt) return;
    if (Math.abs(this.adshZiel - a.x) < 2) this.adshZiel = Phaser.Math.Between(FX + 30, FX + FW - 30);
    const dir = Math.sign(this.adshZiel - a.x);
    a.x += dir * 34 * dt;
    a.y = AY + Math.sin(this.time.now / 180) * 1.2;
    a.setAngle(Math.sin(this.time.now / 260) * 5);
    a.anims.play('adshayan_side', true);
    a.setFlipX(dir < 0);
  }

  private gewonnen() {
    this.laeuft = false;
    this.schwamm.setVisible(false);
    audio.sfx('kaching');
    this.bustImg.setTexture('nbust_adshayan').clearTint();
    this.sag('BLITZBLANK! Du bist mein Held!', 99999);
    this.tweens.add({ targets: this.bustImg, y: this.bustImg.y - 6, duration: 160, yoyo: true, repeat: 3 });
    this.time.delayedCall(900, () => this.zeigeUi(['BLITZBLANK!', '', 'Kein Curry mehr auf den Fliesen.', 'Der Masala Basar kann öffnen.'], 'WEITER', () => this.close(true)));
  }

  private verloren() {
    this.laeuft = false;
    this.schwamm.setVisible(false);
    this.letzte = undefined;
    audio.sfx('error');
    this.bustImg.setTexture('nbust_adshayanSad').clearTint();
    this.sag('Fast! Nur noch ein bisschen!', 99999);
    const rest = this.flecken.filter((f) => !f.fertig).length;
    this.zeigeUi(['ZEIT UM', '', `Noch ${rest} ${rest === 1 ? 'Fleck' : 'Flecken'} auf dem Boden.`, 'Adshayan glaubt an dich.'], 'NOCHMAL', () => this.runde(), ['AUFHÖREN', () => this.close(false)]);
  }

  update(_t: number, delta: number) {
    if (this.time.now > this.spruchBis && this.spruch.text) this.spruch.setText('');
    if (!this.laeuft) return;
    const dt = delta / 1000;
    this.zeit -= dt;
    this.bar.width = FW * Math.max(0, this.zeit / ZEIT);
    if (this.zeit < 10) this.bar.setFillStyle(Math.floor(this.zeit * 4) % 2 ? 0xd02a2a : 0xf0b020);
    else this.bar.setFillStyle(0xf0b020);

    this.torkeln(dt);
    // Flecken, die zu lange liegen, trocknen an: dunkler, zäher
    for (const f of this.flecken) {
      if (f.fertig || f.trocken || f.seit - this.zeit < TROCKEN) continue;
      f.trocken = true;
      f.img.setTint(0xa86a30);
      this.tweens.add({ targets: f.img, scale: f.img.scale * 0.94, duration: 300 });
    }

    const lief = ZEIT - this.zeit;
    if (!this.kommtNoch && this.nachschub < NACHSCHUB.length && lief >= NACHSCHUB[this.nachschub]) this.schlecht();

    // Pfeiltasten: Schwamm bewegen, Bewegung schrubbt
    const k = this.keys;
    const vx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const vy = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    if (vx || vy) {
      const n = Math.hypot(vx, vy), d = TASTEN_TEMPO * dt;
      this.schwamm.setPosition(
        Phaser.Math.Clamp(this.schwamm.x + (vx / n) * d, FX, FX + FW),
        Phaser.Math.Clamp(this.schwamm.y + (vy / n) * d, FY, FY + FH),
      );
      this.schrubb(d * TASTEN_FAKTOR);
    }

    if (this.laeuft && this.zeit <= 0) this.verloren();
  }

  private close(win: boolean) {
    state.running = this.wasRunning;
    const { resume, onDone } = this.cfg;
    this.scene.setVisible(true, resume);
    this.scene.resume(resume);
    this.scene.stop();
    onDone?.(win);
  }
}
