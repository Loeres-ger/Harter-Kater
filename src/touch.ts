import Phaser from 'phaser';
import { H, W, txt } from './ui';

/** Gemeinsamer Touch-Zustand: Joystick-Richtung und Aktions-Callback. */
export const touch = {
  vx: 0,
  vy: 0,
  /** wird von der aktiven Draufsicht-Szene gesetzt */
  onAction: null as null | (() => void),
};

export function isTouchDevice(scene: Phaser.Scene) {
  return scene.sys.game.device.input.touch || (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches);
}

const RADIUS = 30;

/** Schwebender Joystick (linke Bildhälfte) + Aktionsknopf rechts. */
export function addTouchControls(scene: Phaser.Scene) {
  if (!isTouchDevice(scene)) return;
  scene.input.addPointer(2);

  const baseX = 62, baseY = H - 72;
  const base = scene.add.circle(baseX, baseY, RADIUS, 0x000000, 0.35).setStrokeStyle(2, 0xf4ead0, 0.5).setDepth(9500);
  const thumb = scene.add.circle(baseX, baseY, 14, 0xf4ead0, 0.6).setDepth(9501);
  let stickId: number | null = null;
  let cx = baseX, cy = baseY;

  const btnX = W - 52, btnY = H - 66;
  const btn = scene.add.circle(btnX, btnY, 24, 0xc9a24a, 0.75).setStrokeStyle(2, 0x000000, 0.8).setDepth(9500);
  const btnLabel = txt(scene, btnX, btnY, 'E', '#1a1212', 16).setOrigin(0.5).setDepth(9501);
  let btnId: number | null = null;

  const reset = () => {
    stickId = null;
    touch.vx = touch.vy = 0;
    cx = baseX;
    cy = baseY;
    base.setPosition(baseX, baseY);
    thumb.setPosition(baseX, baseY);
  };

  scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
    if (Phaser.Math.Distance.Between(p.x, p.y, btnX, btnY) < 40) {
      btnId = p.id;
      btn.setScale(0.9).setFillStyle(0xf8d070, 0.9);
      touch.onAction?.();
      return;
    }
    if (p.x < W / 2 && stickId === null) {
      stickId = p.id;
      cx = Phaser.Math.Clamp(p.x, RADIUS + 4, W / 2 - RADIUS);
      cy = Phaser.Math.Clamp(p.y, 40, H - RADIUS - 4);
      base.setPosition(cx, cy);
      thumb.setPosition(cx, cy);
    }
  });
  scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
    if (p.id !== stickId) return;
    const dx = p.x - cx, dy = p.y - cy;
    const len = Math.hypot(dx, dy);
    const k = len > RADIUS ? RADIUS / len : 1;
    thumb.setPosition(cx + dx * k, cy + dy * k);
    const nx = (dx * k) / RADIUS, ny = (dy * k) / RADIUS;
    const mag = Math.hypot(nx, ny);
    touch.vx = mag < 0.2 ? 0 : nx;
    touch.vy = mag < 0.2 ? 0 : ny;
  });
  const up = (p: Phaser.Input.Pointer) => {
    if (p.id === stickId) reset();
    if (p.id === btnId) {
      btnId = null;
      btn.setScale(1).setFillStyle(0xc9a24a, 0.75);
    }
  };
  scene.input.on('pointerup', up);
  scene.input.on('pointerupoutside', up);
  scene.events.on(Phaser.Scenes.Events.SLEEP, reset);
  void btnLabel;
}
