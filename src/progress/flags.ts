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

  /** Masala Basar: Adshayans Curry ist aufgewischt (Laden offen) und wie oft das Putzen schon schiefging */
  basarSauber?: boolean;
  basarVersuche?: number;

  /** „Unter dem Eimer“ (Teil 1, story/drehbuch-teil1.md): Stufe des Strangs; Bier und Buffet für Kevins Hochzeit */
  kanal?: 'kaese' | 'vorbereitung' | 'probe' | 'entfuehrt' | 'ausruestung' | 'unten' | 'katze' | 'curry' | 'klaerwerk' | 'gerettet';
  hochzeitBier?: boolean;
  hochzeitBuffet?: boolean;
  /** Kapitel 7: der Gullydeckel in der Hintergasse ist mit Tuncays Haken aufgehebelt */
  gullyOffen?: boolean;
  /** das Kanal-Paket (Wathose, Stirnlampe, Haken) ist ausgezogen */
  wathoseAus?: boolean;
  /** Kapitel 7: das Rostgitter hinter dem Einstieg ist aufgehebelt */
  kanalGitterOffen?: boolean;
  /** Schieberkammer: Wasser in Nord, Mitte, Süd (0/1) und das Fass (0 = weggespült, 1 = Nordufer, 2 = Südufer) */
  schleuse?: [number, number, number, number];
  /** einmal über die Schieberkammer gekommen */
  schleuseGeloest?: boolean;
  porscheGefunden?: boolean;
  rolexGefunden?: boolean;
  rolexVerkauft?: boolean;
  /** Bianca aus dem Schleimkokon befreit */
  biancaFrei?: boolean;
  /** Felix ist dem Wirt in den Kanal gefolgt und wurde vom Wesen in die Brühe gezogen (bis Teil 2 verschwunden) */
  felixKanal?: 'verloren';
  /** Klo-Abkürzung: Kabine 1 der Herrentoilette führt durchs Rohr in den Kanal */
  kloAbkuerzung?: boolean;
  /** Phase 5: der Wirt trägt Adshayans großen Curry-Topf (langsam, wie mit einer Leiche) */
  curryTopf?: boolean;
  /** so oft hat Adshayan schon gekocht (beim zweiten Mal: „Schon wieder?“) */
  curryGekocht?: number;
  /** der Topf steht vor der Klärwerk-Tür, das Tentakelgitter hat sich zurückgezogen */
  curryAnTuer?: boolean;
  /** Klärwerk-Endkampf: gefütterte Ratten (Phase 1) und ob der Kampf schon im Duell ist (Phase 2) */
  klaerwerkRatten?: number;
  klaerwerk?: 'duell' | 'ende';
  /** Brenningers Akte „Projekt Achtarm“ (nach dem Klärwerk) */
  akte?: boolean;

  /** Xavi-Strang: Leni hat um Hilfe gebeten, Cemo hat die Spur verraten (Tuncay), Tuncay hat den Club verraten, Xavi ist gerettet */
  xavi?: 'vermisst' | 'spur' | 'club' | 'gerettet';

  /** Nick-Strang „Bornas Business“: Pflanze holen, wächst, Plantage steht, Keller offen, Koks für Nick, Endkampf, Nick ist frei */
  nick?: 'pflanze' | 'gepflanzt' | 'plantage' | 'keller' | 'koks' | 'boss' | 'frei';
  /** Nick hat das Duell schon erklärt */
  nickGetroffen?: boolean;
  /** die Verwandlung wurde einmal ganz gezeigt (danach geht es nach einer Niederlage direkt in den Kampf) */
  nickWandlung?: boolean;
  /** Endkampf: Phase, ab der es nach einer Niederlage weitergeht (Checkpoint) */
  nickBossPhase?: number;
  /** beste Punktzahl beim Jammen mit Nick */
  nickJam?: number;

  // ---- Offene Welt (siehe progress/quests.ts)
  /** zuletzt eingeleiteter Strang und Pause bis zur nächsten Einleitung (Spielzeit) */
  letzterStrang?: string;
  strangPauseBis?: number;
  /** vorgemerkter Strang mit eigenem Auslöser (startet erst am Ort, z. B. Leni auf der Damentoilette) */
  strangBereit?: string;
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
