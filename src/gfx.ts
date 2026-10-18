import Phaser from 'phaser';

// Alle Grafiken werden hier prozedural als Pixel-Art auf Canvas-Texturen gemalt.

type Ctx = CanvasRenderingContext2D;
const OUTLINE = '#120c0b';

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function r(c: Ctx, x: number, y: number, w: number, h: number, col: string) {
  c.fillStyle = col;
  c.fillRect(x, y, w, h);
}
function p(c: Ctx, x: number, y: number, col: string) {
  r(c, x, y, 1, 1, col);
}

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, w, h)!;
  const c = t.getContext();
  c.imageSmoothingEnabled = false;
  draw(c);
  t.refresh();
  return t;
}

/** Zieht eine dunkle Kontur um alle undurchsichtigen Pixel im Bereich. */
function outline(c: Ctx, x0: number, y0: number, w: number, h: number, col = OUTLINE) {
  const img = c.getImageData(x0, y0, w, h);
  const d = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const marks: [number, number][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) marks.push([x, y]);
  for (const [x, y] of marks) p(c, x0 + x, y0 + y, col);
}

// ---------------------------------------------------------------- Figuren (Draufsicht)

export interface Pal {
  skin: string;
  hair: string;
  coat: string;
  coat2: string;
  pants: string;
  shoes: string;
  shirt?: string;
  tie?: string;
  hat?: string;
  hat2?: string;
  beard?: string;
  bald?: boolean;
  longHair?: boolean;
  skirt?: string;
  fishnet?: boolean;
  boots?: boolean;
  lips?: string;
}

/** 16x20-Figur. dir: 0 = vorne, 1 = hinten, 2 = seitlich (rechts). step: 0..2 */
function drawHuman(c: Ctx, ox: number, dir: number, step: number, pal: Pal) {
  const leg = (x: number, y: number, w: number, h: number) => {
    r(c, x, y, w, h, pal.pants);
    if (pal.fishnet) for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if ((xx + yy) % 2 === 0) p(c, xx, yy, '#2a1418');
    if (pal.boots) r(c, x, y + h - 2, w, 2, pal.shoes);
  };
  // Beine
  if (dir === 2) {
    const a = step === 1 ? 1 : step === 2 ? -1 : 0;
    leg(ox + 6 - a, 15, 2, 3);
    r(c, ox + 6 - a, 18, 3, 1, pal.shoes);
    leg(ox + 8 + a, 15, 2, 3);
    r(c, ox + 8 + a, 18, 3, 1, pal.shoes);
  } else {
    const ll = step === 1 ? 3 : 4;
    const rl = step === 2 ? 3 : 4;
    leg(ox + 5, 15, 2, ll - 1);
    r(c, ox + 5, 14 + ll, 2, 1, pal.shoes);
    leg(ox + 9, 15, 2, rl - 1);
    r(c, ox + 9, 14 + rl, 2, 1, pal.shoes);
  }
  // Körper
  r(c, ox + 4, 9, 8, 7, pal.coat);
  r(c, ox + 10, 9, 2, 7, pal.coat2);
  if (dir === 0 && pal.shirt) {
    r(c, ox + 7, 9, 2, 3, pal.shirt);
    if (pal.tie) r(c, ox + 7, 10, 2, 4, pal.tie);
  }
  if (pal.skirt) {
    if (dir !== 1) r(c, ox + 5, 12, 6, 1, pal.skin); // bauchfrei
    r(c, ox + 4, 13, 8, 3, pal.skirt);
    r(c, ox + 4, 13, 8, 1, '#ffffff33');
  }
  // Arme
  const s = step === 1 ? 1 : step === 2 ? -1 : 0;
  if (dir === 2) {
    r(c, ox + 7 + s, 10, 2, 4, pal.coat2);
    r(c, ox + 7 + s, 14, 2, 1, pal.skin);
  } else {
    r(c, ox + 3, 10 + s, 1, 4, pal.coat2);
    p(c, ox + 3, 14 + s, pal.skin);
    r(c, ox + 12, 10 - s, 1, 4, pal.coat2);
    p(c, ox + 12, 14 - s, pal.skin);
  }
  // Kopf
  r(c, ox + 4, 2, 8, 7, pal.skin);
  const hair = pal.hair;
  if (dir === 0) {
    if (!pal.bald) r(c, ox + 4, 1, 8, 2, hair);
    r(c, ox + 4, 3, 1, 3, hair);
    r(c, ox + 11, 3, 1, 3, hair);
    p(c, ox + 6, 5, '#1a1212');
    p(c, ox + 9, 5, '#1a1212');
    if (pal.beard) r(c, ox + 5, 7, 6, 2, pal.beard);
  } else if (dir === 1) {
    r(c, ox + 4, pal.bald ? 3 : 1, 8, pal.bald ? 6 : 8, hair);
  } else {
    if (!pal.bald) r(c, ox + 4, 1, 7, 2, hair);
    r(c, ox + 4, 3, 3, 5, hair);
    p(c, ox + 9, 5, '#1a1212');
    p(c, ox + 12, 6, pal.skin);
    if (pal.beard) r(c, ox + 8, 7, 4, 2, pal.beard);
  }
  if (pal.longHair) {
    if (dir === 0) { r(c, ox + 3, 2, 1, 8, hair); r(c, ox + 12, 2, 1, 8, hair); }
    else if (dir === 1) r(c, ox + 4, 1, 8, 11, hair);
    else r(c, ox + 3, 2, 4, 9, hair);
  }
  if (pal.lips && dir !== 1) r(c, ox + (dir === 2 ? 10 : 7), 7, 2, 1, pal.lips);
  if (pal.hat) {
    r(c, ox + 4, 0, 8, 3, pal.hat);
    r(c, ox + 3, 2, 10, 1, pal.hat2 ?? pal.hat);
  }
  outline(c, ox, 0, 16, 20);
}

function humanSheet(scene: Phaser.Scene, key: string, pal: Pal) {
  const t = tex(scene, key, 16 * 9, 20, (c) => {
    for (let d = 0; d < 3; d++) for (let s = 0; s < 3; s++) drawHuman(c, (d * 3 + s) * 16, d, s, pal);
  });
  for (let i = 0; i < 9; i++) t.add(i, 0, i * 16, 0, 16, 20);
}

export const PLAYER_PAL: Pal = {
  skin: '#e0a07a', hair: '#5b4636', coat: '#6a6640', coat2: '#4f4c2e', pants: '#3d3a4a', shoes: '#2a1f18',
  hat: '#8a3030', hat2: '#5e1f1f', beard: '#7a6450',
};

export const SCHNOESEL_PALS: Pal[] = [
  { skin: '#f3c99a', hair: '#2e2016', coat: '#22305a', coat2: '#18213f', pants: '#1a2440', shoes: '#0b0b0b', shirt: '#f4f4f4', tie: '#c0202c' },
  { skin: '#f0c094', hair: '#3a2a1c', coat: '#22305a', coat2: '#18213f', pants: '#1a2440', shoes: '#0b0b0b', shirt: '#ebe8de', tie: '#8a1a22' },
  { skin: '#e2b088', hair: '#4a3a2a', coat: '#2f3550', coat2: '#232740', pants: '#252a3c', shoes: '#1a1612', shirt: '#d6ceae', beard: '#8a6e56' },
  { skin: '#d4a77e', hair: '#5a4a3a', coat: '#47454c', coat2: '#353339', pants: '#34313a', shoes: '#2a2018', shirt: '#b3a682', beard: '#5a4a3a' },
  { skin: '#bfa07a', hair: '#6d645a', coat: '#5a4632', coat2: '#45351f', pants: '#3a3226', shoes: '#2a2018', shirt: '#8e8060', beard: '#6d645a' },
];

const WIRT_PAL: Pal = {
  skin: '#f0c08a', hair: '#2a2a2a', coat: '#e8e8e2', coat2: '#c4c4bc', pants: '#222', shoes: '#111', beard: '#2a2a2a', bald: true,
};
const DAME_PALS: Pal[] = [
  { skin: '#f0c4a0', hair: '#f8e070', coat: '#ff3a9a', coat2: '#d02a7a', pants: '#e8b898', shoes: '#e01830', longHair: true, lips: '#e0103a', skirt: '#1a1a1a', fishnet: true, boots: true },
  { skin: '#a8724c', hair: '#c0301a', coat: '#b040e0', coat2: '#8a2ab8', pants: '#a8724c', shoes: '#101010', longHair: true, lips: '#ff2a6a', skirt: '#c8c8d8', fishnet: true, boots: true },
];
const COP_PAL: Pal = {
  skin: '#f0c090', hair: '#2a2018', coat: '#1e3a8a', coat2: '#16306e', pants: '#1a2440', shoes: '#0a0a0a', hat: '#14244a', hat2: '#0a1430', shirt: '#9ab0e0', tie: '#0a1430',
};
const DEALER_PAL: Pal = {
  skin: '#b07a50', hair: '#1a1a1a', coat: '#2d3b2d', coat2: '#223022', pants: '#1e1e22', shoes: '#111', hat: '#2d3b2d', hat2: '#223022',
};

// ---------------------------------------------------------------- Kacheln

function noise(c: Ctx, w: number, h: number, cols: string[], n: number, seed: number) {
  const rnd = rng(seed);
  for (let i = 0; i < n; i++) p(c, Math.floor(rnd() * w), Math.floor(rnd() * h), cols[Math.floor(rnd() * cols.length)]);
}

function tiles(scene: Phaser.Scene) {
  // Holzboden (drei Varianten)
  for (let v = 0; v < 3; v++)
    tex(scene, `floor${v}`, 16, 16, (c) => {
      r(c, 0, 0, 16, 16, '#6b4a2f');
      for (let y = 3; y < 16; y += 4) r(c, 0, y, 16, 1, '#4f3520');
      const off = (v * 5) % 16;
      r(c, off, 0, 1, 3, '#4f3520');
      r(c, (off + 8) % 16, 4, 1, 3, '#4f3520');
      r(c, (off + 3) % 16, 8, 1, 3, '#4f3520');
      r(c, (off + 11) % 16, 12, 1, 3, '#4f3520');
      noise(c, 16, 16, ['#7a5636', '#5e4129'], 10, 11 + v);
    });
  tex(scene, 'rug', 16, 16, (c) => {
    r(c, 0, 0, 16, 16, '#7a2228');
    noise(c, 16, 16, ['#8e2a30', '#661a20', '#a8763a'], 18, 4);
    r(c, 0, 7, 16, 2, '#a8763a');
  });
  // Wände: Oberseite und Vorderseite
  tex(scene, 'wallTop', 16, 16, (c) => {
    r(c, 0, 0, 16, 16, '#1f1616');
    noise(c, 16, 16, ['#2a1e1e', '#181111'], 14, 2);
  });
  tex(scene, 'wallFront', 16, 16, (c) => {
    r(c, 0, 0, 16, 16, '#4a2c2c');
    for (let y = 0; y < 16; y += 4) {
      r(c, 0, y + 3, 16, 1, '#2e1a1a');
      const o = (y / 4) % 2 ? 4 : 0;
      r(c, o, y, 1, 3, '#2e1a1a');
      r(c, o + 8, y, 1, 3, '#2e1a1a');
    }
    noise(c, 16, 16, ['#5a3636', '#3e2424'], 10, 3);
    r(c, 0, 0, 16, 2, '#1f1616');
  });
  tex(scene, 'shelf', 16, 16, (c) => {
    r(c, 0, 0, 16, 16, '#3a2418');
    r(c, 0, 0, 16, 2, '#1f1616');
    r(c, 0, 8, 16, 2, '#7a5032');
    r(c, 0, 15, 16, 1, '#7a5032');
    const cols = ['#3b7a3b', '#9a5a1a', '#d8d8c8', '#7a1a2a', '#c8a03a'];
    const rnd = rng(7);
    for (const row of [3, 10]) for (let x = 1; x < 15; x += 3) {
      const col = cols[Math.floor(rnd() * cols.length)];
      r(c, x, row, 2, 5, col);
      p(c, x, row - 1, col);
      p(c, x, row + 1, '#ffffff55');
    }
  });
  tex(scene, 'window', 16, 16, (c) => {
    r(c, 0, 0, 16, 16, '#4a2c2c');
    r(c, 0, 0, 16, 2, '#1f1616');
    r(c, 2, 3, 12, 11, '#2a1a12');
    r(c, 3, 4, 10, 9, '#1b2a48');
    r(c, 7, 4, 1, 9, '#2a1a12');
    r(c, 3, 8, 10, 1, '#2a1a12');
    p(c, 4, 5, '#f0d070');
    p(c, 10, 10, '#f0d070');
    p(c, 11, 5, '#7090c0');
  });
  tex(scene, 'counter', 16, 16, (c) => {
    r(c, 0, 0, 16, 11, '#9a6a3e');
    r(c, 0, 0, 16, 1, '#b8834e');
    noise(c, 16, 11, ['#a8764a', '#8a5c34'], 10, 5);
    r(c, 0, 11, 16, 5, '#5a3a20');
    r(c, 0, 11, 16, 1, '#3a2412');
    r(c, 0, 14, 16, 1, '#c9a24a');
  });
  tex(scene, 'counterFlap', 16, 16, (c) => {
    r(c, 0, 0, 16, 16, '#6b4a2f');
    r(c, 0, 0, 16, 3, '#9a6a3e');
    r(c, 0, 3, 16, 1, '#4a2e18');
    r(c, 0, 13, 16, 3, '#9a6a3e');
    r(c, 0, 12, 16, 1, '#4a2e18');
    p(c, 1, 1, '#c9a24a'); p(c, 14, 14, '#c9a24a');
  });
  tex(scene, 'table', 16, 16, (c) => {
    c.fillStyle = '#7a5032';
    c.beginPath();
    c.arc(8, 7, 6.5, 0, Math.PI * 2);
    c.fill();
    r(c, 6, 12, 4, 3, '#4a2e18');
    r(c, 4, 4, 3, 1, '#9a6a44');
    r(c, 9, 7, 2, 3, '#c8a03a');
    outline(c, 0, 0, 16, 16);
  });
  tex(scene, 'stool', 16, 16, (c) => {
    r(c, 5, 6, 6, 5, '#7a1a22');
    r(c, 5, 6, 6, 1, '#9a2a32');
    r(c, 7, 11, 2, 3, '#555');
    outline(c, 0, 0, 16, 16);
  });
  tex(scene, 'chair', 16, 16, (c) => {
    r(c, 5, 5, 6, 6, '#6a4228');
    r(c, 5, 3, 6, 2, '#4a2e18');
    outline(c, 0, 0, 16, 16);
  });
  tex(scene, 'jukebox', 16, 16, (c) => {
    r(c, 2, 1, 12, 15, '#7a2a6a');
    r(c, 3, 2, 10, 5, '#f0c050');
    r(c, 4, 8, 8, 4, '#2a1a2a');
    for (let x = 4; x < 12; x += 2) p(c, x, 13, '#60e0ff');
    outline(c, 0, 0, 16, 16);
  });
  tex(scene, 'doorBottom', 16, 16, (c) => {
    r(c, 0, 0, 16, 16, '#1f1616');
    r(c, 2, 0, 12, 16, '#3a2a1a');
    r(c, 3, 4, 10, 8, '#8a5a30');
    noise(c, 10, 8, ['#7a4a26'], 6, 9);
  });
  tex(scene, 'doorFront', 16, 16, (c) => {
    r(c, 0, 0, 16, 16, '#4a2c2c');
    r(c, 0, 0, 16, 2, '#1f1616');
    r(c, 2, 2, 12, 14, '#5a3a1e');
    r(c, 3, 3, 10, 13, '#6e4826');
    r(c, 3, 8, 10, 1, '#5a3a1e');
    p(c, 11, 10, '#e0c050');
  });
  // Gasse
  for (let v = 0; v < 3; v++)
    tex(scene, `cobble${v}`, 16, 16, (c) => {
      r(c, 0, 0, 16, 16, '#2c2c34');
      const rnd = rng(40 + v);
      for (let y = 0; y < 16; y += 4)
        for (let x = (y / 4) % 2 ? -2 : 0; x < 16; x += 5) {
          const g = 60 + Math.floor(rnd() * 22);
          r(c, x + 1, y + 1, 4, 3, `rgb(${g},${g},${g + 8})`);
          r(c, x + 1, y + 1, 4, 1, `rgb(${g + 14},${g + 14},${g + 22})`);
        }
      if (v === 2) { r(c, 9, 2, 2, 1, '#2a4a2a'); p(c, 3, 11, '#c0c0a0'); }
    });
  tex(scene, 'brickFront', 16, 16, (c) => {
    r(c, 0, 0, 16, 16, '#5a3428');
    for (let y = 0; y < 16; y += 4) {
      r(c, 0, y + 3, 16, 1, '#2e1c16');
      const o = (y / 4) % 2 ? 4 : 0;
      r(c, o, y, 1, 3, '#2e1c16');
      r(c, o + 8, y, 1, 3, '#2e1c16');
    }
    noise(c, 16, 16, ['#6a4030', '#4a2a20', '#3a5a3a'], 12, 21);
    r(c, 0, 0, 16, 2, '#1a1414');
  });
  tex(scene, 'brickTop', 16, 16, (c) => {
    r(c, 0, 0, 16, 16, '#1a1414');
    noise(c, 16, 16, ['#241c1c', '#121010'], 14, 22);
  });
  tex(scene, 'puddle', 16, 16, (c) => {
    c.fillStyle = '#26364e';
    c.beginPath();
    c.ellipse(8, 9, 7, 4, 0, 0, Math.PI * 2);
    c.fill();
    r(c, 5, 8, 3, 1, '#4a6a90');
    p(c, 10, 10, '#4a6a90');
  });
  tex(scene, 'dumpster', 16, 16, (c) => {
    r(c, 0, 2, 16, 13, '#2e5a3a');
    r(c, 0, 2, 16, 3, '#3e7a4a');
    r(c, 0, 5, 16, 1, '#1e3a24');
    r(c, 2, 8, 12, 1, '#24482e');
    r(c, 2, 15, 2, 1, '#111');
    r(c, 12, 15, 2, 1, '#111');
    outline(c, 0, 0, 16, 16);
  });
  tex(scene, 'trash', 16, 16, (c) => {
    r(c, 3, 4, 10, 11, '#6a6e74');
    r(c, 2, 3, 12, 2, '#8a8e94');
    for (let x = 5; x < 12; x += 3) r(c, x, 6, 1, 8, '#55595e');
    p(c, 6, 2, '#c0a040');
    p(c, 9, 1, '#a04040');
    outline(c, 0, 0, 16, 16);
  });
  tex(scene, 'automat', 16, 16, (c) => {
    r(c, 0, 0, 16, 16, '#5a3428');
    r(c, 0, 0, 16, 2, '#1a1414');
    r(c, 2, 1, 12, 15, '#a01e24');
    r(c, 3, 2, 10, 6, '#e8e0c8');
    for (let x = 4; x < 12; x += 2) r(c, x, 3, 1, 4, ['#c02020', '#2040a0', '#f0f0f0', '#208040'][x % 4]);
    r(c, 4, 10, 8, 2, '#222');
    r(c, 11, 13, 2, 2, '#f0d050');
  });
  tex(scene, 'crate', 16, 16, (c) => {
    r(c, 1, 2, 14, 13, '#8a6234');
    r(c, 1, 2, 14, 2, '#a87a44');
    r(c, 1, 8, 14, 1, '#5a3e1e');
    r(c, 7, 4, 2, 11, '#5a3e1e');
    outline(c, 0, 0, 16, 16);
  });
  tex(scene, 'lampWall', 16, 16, (c) => {
    r(c, 0, 0, 16, 16, '#5a3428');
    r(c, 0, 0, 16, 2, '#1a1414');
    noise(c, 16, 16, ['#6a4030', '#4a2a20'], 10, 23);
    r(c, 6, 4, 4, 2, '#222');
    r(c, 5, 6, 6, 4, '#f8e8a0');
    r(c, 5, 10, 6, 1, '#222');
  });
}

// ---------------------------------------------------------------- Kleinkram

function items(scene: Phaser.Scene) {
  tex(scene, 'icon_bier', 16, 16, (c) => {
    r(c, 6, 1, 4, 2, '#d8b040');
    r(c, 6, 3, 4, 3, '#5a2e0e');
    r(c, 5, 6, 6, 9, '#6a3612');
    r(c, 5, 8, 6, 4, '#e8dcb0');
    r(c, 6, 9, 4, 1, '#c02020');
    p(c, 6, 6, '#a86a3a');
    outline(c, 0, 0, 16, 16);
  });
  tex(scene, 'icon_kippe', 16, 16, (c) => {
    r(c, 3, 4, 10, 11, '#f0ece0');
    r(c, 3, 4, 10, 4, '#c02020');
    r(c, 4, 10, 8, 3, '#222');
    r(c, 5, 1, 2, 4, '#e8c890');
    r(c, 8, 2, 2, 3, '#e8c890');
    p(c, 5, 1, '#c87030');
    outline(c, 0, 0, 16, 16);
  });
  tex(scene, 'icon_schnaps', 16, 16, (c) => {
    r(c, 7, 1, 2, 4, '#c0c0c0');
    r(c, 5, 5, 6, 10, '#cfe6ee');
    r(c, 6, 6, 4, 8, '#e8f6fa');
    r(c, 5, 9, 6, 3, '#2a5aa0');
    p(c, 6, 6, '#ffffff');
    outline(c, 0, 0, 16, 16);
  });
  tex(scene, 'icon_fusel', 16, 16, (c) => {
    r(c, 7, 1, 2, 5, '#2a5a2a');
    r(c, 5, 6, 6, 9, '#2e6a30');
    r(c, 5, 9, 5, 3, '#c8b890');
    p(c, 9, 11, '#2e6a30');
    p(c, 6, 7, '#5aa05a');
    outline(c, 0, 0, 16, 16);
  });
  tex(scene, 'icon_pillen', 16, 16, (c) => {
    r(c, 4, 2, 8, 3, '#f0f0f0');
    r(c, 4, 5, 8, 10, '#e08020');
    r(c, 5, 8, 6, 4, '#f8f0e0');
    p(c, 7, 9, '#c02020');
    p(c, 8, 10, '#c02020');
    r(c, 5, 6, 1, 8, '#f0a040');
    outline(c, 0, 0, 16, 16);
  });
  tex(scene, 'icon_zeug', 16, 16, (c) => {
    r(c, 3, 4, 10, 10, '#d8d0e8');
    r(c, 3, 4, 10, 2, '#9a3ac0');
    r(c, 5, 8, 6, 4, '#ffffff');
    p(c, 7, 9, '#9a3ac0');
    r(c, 7, 2, 2, 2, '#9a3ac0');
    outline(c, 0, 0, 16, 16);
  });
  tex(scene, 'coin', 8, 8, (c) => {
    r(c, 1, 1, 6, 6, '#e8c040');
    r(c, 2, 2, 4, 4, '#f8e070');
    p(c, 3, 3, '#b08a20');
    outline(c, 0, 0, 8, 8);
  });
  tex(scene, 'shadow', 14, 5, (c) => {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(7, 2.5, 7, 2.5, 0, 0, Math.PI * 2);
    c.fill();
  });
  tex(scene, 'light', 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,220,150,0.55)');
    g.addColorStop(0.5, 'rgba(255,180,90,0.18)');
    g.addColorStop(1, 'rgba(255,160,60,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
  tex(scene, 'bubble', 12, 12, (c) => {
    r(c, 1, 0, 10, 9, '#f4f0e4');
    r(c, 0, 1, 12, 7, '#f4f0e4');
    r(c, 4, 9, 3, 2, '#f4f0e4');
    p(c, 4, 11, '#f4f0e4');
    outline(c, 0, 0, 12, 12);
  });
  tex(scene, 'crown', 12, 8, (c) => {
    r(c, 1, 3, 10, 4, '#f0c030');
    p(c, 1, 1, '#f0c030'); p(c, 1, 2, '#f0c030');
    p(c, 5, 0, '#f0c030'); r(c, 5, 1, 2, 2, '#f0c030'); p(c, 6, 0, '#f0c030');
    p(c, 10, 1, '#f0c030'); p(c, 10, 2, '#f0c030');
    p(c, 3, 4, '#c02030'); p(c, 6, 4, '#3060c0'); p(c, 8, 4, '#c02030');
    r(c, 1, 3, 10, 1, '#f8e070');
    outline(c, 0, 0, 12, 8);
  });
  // Die Pestkatze: räudig, kahle Stellen mit Wunden, ein glühendes und ein blindes Auge. 2 Frames.
  const cat = tex(scene, 'cat', 32, 14, (c) => {
    for (let f = 0; f < 2; f++) {
      const o = f * 16;
      const fur = '#565c4a', fur2 = '#43483a', skin = '#c4887a';
      // Körper, mager mit Rippen
      r(c, o + 3, 6, 9, 5, fur);
      r(c, o + 4, 10, 7, 1, fur2);
      for (let x = o + 5; x < o + 10; x += 2) r(c, x, 7, 1, 3, fur2);
      r(c, o + 5, 6, 3, 2, skin); p(c, o + 6, 7, '#8a1a1a'); // kahle Stelle mit Wunde
      // Kopf
      r(c, o + 9, 2, 6, 6, fur);
      p(c, o + 9, 1, fur); p(c, o + 14, 0, fur); p(c, o + 14, 1, fur); // zerrissenes Ohr
      r(c, o + 12, 6, 2, 1, '#2a1010'); // Maul
      p(c, o + 12, 7, '#e8e0c0'); // Zahn
      p(c, o + 13, 7 + f, '#9ad040'); if (f) p(c, o + 13, 9, '#9ad040'); // Sabber
      p(c, o + 11, 4, '#ff3a10'); // glühendes Auge
      p(c, o + 13, 4, '#dfe6d8'); // blindes Auge
      p(c, o + 10, 2, skin);
      // Beine, dürr
      r(c, o + 4, 11, 1, 3, fur2); r(c, o + 7, 11, 1, 2, fur2); r(c, o + 10, 11, 1, 3, fur2);
      // knochiger, geknickter Schwanz
      if (f === 0) { r(c, o + 1, 3, 1, 3, fur2); p(c, o + 2, 6, fur2); p(c, o + 0, 2, '#d8d0b0'); }
      else { r(c, o + 0, 5, 3, 1, fur2); p(c, o + 2, 6, fur2); p(c, o + 0, 4, '#d8d0b0'); }
      outline(c, o, 0, 16, 14);
    }
  });
  cat.add(0, 0, 0, 0, 16, 14);
  cat.add(1, 0, 16, 0, 16, 14);
}

// ---------------------------------------------------------------- Tresen-Ansicht (groß)

const BW = 64, BH = 96;

/** Brustbild des Schnösels, Stufe 0..4, Blick zum Betrachter. */
function drawSchnoeselBust(c: Ctx, st: number) {
  const pal = SCHNOESEL_PALS[st];
  const rnd = rng(100 + st);
  const cx = 32;
  // Jackett / Schultern
  const jacket = pal.coat, jacket2 = pal.coat2;
  r(c, cx - 22, 52, 44, 44, jacket);
  r(c, cx - 24, 58, 48, 38, jacket);
  r(c, cx - 20, 50, 40, 4, jacket);
  r(c, cx + 14, 54, 10, 42, jacket2);
  // Hemd + Kragen
  const shirt = pal.shirt ?? '#ddd';
  r(c, cx - 6, 46, 12, 30, shirt);
  r(c, cx - 8, 48, 3, 22, jacket2);
  r(c, cx + 5, 48, 3, 22, jacket2);
  // Revers
  for (let i = 0; i < 18; i++) {
    p(c, cx - 7 - Math.floor(i / 3), 50 + i, '#00000033');
    p(c, cx + 6 + Math.floor(i / 3), 50 + i, '#00000033');
  }
  if (st === 0) {
    r(c, cx + 12, 62, 5, 3, '#f4f4f4'); // Einstecktuch
    p(c, cx + 13, 61, '#f4f4f4');
    r(c, cx - 2, 46, 4, 3, pal.tie!);
    r(c, cx - 2, 49, 4, 22, pal.tie!);
    r(c, cx - 1, 49, 1, 22, '#e04050');
    r(c, cx - 4, 74, 2, 2, '#e0c050'); r(c, cx + 2, 74, 2, 2, '#e0c050');
  }
  if (st === 1) {
    r(c, cx - 2, 52, 4, 3, pal.tie!); // gelockerte Krawatte
    r(c, cx - 1, 55, 4, 18, pal.tie!);
    r(c, cx - 5, 46, 3, 3, '#ebe8de');
    p(c, cx + 18, 70, '#5a3a20'); p(c, cx + 19, 71, '#5a3a20');
  }
  if (st >= 2) {
    // Flecken
    const n = st * 7;
    for (let i = 0; i < n; i++) {
      const x = cx - 20 + Math.floor(rnd() * 40), y = 55 + Math.floor(rnd() * 38);
      r(c, x, y, 1 + Math.floor(rnd() * 2), 1 + Math.floor(rnd() * 2), rnd() < 0.5 ? '#5a3e20aa' : '#8a7a40aa');
    }
    for (let i = 0; i < st * 2; i++) p(c, cx - 4 + Math.floor(rnd() * 8), 50 + Math.floor(rnd() * 24), '#8a6a3a');
    r(c, cx - 1, 54, 2, 1, '#888'); r(c, cx - 1, 62, 2, 1, '#888');
  }
  if (st >= 3) {
    // Riss am Ärmel, Flicken
    r(c, cx - 23, 74, 6, 1, OUTLINE); r(c, cx - 22, 75, 4, 2, shirt);
    r(c, cx + 10, 80, 7, 6, st === 4 ? '#7a6a3a' : '#5a5860');
    for (let i = 0; i < 7; i += 2) p(c, cx + 10 + i, 80, '#2a2a2a');
  }
  if (st === 4) {
    r(c, cx - 18, 86, 4, 3, OUTLINE); r(c, cx + 2, 90, 3, 2, OUTLINE);
    r(c, cx - 24, 60, 3, 3, OUTLINE);
    r(c, cx + 20, 70, 3, 5, OUTLINE);
  }
  // Hals
  const skin = pal.skin;
  r(c, cx - 5, 40, 10, 8, skin);
  r(c, cx - 5, 40, 10, 2, '#00000022');
  // Kopf
  r(c, cx - 10, 14, 20, 28, skin);
  r(c, cx - 11, 18, 22, 20, skin);
  r(c, cx - 12, 24, 2, 6, skin); r(c, cx + 10, 24, 2, 6, skin); // Ohren
  r(c, cx + 6, 16, 4, 24, '#0000000f');
  // Haare
  const hair = pal.hair;
  if (st === 0) {
    r(c, cx - 11, 8, 22, 9, hair);
    r(c, cx - 12, 12, 3, 10, hair);
    r(c, cx + 9, 12, 3, 8, hair);
    r(c, cx - 4, 8, 14, 2, '#5a4430'); // Glanz
    r(c, cx - 5, 9, 1, 7, '#1a120a'); // Scheitel
  } else {
    r(c, cx - 11, 8, 22, 8, hair);
    r(c, cx - 12, 12, 3, 12, hair);
    r(c, cx + 9, 12, 3, 12, hair);
    const strands = st * 6;
    for (let i = 0; i < strands; i++) {
      const x = cx - 12 + Math.floor(rnd() * 24);
      r(c, x, 5 + Math.floor(rnd() * 4), 1, 2 + Math.floor(rnd() * 3), hair);
    }
    if (st >= 3) for (let i = 0; i < 8; i++) p(c, cx - 10 + Math.floor(rnd() * 20), 8 + Math.floor(rnd() * 6), '#a8a098');
    if (st >= 3) r(c, cx - 12, 22, 3, 6, hair);
  }
  // Augenbrauen
  const brow = st >= 3 ? 23 : 22;
  r(c, cx - 8, brow, 5, 1, hair);
  r(c, cx + 3, brow, 5, 1, hair);
  if (st >= 3) { p(c, cx - 4, brow - 1, hair); p(c, cx + 3, brow - 1, hair); }
  // Augen
  const white = st >= 3 ? '#f0b8b0' : '#f8f8f0';
  r(c, cx - 7, 25, 4, 3, white);
  r(c, cx + 3, 25, 4, 3, white);
  const pupY = st >= 4 ? 26 : 25;
  r(c, cx - 5, pupY, 2, 2, '#2a4a7a');
  r(c, cx + 4, pupY, 2, 2, '#2a4a7a');
  p(c, cx - 5, pupY, '#0a0a14'); p(c, cx + 4, pupY, '#0a0a14');
  if (st >= 2) { r(c, cx - 7, 28, 4, 1, '#9a6a8a'); r(c, cx + 3, 28, 4, 1, '#9a6a8a'); }
  if (st >= 4) { r(c, cx - 7, 25, 4, 1, skin); r(c, cx + 3, 25, 4, 1, skin); } // halb geschlossen
  // Nase
  r(c, cx - 1, 26, 3, 6, '#00000018');
  r(c, cx - 1, 31, 3, 2, st >= 1 ? (st >= 3 ? '#d04a4a' : '#e08070') : '#00000022');
  // Mund
  if (st === 0) {
    r(c, cx - 4, 35, 8, 1, '#8a3a30');
    p(c, cx - 5, 34, '#8a3a30'); p(c, cx + 4, 34, '#8a3a30');
    r(c, cx - 3, 36, 6, 1, '#ffffff');
  } else if (st <= 2) {
    r(c, cx - 3, 35, 7, 1, '#7a3a30');
  } else {
    r(c, cx - 4, 35, 8, 2, '#3a1a14');
    p(c, cx - 5, 37, '#3a1a14'); p(c, cx + 4, 37, '#3a1a14');
    r(c, cx - 3, 35, 2, 1, st === 4 ? '#c8b070' : '#e8e0c0');
    r(c, cx + 1, 35, 2, 1, '#e8e0c0');
  }
  // Bart
  if (pal.beard) {
    const dens = st === 2 ? 0.25 : st === 3 ? 0.55 : 0.9;
    for (let y = 30; y < 43; y++)
      for (let x = cx - 11; x < cx + 11; x++) {
        if (y < 33 && Math.abs(x - cx) < 7) continue;
        if (y >= 34 && y <= 37 && Math.abs(x - cx) < 5 && st < 4) continue;
        if (rnd() < dens) p(c, x, y, pal.beard);
      }
  }
  // Teint: blasser/grünlicher
  if (st >= 3) for (let i = 0; i < 18; i++) p(c, cx - 9 + Math.floor(rnd() * 18), 16 + Math.floor(rnd() * 20), '#a8a04a33');
  outline(c, 0, 0, BW, BH);
}

function drawPennerBust(c: Ctx) {
  const cx = 32;
  const rnd = rng(77);
  // Parka
  r(c, cx - 23, 54, 46, 42, '#6a6640');
  r(c, cx - 25, 60, 50, 36, '#6a6640');
  r(c, cx + 12, 58, 12, 38, '#4f4c2e');
  r(c, cx - 4, 52, 8, 44, '#4f4c2e');
  for (let y = 56; y < 96; y += 6) p(c, cx, y, '#c0b080');
  r(c, cx - 18, 70, 8, 6, '#8a5030'); // Flicken
  r(c, cx - 26, 76, 5, 8, '#5a3a5a');
  for (let i = 0; i < 25; i++) p(c, cx - 22 + Math.floor(rnd() * 44), 58 + Math.floor(rnd() * 36), '#5a5634');
  // Schal
  r(c, cx - 12, 46, 24, 8, '#3a5a8a');
  r(c, cx + 4, 52, 6, 14, '#3a5a8a');
  for (let x = cx - 12; x < cx + 12; x += 3) r(c, x, 47, 1, 6, '#2a4a7a');
  // Kopf
  r(c, cx - 10, 16, 20, 30, '#e0a07a');
  r(c, cx - 11, 20, 22, 20, '#e0a07a');
  r(c, cx - 12, 26, 2, 6, '#d08a66');
  r(c, cx + 10, 26, 2, 6, '#d08a66');
  // Mütze
  r(c, cx - 12, 6, 24, 14, '#8a3030');
  r(c, cx - 10, 3, 20, 4, '#8a3030');
  r(c, cx - 13, 17, 26, 4, '#5e1f1f');
  for (let x = cx - 12; x < cx + 12; x += 3) r(c, x, 7, 1, 10, '#7a2626');
  r(c, cx - 3, 0, 6, 4, '#c8c0a0');
  // Augen
  r(c, cx - 7, 26, 4, 2, '#f0e0d0');
  r(c, cx + 3, 26, 4, 2, '#f0e0d0');
  r(c, cx - 5, 26, 2, 2, '#3a2a1a');
  r(c, cx + 3, 26, 2, 2, '#3a2a1a');
  r(c, cx - 8, 23, 5, 2, '#5b4636');
  r(c, cx + 3, 23, 5, 2, '#5b4636');
  // Nase: knallrot
  r(c, cx - 2, 28, 4, 6, '#d05a4a');
  r(c, cx - 1, 29, 1, 2, '#f08a7a');
  // Vollbart
  for (let y = 32; y < 50; y++)
    for (let x = cx - 12; x < cx + 12; x++) {
      const edge = Math.abs(x - cx) > 12 - (y - 32) * 0.3;
      if (!edge && rnd() < 0.92) p(c, x, y, rnd() < 0.2 ? '#9a8470' : '#7a6450');
    }
  r(c, cx - 3, 37, 6, 2, '#4a2a20');
  outline(c, 0, 0, BW, BH);
}

function drawWirtBust(c: Ctx) {
  const cx = 32;
  r(c, cx - 20, 56, 40, 40, '#e8e8e2');
  r(c, cx + 10, 58, 10, 38, '#c4c4bc');
  r(c, cx - 14, 64, 28, 32, '#2a2a30'); // Weste
  r(c, cx - 3, 56, 6, 12, '#e8e8e2');
  r(c, cx - 4, 56, 8, 3, '#202020'); // Fliege
  p(c, cx, 70, '#c8a040'); p(c, cx, 76, '#c8a040'); p(c, cx, 82, '#c8a040');
  r(c, cx - 5, 48, 10, 8, '#f0c08a');
  r(c, cx - 10, 22, 20, 28, '#f0c08a');
  r(c, cx - 11, 26, 22, 18, '#f0c08a');
  r(c, cx - 11, 26, 3, 8, '#2a2a2a'); r(c, cx + 8, 26, 3, 8, '#2a2a2a');
  r(c, cx - 4, 22, 8, 2, '#fff8e055'); // Glatze glänzt
  r(c, cx - 6, 33, 3, 2, '#2a2a2a'); r(c, cx + 3, 33, 3, 2, '#2a2a2a');
  r(c, cx - 1, 34, 3, 5, '#e0a870');
  r(c, cx - 8, 40, 16, 3, '#2a2a2a'); // Schnauzer
  r(c, cx - 9, 42, 2, 2, '#2a2a2a'); r(c, cx + 7, 42, 2, 2, '#2a2a2a');
  outline(c, 0, 0, BW, BH);
}

function drawTresenBg(c: Ctx) {
  const rnd = rng(5);
  // Tapete
  r(c, 0, 0, 480, 200, '#3a2420');
  for (let x = 0; x < 480; x += 12) r(c, x, 0, 6, 140, '#42291f');
  for (let y = 6; y < 140; y += 12) for (let x = 3; x < 480; x += 12) p(c, x, y, '#5a3a2a');
  // Holzvertäfelung
  r(c, 0, 140, 480, 60, '#2a1810');
  r(c, 0, 140, 480, 3, '#4a2e1c');
  for (let x = 10; x < 480; x += 40) { r(c, x, 150, 30, 40, '#331e14'); r(c, x, 150, 30, 1, '#4a2e1c'); }
  // Fenster mit Nachtstadt
  r(c, 22, 26, 108, 92, '#1a0f0a');
  r(c, 28, 32, 96, 80, '#141e36');
  for (let i = 0; i < 6; i++) {
    const bx = 28 + i * 16, bh = 20 + Math.floor(rnd() * 40);
    r(c, bx, 112 - bh, 14, bh, '#0c1222');
    for (let y = 112 - bh + 3; y < 110; y += 5) for (let x = bx + 2; x < bx + 12; x += 4) if (rnd() < 0.4) r(c, x, y, 2, 2, '#e8c868');
  }
  r(c, 74, 32, 4, 80, '#1a0f0a');
  r(c, 28, 70, 96, 3, '#1a0f0a');
  r(c, 18, 116, 116, 6, '#4a2e1c');
  // Spiegel + Regal
  r(c, 196, 30, 268, 96, '#1a0f0a');
  r(c, 200, 34, 260, 88, '#2e3a44');
  for (let i = 0; i < 30; i++) r(c, 200 + Math.floor(rnd() * 250), 34 + Math.floor(rnd() * 80), 6, 1, '#3e4c58');
  const bottleCols = ['#3b7a3b', '#9a5a1a', '#d8d8c8', '#7a1a2a', '#c8a03a', '#2a4a8a', '#5a2a6a'];
  for (const shelfY of [74, 118]) {
    r(c, 196, shelfY, 268, 4, '#7a5032');
    r(c, 196, shelfY, 268, 1, '#9a6a44');
    for (let x = 204; x < 456; x += 9 + Math.floor(rnd() * 4)) {
      const h = 18 + Math.floor(rnd() * 14), col = bottleCols[Math.floor(rnd() * bottleCols.length)];
      r(c, x, shelfY - h + 6, 7, h - 6, col);
      r(c, x + 2, shelfY - h, 3, 6, col);
      r(c, x + 1, shelfY - h + 10, 5, 5, '#e8dcc0');
      r(c, x + 1, shelfY - h + 7, 1, h - 9, '#ffffff33');
      outline(c, x - 1, shelfY - h - 1, 9, h + 1);
    }
  }
  // Zapfhahn
  r(c, 150, 150, 26, 40, '#8a8a90');
  r(c, 152, 140, 6, 12, '#c8a040'); r(c, 168, 140, 6, 12, '#c8a040');
  r(c, 150, 136, 10, 6, '#222'); r(c, 166, 136, 10, 6, '#7a1a1a');
}

function drawCounter(c: Ctx) {
  r(c, 0, 0, 480, 10, '#9a6a3e');
  r(c, 0, 0, 480, 2, '#c08850');
  noise(c, 480, 10, ['#a8764a', '#8a5c34', '#b07c4c'], 300, 31);
  r(c, 0, 10, 480, 4, '#4a2e18');
  r(c, 0, 14, 480, 70, '#6b4428');
  for (let x = 0; x < 480; x += 24) { r(c, x, 14, 2, 70, '#5a3820'); r(c, x + 2, 14, 1, 70, '#7a5232'); }
  r(c, 0, 66, 480, 4, '#c9a24a');
  r(c, 0, 66, 480, 1, '#f0d070');
}

// ---------------------------------------------------------------- Cutscenes

/** Außenansicht der Kneipe bei Nacht. Dachkante bei y = 80. */
function drawStreet(c: Ctx) {
  const rnd = rng(9);
  for (let y = 0; y < 230; y += 10) {
    const g = Math.floor(10 + y / 10);
    r(c, 0, y, 480, 10, `rgb(${g},${g + 2},${g + 18})`);
  }
  for (let i = 0; i < 40; i++) p(c, Math.floor(rnd() * 480), Math.floor(rnd() * 70), '#8a8aa8');
  // Skyline
  for (let x = 0; x < 480; x += 26 + Math.floor(rnd() * 20)) {
    const h = 60 + Math.floor(rnd() * 90), w = 24 + Math.floor(rnd() * 26);
    r(c, x, 222 - h, w, h, '#0c1020');
    for (let yy = 222 - h + 6; yy < 215; yy += 8) for (let xx = x + 4; xx < x + w - 4; xx += 6) if (rnd() < 0.25) r(c, xx, yy, 2, 3, '#c8a85a');
  }
  // Kneipe
  r(c, 80, 80, 320, 142, '#4a2c2c');
  for (let y = 80; y < 222; y += 6) {
    r(c, 80, y + 5, 320, 1, '#331c1c');
    const o = (y / 6) % 2 ? 6 : 0;
    for (let x = 80 + o; x < 400; x += 12) r(c, x, y, 1, 5, '#331c1c');
  }
  r(c, 74, 74, 332, 8, '#1f1414');
  r(c, 74, 82, 332, 2, '#5a3a2a');
  // Schild
  r(c, 140, 92, 200, 20, '#140c0c');
  r(c, 140, 92, 200, 1, '#5a3a2a');
  // Fenster mit warmem Licht
  for (const wx of [100, 290]) {
    r(c, wx, 128, 90, 64, '#1a0f0a');
    r(c, wx + 4, 132, 82, 56, '#e8b060');
    r(c, wx + 4, 160, 82, 2, '#1a0f0a');
    r(c, wx + 44, 132, 2, 56, '#1a0f0a');
    for (let i = 0; i < 8; i++) r(c, wx + 8 + i * 10, 150, 4, 10, ['#3b7a3b', '#9a5a1a', '#7a1a2a'][i % 3]);
    r(c, wx + 6, 172, 30, 16, '#3a2418'); // Silhouette
  }
  r(c, 220, 140, 40, 82, '#1a0f0a');
  r(c, 224, 144, 32, 78, '#6e4826');
  r(c, 230, 150, 20, 18, '#e8b060');
  p(c, 250, 186, '#e0c050');
  // Laterne
  r(c, 436, 90, 4, 140, '#1a1a20');
  r(c, 426, 84, 24, 8, '#2a2a30');
  r(c, 430, 92, 16, 4, '#f8e8a0');
  // Gehweg + Straße
  r(c, 0, 222, 480, 14, '#3a3a44');
  r(c, 0, 222, 480, 1, '#5a5a66');
  r(c, 0, 236, 480, 34, '#1c1c24');
  for (const [px, pw] of [[120, 50], [300, 70], [430, 30]]) {
    r(c, px, 246, pw, 6, '#2a3248');
    r(c, px + 6, 248, pw / 2, 1, '#e8b060');
  }
}

/** Baulöwe Brenninger: rote Locken, Brille, Nadelstreifen. prop: 0 = Handy, 1 = Megafon */
function drawBrenninger(c: Ctx, ox: number, open: boolean, prop: number) {
  const cx = ox + 32;
  const rnd = rng(55);
  const skin = '#f4c8a8', suit = '#3a3a46', suit2 = '#2a2a34';
  // Anzug mit Nadelstreifen
  r(c, cx - 22, 52, 44, 44, suit);
  r(c, cx - 24, 58, 48, 38, suit);
  r(c, cx - 20, 50, 40, 4, suit);
  r(c, cx + 14, 54, 10, 42, suit2);
  for (let x = cx - 23; x < cx + 24; x += 4) r(c, x, 56, 1, 40, '#50505e');
  r(c, cx - 6, 46, 12, 30, '#f4f4f4');
  r(c, cx - 8, 48, 3, 22, suit2);
  r(c, cx + 5, 48, 3, 22, suit2);
  r(c, cx - 2, 46, 4, 3, '#d8a020');
  r(c, cx - 2, 49, 4, 22, '#d8a020');
  r(c, cx - 1, 49, 1, 22, '#f8d050');
  r(c, cx + 12, 62, 5, 3, '#c02020');
  // Hals + Kopf
  r(c, cx - 5, 40, 10, 8, skin);
  r(c, cx - 10, 16, 20, 26, skin);
  r(c, cx - 11, 20, 22, 18, skin);
  r(c, cx - 12, 25, 2, 6, skin);
  r(c, cx + 10, 25, 2, 6, skin);
  for (let i = 0; i < 12; i++) p(c, cx - 9 + Math.floor(rnd() * 18), 29 + Math.floor(rnd() * 5), '#d8906a'); // Sommersprossen
  if (open) for (const x of [cx - 9, cx - 8, cx + 7, cx + 8]) { p(c, x, 32, '#e86a5a'); p(c, x, 33, '#e86a5a'); } // rot vor Wut
  // Rote Locken
  const curl = (x: number, y: number) => {
    r(c, x, y, 3, 3, '#c8401a');
    p(c, x, y, '#f07a3a');
    p(c, x + 1, y, '#e8602a');
    p(c, x + 2, y + 2, '#8a2a10');
  };
  for (let y = 1; y < 20; y += 3)
    for (let x = cx - 16; x < cx + 16; x += 3) {
      const edge = y < 4 && (x < cx - 12 || x > cx + 10);
      if (!edge && !(y > 13 && Math.abs(x - cx + 1) < 9)) curl(x + (y % 2 ? 1 : 0), y);
    }
  for (let y = 19; y < 32; y += 3) { curl(cx - 15, y); curl(cx + 12, y); if (y < 26) { curl(cx - 13, y); curl(cx + 10, y); } }
  for (let i = 0; i < 10; i++) curl(cx - 16 + Math.floor(rnd() * 30), Math.floor(rnd() * 3)); // wilde Spitzen
  // Wütende Augenbrauen
  for (let i = 0; i < 5; i++) { p(c, cx - 9 + i, 21 + Math.floor(i / 2), '#a83010'); p(c, cx + 8 - i, 21 + Math.floor(i / 2), '#a83010'); }
  // Brille
  for (const gx of [cx - 9, cx + 2]) {
    r(c, gx, 24, 7, 6, '#141414');
    r(c, gx + 1, 25, 5, 4, '#d8ecf8');
    p(c, gx + 1, 25, '#ffffff');
    r(c, gx + 3, 26, 2, 2, '#2a3a5a');
  }
  r(c, cx - 2, 26, 4, 1, '#141414');
  r(c, cx - 11, 26, 2, 1, '#141414');
  r(c, cx + 9, 26, 2, 1, '#141414');
  // Nase + Mund
  r(c, cx - 1, 30, 3, 4, '#00000018');
  r(c, cx - 1, 33, 3, 1, '#e0a080');
  if (open) {
    r(c, cx - 4, 35, 8, 5, '#3a0e0a');
    r(c, cx - 3, 35, 6, 1, '#f4f0e0');
    r(c, cx - 2, 38, 4, 1, '#c04040');
  } else {
    r(c, cx - 4, 37, 8, 1, '#7a2a20');
    p(c, cx - 5, 38, '#7a2a20');
    p(c, cx + 4, 38, '#7a2a20');
  }
  if (prop === 0) {
    // Handy am Ohr
    r(c, cx + 11, 20, 4, 14, '#1a1a1a');
    p(c, cx + 12, 21, '#5a7aa0');
    r(c, cx + 10, 30, 6, 8, skin);
    r(c, cx + 9, 38, 8, 16, suit);
    r(c, cx + 9, 38, 8, 1, '#f4f4f4');
  } else {
    // Megafon vor dem Mund, zeigt nach links
    for (let k = 0; k < 16; k++) {
      const h = 4 + k;
      r(c, cx - 6 - k, 37 - Math.floor(h / 2), 1, h, k === 11 || k === 12 ? '#c02020' : '#ecece4');
    }
    r(c, cx - 22, 30, 1, 14, '#a8a8a0');
    r(c, cx - 10, 40, 5, 6, skin);
    r(c, cx - 11, 46, 8, 10, suit);
  }
  outline(c, ox, 0, 64, 96);
}

/** Pixelgenaue gefüllte Ellipse (ohne Kantenglättung). */
function blob(c: Ctx, cx: number, cy: number, rx: number, ry: number, col: string) {
  c.fillStyle = col;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) c.fillRect(x, y, 1, 1);
}

/** Das Endprodukt: verpestete Mutanten-Zombie-Katze. Frame 96x72, f = 0/1 (atmet, Maul auf). */
function drawMutant(c: Ctx, ox: number, f: number) {
  const rnd = rng(666);
  const fur = '#4e5a3c', fur2 = '#38412a', fur3 = '#66734c', skin = '#c08474', bone = '#ddd4b2', rot = '#4a1212';
  const X = (x: number) => ox + x;
  // Ekelpfütze
  blob(c, X(46), 69, 34, 3, '#4e7a22');
  blob(c, X(46), 69, 26, 2, '#6a9a30');
  // Tentakel-Schwänze
  for (let k = 0; k < 3; k++)
    for (let t = 0; t < 16; t++) {
      const x = 22 - t * 1.3 + Math.sin(t * 0.55 + k * 2 + f * 0.8) * 4;
      const y = 40 + k * 6 - t * 1.6 + Math.cos(t * 0.4 + k) * 2;
      const rr = Math.max(1, 4 - t / 4.5);
      blob(c, X(x), y, rr, rr, t > 12 ? skin : t % 3 ? fur : fur2);
    }
  // Beine mit Knochenkrallen
  for (const [lx, h] of [[26, 14], [34, 12], [50, 13], [58, 14]]) {
    r(c, X(lx), 54, 4, h, fur2);
    r(c, X(lx), 54, 1, h, fur);
    p(c, X(lx - 1), 54 + h, bone); p(c, X(lx + 1), 54 + h, bone); p(c, X(lx + 3), 54 + h, bone);
  }
  // Aufgeblähter Leib
  blob(c, X(42), 44 + f, 25, 15, fur);
  blob(c, X(44), 50 + f, 18, 7, fur3);
  for (let i = 0; i < 14; i++) blob(c, X(22 + rnd() * 42), 34 + rnd() * 20, 1 + rnd() * 2, 1 + rnd() * 1.5, fur2);
  // kahle Stellen mit Eiterbeulen
  for (const [bx, by, br] of [[30, 38, 5], [48, 52, 4], [56, 40, 3]]) {
    blob(c, X(bx), by + f, br, br * 0.7, skin);
    for (let i = 0; i < 3; i++) {
      const px = bx - br / 2 + rnd() * br, py = by - 1 + rnd() * 2 + f;
      blob(c, X(px), py, 1.2, 1.2, '#d8e050');
      p(c, X(Math.round(px)), Math.round(py), '#f4f8a0');
    }
  }
  // freiliegende Rippen
  blob(c, X(40), 42 + f, 7, 5, rot);
  for (let i = 0; i < 4; i++) r(c, X(35 + i * 3), 38 + f, 1, 9, bone);
  // Knochenstacheln auf dem Rücken
  for (let i = 0; i < 6; i++) {
    const sx = 24 + i * 6, h = 4 + (i % 2) * 3;
    for (let k = 0; k < h; k++) p(c, X(sx + Math.floor(k / 3)), 30 - k + f, bone);
  }
  // Kopf (deformiert, schief)
  blob(c, X(74), 34 + f, 15, 13, fur);
  blob(c, X(80), 30 + f, 8, 7, fur3);
  blob(c, X(68), 26 + f, 4, 3, skin);
  // zerfetzte Ohren
  for (let k = 0; k < 7; k++) { p(c, X(64 + Math.floor(k / 2)), 22 - k + f, fur); p(c, X(65 + Math.floor(k / 2)), 22 - k + f, fur2); }
  for (let k = 0; k < 5; k++) p(c, X(84 - Math.floor(k / 2)), 22 - k + f, fur);
  p(c, X(83), 17 + f, skin);
  // Maul
  const mh = f ? 9 : 6;
  blob(c, X(78), 42 + f, 11, mh / 2 + 1, '#200606');
  blob(c, X(78), 43 + f, 8, mh / 2 - 1, '#5a1010');
  for (let x = 68; x <= 88; x += 2) {
    const tl = 2 + ((x * 7) % 3);
    r(c, X(x), 39 - mh / 2 + 1 + f, 1, tl, bone);
    r(c, X(x + 1), 44 + mh / 2 - tl + f, 1, tl, bone);
  }
  // grüner Sabber
  for (const [dx, len] of [[71, 6 + f * 4], [77, 10 + f * 5], [84, 5 + f * 3]]) {
    r(c, X(dx), 46 + f, 1, len, '#8ac83a');
    p(c, X(dx), 46 + f + len, '#b8f060');
  }
  // viele Augen
  const eyes: [number, number, number, string][] = [
    [72, 29, 3.2, '#f0e840'], [81, 27, 2.4, '#ff3a10'], [86, 33, 1.8, '#f0e840'], [66, 33, 1.6, '#ff3a10'], [77, 22, 1.5, '#dfe6d8'], [62, 28, 1.2, '#f0e840'],
  ];
  for (const [ex, ey, er, col] of eyes) {
    blob(c, X(ex), ey + f, er + 0.8, er + 0.8, '#200606');
    blob(c, X(ex), ey + f, er, er, col);
    if (col !== '#dfe6d8') r(c, X(Math.round(ex)), Math.round(ey - er + 1) + f, 1, Math.max(1, Math.round(er * 2 - 1)), '#0a0a0a');
    p(c, X(Math.round(ex - er / 2)), Math.round(ey - er / 2) + f, '#ffffff');
  }
  // Fliegen
  for (let i = 0; i < 6; i++) p(c, X(10 + rnd() * 80), 4 + rnd() * 20 + (f ? 2 : 0), '#111111');
  outline(c, ox, 0, 96, 72);
}

function drawBulldozer(c: Ctx) {
  r(c, 4, 30, 60, 12, '#1a1a1a');
  for (let x = 8; x < 62; x += 8) r(c, x, 33, 4, 6, '#444');
  r(c, 10, 16, 44, 14, '#e8b020');
  r(c, 10, 16, 44, 2, '#f8d050');
  r(c, 34, 2, 20, 16, '#e8b020');
  r(c, 37, 5, 14, 9, '#8ab0d0');
  r(c, 14, 20, 16, 3, '#1a1a1a');
  r(c, 0, 10, 4, 30, '#9a9aa0');
  r(c, 4, 22, 8, 3, '#5a5a60');
  outline(c, 0, 0, 72, 44);
}

// ---------------------------------------------------------------- Einstieg

export function makeAllTextures(scene: Phaser.Scene) {
  tiles(scene);
  items(scene);
  humanSheet(scene, 'penner', PLAYER_PAL);
  humanSheet(scene, 'wirt', WIRT_PAL);
  humanSheet(scene, 'dealer', DEALER_PAL);
  humanSheet(scene, 'polizist', COP_PAL);
  DAME_PALS.forEach((pal, i) => humanSheet(scene, `dame${i}`, pal));
  SCHNOESEL_PALS.forEach((pal, i) => humanSheet(scene, `schnoesel${i}`, pal));
  for (let s = 0; s < 5; s++) tex(scene, `bust${s}`, BW, BH, (c) => drawSchnoeselBust(c, s));
  tex(scene, 'bustPenner', BW, BH, drawPennerBust);
  tex(scene, 'bustWirt', BW, BH, drawWirtBust);
  tex(scene, 'tresenBg', 480, 200, drawTresenBg);
  tex(scene, 'counterFront', 480, 84, drawCounter);
  tex(scene, 'csStreet', 480, 270, drawStreet);
  tex(scene, 'bulldozer', 72, 44, drawBulldozer);
  const mutant = tex(scene, 'mutant', 192, 72, (c) => {
    drawMutant(c, 0, 0);
    drawMutant(c, 96, 1);
  });
  mutant.add(0, 0, 0, 0, 96, 72);
  mutant.add(1, 0, 96, 0, 96, 72);
  for (const [key, prop] of [['brennPhone', 0], ['brennMega', 1]] as const) {
    const t = tex(scene, key, 128, 96, (c) => {
      drawBrenninger(c, 0, false, prop);
      drawBrenninger(c, 64, true, prop);
    });
    t.add(0, 0, 0, 0, 64, 96);
    t.add(1, 0, 64, 0, 64, 96);
  }

  const a = scene.anims;
  for (const k of ['penner', 'dealer', 'wirt', 'dame0', 'dame1', 'polizist', ...SCHNOESEL_PALS.map((_, i) => `schnoesel${i}`)]) {
    a.create({ key: `${k}_down`, frames: [1, 0, 2, 0].map((f) => ({ key: k, frame: f })), frameRate: 8, repeat: -1 });
    a.create({ key: `${k}_up`, frames: [4, 3, 5, 3].map((f) => ({ key: k, frame: f })), frameRate: 8, repeat: -1 });
    a.create({ key: `${k}_side`, frames: [7, 6, 8, 6].map((f) => ({ key: k, frame: f })), frameRate: 8, repeat: -1 });
  }
  a.create({ key: 'mutant_idle', frames: [{ key: 'mutant', frame: 0 }, { key: 'mutant', frame: 1 }], frameRate: 3, repeat: -1 });
  a.create({ key: 'cat_idle', frames: [{ key: 'cat', frame: 0 }, { key: 'cat', frame: 1 }], frameRate: 2, repeat: -1 });
}
