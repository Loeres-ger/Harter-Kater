import Phaser from 'phaser';
import { audio } from '../audio';
import { VICTIM, impatient, lookStage, state } from '../state';
import { T, TileInfo, TopDown } from './TopDown';

// Kleine, gemütliche Kneipe. Hinter dem Tresen (oben links) ist das Reich des Wirts,
// rein kommt man durch die Klappe (F).
const MAP = [
  '##################',
  '#SSSSSS##WW###WW##',
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
  'Kalle: „Mülltonnen, Chef. Da liegt oft noch Fusel drin.“',
  'Kalle: „Knapp bei Kasse? Die Damen in der Gasse haben Bares. Aber lass keine Leichen rumliegen, Chef.“',
];

export class BarScene extends TopDown {
  private victim?: Phaser.GameObjects.Sprite;
  private wishBubble?: Phaser.GameObjects.Container;
  private wishIcon?: Phaser.GameObjects.Image;
  private body?: Phaser.GameObjects.Sprite;

  constructor() {
    super('Bar');
  }

  init() {
    super.init();
    this.victim = this.wishBubble = this.wishIcon = this.body = undefined;
  }

  protected mapRows() { return MAP; }
  protected isWall(ch: string) { return '#SWD'.includes(ch); }
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

    this.interacts.push({ x: 16 * T + 8, y: 6 * T + 12, r: 20, label: () => 'Jukebox', act: () => this.toast(Phaser.Utils.Array.GetRandom(SCHLAGER)) });
    this.interacts.push({ x: 4 * T + 8, y: 10 * T, r: 18, label: () => 'Raus in die Gasse', act: () => this.go('Alley', { spawn: [2, 2] }) });

    if (!coinsSpawned) {
      coinsSpawned = true;
      for (let i = 0; i < 2; i++) this.spawnCoin(...this.randomFloorTile());
    }

    for (const [x, y] of [[4, 3], [4, 7], [11, 8], [13, 5], [16, 6]]) this.addLight(x * T, y * T, 0.9, 0.7);
  }

  update(t: number, d: number) {
    super.update(t, d);
    if (this.victim && this.wishBubble && this.wishIcon) {
      this.victim.setTexture(`schnoesel${lookStage()}`, 3);
      this.wishBubble.setVisible(!!state.wish);
      if (state.wish) this.wishIcon.setTexture(`icon_${state.wish}`);
      (this.wishBubble.list[0] as Phaser.GameObjects.Image).setTint(impatient() ? 0xff7070 : 0xffffff);
    }
  }
}
