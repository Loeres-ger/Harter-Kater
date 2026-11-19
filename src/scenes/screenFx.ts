import Phaser from 'phaser';
import { H, W, txt } from '../ui';

// Gemeinsame Bausteine für Titel- und Verloren-Bildschirm: Kalle als Kulisse, Verläufe, Regen, Rauch,
// und der plastische Schriftzug „HARTER KARTER“.

export const GAME_TITLE = 'HARTER KARTER';

/** Horizontaler Verlauf aus schmalen Streifen (sieht pixelig aus und läuft auch ohne WebGL-Verläufe). */
export function hGradient(scene: Phaser.Scene, x0: number, x1: number, y: number, h: number, color: number, a0: number, a1: number, depth = 0) {
  const steps = 24, w = (x1 - x0) / steps;
  for (let i = 0; i < steps; i++) {
    const a = a0 + (a1 - a0) * (i / (steps - 1));
    scene.add.rectangle(x0 + i * w, y, Math.ceil(w) + 1, h, color, a).setOrigin(0).setDepth(depth);
  }
}

/** Vertikaler Verlauf, z. B. für dunkle Ränder oben und unten. */
export function vGradient(scene: Phaser.Scene, x: number, w: number, y0: number, y1: number, color: number, a0: number, a1: number, depth = 0) {
  const steps = 16, h = (y1 - y0) / steps;
  for (let i = 0; i < steps; i++) {
    const a = a0 + (a1 - a0) * (i / (steps - 1));
    scene.add.rectangle(x, y0 + i * h, w, Math.ceil(h) + 1, color, a).setOrigin(0).setDepth(depth);
  }
}

/**
 * Kalle pennt am Tisch: großes Brustbild, leicht zur Seite gekippt, atmet schwer, Zzz steigen auf.
 * Davor ein Tisch mit leeren Flaschen und einem qualmenden Aschenbecher.
 */
export function kalleAtTable(scene: Phaser.Scene, x: number, tableY: number, opts: { tint?: number; depth?: number } = {}) {
  const depth = opts.depth ?? 10;
  const kalle = scene.add.image(x, tableY + 8, 'bustPenner').setOrigin(0.5, 1).setAngle(-9).setDepth(depth);
  if (opts.tint) kalle.setTint(opts.tint);
  scene.tweens.add({ targets: kalle, scaleY: 1.015, angle: -8, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  // Tisch
  const table = scene.add.graphics().setDepth(depth + 1);
  table.fillStyle(0x3a2216).fillRect(x - 120, tableY, 240, 7);
  table.fillStyle(0x5a3826).fillRect(x - 120, tableY, 240, 2);
  table.fillStyle(0x24140c).fillRect(x - 120, tableY + 7, 240, 40);
  // Flaschen und Gläser auf dem Tisch
  const bottles: [number, number, number][] = [[-86, 0x3a6a2a, 22], [-70, 0x6a4a1a, 18], [74, 0x3a6a2a, 20], [-40, 0x8a6a2a, 10]];
  for (const [dx, col, hgt] of bottles) {
    table.fillStyle(col, 0.9).fillRect(x + dx, tableY - hgt, 6, hgt);
    table.fillStyle(col, 0.9).fillRect(x + dx + 2, tableY - hgt - 5, 2, 5);
    table.fillStyle(0xffffff, 0.25).fillRect(x + dx + 1, tableY - hgt + 2, 1, hgt - 4);
  }
  // umgekipptes Glas
  table.fillStyle(0xc8d8e0, 0.5).fillRect(x + 40, tableY - 4, 12, 4);
  // Aschenbecher mit Kippe
  table.fillStyle(0x2a2a2e).fillRect(x + 88, tableY - 3, 14, 3);
  table.fillStyle(0xf0e8d8).fillRect(x + 96, tableY - 5, 6, 1);
  table.fillStyle(0xff6020).fillRect(x + 102, tableY - 5, 1, 1);
  const smoke = scene.add.particles(x + 102, tableY - 6, 'light', {
    lifespan: 3200, speedY: { min: -14, max: -7 }, speedX: { min: -4, max: 5 }, scale: { start: 0.04, end: 0.28 },
    alpha: { start: 0.22, end: 0 }, tint: 0xc8c0b8, frequency: 260,
  }).setDepth(depth + 2);
  // Zzz
  const zzz = scene.time.addEvent({
    delay: 1700, loop: true,
    callback: () => {
      const z = txt(scene, x + 28, tableY - 150, 'z', '#c8c8e8', 8).setDepth(depth + 3).setAlpha(0.9);
      scene.tweens.add({ targets: z, x: z.x + 18, y: z.y - 30, alpha: 0, scale: 1.8, duration: 2400, onComplete: () => z.destroy() });
    },
  });
  return { kalle, table, smoke, zzz };
}

/** Plastischer Titelschriftzug: dunkle Extrusion, Gold oben, schmaler Glanz. Liefert einen Container. */
export function bigTitle(scene: Phaser.Scene, x: number, y: number, lines: string[], size = 32) {
  const c = scene.add.container(x, y);
  lines.forEach((line, i) => {
    const ly = i * (size + 6);
    for (let d = 5; d >= 1; d--) c.add(txt(scene, d, ly + d, line, d > 3 ? '#1a0a04' : '#5a2a0a', size));
    c.add(txt(scene, 0, ly, line, '#f0c030', size).setStroke('#2a1206', 2));
    // Glanzkante: obere Hälfte heller
    const shine = txt(scene, 0, ly, line, '#fff0a0', size);
    const mask = scene.make.graphics({}, false).fillRect(x - 10, y + ly - 4, 480, size * 0.42).createGeometryMask();
    shine.setMask(mask).setAlpha(0.55);
    c.add(shine);
  });
  return c;
}

/** Regen, der nur innerhalb eines Rechtecks fällt (z. B. hinter einer Fensterscheibe). Im update aufrufen. */
export function drawRain(g: Phaser.GameObjects.Graphics, time: number, x: number, y: number, w: number, h: number, n = 26, color = 0x8aa0d0, alpha = 0.4) {
  g.clear().lineStyle(1, color, alpha);
  for (let i = 0; i < n; i++) {
    const rx = x + ((i * 37 + time * 0.03) % w);
    const ry = y + ((i * 53 + time * 0.25) % h);
    g.lineBetween(rx, ry, rx - 1, Math.min(y + h, ry + 6));
  }
}

/** Kulisse von Titel- und Pausenbildschirm: die Kneipe bei Nacht, Regen am Fenster, Katzenaugen, Hängelampe, Kalle pennt. */
export function tavernBackdrop(scene: Phaser.Scene) {
  scene.add.image(0, 0, 'tresenBg').setOrigin(0).setTint(0x8a7a9a);
  scene.add.rectangle(0, 200, W, 70, 0x120a08).setOrigin(0);
  // Regen am Fenster, draußen glühen zwei Katzenaugen
  const rain = scene.add.graphics().setDepth(1);
  const eyes = [scene.add.rectangle(64, 104, 2, 1, 0x9aff60), scene.add.rectangle(70, 104, 2, 1, 0x9aff60)];
  eyes.forEach((e) => e.setDepth(1));
  scene.time.addEvent({ delay: 2600, loop: true, callback: () => { eyes.forEach((e) => e.setVisible(false)); scene.time.delayedCall(140, () => eyes.forEach((e) => e.setVisible(true))); } });
  const onUpdate = (t: number) => drawRain(rain, t, 28, 32, 96, 80);
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));

  // Hängelampe über Kalles Tisch mit Lichtkegel und tanzendem Staub
  const KX = 392, TY = 204;
  const lamp = scene.add.graphics().setDepth(20);
  lamp.fillStyle(0x1a1410).fillRect(KX - 1, 0, 2, 22);
  lamp.fillStyle(0x2a3a2a).fillTriangle(KX - 16, 32, KX + 16, 32, KX, 20);
  lamp.fillStyle(0xfff0b0).fillRect(KX - 4, 31, 8, 3);
  const cone = scene.add.image(KX, 120, 'light').setBlendMode(Phaser.BlendModes.ADD).setScale(2.2, 3.4).setTint(0xffc870).setAlpha(0.35).setDepth(15);
  scene.tweens.add({ targets: cone, alpha: 0.27, duration: 120, yoyo: true, repeat: -1, repeatDelay: 2600 });
  scene.add.particles(0, 0, 'light', {
    x: { min: KX - 60, max: KX + 60 }, y: { min: 40, max: 190 }, lifespan: 4000, speedX: { min: -3, max: 3 }, speedY: { min: -2, max: 2 },
    scale: { start: 0.015, end: 0.03 }, alpha: { start: 0.5, end: 0 }, tint: 0xffe0a0, frequency: 120, blendMode: 'ADD',
  }).setDepth(16);

  // Kalle pennt am Tisch
  kalleAtTable(scene, KX, TY, { depth: 10 });

  // dunkler Verlauf links (Platz für Schrift), dunkle Ränder oben und unten
  hGradient(scene, 0, 300, 0, H, 0x0a0608, 0.94, 0, 30);
  vGradient(scene, 0, W, 0, 30, 0x000000, 0.7, 0, 30);
  vGradient(scene, 0, W, 210, H, 0x000000, 0, 0.85, 30);
}

/** feine Scanlines über allem: Röhrenfernseher-Look */
export function scanlines(scene: Phaser.Scene, depth = 60) {
  const scan = scene.add.graphics().setDepth(depth);
  for (let y = 0; y < H; y += 2) scan.fillStyle(0x000000, 0.12).fillRect(0, y, W, 1);
}
