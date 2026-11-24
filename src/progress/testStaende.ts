import { frischerStand } from '../state';
import type { StoryFlags } from './flags';
import { CHAPTERS } from './save';

// Nur für die Entwicklung (im Browser: alleKapitel()): legt für jedes Kapitel einen stimmigen Speicherstand an, damit
// man über „KAPITEL“ direkt hineinspringen kann. Ein vorhandener Zwischenstand (Fortsetzen) bleibt erhalten.

const KEY = 'harterkarter.saves.v1';

export function alleKapitelFreischalten() {
  const stand = (aend: Record<string, unknown>, flags: StoryFlags, inv: Record<string, number> = {}) => {
    const s = frischerStand() as unknown as Record<string, unknown>;
    Object.assign(s, aend);
    s.flags = { ...flags };
    s.inv = { ...(s.inv as Record<string, number>), ...inv };
    return s;
  };
  const glanz = (verfall: number, k2: boolean, k3: boolean, extra: Record<string, unknown> = {}) =>
    ({ verfall, sucht: verfall * 0.8, misstrauen: verfall * 0.2, time: verfall * 6, money: 10 + verfall, story: { kapitel2: k2, kapitel3: k3 }, ...extra });
  const offen = (money: number) => ({ dead: true, bodyInAlley: true, verfall: 100, sucht: 80, story: { kapitel2: true, kapitel3: true }, time: 900, gameOver: null, money });
  const f0: StoryFlags = { glanzErledigt: true };
  const f5: StoryFlags = { ...f0, kevinFlucht: true, kevinLoch: true, claudius: 'getroffen' };
  const fx: StoryFlags = { ...f5, claudius: 'veroeffentlicht', leniGekotzt: 1, xavi: 'vermisst' };
  const fxc: StoryFlags = { ...fx, xavi: 'club' };
  const fn: StoryFlags = { ...fxc, xavi: 'gerettet', bornaGetroffen: true, borna: 'hoffnung', lily: 'dach', nick: 'pflanze' };
  const fnk: StoryFlags = { ...fn, nick: 'keller' };
  const fnf: StoryFlags = { ...fn, nick: 'frei' };
  const f6: StoryFlags = { ...fnf, kanal: 'kaese' };
  const f7: StoryFlags = { ...fnf, kanal: 'entfuehrt', hochzeitBier: true, hochzeitBuffet: true };
  const f8: StoryFlags = {
    ...f7, kanal: 'klaerwerk', gullyOffen: true, kanalGitterOffen: true, schleuse: [0, 0, 1, 2], schleuseGeloest: true,
    felixKanal: 'verloren', kloAbkuerzung: true, basarSauber: true, curryGekocht: 1, curryAnTuer: true,
  };
  const daten: Record<string, Record<string, unknown>> = {
    k1: stand(glanz(0, false, false), {}),
    k2: stand(glanz(45, true, false), {}),
    k3: stand(glanz(70, true, true), {}),
    k4: stand(glanz(100, true, true, { dead: true }), {}),
    welt: stand(offen(60), f0),
    k5: stand(offen(80), f5),
    xavi: stand(offen(100), fx),
    xaviClub: stand(offen(120), fxc),
    nick: stand(offen(150), fn),
    nickKeller: stand(offen(150), fnk),
    nickFrei: stand(offen(200), fnf),
    k6: stand(offen(400), f6),
    k7: stand(offen(200), f7),
    k8: stand(offen(150), f8, { kanalpaket: 1 }),
  };
  let alt: { auto?: { savedAt: string } | null } = {};
  try { alt = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { /* kaputt: neu anlegen */ }
  // Kapitelstände älter als ein vorhandener Zwischenstand, damit „Fortsetzen“ dort weitermacht
  const ende = alt.auto ? new Date(alt.auto.savedAt).getTime() - 60000 : Date.now();
  const ids = CHAPTERS.map((c) => c.id).filter((id) => daten[id]);
  const chapters: Record<string, unknown> = {};
  ids.forEach((id, i) => { chapters[id] = { chapter: id, savedAt: new Date(ende - (ids.length - i) * 60000).toISOString(), data: daten[id] }; });
  localStorage.setItem(KEY, JSON.stringify({ version: 1, last: ids[ids.length - 1], chapters, auto: alt.auto ?? null }));
  return ids;
}
