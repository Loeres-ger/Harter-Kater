import Phaser from 'phaser';
import '@fontsource/press-start-2p/latin-400.css';
import { makeAllTextures } from '../gfx';
import { audio } from '../audio';
import { makeKanalTiles } from '../world/kanalTiles';
import { OKTO_WASSER, makeOktopushirschTextures } from './oktopushirsch';
import { OktopusHirsch } from './hirschRig';

// Vorschau-Seite (nur Entwicklung, monster.html): der Oktopushirsch im Klärwerk, mit dem Wirt und der Katze zum
// Größenvergleich, bewegt (monster/hirschRig.ts). Die Knöpfe unter dem Bild spielen die Animationen ab.

const W = 400, H = 270;
const BECKEN = 196;

class Vorschau extends Phaser.Scene {
  create() {
    makeAllTextures(this);
    makeKanalTiles(this);
    makeOktopushirschTextures(this);
    // doppelte Auflösung wie im Spiel: Welt 400x270, Leinwand 800x540
    this.cameras.main.setZoom(2).centerOn(W / 2, H / 2);
    const g = this.add.graphics();
    // Klärwerk: Backsteinwand im grünen Dämmer, Rohre, Becken, Steg vorn
    g.fillStyle(0x0e1416).fillRect(0, 0, W, BECKEN);
    for (let y = 0; y < BECKEN; y += 8) {
      g.fillStyle(0x1a2226).fillRect(0, y, W, 7);
      for (let x = (y / 8) % 2 ? 0 : 8; x < W; x += 16) g.fillStyle(0x0e1416).fillRect(x, y, 1, 7);
    }
    for (const [x, w] of [[24, 6], [356, 6]] as const) { g.fillStyle(0x4a3a2a).fillRect(x, 0, w, BECKEN); g.fillStyle(0x7a6a4a).fillRect(x, 0, 1, BECKEN); }
    g.fillStyle(0x4a3a2a).fillRect(0, 40, W, 5).fillStyle(0x7a6a4a).fillRect(0, 40, W, 1);
    g.fillStyle(0x1c2a1c).fillRect(0, BECKEN, W, H - BECKEN);
    for (let i = 0; i < 60; i++) g.fillStyle(i % 4 ? 0x2e4a2c : 0x4a6a48).fillRect(Phaser.Math.Between(0, W - 8), Phaser.Math.Between(BECKEN + 2, 236), Phaser.Math.Between(3, 9), 1);
    g.fillStyle(0x4a5052).fillRect(0, 240, W, 30).fillStyle(0x6a7072).fillRect(0, 240, W, 1).fillStyle(0x2a3032).fillRect(0, 269, W, 1);
    for (let x = 4; x < W; x += 22) g.fillStyle(0x8a8a92).fillRect(x, 230, 1, 10);
    g.fillStyle(0x8a8a92).fillRect(0, 230, W, 1);

    // Leuchten: grünes Wasser, violette Geweihaugen
    const licht = (x: number, y: number, s: number, farbe: number, a: number) =>
      this.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(s).setTint(farbe).setAlpha(a);
    licht(W / 2, BECKEN + 10, 3.4, 0x3aa02a, 0.35);
    // der Hirsch, bewegt: Ursprung auf der Wasserlinie
    const mx = W / 2, my = BECKEN + 1, S = 1.25;
    let hirsch = new OktopusHirsch(this, mx, my, S).setDepth(10);
    const oy = my - OKTO_WASSER * S;
    // Schaum am Leib, wo er aus dem Wasser steigt
    for (let i = 0; i < 26; i++) this.add.ellipse(mx + Phaser.Math.Between(-70, 70), BECKEN + Phaser.Math.Between(1, 5), Phaser.Math.Between(4, 10), 2, 0x8aa080, 0.8);
    // Nahansicht des Kopfs (Knopf unter dem Bild)
    let nah = false;
    document.getElementById('nah')!.onclick = () => {
      nah = !nah;
      const cam = this.cameras.main;
      cam.zoomTo(nah ? 5 : 2, 500, 'Sine.easeInOut');
      cam.pan(nah ? mx : W / 2, nah ? oy + 60 : H / 2, 500, 'Sine.easeInOut');
    };

    // Größenvergleich: der Wirt und die Katze auf dem Steg
    this.add.image(118, 254, 'shadow').setScale(1.2, 1);
    const wirt = this.add.sprite(118, 256, 'wirtKanal', 3).setOrigin(0.5, 1).setScale(0.5).setDepth(20);
    this.add.sprite(96, 257, 'katzeKanal', 4).setOrigin(0.5, 1).setScale(0.5);

    // Beschriftung
    const t = (x: number, y: number, s: string, farbe = '#f4ead0', groesse = 8) =>
      this.add.text(x, y, s, { fontFamily: '"Press Start 2P", monospace', fontSize: `${groesse * 2}px`, color: farbe, lineSpacing: 6 }).setScale(0.5);
    t(8, 6, 'OKTOPUSHIRSCH', '#b8f060', 9);
    t(8, 52, [
      'Zombie-Hirschschädel: halb',
      'Knochen, halb Fäulnis, Maden,',
      'Kiefer voller Menschenzähne',
      '',
      'Gebrochenes Knochengeweih,',
      'Tentakel winden sich darum,',
      'Augen wachsen aus den Enden',
      '',
      'Verwester Krakenleib, offener',
      'Brustkorb, pochendes Herz,',
      'acht Arme, zwei mit Hufen',
      '',
      'Jägerhut mit Gamsbart,',
      'Ohrmarke:',
      '„EIGENTUM DER STADT“',
    ].join('\n'), '#c8bca8', 5);
    t(132, 246, 'Wirt und Katze zum Vergleich', '#8a8070', 5);

    // Knöpfe: Animationen abspielen (eine nach der anderen)
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
    knopf('schlag', () => hirsch.schlag({ x: wirt.x + 24, y: 244 }));
    knopf('treffer', () => hirsch.treffer());
    knopf('brunft', () => { wut = !wut; hirsch.brunft(wut); });
    knopf('strahl', () => hirsch.strahl({ x: wirt.x + 30, y: 250 }));
    knopf('curry', () => hirsch.curryFressen());
    knopf('niederlage', () => hirsch.niederlage());
    knopf('neu', () => { hirsch.destroy(); hirsch = new OktopusHirsch(this, mx, my, S).setDepth(10); wut = false; });
  }
}

const spiel = new Phaser.Game({
  type: Phaser.CANVAS,
  width: W * 2,
  height: H * 2,
  zoom: 1.5,
  pixelArt: true,
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
  const a = document.createElement('a');
  a.download = 'oktopushirsch.png';
  a.href = spiel.canvas.toDataURL('image/png');
  a.click();
};
