import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { T, TileInfo, TopDown } from '../scenes/TopDown';
import { fadeTo } from '../ui';
import type { DialogAction } from '../dialog/data';
import { BAR_LADDER_SPAWN } from './spawns';

// Der Dachboden über der Kneipe: Dachschrägen, Fenster, alter Krempel und Bornas Matratze.
//  R Dachschräge  W Dachfenster  b Kisten  o Schaukelpferd  c Kerze auf Kiste  s Sessel
//  m/n Matratze  H Luke mit Leiter nach unten
const MAP = [
  '##############',
  '#RRWRRRRRRWRR#',
  '#bb....o.....#',
  '#b...........#',
  '#c..mn.....s.#',
  '#............#',
  '#.....H......#',
  '##############',
];

export class AtticScene extends TopDown {
  constructor() {
    super('Dach');
  }

  protected mapRows() { return MAP; }
  protected isWall(ch: string) { return '#RW'.includes(ch); }
  protected darkness() { return 0.5; }
  protected floorKey() { return 'atticFloor'; }

  protected tileFor(ch: string): TileInfo {
    switch (ch) {
      case '#': return { key: 'atticWallFront', solid: true };
      case 'R': return { key: 'atticRoofFront', solid: true };
      case 'W': return { key: 'atticWindow', solid: true };
      case 'b': return { key: 'atticBoxes', solid: true, object: true };
      case 'o': return { key: 'atticJunk', solid: true, object: true };
      case 'c': return { key: 'candleCrate', solid: true, object: true };
      case 's': return { key: 'armchair', solid: true, object: true };
      case 'm': return { key: 'mattressL', solid: false };
      case 'n': return { key: 'mattressR', solid: false };
      case 'H': return { key: 'atticHatch', solid: false };
      default: return { key: '', solid: false };
    }
  }

  protected goalText() {
    const f = state.flags;
    if (f.borna === 'gebrochen') return 'Hier oben ist es jetzt still.';
    if (f.borna === 'hoffnung') return 'Borna und Lily wohnen jetzt hier oben.';
    if (!f.bornaGetroffen) return 'Auf der Matratze liegt jemand. Und es riecht süßlich.';
    return 'Borna hängt hier oben fest.';
  }

  private find(ch: string): [number, number] {
    for (let y = 0; y < this.rows.length; y++) {
      const x = this.rows[y].indexOf(ch);
      if (x >= 0) return [x, y];
    }
    return [1, 1];
  }

  protected setupWorld() {
    audio.music('none');
    audio.setRain(true); // Regen auf dem Dach
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.setRain(false));

    // Luke nach unten
    const [hx, hy] = this.find('H');
    this.interacts.push({ x: hx * T + 8, y: hy * T + 8, r: 16, label: () => 'Runter in die Kneipe', act: () => this.go('Bar', { spawn: BAR_LADDER_SPAWN }) });

    // Mondlicht durch die Dachfenster, Kerzenschein
    for (let x = 0; x < this.rows[1].length; x++) if (this.rows[1][x] === 'W') this.addLight(x * T + 8, 2 * T + 6, 0.9, 0.45).setTint(0x8090d0);
    const [cx, cy] = this.find('c');
    const candle = this.addLight(cx * T + 8, cy * T + 4, 0.7, 0.7).setTint(0xffa040);
    this.tweens.killTweensOf(candle);
    this.time.addEvent({ delay: 110, loop: true, callback: () => candle.setAlpha(0.55 + Math.random() * 0.2) });

    this.examine();
    if (state.flags.borna === 'gebrochen') this.emptyMattress();
    else this.addBorna();
  }

  private examine() {
    const spots: [string, string, () => string][] = [
      ['W', 'Dachfenster', () => 'Über den Dächern blinkt rot der Kran der Glanz-Lofts-Baustelle.'],
      ['b', 'Kartons', () => 'Beschriftet: „Weihnachten“, „Steuer 2009“, „NICHT ÖFFNEN – Kalle“.'],
      ['o', 'Schaukelpferd', () => 'Ein Schaukelpferd mit nur einem Auge. Passt zur Katze.'],
      ['s', 'Sessel', () => 'Ein Sessel, der mehr gesehen hat als Felix’ Notizbuch.'],
      ['c', 'Kerze', () => (state.flags.borna === 'gebrochen' ? 'Die Kerze ist heruntergebrannt.' : 'Eine Kerze, ein Aschenbecher, drei Feuerzeuge. Keins funktioniert.')],
    ];
    for (const [ch, label, text] of spots) {
      const [x, y] = this.find(ch);
      const below = ch === 'W' ? 1 : 0;
      this.interacts.push({ x: x * T + 8, y: (y + below) * T + 10, r: 14, label: () => label, act: () => this.toast(text()) });
    }
  }

  /** Borna im Schneidersitz auf der Matratze, umgeben von Rauch. Nach dem Happy End sitzt Lily neben ihm. */
  private addBorna() {
    const [mx, my] = this.find('m');
    const x = mx * T + 8, y = my * T + 13;
    const borna = this.add.sprite(x, y, 'bornaSit', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    this.tweens.add({ targets: borna, scaleY: 0.49, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // zieht ab und zu am Joint
    const smoke = this.add.particles(x + 3, y - 12, 'light', {
      lifespan: 3200, speedY: { min: -9, max: -4 }, speedX: { min: -3, max: 4 }, scale: { start: 0.05, end: 0.25 },
      alpha: { start: 0.25, end: 0 }, tint: 0xb8c8a8, frequency: 420,
    }).setDepth(4000);
    this.time.addEvent({
      delay: 3600, loop: true,
      callback: () => {
        if (!borna.active) return;
        borna.setFrame(1);
        smoke.explode(6);
        this.time.delayedCall(1200, () => borna.active && borna.setFrame(0));
      },
    });
    this.interacts.push({
      x, y: y - 4, r: 18,
      label: () => (borna.active ? 'Mit Borna reden' : null),
      act: () => this.talk('borna', (a) => this.bornaDone(a)),
    });

    if (state.flags.borna === 'hoffnung') {
      const lx = x + 14;
      const lily = this.add.sprite(lx, y, 'lilySit', 2).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
      this.tweens.add({ targets: lily, angle: { from: -3, to: 3 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.interacts.push({ x: lx, y: y - 4, r: 14, label: () => 'Mit Lily reden', act: () => this.talk('lilyDach') });
      // kleine Herzchen ab und zu
      this.time.addEvent({
        delay: 2600, loop: true,
        callback: () => {
          const h = this.add.text(x + 7, y - 18, '♥', { fontFamily: 'monospace', fontSize: '8px', color: '#ff7aa0' }).setDepth(6000).setOrigin(0.5);
          this.tweens.add({ targets: h, y: h.y - 12, alpha: 0, duration: 1600, onComplete: () => h.destroy() });
        },
      });
    }
  }

  private bornaDone(a?: DialogAction) {
    if (a !== 'bornaGebrochen' || state.flags.borna) return;
    // Verlauf A ist endgültig: Lily taucht nicht mehr auf
    state.flags.borna = 'gebrochen';
    this.leaving = true;
    fadeTo(this, 'Cutscene', { script: 'bornaWeg', music: 'none', next: { scene: 'Bar', data: { spawn: BAR_LADDER_SPAWN } } });
  }

  /** Verlauf A danach: leere Matratze, ein Zettel. */
  private emptyMattress() {
    const [mx, my] = this.find('m');
    const x = mx * T + 10, y = my * T + 8;
    this.add.rectangle(x, y, 5, 4, 0xf0ead8).setDepth(y + 1);
    this.interacts.push({
      x, y: y + 4, r: 16,
      label: () => 'Bornas Matratze',
      act: () => this.toast('Leer. Der Zettel liegt noch da. Du lässt ihn liegen.'),
    });
  }
}
