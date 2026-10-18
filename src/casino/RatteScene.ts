import Phaser from 'phaser';
import { audio } from '../audio';
import { txt } from '../ui';
import { Btn } from '../scenes/ShopScene';
import { Machine, Theme } from './Machine';
import { Reels } from './Reels';
import { BOOK, EXPANDABLE, FREE_SPINS, RATTE_PAY, RATTE_SYMBOLS, evalRatte, makeRatteStrips, spinRatte } from './logic';

const BETS = [1, 2, 5, 10];
const LINE_COLORS = [0xff3030, 0x30a0ff, 0x30d050, 0xf0c030, 0xd050f0, 0x30e0e0, 0xff8020, 0xa0ff40, 0xff60a0, 0xffffff];

/** BUCH DER RATTE: 5×3, 10 Linien, Buch = Joker + Scatter, Freispiele mit sich ausbreitendem Symbol. */
export class RatteScene extends Machine {
  private reels!: Reels;
  private strips = makeRatteStrips();
  private bet = 1;
  /** Gewinne mit Cent-Anteil sammeln, ausgezahlt wird in ganzen Euro */
  private credit = 0;
  private freeLeft = 0;
  private freeWin = 0;
  private expand: string | null = null;
  private betT!: Phaser.GameObjects.Text;
  private winT!: Phaser.GameObjects.Text;
  private freeT!: Phaser.GameObjects.Text;
  private expandImg!: Phaser.GameObjects.Image;
  private expandLabel!: Phaser.GameObjects.Text;
  private startBtn!: Btn;
  private betBtn!: Btn;

  constructor() {
    super('Ratte');
  }

  protected theme(): Theme {
    return { title: 'BUCH DER RATTE', body: 0x14204a, trim: 0xc8a040, titleColor: '#f8e070', glow: '#c8a040' };
  }

  protected build() {
    this.freeLeft = 0;
    this.freeWin = 0;
    this.expand = null;

    // Freispiel-Anzeige links
    this.add.rectangle(36, 58, 104, 112, 0x0a1028).setOrigin(0).setStrokeStyle(1, 0xc8a040);
    txt(this, 88, 62, 'FREISPIELE', '#c8a040').setOrigin(0.5, 0);
    this.freeT = txt(this, 88, 78, '-', '#f4ead0', 16).setOrigin(0.5, 0);
    this.expandLabel = txt(this, 88, 104, 'SONDERSYMBOL', '#5a6a8a').setOrigin(0.5, 0);
    this.add.rectangle(88, 140, 40, 40, 0x1a2448).setStrokeStyle(1, 0xc8a040);
    this.expandImg = this.add.image(88, 140, BOOK).setScale(1).setAlpha(0.25);

    // Walzen
    this.reels = new Reels(this, 150, 58, 5, 3, 36, RATTE_SYMBOLS);
    this.reels.set(spinRatte(this.strips, Math.random));

    // Gewinnplan rechts
    this.add.rectangle(342, 58, 102, 112, 0x0a1028).setOrigin(0).setStrokeStyle(1, 0xc8a040);
    this.add.image(356, 72, BOOK).setScale(0.5);
    txt(this, 368, 64, 'JOKER', '#f8e070');
    txt(this, 368, 74, '3x=10 FREI', '#f8e070');
    txt(this, 393, 88, '5 GLEICHE', '#5a6a8a').setOrigin(0.5, 0);
    ['br_koenig', 'br_ratte', 'br_kaese', 'br_tonne'].forEach((s, i) => {
      const y = 108 + i * 16;
      this.add.image(356, y, s).setScale(0.5);
      txt(this, 438, y - 4, `${RATTE_PAY[s][5] / 10}x`, '#f4ead0').setOrigin(1, 0);
    });

    // Anzeigen + Knöpfe
    this.betT = this.display(150, 180, 84, 'EINSATZ');
    this.winT = this.display(242, 180, 88, 'GEWINN');
    txt(this, 240, 210, '10 Linien  ·  Gewinne von links', '#5a6a8a').setOrigin(0.5, 0);
    this.betBtn = new Btn(this, 160, 238, 70, 20, 'EINSATZ', 0x3a3a6a, () => this.cycleBet());
    this.startBtn = new Btn(this, 260, 238, 110, 24, 'START', 0x2a8a2a, () => this.spin());
    this.updateUi();
  }

  private cycleBet() {
    if (this.busy) return;
    this.bet = BETS[(BETS.indexOf(this.bet) + 1) % BETS.length];
    this.updateUi();
  }

  private updateUi(win?: number) {
    this.betT.setText(`${this.bet}€`);
    if (win !== undefined) this.winT.setText(win > 0 ? `${win.toFixed(win % 1 ? 1 : 0)}€` : '');
    this.freeT.setText(this.freeLeft ? String(this.freeLeft) : '-');
    this.startBtn.setEnabled(!this.busy);
    this.betBtn.setEnabled(!this.busy);
  }

  private addCredit(v: number) {
    this.credit += v;
    const whole = Math.floor(this.credit + 1e-9);
    if (whole > 0) {
      this.credit -= whole;
      this.pay(whole);
    }
  }

  private wait(ms: number) {
    return new Promise<void>((r) => this.time.delayedCall(ms, r));
  }

  private async spin() {
    if (this.busy) return;
    if (!this.charge(this.bet)) return;
    this.busy = true;
    this.updateUi(0);
    await this.playOne(false);
    while (this.freeLeft > 0) {
      await this.wait(900);
      this.freeLeft--;
      this.updateUi();
      await this.playOne(true);
    }
    if (this.expand) {
      this.banner(`FREISPIELE\n${Math.round(this.freeWin)}€ GEWONNEN`);
      audio.sfx('kaching');
      this.expand = null;
      this.expandImg.setTexture(BOOK).setAlpha(0.25);
      this.expandLabel.setColor('#5a6a8a');
      this.music(false);
    }
    this.busy = false;
    this.updateUi();
  }

  private async playOne(free: boolean) {
    const grid = spinRatte(this.strips, Math.random);
    await this.reels.spin(grid, { fast: free });
    const res = evalRatte(grid, this.bet, free ? this.expand : null);
    res.wins.forEach((w) => {
      this.reels.line(w.cells, LINE_COLORS[w.line]);
      this.reels.highlight(w.cells, LINE_COLORS[w.line]);
    });
    if (res.books >= 3) {
      const cells: [number, number][] = [];
      grid.forEach((col, c) => col.forEach((s, r) => s === BOOK && cells.push([c, r])));
      this.reels.highlight(cells, 0xf8e070);
    }
    if (res.wins.length) audio.sfx('chime');
    if (res.expanded.length) {
      await this.wait(700);
      this.reels.clearHighlights();
      audio.sfx('sting');
      res.expanded.forEach((c, i) => this.time.delayedCall(i * 150, () => this.reels.expand(c, this.expand!)));
      await this.wait(res.expanded.length * 150 + 400);
      this.cameras.main.flash(200, 255, 230, 120);
    }
    if (res.total > 0) {
      this.addCredit(res.total);
      if (free) this.freeWin += res.total;
      this.updateUi(res.total);
      if (res.total >= this.bet * 15) this.banner(`GROSSER GEWINN!\n${Math.round(res.total)}€`);
    }
    if (res.books >= 3) await this.triggerFree(free);
  }

  /** 3+ Bücher: Freispiele starten (oder verlängern). */
  private async triggerFree(already: boolean) {
    audio.sfx('bell');
    if (already) {
      this.freeLeft += FREE_SPINS;
      this.banner(`+${FREE_SPINS} FREISPIELE!`);
      await this.wait(1400);
      return;
    }
    this.banner(`${FREE_SPINS} FREISPIELE!`);
    await this.wait(1300);
    // Das Buch blättert: Sondersymbol auswählen
    this.expandLabel.setColor('#f8e070');
    this.expandImg.setAlpha(1);
    const choice = EXPANDABLE[Math.floor(Math.random() * EXPANDABLE.length)];
    for (let i = 0; i < 18; i++) {
      this.expandImg.setTexture(EXPANDABLE[i % EXPANDABLE.length]);
      audio.sfx('blip');
      await this.wait(60 + i * 8);
    }
    this.expandImg.setTexture(choice);
    this.tweens.add({ targets: this.expandImg, scale: 1.3, duration: 160, yoyo: true });
    audio.sfx('chime');
    this.expand = choice;
    this.freeLeft = FREE_SPINS;
    this.freeWin = 0;
    this.music(true);
    this.updateUi();
    await this.wait(900);
  }

  /** Während der Freispiele läuft die Spannungsmusik als „Bonus-Thema“. */
  private music(on: boolean) {
    audio.music(on ? 'tension' : 'bar');
  }

  protected onClose() {
    // Cent-Reste verfallen, wie beim echten Automaten
    this.credit = 0;
  }
}
