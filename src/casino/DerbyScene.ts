import Phaser from 'phaser';
import { audio } from '../audio';
import { txt } from '../ui';
import { Btn } from '../scenes/ShopScene';
import { Machine, Theme } from './Machine';
import { HORSE_NAMES, makeOdds, pickWinner } from './logic';

const BETS = [1, 2, 5, 10];
const TRACK_X = 40, TRACK_Y = 56, TRACK_W = 400, LANE = 20;
const START_X = TRACK_X + 18, FINISH_X = TRACK_X + TRACK_W - 34;

interface Runner {
  sprite: Phaser.GameObjects.Sprite;
  /** Ankunftszeit (s) und Zwischenstände für unterschiedliche Tempi */
  finish: number;
  marks: number[];
}

/** KLEPPER-DERBY: auf einen von sechs Gäulen wetten, Rennen animiert. */
export class DerbyScene extends Machine {
  private odds: number[] = [];
  private pick = 0;
  private bet = 1;
  private runners: Runner[] = [];
  private horseBtns: Btn[] = [];
  private betBtn!: Btn;
  private startBtn!: Btn;
  private comment!: Phaser.GameObjects.Text;
  private racing = false;
  /** Pferde laufen gerade (nach dem Countdown) */
  private started = false;
  private raceT = 0;
  private gallop = 0;

  constructor() {
    super('Derby');
  }

  protected theme(): Theme {
    return { title: 'KLEPPER-DERBY', body: 0x14401e, trim: 0xe8e0c0, titleColor: '#ffffff', glow: '#60ff60' };
  }

  protected build() {
    this.racing = false;
    this.started = false;
    this.runners = [];
    this.horseBtns = [];
    this.odds = makeOdds(Math.random);

    // Rennbahn
    const g = this.add.graphics();
    g.fillStyle(0x2a6a2a).fillRect(TRACK_X, TRACK_Y, TRACK_W, LANE * 6);
    for (let i = 0; i < 6; i++) {
      g.fillStyle(i % 2 ? 0x2f742f : 0x2a6a2a).fillRect(TRACK_X, TRACK_Y + i * LANE, TRACK_W, LANE);
      g.fillStyle(0xe8e0c0, 0.4).fillRect(TRACK_X, TRACK_Y + i * LANE, TRACK_W, 1);
    }
    g.fillStyle(0xffffff, 0.8).fillRect(START_X + 10, TRACK_Y, 2, LANE * 6);
    for (let y = 0; y < LANE * 6; y += 4) for (let k = 0; k < 2; k++) g.fillStyle((y / 4 + k) % 2 ? 0xffffff : 0x111111).fillRect(FINISH_X + 12 + k * 3, TRACK_Y + y, 3, 4);
    g.lineStyle(2, 0xe8e0c0).strokeRect(TRACK_X, TRACK_Y, TRACK_W, LANE * 6);

    for (let i = 0; i < 6; i++) {
      txt(this, TRACK_X + 4, TRACK_Y + i * LANE + 6, String(i + 1), '#e8e0c0');
      const sprite = this.add.sprite(START_X, TRACK_Y + i * LANE + LANE - 1, `horse${i}`, 0).setOrigin(0.5, 1).setScale(0.5).setDepth(10);
      this.runners.push({ sprite, finish: 0, marks: [] });
    }
    this.comment = txt(this, 240, TRACK_Y + LANE * 6 + 3, 'Setz auf einen Gaul!', '#f8e070').setOrigin(0.5, 0);

    // Wett-Knöpfe: 2 Reihen à 3 Pferde
    for (let i = 0; i < 6; i++) {
      const x = 92 + (i % 3) * 140, y = 196 + Math.floor(i / 3) * 20;
      this.horseBtns.push(new Btn(this, x, y, 134, 17, '', 0x3a3a2a, () => this.choose(i)));
    }
    this.betBtn = new Btn(this, 240, 240, 104, 20, '', 0x5a4a2a, () => this.cycleBet());
    this.startBtn = new Btn(this, 372, 240, 128, 22, 'RENNEN STARTEN', 0x2a8a2a, () => this.race());
    this.refreshButtons();
  }

  private refreshButtons() {
    this.horseBtns.forEach((b, i) => {
      b.setLabel(`${HORSE_NAMES[i]} ${this.odds[i]}x`);
      b.setColor(i === this.pick ? 0xb08a20 : 0x3a3a2a);
      b.setEnabled(!this.racing);
    });
    this.betBtn.setLabel(`EINSATZ ${this.bet}€`);
    this.betBtn.setEnabled(!this.racing);
    this.startBtn.setEnabled(!this.racing);
  }

  private choose(i: number) {
    if (this.racing) return;
    this.pick = i;
    this.refreshButtons();
  }

  private cycleBet() {
    if (this.racing) return;
    this.bet = BETS[(BETS.indexOf(this.bet) + 1) % BETS.length];
    this.refreshButtons();
  }

  private wait(ms: number) {
    return new Promise<void>((r) => this.time.delayedCall(ms, r));
  }

  private async race() {
    if (this.racing || this.busy) return;
    if (!this.charge(this.bet)) return;
    this.racing = this.busy = true;
    this.refreshButtons();
    this.runners.forEach((r) => r.sprite.setX(START_X).setFrame(0));

    // Ausgang festlegen: Gewinner nach Quote, Rest zufällig
    const winner = pickWinner(this.odds, Math.random);
    const others = [0, 1, 2, 3, 4, 5].filter((i) => i !== winner).sort(() => Math.random() - 0.5);
    [winner, ...others].forEach((h, rank) => {
      const r = this.runners[h];
      r.finish = 6 + rank * 0.18 + Math.random() * 0.12;
      // 6 Abschnitte mit zufälligem Tempo -> Führungswechsel
      const speeds = Array.from({ length: 6 }, () => 0.6 + Math.random() * 0.9);
      const sum = speeds.reduce((a, b) => a + b, 0);
      let acc = 0;
      r.marks = [0, ...speeds.map((s) => (acc += s / sum))];
    });

    for (const n of ['3', '2', '1']) {
      this.comment.setText(n);
      audio.sfx('blip');
      await this.wait(500);
    }
    this.comment.setText('UND LOS!');
    audio.sfx('bell');
    this.runners.forEach((r) => r.sprite.play(`horse${this.runners.indexOf(r)}_run`));
    this.raceT = 0;
    this.started = true;

    await new Promise<void>((resolve) => {
      const done = () => this.raceT > Math.max(...this.runners.map((r) => r.finish)) + 0.4;
      this.events.on('race-tick', () => done() && resolve());
    });
    this.events.off('race-tick');
    this.started = false;
    this.runners.forEach((r) => r.sprite.anims.stop());

    const name = HORSE_NAMES[winner];
    this.comment.setText(`${name} gewinnt!`);
    if (winner === this.pick) {
      const win = this.bet * this.odds[winner];
      this.banner(`GEWONNEN!\n+${win}€`);
      this.pay(win);
    } else {
      audio.sfx('error');
      this.banner(`${name}\ngewinnt`, '#ff8a6a', 8);
    }
    await this.wait(1600);
    this.odds = makeOdds(Math.random);
    this.racing = this.busy = false;
    this.comment.setText('Neue Quoten! Setz auf einen Gaul.');
    this.refreshButtons();
  }

  update(_t: number, delta: number) {
    if (!this.started) return;
    {
      this.raceT += delta / 1000;
      let leader = 0, lead = -1;
      this.runners.forEach((r, i) => {
        const p = Math.min(this.raceT / r.finish, 1);
        // Position über die Tempo-Abschnitte interpolieren
        const seg = Math.min(5, Math.floor(p * 6));
        const local = p * 6 - seg;
        const prog = r.marks[seg] + (r.marks[seg + 1] - r.marks[seg]) * local;
        const over = Math.max(0, this.raceT - r.finish) * 20; // nach dem Ziel austrudeln
        r.sprite.setX(START_X + (FINISH_X - START_X) * prog + Math.min(over, 22));
        if (prog > lead && p < 1) { lead = prog; leader = i; }
      });
      this.gallop -= delta;
      if (this.gallop <= 0) {
        audio.sfx('step');
        this.gallop = 110;
      }
      if (this.raceT > 0.8 && this.raceT < 5.4 && Math.floor(this.raceT * 2) !== Math.floor((this.raceT - delta / 1000) * 2)) {
        this.comment.setText(`${HORSE_NAMES[leader]} vorne!`);
      }
      this.events.emit('race-tick');
    }
  }
}
