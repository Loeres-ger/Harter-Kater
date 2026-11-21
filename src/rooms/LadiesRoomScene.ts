import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { T, TileInfo, TopDown } from '../scenes/TopDown';
import { unlock } from '../progress/achievements';
import { LENI_AUSSCHLAFEN } from '../progress/flags';
import type { DialogAction } from '../dialog/data';
import { BAR_DAMEN_SPAWN } from './spawns';
import { STRAENGE, starteStrang } from '../progress/quests';

// Damentoilette: zwei Waschbecken mit Spiegeln, zwei Kabinen. Leni hängt betrunken über dem Waschbecken.
// Nach dem Gespräch muss sie sich übergeben und schläft eine Weile in der Kabine. Danach steht sie wieder am Becken.
//  k Waschbecken  j Fliesenwand  q WC  l Kabinenwand  w Kabinentür  D Tür zur Kneipe  e Pflanze
const MAP = [
  '############',
  '#jkjkjjqlqj#',
  '#......wlwj#',
  '#..........#',
  '#..........#',
  '#e.........#',
  '#####D######',
];

/** Lenis Platz am Waschbecken und ihre Kabine (Kacheln) */
const LENI_TILE: [number, number] = [4, 2];
const LENI_STALL: [number, number] = [7, 2];

type LeniPhase = 'betrunken' | 'kabine' | 'wach';

export class LadiesRoomScene extends TopDown {
  private leni?: Phaser.GameObjects.Sprite;
  private stallDoor?: Phaser.GameObjects.Image;

  constructor() {
    super('DamenWC');
  }

  init() {
    super.init();
    this.leni = this.stallDoor = undefined;
  }

  protected mapRows() { return MAP; }
  protected isWall(ch: string) { return '#kjD'.includes(ch); }
  protected darkness() { return 0.25; }
  protected floorKey(x: number, y: number) { return (x * 5 + y * 3) % 9 === 0 ? 'wcFloorDirty' : 'wcFloor'; }

  protected tileFor(ch: string): TileInfo {
    switch (ch) {
      case '#': case 'j': return { key: 'tileWallFront', solid: true };
      case 'k': return { key: 'sinkMirror', solid: true };
      case 'D': return { key: 'wcExit', solid: true };
      case 'q': return { key: 'wcBowl', solid: true };
      case 'l': return { key: 'stallWall', solid: true };
      case 'w': return { key: 'stallDoorD', solid: true };
      case 'e': return { key: 'plant', solid: true, object: true };
      default: return { key: '', solid: false };
    }
  }

  private phase(): LeniPhase {
    const t = state.flags.leniGekotzt;
    if (t === undefined) return 'betrunken';
    return state.time < t + LENI_AUSSCHLAFEN ? 'kabine' : 'wach';
  }

  /**
   * Xavi-Strang: Erst die betrunkene Leni (ganz normales Nebenereignis). Ist die Stadt offen und hat das Spiel den
   * Strang vorgemerkt (strangBereit, siehe progress/quests.ts), stürzt Leni beim nächsten Besuch heulend aus der Kabine.
   * Nach der Zusage steht sie wartend am Becken.
   */
  private xaviPhase(): 'heult' | 'wartet' | null {
    const f = state.flags;
    if (f.xavi === 'gerettet') return null;
    if (f.xavi) return 'wartet';
    return f.strangBereit === 'xavi' && f.leniGekotzt !== undefined ? 'heult' : null;
  }

  protected goalText() {
    const xp = this.xaviPhase();
    if (xp === 'heult') return 'Aus einer Kabine: lautes Schluchzen.';
    if (xp === 'wartet') return 'Leni wartet auf Neuigkeiten von Xavi.';
    const ph = this.phase();
    if (ph === 'betrunken') return 'Damentoilette. Jemand hängt über dem Waschbecken.';
    if (ph === 'kabine') return 'Leni schläft ihren Rausch in der Kabine aus.';
    return 'Leni ist wieder halbwegs bei sich.';
  }

  private find(ch: string): [number, number] {
    for (let y = 0; y < this.rows.length; y++) {
      const x = this.rows[y].indexOf(ch);
      if (x >= 0) return [x, y];
    }
    return [1, 1];
  }

  protected setupWorld() {
    audio.music('wc');
    const [dx, dy] = this.find('D');
    this.interacts.push({ x: dx * T + 8, y: dy * T, r: 18, label: () => 'Zurück in die Kneipe', act: () => this.go('Bar', { spawn: BAR_DAMEN_SPAWN }) });
    this.addLight(6 * T, 3 * T, 1.1, 0.5).setTint(0xf0d8e8);
    const [kx, ky] = this.find('k');
    this.interacts.push({ x: kx * T + 8, y: (ky + 1) * T + 6, r: 12, label: () => 'Waschbecken', act: () => this.toast('Auf dem Spiegel steht in Lippenstift: „XAVI = LÜGNER“.') });

    // Kabine mit Leni darin (Tür geschlossen, solange sie schläft bzw. heult)
    const [sx, sy] = LENI_STALL;
    const xp = this.xaviPhase();
    this.stallDoor = this.add.image(sx * T, sy * T, 'stallDoorLocked').setOrigin(0).setScale(0.5).setDepth(sy * T + 1)
      .setVisible(xp === 'heult' || (!xp && this.phase() === 'kabine'));
    this.interacts.push({
      x: sx * T + 8, y: (sy + 1) * T + 4, r: 14,
      label: () => (this.leni || this.xaviPhase() ? 'Kabine' : this.phase() === 'kabine' ? 'Leni (Kabine)' : 'Kabine'),
      act: () => this.toast(!this.leni && !this.xaviPhase() && this.phase() === 'kabine'
        ? Phaser.Utils.Array.GetRandom(['Von drinnen: Schnarchen. Und ein leises „Xavi ...“.', 'Leni schläft. Das Glas Wasser steht noch auf dem Becken.', 'Ein Geräusch wie ein Walross mit Schluckauf.'])
        : 'Frei. Und erstaunlich sauber. Für diese Kneipe.'),
    });

    if (xp === 'heult') {
      this.toast('Aus der Kabine: lautes Schluchzen. Dann ein Name: „Xaviii ...“');
      this.time.delayedCall(1300, () => this.leniStuermtRaus());
    } else if (xp === 'wartet') this.placeSadLeni();
    else if (state.flags.xavi === 'gerettet') return; // Leni ist mit Xavi unterwegs
    else if (this.phase() !== 'kabine') this.placeLeni();
  }

  /** Leni stürzt heulend aus der Kabine, rennt zum Wirt und fängt sofort an zu reden. */
  private leniStuermtRaus() {
    if (this.leni || this.leaving) return;
    const [sx, sy] = LENI_STALL;
    this.stallDoor?.setVisible(false);
    audio.sfx('clang');
    this.cameras.main.shake(160, 0.004);
    const leni = this.add.sprite(sx * T + 8, (sy + 1) * T + 10, 'leni', 0).setOrigin(0.5, 1).setScale(0.5).setDepth((sy + 1) * T + 10);
    this.leni = leni;
    this.sob(leni);
    const p = this.player;
    const tx = Phaser.Math.Clamp(p.x + (p.x > leni.x ? -13 : 13), 2 * T, 10 * T);
    const ty = Phaser.Math.Clamp(p.y, 3 * T + 12, 5 * T + 12);
    this.actsBlocked = true;
    leni.play(Math.abs(tx - leni.x) > Math.abs(ty - leni.y) ? 'leni_side' : 'leni_down').setFlipX(tx < leni.x);
    this.tweens.add({
      targets: leni, x: tx, y: ty, duration: 700, ease: 'Quad.easeOut',
      onUpdate: () => leni.setDepth(leni.y),
      onComplete: () => {
        leni.anims.stop();
        leni.setFrame(p.x > leni.x ? 6 : 0).setFlipX(p.x < leni.x);
        this.actsBlocked = false;
        this.addSadTalk(leni);
        this.talk('leniXavi', (a) => this.xaviDone(a));
      },
    });
  }

  /** Leni steht nach der Zusage am Waschbecken und wartet */
  private placeSadLeni() {
    const [lx, ly] = LENI_TILE;
    const leni = this.add.sprite(lx * T + 8, ly * T + 13, 'leni', 0).setOrigin(0.5, 1).setScale(0.5).setDepth(ly * T + 13);
    this.leni = leni;
    this.add.image(leni.x, leni.y - 1, 'shadow').setDepth(1);
    this.sob(leni, true);
    this.addSadTalk(leni);
  }

  private addSadTalk(leni: Phaser.GameObjects.Sprite) {
    this.interacts.push({
      x: leni.x, y: leni.y - 4, r: 22,
      label: () => (leni.active ? (state.flags.xavi ? 'Mit Leni reden' : 'Leni trösten') : null),
      act: () => (state.flags.xavi ? this.talk('leniWartet') : this.talk('leniXavi', (a) => this.xaviDone(a))),
    });
  }

  /** Schluchzen: Tränen und ab und zu ein „*schnief*“ */
  private sob(leni: Phaser.GameObjects.Sprite, leise = false) {
    this.tweens.add({ targets: leni, scaleY: 0.48, duration: 260, yoyo: true, repeat: -1, repeatDelay: leise ? 1800 : 500 });
    this.time.addEvent({
      delay: leise ? 2600 : 900, loop: true,
      callback: () => {
        if (!leni.active) return;
        for (const dx of [-2, 2]) {
          const t = this.add.rectangle(leni.x + dx, leni.y - 15, 1, 1.5, 0x8ac8ff).setDepth(6000);
          this.tweens.add({ targets: t, y: t.y + 7, alpha: 0, duration: 600, onComplete: () => t.destroy() });
        }
        if (Math.random() < (leise ? 0.3 : 0.5)) {
          const h = this.add.text(leni.x + 6, leni.y - 24, '*schnief*', { fontFamily: 'monospace', fontSize: '6px', color: '#a8d0ff' }).setDepth(6000);
          this.tweens.add({ targets: h, y: h.y - 8, alpha: 0, duration: 1000, onComplete: () => h.destroy() });
        }
      },
    });
  }

  /** Zusage: Die Suche beginnt (Strang „xavi“), Kapitel-Einblendung als Speicherpunkt */
  private xaviDone(a?: DialogAction) {
    if (a !== 'xaviSuche' || state.flags.xavi) return;
    const s = STRAENGE.find((x) => x.id === 'xavi');
    if (s) starteStrang(s, state.flags, state.time);
    state.flags.strangBereit = undefined;
    this.scene.launch('Cutscene', { script: 'xaviStart', resume: this.scene.key });
    this.scene.bringToTop('Cutscene');
    this.scene.pause();
  }

  update(t: number, d: number) {
    super.update(t, d);
    // ausgeschlafen, während der Wirt im Raum ist
    if (!this.leni && !this.xaviPhase() && state.flags.xavi !== 'gerettet' && this.phase() === 'wach') {
      this.stallDoor?.setVisible(false);
      this.placeLeni();
      this.toast('Die Kabinentür geht auf. Leni wankt zurück zum Waschbecken.');
    }
  }

  /** Leni am Waschbecken: vor dem Kotzen mit dem Rücken zum Raum, schwankend; danach wach. */
  private placeLeni() {
    const [lx, ly] = LENI_TILE;
    const x = lx * T + 8, y = ly * T + 13;
    const drunk = this.phase() === 'betrunken';
    const leni = this.add.sprite(x, y, 'leni', drunk ? 3 : 0).setOrigin(0.5, 1).setScale(0.5).setDepth(y);
    this.leni = leni;
    this.add.image(x, y - 1, 'shadow').setDepth(1);
    if (drunk) {
      this.tweens.add({ targets: leni, angle: { from: -6, to: 6 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.time.addEvent({
        delay: 2400, loop: true,
        callback: () => {
          if (!leni.active || this.phase() !== 'betrunken') return;
          const h = this.add.text(x + 6, y - 22, '*hicks*', { fontFamily: 'monospace', fontSize: '6px', color: '#f0c0d0' }).setDepth(6000);
          this.tweens.add({ targets: h, y: h.y - 8, alpha: 0, duration: 1000, onComplete: () => h.destroy() });
        },
      });
    } else {
      this.tweens.add({ targets: leni, angle: { from: -2, to: 2 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.interacts.push({
      x, y: y - 4, r: 22,
      label: () => (leni.active && leni.visible ? 'Leni ansprechen' : null),
      act: () => (this.phase() === 'betrunken'
        ? this.talk('leni', (a) => this.leniDone(a))
        : this.talk('leniDanach')),
    });
  }

  private leniDone(a?: DialogAction) {
    if (a !== 'leniKotzt' || state.flags.leniGekotzt !== undefined || !this.leni) return;
    state.flags.leniGekotzt = state.time;
    if (state.flags.leniWasser) unlock('glasWasser');
    const leni = this.leni;
    this.leaving = true;
    this.tweens.killTweensOf(leni);
    // Hand vor den Mund: grün, ein Würgen, ein kurzes Zittern, dann los
    leni.setAngle(0).setFrame(0).setTint(0xb0e090);
    audio.sfx('retch');
    const hmpf = this.add.text(leni.x, leni.y - 26, 'HMPF!', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#b8e070' }).setOrigin(0.5).setScale(0.5).setResolution(2).setDepth(6001);
    this.tweens.add({ targets: leni, x: leni.x + 1, duration: 50, yoyo: true, repeat: 5 });
    this.tweens.add({ targets: hmpf, y: hmpf.y - 6, alpha: 0, delay: 500, duration: 400, onComplete: () => hmpf.destroy() });
    const [sx, sy] = LENI_STALL;
    // hastig zur Kabine
    this.tweens.add({
      targets: leni, x: sx * T + 8, y: (sy + 1) * T + 12, duration: 700, delay: 600, ease: 'Quad.easeIn',
      onStart: () => leni.setFrame(6).play('leni_stagger'),
      onUpdate: () => leni.setDepth(leni.y),
      onComplete: () => {
        leni.anims.stop();
        this.tweens.add({
          targets: leni, y: sy * T + 12, alpha: 0, duration: 250,
          onComplete: () => {
            leni.destroy();
            this.leni = undefined;
            this.stallDoor?.setVisible(true);
            audio.sfx('clang');
            this.time.delayedCall(300, () => { audio.sfx('puke'); this.cameras.main.shake(500, 0.006); });
            this.time.delayedCall(1500, () => audio.sfx('gurgle'));
            this.time.delayedCall(2300, () => { audio.sfx('retch'); audio.sfx('puke'); this.cameras.main.shake(400, 0.005); });
            this.time.delayedCall(800, () => this.toast('Aus der Kabine: ein Geräusch wie ein Abfluss, der rückwärts läuft.'));
            this.time.delayedCall(3600, () => {
              this.toast('Dann: Stille. Dann: Schnarchen.');
              this.leaving = false;
            });
          },
        });
      },
    });
  }
}
