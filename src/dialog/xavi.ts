import { state } from '../state';
import type { DialogNode } from './data';

// Xavi-Strang (Storybaum: „Rettung von Xavi“). Xavi ist Lenis Freund: schüchtern, braune Haare, brauner Bart,
// verträgt keinen Alkohol und keinen Grasgeruch. Sobald die Stadt offen ist, rennt Leni dem Wirt auf der
// Damentoilette heulend entgegen; sagt er zu, beginnt die Suche. Teil 1 spielt im „Shisha 1001“ bei Cemo.

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// ---------------------------------------------------------------- Leni

/** Leni stürzt heulend aus der Kabine: Xavi ist weg. Mit „Ich such ihn“ beginnt die Suche (Aktion xaviSuche). */
export function leniXaviTree(): Record<string, DialogNode> {
  const zusage = { text: 'Ich such ihn.', next: 'zusage' };
  return {
    start: {
      lines: [
        () => (state.flags.leniGekotzt !== undefined
          ? 'HORST! *schnief* Du warst der Einzige, der hier drin nett zu mir war. Na ja. Fast nett.'
          : 'Du bist doch der Wirt, oder? *schnief* Bitte. Du musst mir helfen.'),
        'Xavi ist weg. Seit drei Tagen. Kein Anruf, keine Nachricht, nix.',
        'Ich dachte erst, der hat mich sitzen lassen. Deshalb steht da „Lügner“ auf dem Spiegel.',
        'Aber Xavi lässt niemanden sitzen. Xavi traut sich ja nicht mal, beim Bäcker zu drängeln.',
      ],
      choices: [
        { text: 'Wie sieht Xavi aus?', next: 'aussehen' },
        { text: 'Wo war er zuletzt?', next: 'zuletzt' },
        { text: 'Vielleicht braucht er einfach mal Ruhe vor dir.', next: 'frech' },
        zusage,
      ],
    },
    aussehen: {
      lines: [
        'Braune Haare, brauner Bart. Alles braun. Wie ein Teddybär, der Steuern zahlt.',
        'Er ist total schüchtern. Wenn ihn jemand anguckt, guckt er auf seine Schuhe.',
        'W:Davon gibt’s in dieser Stadt hundert.',
        'Er verträgt keinen Alkohol. Ein Radler, und er erzählt dir sein ganzes Leben. Zwei, und er schläft im Stehen.',
        'Und wenn irgendwo Gras geraucht wird, wird er grün im Gesicht und muss raus. Sofort.',
      ],
      choices: [
        { text: 'Wo war er zuletzt?', next: 'zuletzt' },
        { text: 'Wie habt ihr euch kennengelernt?', next: 'kennen' },
        zusage,
      ],
    },
    zuletzt: {
      lines: [
        'Er wollte „kurz Kippen holen“. Das sagt er immer, wenn er eigentlich in die Shisha-Bar geht.',
        'Ins „Shisha 1001“, vorne an der Straße. Da riecht’s nach Apfel und nicht nach Gras. Deshalb mag er’s da.',
        'Der Chef heißt Cemo. Xavi sagt, Cemo ist der einzige Mensch, der ihn ausreden lässt.',
      ],
      choices: [
        { text: 'Wie sieht Xavi aus?', next: 'aussehen' },
        { text: 'Hatte er Ärger mit jemandem?', next: 'aerger' },
        zusage,
      ],
    },
    aerger: {
      lines: [
        'Xavi? Ärger? Der entschuldigt sich bei Türen, gegen die er läuft.',
        'Obwohl ... in letzter Zeit war er komisch. Hat gesagt, irgendwer im Club gegenüber guckt ihn immer so an.',
        'W:Im Muskelkater?',
        'Keine Ahnung. Er wird rot, wenn er nur das Wort „Club“ sagt.',
      ],
      choices: [{ text: 'Wo war er zuletzt?', next: 'zuletzt' }, zusage],
    },
    kennen: {
      lines: [
        'Acht Monate hat der gebraucht, bis er mich angesprochen hat. ACHT.',
        'Dann hat er gefragt, wie spät es ist. Ich hatte eine Uhr am Handgelenk. Er auch.',
        'Am Ende hab ich ihn gefragt. Er hat Ja gesagt und ist dann gegen eine Laterne gelaufen.',
      ],
      choices: [{ text: 'Wo war er zuletzt?', next: 'zuletzt' }, zusage],
    },
    frech: {
      lines: [
        'Sehr witzig. *schnief*',
        'So einer haut nicht einfach ab. Der braucht ja schon zwei Anläufe, um eine Tür zuzumachen.',
        'Bitte, Horst.',
      ],
      choices: [{ text: 'Schon gut. Ich such ihn.', next: 'zusage' }, { text: 'Wie sieht er aus?', next: 'aussehen' }],
    },
    zusage: {
      lines: [
        'Wirklich? Danke! *schnief* Das mit dem „Lügner“ wisch ich auch weg. Also ... später.',
        'Fang im Shisha 1001 an. Frag nach Cemo.',
        'Und Horst? Nimm ihm kein Bier mit. Er kippt um.',
      ],
      choices: [{ text: 'Bin unterwegs.', action: 'xaviSuche' }],
    },
  };
}

/** Leni wartet auf der Damentoilette, bis Xavi gefunden ist */
export function leniWartetTree(): Record<string, DialogNode> {
  const spur = state.flags.xavi === 'spur';
  if (state.flags.xavi === 'club') {
    return {
      start: {
        lines: [pick([
          'Im MUSKELKATER? Mein Xavi? Der wird doch schon rot, wenn im Fernsehen jemand duscht!',
          'Leni Blume? Die mit den Haaren wie ein Wattebausch? Die hasst mich seit der Grundschule. Wegen dem Namen.',
        ])],
        choices: [{ text: 'Ich hol ihn da raus.' }],
      },
    };
  }
  return {
    start: {
      lines: [spur
        ? pick([
          'Tuncay? Kenn ich nicht. Aber der Name klingt nach Bauchtasche.',
          'Cemo hat dir was erzählt? Ich wusste es! Xavi ist nicht abgehauen!',
        ])
        : pick([
          'Hast du was von Xavi gehört? Nein? *schnief* Ich warte hier. Hier gibt’s wenigstens Klopapier.',
          'Wenn du Xavi findest, sag ihm, das mit dem Lügner war nicht so gemeint. Nur halb.',
          'Shisha 1001, Horst. Frag Cemo. Xavi geht da hin, weil’s da nicht nach Gras riecht.',
        ])],
      choices: [{ text: 'Ich bleib dran.' }],
    },
  };
}

// ---------------------------------------------------------------- Cemo

export function cemoTree(): Record<string, DialogNode> {
  const x = state.flags.xavi;
  const back = { text: 'Noch was.', next: 'start' };
  const bye = { text: 'Bis dann.' };
  const smalltalk = [
    { text: 'Was ist das Beste hier?', next: 'beste' },
    { text: 'Warum gibt’s hier kein Bier?', next: 'bier' },
    { text: 'Wer sitzt hier so rum?', next: 'gaeste' },
  ];
  const nodes: Record<string, DialogNode> = {
    beste: {
      lines: [
        'Doppelapfel mit Eis im Kopf. Haut dich um wie ein Pferd.',
        'W:Mich haut eigentlich nur die Miete um.',
        'Dann nimm Minze. Minze ist wie Urlaub, nur ohne Strand und ohne Urlaub.',
      ],
      choices: [back, bye],
    },
    bier: {
      lines: [
        'Weil Bier dumm macht und Tee weise. Sagt meine Oma. Die hat beides getrunken.',
        'Neulich war so ein General hier. Vierzehn Orden. Wollte wissen, ob man Shisha verbieten kann.',
        'Ich hab ihm einen Minztee hingestellt. Er hat ihn getrunken und leise „Danke“ gesagt. Ich glaub, er war einsam.',
      ],
      choices: [back, bye],
    },
    gaeste: {
      lines: [
        'Der im Trainingsanzug kommt seit 2009. Hat noch nie bestellt. Ich glaub, der wohnt hier.',
        'Der Opa hinten bläst Rauchringe in Herzform. Für seine Frau. Die war Nichtraucherin.',
        'Und die zwei Mädels streiten seit einer Stunde, ob der Feuerwehrmann im Muskelkater echt bei der Feuerwehr ist.',
        'W:Und?',
        'Nein. Der hat nicht mal einen Grill.',
      ],
      choices: [{ text: 'Und mein Stammgast Kalle?', next: 'kalle' }, back, bye],
    },
    kalle: {
      lines: [
        'Kalle! Kam einmal rein, hat sich an die Wasserpfeife gekuschelt wie an eine Mutter.',
        'Drei Stunden. Dann hat er bezahlt. In Kronkorken.',
        'Seitdem steht „Kalle-Spezial“ auf der Tafel. Kostet zwei Kronkorken. Bestellt hat’s keiner.',
      ],
      choices: [back, bye],
    },
  };

  if (x === 'spur' || x === 'club' || x === 'gerettet') {
    return {
      ...nodes,
      start: {
        lines: [pick([
          x === 'spur' ? 'Tuncay steht auf dem Parkplatz oben im Norden. Offener Kofferraum, offenes Maul.' : 'Xavi ist frei? Dann ist der Ayran ab heute für ihn gratis. Einer.',
          'Tuncay, Bruder. Mehr weiß ich nicht. Ich hab verloren, nicht mein Gedächtnis.',
          'Noch ein Duell? Nein danke. Mein Schlauch braucht Urlaub.',
          'Wenn du Xavi findest: Seine Rechnung ist bezahlt. Sag ihm, der Ayran geht aufs Haus.',
        ])],
        choices: [...smalltalk, bye],
      },
    };
  }
  return {
    ...nodes,
    start: {
      lines: [x === 'vermisst'
        ? 'Willkommen im 1001. Du guckst, als würdest du jemanden suchen. Oder als hättest du Kalle gerochen.'
        : pick([
          'Willkommen im 1001. Doppelapfel? Minze? Oder beides, wie ein Mann?',
          'Hier gibt’s Tee, Tabak und Ruhe. Bier gibt’s bei dir im Eimer.',
          'Setz dich, wohin du willst. Nur nicht auf den Opa.',
        ])],
      choices: [
        ...(x === 'vermisst' ? [{ text: 'Ich suche Xavi. Lenis Freund.', next: 'xavi' }] : []),
        ...smalltalk,
        bye,
      ],
    },
    xavi: {
      lines: [
        'Xavi? Braune Haare, brauner Bart, redet mit seinen Schuhen?',
        'W:Klingt nach ihm.',
        'Der Leise. Trinkt Ayran, als wär’s Schnaps, und wird nach einem Glas trotzdem rot.',
        'Kommt hierher, weil’s hier nicht nach Gras riecht. Hausregel Nummer eins: Wer Gras mitbringt, fliegt raus.',
        'Neulich wollte so ein Typ von deinem Dachboden auf unserem Klo „nur kurz Pflanzen gießen“. Rausgeflogen.',
      ],
      choices: [
        { text: 'Wann war Xavi zuletzt hier?', next: 'xavi2' },
        back,
      ],
    },
    xavi2: {
      lines: [
        'Vor drei Tagen. Hat drei Wochen angeschrieben. Und dann ...',
        'Nee. Was dann war, erzähl ich nur einem, der mich schlägt.',
        'Schlauch gegen Schlauch. Wer zuerst zehn Züge hat, gewinnt. Ich hab seit 2014 nicht verloren.',
        'W:Und wenn ich gewinne?',
        'Dann erzähl ich dir alles. Und du kriegst einen Tee. Wenn du verlierst, kriegst du auch einen Tee. Ich bin ja kein Unmensch.',
      ],
      choices: [
        { text: 'Duell!', action: 'shishaDuell' },
        { text: 'Später.' },
      ],
    },
  };
}

// ---------------------------------------------------------------- Tuncay (Teil 2)

/** Tuncay hat eine Autowerkstatt; was Kunden nicht abholen, verkauft er auf dem Parkplatz aus dem Kofferraum.
 *  Was mit Xavi war, verrät er nur nach seinem Türkei-Quiz. */
export function tuncayTree(): Record<string, DialogNode> {
  const x = state.flags.xavi;
  const back = { text: 'Noch was.', next: 'start' };
  const bye = { text: 'Tschüss.' };
  const nodes: Record<string, DialogNode> = {
    ware: {
      lines: [
        'Alles aus meiner Werkstatt. Was die Kunden nach drei Monaten nicht abholen, gehört mir. Steht so im Vertrag. Den hab ich selbst geschrieben.',
        'Ein Handy, nur einmal runtergefallen. Aus dem dritten Stock.',
        'Ein Fahrrad mit allem dran. Außer Sattel. Sattel ist Luxus.',
        'Und Ausreden. Für die Frau fünf Euro, für den Chef zehn, für die Polizei hab ich keine. Da musst du selber.',
      ],
      choices: [back, bye],
    },
    werkstatt: {
      lines: [
        'Läuft. Halb Nordstadt fährt mit meinen Bremsen. Die andere Hälfte mit meinen Ausreden.',
        'Sogar der Golf von 1991 vor deiner Kneipe war bei mir. Ich hab ihm gesagt, er soll in Rente gehen. Er wollte nicht.',
        'Und die Chefin vom Muskelkater bringt ihr Cabrio zu mir. Pinke Ledersitze. Riecht nach Babyöl.',
      ],
      choices: [back, bye],
    },
    heimat: {
      lines: [
        'Ich bin hier geboren. Aber jeden Sommer Türkei, seit ich denken kann. Meine Oma wohnt am Meer.',
        'Wer über die Türkei redet, soll wenigstens wissen, wo Ankara ist. Das ist meine einzige Regel.',
        'W:Und Ehrlichkeit?',
        'Das ist keine Regel, Bruder. Das ist ein Hobby.',
      ],
      choices: [back, bye],
    },
  };
  // Kapitel 7: Jan ist im Kanal, Tuncay hat das Kanal-Paket im Kofferraum
  if (state.flags.kanal === 'entfuehrt') {
    return {
      ...nodes,
      start: {
        lines: [
          'Bruder, du guckst, als hättest du einen Tentakel gesehen.',
          'W:Hab ich. Er hat Jan geklaut. Ich muss in die Kanalisation.',
          'Kanalisation. Kein Problem. Ich hab das Kanal-Paket.',
        ],
        choices: [{ text: 'Was ist drin?', next: 'paket' }, { text: 'Was verkaufst du sonst?', next: 'ware' }, bye],
      },
      paket: {
        lines: [
          'Wathose, Stirnlampe, Gullyhaken. Achtzig Euro. Für dich, weil du Bruder bist: achtzig Euro.',
          'Wathose ist von einem Kunden. Hat sie nie abgeholt. Riecht noch nach ihm. Nach Angst, glaub ich.',
          'Stirnlampe hält drei Stunden. Oder zwanzig Minuten. Je nachdem, wie sehr du sie brauchst.',
        ],
        choices: [{ text: 'Her damit. (80 €)', action: 'kanalPaket' }, { text: 'Zu teuer.', next: 'teuer' }],
      },
      teuer: {
        lines: ['Zu teuer? Bruder. Da unten sind Enten mit Armen. Was ist dir dein Jan wert?', 'W:Es ist Kevins Jan.', 'Dann soll Kevin zahlen. Kevin hat aber kein Geld. Also du.'],
        choices: [{ text: 'Na gut. (80 €)', action: 'kanalPaket' }, { text: 'Später.' }],
      },
    };
  }
  if (x === 'spur') {
    return {
      ...nodes,
      start: {
        lines: ['Tuncay. Autowerkstatt Tuncay, gleich hinterm Parkplatz. Was ich nicht repariere, verkaufe ich. Was brauchst du?'],
        choices: [
          { text: 'Wo ist Xavi?', next: 'xavi' },
          { text: 'Was verkaufst du da?', next: 'ware' },
          { text: 'Woher kommst du eigentlich?', next: 'heimat' },
          { text: 'Wie läuft die Werkstatt?', next: 'werkstatt' },
          bye,
        ],
      },
      xavi: {
        lines: [
          'Xavi? Brauner Bart, guckt auf seine Schuhe? Kenn ich. Vielleicht.',
          'Infos kosten, Bruder.',
          'W:Ich hab kein Geld. Ich hab eine Kneipe.',
          'Dann zahl mit Wissen. Zehn Fragen über die Türkei. Sieben richtig, und ich sag dir alles.',
          'Wenn nicht, kaufst du ein Fahrrad. Ohne Sattel.',
        ],
        choices: [{ text: 'Quiz!', action: 'tuncayQuiz' }, { text: 'Später.' }],
      },
    };
  }
  return {
    ...nodes,
    start: {
      lines: [x === 'club' || x === 'gerettet'
        ? pick([
          'Ich hab dir alles gesagt, Bruder. Und sag der Chefin nicht, dass du es von mir hast.',
          'Willst du Babyöl? Ich hab zehn Kanister. Profi-Qualität. Riecht nach Kokos und Reue.',
        ])
        : pick([
          'Tuncay. Autowerkstatt Tuncay. Was ich nicht repariere, verkaufe ich.',
          'Psst. Original Rolex. Fast. Die Zeiger fehlen, dafür ist sie leicht.',
        ])],
      choices: [
        ...(state.inv.rolex > 0 ? [{ text: 'Willst du eine Rolex kaufen?', next: 'rolex' }] : []),
        { text: 'Was verkaufst du da?', next: 'ware' }, { text: 'Woher kommst du eigentlich?', next: 'heimat' }, bye,
      ],
    },
    rolex: {
      lines: [
        'N:Tuncay hält die Uhr ins Licht. Er beißt drauf. Er hält sie ans Ohr. Er riecht dran.',
        'Echt? Bruder, die ist echter als ich.',
        'Woher hast du die? ... Nein. Sag nichts. Riecht nach Kanal. Ich will es nicht wissen. Hundertfünfzig.',
      ],
      choices: [{ text: 'Deal. (150 €)', action: 'rolexVerkauf' }, { text: 'Behalte ich.' }],
    },
  };
}

// ---------------------------------------------------------------- Leni Blume (Teil 3)

/** Leni Blume, die andere Leni, Chefin des Muskelkaters. Nach Tuncays Hinweis kommt es zur Konfrontation (Kampf gegen Emilian). */
export function leni2Tree(): Record<string, DialogNode> {
  const x = state.flags.xavi;
  if (x === 'club') {
    return {
      start: {
        lines: [
          'Willkommen im Muskelkater. Gucken ja, anfassen nein, Trinkgeld immer.',
          'W:Wo ist Xavi?',
          '... Wer?',
          'W:Brauner Bart. Guckt auf seine Schuhe. Zehn Kanister Babyöl.',
          'Tuncay, diese Plaudertasche.',
        ],
        choices: [{ text: 'Warum hast du ihn?', next: 'warum' }, { text: 'Gib ihn raus.', next: 'raus' }],
      },
      warum: {
        lines: [
          'Weil SIE ihn hat. Leni. Die andere Leni. Seit der Grundschule die andere Leni.',
          'Sie hatte die besseren Zöpfe, die bessere Note in Sport, und jetzt hat sie einen Mann, der zuhört.',
          'Einen, der sich bei Türen entschuldigt! Weißt du, wie selten das ist? Hier drin entschuldigt sich keiner. Bei nichts.',
          'Ich wollte nicht, dass sie glücklich ist. Nur einmal nicht.',
        ],
        choices: [{ text: 'Gib ihn raus.', next: 'raus' }],
      },
      raus: {
        lines: [
          'Xavi sitzt hinten im Separee und trinkt Wasser. Er hat sich dreimal bedankt. DREIMAL.',
          'Du willst ihn? Dann geh an Emilian vorbei.',
          'EMILIAN! Zeig dem Herrn die Bühne!',
        ],
        choices: [{ text: 'Bring ihn her.', action: 'emilianKampf' }, { text: 'Gleich.' }],
      },
    };
  }
  if (x === 'gerettet') {
    return {
      start: {
        lines: [pick([
          'Lass mich. Ich lerne gerade, mich für andere zu freuen. Es tut weh.',
          'Emilian kühlt seinen Stolz mit Babyöl. Zehn Kanister reichen dafür nicht.',
        ])],
        choices: [{ text: 'Wird schon.' }],
      },
    };
  }
  return {
    start: {
      lines: [pick([
        'Willkommen im Muskelkater. Gucken ja, anfassen nein, Trinkgeld immer.',
        'Ich bin die Chefin. Leni Blume. Nicht die Leni vom Klo. Die andere.',
        'Emilian, mein bester Mann. Steht am liebsten in Tarnhose rum. Man sieht ihn trotzdem.',
      ])],
      choices: [{ text: 'Schönen Abend noch.' }],
    },
  };
}
