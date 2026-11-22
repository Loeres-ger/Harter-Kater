import Phaser from 'phaser';
import { audio } from '../audio';
import { floatText, txt } from '../ui';
import { Btn } from '../scenes/ShopScene';
import { Machine, Theme } from './Machine';
import { RISK_CHANCE, RISK_STEPS, SAHNE_GEWICHT, SahneSym, dreheSahne, sahneCashpot, werteSahne } from './logic';

const BETS = [1, 2, 5];
const SYMBOLE = Object.keys(SAHNE_GEWICHT) as SahneSym[];
/** Mitte des Symbolfensters */
const FX = 324, FY = 122;

/**
 * ALLES SAHNE: eine Walze, ein Symbol pro Dreh. Kleeblatt, Münze und Marienkäfer füllen den Cashpot (dahinter
 * stecken drei Gewinnleitern, die man nicht sieht), das Sahnehäubchen ist der Joker, der Teufel löscht alles.
 * Der Cashpot lässt sich jederzeit kassieren und danach auf der alten Risikoleiter verdoppeln (oder verzocken).
 */
export class SahneScene extends Machine {
  private bet = 1;
  /** erreichte Stufe je Leiter (0 = nichts) */
  private stand = [0, 0, 0];
  /** kassierter Gewinn auf der Risikoleiter und die Stufe dort */
  private pending = 0;
  private step = 0;
  private betT!: Phaser.GameObjects.Text;
  private potT!: Phaser.GameObjects.Text;
  private winT!: Phaser.GameObjects.Text;
  private fenster!: Phaser.GameObjects.Image;
  private fensterRahmen!: Phaser.GameObjects.Rectangle;
  private rungs: { bg: Phaser.GameObjects.Rectangle; t: Phaser.GameObjects.Text }[] = [];
  private blink?: Phaser.Time.TimerEvent;
  private startBtn!: Btn;
  private kasseBtn!: Btn;
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
    this.stand = [0, 0, 0];
    this.rungs = [];

    // Risikoleiter links (wie früher): kassierten Gewinn verdoppeln oder verzocken
    txt(this, 79, 58, 'RISIKO', '#f0c030').setOrigin(0.5, 0);
    for (let i = 0; i < RISK_STEPS; i++) {
      const y = 166 - i * 24;
      const bg = this.add.rectangle(40, y, 78, 20, 0x3a0a10).setOrigin(0).setStrokeStyle(1, 0xf0c030);
      const t = txt(this, 79, y + 6, `x${2 ** i}`, '#a87a5a').setOrigin(0.5, 0);
      this.rungs.push({ bg, t });
    }

    // großes Symbolfenster in der Mitte; die Leitern laufen unsichtbar im Hintergrund, man sieht nur den Cashpot
    this.add.rectangle(FX - 62, FY - 62, 124, 124, 0x0a0606).setOrigin(0).setStrokeStyle(2, 0xf0c030);
    this.fensterRahmen = this.add.rectangle(FX - 58, FY - 58, 116, 116, 0xf4ead0).setOrigin(0);
    this.fenster = this.add.image(FX, FY, 'as_leer').setScale(3);
    // kleine Legende links vom Fenster: Joker und Teufel
    this.add.image(184, 84, 'as_joker').setScale(0.75);
    txt(this, 184, 100, 'JOKER', '#f4ead0').setOrigin(0.5, 0);
    this.add.image(184, 140, 'as_teufel').setScale(0.75);
    txt(this, 184, 156, 'ALLES WEG', '#ff6a5a').setOrigin(0.5, 0);

    // Anzeigen
    this.betT = this.display(40, 191, 78, 'EINSATZ');
    this.potT = this.display(130, 191, 150, 'CASHPOT');
    this.winT = this.display(288, 191, 152, 'GEWINN');

    // Knöpfe
    this.betBtn = new Btn(this, 84, 231, 64, 20, 'EINSATZ', 0x5a4a2a, () => this.cycleBet());
    this.startBtn = new Btn(this, 162, 231, 76, 24, 'DREHEN', 0x2a8a2a, () => void this.spin());
    this.kasseBtn = new Btn(this, 254, 231, 92, 22, 'KASSIEREN', 0xc08a10, () => this.kassieren());
    this.riskBtn = new Btn(this, 342, 231, 70, 20, 'RISIKO', 0xb02020, () => this.risk());
    this.takeBtn = new Btn(this, 414, 231, 62, 20, 'NEHMEN', 0x2a5aa0, () => this.take());

    const kb = this.input.keyboard!;
    kb.on('keydown-SPACE', () => void this.spin());
    kb.on('keydown-ENTER', () => (this.pending ? this.take() : this.kassieren()));
    this.updateUi();
  }

  private get cashpot() {
    return sahneCashpot(this.stand, this.bet);
  }

  private cycleBet() {
    if (this.busy || this.pending || this.cashpot) return;
    this.bet = BETS[(BETS.indexOf(this.bet) + 1) % BETS.length];
    this.updateUi();
  }

  private updateUi() {
    const pot = this.cashpot;
    this.betT.setText(`${this.bet}€`);
    this.potT.setText(pot ? `${pot}€` : '');
    this.winT.setText(this.pending ? `${this.pending}€` : '');
    const free = !this.busy;
    this.startBtn.setEnabled(free);
    this.betBtn.setEnabled(free && !this.pending && !pot);
    this.kasseBtn.setEnabled(free && pot > 0);
    this.riskBtn.setEnabled(free && this.pending > 0 && this.step < RISK_STEPS - 1);
    this.takeBtn.setEnabled(free && this.pending > 0);
    // Risikoleiter
    const base = this.pending / 2 ** this.step;
    this.rungs.forEach((r, i) => {
      r.t.setText(this.pending ? `${base * 2 ** i}€` : `x${2 ** i}`);
      r.bg.setFillStyle(this.pending && i === this.step ? 0xf0c030 : 0x3a0a10);
      r.t.setColor(this.pending && i === this.step ? '#2a0a0a' : '#a87a5a');
    });
  }

  private warte(ms: number) {
    return new Promise<void>((res) => this.time.delayedCall(ms, res));
  }

  private async spin() {
    if (this.busy) return;
    if (this.pending) this.take();
    if (!this.charge(this.bet)) return;
    this.busy = true;
    this.updateUi();

    // die Walze rattert durch die Symbole, dann bleibt eins stehen
    const sym = dreheSahne(Math.random);
    for (let i = 0; i < 12; i++) {
      this.fenster.setTexture(SYMBOLE[(Math.floor(Math.random() * SYMBOLE.length))]).setY(FY - 6 + (i % 2) * 8);
      if (i % 2 === 0) audio.sfx('blip');
      await this.warte(45 + i * 6);
    }
    this.fenster.setTexture(sym).setY(FY).setScale(3.5);
    this.tweens.add({ targets: this.fenster, scale: 3, duration: 220, ease: 'Back.easeOut' });

    const vorher = this.cashpot;
    const r = werteSahne(this.stand, sym, this.bet);
    if (r.teufel) {
      await this.teufel(vorher);
    } else {
      this.stand = r.stand;
      // der Cashpot wächst: kleiner Zuwachs über der Anzeige
      const plus = this.cashpot - vorher;
      if (plus > 0) {
        floatText(this, 205, 186, `+${plus}€`, '#f8e070');
        this.tweens.add({ targets: this.potT, scale: 1.25, duration: 110, yoyo: true });
      }
      if (sym === 'as_joker') { audio.sfx('chime'); this.banner('SAHNE!', '#fff0c0', 16); }
      else if (r.gestiegen.length) audio.sfx('coin');
      else if (sym === 'as_leer') audio.sfx('click');
      if (r.sofort) {
        this.pay(r.sofort);
        this.banner(`GANZ OBEN! +${r.sofort}€`);
        this.cameras.main.flash(160, 255, 230, 120);
      }
    }
    this.busy = false;
    this.updateUi();
  }

  /** Der Teufel: alles weg. Rotes Aufblitzen, Lachen, der Cashpot zählt rot auf null herunter. */
  private async teufel(verloren: number) {
    audio.sfx('demon');
    this.cameras.main.flash(220, 220, 20, 20);
    this.cameras.main.shake(320, 0.012);
    this.fensterRahmen.setFillStyle(0xff3030);
    this.tweens.add({ targets: this.fenster, angle: { from: -8, to: 8 }, duration: 70, yoyo: true, repeat: 5, onComplete: () => this.fenster.setAngle(0) });
    this.banner(verloren ? `TEUFEL! ${verloren}€ WEG` : 'TEUFEL!', '#ff4a3a');
    this.stand = [0, 0, 0];
    if (verloren) {
      this.potT.setColor('#ff2a2a');
      for (let k = 5; k >= 0; k--) {
        this.potT.setText(`${Math.round((verloren * k) / 5)}€`);
        await this.warte(70);
      }
      this.potT.setColor('#ff5040');
    }
    this.fensterRahmen.setFillStyle(0xf4ead0);
  }

  /** Cashpot nehmen: er wandert auf die Risikoleiter (verdoppeln oder nehmen), die Gewinnleitern fangen neu an */
  private kassieren() {
    const pot = this.cashpot;
    if (this.busy || !pot) return;
    this.pending += pot;
    this.step = 0;
    this.stand = [0, 0, 0];
    audio.sfx('kaching');
    if (pot >= this.bet * 30) this.banner(`ALLES SAHNE! ${pot}€`);
    this.startBlink();
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

  /** Beim Gehen wird alles ausgezahlt: der Cashpot und ein Gewinn auf der Risikoleiter */
  protected onClose() {
    const pot = this.cashpot;
    if (pot) { this.pending += pot; this.stand = [0, 0, 0]; }
    this.take();
  }
}
