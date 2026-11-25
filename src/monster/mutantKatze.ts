import Phaser from 'phaser';
import { audio } from '../audio';
import { KurvenPunkt, PixelLeinwand, Pt, band, dreh, glatt, kurve, zufall } from './pixelMaler';

// Die Katze in ihrer Monstergestalt (die Mutation von damals, als sie Glanz gefressen hat), von der Seite, nach rechts
// schauend, mit dem Wirt auf dem Rücken. Ein lebendes Pixelbild (siehe pixelMaler.ts): Rumpf mit Knochenstacheln,
// offener Flanke und kahlen Stellen, vier Beine mit echten Gelenken (vorn Schulter, Ellbogen, Pfote; hinten Hüfte,
// Knie, Sprunggelenk), drei Tentakelschwänze, ein verformter Kopf mit sechs Augen und einem Maul voller Zähne. Alles
// unter einem gemeinsamen Umriss; hintere Beine liegen im Schatten. Der Wirt sitzt als eigene Figur im Fell.
// Die Szene setzt gang (-1..1, Laufen relativ zur Blickrichtung), luft (springt) und duck (Block, 0..1) und ruft die
// Aktionen auf: kralle, biss, treffer, fauchen, superGlut, nachbild, ko, aufstehen, wuergen, maulZu.

/** Größe in Einheiten; Ursprung am Boden unter dem Rumpf */
const CW = 230, CH = 150, OX = 112, OY = 136;
const STUFEN = 12;
const FELL = '#4e5a3c', FELL_D = '#2e3522', FELL_H = '#6e7c52', HAUT = '#c08474', KNOCHEN = '#ddd4b2';
const AUGEN: [number, number, number, string][] = [
  [72, -82, 3.4, '#f0e840'], [81, -84, 2.5, '#ff3a10'], [87, -78, 1.9, '#f0e840'], [64, -78, 1.7, '#ff3a10'], [75, -90, 1.6, '#dfe6d8'], [58, -86, 1.3, '#f0e840'],
];
const FELLSTRICHE = (() => {
  const r = zufall(91), out: [number, number, number][] = [];
  for (let i = 0; i < 90; i++) out.push([-42 + r() * 82, -70 + r() * 38, r()]);
  return out;
})();

interface Bein { hx: number; hy: number; vorne: boolean; fern: boolean; off: number }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** zweigliedriges Bein: Knie aus Hüfte, Fuß, Längen und Beugerichtung */
function knie(h: Pt, f: Pt, l1: number, l2: number, beuge: number): Pt {
  const dx = f.x - h.x, dy = f.y - h.y;
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const a = Math.atan2(dy, dx);
  const cosA = Phaser.Math.Clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d || 1), -1, 1);
  const w = a + beuge * Math.acos(cosA);
  return { x: h.x + Math.cos(w) * l1, y: h.y + Math.sin(w) * l1 };
}
const strecke = (a: Pt, b: Pt, n = 6) => kurve(a, { x: lerp(a.x, b.x, 0.33), y: lerp(a.y, b.y, 0.33) }, { x: lerp(a.x, b.x, 0.66), y: lerp(a.y, b.y, 0.66) }, b, n);

export class MutantKatze extends Phaser.GameObjects.Container {
  private s: number;
  private leinwand: PixelLeinwand;
  private bild: Phaser.GameObjects.Image;
  readonly reiter?: Phaser.GameObjects.Sprite;
  private fxG?: Phaser.GameObjects.Graphics;
  private schein!: Phaser.GameObjects.Image;
  private augenGlanz: Phaser.GameObjects.Image[] = [];
  private beine: Bein[] = [
    { hx: -30, hy: -46, vorne: false, fern: true, off: Math.PI },
    { hx: 30, hy: -48, vorne: true, fern: true, off: 0 },
    { hx: -34, hy: -44, vorne: false, fern: false, off: 0 },
    { hx: 26, hy: -46, vorne: true, fern: false, off: Math.PI },
  ];
  private spur: Pt[] = [];
  private spurFern: Pt[] = [];
  private uhr = 0;
  private zuletzt = -1000;
  private schritt = 0;
  gang = 0;
  luft = false;
  duck = 0;
  pfote = 0;
  pfoteFern = 0;
  hoch = 0;
  kieferAuf = 0;
  kopfVor = 0;
  kopfW = 0;
  leibW = 0;
  wut = 0;
  glut = 0;
  private blitz = 0;
  private tot = false;
  private reiterHops = 0;
  private reiterDa: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, scale = 1, mitReiter = true) {
    super(scene, x, y);
    this.s = scale;
    const w = Math.ceil(CW * scale), h = Math.ceil(CH * scale);
    this.leinwand = new PixelLeinwand(scene, w, h, STUFEN);
    this.bild = new Phaser.GameObjects.Image(scene, 0, 0, this.leinwand.key).setOrigin((OX * scale) / w, (OY * scale) / h);
    this.add(this.bild);
    this.reiterDa = mitReiter;
    if (mitReiter) {
      // der Wirt sitzt im Fell: nur Kopf und Oberkörper zu sehen, das Bein hängt über der Flanke (im Bild gemalt)
      this.reiter = new Phaser.GameObjects.Sprite(scene, 0, 0, 'wirtKanal', 6).setOrigin(0.5, 1);
      this.reiter.setCrop(0, 0, 32, 27);
      this.add(this.reiter);
    }
    for (const [, , er, col] of AUGEN) {
      if (col === '#dfe6d8') continue;
      this.augenGlanz.push(scene.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(col === '#ff3a10' ? 0xff4a1a : 0xf0e840).setScale((0.035 + er * 0.01) * scale).setAlpha(0.7));
    }
    this.schein = scene.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6aff4a).setScale(1.2 * scale).setAlpha(0.2);
    this.fxG = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    scene.add.existing(this);
    this.setDepth(this.depth);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
      this.schein.destroy();
      this.fxG?.destroy();
      this.augenGlanz.forEach((g) => g.destroy());
      this.leinwand.zerstoeren();
    });
    this.malen(0);
  }

  setDepth(d: number) {
    super.setDepth(d);
    if (this.fxG) { this.schein.setDepth(d - 0.2); this.fxG.setDepth(d + 0.3); this.augenGlanz.forEach((g) => g.setDepth(d + 0.2)); }
    return this;
  }

  /** Reiter zeigen oder verstecken (vor dem Aufsteigen, beim Absteigen) */
  reiterZeigen(an: boolean) {
    this.reiterDa = an;
    this.reiter?.setVisible(an);
  }

  /** Blickrichtung: 1 rechts, -1 links */
  get blick() { return Math.sign(this.scaleX) || 1; }
  setBlick(d: number) { this.scaleX = Math.abs(this.scaleX) * (d < 0 ? -1 : 1); return this; }

  /** lokaler Punkt (Einheiten) → Welt (berücksichtigt Spiegelung) */
  welt(q: Pt): Pt { return { x: this.x + q.x * this.s * this.scaleX, y: this.y + q.y * this.s * this.scaleY }; }
  maulWelt(): Pt { return this.welt(this.kopf({ x: 84, y: -62 + this.kieferAuf * 8 })); }
  pfoteWelt(): Pt { return this.welt(this.fussPos(this.beine[3])); }
  /** wo der Wirt auf dem Rücken sitzt (Welt) */
  reiterWelt(): Pt { return this.welt(this.amRumpf(-6, -66)); }

  private tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((done) => this.scene.tweens.add({ ...cfg, onComplete: () => done() }));
  }
  private warte(ms: number) {
    return new Promise<void>((done) => this.scene.time.delayedCall(ms, done));
  }

  // ---------------------------------------------------------------- Geometrie

  private lauf() { return Math.min(1, Math.abs(this.gang)) * (this.luft ? 0 : 1); }
  private rumpfY() { return Math.abs(Math.sin(this.schritt)) * -2 * this.lauf() + Math.sin(this.uhr / 520) * 0.7 + this.duck * 9 + (this.tot ? 14 : 0); }
  private rumpfW() { return this.leibW + this.duck * 0.07 + Math.sin(this.schritt * 2) * 0.025 * this.lauf() + (this.tot ? -0.12 : 0); }
  /** Punkt am Rumpf → lokal (Neigung um die Rumpfmitte, Heben und Senken) */
  private amRumpf(x: number, y: number): Pt {
    const p = dreh({ x, y }, this.rumpfW(), { x: 0, y: -50 });
    return { x: p.x, y: p.y + this.rumpfY() };
  }
  /** Kopfkoordinaten (Ruhelage) → lokal */
  private kopf(p: Pt): Pt {
    const hals = this.amRumpf(46, -64);
    const r = dreh({ x: p.x - 50, y: p.y + 70 }, this.kopfW + Math.sin(this.uhr / 700) * 0.03 + this.duck * 0.2 - this.kopfVor * 0.08 + (this.tot ? 0.35 : 0));
    return { x: hals.x + r.x + this.kopfVor * 9, y: hals.y + r.y + this.duck * 4 + this.kopfVor * 2 };
  }

  private fussPos(b: Bein): Pt {
    const h = this.amRumpf(b.hx, b.hy);
    if (this.tot) return { x: h.x + (b.vorne ? 14 : -14), y: Math.min(0, h.y + 22) };
    let f: Pt;
    if (this.luft) f = { x: h.x + (b.vorne ? 12 : -10), y: h.y + 18 };
    else {
      const g = this.lauf();
      const ph = this.schritt + b.off;
      f = { x: b.hx + (b.vorne ? 6 : -2) + Math.sin(ph) * 12 * g, y: -Math.max(0, Math.cos(ph)) * 8 * g };
    }
    const pf = b.vorne ? (b.fern ? this.pfoteFern : this.pfote) : 0;
    if (pf > 0) {
      const ziel = { x: h.x + 34 - this.hoch * 6, y: h.y - 12 - this.hoch * 20 };
      f = { x: lerp(f.x, ziel.x, pf), y: lerp(f.y, ziel.y, pf) };
    }
    return f;
  }

  // ---------------------------------------------------------------- Ruhe

  private tick(_t: number, delta: number) {
    if (!this.active) return;
    this.uhr += delta * (1 + this.wut * 0.6);
    this.schritt += (delta / 1000) * 10 * this.gang;
    if (this.blitz > 0) this.blitz -= delta;
    this.reiterHops = Math.max(0, this.reiterHops - delta / 300);
    if (this.uhr - this.zuletzt >= 33 || this.blitz > 0) { this.zuletzt = this.uhr; this.malen(this.uhr); }
    if (this.blitz > 0) this.bild.setTintFill(0xffffff);
    else this.bild.clearTint();
    // Reiter folgt dem Rücken, hüpft bei Treffern
    if (this.reiter) {
      const r = this.amRumpf(-6, -62);
      this.reiter.setPosition(r.x * this.s, (r.y - Math.sin(this.reiterHops * Math.PI) * 6 - Math.abs(Math.sin(this.schritt)) * 1.2 * this.lauf()) * this.s + 13);
      this.reiter.setRotation(-this.rumpfW() * 0.5 + (this.tot ? -1.2 : 0)).setVisible(this.reiterDa);
    }
    // Lichter
    const sichtbar = AUGEN.filter((a) => a[3] !== '#dfe6d8');
    sichtbar.forEach(([ex, ey], i) => {
      const p = this.welt(this.kopf({ x: ex, y: ey }));
      this.augenGlanz[i].setPosition(p.x, p.y).setAlpha(this.tot ? 0 : 0.55 + Math.sin(this.uhr / 110 + i * 1.7) * 0.12 + this.wut * 0.3);
    });
    const bauch = this.welt(this.amRumpf(0, -44));
    this.schein.setPosition(bauch.x, bauch.y).setAlpha(this.tot ? 0.04 : 0.16 + this.glut * 0.5 + Math.sin(this.uhr / 300) * 0.04).setScale((1.2 + this.glut * 0.9) * this.s);
  }

  // ---------------------------------------------------------------- Zeichnen

  private malen(u: number) {
    const L = this.leinwand, c = L.ctx, s = this.s;
    L.leeren();
    c.setTransform(s, 0, 0, s, OX * s, OY * s);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    // hintere Ebene: Schwänze und ferne Beine, im Schatten
    this.schwaenze(c, u);
    for (const b of this.beine) if (b.fern) this.bein(c, b);
    c.globalCompositeOperation = 'source-atop';
    c.fillStyle = 'rgba(10,14,6,0.38)';
    c.fillRect(-OX, -OY, CW, CH);
    c.globalCompositeOperation = 'source-over';
    this.rumpf(c, u);
    if (this.reiterDa) this.reiterBein(c);
    this.kopfMalen(c, u);
    for (const b of this.beine) if (!b.fern) this.bein(c, b);
    // Licht: oben links fahl, unten grünes Licht aus der Brühe, bei der Superglut alles grün
    c.globalCompositeOperation = 'source-atop';
    const sh = c.createRadialGradient(-30, -120, 8, 0, -50, 150);
    sh.addColorStop(0, 'rgba(255,240,210,0.22)'); sh.addColorStop(0.4, 'rgba(255,240,210,0)'); sh.addColorStop(1, 'rgba(6,10,4,0.55)');
    c.fillStyle = sh; c.fillRect(-OX, -OY, CW, CH);
    const gr = c.createLinearGradient(0, 0, 0, -36);
    gr.addColorStop(0, 'rgba(110,255,70,0.35)'); gr.addColorStop(1, 'rgba(110,255,70,0)');
    c.fillStyle = gr; c.fillRect(-OX, -OY, CW, CH);
    if (this.glut > 0.03) { c.fillStyle = 'rgba(140,255,90,' + (0.4 * this.glut).toFixed(3) + ')'; c.fillRect(-OX, -OY, CW, CH); }
    c.globalCompositeOperation = 'source-over';
    L.fertig();
    this.spurMalen();
  }

  private rumpf(c: CanvasRenderingContext2D, u: number) {
    c.save();
    c.translate(0, this.rumpfY());
    c.translate(0, -50); c.rotate(this.rumpfW()); c.translate(0, 50);
    const atem = Math.sin(u / 520);
    // Rumpf: Buckel an den Schultern, eingefallene Flanke, schwerer Bauch
    const g = c.createLinearGradient(0, -76, 0, -28);
    g.addColorStop(0, FELL_H); g.addColorStop(0.45, FELL); g.addColorStop(1, FELL_D);
    c.fillStyle = g;
    glatt(c, [[-46, -50], [-42, -66], [-26, -72], [-6, -70], [12, -76], [30, -80], [44, -70], [48, -54], [40, -38], [20, -32 + atem], [-4, -31 + atem], [-26, -33], [-44, -40]]);
    c.fill();
    // Bauch heller
    c.fillStyle = '#6a7850';
    glatt(c, [[-30, -36], [-6, -33 + atem], [22, -34 + atem], [36, -40], [22, -38], [-6, -37], [-26, -39]]);
    c.fill();
    // Fell: kurze Striche in Wuchsrichtung
    c.lineWidth = 1;
    for (const [x, y, k] of FELLSTRICHE) {
      c.strokeStyle = k < 0.45 ? FELL_D : k < 0.8 ? '#3e4830' : '#7a8a5a';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2.5, y + 2 + k * 2); c.stroke();
    }
    // offene Flanke: rohes Fleisch, Rippen
    c.fillStyle = '#4a1212'; c.beginPath(); c.ellipse(-4, -48, 13, 9, -0.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a2228'; c.beginPath(); c.ellipse(-4, -48, 13, 9, -0.1, 0, Math.PI * 2); c.lineWidth = 1.6; c.strokeStyle = '#9a3a3a'; c.stroke();
    for (let i = 0; i < 5; i++) {
      const x = -14 + i * 5;
      c.strokeStyle = '#8a7e62'; c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(x, -56); c.quadraticCurveTo(x + 2, -48, x - 1, -40); c.stroke();
      c.strokeStyle = KNOCHEN; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x - 0.5, -56); c.quadraticCurveTo(x + 1.5, -48, x - 1.5, -41); c.stroke();
    }
    // kahle Stellen mit Eiterbeulen
    for (const [x, y, r] of [[-30, -58, 6], [24, -44, 5], [36, -62, 3.5]] as [number, number, number][]) {
      c.fillStyle = HAUT; c.beginPath(); c.ellipse(x, y, r, r * 0.7, 0.2, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 3; i++) { c.fillStyle = '#d8e050'; c.beginPath(); c.arc(x - r / 2 + i * r / 2, y + ((i * 7) % 3) - 1, 1.2, 0, Math.PI * 2); c.fill(); }
    }
    // Knochenstacheln auf dem Rücken (wo der Wirt sitzt, keine)
    for (let i = 0; i < 9; i++) {
      const x = -40 + i * 9;
      if (x > -18 && x < 8) continue;
      const basisY = x < -20 ? -64 - (x + 40) * 0.2 : -72 - (x - 8) * 0.18;
      const h = 6 + (i % 2) * 4;
      c.fillStyle = '#8a7e62';
      c.beginPath(); c.moveTo(x - 3, basisY + 2); c.lineTo(x - 2, basisY - h); c.lineTo(x + 3, basisY + 2); c.fill();
      c.fillStyle = KNOCHEN;
      c.beginPath(); c.moveTo(x - 2.4, basisY + 1); c.lineTo(x - 2, basisY - h); c.lineTo(x, basisY + 1); c.fill();
    }
    // Fellbüschel, in dem der Wirt sitzt
    c.fillStyle = FELL;
    glatt(c, [[-16, -64], [-10, -70], [0, -70], [6, -66], [0, -62], [-10, -62]]);
    c.fill();
    c.restore();
  }

  /** das Bein des Wirts hängt über die Flanke: grüne Wathose, Gummistiefel */
  private reiterBein(c: CanvasRenderingContext2D) {
    const a = this.amRumpf(-4, -64), b = this.amRumpf(0, -48), f = this.amRumpf(4, -40);
    c.strokeStyle = '#2c4e2a'; c.lineWidth = 5.4;
    c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(b.x - 2, b.y, f.x, f.y); c.stroke();
    c.strokeStyle = '#3e6a3a'; c.lineWidth = 3.6;
    c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo(b.x - 2, b.y, f.x, f.y); c.stroke();
    c.fillStyle = '#22361f'; c.beginPath(); c.ellipse(f.x + 2, f.y + 1, 4.5, 2.6, 0.2, 0, Math.PI * 2); c.fill();
  }

  private kopfMalen(c: CanvasRenderingContext2D, u: number) {
    const hals = this.amRumpf(46, -64);
    // Hals: dicker Muskelstrang zum Kopf
    const k0 = this.kopf({ x: 52, y: -74 }), k1 = this.kopf({ x: 56, y: -62 });
    c.fillStyle = FELL;
    c.beginPath();
    c.moveTo(hals.x - 12, hals.y - 10); c.quadraticCurveTo(hals.x, hals.y - 16, k0.x, k0.y - 6);
    c.lineTo(k1.x, k1.y + 6); c.quadraticCurveTo(hals.x + 2, hals.y + 12, hals.x - 10, hals.y + 14); c.closePath();
    c.fill();
    c.save();
    const p = this.kopf({ x: 50, y: -70 });
    c.translate(p.x, p.y);
    c.rotate(this.kopfW + Math.sin(this.uhr / 700) * 0.03 + this.duck * 0.2 - this.kopfVor * 0.08 + (this.tot ? 0.35 : 0));
    c.translate(-50, 70);
    // Ohren: eins zerfetzt, eins mit Loch
    c.fillStyle = FELL_D;
    c.beginPath(); c.moveTo(54, -86); c.lineTo(50, -102); c.lineTo(56, -97); c.lineTo(58, -103); c.lineTo(63, -88); c.fill();
    c.beginPath(); c.moveTo(70, -90); c.lineTo(76, -104); c.lineTo(80, -88); c.fill();
    c.fillStyle = HAUT; c.beginPath(); c.moveTo(73, -91); c.lineTo(76, -99); c.lineTo(78, -90); c.fill();
    // Schädel: platt, schief, Schnauze lang
    const kg = c.createLinearGradient(50, -96, 70, -60);
    kg.addColorStop(0, FELL_H); kg.addColorStop(0.6, FELL); kg.addColorStop(1, FELL_D);
    c.fillStyle = kg;
    glatt(c, [[46, -78], [52, -90], [64, -95], [78, -92], [88, -84], [96, -74], [94, -68], [80, -65], [62, -64], [50, -68]]);
    c.fill();
    c.fillStyle = HAUT; c.beginPath(); c.ellipse(60, -88, 4.5, 3, -0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#7a8a5a'; c.beginPath(); c.ellipse(84, -80, 8, 4.5, 0.2, 0, Math.PI * 2); c.fill();
    // Nase
    c.fillStyle = '#2a1010'; c.beginPath(); c.ellipse(95, -72, 2, 1.6, 0, 0, Math.PI * 2); c.fill();
    // Augen
    for (const [ex, ey, er, col] of AUGEN) {
      c.fillStyle = '#200606'; c.beginPath(); c.arc(ex, ey, er + 0.9, 0, Math.PI * 2); c.fill();
      c.fillStyle = this.tot ? '#4a4038' : col; c.beginPath(); c.arc(ex, ey, er, 0, Math.PI * 2); c.fill();
      if (col !== '#dfe6d8' && !this.tot) { c.fillStyle = '#0a0a0a'; c.fillRect(ex - 0.5, ey - er + 0.8, 1, er * 2 - 1.6); }
      c.fillStyle = '#ffffff'; c.fillRect(ex - er * 0.55, ey - er * 0.55, 1, 1);
    }
    // Rachen und obere Zahnreihe
    const auf = this.kieferAuf;
    if (auf > 0.05) {
      c.fillStyle = '#200606';
      c.beginPath(); c.moveTo(60, -66); c.lineTo(94, -68); c.lineTo(92, -66 + auf * 14); c.lineTo(62, -62 + auf * 6); c.closePath(); c.fill();
      c.fillStyle = '#7a2228'; c.beginPath(); c.ellipse(78, -64 + auf * 6, 10, 2 + auf * 2.5, 0.1, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#8ac83a'; c.lineWidth = 0.8;
      for (const x of [70, 80, 88]) { c.beginPath(); c.moveTo(x, -66); c.quadraticCurveTo(x + 1, -62 + auf * 6, x, -66 + auf * 13); c.stroke(); }
    }
    for (let x = 64; x <= 92; x += 3) { c.fillStyle = KNOCHEN; c.beginPath(); c.moveTo(x - 1.2, -67); c.lineTo(x, -61.5 - ((x * 7) % 3)); c.lineTo(x + 1.2, -67); c.fill(); }
    // Unterkiefer (Drehpunkt hinten am Kopf)
    c.save();
    c.translate(60, -64);
    c.rotate(auf * 0.62 + Math.max(0, Math.sin(u / 900)) * 0.04);
    c.translate(-60, 64);
    c.fillStyle = FELL_D;
    glatt(c, [[58, -66], [92, -66], [90, -60], [76, -57], [62, -59]]);
    c.fill();
    for (let x = 66; x <= 89; x += 3) { c.fillStyle = KNOCHEN; c.beginPath(); c.moveTo(x - 1.1, -65.5); c.lineTo(x, -70 + ((x * 3) % 2)); c.lineTo(x + 1.1, -65.5); c.fill(); }
    c.fillStyle = '#8ac83a';
    for (const [dx, len] of [[70, 6], [79, 10], [86, 5]] as [number, number][]) c.fillRect(dx, -58, 1, len + Math.sin(u / 200 + dx) * 2);
    c.restore();
    c.restore();
  }

  private bein(c: CanvasRenderingContext2D, b: Bein) {
    const h = this.amRumpf(b.hx, b.hy), f = this.fussPos(b);
    const fern = b.fern;
    const dunkel = fern ? '#262c1c' : FELL_D, mittel = fern ? '#3a4430' : FELL, hell = fern ? '#4a5636' : FELL_H;
    let glieder: [KurvenPunkt[], (t: number) => number][];
    if (b.vorne) {
      // Schulter → Ellbogen (zeigt nach hinten) → Pfote
      const e = knie(h, f, 20, 22, 1);
      glieder = [[strecke(h, e), (t) => lerp(8.5, 6, t)], [strecke(e, f), (t) => lerp(6, 4.2, t)]];
    } else {
      // Hüfte → Knie (nach vorn) → Sprunggelenk → Pfote
      const a = { x: f.x - 5, y: f.y - 13 };
      const k = knie(h, a, 19, 20, -1);
      glieder = [[strecke(h, k), (t) => lerp(11, 7, t)], [strecke(k, a), (t) => lerp(6.5, 4.4, t)], [strecke(a, f, 4), (t) => lerp(4.4, 3.8, t)]];
    }
    for (const [pts, br] of glieder) {
      c.fillStyle = mittel; band(c, pts, br); c.fill();
      c.fillStyle = dunkel; band(c, pts, br, 0.25, 1); c.fill();
      c.fillStyle = hell; band(c, pts, br, -0.85, -0.45); c.fill();
      c.fillStyle = mittel; c.beginPath(); c.arc(pts[0].x, pts[0].y, br(0), 0, Math.PI * 2); c.fill();
    }
    // Pfote mit Knochenkrallen (beim Hieb gespreizt und lang)
    const pf = b.vorne ? (fern ? this.pfoteFern : this.pfote) : 0;
    c.fillStyle = mittel; c.beginPath(); c.ellipse(f.x + 2, f.y - 1.5, 5.5, 3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = dunkel; c.fillRect(f.x - 2, f.y - 1, 8, 1.2);
    const lang = 3 + pf * 7;
    const w0 = pf > 0 ? -0.9 - this.hoch * 0.6 : 0.15;
    c.strokeStyle = KNOCHEN; c.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) {
      const w = w0 + i * (0.32 + pf * 0.25), sx = f.x + 6, sy = f.y - 1;
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(w) * lang, sy + Math.sin(w) * lang); c.stroke();
    }
  }

  private schwaenze(c: CanvasRenderingContext2D, u: number) {
    [[-44, -54], [-45, -48], [-42, -43]].forEach(([bx, by], k) => {
      const b = this.amRumpf(bx, by);
      const amp = 1 + this.wut * 0.8 + this.lauf() * 0.5;
      const c1 = { x: b.x - 18 + Math.sin(u / 500 + k) * 5 * amp, y: b.y - 8 - k * 4 + Math.cos(u / 430 + k * 2) * 4 * amp };
      const c2 = { x: b.x - 34 + Math.sin(u / 380 + k * 1.7) * 8 * amp, y: b.y - 30 + k * 8 + Math.cos(u / 460 + k) * 7 * amp };
      const e = { x: b.x - 22 + Math.sin(u / 330 + k) * 9 * amp, y: b.y - 46 + k * 14 + Math.cos(u / 300 + k) * 6 * amp };
      const pts = kurve(b, c1, c2, e, 22);
      for (const q of pts) { const w = Math.sin(q.t * 7 - u / 140 + k) * 1.4 * q.t; q.x += q.nx * w; q.y += q.ny * w; }
      const br = (t: number) => lerp(6.5, 1.4, t);
      c.fillStyle = FELL; band(c, pts, br); c.fill();
      c.fillStyle = FELL_D; band(c, pts, br, 0.2, 1); c.fill();
      c.fillStyle = HAUT; band(c, pts.slice(17), br); c.fill();
      c.fillStyle = '#e0a090'; pts.forEach((q, i) => { if (i % 4 === 2 && q.t < 0.75) { c.beginPath(); c.arc(q.x + q.nx * br(q.t) * 0.55, q.y + q.ny * br(q.t) * 0.55, 1, 0, Math.PI * 2); c.fill(); } });
    });
  }

  /** Lichtspuren der Krallen beim Hieb */
  private spurMalen() {
    const g = this.fxG;
    if (!g) return;
    g.clear();
    for (const [spur, pf, b] of [[this.spur, this.pfote, this.beine[3]], [this.spurFern, this.pfoteFern, this.beine[1]]] as [Pt[], number, Bein][]) {
      if (pf > 0.25) { const f = this.fussPos(b); spur.push(this.welt({ x: f.x + 10, y: f.y - 4 })); if (spur.length > 7) spur.shift(); } else if (spur.length) spur.shift();
      for (let i = 1; i < spur.length; i++) {
        const k = i / spur.length;
        g.lineStyle(6 * k * this.s, this.glut > 0.3 ? 0x9aff6a : 0xe8fff0, 0.55 * k);
        g.lineBetween(spur[i - 1].x, spur[i - 1].y, spur[i].x, spur[i].y);
      }
    }
  }

  // ---------------------------------------------------------------- Aktionen

  /** Krallenhieb: 0 vordere Pfote, 1 hintere Pfote, 2 Aufwärtshaken mit beiden; aktiv() im Moment des Treffers */
  async kralle(art: 0 | 1 | 2, aktiv: () => void) {
    audio.sfx('whoosh');
    if (art === 2) {
      this.hoch = 1;
      await this.tw({ targets: this, duck: 0.6, leibW: 0.12, duration: 90, ease: 'Quad.easeOut' });
      await this.tw({ targets: this, pfote: 1, pfoteFern: 1, duck: 0, leibW: -0.3, kieferAuf: 0.6, duration: 110, ease: 'Back.easeOut' });
      aktiv();
      await this.warte(110);
      await this.tw({ targets: this, pfote: 0, pfoteFern: 0, leibW: 0, kieferAuf: 0, duration: 220, ease: 'Sine.easeInOut' });
      this.hoch = 0;
      return;
    }
    this.hoch = 0;
    const key = art === 1 ? 'pfoteFern' : 'pfote';
    await this.tw({ targets: this, leibW: 0.05, duration: 50, ease: 'Quad.easeOut' });
    await this.tw({ targets: this, [key]: 1, leibW: -0.08, kopfVor: 0.3, duration: 75, ease: 'Quad.easeOut' });
    aktiv();
    await this.warte(60);
    await this.tw({ targets: this, [key]: 0, leibW: 0, kopfVor: 0, duration: 160, ease: 'Sine.easeInOut' });
  }

  /** Biss: Kopf schießt vor, Maul weit auf, schnappt zu (aktiv() beim Zuschnappen) */
  async biss(aktiv: () => void) {
    audio.sfx('growl');
    await this.tw({ targets: this, kieferAuf: 1, kopfVor: 0.4, leibW: 0.06, duration: 140, ease: 'Quad.easeOut' });
    await this.tw({ targets: this, kopfVor: 1.3, leibW: 0.14, duration: 80, ease: 'Quad.easeIn' });
    await this.tw({ targets: this, kieferAuf: 0, duration: 50 });
    audio.sfx('chomp');
    aktiv();
    await this.warte(140);
    await this.tw({ targets: this, kopfVor: 0, leibW: 0, duration: 220, ease: 'Sine.easeInOut' });
  }

  /** getroffen: weißer Blitz, Kopf fliegt zurück, der Reiter hüpft */
  treffer() {
    this.blitz = 90;
    this.reiterHops = 1;
    this.scene.tweens.add({ targets: this, kopfW: -0.3, leibW: -0.12, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
  }

  /** Fauchen: Maul auf, Augen gleißen, Schwänze peitschen, Speichel fliegt */
  async fauchen() {
    audio.sfx('growl');
    this.scene.tweens.add({ targets: this, wut: 1, duration: 200, yoyo: true, hold: 600 });
    await this.tw({ targets: this, kieferAuf: 1, kopfW: -0.15, leibW: 0.05, duck: 0.3, duration: 200, ease: 'Back.easeOut' });
    const m = this.maulWelt();
    for (let i = 0; i < 8; i++) {
      const t = this.scene.add.rectangle(m.x, m.y, 2, 2, 0x8ac83a).setDepth(this.depth + 1);
      this.scene.tweens.add({ targets: t, x: m.x + this.blick * Phaser.Math.Between(10, 34), y: m.y + Phaser.Math.Between(4, 28), alpha: 0, duration: 500, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
    }
    await this.warte(600);
    await this.tw({ targets: this, kieferAuf: 0, kopfW: 0, leibW: 0, duck: 0, duration: 260 });
  }

  /** grüne Glut (Super): Fell leuchtet, Bauchlicht wächst */
  superGlut(an: boolean) {
    this.scene.tweens.add({ targets: this, glut: an ? 1 : 0, wut: an ? 1 : 0, duration: an ? 200 : 500 });
  }

  /** grünes Nachbild (Dash, Super) */
  nachbild(farbe = 0x6aff4a) {
    const sc = this.scene, m = this.bild.getWorldTransformMatrix();
    const b = sc.add.image(m.tx, m.ty, this.leinwand.key).setOrigin(this.bild.originX, this.bild.originY).setScale(this.scaleX, this.scaleY)
      .setTintFill(farbe).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.4).setDepth(this.depth - 0.1);
    sc.tweens.add({ targets: b, alpha: 0, duration: 240, onComplete: () => b.destroy() });
  }

  /** K.o.: sackt zusammen, Augen erlöschen, der Wirt kippt herunter */
  async ko() {
    this.tot = true;
    this.gang = 0;
    this.luft = false;
    audio.sfx('thud');
    this.scene.tweens.add({ targets: this, kieferAuf: 0.7, duration: 300 });
    if (this.reiter) this.scene.tweens.add({ targets: this.reiter, x: this.reiter.x - 26, y: this.reiter.y + 30, duration: 520, ease: 'Quad.easeIn' });
    await this.warte(500);
  }

  /** wieder auf (nach Niederlage) */
  aufstehen() {
    this.tot = false;
    this.kieferAuf = 0;
  }

  /** Würgen: Kopf ruckt, Maul geht auf (Rückgabe: Weltpunkt des Mauls) */
  async wuergen() {
    audio.sfx('retch');
    for (let i = 0; i < 3; i++) {
      await this.tw({ targets: this, kopfW: 0.18, leibW: 0.08, kieferAuf: 0.4, duration: 140 });
      await this.tw({ targets: this, kopfW: -0.05, leibW: -0.02, kieferAuf: 0.1, duration: 160 });
    }
    await this.tw({ targets: this, kopfW: 0.25, kopfVor: 0.8, kieferAuf: 1, duration: 160, ease: 'Back.easeOut' });
    return this.maulWelt();
  }

  async maulZu() {
    await this.tw({ targets: this, kopfW: 0, kopfVor: 0, kieferAuf: 0, leibW: 0, duration: 300 });
  }
}
