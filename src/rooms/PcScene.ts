import Phaser from 'phaser';
import { Track, audio } from '../audio';
import { state } from '../state';
import { unlock } from '../progress/achievements';
import { PC_FILES, PcFile, gelesen } from '../dialog/pcFiles';
import { H, W, txt } from '../ui';
import { Btn } from '../scenes/ShopScene';
import { toast } from '../scenes/HudScene';

export interface PcData {
  /** pausierte Szene (Dachboden), die danach weiterläuft */
  resume: string;
}

// Bildschirmbereich des Röhrenmonitors
const SX = 46, SY = 26, SW = W - 92, SH = H - 64;
const GREEN = '#58f08a', DIM = '#2a8a4a';
/** Sperre nach einem verlorenen Hack (Spielsekunden) */
const SPERRE = 45;

// ---------------------------------------------------------------- Block Blast: Raster, Teile, Punkte
const N = 8;
const C = 16;
const GX = SX + 10, GY = SY + 26;
/** Ziel: so viele Punkte, dann ist Claudius' Gegen-Hacker geschlagen */
const ZIEL = 150;
/** alle so viele Züge ohne gesprengte Reihe wirft Claudius Zensurblöcke ins Raster */
const STOER_ALLE = 6;
const ZENSUR = 0x6a6a72;
const FARBEN = [0xe8503a, 0xf0a030, 0xf0d040, 0x58c860, 0x3aa8e0, 0x8a6ae0, 0xe060b0];
const TRAY_X = SX + 150, TRAY_Y = SY + 26, SLOT = 48, TC = 9;

type Zelle = [number, number];
interface Teil { cells: Zelle[]; w: number; h: number; color: number }

const BASIS: Zelle[][] = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
];

function normal(cells: Zelle[]): Zelle[] {
  const mx = Math.min(...cells.map((c) => c[0])), my = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my] as Zelle).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
/** alle Drehungen und Spiegelungen einer Form, ohne Doppelte */
function varianten(base: Zelle[]) {
  const out = new Map<string, Zelle[]>();
  let cur = base;
  for (let m = 0; m < 2; m++) {
    for (let r = 0; r < 4; r++) {
      cur = normal(cur.map(([x, y]) => [-y, x] as Zelle));
      out.set(JSON.stringify(cur), cur);
    }
    cur = normal(base.map(([x, y]) => [-x, y] as Zelle));
  }
  return [...out.values()];
}
const FORMEN = BASIS.map(varianten);

function neuesTeil(): Teil {
  const vs = FORMEN[Math.floor(Math.random() * FORMEN.length)];
  const cells = vs[Math.floor(Math.random() * vs.length)];
  return { cells, w: Math.max(...cells.map((c) => c[0])) + 1, h: Math.max(...cells.map((c) => c[1])) + 1, color: FARBEN[Math.floor(Math.random() * FARBEN.length)] };
}

const SHOUTS = [
  'BÜRGER! Finger weg von meinen Statistiken!',
  'Zensur ist nur Pressefreiheit mit Ordnung!',
  'Die BLÖD-Zeitung hat das bereits gedruckt. Also stimmt es!',
  'Ein Bier ist ein Furz ist ein Verbrechen!',
  'Im Namen von Tavirien: STOPP!',
];

/** Captain Claudius' versteckter Rechner: Mails lesen, Lesestand merken, dann den Gegen-Hacker im Block-Blast schlagen. */
export class PcScene extends Phaser.Scene {
  private cfg!: PcData;
  private view!: Phaser.GameObjects.Container;
  private wasRunning = false;
  private busy = false;
  private closing = false;
  private keyHandler?: (e: KeyboardEvent) => void;

  constructor() {
    super('Pc');
  }

  create(data: PcData) {
    this.cfg = data;
    this.busy = false;
    this.closing = false;
    this.wasRunning = state.running;
    state.running = false;
    this.scene.bringToTop();

    // Röhrenmonitor
    this.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0);
    this.add.rectangle(W / 2, H / 2 - 4, W - 60, H - 36, 0xc8c0a8).setStrokeStyle(2, 0x6a6458);
    this.add.rectangle(W / 2, H / 2 - 4, SW + 8, SH + 8, 0x3a3a34);
    this.add.rectangle(SX, SY, SW, SH, 0x07140c).setOrigin(0);
    const glow = this.add.image(W / 2, H / 2, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(3, 2).setTint(0x30a050).setAlpha(0.12);
    this.tweens.add({ targets: glow, alpha: 0.08, duration: 90, yoyo: true, repeat: -1, repeatDelay: 1700 });
    txt(this, W / 2, H - 22, 'CLAUDIUS-OS 3.1  ·  EIGENTUM VON TAVIRIEN', '#5a5448').setOrigin(0.5);
    const scan = this.add.graphics().setDepth(50);
    for (let y = SY; y < SY + SH; y += 2) scan.fillStyle(0x000000, 0.18).fillRect(SX, y, SW, 1);

    this.view = this.add.container(0, 0);
    this.input.keyboard!.on('keydown-ESC', () => !this.busy && this.close());
    this.cameras.main.fadeIn(150);
    audio.sfx('blip');
    this.showList();
  }

  // ---------------------------------------------------------------- Dateien

  private clear() {
    this.view.removeAll(true);
    if (this.keyHandler) this.input.keyboard!.off('keydown', this.keyHandler);
    this.keyHandler = undefined;
    this.input.removeAllListeners('pointermove');
    this.input.removeAllListeners('pointerup');
  }

  private header(title: string) {
    this.view.add(txt(this, SX + 8, SY + 6, title, GREEN));
    this.view.add(this.add.rectangle(SX + 8, SY + 18, SW - 16, 1, 0x2a8a4a).setOrigin(0));
  }

  private button(x: number, y: number, w: number, label: string, color: number, act: () => void) {
    const b = new Btn(this, x, y, w, 16, label, color, act);
    this.view.add(b.box);
    return b;
  }

  private read(): string[] {
    return gelesen(state.flags.pcGelesen);
  }

  private showList() {
    this.clear();
    const f = state.flags;
    if ((f.pcSperreBis ?? 0) > state.time) {
      this.header('ZUGRIFF VERWEIGERT');
      const left = Math.ceil((f.pcSperreBis ?? 0) - state.time);
      this.view.add(txt(this, W / 2, SY + 60, 'CLAUDIUS HAT DAS PASSWORT GEÄNDERT.', '#ff7a6a').setOrigin(0.5));
      this.view.add(txt(this, W / 2, SY + 80, `Neuer Versuch in ${left} Sekunden.\n(Draußen. Hier drin steht die Zeit still.)`, DIM).setOrigin(0.5).setAlign('center'));
      this.button(W / 2, SY + SH - 16, 120, 'AUSSCHALTEN', 0x3a3040, () => this.close());
      return;
    }

    const done = f.claudius === 'veroeffentlicht';
    this.header(done ? 'C:\\POST  ·  STATUS: VERSCHICKT' : 'C:\\POST\\STRENG_GEHEIM');
    const read = this.read();
    PC_FILES.forEach((file, i) => {
      const y = SY + 34 + i * 22;
      const isRead = read.includes(file.id);
      const row = this.add.rectangle(SX + 8, y - 8, SW - 16, 18, 0x0e2a18, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      const icon = this.add.image(SX + 18, y + 1, 'ach_file').setScale(0.75);
      const name = txt(this, SX + 30, y - 3, file.name, isRead ? DIM : GREEN);
      const mark = txt(this, SX + SW - 12, y - 3, isRead ? 'GELESEN' : 'NEU', isRead ? DIM : '#f8e070').setOrigin(1, 0);
      row.on('pointerover', () => row.setFillStyle(0x0e2a18, 1));
      row.on('pointerout', () => row.setFillStyle(0x0e2a18, 0));
      row.on('pointerup', () => { audio.sfx('click'); this.showFile(file, 0); });
      this.view.add([row, icon, name, mark]);
    });
    this.view.add(txt(this, SX + 8, SY + 84, `Gelesen: ${read.length} von ${PC_FILES.length}.  Tasten 1-${PC_FILES.length} öffnen.`, DIM));
    this.keyHandler = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (PC_FILES[i]) this.showFile(PC_FILES[i], 0);
    };
    this.input.keyboard!.on('keydown', this.keyHandler);

    if (done) {
      this.view.add(txt(this, SX + 8, SY + 104, 'Alles liegt bei seriösen Redaktionen und\nFaktencheckern. Die BLÖD-Zeitung schweigt.', DIM));
    } else if (read.length >= PC_FILES.length) {
      this.view.add(txt(this, SX + 8, SY + 104, 'Claudius hat einen Gegen-Hacker auf der Leitung.\nSchlag ihn, dann gehen die Mails raus.', '#f8e070'));
      this.button(W / 2 - 66, SY + SH - 16, 120, 'ABSCHICKEN', 0xa8342a, () => this.blockBlast());
    } else {
      this.view.add(txt(this, SX + 8, SY + 104, 'Erst alles lesen. Dann entscheiden.', DIM));
    }
    this.button(done || read.length < PC_FILES.length ? W / 2 : W / 2 + 66, SY + SH - 16, 120, 'AUSSCHALTEN', 0x3a3040, () => this.close());
  }

  private showFile(file: PcFile, page: number) {
    this.clear();
    this.header(`${file.name}  ·  SEITE ${page + 1}/${file.pages.length}`);
    this.view.add(txt(this, SX + 10, SY + 26, file.pages[page], GREEN).setLineSpacing(4));
    const last = page === file.pages.length - 1;
    if (last) this.markRead(file.id);
    const prev = () => page > 0 && this.showFile(file, page - 1);
    const next = () => (last ? this.showList() : this.showFile(file, page + 1));
    if (page > 0) this.button(SX + 54, SY + SH - 16, 90, '< ZURÜCK', 0x2a4a34, prev);
    this.button(W / 2, SY + SH - 16, 90, 'LISTE', 0x3a3040, () => this.showList());
    this.button(SX + SW - 54, SY + SH - 16, 90, last ? 'FERTIG' : 'WEITER >', 0x2a6a3a, next);
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') prev();
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === ' ' || e.key === 'Enter') next();
    };
    this.input.keyboard!.on('keydown', this.keyHandler);
  }

  private markRead(id: string) {
    const read = this.read();
    if (read.includes(id)) return;
    state.flags.pcGelesen = [...read, id];
    if (state.flags.pcGelesen.length >= PC_FILES.length) unlock('beweismittel');
  }

  // ---------------------------------------------------------------- Der Hack: Block Blast gegen Claudius' Gegen-Hacker

  /**
   * Teile ins 8×8-Raster setzen; volle Reihen und Spalten verschwinden. Punkte: 1 je Feld, für Reihen 10·n²,
   * Serien (mehrmals hintereinander gesprengt) geben Bonus. Claudius wirft regelmäßig Zensurblöcke ins Raster.
   * Ziel erreicht: Mails gehen raus. Kein Teil passt mehr: Claudius sperrt den Rechner.
   * Bedienung: Teil ziehen und loslassen, oder Teil antippen und dann ein Feld antippen; Tastatur 1–3, Pfeile, Enter.
   */
  private musikVorher: Track = 'dach';

  private blockBlast() {
    if (this.busy) return;
    this.busy = true;
    this.clear();
    this.musikVorher = audio.zwischen(this, 'pc');
    this.header('HACK: GEGEN-HACKER VON TAVIRIEN');

    const grid: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
    let tray: (Teil | null)[] = [neuesTeil(), neuesTeil(), neuesTeil()];
    let score = 0, streak = 0, ohneSprengung = 0, finished = false;
    let sel = -1; // ausgewähltes Teil
    let cursor: Zelle = [3, 3];
    let drag: { x: number; y: number; sx: number; sy: number; touch: boolean } | null = null;

    const board = this.add.graphics();
    const trayG = this.add.graphics();
    const dragG = this.add.graphics().setDepth(40);
    const scoreT = txt(this, TRAY_X, TRAY_Y + 64, '', GREEN);
    const barBg = this.add.rectangle(TRAY_X, TRAY_Y + 78, 144, 8, 0x0e2a18).setOrigin(0).setStrokeStyle(1, 0x2a8a4a);
    const bar = this.add.rectangle(TRAY_X + 1, TRAY_Y + 79, 0, 6, 0x58f08a).setOrigin(0);
    const help = txt(this, TRAY_X, TRAY_Y + 92, 'Teile ins Raster ziehen.\nVolle Reihen und Spalten\nsprengen seine Fake-News.', DIM);
    const shout = txt(this, GX, GY + N * C + 6, '', '#ff9a8a').setWordWrapWidth(SW - 20);
    this.view.add([board, trayG, scoreT, barBg, bar, help, shout]);

    // Claudius im Videoanruf
    const camBox = this.add.container(SX + SW - 76, SY + 26);
    const frame = this.add.rectangle(0, 0, 68, 86, 0x0a0a12).setOrigin(0).setStrokeStyle(1, 0xc04040);
    // Brustbild in doppelter Auflösung: halbe Größe, damit Kopf und Orden ins Fenster passen
    const bust = this.add.image(34, 92, 'nbust_claudius').setOrigin(0.5, 1).setScale(0.5);
    bust.setMask(this.make.graphics({}, false).fillRect(SX + SW - 76, SY + 26, 68, 86).createGeometryMask());
    const live = txt(this, 4, 3, 'LIVE', '#ff5050');
    camBox.add([frame, bust, live]);
    this.view.add([camBox, dragG]);
    this.tweens.add({ targets: live, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });

    const say = (s: string, angry = false) => {
      shout.setText(`CLAUDIUS: ${s}`);
      if (angry) {
        bust.setTexture('nbust_claudiusAngry');
        this.time.delayedCall(700, () => bust.active && bust.setTexture('nbust_claudius'));
      }
    };
    say('Was tun Sie an MEINEM Rechner?! Das ist tavirisches Staatsgebiet!');

    const passt = (t: Teil, gx: number, gy: number) => t.cells.every(([x, y]) => grid[gy + y]?.[gx + x] === 0);
    const irgendwo = (t: Teil) => { for (let y = 0; y <= N - t.h; y++) for (let x = 0; x <= N - t.w; x++) if (passt(t, x, y)) return true; return false; };

    const block = (g: Phaser.GameObjects.Graphics, x: number, y: number, s: number, color: number, alpha = 1) => {
      const c = Phaser.Display.Color.IntegerToColor(color);
      g.fillStyle(color, alpha).fillRect(x, y, s - 1, s - 1);
      g.fillStyle(c.clone().lighten(25).color, alpha).fillRect(x, y, s - 1, 2).fillRect(x, y, 2, s - 1);
      g.fillStyle(c.clone().darken(25).color, alpha).fillRect(x, y + s - 3, s - 1, 2).fillRect(x + s - 3, y, 2, s - 1);
    };

    /** wohin das Teil gerade fallen würde (aus Ziehen oder Tastatur-Cursor) */
    const ziel = (): Zelle | null => {
      const t = tray[sel];
      if (!t) return null;
      if (drag) {
        const [px, py] = dragPos(t);
        const gx = Math.round((px - GX) / C), gy = Math.round((py - GY) / C);
        return gx >= 0 && gy >= 0 && gx + t.w <= N && gy + t.h <= N ? [gx, gy] : null;
      }
      return [Phaser.Math.Clamp(cursor[0], 0, N - t.w), Phaser.Math.Clamp(cursor[1], 0, N - t.h)];
    };
    const dragPos = (t: Teil): Zelle => (drag!.touch ? [drag!.x - (t.w * C) / 2, drag!.y - t.h * C - 12] : [drag!.x - (t.w * C) / 2, drag!.y - (t.h * C) / 2]);

    const draw = () => {
      board.clear();
      board.fillStyle(0x0a1e12).fillRect(GX - 2, GY - 2, N * C + 3, N * C + 3);
      const z = ziel();
      const t = tray[sel];
      const ok = !!(t && z && passt(t, z[0], z[1]));
      // Reihen/Spalten, die mit diesem Zug voll würden, leuchten
      const voll = { r: new Set<number>(), c: new Set<number>() };
      if (ok && t && z) {
        const tmp = grid.map((r) => [...r]);
        for (const [x, y] of t.cells) tmp[z[1] + y][z[0] + x] = 1;
        for (let i = 0; i < N; i++) { if (tmp[i].every((v) => v)) voll.r.add(i); if (tmp.every((r) => r[i])) voll.c.add(i); }
      }
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const v = grid[y][x];
          if (v) block(board, GX + x * C, GY + y * C, C, v, voll.r.has(y) || voll.c.has(x) ? 0.6 : 1);
          else board.fillStyle(voll.r.has(y) || voll.c.has(x) ? 0x2a5a3a : 0x10301c).fillRect(GX + x * C, GY + y * C, C - 1, C - 1);
          if (v === ZENSUR) board.fillStyle(0xc02a2a).fillRect(GX + x * C + 3, GY + y * C + 7, C - 7, 2);
        }
      if (ok && t && z) for (const [x, y] of t.cells) block(board, GX + (z[0] + x) * C, GY + (z[1] + y) * C, C, t.color, 0.45);
      if (!drag && t && z && !ok) board.lineStyle(1, 0xff5050).strokeRect(GX + z[0] * C, GY + z[1] * C, t.w * C - 1, t.h * C - 1);

      trayG.clear();
      tray.forEach((p, i) => {
        const sx = TRAY_X + i * SLOT;
        trayG.lineStyle(1, i === sel ? 0xf8e070 : 0x2a8a4a).strokeRect(sx, TRAY_Y, SLOT - 4, 56);
        if (!p || (drag && i === sel)) return;
        const fits = irgendwo(p);
        const ox = sx + (SLOT - 4 - p.w * TC) / 2, oy = TRAY_Y + (56 - p.h * TC) / 2;
        for (const [x, y] of p.cells) block(trayG, ox + x * TC, oy + y * TC, TC, fits ? p.color : 0x3a3a40);
      });

      dragG.clear();
      if (drag && t) {
        const [px, py] = dragPos(t);
        for (const [x, y] of t.cells) block(dragG, px + x * C, py + y * C, C, t.color, 0.9);
      }
      scoreT.setText(`PUNKTE ${score} / ${ZIEL}`);
      bar.width = (142 * Math.min(score, ZIEL)) / ZIEL;
    };

    /** volle Reihen und Spalten finden und sprengen; liefert ihre Anzahl */
    const sprengen = () => {
      const rows: number[] = [], cols: number[] = [];
      for (let i = 0; i < N; i++) { if (grid[i].every((v) => v)) rows.push(i); if (grid.every((r) => r[i])) cols.push(i); }
      if (!rows.length && !cols.length) return 0;
      const flash = this.add.graphics().setDepth(41);
      flash.fillStyle(0xffffff, 0.85);
      for (const y of rows) flash.fillRect(GX, GY + y * C, N * C - 1, C - 1);
      for (const x of cols) flash.fillRect(GX + x * C, GY, C - 1, N * C - 1);
      this.view.add(flash);
      this.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
      for (const y of rows) grid[y].fill(0);
      for (const x of cols) for (const r of grid) r[x] = 0;
      return rows.length + cols.length;
    };

    const setzen = (gx: number, gy: number) => {
      const t = tray[sel];
      if (finished || !t || !passt(t, gx, gy)) { audio.sfx('error'); return false; }
      for (const [x, y] of t.cells) grid[gy + y][gx + x] = t.color;
      score += t.cells.length;
      tray[sel] = null;
      sel = -1;
      audio.sfx('click');
      const n = sprengen();
      if (n) {
        streak++;
        ohneSprengung = 0;
        score += 10 * n * n + (streak > 1 ? 5 * (streak - 1) : 0);
        audio.sfx(n > 1 ? 'kaching' : 'coin');
        this.cameras.main.shake(100 + n * 40, 0.003 * n);
        if (n > 1 || streak > 2) say(Phaser.Utils.Array.GetRandom(['Nein! Meine Flatulenz-Statistik!', 'Das war eine sehr teure Schlagzeile!', 'Die BLÖD-Zeitung wird davon erfahren!']), true);
      } else {
        streak = 0;
        // Claudius' Gegen-Hacker: Zensurblöcke auf freie Felder
        if (++ohneSprengung >= STOER_ALLE) {
          ohneSprengung = 0;
          const frei: Zelle[] = [];
          grid.forEach((r, y) => r.forEach((v, x) => !v && frei.push([x, y])));
          Phaser.Utils.Array.Shuffle(frei).slice(0, 2).forEach(([x, y]) => (grid[y][x] = ZENSUR));
          sprengen();
          say(Phaser.Utils.Array.GetRandom(SHOUTS), true);
          audio.sfx('angry');
          this.cameras.main.flash(120, 160, 40, 40);
        }
      }
      if (tray.every((p) => !p)) tray = [neuesTeil(), neuesTeil(), neuesTeil()];
      draw();
      if (score >= ZIEL) end(true);
      else if (!tray.some((p) => p && irgendwo(p))) end(false);
      return true;
    };

    // ---- Bedienung: Maus/Touch
    const slotAt = (x: number, y: number) => (y >= TRAY_Y && y <= TRAY_Y + 56 && x >= TRAY_X && x < TRAY_X + 3 * SLOT ? Math.floor((x - TRAY_X) / SLOT) : -1);
    const zelleAt = (x: number, y: number): Zelle | null => {
      const gx = Math.floor((x - GX) / C), gy = Math.floor((y - GY) / C);
      return gx >= 0 && gy >= 0 && gx < N && gy < N ? [gx, gy] : null;
    };
    const pad = this.add.zone(SX, SY, SW, SH).setOrigin(0).setInteractive();
    this.view.add(pad);
    pad.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (finished) return;
      const s = slotAt(p.x, p.y);
      if (s >= 0 && tray[s]) {
        sel = s;
        drag = { x: p.x, y: p.y, sx: p.x, sy: p.y, touch: p.wasTouch };
        audio.sfx('blip');
        draw();
        return;
      }
      // Antippen-Modus: ausgewähltes Teil mittig auf das angetippte Feld setzen
      const z = zelleAt(p.x, p.y);
      const t = tray[sel];
      if (z && t) setzen(Phaser.Math.Clamp(z[0] - Math.floor(t.w / 2), 0, N - t.w), Phaser.Math.Clamp(z[1] - Math.floor(t.h / 2), 0, N - t.h));
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!drag) return;
      drag.x = p.x;
      drag.y = p.y;
      draw();
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!drag) return;
      // Loslassen entscheidet: Position kommt aus dem Loslassen selbst (schnelle Wischer liefern kaum Zwischenschritte)
      drag.x = p.x;
      drag.y = p.y;
      const moved = Math.abs(p.x - drag.sx) + Math.abs(p.y - drag.sy) > 4;
      const z = ziel();
      drag = null;
      if (moved && z) setzen(z[0], z[1]);
      else draw(); // nur angetippt: bleibt ausgewählt
    });

    // ---- Bedienung: Tastatur
    this.keyHandler = (e: KeyboardEvent) => {
      if (finished) return;
      const i = Number(e.key) - 1;
      if (i >= 0 && i < 3 && tray[i]) { sel = i; audio.sfx('blip'); }
      else if (e.key === 'ArrowLeft') cursor = [Math.max(0, cursor[0] - 1), cursor[1]];
      else if (e.key === 'ArrowRight') cursor = [Math.min(N - 1, cursor[0] + 1), cursor[1]];
      else if (e.key === 'ArrowUp') cursor = [cursor[0], Math.max(0, cursor[1] - 1)];
      else if (e.key === 'ArrowDown') cursor = [cursor[0], Math.min(N - 1, cursor[1] + 1)];
      else if (e.key === 'Enter' || e.key === ' ') { const z = ziel(); if (z) setzen(z[0], z[1]); return; }
      else return;
      draw();
    };
    this.input.keyboard!.on('keydown', this.keyHandler);

    const aufgeben = this.button(SX + SW - 40, SY + SH - 12, 64, 'AUFGEBEN', 0x5a2a20, () => !finished && end(false));
    aufgeben.box.setDepth(45);

    const end = (ok: boolean) => {
      finished = true;
      drag = null;
      aufgeben.setEnabled(false);
      if (this.keyHandler) this.input.keyboard!.off('keydown', this.keyHandler);
      this.keyHandler = undefined;
      draw();
      if (ok) {
        say('NEIIIN! Nicht an seriöse Redaktionen! Die prüfen ja Fakten!', true);
        help.setText('GEHACKT.\nMails und Titelseite sind bei\nRedaktionen und Faktencheckern.').setColor('#f8e070');
        audio.sfx('kaching');
        state.flags.claudius = 'veroeffentlicht';
        unlock('pressefreiheit');
        this.time.delayedCall(2200, () => this.confrontation());
      } else {
        bust.setTexture('nbust_claudiusAngry');
        say('Zugriff verweigert! Im Namen von Tavirien!');
        help.setText('KEIN ZUG MEHR.\nDer Rechner ist eine Weile\ngesperrt.').setColor('#ff7a6a');
        audio.sfx('error');
        this.cameras.main.shake(300, 0.01);
        state.flags.pcSperreBis = state.time + SPERRE;
        this.time.delayedCall(2400, () => {
          this.busy = false;
          audio.music(this.musikVorher);
          toast('Claudius hat dich ausgesperrt. Später noch mal versuchen.');
          this.showList();
        });
      }
    };

    draw();
  }

  /** Nach dem Hack: Konfrontation vor der Kneipe, danach geht es draußen weiter. */
  private confrontation() {
    this.clear();
    this.closing = true;
    if (!state.gameOver) state.running = true;
    this.scene.stop(this.cfg.resume);
    this.scene.start('Cutscene', { script: 'claudiusEnde', next: { scene: 'Alley', data: { spawn: [17, 18] } } });
  }

  private close() {
    if (this.closing) return;
    this.closing = true;
    this.clear();
    state.running = this.wasRunning;
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.resume(this.cfg.resume);
      this.scene.stop();
    });
  }
}
