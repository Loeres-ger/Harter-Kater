import { GUESTS } from './data';

// Wer gerade in der Kneipe sitzt. Bleibt zwischen Besuchen von Bar, Gasse und Tresen erhalten.

export type Facing = 'left' | 'right';

export interface BarGuest {
  id: string;
  seat: number;
  rowdy: boolean;
}

/** Sitzplätze (Kachel x, y, Blickrichtung) an den Tischen */
export const SEATS: [number, number, Facing][] = [
  [3, 6, 'right'],
  [5, 6, 'left'],
  [3, 8, 'right'],
  [5, 8, 'left'],
  [12, 8, 'left'],
];

export const roster = {
  guests: [] as BarGuest[],
  lastSpawn: -999,
  nextRowdy: 25,
  /** Ergebnis des letzten Kampfes, wird von der Bar ausgewertet */
  lastFight: null as null | { id: string; won: boolean; amount: number },
};

export function resetRoster() {
  roster.guests = [];
  roster.lastSpawn = -999;
  roster.nextRowdy = 25;
  roster.lastFight = null;
}

function spawnOne(now: number) {
  const freeSeats = SEATS.map((_, i) => i).filter((i) => !roster.guests.some((g) => g.seat === i));
  const freeTypes = GUESTS.filter((g) => !roster.guests.some((b) => b.id === g.id));
  if (!freeSeats.length || !freeTypes.length) return;
  const seat = freeSeats[Math.floor(Math.random() * freeSeats.length)];
  const def = freeTypes[Math.floor(Math.random() * freeTypes.length)];
  roster.guests.push({ id: def.id, seat, rowdy: false });
  roster.lastSpawn = now;
}

/** Beim ersten Besuch 2–3 Gäste, später kommt alle ~40 s ein neuer, wenn Plätze frei sind. */
export function ensureGuests(now: number) {
  if (roster.lastSpawn < -900) {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) spawnOne(now);
    return;
  }
  if (roster.guests.length < 3 && now - roster.lastSpawn > 40) spawnOne(now);
}

export function removeGuest(id: string) {
  roster.guests = roster.guests.filter((g) => g.id !== id);
}
