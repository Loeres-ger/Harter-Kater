import Phaser from 'phaser';

// Achievements: alle Erfolge an einer Stelle. Freigeschaltet wird ereignisbasiert über unlock(id),
// z. B. wenn ein Kampf gewonnen oder eine Pille gekauft wird. Gespeichert wird im localStorage des
// Browsers (funktioniert ohne Server, auch auf GitHub Pages). Neue Erfolge: Eintrag in ACHIEVEMENTS
// ergänzen und an der passenden Stelle unlock('id') aufrufen.

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  /** Textur des kleinen Symbols (siehe progress/icons.ts) */
  icon: string;
  /** geheim: Beschreibung erst nach dem Freischalten sichtbar */
  hidden?: boolean;
  /** vager Hinweis für geheime Erfolge */
  hint?: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'glanzTot', name: "Jetzt wird's ernst", desc: 'Dr. von Glanz ist tot.', icon: 'ach_skull' },
  { id: 'ersteSchlaegerei', name: 'Erst aufs Maul, dann die Frage', desc: 'Erste Kneipenschlägerei gewonnen.', icon: 'ach_fist' },
  { id: 'vitaminL', name: 'Vitamin L', desc: 'Erste Pillen bei Leonard gekauft.', icon: 'ach_pill' },
  { id: 'profilPasst', name: 'Profil passt', desc: 'Felix hatte „ein Gespür für so was“.', icon: 'ach_baton', hidden: true, hint: 'Beantworte Felix ein paar Fragen.' },
  { id: 'untermieter', name: 'Untermieter', desc: 'Lily und Borna haben sich gefunden.', icon: 'ach_heart', hidden: true, hint: 'Auf dem Dachboden ist noch Platz.' },
  { id: 'bruderEntspann', name: 'Bruder, entspann dich', desc: 'Kevin ist panisch geflüchtet.', icon: 'ach_roll', hidden: true, hint: 'Die Herrentoilette hat Geheimnisse.' },
  { id: 'deutscherTraum', name: 'Der deutsche Traum', desc: 'Manchmal öffnet der richtige Dialekt mehr Türen als der richtige Geldbeutel.', icon: 'ach_pretzel' },
  { id: 'zuJung', name: 'Zu jung für den Goldenen Eimer', desc: 'Manche Gäste sind wirklich noch nicht reif für diese Kneipe.', icon: 'ach_18' },
  { id: 'glasWasser', name: 'Ein Glas Wasser', desc: 'Leni ein Glas Wasser hingestellt.', icon: 'ach_glass', hidden: true, hint: 'Auf der Damentoilette braucht wer Hilfe.' },
];

const KEY = 'koenigskatze.achievements.v1';

/** id → Zeitpunkt der Freischaltung (ISO) */
let store: Record<string, string> = load();

function load(): Record<string, string> {
  try {
    const raw = localStorage.getItem(KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {}; // privates Fenster o. Ä.: gilt dann nur für diese Sitzung
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* Speichern nicht möglich, Freischaltung bleibt bis zum Neuladen */
  }
}

/** Meldet neu freigeschaltete Erfolge (NotifyScene zeigt dann die Einblendung). */
export const achievementEvents = new Phaser.Events.EventEmitter();

/** Erfolg freischalten. Liefert true nur beim ersten Mal, doppelte Meldungen gibt es nicht. */
export function unlock(id: string) {
  const def = ACHIEVEMENTS.find((a) => a.id === id);
  if (!def || store[id]) return false;
  store[id] = new Date().toISOString();
  save();
  achievementEvents.emit('unlocked', def);
  return true;
}

export function unlockedAt(id: string): Date | null {
  return store[id] ? new Date(store[id]) : null;
}

export function unlockedCount() {
  return ACHIEVEMENTS.filter((a) => store[a.id]).length;
}
