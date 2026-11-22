import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { T, TileInfo, TopDown } from '../scenes/TopDown';
import { hud } from '../scenes/HudScene';
import { unlock } from '../progress/achievements';
import { floatText } from '../ui';
import type { DialogAction } from '../dialog/data';
import { ALLEY_BASAR_SPAWN } from './spawns';

// „Masala Basar“: der indische Laden in der Weststadt (offen, sobald die Baustellen weg sind).
// Adshayan steht hinter der Theke. Nach der Eröffnungsfeier liegt sein Curry überall auf dem Boden;
// hilft der Wirt beim Putzen (PutzScene), öffnet der Laden: Curry und Mango-Lassi.
//  # Wand  R Gewürzregal  P Filmplakat  K Kühlschrank (Lassi)  D Tür
//  T Theke (Chai-Kanne, Curry-Topf)  S Reis- und Linsensäcke  s Gewürzkegel  p Pflanze
const MAP = [
  '##############',
  '#RRPRRKKRRPRR#',
  '#............#',
  '#TTTTT.......#',
  '#.......ss...#',
  '#SS..........#',
  '#SS.....ss..p#',
  '######D#######',
];

/** Adshayans Platz hinter der Theke (Kachel) */
const ADSHAYAN_TILE: [number, number] = [3, 2];
/** Curry auf dem Boden, solange nicht geputzt ist (Kachel x, y, Größe) */
const CURRY: [number, number, number][] = [[4.6, 5.3, 0.5], [7.4, 2.7, 0.4], [10.6, 5.4, 0.45], [6.3, 4.5, 0.32], [11.3, 3.3, 0.36], [3.2, 4.4, 0.3]];

export class BasarScene extends TopDown {
  private adshayan?: Phaser.GameObjects.Sprite;

  constructor() {
    super('Basar');
  }

  protected mapRows() { return MAP; }
  protected isWall(ch: string) { return '#RPKD'.includes(ch); }
  protected darkness() { return 0.14; }
  protected floorKey() { return 'basarFloor'; }

  protected tileFor(ch: string, x: number): TileInfo {
    switch (ch) {
      case '#': return { key: 'basarWallFront', solid: true };
      case 'R': return { key: 'basarShelf', solid: true };
      case 'P': return { key: 'basarPoster', solid: true };
      case 'K': return { key: 'basarFridge', solid: true };
      case 'D': return { key: 'basarDoor', solid: true };
      case 'T': return { key: x % 2 ? 'basarCounter1' : 'basarCounter0', solid: true, object: true };
      case 'S': return { key: 'basarSacks', solid: true, object: true };
      case 's': return { key: 'basarSpice', solid: true, object: true };
      case 'p': return { key: 'plant', solid: true, object: true };
      default: return { key: '', solid: false };
    }
  }

  protected goalText() {
    return state.flags.basarSauber ? 'Masala Basar. Curry, Lassi und der sauberste Boden der Stadt.' : 'Adshayan hinter der Theke braucht Hilfe. Dringend.';
  }

  private find(ch: string): [number, number] {
    for (let y = 0; y < this.rows.length; y++) {
      const x = this.rows[y].indexOf(ch);
      if (x >= 0) return [x, y];
    }
    return [1, 1];
  }

  protected setupWorld() {
    audio.music('basar');
    const [dx, dy] = this.find('D');
    this.interacts.push({ x: dx * T + 8, y: dy * T, r: 18, label: () => 'Laden verlassen', act: () => this.go('Alley', { spawn: ALLEY_BASAR_SPAWN }) });
    // warmes Licht über Theke und Regalen
    for (const [x, y] of [[3, 3], [9, 2], [4, 6], [10, 6]]) this.addLight(x * T, y * T, 0.95, 0.55).setTint(0xffc070);
    this.lichterkette();
    this.curry();

    const spot = (x: number, y: number, label: string, text: () => string) =>
      this.interacts.push({ x, y, r: 14, label: () => label, act: () => this.toast(text()) });
    const [px, py] = this.find('P');
    spot(px * T + 8, (py + 1) * T + 10, 'Filmplakat', () => 'Ein Held, eine Heldin, ein Wasserfall und zweihundert Tänzer. Laufzeit: drei Stunden. Jemand hat mit Edding „BESTER FILM!!!“ daraufgeschrieben. Die Handschrift sieht aus wie Adshayans.');
    const [kx, ky] = this.find('K');
    spot(kx * T + 16, (ky + 1) * T + 10, 'Kühlschrank', () => 'Mango-Lassi, Reihe um Reihe. Ganz hinten ein einzelnes Bier mit Zettel: „Für Notfälle. Nicht für Kalle.“');
    spot(1 * T + 16, 2 * T + 10, 'Gewürzregal', () => 'Kurkuma, Kreuzkümmel, Kardamom, Bockshornklee. Alles ordentlich beschriftet. Ein Glas heißt nur „VORSICHT“.');
    spot(8 * T + 16, 5 * T + 2, 'Gewürzkegel', () => 'Perfekte Kegel aus Gewürzpulver. Ein Schild davor: „Wer niest, zahlt.“');
    spot(3 * T, 5 * T + 2, 'Reissäcke', () => 'Basmati, 25 Kilo. Auf einem Sack ist ein Abdruck. Hier hat jemand geschlafen. Nach der Feier, vermutlich.');
    this.addAdshayan();
  }

  /** bunte Lichterkette entlang der Rückwand, die Lämpchen blinken versetzt */
  private lichterkette() {
    const cols = [0xff5a5a, 0xffd040, 0x5ad0ff, 0x7aff7a];
    for (let i = 0; i < 26; i++) {
      const x = T + 6 + i * 8, y = T + 3 + Math.round(Math.sin(i / 2) * 1.5);
      const l = this.add.circle(x, y, 1, cols[i % 4]).setDepth(3);
      this.tweens.add({ targets: l, alpha: 0.35, duration: 700, yoyo: true, repeat: -1, delay: (i % 4) * 350 });
    }
  }

  /** Curry auf dem Boden, solange nicht geputzt ist; danach glänzen die Fliesen */
  private curry() {
    if (state.flags.basarSauber) {
      this.time.addEvent({
        delay: 900, loop: true,
        callback: () => {
          const s = this.add.star(Phaser.Math.Between(2, 12) * T, Phaser.Math.Between(3, 6) * T + 8, 4, 0.5, 2, 0xffffff, 0.9).setDepth(2);
          this.tweens.add({ targets: s, scale: 0, angle: 90, duration: 600, onComplete: () => s.destroy() });
        },
      });
      return;
    }
    CURRY.forEach(([x, y, sc], i) => {
      this.add.image(x * T, y * T, `basarFleck${i % 3}`).setScale(sc).setAngle(i * 90).setDepth(0.7);
    });
    const [x, y] = CURRY[0];
    this.interacts.push({ x: x * T, y: y * T - 4, r: 14, label: () => 'Curry', act: () => this.toast('Curry. Gestern noch im Topf. Dann in Adshayan. Jetzt wieder auf den Fliesen. Es riecht trotzdem gut. Das ist das Schlimmste daran.') });
  }

  /** Adshayan hinter der Theke: vorher läuft er nervös hin und her, danach wippt er fröhlich */
  private addAdshayan() {
    const [ax, ay] = ADSHAYAN_TILE;
    const x = ax * T + 8, y = ay * T + 14;
    const a = this.add.sprite(x, y, 'adshayan', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    this.adshayan = a;
    this.solid[ay][ax] = true;
    if (state.flags.basarSauber) {
      this.tweens.add({ targets: a, y: y - 1, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      this.tweens.add({ targets: a, x: x + 12, duration: 1400, yoyo: true, repeat: -1, hold: 900, repeatDelay: 700, ease: 'Sine.easeInOut' });
      // ab und zu hält er sich den Bauch
      this.time.addEvent({
        delay: 5200, loop: true,
        callback: () => {
          if (!a.active || state.flags.basarSauber) return;
          a.setTint(0xb8e0a0);
          floatText(this, a.x, a.y - 24, Phaser.Utils.Array.GetRandom(['Uff ...', 'Oh nein ...', 'Geht schon!', 'Alles gut!']), '#c8f0a0');
          this.time.delayedCall(700, () => a.active && a.clearTint());
        },
      });
    }
    this.interacts.push({ x, y: y + 18, r: 26, label: () => 'Mit Adshayan reden', act: () => this.talk('adshayan', (act) => this.adshayanDone(act)) });
  }

  private adshayanDone(a?: DialogAction) {
    if (a === 'shop') {
      audio.sfx('click');
      this.scene.launch('Shop', { shop: 'basar', resume: 'Basar' });
      this.scene.bringToTop('Shop');
      this.scene.pause();
    } else if (a === 'putzen') {
      hud.prompt = '';
      this.scene.launch('Putzen', { resume: this.scene.key, onDone: (win: boolean) => this.putzDone(win) });
      this.scene.bringToTop('Putzen');
      this.scene.pause();
    }
  }

  private putzDone(win: boolean) {
    const f = state.flags;
    if (!win) {
      f.basarVersuche = (f.basarVersuche ?? 0) + 1;
      return this.toast('Adshayan ringt die Hände: „Fast! Sag Bescheid, wenn du noch eine Runde schaffst.“');
    }
    f.basarSauber = true;
    state.money += 25;
    state.inv.curry += 2;
    audio.sfx('kaching');
    unlock('blitzblank');
    this.toast('Adshayan drückt dir 25 € und zwei Portionen Curry in die Hand: „Für meinen Helden! Ab jetzt ist offen. Für dich immer.“');
    // Raum neu aufbauen: Curry weg, Adshayan fröhlich
    this.time.delayedCall(2200, () => {
      const spawn = this.hier();
      this.cameras.main.fadeOut(250);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart({ spawn }));
    });
  }
}
