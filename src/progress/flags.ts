// Story-Flags: was in diesem Durchlauf passiert ist. Sie liegen im Spielstand (state.flags) und werden
// mit einem neuen Spiel zurückgesetzt. Neue Nebenhandlungen und spätere Kapitel fragen diese Flags ab,
// statt eigene Sonderfälle in die Szenen zu schreiben. Neue Einträge einfach hier ergänzen.

export interface StoryFlags {
  /** Felix' Verhör: bestanden oder mit dem Schlagstock beendet */
  felixVerhoer?: 'bestanden' | 'eskaliert';

  /** Borna zum ersten Mal angesprochen (schaltet Lily in der Gasse frei) */
  bornaGetroffen?: boolean;
  /** wie weit der Wirt Borna im aktuellen Gespräch runtergemacht hat */
  bornaDruck?: number;
  /** endgültiger Ausgang von Bornas Nebenhandlung, danach nicht mehr änderbar */
  borna?: 'gebrochen' | 'hoffnung';
  /** Lily: weggeschickt oder wohnt jetzt auf dem Dachboden (leer = sitzt noch in der Gasse, falls freigeschaltet) */
  lily?: 'weg' | 'dach';

  /** der Wirt hat in Kabine 2 an das Loch in der Wand geklopft */
  kevinLoch?: boolean;
  /** Kurdischer Kevin ist aus Kabine 1 gekommen und für immer aus der Kneipe geflüchtet */
  kevinFlucht?: boolean;

  /** Spielzeit, zu der Leni sich übergeben hat */
  leniGekotzt?: number;
  /** der Wirt hat ihr ein Glas Wasser hingestellt */
  leniWasser?: boolean;

  /** Mayas Dialektpfad samt Zwischensequenz „Der deutsche Traum“ ist gelaufen */
  mayaTraum?: boolean;
}

/** Sitzt Lily gerade in der Hintergasse? */
export function lilyWartet(f: StoryFlags) {
  return !!f.bornaGetroffen && !f.lily && f.borna !== 'gebrochen';
}

/** Leni schläft ihren Rausch in der Kabine aus (so viele Spielsekunden). */
export const LENI_AUSSCHLAFEN = 90;
