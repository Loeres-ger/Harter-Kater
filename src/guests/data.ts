import type { Pal } from '../gfx';

// Die Stammgäste der Kneipe: Aussehen (Draufsicht + Brustbild), Sprüche und Kampfwerte.

export type HairStyle = 'short' | 'long' | 'bald' | 'helmet' | 'cap' | 'bun';
export type Outfit = 'vest' | 'hoodie' | 'leather' | 'jersey' | 'shirt' | 'cardigan' | 'jacket';

export interface BustLook {
  skin: string;
  hair: string;
  style: HairStyle;
  outfit: Outfit;
  top: string;
  top2: string;
  accent: string;
  glasses?: boolean;
  beard?: string;
  /** Mützen-/Kappenfarbe (sonst Oberteilfarbe) */
  hat?: string;
  lips?: string;
  earrings?: string;
}

export interface GuestDef {
  id: string;
  name: string;
  pal: Pal;
  bust: BustLook;
  /** so viele Treffer braucht es bis zum K.o. */
  hits: number;
  /** Abstand zwischen seinen Schlägen (ms) */
  attackEvery: number;
  damage: number;
  reward: number;
  calm: string[];
  rowdy: string[];
  fight: string[];
}

export const GUESTS: GuestDef[] = [
  {
    id: 'bernd', name: 'Bauarbeiter Bernd',
    pal: { skin: '#e8b088', hair: '#5a3a20', coat: '#f07a20', coat2: '#c85a10', pants: '#3a4a6a', shoes: '#2a2018', hat: '#f0c020', hat2: '#d8a810' },
    bust: { skin: '#e8b088', hair: '#5a3a20', style: 'helmet', outfit: 'vest', top: '#f07a20', top2: '#c85a10', accent: '#f0c020', beard: '#6a4a2a' },
    hits: 34, attackEvery: 1300, damage: 14, reward: 14,
    calm: ['Feierabendbier. Hab ich mir verdient.', 'Morgen reißen wir hier in der Gegend was ab. Hehe.'],
    rowdy: ['WAS GUCKST DU?!', 'Das Bier ist WARM!', 'Ich hau hier gleich alles kurz und klein!'],
    fight: ['Ich mauer dich ein!', 'Komm her, Bürschchen!'],
  },
  {
    id: 'sabine', name: 'Studentin Sabine',
    pal: { skin: '#f4c8a0', hair: '#8a4a2a', coat: '#7a4ab0', coat2: '#5a3490', pants: '#2a3050', shoes: '#e8e8e8', longHair: true, lips: '#c04050' },
    bust: { skin: '#f4c8a0', hair: '#8a4a2a', style: 'long', outfit: 'hoodie', top: '#7a4ab0', top2: '#5a3490', accent: '#e8e0f0' },
    hits: 22, attackEvery: 1100, damage: 9, reward: 8,
    calm: ['Ich schreib hier meine Bachelorarbeit. Über Kneipenkultur.', 'Haben Sie auch Hafermilch? Nein? Okay.'],
    rowdy: ['Das ist alles so PATRIARCHAL hier!', 'Ich hab drei Semester Kickboxen!', 'Wer hat meinen Laptop angefasst?!'],
    fight: ['Hiyaaa!', 'Das gibt eine schlechte Bewertung!'],
  },
  {
    id: 'ralf', name: 'Rocker Ralf',
    pal: { skin: '#e0a880', hair: '#3a3a3a', coat: '#1a1a1e', coat2: '#0e0e12', pants: '#2a3a5a', shoes: '#111111', beard: '#4a3a2a', bald: true },
    bust: { skin: '#e0a880', hair: '#3a3a3a', style: 'bald', outfit: 'leather', top: '#1a1a1e', top2: '#0e0e12', accent: '#c8c8d0', beard: '#4a3a2a' },
    hits: 45, attackEvery: 1400, damage: 20, reward: 25,
    calm: ['Meine Harley steht draußen. Wer sie anfasst, stirbt.', 'Mach mal AC/DC an, Wirt.'],
    rowdy: ['WER HAT MEINE MASCHINE ANGEFASST?!', 'Hier ist mir zu viel Schlager!', 'Ich brauch Bewegung. Und zwar jetzt.'],
    fight: ['Jetzt gibt\'s Lack!', 'Highway to Hell, Kumpel!'],
  },
  {
    id: 'frank', name: 'Fußballfan Frank',
    pal: { skin: '#f0c098', hair: '#c89a40', coat: '#2a8a3a', coat2: '#1e6a2a', pants: '#222222', shoes: '#111111', hat: '#2a8a3a', hat2: '#1e6a2a', shirt: '#ffffff' },
    bust: { skin: '#f0c098', hair: '#c89a40', style: 'cap', outfit: 'jersey', top: '#2a8a3a', top2: '#1e6a2a', accent: '#ffffff' },
    hits: 30, attackEvery: 1000, damage: 12, reward: 12,
    calm: ['Drei zu null! DREI ZU NULL!', 'Schalt mal den Fernseher an, gleich ist Anpfiff.'],
    rowdy: ['SCHIRI, WIR WISSEN WO DEIN AUTO STEHT!', 'Wer ist hier für die Gegner?!', 'Ihr seid alle Abseits!'],
    fight: ['Rote Karte für dich!', 'Blutgrätsche!'],
  },
  {
    id: 'uwe', name: 'Büro-Uwe',
    pal: { skin: '#f0c8a8', hair: '#6a5a4a', coat: '#a8c8e8', coat2: '#88a8c8', pants: '#3a3a46', shoes: '#1a1a1a', shirt: '#a8c8e8', tie: '#8a2a2a' },
    bust: { skin: '#f0c8a8', hair: '#6a5a4a', style: 'short', outfit: 'shirt', top: '#a8c8e8', top2: '#88a8c8', accent: '#8a2a2a', glasses: true },
    hits: 18, attackEvery: 1500, damage: 8, reward: 10,
    calm: ['Nur ein Bier. Dann muss ich Excel-Tabellen machen.', 'Mein Chef ist ein Idiot. Das bleibt unter uns, ja?'],
    rowdy: ['ICH HAB DIE NASE VOLL VON MEETINGS!', 'Das geht an die Geschäftsleitung!', 'Ich bin heute wild! WILD!'],
    fight: ['Das gibt eine Abmahnung!', 'Ich... ich mach das jetzt wirklich!'],
  },
  {
    id: 'gerda', name: 'Oma Gerda',
    pal: { skin: '#f0d0b8', hair: '#d0d0d0', coat: '#b03040', coat2: '#8a2030', pants: '#4a4a5a', shoes: '#3a2a2a' },
    bust: { skin: '#f0d0b8', hair: '#d0d0d0', style: 'bun', outfit: 'cardigan', top: '#b03040', top2: '#8a2030', accent: '#f4f0e8', glasses: true },
    hits: 40, attackEvery: 800, damage: 11, reward: 20,
    calm: ['Einen Eierlikör, Herzchen.', 'Früher war hier mehr los. Mit Tanz!'],
    rowdy: ['DIE JUGEND VON HEUTE!', 'Ich hab schon Rocker verhauen, da warst du noch Quark im Schaufenster!', 'Mein Stock juckt, junger Mann!'],
    fight: ['Ich hau dir den Hintern voll!', 'Für Opa Heinz!'],
  },
];

export const guestById = (id: string) => GUESTS.find((g) => g.id === id)!;
