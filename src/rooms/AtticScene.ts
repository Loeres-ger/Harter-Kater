import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { T, TileInfo, TopDown } from '../scenes/TopDown';
import type { DialogAction } from '../dialog/data';
import { BAR_LADDER_SPAWN, KELLER_SPAWN } from './spawns';
import { STRAENGE, entdecke, starteStrang, weltZiel, zaehle } from '../progress/quests';
import { fadeTo, floatText } from '../ui';
import { PC_FILES, gelesen } from '../dialog/pcFiles';

// Der Dachboden über der Kneipe: Dachschrägen, Fenster, alter Krempel und Bornas Matratze.
//  R Dachschräge  W Dachfenster  b Kisten  o Schaukelpferd  c Kerze auf Kiste  s Sessel
//  m/n Matratze  H Luke mit Leiter nach unten
/** Kachel, auf der in Kapitel 5 Claudius' Rechner steht */
const PC_TILE: [number, number] = [9, 2];
/** Nick-Strang: Bornas erste Pflanze neben der Matratze, die Plantage (die Kachel unter dem Rechner bleibt frei) */
const TOPF_TILE: [number, number] = [3, 4];
const PLANTAGE: [number, number][] = [[11, 2], [12, 2], [8, 3], [10, 3], [11, 3], [12, 3]];
/** ab hier ist die Treppe hinter den Kisten offen */
const KELLER_OFFEN = ['keller', 'koks', 'boss', 'frei'];

const MAP = [
  '##############',
  '#RRWRRRRRRWRR#',
  '#bb....o.....#',
  '#b...........#',
  '#c..mn.....s.#',
  '#............#',
  '#.....H......#',
  '##############',
];

export class AtticScene extends TopDown {
  constructor() {
    super('Dach');
  }

  protected mapRows() {
    const n = state.flags.nick;
    // K: Treppe in den Keller, daneben die weggeschobene Kiste; B: Kiste, die gleich weggeschoben wird (eigenes Bild)
    if (n && KELLER_OFFEN.includes(n)) return MAP.map((row, y) => (y === 3 ? '#K.b.........#' : row));
    if (n === 'plantage') return MAP.map((row, y) => (y === 3 ? '#B...........#' : row));
    return MAP;
  }
  protected isWall(ch: string) { return '#RW'.includes(ch); }
  protected darkness() { return 0.5; }
  protected floorKey() { return 'atticFloor'; }

  protected tileFor(ch: string): TileInfo {
    switch (ch) {
      case '#': return { key: 'atticWallFront', solid: true };
      case 'R': return { key: 'atticRoofFront', solid: true };
      case 'W': return { key: 'atticWindow', solid: true };
      case 'b': return { key: 'atticBoxes', solid: true, object: true };
      case 'o': return { key: 'atticJunk', solid: true, object: true };
      case 'c': return { key: 'candleCrate', solid: true, object: true };
      case 's': return { key: 'armchair', solid: true, object: true };
      case 'm': return { key: 'mattressL', solid: false };
      case 'n': return { key: 'mattressR', solid: false };
      case 'H': return { key: 'atticHatch', solid: false };
      case 'K': return { key: 'kellerTreppe', solid: false };
      case 'B': return { key: '', solid: true };
      default: return { key: '', solid: false };
    }
  }

  protected goalText() {
    const f = state.flags;
    if ((f.nick && f.nick !== 'frei') || f.strangBereit === 'nick') return weltZiel(f);
    if (f.claudius === 'getroffen') {
      const n = gelesen(f.pcGelesen).length;
      return n >= PC_FILES.length ? 'Alles gelesen. Jetzt abschicken.' : `Claudius’ Rechner: ${n} von ${PC_FILES.length} Dateien gelesen.`;
    }
    if (f.borna === 'gebrochen') return 'Hier oben ist es jetzt still.';
    if (f.borna === 'hoffnung') return 'Borna und Lilly wohnen jetzt hier oben.';
    if (!f.bornaGetroffen) return 'Auf der Matratze liegt jemand. Und es riecht süßlich.';
    return 'Borna hängt hier oben fest.';
  }

  private find(ch: string): [number, number] {
    for (let y = 0; y < this.rows.length; y++) {
      const x = this.rows[y].indexOf(ch);
      if (x >= 0) return [x, y];
    }
    return [1, 1];
  }

  protected setupWorld() {
    audio.music('dach');
    audio.setRain(true); // Regen auf dem Dach
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.setRain(false));

    // Luke nach unten
    const [hx, hy] = this.find('H');
    this.interacts.push({ x: hx * T + 8, y: hy * T + 8, r: 16, label: () => 'Runter in die Kneipe', act: () => this.go('Bar', { spawn: BAR_LADDER_SPAWN }) });

    // Mondlicht durch die Dachfenster, Kerzenschein
    for (let x = 0; x < this.rows[1].length; x++) if (this.rows[1][x] === 'W') this.addLight(x * T + 8, 2 * T + 6, 0.9, 0.45).setTint(0x8090d0);
    const [cx, cy] = this.find('c');
    const candle = this.addLight(cx * T + 8, cy * T + 4, 0.7, 0.7).setTint(0xffa040);
    this.tweens.killTweensOf(candle);
    this.time.addEvent({ delay: 110, loop: true, callback: () => candle.setAlpha(0.55 + Math.random() * 0.2) });

    this.examine();
    if (state.flags.borna === 'gebrochen') this.emptyMattress();
    else this.addBorna();
    if (state.flags.claudius) this.addPc();
    this.addNick();
    // die Pflanze wächst, während der Wirt weg ist
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (state.flags.nick === 'gepflanzt') state.flags.nick = 'plantage'; });
  }

  // ---------------------------------------------------------------- Nick-Strang

  private kiste?: Phaser.GameObjects.Image;

  private addNick() {
    const n = state.flags.nick;
    if (n === 'gepflanzt') this.addTopf();
    if (n && n !== 'pflanze' && n !== 'gepflanzt') this.addPlantage();
    if (n === 'plantage') this.kiste = this.add.image(1 * T, 3 * T, 'nickKiste').setOrigin(0).setScale(0.5).setDepth(4 * T);
    if (n && KELLER_OFFEN.includes(n)) this.addTreppe();
  }

  private addTopf() {
    const [tx, ty] = TOPF_TILE;
    const x = tx * T + 8, y = ty * T + 15;
    const topf = this.add.image(x, y, 'nickTopf').setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    this.tweens.add({ targets: topf, angle: { from: -3, to: 3 }, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.solid[ty][tx] = true;
    this.interacts.push({ x, y: y - 4, r: 14, label: () => 'Bornas Pflanze', act: () => this.toast('Sie wächst. Wenn man ganz still ist, hört man sie schmatzen.') });
    return topf;
  }

  /** Bornas Plantage unter einer lila Pflanzenlampe */
  private addPlantage() {
    PLANTAGE.forEach(([tx, ty], i) => {
      const x = tx * T + 8, y = ty * T + 15;
      const pl = this.add.image(x, y, i % 2 ? 'nickPflanze2' : 'nickPflanze').setOrigin(0.5, 1).setScale(0.5).setDepth(y);
      this.tweens.add({ targets: pl, angle: { from: -2.5, to: 2.5 }, duration: 1500 + i * 170, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 120 });
      this.solid[ty][tx] = true;
    });
    for (const [lx, ly] of [[11.5, 2], [10.5, 3]]) {
      this.add.image(lx * T + 8, ly * T - 6, 'nickLampe').setScale(0.5).setDepth(ly * T + 20);
      const glow = this.addLight(lx * T + 8, ly * T + 6, 0.75, 0.55).setTint(0xd050ff);
      this.tweens.add({ targets: glow, alpha: 0.4, duration: 2200, yoyo: true, repeat: -1 });
    }
    this.interacts.push({
      x: 11 * T, y: 4 * T + 2, r: 18, label: () => 'Plantage',
      act: () => this.toast(state.flags.nick === 'frei' ? 'Ein Schild hängt jetzt dran: „Vom Dach. Ohne Teufel.“' : 'Sechs Pflanzen, eine Lampe, null Genehmigungen.'),
    });
  }

  private addTreppe() {
    const x = 1 * T + 8, y = 3 * T + 8;
    const glow = this.addLight(x, y + 2, 0.45, 0.5).setTint(0xff2a1a);
    this.tweens.killTweensOf(glow);
    this.tweens.add({ targets: glow, alpha: 0.25, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.interacts.push({ x, y, r: 14, label: () => 'Runter in den Keller', act: () => this.go('Keller', { spawn: KELLER_SPAWN }) });
  }

  /** Borna schiebt die Kisten weg: dahinter führt eine Treppe nach unten. Auf einem Dachboden. */
  private async kellerAuf() {
    const f = state.flags;
    f.nick = 'keller';
    this.frozen = true;
    const cam = this.cameras.main;
    const [mx, my] = this.find('m');
    const bx = mx * T + 8, by = my * T - 8;
    cam.stopFollow();
    cam.pan(3 * T, 3 * T + 8, 900, 'Sine.easeInOut');
    await this.wartet(950);
    await this.blase(bx, by, 'Moment, Chef. Der Eingang ist ... *ächz* ... hinter den Weihnachtssachen.', '#a8d070');
    const k = this.kiste;
    if (k) {
      audio.sfx('rummage');
      cam.shake(1500, 0.0025);
      const staub = this.time.addEvent({
        delay: 90, repeat: 14,
        callback: () => {
          const s = this.add.image(k.x + Phaser.Math.Between(0, 14), k.y + 14, 'light').setTint(0xc8b090).setAlpha(0.4).setScale(0.05).setDepth(5003);
          this.tweens.add({ targets: s, y: s.y - Phaser.Math.Between(6, 14), x: s.x + Phaser.Math.Between(-6, 6), scale: 0.16, alpha: 0, duration: 900, onComplete: () => s.destroy() });
          if (Math.random() < 0.3) audio.sfx('rummage');
        },
      });
      await new Promise<void>((done) => this.tweens.add({ targets: k, x: 3 * T, duration: 1500, ease: 'Quad.easeInOut', onComplete: () => done() }));
      staub.remove();
      audio.sfx('thud');
      this.solid[3][1] = false;
      this.solid[3][3] = true;
    }
    // die Treppe taucht auf, von unten glimmt es rot, Gitarren in der Ferne
    const tr = this.add.image(1 * T, 3 * T, 'kellerTreppe').setOrigin(0).setScale(0.5).setDepth(0.5).setAlpha(0);
    this.tweens.add({ targets: tr, alpha: 1, duration: 600 });
    audio.sfx('rumble');
    cam.shake(600, 0.004);
    this.addTreppe();
    await this.wartet(800);
    const px = this.player.x, py = this.player.y - 26;
    await this.blase(px, py, 'Moment. Das hier ist der DACHBODEN. Unter uns ist meine Kneipe.', '#f8e070');
    await this.blase(bx, by, 'Jo.', '#a8d070');
    await this.blase(px, py, 'Wie kann vom Dachboden eine Treppe in einen KELLER führen?', '#f8e070');
    await this.blase(bx, by, 'Chef. Ich hab aufgehört, Fragen zu stellen, als die Pflanze über Nacht so groß war wie ich.', '#a8d070');
    floatText(this, 1 * T + 8, 3 * T, '♪ ... ♪', '#ff6050').setDepth(6000);
    await this.blase(px, py, '(Die Physik hat hier oben offenbar Hausverbot.)', '#f8e070');
    cam.pan(this.player.x, this.player.y - 14, 600, 'Sine.easeInOut');
    await this.wartet(620);
    cam.startFollow(this.player, true, 0.12, 0.12);
    this.frozen = false;
    this.toast('Nick ist im Keller. Unter dem Dachboden. Natürlich.');
    this.sichern();
  }

  /** Kapitel 5: Captain Claudius' versteckter Rechner auf einer Kiste. */
  private addPc() {
    const [tx, ty] = PC_TILE;
    this.add.image(tx * T, ty * T, 'atticPc').setOrigin(0).setScale(0.5).setDepth(ty * T + T);
    this.solid[ty][tx] = true;
    const glow = this.addLight(tx * T + 8, ty * T + 5, 0.5, 0.45).setTint(0x40e070);
    this.time.addEvent({ delay: 2200, loop: true, callback: () => { glow.setAlpha(0.1); this.time.delayedCall(70, () => glow.setAlpha(0.45)); } });
    const locked = () => (state.flags.pcSperreBis ?? 0) > state.time;
    this.interacts.push({
      x: tx * T + 8, y: (ty + 1) * T + 4, r: 16,
      label: () => (locked() ? `Claudius’ Rechner (gesperrt, ${Math.ceil((state.flags.pcSperreBis ?? 0) - state.time)}s)` : 'Claudius’ Rechner benutzen'),
      act: () => {
        if (locked()) return this.toast('Claudius hat das Passwort geändert. Noch ein bisschen warten.');
        audio.sfx('click');
        this.scene.launch('Pc', { resume: this.scene.key });
        this.scene.bringToTop('Pc');
        this.scene.pause();
      },
    });
  }

  private examine() {
    const spots: [string, string, () => string][] = [
      ['W', 'Dachfenster', () => 'Über den Dächern blinkt rot der Kran der Glanz-Lofts-Baustelle.'],
      ['b', 'Kartons', () => (zaehle('karton') >= 3 && entdecke(state.flags, 'karton')
        ? 'Du öffnest „NICHT ÖFFNEN – Kalle“. Drin: ein Pokal. „Schnecken-Derby 1987, 1. Platz“. Kalle hat also doch mal gewonnen.'
        : 'Beschriftet: „Weihnachten“, „Steuer 2009“, „NICHT ÖFFNEN – Kalle“.')],
      ['o', 'Schaukelpferd', () => 'Ein Schaukelpferd mit nur einem Auge. Passt zur Katze.'],
      ['s', 'Sessel', () => 'Ein Sessel, der mehr gesehen hat als Felix’ Notizbuch.'],
      ['c', 'Kerze', () => (state.flags.borna === 'gebrochen' ? 'Die Kerze ist heruntergebrannt.' : 'Eine Kerze, ein Aschenbecher, drei Feuerzeuge. Keins funktioniert.')],
    ];
    for (const [ch, label, text] of spots) {
      const [x, y] = this.find(ch);
      const below = ch === 'W' ? 1 : 0;
      this.interacts.push({ x: x * T + 8, y: (y + below) * T + 10, r: 14, label: () => label, act: () => this.toast(text()) });
    }
  }

  /** Borna im Schneidersitz auf der Matratze, umgeben von Rauch. Nach dem Happy End sitzt Lilly neben ihm. */
  private addBorna() {
    const [mx, my] = this.find('m');
    const x = mx * T + 8, y = my * T + 13;
    const borna = this.add.sprite(x, y, 'bornaSit', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    this.tweens.add({ targets: borna, scaleY: 0.49, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // zieht ab und zu am Joint
    const smoke = this.add.particles(x + 3, y - 12, 'light', {
      lifespan: 3200, speedY: { min: -9, max: -4 }, speedX: { min: -3, max: 4 }, scale: { start: 0.05, end: 0.25 },
      alpha: { start: 0.25, end: 0 }, tint: 0xb8c8a8, frequency: 420,
    }).setDepth(4000);
    this.time.addEvent({
      delay: 3600, loop: true,
      callback: () => {
        if (!borna.active) return;
        borna.setFrame(1);
        smoke.explode(6);
        this.time.delayedCall(1200, () => borna.active && borna.setFrame(0));
      },
    });
    this.interacts.push({
      x, y: y - 4, r: 18,
      label: () => (borna.active ? 'Mit Borna reden' : null),
      act: () => this.talk(state.flags.strangBereit === 'nick' || state.flags.nick ? 'bornaBiz' : 'borna', (a) => this.bornaDone(a)),
    });

    if (state.flags.borna === 'hoffnung') {
      const lx = x + 14;
      const lily = this.add.sprite(lx, y, 'lilySit', 2).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
      this.tweens.add({ targets: lily, angle: { from: -3, to: 3 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.interacts.push({ x: lx, y: y - 4, r: 14, label: () => 'Mit Lilly reden', act: () => this.talk('lilyDach') });
      // kleine Herzchen ab und zu
      this.time.addEvent({
        delay: 2600, loop: true,
        callback: () => {
          const h = this.add.text(x + 7, y - 18, '♥', { fontFamily: 'monospace', fontSize: '8px', color: '#ff7aa0' }).setDepth(6000).setOrigin(0.5);
          this.tweens.add({ targets: h, y: h.y - 12, alpha: 0, duration: 1600, onComplete: () => h.destroy() });
        },
      });
    }
  }

  private bornaDone(a?: DialogAction) {
    const f = state.flags;
    if (a === 'nickStart' && !f.nick) {
      const s = STRAENGE.find((x) => x.id === 'nick')!;
      starteStrang(s, f, state.time);
      f.strangBereit = undefined;
      this.leaving = true;
      fadeTo(this, 'Cutscene', { script: s.script, next: { scene: 'Dach', data: { spawn: [6, 5] } } });
      return;
    }
    if (a === 'nickPflanze' && f.nick === 'pflanze' && state.inv.pflanze > 0) {
      state.inv.pflanze = 0;
      f.nick = 'gepflanzt';
      const topf = this.addTopf();
      topf.setScale(0.1).setAlpha(0);
      this.tweens.add({ targets: topf, scale: 0.5, alpha: 1, duration: 500, ease: 'Back.easeOut' });
      audio.sfx('chime');
      floatText(this, topf.x, topf.y - 20, '♥', '#a8d070').setDepth(6000);
      this.toast('Borna topft sie ein und flüstert ihr was zu. Lass die beiden mal allein.');
      this.sichern();
      return;
    }
    if (a === 'nickKeller' && f.nick === 'plantage') {
      void this.kellerAuf();
      return;
    }
    if (a !== 'bornaGebrochen' || state.flags.borna) return;
    // Verlauf A ist endgültig: Lilly taucht nicht mehr auf
    state.flags.borna = 'gebrochen';
    this.leaving = true;
    fadeTo(this, 'Cutscene', { script: 'bornaWeg', next: { scene: 'Bar', data: { spawn: BAR_LADDER_SPAWN } } });
  }

  /** Verlauf A danach: leere Matratze, ein Zettel. */
  private emptyMattress() {
    const [mx, my] = this.find('m');
    const x = mx * T + 10, y = my * T + 8;
    this.add.rectangle(x, y, 5, 4, 0xf0ead8).setDepth(y + 1);
    this.interacts.push({
      x, y: y + 4, r: 16,
      label: () => 'Bornas Matratze',
      act: () => this.toast('Leer. Der Zettel liegt noch da. Du lässt ihn liegen.'),
    });
  }
}
