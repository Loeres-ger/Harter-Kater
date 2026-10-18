import Phaser from 'phaser';
import { audio } from '../audio';
import { txt } from '../ui';
import { Btn } from '../scenes/ShopScene';
import { Machine, Theme } from './Machine';
import { Reels } from './Reels';
import { RISK_CHANCE, RISK_STEPS, SAHNE_LINES, SAHNE_PAY, SAHNE_SYMBOLS, evalSahne, makeSahneStrips, spinSahne } from './logic';

const BETS = [1, 2, 5];
const LINE_COLORS = [0xff3030, 0x30a0ff, 0x30d050, 0xf0c030, 0xd050f0];

/** ALLES SAHNE: Früchte-Automat (3×3, 5 Linien) mit Risikoleiter. */
export class SahneScene extends Machine {
  private reels!: Reels;
  private strips = makeSahneStrips();
  private bet = 1;
  private pending = 0;
  private step = 0;
  private betT!: Phaser.GameObjects.Text;
  private winT!: Phaser.GameObjects.Text;
  private rungs: { bg: Phaser.GameObjects.Rectangle; t: Phaser.GameObjects.Text }[] = [];
  private blink?: Phaser.Time.TimerEvent;
  private startBtn!: Btn;
  private riskBtn!: Btn;
  private takeBtn!: Btn;
  private betBtn!: Btn;

  constructor() {
    super('Sahne');
  }

  protected theme(): Theme {
    return { title: 'ALLES SAHNE', body: 0x8a1420, trim: 0xf0c030, titleColor: '#fff0c0', glow: '#ff4040' };
  }

  protected build() {
    this.pending = 0;
    this.step = 0;
    this.rungs = [];

    // Risikoleiter links
    txt(this, 79, 58, 'RISIKO', '#f0c030').setOrigin(0.5, 0);
    for (let i = 0; i < RISK_STEPS; i++) {
      const y = 166 - i * 24;
      const bg = this.add.rectangle(40, y, 78, 20, 0x3a0a10).setOrigin(0).setStrokeStyle(1, 0xf0c030);
      const t = txt(this, 79, y + 6, `x${2 ** i}`, '#a87a5a').setOrigin(0.5, 0);
      this.rungs.push({ bg, t });
    }

    // Walzen
    this.reels = new Reels(this, 180, 62, 3, 3, 40, SAHNE_SYMBOLS);
    this.reels.set(spinSahne(this.strips, Math.random));
    // Linien-Nummern am Rand
    SAHNE_LINES.forEach((rows, i) => {
      const y = i < 3 ? 62 + rows[0] * 40 + 20 : i === 3 ? 68 : 176;
      this.add.circle(172, y, 5, LINE_COLORS[i]);
      txt(this, 172, y, String(i + 1), '#000000').setOrigin(0.5);
    });

    // Gewinnplan rechts
    this.add.rectangle(318, 58, 124, 132, 0x1a0606).setOrigin(0).setStrokeStyle(1, 0xf0c030);
    txt(this, 380, 62, '3 GLEICHE', '#f0c030').setOrigin(0.5, 0);
    [...SAHNE_SYMBOLS].reverse().forEach((s, i) => {
      const y = 82 + i * 15;
      this.add.image(336, y, s).setScale(0.5);
      txt(this, 432, y - 4, `${SAHNE_PAY[s]}x`, '#f4ead0').setOrigin(1, 0);
    });

    // Anzeigen
    this.betT = this.display(140, 192, 80, 'EINSATZ');
    this.winT = this.display(228, 192, 110, 'GEWINN');

    // Knöpfe
    this.betBtn = new Btn(this, 112, 236, 64, 20, 'EINSATZ', 0x5a4a2a, () => this.cycleBet());
    this.startBtn = new Btn(this, 196, 236, 92, 24, 'START', 0x2a8a2a, () => this.spin());
    this.riskBtn = new Btn(this, 290, 236, 80, 20, 'RISIKO', 0xb02020, () => this.risk());
    this.takeBtn = new Btn(this, 378, 236, 80, 20, 'NEHMEN', 0x2a5aa0, () => this.take());
    this.updateUi();
  }

  private cycleBet() {
    if (this.busy || this.pending) return;
    this.bet = BETS[(BETS.indexOf(this.bet) + 1) % BETS.length];
    this.updateUi();
  }

  private updateUi() {
    this.betT.setText(`${this.bet}€`);
    this.winT.setText(this.pending ? `${this.pending}€` : '');
    const free = !this.busy;
    this.startBtn.setEnabled(free);
    this.betBtn.setEnabled(free && !this.pending);
    this.riskBtn.setEnabled(free && this.pending > 0 && this.step < RISK_STEPS - 1);
    this.takeBtn.setEnabled(free && this.pending > 0);
    const base = this.pending / 2 ** this.step;
    this.rungs.forEach((r, i) => {
      r.t.setText(this.pending ? `${base * 2 ** i}€` : `x${2 ** i}`);
      r.bg.setFillStyle(this.pending && i === this.step ? 0xf0c030 : 0x3a0a10);
      r.t.setColor(this.pending && i === this.step ? '#2a0a0a' : '#a87a5a');
    });
  }

  private async spin() {
    if (this.busy) return;
    if (this.pending) this.take();
    if (!this.charge(this.bet)) return;
    this.busy = true;
    this.updateUi();
    const grid = spinSahne(this.strips, Math.random);
    await this.reels.spin(grid);
    const res = evalSahne(grid, this.bet);
    this.busy = false;
    if (res.total > 0) {
      res.wins.forEach((w) => {
        this.reels.line(w.cells, LINE_COLORS[w.line]);
        this.reels.highlight(w.cells, LINE_COLORS[w.line]);
      });
      this.pending = res.total;
      this.step = 0;
      audio.sfx('chime');
      if (res.total >= this.bet * 20) this.banner(`SAHNE! ${res.total}€`);
      this.startBlink();
    }
    this.updateUi();
  }

  /** Merkur-typisch: aktuelle und nächste Stufe blinken abwechselnd. */
  private startBlink() {
    this.blink?.remove();
    let on = false;
    this.blink = this.time.addEvent({
      delay: 180, loop: true,
      callback: () => {
        if (!this.pending || this.step >= RISK_STEPS - 1) return;
        on = !on;
        const next = this.rungs[this.step + 1];
        next.bg.setFillStyle(on ? 0x8a6a20 : 0x3a0a10);
      },
    });
  }

  private risk() {
    if (this.busy || !this.pending || this.step >= RISK_STEPS - 1) return;
    if (Math.random() < RISK_CHANCE) {
      this.pending *= 2;
      this.step++;
      audio.sfx('chime');
      this.cameras.main.flash(120, 255, 220, 120);
      if (this.step >= RISK_STEPS - 1) {
        this.banner('GANZ OBEN!');
        this.time.delayedCall(700, () => this.take());
      }
    } else {
      audio.sfx('error');
      this.cameras.main.shake(200, 0.01);
      this.banner('VERZOCKT', '#ff6a5a');
      this.pending = 0;
      this.step = 0;
      this.reels.clearHighlights();
    }
    this.updateUi();
  }

  private take() {
    if (!this.pending) return;
    this.pay(this.pending);
    this.pending = 0;
    this.step = 0;
    this.blink?.remove();
    this.updateUi();
  }

  protected onClose() {
    this.take();
  }
}
