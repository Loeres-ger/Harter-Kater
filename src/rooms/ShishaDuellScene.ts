import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { isTouchDevice } from '../touch';
import { H, W, txt } from '../ui';
import { Btn } from '../scenes/ShopScene';

// Shisha-Duell gegen Cemo: Snake zu zweit auf dem Messingtisch. Jeder Schlauch frisst Tabak und wird länger.
// Wer zuerst sein Ziel hat, gewinnt (du 8, Cemo 10). Wer gegen den Rand, sich selbst oder den anderen Schlauch stößt, hustet:
// kurz raus, Züge weg (du einen, Cemo zwei), dann geht es von vorne los. Cemo steuert per Wegsuche, ist
// langsamer und macht öfter Fehler. Nach jeder Niederlage wird er noch etwas träger.

export interface DuellData {
  resume: string;
  onDone?: (win: boolean) => void;
}

type Pt = [number, number];
const COLS = 28, ROWS = 15, CELL = 12;
const GX = Math.round((W - COLS * CELL) / 2), GY = 54;
/** du brauchst weniger Züge als Cemo */
const ZIEL = 8, ZIEL_CEMO = 10;
const UP: Pt = [0, -1], DOWN: Pt = [0, 1], LEFT: Pt = [-1, 0], RIGHT: Pt = [1, 0];
const ALL = [UP, DOWN, LEFT, RIGHT];

interface Snake {
  body: Pt[];
  dir: Pt;
  queue: Pt[];
  score: number;
  alive: boolean;
  respawnAt: number;
  grow: number;
  start: Pt;
  startDir: Pt;
  col: [number, number];
}

const same = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];
const inside = (p: Pt) => p[0] >= 0 && p[1] >= 0 && p[0] < COLS && p[1] < ROWS;
const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];

export class ShishaDuellScene extends Phaser.Scene {
  private cfg!: DuellData;
  private g!: Phaser.GameObjects.Graphics;
  private you!: Snake;
  private cemo!: Snake;
  private food: Pt[] = [];
  private acc = 0;
  private tick = 0;
  private running = false;
  private over = false;
  private wasRunning = false;
  private hudYou!: Phaser.GameObjects.Text;
  private hudCemo!: Phaser.GameObjects.Text;
  private msg!: Phaser.GameObjects.Text;
  private endBox?: Phaser.GameObjects.Container;
  private primary: (() => void) | null = null;
  /** Niederlagen in dieser Runde: machen Cemo träger */
  private losses = 0;

  constructor() {
    super('ShishaDuell');
  }

  create(data: DuellData) {
    audio.zwischen(this, 'shishaDuell');
    this.cfg = data;
    this.wasRunning = state.running;
    state.running = false;
    this.over = false;
    this.endBox = undefined;
    this.primary = null;
    this.losses = 0;
    this.scene.bringToTop();
    // die Shisha-Bar dahinter ist verdeckt: nicht mitzeichnen (spart auf dem Handy viel)
    this.scene.setVisible(false, data.resume);

    this.add.rectangle(0, 0, W, H, 0x0c0806, 0.94).setOrigin(0);
    this.add.image(0, 0, 'csShisha').setOrigin(0).setAlpha(0.22);
    // Messingtisch mit dunkler Platte
    this.add.rectangle(GX - 6, GY - 6, COLS * CELL + 12, ROWS * CELL + 12, 0xa07a2a).setOrigin(0).setStrokeStyle(1, 0x5a3a12);
    this.add.rectangle(GX, GY, COLS * CELL, ROWS * CELL, 0x2a1a12).setOrigin(0);
    const dots = this.add.graphics();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if ((x + y) % 2 === 0) dots.fillStyle(0x34221a).fillRect(GX + x * CELL, GY + y * CELL, CELL, CELL);

    txt(this, W / 2, 12, 'SHISHA-DUELL', '#d8b050', 16).setOrigin(0.5, 0);
    txt(this, W / 2, 34, `Du brauchst ${ZIEL} Züge, Cemo ${ZIEL_CEMO}. Nirgends anstoßen!`, '#a89878').setOrigin(0.5, 0);
    this.add.image(GX - 34, GY + 60, 'bustWirt').setScale(0.42).setOrigin(0.5, 1);
    this.add.image(GX + COLS * CELL + 34, GY + 60, 'nbust_cemo').setScale(0.42).setOrigin(0.5, 1);
    txt(this, GX - 34, GY + 64, 'DU', '#f0a070').setOrigin(0.5, 0);
    txt(this, GX + COLS * CELL + 34, GY + 64, 'CEMO', '#7ad0c0').setOrigin(0.5, 0);
    this.hudYou = txt(this, GX, GY + ROWS * CELL + 10, '', '#f0a070');
    this.hudCemo = txt(this, GX + COLS * CELL, GY + ROWS * CELL + 10, '', '#7ad0c0').setOrigin(1, 0);
    txt(this, W / 2, H - 14, isTouchDevice(this) ? 'Wischen oder Pfeile tippen' : 'Pfeile/WASD: lenken   ESC: aufgeben', '#5a4a3a').setOrigin(0.5, 0);
    this.g = this.add.graphics().setDepth(2);
    this.msg = txt(this, W / 2, GY + (ROWS * CELL) / 2, '', '#ffffff', 16).setOrigin(0.5).setDepth(10).setStroke('#120c0b', 5);

    this.controls();
    this.reset();
    this.countdown();
    this.cameras.main.fadeIn(150);
  }

  // ---------------------------------------------------------------- Steuerung

  private steer(d: Pt) {
    const s = this.you;
    if (!this.running || !s.alive || s.queue.length >= 2) return;
    const last = s.queue[s.queue.length - 1] ?? s.dir;
    if (same(d, last) || (d[0] === -last[0] && d[1] === -last[1])) return;
    s.queue.push(d);
  }

  private controls() {
    const kb = this.input.keyboard!;
    for (const [keys, d] of [[['UP', 'W'], UP], [['DOWN', 'S'], DOWN], [['LEFT', 'A'], LEFT], [['RIGHT', 'D'], RIGHT]] as const)
      for (const k of keys) kb.on(`keydown-${k}`, () => this.steer(d as Pt));
    kb.on('keydown-ESC', () => (this.over ? this.close(false) : this.finish(false)));
    for (const k of ['ENTER', 'SPACE']) kb.on(`keydown-${k}`, () => this.primary?.());
    // Wischen: lenkt schon während der Bewegung (nicht erst beim Loslassen), mehrere Kurven in einem Zug
    let start: { x: number; y: number } | null = null;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { start = { x: p.x, y: p.y }; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!start || !p.isDown) return;
      const dx = p.x - start.x, dy = p.y - start.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
      this.steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? RIGHT : LEFT) : dy > 0 ? DOWN : UP);
      start = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', () => { start = null; });
    // Pfeile zum Antippen, groß und daumengerecht: hoch/runter links, links/rechts rechts neben dem Tisch
    if (!isTouchDevice(this)) return;
    const S = 32;
    for (const [d, x, y, label] of [[UP, 36, 168, '▲'], [DOWN, 36, 226, '▼'], [LEFT, 426, 200, '◀'], [RIGHT, 461, 200, '▶']] as const) {
      const b = this.add.rectangle(x, y, S, S + 14, 0x3a2a1e, 0.9).setStrokeStyle(2, 0xa07a2a).setInteractive().setDepth(20);
      txt(this, b.x, b.y, label, '#d8b050', 16).setOrigin(0.5).setDepth(21);
      b.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev.stopPropagation(); this.steer(d as Pt); });
    }
  }

  // ---------------------------------------------------------------- Ablauf

  private makeSnake(start: Pt, dir: Pt, col: [number, number]): Snake {
    const s: Snake = { body: [], dir, queue: [], score: 0, alive: true, respawnAt: 0, grow: 0, start, startDir: dir, col };
    this.place(s);
    return s;
  }

  private place(s: Snake) {
    s.body = [0, 1, 2].map((i) => [s.start[0] - s.startDir[0] * i, s.start[1] - s.startDir[1] * i] as Pt);
    s.dir = s.startDir;
    s.queue = [];
    s.grow = 0;
    s.alive = true;
  }

  private reset() {
    this.you = this.makeSnake([4, 7], RIGHT, [0xc03a3a, 0xe86a5a]);
    this.cemo = this.makeSnake([COLS - 5, 7], LEFT, [0x2a8a7a, 0x5acaba]);
    this.food = [];
    this.spawnFood();
    this.spawnFood();
    this.spawnFood();
    this.acc = 0;
    this.tick = 0;
    this.over = false;
    this.updateHud();
  }

  private countdown() {
    this.running = false;
    const seq = ['3', '2', '1', 'ZIEH!'];
    seq.forEach((s, i) => this.time.delayedCall(i * 550, () => { this.msg.setText(s).setAlpha(1); audio.sfx(i < 3 ? 'blip' : 'chime'); }));
    this.time.delayedCall(seq.length * 550, () => { this.msg.setText(''); this.running = true; });
  }

  private stepMs() {
    return Math.max(108, 168 - (this.you.score + this.cemo.score) * 1.8);
  }

  update(time: number, delta: number) {
    if (this.running && !this.over) {
      this.acc += Math.min(delta, 100);
      while (this.acc >= this.stepMs()) {
        this.acc -= this.stepMs();
        this.step(time);
        if (this.over) break;
      }
    }
    this.draw(time);
  }

  private step(now: number) {
    this.tick++;
    for (const s of [this.you, this.cemo]) if (!s.alive && now >= s.respawnAt) this.respawn(s, now);
    const you = this.you, cemo = this.cemo;
    if (you.alive && you.queue.length) you.dir = you.queue.shift()!;
    // Cemo ist langsamer: jeder vierte (nach einer Niederlage jeder dritte) Schritt fällt aus
    const cemoMoves = cemo.alive && this.tick % (this.losses ? 3 : 4) !== 0;
    if (cemoMoves) cemo.dir = this.aiDir();

    const heads = new Map<Snake, Pt>();
    if (you.alive) heads.set(you, add(you.body[0], you.dir));
    if (cemoMoves) heads.set(cemo, add(cemo.body[0], cemo.dir));
    const crashed = new Set<Snake>();
    for (const [s, h] of heads) {
      if (!inside(h)) { crashed.add(s); continue; }
      for (const o of [you, cemo]) {
        if (!o.alive) continue;
        // ein Schwanz, der sich in diesem Schritt wegbewegt, ist frei
        const cells = heads.has(o) && o.grow === 0 ? o.body.slice(0, -1) : o.body;
        if (cells.some((c) => same(c, h))) crashed.add(s);
      }
    }
    if (heads.size === 2 && same(heads.get(you)!, heads.get(cemo)!)) { crashed.add(you); crashed.add(cemo); }

    for (const [s, h] of heads) {
      if (crashed.has(s)) { this.crash(s, now); continue; }
      s.body.unshift(h);
      const fi = this.food.findIndex((f) => same(f, h));
      if (fi >= 0) {
        this.food.splice(fi, 1);
        s.score++;
        s.grow++;
        this.puff(h, 0.12);
        audio.sfx(s === you ? 'glug' : 'blip');
        this.spawnFood();
      }
      if (s.grow > 0) s.grow--;
      else s.body.pop();
    }
    this.updateHud();
    if (you.score >= ZIEL) this.finish(true);
    else if (cemo.score >= ZIEL_CEMO) this.finish(false);
  }

  private crash(s: Snake, now: number) {
    s.alive = false;
    const du = s === this.you;
    s.score = Math.max(0, s.score - (du ? 1 : 2));
    s.respawnAt = now + (du ? 1000 : 1300);
    this.puff(s.body[0], 0.25);
    audio.sfx('thud');
    const [x, y] = this.px(s.body[0]);
    const t = txt(this, x, y - 10, 'HUST!', s === this.you ? '#f0a070' : '#7ad0c0').setOrigin(0.5).setDepth(12).setStroke('#120c0b', 3);
    this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  private respawn(s: Snake, now: number) {
    const other = s === this.you ? this.cemo : this.you;
    const cells = [0, 1, 2].map((i) => [s.start[0] - s.startDir[0] * i, s.start[1] - s.startDir[1] * i] as Pt);
    if (other.alive && other.body.some((c) => cells.some((d) => same(c, d)))) { s.respawnAt = now + 300; return; }
    this.place(s);
  }

  private spawnFood() {
    const busy = (p: Pt) => [...this.you.body, ...this.cemo.body, ...this.food].some((c) => same(c, p));
    for (let i = 0; i < 200; i++) {
      const p: Pt = [Phaser.Math.Between(1, COLS - 2), Phaser.Math.Between(1, ROWS - 2)];
      if (!busy(p)) { this.food.push(p); return; }
    }
  }

  // ---------------------------------------------------------------- Cemo

  private blockedGrid() {
    const grid = Array.from({ length: ROWS }, () => new Array<boolean>(COLS).fill(false));
    for (const s of [this.you, this.cemo]) {
      if (!s.alive) continue;
      const cells = s.grow === 0 ? s.body.slice(0, -1) : s.body;
      for (const [x, y] of cells) grid[y][x] = true;
    }
    return grid;
  }

  /** freie Felder, die von p aus erreichbar sind (gedeckelt) */
  private space(p: Pt, grid: boolean[][], cap = 60) {
    if (!inside(p) || grid[p[1]][p[0]]) return 0;
    const seen = new Set([p[1] * COLS + p[0]]);
    const queue: Pt[] = [p];
    while (queue.length && seen.size < cap) {
      const c = queue.shift()!;
      for (const d of ALL) {
        const n = add(c, d), k = n[1] * COLS + n[0];
        if (inside(n) && !grid[n[1]][n[0]] && !seen.has(k)) { seen.add(k); queue.push(n); }
      }
    }
    return seen.size;
  }

  /** erster Schritt auf dem kürzesten Weg zum nächsten Tabak */
  private towardFood(grid: boolean[][]): Pt | null {
    const head = this.cemo.body[0];
    const first = new Map<number, Pt>();
    const queue: Pt[] = [];
    for (const d of ALL) {
      const n = add(head, d);
      if (!inside(n) || grid[n[1]][n[0]]) continue;
      const k = n[1] * COLS + n[0];
      if (!first.has(k)) { first.set(k, d); queue.push(n); }
    }
    while (queue.length) {
      const c = queue.shift()!;
      const d0 = first.get(c[1] * COLS + c[0])!;
      if (this.food.some((f) => same(f, c))) return d0;
      for (const d of ALL) {
        const n = add(c, d), k = n[1] * COLS + n[0];
        if (inside(n) && !grid[n[1]][n[0]] && !first.has(k)) { first.set(k, d0); queue.push(n); }
      }
    }
    return null;
  }

  private aiDir(): Pt {
    const s = this.cemo, head = s.body[0];
    const grid = this.blockedGrid();
    const safe = ALL.filter((d) => !(d[0] === -s.dir[0] && d[1] === -s.dir[1]) && this.space(add(head, d), grid) > 0);
    if (!safe.length) return s.dir;
    if (Math.random() < 0.2 + Math.min(2, this.losses) * 0.06) return safe[Math.floor(Math.random() * safe.length)];
    const f = this.towardFood(grid);
    if (f && safe.some((d) => same(d, f)) && this.space(add(head, f), grid) >= Math.min(30, s.body.length + 4)) return f;
    return safe.sort((a, b) => this.space(add(head, b), grid) - this.space(add(head, a), grid))[0];
  }

  // ---------------------------------------------------------------- Zeichnen

  private px(p: Pt): [number, number] {
    return [GX + p[0] * CELL + CELL / 2, GY + p[1] * CELL + CELL / 2];
  }

  private puff(p: Pt, scale: number) {
    const [x, y] = this.px(p);
    const s = this.add.image(x, y, 'light').setTint(0xe0d8d0).setAlpha(0.5).setScale(scale * 0.4).setDepth(5);
    this.tweens.add({ targets: s, scale, alpha: 0, y: y - 10, duration: 700, ease: 'Sine.easeOut', onComplete: () => s.destroy() });
  }

  private updateHud() {
    const bar = (n: number, z: number) => '●'.repeat(n) + '○'.repeat(Math.max(0, z - n));
    this.hudYou.setText(`DU ${bar(this.you.score, ZIEL)}`);
    this.hudCemo.setText(`${bar(this.cemo.score, ZIEL_CEMO)} CEMO`);
  }

  private draw(time: number) {
    const g = this.g;
    g.clear();
    for (const f of this.food) {
      const [x, y] = this.px(f);
      const bob = Math.sin(time / 260 + f[0]) * 0.6;
      g.fillStyle(0x5a2e14).fillCircle(x, y + bob, 4.6);
      g.fillStyle(0xc8602a).fillCircle(x - 1, y - 1 + bob, 2.6);
      g.fillStyle(0x4a8a3a).fillRect(x + 1, y - 6 + bob, 2, 3);
    }
    for (const s of [this.cemo, this.you]) {
      if (!s.alive) continue;
      for (let i = s.body.length - 1; i >= 1; i--) {
        const [x, y] = this.px(s.body[i]);
        const [qx, qy] = this.px(s.body[i - 1]);
        const col = i % 2 ? s.col[0] : s.col[1];
        g.fillStyle(col).fillRect(Math.min(x, qx) - 4, Math.min(y, qy) - 4, Math.abs(x - qx) + 8, Math.abs(y - qy) + 8);
        g.fillStyle(col).fillCircle(x, y, 4.6);
      }
      // Mundstück aus Messing
      const [hx, hy] = this.px(s.body[0]);
      g.fillStyle(0xd8b050).fillCircle(hx, hy, 5.6);
      g.fillStyle(0xf0e0a0).fillCircle(hx - 1.5, hy - 1.5, 2);
      g.fillStyle(0x1a1010).fillCircle(hx + s.dir[0] * 3, hy + s.dir[1] * 3, 1.7);
    }
  }

  // ---------------------------------------------------------------- Ende

  private finish(win: boolean) {
    if (this.over) return;
    this.over = true;
    this.running = false;
    if (!win) this.losses++;
    audio.sfx(win ? 'kaching' : 'refuse');
    const box = this.add.container(W / 2, H / 2).setDepth(30);
    box.add(this.add.rectangle(0, 0, 260, 110, 0x1a1210, 0.96).setStrokeStyle(2, 0xd8b050));
    box.add(txt(this, 0, -34, win ? 'GEWONNEN!' : 'CEMO GEWINNT', win ? '#f0c060' : '#7ad0c0', 16).setOrigin(0.5));
    box.add(txt(this, 0, -8, win ? 'Cemo hustet und gibt auf.' : 'Er pustet dir einen Ring ins Gesicht.', '#d8c8b0').setOrigin(0.5));
    if (win) {
      const go = new Btn(this, 0, 30, 140, 20, 'WEITER', 0xa8342a, () => this.close(true));
      box.add(go.box);
      this.primary = () => this.close(true);
    } else {
      const again = new Btn(this, -62, 30, 110, 20, 'NOCHMAL', 0xa8342a, () => this.restart());
      const stop = new Btn(this, 62, 30, 110, 20, 'AUFHÖREN', 0x3a3040, () => this.close(false));
      box.add([again.box, stop.box]);
      this.primary = () => this.restart();
    }
    this.endBox = box;
  }

  private restart() {
    this.endBox?.destroy();
    this.endBox = undefined;
    this.primary = null;
    this.reset();
    this.countdown();
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
