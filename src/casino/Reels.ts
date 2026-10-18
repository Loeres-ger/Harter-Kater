import Phaser from 'phaser';
import { audio } from '../audio';
import { Grid } from './logic';

/** Walzen mit Dreh-Animation: Symbole fallen von oben durch ein Sichtfenster. */
export class Reels {
  private cols: Phaser.GameObjects.Container[] = [];
  private highlights: Phaser.GameObjects.GameObject[] = [];
  readonly width: number;
  readonly height: number;

  constructor(
    private scene: Phaser.Scene,
    private x: number,
    private y: number,
    private nCols: number,
    private nRows: number,
    private cell: number,
    private symbols: string[],
    private scale = 2,
  ) {
    this.width = nCols * cell;
    this.height = nRows * cell;
    const g = scene.add.graphics();
    g.fillStyle(0xf4ecd8).fillRect(x, y, this.width, this.height);
    for (let c = 1; c < nCols; c++) g.fillStyle(0xd8ccb0).fillRect(x + c * cell - 1, y, 2, this.height);
    // Schatten oben/unten für Walzen-Rundung
    g.fillStyle(0x000000, 0.18).fillRect(x, y, this.width, 6);
    g.fillStyle(0x000000, 0.18).fillRect(x, y + this.height - 6, this.width, 6);
    const mask = scene.make.graphics({}, false).fillRect(x, y, this.width, this.height).createGeometryMask();
    for (let c = 0; c < nCols; c++) {
      const col = scene.add.container(x + c * cell, y).setMask(mask);
      this.cols.push(col);
    }
  }

  private img(key: string, row: number) {
    return this.scene.add.image(this.cell / 2, row * this.cell + this.cell / 2, key).setScale(this.scale);
  }

  private randomSym() {
    return this.symbols[Math.floor(Math.random() * this.symbols.length)];
  }

  /** Ergebnis ohne Animation zeigen. */
  set(grid: Grid) {
    this.cols.forEach((col, c) => {
      col.removeAll(true);
      col.y = this.y;
      grid[c].forEach((s, r) => col.add(this.img(s, r)));
    });
  }

  /** Walzen drehen und nacheinander auf dem Ergebnis stoppen. */
  spin(grid: Grid, opts: { fast?: boolean } = {}) {
    this.clearHighlights();
    const promises = this.cols.map(
      (col, c) =>
        new Promise<void>((resolve) => {
          const current = col.list.slice(-this.nRows).map((o) => (o as Phaser.GameObjects.Image).texture.key);
          const extra = (opts.fast ? 6 : 12) + c * (opts.fast ? 3 : 5);
          // Streifen von oben nach unten: Ergebnis, Zufall, aktuelle Symbole
          const strip = [...grid[c], ...Array.from({ length: extra }, () => this.randomSym()), ...current];
          col.removeAll(true);
          strip.forEach((s, i) => col.add(this.img(s, i)));
          col.y = this.y - (strip.length - this.nRows) * this.cell;
          this.scene.tweens.add({
            targets: col,
            y: this.y,
            duration: (opts.fast ? 350 : 650) + c * (opts.fast ? 140 : 260),
            ease: 'Back.easeOut',
            easeParams: [0.8],
            onComplete: () => {
              audio.sfx('click');
              // überzählige Bilder wegräumen
              col.list.slice(this.nRows).forEach((o) => o.destroy());
              resolve();
            },
          });
        }),
    );
    return Promise.all(promises).then(() => undefined);
  }

  /** Gewinnfelder blinkend umrahmen. */
  highlight(cells: [number, number][], color = 0xff3030) {
    for (const [c, r] of cells) {
      const rect = this.scene.add
        .rectangle(this.x + c * this.cell + this.cell / 2, this.y + r * this.cell + this.cell / 2, this.cell - 4, this.cell - 4)
        .setStrokeStyle(2, color)
        .setDepth(20);
      this.scene.tweens.add({ targets: rect, alpha: 0.2, duration: 220, yoyo: true, repeat: -1 });
      this.highlights.push(rect);
    }
  }

  /** Gewinnlinie als Strich durch die Mitte der Felder. */
  line(cells: [number, number][], color: number) {
    const g = this.scene.add.graphics().setDepth(19);
    g.lineStyle(3, color, 0.85);
    g.beginPath();
    cells.forEach(([c, r], i) => {
      const px = this.x + c * this.cell + this.cell / 2, py = this.y + r * this.cell + this.cell / 2;
      if (i === 0) g.moveTo(px - this.cell / 2, py);
      g.lineTo(px, py);
    });
    const [lc, lr] = cells[cells.length - 1];
    g.lineTo(this.x + lc * this.cell + this.cell, this.y + lr * this.cell + this.cell / 2);
    g.strokePath();
    this.highlights.push(g);
  }

  /** Ganze Walze mit einem Symbol überdecken (Freispiel-Ausbreitung). */
  expand(col: number, key: string) {
    const bg = this.scene.add.rectangle(this.x + col * this.cell, this.y, this.cell, this.height, 0xf8e070).setOrigin(0).setDepth(18).setAlpha(0);
    // in jeder Reihe dasselbe Symbol, leicht pulsierend – bleibt innerhalb der Walze
    const imgs = Array.from({ length: this.nRows }, (_, r) =>
      this.scene.add.image(this.x + col * this.cell + this.cell / 2, this.y + r * this.cell + this.cell / 2, key).setScale(this.scale).setDepth(18).setAlpha(0),
    );
    this.scene.tweens.add({ targets: [bg, ...imgs], alpha: 1, duration: 250 });
    this.scene.tweens.add({ targets: imgs, scale: this.scale * 1.12, duration: 300, yoyo: true, repeat: -1, delay: 250 });
    const frame = this.scene.add.rectangle(this.x + col * this.cell + 1, this.y + 1, this.cell - 2, this.height - 2).setOrigin(0).setStrokeStyle(2, 0xc8a040).setDepth(19);
    this.highlights.push(bg, ...imgs, frame);
  }

  clearHighlights() {
    this.highlights.forEach((h) => h.destroy());
    this.highlights = [];
  }
}
