import Phaser from 'phaser';
import { Ctx, blob, makeGastTextures, outline, p, tex2x } from '../gfx';

import { audio } from '../audio';
import { bulky, item, lookStage, PILLS, state } from '../state';
import { BAR_BACK_SPAWN, BAR_DOOR_SPAWN } from './BarScene';
import type { DialogAction } from '../dialog/data';
import { unlock } from '../progress/achievements';
import { freiesSpiel, lilyWartet } from '../progress/flags';
import { entdecke, weltZiel, zaehle } from '../progress/quests';
import { countBarEntry } from '../events/anne';
import { BAR_LADDER_SPAWN, BASAR_SPAWN, CLUB_SPAWN, KANAL_SPAWN, LADEN_SPAWN, SHISHA_SPAWN } from '../rooms/spawns';
import { fadeTo, floatText } from '../ui';
import { hud } from './HudScene';
import { Interact, T, TileInfo, TopDown } from './TopDown';
import { getMap } from '../maps';
import { ALLEY_TILES, MAP_DEFS, alleyFloor, tileKey } from '../maps/palettes';
import { Passanten, STRASSEN_NPCS, Welt } from '../world/passanten';
import { Kachel, weg } from '../world/wege';
import { janWeg, kanalAb, kanalOhnmacht, wirtFigur } from '../dialog/kanal';

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
/** Plätze der beiden neuen Damen der Nacht (Koordinaten der ursprünglichen Karte) */
const DESIREE_TILE: [number, number] = [-17, 19];
const ROXY_TILE: [number, number] = [53, -2];
/** Bereich der ursprünglichen Gasse (Koordinaten der ursprünglichen Karte); Petra und Kai gehen außerhalb Streife */
const ALTSTADT = { x0: -4, x1: 36, y0: -1 };
/** Lillys Platz an der Wand der Hintergasse (Kachel) */
const LILY_TILE: [number, number] = [29, 2];
/** Kapitel 5: wo Captain Claudius und Kevin vor der Kneipe stehen, und wo der Wirt danach steht (Kacheln) */
const CLAUDIUS_TILE: [number, number] = [21, 17];
const KEVIN_TILE: [number, number] = [23, 17];
/** Eingang des Stripclubs „Muskelkater“ (Kachel in Koordinaten der ursprünglichen Karte) */
const CLUB_DOOR: [number, number] = [-21, 17];
/** Eingang der Shisha-Bar „Shisha 1001“ */
const SHISHA_DOOR: [number, number] = [-11, 17];
/** Eingang des indischen Ladens „Masala Basar“ */
const BASAR_DOOR: [number, number] = [-8, 6];
/** Xavi-Strang: Tuncays Stand auf dem Parkplatz und der Platz von Leni und Xavi im Park (Grünstreifen) */
const TUNCAY_TILE: [number, number] = [-16, -6];
const PARK_TILE: [number, number] = [-12, -4];
/** Hanfbusch (Nick-Strang, Bornas Pflanze): niedriger Busch, darüber große Hanfblätter mit sieben getrennten Fingern */
function drawHanfbusch(c: Ctx) {
  const dunkel = '#1a4016', mittel = '#2a6020', hell = '#5cb03a', licht = '#9ade5a', stiel = '#3a5a1a';
  blob(c, 15, 27, 11, 2.5, '#122c12');
  blob(c, 15, 23, 11, 5, dunkel);
  blob(c, 15, 20, 8, 4, mittel);
  const blatt = (cx: number, cy: number, s: number, dreh: number) => {
    const winkel = [-78, -50, -24, 0, 24, 50, 78], laenge = [0.42, 0.7, 0.9, 1, 0.9, 0.7, 0.42];
    winkel.forEach((w, i) => {
      const a = ((w + dreh) * Math.PI) / 180, l = s * laenge[i];
      for (let t = 1; t <= l; t += 0.5) {
        const x = cx + Math.sin(a) * t, y = cy - Math.cos(a) * t;
        p(c, Math.round(x), Math.round(y), t > l * 0.7 ? licht : hell);
        if (i >= 2 && i <= 4 && t > l * 0.3 && t < l * 0.65) p(c, Math.round(x + Math.cos(a)), Math.round(y + Math.sin(a)), hell);
      }
    });
    p(c, cx, cy, stiel);
    p(c, cx, cy + 1, stiel);
  };
  blatt(8, 21, 8, -42);
  blatt(22, 21, 8, 42);
  blatt(15, 15, 11, 0);
  blatt(10, 25, 5, -72);
  blatt(20, 25, 5, 72);
  for (const [x, y] of [[15, 18], [11, 22], [19, 22]]) { blob(c, x, y, 1.2, 1.5, '#a8c860'); p(c, x, y - 1, '#e0a050'); }
  outline(c, 0, 0, 30, 30);
}

/** Nick-Strang: der Hanfbusch auf dem Grasstreifen gegenüber der Bar-Rückwand, in dem Bornas Pflanze steckt */
const BUSCH_TILE: [number, number] = [22, -4];
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
  private rainFx?: Phaser.GameObjects.Particles.ParticleEmitter;
  private copDetours = 0;
  private copBlockT = 0;
  /** Damen der Nacht (bewegliche Hindernisse für Felix) */
  private dames: Phaser.GameObjects.Sprite[] = [];
  /** Leute auf der Straße und die zusätzlichen Streifen (world/passanten.ts) */
  private passanten?: Passanten;
  /** Felix im Einsatz (ein Zeuge hat angerufen): Weg zum Ort, Suchzeit dort, Rückweg zur Streife */
  private felixPfad: { x: number; y: number }[] | null = null;
  private felixI = 0;
  private felixSucht = 0;
  private felixZurueck = false;

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
    this.passanten = undefined;
    this.felixPfad = null;
    this.felixSucht = 0;
    this.felixZurueck = false;
  }

  protected mapData() { return getMap('alley'); }
  protected mapRows() { return getMap('alley').rows; }
  protected isWall(ch: string) { return !!ALLEY_TILES[ch]?.wall; }
  protected darkness() { return MAP_DEFS.alley.dunkel; }
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
    this.gegend = null;
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
    // Teil 1: Felix im Kanal verloren: keine Streife mehr, am Eimer hängt ein Vermisstenplakat
    if (state.flags.felixKanal === 'verloren') {
      this.copGone = true;
      this.cop.setVisible(false).setActive(false);
      const [tx, ty] = this.find('D');
      const plakat = this.add.rectangle(tx * T + 26, ty * T - 2, 9, 12, 0xf4f0e0).setStrokeStyle(0.6, 0x3a3a3a).setDepth(ty * T + 1);
      this.add.rectangle(plakat.x, plakat.y - 2, 5, 4, 0x7aa8ff).setDepth(ty * T + 2);
      this.add.rectangle(plakat.x, plakat.y + 3, 7, 1, 0xc02a2a).setDepth(ty * T + 2);
      this.interacts.push({ x: plakat.x, y: plakat.y + 10, r: 12, label: () => 'Vermisstenplakat', act: () => this.toast('VERMISST: Polizeimeister Felix. Zuletzt gesehen mit Taschenlampe und Notizblock. Hinweise an jede Dienststelle. Darunter, mit Kuli: „Ich hab nichts gesehen.“') });
    }
    this.cone = this.add.graphics().setDepth(5001).setBlendMode(Phaser.BlendModes.ADD);

    // Damen der Nacht
    let n = 0;
    for (let y = 0; y < this.rows.length; y++)
      for (let x = 0; x < this.rows[y].length; x++) if (this.rows[y][x] === 'Y') this.addDame(x, y, n++ % 2);
    // Desirée vor dem Muskelkater, Roxy an der Ecke beim Waschsalon (Koordinaten der ursprünglichen Karte)
    if (STRASSEN_NPCS) for (const [pos, v] of [[DESIREE_TILE, 2], [ROXY_TILE, 3]] as const) {
      const [x, y] = this.at(pos);
      if (this.solid[y]?.[x] === false) this.addDame(x, y, v);
    }

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
    this.addClub();
    this.addShisha();
    this.addBasar();
    this.addXavi();
    this.addBusch();
    this.addSchleimspur();
    if (kanalOhnmacht.aufwachen) void this.aufwachen();
    this.scheduleStory(() => !!this.corpse);

    // Leute auf der Straße; die zusätzlichen Streifen gibt es erst im freien Spiel
    if (STRASSEN_NPCS) this.passanten = new Passanten(this.welt(), [Math.floor(this.player.x / T), Math.floor((this.player.y - 3) / T)], !!state.flags.glanzErledigt);

    // Lampen an der Wand
    // Wandlampen und Laternen kommen aus der Straßenansicht (maps/streetView.ts); bei der Mutation flackern sie
    this.lamps = this.mapLamps;

    // Regen: Emitter wandert mit dem Bildausschnitt, die Tropfen fallen in der Welt
    this.rainFx = this.add.particles(0, 0, 'coin', {
      x: { min: -40, max: 300 },
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
    const follow = () => { const v = this.cameras.main.worldView; this.rainFx?.setPosition(v.x, v.y); };
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, follow);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.POST_UPDATE, follow));
  }

  /** Fassade, Straßenmöbel und Lichter rund ums Haus. */
  private buildStreet(dx: number, dy: number, qx: number, qy: number) {
    this.addLeonard(dx, dy);
    if (lilyWartet(state.flags)) this.addLilly();
    // Schild über dem Eingang, Außenlampe, Lichtschein der Fenster auf dem Gehweg
    // Neonschild über der (zwei Kacheln hohen) Tür, im Obergeschoss; rosa Schein auf Fassade und nassem Gehweg
    const sign = this.add.image(dx * T + 8, (dy - 2) * T + 9, 'barSign').setScale(0.5).setDepth(2);
    this.tweens.add({ targets: sign, alpha: 0.82, duration: 70, yoyo: true, repeat: -1, repeatDelay: 2600 });
    this.addLight(dx * T + 8, (dy - 2) * T + 9, 0.6, 0.5).setTint(0xff6ab4);
    const neon = this.add.image(dx * T + 8, (dy + 1) * T + 14, 'lightSoft').setBlendMode(Phaser.BlendModes.ADD).setScale(0.5, 0.18).setTint(0xff4aa0).setAlpha(0.45).setDepth(2);
    this.tweens.add({ targets: neon, alpha: 0.3, duration: 70, yoyo: true, repeat: -1, repeatDelay: 2600 });
    void qx; void qy;
    for (let y = 0; y < this.rows.length; y++)
      for (let x = 0; x < this.rows[y].length; x++) {
        const ch = this.rows[y][x];
        if (ch === 'l') {
          // Straßenlaterne: hoher Sprite, steht mit dem Fuß auf der Kachel
          this.add.image(x * T + 8, (y + 1) * T - 1, 'lampPost').setOrigin(0.5, 1).setScale(0.5).setDepth((y + 1) * T - 1);
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
          this.add.image(x * T + 8, y * T - 22, 'ladenSign').setScale(0.5).setDepth(300);
          this.interacts.push({
            x: x * T + 8, y: (y + 1) * T + 4, r: 16,
            label: () => (state.carrying ? null : this.corpse ? 'Erst die Leiche loswerden!' : 'Mayas Feinkost betreten'),
            act: () => (this.corpse ? this.toast('Mit einer Leiche in den Feinkostladen? Lieber nicht.') : this.go('Laden', { spawn: LADEN_SPAWN })),
          });
        } else if (ch === 'o') {
          // Easter Egg: aus dem Gully klingt es nach Kneipe (nach Claudius' Niederlage feiert die Unterwelt)
          this.addGully(x, y);
          this.interacts.push({
            x: x * T + 8, y: y * T + 8, r: 12,
            label: () => {
              if (!kanalAb(state.flags, 'ausruestung')) return 'Gullydeckel';
              if (this.corpse || state.carrying) return 'Erst die Leiche loswerden!';
              return state.flags.gullyOffen ? 'Runter in den Kanal' : 'Gully öffnen';
            },
            act: () => {
              if (kanalAb(state.flags, 'ausruestung')) {
                if (this.corpse || state.carrying) return this.toast('Mit einer Leiche in den Kanal? Die Enten würden reden.');
                if (state.flags.curryTopf && state.flags.gullyOffen) return this.toast('Mit dem Riesentopf die Leiter runter? Keine Chance. Durch die Herrentoilette im Eimer, Kabine 1.');
                return void (state.flags.gullyOffen ? this.abstieg(x, y) : this.gullyOeffnen());
              }
              if (state.flags.kanal === 'entfuehrt') return this.toast('Der Deckel bewegt sich keinen Millimeter. Darunter: Quaken. Viel Quaken.');
              entdecke(state.flags, 'gully');
              if (state.flags.claudius === 'veroeffentlicht') return this.toast('Aus dem Gully: Gläserklirren und ein dreistimmiges „Prost!“. Die Kanalisation feiert die Pressefreiheit.');
              this.toast('Aus dem Gully: Quak. Quak. Quak. Enten? Hier unten?');
              for (let i = 0; i < 3; i++) this.time.delayedCall(i * 380, () => { floatText(this, x * T + 8 + (i - 1) * 16, y * T + 2 - i * 6, 'quak', '#e8e0a0'); audio.sfx('blip'); });
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
    // nach der Veröffentlichung: Claudius trinkt im Eimer, Kevin sitzt im Muskelkater (ClubScene)
    if (state.flags.claudius === 'veroeffentlicht') return;
    const [kx, ky] = this.at(KEVIN_TILE);
    const kevin = this.add.sprite(kx * T + 8, ky * T + 14, 'kevin', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(ky * T + 14).setFlipX(true);
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
        floatText(this, cap.x, cap.y - 26, Phaser.Utils.Array.GetRandom(['BÜRGER!', 'KEINE FRAGEN!', 'PROST IST VERRAT!', 'NÜCHTERN BLEIBEN!']), '#9ac0ff');
        this.time.delayedCall(1200, () => cap.active && cap.setFrame(0));
      },
    });
    this.interacts.push({ x: cap.x, y: cap.y - 4, r: 18, label: () => (cap.active && !this.corpse && !state.carrying ? 'Mit Captain Claudius reden' : null), act: () => this.talk('claudius') });
  }

  /** Der kräftige Leonard lehnt an der Laterne, die dem Eingang am nächsten steht. */
  /** Muskelkater: Stripclub mit Ladies Night, jederzeit offen (nur nicht mit Leiche) */
  private addClub() {
    const [x, y] = this.at(CLUB_DOOR);
    this.interacts.push({
      x: x * T + 8, y: (y + 1) * T + 4, r: 16,
      label: () => (state.carrying ? null : this.corpse ? 'Erst die Leiche loswerden!' : 'Muskelkater betreten'),
      act: () => (this.corpse ? this.toast('Mit einer Leiche in den Stripclub? Der Türsteher hat schon genug gesehen.') : this.go('Club', { spawn: CLUB_SPAWN })),
    });
  }

  /** Shisha 1001: jederzeit offen (nur nicht mit Leiche) */
  private addShisha() {
    const [x, y] = this.at(SHISHA_DOOR);
    this.interacts.push({
      x: x * T + 8, y: (y + 1) * T + 4, r: 16,
      label: () => (state.carrying ? null : this.corpse ? 'Erst die Leiche loswerden!' : 'Shisha 1001 betreten'),
      act: () => (this.corpse ? this.toast('Mit einer Leiche in die Shisha-Bar? Cemo raucht viel, aber so viel nicht.') : this.go('Shisha', { spawn: SHISHA_SPAWN })),
    });
  }

  /** Kapitel 6/7: Nach Jans Entführung führt eine leuchtende Schleimspur vom Muskelkater zum Gully; Kevin wartet dort */
  private addSchleimspur() {
    const f = state.flags;
    if (!janWeg(f)) return;
    const gully = this.find('o');
    const [cx, cy] = this.at(CLUB_DOOR);
    const pfad = weg(this.solid, [cx, cy + 1], [gully[0], gully[1] + 1 <= this.rows.length - 1 && !this.solid[gully[1] + 1]?.[gully[0]] ? gully[1] + 1 : gully[1]]);
    (pfad ?? []).forEach(([x, y], i) => {
      if (i % 2) return;
      const s = this.add.image(x * T + 8 + Phaser.Math.Between(-4, 4), y * T + 9 + Phaser.Math.Between(-3, 3), 'hz_schleim')
        .setScale(0.5 * Phaser.Math.FloatBetween(0.7, 1.2)).setAngle(Phaser.Math.Between(-20, 20)).setDepth(0.8);
      if (i % 8 === 0) this.addLight(s.x, s.y, 0.35, 0.4).setTint(0x6aff4a);
    });
    // Kevin kniet neben dem Gully
    const [gx, gy] = gully;
    const kx = [gx - 1, gx + 1].find((x) => this.solid[gy]?.[x] === false) ?? gx - 1;
    const kevin = this.add.sprite(kx * T + 8, gy * T + 14, 'kevin', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(gy * T + 14).setFlipX(kx > gx);
    this.npcs.push(kevin, this.add.image(kevin.x, kevin.y - 1, 'shadow').setDepth(1));
    this.solid[gy][kx] = true;
    this.tweens.add({ targets: kevin, y: kevin.y + 1, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.interacts.push({ x: kevin.x, y: kevin.y - 4, r: 18, label: () => (kevin.active && !this.corpse && !state.carrying ? 'Mit Kevin reden' : null), act: () => this.talk('kevinGully') });
    this.addLight(gx * T + 8, gy * T + 8, 0.5, 0.55).setTint(0x6aff4a);
  }

  private gullyLoch?: Phaser.GameObjects.Image;
  private gullyDeckel?: Phaser.GameObjects.Image;

  /** Kapitel 7: Ab Tuncays Kanal-Paket liegt ein eigener Deckel auf dem Gully; offen ist er beiseitegeschoben */
  private gullyPos: [number, number] = [0, 0];
  private addGully(x: number, y: number) {
    this.gullyLoch = undefined;
    this.gullyDeckel = undefined;
    this.gullyPos = [x, y];
    if (!kanalAb(state.flags, 'ausruestung')) return;
    const cx = x * T + 8, cy = y * T + 8;
    const offen = !!state.flags.gullyOffen;
    this.gullyLoch = this.add.image(cx, cy, 'kanalGullyOffen').setScale(0.5).setDepth(0.7).setVisible(offen);
    this.gullyDeckel = this.add.image(offen ? cx + 13 : cx, offen ? cy + 3 : cy, 'kanalDeckel').setScale(0.5).setDepth(0.75).setAngle(offen ? 18 : 0);
    if (offen) this.addLight(cx, cy, 0.4, 0.5).setTint(0x6aff4a);
  }

  /** Tuncays Gullyhaken unter den Deckel, hebeln, Deckel schrammt beiseite */
  private async gullyOeffnen() {
    // Paket erst in dieser Szene gekauft: Deckel und Loch jetzt anlegen
    if (!this.gullyDeckel) this.addGully(...this.gullyPos);
    const d = this.gullyDeckel, loch = this.gullyLoch;
    if (!d || !loch || this.frozen) return;
    this.frozen = true;
    hud.prompt = '';
    await this.blase(this.player.x, this.player.y - 26, 'Haken drunter. Hebeln, nicht ziehen.');
    audio.sfx('clang');
    this.tweens.add({ targets: d, x: d.x + 1, duration: 50, yoyo: true, repeat: 5 });
    await this.wartet(420);
    audio.sfx('clang');
    this.cameras.main.shake(160, 0.004);
    await this.wartet(300);
    audio.sfx('rumble');
    loch.setVisible(true);
    await new Promise<void>((res) => this.tweens.add({ targets: d, x: d.x + 13, y: d.y + 3, angle: 18, duration: 750, ease: 'Quad.easeOut', onComplete: () => res() }));
    const glow = this.addLight(loch.x, loch.y, 0.4, 0.5).setTint(0x6aff4a);
    glow.setAlpha(0);
    this.tweens.add({ targets: glow, alpha: 0.5, duration: 500 });
    for (let i = 0; i < 3; i++) this.time.delayedCall(250 + i * 380, () => floatText(this, loch.x + (i - 1) * 8, loch.y - 6, 'quak', '#e8e0a0'));
    state.flags.gullyOffen = true;
    await this.wartet(900);
    this.toast('Der Deckel ist ab. Von unten: Rauschen, Tropfen und ein sehr zufriedenes Quaken.');
    this.frozen = false;
  }

  /** Nach der Ohnmacht im Kanal: der Wirt liegt grün im Gesicht neben dem Gully, Kevin weckt ihn */
  private async aufwachen() {
    kanalOhnmacht.aufwachen = false;
    const p = this.player;
    this.frozen = true;
    p.setAngle(-90).setTint(0xa8ff8a);
    await this.wartet(1500);
    audio.sfx('retch');
    this.tweens.add({ targets: p, angle: 0, duration: 380, ease: 'Back.easeOut' });
    await this.wartet(600);
    p.clearTint();
    this.frozen = false;
    if (janWeg(state.flags)) this.talk('kevinWach');
    else this.toast('Du wachst neben dem Gully auf. Jemand hat dich rausgezogen. Du riechst nach Ente. Von innen.');
  }

  /** Abstieg: der Wirt stellt sich über das Loch und verschwindet nach unten */
  private async abstieg(x: number, y: number) {
    if (this.frozen || this.leaving) return;
    this.frozen = true;
    hud.prompt = '';
    const p = this.player;
    await new Promise<void>((res) => this.tweens.add({ targets: p, x: x * T + 8, y: y * T + 12, duration: 260, onComplete: () => res() }));
    audio.sfx('step');
    this.tweens.add({ targets: p, y: p.y + 10, alpha: 0, duration: 700, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: this.shadow, alpha: 0, duration: 400 });
    await this.wartet(560);
    audio.sfx('splash');
    this.frozen = false;
    if (wirtFigur() !== 'wirtKanal') this.toast('Ohne Wathose da runter? Mutig. Oder dumm. Unten entscheidet sich das schnell.');
    this.go('Kanal', { spawn: KANAL_SPAWN });
  }

  /** Masala Basar: offen, sobald die Baustellen weg sind (nur nicht mit Leiche) */
  private addBasar() {
    const [x, y] = this.at(BASAR_DOOR);
    this.interacts.push({
      x: x * T + 8, y: (y + 1) * T + 4, r: 16,
      label: () => (state.carrying ? null : !state.flags.glanzErledigt ? 'Masala Basar' : this.corpse ? 'Erst die Leiche loswerden!' : 'Masala Basar betreten'),
      act: () => {
        if (!state.flags.glanzErledigt) return this.toast('Geschlossen. Durch die Scheibe riecht es nach Kardamom, Räucherstäbchen und Hoffnung.');
        if (this.corpse) return this.toast('Mit einer Leiche in den Masala Basar? Adshayan hat heute schon genug aufzuwischen.');
        this.go('Basar', { spawn: BASAR_SPAWN });
      },
    });
  }

  /** Xavi-Strang: Tuncay handelt auf dem Parkplatz; nach der Rettung knutschen Leni und Xavi im Park */
  private addXavi() {
    const f = state.flags;
    if (f.glanzErledigt) {
      const [tx, ty] = this.at(TUNCAY_TILE);
      const x = tx * T + 8, y = ty * T + 14;
      this.add.image(x - 26, y + 1, 'tuncayKram').setOrigin(0.5, 1).setScale(0.5).setDepth(y - 3);
      const t = this.add.sprite(x, y, 'tuncay', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
      this.npcs.push(t, this.add.image(x, y - 1, 'shadow').setDepth(1));
      this.solid[ty][tx] = true;
      this.time.addEvent({ delay: 3800, loop: true, callback: () => { if (!t.active) return; t.setFrame(13); this.time.delayedCall(700, () => t.active && t.setFrame(0)); } });
      this.interacts.push({ x, y: y - 4, r: 18, label: () => (!this.corpse && !state.carrying ? 'Mit Tuncay reden' : null), act: () => this.talk('tuncay', (a) => this.tuncayDone(a)) });
    }
    if (f.xavi === 'gerettet') {
      const [px, py] = this.at(PARK_TILE);
      const x = px * T + 8, y = py * T + 14;
      const leni = this.add.sprite(x - 5, y, 'leni', 6).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
      const xavi = this.add.sprite(x + 5, y, 'xavi', 6).setOrigin(0.5, 1).setScale(0.5).setFlipX(true).setDepth(y);
      this.npcs.push(leni, xavi, this.add.image(x, y - 1, 'shadow').setDepth(1).setScale(1.6, 1));
      this.solid[py][px] = true;
      this.tweens.add({ targets: [leni, xavi], scaleY: 0.48, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.time.addEvent({
        delay: 1400, loop: true,
        callback: () => {
          const h = this.add.image(x + Phaser.Math.Between(-4, 4), y - 22, 'clubHeart').setScale(0.5).setDepth(5004);
          this.tweens.add({ targets: h, y: h.y - 14, alpha: 0, duration: 1100, onComplete: () => h.destroy() });
        },
      });
      this.interacts.push({
        x, y: y - 4, r: 20, label: () => 'Leni und Xavi',
        act: () => this.toast(Phaser.Utils.Array.GetRandom([
          'Sie knutschen. Seit Stunden. Xavi wird dabei rot und hört trotzdem nicht auf.',
          'Xavi löst sich kurz: „Danke, Horst. Entschuldigung. Danke.“ Dann knutschen sie weiter.',
          'Leni hebt den Daumen, ohne hinzusehen. Profi.',
        ])),
      });
    }
  }

  private tuncayDone(a?: DialogAction) {
    if (a === 'rolexVerkauf') {
      if (!state.inv.rolex) return;
      state.inv.rolex = 0;
      state.flags.rolexVerkauft = true;
      state.money += 150;
      audio.sfx('kaching');
      return this.toast('Rolex weg, 150 € da. Tuncay trägt sie schon. Falschrum.');
    }
    if (a === 'kanalPaket') {
      if (state.money < 80) return this.toast('Tuncay: „Achtzig, Bruder. Nicht siebzig. Nicht ‚morgen‘. Achtzig.“');
      state.money -= 80;
      state.inv.kanalpaket = 1;
      state.flags.kanal = 'ausruestung';
      audio.sfx('kaching');
      this.toast('Kanal-Paket: Wathose, Stirnlampe, Gullyhaken. Ab zum Gully in der Hintergasse.');
      hud.goal = this.goalText();
      return;
    }
    if (a !== 'tuncayQuiz') return;
    hud.prompt = '';
    this.scene.launch('Quiz', { resume: this.scene.key, onDone: (win: boolean) => this.quizDone(win) });
    this.scene.bringToTop('Quiz');
    this.scene.pause();
  }

  private quizDone(win: boolean) {
    if (!win) return this.toast('Tuncay: „Komm wieder, wenn du weißt, wo Ankara liegt.“');
    state.flags.xavi = 'club';
    this.scene.launch('Cutscene', { script: 'xaviTuncay', resume: this.scene.key });
    this.scene.bringToTop('Cutscene');
    this.scene.pause();
  }

  /** Der Hanfbusch auf dem Grasstreifen hinter der Gasse. Im Nick-Strang gräbt der Wirt Bornas Pflanze aus (ein paar Mal wühlen). */
  private addBusch() {
    const [tx, ty] = this.at(BUSCH_TILE);
    const x = tx * T + 8, y = ty * T + 14;
    const f = state.flags;
    if (!this.textures.exists('hanfbusch')) tex2x(this, 'hanfbusch', 30, 30, drawHanfbusch);
    const bush = this.add.image(x, y, 'hanfbusch').setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    this.tweens.add({ targets: bush, scaleX: 0.51, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (this.solid[ty]) this.solid[ty][tx] = true;
    const loch = () => this.add.image(x - 9, y - 1, 'erdloch').setScale(0.5).setDepth(1.5);
    if ((f.nick && f.nick !== 'pflanze') || state.inv.pflanze > 0) loch();
    let stiche = 0;
    this.interacts.push({
      x, y: y - 3, r: 20,
      label: () => (f.nick === 'pflanze' && state.inv.pflanze === 0 && !state.carrying ? 'Im Busch graben' : null),
      act: () => {
        if (f.nick !== 'pflanze' || state.inv.pflanze > 0) return;
        stiche++;
        audio.sfx('rummage');
        this.tweens.add({ targets: bush, angle: { from: -6, to: 6 }, duration: 70, yoyo: true, repeat: 2, onComplete: () => bush.setAngle(0) });
        for (let i = 0; i < 7; i++) {
          const k = this.add.image(x + Phaser.Math.Between(-4, 4), y - 3, 'krume').setScale(0.5).setDepth(y + 1);
          const dx = Phaser.Math.Between(-22, 22);
          this.tweens.add({ targets: k, x: k.x + dx, duration: 520, ease: 'Linear' });
          this.tweens.add({ targets: k, y: k.y - Phaser.Math.Between(8, 18), duration: 260, ease: 'Quad.easeOut', yoyo: true, onComplete: () => this.tweens.add({ targets: k, alpha: 0, duration: 400, delay: 300, onComplete: () => k.destroy() }) });
        }
        if (stiche < 4) {
          this.float(['*buddel*', '*wühl* ... Wurzeln.', 'Da ist was ... Weiches?'][stiche - 1], '#c8a070');
          return;
        }
        state.inv.pflanze = 1;
        loch();
        const pl = this.add.image(x, y - 6, 'icon_pflanze').setScale(0.6).setDepth(6000);
        this.tweens.add({ targets: pl, y: pl.y - 22, duration: 380, ease: 'Quad.easeOut', yoyo: true, hold: 260, onComplete: () => this.tweens.add({ targets: pl, x: this.player.x, y: this.player.y - 16, scale: 0.2, alpha: 0, duration: 300, onComplete: () => pl.destroy() }) });
        audio.sfx('chime');
        this.float('Bornas Pflanze!', '#8ae070');
        this.toast('Eine kleine Pflanze. Sie riecht nach Borna. Ab damit auf den Dachboden.');
        this.sichern();
      },
    });
  }

  private addLeonard(doorX: number, doorY: number) {
    let best: [number, number] | null = null;
    const dist = ([x, y]: [number, number]) => Math.abs(x - doorX) + Math.abs(y - doorY) * 2;
    for (let y = 0; y < this.rows.length; y++)
      for (let x = 0; x < this.rows[y].length; x++)
        if (this.rows[y][x] === 'l' && (!best || dist([x, y]) < dist(best))) best = [x, y];
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
      fadeTo(this, 'Cutscene', { script: 'lilyDach', next: { scene: 'Bar', data: { spawn: BAR_LADDER_SPAWN } } });
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

  /** Leiche eines Tresengasts aus der Kneipe: läuft über dieselbe Müll-Entsorgung wie die der Frauen */
  protected leicheAufnehmen(typ: number) {
    makeGastTextures(this);
    this.corpse = this.add.sprite(this.player.x, this.player.y - 22, `gast${typ}`, 0).setAngle(90).setScale(0.5).setTint(0xa8c8a0);
    this.corpseCarried = true;
    this.corpseKey = '';
    this.slow = true;
  }

  private dispose(x: number, y: number) {
    const corpse = this.corpse;
    if (!corpse || !this.corpseCarried) return;
    this.corpseCarried = false;
    this.slow = false;
    this.corpse = undefined;
    state.bodyDeadline = null;
    if (this.corpseKey) dameReady.set(this.corpseKey, state.time + 60); // irgendwann steht eine Neue da
    else if (state.flags.gastLeicheTyp !== undefined) {
      // ein Tresengast: danach kann der nächste kommen
      state.flags.gastLeicheTyp = undefined;
      state.flags.naechsterGast = state.time + 45;
    }
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
    return this.felixSees(x, y) || !!this.passanten?.polizeiSieht(x, y);
  }

  private felixSees(x: number, y: number) {
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
    if (this.passanten?.positionen().some(near)) return true;
    return this.dames.some((d) => d.active && d.visible && near(d));
  }

  /** Kann Felix an dieser Stelle (Füße) stehen? Nur begehbare Kacheln. */
  private copCanStand(x: number, y: number) {
    return !this.solidAt(x - 3, y - 3) && !this.solidAt(x + 3, y - 3);
  }

  private dealDangerous() {
    return this.copSees(this.player.x, this.player.y) || this.copSees(...this.dealerPos);
  }

  private bust(why: string, wer = 'Felix', figur?: Phaser.GameObjects.Sprite, halt = '„HALT! POLIZEI!“') {
    if (this.busted) return;
    const c = figur ?? this.cop;
    this.busted = true;
    this.leaving = true; // einfrieren
    state.caughtBy = 'bulle';
    state.running = false;
    this.time.delayedCall(1800, () => {
      state.gameOver = 'polizei';
      fadeTo(this, 'End');
    });
    this.toast(`${wer}: ${halt} ${why}`);
    audio.sfx('siren');
    this.cameras.main.flash(300, 80, 120, 255);
    c.anims.stop();
    const bang = this.add.text(c.x, c.y - 30, '!', { fontFamily: '"Press Start 2P", monospace', fontSize: '16px', color: '#ff3030' }).setOrigin(0.5).setDepth(6000).setStroke('#000', 4);
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
    if (this.felixPfad || this.felixSucht > 0) {
      walking = this.felixEinsatzSchritt(dt);
    } else if (this.copWait > 0) {
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
    if (this.corpse && this.felixSees(this.corpse.x, this.corpseCarried ? this.player.y : this.corpse.y + 4)) this.bust('Ist das ... eine Leiche?!');
    if (state.carrying && this.felixSees(this.player.x, this.player.y)) this.bust('Was tragen Sie da auf der Schulter?!');
  }

  /** Felix eilt zum gemeldeten Ort (Wegsuche), leuchtet dort herum und kehrt auf seine Streife zurück. */
  private felixEinsatz(x: number, y: number) {
    const c = this.cop;
    const von: Kachel = [Math.floor(c.x / T), Math.floor((c.y - 3) / T)];
    const tx = Math.floor(x / T), ty = Math.floor((y - 3) / T);
    for (const [dx, dy] of [[0, 0], [0, 1], [1, 0], [-1, 0], [0, -1]]) {
      const pfad = weg(this.solid, von, [tx + dx, ty + dy]);
      if (!pfad) continue;
      this.felixPfad = pfad.map(([px, py]) => ({ x: px * T + 8, y: py * T + 14 }));
      this.felixI = 0;
      this.felixSucht = 0;
      this.felixZurueck = false;
      this.copWait = 0;
      floatText(this, c.x, c.y - 26, '!', '#ff3030');
      return true;
    }
    return false;
  }

  private felixEinsatzSchritt(dt: number) {
    const c = this.cop, tempo = 44;
    if (this.felixPfad) {
      const z = this.felixPfad[this.felixI];
      if (!z) {
        this.felixPfad = null;
        if (this.felixZurueck) {
          this.felixZurueck = false;
          this.copLane = this.copHome;
          c.y = this.copHome;
        } else this.felixSucht = 4;
        return false;
      }
      const dx = z.x - c.x, dy = z.y - c.y, d = Math.hypot(dx, dy), s = Math.min(d, tempo * dt);
      c.x += (dx / (d || 1)) * s;
      c.y += (dy / (d || 1)) * s;
      if (Math.abs(dx) > 0.5) this.copDir = dx > 0 ? 1 : -1;
      if (d <= tempo * dt + 0.01) this.felixI++;
      return true;
    }
    // am Ort: nach links und rechts leuchten, dann zurück zur Streife
    const vorher = this.felixSucht;
    this.felixSucht -= dt;
    if (Math.floor(vorher / 0.9) !== Math.floor(this.felixSucht / 0.9)) this.copDir *= -1;
    if (this.felixSucht <= 0) {
      this.felixSucht = 0;
      const row = Math.floor((this.copHome - 3) / T);
      const tx = Math.floor(Phaser.Math.Clamp(c.x, this.copFrom, this.copTo) / T);
      const pfad = weg(this.solid, [Math.floor(c.x / T), Math.floor((c.y - 3) / T)], [tx, row]);
      if (pfad) {
        this.felixPfad = pfad.map(([px, py]) => ({ x: px * T + 8, y: py * T + 14 }));
        this.felixI = 0;
        this.felixZurueck = true;
      } else {
        c.setPosition(this.copFrom, this.copHome);
        this.copLane = this.copHome;
      }
    }
    return false;
  }

  /** Ein Zeuge ruft an: die nächste Streife (Felix, Petra oder Kai) geht hin */
  private polizeiRufen(x: number, y: number, wer: string) {
    if (this.busted) return;
    const kandidaten: { name: string; d: number; los: () => boolean }[] = [];
    if (this.cop && !this.copGone) kandidaten.push({ name: 'Felix', d: Math.hypot(this.cop.x - x, this.cop.y - y), los: () => this.felixEinsatz(x, y) });
    for (const s of this.passanten?.streifen() ?? []) kandidaten.push({ name: s.name, d: Math.hypot(s.x - x, s.y - y), los: () => this.passanten!.einsatz(s.figur, x, y) });
    kandidaten.sort((a, b) => a.d - b.d);
    const k = kandidaten.find((c) => c.los());
    if (k) this.toast(`${wer} ruft die Polizei! ${k.name} ist unterwegs.`);
  }

  /** Was die Passanten von der Gasse brauchen */
  private welt(): Welt {
    return {
      scene: this,
      solid: this.solid,
      rows: this.rows,
      player: this.player,
      interacts: this.interacts,
      toast: (s) => this.toast(s),
      strahl: (x, y, a, len) => this.castRay(x, y, a, len),
      leiche: () => {
        if (this.corpse) return this.corpseCarried ? { x: this.player.x, y: this.player.y } : { x: this.corpse.x, y: this.corpse.y + 4 };
        return state.carrying ? { x: this.player.x, y: this.player.y } : null;
      },
      melden: (x, y, wer) => this.polizeiRufen(x, y, wer),
      bust: (why, wer, figur) => this.bust(why, wer, figur, wer === 'Kai' ? '„H-halt! Polizei! Wirklich jetzt!“' : '„Stehen bleiben! Polizei!“'),
      aktiv: () => !this.busted && !this.leaving && state.running,
      hindernisse: () => [...this.dames.filter((d) => d.active && d.visible), ...(this.cop && !this.copGone ? [this.cop] : [])],
      streifenGebiet: (x, y) => {
        const [ox, oy] = this.origin();
        const gx = x - ox, gy = y - oy;
        return !(gx >= ALTSTADT.x0 && gx <= ALTSTADT.x1 && gy >= ALTSTADT.y0);
      },
      polizeiOrte: () => [
        ...(this.cop && !this.copGone ? [{ name: 'Felix', x: this.cop.x, y: this.cop.y }] : []),
        ...(this.passanten?.streifen() ?? []),
      ],
      tonnePluendern: (x, y) => { trashSearched.set(`${x},${y}`, state.time); },
    };
  }

  /** Gasse hinter dem Haus oder Straße davor (mit etwas Spielraum an der Grenze); hat jemand anderes die Musik
   *  übernommen (Monster, Quiz, Zwischensequenz), bleibt sie. */
  private gegend: 'gasse' | 'strasse' | null = null;
  private musikGegend() {
    if (this.gegend !== null && audio.aktuell !== this.gegend) return;
    const reihe = this.player.y / T - this.origin()[1];
    const g = reihe < 9 ? 'gasse' : reihe > 11 ? 'strasse' : (this.gegend ?? 'strasse');
    if (g !== this.gegend) {
      this.gegend = g;
      audio.music(g);
    }
  }

  update(t: number, d: number) {
    super.update(t, d);
    this.musikGegend();
    this.updateCop(d / 1000);
    this.passanten?.update(d / 1000);
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
    this.passanten?.allesFlieht(this.cat.x, this.cat.y);
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
