import Phaser from 'phaser';
import { audio } from '../audio';
import { Ctx, blob, p, r, rng, tex } from '../gfx';
import { OktopusHirsch } from '../monster/hirschRig';
import { MutantKatze } from '../monster/mutantKatze';
import { unlock } from '../progress/achievements';
import { saveAuto } from '../progress/save';
import { state } from '../state';
import { addTouchControls, touch } from '../touch';
import { H, W, fadeTo, txt } from '../ui';
import { CLUB_SPAWN, KLAERWERK_TUER_SPAWN } from './spawns';
import { WandlungUI } from './WandlungUI';

// Das Klärwerk (Kapitel 8, Phase 7 von „Unter dem Eimer“): eine eigene Arena ohne Kachelkarte.
//  - Intro: Wirt und Katze kommen herein, der Oktopushirsch steigt aus der Brühe.
//  - Phase 1: Der Hirsch schlägt mit Hufarmen (rote Ankündigung), schießt mit den Augen und schickt Flutwellen
//    (nur auf den Gittern ist man sicher). Der Wirt fängt mutierte Ratten und bringt sie der Katze. Er kann immer nur
//    eine tragen, und nach 15 Sekunden flutscht sie ihm aus der Hand (ohne sichtbare Uhr). Zehn Ratten: Die Katze
//    wird wieder zum Monster, der Wirt steigt auf, und es geht ins Duell (DuellScene).
//  - Ende (nach dem Duell): Die Katze spuckt Jan aus, Brenninger flieht, die Akte fällt herunter.
//  - Danach (kanal = 'gerettet'): ruhiger Raum, die Katze sitzt am Becken, die Tür führt zurück in den Kanal.

const WY = 132;
const BECKEN = { x0: 106, x1: 374, y0: 96, y1: 156 };
const BODEN = { x0: 22, x1: 458, y0: 106, y1: 262 };
const PODESTE = [{ x: 22, y: 114, w: 64, h: 30 }, { x: 394, y: 114, w: 64, h: 30 }, { x: 208, y: 226, w: 64, h: 30 }];
const KATZE_P = { x: 240, y: 244 };
const TUER = { x: 22, y: 214 };
const ROHRE: [number, number][] = [[22, 170], [22, 252], [458, 170], [458, 252], [62, 106], [418, 106]];
const ZIEL = 10;
const MAX_LEBEN = 5;
const TRAGEN_MS = 15000;
const ROT = '#ff6a6a', GELB = '#f8e070', GRUEN = '#b8f060', LILA = '#e090ff';

type Pt = { x: number; y: number };
interface Ratte { s: Phaser.GameObjects.Sprite; modus: 'raus' | 'wandern' | 'flucht' | 'pause'; zx: number; zy: number; t: number; seed: number }
interface Welle { front: number; g: Phaser.GameObjects.Graphics; ablauf: number; getroffen: boolean }

function drawHalle(c: Ctx) {
  const rnd = rng(808);
  // Rückwand: Backstein im grünen Dämmer
  r(c, 0, 0, 480, 112, '#121a1a');
  for (let y = 0; y < 112; y += 6) {
    r(c, 0, y + 5, 480, 1, '#0a1010');
    for (let x = (y / 6) % 2 ? 0 : 8; x < 480; x += 16) r(c, x, y, 1, 5, '#0a1010');
  }
  for (let i = 0; i < 90; i++) r(c, Math.floor(rnd() * 470), Math.floor(rnd() * 18) * 6, 15, 5, rnd() < 0.5 ? '#16201e' : '#0e1616');
  // Schleimspuren an der Wand
  for (const x of [40, 96, 150, 330, 388, 444]) { const h = 10 + Math.floor(rnd() * 30); r(c, x, 60, 2, h, '#2a5a1a'); r(c, x, 60 + h, 2, 2, '#6ab83a'); }
  // Rohre
  r(c, 0, 14, 480, 6, '#3a3a34'); r(c, 0, 14, 480, 1, '#5a5a50'); r(c, 0, 19, 480, 1, '#1a1a16');
  for (const x of [30, 120, 360, 452]) { r(c, x, 0, 6, 100, '#3a3a34'); r(c, x, 0, 1, 100, '#5a5a50'); r(c, x - 1, 12, 8, 10, '#4a4a40'); }
  // Galerie rechts oben mit Geländer, Lastenaufzug ganz rechts
  r(c, 372, 52, 108, 6, '#4a4a46'); r(c, 372, 52, 108, 1, '#7a7a70'); r(c, 372, 57, 108, 1, '#22221e');
  r(c, 372, 40, 108, 1, '#8a8a80'); for (let x = 374; x < 448; x += 8) r(c, x, 40, 1, 12, '#6a6a60');
  r(c, 446, 0, 30, 58, '#0a0c0c'); r(c, 446, 0, 1, 58, '#5a5a50'); r(c, 475, 0, 1, 58, '#5a5a50');
  for (let y = 4; y < 52; y += 6) r(c, 447, y, 28, 1, '#26261f');
  r(c, 0, 52, 30, 4, '#4a4a46'); r(c, 0, 52, 30, 1, '#7a7a70');
  // Boden: nasser Beton mit Fugen und Pfützen
  r(c, 0, 100, 480, 170, '#283028');
  for (let y = 108; y < 270; y += 16) r(c, 0, y, 480, 1, '#1e241e');
  for (let x = 0; x < 480; x += 24) r(c, x, 100, 1, 170, '#1e241e');
  for (let i = 0; i < 70; i++) r(c, Math.floor(rnd() * 470), 104 + Math.floor(rnd() * 160), 3 + Math.floor(rnd() * 8), 1, rnd() < 0.7 ? '#323a32' : '#3a5a2a');
  for (let i = 0; i < 9; i++) blob(c, 30 + rnd() * 420, 170 + rnd() * 85, 6 + rnd() * 10, 2 + rnd() * 2, '#2a4a22');
  // Seitenwände
  r(c, 0, 100, 18, 170, '#161c1a'); r(c, 462, 100, 18, 170, '#161c1a'); r(c, 17, 100, 1, 170, '#2a322e'); r(c, 462, 100, 1, 170, '#2a322e');
  // Tür links
  r(c, 4, 196, 14, 30, '#3a2a1e'); r(c, 4, 196, 14, 1, '#6a5a3a'); r(c, 15, 210, 2, 2, '#c0a040');
  // Rattenrohre
  for (const [x, y] of ROHRE) {
    const sx = x < 240 ? x - 6 : x - 4;
    if (y < 120) { blob(c, x, y - 4, 6, 4, '#3a3a34'); blob(c, x, y - 4, 4, 2.6, '#060808'); } else { blob(c, sx + 5, y - 6, 4, 6, '#3a3a34'); blob(c, sx + 5, y - 6, 2.4, 4, '#060808'); }
  }
  // Becken: Rückwand, Brühe, vorderer Rand
  r(c, BECKEN.x0, BECKEN.y0, BECKEN.x1 - BECKEN.x0, 6, '#3a423a');
  r(c, BECKEN.x0, BECKEN.y0 + 6, BECKEN.x1 - BECKEN.x0, BECKEN.y1 - BECKEN.y0 - 6, '#2a5a1a');
  for (let y = BECKEN.y0 + 8; y < BECKEN.y1 - 4; y += 4) for (let x = BECKEN.x0 + 4; x < BECKEN.x1 - 6; x += 10 + Math.floor(rnd() * 8)) r(c, x, y, 4 + Math.floor(rnd() * 6), 1, rnd() < 0.5 ? '#3a7a22' : '#22481a');
  r(c, BECKEN.x0 - 4, BECKEN.y0, 4, BECKEN.y1 - BECKEN.y0 + 6, '#4a524a'); r(c, BECKEN.x1, BECKEN.y0, 4, BECKEN.y1 - BECKEN.y0 + 6, '#4a524a');
  r(c, BECKEN.x0 - 4, BECKEN.y1, BECKEN.x1 - BECKEN.x0 + 8, 6, '#4a524a'); r(c, BECKEN.x0 - 4, BECKEN.y1, BECKEN.x1 - BECKEN.x0 + 8, 1, '#7a827a');
  r(c, BECKEN.x0 - 4, BECKEN.y1 + 6, BECKEN.x1 - BECKEN.x0 + 8, 2, '#141a14');
  for (let x = BECKEN.x0; x < BECKEN.x1; x += 34) { r(c, x, BECKEN.y1 + 1, 1, 5, '#2a302a'); p(c, x + 12, BECKEN.y1 + 2, '#8ac83a'); }
}

function drawPodest(c: Ctx) {
  r(c, 0, 0, 64, 30, '#1a1e1e');
  r(c, 1, 1, 62, 26, '#5a5e5a');
  for (let x = 3; x < 62; x += 4) r(c, x, 2, 2, 24, '#2a2e2c');
  for (let y = 4; y < 27; y += 5) r(c, 1, y, 62, 1, '#3a3e3c');
  r(c, 1, 1, 62, 1, '#8a8e8a');
  r(c, 1, 27, 62, 3, '#121414');
}

function drawAkte(c: Ctx) {
  r(c, 0, 0, 14, 10, '#c8a870'); r(c, 0, 0, 14, 1, '#e8d0a0'); r(c, 0, 9, 14, 1, '#8a6a40'); r(c, 2, 3, 8, 1, '#5a3a2a'); r(c, 9, 5, 3, 3, '#a02020');
}

function drawAkteGross(c: Ctx) {
  r(c, 0, 0, 170, 120, '#5a4028');
  r(c, 3, 3, 164, 114, '#c8a870');
  r(c, 3, 3, 164, 2, '#e8d0a0');
  for (let i = 0; i < 40; i++) r(c, 6 + ((i * 37) % 156), 8 + ((i * 23) % 104), 3, 1, '#b89860');
  // Siegel: ein Geweih über einem Berg, rot gestempelt
  const sx = 85, sy = 76;
  for (let a = 0; a < 64; a++) { const w = (a / 64) * Math.PI * 2; p(c, Math.round(sx + Math.cos(w) * 24), Math.round(sy + Math.sin(w) * 24), '#a02020'); p(c, Math.round(sx + Math.cos(w) * 21), Math.round(sy + Math.sin(w) * 21), '#a02020'); }
  for (let y = 0; y < 14; y++) r(c, sx - y, sy + 2 + y - 6, y * 2 + 1, 1, '#a02020');
  for (let y = 0; y < 5; y++) r(c, sx + 4 - y, sy - 1 + y, 2, 1, '#c8a870');
  const ast = (x0: number, d: number) => {
    for (let k = 0; k < 10; k++) p(c, x0 + d * Math.floor(k / 2), sy - 8 - k, '#a02020');
    for (let k = 0; k < 4; k++) { p(c, x0 + d * (2 + k), sy - 12 - Math.floor(k / 2), '#a02020'); p(c, x0 + d * (4 + Math.floor(k / 2)), sy - 16 - k, '#a02020'); }
  };
  ast(sx - 3, -1);
  ast(sx + 3, 1);
  r(c, sx - 3, sy - 8, 7, 2, '#a02020');
}

export class KlaerwerkScene extends Phaser.Scene {
  private modus: 'kino' | 'kampf' | 'frei' = 'kino';
  private wirt!: Phaser.GameObjects.Sprite;
  private katze?: Phaser.GameObjects.Sprite;
  private katzeLicht?: Phaser.GameObjects.Image;
  private hirsch?: OktopusHirsch;
  private mk?: MutantKatze;
  private ratten: Ratte[] = [];
  private getragen?: Ratte;
  private tragZeit = 0;
  private leben = MAX_LEBEN;
  private unverwundbar = 0;
  private blick: Pt = { x: 1, y: 0 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spawnT = 0;
  private angriffT = 0;
  private angriffAn = false;
  private wellenZaehler = 0;
  private welle?: Welle;
  private strahl?: { x: number; y: number; bis: number; getroffen: boolean };
  private brueheG!: Phaser.GameObjects.Graphics;
  private uiHerzen!: Phaser.GameObjects.Graphics;
  private uiZahl!: Phaser.GameObjects.Text;
  private uiRatte!: Phaser.GameObjects.Image;
  private toastT?: Phaser.GameObjects.Text;
  private warnT?: Phaser.GameObjects.Text;
  private stepT = 0;
  private kinoAus = false;
  private ui?: WandlungUI;
  private escSkip?: () => void;

  constructor() {
    super('Klaerwerk');
  }

  create(data: { ende?: boolean } = {}) {
    this.ratten = []; this.getragen = undefined; this.welle = undefined; this.strahl = undefined; this.mk = undefined; this.hirsch = undefined;
    this.katze = undefined; this.katzeLicht = undefined; this.angriffAn = false; this.wellenZaehler = 0; this.leben = MAX_LEBEN; this.unverwundbar = 0;
    this.kinoAus = false;
    state.running = false;
    this.scene.stop('Hud');
    const f = state.flags;
    if (!this.textures.exists('kwHalle')) {
      tex(this, 'kwHalle', 480, 270, drawHalle);
      tex(this, 'kwPodest', 64, 30, drawPodest);
      tex(this, 'kwAkte', 14, 10, drawAkte);
      tex(this, 'kwAkteGross', 170, 120, drawAkteGross);
    }
    this.add.image(0, 0, 'kwHalle').setOrigin(0).setDepth(0);
    for (const q of PODESTE) this.add.image(q.x, q.y, 'kwPodest').setOrigin(0).setDepth(6);
    // Licht: grünes Becken, Lampen, Dunst
    const licht = (x: number, y: number, s: number, farbe: number, a: number, d = 8) => this.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(farbe).setScale(s).setAlpha(a).setDepth(d);
    const becken = licht(240, 126, 4, 0x3aa02a, 0.4, 2).setScale(4, 1.4);
    this.tweens.add({ targets: becken, alpha: 0.25, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    for (const [x, y] of [[64, 60], [420, 30], [240, 190]]) {
      const l = licht(x, y, 1.6, 0xd8f0c0, 0.16, 400);
      this.tweens.add({ targets: l, alpha: 0.08, duration: 120, yoyo: true, repeat: -1, repeatDelay: Phaser.Math.Between(1500, 4000) });
    }
    this.brueheG = this.add.graphics().setDepth(3);
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,E,SPACE,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.E.on('down', () => this.aktion());
    this.keys.SPACE.on('down', () => this.aktion());
    addTouchControls(this);
    touch.onAction = () => this.aktion();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      touch.onAction = null; touch.vx = touch.vy = 0;
      this.kinoAus = true;
      this.scene.stop('WandlungUI');
    });

    this.wirt = this.add.sprite(TUER.x + 14, TUER.y + 8, 'wirtKanal', 6).setOrigin(0.5, 1);
    this.uiAufbauen();
    this.cameras.main.fadeIn(500, 0, 0, 0);

    if (data.ende || f.klaerwerk === 'ende') { void this.ende(); return; }
    if (f.kanal === 'gerettet') { this.frei(); return; }
    this.hirsch = new OktopusHirsch(this, 240, WY, 0.58).setDepth(300);
    this.hirsch.on('schlag', (pt: Pt) => this.aufprall(pt));
    this.hirsch.on('strahl', (pt: Pt) => { this.strahl = { x: pt.x, y: pt.y, bis: this.time.now + 720, getroffen: false }; });
    if (f.klaerwerk === 'duell') { this.hirsch.bereit(); this.katzeSetzen(true); void this.verwandlung(true); return; }
    if (f.klaerwerkRatten !== undefined) { this.hirsch.bereit(); this.katzeSetzen(true); this.kampfStart(); return; }
    this.hirsch.versteckt();
    void this.intro();
  }

  // ---------------------------------------------------------------- Kino

  private tw(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((done) => this.tweens.add({ ...cfg, onComplete: () => done() }));
  }
  private warte(ms: number) {
    return new Promise<void>((done) => this.time.delayedCall(ms, done));
  }
  private kinoStart(skip: () => void) {
    this.modus = 'kino';
    this.kinoAus = false;
    this.scene.launch('WandlungUI');
    this.scene.bringToTop('WandlungUI');
    this.ui = this.scene.get('WandlungUI') as WandlungUI;
    this.escSkip = () => {
      if (this.kinoAus) return;
      this.kinoAus = true;
      this.events.emit('kinoAus');
      this.kinoEnde();
      skip();
    };
    this.input.keyboard!.once('keydown-ESC', this.escSkip);
  }
  private kinoEnde() {
    if (this.escSkip) this.input.keyboard!.off('keydown-ESC', this.escSkip);
    this.escSkip = undefined;
    this.scene.stop('WandlungUI');
    this.ui = undefined;
  }
  private async sagK(wer: string, farbe: string, text: string) {
    if (this.kinoAus) return;
    this.ui?.zeige(wer, farbe, text);
    this.ui?.weiterZeigen(true);
    await this.klick();
    this.ui?.weiterZeigen(false);
  }
  private klick() {
    return new Promise<void>((done) => {
      const kb = this.input.keyboard!;
      const start = this.time.now;
      let fertig = false;
      const ende = () => {
        if (fertig) return;
        fertig = true;
        kb.off('keydown-E', weiter); kb.off('keydown-SPACE', weiter); kb.off('keydown-ENTER', weiter);
        this.input.off('pointerdown', weiter);
        this.events.off('kinoAus', ende);
        done();
      };
      const weiter = () => { if (this.time.now - start > 350) ende(); };
      kb.on('keydown-E', weiter); kb.on('keydown-SPACE', weiter); kb.on('keydown-ENTER', weiter);
      this.input.on('pointerdown', weiter);
      this.events.once('kinoAus', ende);
    });
  }
  private laufen(o: Phaser.GameObjects.Sprite, x: number, y: number, ms: number, anim: string) {
    o.play(anim, true);
    if (Math.abs(x - o.x) > Math.abs(y - o.y)) o.setFlipX(x < o.x);
    return this.tw({ targets: o, x, y, duration: ms, onUpdate: () => o.setDepth(o.y) }).then(() => o.anims.stop());
  }

  private katzeSetzen(amPlatz: boolean) {
    const pos = amPlatz ? KATZE_P : { x: TUER.x + 2, y: TUER.y + 12 };
    this.katze = this.add.sprite(pos.x, pos.y, 'katzeKanal', 4).setOrigin(0.5, 1).setDepth(pos.y);
    if (amPlatz) this.katze.play('katzeKanal_sitz');
    this.katzeLicht = this.add.image(pos.x, pos.y - 6, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6aff4a).setScale(0.3).setAlpha(0.2).setDepth(9);
    this.katzeWachsen(false);
  }

  /** die Katze wird mit jeder Ratte etwas größer und grüner */
  private katzeWachsen(animiert: boolean) {
    const n = state.flags.klaerwerkRatten ?? 0, k = this.katze;
    if (!k) return;
    const s = 1 + n * 0.05;
    const g = Math.round(255 - n * 9);
    if (animiert) {
      this.tweens.add({ targets: k, scaleX: s * 1.25, scaleY: s * 0.8, duration: 90, yoyo: true, onComplete: () => k.setScale(s) });
    } else k.setScale(s);
    k.setTint(Phaser.Display.Color.GetColor(g, 255, g));
    this.katzeLicht?.setScale(0.3 + n * 0.06).setAlpha(0.2 + n * 0.03);
  }

  private async intro() {
    this.kinoStart(() => this.kampfStart(true));
    const w = this.wirt;
    this.katzeSetzen(false);
    const k = this.katze!;
    audio.music('spannung');
    void this.laufen(w, 118, 206, 1500, 'wirtKanal_side');
    k.play('katzeKanal_lauf');
    await this.tw({ targets: k, x: 96, y: 214, duration: 1500, onUpdate: () => k.setDepth(k.y) });
    if (this.kinoAus) return;
    k.play('katzeKanal_sitz');
    w.setFrame(6);
    await this.sagK('WIRT', GELB, 'Scheiße, was ist denn hier?');
    if (this.kinoAus) return;
    this.ui?.leer();
    audio.sfx('gurgle');
    this.cameras.main.shake(1400, 0.003);
    await this.warte(1300);
    if (this.kinoAus || !this.hirsch) return;
    audio.music('monster');
    await this.hirsch.auftauchen();
    if (this.kinoAus) return;
    await this.hirsch.roehren();
    if (this.kinoAus) return;
    await this.sagK('DIE KATZE', GRUEN, 'Scheiße, so was habe selbst ich noch nie gesehen. Das ist es.');
    await this.sagK('DIE KATZE', GRUEN, 'Ich bin zu klein für den. Noch. Bring mir Ratten, Wirt. Zehn Stück. Hier laufen genug rum.');
    await this.sagK('WIRT', GELB, 'Und was machst du?');
    await this.sagK('DIE KATZE', GRUEN, 'Fressen. Wachsen. Pass auf die Arme auf. Und wenn er brüllt: rauf auf die Gitter.');
    if (this.kinoAus) return;
    this.ui?.leer();
    k.play('katzeKanal_lauf');
    await this.tw({ targets: k, x: KATZE_P.x, y: KATZE_P.y, duration: 1200, onUpdate: () => { k.setDepth(k.y); k.setFlipX(false); this.katzeLicht?.setPosition(k.x, k.y - 6); } });
    if (this.kinoAus) return;
    this.kinoEnde();
    this.kampfStart(false);
  }

  // ---------------------------------------------------------------- Phase 1

  private kampfStart(sprung = false) {
    const f = state.flags;
    if (sprung) {
      this.tweens.killTweensOf(this.wirt);
      if (this.katze) { this.tweens.killTweensOf(this.katze); this.katze.destroy(); this.katzeLicht?.destroy(); }
      this.katzeSetzen(true);
      this.hirsch?.bereit();
      this.wirt.setPosition(118, 206);
    }
    this.katze?.play('katzeKanal_sitz');
    this.katzeLicht?.setPosition(KATZE_P.x, KATZE_P.y - 6);
    f.klaerwerkRatten ??= 0;
    this.modus = 'kampf';
    this.angriffAn = true;
    this.angriffT = 2200;
    this.spawnT = 300;
    audio.music('klaerwerk');
    audio.stufe = f.klaerwerkRatten >= 5 ? 2 : 1;
    this.uiZeigen(true);
    saveAuto('Klaerwerk', [0, 0]);
    this.toast('Ratten fangen (E), zur Katze bringen. Brüllt er: rauf auf die Gitter!', 5000);
  }

  update(_t: number, delta: number) {
    const dt = Math.min(delta, 50);
    this.brueheMalen();
    if (this.hirsch) this.hirsch.blick = { x: this.wirt.x, y: this.wirt.y - 24 };
    if (this.modus === 'kino') return;
    this.bewegen(dt);
    if (this.modus === 'frei') return;
    this.unverwundbar = Math.max(0, this.unverwundbar - dt);
    this.wirt.setAlpha(this.unverwundbar > 0 && Math.floor(this.unverwundbar / 80) % 2 ? 0.4 : 1);
    this.rattenUpdate(dt);
    this.tragenUpdate(dt);
    this.angriffeUpdate(dt);
    this.welleUpdate(dt);
    if (this.strahl && !this.strahl.getroffen && this.time.now < this.strahl.bis && Phaser.Math.Distance.Between(this.wirt.x, this.wirt.y, this.strahl.x, this.strahl.y) < 16) {
      this.strahl.getroffen = true;
      this.treffer(this.strahl.x, this.strahl.y);
    }
  }

  private brueheMalen() {
    const g = this.brueheG, t = this.time.now;
    g.clear();
    for (let i = 0; i < 14; i++) {
      const x = BECKEN.x0 + 10 + ((i * 53 + t / 40) % (BECKEN.x1 - BECKEN.x0 - 20));
      const y = BECKEN.y0 + 12 + ((i * 17) % (BECKEN.y1 - BECKEN.y0 - 18));
      g.fillStyle(0x6ab83a, 0.35 + Math.sin(t / 300 + i) * 0.15).fillRect(x, y, 6 + (i % 3) * 3, 1);
    }
    for (let i = 0; i < 6; i++) {
      const ph = ((t / 900 + i * 0.37) % 1);
      const x = BECKEN.x0 + 20 + ((i * 97) % (BECKEN.x1 - BECKEN.x0 - 40)), y = BECKEN.y0 + 14 + ((i * 29) % 36);
      g.lineStyle(1, 0xa8f070, 0.6 * (1 - ph)).strokeEllipse(x, y, 4 + ph * 10, 1.5 + ph * 4);
    }
  }

  private klemmen(o: Pt, rand = 4) {
    o.x = Phaser.Math.Clamp(o.x, BODEN.x0, BODEN.x1);
    o.y = Phaser.Math.Clamp(o.y, BODEN.y0, BODEN.y1);
    if (o.x > BECKEN.x0 - rand && o.x < BECKEN.x1 + rand && o.y < BECKEN.y1 + rand + 4) {
      const dl = o.x - (BECKEN.x0 - rand), dr = BECKEN.x1 + rand - o.x, db = BECKEN.y1 + rand + 4 - o.y;
      const m = Math.min(dl, dr, db);
      if (m === dl) o.x = BECKEN.x0 - rand; else if (m === dr) o.x = BECKEN.x1 + rand; else o.y = BECKEN.y1 + rand + 4;
    }
  }
  private aufPodest(x: number, y: number) {
    return PODESTE.some((q) => x > q.x - 2 && x < q.x + q.w + 2 && y > q.y && y < q.y + q.h + 4);
  }

  private bewegen(dt: number) {
    const p = this.wirt, k = this.keys, c = this.cursors;
    let vx = touch.vx, vy = touch.vy;
    if (k.A.isDown || c.left.isDown) vx -= 1;
    if (k.D.isDown || c.right.isDown) vx += 1;
    if (k.W.isDown || c.up.isDown) vy -= 1;
    if (k.S.isDown || c.down.isDown) vy += 1;
    const len = Math.hypot(vx, vy);
    if (len > 0.1) {
      this.blick = { x: vx / len, y: vy / len };
      const sp = (78 * dt) / 1000;
      const o = { x: p.x + (vx / Math.max(1, len)) * sp, y: p.y + (vy / Math.max(1, len)) * sp };
      this.klemmen(o);
      p.setPosition(o.x, o.y);
      const dir = Math.abs(vx) > Math.abs(vy) ? 'side' : vy < 0 ? 'up' : 'down';
      if (dir === 'side') p.setFlipX(vx < 0);
      p.anims.play(`wirtKanal_${dir}`, true);
      this.stepT -= dt;
      if (this.stepT <= 0) { audio.sfx('step'); this.stepT = 260; }
    } else {
      p.anims.stop();
      p.setFrame(Math.abs(this.blick.x) > Math.abs(this.blick.y) ? 6 : this.blick.y < 0 ? 3 : 0);
    }
    p.setDepth(p.y);
  }

  private aktion() {
    if (this.modus === 'frei') { this.freiAktion(); return; }
    if (this.modus !== 'kampf') return;
    const p = this.wirt;
    if (this.getragen) {
      if (this.katze && Phaser.Math.Distance.Between(p.x, p.y, this.katze.x, this.katze.y) < 34) this.fuettern();
      return;
    }
    let best: Ratte | undefined, bd = 22;
    for (const rt of this.ratten) {
      const d = Phaser.Math.Distance.Between(p.x, p.y - 4, rt.s.x, rt.s.y);
      if (d < bd && rt.modus !== 'raus') { bd = d; best = rt; }
    }
    if (best) this.fangen(best);
    else audio.sfx('whoosh');
  }

  // ---------------------------------------------------------------- Ratten

  private rattenUpdate(dt: number) {
    const n = state.flags.klaerwerkRatten ?? 0;
    const max = 3 + (n >= 4 ? 1 : 0) + (n >= 8 ? 1 : 0);
    if (this.ratten.filter((x) => x !== this.getragen).length < max) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawnT = Phaser.Math.Between(1400, 2600); this.ratteNeu(); }
    }
    const p = this.wirt;
    for (const rt of this.ratten) {
      if (rt === this.getragen) continue;
      rt.t += dt;
      const s = rt.s;
      const d = Phaser.Math.Distance.Between(p.x, p.y, s.x, s.y);
      let vx = 0, vy = 0, sp = 0;
      if (rt.modus === 'raus') {
        sp = 40;
        vx = rt.zx - s.x; vy = rt.zy - s.y;
        if (Math.hypot(vx, vy) < 3) { rt.modus = 'wandern'; this.ratteZiel(rt); }
      } else {
        if (d < 62) rt.modus = 'flucht';
        else if (rt.modus === 'flucht' && d > 100) { rt.modus = 'wandern'; this.ratteZiel(rt); }
        if (rt.modus === 'flucht') {
          sp = 60 + (d < 30 ? 10 : 0);
          const ax = (s.x - p.x) / (d || 1), ay = (s.y - p.y) / (d || 1);
          const j = Math.sin(rt.t / 260 + rt.seed) * 0.7;
          vx = ax - ay * j; vy = ay + ax * j;
          // an der Wand entlang ausweichen: die Richtung wählen, die am weitesten vom Wirt wegführt
          const probe = (wx: number, wy: number) => { const o = { x: s.x + wx * 14, y: s.y + wy * 14 }; this.klemmen(o, 6); return Phaser.Math.Distance.Between(o.x, o.y, p.x, p.y); };
          if (probe(vx, vy) < d + 4) {
            let bw = 0, bwd = -1;
            for (const w of [-1.4, -0.8, 0.8, 1.4]) {
              const cx = vx * Math.cos(w) - vy * Math.sin(w), cy = vx * Math.sin(w) + vy * Math.cos(w);
              const pd = probe(cx, cy);
              if (pd > bwd) { bwd = pd; bw = w; }
            }
            const cx = vx * Math.cos(bw) - vy * Math.sin(bw), cy = vx * Math.sin(bw) + vy * Math.cos(bw);
            vx = cx; vy = cy;
          }
        } else if (rt.modus === 'wandern') {
          sp = 26;
          vx = rt.zx - s.x; vy = rt.zy - s.y;
          if (Math.hypot(vx, vy) < 4) { rt.modus = 'pause'; rt.t = -Phaser.Math.Between(500, 1400); }
        } else if (rt.modus === 'pause' && rt.t > 0) { rt.modus = 'wandern'; this.ratteZiel(rt); }
      }
      const l = Math.hypot(vx, vy);
      if (sp > 0 && l > 0.01) {
        const o = { x: s.x + (vx / l) * sp * dt / 1000, y: s.y + (vy / l) * sp * dt / 1000 };
        if (rt.modus !== 'raus') this.klemmen(o, 6);
        s.setPosition(o.x, o.y);
        s.setFlipX(vx < 0);
        s.play('kanalRatte_renn', true);
      } else s.play('kanalRatte_schnupper', true);
      s.setDepth(s.y);
    }
  }

  private ratteZiel(rt: Ratte) {
    const o = { x: Phaser.Math.Between(BODEN.x0 + 10, BODEN.x1 - 10), y: Phaser.Math.Between(BODEN.y0 + 6, BODEN.y1 - 6) };
    this.klemmen(o, 8);
    rt.zx = o.x; rt.zy = o.y;
  }

  private ratteNeu() {
    const [x, y] = Phaser.Utils.Array.GetRandom(ROHRE);
    const s = this.add.sprite(x, y, 'kanalRatte', 0).setOrigin(0.5, 0.8).setDepth(y);
    const ziel = { x: x + (x < 240 ? 26 : x > 400 ? -26 : 0), y: y + (y < 120 ? 18 : 0) };
    if (y < 120) ziel.x = x;
    const rt: Ratte = { s, modus: 'raus', zx: ziel.x, zy: ziel.y, t: 0, seed: Math.random() * 10 };
    this.ratten.push(rt);
    audio.sfx('rummage');
  }

  private ratteWeg(rt: Ratte) {
    this.ratten = this.ratten.filter((x) => x !== rt);
    if (this.getragen === rt) this.getragen = undefined;
  }

  private fangen(rt: Ratte) {
    this.getragen = rt;
    rt.s.anims.stop();
    rt.s.setFrame(0);
    this.tragZeit = 0;
    audio.sfx('blip');
    this.funken(rt.s.x, rt.s.y - 4, 0xd8f0d0, 5);
  }

  private tragenUpdate(dt: number) {
    const rt = this.getragen;
    if (!rt) return;
    const p = this.wirt;
    this.tragZeit += dt;
    const zappel = this.tragZeit / TRAGEN_MS;
    const seite = p.flipX ? -1 : 1;
    rt.s.setPosition(p.x + seite * 8, p.y - 22 + Math.sin(this.time.now / 70) * zappel * 1.5);
    rt.s.setRotation(-1.5 * seite + Math.sin(this.time.now / (110 - zappel * 60)) * (0.2 + zappel * 0.7));
    rt.s.setFlipX(p.flipX);
    rt.s.setDepth(p.depth + 1);
    if (this.katze && Phaser.Math.Distance.Between(p.x, p.y, this.katze.x, this.katze.y) < 26) { this.fuettern(); return; }
    if (this.tragZeit > TRAGEN_MS) this.entwischt('Die Ratte flutscht dir aus der Hand!');
  }

  private entwischt(text: string) {
    const rt = this.getragen;
    if (!rt) return;
    this.getragen = undefined;
    rt.s.setRotation(0);
    rt.modus = 'flucht';
    rt.t = 0;
    const o = { x: rt.s.x, y: this.wirt.y + 2 };
    this.klemmen(o, 6);
    this.tweens.add({ targets: rt.s, x: o.x, y: o.y, duration: 220, ease: 'Quad.easeIn' });
    audio.sfx('blip');
    this.toast(text, 2200);
  }

  private fuettern() {
    const rt = this.getragen, k = this.katze;
    if (!rt || !k) return;
    this.getragen = undefined;
    this.ratten = this.ratten.filter((x) => x !== rt);
    const zx = k.x + 4, zy = k.y - 14;
    this.tweens.add({
      targets: rt.s, x: zx, y: zy, rotation: rt.s.rotation + 6, scale: 0.4, duration: 260, ease: 'Quad.easeIn',
      onComplete: () => {
        rt.s.destroy();
        audio.sfx('chomp');
        this.time.delayedCall(140, () => audio.sfx('chomp'));
        const f = state.flags;
        f.klaerwerkRatten = (f.klaerwerkRatten ?? 0) + 1;
        const n = f.klaerwerkRatten;
        this.katzeWachsen(true);
        this.funken(k.x, k.y - 10, 0x8aff5a, 10);
        const blitz = this.add.image(k.x, k.y - 8, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8aff5a).setScale(0.2).setAlpha(0.9).setDepth(k.depth + 1);
        this.tweens.add({ targets: blitz, scale: 1.2, alpha: 0, duration: 420, onComplete: () => blitz.destroy() });
        this.uiAktualisieren(true);
        if (n >= 5) audio.stufe = 2;
        const spruch: Record<number, string> = { 1: 'Mehr.', 3: 'Schmeckt nach Brühe. Weiter!', 5: 'Ich spür was ... weiter, Wirt!', 8: 'Gleich ...', 9: 'Noch eine!' };
        if (spruch[n]) this.blase(k.x, k.y - 26, spruch[n]);
        if (n >= ZIEL) void this.verwandlung(false);
      },
    });
  }

  // ---------------------------------------------------------------- Angriffe

  private angriffeUpdate(dt: number) {
    if (!this.angriffAn || !this.hirsch) return;
    this.angriffT -= dt;
    if (this.angriffT > 0) return;
    const n = state.flags.klaerwerkRatten ?? 0;
    this.angriffT = 3200 - n * 130;
    if (this.wellenZaehler >= (n >= 6 ? 3 : 4)) { this.wellenZaehler = 0; void this.flutwelle(); this.angriffT += 2600; return; }
    this.wellenZaehler++;
    if (n >= 3 && Math.random() < 0.35) { void this.augenstrahl(); return; }
    void this.hufschlag(this.zielVorWirt(0.45));
    if (n >= 7) this.time.delayedCall(420, () => this.modus === 'kampf' && void this.hufschlag(this.zielVorWirt(0.9)));
  }

  private zielVorWirt(vor: number): Pt {
    const p = this.wirt;
    const o = { x: p.x + this.blick.x * 40 * vor * (Math.random() < 0.7 ? 1 : 0), y: p.y + this.blick.y * 30 * vor };
    this.klemmen(o, 10);
    return o;
  }

  private async hufschlag(z: Pt) {
    const h = this.hirsch;
    if (!h) return;
    const mark = this.add.ellipse(z.x, z.y, 4, 2, 0xff2020, 0.25).setStrokeStyle(1.5, 0xff4040, 0.9).setDepth(7);
    this.tweens.add({ targets: mark, width: 40, height: 18, duration: 780, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: mark, alpha: 0.5, duration: 120, yoyo: true, repeat: 3 });
    await this.warte(340);
    if (this.modus !== 'kampf') { mark.destroy(); return; }
    await h.schlag(z);
    mark.destroy();
  }

  private aufprall(z: Pt) {
    if (this.modus !== 'kampf') return;
    const p = this.wirt;
    if (Phaser.Math.Distance.Between(p.x, p.y, z.x, z.y) < 21) this.treffer(z.x, z.y);
    for (const rt of [...this.ratten]) {
      if (rt === this.getragen || Phaser.Math.Distance.Between(rt.s.x, rt.s.y, z.x, z.y) > 20) continue;
      this.ratteWeg(rt);
      audio.sfx('blip');
      this.tweens.add({ targets: rt.s, scaleY: 0.1, alpha: 0, duration: 400, onComplete: () => rt.s.destroy() });
    }
  }

  private async augenstrahl() {
    const h = this.hirsch;
    if (!h) return;
    const z = { x: this.wirt.x, y: this.wirt.y - 4 };
    const g = this.add.graphics().setDepth(299).setBlendMode(Phaser.BlendModes.ADD);
    const kopf = h.welt({ x: 0, y: -180 });
    const ende = this.time.now + 600;
    const zeichne = () => {
      g.clear();
      if (this.time.now > ende || this.modus !== 'kampf') { this.events.off(Phaser.Scenes.Events.UPDATE, zeichne); g.destroy(); return; }
      g.lineStyle(1, 0xb040ff, 0.3 + Math.random() * 0.4).lineBetween(kopf.x, kopf.y, z.x, z.y);
      g.lineStyle(1.5, 0xff40c0, 0.8).strokeEllipse(z.x, z.y, 22, 10);
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, zeichne);
    await h.strahl(z);
  }

  private async flutwelle() {
    const h = this.hirsch;
    if (!h) return;
    this.warnen('FLUTWELLE! RAUF AUF DIE GITTER!');
    await h.roehren();
    if (this.modus !== 'kampf') return;
    audio.sfx('splash');
    audio.sfx('rumble');
    this.welle = { front: BODEN.y0 - 4, g: this.add.graphics().setDepth(5), ablauf: 0, getroffen: false };
  }

  private welleUpdate(dt: number) {
    const wl = this.welle;
    if (!wl) return;
    const t = this.time.now, g = wl.g;
    if (wl.front < BODEN.y1 + 12) wl.front += (dt / 1000) * 110;
    else wl.ablauf += dt;
    const a = Math.max(0, 1 - wl.ablauf / 900);
    g.clear();
    g.fillStyle(0x2a7a1a, 0.55 * a).fillRect(0, BODEN.y0 - 6, W, wl.front - BODEN.y0 + 6);
    for (let i = 0; i < 18; i++) g.fillStyle(0x6ab83a, 0.35 * a).fillRect((i * 61 + t / 6) % W, BODEN.y0 + ((i * 37) % Math.max(1, wl.front - BODEN.y0)), 10, 1);
    if (wl.front < BODEN.y1 + 12) {
      g.fillStyle(0x8ac83a, 0.8);
      for (let x = 0; x < W; x += 4) {
        const y = wl.front + Math.sin(x / 13 + t / 90) * 3;
        g.fillRect(x, y - 3, 4, 4);
        if ((x / 4) % 3 === 0) g.fillStyle(0xd8ffc0, 0.9).fillRect(x + 1, y - 4, 2, 1).fillStyle(0x8ac83a, 0.8);
      }
    }
    // wer nicht auf einem Gitter steht, wird mitgerissen
    const p = this.wirt;
    if (!wl.getroffen && Math.abs(p.y - wl.front) < 7 && !this.aufPodest(p.x, p.y)) {
      wl.getroffen = true;
      this.treffer(p.x, p.y - 30);
    }
    for (const rt of [...this.ratten]) {
      if (rt === this.getragen || Math.abs(rt.s.y - wl.front) > 6 || this.aufPodest(rt.s.x, rt.s.y)) continue;
      this.ratteWeg(rt);
      this.tweens.add({ targets: rt.s, y: H + 20, rotation: 8, duration: 900, ease: 'Quad.easeIn', onComplete: () => rt.s.destroy() });
    }
    if (a <= 0) { g.destroy(); this.welle = undefined; }
  }

  private treffer(vonX: number, vonY: number) {
    if (this.unverwundbar > 0 || this.modus !== 'kampf') return;
    const p = this.wirt;
    this.leben--;
    this.unverwundbar = 1300;
    audio.sfx('slap');
    audio.sfx('thud');
    this.cameras.main.shake(220, 0.012);
    this.cameras.main.flash(90, 160, 20, 20);
    p.setTintFill(0xffffff);
    this.time.delayedCall(90, () => p.clearTint());
    const d = Math.hypot(p.x - vonX, p.y - vonY) || 1;
    const o = { x: p.x + ((p.x - vonX) / d) * 26, y: p.y + ((p.y - vonY) / d) * 26 };
    this.klemmen(o);
    this.tweens.add({ targets: p, x: o.x, y: o.y, duration: 200, ease: 'Quad.easeOut' });
    if (this.getragen) this.entwischt('Vor Schreck lässt du die Ratte fallen!');
    this.uiAktualisieren(false);
    if (this.leben <= 0) void this.ohnmacht();
  }

  private async ohnmacht() {
    this.modus = 'kino';
    this.angriffAn = false;
    const p = this.wirt;
    p.anims.stop();
    audio.sfx('gameover');
    await this.tw({ targets: p, rotation: 1.5, duration: 400 });
    this.cameras.main.fadeOut(700, 0, 0, 0);
    await this.warte(800);
    for (const rt of this.ratten) rt.s.destroy();
    this.ratten = [];
    this.getragen = undefined;
    this.welle?.g.destroy();
    this.welle = undefined;
    p.setRotation(0).setPosition(TUER.x + 14, TUER.y + 8).setFrame(6).setFlipX(false);
    this.leben = MAX_LEBEN;
    this.uiAktualisieren(false);
    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.toast('Der Wirt rappelt sich auf. Gefressen ist gefressen: Die Katze hat ihre Ratten noch.', 3500);
    this.modus = 'kampf';
    this.angriffAn = true;
    this.angriffT = 2600;
    this.unverwundbar = 1500;
  }

  // ---------------------------------------------------------------- Verwandlung

  private async verwandlung(sprung: boolean) {
    this.angriffAn = false;
    this.modus = 'kino';
    this.uiZeigen(false);
    this.welle?.g.destroy();
    this.welle = undefined;
    for (const rt of this.ratten) this.tweens.add({ targets: rt.s, alpha: 0, duration: 400, onComplete: () => rt.s.destroy() });
    this.ratten = [];
    this.getragen = undefined;
    if (sprung) { this.zumDuell(); return; }
    this.kinoStart(() => this.zumDuell());
    const k = this.katze!, w = this.wirt;
    await this.warte(700);
    if (this.kinoAus) return;
    void this.laufen(w, k.x - 44, k.y - 2, 600, 'wirtKanal_side').then(() => w.setFlipX(false).setFrame(6));
    // die Katze zittert, das Herz schlägt, grünes Licht pulst
    const licht = this.add.image(k.x, k.y - 10, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0x6aff4a).setScale(0.4).setAlpha(0.5).setDepth(k.depth + 2);
    k.anims.stop();
    const x0 = k.x;
    const zittern = this.time.addEvent({ delay: 30, loop: true, callback: () => k.setX(x0 + Phaser.Math.FloatBetween(-1.5, 1.5)) });
    for (let i = 0; i < 4; i++) {
      audio.sfx('thud');
      this.cameras.main.shake(140, 0.004 + i * 0.002);
      k.setTintFill(0x9aff6a);
      this.tweens.add({ targets: licht, scale: 0.8 + i * 0.5, alpha: 0.9, duration: 120, yoyo: true });
      await this.warte(130);
      k.setTint(0xb0ffb0);
      await this.warte(620 - i * 120);
      if (this.kinoAus) { zittern.remove(); return; }
    }
    await this.sagK('DIE KATZE', GRUEN, 'Oh. Oh, das kenn ich.');
    if (this.kinoAus) { zittern.remove(); return; }
    this.ui?.leer();
    audio.sfx('growl');
    this.cameras.main.shake(1200, 0.01);
    await this.tw({ targets: k, scale: k.scale * 3.4, duration: 1100, ease: 'Quad.easeIn', onUpdate: () => k.setTintFill(Math.random() < 0.5 ? 0x9aff6a : 0xffffff) });
    zittern.remove();
    if (this.kinoAus) return;
    // Lichtexplosion, aus der die Monstergestalt kommt
    this.cameras.main.flash(260, 200, 255, 200);
    audio.sfx('thunder');
    for (let i = 0; i < 3; i++) {
      const ring = this.add.ellipse(x0, k.y - 10, 20, 10).setStrokeStyle(3, 0x8aff5a, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(500);
      this.tweens.add({ targets: ring, scaleX: 14 - i * 3, scaleY: 12 - i * 3, alpha: 0, duration: 700 + i * 150, delay: i * 90, onComplete: () => ring.destroy() });
    }
    this.funken(x0, k.y - 10, 0x8aff5a, 30);
    k.destroy();
    this.katze = undefined;
    this.katzeLicht?.destroy();
    licht.destroy();
    const mk = new MutantKatze(this, x0 + 8, KATZE_P.y + 4, 0.85).setDepth(KATZE_P.y + 4).setScale(0.2);
    this.mk = mk;
    mk.reiterZeigen(false);
    await this.tw({ targets: mk, scaleX: 1, scaleY: 1, duration: 500, ease: 'Back.easeOut' });
    if (this.kinoAus) return;
    await mk.fauchen();
    await this.sagK('DIE KATZE', GRUEN, 'Da ist sie wieder. Die Form von damals.');
    await this.sagK('DIE KATZE', GRUEN, 'Steig auf, Wirt. Und halt dich fest.');
    if (this.kinoAus) return;
    this.ui?.leer();
    // der Wirt springt auf den Rücken
    const ziel = mk.reiterWelt();
    audio.sfx('whoosh');
    this.tweens.add({ targets: w, x: ziel.x, duration: 520, ease: 'Linear' });
    await this.tw({ targets: w, y: ziel.y - 30, duration: 260, ease: 'Quad.easeOut' });
    await this.tw({ targets: w, y: ziel.y, duration: 260, ease: 'Quad.easeIn' });
    w.setVisible(false);
    mk.reiterZeigen(true);
    mk.treffer();
    audio.sfx('thud');
    unlock('zweiSeelen');
    await this.warte(500);
    if (this.kinoAus || !this.hirsch) return;
    audio.music('klaerwerk');
    audio.stufe = 3;
    void mk.fauchen();
    await this.hirsch.roehren();
    if (this.kinoAus) return;
    this.kinoEnde();
    this.zumDuell();
  }

  private zumDuell() {
    state.flags.klaerwerk = 'duell';
    saveAuto('Klaerwerk', [0, 0]);
    fadeTo(this, 'Hirschduell');
  }

  // ---------------------------------------------------------------- Ende

  private async ende() {
    this.modus = 'kino';
    this.uiZeigen(false);
    this.wirt.setVisible(false);
    audio.music('kanal');
    const mk = new MutantKatze(this, 196, 228, 0.85).setDepth(228);
    this.mk = mk;
    this.kinoStart(() => this.endeFertig());
    await this.warte(1200);
    if (this.kinoAus) return;
    await this.sagK('DIE KATZE', GRUEN, 'Wirt ... ich hab was Komisches im Maul.');
    if (this.kinoAus) return;
    this.ui?.leer();
    const m = await mk.wuergen();
    if (this.kinoAus) return;
    // Jan fliegt in hohem Bogen heraus, voller Schleim
    const jan = this.add.sprite(m.x, m.y, 'cd_jan', 0).setOrigin(0.5, 0.6).setScale(0.4).setTint(0x9adf7a).setDepth(400);
    audio.sfx('puke');
    this.funken(m.x, m.y, 0x8ac83a, 14);
    this.tweens.add({ targets: jan, x: 300, duration: 900, ease: 'Linear' });
    this.tweens.add({ targets: jan, rotation: Math.PI * 3.5, scale: 1.2, duration: 900 });
    await this.tw({ targets: jan, y: 150, duration: 420, ease: 'Quad.easeOut' });
    await this.tw({ targets: jan, y: 236, duration: 480, ease: 'Quad.easeIn' });
    jan.setDepth(236);
    audio.sfx('splash');
    this.cameras.main.shake(200, 0.006);
    const pfuetze = this.add.ellipse(300, 240, 10, 3, 0x6ab83a, 0.8).setDepth(5);
    this.tweens.add({ targets: pfuetze, width: 46, height: 10, duration: 400, ease: 'Quad.easeOut' });
    this.funken(300, 236, 0x8ac83a, 12);
    void mk.maulZu();
    await this.warte(700);
    await this.sagK('DIE KATZE', GRUEN, 'Ups. Den hab ich aus Versehen gegessen, als ich der Krake in den Arsch gebissen habe.');
    if (this.kinoAus) return;
    this.ui?.leer();
    await this.tw({ targets: jan, rotation: Math.PI * 4, y: 240, duration: 500, ease: 'Back.easeOut' });
    jan.setOrigin(0.5, 1).setRotation(0).setPosition(300, 244).setFrame(6).setFlipX(true);
    for (let i = 0; i < 3; i++) { audio.sfx('splash'); this.funken(300, 226, 0x8ac83a, 6); this.tweens.add({ targets: jan, angle: i % 2 ? 8 : -8, duration: 90, yoyo: true }); await this.warte(220); }
    this.tweens.add({ targets: jan, duration: 1200, onUpdate: (tw) => { const v = tw.progress; jan.setTint(Phaser.Display.Color.GetColor(Math.round(154 + v * 101), Math.round(223 + v * 32), Math.round(122 + v * 133))); } });
    await this.sagK('JAN', LILA, 'Danke. Du riechst nach Katze. Und Curry. Und Heldentum.');
    if (this.kinoAus) return;
    this.ui?.leer();
    // die Katze wird wieder klein, der Wirt rutscht herunter
    mk.superGlut(true);
    audio.sfx('chime');
    await this.warte(500);
    this.cameras.main.flash(200, 160, 255, 160);
    const wp = mk.reiterWelt();
    this.wirt.setVisible(true).setPosition(wp.x, wp.y).setFrame(6).setFlipX(false).setDepth(400);
    mk.reiterZeigen(false);
    this.tweens.add({ targets: this.wirt, x: 168, y: 226, duration: 420, ease: 'Quad.easeIn', onComplete: () => this.wirt.setDepth(226) });
    this.funken(mk.x, mk.y - 40, 0x8aff5a, 20);
    await this.tw({ targets: mk, scaleX: 0.25, scaleY: 0.25, alpha: 0, duration: 600, ease: 'Quad.easeIn' });
    mk.destroy();
    this.mk = undefined;
    const k = this.add.sprite(206, 226, 'katzeKanal', 4).setOrigin(0.5, 1).setScale(0.2).setDepth(226);
    await this.tw({ targets: k, scale: 1, duration: 300, ease: 'Back.easeOut' });
    k.play('katzeKanal_sitz');
    await this.sagK('DIE KATZE', GRUEN, 'Das bleibt unter uns, Wirt.');
    if (this.kinoAus) return;
    // Brenninger auf der Galerie
    this.ui?.leer();
    const br = this.add.sprite(470, 52, 'brennMega', 0).setOrigin(0.5, 1).setScale(0.2).setFlipX(true).setDepth(60);
    audio.sfx('angry');
    await this.tw({ targets: br, x: 410, duration: 700 });
    const brAnim = this.time.addEvent({ delay: 200, loop: true, callback: () => br.setFrame(Number(br.frame.name) === 0 ? 1 : 0) });
    this.wirt.setFlipX(false).setFrame(3);
    await this.sagK('BRENNINGER', ROT, 'MEIN HIRSCH! WISSEN SIE, WAS SO EIN HIRSCH KOSTET?! MIT ACHT ARMEN?!');
    await this.sagK('BRENNINGER', ROT, 'Das war ein PILOTPROJEKT! Ein STAATLICH GEFÖRDERTES PILOTPROJEKT!');
    await this.sagK('BRENNINGER', ROT, 'Sie hören von mir, Wirt. Sie und Ihre ... KATZE!');
    brAnim.remove();
    if (this.kinoAus) return;
    this.ui?.leer();
    // er springt in den Lastenaufzug, die Mappe fällt
    br.setFlipX(false);
    await this.tw({ targets: br, x: 461, duration: 420 });
    const kaefig = this.add.rectangle(461, 56, 28, 54, 0x000000, 0).setOrigin(0.5, 1).setStrokeStyle(1, 0x8a8a80).setDepth(61);
    audio.sfx('clang');
    audio.sfx('rumble');
    this.tweens.add({ targets: [br, kaefig], y: '-=90', duration: 1600, ease: 'Quad.easeIn' });
    const akte = this.add.image(440, 50, 'kwAkte').setScale(1.2).setDepth(450);
    this.tweens.add({ targets: akte, y: 232, duration: 1900, ease: 'Sine.easeIn' });
    await this.tw({ targets: akte, x: { from: 440, to: 230 }, rotation: 2.4, duration: 1900, ease: 'Sine.easeInOut', onUpdate: (tw) => akte.setX(akte.x + Math.sin(tw.progress * 12) * 3) });
    akte.setDepth(232);
    audio.sfx('slap');
    await this.laufen(this.wirt, 220, 236, 500, 'wirtKanal_side');
    if (this.kinoAus) return;
    akte.destroy();
    // Nahaufnahme der Akte
    const dunkel = this.add.rectangle(0, 0, W, H, 0x000000, 0).setOrigin(0).setDepth(900);
    this.tweens.add({ targets: dunkel, fillAlpha: 0.7, duration: 400 });
    const gross = this.add.image(W / 2, H / 2 - 10, 'kwAkteGross').setDepth(901).setScale(0.2).setAngle(-8);
    await this.tw({ targets: gross, scale: 1, angle: -2, duration: 500, ease: 'Back.easeOut' });
    const t1 = txt(this, W / 2, H / 2 - 56, 'PROJEKT ACHTARM', '#3a1a10', 8).setOrigin(0.5).setDepth(902).setAngle(-2);
    const t2 = txt(this, W / 2, H / 2 - 44, 'STRENG VERTRAULICH', '#a02020', 8).setOrigin(0.5).setDepth(902).setAngle(-2);
    audio.sfx('sting');
    await this.sagK('DIE KATZE', GRUEN, 'Dieses Zeichen ... habe ich schon mal gesehen. Ich weiß nur nicht mehr, wo.');
    if (this.kinoAus) return;
    t1.destroy(); t2.destroy();
    this.kinoEnde();
    this.endeFertig();
  }

  private endeFertig() {
    const f = state.flags;
    f.kanal = 'gerettet';
    f.klaerwerk = undefined;
    f.klaerwerkRatten = undefined;
    f.akte = true;
    unlock('geweihAb');
    state.running = true;
    fadeTo(this, 'Cutscene', { script: 'kanalEnde', next: { scene: 'Club', data: { spawn: CLUB_SPAWN } } });
  }

  // ---------------------------------------------------------------- Danach: ruhiger Raum

  private frei() {
    this.modus = 'frei';
    this.uiZeigen(false);
    this.katze = this.add.sprite(KATZE_P.x, KATZE_P.y, 'katzeKanal', 4).setOrigin(0.5, 1).setDepth(KATZE_P.y).play('katzeKanal_sitz');
    audio.music('kanal');
    this.toast('Das Klärwerk. Still. Nur die Brühe blubbert.', 2600);
  }

  private freiAktion() {
    const p = this.wirt;
    if (Phaser.Math.Distance.Between(p.x, p.y, TUER.x, TUER.y + 8) < 30) {
      state.running = true;
      fadeTo(this, 'Kanal', { spawn: KLAERWERK_TUER_SPAWN });
      return;
    }
    if (this.katze && Phaser.Math.Distance.Between(p.x, p.y, this.katze.x, this.katze.y) < 30) {
      audio.sfx('meow');
      this.blase(this.katze.x, this.katze.y - 22, Phaser.Utils.Array.GetRandom(['Da unten gibt es noch mehr von denen. Ich räume auf.', 'Du kennst den Weg, Wirt.', 'Kein Wort über die Sache mit dem Reiten.']));
    }
  }

  // ---------------------------------------------------------------- Anzeige

  private uiAufbauen() {
    this.uiHerzen = this.add.graphics().setDepth(1000);
    this.uiRatte = this.add.image(14, 30, 'kanalRatte', 0).setScale(0.5).setDepth(1000);
    this.uiZahl = txt(this, 26, 26, '', '#d8f0c0').setDepth(1000);
    this.uiZeigen(false);
  }
  private uiZeigen(an: boolean) {
    this.uiHerzen.setVisible(an);
    this.uiRatte.setVisible(an);
    this.uiZahl.setVisible(an);
    if (an) this.uiAktualisieren(false);
  }
  private uiAktualisieren(pop: boolean) {
    const g = this.uiHerzen;
    g.clear();
    for (let i = 0; i < MAX_LEBEN; i++) {
      const x = 10 + i * 13, y = 10, voll = i < this.leben;
      g.fillStyle(voll ? 0xe02a2a : 0x3a1a1a, 1);
      g.fillCircle(x + 3, y + 3, 3).fillCircle(x + 8, y + 3, 3).fillTriangle(x, y + 4, x + 11, y + 4, x + 5.5, y + 10);
      if (voll) g.fillStyle(0xff9a9a, 1).fillRect(x + 1.5, y + 1.5, 2, 1);
    }
    this.uiZahl.setText(`${state.flags.klaerwerkRatten ?? 0} / ${ZIEL}`);
    if (pop) this.tweens.add({ targets: [this.uiZahl, this.uiRatte], scale: '*=1.4', duration: 120, yoyo: true });
  }

  private toast(text: string, ms: number) {
    this.toastT?.destroy();
    const t = txt(this, W / 2, H - 6, text, '#f4ead0').setOrigin(0.5, 1).setDepth(1001).setBackgroundColor('#000000a0').setPadding(4, 2, 4, 2)
      .setWordWrapWidth(W - 60).setAlign('center');
    this.toastT = t;
    this.tweens.add({ targets: t, alpha: 0, delay: ms, duration: 400, onComplete: () => t.destroy() });
  }

  private warnen(text: string) {
    this.warnT?.destroy();
    const t = txt(this, W / 2, 34, text, '#b8f060', 8).setOrigin(0.5).setDepth(1001).setStroke('#0a1a0a', 4);
    this.warnT = t;
    this.tweens.add({ targets: t, alpha: 0.3, duration: 160, yoyo: true, repeat: 6, onComplete: () => t.destroy() });
  }

  /** Sprechblase über einer Figur (kurz) */
  private blase(x: number, y: number, text: string) {
    const t = txt(this, x, y, text, '#b8f060').setOrigin(0.5, 1).setDepth(1001).setStroke('#0a1a0a', 3).setWordWrapWidth(170).setAlign('center');
    t.setX(Phaser.Math.Clamp(x, t.width / 2 + 4, W - t.width / 2 - 4));
    this.tweens.add({ targets: t, y: y - 6, alpha: 0, delay: 1800, duration: 500, onComplete: () => t.destroy() });
  }

  private funken(x: number, y: number, farbe: number, n: number) {
    for (let i = 0; i < n; i++) {
      const o = this.add.circle(x, y, Phaser.Math.FloatBetween(0.7, 1.6), farbe).setBlendMode(Phaser.BlendModes.ADD).setDepth(950);
      const w = Math.random() * Math.PI * 2, v = Phaser.Math.Between(10, 34);
      this.tweens.add({ targets: o, x: x + Math.cos(w) * v, y: y + Math.sin(w) * v * 0.7 + 6, alpha: 0, duration: Phaser.Math.Between(300, 600), ease: 'Quad.easeOut', onComplete: () => o.destroy() });
    }
  }
}
