// Story-Flags: was in diesem Durchlauf passiert ist. Sie liegen im Spielstand (state.flags) und werden
// mit einem neuen Spiel zurückgesetzt. Neue Nebenhandlungen und spätere Kapitel fragen diese Flags ab,
// statt eigene Sonderfälle in die Szenen zu schreiben. Neue Einträge einfach hier ergänzen.

export interface StoryFlags {
  /** Felix' Verhör: bestanden oder mit dem Schlagstock beendet */
  felixVerhoer?: 'bestanden' | 'eskaliert';

  /** Borna zum ersten Mal angesprochen (schaltet Lilly in der Gasse frei) */
  bornaGetroffen?: boolean;
  /** wie weit der Wirt Borna im aktuellen Gespräch runtergemacht hat */
  bornaDruck?: number;
  /** endgültiger Ausgang von Bornas Nebenhandlung, danach nicht mehr änderbar */
  borna?: 'gebrochen' | 'hoffnung';
  /** Lilly: weggeschickt oder wohnt jetzt auf dem Dachboden (leer = sitzt noch in der Gasse, falls freigeschaltet) */
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

  /** wie oft der Wirt die Kneipe von draußen betreten hat */
  lokalBetreten?: number;
  /** Event „Anne“: läuft, Anne gefangen, oder Felix musste sie holen (Strafe bezahlt) */
  anne?: 'laeuft' | 'gefangen' | 'felix';

  /** Die Glanz-Handlung ist abgeschlossen (verfüttert), danach freies Spiel */
  glanzErledigt?: boolean;
  /** Kapitel 5: Captain Claudius getroffen (Rechner auf dem Dachboden freigeschaltet) oder Akten veröffentlicht */
  claudius?: 'getroffen' | 'veroeffentlicht';
  /** gelesene Akten auf Claudius' Rechner (ids aus dialog/pcFiles.ts) */
  pcGelesen?: string[];
  /** Spielzeit, bis zu der der Rechner nach einem gescheiterten Hochladen gesperrt ist */
  pcSperreBis?: number;

  // ---- Offene Welt (siehe progress/quests.ts)
  /** zuletzt eingeleiteter Strang und Pause bis zur nächsten Einleitung (Spielzeit) */
  letzterStrang?: string;
  strangPauseBis?: number;
  /** gefundene Easter Eggs */
  entdeckt?: string[];
}

/** Freies Spiel nach der Glanz-Handlung: Sucht und Misstrauen spielen keine Rolle mehr. */
export function freiesSpiel(f: StoryFlags) {
  return !!f.glanzErledigt;
}
/** Sitzt Lilly gerade in der Hintergasse? */
export function lilyWartet(f: StoryFlags) {
  return !!f.bornaGetroffen && !f.lily && f.borna !== 'gebrochen';
}

/** Leni schläft ihren Rausch in der Kabine aus (so viele Spielsekunden). */
export const LENI_AUSSCHLAFEN = 90;
