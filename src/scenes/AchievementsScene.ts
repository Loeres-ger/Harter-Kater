import Phaser from 'phaser';
import { audio } from '../audio';
import { ACHIEVEMENTS, unlockedAt, unlockedCount } from '../progress/achievements';
import { H, W, txt } from '../ui';
import { Btn } from './ShopScene';

const PW = 464, PH = 236;
const ROW_H = 36, ROWS = 5;

/** Liste aller Erfolge, aus dem Pausemenü geöffnet. Maus/Touch: Buttons und Mausrad, Tastatur: Pfeile, ESC. */
export class AchievementsScene extends Phaser.Scene {
  private list!: Phaser.GameObjects.Container;
  private offset = 0;
  private up!: Btn;
  private down!: Btn;
  private closing = false;

  constructor() {
    super('Achievements');
  }

  create() {
    this.closing = false;
    this.offset = 0;
    this.scene.bringToTop();
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.55).setOrigin(0).setInteractive();
    dim.on('pointerdown', () => this.close());

    const panel = this.add.container(W / 2, H / 2);
    const bg = this.add.rectangle(0, 0, PW, PH, 0x1a1210).setStrokeStyle(2, 0xc9a24a).setInteractive();
    const inner = this.add.rectangle(0, 0, PW - 8, PH - 8, 0x000000, 0).setStrokeStyle(1, 0x3a2a1e);
    const title = txt(this, -PW / 2 + 12, -PH / 2 + 9, 'ACHIEVEMENTS', '#f0c030');
    const count = txt(this, PW / 2 - 40, -PH / 2 + 9, `${unlockedCount()}/${ACHIEVEMENTS.length}`, '#b8a888').setOrigin(1, 0);
    const close = new Btn(this, PW / 2 - 18, -PH / 2 + 13, 22, 16, 'X', 0x5a2a20, () => this.close());
    this.list = this.add.container(0, 0);
    panel.add([bg, inner, title, count, close.box, this.list]);

    // Blättern, falls es mehr Erfolge gibt als auf eine Seite passen
    this.up = new Btn(this, PW / 2 - 18, -PH / 2 + 40, 22, 16, '^', 0x3a3040, () => this.scroll(-1));
    this.down = new Btn(this, PW / 2 - 18, PH / 2 - 16, 22, 16, 'v', 0x3a3040, () => this.scroll(1));
    panel.add([this.up.box, this.down.box]);

    const kb = this.input.keyboard!;
    for (const k of ['ESC', 'ENTER', 'BACKSPACE']) kb.on(`keydown-${k}`, () => this.close());
    for (const k of ['UP', 'W']) kb.on(`keydown-${k}`, () => this.scroll(-1));
    for (const k of ['DOWN', 'S']) kb.on(`keydown-${k}`, () => this.scroll(1));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.scroll(dy > 0 ? 1 : -1));

    panel.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 150, ease: 'Back.easeOut' });
    this.render();
  }

  private scroll(d: number) {
    const max = Math.max(0, ACHIEVEMENTS.length - ROWS);
    const next = Phaser.Math.Clamp(this.offset + d, 0, max);
    if (next === this.offset) return;
    this.offset = next;
    audio.sfx('blip');
    this.render();
  }

  private render() {
    this.list.removeAll(true);
    const top = -PH / 2 + 30;
    ACHIEVEMENTS.slice(this.offset, this.offset + ROWS).forEach((a, i) => {
      const y = top + i * ROW_H;
      const at = unlockedAt(a.id);
      const rowBg = this.add.rectangle(-PW / 2 + 10, y, PW - 46, ROW_H - 3, at ? 0x2e2214 : 0x161010).setOrigin(0).setStrokeStyle(1, at ? 0x8a6a3a : 0x2a201a);
      const icon = this.add.image(-PW / 2 + 22, y + 16, at ? a.icon : 'ach_lock').setScale(0.75).setAlpha(at ? 1 : 0.6);
      const name = txt(this, -PW / 2 + 36, y + 2, a.hidden && !at ? '???' : a.name, at ? '#f4ead0' : '#7a6a5a');
      const descText = at ? a.desc : a.hidden ? (a.hint ?? 'Geheim.') : a.desc;
      const desc = txt(this, -PW / 2 + 36, y + 12, descText, at ? '#b8a888' : '#5a4a3a').setWordWrapWidth(PW - 90).setLineSpacing(2);
      const status = txt(this, PW / 2 - 40, y + 2, at ? at.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'GESPERRT', at ? '#9ae09a' : '#6a4a3a').setOrigin(1, 0);
      this.list.add([rowBg, icon, name, desc, status]);
    });
    const scrollable = ACHIEVEMENTS.length > ROWS;
    this.up.box.setVisible(scrollable);
    this.down.box.setVisible(scrollable);
  }

  private close() {
    if (this.closing) return;
    this.closing = true;
    this.scene.resume('Pause');
    this.scene.stop();
  }
}
