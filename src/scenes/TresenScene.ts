import Phaser from 'phaser';
import { audio } from '../audio';
import { ITEMS, ItemId, MAX_HEALTH, VICTIM, give, impatient, item, lookStage, state } from '../state';
import { H, W, fadeTo, floatText, txt } from '../ui';
import { BAR_TRESEN_SPAWN } from './BarScene';
import { Btn } from './ShopScene';

const COUNTER_Y = 192;
const VX = 312; // Schnösel
const PX = 112; // Wirt (Spieler)

const CHEERS = ['Zum Wohl, Herr Doktor!', 'Geht aufs Haus.', 'Darf es noch eins sein?', 'Das entspannt, glauben Sie mir.', 'Hausspezialität!', 'Für meinen besten Gast.'];

export class TresenScene extends Phaser.Scene {
  private victim!: Phaser.GameObjects.Image;
  private bars!: Phaser.GameObjects.Graphics;
  private rain!: Phaser.GameObjects.Graphics;
  private money!: Phaser.GameObjects.Text;
  private slots: { bg: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Image; count: Phaser.GameObjects.Text; lock: Phaser.GameObjects.Text; id: ItemId }[] = [];
  private pile: Phaser.GameObjects.Image[] = [];
  private wishC!: Phaser.GameObjects.Container;
  private wishIcon!: Phaser.GameObjects.Image;
  private flies: Phaser.GameObjects.Rectangle[] = [];
  private shownStage = 0;
  private complainedFor = -1;
  private busy = false;
  private leaving = false;
  private bubbles: Phaser.GameObjects.Container[] = [];

  constructor() {
    super('Tresen');
  }

  create() {
    this.slots = [];
    this.pile = [];
    this.flies = [];
    this.bubbles = [];
    this.busy = false;
    this.leaving = false;
    this.cameras.main.fadeIn(260);
    if (state.dead) return this.leave();

    audio.music('bar');
    this.add.image(0, 0, 'tresenBg').setOrigin(0);
    this.rain = this.add.graphics();

    // Neon-Schild
    const neon = txt(this, 330, 12, 'ZUM GOLDENEN EIMER', '#ff6ab4').setOrigin(0.5, 0);
    neon.setShadow(0, 0, '#ff2a8a', 6, true, true);
    this.tweens.add({ targets: neon, alpha: 0.75, duration: 120, yoyo: true, repeat: -1, repeatDelay: 2600 });

    // Lampen
    for (const x of [PX, VX]) {
      this.add.rectangle(x, 0, 1, 34, 0x111111).setOrigin(0.5, 0);
      this.add.rectangle(x, 34, 22, 7, 0x2e5a3a).setOrigin(0.5, 0);
      this.add.rectangle(x, 40, 22, 1, 0xf8e8a0).setOrigin(0.5, 0);
    }

    // Stammgast Kalle pennt hinten an der Theke
    const kalle = this.add.image(428, COUNTER_Y + 10, 'bustPenner').setOrigin(0.5, 1).setAngle(14);
    this.tweens.add({ targets: kalle, angle: 18, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.time.addEvent({
      delay: 1600, loop: true,
      callback: () => {
        const z = txt(this, 440, 112, 'z', '#c8c8e8').setDepth(55);
        this.tweens.add({ targets: z, x: 452, y: 92, alpha: 0, duration: 1600, onComplete: () => z.destroy() });
      },
    });

    // Du: der Wirt
    const wirt = this.add.image(PX, COUNTER_Y + 36, 'bustWirt').setOrigin(0.5, 1).setScale(2);
    this.tweens.add({ targets: wirt, y: COUNTER_Y + 35, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.shownStage = lookStage();
    this.victim = this.add.image(VX, COUNTER_Y + 64, `bust${this.shownStage}`).setOrigin(0.5, 1).setScale(2);
    this.tweens.add({ targets: this.victim, y: COUNTER_Y + 63, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Fliegen ab Stufe 3
    for (let i = 0; i < 4; i++) {
      const f = this.add.rectangle(VX, 110, 2, 2, 0x111111).setDepth(50);
      this.flies.push(f);
    }

    for (const x of [PX, VX]) this.add.image(x, 70, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(1.7).setAlpha(0.55).setDepth(40);

    this.add.image(0, COUNTER_Y - 6, 'counterFront').setOrigin(0).setDepth(60);
    state.consumed.forEach((id) => this.addToPile(id, false));

    // Name
    txt(this, VX, COUNTER_Y - 2, VICTIM.toUpperCase(), '#f4ead0').setOrigin(0.5, 0).setDepth(62).setStroke('#120c0b', 3).setAlpha(0.85);

    // Wunsch-Gedankenblase
    this.wishIcon = this.add.image(0, -2, 'icon_bier');
    const dots = [this.add.circle(-24, 20, 2, 0xf4f0e4), this.add.circle(-16, 14, 3, 0xf4f0e4)];
    this.wishC = this.add.container(VX + 84, 112, [...dots, this.add.image(0, 0, 'bubble').setScale(2.2), this.wishIcon]).setDepth(70);
    this.tweens.add({ targets: this.wishC, y: 108, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.buildUi();

    const kb = this.input.keyboard!;
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'].forEach((k, i) => kb.on(`keydown-${k}`, () => this.offer(ITEMS[i].id)));
    kb.on('keydown-ESC', () => this.leave());
    kb.on('keydown-E', () => this.leave());

    if (state.consumed.length === 0) this.time.delayedCall(500, () => this.say(VX, 'Ein Glas Champagner. Aber zügig, mein Taxi kommt gleich.'));
  }

  private buildUi() {
    // Werte-Panel
    this.add.rectangle(6, 4, 150, 70, 0x120c0b, 0.8).setOrigin(0).setDepth(80);
    ['SUCHT', 'GESUNDH', 'WÜRDE', 'MISSTR'].forEach((l, i) => txt(this, 12, 23 + i * 12, l, '#c8b898').setDepth(81));
    this.bars = this.add.graphics().setDepth(81);

    this.money = txt(this, 12, 9, '', '#f8e070').setDepth(81);

    // Inventar
    ITEMS.forEach((it, i) => {
      const x = 12 + i * 40, y = 212;
      const bg = this.add.rectangle(x, y, 36, 36, 0x120c0b, 0.75).setOrigin(0).setDepth(80).setStrokeStyle(1, 0x8a6a3a);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.offer(it.id));
      bg.on('pointerover', () => bg.setStrokeStyle(1, 0xf8e070)).on('pointerout', () => bg.setStrokeStyle(1, 0x8a6a3a));
      const icon = this.add.image(x + 18, y + 18, `icon_${it.id}`).setScale(1.5).setDepth(81);
      const count = txt(this, x + 34, y + 27, '', '#f4ead0').setOrigin(1, 0).setDepth(82);
      const lock = txt(this, x + 34, y + 2, '', '#e05050').setOrigin(1, 0).setDepth(82);
      this.slots.push({ bg, icon, count, lock, id: it.id });
    });
    txt(this, 12, 251, 'Antippen = anbieten', '#c8b898').setDepth(82).setStroke('#120c0b', 3);

    // Wirt-Bestellungen
    // Theke und Zurück als große Buttons (auch fürs Handy)
    const theke = new Btn(this, W - 112, 226, 140, 26, 'THEKE ÖFFNEN', 0x8a5a24, () => this.openShop());
    const back = new Btn(this, W - 112, 252, 140, 18, 'ZURÜCK', 0x4a3a30, () => this.leave());
    theke.box.setDepth(85);
    back.box.setDepth(85);
    this.add.image(W - 172, 226, 'icon_bier').setDepth(86);
  }

  private addToPile(id: ItemId, animate = true) {
    const i = this.pile.length;
    if (i >= 14) return;
    const x = VX - 56 + (i % 7) * 16 + Phaser.Math.Between(-2, 2);
    const y = COUNTER_Y - 4 - (i >= 7 ? 3 : 0);
    const img = this.add.image(x, y, `icon_${id}`).setOrigin(0.5, 1).setDepth(61 + (i >= 7 ? 0 : 1)).setAngle(Phaser.Math.Between(-12, 12));
    if (id !== 'kippe') img.setTint(0xb0a090); // leer
    if (animate) {
      img.y -= 30;
      img.setAlpha(0);
      this.tweens.add({ targets: img, y, alpha: 1, duration: 300, ease: 'Bounce.easeOut' });
    }
    this.pile.push(img);
  }

  private say(x: number, s: string, color = '#1a1212') {
    const t = txt(this, 0, 0, s, color).setWordWrapWidth(170).setOrigin(0.5, 1);
    const b = t.getBounds();
    const g = this.add.graphics();
    g.fillStyle(0xf4f0e4, 1).fillRoundedRect(b.x, b.y, b.width, b.height, 4);
    g.lineStyle(1, 0x120c0b).strokeRoundedRect(b.x, b.y, b.width, b.height, 4);
    g.fillStyle(0xf4f0e4, 1).fillTriangle(-4, 4, 4, 4, 0, 10);
    const bx = Phaser.Math.Clamp(x, b.width / 2 + 12, W - b.width / 2 - 12);
    const c = this.add.container(bx, 68, [g, t]).setDepth(90);
    this.bubbles.forEach((o) => { if (Math.abs(o.x - bx) < 140) o.destroy(); });
    this.bubbles.push(c);
    this.tweens.add({ targets: c, alpha: 0, delay: 2600, duration: 400, onComplete: () => c.destroy() });
  }

  private openShop() {
    if (this.busy || this.leaving) return;
    this.scene.launch('Shop', { shop: 'wirt', resume: 'Tresen' });
    this.scene.bringToTop('Shop');
    this.scene.pause();
  }

  private offer(id: ItemId) {
    if (this.busy || this.leaving) return;
    if (state.inv[id] <= 0) return this.say(PX + 96, `Hab kein ${item(id).name} mehr.`);
    const res = give(id);
    if (!res) return;
    if (!res.ok) {
      audio.sfx('refuse');
      this.say(VX, res.text);
      this.cameras.main.shake(150, 0.004);
      return;
    }
    this.say(PX + 96, Phaser.Utils.Array.GetRandom(CHEERS));
    audio.sfx(id === 'kippe' ? 'lighter' : 'glug');
    this.addToPile(id);
    this.time.delayedCall(700, () => {
      if (!this.scene.isActive()) return;
      this.say(VX, res.text);
      if (res.paid) {
        floatText(this, VX, 130, `+${res.paid}€`, '#f8e070');
        audio.sfx('coin');
      }
      if (res.wished) audio.sfx('chime');
      if (res.wished) floatText(this, VX + 40, 110, 'GENAU DAS!', '#9ae09a');
    });
    if (res.died) return this.die();
  }

  private degrade() {
    const s = lookStage();
    if (s === this.shownStage) return;
    this.shownStage = s;
    this.cameras.main.flash(250, 255, 255, 255);
    audio.sfx('sting');
    this.victim.setTexture(`bust${s}`);
    const names = ['Tipptopp', 'Angeknackst', 'Verlottert', 'Räudig', 'Wrack'];
    floatText(this, VX, 140, `${names[s].toUpperCase()}!`, '#e08080');

    // Story-Zwischenspiele an Wendepunkten
    if (s >= 2 && !state.story.kapitel2) {
      state.story.kapitel2 = true;
      this.time.delayedCall(1400, () => this.playStory('kapitel2'));
    } else if (s >= 4 && !state.story.kapitel3) {
      state.story.kapitel3 = true;
      this.time.delayedCall(1400, () => this.playStory('kapitel3'));
    }
  }

  private playStory(script: 'kapitel2' | 'kapitel3') {
    if (this.busy || this.leaving || state.dead || state.gameOver) return;
    this.scene.launch('Cutscene', { script, resume: 'Tresen' });
    this.scene.pause();
  }

  private die() {
    this.busy = true;
    this.wishC.setVisible(false);
    this.time.delayedCall(1400, () => {
      this.tweens.killTweensOf(this.victim);
      this.tweens.add({ targets: this.victim, angle: 28, x: VX + 20, duration: 600, ease: 'Sine.easeIn' });
      this.tweens.add({ targets: this.victim, y: COUNTER_Y + 260, delay: 500, duration: 500, ease: 'Quad.easeIn' });
      this.flies.forEach((f) => f.setVisible(false));
      this.time.delayedCall(900, () => {
        this.cameras.main.shake(300, 0.01);
        audio.sfx('thud');
        audio.music('tension');
      });
      this.time.delayedCall(1400, () => {
        const t = txt(this, W / 2, 120, `${VICTIM} ist vom Hocker gefallen.\nFür immer.\n\nDie Katze in der Gasse hat Hunger ...`, '#f4ead0')
          .setOrigin(0.5).setAlign('center').setDepth(100).setStroke('#120c0b', 4);
        t.setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, duration: 500 });
      });
      this.time.delayedCall(5200, () => {
        this.leaving = true;
        fadeTo(this, 'Cutscene', { script: 'kapitel4', next: { scene: 'Bar', data: { spawn: BAR_TRESEN_SPAWN } } });
      });
    });
  }

  private flee() {
    this.busy = true;
    this.say(VX, 'Sie wollen mich vergiften! POLIZEI!!');
    audio.sfx('angry');
    this.tweens.killTweensOf(this.victim);
    this.tweens.add({ targets: this.victim, x: W + 80, delay: 900, duration: 800, ease: 'Quad.easeIn' });
    this.time.delayedCall(2200, () => fadeTo(this, 'End'));
  }

  private leave(dead = false) {
    if (this.leaving) return;
    if (this.busy && !dead) return;
    this.leaving = true;
    fadeTo(this, 'Bar', { spawn: BAR_TRESEN_SPAWN });
  }

  update(time: number) {
    if (!this.bars) return;
    if (state.gameOver === 'flucht' && !this.busy) this.flee();

    // Regen im Fenster
    this.rain.clear().lineStyle(1, 0x6a80b0, 0.5);
    for (let i = 0; i < 26; i++) {
      const x = 28 + ((i * 37 + time * 0.02) % 96);
      const y = 32 + ((i * 53 + time * 0.25) % 74);
      this.rain.lineBetween(x, y, x - 1, y + 5);
    }

    // Werte
    const g = this.bars.clear();
    const vals: [number, number][] = [[state.sucht, 0xc07ae0], [(state.health / MAX_HEALTH) * 100, 0x6ad06a], [state.wuerde, 0x6aa0e0], [state.misstrauen, 0xe05a4a]];
    vals.forEach(([v, col], i) => {
      const x = 76, y = 23 + i * 12;
      g.fillStyle(0x2a2220).fillRect(x, y, 74, 7);
      g.fillStyle(col).fillRect(x, y, Math.round((74 * Phaser.Math.Clamp(v, 0, 100)) / 100), 7);
    });
    this.money.setText(`€${state.money}`);

    for (const s of this.slots) {
      const n = state.inv[s.id], def = item(s.id);
      s.count.setText(n > 0 ? String(n) : '');
      s.icon.setAlpha(n > 0 ? 1 : 0.25);
      s.lock.setText(state.sucht < def.minSucht ? String(def.minSucht) : '');
    }

    this.wishC.setVisible(!!state.wish && !state.dead);
    const angry = impatient();
    this.wishC.list.forEach((o) => (o as Phaser.GameObjects.Image).setTint?.(angry ? 0xff8080 : 0xffffff));
    if (angry && this.complainedFor !== state.wishSince && !this.busy) {
      this.complainedFor = state.wishSince;
      this.say(VX, Phaser.Utils.Array.GetRandom(['Hallo?! BEDIENUNG!', 'Ich warte, Herr Wirt!', 'Wird das heute noch was?!']));
      this.cameras.main.shake(120, 0.003);
      audio.sfx('angry');
    }
    if (state.wish) this.wishIcon.setTexture(`icon_${state.wish}`);

    // Wackeln: je räudiger, desto mehr
    if (!this.busy) this.victim.setAngle(Math.sin(time / 700) * this.shownStage * 0.9);

    if (!this.busy && lookStage() !== this.shownStage) this.degrade();
    const st = this.shownStage;
    this.flies.forEach((f, i) => {
      f.setVisible(st >= 3 && i < st - 1 && !this.busy);
      const a = time / (180 + i * 40) + i * 2;
      f.setPosition(VX + Math.cos(a) * (30 + i * 5), 104 + Math.sin(a * 1.3) * 14);
    });
  }
}
