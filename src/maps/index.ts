import alley from './alley.json';
import type { MapData } from './types';

// Karten des Spiels. Im Dev-Modus kann der Map-Editor eine Testversion unterschieben (Knopf „Im Spiel testen“),
// die nur in diesem Browser gilt; die Projektdatei bleibt dabei unangetastet.

const MAPS: Record<string, MapData> = { alley: alley as MapData };

export const TEST_KEY = 'harterkarter.testmap';

export function isTestRun() {
  return import.meta.env.DEV && new URLSearchParams(location.search).has('testmap');
}

export function getMap(id: string): MapData {
  if (isTestRun()) {
    try {
      const t = JSON.parse(localStorage.getItem(TEST_KEY) ?? 'null') as MapData | null;
      if (t && t.id === id && Array.isArray(t.rows)) return t;
    } catch {
      /* ungültig: Originalkarte */
    }
  }
  return MAPS[id];
}
