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

/** Mayas Feinkost: im Laden vor der Tür, draußen vor dem Ladeneingang */
export const LADEN_SPAWN: [number, number] = [6, 6];
export const ALLEY_LADEN_SPAWN: [number, number] = [30, 17];

/** Muskelkater: im Club vor dem Ausgang, draußen vor dem Clubeingang (Koordinaten der ursprünglichen Gassenkarte) */
export const CLUB_SPAWN: [number, number] = [18, 16];
export const ALLEY_CLUB_SPAWN: [number, number] = [-21, 18];

/** Shisha 1001: drinnen vor der Tür, draußen vor dem Eingang (Koordinaten der ursprünglichen Gassenkarte) */
export const SHISHA_SPAWN: [number, number] = [7, 8];
export const ALLEY_SHISHA_SPAWN: [number, number] = [-11, 18];

/** Masala Basar: drinnen vor der Tür, draußen vor dem Eingang (Koordinaten der ursprünglichen Gassenkarte) */
export const BASAR_SPAWN: [number, number] = [6, 6];
export const ALLEY_BASAR_SPAWN: [number, number] = [-8, 7];

/** Nick-Strang: Start im Keller (unten an der Treppe) und oben neben der Treppe auf dem Dachboden */
export const KELLER_SPAWN: [number, number] = [11, 14];
export const DACH_TREPPE_SPAWN: [number, number] = [2, 3];
