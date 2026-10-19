import Phaser from 'phaser';
// Pixel-Schrift lokal ausliefern (keine Anfrage an Google, DSGVO-freundlich)
import '@fontsource/press-start-2p/latin-400.css';
import { state, tick } from './state';
import { audio } from './audio';
import { H, W } from './ui';
import { TitleScene } from './scenes/TitleScene';
import { BarScene } from './scenes/BarScene';
import { AlleyScene } from './scenes/AlleyScene';
import { TresenScene } from './scenes/TresenScene';
import { EndScene } from './scenes/EndScene';
import { HudScene } from './scenes/HudScene';
import { CutsceneScene } from './scenes/CutsceneScene';
import { ShopScene } from './scenes/ShopScene';
import { PauseScene } from './scenes/PauseScene';
import { SahneScene } from './casino/SahneScene';
import { RatteScene } from './casino/RatteScene';
import { DerbyScene } from './casino/DerbyScene';
import { FightScene } from './guests/FightScene';
import { DialogScene } from './dialog/DialogScene';
import { NotifyScene } from './scenes/NotifyScene';
import { AchievementsScene } from './scenes/AchievementsScene';
import { AtticScene } from './rooms/AtticScene';
import { MensRoomScene } from './rooms/MensRoomScene';
import { LadiesRoomScene } from './rooms/LadiesRoomScene';
import { StallScene } from './rooms/StallScene';
import { ShopRoomScene } from './rooms/ShopRoomScene';

/** Unbehandelte Fehler sichtbar machen (einmal, nicht spammen), damit ein Ladefehler auf dem Handy nicht nur schwarz bleibt. */
function showError(msg: string) {
  const el = document.getElementById('error');
  if (!el || el.classList.contains('show')) return;
  el.textContent = `Da ist etwas schiefgelaufen: ${msg} – bitte die Seite neu laden.`;
  el.classList.add('show');
}
window.addEventListener('error', (e) => {
  console.error('[Harter Kater]', e.error ?? e.message);
  showError(String(e.message || e.error));
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Harter Kater]', e.reason);
  showError(String(e.reason?.message ?? e.reason));
});

async function boot() {
  // Pixel-Font laden, bevor Texte erzeugt werden
  try {
    await Promise.race([document.fonts.load('8px "Press Start 2P"'), new Promise((r) => setTimeout(r, 2500))]);
  } catch {
    /* Fallback: monospace */
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#0d0b0a',
    // FIT: proportional einpassen, Balken wo nötig. Der Container bekommt seine Größe aus dem CSS.
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, expandParent: false },
    scene: [TitleScene, BarScene, AlleyScene, AtticScene, MensRoomScene, LadiesRoomScene, ShopRoomScene, TresenScene, EndScene, HudScene, CutsceneScene, ShopScene, SahneScene, RatteScene, DerbyScene, FightScene, DialogScene, StallScene, PauseScene, AchievementsScene, NotifyScene],
  });

  if (import.meta.env.DEV) {
    Object.assign(window, { game, audio });
    Object.defineProperty(window, 'st', { get: () => state });
  }
  // Pause-Knopf oben rechts (liegt im Spiel-Container, also auch im Vollbild sichtbar)
  const pauseBtn = document.getElementById('pause') as HTMLButtonElement | null;
  const togglePause = () => {
    audio.unlock();
    if (game.scene.isActive('Achievements')) return; // erst die Liste schließen
    if (game.scene.isActive('Pause')) (game.scene.getScene('Pause') as PauseScene).close();
    else PauseScene.open(game);
  };
  pauseBtn?.addEventListener('click', () => {
    togglePause();
    pauseBtn.blur(); // sonst löst die Leertaste den Knopf erneut aus
  });
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'm') audio.toggleMute();
    if (k === 'p') togglePause();
  });

  game.events.on(Phaser.Core.Events.STEP, (_t: number, delta: number) => tick(Math.min(delta, 100) / 1000));

  // Größe neu berechnen, wenn sich der sichtbare Bereich ändert: Drehen, Adressleiste ein/aus, Tab wieder sichtbar.
  // Gebündelt auf einen Frame, damit nicht mehrere Skalierungen gegeneinander laufen.
  let pending = 0;
  const refresh = () => {
    if (pending) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      game.scale.refresh();
    });
  };
  const container = document.getElementById('game');
  if (container && 'ResizeObserver' in window) new ResizeObserver(refresh).observe(container);
  window.visualViewport?.addEventListener('resize', refresh);
  window.addEventListener('orientationchange', () => setTimeout(refresh, 250));
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refresh());
}

boot();
