import { state } from '../state';
import type { StoryFlags } from '../progress/flags';
import { strangZiel } from '../progress/quests';
import { gelesen, PC_FILES } from './pcFiles';
import { hochzeitPruefen } from './kanal';
import type { Choice, DialogNode } from './data';

// Kalle: Stammgast, Penner, Leitfaden. Er kennt viele Themen, bietet aber immer nur die drei an, die gerade am
// meisten zählen: zuerst die laufende Aufgabe (mit einem konkreten Tipp, wo es weitergeht), dann etwas, das man in
// der Stadt noch entdecken kann, dann Kalle selbst. Neues Thema: Eintrag in THEMEN mit Bedingung und Wichtigkeit.

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const WEITER: Choice[] = [{ text: 'Was noch?', next: 'start' }, { text: 'Schlaf weiter, Kalle.' }];

interface Thema {
  id: string;
  frage: string | (() => string);
  /** Antwortzeilen („W:“ spricht der Wirt, „N:“ Erzähltext) */
  antwort: () => string[];
  /** 0 oder weniger: gerade kein Thema. Je höher, desto eher gehört es zu den drei angebotenen. */
  wichtig: (f: StoryFlags) => number;
  /** beim Betreten der Antwort, z. B. eine Besorgung erledigen */
  onEnter?: () => void;
}

/** Tipp zur laufenden Aufgabe, in Kalles Worten; sonst null */
function aufgabe(f: StoryFlags): string[] | null {
  // Teil 1 „Unter dem Eimer“
  if (f.strangBereit === 'kanal' && !f.kanal) return ['Kevin hockt im Muskelkater und schmachtet einen Tänzer an, Chef.', 'Der will was von dir. Ich glaub, es geht um Liebe. Oder um Käse.'];
  switch (f.kanal) {
    case 'kaese': return state.inv.stinkekaese
      ? ['Riechst du das? Das ist der Käse in deiner Tasche, Chef.', 'Bring ihn zu Kevin in den Muskelkater, bevor ich ohnmächtig werde.']
      : ['Stinkekäse? Maya hat so was. Feinkost, gleich rechts neben dem Eimer.', 'Kostet aber. 300 Euro. Für 300 Euro würd ich selber stinken.'];
    case 'vorbereitung': return f.hochzeitBuffet
      ? ['Das Buffet steht, hab ich gehört. Fehlt nur noch das Bier.', 'Zehn Stück von der Theke, Chef. Und dann gib sie mir, ich trag sie rüber.']
      : ['Buffet, Chef. Der Inder im Westen, Adshayan. Der kocht wie ein Gott.', 'Nur probieren sollte er weniger.'];
    case 'probe': return ['Ab in den Muskelkater, Chef! Hochzeitsprobe! Kevin wartet.', 'Ich komm nach. Vielleicht. Wenn ich wieder stehen kann.'];
    case 'entfuehrt': return ['Ich hab’s gehört, Chef. Ein Tentakel. Im Stripclub. Und ich dachte, ich hätte schon alles gesehen.', 'Folge dem Schleim zum Gully in der Hintergasse. Und für unten: Tuncay. Parkplatz. Der hat Wathosen. Frag nicht, woher.'];
    case 'ausruestung': return state.flags.gullyOffen
      ? ['Der Gully ist offen, Chef. Ich hab’s bis hier gerochen.', 'Runter mit dir. Und wenn eine Ente dich anguckt: nicht zurückgucken.']
      : ['Wathose an, Chef? Gut. Jetzt den Haken unter den Gullydeckel in der Hintergasse.', 'Hebeln, nicht ziehen. Hat mir mal einer erklärt. Der war danach auch weg.'];
    case 'unten': return !state.flags.kanalGitterOffen
      ? ['Da unten, Chef: immer dem Schleim nach. Der Schleim weiß, wo er hinwill.', 'Und wenn da ein Gitter ist: Haken drunter. Hebeln, nicht ziehen.']
      : !state.flags.schleuseGeloest
        ? ['Wenn ich Happy Hour rufe, Chef, rauscht’s bei dir unten. Rein in eine Nische!', 'Und die Schieber: Lies, was an den Wänden steht. Die Kanalarbeiter wussten Bescheid. Heinz vor allem.']
        : ['Du hast die Schieber geknackt, Chef? Ich hab mal einen Kronkorken mit den Zähnen geknackt. Ist fast dasselbe.', 'Hinten soll eine Tür sein. Klärwerk. Da geht keiner rein. Nicht mal ich.'];
    case 'curry': return state.flags.curryTopf
      ? ['Riecht hier nach ... Chef, ist das der Topf auf deinem Kopf? Ab damit durchs Herrenklo, Kabine 1.', 'Nicht durch den Gully. Der Topf passt nicht durch. Ich hab’s mit einem Fass probiert. Lange Geschichte.']
      : ['Curry, sagt die Katze? Dann ab zu Adshayan in den Basar, Chef. Der kocht, bis die Wände schwitzen.', 'Und sag ihm: viel. Nicht indisch-viel. Katzen-viel.'];
    case 'klaerwerk': return ['Das Klärwerk ist offen? Chef. Nimm die Katze mit. Und Taschentücher.', 'Ich bleib hier. Einer muss die Theke festhalten.'];
    case 'katze': return ['Die Katze ist wieder da, Chef? Die hat mal meinen Hut gefressen. Mit Kopf drin. Fast.', 'Bleib bei ihr. Die Ratten haben mehr Angst vor ihr als vor dir. Und vor mir.'];
  }
  if (f.kanal && f.kanal !== 'gerettet') return ['Da unten in den Rohren, Chef? Ich bleib hier oben. Mit Bier. Einer muss ja die Stellung halten.'];
  // Xavi
  if (f.strangBereit === 'xavi' && !f.xavi) return ['Auf dem Damenklo heult eine, Chef. Seit Stunden. Die Leni.', 'Geh mal gucken. Ich darf da nicht mehr rein.'];
  switch (f.xavi) {
    case 'vermisst': return ['Xavi? Der Kleine mit dem Bart? Hing oft in der Shisha-Bar an der Straße.', 'Frag Cemo. Aber der redet nur, wenn du ihn beim Rauchen schlägst.'];
    case 'spur': return ['Tuncay. Steht auf dem Parkplatz im Norden und verkauft aus dem Kofferraum.', 'Der weiß alles. Aber nix umsonst. Und er liebt Quizfragen über die Türkei.'];
    case 'club': return ['Der Muskelkater, Chef. Die Chefin heißt Leni Blume.', 'Ihr Leibwächter Emilian ist ... groß. Sehr groß. Und geölt.'];
  }
  // Nick und Borna
  if (f.strangBereit === 'nick' && !f.nick) return ['Borna ruft dich vom Dachboden. Klingt nach Geschäftsidee.', 'Das ist nie gut, Chef. Aber geh ruhig hoch.'];
  switch (f.nick) {
    case 'pflanze': return state.inv.pflanze
      ? ['Du hast Grünzeug in der Tasche, Chef. Hoch damit zu Borna, auf den Dachboden.']
      : ['Bornas Pflanze steckt im Busch hinter der Kneipe. Hintergasse.', 'Grab vorsichtig. Da liegt auch mein Schlüssel von 1998.'];
    case 'gepflanzt': return ['Lass die Pflanze wachsen, Chef. Komm später wieder auf den Dachboden.', 'Gras wächst nicht schneller, wenn man es anstarrt. Hab ich probiert.'];
    case 'plantage': return ['Auf dem Dachboden riecht’s wie in Amsterdam. Red mit Borna.'];
    case 'keller': return ['Hinter Bornas Kisten geht’s runter in den Keller. Zu Nick.', 'Nimm Ohrstöpsel mit. Der spielt Gitarre wie ein Presslufthammer.'];
    case 'koks': return [`Nick will fünf Ladungen vom Dealer hinten in der Gasse. Du hast ${state.inv.koks}.`, 'Und Chef: Lass dich nicht von Felix dabei sehen.'];
    case 'boss': return ['Nick ist ein ... Dämon? Chef, ich trink ab heute weniger.', '... Ab morgen.'];
  }
  // Claudius
  if (f.claudius === 'getroffen') {
    const n = gelesen(f.pcGelesen).length;
    return n >= PC_FILES.length
      ? ['Du hast alles gelesen? Dann schick’s raus, Chef. An Leute, die lesen können. Nicht an die BLÖD.']
      : ['Der Captain hat Dreck am Stecken. Sein Rechner steht oben auf dem Dachboden.', `Du hast ${n} von ${PC_FILES.length} Dateien gelesen. Lies alles, dann weißt du, was er vorhat.`];
  }
  const ziel = strangZiel(f);
  return ziel ? [`Wenn du mich fragst, Chef: ${ziel}`] : null;
}

/** Was es in der Stadt noch zu entdecken gibt (erste passende Sache) */
function entdecken(f: StoryFlags): string[] {
  if (!f.bornaGetroffen) return ['Auf dem Dachboden haust einer. Borna. Bekifft, aber harmlos.', 'Die Leiter hinten in der Kneipe. Geh mal hoch.'];
  if (f.borna === 'hoffnung' && !f.lily) return ['In der Hintergasse sitzt ein Mädchen an der Wand. Lilly.', 'Die sucht ein Dach über dem Kopf. Und auf dem Dachboden ist ja noch Platz.'];
  if (f.glanzErledigt && !f.basarSauber) return ['Im Westen hat ein Inder aufgemacht. Masala Basar.', 'Der Arme braucht Hilfe, sagt man. Und einen Wischmopp. Einen großen.'];
  if (!f.mayaTraum) return ['Maya im Feinkostladen ist ziemlich hochnäsig.', 'Aber sie steht auf Dialekt, hab ich gehört. Bayerisch. Oder Schwäbisch. Hauptsache Berg.'];
  if (f.leniGekotzt === undefined) return ['Auf dem Damenklo ist immer was los, Chef. Meistens Leni. Meistens betrunken.'];
  if (!f.leniWasser && f.leniGekotzt !== undefined) return ['Leni braucht manchmal einfach nur ein Glas Wasser. Glaub mir. Ich kenn das.'];
  return pick([
    ['Gerade ist’s ruhig, Chef. Zu ruhig.', 'Wenn’s so ruhig ist, passiert gleich was. Trink was, solange es geht.'],
    ['Die Automaten, Chef. Alles Sahne. Kassier rechtzeitig.', 'Der Teufel kommt immer dann, wenn’s gerade schön ist. Wie meine Ex.'],
    ['Schau mal in die Mülltonnen. Da liegt manchmal noch was. Nicht immer Essen.'],
  ]);
}

const THEMEN: Thema[] = [
  // ---- Glanz-Mission (Kapitel 1 bis 4)
  {
    id: 'leiche', frage: 'Was mach ich mit ... ihm?',
    antwort: () => ['Hintertür, Chef. Raus in die Gasse, zur Katze. Die wartet schon.', 'Und lass dich nicht von Felix sehen. Die Leiche trägt sich schwer. Und die Uhr läuft.'],
    wichtig: (f) => (!f.glanzErledigt && state.dead && !state.carrying ? 100 : 0),
  },
  {
    id: 'glanz', frage: 'Was weißt du über den Lackaffen?',
    antwort: () => ['Von Glanz. Anwalt. Will den Eimer abreißen für seine Lofts.', 'Gib ihm, was er will, Chef. Erst Bier, dann Härteres. Und lass ihn nicht warten, sonst wird er misstrauisch.'],
    wichtig: (f) => (!f.glanzErledigt && !state.dead ? 90 : 0),
  },
  {
    id: 'haerter', frage: 'Wo krieg ich was Härteres?',
    antwort: () => ['Der Dealer hinten in der Gasse. Pillen und Zeug.', 'Aber nie kaufen, wenn Felix guckt. Der Bulle hat ’ne Taschenlampe und kein Hobby.'],
    wichtig: (f) => (!f.glanzErledigt && state.sucht >= 35 ? 75 : 0),
  },
  {
    id: 'katzeAlt', frage: 'Erzähl mir von der Katze.',
    antwort: () => ['Die Königskatze. Hinten in der Gasse. Ein Auge glüht, das andere ist blind.', 'Die frisst alles, Chef. ALLES. Wenn hier mal einer nicht mehr aufsteht ... die Katze räumt auf.'],
    wichtig: (f) => (!f.glanzErledigt ? 60 : 0),
  },
  {
    id: 'geldAlt', frage: 'Wie komm ich an Geld?',
    antwort: () => [pick(['Mülltonnen, Chef. Da liegt oft noch Fusel drin.', 'Die Automaten da hinten. Aber setz nie auf Schnecke.']), 'Und wenn die Stammgäste pöbeln: rausprügeln. Die lassen dann was da.'],
    wichtig: (f) => (!f.glanzErledigt ? (state.money < 15 ? 80 : 40) : 0),
  },
  {
    id: 'tippAlt', frage: 'Hast du einen Tipp für mich?',
    antwort: () => [pick([
      'Nicht zu hastig, Chef. Sonst merkt er was.',
      'Lass den Lackaffen nicht warten. Ungeduldige Gäste werden misstrauisch.',
      'Was er nicht kennt, nimmt er erst, wenn er weich genug ist.',
      'Die Damen in der Gasse haben Bares. Aber lass keine Leichen rumliegen, Chef.',
      'Buch der Ratte ... drei Bücher, Chef. Dann geht die Post ab.',
    ])],
    wichtig: (f) => (!f.glanzErledigt ? 30 : 0),
  },

  // ---- Offene Welt
  {
    id: 'bier', frage: () => (state.inv.bier >= 10 ? 'Kalle, trägst du 10 Bier in den Muskelkater?' : 'Kalle, hilfst du bei Kevins Hochzeit?'),
    antwort: () => (state.flags.hochzeitBier
      ? ['Für ’ne Hochzeit trag ich alles, Chef. Hauptsache Freibier.', 'N:Kalle wankt mit der Kiste Richtung Tür. Drei Flaschen fehlen schon, bevor er draußen ist.']
      : ['Ohne Bier keine Hochzeit, Chef. Zehn Stück.', 'Die Theke ist da drüben. Also hinter dir. Du stehst dahinter.']),
    onEnter: () => {
      const f = state.flags;
      if (f.hochzeitBier || state.inv.bier < 10) return;
      state.inv.bier -= 10;
      f.hochzeitBier = true;
      hochzeitPruefen();
    },
    wichtig: (f) => (f.kanal === 'vorbereitung' && !f.hochzeitBier ? 110 : 0),
  },
  {
    id: 'aufgabe', frage: 'Was steht an, Kalle?',
    antwort: () => aufgabe(state.flags) ?? [],
    wichtig: (f) => (f.glanzErledigt && aufgabe(f) ? 100 : 0),
  },
  {
    id: 'neues', frage: 'Gibt’s was Neues in der Stadt?',
    antwort: () => entdecken(state.flags),
    wichtig: (f) => (f.glanzErledigt ? (aufgabe(f) ? 55 : 85) : 0),
  },
  {
    id: 'katzeNeu', frage: 'Wo steckt eigentlich die Katze?',
    antwort: () => (state.flags.kanal && state.flags.kanal !== 'kaese'
      ? ['Die Katze? Weg, seit dem Morgen danach.', 'Aber seitdem gluckert’s nachts in den Rohren, Chef. Und jetzt kommen Tentakel aus Abflüssen. Ich sag ja nix. Ich denk’s nur.']
      : ['Weg, Chef. Seit dem Morgen danach. Keiner hat sie mehr gesehen.', 'Aber nachts ... die Rohre gluckern. Und manchmal schmatzt es im Klo. Ich mein ja nur.']),
    wichtig: (f) => (f.glanzErledigt ? 35 : 0),
  },
  {
    id: 'geldNeu', frage: 'Wie komm ich an Geld?',
    antwort: () => [pick([
      'Die Automaten, Chef. Buch der Ratte zahlt selten, aber dann richtig.',
      'Mülltonnen. Ich sag’s immer wieder. Da liegt Geld drin. Und Fusel. Und Gründe, nicht reinzugucken.',
      'Die Damen in der Gasse haben Bares. Aber ich hab nix gesagt.',
    ])],
    wichtig: (f) => (f.glanzErledigt ? (state.money < 30 ? 50 : 20) : 0),
  },
  {
    id: 'kalle', frage: 'Wie geht’s dir, Kalle?',
    antwort: () => [pick([
      'Mir geht’s wie dem Eimer, Chef. Alt, verbeult, aber noch da.',
      'Ich hab heute schon zweimal gelebt. Einmal morgens, einmal nach dem dritten Korn.',
      'Gut, Chef. Seit der Abriss abgesagt ist, schlaf ich wieder. Meistens hier. Auf dem Hocker.',
      'Mein Rücken sagt Nein, meine Leber sagt Vielleicht, mein Herz sagt: noch ein Korn.',
    ])],
    wichtig: (f) => (f.glanzErledigt ? 25 : 10),
  },
];

const GRUSS = [
  'Zzz ... hm? ... Ah, Chef. Noch ein Korn?',
  'Chef! Ich war wach. Die ganze Zeit. Mit geschlossenen Augen.',
  'Na, Chef? Was liegt an?',
];

/** Kalles Gespräch: die drei wichtigsten Themen, gleich wichtige in zufälliger Reihenfolge */
export function kalleTree(): Record<string, DialogNode> {
  const f = state.flags;
  const angebot = THEMEN
    .map((t) => ({ t, w: t.wichtig(f) + Math.random() * 4 }))
    .filter((x) => x.w >= 4 && x.t.antwort().length)
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
    .map((x) => x.t);
  const tree: Record<string, DialogNode> = {
    start: {
      lines: [f.glanzErledigt ? pick(GRUSS) : GRUSS[0]],
      choices: [...angebot.map((t) => ({ text: typeof t.frage === 'string' ? t.frage : t.frage(), next: t.id })), { text: 'Schlaf weiter, Kalle.' }],
    },
  };
  for (const t of angebot) tree[t.id] = { lines: t.antwort(), choices: WEITER, onEnter: t.onEnter };
  // die Bier-Antwort hängt davon ab, ob beim Betreten getragen wurde: Zeilen erst danach festlegen
  if (tree.bier) tree.bier.lines = [() => (state.flags.hochzeitBier ? 'Für ’ne Hochzeit trag ich alles, Chef. Hauptsache Freibier.' : 'Ohne Bier keine Hochzeit, Chef. Zehn Stück.'), () => (state.flags.hochzeitBier ? 'N:Kalle wankt mit der Kiste Richtung Tür. Drei Flaschen fehlen schon, bevor er draußen ist.' : 'Die Theke ist da drüben. Also hinter dir. Du stehst dahinter.')];
  return tree;
}
