import Phaser from 'phaser';
import { audio } from '../audio';
import { lookStage, state } from '../state';
import { fadeTo, floatText } from '../ui';
import { hud, toast } from './HudScene';
import { touch } from '../touch';

export const T = 16;
const ZOOM = 2;

export interface Interact {
  x: number;
  y: number;
  r: number;
  label: () => string | null;
  act: () => void;
  alt?: () => void;
}

export interface TileInfo {
  key: string;
  solid: boolean;
  /** Objekt auf Bodenkachel (wird y-sortiert) */
  object?: boolean;
}

/** Basis für die begehbaren Draufsicht-Szenen (Bar, Gasse). */
export abstract class TopDown extends Phaser.Scene {
  protected rows: string[] = [];
  protected solid: boolean[][] = [];
  protected player!: Phaser.GameObjects.Sprite;
  protected shadow!: Phaser.GameObjects.Image;
  protected carried?: Phaser.GameObjects.Sprite;
  protected interacts: Interact[] = [];
  private facing: 'down' | 'up' | 'side' = 'down';
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private current: Interact | null = null;
  protected leaving = false;
  /** langsamer laufen (z. B. beim Tragen) */
  protected slow = false;
  private stepT = 0;

  protected abstract mapRows(): string[];
  protected abstract tileFor(ch: string, x: number, y: number): TileInfo;
  protected abstract floorKey(x: number, y: number): string;
  protected abstract isWall(ch: string): boolean;
  protected abstract setupWorld(): void;
  protected abstract darkness(): number;
  protected abstract goalText(): string;

  init() {
    this.interacts = [];
    this.leaving = false;
    this.carried = undefined;
    this.current = null;
    this.slow = false;
  }

  create(data: { spawn?: [number, number] }) {
    this.rows = this.mapRows();
    const mw = Math.max(...this.rows.map((r) => r.length));
    this.rows = this.rows.map((r) => r.padEnd(mw, '.'));
    const mh = this.rows.length;
    this.solid = [];

    for (let y = 0; y < mh; y++) {
      this.solid[y] = [];
      for (let x = 0; x < mw; x++) {
        const ch = this.rows[y][x];
        const px = x * T, py = y * T;
        const info = this.tileFor(ch, x, y);
        if (this.isWall(ch)) {
          const below = this.rows[y + 1]?.[x];
          const front = below !== undefined && !this.isWall(below);
          const key = front ? info.key : info.key.replace('Front', 'Top');
          this.add.image(px, py, this.textures.exists(key) ? key : info.key).setOrigin(0).setScale(0.5).setDepth(front ? 1 : 0);
          this.solid[y][x] = true;
          continue;
        }
        this.add.image(px, py, this.floorKey(x, y)).setOrigin(0).setScale(0.5).setDepth(0);
        if (info.key) this.add.image(px, py, info.key).setOrigin(0).setScale(0.5).setDepth(info.object ? py + T : 0.5);
        this.solid[y][x] = info.solid;
      }
    }

    const [sx, sy] = data?.spawn ?? [2, 2];
    this.shadow = this.add.image(0, 0, 'shadow').setDepth(1);
    this.player = this.add.sprite(sx * T + 8, sy * T + 14, 'wirt', 0).setOrigin(0.5, 1).setScale(0.5);

    this.setupWorld();

    if (state.carrying) this.carried = this.add.sprite(0, 0, `schnoesel${lookStage()}`, 0).setAngle(90).setScale(0.5);

    // Stimmung: Abdunkeln, Lichter liegen darüber (addLight)
    this.add.rectangle(-T, -T, (mw + 2) * T, (mh + 2) * T, 0x0a0610, this.darkness()).setOrigin(0).setDepth(5000);

    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    cam.setBounds(0, -12, mw * T, mh * T + 22); // Platz für HUD-Leisten
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setRoundPixels(true);
    cam.setBackgroundColor('#0a0608');
    cam.fadeIn(260);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,E,R,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.E.on('down', () => this.current?.act());
    this.keys.SPACE.on('down', () => this.current?.act());
    this.keys.R.on('down', () => this.current?.alt?.());

    hud.prompt = '';
    hud.goal = this.goalText();
    hud.alert = '';
    this.scene.run('Hud');
    this.scene.bringToTop('Hud');
    touch.onAction = () => this.scene.isActive() && this.current?.act();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.sleep('Hud');
      touch.onAction = null;
    });
  }

  // ---------------------------------------------------------------- Helfer für Unterklassen

  protected addLight(x: number, y: number, scale = 1, alpha = 0.8) {
    const l = this.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setDepth(5001).setScale(scale).setAlpha(alpha);
    this.tweens.add({ targets: l, alpha: alpha * 0.8, duration: 900 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return l;
  }

  protected toast(s: string) {
    toast(s);
  }

  protected float(s: string, color = '#f8e070') {
    floatText(this, this.player.x, this.player.y - 24, s, color);
  }

  protected go(key: string, data?: object) {
    if (this.leaving) return;
    this.leaving = true;
    hud.prompt = '';
    fadeTo(this, key, data);
  }

  protected randomFloorTile(): [number, number] {
    for (let i = 0; i < 200; i++) {
      const y = Phaser.Math.Between(1, this.rows.length - 2);
      const x = Phaser.Math.Between(1, this.rows[0].length - 2);
      if (!this.solid[y][x] && this.rows[y][x] === '.') return [x, y];
    }
    return [2, 2];
  }

  protected spawnCoin(tx: number, ty: number) {
    const c = this.add.image(tx * T + 8, ty * T + 10, 'coin').setScale(0.5).setDepth(ty * T + 10);
    this.tweens.add({ targets: c, y: c.y - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.interacts.push({
      x: c.x, y: c.y, r: 12,
      label: () => (c.active ? 'Münze aufheben' : null),
      act: () => {
        if (!c.active) return;
        const v = Phaser.Math.Between(1, 3);
        state.money += v;
        this.float(`+${v}€`);
        audio.sfx('coin');
        c.destroy();
      },
    });
  }

  // ---------------------------------------------------------------- Bewegung

  private blocked(x: number, y: number) {
    const hw = 3.5, hh = 2.5;
    for (const [cx, cy] of [[x - hw, y - hh], [x + hw, y - hh], [x - hw, y + hh], [x + hw, y + hh]]) {
      const tx = Math.floor(cx / T), ty = Math.floor(cy / T);
      if (this.solid[ty]?.[tx] ?? true) return true;
    }
    return false;
  }

  update(_t: number, delta: number) {
    if (state.gameOver === 'flucht' || state.gameOver === 'polizei') {
      state.running = false;
      this.go('End');
    }
    if (this.leaving) return;

    const k = this.keys, c = this.cursors;
    let vx = 0, vy = 0;
    if (k.A.isDown || c.left.isDown) vx -= 1;
    if (k.D.isDown || c.right.isDown) vx += 1;
    if (k.W.isDown || c.up.isDown) vy -= 1;
    if (k.S.isDown || c.down.isDown) vy += 1;
    // Touch-Joystick
    vx += touch.vx;
    vy += touch.vy;
    const len = Math.hypot(vx, vy) || 1;
    const speed = (state.carrying || this.slow ? 46 : 74) * (delta / 1000);
    const dx = (vx / len) * speed, dy = (vy / len) * speed;
    const p = this.player;
    const feetY = p.y - 3;
    if (dx && !this.blocked(p.x + dx, feetY)) p.x += dx;
    if (dy && !this.blocked(p.x, feetY + dy)) p.y += dy;

    if (vx || vy) {
      if (vx) this.facing = 'side';
      else this.facing = vy < 0 ? 'up' : 'down';
      if (this.facing === 'side') p.setFlipX(vx < 0);
      p.anims.play(`wirt_${this.facing}`, true);
      this.stepT -= delta;
      if (this.stepT <= 0) {
        audio.sfx('step');
        this.stepT = state.carrying || this.slow ? 420 : 290;
      }
    } else {
      p.anims.stop();
      p.setFrame(this.facing === 'down' ? 0 : this.facing === 'up' ? 3 : 6);
    }
    p.setDepth(p.y);
    this.shadow.setPosition(p.x, p.y - 1);
    if (this.carried) this.carried.setPosition(p.x, p.y - 22).setDepth(p.y + 1);

    // Nächste Interaktion
    let best: Interact | null = null, bestD = Infinity;
    for (const it of this.interacts) {
      const d = Phaser.Math.Distance.Between(p.x, p.y - 4, it.x, it.y);
      if (d < it.r && d < bestD && it.label()) { best = it; bestD = d; }
    }
    this.current = best;
    hud.prompt = best ? `[E] ${best.label()}` : '';
    hud.goal = this.goalText();
  }
}
