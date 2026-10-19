import { state } from '../state';
import type { DialogNode } from './data';

// Gespräche der Nebenhandlungen: Borna (Dachboden), Lily (Gasse/Dachboden), Leni (Damentoilette). Entscheidungen landen als Story-Flags in state.flags (siehe progress/flags.ts).

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const f = () => state.flags;

// ---------------------------------------------------------------- Borna

export function bornaTree(): Record<string, DialogNode> {
  if (f().borna === 'hoffnung') {
    return {
      start: {
        lines: [pick([
          'Chef! Ich war heute DRAUSSEN. Mit Sonne. Die ist echt hell, wusstest du das?',
          'Lily hat gesagt, ich soll mal lüften. Ich hab das Fenster aufgemacht. Da war Welt dahinter.',
          'Ich rauch nur noch halb so viel. Die andere Hälfte rede ich jetzt. Mit Lily.',
        ])],
        choices: [
          { text: 'Wie läuft es mit Lily?', next: 'lily' },
          { text: 'Schön, dich so zu sehen.' },
        ],
      },
      lily: {
        lines: ['Sie lacht über meine Witze. Auch über die schlechten. Vor allem über die schlechten.', 'Chef ... ich glaub, ich hab wieder einen Grund, morgens aufzustehen. Oder mittags. Fang wir klein an.'],
        choices: [{ text: 'Mach was draus, Borna.' }],
      },
    };
  }
  const first = !f().bornaGetroffen;
  return {
    start: {
      onEnter: () => { f().bornaGetroffen = true; f().bornaDruck = 0; },
      lines: first
        ? ['Ey ... ey. Bist du echt, oder bin ich das?', 'W:Ich bin der Wirt. Das hier ist mein Dachboden.', 'Ah. Dann bin ich ... der Typ auf deinem Dachboden. Borna. Hi.']
        : [pick(['Ey, der Wirt. Ich hab dich ... vermisst? Oder war das Hunger?', 'Pssst. Ich hör den Regen. Der klingt heute traurig.', 'Chef. Weißt du, wie viele Dachziegel das sind? 412. Oder 413.'])],
      choices: [
        { text: 'Wie lange wohnst du schon hier?', next: 'wer' },
        { text: 'Was machst du den ganzen Tag?', next: 'tag' },
        { text: 'Du solltest mal raus hier.', next: 'raus' },
        { text: 'Du bist echt ein Schmarotzer, Borna.', next: 'druck1', pick: () => (f().bornaDruck = 1) },
        { text: 'Bis später, Borna.' },
      ],
    },
    wer: {
      lines: ['Dein Vorgänger hat gesagt, ich darf bleiben, bis ich wieder klarkomme. Das war 2019.', 'Ich komm noch klar. Bald. Nach dem nächsten.'],
      choices: [{ text: 'Was machst du den ganzen Tag?', next: 'tag' }, { text: 'Bis später, Borna.' }],
    },
    tag: {
      lines: [
        'Ich zähl die Dachziegel. Von innen. Je nachdem, wie breit ich bin, sind es 412 oder 413.',
        'Manchmal hör ich unten die Leute lachen. Dann mach ich die Musik lauter. Ist leichter, als runterzugehen.',
      ],
      choices: [{ text: 'Du solltest mal raus hier.', next: 'raus' }, { text: 'Bis später, Borna.' }],
    },
    raus: {
      lines: ['Raus? Da draußen sind ... Leute. Und Licht. Und Termine.', 'Weißt du, wann mich zuletzt einer was gefragt hat? Außer „Hast du noch was“?'],
      choices: [
        { text: 'Ich frag dich jetzt was: Wie geht es dir?', next: 'ehrlich' },
        { text: 'Bis später, Borna.' },
      ],
    },
    ehrlich: {
      lines: ['Ehrlich? Wie ein Fusel, der umgekippt ist. Alles läuft aus, und keiner wischt es auf.', '... Aber danke, dass du fragst. Echt jetzt.'],
      choices: [{ text: 'Halt durch, Borna.' }],
    },
    // Verlauf A: der Wirt macht Borna fertig
    druck1: {
      lines: ['Ja ... ja, schon. Ich weiß.', 'Ich zahl keine Miete. Ich ess deine Erdnüsse. Ich weiß.'],
      choices: [
        { text: 'Sorry. War nicht so gemeint.', next: 'versoehnt', pick: () => (f().bornaDruck = 0) },
        { text: 'Keiner würde merken, wenn du weg wärst.', next: 'druck2', pick: () => (f().bornaDruck = 2) },
      ],
    },
    druck2: {
      lines: ['N:Borna sagt lange nichts. Der Joint in seiner Hand geht aus.', '... Meinst du echt?'],
      choices: [
        { text: 'Nein. Vergiss es. Tut mir leid.', next: 'versoehnt', pick: () => (f().bornaDruck = 0) },
        { text: 'Ja. Ehrlich gesagt: Du bist allen egal.', action: 'bornaGebrochen' },
      ],
    },
    versoehnt: {
      lines: ['Schon gut, Chef. Ich hab schon Schlimmeres über mich gedacht.', 'Heute sogar. Zweimal.'],
      choices: [{ text: 'Bis später, Borna.' }],
    },
  };
}

// ---------------------------------------------------------------- Lily

/** Lily in der Hintergasse */
export function lilyTree(): Record<string, DialogNode> {
  return {
    start: {
      lines: [pick(['Oh. Hi. Ich sitz nur ... hier. Ist das Ihre Gasse? Sorry.', 'Keine Sorge, ich will nichts. Ich sitz nur. Sitzen ist umsonst.'])],
      choices: [
        { text: 'Alles okay bei dir?', next: 'okay' },
        { text: 'Hier kannst du nicht bleiben. Geh nach Hause.', next: 'weg' },
      ],
    },
    okay: {
      lines: [
        'Klar. Ich sitz nachts gern auf nassem Asphalt neben Mülltonnen. Ist so ein Hobby.',
        '... Nein. Ist es nicht. Ich bin vor drei Monaten hergezogen. Kenn keinen. Die WG hat mich rausgeworfen, weil ich „zu still“ war.',
      ],
      choices: [{ text: 'Und jetzt?', next: 'jetzt' }],
    },
    jetzt: {
      lines: [
        'Jetzt sitz ich hier und warte, dass irgendwas passiert. Bisher kam nur eine Katze vorbei. Die hat mich angeguckt wie einen Snack.',
        'Manchmal glaub ich, es gibt einfach keinen Platz für mich. Nirgends.',
      ],
      choices: [
        { text: 'Oben auf dem Dachboden ist es warm. Da ist Platz.', next: 'angebot' },
        { text: 'Hier kannst du nicht bleiben. Geh nach Hause.', next: 'weg' },
      ],
    },
    angebot: {
      lines: [
        'Auf Ihrem Dachboden? ... Ist das so ein Ding, bei dem ich am Ende in einem Fass lande?',
        'W:Da wohnt schon einer. Borna. Der ist harmlos. Und meistens bekifft.',
        'Ein bekiffter Typ auf einem Dachboden. Klingt ehrlich gesagt besser als die Gasse.',
      ],
      choices: [
        { text: 'Dann komm mit.', action: 'lilyDach' },
        { text: 'Überleg es dir in Ruhe.' },
      ],
    },
    weg: {
      lines: ['Nach Hause. Klar. Mach ich.', 'N:Lily steht auf, klopft sich den Dreck von der Hose und geht, ohne sich umzudrehen.'],
      exitAction: 'lilyWeg',
      choices: [{ text: '...', action: 'lilyWeg' }],
    },
  };
}

/** Lily auf dem Dachboden, nach der gemeinsamen Nacht mit Borna */
export function lilyDachTree(): Record<string, DialogNode> {
  return {
    start: {
      lines: [pick([
        'Hey, Herr Wirt. Danke noch mal. Für ... alles. Auch für die dünnen Wände nicht.',
        'Borna hat heute aufgeräumt. Also, er hat EINE Socke aufgehoben. Aber das ist ein Anfang.',
        'Ich hab einen Job gefunden! Im Copyshop. Da bin ich auch zu still. Passt perfekt.',
      ])],
      choices: [
        { text: 'Wie gefällt es dir hier oben?', next: 'hier' },
        { text: 'Pass gut auf ihn auf.' },
      ],
    },
    hier: {
      lines: ['Es zieht, es riecht nach Gras und die Matratze hat eine Vergangenheit.', 'Bester Platz, den ich seit Monaten hatte.'],
      choices: [{ text: 'Freut mich.' }],
    },
  };
}

// ---------------------------------------------------------------- Leni

/** Leni ist sehr betrunken und hält den Wirt für ihren Freund Xavi. Der Wirt hilft ihr, mehr passiert nicht. */
export function leniTree(): Record<string, DialogNode> {
  const water = { text: 'Trink erst mal ein Glas Wasser.', next: 'wasser', pick: () => (state.flags.leniWasser = true) };
  return {
    start: {
      lines: ['Xaviii ... da bisse ja ... *hicks*', 'Du riechst anders. Nach Bier. Und Bratfett. Is neu. Steht dir.'],
      choices: [
        { text: 'Ich bin nicht Xavi. Ich bin der Wirt.', next: 'nichtX' },
        water,
        { text: 'Ich ruf dir ein Taxi.', next: 'taxi' },
      ],
    },
    nichtX: {
      lines: ['Pssst. Xavi macht immer so Witze.', 'Komm ma her ... gib Küsschen ... nur eins ... warum bist du so weit weg ...'],
      choices: [
        { text: 'Leni, du bist betrunken. Setz dich erst mal hin.', next: 'moment' },
        water,
      ],
    },
    taxi: {
      lines: ['Taxi? Nee ... ich will nich nach Hause ... ich will Xavi ...', 'Du BIST ja Xavi ... komm her ... *hicks*'],
      choices: [
        { text: 'Nein. Ich bin der Wirt, und du gehörst ins Bett. Allein.', next: 'moment' },
        water,
      ],
    },
    wasser: {
      lines: [
        'N:Der Wirt stellt ihr ein Glas Leitungswasser hin.',
        'Wasser ... Xavi, du bist so ... fürsorglich ... seit wann bist du so breit ... ich mag das ...',
        'Komm ma näher ... Moment ... Moment ...',
      ],
      exitAction: 'leniKotzt',
      choices: [{ text: 'Leni?', action: 'leniKotzt' }],
    },
    moment: {
      lines: ['Moment ... mir is ... mir is so ...', 'N:Leni wird blass. Dann grün.'],
      exitAction: 'leniKotzt',
      choices: [{ text: 'Leni?', action: 'leniKotzt' }],
    },
  };
}

/** Leni, wieder halbwegs bei sich */
export function leniDanachTree(): Record<string, DialogNode> {
  return {
    start: {
      lines: [
        'Oh nein. Du bist gar nicht Xavi. Du bist der Wirt.',
        'Hab ich ... hab ich gesagt, dass du nach Bratfett riechst? Sorry. Stimmt aber.',
        () => (state.flags.leniWasser ? 'Danke für das Wasser. Echt. Das war ... nett. Hier drin ist sonst keiner nett.' : 'Mein Kopf. Hat jemand ein Glas Wasser? Nein? War ja klar.'),
      ],
      choices: [
        { text: 'Und wer ist Xavi?', next: 'xavi' },
        { text: 'Komm gut nach Hause, Leni.' },
      ],
    },
    xavi: {
      lines: ['Mein Freund. Der wollte vor drei Stunden „kurz Zigaretten holen“.', 'Ich glaub, ich hol mir auch mal was. Einen neuen Freund zum Beispiel.'],
      choices: [{ text: 'Klingt nach einem Plan.' }],
    },
  };
}
