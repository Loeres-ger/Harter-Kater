import Phaser from 'phaser';
import { audio } from '../audio';
import { makeAllTextures } from '../gfx';
import { makeCasinoTextures } from '../casino/gfx';
import { makeGuestTextures } from '../guests/gfx';
import { makeWorldTextures } from '../world/textures';
import { makeLeonardTextures } from '../world/leonard';
import { makeAchievementIcons } from '../progress/icons';
import { makeRoomTextures } from '../rooms/gfx';
import { makeLadenTextures } from '../rooms/ladenGfx';
import { makeClubTextures } from '../rooms/clubGfx';
import { makeShishaTextures } from '../rooms/shishaGfx';
import { makeBasarTextures } from '../rooms/basarGfx';
import { makeKanalTextures } from '../rooms/kanalGfx';
import { makeKanalTiles } from '../world/kanalTiles';
import { makePassantenTextures } from '../world/passantenGfx';
import { STRASSEN_NPCS } from '../world/passanten';
import { makeXaviTextures } from '../rooms/xaviGfx';
import { makeNickTextures } from '../rooms/nickGfx';
import { makeAnneTextures } from '../events/anne';
import { makeClaudiusTextures } from '../events/claudius';
import { makeStreetTextures } from '../world/street';
import { makeCityTextures } from '../world/city';
import { getMap, isTestRun } from '../maps';
import { CHAPTERS, autoStand, clearAuto, lastChapter, snapshotData } from '../progress/save';
import { VICTIM, loadState, resetState, state } from '../state';
import { H, W, fadeTo, txt } from '../ui';
import { resetAlley } from './AlleyScene';
import { BAR_START_SPAWN, resetBar } from './BarScene';
import { isTouchDevice } from '../touch';
import { Btn } from './ShopScene';
import { bigTitle, scanlines, tavernBackdrop } from './screenFx';

/** Impressum-/Datenschutz-Links nur auf dem Titelbildschirm zeigen. */
export function showLegalLinks(on: boolean) {
  document.getElementById('legal')?.classList.toggle('hidden', !on);
}

export function newGame(scene: Phaser.Scene) {
  clearAuto();
  showLegalLinks(false);
  resetState();
  resetBar();
  resetAlley();
  state.running = true;
  fadeTo(scene, 'Cutscene', { script: 'prolog', next: { scene: 'Bar', data: { spawn: BAR_START_SPAWN } } });
}

/** Gespeichertes Kapitel laden und dort weiterspielen, wo die Kapitel-Einblendung endete. */
export function loadChapter(scene: Phaser.Scene, id: string) {
  const def = CHAPTERS.find((c) => c.id === id);
  const data = snapshotData(id);
  if (!def || !data) return false;
  clearAuto();
  showLegalLinks(false);
  resetBar();
  resetAlley();
  loadState(data);
  state.running = true;
  fadeTo(scene, def.scene, { spawn: def.spawn });
  return true;
}

/** Fortsetzen: den Zwischenstand der offenen Welt laden, falls er neuer ist als der letzte Kapitelstand. */
export function loadAuto(scene: Phaser.Scene) {
  const a = autoStand();
  if (!a) return false;
  showLegalLinks(false);
  resetBar();
  resetAlley();
  loadState(a.data);
  state.running = true;
  fadeTo(scene, a.scene, { spawn: a.spawn });
  return true;
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    // Alle Grafiken werden hier einmalig gemalt. Jede Gruppe ist einzeln abgesichert: Scheitert eine
    // (z. B. auf einem exotischen Handy-Browser), laufen die anderen trotzdem und die Konsole sagt, welche.
    const groups: [string, () => void][] = [
      ['Grundgrafiken', () => { if (!this.textures.exists('wirt')) makeAllTextures(this); }],
      ['Spielautomaten', () => makeCasinoTextures(this)],
      ['Stammgäste', () => makeGuestTextures(this)],
      ['Außenwelt', () => makeWorldTextures(this)],
      ['Leonard', () => { if (!this.textures.exists('leonard')) makeLeonardTextures(this); }],
      ['Achievement-Symbole', () => { if (!this.textures.exists('ach_lock')) makeAchievementIcons(this); }],
      ['Dachboden und Toiletten', () => makeRoomTextures(this)],
      ['Feinkostladen', () => makeLadenTextures(this)],
      ['Stripclub', () => makeClubTextures(this)],
      ['Shisha-Bar', () => makeShishaTextures(this)],
      ['Masala Basar', () => makeBasarTextures(this)],
      ['Unter dem Eimer', () => { makeKanalTextures(this); makeKanalTiles(this); }],
      ['Leute auf der Straße', () => { if (STRASSEN_NPCS) makePassantenTextures(this); }],
      ['Xavi-Strang', () => makeXaviTextures(this)],
      ['Bornas Business', () => makeNickTextures(this)],
      ['Anne', () => makeAnneTextures(this)],
      ['Straßenansicht', () => makeStreetTextures(this)],
      ['Stadterweiterung', () => makeCityTextures(this)],
      ['Captain Claudius', () => makeClaudiusTextures(this)],
    ];
    for (const [name, make] of groups) {
      try {
        make();
      } catch (err) {
        console.error(`[Harter Karter] Grafiken „${name}“ konnten nicht erzeugt werden:`, err);
      }
    }
    // Achievement-Einblendungen laufen dauerhaft über allen Szenen
    if (!this.scene.isActive('Notify')) this.scene.launch('Notify');
    // Testlauf aus dem Map-Editor (nur Dev-Server): direkt auf die bearbeitete Karte
    if (isTestRun()) return this.startTestRun();
    showLegalLinks(true);
    audio.music('titel');
    // Audio darf erst nach einer Nutzeraktion starten
    this.input.once('pointerdown', () => audio.unlock());
    this.input.keyboard!.once('keydown', () => audio.unlock());
    this.cameras.main.setBackgroundColor('#0d0b0a').fadeIn(400);

    // Kulisse: die Kneipe bei Nacht (gleich im Pausenmenü)
    tavernBackdrop(this);

    // ---------------------------------------------------------------- Schrift und Menü
    const LX = 26;
    const tag = txt(this, LX, 30, 'KNEIPE.  PLAN.  KATZE.', '#c9a24a', 8).setDepth(40).setAlpha(0);
    const title = bigTitle(this, LX, 46, ['HARTER', 'KARTER'], 32).setDepth(40).setAlpha(0);
    const sub = txt(this, LX, 132, 'Ein Spiel über Gastfreundschaft.', '#b8a888', 8).setDepth(40).setAlpha(0);
    const line = this.add.rectangle(LX, 148, 0, 1, 0xc9a24a).setOrigin(0).setDepth(40);
    const blurb = txt(this, LX, 156, `Du bist der Wirt.\nMach ${VICTIM} zum Wrack.\nDie Katze hat Hunger.`,'#8a7a6a', 8).setDepth(40).setAlpha(0);
    // Glühen hinter dem Titel, ab und zu flackert der Schriftzug wie eine Neonröhre
    const glow = this.add.image(LX + 100, 82, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2.4, 1.2).setTint(0xff9a30).setAlpha(0).setDepth(39);
    this.tweens.add({ targets: [tag, sub, blurb], alpha: 1, duration: 600, delay: 500 });
    this.tweens.add({ targets: title, alpha: 1, x: { from: LX - 12, to: LX }, duration: 700, ease: 'Cubic.easeOut', delay: 150 });
    this.tweens.add({ targets: line, width: 150, duration: 700, delay: 700, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: glow, alpha: 0.28, duration: 900, delay: 400 });
    this.time.addEvent({
      delay: 3800, loop: true,
      callback: () => {
        title.setAlpha(0.55);
        this.time.delayedCall(60, () => title.setAlpha(1));
        this.time.delayedCall(140, () => title.setAlpha(0.7));
        this.time.delayedCall(200, () => title.setAlpha(1));
      },
    });

    scanlines(this);

    this.started = false;
    this.buildMenu(true);
    this.events.on('savesChanged', () => this.buildMenu(false));
    this.input.keyboard!.on('keydown-SPACE', () => this.primary());
    this.input.keyboard!.on('keydown-ENTER', () => this.primary());
  }

  /** Map-Editor „Im Spiel testen“: frischer Spielstand, optional nach der Glanz-Mission (Baustellen offen), Start am Spawn „start“. */
  private startTestRun() {
    const p = new URLSearchParams(location.search);
    showLegalLinks(false);
    resetState();
    resetBar();
    resetAlley();
    if (p.get('frei') === '1') {
      Object.assign(state, { dead: true, bodyInAlley: true, verfall: 100 });
      state.flags.glanzErledigt = true;
    }
    state.running = true;
    const m = getMap('alley');
    const sp = m.objects.find((o) => o.kind === 'spawn' && (o.label ?? 'start') === 'start');
    // Spawn in Koordinaten der Originalkarte (TopDown rechnet die Erweiterung wieder drauf)
    const spawn: [number, number] = sp ? [Math.floor(sp.x / 16) - (m.origin?.x ?? 0), Math.round((sp.y - 14) / 16) - (m.origin?.y ?? 0)] : [17, 18];
    this.scene.start('Alley', { spawn });
  }

  private started = false;
  private menu?: Phaser.GameObjects.Container;
  /** Taste Leertaste/Enter: weiterspielen, falls ein Stand existiert, sonst neues Spiel */
  private primary = () => {};

  /** Overlay (Achievements, Kapitel laden) offen? Dann reagiert das Titelmenü nicht. */
  private overlayOpen() {
    return this.scene.isActive('Achievements') || this.scene.isActive('Saves');
  }

  /** Menü je nach Spielstand: ohne Stand „Spiel starten“, mit Stand „Fortsetzen“, „Neues Spiel“, „Kapitel“. */
  private buildMenu(intro: boolean) {
    this.menu?.destroy();
    const LX = 26;
    const menu = this.add.container(0, 0).setDepth(41);
    this.menu = menu;
    const mobile = isTouchDevice(this);
    const last = lastChapter();

    const begin = (act: () => void) => {
      if (this.started || this.overlayOpen()) return;
      this.started = true;
      audio.unlock();
      // Auf dem Handy: Vollbild und Querformat erzwingen (wo der Browser es erlaubt)
      if (mobile) {
        try {
          if (!this.scale.isFullscreen) this.scale.startFullscreen();
          (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
        } catch {
          /* nicht unterstützt */
        }
      }
      this.cameras.main.flash(250, 255, 220, 160);
      act();
    };
    const openAch = () => {
      if (this.started || this.overlayOpen()) return;
      audio.unlock();
      this.scene.launch('Achievements');
    };
    const openSaves = () => {
      if (this.started || this.overlayOpen()) return;
      audio.unlock();
      this.scene.launch('Saves');
    };

    const buttons: Btn[] = [];
    let pulse: Btn;
    if (!last) {
      const startBtn = new Btn(this, LX + 75, 208, 150, 22, mobile ? 'ZUM STARTEN TIPPEN' : 'SPIEL STARTEN', 0xa8342a, () => begin(() => newGame(this)));
      const achBtn = new Btn(this, LX + 75, 233, 150, 16, 'ACHIEVEMENTS', 0x3a3040, openAch);
      buttons.push(startBtn, achBtn);
      pulse = startBtn;
      this.primary = () => begin(() => newGame(this));
    } else {
      const cont = () => begin(() => loadAuto(this) || loadChapter(this, last.id));
      const contBtn = new Btn(this, LX + 75, 198, 150, 18, 'FORTSETZEN', 0xa8342a, cont);
      // Neues Spiel überschreibt später die Kapitelstände: erst nach Rückfrage
      let armed = false;
      const newBtn = new Btn(this, LX + 75, 219, 150, 14, 'NEUES SPIEL', 0x5a3a2a, () => {
        if (!armed) {
          armed = true;
          newBtn.setLabel('WIRKLICH NEU?');
          newBtn.setColor(0xa03020);
          hint.setText('Alte Kapitelstände werden dann überschrieben.').setColor('#c97a4a');
          this.time.delayedCall(3000, () => {
            if (this.started || !armed || !newBtn.box.active) return;
            armed = false;
            newBtn.setLabel('NEUES SPIEL');
            newBtn.setColor(0x5a3a2a);
            hint.setText(controls).setColor('#5a4a3a');
          });
          return;
        }
        begin(() => newGame(this));
      });
      const savesBtn = new Btn(this, LX + 37, 238, 74, 14, 'KAPITEL', 0x3a3040, openSaves);
      const achBtn = new Btn(this, LX + 113, 238, 74, 14, 'ERFOLGE', 0x3a3040, openAch);
      buttons.push(contBtn, newBtn, savesBtn, achBtn);
      pulse = contBtn;
      this.primary = cont;
    }
    for (const b of buttons) menu.add(b.box);
    const controls = mobile ? 'Joystick: laufen   E: benutzen' : 'WASD: laufen   E: benutzen   Enter: Start';
    const hint = txt(this, LX, 253, controls, '#5a4a3a', 8);
    menu.add(hint);

    if (intro) {
      for (const b of buttons) b.box.setAlpha(0);
      this.tweens.add({ targets: buttons.map((b) => b.box), alpha: 1, duration: 500, delay: 900 });
    }
    this.tweens.add({ targets: pulse.box, scale: 1.04, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: intro ? 1400 : 0 });
  }
}
