import Phaser from 'phaser';
import { audio } from '../audio';
import { ALL_ITEMS, ItemDef, ItemId, benutze, state } from '../state';
import { H, W, txt } from '../ui';
import { Btn } from './ShopScene';

// Inventar: alle Waren an einem Ort. Öffnen mit dem Knopf unter dem Pause-Knopf oder der Taste I.
// Jede Ware lässt sich selbst benutzen (trinken, rauchen, schlucken, essen). Die Wirkung und eine kleine Animation
// spielt danach die Draufsicht-Szene am Wirt ab (state.benutze, TopDown).

/** Szenen, in denen der Wirt herumläuft: nur dort lässt sich das Inventar öffnen */
export const GAMEPLAY = ['Bar', 'Alley', 'Dach', 'HerrenWC', 'DamenWC', 'Laden', 'Club', 'Shisha', 'Keller'];

const COLS = 4, SLOT = 56, GAP = 6;

interface Slot { bg: Phaser.GameObjects.Rectangle; icon: Phaser.GameObjects.Image; count: Phaser.GameObjects.Text }

export class InventarScene extends Phaser.Scene {
  private resumeKey = '';
  private wasRunning = false;
  private closing = false;
  private sel = 0;
  private slots: Slot[] = [];
  private nameT!: Phaser.GameObjects.Text;
  private textT!: Phaser.GameObjects.Text;
  private wirkT!: Phaser.GameObjects.Text;
  private haveT!: Phaser.GameObjects.Text;
  private moneyT!: Phaser.GameObjects.Text;
  private useBtn!: Btn;
  private panel!: Phaser.GameObjects.Container;
  /** sichtbare Waren: alle normalen, Quest-Waren nur, wenn man sie hat (dritte Reihe „Besondere Sachen“) */
  private items: ItemDef[] = [];

  constructor() {
    super('Inventar');
  }

  /** Inventar über der laufenden Szene öffnen (sie pausiert so lange) */
  static open(game: Phaser.Game, resume: string) {
    if (game.scene.isActive('Inventar')) return;
    game.scene.start('Inventar', { resume });
  }

  create(data: { resume: string }) {
    this.resumeKey = data.resume;
    this.closing = false;
    this.slots = [];
    this.scene.pause(this.resumeKey);
    this.scene.bringToTop();
    this.wasRunning = state.running;
    state.running = false;
    // erstes vorhandenes Item vorwählen
    this.items = ALL_ITEMS.filter((it) => !it.quest || state.inv[it.id] > 0);
    this.sel = Math.max(0, this.items.findIndex((it) => state.inv[it.id] > 0));

    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0).setInteractive();
    dim.on('pointerdown', () => this.close());
    this.tweens.add({ targets: dim, fillAlpha: 0.55, duration: 150 });

    const PW = 440, PH = this.items.length > 8 ? 294 : 232;
    const panel = this.add.container(W / 2, H / 2 + 4);
    this.panel = panel;
    const bg = this.add.rectangle(0, 0, PW, PH, 0x1a1210).setStrokeStyle(2, 0xc9a24a).setInteractive();
    const inner = this.add.rectangle(0, 0, PW - 8, PH - 8, 0x000000, 0).setStrokeStyle(1, 0x3a2a1e);
    const header = this.add.rectangle(0, -PH / 2 + 14, PW, 28, 0xc9a24a, 0.18);
    const title = txt(this, -PW / 2 + 12, -PH / 2 + 9, 'INVENTAR', '#f0d070');
    this.moneyT = txt(this, PW / 2 - 40, -PH / 2 + 9, '', '#f8e070').setOrigin(1, 0);
    const close = new Btn(this, PW / 2 - 16, -PH / 2 + 14, 22, 18, 'X', 0x5a2a20, () => this.close());
    panel.add([bg, inner, header, title, this.moneyT, close.box]);

    // Fächer: vier mal zwei
    const gx = -PW / 2 + 14 + SLOT / 2, gy = -PH / 2 + 40 + SLOT / 2;
    if (this.items.length > 8) panel.add(txt(this, -PW / 2 + 14, gy + 2 * (SLOT + GAP) - SLOT / 2 - 9, 'BESONDERE SACHEN', '#c97a4a'));
    this.items.forEach((def, i) => {
      const x = gx + (i % COLS) * (SLOT + GAP), y = gy + Math.floor(i / COLS) * (SLOT + GAP) + (i >= 8 ? 8 : 0);
      const sbg = this.add.rectangle(x, y, SLOT, SLOT, 0x2a1e16).setStrokeStyle(1, 0x5a4430).setInteractive({ useHandCursor: true });
      const icon = this.add.image(x, y - 6, `icon_${def.id}`).setScale(1.2);
      const name = txt(this, x, y + 14, def.name, '#b8a888').setOrigin(0.5, 0);
      const count = txt(this, x + SLOT / 2 - 4, y - SLOT / 2 + 4, '', '#f4ead0').setOrigin(1, 0).setStroke('#120c0b', 3);
      sbg.on('pointerup', () => (this.sel === i ? this.use() : this.select(i)));
      panel.add([sbg, icon, name, count]);
      this.slots.push({ bg: sbg, icon, count });
    });

    // Beschreibung rechts
    const dx = 50;
    this.nameT = txt(this, dx, -PH / 2 + 40, '', '#f4ead0', 16);
    this.textT = txt(this, dx, -PH / 2 + 62, '', '#b8a888').setWordWrapWidth(PW / 2 - dx - 12).setLineSpacing(2);
    this.wirkT = txt(this, dx, 38, '', '#9ae09a');
    this.haveT = txt(this, dx, 52, '', '#a89878').setWordWrapWidth(PW / 2 - dx - 12);
    this.useBtn = new Btn(this, dx + 76, 80, 150, 22, '', 0x3a6a2a, () => this.use());
    panel.add([this.nameT, this.textT, this.wirkT, this.haveT, this.useBtn.box]);
    panel.add(txt(this, 0, PH / 2 - 14, 'Pfeile: wählen · E/Enter: benutzen · I/ESC: schließen', '#6a5a4a').setOrigin(0.5));

    const kb = this.input.keyboard!;
    const move = (d: number) => this.select((this.sel + d + this.items.length) % this.items.length);
    kb.on('keydown-LEFT', () => move(-1));
    kb.on('keydown-A', () => move(-1));
    kb.on('keydown-RIGHT', () => move(1));
    kb.on('keydown-D', () => move(1));
    kb.on('keydown-UP', () => move(-COLS));
    kb.on('keydown-W', () => move(-COLS));
    kb.on('keydown-DOWN', () => move(COLS));
    kb.on('keydown-S', () => move(COLS));
    for (const k of ['ENTER', 'E', 'SPACE']) kb.on(`keydown-${k}`, () => this.use());
    kb.on('keydown-ESC', () => this.close());

    panel.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 150, ease: 'Back.easeOut' });
    audio.sfx('rummage');
    this.select(this.sel);
  }

  private select(i: number) {
    this.sel = i;
    this.refresh();
  }

  private refresh() {
    this.moneyT.setText(`KASSE: ${state.money}€`);
    this.items.forEach((def, i) => {
      const n = state.inv[def.id], s = this.slots[i];
      s.icon.setAlpha(n > 0 ? 1 : 0.25);
      s.count.setText(n > 0 ? `${n}×` : '');
      s.bg.setStrokeStyle(i === this.sel ? 2 : 1, i === this.sel ? 0xf0c060 : 0x5a4430).setFillStyle(i === this.sel ? 0x3a2a1c : 0x2a1e16);
    });
    const def = this.items[this.sel], n = state.inv[def.id];
    this.nameT.setText(def.name.toUpperCase());
    this.textT.setText(def.text);
    this.wirkT.setText(`Wirkung: ${def.wirkung}`);
    this.haveT.setText(n > 0 ? `Im Inventar: ${n}` : 'Nichts mehr da.');
    this.useBtn.setLabel(def.verb);
    this.useBtn.setEnabled(n > 0 && !def.quest);
  }

  private use() {
    if (this.closing) return;
    const def = this.items[this.sel];
    if (def.quest) {
      audio.sfx('error');
      this.haveT.setText(def.nein ?? 'Das brauchst du noch.').setColor('#e07a7a');
      this.time.delayedCall(1800, () => this.haveT.active && this.haveT.setColor('#a89878') && this.refresh());
      return;
    }
    if (!benutze(def.id)) {
      audio.sfx('error');
      this.tweens.add({ targets: this.slots[this.sel].bg, x: this.slots[this.sel].bg.x + 3, duration: 50, yoyo: true, repeat: 3 });
      return;
    }
    audio.sfx('rummage');
    this.refresh();
    // kurz danach zu: die Animation spielt am Wirt in der Welt
    this.closing = true;
    this.time.delayedCall(220, () => { this.closing = false; this.close(); });
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    state.running = this.wasRunning;
    this.scene.resume(this.resumeKey);
    this.scene.stop();
  }
}
