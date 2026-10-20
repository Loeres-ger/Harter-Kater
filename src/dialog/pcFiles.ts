// Die drei Akten auf Captain Claudius' Rechner (Dachboden, Kapitel 5). Frei erfunden und absurd:
// Soldaten auf Springstöcken, ein Ententeich, keine echten Opfer. Seiten mit höchstens 42 Zeichen pro Zeile.

export interface PcFile {
  id: string;
  name: string;
  pages: string[];
}

export const PC_FILES: PcFile[] = [
  {
    id: 'pogo',
    name: 'OPERATION_POGO.DOC',
    pages: [
      'STRENG GEHEIM – BITTE WEITERSAGEN\n\nBetreff: Operation Pogo\nZiel: Überquerung des Stadtparks.\nFeind: unklar, aber bestimmt da.\nMittel: 40 Springstöcke (Baumarkt,\nSonderangebot), 12 Freiwillige,\n1 Captain (ich).',
      'Taktik: Der Gegner kann nicht treffen,\nwas ständig auf und ab hüpft.\n\nMinute 1: Alle hüpfen.\nMinute 2: Alle hüpfen in verschiedene\nRichtungen.\nMinute 4: Ausbilder K. meldet:\n„Ententeich voraus.“',
      'Minute 5: Befehl: Weiterhüpfen.\nMinute 6: Platsch. Zwölfmal.\n\nVerletzte: keine.\nNasse Socken: alle.\nEnten: empört.',
      'Persönliche Notiz des Captains:\nDiese Akte ist zu vernichten.\nVorher bitte dreimal ausdrucken,\neinrahmen und im Flur aufhängen.\n\ngez. Cpt. I. Claudius\n(mit Glitzerstift)',
    ],
  },
  {
    id: 'verteidigung',
    name: 'BEWEGLICHE_VERTEIDIGUNG.DOC',
    pages: [
      'DOKTRIN: BEWEGLICHE VERTEIDIGUNG\n\n1. Wer stillsteht, verliert.\n2. Wer hüpft, gewinnt.\n3. Wer ins Wasser hüpft, hat den Feind\n   zum Rückzug gezwungen.\n4. Rückzug heißt bei uns\n   „Vorwärtsbewegung nach hinten“.',
      'Ausrüstung je Soldat:\n1 Springstock, 1 Helm mit Federbusch,\n1 Taschenbuch „Ich und mein Ruhm“\n(Verfasser: Cpt. I. Claudius).\n\nBudget: 4.000 Euro.\nAusgegeben: 11 Euro für Springstöcke,\n3.989 Euro für Orden für den Captain.',
      'Anmerkung der Buchhaltung:\n„Wofür braucht ein Mann 14 Orden?“\n\nAntwort des Captains:\n„Für den fünfzehnten.“',
    ],
  },
  {
    id: 'bericht',
    name: 'UNTERSUCHUNGSBERICHT.DOC',
    pages: [
      'OFFIZIELLER UNTERSUCHUNGSBERICHT\n\nDatum: zwei Tage VOR der Operation.\nUntersucht von: Cpt. I. Claudius.\nGegenstand: Cpt. I. Claudius.\n\nErgebnis: Cpt. I. Claudius hat alles\nrichtig gemacht.',
      'Feststellungen:\n1. Operation Pogo hat nie stattgefunden.\n2. Operation Pogo war ein voller Erfolg.\n3. Der Ententeich hat zuerst angegriffen.\n4. Der Ententeich war gar nicht da.\n5. Wer 1 bis 4 widersprüchlich findet,\n   ist ein Feind der Wahrheit.',
      'Empfehlung: Akte schließen.\nRechner verstecken. Ort: Dachboden\neiner Kneipe, „da geht keiner\nfreiwillig hoch“.\n\nPasswort: 1-2-3-4 (streng geheim)',
    ],
  },
];
