import Phaser from 'phaser';
import '@fontsource/press-start-2p/latin-400.css';
import { makeAllTextures } from '../gfx';
import { makeCasinoTextures } from '../casino/gfx';
import { makeGuestTextures } from '../guests/gfx';
import { makeWorldTextures } from '../world/textures';
import { makeLeonardTextures } from '../world/leonard';
import { makeAchievementIcons } from '../progress/icons';
import { makeRoomTextures } from '../rooms/gfx';
import { makeLadenTextures } from '../rooms/ladenGfx';
import { makeAnneTextures } from '../events/anne';
import { makeClaudiusTextures } from '../events/claudius';
import { makeStreetTextures } from '../world/street';
import { makeCityTextures } from '../world/city';
import { makeKanalTiles } from '../world/kanalTiles';
import alleyFile from '../maps/alley.json';
import { MAP_DEFS, MapDef, TileDef, tileKey } from '../maps/palettes';
import type { MapData, MapObject, MapZone, ObjectKind, ZoneState } from '../maps/types';
import { TEST_KEY } from '../maps';
import { SPEAKERS } from '../dialog/data';
import { Prefab, ausschnitt, eingebaut } from './prefabs';
import { streetCell, streetLights } from '../maps/streetView';

// Map-Editor für Harter Karter (nur Dev-Server: npm run dev, dann /editor.html).
// Zeichnet mit den echten Spielgrafiken (dieselben Funktionen wie im Spiel erzeugen sie), bearbeitet maps/*.json
// und speichert über den Dev-Endpunkt /__maps (vite.config.ts) – vorher wird die alte Datei gesichert.

const T = 16;
const $ = <E extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as E;
const clone = <X>(x: X): X => JSON.parse(JSON.stringify(x));
const uid = () => Math.random().toString(36).slice(2, 9);

// ---------------------------------------------------------------- Texturen aus dem Spiel

let game: Phaser.Game;
interface Img { src: CanvasImageSource; sx: number; sy: number; sw: number; sh: number }
const imgCache = new Map<string, Img | null>();

function img(key: string | undefined, frame: number | string = 0): Img | null {
  if (!key) return null;
  const id = `${key}#${frame}`;
  if (imgCache.has(id)) return imgCache.get(id)!;
  let r: Img | null = null;
  if (game.textures.exists(key)) {
    const t = game.textures.get(key);
    const f = t.has(String(frame)) ? t.get(frame) : t.get();
    r = { src: f.source.image as CanvasImageSource, sx: f.cutX, sy: f.cutY, sw: f.cutWidth, sh: f.cutHeight };
  }
  imgCache.set(id, r);
  return r;
}
const exists = (key: string) => game.textures.exists(key);

// ---------------------------------------------------------------- Zustand

type Tool = 'select' | 'brush' | 'rect' | 'line' | 'erase' | 'region' | 'stamp' | 'deko' | 'npc' | 'interakt' | 'spawn' | 'collision' | 'zone';
const TOOLS: [Tool, string, string, string, string][] = [
  ['select', '➚', 'Auswahl', 'V', 'Objekt anklicken, ziehen = verschieben, Umschalt = mehrere, Rahmen ziehen = mehrere. Entf löscht, Strg+C/V kopiert.'],
  ['brush', '✎', 'Pinsel', 'B', 'Kachel aus „Kacheln“ malen (Straße, Gehweg, Gras …).'],
  ['rect', '▭', 'Fläche', 'R', 'Rechteck mit der Kachel füllen: Straßen verbreitern, Plätze anlegen.'],
  ['line', '╱', 'Wand & Zaun', 'W', 'Gerade Linie ziehen, z. B. Mauern, Fassaden, Gehwegkanten.'],
  ['erase', '⌫', 'Radierer', 'E', 'Kachel auf leeren Boden setzen und Objekte dort entfernen.'],
  ['region', '⬚', 'Bereich', 'A', 'Bereich markieren: kopieren, ausschneiden, als Vorlage speichern, Kollision setzen.'],
  ['stamp', '⌂', 'Gebäude', 'G', 'Vorlage aus „Gebäude“ platzieren (Klick = linke obere Ecke).'],
  ['deko', '❀', 'Deko', 'D', 'Grafik aus „Deko“ frei platzieren (Raster aus = pixelgenau).'],
  ['npc', '☺', 'Figur', 'N', 'Figur aus „Figuren“ platzieren, Gespräch in den Eigenschaften wählen.'],
  ['interakt', '!', 'Interaktion', 'I', 'Punkt, den der Wirt mit E benutzen kann (zeigt einen Text).'],
  ['spawn', '⚑', 'Startpunkt', 'S', 'Startpunkt „start“ für den Testlauf oder weitere benannte Punkte.'],
  ['collision', '⛔', 'Kollision', 'C', 'Links = fest, rechts = begehbar, Umschalt = zurücksetzen.'],
  ['zone', '▦', 'Zone', 'Z', 'Bereich ziehen: Baustelle (öffnet nach Glanz), Quest-Flag, gesperrt, reserviert. Klick wählt eine Zone.'],
];

let def: MapDef = MAP_DEFS.alley;
let map: MapData = clone(alleyFile as unknown as MapData);
let fileName = 'alley';
let tool: Tool = 'select';
let brush = ',';
let prefab: Prefab | null = null;
let template: { key: string; frame: number } = { key: 'lampPost', frame: 0 };
let selection = new Set<string>();
let selZone: string | null = null;
let tileSel: { x: number; y: number; w: number; h: number } | null = null;
let objClip: MapObject[] = [];
let customPrefabs: Prefab[] = [];
const view = { x: -24, y: -24, z: 2 };
const L = { boden: true, waende: true, objekte: true, figuren: true, deko: true, interaktion: true, zonen: true, kollision: false, raster: true, licht: false, pruefen: true };
const LAYER_NAMES: Record<keyof typeof L, string> = { boden: 'Boden', waende: 'Fassaden', objekte: 'Kachel-Objekte', figuren: 'Figuren', deko: 'Deko & Schilder', interaktion: 'Interaktion & Start', zonen: 'Zonen', kollision: 'Kollision', raster: 'Raster', licht: 'Spielansicht (Licht)', pruefen: 'Prüfmarken' };
let hover = { wx: 0, wy: 0, tx: 0, ty: 0 };
let spaceDown = false;

const undoStack: string[] = [];
const redoStack: string[] = [];
function remember() {
  undoStack.push(JSON.stringify(map));
  if (undoStack.length > 150) undoStack.shift();
  redoStack.length = 0;
}
function undo() {
  const s = undoStack.pop();
  if (!s) return;
  redoStack.push(JSON.stringify(map));
  map = JSON.parse(s);
  changed();
}
function redo() {
  const s = redoStack.pop();
  if (!s) return;
  undoStack.push(JSON.stringify(map));
  map = JSON.parse(s);
  changed();
}

let autosaveTimer = 0;
const autosaveKey = () => `harterkarter.editor.autosave.${fileName}`;
function changed() {
  map.collision ??= { block: [], free: [] };
  map.objects ??= [];
  map.zones ??= [];
  render();
  props();
  clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(autosaveKey(), JSON.stringify({ t: Date.now(), data: map }));
    } catch {
      /* voll: egal */
    }
  }, 500);
}

function msg(s: string, bad = false) {
  const m = $('msg');
  m.textContent = s;
  m.style.color = bad ? 'var(--bad)' : 'var(--ok)';
}

/** Dev-Server mit /__maps vorhanden? Im Artefakt bzw. Build nicht: dann nur Export/Import. */
const SERVER = import.meta.env.DEV;

/** Kleines Fenster im Editor statt prompt/confirm (die in eingebetteten Seiten blockiert sind). */
function modal(build: (box: HTMLElement, close: () => void) => void) {
  const back = document.createElement('div');
  back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:50';
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--panel);border:1px solid var(--accent);border-radius:6px;padding:14px;width:min(560px,92vw);display:flex;flex-direction:column;gap:8px';
  back.append(box);
  document.body.append(back);
  const close = () => back.remove();
  build(box, close);
}

function ask(title: string, value: string): Promise<string | null> {
  return new Promise((res) => modal((box, close) => {
    const i = document.createElement('input');
    i.value = value;
    const done = (v: string | null) => { close(); res(v); };
    i.onkeydown = (e) => { if (e.key === 'Enter') done(i.value); if (e.key === 'Escape') done(null); };
    const r = document.createElement('div');
    r.className = 'row';
    r.append(button('OK', () => done(i.value)), button('Abbrechen', () => done(null)));
    box.append(title, i, r);
    setTimeout(() => i.focus());
  }));
}

function confirmBox(text: string): Promise<boolean> {
  return new Promise((res) => modal((box, close) => {
    const r = document.createElement('div');
    r.className = 'row';
    r.append(button('Ja', () => { close(); res(true); }), button('Abbrechen', () => { close(); res(false); }));
    box.append(text, r);
  }));
}

/** Export: JSON zum Kopieren anzeigen (Downloads sind in eingebetteten Seiten gesperrt), im Dev-Server zusätzlich als Datei. */
async function exportDialog() {
  const json = JSON.stringify(map, null, 2);
  modal((box, close) => {
    const t = document.createElement('textarea');
    t.value = json;
    t.readOnly = true;
    t.style.cssText = 'height:50vh;font:12px monospace;background:var(--panel2);color:var(--text);border:1px solid var(--line)';
    const r = document.createElement('div');
    r.className = 'row';
    r.append(button('In Zwischenablage kopieren', () => {
      navigator.clipboard.writeText(json).then(() => msg('Kopiert. In src/maps/alley.json einfügen.'), () => { t.select(); msg('Text ist markiert: Strg+C drücken.'); });
    }));
    if (SERVER) r.append(button('Als Datei herunterladen', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = `${fileName}.json`;
      a.click();
    }));
    r.append(button('Schließen', close));
    box.append(`Karte als JSON. Ins Spiel übernehmen: Inhalt in src/maps/${map.id}.json ersetzen.`, t, r);
  });
}

/** Import: JSON einfügen oder Datei wählen. */
async function importDialog(pickFile: () => void) {
  modal((box, close) => {
    const t = document.createElement('textarea');
    t.placeholder = 'Karten-JSON hier einfügen …';
    t.style.cssText = 'height:40vh;font:12px monospace;background:var(--panel2);color:var(--text);border:1px solid var(--line)';
    const r = document.createElement('div');
    r.className = 'row';
    r.append(
      button('Übernehmen', () => {
        try {
          remember();
          loadData(JSON.parse(t.value), fileName);
          msg('Importiert (noch nicht gespeichert).');
          close();
        } catch {
          msg('Das ist kein gültiges Karten-JSON.', true);
        }
      }),
      button('Datei wählen …', () => { close(); pickFile(); }),
      button('Abbrechen', close),
    );
    box.append('Karte importieren', t, r);
  });
}

// ---------------------------------------------------------------- Karte bearbeiten

const W = () => Math.max(...map.rows.map((r) => r.length));
const H = () => map.rows.length;
const charAt = (x: number, y: number) => map.rows[y]?.[x] ?? def.empty;

function setTile(x: number, y: number, ch: string) {
  if (y < 0 || y >= H() || x < 0 || x >= W() || ch === ' ') return;
  const r = map.rows[y].padEnd(W(), def.empty);
  map.rows[y] = r.slice(0, x) + ch + r.slice(x + 1);
}

function fillRect(x0: number, y0: number, x1: number, y1: number, ch: string) {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) setTile(x, y, ch);
}

function addObject(o: Omit<MapObject, 'id'>) {
  const obj = { id: uid(), ...o } as MapObject;
  map.objects.push(obj);
  return obj;
}

function stamp(p: Prefab, tx: number, ty: number) {
  p.rows.forEach((row, dy) => [...row].forEach((ch, dx) => setTile(tx + dx, ty + dy, ch)));
  for (const o of p.objects ?? []) addObject({ ...clone(o), x: o.x + tx * T, y: o.y + ty * T });
  for (const z of p.zones ?? []) map.zones.push({ id: uid(), ...clone(z), x: z.x + tx, y: z.y + ty });
}

/** Karte erweitern. Oben/links verschiebt alles; origin merkt sich das, damit Spawns und feste Punkte im Spielcode mitwandern. */
function grow(top: number, bottom: number, left: number, right: number) {
  const w = W() + left + right;
  const fill = def.empty;
  map.rows = [
    ...Array.from({ length: top }, () => fill.repeat(w)),
    ...map.rows.map((r) => fill.repeat(left) + r.padEnd(W(), fill) + fill.repeat(right)),
    ...Array.from({ length: bottom }, () => fill.repeat(w)),
  ];
  if (top || left) {
    for (const o of map.objects) { o.x += left * T; o.y += top * T; }
    for (const z of map.zones) { z.x += left; z.y += top; }
    const sh = (k: string) => { const [x, y] = k.split(',').map(Number); return `${x + left},${y + top}`; };
    map.collision.block = map.collision.block.map(sh);
    map.collision.free = map.collision.free.map(sh);
    map.origin = { x: (map.origin?.x ?? 0) + left, y: (map.origin?.y ?? 0) + top };
    view.x += left * T;
    view.y += top * T;
  }
}

function objectsInTile(x: number, y: number) {
  return map.objects.filter((o) => Math.floor(o.x / T) === x && Math.floor((o.y - 1) / T) === y);
}

// ---------------------------------------------------------------- Zeichnen

const cv = $<HTMLCanvasElement>('view');
const ctx = cv.getContext('2d')!;
let drag: null | { mode: string; sx: number; sy: number; tx: number; ty: number; moved: boolean; starts?: Map<string, [number, number]> } = null;

function objBounds(o: MapObject): [number, number, number, number] {
  if (o.kind === 'deko' || o.kind === 'npc') {
    const i = img(o.key, o.frame ?? 0);
    const s = 0.5 * (o.scale ?? 1);
    const w = i ? i.sw * s : 12, h = i ? i.sh * s : 12;
    return [o.x - w / 2, o.y - h, w, h];
  }
  if (o.kind === 'schild') {
    const w = Math.max(16, (o.text ?? '').split('\n').reduce((m, l) => Math.max(m, l.length), 0) * 4 + 6) * (o.scale ?? 1);
    return [o.x - w / 2, o.y - 9, w, 9];
  }
  return [o.x - 6, o.y - 6, 12, 12];
}

function drawImg(i: Img | null, x: number, y: number, flip = false, scale = 1, alpha = 1) {
  if (!i) return;
  const w = (i.sw / 2) * scale, h = (i.sh / 2) * scale;
  ctx.globalAlpha = alpha;
  if (flip) {
    ctx.save();
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(i.src, i.sx, i.sy, i.sw, i.sh, 0, 0, w, h);
    ctx.restore();
  } else ctx.drawImage(i.src, i.sx, i.sy, i.sw, i.sh, x, y, w, h);
  ctx.globalAlpha = 1;
}

/** Figuren und Deko stehen mit den Füßen auf (x, y). */
function drawSprite(key: string | undefined, frame: number, x: number, y: number, scale = 1, flip = false, alpha = 1) {
  const i = img(key, frame);
  if (!i) return;
  drawImg(i, x - (i.sw / 4) * scale, y - (i.sh / 2) * scale, flip, scale, alpha);
}

function wallKey(d: TileDef, x: number, y: number) {
  const k = tileKey(d, x, y);
  const below = map.rows[y + 1]?.[x];
  const front = below !== undefined && !def.tiles[below]?.wall;
  const top = k.replace('Front', 'Top');
  return front || !exists(top) ? k : top;
}

function solidSet() {
  const s = new Set<string>();
  for (let y = 0; y < H(); y++) for (let x = 0; x < W(); x++) if (def.tiles[charAt(x, y)]?.solid) s.add(`${x},${y}`);
  for (const o of map.objects) if (o.solid) s.add(`${Math.floor(o.x / T)},${Math.floor((o.y - 2) / T)}`);
  map.collision.block.forEach((k) => s.add(k));
  map.collision.free.forEach((k) => s.delete(k));
  return s;
}

const ZONE_COLORS: Record<ZoneState, string> = { offen: '#7ac05a', baustelle: '#f0a020', quest: '#5a9ae0', gesperrt: '#e0403a', reserviert: '#888888' };

function render() {
  if (!game) return;
  cv.width = cv.clientWidth;
  cv.height = cv.clientHeight;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#050405';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(view.z, 0, 0, view.z, -view.x * view.z, -view.y * view.z);
  const x0 = Math.max(0, Math.floor(view.x / T)), y0 = Math.max(0, Math.floor(view.y / T));
  const x1 = Math.min(W() - 1, Math.ceil((view.x + cv.width / view.z) / T)), y1 = Math.min(H() - 1, Math.ceil((view.y + cv.height / view.z) / T));

  // Kacheln
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      // dieselbe Straßenansicht wie im Spiel (maps/streetView.ts)
      const c = streetCell(map.rows, def, x, y);
      if (c.building) {
        if (L.waende && c.key) drawImg(img(c.key), x * T, y * T);
        continue;
      }
      if (L.boden && c.floor) drawImg(img(c.floor), x * T, y * T);
      if (L.boden) for (const o of c.overlays) drawImg(img(o), x * T, y * T);
      if (c.key && (c.object ? L.objekte : L.boden)) drawImg(img(c.key), x * T, y * T);
    }
  // im Spiel eigens gezeichnete Kacheln (Laternen, Autos, Figuren)
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = def.tiles[charAt(x, y)];
      if (!d?.preview || !(d.group === 'Figuren & Spezial' ? L.figuren : L.objekte)) continue;
      if (d.preview === 'car') drawImg(img('car'), x * T, y * T + 15 - (img('car')?.sh ?? 0) / 2);
      else drawSprite(d.preview, 0, x * T + 8, y * T + 15);
    }

  // Objekte nach y sortiert
  const show = (o: MapObject) => (o.kind === 'deko' || o.kind === 'schild' ? L.deko : o.kind === 'npc' ? L.figuren : L.interaktion);
  for (const o of [...map.objects].filter(show).sort((a, b) => a.y - b.y)) {
    if (o.kind === 'deko' || o.kind === 'npc') drawSprite(o.key, o.frame ?? 0, o.x, o.y, o.scale ?? 1, o.flipX);
    else if (o.kind === 'schild') {
      const [bx, by, bw, bh] = objBounds(o);
      ctx.fillStyle = 'rgba(18,12,11,.85)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#f4ead0';
      ctx.font = `${4 * (o.scale ?? 1)}px "Press Start 2P"`;
      ctx.textAlign = 'center';
      ctx.fillText((o.text ?? '').split('\n')[0], o.x, o.y - 2.5);
    } else {
      ctx.fillStyle = o.kind === 'spawn' ? '#7ac05a' : '#f0c030';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#120c0b';
      ctx.font = '6px "Press Start 2P"';
      ctx.textAlign = 'center';
      ctx.fillText(o.kind === 'spawn' ? 'S' : '!', o.x + 0.5, o.y + 3);
    }
    if (o.bedingung) {
      ctx.fillStyle = '#5a9ae0';
      ctx.fillRect(o.x + 4, o.y - 4, 3, 3);
    }
  }

  // Spielansicht: Dunkelheit und Lichtkegel wie im Spiel
  if (L.licht) drawLighting();

  // Zonen
  // Baustellen wie im Spiel vor der Glanz-Mission: Bauzaun auf jeder gesperrten Kachel
  if (L.zonen)
    for (const z of map.zones.filter((zz) => zz.state === 'baustelle'))
      for (let ty = z.y; ty < z.y + z.h; ty++) for (let tx = z.x; tx < z.x + z.w; tx++) drawSprite('bauzaun', 0, tx * T + 8, (ty + 1) * T);
  if (L.zonen)
    for (const z of map.zones) {
      const c = ZONE_COLORS[z.state];
      ctx.globalAlpha = z.state === 'reserviert' ? 0.55 : 0.22;
      ctx.fillStyle = z.state === 'reserviert' ? '#000' : c;
      ctx.fillRect(z.x * T, z.y * T, z.w * T, z.h * T);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c;
      ctx.lineWidth = selZone === z.id ? 1.5 : 0.75;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(z.x * T + 0.5, z.y * T + 0.5, z.w * T - 1, z.h * T - 1);
      ctx.setLineDash([]);
      ctx.fillStyle = c;
      ctx.font = '4px "Press Start 2P"';
      ctx.textAlign = 'left';
      ctx.fillText(`${z.state.toUpperCase()}${z.state === 'quest' ? `: ${z.flag || '?'}` : ''}${z.label ? ` – ${z.label}` : ''}`, z.x * T + 2, z.y * T + 6);
    }

  // Kollision
  if (L.kollision) {
    const s = solidSet();
    ctx.fillStyle = 'rgba(224,64,58,.35)';
    for (const k of s) {
      const [x, y] = k.split(',').map(Number);
      ctx.fillRect(x * T, y * T, T, T);
    }
    ctx.lineWidth = 1;
    for (const [list, col] of [[map.collision.block, '#ff6050'], [map.collision.free, '#7ac05a']] as const)
      for (const k of list) {
        const [x, y] = k.split(',').map(Number);
        ctx.strokeStyle = col;
        ctx.strokeRect(x * T + 1, y * T + 1, T - 2, T - 2);
      }
  }

  // Raster und Kartenrand
  if (L.raster) {
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 1 / view.z;
    ctx.beginPath();
    for (let x = x0; x <= x1 + 1; x++) { ctx.moveTo(x * T, y0 * T); ctx.lineTo(x * T, (y1 + 1) * T); }
    for (let y = y0; y <= y1 + 1; y++) { ctx.moveTo(x0 * T, y * T); ctx.lineTo((x1 + 1) * T, y * T); }
    ctx.stroke();
  }
  ctx.strokeStyle = '#c9a24a';
  ctx.lineWidth = 1 / view.z;
  ctx.strokeRect(0, 0, W() * T, H() * T);

  // Prüfergebnis: nicht erreichbare Flächen schraffiert, Fehler als rote Markierung
  if (L.pruefen && checked) {
    ctx.strokeStyle = 'rgba(224,64,58,.55)';
    ctx.lineWidth = 1;
    for (const k of checked.unreachable) {
      const [x, y] = k.split(',').map(Number);
      ctx.beginPath(); ctx.moveTo(x * T, y * T + T); ctx.lineTo(x * T + T, y * T); ctx.stroke();
    }
    for (const i of checked.issues) {
      ctx.fillStyle = i.ernst ? '#e0403a' : '#f0a020';
      ctx.beginPath(); ctx.arc(i.x * T + 8, i.y * T + 8, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#120c0b'; ctx.font = '6px "Press Start 2P"'; ctx.textAlign = 'center';
      ctx.fillText('!', i.x * T + 8.5, i.y * T + 11);
    }
  }

  // Auswahl
  ctx.lineWidth = 1 / view.z;
  for (const o of map.objects)
    if (selection.has(o.id)) {
      const [bx, by, bw, bh] = objBounds(o);
      ctx.strokeStyle = '#f0c030';
      ctx.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);
    }
  if (tileSel) {
    ctx.strokeStyle = '#9ae0ff';
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(tileSel.x * T, tileSel.y * T, tileSel.w * T, tileSel.h * T);
    ctx.setLineDash([]);
  }

  // Vorschau unter dem Mauszeiger
  const d = drag;
  if (d && ['rect', 'line', 'region', 'zone', 'box'].includes(d.mode)) {
    const r = dragRect(d);
    ctx.strokeStyle = '#ffffff';
    ctx.setLineDash([2, 2]);
    if (d.mode === 'box') ctx.strokeRect(r.px, r.py, r.pw, r.ph);
    else ctx.strokeRect(r.x * T, r.y * T, r.w * T, r.h * T);
    ctx.setLineDash([]);
  } else if (tool === 'stamp' && prefab) {
    ctx.globalAlpha = 0.6;
    prefab.rows.forEach((row, dy) => [...row].forEach((ch, dx) => {
      const dd = def.tiles[ch];
      if (!dd) return;
      const k = dd.wall ? tileKey(dd, 0, 0) : tileKey(dd, 0, 0) || def.floor([ch], 0, 0);
      drawImg(img(k), (hover.tx + dx) * T, (hover.ty + dy) * T, false, 1, 0.6);
    }));
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#f0c030';
    ctx.strokeRect(hover.tx * T, hover.ty * T, Math.max(...prefab.rows.map((r) => r.length), 1) * T, Math.max(prefab.rows.length, 1) * T);
  } else if (tool === 'deko' || tool === 'npc') {
    const [px, py] = placePoint();
    drawSprite(template.key, template.frame, px, py, 1, false, 0.6);
  } else if (['brush', 'erase', 'collision', 'rect', 'line', 'region', 'zone'].includes(tool)) {
    ctx.strokeStyle = tool === 'erase' ? '#e0403a' : '#ffffff';
    ctx.strokeRect(hover.tx * T, hover.ty * T, T, T);
  }
}

function dragRect(d: NonNullable<typeof drag>) {
  let x0 = d.tx, y0 = d.ty, x1 = hover.tx, y1 = hover.ty;
  if (d.mode === 'line') {
    if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) y1 = y0;
    else x1 = x0;
  }
  return {
    x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0) + 1, h: Math.abs(y1 - y0) + 1,
    px: Math.min(d.sx, hover.wx), py: Math.min(d.sy, hover.wy), pw: Math.abs(hover.wx - d.sx), ph: Math.abs(hover.wy - d.sy),
  };
}

const snapOn = () => $<HTMLInputElement>('snap').checked;
function placePoint(): [number, number] {
  if (!snapOn()) return [Math.round(hover.wx), Math.round(hover.wy)];
  return [hover.tx * T + 8, hover.ty * T + 15];
}

// ---------------------------------------------------------------- Spielansicht und Prüfung

let lightCanvas: HTMLCanvasElement | null = null;
const rgba = (tint: number, a: number) => `rgba(${(tint >> 16) & 255},${(tint >> 8) & 255},${tint & 255},${a})`;

/** Dunkelheit und Lichtkegel nach denselben Lichtquellen und Werten wie im Spiel (TopDown.drawLights). */
function drawLighting() {
  const w = W() * T, h = H() * T;
  lightCanvas ??= document.createElement('canvas');
  const off = lightCanvas;
  if (off.width !== w || off.height !== h) { off.width = w; off.height = h; }
  const g = off.getContext('2d')!;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  g.fillStyle = `rgba(10,6,18,${def.dunkel})`;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out';
  const lights = streetLights(map.rows, def);
  for (const l of lights) {
    if (!l.pool) continue;
    const rad = 64 * l.scale * 1.15, a = Math.min(1, l.alpha * 1.25);
    const gr = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, rad);
    gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.45, `rgba(0,0,0,${a * 0.75})`); gr.addColorStop(0.8, `rgba(0,0,0,${a * 0.2})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(l.x - rad, l.y - rad, rad * 2, rad * 2);
  }
  ctx.drawImage(off, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const rad = 64 * l.scale;
    const gr = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, rad);
    gr.addColorStop(0, rgba(l.tint, 0.42 * l.alpha)); gr.addColorStop(0.35, rgba(l.tint, 0.18 * l.alpha)); gr.addColorStop(1, rgba(l.tint, 0));
    ctx.fillStyle = gr;
    ctx.fillRect(l.x - rad, l.y - rad, rad * 2, rad * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}

interface Issue { x: number; y: number; text: string; ernst: boolean }
let checked: { issues: Issue[]; unreachable: string[] } | null = null;

/**
 * Prüft, was im Spiel schiefgehen würde: nicht erreichbare Eingänge und Figuren, doppelte Türen,
 * Objekte, die hinter dem Gesims (auf Dachflächen) liegen, begehbare Flächen ohne Zugang.
 * Erreichbarkeit wie nach der Glanz-Mission: Baustellen offen, andere gesperrte Zonen zu.
 */
function runCheck() {
  const issues: Issue[] = [];
  const solid = solidSet();
  for (const z of map.zones) if (z.state !== 'offen' && z.state !== 'baustelle') for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) solid.add(`${x},${y}`);
  const start = map.objects.find((o) => o.kind === 'spawn' && (o.label ?? 'start') === 'start');
  const sx = start ? Math.floor(start.x / T) : 17 + (map.origin?.x ?? 0);
  const sy = start ? Math.floor((start.y - 2) / T) : 18 + (map.origin?.y ?? 0);
  if (!start) issues.push({ x: sx, y: sy, text: 'Kein Startpunkt „start“: geprüft ab dem Eingang der Kneipe.', ernst: false });
  const seen = new Set<string>();
  const queue: [number, number][] = [[sx, sy]];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    const k = `${x},${y}`;
    if (x < 0 || y < 0 || x >= W() || y >= H() || seen.has(k) || solid.has(k)) continue;
    seen.add(k);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const NAMEN: Record<string, string> = def.id === 'kanal' ? { L: 'Leiter zum Gully' } : { D: 'Kneipentür', Q: 'Hintertür der Kneipe', U: 'Eingang Feinkostladen', A: 'Kippenautomat' };
  const anzahl: Record<string, number> = {};
  for (let y = 0; y < H(); y++)
    for (let x = 0; x < W(); x++) {
      const ch = charAt(x, y);
      if (!NAMEN[ch]) continue;
      anzahl[ch] = (anzahl[ch] ?? 0) + 1;
      if (anzahl[ch] === 2) issues.push({ x, y, text: `${NAMEN[ch]} kommt mehrfach vor: das Spiel benutzt nur die erste.`, ernst: true });
      const [ax, ay] = ch === 'Q' ? [x, y - 1] : [x, y + 1];
      if (!seen.has(`${ax},${ay}`)) issues.push({ x, y, text: `${NAMEN[ch]} ist nicht erreichbar (davor fest oder abgeschnitten).`, ernst: true });
    }
  for (const ch of Object.keys(NAMEN)) if (!anzahl[ch]) issues.push({ x: sx, y: sy, text: `${NAMEN[ch]} fehlt auf der Karte.`, ernst: true });
  for (const o of map.objects) {
    const tx = Math.floor(o.x / T), ty = Math.floor((o.y - 2) / T);
    const c = streetCell(map.rows, def, tx, ty);
    if ((o.kind === 'deko' || o.kind === 'schild' || o.kind === 'npc') && ['void', 'backEdge', 'backDoorTop'].includes(c.key ?? ''))
      issues.push({ x: tx, y: ty, text: `„${o.key ?? o.text ?? o.kind}“ liegt hinter dem Gesims (Dachfläche): im Spiel schwebt es im Dunkeln.`, ernst: false });
    if (o.kind === 'npc' || o.kind === 'interaktion') {
      const near = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(`${tx + dx},${ty + dy}`));
      if (!near) issues.push({ x: tx, y: ty, text: `${o.kind === 'npc' ? 'Figur' : 'Interaktion'} „${o.label ?? o.key ?? ''}“ ist nicht erreichbar.`, ernst: true });
    }
  }
  const unreachable: string[] = [];
  for (let y = 0; y < H(); y++) for (let x = 0; x < W(); x++) { const k = `${x},${y}`; if (!solid.has(k) && !seen.has(k)) unreachable.push(k); }
  if (unreachable.length) {
    const [x, y] = unreachable[0].split(',').map(Number);
    issues.push({ x, y, text: `${unreachable.length} begehbare Kacheln sind vom Start aus nicht erreichbar (schraffiert).`, ernst: false });
  }
  checked = { issues, unreachable };
  L.pruefen = true;
  layersUi();
  showIssues();
  render();
}

function showIssues() {
  const body = $('propsBody');
  body.innerHTML = '';
  body.className = '';
  if (!checked) return;
  body.append(checked.issues.length ? `${checked.issues.length} Hinweis(e):` : 'Keine Probleme gefunden.');
  for (const i of checked.issues) {
    const b = button(`${i.ernst ? '⛔' : '⚠'} ${i.text}`, () => {
      view.x = i.x * T + 8 - cv.width / view.z / 2;
      view.y = i.y * T + 8 - cv.height / view.z / 2;
      render();
    });
    b.style.cssText = 'display:block;width:100%;text-align:left;margin-top:4px;white-space:normal';
    body.append(b);
  }
}

// ---------------------------------------------------------------- Maus und Tastatur

function hitObject(wx: number, wy: number) {
  const list = [...map.objects].sort((a, b) => b.y - a.y);
  return list.find((o) => {
    const [bx, by, bw, bh] = objBounds(o);
    return wx >= bx && wx <= bx + bw && wy >= by && wy <= by + bh;
  });
}
const zoneAt = (tx: number, ty: number) => [...map.zones].reverse().find((z) => tx >= z.x && tx < z.x + z.w && ty >= z.y && ty < z.y + z.h);

function updateHover(e: MouseEvent) {
  const r = cv.getBoundingClientRect();
  hover.wx = (e.clientX - r.left) / view.z + view.x;
  hover.wy = (e.clientY - r.top) / view.z + view.y;
  hover.tx = Math.floor(hover.wx / T);
  hover.ty = Math.floor(hover.wy / T);
  const ch = charAt(hover.tx, hover.ty);
  $('pos').textContent = `Kachel ${hover.tx}, ${hover.ty}  ·  „${ch}“ ${def.tiles[ch]?.label ?? ''}`;
}

cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  updateHover(e);
  const z = Math.min(8, Math.max(0.5, view.z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
  const r = cv.getBoundingClientRect();
  view.x = hover.wx - (e.clientX - r.left) / z;
  view.y = hover.wy - (e.clientY - r.top) / z;
  view.z = z;
  render();
}, { passive: false });

cv.addEventListener('mousedown', (e) => {
  updateHover(e);
  const base = { sx: hover.wx, sy: hover.wy, tx: hover.tx, ty: hover.ty, moved: false };
  if (e.button === 1 || (e.button === 0 && spaceDown) || (e.button === 2 && tool !== 'collision')) {
    drag = { mode: 'pan', ...base, sx: e.clientX, sy: e.clientY };
    return;
  }
  const { tx, ty } = hover;
  switch (tool) {
    case 'select': {
      const o = hitObject(hover.wx, hover.wy);
      if (o) {
        if (e.shiftKey) { if (selection.has(o.id)) selection.delete(o.id); else selection.add(o.id); }
        else if (!selection.has(o.id)) selection = new Set([o.id]);
        selZone = null;
        remember();
        drag = { mode: 'move', ...base, starts: new Map(map.objects.filter((x) => selection.has(x.id)).map((x) => [x.id, [x.x, x.y]])) };
      } else {
        if (!e.shiftKey) selection.clear();
        const z = L.zonen ? zoneAt(tx, ty) : undefined;
        selZone = z?.id ?? null;
        drag = { mode: 'box', ...base };
      }
      break;
    }
    case 'brush': remember(); setTile(tx, ty, brush); drag = { mode: 'paint', ...base }; break;
    case 'erase':
      remember();
      setTile(tx, ty, def.empty);
      map.objects = map.objects.filter((o) => !objectsInTile(tx, ty).includes(o));
      drag = { mode: 'erase', ...base };
      break;
    case 'rect': case 'line': case 'region': drag = { mode: tool, ...base }; break;
    case 'zone': {
      const z = zoneAt(tx, ty);
      if (z && !e.shiftKey) { selZone = z.id; selection.clear(); props(); render(); return; }
      drag = { mode: 'zone', ...base };
      break;
    }
    case 'stamp':
      if (!prefab) return msg('Erst eine Vorlage unter „Gebäude“ wählen.', true);
      remember();
      stamp(prefab, tx, ty);
      break;
    case 'deko': case 'npc': {
      remember();
      const [x, y] = placePoint();
      const o = addObject({ kind: tool as ObjectKind, key: template.key, frame: template.frame, x, y, ...(tool === 'npc' ? {} : {}) });
      selection = new Set([o.id]);
      break;
    }
    case 'interakt': {
      // Beschriftung und Text danach rechts in den Eigenschaften eintragen
      remember();
      const [x, y] = placePoint();
      selection = new Set([addObject({ kind: 'interaktion', x, y: y - 7, label: 'Ansehen', text: '' }).id]);
      msg('Interaktion gesetzt: Beschriftung und Text rechts eintragen.');
      break;
    }
    case 'spawn': {
      const n = map.objects.filter((o) => o.kind === 'spawn').length;
      const name = map.objects.some((o) => o.kind === 'spawn' && (o.label ?? 'start') === 'start') ? `punkt-${n + 1}` : 'start';
      remember();
      const [x, y] = placePoint();
      selection = new Set([addObject({ kind: 'spawn', x, y, label: name }).id]);
      break;
    }
    case 'collision': {
      remember();
      collide(tx, ty, e.shiftKey ? 'reset' : e.button === 2 ? 'free' : 'block');
      drag = { mode: e.shiftKey ? 'c-reset' : e.button === 2 ? 'c-free' : 'c-block', ...base };
      break;
    }
  }
  changed();
});

function collide(x: number, y: number, how: 'block' | 'free' | 'reset') {
  const k = `${x},${y}`;
  map.collision.block = map.collision.block.filter((v) => v !== k);
  map.collision.free = map.collision.free.filter((v) => v !== k);
  if (how === 'block') map.collision.block.push(k);
  if (how === 'free') map.collision.free.push(k);
}

window.addEventListener('mousemove', (e) => {
  const prev = { tx: hover.tx, ty: hover.ty };
  updateHover(e);
  const d = drag;
  if (!d) return render();
  if (d.mode === 'pan') {
    view.x -= (e.clientX - d.sx) / view.z;
    view.y -= (e.clientY - d.sy) / view.z;
    d.sx = e.clientX;
    d.sy = e.clientY;
  } else if (d.mode === 'move' && d.starts) {
    let dx = hover.wx - d.sx, dy = hover.wy - d.sy;
    if (snapOn()) { dx = Math.round(dx / 8) * 8; dy = Math.round(dy / 8) * 8; }
    for (const o of map.objects) {
      const s = d.starts.get(o.id);
      if (s) { o.x = Math.round(s[0] + dx); o.y = Math.round(s[1] + dy); }
    }
  } else if (prev.tx !== hover.tx || prev.ty !== hover.ty) {
    if (d.mode === 'paint') setTile(hover.tx, hover.ty, brush);
    if (d.mode === 'erase') {
      setTile(hover.tx, hover.ty, def.empty);
      map.objects = map.objects.filter((o) => !objectsInTile(hover.tx, hover.ty).includes(o));
    }
    if (d.mode.startsWith('c-')) collide(hover.tx, hover.ty, d.mode.slice(2) as 'block' | 'free' | 'reset');
  }
  d.moved = true;
  render();
});

window.addEventListener('mouseup', () => {
  const d = drag;
  drag = null;
  if (!d) return;
  if (d.mode === 'rect' || d.mode === 'line') {
    remember();
    const r = dragRect(d);
    fillRect(r.x, r.y, r.x + r.w - 1, r.y + r.h - 1, brush);
  } else if (d.mode === 'region') {
    const r = dragRect(d);
    tileSel = { x: r.x, y: r.y, w: r.w, h: r.h };
  } else if (d.mode === 'zone') {
    const r = dragRect(d);
    remember();
    const z: MapZone = { id: uid(), x: r.x, y: r.y, w: r.w, h: r.h, state: 'baustelle' };
    map.zones.push(z);
    selZone = z.id;
  } else if (d.mode === 'box' && d.moved) {
    const r = dragRect(d);
    for (const o of map.objects) if (o.x >= r.px && o.x <= r.px + r.pw && o.y >= r.py && o.y <= r.py + r.ph) selection.add(o.id);
  } else if (d.mode === 'move' && !d.moved) undoStack.pop(); // nur angeklickt
  changed();
});

window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input, select, textarea')) return;
  const k = e.key.toLowerCase();
  if (e.key === ' ') { spaceDown = true; e.preventDefault(); return; }
  if (e.ctrlKey || e.metaKey) {
    if (k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
    if (k === 'y') { e.preventDefault(); return redo(); }
    if (k === 's') { e.preventDefault(); return void save(); }
    if (k === 'c') { objClip = clone(map.objects.filter((o) => selection.has(o.id))); return msg(`${objClip.length} Objekt(e) kopiert.`); }
    if (k === 'v' && objClip.length) {
      remember();
      selection = new Set(objClip.map((o) => addObject({ ...clone(o), x: o.x + T, y: o.y + T }).id));
      objClip = clone(map.objects.filter((o) => selection.has(o.id)));
      return changed();
    }
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (!selection.size && !selZone) return;
    remember();
    map.objects = map.objects.filter((o) => !selection.has(o.id));
    map.zones = map.zones.filter((z) => z.id !== selZone);
    selection.clear();
    selZone = null;
    return changed();
  }
  if (e.key === 'Escape') { selection.clear(); selZone = null; tileSel = null; return changed(); }
  const t = TOOLS.find((x) => x[3].toLowerCase() === k);
  if (t) setTool(t[0]);
});
window.addEventListener('keyup', (e) => { if (e.key === ' ') spaceDown = false; });
window.addEventListener('resize', () => render());

// ---------------------------------------------------------------- Werkzeugleiste, Bibliothek, Eigenschaften

function setTool(t: Tool) {
  tool = t;
  document.querySelectorAll<HTMLButtonElement>('#tools button').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  const info = TOOLS.find((x) => x[0] === t)!;
  $('toolHint').textContent = `${info[2]}: ${info[4]}`;
  if (t === 'collision') { L.kollision = true; layersUi(); }
  props();
  render();
}

function buildTools() {
  const nav = $('tools');
  for (const [id, icon, name, key] of TOOLS) {
    const b = document.createElement('button');
    b.textContent = icon;
    b.title = `${name} (${key})`;
    b.dataset.tool = id;
    b.onclick = () => setTool(id);
    nav.append(b);
  }
}

type Tab = 'Kacheln' | 'Gebäude' | 'Deko' | 'Figuren';
let tab: Tab = 'Kacheln';
const FIGUREN = ['wirt', 'penner', 'cat', 'dealer', 'polizist', 'leonard', 'kevin', 'claudius', 'dame0', 'dame1', 'lilySit', 'bornaSit', 'lilyWalk', 'leni', 'maya', 'anne', 'mutant'];
const SKIP = /^(bust|nbust|gbust|cs|ach_|icon_|__)|^(tresenBg|counterFront|light|chunk|bubble)$/;

function thumb(i: Img | null, w = 56, h = 44) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  if (i) {
    const s = Math.min(w / i.sw, h / i.sh, 2);
    g.drawImage(i.src, i.sx, i.sy, i.sw, i.sh, (w - i.sw * s) / 2, (h - i.sh * s) / 2, i.sw * s, i.sh * s);
  }
  return c;
}

function prefabThumb(p: Prefab) {
  const pw = Math.max(1, ...p.rows.map((r) => r.length)), ph = Math.max(1, p.rows.length);
  const c = document.createElement('canvas');
  c.width = pw * T;
  c.height = ph * T;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  p.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (!def.tiles[ch]) return;
    const c = streetCell(p.rows, def, x, y);
    for (const k of [c.floor, c.key]) {
      const i = img(k);
      if (i) g.drawImage(i.src, i.sx, i.sy, i.sw, i.sh, x * T, y * T, T, T);
    }
  }));
  for (const z of p.zones ?? []) { g.strokeStyle = ZONE_COLORS[z.state]; g.strokeRect(z.x * T + 1, z.y * T + 1, z.w * T - 2, z.h * T - 2); }
  const out = thumb({ src: c, sx: 0, sy: 0, sw: c.width, sh: c.height }, 130, 60);
  return out;
}

function item(label: string, canvas: HTMLCanvasElement, on: boolean, pick: () => void, wide = false) {
  const el = document.createElement('div');
  el.className = `item${on ? ' on' : ''}${wide ? ' wide' : ''}`;
  el.title = label;
  el.append(canvas, label.length > 22 ? `${label.slice(0, 21)}…` : label);
  el.onclick = () => { pick(); library(); };
  return el;
}

function library() {
  const lib = $('library');
  lib.innerHTML = '';
  const q = $<HTMLInputElement>('search').value.trim().toLowerCase();
  const match = (s: string) => !q || s.toLowerCase().includes(q);
  const head = (s: string) => { const h = document.createElement('div'); h.className = 'group'; h.textContent = s; lib.append(h); };
  if (tab === 'Kacheln') {
    let group = '';
    for (const [ch, d] of Object.entries(def.tiles)) {
      if (!match(d.label + ch)) continue;
      if (d.group !== group) head((group = d.group));
      const k = d.preview ?? (tileKey(d, 1, 1) || def.floor([ch], 0, 0));
      lib.append(item(`${d.label} (${ch})`, thumb(img(k)), brush === ch, () => { brush = ch; if (!['brush', 'rect', 'line'].includes(tool)) setTool('brush'); }));
    }
  } else if (tab === 'Gebäude') {
    const all = [...eingebaut(map), ...customPrefabs];
    let shownCustom = false;
    head('Vorlagen');
    for (const p of all) {
      if (!match(p.name)) continue;
      if (p.eigen && !shownCustom) { head('Eigene Vorlagen'); shownCustom = true; }
      lib.append(item(p.name, prefabThumb(p), prefab?.name === p.name, () => { prefab = p; setTool('stamp'); if (p.hinweis) msg(p.hinweis); }, true));
    }
  } else {
    const figur = tab === 'Figuren';
    const keys = game.textures.getTextureKeys().filter((k) => !SKIP.test(k) && FIGUREN.includes(k) === figur && match(k)).sort();
    for (const k of keys) {
      const t = game.textures.get(k);
      const frames = t.getFrameNames().filter((f) => f !== '__BASE');
      const fr = frames.length ? Number(frames[0]) || 0 : 0;
      const i = img(k, fr);
      if (!i || (!figur && (i.sw > 400 || i.sh > 400))) continue;
      lib.append(item(k, thumb(i), template.key === k, () => { template = { key: k, frame: fr }; setTool(figur ? 'npc' : 'deko'); }));
    }
  }
}

function buildTabs() {
  const el = $('tabs');
  el.innerHTML = '';
  for (const t of ['Kacheln', 'Gebäude', 'Deko', 'Figuren'] as Tab[]) {
    const b = document.createElement('button');
    b.textContent = t;
    b.classList.toggle('on', t === tab);
    b.onclick = () => { tab = t; buildTabs(); library(); };
    el.append(b);
  }
}

function layersUi() {
  const el = $('layers');
  el.innerHTML = '';
  for (const k of Object.keys(L) as (keyof typeof L)[]) {
    const lab = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = L[k];
    cb.onchange = () => { L[k] = cb.checked; render(); };
    lab.append(cb, ` ${LAYER_NAMES[k]}`);
    el.append(lab);
  }
}

function row(label: string, input: Node) {
  const r = document.createElement('div');
  r.className = 'row';
  const l = document.createElement('label');
  l.textContent = label;
  r.append(l, input);
  return r;
}
function input(value: string | number, onChange: (v: string) => void, type = 'text') {
  const i = document.createElement('input');
  i.type = type;
  i.value = String(value);
  if (type === 'number') i.step = 'any';
  i.onchange = () => { remember(); onChange(i.value); changed(); };
  return i;
}
function select(options: [string, string][], value: string, onChange: (v: string) => void) {
  const s = document.createElement('select');
  for (const [v, t] of options) s.add(new Option(t, v, false, v === value));
  s.onchange = () => { remember(); onChange(s.value); changed(); };
  return s;
}
function check(value: boolean, onChange: (v: boolean) => void) {
  const c = document.createElement('input');
  c.type = 'checkbox';
  c.checked = value;
  c.onchange = () => { remember(); onChange(c.checked); changed(); };
  return c;
}
function button(text: string, act: () => void) {
  const b = document.createElement('button');
  b.textContent = text;
  b.onclick = act;
  return b;
}

const EBENEN: [string, string][] = [['normal', 'Normal (nach Tiefe)'], ['boden', 'Boden (unter allem)'], ['vorne', 'Vordergrund (über allem)']];
const BEDINGUNG_HILFE = 'Story-Flag, z. B. glanzErledigt oder kevinFlucht; mit ! davor: nur solange es fehlt';

function props() {
  const body = $('propsBody');
  body.innerHTML = '';
  body.className = '';
  const sel = map.objects.filter((o) => selection.has(o.id));
  const zone = map.zones.find((z) => z.id === selZone);
  if (sel.length === 1) {
    const o = sel[0];
    body.append(row('Typ', document.createTextNode(o.kind)));
    if (o.kind === 'deko' || o.kind === 'npc') {
      body.append(row('Grafik', input(o.key ?? '', (v) => (o.key = v))));
      body.append(row('Bild Nr.', input(o.frame ?? 0, (v) => (o.frame = Number(v) || 0), 'number')));
      body.append(row('Größe', input(o.scale ?? 1, (v) => (o.scale = Number(v) || 1), 'number')));
      body.append(row('Gespiegelt', check(!!o.flipX, (v) => (o.flipX = v))));
      body.append(row('Fest', check(!!o.solid, (v) => (o.solid = v))));
      body.append(row('Ebene', select(EBENEN, o.ebene ?? 'normal', (v) => (o.ebene = v as MapObject['ebene']))));
    }
    if (o.kind === 'npc') {
      const opts: [string, string][] = [['', '– kein Gespräch –'], ...Object.entries(SPEAKERS).map(([k, s]) => [k, `${s.name} (${k})`] as [string, string])];
      body.append(row('Gespräch', select(opts, o.talk ?? '', (v) => (o.talk = v || undefined))));
      body.append(row('Beschriftung', input(o.label ?? '', (v) => (o.label = v || undefined))));
    }
    if (o.kind === 'schild') {
      body.append(row('Text', input(o.text ?? '', (v) => (o.text = v))));
      body.append(row('Größe', input(o.scale ?? 1, (v) => (o.scale = Number(v) || 1), 'number')));
    }
    if (o.kind === 'interaktion' || o.kind === 'spawn') body.append(row(o.kind === 'spawn' ? 'Name' : 'Beschriftung', input(o.label ?? '', (v) => (o.label = v))));
    if (o.kind === 'interaktion') body.append(row('Text', input(o.text ?? '', (v) => (o.text = v))));
    const b = input(o.bedingung ?? '', (v) => (o.bedingung = v.trim() || undefined));
    b.title = BEDINGUNG_HILFE;
    b.placeholder = 'immer';
    body.append(row('Nur wenn', b));
    body.append(row('Position', document.createTextNode(`${o.x}, ${o.y}`)));
    body.append(button('Löschen', () => { remember(); map.objects = map.objects.filter((x) => x !== o); selection.clear(); changed(); }));
  } else if (sel.length > 1) {
    body.append(`${sel.length} Objekte ausgewählt. Ziehen verschiebt alle. `);
    body.append(button('Alle löschen', () => { remember(); map.objects = map.objects.filter((x) => !selection.has(x.id)); selection.clear(); changed(); }));
  } else if (zone) {
    const states: [string, string][] = [['baustelle', 'Baustelle (offen nach Glanz-Mission)'], ['quest', 'Gesperrt bis Story-Flag'], ['gesperrt', 'Dauerhaft gesperrt'], ['reserviert', 'Reserviert (schwarz)'], ['offen', 'Offen']];
    body.append(row('Zustand', select(states, zone.state, (v) => (zone.state = v as ZoneState))));
    if (zone.state === 'quest') {
      const f = input(zone.flag ?? '', (v) => (zone.flag = v.trim()));
      f.title = BEDINGUNG_HILFE;
      body.append(row('Story-Flag', f));
    }
    body.append(row('Beschriftung', input(zone.label ?? '', (v) => (zone.label = v || undefined))));
    body.append(row('Größe', document.createTextNode(`${zone.w} × ${zone.h} Kacheln bei ${zone.x}, ${zone.y}`)));
    body.append(button('Zone löschen', () => { remember(); map.zones = map.zones.filter((z) => z !== zone); selZone = null; changed(); }));
  } else if (tool === 'region' && tileSel) {
    const s = tileSel;
    const asPrefab = (): Prefab => ({
      name: 'Zwischenablage',
      rows: ausschnitt(map.rows, s.x, s.y, s.w, s.h),
      objects: map.objects.filter((o) => o.x >= s.x * T && o.x < (s.x + s.w) * T && o.y > s.y * T && o.y <= (s.y + s.h) * T)
        .map(({ id: _id, ...o }) => ({ ...o, x: o.x - s.x * T, y: o.y - s.y * T })),
    });
    const clear = () => {
      fillRect(s.x, s.y, s.x + s.w - 1, s.y + s.h - 1, def.empty);
      const inside = asPrefab().objects!.length;
      if (inside) map.objects = map.objects.filter((o) => !(o.x >= s.x * T && o.x < (s.x + s.w) * T && o.y > s.y * T && o.y <= (s.y + s.h) * T));
    };
    body.append(`${s.w} × ${s.h} Kacheln markiert.`);
    const r = document.createElement('div');
    r.className = 'row';
    r.append(
      button('Kopieren', () => { prefab = asPrefab(); setTool('stamp'); msg('Kopiert: mit dem Gebäude-Werkzeug einsetzen.'); }),
      button('Ausschneiden', () => { remember(); prefab = asPrefab(); clear(); tileSel = null; setTool('stamp'); changed(); msg('Ausgeschnitten: Klick setzt den Bereich neu ein.'); }),
      button('Leeren', () => { remember(); clear(); changed(); }),
      button('Fest', () => { remember(); for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) collide(x, y, 'block'); changed(); }),
      button('Begehbar', () => { remember(); for (let y = s.y; y < s.y + s.h; y++) for (let x = s.x; x < s.x + s.w; x++) collide(x, y, 'free'); changed(); }),
      button('Als Vorlage speichern', async () => {
        const name = await ask('Name der Vorlage:', '');
        if (!name) return;
        customPrefabs = customPrefabs.filter((p) => p.name !== name);
        customPrefabs.push({ ...asPrefab(), name, eigen: true });
        void savePrefabs();
        tab = 'Gebäude';
        buildTabs();
        library();
      }),
    );
    body.append(r);
  } else {
    body.className = 'hint';
    const t = TOOLS.find((x) => x[0] === tool)!;
    body.textContent = tool === 'brush' || tool === 'rect' || tool === 'line'
      ? `Kachel: „${brush}“ ${def.tiles[brush]?.label ?? ''}. ${t[4]}`
      : t[4];
  }
}

// ---------------------------------------------------------------- Speichern, Laden, Testen

async function api(path: string, body?: unknown) {
  const r = await fetch(`/__maps${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? r.statusText);
  return r.json();
}

function loadData(data: MapData, name: string) {
  if (!Array.isArray(data?.rows)) return msg('Keine gültige Karte.', true);
  map = clone(data);
  fileName = name;
  selection.clear();
  selZone = null;
  tileSel = null;
  undoStack.length = redoStack.length = 0;
  changed();
  document.title = `Map-Editor – ${name}`;
}

async function save() {
  if (!(await confirmBox(`„src/maps/${fileName}.json“ überschreiben? Die bisherige Fassung wird vorher in src/maps/backups gesichert.`))) return;
  try {
    const r = await api(`/${fileName}`, map);
    msg(`Gespeichert in src/maps/${fileName}.json${r.backup ? ` · Sicherung: ${r.backup}` : ''}`);
    localStorage.removeItem(autosaveKey());
  } catch (err) {
    msg(`Speichern fehlgeschlagen (läuft der Dev-Server? npm run dev): ${(err as Error).message}. Notfalls „Export“ nutzen.`, true);
  }
}

async function saveAs() {
  const name = await ask('Name der Kopie (a–z, 0–9, - und _):', `${fileName}-kopie`);
  if (!name) return;
  if (!/^[a-z0-9_-]{1,32}$/.test(name)) return msg('Ungültiger Name.', true);
  if (MAP_DEFS[name]) return msg('Dieser Name gehört einer Spielkarte. Zum Überschreiben „Speichern“ nutzen.', true);
  try {
    await api(`/${name}`, map);
    fileName = name;
    msg(`Kopie gespeichert: src/maps/${name}.json (das Spiel lädt weiterhin ${map.id}.json)`);
  } catch (err) {
    msg(`Fehler: ${(err as Error).message}`, true);
  }
}

async function openDialog() {
  const body = $('propsBody');
  body.innerHTML = '';
  body.className = '';
  try {
    const list = (await api('')) as { maps: string[]; backups: string[] };
    body.append('Karten im Projekt:');
    for (const m of list.maps.filter((x) => x !== 'prefabs')) body.append(row('', button(`${m}.json`, async () => loadData(await api(`/${m}`), m))));
    body.append('Sicherungen (neueste zuerst; Speichern schreibt in die Original-Datei):');
    for (const b of list.backups.slice(0, 30)) {
      const target = b.replace(/-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/, '');
      body.append(row('', button(b, async () => { loadData(await api(`/backups/${b}`), target); msg(`Sicherung ${b} geladen (noch nicht gespeichert).`); })));
    }
  } catch (err) {
    msg(`Liste nicht abrufbar: ${(err as Error).message}`, true);
  }
}

async function savePrefabs() {
  try {
    localStorage.setItem('harterkarter.editor.prefabs', JSON.stringify(customPrefabs));
    await api('/prefabs', { prefabs: customPrefabs });
    msg('Vorlage gespeichert (src/maps/prefabs.json).');
  } catch {
    msg(SERVER ? 'Vorlage nur im Browser gespeichert (Dev-Server nicht erreichbar).' : 'Vorlage in diesem Browser gespeichert.', SERVER);
  }
}

function testRun() {
  localStorage.setItem(TEST_KEY, JSON.stringify(map));
  const frei = $<HTMLInputElement>('testFrei').checked ? '&frei=1' : '';
  window.open(`/?testmap=1${frei}`, 'harterkarter-test');
  msg('Testversion geöffnet. Erneut „Testen“ lädt den Test-Tab mit dem neuen Stand neu.');
}

function wireHeader() {
  const sel = $<HTMLSelectElement>('mapSelect');
  for (const d of Object.values(MAP_DEFS)) sel.add(new Option(d.name, d.id));
  sel.onchange = async () => { def = MAP_DEFS[sel.value]; loadData(await api(`/${sel.value}`).catch(() => map), sel.value); library(); };
  $('undo').onclick = undo;
  $('redo').onclick = redo;
  $('save').onclick = () => void save();
  $('saveAs').onclick = () => void saveAs();
  $('open').onclick = () => void openDialog();
  $('test').onclick = testRun;
  $('export').onclick = () => void exportDialog();
  const file = $<HTMLInputElement>('file');
  $('import').onclick = () => void importDialog(() => file.click());
  // Als Artefakt (ohne Dev-Server): kein Speichern ins Projekt, kein Testlauf; Export/Import und Autosave im Browser
  if (!SERVER) for (const id of ['save', 'saveAs', 'open', 'test']) $(id).style.display = 'none';
  if (!SERVER) ($('testFrei').parentElement as HTMLElement).style.display = 'none';
  file.onchange = async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      loadData(JSON.parse(await f.text()), fileName);
      msg(`${f.name} importiert (noch nicht gespeichert).`);
    } catch {
      msg('Datei ist kein gültiges JSON.', true);
    }
    file.value = '';
  };
  $('grow').onclick = async () => {
    const v = await ask('Wie viele Kacheln anfügen? oben, unten, links, rechts (z. B. 0,6,0,10)', '0,4,0,4');
    if (!v) return;
    const [t, b, l, r] = v.split(',').map((n) => Math.max(0, Math.min(200, parseInt(n, 10) || 0)));
    remember();
    grow(t, b, l, r);
    changed();
    msg(`Karte ist jetzt ${W()} × ${H()} Kacheln.`);
  };
  $('search').oninput = () => library();
  $('check').onclick = runCheck;
}

async function boot() {
  buildTools();
  buildTabs();
  layersUi();
  wireHeader();
  setTool('select');
  try {
    customPrefabs = JSON.parse(localStorage.getItem('harterkarter.editor.prefabs') ?? '[]');
  } catch {
    customPrefabs = [];
  }
  try {
    const p = await api('/prefabs');
    if (Array.isArray(p?.prefabs)) customPrefabs = p.prefabs;
  } catch {
    /* noch keine Datei */
  }
  if (!SERVER) {
    loadData(alleyFile as unknown as MapData, 'alley');
    msg('Änderungen bleiben in diesem Browser. Ins Spiel übernehmen: „Export“.');
  } else {
    try {
      loadData(await api('/alley'), 'alley');
    } catch {
      loadData(alleyFile as unknown as MapData, 'alley');
      msg('Dev-Server nicht erreichbar: Karte aus dem Build geladen, Speichern nur per Export.', true);
    }
  }
  // Autosave wiederherstellen?
  try {
    const a = JSON.parse(localStorage.getItem(autosaveKey()) ?? 'null') as { t: number; data: MapData } | null;
    if (a && JSON.stringify(a.data) !== JSON.stringify(map)) {
      $('restore').style.display = 'flex';
      $('restoreText').textContent = `Ungespeicherte Änderungen vom ${new Date(a.t).toLocaleString('de-DE')}.`;
      $('restoreYes').onclick = () => { remember(); map = a.data; changed(); $('restore').style.display = 'none'; };
      $('restoreNo').onclick = () => { localStorage.removeItem(autosaveKey()); $('restore').style.display = 'none'; };
    }
  } catch {
    /* egal */
  }
  library();
  render();
}

// Phaser nur, um die Spielgrafiken mit denselben Funktionen wie im Spiel zu erzeugen
game = new Phaser.Game({
  type: Phaser.CANVAS,
  width: 8,
  height: 8,
  parent: 'phaser',
  banner: false,
  audio: { noAudio: true },
  scene: class extends Phaser.Scene {
    create() {
      for (const make of [makeAllTextures, makeCasinoTextures, makeGuestTextures, makeWorldTextures, makeLeonardTextures, makeAchievementIcons, makeRoomTextures, makeLadenTextures, makeAnneTextures, makeClaudiusTextures, makeStreetTextures, makeCityTextures, makeKanalTiles]) {
        try {
          make(this);
        } catch (err) {
          console.error('[Map-Editor] Grafiken fehlgeschlagen:', err);
        }
      }
      document.fonts.load('8px "Press Start 2P"').finally(() => void boot());
    }
  },
});
