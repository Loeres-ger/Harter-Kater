// Die Storyline: Prolog, vier Kapitel-Zwischenspiele, der Epilog und Kapitel 5 im freien Spiel.

export type Who = 'wirt' | 'glanz' | 'kalle' | 'katze' | 'telefon' | 'borna' | 'lily' | 'maya' | 'claudius' | 'kevin' | 'leni' | 'cemo' | 'tuncay' | 'xavi' | 'leni2' | 'emilian' | 'nick';

export type Step =
  | { t: 'bg'; key: 'street' | 'dawn' | 'bar' | 'black' | 'letter' | 'eyes' | 'tod' | 'dach' | 'dachLeer' | 'laden' | 'wc' | 'shisha' | 'club' | 'keller' }
  | { t: 'caption'; text: string }
  | { t: 'title'; text: string; sub: string }
  | { t: 'say'; who: Who; text: string; look?: number }
  | { t: 'fx'; kind: 'thunder' | 'shake' | 'bell' | 'phone' | 'splash' | 'bulldozer' | 'monster' | 'roar' | 'flee' | 'queasy' | 'puke' | 'collapse' | 'hearts' | 'blitz' | 'stille' | 'abblende' | 'pogo' }
  | { t: 'wait'; ms: number }
  | { t: 'pause' };

export const STORY: Record<string, Step[]> = {
  // ---------------------------------------------------------------- Nebenhandlungen

  /**
   * Verlauf A: Der Wirt hat Borna fertiggemacht. Gezeigt wird nur, was danach bleibt: der leere Dachboden,
   * das offene Fenster, Gewitter, Stille. Keine Darstellung dessen, was passiert ist, kein Achievement.
   */
  bornaWeg: [
    { t: 'bg', key: 'black' },
    { t: 'caption', text: 'Später in der Nacht.' },
    { t: 'bg', key: 'dachLeer' },
    { t: 'wait', ms: 1400 },
    { t: 'fx', kind: 'blitz' },
    { t: 'say', who: 'wirt', text: '(Es ist still hier oben. Zu still.)' },
    { t: 'say', who: 'wirt', text: '(Kein Rauch. Kein Gekicher. Nur das offene Fenster. Der Regen weht herein.)' },
    { t: 'fx', kind: 'blitz' },
    { t: 'say', who: 'wirt', text: '(Auf der Matratze liegt ein Zettel.)' },
    { t: 'caption', text: '„Hab nachgedacht über das, was du gesagt hast, Chef.\nMach dir keinen Kopf. – B.“' },
    { t: 'fx', kind: 'stille' },
    { t: 'say', who: 'wirt', text: '(...)' },
    { t: 'say', who: 'wirt', text: '(Das hätte ich nicht sagen sollen.)' },
    { t: 'fx', kind: 'abblende' },
    { t: 'title', text: 'BORNA', sub: 'Sein Platz auf dem Dachboden bleibt leer.' },
  ],

  /** Mayas Dialektpfad: Sie lädt den Wirt freiwillig ins Lager ein. Nichts wird gezeigt, nur Herzen. */
  deutscherTraum: [
    { t: 'bg', key: 'laden' },
    { t: 'say', who: 'maya', look: 1, text: 'Also dann, mein Dialekt-Prinz. Hinterm Käse ist das Lager. Da riecht es nach Bergkäse.' },
    { t: 'say', who: 'wirt', text: '(Bergkäse. Romantischer wird es heute nicht mehr.)' },
    { t: 'say', who: 'maya', look: 1, text: 'Sag noch einmal „gell“.' },
    { t: 'say', who: 'wirt', text: '... Gell?' },
    { t: 'fx', kind: 'hearts' },
    { t: 'say', who: 'maya', look: 1, text: 'Das war ... sehr ... regional.' },
    { t: 'say', who: 'wirt', text: '(Ich glaub, ich hab mir was im Jodelmuskel gezerrt.)' },
    { t: 'say', who: 'maya', look: 1, text: 'Wenn jemand fragt: Wir haben im Lager Weißwürste gezuzelt.' },
    { t: 'title', text: 'DER DEUTSCHE TRAUM', sub: 'Ganz ohne Geld. Nur mit Dialekt.' },
  ],

  /** Verlauf B: Lilly zieht auf den Dachboden, sie und Borna finden sich. */
  lilyDach: [
    { t: 'bg', key: 'dach' },
    { t: 'say', who: 'wirt', text: 'Borna? Besuch. Das ist Lilly. Sie braucht einen Platz zum Pennen.' },
    { t: 'say', who: 'lily', text: 'Hi. Sorry, dass ich hier einfach so reinplatze.' },
    { t: 'say', who: 'borna', text: 'Whoa. Hallo. Kein Ding. Ich platz hier seit drei Jahren.' },
    { t: 'say', who: 'borna', text: 'Willst du die gute Seite der Matratze? Die ohne Fleck?' },
    { t: 'say', who: 'lily', text: 'Es gibt eine Seite ohne Fleck?' },
    { t: 'say', who: 'borna', text: 'Nein. Aber ich wollte nett sein.' },
    { t: 'say', who: 'lily', look: 1, text: '... Du bist komisch. Das ist gut. Alle anderen sind so normal.' },
    { t: 'say', who: 'borna', text: 'Manchmal guck ich nachts aus dem Fenster und frag mich, ob da draußen noch einer genauso festhängt.' },
    { t: 'say', who: 'lily', text: 'Ich sitz seit Wochen in der Gasse und frag mich genau dasselbe.' },
    { t: 'caption', text: 'Der Wirt beschließt, dass er hier oben überflüssig ist.\nEr klettert runter und dreht das Radio lauter.' },
    { t: 'bg', key: 'black' },
    { t: 'caption', text: 'Eine Stunde später.\nVon oben: rhythmisches Quietschen. Kalle wacht auf und schaut an die Decke.' },
    { t: 'bg', key: 'bar' },
    { t: 'say', who: 'borna', look: 1, text: 'Chef. CHEF. Ich hab ... ich hab wieder Gefühl in den Beinen. Und überall sonst.' },
    { t: 'say', who: 'lily', look: 1, text: 'Wir haben geredet. Unter anderem.' },
    { t: 'say', who: 'wirt', text: '(Die Matratze hat das „unter anderem“ sehr deutlich kommentiert.)' },
    { t: 'say', who: 'borna', look: 1, text: 'Ich geh morgen raus. DRAUSSEN. Brötchen holen. Mit Sonne und so.' },
    { t: 'say', who: 'lily', look: 1, text: 'Und ich komm mit. Ich glaub, ich hab gerade einen Platz gefunden.' },
    { t: 'say', who: 'kalle', text: 'Schön für euch. Jetzt macht leise. Ich will pennen.' },
    { t: 'title', text: 'UNTERMIETER', sub: 'Auf dem Dachboden wohnen jetzt zwei.' },
  ],


  // ---------------------------------------------------------------- Kapitel 5 (freies Spiel nach der Glanz-Handlung)

  /**
   * Vor dem Goldenen Eimer: Captain Claudius, General des (erfundenen) Staates Tavirien, will weltweit Alkohol und
   * Drogen verbieten und sucht seinen Deserteur Kevin. Kevin verrät, wo die Beweise für die Fake-Kampagne liegen.
   */
  kapitel5: [
    { t: 'bg', key: 'street' },
    { t: 'caption', text: 'Ein paar Nächte später.\nDer Goldene Eimer hat wieder geöffnet.\nVor der Tür steht jemand in Galauniform.' },
    { t: 'say', who: 'claudius', text: 'BÜRGER! Treten Sie zurück. Sie stehen im Sicherheitsbereich meines Ruhms.' },
    { t: 'say', who: 'wirt', text: 'Das ist mein Gehweg.' },
    { t: 'say', who: 'claudius', text: 'Captain Israel Claudius, Generalstab der Republik Tavirien. Wir befreien die Welt vom Alkohol. Ob sie will oder nicht.' },
    { t: 'say', who: 'wirt', text: '(Vor einer Kneipe. Mutig.)' },
    { t: 'say', who: 'claudius', text: 'Ich suche einen Deserteur. Groß. Lockig. Kaum bekleidet.' },
    { t: 'say', who: 'kevin', text: 'Bruder. Ich bin nicht desertiert. Ich bin GEFLÜCHTET. Das ist was ganz anderes.' },
    { t: 'say', who: 'wirt', text: '(Kevin. Aus Kabine eins. Ich hatte gehofft, ich seh ihn nie wieder. Zumindest nicht von vorne.)' },
    { t: 'say', who: 'kevin', text: 'Der Captain will Alkohol verbieten. Weltweit. Und alle Drogen. Und weißt du, was in Tavirien als Droge zählt?' },
    { t: 'say', who: 'kevin', text: 'Viagra, Bruder. VIAGRA. Ohne meine blauen Freunde bin ich nur ein großer, trauriger Mann im Tanga.' },
    { t: 'say', who: 'claudius', look: 1, text: 'Ihr Tanga ist Eigentum der Armee!' },
    { t: 'say', who: 'kevin', text: 'Er hat mit der BLÖD-Zeitung Fake-Statistiken ausgeheckt. Alles auf einem alten Rechner. Bei DIR auf dem Dachboden, Bruder.' },
    { t: 'say', who: 'claudius', look: 1, text: 'Lüge! Feindpropaganda! Und außerdem ist der Dachboden sehr gemütlich!' },
    { t: 'say', who: 'wirt', text: '(Erst mein Bier verbieten wollen und dann meinen Dachboden benutzen. Na warte.)' },
    { t: 'title', text: 'KAPITEL 5', sub: 'Die Wahrheit hat Hausverbot' },
  ],

  /** Nach dem Hack: Claudius widerspricht sich vor der Presse und flüchtet – ausgerechnet in die Kneipe. */
  claudiusEnde: [
    { t: 'bg', key: 'street' },
    { t: 'caption', text: 'Zwanzig Minuten nach dem Hack.\nDie Mails liegen bei seriösen Redaktionen und Faktencheckern.\nVor dem Eimer: drei Reporter, ein Rentner mit Klappstuhl und Kalle.' },
    { t: 'say', who: 'claudius', look: 1, text: 'BÜRGER! Diese Mails sind gefälscht! Ich habe sie persönlich geschrieben, ich muss es wissen!' },
    { t: 'say', who: 'wirt', text: 'Und die Statistik mit den Flatulenzen?' },
    { t: 'say', who: 'claudius', look: 1, text: 'Wissenschaftlich! Ich habe selbst gezählt!' },
    { t: 'caption', text: 'Ein Faktenchecker fragt, wie man 99,99 Prozent\naller Biertrinker untersucht hat.' },
    { t: 'say', who: 'claudius', text: 'Stichprobe. Ein Mann. Ein sehr verlässlicher Mann. Mein Schwager.' },
    { t: 'say', who: 'kevin', text: 'Captain. Die BLÖD-Zeitung hat die Geschichte zurückgezogen. Also die Hälfte. Auf Seite 17. Neben dem Wetter.' },
    { t: 'say', who: 'claudius', look: 1, text: 'Verrat! Ich ziehe mich zurück. Strategisch. Mit Würde.' },
    { t: 'caption', text: 'Captain Claudius marschiert davon. In die falsche Richtung.\nDirekt in den Goldenen Eimer.' },
    { t: 'fx', kind: 'bell' },
    { t: 'say', who: 'claudius', text: 'Ein Bier. Rein dienstlich. Zur ... Beweissicherung.' },
    { t: 'say', who: 'kevin', text: 'Bruder. Ich bleib noch ein bisschen hier. Meine blauen Freunde und ich fühlen uns endlich sicher.' },
    { t: 'say', who: 'wirt', text: '(Solange er die Kabine nicht wieder abschließt.)' },
    { t: 'title', text: 'PRESSEFREIHEIT', sub: 'Die Wahrheit hat wieder Hausrecht.' },
  ],

  // ---------------------------------------------------------------- Xavi-Strang (Storybaum: „Rettung von Xavi“)

  /** Nach Lenis Bitte auf der Damentoilette (LadiesRoomScene): Einblendung und Speicherpunkt */
  xaviStart: [
    { t: 'bg', key: 'wc' },
    { t: 'caption', text: 'Leni putzt sich die Nase. Mit Klopapier.\nDreilagig. Für besondere Anlässe.' },
    { t: 'title', text: 'XAVI IST WEG', sub: 'Leni braucht Hilfe' },
  ],

  /** Nach dem gewonnenen Shisha-Duell: Cemo verrät, dass Tuncay Xavi mitgenommen hat. */
  xaviSpur: [
    { t: 'bg', key: 'shisha' },
    { t: 'say', who: 'cemo', look: 1, text: 'Okay. Okay! Du ziehst wie ein Staubsauger.' },
    { t: 'say', who: 'cemo', text: 'Xavi war hier. Bis vor drei Tagen. Hat in der Ecke gesessen und seinen Ayran angestarrt.' },
    { t: 'say', who: 'cemo', text: 'Dann kam Tuncay. Hat sich neben ihn gesetzt. Xavi hat auf seine Schuhe geguckt. Wie immer.' },
    { t: 'say', who: 'wirt', text: 'Wer ist Tuncay?' },
    { t: 'say', who: 'cemo', text: 'Tuncay kauft und verkauft alles. Handys, Fahrräder, Ausreden.' },
    { t: 'say', who: 'cemo', text: 'Er hat Xavis Rechnung bezahlt. Drei Wochen Ayran. Bar. Und dann sind sie zusammen raus.' },
    { t: 'say', who: 'wirt', text: 'Xavi geht freiwillig mit einem Fremden mit?' },
    { t: 'say', who: 'cemo', text: 'Xavi sagt nicht mal Nein, wenn man ihn fragt, ob er Nein sagen will. Wohin sie sind? Weiß nur Tuncay.' },
    { t: 'say', who: 'cemo', text: 'Tuncay steht meistens auf dem Parkplatz oben im Norden. Mit offenem Kofferraum.' },
    { t: 'say', who: 'wirt', text: '(Leni wird das nicht gefallen.)' },
    { t: 'title', text: 'EINE SPUR', sub: 'Tuncay weiß, wo Xavi ist.' },
  ],

  /** Nach Tuncays Quiz: Er hat Xavi für zehn Kanister Babyöl an Leni Blume vermittelt. */
  xaviTuncay: [
    { t: 'bg', key: 'street' },
    { t: 'say', who: 'tuncay', look: 1, text: 'Okay, okay. Du kennst die Türkei besser als mein Cousin. Und der wohnt da.' },
    { t: 'say', who: 'tuncay', text: 'Xavi. Ja. Ich hab ihn ... vermittelt.' },
    { t: 'say', who: 'wirt', text: 'VERMITTELT?' },
    { t: 'say', who: 'tuncay', text: 'Die Chefin vom Muskelkater wollte ihn. Leni Blume. Nicht deine Leni vom Klo. Die andere.' },
    { t: 'say', who: 'tuncay', text: 'Ihr Cabrio steht seit Wochen bei mir in der Werkstatt. Man redet, beim Ölwechsel.' },
    { t: 'say', who: 'tuncay', text: 'Sie hat gesagt, sie will nur reden. Und mir zehn Kanister Babyöl gegeben. Profi-Qualität.' },
    { t: 'say', who: 'wirt', text: 'Du hast einen Menschen gegen Babyöl getauscht?!' },
    { t: 'say', who: 'tuncay', look: 1, text: 'Gegen ZEHN Kanister. Ich bin doch nicht blöd. ... Okay, ein bisschen blöd. Tut mir leid.' },
    { t: 'say', who: 'wirt', text: '(Muskelkater. Natürlich.)' },
    { t: 'title', text: 'LENI BLUME', sub: 'Xavi ist im Muskelkater.' },
  ],

  /** Nach dem Kampf gegen Emilian: Xavi ist frei, Leni und Xavi finden sich wieder. */
  /** Nick-Strang: Borna will Unternehmer werden (nach seinem Gespräch auf dem Dachboden) */
  nickStart: [
    { t: 'bg', key: 'dach' },
    { t: 'say', who: 'lily', look: 1, text: 'Borna. Du willst WAS?' },
    { t: 'say', who: 'borna', look: 1, text: 'Unternehmer werden, Lilly. Mit Pflanzen. Bio. Regional. Vom Dach.' },
    { t: 'say', who: 'lily', look: 1, text: 'Du hast letzte Woche einen Kaktus ertränkt.' },
    { t: 'say', who: 'borna', look: 1, text: 'Der wollte das so.' },
    { t: 'say', who: 'wirt', text: '(Ich grab also für einen Kiffer einen Busch aus. Vierzig Jahre Gastronomie, und das ist der Höhepunkt.)' },
    { t: 'title', text: 'BORNAS BUSINESS', sub: 'Die Pflanze steckt im Busch hinter der Bar.' },
  ],

  /** Nick verliert das Duell und will Koks */
  nickScheisse: [
    { t: 'bg', key: 'keller' },
    { t: 'fx', kind: 'shake' },
    { t: 'say', who: 'nick', look: 1, text: 'SCHEISSE! SCHEISSE! SCHEISSE!' },
    { t: 'say', who: 'nick', look: 1, text: 'Ein WIRT. Ein Wirt mit Rücken hat mich an der Gitarre fertiggemacht. In meinem eigenen Keller.' },
    { t: 'say', who: 'wirt', text: 'Rücken hab ich nur morgens.' },
    { t: 'say', who: 'nick', text: 'Na gut. Reden wir. Aber nicht so. Ich brauch erst was. Für die Nerven.' },
    { t: 'say', who: 'nick', text: 'Koks. Fünf Ladungen. Der Dealer hinten in der Gasse hat welches. Beeil dich, Opa.' },
    { t: 'say', who: 'wirt', text: '(Ich bin jetzt Lieferdienst für einen Satanisten. Das steht so nicht in der Gaststättenverordnung.)' },
    { t: 'title', text: 'DER KELLER', sub: 'Nick will fünf Ladungen Koks.' },
  ],

  /** Nach dem Endkampf: Nick ist wieder Mensch, clean, in Weiß. Er hört auf und gibt den Markt an Borna ab. */
  nickFrei: [
    { t: 'bg', key: 'black' },
    { t: 'caption', text: 'Stille. Rauch. Irgendwo tropft es.\nIn der Mitte des Pentagramms liegt jemand. Ganz in Weiß.' },
    { t: 'bg', key: 'keller' },
    { t: 'say', who: 'nick', look: 2, text: '*hust* ... Wo bin ich? Warum ... warum trage ich WEISS?' },
    { t: 'say', who: 'wirt', text: 'Du warst ein Dämon. Ich hab dich mit einem Verstärker verprügelt.' },
    { t: 'say', who: 'nick', look: 2, text: 'Ich fühl mich so ... sauber. Kein Satan. Keine Drogen. Nur ich. Und ein leichter Duft von Lavendel.' },
    { t: 'say', who: 'nick', look: 2, text: 'Das Zeug kam vom Teufel, weißt du. Darum war es so billig. Teuflisch billig. Damit ist jetzt Schluss.' },
    { t: 'say', who: 'nick', look: 2, text: 'Ich hör auf. Mit allem. Den Markt der Stadt kriegt Borna, der Junge vom Dach. Soll er es auf die normale Art versuchen.' },
    { t: 'say', who: 'wirt', text: '(Auf die normale Art. Mit Drogen. Na ja. Immerhin ohne Satan.)' },
    { t: 'say', who: 'nick', look: 2, text: 'Und du, Herr Wirt: Komm ab und zu runter. Zum Jammen. Ganz ohne Duell. Die Leute bleiben auch.' },
    { t: 'fx', kind: 'hearts' },
    { t: 'title', text: 'NICK IST CLEAN', sub: 'Der Keller bleibt offen. Borna übernimmt den Markt.' },
  ],

  xaviFrei: [
    { t: 'bg', key: 'club' },
    { t: 'say', who: 'emilian', text: 'Ich ... wollte doch nur tanzen. Und ab und zu jemanden die Bühne zeigen.' },
    { t: 'say', who: 'leni2', look: 1, text: 'Schon gut, Emilian. Schon gut. Leg dich hin. Ich hol das Babyöl.' },
    { t: 'say', who: 'leni2', look: 1, text: 'Nimm ihn mit. Er hat sich vorhin bei meinem Stuhl entschuldigt. Das halte ich nicht mehr aus.' },
    { t: 'caption', text: 'Aus dem Separee tappt ein Mann mit braunem Bart.\nEr guckt auf seine Schuhe.' },
    { t: 'say', who: 'xavi', text: 'H-hallo. Danke. Entschuldigung. Ist ... ist Leni da? Meine Leni?' },
    { t: 'fx', kind: 'bell' },
    { t: 'say', who: 'leni', look: 1, text: 'XAVIII!' },
    { t: 'say', who: 'xavi', look: 1, text: 'Leni! Ich wollte nur kurz Kippen holen. Und dann war da Babyöl. Und dann ... Separee.' },
    { t: 'say', who: 'leni', look: 1, text: 'Halt die Klappe und küss mich.' },
    { t: 'fx', kind: 'hearts' },
    { t: 'say', who: 'wirt', text: '(Ich geh dann mal. Das dauert hier länger.)' },
    { t: 'title', text: 'XAVI IST FREI', sub: 'Leni und Xavi knutschen jetzt im Park. Für immer.' },
  ],

  prolog: [
    { t: 'bg', key: 'street' },
    { t: 'caption', text: 'Irgendwo in der Stadt.\nEine verregnete Nacht.' },
    { t: 'fx', kind: 'thunder' },
    { t: 'caption', text: 'Der „Goldene Eimer“.\nSeit 40 Jahren eine Kneipe.\nAb morgen: eine Baugrube.' },
    { t: 'bg', key: 'letter' },
    { t: 'pause' },
    { t: 'bg', key: 'bar' },
    { t: 'say', who: 'wirt', text: 'Vierzig Jahre. Und dieser Lackaffe von Anwalt macht mir die Bude dicht.' },
    { t: 'say', who: 'wirt', text: 'Für „Glanz-Lofts“. Was soll das überhaupt sein?!' },
    { t: 'say', who: 'kalle', text: 'Zzz ... Chef ... frag die Katze ... die Königskatze ... zzz ...' },
    { t: 'say', who: 'wirt', text: 'Kalle, du bist besoffen.' },
    { t: 'fx', kind: 'thunder' },
    { t: 'bg', key: 'eyes' },
    { t: 'say', who: 'katze', text: 'Miau. Wirt.' },
    { t: 'say', who: 'katze', text: 'Ich habe Hunger. Großen Hunger. Nach etwas ... Feinem.' },
    { t: 'say', who: 'katze', text: 'Bring mir den Mann im Anzug. Schön weich gekocht. Den Rest regle ich.' },
    { t: 'bg', key: 'bar' },
    { t: 'say', who: 'wirt', text: '... Ich hab definitiv zu viel getrunken.' },
    { t: 'fx', kind: 'bell' },
    { t: 'say', who: 'glanz', look: 0, text: 'Guten Abend. Ich wollte mir die Immobilie ein letztes Mal ansehen. Bevor die Bagger kommen.' },
    { t: 'say', who: 'glanz', look: 0, text: 'Ein Glas Champagner. Ich feiere. Sie verstehen.' },
    { t: 'say', who: 'wirt', text: '(Na warte, Bürschchen.)' },
    { t: 'say', who: 'wirt', text: 'Kommt sofort, Herr Doktor.' },
    { t: 'title', text: 'KAPITEL 1', sub: 'Der letzte Abend' },
  ],

  kapitel2: [
    { t: 'bg', key: 'bar' },
    { t: 'fx', kind: 'phone' },
    { t: 'say', who: 'glanz', look: 2, text: 'Ja? ... Herr Brenninger! Nein, nein, die Unterschrift kommt morgen früh ...' },
    { t: 'say', who: 'telefon', text: 'VON GLANZ! SIND SIE ETWA BETRUNKEN?!' },
    { t: 'say', who: 'glanz', look: 2, text: 'Ich? Pfff. Ich bin ... prima. PRIMA!' },
    { t: 'fx', kind: 'splash' },
    { t: 'say', who: 'glanz', look: 2, text: 'Hoppla. Handy ist im Bier. Egal! Wirt! Noch einen!' },
    { t: 'say', who: 'wirt', text: '(Läuft.)' },
    { t: 'title', text: 'KAPITEL 2', sub: 'Der Anruf' },
  ],

  kapitel3: [
    { t: 'bg', key: 'bar' },
    { t: 'say', who: 'glanz', look: 4, text: 'Weißt du was, Kumpel ... ich hatte nie Freunde. Nur Akten. Und Brenninger.' },
    { t: 'say', who: 'glanz', look: 4, text: 'Hier. Mein Porsche-Schlüssel. Brauch ich nich mehr.' },
    { t: 'say', who: 'glanz', look: 4, text: 'Und die Abrissverfügung ... *schnäuzt sich rein*' },
    { t: 'say', who: 'wirt', text: '(Fast tut er mir leid. Fast.)' },
    { t: 'bg', key: 'eyes' },
    { t: 'say', who: 'katze', text: 'Bald, Wirt. Bald.' },
    { t: 'title', text: 'KAPITEL 3', sub: 'Ganz unten' },
  ],

  kapitel4: [
    // Von Glanz stirbt am Tresen
    { t: 'bg', key: 'tod' },
    { t: 'say', who: 'glanz', look: 4, text: 'Horst ... das Zeug ... war gut. Rischtig gut. Mir is nur so ... warm.' },
    { t: 'fx', kind: 'queasy' },
    { t: 'say', who: 'glanz', look: 4, text: 'Horst ... hasse ma ... nen Eimer? Isch glaub isch muss ... HHRRK' },
    { t: 'say', who: 'wirt', text: 'Nicht auf den Tre—' },
    { t: 'fx', kind: 'puke' },
    { t: 'say', who: 'glanz', look: 4, text: '... *keuch* ... schon besser. Viel bess—' },
    { t: 'fx', kind: 'collapse' },
    { t: 'say', who: 'wirt', text: '...' },
    { t: 'say', who: 'wirt', text: '(Dr. Friedrich von Glanz. Erstickt an Fusel, Kotze und Hochmut.)' },
    { t: 'say', who: 'wirt', text: '(Den Tresen wisch ich morgen.)' },
    { t: 'bg', key: 'eyes' },
    { t: 'fx', kind: 'thunder' },
    { t: 'say', who: 'katze', text: 'Endlich. Er ist gar.' },
    { t: 'say', who: 'katze', text: 'Bring ihn mir. Raus in die Gasse. Und lass dich nicht erwischen.' },
    { t: 'title', text: 'KAPITEL 4', sub: 'Futterzeit' },
  ],

  epilog: [
    { t: 'bg', key: 'dawn' },
    { t: 'caption', text: 'Am nächsten Morgen.' },
    { t: 'fx', kind: 'bulldozer' },
    { t: 'say', who: 'telefon', look: 1, text: 'ABREISSEN! SOFORT! WO IST DIESER VON GLANZ?!' },
    { t: 'fx', kind: 'monster' },
    { t: 'fx', kind: 'roar' },
    { t: 'say', who: 'telefon', look: 1, text: 'WAS ZUM ... ALLE WEG HIER! WEEEG!' },
    { t: 'fx', kind: 'flee' },
    { t: 'caption', text: 'Dr. von Glanz wurde nie wiedergesehen.\nDas Viertel wurde zur Sperrzone erklärt.' },
    { t: 'bg', key: 'eyes' },
    { t: 'say', who: 'katze', text: 'Gut gemacht, Wirt. Ich bleibe. Im Keller. Und ich habe ... wieder Hunger.' },
    { t: 'bg', key: 'bar' },
    { t: 'caption', text: 'Der Goldene Eimer hat bis heute geöffnet.\n\nGäste gibt es kaum noch.\nAber unten im Keller ... schmatzt etwas.' },
    { t: 'caption', text: 'Der Abriss ist abgesagt. Der Eimer bleibt.\nDie Stadt ist offen. Schau dich um.' },
    { t: 'title', text: 'ES IST ERWACHT', sub: 'Die Pest im Keller' },
  ],
};

