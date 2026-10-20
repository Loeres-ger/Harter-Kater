import { state } from '../state';
import type { DialogNode } from './data';

// Kapitel 5: Captain Claudius und Kurdischer Kevin vor dem Goldenen Eimer.
// Die Satire zielt auf Propaganda, Vertuschung und Widersprüche, nicht auf Herkunft oder Identität.

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const gesperrt = () => (state.flags.pcSperreBis ?? 0) > state.time;

export function claudiusTree(): Record<string, DialogNode> {
  const back = { text: 'Noch was.', next: 'start' };
  return {
    start: {
      lines: [gesperrt()
        ? 'Ich habe das Passwort Ihres Rechners geändert. Des Rechners, den es nicht gibt. Sie sind gewarnt, Bürger.'
        : pick([
          'Bürger. Sie dürfen mich ansehen. Kurz.',
          'Ich bewache diesen Gehweg. Niemand hat mich darum gebeten. Das ist wahrer Dienst.',
          'Haltung, Bürger! Ein Held steht immer so, als würde gerade jemand ein Denkmal von ihm meißeln.',
        ])],
      choices: [
        { text: 'Was war Operation Pogo?', next: 'pogo' },
        { text: 'Was ist auf dem Rechner auf meinem Dachboden?', next: 'rechner' },
        { text: 'Woher haben Sie die vierzehn Orden?', next: 'orden' },
        { text: 'Ich muss weiter.' },
      ],
    },
    pogo: {
      lines: [
        'Operation Pogo hat nie stattgefunden. Sie war streng geheim. Deshalb weiß auch jeder davon.',
        'Die Verluste waren null. Und die Verluste waren tragisch, aber notwendig.',
        'W:Null Verluste und tragische Verluste?',
        'Beides ist wahr. Das nennt man Ausgewogenheit, Bürger.',
      ],
      choices: [back, { text: 'Ich muss weiter.' }],
    },
    rechner: {
      lines: [
        'Welcher Rechner? Es gibt keinen Rechner. Fassen Sie ihn nicht an.',
        'Er ist passwortgeschützt. Das Passwort ist streng geheim und hat absolut nichts mit eins, zwei, drei, vier zu tun.',
      ],
      choices: [back, { text: 'Ich muss weiter.' }],
    },
    orden: {
      lines: [
        'Zwölf habe ich mir selbst verliehen. Für Bescheidenheit.',
        'Zwei habe ich gefunden. Einer davon ist ein Kronkorken. Er glänzt sehr patriotisch.',
      ],
      choices: [back, { text: 'Ich muss weiter.' }],
    },
  };
}

/** Kevin vor der Kneipe: gleiche Figur und gleiches Brustbild wie in der Toiletten-Szene. */
export function kevinGasseTree(): Record<string, DialogNode> {
  if (state.flags.claudius === 'veroeffentlicht') {
    return {
      start: {
        lines: [pick([
          'Bruder! Ich bin in der Zeitung. Seite vier, zwischen den Kleinanzeigen. Aber ich bin drin.',
          'Der Captain hat geschrieben. Er sagt, er hat den Teich besiegt. Der Teich hat nicht geantwortet.',
        ])],
        choices: [{ text: 'Glückwunsch, Kevin.' }],
      },
    };
  }
  const gelesen = state.flags.pcGelesen?.length ?? 0;
  return {
    start: {
      lines: [gelesen >= 3
        ? 'Du hast alles gelesen, Bruder? Dann raus damit. Ins Internet. Der Captain wird schreien. Lass ihn schreien.'
        : 'Bruder. Der Rechner steht oben auf deinem Dachboden. Drei Akten. Lies alles, dann ab ins Internet damit.'],
      choices: [
        { text: 'Warum machst du das?', next: 'warum' },
        { text: 'Was war damals in Kabine eins los?', next: 'kabine' },
        { text: 'Bis später, Kevin.' },
      ],
    },
    warum: {
      lines: [
        'Weil der Captain behauptet, der Ententeich hätte angefangen.',
        'Ich war dabei, Bruder. Der Teich war ganz ruhig. Der Teich hat nur gequakt.',
      ],
      choices: [{ text: 'Bis später, Kevin.' }],
    },
    kabine: {
      lines: ['Bruder. Manche Fragen stellt man nicht.', 'Und an manche Wände klopft man nicht.'],
      choices: [{ text: 'Verstanden.' }],
    },
  };
}
