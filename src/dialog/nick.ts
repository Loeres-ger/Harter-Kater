import { state } from '../state';
import type { DialogNode } from './data';

// Nick-Strang „Bornas Business“: Borna auf dem Dachboden (je nach Fortschritt) und Nick im Keller.

const f = () => state.flags;
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const BYE = { text: 'Bis später.' };

/** Borna, sobald der Nick-Strang vorgemerkt ist oder läuft */
export function bornaNickTree(): Record<string, DialogNode> {
  const n = f().nick;
  if (!n) {
    return {
      start: {
        lines: ['Chef! CHEF! Setz dich. Nein, steh. Egal. Ich hab nachgedacht.', 'W:Das ist neu.', 'Lilly hat einen Job. Ich hab eine Matratze. Und eine Idee. Ich werd Unternehmer.'],
        choices: [{ text: 'Was für ein Unternehmen?', next: 'plan' }, { text: 'Borna. Nein.', next: 'nein' }],
      },
      nein: {
        lines: ['Chef, ich will raus. Aus der Armut, nicht vom Dachboden. Der Dachboden ist super.', 'Lilly verdient das Geld. Ich verdien ... ihren Respekt? Bisher nicht so.'],
        choices: [{ text: 'Na gut. Was für eine Idee?', next: 'plan' }, { text: 'Später.' }],
      },
      plan: {
        lines: [
          'Landwirtschaft, Chef. Regional. Bio. Grün.',
          'Ich bau Gras an. Hier oben. Dachboden-Gras. Die Marke heißt „Vom Dach“. Das Logo hab ich schon. Ist ein Dach.',
          'W:Und wo kriegst du Pflanzen her?',
          'Da kommst du ins Spiel. Hinter deiner Bar, in der Hintergasse, steht ein Busch. In dem Busch steht nicht nur Busch.',
        ],
        choices: [{ text: 'Wer hat da was versteckt?', next: 'wer' }, { text: 'Na gut. Ich hol sie.', action: 'nickStart' }],
      },
      wer: {
        lines: ['Ich. Vor drei Jahren. Dann hab ich vergessen, dass ich das war.', 'Gestern ist es mir wieder eingefallen. Im Traum. Da war ein Pferd. Das Pferd hat gesagt: „Busch.“'],
        choices: [{ text: 'Ich hol sie dir.', action: 'nickStart' }, { text: 'Ich überleg es mir.' }],
      },
    };
  }
  if (n === 'pflanze') {
    if (state.inv.pflanze > 0) {
      return {
        start: {
          lines: ['Ist sie das? IST SIE DAS?', '*schnüffelt* Oh ja. Das ist sie. Hallo, Kleine. Ich bin dein Papa.'],
          choices: [{ text: 'Hier. Pass auf sie auf.', action: 'nickPflanze' }],
        },
      };
    }
    return {
      start: {
        lines: [pick([
          'Busch. Hintergasse. Hinter deiner Bar. Der Busch, der aussieht wie ein Busch.',
          'Grab vorsichtig, Chef. Sie ist schüchtern. Wie Lilly. Nur grüner.',
        ])],
        choices: [BYE],
      },
    };
  }
  if (n === 'gepflanzt') {
    return {
      start: {
        lines: ['Pssst. Sie wächst. Ich hör sie wachsen.', 'Ich hab ihr was vorgesungen. Lilly sagt, das war eher Weinen. Komm später wieder, Chef.'],
        choices: [BYE],
      },
    };
  }
  if (n === 'plantage') {
    return {
      start: {
        lines: ['Chef. Schau dich um. SCHAU. DICH. UM.', 'Eine Nacht. Eine! Und jetzt hab ich eine Plantage. Ich glaub, die Kleine hatte Freunde.', 'W:Und? Läuft das Geschäft?'],
        choices: [{ text: 'Sag schon.', next: 'nick' }],
      },
      nick: {
        lines: [
          'Nein. Gar nicht. Wegen NICK.',
          'Nick ist der Drogenboss der Stadt. Der verkauft alles. Zu Preisen, die es nicht gibt. Teuflisch billig. Ich krieg kein Gramm los.',
          'W:Wo finde ich diesen Nick?',
          'Im Keller.',
        ],
        choices: [{ text: 'In welchem Keller?', action: 'nickKeller' }],
      },
    };
  }
  if (n === 'frei') {
    return {
      start: {
        lines: [pick([
          'Chef. CHEF. Nick hat angerufen. Der ganze Markt der Stadt gehört jetzt mir. MIR. Dem Typen von deinem Dachboden.',
          'Ich bin jetzt der einzige krasse Dealer der Stadt, Chef. Ohne Teufel. Nur mit Fleiß. Und Licht. Und Dünger.',
          'Lilly sagt, ich soll Steuern zahlen. Ich hab gefragt, an wen. Sie hat geseufzt. Lange.',
        ])],
        choices: [{ text: 'Mach was draus, Borna.' }, { text: 'Und ohne Satan, ja?', next: 'satan' }],
      },
      satan: {
        lines: ['Chef, ich hab nicht mal einen Kalender. Wie soll ich da einen Pakt einhalten?'],
        choices: [{ text: 'Gutes Argument.' }],
      },
    };
  }
  // Keller offen, Koks-Suche, Dämon
  return {
    start: {
      lines: [n === 'koks'
        ? 'Nick will Koks? Natürlich will Nick Koks. Der Dealer hinten in der Gasse hat welches.'
        : n === 'boss'
          ? 'Chef ... von unten kommt Schwefelgeruch. Und Lilly sagt, ihr Föhn hat eben „Hail Satan“ gesagt.'
          : pick([
            'Der Keller ist hinter den Kisten, Chef. Ich geh da nicht runter. Da unten hört man Gitarren. Und Schreie. Und Gitarren, die schreien.',
            'Wenn du Nick siehst: Ich bin nicht hier. Ich bin eine Pflanze.',
          ])],
      choices: [BYE],
    },
  };
}

/** Nick, Metal-Satanist, auf seiner Bühne im Keller */
export function nickTree(): Record<string, DialogNode> {
  const n = f().nick;
  if (n === 'koks') {
    const k = state.inv.koks;
    if (k >= 5) {
      return {
        start: {
          lines: ['*schnüffelt* Riech ich da was? Fünf Ladungen? FÜNF?', 'Gib her, Opa. Gib. HER.'],
          choices: [{ text: 'Hier. Und dann lässt du Borna in Ruhe.', action: 'nickKoks' }, { text: 'Gleich.' }],
        },
      };
    }
    return {
      start: {
        lines: [k ? `${k} von fünf, Opa. Zählen lernt man in der Grundschule. Oder beim Dealer hinten in der Gasse.` : 'Fünf Ladungen. FÜNF. Vom Dealer hinten in der Gasse. Ich warte. Mein Puls sinkt.'],
        choices: [BYE],
      },
    };
  }
  if (!f().nickGetroffen) {
    return {
      start: {
        lines: ['*kreischendes Solo*', 'Wer stört mein Ritual? Ein WIRT? In MEINEM Keller?', 'W:Dein Keller liegt unter meinem Dachboden. Das ist schon mal komisch.', 'Raum ist ein Konstrukt, Opa. Was willst du?'],
        choices: [{ text: 'Du machst Borna das Geschäft kaputt.', next: 'borna' }, { text: 'Woher hast du so billiges Zeug?', next: 'zeug' }, { text: 'Nichts. Tschüss.' }],
      },
      zeug: {
        lines: ['Von unten. Ganz unten. Noch weiter unten als dieser Keller.', 'Mein Lieferant ist pünktlich. Er will nur ab und zu eine Seele. Und Feedback.'],
        choices: [{ text: 'Und Borna?', next: 'borna' }],
      },
      borna: {
        lines: [
          'Borna? Der Kiffer vom Dach? HAHAHA.',
          'Mein Zeug ist billiger, stärker, schneller. Seins riecht nach Kartoffelkeller.',
          'W:Dann lass uns verhandeln.',
          'Ich verhandle nicht, Opa. Ich DUELLIERE.',
          'Wer mich an der Gitarre schlägt, darf reden. Wer verliert, putzt die Nebelmaschine. Mit der Zunge.',
        ],
        onEnter: () => { f().nickGetroffen = true; },
        choices: [{ text: 'Gib mir eine Gitarre.', action: 'gitarrenDuell' }, { text: 'Ich überleg es mir.' }],
      },
    };
  }
  return {
    start: {
      lines: [pick(['Na, Opa? Bereit für die Abreibung?', 'Die Nebelmaschine ist noch dreckig. Nur so.', 'Du schon wieder. Hast du geübt? Auf deinem Zapfhahn?'])],
      choices: [{ text: 'Los. Duell.', action: 'gitarrenDuell' }, { text: 'Noch nicht.' }],
    },
  };
}

/** Nick clean in Weiß: hat aus allem gelernt, jammt gern */
export function nickWeissTree(): Record<string, DialogNode> {
  return {
    start: {
      lines: [pick([
        'Oh. Der Herr Wirt. Willkommen in meinem Proberaum. Bitte die Schuhe abtreten, der Boden ist frisch versiegelt.',
        'Ich trinke jetzt Matcha. Und meditiere. Satan hat nicht mal angerufen, so ernst ist die Trennung.',
        'Weiß ist die Farbe der Reinheit. Und der teuren Reinigung.',
      ])],
      choices: [{ text: 'Lust auf eine Session?', action: 'nickJam' }, { text: 'Was ist mit deinem Geschäft?', next: 'markt' }, { text: 'Was war da eigentlich los?', next: 'teufel' }, BYE],
    },
    markt: {
      lines: ['Gehört jetzt alles Borna. Ich hab ihm meine Kundenliste geschickt. Laminiert.', 'Ohne Teufel kann ich die Preise eh nicht halten. Und ehrlich: Ich will auch nicht mehr.'],
      choices: [{ text: 'Lust auf eine Session?', action: 'nickJam' }, BYE],
    },
    teufel: {
      lines: [
        'Er hat mir das Zeug geliefert. Spottbillig. Dafür wollte er ab und zu eine Seele. Und Feedback auf seinen Gitarrensound.',
        'Als du ihn aus mir rausgeprügelt hast, war ich auf einmal clean. Und ganz ehrlich: Sein Sound war eh Mist.',
        f().nickJam ? `Deine beste Session mit mir: ${f().nickJam} Punkte. Nicht schlecht, für einen Wirt.` : 'Spiel mal mit mir. Ohne Duell. Einfach so. Das ist das neue Ich.',
      ],
      choices: [{ text: 'Lust auf eine Session?', action: 'nickJam' }, BYE],
    },
  };
}
