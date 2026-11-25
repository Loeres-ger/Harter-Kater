import Phaser from 'phaser';
import '@fontsource/press-start-2p/latin-400.css';
import { makeAllTextures } from '../gfx';
import { audio } from '../audio';
import { makeKanalTiles } from '../world/kanalTiles';
import { OktopusHirsch } from './hirschRig';
import { MutantKatze } from './mutantKatze';

// Vorschau-Seite (nur Entwicklung, monster.html): der Oktopushirsch im Klärwerk in echter Spielauflösung (480x270,
// WebGL wie im Spiel), mit dem Wirt zum Größenvergleich. Die Knöpfe unter dem Bild spielen die Animationen ab.

const W = 480, H = 270;
const WASSER = 206, S = 0.82;

class Vorschau extends Phaser.Scene {
  create() {
    makeAllTextures(this);
    makeKanalTiles(this);
    const g = this.add.graphics();
    g.fillStyle(0x0e1416).fillRect(0, 0, W, WASSER);
    for (let y = 0; y < WASSER; y += 6) {
      g.fillStyle(0x161e20).fillRect(0, y, W, 5);
      for (let x = (y / 6) % 2 ? 0 : 8; x < W; x += 16) g.fillStyle(0x0a1010).fillRect(x, y, 1, 5);
    }
    for (const x of [30, 446]) { g.fillStyle(0x3a3a34).fillRect(x, 0, 6, WASSER); g.fillStyle(0x5a5a50).fillRect(x, 0, 1, WASSER); }
    g.fillStyle(0x1c3a14).fillRect(0, WASSER, W, 34).fillStyle(0x5a9a3a).fillRect(0, WASSER, W, 1);
    g.fillStyle(0x3a423a).fillRect(0, 240, W, 30).fillStyle(0x6a726a).fillRect(0, 240, W, 1);
    this.add.image(W / 2, WASSER, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(4, 1).setTint(0x3aa02a).setAlpha(0.3);

    let hirsch = new OktopusHirsch(this, W / 2, WASSER, S).setDepth(10);
    const wirt = this.add.sprite(36, 252, 'wirtKanal', 6).setOrigin(0.5, 1).setDepth(20);
    const katze = new MutantKatze(this, 120, 250, 1).setDepth(21);
    this.time.addEvent({ delay: 2600, loop: true, callback: () => { katze.gang = katze.gang ? 0 : 0.8; } });
    this.input.keyboard?.on('keydown-K', () => void katze.kralle(0, () => {}));
    this.input.keyboard?.on('keydown-B', () => void katze.biss(() => {}));
    hirsch.blick = { x: wirt.x, y: wirt.y - 20 };

    let laeuft = false, wut = false;
    const knopf = (id: string, fn: () => Promise<void> | void) => {
      const el = document.getElementById(id);
      if (el) el.onclick = async () => {
        audio.unlock();
        if (laeuft) return;
        laeuft = true;
        try { await fn(); } finally { laeuft = false; }
      };
    };
    knopf('auftauchen', () => hirsch.auftauchen());
    knopf('roehren', () => hirsch.roehren());
    knopf('schlag', () => hirsch.schlag({ x: wirt.x + 30, y: 252 }));
    knopf('treffer', () => hirsch.treffer());
    knopf('brunft', () => { wut = !wut; hirsch.brunft(wut); });
    knopf('strahl', () => hirsch.strahl({ x: wirt.x + 20, y: 240 }));
    knopf('curry', () => hirsch.curryFressen());
    knopf('niederlage', () => hirsch.niederlage());
    knopf('neu', () => { hirsch.destroy(); hirsch = new OktopusHirsch(this, W / 2, WASSER, S).setDepth(10); hirsch.blick = { x: wirt.x, y: wirt.y - 20 }; wut = false; });
    let nah = false;
    knopf('nah', () => { nah = !nah; this.cameras.main.zoomTo(nah ? 2.5 : 1, 400).pan(nah ? W / 2 : W / 2, nah ? 120 : H / 2, 400); });
  }
}

const spiel = new Phaser.Game({
  type: Phaser.AUTO,
  width: W,
  height: H,
  zoom: 2,
  pixelArt: true,
  roundPixels: true,
  parent: 'buehne',
  backgroundColor: '#0a0608',
  banner: false,
  audio: { noAudio: true },
  scene: class extends Phaser.Scene {
    create() {
      document.fonts.load('8px "Press Start 2P"').finally(() => this.scene.add('vorschau', Vorschau, true));
    }
  },
});

document.getElementById('png')!.onclick = () => {
  spiel.renderer.snapshot((bild) => {
    const a = document.createElement('a');
    a.download = 'oktopushirsch.png';
    a.href = (bild as HTMLImageElement).src;
    a.click();
  });
};
