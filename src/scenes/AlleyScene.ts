import Phaser from 'phaser';
import { audio } from '../audio';
import { item, lookStage, state } from '../state';
import { BAR_DOOR_SPAWN } from './BarScene';
import { fadeTo, floatText } from '../ui';
import { hud } from './HudScene';
import { Interact, T, TileInfo, TopDown } from './TopDown';

const MAP = [
  '########################',
  '##D###A####L######L#####',
  '#............GG.T......#',
  '#..p.........K...Y...b.#',
  '#.......Y...........X..#',
  '#....T......p.......bb.#',
  '########################',
];

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
// Sichtfeld des Polizisten: Kegel in Laufrichtung (Länge, Breite am Ansatz, Aufweitung) + Nahbereich
const VIEW_LEN = 96, VIEW_NEAR = 16, VIEW_SPREAD = 0.45, VIEW_CLOSE = 24;

const CAT_LINES = [
  'Das glühende Auge folgt dir. Das blinde auch.',
  'Sie riecht nach Tod und nassem Keller.',
  'Du ziehst die Hand zurück. Da bewegt sich was unter dem Fell.',
  'Ein Geräusch wie ein Lachen. Katzen lachen nicht.',
];

const DEALER_LINES = ['Psst. Pillen 10, Zeug 20. Keine Fragen.', 'Für deinen schicken Freund? Hehe.', 'Bar oder gar nicht, Bruder.'];

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
  }

  protected mapRows() { return MAP; }
  protected isWall(ch: string) { return '#DAL'.includes(ch); }
  protected darkness() { return 0.5; }
  protected floorKey(x: number, y: number) { return `cobble${(x * 5 + y * 11) % 3}`; }

  protected tileFor(ch: string): TileInfo {
    switch (ch) {
      case '#': return { key: 'brickFront', solid: true };
      case 'D': return { key: 'doorFront', solid: true };
      case 'A': return { key: 'automat', solid: true };
      case 'L': return { key: 'lampWall', solid: true };
      case 'G': return { key: 'dumpster', solid: true, object: true };
      case 'T': return { key: 'trash', solid: true, object: true };
      case 'b': return { key: 'crate', solid: true, object: true };
      case 'p': return { key: 'puddle', solid: false };
      default: return { key: '', solid: false };
    }
  }

  protected goalText() {
    if (state.gameOver === 'win') return 'Was hast du getan ...';
    if (state.carrying) return 'Die Katze wartet. Bring ihr das Abendessen.';
    if (this.corpse) return this.corpseCarried ? 'In eine Mülltonne oder den Container damit!' : 'Pack die Leiche (E) und ab in den Müll!';
    if (state.dead) return 'Hol die Leiche aus der Bar.';
    return 'Kippen am Automat, Stoff beim Dealer, Fusel im Müll.';
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
    // Tür zurück
    const [dx, dy] = this.find('D');
    this.interacts.push({ x: dx * T + 8, y: (dy + 1) * T + 4, r: 18, label: () => (this.corpse ? 'Erst die Leiche loswerden!' : 'Zurück in die Bar'), act: () => (this.corpse ? this.toast('Mit einer Leiche durch die Kneipe? Lieber nicht.') : this.go('Bar', { spawn: BAR_DOOR_SPAWN })) });

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
      act: () => (this.dealDangerous() ? this.bust('Drogenkauf? Direkt vor meiner Nase?!') : this.openShop('dealer')),
    });
    this.addLight(dealer.x, dealer.y - 10, 0.6, 0.35);

    // Streifenpolizist läuft die Gasse auf und ab
    this.cop = this.add.sprite(4 * T, 4 * T + 14, 'polizist', 6).setOrigin(0.5, 1).setScale(0.5);
    this.cop.play('polizist_side');
    this.npcs.push(this.cop);
    this.cone = this.add.graphics().setDepth(5001).setBlendMode(Phaser.BlendModes.ADD);

    // Damen der Nacht
    let n = 0;
    for (let y = 0; y < this.rows.length; y++)
      for (let x = 0; x < this.rows[y].length; x++) if (this.rows[y][x] === 'Y') this.addDame(x, y, n++ % 2);

    // Die Katze
    const [kx, ky] = this.find('K');
    this.cat = this.add.sprite(kx * T + 8, ky * T + 12, 'cat', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(ky * T + 12);
    this.cat.play('cat_idle');
    this.add.image(this.cat.x, this.cat.y, 'shadow').setDepth(1).setScale(0.8);
    // fauliger Schimmer und Fliegen
    this.addLight(this.cat.x, this.cat.y - 4, 0.45, 0.5).setTint(0x60ff40);
    this.buzz(this.cat.x, this.cat.y - 8, 4, 10);
    this.interacts.push({
      x: this.cat.x, y: this.cat.y - 4, r: 24,
      label: () => (state.gameOver ? null : state.carrying ? 'Der Katze servieren' : 'Die Katze ... anfassen?'),
      act: () => (state.carrying ? this.feed() : (audio.sfx('meow'), this.toast(Phaser.Utils.Array.GetRandom(CAT_LINES)))),
    });

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

  private addDame(tx: number, ty: number, variant: number) {
    const key = `${tx},${ty}`;
    const dame = this.add.sprite(tx * T + 8, ty * T + 14, `dame${variant}`, 0).setOrigin(0.5, 1).setScale(0.5);
    const shadow = this.add.image(dame.x, dame.y - 1, 'shadow').setDepth(1);
    this.npcs.push(dame, shadow);
    // langsam auf und ab schlendern
    this.tweens.add({
      targets: dame, x: dame.x + 20, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', hold: 1200, repeatDelay: 1200,
      onYoyo: () => dame.setFlipX(true), onRepeat: () => dame.setFlipX(false),
    });
    dame.play(`dame${variant}_side`);
    const away = () => (dameReady.get(key) ?? 0) > state.time;
    let spot: Interact | undefined;
    const sync = () => {
      if (!dame.active) return;
      if (spot) spot.x = dame.x;
      dame.setVisible(!away() || dame.getData('angry'));
      shadow.setVisible(dame.visible).setPosition(dame.x, dame.y - 1);
      dame.setDepth(dame.y);
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, sync);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.UPDATE, sync));

    spot = {
      x: dame.x, y: dame.y - 4, r: 20,
      label: () => (dame.active && dame.visible && !away() && !this.corpse && !state.carrying ? (this.copSees(this.player.x, this.player.y) ? 'Umlegen (DER BULLE GUCKT!)' : 'Umlegen') : null),
      act: () => {
        if (away() || this.corpse || state.carrying) return;
        if (this.copSees(this.player.x, this.player.y) || this.copSees(dame.x, dame.y)) return this.bust('Vor den Augen der Polizei? Mutig. Und dumm.');
        if (Math.random() < 0.25) {
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
        // Umgelegt: Handtasche plündern, Leiche bleibt liegen, die Uhr tickt
        this.cameras.main.shake(150, 0.006);
        audio.sfx('thud');
        const v = Phaser.Math.Between(6, 12);
        state.money += v;
        this.float(`+${v}€`);
              audio.sfx('coin');
        this.toast(Phaser.Utils.Array.GetRandom(KILLED));
        dameReady.set(key, Number.POSITIVE_INFINITY);
        state.bodyDeadline = state.time + 20;
        this.corpseKey = key;
        const corpse = this.add.sprite(dame.x, dame.y - 4, `dame${variant}`, 0).setScale(0.5).setDepth(dame.y);
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
      },
    };
    this.interacts.push(spot);
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

  /** Sieht der Polizist diesen Punkt? Taschenlampenkegel in Laufrichtung + Nahbereich. */
  private copSees(x: number, y: number) {
    if (!this.cop) return false;
    const dx = x - this.cop.x, dy = y - this.cop.y;
    if (Math.hypot(dx, dy) < VIEW_CLOSE) return true;
    return dx * this.copDir > 0 && Math.abs(dx) < VIEW_LEN && Math.abs(dy) < VIEW_NEAR + Math.abs(dx) * VIEW_SPREAD;
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
    this.toast(`HALT! POLIZEI! ${why}`);
    audio.sfx('siren');
    this.cameras.main.flash(300, 80, 120, 255);
    this.cop.anims.stop();
    const bang = this.add.text(this.cop.x, this.cop.y - 30, '!', { fontFamily: '"Press Start 2P", monospace', fontSize: '16px', color: '#ff3030' }).setOrigin(0.5).setDepth(6000).setStroke('#000', 4);
    this.tweens.add({ targets: bang, y: bang.y - 6, duration: 200, yoyo: true, repeat: 3 });
  }

  private updateCop(dt: number) {
    const c = this.cop;
    if (this.copGone) return;
    if (this.busted) return;
    if (this.copWait > 0) {
      this.copWait -= dt;
      c.anims.stop();
      c.setFrame(6);
    } else {
      c.x += this.copDir * 26 * dt;
      c.anims.play('polizist_side', true);
      if ((this.copDir > 0 && c.x > 19 * T) || (this.copDir < 0 && c.x < 3 * T)) {
        this.copDir *= -1;
        this.copWait = 1.5;
      }
    }
    c.setFlipX(this.copDir < 0).setDepth(c.y);
    // Taschenlampe
    const ex = c.x + this.copDir * VIEW_LEN, far = VIEW_NEAR + VIEW_LEN * VIEW_SPREAD;
    this.cone.clear().fillStyle(0xfff0a0, 0.12);
    this.cone.fillPoints([new Phaser.Math.Vector2(c.x, c.y - VIEW_NEAR), new Phaser.Math.Vector2(ex, c.y - far), new Phaser.Math.Vector2(ex, c.y + far), new Phaser.Math.Vector2(c.x, c.y + VIEW_NEAR)], true);
    this.cone.fillStyle(0xfff0a0, 0.08).fillCircle(c.x, c.y, VIEW_CLOSE);
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
    if (shop === 'dealer') this.toast(Phaser.Utils.Array.GetRandom(DEALER_LINES));
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
    const mx = x, my = 5 * T + 14;
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
