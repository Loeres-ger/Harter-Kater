import { state } from '../state';
import { toast } from '../scenes/HudScene';
import type { StoryFlags } from '../progress/flags';
import type { Choice, DialogNode } from './data';

// „Unter dem Eimer“, Kapitel 6: Kevin ist in den Stripper Jan verknallt, Käse-Antrag, Hochzeitsvorbereitung
// (Bier über Kalle, Buffet bei Adshayan), Hochzeitsprobe, Jan wird entführt. Siehe story/drehbuch-teil1.md.

type KanalStufe = NonNullable<StoryFlags['kanal']>;
const REIHE: KanalStufe[] = ['kaese', 'vorbereitung', 'probe', 'entfuehrt', 'ausruestung', 'unten', 'katze', 'curry', 'klaerwerk', 'gerettet'];

/** Ist der Strang mindestens bei dieser Stufe? */
export function kanalAb(f: StoryFlags, stufe: KanalStufe) {
  return !!f.kanal && REIHE.indexOf(f.kanal) >= REIHE.indexOf(stufe);
}

/** Jan ist weg: von der Entführung bis zur Rettung */
export function janWeg(f: StoryFlags) {
  return kanalAb(f, 'entfuehrt') && f.kanal !== 'gerettet';
}

/** Figur des Wirts: mit Tuncays Kanal-Paket in Wathose, Stirnlampe und Haken, bis Jan gerettet ist */
export function wirtFigur(): 'wirt' | 'wirtKanal' {
  return (state.inv.kanalpaket ?? 0) > 0 && !state.flags.wathoseAus ? 'wirtKanal' : 'wirt';
}

/** Durchs Rohr nach oben: die Herrentoilette meldet die Ankunft */
export const rohrAnkunft = { jetzt: false };

/** Ohnmächtig im Kanal (Entengift): die Gasse lässt den Wirt neben dem Gully aufwachen */
export const kanalOhnmacht = { aufwachen: false };

/** Bianca, Chantals und Jackys verschwundene Kollegin, frisch aus dem Schleimkokon */
export function biancaTree(): Record<string, DialogNode> {
  return {
    start: {
      lines: [
        'N:Aus dem Kokon rutscht eine Frau. Grün bis zu den Haarwurzeln. Netzstrümpfe. Ein Stiefel.',
        'Donnerstag ... es kam immer donnerstags ... mit Geweih ...',
        'W:Bist du Bianca? Chantal und Jacky suchen dich.',
        'Ich will nach Hause. Und duschen. In der Reihenfolge.',
      ],
      choices: [{ text: 'Der Ausgang ist hinter dir. Immer den Enten nach.' }],
    },
  };
}

/** Die Katze im Kanal: taucht hinter dem Rostgitter auf, frisst das halbe Rattenrudel und erzählt, was da unten wächst */
export function katzeKanalTree(): Record<string, DialogNode> {
  const f = state.flags;
  if (f.kanal === 'unten') {
    return {
      start: { lines: ['Miau. Wirt.', 'Du bist spät. Und du riechst nach Ente.'], choices: [{ text: 'Du ... hilfst mir?', next: 'hilfe' }] },
      hilfe: {
        lines: ['Ich fresse, was nicht hierher gehört. Seit Jahren. Ratten mit Armen. Enten mit Saugnäpfen.', 'Und Männer mit Unterschriften, die so was wachsen lassen.'],
        choices: [{ text: 'Glanz.', next: 'glanz' }],
      },
      glanz: {
        lines: [
          'Glanz wollte über dem Klärwerk bauen. Beton drauf, Deckel zu, keiner kommt mehr runter. Und dann hätte es in Ruhe wachsen können.',
          'Dachtest du, ich wollte ihn nur, weil er so schön weich gekocht war? ... Na gut. Auch deswegen.',
        ],
        choices: [{ text: 'Glanz allein? Der konnte nicht mal allein ein Bier bestellen.', next: 'drueber' }, { text: 'Was ist „es“?', next: 'es' }],
      },
      drueber: {
        lines: [
          'Eben. Glanz war ein Laufbursche. Ein teurer Anzug, der Unterschriften abholt und Deckel zuschraubt.',
          'Wer baut Beton über ein Klärwerk, in dem so was wächst? Einer, der weiß, dass es da wächst. Und einer, der will, dass es weiterwächst.',
          'Über Glanz sitzt jemand. Ich riech es an den Akten, die hier runtergespült werden. Teures Parfüm. Und Wald. Wer riecht unter der Stadt nach Wald?',
          'W:Brenninger?',
          'Der Brüllaffe mit dem Megafon? Der ist laut. Wer laut ist, ist selten ganz oben. Oben ist es leise.',
        ],
        choices: [{ text: 'Was ist „es“?', next: 'es' }],
      },
      es: {
        lines: ['Es hat Arme wie ein Tintenfisch und eine Krone wie ein Hirsch. Und Hunger wie ich. Nur ohne Gewissen.', 'Es hat deinen Stripper. Und es hat gelernt, wie Curry schmeckt.'],
        choices: [{ text: 'Dann komm.' }],
      },
    };
  }
  if (f.kanal === 'katze') {
    return {
      start: {
        lines: [pick([
          'Lauf. Ich bleib hinter dir. Die Ratten mögen mich nicht. Das beruht auf Gegenseitigkeit. Und auf Hunger.',
          'Die Schieber? Hab ich nie verstanden. Ich schwimme nicht. Ich fresse, was schwimmt.',
          'Riechst du das? Da hinten, hinter der Tür. Das ist es. Es schläft nicht. Es verdaut.',
          'Die Enten lass ich in Ruhe. Die schmecken nach Gummi.',
        ])],
        choices: [{ text: 'Weiter.' }],
      },
    };
  }
  return {
    start: {
      lines: [pick([
        'Ich warte hier. Es weiß, dass ich hier bin. Und ich weiß, dass es weiß.',
        'Curry, Wirt. Viel Curry. So viel, dass es sogar mich überrascht.',
      ])],
      choices: [{ text: 'Bis gleich.' }],
    },
  };
}

/** Vor der Klärwerk-Tür: das Tentakelgitter. Die Katze weiß, wie man es aufkriegt. */
export function katzeTuerTree(): Record<string, DialogNode> {
  return {
    start: {
      lines: [
        'N:Vor der Tür hängt ein Gitter aus dicken, zuckenden Tentakeln. Sie riechen dich. Die Katze faucht.',
        'Er kommt nur raus, wenn er etwas riecht, das er mehr will als mich.',
        'Curry, Wirt. Viel Curry.',
      ],
      choices: [{ text: 'Adshayan.', next: 'rohr' }],
    },
    rohr: {
      lines: ['Das Rohr da drüben führt nach oben. In deine Kneipe. Ich warte hier und passe auf, dass es nicht ohne mich frühstückt.'],
      choices: [{ text: 'Bin gleich zurück.' }],
    },
  };
}

/** Kevin weckt den Wirt am Gully, nachdem ihn die Enten ohne Schutzkleidung erwischt haben */
export function kevinWachTree(): Record<string, DialogNode> {
  return {
    start: {
      lines: [
        'N:Du liegst neben dem Gully. Über dir: Kevin. Und der Stinkekäse, sehr nah an deiner Nase.',
        'Bruder! BRUDER! Da bist du ja. Die Enten haben dich hochgespuckt. Einfach so. Durch den Deckel.',
        'W:... Wie lange war ich weg?',
        'Lang genug, dass ich dir den Käse unter die Nase halten musste. Er hat gewirkt. Er wirkt immer.',
        'Bruder, du warst ohne Schutzkleidung da unten?! Ohne Wathose bist du für die Viecher ein Snack.',
        'Die Wathose riecht wie die da unten. Mit der lassen sie dich in Ruhe. Zieh sie an, Mann. Für Jan.',
      ],
      choices: [{ text: 'Ist ja gut, Mama.' }],
    },
  };
}

/** Bier und Buffet erledigt? Dann kann geprobt werden. */
export function hochzeitPruefen() {
  const f = state.flags;
  if (f.kanal === 'vorbereitung' && f.hochzeitBier && f.hochzeitBuffet) {
    f.kanal = 'probe';
    toast('Bier steht, Buffet steht. Ab in den Muskelkater: Hochzeitsprobe!');
  }
}

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Kevin im Muskelkater, solange der Strang vorgemerkt ist oder läuft; sonst null (normaler Club-Dialog) */
export function kevinKanalTree(): Record<string, DialogNode> | null {
  const f = state.flags;
  if (f.strangBereit === 'kanal' && !f.kanal) {
    const weiter: Choice = { text: 'Und jetzt?', next: 'wie' };
    return {
      start: {
        lines: [
          'N:Kevin wirft Scheine Richtung Bühne. Dann sieht er dich und lässt vor Schreck alle auf einmal fallen.',
          'Bruder! Du ... was machst du hier? Ich auch nicht. Ich bin wegen der ... Akustik hier.',
          'Die Akustik ist sehr gut. Besonders bei Jan. Also auf der Bühne. Wo Jan ist. Zufällig.',
        ],
        choices: [{ text: 'Du bist verknallt, Kevin.', next: 'verknallt' }, { text: 'Akustik, klar.', next: 'akustik' }],
      },
      verknallt: {
        lines: ['VERKNALLT? Ich? Bruder. Ich bin Deserteur. Wir verknallen uns nicht. Wir ... desertieren. In jemanden rein.', '... Okay. Ja. Sehr.'],
        choices: [weiter],
      },
      akustik: {
        lines: ['Danke, Bruder. Endlich versteht mich einer.', '... Ich bin so verknallt, ich kann nicht mehr schlafen.'],
        choices: [weiter],
      },
      wie: {
        lines: [
          'Aber wie macht man so einen klar? In Tavirien war Flirten verboten. Augenkontakt nur mit Formular.',
          'Jan redet immer nur von Proteinen. Und von Käse. Er sagt, Käse ist „Protein mit Seele“.',
        ],
        choices: [{ text: 'Dann schenk ihm Käse.', next: 'kaese' }],
      },
      kaese: {
        lines: ['... Bruder. Du bist ein Genie.', 'Aber guter Käse. Der beste. Einer, der so stinkt, dass man weint. Maya hat so einen. Bestimmt.'],
        choices: [{ text: 'Ich besorg ihn dir.', action: 'kanalStart' }],
        exitAction: 'kanalStart',
      },
    };
  }
  if (f.kanal === 'kaese') {
    if (state.inv.stinkekaese > 0) {
      return {
        start: {
          lines: ['Bruder ... ist er das? Ich riech ihn schon. Meine Augen tränen. Perfekt.', 'Wenn er Nein sagt, wandere ich aus. Wieder.'],
          choices: [{ text: 'Hier. Geh und hol ihn dir.', action: 'kaeseGeben' }, { text: 'Gleich. Atme erst mal.' }],
        },
      };
    }
    return {
      start: {
        lines: [pick([
          'Bruder, hast du den Käse? Der stinkendste. Maya hat ihn, in ihrer Feinkost.',
          'Ich übe schon meinen Satz: „Jan, das ist Protein mit Seele.“ ... Zu viel?',
        ])],
        choices: [{ text: 'Bin dran.' }],
      },
    };
  }
  if (f.kanal === 'vorbereitung') hochzeitPruefen();
  if (f.kanal === 'vorbereitung') {
    const offen = [!f.hochzeitBier && '10 Bier für die Gäste (Kalle trägt sie rüber)', !f.hochzeitBuffet && 'das Buffet (Adshayan im Basar)'].filter(Boolean);
    return {
      start: {
        lines: [
          'Bruder! Trauzeuge! Wie läuft’s?',
          offen.length ? `Fehlt noch: ${offen.join(' und ')}.` : 'Alles da? Dann proben wir!',
        ],
        choices: [{ text: 'Läuft.' }],
      },
    };
  }
  if (f.kanal === 'probe') {
    return {
      start: {
        lines: ['Bruder. Bier steht. Buffet duftet. Jan glänzt. Ich glänze auch, aber vor Angst.', 'Wollen wir?'],
        choices: [{ text: 'Los, Hochzeitsprobe!', action: 'probe' }, { text: 'Gleich.' }],
      },
    };
  }
  return null;
}

/** Kevin am Gully in der Gasse, nachdem Jan entführt wurde */
export function kevinGullyTree(): Record<string, DialogNode> {
  const f = state.flags;
  if (kanalAb(f, 'ausruestung')) {
    return {
      start: {
        lines: kanalAb(f, 'unten')
          ? [
            'N:Kevin hat den Stinkekäse auf den Gullyrand gelegt. Als Köder. Oder als Gruß.',
            'Und? Hast du ihn gesehen? Riecht er noch nach Babyöl?',
            'W:Ich hab Enten gesehen. Und Schleim. Viel Schleim.',
            'Das ist seine Spur, Bruder. Folg ihr. Ich halte hier oben die Stellung. Einer muss den Käse bewachen.',
          ]
          : [
            'Du hast das Paket! Bruder, du riechst wie ein Fischkutter. Perfekt.',
            f.gullyOffen ? 'Der Deckel ist auf. Ich hör ihn da unten. Also, ich hör Enten. Aber zwischen den Enten hör ich ihn.' : 'Mach den Deckel auf. Mit dem Haken. Ich würd ja selber, aber meine Hände zittern. Vor Liebe.',
          ],
        choices: [{ text: 'Ich hol ihn da raus, Kevin.' }],
      },
    };
  }
  return {
    start: {
      lines: [
        'N:Kevin kniet am Gullydeckel. Er hat den Stinkekäse dabei. Er hält ihn fest wie ein Kuscheltier.',
        'Bruder. Er ist da unten. Mein Jan. Bei den ... Enten.',
        'Der Deckel geht nicht auf. Aber Tuncay hat alles im Kofferraum. Sogar Dinge, die es nicht gibt.',
      ],
      choices: [{ text: 'Ich hol ihn da raus, Kevin.' }],
    },
  };
}
