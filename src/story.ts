// Die Storyline: Prolog, vier Kapitel-Zwischenspiele, der Epilog und Kapitel 5 im freien Spiel.

export type Who = 'wirt' | 'glanz' | 'kalle' | 'katze' | 'telefon' | 'borna' | 'lily' | 'maya' | 'claudius' | 'kevin' | 'leni';

export type Step =
  | { t: 'bg'; key: 'street' | 'dawn' | 'bar' | 'black' | 'letter' | 'eyes' | 'tod' | 'dach' | 'dachLeer' | 'laden' | 'wc' }
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

  /** Vor dem Goldenen Eimer: Captain Claudius sucht Kevin. Kevin verrät, wo die Akten liegen. */
  kapitel5: [
    { t: 'bg', key: 'street' },
    { t: 'caption', text: 'Ein paar Nächte später.\nDer Goldene Eimer hat wieder geöffnet. Gäste kommen kaum.\nVor der Tür steht trotzdem jemand.' },
    { t: 'say', who: 'wirt', text: '(Wer lehnt denn da einen Springstock an meine Hauswand?)' },
    { t: 'say', who: 'claudius', text: 'BÜRGER! Treten Sie zurück. Sie stehen im Sicherheitsbereich meines Ruhms.' },
    { t: 'say', who: 'wirt', text: 'Das ist mein Gehweg.' },
    { t: 'say', who: 'claudius', text: 'Captain Israel Claudius. Oberkommandierender der Beweglichen Verteidigung. Träger von vierzehn Orden, davon zwölf selbst verliehen.' },
    { t: 'say', who: 'claudius', text: 'Ich suche einen Deserteur. Groß. Lockig. Kaum bekleidet.' },
    { t: 'say', who: 'kevin', text: 'Bruder. Ich bin nicht desertiert. Ich bin GEFLÜCHTET. Das ist was ganz anderes.' },
    { t: 'say', who: 'wirt', text: '(Kevin. Aus Kabine eins. Ich hatte gehofft, ich seh ihn nie wieder. Zumindest nicht von vorne.)' },
    { t: 'say', who: 'kevin', text: 'Der Captain hat mich angeworben, Bruder. „Operation Pogo“. Soldaten auf Springstöcken. Ich war Ausbilder für Rückstoß.' },
    { t: 'say', who: 'claudius', look: 1, text: 'Es gab nie eine Operation Pogo! Und sie war ein voller Erfolg!' },
    { t: 'say', who: 'kevin', text: 'Siehst du? So redet der die ganze Zeit.' },
    { t: 'say', who: 'kevin', text: 'Seine Akten hat er versteckt. Auf einem alten Rechner. Bei DIR auf dem Dachboden, Bruder. Weil da „keiner freiwillig hochgeht“.' },
    { t: 'say', who: 'claudius', look: 1, text: 'Lüge! Feindpropaganda! Und außerdem ist der Dachboden sehr gemütlich!' },
    { t: 'say', who: 'wirt', text: '(Ich glaube, ich will wissen, was auf diesem Rechner ist.)' },
    { t: 'title', text: 'KAPITEL 5', sub: 'Die Wahrheit hat Hausverbot' },
  ],

  /** Nach dem Veröffentlichen: Claudius widerspricht sich vor der Presse und hüpft davon. */
  claudiusEnde: [
    { t: 'bg', key: 'street' },
    { t: 'caption', text: 'Zwanzig Minuten nach dem Hochladen.\nVor dem Eimer stehen drei Lokalreporter, ein Rentner mit Klappstuhl und Kalle.' },
    { t: 'say', who: 'claudius', look: 1, text: 'BÜRGER! Diese Dokumente sind gefälscht! Ich habe sie persönlich gefälscht, ich muss es wissen!' },
    { t: 'say', who: 'wirt', text: 'Sie haben sie selbst unterschrieben. Auf jeder Seite. Mit Glitzerstift.' },
    { t: 'say', who: 'claudius', look: 1, text: 'Ich unterschreibe vieles! Das nennt man Führungsstärke!' },
    { t: 'say', who: 'kevin', text: 'Captain. Im Bericht steht, der Ententeich hätte zuerst angegriffen.' },
    { t: 'say', who: 'claudius', text: 'Der Teich war feindselig. Er hat uns ... gespiegelt.' },
    { t: 'caption', text: 'Ein Reporter fragt, warum der „Untersuchungsbericht“\nzwei Tage VOR der Operation datiert ist.' },
    { t: 'say', who: 'claudius', look: 1, text: 'Gute Untersuchungen beginnen früh!' },
    { t: 'say', who: 'claudius', text: 'Ich ziehe mich nun zurück. Strategisch. Mit Würde. Und mit Rückstoß.' },
    { t: 'fx', kind: 'pogo' },
    { t: 'say', who: 'kevin', text: 'Bruder. Er springt in die falsche Richtung. Da ist der Stadtpark.' },
    { t: 'fx', kind: 'splash' },
    { t: 'caption', text: 'Aus der Ferne: empörtes Quaken.\nDer Ententeich hat wieder angegriffen.' },
    { t: 'say', who: 'kevin', text: 'Danke, Bruder. Ich bleib noch ein bisschen hier. Ohne Springstock.' },
    { t: 'say', who: 'wirt', text: '(Solange er die Kabine nicht wieder abschließt.)' },
    { t: 'title', text: 'PRESSEFREIHEIT', sub: 'Die Wahrheit hat wieder Hausrecht.' },
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

