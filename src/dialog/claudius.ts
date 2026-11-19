import { state } from '../state';
import { PC_FILES, gelesen } from './pcFiles';
import type { DialogNode } from './data';

// Kapitel 5: Captain Claudius (General des erfundenen Staates Tavirien) und Kurdischer Kevin vor dem Goldenen Eimer.
// Die Satire zielt auf Verbotswahn, Propaganda und Boulevard-Statistiken, nicht auf Herkunft oder Identität.

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const gesperrt = () => (state.flags.pcSperreBis ?? 0) > state.time;

export function claudiusTree(): Record<string, DialogNode> {
  const back = { text: 'Noch was.', next: 'start' };
  const bye = { text: 'Ich muss weiter.' };
  return {
    start: {
      lines: [gesperrt()
        ? 'Ich habe das Passwort Ihres Rechners geändert. Des Rechners, den es nicht gibt. Sie sind gewarnt, Bürger.'
        : pick([
          'Bürger. Sie dürfen mich ansehen. Kurz.',
          'Haben Sie heute schon getrunken? Das ist eine Fangfrage.',
          'Tavirien grüßt Sie. Nüchtern. Wie immer.',
        ])],
      choices: [
        { text: 'Warum wollen Sie Alkohol verbieten?', next: 'verbot' },
        { text: 'Was haben Sie mit der BLÖD-Zeitung zu tun?', next: 'zeitung' },
        { text: 'Was ist auf dem Rechner auf meinem Dachboden?', next: 'rechner' },
        { text: 'Woher haben Sie die vierzehn Orden?', next: 'orden' },
        bye,
      ],
    },
    verbot: {
      lines: [
        'Alkohol macht Menschen fröhlich, laut und unberechenbar.',
        'Ein fröhlicher Bürger stellt Fragen. Ein nüchterner Bürger stellt Stühle hoch.',
        'W:Und was trinken Sie abends?',
        'Leitungswasser. Mit Haltung. Und manchmal mit Kohlensäure, wenn ich mich gehen lasse.',
      ],
      choices: [back, bye],
    },
    zeitung: {
      lines: [
        'Nichts. Wir kennen uns kaum. Wir telefonieren nur täglich.',
        'Die BLÖD-Zeitung druckt die Wahrheit. Meine Wahrheit. Gegen Rechnung.',
      ],
      choices: [back, bye],
    },
    rechner: {
      lines: [
        'Welcher Rechner? Es gibt keinen Rechner. Fassen Sie ihn nicht an.',
        'Er ist passwortgeschützt. Das Passwort ist streng geheim und hat absolut nichts mit eins, zwei, drei, vier zu tun.',
      ],
      choices: [back, bye],
    },
    orden: {
      lines: [
        'Zwölf habe ich mir selbst verliehen. Für Bescheidenheit.',
        'Zwei habe ich gefunden. Einer davon ist ein Kronkorken. Von einer Bierflasche. Das ist ... Beweismaterial.',
      ],
      choices: [back, bye],
    },
  };
}

/** Kevin vor der Kneipe: gleiche Figur und gleiches Brustbild wie in der Toiletten-Szene. */
export function kevinGasseTree(): Record<string, DialogNode> {
  const n = gelesen(state.flags.pcGelesen).length;
  return {
    start: {
      lines: [n >= PC_FILES.length
        ? 'Du hast alles gelesen, Bruder? Dann raus damit. An seriöse Leute. Nicht an die BLÖD.'
        : 'Bruder. Der Rechner steht oben auf deinem Dachboden. Seine Mails mit der BLÖD-Zeitung. Lies sie, dann raus damit.'],
      choices: [
        { text: 'Warum bist du abgehauen?', next: 'warum' },
        { text: 'Was war damals in Kabine eins los?', next: 'kabine' },
        { text: 'Bis später, Kevin.' },
      ],
    },
    warum: {
      lines: [
        'Weil der Captain ALLES verbieten will. Bier, Schnaps, Pillen.',
        'Und in Tavirien gilt Viagra als Droge, Bruder. Kannst du dir das vorstellen?',
        'W:Ich versuche, es mir nicht vorzustellen.',
        'Ohne meine blauen Freunde bin ich nur ein großer, trauriger Mann im Tanga.',
      ],
      choices: [{ text: 'Bis später, Kevin.' }],
    },
    kabine: {
      lines: ['Bruder. Manche Fragen stellt man nicht.', 'Und an manche Wände klopft man nicht.'],
      choices: [{ text: 'Verstanden.' }],
    },
  };
}

/** Kevin im Muskelkater (nach der Veröffentlichung): sitzt am Laufsteg und guckt zu. */
export function kevinClubTree(): Record<string, DialogNode> {
  return {
    start: {
      lines: [pick([
        'Bruder! Die BLÖD-Zeitung hat sich entschuldigt. Auf Seite 17. Neben dem Wetter.',
        'Der Captain sitzt im Eimer und trinkt sein drittes „dienstliches“ Bier. Ich sag nix.',
        'Bruder. Hier verbietet keiner was. Nicht mal meine blauen Freunde.',
      ])],
      choices: [{ text: 'Viel Spaß, Kevin.' }],
    },
  };
}
