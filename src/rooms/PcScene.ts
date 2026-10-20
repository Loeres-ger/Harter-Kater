import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { unlock } from '../progress/achievements';
import { PC_FILES, PcFile } from '../dialog/pcFiles';
import { H, W, txt } from '../ui';
import { Btn } from '../scenes/ShopScene';
import { toast } from '../scenes/HudScene';

export interface PcData {
  /** pausierte Szene (Dachboden), die danach weiterläuft */
  resume: string;
}

// Bildschirmbereich des Röhrenmonitors
const SX = 46, SY = 26, SW = W - 92, SH = H - 64;
const GREEN = '#58f08a', DIM = '#2a8a4a';
/** Sperre nach einem gescheiterten Hochladen (Spielsekunden) */
const SPERRE = 45;
/** Spannungssequenz: Dauer, Fortschritt pro Tastendruck, Verfall pro Sekunde, Rückschlag durch Claudius */
const UPLOAD_TIME = 12, PER_PRESS = 8, DECAY = 5, JAM = 12, JAM_EVERY = 2400;

const SHOUTS = [
  'BÜRGER! Finger weg von der Wahrheit!',
  'Ich zähle bis drei! Ich KANN bis drei zählen!',
  'Das ist kein Hochladen. Das ist Verrat am Hochladen!',
  'Diese Akten sind gefälscht! Ich hab sie selbst gefälscht!',
  'Im Namen der Beweglichen Verteidigung: STOPP!',
];

/** Captain Claudius' versteckter Rechner: Akten lesen, Lesestand merken, am Ende veröffentlichen. */
export class PcScene extends Phaser.Scene {
  private cfg!: PcData;
  private view!: Phaser.GameObjects.Container;
  private wasRunning = false;
  private busy = false;
  private closing = false;
  private keyHandler?: (e: KeyboardEvent) => void;

  constructor() {
    super('Pc');
  }

  create(data: PcData) {
    this.cfg = data;
    this.busy = false;
    this.closing = false;
    this.wasRunning = state.running;
    state.running = false;
    this.scene.bringToTop();

    // Röhrenmonitor
    this.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0);
    this.add.rectangle(W / 2, H / 2 - 4, W - 60, H - 36, 0xc8c0a8).setStrokeStyle(2, 0x6a6458);
    this.add.rectangle(W / 2, H / 2 - 4, SW + 8, SH + 8, 0x3a3a34);
    this.add.rectangle(SX, SY, SW, SH, 0x07140c).setOrigin(0);
    const glow = this.add.image(W / 2, H / 2, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(3, 2).setTint(0x30a050).setAlpha(0.12);
    this.tweens.add({ targets: glow, alpha: 0.08, duration: 90, yoyo: true, repeat: -1, repeatDelay: 1700 });
    txt(this, W / 2, H - 22, 'CLAUDIUS-OS 3.1  ·  EIGENTUM DER WAHRHEIT', '#5a5448').setOrigin(0.5);
    const scan = this.add.graphics().setDepth(50);
    for (let y = SY; y < SY + SH; y += 2) scan.fillStyle(0x000000, 0.18).fillRect(SX, y, SW, 1);

    this.view = this.add.container(0, 0);
    this.input.keyboard!.on('keydown-ESC', () => !this.busy && this.close());
    this.cameras.main.fadeIn(150);
    audio.sfx('blip');
    this.showList();
  }

  // ---------------------------------------------------------------- Ansichten

  private clear() {
    this.view.removeAll(true);
    if (this.keyHandler) this.input.keyboard!.off('keydown', this.keyHandler);
    this.keyHandler = undefined;
  }

  private header(title: string) {
    this.view.add(txt(this, SX + 8, SY + 6, title, GREEN));
    this.view.add(this.add.rectangle(SX + 8, SY + 18, SW - 16, 1, 0x2a8a4a).setOrigin(0));
  }

  private button(x: number, y: number, w: number, label: string, color: number, act: () => void) {
    const b = new Btn(this, x, y, w, 16, label, color, act);
    this.view.add(b.box);
    return b;
  }

  private read(): string[] {
    return state.flags.pcGelesen ?? [];
  }

  private showList() {
    this.clear();
    const f = state.flags;
    const locked = (f.pcSperreBis ?? 0) > state.time;
    if (locked) {
      this.header('ZUGRIFF VERWEIGERT');
      const left = Math.ceil((f.pcSperreBis ?? 0) - state.time);
      this.view.add(txt(this, W / 2, SY + 60, 'CLAUDIUS HAT DAS PASSWORT GEÄNDERT.', '#ff7a6a').setOrigin(0.5));
      this.view.add(txt(this, W / 2, SY + 80, `Neuer Versuch in ${left} Sekunden.\n(Draußen. Hier drin steht die Zeit still.)`, DIM).setOrigin(0.5).setAlign('center'));
      this.button(W / 2, SY + SH - 16, 120, 'AUSSCHALTEN', 0x3a3040, () => this.close());
      return;
    }

    const done = f.claudius === 'veroeffentlicht';
    this.header(done ? 'C:\\AKTEN  ·  STATUS: VERÖFFENTLICHT' : 'C:\\AKTEN\\STRENG_GEHEIM');
    const read = this.read();
    PC_FILES.forEach((file, i) => {
      const y = SY + 34 + i * 22;
      const isRead = read.includes(file.id);
      const row = this.add.rectangle(SX + 8, y - 8, SW - 16, 18, 0x0e2a18, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      const icon = this.add.image(SX + 18, y + 1, 'ach_file').setScale(0.75);
      const name = txt(this, SX + 30, y - 3, file.name, isRead ? DIM : GREEN);
      const mark = txt(this, SX + SW - 12, y - 3, isRead ? 'GELESEN' : 'NEU', isRead ? DIM : '#f8e070').setOrigin(1, 0);
      row.on('pointerover', () => row.setFillStyle(0x0e2a18, 1));
      row.on('pointerout', () => row.setFillStyle(0x0e2a18, 0));
      row.on('pointerup', () => { audio.sfx('click'); this.showFile(file, 0); });
      this.view.add([row, icon, name, mark]);
    });
    this.view.add(txt(this, SX + 8, SY + 104, `Gelesen: ${read.length} von ${PC_FILES.length}.  Tasten 1-3 öffnen.`, DIM));

    // Tastatur: 1–3 öffnen eine Akte
    this.keyHandler = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1;
      if (PC_FILES[i]) this.showFile(PC_FILES[i], 0);
    };
    this.input.keyboard!.on('keydown', this.keyHandler);

    if (done) {
      this.view.add(txt(this, SX + 8, SY + 120, 'Die Presse hat alles. Claudius hat geschrien.\nEs hat nichts genützt.', DIM));
    } else if (read.length >= PC_FILES.length) {
      this.button(W / 2 - 66, SY + SH - 16, 120, 'VERÖFFENTLICHEN', 0xa8342a, () => this.upload());
    } else {
      this.view.add(txt(this, SX + 8, SY + 120, 'Erst alles lesen. Dann entscheiden.', DIM));
    }
    this.button(done || read.length < PC_FILES.length ? W / 2 : W / 2 + 66, SY + SH - 16, 120, 'AUSSCHALTEN', 0x3a3040, () => this.close());
  }

  private showFile(file: PcFile, page: number) {
    this.clear();
    this.header(`${file.name}  ·  SEITE ${page + 1}/${file.pages.length}`);
    this.view.add(txt(this, SX + 10, SY + 26, file.pages[page], GREEN).setLineSpacing(4));
    const last = page === file.pages.length - 1;
    if (last) this.markRead(file.id);
    const prev = () => page > 0 && this.showFile(file, page - 1);
    const next = () => (last ? this.showList() : this.showFile(file, page + 1));
    if (page > 0) this.button(SX + 54, SY + SH - 16, 90, '< ZURÜCK', 0x2a4a34, prev);
    this.button(W / 2, SY + SH - 16, 90, 'LISTE', 0x3a3040, () => this.showList());
    this.button(SX + SW - 54, SY + SH - 16, 90, last ? 'FERTIG' : 'WEITER >', 0x2a6a3a, next);
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') prev();
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === ' ' || e.key === 'Enter') next();
    };
    this.input.keyboard!.on('keydown', this.keyHandler);
  }

  private markRead(id: string) {
    const read = this.read();
    if (read.includes(id)) return;
    state.flags.pcGelesen = [...read, id];
    if (state.flags.pcGelesen.length >= PC_FILES.length) unlock('beweismittel');
  }

  // ---------------------------------------------------------------- Veröffentlichen: Spannungssequenz

  private upload() {
    if (this.busy) return;
    this.busy = true;
    this.clear();
    audio.music('tension');
    this.header('HOCHLADEN: ALLE AKTEN  →  LOKALPRESSE');

    // Claudius schaltet sich per Videoanruf dazu
    const camBox = this.add.container(SX + SW - 76, SY + 26);
    const frame = this.add.rectangle(0, 0, 68, 86, 0x0a0a12).setOrigin(0).setStrokeStyle(1, 0xc04040);
    const bust = this.add.image(34, 94, 'nbust_claudius').setOrigin(0.5, 1).setScale(0.9);
    const mask = this.make.graphics({}, false).fillRect(SX + SW - 76, SY + 26, 68, 86).createGeometryMask();
    bust.setMask(mask);
    const live = txt(this, 4, 3, 'LIVE', '#ff5050');
    camBox.add([frame, bust, live]);
    camBox.setAlpha(0);
    this.view.add(camBox);
    this.tweens.add({ targets: camBox, alpha: 1, duration: 300 });
    this.tweens.add({ targets: live, alpha: 0.2, duration: 400, yoyo: true, repeat: -1 });

    const shout = txt(this, SX + 8, SY + 120, '', '#ff9a8a').setWordWrapWidth(SW - 100);
    const barBg = this.add.rectangle(SX + 8, SY + 34, SW - 100, 14, 0x0e2a18).setOrigin(0).setStrokeStyle(1, 0x2a8a4a);
    const bar = this.add.rectangle(SX + 9, SY + 35, 0, 12, 0x58f08a).setOrigin(0);
    const pct = txt(this, SX + 8, SY + 52, '0 %', GREEN);
    const clock = txt(this, SX + SW - 92, SY + 52, '', '#f8e070').setOrigin(1, 0);
    const help = txt(this, SX + 8, SY + 72, 'HÄMMERN! Knopf, Leertaste oder E.\nClaudius stört dazwischen.', DIM);
    this.view.add([shout, barBg, bar, pct, clock, help]);

    let progress = 0, finished = false;
    const start = this.time.now;
    const say = (s: string) => {
      shout.setText(`CLAUDIUS: ${s}`);
      this.tweens.add({ targets: shout, x: { from: SX + 10, to: SX + 8 }, duration: 60, yoyo: true, repeat: 2 });
    };
    say('Was tun Sie da an MEINEM Rechner?!');

    const press = () => {
      if (finished) return;
      progress = Math.min(100, progress + PER_PRESS);
      audio.sfx('blip');
      this.tweens.add({ targets: bar, scaleY: { from: 1.3, to: 1 }, duration: 80 });
    };
    const btn = this.button(SX + (SW - 100) / 2 + 8, SY + SH - 18, 150, 'HOCHLADEN!', 0xa8342a, press);
    this.keyHandler = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'e' || e.key === 'Enter') press(); };
    this.input.keyboard!.on('keydown', this.keyHandler);

    // Claudius' Störsender: wirft den Fortschritt zurück
    const jam = this.time.addEvent({
      delay: JAM_EVERY, loop: true,
      callback: () => {
        if (finished) return;
        progress = Math.max(0, progress - JAM);
        bust.setTexture('nbust_claudiusAngry');
        this.time.delayedCall(600, () => bust.active && bust.setTexture('nbust_claudius'));
        say(Phaser.Utils.Array.GetRandom(SHOUTS));
        audio.sfx('angry');
        this.cameras.main.shake(180, 0.006);
        this.cameras.main.flash(120, 160, 40, 40);
      },
    });

    const tick = this.time.addEvent({
      delay: 50, loop: true,
      callback: () => {
        if (finished) return;
        progress = Math.max(0, progress - DECAY * 0.05);
        const left = Math.max(0, UPLOAD_TIME - (this.time.now - start) / 1000);
        bar.width = ((SW - 102) * progress) / 100;
        pct.setText(`${Math.floor(progress)} %`);
        clock.setText(`${left.toFixed(1)} s`);
        if (progress >= 100) end(true);
        else if (left <= 0) end(false);
      },
    });

    const end = (ok: boolean) => {
      finished = true;
      jam.remove();
      tick.remove();
      btn.setEnabled(false);
      if (this.keyHandler) this.input.keyboard!.off('keydown', this.keyHandler);
      this.keyHandler = undefined;
      if (ok) {
        bar.width = SW - 102;
        pct.setText('100 %');
        say('NEIIIN! Das ... das war so nicht abgesprochen!');
        help.setText('HOCHGELADEN. Die Lokalpresse hat alles.').setColor('#f8e070');
        audio.sfx('kaching');
        state.flags.claudius = 'veroeffentlicht';
        unlock('pressefreiheit');
        this.time.delayedCall(1800, () => this.confrontation());
      } else {
        bust.setTexture('nbust_claudiusAngry');
        say('Zugriff verweigert! Im Namen der Wahrheit!');
        help.setText('VERBINDUNG GETRENNT.\nDer Rechner ist eine Weile gesperrt.').setColor('#ff7a6a');
        audio.sfx('error');
        this.cameras.main.shake(300, 0.01);
        state.flags.pcSperreBis = state.time + SPERRE;
        this.time.delayedCall(2200, () => {
          this.busy = false;
          audio.music('none');
          toast('Claudius hat dich ausgesperrt. Später noch mal versuchen.');
          this.showList();
        });
      }
    };
  }

  /** Nach dem Veröffentlichen: Konfrontation vor der Kneipe, danach geht es draußen weiter. */
  private confrontation() {
    this.clear();
    this.closing = true;
    if (!state.gameOver) state.running = true;
    this.scene.stop(this.cfg.resume);
    this.scene.start('Cutscene', { script: 'claudiusEnde', music: 'tension', next: { scene: 'Alley', data: { spawn: [17, 18] } } });
  }

  private close() {
    if (this.closing) return;
    this.closing = true;
    this.clear();
    state.running = this.wasRunning;
    this.cameras.main.fadeOut(150, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.resume(this.cfg.resume);
      this.scene.stop();
    });
  }
}
