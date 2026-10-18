import Phaser from 'phaser';

export const FONT = '"Press Start 2P", monospace';
export const W = 480;
export const H = 270;

// Innenabstand, damit Umlaut-Punkte und Konturen (Stroke) nicht abgeschnitten werden
const PAD = 5;

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, color = '#f4ead0', size = 8) {
  const t = scene.add
    .text(x - PAD, y - PAD, s, { fontFamily: FONT, fontSize: `${size}px`, color, lineSpacing: 3, padding: { x: PAD, y: PAD } })
    .setResolution(1);
  // Der Ankerpunkt soll sich auf die Schrift beziehen, nicht auf den Innenabstand:
  // bei Ursprung 0 um -PAD verschieben, bei 0.5 gar nicht, bei 1 um +PAD.
  const setOrigin = t.setOrigin.bind(t);
  t.setOrigin = ((ox = 0.5, oy = ox) => {
    t.x += PAD * 2 * (ox - t.originX);
    t.y += PAD * 2 * (oy - t.originY);
    return setOrigin(ox, oy);
  }) as typeof t.setOrigin;
  return t;
}

/** Schwebender Text, der nach oben weggleitet (z. B. „+8€“). */
export function floatText(scene: Phaser.Scene, x: number, y: number, s: string, color: string) {
  const t = txt(scene, x, y, s, color).setOrigin(0.5).setDepth(2000);
  t.setStroke('#120c0b', 3);
  scene.tweens.add({ targets: t, y: y - 22, alpha: 0, duration: 1300, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
  return t;
}

export function fadeTo(scene: Phaser.Scene, key: string, data?: object) {
  scene.cameras.main.fadeOut(260, 0, 0, 0);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => scene.scene.start(key, data));
}
