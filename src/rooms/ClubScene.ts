import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { Interact, T, TileInfo, TopDown } from '../scenes/TopDown';
import { floatText } from '../ui';
import { DANCER_LOOKS } from './clubGfx';
import { ALLEY_CLUB_SPAWN } from './spawns';
import type { DialogAction } from '../dialog/data';
import { janWeg, kanalAb } from '../dialog/kanal';
import { STRAENGE, starteStrang, strangZiel } from '../progress/quests';
import { unlock } from '../progress/achievements';
import { hud } from '../scenes/HudScene';
import type { WandlungUI } from './WandlungUI';

// „Muskelkater“: Stripclub mit Ladies Night. Männliche Tänzer in Kostümen tanzen an den Stangen, laufen über den
// Laufsteg und tanzen zwischendurch vor einzelnen Gästen. Gäste sitzen, jubeln, werfen Scheine, holen sich Getränke
// an der Bar oder gehen zur Toilette. Bühne und VIP-Bereich sind für den Wirt gesperrt.
// Alle Figuren laufen Kachel für Kachel über eine Wegsuche (A*), weichen einander und dem Wirt aus.
//
//  # Samtwand   n Neon an der Wand   V Bühnenvorhang   P Durchgang hinter die Bühne   h Bar-Rückwand
//  D Ausgang    W Toilette           S Bühne/Laufsteg  O Stange   e Treppe zur Bühne   K DJ-Pult
//  T Theke      x Barhocker          B Samtsofa        t Tischchen
//  l / r Stuhl mit Blick nach rechts / links   c Stuhl mit Blick zur Bühne   R Samtkordel   v VIP-Boden   p Palme
const MAP = [
  '##############################',
  '#nnnn#VVVVVVVPVVVVVVV#hhhhhhh#',
  '#KK...SSSOSSSSSSSOSSS#.......#',
  '#KK...SSSSSSSSSSSSSSS.TTTTTTT#',
  '#p.....e....SSS....e..x.x.x.x#',
  '#B.t.......lSSSr.............#',
  '#B.........tSSSt.............#',
  '#B.t.......lSSSr......t......#',
  '#B.........tSSSt.............#',
  '#B.t.......lSSSr......t......#',
  '#p........lSSOSSr...........p#',
  '#.........lSSSSSr............#',
  '#..........ccccc.............#',
  '#RRR.RRRR....................#',
  '#BvtvvvvR....................#',
  '#BvvvvvvR...................p#',
  '#BvvvvvvR....................#',
  '##################D#######W###',
];

type Pt = [number, number];
type Pose = 'side' | 'back' | 'stand';
const K = (x: number, y: number) => y * 64 + x;
const same = (a: Pt, x: number, y: number) => a[0] === x && a[1] === y;
const pick = <X>(a: X[]) => a[Math.floor(Math.random() * a.length)];
const rnd = Phaser.Math.Between;

const BACKSTAGE: Pt = [13, 1];
const PICKUP: Pt = [21, 3];
const WC_FRONT: Pt = [26, 16];
const BAR_SPOTS: Pt[] = [[23, 4], [25, 4], [27, 4]];
const VIP_GAP: Pt = [4, 13];
const BOUNCER: Pt = [5, 12];
const KEVIN_SEAT: Pt = [10, 10];
/** Leni Blume, Chefin des Clubs, steht neben ihrem Türsteher am VIP-Bereich */
const LENI2: Pt = [6, 12];
const BALL = { x: 13 * T + 8, y: 4 * T };
/** Kapitel 6, Trauung auf dem Laufsteg: Kevin links, Jan rechts, Leni Blume traut unter dem Rosenbogen */
const KEVIN_TRAU = { x: 12 * T + 12, y: 8 * T + 14 };
const JAN_TRAU = { x: 14 * T + 4, y: 8 * T + 14 };
/** Weg des Tentakels: durch die Eingangstür, den Gang hoch, auf den Laufsteg zu Jan (Pixel) */
const TENTAKEL_WEG = [[18 * T + 8, 17 * T + 10], [18 * T + 8, 15 * T + 4], [17 * T + 6, 13 * T + 6], [15 * T + 10, 11 * T + 4], [14 * T + 10, 9 * T + 12], [JAN_TRAU.x, JAN_TRAU.y - 2]];

/** Wer wo sitzt bzw. steht (Kachel des Sitzplatzes) */
const GUESTS: [string, Pt][] = [
  ['team1', [1, 5]], ['team2', [1, 6]], ['braut', [1, 7]], ['team3', [1, 8]], ['team4', [1, 9]],
  ['jeans', [11, 5]], ['leo', [11, 7]], ['blazer', [15, 5]], ['punk', [16, 11]],
  ['rot', [12, 12]], ['oma', [13, 12]], ['mann', [14, 12]],
  ['gruen', [24, 4]], ['glitzer', [26, 4]],
  ['kollegin1', [21, 7]], ['kollegin2', [23, 7]],
  ['vip1', [1, 14]], ['vip2', [1, 15]],
];
/** Stehplätze am Stehtisch: Blickrichtung zum Tisch */
const STANDING: [Pt, boolean][] = [[[21, 7], false], [[23, 7], true], [[21, 9], false], [[23, 9], true]];

const CHEERS = ['WOOO!', 'JAAA!', 'ZUGABE!', 'HUI!', 'BRAVO!', 'SCHATZ!', '€€€'];
const CHATTER = ['HIHI', 'PROST!', 'HAHA!', 'NOCH EIN SEKT?'];
const DRINKS = [
  'Cocktail „Feuerwehrschlauch“: Erdbeere, Wodka, Schirmchen in Helmform.',
  '„Handschellen-Hugo“. Schmeckt nach Minze und schlechten Entscheidungen.',
  '„Matrosen-Mule“. Mit Ingwer. Und einem Matrosen auf dem Glas.',
  'Ein Bier. Die Barfrau guckt, als hättest du Leitungswasser bestellt.',
];

interface Seat { at: Pt; pose: Pose; flip: boolean; guest?: Npc; kevin?: boolean }
interface Spot { pole: Pt; stand: Pt; main: boolean; dancer?: Npc }

interface Npc {
  sheet: string;
  sp: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  tx: number;
  ty: number;
  path: Pt[];
  moving: boolean;
  speed: number;
  /** Versatz der Füße nach unten (Barfrau steht hinter der Theke) */
  dy: number;
  walk: (x: number, y: number) => boolean;
  facing: 'down' | 'up' | 'side';
  waitT: number;
  rerouted: boolean;
  done?: () => void;
  seat?: Seat;
  seated: boolean;
  hidden: boolean;
  dancing: boolean;
  /** läuft gerade eine Stangenfigur (Drehung, Klettern) */
  busyTween: boolean;
  /** ein Tänzer tanzt gerade für diesen Gast */
  dancedFor?: Npc;
  light?: Phaser.GameObjects.Image;
  tray?: Phaser.GameObjects.Image;
}

export class ClubScene extends TopDown {
  private npcs: Npc[] = [];
  private occ = new Map<number, Npc>();
  private playerTiles = new Set<number>();
  private seats: Seat[] = [];
  private spots: Spot[] = [];
  private dancers: Npc[] = [];
  private barWait: number[] = [];
  private barTaken = new Set<number>();
  private sparkles?: Phaser.GameObjects.Graphics;
  private tipIt!: Interact;
  private tipTarget?: Npc;
  /** Kapitel 6: Trauung und Entführung als Szene im Club */
  private kino = false;
  private kinoAus = false;
  private ui?: WandlungUI;
  private leni2Sp?: Phaser.GameObjects.Sprite;
  private dunkel?: Phaser.GameObjects.Rectangle;
  private flackern = 0;

  constructor() {
    super('Club');
  }

  init() {
    super.init();
    this.npcs = [];
    this.occ = new Map();
    this.playerTiles = new Set();
    this.seats = [];
    this.spots = [];
    this.dancers = [];
    this.kino = false;
    this.kinoAus = false;
    this.flackern = 0;
    this.barWait = [];
    this.barTaken = new Set();
    this.tipTarget = undefined;
  }

  protected mapRows() { return MAP; }
  protected isWall(ch: string) { return '#nVPhDW'.includes(ch); }
  protected darkness() { return 0.42; }
  protected goalText() { return strangZiel(state.flags) ?? 'Muskelkater: Ladies Night. Jeden Abend.'; }

  protected floorKey(x: number, y: number) {
    const ch = this.rows[y][x];
    if (ch === 'S' || ch === 'O') return 'clubStage';
    if (ch === 'e') return 'clubStairs';
    if (ch === 'v' || (y >= 14 && x <= 7 && ch !== 'R')) return 'clubVip';
    return `clubFloor${(x * 7 + y * 3) % 2}`;
  }

  protected tileFor(ch: string, x: number): TileInfo {
    switch (ch) {
      case '#': return { key: 'clubWallFront', solid: true };
      case 'n': return { key: x % 2 ? 'clubNeon1' : 'clubNeon0', solid: true };
      case 'V': return { key: 'clubCurtain', solid: true };
      case 'P': return { key: 'clubBackstage', solid: true };
      case 'h': return { key: 'clubShelf', solid: true };
      case 'D': return { key: 'clubDoor', solid: true };
      case 'W': return { key: 'clubWc', solid: true };
      case 'T': return { key: x % 2 ? 'clubCounter1' : 'clubCounter0', solid: true, object: true };
      case 'p': return { key: 'plant', solid: true, object: true };
      case '.': case 'v': return { key: '', solid: false };
      // Bühne, Möbel, Kordel: fest; Möbel setzt setupWorld mit eigener Tiefe
      default: return { key: '', solid: true };
    }
  }

  protected setupWorld() {
    audio.music('club');
    this.furniture();
    this.stageFx();
    this.lighting();
    this.interactions();
    this.people();
  }

  update(t: number, delta: number) {
    super.update(t, delta);
    this.tick(Math.min(delta, 50));
  }

  // ---------------------------------------------------------------- Einrichtung

  private furniture() {
    const img = (x: number, y: number, key: string, depth: number) => this.add.image(x, y, key).setOrigin(0).setScale(0.5).setDepth(depth);
    for (let y = 0; y < this.rows.length; y++)
      for (let x = 0; x < this.rows[y].length; x++) {
        const px = x * T, py = y * T;
        switch (this.rows[y][x]) {
          case 'B': img(px, py, 'clubSofa', py + 4); break;
          case 'l': img(px, py, 'clubChairSide', py + 4); break;
          case 'r': img(px, py, 'clubChairSide', py + 4).setFlipX(true); break;
          case 'c': img(px, py, 'clubChairSeat', py + 4); img(px, py, 'clubChairBack', py + 15); break;
          case 'x': img(px, py, 'clubStool', py + 4); break;
          case 't': img(px, py, 'clubTable', py + T); break;
          case 'R': img(px, py, 'clubPost', py + 12); this.rope(x, y); break;
          case 'O': this.add.image(px + 8, py + 13, 'clubPole').setOrigin(0.5, 1).setScale(0.5).setDepth(py + 12); break;
        }
      }
    img(T, 2 * T, 'clubDj', 3 * T + 15);
    // für den Wirt gesperrt: Durchgang zum VIP-Bereich (der Türsteher steht daneben)
    this.solid[VIP_GAP[1]][VIP_GAP[0]] = true;
    this.solid[BOUNCER[1]][BOUNCER[0]] = true;
    this.solid[LENI2[1]][LENI2[0]] = true;
  }

  /** Samtkordel zum rechten bzw. unteren Nachbarpfosten, leicht durchhängend */
  private rope(x: number, y: number) {
    const px = x * T + 8, py = y * T + 6;
    if (this.rows[y][x + 1] === 'R') {
      const g = this.add.graphics().setDepth(y * T + 11);
      g.lineStyle(1.5, 0xb01040).beginPath().moveTo(px, py);
      for (let i = 1; i <= 8; i++) g.lineTo(px + i * 2, py + Math.sin((i / 8) * Math.PI) * 3);
      g.strokePath();
    }
    if (this.rows[y + 1]?.[x] === 'R') {
      const g = this.add.graphics().setDepth((y + 1) * T + 11);
      g.lineStyle(1.5, 0xb01040).lineBetween(px, py, px, py + T);
    }
  }

  /** Bühnenkante: Stufe mit Lauflicht-LEDs, schmale Leuchtleiste an den Seiten des Laufstegs */
  private stageFx() {
    const st = (x: number, y: number) => 'SO'.includes(this.rows[y]?.[x] ?? '#');
    const g = this.add.graphics().setDepth(0.7);
    const leds = [this.add.graphics().setDepth(0.8), this.add.graphics().setDepth(0.8)];
    for (let y = 0; y < this.rows.length; y++)
      for (let x = 0; x < this.rows[y].length; x++) {
        if (!st(x, y)) continue;
        const px = x * T, py = y * T;
        if (!st(x, y + 1)) {
          g.fillStyle(0x2a1430).fillRect(px, py + 13, T, 3);
          g.fillStyle(0x000000, 0.4).fillRect(px, py + 16, T, 2);
          for (let i = 1; i < T; i += 4) leds[(px + i) % 8 < 4 ? 0 : 1].fillStyle(0xff4ac0).fillRect(px + i, py + 14, 2, 1);
        }
        const wall = (ch: string | undefined) => !ch || this.isWall(ch);
        g.fillStyle(0xff4ac0, 0.8);
        if (!st(x - 1, y) && !wall(this.rows[y][x - 1])) g.fillRect(px, py, 1, T);
        if (!st(x + 1, y) && !wall(this.rows[y][x + 1])) g.fillRect(px + T - 1, py, 1, T);
      }
    leds[1].setAlpha(0.2);
    this.tweens.add({ targets: leds[0], alpha: 0.2, duration: 280, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: leds[1], alpha: 1, duration: 280, yoyo: true, repeat: -1 });
  }

  private lighting() {
    // Lauflichter über Bühne und Laufsteg
    const sweep = (tint: number, x0: number, x1: number, y: number, dur: number) => {
      const l = this.addLight(x0, y, 1.3, 0.75).setTint(tint);
      this.tweens.add({ targets: l, x: x1, duration: dur, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    };
    sweep(0xff4ac0, 7 * T, 20 * T, 2.5 * T, 3200);
    sweep(0x9a5aff, 20 * T, 7 * T, 3 * T, 4100);
    sweep(0x40c8ff, 12 * T, 15 * T, 8 * T, 2600);
    for (let x = 6; x <= 20; x += 3) this.addLight(x * T + 8, 4 * T, 0.35, 0.45).setTint(0xff4ac0);
    for (let y = 5; y <= 11; y += 2) for (const x of [12, 15]) this.addLight(x * T, y * T + 8, 0.3, 0.4).setTint(0xff4ac0);
    // gedämpftes Raumlicht in Pink und Lila über den Sitzbereichen
    for (const [x, y, tint] of [[5, 7, 0xc060ff], [5, 12, 0xff60c0], [20, 7, 0xff60c0], [25, 11, 0xc060ff], [18, 14, 0xff60c0], [11, 15, 0xc060ff]] as const)
      this.addLight(x * T, y * T, 1.9, 0.3).setTint(tint);
    // Neon an der Wand, Bar, DJ, VIP, Kerzen
    this.addLight(2 * T, 1.5 * T, 0.6, 0.6).setTint(0xff8ae0);
    this.addLight(4 * T, 1.5 * T, 0.5, 0.5).setTint(0x60e8ff);
    for (const x of [23, 25.5, 28]) this.addLight(x * T, 2.5 * T, 0.7, 0.55).setTint(0xffb0e0);
    this.addLight(2 * T, 3 * T, 0.6, 0.55).setTint(0x40d0f0);
    this.addLight(4 * T, 15 * T, 1, 0.45).setTint(0xf0c060);
    for (let y = 0; y < this.rows.length; y++)
      for (let x = 0; x < this.rows[y].length; x++) if (this.rows[y][x] === 't') this.addLight(x * T + 8, y * T + 6, 0.22, 0.6).setTint(0xffb050);
    this.addLight(18 * T + 8, 16 * T, 0.4, 0.4).setTint(0x40e070); // Notausgang

    // Neonschild über dem Vorhang
    // (vor dem Vorhang, hinter den Tänzern, die durch den Durchgang kommen)
    const sign = this.add.text(13.5 * T, 21, 'MUSKELKATER', { fontFamily: '"Press Start 2P", monospace', fontSize: '16px', color: '#ff9ae0' })
      .setOrigin(0.5).setResolution(2).setScale(0.5).setDepth(1.5).setShadow(0, 0, '#ff2ab0', 8, true, true);
    this.tweens.add({ targets: sign, alpha: 0.55, duration: 70, yoyo: true, repeat: -1, repeatDelay: 2600 });
    this.addLight(13.5 * T, 22, 1.2, 0.6).setTint(0xff4ac0);

    // Spiegelkugel mit wanderndem Glitzer
    this.add.graphics().setDepth(5002).lineStyle(1, 0x505060).lineBetween(BALL.x, 0, BALL.x, BALL.y - 4);
    const ball = this.add.image(BALL.x, BALL.y, 'clubBall').setScale(0.5).setDepth(5003);
    this.time.addEvent({ delay: 180, loop: true, callback: () => ball.setFlipX(!ball.flipX) });
    this.sparkles = this.add.graphics().setDepth(5002).setBlendMode(Phaser.BlendModes.ADD);
  }

  private interactions() {
    const add = (x: number, y: number, r: number, label: string | (() => string | null), act: () => void) =>
      this.interacts.push({ x, y, r, label: typeof label === 'string' ? () => label : label, act });
    add(18 * T + 8, 17 * T, 18, 'Club verlassen', () => this.go('Alley', { spawn: ALLEY_CLUB_SPAWN }));
    add(26 * T + 8, 17 * T, 18, 'Toilette', () => this.toast('Besetzt. Von drinnen: „Hat jemand mein Babyöl gesehen?“'));
    for (const [x, y] of [PICKUP, ...BAR_SPOTS]) add(x * T + 8, y * T + 8, 14, 'Drink bestellen (6€)', () => this.order());
    for (const x of [7, 19]) add(x * T + 8, 4 * T + 12, 14, 'Bühne', () => this.toast('Nur für Tänzer. Du hast kein Kostüm. Und kein Babyöl.'));
    add(3 * T + 4, 3 * T + 8, 16, 'DJ', () => this.toast('Der DJ nickt im Takt. Er spielt seit 2009 denselben Schlager-Remix. Keiner beschwert sich.'));
    add(BOUNCER[0] * T + 8, BOUNCER[1] * T + 12, 18, 'Türsteher', () => this.toast(pick([
      'VIP heißt „Very Important Person“. Er guckt dich an. Lange. Dann schüttelt er den Kopf.',
      'Liste? Du stehst nicht drauf. Er hat zweimal nachgesehen.',
      'Ohne Glitzer kein Zutritt.',
    ])));
    add(2 * T + 8, 7 * T + 10, 14, () => (this.seatAt([1, 7])?.guest?.seated ? 'Junggesellinnenabschied' : null),
      () => this.toast('Junggesellinnenabschied. Auf der Schärpe der Braut: „LETZTE NACHT IN FREIHEIT“.'));
    // Trinkgeld: folgt jeweils dem nächsten tanzenden Tänzer in Reichweite
    this.tipIt = { x: -9999, y: -9999, r: 46, label: () => (this.tipTarget ? 'Trinkgeld werfen (1€)' : null), act: () => this.throwTip() };
    this.interacts.push(this.tipIt);
  }

  private order() {
    if (state.money < 6) return this.toast('6 Euro für einen Cocktail. Du hast keine 6 Euro.');
    state.money -= 6;
    audio.sfx('glug');
    floatText(this, this.player.x, this.player.y - 24, '-6€', '#ff9ac0').setDepth(5004);
    this.toast(pick(DRINKS));
  }

  private throwTip() {
    const d = this.tipTarget;
    if (!d) return;
    if (state.money < 1) return this.toast('Kein Geld. Nicht mal für Trinkgeld.');
    state.money -= 1;
    audio.sfx('coin');
    this.bill(this.player.x, this.player.y - 14, d.sp.x, d.sp.y - 4);
    this.time.delayedCall(450, () => {
      if (!d.busyTween) d.sp.setFrame(13);
      this.say(d, pick(['DANKE, SCHATZ!', 'MERCI!', 'DU BIST SÜSS!', 'FÜR DICH TANZ ICH!']), '#ffe070');
    });
  }

  // ---------------------------------------------------------------- Figuren

  private people() {
    for (let y = 0; y < this.rows.length; y++)
      for (let x = 0; x < this.rows[y].length; x++) {
        const ch = this.rows[y][x];
        if (ch === 'B' || ch === 'l') this.seats.push({ at: [x, y], pose: 'side', flip: false });
        else if (ch === 'r') this.seats.push({ at: [x, y], pose: 'side', flip: true });
        else if (ch === 'c' || ch === 'x') this.seats.push({ at: [x, y], pose: 'back', flip: false });
      }
    for (const [at, flip] of STANDING) this.seats.push({ at, pose: 'stand', flip });
    this.spots = [
      { pole: [9, 2], stand: [9, 3], main: true },
      { pole: [17, 2], stand: [17, 3], main: true },
      { pole: [13, 10], stand: [13, 11], main: false },
    ];

    const ch = (x: number, y: number) => this.rows[y]?.[x] ?? '#';
    const notBouncer = (x: number, y: number) => !same(BOUNCER, x, y) && !same(LENI2, x, y);
    const guestWalk = (x: number, y: number) => ch(x, y) === '.' && !same(VIP_GAP, x, y) && notBouncer(x, y);
    const vipWalk = (x: number, y: number) => '.v'.includes(ch(x, y)) && notBouncer(x, y);
    const dancerWalk = (x: number, y: number) => '.vSeP'.includes(ch(x, y)) && notBouncer(x, y) && !(y === 2 && x > 21);

    // Gäste auf ihren Plätzen; ab und zu gehen sie zur Bar oder zur Toilette
    for (const [id, at] of GUESTS) {
      const seat = this.seatAt(at)!;
      const g = this.spawn(`cg_${id}`, at, at[1] >= 14 ? vipWalk : guestWalk, rnd(26, 34));
      g.seat = seat;
      seat.guest = g;
      this.sit(g);
      this.time.delayedCall(rnd(12000, 70000), () => this.outing(g));
    }

    // Kevin sitzt nach der Veröffentlichung am Laufsteg
    if (state.flags.claudius === 'veroeffentlicht' && !janWeg(state.flags)) this.addKevin();
    this.hochzeitDeko();
    this.addLeni2();

    // Tänzer: zwei tanzen schon, die anderen warten hinter dem Vorhang
    const tints = [0xff4ac0, 0xc060ff, 0x40c8ff];
    // Jan fehlt auf der Bühne, solange er entführt ist (Kapitel 6 bis 8)
    Object.keys(DANCER_LOOKS).filter((id) => id !== 'jan' || !janWeg(state.flags)).forEach((id, i) => {
      const d = this.spawn(`cd_${id}`, BACKSTAGE, dancerWalk, 36);
      if (id === 'soldat') d.sp.setScale(0.64); // Emilian: einen Kopf größer als alle anderen
      if (id === 'jan') d.sp.setScale(0.6); // Jan: zwei Meter
      this.occ.delete(K(...BACKSTAGE));
      d.light = this.addLight(0, 0, 0.9, 0.7).setTint(tints[i % 3]).setVisible(false);
      this.dancers.push(d);
      if (i < 2) {
        const spot = this.spots[i];
        [d.tx, d.ty] = spot.stand;
        d.sp.setPosition(d.tx * T + 8, d.ty * T + 14);
        this.occ.set(K(d.tx, d.ty), d);
        this.perform(d, spot, rnd(6000, 14000), 0);
      } else {
        this.hide(d);
        this.time.delayedCall(2500 + i * 3500, () => this.dancerEnter(d));
      }
    });

    // Kellner mit Tablett
    const w = this.spawn('cs_kellner', PICKUP, vipWalk, 38);
    w.tray = this.add.image(0, 0, 'clubTray').setScale(0.5);
    this.time.delayedCall(1500, () => this.serve(w));

    // Barfrau hinter der Theke
    const b = this.spawn('cs_barfrau', [25, 2], (x, y) => y === 2 && x >= 22 && x <= 28, 30, 6);
    this.time.delayedCall(800, () => this.barLoop(b));

    // Türsteher am VIP-Bereich, DJ hinter dem Pult
    const [bx, by] = BOUNCER;
    const bouncer = this.add.sprite(bx * T + 8, by * T + 14, 'cs_tuersteher', 0).setOrigin(0.5, 1).setScale(0.6, 0.56).setDepth(by * T + 14);
    this.add.image(bouncer.x, bouncer.y - 1, 'shadow').setDepth(1).setScale(1.3, 1);
    this.time.addEvent({ delay: 5200, loop: true, callback: () => { bouncer.setFrame(6).setFlipX(Math.random() < 0.5); this.time.delayedCall(1200, () => bouncer.setFrame(0)); } });
    const dj = this.add.sprite(2 * T, 2 * T + 12, 'cs_dj', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(2 * T + 11);
    this.tweens.add({ targets: dj, y: dj.y - 1, duration: 245, yoyo: true, repeat: -1 });
    this.time.addEvent({ delay: 7300, loop: true, callback: () => { dj.setFrame(12); this.time.delayedCall(900, () => dj.setFrame(0)); } });

    this.time.addEvent({ delay: 800, loop: true, callback: () => this.crowd() });
  }

  /** Leni Blume: Chefin des Clubs. Im Xavi-Strang führt das Gespräch zum Kampf gegen Emilian (KampfScene). */
  private addLeni2() {
    const [x, y] = LENI2;
    const px = x * T + 8, py = y * T + 14;
    const l = this.add.sprite(px, py, 'leni2', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(py);
    this.leni2Sp = l;
    this.add.image(px, py - 1, 'shadow').setDepth(1);
    this.time.addEvent({ delay: 4600, loop: true, callback: () => { l.setFrame(6).setFlipX(Math.random() < 0.5); this.time.delayedCall(1400, () => l.setFrame(0)); } });
    this.interacts.push({ x: px, y: py - 4, r: 18, label: () => 'Mit Leni Blume reden', act: () => this.talk('leni2', (a) => this.leni2Done(a)) });
  }

  private leni2Done(a?: DialogAction) {
    if (a !== 'emilianKampf') return;
    this.scene.launch('Kampf', { resume: this.scene.key, onDone: (win: boolean) => this.kampfDone(win) });
    this.scene.bringToTop('Kampf');
    this.scene.pause();
  }

  private kampfDone(win: boolean) {
    if (!win) return this.toast('Emilian grinst: „Nochmal, Chef? Die Bühne läuft nicht weg.“');
    state.flags.xavi = 'gerettet';
    this.scene.launch('Cutscene', { script: 'xaviFrei', resume: this.scene.key, music: 'club' });
    this.scene.bringToTop('Cutscene');
    this.scene.pause();
  }

  /** Kapitel 6: Strang starten, Käse-Antrag, Hochzeitsprobe */
  private kevinDone(a?: DialogAction) {
    const f = state.flags;
    if (a === 'kanalStart' && !f.kanal) {
      const s = STRAENGE.find((x) => x.id === 'kanal');
      if (s) starteStrang(s, f, state.time);
      f.strangBereit = undefined;
      this.zwischen('kapitel6', 'club');
    } else if (a === 'kaeseGeben' && f.kanal === 'kaese' && state.inv.stinkekaese > 0) {
      state.inv.stinkekaese = 0;
      f.kanal = 'vorbereitung';
      unlock('proteinMitSeele');
      this.zwischen('antrag', 'romantik');
    } else if (a === 'probe' && f.kanal === 'probe') {
      void this.hochzeit();
    }
  }

  private zwischen(script: string, music: string) {
    this.scene.launch('Cutscene', { script, resume: this.scene.key, music });
    this.scene.bringToTop('Cutscene');
    this.scene.pause();
  }

  /** Bier und Buffet stehen bereit, der Rosenbogen steht; nach der Entführung: Schleimspur bis zur Tür, Jans Fliege */
  private hochzeitDeko() {
    const f = state.flags;
    if (f.hochzeitBuffet && !janWeg(f)) this.add.image(26 * T + 8, 11 * T + 14, 'hz_buffet').setOrigin(0.5, 1).setScale(0.5).setDepth(11 * T + 14);
    if (f.hochzeitBier && !janWeg(f)) this.add.image(24 * T + 8, 11 * T + 15, 'hz_kiste').setOrigin(0.5, 1).setScale(0.5).setDepth(11 * T + 15);
    if (f.kanal === 'probe') this.add.image(13 * T + 8, 6 * T + 8, 'hz_bogen').setOrigin(0.5, 1).setScale(0.5).setDepth(6 * T + 5);
    if (!janWeg(f)) return;
    this.schleimSpur(true);
    const fx = JAN_TRAU.x - 4, fy = JAN_TRAU.y - 2;
    this.add.image(fx, fy, 'hz_fliege').setScale(0.5).setDepth(1.6);
    this.interacts.push({ x: fx, y: fy, r: 16, label: () => 'Jans Fliege', act: () => this.toast('Jans Glitzerfliege. Im Schleim. Daneben ein Abdruck wie von einem Saugnapf. Groß wie ein Bierdeckel.') });
  }

  /** Fette Schleimspur entlang des Tentakel-Wegs (Laufsteg bis Tür), mit grünem Schimmer */
  private schleimSpur(dauerhaft: boolean) {
    const pts = this.bahn(5);
    pts.forEach(([x, y], i) => {
      const b = this.add.image(x + rnd(-4, 4), y + rnd(-3, 3), 'hz_schleim').setScale(Phaser.Math.FloatBetween(0.55, 1.3), Phaser.Math.FloatBetween(0.5, 1.1)).setAngle(rnd(-40, 40)).setDepth(1.5)
        .setAlpha(Phaser.Math.FloatBetween(0.6, 0.9)).setTint(pick([0x9ad88a, 0x7ac06a, 0xb8f0a0, 0x6aa85a]));
      if (i % 9 === 0) { const l = this.addLight(x, y, 0.45, 0.45).setTint(0x6aff4a); if (dauerhaft) this.tweens.add({ targets: l, alpha: 0.2, duration: 1100, yoyo: true, repeat: -1, delay: i * 40 }); }
    });
    // Pfützen an der Tür und am Laufsteg
    for (const [x, y] of [[18 * T + 8, 16 * T + 12], [JAN_TRAU.x, JAN_TRAU.y]]) for (let k = 0; k < 4; k++) this.add.image(x + rnd(-8, 8), y + rnd(-5, 5), 'hz_schleim').setScale(Phaser.Math.FloatBetween(1.1, 1.8), Phaser.Math.FloatBetween(0.7, 1.2)).setAlpha(0.7).setTint(0x7ac06a).setDepth(1.4);
  }

  /** Der Tentakel-Weg als Punktfolge im Abstand d (Pixel), von der Tür bis zu Jan */
  private bahn(d: number): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 0; i < TENTAKEL_WEG.length - 1; i++) {
      const [x0, y0] = TENTAKEL_WEG[i], [x1, y1] = TENTAKEL_WEG[i + 1];
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / d));
      for (let k = 0; k < n; k++) out.push([Phaser.Math.Linear(x0, x1, k / n), Phaser.Math.Linear(y0, y1, k / n)]);
    }
    out.push(TENTAKEL_WEG[TENTAKEL_WEG.length - 1] as [number, number]);
    return out;
  }

  // ---------------------------------------------------------------- Kapitel 6: Trauung und Entführung

  /** Untertitel der Szene (Kinobalken in WandlungUI) */
  private async sagK(wer: string, farbe: string, text: string, ms: number, sprecher?: Phaser.GameObjects.Sprite) {
    if (this.kinoAus) return;
    this.ui?.zeige(wer, farbe, text);
    if (sprecher) this.tweens.add({ targets: sprecher, y: sprecher.y - 2, duration: 120, yoyo: true, repeat: 1 });
    await this.wartet(ms);
  }

  private figur(key: string, x: number, y: number, frame: number, flip = false, scale = 0.5) {
    const sp = this.add.sprite(x, y, key, frame).setOrigin(0.5, 1).setScale(scale).setFlipX(flip).setDepth(y);
    const sh = this.add.image(x, y - 1, 'shadow').setDepth(1);
    return { sp, sh };
  }

  /**
   * Die Trauung: Kevin und Jan auf dem Laufsteg, Leni Blume traut, Rosenblätter, Jubel. Das Licht beginnt zu flackern.
   * Ein riesiger Tentakel schiebt sich durch die Eingangstür, alle geraten in Panik, er wickelt sich um Jan.
   * Das Licht flackert immer wilder, geht aus, geht an: Jan ist weg, der Tentakel auch, eine fette Schleimspur bleibt.
   */
  private async hochzeit() {
    if (this.kino) return;
    this.kino = true;
    this.kinoAus = false;
    this.frozen = true;
    hud.prompt = '';
    this.scene.launch('WandlungUI');
    this.scene.bringToTop('WandlungUI');
    this.scene.sleep('Hud');
    this.ui = this.scene.get('WandlungUI') as WandlungUI;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.kinoAus = true; this.scene.stop('WandlungUI'); this.scene.wake('Hud'); });
    this.input.keyboard!.once('keydown-ESC', () => this.hochzeitEnde());
    audio.music('probe');

    // Bühne frei: die Tänzer gehen hinter den Vorhang
    for (const d of this.dancers) {
      this.tweens.killTweensOf(d.sp);
      d.path = [];
      d.hidden = true;
      d.sp.setVisible(false);
      d.shadow.setVisible(false);
      d.light?.setVisible(false);
    }
    this.tipTarget = undefined;
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(13 * T + 8, 8 * T + 4, 1000, 'Sine.easeInOut');
    cam.zoomTo(2.6, 1000, 'Sine.easeInOut');

    // Brautpaar, Ehrengarde, Trauzeuge, Koch
    const kevin = this.figur('kevin', KEVIN_TRAU.x, KEVIN_TRAU.y, 0, false, 0.4);
    const jan = this.figur('cd_jan', JAN_TRAU.x, JAN_TRAU.y, 6, true, 0.66);
    const emil = this.figur('cd_soldat', 14 * T + 12, 10 * T + 14, 0, false, 0.64);
    const feuer = this.figur('cd_feuerwehr', 12 * T + 4, 10 * T + 14, 0);
    const adsh = this.figur('adshayan', 26 * T + 8, 10 * T + 12, 0);
    const leni = this.leni2Sp;
    leni?.setPosition(13 * T + 8, 6 * T + 14).setFrame(0).setDepth(6 * T + 14);
    this.player.setPosition(11 * T + 10, 9 * T + 12).setFlipX(false).setFrame(6);
    if (!this.children.list.some((o) => o instanceof Phaser.GameObjects.Image && o.texture.key === 'hz_bogen')) {
      this.add.image(13 * T + 8, 6 * T + 8, 'hz_bogen').setOrigin(0.5, 1).setScale(0.5).setDepth(6 * T + 5);
    }
    const rosa = this.addLight(13 * T + 8, 8 * T, 1.3, 0.75).setTint(0xff7ac0);
    // Rosenblätter
    const blaetter = this.time.addEvent({
      delay: 120, loop: true,
      callback: () => {
        const b = this.add.image(rnd(11 * T, 16 * T), 5 * T, 'clubHeart').setScale(0.3).setDepth(5003).setTint(pick([0xff5ab0, 0xffffff, 0xff9ad0, 0xe8406a]));
        this.tweens.add({ targets: b, y: b.y + rnd(50, 80), x: b.x + rnd(-10, 10), angle: rnd(-180, 180), alpha: 0, duration: rnd(2000, 3000), onComplete: () => b.destroy() });
      },
    });
    // Gäste jubeln
    const gaeste = this.seats.map((x) => x.guest).filter((g): g is Npc => !!g && !g.hidden);
    const jubel = this.time.addEvent({
      delay: 650, loop: true,
      callback: () => {
        const g = pick(gaeste);
        if (!g) return;
        if (Math.random() < 0.55) this.say(g, pick(['WOOO!', 'HACH!', 'KÜSSEN!', 'JAAA!', 'SCHÖN!', 'PROST!']), '#ffb0e0');
        else this.heart(g.sp.x, g.sp.y - 18);
      },
    });
    // Licht: dunkle Decke über dem ganzen Club, deren Deckkraft flackert
    this.dunkel = this.add.rectangle(0, 0, 30 * T, 18 * T, 0x000000, 0).setOrigin(0).setDepth(5600);
    const flacker = this.time.addEvent({
      delay: 55, loop: true,
      callback: () => {
        const st = this.flackern;
        if (!this.dunkel || st <= 0) return;
        this.dunkel.setFillStyle(0x000000, Math.random() < 0.25 + st * 0.4 ? Phaser.Math.FloatBetween(0.25, 0.95) * st : 0);
      },
    });
    const aufraeumen = () => { blaetter.remove(); jubel.remove(); flacker.remove(); };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, aufraeumen);
    await this.wartet(1200);

    // ---- 1. Die Trauung
    await this.sagK('LENI BLUME', '#f0e0f0', 'Liebe Gäste. Liebe Tänzer. Lieber ... Käse.', 2600, leni);
    await this.sagK('LENI BLUME', '#f0e0f0', 'Wir sind heute hier versammelt, um zwei Herzen zu verbinden. Und vier Bauchmuskeln. Sechs. Acht.', 3400, leni);
    if (this.kinoAus) return;
    for (let i = 0; i < 4; i++) this.time.delayedCall(i * 260, () => this.heart(jan.sp.x + rnd(-4, 4), jan.sp.y - 26));
    await this.sagK('JAN', '#e090ff', 'Kevin. Du hast mir Käse geschenkt. Und dein Herz. In dieser Reihenfolge.', 3200, jan.sp);
    await this.sagK('KURDISCHER KEVIN', '#ff8a50', 'Bruder ... ich weine. Das ist die Akustik.', 2600, kevin.sp);
    await this.sagK('ADSHAYAN', '#f8b040', 'Das Buffet ist eröffnet! Ich habe nur zweimal probiert. ... Dreimal.', 2800, adsh.sp);
    if (this.kinoAus) return;

    // ---- 2. Das Licht flackert, draußen schmatzt etwas
    this.flackern = 0.25;
    audio.sfx('gurgle');
    await this.sagK('', '#a8a8a8', '*Das Licht flackert. Von draußen: ein nasses, schweres Schmatzen.*', 2600);
    jubel.paused = true;
    await this.sagK('LENI BLUME', '#f0e0f0', 'Was war das? ... Wer hat das Curry so scharf gemacht? Das riecht man bis in die Kanalisation!', 3200, leni);
    await this.sagK('ADSHAYAN', '#f8b040', '... Qualitätskontrolle.', 2000, adsh.sp);
    if (this.kinoAus) return;

    // ---- 3. Die Tür fliegt auf
    this.flackern = 0.45;
    audio.music('monster');
    audio.sfx('crack');
    audio.sfx('thud');
    cam.shake(500, 0.012);
    cam.pan(15 * T + 4, 12 * T + 10, 900, 'Sine.easeInOut');
    cam.zoomTo(1.4, 900, 'Sine.easeInOut');
    this.ui?.leer();
    for (const g of gaeste) this.time.delayedCall(rnd(0, 400), () => this.say(g, '!', '#ff5040'));
    blaetter.paused = true;
    rosa.setTint(0x80ff60);
    const tk = this.tentakelStart();
    await this.tentakelKriecht(tk, 3400, () => {
      // auf halbem Weg: Panik
      if (!tk.panik && tk.kopf > tk.bahn.length * 0.35) { tk.panik = true; this.panikImClub(gaeste, [feuer.sp, emil.sp, adsh.sp]); }
    });
    if (this.kinoAus) return;
    await this.sagK('EMILIAN', '#9ad070', 'EHRENGARDE ... RÜCKZUG!', 1400, emil.sp);

    // ---- 4. Er wickelt sich um Jan: Kamera fährt aufs Brautpaar
    cam.pan(13 * T + 12, 8 * T + 6, 500, 'Sine.easeInOut');
    cam.zoomTo(2.4, 500, 'Sine.easeInOut');
    jan.sp.setFrame(12);
    audio.sfx('slap');
    cam.shake(300, 0.01);
    await this.tentakelWickelt(tk, 900);
    this.tweens.add({ targets: jan.sp, y: jan.sp.y - 10, duration: 500, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: jan.sp, angle: { from: -12, to: 12 }, duration: 110, yoyo: true, repeat: -1 });
    audio.sfx('scream');
    await this.sagK('JAN', '#e090ff', 'KEVIN! Der Käse! Rette den KÄSE! ... und mich!', 2400, jan.sp);
    // Kevin stürzt los und fällt hin
    this.tweens.add({ targets: kevin.sp, x: kevin.sp.x + 9, duration: 250, ease: 'Quad.easeIn', onComplete: () => { this.tweens.add({ targets: kevin.sp, angle: 80, y: kevin.sp.y + 3, duration: 200 }); audio.sfx('thud'); } });
    await this.sagK('KURDISCHER KEVIN', '#ff8a50', 'JAAAAAN!', 1400, kevin.sp);
    if (this.kinoAus) return;

    // ---- 5. Flackern, Blackout, Licht an: Jan weg
    this.flackern = 1;
    audio.sfx('roar');
    await this.wartet(1600);
    if (this.kinoAus) return;
    flacker.remove();
    this.dunkel?.setFillStyle(0x000000, 1);
    audio.music('none');
    this.ui?.leer();
    audio.sfx('scream');
    this.time.delayedCall(350, () => audio.sfx('slap'));
    this.time.delayedCall(700, () => audio.sfx('splash'));
    this.time.delayedCall(1000, () => audio.sfx('gurgle'));
    // im Dunkeln: Jan und Tentakel verschwinden, die Spur bleibt
    jan.sp.destroy(); jan.sh.destroy();
    tk.g.destroy(); tk.licht.destroy();
    this.tweens.killTweensOf(kevin.sp);
    kevin.sp.setPosition(JAN_TRAU.x - 6, JAN_TRAU.y).setAngle(0).setScale(0.4, 0.33);
    this.schleimSpur(true);
    rosa.setTint(0xff7ac0).setAlpha(0.5);
    await this.wartet(1500);
    if (this.kinoAus) return;
    for (const a of [0.7, 0, 0.6, 0.1, 0.45, 0]) { this.dunkel?.setFillStyle(0x000000, a); await this.wartet(90); }
    cam.pan(14 * T, 10 * T, 700, 'Sine.easeInOut');
    cam.zoomTo(2.2, 700, 'Sine.easeInOut');
    await this.wartet(900);
    await this.sagK('', '#a8a8a8', '*Stille. Wo Jan stand: nur noch Schleim. Viel Schleim.*', 2600);
    audio.sfx('clang');
    await this.sagK('', '#a8a8a8', '*Emilian lässt die Ölflasche fallen. Sie rollt über den Laufsteg.*', 2400);
    this.tweens.add({ targets: kevin.sp, y: kevin.sp.y + 1, duration: 300, yoyo: true, repeat: -1 });
    await this.sagK('KURDISCHER KEVIN', '#ff8a50', 'BRUDER. Die haben meinen Jan.', 3200, kevin.sp);
    this.hochzeitEnde();
  }

  /** Ende der Szene (auch beim Überspringen): Jan ist weg, Kapitel 7 beginnt, der Club wird neu aufgebaut */
  private hochzeitEnde() {
    if (this.kinoAus) return;
    this.kinoAus = true;
    state.flags.kanal = 'entfuehrt';
    this.frozen = false;
    this.go('Cutscene', { script: 'kapitel7', next: { scene: 'Club', data: { spawn: [16, 13] } } });
  }

  /** Gäste und Personal fliehen schreiend an die Wände, weg vom Gang */
  private panikImClub(gaeste: Npc[], extra: Phaser.GameObjects.Sprite[]) {
    const ziele: [number, number][] = [[2, 3], [3, 4], [2, 11], [4, 10], [3, 12], [24, 5], [26, 6], [27, 9], [25, 13], [28, 14], [23, 15], [22, 6]];
    gaeste.forEach((g, i) => {
      this.time.delayedCall(i * 90, () => {
        if (this.kinoAus) return;
        this.tweens.killTweensOf(g.sp);
        g.seated = false;
        g.path = [];
        g.sp.setFrame(0);
        if (i % 3 === 0) audio.sfx('scream');
        this.say(g, pick(['AAAH!', 'HILFE!', 'MAMA!', 'WEG HIER!', 'IIIH!', 'MEIN SEKT!']), '#ffd0c0');
        const [tx, ty] = ziele[i % ziele.length];
        const x = tx * T + 8 + rnd(-6, 6), y = ty * T + 14 + rnd(-4, 4);
        const dx = x - g.sp.x, dy = y - g.sp.y;
        const dir = Math.abs(dx) > Math.abs(dy) ? 'side' : dy < 0 ? 'up' : 'down';
        if (this.anims.exists(`${g.sheet}_${dir}`)) g.sp.play(`${g.sheet}_${dir}`);
        g.sp.setFlipX(dir === 'side' && dx < 0);
        this.tweens.add({
          targets: g.sp, x, y, duration: (Math.hypot(dx, dy) / 120) * 1000, ease: 'Quad.easeOut',
          onUpdate: () => { g.sp.setDepth(g.sp.y); g.shadow.setPosition(g.sp.x, g.sp.y - 1); },
          onComplete: () => { g.sp.anims.stop(); g.sp.setFrame(0); this.tweens.add({ targets: g.sp, x: g.sp.x + 1, duration: 60, yoyo: true, repeat: -1 }); },
        });
      });
    });
    extra.forEach((sp, i) => this.tweens.add({ targets: sp, y: sp.y + 6 + i * 2, x: sp.x + (i % 2 ? 10 : -10), duration: 500, delay: 150 + i * 120, ease: 'Quad.easeOut', onUpdate: () => sp.setDepth(sp.y) }));
  }

  // ---------------------------------------------------------------- Der Tentakel

  private tentakelStart() {
    const bahn = this.bahn(2);
    const g = this.add.graphics().setDepth(4500);
    const licht = this.addLight(bahn[0][0], bahn[0][1], 0.8, 0.7).setTint(0x6aff4a);
    const tk = { g, licht, bahn, kopf: 0, wickel: 0, panik: false, tropfen: 0 };
    // Tür: grüner Schwall
    for (let i = 0; i < 18; i++) {
      const d = this.add.circle(18 * T + 8, 17 * T, rnd(1, 3), pick([0x6aff4a, 0x3aa02a, 0x8a4aaa]), 0.9).setDepth(4501);
      this.tweens.add({ targets: d, x: d.x + rnd(-24, 24), y: d.y - rnd(4, 30), alpha: 0, duration: rnd(400, 900), ease: 'Quad.easeOut', onComplete: () => d.destroy() });
    }
    this.time.addEvent({ delay: 16, loop: true, callback: () => { if (g.active) this.tentakelMalen(tk); } });
    return tk;
  }

  /** Der Kopf kriecht den Weg entlang, der Körper hängt bis zur Tür nach; Schleim tropft und bleibt liegen */
  private tentakelKriecht(tk: ReturnType<ClubScene['tentakelStart']>, ms: number, jedesBild: () => void) {
    return new Promise<void>((done) => {
      this.tweens.addCounter({
        from: 0, to: tk.bahn.length - 1, duration: ms, ease: 'Sine.easeInOut',
        onUpdate: (tw) => {
          const k = Math.floor(tw.getValue() ?? 0);
          if (k > tk.kopf + 2) {
            tk.kopf = k;
            const [x, y] = tk.bahn[k];
            tk.licht.setPosition(x, y);
            if (k % 4 === 0) {
              const b = this.add.image(x + rnd(-2, 2), y + rnd(-1, 2), 'hz_schleim').setScale(0).setDepth(1.5).setAngle(rnd(-30, 30));
              this.tweens.add({ targets: b, scale: Phaser.Math.FloatBetween(0.8, 1.4), duration: 300 });
            }
            if (k % 7 === 0) audio.sfx(pick(['slap', 'gurgle']));
          }
          jedesBild();
        },
        onComplete: () => done(),
      });
    });
  }

  private tentakelWickelt(tk: ReturnType<ClubScene['tentakelStart']>, ms: number) {
    return new Promise<void>((done) => this.tweens.add({ targets: tk, wickel: 1, duration: ms, ease: 'Quad.easeOut', onComplete: () => done() }));
  }

  /**
   * Zeichnet den Tentakel: dicker, pulsierender Leib von der Tür bis zum Kopf, Schleimglanz, Saugnäpfe, Geweih-Ende.
   * Beim Umwickeln läuft das Ende als Spirale um Jan.
   */
  private tentakelMalen(tk: ReturnType<ClubScene['tentakelStart']>) {
    const g = tk.g.clear();
    const t = this.time.now / 1000;
    const n = Math.max(2, tk.kopf);
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const [x, y] = tk.bahn[i];
      const [x2, y2] = tk.bahn[Math.min(i + 1, tk.bahn.length - 1)];
      const ang = Math.atan2(y2 - y, x2 - x) + Math.PI / 2;
      const s = i / n;
      const wob = Math.sin(t * 6 + i * 0.18) * 1.6 * s;
      const dick = (1.8 + 6.5 * Math.pow(1 - s, 0.8)) * (1 + 0.2 * Math.sin(t * 9 - i * 0.22));
      pts.push([x + Math.cos(ang) * wob, y + Math.sin(ang) * wob, dick]);
    }
    // Wickel: Spirale um Jan
    if (tk.wickel > 0) {
      const [jx, jy] = [JAN_TRAU.x, JAN_TRAU.y];
      const m = Math.floor(26 * tk.wickel);
      for (let k = 1; k <= m; k++) {
        const a = k * 0.55 + t * 2;
        pts.push([jx + Math.cos(a) * 6.5, jy - 1 - k * 0.5 + Math.sin(a) * 2, 2.2 + 1.2 * (1 - k / 26)]);
      }
    }
    for (const [x, y, r] of pts) g.fillStyle(0x16380f, 0.95).fillCircle(x, y + 1.2, r + 1.4);
    pts.forEach(([x, y, r], i) => g.fillStyle(i % 3 ? 0x6a2e8a : 0x7a3a9a).fillCircle(x, y, r));
    pts.forEach(([x, y, r]) => g.fillStyle(0xa86ac8, 0.85).fillCircle(x - r * 0.2, y - r * 0.4, r * 0.45));
    pts.forEach(([x, y, r], i) => {
      if (i % 5 === 0 && r > 2.4) { g.fillStyle(0xf0b0c8).fillCircle(x + r * 0.55, y + r * 0.25, r * 0.32); g.fillStyle(0xa04870).fillCircle(x + r * 0.55, y + r * 0.25, r * 0.14); }
      if (i % 9 === 4) g.fillStyle(0xc8ffb0, 0.7).fillCircle(x - r * 0.3, y - r * 0.55, Math.max(0.6, r * 0.18));
    });
    // Geweih-Ende am Kopf
    const [ex, ey] = pts[pts.length - 1], [qx, qy] = pts[Math.max(0, pts.length - 3)];
    const a = Math.atan2(ey - qy, ex - qx);
    g.lineStyle(1.4, 0x8a4aaa);
    for (const da of [-0.8, 0, 0.8]) {
      const x2 = ex + Math.cos(a + da) * 6, y2 = ey + Math.sin(a + da) * 6;
      g.lineBetween(ex, ey, x2, y2);
      g.lineBetween(x2, y2, x2 + Math.cos(a + da * 2.2) * 3, y2 + Math.sin(a + da * 2.2) * 3);
    }
    g.fillStyle(0xd0a0ff).fillCircle(ex, ey, 1.3);
    // Schleim tropft
    if (Math.random() < 0.35) {
      const [dx, dy, dr] = pts[Math.floor(Math.random() * pts.length)];
      const tr = this.add.circle(dx + rnd(-2, 2), dy, Math.max(0.6, dr * 0.25), 0x6aff4a, 0.9).setDepth(4501);
      this.tweens.add({ targets: tr, y: dy + rnd(3, 7), alpha: 0.2, duration: 380, ease: 'Quad.easeIn', onComplete: () => tr.destroy() });
    }
  }

  private addKevin() {
    const seat = this.seatAt(KEVIN_SEAT)!;
    seat.kevin = true;
    const [x, y] = KEVIN_SEAT;
    const kevin = this.add.sprite(x * T + 8, y * T + 15, 'kevinSit', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y * T + 14);
    this.interacts.push({ x: x * T + 2, y: y * T + 10, r: 20, label: () => 'Mit Kevin reden', act: () => this.talk('kevinClub', (a) => this.kevinDone(a)) });
    this.time.addEvent({
      delay: 2600, loop: true,
      callback: () => {
        const near = this.dancers.find((d) => !d.hidden && d.dancing && Phaser.Math.Distance.Between(d.sp.x, d.sp.y, kevin.x, kevin.y) < 6 * T);
        if (!near || Math.random() > 0.6) return;
        kevin.setFrame(1);
        floatText(this, kevin.x, kevin.y - 26, pick(['JAAA!', 'BRUDER!', 'BRAVO!', 'ZUGABE!']), '#ff8a50').setDepth(5004);
        if (Math.random() < 0.5) this.bill(kevin.x + 4, kevin.y - 18, near.sp.x, near.sp.y - 4);
        this.time.delayedCall(900, () => kevin.active && kevin.setFrame(0));
      },
    });
  }

  private spawn(sheet: string, at: Pt, walk: (x: number, y: number) => boolean, speed: number, dy = 0): Npc {
    const [x, y] = at;
    const sp = this.add.sprite(x * T + 8, y * T + 14 + dy, sheet, 0).setOrigin(0.5, 1).setScale(0.5);
    const shadow = this.add.image(sp.x, sp.y - 1, 'shadow').setDepth(1).setVisible(dy === 0);
    const n: Npc = {
      sheet, sp, shadow, tx: x, ty: y, path: [], moving: false, speed, dy, walk, facing: 'down',
      waitT: 0, rerouted: false, seated: false, hidden: false, dancing: false, busyTween: false,
    };
    this.npcs.push(n);
    this.occ.set(K(x, y), n);
    return n;
  }

  private seatAt(at: Pt) {
    return this.seats.find((s) => s.at[0] === at[0] && s.at[1] === at[1]);
  }

  private hide(n: Npc) {
    n.hidden = true;
    n.sp.setVisible(false);
    n.shadow.setVisible(false);
  }

  /** Gast setzt sich auf seinen Platz (bzw. stellt sich an den Stehtisch) */
  private sit(n: Npc) {
    const s = n.seat!;
    const [x, y] = s.at;
    n.seated = true;
    n.sp.anims.stop();
    n.tx = x;
    n.ty = y;
    if (s.pose === 'side') n.sp.setFrame(10).setFlipX(s.flip).setPosition(x * T + 8 + (s.flip ? 1 : -1), y * T + 14);
    else if (s.pose === 'back') n.sp.setFrame(11).setFlipX(false).setPosition(x * T + 8, y * T + (this.rows[y][x] === 'x' ? 12 : 15));
    else n.sp.setFrame(6).setFlipX(s.flip).setPosition(x * T + 8, y * T + 14);
    n.shadow.setVisible(s.pose === 'stand');
    this.occ.set(K(x, y), n);
  }

  // ---------------------------------------------------------------- Wege

  private goTo(n: Npc, goal: Pt, done?: () => void): boolean {
    const path = this.findPath(n, goal);
    if (!path) return false;
    n.seated = false;
    n.shadow.setVisible(!n.hidden && n.dy === 0);
    n.path = path;
    n.waitT = 0;
    n.rerouted = false;
    n.done = done;
    if (!path.length) {
      n.done = undefined;
      this.time.delayedCall(0, () => done?.());
    }
    return true;
  }

  /** A* über die Kacheln, acht Richtungen ohne Ecken zu schneiden. Belegte Kacheln sind teurer, damit Wege um Leute herumführen. */
  private findPath(n: Npc, goal: Pt, avoid = -1): Pt[] | null {
    const W = this.rows[0].length, H = this.rows.length;
    const start = K(n.tx, n.ty), end = K(goal[0], goal[1]);
    if (start === end) return [];
    const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && K(x, y) !== avoid && (K(x, y) === end || n.walk(x, y));
    const h = (k: number) => {
      const dx = Math.abs((k % 64) - goal[0]), dy = Math.abs(Math.floor(k / 64) - goal[1]);
      return Math.max(dx, dy) + 0.41 * Math.min(dx, dy);
    };
    const onStage = (x: number, y: number) => 'SOP'.includes(this.rows[y][x]);
    const g = new Map<number, number>([[start, 0]]);
    const from = new Map<number, number>();
    const open = new Set<number>([start]);
    while (open.size) {
      let cur = -1, best = Infinity;
      for (const k of open) {
        const f = g.get(k)! + h(k);
        if (f < best) { best = f; cur = k; }
      }
      if (cur === end) {
        const out: Pt[] = [];
        for (let k = cur; k !== start; k = from.get(k)!) out.push([k % 64, Math.floor(k / 64)]);
        return out.reverse();
      }
      open.delete(cur);
      const cx = cur % 64, cy = Math.floor(cur / 64);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (!ok(nx, ny)) continue;
          if (dx && dy && (!ok(cx + dx, cy) || !ok(cx, cy + dy))) continue;
          // von der Bühne herunter und hinauf nur über die Treppen
          if (onStage(cx, cy) !== onStage(nx, ny) && this.rows[cy][cx] !== 'e' && this.rows[ny][nx] !== 'e') continue;
          const nk = K(nx, ny);
          const o = this.occ.get(nk);
          const ng = g.get(cur)! + (dx && dy ? 1.41 : 1) + (o && o !== n && !o.moving ? 3 : 0);
          if (ng < (g.get(nk) ?? Infinity)) {
            g.set(nk, ng);
            from.set(nk, cur);
            open.add(nk);
          }
        }
    }
    return null;
  }

  private idleFrame(n: Npc) {
    n.sp.anims.stop();
    n.sp.setFrame(n.facing === 'down' ? 0 : n.facing === 'up' ? 3 : 6);
  }

  private stepNpc(n: Npc, dt: number) {
    const next = n.path[0];
    if (!n.moving) {
      const k = K(next[0], next[1]);
      const o = this.occ.get(k);
      if ((o && o !== n) || this.playerTiles.has(k)) {
        n.waitT += dt;
        this.idleFrame(n);
        if (n.waitT > 700 && !n.rerouted) {
          // einmal einen Umweg versuchen, sonst kurz warten und (notfalls) vorbeidrängeln
          n.rerouted = true;
          const alt = this.findPath(n, n.path[n.path.length - 1], k);
          if (alt && alt.length) n.path = alt;
          return;
        }
        if (n.waitT < 3500) return;
      }
      n.waitT = 0;
      n.rerouted = false;
      this.occ.set(k, n);
      n.moving = true;
      const dx = next[0] - n.tx, dy = next[1] - n.ty;
      n.facing = dx ? 'side' : dy < 0 ? 'up' : 'down';
      if (dx) n.sp.setFlipX(dx < 0);
      n.sp.anims.play(`${n.sheet}_${n.facing}`, true);
    }
    const tx = next[0] * T + 8, ty = next[1] * T + 14 + n.dy;
    const sp = n.sp;
    const d = Math.hypot(tx - sp.x, ty - sp.y);
    const v = (n.speed * dt) / 1000;
    if (d > v) {
      sp.x += ((tx - sp.x) / d) * v;
      sp.y += ((ty - sp.y) / d) * v;
      return;
    }
    sp.setPosition(tx, ty);
    const prev = K(n.tx, n.ty);
    if (this.occ.get(prev) === n) this.occ.delete(prev);
    [n.tx, n.ty] = next;
    n.path.shift();
    n.moving = false;
    if (!n.path.length) {
      this.idleFrame(n);
      const cb = n.done;
      n.done = undefined;
      cb?.();
    }
  }

  /** freie, begehbare Kachel neben einem Sitzplatz (für Tänzer und Kellner) */
  private besideSeat(s: Seat, n: Npc): Pt | undefined {
    const [x, y] = s.at;
    const cand: Pt[] = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1], [x + 1, y + 1], [x - 1, y + 1], [x + 1, y - 1], [x - 1, y - 1]];
    const free = cand.filter(([cx, cy]) => n.walk(cx, cy) && !this.occ.get(K(cx, cy)) && !this.playerTiles.has(K(cx, cy)));
    free.sort((a, b) => Math.hypot(a[0] - n.tx, a[1] - n.ty) - Math.hypot(b[0] - n.tx, b[1] - n.ty));
    return free[0];
  }

  // ---------------------------------------------------------------- Tänzer

  private dancerEnter(d: Npc) {
    const out = this.dancers.filter((x) => !x.hidden).length;
    const free = this.spots.filter((s) => !s.dancer);
    const spot = free.find((s) => s.main) ?? (Math.random() < 0.5 ? free[0] : undefined);
    const bk = K(...BACKSTAGE);
    if (out >= 3 || !spot || this.occ.get(bk)) {
      this.time.delayedCall(2500, () => this.dancerEnter(d));
      return;
    }
    spot.dancer = d;
    d.hidden = false;
    [d.tx, d.ty] = BACKSTAGE;
    d.sp.setPosition(d.tx * T + 8, d.ty * T + 14).setVisible(true).setAlpha(0).setFrame(0);
    d.shadow.setVisible(true);
    d.facing = 'down';
    this.occ.set(bk, d);
    this.tweens.add({ targets: d.sp, alpha: 1, duration: 400 });
    if (!this.goTo(d, spot.stand, () => this.perform(d, spot, rnd(12000, 18000), 0))) {
      spot.dancer = undefined;
      this.dancerExit(d);
    }
  }

  /** an der Stange: Hüftschwung, Bizeps, Drehung um die Stange, kurz hochklettern */
  private perform(d: Npc, spot: Spot, ms: number, round: number) {
    spot.dancer = d;
    d.dancing = true;
    d.light!.setVisible(true);
    const [px, py] = spot.pole;
    const cx = px * T + 8, base = py * T + 13;
    const home = { x: d.sp.x, y: d.sp.y };
    d.busyTween = true;
    d.sp.anims.stop();
    d.sp.setFrame(3);
    this.tweens.add({ targets: d.sp, x: cx, y: base + 4, duration: 450, onComplete: () => { d.busyTween = false; } });
    let beat = 0;
    const ev = this.time.addEvent({
      delay: 600, loop: true,
      callback: () => {
        if (d.busyTween) return;
        beat++;
        if (beat % 7 === 3) this.poleSpin(d, cx, base);
        else if (beat % 11 === 6) this.poleClimb(d);
        else d.sp.setFrame(pick([12, 13, 0, 14, 15, 12, 13])).setFlipX(Math.random() < 0.5);
      },
    });
    const finish = () => {
      if (d.busyTween) {
        this.time.delayedCall(300, finish);
        return;
      }
      ev.remove();
      this.tweens.add({
        targets: d.sp, x: home.x, y: home.y, duration: 350,
        onComplete: () => {
          d.dancing = false;
          d.light!.setVisible(false);
          spot.dancer = undefined;
          this.dancerNext(d, round + 1);
        },
      });
    };
    this.time.delayedCall(ms, finish);
  }

  private poleSpin(d: Npc, cx: number, base: number) {
    d.busyTween = true;
    this.tweens.addCounter({
      from: 0, to: 1, duration: 1500, ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const a = Math.PI / 2 + (tw.getValue() ?? 0) * Math.PI * 2;
        const s = Math.sin(a), c = Math.cos(a);
        d.sp.setPosition(cx + c * 6, base + 1 + s * 3).setFrame(s > 0.35 ? 12 : s < -0.35 ? 14 : 15).setFlipX(c < 0);
      },
      onComplete: () => {
        d.sp.setPosition(cx, base + 4);
        d.busyTween = false;
      },
    });
  }

  private poleClimb(d: Npc) {
    d.busyTween = true;
    d.sp.setFrame(12);
    this.tweens.add({ targets: d.sp, y: d.sp.y - 10, duration: 500, yoyo: true, hold: 700, ease: 'Sine.easeOut', onComplete: () => { d.busyTween = false; } });
  }

  private dancerNext(d: Npc, round: number) {
    const r = Math.random();
    const runway = this.spots.find((s) => !s.main && !s.dancer);
    if (round < 2 && r < 0.4 && runway) {
      runway.dancer = d;
      if (this.goTo(d, runway.stand, () => this.perform(d, runway, rnd(9000, 14000), round))) return;
      runway.dancer = undefined;
    }
    if (round < 3 && r < 0.85) this.dancerTour(d, rnd(1, 3));
    else this.dancerExit(d);
  }

  /** durch den Saal: vor einzelnen Gästen tanzen */
  private dancerTour(d: Npc, left: number) {
    if (left <= 0) return this.dancerExit(d);
    const targets = this.seats.filter((s) => (s.guest?.seated && !s.guest.dancedFor) || s.kevin);
    const s = targets.length ? pick(targets) : undefined;
    const spot = s && this.besideSeat(s, d);
    if (!s || !spot) return this.dancerExit(d);
    if (s.guest) s.guest.dancedFor = d;
    if (!this.goTo(d, spot, () => this.danceFor(d, s, left))) {
      if (s.guest) s.guest.dancedFor = undefined;
      this.dancerExit(d);
    }
  }

  private danceFor(d: Npc, s: Seat, left: number) {
    // Gast ist inzwischen aufgestanden: weiter zum nächsten
    if (s.guest && !s.guest.seated) {
      s.guest.dancedFor = undefined;
      return this.dancerTour(d, left);
    }
    d.dancing = true;
    const toward = s.at[0] < d.tx;
    let beat = 0;
    const ev = this.time.addEvent({
      delay: 550, loop: true,
      callback: () => {
        beat++;
        d.sp.setFrame([15, 13, 12, 14, 15, 13][beat % 6]).setFlipX(beat % 6 === 3 ? !toward : toward);
        const g = s.guest;
        if (g && beat % 3 === 0) {
          if (Math.random() < 0.6) this.heart(g.sp.x, g.sp.y - 18);
          else this.bill(g.sp.x, g.sp.y - 14, d.sp.x, d.sp.y - 4);
        }
      },
    });
    this.time.delayedCall(rnd(5000, 7500), () => {
      ev.remove();
      d.dancing = false;
      if (s.guest) s.guest.dancedFor = undefined;
      this.dancerTour(d, left - 1);
    });
  }

  private dancerExit(d: Npc) {
    const ok = this.goTo(d, BACKSTAGE, () => {
      this.tweens.add({
        targets: d.sp, alpha: 0, duration: 350,
        onComplete: () => {
          this.hide(d);
          if (this.occ.get(K(...BACKSTAGE)) === d) this.occ.delete(K(...BACKSTAGE));
          this.time.delayedCall(rnd(5000, 14000), () => this.dancerEnter(d));
        },
      });
    });
    if (!ok) this.time.delayedCall(1500, () => this.dancerExit(d));
  }

  // ---------------------------------------------------------------- Gäste und Personal

  private outing(g: Npc) {
    const later = () => this.time.delayedCall(rnd(35000, 90000), () => this.outing(g));
    if (!g.seated || g.dancedFor) return later();
    const vip = g.seat!.at[1] >= 14;
    const r = Math.random();
    if (r < 0.55 && !vip) {
      const spot = BAR_SPOTS.find((s) => !this.barTaken.has(K(...s)) && !this.occ.get(K(...s)));
      if (spot) {
        this.barTaken.add(K(...spot));
        if (this.goTo(g, spot, () => this.atBar(g, spot, later))) return;
        this.barTaken.delete(K(...spot));
      }
    } else if (r < 0.85 && this.goTo(g, WC_FRONT, () => this.atWc(g, later))) return;
    later();
  }

  private atBar(g: Npc, spot: Pt, later: () => void) {
    g.facing = 'up';
    g.sp.setFrame(3).setFlipX(false);
    this.barWait.push(spot[0]);
    this.time.delayedCall(rnd(4000, 7000), () => {
      this.barWait.splice(this.barWait.indexOf(spot[0]), 1);
      this.barTaken.delete(K(...spot));
      this.say(g, pick(['PROST!', 'LECKER!', 'NOCH EINEN!']), '#ffd0f0');
      this.back(g, later);
    });
  }

  private atWc(g: Npc, later: () => void) {
    const y = g.sp.y;
    this.tweens.add({ targets: g.sp, alpha: 0, y: y + 6, duration: 300, onComplete: () => this.hide(g) });
    this.time.delayedCall(rnd(5000, 9000), () => {
      g.hidden = false;
      g.sp.setVisible(true);
      g.shadow.setVisible(true);
      this.tweens.add({ targets: g.sp, alpha: 1, y, duration: 300, onComplete: () => this.back(g, later) });
    });
  }

  private back(g: Npc, later: () => void) {
    if (!this.goTo(g, g.seat!.at, () => { this.sit(g); later(); })) this.time.delayedCall(2000, () => this.back(g, later));
  }

  private serve(w: Npc) {
    const seats = this.seats.filter((s) => s.guest?.seated && !s.guest.dancedFor);
    const s = seats.length ? pick(seats) : undefined;
    const spot = s && this.besideSeat(s, w);
    const ok = !!s && !!spot && this.goTo(w, spot, () => {
      w.facing = 'side';
      w.sp.setFrame(6).setFlipX(s.at[0] < w.tx);
      this.time.delayedCall(1600, () => {
        if (s.guest?.seated) this.say(s.guest, pick(['DANKE!', 'PROST!', 'SÜSS!']), '#ffd0f0');
        this.toPickup(w);
      });
    });
    if (!ok) this.time.delayedCall(2000, () => this.toPickup(w));
  }

  private toPickup(w: Npc) {
    const ok = this.goTo(w, PICKUP, () => {
      w.facing = 'down';
      w.sp.setFrame(0);
      this.time.delayedCall(rnd(2500, 4500), () => this.serve(w));
    });
    if (!ok) this.time.delayedCall(1500, () => this.toPickup(w));
  }

  private barLoop(b: Npc) {
    const want = this.barWait.length ? this.barWait[0] : rnd(22, 28);
    const ok = this.goTo(b, [want, 2], () => {
      b.facing = 'down';
      b.sp.setFrame(0);
      this.tweens.add({ targets: b.sp, x: b.sp.x + 1, duration: 120, yoyo: true, repeat: 5 });
      this.time.delayedCall(rnd(1800, 3800), () => this.barLoop(b));
    });
    if (!ok) this.time.delayedCall(1500, () => this.barLoop(b));
  }

  /** Publikum: jubeln, Herzchen, Scheine werfen, wenn in der Nähe getanzt wird; sonst ab und zu plaudern */
  private crowd() {
    const active = this.dancers.filter((d) => !d.hidden && d.dancing);
    for (const s of this.seats) {
      const g = s.guest;
      if (!g || !g.seated || g.hidden || Math.random() > 0.12) continue;
      const near = active.find((d) => Phaser.Math.Distance.Between(d.sp.x, d.sp.y, g.sp.x, g.sp.y) < 7 * T);
      if (!near) {
        if (Math.random() < 0.15) this.say(g, pick(CHATTER), '#d8c8e8');
        continue;
      }
      const r = Math.random();
      if (r < 0.4) this.say(g, pick(CHEERS), '#ffb0e0');
      else if (r < 0.75) this.heart(g.sp.x, g.sp.y - 18);
      else this.bill(g.sp.x, g.sp.y - 14, near.sp.x, near.sp.y - 4);
    }
  }

  private say(n: Npc, s: string, color: string) {
    floatText(this, n.sp.x, n.sp.y - 24, s, color).setDepth(5004);
  }

  private heart(x: number, y: number) {
    const h = this.add.image(x, y, 'clubHeart').setScale(0.5).setDepth(5004);
    this.tweens.add({ targets: h, y: y - 14, alpha: 0, duration: 900, ease: 'Sine.easeOut', onComplete: () => h.destroy() });
  }

  /** Geldschein fliegt im Bogen und bleibt eine Weile auf der Bühne liegen */
  private bill(x0: number, y0: number, x1: number, y1: number) {
    const b = this.add.image(x0, y0, 'clubBill').setScale(0.5).setDepth(4999);
    const tx = x1 + rnd(-6, 6), ty = y1 + rnd(-2, 3);
    this.tweens.addCounter({
      from: 0, to: 1, duration: 520,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        b.setPosition(x0 + (tx - x0) * v, y0 + (ty - y0) * v - Math.sin(v * Math.PI) * 18);
        b.angle += 25;
      },
      onComplete: () => {
        b.setDepth(ty - 2).setAngle(rnd(-30, 30));
        this.tweens.add({ targets: b, alpha: 0, delay: 7000, duration: 800, onComplete: () => b.destroy() });
      },
    });
  }

  // ---------------------------------------------------------------- Bild für Bild

  private tick(dt: number) {
    // Kacheln unter dem Wirt: dort läuft niemand hindurch
    const p = this.player;
    const fy = p.y - 3;
    this.playerTiles.clear();
    for (const [x, y] of [[p.x - 4, fy - 3], [p.x + 4, fy - 3], [p.x - 4, fy + 3], [p.x + 4, fy + 3]]) this.playerTiles.add(K(Math.floor(x / T), Math.floor(y / T)));

    for (const n of this.npcs) {
      if (n.hidden) continue;
      if (n.path.length && !this.kino) this.stepNpc(n, dt);
      n.sp.setDepth(n.sp.y);
      n.shadow.setPosition(n.sp.x, n.sp.y - 1);
      if (n.light?.visible) n.light.setPosition(n.sp.x, n.sp.y - 12);
      if (n.tray) n.tray.setPosition(n.sp.x + (n.sp.flipX ? -5 : 5), n.sp.y - 12).setDepth(n.sp.y + 1).setVisible(n.facing !== 'up');
    }

    // Trinkgeld: nächster tanzender Tänzer in Reichweite
    let best: Npc | undefined, bd = 46;
    for (const d of this.dancers) {
      if (d.hidden || !d.dancing) continue;
      const dd = Phaser.Math.Distance.Between(p.x, p.y - 4, d.sp.x, d.sp.y - 4);
      if (dd < bd) { bd = dd; best = d; }
    }
    this.tipTarget = best;
    this.tipIt.x = best ? best.sp.x : -9999;
    this.tipIt.y = best ? best.sp.y - 4 : -9999;

    // Glitzerpunkte der Spiegelkugel wandern durch den Raum
    const g = this.sparkles;
    if (g) {
      g.clear();
      const t = this.time.now * 0.00025;
      for (let i = 0; i < 28; i++) {
        const a = t + i * 2.39, rr = 30 + ((i * 37) % 140);
        g.fillStyle(i % 3 ? 0xffffff : 0xffb0e0, 0.55).fillRect(Math.round(BALL.x + Math.cos(a) * rr * 1.5), Math.round(BALL.y + 60 + Math.sin(a) * rr * 0.6), 1, 1);
      }
    }
  }
}
