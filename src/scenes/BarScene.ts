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

// Kleine, gemütliche Kneipe. Hinter dem Tresen (oben links) ist das Reich des Wirts,
// rein kommt man durch die Klappe (F).
const MAP = [
  '##################',
  '#SSSSSS##WW##MNO##',
  '#......C.........#',
  '#CCCCCFC.........#',
  '#.s.s............#',
  '#..........rrrr..#',
  '#..hth.....rrrr.J#',
  '#................#',
  '#..hth....hth....#',
  '#................#',
  '####D#############',
];

export const BAR_START_SPAWN: [number, number] = [3, 2];
export const BAR_DOOR_SPAWN: [number, number] = [4, 9];
export const BAR_TRESEN_SPAWN: [number, number] = [4, 2];
const VICTIM_TILE: [number, number] = [4, 4];
const KALLE_TILE: [number, number] = [10, 8];

let coinsSpawned = false;
export function resetBar() {
  coinsSpawned = false;
  resetRoster();
}

const SCHLAGER = ['„Atemlos durch die Nacht“ läuft. Schon wieder.', '„Ein Bett im Kornfeld“. Kalle summt mit.', '„Griechischer Wein“. Irgendwer weint.', 'Die Jukebox frisst deine Münze nicht. Glück gehabt.'];
const KALLE = [
  'Kalle: „Zzz ... noch ein Korn, Chef ... zzz“',
  'Kalle: „Der Lackaffe da? Gib ihm, was er will. Dann zahlt er.“',
  'Kalle: „Nicht zu hastig, Chef. Sonst merkt er was.“',
  'Kalle: „Hinten in der Gasse steht einer, der hat ... Spezielles.“',
  'Kalle: „Die Katze draußen? Hat nur noch ein Auge. Das andere glüht. Die frisst alles. ALLES.“',
  'Kalle: „Sie nennen sie die Königskatze, Chef. Aber das ist kein König. Das ist ... die Pest.“',
  'Kalle: „In der Gasse läuft jetzt ein Bulle Streife. Pass auf seine Taschenlampe auf.“',
  'Kalle: „Lass den Lackaffen nicht warten, Chef. Ungeduldige Gäste werden misstrauisch.“',
  'Kalle: „Die Automaten da hinten? Die Risikoleiter hat mich mein Haus gekostet, Chef.“',
  'Kalle: „Buch der Ratte ... drei Bücher, Chef. Dann geht die Post ab.“',
  'Kalle: „Setz nie auf Schnecke. Ich weiß, wovon ich rede.“',
  'Kalle: „Mülltonnen, Chef. Da liegt oft noch Fusel drin.“',
  'Kalle: „Knapp bei Kasse? Die Damen in der Gasse haben Bares. Aber lass keine Leichen rumliegen, Chef.“',
];

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
  protected isWall(ch: string) { return '#SWDMNO'.includes(ch); }
  protected darkness() { return 0.3; }
  protected floorKey(x: number, y: number) {
    return this.rows[y][x] === 'r' ? 'rug' : `floor${(x * 7 + y * 3) % 3}`;
  }

  protected tileFor(ch: string): TileInfo {
    switch (ch) {
      case '#': return { key: 'wallFront', solid: true };
      case 'S': return { key: 'shelf', solid: true };
      case 'W': return { key: 'window', solid: true };
      case 'D': return { key: 'doorBottom', solid: true };
      case 'M': return { key: 'cab_sahne', solid: true };
      case 'N': return { key: 'cab_ratte', solid: true };
      case 'O': return { key: 'cab_derby', solid: true };
      case 'C': return { key: 'counter', solid: true, object: true };
      case 'F': return { key: 'counterFlap', solid: false };
      case 't': return { key: 'table', solid: true, object: true };
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
      this.victim = this.add.sprite(vx * T + 8, vy * T + 12, `schnoesel${lookStage()}`, 3).setOrigin(0.5, 1).setDepth(vy * T + 12);
      this.add.image(this.victim.x, this.victim.y - 1, 'shadow').setDepth(1);
      this.wishIcon = this.add.image(0, 0, 'icon_bier').setScale(0.6);
      this.wishBubble = this.add.container(this.victim.x + 9, this.victim.y - 26, [this.add.image(0, 0, 'bubble'), this.wishIcon]).setDepth(4000);
      this.tweens.add({ targets: this.wishBubble, y: this.wishBubble.y - 2, duration: 700, yoyo: true, repeat: -1 });
    } else if (!state.carrying && !state.bodyInAlley) {
      this.body = this.add.sprite(vx * T + 8, (vy + 1) * T + 6, `schnoesel${lookStage()}`, 0).setAngle(90).setDepth((vy + 1) * T);
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
        if (!state.dead) return `${VICTIM}`;
        return this.body?.active ? 'Leiche schultern' : null;
      },
      act: () => {
        if (!state.dead) return this.toast('Ein Wirt bedient von HINTER dem Tresen. Rein durch die Klappe.');
        if (this.body?.active) {
          this.body.destroy();
          state.carrying = true;
          this.carried = this.add.sprite(0, 0, `schnoesel${lookStage()}`, 0).setAngle(90);
          this.toast('Uff. Schwerer als er aussah.');
          audio.sfx('thud');
        }
      },
    });

    // Stammgast Kalle pennt am Tisch
    const [kx, ky] = KALLE_TILE;
    const kalle = this.add.sprite(kx * T + 6, ky * T + 12, 'penner', 6).setOrigin(0.5, 1).setDepth(ky * T + 12);
    this.tweens.add({ targets: kalle, angle: 8, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({
      delay: 2200, loop: true,
      callback: () => {
        const z = this.add.text(kalle.x + 4, kalle.y - 22, 'z', { fontFamily: 'monospace', fontSize: '8px', color: '#c8c8e8' }).setDepth(6000);
        this.tweens.add({ targets: z, x: z.x + 8, y: z.y - 14, alpha: 0, duration: 1800, onComplete: () => z.destroy() });
      },
    });
    this.interacts.push({ x: kalle.x, y: kalle.y - 4, r: 20, label: () => 'Kalle wecken', act: () => this.toast(Phaser.Utils.Array.GetRandom(KALLE)) });

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

    this.interacts.push({ x: 16 * T + 8, y: 6 * T + 12, r: 20, label: () => 'Jukebox', act: () => this.toast(Phaser.Utils.Array.GetRandom(SCHLAGER)) });
    this.interacts.push({ x: 4 * T + 8, y: 10 * T, r: 18, label: () => 'Raus in die Gasse', act: () => this.go('Alley', { spawn: [2, 2] }) });

    if (!coinsSpawned) {
      coinsSpawned = true;
      for (let i = 0; i < 2; i++) this.spawnCoin(...this.randomFloorTile());
    }

    this.setupGuests();

    for (const [x, y] of [[4, 3], [4, 7], [11, 8], [13, 5], [16, 6]]) this.addLight(x * T, y * T, 0.9, 0.7);
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
    const sprite = this.add.sprite(x, y, `guest_${g.id}`, 6).setOrigin(0.5, 1).setDepth(y).setFlipX(facing === 'left');
    const view: GuestView = { g, def, sprite, shadow, baseX: x, baseY: y, nextTaunt: 0 };
    this.guestViews.set(g.id, view);
    this.interacts.push({
      x, y: y - 4, r: 18,
      label: () => (sprite.active && !g.rowdy && roster.guests.includes(g) ? `Mit ${def.name} plaudern` : null),
      act: () => this.toast(`${def.name.split(' ').pop()}: „${Phaser.Utils.Array.GetRandom(def.calm)}“`),
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
