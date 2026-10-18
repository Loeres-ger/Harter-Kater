import Phaser from 'phaser';
import { audio } from '../audio';
import { bulky, state } from '../state';
import { H, W, txt } from '../ui';
import { Choice, DialogAction, DialogNode, SPEAKERS, portraitOf } from './data';

export interface DialogData {
  /** Schlüssel aus SPEAKERS */
  who: string;
  /** pausierte Szene, die danach weiterläuft */
  resume: string;
  /** wird nach dem Schließen mit der gewählten Aktion aufgerufen */
  onDone?: (action?: DialogAction) => void;
}

const BAR_H = 22;
const BOX_Y = 178;
const BOX_H = 60;
const ROW_H = 13;

/** Gespräch unter vier Augen: Wirt links, Gegenüber rechts, Antworten zum Anklicken. */
export class DialogScene extends Phaser.Scene {
  private cfg!: DialogData;
  private tree!: Record<string, DialogNode>;
  private left!: Phaser.GameObjects.Image;
  private right!: Phaser.GameObjects.Image;
  private nameText!: Phaser.GameObjects.Text;
  private nameBg!: Phaser.GameObjects.Rectangle;
  private boxText!: Phaser.GameObjects.Text;
  private box!: Phaser.GameObjects.Container;
  private rows: Phaser.GameObjects.Container[] = [];
  private choices: Choice[] = [];
  private hint!: Phaser.GameObjects.Text;
  private rain?: Phaser.GameObjects.Graphics;
  private typing: Phaser.Time.TimerEvent | null = null;
  private fullText = '';
  private advance: (() => void) | null = null;
  private bob?: Phaser.Tweens.Tween;
  private done = false;
  private openedAt = 0;

  constructor() {
    super('Dialog');
  }

  create(data: DialogData) {
    this.cfg = data;
    this.done = false;
    this.rows = [];
    this.choices = [];
    this.advance = null;
    this.typing = null;
    this.rain = undefined;
    this.openedAt = this.time.now;
    state.running = false;
    const sp = SPEAKERS[data.who];
    this.tree = sp.tree();

    this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0);
    this.background(sp.bg);

    // Wirt links, Gegenüber rechts (die Katze sitzt als Figur in der Mitte rechts)
    this.left = this.add.image(-80, BOX_Y + 6, bulky() ? 'bustWirtBulk' : 'bustWirt').setOrigin(0.5, 1).setDepth(500);
    this.tweens.add({ targets: this.left, x: 76, duration: 300, ease: 'Quad.easeOut' });
    if (sp.bg === 'cat') {
      this.right = this.add.image(W + 80, BOX_Y - 4, 'cat', 0).setOrigin(0.5, 1).setScale(3.5).setDepth(500);
      this.tweens.add({ targets: this.right, x: W - 110, duration: 500, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: this.right, scaleY: 3.65, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.time.addEvent({ delay: 500, loop: true, callback: () => this.right.setFrame(this.right.frame.name === '0' ? 1 : 0) });
    } else {
      this.right = this.add.image(W + 80, BOX_Y + 6 + (sp.drop ?? 0), portraitOf(data.who)).setOrigin(0.5, 1).setDepth(500);
      this.tweens.add({ targets: this.right, x: W - 76, duration: 300, ease: 'Quad.easeOut' });
    }

    // Dialogbox wie in den Zwischensequenzen
    const boxBg = this.add.rectangle(0, 0, W - 16, BOX_H, 0x120c0b, 0.92).setOrigin(0).setStrokeStyle(2, 0x8a6a3a);
    this.nameBg = this.add.rectangle(10, -8, 10, 14, 0x2a1c14).setOrigin(0).setStrokeStyle(1, 0x8a6a3a);
    this.nameText = txt(this, 16, -4, '');
    this.boxText = txt(this, 12, 14, '').setWordWrapWidth(W - 40);
    this.box = this.add.container(8, BOX_Y, [boxBg, this.nameBg, this.nameText, this.boxText]).setDepth(800);

    const top = this.add.rectangle(0, -BAR_H, W, BAR_H, 0x000000).setOrigin(0).setDepth(900);
    const bot = this.add.rectangle(0, H, W, BAR_H, 0x000000).setOrigin(0).setDepth(900);
    this.tweens.add({ targets: top, y: 0, duration: 300, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: bot, y: H - BAR_H, duration: 300, ease: 'Quad.easeOut' });
    this.hint = txt(this, 8, H - 15, '', '#6a5a4a').setDepth(901);
    const close = txt(this, W - 8, H - 15, 'ESC: TSCHÜSS', '#8a6a4a').setOrigin(1, 0).setDepth(901).setInteractive({ useHandCursor: true });
    close.on('pointerup', () => this.finish());

    const kb = this.input.keyboard!;
    for (const k of ['SPACE', 'E', 'ENTER']) kb.on(`keydown-${k}`, () => this.onAdvance());
    ['ONE', 'TWO', 'THREE', 'FOUR'].forEach((k, i) => kb.on(`keydown-${k}`, () => this.choose(i)));
    kb.on('keydown-ESC', () => this.finish());
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => over.length === 0 && this.onAdvance());

    this.cameras.main.fadeIn(200);
    this.show('start');
  }

  update(time: number) {
    if (!this.rain) return;
    this.rain.clear().lineStyle(1, 0x8aa0d0, 0.4);
    for (let i = 0; i < 60; i++) {
      const x = (i * 53 + time * 0.05) % W;
      const y = (i * 97 + time * 0.45) % H;
      this.rain.lineBetween(x, y, x - 2, y + 7);
    }
  }

  // ---------------------------------------------------------------- Ablauf

  private async show(id: string) {
    const node = this.tree[id];
    if (!node) return this.finish();
    for (const entry of node.lines) {
      if (this.done) return;
      const line = typeof entry === 'function' ? entry() : entry;
      const wirt = line.startsWith('W:');
      await this.say(wirt, wirt ? line.slice(2) : line);
    }
    if (!this.done) this.offer(node.choices);
  }

  private say(wirt: boolean, text: string) {
    const sp = SPEAKERS[this.cfg.who];
    const [name, color] = wirt ? ['WIRT HORST', '#f8e070'] : [sp.name, sp.color];
    this.setName(name, color);
    this.boxText.setColor(!wirt && sp.bg === 'cat' ? '#d8ffb0' : '#f4ead0');
    this.focus(wirt);
    this.hint.setText('Klicken oder Tippen: weiter');
    this.typeInto(text, wirt ? this.left : this.right);
    return new Promise<void>((res) => (this.advance = res));
  }

  private setName(name: string, color: string) {
    this.nameBg.setVisible(true);
    this.nameText.setVisible(true);
    this.nameText.setText(name).setColor(color);
    this.nameBg.width = name.length * 8 + 12;
  }

  /** Wer spricht, ist hell; der andere tritt ins Halbdunkel. */
  private focus(wirt: boolean) {
    this.left.setTint(wirt ? 0xffffff : 0x666666);
    this.right.setTint(wirt ? 0x666666 : 0xffffff);
  }

  private typeInto(s: string, talker: Phaser.GameObjects.Image) {
    this.fullText = s;
    this.boxText.setText('');
    this.bob?.stop();
    const baseY = talker.y;
    this.bob = this.tweens.add({ targets: talker, y: baseY - 1, duration: 90, yoyo: true, repeat: -1, onStop: () => talker.setY(baseY) });
    let i = 0;
    this.typing = this.time.addEvent({
      delay: 26,
      repeat: s.length - 1,
      callback: () => {
        i++;
        this.boxText.setText(s.slice(0, i));
        if (i % 2 === 0 && s[i - 1] !== ' ') audio.sfx('blip');
        if (i >= s.length) this.stopTyping();
      },
    });
  }

  private stopTyping() {
    this.typing?.remove();
    this.typing = null;
    this.bob?.stop();
    this.bob = undefined;
  }

  private onAdvance() {
    // der Tastendruck, der das Gespräch geöffnet hat, soll nicht gleich weiterblättern
    if (this.time.now - this.openedAt < 200) return;
    if (this.typing) {
      this.stopTyping();
      this.boxText.setText(this.fullText);
      return;
    }
    const a = this.advance;
    this.advance = null;
    a?.();
  }

  /** Antworten des Wirts als anklickbare Zeilen in der Box. */
  private offer(choices: Choice[]) {
    this.choices = choices;
    this.boxText.setText('');
    // Namensschild weg, damit auch fünf Antworten in die Box passen
    this.nameBg.setVisible(false);
    this.nameText.setVisible(false);
    this.focus(true);
    this.hint.setText('Antwort wählen');
    const rh = Math.min(ROW_H, Math.floor((BOX_H - 4) / choices.length));
    const y0 = Math.round((BOX_H - choices.length * rh) / 2) + 1;
    choices.forEach((c, i) => {
      const y = y0 + i * rh;
      const bg = this.add.rectangle(4, y - 1, W - 24, rh - 1, 0x3a2a1c, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      const color = c.action === 'kill' ? '#ff7070' : c.action ? '#9ae09a' : '#f4ead0';
      const label = txt(this, 14, y + 1, `${i + 1}  ${c.text}`, color);
      const row = this.add.container(8, BOX_Y, [bg, label]).setDepth(810);
      bg.on('pointerover', () => { bg.setFillStyle(0x3a2a1c, 1); label.setText(`>  ${c.text}`); });
      bg.on('pointerout', () => { bg.setFillStyle(0x3a2a1c, 0); label.setText(`${i + 1}  ${c.text}`); });
      bg.on('pointerup', () => this.choose(i));
      this.rows.push(row);
    });
  }

  private async choose(i: number) {
    const c = this.choices[i];
    if (!c || this.done) return;
    audio.sfx('click');
    this.choices = [];
    for (const r of this.rows) r.destroy();
    this.rows = [];
    if (c.action) return this.finish(c.action);
    await this.say(true, c.text);
    if (c.next) this.show(c.next);
    else this.finish();
  }

  private finish(action?: DialogAction) {
    if (this.done) return;
    this.done = true;
    this.stopTyping();
    this.advance = null;
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (!state.gameOver) state.running = true;
      const { resume, onDone } = this.cfg;
      this.scene.resume(resume);
      this.scene.stop();
      onDone?.(action);
    });
  }

  // ---------------------------------------------------------------- Kulissen

  private background(kind: 'bar' | 'street' | 'cat') {
    if (kind === 'bar') {
      this.add.image(0, 0, 'tresenBg').setOrigin(0);
      this.add.image(0, 186, 'counterFront').setOrigin(0);
      for (const x of [112, 312]) this.add.image(x, 70, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(1.7).setAlpha(0.5);
    } else if (kind === 'street') {
      this.add.image(0, 0, 'csStreet').setOrigin(0).setTint(0xb0b0d0);
      const neon = txt(this, 240, 102, 'ZUM GOLDENEN EIMER', '#ff6ab4').setOrigin(0.5).setShadow(0, 0, '#ff2a8a', 8, true, true);
      this.tweens.add({ targets: neon, alpha: 0.6, duration: 90, yoyo: true, repeat: -1, repeatDelay: 1800 });
      this.rain = this.add.graphics().setDepth(700);
    } else {
      // fauliges Glimmen im Dunkeln
      const glow = this.add.image(W - 110, 130, 'light').setScale(3).setTint(0x40a020).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, alpha: 0.75, duration: 800, yoyo: true, repeat: -1 });
    }
  }
}
