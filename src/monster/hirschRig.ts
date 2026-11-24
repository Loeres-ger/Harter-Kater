import Phaser from 'phaser';
import { audio } from '../audio';
import {
  BAUCH, GLANZ, HAUT, HAUT_D, KNOCHEN, NAPF, NAPF_D, FLEISCH, OKTO_AUGEN, OKTO_GEWEIH_L, OKTO_GEWEIH_R, OKTO_HALS, OKTO_HERZ, OKTO_HOEHLE, OKTO_KIEFER,
  OKTO_W, OKTO_WASSER, makeOktopushirschTextures,
} from './oktopushirsch';

// Der Oktopushirsch als bewegliche Figur. Ein Container mit Teilen: Leib, Herz, Kopf (mit Kiefer, Maulhöhle, Geweih
// und acht Augen) und sechs Armen, die jedes Bild weich neu gezeichnet werden. Ursprung (0, 0) ist die Wasserlinie in
// der Mitte; Leib, Kopf und ruhende Arme werden unter der Wasserlinie abgeschnitten (er steckt im Becken).
//
// Licht und Effekte leben als eigene Objekte in der Szene (additiv): grüner Schein aus dem Becken, rotes Herzlicht,
// glühende Augen, Sabber, der ins Wasser tropft, Blasen und Dampf am Leib. Aktionen (Promise): auftauchen, roehren,
// schlag(ziel), treffer, brunft(an), strahl(ziel), curryFressen, niederlage. Ereignisse: 'schlag' (Weltpunkt des
// Aufpralls), 'strahl' (Zielpunkt), 'welle' (beim Röhren).

type Pt = { x: number; y: number };

interface Arm {
  b: Pt;
  c: Pt;
  e: Pt;
  dicke: number;
  phase: number;
  huf: boolean;
  vorne: boolean;
  /** Ziel einer Aktion und wie stark der Arm ihm folgt (0..1) */
  ziel?: Pt;
  mix: number;
  zuck: number;
  /** grünes Glühen der Spitze beim Ausholen */
  glut: number;
}

const farbe = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
const C = {
  haut: farbe(HAUT), hautD: farbe(HAUT_D), bauch: farbe(BAUCH), glanz: farbe(GLANZ), napf: farbe(NAPF), napfD: farbe(NAPF_D),
  knochen: farbe(KNOCHEN), fleisch: farbe(FLEISCH), eiter: 0xd8e050, huf: 0x2a1a12, hufS: 0x5a4a3a, mitte: 0x6a3460, licht: 0xc890c0,
};
/** Bildkoordinaten (Leinwand 160x96) → lokal (Ursprung Wasserlinie Mitte) */
const L = ([bx, by]: [number, number]): Pt => ({ x: bx - OKTO_W / 2, y: by - OKTO_WASSER });
const mix = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const glatt = (t: number) => t * t * (3 - 2 * t);

export class OktopusHirsch extends Phaser.GameObjects.Container {
  private armeHinten!: Phaser.GameObjects.Graphics;
  private armeVorne!: Phaser.GameObjects.Graphics;
  /** ein zuschlagender Arm reicht übers Becken hinaus: ohne Wassermaske */
  private schlagG!: Phaser.GameObjects.Graphics;
  private unterWasser!: Phaser.GameObjects.Container;
  private leib!: Phaser.GameObjects.Image;
  private herz!: Phaser.GameObjects.Image;
  private kopf!: Phaser.GameObjects.Container;
  private kopfBild!: Phaser.GameObjects.Image;
  private kiefer!: Phaser.GameObjects.Image;
  private maul!: Phaser.GameObjects.Graphics;
  private geweih: Phaser.GameObjects.Container[] = [];
  private augen: { bild: Phaser.GameObjects.Image; glanz: Phaser.GameObjects.Image; aus: boolean; blinzelt: boolean }[] = [];
  private hoehle!: Phaser.GameObjects.Image;
  private arme!: Arm[];
  private maske!: Phaser.GameObjects.Graphics;
  private wasserWeltY!: number;
  /** Lichter und Effekte in der Szene (additiv), werden mit der Figur zerstört */
  private fxG?: Phaser.GameObjects.Graphics;
  private schein!: Phaser.GameObjects.Image;
  private herzLicht!: Phaser.GameObjects.Image;
  private aura!: Phaser.GameObjects.Image;
  private maulLicht!: Phaser.GameObjects.Image;
  private brunftDampf?: Phaser.Time.TimerEvent;
  private tropfT = 0;
  private blasT = 0;
  private uhr = 0;
  /** Tempo der Ruhe-Bewegungen (Brunft: schneller) */
  private tempo = 1;
  /** Wut (Brunft): rot pulsierend, Augen grell */
  private wut = 0;
  /** Curry im Bauch: orange-rot, zittert */
  private wuerg = 0;
  private kieferAuf = 0;
  private kopfNeigung = 0;
  private blitz = 0;
  private tot = false;
  private hufArm = 0;
  /** 0..1: wie weit er aus dem Wasser ist (Lichter blenden mit) */
  private sichtbar = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, scale = 1) {
    super(scene, x, y);
    makeOktopushirschTextures(scene);
    this.wasserWeltY = y;
    this.setScale(scale);
    const bild = (key: string, [ox, oy]: [number, number], pos: Pt) =>
      new Phaser.GameObjects.Image(scene, pos.x, pos.y, key).setOrigin(ox / OKTO_W, oy / OKTO_WASSER).setScale(0.5);

    this.armeHinten = new Phaser.GameObjects.Graphics(scene);
    this.leib = bild('okto_leib', [OKTO_W / 2, OKTO_WASSER], { x: 0, y: 0 });
    this.herz = new Phaser.GameObjects.Image(scene, L(OKTO_HERZ).x, L(OKTO_HERZ).y, 'okto_herz').setScale(0.5);
    this.armeVorne = new Phaser.GameObjects.Graphics(scene);
    // Kopf mit Geweih, Augen, Kiefer; Drehpunkt am Hals
    const hals = L(OKTO_HALS);
    this.kopf = new Phaser.GameObjects.Container(scene, hals.x, hals.y);
    for (const [key, piv] of [['okto_geweihL', OKTO_GEWEIH_L], ['okto_geweihR', OKTO_GEWEIH_R]] as const) {
      const g = new Phaser.GameObjects.Container(scene, piv[0] - OKTO_HALS[0], piv[1] - OKTO_HALS[1]);
      g.add(bild(key, piv, { x: 0, y: 0 }));
      this.geweih.push(g);
      this.kopf.add(g);
    }
    OKTO_AUGEN.forEach(([ax, ay]) => {
      const seite = ax < OKTO_W / 2 ? 0 : 1;
      const piv = seite ? OKTO_GEWEIH_R : OKTO_GEWEIH_L;
      const glanz = new Phaser.GameObjects.Image(scene, ax - piv[0], ay - piv[1], 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xb040ff).setScale(0.16).setAlpha(0.7);
      const auge = new Phaser.GameObjects.Image(scene, ax - piv[0], ay - piv[1], 'okto_auge').setScale(0.5);
      this.geweih[seite].add([glanz, auge]);
      this.augen.push({ bild: auge, glanz, aus: false, blinzelt: false });
    });
    this.kopfBild = bild('okto_kopf', OKTO_HALS, { x: 0, y: 0 });
    this.hoehle = new Phaser.GameObjects.Image(scene, OKTO_HOEHLE[0] - OKTO_HALS[0], OKTO_HOEHLE[1] - OKTO_HALS[1], 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xb040ff).setScale(0.1).setAlpha(0.8);
    this.maul = new Phaser.GameObjects.Graphics(scene);
    this.kiefer = bild('okto_kiefer', OKTO_KIEFER, { x: OKTO_KIEFER[0] - OKTO_HALS[0], y: OKTO_KIEFER[1] - OKTO_HALS[1] });
    this.kopf.add([this.kopfBild, this.hoehle, this.maul, this.kiefer]);
    this.schlagG = new Phaser.GameObjects.Graphics(scene);
    // alles, was unter der Wasserlinie verschwinden soll, in einen eigenen Container: dessen Maske wirkt in WebGL
    // und Canvas (Masken einzelner Kinder ignoriert der Canvas-Renderer bei gezeichneten Teilen)
    this.unterWasser = new Phaser.GameObjects.Container(scene, 0, 0, [this.armeHinten, this.leib, this.herz, this.armeVorne, this.kopf]);
    this.add([this.unterWasser, this.schlagG]);

    // Arme (Ruhelage aus dem Entwurf): zwei hinten, zwei mit Hufen, zwei kurze, die sich vorn einrollen
    const arm = (b: [number, number], c: [number, number], e: [number, number], dicke: number, phase: number, huf: boolean, vorne: boolean): Arm =>
      ({ b: L(b), c: L(c), e: L(e), dicke, phase, huf, vorne, mix: 0, zuck: 0, glut: 0 });
    const Y = OKTO_WASSER;
    this.arme = [
      arm([40, Y + 4], [12, 64], [28, 34], 4.4, 0, false, false),
      arm([120, Y + 4], [150, 66], [132, 36], 4.4, 2, false, false),
      arm([60, Y + 2], [36, 82], [16, 92], 4.6, 1, true, true),
      arm([100, Y + 2], [126, 82], [144, 92], 4.6, 3, true, true),
      arm([66, Y + 4], [52, 84], [62, 76], 4, 4, false, true),
      arm([94, Y + 4], [108, 84], [98, 76], 4, 5, false, true),
    ];

    // alles unter der Wasserlinie unsichtbar (nur Leib, Kopf und ruhende Arme; Schläge und Strahlen reichen darüber hinaus)
    this.maske = scene.make.graphics({}, false);
    this.maske.fillStyle(0xffffff).fillRect(x - 3000, y - 3000, 6000, 3000);
    this.unterWasser.setMask(this.maske.createGeometryMask());

    // Licht und Effekte (additiv, in der Szene)
    const licht = (f: number, s: number, a: number) => scene.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(f).setScale(s).setAlpha(a);
    this.aura = licht(0xff2a3a, 2.6 * scale, 0);
    this.schein = licht(0x5aff3a, 2.2 * scale, 0.35);
    this.herzLicht = licht(0xff3040, 0.55 * scale, 0.4);
    this.maulLicht = licht(0x8aff5a, 0.5 * scale, 0);
    this.fxG = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);

    scene.add.existing(this);
    this.setDepth(this.depth);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
      this.brunftDampf?.remove();
      for (const o of [this.maske, this.aura, this.schein, this.herzLicht, this.maulLicht, this.fxG]) o?.destroy();
    });
  }

  /** Tiefe der Figur; die Lichter liegen passend dahinter und davor */
  setDepth(d: number) {
    super.setDepth(d);
    if (this.fxG) {
      this.aura.setDepth(d - 0.5);
      this.schein.setDepth(d + 0.2);
      this.herzLicht.setDepth(d + 0.3);
      this.maulLicht.setDepth(d + 0.3);
      this.fxG.setDepth(d + 0.4);
    }
    return this;
  }

  /** lokaler Punkt → Welt */
  welt(p: Pt): Pt {
    return { x: this.x + p.x * this.scaleX, y: this.y + p.y * this.scaleY };
  }
  /** Weltpunkt → lokal */
  lokal(p: Pt): Pt {
    return { x: (p.x - this.x) / this.scaleX, y: (p.y - this.y) / this.scaleY };
  }
  /** Weltposition eines Teils (Auge, Kiefer, Herz) */
  private weltVon(o: Phaser.GameObjects.Image | Phaser.GameObjects.Container) {
    const m = o.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }
  /** Mitte des Mauls in der Welt */
  maulWelt(): Pt {
    const k = this.weltVon(this.kiefer);
    return { x: k.x - 9 * this.scaleX, y: k.y + 2 * this.scaleY };
  }

  private tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((done) => this.scene.tweens.add({ ...cfg, onComplete: () => done() }));
  }
  private warte(ms: number) {
    return new Promise<void>((done) => this.scene.time.delayedCall(ms, done));
  }

  // ---------------------------------------------------------------- Ruhe

  private tick(_time: number, delta: number) {
    if (!this.active) return;
    this.uhr += delta * this.tempo;
    const u = this.uhr, s = this.scaleX;
    const atem = Math.sin(u / 760);
    this.leib.setScale(0.5 + atem * 0.005, 0.5 + atem * 0.012);
    this.leib.setRotation(Math.sin(u / 1900) * 0.012);
    const puls = this.tot ? 0 : Math.pow(Math.max(0, Math.sin(u / (this.wut || this.wuerg ? 130 : 260))), 5);
    this.herz.setScale(0.5 * (1 + puls * 0.3)).setY(L(OKTO_HERZ).y - atem * 0.7);
    const zitter = this.wuerg ? Math.sin(u / 22) * 0.025 * this.wuerg : 0;
    this.kopf.setRotation(Math.sin(u / 1150) * 0.045 + Math.sin(u / 430) * 0.008 + this.kopfNeigung + zitter);
    this.kopf.y = L(OKTO_HALS).y - atem * 1.1;
    this.kiefer.setRotation(0.03 + glatt(Math.max(0, Math.sin(u / 900))) * 0.08 + this.kieferAuf);
    if (!this.tot) {
      this.geweih[0].setRotation(Math.sin(u / 1300) * 0.04);
      this.geweih[1].setRotation(-Math.sin(u / 1250 + 1) * 0.04);
    }
    this.augen.forEach((a, i) => {
      if (a.aus) return;
      const flacker = 0.85 + Math.sin(u / 90 + i * 2.1) * 0.05 + (Math.random() < 0.02 ? 0.15 : 0);
      a.glanz.setAlpha((0.55 + Math.sin(u / 380 + i) * 0.15 + this.wut * 0.3) * flacker).setScale((0.16 + this.wut * 0.08) * flacker);
      a.glanz.setTint(this.wut > 0.5 ? 0xff3080 : 0xb040ff);
      if (!a.blinzelt && Math.random() < 0.0007 * delta) {
        a.blinzelt = true;
        this.scene.tweens.add({ targets: a.bild, scaleY: 0.05, duration: 70, yoyo: true, hold: 60, onComplete: () => { a.blinzelt = false; } });
      }
    });
    this.hoehle.setAlpha(this.tot ? 0 : 0.6 + Math.sin(u / 300) * 0.25 + this.wut * 0.3);
    if (this.blitz > 0) this.blitz -= delta;
    const teile = [this.leib, this.kopfBild, this.kiefer, this.herz];
    if (this.blitz > 0) teile.forEach((t) => t.setTintFill(0xffffff));
    else if (this.wuerg) teile.forEach((t) => t.setTint(Phaser.Display.Color.GetColor(255, 150 + Math.round(Math.sin(u / 90) * 30), 110)));
    else if (this.wut > 0.05) { const g = Math.round(255 - this.wut * (80 + Math.sin(u / 150) * 40)); teile.forEach((t) => t.setTint(Phaser.Display.Color.GetColor(255, g, g))); }
    else teile.forEach((t) => t.clearTint());
    if (this.wuerg) this.x += Math.sin(u / 17) * 0.12 * this.wuerg;
    this.maulZeichnen();
    this.armeZeichnen(u, delta);
    // Lichter folgen
    const sv = this.sichtbar;
    this.schein.setPosition(this.x, Math.min(this.wasserWeltY, this.y) - 6 * s).setAlpha((0.3 + puls * 0.08 + this.wut * 0.1) * sv);
    const h = this.weltVon(this.herz);
    this.herzLicht.setPosition(h.x, h.y).setAlpha(this.tot ? 0 : (0.25 + puls * 0.55) * sv).setScale((0.45 + puls * 0.2) * s);
    this.aura.setPosition(this.x, this.y - 50 * s).setAlpha(this.wut * (0.35 + Math.sin(u / 160) * 0.12) * sv);
    const mund = this.maulWelt();
    this.maulLicht.setPosition(mund.x, mund.y);
    // Sabber tropft ins Becken, Blasen und Dampf an der Wasserlinie
    this.tropfT -= delta;
    if (this.tropfT <= 0 && !this.tot && sv > 0.8) {
      this.tropfT = 260 + Math.random() * 380;
      this.tropfen({ x: mund.x + Phaser.Math.FloatBetween(-6, 4) * s, y: mund.y + 4 * s });
    }
    this.blasT -= delta;
    if (this.blasT <= 0) {
      this.blasT = 140 + Math.random() * 160;
      this.blase(this.x + Phaser.Math.FloatBetween(-55, 55) * s, this.wasserWeltY + Phaser.Math.FloatBetween(0, 3));
    }
  }

  /** Maulhöhle zwischen Oberkiefer und Unterkiefer, folgt dem Kiefer; offen mit Rachen, Zunge und Schleimfaden */
  private maulZeichnen() {
    const g = this.maul, w = this.kiefer.rotation, [hx, hy] = OKTO_KIEFER, [kx, ky] = OKTO_HALS;
    const cos = Math.cos(w), sin = Math.sin(w);
    const oben: Pt[] = [], unten: Pt[] = [];
    for (let x = 64; x <= 88; x += 2) {
      oben.push({ x: x - kx, y: 64.5 + (x - 72) * 0.1 - ky });
      const ux = x - hx, uy = 69 + (86 - x) * 0.35 - hy;
      unten.push({ x: hx + ux * cos - uy * sin - kx, y: hy + ux * sin + uy * cos - ky + 0.5 });
    }
    g.clear();
    g.fillStyle(0x1a0404, 1).fillPoints([...oben, ...[...unten].reverse()], true);
    if (w > 0.15) {
      const a = oben[4], b = unten[unten.length - 5];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      g.fillStyle(0x4a0a0a, 0.95).fillEllipse(mx, my, 9, Math.min(8, w * 13));
      g.fillStyle(0x7a1a1a, 0.9).fillEllipse(mx, my + 0.5, 6, Math.min(5, w * 8));
      g.fillStyle(0xa83a3a, 0.9).fillEllipse(mx + 1, my + 1.5, 4, Math.min(3, w * 5));
      // Schleimfäden zwischen den Kiefern
      g.lineStyle(0.35, 0x8ac83a, 0.8);
      for (const k of [2, 6, 9]) { const o = oben[k], un = unten[unten.length - 1 - k]; g.lineBetween(o.x, o.y + 0.3, un.x + 0.4, un.y - 0.3); }
    }
  }

  private armeZeichnen(u: number, delta: number) {
    this.armeHinten.clear();
    this.armeVorne.clear();
    this.schlagG.clear();
    this.fxG?.clear();
    for (const a of this.arme) {
      a.zuck = Math.max(0, a.zuck - delta);
      const amp = this.tempo * (1 + this.wut * 0.7);
      let e: Pt = { x: a.e.x + Math.sin(u / 720 + a.phase) * 4.5 * amp + Math.sin(u / 310 + a.phase * 2) * 1.2, y: a.e.y + Math.cos(u / 610 + a.phase) * 3.2 * amp };
      let c: Pt = { x: a.c.x + Math.sin(u / 930 + a.phase) * 3.2 * amp, y: a.c.y + Math.cos(u / 820 + a.phase) * 2.4 * amp };
      if (a.ziel && a.mix > 0) {
        e = mix(e, a.ziel, a.mix);
        c = mix(c, { x: (a.b.x + a.ziel.x) / 2 + (a.ziel.x > a.b.x ? -14 : 14), y: Math.min(a.b.y, a.ziel.y) - 34 }, a.mix);
      }
      this.armMalen(a.ziel && a.mix > 0 ? this.schlagG : a.vorne ? this.armeVorne : this.armeHinten, a, c, e, u);
    }
  }

  /** ein Arm, weich: viele Stützpunkte, wellig, zur Spitze dünn; Kante, Haut, Schattenkern, Unterseite, Glanzlicht,
   *  Saugnäpfe, Geschwüre und Knochensporne */
  private armMalen(g: Phaser.GameObjects.Graphics, a: Arm, c: Pt, e: Pt, u: number) {
    const n = 40, b = a.b, weiss = this.blitz > 0;
    const pts: { x: number; y: number; r: number; nx: number; ny: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      let x = (1 - t) * (1 - t) * b.x + 2 * (1 - t) * t * c.x + t * t * e.x;
      let y = (1 - t) * (1 - t) * b.y + 2 * (1 - t) * t * c.y + t * t * e.y;
      const tx = 2 * (1 - t) * (c.x - b.x) + 2 * t * (e.x - c.x), ty = 2 * (1 - t) * (c.y - b.y) + 2 * t * (e.y - c.y);
      const tl = Math.hypot(tx, ty) || 1;
      let nx = -ty / tl, ny = tx / tl;
      if (e.x < b.x) { nx = -nx; ny = -ny; }
      const welle = Math.sin(t * 6 - u / 160 + a.phase) * 1.3 * Math.sin(t * Math.PI) + (a.zuck > 0 ? Math.sin(t * 14 + u / 30) * 2.8 * (a.zuck / 400) : 0);
      x += nx * welle;
      y += ny * welle;
      // die Spitze rollt sich ein
      if (!a.huf && t > 0.82 && a.mix < 0.5) { const k = (t - 0.82) / 0.18; x += Math.cos(u / 400 + a.phase) * k * k * 3; y -= k * k * 2.5; }
      pts.push({ x, y, r: a.dicke + ((a.huf ? 2.3 : 0.9) - a.dicke) * Math.pow(t, 0.9), nx, ny });
    }
    const f = (col: number) => (weiss ? 0xffffff : col);
    for (const q of pts) g.fillStyle(f(C.hautD), 1).fillCircle(q.x, q.y, q.r + 0.85);
    for (const q of pts) g.fillStyle(f(C.haut), 1).fillCircle(q.x, q.y, q.r);
    for (const q of pts) g.fillStyle(f(C.mitte), 1).fillCircle(q.x - q.nx * q.r * 0.25, q.y - q.ny * q.r * 0.25, q.r * 0.62);
    for (const q of pts) g.fillStyle(f(C.bauch), 1).fillCircle(q.x + q.nx * q.r * 0.48, q.y + q.ny * q.r * 0.48, q.r * 0.48);
    for (const q of pts) g.fillStyle(f(C.glanz), 1).fillCircle(q.x - q.nx * q.r * 0.48, q.y - q.ny * q.r * 0.48, q.r * 0.22);
    pts.forEach((q, i) => {
      if (i % 4 === 2 && q.r > 1.1) {
        const sx = q.x + q.nx * q.r * 0.74, sy = q.y + q.ny * q.r * 0.74;
        g.fillStyle(f(C.napf), 1).fillCircle(sx, sy, Math.max(0.55, q.r * 0.27));
        g.fillStyle(f(C.napfD), 1).fillCircle(sx, sy, Math.max(0.3, q.r * 0.12));
      }
      if (i % 6 === 3) g.fillStyle(f(C.licht), 0.7).fillCircle(q.x - q.nx * q.r * 0.55, q.y - q.ny * q.r * 0.55, Math.max(0.3, q.r * 0.1));
      if (i % 15 === 8 && q.r > 1.8) {
        g.fillStyle(f(C.fleisch), 1).fillCircle(q.x - q.nx * q.r * 0.3, q.y - q.ny * q.r * 0.3, 1.3);
        g.fillStyle(f(C.eiter), 1).fillCircle(q.x - q.nx * q.r * 0.3, q.y - q.ny * q.r * 0.3, 0.5);
      }
      if (i % 17 === 11 && q.r > 2) g.fillStyle(f(C.knochen), 1).fillTriangle(q.x - q.nx * q.r, q.y - q.ny * q.r, q.x - q.nx * (q.r + 2.4) + q.ny, q.y - q.ny * (q.r + 2.4) - q.nx, q.x - q.nx * q.r + q.ny * 1.4, q.y - q.ny * q.r - q.nx * 1.4);
    });
    const s = pts[pts.length - 1];
    if (a.huf) {
      g.fillStyle(f(C.hautD), 1).fillEllipse(s.x, s.y, 8, 6.6);
      g.fillStyle(f(C.huf), 1).fillEllipse(s.x, s.y, 7, 5.6);
      g.fillStyle(f(C.hufS), 1).fillRect(s.x - 0.5, s.y - 2.5, 1, 5);
      g.fillStyle(0x6a5a4a, 1).fillEllipse(s.x - 1.5, s.y - 1.5, 2, 1);
    }
    if (a.glut > 0 && this.fxG) {
      const w = this.welt(s);
      this.fxG.fillStyle(0x8aff5a, 0.18 * a.glut).fillCircle(w.x, w.y, 9 * this.scaleX * a.glut);
      this.fxG.fillStyle(0xd8ffb0, 0.35 * a.glut).fillCircle(w.x, w.y, 3.5 * this.scaleX * a.glut);
    }
  }

  // ---------------------------------------------------------------- Effekte (Weltkoordinaten)

  private tropfen(p: Pt) {
    const s = this.scaleX;
    const d = this.scene.add.ellipse(p.x, p.y, 1.1 * s, 1.9 * s, 0x8ac83a, 0.95).setDepth(this.depth + 0.6);
    this.scene.tweens.add({
      targets: d, y: this.wasserWeltY, scaleY: 1.6, duration: Math.max(140, (this.wasserWeltY - p.y) * 7), ease: 'Quad.easeIn',
      onComplete: () => { d.destroy(); this.ring(p.x, this.wasserWeltY, 0x8ac83a, 0.6); },
    });
  }

  private blase(x: number, y: number) {
    const s = this.scaleX;
    const b = this.scene.add.circle(x, y, Phaser.Math.FloatBetween(0.6, 1.6) * s, 0x6aff4a, 0.55).setStrokeStyle(0.4 * s, 0xd8ffd0, 0.9).setDepth(this.depth + 0.6);
    this.scene.tweens.add({
      targets: b, y: y - Phaser.Math.FloatBetween(1, 4) * s, scale: 1.6, duration: Phaser.Math.Between(260, 520),
      onComplete: () => { b.destroy(); if (Math.random() < 0.3) this.dampf(x, y - 3 * s, 0x6aff4a); },
    });
  }

  private ring(x: number, y: number, f: number, groesse = 1) {
    const s = this.scaleX;
    const r = this.scene.add.ellipse(x, y, 4 * s * groesse, 1.6 * s * groesse).setStrokeStyle(0.6 * s, f, 0.9).setDepth(this.depth + 0.6);
    this.scene.tweens.add({ targets: r, scaleX: 3, scaleY: 2.4, alpha: 0, duration: 520, onComplete: () => r.destroy() });
  }

  private dampf(x: number, y: number, f: number) {
    const s = this.scaleX;
    const d = this.scene.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(f).setScale(0.05 * s).setAlpha(0.45).setDepth(this.depth + 0.7);
    this.scene.tweens.add({ targets: d, y: y - 14 * s, x: x + Phaser.Math.FloatBetween(-4, 4) * s, scale: 0.16 * s, alpha: 0, duration: 1100, onComplete: () => d.destroy() });
  }

  /** Partikel mit Schwerkraft (Spritzer, Splitter) */
  spritzer(x: number, y: number, n: number, kraft: number, farben = [0x8ab878, 0xd8f0d0, 0x6aff4a], boden = y) {
    const s = this.scaleX, sc = this.scene;
    for (let i = 0; i < n; i++) {
      const o = sc.add.circle(x + Phaser.Math.Between(-6, 6) * s, y, Phaser.Math.FloatBetween(0.6, 1.8) * s, farben[i % farben.length], 0.95).setDepth(this.depth + 2);
      const w = Phaser.Math.FloatBetween(-Math.PI * 0.92, -Math.PI * 0.08), v = kraft * Phaser.Math.FloatBetween(0.35, 1) * s;
      const vx = Math.cos(w) * v * 0.6;
      let vy = Math.sin(w) * v;
      const sim = (_t: number, dt: number) => {
        if (!o.active) { sc.events.off(Phaser.Scenes.Events.UPDATE, sim); return; }
        const sec = dt / 1000;
        vy += 520 * s * sec;
        o.x += vx * sec;
        o.y += vy * sec;
        if (vy > 0 && o.y > boden + 4 * s) { sc.events.off(Phaser.Scenes.Events.UPDATE, sim); o.destroy(); }
      };
      sc.events.on(Phaser.Scenes.Events.UPDATE, sim);
    }
  }

  /** Lichtblitz an einer Stelle */
  aufleuchten(x: number, y: number, f: number, gr = 1, ms = 260) {
    const l = this.scene.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(f).setScale(0.2 * gr * this.scaleX).setAlpha(0.95).setDepth(this.depth + 3);
    this.scene.tweens.add({ targets: l, scale: 0.9 * gr * this.scaleX, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => l.destroy() });
  }

  /** Druckwelle als Ringe (Röhren, Aufprall) */
  druckwelle(x: number, y: number, f: number, flach = false) {
    const s = this.scaleX;
    for (let i = 0; i < 3; i++) {
      const r = this.scene.add.ellipse(x, y, 10 * s, (flach ? 3.5 : 10) * s).setStrokeStyle(2 * s, f, 0.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 3);
      this.scene.tweens.add({ targets: r, scaleX: 14 - i * 3, scaleY: 14 - i * 3, alpha: 0, duration: 650 + i * 120, delay: i * 90, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
    }
  }

  // ---------------------------------------------------------------- Aktionen

  /** unter Wasser verstecken (vor dem Auftauchen) */
  versteckt() {
    this.scene.tweens.killTweensOf(this);
    this.y = this.wasserWeltY + 125 * this.scaleY;
    this.sichtbar = 0;
    return this;
  }
  /** sofort aufgetaucht (nach Überspringen) */
  bereit() {
    this.scene.tweens.killTweensOf(this);
    this.sprudel?.remove();
    this.y = this.wasserWeltY;
    this.sichtbar = 1;
    this.wut = 0; this.kopfNeigung = 0; this.kieferAuf = 0;
    return this;
  }
  /** x, um das er gerade ruckt (Treffer), damit sich schnelle Treffer nicht aufaddieren */
  private ruckX?: number;
  private sprudel?: Phaser.Time.TimerEvent;

  /** steigt aus der Brühe: Fontäne, grünes Aufleuchten, Sprudeln, Kamera bebt */
  async auftauchen(ms = 2600) {
    this.y = this.wasserWeltY + 125 * this.scaleY;
    this.sichtbar = 0;
    this.scene.tweens.add({ targets: this, sichtbar: 1, duration: ms * 0.6 });
    this.spritzer(this.x, this.wasserWeltY, 46, 240);
    this.druckwelle(this.x, this.wasserWeltY, 0x6aff4a, true);
    this.aufleuchten(this.x, this.wasserWeltY, 0x6aff4a, 3, 900);
    audio.sfx('splash');
    audio.sfx('rumble');
    this.scene.cameras.main.shake(ms, 0.005);
    this.sprudel?.remove();
    this.sprudel = this.scene.time.addEvent({ delay: 70, loop: true, callback: () => this.spritzer(this.x + Phaser.Math.Between(-60, 60) * this.scaleX, this.wasserWeltY, 2, 120) });
    await this.tw({ targets: this, y: this.wasserWeltY, duration: ms, ease: 'Cubic.easeOut' });
    this.sprudel?.remove();
  }

  /** Röhren: Kopf in den Nacken, Kiefer weit auf, Maul glüht, Druckwellen, Augen gleißen, Dreck rieselt; Ereignis 'welle' */
  async roehren() {
    audio.sfx('roar');
    this.scene.cameras.main.shake(1200, 0.009);
    const vorher = this.wut;
    this.scene.tweens.add({ targets: this, wut: 1, duration: 220, yoyo: true, hold: 900, onComplete: () => { this.wut = vorher; } });
    this.scene.tweens.add({ targets: this.maulLicht, alpha: 0.9, scale: 1.1 * this.scaleX, duration: 260, yoyo: true, hold: 760 });
    await this.tw({ targets: this, kopfNeigung: -0.18, kieferAuf: 0.62, duration: 280, ease: 'Back.easeOut' });
    const m = this.maulWelt();
    this.druckwelle(m.x, m.y, 0x8aff5a);
    this.scene.cameras.main.flash(120, 90, 255, 90);
    for (let i = 0; i < 4; i++) this.scene.time.delayedCall(i * 160, () => this.spritzer(m.x, m.y, 9, 110, [0x8ac83a, 0xb8f060], this.wasserWeltY));
    // von der Decke rieselt Dreck
    const cam = this.scene.cameras.main.worldView;
    for (let i = 0; i < 18; i++) {
      const d = this.scene.add.rectangle(cam.x + Math.random() * cam.width, cam.y - 4, 1.5, 1.5, 0x5a5048).setDepth(this.depth + 4);
      this.scene.tweens.add({ targets: d, y: cam.y + cam.height * (0.4 + Math.random() * 0.5), angle: 360, delay: Math.random() * 500, duration: 700 + Math.random() * 500, ease: 'Quad.easeIn', onComplete: () => d.destroy() });
    }
    this.emit('welle');
    await this.warte(850);
    await this.tw({ targets: this, kopfNeigung: 0, kieferAuf: 0, duration: 460, ease: 'Sine.easeInOut' });
  }

  /** ein Huf-Arm holt glühend aus und kracht auf einen Weltpunkt; Ereignis 'schlag' beim Aufprall */
  async schlag(zielWelt: Pt) {
    const a = this.arme[2 + (this.hufArm++ % 2)];
    const ziel = this.lokal(zielWelt);
    a.ziel = { x: ziel.x * 0.4, y: -90 };
    this.scene.tweens.add({ targets: a, glut: 1, duration: 300 });
    await this.tw({ targets: a, mix: 1, duration: 340, ease: 'Sine.easeOut' });
    audio.sfx('whoosh');
    await this.tw({ targets: a.ziel, x: ziel.x, y: ziel.y, duration: 140, ease: 'Quad.easeIn' });
    audio.sfx('thud');
    a.zuck = 300;
    const cam = this.scene.cameras.main;
    cam.shake(280, 0.013);
    this.druckwelle(zielWelt.x, zielWelt.y, 0x9aff6a, true);
    this.aufleuchten(zielWelt.x, zielWelt.y, 0x9aff6a, 1.4, 300);
    this.spritzer(zielWelt.x, zielWelt.y, 18, 150, [0x8ab878, 0x5a5048, 0xd8f0d0], zielWelt.y);
    this.emit('schlag', zielWelt);
    this.scene.tweens.add({ targets: a, glut: 0, duration: 400 });
    await this.warte(420);
    await this.tw({ targets: a, mix: 0, duration: 560, ease: 'Sine.easeInOut' });
    a.ziel = undefined;
  }

  /** wo die Spitze eines fegenden Arms gerade ist (Welt), solange er fegt */
  fegerPunkt?: Pt;

  /** ein Hufarm holt glühend aus und fegt flach über den Boden, von einem Weltpunkt zum anderen */
  async fegen(vonWelt: Pt, bisWelt: Pt, ms = 520) {
    const a = this.arme[2 + (this.hufArm++ % 2)];
    const von = this.lokal(vonWelt), bis = this.lokal(bisWelt);
    a.ziel = { x: von.x * 0.5, y: von.y - 40 };
    this.scene.tweens.add({ targets: a, glut: 1, duration: 300 });
    await this.tw({ targets: a, mix: 1, duration: 320, ease: 'Sine.easeOut' });
    await this.tw({ targets: a.ziel, x: von.x, y: von.y, duration: 110, ease: 'Quad.easeIn' });
    audio.sfx('whoosh');
    audio.sfx('splash');
    const z = a.ziel;
    a.zuck = 300;
    await this.tw({
      targets: z, x: bis.x, y: bis.y, duration: ms, ease: 'Sine.easeInOut',
      onUpdate: () => { const w = this.welt(z); this.fegerPunkt = w; if (Math.random() < 0.6) this.spritzer(w.x, w.y, 2, 110, [0x8ab878, 0xd8f0d0, 0x6aff4a], w.y); },
    });
    this.fegerPunkt = undefined;
    this.scene.tweens.add({ targets: a, glut: 0, duration: 300 });
    await this.tw({ targets: a, mix: 0, duration: 520, ease: 'Sine.easeInOut' });
    a.ziel = undefined;
  }

  /** getroffen: weißer Blitz, Schleim spritzt, Kopf und Arme zucken, Körper staucht */
  async treffer(stelle?: Pt) {
    this.blitz = 120;
    for (const a of this.arme) a.zuck = 420;
    const p = stelle ?? this.welt({ x: Phaser.Math.Between(-20, 20), y: Phaser.Math.Between(-60, -20) });
    this.spritzer(p.x, p.y, 12, 130, [0x8ac83a, 0x6a2a5a, 0xd8e050], this.wasserWeltY);
    this.aufleuchten(p.x, p.y, 0xffffff, 0.8, 160);
    this.scene.tweens.add({ targets: this, kopfNeigung: 0.16, duration: 90, yoyo: true });
    if (this.ruckX !== undefined) return;
    const s0 = Math.abs(this.scaleY), x0 = this.x;
    this.ruckX = x0;
    this.scene.tweens.add({ targets: this, scaleX: Math.sign(this.scaleX) * s0 * 1.035, scaleY: s0 * 0.97, duration: 70, yoyo: true });
    await this.tw({ targets: this, x: x0 + 2.5, duration: 40, yoyo: true, repeat: 3 });
    this.x = x0;
    this.ruckX = undefined;
  }

  /** Brunft: rote Aura, schneller, Augen rot, Dampf aus den Nüstern */
  brunft(an: boolean) {
    this.scene.tweens.add({ targets: this, wut: an ? 1 : 0, tempo: an ? 1.8 : 1, duration: 600 });
    if (an && !this.brunftDampf) {
      this.brunftDampf = this.scene.time.addEvent({
        delay: 180, loop: true, callback: () => {
          const n = this.weltVon(this.kopfBild);
          for (const dx of [-3, 4]) this.dampf(n.x + dx * this.scaleX, n.y + 3 * this.scaleY, 0xff5a3a);
        },
      });
    } else if (!an) { this.brunftDampf?.remove(); this.brunftDampf = undefined; }
  }

  /** die Geweih-Augen laden sich auf (Funken fliegen hinein) und schießen gleißende, wabernde Strahlen; Ereignis 'strahl' */
  async strahl(zielWelt: Pt) {
    for (const a of this.augen) if (!a.aus) this.scene.tweens.add({ targets: a.glanz, scale: 0.4, alpha: 1, duration: 560 });
    audio.sfx('zisch');
    const lade = this.scene.time.addEvent({
      delay: 40, repeat: 13, callback: () => {
        for (const a of this.augen) {
          if (a.aus || Math.random() < 0.5) continue;
          const z = this.weltVon(a.bild), w = Math.random() * Math.PI * 2, r = 14 * this.scaleX;
          const f = this.scene.add.circle(z.x + Math.cos(w) * r, z.y + Math.sin(w) * r, 0.7 * this.scaleX, 0xe0b0ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 3);
          this.scene.tweens.add({ targets: f, x: z.x, y: z.y, alpha: 0.2, duration: 260, ease: 'Quad.easeIn', onComplete: () => f.destroy() });
        }
      },
    });
    await this.warte(600);
    lade.remove();
    audio.sfx('thunder');
    this.emit('strahl', zielWelt);
    this.scene.cameras.main.flash(90, 160, 80, 255);
    this.scene.cameras.main.shake(700, 0.004);
    const g = this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 3);
    const ende = this.scene.time.now + 720;
    const funken = this.scene.time.addEvent({ delay: 50, loop: true, callback: () => this.spritzer(zielWelt.x, zielWelt.y, 3, 120, [0xe0b0ff, 0xffffff, 0xb040ff], zielWelt.y) });
    await new Promise<void>((done) => {
      const zeichne = () => {
        g.clear();
        if (!this.active || this.scene.time.now > ende) { this.scene.events.off(Phaser.Scenes.Events.UPDATE, zeichne); done(); return; }
        const t = this.scene.time.now;
        for (const a of this.augen) {
          if (a.aus) continue;
          const von = this.weltVon(a.bild);
          const fl = 0.75 + Math.random() * 0.25;
          const pts: Pt[] = [];
          for (let i = 0; i <= 8; i++) {
            const k = i / 8, x = von.x + (zielWelt.x - von.x) * k, y = von.y + (zielWelt.y - von.y) * k;
            const j = Math.sin(k * 9 + t / 30) * 1.2 * Math.sin(k * Math.PI);
            pts.push({ x: x + j, y: y + j * 0.5 });
          }
          for (const [w, f, al] of [[7, 0x5a1aaa, 0.22], [3.6, 0x9a4aff, 0.5], [1.4, 0xffffff, 0.95]] as [number, number, number][]) {
            g.lineStyle(w * this.scaleX * 0.5, f, al * fl);
            g.strokePoints(pts, false);
          }
          g.fillStyle(0xe0b0ff, 0.6 * fl).fillCircle(von.x, von.y, 2.4 * this.scaleX);
        }
        g.fillStyle(0xffffff, 0.9).fillCircle(zielWelt.x, zielWelt.y, (3 + Math.random() * 2.5) * this.scaleX);
        g.fillStyle(0xb040ff, 0.4).fillCircle(zielWelt.x, zielWelt.y, (8 + Math.random() * 3) * this.scaleX);
      };
      this.scene.events.on(Phaser.Scenes.Events.UPDATE, zeichne);
    });
    funken.remove();
    g.destroy();
    // Brandfleck
    const fleck = this.scene.add.ellipse(zielWelt.x, zielWelt.y, 14 * this.scaleX, 5 * this.scaleX, 0x1a0a1a, 0.7).setDepth(this.depth - 1);
    this.scene.tweens.add({ targets: fleck, alpha: 0, duration: 2400, delay: 600, onComplete: () => fleck.destroy() });
    for (const a of this.augen) if (!a.aus) this.scene.tweens.add({ targets: a.glanz, scale: 0.16, alpha: 0.7, duration: 320 });
  }

  /** frisst etwas: Kiefer schnappt, dann würgt er, wird rot, zittert, dampft */
  async curryFressen() {
    for (let i = 0; i < 4; i++) {
      await this.tw({ targets: this, kieferAuf: 0.55, duration: 110 });
      audio.sfx('chomp');
      await this.tw({ targets: this, kieferAuf: 0, duration: 110 });
    }
    await this.warte(300);
    audio.sfx('retch');
    this.scene.tweens.add({ targets: this, wuerg: 1, tempo: 2.4, duration: 600 });
    const dampf = this.scene.time.addEvent({
      delay: 110, loop: true, callback: () => {
        for (const p of [[64, 34], [100, 33], [80, 62]] as [number, number][]) { const w = this.welt(L(p)); this.dampf(w.x, w.y, 0xff8a3a); }
      },
    });
    await this.tw({ targets: this, kopfNeigung: 0.1, kieferAuf: 0.35, duration: 500, yoyo: true, repeat: 2 });
    dampf.remove();
  }

  /** das Ende: das Geweih bricht in Splittern, die Augen platzen eins nach dem anderen, er versinkt mit einer Fontäne */
  async niederlage() {
    this.tot = true;
    this.brunft(false);
    audio.sfx('crack');
    const cam = this.scene.cameras.main;
    cam.shake(500, 0.012);
    cam.flash(160, 255, 255, 255);
    this.geweih.forEach((g, i) => {
      const w = this.weltVon(g);
      for (let k = 0; k < 10; k++) {
        const sp = this.scene.add.rectangle(w.x, w.y, Phaser.Math.FloatBetween(1, 3) * this.scaleX, 0.8 * this.scaleX, k % 3 ? 0xd8cca8 : 0x7a2a2a).setDepth(this.depth + 3);
        const vx = (i ? 1 : -1) * Phaser.Math.FloatBetween(10, 50) * this.scaleX;
        this.scene.tweens.add({ targets: sp, x: sp.x + vx, angle: Phaser.Math.Between(-540, 540), duration: 900, ease: 'Linear' });
        this.scene.tweens.add({ targets: sp, y: this.wasserWeltY, duration: 900, ease: 'Quad.easeIn', onComplete: () => { this.ring(sp.x, this.wasserWeltY, 0xd8f0d0, 0.6); sp.destroy(); } });
      }
      this.scene.tweens.add({ targets: g, rotation: i ? 1.3 : -1.3, y: g.y + 50, alpha: 0, duration: 1500, ease: 'Quad.easeIn' });
    });
    for (const a of this.augen) {
      await this.warte(140);
      a.aus = true;
      const w = this.weltVon(a.bild);
      this.aufleuchten(w.x, w.y, 0xb040ff, 0.7, 300);
      this.spritzer(w.x, w.y, 5, 90, [0xe0b0ff, 0xffffff], this.wasserWeltY);
      this.scene.tweens.add({ targets: [a.glanz, a.bild], alpha: 0, scale: 0.02, duration: 220 });
      audio.sfx('blip');
    }
    await this.tw({ targets: this, kopfNeigung: 0.36, kieferAuf: 0.55, wuerg: 0, tempo: 0.4, duration: 700 });
    audio.sfx('rumble');
    this.scene.tweens.add({ targets: this, sichtbar: 0, duration: 2600 });
    const blasen = this.scene.time.addEvent({ delay: 60, loop: true, callback: () => this.blase(this.x + Phaser.Math.Between(-50, 50) * this.scaleX, this.wasserWeltY) });
    await this.tw({ targets: this, y: this.wasserWeltY + 130 * this.scaleY, duration: 2800, ease: 'Sine.easeIn' });
    blasen.remove();
    this.spritzer(this.x, this.wasserWeltY, 50, 260);
    this.druckwelle(this.x, this.wasserWeltY, 0x6aff4a, true);
    audio.sfx('splash');
  }
}
