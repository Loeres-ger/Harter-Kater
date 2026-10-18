import Phaser from 'phaser';
import { audio } from '../audio';
import { VICTIM, impatient, lookStage, state } from '../state';
import { T, TileInfo, TopDown } from './TopDown';
import { floatText } from '../ui';
import { GuestDef, guestById } from '../guests/data';
import { BarGuest, SEATS, ensureGuests, removeGuest, resetRoster, roster } from '../guests/roster';

interface GuestView {
  g: BarGuest;
  def: GuestDef;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  baseX: number;
  baseY: number;
  nextTaunt: number;
  fidget?: Phaser.Tweens.Tween;
}

// Die Kneipe: Tresen oben links (rein durch die Klappe F), Gastraum, rechts oben die Toilette
// mit Hinterausgang (E) zur Gasse, unten die Eingangstür (D).
//  P Poster  U Uhr  Z Dartscheibe  V Fernseher  M/N/O Spielautomaten
//  k Waschbecken+Spiegel  u Pissoir  j Fliesenwand  l Kabinenwand  q WC  v/w Kabinentüren
//  d Durchgang WC  y Garderobe  i Mülleimer  e Pflanze  a Unordnung am Boden
const MAP = [
  '########################',
  '#SSSSSSPUWWZVMNO#kuujjj#',
  '#......C........#ffflqq#',
  '#CCCCCFC........#ffflvw#',
  '#.s.s.s..i.....y#ffffff#',
  '#..........rrrr.#ffffffE',
  '#..hth.....rrrr.#ffffff#',
  '#......a........##d#####',
  '#..hth....hth..........#',
  '#......a..........hth.J#',
  '#.......hth.........e..#',
  '#...........hth........#',
  '#e.................hth.#',
  '####D###################',
];

export const BAR_START_SPAWN: [number, number] = [3, 2];
export const BAR_DOOR_SPAWN: [number, number] = [4, 12];
/** Hinterausgang (Toilettenflur) */
export const BAR_BACK_SPAWN: [number, number] = [22, 5];
/** Ankunftspunkte draußen: vor dem Haupteingang bzw. vor der Hintertür */
const OUT_FRONT: [number, number] = [17, 17];
const OUT_BACK: [number, number] = [22, 4];
export const BAR_TRESEN_SPAWN: [number, number] = [4, 2];
const VICTIM_TILE: [number, number] = [4, 4];
const KALLE_TILE: [number, number] = [10, 8];

let coinsSpawned = false;
export function resetBar() {
  coinsSpawned = false;
  resetRoster();
}

const SCHLAGER = ['„Atemlos durch die Nacht“ läuft. Schon wieder.', '„Ein Bett im Kornfeld“. Kalle summt mit.', '„Griechischer Wein“. Irgendwer weint.', 'Die Jukebox frisst deine Münze nicht. Glück gehabt.'];

export class BarScene extends TopDown {
  private victim?: Phaser.GameObjects.Sprite;
  private wishBubble?: Phaser.GameObjects.Container;
  private wishIcon?: Phaser.GameObjects.Image;
  private body?: Phaser.GameObjects.Sprite;
  private guestViews = new Map<string, GuestView>();

  constructor() {
    super('Bar');
  }

  init() {
    super.init();
    this.victim = this.wishBubble = this.wishIcon = this.body = undefined;
    this.guestViews = new Map();
  }

  protected mapRows() { return MAP; }
  protected isWall(ch: string) { return '#SWDMNOPUZVkujE'.includes(ch); }
  protected darkness() { return 0.3; }
  protected floorKey(x: number, y: number) {
    const ch = this.rows[y][x];
    if ('flqvwd'.includes(ch)) return (x * 3 + y * 5) % 7 === 0 ? 'wcFloorDirty' : 'wcFloor';
    if (ch === 'r') return 'rug';
    // abgelaufene Stellen vor Tresen, Tür und Toilette
    if ((x * 13 + y * 7) % 9 === 0 || (y === 12 && x === 4) || (y === 8 && x === 18)) return 'floorWorn';
    return `floor${(x * 7 + y * 3) % 3}`;
  }

  protected tileFor(ch: string, x = 0, y = 0): TileInfo {
    switch (ch) {
      case '#': return { key: 'panelFront', solid: true };
      case 'P': return { key: 'panelPoster', solid: true };
      case 'U': return { key: 'panelClock', solid: true };
      case 'Z': return { key: 'panelDart', solid: true };
      case 'V': return { key: 'panelTV', solid: true };
      case 'k': return { key: 'sinkMirror', solid: true };
      case 'u': return { key: 'urinal', solid: true };
      case 'j': return { key: 'tileWallFront', solid: true };
      case 'E': return { key: 'exitDoor', solid: true };
      case 'l': return { key: 'stallWall', solid: true };
      case 'q': return { key: 'wcBowl', solid: true };
      case 'v': return { key: 'stallDoorH', solid: true };
      case 'w': return { key: 'stallDoorD', solid: true };
      case 'd': return { key: 'wcDoor', solid: false };
      case 'y': return { key: 'coatRack', solid: true, object: true };
      case 'i': return { key: 'bin', solid: true, object: true };
      case 'e': return { key: 'plant', solid: true, object: true };
      case 'a': return { key: 'clutter', solid: false };
      case 'S': return { key: 'shelf', solid: true };
      case 'W': return { key: 'window', solid: true };
      case 'D': return { key: 'doorBottom', solid: true };
      case 'M': return { key: 'cab_sahne', solid: true };
      case 'N': return { key: 'cab_ratte', solid: true };
      case 'O': return { key: 'cab_derby', solid: true };
      case 'C': return { key: 'counter', solid: true, object: true };
      case 'F': return { key: 'counterFlap', solid: false };
      case 't': return { key: (x + y) % 2 ? 'tableB' : 'table', solid: true, object: true };
      case 'h': return { key: 'chair', solid: false };
      case 's': return { key: 'stool', solid: false };
      case 'J': return { key: 'jukebox', solid: true, object: true };
      default: return { key: '', solid: false };
    }
  }

  protected goalText() {
    if (state.carrying) return 'Raus in die Gasse damit. Zur Katze.';
    if (state.dead) return `${VICTIM} liegt am Boden. Schulter ihn.`;
    if (impatient()) return `${VICTIM} wird ungeduldig! Schnell bedienen!`;
    if (state.sucht < 10) return `Bediene ${VICTIM} - von hinter dem Tresen.`;
    return 'Halt ihn bei Laune. Spezielles gibt\'s in der Gasse.';
  }

  protected setupWorld() {
    audio.music('bar');
    const [vx, vy] = VICTIM_TILE;
    if (!state.dead) {
      this.victim = this.add.sprite(vx * T + 8, vy * T + 12, `schnoesel${lookStage()}`, 3).setOrigin(0.5, 1).setScale(0.5).setDepth(vy * T + 12);
      this.add.image(this.victim.x, this.victim.y - 1, 'shadow').setDepth(1);
      this.wishIcon = this.add.image(0, 0, 'icon_bier').setScale(0.3);
      this.wishBubble = this.add.container(this.victim.x + 9, this.victim.y - 26, [this.add.image(0, 0, 'bubble').setScale(0.5), this.wishIcon]).setDepth(4000);
      this.tweens.add({ targets: this.wishBubble, y: this.wishBubble.y - 2, duration: 700, yoyo: true, repeat: -1 });
    } else if (!state.carrying && !state.bodyInAlley) {
      this.body = this.add.sprite(vx * T + 8, (vy + 1) * T + 6, `schnoesel${lookStage()}`, 0).setAngle(90).setScale(0.5).setDepth((vy + 1) * T);
    }

    // Bedienen: nur von hinter dem Tresen
    this.interacts.push({
      x: vx * T + 8, y: 2 * T + 10, r: 18,
      label: () => (state.dead ? null : `${VICTIM} bedienen`),
      act: () => this.go('Tresen'),
    });
    this.interacts.push({
      x: vx * T + 8, y: vy * T + 10, r: 18,
      label: () => {
        if (!state.dead) return `Mit ${VICTIM} reden`;
        return this.body?.active ? 'Leiche schultern' : null;
      },
      act: () => {
        if (!state.dead) return this.talk('glanz', (a) => a === 'tresen' && this.go('Tresen'));
        if (this.body?.active) {
          this.body.destroy();
          state.carrying = true;
          this.carried = this.add.sprite(0, 0, `schnoesel${lookStage()}`, 0).setAngle(90).setScale(0.5);
          this.toast('Uff. Schwerer als er aussah.');
          audio.sfx('thud');
        }
      },
    });

    // Stammgast Kalle pennt am Tisch
    const [kx, ky] = KALLE_TILE;
    const kalle = this.add.sprite(kx * T + 6, ky * T + 12, 'penner', 6).setOrigin(0.5, 1).setScale(0.5).setDepth(ky * T + 12);
    this.tweens.add({ targets: kalle, angle: 8, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({
      delay: 2200, loop: true,
      callback: () => {
        const z = this.add.text(kalle.x + 4, kalle.y - 22, 'z', { fontFamily: 'monospace', fontSize: '8px', color: '#c8c8e8' }).setDepth(6000);
        this.tweens.add({ targets: z, x: z.x + 8, y: z.y - 14, alpha: 0, duration: 1800, onComplete: () => z.destroy() });
      },
    });
    this.interacts.push({ x: kalle.x, y: kalle.y - 4, r: 20, label: () => 'Mit Kalle reden', act: () => this.talk('kalle') });

    // Spielautomaten in der rechten oberen Ecke
    const machines: [number, string, string, number][] = [
      [13, 'Sahne', 'ALLES SAHNE spielen', 0xff4040],
      [14, 'Ratte', 'BUCH DER RATTE spielen', 0xf0c040],
      [15, 'Derby', 'KLEPPER-DERBY wetten', 0x40ff60],
    ];
    for (const [col, key, label, color] of machines) {
      const l = this.add.image(col * T + 8, 2 * T + 2, 'light').setBlendMode(Phaser.BlendModes.ADD).setDepth(5001).setScale(0.35).setTint(color).setAlpha(0.7);
      this.tweens.add({ targets: l, alpha: 0.3, duration: 300 + col * 40, yoyo: true, repeat: -1 });
      this.interacts.push({
        x: col * T + 8, y: 2 * T + 6, r: 12,
        label: () => label,
        act: () => {
          audio.sfx('click');
          this.scene.launch(key, { resume: 'Bar' });
          this.scene.bringToTop(key);
          this.scene.pause();
        },
      });
    }

    const [jx, jy] = this.find('J');
    this.interacts.push({ x: jx * T + 8, y: jy * T + 12, r: 20, label: () => 'Jukebox', act: () => this.toast(Phaser.Utils.Array.GetRandom(SCHLAGER)) });
    // Türen: vorne raus auf die Straße, hinten durch die Toilette in die Gasse
    const [dx, dy] = this.find('D');
    this.interacts.push({ x: dx * T + 8, y: dy * T, r: 18, label: () => 'Raus auf die Straße', act: () => this.go('Alley', { spawn: OUT_FRONT }) });
    const [ex, ey] = this.find('E');
    this.interacts.push({ x: ex * T - 2, y: ey * T + 10, r: 18, label: () => 'Hintertür zur Gasse', act: () => this.go('Alley', { spawn: OUT_BACK }) });
    this.addLight(dx * T + 8, dy * T - 4, 0.45, 0.55).setTint(0xffd080);
    this.addLight(ex * T - 4, ey * T + 8, 0.4, 0.5).setTint(0x80ff90);
    this.setupToilet();

    if (!coinsSpawned) {
      coinsSpawned = true;
      for (let i = 0; i < 2; i++) this.spawnCoin(...this.randomFloorTile());
    }

    this.setupGuests();

    // warmes, gedämpftes Licht über Tresen und Tischen
    for (const [x, y] of [[4, 3], [4, 7], [11, 8], [13, 5], [9, 10], [19, 10], [13, 11]]) this.addLight(x * T, y * T, 0.9, 0.62).setTint(0xffc890);
    this.smoke();
  }

  private find(ch: string): [number, number] {
    for (let y = 0; y < this.rows.length; y++) {
      const x = this.rows[y].indexOf(ch);
      if (x >= 0) return [x, y];
    }
    return [1, 1];
  }

  /** Leichter Zigarettenrauch unter der Decke */
  private smoke() {
    this.add.particles(0, 0, 'light', {
      x: { min: T, max: 16 * T }, y: { min: 2 * T, max: 12 * T },
      lifespan: 6000, speedX: { min: -4, max: 4 }, speedY: { min: -3, max: -1 },
      scale: { start: 0.2, end: 0.6 }, alpha: { start: 0.07, end: 0 }, tint: 0xb0a090, frequency: 500,
    }).setDepth(5000);
  }

  /** Toilette: flackernde Funzel und ein paar Untersuchungstexte. */
  private setupToilet() {
    const lamp = this.addLight(19 * T + 8, 4 * T, 0.75, 0.6).setTint(0xd0f0d0);
    this.tweens.killTweensOf(lamp);
    this.time.addEvent({ delay: 120, loop: true, callback: () => lamp.setAlpha(Math.random() < 0.12 ? 0.05 : 0.45 + Math.random() * 0.15) });
    const spots: [string, string, string][] = [
      ['k', 'Waschbecken', 'Der Hahn hustet braunes Wasser. Der Spiegel ist blind vor Dreck.'],
      ['u', 'Pissoir', 'Seit Jahren nicht geputzt. Besser nicht genauer hinsehen.'],
      ['v', 'Herren-Kabine', 'Besetzt. Von drinnen: „Nie wieder Fusel ...“'],
      ['w', 'Damen-Kabine', 'Abgeschlossen. Seit 1998.'],
    ];
    for (const [ch, label, text] of spots) {
      const [x, y] = this.find(ch);
      this.interacts.push({ x: x * T + 8, y: (y + 1) * T + 6, r: 14, label: () => label, act: () => this.toast(text) });
    }
  }

  // ---------------------------------------------------------------- Stammgäste

  private setupGuests() {
    ensureGuests(state.time);
    for (const g of roster.guests) this.addGuestView(g);
    const onResume = () => this.afterFight();
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.RESUME, onResume));
  }

  private addGuestView(g: BarGuest) {
    const def = guestById(g.id);
    const [tx, ty, facing] = SEATS[g.seat];
    const x = tx * T + 8 + (facing === 'right' ? 2 : -2), y = ty * T + 13;
    const shadow = this.add.image(x, y - 1, 'shadow').setDepth(1);
    const sprite = this.add.sprite(x, y, `guest_${g.id}`, 6).setOrigin(0.5, 1).setScale(0.5).setDepth(y).setFlipX(facing === 'left');
    const view: GuestView = { g, def, sprite, shadow, baseX: x, baseY: y, nextTaunt: 0 };
    this.guestViews.set(g.id, view);
    this.interacts.push({
      x, y: y - 4, r: 18,
      label: () => (sprite.active && !g.rowdy && roster.guests.includes(g) ? `Mit ${def.name.split(' ').pop()} reden` : null),
      act: () => this.talk(g.id),
    });
    if (g.rowdy) this.setRowdy(view, true);
  }

  /** Pöbelnder Gast: steht auf, zappelt, läuft rot an. */
  private setRowdy(v: GuestView, on: boolean) {
    v.g.rowdy = on;
    this.tweens.killTweensOf(v.sprite);
    if (on) {
      v.sprite.setY(v.baseY - 3).setTint(0xffb0a0).setFrame(0).setFlipX(false);
      v.fidget = this.tweens.add({ targets: v.sprite, x: v.baseX + 1.5, angle: { from: -5, to: 5 }, duration: 70, yoyo: true, repeat: -1 });
      v.nextTaunt = 0;
    } else {
      v.sprite.setPosition(v.baseX, v.baseY).setAngle(0).clearTint();
    }
  }

  private startFight(v: GuestView) {
    if (this.leaving) return;
    this.scene.launch('Fight', { guestId: v.g.id, resume: 'Bar' });
    this.scene.bringToTop('Fight');
    this.scene.pause();
  }

  /** Nach dem Kampf: Gewinner/Verlierer in der Kneipe darstellen. */
  private afterFight() {
    const f = roster.lastFight;
    if (!f) return;
    roster.lastFight = null;
    roster.nextRowdy = state.time + 30 + Math.random() * 25;
    const v = this.guestViews.get(f.id);
    removeGuest(f.id);
    if (!v) return;
    this.guestViews.delete(f.id);
    this.tweens.killTweensOf(v.sprite);
    if (f.won) {
      // liegt k.o. am Boden und wird dann rausgetragen
      v.sprite.clearTint().setFrame(0).setAngle(90).setPosition(v.baseX, v.baseY + 4);
      this.tweens.add({ targets: [v.sprite, v.shadow], alpha: 0, delay: 3500, duration: 800, onComplete: () => { v.sprite.destroy(); v.shadow.destroy(); } });
      this.toast(`${v.def.name} ist erledigt. +${f.amount}€`);
    } else {
      v.sprite.clearTint().setAngle(0);
      this.tweens.add({ targets: [v.sprite, v.shadow], alpha: 0, y: '+=30', duration: 1200, onComplete: () => { v.sprite.destroy(); v.shadow.destroy(); } });
      this.toast(`Du wurdest verprügelt. ${v.def.name} haut ab.${f.amount ? ` -${f.amount}€` : ''}`);
    }
  }

  private updateGuests() {
    if (this.leaving) return;
    const now = this.time.now;
    // ab und zu fängt einer an zu pöbeln
    const views = [...this.guestViews.values()];
    if (state.running && !views.some((v) => v.g.rowdy) && views.length && state.time > roster.nextRowdy) {
      const v = Phaser.Utils.Array.GetRandom(views);
      this.setRowdy(v, true);
      roster.nextRowdy = state.time + 35 + Math.random() * 25;
      this.toast(`${v.def.name} fängt an zu pöbeln!`);
      audio.sfx('angry');
    }
    for (const v of views) {
      if (!v.g.rowdy) continue;
      if (now > v.nextTaunt) {
        floatText(this, v.sprite.x, v.sprite.y - 24, Phaser.Utils.Array.GetRandom(v.def.rowdy), '#ff8a7a');
        v.nextTaunt = now + 2600;
      }
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, v.sprite.x, v.sprite.y) < 24) return this.startFight(v);
    }
  }

  update(t: number, d: number) {
    super.update(t, d);
    this.updateGuests();
    if (this.victim && this.wishBubble && this.wishIcon) {
      this.victim.setTexture(`schnoesel${lookStage()}`, 3);
      this.wishBubble.setVisible(!!state.wish);
      if (state.wish) this.wishIcon.setTexture(`icon_${state.wish}`);
      (this.wishBubble.list[0] as Phaser.GameObjects.Image).setTint(impatient() ? 0xff7070 : 0xffffff);
    }
  }
}
