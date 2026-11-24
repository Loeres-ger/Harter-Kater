// Musik und Soundeffekte.
// Die Musik jeder Szene ist ein eigenes Stück, gerendert mit tools/music (Orchester-Samples und selbstgebaute
// Instrumente, siehe stuecke.py) und als Schleife in public/music/ abgelegt. Nur Nicks Keller (der Metal-Song und
// das Gitarrenduell) läuft live im Synth, weil die Noten des Duells genau auf seinen Takt fallen: dafür gibt es
// einen eigenen Gitarrenverstärker (Verzerrung, Box, Lead mit Echo) und ein Metal-Schlagzeug.
// Soundeffekte: gerendert mit tools/music/geraeusche.py (Aufnahmen und Orchester) in public/sfx/; was dort fehlt, spielt
// der Synth. Im Sound-Studio (recorder.html) aufgenommene Sounds liegen in public/sounds/ und gehen allem vor.

type Wave = OscillatorType;
import { CLEAN_LOOP, KELLER_BPM, KELLER_LOOP, SONG_BARS, SongSpieler, spieleSchritt } from './music/kellerSong';
import { GERAEUSCHE } from './music/geraeuschDateien';
import { MUSIK_LAENGE } from './music/musikDateien';

/** Gerenderte Stücke: Dateien (eine je Phase, gleich lang und im Takt) und die feste Phase, sonst gilt audio.stufe */
const STUECK = {
  titel: { dateien: ['titel'] }, prolog: { dateien: ['prolog'] }, epilog: { dateien: ['epilog'] }, verloren: { dateien: ['verloren'] },
  kneipe: { dateien: ['kneipe'] }, tresen: { dateien: ['tresen'] }, wc: { dateien: ['wc'] }, laden: { dateien: ['laden'] },
  gasse: { dateien: ['gasse'] }, strasse: { dateien: ['strasse'] }, dach: { dateien: ['dach'] }, romantik: { dateien: ['romantik'] },
  club: { dateien: ['club'] }, kampf: { dateien: ['kampf'] }, pruegel: { dateien: ['pruegel'] }, galopp: { dateien: ['galopp'] },
  quiz: { dateien: ['quiz'] }, pc: { dateien: ['pc'] }, marsch: { dateien: ['marsch'] }, ritual: { dateien: ['ritual'] },
  spannung: { dateien: ['spannung'] }, traurig: { dateien: ['traurig'] }, erloesung: { dateien: ['erloesung'] }, monster: { dateien: ['monster'] },
  basar: { dateien: ['basar'] }, putzen: { dateien: ['putzen'] }, probe: { dateien: ['probe'] }, kanal: { dateien: ['kanal'] }, schleuse: { dateien: ['schleuse'] },
  shisha: { dateien: ['shisha_p1', 'shisha_p2'], phase: 1 },
  shishaDuell: { dateien: ['shisha_p1', 'shisha_p2'], phase: 2 },
  hoelle: { dateien: ['hoelle_p1', 'hoelle_p2', 'hoelle_p3'] },
  klaerwerk: { dateien: ['klaerwerk_p1', 'klaerwerk_p2', 'klaerwerk_p3'] },
  // Nicks Keller: mit audio.synthRendern() aus dem Synth vorgerendert (läuft so auch auf dem Handy ohne Aussetzer)
  keller: { dateien: ['keller'] }, kellerClean: { dateien: ['kellerClean'] },
} satisfies Record<string, { dateien: string[]; phase?: number }>;
type Stueck = keyof typeof STUECK;
type SynthTrack = 'keller' | 'kellerClean' | 'duell';
export type Track = Stueck | SynthTrack | 'none';
const istStueck = (t: Track): t is Stueck => t in STUECK;
/** so viele dekodierte Dateien bleiben im Speicher (eine Minute Stereo sind gut 20 MB) */
const PUFFER_MAX = 5;
export const SFX_NAMES = [
  'click', 'coin', 'kaching', 'error', 'step', 'glug', 'lighter', 'refuse', 'sting', 'chime',
  'thud', 'slap', 'siren', 'bell', 'phone', 'splash', 'thunder', 'rumble', 'roar', 'growl',
  'meow', 'chomp', 'rummage', 'clang', 'blip', 'scream', 'gameover', 'angry', 'retch', 'puke', 'gurgle', 'fart',
  'patzer', 'stab', 'whoosh', 'crack', 'demon', 'zisch', 'glocke',
] as const;
export type Sfx =
  | 'click' | 'coin' | 'kaching' | 'error' | 'step' | 'glug' | 'lighter' | 'refuse' | 'sting' | 'chime'
  | 'thud' | 'slap' | 'siren' | 'bell' | 'phone' | 'splash' | 'thunder' | 'rumble' | 'roar' | 'growl'
  | 'meow' | 'chomp' | 'rummage' | 'clang' | 'blip' | 'scream' | 'gameover' | 'angry'
  | 'retch' | 'puke' | 'gurgle' | 'fart'
  | 'patzer' | 'stab' | 'whoosh' | 'crack' | 'demon' | 'zisch' | 'glocke';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** Verzerrungskurve (weiches Clipping, je größer k, desto mehr Zerre) */
function zerre(k: number) {
  const n = 2048, curve = new Float32Array(n), deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

class AudioEngine implements SongSpieler {
  private ctx: AudioContext | null = null;
  /** Gitarrenverstärker: verzerrt, clean, Lead mit Echo */
  private gtrBus!: GainNode;
  private cleanBus!: GainNode;
  private leadBus!: GainNode;
  private leadClean!: GainNode;
  /** Bossmusik: wie viele Schichten (1–3); blendet bei mehrphasigen Stücken über */
  private stufeWert = 1;
  get stufe() {
    return this.stufeWert;
  }
  set stufe(n: number) {
    this.stufeWert = n;
    this.phaseSetzen();
  }
  private master!: GainNode;
  private musicBus!: GainNode;
  /** gerenderte Stücke */
  private stueckBus!: GainNode;
  private laufend: { track: Stueck; aus: GainNode; quellen: AudioBufferSourceNode[]; phasen: GainNode[] } | null = null;
  private puffer = new Map<string, Promise<AudioBuffer | null>>();
  /** fertig dekodierte Dateien (für den sofortigen Start des Gitarrenduells) */
  private fertig = new Map<string, AudioBuffer>();
  /** der Song des Gitarrenduells, als Datei gespielt */
  private song: { src: AudioBufferSourceNode; aus: GainNode } | null = null;
  private endung: 'ogg' | 'mp4' = 'ogg';
  private sfxBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private rain: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wantRain = false;
  muted = false;

  private track: Track = 'none';
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  private listeners: ((muted: boolean) => void)[] = [];
  /** aufgenommene Sounds aus public/sounds/ */
  private recorded = new Map<string, AudioBuffer>();
  private recordedLoaded = false;
  /** gerenderte Soundeffekte aus public/sfx/ */
  private gerendert = new Map<string, AudioBuffer>();
  private gerendertGeladen = false;

  /** Muss aus einer Nutzeraktion (Klick/Tipp) heraus aufgerufen werden. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.aufbauen(this.ctx);
      this.endung = document.createElement('audio').canPlayType('audio/ogg; codecs="opus"') ? 'ogg' : 'mp4';
    }
    if (!this.recordedLoaded) this.loadRecorded();
    if (!this.gerendertGeladen) this.ladeGeraeusche();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (istStueck(this.track) && !this.laufend) void this.spieleStueck(this.track);
    else if (this.track !== 'none' && !istStueck(this.track) && this.timer === null) this.startSequencer();
    this.setRain(this.wantRain);
  }

  /** Master, Busse, Verstärker und Rauschen anlegen (auch für das Offline-Rendern der Keller-Songs) */
  private aufbauen(c: AudioContext, musik = 0.32, master = this.muted ? 0 : 0.7) {
    this.master = c.createGain();
    this.master.gain.value = master;
    this.master.connect(c.destination);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = musik;
    this.musicBus.connect(this.master);
    this.stueckBus = c.createGain();
    this.stueckBus.gain.value = 0.5;
    this.stueckBus.connect(this.master);
    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = 0.85;
    this.sfxBus.connect(this.master);
    this.amps(c);
    // 2 Sekunden weißes Rauschen als Grundlage für Regen, Hi-Hats, Donner …
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /** Werkstatt: einen Synth-Song offline in einen Puffer rendern. Daraus entstehen public/music/keller, kellerClean
   *  und duell (Pegel so, dass sie über den Stück-Bus genauso laut sind wie live). Schleifen bekommen ihren
   *  Nachhall auf den Anfang gelegt, damit sie nahtlos laufen; das Duell behält ihn am Ende. */
  async synthRendern(track: SynthTrack): Promise<AudioBuffer> {
    const def = TRACKS[track], step = 60 / def.bpm / 4, steps = def.bars * 16, sr = 44100;
    const len = Math.round(steps * step * sr), tail = 4 * sr;
    const off = new OfflineAudioContext(2, len + tail, sr);
    const e = new AudioEngine();
    e.ctx = off as unknown as AudioContext;
    e.aufbauen(e.ctx, (track === 'duell' ? 0.42 : 0.32) / 0.5, 1);
    for (let s = 0; s < steps; s++) def.play(e, s, s * step + (def.swing && s % 2 === 1 ? step * def.swing : 0), step);
    const buf = await off.startRendering();
    if (def.once) return buf;
    const out = new AudioBuffer({ numberOfChannels: 2, length: len, sampleRate: sr });
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch), o = d.slice(0, len);
      for (let i = 0; i < tail; i++) o[i] += d[len + i];
      out.copyToChannel(o, ch);
    }
    return out;
  }

  /** Lädt alle im Sound-Studio aufgenommenen Sounds (fehlende Dateien werden ignoriert). */
  async loadRecorded() {
    if (!this.ctx) return;
    this.recordedLoaded = true;
    this.recorded.clear();
    try {
      const res = await fetch(`./sounds/manifest.json?${Date.now()}`);
      if (!res.ok) return;
      const names: string[] = await res.json();
      await Promise.all(
        names.map(async (n) => {
          const r = await fetch(`./sounds/${n}.wav?${Date.now()}`);
          if (r.ok) this.recorded.set(n, await this.ctx!.decodeAudioData(await r.arrayBuffer()));
        }),
      );
    } catch {
      /* keine Aufnahmen – Synth-Sounds bleiben */
    }
  }

  /** Lädt die gerenderten Soundeffekte (klein, alle auf einmal; fehlende bleiben beim Synth). */
  private ladeGeraeusche() {
    this.gerendertGeladen = true;
    for (const n of GERAEUSCHE) {
      void this.datei(`./sfx/${n}`).then((b) => b && this.gerendert.set(n, b));
    }
  }

  /** Datei holen und dekodieren: bevorzugt Opus (.ogg), sonst AAC (.mp4) */
  private datei(pfad: string): Promise<AudioBuffer | null> {
    const hole = async (endung: string) => {
      const r = await fetch(`${pfad}.${endung}`);
      if (!r.ok) throw new Error(pfad);
      return this.ctx!.decodeAudioData(await r.arrayBuffer());
    };
    return hole(this.endung).catch(() => hole(this.endung === 'ogg' ? 'mp4' : 'ogg')).catch(() => null);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    this.listeners.forEach((l) => l(this.muted));
  }

  onMuteChange(l: (muted: boolean) => void) {
    this.listeners.push(l);
  }

  /** Verstärkerkette: Hochpass → Zerre → Mitten → Box-Tiefpass; Lead mit weniger Zerre und Echo */
  private amps(c: AudioContext) {
    const filter = (type: BiquadFilterType, freq: number, q = 0.7, gain = 0) => {
      const b = c.createBiquadFilter();
      b.type = type; b.frequency.value = freq; b.Q.value = q; b.gain.value = gain;
      return b;
    };
    const shaper = (k: number) => { const w = c.createWaveShaper(); w.curve = zerre(k); w.oversample = '4x'; return w; };
    const gain = (v: number) => { const g = c.createGain(); g.gain.value = v; return g; };
    this.gtrBus = gain(1.6);
    this.gtrBus.connect(filter('highpass', 90)).connect(shaper(360)).connect(filter('peaking', 1700, 0.9, 4)).connect(filter('lowpass', 5200, 0.8)).connect(gain(0.2)).connect(this.musicBus);
    this.cleanBus = gain(1);
    this.cleanBus.connect(filter('lowpass', 3200)).connect(gain(0.55)).connect(this.musicBus);
    // Lead: Zerre, Box, dann trocken und mit Echo
    this.leadBus = gain(1.2);
    const leadOut = gain(0.2);
    this.leadBus.connect(filter('highpass', 200)).connect(shaper(140)).connect(filter('lowpass', 6200, 1)).connect(leadOut);
    leadOut.connect(this.musicBus);
    const delay = c.createDelay(1);
    delay.delayTime.value = (60 / KELLER_BPM) * 0.75;
    const fb = gain(0.32), wet = gain(0.3);
    leadOut.connect(delay); delay.connect(fb).connect(delay); delay.connect(wet).connect(this.musicBus);
    this.leadClean = gain(0.7);
    this.leadClean.connect(filter('lowpass', 4000)).connect(this.musicBus);
    this.leadClean.connect(delay);
  }

  // ---------------------------------------------------------------- Metal-Bausteine (siehe music/kellerSong.ts)

  /** Powerchord (Grundton, Quinte, Oktave). Gedämpft: kurz und dumpf (Palm-Mute). clean: ohne Verzerrung. */
  gtr(note: number, t: number, dur: number, vol: number, muted = false, clean = false) {
    const c = this.ctx;
    if (!c) return;
    const out = c.createGain();
    let dest: AudioNode = clean ? this.cleanBus : this.gtrBus;
    if (muted) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = clean ? 900 : 650;
      lp.connect(dest);
      dest = lp;
    }
    const v = clean ? vol * 0.9 : vol;
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(v, t + 0.004);
    const end = muted ? t + Math.min(dur, 0.11) : t + dur;
    if (!muted) out.gain.setValueAtTime(v * 0.8, t + Math.max(0.01, dur * 0.75));
    out.gain.exponentialRampToValueAtTime(0.0001, end);
    out.connect(dest);
    const ivs: [number, number][] = muted ? [[0, -5], [7, 6]] : [[0, -6], [7, 5], [12, 3]];
    for (const [iv, det] of ivs) {
      const o = c.createOscillator();
      o.type = clean ? 'triangle' : 'sawtooth';
      o.frequency.value = midi(note + iv);
      o.detune.value = det;
      o.connect(out);
      o.start(t);
      o.stop(end + 0.05);
    }
  }

  /** Lead-Gitarre: leicht verstimmte Säge und Rechteck, Vibrato auf langen Tönen */
  lead(note: number, t: number, dur: number, vol: number, clean = false) {
    const c = this.ctx;
    if (!c) return;
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    out.gain.setValueAtTime(vol * 0.85, t + Math.max(0.01, dur * 0.8));
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    out.connect(clean ? this.leadClean : this.leadBus);
    for (const [type, det] of [['sawtooth', -4], ['square', 5]] as const) {
      const o = c.createOscillator();
      o.type = clean ? 'triangle' : type;
      o.frequency.setValueAtTime(midi(note), t);
      o.detune.value = det;
      if (dur > 0.3) {
        const lfo = c.createOscillator(), lg = c.createGain();
        lfo.frequency.value = 5.5;
        lg.gain.setValueAtTime(0, t);
        lg.gain.linearRampToValueAtTime(midi(note) * 0.012, t + Math.min(0.5, dur * 0.6));
        lfo.connect(lg).connect(o.frequency);
        lfo.start(t);
        lfo.stop(t + dur + 0.1);
      }
      o.connect(out);
      o.start(t);
      o.stop(t + dur + 0.1);
    }
  }

  bass(note: number, t: number, dur: number, vol: number) {
    const c = this.ctx;
    if (!c) return;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520;
    lp.connect(this.musicBus);
    this.tone('square', midi(note), t, Math.max(0.08, dur), vol, lp);
    this.tone('sine', midi(note), t, Math.max(0.08, dur), vol * 0.8, this.musicBus);
  }

  kickM(t: number, vol = 0.42) {
    this.tone('sine', 165, t, 0.16, vol, this.musicBus, { slide: 42 });
    this.noise(t, 0.012, vol * 0.5, this.musicBus, 'highpass', 3000);
  }
  snareM(t: number, vol = 0.2) {
    this.noise(t, 0.16, vol, this.musicBus, 'bandpass', 2100);
    this.tone('triangle', 196, t, 0.07, vol * 0.8, this.musicBus, { slide: 150 });
  }
  crash(t: number, vol = 0.07) {
    this.noise(t, 1.5, vol, this.musicBus, 'highpass', 5200);
    this.noise(t, 0.6, vol * 0.7, this.musicBus, 'bandpass', 8000, 4000);
  }
  tom(note: number, t: number, vol = 0.3) {
    this.tone('sine', midi(note - 12), t, 0.22, vol, this.musicBus, { slide: midi(note - 19) });
    this.noise(t, 0.04, vol * 0.25, this.musicBus, 'lowpass', 1200);
  }
  /** Chor „Aaah“: verstimmte Sägezähne durch einen Formant-Filter */
  chor(note: number, t: number, dur: number, vol: number) {
    const c = this.ctx;
    if (!c) return;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 820;
    bp.Q.value = 2.2;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    bp.connect(lp).connect(this.musicBus);
    for (const det of [-14, 0, 13]) this.tone('sawtooth', midi(note), t, dur, vol, bp, { attack: Math.min(0.6, dur * 0.3), detune: det, vibrato: 2 });
  }

  /** Verzögerung bis zum Lautsprecher (Bluetooth-Kopfhörer!), damit Noten und Ton zusammenpassen */
  latenz() {
    const c = this.ctx as (AudioContext & { outputLatency?: number }) | null;
    return c ? Math.min(0.35, c.outputLatency || c.baseLatency || 0) : 0;
  }

  /** aktuelle Zeit der Audio-Uhr (Sekunden) */
  now() {
    return this.ctx?.currentTime ?? 0;
  }
  get bereit() {
    return !!this.ctx && this.ctx.state === 'running';
  }
  /** Song von vorne starten, ohne Einblenden; liefert die Audio-Zeit von Schritt 0 */
  startSong(track: Track): number | null {
    if (!this.ctx) return null;
    this.track = track;
    this.step = 0;
    this.stueckAus(0.3);
    const now = this.ctx.currentTime;
    this.stopSequencer();
    // vorgerendert als Datei: keine Rechenlast, keine Aussetzer (auf dem Handy wichtig)
    const buf = this.fertig.get(track);
    if (buf) {
      const n = MUSIK_LAENGE[track], extra = n ? buf.duration - n / 44100 : 0;
      const src = this.ctx.createBufferSource();
      const aus = this.ctx.createGain();
      src.buffer = buf;
      src.connect(aus).connect(this.stueckBus);
      const start = now + 0.3;
      src.start(start, extra > 0.005 ? Math.min(extra, 1024 / 44100) : 0);
      this.song = { src, aus };
      return start;
    }
    this.musicBus.gain.cancelScheduledValues(now);
    this.musicBus.gain.setValueAtTime(0.42, now);
    this.nextTime = now + 0.3;
    const start = this.nextTime;
    this.timer = window.setInterval(() => this.schedule(), 25);
    return start;
  }
  /** Audio-Uhr anhalten/fortsetzen (Pause im Rhythmusspiel: Musik und Noten bleiben im Takt) */
  anhalten() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }
  weiter() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ---------------------------------------------------------------- Bausteine

  private tone(type: Wave, freq: number, t: number, dur: number, vol: number, bus: AudioNode, o: { attack?: number; slide?: number; detune?: number; vibrato?: number } = {}) {
    const c = this.ctx;
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    if (o.detune) osc.detune.value = o.detune;
    if (o.vibrato) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = o.vibrato;
      lfo.connect(lg).connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    const a = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(bus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(t: number, dur: number, vol: number, bus: AudioNode, filter: BiquadFilterType = 'lowpass', freq = 2000, freqEnd?: number) {
    const c = this.ctx;
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  /** Regen als Dauerschleife (Gasse, Straße). */
  setRain(on: boolean) {
    this.wantRain = on;
    if (!this.ctx) return;
    if (on && !this.rain) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1400;
      f.Q.value = 0.4;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.0001;
      gain.gain.exponentialRampToValueAtTime(0.09, this.ctx.currentTime + 1);
      src.connect(f).connect(gain).connect(this.sfxBus);
      src.start();
      this.rain = { src, gain };
    } else if (!on && this.rain) {
      const r = this.rain;
      this.rain = null;
      r.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.3);
      r.src.stop(this.ctx.currentTime + 1.5);
    }
  }

  // ---------------------------------------------------------------- Soundeffekte

  sfx(name: Sfx) {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const rec = this.recorded.get(name);
    const ger = rec ? undefined : this.gerendert.get(name);
    if (rec || ger) {
      const src = c.createBufferSource();
      src.buffer = (rec ?? ger)!;
      // gerenderte Effekte klingen nie zweimal ganz gleich
      if (ger) src.playbackRate.value = 1 + (Math.random() - 0.5) * (name === 'step' ? 0.16 : 0.06);
      src.connect(this.sfxBus);
      src.start();
      return;
    }
    this.sfxSynth(name);
  }

  /** Immer der eingebaute Synth-Sound (zum Vergleichen im Sound-Studio). */
  sfxSynth(name: Sfx) {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const t = c.currentTime + 0.005;
    const B = this.sfxBus;
    switch (name) {
      case 'click': this.tone('square', 660, t, 0.04, 0.12, B); break;
      case 'blip': this.tone('square', 900 + Math.random() * 120, t, 0.02, 0.025, B); break;
      case 'step': this.noise(t, 0.04, 0.06, B, 'lowpass', 700); break;
      case 'coin':
        this.tone('square', 988, t, 0.07, 0.12, B);
        this.tone('square', 1319, t + 0.07, 0.18, 0.12, B);
        break;
      case 'kaching':
        this.noise(t, 0.08, 0.15, B, 'highpass', 4000);
        this.tone('square', 1319, t + 0.03, 0.08, 0.1, B);
        this.tone('square', 1760, t + 0.1, 0.3, 0.1, B);
        break;
      case 'error': this.tone('sawtooth', 130, t, 0.18, 0.12, B); this.tone('sawtooth', 123, t + 0.12, 0.2, 0.12, B); break;
      case 'refuse': this.tone('sawtooth', 110, t, 0.3, 0.14, B, { slide: 90 }); break;
      case 'angry': this.tone('square', 220, t, 0.08, 0.1, B); this.tone('square', 196, t + 0.1, 0.12, 0.1, B); break;
      case 'glug':
        for (let i = 0; i < 3; i++) this.tone('sine', 320 - i * 30, t + i * 0.12, 0.1, 0.18, B, { slide: 140 });
        break;
      case 'lighter':
        this.noise(t, 0.03, 0.2, B, 'highpass', 3000);
        this.noise(t + 0.05, 0.5, 0.06, B, 'bandpass', 1200, 600);
        break;
      case 'sting':
        [45, 51, 56].forEach((n) => this.tone('sawtooth', midi(n), t, 1.1, 0.08, B, { detune: Math.random() * 20 - 10 }));
        this.noise(t, 0.6, 0.08, B, 'lowpass', 400);
        break;
      case 'chime': [72, 76, 79, 84].forEach((n, i) => this.tone('triangle', midi(n), t + i * 0.07, 0.35, 0.12, B)); break;
      case 'thud':
        this.tone('sine', 120, t, 0.35, 0.4, B, { slide: 40 });
        this.noise(t, 0.15, 0.2, B, 'lowpass', 500);
        break;
      case 'slap': this.noise(t, 0.09, 0.35, B, 'bandpass', 2200); break;
      case 'siren':
        for (let i = 0; i < 6; i++) this.tone('square', i % 2 ? 950 : 700, t + i * 0.28, 0.28, 0.08, B, { attack: 0.02 });
        break;
      case 'bell':
        for (const dt of [0, 0.22]) {
          this.tone('triangle', 1568, t + dt, 1.1, 0.12, B);
          this.tone('sine', 2093, t + dt, 0.8, 0.06, B);
        }
        break;
      case 'phone':
        for (let i = 0; i < 10; i++) this.tone('square', i % 2 ? 1700 : 1400, t + i * 0.05, 0.05, 0.06, B);
        break;
      case 'splash': this.noise(t, 0.5, 0.3, B, 'bandpass', 2500, 500); break;
      case 'thunder':
        this.noise(t, 0.15, 0.5, B, 'highpass', 1500);
        this.noise(t + 0.05, 2.4, 0.6, B, 'lowpass', 600, 80);
        this.tone('sine', 55, t, 1.8, 0.3, B, { slide: 30 });
        break;
      case 'rumble':
        this.tone('sawtooth', 48, t, 2, 0.12, B, { vibrato: 6, attack: 0.3 });
        this.noise(t, 2, 0.08, B, 'lowpass', 250);
        break;
      case 'growl':
        this.tone('sawtooth', 70, t, 1.4, 0.18, B, { vibrato: 12, attack: 0.2, slide: 55 });
        this.tone('sawtooth', 73, t, 1.4, 0.12, B, { vibrato: 9, attack: 0.3, slide: 50 });
        break;
      case 'roar':
        this.tone('sawtooth', 110, t, 1.8, 0.3, B, { slide: 40, vibrato: 18, attack: 0.05 });
        this.tone('square', 82, t, 1.8, 0.15, B, { slide: 35, vibrato: 25 });
        this.noise(t, 1.8, 0.35, B, 'lowpass', 1200, 200);
        break;
      case 'meow':
        this.tone('triangle', 700, t, 0.25, 0.1, B, { slide: 480, vibrato: 20 });
        this.tone('triangle', 520, t + 0.22, 0.45, 0.1, B, { slide: 900, vibrato: 30, detune: 40 });
        break;
      case 'chomp':
        this.noise(t, 0.07, 0.3, B, 'lowpass', 900);
        this.tone('sine', 180, t, 0.08, 0.2, B, { slide: 90 });
        break;
      case 'rummage': for (let i = 0; i < 4; i++) this.noise(t + i * 0.09, 0.06, 0.15, B, 'bandpass', 1500 + Math.random() * 1500); break;
      case 'clang':
        this.tone('square', 300, t, 0.3, 0.1, B);
        this.tone('triangle', 1170, t, 0.6, 0.08, B);
        this.noise(t, 0.2, 0.2, B, 'highpass', 2500);
        break;
      case 'retch': // Würgen: tiefes, kehliges Aufbäumen
        this.tone('sawtooth', 95, t, 0.35, 0.22, B, { slide: 140, vibrato: 30, attack: 0.04 });
        this.noise(t, 0.35, 0.18, B, 'bandpass', 500, 900);
        break;
      case 'puke': // Schwall: nasses Rauschen, das plätschernd ausläuft
        this.tone('sawtooth', 130, t, 0.5, 0.16, B, { slide: 70, vibrato: 40 });
        this.noise(t, 1.1, 0.4, B, 'lowpass', 1400, 300);
        for (let i = 0; i < 6; i++) this.noise(t + 0.5 + i * 0.11, 0.08, 0.16, B, 'bandpass', 900 + Math.random() * 1600);
        break;
      case 'gurgle': // Magen und Kehle blubbern
        for (let i = 0; i < 7; i++) this.tone('sine', 140 + Math.random() * 160, t + i * 0.07, 0.08, 0.16, B, { slide: 60 + Math.random() * 80 });
        break;
      case 'fart':
        this.tone('sawtooth', 70, t, 0.7, 0.2, B, { slide: 50, vibrato: 22 });
        this.noise(t, 0.7, 0.12, B, 'lowpass', 260, 120);
        break;
      case 'scream': this.tone('sawtooth', 950, t, 0.6, 0.08, B, { slide: 600, vibrato: 30 }); break;
      case 'patzer': // abgerutschte Saite
        this.noise(t, 0.09, 0.12, B, 'bandpass', 900, 300);
        this.tone('sawtooth', 98, t, 0.12, 0.05, B, { slide: 82 });
        break;
      case 'stab': this.gtr(40, t, 0.35, 0.18); break;
      case 'whoosh': this.noise(t, 0.45, 0.22, B, 'bandpass', 400, 3000); break;
      case 'crack': // Boden reißt
        this.noise(t, 0.05, 0.4, B, 'highpass', 2000);
        this.noise(t + 0.03, 0.4, 0.25, B, 'lowpass', 900, 120);
        this.tone('sine', 60, t, 0.5, 0.3, B, { slide: 30 });
        break;
      case 'demon': // tiefes, verzerrtes Brüllen
        this.tone('sawtooth', 70, t, 1.4, 0.2, B, { slide: 45, vibrato: 9 });
        this.tone('sawtooth', 104, t, 1.2, 0.12, B, { slide: 70, vibrato: 14 });
        this.noise(t, 1.2, 0.2, B, 'bandpass', 500, 180);
        break;
      case 'zisch': this.noise(t, 0.6, 0.15, B, 'highpass', 4000); break;
      case 'glocke': [0, 0.01].forEach((d, k) => this.tone('sine', k ? 233 : 155, t + d, 2.6, 0.18, B, { detune: k * 9 })); break;
      case 'gameover': [67, 63, 60, 55].forEach((n, i) => this.tone('square', midi(n), t + i * 0.25, 0.3, 0.1, B)); break;
    }
  }

  // ---------------------------------------------------------------- Musik

  /** die Musik, die gerade läuft (oder laufen soll, solange der Ton noch gesperrt ist) */
  get aktuell(): Track {
    return this.track;
  }

  music(track: Track) {
    if (track === this.track) return;
    const vorher = this.track;
    this.track = track;
    this.step = 0;
    if (!this.ctx) return;
    // dasselbe Stück in einer anderen Phase (Shisha ↔ Rauchduell): nur die Schichten überblenden
    if (istStueck(track) && istStueck(vorher) && this.laufend && STUECK[track].dateien === STUECK[vorher].dateien) {
      this.laufend.track = track;
      this.phaseSetzen();
      return;
    }
    this.stueckAus(1.4);
    if (istStueck(track) || track === 'none') {
      this.stopSequencer();
      if (istStueck(track)) void this.spieleStueck(track);
      return;
    }
    // Synth (Keller): kurzes Ausblenden beim Wechsel
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.musicBus.gain.exponentialRampToValueAtTime(0.32, this.ctx.currentTime + 1.2);
    if (this.timer === null) this.startSequencer();
    else this.nextTime = this.ctx.currentTime + 0.05;
  }

  /** Musik für eine eingeblendete Szene (Minispiel über einer anderen). Schließt sie, kommt die vorige zurück,
   *  sofern bis dahin niemand anderes umgeschaltet hat. Liefert die vorige Musik. */
  zwischen(scene: { events: { once(ev: 'shutdown', fn: () => void): unknown } }, track: Track): Track {
    const vorher = this.track;
    this.music(track);
    scene.events.once('shutdown', () => { if (this.track === track) this.music(vorher); });
    return vorher;
  }

  /** eine Musikdatei laden und dekodieren (bevorzugt Opus, sonst AAC); bleibt im Puffer, bis sie verdrängt wird */
  private lade(datei: string): Promise<AudioBuffer | null> {
    let p = this.puffer.get(datei);
    if (p) {
      this.puffer.delete(datei);
      this.puffer.set(datei, p); // zuletzt benutzt nach hinten
      return p;
    }
    const neu = this.datei(`./music/${datei}`);
    p = neu;
    this.puffer.set(datei, neu);
    void neu.then((b) => { if (b && this.puffer.get(datei) === neu) this.fertig.set(datei, b); });
    const behalten = new Set(this.laufend ? STUECK[this.laufend.track].dateien : []);
    for (const k of this.puffer.keys()) {
      if (this.puffer.size <= PUFFER_MAX) break;
      if (k !== datei && !behalten.has(k)) {
        this.puffer.delete(k);
        this.fertig.delete(k);
      }
    }
    return p;
  }

  /** wartet, bis eine Musikdatei geladen ist (z. B. der Song vor dem Gitarrenduell) */
  async ladeDatei(datei: string) {
    if (this.ctx) await this.lade(datei);
  }

  /** Musik für später schon laden (z. B. die nächste Szene) */
  vorladen(track: Track) {
    if (this.ctx && istStueck(track)) for (const d of STUECK[track].dateien) void this.lade(d);
  }

  private async spieleStueck(track: Stueck) {
    const def = STUECK[track];
    const bufs = await Promise.all(def.dateien.map((d) => this.lade(d)));
    const c = this.ctx;
    if (!c || this.track !== track || this.laufend || bufs.some((b) => !b)) return;
    const t0 = c.currentTime + 0.05;
    const aus = c.createGain();
    aus.gain.setValueAtTime(0.0001, t0);
    aus.gain.exponentialRampToValueAtTime(1, t0 + 0.8);
    aus.connect(this.stueckBus);
    const quellen: AudioBufferSourceNode[] = [], phasen: GainNode[] = [];
    bufs.forEach((b, i) => {
      const src = c.createBufferSource();
      src.buffer = b;
      src.loop = true;
      // genau die Länge der Schleife; hat der Decoder vorne Stille vom Encoder gelassen, beginnt sie etwas später
      const n = MUSIK_LAENGE[def.dateien[i]];
      if (n) {
        const len = n / 44100, extra = b!.duration - len;
        src.loopStart = extra > 0.005 ? Math.min(extra, 1024 / 44100) : 0;
        src.loopEnd = src.loopStart + len;
      }
      const g = c.createGain();
      g.gain.value = 0;
      src.connect(g).connect(aus);
      src.start(t0, src.loopStart);
      quellen.push(src);
      phasen.push(g);
    });
    this.laufend = { track, aus, quellen, phasen };
    this.phaseSetzen(true);
  }

  /** bei mehrphasigen Stücken die passende Schicht hörbar machen (gleich lang, laufen im Gleichschritt) */
  private phaseSetzen(sofort = false) {
    const l = this.laufend, c = this.ctx;
    if (!l || !c) return;
    const def: { dateien: string[]; phase?: number } = STUECK[l.track];
    const ph = Math.max(1, Math.min(l.phasen.length, def.phase ?? this.stufeWert));
    l.phasen.forEach((g, i) => {
      const ziel = i + 1 === ph ? 1 : 0;
      g.gain.cancelScheduledValues(c.currentTime);
      if (sofort) g.gain.setValueAtTime(ziel, c.currentTime);
      else g.gain.setTargetAtTime(ziel, c.currentTime, 0.45);
    });
  }

  private stueckAus(sek: number) {
    if (this.song && this.ctx) {
      const s = this.song;
      this.song = null;
      s.aus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, sek / 4);
      s.src.stop(this.ctx.currentTime + sek + 0.05);
    }
    const l = this.laufend, c = this.ctx;
    this.laufend = null;
    if (!l || !c) return;
    l.aus.gain.cancelScheduledValues(c.currentTime);
    l.aus.gain.setValueAtTime(Math.max(0.0001, l.aus.gain.value), c.currentTime);
    l.aus.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + sek);
    for (const q of l.quellen) q.stop(c.currentTime + sek + 0.05);
  }

  private startSequencer() {
    if (!this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private stopSequencer() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private schedule() {
    const c = this.ctx;
    if (!c || this.track === 'none') return;
    if (!(this.track in TRACKS)) return;
    const def = TRACKS[this.track as SynthTrack];
    const stepDur = 60 / def.bpm / 4; // Sechzehntel
    while (this.nextTime < c.currentTime + 0.15) {
      // leichter Swing auf ungeraden Sechzehnteln
      const swing = def.swing && this.step % 2 === 1 ? stepDur * def.swing : 0;
      def.play(this, this.step, this.nextTime + swing, stepDur);
      this.nextTime += stepDur;
      if (def.once && this.step + 1 >= def.bars * 16) {
        this.track = 'none';
        this.stopSequencer();
        return;
      }
      this.step = (this.step + 1) % (def.bars * 16);
    }
  }

  /** Für Tracks: Note spielen. */
  n(type: Wave, note: number, t: number, dur: number, vol: number, o?: { attack?: number; detune?: number; vibrato?: number; slide?: number }) {
    this.tone(type, midi(note), t, dur, vol, this.musicBus, o);
  }
  hat(t: number, vol = 0.05) {
    this.noise(t, 0.03, vol, this.musicBus, 'highpass', 7000);
  }
  snare(t: number, vol = 0.12) {
    this.noise(t, 0.12, vol, this.musicBus, 'bandpass', 1800);
  }
  kick(t: number, vol = 0.4) {
    this.tone('sine', 120, t, 0.18, vol, this.musicBus, { slide: 45 });
  }
}

interface TrackDef {
  bpm: number;
  bars: number;
  swing?: number;
  /** nur einmal (das Duell), danach Stille */
  once?: boolean;
  play: (a: AudioEngine, step: number, t: number, dur: number) => void;
}

const TRACKS: Record<SynthTrack, TrackDef> = {
  // Nicks Keller: der Song im Hintergrund (Intro, Strophe, Refrain), Lead etwas leiser
  keller: {
    bpm: KELLER_BPM,
    bars: KELLER_LOOP.takte,
    play: (a, s, t, d) => spieleSchritt(a, KELLER_LOOP.von * 16 + s, t, d, { leadVol: 0.7 }),
  },
  // Nick in Weiß: derselbe Refrain, clean und gemütlich
  kellerClean: {
    bpm: 112,
    bars: CLEAN_LOOP.takte,
    swing: 0.2,
    play: (a, s, t, d) => spieleSchritt(a, CLEAN_LOOP.von * 16 + s, t, d, { clean: true, leadVol: 0.9 }),
  },
  // Gitarrenduell: der ganze Song, einmal
  duell: {
    bpm: KELLER_BPM,
    bars: SONG_BARS + 2,
    once: true,
    play: (a, s, t, d) => spieleSchritt(a, s, t, d),
  },
};

export const audio = new AudioEngine();
