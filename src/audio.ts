// Musik und Soundeffekte, mit der Web Audio API synthetisiert.
// Im Sound-Studio (recorder.html) aufgenommene Sounds liegen in public/sounds/ und ersetzen den jeweiligen Synth-Sound.

type Wave = OscillatorType;
export type Track = 'title' | 'bar' | 'alley' | 'tension' | 'monster' | 'none';
export const SFX_NAMES = [
  'click', 'coin', 'kaching', 'error', 'step', 'glug', 'lighter', 'refuse', 'sting', 'chime',
  'thud', 'slap', 'siren', 'bell', 'phone', 'splash', 'thunder', 'rumble', 'roar', 'growl',
  'meow', 'chomp', 'rummage', 'clang', 'blip', 'scream', 'gameover', 'angry', 'retch', 'puke', 'gurgle', 'fart',
] as const;
export type Sfx =
  | 'click' | 'coin' | 'kaching' | 'error' | 'step' | 'glug' | 'lighter' | 'refuse' | 'sting' | 'chime'
  | 'thud' | 'slap' | 'siren' | 'bell' | 'phone' | 'splash' | 'thunder' | 'rumble' | 'roar' | 'growl'
  | 'meow' | 'chomp' | 'rummage' | 'clang' | 'blip' | 'scream' | 'gameover' | 'angry'
  | 'retch' | 'puke' | 'gurgle' | 'fart';

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
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

  /** Muss aus einer Nutzeraktion (Klick/Tipp) heraus aufgerufen werden. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.32;
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.85;
      this.sfxBus.connect(this.master);
      // 2 Sekunden weißes Rauschen als Grundlage für Regen, Hi-Hats, Donner …
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (!this.recordedLoaded) this.loadRecorded();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.track !== 'none' && this.timer === null) this.startSequencer();
    this.setRain(this.wantRain);
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

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    this.listeners.forEach((l) => l(this.muted));
  }

  onMuteChange(l: (muted: boolean) => void) {
    this.listeners.push(l);
  }

  // ---------------------------------------------------------------- Bausteine

  private tone(type: Wave, freq: number, t: number, dur: number, vol: number, bus: AudioNode, o: { attack?: number; slide?: number; detune?: number; vibrato?: number } = {}) {
    const c = this.ctx!;
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
    const c = this.ctx!;
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
    if (rec) {
      const src = c.createBufferSource();
      src.buffer = rec;
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
      case 'gameover': [67, 63, 60, 55].forEach((n, i) => this.tone('square', midi(n), t + i * 0.25, 0.3, 0.1, B)); break;
    }
  }

  // ---------------------------------------------------------------- Musik

  music(track: Track) {
    if (track === this.track) return;
    this.track = track;
    this.step = 0;
    if (!this.ctx) return;
    // kurzes Ausblenden beim Wechsel
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.musicBus.gain.exponentialRampToValueAtTime(0.32, this.ctx.currentTime + 1.2);
    if (track === 'none') this.stopSequencer();
    else if (this.timer === null) this.startSequencer();
    else this.nextTime = this.ctx.currentTime + 0.05;
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
    const def = TRACKS[this.track as Exclude<Track, 'none'>];
    const stepDur = 60 / def.bpm / 4; // Sechzehntel
    while (this.nextTime < c.currentTime + 0.15) {
      // leichter Swing auf ungeraden Sechzehnteln
      const swing = def.swing && this.step % 2 === 1 ? stepDur * def.swing : 0;
      def.play(this, this.step, this.nextTime + swing, stepDur);
      this.nextTime += stepDur;
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
  play: (a: AudioEngine, step: number, t: number, dur: number) => void;
}

// Akkorde als MIDI-Grundtöne
const A2 = 45, F2 = 41, C3 = 48, E2 = 40, D3 = 50;

const TRACKS: Record<Exclude<Track, 'none'>, TrackDef> = {
  // Spieluhr, leicht verstimmt: unheimlich
  title: {
    bpm: 76,
    bars: 4,
    play(a, s, t, d) {
      const chords = [[57, 60, 64], [62, 65, 69], [57, 60, 64], [56, 59, 64]];
      const ch = chords[Math.floor(s / 16)];
      const i = s % 16;
      if (i % 2 === 0) a.n('triangle', ch[(i / 2) % 3] + 12, t, d * 3, 0.07, { detune: 12 });
      if (i === 0) a.n('sine', ch[0] - 24, t, d * 16, 0.1, { attack: 0.3 });
      if (i === 8 && s >= 48) a.n('triangle', 76, t, d * 6, 0.05, { vibrato: 4, detune: -25 });
    },
  },
  // Kneipenmusik: Akkordeon-artig, Swing, Am – F – C – E
  bar: {
    bpm: 98,
    bars: 8,
    swing: 0.3,
    play(a, s, t, d) {
      const bar = Math.floor(s / 16) % 4;
      const i = s % 16;
      const root = [A2, F2, C3, E2][bar];
      const third = [3, 4, 4, 4][bar];
      // Bass: Grundton / Quinte
      if (i === 0) a.n('triangle', root, t, d * 3.5, 0.22);
      if (i === 8) a.n('triangle', root + 7, t, d * 3.5, 0.18);
      if (i === 12 && bar === 3) a.n('triangle', root + 4, t, d * 3, 0.16);
      // Nachschlag-Akkorde
      if (i === 4 || i === 12) [12, 12 + third, 19].forEach((x) => a.n('square', root + x, t, d * 1.5, 0.025));
      // Melodie (erste Hälfte Frage, zweite Antwort)
      const mel: (number | null)[][] = [
        [69, null, 72, null, 76, null, 74, 72, null, null, 71, null, 72, null, null, null],
        [69, null, null, 65, null, 69, 72, null, 71, null, 69, null, null, null, null, null],
        [67, null, 72, null, 76, null, 79, null, 77, 76, null, 74, 72, null, null, null],
        [71, null, 68, null, 71, null, 74, null, 76, null, null, null, null, null, null, null],
      ];
      const half = Math.floor(s / 64);
      const m = mel[bar][i];
      if (m && (half === 0 || i % 4 === 0)) a.n('square', m - (half ? 12 : 0), t, d * 1.8, 0.05, { vibrato: 3 });
      // leises Schlagzeug
      if (i === 0 || i === 8) a.kick(t, 0.25);
      if (i === 4 || i === 12) a.snare(t, 0.05);
      if (i % 2 === 0) a.hat(t, 0.025);
    },
  },
  // Gasse: dunkler Drone, vereinzelte Töne mit Echo, Herzschlag
  alley: {
    bpm: 66,
    bars: 4,
    play(a, s, t, d) {
      const i = s % 16;
      if (s % 32 === 0) {
        a.n('sawtooth', 33, t, d * 32, 0.05, { attack: 1.5, vibrato: 0.5 });
        a.n('sawtooth', 40, t, d * 32, 0.03, { attack: 2, detune: 8 });
      }
      if (i === 0 || i === 3) a.kick(t, i === 0 ? 0.18 : 0.12); // Herzschlag
      if (Math.random() < 0.08) {
        const note = [69, 72, 74, 76, 79, 81][Math.floor(Math.random() * 6)];
        a.n('triangle', note, t, d * 4, 0.04);
        a.n('triangle', note, t + d * 3, d * 4, 0.015); // Echo
      }
    },
  },
  // Cutscenes: getragene Moll-Flächen, Pulsieren
  tension: {
    bpm: 60,
    bars: 4,
    play(a, s, t, d) {
      const chords = [[A2, 48, 52], [F2, 48, 53], [D3 - 12, 41, 45], [E2, 44, 47]];
      const bar = Math.floor(s / 16);
      if (s % 16 === 0) chords[bar].forEach((x, k) => a.n('triangle', x + 12, t, d * 16, 0.06, { attack: 0.8, detune: k * 6 }));
      if (s % 4 === 0) a.n('sine', chords[bar][0], t, d * 2, 0.12);
    },
  },
  // Monster: tiefes Dröhnen, metallische Schläge, Tritonus
  monster: {
    bpm: 52,
    bars: 2,
    play(a, s, t, d) {
      if (s % 16 === 0) {
        a.n('sawtooth', 28, t, d * 16, 0.09, { vibrato: 2, attack: 0.5 });
        a.n('sawtooth', 34, t, d * 16, 0.06, { vibrato: 3, attack: 0.8 });
      }
      if (s % 8 === 0) {
        a.kick(t, 0.45);
        a.n('square', 51, t, d * 3, 0.03, { detune: 30 });
      }
      if (s % 16 === 12) a.n('triangle', 87, t, d * 6, 0.025, { vibrato: 10 });
    },
  },
};

export const audio = new AudioEngine();
