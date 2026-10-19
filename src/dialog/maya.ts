import { state } from '../state';
import type { Choice, DialogNode } from './data';

// Meisternutte Maya, Verkäuferin in „Mayas Feinkost“. Verkauft Bier (gleiche Ware wie an der Kneipentheke).
// Auf normales Deutsch reagiert sie hochnäsig. Auf übertriebenen süddeutschen Dialekt dagegen ...

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const BEER: Choice = { text: 'Ein Bier, bitte.', action: 'shop' };

export function mayaTree(): Record<string, DialogNode> {
  if (state.flags.mayaTraum) {
    return {
      start: {
        lines: [pick([
          'Ah, mein Lieblingskunde. Das Bier geht aufs Haus. ... Nein, Scherz. Das Bier zahlst du.',
          'Wenn jemand fragt: Wir haben im Lager Leberkäse probiert. Lange.',
          'Pssst. Nicht so laut mit dem Dialekt. Sonst will das jeder.',
        ])],
        choices: [BEER, { text: 'Servus, Madl.', next: 'servus' }, { text: 'Tschüss, Maya.' }],
      },
      servus: { lines: ['Hör auf. Ich hab Kundschaft. ... Ach, nein, hab ich nicht. Mach weiter.'], choices: [BEER, { text: 'Tschüss, Maya.' }] },
    };
  }
  return {
    start: {
      lines: [pick([
        'Grüß Gott. Mayas Feinkost. Wurst, Käse, Bier. Und für Kenner ... mehr.',
        'Willkommen. Bitte nichts anfassen, was Sie sich nicht leisten können. Also nichts.',
      ])],
      choices: [
        BEER,
        { text: 'Was ist das für eine zusätzliche Dienstleistung?', next: 'nobel' },
        { text: '„Servus, Madl! Hosch du a bissle Zeit für mi, ha?“', next: 'dialekt' },
        { text: 'Tschüss.' },
      ],
    },
    // Option A: neutral gefragt, hochnäsig abgewiesen
    nobel: {
      lines: [
        'Meine Dienstleistung? Mein Lieber. Das ist Haute Cuisine. Kein Imbiss.',
        'Ich bin die Meisterin meines Fachs. Diplomiert, prämiert, international gebucht. Meine Kundschaft trägt Siegelringe.',
        'Sie tragen eine Fliege mit Bierfleck. Das reicht nicht einmal für einen Termin bei meiner Assistentin.',
      ],
      choices: [BEER, { text: 'Verstehe. Tschüss.' }],
    },
    // Option B: Dialekt. Maya schmilzt dahin und lädt ihn freiwillig ein.
    dialekt: {
      lines: ['... Wie bitte? Wie haben Sie das gerade gesagt?', 'Dieses „bissle“. Dieses „Madl“. Oh Gott. Sagen Sie das nochmal.'],
      choices: [
        { text: '„Madl, du bisch fei a ganz a Schöne, gell!“', next: 'schmelz' },
        { text: 'Äh. Ein Bier, bitte.', action: 'shop' },
      ],
    },
    schmelz: {
      portrait: 'nbust_mayaHappy',
      lines: [
        'N:Maya lässt das Wurstmesser fallen.',
        'Das ist ... unwiderstehlich. Da kommt die Heimat durch. Die Berge. Die Kässpätzle.',
        'Weißt du was? Für so viel Charme mach ich eine Ausnahme. Aufs Haus. Ganz freiwillig. Komm mit ins Lager, wenn du magst.',
      ],
      choices: [
        { text: '„Do sag i ned na, Madl!“', action: 'mayaTraum' },
        { text: 'Ein andermal, Madl.', next: 'andermal' },
      ],
    },
    andermal: {
      lines: ['Schade. Aber das Angebot steht. Und jetzt raus, bevor ich wieder vernünftig werde.'],
      choices: [BEER, { text: 'Tschüss, Maya.' }],
    },
  };
}
