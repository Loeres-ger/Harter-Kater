"""A small sample-based orchestra for the game's music (numpy only).

Instruments are multi-sampled WAV sets (the CC0 VSCO 2 Community Edition, kept outside the
project in GameDev/thirdparty/vsco2ce). A note picks the nearest sample of the right loudness,
tunes it by resampling, stretches long notes by crossfading the sustain, and gets an envelope.
Notes go onto buses (panned, with a reverb send); mix() sums the buses, adds a convolution hall
and masters the result. Time is in beats; Score.time() turns beats into seconds through a tempo
map, so phrases can breathe (ritardando, a held breath before a return).
"""
import math
import os
import re
import struct

import numpy as np

SR = 44100
NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3, "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7,
        "G#": 8, "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11, "H": 11}


def midi(name):
    """'D4' -> 62, 'Bb3' -> 58, 'F#5' -> 78 (scientific pitch, C4 = 60)."""
    m = re.fullmatch(r"([A-H][#b]?)(-?\d)", name)
    return 12 * (int(m.group(2)) + 1) + NOTE[m.group(1)]


# --- Reading samples -------------------------------------------------------------------------------

def read_wav(path):
    """PCM 16/24/32 or float WAV -> float32 array (n, 2), its sample rate."""
    with open(path, "rb") as f:
        data = f.read()
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise ValueError("not a wav: " + path)
    pos = 12
    fmt = None
    raw = None
    while pos + 8 <= len(data):
        cid = data[pos:pos + 4]
        size = struct.unpack("<I", data[pos + 4:pos + 8])[0]
        body = data[pos + 8:pos + 8 + size]
        if cid == b"fmt ":
            tag, ch, rate, _, _, bits = struct.unpack("<HHIIHH", body[:16])
            if tag == 0xFFFE:
                tag = struct.unpack("<H", body[24:26])[0]
            fmt = (tag, ch, rate, bits)
        elif cid == b"data":
            raw = body
        pos += 8 + size + (size & 1)
    tag, ch, rate, bits = fmt
    if tag == 3:
        x = np.frombuffer(raw[:len(raw) // 4 * 4], dtype="<f4").astype(np.float32)
    elif bits == 16:
        x = np.frombuffer(raw[:len(raw) // 2 * 2], dtype="<i2").astype(np.float32) / 32768.0
    elif bits == 24:
        b = np.frombuffer(raw[:len(raw) // 3 * 3], dtype=np.uint8).reshape(-1, 3).astype(np.int32)
        v = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        v = np.where(v >= 1 << 23, v - (1 << 24), v)
        x = v.astype(np.float32) / float(1 << 23)
    elif bits == 32:
        x = np.frombuffer(raw[:len(raw) // 4 * 4], dtype="<i4").astype(np.float32) / float(1 << 31)
    else:
        raise ValueError("bits %d" % bits)
    x = x[:len(x) // ch * ch].reshape(-1, ch)
    if ch > 2:
        x = x[:, :2]
    return x, rate                   # mono stays mono (n, 1) until a note is played


def resample(x, ratio, n_out):
    """Reads x at `ratio` times its speed (pitch up by ratio), n_out frames, linear interpolation."""
    idx = np.arange(n_out, dtype=np.float64) * ratio
    idx = idx[idx < len(x) - 1]
    i0 = idx.astype(np.int64)
    frac = (idx - i0).astype(np.float32)[:, None]
    return x[i0] * (1.0 - frac) + x[i0 + 1] * frac


class Instrument:
    """A sample set: files named like '<prefix>_<Note><Octave>_<layer>...wav'.

    `octave_shift` corrects libraries that call middle C 'C3'. `layers` maps the layer tag in the
    file name to a loudness 0..1, e.g. {'v1': 0.3, 'v2': 0.8}. `sustain`: long notes may be
    stretched by looping the sustain. `gain` levels the instrument."""

    def __init__(self, folder, pattern, layers, octave_shift=0, sustain=True, gain=1.0, attack_trim=True):
        self.samples = []            # (midi, loudness, array)
        self.sustain = sustain
        self.gain = gain
        rx = re.compile(pattern)
        for name in sorted(os.listdir(folder)):
            m = rx.search(name)
            if not m or not name.lower().endswith(".wav"):
                continue
            note = midi(m.group("note") + str(int(m.group("oct")) + octave_shift))
            layer = m.group("layer") if "layer" in rx.groupindex else None
            if layers and layer not in layers:
                continue
            loud = layers.get(layer, 0.6) if layers else 0.6
            self.samples.append((note, loud, prepare(os.path.join(folder, name), loud, sustain, attack_trim)))
        if not self.samples:
            raise ValueError("no samples in " + folder)

    def pick(self, note, loud):
        best = None
        for s in self.samples:
            score = abs(s[0] - note) * 1.0 + abs(s[1] - loud) * 4.0
            if best is None or score < best[0]:
                best = (score, s)
        return best[1]


def prepare(path, loud, sustain=True, attack_trim=True):
    """A sample file at the engine's rate, its silent start cut, brought to one level (recordings
    differ wildly); a loud layer keeps a little more, its colour does the rest."""
    x, rate = read_wav(path)
    if rate != SR:
        x = resample(x, rate / SR, int(len(x) * SR / rate))
    if attack_trim:
        x = _trim_start(x)
    body = x[int(0.05 * SR): int((0.6 if not sustain else 1.6) * SR)]
    if not len(body):
        body = x
    rms = float(np.sqrt((body.astype(np.float64) ** 2).mean())) if len(body) else 0.0
    if rms > 1e-6:
        x = (x * (0.12 / rms * (0.6 + 0.4 * loud))).astype(np.float32)
    return x


def _trim_start(x, floor_db=-48.0):
    level = np.abs(x).max(axis=1)
    peak = level.max()
    if peak <= 0:
        return x
    over = np.nonzero(level > peak * 10 ** (floor_db / 20.0))[0]
    start = max(int(over[0]) - int(0.004 * SR), 0) if len(over) else 0
    return x[start:]


def stretch(x, n, start=0.35, fade=0.35, rng=None):
    """x made at least n frames long by repeating stretches of its sustain with crossfades."""
    if len(x) >= n:
        return x
    rng = rng or np.random.default_rng(0)
    out = x.copy()
    a = int(len(x) * start)
    b = int(len(x) * 0.8)
    f = int(fade * SR)
    if b - a < 2 * f:
        f = max((b - a) // 3, 32)
    ramp = np.linspace(0.0, 1.0, f, dtype=np.float32)[:, None]
    while len(out) < n:
        s = int(rng.integers(a, max(a + 1, b - 2 * f)))
        piece = x[s:b]
        head = out[-f:] * np.sqrt(1.0 - ramp) + piece[:f] * np.sqrt(ramp)
        out = np.concatenate([out[:-f], head, piece[f:]])
    return out


# --- The score ---------------------------------------------------------------------------------------

class Score:
    """Notes on buses, in beats; a tempo map (bpm at beat, gliding in between) turns beats into time."""

    def __init__(self, bpm, seed=7):
        self.tempo = [(0.0, float(bpm))]
        self.notes = []              # (bus, instrument, midi, beat, beats, loud, opts)
        self.rng = np.random.default_rng(seed)

    def bpm_at(self, beat, bpm):
        self.tempo.append((float(beat), float(bpm)))
        self.tempo.sort()

    def time(self, beat):
        """Seconds at `beat`, integrating the tempo map (linear in bpm between points)."""
        t = 0.0
        pts = self.tempo + [(max(beat, self.tempo[-1][0]) + 1.0, self.tempo[-1][1])]
        for (b0, v0), (b1, v1) in zip(pts, pts[1:]):
            if beat <= b0:
                break
            end = min(beat, b1)
            # bpm goes linearly from v0 to v1 over [b0, b1]
            if b1 > b0 and v1 != v0:
                k = (v1 - v0) / (b1 - b0)
                v_end = v0 + k * (end - b0)
                t += 60.0 / k * math.log(v_end / v0)
            else:
                t += (end - b0) * 60.0 / v0
        return t

    def add(self, bus, inst, note, beat, beats, loud=0.6, **opts):
        n = midi(note) if isinstance(note, str) else note
        self.notes.append((bus, inst, n, float(beat), float(beats), float(loud), opts))


def render(score, buses, length_s):
    """Plays every note of `score` onto `buses` ({name: {'pan': -1..1, 'send': 0..1}})."""
    out = {name: np.zeros((int(length_s * SR), 2), dtype=np.float32) for name in buses}
    rng = score.rng
    for bus, inst, note, beat, beats, loud, o in score.notes:
        t0 = score.time(beat) + o.get("delay", 0.0) + rng.normal(0.0, o.get("human", 0.006))
        t1 = score.time(beat + beats)
        dur = max(t1 - t0, 0.05) * o.get("legato", 1.0)
        release = o.get("release", 0.6)
        sample_note, _, x = inst.pick(note, loud)
        ratio = 2.0 ** ((note - sample_note + o.get("cents", 0.0) / 100.0) / 12.0)
        n_out = int((dur + release) * SR)
        need = int(n_out * ratio) + 2
        if inst.sustain and len(x) < need:
            x = stretch(x, need, rng=rng)
        y = resample(x, ratio, n_out)
        if y.shape[1] == 1:
            y = np.repeat(y, 2, axis=1)
        n = len(y)
        if n == 0:
            continue
        env = np.ones(n, dtype=np.float32)
        att = int(o.get("attack", 0.0) * SR)
        if att > 0:
            env[:min(att, n)] = np.linspace(0.0, 1.0, min(att, n), dtype=np.float32) ** 1.6
        rel_at = int(dur * SR)
        if rel_at < n:
            k = n - rel_at
            env[rel_at:] *= np.exp(-np.linspace(0.0, 6.0, k, dtype=np.float32))
        decay = o.get("decay", 0.0)          # extra natural decay (plucked strings): seconds to -8.7 dB
        if decay > 0:
            env *= np.exp(-np.arange(n, dtype=np.float32) / (decay * SR))
        swell = o.get("swell")               # (start level, peak level, end level, peak position 0..1)
        if swell:
            s0, s1, s2, p = swell
            u = np.linspace(0.0, 1.0, n, dtype=np.float32)
            env *= np.where(u < p, s0 + (s1 - s0) * np.sin(np.clip(u / max(p, 1e-3), 0, 1) * math.pi / 2),
                            s1 + (s2 - s1) * (1 - np.cos(np.clip((u - p) / max(1 - p, 1e-3), 0, 1) * math.pi / 2)))
        gain = inst.gain * (0.25 + 0.75 * loud) ** 1.6 * o.get("gain", 1.0)
        y = y * (env * gain)[:, None]
        a = int(t0 * SR)
        if a < 0:
            y = y[-a:]
            a = 0
        buf = out[bus]
        b = min(a + len(y), len(buf))
        if b > a:
            buf[a:b] += y[:b - a]
    return out


# --- Mixing ------------------------------------------------------------------------------------------

def pan(x, p, width=1.0):
    """Constant-power pan of a stereo signal; width narrows the stereo image first."""
    mid = (x[:, 0] + x[:, 1]) * 0.5
    side = (x[:, 0] - x[:, 1]) * 0.5 * width
    l, r = mid + side, mid - side
    ang = (p + 1.0) * math.pi / 4.0
    return np.stack([l * math.cos(ang) * math.sqrt(2), r * math.sin(ang) * math.sqrt(2)], axis=1)


def eq(x, points):
    """Gain curve by frequency, [(hz, db), ...] interpolated on a log axis, applied in one FFT."""
    n = len(x)
    size = 1 << (n - 1).bit_length()
    freqs = np.fft.rfftfreq(size, 1.0 / SR)
    lf = np.log10(np.maximum(freqs, 10.0))
    px = np.log10([p[0] for p in points])
    py = np.array([p[1] for p in points])
    g = 10 ** (np.interp(lf, px, py) / 20.0)
    out = np.empty_like(x)
    for c in range(2):
        spec = np.fft.rfft(x[:, c], size)
        out[:, c] = np.fft.irfft(spec * g, size)[:n]
    return out


def hall_ir(seconds=3.4, predelay=0.025, seed=3, dark=0.55):
    """A concert hall's response: sparse early reflections, then dense decorrelated noise decaying
    (faster in the highs), slightly different left and right."""
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2), dtype=np.float64)
    for c in range(2):
        noise = rng.standard_normal(n)
        # Highs die sooner: split into bands decaying at their own rates
        spec = np.fft.rfft(noise)
        f = np.fft.rfftfreq(n, 1.0 / SR)
        low = np.fft.irfft(spec * (f < 900), n)
        mid = np.fft.irfft(spec * ((f >= 900) & (f < 4500)), n)
        high = np.fft.irfft(spec * (f >= 4500), n)
        rt = seconds / 1.6
        tail = low * np.exp(-6.9 * t / rt) + mid * np.exp(-6.9 * t / (rt * 0.8)) * 0.8 \
            + high * np.exp(-6.9 * t / (rt * 0.45)) * dark
        fade_in = np.clip((t - predelay) / 0.06, 0.0, 1.0)
        ir[:, c] = tail * fade_in
        for k in range(14):
            d = predelay + rng.uniform(0.004, 0.09)
            i = int(d * SR)
            if i < n:
                ir[i, c] += rng.uniform(-1, 1) * 2.5 * math.exp(-d * 18)
    ir /= np.sqrt((ir ** 2).sum(axis=0, keepdims=True))
    return ir.astype(np.float32)


def convolve(x, ir):
    """Stereo x through a stereo impulse response, in blocks (overlap-add)."""
    n, m = len(x), len(ir)
    block = 1 << 16
    size = 1 << (block + m - 1).bit_length()
    out = np.zeros((n + m, 2), dtype=np.float32)
    H = [np.fft.rfft(ir[:, c], size) for c in range(2)]
    for s in range(0, n, block):
        seg = x[s:s + block]
        for c in range(2):
            y = np.fft.irfft(np.fft.rfft(seg[:, c], size) * H[c], size)[:len(seg) + m - 1]
            out[s:s + len(y), c] += y.astype(np.float32)
    return out[:n]


def write_wav(path, x):
    x = np.clip(x, -1.0, 1.0)
    pcm = (x * 32767.0).astype("<i2")
    with open(path, "wb") as f:
        data = pcm.tobytes()
        f.write(b"RIFF" + struct.pack("<I", 36 + len(data)) + b"WAVE")
        f.write(b"fmt " + struct.pack("<IHHIIHH", 16, 1, 2, SR, SR * 4, 4, 16))
        f.write(b"data" + struct.pack("<I", len(data)) + data)


def _smooth(v, seconds):
    k = max(int(seconds * SR), 1)
    c = np.cumsum(np.concatenate([np.zeros(k), v, np.full(k, v[-1])]))
    return (c[2 * k:] - c[:-2 * k])[: len(v)] / (2 * k) if len(v) else v


def compress(x, threshold_db=-24.0, ratio=2.5, window=0.35, smooth=0.25):
    """A gentle bus compressor: the level over `window` seconds above the threshold is pulled
    down by `ratio`, the gain glides (no pumping)."""
    level = np.sqrt(_smooth((x.astype(np.float64) ** 2).mean(axis=1), window) + 1e-12)
    db = 20 * np.log10(level)
    cut = np.minimum(0.0, (threshold_db - db) * (1.0 - 1.0 / ratio))
    gain = 10 ** (_smooth(cut, smooth) / 20.0)
    return (x * gain[:, None]).astype(np.float32)


def soft_limit(x, ceiling=0.94):
    return np.tanh(x / ceiling) * ceiling
