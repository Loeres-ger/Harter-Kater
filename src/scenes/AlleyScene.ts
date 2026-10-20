import Phaser from 'phaser';
import { audio } from '../audio';
import { bulky, item, lookStage, PILLS, state } from '../state';
import { BAR_BACK_SPAWN, BAR_DOOR_SPAWN } from './BarScene';
import type { DialogAction } from '../dialog/data';
import { unlock } from '../progress/achievements';
import { freiesSpiel, lilyWartet } from '../progress/flags';
import { entdecke, weltZiel, zaehle } from '../progress/quests';
import { countBarEntry } from '../events/anne';
import { BAR_LADDER_SPAWN, LADEN_SPAWN } from '../rooms/spawns';
import { fadeTo, floatText } from '../ui';
import { hud } from './HudScene';
import { Interact, T, TileInfo, TopDown } from './TopDown';
import { getMap } from '../maps';
import { ALLEY_TILES, alleyFloor, tileKey } from '../maps/palettes';

// Draußen: Straße und Gasse. Die Karte steht in maps/alley.json (bearbeitbar mit dem Map-Editor, editor.html),
// die Bedeutung der Zeichen in maps/palettes.ts.

const trashSearched = new Map<string, number>();
/** Zeitpunkt, ab dem an dieser Kachel wieder eine Dame steht */
const dameReady = new Map<string, number>();
export function resetAlley() {
  trashSearched.clear();
  dameReady.clear();
}

const JUNK = ['Nur ein alter Schuh.', 'Eine nasse Zeitung von 2009.', 'Ein halber Döner. Lieber nicht.', 'Ratten. Viele Ratten.'];
const KILLED = ['Handtasche geplündert. Jetzt schnell weg mit der Leiche!', 'Das wars für sie. Ab in den Müll damit - schnell!'];
const SLAPPED = ['Handtaschen-Hieb! Aua.', '„Finger weg, Opa!“ *KLATSCH*', 'Pfefferspray! Deine Augen brennen.'];
// Sichtfeld des Polizisten: Kegel in Blickrichtung (Reichweite, halber Öffnungswinkel) + Nahbereich rundum.
// Wände, Türen und Hindernisse (alle festen Kacheln) verdecken die Sicht; der gezeichnete Kegel ist genau die Prüffläche.
const VIEW_LEN = 96, VIEW_HALF = 0.42, VIEW_CLOSE = 24;
/** Streife: Reihe und Strecke (in Kacheln) in der Gasse hinter dem Haus */
const COP_ROW = 3, COP_FROM = 8, COP_TO = 30;
/** Lillys Platz an der Wand der Hintergasse (Kachel) */
const LILY_TILE: [number, number] = [29, 2];
/** Kapitel 5: wo Captain Claudius und Kevin vor der Kneipe stehen, und wo der Wirt danach steht (Kacheln) */
const CLAUDIUS_TILE: [number, number] = [21, 17];
const KEVIN_TILE: [number, number] = [23, 17];
export const ALLEY_FRONT_SPAWN: [number, number] = [17, 18];

export class AlleyScene extends TopDown {
  private cat!: Phaser.GameObjects.Sprite;
  private corpse?: Phaser.GameObjects.Sprite;
  private corpseCarried = false;
  private corpseKey = '';
  /** NPCs, die bei der Mutation fliehen */
  private npcs: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Image)[] = [];
  private lamps: Phaser.GameObjects.Image[] = [];
  private copGone = false;
  private cop!: Phaser.GameObjects.Sprite;
  private copDir = 1;
  private copWait = 0;
  private cone!: Phaser.GameObjects.Graphics;
  private busted = false;
  private dealerPos: [number, number] = [0, 0];
  private copSpot?: Interact;
  /** Streife: Endpunkte (Pixel), aktuelle Spur (y), Umwege und wie lange er schon vor einem Hindernis steht */
  private copFrom = 0;
  private copTo = 0;
  private copLane = 0;
  private copHome = 0;
  private copDetours = 0;
  private copBlockT = 0;
  /** Damen der Nacht (bewegliche Hindernisse für Felix) */
  private dames: Phaser.GameObjects.Sprite[] = [];

  constructor() {
    super('Alley');
  }

  init() {
    super.init();
    this.corpse = undefined;
    this.corpseCarried = false;
    this.busted = false;
    this.npcs = [];
    this.lamps = [];
    this.copGone = false;
    this.copDir = 1;
    this.copWait = 0;
    this.copDetours = 0;
    this.copBlockT = 0;
    this.dames = [];
  }

  protected mapData() { return getMap('alley'); }
  protected mapRows() { return getMap('alley').rows; }
  protected isWall(ch: string) { return !!ALLEY_TILES[ch]?.wall; }
  protected darkness() { return 0.5; }
  protected floorKey(x: number, y: number) { return alleyFloor(this.rows, x, y); }

  protected tileFor(ch: string, x = 0, y = 0): TileInfo {
    const d = ALLEY_TILES[ch];
    return d ? { key: tileKey(d, x, y), solid: d.solid, object: d.object } : { key: '', solid: false };
  }

  protected goalText() {
    if (state.gameOver === 'win') return 'Was hast du getan ...';
    if (state.carrying) return 'Die Katze wartet. Bring ihr das Abendessen.';
    if (this.corpse) return this.corpseCarried ? 'In eine Mülltonne oder den Container damit!' : 'Pack die Leiche (E) und ab in den Müll!';
    const f = state.flags;
    if (freiesSpiel(f)) return weltZiel(f);
    if (state.dead) return 'Hol die Leiche aus der Bar.';
    return 'Automat vorne, Dealer hinten, Fusel im Müll.';
  }

  private find(ch: string): [number, number] {
    for (let y = 0; y < this.rows.length; y++) {
      const x = this.rows[y].indexOf(ch);
      if (x >= 0) return [x, y];
    }
    return [1, 1];
  }

  protected setupWorld() {
    audio.music('alley');
    audio.setRain(true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.setRain(false));
    // Türen in die Kneipe: Haupteingang vorne, Hintertür zur Gasse
    const [dx, dy] = this.find('D');
    const [qx, qy] = this.find('Q');
    const enter = (spawn: [number, number], label: string) => ({
      label: () => (this.corpse ? 'Erst die Leiche loswerden!' : label),
      act: () => {
        if (this.corpse) return this.toast('Mit einer Leiche durch die Kneipe? Lieber nicht.');
        if (!this.leaving) countBarEntry();
        this.go('Bar', { spawn });
      },
    });
    this.interacts.push({ x: dx * T + 8, y: (dy + 1) * T + 4, r: 18, ...enter(BAR_DOOR_SPAWN, 'Kneipe betreten') });
    this.interacts.push({ x: qx * T + 8, y: qy * T - 4, r: 18, ...enter(BAR_BACK_SPAWN, 'Hintertür zur Kneipe') });
    this.buildStreet(dx, dy, qx, qy);

    // Zigarettenautomat
    const [ax, ay] = this.find('A');
    this.interacts.push({
      x: ax * T + 8, y: (ay + 1) * T + 4, r: 18,
      label: () => 'Zigarettenautomat',
      act: () => this.openShop('automat'),
    });

    // Mülltonnen
    for (let y = 0; y < this.rows.length; y++)
      for (let x = 0; x < this.rows[y].length; x++) {
        if (this.rows[y][x] !== 'T') continue;
        const key = `${x},${y}`;
        this.interacts.push({
          x: x * T + 8, y: y * T + 10, r: 20,
          label: () => {
            if (this.corpseCarried) return 'Leiche in den Müll werfen';
            return (trashSearched.get(key) ?? -999) + 25 < state.time ? 'Mülltonne durchwühlen' : null;
          },
          act: () => {
            if (this.corpseCarried) return this.dispose(x * T + 8, y * T + 8);
            trashSearched.set(key, state.time);
            audio.sfx('rummage');
            const roll = Math.random();
            if (roll < 0.45) {
              const v = Phaser.Math.Between(1, 4);
              state.money += v;
              this.float(`+${v}€`);
              audio.sfx('coin');
            } else if (roll < 0.75) {
              state.inv.fusel++;
              this.float('+1 Fusel', '#9ae09a');
              audio.sfx('clang');
            } else this.toast(Phaser.Utils.Array.GetRandom(JUNK));
          },
        });
      }

    // Container (nur zum Entsorgen)
    const [gx, gy] = this.find('G');
    this.interacts.push({ x: gx * T + 16, y: gy * T + 12, r: 24, label: () => (this.corpseCarried ? 'In den Container werfen' : null), act: () => this.dispose(gx * T + 16, gy * T + 8) });

    // Dealer
    const [xx, xy] = this.find('X');
    const dealer = this.add.sprite(xx * T + 8, xy * T + 14, 'dealer', 6).setOrigin(0.5, 1).setScale(0.5).setDepth(xy * T + 14).setFlipX(true);
    this.npcs.push(dealer, this.add.image(dealer.x, dealer.y - 1, 'shadow').setDepth(1));
    this.dealerPos = [dealer.x, dealer.y];
    this.tweens.add({ targets: dealer, scaleY: 0.48, duration: 900, yoyo: true, repeat: -1 });
    this.interacts.push({
      x: dealer.x, y: dealer.y - 4, r: 22,
      label: () => (this.dealDangerous() ? 'Dealer ansprechen (DER BULLE GUCKT!)' : 'Dealer ansprechen'),
      act: () => {
        if (this.dealDangerous()) return this.bust('Drogenkauf? Direkt vor meiner Nase?!');
        this.talk('dealer', (a) => a === 'shop' && (this.dealDangerous() ? this.bust('Drogenkauf? Direkt vor meiner Nase?!') : this.openShop('dealer')));
      },
    });
    this.addLight(dealer.x, dealer.y - 10, 0.6, 0.35);

    // Polizist Felix läuft die Gasse auf und ab, Endpunkte nur auf begehbaren Kacheln
    const [ox, oy] = this.origin();
    const row = COP_ROW + oy;
    let from = COP_FROM + ox, to = COP_TO + ox;
    while (from < to && this.solid[row][from]) from++;
    while (to > from && this.solid[row][to]) to--;
    this.copFrom = from * T + 8;
    this.copTo = to * T + 8;
    this.copLane = this.copHome = row * T + 14;
    this.cop = this.add.sprite(this.copFrom, this.copLane, 'polizist', 6).setOrigin(0.5, 1).setScale(0.5);
    this.cop.play('polizist_side');
    this.copSpot = { x: this.cop.x, y: this.cop.y - 4, r: 20, label: () => (this.copGone || this.busted || state.carrying || this.corpseCarried ? null : 'Polizist Felix ansprechen'), act: () => this.talk('cop', (a) => a === 'felixKnueppel' && this.felixKnueppel()) };
    this.interacts.push(this.copSpot);
    this.npcs.push(this.cop);
    this.cone = this.add.graphics().setDepth(5001).setBlendMode(Phaser.BlendModes.ADD);

    // Damen der Nacht
    let n = 0;
    for (let y = 0; y < this.rows.length; y++)
      for (let x = 0; x < this.rows[y].length; x++) if (this.rows[y][x] === 'Y') this.addDame(x, y, n++ % 2);

    // Die Katze (im freien Spiel haust sie im Keller, ihr Platz bleibt leer)
    if (!freiesSpiel(state.flags)) {
      const [kx, ky] = this.find('K');
      this.cat = this.add.sprite(kx * T + 8, ky * T + 12, 'cat', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(ky * T + 12);
      this.cat.play('cat_idle');
      this.add.image(this.cat.x, this.cat.y, 'shadow').setDepth(1).setScale(0.8);
      // fauliger Schimmer und Fliegen
      this.addLight(this.cat.x, this.cat.y - 4, 0.45, 0.5).setTint(0x60ff40);
      this.buzz(this.cat.x, this.cat.y - 8, 4, 10);
      this.interacts.push({
        x: this.cat.x, y: this.cat.y - 4, r: 24,
        label: () => (state.gameOver ? null : state.carrying ? 'Der Katze servieren' : 'Mit der Katze ... reden?'),
        act: () => (state.carrying ? this.feed() : (audio.sfx('meow'), this.talk('katze'))),
      });
    }

    // Offene Welt: Figuren der laufenden Stränge, Finale, nächste Story-Fortsetzung
    if (state.flags.claudius) this.addClaudius();
    this.scheduleStory(() => !!this.corpse);

    // Lampen an der Wand
    for (let x = 0; x < this.rows[1].length; x++) if (this.rows[1][x] === 'L') this.lamps.push(this.addLight(x * T + 8, 2 * T + 8, 1.2, 0.85));
    this.addLight(ax * T + 8, (ay + 1) * T + 4, 0.5, 0.5).setTint(0xff6060);

    // Regen
    this.add.particles(0, 0, 'coin', {
      x: { min: 0, max: this.rows[0].length * T },
      y: -10,
      lifespan: 1200,
      speedY: { min: 200, max: 260 },
      speedX: -30,
      scaleX: 0.075,
      scaleY: 0.3,
      alpha: 0.25,
      tint: 0x8aa0c8,
      frequency: 12,
    }).setDepth(5002);
  }

  /** Fassade, Straßenmöbel und Lichter rund ums Haus. */
  private buildStreet(dx: number, dy: number, qx: number, qy: number) {
    this.addLeonard(dx);
    if (lilyWartet(state.flags)) this.addLilly();
    // Schild über dem Eingang, Außenlampe, Lichtschein der Fenster auf dem Gehweg
    this.add.image(dx * T + 8, (dy - 1) * T + 7, 'barSign').setScale(0.5).setDepth(2);
    this.addLight(dx * T + 8, (dy - 1) * T + 6, 0.55, 0.45).setTint(0xff6ab4);
    this.addLight(dx * T + 8, (dy + 1) * T, 0.8, 0.75).setTint(0xffd080);
    this.addLight(qx * T + 8, qy * T - 2, 0.6, 0.6).setTint(0xfff0b0);
    for (let x = 0; x < this.rows[dy].length; x++) if (this.rows[dy][x] === 'H') this.addLight(x * T + 8, (dy + 1) * T + 2, 0.45, 0.32).setTint(0xffb860);
    for (let y = 0; y < this.rows.length; y++)
      for (let x = 0; x < this.rows[y].length; x++) {
        const ch = this.rows[y][x];
        if (ch === 'l') {
          // Straßenlaterne: hoher Sprite, steht mit dem Fuß auf der Kachel
          this.add.image(x * T + 8, (y + 1) * T - 1, 'lampPost').setOrigin(0.5, 1).setScale(0.5).setDepth((y + 1) * T - 1);
          this.addLight(x * T + 8, y * T - 6, 1.1, 0.8).setTint(0xfff0c0);
        } else if (ch === 'z') {
          this.add.image(x * T, y * T + 15, 'car').setOrigin(0, 1).setScale(0.5).setDepth(y * T + 15);
          this.interacts.push({
            x: x * T + 16, y: y * T - 2, r: 20, label: () => 'Altes Auto',
            act: () => {
              // Easter Egg: wer oft genug hinsieht, findet einen zweiten Zettel
              if (zaehle('golf') >= 3 && entdecke(state.flags, 'golf')) return this.toast('Unter dem ersten Strafzettel klemmt ein zweiter: „Parken verboten. Auch für Golfs von 1991.“');
              this.toast('Ein rostiger Golf. Strafzettel von 2019 hinter dem Wischer.');
            },
          });
        } else if (ch === 'n') {
          this.interacts.push({ x: x * T + 8, y: y * T + 8, r: 16, label: () => 'Bank', act: () => this.toast('Eingeritzt: „BRENNINGER STINKT“.') });
        } else if (ch === 'U') {
          // Mayas Feinkost: Schild über der Tür, warmes Licht, rein geht es (nicht mit Leiche)
          this.add.image(x * T + 8, y * T - 5, 'ladenSign').setScale(0.5).setDepth(2);
          this.addLight(x * T + 8, (y + 1) * T, 0.6, 0.6).setTint(0xffe0a0);
          this.interacts.push({
            x: x * T + 8, y: (y + 1) * T + 4, r: 16,
            label: () => (state.carrying ? null : this.corpse ? 'Erst die Leiche loswerden!' : 'Mayas Feinkost betreten'),
            act: () => (this.corpse ? this.toast('Mit einer Leiche in den Feinkostladen? Lieber nicht.') : this.go('Laden', { spawn: LADEN_SPAWN })),
          });
        } else if (ch === 'o') {
          // Easter Egg: aus dem Gully quakt es (nach Operation Pogo haben sich die Enten organisiert)
          this.interacts.push({
            x: x * T + 8, y: y * T + 8, r: 12, label: () => 'Gullydeckel',
            act: () => {
              entdecke(state.flags, 'gully');
              this.toast(state.flags.claudius === 'veroeffentlicht' ? 'Aus dem Gully: rhythmisches Quaken. Klingt nach Marschmusik. Die Enten haben sich organisiert.' : 'Aus dem Gully: ein leises Quaken. Enten? Hier unten?');
            },
          });
          // Dampf aus dem Gully
          this.add.particles(x * T + 8, y * T + 8, 'light', {
            lifespan: 2400, speedY: { min: -12, max: -6 }, speedX: { min: -3, max: 3 }, scale: { start: 0.06, end: 0.22 },
            alpha: { start: 0.18, end: 0 }, tint: 0xc8c8d0, frequency: 260,
          }).setDepth(4000);
        }
      }
  }

  /** Kapitel 5: Captain Claudius posiert vor dem Eimer (bis zur Veröffentlichung), Kevin steht daneben (gleiche Figur wie in der Toilette). */
  private addClaudius() {
    const done = state.flags.claudius === 'veroeffentlicht';
    const [kx, ky] = this.at(KEVIN_TILE);
    const kevin = this.add.sprite(kx * T + 8, ky * T + 14, 'kevin', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(ky * T + 14).setFlipX(!done);
    this.npcs.push(kevin, this.add.image(kevin.x, kevin.y - 1, 'shadow').setDepth(1).setScale(1.2, 1));
    this.solid[ky][kx] = true;
    this.time.addEvent({
      delay: 3700, loop: true,
      callback: () => {
        if (!kevin.active) return;
        kevin.setFrame(1);
        this.time.delayedCall(800, () => kevin.active && kevin.setFrame(0));
      },
    });
    this.interacts.push({ x: kevin.x, y: kevin.y - 4, r: 18, label: () => (kevin.active && !this.corpse && !state.carrying ? 'Mit Kevin reden' : null), act: () => this.talk('kevinGasse') });
    if (done) return;

    const [cx, cy] = this.at(CLAUDIUS_TILE);
    const cap = this.add.sprite(cx * T + 8, cy * T + 14, 'claudius', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(cy * T + 14);
    this.npcs.push(cap, this.add.image(cap.x, cap.y - 1, 'shadow').setDepth(1));
    this.solid[cy][cx] = true;
    this.tweens.add({ targets: cap, scaleY: 0.52, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({
      delay: 4200, loop: true,
      callback: () => {
        if (!cap.active) return;
        cap.setFrame(1);
        floatText(this, cap.x, cap.y - 26, Phaser.Utils.Array.GetRandom(['BÜRGER!', 'KEINE FRAGEN!', 'ALLES UNTER KONTROLLE!', 'ES GAB NIE EINEN TEICH!']), '#9ac0ff');
        this.time.delayedCall(1200, () => cap.active && cap.setFrame(0));
      },
    });
    this.interacts.push({ x: cap.x, y: cap.y - 4, r: 18, label: () => (cap.active && !this.corpse && !state.carrying ? 'Mit Captain Claudius reden' : null), act: () => this.talk('claudius') });
  }

  /** Der kräftige Leonard lehnt an der Laterne, die dem Eingang am nächsten steht. */
  private addLeonard(doorX: number) {
    let best: [number, number] | null = null;
    for (let y = 0; y < this.rows.length; y++)
      for (let x = 0; x < this.rows[y].length; x++)
        if (this.rows[y][x] === 'l' && (!best || Math.abs(x - doorX) < Math.abs(best[0] - doorX))) best = [x, y];
    if (!best) return;
    const [lx, ly] = best;
    const x = lx * T + 2, y = (ly + 1) * T - 1;
    const leo = this.add.sprite(x, y, 'leonard', 0).setOrigin(0.5, 1).setScale(0.5).setAngle(9).setDepth(y);
    const shadow = this.add.image(x, y - 1, 'shadow').setDepth(1).setScale(1.1, 0.8);
    this.npcs.push(leo, shadow);
    // atmet schwer, ab und zu wird gepost
    this.tweens.add({ targets: leo, scaleX: 0.53, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({
      delay: 3200, loop: true,
      callback: () => {
        if (!leo.active) return;
        leo.setFrame(1).setAngle(0);
        this.time.delayedCall(900, () => leo.active && leo.setFrame(0).setAngle(9));
      },
    });
    this.interacts.push({
      x, y: y - 4, r: 18,
      label: () => (leo.active && !state.carrying ? 'Mit Leonard reden' : null),
      act: () => this.talk('leonard', (a) => this.leonardSells(a)),
    });
  }

  /** Lilly sitzt in der Hintergasse an der Wand, Kopf auf den Knien. Erscheint erst, wenn der Wirt Borna kennt. */
  private addLilly() {
    const [tx, ty] = this.at(LILY_TILE);
    const x = tx * T + 8, y = ty * T + 13;
    const lily = this.add.sprite(x, y, 'lilySit', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    const shadow = this.add.image(x, y - 1, 'shadow').setDepth(1);
    this.npcs.push(lily, shadow);
    // schluchzt leise vor sich hin
    this.time.addEvent({
      delay: 1700, loop: true,
      callback: () => {
        if (!lily.active || lily.texture.key !== 'lilySit') return;
        lily.setFrame(1);
        this.tweens.add({ targets: lily, y: y - 1, duration: 120, yoyo: true, repeat: 2 });
        this.time.delayedCall(700, () => lily.active && lily.texture.key === 'lilySit' && lily.setFrame(0));
      },
    });
    this.interacts.push({
      x, y: y - 4, r: 18,
      label: () => (lily.active && lilyWartet(state.flags) && !state.carrying && !this.corpseCarried ? 'Mit der jungen Frau reden' : null),
      act: () => this.talk('lily', (a) => this.lilyDone(a, lily, shadow)),
    });
  }

  private lilyDone(a: DialogAction | undefined, lily: Phaser.GameObjects.Sprite, shadow: Phaser.GameObjects.Image) {
    if (state.flags.lily || state.flags.borna === 'gebrochen') return;
    if (a === 'lilyWeg') {
      // Verlauf: weggeschickt. Sie geht und kommt nicht wieder.
      state.flags.lily = 'weg';
      lily.setTexture('lilyWalk', 6).play('lilyWalk_side');
      shadow.destroy();
      this.tweens.add({
        targets: lily, x: lily.x + 220, duration: 4200,
        onUpdate: () => lily.setDepth(lily.y),
        onComplete: () => lily.destroy(),
      });
      this.tweens.add({ targets: lily, alpha: 0, delay: 3200, duration: 1000 });
    } else if (a === 'lilyDach') {
      // Verlauf B: ab auf den Dachboden. Endgültig, Borna kann nicht mehr in Verlauf A rutschen.
      state.flags.lily = 'dach';
      state.flags.borna = 'hoffnung';
      unlock('untermieter');
      this.leaving = true;
      fadeTo(this, 'Cutscene', { script: 'lilyDach', music: 'bar', next: { scene: 'Bar', data: { spawn: BAR_LADDER_SPAWN } } });
    }
  }

  private leonardSells(a?: DialogAction) {
    if (a !== 'speed' && a !== 'bulk') return;
    const price = PILLS[a];
    if (state.money < price) return this.toast('Leonard: „Kein Geld, keine Muckis.“');
    state.money -= price;
    state.boost[a] = state.time + PILLS.duration;
    unlock('vitaminL');
    audio.sfx('glug');
    this.float(`-${price}€`, '#ff8a6a');
    if (a === 'speed') {
      this.toast('Die Blauen knallen. Dein Herz rast. Deine Beine auch.');
      this.cameras.main.flash(200, 80, 160, 255);
    } else {
      this.toast('Die Roten wirken. Dein Hemd platzt aus allen Nähten.');
      this.cameras.main.shake(300, 0.01);
      audio.sfx('growl');
    }
  }

  private addDame(tx: number, ty: number, variant: number) {
    const key = `${tx},${ty}`;
    const dame = this.add.sprite(tx * T + 8, ty * T + 14, `dame${variant}`, 0).setOrigin(0.5, 1).setScale(0.5);
    const shadow = this.add.image(dame.x, dame.y - 1, 'shadow').setDepth(1);
    this.npcs.push(dame, shadow);
    this.dames.push(dame);
    // langsam auf und ab schlendern, nur zwischen Mitten begehbarer Kacheln (nie durch Wände, Container oder Tonnen)
    const free = (x: number) => !(this.solid[ty]?.[x] ?? true);
    const x0 = dame.x;
    const x1 = free(tx + 1) ? x0 + T : free(tx - 1) ? x0 - T : x0;
    const stroll = () => {
      if (x1 === x0) return;
      dame.setX(x0).setFlipX(x1 < x0);
      this.tweens.add({
        targets: dame, x: x1, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', hold: 1200, repeatDelay: 1200,
        onYoyo: () => dame.setFlipX(x1 > x0), onRepeat: () => dame.setFlipX(x1 < x0),
      });
    };
    stroll();
    dame.play(`dame${variant}_side`);
    const away = () => (dameReady.get(key) ?? 0) > state.time;
    let spot: Interact | undefined;
    const sync = () => {
      if (!dame.active) return;
      if (spot) spot.x = dame.x;
      dame.setVisible(!away() || dame.getData('angry') || dame.getData('dying'));
      shadow.setVisible(dame.visible).setPosition(dame.x, dame.y - 1);
      dame.setDepth(dame.y);
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, sync);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.UPDATE, sync));

    const busy = () => away() || !!dame.getData('dying') || !!this.corpse || state.carrying;
    spot = {
      x: dame.x, y: dame.y - 4, r: 20,
      label: () => (dame.active && dame.visible && !busy() ? (this.copSees(this.player.x, this.player.y) ? 'Ansprechen (DER BULLE GUCKT!)' : 'Ansprechen') : null),
      act: () => !busy() && this.talk(`dame${variant}`, (a) => a === 'kill' && kill()),
    };
    const kill = () => {
      if (busy()) return;
      if (this.copSees(this.player.x, this.player.y) || this.copSees(dame.x, dame.y)) return this.bust('Vor den Augen der Polizei? Mutig. Und dumm.');
      if (!bulky() && Math.random() < 0.25) {
        // Sie wehrt sich
        const lost = Math.min(state.money, 3);
        state.money -= lost;
        audio.sfx('slap');
        this.toast(Phaser.Utils.Array.GetRandom(SLAPPED) + (lost ? ` (-${lost}€)` : ''));
        this.cameras.main.shake(200, 0.01);
        this.cameras.main.flash(120, 255, 80, 80);
        dameReady.set(key, state.time + 20);
        dame.setData('angry', true).setTint(0xff9090);
        this.time.delayedCall(1500, () => dame.setData('angry', false).clearTint());
        return;
      }
      // Stilisierte Szene, danach wie gehabt: Handtasche plündern, Leiche bleibt liegen, die Uhr tickt
      this.takedown(dame, () => {
        const v = Phaser.Math.Between(6, 12);
        state.money += v;
        this.float(`+${v}€`);
        audio.sfx('coin');
        this.toast(Phaser.Utils.Array.GetRandom(KILLED));
        dameReady.set(key, Number.POSITIVE_INFINITY);
        state.bodyDeadline = state.time + 20;
        this.corpseKey = key;
        const corpse = this.add.sprite(dame.x, dame.y - 4, `dame${variant}`, 0).setScale(0.5).setDepth(dame.y).setTint(0x8a8a9a);
        this.tweens.add({ targets: corpse, angle: dame.x < this.player.x ? -90 : 90, duration: 250, ease: 'Quad.easeIn' });
        this.corpse = corpse;
        this.interacts.push({
          x: corpse.x, y: corpse.y, r: 20,
          label: () => (this.corpse === corpse && !this.corpseCarried ? 'Leiche packen' : null),
          act: () => {
            if (this.corpse !== corpse || this.corpseCarried) return;
            this.corpseCarried = true;
            this.slow = true;
            corpse.setAngle(90);
            audio.sfx('thud');
          },
        });
        // irgendwann steht hier wieder eine (siehe dispose): dann schlendert sie wieder
        stroll();
      });
    };
    this.interacts.push(spot);
  }

  /**
   * Stilisierte, unblutige Darstellung: Der Wirt tritt hinter die Frau, sein Gesicht liegt im Schatten,
   * roter Schleier, abstrakte dunkle Schlieren, dumpfer Laut, roter Puls, dann wieder normales Bild.
   * Keine Waffe, keine Wunden, kein Blut.
   */
  private takedown(dame: Phaser.GameObjects.Sprite, done: () => void) {
    const p = this.player, cam = this.cameras.main;
    this.leaving = true; // Wirt kurz einfrieren
    this.actsBlocked = true;
    hud.prompt = '';
    this.tweens.killTweensOf(dame);
    dame.anims.stop();
    dame.setData('dying', true);
    const side = p.x < dame.x ? -1 : 1;
    dame.setFlipX(side < 0); // sie schaut weg vom Wirt
    p.anims.play('wirt_side', true);
    p.setFlipX(side > 0).setTint(0x2a2430);
    this.tweens.add({
      targets: p, x: dame.x + side * 5, y: dame.y - 1, duration: 280, ease: 'Quad.easeOut',
      onUpdate: () => { p.setDepth(dame.depth - 1); this.shadow.setPosition(p.x, p.y - 1); },
      onComplete: () => { p.anims.stop(); p.setFrame(6); },
    });
    audio.sfx('step');

    // roter Schleier über der Szene
    const veil = this.add.rectangle(dame.x, dame.y, 1400, 1000, 0x7a0010, 0).setDepth(5600);
    this.tweens.add({ targets: veil, fillAlpha: 0.42, duration: 300, delay: 180 });

    this.time.delayedCall(600, () => {
      // abstrakte Bewegung: dunkle Schlieren huschen quer über beide
      for (let i = 0; i < 4; i++) {
        const s = this.add.rectangle(dame.x - side * 16, dame.y - 6 - i * 4, 18, 2, 0x000000, 0.9).setDepth(5601);
        this.tweens.add({ targets: s, x: dame.x + side * 16, scaleX: 0.2, alpha: 0, duration: 180, delay: i * 35, onComplete: () => s.destroy() });
      }
      cam.shake(160, 0.008);
      cam.flash(220, 170, 0, 20);
      audio.sfx('thud');
      audio.sfx('sting');
      dame.setTint(0x3a2a3a);
      // roter Puls
      this.tweens.add({ targets: veil, fillAlpha: 0.65, duration: 110, yoyo: true, repeat: 1 });
    });

    this.time.delayedCall(1250, () => {
      this.tweens.add({ targets: veil, fillAlpha: 0, duration: 450, onComplete: () => veil.destroy() });
      p.clearTint();
      dame.clearTint().setData('dying', false);
      if (!this.busted) {
        this.leaving = false;
        this.actsBlocked = false;
      }
      done();
    });
  }

  private dispose(x: number, y: number) {
    const corpse = this.corpse;
    if (!corpse || !this.corpseCarried) return;
    this.corpseCarried = false;
    this.slow = false;
    this.corpse = undefined;
    state.bodyDeadline = null;
    dameReady.set(this.corpseKey, state.time + 60); // irgendwann steht eine Neue da
    this.tweens.add({ targets: corpse, x, y, scale: 0.15, alpha: 0, duration: 350, ease: 'Quad.easeIn', onComplete: () => corpse.destroy() });
    this.cameras.main.shake(120, 0.005);
    this.float('ENTSORGT', '#9ae09a');
    audio.sfx('clang');
    this.toast('Weg damit. Niemand hat was gesehen.');
  }

  private solidAt(x: number, y: number) {
    return this.solid[Math.floor(y / T)]?.[Math.floor(x / T)] ?? true;
  }

  /** Wie weit reicht ein Blick in Richtung a, bevor eine feste Kachel (Wand, Tür, Container …) ihn stoppt? */
  private castRay(x: number, y: number, a: number, len: number) {
    const cx = Math.cos(a), cy = Math.sin(a);
    for (let d = 2; d <= len; d += 2) if (this.solidAt(x + cx * d, y + cy * d)) return d;
    return len;
  }

  /** Augenhöhe von Felix (eine Spur über den Füßen) */
  private copEye(): [number, number] {
    return [this.cop.x, this.cop.y - 4];
  }

  /**
   * Sieht Felix diesen Punkt (Füße bei x, y)? Innerhalb von Reichweite und Öffnungswinkel in Blickrichtung,
   * oder ganz nah rundum, und nur, wenn keine Wand dazwischen ist. Gleiche Geometrie wie der gezeichnete Kegel.
   */
  private copSees(x: number, y: number) {
    if (!this.cop || this.copGone) return false;
    const [ex, ey] = this.copEye();
    const dx = x - ex, dy = y - 4 - ey, dist = Math.hypot(dx, dy);
    if (dist > VIEW_LEN) return false;
    const a = Math.atan2(dy, dx);
    if (dist >= VIEW_CLOSE && Math.abs(Phaser.Math.Angle.Wrap(a - (this.copDir > 0 ? 0 : Math.PI))) > VIEW_HALF) return false;
    return this.castRay(ex, ey, a, dist) >= dist;
  }

  /** Steht jemand (Wirt, eine Dame) direkt vor Felix auf seiner Spur? */
  private copBlockedByPeople(x: number, y: number) {
    const near = (o: { x: number; y: number }) => Math.abs(o.x - x) < 9 && Math.abs(o.y - y) < 7;
    if (near(this.player)) return true;
    return this.dames.some((d) => d.active && d.visible && near(d));
  }

  /** Kann Felix an dieser Stelle (Füße) stehen? Nur begehbare Kacheln. */
  private copCanStand(x: number, y: number) {
    return !this.solidAt(x - 3, y - 3) && !this.solidAt(x + 3, y - 3);
  }

  private dealDangerous() {
    return this.copSees(this.player.x, this.player.y) || this.copSees(...this.dealerPos);
  }

  private bust(why: string) {
    if (this.busted) return;
    this.busted = true;
    this.leaving = true; // einfrieren
    state.caughtBy = 'bulle';
    state.running = false;
    this.time.delayedCall(1800, () => {
      state.gameOver = 'polizei';
      fadeTo(this, 'End');
    });
    this.toast(`Felix: „HALT! POLIZEI!“ ${why}`);
    audio.sfx('siren');
    this.cameras.main.flash(300, 80, 120, 255);
    this.cop.anims.stop();
    const bang = this.add.text(this.cop.x, this.cop.y - 30, '!', { fontFamily: '"Press Start 2P", monospace', fontSize: '16px', color: '#ff3030' }).setOrigin(0.5).setDepth(6000).setStroke('#000', 4);
    this.tweens.add({ targets: bang, y: bang.y - 6, duration: 200, yoyo: true, repeat: 3 });
  }

  /** Felix eskaliert: Schlagstock raus, ein Hieb, der Wirt geht zu Boden. Danach Game over. */
  private felixKnueppel() {
    if (this.busted) return;
    this.busted = true;
    this.leaving = true; // Spieler einfrieren
    state.running = false;
    state.caughtBy = 'felix';
    unlock('profilPasst');
    const c = this.cop, p = this.player;
    const dir = p.x < c.x ? -1 : 1;
    c.anims.stop();
    c.setFrame(6).setFlipX(dir < 0).setTint(0xff9090);
    this.cone.clear();
    audio.sfx('angry');
    const bang = this.add.text(c.x, c.y - 30, '!', { fontFamily: '"Press Start 2P", monospace', fontSize: '16px', color: '#ff3030' }).setOrigin(0.5).setDepth(6000).setStroke('#000', 4);
    this.tweens.add({ targets: bang, y: bang.y - 6, duration: 160, yoyo: true, repeat: 2, onComplete: () => bang.destroy() });
    // Schlagstock ziehen
    const baton = this.add.rectangle(c.x + dir * 4, c.y - 11, 2, 11, 0x14141c).setOrigin(0.5, 1).setDepth(c.y + 1);
    baton.setAngle(dir * 20);
    this.tweens.add({ targets: baton, angle: -dir * 130, duration: 300, delay: 300, ease: 'Back.easeOut' });
    // losstürmen
    this.time.delayedCall(800, () => {
      c.anims.play('polizist_side', true);
      this.tweens.add({
        targets: c, x: p.x - dir * 10, y: p.y, duration: 320, ease: 'Quad.easeIn',
        onUpdate: () => { baton.setPosition(c.x + dir * 4, c.y - 11); c.setDepth(c.y); },
        onComplete: () => {
          c.anims.stop();
          // Zuschlagen
          this.tweens.add({ targets: baton, angle: dir * 70, duration: 90, ease: 'Quad.easeIn', onComplete: () => this.felixHit(dir) });
        },
      });
    });
  }

  private felixHit(dir: number) {
    const p = this.player;
    audio.sfx('thud');
    audio.sfx('slap');
    this.cameras.main.shake(300, 0.02);
    this.cameras.main.flash(120, 255, 255, 255);
    const bonk = this.add.text(p.x, p.y - 34, 'BONK!', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#f8e070' }).setOrigin(0.5).setDepth(6001).setStroke('#000', 3);
    this.tweens.add({ targets: bonk, y: bonk.y - 10, scale: 1.4, duration: 400, ease: 'Back.easeOut' });
    // Wirt kippt um, Sternchen kreisen
    this.tweens.add({ targets: p, angle: dir * 90, y: p.y + 2, duration: 260, ease: 'Quad.easeIn' });
    const stars = [0, 1, 2].map(() => this.add.image(p.x, p.y - 10, 'star').setScale(0.7).setDepth(6000));
    let t = 0;
    const ev = this.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        t += 0.12;
        stars.forEach((s, i) => s.setPosition(p.x + dir * 8 + Math.cos(t + i * 2.1) * 8, p.y - 8 + Math.sin(t + i * 2.1) * 3));
      },
    });
    this.toast('Felix: „Widerstand gegen die Staatsgewalt! Hab ich alles gesehen!“');
    this.time.delayedCall(2200, () => {
      ev.remove();
      state.gameOver = 'polizei';
      fadeTo(this, 'End');
    });
  }

  private updateCop(dt: number) {
    const c = this.cop;
    if (this.copGone) return;
    if (this.busted) return;
    const home = this.copHome, speed = 26;
    let walking = false;
    if (this.copWait > 0) {
      this.copWait -= dt;
    } else if (Math.abs(c.y - this.copLane) > 0.5) {
      // Spurwechsel: Umweg um ein Hindernis oder zurück auf die Streifenspur
      const dy = this.copLane - c.y;
      c.y += Math.sign(dy) * Math.min(Math.abs(dy), speed * dt);
      walking = true;
    } else {
      c.y = this.copLane;
      const nx = c.x + this.copDir * speed * dt, probe = nx + this.copDir * 6;
      const wall = !this.copCanStand(probe, c.y);
      const people = !wall && this.copBlockedByPeople(probe, c.y);
      if (!wall && !people) {
        c.x = nx;
        walking = true;
        this.copBlockT = 0;
        // nach einem Umweg zurück auf die Streifenspur, sobald sie frei ist
        if (this.copLane !== home && this.copCanStand(c.x, home) && this.copCanStand(c.x + this.copDir * 12, home) && !this.copBlockedByPeople(c.x + this.copDir * 6, home)) {
          this.copLane = home;
          this.copDetours = 0;
        }
      } else if (people && (this.copBlockT += dt) < 1.2) {
        // jemand steht im Weg: kurz warten, vielleicht geht er weiter
      } else {
        // dauerhaft blockiert: Umweg über eine freie Nachbarspur, sonst kurz warten und umkehren
        this.copBlockT = 0;
        const alt = [c.y - T, c.y + T].find((y) => this.copCanStand(c.x, y) && this.copCanStand(c.x + this.copDir * 14, y) && !this.copBlockedByPeople(c.x + this.copDir * 6, y));
        if (alt !== undefined && this.copDetours < 4) {
          this.copLane = alt;
          this.copDetours++;
        } else {
          this.copDir *= -1;
          this.copWait = 1.2;
        }
      }
      if ((this.copDir > 0 && c.x >= this.copTo) || (this.copDir < 0 && c.x <= this.copFrom)) {
        c.x = Phaser.Math.Clamp(c.x, this.copFrom, this.copTo);
        this.copDir *= -1;
        this.copWait = 1.5;
      }
    }
    if (walking) c.anims.play('polizist_side', true);
    else {
      c.anims.stop();
      c.setFrame(6);
    }
    c.setFlipX(this.copDir < 0).setDepth(c.y);
    if (this.copSpot) { this.copSpot.x = c.x; this.copSpot.y = c.y - 4; }
    // Taschenlampe: Strahlen enden an Wänden; genau diese Fläche prüft copSees
    const [ex, ey] = this.copEye(), base = this.copDir > 0 ? 0 : Math.PI;
    const V = Phaser.Math.Vector2;
    const fan = [new V(ex, ey)];
    for (let i = 0; i <= 18; i++) {
      const a = base - VIEW_HALF + (VIEW_HALF * 2 * i) / 18, d = this.castRay(ex, ey, a, VIEW_LEN);
      fan.push(new V(ex + Math.cos(a) * d, ey + Math.sin(a) * d));
    }
    const ring: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2, d = this.castRay(ex, ey, a, VIEW_CLOSE);
      ring.push(new V(ex + Math.cos(a) * d, ey + Math.sin(a) * d));
    }
    this.cone.clear().fillStyle(0xfff0a0, 0.12).fillPoints(fan, true);
    this.cone.fillStyle(0xfff0a0, 0.08).fillPoints(ring, true);
    // Leichen gesehen?
    if (this.corpse && this.copSees(this.corpse.x, this.corpseCarried ? this.player.y : this.corpse.y + 4)) this.bust('Ist das ... eine Leiche?!');
    if (state.carrying && this.copSees(this.player.x, this.player.y)) this.bust('Was tragen Sie da auf der Schulter?!');
  }

  update(t: number, d: number) {
    super.update(t, d);
    this.updateCop(d / 1000);
    if (this.corpse && this.corpseCarried) this.corpse.setPosition(this.player.x, this.player.y - 22).setDepth(this.player.y + 1);
    hud.alert = state.bodyDeadline !== null && !state.gameOver ? `LEICHE WEG: ${Math.max(0, Math.ceil(state.bodyDeadline - state.time))}s` : '';
  }

  private openShop(shop: 'automat' | 'dealer') {
    audio.sfx('click');
    this.scene.launch('Shop', { shop, resume: 'Alley' });
    this.scene.bringToTop('Shop');
    this.scene.pause();
  }


  /** Fliegen, die um einen Punkt kreisen. */
  private buzz(x: number, y: number, n: number, radius: number) {
    for (let i = 0; i < n; i++) {
      const f = this.add.rectangle(x, y, 1, 1, 0x0a0a0a).setDepth(4000);
      const sp = 300 + i * 70, ph = i * 1.7;
      const move = (t: number) => f.setPosition(x + Math.cos(t / sp + ph) * radius, y + Math.sin(t / (sp * 0.7) + ph) * radius * 0.6);
      this.events.on(Phaser.Scenes.Events.UPDATE, move);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.UPDATE, move));
    }
  }

  /** Alle NPCs ergreifen schreiend die Flucht. */
  private scatterNPCs() {
    this.copGone = true;
    this.cone.clear();
    for (const o of this.npcs) {
      if (!o.active) continue;
      const dir = o.x < this.cat.x ? -1 : 1;
      this.tweens.killTweensOf(o);
      if (o instanceof Phaser.GameObjects.Sprite) {
        o.clearTint().setAlpha(1).setFlipX(dir < 0);
        const key = o.texture.key;
        if (this.anims.exists(`${key}_side`)) o.play(`${key}_side`);
        o.anims.timeScale = 2;
        floatText(this, o.x, o.y - 24, Phaser.Utils.Array.GetRandom(['AAAH!', 'HILFE!', 'WEG HIER!']), '#ffffff');
        audio.sfx('scream');
      }
      this.tweens.add({ targets: o, x: o.x + dir * 260, duration: 1600, ease: 'Quad.easeIn', onComplete: () => o.destroy() });
    }
    this.npcs = [];
  }

  /** Die Katze verwandelt sich in das Monster – mitten in der Gasse, mit Wucht. */
  private mutate(chomp: Phaser.Time.TimerEvent) {
    chomp.remove();
    const cam = this.cameras.main;
    const { x, y } = this.cat;
    // Das Monster steht später mitten auf dem Pflaster, Füße auf der untersten Reihe
    const mx = x, my = y + T + 2;
    this.toast('Die Katze ... zuckt.');
    audio.music('monster');
    audio.sfx('growl');
    this.scatterNPCs();
    cam.pan(mx, my - 34, 1400, 'Sine.easeInOut');
    cam.zoomTo(2.2, 1400);
    // Wirt weicht zurück
    this.player.setFlipX(false).setFrame(6);
    this.tweens.add({ targets: this.player, x: mx - 64, y: my - 2, duration: 900, ease: 'Quad.easeOut' });

    // Lampen flackern
    for (const l of this.lamps) {
      this.tweens.killTweensOf(l);
      this.tweens.add({ targets: l, alpha: 0.05, duration: 60, yoyo: true, repeat: 12, repeatDelay: 90 });
    }
    // Krämpfe: Zittern, grünes Flackern, Mülltonnen klappern
    const rattle = this.children.list.filter((o) => o instanceof Phaser.GameObjects.Image && ['trash', 'dumpster', 'crate'].includes(o.texture.key)) as Phaser.GameObjects.Image[];
    const spasm = this.time.addEvent({
      delay: 90, repeat: 24,
      callback: () => {
        this.cat.x = x + Phaser.Math.Between(-2, 2);
        this.cat.setTint(Math.random() < 0.5 ? 0x80ff60 : 0xffffff);
        for (const r of rattle) r.setAngle(Phaser.Math.Between(-3, 3));
        cam.shake(80, 0.004);
      },
    });
    // Giftgas steigt auf
    const gas = this.add.particles(x, y - 6, 'light', {
      lifespan: 2200, speed: { min: 10, max: 40 }, angle: { min: 230, max: 310 }, scale: { start: 0.05, end: 0.35 },
      alpha: { start: 0.5, end: 0 }, tint: [0x60c030, 0x90e040, 0x406020], frequency: 60, blendMode: 'ADD',
    }).setDepth(5003);
    // grünes Glimmen auf dem Boden, wächst mit
    const groundGlow = this.add.image(mx, my - 8, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0x50ff30).setScale(0.3, 0.15).setAlpha(0.5).setDepth(5001);

    this.time.delayedCall(2400, () => {
      spasm.remove();
      cam.flash(400, 160, 255, 120);
      cam.shake(1100, 0.02);
      this.cat.setVisible(false);
      for (const r of rattle) r.setAngle(0);

      // Trümmer fliegen
      this.add.particles(x, y - 4, 'coin', {
        speed: { min: 60, max: 160 }, angle: { min: 200, max: 340 }, gravityY: 300, lifespan: 900,
        scale: { min: 0.15, max: 0.3 }, tint: [0x5a5a62, 0x3a3a40, 0x6a4a2a], emitting: false,
      }).setDepth(my + 20).explode(36);
      // Umgebung reagiert: Tonnen kippen, Kisten fliegen, Container verrutscht
      for (const r of rattle) {
        const dir = r.x < mx ? -1 : 1;
        if (r.texture.key === 'trash') this.tweens.add({ targets: r, angle: 90 * dir, x: r.x + dir * 6, y: r.y + 4, duration: 300, ease: 'Quad.easeIn' });
        if (r.texture.key === 'crate') this.tweens.add({ targets: r, angle: 160 * dir, x: r.x + dir * 30, duration: 500, ease: 'Quad.easeOut' });
        if (r.texture.key === 'dumpster') this.tweens.add({ targets: r, angle: -8 * dir, x: r.x + dir * 4, y: r.y - 2, duration: 250, ease: 'Back.easeOut' });
      }
      // Lampen gehen fast aus, nur noch fahles Glimmen
      for (const l of this.lamps) this.tweens.add({ targets: l, alpha: 0.15, duration: 300 });

      // Schatten + Monster wachsen aus der Katze heraus nach vorn auf das Pflaster
      const shadow = this.add.image(x, y, 'shadow').setDepth(2).setScale(1, 1).setAlpha(0.9);
      const m = this.add.sprite(x, y + 4, 'mutant', 0).setOrigin(0.5, 1).setDepth(my).setScale(0.075);
      m.play('mutant_idle');
      this.tweens.add({ targets: m, scale: 0.5, y: my, duration: 1400, ease: 'Back.easeOut' });
      this.tweens.add({ targets: shadow, scaleX: 6.5, scaleY: 3, y: my - 2, duration: 1400, ease: 'Back.easeOut' });
      this.tweens.add({ targets: groundGlow, scaleX: 1.6, scaleY: 0.6, alpha: 0.55, duration: 1400 });
      const aura = this.addLight(mx + 14, my - 40, 1.2, 0.45).setTint(0x60ff40);
      aura.setAlpha(0);
      this.tweens.add({ targets: aura, alpha: 0.45, duration: 1400 });
      this.buzz(mx + 10, my - 52, 8, 36);
      gas.setPosition(mx + 20, my - 30);
      // atmet: der Boden bebt bei jedem Atemzug leicht
      m.on(Phaser.Animations.Events.ANIMATION_REPEAT, () => cam.shake(120, 0.002));

      this.time.delayedCall(1300, () => {
        floatText(this, mx + 30, my - 60, 'GRRRAAAOOOWWL!!', '#b8f060');
        audio.sfx('roar');
        cam.shake(800, 0.016);
        this.toast('Was ... was ist DAS?!');
      });
      this.time.delayedCall(4600, () => this.go('Cutscene', { script: 'epilog', next: { scene: 'End' } }));
    });
  }

  private feed() {
    // Anfangsquest erledigt: ab hier ist die Welt offen (auch für den Kapitelstand am Ende des Epilogs)
    state.flags.glanzErledigt = true;
    state.carrying = false;
    state.bodyInAlley = true;
    state.gameOver = 'win';
    state.running = false;
    this.carried?.destroy();
    const body = this.add.sprite(this.cat.x - 16, this.cat.y - 2, `schnoesel${lookStage()}`, 0).setAngle(90).setScale(0.5).setDepth(this.cat.depth - 1);
    this.cameras.main.stopFollow();
    this.cameras.main.pan(this.cat.x, this.cat.y - 10, 600, 'Sine.easeInOut');
    this.cameras.main.zoomTo(3.5, 800);

    const chomp = this.time.addEvent({
      delay: 380, repeat: 9,
      callback: () => {
        this.float(Phaser.Utils.Array.GetRandom(['MAMPF', 'SCHMATZ', 'NOM', 'KNACK']), '#ffffff');
        audio.sfx('chomp');
        this.cameras.main.shake(120, 0.004);
        this.cat.x += Phaser.Math.Between(-2, 2);
      },
    });
    this.tweens.add({ targets: body, alpha: 0, scaleX: 0.2, delay: 600, duration: 3200 });
    this.time.delayedCall(4300, () => this.mutate(chomp));
  }
}
