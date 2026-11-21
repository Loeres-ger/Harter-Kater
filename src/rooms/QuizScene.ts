import Phaser from 'phaser';
import { audio } from '../audio';
import { state } from '../state';
import { H, W, txt } from '../ui';
import { Btn } from '../scenes/ShopScene';

// Tuncays Türkei-Quiz (Xavi-Strang, Teil 2): zehn Fragen aus einem größeren Vorrat, je drei Antworten,
// 15 Sekunden pro Frage. Ab sieben richtigen verrät Tuncay, wo Xavi ist.

export interface QuizData {
  resume: string;
  onDone?: (win: boolean) => void;
}

interface Frage { q: string; a: string[]; ok: number }

/** Antwort an Index ok ist richtig; die Reihenfolge wird beim Stellen gemischt */
const FRAGEN: Frage[] = [
  { q: 'Wie heißt die Hauptstadt der Türkei?', a: ['Ankara', 'Istanbul', 'Izmir'], ok: 0 },
  { q: 'Welche Stadt liegt auf zwei Kontinenten?', a: ['Istanbul', 'Antalya', 'Konya'], ok: 0 },
  { q: 'Welche Meerenge fließt mitten durch Istanbul?', a: ['Der Bosporus', 'Der Ärmelkanal', 'Die Straße von Gibraltar'], ok: 0 },
  { q: 'Wie heißt die Währung der Türkei?', a: ['Türkische Lira', 'Dinar', 'Drachme'], ok: 0 },
  { q: 'Welcher Berg ist der höchste der Türkei?', a: ['Der Ararat', 'Der Olymp', 'Der Kilimandscharo'], ok: 0 },
  { q: 'Was ist Ayran?', a: ['Ein Joghurtgetränk mit Salz', 'Ein Teegebäck', 'Ein Kartenspiel'], ok: 0 },
  { q: 'Wie viele Sterne hat die türkische Flagge?', a: ['Einen', 'Drei', 'Keinen'], ok: 0 },
  { q: 'Wo fahren die bekannten Heißluftballons über Feenkamine?', a: ['In Kappadokien', 'In Bodrum', 'In Trabzon'], ok: 0 },
  { q: 'Welches Meer liegt im Norden der Türkei?', a: ['Das Schwarze Meer', 'Das Rote Meer', 'Die Ostsee'], ok: 0 },
  { q: 'Wie sagt man „Danke“ auf Türkisch?', a: ['Teşekkür ederim', 'Merhaba', 'Güle güle'], ok: 0 },
  { q: 'Wer gründete 1923 die Republik Türkei?', a: ['Mustafa Kemal Atatürk', 'Sultan Süleyman', 'Orhan Pamuk'], ok: 0 },
  { q: 'In welcher Stadt steht die Hagia Sophia?', a: ['Istanbul', 'Ankara', 'Bursa'], ok: 0 },
  { q: 'Aus welcher Stadt kommt der Fußballverein Galatasaray?', a: ['Istanbul', 'Izmir', 'Adana'], ok: 0 },
  { q: 'Was heißt „Merhaba“?', a: ['Hallo', 'Tschüss', 'Prost'], ok: 0 },
  { q: 'Woraus besteht Baklava vor allem?', a: ['Blätterteig, Nüssen und Sirup', 'Reis und Hackfleisch', 'Joghurt und Gurke'], ok: 0 },
];

const RUNDEN = 10, NOETIG = 7, ZEIT = 15000;
const RICHTIG = ['Hm. Richtig.', 'Okay, okay. Stimmt.', 'Glück gehabt, Bruder.', 'Mein Cousin wusste das nicht.'];
const FALSCH = ['HA! Falsch!', 'Nein, Bruder. Nein.', 'Meine Oma weint gerade.', 'Das war so falsch, das tut weh.'];

export class QuizScene extends Phaser.Scene {
  private cfg!: QuizData;
  private wasRunning = false;
  private fragen: Frage[] = [];
  private nr = 0;
  private richtig = 0;
  private bis = 0;
  private offen = false;
  private ui?: Phaser.GameObjects.Container;
  private bar!: Phaser.GameObjects.Rectangle;
  private stand!: Phaser.GameObjects.Text;
  private spruch!: Phaser.GameObjects.Text;
  private bustImg!: Phaser.GameObjects.Image;
  private keyAct: ((i: number) => void) | null = null;

  constructor() {
    super('Quiz');
  }

  create(data: QuizData) {
    audio.zwischen(this, 'quiz');
    this.cfg = data;
    this.wasRunning = state.running;
    state.running = false;
    this.scene.bringToTop();
    this.add.rectangle(0, 0, W, H, 0x0c0806, 0.9).setOrigin(0);
    this.add.rectangle(W / 2, H / 2, W - 40, H - 30, 0x1a1210).setStrokeStyle(2, 0xc9a24a);
    txt(this, 34, 24, 'TUNCAYS TÜRKEI-QUIZ', '#f0c030', 16);
    this.stand = txt(this, 34, 48, '', '#a89878');
    this.bustImg = this.add.image(W - 70, H - 22, 'nbust_tuncay').setOrigin(0.5, 1).setScale(0.62);
    this.spruch = txt(this, W - 70, 70, '', '#f0d090').setOrigin(0.5).setWordWrapWidth(120).setAlign('center');
    this.add.rectangle(34, 42, 300, 4, 0x3a2a1e).setOrigin(0);
    this.bar = this.add.rectangle(34, 42, 300, 4, 0xd8b050).setOrigin(0);
    const kb = this.input.keyboard!;
    ['ONE', 'TWO', 'THREE'].forEach((k, i) => kb.on(`keydown-${k}`, () => this.keyAct?.(i)));
    kb.on('keydown-ESC', () => this.close(false));
    this.start();
    this.cameras.main.fadeIn(150);
  }

  private start() {
    this.fragen = Phaser.Utils.Array.Shuffle([...FRAGEN]).slice(0, RUNDEN);
    this.nr = 0;
    this.richtig = 0;
    this.spruch.setText('Zehn Fragen. Sieben richtig, dann reden wir.');
    this.bustImg.setTexture('nbust_tuncay');
    this.time.delayedCall(900, () => this.frage());
  }

  private frage() {
    this.ui?.destroy();
    const f = this.fragen[this.nr];
    const order = Phaser.Utils.Array.Shuffle([0, 1, 2]);
    const box = this.add.container(0, 0);
    this.ui = box;
    this.stand.setText(`Frage ${this.nr + 1}/${RUNDEN} · richtig: ${this.richtig}`);
    box.add(txt(this, 34, 66, f.q, '#f4ead0').setWordWrapWidth(300));
    order.forEach((ai, i) => {
      const b = new Btn(this, 34 + 150, 120 + i * 30, 300, 22, `${i + 1}  ${f.a[ai]}`, 0x3a3040, () => this.antwort(ai === f.ok, b));
      box.add(b.box);
    });
    this.keyAct = (i) => { if (this.offen) this.antwort(order[i] === f.ok); };
    this.offen = true;
    this.bis = this.time.now + ZEIT;
  }

  update() {
    if (!this.offen) return;
    const rest = Math.max(0, this.bis - this.time.now);
    this.bar.width = 300 * (rest / ZEIT);
    this.bar.fillColor = rest < 4000 ? 0xd65a48 : 0xd8b050;
    if (rest === 0) this.antwort(false);
  }

  private antwort(ok: boolean, btn?: Btn) {
    if (!this.offen) return;
    this.offen = false;
    this.keyAct = null;
    if (ok) this.richtig++;
    btn?.setColor(ok ? 0x2e7a3a : 0xa03020);
    audio.sfx(ok ? 'chime' : 'error');
    this.spruch.setText(Phaser.Utils.Array.GetRandom(ok ? RICHTIG : FALSCH));
    this.bustImg.setTexture(ok ? 'nbust_tuncaySad' : 'nbust_tuncay');
    this.stand.setText(`Frage ${this.nr + 1}/${RUNDEN} · richtig: ${this.richtig}`);
    this.time.delayedCall(1000, () => {
      this.nr++;
      if (this.nr < RUNDEN) this.frage();
      else this.ende();
    });
  }

  private ende() {
    this.ui?.destroy();
    const win = this.richtig >= NOETIG;
    const box = this.add.container(0, 0);
    this.ui = box;
    box.add(txt(this, 34, 80, win ? `${this.richtig} von ${RUNDEN}. Du hast gewonnen.` : `${this.richtig} von ${RUNDEN}. Zu wenig.`, win ? '#9ae09a' : '#ff8a6a', 16));
    this.spruch.setText(win ? 'Okay. Abgemacht ist abgemacht.' : `Ab ${NOETIG} reden wir. Lern mal was.`);
    this.bustImg.setTexture(win ? 'nbust_tuncaySad' : 'nbust_tuncay');
    audio.sfx(win ? 'kaching' : 'refuse');
    if (win) {
      box.add(new Btn(this, 34 + 75, 140, 150, 22, 'WEITER', 0xa8342a, () => this.close(true)).box);
      this.keyAct = () => this.close(true);
    } else {
      box.add(new Btn(this, 34 + 75, 140, 150, 22, 'NOCHMAL', 0xa8342a, () => { this.ui?.destroy(); this.start(); }).box);
      box.add(new Btn(this, 34 + 235, 140, 130, 22, 'AUFHÖREN', 0x3a3040, () => this.close(false)).box);
    }
  }

  private close(win: boolean) {
    state.running = this.wasRunning;
    const { resume, onDone } = this.cfg;
    this.scene.resume(resume);
    this.scene.stop();
    onDone?.(win);
  }
}
