import Phaser from 'phaser';
import { audio } from '../audio';
import { ITEMS, ItemDef, ItemId, state } from '../state';
import { H, W, txt } from '../ui';

export type ShopId = 'wirt' | 'automat' | 'dealer' | 'laden';

export interface ShopData {
  shop: ShopId;
  /** pausierte Szene, die nach dem Schließen weiterläuft */
  resume: string;
}

const SHOPS: Record<ShopId, { title: string; line: string; accent: number; accentCss: string; items?: ItemId[] }> = {
  wirt: { title: 'DIE THEKE', line: 'Was darf es sein, Chef?', accent: 0xc9a24a, accentCss: '#f0d070' },
  automat: { title: 'ZIGARETTENAUTOMAT', line: '*summt leise vor sich hin*', accent: 0xc02a2a, accentCss: '#ff7a6a' },
  dealer: { title: 'DER DEALER', line: 'Psst. Keine Fragen, keine Quittung.', accent: 0x6ac04a, accentCss: '#9ae09a' },
  // Mayas Feinkost verkauft dieselbe Bierware wie die Kneipentheke
  laden: { title: 'MAYAS FEINKOST', line: 'Deutsches Bier. Barzahlung. Kein Anschreiben.', accent: 0x2a8a4a, accentCss: '#8ae0a0', items: ['bier'] },
};

const CARD_W = 104, CARD_H = 142;

/** Kauf-Fenster über der aktuellen Szene: Karten mit Ware, Preis, Wirkung und Kauf-Buttons. Nur per Klick/Tippen. */
export class ShopScene extends Phaser.Scene {
  private cfg!: ShopData;
  private moneyText!: Phaser.GameObjects.Text;
  private cards: { def: ItemDef; box: Phaser.GameObjects.Container; owned: Phaser.GameObjects.Text; buy1: Btn; buy5: Btn; req: Phaser.GameObjects.Text }[] = [];
  private closing = false;
  private wasRunning = false;

  constructor() {
    super('Shop');
  }

  create(data: ShopData) {
    this.cfg = data;
    this.cards = [];
    this.closing = false;
    this.wasRunning = state.running;
    state.running = false;
    const shop = SHOPS[data.shop];
    const items = shop.items ? ITEMS.filter((i) => shop.items!.includes(i.id)) : ITEMS.filter((i) => i.shop === data.shop);

    // Abdunkeln, Klick daneben schließt
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0).setInteractive();
    dim.on('pointerdown', () => this.close());
    this.tweens.add({ targets: dim, fillAlpha: 0.6, duration: 180 });

    const PW = Math.max(220, items.length * (CARD_W + 10) + 30), PH = 224;
    const panel = this.add.container(W / 2, H / 2 + 6);
    const bg = this.add.rectangle(0, 0, PW, PH, 0x1a1210).setStrokeStyle(2, shop.accent);
    bg.setInteractive(); // Klicks im Panel schließen nicht
    const inner = this.add.rectangle(0, 0, PW - 8, PH - 8, 0x000000, 0).setStrokeStyle(1, 0x3a2a1e);
    const header = this.add.rectangle(0, -PH / 2 + 15, PW, 30, shop.accent, 0.22);
    const title = txt(this, -PW / 2 + 12, -PH / 2 + 7, shop.title, shop.accentCss);
    const line = txt(this, -PW / 2 + 12, -PH / 2 + 19, shop.line, '#a89878');
    this.moneyText = txt(this, PW / 2 - 12, -PH / 2 + 7, '', '#f8e070').setOrigin(1, 0);
    const close = new Btn(this, PW / 2 - 16, PH / 2 - 16, 22, 18, 'X', 0x5a2a20, () => this.close());
    panel.add([bg, inner, header, title, line, this.moneyText, close.box]);

    items.forEach((def, i) => {
      const cx = -((items.length - 1) * (CARD_W + 10)) / 2 + i * (CARD_W + 10);
      panel.add(this.makeCard(def, cx, 8, i));
    });

    panel.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });

    this.refresh();
  }

  private makeCard(def: ItemDef, x: number, y: number, idx: number) {
    const box = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x2a1e16).setStrokeStyle(1, 0x5a4430);
    const shelf = this.add.rectangle(0, -CARD_H / 2 + 34, CARD_W - 10, 52, 0x140e0a);
    const glow = this.add.image(0, -CARD_H / 2 + 34, 'light').setScale(0.5).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    const icon = this.add.image(0, -CARD_H / 2 + 34, `icon_${def.id}`).setScale(1.5);
    this.tweens.add({ targets: icon, y: icon.y - 2, duration: 900 + idx * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const name = txt(this, 0, -CARD_H / 2 + 60, def.name.toUpperCase(), '#f4ead0').setOrigin(0.5, 0);
    // Preisschild
    const tag = this.add.rectangle(CARD_W / 2 - 18, -CARD_H / 2 + 12, 30, 14, 0xf8e070).setAngle(6);
    const price = txt(this, CARD_W / 2 - 18, -CARD_H / 2 + 12, `${def.price}€`, '#2a1a0a').setOrigin(0.5).setAngle(6);
    // Wirkung als kleine Balken
    const stats = this.add.graphics();
    const rows: [string, number, number][] = [['SUCHT', def.sucht, 0xc07ae0], ['GIFT', def.health, 0x6ad06a], ['SCHAM', def.wuerde, 0x6aa0e0]];
    rows.forEach(([, v, col], r) => {
      const sy = -CARD_H / 2 + 75 + r * 10;
      stats.fillStyle(0x140e0a).fillRect(2, sy, 44, 6);
      stats.fillStyle(col).fillRect(2, sy, Math.min(44, Math.round((v / 26) * 44)), 6);
    });
    const labels = rows.map(([l], r) => txt(this, -CARD_W / 2 + 6, -CARD_H / 2 + 74 + r * 10, l, '#8a7a5a'));
    const req = txt(this, 0, -CARD_H / 2 + 103, '', '#8a7a5a').setOrigin(0.5, 0);
    const owned = txt(this, 0, -CARD_H / 2 + 114, '', '#b8a888').setOrigin(0.5, 0);
    const buy1 = new Btn(this, -14, CARD_H / 2 - 11, 56, 16, 'KAUFEN', 0x3a6a2a, () => this.buy(def, 1));
    const buy5 = new Btn(this, 32, CARD_H / 2 - 11, 28, 16, '5x', 0x2a4a5a, () => this.buy(def, 5));
    box.add([bg, shelf, glow, icon, name, tag, price, stats, ...labels, req, owned, buy1.box, buy5.box]);
    this.cards.push({ def, box, owned, buy1, buy5, req });
    return box;
  }

  private buy(def: ItemDef, n: number) {
    if (this.closing) return;
    const card = this.cards.find((c) => c.def === def)!;
    const cost = def.price * n;
    if (state.money < cost) {
      this.tweens.add({ targets: card.box, x: card.box.x + 4, duration: 50, yoyo: true, repeat: 3 });
      this.flyText(card.box, 'ZU WENIG GELD', '#ff6a5a');
      audio.sfx('error');
      return;
    }
    state.money -= cost;
    state.inv[def.id] += n;
    this.tweens.add({ targets: card.box, scale: 1.06, duration: 80, yoyo: true });
    this.flyText(card.box, `+${n} ${def.name}  -${cost}€`, '#9ae09a');
    audio.sfx('kaching');
    this.refresh();
  }

  private flyText(box: Phaser.GameObjects.Container, s: string, color: string) {
    const p = box.parentContainer!;
    const t = txt(this, p.x + box.x, p.y + box.y - 50, s, color).setOrigin(0.5).setStroke('#000', 3).setDepth(10);
    this.tweens.add({ targets: t, y: t.y - 20, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }

  private refresh() {
    this.moneyText.setText(`KASSE: ${state.money}€`);
    for (const c of this.cards) {
      c.owned.setText(`Vorrat: ${state.inv[c.def.id]}`);
      const ok = state.sucht >= c.def.minSucht;
      c.req.setText(c.def.minSucht ? `ab Sucht ${c.def.minSucht}` : 'für jeden').setColor(ok ? '#7ab86a' : '#c86a5a');
      c.buy1.setEnabled(state.money >= c.def.price);
      c.buy5.setEnabled(state.money >= c.def.price * 5);
    }
  }

  private close() {
    if (this.closing) return;
    this.closing = true;
    state.running = this.wasRunning;
    this.scene.resume(this.cfg.resume);
    this.scene.stop();
  }
}

/** Kleiner Pixel-Button mit Hover- und Drück-Effekt. */
export class Btn {
  box: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private enabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, color: number, onClick: () => void) {
    const shade = shadeOf(color, -25);
    const base = scene.add.rectangle(0, 2, w, h, shade);
    this.bg = scene.add.rectangle(0, 0, w, h, color).setStrokeStyle(1, 0x000000);
    this.label = txt(scene, 0, 0, text, '#ffffff').setOrigin(0.5);
    this.box = scene.add.container(x, y, [base, this.bg, this.label]);
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerover', () => this.enabled && this.bg.setFillStyle(shadeOf(color, 15)));
    this.bg.on('pointerout', () => { this.bg.setFillStyle(this.enabled ? color : 0x3a3430); this.press(false); });
    this.bg.on('pointerdown', () => this.enabled && this.press(true));
    this.bg.on('pointerup', () => {
      if (!this.enabled) return;
      this.press(false);
      audio.sfx('click');
      onClick();
    });
    this.color = color;
  }

  private color: number;

  private press(down: boolean) {
    this.bg.y = down ? 2 : 0;
    this.label.y = down ? 2 : 0;
  }

  setColor(color: number) {
    this.color = color;
    if (this.enabled) this.bg.setFillStyle(color);
  }

  setLabel(text: string) {
    this.label.setText(text);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    this.bg.setFillStyle(on ? this.color : 0x3a3430);
    this.label.setColor(on ? '#ffffff' : '#7a6a5a');
  }
}

function shadeOf(c: number, amount: number) {
  const col = Phaser.Display.Color.IntegerToColor(c);
  return (amount < 0 ? col.darken(-amount) : col.lighten(amount)).color;
}
