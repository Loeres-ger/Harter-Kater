import { state } from '../state';
import type { Choice, DialogNode } from './data';
import { hochzeitPruefen } from './kanal';

// Adshayan, Besitzer des „Masala Basar“. Super nett, super freundlich. Bei der Eröffnung hat er sein eigenes
// Curry zu oft probiert, jetzt liegt es überall auf dem Boden. Der Wirt hilft beim Putzen (PutzScene),
// danach ist der Laden offen (Curry, Mango-Lassi).

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const BYE: Choice = { text: 'Bis später.' };
const KAUFEN: Choice = { text: 'Was gibt’s heute?', action: 'shop' };

/** Phase 5 (Kapitel 8): so viel Curry, dass ein Monster kommt */
function curryPlan(): Record<string, DialogNode> | null {
  const f = state.flags;
  if (f.kanal !== 'curry' || f.curryAnTuer) return null;
  if (f.curryTopf) {
    return {
      start: {
        lines: ['Lauf, Wirt! Der Topf wird kalt! ... Er wird nie kalt. Aber lauf.', 'Durch das Klo, hast du gesagt? Ich frage nicht. Ich koche nur.'],
        choices: [{ text: 'Bin schon weg.' }],
      },
    };
  }
  if ((f.curryGekocht ?? 0) > 0) {
    return {
      start: {
        portrait: 'nbust_adshayanSad',
        lines: ['N:Adshayan sieht den leeren Wirt. Ohne Topf. Mit Curry an den Hosenbeinen.', 'Schon wieder? ...', 'Gut. Ich lerne einfach, nie aufzuhören.'],
        choices: [{ text: 'Koch, Adshayan. Koch!', action: 'curryKochen' }, { text: 'Gleich.' }],
      },
    };
  }
  return {
    start: {
      lines: [
        'W:Adshayan. Ich brauche Curry. Viel Curry. So viel, dass ein Monster aus dem Klärwerk kommt.',
        'Du willst ... so viel Curry, dass ein Monster kommt? Ich habe so viel Curry, dass ein Monster GEHT.',
        'Ich koche den großen Topf. Den von der Eröffnung. ... Den, an dem alles begann.',
      ],
      choices: [{ text: 'Koch, Adshayan. Koch!', action: 'curryKochen' }, { text: 'Gleich.' }],
    },
  };
}

export function adshayanTree(): Record<string, DialogNode> {
  const f = state.flags;
  const buffet = f.kanal === 'vorbereitung' && !f.hochzeitBuffet;
  if (f.basarSauber) {
    const plan = curryPlan();
    if (plan) return plan;
    return {
      buffet: {
        onEnter: () => { if (!f.hochzeitBuffet) { f.hochzeitBuffet = true; hochzeitPruefen(); } },
        lines: ['Eine Hochzeit! Im Muskelkater? Wie schön! Ich koche mein bestes Curry!', 'Und ich probiere es nur EINMAL. Versprochen.', '... Zweimal. Zweimal ist Qualitätskontrolle.'],
        choices: [{ text: 'Abgemacht.' }],
      },
      start: {
        lines: [pick([
          'Mein Held! Für dich ist hier immer offen. Auch nachts. Ich wohne quasi hinter der Theke.',
          'Da ist ja mein Lieblingskunde! Der Boden glänzt immer noch. Ich lasse keinen mehr drauf. Außer dich.',
          'Willkommen, willkommen! Das Curry ist frisch, der Lassi ist kalt, und alles bleibt drin. Versprochen.',
        ])],
        choices: [...(buffet ? [{ text: 'Kochst du das Buffet für Kevins Hochzeit?', next: 'buffet' }] : []), KAUFEN, { text: 'Wie läuft der Laden?', next: 'laden' }, { text: 'Tschüss, Adshayan.' }],
      },
      laden: {
        lines: [pick([
          'Maya aus der Feinkost war da. Sie hat sich alles angeschaut und „Sauber hier“ gesagt. Ich glaube, das war ein Kompliment. Oder eine Drohung.',
          'Kalle hat gefragt, ob man Kurkuma rauchen kann. Ich habe Nein gesagt. Er hat es trotzdem probiert. Er ist jetzt ein bisschen gelb.',
          'Cemo wollte Kardamom für seine Shisha. Ich habe ihm welchen geschenkt. Seitdem bringt er mir jeden Morgen Tee.',
          'Das Gesundheitsamt war da. Volle Punktzahl! Der Prüfer hat drei Teller Curry gegessen und dann geweint. Vor Glück, sagt er.',
          'Mein Curry probiere ich jetzt nur noch einmal. Höchstens zweimal. Dreimal, wenn es regnet.',
        ])],
        choices: [KAUFEN, BYE],
      },
    };
  }
  const nochmal = (f.basarVersuche ?? 0) > 0;
  return {
    start: {
      portrait: 'nbust_adshayanSad',
      lines: [nochmal
        ? 'Du bist wieder da! Das war knapp vorhin. Noch eine Runde? Ich habe einen neuen Schwamm. Den alten haben wir verloren.'
        : 'Hallo, hallo! Willkommen im Masala Basar! Mein allererster Kunde! Bitte ... bitte nicht auf den Boden schauen.'],
      choices: nochmal
        ? [{ text: 'Gib her, ich mach das.', action: 'putzen' }, { text: 'Gleich. Erst mal Luft holen.', next: 'spaeter' }]
        : [...(buffet ? [{ text: 'Kochst du für eine Hochzeit?', next: 'buffetSpaeter' }] : []), ...(f.kanal === 'curry' ? [{ text: 'Ich brauche Curry. Ganz viel.', next: 'curryDreck' }] : []), { text: 'Was ist mit dem Boden?', next: 'boden' }, { text: 'Kann ich was kaufen?', next: 'zu' }, { text: 'Tschüss.' }],
    },
    curryDreck: {
      portrait: 'nbust_adshayanSad',
      lines: ['Curry? Für ein Monster? Natürlich! Aber erst den Boden, Wirt.', 'Mit einem Riesentopf in der Hand rutscht man hier in den Tod. Ich weiß das. Ich bin schon dreimal gestorben. Fast.'],
      choices: [{ text: 'Gib her, ich putz.', action: 'putzen' }, BYE],
    },
    buffetSpaeter: {
      portrait: 'nbust_adshayan',
      lines: ['Eine Hochzeit! Wie schön! Natürlich koche ich!', 'Aber erst, wenn hier keiner mehr ausrutscht. Sonst landet das Brautpaar im Curry. Im alten.'],
      choices: [{ text: 'Was ist mit dem Boden?', next: 'boden' }, BYE],
    },
    boden: {
      portrait: 'nbust_adshayanSad',
      lines: [
        'N:Der Boden ist voller Curry. Es war mal in einem Topf. Dann in Adshayan. Jetzt ist es wieder draußen.',
        'Gestern war Eröffnung. Ich war so aufgeregt, dass ich mein eigenes Curry zwölfmal probiert habe. Zur Sicherheit.',
        'Dann hat mein Magen beschlossen, auch etwas zu eröffnen.',
        'Ich wollte doch nur, dass hier alles schön ist, wenn die ersten Kunden kommen. Und jetzt stehst du in meinem Curry. Es tut mir so leid!',
      ],
      choices: [{ text: 'Gib mir einen Schwamm. Ich helf dir.', next: 'danke' }, { text: 'Viel Glück damit, Kumpel.', next: 'glueck' }],
    },
    danke: {
      portrait: 'nbust_adshayan',
      lines: [
        'Wirklich? Du bist ein Engel! Ein Engel mit Bierfleck, aber ein Engel!',
        'Hier, der Schwamm. Ich halte mich im Hintergrund. Falls ... noch was kommt.',
      ],
      choices: [{ text: 'Los geht’s.', action: 'putzen' }],
    },
    glueck: {
      portrait: 'nbust_adshayanSad',
      lines: ['Danke! Ich schaffe das schon. Irgendwann. Bis dahin verkaufe ich nur den Duft.'],
      choices: [{ text: 'Na gut. Ich helf dir doch.', next: 'danke' }, BYE],
    },
    zu: {
      portrait: 'nbust_adshayanSad',
      lines: ['Noch nicht, leider. Wer hier zur Kasse will, rutscht unterwegs dreimal aus. Erst putzen, dann verkaufen.'],
      choices: [{ text: 'Was ist denn passiert?', next: 'boden' }, BYE],
    },
    spaeter: {
      portrait: 'nbust_adshayan',
      lines: ['Natürlich! Lass dir Zeit. Das Curry läuft nicht weg. Leider.'],
      choices: [BYE],
    },
  };
}
