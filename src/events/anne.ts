import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { humanSheet } from '../gfx';
import { bust } from '../guests/gfx';
import { unlock } from '../progress/achievements';
import { floatText } from '../ui';

// Event „Anne“: Beim dritten Betreten der Kneipe kommt ein kleines Mädchen herein. Der Wirt will sie
// rausschicken, sie hält das für ein Spiel: 30 Sekunden Fangen. Erwischt der Wirt sie, bringt er sie an
// der Hand zur Tür (Achievement). Sonst holt Polizist Felix sie ab, und der Wirt hat danach genau 5 € übrig.
// Läuft einmal pro Spiel (Story-Flags lokalBetreten / anne).

const T = 16;
/** beim wievielten Betreten der Kneipe Anne auftaucht */
export const ANNE_EINTRITT = 3;
const CHASE_SECONDS = 30;
/** Anne ist schneller als der Wirt (74) */
const ANNE_SPEED = 90;
const CATCH_DIST = 13;
const ANNE_SCALE = 0.38;
/** Kontostand nach der Strafe */
export const ANNE_STRAFE_REST = 5;

/** Was das Event von der Kneipe braucht. */
export interface EventHost {
  scene: Phaser.Scene;
  player: Phaser.GameObjects.Sprite;
  /** darf Anne (und der Wirt beim Hinausbringen) auf dieser Kachel laufen? */
  walkable(tx: number, ty: number): boolean;
  /** Kachel der Vordertür (Wand) */
  door: [number, number];
  /** Spieler einfrieren (Bewegung und Türen) */
  lock(on: boolean): void;
  /** alle Interaktionen sperren (keine Dialoge, Türen, Automaten während der Jagd) */
  blockActs(on: boolean): void;
  /** Schatten und Tiefe des Spielers nach einer gescripteten Bewegung nachziehen */
  syncPlayer(): void;
  toast(s: string): void;
  talk(who: string, onDone: () => void): void;
  setAlert(s: string): void;
}

/** Steht das Event an? */
export function anneDue() {
  const f = state.flags;
  return (f.lokalBetreten ?? 0) >= ANNE_EINTRITT && !f.anne;
}

/** Ein Betreten der Kneipe von draußen zählen. */
export function countBarEntry() {
  state.flags.lokalBetreten = (state.flags.lokalBetreten ?? 0) + 1;
}

const ANNE_PAL = { skin: '#f8d8c0', hair: '#7a4a26', coat: '#e06090', coat2: '#c04878', pants: '#f4f0e8', shoes: '#c02030', skirt: '#e06090', apron: '#e06090', longHair: true };

export function makeAnneTextures(scene: Phaser.Scene) {
  if (scene.textures.exists('anne')) return;
  humanSheet(scene, 'anne', ANNE_PAL);
  const a = scene.anims;
  a.create({ key: 'anne_down', frames: [1, 0, 2, 0].map((f) => ({ key: 'anne', frame: f })), frameRate: 12, repeat: -1 });
  a.create({ key: 'anne_up', frames: [4, 3, 5, 3].map((f) => ({ key: 'anne', frame: f })), frameRate: 12, repeat: -1 });
  a.create({ key: 'anne_side', frames: [7, 6, 8, 6].map((f) => ({ key: 'anne', frame: f })), frameRate: 12, repeat: -1 });
  bust(scene, 'nbust_anne', { skin: '#f8d8c0', hair: '#7a4a26', style: 'long', outfit: 'hoodie', top: '#e06090', top2: '#c04878', accent: '#f8f0f8', baby: true }, 'happy');
}

type Tile = [number, number];

export class AnneEvent {
  /** läuft das Event gerade (dann keine Schlägereien, keine Interaktionen) */
  active = false;
  private anne?: Phaser.GameObjects.Sprite;
  private chase = false;
  private timeLeft = CHASE_SECONDS;
  private timer?: Phaser.Time.TimerEvent;
  private path: Tile[] = [];
  private retargetAt = 0;
  private nextTaunt = 0;
  private nextDust = 0;

  constructor(private h: EventHost) {}

  private get scene() { return this.h.scene; }

  // ---------------------------------------------------------------- Ablauf

  /** Anne kommt durch die Vordertür herein, danach startet das Gespräch. */
  start() {
    state.flags.anne = 'laeuft';
    this.active = true;
    this.h.lock(true);
    this.h.blockActs(true);
    const [dx, dy] = this.h.door;
    const a = this.scene.add.sprite(dx * T + 8, dy * T + 14, 'anne', 3).setOrigin(0.5, 1).setScale(ANNE_SCALE).setAlpha(0).setDepth(dy * T + 14);
    this.anne = a;
    audio.sfx('bell');
    this.h.toast('Die Tür geht auf. Ein kleines Mädchen tapst herein.');
    this.scene.tweens.add({ targets: a, alpha: 1, duration: 300 });
    this.walk(a, 'anne', [[dx, dy - 1], [dx + 1, dy - 3]], 50).then(() => {
      a.setFrame(0);
      // schaut sich staunend um
      this.scene.time.addEvent({ delay: 400, repeat: 2, callback: () => a.setFlipX(!a.flipX) });
      this.scene.time.delayedCall(1400, () => {
        this.h.lock(false);
        this.h.talk('anne', () => this.beginChase());
      });
    });
  }

  private beginChase() {
    if (this.chase || !this.anne) return;
    this.h.lock(false);
    this.h.blockActs(true);
    this.chase = true;
    this.timeLeft = CHASE_SECONDS;
    this.h.setAlert(this.alertText());
    audio.sfx('chime');
    this.timer = this.scene.time.addEvent({
      delay: 1000, repeat: CHASE_SECONDS - 1,
      callback: () => {
        this.timeLeft--;
        this.h.setAlert(this.alertText());
        if (this.timeLeft <= 5 && this.timeLeft > 0) audio.sfx('blip');
        if (this.timeLeft <= 0) this.fail();
      },
    });
    this.retargetAt = 0;
  }

  private alertText() {
    return `ANNE FANGEN: ${this.timeLeft}s`;
  }

  /** jedes Bild aus BarScene.update */
  update(time: number, delta: number) {
    const a = this.anne;
    if (!this.chase || !a) return;
    const p = this.h.player;
    if (Phaser.Math.Distance.Between(p.x, p.y, a.x, a.y) < CATCH_DIST) return this.caught();

    if (!this.path.length || time > this.retargetAt) this.newTarget(time);
    const next = this.path[0];
    if (next) {
      const tx = next[0] * T + 8, ty = next[1] * T + 14;
      const dx = tx - a.x, dy = ty - a.y, d = Math.hypot(dx, dy);
      const step = ANNE_SPEED * (delta / 1000);
      if (d <= step) { a.setPosition(tx, ty); this.path.shift(); }
      else a.setPosition(a.x + (dx / d) * step, a.y + (dy / d) * step);
      this.face(a, 'anne', dx, dy);
      a.setDepth(a.y);
    }
    // kleine Staubwolken, Kichern
    if (time > this.nextDust) {
      this.nextDust = time + 140;
      const puff = this.scene.add.image(a.x, a.y - 1, 'dust').setScale(0.35).setAlpha(0.6).setDepth(a.y - 1);
      this.scene.tweens.add({ targets: puff, alpha: 0, scale: 0.6, duration: 400, onComplete: () => puff.destroy() });
    }
    if (time > this.nextTaunt) {
      this.nextTaunt = time + 2600;
      floatText(this.scene, a.x, a.y - 20, Phaser.Utils.Array.GetRandom(['¡Jajaja!', '¡No me pillas!', '¡Más rápido, señor!', '¡Aquí!']), '#ff9ac0').setScale(0.6);
    }
  }

  /** Neues Fluchtziel: meist weit weg vom Wirt, manchmal frech an ihm vorbei. */
  private newTarget(time: number) {
    const a = this.anne!;
    const p = this.h.player;
    const from: Tile = [Math.floor(a.x / T), Math.floor((a.y - 2) / T)];
    const reach = this.reachable(from);
    if (!reach.length) return;
    const pt: Tile = [Math.floor(p.x / T), Math.floor((p.y - 2) / T)];
    const cheeky = Math.random() < 0.2;
    const scored = reach.map((t) => {
      const dPlayer = Math.hypot(t[0] - pt[0], t[1] - pt[1]);
      const dSelf = Math.hypot(t[0] - from[0], t[1] - from[1]);
      const score = cheeky ? -Math.abs(dPlayer - 2) + Math.random() * 3 : dPlayer * 1.2 - dSelf * 0.25 + Math.random() * 4;
      return { t, score };
    }).sort((x, y) => y.score - x.score);
    const target = scored[Math.floor(Math.random() * Math.min(4, scored.length))].t;
    this.path = this.findPath(from, target).slice(1, 9);
    this.retargetAt = time + 500 + Math.random() * 700;
  }

  /** Erwischt: Countdown stoppt, der Wirt bringt Anne an der Hand zur Tür. */
  private caught() {
    const a = this.anne!;
    this.chase = false;
    this.timer?.remove();
    this.h.setAlert('');
    this.h.lock(true);
    this.path = [];
    a.anims.stop();
    a.setFrame(0);
    audio.sfx('slap');
    this.scene.cameras.main.shake(120, 0.006);
    floatText(this.scene, a.x, a.y - 22, 'ERWISCHT!', '#f8e070').setScale(0.7);
    const p = this.h.player;
    const [dx, dy] = this.h.door;
    const route = this.findPath([Math.floor(p.x / T), Math.floor((p.y - 2) / T)], [dx, dy - 1]);
    // Anne läuft an der Hand neben dem Wirt her
    a.play('anne_down');
    this.scene.time.delayedCall(600, () => {
      this.walk(p, 'wirt', route, 60, () => {
        a.setPosition(p.x + 7, p.y).setDepth(p.y + 1);
        this.h.syncPlayer();
      }).then(() => {
        p.anims.stop();
        p.setFrame(0);
        audio.sfx('bell');
        this.scene.tweens.add({
          targets: a, y: dy * T + 22, alpha: 0, duration: 450,
          onComplete: () => {
            a.destroy();
            this.anne = undefined;
            this.h.toast('Wirt: „So. Feierabend für dich. Hier ist erst ab 18!“');
            state.flags.anne = 'gefangen';
            unlock('zuJung');
            this.finish();
          },
        });
      });
    });
  }

  /** Zeit um: Felix kommt rein, nimmt Anne mit und nimmt sich den Wirt vor. */
  private fail() {
    const a = this.anne!;
    if (!this.chase) return;
    this.chase = false;
    this.timer?.remove();
    this.h.setAlert('');
    this.h.lock(true);
    this.path = [];
    // Strafe nur einmal: das Flag steht, bevor irgendetwas anderes passiert
    state.flags.anne = 'felix';
    a.anims.stop();
    a.setFrame(0);
    const [dx, dy] = this.h.door;
    const felix = this.scene.add.sprite(dx * T + 8, dy * T + 14, 'polizist', 3).setOrigin(0.5, 1).setScale(0.5).setAlpha(0).setDepth(dy * T + 14);
    audio.sfx('bell');
    audio.sfx('siren');
    this.h.toast('Die Tür fliegt auf. Polizist Felix.');
    this.scene.tweens.add({ targets: felix, alpha: 1, duration: 250 });
    const toAnne = this.findPath([dx, dy - 1], [Math.floor(a.x / T), Math.floor((a.y - 2) / T)]);
    this.walk(felix, 'polizist', [[dx, dy - 1], ...toAnne.slice(1)], 80).then(() => {
      felix.anims.stop();
      const bang = this.scene.add.text(felix.x, felix.y - 30, '!', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#ff4040' }).setOrigin(0.5).setDepth(6001).setStroke('#000', 3);
      this.scene.time.delayedCall(500, () => bang.destroy());
      // Felix nimmt Anne an der Hand, beide gehen zur Tür, Anne geht hinaus
      const back = this.findPath([Math.floor(felix.x / T), Math.floor((felix.y - 2) / T)], [dx, dy - 1]);
      a.play('anne_down');
      this.walk(felix, 'polizist', back, 60, () => a.setPosition(felix.x + 7, felix.y).setDepth(felix.y + 1)).then(() => {
        felix.anims.stop();
        felix.setFrame(3);
        this.scene.tweens.add({
          targets: a, y: dy * T + 22, alpha: 0, duration: 400,
          onComplete: () => {
            a.destroy();
            this.anne = undefined;
            felix.setFrame(0);
            this.h.lock(false);
            this.h.talk('felixAnne', () => this.penalty(felix));
          },
        });
      });
    });
  }

  /** Kontostand auf genau 5 € setzen, Felix geht. */
  private penalty(felix: Phaser.GameObjects.Sprite) {
    const before = state.money;
    state.money = ANNE_STRAFE_REST;
    const diff = ANNE_STRAFE_REST - before;
    const p = this.h.player;
    floatText(this.scene, p.x, p.y - 24, `${diff >= 0 ? '+' : ''}${diff}€`, diff < 0 ? '#ff5050' : '#f8e070');
    audio.sfx(diff < 0 ? 'error' : 'coin');
    this.scene.cameras.main.shake(250, 0.01);
    this.h.toast(`Felix kassiert. In der Kasse sind noch genau ${ANNE_STRAFE_REST} €.`);
    const [, dy] = this.h.door;
    this.scene.tweens.add({
      targets: felix, y: dy * T + 22, alpha: 0, duration: 500, delay: 300,
      onStart: () => felix.setFrame(3),
      onComplete: () => { felix.destroy(); audio.sfx('bell'); },
    });
    this.finish();
  }

  /** Steuerung und Interaktionen wieder freigeben. */
  private finish() {
    this.active = false;
    this.chase = false;
    this.timer?.remove();
    this.h.setAlert('');
    this.h.blockActs(false);
    this.h.lock(false);
  }

  /** Aufräumen, wenn die Kneipe verlassen wird (z. B. Neustart aus dem Pausemenü). */
  destroy() {
    this.timer?.remove();
    this.chase = false;
    this.active = false;
  }

  // ---------------------------------------------------------------- Wege

  private reachable(from: Tile): Tile[] {
    const seen = new Set([from.join()]);
    const q: Tile[] = [from];
    const out: Tile[] = [];
    while (q.length) {
      const [x, y] = q.shift()!;
      out.push([x, y]);
      for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n: Tile = [x + ddx, y + ddy];
        const k = n.join();
        if (seen.has(k) || !this.h.walkable(n[0], n[1])) continue;
        seen.add(k);
        q.push(n);
      }
    }
    return out;
  }

  /** Breitensuche über begehbare Kacheln. Start darf auch eine Randkachel sein. */
  private findPath(from: Tile, to: Tile): Tile[] {
    const key = (t: Tile) => t.join();
    const prev = new Map<string, Tile | null>([[key(from), null]]);
    const q: Tile[] = [from];
    while (q.length) {
      const cur = q.shift()!;
      if (cur[0] === to[0] && cur[1] === to[1]) break;
      for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n: Tile = [cur[0] + ddx, cur[1] + ddy];
        if (prev.has(key(n)) || !(this.h.walkable(n[0], n[1]) || (n[0] === to[0] && n[1] === to[1]))) continue;
        prev.set(key(n), cur);
        q.push(n);
      }
    }
    if (!prev.has(key(to))) return [from];
    const path: Tile[] = [];
    for (let t: Tile | null = to; t; t = prev.get(key(t)) ?? null) path.unshift(t);
    return path;
  }

  /** Figur kachelweise einen Weg entlanglaufen lassen. */
  private walk(spr: Phaser.GameObjects.Sprite, anim: string, path: Tile[], speed: number, onStep?: () => void) {
    return new Promise<void>((res) => {
      const pts = path.map(([x, y]) => [x * T + 8, y * T + 14]);
      let i = 0;
      const next = () => {
        if (i >= pts.length) return res();
        const [tx, ty] = pts[i++];
        const d = Phaser.Math.Distance.Between(spr.x, spr.y, tx, ty);
        if (d < 0.5) return next();
        this.face(spr, anim, tx - spr.x, ty - spr.y);
        this.scene.tweens.add({
          targets: spr, x: tx, y: ty, duration: (d / speed) * 1000,
          onUpdate: () => { spr.setDepth(spr.y); onStep?.(); },
          onComplete: next,
        });
      };
      next();
    });
  }

  private face(spr: Phaser.GameObjects.Sprite, anim: string, dx: number, dy: number) {
    if (Math.abs(dx) > Math.abs(dy)) {
      spr.setFlipX(dx < 0);
      spr.anims.play(`${anim}_side`, true);
    } else {
      spr.setFlipX(false);
      spr.anims.play(dy < 0 ? `${anim}_up` : `${anim}_down`, true);
    }
  }
}
