import { GUESTS } from '../guests/data';
import { felixTree } from './felix';
import { mayaTree } from './maya';
import { bornaTree, leniDanachTree, leniTree, lilyDachTree, lilyTree } from './sidestories';
import { PILLS, bulky, lookStage, state } from '../state';

// Gespräche: wer redet (Name, Farbe, Porträt, Kulisse) und was gesagt wird.
// Ein Knoten hat Zeilen der Figur (mit „W:“ davor spricht der Wirt) und Antworten zur Auswahl.

export type DialogBg = 'bar' | 'street' | 'cat' | 'dach' | 'wc' | 'laden';
/** Was nach dem Gespräch passieren soll; wertet die aufrufende Szene aus. */
export type DialogAction =
  | 'shop' | 'kill' | 'tresen' | 'speed' | 'bulk'
  | 'felixKnueppel' | 'lilyWeg' | 'lilyDach' | 'bornaGebrochen' | 'leniKotzt' | 'mayaTraum';

export interface Choice {
  text: string;
  /** nächster Knoten (oder Funktion, die ihn je nach Verlauf bestimmt); ohne next und action endet das Gespräch */
  next?: string | (() => string);
  action?: DialogAction;
  /** wird beim Wählen ausgeführt, z. B. um ein Story-Flag zu setzen */
  pick?: () => void;
}

export interface DialogNode {
  /** Funktionen werden bei jedem Besuch des Knotens neu ausgewertet (z. B. Zufallstipps).
   *  „W:“ davor: spricht der Wirt, „N:“ davor: Erzähltext */
  lines: (string | (() => string))[];
  choices: Choice[];
  /** Porträt des Gegenübers ab diesem Knoten wechseln (z. B. wütend) */
  portrait?: string;
  /** beim Betreten des Knotens, z. B. Story-Flag setzen */
  onEnter?: () => void;
  /** diese Aktion gilt auch, wenn das Gespräch hier vorzeitig beendet wird */
  exitAction?: DialogAction;
}

export interface Speaker {
  name: string;
  color: string;
  portrait: string;
  bg: DialogBg;
  /** Porträt tiefer setzen (Leonard ist sehr klein) */
  drop?: number;
  /** Knoten werden beim Öffnen erzeugt, damit sie den aktuellen Spielstand kennen */
  tree: () => Record<string, DialogNode>;
}

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const BYE: Choice = { text: 'Bis später.' };

/** Kalles Tipps, wenn man ihn um Rat fragt */
const KALLE_TIPS = [
  'Der Lackaffe da? Gib ihm, was er will. Dann zahlt er.',
  'Nicht zu hastig, Chef. Sonst merkt er was.',
  'Hinten in der Gasse steht einer, der hat ... Spezielles.',
  'Die Katze draußen? Hat nur noch ein Auge. Das andere glüht. Die frisst alles. ALLES.',
  'Sie nennen sie die Königskatze, Chef. Aber das ist kein König. Das ist ... die Pest.',
  'Hinten in der Gasse läuft jetzt Polizist Felix Streife. Pass auf seine Taschenlampe auf.',
  'Lass den Lackaffen nicht warten, Chef. Ungeduldige Gäste werden misstrauisch.',
  'Die Automaten da hinten? Die Risikoleiter hat mich mein Haus gekostet, Chef.',
  'Buch der Ratte ... drei Bücher, Chef. Dann geht die Post ab.',
  'Setz nie auf Schnecke. Ich weiß, wovon ich rede.',
  'Mülltonnen, Chef. Da liegt oft noch Fusel drin.',
  'Knapp bei Kasse? Die Damen in der Gasse haben Bares. Aber lass keine Leichen rumliegen, Chef.',
];

function kalle(): Record<string, DialogNode> {
  return {
    start: {
      lines: ['Zzz ... hm? ... Ah, Chef. Noch ein Korn?'],
      choices: [
        { text: 'Was weißt du über den Lackaffen?', next: 'glanz' },
        { text: 'Erzähl mir von der Katze.', next: 'katze' },
        { text: 'Wie komm ich an Geld?', next: 'geld' },
        { text: 'Hast du einen Tipp für mich?', next: 'tipp' },
        { text: 'Schlaf weiter, Kalle.' },
      ],
    },
    glanz: {
      lines: ['Von Glanz. Anwalt. Will den Eimer abreißen für seine Lofts.', 'Gib ihm, was er will, Chef. Erst Bier, dann Härteres. Und nicht zu hastig, sonst merkt er was.'],
      choices: [{ text: 'Und wenn er misstrauisch wird?', next: 'misstrauen' }, { text: 'Was noch?', next: 'start' }],
    },
    misstrauen: {
      lines: ['Lass ihn nicht warten. Ungeduldige Gäste werden misstrauisch.', 'Und was er nicht kennt, nimmt er erst, wenn er weich genug ist.'],
      choices: [{ text: 'Was noch?', next: 'start' }, BYE],
    },
    katze: {
      lines: ['Die Königskatze. Hinten in der Gasse. Ein Auge glüht, das andere ist blind.', 'Die frisst alles, Chef. ALLES. Und sie wird immer hungriger.'],
      choices: [{ text: 'Alles?', next: 'alles' }, { text: 'Was noch?', next: 'start' }],
    },
    alles: {
      lines: ['W:Alles?', 'Wenn einer hier mal ... nicht mehr aufsteht, Chef. Die Katze räumt auf. Hab ich gehört.'],
      choices: [{ text: 'Was noch?', next: 'start' }, BYE],
    },
    geld: {
      lines: [
        pick(['Mülltonnen, Chef. Da liegt oft noch Fusel drin.', 'Die Automaten da hinten. Aber setz nie auf Schnecke.']),
        'Und wenn die Stammgäste pöbeln: rausprügeln. Die lassen dann was da.',
      ],
      choices: [{ text: 'Und der Dealer?', next: 'dealer' }, { text: 'Was noch?', next: 'start' }],
    },
    tipp: { lines: [() => pick(KALLE_TIPS)], choices: [{ text: 'Noch einen Tipp?', next: 'tipp' }, { text: 'Was noch?', next: 'start' }] },
    dealer: {
      lines: ['Hinten in der Gasse. Pillen und Zeug. Aber nie kaufen, wenn Felix guckt. Der Bulle.'],
      choices: [{ text: 'Was noch?', next: 'start' }, BYE],
    },
  };
}

function glanz(): Record<string, DialogNode> {
  const s = lookStage();
  const hello = [
    'Herr Wirt. Ich warte. Das ist hier offenbar Teil des Konzepts.',
    'Ah, der Wirt. Ihr Laden ... wächst einem ans Herz. Wie Schimmel.',
    'Wirt! Hehe. Wissen Sie was? Sie sind gar nicht so übel.',
    'Horst ... Horstilein. Ich hab gezittert heute früh. Gib mir was.',
    'Bitte ... irgendwas. Ich zahl alles. Die Lofts ... egal ...',
  ][s];
  return {
    start: {
      lines: [hello],
      choices: [
        { text: 'Was darf es sein?', action: 'tresen' },
        { text: 'Wie laufen die Geschäfte?', next: 'lofts' },
        { text: 'Wie geht es Ihnen?', next: 'befinden' },
        BYE,
      ],
    },
    lofts: {
      lines: s < 2
        ? ['Prächtig. In vier Wochen steht hier ein Glaspalast. Sie dürfen gerne zur Eröffnung kommen. Als Zuschauer.']
        : s < 4
          ? ['Brenninger ruft dauernd an. Die Unterschrift ... die mach ich morgen. Oder übermorgen.']
          : ['Welche Lofts? ... Ach so. Die. Mir doch egal.'],
      choices: [{ text: 'Was darf es sein?', action: 'tresen' }, BYE],
    },
    befinden: {
      lines: s < 2
        ? ['Ausgezeichnet. Ich jogge jeden Morgen. Im Gegensatz zu Ihren Gästen.']
        : s < 4
          ? ['Ein bisschen ... wackelig. Das Licht ist so hell hier. War das immer so hell?']
          : ['Meine Frau hat angerufen. Oder war das die Bank. Egal. Noch einen.'],
      choices: [{ text: 'Was darf es sein?', action: 'tresen' }, BYE],
    },
  };
}

function guest(id: string): () => Record<string, DialogNode> {
  const g = GUESTS.find((x) => x.id === id)!;
  const ABOUT: Record<string, [string, string]> = {
    bernd: ['Und, was baut ihr gerade?', 'Lofts. Für so einen Anzugheini. Glanz oder so. Zahlt pünktlich, das muss man ihm lassen.'],
    sabine: ['Worum geht die Arbeit?', 'Die Kneipe als letzter sozialer Raum. Sie sind Kapitel drei. Der Wirt als Archetyp.'],
    ralf: ['Wo ist dein Motorrad?', 'Abgeschleppt. Vor dem neuen Glasbau da drüben. Die verstehen keinen Spaß.'],
    frank: ['Wie hat dein Verein gespielt?', 'Verloren. Wieder. Aber nächstes Jahr, Chef. Nächstes Jahr!'],
    uwe: ['Na, Uwe, wieder Ärger im Amt?', 'Ich bearbeite Bauanträge. Den von Glanz hab ich in drei Tagen durchgewunken. Das war ... ungewöhnlich schnell.'],
    gerda: ['Wie geht es dem Kater, Gerda?', 'Der ist weg, seit diese Katze in der Gasse rumschleicht. Die mit dem Auge. Unheimliches Vieh.'],
  };
  const [ask, answer] = ABOUT[id] ?? ['Und sonst?', 'Muss ja.'];
  return () => ({
    start: {
      lines: [pick(g.calm)],
      choices: [
        { text: ask, next: 'about' },
        { text: 'Kennst du den Schnösel am Tresen?', next: 'glanz' },
        { text: 'Prost. Lass es dir schmecken.' },
      ],
    },
    about: { lines: [answer], choices: [{ text: 'Kennst du den Schnösel am Tresen?', next: 'glanz' }, BYE] },
    glanz: {
      lines: [state.dead ? 'Der feine Herr? Den hab ich lange nicht gesehen. Komisch eigentlich.' : pick(['Der im Anzug? Der guckt uns an wie Ungeziefer.', 'Der will den Laden plattmachen, sagen alle. Gib ihm ordentlich einen aus, Chef.', 'Nie gesehen, dass einer so schnell so fertig aussieht.'])],
      choices: [BYE],
    },
  });
}

function dealer(): Record<string, DialogNode> {
  return {
    start: {
      lines: [pick(['Psst. Hier drüben. Keine Fragen, keine Namen.', 'Na, Wirt. Wieder Bedarf für deinen schicken Freund? Hehe.'])],
      choices: [
        { text: 'Was hast du?', action: 'shop' },
        { text: 'Ist das Zeug sicher?', next: 'sicher' },
        { text: 'Was ist mit Felix, dem Bullen?', next: 'bulle' },
        { text: 'Kein Interesse.' },
      ],
    },
    sicher: { lines: ['Sicher? Bruder. Nichts hier ist sicher. Aber es wirkt.'], choices: [{ text: 'Was hast du?', action: 'shop' }, BYE] },
    bulle: { lines: ['Der läuft die Gasse rauf und runter. Wenn seine Lampe uns erwischt, kenn ich dich nicht.'], choices: [{ text: 'Was hast du?', action: 'shop' }, BYE] },
  };
}

function dame(): Record<string, DialogNode> {
  return {
    start: {
      lines: [pick(['Na, Süßer? Kalt heute, was?', 'Hey Wirt. Spendierst du mal einen Kaffee?', 'Du schon wieder. Hast du Feierabend?'])],
      choices: [
        { text: 'Wie läuft das Geschäft?', next: 'geschaeft' },
        { text: 'Hast du was gesehen?', next: 'gesehen' },
        { text: 'Umlegen', action: 'kill' },
        BYE,
      ],
    },
    geschaeft: {
      lines: ['Mies. Seit die Glasbauten kommen, schickt Felix uns ständig weiter. Und meine Kollegin ist seit Tagen weg.'],
      choices: [{ text: 'Umlegen', action: 'kill' }, BYE],
    },
    gesehen: {
      lines: ['Nur die Katze. Die sitzt da und starrt. Manchmal hör ich sie nachts kauen.'],
      choices: [{ text: 'Umlegen', action: 'kill' }, BYE],
    },
  };
}

function leonard(): Record<string, DialogNode> {
  const buy: Choice[] = [
    { text: `Die Blauen. (${PILLS.speed}€)`, action: 'speed' },
    { text: `Die Roten. (${PILLS.bulk}€)`, action: 'bulk' },
  ];
  return {
    start: {
      lines: [bulky()
        ? 'Ey. Jetzt siehst du aus wie ich. Nur größer. Das verzeih ich dir nie.'
        : pick(['Ich lehn hier nicht. Die Laterne lehnt an MIR.', 'Na, Wirt. Ich bin der kräftige Leonard. Das „kräftig“ ist kein Spitzname.', 'Guckst du auf meine Waden? Jeder guckt auf meine Waden.'])],
      choices: [
        { text: 'Was verkaufst du?', next: 'ware' },
        { text: 'Warum bist du so ... kompakt?', next: 'klein' },
        { text: 'Tschüss, Leonard.' },
      ],
    },
    ware: {
      lines: [
        'Medikamente. Rein medizinisch. Steht nix drauf, weil nix draufstehen darf.',
        'Die Blauen machen dich schnell. Die Roten machen dich BREIT. Jeweils eine Minute. Danach tut alles weh.',
      ],
      choices: [...buy, { text: 'Lieber nicht.' }],
    },
    klein: {
      lines: ['Kompakt? Ich bin 1,38 Meter pure Dichte, Freundchen.', 'Mein Arzt hat gesagt, ich soll aufhören. Mein Arzt ist jetzt Frührentner.'],
      choices: [{ text: 'Was verkaufst du?', next: 'ware' }, BYE],
    },
  };
}

function cat(): Record<string, DialogNode> {
  return {
    start: {
      lines: ['Das glühende Auge folgt dir. Das blinde auch.', 'Ein Geräusch wie ein Lachen. Katzen lachen nicht.'],
      choices: [
        { text: 'Mietz, mietz?', next: 'mietz' },
        { text: 'Hast du Hunger?', next: 'hunger' },
        { text: 'Langsam zurückweichen.' },
      ],
    },
    mietz: { lines: ['Unter dem Fell bewegt sich etwas. Mehr als eine Sache.', 'Du ziehst die Hand zurück.'], choices: [{ text: 'Hast du Hunger?', next: 'hunger' }, { text: 'Langsam zurückweichen.' }] },
    hunger: { lines: ['Die Katze leckt sich das Maul. Dann sieht sie zur Kneipe. Lange.', 'Bring ihr was Großes.'], choices: [{ text: 'Langsam zurückweichen.' }] },
  };
}

export const SPEAKERS: Record<string, Speaker> = {
  kalle: { name: 'KALLE', color: '#d8a880', portrait: 'bustPenner', bg: 'bar', tree: kalle },
  glanz: { name: 'DR. VON GLANZ', color: '#90b8ff', portrait: 'bust0', bg: 'bar', tree: glanz },
  dealer: { name: 'DEALER', color: '#8ad08a', portrait: 'nbust_dealer', bg: 'street', tree: dealer },
  cop: { name: 'POLIZIST FELIX', color: '#7aa8ff', portrait: 'nbust_cop', bg: 'street', tree: felixTree },
  dame0: { name: 'CHANTAL', color: '#ff7ac0', portrait: 'nbust_dame0', bg: 'street', tree: dame },
  dame1: { name: 'JACKY', color: '#d090ff', portrait: 'nbust_dame1', bg: 'street', tree: dame },
  leonard: { name: 'KRÄFTIGER LEONARD', color: '#ff9a50', portrait: 'nbust_leonard', bg: 'street', drop: 30, tree: leonard },
  borna: { name: 'BEKIFFTER BORNA', color: '#a8d070', portrait: 'nbust_borna', bg: 'dach', tree: bornaTree },
  lily: { name: 'LILY', color: '#c8a0e0', portrait: 'nbust_lily', bg: 'street', tree: lilyTree },
  lilyDach: { name: 'LILY', color: '#c8a0e0', portrait: 'nbust_lilyHappy', bg: 'dach', tree: lilyDachTree },
  leni: { name: 'LENI', color: '#ff90b0', portrait: 'nbust_leni', bg: 'wc', tree: leniTree },
  leniDanach: { name: 'LENI', color: '#ff90b0', portrait: 'nbust_leni', bg: 'wc', tree: leniDanachTree },
  maya: { name: 'MEISTERNUTTE MAYA', color: '#e05a7a', portrait: 'nbust_maya', bg: 'laden', tree: mayaTree },
  katze: { name: 'DIE KATZE', color: '#b8f060', portrait: '', bg: 'cat', tree: cat },
};
for (const g of GUESTS) SPEAKERS[g.id] = { name: g.name.toUpperCase(), color: '#f0c890', portrait: `gbustN_${g.id}`, bg: 'bar', tree: guest(g.id) };

/** Porträt kann vom Spielstand abhängen (von Glanz verfällt sichtbar). */
export function portraitOf(id: string) {
  if (id === 'glanz') return `bust${lookStage()}`;
  if (id === 'borna' && state.flags.borna === 'hoffnung') return 'nbust_bornaHappy';
  if (id === 'maya' && state.flags.mayaTraum) return 'nbust_mayaHappy';
  return SPEAKERS[id].portrait;
}
