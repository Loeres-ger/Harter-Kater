import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { floatText } from '../ui';
import type { Interact } from '../scenes/TopDown';
import { Kachel, erreichbar, geradeFrei, weg } from './wege';

// Leute auf der Straße: zehn Passanten, die mit echter Wegsuche durch die ganze Stadt laufen, und (im freien Spiel)
// zwei weitere Streifenpolizisten. Passanten suchen sich Ziele (Mülltonnen, Bänke, Türen, Laternen, Park), bleiben
// dort eine Weile, weichen einander und dem Wirt aus. Wer eine Leiche sieht, schreit, rennt weg und ruft die Polizei.

const T = 16;

/**
 * Schalter für alle neuen Straßenfiguren: zehn Passanten, Desirée und Roxy, Petra und Kai, Zeugen, die die Polizei
 * rufen. Vorerst AUS (Wunsch: kommt erst, wenn das Spiel sonst fertig ist). Auf true setzen, dann ist alles wieder da;
 * Grafiken (passantenGfx), Dialoge (dame2, dame3 in dialog/data) und Felix' Einsatz (AlleyScene) liegen schon bereit.
 */
export const STRASSEN_NPCS = false;

/** Was die Gasse dem System zur Verfügung stellt */
export interface Welt {
  scene: Phaser.Scene;
  solid: boolean[][];
  rows: string[];
  player: Phaser.GameObjects.Sprite;
  interacts: Interact[];
  toast(s: string): void;
  /** wie weit ein Blick in Richtung a reicht, bevor eine Wand ihn stoppt */
  strahl(x: number, y: number, a: number, len: number): number;
  /** wo gerade eine Leiche zu sehen ist (liegend oder auf der Schulter des Wirts), sonst null */
  leiche(): { x: number; y: number } | null;
  /** ein Zeuge meldet einen Fund: die nächste Streife hinschicken */
  melden(x: number, y: number, wer: string): void;
  /** Polizei hat den Wirt erwischt */
  bust(why: string, wer: string, figur: Phaser.GameObjects.Sprite): void;
  /** läuft das Spiel (nicht eingefroren, nicht erwischt, kein Dialog)? */
  aktiv(): boolean;
  /** weitere Figuren, denen man ausweicht (Damen, Felix) */
  hindernisse(): { x: number; y: number }[];
  /** darf die zusätzliche Polizei hier Streife gehen (Kachel)? */
  streifenGebiet(x: number, y: number): boolean;
  /** wo Polizei unterwegs ist (für Ronnys Tipp) */
  polizeiOrte(): { name: string; x: number; y: number }[];
  /** Mülltonne an Kachel (x, y) ist leer gewühlt */
  tonnePluendern(x: number, y: number): void;
}

type Ziel = 'tonne' | 'bank' | 'tuer' | 'laterne' | 'park' | 'strasse' | 'weit';
export type Zubehoer = 'rollator' | 'wagen' | 'hund' | 'pakete' | 'megafon' | 'becher' | 'tuete' | 'bauchladen';

export interface PassantDef {
  id: string;
  name: string;
  /** Textur der Figur (siehe passantenGfx) */
  key: string;
  /** Pixel pro Sekunde */
  tempo: number;
  ziele: Ziel[];
  /** so lange (Sekunden) bleibt er am Ziel */
  pause: [number, number];
  /** Sichtweite als Zeuge in Pixeln (0: merkt nichts) */
  zeuge: number;
  sprueche: string[];
  /** ruft das, wenn der Wirt nah vorbeikommt */
  ruf?: string[];
  zubehoer?: Zubehoer;
  /** bleibt nicht stehen, wenn der Wirt nah ist (Jogger, Paketbote) */
  eilig?: boolean;
  /** läuft im Zickzack (Junkie, Betrunkener) */
  zappelig?: boolean;
  /** wühlt an Mülltonnen (danach ist dort erst mal nichts mehr zu holen) */
  pluendert?: boolean;
}

export const PASSANTEN: PassantDef[] = [
  {
    id: 'ronny', name: 'Zappel-Ronny', key: 'ps_ronny', tempo: 34, ziele: ['strasse', 'tuer', 'tonne'], pause: [1, 3], zeuge: 56, zappelig: true,
    sprueche: ['Haste mal \'n Euro? Für ... ne Busfahrkarte. Ehrlich.', 'Ich bin nicht high. Ich bin ... aufmerksam.', 'Kennste wen, der wen kennt? Frag für \'nen Freund.'],
    ruf: ['Haste mal \'n Euro?', 'Psst! Ey!', 'Kleingeld?'],
  },
  {
    id: 'mandy', name: 'Mandy', key: 'ps_mandy', tempo: 22, ziele: ['tonne', 'tonne', 'strasse'], pause: [3, 6], zeuge: 56, zubehoer: 'wagen', pluendert: true,
    sprueche: ['Finger weg von meinen Tonnen. Die sind reserviert.', 'Willste \'nen Toaster? Geht noch. Fast.', 'Heute schon drei halbe Döner gefunden. Guter Tag.'],
  },
  {
    id: 'guenther', name: 'Pfand-Günther', key: 'ps_guenther', tempo: 24, ziele: ['tonne', 'bank', 'tonne'], pause: [3, 5], zeuge: 56, zubehoer: 'tuete', pluendert: true,
    sprueche: ['Pfand gehört nicht in den Müll! Pfand gehört MIR.', 'Früher gab\'s für \'ne Flasche \'ne Mark. Und Respekt.', 'Die Jugend trinkt nur noch aus Dosen. Dosen! Wie Tiere.'],
  },
  {
    id: 'hildegard', name: 'Oma Hildegard', key: 'ps_hildegard', tempo: 9, ziele: ['bank', 'strasse'], pause: [5, 9], zeuge: 64, zubehoer: 'rollator',
    sprueche: ['Früher war hier alles besser. Und sauberer. Und Sie waren nicht da.', 'Junger Mann, Ihre Fliege sitzt schief. Ihr Leben auch.', 'Ich ruf gleich die Polizei. Weswegen, weiß ich noch nicht.'],
  },
  {
    id: 'jannik', name: 'Hipster-Jannik', key: 'ps_jannik', tempo: 28, ziele: ['strasse', 'laterne', 'tuer', 'park'], pause: [2, 5], zeuge: 56, zubehoer: 'becher',
    sprueche: ['Voll authentisch hier. So ... echt. So ... gefährlich.', 'Gibt\'s hier irgendwo Hafermilch? Nein? Wild.', 'Darf ich ein Foto mit dir machen? Für meinen Kanal. #Kiezleben'],
  },
  {
    id: 'paule', name: 'Paket-Paule', key: 'ps_paule', tempo: 52, ziele: ['tuer', 'tuer'], pause: [1, 2], zeuge: 40, zubehoer: 'pakete', eilig: true,
    sprueche: ['Keine Zeit! 140 Pakete, 2 Stunden!', 'Nachbar? Nein? Dann leg ich\'s in die Mülltonne.'],
    ruf: ['Nicht angetroffen!', 'Zettel ist im Briefkasten!', 'Ich hab geklingelt! Ehrlich!'],
  },
  {
    id: 'dennis', name: 'Junggesellen-Dennis', key: 'ps_dennis', tempo: 20, ziele: ['strasse', 'tuer', 'bank'], pause: [2, 4], zeuge: 0, zubehoer: 'bauchladen', zappelig: true,
    sprueche: ['JUNGGESELLENABSCHIED! Kauf mir was ab! ... Oder trink einfach mit!', 'Ich heirate Samstag. Glaub ich. Wer ist eigentlich die Braut?', 'Mein Trauzeuge hat mich hier ausgesetzt. Als Hase.'],
    ruf: ['PROOOST!', 'Hasi will feiern!', 'Wer will \'nen Kurzen?'],
  },
  {
    id: 'fabian', name: 'Fitness-Fabian', key: 'ps_fabian', tempo: 62, ziele: ['weit'], pause: [0.2, 0.6], zeuge: 40, eilig: true,
    sprueche: ['Morgen! ... Ja, auch nachts. Morgen ist eine Einstellung.'],
    ruf: ['Morgen!', 'Moin!', 'Noch zwölf Kilometer!'],
  },
  {
    id: 'jacqueline', name: 'Jacqueline mit Tyson', key: 'ps_jacqueline', tempo: 20, ziele: ['park', 'strasse', 'laterne'], pause: [3, 6], zeuge: 90, zubehoer: 'hund',
    sprueche: ['Tyson, aus! AUS! ... Der will nur spielen.', 'Der ist voll lieb. Er hat nur schon zwei Postboten gebissen.', 'Tyson mag dich nicht. Tyson mag niemanden. Tyson ist wie ich.'],
    ruf: ['WAU! WAU!', 'KLÄFF!', 'WRRAU!'],
  },
  {
    id: 'bernd', name: 'Prediger Bernd', key: 'ps_bernd', tempo: 18, ziele: ['laterne', 'strasse'], pause: [8, 14], zeuge: 56, zubehoer: 'megafon',
    sprueche: ['Mein Sohn, das Ende ist nah. Wie nah? Näher als dein nächstes Bier.', 'Ich hab\'s im Traum gesehen: ein Auge, das glüht. Und dann Dunkelheit.', 'Spende? Nein? Dann bete wenigstens. Kostet nix.'],
    ruf: ['DAS ENDE IST NAH!', 'TUT BUSSE!', 'DIE KATZE WEISS ALLES!', 'BEREUET! ODER KAUFT WAS!'],
  },
];

export interface PolizeiDef {
  id: string;
  name: string;
  kurz: string;
  key: string;
  tempo: number;
  /** Reichweite und halber Öffnungswinkel der Taschenlampe */
  sicht: number;
  winkel: number;
  sprueche: string[];
  halt: string;
}

export const STREIFEN: PolizeiDef[] = [
  {
    id: 'petra', name: 'Polizistin Petra Pfeffer', kurz: 'Petra', key: 'ps_petra', tempo: 30, sicht: 120, winkel: 0.42,
    sprueche: ['Petra Pfeffer, Polizei. Weitergehen. Und zwar ordentlich.', 'Felix ist ein guter Junge. Aber ich bin besser.', 'Ich hab Sie im Auge. Beide Augen sogar.'],
    halt: '„Stehen bleiben! Polizei!“',
  },
  {
    id: 'kai', name: 'Polizeianwärter Kai', kurz: 'Kai', key: 'ps_kai', tempo: 26, sicht: 64, winkel: 0.32,
    sprueche: ['H-hallo! Alles in Ordnung hier? ... Bei Ihnen? ... Bei mir auch.', 'Ich bin erst seit drei Wochen dabei. Bitte heute keine Straftaten.', 'Halt! Polizei! ... Ach, Sie sind\'s. Glaub ich.'],
    halt: '„H-halt! Polizei! Wirklich jetzt!“',
  },
];

type Modus = 'gehen' | 'pause' | 'flucht' | 'einsatz' | 'suchen';

export interface Figur {
  def: PassantDef | null;
  cop: PolizeiDef | null;
  x: number;
  y: number;
  spr: Phaser.GameObjects.Sprite;
  schatten: Phaser.GameObjects.Image;
  zub?: Phaser.GameObjects.Image;
  hund?: Phaser.GameObjects.Sprite;
  kegel?: Phaser.GameObjects.Graphics;
  pfad: { x: number; y: number }[];
  i: number;
  modus: Modus;
  warten: number;
  blockT: number;
  /** Blickrichtung (Bogenmaß) für Polizei und Animation */
  blick: number;
  zielTonne?: Kachel;
  meldeBis: number;
  rufBis: number;
  pruefen: number;
  phase: number;
  fluchtTempo: number;
}

const zufall = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <X>(a: X[]) => a[Math.floor(Math.random() * a.length)];

export class Passanten {
  private figuren: Figur[] = [];
  private ziele = new Map<Ziel, Kachel[]>();
  private frei: Kachel[] = [];
  private w: number;
  private reich: Set<number>;
  private aus = false;
  private dennisBis = 0;
  private rempelBis = 0;

  constructor(private welt: Welt, start: Kachel, mitPolizei: boolean) {
    const { solid, rows } = welt;
    this.w = solid[0]?.length ?? 0;
    this.reich = erreichbar(solid, start);
    const ok = (x: number, y: number) => this.reich.has(y * this.w + x);
    // Ziele: freie Nachbarkachel neben Tonnen, Bänken, Laternen, unter Türen; Park und Straße direkt
    const neben = (x: number, y: number): Kachel | null => {
      for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) if (ok(x + dx, y + dy)) return [x + dx, y + dy];
      return null;
    };
    const add = (z: Ziel, k: Kachel | null) => { if (k) (this.ziele.get(z) ?? this.ziele.set(z, []).get(z)!).push(k); };
    for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
      const ch = rows[y][x];
      if ('TGm'.includes(ch)) add('tonne', neben(x, y));
      else if (ch === 'n') add('bank', neben(x, y));
      else if (ch === 'l') add('laterne', neben(x, y));
      else if ('dDUQ'.includes(ch)) add('tuer', ok(x, y + 1) ? [x, y + 1] : null);
      else if (ch === 'v' && ok(x, y)) add('park', [x, y]);
      else if (',._'.includes(ch) && ok(x, y)) { add('strasse', [x, y]); this.frei.push([x, y]); }
    }
    // Passanten an zufälligen Stellen der Straße, nicht direkt neben dem Wirt
    const px = Math.floor(welt.player.x / T), py = Math.floor((welt.player.y - 3) / T);
    const weitWeg = this.frei.filter(([x, y]) => Math.abs(x - px) + Math.abs(y - py) > 8);
    const orte = weitWeg.length ? weitWeg : this.frei;
    if (!orte.length) return;
    for (const d of PASSANTEN) this.neu(d, null, pick(orte));
    if (mitPolizei) {
      const gebiet = this.frei.filter(([x, y]) => welt.streifenGebiet(x, y));
      for (const c of STREIFEN) if (gebiet.length) this.neu(null, c, pick(gebiet));
    }
  }

  private neu(def: PassantDef | null, cop: PolizeiDef | null, [tx, ty]: Kachel) {
    const sc = this.welt.scene;
    const key = def?.key ?? cop!.key;
    const x = tx * T + 8, y = ty * T + 14;
    const spr = sc.add.sprite(x, y, key, 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    const schatten = sc.add.image(x, y - 1, 'shadow').setDepth(1);
    const f: Figur = { def, cop, x, y, spr, schatten, pfad: [], i: 0, modus: 'pause', warten: zufall(0, 2), blockT: 0, blick: Math.PI / 2, meldeBis: 0, rufBis: 0, pruefen: Math.random() * 0.25, phase: Math.random() * 10, fluchtTempo: 1.9 };
    if (def?.zubehoer === 'hund') f.hund = sc.add.sprite(x + 8, y, 'ps_hund', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    else if (def?.zubehoer) f.zub = sc.add.image(x, y, `ps_${def.zubehoer}`).setOrigin(0.5, 1).setScale(0.5).setDepth(y + 1);
    if (cop) f.kegel = sc.add.graphics().setDepth(5001).setBlendMode(Phaser.BlendModes.ADD);
    this.figuren.push(f);
    this.welt.interacts.push({
      x, y: y - 4, r: 18,
      label: () => (this.aus || !this.welt.aktiv() || f.modus === 'flucht' || state.carrying ? null : this.label(f)),
      act: () => this.reden(f),
    });
    const spot = this.welt.interacts[this.welt.interacts.length - 1];
    f.spr.setData('spot', spot);
  }

  // ---------------------------------------------------------------- Gespräche

  private label(f: Figur) {
    if (f.cop) return `Mit ${f.cop.kurz} reden`;
    const d = f.def!;
    if (d.id === 'ronny') return state.money >= 1 ? 'Ronny 1 € geben' : 'Mit Ronny reden';
    if (d.id === 'fabian') return 'Fabian zuwinken';
    return `${d.name} ansprechen`;
  }

  private reden(f: Figur) {
    if (f.cop) return this.welt.toast(`${f.cop.kurz}: „${pick(f.cop.sprueche)}“`);
    const d = f.def!;
    const sag = (s: string) => this.welt.toast(`${d.name}: „${s}“`);
    if (d.id === 'ronny' && state.money >= 1) {
      state.money -= 1;
      audio.sfx('coin');
      return sag(this.ronnyTipp());
    }
    if (d.id === 'fabian') { floatText(this.welt.scene, f.x, f.y - 24, 'MORGEN!', '#9ae0ff'); return; }
    if (d.id === 'dennis' && state.time > this.dennisBis && Math.random() < 0.35) {
      this.dennisBis = state.time + 60;
      state.inv.schnaps++;
      audio.sfx('glug');
      floatText(this.welt.scene, this.welt.player.x, this.welt.player.y - 24, '+1 Schnaps', '#9ae09a');
      return sag('Hier, ein Kurzer! Geht aufs Haus! ... Auf welches Haus eigentlich?');
    }
    if (d.id === 'jannik' && Math.random() < 0.5) {
      this.welt.scene.cameras.main.flash(120, 255, 255, 255);
      audio.sfx('click');
      return sag('Smile! ... Okay, das wird nix. Du hast so eine ... Energie.');
    }
    sag(pick(d.sprueche));
  }

  /** Ronny verrät gegen einen Euro, wo die nächste Streife steckt */
  private ronnyTipp() {
    const p = this.welt.player;
    const orte = this.welt.polizeiOrte();
    if (!orte.length) return 'Bullen? Grad keine da. Komisch. Das macht mich nervös.';
    const n = orte.reduce((a, b) => (Math.hypot(a.x - p.x, a.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? a : b));
    const dx = n.x - p.x, dy = n.y - p.y, dist = Math.hypot(dx, dy) / T;
    const wo = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'rechts von dir' : 'links von dir') : dy > 0 ? 'unten bei dir' : 'oben, hinter dir';
    return dist < 6 ? `${n.name}? Der steht praktisch neben dir, Alter!` : `${n.name} läuft grad ${wo}. So ${Math.round(dist)} Meter. Ich hab nix gesagt.`;
  }

  // ---------------------------------------------------------------- Ablauf

  /** Polizeiposition (Augen) und Name, z. B. für die Wahl der Streife bei einer Meldung */
  streifen() {
    return this.figuren.filter((f) => f.cop && !this.aus).map((f) => ({ name: f.cop!.kurz, x: f.x, y: f.y, figur: f }));
  }

  /** Figuren als Hindernisse (z. B. für Felix) */
  positionen() {
    return this.figuren.map((f) => ({ x: f.x, y: f.y }));
  }

  /** Sieht irgendeine der zusätzlichen Streifen diesen Punkt (Füße)? */
  polizeiSieht(x: number, y: number) {
    return this.figuren.some((f) => f.cop && this.siehtPunkt(f, x, y));
  }

  /** Eine Streife zum gemeldeten Ort schicken */
  einsatz(f: Figur, x: number, y: number) {
    if (!this.geheZu(f, [Math.floor(x / T), Math.floor((y - 3) / T)], 'einsatz')) return false;
    floatText(this.welt.scene, f.x, f.y - 26, '!', '#ff3030');
    return true;
  }

  /** Bei der Mutation: alle rennen schreiend weg */
  allesFlieht(vonX: number, vonY: number) {
    this.aus = true;
    for (const f of this.figuren) {
      f.kegel?.clear();
      const ruf = f.def?.id === 'bernd' ? 'HAB ICH DOCH GESAGT!' : pick(['AAAH!', 'HILFE!', 'WEG HIER!', 'MAMA!']);
      floatText(this.welt.scene, f.x, f.y - 24, ruf, '#ffffff');
      this.fliehe(f, vonX, vonY, 2.4);
    }
  }

  private geheZu(f: Figur, ziel: Kachel, modus: Modus) {
    const von: Kachel = [Math.floor(f.x / T), Math.floor((f.y - 3) / T)];
    const pfad = weg(this.welt.solid, von, ziel);
    if (!pfad || !pfad.length) return false;
    f.pfad = pfad.map(([x, y]) => ({ x: x * T + 8, y: y * T + 14 }));
    f.i = 0;
    f.modus = modus;
    f.blockT = 0;
    this.glaetten(f);
    return true;
  }

  /** Abkürzungen: den am weitesten entfernten Wegpunkt ansteuern, der in gerader Linie erreichbar ist */
  private glaetten(f: Figur) {
    let best = f.i;
    for (let j = f.i + 1; j < Math.min(f.pfad.length, f.i + 8); j++) {
      if (geradeFrei(this.welt.solid, T, f.x, f.y, f.pfad[j].x, f.pfad[j].y)) best = j;
      else break;
    }
    f.i = best;
  }

  private neuesZiel(f: Figur) {
    for (let v = 0; v < 5; v++) {
      let ziel: Kachel | undefined;
      if (f.cop) {
        const gebiet = this.frei.filter(([x, y]) => this.welt.streifenGebiet(x, y));
        ziel = pick(gebiet.length ? gebiet : this.frei);
      } else {
        const art = pick(f.def!.ziele);
        if (art === 'weit') {
          const cx = Math.floor(f.x / T), cy = Math.floor(f.y / T);
          const weit = this.frei.filter(([x, y]) => Math.abs(x - cx) + Math.abs(y - cy) > 25);
          ziel = pick(weit.length ? weit : this.frei);
        } else {
          const l = this.ziele.get(art);
          ziel = l?.length ? pick(l) : pick(this.frei);
        }
        f.zielTonne = f.def!.pluendert && art === 'tonne' ? this.tonneBei(ziel) : undefined;
      }
      if (ziel && this.geheZu(f, ziel, 'gehen')) return;
    }
    f.modus = 'pause';
    f.warten = 2;
  }

  /** Mülltonne direkt neben einer Zielkachel */
  private tonneBei([x, y]: Kachel): Kachel | undefined {
    for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) if (this.welt.rows[y + dy]?.[x + dx] === 'T') return [x + dx, y + dy];
    return undefined;
  }

  /** Weg vom Ort (vonX, vonY): eine erreichbare Stelle, die weit davon und nicht zu weit von hier liegt */
  private fliehe(f: Figur, vonX: number, vonY: number, tempo = 1.9) {
    let best: Kachel | null = null, wert = -Infinity;
    for (let n = 0; n < 40; n++) {
      const k = pick(this.frei);
      if (!k) break;
      const kx = k[0] * T + 8, ky = k[1] * T + 14;
      const v = Math.hypot(kx - vonX, ky - vonY) - 0.6 * Math.hypot(kx - f.x, ky - f.y);
      if (v > wert) { wert = v; best = k; }
    }
    if (best && this.geheZu(f, best, 'flucht')) f.fluchtTempo = tempo;
  }

  update(dt: number) {
    const aktiv = this.welt.aktiv() && !this.aus;
    const p = this.welt.player;
    for (const f of this.figuren) {
      if (!this.aus && !aktiv) { this.stehen(f); this.zeichnen(f, 0, 0); continue; }
      let vx = 0, vy = 0;
      const nahWirt = Math.hypot(p.x - f.x, p.y - f.y) < 22;
      const eilig = !!f.def?.eilig || f.modus === 'flucht' || f.modus === 'einsatz';
      if (nahWirt && !eilig && !this.aus) {
        // stehen bleiben und den Wirt ansehen, damit man reden kann
        f.blick = Math.atan2(p.y - f.y, p.x - f.x);
        this.stehen(f);
      } else if (f.modus === 'pause' || f.modus === 'suchen') {
        f.warten -= dt;
        if (f.cop) f.blick += Math.sin(this.welt.scene.time.now / 600 + f.phase) * dt * 1.6; // umsehen
        this.stehen(f);
        if (f.warten <= 0) this.neuesZiel(f);
      } else {
        [vx, vy] = this.schritt(f, dt);
      }
      if (aktiv) this.beobachten(f, dt, nahWirt);
      this.zeichnen(f, vx, vy);
    }
  }

  private schritt(f: Figur, dt: number): [number, number] {
    const ziel = f.pfad[f.i];
    if (!ziel) { this.angekommen(f); return [0, 0]; }
    const faktor = f.modus === 'flucht' ? f.fluchtTempo : f.modus === 'einsatz' ? 1.7 : 1;
    const tempo = (f.def?.tempo ?? f.cop!.tempo) * faktor;
    const dx = ziel.x - f.x, dy = ziel.y - f.y, d = Math.hypot(dx, dy);
    const s = Math.min(d, tempo * dt);
    const nx = f.x + (dx / (d || 1)) * s, ny = f.y + (dy / (d || 1)) * s;
    // Ausweichen: steht jemand direkt vor mir?
    const block = this.imWeg(f, nx + (dx / (d || 1)) * 6, ny + (dy / (d || 1)) * 6);
    if (block) {
      f.blockT += dt;
      if (f.blockT > 0.7) {
        // außen herum: Weg neu suchen, die Kachel des Hindernisses meiden
        f.blockT = 0;
        const z = f.pfad[f.pfad.length - 1];
        const ziel2: Kachel = [Math.floor(z.x / T), Math.floor((z.y - 3) / T)];
        const gesperrt = new Set([Math.floor((block.y - 3) / T) * this.w + Math.floor(block.x / T)]);
        const neu = weg(this.welt.solid, [Math.floor(f.x / T), Math.floor((f.y - 3) / T)], ziel2, gesperrt);
        if (neu?.length) { f.pfad = neu.map(([x, y]) => ({ x: x * T + 8, y: y * T + 14 })); f.i = 0; }
        else if (f.modus === 'gehen') { f.modus = 'pause'; f.warten = zufall(0.5, 1.5); }
      }
      if (d > 0.1) f.blick = Math.atan2(dy, dx);
      return [0, 0];
    }
    f.blockT = 0;
    f.x = nx;
    f.y = ny;
    if (d > 0.1) f.blick = Math.atan2(dy, dx);
    if (d <= tempo * dt + 0.01) {
      f.i++;
      if (f.i < f.pfad.length) this.glaetten(f);
    }
    return [dx, dy];
  }

  /** Wer steht an dieser Stelle im Weg? (Wirt, andere Figuren, Damen, Felix) */
  private imWeg(f: Figur, x: number, y: number): { x: number; y: number } | null {
    const nah = (o: { x: number; y: number }) => Math.abs(o.x - x) < 8 && Math.abs(o.y - y) < 6;
    const p = this.welt.player;
    if (!f.def?.eilig && f.modus !== 'flucht' && nah(p)) return p;
    for (const o of this.figuren) if (o !== f && nah(o)) return o;
    for (const o of this.welt.hindernisse()) if (nah(o)) return o;
    return null;
  }

  private angekommen(f: Figur) {
    const tonne = f.zielTonne;
    f.zielTonne = undefined;
    if (f.modus === 'einsatz') {
      // am gemeldeten Ort: umsehen
      f.modus = 'suchen';
      f.warten = 4;
      return;
    }
    f.modus = 'pause';
    const d = f.def;
    f.warten = d ? zufall(d.pause[0], d.pause[1]) : zufall(1.5, 3);
    if (tonne && d?.pluendert) {
      this.welt.tonnePluendern(tonne[0], tonne[1]);
      if (Math.hypot(this.welt.player.x - f.x, this.welt.player.y - f.y) < 140) {
        audio.sfx('rummage');
        floatText(this.welt.scene, f.x, f.y - 22, '*wühl*', '#c8b890');
      }
    }
  }

  private stehen(f: Figur) {
    f.spr.anims.stop();
  }

  /** Zeugen, Rufe, Polizeiblick */
  private beobachten(f: Figur, dt: number, nahWirt: boolean) {
    const w = this.welt, sc = w.scene;
    // Rufe, wenn der Wirt vorbeikommt (Bernd predigt auch ohne Publikum)
    const ruf = f.def?.ruf;
    if (ruf && state.time > f.rufBis && f.modus !== 'flucht' && (nahWirt || (f.def!.id === 'bernd' && f.modus === 'pause' && Math.hypot(w.player.x - f.x, w.player.y - f.y) < 200))) {
      f.rufBis = state.time + zufall(5, 9);
      const at = f.hund ?? f.spr;
      floatText(sc, at.x, at.y - (f.hund ? 12 : 24), pick(ruf), f.def!.id === 'bernd' ? '#ffd040' : '#f4ead0');
      if (f.def!.id === 'paule' && state.time > this.rempelBis && Math.hypot(w.player.x - f.x, w.player.y - f.y) < 12) {
        // Paule rempelt im Vorbeirennen
        this.rempelBis = state.time + 6;
        audio.sfx('thud');
        sc.cameras.main.shake(120, 0.004);
      }
    }
    f.pruefen -= dt;
    if (f.pruefen > 0) return;
    f.pruefen = 0.25;
    const l = w.leiche();
    if (!l) return;
    if (f.cop) {
      if (this.siehtPunkt(f, l.x, l.y)) {
        w.bust(f.modus === 'einsatz' || f.modus === 'suchen' ? 'Da hat jemand angerufen. Zu Recht.' : 'Was ist DAS denn?!', f.cop.kurz, f.spr);
      }
      return;
    }
    const d = f.def!;
    if (!d.zeuge || f.modus === 'flucht' || state.time < f.meldeBis) return;
    const dist = Math.hypot(l.x - f.x, l.y - f.y);
    if (dist > d.zeuge) return;
    const a = Math.atan2(l.y - f.y, l.x - f.x);
    if (w.strahl(f.x, f.y - 8, a, dist) < dist - 2) return;
    // gesehen: schreien, wegrennen, Polizei rufen
    f.meldeBis = state.time + 30;
    if (f.hund) {
      floatText(sc, f.hund.x, f.hund.y - 12, 'GRRRR!', '#ff9a50');
      audio.sfx('growl');
    }
    floatText(sc, f.x, f.y - 24, pick(['HILFE! MORD!', 'POLIZEI!!', 'EINE LEICHE!', 'AAAAH!']), '#ff6a5a');
    audio.sfx('scream');
    this.fliehe(f, l.x, l.y);
    sc.time.delayedCall(1000, () => { if (!this.aus && w.aktiv()) w.melden(l.x, l.y, d.name); });
  }

  /** Taschenlampe der Streife: Reichweite, Winkel, Wände */
  private siehtPunkt(f: Figur, x: number, y: number) {
    if (!f.cop || this.aus) return false;
    const ex = f.x, ey = f.y - 4;
    const dx = x - ex, dy = y - 4 - ey, dist = Math.hypot(dx, dy);
    if (dist > f.cop.sicht) return false;
    const a = Math.atan2(dy, dx);
    if (dist >= 24 && Math.abs(Phaser.Math.Angle.Wrap(a - f.blick)) > f.cop.winkel) return false;
    return this.welt.strahl(ex, ey, a, dist) >= dist;
  }

  private zeichnen(f: Figur, vx: number, vy: number) {
    const key = f.def?.key ?? f.cop!.key;
    const geht = vx !== 0 || vy !== 0;
    // Zickzack (nur fürs Auge): seitlich wackeln, die Logik bleibt auf dem Weg
    const wackel = f.def?.zappelig && geht ? Math.sin(this.welt.scene.time.now / 120 + f.phase) * 1.6 : 0;
    f.spr.setPosition(f.x + wackel, f.y).setDepth(f.y);
    const seit = Math.abs(Math.cos(f.blick)) > 0.6;
    if (geht) {
      const anim = seit ? `${key}_side` : Math.sin(f.blick) < 0 ? `${key}_up` : `${key}_down`;
      f.spr.anims.play(anim, true);
      f.spr.anims.timeScale = f.modus === 'flucht' || f.modus === 'einsatz' ? 1.8 : 1;
      f.spr.setFlipX(seit && Math.cos(f.blick) < 0);
    } else if (!f.spr.anims.isPlaying) {
      f.spr.setFrame(seit ? 6 : Math.sin(f.blick) < 0 ? 3 : 0).setFlipX(seit && Math.cos(f.blick) < 0);
    }
    f.schatten.setPosition(f.spr.x, f.y - 1);
    const spot = f.spr.getData('spot') as Interact | undefined;
    if (spot) { spot.x = f.x; spot.y = f.y - 4; }
    // Zubehör vor, neben oder hinter der Figur
    const links = seit && Math.cos(f.blick) < 0, hoch = !seit && Math.sin(f.blick) < 0;
    const vor = seit ? (links ? -1 : 1) : 0;
    if (f.zub) {
      const z = f.def!.zubehoer;
      if (z === 'rollator' || z === 'wagen') {
        const ab = z === 'wagen' ? 9 : 7;
        f.zub.setPosition(f.spr.x + vor * ab, f.y + (seit ? 0 : hoch ? -4 : 3)).setFlipX(links).setDepth(hoch ? f.y - 1 : f.y + 1);
      } else if (z === 'pakete') f.zub.setPosition(f.spr.x + vor * 3, f.y - 7).setDepth(hoch ? f.y - 1 : f.y + 1);
      else if (z === 'megafon') f.zub.setPosition(f.spr.x + (seit ? vor * 5 : 4), f.y - 11).setFlipX(links).setDepth(f.y + 1);
      else if (z === 'becher') f.zub.setPosition(f.spr.x + (seit ? vor * 4 : 5), f.y - 6).setDepth(hoch ? f.y - 1 : f.y + 1);
      else if (z === 'tuete') f.zub.setPosition(f.spr.x + (seit ? -vor * 5 : -5), f.y - 3).setDepth(f.y + 1);
      else if (z === 'bauchladen') f.zub.setPosition(f.spr.x, f.y - 6).setDepth(hoch ? f.y - 1 : f.y + 1);
    }
    if (f.hund) {
      // Tyson trottet hinterher, mit etwas Abstand
      const tx = f.x - Math.cos(f.blick) * 9, ty = f.y - Math.sin(f.blick) * 5 + 1;
      f.hund.setPosition(f.hund.x + (tx - f.hund.x) * 0.15, f.hund.y + (ty - f.hund.y) * 0.15).setDepth(f.hund.y);
      f.hund.setFlipX(Math.cos(f.blick) < 0);
      if (geht) f.hund.anims.play('ps_hund_lauf', true);
      else { f.hund.anims.stop(); f.hund.setFrame(0); }
    }
    if (f.kegel) this.kegel(f);
  }

  private kegel(f: Figur) {
    const g = f.kegel!;
    if (this.aus) { g.clear(); return; }
    const c = f.cop!, ex = f.x, ey = f.y - 4;
    const V = Phaser.Math.Vector2;
    const fan = [new V(ex, ey)];
    for (let i = 0; i <= 14; i++) {
      const a = f.blick - c.winkel + (c.winkel * 2 * i) / 14, d = this.welt.strahl(ex, ey, a, c.sicht);
      fan.push(new V(ex + Math.cos(a) * d, ey + Math.sin(a) * d));
    }
    g.clear().fillStyle(0xfff0a0, f.modus === 'einsatz' || f.modus === 'suchen' ? 0.18 : 0.11).fillPoints(fan, true);
  }
}
