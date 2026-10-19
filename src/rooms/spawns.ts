// Ankunftspunkte (Kachel x, y) zwischen Kneipe und Nebenräumen. Eigene Datei, damit sich
// BarScene und die Räume nicht gegenseitig importieren müssen.

/** in der Kneipe: unter der Leiter zum Dachboden */
export const BAR_LADDER_SPAWN: [number, number] = [20, 8];
/** in der Kneipe: vor der Herren- bzw. Damentoilette */
export const BAR_HERREN_SPAWN: [number, number] = [19, 2];
export const BAR_DAMEN_SPAWN: [number, number] = [21, 2];

/** in den Räumen: neben der Luke bzw. vor der Tür */
export const ATTIC_SPAWN: [number, number] = [6, 5];
export const HERREN_SPAWN: [number, number] = [6, 6];
export const DAMEN_SPAWN: [number, number] = [5, 5];
