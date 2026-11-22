// Wegsuche auf dem Kachelraster (Breitensuche, vier Richtungen) für Passanten und Polizei.
// solid[y][x] = true heißt: hier kommt niemand durch. Kacheln als [x, y].

export type Kachel = [number, number];

const NACHBARN: Kachel[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Alle Kacheln, die von start aus zu Fuß erreichbar sind (als Index y * breite + x). */
export function erreichbar(solid: boolean[][], start: Kachel): Set<number> {
  const h = solid.length, w = solid[0]?.length ?? 0;
  const seen = new Set<number>();
  if (solid[start[1]]?.[start[0]] ?? true) return seen;
  const q: Kachel[] = [start];
  seen.add(start[1] * w + start[0]);
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of NACHBARN) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || solid[ny][nx]) continue;
      const k = ny * w + nx;
      if (seen.has(k)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}

/**
 * Kürzester Weg von a nach b (ohne a, mit b), oder null. gesperrt: zusätzliche Kacheln, die gemieden werden
 * (z. B. wo gerade jemand im Weg steht). Bricht nach max besuchten Kacheln ab.
 */
export function weg(solid: boolean[][], a: Kachel, b: Kachel, gesperrt?: Set<number>, max = 6000): Kachel[] | null {
  const h = solid.length, w = solid[0]?.length ?? 0;
  const ziel = b[1] * w + b[0];
  if (solid[b[1]]?.[b[0]] ?? true) return null;
  const von = new Map<number, number>();
  const start = a[1] * w + a[0];
  von.set(start, -1);
  const q: number[] = [start];
  for (let i = 0; i < q.length && i < max; i++) {
    const k = q[i];
    if (k === ziel) {
      const pfad: Kachel[] = [];
      for (let c = k; c !== start; c = von.get(c)!) pfad.push([c % w, Math.floor(c / w)]);
      return pfad.reverse();
    }
    const x = k % w, y = Math.floor(k / w);
    for (const [dx, dy] of NACHBARN) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || solid[ny][nx]) continue;
      const nk = ny * w + nx;
      if (von.has(nk) || (gesperrt?.has(nk) && nk !== ziel)) continue;
      von.set(nk, k);
      q.push(nk);
    }
  }
  return null;
}

/**
 * Kann eine Figur (Füße bei x, y, halbe Breite hw) in gerader Linie von (x0, y0) nach (x1, y1) gehen?
 * Prüft in kleinen Schritten beide Fußkanten gegen feste Kacheln. Dient zum Glätten der Wege (keine Treppchen).
 */
export function geradeFrei(solid: boolean[][], T: number, x0: number, y0: number, x1: number, y1: number, hw = 3.5) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 4));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n - 3;
    for (const ox of [-hw, hw]) for (const oy of [-2.5, 2.5]) {
      if (solid[Math.floor((y + oy) / T)]?.[Math.floor((x + ox) / T)] ?? true) return false;
    }
  }
  return true;
}
