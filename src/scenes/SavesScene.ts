import Phaser from 'phaser';
import { audio } from '../audio';
import { chapterList, deleteSaves } from '../progress/save';
import { H, W, txt } from '../ui';
import { Btn } from './ShopScene';
import { loadChapter } from './TitleScene';
import type { PauseScene } from './PauseScene';

const PW = 400, PH = 250, ROW_H = 16;

/**
 * Kapitel laden: erreichte Kapitel anklickbar, noch nicht erreichte gesperrt.
 * Vom Titel aus mit „Spielstand löschen“; aus dem Pausenmenü (laufendes Spiel) mit Rückfrage vor dem Laden.
 */
export class SavesScene extends Phaser.Scene {
  private closing = false;
  private armed = false;
  /** geöffnet aus dem Pausenmenü statt vom Titel */
  private inGame = false;
  /** Kapitel, das im laufenden Spiel auf den zweiten Klick wartet */
  private confirmId: string | null = null;
  private status = new Map<string, { t: Phaser.GameObjects.Text; text: string }>();

  constructor() {
    super('Saves');
  }

  create(data?: { from?: string }) {
    this.closing = false;
    this.armed = false;
    this.inGame = data?.from === 'Pause';
    this.confirmId = null;
    this.status = new Map();
    this.scene.bringToTop();
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setInteractive();
    dim.on('pointerdown', () => this.close());

    const panel = this.add.container(W / 2, H / 2);
    const bg = this.add.rectangle(0, 0, PW, PH, 0x1a1210).setStrokeStyle(2, 0xc9a24a).setInteractive();
    const inner = this.add.rectangle(0, 0, PW - 8, PH - 8, 0x000000, 0).setStrokeStyle(1, 0x3a2a1e);
    const title = txt(this, -PW / 2 + 12, -PH / 2 + 9, this.inGame ? 'KAPITEL WÄHLEN' : 'KAPITEL LADEN', '#f0c030');
    const close = new Btn(this, PW / 2 - 18, -PH / 2 + 13, 22, 16, 'X', 0x5a2a20, () => this.close());
    panel.add([bg, inner, title, close.box]);

    const list = chapterList();
    list.forEach(({ def, savedAt }, i) => {
      const y = -PH / 2 + 28 + i * ROW_H;
      const ok = !!savedAt;
      const row = this.add.rectangle(-PW / 2 + 10, y, PW - 20, ROW_H - 3, ok ? 0x2e2214 : 0x161010).setOrigin(0).setStrokeStyle(1, ok ? 0x8a6a3a : 0x2a201a);
      const name = txt(this, -PW / 2 + 18, y + 2, ok ? def.name : '???', ok ? '#f4ead0' : '#5a4a3a');
      const when = ok
        ? savedAt!.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : 'GESPERRT';
      const status = txt(this, PW / 2 - 16, y + 2, when, ok ? '#9ae09a' : '#6a4a3a', 8).setOrigin(1, 0);
      panel.add([row, name, status]);
      if (!ok) return;
      this.status.set(def.id, { t: status, text: when });
      row.setInteractive({ useHandCursor: true });
      row.on('pointerover', () => row.setFillStyle(0x4a3420));
      row.on('pointerout', () => row.setFillStyle(0x2e2214));
      row.on('pointerup', () => this.pick(def.id));
    });

    if (this.inGame) {
      // im laufenden Spiel nichts löschen; dafür der Hinweis, was beim Laden verloren geht
      panel.add(txt(this, 0, PH / 2 - 30, 'Laden ersetzt das laufende Spiel.', '#c97a4a').setOrigin(0.5));
      panel.add(txt(this, 0, PH / 2 - 18, 'Zum Laden ein Kapitel zweimal anklicken.', '#6a5a4a').setOrigin(0.5));
    } else {
      const anySave = list.some((c) => c.savedAt);
      const del = new Btn(this, 0, PH / 2 - 18, 220, 16, 'SPIELSTAND LÖSCHEN', 0x5a2a20, () => {
        if (!anySave) return;
        if (!this.armed) {
          this.armed = true;
          del.setLabel('WIRKLICH ALLES LÖSCHEN?');
          del.setColor(0xa03020);
          this.time.delayedCall(3000, () => {
            if (this.closing || !this.armed) return;
            this.armed = false;
            del.setLabel('SPIELSTAND LÖSCHEN');
            del.setColor(0x5a2a20);
          });
          return;
        }
        deleteSaves();
        audio.sfx('clang');
        this.close(true);
      });
      del.setEnabled(anySave);
      panel.add(del.box);
      panel.add(txt(this, 0, PH / 2 - 36, 'Achievements bleiben beim Löschen erhalten.', '#6a5a4a').setOrigin(0.5));
    }

    const kb = this.input.keyboard!;
    for (const k of ['ESC', 'BACKSPACE']) kb.on(`keydown-${k}`, () => this.close());
    // Ziffern 1–9 wählen das jeweilige Kapitel
    kb.on('keydown', (e: KeyboardEvent) => {
      const c = list[Number(e.key) - 1];
      if (c?.savedAt) this.pick(c.def.id);
    });

    panel.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 150, ease: 'Back.easeOut' });
  }

  /** Vom Titel: sofort laden. Im laufenden Spiel: erster Klick fragt nach, zweiter lädt. */
  private pick(id: string) {
    if (this.closing) return;
    if (!this.inGame || this.confirmId === id) return this.loadSlot(id);
    if (this.confirmId) {
      const prev = this.status.get(this.confirmId)!;
      prev.t.setText(prev.text).setColor('#9ae09a');
    }
    this.confirmId = id;
    const s = this.status.get(id)!;
    s.t.setText('NOCHMAL: LADEN').setColor('#ff8a6a');
    audio.sfx('blip');
    this.time.delayedCall(3000, () => {
      if (this.closing || this.confirmId !== id) return;
      this.confirmId = null;
      s.t.setText(s.text).setColor('#9ae09a');
    });
  }

  private loadSlot(id: string) {
    if (this.closing) return;
    this.closing = true;
    audio.unlock();
    if (this.inGame) {
      const pause = this.scene.get('Pause') as PauseScene;
      this.scene.resume('Pause');
      this.scene.stop();
      pause.startChapter(id);
      return;
    }
    const title = this.scene.get('Title');
    this.scene.stop();
    loadChapter(title, id);
  }

  /** Schließen; nach dem Löschen baut der Titel sein Menü neu auf. */
  private close(changed = false) {
    if (this.closing) return;
    this.closing = true;
    if (this.inGame) {
      this.scene.resume('Pause');
      this.scene.stop();
      return;
    }
    const title = this.scene.get('Title');
    this.scene.stop();
    if (changed) title.events.emit('savesChanged');
  }
}
