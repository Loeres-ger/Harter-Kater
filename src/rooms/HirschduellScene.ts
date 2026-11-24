import Phaser from 'phaser';
import { audio } from '../audio';
import { Ctx, blob, r, rng, tex } from '../gfx';
import { OktopusHirsch } from '../monster/hirschRig';
import { MutantKatze } from '../monster/mutantKatze';
import { saveAuto } from '../progress/save';
import { state } from '../state';
import { addTouchControls, isTouchDevice, touch } from '../touch';
import { H, W, fadeTo, txt } from '../ui';

// Das Duell im Klärwerk (Kapitel 8, Phase 2 des Endkampfs): die Mutantenkatze mit dem Wirt auf dem Rücken gegen den
// Oktopushirsch, von der Seite wie in einem Prügelspiel. Lebensbalken oben, Superleiste unten.
//  - Katze: laufen, springen, blocken (unten halten), Krallenhieb (dreifache Kette, dritter ist ein Aufwärtshaken),
//    Biss (Ausfallschritt), aus dem Sprung Krallen auf den Kopf; Super „Neun Leben“, wenn die Leiste voll ist
//  - Hirsch: Hufstampfer (rote Ankündigung), Tentakelfeger am Boden (springen!), Augenstrahl, Röhren mit Druckwelle;
//    unter 40 % Brunft: schneller, Flutwellen
//  - Niederlage: nochmal (jedes Mal etwas leichter). Sieg: Zeitlupe, K.O., er versinkt, weiter ins Klärwerk (Ende).

const SW = 640, GY = 236, WASSER = 240;
const KATZE_S = 1.3, HIRSCH_S = 1.25;
/** kleinster Abstand Katze–Hirsch (Mitte zu Mitte) */
const NAH = 108;
const GELB = '#f8e070', GRUEN = '#b8f060', ROT = '#ff5a4a';

interface Gefahr { art: 'welle' | 'flut'; x: number; v: number; h: number; g: Phaser.GameObjects.Graphics; getroffen: boolean }

function drawSeite(c: Ctx) {
  const rnd = rng(909);
  r(c, 0, 0, SW, 270, '#0e1414');
  for (let y = 0; y < 228; y += 6) {
    r(c, 0, y + 5, SW, 1, '#080c0c');
    for (let x = (y / 6) % 2 ? 0 : 8; x < SW; x += 16) r(c, x, y, 1, 5, '#080c0c');
  }
  for (let i = 0; i < 120; i++) r(c, Math.floor(rnd() * 630), Math.floor(rnd() * 38) * 6, 15, 5, rnd() < 0.5 ? '#141c1c' : '#0a1010');
  for (const x of [34, 140, 210, 330, 470, 560, 610]) { const h = 14 + Math.floor(rnd() * 50); r(c, x, 104, 2, h, '#2a5a1a'); r(c, x, 104 + h, 2, 2, '#6ab83a'); }
  // Rohre
  r(c, 0, 24, SW, 8, '#3a3a34'); r(c, 0, 24, SW, 1, '#5a5a50'); r(c, 0, 31, SW, 1, '#1a1a16');
  r(c, 0, 40, SW, 5, '#2e2e28'); r(c, 0, 40, SW, 1, '#4a4a40');
  for (const x of [60, 250, 600]) { r(c, x, 0, 7, 228, '#33332d'); r(c, x, 0, 1, 228, '#55554b'); for (let y = 50; y < 228; y += 60) r(c, x - 1, y, 9, 4, '#44443a'); }
  // Galerie
  r(c, 0, 96, SW, 5, '#4a4a46'); r(c, 0, 96, SW, 1, '#7a7a70'); r(c, 0, 100, SW, 1, '#1a1a16');
  r(c, 0, 80, SW, 1, '#7a7a70'); for (let x = 2; x < SW; x += 10) r(c, x, 80, 1, 16, '#5a5a52');
  // Tanks
  for (const [x0, w] of [[110, 70], [300, 50]] as [number, number][]) {
    r(c, x0, 112, w, 116, '#2a3230'); r(c, x0 + 4, 112, 3, 116, '#3e4a46'); r(c, x0 + w - 6, 112, 4, 116, '#1a2020');
    for (let y = 120; y < 228; y += 22) r(c, x0, y, w, 2, '#3a4440');
    blob(c, x0 + w / 2, 112, w / 2, 5, '#323a38');
    r(c, x0 + 10, 150, 14, 8, '#c8b040'); r(c, x0 + 12, 152, 10, 1, '#3a2a10'); r(c, x0 + 12, 155, 7, 1, '#3a2a10');
  }
  // Brühe: flach vorn, tief beim Hirsch
  r(c, 0, 228, SW, 24, '#1c3a14');
  r(c, 400, 228, SW - 400, 24, '#14300e');
  for (let i = 0; i < 80; i++) r(c, Math.floor(rnd() * 630), 229 + Math.floor(rnd() * 22), 4 + Math.floor(rnd() * 8), 1, rnd() < 0.6 ? '#2e5a1e' : '#4a7a2e');
  r(c, 0, 228, SW, 1, '#5a9a3a');
  // vorderer Beckenrand
  r(c, 0, 252, SW, 18, '#3a423a'); r(c, 0, 252, SW, 1, '#6a726a'); r(c, 0, 253, SW, 1, '#4a524a');
  for (let x = 0; x < SW; x += 40) { r(c, x, 254, 1, 16, '#2a302a'); r(c, x + 14, 256, 2, 1, '#8ac83a'); }
}

export class HirschduellScene extends Phaser.Scene {
  static niederlagen = 0;
  private katze!: MutantKatze;
  private hirsch!: OktopusHirsch;
  private kx = 150;
  private ky = GY;
  private vy = 0;
  private boden = true;
  private aktion: 'frei' | 'angriff' | 'getroffen' | 'super' | 'ko' = 'frei';
  private aktionBis = 0;
  private block = false;
  private comboStufe = 0;
  private comboBis = 0;
  private lebenK = 100;
  private lebenH = 100;
  private anzeigeK = 100;
  private anzeigeH = 100;
  private superM = 0;
  private hits = 0;
  private hitsBis = 0;
  private brunft = false;
  private hirschBusy = false;
  private hirschCd = 0;
  private angriffNr = 0;
  private gefahren: Gefahr[] = [];
  private strahl?: { x: number; y: number; bis: number; getroffen: boolean };
  private fegerGetroffen = false;
  private stopBis = 0;
  private zeitlupe = false;
  private unverwundbarBis = 0;
  private laeuft = false;
  private vorbei = false;
  private touchHoch = false;
  private stepT = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private uiG!: Phaser.GameObjects.Graphics;
  private comboT!: Phaser.GameObjects.Text;
  private superT!: Phaser.GameObjects.Text;
  private brunftRot!: Phaser.GameObjects.Rectangle;
  private superKnopf?: Phaser.GameObjects.Arc;
  private superLabel?: Phaser.GameObjects.Text;

  constructor() {
    super('Hirschduell');
  }

  create() {
    this.kx = 150; this.ky = GY; this.vy = 0; this.boden = true; this.aktion = 'frei'; this.block = false;
    this.comboStufe = 0; this.comboBis = 0; this.lebenK = 100; this.lebenH = 100; this.anzeigeK = 100; this.anzeigeH = 100;
    this.superM = HirschduellScene.niederlagen > 0 ? 50 : 0; this.hits = 0; this.brunft = false; this.hirschBusy = false; this.hirschCd = 0;
    this.angriffNr = 0; this.gefahren = []; this.strahl = undefined; this.stopBis = 0; this.zeitlupe = false; this.unverwundbarBis = 0;
    this.laeuft = false; this.vorbei = false; this.touchHoch = false;
    state.running = false;
    this.scene.stop('Hud');
    this.tweens.timeScale = 1;
    if (!this.textures.exists('hdHalle')) tex(this, 'hdHalle', SW, 270, drawSeite);
    this.add.image(0, 0, 'hdHalle').setOrigin(0).setDepth(0);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, SW, H);
    const licht = (x: number, y: number, sx: number, sy: number, farbe: number, a: number, d = 5) =>
      this.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(farbe).setScale(sx, sy).setAlpha(a).setDepth(d);
    const wasser = licht(SW / 2, 238, 8, 0.8, 0x3aa02a, 0.35);
    this.tweens.add({ targets: wasser, alpha: 0.2, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    for (const x of [90, 320, 540]) {
      const l = licht(x, 60, 1.8, 2.4, 0xd8f0c0, 0.14, 400);
      this.tweens.add({ targets: l, alpha: 0.05, duration: 90, yoyo: true, repeat: -1, repeatDelay: Phaser.Math.Between(1200, 4200) });
    }
    this.brunftRot = this.add.rectangle(0, 0, W, H, 0xff1010, 0).setOrigin(0).setScrollFactor(0).setDepth(90);

    this.hirsch = new OktopusHirsch(this, 500, WASSER, HIRSCH_S).setDepth(100);
    this.hirsch.bereit();
    this.hirsch.on('schlag', (z: { x: number; y: number }) => {
      if (Math.abs(this.kx + 8 - z.x) < 46 && this.ky > GY - 34) this.schadenKatze(14, z.x);
    });
    this.hirsch.on('strahl', (z: { x: number; y: number }) => { this.strahl = { x: z.x, y: z.y, bis: this.time.now + 720, getroffen: false }; });
    this.katze = new MutantKatze(this, this.kx, this.ky, KATZE_S).setDepth(200);
    cam.scrollX = Phaser.Math.Clamp((this.kx + this.hirsch.x) / 2 - W / 2, 0, SW - W);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,E,Q,R,J,K,L,SPACE,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;
    for (const k of [this.keys.E, this.keys.J]) k.on('down', () => this.kralle());
    for (const k of [this.keys.Q, this.keys.K]) k.on('down', () => this.biss());
    for (const k of [this.keys.R, this.keys.L]) k.on('down', () => void this.superAngriff());
    for (const k of [this.keys.SPACE, this.keys.W, this.cursors.up]) k.on('down', () => this.springen());
    addTouchControls(this);
    touch.onAction = () => this.kralle();
    if (isTouchDevice(this)) {
      const knopf = (x: number, y: number, farbe: number, label: string, fn: () => void) => {
        const b = this.add.circle(x, y, 19, farbe, 0.75).setStrokeStyle(2, 0x000000, 0.8).setDepth(9500).setScrollFactor(0).setInteractive();
        const t = txt(this, x, y, label, '#0a1018').setOrigin(0.5).setDepth(9501).setScrollFactor(0);
        if (label === 'SUPER') this.superLabel = t;
        b.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); fn(); });
        return b;
      };
      knopf(W - 108, H - 40, 0xc05a4a, 'BISS', () => this.biss());
      knopf(W - 108, H - 96, 0x5a8ac0, 'HOCH', () => this.springen());
      this.superKnopf = knopf(W - 52, H - 124, 0x6aff4a, 'SUPER', () => void this.superAngriff());
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { touch.onAction = null; touch.vx = touch.vy = 0; this.tweens.timeScale = 1; });

    // Anzeige
    this.uiG = this.add.graphics().setScrollFactor(0).setDepth(1000);
    txt(this, 12, 21, 'KATZENWIRT', GELB).setScrollFactor(0).setDepth(1000);
    txt(this, W - 12, 21, 'OKTOPUSHIRSCH', '#d0a0ff').setOrigin(1, 0).setScrollFactor(0).setDepth(1000);
    this.comboT = txt(this, 12, 36, '', '#ffffff', 8).setScrollFactor(0).setDepth(1000).setStroke('#000000', 3).setAlpha(0);
    this.superT = txt(this, 12, H - 26, 'SUPER', GRUEN).setScrollFactor(0).setDepth(1000);

    audio.music('klaerwerk');
    audio.stufe = 3;
    cam.fadeIn(400, 0, 0, 0);
    void this.intro();
  }

  // ---------------------------------------------------------------- Ablauf

  private tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((done) => this.tweens.add({ ...cfg, onComplete: () => done() }));
  }
  private warte(ms: number) {
    return new Promise<void>((done) => this.time.delayedCall(ms, done));
  }

  private grossText(text: string, farbe: string, size = 24, ms = 900) {
    const t = txt(this, W / 2, H / 2 - 30, text, farbe, size).setOrigin(0.5).setScrollFactor(0).setDepth(1100).setStroke('#000000', 6).setScale(3).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, scale: 1.3, delay: ms, duration: 300, onComplete: () => t.destroy() });
    return t;
  }

  private async intro() {
    const kurz = HirschduellScene.niederlagen > 0;
    if (!kurz) {
      const a = txt(this, -160, H / 2 - 40, 'KATZENWIRT', GELB, 16).setOrigin(0.5).setScrollFactor(0).setDepth(1100).setStroke('#000000', 5);
      const b = txt(this, W + 160, H / 2 + 6, 'OKTOPUSHIRSCH', '#d0a0ff', 16).setOrigin(0.5).setScrollFactor(0).setDepth(1100).setStroke('#000000', 5);
      const vs = txt(this, W / 2, H / 2 - 16, 'VS', ROT, 16).setOrigin(0.5).setScrollFactor(0).setDepth(1100).setStroke('#000000', 5).setScale(0);
      this.tweens.add({ targets: a, x: W / 2 - 60, duration: 420, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: b, x: W / 2 + 50, duration: 420, ease: 'Cubic.easeOut' });
      void this.katze.fauchen();
      await this.warte(450);
      audio.sfx('thud');
      this.cameras.main.shake(200, 0.008);
      await this.tw({ targets: vs, scale: 1, duration: 200, ease: 'Back.easeOut' });
      void this.hirsch.roehren();
      await this.warte(1300);
      this.tweens.add({ targets: [a, b, vs], alpha: 0, duration: 300, onComplete: () => { a.destroy(); b.destroy(); vs.destroy(); } });
    }
    await this.warte(300);
    this.grossText('KAMPF!', ROT, 24, 600);
    this.cameras.main.flash(120, 255, 255, 255);
    audio.sfx('crack');
    this.laeuft = true;
    this.hirschCd = kurz ? 1200 : 1600;
    if (!kurz) {
      const hilfe = isTouchDevice(this) ? 'Stick: laufen, runter: blocken · E: Kralle · BISS · HOCH: springen' : 'A/D laufen · LEER springen · S blocken · E Kralle · Q Biss · R Super';
      const h = txt(this, W / 2, H - 12, hilfe, '#f4ead0').setOrigin(0.5).setScrollFactor(0).setDepth(1000).setBackgroundColor('#000000a0').setPadding(4, 2, 4, 2);
      this.tweens.add({ targets: h, alpha: 0, delay: 6000, duration: 600, onComplete: () => h.destroy() });
    }
  }

  update(_t: number, delta: number) {
    const dt = Math.min(delta, 40);
    this.uiMalen(dt);
    const cam = this.cameras.main;
    const ziel = Phaser.Math.Clamp((this.kx + this.hirsch.x) / 2 - W / 2, 0, SW - W);
    cam.scrollX += (ziel - cam.scrollX) * 0.08;
    if (!this.laeuft || this.vorbei) { this.katze.setPosition(this.kx, this.ky); return; }
    if (this.time.now < this.stopBis) return;
    this.katzeUpdate(dt);
    this.hirschUpdate(dt);
    this.gefahrenUpdate(dt);
    const k = { x: this.kx + 10, y: this.ky - 34 };
    if (this.strahl && !this.strahl.getroffen && this.time.now < this.strahl.bis && Phaser.Math.Distance.Between(k.x, k.y, this.strahl.x, this.strahl.y) < 38) {
      this.strahl.getroffen = true;
      this.schadenKatze(16, this.strahl.x);
    }
    const fp = this.hirsch.fegerPunkt;
    if (fp && !this.fegerGetroffen && this.ky > GY - 22 && Math.abs(fp.x - (this.kx + 10)) < 46) {
      this.fegerGetroffen = true;
      this.schadenKatze(12, fp.x);
    }
  }

  // ---------------------------------------------------------------- Katze

  private katzeUpdate(dt: number) {
    const k = this.keys, c = this.cursors, mk = this.katze;
    let ix = touch.vx;
    if (k.A.isDown || c.left.isDown) ix -= 1;
    if (k.D.isDown || c.right.isDown) ix += 1;
    ix = Phaser.Math.Clamp(ix, -1, 1);
    const runter = k.S.isDown || c.down.isDown || touch.vy > 0.55;
    const hoch = touch.vy < -0.6;
    if (hoch && !this.touchHoch) this.springen();
    this.touchHoch = hoch;
    if (this.aktion === 'getroffen' && this.time.now > this.aktionBis) this.aktion = 'frei';
    const frei = this.aktion === 'frei';
    const warBlock = this.block;
    this.block = frei && this.boden && runter;
    if (this.block && !warBlock) audio.sfx('step');
    mk.duck += ((this.block ? 1 : 0) - mk.duck) * Math.min(1, dt / 60);
    let vx = 0;
    if ((frei || (this.aktion === 'angriff' && !this.boden)) && !this.block) vx = ix * 125;
    this.kx += (vx * dt) / 1000;
    if (!this.boden) {
      this.vy += (980 * dt) / 1000;
      this.ky += (this.vy * dt) / 1000;
      if (this.ky >= GY) {
        this.ky = GY;
        if (this.vy > 200) { this.platsch(this.kx, 10); audio.sfx('splash'); }
        this.vy = 0;
        this.boden = true;
      }
    }
    const nah = this.aktion === 'angriff' || this.aktion === 'super' ? NAH - 16 : NAH;
    this.kx = Phaser.Math.Clamp(this.kx, 40, this.hirsch.x - nah);
    mk.gang = this.boden ? vx / 125 : 0;
    mk.luft = !this.boden;
    mk.setPosition(this.kx, this.ky);
    if (this.boden && Math.abs(vx) > 10) {
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 190; this.ring(this.kx + Phaser.Math.Between(-20, 30), GY + 1); }
    }
  }

  private springen() {
    if (!this.laeuft || this.vorbei || !this.boden || this.aktion !== 'frei') return;
    this.vy = -355;
    this.boden = false;
    this.block = false;
    audio.sfx('whoosh');
    this.platsch(this.kx, 8);
  }

  private kralle() {
    if (!this.laeuft || this.vorbei || this.aktion !== 'frei' || this.block) return;
    const now = this.time.now;
    this.comboStufe = now < this.comboBis ? (this.comboStufe + 1) % 3 : 0;
    const art = (this.boden ? this.comboStufe : 0) as 0 | 1 | 2;
    const luft = !this.boden;
    this.aktion = 'angriff';
    if (art === 2) this.tweens.add({ targets: this, kx: this.kx + 14, duration: 160 });
    void this.katze.kralle(art, () => this.treffen(art === 2 ? 'haken' : luft ? 'luft' : 'kralle')).then(() => {
      if (this.aktion === 'angriff') this.aktion = 'frei';
      this.comboBis = this.time.now + 420;
    });
  }

  private biss() {
    if (!this.laeuft || this.vorbei || this.aktion !== 'frei' || !this.boden || this.block) return;
    this.aktion = 'angriff';
    this.comboStufe = 0;
    this.tweens.add({ targets: this, kx: this.kx + 30, duration: 240, ease: 'Quad.easeOut' });
    for (let i = 0; i < 4; i++) this.time.delayedCall(i * 50, () => this.katze.nachbild(0xd8ffc0));
    void this.katze.biss(() => this.treffen('biss')).then(() => {
      this.tweens.add({ targets: this, kx: this.kx - 14, duration: 200 });
      if (this.aktion === 'angriff') this.aktion = 'frei';
    });
  }

  private treffen(art: 'kralle' | 'haken' | 'luft' | 'biss') {
    if (this.vorbei) return;
    const abstand = this.hirsch.x - this.kx;
    const reichweite = { kralle: 140, haken: 140, luft: 152, biss: 150 }[art];
    if (abstand > reichweite) return;
    const kopf = art === 'luft' && this.ky < GY - 24;
    let dmg = { kralle: 4, haken: 7, luft: 5, biss: 9 }[art];
    let pt = { x: this.hirsch.x - 54 + Phaser.Math.Between(-6, 6), y: art === 'haken' ? GY - 74 : GY - 30 - Phaser.Math.Between(0, 30) };
    if (kopf) {
      dmg = 8;
      pt = this.hirsch.welt({ x: Phaser.Math.Between(-14, 4), y: -66 });
      this.kurzText(pt.x, pt.y - 18, 'KOPFTREFFER!', GELB);
    }
    this.schadenHirsch(dmg, pt, art === 'biss' || art === 'haken' || kopf);
  }

  private schadenHirsch(dmg: number, pt: { x: number; y: number }, schwer: boolean) {
    if (this.vorbei) return;
    this.lebenH = Math.max(0, this.lebenH - dmg);
    void this.hirsch.treffer(pt);
    this.einschlag(pt.x, pt.y, schwer ? 0xfff0a0 : 0xffffff, schwer);
    this.cameras.main.shake(schwer ? 170 : 90, schwer ? 0.012 : 0.005);
    this.hitstop(schwer ? 110 : 55);
    this.superM = Math.min(100, this.superM + (schwer ? 10 : 6));
    audio.sfx(schwer ? 'thud' : 'slap');
    const now = this.time.now;
    this.hits = now < this.hitsBis ? this.hits + 1 : 1;
    this.hitsBis = now + 1000;
    if (this.hits >= 2) {
      this.comboT.setText(`${this.hits} TREFFER!`).setAlpha(1).setScale(1.5);
      this.tweens.killTweensOf(this.comboT);
      this.tweens.add({ targets: this.comboT, scale: 1, duration: 140, ease: 'Back.easeOut' });
      this.tweens.add({ targets: this.comboT, alpha: 0, delay: 900, duration: 300 });
    }
    if (this.lebenH <= 40 && !this.brunft && this.lebenH > 0) this.brunftStart();
    if (this.lebenH <= 0) void this.hirschKO();
  }

  private schadenKatze(n: number, vonX: number) {
    if (this.vorbei || this.aktion === 'super' || this.time.now < this.unverwundbarBis) return;
    const faktor = Math.max(0.6, 1 - HirschduellScene.niederlagen * 0.1);
    if (this.block) {
      n *= 0.25;
      this.einschlag(this.kx + 40, this.ky - 30, 0x8ac8ff, false);
      this.kurzText(this.kx + 30, this.ky - 70, 'GEBLOCKT', '#8ac8ff');
      this.tweens.add({ targets: this, kx: this.kx - 12, duration: 120 });
      this.superM = Math.min(100, this.superM + 3);
      audio.sfx('clang');
    } else {
      this.aktion = 'getroffen';
      this.aktionBis = this.time.now + 340;
      this.unverwundbarBis = this.time.now + 520;
      this.katze.treffer();
      this.tweens.add({ targets: this, kx: this.kx - (vonX > this.kx ? 34 : -34), duration: 220, ease: 'Quad.easeOut' });
      this.einschlag(this.kx + 20, this.ky - 40, 0xff6a4a, true);
      this.cameras.main.flash(80, 140, 20, 20);
      this.superM = Math.min(100, this.superM + 8);
      audio.sfx('thud');
    }
    this.lebenK = Math.max(0, this.lebenK - n * faktor);
    this.cameras.main.shake(160, 0.01);
    this.hitstop(70);
    if (this.lebenK <= 0) void this.katzeKO();
  }

  private async superAngriff() {
    if (!this.laeuft || this.vorbei || this.superM < 100 || this.aktion !== 'frei' || !this.boden) return;
    this.superM = 0;
    this.aktion = 'super';
    this.block = false;
    const mk = this.katze;
    mk.superGlut(true);
    const dunkel = this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0).setScrollFactor(0).setDepth(150);
    this.tweens.add({ targets: dunkel, fillAlpha: 0.65, duration: 200 });
    this.cameras.main.flash(120, 140, 255, 140);
    audio.sfx('sting');
    audio.sfx('growl');
    this.grossText('NEUN LEBEN!', GRUEN, 16, 700);
    await this.warte(550);
    for (let i = 0; i < 5 && !this.vorbei; i++) {
      const nach = this.time.addEvent({ delay: 24, loop: true, callback: () => mk.nachbild() });
      await this.tw({ targets: this, kx: this.hirsch.x - NAH + 14, duration: 90, ease: 'Quad.easeIn', onUpdate: () => mk.setPosition(this.kx, this.ky) });
      void mk.kralle((i % 2) as 0 | 1, () => this.schadenHirsch(4, { x: this.hirsch.x - 50, y: GY - 20 - i * 12 }, false));
      await this.warte(170);
      nach.remove();
      await this.tw({ targets: this, kx: this.kx - 46, duration: 110, ease: 'Quad.easeOut', onUpdate: () => mk.setPosition(this.kx, this.ky) });
    }
    if (!this.vorbei) {
      // zum Schluss hoch zum Kopf und zubeißen
      mk.luft = true;
      const nach = this.time.addEvent({ delay: 24, loop: true, callback: () => mk.nachbild(0xffffff) });
      await this.tw({ targets: this, kx: this.hirsch.x - NAH + 18, ky: GY - 70, duration: 220, ease: 'Quad.easeOut', onUpdate: () => mk.setPosition(this.kx, this.ky) });
      await mk.biss(() => {
        const kp = this.hirsch.welt({ x: -6, y: -70 });
        this.cameras.main.flash(160, 255, 255, 200);
        this.cameras.main.shake(300, 0.02);
        this.schadenHirsch(12, kp, true);
        this.hitstop(220);
      });
      nach.remove();
      await this.tw({ targets: this, ky: GY, duration: 260, ease: 'Quad.easeIn', onUpdate: () => mk.setPosition(this.kx, this.ky) });
      mk.luft = false;
      this.platsch(this.kx, 14);
      audio.sfx('splash');
    }
    mk.superGlut(false);
    this.tweens.add({ targets: dunkel, fillAlpha: 0, duration: 300, onComplete: () => dunkel.destroy() });
    if (this.aktion === 'super') this.aktion = 'frei';
  }

  // ---------------------------------------------------------------- Hirsch

  private hirschUpdate(dt: number) {
    if (this.hirschBusy || this.aktion === 'super') return;
    const h = this.hirsch;
    const wunsch = Phaser.Math.Clamp(this.kx + 290, 440, 560);
    const d = wunsch - h.x;
    h.x += Math.sign(d) * Math.min(Math.abs(d), (30 * dt) / 1000);
    this.hirschCd -= dt;
    if (this.hirschCd <= 0) void this.hirschAngriff();
  }

  private async hirschAngriff() {
    this.hirschBusy = true;
    this.angriffNr++;
    const abstand = this.hirsch.x - this.kx;
    const zufall = Math.random();
    let wahl: 'stampf' | 'feger' | 'strahl' | 'welle' | 'flut';
    if (this.brunft && this.angriffNr % 4 === 0) wahl = 'flut';
    else if (abstand < 200) wahl = zufall < 0.4 ? 'feger' : zufall < 0.75 ? 'stampf' : 'strahl';
    else wahl = zufall < 0.35 ? 'welle' : zufall < 0.7 ? 'strahl' : 'stampf';
    try {
      if (wahl === 'stampf') {
        await this.stampfen();
        if (this.brunft && Math.random() < 0.5 && !this.vorbei) await this.stampfen();
      } else if (wahl === 'feger') await this.fegen();
      else if (wahl === 'strahl') await this.augenstrahl();
      else await this.roehren(wahl === 'flut');
    } finally {
      this.hirschBusy = false;
      this.hirschCd = (this.brunft ? 600 : 1050) + Math.random() * 500;
    }
  }

  private async stampfen() {
    const z = { x: Phaser.Math.Clamp(this.kx + 8 + Phaser.Math.Between(-6, 16), 30, this.hirsch.x - 60), y: GY + 2 };
    const t = this.brunft ? 560 : 760;
    const mark = this.add.ellipse(z.x, GY + 2, 10, 4, 0xff2020, 0.3).setStrokeStyle(1.5, 0xff5040, 0.9).setDepth(195);
    const saeule = this.add.image(z.x, GY - 40, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xff3020).setScale(0.35, 1.4).setAlpha(0).setDepth(195);
    this.tweens.add({ targets: mark, width: 80, height: 14, duration: t, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: saeule, alpha: 0.5, duration: t * 0.8, ease: 'Quad.easeIn' });
    await this.warte(Math.max(0, t - 480));
    if (this.vorbei) { mark.destroy(); saeule.destroy(); return; }
    await this.hirsch.schlag(z);
    mark.destroy();
    saeule.destroy();
  }

  private async fegen() {
    this.fegerGetroffen = false;
    const warn = this.add.graphics().setDepth(195);
    const x0 = Math.max(10, this.kx - 170), x1 = this.hirsch.x - 70;
    const blinken = this.time.addEvent({ delay: 90, repeat: 5, callback: () => { warn.clear(); if (Math.random() < 0.7) warn.fillStyle(0xffc020, 0.35).fillRect(x0, GY - 6, x1 - x0, 6); } });
    this.kurzText(this.kx + 10, GY - 96, '!', '#ffc020');
    await this.hirsch.fegen({ x: x1, y: GY - 4 }, { x: x0, y: GY - 4 }, this.brunft ? 380 : 520);
    blinken.remove();
    warn.destroy();
  }

  private async augenstrahl() {
    const z = { x: this.kx + 10, y: GY - 34 };
    const g = this.add.graphics().setDepth(195).setBlendMode(Phaser.BlendModes.ADD);
    const ende = this.time.now + 600;
    const zeichne = () => {
      g.clear();
      if (this.time.now > ende || this.vorbei) { this.events.off(Phaser.Scenes.Events.UPDATE, zeichne); g.destroy(); return; }
      const von = this.hirsch.welt({ x: 0, y: -84 });
      g.lineStyle(1, 0xb040ff, 0.25 + Math.random() * 0.4).lineBetween(von.x, von.y, z.x, z.y);
      g.lineStyle(1.5, 0xff40c0, 0.8).strokeCircle(z.x, z.y, 16 + Math.sin(this.time.now / 40) * 3);
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, zeichne);
    await this.hirsch.strahl(z);
  }

  private async roehren(flut: boolean) {
    if (flut) this.kurzText(this.hirsch.x - 80, 70, 'FLUTWELLE!', GRUEN);
    this.hirsch.once('welle', () => {
      if (this.vorbei) return;
      this.gefahren.push({ art: flut ? 'flut' : 'welle', x: this.hirsch.x - 70, v: flut ? -210 : -280, h: flut ? 46 : 24, g: this.add.graphics().setDepth(210), getroffen: false });
      audio.sfx(flut ? 'splash' : 'rumble');
    });
    await this.hirsch.roehren();
  }

  private gefahrenUpdate(dt: number) {
    const t = this.time.now;
    for (const g of [...this.gefahren]) {
      g.x += (g.v * dt) / 1000;
      const gr = g.g;
      gr.clear();
      if (g.art === 'welle') {
        // Druckwelle über den Boden: leuchtender Bogen, Gischt
        for (let i = 0; i < 3; i++) {
          gr.lineStyle(3 - i, i ? 0x8aff5a : 0xd8ffc0, 0.8 - i * 0.2);
          gr.beginPath();
          gr.arc(g.x + i * 7, GY, g.h - i * 4, Math.PI * 1.05, Math.PI * 1.95, false);
          gr.strokePath();
        }
        gr.fillStyle(0x6aff4a, 0.3).fillEllipse(g.x + 8, GY, 28, 8);
        if (Math.random() < 0.5) this.platsch(g.x + 4, 2);
      } else {
        // Flutwelle: eine Wand aus Brühe mit Schaumkrone
        const pts: Phaser.Types.Math.Vector2Like[] = [{ x: g.x - 8, y: GY + 4 }];
        for (let i = 0; i <= 12; i++) {
          const k = i / 12;
          pts.push({ x: g.x + k * 90, y: GY - g.h * Math.sin(Math.min(1, (1 - k) * 1.4) * Math.PI / 2) + Math.sin(k * 9 + t / 80) * 2 });
        }
        pts.push({ x: g.x + 90, y: GY + 4 });
        gr.fillStyle(0x2a7a1a, 0.85).fillPoints(pts, true);
        gr.lineStyle(3, 0xd8ffc0, 0.9);
        gr.beginPath();
        gr.moveTo(pts[1].x, pts[1].y);
        for (const q of pts.slice(2, -1)) gr.lineTo(q.x, q.y);
        gr.strokePath();
        if (Math.random() < 0.7) this.platsch(g.x + Phaser.Math.Between(0, 20), 3, GY - g.h + 6);
      }
      const front = g.x;
      if (!g.getroffen && front < this.kx + 50 && front > this.kx - 40 && this.ky > GY - g.h + 6) {
        g.getroffen = true;
        this.schadenKatze(g.art === 'flut' ? 18 : 10, front + 30);
      }
      if (g.x < -100) { gr.destroy(); this.gefahren = this.gefahren.filter((x) => x !== g); }
    }
  }

  private brunftStart() {
    this.brunft = true;
    this.hirsch.brunft(true);
    this.kurzText(this.hirsch.x - 60, 60, 'BRUNFT!', ROT);
    audio.sfx('roar');
    this.cameras.main.shake(600, 0.008);
    this.tweens.add({ targets: this.brunftRot, fillAlpha: 0.1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ---------------------------------------------------------------- Ende

  private async hirschKO() {
    if (this.vorbei) return;
    this.vorbei = true;
    this.laeuft = false;
    for (const g of this.gefahren) g.g.destroy();
    this.gefahren = [];
    this.zeitlupe = true;
    this.tweens.timeScale = 0.25;
    this.cameras.main.flash(300, 255, 255, 255);
    audio.sfx('crack');
    this.grossText('K.O.', ROT, 32, 1400);
    await this.warte(1300);
    this.tweens.timeScale = 1;
    this.zeitlupe = false;
    this.tweens.killTweensOf(this.brunftRot);
    this.tweens.add({ targets: this.brunftRot, fillAlpha: 0, duration: 400 });
    this.katze.gang = 0;
    await this.hirsch.niederlage();
    await this.katze.fauchen();
    await this.warte(600);
    HirschduellScene.niederlagen = 0;
    state.flags.klaerwerk = 'ende';
    saveAuto('Klaerwerk', [0, 0]);
    fadeTo(this, 'Klaerwerk', { ende: true });
  }

  private async katzeKO() {
    if (this.vorbei) return;
    this.vorbei = true;
    this.laeuft = false;
    this.aktion = 'ko';
    await this.katze.ko();
    this.grossText('K.O.', ROT, 32, 1400);
    await this.warte(1500);
    const t = txt(this, W / 2, H / 2 + 20, 'Nochmal! (E)', GELB, 8).setOrigin(0.5).setScrollFactor(0).setDepth(1100).setStroke('#000000', 4).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: t, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
    const nochmal = () => { HirschduellScene.niederlagen++; this.scene.restart(); };
    t.on('pointerdown', nochmal);
    this.input.keyboard!.once('keydown-E', nochmal);
    this.input.keyboard!.once('keydown-ENTER', nochmal);
    touch.onAction = nochmal;
  }

  // ---------------------------------------------------------------- Effekte und Anzeige

  private hitstop(ms: number) {
    this.stopBis = this.time.now + ms;
    if (this.zeitlupe) return;
    this.tweens.timeScale = 0.08;
    this.time.delayedCall(ms, () => { if (!this.zeitlupe) this.tweens.timeScale = 1; });
  }

  /** Treffer: Lichtblitz, Sternstrahlen, Funken */
  private einschlag(x: number, y: number, farbe: number, gross: boolean) {
    const l = this.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(farbe).setScale(0.2).setAlpha(1).setDepth(300);
    this.tweens.add({ targets: l, scale: gross ? 1.4 : 0.8, alpha: 0, duration: gross ? 320 : 200, ease: 'Quad.easeOut', onComplete: () => l.destroy() });
    const g = this.add.graphics({ x, y }).setBlendMode(Phaser.BlendModes.ADD).setDepth(301);
    const n = gross ? 10 : 6;
    for (let i = 0; i < n; i++) {
      const w = (i / n) * Math.PI * 2 + Math.random() * 0.4, len = (gross ? 26 : 16) * (0.6 + Math.random() * 0.6);
      g.lineStyle(gross ? 2 : 1.4, i % 2 ? farbe : 0xffffff, 1).lineBetween(Math.cos(w) * 4, Math.sin(w) * 4, Math.cos(w) * len, Math.sin(w) * len);
    }
    g.setScale(0.4);
    this.tweens.add({ targets: g, scale: 1.2, alpha: 0, duration: gross ? 260 : 180, ease: 'Quad.easeOut', onComplete: () => g.destroy() });
    for (let i = 0; i < (gross ? 14 : 7); i++) {
      const o = this.add.circle(x, y, Phaser.Math.FloatBetween(0.8, 1.8), i % 2 ? 0x8ac83a : farbe).setDepth(302);
      const w = Math.random() * Math.PI * 2, v = Phaser.Math.Between(18, gross ? 60 : 36);
      this.tweens.add({ targets: o, x: x + Math.cos(w) * v, y: y + Math.sin(w) * v + 14, alpha: 0, duration: Phaser.Math.Between(260, 520), ease: 'Quad.easeOut', onComplete: () => o.destroy() });
    }
  }

  private platsch(x: number, n: number, y = GY) {
    for (let i = 0; i < n; i++) {
      const o = this.add.circle(x + Phaser.Math.Between(-10, 10), y, Phaser.Math.FloatBetween(0.8, 1.8), i % 3 ? 0x6ab83a : 0xd8f0d0, 0.9).setDepth(205);
      this.tweens.add({ targets: o, y: y - Phaser.Math.Between(6, 22), x: o.x + Phaser.Math.Between(-12, 12), duration: 220, yoyo: true, ease: 'Quad.easeOut', onComplete: () => o.destroy() });
    }
  }

  private ring(x: number, y: number) {
    const r0 = this.add.ellipse(x, y, 6, 2).setStrokeStyle(1, 0x8ac83a, 0.8).setDepth(190);
    this.tweens.add({ targets: r0, scaleX: 4, scaleY: 3, alpha: 0, duration: 500, onComplete: () => r0.destroy() });
  }

  private kurzText(x: number, y: number, text: string, farbe: string) {
    const t = txt(this, x, y, text, farbe).setOrigin(0.5).setDepth(1050).setStroke('#000000', 3);
    this.tweens.add({ targets: t, y: y - 14, alpha: 0, delay: 500, duration: 500, onComplete: () => t.destroy() });
  }

  private uiMalen(dt: number) {
    const g = this.uiG, bw = 196;
    this.anzeigeK += (this.lebenK - this.anzeigeK) * Math.min(1, dt / 400);
    this.anzeigeH += (this.lebenH - this.anzeigeH) * Math.min(1, dt / 400);
    g.clear();
    const balken = (x: number, rechts: boolean, wert: number, nachlauf: number, farbe: number) => {
      g.fillStyle(0x000000, 0.7).fillRect(x - 2, 8, bw + 4, 12);
      g.fillStyle(0x3a0a0a, 1).fillRect(x, 10, bw, 8);
      const n = (bw * nachlauf) / 100, w = (bw * wert) / 100;
      g.fillStyle(0xff4a2a, 1).fillRect(rechts ? x + bw - n : x, 10, n, 8);
      g.fillStyle(farbe, 1).fillRect(rechts ? x + bw - w : x, 10, w, 8);
      g.fillStyle(0xffffff, 0.35).fillRect(rechts ? x + bw - w : x, 10, w, 2);
    };
    balken(12, false, this.lebenK, this.anzeigeK, this.lebenK < 30 ? 0xffa020 : 0xf8d040);
    balken(W - 12 - bw, true, this.lebenH, this.anzeigeH, this.brunft ? 0xff5a8a : 0xb070ff);
    // Superleiste
    const voll = this.superM >= 100;
    const blink = voll && Math.floor(this.time.now / 160) % 2 === 0;
    g.fillStyle(0x000000, 0.7).fillRect(10, H - 16, 124, 8);
    g.fillStyle(voll ? (blink ? 0xffffff : 0x8aff5a) : 0x4aa02a, 1).fillRect(12, H - 14, (120 * this.superM) / 100, 4);
    this.superT.setText(voll ? (isTouchDevice(this) ? 'SUPER BEREIT!' : 'SUPER BEREIT! (R)') : 'SUPER').setColor(voll && blink ? '#ffffff' : GRUEN);
    this.superKnopf?.setVisible(voll);
    this.superLabel?.setVisible(voll);
  }
}
