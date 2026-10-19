import Phaser from 'phaser';
import { audio } from '../audio';
import { Btn } from './ShopScene';

export interface NavItem {
  btn: Btn;
  w: number;
  h: number;
  act: () => void;
}

/**
 * Tastatursteuerung für Button-Menüs: Pfeile/WS wählen, Enter/Leertaste/E bestätigen.
 * Maus und Touch bedienen die Buttons weiterhin direkt.
 */
export function menuNav(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, items: NavItem[]) {
  let idx = -1;
  const cursor = scene.add.rectangle(0, 0, 10, 10, 0x000000, 0).setStrokeStyle(2, 0xf8e070).setVisible(false);
  parent.add(cursor);
  const show = () => {
    const it = items[idx];
    cursor.setPosition(it.btn.box.x, it.btn.box.y).setSize(it.w + 6, it.h + 6).setVisible(true);
    cursor.setOrigin(0.5);
  };
  const move = (d: number) => {
    idx = idx < 0 ? 0 : (idx + d + items.length) % items.length;
    audio.sfx('blip');
    show();
  };
  const kb = scene.input.keyboard!;
  for (const k of ['UP', 'W']) kb.on(`keydown-${k}`, () => move(-1));
  for (const k of ['DOWN', 'S']) kb.on(`keydown-${k}`, () => move(1));
  for (const k of ['ENTER', 'SPACE', 'E']) kb.on(`keydown-${k}`, () => {
    if (idx < 0) return move(0);
    audio.sfx('click');
    items[idx].act();
  });
}
