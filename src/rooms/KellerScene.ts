import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { Interact, T, TileInfo, TopDown } from '../scenes/TopDown';
import { fadeTo, floatText, txt } from '../ui';
import { WandlungUI } from './WandlungUI';
import { DaemonFigur } from './daemonFigur';
import { WANDEL_STUFEN } from './daemonGfx';
import type { DialogAction } from '../dialog/data';
import { DACH_TREPPE_SPAWN, KELLER_SPAWN } from './spawns';
import { weltZiel } from '../progress/quests';
import { KELLER_BPM } from '../music/kellerSong';

// Nicks Keller unter dem Dachboden (räumlich unmöglich, darum geht es). Schwarz und Dunkelrot, Nebel, Verstärker,
// Kabel, Poster. Vorne die Bühne mit Nick, davor das Publikum: Goths, Emos, Metaller, Rocker.
//  0-4 Wand mit Poster  A Verstärker  S Bühne  D Schlagzeug  k Bühnenkante  s Sofa  c Kerzen  f Nebelmaschine
//  K Kisten  U Treppe nach oben

const MAP = [
  '########################',
  '#0##1###2####3###4##0###',
  '#AASSSSSSSSSSSSSSSSSSAA#',
  '#AASSSSSSSDDSSSSSSSSSAA#',
  '#..SSSSSSSSSSSSSSSSSS..#',
  '#..kkkkkkkkkkkkkkkkkk..#',
  '#......................#',
  '#......................#',
  '#c....................f#',
  '#......................#',
  '#ss...................K#',
  '#......................#',
  '#ss...................K#',
  '#......................#',
  '#......................#',
  '###########U############',
];

type Pt = [number, number];
type Pt2 = [number, number];
/** Mitte und Radien des Pentagramms auf der freien Fläche vor der Bühne */
const PX = 12 * 16, PY = 10 * 16 + 8, RX = 36, RY = 22;
const NICK_AT: Pt = [12, 4];
const BEAT = 60000 / KELLER_BPM;

interface Gast {
  id: string;
  sp: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  tx: number;
  ty: number;
  path: Pt[];
  art: 'bang' | 'sitz' | 'lauf' | 'kino';
  pause: number;
  it?: Interact;
}

const SPRUECHE: Record<string, string[]> = {
  goth: ['Ich bin nicht traurig. Ich bin ästhetisch.', 'Mein Lieblingstag ist Montag. Weil ihn alle hassen.'],
  gothM: ['Das Licht hier ist zu hell. Ich seh fast was.', 'Ich hab heute schon zweimal gelächelt. Aus Versehen.'],
  emo: ['Niemand versteht mich. Nicht mal ich.', 'Ich hab ein Gedicht über deine Kneipe geschrieben. Es heißt „Leere“.'],
  metal: ['BRUTAL! ... Sorry. Ich sag das zu allem. Auch zu Suppe.', 'Ich hab seit 1998 nicht mehr geblinzelt. Für die Kunst.'],
  rocker: ['Früher war Rock noch Rock. Heute ist Rock auch Rock. Aber anders.', 'Meine Weste ist älter als dein Mietvertrag.'],
  punk: ['Ich bin gegen alles. Außer gegen Nicks Preise.', 'Keine Macht für niemand. Aber bitte mit Kartenzahlung.'],
  metal2: ['Nick spielt so schnell, dass die Töne erst morgen ankommen.', 'Ich hab ein Pentagramm-Tattoo. Am Knie. Ist eher ein Fünfeck geworden.'],
};
const SPRUECHE_FREI: Record<string, string[]> = {
  goth: ['Nick trägt jetzt Weiß. Ich trauere um sein altes Ich. In Schwarz, natürlich.'],
  gothM: ['Er hat uns Matcha angeboten. MATCHA. Ich hab ihn trotzdem getrunken. Er war grün. Wie Verwesung.'],
  emo: ['Nick ist jetzt glücklich. Das ist irgendwie das Traurigste, was ich je gesehen hab.'],
  metal: ['Er spielt immer noch brutal. Nur sauberer. Brutal sauber.'],
  rocker: ['Weißer Anzug im Keller. Mutig. Hier tropft es von der Decke.'],
  punk: ['Ich bin immer noch gegen alles. Jetzt auch gegen Weiß.'],
  metal2: ['Borna verkauft jetzt oben. Billig ist er nicht. Aber er grüßt nett.'],
};

export class KellerScene extends TopDown {
  private gaeste: Gast[] = [];
  private nick?: Phaser.GameObjects.Sprite;
  private gitarre?: Phaser.GameObjects.Image;
  private beatT = 0;
  private beatN = 0;
  private buehnenLicht: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Keller');
  }

  init() {
    super.init();
    this.gaeste = [];
    this.nick = undefined;
    this.gitarre = undefined;
    this.beatT = 0;
    this.beatN = 0;
    this.buehnenLicht = [];
    this.kino = false;
    this.kinoAus = false;
    this.ui = undefined;
    this.nickSchatten = undefined;
    this.daemon = undefined;
    this.blitzG = undefined;
    this.morphZiel = undefined;
    this.rissPunkte = [];
  }

  protected mapRows() { return MAP; }
  protected isWall(ch: string) { return '#01234U'.includes(ch); }
  protected darkness() { return state.flags.nick === 'boss' && state.flags.nickWandlung ? 0.6 : 0.4; }
  protected floorKey(x: number, y: number) {
    const ch = this.rows[y][x];
    if ('SDA'.includes(ch) && y >= 2 && y <= 4) return 'kellerBuehne';
    return `kellerBoden${(x * 5 + y * 3) % 2}`;
  }

  protected tileFor(ch: string): TileInfo {
    switch (ch) {
      case '#': return { key: 'kellerWandFront', solid: true };
      case '0': case '1': case '2': case '3': case '4': return { key: `kellerPoster${ch}Front`, solid: true };
      case 'U': return { key: 'kellerTreppeHoch', solid: true };
      case 'k': return { key: 'kellerKante', solid: true };
      case 'S': return { key: '', solid: true };
      case '.': return { key: '', solid: false };
      // Möbel und Verstärker setzt setupWorld als eigene Bilder
      default: return { key: '', solid: true };
    }
  }

  protected goalText() {
    const f = state.flags;
    if (f.nick && f.nick !== 'frei') return weltZiel(f);
    return 'Nicks Proberaum. Ab und zu jammt er gern.';
  }

  protected setupWorld() {
    const f = state.flags;
    const zerstoert = f.nick === 'boss' && !!f.nickWandlung;
    audio.music(zerstoert ? 'none' : f.nick === 'frei' ? 'kellerClean' : 'keller');
    void audio.ladeDatei('duell');
    this.einrichtung();
    this.licht();
    this.nebel();
    if (zerstoert) this.verwuestet();
    else {
      this.publikum();
      this.addNick();
      // Koks schon übergeben, Verwandlung aber noch nicht gesehen (Spiel dazwischen verlassen): gleich weiter
      if (f.nick === 'boss') this.time.delayedCall(900, () => void this.wandlung());
    }
    // Treppe nach oben (auf den Dachboden. Ja.)
    const [ux, uy] = this.find('U');
    this.interacts.push({ x: ux * T + 8, y: uy * T - 2, r: 16, label: () => 'Hoch auf den Dachboden', act: () => this.go('Dach', { spawn: DACH_TREPPE_SPAWN }) });
  }

  update(t: number, delta: number) {
    super.update(t, delta);
    const dt = Math.min(delta, 50);
    this.takt(dt);
    for (const g of this.gaeste) this.schritt(g, dt);
    if (this.kino) this.kinoUpdate(delta);
  }

  private find(ch: string): Pt {
    for (let y = 0; y < this.rows.length; y++) {
      const x = this.rows[y].indexOf(ch);
      if (x >= 0) return [x, y];
    }
    return [1, 1];
  }

  // ---------------------------------------------------------------- Einrichtung

  private einrichtung() {
    const obj = (key: string, x: number, y: number, flip = false) => this.add.image(x, y, key).setOrigin(0.5, 1).setScale(0.5).setFlipX(flip).setDepth(y);
    for (const [x, flip] of [[1, false], [21, true]] as const) {
      obj('kellerAmp', (x + 0.5) * T, 3 * T + 15, flip);
      obj('kellerAmp', (x + 1.5) * T, 3 * T + 15, flip);
      obj('kellerAmp', (x + 1) * T, 2 * T + 13, flip).setDepth(2 * T + 13);
    }
    obj('kellerDrums', 11 * T, 3 * T + 14);
    obj('kellerMikro', 7 * T, 4 * T + 13);
    obj('kellerMikro', 17 * T, 4 * T + 13);
    for (const y of [10, 12]) obj('kellerSofa', 2 * T, y * T + 15);
    const [cx, cy] = this.find('c');
    obj('kellerKerzen', cx * T + 8, cy * T + 14);
    const [fx, fy] = this.find('f');
    obj('kellerNebelMaschine', fx * T + 8, fy * T + 14);
    for (const y of [10, 12]) obj('kellerKisten', 22 * T + 8, y * T + 15);
    // Kabel quer über den Boden
    for (const [x, y] of [[4, 6], [5, 6], [6, 7], [16, 6], [17, 7], [18, 7], [9, 13], [10, 13], [20, 9]]) this.add.image(x * T, y * T, 'kellerKabel').setOrigin(0).setScale(0.5).setDepth(0.6);

    const sieh = (x: number, y: number, label: string, text: () => string) => this.interacts.push({ x, y, r: 16, label: () => label, act: () => this.toast(text()) });
    sieh(2 * T, 4 * T + 8, 'Verstärker', () => 'Alle Regler auf elf. Einer steht auf „Seele“.');
    sieh(22 * T, 4 * T + 8, 'Verstärker', () => 'Ein Aufkleber: „Lauter als die Hölle. Getestet.“');
    sieh(2 * T, 11 * T + 4, 'Sofa', () => 'Das Sofa hat mehr Löcher als Nicks Jeans.');
    sieh(cx * T + 8, cy * T + 10, 'Kerzen', () => 'Ein Totenkopf mit drei Kerzen. Auf dem Kinn klebt ein Preisschild: 4,99 €.');
    sieh(fx * T + 8, fy * T + 10, 'Nebelmaschine', () => 'Wer gegen Nick verliert, putzt die Nebelmaschine. Mit der Zunge. Sagt das Schild.');
    sieh(22 * T + 8, 11 * T + 4, 'Kisten', () => 'Kräuterlikör. Zum Glück nur Kräuter.');
  }

  private licht() {
    const boss = state.flags.nick === 'boss', frei = state.flags.nick === 'frei';
    // Bühnenspots: rot (clean: Weiß und Gold für Nick, rot bleibt fürs Publikum)
    for (const [x, tint, s] of [[4, 0xff2020, 1.1], [12, frei ? 0xfff0d0 : 0xff4030, 1.5], [20, 0xff2020, 1.1]] as const) {
      const l = this.addLight(x * T, 3 * T + 4, s, 0.9).setTint(tint);
      this.tweens.killTweensOf(l);
      this.buehnenLicht.push(l);
    }
    if (frei) this.addLight(12 * T, 4 * T, 0.6, 0.5).setTint(0xd8b850);
    this.addLight(2 * T, 11 * T, 1, 0.6).setTint(0x8a40c0);
    // Raumlicht: rote Glühbirnen an der Decke über dem Publikum
    for (const [x, y] of [[7, 8], [17, 8], [12, 12], [5, 13], [19, 12]]) this.addLight(x * T, y * T, 1.1, 0.42).setTint(0xc02a30);
    const [cx, cy] = this.find('c');
    const k = this.addLight(cx * T + 8, cy * T + 6, 0.55, 0.7).setTint(0xffa040);
    this.tweens.killTweensOf(k);
    this.time.addEvent({ delay: 120, loop: true, callback: () => k.setAlpha(0.55 + Math.random() * 0.2) });
    this.addLight(11 * T + 8, 14 * T + 8, 0.5, 0.35).setTint(boss ? 0xff2020 : 0x806060);
    if (boss) for (const l of this.buehnenLicht) l.setAlpha(0.3);
  }

  private nebel() {
    const [fx, fy] = this.find('f');
    this.add.particles(0, 0, 'light', {
      x: { min: 3 * T, max: 21 * T }, y: { min: 5 * T, max: 8 * T },
      lifespan: 7000, speedX: { min: -5, max: 5 }, speedY: { min: -1, max: 1 },
      scale: { start: 0.5, end: 1.3 }, alpha: { start: 0, end: 0.09, ease: 'Sine.easeInOut' }, tint: 0xd0a8b8, frequency: 260,
    }).setDepth(5002);
    // die Nebelmaschine pustet ab und zu nach
    const puste = this.add.particles(fx * T + 2, fy * T + 10, 'light', {
      lifespan: 2600, speedX: { min: -30, max: -12 }, speedY: { min: -4, max: 2 }, scale: { start: 0.08, end: 0.7 },
      alpha: { start: 0.25, end: 0 }, tint: 0xe0d0d8, emitting: false,
    }).setDepth(5002);
    this.time.addEvent({ delay: 5200, loop: true, callback: () => puste.explode(14) });
  }

  // ---------------------------------------------------------------- Nick auf der Bühne

  private addNick() {
    const frei = state.flags.nick === 'frei';
    const [tx, ty] = NICK_AT;
    const x = tx * T, y = ty * T + 14;
    const nick = this.add.sprite(x, y, frei ? 'nickWeissWalk' : 'nickWalk', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    this.nickSchatten = this.add.image(x, y - 1, 'shadow').setDepth(1);
    this.gitarre = this.add.image(x - 1, y - 7, frei ? 'nickGitWeiss' : 'nickGit').setScale(0.5).setDepth(y + 1).setAngle(-20);
    this.nick = nick;
    this.interacts.push({
      x, y: 6 * T, r: 24,
      label: () => (frei ? 'Mit Nick reden' : 'Mit Nick reden'),
      act: () => this.talk(frei ? 'nickWeiss' : 'nick', (a) => this.nickDone(a)),
    });
  }

  /** Musik-Takt: Bühnenlicht pulsiert, Nick shreddet, das Publikum bangt */
  private takt(dt: number) {
    this.beatT += dt;
    if (this.beatT < BEAT) return;
    this.beatT -= BEAT;
    this.beatN++;
    if (state.flags.nick === 'boss' || this.kino) return;
    const n = this.beatN;
    this.buehnenLicht.forEach((l, i) => l.setAlpha((n + i) % 2 ? 0.55 : 0.85));
    if (this.nick) {
      const frei = state.flags.nick === 'frei';
      this.nick.setFrame(frei ? (n % 4 === 0 ? 13 : 0) : n % 8 < 2 ? 12 : n % 2 ? 15 : 0);
      this.tweens.add({ targets: this.nick, y: this.nick.y + 1, duration: BEAT * 0.3, yoyo: true });
      this.gitarre?.setAngle(-20 + (n % 2 ? 8 : -4));
      if (!frei && n % 16 === 0) floatText(this, this.nick.x, this.nick.y - 22, ['♪♫', '\\m/', 'HAIL!'][Math.floor(n / 16) % 3], '#ff5040').setDepth(6000);
    }
    for (const g of this.gaeste) {
      if (g.art !== 'bang') continue;
      this.tweens.add({ targets: g.sp, y: g.ty * T + 15, duration: BEAT * 0.35, yoyo: true });
      g.sp.setFrame((n + g.tx) % 6 === 0 ? 14 : 3);
    }
  }

  private nickDone(a?: DialogAction) {
    const f = state.flags;
    if (a === 'gitarrenDuell') {
      this.overlay('GitarrenDuell', { mode: 'duell' }, (win: boolean) => {
        if (!win) return this.toast('Nick lacht: „Die Nebelmaschine wartet, Opa. Nochmal?“');
        f.nick = 'koks';
        this.leaving = true;
        fadeTo(this, 'Cutscene', { script: 'nickScheisse', next: { scene: 'Keller', data: { spawn: KELLER_SPAWN } } });
      });
    } else if (a === 'nickKoks' && f.nick === 'koks' && state.inv.koks >= 5) {
      state.inv.koks -= 5;
      f.nick = 'boss';
      f.nickBossPhase = 0;
      void this.wandlung();
    } else if (a === 'nickJam') {
      this.overlay('GitarrenDuell', { mode: 'jam' }, () => this.sichern());
    }
  }

  /** Minispiel über dieser Szene starten (sie pausiert so lange) */
  private overlay(key: string, data: object, onDone: (win: boolean) => void) {
    this.scene.launch(key, { ...data, resume: this.scene.key, onDone });
    this.scene.bringToTop(key);
    this.scene.pause();
  }

  /** Nach der Koks-Übergabe: der Keller ist leer, rot und gesprungen. Unten wartet der Dämon. */
  private verwuestet() {
    const x = 12 * T, y = 8 * T + 8;
    if (this.textures.exists('wandlungRisse')) this.add.image(x, y, 'wandlungRisse').setScale(0.5).setDepth(0.7);
    const glow = this.addLight(x, y, 1.6, 0.7).setTint(0xff1a10);
    this.tweens.killTweensOf(glow);
    this.tweens.add({ targets: glow, alpha: 0.4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({ delay: 2600, loop: true, callback: () => { this.cameras.main.shake(300, 0.002); audio.sfx('rumble'); } });
    this.interacts.push({
      x, y, r: 26, label: () => 'Dem Dämon entgegentreten',
      act: () => this.go('Hoellenboss'),
    });
  }

  // ---------------------------------------------------------------- Die Verwandlung im Raum
  // Nick rastet auf der Bühne aus, springt runter, das Publikum weicht zurück. Auf der freien Fläche streut er ein
  // Pentagramm aus Koks, kniet sich hin und schnieft es Linie für Linie weg: Darunter glüht es rot. Der Keller bebt
  // und reißt auf, Krallen greifen aus den Rissen, alle fliehen. Nick schwebt und verwandelt sich Stufe für Stufe,
  // dann steigt der Riesendämon aus dem Pentagramm. Seine Faust fliegt auf den Wirt zu: Schnitt in den Endkampf.

  private kino = false;
  private kinoAus = false;
  private ui?: WandlungUI;
  private nickSchatten?: Phaser.GameObjects.Image;
  private daemon?: DaemonFigur;
  private blitzG?: Phaser.GameObjects.Graphics;
  private rissPunkte: Pt2[] = [];

  private tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((done) => this.tweens.add({ ...cfg, onComplete: () => done() }));
  }

  /** Figur läuft mit passender Laufanimation zu einem Punkt */
  private laufe(sp: Phaser.GameObjects.Sprite, key: string, x: number, y: number, tempo = 70) {
    const dx = x - sp.x, dy = y - sp.y, d = Math.hypot(dx, dy);
    if (d < 1) return Promise.resolve();
    const dir = Math.abs(dx) > Math.abs(dy) ? 'side' : dy < 0 ? 'up' : 'down';
    if (dir === 'side') sp.setFlipX(dx < 0);
    sp.anims.play(`${key}_${dir}`, true);
    return this.tw({ targets: sp, x, y, duration: (d / tempo) * 1000, onUpdate: () => sp.setDepth(sp.y) }).then(() => {
      sp.anims.stop();
      sp.setFrame(dir === 'up' ? 3 : dir === 'side' ? 6 : 0);
    });
  }

  private async sagK(wer: string, farbe: string, text: string, ms = 2600) {
    if (this.kinoAus) return;
    this.ui?.zeige(wer, farbe, text);
    await this.wartet(ms);
  }

  private kinoUpdate(delta: number) {
    if (this.nick && this.nickSchatten) this.nickSchatten.setPosition(this.nick.x, this.nickSchatten.y);
    this.daemon?.update(delta);
    const g = this.blitzG;
    if (!g) return;
    g.clear();
    if (!this.rissPunkte.length || Math.random() > 0.55) return;
    const ziel = this.morphZiel;
    if (!ziel) return;
    for (let k = 0; k < 2; k++) {
      const [sx, sy] = Phaser.Utils.Array.GetRandom(this.rissPunkte);
      const tx = ziel.x + Phaser.Math.Between(-3, 3), ty = ziel.y - ziel.displayHeight * 0.6;
      g.lineStyle(1, k ? 0xff4020 : 0xfff0e0, 0.95).beginPath().moveTo(sx, sy);
      for (let i = 1; i <= 6; i++) g.lineTo(Phaser.Math.Linear(sx, tx, i / 6) + Phaser.Math.Between(-4, 4), Phaser.Math.Linear(sy, ty, i / 6) + Phaser.Math.Between(-3, 3));
      g.strokePath();
    }
  }
  private morphZiel?: Phaser.GameObjects.Image;

  private async wandlung() {
    const f = state.flags;
    const nick = this.nick;
    if (!nick || this.kino) return;
    this.kino = true;
    this.kinoAus = false;
    this.frozen = true;
    f.nick = 'boss';
    this.scene.launch('WandlungUI');
    this.scene.bringToTop('WandlungUI');
    this.scene.sleep('Hud');
    this.ui = this.scene.get('WandlungUI') as WandlungUI;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.kinoAus = true; this.scene.stop('WandlungUI'); });
    this.input.keyboard!.once('keydown-ESC', () => this.zumKampf());
    for (const g of this.gaeste) { g.art = 'kino'; g.path = []; this.tweens.killTweensOf(g.sp); }
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(PX, 108, 900, 'Sine.easeInOut');
    // der Wirt tritt zur Seite, damit die Fläche frei ist
    void this.laufe(this.player, 'wirt', PX + 76, 7 * T + 14, 70).then(() => this.player.setFlipX(true).setFrame(6));
    await this.wartet(700);

    // ---- 1. Nick rastet auf der Bühne aus
    audio.music('none');
    await this.sagK('NICK', '#ff5040', 'FÜNF. LADUNGEN. Opa, du bist ein ENGEL. Ein gefallener, aber egal.', 2600);
    if (this.kinoAus) return;
    const zuck = this.time.addEvent({ delay: 70, loop: true, callback: () => { nick.setFrame([12, 15, 14, 12][Math.floor(Math.random() * 4)]); nick.x = PX + Phaser.Math.Between(-1, 1); } });
    const flacker = this.time.addEvent({ delay: 90, loop: true, callback: () => this.buehnenLicht.forEach((l) => l.setAlpha(Math.random() < 0.5 ? 0.15 : 1)) });
    for (let i = 0; i < 3; i++) this.time.delayedCall(i * 280, () => { audio.sfx('stab'); cam.shake(160, 0.004); });
    this.ui?.zeige('NICK', '#ff5040', 'JAAAAAAAA!');
    await this.wartet(900);
    // die Gitarre fliegt von der Bühne
    if (this.gitarre) {
      const git = this.gitarre;
      this.tweens.add({ targets: git, x: 5 * T, duration: 700, ease: 'Linear' });
      this.tweens.add({ targets: git, y: git.y - 16, duration: 300, ease: 'Quad.easeOut', yoyo: true, onComplete: () => { audio.sfx('clang'); this.tweens.add({ targets: git, y: 7 * T, angle: 900, duration: 300 }); } });
      this.tweens.add({ targets: git, angle: 720, duration: 700 });
    }
    await this.wartet(700);
    zuck.remove(); flacker.remove();
    nick.x = PX;
    await this.sagK('PUBLIKUM', '#e0b0c0', '„Was macht der?“ – „Gehört das zur Show?“', 1800);

    // ---- 2. Das Publikum weicht zurück, Nick springt von der Bühne
    // ordentlich in zwei Reihen an die Wände, alle schauen zur Mitte
    const plaetze = { l: [[4, 8], [3, 9], [4, 11], [3, 13]], r: [[20, 8], [21, 9], [20, 11], [21, 13], [20, 13]] };
    let li = 0, ri = 0;
    for (const g of this.gaeste) {
      if (Number(g.sp.frame.name) === 10) continue; // wer auf dem Sofa sitzt, bleibt sitzen
      const links = g.sp.x < PX;
      const [tx, ty] = links ? plaetze.l[li++ % plaetze.l.length] : plaetze.r[ri++ % plaetze.r.length];
      void this.laufe(g.sp, `kg_${g.id}`, tx * T + 8, ty * T + 14, 55).then(() => g.sp.setFlipX(!links).setFrame(6));
    }
    nick.setFrame(12);
    await this.tw({ targets: nick, y: nick.y - 12, duration: 200, ease: 'Quad.easeOut' });
    await this.tw({ targets: nick, y: 7 * T + 14, duration: 280, ease: 'Quad.easeIn', onUpdate: () => nick.setDepth(nick.y) });
    audio.sfx('thud');
    if (this.nickSchatten) this.nickSchatten.y = 7 * T + 13;
    nick.setScale(0.56, 0.42);
    this.tweens.add({ targets: nick, scaleX: 0.5, scaleY: 0.5, duration: 220, ease: 'Back.easeOut' });
    this.staubwolke(nick.x, nick.y);
    cam.shake(200, 0.006);
    cam.startFollow(nick, true, 0.06, 0.06);
    await this.wartet(500);
    if (this.kinoAus) return;

    // ---- 3. Das Pentagramm aus Koks
    audio.music('ritual');
    const pulver = this.add.graphics().setDepth(0.8);
    const glut = this.add.graphics().setDepth(0.85).setBlendMode(Phaser.BlendModes.ADD);
    const sterne: Pt2[] = [];
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; sterne.push([PX + Math.cos(a) * RX, PY + Math.sin(a) * RY]); }
    const segs: [Pt2, Pt2][] = [0, 2, 4, 1, 3].map((i, k, arr) => [sterne[i], sterne[arr[(k + 1) % 5]]]);
    let gezogen = 0, teil = 0, kreis = 0, kreisRot = 0;
    const geschnieft = [0, 0, 0, 0, 0];
    const lp = (a: Pt2, b: Pt2, t: number): Pt2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const zeichne = () => {
      pulver.clear(); glut.clear();
      segs.forEach(([a, b], i) => {
        const ende = i < gezogen ? 1 : i === gezogen ? teil : 0;
        if (ende <= 0) return;
        const s0 = Math.min(geschnieft[i], ende);
        if (s0 > 0) {
          const m = lp(a, b, s0);
          glut.lineStyle(4, 0xff2a10, 0.35).lineBetween(a[0], a[1], m[0], m[1]);
          glut.lineStyle(1.5, 0xff6a30, 1).lineBetween(a[0], a[1], m[0], m[1]);
        }
        if (ende > s0) { const p0 = lp(a, b, s0), p1 = lp(a, b, ende); pulver.lineStyle(2, 0xf4f4f4, 1).lineBetween(p0[0], p0[1], p1[0], p1[1]); }
      });
      const bogen = (anteil: number, g: Phaser.GameObjects.Graphics, w: number, col: number, alpha: number) => {
        if (anteil <= 0) return;
        g.lineStyle(w, col, alpha).beginPath();
        const n = Math.ceil(48 * anteil);
        for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / 48) * Math.PI * 2; const x = PX + Math.cos(a) * (RX + 6), y = PY + Math.sin(a) * (RY + 4); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
        g.strokePath();
      };
      bogen(kreis, pulver, 2, 0xf4f4f4, 1);
      bogen(kreisRot, glut, 4, 0xff2a10, 0.35);
      bogen(kreisRot, glut, 1.5, 0xff6a30, 1);
    };
    const krumel = (x: number, y: number) => {
      for (let i = 0; i < 2; i++) {
        const k = this.add.rectangle(x + Phaser.Math.Between(-2, 2), y - 8, 1, 1, 0xffffff).setDepth(y + 1);
        this.tweens.add({ targets: k, y: y + Phaser.Math.Between(-1, 1), x: k.x + Phaser.Math.Between(-2, 2), duration: 300, ease: 'Quad.easeIn', onComplete: () => this.tweens.add({ targets: k, alpha: 0, duration: 300, onComplete: () => k.destroy() }) });
      }
    };
    await this.laufe(nick, 'nickWalk', segs[0][0][0], segs[0][0][1] + 2, 60);
    await this.sagK('NICK', '#ff5040', 'Platz da. Ich brauch Platz für ... Kunst.', 1600);
    for (let i = 0; i < segs.length; i++) {
      if (this.kinoAus) return;
      const [a, b] = segs[i];
      gezogen = i; teil = 0;
      audio.sfx('zisch');
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const dir = Math.abs(dx) > Math.abs(dy) ? 'side' : dy < 0 ? 'up' : 'down';
      if (dir === 'side') nick.setFlipX(dx < 0);
      nick.anims.play(`nickWalk_${dir}`, true);
      const o = { t: 0 };
      await this.tw({
        targets: o, t: 1, duration: Math.hypot(dx, dy) * 16,
        onUpdate: () => { teil = o.t; const p = lp(a, b, o.t); nick.setPosition(p[0], p[1] + 2).setDepth(p[1] + 2); if (Math.random() < 0.5) krumel(p[0], p[1]); zeichne(); },
      });
    }
    gezogen = segs.length; teil = 0;
    // Kreis drumherum
    audio.sfx('zisch');
    const ko = { t: 0 };
    nick.anims.play('nickWalk_side', true);
    await this.tw({
      targets: ko, t: 1, duration: 2000,
      onUpdate: () => {
        kreis = ko.t;
        const a = -Math.PI / 2 + ko.t * Math.PI * 2;
        const x = PX + Math.cos(a) * (RX + 6), y = PY + Math.sin(a) * (RY + 4);
        nick.setFlipX(Math.sin(a) > 0).setPosition(x, y + 2).setDepth(y + 2);
        if (Math.random() < 0.5) krumel(x, y);
        zeichne();
      },
    });
    nick.anims.stop(); nick.setFrame(0);
    cam.stopFollow();
    cam.pan(PX, PY - 6, 700, 'Sine.easeInOut');
    cam.zoomTo(3, 900, 'Sine.easeInOut');
    await this.sagK('WIRT HORST', '#f8e070', '(Er hat das ganze Koks auf meinen ... auf seinen Boden gestreut. Na dann.)', 2200);
    if (this.kinoAus) return;

    // ---- 4. Nick schnieft das Pentagramm weg, darunter glüht es rot
    for (let i = 0; i < segs.length; i++) {
      if (this.kinoAus) return;
      const [a, b] = segs[i];
      await this.laufe(nick, 'nickWalk', a[0], a[1] + 2, 90);
      nick.setFrame(9);
      if (i === 0) floatText(this, nick.x, nick.y - 22, 'SNIIIEF!', '#ffffff').setDepth(6000);
      const o = { t: 0 };
      const schnief = this.time.addEvent({ delay: 220, loop: true, callback: () => audio.sfx('zisch') });
      await this.tw({
        targets: o, t: 1, duration: 900,
        onUpdate: () => {
          const vor = geschnieft[i];
          geschnieft[i] = o.t;
          const p = lp(a, b, o.t);
          nick.setPosition(p[0], p[1] + 2).setDepth(p[1] + 2);
          // Pulver fliegt in die Nase
          if (Math.random() < 0.6) {
            const k = this.add.rectangle(p[0] + Phaser.Math.Between(-2, 2), p[1], 1, 1, 0xffffff).setDepth(6000);
            this.tweens.add({ targets: k, x: nick.x, y: nick.y - 12, alpha: 0.2, duration: 180, onComplete: () => k.destroy() });
          }
          // rotes Licht steigt aus dem Boden
          if (Math.floor(vor * 3) < Math.floor(o.t * 3)) {
            const l = this.addLight(p[0], p[1], 0.32, 0.6).setTint(0xff2a10);
            l.setAlpha(0);
            this.tweens.add({ targets: l, alpha: 0.6, duration: 400 });
          }
          zeichne();
        },
      });
      schnief.remove();
      // jede Linie haut mehr rein: Zucken, Nick wird röter
      nick.setTint(Phaser.Display.Color.GetColor(255, 235 - i * 35, 235 - i * 35));
      nick.setFrame(12);
      cam.shake(150, 0.004 + i * 0.001);
      this.tweens.add({ targets: nick, x: nick.x + 1, duration: 40, yoyo: true, repeat: 3 });
      await this.wartet(260);
    }
    // der Kreis entzündet sich von selbst
    audio.sfx('glocke');
    const kr = { t: 0 };
    await this.tw({ targets: kr, t: 1, duration: 1300, onUpdate: () => { kreisRot = kr.t; zeichne(); } });
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; this.addLight(PX + Math.cos(a) * (RX + 6), PY + Math.sin(a) * (RY + 4), 0.3, 0.5).setTint(0xff3010); }
    this.tweens.add({ targets: glut, alpha: 0.55, duration: 380, yoyo: true, repeat: -1 });
    await this.laufe(nick, 'nickWalk', PX, PY + 2, 60);
    nick.setFrame(0);
    await this.sagK('NICK', '#ff5040', '... oh. Oh nein. Oh JA.', 1800);
    if (this.kinoAus) return;

    // ---- 5. Beben, Risse, Krallen, Panik
    cam.zoomTo(2, 900, 'Sine.easeInOut');
    cam.pan(PX, PY - 20, 900, 'Sine.easeInOut');
    audio.sfx('rumble');
    cam.shake(1200, 0.005);
    const decke = this.add.particles(0, 0, 'krume', {
      x: { min: 3 * T, max: 21 * T }, y: { min: 5 * T, max: 6 * T }, lifespan: 1300, speedY: { min: 50, max: 110 }, scale: 0.6, frequency: 50, alpha: { start: 1, end: 0.4 },
    }).setDepth(4980);
    const risse = this.add.graphics().setDepth(0.7);
    const winkel = [-160, -120, -70, -25, 20, 65, 110, 155];
    winkel.forEach((w, i) => this.time.delayedCall(i * 260, () => { if (!this.kinoAus) { void this.riss(risse, (w * Math.PI) / 180, i); audio.sfx('crack'); cam.shake(240, 0.006); } }));
    this.time.delayedCall(700, () => this.panik());
    await this.wartet(2300);
    let haendeAn = true;
    const haende = async () => {
      while (haendeAn && !this.kinoAus) {
        const kandidaten = this.rissPunkte.filter((q) => Math.abs(q[0] - PX) > 30 || Math.abs(q[1] - PY) > 20);
        if (kandidaten.length) {
          const [x, y] = Phaser.Utils.Array.GetRandom(kandidaten);
          const h = this.add.sprite(x, y + 1, 'daemonHand', 0).setOrigin(0.5, 1).setScale(0.25, 0).setDepth(y).setAngle(Phaser.Math.Between(-20, 20));
          this.tweens.add({
            targets: h, scaleY: 0.25, duration: 220, ease: 'Back.easeOut',
            onComplete: () => {
              this.time.delayedCall(260, () => h.active && h.setFrame(1));
              this.tweens.add({ targets: h, scaleY: 0, duration: 260, delay: 800, ease: 'Quad.easeIn', onComplete: () => h.destroy() });
            },
          });
          if (Math.random() < 0.3) audio.sfx('growl');
        }
        await this.wartet(Phaser.Math.Between(140, 320));
      }
    };
    void haende();
    await this.sagK('WIRT HORST', '#f8e070', '(Das war definitiv nicht die Ladung, die ich gekauft hab.)', 2800);
    decke.stop();
    if (this.kinoAus) return;

    // ---- 6. Nick schwebt und verschmilzt Stufe für Stufe mit dem Teufel
    const bodenY = PY + 2;
    const morph = this.add.image(nick.x, bodenY, 'wandelMini', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(bodenY + 5).setAlpha(0);
    const morph2 = this.add.image(nick.x, bodenY, 'wandelMini', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(bodenY + 6).setAlpha(0);
    this.morphZiel = morph;
    await this.tw({ targets: morph, alpha: 1, duration: 250 });
    nick.setVisible(false);
    const saeule = this.add.image(PX, bodenY, 'light').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setTint(0xff2010).setScale(0.25, 0).setAlpha(0.8).setDepth(5002);
    this.tweens.add({ targets: saeule, scaleY: 2.2, duration: 800, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: saeule, alpha: 0.45, scaleX: 0.3, duration: 90, yoyo: true, repeat: -1, delay: 800 });
    const saeulenLicht = this.addLight(PX, PY - 10, 1.1, 0.8).setTint(0xff2a10);
    audio.sfx('demon');
    await this.tw({ targets: [morph, morph2], y: bodenY - 12, duration: 1500, ease: 'Sine.easeInOut' });
    this.blitzG = this.add.graphics().setDepth(5003).setBlendMode(Phaser.BlendModes.ADD);
    const stimmen = ['Was ... ist das ...', 'ICH ... FÜHL ... MICH ...', 'GROSSARTIG.', 'WIRT.'];
    for (let k = 1; k < WANDEL_STUFEN; k++) {
      if (this.kinoAus) return;
      morph2.setFrame(k).setAlpha(0).setScale(morph.scale);
      cam.flash(120, 255, k % 2 ? 255 : 90, k % 2 ? 230 : 40);
      cam.shake(380, 0.005 + k * 0.001);
      audio.sfx(k % 2 ? 'growl' : 'demon');
      await this.tw({ targets: morph2, alpha: 1, duration: 330 });
      morph.setFrame(k).setAlpha(1);
      morph2.setAlpha(0);
      if (k >= 3 && stimmen[k - 3]) this.ui?.zeige('NICK', k >= 5 ? '#ffb020' : '#ff5040', stimmen[k - 3]);
      await this.wartet(1000 - k * 50);
    }
    await this.wartet(400);
    if (this.kinoAus) return;

    // ---- 7. Der Riesendämon steigt aus dem Pentagramm
    haendeAn = false;
    this.blitzG.clear();
    this.blitzG.destroy();
    this.blitzG = undefined;
    this.ui?.leer();
    cam.flash(500, 255, 255, 255);
    audio.sfx('thunder');
    morph.setVisible(false);
    morph2.destroy();
    saeule.destroy();
    this.tweens.add({ targets: saeulenLicht, scale: 2.6, alpha: 0.9, duration: 1500 });
    const d = new DaemonFigur(this, PX, PY + 80, 0.5, 4995).setPose('bruell');
    this.daemon = d;
    // nur der Teil über dem Boden ist sichtbar: Er kommt aus dem Pentagramm heraus
    const maske = this.make.graphics({}, false).fillStyle(0xffffff).fillRect(0, 0, 30 * T, PY);
    d.c.setMask(maske.createGeometryMask());
    cam.pan(PX, PY - 36, 2200, 'Sine.easeInOut');
    audio.sfx('rumble');
    cam.shake(2600, 0.01);
    for (let i = 0; i < 18; i++) this.time.delayedCall(i * 140, () => this.staubwolke(PX + Phaser.Math.Between(-40, 40), PY + Phaser.Math.Between(-4, 6)));
    await this.tw({ targets: d.c, y: PY, duration: 2600, ease: 'Cubic.easeOut' });
    d.aufschlag();
    audio.sfx('demon'); audio.sfx('roar');
    cam.flash(300, 255, 40, 20);
    await this.wartet(160);
    d.setPose('idle');
    await this.sagK('DER DÄMON', '#ffb020', 'NICK UND ICH SIND JETZT EINS. WIR NEHMEN KEINE RÜCKGABEN.', 3000);
    await this.sagK('DER DÄMON', '#ffb020', 'UND DU, WIRT ... BIST IM ZAHLUNGSVERZUG.', 2600);
    await this.sagK('WIRT HORST', '#f8e070', '(Ich hätte bei der Wurst bleiben sollen.)', 2000);
    if (this.kinoAus) return;
    // er holt aus – die Faust fliegt auf den Wirt zu
    this.ui?.leer();
    d.setPose('hebe');
    audio.sfx('whoosh');
    await this.wartet(550);
    d.setPose('schlag');
    const faust = this.add.image(PX + 30, PY - 60, 'daemonFaust').setScale(0.35).setDepth(5010);
    audio.sfx('roar');
    await this.tw({ targets: faust, scale: 3, x: cam.midPoint.x, y: cam.midPoint.y, duration: 420, ease: 'Quad.easeIn' });
    cam.flash(400, 255, 255, 255);
    audio.sfx('thud');
    this.zumKampf();
  }

  private zumKampf() {
    if (this.kinoAus) return;
    this.kinoAus = true;
    state.flags.nickWandlung = true;
    this.scene.stop('WandlungUI');
    this.go('Hoellenboss');
  }

  private staubwolke(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const s = this.add.image(x + Phaser.Math.Between(-4, 4), y - 1, 'light').setTint(0xa89888).setAlpha(0.4).setScale(0.03).setDepth(y + 2);
      this.tweens.add({ targets: s, x: s.x + Phaser.Math.Between(-10, 10), y: s.y - Phaser.Math.Between(2, 7), scale: 0.1, alpha: 0, duration: 600, onComplete: () => s.destroy() });
    }
  }

  /** Riss vom Pentagramm über den Kellerboden: schwarz mit glühendem Kern, rotes Licht steigt heraus */
  private async riss(g: Phaser.GameObjects.Graphics, ang: number, seed: number) {
    const rnd = new Phaser.Math.RandomDataGenerator([String(seed)]);
    let x = PX + Math.cos(ang) * RX * 0.7, y = PY + Math.sin(ang) * RY * 0.7;
    for (let k = 0; k < 18; k++) {
      if (this.kinoAus) return;
      const nx = x + Math.cos(ang) * 9 + rnd.between(-4, 4), ny = y + Math.sin(ang) * 7 + rnd.between(-3, 3);
      if (nx < 1.5 * T || nx > 22.5 * T || ny < 6 * T || ny > 14.6 * T) break;
      g.lineStyle(3, 0x050102, 1).lineBetween(x, y, nx, ny);
      g.lineStyle(1, 0xff4010, 1).lineBetween(x, y, nx, ny);
      this.rissPunkte.push([nx, ny]);
      if (k % 3 === 1) {
        const l = this.addLight(nx, ny, 0.28, 0.55).setTint(0xff3010);
        l.setAlpha(0);
        this.tweens.add({ targets: l, alpha: 0.55, duration: 300 });
      }
      x = nx; y = ny;
      await this.wartet(40);
    }
  }

  /** Alle fliehen schreiend zur Treppe und verschwinden nach oben */
  private panik() {
    const [ux, uy] = this.find('U');
    const tx = ux * T + 8, ty = (uy - 1) * T + 14;
    this.gaeste.forEach((g, i) => {
      this.time.delayedCall(i * 120, () => {
        if (this.kinoAus) return;
        this.tweens.killTweensOf(g.sp);
        g.sp.setTexture(g.sp.texture.key.replace('Sit', ''), 0);
        if (i % 3 === 0) audio.sfx('scream');
        const t = txt(this, g.sp.x, g.sp.y - 24, ['AAAH!', 'MAMA!', 'HAIL ... NEIN!', 'Ich will nach Hause!'][i % 4], '#ffd0c0').setOrigin(0.5).setDepth(6000).setStroke('#120c0b', 3).setScale(0.5).setResolution(2);
        this.tweens.add({ targets: t, y: t.y - 10, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
        void this.laufe(g.sp, `kg_${g.id}`, tx + Phaser.Math.Between(-6, 6), ty, 110).then(() => this.tweens.add({ targets: g.sp, alpha: 0, y: g.sp.y + 6, duration: 300 }));
      });
    });
  }

  // ---------------------------------------------------------------- Publikum

  private publikum() {
    const frei = state.flags.nick === 'frei';
    const plan: [string, Pt, Gast['art']][] = [
      ['metal', [7, 6], 'bang'], ['goth', [9, 6], 'bang'], ['metal2', [11, 6], 'bang'], ['punk', [14, 6], 'bang'], ['rocker', [16, 6], 'bang'],
      ['emo', [10, 7], 'bang'], ['gothM', [13, 7], 'bang'],
      ['goth', [1, 10], 'sitz'], ['emo', [2, 12], 'sitz'],
      ['rocker', [20, 11], 'lauf'], ['punk', [6, 12], 'lauf'], ['metal', [15, 13], 'lauf'],
    ];
    for (const [id, [tx, ty], art] of plan) {
      const sp = this.add.sprite(tx * T + 8, ty * T + 14, `kg_${id}`, art === 'bang' ? 3 : 0).setOrigin(0.5, 1).setScale(0.5).setDepth(ty * T + 14);
      const shadow = this.add.image(sp.x, sp.y - 1, 'shadow').setDepth(1);
      const g: Gast = { id, sp, shadow, tx, ty, path: [], art, pause: Phaser.Math.Between(500, 4000) };
      if (art === 'sitz') { sp.setFrame(10).setFlipX(true); shadow.setVisible(false); }
      this.solid[ty][tx] = art !== 'lauf';
      this.gaeste.push(g);
      const lines = (frei ? SPRUECHE_FREI : SPRUECHE)[id];
      g.it = {
        x: sp.x, y: sp.y - 4, r: 14,
        label: () => (g.path.length ? null : 'Ansprechen'),
        act: () => {
          floatText(this, g.sp.x, g.sp.y - 24, Phaser.Utils.Array.GetRandom(lines), '#e0b0c0').setDepth(6000);
        },
      };
      this.interacts.push(g.it);
    }
  }

  private frei(x: number, y: number) {
    if (y < 6 || y >= this.rows.length - 1 || x < 1 || x >= this.rows[0].length - 1) return false;
    if (this.solid[y][x]) return false;
    return !this.gaeste.some((g) => g.art !== 'lauf' ? false : g.tx === x && g.ty === y);
  }

  /** kürzester Weg über freie Kacheln (vier Richtungen) */
  private weg(from: Pt, to: Pt): Pt[] {
    const W = this.rows[0].length, key = (x: number, y: number) => y * W + x;
    const prev = new Map<number, number>([[key(from[0], from[1]), -1]]);
    const q: Pt[] = [from];
    while (q.length) {
      const [x, y] = q.shift()!;
      if (x === to[0] && y === to[1]) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = key(nx, ny);
        if (prev.has(k) || !this.frei(nx, ny)) continue;
        prev.set(k, key(x, y));
        q.push([nx, ny]);
      }
    }
    const end = key(to[0], to[1]);
    if (!prev.has(end)) return [];
    const out: Pt[] = [];
    for (let k = end; k !== key(from[0], from[1]); k = prev.get(k)!) out.push([k % W, Math.floor(k / W)]);
    return out.reverse();
  }

  private schritt(g: Gast, dt: number) {
    g.sp.setDepth(g.sp.y);
    g.shadow.setPosition(g.sp.x, g.sp.y - 1);
    if (g.it) { g.it.x = g.sp.x; g.it.y = g.sp.y - 4; }
    if (g.art !== 'lauf') return;
    if (!g.path.length) {
      g.pause -= dt;
      if (g.pause > 0) return;
      g.pause = Phaser.Math.Between(2500, 7000);
      const ziel: Pt = [Phaser.Math.Between(3, 20), Phaser.Math.Between(8, 14)];
      if (this.frei(ziel[0], ziel[1])) g.path = this.weg([g.tx, g.ty], ziel);
      return;
    }
    const [nx, ny] = g.path[0];
    // nicht durch den Wirt hindurch
    const p = this.player;
    if (Math.floor(p.x / T) === nx && Math.floor((p.y - 3) / T) === ny) { g.sp.anims.stop(); return; }
    const tx = nx * T + 8, ty = ny * T + 14;
    const d = Math.hypot(tx - g.sp.x, ty - g.sp.y), v = (26 * dt) / 1000;
    const dir = nx !== g.tx ? 'side' : ny < g.ty ? 'up' : 'down';
    if (nx !== g.tx) g.sp.setFlipX(nx < g.tx);
    g.sp.anims.play(`kg_${g.id}_${dir}`, true);
    if (d > v) {
      g.sp.x += ((tx - g.sp.x) / d) * v;
      g.sp.y += ((ty - g.sp.y) / d) * v;
      return;
    }
    g.sp.setPosition(tx, ty);
    g.tx = nx;
    g.ty = ny;
    g.path.shift();
    if (!g.path.length) { g.sp.anims.stop(); g.sp.setFrame(dir === 'up' ? 3 : dir === 'side' ? 6 : 0); }
  }
}
