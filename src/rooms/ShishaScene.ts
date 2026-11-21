import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { T, TileInfo, TopDown } from '../scenes/TopDown';
import { hud } from '../scenes/HudScene';
import type { DialogAction } from '../dialog/data';
import { SHISHA_GUESTS } from './shishaGfx';
import { ALLEY_SHISHA_SPAWN } from './spawns';

// „Shisha 1001“: Shisha-Bar an der Straße. Cemo steht hinter der Theke, Gäste rauchen auf niedrigen Sofas.
// Xavi-Strang, Teil 1: Wer Xavi sucht, muss Cemo im Shisha-Duell schlagen (ShishaDuellScene), dann verrät er die Spur.
//  # Mosaikwand  A Bogen mit Spiegel  H Regal mit Wasserpfeifen  D Tür  T Theke  x Hocker
//  s Sitzpolster (Lehne links bzw. rechts je nach Seite des Tisches)  t Messingtisch mit Wasserpfeife  p Pflanze  . Boden
const MAP = [
  '################',
  '#AHAAHAAHA#HHHH#',
  '#.........#....#',
  '#sts...sts.TTTT#',
  '#..........x.x.#',
  '#..............#',
  '#sts...sts..sts#',
  '#..............#',
  '#p............p#',
  '#######D########',
];

/** Cemos Platz hinter der Theke (Kachel) */
const CEMO_TILE: [number, number] = [12, 2];
/** wer wo sitzt: Gast, Kachel, Blick nach links */
const SEATS: [string, [number, number], boolean][] = [
  ['trainer', [1, 3], false], ['hoodie', [3, 3], true],
  ['studentin', [7, 6], false], ['freundin', [9, 6], true],
  ['opa', [14, 6], true],
];

export class ShishaScene extends TopDown {
  constructor() {
    super('Shisha');
  }

  protected mapRows() { return MAP; }
  protected isWall(ch: string) { return '#AHD'.includes(ch); }
  protected darkness() { return 0.32; }
  protected goalText() {
    const x = state.flags.xavi;
    if (x === 'vermisst') return 'Frag Cemo hinter der Theke nach Xavi.';
    if (x === 'spur') return 'Tuncay hat Xavi mitgenommen. Er handelt auf dem Parkplatz im Norden.';
    if (x === 'club') return 'Xavi ist im Muskelkater. Bei Leni Blume.';
    return 'Shisha 1001. Tee, Tabak und Ruhe.';
  }
  protected floorKey(x: number, y: number) {
    // Teppich unter den Sitzgruppen
    const near = (cx: number, cy: number) => Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 1;
    return near(2, 3) || near(8, 3) || near(8, 6) || near(2, 6) || near(13, 6) ? 'shishaRug' : 'shishaFloor';
  }

  protected tileFor(ch: string, x: number): TileInfo {
    switch (ch) {
      case '#': return { key: 'shishaWallFront', solid: true };
      case 'A': return { key: 'shishaArch', solid: true };
      case 'H': return { key: 'shishaShelf', solid: true };
      case 'D': return { key: 'shishaDoor', solid: true };
      case 'T': return { key: x % 2 ? 'shishaCounter1' : 'shishaCounter0', solid: true, object: true };
      case 'p': return { key: 'plant', solid: true, object: true };
      case '.': return { key: '', solid: false };
      default: return { key: '', solid: true }; // Sitzpolster, Tische, Hocker setzt setupWorld
    }
  }

  protected setupWorld() {
    audio.music('shisha');
    this.furniture();
    const [dx, dy] = this.find('D');
    this.interacts.push({ x: dx * T + 8, y: dy * T, r: 18, label: () => 'Shisha-Bar verlassen', act: () => this.go('Alley', { spawn: ALLEY_SHISHA_SPAWN }) });
    // warmes Laternenlicht über den Sitzgruppen, kühles Licht hinter der Theke
    for (const [x, y] of [[2, 3], [8, 3], [2, 6], [8, 6], [13, 6]]) this.addLight(x * T + 8, y * T, 0.9, 0.6).setTint(0xffa040);
    for (const x of [11.5, 14]) this.addLight(x * T, 2 * T, 0.7, 0.5).setTint(0x60d0c0);
    this.guests();
    this.addCemo();
    this.insider();
  }

  /** Kleinigkeiten zum Entdecken: Tafel, Pokale, Hausregeln, Napf, Spiegel, Pfeifenregal */
  private insider() {
    const g = this.add.graphics().setDepth(2);
    // Preistafel an der Wandecke neben der Theke
    g.fillStyle(0x1a2a22).fillRect(10 * T + 2, 2 * T + 2, 12, 9).lineStyle(1, 0xa07a2a).strokeRect(10 * T + 2, 2 * T + 2, 12, 9);
    for (let i = 0; i < 3; i++) g.fillStyle(0xe8e0d0, 0.8).fillRect(10 * T + 4, 2 * T + 4 + i * 2.5, 6 + (i % 2) * 2, 1);
    // zwei Pokale im Regal hinter der Theke
    for (const [x, h] of [[13 * T + 3, 6], [13 * T + 9, 4]] as const) {
      g.fillStyle(0xe0c040).fillRect(x, T + 9 - h, 4, h).fillRect(x + 1, T + 9, 2, 2).fillRect(x - 1, T + 11, 6, 1);
    }
    // Hausregeln neben der Tür
    this.add.text(5 * T + 8, 9 * T + 3, 'HAUSREGELN', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#f0e0b0', backgroundColor: '#3a1e12', padding: { x: 3, y: 2 } })
      .setOrigin(0.5, 0).setResolution(2).setScale(0.5).setDepth(3);

    const spot = (x: number, y: number, r: number, label: string, text: () => string, after?: () => void) =>
      this.interacts.push({ x, y, r, label: () => label, act: () => { this.toast(text()); after?.(); } });
    spot(10 * T + 8, 3 * T + 12, 14, 'Preistafel', () => 'DOPPELAPFEL 12 € · MINZE 12 € · CLAUDIUS-TEE (ohne alles, mit Haltung) 3 € · KALLE-SPEZIAL 2 Kronkorken');
    spot(14 * T + 8, 4 * T + 8, 14, 'Pokale', () => '„Rauchringe-Meister Nordstadt 2014: Cemo“. Daneben, etwas kleiner: „2. Platz: auch Cemo“.');
    spot(10 * T + 8, 4 * T + 10, 12, 'Napf unter der Theke', () => 'Auf dem Napf steht: „Für die Katze vom Eimer. Kommt donnerstags.“ Er ist angeknabbert. Von außen.');
    spot(5 * T + 8, 8 * T + 10, 14, 'Hausregeln', () => '1. Kein Gras. 2. Kein Alkohol. 3. Keine Uniformen (seit dem General). 4. Nicht auf den Opa setzen.');
    spot(3 * T + 8, 2 * T + 6, 14, 'Spiegel', () => Phaser.Utils.Array.GetRandom([
      'Im Spiegel: du, im Rauch. Wie in einem Musikvideo von 2004.',
      'Jemand hat mit dem Finger in den Beschlag geschrieben: „X + L“. Daneben ein schiefes Herz.',
    ]));
    spot(5 * T + 8, 2 * T + 6, 14, 'Pfeifenregal', () => 'Jede Pfeife hat einen Namen. Die blaue heißt „Ex-Frau“. Keiner raucht sie.');
  }

  /** Der Opa bläst ab und zu einen Rauchring (er will ein Herz, es wird meistens ein Kreis) */
  private smokeRing(x: number, y: number) {
    const ring = this.add.graphics().setDepth(5002);
    this.tweens.addCounter({
      from: 0, to: 1, duration: 1800, ease: 'Sine.easeOut',
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        ring.clear().lineStyle(1.5, 0xe0d8d0, 0.6 * (1 - v)).strokeEllipse(x - v * 8, y - v * 16, 4 + v * 8, 3 + v * 5);
      },
      onComplete: () => ring.destroy(),
    });
  }

  private find(ch: string): [number, number] {
    for (let y = 0; y < this.rows.length; y++) {
      const x = this.rows[y].indexOf(ch);
      if (x >= 0) return [x, y];
    }
    return [1, 1];
  }

  private furniture() {
    for (let y = 0; y < this.rows.length; y++)
      for (let x = 0; x < this.rows[y].length; x++) {
        const ch = this.rows[y][x], px = x * T, py = y * T;
        if (ch === 's') {
          // Lehne zur Wand hin: links vom Tisch Blick nach rechts, rechts vom Tisch Blick nach links
          const facesLeft = this.rows[y][x - 1] === 't';
          this.add.image(px, py, 'shishaSofa').setOrigin(0).setScale(0.5).setDepth(py + 4).setFlipX(facesLeft);
        } else if (ch === 't') {
          this.add.image(px, py, 'shishaTable').setOrigin(0).setScale(0.5).setDepth(py + 10);
          this.add.image(px + 8, py + 12, 'shishaPipe').setOrigin(0.5, 1).setScale(0.5).setDepth(py + 12);
          this.smoke(px + 8, py - 1);
        } else if (ch === 'x') {
          this.add.image(px, py, 'shishaStool').setOrigin(0).setScale(0.5).setDepth(py + 4);
        }
      }
  }

  /** Rauchwölkchen aus den Wasserpfeifen */
  private smoke(x: number, y: number) {
    this.time.addEvent({
      delay: Phaser.Math.Between(1800, 3200), loop: true,
      callback: () => {
        const s = this.add.image(x + Phaser.Math.Between(-2, 2), y, 'light').setTint(0xd8d0c8).setAlpha(0.3).setScale(0.05).setDepth(5002);
        this.tweens.add({ targets: s, y: y - 18, x: s.x + Phaser.Math.Between(-6, 6), scale: 0.16, alpha: 0, duration: 2200, ease: 'Sine.easeOut', onComplete: () => s.destroy() });
      },
    });
  }

  private guests() {
    const say: Record<string, () => string> = {
      trainer: () => 'Er nickt dir zu. Seit 2009 nickt er hier jedem zu. Bestellt hat er noch nie.',
      hoodie: () => 'Er tippt aufs Handy: „Bro, heute Shisha mit Kevin?“ Welcher Kevin? Ach so. DER Kevin.',
      studentin: () => '„Der Feuerwehrmann im Muskelkater ist ECHT bei der Feuerwehr!“ – „Ist er nicht.“ – „Hat er aber gesagt!“',
      freundin: () => (state.flags.xavi === 'vermisst'
        ? 'Sie flüstert: „Xavi? Der Süße mit dem braunen Bart? War oft hier. Immer allein, immer Ayran, immer rot im Gesicht.“'
        : 'Sie zeigt dir ungefragt ein Foto vom Feuerwehrmann aus dem Muskelkater. Dann noch eins.'),
      opa: () => 'Er bläst einen Rauchring. Er soll ein Herz werden. Er wird eine Niere.',
    };
    for (const [id, [x, y], left] of SEATS) {
      if (!SHISHA_GUESTS[id]) continue;
      const g = this.add.sprite(x * T + 8 + (left ? 1 : -1), y * T + 14, `sg_${id}`, 10).setOrigin(0.5, 1).setScale(0.5).setFlipX(left).setDepth(y * T + 14);
      // ab und zu ein Zug und ein Nicken
      this.time.addEvent({
        delay: Phaser.Math.Between(2600, 5200), loop: true,
        callback: () => { if (!g.active) return; g.setY(g.y - 1); this.time.delayedCall(300, () => g.active && g.setY(g.y + 1)); },
      });
      const ring = () => this.smokeRing(g.x + (left ? -5 : 5), g.y - 18);
      if (id === 'opa') this.time.addEvent({ delay: 6500, loop: true, callback: ring });
      // ansprechbar von der freien Kachel neben dem Polster
      const fx = (x + (left ? 1 : -1)) * T + 8;
      const free = this.rows[y]?.[x + (left ? 1 : -1)] === '.';
      this.interacts.push({ x: free ? fx : g.x, y: free ? y * T + 10 : (y + 1) * T + 6, r: 14, label: () => 'Gast', act: () => { this.toast(say[id]()); if (id === 'opa') ring(); } });
    }
  }

  private addCemo() {
    const [cx, cy] = CEMO_TILE;
    const x = cx * T + 8, y = cy * T + 20;
    const cemo = this.add.sprite(x, y, 'cemo', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    this.tweens.add({ targets: cemo, x: x + 10, duration: 2600, yoyo: true, repeat: -1, hold: 1800, ease: 'Sine.easeInOut', repeatDelay: 1400 });
    this.interacts.push({ x, y: (cy + 2) * T + 4, r: 22, label: () => 'Mit Cemo reden', act: () => this.talk('cemo', (a) => this.cemoDone(a)) });
  }

  private cemoDone(a?: DialogAction) {
    if (a !== 'shishaDuell') return;
    hud.prompt = '';
    this.scene.launch('ShishaDuell', { resume: this.scene.key, onDone: (win: boolean) => this.duelDone(win) });
    this.scene.bringToTop('ShishaDuell');
    this.scene.pause();
  }

  private duelDone(win: boolean) {
    if (!win) return this.toast('Cemo grinst: „Nochmal? Ich hab Zeit. Und Tabak.“');
    state.flags.xavi = 'spur';
    this.scene.launch('Cutscene', { script: 'xaviSpur', resume: this.scene.key });
    this.scene.bringToTop('Cutscene');
    this.scene.pause();
  }
}
