import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { isTouchDevice } from '../touch';
import { H, W, txt } from '../ui';
import { Btn } from '../scenes/ShopScene';
import { ChartNote, KELLER_BPM, SONG_BARS, STEP_S, abschnittBei, baueChart } from '../music/kellerSong';
import { NF } from './kellerGfx';

// Gitarrenduell gegen Nick: Noten rollen über ein Griffbrett in Perspektive auf vier Ringe zu. Treffen, wenn sie
// über dem Ring sind (D F J K, Pfeile oder Antippen), lange Noten halten. Nicks Teile spielt Nick selbst, da hört
// man zu. Wer am Ende mehr Punkte hat als Nick, gewinnt. Nach jeder Niederlage spielt Nick etwas schwächer.
// Die Uhr ist die Audio-Uhr: Musik und Noten laufen immer gleich, auch nach einer Pause.
// Modus „jam“: dasselbe mit dem cleanen Nick, ohne Verlieren, die beste Punktzahl wird gemerkt.

export interface GitarrenData {
  resume: string;
  mode: 'duell' | 'jam';
  onDone?: (win: boolean) => void;
}

const LANE_COL = [0x3ad05a, 0xe83a3a, 0xf0d030, 0x3a8af0];
const LANE_CSS = ['#5ae07a', '#ff6a6a', '#ffe060', '#6ab0ff'];
const KEYS = [['D', 'LEFT', 'ONE'], ['F', 'DOWN', 'TWO'], ['J', 'UP', 'THREE'], ['K', 'RIGHT', 'FOUR']];
const KEY_LABEL = ['D', 'F', 'J', 'K'];
/** Zeitfenster (Sekunden) */
const PERFEKT = 0.055, GUT = 0.12;
/** so lange vorher sieht man eine Note kommen */
const VOR = 1.55;
const CX = W / 2, TOPY = 34, HITY = 222, LANE_W = 46;
const SONG_LEN = (SONG_BARS + 1) * 16 * STEP_S;
const BEAT = 60 / KELLER_BPM;

interface Note extends ChartNote {
  hit: boolean;
  miss: boolean;
  /** Haltenote: läuft gerade / fertig */
  halten: boolean;
  bisT: number;
}

/** Perspektive: z = 0 am Ring, 1 ganz hinten */
function proj(z: number) {
  const s = (1 / (1 + 2.4 * z) - 1 / 3.4) / (1 - 1 / 3.4);
  return { s, y: TOPY + (HITY - TOPY) * s };
}
const laneX = (lane: number, s: number) => CX + (lane - 1.5) * LANE_W * (0.32 + 0.68 * s);

export class GitarrenDuellScene extends Phaser.Scene {
  private cfg!: GitarrenData;
  private notes: Note[] = [];
  private g!: Phaser.GameObjects.Graphics;
  private start = 0;
  /** ohne Audio (stumm geschaltet, kein Ton erlaubt): Uhr des Browsers */
  private ohneTon = false;
  private laeuft = false;
  private pausiert = false;
  private fertig = false;
  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private treffer = 0;
  private gespielt = 0;
  private menge = 0;
  private nickZiel = 0;
  private gedrueckt = [false, false, false, false];
  private druckT = [0, 0, 0, 0];
  private halt: (Note | null)[] = [null, null, null, null];
  private nick!: Phaser.GameObjects.Image;
  private horst!: Phaser.GameObjects.Container;
  private scoreT!: Phaser.GameObjects.Text;
  private nickT!: Phaser.GameObjects.Text;
  private multT!: Phaser.GameObjects.Text;
  private comboT!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private teilT!: Phaser.GameObjects.Text;
  private abschnitt = '';
  private fehlerReihe = 0;
  private flammen: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private publikum: Phaser.GameObjects.Rectangle[] = [];
  private stimmung = 0.5;
  private stimmungBar!: Phaser.GameObjects.Rectangle;
  private letzterBeat = -1;
  private pauseBox?: Phaser.GameObjects.Container;
  private endBox?: Phaser.GameObjects.Container;
  private primary: (() => void) | null = null;
  private wasRunning = false;
  /** Niederlagen in Folge: Nick spielt danach schwächer */
  private static niederlagen = 0;

  constructor() {
    super('GitarrenDuell');
  }

  private get jam() { return this.cfg.mode === 'jam'; }

  create(data: GitarrenData) {
    this.cfg = data;
    this.wasRunning = state.running;
    state.running = false;
    this.laeuft = false;
    this.pausiert = false;
    this.fertig = false;
    this.endBox = undefined;
    this.pauseBox = undefined;
    this.primary = null;
    this.flammen = [];
    this.publikum = [];
    this.scene.bringToTop();
    audio.music('none');

    // Bühne: Kellerkulisse, abgedunkelt; das Griffbrett liegt in der Mitte
    this.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0);
    this.add.image(0, 0, 'csKeller').setOrigin(0).setAlpha(0.75);
    this.add.rectangle(0, 0, W, H, 0x000000, 0.35).setOrigin(0);
    for (const [x, tint] of [[80, 0xff2018], [400, 0xff2018], [240, 0xff6040]] as const) {
      const l = this.add.image(x, 70, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2.2).setTint(this.jam && x === 240 ? 0xfff0c0 : tint).setAlpha(0.3);
      this.tweens.add({ targets: l, alpha: 0.12, duration: BEAT * 1000, yoyo: true, repeat: -1 });
    }
    // Publikum: Köpfe vorne am Bildrand
    for (let i = 0; i < 24; i++) {
      const x = 8 + i * 20 + (i % 3) * 3, y = H - 6 - (i % 2) * 5;
      if (x > CX - 130 && x < CX + 130) continue;
      this.publikum.push(this.add.rectangle(x, y, 13, 22, 0x050306).setOrigin(0.5, 1).setDepth(4));
      this.add.circle(x, y - 24, 6, 0x050306).setDepth(4);
    }

    // Nick links, der Wirt rechts
    this.nick = this.add.image(68, H - 4, this.jam ? 'nickWeissBig' : 'nickBig', NF.idle).setOrigin(0.5, 1).setScale(0.5).setDepth(3);
    this.add.image(68, H - 2, 'shadow').setScale(2.5, 1.5).setAlpha(0.5).setDepth(2);
    this.horst = this.add.container(W - 66, H - 4).setDepth(3);
    this.horst.add([this.add.image(0, 0, 'bustWirt').setOrigin(0.5, 1).setScale(0.56), this.add.image(-4, -30, 'horstGit').setScale(0.85).setAngle(-24)]);
    txt(this, 68, H - 128, this.jam ? 'NICK (CLEAN)' : 'NICK', this.jam ? '#f4f0e0' : '#ff6a5a').setOrigin(0.5).setDepth(5).setStroke('#120c0b', 3);
    txt(this, W - 66, H - 128, 'DU', '#f8e070').setOrigin(0.5).setDepth(5).setStroke('#120c0b', 3);

    this.g = this.add.graphics().setDepth(6);
    // Flammen an den Seiten des Griffbretts ab 10er-Combo
    for (const side of [-1, 1]) {
      const em = this.add.particles(CX + side * (LANE_W * 2 + 6), HITY + 4, 'light', {
        lifespan: 520, speedY: { min: -120, max: -70 }, speedX: { min: -12, max: 12 }, scale: { start: 0.16, end: 0 },
        alpha: { start: 0.8, end: 0 }, tint: [0xff3010, 0xffa020, 0xff6010], blendMode: 'ADD', frequency: 40, emitting: false,
      }).setDepth(7);
      this.flammen.push(em);
    }

    // Anzeigen
    this.scoreT = txt(this, W - 14, 10, '0', '#f8e070', 16).setOrigin(1, 0).setDepth(10).setStroke('#120c0b', 4);
    txt(this, W - 14, 30, 'DEINE PUNKTE', '#a89878').setOrigin(1, 0).setDepth(10);
    this.nickT = txt(this, 14, 10, '0', this.jam ? '#f4f0e0' : '#ff6a5a', 16).setDepth(10).setStroke('#120c0b', 4);
    txt(this, 14, 30, this.jam ? 'NICK SPIELT MIT' : 'NICKS PUNKTE', '#a89878').setDepth(10);
    this.multT = txt(this, CX + LANE_W * 2 + 14, HITY - 34, '', '#ffb040', 16).setDepth(10).setStroke('#120c0b', 4);
    this.comboT = txt(this, CX + LANE_W * 2 + 14, HITY - 14, '', '#d8c8b0').setDepth(10).setStroke('#120c0b', 3);
    this.banner = txt(this, CX, 96, '', '#ffffff', 16).setOrigin(0.5).setDepth(12).setStroke('#3a0808', 6).setAlpha(0);
    this.teilT = txt(this, CX, 6, '', '#c97a4a').setOrigin(0.5, 0).setDepth(10);
    // Stimmung im Publikum
    this.add.rectangle(CX, H - 10, 160, 5, 0x1a1210).setDepth(10).setStrokeStyle(1, 0x5a4430);
    this.stimmungBar = this.add.rectangle(CX - 80, H - 10, 80, 5, 0xff6020).setOrigin(0, 0.5).setDepth(10);
    txt(this, CX, H - 22, 'PUBLIKUM', '#6a5a4a').setOrigin(0.5).setDepth(10);

    this.controls();
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.versteckt, this);
    this.events.on(Phaser.Scenes.Events.PAUSE, () => audio.anhalten());
    this.events.on(Phaser.Scenes.Events.RESUME, () => { if (!this.pausiert) audio.weiter(); });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.versteckt, this);
      audio.weiter();
    });

    this.intro();
  }

  // ---------------------------------------------------------------- Ablauf

  private intro() {
    const box = this.add.container(CX, H / 2).setDepth(30);
    const touch = isTouchDevice(this);
    box.add(this.add.rectangle(0, 0, 330, 150, 0x120a0c, 0.96).setStrokeStyle(2, this.jam ? 0xd8b850 : 0xc02020));
    box.add(txt(this, 0, -58, this.jam ? 'JAM-SESSION MIT NICK' : 'GITARRENDUELL', this.jam ? '#f0d070' : '#ff5040', 16).setOrigin(0.5));
    const regeln = [
      touch ? '1. Tipp unten auf die Spur, wenn die Note über dem Ring ist.' : '1. D F J K drücken, wenn die Note über dem Ring ist.',
      '2. Lange Noten gedrückt halten.',
      this.jam ? '3. Kein Verlieren. Einfach spielen. Nick freut sich.' : '3. Wenn Nick vorspielt: zuhören. Danach bist du dran.',
      this.jam ? '' : '4. Am Ende mehr Punkte als Nick? Gewonnen.',
    ].filter(Boolean);
    regeln.forEach((r, i) => box.add(txt(this, -150, -34 + i * 15, r, '#d8c8b0').setWordWrapWidth(300)));
    if (!this.jam && GitarrenDuellScene.niederlagen) box.add(txt(this, 0, 32, `Nick ist müde: Er spielt ${GitarrenDuellScene.niederlagen * 5} % schwächer.`, '#9ae09a').setOrigin(0.5));
    const go = new Btn(this, 0, 56, 150, 20, touch ? 'LOS (TIPPEN)' : 'LOS (LEERTASTE)', 0xa8342a, () => this.los());
    box.add(go.box);
    this.primary = () => this.los();
    this.endBox = box;
  }

  private los() {
    this.endBox?.destroy();
    this.endBox = undefined;
    this.primary = null;
    audio.unlock();
    this.notes = baueChart().map((n) => ({ ...n, hit: false, miss: false, halten: false, bisT: n.t + n.hold }));
    const spieler = this.notes.filter((n) => !n.nick);
    this.menge = spieler.length;
    // Nicks Wert: so viel wie ein Spieler, der knapp zwei Drittel der Noten trifft (nach Niederlagen weniger)
    const basis = spieler.reduce((s, n) => s + 100 + Math.round(n.hold * 200), 0);
    this.nickZiel = Math.round((basis * Math.max(0.42, 0.62 - GitarrenDuellScene.niederlagen * 0.05)) / 10) * 10;
    this.score = 0; this.combo = 0; this.maxCombo = 0; this.treffer = 0; this.gespielt = 0; this.fehlerReihe = 0;
    this.stimmung = 0.5;
    this.halt = [null, null, null, null];
    this.abschnitt = '';
    this.letzterBeat = -1;
    const t0 = audio.startSong('duell');
    this.ohneTon = t0 === null;
    this.start = t0 ?? performance.now() / 1000 + 0.3;
    this.laeuft = true;
    this.fertig = false;
  }

  /** Songzeit in Sekunden (Audio-Uhr, abzüglich Ausgabelatenz) */
  private jetzt() {
    if (this.ohneTon) return performance.now() / 1000 - this.start;
    return audio.now() - this.start - audio.latenz();
  }

  update(_t: number, delta: number) {
    this.g.clear();
    if (!this.laeuft) { this.zeichneBrett(0); return; }
    if (this.pausiert) { this.zeichneBrett(this.letztesT); this.zeichneNoten(this.letztesT); return; }
    const t = this.jetzt();
    this.letztesT = t;
    this.zeichneBrett(t);
    this.pruefe(t, delta);
    this.zeichneNoten(t);
    this.takt(t);
    if (!this.fertig && t > SONG_LEN + 0.6) this.ende();
  }
  private letztesT = 0;

  private pruefe(t: number, delta: number) {
    for (const n of this.notes) {
      if (n.hit || n.miss) continue;
      if (n.t > t + 0.05) break;
      if (n.nick) {
        // Nick spielt seine Töne selbst
        if (t >= n.t) { n.hit = true; this.funken(n.lane, true); }
        continue;
      }
      if (t > n.t + GUT) {
        n.miss = true;
        this.gespielt++;
        this.daneben();
      }
    }
    // Haltenoten: Punkte, solange gedrückt
    for (let l = 0; l < 4; l++) {
      const h = this.halt[l];
      if (!h) continue;
      if (!this.gedrueckt[l]) { this.halt[l] = null; h.halten = false; continue; }
      const ende = Math.min(t, h.bisT);
      const add = Math.round((delta / 1000) * 200 * this.mult());
      this.score += add;
      if (ende >= h.bisT) { this.halt[l] = null; h.halten = false; this.funken(l, false, true); }
      else if (Math.random() < 0.3) this.funken(l, false);
    }
    this.scoreT.setText(this.score.toLocaleString('de-DE'));
    const fort = this.menge ? Math.min(1, this.notes.filter((n) => !n.nick && n.t <= t).length / this.menge) : 0;
    this.nickT.setText(this.jam ? '♪' : Math.round(this.nickZiel * fort).toLocaleString('de-DE'));
    const m = this.mult();
    this.multT.setText(m > 1 ? `×${m}` : '').setColor(['#ffffff', '#ffffff', '#ffb040', '#ff7020', '#ff3010'][m]);
    this.comboT.setText(this.combo >= 5 ? `${this.combo} COMBO` : '');
    for (const f of this.flammen) f.emitting = this.combo >= 10;
    this.stimmungBar.width = 160 * Phaser.Math.Clamp(this.stimmung, 0.02, 1);
    this.stimmungBar.setFillStyle(this.stimmung > 0.66 ? 0x7ae05a : this.stimmung > 0.33 ? 0xffa020 : 0xe83a3a);
  }

  private mult() { return Math.min(4, 1 + Math.floor(this.combo / 10)); }

  private druck(lane: number) {
    if (this.pausiert) return;
    if (!this.laeuft) return;
    this.gedrueckt[lane] = true;
    this.druckT[lane] = this.time.now;
    const t = this.jetzt();
    const teil = abschnittBei(Math.floor(t / (16 * STEP_S)));
    let best: Note | undefined, bd = Infinity;
    for (const n of this.notes) {
      if (n.t > t + GUT) break;
      if (n.nick || n.hit || n.miss || n.lane !== lane) continue;
      const d = Math.abs(n.t - t);
      if (d <= GUT && d < bd) { bd = d; best = n; }
    }
    if (!best) {
      // ins Leere geschlagen: nur ein Kratzer, die Combo bleibt (außer während Nick spielt: dann gar nichts)
      if (teil.chart !== 'nick') audio.sfx('patzer');
      return;
    }
    best.hit = true;
    this.gespielt++;
    this.treffer++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.fehlerReihe = 0;
    const perfekt = bd <= PERFEKT;
    this.score += (perfekt ? 100 : 60) * this.mult();
    this.stimmung = Math.min(1, this.stimmung + 0.018);
    this.funken(lane, false, perfekt);
    this.wertung(lane, perfekt ? 'PERFEKT' : 'GUT', perfekt ? '#fff0a0' : '#c8e0ff');
    if (best.hold > 0) { best.halten = true; this.halt[lane] = best; }
    if (this.combo === 25 || this.combo === 50 || this.combo === 100) this.jubel();
    if (!this.jam && this.combo === 30) this.nickSagt(['Was ...?', 'Glück!', 'Das hab ICH dir beigebracht!', 'Hör auf. HÖR AUF.'][Math.floor(Math.random() * 4)], true);
  }

  private los_(lane: number) {
    this.gedrueckt[lane] = false;
  }

  private daneben() {
    if (this.combo >= 10) audio.sfx('patzer');
    this.combo = 0;
    this.fehlerReihe++;
    this.stimmung = Math.max(0, this.stimmung - 0.05);
    if (this.fehlerReihe === 4) {
      this.nickSagt(this.jam ? ['Locker bleiben, Herr Wirt.', 'Atmen. Einfach atmen.'][Math.floor(Math.random() * 2)] : ['HAHAHA!', 'Opa spielt Blockflöte!', 'Zapfhahn-Finger!', 'Das war ein G? DAS?'][Math.floor(Math.random() * 4)]);
      const b = this.publikum[Math.floor(Math.random() * this.publikum.length)];
      if (b && !this.jam) this.schwebe(b.x, b.y - 40, 'BUUH!', '#c07060');
    }
  }

  // ---------------------------------------------------------------- Takt, Abschnitte, Figuren

  private takt(t: number) {
    const beat = Math.floor(t / BEAT);
    const bar = Math.floor(t / (16 * STEP_S));
    const teil = abschnittBei(Math.max(0, bar));
    if (teil.name !== this.abschnitt && t >= 0) {
      this.abschnitt = teil.name;
      this.teilT.setText(teil.name);
      const msg = teil.chart === 'nick' ? (this.jam ? 'NICK SPIELT – ZUHÖREN' : 'NICK LEGT VOR – ZUHÖREN!') : teil.name === 'DEIN SOLO' ? 'DEIN SOLO!' : teil.name === 'SOLO-DUELL' ? 'IM WECHSEL!' : teil.name === 'BREAKDOWN' ? 'BREAKDOWN!' : teil.von === 4 ? 'DU BIST DRAN!' : '';
      if (msg) this.zeigeBanner(msg);
    }
    if (beat === this.letzterBeat) return;
    this.letzterBeat = beat;
    // Nick: shreddet beim Vorspielen, sonst Kopfnicken im Takt
    const nickSpielt = teil.chart === 'nick' || this.notes.some((n) => n.nick && Math.abs(n.t - t) < BEAT);
    let f: string;
    if (nickSpielt) f = beat % 2 ? 'shred1' : 'shred2';
    else if (this.jam) f = beat % 4 === 0 ? 'schnoesel' : beat % 2 ? 'shred2' : 'idle';
    else f = beat % 8 === 0 ? 'horns' : beat % 2 ? 'bang' : 'idle';
    this.nick.setFrame(NF[f]);
    this.tweens.add({ targets: this.nick, y: H - 2, duration: BEAT * 300, yoyo: true });
    this.tweens.add({ targets: this.horst, y: H - 2, duration: BEAT * 300, yoyo: true });
    // Publikum springt bei guter Stimmung
    if (this.stimmung > 0.5) this.publikum.forEach((p, i) => { if ((i + beat) % 2 === 0) this.tweens.add({ targets: p, y: p.y - 3 * this.stimmung, duration: BEAT * 250, yoyo: true }); });
  }

  private zeigeBanner(s: string) {
    this.banner.setText(s).setAlpha(1).setScale(1.6);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 1500, duration: 400 });
  }

  private nickSagt(s: string, wut = false) {
    if (wut) this.nick.setFrame(NF.rage);
    this.schwebe(this.nick.x + 10, H - 128, s, this.jam ? '#f4f0e0' : '#ff8a7a');
  }

  private schwebe(x: number, y: number, s: string, color: string) {
    const t = txt(this, x, y, s, color).setOrigin(0.5).setDepth(14).setStroke('#120c0b', 3);
    this.tweens.add({ targets: t, y: y - 16, alpha: 0, delay: 700, duration: 700, onComplete: () => t.destroy() });
  }

  private wertung(lane: number, s: string, color: string) {
    const t = txt(this, laneX(lane, 1), HITY - 26, s, color).setOrigin(0.5).setDepth(13).setStroke('#120c0b', 3).setScale(0.8);
    this.tweens.add({ targets: t, y: HITY - 40, alpha: 0, scale: 1, duration: 420, onComplete: () => t.destroy() });
  }

  private funken(lane: number, nick: boolean, gross = false) {
    const x = laneX(lane, 1);
    const n = gross ? 10 : nick ? 4 : 6;
    for (let i = 0; i < n; i++) {
      const s = this.add.image(x, HITY, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(nick ? 0xff3020 : LANE_COL[lane]).setScale(0.06).setDepth(9);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = 18 + Math.random() * (gross ? 40 : 24);
      this.tweens.add({ targets: s, x: x + Math.cos(a) * v, y: HITY + Math.sin(a) * v, alpha: 0, scale: 0.02, duration: 300 + Math.random() * 200, onComplete: () => s.destroy() });
    }
    if (gross) {
      const ring = this.add.circle(x, HITY, 10, LANE_COL[lane], 0).setStrokeStyle(2, LANE_COL[lane]).setDepth(9);
      this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
    }
  }

  private jubel() {
    this.zeigeBanner(this.combo >= 100 ? 'HÖLLISCH GUT!' : this.combo >= 50 ? 'TEUFLISCH GUT!' : 'DAS PUBLIKUM TOBT!');
    this.cameras.main.shake(260, 0.006);
    for (const x of [24, W - 24]) {
      const em = this.add.particles(x, H, 'light', {
        lifespan: 900, speedY: { min: -260, max: -160 }, speedX: { min: -20, max: 20 }, scale: { start: 0.35, end: 0 },
        alpha: { start: 0.9, end: 0 }, tint: [0xff4010, 0xffb020], blendMode: 'ADD', emitting: false,
      }).setDepth(8);
      em.explode(40);
      this.time.delayedCall(1200, () => em.destroy());
    }
  }

  // ---------------------------------------------------------------- Zeichnen

  private zeichneBrett(t: number) {
    const g = this.g;
    const top = proj(1), bot = proj(0);
    const wTop = LANE_W * 2 * (0.32 + 0.68 * top.s), wBot = LANE_W * 2 * (0.32 + 0.68 * bot.s) + 8;
    g.fillStyle(0x0c0808, 0.92).fillPoints([{ x: CX - wTop, y: top.y }, { x: CX + wTop, y: top.y }, { x: CX + wBot, y: HITY + 18 }, { x: CX - wBot, y: HITY + 18 }], true);
    // Spurtrenner
    for (let l = 0; l <= 4; l++) {
      const xt = CX + (l - 2) * LANE_W * (0.32 + 0.68 * top.s), xb = CX + (l - 2) * LANE_W + (l - 2) * 2;
      g.lineStyle(l === 0 || l === 4 ? 2 : 1, l === 0 || l === 4 ? 0xa01818 : 0x3a2a2a, l === 0 || l === 4 ? 0.9 : 0.7).lineBetween(xt, top.y, xb, HITY + 18);
    }
    // Bundstäbchen im Takt: wandern auf den Wirt zu
    const b0 = Math.ceil(t / BEAT);
    for (let k = b0; k < b0 + 8; k++) {
      const z = (k * BEAT - t) / VOR;
      if (z < 0 || z > 1) continue;
      const p = proj(z), w = LANE_W * 2 * (0.32 + 0.68 * p.s);
      g.lineStyle(k % 4 === 0 ? 2 : 1, 0x5a4440, (1 - z) * (k % 4 === 0 ? 0.8 : 0.45)).lineBetween(CX - w, p.y, CX + w, p.y);
    }
    // Ringe
    for (let l = 0; l < 4; l++) {
      const x = laneX(l, 1);
      const an = this.gedrueckt[l] || this.time.now - this.druckT[l] < 90;
      g.fillStyle(LANE_COL[l], an ? 0.55 : 0.12).fillEllipse(x, HITY, 34, 16);
      g.lineStyle(2, LANE_COL[l], an ? 1 : 0.75).strokeEllipse(x, HITY, 34, 16);
    }
  }

  private zeichneNoten(t: number) {
    const g = this.g;
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      if (n.t - t > VOR || n.bisT < t - 0.2) continue;
      if (n.hit && !n.halten && n.hold === 0) continue;
      const col = n.nick ? 0x8a1010 : LANE_COL[n.lane];
      // Schweif der Haltenote
      if (n.hold > 0 && !n.miss) {
        const z0 = Math.max(0, (Math.max(n.t, n.halten ? t : n.t) - t) / VOR), z1 = Math.min(1, (n.bisT - t) / VOR);
        if (z1 > z0 && !(n.hit && !n.halten)) {
          const pts: Phaser.Types.Math.Vector2Like[] = [];
          const steps = 8;
          for (let k = 0; k <= steps; k++) { const p = proj(z0 + ((z1 - z0) * k) / steps); pts.push({ x: laneX(n.lane, p.s) - 4 * (0.4 + p.s), y: p.y }); }
          for (let k = steps; k >= 0; k--) { const p = proj(z0 + ((z1 - z0) * k) / steps); pts.push({ x: laneX(n.lane, p.s) + 4 * (0.4 + p.s), y: p.y }); }
          g.fillStyle(col, n.halten ? 0.95 : 0.6).fillPoints(pts, true);
        }
      }
      if (n.hit) continue;
      const z = (n.t - t) / VOR;
      if (z < -0.12) continue;
      const p = proj(Math.max(0, z));
      const x = laneX(n.lane, p.s), y = z < 0 ? HITY - z * 140 : p.y;
      const sz = 0.35 + 0.65 * p.s;
      const alpha = n.miss ? 0.3 : Math.min(1, (1 - z) * 2.5);
      g.fillStyle(0x000000, alpha * 0.6).fillEllipse(x, y + 2 * sz, 32 * sz, 15 * sz);
      g.fillStyle(n.miss ? 0x4a4a4a : col, alpha).fillEllipse(x, y, 30 * sz, 14 * sz);
      g.fillStyle(0xffffff, alpha * (n.nick ? 0.25 : 0.55)).fillEllipse(x, y - 2 * sz, 16 * sz, 5 * sz);
      if (n.nick) g.lineStyle(1, 0xff4020, alpha).strokeEllipse(x, y, 30 * sz, 14 * sz);
    }
  }

  // ---------------------------------------------------------------- Eingabe

  private controls() {
    const kb = this.input.keyboard!;
    KEYS.forEach((keys, lane) => {
      for (const k of keys) {
        kb.on(`keydown-${k}`, (e: KeyboardEvent) => { if (!e.repeat) this.druck(lane); });
        kb.on(`keyup-${k}`, () => this.los_(lane));
      }
    });
    for (const k of ['SPACE', 'ENTER']) kb.on(`keydown-${k}`, () => this.primary?.());
    kb.on('keydown-ESC', () => {
      if (this.endBox) return;
      if (this.jam && this.laeuft) return this.ende();
      this.pause(!this.pausiert);
    });
    // Tippen: untere Bildhälfte über dem Griffbrett, je Spur ein Streifen
    if (this.input.manager.pointersTotal < 4) this.input.addPointer(3);
    const spur = (x: number) => Math.max(0, Math.min(3, Math.floor((x - (CX - LANE_W * 2)) / LANE_W)));
    const aktiv = new Map<number, number>();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.endBox || this.pauseBox || p.y < HITY - 90 || Math.abs(p.x - CX) > LANE_W * 2 + 30) return;
      const l = spur(p.x);
      aktiv.set(p.id, l);
      this.druck(l);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const l = aktiv.get(p.id);
      if (l === undefined) return;
      aktiv.delete(p.id);
      this.los_(l);
    });
    // Tasten-/Tippflächen beschriften
    const touch = isTouchDevice(this);
    for (let l = 0; l < 4; l++) {
      txt(this, laneX(l, 1), HITY + 12, touch ? '▲' : KEY_LABEL[l], LANE_CSS[l]).setOrigin(0.5, 0).setDepth(10).setAlpha(0.8);
    }
  }

  private versteckt() {
    if (this.laeuft && !this.fertig && !this.pausiert) this.pause(true);
  }

  private pause(an: boolean) {
    if (!this.laeuft || this.fertig) return;
    this.pausiert = an;
    if (an) {
      audio.anhalten();
      const box = this.add.container(CX, H / 2).setDepth(40);
      box.add(this.add.rectangle(0, 0, 240, 96, 0x120a0c, 0.96).setStrokeStyle(2, 0xc02020));
      box.add(txt(this, 0, -30, 'PAUSE', '#ff6a5a', 16).setOrigin(0.5));
      const weiter = new Btn(this, -58, 16, 100, 20, 'WEITER', 0xa8342a, () => this.pause(false));
      const stop = new Btn(this, 58, 16, 100, 20, 'AUFGEBEN', 0x3a3040, () => { this.pauseBox?.destroy(); this.pauseBox = undefined; this.pausiert = false; audio.weiter(); audio.music('none'); this.close(false); });
      box.add([weiter.box, stop.box]);
      this.pauseBox = box;
      this.primary = () => this.pause(false);
    } else {
      this.pauseBox?.destroy();
      this.pauseBox = undefined;
      this.primary = null;
      this.gedrueckt = [false, false, false, false];
      audio.weiter();
    }
  }

  // ---------------------------------------------------------------- Ende

  private ende() {
    if (this.fertig) return;
    this.fertig = true;
    this.laeuft = false;
    audio.music('none');
    const quote = this.gespielt ? Math.round((this.treffer / Math.max(1, this.gespielt)) * 100) : 0;
    const win = this.jam || this.score > this.nickZiel;
    if (!this.jam) GitarrenDuellScene.niederlagen = win ? 0 : Math.min(4, GitarrenDuellScene.niederlagen + 1);
    let rekord = false;
    if (this.jam && this.score > (state.flags.nickJam ?? 0)) { state.flags.nickJam = this.score; rekord = true; }
    audio.sfx(win ? 'kaching' : 'refuse');
    if (win && !this.jam) { this.nick.setFrame(NF.rage); this.cameras.main.shake(500, 0.01); }
    const box = this.add.container(CX, H / 2).setDepth(40);
    box.add(this.add.rectangle(0, 0, 300, 140, 0x120a0c, 0.96).setStrokeStyle(2, win ? 0xf0c060 : 0xc02020));
    box.add(txt(this, 0, -50, this.jam ? (rekord ? 'NEUER REKORD!' : 'GUTE SESSION!') : win ? 'GEWONNEN!' : 'NICK GEWINNT', win ? '#f0c060' : '#ff6a5a', 16).setOrigin(0.5));
    box.add(txt(this, 0, -24, `Du: ${this.score.toLocaleString('de-DE')}   ${this.jam ? `Rekord: ${(state.flags.nickJam ?? 0).toLocaleString('de-DE')}` : `Nick: ${this.nickZiel.toLocaleString('de-DE')}`}`, '#d8c8b0').setOrigin(0.5));
    box.add(txt(this, 0, -8, `Getroffen: ${quote} %   Beste Combo: ${this.maxCombo}`, '#a89878').setOrigin(0.5));
    box.add(txt(this, 0, 10, this.jam ? 'Nick: „Das war schön. Wirklich. Ich hab fast geweint.“' : win ? 'Nick starrt auf seine Finger. Sie zittern.' : 'Nick: „Die Nebelmaschine wartet, Opa.“', '#c8b8a0').setOrigin(0.5).setWordWrapWidth(280));
    if (win) {
      const go = new Btn(this, 0, 44, 140, 20, 'WEITER', 0xa8342a, () => this.close(true));
      box.add(go.box);
      this.primary = () => this.close(true);
    } else {
      const again = new Btn(this, -66, 44, 120, 20, 'NOCHMAL', 0xa8342a, () => this.nochmal());
      const stop = new Btn(this, 66, 44, 120, 20, 'AUFHÖREN', 0x3a3040, () => this.close(false));
      box.add([again.box, stop.box]);
      this.primary = () => this.nochmal();
    }
    this.endBox = box;
  }

  private nochmal() {
    this.endBox?.destroy();
    this.endBox = undefined;
    this.intro();
  }

  private close(win: boolean) {
    state.running = this.wasRunning;
    audio.music('none');
    const { resume, onDone } = this.cfg;
    this.scene.resume(resume);
    this.scene.stop();
    // die Keller-Szene setzt ihre Musik beim Fortsetzen nicht neu: hier wieder anwerfen
    audio.music(state.flags.nick === 'frei' ? 'kellerClean' : 'keller');
    onDone?.(win);
  }
}

