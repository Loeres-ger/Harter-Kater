import Phaser from 'phaser';
import { audio } from '../audio';
import { Ctx, blob, outline, p, r, rng, tex2x } from '../gfx';

// Die Katze in ihrer Monstergestalt (die Mutation von damals, als sie Glanz gefressen hat), von der Seite, nach rechts
// schauend, mit dem Wirt auf dem Rücken. Für den Endkampf im Klärwerk (Phase 7) als bewegliche Figur:
//  - Leib, Kopf und Unterkiefer sind Bilder (gleiche Leinwand 100x76, Boden bei y=70)
//  - Beine (zweigliedrig, weich gebogen) und drei Tentakelschwänze zeichnet die Figur jedes Bild selbst
//  - Augen und Bauch leuchten (additiv), Krallen ziehen Lichtspuren
// Die Szene setzt gang (-1..1, Laufen relativ zur Blickrichtung), luft (springt) und duck (Block, 0..1) und ruft die
// Aktionen auf: kralle, biss, treffer, fauchen, superGlut, ko, nachbild.

export const MK_W = 100, MK_H = 76, MK_BODEN = 70;
const FELL = '#4e5a3c', FELL2 = '#38412a', FELL3 = '#66734c', HAUT = '#c08474', KNOCHEN = '#ddd4b2', ROT = '#4a1212';
const AUGEN: [number, number, number, string][] = [
  [76, 28, 3.2, '#f0e840'], [84, 26, 2.4, '#ff3a10'], [89, 31, 1.8, '#f0e840'], [69, 31, 1.6, '#ff3a10'], [79, 21, 1.5, '#dfe6d8'], [64, 27, 1.2, '#f0e840'],
];
const HALS: [number, number] = [64, 40];
const KIEFER: [number, number] = [70, 42];
const LEIB: [number, number] = [44, 58];

function drawLeib(c: Ctx) {
  const rnd = rng(667);
  blob(c, 44, 46, 25, 14, FELL);
  blob(c, 46, 52, 18, 6, FELL3);
  for (let i = 0; i < 16; i++) blob(c, 24 + rnd() * 42, 36 + rnd() * 20, 1 + rnd() * 2, 1 + rnd() * 1.5, FELL2);
  for (const [bx, by, br] of [[30, 41, 5], [50, 54, 4], [60, 43, 3]]) {
    blob(c, bx, by, br, br * 0.7, HAUT);
    for (let i = 0; i < 3; i++) {
      const px = bx - br / 2 + rnd() * br, py = by - 1 + rnd() * 2;
      blob(c, px, py, 1.2, 1.2, '#d8e050');
      p(c, Math.round(px), Math.round(py), '#f4f8a0');
    }
  }
  // offene Flanke mit Rippen
  blob(c, 42, 47, 7, 5, ROT);
  for (let i = 0; i < 4; i++) r(c, 37 + i * 3, 43, 1, 9, KNOCHEN);
  // Knochenstacheln auf dem Rücken (wo der Wirt sitzt, keine)
  for (let i = 0; i < 8; i++) {
    const sx = 20 + i * 6;
    if (sx > 36 && sx < 52) continue;
    const h = 4 + (i % 2) * 3;
    for (let k = 0; k < h; k++) p(c, sx + Math.floor(k / 3), 34 - k + Math.round(Math.abs(sx - 44) / 12), KNOCHEN);
  }
  outline(c, 0, 0, MK_W, MK_H);
}

/** Fellbüschel, das über die Beine des Reiters fällt */
function drawFell(c: Ctx) {
  blob(c, 44, 37, 9, 3.6, FELL);
  blob(c, 45, 36, 6, 2, FELL3);
  for (const x of [37, 41, 46, 50]) p(c, x, 39, FELL2);
  outline(c, 0, 0, MK_W, MK_H);
}

function drawKopf(c: Ctx) {
  blob(c, 76, 32, 14, 11, FELL);
  blob(c, 83, 29, 8, 6, FELL3);
  blob(c, 70, 25, 4, 3, HAUT);
  // zerfetzte Ohren
  for (let k = 0; k < 7; k++) { p(c, 66 + Math.floor(k / 2), 23 - k, FELL); p(c, 67 + Math.floor(k / 2), 23 - k, FELL2); }
  for (let k = 0; k < 5; k++) p(c, 87 - Math.floor(k / 2), 22 - k, FELL);
  p(c, 86, 18, HAUT);
  // Rachen (vom Unterkiefer verdeckt, wenn er zu ist) und obere Zahnreihe
  blob(c, 81, 44, 10, 3.4, '#200606');
  blob(c, 81, 44.5, 8, 2.2, '#5a1010');
  for (let x = 71; x <= 91; x += 2) r(c, x, 41, 1, 2 + ((x * 7) % 3), KNOCHEN);
  for (const [ex, ey, er, col] of AUGEN) {
    blob(c, ex, ey, er + 0.8, er + 0.8, '#200606');
    blob(c, ex, ey, er, er, col);
    if (col !== '#dfe6d8') r(c, Math.round(ex), Math.round(ey - er + 1), 1, Math.max(1, Math.round(er * 2 - 1)), '#0a0a0a');
    p(c, Math.round(ex - er / 2), Math.round(ey - er / 2), '#ffffff');
  }
  outline(c, 0, 0, MK_W, MK_H);
}

function drawKiefer(c: Ctx) {
  blob(c, 80, 46, 11, 3.6, FELL2);
  blob(c, 82, 47, 8, 2, FELL);
  for (let x = 72; x <= 90; x += 2) r(c, x, 42 + ((x * 5) % 2), 1, 2 + ((x * 3) % 2), KNOCHEN);
  for (const [dx, len] of [[74, 5], [80, 8], [86, 4]]) { r(c, dx, 48, 1, len, '#8ac83a'); p(c, dx, 48 + len, '#b8f060'); }
  outline(c, 0, 0, MK_W, MK_H);
}

export function makeMutantKatzeTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('mk_leib')) return;
  tex2x(scene, 'mk_leib', MK_W, MK_H, drawLeib);
  tex2x(scene, 'mk_fell', MK_W, MK_H, drawFell);
  tex2x(scene, 'mk_kopf', MK_W, MK_H, drawKopf);
  tex2x(scene, 'mk_kiefer', MK_W, MK_H, drawKiefer);
}

type Pt = { x: number; y: number };
const L = (x: number, y: number): Pt => ({ x: x - MK_W / 2, y: y - MK_BODEN });

/** zweigliedriges Bein: Knie aus Hüfte, Fuß, Längen und Beugerichtung */
function knie(h: Pt, f: Pt, l1: number, l2: number, beuge: number): Pt {
  const dx = f.x - h.x, dy = f.y - h.y;
  const d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01);
  const a = Math.atan2(dy, dx);
  const cosA = Phaser.Math.Clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d || 1), -1, 1);
  const w = a + beuge * Math.acos(cosA);
  return { x: h.x + Math.cos(w) * l1, y: h.y + Math.sin(w) * l1 };
}

interface Bein { hx: number; hy: number; vorne: boolean; fern: boolean; off: number }

export class MutantKatze extends Phaser.GameObjects.Container {
  private hintenG: Phaser.GameObjects.Graphics;
  private vorneG: Phaser.GameObjects.Graphics;
  private koerper: Phaser.GameObjects.Container;
  private leib: Phaser.GameObjects.Image;
  private fell: Phaser.GameObjects.Image;
  private kopf: Phaser.GameObjects.Container;
  private kopfBild: Phaser.GameObjects.Image;
  private kiefer: Phaser.GameObjects.Image;
  private augen: Phaser.GameObjects.Image[] = [];
  readonly reiter?: Phaser.GameObjects.Sprite;
  private fxG?: Phaser.GameObjects.Graphics;
  private schein!: Phaser.GameObjects.Image;
  private beine: Bein[] = [
    { hx: 36, hy: 53, vorne: false, fern: true, off: Math.PI },
    { hx: 62, hy: 53, vorne: true, fern: true, off: 0 },
    { hx: 31, hy: 55, vorne: false, fern: false, off: 0 },
    { hx: 57, hy: 55, vorne: true, fern: false, off: Math.PI },
  ];
  private spur: Pt[] = [];
  private spurFern: Pt[] = [];
  private uhr = 0;
  private schritt = 0;
  /** Laufen relativ zur Blickrichtung (-1..1) */
  gang = 0;
  luft = false;
  duck = 0;
  pfote = 0;
  pfoteFern = 0;
  /** wie hoch die Pfoten beim Hieb gehen (0 vorwärts, 1 Aufwärtshaken) */
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

  constructor(scene: Phaser.Scene, x: number, y: number, scale = 1, mitReiter = true) {
    super(scene, x, y);
    makeMutantKatzeTextures(scene);
    this.setScale(scale);
    const bild = (key: string, [ox, oy]: [number, number]) => new Phaser.GameObjects.Image(scene, 0, 0, key).setOrigin(ox / MK_W, oy / MK_H).setScale(0.5);
    this.hintenG = new Phaser.GameObjects.Graphics(scene);
    this.vorneG = new Phaser.GameObjects.Graphics(scene);
    const lp = L(...LEIB);
    this.koerper = new Phaser.GameObjects.Container(scene, lp.x, lp.y);
    this.leib = bild('mk_leib', LEIB);
    this.fell = bild('mk_fell', LEIB);
    this.kopf = new Phaser.GameObjects.Container(scene, HALS[0] - LEIB[0], HALS[1] - LEIB[1]);
    this.kopfBild = bild('mk_kopf', HALS);
    this.kiefer = bild('mk_kiefer', KIEFER).setPosition(KIEFER[0] - HALS[0], KIEFER[1] - HALS[1]);
    this.kopf.add([this.kopfBild, this.kiefer]);
    for (const [ex, ey, er, col] of AUGEN) {
      if (col === '#dfe6d8') continue;
      const g = new Phaser.GameObjects.Image(scene, ex - HALS[0], ey - HALS[1], 'light').setBlendMode(Phaser.BlendModes.ADD)
        .setTint(col === '#ff3a10' ? 0xff4a1a : 0xf0e840).setScale(0.04 + er * 0.012).setAlpha(0.8);
      this.augen.push(g);
      this.kopf.add(g);
    }
    this.koerper.add(this.leib);
    if (mitReiter) {
      this.reiter = new Phaser.GameObjects.Sprite(scene, 0, 38 - LEIB[1], 'wirtKanal', 6).setOrigin(0.5, 1).setScale(0.5);
      this.koerper.add(this.reiter);
    }
    this.koerper.add([this.fell, this.kopf]);
    this.add([this.hintenG, this.koerper, this.vorneG]);

    this.schein = scene.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6aff4a).setScale(1.1 * scale).setAlpha(0.25);
    this.fxG = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    scene.add.existing(this);
    this.setDepth(this.depth);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
      this.schein.destroy();
      this.fxG?.destroy();
    });
  }

  setDepth(d: number) {
    super.setDepth(d);
    if (this.fxG) { this.schein.setDepth(d - 0.2); this.fxG.setDepth(d + 0.3); }
    return this;
  }

  /** Blickrichtung: 1 rechts, -1 links */
  get blick() { return Math.sign(this.scaleX) || 1; }
  setBlick(d: number) { this.scaleX = Math.abs(this.scaleX) * (d < 0 ? -1 : 1); return this; }

  /** lokaler Punkt → Welt (berücksichtigt Spiegelung) */
  welt(q: Pt): Pt { return { x: this.x + q.x * this.scaleX, y: this.y + q.y * this.scaleY }; }
  /** Weltpunkt des Mauls (für Bisse, Spucken) */
  maulWelt(): Pt {
    const m = this.kiefer.getWorldTransformMatrix();
    return { x: m.tx + 12 * this.scaleX, y: m.ty + 3 * this.scaleY };
  }
  /** Weltpunkt der vorderen Pfote */
  pfoteWelt(): Pt { return this.welt(this.fussPos(this.beine[3])); }

  private tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((done) => this.scene.tweens.add({ ...cfg, onComplete: () => done() }));
  }
  private warte(ms: number) {
    return new Promise<void>((done) => this.scene.time.delayedCall(ms, done));
  }

  /** Punkt am Körper (Bildkoordinaten) → lokal, mit Neigung und Ducken des Körpers */
  private amKoerper(bx: number, by: number): Pt {
    const dx = bx - LEIB[0], dy = by - LEIB[1];
    const c = Math.cos(this.koerper.rotation), s = Math.sin(this.koerper.rotation);
    return { x: this.koerper.x + dx * c - dy * s, y: this.koerper.y + dx * s + dy * c };
  }

  private fussPos(b: Bein): Pt {
    const h = this.amKoerper(b.hx, b.hy);
    if (this.tot) return { x: h.x + (b.vorne ? 8 : -8), y: h.y + 6 };
    const grund = L(b.hx + (b.vorne ? 2 : -1), MK_BODEN);
    let f: Pt;
    if (this.luft) f = { x: h.x + (b.vorne ? 7 : -7), y: h.y + 9 };
    else {
      const g = Math.min(1, Math.abs(this.gang));
      const ph = this.schritt + b.off;
      f = { x: grund.x + Math.sin(ph) * 7 * g, y: grund.y - Math.max(0, Math.cos(ph)) * 5 * g };
    }
    const pf = b.vorne ? (b.fern ? this.pfoteFern : this.pfote) : 0;
    if (pf > 0) {
      const ziel = { x: h.x + 17 - this.hoch * 3, y: h.y - 8 - this.hoch * 10 };
      f = { x: f.x + (ziel.x - f.x) * pf, y: f.y + (ziel.y - f.y) * pf };
    }
    return f;
  }

  private tick(_t: number, delta: number) {
    if (!this.active) return;
    this.uhr += delta * (1 + this.wut * 0.6);
    const u = this.uhr;
    this.schritt += (delta / 1000) * 11 * this.gang;
    const atem = Math.sin(u / 520);
    const lauf = Math.min(1, Math.abs(this.gang)) * (this.luft ? 0 : 1);
    const bob = Math.abs(Math.sin(this.schritt)) * -1.6 * lauf + atem * 0.6;
    const lp = L(...LEIB);
    this.koerper.setPosition(lp.x, lp.y + bob + this.duck * 6);
    this.koerper.setRotation(this.leibW + this.duck * 0.08 + Math.sin(this.schritt * 2) * 0.02 * lauf);
    this.leib.setScale(0.5 + atem * 0.004, 0.5 - atem * 0.006);
    this.kopf.setPosition(HALS[0] - LEIB[0] + this.kopfVor * 7, HALS[1] - LEIB[1] + this.duck * 3 + this.kopfVor * 1.5);
    this.kopf.setRotation(this.kopfW + Math.sin(u / 700) * 0.03 + this.duck * 0.18 - this.kopfVor * 0.08);
    this.kiefer.setRotation(this.kieferAuf * 0.75 + Math.max(0, Math.sin(u / 900)) * 0.05);
    if (this.reiter) {
      this.reiterHops = Math.max(0, this.reiterHops - delta / 300);
      this.reiter.y = 38 - LEIB[1] - Math.abs(Math.sin(this.schritt)) * 1.2 * lauf - Math.sin(this.reiterHops * Math.PI) * 5;
      this.reiter.setRotation(-this.koerper.rotation * 0.5 + Math.sin(this.schritt) * 0.04 * lauf);
    }
    this.augen.forEach((a, i) => a.setAlpha(this.tot ? 0.1 : 0.65 + Math.sin(u / 110 + i * 1.7) * 0.12 + this.wut * 0.3 + (Math.random() < 0.03 ? 0.2 : 0)));
    if (this.blitz > 0) this.blitz -= delta;
    const teile = [this.leib, this.kopfBild, this.kiefer, this.fell];
    if (this.blitz > 0) teile.forEach((t) => t.setTintFill(0xffffff));
    else if (this.glut > 0.05) { const g = Math.round(255 - this.glut * 60); teile.forEach((t) => t.setTint(Phaser.Display.Color.GetColor(g, 255, g))); }
    else teile.forEach((t) => t.clearTint());
    const bauch = this.welt(this.amKoerper(46, 50));
    this.schein.setPosition(bauch.x, bauch.y).setAlpha(this.tot ? 0.05 : 0.2 + this.glut * 0.5 + Math.sin(u / 300) * 0.04).setScale((1.1 + this.glut * 0.8) * Math.abs(this.scaleX));
    this.zeichnen(u);
  }

  private zeichnen(u: number) {
    const gh = this.hintenG, gv = this.vorneG;
    gh.clear();
    gv.clear();
    this.fxG?.clear();
    this.schwaenze(gh, u);
    for (const b of this.beine) this.bein(b.fern ? gh : gv, b);
    // Lichtspuren der Krallen
    for (const [spur, pf, b] of [[this.spur, this.pfote, this.beine[3]], [this.spurFern, this.pfoteFern, this.beine[1]]] as [Pt[], number, Bein][]) {
      if (pf > 0.25) { spur.push(this.welt(this.fussPos(b))); if (spur.length > 7) spur.shift(); } else if (spur.length) spur.shift();
      if (this.fxG && spur.length > 1) {
        for (let i = 1; i < spur.length; i++) {
          const k = i / spur.length;
          this.fxG.lineStyle(5 * k * Math.abs(this.scaleX), this.glut > 0.3 ? 0x9aff6a : 0xe8fff0, 0.55 * k);
          this.fxG.lineBetween(spur[i - 1].x, spur[i - 1].y, spur[i].x, spur[i].y);
        }
      }
    }
  }

  private bein(g: Phaser.GameObjects.Graphics, b: Bein) {
    const h = this.amKoerper(b.hx, b.hy), f = this.fussPos(b);
    const k = knie(h, f, 9, 10.5, b.vorne ? 1 : -1);
    const weiss = this.blitz > 0;
    const dunkel = weiss ? 0xffffff : b.fern ? 0x262c1c : 0x2e3522;
    const mitte = weiss ? 0xffffff : b.fern ? 0x38412a : 0x4e5a3c;
    const hell = weiss ? 0xffffff : b.fern ? 0x4a5636 : 0x66734c;
    g.lineStyle(5.2, dunkel, 1).lineBetween(h.x, h.y, k.x, k.y).lineBetween(k.x, k.y, f.x, f.y);
    g.fillStyle(dunkel, 1).fillCircle(h.x, h.y, 3.2).fillCircle(k.x, k.y, 2.4).fillCircle(f.x, f.y, 2);
    g.lineStyle(3.6, mitte, 1).lineBetween(h.x, h.y, k.x, k.y);
    g.lineStyle(2.8, mitte, 1).lineBetween(k.x, k.y, f.x, f.y);
    g.fillStyle(mitte, 1).fillCircle(h.x, h.y, 2.4).fillCircle(k.x, k.y, 1.7).fillCircle(f.x, f.y, 1.6);
    g.lineStyle(1, hell, 0.9).lineBetween(h.x - 0.6, h.y - 0.6, k.x - 0.6, k.y - 0.6);
    // Knochenkrallen: beim Hieb gespreizt und lang
    const pf = b.vorne ? (b.fern ? this.pfoteFern : this.pfote) : 0;
    const lang = 1.6 + pf * 3.4;
    const w0 = pf > 0 ? -0.9 - this.hoch * 0.6 : 0.05;
    g.lineStyle(0.9, weiss ? 0xffffff : 0xddd4b2, 1);
    for (let i = -1; i <= 1; i++) {
      const w = w0 + i * (0.35 + pf * 0.25);
      g.lineBetween(f.x + 0.6, f.y + 0.4, f.x + 0.6 + Math.cos(w) * lang, f.y + 0.4 + Math.sin(w) * lang);
    }
  }

  private schwaenze(g: Phaser.GameObjects.Graphics, u: number) {
    const basen: [number, number][] = [[22, 42], [21, 47], [24, 51]];
    basen.forEach(([bx, by], k) => {
      const b = this.amKoerper(bx, by);
      const amp = 1 + this.wut * 0.8 + Math.min(1, Math.abs(this.gang)) * 0.5;
      const c = { x: b.x - 12 + Math.sin(u / 500 + k) * 4 * amp, y: b.y - 6 - k * 3 + Math.cos(u / 430 + k * 2) * 3 * amp };
      const e = { x: b.x - 20 + Math.sin(u / 380 + k * 1.7) * 6 * amp, y: b.y - 20 + k * 6 + Math.cos(u / 460 + k) * 5 * amp };
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        let x = (1 - t) * (1 - t) * b.x + 2 * (1 - t) * t * c.x + t * t * e.x;
        let y = (1 - t) * (1 - t) * b.y + 2 * (1 - t) * t * c.y + t * t * e.y;
        x += Math.sin(t * 7 - u / 140 + k) * 1.1 * t;
        y += Math.cos(t * 7 - u / 140 + k) * 0.8 * t;
        const rr = 3.4 - t * 2.4;
        const col = this.blitz > 0 ? 0xffffff : t > 0.8 ? 0xc08474 : i % 4 < 2 ? 0x4e5a3c : 0x38412a;
        g.fillStyle(this.blitz > 0 ? 0xffffff : 0x262c1c, 1).fillCircle(x, y, rr + 0.7);
        g.fillStyle(col, 1).fillCircle(x, y, rr);
      }
    });
  }

  // ---------------------------------------------------------------- Aktionen

  /** Krallenhieb: 0 vordere Pfote, 1 hintere Pfote, 2 Aufwärtshaken mit beiden; aktiv() im Moment des Treffers */
  async kralle(art: 0 | 1 | 2, aktiv: () => void) {
    audio.sfx('whoosh');
    if (art === 2) {
      this.hoch = 1;
      await this.tw({ targets: this, duck: 0.5, leibW: 0.1, duration: 90, ease: 'Quad.easeOut' });
      await this.tw({ targets: this, pfote: 1, pfoteFern: 1, duck: 0, leibW: -0.32, kieferAuf: 0.6, duration: 110, ease: 'Back.easeOut' });
      aktiv();
      await this.warte(110);
      await this.tw({ targets: this, pfote: 0, pfoteFern: 0, leibW: 0, kieferAuf: 0, duration: 220, ease: 'Sine.easeInOut' });
      this.hoch = 0;
      return;
    }
    this.hoch = 0;
    const key = art === 1 ? 'pfoteFern' : 'pfote';
    await this.tw({ targets: this, [key]: 1, leibW: -0.07, kopfVor: 0.3, duration: 75, ease: 'Quad.easeOut' });
    aktiv();
    await this.warte(60);
    await this.tw({ targets: this, [key]: 0, leibW: 0, kopfVor: 0, duration: 150, ease: 'Sine.easeInOut' });
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

  /** Fauchen: Maul auf, Augen gleißen, Schwänze peitschen */
  async fauchen() {
    audio.sfx('growl');
    this.scene.tweens.add({ targets: this, wut: 1, duration: 200, yoyo: true, hold: 600 });
    await this.tw({ targets: this, kieferAuf: 1, kopfW: -0.15, leibW: 0.05, duration: 200, ease: 'Back.easeOut' });
    const m = this.maulWelt();
    for (let i = 0; i < 6; i++) {
      const t = this.scene.add.circle(m.x, m.y, 1.2 * Math.abs(this.scaleX), 0x8ac83a).setDepth(this.depth + 1);
      this.scene.tweens.add({ targets: t, x: m.x + this.blick * Phaser.Math.Between(10, 30), y: m.y + Phaser.Math.Between(4, 26), alpha: 0, duration: 500, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
    }
    await this.warte(600);
    await this.tw({ targets: this, kieferAuf: 0, kopfW: 0, leibW: 0, duration: 260 });
  }

  /** grüne Glut (Super): Fell leuchtet, Bauchlicht wächst */
  superGlut(an: boolean) {
    this.scene.tweens.add({ targets: this, glut: an ? 1 : 0, wut: an ? 1 : 0, duration: an ? 200 : 500 });
  }

  /** grünes Nachbild der Figur (Dash, Super) */
  nachbild(farbe = 0x6aff4a) {
    const sc = this.scene;
    for (const o of [this.leib, this.kopfBild]) {
      const m = o.getWorldTransformMatrix();
      const b = sc.add.image(m.tx, m.ty, o.texture.key).setOrigin(o.originX, o.originY).setRotation(m.rotation)
        .setScale(m.scaleX, m.scaleY).setTintFill(farbe).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setDepth(this.depth - 0.1);
      sc.tweens.add({ targets: b, alpha: 0, duration: 260, onComplete: () => b.destroy() });
    }
  }

  /** K.o.: kippt zur Seite, Augen erlöschen, der Wirt fällt herunter */
  async ko() {
    this.tot = true;
    this.gang = 0;
    this.luft = false;
    audio.sfx('thud');
    this.scene.tweens.add({ targets: this, kieferAuf: 0.7, duration: 300 });
    if (this.reiter) this.scene.tweens.add({ targets: this.reiter, x: this.reiter.x - 22, y: this.reiter.y + 22, rotation: -1.4, duration: 520, ease: 'Quad.easeIn' });
    await this.tw({ targets: this.koerper, rotation: -0.5, y: this.koerper.y + 4, duration: 500, ease: 'Bounce.easeOut' });
  }

  /** wieder auf (nach Niederlage, vor einem neuen Versuch) */
  aufstehen() {
    this.tot = false;
    this.kieferAuf = 0;
    if (this.reiter) this.reiter.setPosition(0, 38 - LEIB[1]).setRotation(0);
  }

  /** Spucken: Würgen, Maul auf, etwas fliegt heraus (Rückgabe: Weltpunkt des Mauls) */
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
