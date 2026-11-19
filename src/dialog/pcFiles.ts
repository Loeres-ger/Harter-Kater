// Die Dateien auf Captain Claudius' Rechner (Dachboden, Kapitel 5): sein Mailverkehr mit der „BLÖD-Zeitung“
// über erfundene Statistiken für ein weltweites Alkoholverbot. Satire auf Boulevardjournalismus und Propaganda;
// Tavirien ist ein erfundener Staat. Seiten mit höchstens 42 Zeichen pro Zeile.

export interface PcFile {
  id: string;
  name: string;
  pages: string[];
}

export const PC_FILES: PcFile[] = [
  {
    id: 'mail',
    name: 'MAIL_BLOED-ZEITUNG.EML',
    pages: [
      'VON: Cpt. I. Claudius, Tavirien\nAN:  Chefredaktion BLÖD-Zeitung\nBETREFF: Kampagne „Prost? Pfui!“\n\nWie besprochen die neuen Zahlen.\nBitte groß, rot, mit Ausrufezeichen.\nSie wissen ja: Wer zahlt, titelt.',
      'STATISTIK (frei erfunden, patriotisch):\n\n- 99,99 % aller Biertrinker leiden an\n  chronischen Flatulenzen.\n- Ein Glas Wein kostet drei Wochen\n  Lebenszeit. Das zweite sechs.\n- Viagra ist eine Droge. Es macht\n  Männer unerträglich zufrieden.',
      'ANTWORT DER BLÖD-ZEITUNG:\n„Flatulenzen? Lieben wir. Brauchen\nwir noch ein Foto von einem\nweinenden Bierglas? Und was sagt\neigentlich die Wissenschaft?“\n\nCLAUDIUS: „Die Wissenschaft bin ich.“',
    ],
  },
  {
    id: 'titel',
    name: 'TITELSEITE_ENTWURF.DOC',
    pages: [
      'BLÖD-ZEITUNG – ENTWURF TITELSEITE\n\n      BIER-SCHOCK!\n  FORSCHER: JEDER SCHLUCK\n       EIN FURZ!\n\nWeltweites Alkoholverbot ab Montag?\nTavirien macht es vor!',
      'Seite 2: „Ich trinke nur Wasser –\nund bin General!“ Exklusiv-Interview\nmit Cpt. Claudius.\n\nSeite 3: VIAGRA – DIE STILLE GEFAHR\n„Mein Mann ist seit Jahren glücklich“,\nsagt eine Ehefrau. Experten entsetzt.',
      'Notiz am Rand (Handschrift):\nDeserteur K. (Sanitäter, Tanga,\nViagra-abhängig) hat Kopien. Finden.\nVor Montag.\n\nPasswort dieses Rechners: 1-2-3-4',
    ],
  },
];

/** Gelesene Dateien, nur die es noch gibt (ältere Spielstände kennen andere Dateinamen) */
export function gelesen(list: string[] | undefined) {
  return (list ?? []).filter((id) => PC_FILES.some((f) => f.id === id));
}
