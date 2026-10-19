import { state } from '../state';
import type { Choice, DialogNode } from './data';

// Polizist Felix und sein „Verhör“. Die Satire richtet sich gegen Felix und seine Vorurteile:
// Er bewertet harmlose Alltagsantworten nach einer absurden Schublade im Kopf.
// Hier lassen sich Fragen, Antworten, Reaktionen und der Schwellenwert frei ändern.

export interface FelixAnswer {
  text: string;
  /** landet in Felix' Schublade „verdächtig“ */
  suspicious: boolean;
  /** Felix' Reaktion auf die Antwort */
  reply: string;
}

export interface FelixQuestion {
  q: string;
  answers: FelixAnswer[];
}

export const FELIX = {
  /** so viele „verdächtige“ Antworten hintereinander, dann zieht Felix den Schlagstock */
  threshold: 3,
  intro: [
    'Guten Abend. Allgemeine Verkehrskontrolle.',
    'W:Ich bin zu Fuß.',
    'Eben. Verdächtig. Ich stell Ihnen jetzt ein paar ganz harmlose Fragen.',
  ],
  questions: [
    {
      q: 'Na, was ist denn Ihr Lieblingsessen?',
      answers: [
        { text: 'Currywurst', suspicious: false, reply: 'Currywurst. Ein Mann mit Werten. Sehr schön.' },
        { text: 'Schnitzel', suspicious: false, reply: 'Schnitzel! Wie bei Muttern. Ich mag Sie jetzt schon.' },
        { text: 'Döner', suspicious: true, reply: 'Döner. Soso. Ich hab ja nichts gegen ... aber ich notier mir das mal.' },
      ],
    },
    {
      q: 'Und was trinken Sie am liebsten?',
      answers: [
        { text: 'Pils', suspicious: false, reply: 'Pils. Ehrliches Getränk für ehrliche Bürger.' },
        { text: 'Ayran', suspicious: true, reply: 'Ayran. Interessant. Und woher kommen Sie? Nein, woher WIRKLICH?' },
        { text: 'Club-Mate', suspicious: true, reply: 'Club-Mate. Hausbesetzerbrause. Das kenn ich aus der Schulung.' },
      ],
    },
    {
      q: 'Letzte Frage: Was machen Sie in Ihrer Freizeit?',
      answers: [
        { text: 'Schützenverein', suspicious: false, reply: 'Schützenverein! Da bin ich auch. Wir sind quasi Kollegen.' },
        { text: 'Shisha-Bar', suspicious: true, reply: 'Shisha-Bar. Ich wusste es. Ich hab ein Gespür für so was.' },
        { text: 'Demo gegen Polizeigewalt', suspicious: true, reply: 'Polizeigewalt?! So was gibt es nicht. Und wenn doch, haben die angefangen.' },
      ],
    },
  ] as FelixQuestion[],
  /** Reaktion, wenn Felix sich beruhigt */
  passed: ['Na also. Sie sind sauber. Ein anständiger Bürger.', 'W:(Und das alles wegen Mittagessen.)'],
  /** Eskalation */
  escalate: ['DAS REICHT! Drei von drei! Das Profil passt!', 'Ich hab nichts gegen Sie. Ich hab nur was gegen ... ALLES AN IHNEN!'],
  /** spätere Begegnungen nach bestandenem Verhör */
  afterPassed: [
    'Ah, mein Lieblingsbürger. Currywurst, Pils, Schützenverein. So muss das.',
    'Weitergehen, Bürger. Ich hab hier hinten ein Auge auf verdächtige Elemente.',
    'Hier verschwinden Leute, sagen alle. Bestimmt die mit dem Döner.',
  ],
};

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Felix' Verdachtsmeter als Text, z. B. „[XX-]“ */
function meter(n: number) {
  return `[${'X'.repeat(n)}${'-'.repeat(Math.max(0, FELIX.threshold - n))}]`;
}

/** Gesprächsbaum mit Felix. Die Serie „verdächtiger“ Antworten zählt nur innerhalb eines Verhörs. */
export function felixTree(): Record<string, DialogNode> {
  if (state.flags.felixVerhoer === 'bestanden') {
    return { start: { lines: [pick(FELIX.afterPassed)], choices: [{ text: 'Schönen Dienst noch.' }] } };
  }
  let streak = 0;
  const last = FELIX.questions.length - 1;
  const nodes: Record<string, DialogNode> = {
    start: {
      lines: FELIX.intro,
      choices: [{ text: 'Ähm ... okay?', next: 'q0' }, { text: 'Ich muss dann mal.' }],
    },
    bestanden: {
      lines: FELIX.passed,
      onEnter: () => (state.flags.felixVerhoer = 'bestanden'),
      choices: [{ text: 'Schönen Dienst noch.' }],
    },
    eskalation: {
      portrait: 'nbust_copAngry',
      lines: FELIX.escalate,
      onEnter: () => (state.flags.felixVerhoer = 'eskaliert'),
      // auch ESC beendet das Gespräch nicht ohne den Schlagstock
      exitAction: 'felixKnueppel',
      choices: [{ text: 'Aber ich hab doch nur ...', action: 'felixKnueppel' }],
    },
  };
  FELIX.questions.forEach((q, i) => {
    nodes[`q${i}`] = {
      lines: [q.q],
      choices: q.answers.map((a, j): Choice => ({
        text: a.text,
        pick: () => (streak = a.suspicious ? streak + 1 : 0),
        next: `r${i}_${j}`,
      })),
    };
    q.answers.forEach((a, j) => {
      nodes[`r${i}_${j}`] = {
        lines: [
          a.reply,
          () => (a.suspicious
            ? `N:Felix kritzelt etwas in sein Notizbuch. Verdacht: ${meter(streak)}`
            : `N:Felix nickt zufrieden. Verdacht: ${meter(streak)}`),
        ],
        choices: [{
          text: i < last ? 'Nächste Frage.' : 'Und jetzt?',
          next: i < last ? `q${i + 1}` : () => (streak >= FELIX.threshold ? 'eskalation' : 'bestanden'),
        }],
      };
    });
  });
  return nodes;
}
