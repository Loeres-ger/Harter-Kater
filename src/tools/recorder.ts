// Sound-Studio: Sounds fürs Spiel aufnehmen, zuschneiden, verfremden und speichern.
// Läuft nur im Dev-Server (npm run dev → /recorder.html), gespeichert wird über /__sounds.
import '@fontsource/press-start-2p/latin-400.css';
import { audio, type Sfx } from '../audio';

const SLOTS: { group: string; items: [Sfx, string, string][] }[] = [
  { group: 'Bedienung', items: [
    ['click', 'Klick', 'Jeder Button-Druck.'],
    ['coin', 'Münze', 'Geld aufheben, Gast bezahlt.'],
    ['kaching', 'Kasse', 'Erfolgreicher Kauf im Shop.'],
    ['error', 'Fehler', 'Zu wenig Geld.'],
  ] },
  { group: 'Wirt & Tresen', items: [
    ['step', 'Schritt', 'Jeder Schritt des Wirts. Sehr kurz halten!'],
    ['glug', 'Trinken', 'Dr. von Glanz trinkt etwas.'],
    ['lighter', 'Feuerzeug', 'Er zündet sich eine Kippe an.'],
    ['refuse', 'Ablehnen', 'Er lehnt ein Angebot ab.'],
    ['angry', 'Ungeduld', '„Bedienung!“ – er wartet zu lange.'],
    ['chime', 'Wunsch erfüllt', 'Er bekommt genau, was er wollte.'],
    ['sting', 'Verwahrlosung', 'Er rutscht eine Stufe tiefer.'],
    ['thud', 'Aufprall', 'Jemand fällt um.'],
  ] },
  { group: 'Gasse', items: [
    ['rummage', 'Mülltonne', 'In der Tonne wühlen.'],
    ['clang', 'Entsorgen', 'Etwas landet scheppernd im Müll.'],
    ['slap', 'Ohrfeige', 'Handtasche oder Pfefferspray.'],
    ['siren', 'Sirene', 'Die Polizei hat dich erwischt.'],
    ['meow', 'Katze', 'Das unheimliche Miauen der Pestkatze.'],
    ['scream', 'Schrei', 'NPCs fliehen vor dem Monster.'],
  ] },
  { group: 'Finale', items: [
    ['chomp', 'Schmatzen', 'Die Katze frisst.'],
    ['growl', 'Knurren', 'Die Mutation beginnt.'],
    ['roar', 'Brüllen', 'Das Monster brüllt.'],
    ['gameover', 'Game Over', 'Verloren.'],
  ] },
  { group: 'Cutscenes', items: [
    ['thunder', 'Donner', 'Blitz und Donner.'],
    ['bell', 'Türglocke', 'Jemand betritt die Kneipe.'],
    ['phone', 'Telefon', 'Brenninger ruft an.'],
    ['splash', 'Platschen', 'Handy fällt ins Bier.'],
    ['rumble', 'Bagger', 'Brenningers Bagger rollt an.'],
    ['blip', 'Text-Tippen', 'Bei jedem Buchstaben – extrem kurz halten!'],
  ] },
];

const OUT_RATE = 22050; // reicht für Spiel-Sounds und hält die Dateien klein
const MAX_SECONDS = 6;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  slots: $('slots'), title: $('slotTitle'), badge: $('slotBadge'), desc: $('slotDesc'),
  rec: $<HTMLButtonElement>('recBtn'), meter: $('meter'), time: $('recTime'),
  file: $<HTMLInputElement>('fileIn'), synth: $<HTMLButtonElement>('synthBtn'), saved: $<HTMLButtonElement>('savedBtn'),
  wave: $<HTMLCanvasElement>('wave'), waveEmpty: $('waveEmpty'),
  pitch: $<HTMLInputElement>('pitch'), pitchV: $('pitchV'), vol: $<HTMLInputElement>('vol'), volV: $('volV'),
  play: $<HTMLButtonElement>('playBtn'), save: $<HTMLButtonElement>('saveBtn'), dl: $<HTMLButtonElement>('dlBtn'), del: $<HTMLButtonElement>('delBtn'),
  status: $('status'),
};

let ctx: AudioContext | null = null;
const getCtx = () => (ctx ??= new AudioContext());

let current: Sfx = 'glug';
let saved = new Set<string>();
let raw: AudioBuffer | null = null; // unbearbeitete Aufnahme (mono)
let trim = { start: 0, end: 1 }; // Anteil 0..1
const fx = { reverse: false, crush: false, echo: false, monster: false };
let playing: AudioBufferSourceNode | null = null;
let playStart = 0, playDur = 0;

function status(msg: string, kind: '' | 'ok' | 'err' = '') {
  ui.status.textContent = msg;
  ui.status.className = `status ${kind}`;
}

// ---------------------------------------------------------------- Liste

async function refreshSaved() {
  try {
    const r = await fetch('/__sounds');
    if (r.ok) saved = new Set(await r.json());
  } catch {
    status('Speichern ins Spiel geht nur im Dev-Server (npm run dev). Herunterladen funktioniert trotzdem.', 'err');
  }
  renderSlots();
}

function renderSlots() {
  ui.slots.innerHTML = '';
  for (const g of SLOTS) {
    const h = document.createElement('div');
    h.className = 'group';
    h.textContent = g.group;
    ui.slots.append(h);
    for (const [id, name] of g.items) {
      const b = document.createElement('button');
      b.className = `slot${id === current ? ' active' : ''}${saved.has(id) ? ' has' : ''}`;
      b.innerHTML = `<span class="dot"></span>${name}<small>${saved.has(id) ? 'eigener' : 'Synth'}</small>`;
      b.onclick = () => selectSlot(id);
      ui.slots.append(b);
    }
  }
  const info = SLOTS.flatMap((g) => g.items).find(([id]) => id === current)!;
  ui.title.textContent = info[1].toUpperCase();
  ui.desc.textContent = info[2];
  ui.badge.textContent = saved.has(current) ? '● eigener Sound im Spiel' : '○ Spiel nutzt den Synth-Sound';
  ui.badge.className = `badge${saved.has(current) ? ' has' : ''}`;
  ui.saved.disabled = !saved.has(current);
  ui.del.disabled = !saved.has(current);
}

function selectSlot(id: Sfx) {
  current = id;
  raw = null;
  trim = { start: 0, end: 1 };
  updateButtons();
  drawWave();
  renderSlots();
  status('');
}

function updateButtons() {
  const has = !!raw;
  ui.play.disabled = ui.save.disabled = ui.dl.disabled = !has;
  ui.waveEmpty.style.display = has ? 'none' : 'grid';
}

// ---------------------------------------------------------------- Aufnahme

let recorder: MediaRecorder | null = null;
let recTimer: number | null = null;

async function startRecording() {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch {
    status('Kein Mikrofon-Zugriff. Bitte im Browser erlauben.', 'err');
    return;
  }
  const c = getCtx();
  await c.resume();
  // Pegelanzeige
  const analyser = c.createAnalyser();
  analyser.fftSize = 1024;
  c.createMediaStreamSource(stream).connect(analyser);
  const data = new Float32Array(analyser.fftSize);

  const chunks: Blob[] = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    if (recTimer) cancelAnimationFrame(recTimer);
    ui.meter.style.width = '0%';
    ui.rec.textContent = '● Aufnehmen';
    ui.rec.classList.remove('on');
    const blob = new Blob(chunks, { type: recorder?.mimeType });
    recorder = null;
    await loadAudio(await blob.arrayBuffer(), 'Aufnahme');
  };
  recorder.start();
  ui.rec.textContent = '■ Stopp';
  ui.rec.classList.add('on');
  status('Aufnahme läuft … (max. 6 Sekunden)');
  const t0 = performance.now();
  const tick = () => {
    analyser.getFloatTimeDomainData(data);
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v));
    ui.meter.style.width = `${Math.min(100, peak * 140)}%`;
    const s = (performance.now() - t0) / 1000;
    ui.time.textContent = `${s.toFixed(1).replace('.', ',')} s`;
    if (s >= MAX_SECONDS) recorder?.stop();
    else recTimer = requestAnimationFrame(tick);
  };
  tick();
}

async function loadAudio(bytes: ArrayBuffer, what: string) {
  try {
    const decoded = await getCtx().decodeAudioData(bytes);
    // auf Mono mischen
    const mono = getCtx().createBuffer(1, decoded.length, decoded.sampleRate);
    const out = mono.getChannelData(0);
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
      const d = decoded.getChannelData(ch);
      for (let i = 0; i < d.length; i++) out[i] += d[i] / decoded.numberOfChannels;
    }
    raw = mono;
    autoTrim();
    updateButtons();
    drawWave();
    status(`${what} geladen: ${decoded.duration.toFixed(2).replace('.', ',')} s. Stille am Anfang und Ende wurde abgeschnitten.`, 'ok');
  } catch {
    status('Diese Datei kann ich nicht lesen.', 'err');
  }
}

/** Schneidet Stille am Anfang und Ende ab. */
function autoTrim() {
  if (!raw) return;
  const d = raw.getChannelData(0);
  let peak = 0;
  for (const v of d) peak = Math.max(peak, Math.abs(v));
  const thr = Math.max(0.01, peak * 0.08);
  let a = 0, b = d.length - 1;
  while (a < b && Math.abs(d[a]) < thr) a++;
  while (b > a && Math.abs(d[b]) < thr) b--;
  const margin = raw.sampleRate * 0.03;
  trim = { start: Math.max(0, (a - margin) / d.length), end: Math.min(1, (b + margin * 3) / d.length) };
}

// ---------------------------------------------------------------- Bearbeitung

async function processed(): Promise<AudioBuffer | null> {
  if (!raw) return null;
  const src = raw.getChannelData(0);
  const a = Math.floor(trim.start * src.length), b = Math.ceil(trim.end * src.length);
  let slice = src.slice(a, b);
  if (slice.length < 10) return null;
  if (fx.reverse) slice = slice.reverse();
  // auf Spitzenpegel 0,95 normalisieren
  let peak = 0;
  for (const v of slice) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) slice = slice.map((v) => (v / peak) * 0.95);

  const semis = Number(ui.pitch.value) + (fx.monster ? -7 : 0);
  const rate = Math.pow(2, semis / 12);
  const tail = fx.echo ? 0.7 : 0;
  const outLen = Math.ceil(((slice.length / raw.sampleRate) / rate + tail) * OUT_RATE);
  const off = new OfflineAudioContext(1, outLen, OUT_RATE);
  const buf = off.createBuffer(1, slice.length, raw.sampleRate);
  buf.copyToChannel(slice, 0);
  const node = off.createBufferSource();
  node.buffer = buf;
  node.playbackRate.value = rate;
  const gain = off.createGain();
  gain.gain.value = Number(ui.vol.value) / 100;
  let chain: AudioNode = node;
  if (fx.monster) {
    // Verzerrung für ein raues Monster-Grollen
    const shaper = off.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / curve.length) * 2 - 1;
      curve[i] = Math.tanh(x * 4);
    }
    shaper.curve = curve;
    chain.connect(shaper);
    chain = shaper;
  }
  chain.connect(gain).connect(off.destination);
  if (fx.echo) {
    const delay = off.createDelay(1);
    delay.delayTime.value = 0.16;
    const fb = off.createGain();
    fb.gain.value = 0.38;
    gain.connect(delay).connect(fb).connect(delay);
    delay.connect(off.destination);
  }
  node.start();
  const out = await off.startRendering();
  const d = out.getChannelData(0);
  if (fx.crush) {
    // 8-Bit: Abtastrate grob halten, Pegel auf wenige Stufen runden
    let hold = 0;
    for (let i = 0; i < d.length; i++) {
      if (i % 4 === 0) hold = Math.round(d[i] * 8) / 8;
      d[i] = hold;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] = Math.max(-1, Math.min(1, d[i]));
  return out;
}

function encodeWav(b: AudioBuffer): Blob {
  const d = b.getChannelData(0);
  const view = new DataView(new ArrayBuffer(44 + d.length * 2));
  const str = (o: number, s: string) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, 36 + d.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, b.sampleRate, true);
  view.setUint32(28, b.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) view.setInt16(44 + i * 2, Math.round(d[i] * 32767), true);
  return new Blob([view], { type: 'audio/wav' });
}

// ---------------------------------------------------------------- Wellenform

function drawWave(playPos = -1) {
  const cv = ui.wave, g = cv.getContext('2d')!;
  const W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  if (!raw) return;
  const d = raw.getChannelData(0);
  const step = Math.max(1, Math.floor(d.length / W));
  g.fillStyle = '#9ae09a';
  for (let x = 0; x < W; x++) {
    let min = 1, max = -1;
    for (let i = x * step; i < (x + 1) * step && i < d.length; i++) {
      min = Math.min(min, d[i]);
      max = Math.max(max, d[i]);
    }
    const y1 = ((1 - max) / 2) * H, y2 = ((1 - min) / 2) * H;
    g.fillRect(x, y1, 1, Math.max(1, y2 - y1));
  }
  // weggeschnittene Bereiche abdunkeln
  g.fillStyle = 'rgba(10,8,6,0.75)';
  g.fillRect(0, 0, trim.start * W, H);
  g.fillRect(trim.end * W, 0, W - trim.end * W, H);
  // Griffe
  g.fillStyle = '#f0c030';
  for (const p of [trim.start, trim.end]) {
    g.fillRect(p * W - 3, 0, 6, H);
    g.fillRect(p * W - 12, H / 2 - 20, 24, 40);
  }
  if (playPos >= 0) {
    g.fillStyle = '#ffffff';
    g.fillRect(playPos * W, 0, 3, H);
  }
}

let dragging: 'start' | 'end' | null = null;
ui.wave.addEventListener('pointerdown', (e) => {
  if (!raw) return;
  const p = e.offsetX / ui.wave.clientWidth;
  dragging = Math.abs(p - trim.start) < Math.abs(p - trim.end) ? 'start' : 'end';
  ui.wave.setPointerCapture(e.pointerId);
  moveHandle(p);
});
ui.wave.addEventListener('pointermove', (e) => dragging && moveHandle(e.offsetX / ui.wave.clientWidth));
ui.wave.addEventListener('pointerup', () => (dragging = null));
function moveHandle(p: number) {
  p = Math.max(0, Math.min(1, p));
  if (dragging === 'start') trim.start = Math.min(p, trim.end - 0.01);
  if (dragging === 'end') trim.end = Math.max(p, trim.start + 0.01);
  drawWave();
}

// ---------------------------------------------------------------- Abspielen

function playBuffer(b: AudioBuffer, showHead: boolean) {
  const c = getCtx();
  c.resume();
  playing?.stop();
  const src = c.createBufferSource();
  src.buffer = b;
  src.connect(c.destination);
  src.start();
  playing = src;
  if (!showHead) return;
  playStart = c.currentTime;
  playDur = b.duration;
  // Abspielkopf grob über den zugeschnittenen Bereich laufen lassen
  const anim = () => {
    if (playing !== src) return drawWave();
    const f = (c.currentTime - playStart) / playDur;
    if (f >= 1) return drawWave();
    drawWave(trim.start + (fx.reverse ? 1 - f : f) * (trim.end - trim.start));
    requestAnimationFrame(anim);
  };
  anim();
}

async function preview() {
  const b = await processed();
  if (b) playBuffer(b, true);
}

// ---------------------------------------------------------------- Knöpfe

ui.rec.onclick = () => (recorder ? recorder.stop() : startRecording());
ui.file.onchange = async () => {
  const f = ui.file.files?.[0];
  if (f) await loadAudio(await f.arrayBuffer(), `„${f.name}“`);
  ui.file.value = '';
};
ui.synth.onclick = () => {
  audio.unlock();
  setTimeout(() => audio.sfxSynth(current), 30);
};
ui.saved.onclick = async () => {
  const r = await fetch(`/sounds/${current}.wav?${Date.now()}`);
  if (r.ok) playBuffer(await getCtx().decodeAudioData(await r.arrayBuffer()), false);
};
ui.play.onclick = preview;
ui.save.onclick = async () => {
  const b = await processed();
  if (!b) return;
  try {
    const r = await fetch(`/__sounds/${current}`, { method: 'POST', body: encodeWav(b) });
    if (!r.ok) throw new Error();
    saved = new Set(await r.json());
    renderSlots();
    status(`Gespeichert als public/sounds/${current}.wav – das Spiel nutzt ihn ab dem nächsten Neuladen.`, 'ok');
  } catch {
    status('Speichern ging nicht (läuft der Dev-Server?). Lade die WAV herunter und lege sie selbst in public/sounds/ ab.', 'err');
  }
};
ui.dl.onclick = async () => {
  const b = await processed();
  if (!b) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(encodeWav(b));
  a.download = `${current}.wav`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
ui.del.onclick = async () => {
  if (!saved.has(current) || !confirm('Eigene Aufnahme löschen? Das Spiel nutzt dann wieder den Synth-Sound.')) return;
  const r = await fetch(`/__sounds/${current}`, { method: 'DELETE' });
  if (r.ok) {
    saved = new Set(await r.json());
    renderSlots();
    status('Gelöscht. Das Spiel nutzt wieder den Synth-Sound.', 'ok');
  }
};
ui.pitch.oninput = () => (ui.pitchV.textContent = `${Number(ui.pitch.value) > 0 ? '+' : ''}${ui.pitch.value}`);
ui.vol.oninput = () => (ui.volV.textContent = `${ui.vol.value} %`);
document.querySelectorAll<HTMLButtonElement>('.toggle').forEach((t) => {
  t.onclick = () => {
    const k = t.dataset.fx as keyof typeof fx;
    fx[k] = !fx[k];
    t.setAttribute('aria-pressed', String(fx[k]));
    if (raw) preview();
  };
});
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    preview();
  }
  if (e.key.toLowerCase() === 'r') ui.rec.click();
});

selectSlot(current);
refreshSaved();
