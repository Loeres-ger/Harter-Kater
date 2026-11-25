import Phaser from 'phaser';

// Lebende Pixelbilder für die großen Monster (Oktopushirsch, Mutantenkatze). Jedes Bild der Animation wird mit echten
// Kurven (Canvas 2D) in voller Bildschirmauflösung gezeichnet und danach zu Pixelkunst gemacht:
//  1. harte Kanten (keine halbdurchsichtigen Ränder),
//  2. jede Farbe auf eine feste Palette, mit 4x4-Raster (Dithering) für weiche Übergänge,
//  3. eine geschlossene dunkle Umrisslinie um die ganze Figur.
// So hängen Gliedmaßen wirklich am Körper (eine Silhouette, ein Umriss) und die Bewegung bleibt flüssig.

export type Pt = { x: number; y: number };
export type KurvenPunkt = Pt & { nx: number; ny: number; t: number };

const hexRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const klemm = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

/** feste Farbpalette mit Nachschlagetabelle (5 Bit je Kanal → nächste Palettenfarbe) */
export class Palette {
  readonly farben: [number, number, number][];
  readonly lut = new Uint8Array(32768);
  constructor(hex: string[]) {
    this.farben = hex.map(hexRgb);
    for (let i = 0; i < 32768; i++) {
      const r = ((i >> 10) & 31) * 8 + 4, g = ((i >> 5) & 31) * 8 + 4, b = (i & 31) * 8 + 4;
      let best = 0, bd = Infinity;
      for (let k = 0; k < this.farben.length; k++) {
        const f = this.farben[k], dr = r - f[0], dg = g - f[1], db = b - f[2];
        const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
        if (d < bd) { bd = d; best = k; }
      }
      this.lut[i] = best;
    }
  }
}

let zaehler = 0;

/** Zeichenfläche, die als Phaser-Textur angezeigt wird */
export class PixelLeinwand {
  readonly key: string;
  readonly tex: Phaser.Textures.CanvasTexture;
  readonly ctx: CanvasRenderingContext2D;
  private deckend: Uint8Array;
  private umriss: [number, number, number];

  /** pal: feste Palette oder Anzahl Stufen je Farbkanal (freie Farben, gerastert) */
  constructor(private scene: Phaser.Scene, readonly w: number, readonly h: number, private pal: Palette | number, umriss = '#120a10') {
    this.key = `pixelLeinwand${zaehler++}`;
    // eigene Leinwand im Arbeitsspeicher: das Auslesen jedes Bild (getImageData) bleibt so schnell
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    this.tex = scene.textures.addCanvas(this.key, canvas)!;
    this.deckend = new Uint8Array(w * h);
    this.umriss = hexRgb(umriss);
  }

  leeren() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
  }

  /** zu Pixelkunst machen; ohneUmriss(x, y): an dieser Stelle keinen Umriss (z. B. wo ein Arm im Körper ansetzt) */
  fertig(ohneUmriss?: (x: number, y: number) => boolean) {
    const { w, h } = this, c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    const img = c.getImageData(0, 0, w, h), d = img.data, dk = this.deckend;
    const pal = typeof this.pal === 'number' ? null : this.pal, stufen = typeof this.pal === 'number' ? this.pal : 0;
    const schritt = stufen ? 255 / (stufen - 1) : 0;
    dk.fill(0);
    for (let y = 0; y < h; y++) {
      const by = (y & 3) << 2;
      for (let x = 0; x < w; x++) {
        const j = y * w + x, i = j << 2;
        if (d[i + 3] < 120) { d[i + 3] = 0; continue; }
        if (pal) {
          const t = (BAYER[by | (x & 3)] - 7.5) * 1.7;
          const col = pal.farben[pal.lut[((klemm(d[i] + t) >> 3) << 10) | ((klemm(d[i + 1] + t) >> 3) << 5) | (klemm(d[i + 2] + t) >> 3)]];
          d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];
        } else {
          // unregelmäßige Körnung statt Rastermuster: wirkt wie Haut, nicht wie ein Gitter
          const k = Math.imul(x * 73856093 ^ y * 19349663, 0x9e3779b1) >>> 22;
          const t = (k / 1023 - 0.5) * schritt * 0.85;
          d[i] = Math.round(klemm(d[i] + t) / schritt) * schritt;
          d[i + 1] = Math.round(klemm(d[i + 1] + t) / schritt) * schritt;
          d[i + 2] = Math.round(klemm(d[i + 2] + t) / schritt) * schritt;
        }
        d[i + 3] = 255;
        dk[j] = 1;
      }
    }
    const [ur, ug, ub] = this.umriss;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const j = y * w + x;
        if (dk[j]) continue;
        if ((x > 0 && dk[j - 1]) || (x < w - 1 && dk[j + 1]) || (y > 0 && dk[j - w]) || (y < h - 1 && dk[j + w])) {
          if (ohneUmriss?.(x, y)) continue;
          const i = j << 2;
          d[i] = ur; d[i + 1] = ug; d[i + 2] = ub; d[i + 3] = 255;
        }
      }
    }
    c.putImageData(img, 0, 0);
    this.tex.refresh();
  }

  zerstoeren() {
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}

/** Punkte entlang einer kubischen Bézierkurve, mit Einheitsnormale (links der Laufrichtung) */
export function kurve(a: Pt, b: Pt, c: Pt, d: Pt, n: number): KurvenPunkt[] {
  const out: KurvenPunkt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x;
    const y = u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y;
    const dx = 3 * u * u * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t * t * (d.x - c.x);
    const dy = 3 * u * u * (b.y - a.y) + 6 * u * t * (c.y - b.y) + 3 * t * t * (d.y - c.y);
    const l = Math.hypot(dx, dy) || 1;
    out.push({ x, y, nx: -dy / l, ny: dx / l, t });
  }
  return out;
}

/** Fläche entlang einer Mittellinie: Rand bei breite(t) * von … breite(t) * bis (in Normalenrichtung) */
export function band(ctx: CanvasRenderingContext2D, pts: KurvenPunkt[], breite: (t: number) => number, von = -1, bis = 1) {
  ctx.beginPath();
  pts.forEach((q, i) => {
    const w = breite(q.t);
    const x = q.x + q.nx * w * von, y = q.y + q.ny * w * von;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  });
  for (let i = pts.length - 1; i >= 0; i--) {
    const q = pts[i], w = breite(q.t);
    ctx.lineTo(q.x + q.nx * w * bis, q.y + q.ny * w * bis);
  }
  ctx.closePath();
}

/** Linie entlang einer Kante (zur Abgrenzung von Gliedmaßen vor dem Körper) */
export function kante(ctx: CanvasRenderingContext2D, pts: KurvenPunkt[], breite: (t: number) => number, seite: number, ab = 0) {
  ctx.beginPath();
  let start = true;
  for (const q of pts) {
    if (q.t < ab) continue;
    const w = breite(q.t), x = q.x + q.nx * w * seite, y = q.y + q.ny * w * seite;
    if (start) { ctx.moveTo(x, y); start = false; } else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** glatter geschlossener Pfad durch Punkte (Mittelpunkt-Quadratik) */
export function glatt(ctx: CanvasRenderingContext2D, pts: [number, number][], zu = true) {
  const n = pts.length;
  const m = (i: number): [number, number] => {
    const a = pts[(i + n) % n], b = pts[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  ctx.beginPath();
  if (zu) {
    const s = m(-1);
    ctx.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) { const e = m(i); ctx.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); }
    ctx.closePath();
  } else {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) { const e = m(i); ctx.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]); }
    ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
}

/** kleiner fester Zufall (gleiche Flecken in jedem Bild) */
export function zufall(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Punkt mit 2D-Transformation (Drehung um einen Drehpunkt, dann Verschiebung) */
export function dreh(p: Pt, w: number, um: Pt = { x: 0, y: 0 }): Pt {
  const c = Math.cos(w), s = Math.sin(w), dx = p.x - um.x, dy = p.y - um.y;
  return { x: um.x + dx * c - dy * s, y: um.y + dx * s + dy * c };
}
