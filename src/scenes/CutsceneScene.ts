import Phaser from 'phaser';
import { Track, audio } from '../audio';
import { STORY, Step, Who } from '../story';
import { state } from '../state';
import { H, W, txt } from '../ui';
import { Btn } from './ShopScene';

export interface CutsceneData {
  script: keyof typeof STORY;
  /** Szene, die danach gestartet wird … */
  next?: { scene: string; data?: object };
  /** … oder pausierte Szene, die danach weiterläuft */
  resume?: string;
  /** Musik während der Szene (Standard: Spannung) */
  music?: Track;
  /** wird nach dem Ende aufgerufen (z. B. damit die Szene dahinter weiterspielt) */
  onDone?: () => void;
}

const NAMES: Record<Who, [string, string]> = {
  wirt: ['WIRT HORST', '#f8e070'],
  glanz: ['DR. VON GLANZ', '#90b8ff'],
  kalle: ['KALLE', '#d8a880'],
  katze: ['DIE KATZE', '#b8f060'],
  telefon: ['BRENNINGER', '#ff6a6a'],
  borna: ['BEKIFFTER BORNA', '#a8d070'],
  lily: ['LILY', '#c8a0e0'],
  kevin: ['KURDISCHER KEVIN', '#ff8a50'],
  nebenan: ['STIMME VON NEBENAN', '#c0c0c0'],
};

/** Porträts der Nebenfiguren: Seite und Bild je nach look (0 = normal, 1 = glücklich) */
const CAST: Partial<Record<Who, { side: 'left' | 'right'; key: (look: number) => string }>> = {
  borna: { side: 'left', key: (l) => (l ? 'nbust_bornaHappy' : 'nbust_borna') },
  lily: { side: 'right', key: (l) => (l ? 'nbust_lilyHappy' : 'nbust_lily') },
  kevin: { side: 'right', key: () => 'nbust_kevin' },
};

const BAR_H = 22; // Kinobalken
const BOX_Y = 178;
// Todesszene: Glanz etwas kleiner und höher, damit Tresen und Pfütze über der Textbox bleiben
const TOD_Y = 162, TOD_S = 0.75, COUNTER_TOP = 152;

/** Spielt ein Skript aus story.ts ab: Hintergründe, Porträts, Dialoge, Effekte. */
export class CutsceneScene extends Phaser.Scene {
  private cfg!: CutsceneData;
  private bg!: Phaser.GameObjects.Container;
  private rain?: Phaser.GameObjects.Graphics;
  private portraits: Record<'left' | 'right', Phaser.GameObjects.Image | null> = { left: null, right: null };
  private box!: Phaser.GameObjects.Container;
  private boxText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private nameBg!: Phaser.GameObjects.Rectangle;
  private caption!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private advance: (() => void) | null = null;
  private typing: Phaser.Time.TimerEvent | null = null;
  private fullText = '';
  private typingTarget?: Phaser.GameObjects.Text;
  private done = false;
  private bulldozer?: Phaser.GameObjects.Image;
  private inset?: Phaser.GameObjects.Container;
  private insetImg?: Phaser.GameObjects.Image;
  /** Porträt, dessen Mund beim Tippen auf- und zugeht */
  private talker?: Phaser.GameObjects.Image;
  // Todesszene: von Glanz, Überlagerungen im Gesicht, Kotzstrahl und Pfütze
  private glanz?: Phaser.GameObjects.Image;
  private glanzTint = 0xffffff;
  private face?: Phaser.GameObjects.Container;
  private streamG?: Phaser.GameObjects.Graphics;
  private puddleG?: Phaser.GameObjects.Graphics;
  private stream = { on: false, width: 0 };
  private puddle = { x: 0, r: 0, chunks: [] as [number, number, number][] };
  private todObjs: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Cutscene');
  }

  create(data: CutsceneData) {
    this.cfg = data;
    this.done = false;
    this.portraits = { left: null, right: null };
    this.bulldozer = undefined;
    this.rain = undefined;
    this.inset = this.insetImg = this.talker = undefined;
    this.glanz = this.face = this.streamG = this.puddleG = undefined;
    this.todObjs = [];
    this.stream = { on: false, width: 0 };
    this.puddle = { x: 0, r: 0, chunks: [] };
    if (!this.textures.exists('chunk')) {
      const g = this.make.graphics({}, false).fillStyle(0xffffff).fillRect(0, 0, 3, 3);
      g.generateTexture('chunk', 3, 3);
      g.destroy();
    }
    state.running = false;
    audio.music(data.music ?? 'tension');

    this.add.rectangle(0, 0, W, H, 0x000000).setOrigin(0);
    this.bg = this.add.container(0, 0);

    // Dialogbox
    const boxBg = this.add.rectangle(0, 0, W - 16, 60, 0x120c0b, 0.92).setOrigin(0).setStrokeStyle(2, 0x8a6a3a);
    this.nameBg = this.add.rectangle(10, -8, 10, 14, 0x2a1c14).setOrigin(0).setStrokeStyle(1, 0x8a6a3a);
    this.nameText = txt(this, 16, -4, '');
    this.boxText = txt(this, 12, 14, '').setWordWrapWidth(W - 40);
    this.box = this.add.container(8, BOX_Y, [boxBg, this.nameBg, this.nameText, this.boxText]).setDepth(800).setVisible(false);

    this.caption = txt(this, W / 2, 50, '', '#f4ead0').setOrigin(0.5).setAlign('center').setDepth(850).setPadding(8, 6, 8, 6);

    // Kinobalken fahren rein
    const top = this.add.rectangle(0, -BAR_H, W, BAR_H, 0x000000).setOrigin(0).setDepth(900);
    const bot = this.add.rectangle(0, H, W, BAR_H, 0x000000).setOrigin(0).setDepth(900);
    this.tweens.add({ targets: top, y: 0, duration: 500, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: bot, y: H - BAR_H, duration: 500, ease: 'Quad.easeOut' });
    this.hint = txt(this, 8, H - 15, 'Klicken oder Tippen: weiter', '#6a5a4a').setDepth(901);
    const skip = new Btn(this, W - 52, H - 11, 92, 14, 'ÜBERSPRINGEN', 0x3a2a24, () => this.finish());
    skip.box.setDepth(902);

    const kb = this.input.keyboard!;
    const next = () => this.onAdvance();
    kb.on('keydown-SPACE', next);
    kb.on('keydown-E', next);
    kb.on('keydown-ENTER', next);
    // Klick auf einen Button (z. B. Überspringen) zählt nicht als Weiter
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => over.length === 0 && next());
    kb.on('keydown-ESC', () => this.finish());

    this.cameras.main.fadeIn(400);
    this.run(STORY[data.script]);
  }

  // ---------------------------------------------------------------- Ablauf

  private async run(steps: Step[]) {
    for (const s of steps) {
      if (this.done) return;
      await this.step(s);
    }
    this.finish();
  }

  private onAdvance() {
    if (this.typing) {
      this.typing.remove();
      this.typing = null;
      this.typingTarget?.setText(this.fullText);
      this.talker?.setFrame(0);
      return;
    }
    const a = this.advance;
    this.advance = null;
    a?.();
  }

  private waitKey() {
    return new Promise<void>((res) => (this.advance = res));
  }

  private sleep(ms: number) {
    return new Promise<void>((res) => this.time.delayedCall(ms, res));
  }

  private typeInto(t: Phaser.GameObjects.Text, s: string) {
    this.fullText = s;
    this.typingTarget = t;
    t.setText('');
    let i = 0;
    this.typing = this.time.addEvent({
      delay: 28,
      repeat: s.length - 1,
      callback: () => {
        i++;
        t.setText(s.slice(0, i));
        if (i % 2 === 0 && s[i - 1] !== ' ') audio.sfx('blip');
        if (this.talker) this.talker.setFrame(i % 6 < 3 && s[i - 1] !== ' ' ? 1 : 0);
        if (i >= s.length) {
          this.typing = null;
          this.talker?.setFrame(0);
        }
      },
    });
  }

  private async step(s: Step) {
    switch (s.t) {
      case 'bg':
        return this.setBg(s.key);
      case 'wait':
        return this.sleep(s.ms);
      case 'pause':
        // Lesezeit: erst nach dem Stempel weiterklickbar, dann bis Tastendruck
        await this.sleep(1300);
        return this.waitKey();
      case 'caption':
        this.box.setVisible(false);
        this.hidePortraits();
        this.hideInset(false);
        this.caption.setBackgroundColor('#000000b8');
        this.typeInto(this.caption, s.text);
        await this.waitKey();
        this.caption.setText('').setBackgroundColor('rgba(0,0,0,0)');
        return;
      case 'title':
        return this.title(s.text, s.sub);
      case 'say':
        return this.say(s.who, s.text, s.look ?? 0);
      case 'fx':
        this.box.setVisible(false);
        return this.fx(s.kind);
    }
  }

  private finish() {
    if (this.done) return;
    audio.setRain(false);
    this.done = true;
    this.advance = null;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (!state.gameOver) state.running = true;
      const { onDone } = this.cfg;
      if (this.cfg.resume) {
        this.scene.resume(this.cfg.resume);
        this.scene.stop();
      } else if (this.cfg.next) {
        this.scene.start(this.cfg.next.scene, this.cfg.next.data);
      }
      onDone?.();
    });
  }

  // ---------------------------------------------------------------- Bausteine

  private setBg(key: string) {
    this.bg.removeAll(true);
    for (const o of this.todObjs) o.destroy();
    this.todObjs = [];
    this.glanz = this.face = this.streamG = this.puddleG = undefined;
    this.stream.on = false;
    this.rain?.destroy();
    this.rain = undefined;
    this.hidePortraits();
    this.hideInset(false);
    this.cameras.main.flash(200, 0, 0, 0);
    audio.setRain(key === 'street' || key === 'dachLeer');

    if (key === 'street' || key === 'dawn') {
      const img = this.add.image(0, 0, 'csStreet').setOrigin(0);
      this.bg.add(img);
      const neon = txt(this, 240, 102, 'ZUM GOLDENEN EIMER', key === 'dawn' ? '#a86a8a' : '#ff6ab4').setOrigin(0.5);
      if (key === 'street') {
        neon.setShadow(0, 0, '#ff2a8a', 8, true, true);
        this.tweens.add({ targets: neon, alpha: 0.6, duration: 90, yoyo: true, repeat: -1, repeatDelay: 1800 });
        this.rain = this.add.graphics().setDepth(100);
      } else {
        img.setTint(0xffc8a0);
        const sun = this.add.image(60, 70, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(3).setTint(0xffa060);
        this.bg.add(sun);
      }
      this.bg.add(neon);
    } else if (key === 'bar') {
      this.bg.add(this.add.image(0, 0, 'tresenBg').setOrigin(0));
      const kalle = this.add.image(428, 202, 'bustPenner').setOrigin(0.5, 1).setScale(0.5).setAngle(14);
      this.bg.add(kalle);
      this.bg.add(this.add.image(0, 186, 'counterFront').setOrigin(0));
      for (const x of [112, 312]) this.bg.add(this.add.image(x, 70, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(1.7).setAlpha(0.5));
    } else if (key === 'dach' || key === 'dachLeer') {
      this.bg.add(this.add.image(0, 0, key === 'dach' ? 'csDach' : 'csDachLeer').setOrigin(0));
      this.bg.add(this.add.image(330, 80, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2).setTint(0x8090c0).setAlpha(0.35));
      if (key === 'dachLeer') this.rain = this.add.graphics().setDepth(100);
      else {
        const candle = this.add.image(26, 170, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(1.4).setTint(0xffa040).setAlpha(0.5);
        this.bg.add(candle);
        this.tweens.add({ targets: candle, alpha: 0.3, duration: 140, yoyo: true, repeat: -1, repeatDelay: 400 });
      }
    } else if (key === 'kabine') {
      this.bg.add(this.add.image(0, 0, 'csKabine').setOrigin(0));
      const tube = this.add.image(240, 8, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2.5, 1).setTint(0xd0f0d0).setAlpha(0.35);
      this.bg.add(tube);
      // die Füße von nebenan wippen ungeduldig
      this.time.addEvent({ delay: 130, loop: true, callback: () => tube.setAlpha(Math.random() < 0.1 ? 0.05 : 0.35) });
    } else if (key === 'tod') {
      this.bg.add(this.add.image(0, 0, 'tresenBg').setOrigin(0));
      for (const x of [112, 312]) this.bg.add(this.add.image(x, 70, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(1.7).setAlpha(0.5));
      // von Glanz mittig hinter dem Tresen, er schwankt
      const g = this.add.image(240, TOD_Y, 'bust4').setOrigin(0.5, 1).setScale(TOD_S).setDepth(500);
      this.glanz = g;
      this.glanzTint = 0xffffff;
      this.portraits.right = g;
      this.tweens.add({ targets: g, angle: { from: -2, to: 2 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const counter = this.add.image(0, COUNTER_TOP, 'counterFront').setOrigin(0).setDepth(510);
      // Boden vor dem Tresen verdeckt, was beim Sturz unten herausragt
      this.todObjs.push(this.add.rectangle(0, COUNTER_TOP + counter.height, W, H, 0x0d0b0a).setOrigin(0).setDepth(511));
      this.face = this.add.container(g.x, g.y).setDepth(505);
      this.streamG = this.add.graphics().setDepth(515);
      this.puddleG = this.add.graphics().setDepth(520);
      this.todObjs.push(g, counter, this.face, this.streamG, this.puddleG);
    } else if (key === 'letter') {
      this.bg.add(this.add.image(0, -60, 'counterFront').setOrigin(0).setScale(1, 4));
      const paper = this.add.container(240, 135); // gerade, sonst werden die Pixel-Buchstaben zackig
      paper.add(this.add.rectangle(0, 0, 280, 170, 0xf0e8d4).setStrokeStyle(2, 0xb8a888));
      paper.add(txt(this, 0, -66, 'RÄUMUNGSBESCHEID', '#1a1212', 8).setOrigin(0.5));
      paper.add(
        txt(this, -126, -48, 'Die Liegenschaft „Zum Goldenen\nEimer“ wird zum 1. des Monats\ngeräumt und abgerissen.\n\nNeubau: GLANZ-LOFTS\n\ngez. Dr. F. von Glanz\ni.A. Brenninger Bau', '#3a2a2a', 8),
      );
      const stamp = txt(this, 60, 50, 'ABRISS', '#c02020', 16).setOrigin(0.5).setAngle(-14).setAlpha(0).setScale(3);
      paper.add(stamp);
      this.bg.add(paper);
      this.tweens.add({ targets: stamp, alpha: 0.85, scale: 1, delay: 900, duration: 250, ease: 'Back.easeOut', onComplete: () => this.cameras.main.shake(150, 0.01) });
    } else if (key === 'eyes') {
      // Fauliges grünes Glimmen, ein glühendes Auge mit Adern, ein milchig-blindes
      const glow = this.add.image(240, 120, 'light').setScale(3.2).setTint(0x40a020).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
      const eyes = this.add.container(240, 116);
      const g = this.add.graphics();
      // linkes Auge: groß, gelb-grün, rote Adern, Schlitzpupille
      g.fillStyle(0x200404).fillEllipse(-50, 0, 74, 42);
      g.fillStyle(0xd8e030).fillEllipse(-50, 0, 66, 36);
      g.lineStyle(1, 0xc02010, 0.9);
      for (const [x1, y1, x2, y2] of [[-82, -4, -64, -2], [-80, 8, -66, 4], [-20, -6, -34, -3], [-22, 9, -36, 5], [-60, -16, -55, -8], [-42, 16, -46, 9]]) g.lineBetween(x1, y1, x2, y2);
      g.fillStyle(0x0a0a0a).fillEllipse(-50, 0, 9, 34);
      g.fillStyle(0xffffff).fillRect(-64, -10, 5, 5);
      // rechtes Auge: kleiner, schief, milchig, Eiterrand
      g.fillStyle(0x200404).fillEllipse(48, 8, 52, 34);
      g.fillStyle(0x9ab040).fillEllipse(48, 8, 48, 30);
      g.fillStyle(0xdfe6d8).fillEllipse(48, 8, 40, 24);
      g.fillStyle(0xb8c0b0).fillCircle(52, 10, 5);
      eyes.add(g);
      // Sabber/Eiter tropft
      const drips: Phaser.GameObjects.Rectangle[] = [];
      for (const dx of [-60, -38, 40]) {
        const d = this.add.rectangle(dx, 18, 2, 4, 0x9ad040).setOrigin(0.5, 0);
        drips.push(d);
        eyes.add(d);
        this.tweens.add({ targets: d, scaleY: 6, duration: 1400 + Math.random() * 800, repeat: -1, ease: 'Quad.easeIn', delay: Math.random() * 1000 });
      }
      this.bg.add([glow, eyes]);
      eyes.setScale(1, 0);
      this.tweens.add({ targets: eyes, scaleY: 1, duration: 600, ease: 'Back.easeOut' });
      this.tweens.add({ targets: glow, alpha: 0.8, duration: 700, yoyo: true, repeat: -1 });
      // zuckt unruhig, blinzelt unregelmäßig
      this.time.addEvent({ delay: 1900, loop: true, callback: () => this.tweens.add({ targets: eyes, scaleY: 0.05, duration: 70, yoyo: true }) });
      this.tweens.add({ targets: eyes, x: 243, duration: 90, yoyo: true, repeat: -1, repeatDelay: 1300 });
    }
  }

  /** Brenninger als Einblendung oben links, wie ein Videoanruf. */
  private showInset(key: string, label: string) {
    if (this.inset && this.insetImg?.texture.key === key) {
      this.insetImg.clearTint();
      return;
    }
    this.hideInset(false);
    const X = 12, Y = 30, PW = 150, PH = 128;
    const frame = this.add.rectangle(0, 0, PW, PH, 0x0a0a12).setOrigin(0).setStrokeStyle(2, 0xc04040);
    const img = this.add.image(PW / 2, 192 - 4, key, 0).setOrigin(0.5, 1).setScale(1);
    const mask = this.make.graphics({}, false).fillRect(X, Y, PW, PH).createGeometryMask();
    img.setMask(mask);
    const bar = this.add.rectangle(0, PH - 14, PW, 14, 0xc04040).setOrigin(0);
    const lbl = txt(this, 6, PH - 11, `${label}: BRENNINGER`, '#ffffff');
    const rec = this.add.circle(PW - 10, 10, 3, 0xff3030);
    this.tweens.add({ targets: rec, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });
    this.inset = this.add.container(-PW - 20, Y, [frame, img, bar, lbl, rec]).setDepth(600);
    this.insetImg = img;
    this.tweens.add({ targets: this.inset, x: X, duration: 300, ease: 'Back.easeOut' });
    // Brenninger tobt: leichtes Zittern
    this.tweens.add({ targets: img, x: PW / 2 + 1, duration: 60, yoyo: true, repeat: -1 });
  }

  private hideInset(glitch: boolean) {
    const box = this.inset;
    if (!box) return;
    this.inset = this.insetImg = undefined;
    if (this.talker && !this.talker.active) this.talker = undefined;
    this.talker = undefined;
    if (glitch) {
      const noise = this.add.rectangle(12, 30, 150, 128, 0xffffff).setOrigin(0).setDepth(601);
      const lost = txt(this, 87, 90, 'VERBINDUNG\nGETRENNT', '#ff4040').setOrigin(0.5).setAlign('center').setDepth(602);
      this.tweens.add({ targets: noise, alpha: 0, duration: 400 });
      this.time.delayedCall(900, () => {
        box.destroy();
        lost.destroy();
        noise.destroy();
      });
    } else {
      this.tweens.add({ targets: box, x: -180, duration: 200, onComplete: () => box.destroy() });
    }
  }

  private hidePortraits() {
    for (const side of ['left', 'right'] as const) {
      const p = this.portraits[side];
      if (p) this.tweens.add({ targets: p, alpha: 0, duration: 150, onComplete: () => p.destroy() });
      this.portraits[side] = null;
    }
  }

  private portrait(side: 'left' | 'right', key: string) {
    const x = side === 'left' ? 76 : W - 76;
    let p = this.portraits[side];
    if (p && p.texture.key === key) {
      p.setTint(p === this.glanz ? this.glanzTint : 0xffffff);
    } else {
      p?.destroy();
      p = this.add.image(side === 'left' ? -80 : W + 80, BOX_Y + 6, key).setOrigin(0.5, 1).setScale(1).setDepth(500);
      this.tweens.add({ targets: p, x, duration: 300, ease: 'Quad.easeOut' });
      this.portraits[side] = p;
    }
    const other = this.portraits[side === 'left' ? 'right' : 'left'];
    other?.setTint(0x666666);
  }

  private async say(who: Who, text: string, look: number) {
    if (who === 'wirt') this.portrait('left', 'bustWirt');
    else if (who === 'kalle') this.portrait('right', 'bustPenner');
    else if (who === 'glanz') this.portrait('right', `bust${look}`);
    else if (CAST[who]) this.portrait(CAST[who]!.side, CAST[who]!.key(look));
    else for (const p of Object.values(this.portraits)) p?.setTint(0x666666);
    if (who === 'telefon') this.showInset(look === 1 ? 'brennMega' : 'brennPhone', look === 1 ? 'VOR ORT' : 'ANRUF');
    else this.insetImg?.setTint(0x777777);
    this.talker = who === 'telefon' ? this.insetImg : undefined;

    const [name, color] = NAMES[who];
    this.nameText.setText(name).setColor(color);
    this.nameBg.width = name.length * 8 + 12;
    this.boxText.setColor(who === 'katze' ? '#d8ffb0' : who === 'telefon' ? '#ffb0b0' : '#f4ead0');
    this.box.setVisible(true);
    if (who === 'telefon') this.cameras.main.shake(300, 0.006);
    this.typeInto(this.boxText, text);
    await this.waitKey();
  }

  private async title(text: string, sub: string) {
    this.box.setVisible(false);
    this.hidePortraits();
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0).setDepth(860);
    const t = txt(this, W / 2, H / 2 - 14, text, '#f0c030', 24).setOrigin(0.5).setDepth(870).setStroke('#5a2a0a', 6).setAlpha(0).setScale(1.6);
    const st = txt(this, W / 2, H / 2 + 18, sub.toUpperCase(), '#f4ead0', 8).setOrigin(0.5).setDepth(870).setAlpha(0);
    this.tweens.add({ targets: dim, fillAlpha: 0.85, duration: 400 });
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 500, ease: 'Back.easeOut' });
    this.tweens.add({ targets: st, alpha: 1, delay: 400, duration: 400 });
    await this.sleep(700);
    this.cameras.main.shake(120, 0.004);
    audio.sfx('thud');
    await Promise.race([this.waitKey(), this.sleep(2200)]);
  }

  private bang(s: string, x: number, y: number, color: string, size = 16) {
    const t = txt(this, x, y, s, color, size).setOrigin(0.5).setDepth(700).setStroke('#000000', 5).setScale(0.2);
    this.tweens.add({ targets: t, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 300, onComplete: () => t.destroy() });
  }

  private async fx(kind: string) {
    const cam = this.cameras.main;
    switch (kind) {
      case 'queasy':
        return this.queasy();
      case 'puke':
        return this.puke();
      case 'collapse':
        return this.collapse();
      case 'thunder':
        cam.flash(180, 255, 255, 255);
        cam.shake(400, 0.012);
        this.bang('KRAWUMM!', W / 2, 60, '#ffffff');
        audio.sfx('thunder');
        await this.sleep(300);
        cam.flash(120, 220, 220, 255);
        await this.sleep(700);
        return;
      case 'bell':
        this.bang('*BIMMEL*', W - 90, 60, '#f8e070', 8);
        audio.sfx('bell');
        await this.sleep(900);
        return;
      case 'phone':
        for (let i = 0; i < 3; i++) {
          this.bang('RIIING!', W - 120 + i * 6, 80 - i * 8, '#ff6a6a', 16);
          audio.sfx('phone');
          cam.shake(150, 0.005);
          await this.sleep(450);
        }
        return;
      case 'splash':
        this.bang('*PLATSCH*', W - 140, 150, '#80c0ff', 16);
        audio.sfx('splash');
        this.hideInset(true);
        cam.shake(120, 0.006);
        await this.sleep(800);
        return;
      case 'bulldozer': {
        audio.sfx('rumble');
        this.bulldozer = this.add.image(W + 80, 236, 'bulldozer').setOrigin(0.5, 1).setScale(1).setDepth(300);
        this.tweens.add({ targets: this.bulldozer, x: 370, duration: 2000, ease: 'Sine.easeOut' });
        const rumble = this.time.addEvent({ delay: 120, repeat: 15, callback: () => cam.shake(100, 0.003) });
        await this.sleep(2100);
        rumble.remove();
        return;
      }
      case 'monster': {
        // Das Monster bricht aus der Tür der Kneipe und steht auf dem Gehweg (y = 238)
        const MX = 222, FEET = 238, DOOR_X = 240, DOOR_Y = 180;
        audio.music('monster');
        audio.sfx('growl');
        audio.sfx('clang');
        cam.flash(300, 160, 255, 120);
        // Licht in der Kneipe geht aus: Fenster, Tür und Neonschild werden dunkel
        const dark = [
          this.add.rectangle(104, 132, 82, 56, 0x0a0806),
          this.add.rectangle(294, 132, 82, 56, 0x0a0806),
          this.add.rectangle(224, 144, 32, 78, 0x0a0806),
          this.add.rectangle(140, 92, 200, 20, 0x0a0806),
        ].map((r) => r.setOrigin(0).setDepth(150).setAlpha(0));
        this.tweens.add({ targets: dark, alpha: 0.85, duration: 80, yoyo: true, repeat: 3, onComplete: () => dark.forEach((d) => d.setAlpha(0.85)) });
        // Trümmer aus der Tür
        this.add.particles(DOOR_X, DOOR_Y, 'coin', {
          speed: { min: 80, max: 200 }, angle: { min: 190, max: 350 }, gravityY: 320, lifespan: 1200,
          scale: { min: 0.2, max: 0.45 }, tint: [0x4a2c2c, 0x6e4826, 0x331c1c, 0x8a8a90], emitting: false,
        }).setDepth(220).explode(50);
        // Schatten auf dem Gehweg, Monster passend zum Morgenlicht eingefärbt
        const shadow = this.add.image(MX, FEET - 2, 'shadow').setDepth(199).setScale(1.5, 1).setAlpha(0.85);
        const m = this.add.sprite(DOOR_X, DOOR_Y + 40, 'mutant', 0).setOrigin(0.5, 1).setScale(0.15).setDepth(200).play('mutant_idle');
        m.setTint(0xffd8b0);
        const glow = this.add.image(MX + 20, FEET - 70, 'light').setScale(3).setTint(0x50e030).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(201);
        const floorGlow = this.add.image(MX, FEET - 4, 'light').setScale(2.6, 0.5).setTint(0x60ff30).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(198);
        this.add.particles(MX + 30, FEET - 70, 'light', {
          lifespan: 2400, speed: { min: 10, max: 50 }, angle: { min: 200, max: 340 }, scale: { start: 0.08, end: 0.5 },
          alpha: { start: 0.45, end: 0 }, tint: [0x60c030, 0x90e040, 0x406020], frequency: 70, blendMode: 'ADD',
        }).setDepth(210);
        this.tweens.add({ targets: m, scale: 1, x: MX, y: FEET, duration: 1500, ease: 'Back.easeOut' });
        this.tweens.add({ targets: shadow, scaleX: 13, scaleY: 3, duration: 1500, ease: 'Back.easeOut' });
        this.tweens.add({ targets: [glow, floorGlow], alpha: 0.55, duration: 1500 });
        // jeder Atemzug lässt den Boden beben
        m.on(Phaser.Animations.Events.ANIMATION_REPEAT, () => cam.shake(120, 0.002));
        const rumble = this.time.addEvent({ delay: 100, repeat: 15, callback: () => cam.shake(100, 0.008) });
        await this.sleep(1600);
        rumble.remove();
        return;
      }
      case 'roar':
        // Brüllen ohne Dialogbox, damit man das Monster ganz sieht
        cam.shake(1000, 0.02);
        cam.flash(150, 120, 255, 80);
        this.bang('GRRRAAAOOOWWWL!!', W / 2 + 40, 70, '#b8f060', 16);
        audio.sfx('roar');
        await this.sleep(1400);
        return;
      case 'flee':
        if (this.bulldozer) {
          this.bang('AAAAAH!', 380, 150, '#ffffff', 16);
          audio.sfx('scream');
          audio.sfx('rumble');
          this.bulldozer.setFlipX(true);
          this.tweens.add({ targets: this.bulldozer, x: W + 160, duration: 900, ease: 'Quad.easeIn' });
        }
        await this.sleep(1200);
        return;
    }
  }

  // ---------------------------------------------------------------- Todesszene

  /** Mund von Glanz auf dem Bildschirm (dreht und staucht mit dem Porträt mit). */
  private mouthPos(): [number, number] {
    const g = this.glanz!;
    const d = 122 * g.scaleY;
    return [g.x + d * Math.sin(g.rotation), g.y - d * Math.cos(g.rotation)];
  }

  /** Kleiner Tropfen (Schweiß, Sabber), der herunterrinnt. */
  private drop(x: number, y: number, color: number, fall = 28) {
    const d = this.add.rectangle(x, y, 2, 3, color).setDepth(506);
    this.todObjs.push(d);
    this.tweens.add({ targets: d, y: y + fall, alpha: 0, duration: 700, ease: 'Quad.easeIn', onComplete: () => d.destroy() });
  }

  private setSick(amount: number) {
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xffffff), Phaser.Display.Color.ValueToColor(0x9ad070), 100, amount,
    );
    this.glanzTint = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
    this.glanz?.setTint(this.glanzTint);
  }

  /** Ihm wird übel: grün im Gesicht, Backen blähen sich, Magen rumort, Schweiß. */
  private async queasy() {
    const g = this.glanz;
    if (!g) return;
    audio.sfx('gurgle');
    this.tweens.addCounter({ from: 0, to: 100, duration: 1800, onUpdate: (tw) => this.setSick(tw.getValue() ?? 0) });
    this.tweens.add({ targets: g, scaleX: TOD_S * 1.05, duration: 200, yoyo: true, repeat: 3, delay: 700 });
    this.time.delayedCall(900, () => {
      audio.sfx('gurgle');
      this.cameras.main.shake(250, 0.004);
    });
    for (let i = 0; i < 7; i++) this.time.delayedCall(i * 280, () => this.drop(g.x + Phaser.Math.Between(-20, 20), g.y - 124 + Phaser.Math.Between(0, 20), 0xc8e8ff));
    await this.sleep(2300);
  }

  /** Drei Schwalle auf den Tresen, dann ein Sabberfaden. */
  private async puke() {
    const g = this.glanz;
    if (!g) return;
    this.tweens.killTweensOf(g);
    g.setAngle(0).setScale(TOD_S);
    this.setSick(100);
    const waves: [number, number][] = [[900, 1], [650, 0.8], [1500, 1.25]];
    for (const [dur, power] of waves) {
      // Würgen: er zuckt nach vorn, die Backen blähen sich
      audio.sfx('retch');
      this.tweens.add({ targets: g, y: TOD_Y + 4, scaleX: TOD_S * 1.06, scaleY: TOD_S * 0.96, duration: 110, yoyo: true, repeat: 1 });
      await this.sleep(480);
      this.spew(dur, power);
      await this.sleep(dur + 350);
    }
    this.spew(600, 0.25);
    await this.sleep(1000);
  }

  /** Ein Schwall: Strahl aus dem Mund, Brocken mit Schwerkraft, Spritzer und wachsende Pfütze. */
  private spew(dur: number, power: number) {
    const g = this.glanz;
    if (!g) return;
    const [mx, my] = this.mouthPos();
    const landX = mx + 10;
    if (!this.puddle.r) this.puddle.x = landX;
    if (power > 0.5) {
      audio.sfx('puke');
      this.cameras.main.shake(dur, 0.005 * power);
      this.cameras.main.flash(120, 110, 150, 30);
    } else audio.sfx('gurgle');
    this.stream.on = true;
    this.stream.width = 7 * power;
    // Kopf ruckt beim Kotzen leicht vor und zurück
    const jerk = this.tweens.add({ targets: g, y: TOD_Y + 2, duration: 90, yoyo: true, repeat: -1 });

    const TINTS = [0xb8c840, 0x8a9a2a, 0xd8c060, 0x7a5a2a, 0xe0d890, 0xa0b030];
    const chunks = this.add.particles(mx, my, 'chunk', {
      speedX: { min: -30, max: 70 }, speedY: { min: 30, max: 150 * power }, gravityY: 520,
      lifespan: 2600, frequency: 28, quantity: Math.max(1, Math.round(3 * power)),
      scale: { min: 0.6, max: 1.7 }, tint: TINTS, bounce: 0.2, alpha: { start: 1, end: 0.5 },
    }).setDepth(516);
    chunks.addParticleBounds(-200, -200, W + 400, COUNTER_TOP + 204, false, false, false, true);
    const splash = this.add.particles(landX, COUNTER_TOP + 2, 'chunk', {
      speedX: { min: -110, max: 110 }, speedY: { min: -150 * power, max: -40 }, gravityY: 600,
      lifespan: 700, frequency: 45, quantity: 2, scale: { min: 0.5, max: 1.2 }, tint: TINTS,
    }).setDepth(517);
    this.todObjs.push(chunks, splash);
    this.tweens.add({ targets: this.puddle, r: Math.min(70, this.puddle.r + 26 * power), duration: dur });
    // Brocken in der Pfütze
    for (let i = 0; i < 8 * power; i++) this.puddle.chunks.push([Phaser.Math.Between(-30, 30), Phaser.Math.Between(-2, 2), Phaser.Utils.Array.GetRandom(TINTS)]);
    // über die Tresenkante tropfen
    for (let i = 0; i < 3 * power; i++) {
      this.time.delayedCall(Phaser.Math.Between(200, dur), () => {
        const x = this.puddle.x + Phaser.Math.Between(-this.puddle.r * 0.8, this.puddle.r * 0.8);
        const drip = this.add.rectangle(x, COUNTER_TOP + 6, Phaser.Math.Between(2, 3), 2, 0x9aac30).setOrigin(0.5, 0).setDepth(521);
        this.todObjs.push(drip);
        this.tweens.add({ targets: drip, scaleY: Phaser.Math.Between(5, 17), duration: 1400, ease: 'Sine.easeOut' });
      });
    }
    this.time.delayedCall(dur, () => {
      this.stream.on = false;
      chunks.stop();
      splash.stop();
      jerk.stop();
      g.setY(TOD_Y);
      // Sabberfaden am Kinn
      for (let i = 0; i < 3; i++) this.time.delayedCall(i * 200, () => this.glanz && this.drop(...this.mouthPos(), 0xb8c840, 40));
    });
  }

  /** Augen verdrehen, Zuckungen, Schaum vor dem Mund, dann mit dem Gesicht voran in die Pfütze. */
  private async collapse() {
    const g = this.glanz, face = this.face;
    if (!g || !face) return;
    this.tweens.killTweensOf(g);
    g.setAngle(0).setScale(TOD_S).setY(TOD_Y);
    // nur noch das Weiße der Augen, mit Äderchen
    for (const ex of [-10, 10]) {
      face.add(this.add.rectangle(ex, -139, 8, 6, 0xf0ecd8));
      face.add(this.add.rectangle(ex + (ex < 0 ? -2 : 2), -137, 2, 1, 0xd04040));
    }
    audio.sfx('gurgle');
    this.cameras.main.shake(1600, 0.003);
    const twitch = this.tweens.add({ targets: g, angle: { from: -5, to: 5 }, duration: 55, yoyo: true, repeat: -1 });
    const [mx, my] = this.mouthPos();
    const foam = this.add.particles(mx, my, 'chunk', {
      speedX: { min: -25, max: 25 }, speedY: { min: -10, max: 35 }, gravityY: 90,
      lifespan: 1100, frequency: 40, quantity: 2, scale: { start: 0.6, end: 1.6 },
      tint: [0xffffff, 0xe8f0d0, 0xd0e8a0], alpha: { start: 1, end: 0 },
    }).setDepth(516);
    this.todObjs.push(foam);
    this.time.delayedCall(800, () => audio.sfx('gurgle'));
    await this.sleep(1700);
    foam.stop();
    twitch.stop();
    g.setAngle(0);
    this.spew(380, 0.5);
    await this.sleep(700);

    // Kopf voran in die eigene Pfütze
    await new Promise<void>((res) => this.tweens.add({ targets: g, y: TOD_Y + 82, angle: 7, scaleY: TOD_S * 0.92, duration: 420, ease: 'Quad.easeIn', onComplete: () => res() }));
    audio.sfx('thud');
    audio.sfx('splash');
    this.cameras.main.shake(350, 0.014);
    const burst = this.add.particles(this.puddle.x, COUNTER_TOP + 2, 'chunk', {
      speedX: { min: -160, max: 160 }, speedY: { min: -220, max: -60 }, gravityY: 620,
      lifespan: 900, scale: { min: 0.6, max: 1.8 }, tint: [0xb8c840, 0x8a9a2a, 0xd8c060, 0x7a5a2a], emitting: false,
    }).setDepth(517);
    this.todObjs.push(burst);
    burst.explode(46);
    this.tweens.add({ targets: this.puddle, r: this.puddle.r + 16, duration: 300 });
    await this.sleep(900);

    // Blubbernde Blasen aus der Pfütze, letzte Zuckung, letzter Laut
    for (let i = 0; i < 3; i++) {
      const b = this.add.circle(this.puddle.x + Phaser.Math.Between(-20, 20), COUNTER_TOP + 3, 2, 0xc8d870).setStrokeStyle(1, 0x7a8a20).setDepth(522);
      this.todObjs.push(b);
      this.tweens.add({ targets: b, scale: 2.4, delay: i * 450, duration: 380, onStart: () => audio.sfx('gurgle'), onComplete: () => b.destroy() });
    }
    await this.sleep(1500);
    this.tweens.add({ targets: g, y: TOD_Y + 79, duration: 60, yoyo: true });
    audio.sfx('fart');
    this.bang('prrrt', this.puddle.x + 40, COUNTER_TOP - 16, '#a8b860', 8);
    await this.sleep(900);
    this.flies();
    await this.sleep(1400);
  }

  /** Fliegen finden die Pfütze. */
  private flies() {
    for (let i = 0; i < 5; i++) {
      const f = this.add.rectangle(W + 20, 120, 2, 2, 0x101010).setDepth(523);
      this.todObjs.push(f);
      const phase = Math.random() * Math.PI * 2, speed = 0.004 + Math.random() * 0.004, start = this.time.now;
      const ev = this.time.addEvent({
        delay: 16, loop: true,
        callback: () => {
          if (!f.active) return ev.remove();
          const t = this.time.now - start, k = Math.min(1, t / 1200);
          const tx = this.puddle.x + Math.cos(phase + t * speed) * 22, ty = COUNTER_TOP - 10 + Math.sin(phase + t * speed * 1.7) * 7;
          f.setPosition(Phaser.Math.Linear(W + 20, tx, k), Phaser.Math.Linear(120, ty, k));
        },
      });
    }
  }

  /** Kotzstrahl, Pfütze und Gesichts-Überlagerungen jedes Bild neu zeichnen. */
  private updateDeath(time: number) {
    const g = this.glanz;
    if (!g || !g.active) return;
    this.face?.setPosition(g.x, g.y).setRotation(g.rotation).setScale(g.scaleX, g.scaleY);
    const sg = this.streamG;
    if (sg) {
      sg.clear();
      if (this.stream.on) {
        const [mx, my] = this.mouthPos();
        const lx = mx + 10, ly = COUNTER_TOP + 3, n = 16, w = this.stream.width;
        for (let i = 0; i < n; i++) {
          const t = i / n, t2 = (i + 1) / n;
          const x = mx + (lx - mx) * t + Math.sin(t * Math.PI) * 9 + Math.sin(time * 0.04 + i * 1.3) * 1.5 * t;
          const y = my + (ly - my) * t, y2 = my + (ly - my) * t2;
          const ww = Math.max(2, w * (0.55 + 0.7 * t));
          sg.fillStyle(0x8a9a2a).fillRect(Math.round(x - ww / 2), Math.round(y), Math.round(ww), Math.ceil(y2 - y) + 1);
          sg.fillStyle(0xc8d050).fillRect(Math.round(x - ww / 2) + 1, Math.round(y), Math.max(1, Math.round(ww / 3)), Math.ceil(y2 - y) + 1);
          if ((i + Math.floor(time / 60)) % 3 === 0) sg.fillStyle(0x7a5a2a).fillRect(Math.round(x), Math.round(y), 2, 2);
        }
      }
    }
    const pg = this.puddleG;
    if (pg && this.puddle.r > 0) {
      const { x, r } = this.puddle;
      pg.clear();
      const py = COUNTER_TOP + 3;
      pg.fillStyle(0x6a7a1a).fillEllipse(x, py + 1, r * 2 + 4, Math.max(4, r * 0.32) + 2);
      pg.fillStyle(0x9aac30).fillEllipse(x, py, r * 2, Math.max(3, r * 0.3));
      pg.fillStyle(0xc8d050).fillEllipse(x - r * 0.3, py - 1, r * 0.8, Math.max(2, r * 0.12));
      for (const [cx, cy, c] of this.puddle.chunks) if (Math.abs(cx) < r * 0.85) pg.fillStyle(c).fillRect(Math.round(x + cx), Math.round(COUNTER_TOP + 3 + cy * 0.5), 2, 2);
    }
  }

  update(time: number) {
    this.updateDeath(time);
    if (!this.rain) return;
    this.rain.clear().lineStyle(1, 0x8aa0d0, 0.45);
    for (let i = 0; i < 70; i++) {
      const x = (i * 53 + time * 0.05) % W;
      const y = (i * 97 + time * 0.45) % H;
      this.rain.lineBetween(x, y, x - 2, y + 7);
    }
  }
}
