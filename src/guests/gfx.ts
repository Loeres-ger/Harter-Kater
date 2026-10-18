import Phaser from 'phaser';
import { Ctx, blob, humanSheet, outline, p, r, tex } from '../gfx';
import { BustLook, GUESTS } from './data';

// Grafiken der Stammgäste: Draufsicht-Figuren, Brustbilder für den Kampf, Fäuste des Wirts.

const BW = 64, BH = 96;

/** Brustbild eines Gastes in Kampfstimmung (wütend). */
function drawBust(c: Ctx, L: BustLook) {
  const cx = 32;
  // Oberkörper
  r(c, cx - 22, 52, 44, 44, L.top);
  r(c, cx - 24, 58, 48, 38, L.top);
  r(c, cx - 20, 50, 40, 4, L.top);
  r(c, cx + 14, 54, 10, 42, L.top2);
  switch (L.outfit) {
    case 'vest': // Warnweste über grauem Shirt
      r(c, cx - 6, 48, 12, 14, '#8a8a90');
      r(c, cx - 24, 70, 48, 3, '#e8e8d0');
      r(c, cx - 24, 82, 48, 3, '#e8e8d0');
      r(c, cx - 1, 60, 2, 36, '#c85a10');
      break;
    case 'hoodie':
      r(c, cx - 15, 44, 30, 8, L.top2);
      r(c, cx - 5, 50, 1, 12, L.accent); r(c, cx + 4, 50, 1, 12, L.accent);
      r(c, cx - 10, 78, 20, 10, L.top2); // Bauchtasche
      break;
    case 'leather':
      r(c, cx - 6, 48, 12, 30, '#e8e8e8');
      r(c, cx - 9, 50, 4, 26, '#2a2a30'); r(c, cx + 5, 50, 4, 26, '#2a2a30');
      r(c, cx + 9, 56, 1, 40, L.accent); // Reißverschluss
      for (let i = 0; i < 4; i++) p(c, cx - 18 + i * 3, 64, L.accent); // Nieten
      break;
    case 'jersey':
      for (let x = cx - 22; x < cx + 24; x += 8) r(c, x, 56, 2, 40, L.accent);
      r(c, cx - 4, 64, 3, 9, L.accent); r(c, cx + 1, 64, 4, 9, L.accent); // Rückennummer vorne „10“
      r(c, cx - 12, 44, 24, 7, '#ffffff'); // Schal
      for (let x = cx - 12; x < cx + 12; x += 4) r(c, x, 44, 2, 7, L.top);
      break;
    case 'shirt':
      r(c, cx - 7, 46, 14, 4, '#ffffff');
      r(c, cx - 2, 48, 4, 3, L.accent);
      r(c, cx - 2, 51, 4, 22, L.accent);
      r(c, cx - 22, 66, 8, 1, L.top2); r(c, cx + 14, 66, 8, 1, L.top2); // Ärmelfalten
      break;
    case 'cardigan':
      r(c, cx - 6, 48, 12, 30, '#f4f0e8');
      for (let y = 56; y < 92; y += 8) p(c, cx + 7, y, '#e8d0a0');
      for (let i = 0; i < 9; i++) blob(c, cx - 8 + i * 2, 50 + Math.abs(i - 4) * 0.8, 0.9, 0.9, '#f8f8ff'); // Perlenkette
      break;
  }
  // Hals + Kopf
  const skin = L.skin;
  r(c, cx - 5, 40, 10, 8, skin);
  r(c, cx - 10, 14, 20, 28, skin);
  r(c, cx - 11, 18, 22, 20, skin);
  r(c, cx - 12, 25, 2, 6, skin); r(c, cx + 10, 25, 2, 6, skin);
  // Haare / Kopfbedeckung
  const h = L.hair;
  switch (L.style) {
    case 'short':
      r(c, cx - 11, 10, 22, 7, h); r(c, cx - 12, 14, 3, 8, h); r(c, cx + 9, 14, 3, 8, h);
      break;
    case 'long':
      r(c, cx - 11, 9, 22, 8, h); r(c, cx - 14, 12, 5, 40, h); r(c, cx + 9, 12, 5, 40, h);
      r(c, cx - 8, 16, 6, 3, h);
      break;
    case 'bald':
      r(c, cx - 12, 22, 2, 6, h); r(c, cx + 10, 22, 2, 6, h);
      r(c, cx - 4, 15, 6, 2, '#ffffff33');
      break;
    case 'helmet':
      r(c, cx - 13, 6, 26, 10, L.accent); r(c, cx - 15, 15, 30, 3, '#c89810'); r(c, cx - 2, 6, 4, 10, '#f8e070');
      break;
    case 'cap':
      r(c, cx - 11, 14, 22, 3, h);
      r(c, cx - 12, 7, 24, 9, L.top); r(c, cx - 2, 15, 18, 3, L.top2); r(c, cx - 1, 9, 3, 3, L.accent);
      break;
    case 'bun':
      r(c, cx - 11, 10, 22, 8, h); r(c, cx - 12, 14, 3, 10, h); r(c, cx + 9, 14, 3, 10, h);
      blob(c, cx, 7, 6, 4.5, h);
      for (let i = 0; i < 6; i++) p(c, cx - 9 + i * 3, 11, '#b0b0b0');
      break;
  }
  // wütende Augenbrauen
  for (let i = 0; i < 5; i++) { p(c, cx - 9 + i, 21 + Math.floor(i / 2), '#2a1a10'); p(c, cx + 8 - i, 21 + Math.floor(i / 2), '#2a1a10'); }
  // Augen
  r(c, cx - 7, 25, 4, 3, '#f8f8f0'); r(c, cx + 3, 25, 4, 3, '#f8f8f0');
  r(c, cx - 5, 25, 2, 2, '#2a1a10'); r(c, cx + 4, 25, 2, 2, '#2a1a10');
  if (L.glasses) {
    for (const gx of [cx - 9, cx + 2]) { r(c, gx, 24, 7, 1, '#1a1a1a'); r(c, gx, 29, 7, 1, '#1a1a1a'); r(c, gx, 24, 1, 6, '#1a1a1a'); r(c, gx + 6, 24, 1, 6, '#1a1a1a'); }
    r(c, cx - 2, 26, 4, 1, '#1a1a1a');
  }
  // rote Wutbacken, Nase, brüllender Mund
  r(c, cx - 9, 31, 3, 2, '#e07060'); r(c, cx + 6, 31, 3, 2, '#e07060');
  r(c, cx - 1, 28, 3, 5, '#00000018');
  r(c, cx - 4, 35, 8, 4, '#3a0e0a');
  r(c, cx - 3, 35, 6, 1, '#f4f0e0');
  if (L.beard) for (let y = 31; y < 43; y++) for (let x = cx - 11; x < cx + 11; x++) {
    if (y < 34 && Math.abs(x - cx) < 6) continue;
    if (y >= 34 && y <= 39 && Math.abs(x - cx) < 5) continue;
    if ((x * 7 + y * 3) % 5 !== 0) p(c, x, y, L.beard);
  }
  outline(c, 0, 0, BW, BH);
}

/** Faust des Wirts (von unten ins Bild). */
function drawFist(c: Ctx) {
  r(c, 4, 22, 24, 26, '#e8e8e2'); // Hemdsärmel
  r(c, 4, 22, 24, 3, '#c4c4bc');
  blob(c, 16, 14, 12, 11, '#f0c08a');
  for (let i = 0; i < 4; i++) r(c, 7 + i * 5, 4, 4, 6, '#f0c08a');
  for (let i = 0; i < 4; i++) r(c, 7 + i * 5, 9, 4, 1, '#c8905a');
  r(c, 5, 12, 5, 7, '#e8b07a'); // Daumen
  outline(c, 0, 0, 32, 48);
}

// ---------------------------------------------------------------- Kampf-Effekte

/** Comic-Explosion (Zacken-Stern) hinter „BAM!“ */
function drawBurst(c: Ctx) {
  const pts = (rOut: number, rIn: number, n: number) => {
    c.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 ? rIn : rOut;
      const x = 32 + Math.cos(a) * rad, y = 32 + Math.sin(a) * rad;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
  };
  c.fillStyle = '#120c0b'; pts(32, 15, 11); c.fill();
  c.fillStyle = '#f8b020'; pts(29, 13, 11); c.fill();
  c.fillStyle = '#fff4a0'; pts(19, 9, 11); c.fill();
}

/** Rote Ränder: Schaden / wenig Leben */
function drawVignette(c: Ctx) {
  const g = c.createRadialGradient(240, 135, 90, 240, 135, 290);
  g.addColorStop(0, 'rgba(160,0,0,0)');
  g.addColorStop(0.6, 'rgba(160,0,0,0.25)');
  g.addColorStop(1, 'rgba(120,0,0,0.85)');
  c.fillStyle = g;
  c.fillRect(0, 0, 480, 270);
}

function fightFx(scene: Phaser.Scene) {
  tex(scene, 'burst', 64, 64, drawBurst);
  tex(scene, 'vignette', 480, 270, drawVignette);
  tex(scene, 'spark', 4, 4, (c) => { r(c, 1, 0, 2, 4, '#ffffff'); r(c, 0, 1, 4, 2, '#ffffff'); });
  tex(scene, 'sweat', 4, 6, (c) => { r(c, 1, 0, 2, 2, '#bfe8ff'); r(c, 0, 2, 4, 3, '#8fd0ff'); p(c, 1, 2, '#ffffff'); });
  tex(scene, 'dust', 8, 8, (c) => blob(c, 4, 4, 3.5, 3.5, '#c8b898'));
  tex(scene, 'star', 7, 7, (c) => {
    r(c, 3, 0, 1, 7, '#f8e070'); r(c, 0, 3, 7, 1, '#f8e070'); r(c, 2, 2, 3, 3, '#fff4a0');
  });
  // Verletzungen fürs Brustbild (Maßstab 1 : Bild wird ×2 gezeichnet)
  tex(scene, 'bruise', 8, 6, (c) => { blob(c, 4, 3, 3.5, 2.5, '#6a3a7a'); blob(c, 4, 3, 2, 1.4, '#8a4a9a'); });
  tex(scene, 'bandaid', 12, 5, (c) => {
    r(c, 0, 1, 12, 3, '#e8c090'); r(c, 4, 0, 4, 5, '#f4dcb8');
    p(c, 5, 2, '#c89a70'); p(c, 7, 2, '#c89a70');
    outline(c, 0, 0, 12, 5);
  });
}

export function makeGuestTextures(scene: Phaser.Scene) {
  if (!scene.textures.exists('burst')) fightFx(scene);
  if (scene.textures.exists('fist')) return;
  for (const g of GUESTS) {
    humanSheet(scene, `guest_${g.id}`, g.pal);
    const k = `guest_${g.id}`;
    scene.anims.create({ key: `${k}_down`, frames: [1, 0, 2, 0].map((f) => ({ key: k, frame: f })), frameRate: 8, repeat: -1 });
    scene.anims.create({ key: `${k}_side`, frames: [7, 6, 8, 6].map((f) => ({ key: k, frame: f })), frameRate: 8, repeat: -1 });
    tex(scene, `gbust_${g.id}`, BW, BH, (c) => drawBust(c, g.bust));
  }
  tex(scene, 'fist', 32, 48, drawFist);
}
