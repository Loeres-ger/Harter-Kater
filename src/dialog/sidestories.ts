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

// ---------------------------------------------------------------- Kurdischer Kevin

/** Kevins einzige Worte, bevor ihn die Panik packt. Läuft nur in seiner Flucht-Szene (Story-Flag kevinFlucht). */
export function kevinTree(): Record<string, DialogNode> {
  return {
    start: {
      lines: [
        'N:Der Mann ist riesig. Locken wie ein Wasserfall. Ein Tanga in Rot, Weiß und Grün mit einer gelben Sonne genau da, wo sie hingehört.',
        'Kevin. Kurdischer Kevin.',
        'Merk dir den Namen, Bruder. Den vergisst keiner.',
      ],
      choices: [
        { text: 'Äh ... angenehm?' },
        { text: 'Ich hab nichts gehört. Gar nichts.' },
        { text: 'Hast du gerade ... nein. Ich will es nicht wissen.' },
      ],
    },
  };
}

// ---------------------------------------------------------------- Leni

/**
 * Leni ist sturzbetrunken und hält den Wirt felsenfest für ihren Freund Xavi.
 * Vier Phasen: Verwechslung, Anhänglichkeit, absurde Liebeserklärung, abrupter Würgereiz.
 * Der Wirt blockt in jeder Antwort ab; mehr als ein Glas Wasser passiert nicht.
 * Ab Phase 2 endet auch ein vorzeitiges Schließen mit dem Würgereiz, damit das Gespräch nicht neu beginnt.
 */
export function leniTree(): Record<string, DialogNode> {
  const water = (next: string) => ({ text: 'Trink erst mal ein Glas Wasser.', next, pick: () => (state.flags.leniWasser = true) });
  return {
    // Phase 1: Verwechslung
    start: {
      lines: [
        'N:Leni hebt den Kopf vom Waschbecken, kneift die Augen zusammen ... und strahlt.',
        'XAVIII! Da bisse ja endlich! Xavi, Xavi, Xaviii ...',
        'Du hass mich ... *hicks* ... allein gelassen! Drei Stunden! „Kurz Kippen holen“, ja? JA, Xavi?',
        'Warum guckste so komisch, Xavi? Haste wieder was ausgefressen?',
      ],
      choices: [
        { text: 'Äh. Ich bin nicht Xavi.', next: 'nichtXavi' },
        { text: 'Ich ... hab keine Kippen.', next: 'kippen' },
        water('wasser1'),
      ],
    },
    nichtXavi: {
      lines: [
        'Nich Xavi? Pfff. Xavi macht immer so Witze. Xavi is sooo lustig.',
        'Ich erkenn dich doch, Xavi. An ... an deim Bauch. Der war früher kleiner. Aber ich lieb ihn trotzdem.',
      ],
      choices: [{ text: 'Das ist kein Bauch, das ist Erfahrung.', next: 'anhaenglich' }, { text: 'Leni, ich bin wirklich nicht ...', next: 'anhaenglich' }],
    },
    kippen: {
      lines: ['Keine Kippen. Typisch Xavi. Drei Stunden weg und dann keine Kippen.', 'Egal. EGAL! Hauptsache, du bis wieder da, Xavi.'],
      choices: [{ text: '...', next: 'anhaenglich' }],
    },
    wasser1: {
      lines: [
        'N:Der Wirt stellt ihr ein Glas Leitungswasser hin.',
        'Wasser? Xavi bringt mir WASSER? Seit wann biss du so ... fürsorglich?',
        'Das is das Süßeste, was du je gemacht hass, Xavi.',
      ],
      choices: [{ text: 'Trink. Langsam.', next: 'anhaenglich' }],
    },
    // Phase 2: anhänglich, aufdringlich
    anhaenglich: {
      exitAction: 'leniKotzt',
      lines: [
        'N:Leni hängt sich an den Arm des Wirts. Mit beiden Händen.',
        'Xavi ... ich hab dich so vermisst ... komm her, gib Küsschen ...',
        'Nur eins. Oder zwei. Oder ... alle, Xavi.',
        'Lass uns heimgehn, Xavi. Ich will mit dir allein sein. Ganz allein. Mit dir ins Bett. Und vorher ganz bestimmt nich schlafen.',
      ],
      choices: [
        { text: 'Leni, du bist sturzbetrunken.', next: 'absurd' },
        { text: 'Ich ruf dir ein Taxi. Für dich. Allein.', next: 'absurd' },
        water('absurd'),
      ],
    },
    // Phase 3: völlig überzeugt, immer absurder
    absurd: {
      exitAction: 'leniKotzt',
      lines: [
        'Betrunken? ICH? Xavi, ich bin nur ... verliebt. In dich. Und ein bisschen ins Waschbecken. Aber mehr in dich.',
        'N:Leni zieht den Wirt am Hemdkragen zu sich heran.',
        'Warum biss du so steif, Xavi? Sonst biss du nie so ... höflich.',
        'Und seit wann trägs du ne FLIEGE? Und nen Schnurrbart? Haste dir den für MICH wachsen lassen, Xavi?',
      ],
      choices: [
        { text: 'Der war schon immer da.', next: 'liebe' },
        { text: 'Leni. Sieh mich ganz genau an.', next: 'liebe' },
        { text: 'Ich bin nicht der, für den du mich hältst.', next: 'liebe' },
      ],
    },
    liebe: {
      exitAction: 'leniKotzt',
      lines: [
        'Doch, doch. Du biss mein Xavi. Mein Xaviii. Mein Xavilein. Mein Xavi-Bär.',
        'Ich liebe dich, Xavi. Ich will dich heiraten. Hier. Jetz. Der Seifenspender kann Trauzeuge sein.',
        'Und dann gehn wir heim und machen ... machen ... Komm ganz nah, Xavi, ich muss dir was ganz Wichtiges ...',
      ],
      choices: [
        { text: 'Leni, nein.', next: 'wuergen' },
        { text: 'Was musst du mir sagen?', next: 'wuergen' },
      ],
    },
    // Phase 4: abrupter Abbruch
    wuergen: {
      portrait: 'nbust_leniSick',
      exitAction: 'leniKotzt',
      lines: [
        'N:Leni erstarrt mitten im Satz. Ihr Gesicht wird blass. Dann grün. Dann sehr grün.',
        'Xavi ... mir is ... HMPF!',
      ],
      choices: [{ text: 'Leni?!', action: 'leniKotzt' }],
    },
  };
}

/** Leni, wieder halbwegs bei sich */
export function leniDanachTree(): Record<string, DialogNode> {
  return {
    start: {
      lines: [
        'Oh nein. Du bist gar nicht Xavi. Du bist der Wirt. Mit Fliege.',
        'Hab ich dir ... einen Heiratsantrag gemacht? Mit dem Seifenspender als Trauzeugen?',
        () => (state.flags.leniWasser ? 'Danke für das Wasser. Und dass du ... na ja. Anständig warst. Hier drin ist sonst keiner anständig.' : 'Mein Kopf. Hat jemand ein Glas Wasser? Nein? War ja klar.'),
      ],
      choices: [
        { text: 'Und wer ist Xavi?', next: 'xavi' },
        { text: 'Komm gut nach Hause, Leni.' },
      ],
    },
    xavi: {
      lines: ['Mein Freund. Der wollte vor drei Stunden „kurz Kippen holen“.', 'Weißt du was? Sag ihm ruhig, dass ich dich heiraten wollte. Der soll ruhig eifersüchtig werden.'],
      choices: [{ text: 'Mach ich.' }],
    },
  };
}
