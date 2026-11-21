import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { isTouchDevice } from '../touch';
import { H, W, txt } from '../ui';
import { Btn } from '../scenes/ShopScene';
import { EMIL } from './emilianGfx';

// Endkampf gegen Emilian (Xavi-Strang, Teil 3). Drei Runden, zusammen etwa zwei Minuten.
//
// So funktioniert er (wird im Kampf auch angezeigt):
//   Emilian holt aus, ein Bereich leuchtet ROT: dort schlägt er ein. Darunter steht groß, was zu tun ist.
//     rot links → RECHTS, rot rechts → LINKS, rot am Boden → SPRINGEN (↑), rot auf Kopfhöhe → DUCKEN (↓)
//   Der Pfeil gilt sofort: Der Wirt geht dorthin und bleibt da, bis der Schlag vorbei ist (umentscheiden geht).
//   Wer sehr spät, aber richtig drückt, schafft ein PERFEKT und darf einmal mehr zuschlagen.
//   Danach (bei Kombos nach dem letzten Schlag) steht Emilian offen: LEERTASTE hämmern = zuschlagen.
//   Runde 2: er ölt sich ein und schlägt manchmal zwei Mal. Letzte Runde: schneller, Doppelschläge und die Bärenumarmung
//   (Leertaste hämmern, bis du frei bist). Sechs Bierdeckel Leben, jede neue Runde gibt zwei zurück.
//   Wer K.O. geht, macht in der aktuellen Runde weiter.

export interface KampfData {
  resume: string;
  onDone?: (win: boolean) => void;
}

type Move = 'links' | 'rechts' | 'stampf' | 'oel';
type Dodge = 'left' | 'right' | 'up' | 'down';
const NEEDED: Record<Move, Dodge> = { links: 'right', rechts: 'left', stampf: 'up', oel: 'down' };
const POSE: Record<Move, [number, number]> = {
  links: [EMIL.windL, EMIL.punchL], rechts: [EMIL.windR, EMIL.punchR], stampf: [EMIL.up, EMIL.slam], oel: [EMIL.oil, EMIL.oil],
};
const PFEIL: Record<Dodge, string> = { left: '◀', right: '▶', up: '▲', down: '▼' };

interface Runde { titel: string; sub: string; hp: number; tell: number; idle: [number, number]; combo: [number, number]; fake: number; hug: number; open: number; hits: number; hint: boolean; col: number }
const RUNDEN: Runde[] = [
  { titel: 'RUNDE 1', sub: 'Der Leibwächter', hp: 30, tell: 1250, idle: [700, 1000], combo: [1, 1], fake: 0, hug: 0, open: 1700, hits: 4, hint: true, col: 0x9ad070 },
  { titel: 'RUNDE 2', sub: 'Er ölt sich ein', hp: 32, tell: 1050, idle: [600, 850], combo: [1, 2], fake: 0, hug: 0, open: 1600, hits: 5, hint: true, col: 0xf0c040 },
  { titel: 'LETZTE RUNDE', sub: 'Bühnen-Berserker', hp: 34, tell: 900, idle: [500, 750], combo: [1, 2], fake: 0, hug: 0.2, open: 1500, hits: 5, hint: true, col: 0xe05040 },
];
const LEBEN = 6, DODGE_MS = 470, PERFEKT_MS = 260, HUG_NOETIG = 10, HUG_MS = 3400;
/** was der Spieler tun muss, und wie der Angriff heißt */
const AKTION: Record<Dodge, string> = { left: '◀ LINKS', right: 'RECHTS ▶', up: '▲ SPRINGEN', down: '▼ DUCKEN' };
const NAME: Record<Move, string> = { links: 'FAUST', rechts: 'FAUST', stampf: 'STAMPFER', oel: 'ÖLSTRAHL' };
const EX = W / 2, EY = H - 2;

type Mode = 'intro' | 'idle' | 'tell' | 'open' | 'hug' | 'mash' | 'hurt' | 'cut' | 'over';

export class KampfScene extends Phaser.Scene {
  private cfg!: KampfData;
  private wasRunning = false;
  private emil!: Phaser.GameObjects.Sprite;
  private wirt!: Phaser.GameObjects.Sprite;
  private zone!: Phaser.GameObjects.Graphics;
  private reticle!: Phaser.GameObjects.Arc;
  private hint!: Phaser.GameObjects.Text;
  private zoneLabel!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private bannerSub!: Phaser.GameObjects.Text;
  private segs: Phaser.GameObjects.Rectangle[] = [];
  private herzen: Phaser.GameObjects.Arc[] = [];
  private mashBar?: Phaser.GameObjects.Container;
  private mashFill?: Phaser.GameObjects.Rectangle;
  private shine?: Phaser.Time.TimerEvent;
  private endBox?: Phaser.GameObjects.Container;
  private primary: (() => void) | null = null;

  private mode: Mode = 'intro';
  private runde = 0;
  private hp = 0;
  private leben = LEBEN;
  private dodge: { dir: Dodge; from: number; until: number } | null = null;
  private impactAt = 0;
  private fakeNow = false;
  private hitsLeft = 0;
  private openUntil = 0;
  private mash = 0;
  private lastHug = false;
  private timers: Phaser.Time.TimerEvent[] = [];
  /** aktueller Schlag (für die Anzeige und Tests) */
  private cur?: Move;

  constructor() {
    super('Kampf');
  }

  create(data: KampfData) {
    this.cfg = data;
    this.wasRunning = state.running;
    state.running = false;
    this.leben = LEBEN;
    this.runde = 0;
    this.segs = [];
    this.herzen = [];
    this.timers = [];
    this.endBox = undefined;
    this.primary = null;
    this.lastHug = false;
    this.dodge = null;
    this.scene.bringToTop();
    audio.music('kampf');

    // Bühne: Vorhang, wandernde Scheinwerfer, Spot auf Emilian
    this.add.image(0, 0, 'csClubFight').setOrigin(0).setTint(0x8a7a90);
    this.add.rectangle(0, 0, W, H, 0x000000, 0.3).setOrigin(0);
    for (const [x, tint, d] of [[120, 0xff4ac0, 2400], [360, 0x9a5aff, 3100]] as const) {
      const l = this.add.image(x, 110, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2.4).setTint(tint).setAlpha(0.32);
      this.tweens.add({ targets: l, x: W - x, duration: d, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.add.image(EX, 120, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2.2, 3.2).setTint(0xfff0d0).setAlpha(0.28);
    this.add.ellipse(EX, EY - 4, 170, 22, 0x000000, 0.45);
    this.emil = this.add.sprite(EX, EY, 'emilBig', EMIL.idle).setOrigin(0.5, 1).setScale(1).setDepth(5);
    this.zone = this.add.graphics().setDepth(7);
    this.zoneLabel = txt(this, 0, 0, '', '#ffd8d0', 16).setOrigin(0.5).setDepth(8).setStroke('#120c0b', 5);
    this.wirt = this.add.sprite(W / 2, H + 40, 'wirt', 3).setOrigin(0.5, 1).setScale(3.2).setDepth(10);
    this.reticle = this.add.circle(EX, EY - 118, 16).setStrokeStyle(2, 0xf0c060).setDepth(9).setVisible(false);
    this.tweens.add({ targets: this.reticle, scale: 1.3, alpha: 0.5, duration: 260, yoyo: true, repeat: -1 });

    // Kopfzeile: Name, drei Lebensbalken (einer je Runde)
    txt(this, W / 2, 6, 'EMILIAN', '#f0e0c0', 16).setOrigin(0.5, 0).setDepth(20).setStroke('#120c0b', 4);
    txt(this, W / 2, 26, 'Leibwächter von Leni Blume', '#a89878').setOrigin(0.5, 0).setDepth(20);
    RUNDEN.forEach((rd, i) => {
      const x = W / 2 - 156 + i * 106;
      this.add.rectangle(x, 38, 100, 7, 0x1a1210).setOrigin(0).setStrokeStyle(1, 0x5a4a3a).setDepth(20);
      this.segs.push(this.add.rectangle(x + 1, 39, 98, 5, rd.col).setOrigin(0).setDepth(21));
    });
    for (let i = 0; i < LEBEN; i++) this.herzen.push(this.add.circle(18 + i * 15, H - 16, 6, 0xf0c060).setStrokeStyle(1, 0x6a4a1a).setDepth(20));
    txt(this, 12, H - 34, 'BIERDECKEL', '#6a5a4a').setDepth(20);
    this.hint = txt(this, W / 2, 166, '', '#ffffff', 16).setOrigin(0.5).setDepth(22).setStroke('#120c0b', 5);
    this.banner = txt(this, W / 2, 172, '', '#f0c060', 16).setOrigin(0.5).setDepth(30).setStroke('#120c0b', 6);
    this.bannerSub = txt(this, W / 2, 192, '', '#f4ead0').setOrigin(0.5).setDepth(30).setStroke('#120c0b', 4);

    this.controls();
    this.cameras.main.fadeIn(300);
    this.intro();
  }

  // ---------------------------------------------------------------- Zeitsteuerung (alles abbrechbar)

  private later(ms: number, fn: () => void) {
    const ev = this.time.delayedCall(ms, fn);
    this.timers.push(ev);
    return ev;
  }

  private clearTimers() {
    for (const t of this.timers) t.remove(false);
    this.timers = [];
  }

  // ---------------------------------------------------------------- Steuerung

  private controls() {
    const kb = this.input.keyboard!;
    for (const [keys, d] of [[['LEFT', 'A'], 'left'], [['RIGHT', 'D'], 'right'], [['UP', 'W'], 'up'], [['DOWN', 'S'], 'down']] as const)
      for (const k of keys) kb.on(`keydown-${k}`, () => this.doDodge(d));
    for (const k of ['SPACE', 'E']) kb.on(`keydown-${k}`, () => this.hau());
    kb.on('keydown-ENTER', () => (this.primary ? this.primary() : this.hau()));
    kb.on('keydown-ESC', () => (this.mode === 'over' ? this.close(false) : this.lose(true)));
    const touchUi = isTouchDevice(this);
    if (touchUi) {
      const S = 32, cx = 56, cy = H - 86;
      for (const [d, ox, oy] of [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]] as const) {
        const b = this.add.rectangle(cx + ox * (S + 2), cy + oy * (S + 2), S, S, 0x3a2a1e, 0.85).setStrokeStyle(1, 0xa07a2a).setInteractive().setDepth(40);
        txt(this, b.x, b.y, PFEIL[d], '#d8b050').setOrigin(0.5).setDepth(41);
        b.on('pointerdown', () => this.doDodge(d));
      }
      const hau = this.add.circle(W - 60, H - 84, 30, 0xa8342a, 0.92).setStrokeStyle(2, 0xf0c060).setInteractive().setDepth(40);
      txt(this, hau.x, hau.y, 'HAU!', '#ffffff').setOrigin(0.5).setDepth(41);
      hau.on('pointerdown', () => this.hau());
    }
    txt(this, W - 8, H - 14, touchUi ? 'Pfeile: ausweichen · HAU: zuschlagen' : 'Pfeile: ausweichen · LEERTASTE: hauen', '#a89878').setOrigin(1, 0).setDepth(20);
  }

  private doDodge(dir: Dodge) {
    if (this.mode === 'over' || this.mode === 'intro' || this.mode === 'cut' || this.mode === 'mash' || this.mode === 'hug') return;
    const w = this.wirt;
    this.tweens.killTweensOf(w);
    w.setScale(3.2).setPosition(W / 2, H + 40);
    if (this.mode !== 'tell') {
      // ohne Ansage: nur ein kleiner Hüpfer, ohne Wirkung
      this.tweens.add({ targets: w, y: H + 30, duration: 80, yoyo: true });
      return;
    }
    // während der Ansage: dorthin gehen und stehen bleiben, bis der Schlag vorbei ist (umentscheiden geht)
    this.dodge = { dir, from: this.time.now, until: Infinity };
    if (dir === 'left' || dir === 'right') this.tweens.add({ targets: w, x: W / 2 + (dir === 'left' ? -130 : 130), duration: 120, ease: 'Quad.easeOut' });
    else if (dir === 'up') this.tweens.add({ targets: w, y: H - 22, duration: 140, ease: 'Quad.easeOut' });
    else this.tweens.add({ targets: w, scaleY: 1.6, duration: 90 });
    audio.sfx('step');
    this.hint.setColor(this.cur && dir === NEEDED[this.cur] ? '#9ae09a' : '#ff8a6a');
  }

  /** Wirt zurück in die Mitte */
  private resetWirt() {
    this.dodge = null;
    const w = this.wirt;
    this.tweens.killTweensOf(w);
    this.tweens.add({ targets: w, x: W / 2, y: H + 40, scaleY: 3.2, duration: 150, ease: 'Quad.easeOut' });
  }

  private hau() {
    if (this.mode === 'mash') return this.mashHit();
    if (this.mode !== 'open' || this.hitsLeft <= 0 || this.time.now > this.openUntil) return;
    this.hitsLeft--;
    this.hp--;
    if (this.hitsLeft > 0) this.banner.setText(`LEERTASTE HÄMMERN! ${this.hitsLeft}×`);
    audio.sfx('slap');
    const w = this.wirt;
    this.tweens.killTweensOf(w);
    w.setPosition(W / 2, H + 40).setScale(3.2);
    this.tweens.add({ targets: w, y: H + 16, duration: 60, yoyo: true });
    const e = this.emil;
    e.setFrame(EMIL.hurt).setTintFill(0xffffff);
    this.time.delayedCall(60, () => { e.clearTint(); if (this.runde === 2) e.setTint(0xffd8d0); });
    this.cameras.main.shake(90, 0.006);
    this.spark(this.reticle.x + Phaser.Math.Between(-14, 14), this.reticle.y + Phaser.Math.Between(-12, 12));
    this.float(this.reticle.x + Phaser.Math.Between(-30, 30), this.reticle.y - 30, Phaser.Utils.Array.GetRandom(['ZACK!', 'BUMM!', 'KLATSCH!', 'WAMM!', 'PATSCH!']), '#f0c060');
    if (Math.random() < 0.25) this.crowd(Phaser.Utils.Array.GetRandom(['HORST! HORST!', 'UUUH!', 'GIB IHM!']));
    this.updateBars();
    if (this.hp <= 0) return this.roundOver();
    if (this.hitsLeft <= 0) this.closeOpening();
  }

  // ---------------------------------------------------------------- Ablauf

  private intro() {
    this.mode = 'intro';
    this.emil.setFrame(EMIL.idle).setAlpha(0).setY(EY + 30);
    this.tweens.add({ targets: this.emil, alpha: 1, y: EY, duration: 700, ease: 'Quad.easeOut' });
    this.later(300, () => { audio.sfx('thud'); this.cameras.main.shake(300, 0.01); });
    this.later(900, () => { this.emil.setFrame(EMIL.flex); audio.sfx('roar'); this.cameras.main.flash(160, 255, 220, 160); this.crowd('EMILIAN! EMILIAN!'); });
    this.later(1000, () => {
      const card = this.add.container(W / 2, 150).setDepth(45).setAlpha(0);
      card.add(this.add.rectangle(0, 0, 330, 92, 0x120c0b, 0.9).setStrokeStyle(2, 0xf0c060));
      card.add(txt(this, 0, -32, 'ENDKAMPF', '#f0c060', 16).setOrigin(0.5));
      card.add(txt(this, 0, -8, '1. ROT = da haut er hin', '#ffb0a0').setOrigin(0.5));
      card.add(txt(this, 0, 8, '2. Den angezeigten Pfeil drücken', '#f4ead0').setOrigin(0.5));
      card.add(txt(this, 0, 24, '3. Dann LEERTASTE hämmern', '#9ae09a').setOrigin(0.5));
      this.tweens.add({ targets: card, alpha: 1, duration: 250 });
      this.later(3600, () => this.tweens.add({ targets: card, alpha: 0, duration: 250, onComplete: () => card.destroy() }));
    });
    this.later(5000, () => this.startRound(0));
  }

  private startRound(i: number) {
    this.runde = i;
    this.hp = RUNDEN[i].hp;
    this.mode = 'cut';
    if (i > 0 && this.leben < LEBEN) {
      this.leben = Math.min(LEBEN, this.leben + 2);
      this.herzen.forEach((h, k) => h.setFillStyle(k < this.leben ? 0xf0c060 : 0x3a2a1e));
      this.later(600, () => this.float(70, H - 40, '+2 BIERDECKEL', '#f0c060'));
    }
    this.updateBars();
    const rd = RUNDEN[i];
    this.showBanner(rd.titel, rd.sub);
    this.shine?.remove(false);
    this.emil.clearTint().setScale(1).setY(EY);
    if (i === 0) this.emil.setFrame(EMIL.flex);
    if (i === 1) {
      this.emil.setFrame(EMIL.oil);
      audio.sfx('splash');
      this.later(900, () => this.emil.setFrame(EMIL.flex));
      // ab jetzt glänzt er: kleine Lichtfunken auf den Muskeln
      this.shine = this.time.addEvent({ delay: 260, loop: true, callback: () => this.glint() });
    }
    if (i === 2) {
      this.emil.setFrame(EMIL.up).setTint(0xffb0a0);
      audio.sfx('roar');
      this.cameras.main.shake(500, 0.014);
      this.crowd('ER DREHT DURCH!');
      this.shine = this.time.addEvent({ delay: 180, loop: true, callback: () => this.glint() });
      this.later(900, () => this.emil.setFrame(EMIL.flex));
    }
    this.later(2200, () => { this.emil.clearTint(); if (i === 2) this.emil.setTint(0xffd8d0); this.nextCycle(); });
  }

  private nextCycle() {
    if (this.mode === 'over') return;
    this.mode = 'idle';
    this.reticle.setVisible(false);
    this.emil.setFrame(EMIL.idle).setY(EY).setX(EX);
    const rd = RUNDEN[this.runde];
    this.later(Phaser.Math.Between(rd.idle[0], rd.idle[1]), () => this.startCombo());
  }

  private startCombo() {
    const rd = RUNDEN[this.runde];
    if (rd.hug && !this.lastHug && Math.random() < rd.hug) { this.lastHug = true; return this.bearHug(); }
    this.lastHug = false;
    const n = Phaser.Math.Between(rd.combo[0], rd.combo[1]);
    const moves: Move[] = [];
    for (let i = 0; i < n; i++) {
      let m: Move;
      do m = Phaser.Utils.Array.GetRandom(['links', 'rechts', 'stampf', 'oel', 'links', 'rechts'] as Move[]);
      while (i > 0 && m === moves[i - 1] && Math.random() < 0.7);
      moves.push(m);
    }
    this.attack(moves, 0, false);
  }

  /** Ansage eines Schlags; bei Kombos sind die Folgeschläge schneller */
  private attack(moves: Move[], k: number, perfekt: boolean) {
    if (this.mode === 'over') return;
    const rd = RUNDEN[this.runde];
    const move = moves[k];
    this.cur = move;
    this.mode = 'tell';
    this.fakeNow = k === 0 && Math.random() < rd.fake;
    const tell = k === 0 ? rd.tell : Math.round(rd.tell * 0.85);
    this.dodge = null;
    this.tweens.killTweensOf(this.wirt);
    this.wirt.setPosition(W / 2, H + 40).setScale(3.2);
    this.emil.setFrame(POSE[move][0]).setY(EY).setX(EX);
    if (move === 'stampf') this.tweens.add({ targets: this.emil, y: EY - 14, duration: tell * 0.8, ease: 'Quad.easeOut' });
    if (move === 'oel') this.float(EX + 40, EY - 150, 'BABYÖL!', '#f0e070');
    this.drawZone(move);
    if (rd.hint) this.hint.setText(AKTION[NEEDED[move]]).setColor('#ffffff').setAlpha(1);
    this.zoneLabel.setText(NAME[move]);
    audio.sfx('blip');
    this.impactAt = this.time.now + tell;
    this.later(tell, () => {
      this.clearZone();
      this.hint.setText('');
      if (this.fakeNow) return this.feint();
      this.impact(moves, k, perfekt);
    });
  }

  private feint() {
    this.fakeNow = false;
    this.tweens.add({ targets: this.emil, y: EY, duration: 120 });
    this.emil.setFrame(EMIL.flex);
    this.float(EX, EY - 200, 'HA! ANGETÄUSCHT!', '#9ad070');
    this.later(600, () => this.nextCycle());
  }

  private impact(moves: Move[], k: number, perfektBisher: boolean) {
    const move = moves[k];
    const e = this.emil;
    const now = this.time.now;
    e.setFrame(POSE[move][1]);
    if (move === 'links' || move === 'rechts') {
      const side = move === 'links' ? -1 : 1;
      this.tweens.add({ targets: e, x: EX + side * 40, scaleX: 1.08, duration: 80, yoyo: true, onComplete: () => e.setX(EX).setScale(1) });
      this.whoosh(W / 2 + side * 110, H - 110);
    } else if (move === 'stampf') {
      this.tweens.add({ targets: e, y: EY + 4, duration: 80, ease: 'Quad.easeIn', onComplete: () => e.setY(EY) });
      this.cameras.main.shake(260, 0.016);
      audio.sfx('thud');
      const wave = this.add.rectangle(W / 2, H - 14, 60, 10, 0xf0e0b0, 0.8).setDepth(8);
      this.tweens.add({ targets: wave, width: W, alpha: 0, duration: 380, onComplete: () => wave.destroy() });
    } else {
      const jet = this.add.rectangle(EX, EY - 160, 16, 10, 0xf0e070, 0.9).setDepth(12);
      this.tweens.add({ targets: jet, y: H - 120, width: 320, height: 26, alpha: 0.15, duration: 170, onComplete: () => jet.destroy() });
      audio.sfx('splash');
    }
    const d = this.dodge;
    const ok = !!d && d.dir === NEEDED[move];
    this.later(180, () => this.resetWirt());
    if (!ok) return this.hurt(d ? 'FALSCHE RICHTUNG!' : 'AUA! ZU SPÄT!');
    const perfekt = this.impactAt - d!.from <= PERFEKT_MS;
    if (perfekt) {
      this.float(W / 2, H - 140, 'PERFEKT!', '#80f0ff');
      this.cameras.main.flash(90, 200, 240, 255);
    } else this.float(W / 2, H - 140, 'AUSGEWICHEN!', '#9ae09a');
    if (k < moves.length - 1) this.later(160, () => this.attack(moves, k + 1, perfektBisher || perfekt));
    else this.later(120, () => this.openUp(perfektBisher || perfekt ? 1 : 0));
  }

  /** Emilian steht offen: jetzt hauen */
  private openUp(bonus: number) {
    const rd = RUNDEN[this.runde];
    this.mode = 'open';
    this.hitsLeft = rd.hits + bonus;
    this.openUntil = this.time.now + rd.open + bonus * 150;
    this.emil.setFrame(EMIL.hurt).setX(EX).setY(EY);
    this.reticle.setVisible(true);
    this.banner.setText(`LEERTASTE HÄMMERN! ${this.hitsLeft}×`).setAlpha(1).setScale(1);
    this.later(rd.open + bonus * 150, () => { if (this.mode === 'open') this.closeOpening(); });
  }

  private closeOpening() {
    this.banner.setText('');
    this.reticle.setVisible(false);
    this.mode = 'idle';
    this.clearTimers();
    this.later(250, () => this.nextCycle());
  }

  /** Bärenumarmung (letzte Runde): Leertaste hämmern, bis der Wirt frei ist */
  private bearHug() {
    this.mode = 'hug';
    this.emil.setFrame(EMIL.hug);
    audio.sfx('growl');
    this.tweens.killTweensOf(this.zone);
    this.zoneLabel.setText('');
    this.zone.clear().setAlpha(1).fillStyle(0xe03030, 0.22).fillRect(0, 0, W, H).lineStyle(4, 0xff4040, 0.8).strokeRect(2, 2, W - 4, H - 4);
    this.showBanner('BÄRENUMARMUNG!', 'Gleich: LEERTASTE hämmern!');
    this.later(1200, () => {
      this.clearZone();
      this.mode = 'mash';
      this.mash = 0;
      this.tweens.add({ targets: this.emil, scale: 1.08, duration: 200 });
      this.cameras.main.shake(HUG_MS, 0.004);
      const box = this.add.container(W / 2, H - 120).setDepth(35);
      box.add(this.add.rectangle(0, 0, 200, 16, 0x1a1210).setStrokeStyle(2, 0xf0c060));
      this.mashFill = this.add.rectangle(-98, 0, 0, 12, 0xf0c060).setOrigin(0, 0.5);
      box.add(this.mashFill);
      box.add(txt(this, 0, -22, 'HÄMMERN!', '#ffffff', 16).setOrigin(0.5).setStroke('#120c0b', 5));
      this.mashBar = box;
      this.later(HUG_MS, () => this.hugEnd(false));
    });
  }

  private mashHit() {
    this.mash++;
    audio.sfx('blip');
    if (this.mashFill) this.mashFill.width = 196 * Math.min(1, this.mash / HUG_NOETIG);
    this.wirt.setX(W / 2 + Phaser.Math.Between(-6, 6));
    if (this.mash >= HUG_NOETIG) this.hugEnd(true);
  }

  private hugEnd(frei: boolean) {
    if (this.mode !== 'mash') return;
    this.clearTimers();
    this.mashBar?.destroy();
    this.mashBar = undefined;
    this.banner.setText('');
    this.bannerSub.setText('');
    this.tweens.add({ targets: this.emil, scale: 1, duration: 150 });
    this.wirt.setX(W / 2);
    if (!frei) return this.hurt('ZERQUETSCHT!');
    this.float(W / 2, H - 140, 'BEFREIT!', '#80f0ff');
    this.cameras.main.flash(120, 255, 240, 200);
    this.openUp(3);
  }

  private hurt(text: string) {
    if (this.mode === 'over') return;
    this.mode = 'hurt';
    this.reticle.setVisible(false);
    this.leben--;
    audio.sfx('slap');
    this.cameras.main.shake(280, 0.016);
    this.cameras.main.flash(120, 255, 60, 60);
    this.wirt.setTint(0xff6060);
    this.time.delayedCall(240, () => this.wirt.clearTint());
    this.float(W / 2, H - 130, text, '#ff8a6a');
    this.herzen.forEach((h, i) => h.setFillStyle(i < this.leben ? 0xf0c060 : 0x3a2a1e));
    if (Math.random() < 0.4) this.crowd(Phaser.Utils.Array.GetRandom(['OOOH!', 'EMILIAN!', 'AUTSCH!']));
    if (this.leben <= 0) return this.lose(false);
    this.later(800, () => this.nextCycle());
  }

  private roundOver() {
    this.clearTimers();
    this.reticle.setVisible(false);
    this.banner.setText('');
    if (this.runde < RUNDEN.length - 1) {
      this.mode = 'cut';
      this.emil.setFrame(EMIL.hurt);
      this.cameras.main.shake(300, 0.01);
      audio.sfx('thud');
      this.later(900, () => this.startRound(this.runde + 1));
      return;
    }
    this.finisher();
  }

  /** K.O.: Zeitlupe, Emilian geht in die Knie, Scheine regnen */
  private finisher() {
    this.mode = 'over';
    this.shine?.remove(false);
    const cam = this.cameras.main;
    cam.zoomTo(1.15, 500);
    this.emil.clearTint().setFrame(EMIL.hurt);
    audio.sfx('slap');
    this.time.delayedCall(500, () => {
      this.emil.setFrame(EMIL.down);
      cam.shake(400, 0.02);
      audio.sfx('thud');
      this.showBanner('K.O.!', 'Emilian ist am Boden.');
      this.banner.setFontSize(32);
      for (let i = 0; i < 26; i++) {
        const b = this.add.image(Phaser.Math.Between(20, W - 20), -10, 'clubBill').setScale(1).setDepth(28).setAngle(Phaser.Math.Between(0, 360));
        this.tweens.add({ targets: b, y: H + 10, angle: b.angle + 360, duration: Phaser.Math.Between(1400, 2400), delay: i * 60, onComplete: () => b.destroy() });
      }
      this.crowd('HORST! HORST! HORST!');
      audio.sfx('kaching');
    });
    this.time.delayedCall(2600, () => { cam.zoomTo(1, 300); this.banner.setFontSize(16); this.endBox = this.box(true); });
  }

  private lose(aufgegeben: boolean) {
    if (this.mode === 'over') return;
    this.mode = 'over';
    this.clearTimers();
    this.mashBar?.destroy();
    this.mashBar = undefined;
    this.clearZone();
    this.hint.setText('');
    this.reticle.setVisible(false);
    this.emil.setFrame(EMIL.flex);
    this.tweens.add({ targets: this.wirt, y: H + 160, angle: -20, duration: 600, ease: 'Quad.easeIn' });
    this.showBanner(aufgegeben ? 'AUFGEGEBEN' : 'DU BIST K.O.', 'Emilian posiert. Das Publikum seufzt.');
    audio.sfx('refuse');
    this.time.delayedCall(1200, () => { this.endBox = this.box(false); });
  }

  private box(win: boolean) {
    const box = this.add.container(W / 2, H / 2 + 10).setDepth(50);
    box.add(this.add.rectangle(0, 0, 290, 104, 0x1a1210, 0.96).setStrokeStyle(2, 0xd8b050));
    box.add(txt(this, 0, -30, win ? 'GEWONNEN!' : `${RUNDEN[this.runde].titel} verloren`, win ? '#f0c060' : '#ff8a6a', 16).setOrigin(0.5));
    box.add(txt(this, 0, -6, win ? 'Emilian weint ein bisschen. In Tarnfarbe.' : 'Du machst in dieser Runde weiter.', '#d8c8b0').setOrigin(0.5));
    if (win) {
      box.add(new Btn(this, 0, 28, 140, 20, 'WEITER', 0xa8342a, () => this.close(true)).box);
      this.primary = () => this.close(true);
    } else {
      box.add(new Btn(this, -70, 28, 120, 20, 'NOCHMAL', 0xa8342a, () => this.retry()).box);
      box.add(new Btn(this, 70, 28, 120, 20, 'AUFHÖREN', 0x3a3040, () => this.close(false)).box);
      this.primary = () => this.retry();
    }
    return box;
  }

  /** nach einer Niederlage: volle Bierdeckel, weiter in der aktuellen Runde */
  private retry() {
    this.endBox?.destroy();
    this.endBox = undefined;
    this.primary = null;
    this.leben = LEBEN;
    this.herzen.forEach((h) => h.setFillStyle(0xf0c060));
    this.tweens.killTweensOf(this.wirt);
    this.wirt.setPosition(W / 2, H + 40).setAngle(0).setScale(3.2);
    this.dodge = null;
    this.startRound(this.runde);
  }

  // ---------------------------------------------------------------- Effekte

  private clearZone() {
    this.tweens.killTweensOf(this.zone);
    this.zone.clear();
    this.zoneLabel.setText('');
  }

  private drawZone(move: Move) {
    const g = this.zone;
    const lx = move === 'links' ? W / 4 - 10 : move === 'rechts' ? (W * 3) / 4 + 10 : W / 2;
    const ly = move === 'stampf' ? H - 27 : move === 'oel' ? H - 127 : 110;
    this.zoneLabel.setPosition(lx, ly);
    this.tweens.killTweensOf(g);
    g.clear().setAlpha(1).fillStyle(0xe03030, 0.32).lineStyle(3, 0xff4040, 0.9);
    if (move === 'links') { g.fillRect(0, 50, W / 2 - 10, H - 50); g.strokeRect(2, 52, W / 2 - 14, H - 54); }
    else if (move === 'rechts') { g.fillRect(W / 2 + 10, 50, W / 2 - 10, H - 50); g.strokeRect(W / 2 + 12, 52, W / 2 - 14, H - 54); }
    else if (move === 'stampf') { g.fillRect(0, H - 54, W, 54); g.strokeRect(2, H - 52, W - 4, 50); }
    else { g.fillRect(0, H - 150, W, 46); g.strokeRect(2, H - 148, W - 4, 42); }
    this.tweens.add({ targets: g, alpha: 0.45, duration: 180, yoyo: true, repeat: -1 });
  }

  private showBanner(t: string, sub: string) {
    this.banner.setText(t).setAlpha(1).setScale(1.6);
    this.bannerSub.setText(sub).setAlpha(1);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.later(1900, () => { this.tweens.add({ targets: [this.banner, this.bannerSub], alpha: 0, duration: 300 }); });
  }

  private float(x: number, y: number, s: string, color: string) {
    const t = txt(this, x, y, s, color).setOrigin(0.5).setDepth(25).setStroke('#120c0b', 4);
    this.tweens.add({ targets: t, y: y - 20, alpha: 0, duration: 850, onComplete: () => t.destroy() });
  }

  private crowd(s: string) {
    const t = txt(this, Phaser.Math.Between(70, W - 70), H - 40, s, '#ffd0f0').setOrigin(0.5).setDepth(18).setStroke('#120c0b', 3);
    this.tweens.add({ targets: t, y: t.y - 26, alpha: 0, duration: 1300, onComplete: () => t.destroy() });
  }

  private spark(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const s = this.add.rectangle(x, y, 3, 3, i % 2 ? 0xffffff : 0xf0c060).setDepth(24);
      const a = (i / 6) * Math.PI * 2;
      this.tweens.add({ targets: s, x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 18, alpha: 0, duration: 260, onComplete: () => s.destroy() });
    }
  }

  private whoosh(x: number, y: number) {
    for (let i = 0; i < 3; i++) {
      const l = this.add.rectangle(x, y - 20 + i * 18, 90, 3, 0xffffff, 0.8).setDepth(12);
      this.tweens.add({ targets: l, width: 10, alpha: 0, duration: 200, delay: i * 30, onComplete: () => l.destroy() });
    }
  }

  /** Ölglanz: kleine Lichtfunken auf Brust, Schultern und Armen */
  private glint() {
    if (this.mode === 'over') return;
    const x = EX + Phaser.Math.Between(-60, 60), y = EY - Phaser.Math.Between(90, 170);
    const s = this.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(0.05).setTint(0xfff4e0).setAlpha(0.9).setDepth(6);
    this.tweens.add({ targets: s, scale: 0.12, alpha: 0, duration: 380, onComplete: () => s.destroy() });
  }

  private updateBars() {
    RUNDEN.forEach((rd, i) => {
      this.segs[i].width = i < this.runde ? 0 : i > this.runde ? 98 : (98 * Math.max(0, this.hp)) / rd.hp;
    });
  }

  private close(win: boolean) {
    state.running = this.wasRunning;
    audio.music('club');
    const { resume, onDone } = this.cfg;
    this.scene.resume(resume);
    this.scene.stop();
    onDone?.(win);
  }
}
