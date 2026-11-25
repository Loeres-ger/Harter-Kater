import Phaser from 'phaser';
import { audio } from '../audio';
import { KurvenPunkt, PixelLeinwand, Pt, band, dreh, glatt, kante, kurve, zufall } from './pixelMaler';

// Der Oktopushirsch als lebendes Pixelbild (siehe pixelMaler.ts). Jedes Bild zeichnet die ganze Figur neu: Krakenleib
// mit offenem Brustkorb und pochendem Herzen, ein halb skelettierter Hirschschädel (links blanker Knochen mit leerer,
// glühender Augenhöhle, rechts verrottetes Fell mit Milchauge und Ohrmarke), Jägerhut mit Gamsbart, ein Knochengeweih
// mit Fleischfetzen, umwundenen Tentakeln und Augen an den Enden, sechs Arme mit Saugnäpfen (zwei enden in Hufen).
// Arme wachsen aus dem Leib, alles hat einen gemeinsamen Umriss. Der Ursprung ist die Wasserlinie in der Mitte; was
// darunter liegt, ist im Becken (beim Auftauchen und Versinken wandert die Figur durch die Wasserlinie).
//
// Ausgreifende Arme (Hufschlag, Feger) zeichnet eine zweite Leinwand, die über den Boden reicht.
// Aktionen (Promise): auftauchen, roehren, schlag(ziel), fegen(von, bis), treffer, brunft(an), strahl(ziel),
// curryFressen, niederlage. Ereignisse: 'schlag' (Weltpunkt des Aufpralls), 'strahl' (Zielpunkt), 'welle' (Röhren).

/** Größe der Figur in Einheiten (Wasserlinie bei OY) */
const CW = 380, CH = 268, OX = 190, OY = 256;
/** Kopf und Geweih etwas größer als der Leib */
const KOPF_S = 1.1, GEWEIH_S = 1.2;
const STUFEN = 12;


type ArmArt = 'hinten' | 'huf' | 'vorne';
interface Arm {
  art: ArmArt;
  seite: number;
  wurzel: Pt;
  c1: Pt;
  c2: Pt;
  spitze: Pt;
  dicke: number;
  spitzeDicke: number;
  phase: number;
  /** Ziel einer Aktion (lokal) und wie stark der Arm ihm folgt (0..1) */
  ziel?: Pt;
  mix: number;
  zuck: number;
  glut: number;
  stoss: number;
  haut: ArmHaut;
}
/** feste, unregelmäßige Haut eines Arms (jeder Arm anders) */
interface ArmHaut {
  knoten: [number, number, number][];
  flecken: [number, number, number, string][];
  naepfe: [number, number, boolean, number][];
  adern: [number, number, number, number][];
  schleim: [number, number, number][];
  glanz: [number, number][];
  warzen: [number, number][];
}
function armHaut(seed: number): ArmHaut {
  const r = zufall(seed);
  const farben = ['#3a2232', '#2e1a2a', '#4a2e3a', '#8a6878', '#a8889a', '#5a3a2a', '#4a4a2a', '#7a2a3a'];
  const naepfe: [number, number, boolean, number][] = [];
  for (let t = 0.09 + r() * 0.04; t < 0.95; t += 0.035 + r() * 0.05) naepfe.push([t, 0.17 + r() * 0.2, r() < 0.2, 0.6 + r() * 0.32]);
  return {
    knoten: Array.from({ length: 4 }, () => [0.12 + r() * 0.78, 0.1 + r() * 0.26, 0.035 + r() * 0.05] as [number, number, number]),
    flecken: Array.from({ length: 18 }, () => [0.04 + r() * 0.92, -0.85 + r() * 1.5, 0.16 + r() * 0.42, farben[Math.floor(r() * farben.length)]] as [number, number, number, string]),
    naepfe,
    adern: Array.from({ length: 3 }, () => { const t0 = r() * 0.5; return [t0, t0 + 0.25 + r() * 0.4, -0.5 + r() * 0.7, 1 + r() * 2] as [number, number, number, number]; }),
    schleim: Array.from({ length: 3 }, () => [0.18 + r() * 0.7, 5 + r() * 10, r() * 6] as [number, number, number]),
    glanz: Array.from({ length: 4 }, () => { const t0 = r() * 0.85; return [t0, t0 + 0.05 + r() * 0.09] as [number, number]; }),
    warzen: Array.from({ length: 8 }, () => [0.08 + r() * 0.84, 0.6 + r() * 1.2] as [number, number]),
  };
}
/** Fläche entlang einer Mittellinie mit Rändern, die sich entlang des Arms ändern (wellige Grenzen) */
function bandF(c: CanvasRenderingContext2D, pts: KurvenPunkt[], br: (t: number) => number, von: (t: number) => number, bis: (t: number) => number) {
  c.beginPath();
  pts.forEach((q, i) => { const w = br(q.t) * von(q.t); if (i) c.lineTo(q.x + q.nx * w, q.y + q.ny * w); else c.moveTo(q.x + q.nx * w, q.y + q.ny * w); });
  for (let i = pts.length - 1; i >= 0; i--) { const q = pts[i], w = br(q.t) * bis(q.t); c.lineTo(q.x + q.nx * w, q.y + q.ny * w); }
  c.closePath();
}
interface Auge { seite: number; nr: number; offen: number; aus: boolean; iris: string }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lp = (a: Pt, b: Pt, t: number): Pt => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

/** Kopf: Drehpunkt am Hals (Leibkoordinaten) */
const HALS: Pt = { x: 0, y: -106 };
/** Geweih: Ansatz auf dem Schädel (Kopfkoordinaten) und Hauptstange */
const geweihStange = (s: number) => ({ b: { x: 11 * s, y: -62 }, c1: { x: 27 * s, y: -77 }, c2: { x: 45 * s, y: -86 }, e: { x: 58 * s, y: -113 } });
const ENDEN = [{ t: 0.2, d: { x: 2, y: -17 }, auge: false }, { t: 0.48, d: { x: 4, y: -22 }, auge: true }, { t: 0.72, d: { x: 10, y: -16 }, auge: true }, { t: 0.9, d: { x: 14, y: -6 }, auge: true }];

/** feste Flecken auf dem Leib (Fäulnis, Schimmel, Maden, Geschwüre) */
const FLECKEN = (() => {
  const r = zufall(31), out: { x: number; y: number; rx: number; ry: number; art: number }[] = [];
  while (out.length < 16) {
    const x = -60 + r() * 120, y = -100 + r() * 100;
    if (Math.abs(x) < 30 && y > -85 && y < -20) continue; // Brustkorb frei lassen
    if ((x / 66) ** 2 + ((y + 48) / 58) ** 2 > 0.85) continue;
    out.push({ x, y, rx: 3 + r() * 6, ry: 2 + r() * 4, art: Math.floor(r() * 4) });
  }
  return out;
})();
/** Leib: Umriss (asymmetrisch, knotig), Flecken, Häute mit Adernetz, Poren, nasse Glanzpunkte, Rippen */
const LEIB_UMRISS: [number, number][] = [[-66, 12], [-77, -8], [-80, -32], [-73, -57], [-63, -79], [-46, -97], [-27, -108], [-8, -114], [11, -112], [31, -106], [48, -95], [61, -80], [73, -61], [79, -36], [75, -12], [66, 12], [42, 19], [16, 16], [-12, 19], [-40, 18]];
const IM_LEIB = (x: number, y: number) => (x / 68) ** 2 + ((y + 48) / 60) ** 2 < 0.9;
const LEIB_FLECKEN = (() => {
  const r = zufall(52), farben = ['#3a2232', '#2e1a2a', '#4a2e3a', '#7a5a70', '#8a6878', '#4a3a2a', '#3e4a2a', '#5a3048'], out: [number, number, number, number, number, string][] = [];
  while (out.length < 46) { const x = -70 + r() * 140, y = -110 + r() * 118; if (!IM_LEIB(x, y)) continue; out.push([x, y, 3 + r() * 10, 2 + r() * 6, r() * 3, farben[Math.floor(r() * farben.length)]]); }
  return out;
})();
const LEIB_ADERN = (() => {
  const r = zufall(61), out: [number, number][][] = [];
  for (let k = 0; k < 9; k++) {
    let x = -60 + r() * 120, y = -100 + r() * 30, w = Math.PI / 2 + (r() - 0.5) * 0.8;
    const pfad: [number, number][] = [[x, y]];
    for (let i = 0; i < 9; i++) { w += (r() - 0.5) * 0.9; x += Math.cos(w) * 7; y += Math.sin(w) * 7; if (!IM_LEIB(x, y)) break; pfad.push([x, y]); }
    out.push(pfad);
  }
  return out;
})();
const LEIB_GLANZ = (() => { const r = zufall(73), out: [number, number][] = []; while (out.length < 16) { const x = -64 + r() * 70, y = -104 + r() * 70; if (IM_LEIB(x, y)) out.push([x, y]); } return out; })();
const RIPPEN = (() => {
  const r = zufall(88), out: { y: number; sd: number; ex: number; ey: number; w: number; bruch: boolean; fehlt: boolean }[] = [];
  for (let i = 0; i < 5; i++) for (const sd of [-1, 1]) out.push({ y: -80 + i * 12 + (r() - 0.5) * 3, sd, ex: sd * (24 - i * 1.5 + (r() - 0.5) * 6), ey: -80 + i * 12 + 10 + r() * 5, w: 2.2 + r() * 1.4, bruch: r() < 0.25, fehlt: r() < 0.1 });
  return out;
})();
const STRAEHNEN = (() => {
  const r = zufall(77), out: [number, number, number, number][] = [];
  for (let i = 0; i < 46; i++) { const x = 2 + r() * 24, y = -62 + r() * 62; out.push([x, y, (r() - 0.3) * 3, 2 + r() * 4]); }
  return out;
})();

export class OktopusHirsch extends Phaser.GameObjects.Container {
  private s: number;
  private leinwand: PixelLeinwand;
  private reich: PixelLeinwand;
  private bild: Phaser.GameObjects.Image;
  private reichBild: Phaser.GameObjects.Image;
  private reichPos = { x: 0, y: 0 };
  private wasserWeltY: number;
  private arme: Arm[];
  private augen: Auge[] = [];
  private augenGlanz: Phaser.GameObjects.Image[] = [];
  private hoehle: Phaser.GameObjects.Image;
  private schein: Phaser.GameObjects.Image;
  private herzLicht: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private maulLicht: Phaser.GameObjects.Image;
  private brunftDampf?: Phaser.Time.TimerEvent;
  private sprudel?: Phaser.Time.TimerEvent;
  private ruckX?: number;
  private zuletzt = -1000;
  private tropfT = 0;
  private blasT = 0;
  private uhr = 0;
  private tempo = 1;
  private wut = 0;
  private wuerg = 0;
  private kieferAuf = 0;
  private kopfNeigung = 0;
  private blitz = 0;
  private tot = false;
  private hufArm = 0;
  private sichtbar = 1;
  /** wie tief er eingetaucht ist (Einheiten; 0 = aufgetaucht) */
  private tiefe = 0;
  private puls = 0;
  /** Augen laden sich für den Strahl auf (0..1) */
  private ladung = 0;
  private atem = 0;
  private geweihAb = [false, false];
  private geweihKipp = [0, 0];
  /** wohin die Augen schauen (Welt) */
  blick?: Pt;
  /** wo die Spitze eines fegenden Arms gerade ist (Welt), solange er fegt */
  fegerPunkt?: Pt;

  constructor(scene: Phaser.Scene, x: number, y: number, scale = 1) {
    super(scene, x, y);
    this.s = scale;
    this.wasserWeltY = y;
    const w = Math.ceil(CW * scale), h = Math.ceil(CH * scale);
    this.leinwand = new PixelLeinwand(scene, w, h, STUFEN);
    this.bild = new Phaser.GameObjects.Image(scene, 0, 0, this.leinwand.key).setOrigin((OX * scale) / w, (OY * scale) / h);
    this.add(this.bild);
    this.reich = new PixelLeinwand(scene, 600, 330, STUFEN);
    this.reichBild = scene.add.image(0, 0, this.reich.key).setOrigin(0).setVisible(false);

    const arm = (art: ArmArt, seite: number, wurzel: [number, number], c1: [number, number], c2: [number, number], sp: [number, number], dicke: number, spitzeDicke: number, phase: number): Arm => ({
      art, seite, wurzel: { x: wurzel[0] * seite, y: wurzel[1] }, c1: { x: c1[0] * seite, y: c1[1] }, c2: { x: c2[0] * seite, y: c2[1] }, spitze: { x: sp[0] * seite, y: sp[1] },
      dicke, spitzeDicke, phase, mix: 0, zuck: 0, glut: 0, stoss: 0, haut: armHaut(Math.round(phase * 1000) + (art === 'huf' ? 7 : art === 'vorne' ? 13 : 3)),
    });
    this.arme = [];
    for (const sd of [-1, 1]) {
      this.arme.push(arm('hinten', sd, [40, -52], [104, -60], [134, -150], [94, -178], 15, 3, sd < 0 ? 0 : 2.2));
    }
    for (const sd of [-1, 1]) this.arme.push(arm('huf', sd, [32, -18], [86, -64], [132, -44], [148, -2], 16, 7, sd < 0 ? 1.1 : 3.3));
    for (const sd of [-1, 1]) this.arme.push(arm('vorne', sd, [18, -26], [42, -6], [14, 14], [32, -10], 10.5, 2.5, sd < 0 ? 4 : 5.2));

    for (const sd of [-1, 1]) ENDEN.forEach((e, i) => { if (e.auge) this.augen.push({ seite: sd, nr: i, offen: 1, aus: false, iris: sd < 0 ? '#f0e040' : '#ff4020' }); });
    for (const sd of [-1, 1]) this.augen.push({ seite: sd, nr: 9, offen: 1, aus: false, iris: sd < 0 ? '#f0e040' : '#ff4020' }); // Stangenende

    const licht = (f: number, sc: number, a: number) => scene.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(f).setScale(sc).setAlpha(a);
    this.aura = licht(0xff2a3a, 2.8 * scale, 0);
    this.schein = licht(0x5aff3a, 2.4 * scale, 0.3);
    this.herzLicht = licht(0xff3040, 0.5 * scale, 0.4);
    this.maulLicht = licht(0x8aff5a, 0.5 * scale, 0);
    this.hoehle = licht(0xb040ff, 0.12 * scale, 0.8);
    this.augenGlanz = this.augen.map((a) => licht(a.seite < 0 ? 0xf0e040 : 0xff5030, 0.09 * scale, 0.6));

    scene.add.existing(this);
    this.setDepth(this.depth);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
      this.brunftDampf?.remove();
      this.sprudel?.remove();
      for (const o of [this.aura, this.schein, this.herzLicht, this.maulLicht, this.hoehle, this.reichBild, ...this.augenGlanz]) o.destroy();
      this.leinwand.zerstoeren();
      this.reich.zerstoeren();
    });
    this.malen(0);
  }

  /** Tiefe der Figur; Lichter und der ausgreifende Arm liegen passend dahinter und davor */
  setDepth(d: number) {
    super.setDepth(d);
    if (this.hoehle) {
      this.aura.setDepth(d - 0.5);
      this.schein.setDepth(d + 0.2);
      for (const o of [this.herzLicht, this.maulLicht, this.hoehle, ...this.augenGlanz]) o.setDepth(d + 0.3);
      this.reichBild.setDepth(d + 0.25);
    }
    return this;
  }

  /** lokaler Punkt (Einheiten, Leib) → Welt */
  welt(p: Pt): Pt {
    return { x: this.x + p.x * this.s, y: this.y + (p.y + this.tiefe) * this.s };
  }
  /** Weltpunkt → lokal */
  lokal(p: Pt): Pt {
    return { x: (p.x - this.x) / this.s, y: (p.y - this.y) / this.s - this.tiefe };
  }

  // ---------------------------------------------------------------- Geometrie (für Lichter und Strahlen)

  private kopfBob() { return Math.sin(this.uhr / 1150) * 1.2 - this.atem * 1.4; }
  private kopfWinkel() { return Math.sin(this.uhr / 1150) * 0.04 + Math.sin(this.uhr / 430) * 0.008 + this.kopfNeigung + (this.wuerg ? Math.sin(this.uhr / 22) * 0.025 * this.wuerg : 0); }
  /** Kopfkoordinaten → Leib */
  private kopf(p: Pt): Pt {
    const r = dreh({ x: p.x * KOPF_S, y: p.y * KOPF_S }, this.kopfWinkel());
    return { x: HALS.x + r.x, y: HALS.y + this.kopfBob() + r.y };
  }
  private geweihWinkel(seite: number) {
    const i = seite < 0 ? 0 : 1;
    return seite * (Math.sin(this.uhr / 1300 + i) * 0.035 - this.kopfNeigung * 0.25) + this.geweihKipp[i];
  }
  /** Punkt am Geweih (Kopfkoordinaten nach Drehung um den Ansatz) */
  private geweihPunkt(seite: number, t: number, d?: Pt): Pt {
    const g = geweihStange(seite);
    const k = kurve(g.b, g.c1, g.c2, g.e, 20)[Math.round(t * 20)];
    const p = d ? { x: k.x + d.x * seite, y: k.y + d.y } : k;
    const gross = { x: g.b.x + (p.x - g.b.x) * GEWEIH_S, y: g.b.y + (p.y - g.b.y) * GEWEIH_S };
    return dreh(gross, this.geweihWinkel(seite), g.b);
  }
  private augePunkt(a: Auge): Pt {
    if (a.nr === 9) return this.kopf(this.geweihPunkt(a.seite, 1));
    const e = ENDEN[a.nr];
    return this.kopf(this.geweihPunkt(a.seite, e.t, e.d));
  }
  maulWelt(): Pt { return this.welt(this.kopf({ x: 0, y: 8 + this.kieferAuf * 8 })); }
  private herzPunkt(): Pt { return { x: 3, y: -50 }; }

  // ---------------------------------------------------------------- Ruhe

  private tick(_t: number, delta: number) {
    if (!this.active) return;
    this.uhr += delta * this.tempo;
    const u = this.uhr, s = this.s;
    this.atem = Math.sin(u / 760);
    this.puls = this.tot ? 0 : Math.pow(Math.max(0, Math.sin(u / (this.wut || this.wuerg ? 130 : 260))), 5);
    if (this.blitz > 0) this.blitz -= delta;
    if (this.wuerg) this.x += Math.sin(u / 17) * 0.12 * this.wuerg;
    for (const a of this.arme) { a.zuck = Math.max(0, a.zuck - delta); a.stoss = Math.max(0, a.stoss - delta / 250); }
    // blinzeln
    for (const a of this.augen) {
      if (a.aus || a.offen < 1) continue;
      if (Math.random() < 0.0006 * delta) this.scene.tweens.add({ targets: a, offen: 0, duration: 70, yoyo: true, hold: 50 });
    }
    // neu zeichnen (etwa 30 Bilder pro Sekunde reichen der Pixelkunst)
    if (u - this.zuletzt >= 50 || (this.blitz > 0 && u - this.zuletzt >= 33)) { this.zuletzt = u; this.malen(u); }
    // Tönung: Blitz, Würgen, Wut
    const bilder = [this.bild, this.reichBild];
    if (this.blitz > 0) bilder.forEach((b) => b.setTintFill(0xffffff));
    else if (this.wuerg) bilder.forEach((b) => b.setTint(Phaser.Display.Color.GetColor(255, 170 + Math.round(Math.sin(u / 90) * 30), 130)));
    else if (this.wut > 0.05) { const g = Math.round(255 - this.wut * (70 + Math.sin(u / 150) * 35)); bilder.forEach((b) => b.setTint(Phaser.Display.Color.GetColor(255, g, g))); }
    else bilder.forEach((b) => b.clearTint());
    this.bild.setAlpha(Math.min(1, this.sichtbar * 1.5));
    // Lichter folgen der Figur
    const sv = this.sichtbar;
    this.schein.setPosition(this.x, this.wasserWeltY - 8 * s).setAlpha((0.28 + this.puls * 0.08 + this.wut * 0.1) * sv);
    const h = this.welt(this.herzPunkt());
    this.herzLicht.setPosition(h.x, h.y).setAlpha(this.tot ? 0 : (0.3 + this.puls * 0.6) * sv * (h.y < this.wasserWeltY ? 1 : 0)).setScale((0.4 + this.puls * 0.2) * s);
    this.aura.setPosition(this.x, this.y - 110 * s).setAlpha(this.wut * (0.35 + Math.sin(u / 160) * 0.12) * sv);
    const m = this.maulWelt();
    this.maulLicht.setPosition(m.x, m.y);
    const ho = this.welt(this.kopf({ x: -17, y: -38 }));
    this.hoehle.setPosition(ho.x, ho.y).setAlpha(this.tot || ho.y > this.wasserWeltY ? 0 : 0.55 + Math.sin(u / 300) * 0.2 + this.wut * 0.3);
    this.augen.forEach((a, i) => {
      const p = this.welt(this.augePunkt(a));
      const sichtbarAuge = !a.aus && !this.geweihAb[a.seite < 0 ? 0 : 1] && p.y < this.wasserWeltY;
      const fl = 0.85 + Math.sin(u / 90 + i * 2.1) * 0.06 + (Math.random() < 0.02 ? 0.15 : 0);
      this.augenGlanz[i].setPosition(p.x, p.y).setAlpha(sichtbarAuge ? (0.45 + this.wut * 0.35) * fl * a.offen : 0)
        .setScale((0.09 + this.wut * 0.05 + this.ladung * 0.26) * s * fl).setTint(this.wut > 0.5 ? 0xff3080 : a.seite < 0 ? 0xf0e040 : 0xff5030);
    });
    // Sabber tropft ins Becken, Blasen an der Wasserlinie
    this.tropfT -= delta;
    if (this.tropfT <= 0 && !this.tot && sv > 0.8 && this.tiefe < 5) {
      this.tropfT = 280 + Math.random() * 380;
      this.tropfen({ x: m.x + Phaser.Math.FloatBetween(-5, 5) * s, y: m.y + 3 * s });
    }
    this.blasT -= delta;
    if (this.blasT <= 0) {
      this.blasT = 150 + Math.random() * 170;
      this.blase(this.x + Phaser.Math.FloatBetween(-70, 70) * s, this.wasserWeltY + Phaser.Math.FloatBetween(0, 3));
    }
  }

  // ---------------------------------------------------------------- Zeichnen

  private malen(u: number) {
    const L = this.leinwand, c = L.ctx, s = this.s;
    L.leeren();
    c.setTransform(s, 0, 0, s, OX * s, OY * s);
    // alles unter der Wasserlinie liegt im Becken
    c.save();
    c.beginPath();
    c.rect(-OX, -OY, CW, OY + 1);
    c.clip();
    c.save();
    c.translate(0, this.tiefe);
    for (const a of this.arme) if (a.art === 'hinten' && !(a.ziel && a.mix > 0)) this.armMalen(c, a, u, false);
    this.leibMalen(c, u);
    this.kopfMalen(c, u);
    for (const a of this.arme) if (a.art !== 'hinten' && !(a.ziel && a.mix > 0)) this.armMalen(c, a, u, true);
    this.lichtMalen(c, true);
    c.restore();
    this.lichtMalen(c, false);
    c.restore();
    // Schaum, wo der Leib das Wasser berührt
    if (this.tiefe < 200) {
      const r = zufall(Math.floor(u / 120));
      for (let x = -70; x <= 70; x += 5) {
        const yy = Math.sin(x / 9 + u / 260) * 1.2;
        c.fillStyle = r() < 0.5 ? '#9ae05a' : '#d0ffa0';
        c.beginPath();
        c.ellipse(x + r() * 3, yy, 3.2 + r() * 2, 1.6, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    L.fertig();
    this.reichMalen(u);
  }

  /** Licht auf alles schon Gezeichnete: am Körper Schlaglicht und Schatten, an der Wasserlinie grünes Licht aus der Brühe */
  private lichtMalen(c: CanvasRenderingContext2D, koerper: boolean) {
    c.globalCompositeOperation = 'source-atop';
    if (koerper) {
      const sh = c.createRadialGradient(-60, -210, 10, -10, -100, 250);
      sh.addColorStop(0, 'rgba(255,236,210,0.28)');
      sh.addColorStop(0.35, 'rgba(255,236,210,0)');
      sh.addColorStop(0.75, 'rgba(14,2,26,0.25)');
      sh.addColorStop(1, 'rgba(8,0,16,0.7)');
      c.fillStyle = sh;
      c.fillRect(-OX, -OY, CW, CH);
    } else {
      const gr = c.createLinearGradient(0, 2, 0, -80);
      gr.addColorStop(0, 'rgba(120,255,70,0.6)');
      gr.addColorStop(0.4, 'rgba(90,220,60,0.22)');
      gr.addColorStop(1, 'rgba(90,220,60,0)');
      c.fillStyle = gr;
      c.fillRect(-OX, -OY, CW, CH);
      if (this.wut > 0.05) { c.fillStyle = 'rgba(255,40,40,' + (0.18 * this.wut).toFixed(3) + ')'; c.fillRect(-OX, -OY, CW, CH); }
    }
    c.globalCompositeOperation = 'source-over';
  }

  private leibMalen(c: CanvasRenderingContext2D, u: number) {
    const atem = this.atem;
    c.save();
    // Umriss: knotig, asymmetrisch; unten hängt die Haut beim Atmen durch, jede Stelle wabert etwas für sich
    const umriss = LEIB_UMRISS.map(([x, y], i) => [x * (1 + atem * 0.012) + Math.sin(u / 700 + i * 1.7) * 1.1, y + Math.cos(u / 820 + i * 2.3) * 0.9 + (y > -40 ? atem * 2.2 : y < -90 ? -atem * 1.2 : 0)] as [number, number]);
    const g = c.createRadialGradient(-26, -76, 4, -6, -50, 100);
    g.addColorStop(0, '#8e7290'); g.addColorStop(0.45, '#5a4058'); g.addColorStop(0.85, '#3a2438'); g.addColorStop(1, '#2a1628');
    c.fillStyle = g;
    glatt(c, umriss);
    c.fill();
    // Wucherungen am Rand
    for (const [x, y, r] of [[-72, -44, 10], [64, -72, 8], [-50, -92, 7], [74, -20, 8], [-24, -108, 5], [40, 12, 7]] as [number, number, number][]) {
      c.beginPath(); c.ellipse(x, y + (y > -40 ? atem * 2 : 0), r * (1 + Math.sin(u / 600 + x) * 0.06), r * 0.85, 0.3, 0, Math.PI * 2); c.fill();
    }
    // Hautlappen, die unten herunterhängen
    for (const [x0, x1, l] of [[-70, -48, 16], [-30, -8, 11], [22, 46, 14], [52, 70, 12]] as [number, number, number][]) {
      const mx = (x0 + x1) / 2, sw = Math.sin(u / 650 + x0) * 2;
      c.fillStyle = '#3a2438';
      c.beginPath(); c.moveTo(x0, 4); c.quadraticCurveTo(mx - 4 + sw, 4 + l * 1.2, mx + sw, 4 + l); c.quadraticCurveTo(mx + 4 + sw, 4 + l * 0.9, x1, 4); c.closePath(); c.fill();
      c.strokeStyle = '#6a4a62'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(x0 + 2, 5); c.quadraticCurveTo(mx - 3 + sw, 4 + l * 0.9, mx + sw, 3 + l); c.stroke();
    }
    // fleckige, verweste Haut
    for (const [x, y, rx, ry, w, f] of LEIB_FLECKEN) { c.fillStyle = f; c.beginPath(); c.ellipse(x, y + (y > -40 ? atem * 1.5 : 0), rx, ry, w, 0, Math.PI * 2); c.fill(); }
    // dünne Häute mit durchscheinendem Adernetz
    for (const [x, y, rx, ry] of [[-46, -56, 13, 10], [44, -36, 11, 9], [-20, -14, 9, 6]] as [number, number, number, number][]) {
      c.fillStyle = '#a07888'; c.beginPath(); c.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c098a8'; c.beginPath(); c.ellipse(x - 2, y - 2, rx * 0.6, ry * 0.5, 0.4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#7a2228'; c.lineWidth = 0.7;
      for (let k = 0; k < 5; k++) {
        const w = k * 1.3 + Math.sin(u / 900) * 0.1;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(w) * rx * 0.5, y + Math.sin(w + 0.6) * ry * 0.4, x + Math.cos(w) * rx * 0.9, y + Math.sin(w) * ry * 0.9); c.stroke();
      }
    }
    // Adern, pochend
    c.strokeStyle = this.puls > 0.5 ? '#5a1428' : '#3a0e1e';
    c.lineWidth = 1.1;
    for (const pfad of LEIB_ADERN) { c.beginPath(); pfad.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
    // Fäulnis, Schimmel, Geschwüre, Maden
    for (const f of FLECKEN) {
      if (f.art === 0) { c.fillStyle = '#2a1a12'; c.beginPath(); c.ellipse(f.x, f.y, f.rx, f.ry, 0.3, 0, Math.PI * 2); c.fill(); c.fillStyle = '#7a2228'; c.beginPath(); c.ellipse(f.x - 1, f.y - 1, f.rx * 0.5, f.ry * 0.5, 0.3, 0, Math.PI * 2); c.fill(); }
      else if (f.art === 1) { c.fillStyle = '#6a7a3a'; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(f.x + Math.cos(i * 1.3) * f.rx * 0.6, f.y + Math.sin(i * 1.7) * f.ry * 0.6, 1 + (i % 2) * 0.6, 0, Math.PI * 2); c.fill(); } }
      else if (f.art === 2) { c.fillStyle = '#9a3a3a'; c.beginPath(); c.arc(f.x, f.y, f.ry * 0.8, 0, Math.PI * 2); c.fill(); c.fillStyle = '#d8e050'; c.beginPath(); c.arc(f.x - 0.4, f.y - 0.6, f.ry * 0.38, 0, Math.PI * 2); c.fill(); }
      else { c.strokeStyle = '#efe6cc'; c.lineWidth = 1.2; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(f.x + k * 2.2, f.y + (k % 2), 1.4, 0.2 + Math.sin(u / 200 + f.x + k) * 0.5, 2.6); c.stroke(); } }
    }
    // Poren, aus denen Schleim sickert
    for (const [x, y, ph] of [[-58, -36, 0], [-36, -78, 2], [52, -58, 4], [60, -20, 1], [-10, -98, 3], [30, -84, 5]] as [number, number, number][]) {
      c.fillStyle = '#1a0a14'; c.beginPath(); c.ellipse(x, y, 1.6, 1.1, 0, 0, Math.PI * 2); c.fill();
      const l = 3 + ((u / 40 + ph * 30) % 9);
      c.strokeStyle = '#7ab83a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x, y + 1); c.lineTo(x + 0.4, y + l); c.stroke();
      c.fillStyle = '#9ae05a'; c.beginPath(); c.arc(x + 0.4, y + l + 0.8, 1, 0, Math.PI * 2); c.fill();
    }
    // nasser Glanz oben links
    c.strokeStyle = '#a888a0'; c.lineWidth = 2.2;
    c.beginPath(); c.arc(-30, -60, 44, 3.6, 4.4); c.stroke();
    c.strokeStyle = '#dcc4d6'; c.lineWidth = 0.9;
    c.beginPath(); c.arc(-30, -60, 44, 3.75, 4.25); c.stroke();
    c.fillStyle = '#f0e0ec';
    for (const [x, y] of LEIB_GLANZ) c.fillRect(x, y + Math.sin(u / 500 + x) * 0.4, (x * 7) % 3 > 1 ? 2 : 1, 1);
    // roher Halsstumpf, auf dem der Schädel sitzt
    c.fillStyle = '#5a1418'; c.beginPath(); c.ellipse(0, -110, 25, 8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#9a3a3a'; c.beginPath(); c.ellipse(-3, -112, 18, 4, 0, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#7a2228' : '#c06060'; c.beginPath(); c.ellipse(-20 + i * 8, -104 + (i % 3), 2.5, 4 + (i % 2) * 2, 0.2 * (i - 3), 0, Math.PI * 2); c.fill(); }
    // offener Brustkorb: zerrissener Rand, Höhle, Herz, ungleiche Rippen mit Fleischfasern
    const loch: [number, number][] = [[0, -86], [-14, -83], [-25, -72], [-28, -56], [-24, -38], [-14, -24], [0, -20], [13, -25], [24, -36], [29, -55], [24, -73], [13, -84]];
    c.fillStyle = '#9a3a3a';
    glatt(c, loch.map(([x, y]) => [x * 1.12, -52 + (y + 52) * 1.1] as [number, number]));
    c.fill();
    const hg = c.createRadialGradient(0, -52, 2, 0, -52, 30);
    hg.addColorStop(0, '#120406'); hg.addColorStop(0.6, '#3a0a0e'); hg.addColorStop(1, '#6a1a20');
    c.fillStyle = hg;
    glatt(c, loch);
    c.fill();
    for (let i = 0; i < 12; i++) { const [x, y] = loch[i]; c.fillStyle = i % 2 ? '#c06060' : '#7a2228'; c.beginPath(); c.ellipse(x * 1.06, -52 + (y + 52) * 1.05, 2.2, 1.4, Math.atan2(y + 52, x), 0, Math.PI * 2); c.fill(); }
    const pf = 1 + this.puls * 0.24;
    c.save();
    c.translate(3, -50);
    c.scale(pf, pf * (1 - this.puls * 0.05));
    c.strokeStyle = '#5a1418'; c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(-3, -9); c.quadraticCurveTo(-6, -16, -11, -18); c.moveTo(4, -9); c.quadraticCurveTo(6, -17, 3, -22); c.moveTo(-6, 4); c.quadraticCurveTo(-14, 8, -16, 14); c.stroke();
    const herz = c.createRadialGradient(-3, -4, 1, 0, 0, 13);
    herz.addColorStop(0, '#d07070'); herz.addColorStop(0.55, '#9a3a3a'); herz.addColorStop(1, '#4a1014');
    c.fillStyle = herz;
    glatt(c, [[-9, -6], [-4, -11], [2, -8], [9, -12], [13, -4], [9, 7], [1, 13], [-7, 8]]);
    c.fill();
    c.strokeStyle = '#3a0a0e'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(-2, -6); c.quadraticCurveTo(2, 0, -1, 8); c.moveTo(4, -6); c.quadraticCurveTo(8, 0, 5, 5); c.moveTo(-5, 0); c.lineTo(-7, 4); c.stroke();
    c.fillStyle = '#f0c0c0'; c.fillRect(-4, -6, 1.2, 1.2);
    c.restore();
    // Rippen: ungleich lang, teils gebrochen oder fehlend, Fleischfasern dazwischen
    c.lineCap = 'round';
    RIPPEN.forEach((rp, i) => {
      if (rp.fehlt) return;
      const ex = rp.bruch ? rp.ex * 0.6 : rp.ex, ey = rp.bruch ? lerp(rp.y, rp.ey, 0.6) : rp.ey;
      const cx = rp.sd * 26, cy = rp.y - 4;
      c.strokeStyle = '#5e5440'; c.lineWidth = rp.w + 1.6;
      c.beginPath(); c.moveTo(rp.sd * 1, rp.y); c.quadraticCurveTo(cx, cy, ex, ey); c.stroke();
      c.strokeStyle = '#b4a886'; c.lineWidth = rp.w;
      c.beginPath(); c.moveTo(rp.sd * 1, rp.y); c.quadraticCurveTo(cx, cy, ex, ey); c.stroke();
      c.strokeStyle = '#efe6cc'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(rp.sd * 3, rp.y - 1); c.quadraticCurveTo(cx * 0.9, cy - 1.5, ex - rp.sd, ey - 1.6); c.stroke();
      if (rp.bruch) { c.fillStyle = '#d8ccaa'; c.beginPath(); c.moveTo(ex - 1.5, ey - 1.5); c.lineTo(ex + rp.sd * 3, ey + 0.5); c.lineTo(ex - 1, ey + 1.8); c.fill(); }
      const nach = RIPPEN[i + 2];
      if (nach && !nach.fehlt && i % 3 !== 2) {
        const sw = Math.sin(u / 500 + i) * 1.5;
        c.strokeStyle = '#7a2228'; c.lineWidth = 0.9;
        c.beginPath(); c.moveTo(rp.sd * 14, rp.y + 3); c.quadraticCurveTo(rp.sd * (16 + sw), (rp.y + nach.y) / 2 + 6, rp.sd * 13, nach.y + 3); c.stroke();
      }
    });
    c.strokeStyle = '#8a7e62'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(0, -86); c.quadraticCurveTo(-3, -56, 1, -22); c.stroke();
    c.strokeStyle = '#d8ccaa'; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(-0.8, -86); c.quadraticCurveTo(-3.8, -56, 0.2, -22); c.stroke();
    c.strokeStyle = '#3a3226'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(-2, -64); c.lineTo(1, -61); c.lineTo(-1, -58); c.stroke();
    // Schleimfäden vom Brustkorb
    for (const [x, ph] of [[-10, 0], [8, 2], [16, 4]] as [number, number][]) {
      const l = 6 + Math.sin(u / 450 + ph) * 3;
      c.strokeStyle = '#7ab83a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(x, -22); c.quadraticCurveTo(x + 1, -22 + l * 0.6, x, -22 + l); c.stroke();
      c.fillStyle = '#9ae05a'; c.beginPath(); c.arc(x, -21 + l, 1.1, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  private kopfMalen(c: CanvasRenderingContext2D, u: number) {
    // Hals mit verfilztem Fell
    c.fillStyle = '#3e3020';
    glatt(c, [[-22, -100], [-17, -124], [0, -128], [17, -124], [22, -100], [0, -96]]);
    c.fill();
    c.strokeStyle = '#2a2014'; c.lineWidth = 1;
    for (let i = -16; i <= 16; i += 4) { c.beginPath(); c.moveTo(i, -122); c.lineTo(i + 1.5, -104); c.stroke(); }

    c.save();
    c.translate(HALS.x, HALS.y + this.kopfBob());
    c.rotate(this.kopfWinkel());
    c.scale(KOPF_S, KOPF_S);
    for (const sd of [-1, 1]) if (!this.geweihAb[sd < 0 ? 0 : 1]) this.geweihMalen(c, sd, u);
    // Ohren: links zerrissen, rechts mit Fell und Ohrmarke
    for (const sd of [-1, 1]) {
      c.fillStyle = sd < 0 ? '#6a5260' : '#5a4630';
      glatt(c, [[sd * 22, -50], [sd * 36, -60], [sd * 50, -60], [sd * 44, -52], [sd * 30, -44]]);
      c.fill();
      c.fillStyle = sd < 0 ? '#3a0a0e' : '#7a2228';
      c.beginPath(); c.ellipse(sd * 38, -55, 6, 2, sd * -0.2, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#120a10'; c.beginPath(); c.arc(-44, -57, 1.6, 0, Math.PI * 2); c.arc(-39, -59, 1.2, 0, Math.PI * 2); c.fill(); // Löcher im zerrissenen Ohr
    c.fillStyle = '#e0c020'; c.fillRect(39, -56, 7, 5);
    c.fillStyle = '#5a4a10'; for (let i = 0; i < 3; i++) c.fillRect(40 + i * 2, -54, 1, 1);
    // Schädel: links Knochen, rechts verrottetes Fell
    const schaedel: [number, number][] = [[0, -67], [-18, -64], [-26, -51], [-28, -37], [-25, -24], [-18, -12], [-12, -2], [-10, 6], [10, 6], [12, -2], [18, -12], [25, -24], [28, -37], [26, -51], [18, -64]];
    const kg = c.createLinearGradient(-26, -66, 22, 8);
    kg.addColorStop(0, '#efe6cc'); kg.addColorStop(0.45, '#d8ccaa'); kg.addColorStop(0.8, '#b4a886'); kg.addColorStop(1, '#8a7e62');
    c.fillStyle = kg;
    glatt(c, schaedel);
    c.fill();
    c.save();
    glatt(c, schaedel);
    c.clip();
    // Fellseite (rechts), gezackte Grenze
    c.beginPath();
    c.moveTo(3, -70);
    for (let y = -70; y <= 10; y += 5) c.lineTo(2 + ((y / 5) % 2 ? 4 : 0), y);
    c.lineTo(40, 10); c.lineTo(40, -70); c.closePath();
    const fg = c.createLinearGradient(4, -60, 30, 6);
    fg.addColorStop(0, '#7a6244'); fg.addColorStop(0.6, '#5a4630'); fg.addColorStop(1, '#3e3020');
    c.fillStyle = fg;
    c.fill();
    c.lineWidth = 1;
    for (const [x, y, dx, len] of STRAEHNEN) { c.strokeStyle = dx > 0 ? '#3e3020' : '#7a6244'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + dx, y + len); c.stroke(); }
    // offene Stellen im Fell
    for (const [x, y, r] of [[18, -18, 4], [10, -48, 3]] as [number, number, number][]) {
      c.fillStyle = '#7a2228'; c.beginPath(); c.ellipse(x, y, r + 1.5, r, 0.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d8ccaa'; c.beginPath(); c.ellipse(x, y, r * 0.6, r * 0.45, 0.4, 0, Math.PI * 2); c.fill();
    }
    // Risse im Knochen (links)
    c.strokeStyle = '#5e5440'; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(-10, -64); c.lineTo(-13, -56); c.lineTo(-9, -50); c.lineTo(-14, -42); c.moveTo(-22, -30); c.lineTo(-17, -26); c.lineTo(-19, -18); c.stroke();
    c.restore();
    // Augenhöhle links (leer, glüht), Milchauge rechts mit Maden
    const sh = c.createRadialGradient(-17, -38, 0.5, -17, -38, 8);
    sh.addColorStop(0, '#a040e0'); sh.addColorStop(0.35, '#3a1060'); sh.addColorStop(1, '#0a0406');
    c.fillStyle = sh; c.beginPath(); c.ellipse(-17, -38, 7.5, 6.5, -0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#c8b0b4'; c.beginPath(); c.ellipse(17, -38, 6, 5, 0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#efe6cc'; c.beginPath(); c.ellipse(16, -39, 4.4, 3.4, 0.2, 0, Math.PI * 2); c.fill();
    const bl = this.blickLokal({ x: 17, y: -38 });
    c.fillStyle = '#8a7e62'; c.beginPath(); c.arc(17 + bl.x * 1.2, -38 + bl.y, 1.8, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#efe6cc'; c.lineWidth = 1;
    for (let i = 0; i < 3; i++) { const a = u / 300 + i * 2.1; c.beginPath(); c.arc(22 + Math.cos(a) * 3, -33 + Math.sin(a) * 2, 1.2, 0, 2.2); c.stroke(); }
    // Nasenlöcher, Oberkiefer mit Menschenzähnen
    c.fillStyle = '#0a0406';
    for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * 4.5, -2, 2.2, 3.4, sd * 0.3, 0, Math.PI * 2); c.fill(); }
    const auf = this.kieferAuf;
    const mahl = Math.sin(u / 240) * (auf < 0.1 ? 0.8 : 0.3);
    // Maul: Rachen, Zunge, Schleimfäden
    if (auf > 0.04) {
      c.fillStyle = '#3a0a0e';
      c.beginPath(); c.moveTo(-10, 6); c.lineTo(10, 6); c.lineTo(9 + mahl, 7 + auf * 15); c.lineTo(-9 + mahl, 7 + auf * 15); c.closePath(); c.fill();
      c.fillStyle = '#7a2228'; c.beginPath(); c.ellipse(mahl, 8 + auf * 11, 6, 2.4 + auf * 2, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#9a3a3a'; c.beginPath(); c.ellipse(mahl + 1, 8 + auf * 10, 3.5, 1.4 + auf, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#6ab83a'; c.lineWidth = 0.8;
      for (const x of [-6, 1, 6]) { c.beginPath(); c.moveTo(x, 8); c.quadraticCurveTo(x + 1, 8 + auf * 9, x + mahl, 6 + auf * 15); c.stroke(); }
    }
    c.fillStyle = '#7a2228'; c.fillRect(-10, 3, 20, 2.4);
    for (let i = 0; i < 8; i++) { c.fillStyle = i % 3 ? '#d8ccaa' : '#b4a886'; c.fillRect(-9.5 + i * 2.45, 4.6, 2, 3.4 - (i % 2) * 0.8); }
    // Unterkiefer
    c.save();
    c.translate(mahl, auf * 15);
    const jg = c.createLinearGradient(-10, 6, 10, 18);
    jg.addColorStop(0, '#d8ccaa'); jg.addColorStop(1, '#8a7e62');
    c.fillStyle = jg;
    glatt(c, [[-10.5, 5], [10.5, 5], [10, 11], [5, 16.5], [-5, 16.5], [-10, 11]]);
    c.fill();
    c.fillStyle = '#5a4630'; c.fillRect(3, 8, 6, 6); // Fellrest
    for (let i = 0; i < 7; i++) { c.fillStyle = i % 2 ? '#efe6cc' : '#d8ccaa'; c.fillRect(-8.5 + i * 2.5, 3.2, 2, 2.6); }
    c.fillStyle = '#6ab83a'; c.fillRect(-4, 15.5, 1, 3 + auf * 3); c.fillRect(5, 15, 1, 2 + auf * 2);
    c.restore();
    // Jägerhut mit Gamsbart, schief auf der Stirn
    c.save();
    c.translate(-2, -63);
    c.rotate(-0.14);
    c.fillStyle = '#2e4028'; c.beginPath(); c.ellipse(0, 1, 17, 3.6, 0, 0, Math.PI * 2); c.fill();
    const hg = c.createLinearGradient(-10, -14, 10, 0);
    hg.addColorStop(0, '#3e5636'); hg.addColorStop(1, '#1e2a1a');
    c.fillStyle = hg;
    glatt(c, [[-11, 0], [-10, -9], [-5, -14], [5, -14], [10, -9], [11, 0]]);
    c.fill();
    c.fillStyle = '#1e2a1a'; c.fillRect(-11, -3.5, 22, 2.5);
    c.strokeStyle = '#d8ccaa'; c.lineWidth = 1;
    for (let i = 0; i < 6; i++) { const w = -1.4 + i * 0.22 + Math.sin(u / 400 + i) * 0.05; c.beginPath(); c.moveTo(9, -3); c.lineTo(9 + Math.cos(w) * 11, -3 + Math.sin(w) * 11); c.stroke(); }
    c.strokeStyle = '#8a7e62';
    c.beginPath(); c.moveTo(9, -3); c.lineTo(14, -12); c.stroke();
    c.restore();
    c.restore();
  }

  private blickLokal(von: Pt): Pt {
    if (!this.blick) return { x: Math.sin(this.uhr / 1700) * 0.6, y: 0.3 };
    const w = this.welt(this.kopf(von));
    const dx = this.blick.x - w.x, dy = this.blick.y - w.y, l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  }

  private geweihMalen(c: CanvasRenderingContext2D, sd: number, u: number) {
    const g = geweihStange(sd);
    c.save();
    c.translate(g.b.x, g.b.y);
    c.rotate(this.geweihWinkel(sd));
    c.scale(GEWEIH_S, GEWEIH_S);
    c.translate(-g.b.x, -g.b.y);
    const stange = kurve(g.b, g.c1, g.c2, g.e, 20);
    const bs = (t: number) => lerp(5.6, 2.2, t);
    const knochen = (pts: KurvenPunkt[], br: (t: number) => number) => {
      c.fillStyle = '#8a7e62'; band(c, pts, br); c.fill();
      c.fillStyle = '#d8ccaa'; band(c, pts, br, -0.9, 0.2); c.fill();
      c.fillStyle = '#efe6cc'; band(c, pts, br, -0.75, -0.35); c.fill();
      c.fillStyle = '#5e5440'; band(c, pts, br, 0.55, 1); c.fill();
    };
    // Enden
    ENDEN.forEach((e, i) => {
      const p = stange[Math.round(e.t * 20)];
      const ende = { x: p.x + e.d.x * sd, y: p.y + e.d.y };
      const gebrochen = sd < 0 && i === 2;
      const ziel = gebrochen ? lp(p, ende, 0.55) : ende;
      const pts = kurve(p, lp(p, ziel, 0.35), { x: lerp(p.x, ziel.x, 0.7) - sd * 2, y: lerp(p.y, ziel.y, 0.7) }, ziel, 8);
      knochen(pts, (t) => lerp(3.3, 1.3, t));
      if (gebrochen) { c.fillStyle = '#efe6cc'; c.beginPath(); c.moveTo(ziel.x - 2, ziel.y + 1); c.lineTo(ziel.x, ziel.y - 3); c.lineTo(ziel.x + 2, ziel.y); c.fill(); }
    });
    knochen(stange, bs);
    // Risse, Moos
    c.strokeStyle = '#3a3226'; c.lineWidth = 0.8;
    for (const t of [0.3, 0.62]) { const p = stange[Math.round(t * 20)]; c.beginPath(); c.moveTo(p.x - 1.5, p.y - 1); c.lineTo(p.x + 1, p.y + 1.5); c.lineTo(p.x - 0.5, p.y + 3); c.stroke(); }
    // Tentakel, die sich um die Stange winden
    c.strokeStyle = '#5e4660'; c.lineWidth = 1.7;
    c.beginPath();
    stange.forEach((q, i) => {
      const off = Math.sin(q.t * 14 - u / 300 + sd) * bs(q.t) * 1.05;
      const x = q.x + q.nx * off, y = q.y + q.ny * off;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    });
    c.stroke();
    c.strokeStyle = '#9a849a'; c.lineWidth = 0.7; c.stroke();
    // Fleischfetzen hängen herunter und schwingen nach
    for (const t of [0.3, 0.58]) {
      const p = stange[Math.round(t * 20)];
      const sw = Math.sin(u / 380 + t * 9 + sd) * 2.5 - this.kopfNeigung * 20;
      c.strokeStyle = '#5a1418'; c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(p.x, p.y + 2); c.quadraticCurveTo(p.x + sw * 0.5, p.y + 7, p.x + sw, p.y + 13); c.stroke();
      c.strokeStyle = '#9a3a3a'; c.lineWidth = 1.1;
      c.beginPath(); c.moveTo(p.x - 0.5, p.y + 2); c.quadraticCurveTo(p.x + sw * 0.5 - 0.5, p.y + 7, p.x + sw - 0.5, p.y + 12); c.stroke();
    }
    // Augen an den Enden
    for (const a of this.augen) {
      if (a.seite !== sd) continue;
      const pt = a.nr === 9 ? stange[20] : (() => { const e = ENDEN[a.nr], p = stange[Math.round(e.t * 20)]; return { x: p.x + e.d.x * sd, y: p.y + e.d.y }; })();
      this.augeMalen(c, pt, a);
    }
    c.restore();
  }

  private augeMalen(c: CanvasRenderingContext2D, p: Pt, a: Auge) {
    if (a.aus) {
      c.fillStyle = '#3a0a0e'; c.beginPath(); c.arc(p.x, p.y, 3, 0, Math.PI * 2); c.fill();
      return;
    }
    c.fillStyle = '#7a2228'; c.beginPath(); c.arc(p.x, p.y, 4.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#efe6cc'; c.beginPath(); c.arc(p.x, p.y, 3.4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#c06060'; c.lineWidth = 0.6;
    c.beginPath(); c.moveTo(p.x - 3, p.y); c.lineTo(p.x - 1.5, p.y + 0.6); c.moveTo(p.x + 3, p.y - 1); c.lineTo(p.x + 1.4, p.y - 0.4); c.stroke();
    const b = this.blickLokal(p);
    const ix = p.x + b.x * 1.1, iy = p.y + b.y * 1.1;
    c.fillStyle = this.wut > 0.5 ? '#ff4020' : a.iris; c.beginPath(); c.arc(ix, iy, 2.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0a0406'; c.fillRect(ix - 0.5, iy - 1.6, 1, 3.2);
    if (a.offen < 1) {
      c.fillStyle = '#5e4660';
      c.beginPath(); c.arc(p.x, p.y, 4.3, Math.PI, 0); c.lineTo(p.x + 4.3, p.y - 4.3 + (1 - a.offen) * 8.6); c.lineTo(p.x - 4.3, p.y - 4.3 + (1 - a.offen) * 8.6); c.fill();
    }
  }

  /** Mittellinie eines Arms in diesem Bild (Ruhe mit Wogen, bzw. Richtung Ziel) */
  private armLinie(a: Arm, u: number): KurvenPunkt[] {
    const amp = this.tempo * (1 + this.wut * 0.7), ph = a.phase;
    const c1 = { x: a.c1.x + Math.sin(u / 900 + ph) * 4 * amp, y: a.c1.y + Math.cos(u / 800 + ph) * 3 * amp };
    const c2 = { x: a.c2.x + Math.sin(u / 700 + ph) * 6 * amp, y: a.c2.y + Math.cos(u / 650 + ph) * 4.5 * amp };
    let sp = { x: a.spitze.x + Math.sin(u / 600 + ph) * 7 * amp, y: a.spitze.y + Math.cos(u / 560 + ph) * 5 * amp };
    let k1 = c1, k2 = c2;
    if (a.ziel && a.mix > 0) {
      const z = a.ziel;
      const hoch = Math.min(a.wurzel.y, z.y) - 70;
      k1 = lp(c1, { x: a.wurzel.x + a.seite * 26, y: a.wurzel.y - 60 }, a.mix);
      k2 = lp(c2, { x: lerp(a.wurzel.x, z.x, 0.8), y: hoch }, a.mix);
      sp = lp(sp, z, a.mix);
    }
    const pts = kurve(a.wurzel, k1, k2, sp, 22);
    for (const q of pts) {
      const welle = Math.sin(q.t * 5.5 - u / 260 + ph) * 2.2 * Math.sin(Math.PI * q.t) * amp * (1 - a.mix * 0.7)
        + (a.zuck > 0 ? Math.sin(q.t * 14 + u / 30) * 3 * (a.zuck / 400) : 0);
      q.x += q.nx * welle;
      q.y += q.ny * welle;
    }
    return pts;
  }

  private armMalen(c: CanvasRenderingContext2D, a: Arm, u: number, vorne: boolean) {
    const pts = this.armLinie(a, u), H = a.haut, ph = a.phase, n = pts.length - 1;
    const knoten = (t: number) => H.knoten.reduce((sum, [kt, ka, kb]) => sum + ka * Math.exp(-(((t - kt) / kb) ** 2)), 0);
    // ungleich dick: Wülste, wandernde Muskelwellen, beim Aufprall staucht die Spitze
    const br = (t: number) => lerp(a.dicke, a.spitzeDicke, Math.pow(t, 0.85)) * (1 + knoten(t) + Math.sin(t * 16 - u / 220 + ph) * 0.06) * (1 + (t > 0.75 ? a.stoss * 0.5 : 0));
    const mittel = pts[Math.floor(pts.length / 2)];
    const unten = mittel.ny >= 0 ? 1 : -1;
    const at = (t: number) => pts[Math.max(0, Math.min(n, Math.round(t * n)))];
    // Haut: Grundton, Schattenseite mit welliger Grenze, blasse, schwammige Unterseite
    c.fillStyle = '#5a4058'; band(c, pts, br); c.fill();
    c.fillStyle = '#3a2438'; bandF(c, pts, br, (t) => unten * (0.04 + Math.sin(t * 23 + ph) * 0.13), () => unten); c.fill();
    c.fillStyle = '#9a7a8c'; bandF(c, pts, br, (t) => unten * (0.5 + Math.sin(t * 17 + ph) * 0.1), () => unten * 0.97); c.fill();
    // Flecken
    for (const [t, q, r, f] of H.flecken) {
      const p = at(t), w = br(p.t);
      c.fillStyle = f; c.beginPath(); c.ellipse(p.x + p.nx * q * w, p.y + p.ny * q * w, r * w * 1.4, r * w * 0.8, Math.atan2(p.ny, p.nx) + Math.PI / 2, 0, Math.PI * 2); c.fill();
    }
    // Adern, die sich am Arm entlangschlängeln
    c.lineWidth = 0.8;
    c.strokeStyle = '#3a0e1e';
    for (const [t0, t1, q, f] of H.adern) {
      c.beginPath();
      let start = true;
      for (const p of pts) {
        if (p.t < t0 || p.t > t1) continue;
        const off = (q + Math.sin(p.t * f * 25) * 0.14) * br(p.t), x = p.x + p.nx * off, y = p.y + p.ny * off;
        if (start) { c.moveTo(x, y); start = false; } else c.lineTo(x, y);
      }
      c.stroke();
    }
    // nasser Glanz: einzelne Streifen und Lichtpunkte auf der Oberseite
    for (const [t0, t1] of H.glanz) {
      const sub = pts.filter((p) => p.t >= t0 && p.t <= t1);
      if (sub.length < 2) continue;
      c.fillStyle = '#b898b0'; bandF(c, sub, br, () => -unten * 0.74, () => -unten * 0.5); c.fill();
      const m = sub[Math.floor(sub.length / 2)], w = br(m.t);
      c.fillStyle = '#f4e4f0'; c.fillRect(m.x - m.nx * w * 0.63 * unten - 0.6, m.y - m.ny * w * 0.63 * unten - 0.6, 1.3, 1.2);
    }
    // Warzen, die über den Rand stehen
    for (const [t, r] of H.warzen) {
      const p = at(t), w = br(p.t), x = p.x - p.nx * w * 0.9 * unten, y = p.y - p.ny * w * 0.9 * unten;
      c.fillStyle = '#5a4058'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#8a6a80'; c.fillRect(x - r * 0.5, y - r * 0.5, 1, 1);
    }
    // Saugnäpfe: ungleich groß und verteilt, oval, sie pulsieren; manche roh und eitrig
    for (const [t, r, roh, q] of H.naepfe) {
      const p = at(t), w = br(p.t), x = p.x + p.nx * w * q * unten, y = p.y + p.ny * w * q * unten;
      const rr = Math.max(0.9, r * w), wink = Math.atan2(p.ny, p.nx) + Math.PI / 2, pu = 1 + Math.sin(u / 300 + t * 20) * 0.1;
      c.fillStyle = '#4a2e40'; c.beginPath(); c.ellipse(x, y, rr * 1.25 * pu + 0.5, rr * 0.95 + 0.5, wink, 0, Math.PI * 2); c.fill();
      c.fillStyle = roh ? '#b86868' : '#d2b8c4'; c.beginPath(); c.ellipse(x, y, rr * 1.25 * pu, rr * 0.95, wink, 0, Math.PI * 2); c.fill();
      c.fillStyle = roh ? '#7a1a22' : '#2e1626'; c.beginPath(); c.ellipse(x + 0.3, y + 0.3, rr * 0.62 * pu, rr * 0.45, wink, 0, Math.PI * 2); c.fill();
      if (roh) { c.fillStyle = '#d8e050'; c.fillRect(x - 0.5, y - 0.5, 1, 1); }
    }
    // Schleimfäden hängen herunter, dehnen sich, tropfen
    for (const [t, l, sp] of H.schleim) {
      const p = at(t), w = br(p.t), x = p.x + p.nx * w * 0.9 * unten, y = p.y + p.ny * w * 0.9 * unten;
      const len = l * (0.55 + 0.45 * Math.sin(u / 520 + sp)), sx = Math.sin(u / 300 + sp) * 1.6;
      c.strokeStyle = '#7ab83a'; c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.sin(u / 400 + sp) * 2, y + len * 0.6, x + sx, y + len); c.stroke();
      c.fillStyle = '#9ae05a'; c.beginPath(); c.arc(x + sx, y + len + 0.7, 1.2, 0, Math.PI * 2); c.fill();
    }
    // Geschwür mit Eiter und ein Knochensporn
    const g = at(0.4), gw = br(g.t);
    c.fillStyle = '#9a3a3a'; c.beginPath(); c.arc(g.x - g.nx * gw * 0.35 * unten, g.y - g.ny * gw * 0.35 * unten, gw * 0.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#d8e050'; c.beginPath(); c.arc(g.x - g.nx * gw * 0.35 * unten - 0.4, g.y - g.ny * gw * 0.35 * unten - 0.4, gw * 0.13, 0, Math.PI * 2); c.fill();
    const k = at(0.6), kw = br(k.t), ox = -k.nx * unten, oy = -k.ny * unten;
    c.fillStyle = '#d8ccaa';
    c.beginPath(); c.moveTo(k.x + ox * kw - k.ny * 1.5, k.y + oy * kw + k.nx * 1.5); c.lineTo(k.x + ox * (kw + 4.5), k.y + oy * (kw + 4.5)); c.lineTo(k.x + ox * kw + k.ny * 1.5, k.y + oy * kw - k.nx * 1.5); c.fill();
    // vor dem Leib: feine dunkle Kante und eine Hautfalte, wo der Arm aus dem Leib wächst
    if (vorne) {
      c.strokeStyle = '#2a1426'; c.lineWidth = 0.8;
      kante(c, pts, br, 1, 0.12);
      kante(c, pts, br, -1, 0.12);
      const r0 = at(0.1), rw = br(r0.t);
      c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(r0.x + r0.nx * rw, r0.y + r0.ny * rw); c.quadraticCurveTo(pts[1].x, pts[1].y, r0.x - r0.nx * rw, r0.y - r0.ny * rw); c.stroke();
      c.strokeStyle = '#7a5a70'; c.lineWidth = 0.8;
      const r1 = at(0.13), rw1 = br(r1.t);
      c.beginPath(); c.moveTo(r1.x + r1.nx * rw1 * 0.8, r1.y + r1.ny * rw1 * 0.8); c.quadraticCurveTo(at(0.06).x, at(0.06).y, r1.x - r1.nx * rw1 * 0.8, r1.y - r1.ny * rw1 * 0.8); c.stroke();
    }
    const e = pts[n];
    // glühende Spitze beim Ausholen
    if (a.glut > 0) { c.fillStyle = '#9ae05a'; c.beginPath(); c.arc(e.x, e.y, 3 + a.glut * 2, 0, Math.PI * 2); c.fill(); }
    if (a.art === 'huf') {
      const d = pts[pts.length - 2], w = Math.atan2(e.y - d.y, e.x - d.x);
      c.save();
      c.translate(e.x, e.y);
      c.rotate(w + Math.PI / 2);
      const st = 1 + a.stoss * 0.3;
      c.scale(st, 1 / st);
      c.fillStyle = '#2e2016';
      c.beginPath(); c.ellipse(-2.4, 2, 3, 4.6, 0.15, 0, Math.PI * 2); c.ellipse(2.4, 2, 3, 4.6, -0.15, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#4a3626'; c.beginPath(); c.ellipse(-3.2, 0.5, 1.2, 2.4, 0.15, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a120c'; c.fillRect(-0.4, -1, 0.8, 7);
      c.restore();
    }
  }

  /** ausgreifende Arme auf der zweiten Leinwand (reicht über den Beckenrand hinaus) */
  private reichMalen(u: number) {
    const aktiv = this.arme.filter((a) => a.ziel && a.mix > 0);
    if (!aktiv.length) { this.reichBild.setVisible(false); return; }
    const linien = aktiv.map((a) => this.armLinie(a, u));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const l of linien) for (const q of l) { const w = this.welt(q); x0 = Math.min(x0, w.x); y0 = Math.min(y0, w.y); x1 = Math.max(x1, w.x); y1 = Math.max(y1, w.y); }
    const rand = 20 * this.s;
    const R = this.reich;
    const left = Math.round(Math.max(x0 - rand, x1 + rand - R.w)), top = Math.round(Math.max(y0 - rand, y1 + rand - R.h));
    this.reichPos = { x: left, y: top };
    R.leeren();
    const c = R.ctx, s = this.s;
    c.setTransform(s, 0, 0, s, this.x - left, this.y + this.tiefe * s - top);
    aktiv.forEach((a) => this.armMalen(c, a, u, true));
    const wurzeln = aktiv.map((a) => this.welt(a.wurzel));
    R.fertig((x, y) => wurzeln.some((w) => Math.hypot(x + left - w.x, y + top - w.y) < 18 * s));
    this.reichBild.setPosition(left, top).setVisible(true);
  }

  // ---------------------------------------------------------------- Effekte (Weltkoordinaten)

  private tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((done) => this.scene.tweens.add({ ...cfg, onComplete: () => done() }));
  }
  private warte(ms: number) {
    return new Promise<void>((done) => this.scene.time.delayedCall(ms, done));
  }

  private tropfen(p: Pt) {
    const s = this.s;
    const d = this.scene.add.ellipse(p.x, p.y, 1.4 * s, 2.4 * s, 0x8ac83a, 0.95).setDepth(this.depth + 0.6);
    this.scene.tweens.add({
      targets: d, y: this.wasserWeltY, scaleY: 1.6, duration: Math.max(140, (this.wasserWeltY - p.y) * 6), ease: 'Quad.easeIn',
      onComplete: () => { d.destroy(); this.ring(p.x, this.wasserWeltY, 0x8ac83a, 0.6); },
    });
  }

  private blase(x: number, y: number) {
    const s = this.s;
    const b = this.scene.add.circle(x, y, Phaser.Math.FloatBetween(0.8, 2) * s, 0x6aff4a, 0.55).setStrokeStyle(0.6 * s, 0xd8ffd0, 0.9).setDepth(this.depth + 0.6);
    this.scene.tweens.add({
      targets: b, y: y - Phaser.Math.FloatBetween(1, 4) * s, scale: 1.6, duration: Phaser.Math.Between(260, 520),
      onComplete: () => { b.destroy(); if (Math.random() < 0.3) this.dampf(x, y - 3 * s, 0x6aff4a); },
    });
  }

  private ring(x: number, y: number, f: number, groesse = 1) {
    const s = this.s;
    const r = this.scene.add.ellipse(x, y, 5 * s * groesse, 2 * s * groesse).setStrokeStyle(0.8 * s, f, 0.9).setDepth(this.depth + 0.6);
    this.scene.tweens.add({ targets: r, scaleX: 3, scaleY: 2.4, alpha: 0, duration: 520, onComplete: () => r.destroy() });
  }

  private dampf(x: number, y: number, f: number) {
    const s = this.s;
    const d = this.scene.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(f).setScale(0.06 * s).setAlpha(0.45).setDepth(this.depth + 0.7);
    this.scene.tweens.add({ targets: d, y: y - 16 * s, x: x + Phaser.Math.FloatBetween(-5, 5) * s, scale: 0.2 * s, alpha: 0, duration: 1100, onComplete: () => d.destroy() });
  }

  /** Partikel mit Schwerkraft (Spritzer, Splitter) */
  spritzer(x: number, y: number, n: number, kraft: number, farben = [0x8ab878, 0xd8f0d0, 0x6aff4a], boden = y) {
    const s = this.s, sc = this.scene;
    for (let i = 0; i < n; i++) {
      const o = sc.add.rectangle(x + Phaser.Math.Between(-8, 8) * s, y, 2, 2, farben[i % farben.length]).setDepth(this.depth + 2);
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
    const l = this.scene.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(f).setScale(0.2 * gr * this.s).setAlpha(0.95).setDepth(this.depth + 3);
    this.scene.tweens.add({ targets: l, scale: 0.9 * gr * this.s, alpha: 0, duration: ms, ease: 'Quad.easeOut', onComplete: () => l.destroy() });
  }

  /** Druckwelle als Ringe (Röhren, Aufprall) */
  druckwelle(x: number, y: number, f: number, flach = false) {
    const s = this.s;
    for (let i = 0; i < 3; i++) {
      const r = this.scene.add.ellipse(x, y, 12 * s, (flach ? 4 : 12) * s).setStrokeStyle(2, f, 0.8).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 3);
      this.scene.tweens.add({ targets: r, scaleX: 14 - i * 3, scaleY: 14 - i * 3, alpha: 0, duration: 650 + i * 120, delay: i * 90, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
    }
  }

  // ---------------------------------------------------------------- Aktionen

  /** unter Wasser verstecken (vor dem Auftauchen) */
  versteckt() {
    this.scene.tweens.killTweensOf(this);
    this.tiefe = 260;
    this.sichtbar = 0;
    return this;
  }
  /** sofort aufgetaucht (nach Überspringen) */
  bereit() {
    this.scene.tweens.killTweensOf(this);
    this.sprudel?.remove();
    this.tiefe = 0;
    this.sichtbar = 1;
    this.wut = 0; this.kopfNeigung = 0; this.kieferAuf = 0;
    return this;
  }

  /** steigt aus der Brühe: Fontäne, grünes Aufleuchten, Sprudeln, Kamera bebt; der Kopf kommt zuerst, die Arme ziehen nach */
  async auftauchen(ms = 2800) {
    this.tiefe = 260;
    this.sichtbar = 0;
    this.kopfNeigung = 0.25;
    this.scene.tweens.add({ targets: this, sichtbar: 1, duration: ms * 0.3 });
    this.scene.tweens.add({ targets: this, kopfNeigung: 0, duration: ms, ease: 'Sine.easeInOut' });
    this.spritzer(this.x, this.wasserWeltY, 50, 260);
    this.druckwelle(this.x, this.wasserWeltY, 0x6aff4a, true);
    this.aufleuchten(this.x, this.wasserWeltY, 0x6aff4a, 3, 900);
    audio.sfx('splash');
    audio.sfx('rumble');
    this.scene.cameras.main.shake(ms, 0.005);
    this.sprudel?.remove();
    this.sprudel = this.scene.time.addEvent({ delay: 60, loop: true, callback: () => this.spritzer(this.x + Phaser.Math.Between(-80, 80) * this.s, this.wasserWeltY, 2, 140) });
    await this.tw({ targets: this, tiefe: 0, duration: ms, ease: 'Cubic.easeOut' });
    this.sprudel?.remove();
  }

  /** Röhren: erst duckt er sich (Ausholen), dann Kopf in den Nacken, Kiefer weit auf, Arme spreizen sich, Druckwellen */
  async roehren() {
    const arme = this.arme.filter((a) => !a.ziel);
    await this.tw({ targets: this, kopfNeigung: 0.14, kieferAuf: 0.15, duration: 260, ease: 'Sine.easeOut' });
    audio.sfx('roar');
    this.scene.cameras.main.shake(1200, 0.009);
    const vorher = this.wut;
    this.scene.tweens.add({ targets: this, wut: 1, duration: 220, yoyo: true, hold: 900, onComplete: () => { this.wut = vorher; } });
    this.scene.tweens.add({ targets: this.maulLicht, alpha: 0.9, scale: 1.1 * this.s, duration: 260, yoyo: true, hold: 760 });
    for (const a of arme) a.zuck = 1200;
    await this.tw({ targets: this, kopfNeigung: -0.2, kieferAuf: 1, duration: 220, ease: 'Back.easeOut' });
    const m = this.maulWelt();
    this.druckwelle(m.x, m.y, 0x8aff5a);
    this.scene.cameras.main.flash(120, 90, 255, 90);
    for (let i = 0; i < 4; i++) this.scene.time.delayedCall(i * 160, () => this.spritzer(m.x, m.y, 9, 120, [0x8ac83a, 0xb8f060], this.wasserWeltY));
    const cam = this.scene.cameras.main.worldView;
    for (let i = 0; i < 18; i++) {
      const d = this.scene.add.rectangle(cam.x + Math.random() * cam.width, cam.y - 4, 2, 2, 0x5a5048).setDepth(this.depth + 4);
      this.scene.tweens.add({ targets: d, y: cam.y + cam.height * (0.4 + Math.random() * 0.5), angle: 360, delay: Math.random() * 500, duration: 700 + Math.random() * 500, ease: 'Quad.easeIn', onComplete: () => d.destroy() });
    }
    this.emit('welle');
    await this.warte(850);
    await this.tw({ targets: this, kopfNeigung: 0, kieferAuf: 0, duration: 480, ease: 'Sine.easeInOut' });
  }

  /** ein Hufarm holt glühend hoch aus, hält kurz (Ankündigung) und kracht auf einen Weltpunkt; Ereignis 'schlag' */
  async schlag(zielWelt: Pt) {
    const a = this.arme.filter((x) => x.art === 'huf')[this.hufArm++ % 2];
    const ziel = this.lokal(zielWelt);
    a.ziel = { x: lerp(a.wurzel.x, ziel.x, 0.45), y: -175 };
    this.scene.tweens.add({ targets: a, glut: 1, duration: 300 });
    this.scene.tweens.add({ targets: this, kopfNeigung: -0.06 * a.seite, duration: 300, yoyo: true, hold: 200 });
    await this.tw({ targets: a, mix: 1, duration: 340, ease: 'Sine.easeOut' });
    audio.sfx('whoosh');
    await this.tw({ targets: a.ziel, x: ziel.x, y: ziel.y, duration: 150, ease: 'Cubic.easeIn' });
    audio.sfx('thud');
    a.zuck = 300;
    a.stoss = 1;
    this.scene.cameras.main.shake(280, 0.013);
    this.druckwelle(zielWelt.x, zielWelt.y, 0x9aff6a, true);
    this.aufleuchten(zielWelt.x, zielWelt.y, 0x9aff6a, 1.4, 300);
    this.spritzer(zielWelt.x, zielWelt.y, 18, 150, [0x8ab878, 0x5a5048, 0xd8f0d0], zielWelt.y);
    this.emit('schlag', zielWelt);
    this.scene.tweens.add({ targets: a, glut: 0, duration: 400 });
    await this.warte(420);
    await this.tw({ targets: a, mix: 0, duration: 600, ease: 'Sine.easeInOut' });
    a.ziel = undefined;
  }

  /** ein Hufarm holt aus und fegt flach über den Boden, von einem Weltpunkt zum anderen */
  async fegen(vonWelt: Pt, bisWelt: Pt, ms = 520) {
    const a = this.arme.filter((x) => x.art === 'huf')[this.hufArm++ % 2];
    const von = this.lokal(vonWelt), bis = this.lokal(bisWelt);
    a.ziel = { x: von.x * 0.6, y: von.y - 50 };
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
    this.blitz = 110;
    for (const a of this.arme) a.zuck = 420;
    const p = stelle ?? this.welt({ x: Phaser.Math.Between(-30, 30), y: Phaser.Math.Between(-90, -30) });
    this.spritzer(p.x, p.y, 12, 130, [0x8ac83a, 0x6a2a5a, 0xd8e050], this.wasserWeltY);
    this.aufleuchten(p.x, p.y, 0xffffff, 0.8, 160);
    this.scene.tweens.add({ targets: this, kopfNeigung: 0.16, duration: 90, yoyo: true });
    if (this.ruckX !== undefined) return;
    const x0 = this.x;
    this.ruckX = x0;
    this.scene.tweens.add({ targets: this.bild, scaleX: 1.03, scaleY: 0.97, duration: 70, yoyo: true });
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
          for (const dx of [-4.5, 4.5]) { const n = this.welt(this.kopf({ x: dx, y: 0 })); this.dampf(n.x, n.y, 0xff5a3a); }
        },
      });
    } else if (!an) { this.brunftDampf?.remove(); this.brunftDampf = undefined; }
  }

  /** die Geweih-Augen laden sich auf (Funken fliegen hinein) und schießen gleißende Strahlen; Ereignis 'strahl' */
  async strahl(zielWelt: Pt) {
    this.blick = zielWelt;
    const sichtbare = () => this.augen.filter((a) => !a.aus && !this.geweihAb[a.seite < 0 ? 0 : 1]);
    this.scene.tweens.add({ targets: this, ladung: 1, duration: 560 });
    audio.sfx('zisch');
    const lade = this.scene.time.addEvent({
      delay: 40, repeat: 13, callback: () => {
        for (const a of sichtbare()) {
          if (Math.random() < 0.5) continue;
          const z = this.welt(this.augePunkt(a)), w = Math.random() * Math.PI * 2, r = 16 * this.s;
          const f = this.scene.add.rectangle(z.x + Math.cos(w) * r, z.y + Math.sin(w) * r, 2, 2, 0xe0b0ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 3);
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
        for (const a of sichtbare()) {
          const von = this.welt(this.augePunkt(a));
          const fl = 0.75 + Math.random() * 0.25;
          const pts: Pt[] = [];
          for (let i = 0; i <= 10; i++) {
            const k = i / 10, x = von.x + (zielWelt.x - von.x) * k, y = von.y + (zielWelt.y - von.y) * k;
            const j = Math.sin(k * 9 + t / 30) * 1.4 * Math.sin(k * Math.PI);
            pts.push({ x: x + j, y: y + j * 0.5 });
          }
          for (const [w, f, al] of [[6, 0x5a1aaa, 0.22], [3, 0x9a4aff, 0.5], [1.2, 0xffffff, 0.95]] as [number, number, number][]) {
            g.lineStyle(w, f, al * fl);
            g.strokePoints(pts, false);
          }
          g.fillStyle(0xe0b0ff, 0.6 * fl).fillCircle(von.x, von.y, 3 * this.s);
        }
        g.fillStyle(0xffffff, 0.9).fillCircle(zielWelt.x, zielWelt.y, (3 + Math.random() * 2.5) * this.s);
        g.fillStyle(0xb040ff, 0.4).fillCircle(zielWelt.x, zielWelt.y, (9 + Math.random() * 3) * this.s);
      };
      this.scene.events.on(Phaser.Scenes.Events.UPDATE, zeichne);
    });
    funken.remove();
    g.destroy();
    const fleck = this.scene.add.ellipse(zielWelt.x, zielWelt.y, 16 * this.s, 6 * this.s, 0x1a0a1a, 0.7).setDepth(this.depth - 1);
    this.scene.tweens.add({ targets: fleck, alpha: 0, duration: 2400, delay: 600, onComplete: () => fleck.destroy() });
    this.scene.tweens.add({ targets: this, ladung: 0, duration: 320 });
    this.blick = undefined;
  }

  /** frisst etwas: Kiefer schnappt, dann würgt er, wird rot, zittert, dampft */
  async curryFressen() {
    for (let i = 0; i < 4; i++) {
      await this.tw({ targets: this, kieferAuf: 0.8, kopfNeigung: 0.08, duration: 110 });
      audio.sfx('chomp');
      await this.tw({ targets: this, kieferAuf: 0, kopfNeigung: 0, duration: 110 });
    }
    await this.warte(300);
    audio.sfx('retch');
    this.scene.tweens.add({ targets: this, wuerg: 1, tempo: 2.4, duration: 600 });
    const dampf = this.scene.time.addEvent({
      delay: 110, loop: true, callback: () => {
        for (const p of [{ x: -20, y: -60 }, { x: 20, y: -60 }, { x: 0, y: 6 }]) { const w = this.welt(this.kopf(p)); this.dampf(w.x, w.y, 0xff8a3a); }
      },
    });
    await this.tw({ targets: this, kopfNeigung: 0.1, kieferAuf: 0.5, duration: 500, yoyo: true, repeat: 2 });
    dampf.remove();
  }

  /** das Ende: das Geweih bricht in Splittern ab, die Augen platzen eins nach dem anderen, er versinkt mit einer Fontäne */
  async niederlage() {
    this.tot = true;
    this.brunft(false);
    audio.sfx('crack');
    const cam = this.scene.cameras.main;
    cam.shake(500, 0.012);
    cam.flash(160, 255, 255, 255);
    for (const a of this.augen) {
      await this.warte(120);
      a.aus = true;
      const w = this.welt(this.augePunkt(a));
      this.aufleuchten(w.x, w.y, 0xb040ff, 0.7, 300);
      this.spritzer(w.x, w.y, 5, 90, [0xe0b0ff, 0xffffff], this.wasserWeltY);
      audio.sfx('blip');
    }
    for (const [i, sd] of [[0, -1], [1, 1]] as [number, number][]) {
      const basis = this.welt(this.kopf(geweihStange(sd).b));
      for (let k = 0; k < 14; k++) {
        const sp = this.scene.add.rectangle(basis.x + sd * k * 2.5 * this.s, basis.y - k * 3 * this.s, Phaser.Math.Between(2, 5), 2, k % 3 ? 0xd8ccaa : 0x7a2228).setDepth(this.depth + 3);
        this.scene.tweens.add({ targets: sp, x: sp.x + sd * Phaser.Math.FloatBetween(10, 60) * this.s, angle: Phaser.Math.Between(-540, 540), duration: 950, ease: 'Linear' });
        this.scene.tweens.add({ targets: sp, y: this.wasserWeltY, duration: 950, ease: 'Quad.easeIn', onComplete: () => { this.ring(sp.x, this.wasserWeltY, 0xd8f0d0, 0.6); sp.destroy(); } });
      }
      this.geweihAb[i] = true;
      audio.sfx('crack');
      await this.warte(200);
    }
    await this.tw({ targets: this, kopfNeigung: 0.4, kieferAuf: 0.7, wuerg: 0, tempo: 0.4, duration: 700 });
    audio.sfx('rumble');
    const blasen = this.scene.time.addEvent({ delay: 60, loop: true, callback: () => this.blase(this.x + Phaser.Math.Between(-60, 60) * this.s, this.wasserWeltY) });
    await this.tw({ targets: this, tiefe: 270, duration: 2800, ease: 'Sine.easeIn' });
    this.sichtbar = 0;
    blasen.remove();
    this.spritzer(this.x, this.wasserWeltY, 50, 260);
    this.druckwelle(this.x, this.wasserWeltY, 0x6aff4a, true);
    audio.sfx('splash');
  }
}
