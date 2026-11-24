import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { Interact, T, TileInfo, TopDown } from '../scenes/TopDown';
import { hud } from '../scenes/HudScene';
import { unlock } from '../progress/achievements';
import { strangZiel } from '../progress/quests';
import { getMap } from '../maps';
import { KANAL_TILES, MAP_DEFS, kanalFloor, tileKey } from '../maps/palettes';
import { weg } from '../world/wege';
import { ALLEY_GULLY_SPAWN, HERREN_KABINE_SPAWN } from './spawns';
import { kanalAb, kanalOhnmacht, rohrAnkunft, wirtFigur } from '../dialog/kanal';
import { WandlungUI } from './WandlungUI';

// „Unter dem Eimer“, Kapitel 7: die Kanalisation unter der Hintergasse. Karte maps/kanal.json (im Map-Editor
// bearbeitbar, Kacheln in world/kanalTiles.ts). Stockdunkel, nur die Stirnlampe leuchtet einen Kegel vor dem Wirt aus.
// Ein Labyrinth aus drei Hallen mit Rinnen, Brücken, Gängen und Sackgassen. Saugnapf-Enten paddeln in den Rinnen und
// watscheln dem Wirt hinterher. Jans Schleimspur beginnt an der Leiter, verliert sich im Wasser und endet am Rostgitter.
// Ohne Wathose (Inventar: ausziehen) riecht der Wirt nach Mensch: die Enten greifen an, stoßen ihn weg und vergiften
// ihn. Drei Bisse kurz hintereinander, und er wird ohnmächtig; er wacht oben am Gully bei Kevin auf.

interface Ente {
  s: Phaser.GameObjects.Sprite;
  schatten?: Phaser.GameObjects.Image;
  /** watschelt dem Wirt nach (sonst paddelt sie in der Rinne) */
  laeuft: boolean;
  quakT: number;
  /** Abklingzeit nach einem Biss (ms) */
  cd?: number;
  ia?: number;
  /** Zeit bis zur nächsten kleinen Handlung (Picken, Schütteln, Umdrehen, Gründeln) */
  aktionT: number;
  /** Schwimm-Ente: ihre Bahn (wird zum Gründeln angehalten) und die Zeit bis zur nächsten Bugwelle */
  bahn?: Phaser.Tweens.Tween;
  welleT?: number;
  gruendelt?: boolean;
}

interface Ratte {
  s: Phaser.GameObjects.Sprite;
  nest: { x: number; y: number };
  rudel: number;
  /** am Nest, jagt den Wirt, geht heim, flieht (vor der Katze oder nach einem Schreck), gefressen */
  modus: 'nest' | 'jagd' | 'heim' | 'flucht' | 'weg';
  /** jagd: verbleibende Jagdzeit (ms); weg: Rückkehr ab (Spielzeit) */
  t: number;
  /** frühestens wieder jagen ab (Spielzeit) */
  ruheBis: number;
  zick: number;
  /** Schnüffelziel am Nest */
  bummel?: { x: number; y: number };
  bummelT: number;
}

const RICHTUNGEN: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** ein Tentakelarm in der Felix-Szene */
interface KinoArm {
  bx: number;
  by: number;
  dicke: number;
  phase: number;
  geweih: boolean;
  /** wie weit er aus dem Wasser geschossen ist (0..1) */
  anteil: number;
  /** Zucken nach einem Treffer (ms) */
  zuck: number;
  ziel: () => { x: number; y: number };
  /** zuletzt gezeichnete Punkte (für Schleimtropfen) */
  pts?: { x: number; y: number }[];
  wickel?: { ziel: () => { x: number; y: number }; breite: number; hoehe: number; schlingen: number };
}

/** so viele Bisse, dann Ohnmacht */
const GIFT_MAX = 3;

export class KanalScene extends TopDown {
  private lampe?: Phaser.GameObjects.Image;
  private lampeNah?: Phaser.GameObjects.Image;
  private enten: Ente[] = [];
  private angesaugt = false;
  /** Vergiftung durch Entenbisse (0..GIFT_MAX); baut sich langsam ab */
  private gift = 0;
  private giftT = 0;
  /** Rückstoß nach einem Biss (Weltpixel pro Sekunde) */
  private stoss = { vx: 0, vy: 0 };
  private ohnmacht = false;
  private schleier?: Phaser.GameObjects.Rectangle;
  private gewarnt = false;
  /** hier wacht der Wirt nach Ohnmacht (Ratten) oder Spülwelle wieder auf */
  private checkpoint = { x: 0, y: 0 };
  private rastpunkte: { x: number; y: number; zx: number; zy: number; rx?: number }[] = [];
  private rastHinweis = false;
  private schreck = 0;
  private schreckT = 0;
  private unverwundbarBis = 0;
  private ratten: Ratte[] = [];
  private rattenHinweis = false;
  private inKammer = false;
  private katzeSzene = false;
  private katzeHinweis = false;
  /** erste Kachel des Rostgitters (für den Auftritt der Katze dahinter) */
  private gitterPos?: [number, number];

  constructor() {
    super('Kanal');
  }

  protected mapData() { return getMap('kanal'); }
  protected mapRows() { return this.mapData()!.rows; }
  protected isWall(ch: string) { return !!KANAL_TILES[ch]?.wall; }
  protected darkness() { return this.kino ? 0.74 : MAP_DEFS.kanal.dunkel; }
  protected floorKey(x: number, y: number) { return kanalFloor(this.rows, x, y); }

  protected tileFor(ch: string, x: number, y: number): TileInfo {
    const d = KANAL_TILES[ch];
    return d ? { key: tileKey(d, x, y), solid: d.solid, object: d.object } : { key: '', solid: false };
  }

  protected goalText() {
    return strangZiel(state.flags) ?? 'Die Kanalisation. Es tropft, es rauscht, es quakt.';
  }

  private alle(ch: string): [number, number][] {
    const out: [number, number][] = [];
    this.rows.forEach((row, y) => [...row].forEach((c, x) => c === ch && out.push([x, y])));
    return out;
  }

  protected setupWorld() {
    this.enten = [];
    this.angesaugt = false;
    this.gift = 0;
    this.giftT = 0;
    this.stoss = { vx: 0, vy: 0 };
    this.ohnmacht = false;
    this.gewarnt = false;
    this.schreck = 0;
    this.schreckT = 0;
    this.unverwundbarBis = 0;
    this.rastHinweis = false;
    this.rattenHinweis = false;
    this.inKammer = false;
    this.katze = undefined;
    this.katzeSzene = false;
    this.katzeHinweis = false;
    this.kino = false;
    this.kinoAus = false;
    this.kinoTentakel = [];
    this.kinoPartikel = [];
    this.kinoExtras = [];
    this.feldSpieler = undefined;
    // grüner Giftschleier über dem Bild, je stärker die Vergiftung
    this.schleier = this.add.rectangle(0, 0, 10, 10, 0x4aff2a, 0).setOrigin(0).setDepth(5002).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { hud.alert = ''; });
    audio.music('kanal');
    const f = state.flags;

    // Leiter hoch zum Gully
    for (const [x, y] of this.alle('L'))
      this.interacts.push({ x: x * T + 8, y: (y + 1) * T + 4, r: 16, label: () => 'Hoch in die Gasse', act: () => this.go('Alley', { spawn: ALLEY_GULLY_SPAWN }) });

    const spot = (ch: string, label: string, texte: string | string[], dy = 1) => {
      const liste = Array.isArray(texte) ? texte : [texte];
      this.alle(ch).forEach(([x, y], i) => this.interacts.push({ x: x * T + 8, y: (y + dy) * T + 4, r: 14, label: () => label, act: () => this.toast(liste[i % liste.length]) }));
    };
    spot('G', 'Lichtschacht', 'Durch das Gitter: ein Stück Nachthimmel und eine Schuhsohle. Oben läuft jemand vorbei und hat keine Ahnung.');
    const kreide = (texte: string[], wo: (x: number, y: number) => boolean) => this.alle('K').filter(([x, y]) => wo(x, y)).forEach(([x, y], i) =>
      this.interacts.push({ x: x * T + 8, y: (y + 1) * T + 4, r: 14, label: () => 'Kreide an der Wand', act: () => this.toast(texte[i % texte.length]) }));
    // Hinweise alter Kanalarbeiter in der Schieberkammer
    kreide([
      'Kreide, krakelig: „ROT MACHT NORD TROCKEN. MITTE SÄUFT AB.“',
      'Kreide, ordentlich unterstrichen: „Gelb nie vor Rot. Gruß, Heinz.“',
      'Kreide, mit einem gemalten Fass: „Fass schwimmt nur, wenn Süd voll ist.“',
    ], (x, y) => x >= 69 && y >= 28);
    kreide(['Kreide: „RATTEN HASSEN LICHT.“ Darunter, frischer: „LÜGE.“ Darunter: Kratzspuren.'], (x, y) => x >= 41 && !(x >= 69 && y >= 28));
    kreide([
      'Kreide, alt und verwischt: „KOLONNE 3 – AB HIER NUR MIT WATHOSE“. Darunter eine Ente mit zu vielen Beinen.',
      'Kreide: „WER SICH VERLÄUFT: IMMER DEM RAUSCHEN NACH“. Jemand hat darunter geschrieben: „ES RAUSCHT ÜBERALL, DU DEPP“.',
      'Kreide: ein Pfeil nach Osten und „GITTER KLEMMT. NICHT MEIN PROBLEM. – K3“. Daneben ein Strichmännchen, das winkt.',
    ], (x) => x < 41);
    spot('S', 'Schieber', 'Ein alter Schieber mit Kurbel, festgerostet. Hier kannst du kurz durchatmen. Die Schieber, die sich noch drehen, sind weiter hinten.', 0);
    spot('f', 'Fass', 'Ein Fass ohne Etikett. Nur ein Stempel: ein Geweih über einem Berg. Von innen blubbert es. Lieber nicht aufmachen.', 0);
    spot('m', 'Müll', [
      'Ein Einkaufswagen, drei Regenschirme und ein Toaster. Die Kanalisation ist das Gedächtnis der Stadt.',
      'Ein Haufen Flyer: „Glanzbau – wir bauen Ihre Zukunft“. Aufgeweicht. Passt.',
      'Ein Gartenzwerg ohne Kopf. Er hat es hierher geschafft. Respekt.',
      'Ein Damenschuh, Größe 46, glitzernd. Aus dem Muskelkater? Die Ente daneben trägt den anderen.',
    ], 0);
    this.gitter();
    this.funde();
    this.schieberkammer();
    this.rinneVorbereiten();
    this.rattenNester();
    this.rastpunkteAnlegen();
    this.vorraumEinrichten();
    // die Katze: läuft mit (Kapitel „katze“) oder wartet vor der Klärwerk-Tür (ab dem Curry-Plan)
    if (f.kanal === 'katze') {
      const { x, y } = this.hinterDemWirt();
      this.katzeEinrichten(x, y, 'folgt');
    } else if (kanalAb(f, 'curry') && f.kanal !== 'gerettet' && this.vorraum) {
      const [dx, dy] = this.vorraum.tuer;
      this.katzeEinrichten((dx - 1) * T + 8, (dy + 1) * T + 14, 'wartet');
    }

    this.schleimspur();
    this.addEnten();
    this.tropfen();

    // Stirnlampe: heller Kegel vor dem Wirt, kleiner Schein um ihn herum
    // dunkle Tönung: der Schein (ADD) bleibt schwach, der Lichtkegel in der Lichtkarte ist trotzdem voll da
    this.lampe = this.addLight(this.player.x, this.player.y, 1.15, 0.9).setTint(0x4a3e2a);
    this.lampeNah = this.addLight(this.player.x, this.player.y, 0.55, 0.55).setTint(0x2a2418);
    this.tweens.killTweensOf([this.lampe, this.lampeNah]);
    this.lampeSetzen(1);

    // mit dem Curry-Topf durchs Klo-Rohr angekommen
    if (f.curryTopf && f.kanal === 'curry') this.time.delayedCall(500, () => this.toast('Der Topf hat es durchs Klo geschafft. Du auch. Irgendwie. Bis zur Tür sind es nur ein paar Schritte. Hoffentlich spült oben keiner.'));
    // erster Abstieg
    if (f.kanal === 'ausruestung') {
      f.kanal = 'unten';
      unlock('kanalratte');
      hud.goal = this.goalText();
      this.time.delayedCall(450, () => {
        this.toast('Stirnlampe an. Es tropft. Es rauscht. Irgendwo vorne quakt es.');
        void this.blase(Math.max(this.player.x, 80), this.player.y - 26, 'Wathose dicht. Hoffentlich.');
      });
    }
  }

  /** Jans Schleimspur: unten an der Leiter, dann verliert sie sich im Wasser; erst kurz vor dem Rostgitter taucht sie wieder auf */
  private schleimspur() {
    const [lx, ly] = this.alle('L')[0] ?? [1, 1];
    const ziel = this.alle('Z').slice(-1)[0];
    if (!ziel) return;
    const pfad = weg(this.solid, [lx, ly + 1], [ziel[0] - 1, ziel[1]]) ?? [];
    pfad.forEach(([x, y], i) => {
      if (i % 2 || (i > 10 && i < pfad.length - 9)) return;
      const s = this.add.image(x * T + 8 + Phaser.Math.Between(-4, 4), y * T + 9 + Phaser.Math.Between(-3, 3), 'hz_schleim')
        .setScale(0.5 * Phaser.Math.FloatBetween(0.7, 1.25)).setAngle(Phaser.Math.Between(-25, 25)).setDepth(0.8);
      if (i % 6 === 0) this.addLight(s.x, s.y, 0.3, 0.45).setTint(0x6aff4a);
    });
    // unter dem Gitter verschwindet die Spur
    const [zx, zy] = ziel;
    this.add.image(zx * T + 4, zy * T + 10, 'hz_schleim').setScale(0.8).setDepth(0.8);
    this.addLight(zx * T + 4, zy * T + 6, 0.5, 0.5).setTint(0x6aff4a);
  }

  /** Mit Wathose riecht der Wirt nach Kanal und ist für die Enten einer von ihnen */
  private geschuetzt() {
    return wirtFigur() === 'wirtKanal';
  }

  /** zwei Enten paddeln in der Rinne, fünf warten auf den Stegen und laufen dem Wirt nach */
  private addEnten() {
    const wasser = this.alle('~').filter(([x]) => x < 40);
    const steg = this.alle('.').filter(([x, y]) => x > 4 && x < 40 && !this.solid[y]?.[x] && this.rows[y - 1]?.[x] !== undefined);
    const rnd = new Phaser.Math.RandomDataGenerator(['enten']);
    for (let i = 0; i < 2 && wasser.length; i++) {
      const [x, y] = rnd.pick(wasser);
      // Wasserlinie des Bildes (Zeile 12 von 16) liegt auf der Wasseroberfläche
      const s = this.add.sprite(x * T + 8, y * T + 11, 'kanalEnte', 8).setOrigin(0.5, 0.75).setScale(0.5).setDepth(y * T + 11);
      s.play({ key: 'kanalEnte_schwimm', startFrame: i });
      // dümpeln: leicht auf und ab
      this.tweens.add({ targets: s, y: s.y + 0.8, duration: 900 + i * 230, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      // paddelt nur im freien Wasser dieser Reihe, nicht unter den Brücken durch
      let a = x, b = x;
      while (this.rows[y][a - 1] === '~') a--;
      while (this.rows[y][b + 1] === '~') b++;
      const links = a * T + 8, rechts = b * T + 8;
      s.x = i ? rechts : links;
      const bahn = this.tweens.add({
        targets: s, x: i ? links : rechts, duration: Math.max(3500, (rechts - links) * 40), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        onYoyo: () => s.toggleFlipX(), onRepeat: () => s.toggleFlipX(),
      });
      if (i) s.setFlipX(true);
      this.enten.push({ s, laeuft: false, quakT: 2000 + i * 1700, aktionT: 3000 + i * 2500, bahn, welleT: 0 });
    }
    for (let i = 0; i < 5 && steg.length; i++) {
      const [x, y] = rnd.pick(steg);
      const s = this.add.sprite(x * T + 8, y * T + 15, 'kanalEnte', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y * T + 15);
      s.setFrame(4).setFlipX(i % 2 === 0);
      const e: Ente = { s, laeuft: true, quakT: 1200 + i * 900, cd: 0, aktionT: 800 + i * 700 };
      this.enten.push(e);
      this.interacts.push({
        x: s.x, y: s.y, r: 14, label: () => (this.geschuetzt() ? 'Ente' : null),
        act: () => this.toast(Phaser.Utils.Array.GetRandom([
          'Die Ente hat sechs Augen. Drei gucken dich an. Die anderen gucken in dich hinein.',
          'Quak. Die Ente saugt sich mit einem Tentakel an deiner Wathose fest und schnurrt. Enten sollten nicht schnurren.',
          'Unter den Federn: kahle Haut, Beulen, Rippen. Sie sabbert grün. Sie wirkt sehr zufrieden mit sich.',
          'Die Ente beschnuppert deine Wathose und entscheidet: einer von uns. Zum Glück.',
        ])),
      });
      e.ia = this.interacts.length - 1;
    }
  }

  /** Es tropft von der Decke: Tropfen fallen vor den Wänden, auf dem Wasser gibt es Ringe */
  private tropfen() {
    const vorne: [number, number][] = [];
    this.rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (KANAL_TILES[ch]?.wall && this.rows[y + 1]?.[x] !== undefined && !KANAL_TILES[this.rows[y + 1][x]]?.wall) vorne.push([x, y]);
    }));
    if (!vorne.length) return;
    this.time.addEvent({
      delay: 420, loop: true,
      callback: () => {
        const cam = this.cameras.main.worldView;
        const sicht = vorne.filter(([x, y]) => x * T > cam.x - T && x * T < cam.right && y * T > cam.y - 2 * T && y * T < cam.bottom);
        if (!sicht.length) return;
        const [x, y] = Phaser.Utils.Array.GetRandom(sicht);
        const px = x * T + Phaser.Math.Between(3, 13), py = (y + 1) * T - 2;
        const fall = Phaser.Math.Between(8, 16);
        const d = this.add.rectangle(px, py, 1, 2, 0x9ad0e8).setDepth(py + fall + 1);
        this.tweens.add({
          targets: d, y: py + fall, duration: 280, ease: 'Quad.easeIn',
          onComplete: () => {
            d.destroy();
            const ring = this.add.ellipse(px, py + fall, 3, 1.5).setStrokeStyle(0.6, 0x9ad0e8, 0.8).setDepth(1);
            this.tweens.add({ targets: ring, scaleX: 3, scaleY: 3, alpha: 0, duration: 420, onComplete: () => ring.destroy() });
          },
        });
      },
    });
  }

  /** Lichtkegel in Blickrichtung des Wirts (k = wie schnell er nachzieht) */
  private lampeSetzen(k: number) {
    const p = this.player;
    if (!this.lampe || !this.lampeNah) return;
    const [dx, dy] = this.facing === 'up' ? [0, -1] : this.facing === 'down' ? [0, 1] : [p.flipX ? -1 : 1, 0];
    const zx = p.x + dx * 30, zy = p.y - 10 + dy * 26;
    this.lampe.x += (zx - this.lampe.x) * k;
    this.lampe.y += (zy - this.lampe.y) * k;
    this.lampeNah.setPosition(p.x, p.y - 8);
    // flackert ganz leicht (Tuncay-Qualität)
    this.lampe.setAlpha(0.86 + Math.sin(this.time.now / 90) * 0.02 + (Math.random() < 0.01 ? -0.3 : 0));
  }

  private quak(e: Ente, boese = false) {
    if (e.laeuft && !e.s.anims.isPlaying) e.s.play('kanalEnte_quak');
    const t = this.add.text(e.s.x, e.s.y - 14, boese ? 'QUAAK' : 'quak', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: boese ? '#ff6a4a' : '#e8e0a0' })
      .setOrigin(0.5, 1).setResolution(2).setScale(0.45).setDepth(4990);
    this.tweens.add({ targets: t, y: t.y - 8, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  update(t: number, delta: number) {
    super.update(t, delta);
    if (!this.player || this.ohnmacht) return;
    const p = this.player;
    const schutz = this.geschuetzt();
    // Stirnlampe gehört zum Paket: ohne Wathose bleibt nur ein trüber Schein (Handy)
    this.lampe?.setVisible(schutz);
    this.lampeNah?.setScale(schutz ? 0.55 : 0.42);
    this.lampeSetzen(Math.min(1, delta / 90));
    if (!schutz && !this.gewarnt) {
      this.gewarnt = true;
      this.toast('Die Enten hören auf zu quaken. Alle gleichzeitig. Ohne Wathose riechst du nach Mensch.');
    }
    if (schutz) this.gewarnt = false;
    this.rueckstoss(delta);
    this.giftAbbauen(delta);

    for (const e of this.enten) {
      e.quakT -= delta;
      if (e.quakT <= 0) {
        e.quakT = Phaser.Math.Between(2600, 6000);
        if (Phaser.Math.Distance.Between(e.s.x, e.s.y, p.x, p.y) < 180) this.quak(e, !schutz);
      }
      if (!e.laeuft) {
        this.schwimmen(e, delta);
        continue;
      }
      e.cd = Math.max(0, (e.cd ?? 0) - delta);
      const dx = p.x - e.s.x, dy = p.y - e.s.y;
      const d = Math.hypot(dx, dy);
      let lauf = false, zurueck = false;
      // ohne Schutz: jagen, schneller, aus größerer Entfernung; nach einem Biss kurz zurückweichen
      const jagt = !schutz && !this.frozen;
      const weite = jagt ? 140 : 100, nah = jagt ? 6 : 18;
      if (d < weite && d > nah && !this.frozen) {
        zurueck = jagt && (e.cd ?? 0) > 700;
        // etwas langsamer als der Wirt: gesund kann er weglaufen, vergiftet (langsamer) nicht mehr
        const v = (jagt ? (zurueck ? -46 : 66) : 44) * (delta / 1000);
        const nx = e.s.x + (dx / d) * v, ny = e.s.y + (dy / d) * v;
        const x0 = e.s.x;
        if (!this.solid[Math.floor((ny - 2) / T)]?.[Math.floor(e.s.x / T)]) e.s.y = ny;
        if (!this.solid[Math.floor((e.s.y - 2) / T)]?.[Math.floor(nx / T)]) e.s.x = nx;
        // Blickrichtung folgt der Bewegung (beim Zurückweichen vom Wirt weg)
        if (Math.abs(e.s.x - x0) > 0.05) e.s.setFlipX(e.s.x < x0);
        lauf = true;
      }
      this.enteAnimieren(e, t, delta, lauf, jagt, zurueck, d);
      e.s.setDepth(e.s.y);
      const ia = e.ia !== undefined ? this.interacts[e.ia] : undefined;
      if (ia) { ia.x = e.s.x; ia.y = e.s.y; }
      if (jagt && d < 12 && (e.cd ?? 0) === 0) this.biss(e, dx, dy, d);
      if (schutz && d <= 16 && !this.angesaugt) {
        this.angesaugt = true;
        this.toast('Eine Ente saugt sich an deiner Wathose fest. Sie wirkt zufrieden. Das Quaken aus dem Gully: gelöst.');
      }
    }
    this.schleierSetzen();
    this.rastpunktPruefen();
    this.wellen(delta);
    this.rattenBewegen(t, delta);
    this.katzeBewegen(t, delta);
    this.kinoUpdate(t, delta);
    this.tuerGitterMalen(t);
    this.vorraumPruefen();
    this.katzeAuftrittPruefen();
    this.musikPruefen();
  }

  /**
   * Laufende Ente: Watscheln mit Kopfnicken (4 Bilder), leichtes Wiegen im Schritttakt; beim Jagen schneller, kurz
   * vor dem Wirt Angriff mit Flügelschlagen und aufgerissenem Schnabel. Im Stand: picken, schütteln, umdrehen.
   */
  private enteAnimieren(e: Ente, t: number, delta: number, lauf: boolean, jagt: boolean, zurueck: boolean, d: number) {
    const s = e.s;
    const spiele = (key: string) => {
      if (s.anims.currentAnim?.key !== key || !s.anims.isPlaying) s.play(key);
    };
    if (lauf) {
      const key = jagt && !zurueck && d < 30 ? 'kanalEnte_angriff' : jagt ? 'kanalEnte_jagd' : 'kanalEnte_lauf';
      spiele(key);
      // Wiegen im Schritt: eine Neigung pro Schritt, nicht dauerzittern
      const takt = key === 'kanalEnte_lauf' ? 8 : 13;
      s.setAngle(key === 'kanalEnte_angriff' ? Math.sin(t / 45) * 3 : Math.sin((t / 1000) * Math.PI * takt / 2) * 5);
      e.aktionT = Math.max(e.aktionT, 600);
      return;
    }
    s.setAngle(0);
    const einmal = ['kanalEnte_pick', 'kanalEnte_schuettel', 'kanalEnte_quak'];
    const laeuftNoch = s.anims.isPlaying && einmal.includes(s.anims.currentAnim?.key ?? '');
    if (!laeuftNoch && s.anims.isPlaying) { s.anims.stop(); s.setFrame(4); }
    if (!s.anims.isPlaying && !['4', '5', '11', '12'].includes(String(s.frame.name))) s.setFrame(4);
    e.aktionT -= delta;
    if (e.aktionT > 0 || laeuftNoch || jagt) return;
    e.aktionT = Phaser.Math.Between(1800, 5200);
    const w = Math.random();
    if (w < 0.45) s.play('kanalEnte_pick');
    else if (w < 0.65) {
      s.play('kanalEnte_schuettel');
      // beim Schütteln fliegen ein paar Schleimtropfen
      for (let i = 0; i < 4; i++) {
        const tr = this.add.circle(s.x, s.y - 6, 0.7, 0x8ac83a).setDepth(s.depth + 1);
        this.tweens.add({ targets: tr, x: tr.x + Phaser.Math.Between(-9, 9), y: tr.y + Phaser.Math.Between(-5, 5), alpha: 0, duration: 420, onComplete: () => tr.destroy() });
      }
    } else s.setFlipX(!s.flipX);
  }

  /** Schwimm-Ente: Bugwellen hinter sich, ab und zu gründeln (Kopf unter Wasser, Hinterteil hoch) */
  private schwimmen(e: Ente, delta: number) {
    const s = e.s;
    if (!e.gruendelt) {
      e.welleT = (e.welleT ?? 0) - delta;
      if (e.welleT <= 0) {
        e.welleT = 420;
        const w = this.add.ellipse(s.x + (s.flipX ? 5 : -5), s.y, 4, 1.4).setStrokeStyle(0.5, 0x8aa080, 0.7).setDepth(s.depth - 1);
        this.tweens.add({ targets: w, scaleX: 2.6, scaleY: 1.8, alpha: 0, duration: 900, onComplete: () => w.destroy() });
      }
    }
    e.aktionT -= delta;
    if (e.aktionT > 0) return;
    if (!e.gruendelt) {
      e.gruendelt = true;
      e.aktionT = Phaser.Math.Between(1400, 2600);
      e.bahn?.pause();
      s.anims.stop();
      s.setFrame(10);
      for (let i = 0; i < 2; i++) this.time.delayedCall(i * 500, () => {
        const ring = this.add.ellipse(s.x + 2, s.y, 4, 1.5).setStrokeStyle(0.6, 0x8aa080, 0.8).setDepth(s.depth - 1);
        this.tweens.add({ targets: ring, scaleX: 3, scaleY: 2.2, alpha: 0, duration: 800, onComplete: () => ring.destroy() });
      });
    } else {
      e.gruendelt = false;
      e.aktionT = Phaser.Math.Between(4500, 9000);
      s.play('kanalEnte_schwimm');
      e.bahn?.resume();
    }
  }

  /** Biss: Rückstoß weg von der Ente, grüner Blitz, Vergiftung steigt */
  private biss(e: Ente, dx: number, dy: number, d: number) {
    e.cd = 1700;
    const n = d || 1;
    this.stoss = { vx: (dx / n) * 190, vy: (dy / n) * 190 };
    this.gift = Math.min(GIFT_MAX, this.gift + 1);
    this.giftT = 0;
    audio.sfx(this.gift >= GIFT_MAX ? 'retch' : 'slap');
    this.cameras.main.shake(140, 0.006);
    this.player.setTint(0x9aff6a);
    this.time.delayedCall(260, () => this.player?.active && this.gift < GIFT_MAX && this.player.setTint(this.gift ? 0xd8ffc8 : 0xffffff));
    floatTextGift(this, this.player.x, this.player.y - 24, this.gift >= GIFT_MAX ? 'BLÄRGH' : Phaser.Utils.Array.GetRandom(['QUAAAK!', 'SCHNAPP!', '*schmatz*']));
    // grüner Sabber spritzt
    for (let i = 0; i < 6; i++) {
      const tr = this.add.circle(this.player.x, this.player.y - 10, 1, 0x8ac83a).setDepth(this.player.depth + 1);
      this.tweens.add({ targets: tr, x: tr.x + Phaser.Math.Between(-12, 12), y: tr.y + Phaser.Math.Between(-10, 6), alpha: 0, duration: 380, onComplete: () => tr.destroy() });
    }
    this.slow = this.gift >= 2;
    this.alertSetzen();
    if (this.gift === 1) this.toast('Die Ente beißt zu. Es brennt. Und es wird grün.');
    if (this.gift >= GIFT_MAX) void this.ohnmaechtig();
  }

  /** Rückstoß abbauen; der Wirt rutscht, aber nicht durch Wände */
  private rueckstoss(delta: number) {
    const s = this.stoss;
    if (Math.abs(s.vx) < 4 && Math.abs(s.vy) < 4) return;
    const p = this.player, dt = delta / 1000;
    const nx = p.x + s.vx * dt, ny = p.y + s.vy * dt;
    if (!this.blocked(nx, p.y - 3)) p.x = nx;
    if (!this.blocked(p.x, ny - 3)) p.y = ny;
    const k = Math.pow(0.02, dt);
    s.vx *= k;
    s.vy *= k;
  }

  /** ohne neue Bisse klingt die Vergiftung ab (alle 9 Sekunden eine Stufe) */
  private giftAbbauen(delta: number) {
    if (!this.gift) return;
    this.giftT += delta;
    if (this.giftT < 9000) return;
    this.giftT = 0;
    this.gift--;
    this.slow = this.gift >= 2;
    this.player.setTint(this.gift ? 0xd8ffc8 : 0xffffff);
    if (!this.gift) this.player.clearTint();
    this.alertSetzen();
  }

  /** Giftschleier auf den Bildausschnitt legen, pulsiert mit der Vergiftung */
  private schleierSetzen() {
    const v = this.cameras.main.worldView;
    const a = this.gift ? 0.12 * this.gift + Math.sin(this.time.now / 260) * 0.04 : 0;
    this.schleier?.setPosition(v.x, v.y).setSize(v.width, v.height).setFillStyle(0x4aff2a, Math.max(0, a));
  }

  /** Zu viel Entengift: dem Wirt wird grün vor Augen, er kippt um und wacht oben bei Kevin auf */
  private async ohnmaechtig() {
    if (this.ohnmacht) return;
    this.ohnmacht = true;
    this.frozen = true;
    this.stoss = { vx: 0, vy: 0 };
    const p = this.player;
    p.anims.stop();
    this.toast('Dir wird grün vor Augen. Die Enten kommen näher. Sie flüstern.');
    this.tweens.add({ targets: p, angle: -90, duration: 700, ease: 'Bounce.easeOut' });
    this.cameras.main.shake(500, 0.004);
    for (const e of this.enten) if (e.laeuft) {
      e.s.play('kanalEnte_lauf').setFlipX(p.x < e.s.x);
      this.tweens.add({ targets: e.s, x: p.x + Phaser.Math.Between(-14, 14), y: p.y + Phaser.Math.Between(-4, 8), duration: 1400, ease: 'Sine.easeIn', onComplete: () => e.s.play('kanalEnte_pick') });
    }
    await this.wartet(1200);
    this.cameras.main.fade(1100, 10, 30, 6);
    await this.wartet(1300);
    hud.alert = '';
    kanalOhnmacht.aufwachen = true;
    this.go('Alley', { spawn: ALLEY_GULLY_SPAWN });
  }

  // ================================================================ Phase 3: hinter dem Rostgitter

  /** Hud-Warnung: Vergiftung (Enten) und Schreck (Ratten) */
  private alertSetzen() {
    const punkte = (n: number) => '●'.repeat(n) + '○'.repeat(GIFT_MAX - n);
    hud.alert = [this.gift ? `VERGIFTET ${punkte(this.gift)}` : '', this.schreck ? `SCHRECK ${punkte(this.schreck)}` : ''].filter(Boolean).join('   ');
  }

  /** Rastpunkte: alte Schieber (S) und der Steg der Schieberkammer. Wer umgehauen oder weggespült wird, wacht am letzten auf. */
  private rastpunkteAnlegen() {
    this.rastpunkte = [];
    this.checkpoint = { x: this.player.x, y: this.player.y };
    for (const [x, y] of this.alle('S')) this.rastpunkte.push({ x: x * T + 8, y: (y + 1) * T + 6, zx: x * T + 8, zy: (y + 1) * T + 14 });
    // in der Schieberkammer gilt der ganze Steg vor den Schiebern
    for (const [x, y] of this.alle('w')) this.rastpunkte.push({ x: x * T + 8, y: (y + 1) * T + 6, zx: x * T + 8, zy: (y + 1) * T + 14, rx: 8 * T });
  }

  private rastpunktPruefen() {
    const p = this.player;
    for (const r of this.rastpunkte) {
      if (Math.abs(p.x - r.x) > (r.rx ?? 24) || Math.abs(p.y - r.y) > 20) continue;
      if (this.checkpoint.x === r.zx && this.checkpoint.y === r.zy) return;
      this.checkpoint = { x: r.zx, y: r.zy };
      if (!this.rastHinweis) {
        this.rastHinweis = true;
        this.toast('Ein Schieber. Wenn dich hier unten etwas umhaut, kommst du hier wieder zu dir.');
      }
      return;
    }
  }

  /** Rostgitter: mit Wathose (und Haken) aufhebeln, dann ist der Weg nach Osten frei */
  private gitter() {
    const z = this.alle('Z');
    this.gitterPos = z[0];
    if (!z.length) return;
    const offen = () => {
      for (const [x, y] of z) {
        this.solid[y][x] = false;
        this.add.image(x * T, y * T, 'kanalTorOffen').setOrigin(0).setScale(0.5).setDepth(0.55);
      }
    };
    if (state.flags.kanalGitterOffen) offen();
    const [zx, zy] = z[0];
    this.interacts.push({
      x: zx * T - 2, y: (zy + 1) * T, r: 18,
      label: () => (state.flags.kanalGitterOffen ? null : this.geschuetzt() ? 'Gitter aufhebeln' : 'Rostgitter'),
      act: async () => {
        if (state.flags.kanalGitterOffen || this.frozen) return;
        if (!this.geschuetzt()) return this.toast('Das Gitter sitzt fest. Mit bloßen Händen keine Chance. Tuncays Haken wäre jetzt gut. Der hängt an der Wathose.');
        this.frozen = true;
        hud.prompt = '';
        await this.blase(this.player.x, this.player.y - 26, 'Haken rein. Hebeln, nicht ziehen.');
        for (let i = 0; i < 3; i++) {
          audio.sfx('clang');
          this.cameras.main.shake(140, 0.005);
          await this.wartet(380);
        }
        audio.sfx('crack');
        offen();
        state.flags.kanalGitterOffen = true;
        hud.goal = this.goalText();
        this.frozen = false;
        this.toast('Das Gitter gibt nach. Dahinter: Rauschen. Und irgendwo, ganz weit hinten, ein Herzschlag. Ein sehr großer.');
      },
    });
  }

  /** Funde in den Seitengängen: Porsche-Schlüssel im Gitter, Rolex im Müll, Bianca im Schleimkokon */
  private funde() {
    const f = state.flags;
    for (const [x, y] of this.alle('k')) {
      const leer = this.add.image(x * T, y * T, 'kanalGitterFront').setOrigin(0).setScale(0.5).setDepth(0.55).setVisible(!!f.porscheGefunden);
      this.interacts.push({
        x: x * T + 8, y: (y + 1) * T + 4, r: 14, label: () => (f.porscheGefunden ? null : 'Da hängt was im Gitter'),
        act: () => {
          f.porscheGefunden = true;
          state.inv.porsche = 1;
          leer.setVisible(true);
          audio.sfx('coin');
          this.toast('Ein Autoschlüssel mit Wappen, verhakt im Gitter. Der Schlüssel zu Dr. von Glanz\' Porsche. Wo der Wagen steht, weiß keiner. Noch nicht.');
        },
      });
    }
    for (const [x, y] of this.alle('u')) {
      const muell = this.add.image(x * T, y * T, 'kanalMuell').setOrigin(0).setScale(0.5).setDepth((y + 1) * T + 0.2).setVisible(!!f.rolexGefunden);
      this.interacts.push({
        x: x * T + 8, y: (y + 1) * T + 2, r: 14, label: () => (f.rolexGefunden ? 'Müll' : 'Da glitzert was'),
        act: () => {
          if (f.rolexGefunden) return this.toast('Nur noch Müll. Und ein Toaster, der dich vorwurfsvoll ansieht.');
          f.rolexGefunden = true;
          state.inv.rolex = 1;
          muell.setVisible(true);
          audio.sfx('coin');
          this.toast('Unter einem Toaster: eine Rolex. Gold, schwer, Gravur „Für Dr. v. G. – von dir selbst“. Glanz\' Rolex. Tuncay zahlt bestimmt was dafür.');
        },
      });
    }
    for (const [x, y] of this.alle('c')) {
      const leer = this.add.image(x * T, y * T, 'kanalKokonLeer').setOrigin(0).setScale(0.5).setDepth((y + 1) * T + 0.2).setVisible(!!f.biancaFrei);
      if (!f.biancaFrei) this.addLight(x * T + 8, y * T + 8, 0.35, 0.45).setTint(0x6aff4a);
      this.interacts.push({
        x: x * T + 8, y: (y + 1) * T + 4, r: 14, label: () => (f.biancaFrei ? 'Leerer Kokon' : 'Schleimkokon'),
        act: () => {
          if (f.biancaFrei) return this.toast('Der Kokon ist leer. Er riecht nach Parfüm und Donnerstag.');
          if (!this.geschuetzt()) return this.toast('Im Kokon bewegt sich was. Eine Hand mit pinken Nägeln. Der Schleim ist warm und pulsiert. Mit bloßen Händen? Nein. Mit dem Haken.');
          void this.biancaBefreien(x, y, leer);
        },
      });
    }
  }

  private async biancaBefreien(x: number, y: number, leer: Phaser.GameObjects.Image) {
    if (this.frozen) return;
    this.frozen = true;
    hud.prompt = '';
    await this.blase(this.player.x, this.player.y - 26, 'Halt still. Ich schneid dich raus.');
    for (let i = 0; i < 3; i++) {
      audio.sfx('stab');
      this.cameras.main.shake(100, 0.004);
      for (let k = 0; k < 5; k++) {
        const tr = this.add.circle(x * T + 8, y * T + 8, 1, 0x6ad04a).setDepth(5003);
        this.tweens.add({ targets: tr, x: tr.x + Phaser.Math.Between(-14, 14), y: tr.y + Phaser.Math.Between(-10, 10), alpha: 0, duration: 450, onComplete: () => tr.destroy() });
      }
      await this.wartet(420);
    }
    audio.sfx('splash');
    leer.setVisible(true);
    state.flags.biancaFrei = true;
    const b = this.add.sprite(x * T + 8, (y + 1) * T + 14, 'bianca', 0).setOrigin(0.5, 1).setScale(0.5).setDepth((y + 1) * T + 14).setTint(0xb8ffa8);
    await this.wartet(600);
    this.frozen = false;
    this.talk('bianca', () => {
      // sie geht, tropfend, Richtung Ausgang
      b.play('bianca_down');
      this.tweens.add({ targets: b, y: b.y + 5 * T, duration: 2600, onComplete: () => this.tweens.add({ targets: b, alpha: 0, duration: 500, onComplete: () => b.destroy() }) });
      this.tweens.add({ targets: b, x: b.x - T, duration: 1200, delay: 1400 });
    });
  }

  // ---------------------------------------------------------------- Schieberkammer
  // Drei Rinnen (Nord, Mitte, Süd), jede voll (1) oder leer (0). Rot leitet Nord in die Mitte, Gelb die Mitte nach Süd,
  // Grün Süd nach Nord. Ist das Ziel schon voll, läuft es über (das Wasser ist weg). Nord und Mitte sind trocken begehbar,
  // Süd ist ein tiefer Schacht: nur voll und mit dem Fass als Floß kommt man hinüber. Läuft Süd über, ist das Fass weg.
  // Lösung ab dem Anfang (1,1,1): Grün, Rot, Gelb (oder Rot, Grün, Rot, Gelb). Der Hebel stellt alles zurück.

  private kammerBilder: Phaser.GameObjects.Image[][] = [];
  private kammerTiles: [number, number][][] = [];
  private fass?: Phaser.GameObjects.Image;
  private fassPos = { x: 0, nord: 0, sued: 0, mitte: 0 };

  private schieberkammer() {
    this.kammerTiles = ['1', '2', '3'].map((ch) => this.alle(ch));
    if (!this.kammerTiles[2].length) return;
    const f = state.flags;
    f.schleuse ??= [1, 1, 1, 1];
    this.kammerBilder = this.kammerTiles.map((tiles, i) => tiles.map(([x, y]) => this.add.image(x * T, y * T, i === 2 ? 'kanalSchacht' : 'kanalRinneTrocken').setOrigin(0).setScale(0.5).setDepth(0.55)));
    const s = this.kammerTiles[2];
    const xs = s.map((t) => t[0]), ys = s.map((t) => t[1]);
    const mx = Math.round((Math.min(...xs) + Math.max(...xs)) / 2);
    this.fassPos = { x: mx * T + 8, nord: Math.min(...ys) * T + 7, sued: (Math.max(...ys) + 1) * T - 4, mitte: (Math.min(...ys) + 1) * T + 4 };
    this.fass = this.add.image(this.fassPos.x, this.fassPos.nord, 'kanalFassFloss').setScale(0.5);
    this.kammerZeigen(false);

    const farben = [0xff6a5a, 0xffe070, 0x6ae07a], namen = ['Rot', 'Gelb', 'Grün'];
    (['q', 'w', 'e'] as const).forEach((ch, i) => {
      for (const [x, y] of this.alle(ch)) {
        const rad = this.add.image(x * T + 8, y * T + 6, 'kanalRad').setScale(0.5).setDepth((y + 1) * T + 0.5).setTint(farben[i]);
        this.interacts.push({ x: x * T + 8, y: (y + 1) * T + 6, r: 13, label: () => `Schieber ${namen[i]} drehen`, act: () => this.drehen(i, rad) });
      }
    });
    for (const [x, y] of this.alle('h')) {
      const griff = this.add.image(x * T + 8, y * T + 10, 'kanalHebelGriff').setOrigin(0.5, 0.65).setScale(0.5).setDepth((y + 1) * T + 0.5).setAngle(-30);
      this.interacts.push({ x: x * T + 8, y: (y + 1) * T + 6, r: 13, label: () => 'Hebel: alles auf Anfang', act: () => this.zuruecksetzen(griff) });
    }
    // Fähre: am Nordufer (Steg über Süd) und am Südufer
    this.interacts.push({
      x: this.fassPos.x, y: this.fassPos.nord - 10, r: 16,
      label: () => (this.faehreBereit(1) ? 'Mit dem Fass übersetzen' : this.kammerTiles[2].length && !this.frozen ? 'Süd-Rinne' : null),
      act: () => (this.faehreBereit(1) ? void this.uebersetzen(true) : this.toast(this.suedText())),
    });
    this.interacts.push({
      x: this.fassPos.x, y: this.fassPos.sued + 12, r: 16,
      label: () => (this.faehreBereit(2) ? 'Mit dem Fass zurück' : null),
      act: () => void this.uebersetzen(false),
    });
  }

  private suedText() {
    const s = state.flags.schleuse!;
    if (!s[3]) return 'Kein Fass mehr. Ohne Floß kommst du nicht über die Süd-Rinne. Der Hebel stellt alles auf Anfang.';
    if (!s[2]) return 'Die Süd-Rinne ist ein tiefer, leerer Schacht. Unten liegt das Fass. Da kommst du nicht rüber. Und nicht wieder hoch.';
    if (s[0] || s[1]) return 'Das Fass dümpelt. Aber bis hierher kommst du gar nicht erst, solange Nord und Mitte voll sind.';
    return 'Das Fass dümpelt am anderen Ufer.';
  }

  /** Fass liegt an diesem Ufer (1 Nord, 2 Süd) und Süd ist voll */
  private faehreBereit(ufer: number) {
    const s = state.flags.schleuse;
    return !!s && s[2] === 1 && s[3] === ufer && !this.frozen;
  }

  /** Wasserstand anzeigen: trockene Rinnen begehbar, das Fass schwimmt, liegt im Schacht oder ist weg */
  private kammerZeigen(anim: boolean) {
    const s = state.flags.schleuse!;
    this.kammerTiles.forEach((tiles, i) => {
      const leer = s[i] === 0;
      tiles.forEach(([x, y], k) => {
        if (i < 2) this.solid[y][x] = !leer;
        const img = this.kammerBilder[i][k];
        if (anim) this.tweens.add({ targets: img, alpha: leer ? 1 : 0, duration: 900, delay: (leer ? k : tiles.length - k) * 12 });
        else img.setAlpha(leer ? 1 : 0);
      });
    });
    const fass = this.fass;
    if (!fass) return;
    this.tweens.killTweensOf(fass);
    if (!s[3]) return void fass.setVisible(false);
    fass.setVisible(true);
    if (s[2]) {
      const y = s[3] === 2 ? this.fassPos.sued : this.fassPos.nord;
      fass.clearTint().setDepth(y);
      if (anim) this.tweens.add({ targets: fass, y, duration: 900, ease: 'Sine.easeOut' });
      else fass.setY(y);
      this.tweens.add({ targets: fass, angle: { from: -3, to: 3 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: anim ? 900 : 0 });
    } else {
      fass.setTint(0x505850).setDepth(0.6).setAngle(0);
      if (anim) this.tweens.add({ targets: fass, y: this.fassPos.mitte, duration: 900, ease: 'Quad.easeIn' });
      else fass.setY(this.fassPos.mitte);
    }
  }

  private drehen(i: number, rad: Phaser.GameObjects.Image) {
    if (this.frozen) return;
    const s = state.flags.schleuse!;
    const name = ['Rot', 'Gelb', 'Grün'][i], rinne = ['Nord', 'Mitte', 'Süd'];
    this.tweens.add({ targets: rad, angle: rad.angle + 360, duration: 700, ease: 'Cubic.easeInOut' });
    audio.sfx('clang');
    const von = i, nach = (i + 1) % 3;
    if (!s[von]) return this.toast(`${name}: Es gurgelt kurz. ${rinne[von]} ist schon leer, da gibt es nichts umzuleiten.`);
    const ueber = s[nach] === 1;
    s[von] = 0;
    s[nach] = 1;
    this.time.delayedCall(350, () => audio.sfx('gurgle'));
    if (ueber) {
      this.ueberlauf(nach);
      if (nach === 2 && s[3]) {
        s[3] = 0;
        const fass = this.fass!;
        this.tweens.killTweensOf(fass);
        this.tweens.add({ targets: fass, x: fass.x + 60, angle: 360, alpha: 0, duration: 1600, ease: 'Quad.easeIn', onComplete: () => fass.setVisible(false).setAlpha(1).setX(this.fassPos.x) });
        this.toast('Süd läuft über! Das Fass reißt sich los, dreht sich einmal und gurgelt in den Überlauf. Weg. Der Hebel stellt alles auf Anfang.');
        this.kammerZeigen(true);
        return;
      }
      this.toast(nach === 1 ? `${name}: ${rinne[von]} läuft leer. Die Mitte säuft ab! Das Wasser schwappt über und gurgelt in den Überlauf.` : `${name}: ${rinne[von]} läuft leer, ${rinne[nach]} läuft über. Der Überlauf schluckt den Rest.`);
    } else {
      this.toast(`${name}: ${rinne[von]} läuft leer, ${rinne[nach]} füllt sich.${nach === 2 && s[3] ? ' Das Fass hebt sich und schwimmt.' : ''}`);
    }
    this.kammerZeigen(true);
  }

  /** Überlauf: Wasser schwappt über die Rinne, Gischt, kurzes Beben */
  private ueberlauf(i: number) {
    audio.sfx('splash');
    this.cameras.main.shake(250, 0.003);
    for (const [x, y] of this.kammerTiles[i]) {
      if ((x + y) % 2) continue;
      const g = this.add.circle(x * T + 8, y * T + 8, 1.4, 0xc8e0c0, 0.9).setDepth(5003);
      this.tweens.add({ targets: g, y: g.y - Phaser.Math.Between(6, 14), x: g.x + Phaser.Math.Between(-4, 4), alpha: 0, duration: 600, delay: Phaser.Math.Between(0, 300), onComplete: () => g.destroy() });
    }
  }

  private zuruecksetzen(griff: Phaser.GameObjects.Image) {
    if (this.frozen) return;
    this.tweens.add({ targets: griff, angle: 30, duration: 250, yoyo: true, hold: 500 });
    audio.sfx('clang');
    this.time.delayedCall(300, () => audio.sfx('rumble'));
    state.flags.schleuse = [1, 1, 1, 1];
    const fass = this.fass;
    if (fass) { this.tweens.killTweensOf(fass); fass.setVisible(true).setAlpha(1).setX(this.fassPos.x); }
    this.kammerZeigen(true);
    this.toast('Der Hebel rastet ein. Alle Schieber springen zurück, alle Rinnen laufen voll. Und ein neues Fass schwimmt aus dem Rohr. Wo kommen die her?');
  }

  /** Mit dem Fass über die Süd-Rinne */
  private async uebersetzen(nachSueden: boolean) {
    const fass = this.fass, s = state.flags.schleuse;
    if (!fass || !s || this.frozen) return;
    this.frozen = true;
    hud.prompt = '';
    const p = this.player;
    const [von, nach] = nachSueden ? [this.fassPos.nord, this.fassPos.sued] : [this.fassPos.sued, this.fassPos.nord];
    this.tweens.killTweensOf(fass);
    fass.setAngle(0);
    // die Katze, wenn sie mitläuft, springt mit aufs Fass und setzt mit über
    const k = this.katze && this.katze.modus !== 'wartet' && this.katze.modus !== 'kino' ? this.katze : undefined;
    if (k) {
      k.modus = 'kino';
      k.ziel = undefined;
      k.s.setFrame(6).setFlipX(fass.x < k.s.x);
      this.tweens.add({ targets: k.s, x: fass.x - 7, y: von + 2, duration: 320, ease: 'Quad.easeOut', onComplete: () => k.s.play('katzeKanal_sitz') });
    }
    await new Promise<void>((res) => this.tweens.add({ targets: p, x: fass.x, y: von + 3, duration: 280, ease: 'Quad.easeOut', onComplete: () => res() }));
    audio.sfx('splash');
    this.tweens.add({ targets: fass, y: nach, duration: 1500, ease: 'Sine.easeInOut' });
    if (k) this.tweens.add({ targets: k.s, y: nach + 2, duration: 1500, ease: 'Sine.easeInOut', delay: 40 });
    await new Promise<void>((res) => this.tweens.add({ targets: p, y: nach + 3, duration: 1500, ease: 'Sine.easeInOut', onComplete: () => res() }));
    s[3] = nachSueden ? 2 : 1;
    const ziel = nachSueden ? this.fassPos.sued + 20 : this.fassPos.nord - 14;
    if (k) {
      k.s.setFrame(6);
      this.tweens.add({ targets: k.s, x: p.x - 12, y: ziel + (nachSueden ? 2 : -2), duration: 320, ease: 'Quad.easeOut', onComplete: () => { k.modus = 'folgt'; k.cd = 600; } });
    }
    await new Promise<void>((res) => this.tweens.add({ targets: p, y: ziel, duration: 280, ease: 'Quad.easeOut', onComplete: () => res() }));
    this.kammerZeigen(false);
    this.frozen = false;
    if (nachSueden) {
      this.checkpoint = { x: p.x, y: p.y };
      if (!state.flags.schleuseGeloest) {
        state.flags.schleuseGeloest = true;
        unlock('schleusenwaerter');
        hud.goal = this.goalText();
        this.toast('Geschafft. Das Fass dümpelt zufrieden am Ufer. Heinz wäre stolz. Wer auch immer Heinz ist.');
      }
    }
  }

  // ---------------------------------------------------------------- Spülwellen
  // „HAPPY HOUR! Alles halber Preis!“ dröhnt durch die Rohre, drei Sekunden Gurgeln, dann rollt eine Welle durch die
  // Spülrinne (Zeichen r) von Osten nach Westen. Sicher sind Nischen und Stege, wer in der Rinne steht, wird zurückgespült.

  private rinne?: { x0: number; x1: number; y0: number; y1: number };
  private welle?: { phase: 'ruf' | 'gurgel' | 'rollt' | 'ebbt'; t: number; front: number; zone: { x0: number; x1: number; y0: number; y1: number; rinne: boolean } };
  /** wo die Welle gerade rollen würde: mit dem Curry-Topf im Vorraum dort (aus dem Klo-Rohr), sonst in der Spülrinne */
  private welleZone() {
    const p = this.player, v = this.vorraum;
    if (state.flags.curryTopf && v) {
      const [dx, dy] = v.tuer;
      const z = { x0: (dx - 3) * T, x1: (dx + 5) * T, y0: (dy + 1) * T, y1: v.wasser * T, rinne: false };
      if (p.x > z.x0 - T && p.x < z.x1 + T && p.y > z.y0 - T && p.y < z.y1 + T) return z;
    }
    return this.rinne ? { ...this.rinne, rinne: true } : undefined;
  }
  private welleT = -1;
  private welleG?: Phaser.GameObjects.Graphics;

  private rinneVorbereiten() {
    const r = this.alle('r');
    this.rinne = undefined;
    this.welle = undefined;
    this.welleT = -1;
    if (!r.length) return;
    const xs = r.map((t) => t[0]), ys = r.map((t) => t[1]);
    this.rinne = { x0: Math.min(...xs) * T, x1: (Math.max(...xs) + 1) * T, y0: Math.min(...ys) * T, y1: (Math.max(...ys) + 1) * T };
    this.welleG = this.add.graphics().setDepth(0.7);
  }

  private wellen(delta: number) {
    const p = this.player;
    if (!this.welle) {
      const z = this.welleZone();
      if (!z || this.ohnmacht || this.kino) return;
      // Spülrinne: erst scharf hinter dem Gitter, die erste Welle kommt bald (zum Lernen). Vorraum mit Topf: schnell, oft.
      if (z.rinne && (!state.flags.kanalGitterOffen || p.x < z.x0 - 9 * T)) return;
      if (!z.rinne && this.welleT > 9000) this.welleT = 1200;
      if (this.welleT < 0) this.welleT = z.rinne ? 7000 : 1200;
      this.welleT -= delta;
      if (this.welleT <= 0) this.welleStarten(z);
      return;
    }
    const w = this.welle, rn = w.zone;
    w.t += delta;
    if (w.phase === 'ruf' && w.t > 1500) { w.phase = 'gurgel'; w.t = 0; }
    if (w.phase === 'gurgel') {
      if (Math.floor(w.t / 700) !== Math.floor((w.t - delta) / 700)) audio.sfx('gurgle');
      this.cameras.main.shake(60, 0.0015);
      if (w.t > (rn.rinne ? 3000 : 2400)) { w.phase = 'rollt'; w.t = 0; w.front = rn.x1; audio.sfx('rumble'); }
    }
    if (w.phase === 'rollt') {
      w.front -= 150 * (delta / 1000);
      this.welleMalen(1);
      // Treffer: der Wirt steht in der Rinne und das Wasser hat ihn erreicht
      const ch = this.rows[Math.floor((p.y - 3) / T)]?.[Math.floor(p.x / T)];
      const drin = rn.rinne ? ch === 'r' : ch !== 'n' && p.y - 3 >= rn.y0 && p.y - 3 < rn.y1 && p.x >= rn.x0 && p.x < rn.x1;
      if (drin && p.x >= w.front - 4 && !this.frozen && !this.ohnmacht) void this.spuelen();
      if (w.front <= rn.x0) { w.phase = 'ebbt'; w.t = 0; }
    }
    if (w.phase === 'ebbt') {
      const a = 1 - w.t / 1400;
      this.welleMalen(Math.max(0, a));
      if (a <= 0) {
        this.welleG?.clear();
        this.welle = undefined;
        this.welleT = rn.rinne ? Phaser.Math.Between(30000, 44000) : Phaser.Math.Between(5500, 7500);
      }
    }
  }

  private welleStarten(zone: { x0: number; x1: number; y0: number; y1: number; rinne: boolean }) {
    this.welle = { phase: 'ruf', t: 0, front: zone.x1, zone };
    audio.sfx('glocke');
    const v = this.cameras.main.worldView;
    for (let i = 0; i < 3; i++) {
      const t = this.add.text(v.centerX, v.y + 28 + i * 3, 'HAPPY HOUR! ALLES HALBER PREIS!', {
        fontFamily: '"Press Start 2P", monospace', fontSize: '10px', color: '#ffd040', stroke: '#120c0b', strokeThickness: 4,
      }).setOrigin(0.5).setResolution(2).setScale(0.5 + i * 0.06).setAlpha(i ? 0.35 : 1).setDepth(6000);
      this.tweens.add({ targets: t, alpha: 0, scale: t.scale * 1.15, delay: 1300 + i * 250, duration: 700, onComplete: () => t.destroy() });
    }
    this.toast(zone.rinne
      ? 'Durch die Rohre dröhnt Kalles Stimme: „HAPPY HOUR! Alles halber Preis!“ Dann gurgelt es. Rein in eine Nische!'
      : 'Aus dem Klo-Rohr dröhnt Kalles Stimme: „HAPPY HOUR!“ Oben drücken alle die Spülung. Rein in eine Nische, sonst ist das Curry weg!');
  }

  /** Wasserwand mit Schaumkrone von der Front bis zum Ostende der Rinne */
  private welleMalen(alpha: number) {
    const g = this.welleG, w = this.welle, rn = w?.zone;
    if (!g || !rn || !w) return;
    g.clear();
    const x = Math.max(rn.x0, w.front);
    g.fillStyle(0x3a5a38, 0.85 * alpha).fillRect(x, rn.y0, rn.x1 - x, rn.y1 - rn.y0);
    g.fillStyle(0x5a8a50, 0.6 * alpha);
    for (let i = 0; i < 6; i++) g.fillRect(x + 6 + ((this.time.now / 6 + i * 37) % Math.max(8, rn.x1 - x - 8)), rn.y0 + 3 + (i % 3) * 9, 6, 1);
    if (w.phase === 'rollt') {
      g.fillStyle(0xd8f0d0, 0.95).fillRect(x - 2, rn.y0, 4, rn.y1 - rn.y0);
      g.fillStyle(0xa8d8a0, 0.9);
      for (let yy = rn.y0; yy < rn.y1; yy += 3) g.fillRect(x - 4 - ((yy * 7 + Math.floor(this.time.now / 40)) % 4), yy, 2, 2);
    }
  }

  /** Von der Welle erwischt: zurückgespült bis zum letzten Schieber */
  private async spuelen() {
    if (this.frozen || this.ohnmacht) return;
    this.frozen = true;
    hud.prompt = '';
    const p = this.player;
    const topfWeg = this.curryVerschuetten();
    audio.sfx('splash');
    p.anims.stop();
    p.setTint(0x9ac0ff);
    this.tweens.add({ targets: p, x: p.x - 70, angle: -540, duration: 900, ease: 'Quad.easeOut' });
    this.cameras.main.fade(700, 10, 22, 14);
    await this.wartet(950);
    p.setAngle(0).clearTint().setPosition(this.checkpoint.x, this.checkpoint.y);
    this.katzeNachholen();
    this.cameras.main.fadeIn(600);
    this.frozen = false;
    this.toast(topfWeg
      ? 'Die Welle reißt dir den Topf vom Kopf. Das Curry ist weg, und du bist zurück am Schieber. Ab zu Adshayan: Er muss nachkochen.'
      : 'Die Welle spült dich zurück bis zum Schieber. Du hast Abwasser geschluckt. Viel. Es schmeckt nach Happy Hour.');
  }

  /** Curry-Topf verloren (von einer Welle erwischt): orange Fontäne, Fleck am Boden. true, wenn er einen hatte. */
  private curryVerschuetten() {
    if (!state.flags.curryTopf) return false;
    state.flags.curryTopf = false;
    const p = this.player;
    this.topfWeg();
    this.spritzer(p.x, p.y - 20, 26, 170, 0xe07a20);
    this.add.ellipse(p.x, p.y - 1, 22, 7, 0xd0601a, 0.75).setDepth(0.8);
    this.add.image(p.x + 8, p.y - 1, 'curryTopf').setScale(0.5).setAngle(100).setDepth(p.y - 2);
    return true;
  }

  // ---------------------------------------------------------------- Tentakelratten
  // Rudel zu dritt an jedem Rattenloch (P). Am Nest schnüffeln sie herum. Kommt der Wirt nah (und ist er auf dem Weg
  // erreichbar, nicht nur durch die Wand), jagt das Rudel ihn kurz: über ein Wegfeld, damit keine Ratte an Ecken
  // hängen bleibt, und etwas langsamer als der Wirt, damit man entkommen kann. Nach gut zwei Sekunden oder bei Abstand
  // geben sie auf und ruhen sich aus. Jede Berührung ist ein Schreck, danach flieht das Rudel. Drei Schrecks: Ohnmacht,
  // Aufwachen am letzten Schieber. Ab Kapitel „katze“ lenkt die Katze jagende Ratten ab und frisst manche.

  private feldSpieler?: Int16Array;
  private feldT = 0;
  private nestFelder: Int16Array[] = [];

  /** Schritte von (sx, sy) zu jeder begehbaren Kachel (-1 = unerreichbar), höchstens maxD weit */
  private wegfeld(sx: number, sy: number, maxD = 30) {
    const W = this.rows[0].length, H = this.rows.length;
    const d = new Int16Array(W * H).fill(-1);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return d;
    const q = new Int32Array(W * H);
    let kopf = 0, ende = 0;
    d[sy * W + sx] = 0;
    q[ende++] = sy * W + sx;
    while (kopf < ende) {
      const i = q[kopf++], x = i % W, y = (i / W) | 0, nd = d[i] + 1;
      if (nd > maxD) continue;
      for (const [dx, dy] of RICHTUNGEN) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (d[j] >= 0 || this.solid[ny][nx]) continue;
        d[j] = nd;
        q[ende++] = j;
      }
    }
    return d;
  }

  /** Feldwert an einer Weltposition (Füße) */
  private feldBei(feld: Int16Array | undefined, x: number, y: number) {
    if (!feld) return -1;
    const W = this.rows[0].length, tx = Math.floor(x / T), ty = Math.floor((y - 2) / T);
    if (tx < 0 || ty < 0 || tx >= W || ty >= this.rows.length) return -1;
    return feld[ty * W + tx];
  }

  /** Ein Stück gehen: entlang des Wegfelds (nächste Kachel näher am Ziel), in der Nähe direkt aufs Ziel. Gibt dx zurück. */
  private folgeFeld(s: Phaser.GameObjects.Sprite, feld: Int16Array | undefined, ziel: { x: number; y: number }, v: number, delta: number) {
    const W = this.rows[0].length;
    const tx = Math.floor(s.x / T), ty = Math.floor((s.y - 2) / T);
    const hier = this.feldBei(feld, s.x, s.y);
    let zx = ziel.x, zy = ziel.y;
    if (feld && hier > 1) {
      let best = hier, bx = -1, by = -1;
      for (const [dx, dy] of RICHTUNGEN) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= this.rows.length) continue;
        const d = feld[ny * W + nx];
        if (d >= 0 && d < best) { best = d; bx = nx; by = ny; }
      }
      if (bx >= 0) { zx = bx * T + 8; zy = by * T + 11; }
    }
    const dx = zx - s.x, dy = zy - s.y, n = Math.hypot(dx, dy);
    if (n < 0.5) return 0;
    const step = Math.min(n, v * (delta / 1000));
    const nx = s.x + (dx / n) * step, ny = s.y + (dy / n) * step, x0 = s.x;
    if (!this.solid[Math.floor((ny - 2) / T)]?.[Math.floor(s.x / T)]) s.y = ny;
    if (!this.solid[Math.floor((s.y - 2) / T)]?.[Math.floor(nx / T)]) s.x = nx;
    return s.x - x0;
  }

  private rattenNester() {
    this.ratten = [];
    this.nestFelder = [];
    this.alle('P').forEach(([x, y], n) => {
      this.nestFelder[n] = this.wegfeld(x, y + 1, 60);
      for (let i = 0; i < 3; i++) {
        const nx = x * T + 8 + (i - 1) * 7, ny = (y + 1) * T + 12 + (i % 2) * 3;
        const s = this.add.sprite(nx, ny, 'kanalRatte', 3).setOrigin(0.5, 1).setScale(0.5).setDepth(ny).setFlipX(i === 0);
        s.play({ key: 'kanalRatte_schnupper', startFrame: i });
        this.ratten.push({ s, nest: { x: nx, y: ny }, rudel: n, modus: 'nest', t: 0, ruheBis: 0, zick: i * 2.1, bummelT: 600 + i * 700 });
      }
    });
  }

  private rattenBewegen(t: number, delta: number) {
    const p = this.player, jetzt = this.time.now;
    const ptx = Math.floor(p.x / T), pty = Math.floor((p.y - 3) / T);
    // Wegfeld zum Wirt (für Ratten und Katze), ein paarmal pro Sekunde neu
    this.feldT -= delta;
    if (this.feldT <= 0 || !this.feldSpieler) { this.feldSpieler = this.wegfeld(ptx, pty, 26); this.feldT = 250; }
    for (const r of this.ratten) {
      if (r.modus === 'weg') {
        if (jetzt > r.t) {
          r.modus = 'nest';
          r.ruheBis = jetzt + 3000;
          r.s.setVisible(true).setPosition(r.nest.x, r.nest.y).setAlpha(0);
          this.tweens.add({ targets: r.s, alpha: 1, duration: 600 });
        }
        continue;
      }
      const dx = p.x - r.s.x, dy = p.y - 2 - r.s.y, d = Math.hypot(dx, dy);
      // Rudel wird aufmerksam: nah dran und auf dem Weg erreichbar
      if (r.modus === 'nest' && jetzt > r.ruheBis && d < 80 && !this.frozen && !this.ohnmacht) {
        const weg = this.feldBei(this.feldSpieler, r.s.x, r.s.y);
        if (weg >= 0 && weg <= 6) {
          for (const o of this.ratten) if (o.rudel === r.rudel && o.modus === 'nest') { o.modus = 'jagd'; o.t = 2300 + Math.random() * 700; }
          audio.sfx('blip');
        }
      }
      let bewegt = 0, laeuft = false;
      if (r.modus === 'jagd') {
        r.t -= delta;
        const weg = this.feldBei(this.feldSpieler, r.s.x, r.s.y);
        if (r.t <= 0 || weg < 0 || weg > 9 || this.frozen) {
          r.modus = 'heim';
          r.ruheBis = jetzt + 4500;
        } else {
          // von der Seite anschleichen: jede Ratte zielt etwas versetzt, ganz nah direkt
          const seit = d < 30 ? 0 : 1;
          const ziel = { x: p.x + Math.cos(r.zick + t / 400) * 9 * seit, y: p.y - 2 + Math.sin(r.zick + t / 400) * 6 * seit };
          bewegt = this.folgeFeld(r.s, this.feldSpieler, ziel, 62, delta);
          laeuft = true;
        }
      }
      if (r.modus === 'heim' || r.modus === 'flucht') {
        if (Math.hypot(r.nest.x - r.s.x, r.nest.y - r.s.y) < 4) r.modus = 'nest';
        else { bewegt = this.folgeFeld(r.s, this.nestFelder[r.rudel], r.nest, r.modus === 'flucht' ? 80 : 50, delta); laeuft = true; }
      }
      if (r.modus === 'nest') {
        // am Nest herumschnüffeln statt starr stehen
        r.bummelT -= delta;
        if (r.bummelT <= 0) {
          r.bummelT = 900 + Math.random() * 1800;
          const b = { x: r.nest.x + Phaser.Math.Between(-10, 10), y: r.nest.y + Phaser.Math.Between(-3, 5) };
          r.bummel = Math.random() < 0.6 && !this.solid[Math.floor((b.y - 2) / T)]?.[Math.floor(b.x / T)] ? b : undefined;
        }
        if (r.bummel) {
          if (Math.hypot(r.bummel.x - r.s.x, r.bummel.y - r.s.y) < 1.5) r.bummel = undefined;
          else { bewegt = this.folgeFeld(r.s, undefined, r.bummel, 22, delta); laeuft = true; }
        }
      }
      if (Math.abs(bewegt) > 0.02) r.s.setFlipX(bewegt < 0);
      if (r.modus === 'jagd' && d < 16) { r.s.anims.stop(); r.s.setFrame(4).setFlipX(dx < 0); }
      else if (laeuft) {
        if (r.s.anims.currentAnim?.key !== 'kanalRatte_renn' || !r.s.anims.isPlaying) r.s.play('kanalRatte_renn');
        r.s.anims.timeScale = r.modus === 'nest' ? 0.5 : 1;
      } else if (r.s.anims.currentAnim?.key !== 'kanalRatte_schnupper' || !r.s.anims.isPlaying) {
        r.s.play('kanalRatte_schnupper');
        r.s.anims.timeScale = 1;
      }
      r.s.setDepth(r.s.y);
      if (r.modus === 'jagd' && d < 9 && jetzt > this.unverwundbarBis && !this.frozen && !this.ohnmacht) this.erschrecken(r, dx, dy, d);
    }
    // Schreck klingt ab (alle 12 Sekunden eine Stufe)
    if (this.schreck) {
      this.schreckT += delta;
      if (this.schreckT > 12000) { this.schreckT = 0; this.schreck--; this.alertSetzen(); }
    }
  }

  private erschrecken(r: Ratte, dx: number, dy: number, d: number) {
    const p = this.player;
    this.schreck = Math.min(GIFT_MAX, this.schreck + 1);
    this.schreckT = 0;
    this.unverwundbarBis = this.time.now + 2000;
    const n = d || 1;
    this.stoss = { vx: (dx / n) * 170, vy: (dy / n) * 170 };
    audio.sfx(this.schreck >= GIFT_MAX ? 'scream' : 'sting');
    floatTextGift(this, p.x, p.y - 26, Phaser.Utils.Array.GetRandom(['!!', 'IIH!', 'WAH!']));
    this.tweens.add({ targets: p, alpha: 0.35, duration: 100, yoyo: true, repeat: 6 });
    // das Rudel flieht und gibt eine Weile Ruhe
    for (const o of this.ratten) if (o.rudel === r.rudel && o.modus !== 'weg') { o.modus = 'flucht'; o.ruheBis = this.time.now + 5000; }
    this.alertSetzen();
    if (this.schreck === 1 && !this.rattenHinweis) {
      this.rattenHinweis = true;
      this.toast(this.katze ? 'Eine Ratte mit Armen erwischt dich! Bleib bei der Katze.' : 'Eine Ratte mit Armen springt dich an! Drei davon, und du kippst um. Lauf weg, sie sind langsamer als du.');
    }
    if (this.schreck >= GIFT_MAX) void this.rattenOhnmacht();
  }

  /** Drei Schrecks: Ohnmacht, Aufwachen am letzten Schieber */
  private async rattenOhnmacht() {
    if (this.ohnmacht) return;
    this.ohnmacht = true;
    this.frozen = true;
    this.stoss = { vx: 0, vy: 0 };
    const p = this.player;
    p.anims.stop();
    this.toast('Zu viele Ratten, zu viele Arme. Dir wird schwarz vor Augen.');
    this.tweens.add({ targets: p, angle: -90, duration: 600, ease: 'Bounce.easeOut' });
    for (const r of this.ratten) if (r.modus !== 'weg' && Math.hypot(r.s.x - p.x, r.s.y - p.y) < 120) this.tweens.add({ targets: r.s, x: p.x + Phaser.Math.Between(-12, 12), y: p.y + Phaser.Math.Between(-4, 6), duration: 900 });
    await this.wartet(1300);
    this.cameras.main.fade(900, 0, 0, 0);
    await this.wartet(1100);
    this.schreck = 0;
    this.alertSetzen();
    for (const r of this.ratten) {
      if (r.modus === 'weg') continue;
      this.tweens.killTweensOf(r.s);
      r.modus = 'nest';
      r.ruheBis = this.time.now + 5000;
      r.s.setPosition(r.nest.x, r.nest.y).play('kanalRatte_schnupper');
    }
    p.setAngle(0).setAlpha(1).setPosition(this.checkpoint.x, this.checkpoint.y);
    this.katzeNachholen();
    this.ohnmacht = false;
    this.frozen = false;
    this.cameras.main.fadeIn(900);
    this.toast(this.katze ? 'Du kommst am Schieber wieder zu dir. Die Katze sitzt neben dir und leckt sich die Pfote. Sie sagt nichts. Sie denkt es.' : 'Du kommst am Schieber wieder zu dir. Die Ratten haben dich liegen lassen. Du schmeckst ihnen nicht. Noch nicht.');
  }

  // ---------------------------------------------------------------- Die Katze
  // Taucht hinter dem Rostgitter auf, als ein großes Rudel den Wirt umzingelt, frisst das halbe Rudel und läuft ab da
  // mit (kanal = 'katze'). Jagende Ratten lenkt sie ab: Sie springt die nächste an, das Rudel flieht, manche frisst sie.
  // Ab dem Curry-Plan (kanal = 'curry') wartet sie vor der Klärwerk-Tür.

  private katze?: { s: Phaser.GameObjects.Sprite; modus: 'folgt' | 'jagt' | 'frisst' | 'wartet' | 'kino'; ziel?: Ratte; t: number; cd: number; ia: Interact };

  private katzeEinrichten(x: number, y: number, modus: 'folgt' | 'wartet') {
    this.katze?.s.destroy();
    const s = this.add.sprite(x, y, 'katzeKanal', 4).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    s.play('katzeKanal_sitz');
    const ia: Interact = { x, y: y - 4, r: 16, label: () => (this.katze && !this.frozen && !this.kino ? 'Mit der Katze reden' : null), act: () => this.talk('katzeKanal') };
    this.interacts.push(ia);
    this.katze = { s, modus, t: 0, cd: 800, ia };
  }

  /** freie Stelle hinter dem Wirt (für die Katze) */
  private hinterDemWirt() {
    const p = this.player;
    const dir = this.facing === 'side' ? (p.flipX ? 1 : -1) : 0;
    const kand: [number, number][] = [[dir * 18, 0], [0, this.facing === 'up' ? 12 : -12], [-18, 0], [18, 0], [0, 12], [0, -12]];
    for (const [ox, oy] of kand) {
      const x = p.x + ox, y = p.y + oy;
      if (!this.solid[Math.floor((y - 2) / T)]?.[Math.floor(x / T)]) return { x, y };
    }
    return { x: p.x, y: p.y };
  }

  /** nach Ohnmacht, Welle oder Abkürzung: die Katze ist gleich wieder da */
  private katzeNachholen() {
    const k = this.katze;
    if (!k || k.modus === 'wartet') return;
    const { x, y } = this.hinterDemWirt();
    k.s.setPosition(x, y);
    k.modus = 'folgt';
    k.ziel = undefined;
  }

  private katzeBewegen(t: number, delta: number) {
    const k = this.katze;
    if (!k) return;
    const s = k.s, p = this.player;
    k.cd -= delta;
    if (k.modus === 'kino') { s.setDepth(s.y); k.ia.x = s.x; k.ia.y = s.y - 4; return; }
    let bewegt = 0;
    if (k.modus === 'wartet') {
      if (s.anims.currentAnim?.key !== 'katzeKanal_sitz') s.play('katzeKanal_sitz');
    } else {
      if (k.modus !== 'frisst' && Math.hypot(p.x - s.x, p.y - s.y) > 260) this.katzeNachholen();
      if (k.modus === 'folgt' && k.cd <= 0 && !this.frozen) {
        // jagende Ratte in der Nähe? Losspringen, das Rudel flieht
        let ziel: Ratte | undefined, best = 120;
        for (const r of this.ratten) {
          if (r.modus !== 'jagd') continue;
          const d = Math.min(Math.hypot(r.s.x - p.x, r.s.y - p.y), Math.hypot(r.s.x - s.x, r.s.y - s.y));
          if (d < best) { best = d; ziel = r; }
        }
        if (ziel) {
          k.modus = 'jagt';
          k.ziel = ziel;
          k.t = 1500;
          for (const o of this.ratten) if (o.rudel === ziel.rudel && o.modus === 'jagd') { o.modus = 'flucht'; o.ruheBis = this.time.now + 4500; }
          audio.sfx('growl');
          if (!this.katzeHinweis) { this.katzeHinweis = true; this.toast('Die Katze faucht und springt. Das Rudel stiebt auseinander.'); }
        }
      }
      if (k.modus === 'folgt') {
        const z = this.hinterDemWirt(), d = Math.hypot(z.x - s.x, z.y - s.y);
        if (d > 10) {
          bewegt = this.folgeFeld(s, this.feldSpieler, z, d > 80 ? 110 : 80, delta);
          if (s.anims.currentAnim?.key !== 'katzeKanal_lauf') s.play('katzeKanal_lauf');
        } else if (s.anims.currentAnim?.key !== 'katzeKanal_sitz') s.play('katzeKanal_sitz');
      } else if (k.modus === 'jagt') {
        const z = k.ziel;
        k.t -= delta;
        if (!z || z.modus === 'weg' || k.t <= 0) { k.modus = 'folgt'; k.cd = 1000; }
        else {
          s.anims.stop();
          s.setFrame(6);
          bewegt = this.folgeFeld(s, undefined, { x: z.s.x, y: z.s.y }, 130, delta);
          if (Math.hypot(z.s.x - s.x, z.s.y - s.y) < 10) {
            if (Math.random() < 0.55) this.katzeFrisst(z);
            else { k.modus = 'folgt'; k.cd = 900; }
          }
        }
      } else if (k.modus === 'frisst') {
        k.t -= delta;
        s.anims.stop();
        s.setFrame(7);
        if (k.t <= 0) { k.modus = 'folgt'; k.cd = 1600; }
      }
    }
    if (Math.abs(bewegt) > 0.05) s.setFlipX(bewegt < 0);
    else if (k.modus === 'folgt' || k.modus === 'wartet') s.setFlipX(p.x < s.x);
    s.setDepth(s.y);
    k.ia.x = s.x;
    k.ia.y = s.y - 4;
  }

  private katzeFrisst(r: Ratte) {
    const k = this.katze!;
    r.modus = 'weg';
    r.t = this.time.now + 25000;
    this.tweens.killTweensOf(r.s);
    r.s.setVisible(false);
    audio.sfx('chomp');
    floatTextGift(this, k.s.x, k.s.y - 14, '*mampf*');
    for (let i = 0; i < 4; i++) {
      const tr = this.add.circle(r.s.x, r.s.y - 4, 0.8, 0x8ac83a).setDepth(k.s.depth + 1);
      this.tweens.add({ targets: tr, x: tr.x + Phaser.Math.Between(-8, 8), y: tr.y + Phaser.Math.Between(-6, 4), alpha: 0, duration: 400, onComplete: () => tr.destroy() });
    }
    k.modus = 'frisst';
    k.t = 700;
    k.ziel = undefined;
  }

  /** Hinter dem Rostgitter: ein großes Rudel umzingelt den Wirt, ein Auge glüht, die Katze frisst das halbe Rudel */
  private async katzeAuftritt() {
    this.katzeSzene = true;
    this.frozen = true;
    hud.prompt = '';
    this.stoss = { vx: 0, vy: 0 };
    this.welleT = Math.max(this.welleT, 20000);
    const p = this.player;
    p.anims.stop();
    audio.sfx('rumble');
    this.toast('Es raschelt. Vor dir. Hinter dir. Überall.');
    const z = this.alle('Z')[0];
    const rudel: Phaser.GameObjects.Sprite[] = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const von = i % 2 ? { x: p.x + 110, y: p.y - 2 } : { x: p.x + 8, y: p.y + 70 };
      const s = this.add.sprite(von.x, von.y, 'kanalRatte', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(von.y).play('kanalRatte_renn');
      const zx = p.x + Math.cos(a) * 22, zy = p.y + Math.sin(a) * 9;
      s.setFlipX(zx < von.x);
      this.tweens.add({
        targets: s, x: zx, y: zy, duration: 900 + i * 110, ease: 'Sine.easeOut', onUpdate: () => s.setDepth(s.y),
        onComplete: () => { s.anims.stop(); s.setFrame(4).setFlipX(p.x < s.x); },
      });
      rudel.push(s);
    }
    await this.wartet(1600);
    floatTextGift(this, p.x, p.y - 26, '!!');
    audio.sfx('sting');
    await this.blase(p.x, p.y - 26, 'Ganz ruhig. Braaave Ratten.');
    // ein Auge glüht in der Dunkelheit, am Gitter hinter dem Wirt
    const ax = (z ? z[0] : 40) * T + 4, ay = (z ? z[1] : 25) * T + 6;
    const auge = this.add.circle(ax, ay, 1.1, 0xff3a10).setDepth(5003);
    const glut = this.addLight(ax, ay, 0.22, 0.8).setTint(0xff3a10);
    audio.sfx('growl');
    await this.wartet(1300);
    auge.destroy();
    glut.setVisible(false);
    const kat = this.add.sprite(ax, ay + 8, 'katzeKanal', 6).setOrigin(0.5, 1).setScale(0.5).setDepth(ay + 8);
    // drei Bissen
    for (const i of [0, 2, 4]) {
      const r = rudel[i];
      kat.setFrame(6).setFlipX(r.x < kat.x);
      await new Promise<void>((res) => this.tweens.add({ targets: kat, x: r.x, y: r.y, duration: 240, ease: 'Quad.easeOut', onUpdate: () => kat.setDepth(kat.y + 1), onComplete: () => res() }));
      r.destroy();
      kat.setFrame(7);
      audio.sfx('chomp');
      this.cameras.main.shake(120, 0.004);
      floatTextGift(this, kat.x, kat.y - 14, '*mampf*');
      await this.wartet(330);
    }
    // der Rest flieht
    rudel.forEach((r, i) => {
      if (!r.active) return;
      r.play('kanalRatte_renn').setFlipX(i % 2 === 0);
      this.tweens.add({ targets: r, x: r.x + (i % 2 ? 140 : -10), y: r.y + (i % 2 ? 0 : 90), alpha: 0, duration: 900, onComplete: () => r.destroy() });
    });
    const neben = this.hinterDemWirt();
    kat.play('katzeKanal_lauf').setFlipX(neben.x < kat.x);
    await new Promise<void>((res) => this.tweens.add({ targets: kat, x: neben.x, y: neben.y, duration: 500, onUpdate: () => kat.setDepth(kat.y), onComplete: () => res() }));
    kat.play('katzeKanal_sitz').setFlipX(p.x < kat.x);
    await this.wartet(300);
    this.frozen = false;
    this.talk('katzeKanal', () => {
      state.flags.kanal = 'katze';
      hud.goal = this.goalText();
      const { x, y } = { x: kat.x, y: kat.y };
      kat.destroy();
      this.katzeEinrichten(x, y, 'folgt');
      this.katzeSzene = false;
    });
  }

  // ---------------------------------------------------------------- Vorraum: Felix, die Tür, das Rohr
  // Felix rutscht durchs Rohr aus dem Eimer herunter und wird vom Wesen in die Brühe gezogen (Zwischensequenz unten).
  // Danach die Tür mit dem Tentakelgitter: Die Katze will Curry. Das Rohr führt hinauf in die Herrentoilette des Eimers
  // (Klo-Abkürzung).

  private vorraum?: { tuer: [number, number]; rohr: [number, number]; wasser: number };
  private tuerG?: Phaser.GameObjects.Graphics;
  /** wie weit das Tentakelgitter noch vor der Tür hängt (1 = ganz, 0 = zurückgezogen) */
  private gitterAnteil = 1;

  private vorraumEinrichten() {
    const d = this.alle('D')[0];
    this.vorraum = undefined;
    if (!d) return;
    const [dx, dy] = d;
    const rohr = this.alle('H').find(([x, y]) => y === dy && Math.abs(x - dx) <= 6) ?? [dx + 3, dy];
    let wy = dy + 1;
    while (wy < this.rows.length && this.rows[wy][dx] !== '~') wy++;
    this.vorraum = { tuer: [dx, dy], rohr: rohr as [number, number], wasser: wy };
    const f = state.flags;
    // Tür: Tentakelgitter, solange es da drin lebt
    this.tuerG = this.add.graphics().setDepth((dy + 1) * T + 6);
    this.gitterAnteil = f.curryAnTuer ? 0 : 1;
    if (f.curryAnTuer) this.topfVorDerTuer(false);
    this.interacts.push({
      x: dx * T + 8, y: (dy + 1) * T + 4, r: 18, label: () => (f.kanal === 'curry' && f.curryTopf ? 'Curry vor die Tür stellen' : f.kanal === 'klaerwerk' || f.kanal === 'gerettet' ? 'Ins Klärwerk' : 'Stahltür'),
      act: () => {
        if (f.kanal === 'katze' && f.felixKanal && this.katze) return void this.tuerSzene();
        if (f.kanal === 'curry' && f.curryTopf) return void this.topfAbstellen();
        if (f.kanal === 'klaerwerk' || f.kanal === 'gerettet') return this.go('Klaerwerk');
        if (f.curryAnTuer) return this.toast('Die Tür steht einen Spalt offen. Dahinter: ein Röhren, halb Hirsch, halb Nebelhorn. Die Katze: „Noch nicht, Wirt. Er frisst noch. Lass ihn fressen.“');
        this.toast(kanalAb(f, 'curry')
          ? 'Das Tentakelgitter zuckt. Dahinter schlägt etwas. Ohne Curry kommt es nicht raus. Viel Curry.'
          : '„KLÄRWERK – BETRETEN VERBOTEN“. Davor hängt ein Gitter aus dicken, zuckenden Tentakeln. Dahinter schlägt etwas. Wie ein Herz. Ein sehr großes.');
      },
    });
    const [rx, ry] = this.vorraum.rohr;
    this.interacts.push({
      x: rx * T + 8, y: (ry + 1) * T + 4, r: 14,
      label: () => (kanalAb(f, 'curry') ? 'Durchs Rohr nach oben' : 'Rohr'),
      act: () => {
        if (!kanalAb(f, 'curry')) return this.toast('Ein breites Rohr nach oben. Es riecht nach ... Kneipe? Nach Klo. Nach Kneipenklo.');
        f.kloAbkuerzung = true;
        rohrAnkunft.jetzt = true;
        this.go('HerrenWC', { spawn: HERREN_KABINE_SPAWN });
      },
    });
    // Felix verloren: seine Taschenlampe treibt noch in der Seitenrinne
    if (f.felixKanal === 'verloren') this.felixReste();
  }

  /** Tentakel als Kette aus Gliedern mit Saugnäpfen, wellig von (x0, y0) bis zur Spitze (x1, y1) */
  private tentakelMalen(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, t: number, dicke: number) {
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = x0 + (x1 - x0) * u + Math.sin(u * 5 + t / 180) * 4 * (1 - u);
      const y = y0 + (y1 - y0) * u + Math.cos(u * 4 + t / 230) * 2 * (1 - u);
      const r = dicke * (1 - u * 0.6);
      g.fillStyle(0x4a1e3e, 1).fillCircle(x, y, r + 0.6);
      g.fillStyle(0x7a3a6a, 1).fillCircle(x, y, r);
      g.fillStyle(0xa85a90, 1).fillCircle(x - r * 0.35, y - r * 0.35, r * 0.45);
      if (i % 2 === 0 && i < n) g.fillStyle(0xf0b0c8, 1).fillCircle(x + r * 0.55, y + r * 0.3, Math.max(0.7, r * 0.28));
    }
    g.fillStyle(0x3aa02a, 0.9).fillCircle(x0, y0, dicke + 1.5); // Schleim an der Austrittsstelle
  }

  /** Das Tentakelgitter vor der Klärwerk-Tür: vier Arme, die zucken und sich kreuzen */
  private tuerGitterMalen(t: number) {
    const g = this.tuerG, v = this.vorraum;
    if (!g || !v) return;
    g.clear();
    if (state.flags.kanal === 'gerettet' || this.gitterAnteil <= 0.02) return;
    const [dx, dy] = v.tuer;
    const anteil = this.gitterAnteil;
    const cam = this.cameras.main.worldView;
    if (dx * T < cam.x - 40 || dx * T > cam.right + 40 || dy * T < cam.y - 40 || dy * T > cam.bottom + 40) return;
    for (let k = 0; k < 4; k++) {
      const x0 = dx * T - 4 + k * 8, y0 = (dy + 1) * T + 4;
      const zuck = anteil < 1 ? Math.sin(t / 40 + k) * 3 * (1 - anteil) : 0;
      const x1 = dx * T + 8 + (k % 2 ? 9 : -9) + Math.sin(t / 380 + k * 1.7) * 4 + zuck, y1 = dy * T - 2 + Math.cos(t / 300 + k) * 2;
      this.tentakelMalen(g, x0, y0, x0 + (x1 - x0) * anteil, y0 + (y1 - y0) * anteil, t + k * 400, 2.6 * Math.max(0.4, anteil));
    }
  }

  /** der Topf steht vor der Tür und dampft; die Tür steht einen Spalt offen */
  private topfVorDerTuer(neu: boolean) {
    const v = this.vorraum;
    if (!v) return undefined;
    const [dx, dy] = v.tuer;
    const x = dx * T + 8, y = (dy + 1) * T + 12;
    this.add.rectangle(x, dy * T + 9, 5, 13, 0x050505).setDepth(0.56); // Spalt in der Tür
    const topf = neu ? undefined : this.add.image(x, y, 'curryTopf').setScale(0.5).setDepth(y + 2);
    this.addLight(x, y - 4, 0.5, 0.55).setTint(0xff8a2a);
    this.time.addEvent({
      delay: 300, loop: true, callback: () => {
        const d = this.add.circle(x + Phaser.Math.Between(-3, 3), y - 6, 1.2, 0xf4c890, 0.5).setDepth(y + 3);
        this.tweens.add({ targets: d, y: d.y - 14, x: d.x + Phaser.Math.Between(-6, 6), scale: 2.4, alpha: 0, duration: 1100, onComplete: () => d.destroy() });
      },
    });
    return topf;
  }

  /** Curry vor die Tür: das Gitter riecht es, zuckt und zieht sich zurück. Danach Kapitel 8. */
  private async topfAbstellen() {
    const v = this.vorraum, f = state.flags;
    if (!v || this.frozen || !f.curryTopf) return;
    this.frozen = true;
    hud.prompt = '';
    const [dx, dy] = v.tuer;
    const p = this.player;
    const topf = this.add.image(p.x, p.y - 21, 'curryTopf').setScale(0.5).setDepth((dy + 1) * T + 14);
    this.topfWeg();
    f.curryTopf = false;
    f.curryAnTuer = true;
    await new Promise<void>((res) => this.tweens.add({ targets: topf, x: dx * T + 8, y: (dy + 1) * T + 12, duration: 450, ease: 'Quad.easeOut', onComplete: () => res() }));
    audio.sfx('clang');
    this.topfVorDerTuer(true);
    await this.wartet(500);
    // das Gitter schnuppert, zuckt, zieht sich zurück
    audio.sfx('growl');
    if (this.katze) floatTextGift(this, this.katze.s.x, this.katze.s.y - 14, 'Er riecht es.');
    await this.wartet(900);
    audio.sfx('roar');
    this.cameras.main.shake(2200, 0.006);
    await new Promise<void>((res) => this.tweens.add({ targets: this, gitterAnteil: 0, duration: 2400, ease: 'Quad.easeIn', onComplete: () => res() }));
    audio.sfx('rumble');
    await this.wartet(600);
    this.frozen = false;
    f.kanal = 'klaerwerk';
    this.go('Cutscene', { script: 'kapitel8', next: { scene: 'Klaerwerk' } });
  }

  /** An der Tür: Die Katze sagt, was es braucht. Danach Curry-Plan, das Rohr führt nach oben. */
  private async tuerSzene() {
    if (this.frozen) return;
    const k = this.katze, v = this.vorraum;
    if (!k || !v) return;
    this.frozen = true;
    hud.prompt = '';
    const [dx, dy] = v.tuer;
    k.modus = 'wartet';
    k.s.play('katzeKanal_lauf');
    await new Promise<void>((res) => this.tweens.add({ targets: k.s, x: (dx - 1) * T + 8, y: (dy + 1) * T + 14, duration: 600, onComplete: () => res() }));
    k.s.play('katzeKanal_sitz');
    audio.sfx('growl');
    this.frozen = false;
    this.talk('katzeTuer', () => {
      state.flags.kanal = 'curry';
      state.flags.kloAbkuerzung = true;
      hud.goal = this.goalText();
      this.toast('Das Rohr im Vorraum führt nach oben, in die Herrentoilette des Eimers. Und dann: zu Adshayan.');
    });
  }

  // ---------------------------------------------------------------- Felix wird verschlungen (Zwischensequenz in der Welt)
  // Wie Nicks Verwandlung: Kinobalken, Untertitel, Kamerafahrten. Felix rutscht durchs Rohr aus dem Eimer herunter,
  // spielt den Ermittler, ignoriert die Katze. Das Wasser blubbert, ein Tentakel packt seinen Knöchel, der Wirt schlägt
  // mit dem Haken zu, weitere Arme schießen heraus, schlagen Wirt und Katze weg. Felix krallt sich in den Boden, wird
  // geschleift, dann hebt sich der Arm mit der Geweihkrone und wickelt ihn ein. Ein Ruck, er geht unter, eine Hand
  // greift noch einmal aus der Brühe. Dann Stille. Felix ist bis Teil 2 verschwunden (felixKanal = 'verloren').

  private kino = false;
  private kinoAus = false;
  private ui?: WandlungUI;
  private kinoG?: Phaser.GameObjects.Graphics;
  private kinoTentakel: KinoArm[] = [];
  private kinoPartikel: { o: Phaser.GameObjects.Arc; vx: number; vy: number; leben: number; boden: number }[] = [];
  private kinoTropfenT = 0;
  private lampeKegel?: { g: Phaser.GameObjects.Graphics; x: number; y: number; winkel: number; an: boolean };
  private felixSprite?: Phaser.GameObjects.Sprite;
  /** Lichter und Zeitgeber der Szene (beim Überspringen weg) */
  private kinoExtras: { destroy?: () => void; remove?: () => void }[] = [];

  private tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((done) => this.tweens.add({ ...cfg, onComplete: () => done() }));
  }

  /** Untertitel zeigen und warten, bis der Spieler weiterklickt (E, Leertaste, Enter, Klick); ESC überspringt alles */
  private async sagK(wer: string, farbe: string, text: string, _ms = 0) {
    if (this.kinoAus) return;
    this.ui?.zeige(wer, farbe, text);
    this.ui?.weiterZeigen(true);
    await this.klick();
    this.ui?.weiterZeigen(false);
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

  /** Vorraum betreten mit der Katze: Felix kommt durchs Rohr */
  private vorraumPruefen() {
    const v = this.vorraum, f = state.flags, p = this.player;
    if (!v || f.felixKanal || f.kanal !== 'katze' || !this.katze || this.frozen || this.kino || this.katzeSzene) return;
    const [dx, dy] = v.tuer;
    if (p.x > (dx - 3) * T && p.x < (dx + 5) * T && p.y > (dy + 1) * T && p.y < v.wasser * T) void this.felixSzene();
  }

  private async felixSzene() {
    const v = this.vorraum!, p = this.player, k = this.katze!;
    this.kino = true;
    this.kinoAus = false;
    this.frozen = true;
    hud.prompt = '';
    p.anims.stop();
    this.scene.launch('WandlungUI');
    this.scene.bringToTop('WandlungUI');
    this.scene.sleep('Hud');
    this.ui = this.scene.get('WandlungUI') as WandlungUI;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.kinoAus = true; this.scene.stop('WandlungUI'); });
    this.input.keyboard!.once('keydown-ESC', () => this.felixEnde());
    this.kinoG = this.add.graphics();
    this.kinoTentakel = [];
    this.kinoPartikel = [];
    const cam = this.cameras.main;
    cam.stopFollow();
    const [rx, ry] = v.rohr;
    const wasserY = v.wasser * T + 2;
    const mx = v.tuer[0] * T + 16, my = wasserY - 2 * T - 4;
    cam.pan(mx, my + 6, 1000, 'Sine.easeInOut');
    cam.zoomTo(2.6, 1000, 'Sine.easeInOut');
    // Wirt und Katze links
    k.modus = 'kino';
    p.play(`${p.texture.key === 'wirtKanal' ? 'wirtKanal' : 'wirt'}_side`);
    void this.tw({ targets: p, x: mx - 38, y: my - 6, duration: 800 }).then(() => { p.anims.stop(); p.setFlipX(false).setFrame(6); });
    k.s.play('katzeKanal_lauf');
    void this.tw({ targets: k.s, x: mx - 54, y: my + 6, duration: 800, onUpdate: () => k.s.setDepth(k.s.y) }).then(() => k.s.play('katzeKanal_sitz').setFlipX(false));
    audio.music('spannung');
    await this.wartet(900);
    if (this.kinoAus) return;

    // ---- 1. Felix fällt aus dem Rohr
    const fx = rx * T + 8, fy = (ry + 1) * T + 14;
    const felix = this.add.sprite(fx, fy - 30, 'polizist', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(fy);
    this.felixSprite = felix;
    const muetze = this.add.image(fx, fy - 18, 'felixMuetze').setScale(0.5).setVisible(false);
    this.lampeKegel = { g: this.add.graphics().setDepth(5001).setBlendMode(Phaser.BlendModes.ADD), x: fx, y: fy, winkel: Math.PI / 2, an: true };
    const lampeLicht = this.addLight(fx, fy, 0.5, 0.7).setTint(0xfff4c0);
    this.kinoExtras.push(lampeLicht);
    this.tweens.killTweensOf(lampeLicht);
    audio.sfx('rumble');
    await this.wartet(500);
    await this.tw({ targets: felix, y: fy, duration: 420, ease: 'Quad.easeIn' });
    if (this.kinoAus) return;
    audio.sfx('thud');
    cam.shake(160, 0.004);
    felix.setScale(0.6, 0.38);
    this.tweens.add({ targets: felix, scaleX: 0.5, scaleY: 0.5, duration: 260, ease: 'Back.easeOut' });
    this.staub(fx, fy);
    await this.sagK('FELIX', '#7aa8ff', 'Ich wusste es. Ein Wirt im Kanal. Das Profil passt.', 2600);
    if (this.kinoAus) return;
    // er geht in die Mitte, zückt den Notizblock
    felix.play('polizist_down');
    await this.tw({ targets: felix, x: mx + 6, y: my, duration: 900, onUpdate: () => { felix.setDepth(felix.y); this.kegelSetzen(felix.x, felix.y, Math.PI / 2 + 0.6); } });
    felix.anims.stop();
    felix.setFrame(6).setFlipX(true);
    this.kegelSetzen(felix.x, felix.y, Math.PI);
    const block = this.add.image(felix.x - 5, felix.y - 9, 'felixBlock').setScale(0.4).setDepth(felix.y + 1);
    await this.sagK('FELIX', '#7aa8ff', 'Dr. von Glanz: verschwunden. Bianca: verschwunden. Ein Stripper: verschwunden. Und wo steckt der Wirt? Im Kanal.', 3400);
    if (this.kinoAus) return;
    audio.sfx('growl');
    k.s.setFrame(6);
    this.time.delayedCall(500, () => k.s.play('katzeKanal_sitz'));
    await this.sagK('FELIX', '#7aa8ff', 'Und ... was ist DAS? Eine Katze? Mit so vielen ... Zähnen?', 2600);
    await this.sagK('KATZE', '#b8f060', 'Weg vom Wasser, Bulle.', 2000);
    await this.sagK('FELIX', '#7aa8ff', 'Hier gebe ich die Anweisungen! Ausweise, bitte. Alle beide.', 2600);
    if (this.kinoAus) return;

    // ---- 2. Das Wasser blubbert
    audio.music('none');
    const glut = this.addLight(mx, wasserY + 8, 0.2, 0.2).setTint(0x6aff4a);
    this.kinoExtras.push(glut);
    this.tweens.killTweensOf(glut);
    this.tweens.add({ targets: glut, scale: 1.4, alpha: 0.75, duration: 3500 });
    const blubberCb = () => this.blase2(mx + Phaser.Math.Between(-56, 56), wasserY + Phaser.Math.Between(3, 22));
    const blubber = this.time.addEvent({ delay: 110, loop: true, callback: blubberCb });
    const blubberTakt = (delay: number) => blubber.reset({ delay, loop: true, callback: blubberCb });
    const gurgel = this.time.addEvent({ delay: 600, loop: true, callback: () => audio.sfx('gurgle') });
    this.kinoExtras.push(blubber, gurgel);
    await this.sagK('WIRT', '#f4ead0', 'Felix. Ganz langsam. Komm zu mir. Jetzt.', 2300);
    if (this.kinoAus) return;
    felix.setFlipX(false).setFrame(0);
    this.kegelSetzen(felix.x, felix.y, Math.PI / 2);
    await this.sagK('FELIX', '#7aa8ff', 'Wieso? Ist doch nur Wasser. Ich kann schwimmen. Bronze.', 2400);
    if (this.kinoAus) return;
    cam.shake(900, 0.0025);
    await this.wartet(900);
    if (this.kinoAus) return;

    // ---- 3. Der Ausbruch: ein Arm packt den Knöchel
    audio.music('monster');
    audio.sfx('roar');
    audio.sfx('splash');
    cam.flash(160, 90, 255, 70);
    cam.shake(500, 0.009);
    this.spritzer(mx - 6, wasserY + 4, 26, 220);
    blubberTakt(50);
    const fuss = () => ({ x: felix.x, y: felix.y - 2 });
    const a1 = this.armNeu(mx - 10, wasserY + 6, 6, 0.3);
    a1.ziel = fuss;
    await this.tw({ targets: a1, anteil: 1, duration: 260, ease: 'Quad.easeOut' });
    if (this.kinoAus) return;
    a1.wickel = { ziel: fuss, breite: 8, hoehe: 4, schlingen: 1 };
    // Felix knallt hin: liegend, Kopf vom Wasser weg, Block und Mütze fliegen
    felix.setTexture('felixLiegt', 2).setOrigin(0.5, 1).setScale(0.5);
    audio.sfx('scream');
    this.flug(block, felix.x + 26, felix.y - 22, 720);
    muetze.setVisible(true).setPosition(felix.x, felix.y - 22).setDepth(felix.y + 2);
    this.flug(muetze, felix.x + 14, felix.y - 12, 540);
    await this.tw({ targets: felix, y: felix.y + 8, duration: 220, ease: 'Quad.easeIn' });
    this.kegelSetzen(felix.x + 4, felix.y - 14, -Math.PI / 2 + 0.4);
    this.kratzerBeginnen(felix);
    await this.ziehen(felix, 10, 700);
    await this.sagK('FELIX', '#ff8a7a', 'AAAH! Herr Wirt! Das ist ... das ist eine dienstliche Bitte! HILFE!');
    if (this.kinoAus) return;

    // ---- 4. Der Wirt schlägt zu, die anderen Arme kommen
    p.play(`${p.texture.key === 'wirtKanal' ? 'wirtKanal' : 'wirt'}_side`);
    await this.tw({ targets: p, x: felix.x - 14, y: felix.y - 8, duration: 450 });
    p.anims.stop();
    p.setFrame(6).setFlipX(false);
    for (let i = 0; i < 3; i++) {
      if (this.kinoAus) return;
      await this.tw({ targets: p, angle: 18, duration: 90, yoyo: true });
      audio.sfx('stab');
      cam.shake(110, 0.005);
      a1.zuck = 400;
      floatTextGift(this, felix.x + 2, felix.y - 22, ['KLONK!', 'ZACK!', 'BÄM!'][i]);
      this.spritzer(felix.x, felix.y - 2, 5, 70, 0x6ad04a);
      await this.wartet(240);
    }
    await this.sagK('WIRT', '#f4ead0', 'Lass! Ihn! LOS!');
    if (this.kinoAus) return;
    const bauch = () => ({ x: felix.x, y: felix.y - 12 });
    const a2 = this.armNeu(mx + 18, wasserY + 8, 5.5, 2.1);
    a2.ziel = bauch;
    audio.sfx('splash');
    this.spritzer(mx + 18, wasserY + 4, 14, 160);
    await this.tw({ targets: a2, anteil: 1, duration: 300, ease: 'Quad.easeOut' });
    a2.wickel = { ziel: bauch, breite: 10, hoehe: 7, schlingen: 2 };
    // ein Arm fegt den Wirt weg
    const a3 = this.armNeu(mx - 30, wasserY + 6, 5, 4.2);
    a3.ziel = () => ({ x: p.x + 2, y: p.y - 8 });
    audio.sfx('splash');
    await this.tw({ targets: a3, anteil: 1, duration: 230, ease: 'Quad.easeOut' });
    audio.sfx('slap');
    cam.shake(260, 0.01);
    a3.ziel = () => ({ x: mx - 40 + Math.sin(this.time.now / 520) * 12, y: my - 20 + Math.cos(this.time.now / 430) * 10 });
    void this.tw({ targets: p, x: p.x - 30, y: p.y - 6, angle: -360, duration: 520, ease: 'Quad.easeOut' }).then(() => { p.setAngle(0); this.staub(p.x, p.y); audio.sfx('thud'); });
    await this.sagK('WIRT', '#f4ead0', 'UFF!');
    // die Katze springt einen Arm an und wird weggeschleudert
    if (this.kinoAus) return;
    k.s.anims.stop();
    k.s.setFrame(6).setFlipX(false);
    await this.tw({ targets: k.s, x: felix.x - 4, y: felix.y - 2, duration: 260, ease: 'Quad.easeOut', onUpdate: () => k.s.setDepth(k.s.y + 3) });
    audio.sfx('chomp');
    a2.zuck = 500;
    floatTextGift(this, k.s.x, k.s.y - 14, 'FAUCH!');
    await this.wartet(380);
    const a4 = this.armNeu(mx + 34, wasserY + 8, 4.5, 5.3);
    a4.ziel = () => ({ x: k.s.x, y: k.s.y - 4 });
    await this.tw({ targets: a4, anteil: 1, duration: 200 });
    audio.sfx('slap');
    void this.tw({ targets: k.s, x: mx - 58, y: my + 4, angle: 540, duration: 600, ease: 'Quad.easeOut' }).then(() => { k.s.setAngle(0).play('katzeKanal_sitz'); audio.sfx('growl'); this.staub(k.s.x, k.s.y); });
    a4.ziel = () => ({ x: mx + 34 + Math.sin(this.time.now / 470 + 1) * 12, y: my - 24 + Math.cos(this.time.now / 390) * 10 });
    await this.wartet(500);
    if (this.kinoAus) return;

    // ---- 5. Felix wird geschleift, krallt sich in den Boden; die Taschenlampe rollt weg
    const lampe = this.add.image(felix.x + 6, felix.y - 16, 'kanalTaschenlampe').setScale(0.5).setDepth(felix.y);
    if (this.lampeKegel) this.lampeKegel.an = false;
    lampeLicht.setVisible(false);
    this.tweens.add({ targets: lampe, x: lampe.x + 22, y: lampe.y - 6, angle: 400, duration: 900, ease: 'Quad.easeOut', onComplete: () => { this.lampeKegel = { g: this.lampeKegel!.g, x: lampe.x, y: lampe.y, winkel: Math.PI / 2 + 0.5, an: true }; lampe.setAngle(150); } });
    await this.sagK('FELIX', '#ff8a7a', 'Nein ... nein, nein, NEIN! Ich hab nichts gesehen! Ich hab NICHTS GESEHEN!');
    for (let i = 0; i < 5; i++) {
      if (this.kinoAus) return;
      felix.setFrame(i % 2);
      a1.zuck = 200;
      a2.zuck = 200;
      await this.ziehen(felix, 6, 380);
      await this.wartet(160);
    }
    if (this.kinoAus) return;

    // ---- 6. Die Krone: ein riesiger Arm mit Geweih hebt sich über ihn
    blubberTakt(160);
    this.tweens.add({ targets: cam, zoom: 3.1, duration: 2400, ease: 'Sine.easeInOut' });
    cam.pan(felix.x, felix.y - 22, 2400, 'Sine.easeInOut');
    // der große Arm (ohne Geweih: das Wesen selbst wird noch gestaltet)
    const krone = this.armNeu(mx + 4, wasserY + 10, 9, 0.9, false);
    krone.ziel = () => ({ x: felix.x + 6, y: felix.y - 58 });
    audio.sfx('splash');
    this.spritzer(mx + 4, wasserY + 4, 30, 240);
    await this.tw({ targets: krone, anteil: 1, duration: 1400, ease: 'Sine.easeOut' });
    for (let i = 0; i < 3; i++) { this.time.delayedCall(i * 520, () => { audio.sfx('thud'); cam.shake(120, 0.003); }); }
    await this.sagK('KATZE', '#b8f060', 'Das ist er. Nicht alles von ihm. Nur ein Arm.', 1700);
    if (this.kinoAus) return;
    felix.setFrame(2);
    audio.sfx('scream');
    await this.sagK('FELIX', '#ff8a7a', 'MAMAAAA!');
    if (this.kinoAus) return;
    // sie schlägt zu und wickelt ihn ganz ein
    // der Kopf mit der Krone bleibt über ihm, die Schlingen legen sich um den Körper; sein Gesicht bleibt frei
    krone.ziel = () => ({ x: felix.x + 22, y: felix.y - 30 });
    await this.tw({ targets: krone, zuck: 0, duration: 160 });
    audio.sfx('slap');
    cam.flash(120, 120, 255, 90);
    cam.shake(300, 0.012);
    krone.wickel = { ziel: () => ({ x: felix.x, y: felix.y - 8 }), breite: 11, hoehe: 12, schlingen: 3 };
    this.tweens.add({ targets: felix, scaleX: 0.42, duration: 180, yoyo: true, repeat: 3 });
    await this.wartet(900);
    if (this.kinoAus) return;

    // ---- 7. Ein Ruck. Unter Wasser.
    audio.sfx('roar');
    const bisZumWasser = wasserY - felix.y + 4;
    await this.ziehen(felix, Math.max(6, bisZumWasser), 520);
    audio.sfx('splash');
    audio.sfx('splash');
    cam.shake(600, 0.014);
    cam.flash(200, 60, 160, 60);
    this.spritzer(felix.x, wasserY + 2, 46, 300);
    await this.untertauchen(felix, wasserY, 26, 600);
    felix.setVisible(false);
    for (const a of this.kinoTentakel) a.wickel = undefined;
    blubberTakt(40);
    await this.wartet(500);
    if (this.kinoAus) return;
    // eine Hand greift noch einmal aus der Brühe
    const hand = this.add.sprite(felix.x, wasserY + 10, 'felixHand', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(wasserY + 12);
    await this.tw({ targets: hand, y: wasserY + 1, duration: 420, ease: 'Quad.easeOut' });
    this.ui?.zeige('', '#f4ead0', '');
    for (let i = 0; i < 4; i++) { hand.setFrame(i % 2); await this.wartet(200); }
    audio.sfx('splash');
    await this.tw({ targets: hand, y: wasserY + 14, alpha: 0, duration: 260, ease: 'Quad.easeIn' });
    hand.destroy();
    this.spritzer(felix.x, wasserY + 2, 12, 120);
    // die Arme ziehen sich zurück, zuletzt die Krone
    for (const a of [a4, a3, a1, a2]) void this.tw({ targets: a, anteil: 0, duration: 700, ease: 'Quad.easeIn' });
    await this.wartet(500);
    await this.tw({ targets: krone, anteil: 0, duration: 1600, ease: 'Sine.easeIn' });
    blubberTakt(260);
    gurgel.remove();
    this.time.delayedCall(1400, () => blubber.remove());
    this.tweens.add({ targets: glut, alpha: 0, duration: 1600 });
    // die Mütze treibt auf
    this.tweens.killTweensOf(muetze);
    muetze.setPosition(felix.x + 10, wasserY + 10).setDepth(wasserY + 11).setAlpha(0);
    this.tweens.add({ targets: muetze, alpha: 1, y: wasserY + 8, duration: 900, delay: 900 });
    audio.music('none');
    this.tweens.add({ targets: cam, zoom: 2.6, duration: 1800, ease: 'Sine.easeInOut' });
    cam.pan(mx - 10, my - 10, 1800, 'Sine.easeInOut');
    await this.wartet(2200);
    if (this.kinoAus) return;

    // ---- 8. Stille
    await this.sagK('KATZE', '#b8f060', 'Ich hab\'s ihm gesagt.', 2400);
    await this.sagK('WIRT', '#f4ead0', '...', 1600);
    await this.sagK('KATZE', '#b8f060', 'Es wird stärker, Wirt. Und satter. Komm.', 2800);
    this.felixEnde();
  }

  /** Ende der Szene (auch beim Überspringen): Felix ist weg, seine Sachen bleiben liegen */
  private felixEnde() {
    if (!this.kino) return;
    this.kino = false;
    this.kinoAus = true;
    this.events.emit('kinoAus');
    state.flags.felixKanal = 'verloren';
    this.ui?.leer();
    this.scene.stop('WandlungUI');
    this.scene.wake('Hud');
    this.kinoG?.destroy();
    this.kinoG = undefined;
    this.kinoTentakel = [];
    for (const t of this.kinoPartikel) t.o.destroy();
    this.kinoPartikel = [];
    this.lampeKegel?.g.destroy();
    this.lampeKegel = undefined;
    this.felixSprite?.destroy();
    this.felixSprite = undefined;
    this.kratzG?.destroy();
    this.kratzG = undefined;
    for (const x of this.kinoExtras) { x.remove?.(); x.destroy?.(); }
    this.kinoExtras = [];
    // alles, was die Szene in die Welt gestellt hat (Block, Mütze, Lampe, Hand), räumen die Reste neu auf
    this.children.list.filter((o) => ['felixBlock', 'felixMuetze', 'felixHand', 'kanalTaschenlampe', 'polizist', 'felixLiegt'].includes((o as Phaser.GameObjects.Image).texture?.key)).forEach((o) => o.destroy());
    this.felixReste();
    const p = this.player, k = this.katze;
    this.tweens.killTweensOf(p);
    p.setAngle(0).setScale(0.5).setAlpha(1);
    if (k) { this.tweens.killTweensOf(k.s); k.s.setAngle(0); k.modus = 'folgt'; }
    const cam = this.cameras.main;
    cam.zoomTo(2, 600);
    cam.startFollow(p, true, 0.12, 0.12);
    audio.music('kanal');
    this.frozen = false;
    hud.goal = this.goalText();
  }

  /** was von Felix bleibt: Kratzspuren zum Wasser, die Taschenlampe am Boden, die Mütze im Wasser */
  private felixReste() {
    const v = this.vorraum;
    if (!v) return;
    const wasserY = v.wasser * T + 2, mx = v.tuer[0] * T + 16, my = wasserY - 2 * T - 4;
    const g = this.add.graphics().setDepth(0.7);
    for (let i = 0; i < 4; i++) {
      for (const sx of [-4, 4]) {
        const x = mx + 6 + sx + i * 1.2 - 2;
        g.lineStyle(0.7, 0x141a1c, 0.9).lineBetween(x, my - 18, x + Math.sin(i) * 2, wasserY - 2);
      }
    }
    for (let i = 0; i < 6; i++) { g.fillStyle(0x3aa02a, 0.85).fillEllipse(mx + 6 + Phaser.Math.Between(-5, 5), my - 10 + i * 6, 5, 2.4); }
    const lx = mx + 30, ly = my - 18;
    this.add.image(lx, ly, 'kanalTaschenlampe').setScale(0.5).setAngle(150).setDepth(ly);
    this.addLight(lx + 3, ly + 8, 0.55, 0.55).setTint(0xfff4c0);
    this.interacts.push({ x: lx, y: ly + 4, r: 14, label: () => 'Taschenlampe', act: () => this.toast('Felix\' Taschenlampe. Sie leuchtet aufs Wasser. Als würde sie noch auf ihn warten.') });
    const m = this.add.image(mx + 16, wasserY + 8, 'felixMuetze').setScale(0.5).setDepth(wasserY + 9);
    this.tweens.add({ targets: m, y: m.y + 1, angle: 8, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.interacts.push({ x: m.x, y: wasserY - 4, r: 14, label: () => 'Mütze', act: () => this.toast('Felix\' Dienstmütze. Sie treibt im Kreis. Das Abzeichen glänzt noch.') });
  }

  /** neuer Tentakelarm aus dem Wasser (anteil: wie weit er herausgeschossen ist) */
  private armNeu(bx: number, by: number, dicke: number, phase: number, geweih = false): KinoArm {
    const a: KinoArm = { bx, by, dicke, phase, geweih, anteil: 0, zuck: 0, ziel: () => ({ x: bx, y: by - 30 }) };
    this.kinoTentakel.push(a);
    return a;
  }

  /** Felix ein Stück Richtung Wasser schleifen (mit Kratzspuren) */
  private async ziehen(felix: Phaser.GameObjects.Sprite, weit: number, ms: number) {
    audio.sfx('rummage');
    await this.tw({ targets: felix, y: felix.y + weit, duration: ms, ease: 'Quad.easeIn', onUpdate: () => { felix.setDepth(felix.y); this.kratzer(felix); } });
  }

  private kratzG?: Phaser.GameObjects.Graphics;
  private kratzLetzt?: { x: number; y: number };
  private kratzerBeginnen(felix: Phaser.GameObjects.Sprite) {
    this.kratzG = this.add.graphics().setDepth(0.75);
    this.kratzLetzt = { x: felix.x, y: felix.y - 22 };
  }
  private kratzer(felix: Phaser.GameObjects.Sprite) {
    const g = this.kratzG, l = this.kratzLetzt;
    if (!g || !l) return;
    const x = felix.x, y = felix.y - 22;
    for (const sx of [-4, 4]) for (let i = 0; i < 3; i++) g.lineStyle(0.6, 0x101416, 0.9).lineBetween(l.x + sx + i - 1, l.y, x + sx + i - 1, y);
    // Schleimspur in Abständen, nicht als durchgehender Balken
    if (Math.abs(y - l.y) >= 3 || Math.random() < 0.15) g.fillStyle(0x2e7a22, 0.45).fillEllipse(x + Phaser.Math.Between(-2, 2), y + 10, Phaser.Math.Between(3, 6), 1.6);
    this.kratzLetzt = { x, y };
  }

  /** Felix versinkt: der Teil unter der Wasserlinie wird abgeschnitten */
  private async untertauchen(felix: Phaser.GameObjects.Sprite, wasserY: number, tiefe: number, ms: number) {
    const fh = felix.frame.height;
    await this.tw({
      targets: felix, y: felix.y + tiefe, duration: ms, ease: 'Quad.easeIn',
      onUpdate: () => {
        const ueber = Math.max(0, (wasserY - (felix.y - (fh * 0.5))) * 2);
        felix.setCrop(0, 0, felix.frame.width, Math.min(fh, ueber));
      },
    });
  }

  /** etwas fliegt im Bogen und dreht sich (Block, Mütze) */
  private flug(o: Phaser.GameObjects.Image, x: number, y: number, ms: number) {
    this.tweens.add({ targets: o, x, duration: ms, ease: 'Linear' });
    this.tweens.add({ targets: o, y: Math.min(o.y, y) - 14, duration: ms * 0.45, ease: 'Quad.easeOut', yoyo: false, onComplete: () => this.tweens.add({ targets: o, y, duration: ms * 0.55, ease: 'Quad.easeIn' }) });
    this.tweens.add({ targets: o, angle: 540, duration: ms });
  }

  private staub(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const s = this.add.image(x + Phaser.Math.Between(-4, 4), y - 1, 'light').setTint(0xa89888).setAlpha(0.4).setScale(0.03).setDepth(y + 2);
      this.tweens.add({ targets: s, x: s.x + Phaser.Math.Between(-10, 10), y: s.y - Phaser.Math.Between(2, 7), scale: 0.1, alpha: 0, duration: 600, onComplete: () => s.destroy() });
    }
  }

  /** eine Blase steigt auf und platzt (mit Ring) */
  private blase2(x: number, y: number) {
    const b = this.add.circle(x, y, Phaser.Math.FloatBetween(0.6, 1.6), 0x8ac880, 0.85).setStrokeStyle(0.4, 0xd8ffd0, 0.9).setDepth(y + 1);
    this.tweens.add({
      targets: b, scale: 1.6, duration: Phaser.Math.Between(200, 420), onComplete: () => {
        const r = this.add.ellipse(b.x, b.y, 3, 1.2).setStrokeStyle(0.5, 0xa8d8a0, 0.8).setDepth(b.depth);
        this.tweens.add({ targets: r, scaleX: 3, scaleY: 2.4, alpha: 0, duration: 500, onComplete: () => r.destroy() });
        b.destroy();
      },
    });
  }

  /** Spritzer: Tropfen fliegen hoch und fallen zurück (Schwerkraft im kinoUpdate) */
  private spritzer(x: number, y: number, n: number, kraft: number, farbe = 0x8ab878) {
    for (let i = 0; i < n; i++) {
      const o = this.add.circle(x + Phaser.Math.Between(-6, 6), y, Phaser.Math.FloatBetween(0.6, 1.8), i % 4 ? farbe : 0xd8f0d0, 0.95).setDepth(y + 20);
      const w = Phaser.Math.FloatBetween(-Math.PI * 0.9, -Math.PI * 0.1);
      const v = kraft * Phaser.Math.FloatBetween(0.4, 1);
      this.kinoPartikel.push({ o, vx: Math.cos(w) * v * 0.6, vy: Math.sin(w) * v, leben: 1.4, boden: y + Phaser.Math.Between(0, 10) });
    }
  }

  /** Lichtkegel von Felix' Taschenlampe setzen */
  private kegelSetzen(x: number, y: number, winkel: number) {
    if (!this.lampeKegel) return;
    Object.assign(this.lampeKegel, { x, y: y - 8, winkel });
  }

  /** jedes Bild: Tentakel, Wickel, Tropfen, Spritzer, Lichtkegel */
  private kinoUpdate(t: number, delta: number) {
    const dt = delta / 1000;
    for (let i = this.kinoPartikel.length - 1; i >= 0; i--) {
      const q = this.kinoPartikel[i];
      q.vy += 520 * dt;
      q.o.x += q.vx * dt;
      q.o.y += q.vy * dt;
      q.leben -= dt;
      if ((q.vy > 0 && q.o.y >= q.boden) || q.leben <= 0) { q.o.destroy(); this.kinoPartikel.splice(i, 1); }
    }
    const lk = this.lampeKegel;
    if (lk) {
      lk.g.clear();
      if (lk.an) {
        const a = lk.winkel, l = 46, s = 0.42;
        lk.g.fillStyle(0xfff4c0, 0.14).fillTriangle(lk.x, lk.y, lk.x + Math.cos(a - s) * l, lk.y + Math.sin(a - s) * l, lk.x + Math.cos(a + s) * l, lk.y + Math.sin(a + s) * l);
        lk.g.fillStyle(0xfff4c0, 0.1).fillTriangle(lk.x, lk.y, lk.x + Math.cos(a - s * 0.5) * l * 0.8, lk.y + Math.sin(a - s * 0.5) * l * 0.8, lk.x + Math.cos(a + s * 0.5) * l * 0.8, lk.y + Math.sin(a + s * 0.5) * l * 0.8);
      }
    }
    const g = this.kinoG;
    if (!g) return;
    g.clear();
    g.setDepth((this.felixSprite?.depth ?? 0) + 2);
    for (const a of this.kinoTentakel) {
      if (a.anteil <= 0.01) continue;
      a.zuck = Math.max(0, a.zuck - delta);
      const z = a.ziel();
      this.armMalen(g, a, z, t);
      if (a.wickel && a.anteil > 0.95) {
        const w = a.wickel, c = w.ziel();
        this.wickelMalen(g, c.x, c.y, w.breite, w.hoehe, w.schlingen, Math.min(a.dicke * 0.55, 3.2), t + a.phase * 300);
      }
    }
    // Schleim tropft von den Armen
    this.kinoTropfenT -= delta;
    if (this.kinoTropfenT <= 0 && this.kinoTentakel.some((a) => a.anteil > 0.3)) {
      this.kinoTropfenT = 110;
      const a = Phaser.Utils.Array.GetRandom(this.kinoTentakel.filter((x) => x.anteil > 0.3 && x.pts?.length));
      const q = a?.pts ? Phaser.Utils.Array.GetRandom(a.pts) : undefined;
      if (q) {
        const tr = this.add.circle(q.x + Phaser.Math.FloatBetween(-1, 1), q.y + 1, Phaser.Math.FloatBetween(0.5, 0.9), 0x6ad04a, 0.9).setDepth(g.depth + 1);
        this.kinoPartikel.push({ o: tr, vx: 0, vy: 0, leben: 1.2, boden: q.y + Phaser.Math.Between(10, 26) });
      }
    }
  }

  /**
   * Ein Arm: Bezierkurve von der Wasserstelle zum Ziel, wellig, zur Spitze dünn. Dunkle Haut oben, blasse Unterseite
   * mit Saugnäpfen, Glanzlichter, Ringfalten, eingerollte Spitze. Der große Arm trägt eine Geweihkrone.
   */
  private armMalen(g: Phaser.GameObjects.Graphics, a: KinoArm, z: { x: number; y: number }, t: number) {
    const n = 30, anteil = Math.min(1, a.anteil);
    const bx = a.bx, by = a.by, ex = z.x, ey = z.y;
    // Kontrollpunkt: hoch über der Mitte, damit der Arm sich aus dem Wasser wölbt
    const len = Math.hypot(ex - bx, ey - by);
    const cx = (bx + ex) / 2 + Math.sin(a.phase * 2.3) * 18 + Math.sin(t / 900 + a.phase) * 10, cy = Math.min(by, ey) - 18 - a.dicke * 2;
    const pts: { x: number; y: number; r: number; nx: number; ny: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const u = (i / n) * anteil;
      let x = (1 - u) * (1 - u) * bx + 2 * (1 - u) * u * cx + u * u * ex;
      let y = (1 - u) * (1 - u) * by + 2 * (1 - u) * u * cy + u * u * ey;
      // Tangente und Normale
      const tx = 2 * (1 - u) * (cx - bx) + 2 * u * (ex - cx), ty = 2 * (1 - u) * (cy - by) + 2 * u * (ey - cy);
      const tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
      // Wellen, Zucken (nach einem Schlag), am Ende eingerollt
      const welle = Math.sin(u * 7 - t / 140 + a.phase) * (2.6 + len / 26) * Math.sin(u * Math.PI) + (a.zuck > 0 ? Math.sin(u * 14 + t / 30) * 3.5 * (a.zuck / 500) : 0);
      x += nx * welle;
      y += ny * welle;
      if (u > anteil - 0.12 && !a.wickel) { const k = (u - (anteil - 0.12)) / 0.12; x += Math.cos(t / 200 + a.phase) * k * 3; y -= k * k * 3; }
      pts.push({ x, y, r: Math.max(0.7, a.dicke * Math.pow(1 - u * 0.82, 1.1)), nx, ny });
    }
    a.pts = pts;
    // Umriss, Körper, Unterseite, Glanz, Falten, Saugnäpfe
    for (const q of pts) g.fillStyle(0x24081c, 1).fillCircle(q.x, q.y, q.r + 0.9);
    for (const q of pts) g.fillStyle(0x5e2050, 1).fillCircle(q.x, q.y, q.r);
    for (const q of pts) g.fillStyle(0xc87898, 1).fillCircle(q.x + q.nx * q.r * 0.45, q.y + q.ny * q.r * 0.45, q.r * 0.52);
    pts.forEach((q, i) => {
      g.fillStyle(0x9a4a88, 0.9).fillCircle(q.x - q.nx * q.r * 0.42, q.y - q.ny * q.r * 0.42, q.r * 0.34);
      if (i % 5 === 2) g.fillStyle(0xf8d8ec, 0.7).fillCircle(q.x - q.nx * q.r * 0.5, q.y - q.ny * q.r * 0.5, Math.max(0.4, q.r * 0.14));
      if (i % 3 === 0 && q.r > 1.4) g.lineStyle(0.5, 0x2a0a22, 0.55).lineBetween(q.x - q.nx * q.r * 0.9, q.y - q.ny * q.r * 0.9, q.x + q.nx * q.r * 0.1, q.y + q.ny * q.r * 0.1);
      if (i % 2 === 1 && i < pts.length - 1) {
        const sx = q.x + q.nx * q.r * 0.72, sy = q.y + q.ny * q.r * 0.72, sr = Math.max(0.6, q.r * 0.3);
        g.fillStyle(0xf4c8d8, 1).fillCircle(sx, sy, sr);
        g.fillStyle(0x6a1a4a, 1).fillCircle(sx, sy, sr * 0.5);
      }
    });
    // Schleimglanz und Austrittsstelle im Wasser
    g.fillStyle(0xc8ffb0, 0.35).fillCircle(pts[Math.floor(n * 0.4 * anteil)].x - 1, pts[Math.floor(n * 0.4 * anteil)].y - 1, 1.2);
    g.fillStyle(0x3aa02a, 0.9).fillEllipse(bx, by, a.dicke * 3, a.dicke * 1.1);
    g.fillStyle(0xa8ff8a, 0.6).fillEllipse(bx - 1, by - 0.5, a.dicke * 1.6, a.dicke * 0.4);
    // Geweihkrone an der Spitze des großen Arms
    if (a.geweih && anteil > 0.6) {
      const s = pts[pts.length - 1];
      const zweig = (x0: number, y0: number, w: number, l: number, dick: number) => {
        const x1 = x0 + Math.cos(w) * l, y1 = y0 + Math.sin(w) * l;
        g.lineStyle(dick + 1.4, 0x2a2418, 1).lineBetween(x0, y0, x1, y1);
        g.lineStyle(dick, 0xddd4b2, 1).lineBetween(x0, y0, x1, y1);
        return { x: x1, y: y1 };
      };
      for (const seite of [-1, 1]) {
        const w0 = -Math.PI / 2 + seite * 0.55 + Math.sin(t / 400) * 0.05;
        const m = zweig(s.x, s.y, w0, 9, 1.6);
        zweig(m.x, m.y, w0 + seite * 0.5, 6, 1.1);
        zweig(m.x, m.y, w0 - seite * 0.45, 5, 1);
        const m2 = zweig(s.x + seite * 2, s.y - 3, w0 - seite * 0.3, 5, 1.2);
        zweig(m2.x, m2.y, w0 + seite * 0.7, 3, 0.8);
      }
      g.fillStyle(0xff3a10, 1).fillCircle(s.x - 1.5, s.y + 1, 0.9);
      g.fillStyle(0xff3a10, 1).fillCircle(s.x + 1.5, s.y + 1, 0.9);
    }
  }

  /** Schlingen um einen Körper: nur die vordere Hälfte jeder Schlinge ist sichtbar, mit Saugnäpfen nach innen */
  private wickelMalen(g: Phaser.GameObjects.Graphics, cx: number, cy: number, breite: number, hoehe: number, schlingen: number, dicke: number, t: number) {
    for (let k = 0; k < schlingen; k++) {
      const yk = cy - hoehe / 2 + ((k + 0.5) * hoehe) / schlingen + Math.sin(t / 160 + k) * 0.6;
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 12; i++) {
        const w = (i / 12) * Math.PI;
        pts.push({ x: cx + Math.cos(w) * (breite / 2 + 1), y: yk + Math.sin(w) * 2.4 });
      }
      for (const q of pts) g.fillStyle(0x24081c, 1).fillCircle(q.x, q.y, dicke + 0.8);
      for (const q of pts) g.fillStyle(0x5e2050, 1).fillCircle(q.x, q.y, dicke);
      pts.forEach((q, i) => {
        g.fillStyle(0x9a4a88, 0.9).fillCircle(q.x, q.y - dicke * 0.4, dicke * 0.4);
        if (i % 3 === 1) { g.fillStyle(0xf4c8d8, 1).fillCircle(q.x, q.y + dicke * 0.55, Math.max(0.5, dicke * 0.32)); g.fillStyle(0x6a1a4a, 1).fillCircle(q.x, q.y + dicke * 0.55, Math.max(0.3, dicke * 0.15)); }
      });
    }
  }

  /** hinter dem Rostgitter: der Auftritt der Katze */
  private katzeAuftrittPruefen() {
    const f = state.flags, p = this.player, z = this.gitterPos;
    if (!z || f.kanal !== 'unten' || !f.kanalGitterOffen || this.katze || this.katzeSzene || this.frozen || this.ohnmacht) return;
    if (p.x > (z[0] + 2) * T && p.x < (z[0] + 9) * T && p.y > (z[1] - 1) * T && p.y < (z[1] + 3) * T) void this.katzeAuftritt();
  }

  /** Musik: in der Schieberkammer ruhiger, mit Glockenspiel */
  private musikPruefen() {
    const k = this.kammerTiles[0]?.[0];
    if (!k) return;
    const p = this.player;
    const drin = p.x >= (k[0] - 1) * T && p.y >= (k[1] - 3) * T && p.y < (k[1] + 12) * T;
    if (drin !== this.inKammer) {
      this.inKammer = drin;
      audio.music(drin ? 'schleuse' : 'kanal');
    }
  }
}

/** kleiner Text über dem Wirt (Quaken, Schmatzen) */
function floatTextGift(scene: Phaser.Scene, x: number, y: number, s: string) {
  const t = scene.add.text(x, y, s, { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#b8f060', stroke: '#120c0b', strokeThickness: 3 })
    .setOrigin(0.5, 1).setResolution(2).setScale(0.5).setDepth(6000);
  scene.tweens.add({ targets: t, y: y - 12, alpha: 0, duration: 800, onComplete: () => t.destroy() });
}
