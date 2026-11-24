import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { T, TileInfo, TopDown } from '../scenes/TopDown';
import { hud } from '../scenes/HudScene';
import { unlock } from '../progress/achievements';
import { floatText } from '../ui';
import type { DialogAction } from '../dialog/data';
import { ALLEY_BASAR_SPAWN } from './spawns';
import { strangZiel } from '../progress/quests';
import { WandlungUI } from './WandlungUI';

// „Masala Basar“: der indische Laden in der Weststadt (offen, sobald die Baustellen weg sind).
// Adshayan steht hinter der Theke. Nach der Eröffnungsfeier liegt sein Curry überall auf dem Boden;
// hilft der Wirt beim Putzen (PutzScene), öffnet der Laden: Curry und Mango-Lassi.
//  # Wand  R Gewürzregal  P Filmplakat  K Kühlschrank (Lassi)  D Tür
//  T Theke (Chai-Kanne, Curry-Topf)  S Reis- und Linsensäcke  s Gewürzkegel  p Pflanze
const MAP = [
  '##############',
  '#RRPRRKKRRPRR#',
  '#............#',
  '#TTTTT.......#',
  '#.......ss...#',
  '#SS..........#',
  '#SS.....ss..p#',
  '######D#######',
];

/** Adshayans Platz hinter der Theke (Kachel) */
const ADSHAYAN_TILE: [number, number] = [3, 2];
/** Curry auf dem Boden, solange nicht geputzt ist (Kachel x, y, Größe) */
const CURRY: [number, number, number][] = [[4.6, 5.3, 0.5], [7.4, 2.7, 0.4], [10.6, 5.4, 0.45], [6.3, 4.5, 0.32], [11.3, 3.3, 0.36], [3.2, 4.4, 0.3]];

export class BasarScene extends TopDown {
  private adshayan?: Phaser.GameObjects.Sprite;

  constructor() {
    super('Basar');
  }

  protected mapRows() { return MAP; }
  protected isWall(ch: string) { return '#RPKD'.includes(ch); }
  protected darkness() { return 0.14; }
  protected floorKey() { return 'basarFloor'; }

  protected tileFor(ch: string, x: number): TileInfo {
    switch (ch) {
      case '#': return { key: 'basarWallFront', solid: true };
      case 'R': return { key: 'basarShelf', solid: true };
      case 'P': return { key: 'basarPoster', solid: true };
      case 'K': return { key: 'basarFridge', solid: true };
      case 'D': return { key: 'basarDoor', solid: true };
      case 'T': return { key: x % 2 ? 'basarCounter1' : 'basarCounter0', solid: true, object: true };
      case 'S': return { key: 'basarSacks', solid: true, object: true };
      case 's': return { key: 'basarSpice', solid: true, object: true };
      case 'p': return { key: 'plant', solid: true, object: true };
      default: return { key: '', solid: false };
    }
  }

  protected goalText() {
    if (state.flags.basarSauber && strangZiel(state.flags)) return strangZiel(state.flags)!;
    return state.flags.basarSauber ? 'Masala Basar. Curry, Lassi und der sauberste Boden der Stadt.' : 'Adshayan hinter der Theke braucht Hilfe. Dringend.';
  }

  private find(ch: string): [number, number] {
    for (let y = 0; y < this.rows.length; y++) {
      const x = this.rows[y].indexOf(ch);
      if (x >= 0) return [x, y];
    }
    return [1, 1];
  }

  protected setupWorld() {
    audio.music('basar');
    const [dx, dy] = this.find('D');
    this.interacts.push({ x: dx * T + 8, y: dy * T, r: 18, label: () => 'Laden verlassen', act: () => this.go('Alley', { spawn: ALLEY_BASAR_SPAWN }) });
    // warmes Licht über Theke und Regalen
    for (const [x, y] of [[3, 3], [9, 2], [4, 6], [10, 6]]) this.addLight(x * T, y * T, 0.95, 0.55).setTint(0xffc070);
    this.lichterkette();
    this.curry();

    const spot = (x: number, y: number, label: string, text: () => string) =>
      this.interacts.push({ x, y, r: 14, label: () => label, act: () => this.toast(text()) });
    const [px, py] = this.find('P');
    spot(px * T + 8, (py + 1) * T + 10, 'Filmplakat', () => 'Ein Held, eine Heldin, ein Wasserfall und zweihundert Tänzer. Laufzeit: drei Stunden. Jemand hat mit Edding „BESTER FILM!!!“ daraufgeschrieben. Die Handschrift sieht aus wie Adshayans.');
    const [kx, ky] = this.find('K');
    spot(kx * T + 16, (ky + 1) * T + 10, 'Kühlschrank', () => 'Mango-Lassi, Reihe um Reihe. Ganz hinten ein einzelnes Bier mit Zettel: „Für Notfälle. Nicht für Kalle.“');
    spot(1 * T + 16, 2 * T + 10, 'Gewürzregal', () => 'Kurkuma, Kreuzkümmel, Kardamom, Bockshornklee. Alles ordentlich beschriftet. Ein Glas heißt nur „VORSICHT“.');
    spot(8 * T + 16, 5 * T + 2, 'Gewürzkegel', () => 'Perfekte Kegel aus Gewürzpulver. Ein Schild davor: „Wer niest, zahlt.“');
    spot(3 * T, 5 * T + 2, 'Reissäcke', () => 'Basmati, 25 Kilo. Auf einem Sack ist ein Abdruck. Hier hat jemand geschlafen. Nach der Feier, vermutlich.');
    this.addAdshayan();
  }

  // ---------------------------------------------------------------- Kapitel 8: Adshayan kocht den großen Topf
  // Zwischensequenz in der Welt (Kinobalken, Untertitel zum Durchklicken, ESC überspringt): Adshayan holt den Topf von
  // der Eröffnung, wirft Gewürze und Chilis hinein, der Laden füllt sich mit Rauch, er weint vor Schärfe und probiert
  // NICHT. Am Ende hebt der Wirt den Topf auf den Kopf und trägt ihn langsam zum Eimer.

  private kino = false;
  private kinoAus = false;
  private ui?: WandlungUI;

  private tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((done) => this.tweens.add({ ...cfg, onComplete: () => done() }));
  }

  private klick() {
    return new Promise<void>((done) => {
      const kb = this.input.keyboard!;
      const start = this.time.now;
      let fertig = false;
      const ende = () => {
        if (fertig) return;
        fertig = true;
        kb.off('keydown-E', weiter); kb.off('keydown-SPACE', weiter); kb.off('keydown-ENTER', weiter);
        this.input.off('pointerdown', weiter);
        this.events.off('kinoAus', ende);
        done();
      };
      const weiter = () => { if (this.time.now - start > 350) ende(); };
      kb.on('keydown-E', weiter); kb.on('keydown-SPACE', weiter); kb.on('keydown-ENTER', weiter);
      this.input.on('pointerdown', weiter);
      this.events.once('kinoAus', ende);
    });
  }

  private async sagK(wer: string, farbe: string, text: string) {
    if (this.kinoAus) return;
    this.ui?.zeige(wer, farbe, text);
    this.ui?.weiterZeigen(true);
    await this.klick();
    this.ui?.weiterZeigen(false);
  }

  /** Gewürzwolke über dem Topf */
  private wolke(x: number, y: number, farbe: number) {
    for (let i = 0; i < 7; i++) {
      const w = this.add.circle(x + Phaser.Math.Between(-4, 4), y, Phaser.Math.FloatBetween(1.5, 3), farbe, 0.7).setDepth(5000);
      this.tweens.add({ targets: w, x: w.x + Phaser.Math.Between(-14, 14), y: w.y - Phaser.Math.Between(8, 22), scale: 3, alpha: 0, duration: Phaser.Math.Between(800, 1400), onComplete: () => w.destroy() });
    }
  }

  private async curryKochen() {
    const f = state.flags, a = this.adshayan;
    if (!a || this.kino) return;
    const nochmal = (f.curryGekocht ?? 0) > 0;
    this.kino = true;
    this.kinoAus = false;
    this.frozen = true;
    hud.prompt = '';
    this.scene.launch('WandlungUI');
    this.scene.bringToTop('WandlungUI');
    this.scene.sleep('Hud');
    this.ui = this.scene.get('WandlungUI') as WandlungUI;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.kinoAus = true; this.scene.stop('WandlungUI'); });
    this.input.keyboard!.once('keydown-ESC', () => this.kochenEnde());
    this.tweens.killTweensOf(a);
    const [ax, ay] = ADSHAYAN_TILE;
    const tx = (ax + 1) * T + 8, ty = (ay + 1) * T + 6;
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(tx - 8, ty - 6, 800, 'Sine.easeInOut');
    cam.zoomTo(2.8, 800, 'Sine.easeInOut');
    const p = this.player;
    void this.tw({ targets: p, x: tx, y: ty + 2 * T + 4, duration: 700 }).then(() => p.setFrame(3));
    await this.wartet(800);
    if (this.kinoAus) return;

    // ---- der große Topf kommt auf die Flamme
    const flamme = this.add.image(tx, ty + 6, 'curryFlamme').setScale(0.5).setDepth(ty + 30).setAlpha(0);
    const topf = this.add.image(tx, ty - 34, 'curryTopf').setScale(0.6).setDepth(ty + 31);
    this.kochTopf = topf;
    this.kochFlamme = flamme;
    audio.sfx('rummage');
    await this.tw({ targets: topf, y: ty, duration: 420, ease: 'Bounce.easeOut' });
    audio.sfx('clang');
    cam.shake(140, 0.004);
    this.tweens.add({ targets: flamme, alpha: 1, duration: 300 });
    this.tweens.add({ targets: flamme, scaleY: 0.6, duration: 160, yoyo: true, repeat: -1 });
    const glut = this.addLight(tx, ty, 0.6, 0.6).setTint(0xff8a2a);
    this.kochExtras.push(glut);
    const blubber = this.time.addEvent({
      delay: 140, loop: true, callback: () => {
        const b = this.add.circle(tx + Phaser.Math.Between(-6, 6), ty - 3, 0.8, 0xffb040, 0.9).setDepth(ty + 32);
        this.tweens.add({ targets: b, y: b.y - 3, scale: 1.8, alpha: 0, duration: 380, onComplete: () => b.destroy() });
      },
    });
    this.kochExtras.push(blubber);
    if (!nochmal) await this.sagK('ADSHAYAN', '#ffb040', 'Kreuzkümmel. Kardamom. Bockshornklee. Und das Glas, auf dem VORSICHT steht.');
    if (this.kinoAus) return;

    // ---- Gewürze und Chilis: er rennt zwischen Regal und Topf hin und her
    const regal = [ax * T - 8, (ax + 2) * T + 8, (ax - 1) * T + 8, (ax + 3) * T + 8];
    const farben = [0xf0c020, 0xe0701a, 0x6a9a2a, 0xd02a1a];
    const rauch = this.add.rectangle(0, 0, this.rows[0].length * T, this.rows.length * T, 0xff8a2a, 0).setOrigin(0).setDepth(4998);
    this.kochExtras.push(rauch);
    for (let i = 0; i < (nochmal ? 2 : 4); i++) {
      if (this.kinoAus) return;
      a.setFrame(6).setFlipX(regal[i] < a.x);
      await this.tw({ targets: a, x: regal[i], duration: 260, ease: 'Quad.easeInOut' });
      a.setFrame(3);
      await this.wartet(160);
      a.setFrame(6).setFlipX(tx < a.x);
      await this.tw({ targets: a, x: tx - 10, duration: 260, ease: 'Quad.easeInOut' });
      a.setFrame(0);
      // werfen
      for (let k = 0; k < 2; k++) {
        const ch = this.add.image(a.x, a.y - 14, 'chili').setScale(0.5).setDepth(ty + 33);
        this.tweens.add({ targets: ch, x: tx + Phaser.Math.Between(-3, 3), duration: 320, delay: k * 90 });
        this.tweens.add({ targets: ch, y: ty - 16, duration: 160, delay: k * 90, ease: 'Quad.easeOut', onComplete: () => this.tweens.add({ targets: ch, y: ty - 2, angle: 360, duration: 160, ease: 'Quad.easeIn', onComplete: () => ch.destroy() }) });
      }
      audio.sfx('zisch');
      this.wolke(tx, ty - 6, farben[i]);
      this.tweens.add({ targets: rauch, fillAlpha: Math.min(0.32, rauch.fillAlpha + 0.08), duration: 400 });
      cam.shake(100, 0.002);
      await this.wartet(380);
    }
    if (this.kinoAus) return;

    // ---- die Schärfe: Tränen, Husten
    const traenen = this.time.addEvent({
      delay: 180, loop: true, callback: () => {
        for (const dx of [-2, 2]) {
          const t = this.add.circle(a.x + dx, a.y - 15, 0.7, 0x8ac8ff, 0.9).setDepth(a.depth + 1);
          this.tweens.add({ targets: t, y: t.y + 8, alpha: 0, duration: 500, onComplete: () => t.destroy() });
        }
      },
    });
    this.kochExtras.push(traenen);
    floatText(this, a.x, a.y - 22, 'HUST! HUST!', '#ffb040');
    this.tweens.add({ targets: a, x: a.x + 1, duration: 60, yoyo: true, repeat: 8 });
    await this.sagK('ADSHAYAN', '#ffb040', 'Meine Augen! Meine AUGEN! ... Das ist gut. Das heißt, es wirkt.');
    floatText(this, p.x, p.y - 22, 'hust', '#f4ead0');
    await this.sagK('WIRT', '#f4ead0', '(Mir tränen die Augen. Und ich stehe zwei Meter weg.)');
    if (this.kinoAus) return;

    // ---- der Löffel. Er probiert NICHT.
    const loeffel = this.add.rectangle(a.x + 4, a.y - 8, 1, 6, 0xc8c8d0).setDepth(a.depth + 2);
    this.kochExtras.push(loeffel);
    await this.tw({ targets: loeffel, y: a.y - 14, duration: 500, ease: 'Sine.easeOut' });
    this.tweens.add({ targets: loeffel, x: loeffel.x + 1, duration: 50, yoyo: true, repeat: 14 });
    await this.sagK('ADSHAYAN', '#ffb040', 'Nicht probieren. NICHT probieren. ... Ich probiere nicht.');
    await this.tw({ targets: loeffel, y: a.y + 6, alpha: 0, duration: 400, ease: 'Quad.easeIn' });
    if (this.kinoAus) return;

    // ---- fertig: der Topf glüht und zischt
    audio.sfx('zisch');
    audio.sfx('roar');
    cam.flash(160, 255, 140, 40);
    cam.shake(300, 0.005);
    this.wolke(tx, ty - 8, 0xd02a1a);
    this.tweens.add({ targets: glut, scale: 1.1, alpha: 0.85, duration: 300, yoyo: true, repeat: 2 });
    await this.sagK('ADSHAYAN', '#ffb040', nochmal
      ? 'Fertig. Diesmal noch schärfer. Ich habe aus Versehen die Wut mit reingekocht.'
      : 'Fertig. Er ist ... lebendig. Trag ihn vorsichtig. Und sprich nicht mit ihm.');
    if (this.kinoAus) return;
    // der Wirt nimmt den Topf auf den Kopf
    await this.tw({ targets: p, x: tx, y: ty + T + 8, duration: 400 });
    await this.tw({ targets: topf, x: p.x, y: p.y - 21, scale: 0.5, duration: 420, ease: 'Quad.easeOut' });
    this.kochenEnde();
  }

  private kochTopf?: Phaser.GameObjects.Image;
  private kochFlamme?: Phaser.GameObjects.Image;
  private kochExtras: { destroy?: () => void; remove?: () => void }[] = [];

  /** Ende (auch beim Überspringen): Topf auf dem Kopf, raus aus dem Kino */
  private kochenEnde() {
    if (!this.kino) return;
    this.kino = false;
    this.kinoAus = true;
    this.events.emit('kinoAus');
    const f = state.flags;
    f.curryTopf = true;
    f.curryGekocht = (f.curryGekocht ?? 0) + 1;
    this.ui?.leer();
    this.scene.stop('WandlungUI');
    this.scene.wake('Hud');
    this.kochTopf?.destroy();
    this.kochFlamme?.destroy();
    for (const x of this.kochExtras) { x.remove?.(); x.destroy?.(); }
    this.kochExtras = [];
    const a = this.adshayan;
    if (a) {
      const [ax, ay] = ADSHAYAN_TILE;
      this.tweens.killTweensOf(a);
      a.setPosition(ax * T + 8, ay * T + 14).setFrame(0).setFlipX(false);
      this.tweens.add({ targets: a, y: a.y - 1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.topfAufnehmen();
    const cam = this.cameras.main;
    cam.zoomTo(2, 500);
    cam.startFollow(this.player, true, 0.12, 0.12);
    this.frozen = false;
    this.toast('Der Topf ist schwer und heiß. Ab zum Eimer: durch die Herrentoilette, Kabine 1, runter zur Klärwerk-Tür.');
  }

  /** bunte Lichterkette entlang der Rückwand, die Lämpchen blinken versetzt */
  private lichterkette() {
    const cols = [0xff5a5a, 0xffd040, 0x5ad0ff, 0x7aff7a];
    for (let i = 0; i < 26; i++) {
      const x = T + 6 + i * 8, y = T + 3 + Math.round(Math.sin(i / 2) * 1.5);
      const l = this.add.circle(x, y, 1, cols[i % 4]).setDepth(3);
      this.tweens.add({ targets: l, alpha: 0.35, duration: 700, yoyo: true, repeat: -1, delay: (i % 4) * 350 });
    }
  }

  /** Curry auf dem Boden, solange nicht geputzt ist; danach glänzen die Fliesen */
  private curry() {
    if (state.flags.basarSauber) {
      this.time.addEvent({
        delay: 900, loop: true,
        callback: () => {
          const s = this.add.star(Phaser.Math.Between(2, 12) * T, Phaser.Math.Between(3, 6) * T + 8, 4, 0.5, 2, 0xffffff, 0.9).setDepth(2);
          this.tweens.add({ targets: s, scale: 0, angle: 90, duration: 600, onComplete: () => s.destroy() });
        },
      });
      return;
    }
    CURRY.forEach(([x, y, sc], i) => {
      this.add.image(x * T, y * T, `basarFleck${i % 3}`).setScale(sc).setAngle(i * 90).setDepth(0.7);
    });
    const [x, y] = CURRY[0];
    this.interacts.push({ x: x * T, y: y * T - 4, r: 14, label: () => 'Curry', act: () => this.toast('Curry. Gestern noch im Topf. Dann in Adshayan. Jetzt wieder auf den Fliesen. Es riecht trotzdem gut. Das ist das Schlimmste daran.') });
  }

  /** Adshayan hinter der Theke: vorher läuft er nervös hin und her, danach wippt er fröhlich */
  private addAdshayan() {
    const [ax, ay] = ADSHAYAN_TILE;
    const x = ax * T + 8, y = ay * T + 14;
    const a = this.add.sprite(x, y, 'adshayan', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    this.adshayan = a;
    this.solid[ay][ax] = true;
    if (state.flags.basarSauber) {
      this.tweens.add({ targets: a, y: y - 1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      this.tweens.add({ targets: a, x: x + 12, duration: 1400, yoyo: true, repeat: -1, hold: 900, repeatDelay: 700, ease: 'Sine.easeInOut' });
      // ab und zu hält er sich den Bauch
      this.time.addEvent({
        delay: 5200, loop: true,
        callback: () => {
          if (!a.active || state.flags.basarSauber) return;
          a.setTint(0xb8e0a0);
          floatText(this, a.x, a.y - 24, Phaser.Utils.Array.GetRandom(['Uff ...', 'Oh nein ...', 'Geht schon!', 'Alles gut!']), '#c8f0a0');
          this.time.delayedCall(700, () => a.active && a.clearTint());
        },
      });
    }
    this.interacts.push({ x, y: y + 18, r: 26, label: () => 'Mit Adshayan reden', act: () => this.talk('adshayan', (act) => this.adshayanDone(act)) });
  }

  private adshayanDone(a?: DialogAction) {
    if (a === 'shop') {
      audio.sfx('click');
      this.scene.launch('Shop', { shop: 'basar', resume: 'Basar' });
      this.scene.bringToTop('Shop');
      this.scene.pause();
    } else if (a === 'curryKochen') {
      void this.curryKochen();
    } else if (a === 'putzen') {
      hud.prompt = '';
      this.scene.launch('Putzen', { resume: this.scene.key, onDone: (win: boolean) => this.putzDone(win) });
      this.scene.bringToTop('Putzen');
      this.scene.pause();
    }
  }

  private putzDone(win: boolean) {
    const f = state.flags;
    if (!win) {
      f.basarVersuche = (f.basarVersuche ?? 0) + 1;
      return this.toast('Adshayan ringt die Hände: „Fast! Sag Bescheid, wenn du noch eine Runde schaffst.“');
    }
    f.basarSauber = true;
    state.money += 25;
    state.inv.curry += 2;
    audio.sfx('kaching');
    unlock('blitzblank');
    this.toast('Adshayan drückt dir 25 € und zwei Portionen Curry in die Hand: „Für meinen Helden! Ab jetzt ist offen. Für dich immer.“');
    // Raum neu aufbauen: Curry weg, Adshayan fröhlich
    this.time.delayedCall(2200, () => {
      const spawn = this.hier();
      this.cameras.main.fadeOut(250);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart({ spawn }));
    });
  }
}
