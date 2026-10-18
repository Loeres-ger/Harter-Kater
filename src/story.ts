// Die Storyline: Prolog, drei Kapitel-Zwischenspiele und der Epilog.

export type Who = 'wirt' | 'glanz' | 'kalle' | 'katze' | 'telefon';

export type Step =
  | { t: 'bg'; key: 'street' | 'dawn' | 'bar' | 'black' | 'letter' | 'eyes' | 'tod' }
  | { t: 'caption'; text: string }
  | { t: 'title'; text: string; sub: string }
  | { t: 'say'; who: Who; text: string; look?: number }
  | { t: 'fx'; kind: 'thunder' | 'shake' | 'bell' | 'phone' | 'splash' | 'bulldozer' | 'monster' | 'roar' | 'flee' | 'queasy' | 'puke' | 'collapse' }
  | { t: 'wait'; ms: number }
  | { t: 'pause' };

export const STORY: Record<string, Step[]> = {
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
    { t: 'title', text: 'ENDE', sub: 'Die Pest im Keller' },
  ],
};
