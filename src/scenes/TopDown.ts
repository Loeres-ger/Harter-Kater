import Phaser from 'phaser';
import { audio } from '../audio';
import { ItemId, anheitern, bulky, lookStage, rauschStufe, raucht, speedy, state, wirtAktionen } from '../state';
import { fadeTo, floatText } from '../ui';
import { hud, toast } from './HudScene';
import { touch } from '../touch';
import type { DialogAction } from '../dialog/data';
import { naechsterStrang, starteStrang } from '../progress/quests';
import { saveAuto } from '../progress/save';
import { SPEAKERS } from '../dialog/data';
import { MapData, MapObject, MapZone, bedingungErfuellt, zoneGesperrt } from '../maps/types';
import { MAP_DEFS } from '../maps/palettes';
import { LightHint, streetCell, streetLights } from '../maps/streetView';
import { wirtFigur } from '../dialog/kanal';

export const T = 16;
const ZOOM = 2;
/** Rand der Lichtkarte um den Bildausschnitt (Weltpixel), damit beim Laufen keine Kante sichtbar wird */
const LIGHT_PAD = 40;

export interface Interact {
  x: number;
  y: number;
  r: number;
  label: () => string | null;
  act: () => void;
  alt?: () => void;
}

export interface TileInfo {
  key: string;
  solid: boolean;
  /** Objekt auf Bodenkachel (wird y-sortiert) */
  object?: boolean;
}

/** Basis für die begehbaren Draufsicht-Szenen (Bar, Gasse). */
export abstract class TopDown extends Phaser.Scene {
  protected rows: string[] = [];
  protected solid: boolean[][] = [];
  protected player!: Phaser.GameObjects.Sprite;
  protected shadow!: Phaser.GameObjects.Image;
  protected carried?: Phaser.GameObjects.Sprite;
  /** Adshayans Curry-Topf auf dem Kopf (Kapitel 8): langsam wie mit einer Leiche, dampft */
  protected topf?: Phaser.GameObjects.Image;
  private topfDampfT = 0;
  protected interacts: Interact[] = [];
  protected facing: 'down' | 'up' | 'side' = 'down';
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private current: Interact | null = null;
  protected leaving = false;
  /** nach einem Gespräch kurz keine neue Aktion, sonst öffnet Weiterdrücken gleich das nächste */
  private actBlockedUntil = 0;
  private ghostT = 0;
  /** keine Interaktionen (z. B. während eines Events mit Zeitlimit) */
  protected actsBlocked = false;
  /** langsamer laufen (z. B. beim Tragen) */
  protected slow = false;
  /** kleine Szene in der Welt: der Wirt steht still, keine Aktionen */
  protected frozen = false;
  private stepT = 0;

  protected abstract mapRows(): string[];
  protected abstract tileFor(ch: string, x: number, y: number): TileInfo;
  protected abstract floorKey(x: number, y: number): string;
  protected abstract isWall(ch: string): boolean;
  protected abstract setupWorld(): void;
  protected abstract darkness(): number;
  protected abstract goalText(): string;

  init() {
    this.interacts = [];
    this.lightSources = [];
    this.mapLamps = [];
    this.lightRT = undefined;
    this.leaving = false;
    this.actBlockedUntil = 0;
    this.actsBlocked = false;
    this.carried = undefined;
    this.topf = undefined;
    this.current = null;
    this.slow = false;
    this.frozen = false;
    this.kippe = undefined;
    this.koerper = { sx: 1, sy: 1 };
    this.camGedreht = false;
    this.hicksT = 0;
    this.qualmT = 0;
  }

  create(data: { spawn?: [number, number]; rausch?: number }) {
    // Nach der Glanz-Mission ist Glanz Geschichte: ältere oder unstimmige Stände (Glanz lebt noch) geradeziehen,
    // sonst sitzt er wieder in der Bar, obwohl die Stadt längst offen ist. Der Kapitelstand „Es ist erwacht“ wird mitten
    // im Epilog gespeichert (Spiel gewonnen, läuft nicht): auch das hier geraderücken, sonst gibt es keine Zwischenstände.
    if (state.flags.glanzErledigt && !state.dead) Object.assign(state, { dead: true, bodyInAlley: true, carrying: false, wish: null });
    if (state.flags.glanzErledigt && state.gameOver === 'win') Object.assign(state, { gameOver: null, bodyDeadline: null, running: true });
    // angeheitert ankommen (z. B. nach dem Feierabend mit Kalle)
    if (data?.rausch) anheitern(data.rausch);
    this.rows = this.mapRows();
    const mw = Math.max(...this.rows.map((r) => r.length));
    this.rows = this.rows.map((r) => r.padEnd(mw, '.'));
    const mh = this.rows.length;
    this.solid = [];

    // Außenkarten (maps/*.json) zeichnet die gemeinsame Straßenansicht – dieselbe Regel wie im Map-Editor
    const md = this.mapData();
    const sdef = md ? MAP_DEFS[md.id] : undefined;
    // Feste Kacheln (Boden, Fassaden, Bordsteine, Schatten) werden in ein Bild in doppelter Auflösung gebacken:
    // gleiche Schärfe wie die Einzelbilder, aber ein einziges Objekt statt tausender pro Bild. Objekte mit Tiefe
    // (Mülltonnen, Container …) bleiben einzelne Bilder, damit sie vor und hinter Figuren stehen können.
    const MAX_TEX = 4096;
    const bake = sdef && mw * T * 2 <= MAX_TEX && mh * T * 2 <= MAX_TEX
      ? this.add.renderTexture(0, 0, mw * T * 2, mh * T * 2).setOrigin(0).setScale(0.5).setDepth(0.5)
      : undefined;
    const pass: [number, number, string][][] = [[], [], []]; // Boden, Kacheln, Überlagerungen
    for (let y = 0; y < mh; y++) {
      this.solid[y] = [];
      for (let x = 0; x < mw; x++) {
        const ch = this.rows[y][x];
        const px = x * T, py = y * T;
        const info = this.tileFor(ch, x, y);
        if (sdef) {
          const c = streetCell(this.rows, sdef, x, y);
          const key = c.key && this.textures.exists(c.key) ? c.key : undefined;
          if (bake) {
            if (c.floor) pass[0].push([px, py, c.floor]);
            if (key && !c.object) pass[1].push([px, py, key]);
            for (const o of c.overlays) pass[2].push([px, py, o]);
            if (key && c.object) this.add.image(px, py, key).setOrigin(0).setScale(0.5).setDepth(py + T);
          } else {
            if (c.floor) this.add.image(px, py, c.floor).setOrigin(0).setScale(0.5).setDepth(0);
            for (const o of c.overlays) this.add.image(px, py, o).setOrigin(0).setScale(0.5).setDepth(0.6);
            if (key) this.add.image(px, py, key).setOrigin(0).setScale(0.5).setDepth(c.building ? 0.4 : c.object ? py + T : 0.5);
          }
          this.solid[y][x] = info.solid;
          continue;
        }
        if (this.isWall(ch)) {
          const below = this.rows[y + 1]?.[x];
          const front = below !== undefined && !this.isWall(below);
          const key = front ? info.key : info.key.replace('Front', 'Top');
          this.add.image(px, py, this.textures.exists(key) ? key : info.key).setOrigin(0).setScale(0.5).setDepth(front ? 1 : 0);
          this.solid[y][x] = true;
          continue;
        }
        this.add.image(px, py, this.floorKey(x, y)).setOrigin(0).setScale(0.5).setDepth(0);
        if (info.key) this.add.image(px, py, info.key).setOrigin(0).setScale(0.5).setDepth(info.object ? py + T : 0.5);
        this.solid[y][x] = info.solid;
      }
    }

    if (bake) {
      bake.beginDraw();
      for (const list of pass) for (const [px, py, key] of list) bake.batchDrawFrame(key, undefined, px * 2, py * 2);
      bake.endDraw();
    }

    // Karten aus dem Map-Editor: Objekte, Zonen und Kollisions-Korrekturen, Lichter aus der Straßenansicht
    if (md) this.applyMap(md);
    if (sdef) for (const h of streetLights(this.rows, sdef)) this.hintLight(h);

    // Spawns stehen in Koordinaten der ursprünglichen Karte; wurde sie im Editor nach oben/links erweitert, wandern sie mit
    const [ox, oy] = this.origin();
    const [sx, sy] = (data?.spawn ?? [2, 2]).map((v, i) => v + (i ? oy : ox));
    this.shadow = this.add.image(0, 0, 'shadow').setDepth(1);
    this.player = this.add.sprite(sx * T + 8, sy * T + 14, this.wirtAussehen(), 0).setOrigin(0.5, 1).setScale(0.5);

    this.setupWorld();
    this.befreien();

    if (state.carrying) this.carried = this.add.sprite(0, 0, `schnoesel${lookStage()}`, 0).setAngle(90).setScale(0.5);
    if (state.flags.curryTopf) this.topfAufnehmen();

    // Stimmung: Lichtkarte. Die Dunkelheit liegt über der Welt, jede Lichtquelle (addLight) radiert einen weichen Lichtkegel
    // hinein. So hellt eine Laterne ihre Umgebung wirklich auf, statt nur einen Leuchtfleck darüber zu legen.
    // Lichtkarte nur so groß wie der Bildausschnitt (plus Rand); sie wandert mit der Kamera
    this.lightRT = this.add.renderTexture(0, 0, Math.ceil(this.scale.width / ZOOM) + LIGHT_PAD * 2, Math.ceil(this.scale.height / ZOOM) + LIGHT_PAD * 2).setOrigin(0).setDepth(5000);
    this.lightStamp = this.make.image({ key: this.textures.exists('lightPool') ? 'lightPool' : 'light', add: false });
    this.drawLights();

    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    cam.setBounds(0, -12, mw * T, mh * T + 22); // Platz für HUD-Leisten
    cam.startFollow(this.player, true, 0.12, 0.12);
    // kleine Totzone: Schritte hin und her bewegen die Kamera nicht, Richtungswechsel wirken ruhig
    cam.setDeadzone(18, 10);
    // auf den Oberkörper statt auf die Füße zielen: so bleibt über dem Wirt mehr Platz, Schilder über Türen
    // verschwinden nicht unter der oberen HUD-Leiste
    // Außenkarten: weiter nach oben schauen, damit Obergeschoss und Gesims der Fassaden im Bild sind (Blick die Straße
    // entlang auf die Häuser, nicht auf leeren Asphalt)
    cam.setFollowOffset(0, sdef && !sdef.raum ? 26 : 14);
    cam.setRoundPixels(true);
    cam.setBackgroundColor('#0a0608');
    cam.fadeIn(260);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,E,R,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.E.on('down', () => this.act());
    this.keys.SPACE.on('down', () => this.act());
    this.keys.R.on('down', () => this.current?.alt?.());

    hud.prompt = '';
    hud.goal = this.goalText();
    hud.alert = '';
    this.scene.run('Hud');
    this.scene.bringToTop('Hud');
    touch.onAction = () => this.scene.isActive() && this.act();
    // Zwischenstand der offenen Welt: kurz nach dem Betreten, sobald der Wirt frei herumläuft
    this.time.delayedCall(700, () => this.sichern());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.sleep('Hud');
      touch.onAction = null;
    });
  }

  /** Aussehen des Wirts (Kanal-Paket: Wathose); nur wenn die Grafik schon geladen ist */
  private wirtAussehen() {
    const k = wirtFigur();
    return this.textures.exists(k) ? k : 'wirt';
  }

  /** Curry-Topf auf den Kopf nehmen bzw. wieder weg */
  protected topfAufnehmen() {
    this.topf?.destroy();
    this.topf = this.add.image(this.player.x, this.player.y - 21, 'curryTopf').setScale(0.5);
  }
  protected topfWeg() {
    this.topf?.destroy();
    this.topf = undefined;
  }

  // ---------------------------------------------------------------- Karten aus dem Map-Editor

  /** Kartendaten (maps/*.json), falls die Szene ihre Karte daraus lädt */
  protected mapData(): MapData | undefined {
    return undefined;
  }

  /** Verschiebung der Karte durch Erweiterung nach oben/links (Kacheln) */
  protected origin(): [number, number] {
    const o = this.mapData()?.origin;
    return [o?.x ?? 0, o?.y ?? 0];
  }

  /** feste Kachel aus dem Spielcode auf die (eventuell erweiterte) Karte umrechnen */
  protected at([x, y]: [number, number]): [number, number] {
    const [ox, oy] = this.origin();
    return [x + ox, y + oy];
  }

  private applyMap(md: MapData) {
    const f = state.flags;
    const set = (k: string, v: boolean) => {
      const [x, y] = k.split(',').map(Number);
      if (this.solid[y]?.[x] !== undefined) this.solid[y][x] = v;
    };
    md.collision?.block?.forEach((k) => set(k, true));
    md.collision?.free?.forEach((k) => set(k, false));
    // gesperrte Bereiche (Baustelle bis zum Ende der Glanz-Mission, Quest-Flag, dauerhaft, reserviert)
    for (const z of md.zones ?? []) {
      if (!zoneGesperrt(z, f)) continue;
      for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) set(`${x},${y}`, true);
      this.drawZone(z);
    }
    for (const o of md.objects ?? []) if (bedingungErfuellt(f, o.bedingung)) this.placeMapObject(o);
  }

  private drawZone(z: MapZone) {
    const x = z.x * T, y = z.y * T, w = z.w * T, h = z.h * T;
    const g = this.add.graphics().setDepth(y + h);
    if (z.state === 'reserviert') {
      g.fillStyle(0x000000, 1).fillRect(x, y, w, h); // noch nicht erschlossen: schwarz
      return;
    }
    if (z.state === 'baustelle') {
      // Absperrung der Glanzbau Corporation: Bauzaun auf jeder gesperrten Kachel, Warnbaken mit Blinklicht an den Enden,
      // Firmenschild in der Mitte. Alles verschwindet mit der Freischaltung (Zone wird dann gar nicht erst gezeichnet).
      if (this.textures.exists('bauzaun')) {
        for (let ty = z.y; ty < z.y + z.h; ty++)
          for (let tx = z.x; tx < z.x + z.w; tx++) this.add.image(tx * T + 8, (ty + 1) * T, 'bauzaun').setOrigin(0.5, 1).setScale(0.5).setDepth((ty + 1) * T - 1);
        const ends: [number, number][] = z.w >= z.h ? [[x + 3, y + h], [x + w - 3, y + h]] : [[x + w / 2, y + 6], [x + w / 2, y + h]];
        ends.forEach(([bx, by], i) => {
          this.add.image(bx, by, 'bake').setOrigin(0.5, 1).setScale(0.5).setDepth(by + 1);
          const blink = this.addLight(bx, by - 8, 0.22, 0.8, false).setTint(0xffa020);
          this.tweens.killTweensOf(blink);
          this.tweens.add({ targets: blink, alpha: 0.05, duration: 380, yoyo: true, repeat: -1, delay: i * 380 });
        });
        this.add.image(x + w / 2, y + h - 4, 'signGlanzbau').setOrigin(0.5, 1).setScale(0.5).setDepth(y + h + 2);
      } else {
        g.fillStyle(0xd02a2a, 0.5).fillRect(x, y, w, h);
      }
      return;
    }
    // Quest-Bereich (z. B. der Kult-Innenhof): bleibt im Halbdunkel, bis die Quest ihn öffnet – man ahnt, was drin ist
    if (z.state === 'quest') {
      g.setDepth(4999).fillStyle(0x05040a, 0.5).fillRect(x, y, w, h);
      return;
    }
    // dauerhaft gesperrt: dunkles Gitter
    g.fillStyle(0x0a0a10, 0.55).fillRect(x, y, w, h);
    g.lineStyle(1, 0x6a6a7a, 0.9);
    for (let i = 0; i <= w; i += 4) g.lineBetween(x + i, y, x + i, y + h);
  }

  private placeMapObject(o: MapObject) {
    const depth = o.ebene === 'boden' ? 0.6 : o.ebene === 'vorne' ? 5003 : o.y;
    if (o.solid) this.solid[Math.floor((o.y - 2) / T)]?.splice(Math.floor(o.x / T), 1, true);
    if (o.kind === 'deko' || o.kind === 'npc') {
      if (!o.key || !this.textures.exists(o.key)) return;
      const sp = this.add.sprite(o.x, o.y, o.key, o.frame ?? 0).setOrigin(0.5, 1).setScale(0.5 * (o.scale ?? 1)).setFlipX(!!o.flipX).setDepth(depth);
      // leuchtende Schilder, Laternen, Schaufenster-Deko: kleiner Lichtkegel in der Farbe des Objekts
      if (o.glow) this.addLight(o.x, o.y - sp.displayHeight / 2, Math.max(0.35, sp.displayWidth / 70), 0.6).setTint(parseInt(o.glow.replace('#', ''), 16));
      if (o.kind === 'npc') {
        this.add.image(o.x, o.y - 1, 'shadow').setDepth(1);
        const who = o.talk;
        if (who && SPEAKERS[who]) this.interacts.push({ x: o.x, y: o.y - 4, r: 18, label: () => o.label || `Mit ${SPEAKERS[who].name} reden`, act: () => this.talk(who) });
      }
    } else if (o.kind === 'schild') {
      this.add.text(o.x, o.y, o.text ?? '', { fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: '#f4ead0', backgroundColor: '#120c0bcc', padding: { x: 3, y: 2 }, align: 'center' })
        .setOrigin(0.5, 1).setResolution(2).setScale(0.5 * (o.scale ?? 1)).setDepth(depth);
    } else if (o.kind === 'interaktion') {
      this.interacts.push({ x: o.x, y: o.y, r: 16, label: () => o.label || 'Ansehen', act: () => this.toast(o.text ?? '...') });
    }
  }

  // ---------------------------------------------------------------- Helfer für Unterklassen

  /** Lichtquelle: weicher Schein (ADD) plus Lichtkegel in der Lichtkarte. Alpha/Sichtbarkeit des Bildes steuern beides. */
  protected addLight(x: number, y: number, scale = 1, alpha = 0.8, pool = true) {
    const l = this.add.image(x, y, this.textures.exists('lightSoft') ? 'lightSoft' : 'light').setBlendMode(Phaser.BlendModes.ADD).setDepth(5001).setScale(scale).setAlpha(alpha);
    this.tweens.add({ targets: l, alpha: alpha * 0.8, duration: 900 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (pool) this.lightSources.push(l);
    return l;
  }

  /** Licht aus der Straßenansicht; Laternen merkt sich die Szene (z. B. zum Flackern) */
  protected mapLamps: Phaser.GameObjects.Image[] = [];
  private hintLight(h: LightHint) {
    const l = this.addLight(h.x, h.y, h.scale, h.alpha, h.pool).setTint(h.tint);
    if (h.kind === 'lamp') this.mapLamps.push(l);
    if (h.reflect) {
      // Spiegelung auf nassem Pflaster: schmaler, senkrechter Schein unter der Lichtquelle
      const s = this.add.image(h.x, h.y + 10, 'lightSoft').setBlendMode(Phaser.BlendModes.ADD).setScale(0.12, 0.55).setTint(h.tint).setAlpha(0.35).setDepth(2);
      this.tweens.add({ targets: s, scaleX: 0.1, alpha: 0.25, duration: 1300 + Math.random() * 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private lightRT?: Phaser.GameObjects.RenderTexture;
  private lightStamp?: Phaser.GameObjects.Image;
  private lightSources: Phaser.GameObjects.Image[] = [];

  /** Lichtkarte neu zeichnen: Dunkelheit füllen, Lichtkegel aller sichtbaren Lichtquellen herausradieren. */
  private drawLights() {
    const rt = this.lightRT, st = this.lightStamp;
    if (!rt || !st) return;
    const v = this.cameras.main.worldView;
    const ox = Math.floor(v.x) - LIGHT_PAD, oy = Math.floor(v.y) - LIGHT_PAD;
    rt.setPosition(ox, oy);
    rt.clear().fill(0x0a0612, this.darkness());
    rt.beginDraw();
    for (const l of this.lightSources) {
      if (!l.active || !l.visible || l.alpha < 0.02) continue;
      // nur Lichtkegel, die ins Bild reichen
      const rad = 64 * Math.max(l.scaleX, l.scaleY) * 1.15;
      if (l.x + rad < ox || l.x - rad > ox + rt.width || l.y + rad < oy || l.y - rad > oy + rt.height) continue;
      st.setPosition(l.x - ox, l.y - oy).setScale(l.scaleX * 1.15, l.scaleY * 1.15).setAlpha(Math.min(1, l.alpha * 1.25));
      rt.erase(st); // innerhalb von beginDraw/endDraw gesammelt statt einzeln
    }
    rt.endDraw();
  }

  /**
   * Sprechblase über einer Figur in der Welt (kleine Szenen ohne Gesprächsfenster). Wartet, bis die Zeit um ist
   * oder der Spieler weitertippt (E, Leertaste, Enter, Klick).
   */
  protected blase(x: number, y: number, text: string, color = '#f4ead0'): Promise<void> {
    return new Promise((done) => {
      const t = this.add.text(x, y, text, {
        fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color, backgroundColor: '#120c0be6',
        padding: { x: 4, y: 3 }, align: 'center', wordWrap: { width: 300 }, lineSpacing: 3,
      }).setOrigin(0.5, 1).setResolution(2).setScale(0.5).setDepth(6000).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, y: y - 2, duration: 160 });
      let fertig = false;
      const ende = () => {
        if (fertig) return;
        fertig = true;
        kb.off('keydown-E', weiter); kb.off('keydown-SPACE', weiter); kb.off('keydown-ENTER', weiter);
        this.input.off('pointerdown', weiter);
        this.tweens.add({ targets: t, alpha: 0, duration: 140, onComplete: () => t.destroy() });
        this.time.delayedCall(150, done);
      };
      const kb = this.input.keyboard!;
      const start = this.time.now;
      const weiter = () => { if (this.time.now - start > 350) ende(); };
      kb.on('keydown-E', weiter); kb.on('keydown-SPACE', weiter); kb.on('keydown-ENTER', weiter);
      this.input.on('pointerdown', weiter);
      this.time.delayedCall(1800 + text.length * 55, ende);
    });
  }

  protected wartet(ms: number) {
    return new Promise<void>((done) => this.time.delayedCall(ms, done));
  }

  protected toast(s: string) {
    toast(s);
  }

  protected float(s: string, color = '#f8e070') {
    floatText(this, this.player.x, this.player.y - 24, s, color);
  }

  private act() {
    if (this.actsBlocked || this.frozen || this.time.now < this.actBlockedUntil) return;
    this.current?.act();
  }

  /** Gespräch unter vier Augen öffnen; diese Szene pausiert so lange. */
  protected talk(who: string, onDone?: (action?: DialogAction) => void) {
    if (this.leaving) return;
    hud.prompt = '';
    this.events.once(Phaser.Scenes.Events.RESUME, () => (this.actBlockedUntil = this.time.now + 450));
    this.scene.launch('Dialog', { who, resume: this.scene.key, onDone });
    this.scene.bringToTop('Dialog');
    this.scene.pause();
  }

  /** Zwischenstand speichern (nur offene Welt und nur, wenn der Wirt gerade frei herumläuft) */
  protected sichern() {
    if (!state.flags.glanzErledigt || this.leaving || !state.running || state.carrying || state.bodyDeadline !== null || state.gameOver) return;
    if (!this.scene.isActive()) return;
    saveAuto(this.scene.key, this.hier());
  }

  /** Kachel, auf der der Wirt steht (Koordinaten der ursprünglichen Karte, wie Spawns). Maßgeblich ist die Mitte
   *  seiner Kollisionsbox; früher wurde gerundet, und wer oben an einer Kachel stand, landete beim Laden eine Reihe
   *  höher, mitten in Tresen oder Pflanze. */
  protected hier(): [number, number] {
    const [ox, oy] = this.origin();
    return [Math.floor(this.player.x / T) - ox, Math.floor((this.player.y - 3) / T) - oy];
  }

  /**
   * Steckt der Wirt in etwas Festem (alter Speicherstand, Möbel oder Pflanze, die erst später aufgestellt wurde),
   * wird er auf die nächste freie Kachel gesetzt. true, wenn er versetzt wurde.
   */
  protected befreien() {
    const p = this.player;
    if (!this.blocked(p.x, p.y - 3)) return false;
    const h = this.solid.length, w = this.solid[0]?.length ?? 0;
    const sx = Phaser.Math.Clamp(Math.floor(p.x / T), 0, w - 1), sy = Phaser.Math.Clamp(Math.floor((p.y - 3) / T), 0, h - 1);
    const seen = new Set([sy * w + sx]);
    const queue: [number, number][] = [[sx, sy]];
    for (let i = 0; i < queue.length && i < 2000; i++) {
      const [x, y] = queue[i];
      if (!this.blocked(x * T + 8, y * T + 11)) {
        p.setPosition(x * T + 8, y * T + 14);
        return true;
      }
      for (const [nx, ny] of [[x, y + 1], [x, y - 1], [x - 1, y], [x + 1, y]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(ny * w + nx)) continue;
        seen.add(ny * w + nx);
        queue.push([nx, ny]);
      }
    }
    return false;
  }

  protected go(key: string, data?: object) {
    if (this.leaving) return;
    this.leaving = true;
    hud.prompt = '';
    fadeTo(this, key, data);
  }

  /**
   * Offene Welt: kurz nach dem Betreten prüfen, ob eine neue Story-Fortsetzung ansteht (siehe progress/quests.ts).
   * Höchstens eine Einleitung auf einmal; nie mit Leiche auf der Schulter oder laufender Frist.
   */
  protected scheduleStory(blocked: () => boolean = () => false) {
    this.time.delayedCall(900, () => {
      if (this.leaving || blocked() || state.carrying || state.bodyDeadline !== null || state.gameOver || !state.running) return;
      const s = naechsterStrang(state.flags, state.time);
      if (!s) return;
      if (s.manuell) {
        // eigener Auslöser: nur vormerken und ankündigen, die Szene am Ort startet den Strang
        state.flags.strangBereit = s.id;
        if (s.hinweis) this.toast(s.hinweis);
        return;
      }
      starteStrang(s, state.flags, state.time);
      const here = this.hier();
      this.go('Cutscene', { script: s.script, next: { scene: s.danach?.scene ?? this.scene.key, data: { spawn: s.danach?.spawn ?? here } } });
    });
  }

  protected randomFloorTile(): [number, number] {
    for (let i = 0; i < 200; i++) {
      const y = Phaser.Math.Between(1, this.rows.length - 2);
      const x = Phaser.Math.Between(1, this.rows[0].length - 2);
      if (!this.solid[y][x] && this.rows[y][x] === '.') return [x, y];
    }
    return [2, 2];
  }

  protected spawnCoin(tx: number, ty: number) {
    const c = this.add.image(tx * T + 8, ty * T + 10, 'coin').setScale(0.5).setDepth(ty * T + 10);
    this.tweens.add({ targets: c, y: c.y - 2, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.interacts.push({
      x: c.x, y: c.y, r: 12,
      label: () => (c.active ? 'Münze aufheben' : null),
      act: () => {
        if (!c.active) return;
        const v = Phaser.Math.Between(1, 3);
        state.money += v;
        this.float(`+${v}€`);
        audio.sfx('coin');
        c.destroy();
      },
    });
  }

  // ---------------------------------------------------------------- Bewegung

  protected blocked(x: number, y: number) {
    const hw = 3.5, hh = 2.5;
    for (const [cx, cy] of [[x - hw, y - hh], [x + hw, y - hh], [x - hw, y + hh], [x + hw, y + hh]]) {
      const tx = Math.floor(cx / T), ty = Math.floor(cy / T);
      if (this.solid[ty]?.[tx] ?? true) return true;
    }
    return false;
  }

  /** Selbst genommene Waren: kleine Animation am Wirt, Qualm, Schwanken (siehe InventarScene, state.benutze) */
  private wirtFx(delta: number) {
    while (wirtAktionen.length) this.consumeFx(wirtAktionen.shift()!);
    const cam = this.cameras.main, p = this.player;
    const rausch = rauschStufe();
    if (rausch) { cam.setRotation(Math.sin(this.time.now / 700) * 0.008 * rausch); this.camGedreht = true; }
    else if (this.camGedreht) { cam.setRotation(0); this.camGedreht = false; }
    this.hicksT -= delta;
    if (rausch >= 2 && this.hicksT <= 0) {
      this.hicksT = 6000 - rausch * 600;
      floatText(this, p.x + 4, p.y - 26, '*hicks*', '#f0c0d0').setDepth(5004);
    }
    if (raucht()) {
      this.kippe ??= this.add.rectangle(0, 0, 2, 1, 0xff8a30).setDepth(5002);
      this.kippe.setVisible(true).setPosition(p.x + (p.flipX ? -5 : 5), p.y - 15).setAlpha(0.6 + 0.4 * Math.sin(this.time.now / 120));
      this.qualmT -= delta;
      if (this.qualmT <= 0) {
        this.qualmT = 650;
        const s = this.add.image(this.kippe.x, this.kippe.y - 2, 'light').setTint(0xd8d8d8).setAlpha(0.35).setScale(0.03).setDepth(5002);
        this.tweens.add({ targets: s, y: s.y - 14, x: s.x + Phaser.Math.Between(-4, 4), scale: 0.1, alpha: 0, duration: 1400, onComplete: () => s.destroy() });
      }
    } else this.kippe?.setVisible(false);
  }

  private hicksT = 0;
  private camGedreht = false;
  private qualmT = 0;
  private kippe?: Phaser.GameObjects.Rectangle;

  // ---------------------------------------------------------------- Konsum-Animationen
  // Jede Ware hat ihren eigenen kleinen Ablauf am Wirt: Der Gegenstand folgt der Hand (auch beim Laufen),
  // der Körper staucht beim Schlucken und Beißen, dazu Partikel und Töne im Takt.

  /** Körperverformung des Wirts (wird in update mit der Grundskalierung verrechnet) */
  private koerper = { sx: 1, sy: 1 };

  /** Gegenstand relativ zum Wirt führen; rel wird getweent. Liefert die Aufräumfunktion. */
  private fuehre(o: Phaser.GameObjects.Image, rel: { x: number; y: number }) {
    const p = this.player;
    const f = () => {
      const dir = p.flipX ? -1 : 1;
      o.setPosition(p.x + rel.x * dir, p.y + rel.y).setFlipX(p.flipX).setDepth(p.depth + (this.facing === 'up' ? -0.5 : 0.5));
    };
    f();
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, f);
    return () => this.events.off(Phaser.Scenes.Events.POST_UPDATE, f);
  }

  private ablauf(cfg: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((done) => this.tweens.add({ ...cfg, onComplete: () => done() }));
  }

  private warteKurz(ms: number) {
    return new Promise<void>((done) => this.time.delayedCall(ms, done));
  }

  /** Stauchen/Strecken des Körpers (Schlucken, Beißen, Schaudern) */
  private stauch(sx: number, sy: number, ms: number) {
    this.tweens.killTweensOf(this.koerper);
    this.koerper.sx = 1; this.koerper.sy = 1;
    this.tweens.add({ targets: this.koerper, sx, sy, duration: ms, yoyo: true, ease: 'Sine.easeInOut' });
  }

  private sag(s: string, color = '#f8e070') {
    floatText(this, this.player.x, this.player.y - 26, s, color).setDepth(5004);
  }

  /** kleine Partikel an einem Punkt (Bläschen, Krümel, Pulver) */
  private partikel(x: number, y: number, n: number, farben: number[], art: 'hoch' | 'fall' | 'wolke') {
    for (let i = 0; i < n; i++) {
      const s = this.add.rectangle(x + Phaser.Math.Between(-1, 1), y, 1, 1, Phaser.Utils.Array.GetRandom(farben)).setDepth(5004);
      if (art === 'hoch') this.tweens.add({ targets: s, y: y - Phaser.Math.Between(4, 9), x: s.x + Phaser.Math.Between(-2, 2), alpha: 0, duration: Phaser.Math.Between(400, 700), onComplete: () => s.destroy() });
      else if (art === 'fall') this.tweens.add({ targets: s, y: y + Phaser.Math.Between(6, 11), x: s.x + Phaser.Math.Between(-4, 4), alpha: 0, duration: Phaser.Math.Between(350, 550), ease: 'Quad.easeIn', onComplete: () => s.destroy() });
      else this.tweens.add({ targets: s, y: y + Phaser.Math.Between(-4, 3), x: s.x + Phaser.Math.Between(-5, 5), alpha: 0, scale: 2, duration: Phaser.Math.Between(400, 800), onComplete: () => s.destroy() });
    }
  }

  private consumeFx(id: ItemId) {
    if (id === 'bier' || id === 'schnaps' || id === 'fusel' || id === 'lassi') void this.trinkFx(id);
    else if (id === 'kippe') void this.rauchFx();
    else if (id === 'pillen') void this.pillenFx();
    else if (id === 'zeug') void this.zeugFx();
    else if (id === 'wurst' || id === 'kaese' || id === 'curry') void this.essFx(id);
  }

  /** Trinken: Flasche in die Hand, kurz absenken, zum Mund, drei Schlucke, absetzen, wegwerfen */
  private async trinkFx(id: 'bier' | 'schnaps' | 'fusel' | 'lassi') {
    const p = this.player;
    const rel = { x: 5, y: -6 };
    const fl = this.add.image(0, 0, `icon_${id}`).setScale(0).setDepth(5003);
    const los = this.fuehre(fl, rel);
    await this.ablauf({ targets: fl, scale: 0.3, duration: 120, ease: 'Back.easeOut' });
    await this.ablauf({ targets: rel, y: -4, duration: 90 });
    this.tweens.add({ targets: fl, angle: { from: 0, to: -110 }, duration: 260, ease: 'Sine.easeOut' });
    await this.ablauf({ targets: rel, x: 3, y: -13, duration: 260, ease: 'Back.easeOut' });
    for (let i = 0; i < 3; i++) {
      audio.sfx('glug');
      this.stauch(0.96, 1.06, 150);
      this.tweens.add({ targets: rel, y: -14, duration: 150, yoyo: true });
      this.partikel(fl.x, fl.y - 2, 2, [0xffffff, 0xf0e0a0], 'hoch');
      await this.warteKurz(330);
    }
    this.tweens.add({ targets: fl, angle: 0, duration: 200 });
    await this.ablauf({ targets: rel, x: 5, y: -6, duration: 200, ease: 'Sine.easeIn' });
    los();
    // leere Flasche über die Schulter
    const dir = p.flipX ? 1 : -1;
    this.tweens.add({ targets: fl, x: fl.x + dir * 14, duration: 420, ease: 'Linear' });
    this.tweens.add({ targets: fl, y: fl.y - 8, duration: 200, ease: 'Quad.easeOut', yoyo: true, onComplete: () => { audio.sfx('clang'); this.tweens.add({ targets: fl, alpha: 0, duration: 300, onComplete: () => fl.destroy() }); } });
    this.tweens.add({ targets: fl, angle: dir * 300, duration: 420 });
    if (id === 'lassi') {
      this.sag('Mango!', '#ffc060');
      this.partikel(p.x + (p.flipX ? -2 : 2), p.y - 13, 3, [0xf0a030, 0xf8e0b0], 'hoch');
    } else if (id === 'bier') {
      this.sag('Ahh!');
      this.partikel(p.x + (p.flipX ? -2 : 2), p.y - 13, 4, [0xffffff, 0xf8f0d8], 'hoch');
    } else if (id === 'schnaps') {
      this.sag('Brrr!', '#f0c0d0');
      this.tweens.add({ targets: this.koerper, sx: { from: 0.94, to: 1.06 }, duration: 50, yoyo: true, repeat: 4, onComplete: () => { this.koerper.sx = 1; } });
    } else {
      this.sag('HUST!', '#b0e090');
      p.setTint(0xa8e090);
      this.cameras.main.shake(260, 0.005);
      for (let i = 0; i < 3; i++) this.time.delayedCall(i * 200, () => { this.stauch(1.04, 0.92, 90); this.partikel(p.x + (p.flipX ? -4 : 4), p.y - 13, 3, [0xd8d8d0, 0xb0b0a8], 'wolke'); });
      this.time.delayedCall(900, () => p.clearTint());
    }
  }

  /** Rauchen: Kippe an den Mund, Feuerzeug flackert, Spitze glimmt auf, große Wolke ausatmen */
  private async rauchFx() {
    const p = this.player;
    const rel = { x: 5, y: -6 };
    const k = this.add.image(0, 0, 'icon_kippe').setScale(0).setDepth(5003);
    const los = this.fuehre(k, rel);
    await this.ablauf({ targets: k, scale: 0.22, duration: 120 });
    await this.ablauf({ targets: rel, x: 4, y: -13, duration: 240, ease: 'Back.easeOut' });
    // Feuerzeug
    const flamme = this.add.image(0, 0, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffa030).setScale(0.05).setDepth(5004);
    const fRel = { x: 7, y: -14 };
    const losF = this.fuehre(flamme, fRel);
    audio.sfx('lighter');
    const flacker = this.time.addEvent({ delay: 60, loop: true, callback: () => flamme.setScale(0.04 + Math.random() * 0.03) });
    await this.warteKurz(520);
    flacker.remove(); losF(); flamme.destroy();
    await this.ablauf({ targets: k, scale: 0, duration: 140 });
    los(); k.destroy();
    // ziehen ...
    this.stauch(1.05, 1.04, 380);
    await this.warteKurz(700);
    // ... und ausatmen: Wolke in Blickrichtung
    this.sag('*pfff*');
    const dir = p.flipX ? -1 : 1;
    for (let i = 0; i < 7; i++) {
      this.time.delayedCall(i * 45, () => {
        const s = this.add.image(p.x + dir * 4, p.y - 13, 'light').setTint(0xd8d8d8).setAlpha(0.45).setScale(0.03).setDepth(5003);
        this.tweens.add({ targets: s, x: s.x + dir * Phaser.Math.Between(10, 20), y: s.y - Phaser.Math.Between(4, 12), scale: Phaser.Math.FloatBetween(0.12, 0.2), alpha: 0, duration: Phaser.Math.Between(1300, 1900), ease: 'Sine.easeOut', onComplete: () => s.destroy() });
      });
    }
  }

  /** Pillen: hochwerfen, mit dem Mund fangen, schlucken, dann geht es los */
  private async pillenFx() {
    const p = this.player;
    const pille = this.add.ellipse(0, 0, 3, 2, 0x5ab0ff).setDepth(5004).setStrokeStyle(1, 0xffffff, 0.6);
    const rel = { x: 5, y: -7 };
    const f = () => pille.setPosition(p.x + rel.x * (p.flipX ? -1 : 1), p.y + rel.y);
    f();
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, f);
    this.stauch(1.03, 0.94, 100);
    await this.warteKurz(120);
    // Wurf in hohem Bogen zum Mund
    this.tweens.add({ targets: rel, x: 1, duration: 520, ease: 'Linear' });
    this.tweens.add({ targets: pille, angle: 540, duration: 520 });
    await this.ablauf({ targets: rel, y: -24, duration: 260, ease: 'Quad.easeOut' });
    this.stauch(0.98, 1.05, 120);
    await this.ablauf({ targets: rel, y: -13, duration: 260, ease: 'Quad.easeIn' });
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, f);
    pille.destroy();
    audio.sfx('glug');
    this.stauch(1.06, 0.9, 120);
    this.sag('*schluck*');
    await this.warteKurz(300);
    // Tempo: blaue Striche fliegen vom Wirt weg
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const s = this.add.rectangle(p.x, p.y - 10, 5, 1, 0x7ac8ff).setRotation(a).setDepth(5004);
      this.tweens.add({ targets: s, x: p.x + Math.cos(a) * 16, y: p.y - 10 + Math.sin(a) * 12, alpha: 0, duration: 350, onComplete: () => s.destroy() });
    }
  }

  /** Zeug: Tütchen an die Nase, Schniefen mit Pulverwolke, dann wird es bunt */
  private async zeugFx() {
    const p = this.player;
    const rel = { x: 5, y: -6 };
    const t = this.add.image(0, 0, 'icon_zeug').setScale(0).setDepth(5003);
    const los = this.fuehre(t, rel);
    await this.ablauf({ targets: t, scale: 0.26, duration: 120 });
    await this.ablauf({ targets: rel, x: 2, y: -12, duration: 240, ease: 'Back.easeOut' });
    for (let i = 0; i < 2; i++) {
      this.stauch(1.02, 1.06, 110);
      this.partikel(t.x, t.y - 1, 6, [0xffffff, 0xf0f0ff, 0xe0d8ff], 'wolke');
      await this.warteKurz(220);
    }
    this.sag('SNIEF!', '#ffffff');
    await this.ablauf({ targets: t, scale: 0, alpha: 0, duration: 160 });
    los(); t.destroy();
    // Rausch: Kamera pulsiert, der Wirt schillert kurz in allen Farben
    const cam = this.cameras.main;
    cam.flash(300, 255, 120, 255);
    this.tweens.add({ targets: cam, zoom: 2.12, duration: 180, yoyo: true, ease: 'Sine.easeInOut', onComplete: () => cam.setZoom(2) });
    const farben = [0xff80ff, 0x80ffff, 0xffff80, 0x80ff80];
    let n = 0;
    const ev = this.time.addEvent({ delay: 90, repeat: 13, callback: () => { p.setTint(farben[n++ % farben.length]); if (n > 13) p.clearTint(); } });
    void ev;
    this.time.delayedCall(1400, () => p.clearTint());
    await this.warteKurz(400);
    this.sag('Whoa ...', '#ff9aff');
  }

  /** Essen: drei Bissen, das Stück wird jedes Mal kleiner, Krümel fallen */
  private async essFx(id: 'wurst' | 'kaese' | 'curry') {
    const p = this.player;
    const rel = { x: 5, y: -6 };
    const e = this.add.image(0, 0, `icon_${id}`).setScale(0).setDepth(5003);
    const los = this.fuehre(e, rel);
    await this.ablauf({ targets: e, scale: 0.3, duration: 120, ease: 'Back.easeOut' });
    const w = e.width;
    for (let i = 0; i < 3; i++) {
      await this.ablauf({ targets: rel, x: 3, y: -12, duration: 160, ease: 'Sine.easeOut' });
      audio.sfx('chomp');
      this.stauch(1.04, 0.94, 90);
      // Biss: rechts fehlt jetzt ein Stück
      e.setCrop(0, 0, w * (1 - (i + 1) / 3.2), e.height);
      this.partikel(e.x, e.y + 1, 3, id === 'wurst' ? [0xa8402c, 0xe8c0a0] : id === 'curry' ? [0xe0801a, 0xf4f0e0] : [0xf0c840, 0xc89820], 'fall');
      await this.ablauf({ targets: rel, x: 5, y: -6, duration: 160, ease: 'Sine.easeIn' });
      await this.warteKurz(120);
    }
    los(); e.destroy();
    this.sag(id === 'wurst' ? 'Mmmh, Hausmacher.' : id === 'curry' ? 'Scharf!' : '*mampf*');
    this.stauch(1.05, 0.97, 200);
  }

  update(_t: number, delta: number) {
    this.drawLights();
    this.wirtFx(delta);
    if (state.gameOver === 'flucht' || state.gameOver === 'polizei') {
      state.running = false;
      this.go('End');
    }
    if (this.leaving) return;

    const k = this.keys, c = this.cursors;
    let vx = 0, vy = 0;
    if (!this.frozen) {
      if (k.A.isDown || c.left.isDown) vx -= 1;
      if (k.D.isDown || c.right.isDown) vx += 1;
      if (k.W.isDown || c.up.isDown) vy -= 1;
      if (k.S.isDown || c.down.isDown) vy += 1;
      // Touch-Joystick
      vx += touch.vx;
      vy += touch.vy;
    }
    // betrunken: der Wirt torkelt ein bisschen zur Seite
    const rausch = rauschStufe();
    if (rausch && (vx || vy)) {
      const tt = this.time.now / 1000;
      vx += Math.sin(tt * 1.7) * 0.18 * rausch;
      vy += Math.cos(tt * 1.3) * 0.12 * rausch;
    }
    const len = Math.hypot(vx, vy) || 1;
    const speed = (state.carrying || this.slow || this.topf ? 46 : 74) * (speedy() ? 1.5 : 1) * (delta / 1000);
    const dx = (vx / len) * speed, dy = (vy / len) * speed;
    const p = this.player;
    if ((dx || dy) && this.befreien()) return;
    const feetY = p.y - 3;
    if (dx && !this.blocked(p.x + dx, feetY)) p.x += dx;
    if (dy && !this.blocked(p.x, feetY + dy)) p.y += dy;

    // rote Pille: breit wie ein Schrank
    const kv = this.koerper;
    if (bulky()) p.setScale(0.76 * kv.sx, 0.54 * kv.sy);
    else p.setScale(0.5 * kv.sx, 0.5 * kv.sy);
    // blaue Pille: Nachbilder hinter dem Wirt
    if (speedy() && (vx || vy)) {
      this.ghostT -= delta;
      if (this.ghostT <= 0) {
        this.ghostT = 70;
        const g = this.add.image(p.x, p.y, p.texture.key, p.frame.name).setOrigin(0.5, 1).setScale(p.scaleX, p.scaleY).setFlipX(p.flipX)
          .setTint(0x60c8ff).setAlpha(0.5).setDepth(p.y - 1);
        this.tweens.add({ targets: g, alpha: 0, duration: 260, onComplete: () => g.destroy() });
      }
    }

    // Kanal-Paket gekauft oder abgelegt: Figur wechseln (andere Verwandlungen nicht überschreiben)
    const fig = this.wirtAussehen();
    if (p.texture.key !== fig && (p.texture.key === 'wirt' || p.texture.key === 'wirtKanal')) p.setTexture(fig, p.frame.name);
    if (vx || vy) {
      if (vx) this.facing = 'side';
      else this.facing = vy < 0 ? 'up' : 'down';
      if (this.facing === 'side') p.setFlipX(vx < 0);
      p.anims.play(`${p.texture.key === 'wirtKanal' ? 'wirtKanal' : 'wirt'}_${this.facing}`, true);
      this.stepT -= delta;
      if (this.stepT <= 0) {
        audio.sfx('step');
        this.stepT = state.carrying || this.slow ? 420 : 290;
      }
    } else {
      p.anims.stop();
      p.setFrame(this.facing === 'down' ? 0 : this.facing === 'up' ? 3 : 6);
    }
    p.setDepth(p.y);
    this.shadow.setPosition(p.x, p.y - 1);
    if (this.carried) this.carried.setPosition(p.x, p.y - 22).setDepth(p.y + 1);
    if (this.topf) {
      this.topf.setPosition(p.x, p.y - 21).setDepth(p.y + 1);
      this.topfDampfT -= delta;
      if (this.topfDampfT <= 0) {
        this.topfDampfT = 260;
        const d = this.add.circle(p.x + Phaser.Math.Between(-3, 3), p.y - 25, 1.2, 0xf4e8d8, 0.55).setDepth(p.y + 2);
        this.tweens.add({ targets: d, y: d.y - 10, x: d.x + Phaser.Math.Between(-3, 3), scale: 2.2, alpha: 0, duration: 900, onComplete: () => d.destroy() });
      }
    }

    // Nächste Interaktion
    let best: Interact | null = null, bestD = Infinity;
    for (const it of this.interacts) {
      const d = Phaser.Math.Distance.Between(p.x, p.y - 4, it.x, it.y);
      if (d < it.r && d < bestD && it.label()) { best = it; bestD = d; }
    }
    this.current = best;
    hud.prompt = best && !this.actsBlocked && !this.frozen ? `[E] ${best.label()}` : '';
    hud.goal = this.goalText();
  }
}
