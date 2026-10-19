import type { DialogNode } from './data';

// Event „Anne“: Ein kleines Mädchen verirrt sich in die Kneipe. Sie spricht nur Spanisch;
// die Übersetzung steht als Erzähltext darunter. Jedes Ende des Gesprächs startet die Verfolgungsjagd.

export function anneTree(): Record<string, DialogNode> {
  return {
    start: {
      exitAction: 'anneJagd',
      lines: [
        'N:Ein kleines Mädchen steht mitten in der Kneipe und schaut sich mit riesigen Augen um.',
        'Hola ... ¿Dónde estoy?',
        'N:(„Hallo ... Wo bin ich?“)',
        'W:Was machst du denn hier? Du bist doch noch gar nicht achtzehn!',
        '¿Qué? No entiendo ... ¿Tienes zumo de naranja?',
        'N:(„Was? Ich versteh nicht ... Hast du Orangensaft?“)',
      ],
      choices: [
        { text: 'Raus hier. Sofort. Ab nach draußen!', next: 'raus' },
        { text: 'Orangensaft? Das hier ist eine KNEIPE.', next: 'saft' },
      ],
    },
    saft: {
      exitAction: 'anneJagd',
      lines: [
        '¡Zumo! ¡Zumo! ¡Zumo!',
        'N:(„Saft! Saft! Saft!“)',
        'N:Kalle hebt den Kopf, murmelt „Für mich auch“ und schläft weiter.',
      ],
      choices: [{ text: 'Okay. Du gehst jetzt raus. Komm.', next: 'raus' }],
    },
    raus: {
      exitAction: 'anneJagd',
      lines: [
        'N:Der Wirt zeigt auf die Tür. Anne schaut auf die Tür. Dann auf den Wirt. Dann grinst sie.',
        '¿Un juego? ¡Sí! ¡Atrápame, señor bigote!',
        'N:(„Ein Spiel? Ja! Fang mich, Herr Schnurrbart!“)',
        'N:Anne kichert und flitzt los.',
      ],
      choices: [{ text: 'Na warte!', action: 'anneJagd' }],
    },
  };
}

/** Zeit abgelaufen: Felix hat Anne rausgebracht und nimmt sich den Wirt vor. */
export function felixAnneTree(): Record<string, DialogNode> {
  return {
    start: {
      lines: [
        'Sag mal, hast du sie noch alle?! Hier rennt ein Kind durch deine Kneipe, und du kriegst es nicht mal hin, sie rauszubringen!',
        'Ich hab sie draußen ihrer Mutter übergeben. Die sucht seit einer Stunde die ganze Straße ab.',
        'Jugendschutz. Aufsichtspflicht. Und mein Feierabend. Das wird teuer, Freundchen.',
        'W:Wie teuer?',
        'Alles. Bis auf fünf Euro. Für ein Pils. Damit du was zum Nachdenken hast.',
      ],
      choices: [{ text: 'Aber ...' }, { text: 'Jawohl, Herr Wachtmeister.' }],
    },
  };
}
