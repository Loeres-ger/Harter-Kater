import Phaser from 'phaser';
import { audio } from '../audio';
import { bulky, lookStage, speedy, state } from '../state';
import { fadeTo, floatText } from '../ui';
import { hud, toast } from './HudScene';
import { touch } from '../touch';
import type { DialogAction } from '../dialog/data';
import { naechsterStrang, starteStrang } from '../progress/quests';
import { SPEAKERS } from '../dialog/data';
import { MapData, MapObject, MapZone, bedingungErfuellt, zoneGesperrt } from '../maps/types';
import { MAP_DEFS } from '../maps/palettes';
import { LightHint, streetCell, streetLights } from '../maps/streetView';

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
  /** nach einem Gespräch kurz keine neue Aktion, sonst öffnet Weiterdrücken gleich das nächste */
  private actBlockedUntil = 0;
  private ghostT = 0;
  /** keine Interaktionen (z. B. während eines Events mit Zeitlimit) */
  protected actsBlocked = false;
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
    this.lightSources = [];
    this.mapLamps = [];
    this.lightRT = undefined;
    this.leaving = false;
    this.actBlockedUntil = 0;
    this.actsBlocked = false;
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

    // Außenkarten (maps/*.json) zeichnet die gemeinsame Straßenansicht – dieselbe Regel wie im Map-Editor
    const md = this.mapData();
    const sdef = md ? MAP_DEFS[md.id] : undefined;
    for (let y = 0; y < mh; y++) {
      this.solid[y] = [];
      for (let x = 0; x < mw; x++) {
        const ch = this.rows[y][x];
        const px = x * T, py = y * T;
        const info = this.tileFor(ch, x, y);
        if (sdef) {
          const c = streetCell(this.rows, sdef, x, y);
          if (c.floor) this.add.image(px, py, c.floor).setOrigin(0).setScale(0.5).setDepth(0);
          for (const o of c.overlays) this.add.image(px, py, o).setOrigin(0).setScale(0.5).setDepth(0.6);
          if (c.key && this.textures.exists(c.key)) this.add.image(px, py, c.key).setOrigin(0).setScale(0.5).setDepth(c.building ? 0.4 : c.object ? py + T : 0.5);
          this.solid[y][x] = info.solid;
          continue;
        }
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

    // Karten aus dem Map-Editor: Objekte, Zonen und Kollisions-Korrekturen, Lichter aus der Straßenansicht
    if (md) this.applyMap(md);
    if (sdef) for (const h of streetLights(this.rows, sdef)) this.hintLight(h);

    // Spawns stehen in Koordinaten der ursprünglichen Karte; wurde sie im Editor nach oben/links erweitert, wandern sie mit
    const [ox, oy] = this.origin();
    const [sx, sy] = (data?.spawn ?? [2, 2]).map((v, i) => v + (i ? oy : ox));
    this.shadow = this.add.image(0, 0, 'shadow').setDepth(1);
    this.player = this.add.sprite(sx * T + 8, sy * T + 14, 'wirt', 0).setOrigin(0.5, 1).setScale(0.5);

    this.setupWorld();

    if (state.carrying) this.carried = this.add.sprite(0, 0, `schnoesel${lookStage()}`, 0).setAngle(90).setScale(0.5);

    // Stimmung: Lichtkarte. Die Dunkelheit liegt über der Welt, jede Lichtquelle (addLight) radiert einen weichen Lichtkegel
    // hinein. So hellt eine Laterne ihre Umgebung wirklich auf, statt nur einen Leuchtfleck darüber zu legen.
    this.lightRT = this.add.renderTexture(-T, -T, (mw + 2) * T, (mh + 2) * T).setOrigin(0).setDepth(5000);
    this.lightStamp = this.make.image({ key: this.textures.exists('lightPool') ? 'lightPool' : 'light', add: false });
    this.drawLights();

    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    cam.setBounds(0, -12, mw * T, mh * T + 22); // Platz für HUD-Leisten
    cam.startFollow(this.player, true, 0.12, 0.12);
    // kleine Totzone: Schritte hin und her bewegen die Kamera nicht, Richtungswechsel wirken ruhig
    cam.setDeadzone(18, 10);
    // auf den Oberkörper statt auf die Füße zielen: so bleibt über dem Wirt mehr Platz, Schilder über Türen
    // verschwinden nicht unter der oberen HUD-Leiste
    // Außenkarten: weiter nach oben schauen, damit Obergeschoss und Gesims der Fassaden im Bild sind (Blick die Straße
    // entlang auf die Häuser, nicht auf leeren Asphalt)
    cam.setFollowOffset(0, sdef ? 26 : 14);
    cam.setRoundPixels(true);
    cam.setBackgroundColor('#0a0608');
    cam.fadeIn(260);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,E,R,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.E.on('down', () => this.act());
    this.keys.SPACE.on('down', () => this.act());
    this.keys.R.on('down', () => this.current?.alt?.());

    hud.prompt = '';
    hud.goal = this.goalText();
    hud.alert = '';
    this.scene.run('Hud');
    this.scene.bringToTop('Hud');
    touch.onAction = () => this.scene.isActive() && this.act();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.sleep('Hud');
      touch.onAction = null;
    });
  }

  // ---------------------------------------------------------------- Karten aus dem Map-Editor

  /** Kartendaten (maps/*.json), falls die Szene ihre Karte daraus lädt */
  protected mapData(): MapData | undefined {
    return undefined;
  }

  /** Verschiebung der Karte durch Erweiterung nach oben/links (Kacheln) */
  protected origin(): [number, number] {
    const o = this.mapData()?.origin;
    return [o?.x ?? 0, o?.y ?? 0];
  }

  /** feste Kachel aus dem Spielcode auf die (eventuell erweiterte) Karte umrechnen */
  protected at([x, y]: [number, number]): [number, number] {
    const [ox, oy] = this.origin();
    return [x + ox, y + oy];
  }

  private applyMap(md: MapData) {
    const f = state.flags;
    const set = (k: string, v: boolean) => {
      const [x, y] = k.split(',').map(Number);
      if (this.solid[y]?.[x] !== undefined) this.solid[y][x] = v;
    };
    md.collision?.block?.forEach((k) => set(k, true));
    md.collision?.free?.forEach((k) => set(k, false));
    // gesperrte Bereiche (Baustelle bis zum Ende der Glanz-Mission, Quest-Flag, dauerhaft, reserviert)
    for (const z of md.zones ?? []) {
      if (!zoneGesperrt(z, f)) continue;
      for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) set(`${x},${y}`, true);
      this.drawZone(z);
    }
    for (const o of md.objects ?? []) if (bedingungErfuellt(f, o.bedingung)) this.placeMapObject(o);
  }

  private drawZone(z: MapZone) {
    const x = z.x * T, y = z.y * T, w = z.w * T, h = z.h * T;
    const g = this.add.graphics().setDepth(y + h);
    if (z.state === 'reserviert') {
      g.fillStyle(0x000000, 1).fillRect(x, y, w, h); // noch nicht erschlossen: schwarz
      return;
    }
    if (z.state === 'baustelle') {
      // Absperrgitter der Glanzbau Corporation: rot-weiße Baken an den Rändern
      g.fillStyle(0x000000, 0.25).fillRect(x, y, w, h);
      for (let i = 0; i < w; i += 8) for (const yy of [y + 2, y + h - 6]) g.fillStyle((i / 8) % 2 ? 0xffffff : 0xd02a2a).fillRect(x + i, yy, 8, 4);
      for (let i = 0; i < h; i += 8) for (const xx of [x + 2, x + w - 6]) g.fillStyle((i / 8) % 2 ? 0xffffff : 0xd02a2a).fillRect(xx, y + i, 4, 8);
      const t = this.add.text(x + w / 2, y + h / 2, z.label || 'GLANZBAU\nBAUSTELLE', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#f8e070', align: 'center' })
        .setOrigin(0.5).setResolution(2).setScale(0.5).setDepth(y + h + 1).setStroke('#120c0b', 3);
      void t;
      return;
    }
    // gesperrt / Quest: dunkles Gitter
    g.fillStyle(0x0a0a10, 0.55).fillRect(x, y, w, h);
    g.lineStyle(1, 0x6a6a7a, 0.9);
    for (let i = 0; i <= w; i += 4) g.lineBetween(x + i, y, x + i, y + h);
  }

  private placeMapObject(o: MapObject) {
    const depth = o.ebene === 'boden' ? 0.6 : o.ebene === 'vorne' ? 5003 : o.y;
    if (o.solid) this.solid[Math.floor((o.y - 2) / T)]?.splice(Math.floor(o.x / T), 1, true);
    if (o.kind === 'deko' || o.kind === 'npc') {
      if (!o.key || !this.textures.exists(o.key)) return;
      this.add.sprite(o.x, o.y, o.key, o.frame ?? 0).setOrigin(0.5, 1).setScale(0.5 * (o.scale ?? 1)).setFlipX(!!o.flipX).setDepth(depth);
      if (o.kind === 'npc') {
        this.add.image(o.x, o.y - 1, 'shadow').setDepth(1);
        const who = o.talk;
        if (who && SPEAKERS[who]) this.interacts.push({ x: o.x, y: o.y - 4, r: 18, label: () => o.label || `Mit ${SPEAKERS[who].name} reden`, act: () => this.talk(who) });
      }
    } else if (o.kind === 'schild') {
      this.add.text(o.x, o.y, o.text ?? '', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#f4ead0', backgroundColor: '#120c0bcc', padding: { x: 3, y: 2 }, align: 'center' })
        .setOrigin(0.5, 1).setResolution(2).setScale(0.5 * (o.scale ?? 1)).setDepth(depth);
    } else if (o.kind === 'interaktion') {
      this.interacts.push({ x: o.x, y: o.y, r: 16, label: () => o.label || 'Ansehen', act: () => this.toast(o.text ?? '...') });
    }
  }

  // ---------------------------------------------------------------- Helfer für Unterklassen

  /** Lichtquelle: weicher Schein (ADD) plus Lichtkegel in der Lichtkarte. Alpha/Sichtbarkeit des Bildes steuern beides. */
  protected addLight(x: number, y: number, scale = 1, alpha = 0.8, pool = true) {
    const l = this.add.image(x, y, this.textures.exists('lightSoft') ? 'lightSoft' : 'light').setBlendMode(Phaser.BlendModes.ADD).setDepth(5001).setScale(scale).setAlpha(alpha);
    this.tweens.add({ targets: l, alpha: alpha * 0.8, duration: 900 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (pool) this.lightSources.push(l);
    return l;
  }

  /** Licht aus der Straßenansicht; Laternen merkt sich die Szene (z. B. zum Flackern) */
  protected mapLamps: Phaser.GameObjects.Image[] = [];
  private hintLight(h: LightHint) {
    const l = this.addLight(h.x, h.y, h.scale, h.alpha, h.pool).setTint(h.tint);
    if (h.kind === 'lamp') this.mapLamps.push(l);
    if (h.reflect) {
      // Spiegelung auf nassem Pflaster: schmaler, senkrechter Schein unter der Lichtquelle
      const s = this.add.image(h.x, h.y + 10, 'lightSoft').setBlendMode(Phaser.BlendModes.ADD).setScale(0.12, 0.55).setTint(h.tint).setAlpha(0.35).setDepth(2);
      this.tweens.add({ targets: s, scaleX: 0.1, alpha: 0.25, duration: 1300 + Math.random() * 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private lightRT?: Phaser.GameObjects.RenderTexture;
  private lightStamp?: Phaser.GameObjects.Image;
  private lightSources: Phaser.GameObjects.Image[] = [];

  /** Lichtkarte neu zeichnen: Dunkelheit füllen, Lichtkegel aller sichtbaren Lichtquellen herausradieren. */
  private drawLights() {
    const rt = this.lightRT, st = this.lightStamp;
    if (!rt || !st) return;
    rt.clear().fill(0x0a0612, this.darkness());
    for (const l of this.lightSources) {
      if (!l.active || !l.visible || l.alpha < 0.02) continue;
      st.setPosition(l.x + T, l.y + T).setScale(l.scaleX * 1.15, l.scaleY * 1.15).setAlpha(Math.min(1, l.alpha * 1.25));
      rt.erase(st);
    }
  }

  protected toast(s: string) {
    toast(s);
  }

  protected float(s: string, color = '#f8e070') {
    floatText(this, this.player.x, this.player.y - 24, s, color);
  }

  private act() {
    if (this.actsBlocked || this.time.now < this.actBlockedUntil) return;
    this.current?.act();
  }

  /** Gespräch unter vier Augen öffnen; diese Szene pausiert so lange. */
  protected talk(who: string, onDone?: (action?: DialogAction) => void) {
    if (this.leaving) return;
    hud.prompt = '';
    this.events.once(Phaser.Scenes.Events.RESUME, () => (this.actBlockedUntil = this.time.now + 450));
    this.scene.launch('Dialog', { who, resume: this.scene.key, onDone });
    this.scene.bringToTop('Dialog');
    this.scene.pause();
  }

  protected go(key: string, data?: object) {
    if (this.leaving) return;
    this.leaving = true;
    hud.prompt = '';
    fadeTo(this, key, data);
  }

  /**
   * Offene Welt: kurz nach dem Betreten prüfen, ob eine neue Story-Fortsetzung ansteht (siehe progress/quests.ts).
   * Höchstens eine Einleitung auf einmal; nie mit Leiche auf der Schulter oder laufender Frist.
   */
  protected scheduleStory(blocked: () => boolean = () => false) {
    this.time.delayedCall(900, () => {
      if (this.leaving || blocked() || state.carrying || state.bodyDeadline !== null || state.gameOver || !state.running) return;
      const s = naechsterStrang(state.flags, state.time);
      if (!s) return;
      starteStrang(s, state.flags, state.time);
      const [ox, oy] = this.origin();
      const here: [number, number] = [Math.floor(this.player.x / T) - ox, Math.round((this.player.y - 14) / T) - oy];
      this.go('Cutscene', { script: s.script, next: { scene: s.danach?.scene ?? this.scene.key, data: { spawn: s.danach?.spawn ?? here } } });
    });
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
    this.drawLights();
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
    const speed = (state.carrying || this.slow ? 46 : 74) * (speedy() ? 1.5 : 1) * (delta / 1000);
    const dx = (vx / len) * speed, dy = (vy / len) * speed;
    const p = this.player;
    const feetY = p.y - 3;
    if (dx && !this.blocked(p.x + dx, feetY)) p.x += dx;
    if (dy && !this.blocked(p.x, feetY + dy)) p.y += dy;

    // rote Pille: breit wie ein Schrank
    if (bulky()) p.setScale(0.76, 0.54);
    else p.setScale(0.5);
    // blaue Pille: Nachbilder hinter dem Wirt
    if (speedy() && (vx || vy)) {
      this.ghostT -= delta;
      if (this.ghostT <= 0) {
        this.ghostT = 70;
        const g = this.add.image(p.x, p.y, p.texture.key, p.frame.name).setOrigin(0.5, 1).setScale(p.scaleX, p.scaleY).setFlipX(p.flipX)
          .setTint(0x60c8ff).setAlpha(0.5).setDepth(p.y - 1);
        this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
      }
    }

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
    hud.prompt = best && !this.actsBlocked ? `[E] ${best.label()}` : '';
    hud.goal = this.goalText();
  }
}
