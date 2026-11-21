"""The game's orchestra, a short notation and the shared mix – the style the user approved with
'Der Käfig' v4 (2026-11-09): simple, slow, the strings quiet and far back, a lot of space (a long
hall), quiet overall.

Instruments load lazily by name (get('lyre')); every piece is a Piece: notes on buses in bars and
beats, then mix() renders, adds the hall, folds the tail into the start (seamless loops) and writes.
Guardian pieces put extra buses into phase 2/3 ('p2.drums', 'p3.horn'): one render, three mixes.
"""
import glob
import math
import os
import re

import numpy as np

import engine as E

ROOT = os.environ.get("VSCO", r"C:\Users\heike\GameDev\thirdparty\vsco2ce")
NOTE_RX = r"(?P<note>[A-G]#?)(?P<oct>-?\d)"


def path(*parts):
    return os.path.join(ROOT, *parts)


# --- Instruments -----------------------------------------------------------------------------------

def peak_midi(x, lo=40.0, hi=2000.0):
    """The audible tone of a drum: its strongest partial in the first moments."""
    m = x.mean(axis=1)[: 1 << 15].astype(np.float64)
    spec = np.abs(np.fft.rfft(m * np.hanning(len(m)), 1 << 17))
    f = np.fft.rfftfreq(1 << 17, 1.0 / E.SR)
    sel = (f > lo) & (f < hi)
    s, fs = spec[sel], f[sel]
    k = int(np.argmax(s))
    if 0 < k < len(s) - 1:     # the peak between bins (parabola), for the cents
        a, b, c = np.log(s[k - 1] + 1e-12), np.log(s[k] + 1e-12), np.log(s[k + 1] + 1e-12)
        k = k + 0.5 * (a - c) / (a - 2 * b + c + 1e-12)
    hz = np.interp(k, np.arange(len(fs)), fs)
    return 69 + 12 * math.log2(hz / 440.0)


def detect_midi(x, band=(28, 2200)):
    """Pitch of a sample by the harmonic product spectrum (for sets named without notes); a narrow
    band for drums like the timpani, whose strongest partial is the note."""
    m = x.mean(axis=1).astype(np.float64)
    seg = m[int(0.08 * E.SR): int(1.4 * E.SR)]
    if len(seg) < 8192:
        seg = m
    size = 1 << 17
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), size))
    hps = spec.copy()
    for h in (2, 3, 4):
        part = spec[::h]
        hps[:len(part)] *= part
        hps[len(part):] = 0
    f = np.fft.rfftfreq(size, 1.0 / E.SR)
    sel = (f > band[0]) & (f < band[1])
    peak = f[sel][np.argmax((spec if band[1] < 400 else hps)[sel])]
    return int(round(69 + 12 * math.log2(peak / 440.0)))


class Samples(E.Instrument):
    """Samples listed one by one: (file, midi note or None to detect it, loudness)."""

    def __init__(self, entries, sustain=False, gain=1.0, base=None, detect=None):
        self.samples = []
        self.sustain = sustain
        self.gain = gain
        for f, note, loud in entries:
            x = E.prepare(f, loud, sustain)
            self.samples.append(((detect_midi(x, detect) if detect else detect_midi(x)) if note is None else note, loud, x))
        if not self.samples:
            raise ValueError("no samples")
        self.base = base if base is not None else self.samples[0][0]


def _layers_auto(folder, rx):
    tags = sorted({m.group("layer") for n in os.listdir(folder) for m in [re.search(rx, n)] if m})
    if len(tags) == 1:
        return {tags[0]: 0.6}
    return {t: 0.3 + 0.6 * i / (len(tags) - 1) for i, t in enumerate(tags)}


def pitched(folder, prefix, suffix, layers="auto", octave_shift=0, sustain=True, gain=1.0):
    folder = path(*folder.split("/"))
    rx = prefix + NOTE_RX + suffix
    if layers == "auto":
        layers = _layers_auto(folder, rx)
    return E.Instrument(folder, rx, layers, octave_shift=octave_shift, sustain=sustain, gain=gain)


def hits(pattern, base=60, gain=1.0, sustain=False, detect=False, each_note=False, tune=False, peak=None):
    """One-shot files by glob; loudness from a 'v<n>' tag (or ordered p<mf<f<fff), the note fixed
    (or detected; or each file its own note base+i so a part can choose the sample)."""
    files = sorted(glob.glob(path(*pattern.split("/"))))
    order = {"ppp": 0.15, "pp": 0.25, "p": 0.35, "mp": 0.5, "mf": 0.6, "f": 0.75, "ff": 0.88, "fff": 1.0}
    vs = [int(m.group(1)) for f in files for m in [re.search(r"_v(\d+)", os.path.basename(f))] if m]
    top = max(vs) if vs else 1
    entries = []
    for i, f in enumerate(files):
        name = os.path.basename(f)
        m = re.search(r"_v(\d+)", name)
        d = re.search(r"_(ppp|pp|p|mp|mf|f|ff|fff)(?:_|\.)", name)
        loud = (0.25 + 0.75 * int(m.group(1)) / top) if m else order.get(d.group(1), 0.6) if d else 0.6
        entries.append((f, None if detect else base + (i if each_note else 0), loud))
    inst = Samples(entries, sustain=sustain, gain=gain, base=base, detect=detect if isinstance(detect, tuple) else None)
    if tune:      # a drum with a clear tone: every sample knows its own, Piece.grid puts it on the key
        tuned = []
        for _, loud, x in inst.samples:
            p = peak_midi(x)
            r = 2 ** ((round(p) - p) / 12.0)          # each sample pulled onto its nearest semitone
            tuned.append((int(round(p)), loud, E.resample(x, r, int(len(x) / r) - 2)))
        inst.samples = tuned
        inst.pitch = int(np.median([s[0] for s in inst.samples]))
        inst.base = inst.pitch
    if peak:      # a crescendo is quiet where prepare() measures it: level it by its loudest point instead
        inst.samples = [(n, loud, (x * (peak / (np.abs(x).max() + 1e-9))).astype(np.float32)) for n, loud, x in inst.samples]
    return inst


VOWELS = {"a": [(700, 0, 110), (1150, -5, 120), (2600, -18, 160), (3300, -24, 220)],
          "o": [(450, 0, 80), (800, -8, 90), (2830, -24, 150), (3500, -30, 220)],
          "u": [(330, 0, 70), (720, -14, 80), (2500, -30, 150), (3500, -34, 220)]}


class Choir:
    """A small synthetic choir singing a vowel: detuned voices with their own vibrato and drift,
    harmonics shaped by the vowel's formants, a little breath. Made per note and kept."""

    def __init__(self, vowel="o", voices=5, gain=1.0, seconds=5.0):
        self.vowel, self.voices, self.gain, self.seconds = vowel, voices, gain, seconds
        self.sustain = True
        self.cache = {}

    def pick(self, note, loud):
        if note not in self.cache:
            self.cache[note] = self._make(note)
        return note, loud, self.cache[note]

    def _make(self, note):
        rng = np.random.default_rng(note * 31 + len(self.vowel))
        f0 = 440.0 * 2 ** ((note - 69) / 12.0)
        n = int(self.seconds * E.SR)
        t = np.arange(n) / E.SR
        out = np.zeros((n, 2))
        top = int(min(5500.0 / f0, 70))
        k = np.arange(1, top + 1)
        for v in range(self.voices):
            shift = rng.uniform(0.95, 1.06)
            amp = np.zeros(top)
            for fc, db, bw in VOWELS[self.vowel]:
                amp += 10 ** (db / 20.0) / (1.0 + ((k * f0 - fc * shift) / bw) ** 2)
            amp *= k ** -0.6
            det = 2 ** (rng.normal(0, 6) / 1200.0)
            vib = 0.0055 * np.sin(2 * np.pi * rng.uniform(4.6, 5.6) * t + rng.uniform(0, 6.3)) * np.clip(t / 0.9, 0, 1)
            drift = np.cumsum(rng.normal(0, 1, n // 2205 + 2))
            drift = np.interp(t, np.arange(len(drift)) * 0.05, (drift - drift.mean()) * 0.0009)
            phase = 2 * np.pi * np.cumsum(f0 * det * (1 + vib + drift)) / E.SR
            sig = np.zeros(n)
            for h in range(top):
                if amp[h] > 1e-3:
                    sig += amp[h] * np.sin((h + 1) * phase + rng.uniform(0, 6.3))
            sig *= 1 + 0.12 * np.sin(2 * np.pi * rng.uniform(0.2, 0.5) * t + rng.uniform(0, 6.3))
            p = (v / max(self.voices - 1, 1)) * 2 - 1
            out[:, 0] += sig * math.cos((p * 0.6 + 1) * math.pi / 4)
            out[:, 1] += sig * math.sin((p * 0.6 + 1) * math.pi / 4)
        breath = np.fft.irfft(np.fft.rfft(rng.standard_normal(n)) * np.exp(-((np.fft.rfftfreq(n, 1 / E.SR) - 900) / 600) ** 2), n)
        out += breath[:, None] * 0.002 * np.abs(out).max() / (np.abs(breath).max() + 1e-9) * 30
        out *= np.clip(t / 0.25, 0, 1)[:, None]
        rms = np.sqrt((out[int(0.5 * E.SR):] ** 2).mean())
        return (out * 0.12 / rms).astype(np.float32)


S_ = "Strings/"
CAT = {
    # strings (VSCO calls middle C 'C3' in the sections: octave_shift 1, checked by ear-free pitch detection)
    "lyre": lambda: pitched(S_ + "Harp", "KSHarp_", r"_(?P<layer>mf|f|mp)", {"mp": .4, "mf": .6, "f": .85}, 0, False),
    "vln": lambda: pitched(S_ + "Violin Section/susVib", "VlnEns_susVib_", r"_(?P<layer>v\d)", {"v1": .3, "v2": .8}, 1, gain=.72),
    "vln_trem": lambda: pitched(S_ + "Violin Section/Trem", "VlnEns_Trem_", r"_(?P<layer>v\d)", {"v1": .3, "v2": .8}, 1, gain=.7),
    "vln_pizz": lambda: pitched(S_ + "Violin Section/Pizz", "VlnEns_Pizz_", r"_(?P<layer>v\d)_rr1", "auto", 1, False, .9),
    "vla": lambda: pitched(S_ + "Viola Section/susvib", "ViolaEns_susvib_", r"_(?P<layer>v\d)_1", {"v1": .3, "v2": .8}, 1, gain=.8),
    "vla_trem": lambda: pitched(S_ + "Viola Section/trem", "Violas_trem_", r"_(?P<layer>v\d)_rr1", {"v1": .3, "v2": .8}, 1, gain=.7),
    "vc": lambda: pitched(S_ + "Cello Section/susvib", "^susvib_", r"_(?P<layer>v\d)_1", {"v1": .3, "v3": .85}, 1, gain=.85),
    "vc_trem": lambda: pitched(S_ + "Cello Section/trem", "^trem_", r"_(?P<layer>v\d)_1", {"v1": .3, "v2": .8}, 1, gain=.7),
    "vc_pizz": lambda: pitched(S_ + "Cello Section/pizzT", "pizzT_", r"_(?P<layer>v\d)_RR1", "auto", 1, False, .9),
    "solo": lambda: pitched(S_ + "Solo Violin/Arco Vib", "LLVln_ArcoVib_", r"_(?P<layer>[pf])", {"p": .3, "f": .8}, 0, gain=.85),
    "cb": lambda: pitched(S_ + "Solo Contrabass/SusNV", "BKCtbss_SusNV_", r"_(?P<layer>v\d)_rr1", {"v1": .3, "v3": .85}, 1, gain=1.25),
    "cb_pizz": lambda: pitched(S_ + "Solo Contrabass/Pizz", "BKCtbss_Pizz_", r"_(?P<layer>v\d)_rr1", {"v1": .3, "v3": .85}, 1, False, 1.3),
    "vc_spic": lambda: pitched(S_ + "Cello Section/spic", "^spic_", r"_(?P<layer>v\d)_RR1", "auto", 1, False, .9),
    "vla_spic": lambda: pitched(S_ + "Viola Section/spic", "Violas_spic_", r"_(?P<layer>v\d)_rr1", "auto", 1, False, .9),
    "vln_spic": lambda: pitched(S_ + "Violin Section/Spic", "VlnEns_Spic_", r"_(?P<layer>v\d)_rr1", "auto", 1, False, .9),
    "cb_spic": lambda: pitched(S_ + "Solo Contrabass/Spic", "BKCtbss_Spic_", r"_(?P<layer>v\d)_rr1", "auto", 1, False, 1.2),
    "horn_stac": lambda: pitched("Brass/F Horn/stac", "MOHorn_stac_", r"_(?P<layer>v\d)_rr1", "auto", 1, False, .85),
    "tbn_stac": lambda: pitched("Brass/Tenor Trombone/stac", "tenortbn_stac_", r"_(?P<layer>v\d)_rr1", "auto", 1, False, .85),
    "tuba_stac": lambda: pitched("Brass/Tuba/stac", "Tuba3_stac_", r"_(?P<layer>v\d)_rr1_Sum", "auto", 1, False, .9),
    # winds and brass
    "flute": lambda: pitched("Woodwinds/Flute/susvib", "LDFlute_susvib_", r"_(?P<layer>v\d)_1", "auto", 1, gain=.8),
    "flute_nv": lambda: pitched("Woodwinds/Flute/susNV", "LDFlute_susNV_", r"_(?P<layer>v\d)_1", "auto", 1, gain=.8),
    "oboe": lambda: pitched("Woodwinds/Oboe/Vib", "Oboe_Vib_", r"_(?P<layer>v\d)_Main", "auto", 1, gain=.75),
    "clar": lambda: pitched("Woodwinds/Clarinet/susLong", "DCClar_susLong_", r"_(?P<layer>v\d)_rr1", "auto", 1, gain=.8),
    "bsn": lambda: pitched("Woodwinds/Bassoon/sus", "PSBassoon_", r"_(?P<layer>v\d)_1", "auto", 1, gain=.8),
    "horn": lambda: pitched("Brass/F Horn/sus", "MOHorn_sus_", r"_(?P<layer>v\d)_1", "auto", 1, gain=.8),
    "tbn": lambda: pitched("Brass/Tenor Trombone/sus", "tenortbn_sus_", r"_(?P<layer>v\d)_1", "auto", 1, gain=.8),
    "tuba": lambda: pitched("Brass/Tuba/sus", "Tuba3_sus_", r"_(?P<layer>v\d)_rr1_Mid", "auto", 1, gain=.9),
    # keys, voices
    "organ": lambda: hits("Keys/Organ/Quiet/*.wav", detect=True, sustain=True, gain=.7),
    "organ_loud": lambda: hits("Keys/Organ/Loud/*.wav", detect=True, sustain=True, gain=.7),
    "choir_o": lambda: Choir("o"),
    "choir_a": lambda: Choir("a"),
    "choir_u": lambda: Choir("u"),
    # tuned percussion
    "tb": lambda: pitched("Percussion", "TB_hit_", r"_(?P<layer>v\d)_rr1", "auto", 1, False),
    "glock": lambda: pitched("Percussion/Glock", "glock_medium_", r"\.wav", None, 1, False, .8),
    "marimba": lambda: pitched("Percussion/Marimba", "Marimba_hit_Outrigger_", r"_loud", None, 1, False),
    "xylo": lambda: pitched("Percussion/Xylo", "Xylo_Medium_", r"_ff", None, 1, False, .8),
    "timp": lambda: hits("Percussion/Timpani/Timpani*_Hit_v*_rr1_Sum.wav", 45, tune=True),
    "timp_roll": lambda: hits("Percussion/Timpani/Rolls/*.wav", 45, sustain=True, tune=True),
    # drums and colours (fixed notes; a part picks a sample by its note where each_note is set)
    "bd": lambda: hits("Percussion/BDrumNewhit_v*_rr1_Sum.wav", 36, tune=True),
    "frame": lambda: hits("Miscellania Raw/Misc 2/rtomtom_frame*.wav", 50, each_note=True, tune=True),
    "tumba": lambda: hits("Percussion/Tumba-HitN_v*_rr1_Sum.wav", 48, tune=True),
    "conga": lambda: hits("Percussion/Conga-HitN_v*_rr1_Sum.wav", 52, tune=True),
    "log_lo": lambda: hits("Percussion/LogDrumLo_MedM_v*_rr1_Sum.wav", 50, tune=True),
    "log_hi": lambda: hits("Percussion/LogDrumHi_MedM_v*_rr1_Sum.wav", 57, tune=True),
    "claves": lambda: hits("Percussion/Claves1_Hit_v*_rr1_Sum.wav", 76, tune=True),
    "tamb": lambda: hits("Percussion/Tamb1-Hit_v*_rr1_Sum.wav", 70),
    "snare": lambda: hits("Percussion/Snare2-HitSN_v*_rr1_Sum.wav", 62, tune=True),
    "triangle": lambda: hits("Percussion/Triangle3-Hit_v*_rr1_Sum.wav", 90),
    "gong": lambda: hits("Percussion/gongHit_*.wav", 40),
    "cymbal": lambda: hits("Percussion/susCymb1-bow-*.wav", 80, sustain=False, each_note=True),
    "swell": lambda: hits("Percussion/susCymb1-cresc-*_v1.wav", 80, each_note=True, peak=0.35),
    "crash": lambda: hits("Percussion/cymbal-crash1_*_rr1.wav", 80),
    "anvil": lambda: hits("Percussion/Anvil_Hit1_v*_Sum.wav", 84),
    "brake": lambda: hits("Percussion/BrakeDrum1_Hammer_v*_Sum.wav", 80),
    "metal": lambda: hits("Miscellania Raw/Misc 1/metal_hit*.wav", 60, each_note=True),
    "chain": lambda: hits("Miscellania Raw/Misc 1/chain_grind.wav", 60),
    "bubbles": lambda: hits("Miscellania Raw/Misc 1/bubbles*.wav", 60, each_note=True),
    "scrape": lambda: hits("Miscellania Raw/Misc 1/brick_scrape*.wav", 60, each_note=True),
    "vibra": lambda: hits("Percussion/vibraring_v1_rr*.wav", 60, each_note=True),
}
# Playing habits per instrument (a part can override any)
DEF = {
    "lyre": dict(decay=2.8, release=2.2, human=0.01),
    "vln": dict(attack=0.5, release=1.4, legato=1.04), "vla": dict(attack=0.5, release=1.4, legato=1.04),
    "vc": dict(attack=0.5, release=1.3, legato=1.04), "cb": dict(attack=0.6, release=1.5, legato=1.04),
    "vln_trem": dict(attack=0.6, release=0.8), "vla_trem": dict(attack=0.6, release=0.8), "vc_trem": dict(attack=0.6, release=0.8),
    "solo": dict(attack=0.12, release=1.0, legato=1.06),
    "flute": dict(attack=0.12, release=1.0, legato=1.05), "flute_nv": dict(attack=0.2, release=1.0, legato=1.05),
    "oboe": dict(attack=0.08, release=0.8, legato=1.05), "clar": dict(attack=0.1, release=0.9, legato=1.05),
    "bsn": dict(attack=0.08, release=0.8, legato=1.05), "horn": dict(attack=0.15, release=1.2, legato=1.04),
    "tbn": dict(attack=0.1, release=1.0, legato=1.04), "tuba": dict(attack=0.1, release=1.0, legato=1.04),
    "organ": dict(attack=0.25, release=1.6), "organ_loud": dict(attack=0.2, release=1.6),
    "choir_o": dict(attack=0.8, release=1.8), "choir_a": dict(attack=0.8, release=1.8), "choir_u": dict(attack=0.9, release=2.0),
    "vln_pizz": dict(release=0.8, decay=1.2), "vc_pizz": dict(release=0.9, decay=1.5), "cb_pizz": dict(release=1.0, decay=1.8),
    "vc_spic": dict(release=0.15), "vla_spic": dict(release=0.15), "vln_spic": dict(release=0.15), "cb_spic": dict(release=0.15),
    "horn_stac": dict(release=0.2), "tbn_stac": dict(release=0.2), "tuba_stac": dict(release=0.2),
    "tb": dict(release=3.0, decay=5.0), "glock": dict(release=2.5, decay=3.0), "marimba": dict(release=1.0, decay=1.4),
    "xylo": dict(release=0.6, decay=0.8), "timp": dict(release=1.5, decay=2.5), "timp_roll": dict(attack=0.4, release=1.2),
}
_cache = {}


def get(name):
    if name not in _cache:
        print("  load", name, flush=True)
        inst = CAT[name]()
        inst.defaults = DEF.get(name, dict(release=0.6, human=0.004))
        _cache[name] = inst
    return _cache[name]


# --- Buses ------------------------------------------------------------------------------------------
STRINGS = 0.6     # the strings sit well behind the lead (Der Käfig v4)
BUS = {           # pan, hall send, eq, gain
    "lyre": (-0.18, 0.5, [(40, -14), (140, -6), (450, 0), (1600, 3.0), (3200, 2.5), (8000, -0.5), (15000, -6)], 1.0),
    "melody": (-0.08, 0.52, [(40, -14), (160, -5), (500, 0), (1700, 3.5), (3400, 2.5), (8000, 0), (15000, -5)], 1.0),
    "vln": (-0.5, 0.65, [(60, -10), (200, -2), (3000, -1), (9000, -4), (16000, -8)], STRINGS),
    "vla": (0.25, 0.6, [(60, -8), (250, 0), (3000, -2), (9000, -5)], STRINGS),
    "vc": (0.4, 0.55, [(35, -6), (120, 1), (400, 0), (2500, -2), (8000, -5)], STRINGS),
    "cb": (0.12, 0.45, [(25, -8), (60, 1), (200, 0), (1200, -3), (5000, -8)], STRINGS),
    "solo": (-0.05, 0.6, [(80, -10), (300, -1), (2500, 1), (8000, -2), (16000, -8)], 0.75),
    "pizz": (0.15, 0.45, [(25, -6), (70, 2), (300, 0), (2000, -3), (6000, -8)], 0.8),
    "flute": (0.1, 0.55, [(80, -12), (300, -2), (2500, 1), (9000, -2), (16000, -8)], 0.85),
    "reed": (0.15, 0.5, [(60, -10), (250, 0), (2500, 0), (8000, -3), (15000, -8)], 0.85),
    "horn": (-0.25, 0.6, [(40, -8), (150, 0), (1500, 0), (5000, -4), (12000, -10)], 0.8),
    "low": (0.2, 0.5, [(25, -6), (80, 1), (400, 0), (2000, -3), (8000, -9)], 0.8),
    "choir": (0.0, 0.7, [(60, -10), (200, 0), (2500, 0), (7000, -4), (14000, -10)], 0.7),
    "organ": (0.0, 0.55, [(30, -6), (100, 0), (3000, -1), (9000, -6)], 0.7),
    "drums": (0.0, 0.32, [(25, -4), (60, 2), (300, 0), (3000, -1), (10000, -4)], 0.9),
    "hand": (0.22, 0.35, [(40, -6), (120, 1), (600, 0), (3000, -2), (8000, -6), (14000, -10)], 0.6),
    "metal": (-0.2, 0.45, [(80, -8), (400, 0), (4000, 0), (12000, -4)], 0.6),
    "bells": (0.25, 0.65, [(80, -12), (400, 0), (3000, 0), (10000, -3)], 0.65),
    "timp": (0.05, 0.45, [(30, -4), (80, 1), (400, 0), (3000, -4), (8000, -8)], 0.85),
    "fx": (0.0, 0.6, [(40, -10), (200, 0), (6000, 0), (14000, -6)], 0.55),
    # fight music: the driving strings up front, brass stabs, the big hits
    "drv": (0.3, 0.3, [(35, -6), (110, 1), (500, 0), (3000, 1), (9000, -3)], 1.15),
    "tick": (-0.45, 0.35, [(150, -10), (500, 0), (4000, 1), (10000, -3)], 0.6),
    "stab": (0.1, 0.35, [(40, -8), (150, 0), (1500, 1), (5000, -2), (12000, -8)], 0.9),
    "braam": (0.0, 0.4, [(25, -4), (60, 2), (300, 0), (2000, -2), (7000, -8)], 1.0),
    "lead": (-0.15, 0.45, [(40, -8), (150, 0), (1200, 1), (4000, -2), (12000, -9)], 1.0),
    "crash": (0.2, 0.4, [(200, -10), (1000, -2), (6000, 0), (14000, -4)], 0.5),
    "rise": (0.0, 0.5, [(80, -10), (400, 0), (6000, 0), (14000, -5)], 0.7),
}


def bus_cfg(name):
    base = name.split(".")[-1].rstrip("0123456789")
    return BUS[base]


def phase_of(name):
    return int(name[1]) if name.startswith("p") and "." in name else 1


# --- Writing music ------------------------------------------------------------------------------------
ACC = {"X": 1.0, "x": 0.72, "o": 0.45}


class Piece:
    def __init__(self, bpm, beats=4, bars=32, seed=7):
        self.S = E.Score(bpm, seed)
        self.bpm, self.beats, self.bars = float(bpm), beats, bars
        self.used = set()
        self.rng = np.random.default_rng(seed + 11)
        self.gain = {}
        self.key = None           # pitch classes the tuned drums sit on (root, fifth)

    def at(self, bar, beat=0.0):
        return (bar - 1) * self.beats + beat

    def note(self, bus, inst, n, bar, beat, dur, loud, **o):
        i = get(inst)
        opts = dict(i.defaults)
        opts.update(o)
        self.S.add(bus, i, E.midi(n) if isinstance(n, str) else int(n), self.at(bar, beat), dur, loud, **opts)
        self.used.add(bus)

    def seq(self, bus, inst, bar, text, loud, beat=0.0, tr=0, **o):
        """'D5:1 A5:2 B5:3 -:1 D4+A4:2:0.8' – note(s):beats[:loudness factor], '-' rests."""
        b = (bar - 1) * self.beats + beat
        for tok in text.split():
            parts = tok.split(":")
            dur = float(parts[1])
            f = float(parts[2]) if len(parts) > 2 else 1.0
            if parts[0] != "-":
                for n in parts[0].split("+"):
                    self.note(bus, inst, E.midi(n) + tr, 1, b, dur, loud * f, **o)
            b += dur
        return b

    def hold(self, bus, inst, bar, bars, notes, loud, **o):
        for n in notes.split():
            self.note(bus, inst, n, bar, 0, bars * self.beats, loud, **o)

    def chords(self, bus, inst, bar, text, bars_each, loud, **o):
        """'D3+A3 G2+D3 …' – one chord per `bars_each` bars."""
        for k, ch in enumerate(text.split()):
            for n in ch.split("+"):
                self.note(bus, inst, n, bar + k * bars_each, 0, bars_each * self.beats, loud, **o)

    def osti(self, bus, inst, bar, bars, pattern, roots, loud, dur=1.0, **o):
        """A figure [(beat, semitones over the root, accent)] each bar; roots cycle bar by bar."""
        rs = roots.split() if isinstance(roots, str) else list(roots)
        for k in range(bars):
            r = rs[k % len(rs)]
            r = E.midi(r) if isinstance(r, str) else r
            for beat, step, acc in pattern:
                self.note(bus, inst, r + step, bar + k, beat, dur, loud * acc, **o)

    def grid(self, bus, inst, bar, bars, pattern, loud, note=None, **o):
        """'X..x..o.' – one character a step across the bar (X loud, x medium, o soft, . rest)."""
        i = get(inst)
        n = note if note is not None else i.base
        n = E.midi(n) if isinstance(n, str) else n
        tune = note is None and self.key and getattr(i, "pitch", None) is not None
        step = self.beats / len(pattern)
        for k in range(bars):
            for j, c in enumerate(pattern):
                if c in ACC:
                    if tune:    # the sample this loudness picks, moved to the nearest root or fifth (≤ 3 semitones)
                        sn = i.pick(i.pitch, loud * ACC[c])[0]
                        n = sn + min((d for d in range(-6, 7) if (sn + d) % 12 in self.key), key=abs)
                    o2 = dict(cents=float(self.rng.normal(0, 5)), human=0.004)
                    o2.update(o)
                    self.note(bus, inst, n, bar + k, j * step, step, loud * ACC[c], **o2)

    def tempo(self, bar, bpm, beat=0.0):
        self.S.bpm_at(self.at(bar, beat), bpm)

    def slow(self, bar, low):
        """Slows over bar `bar`, back to the base tempo when the next one begins."""
        self.tempo(bar, self.bpm)
        self.S.bpm_at(self.at(bar + 1) - 0.01, low)
        self.tempo(bar + 1, self.bpm)

    def end(self):
        return self.S.time(self.at(self.bars + 1))


# --- Mixing -----------------------------------------------------------------------------------------

PRE = 0.12      # seconds of pre-roll: notes humanized to before the start keep their attack


def master(mix, target, loop, n, tail_n, ratio=1.6):
    pre = int(PRE * E.SR)
    if loop:
        out = mix[pre:pre + n].copy()
        out[:tail_n] += mix[pre + n:pre + n + tail_n]
        out[n - pre:] += mix[:pre]
        mix = out
    else:
        fade = min(int(1.5 * E.SR), len(mix) // 4)
        mix[-fade:] *= np.linspace(1.0, 0.0, fade)[:, None] ** 2
    if loop:      # compress around the seam too: the end and the start see the same level
        k = min(2 * E.SR, len(mix) // 2)
        mix = E.compress(np.concatenate([mix[-k:], mix, mix[:k]]), threshold_db=target - 7.0, ratio=ratio)[k:-k]
    else:
        mix = E.compress(mix, threshold_db=target - 7.0, ratio=ratio)
    if loop:
        level = np.sqrt((mix ** 2).mean())
    else:      # a short piece: its loudest second sets the level
        c = np.concatenate([[0.0], np.cumsum((mix.astype(np.float64) ** 2).mean(axis=1))])
        w = min(E.SR, len(mix) - 1)
        level = np.sqrt(((c[w:] - c[:-w]) / w).max()) * 10 ** (-4 / 20.0)
    mix *= 10 ** (target / 20.0) / (level + 1e-12)
    return E.soft_limit(mix, 0.9)


def mix(p, out_wav, target=-23.0, hall=5.2, tail=9.0, loop=True, wet=0.8, phases=(1,), phase_step=1.5,
        send_scale=1.0, dry_level=0.8, ratio=1.6):
    """Renders `p`, writes out_wav (or out_wav with _p1/_p2/_p3 for phased pieces); returns paths."""
    end = p.end()
    print("  render %.1f s, %d notes" % (end, len(p.S.notes)), flush=True)
    p.S.notes = [(b, i, n, bt, d, ld, dict(o, delay=o.get("delay", 0.0) + PRE)) for b, i, n, bt, d, ld, o in p.S.notes]
    dry = E.render(p.S, {b: {} for b in p.used}, PRE + end + tail + 0.01)   # +0.01: Rundung der Längen (Harter Karter)
    ready = {}
    for name, x in dry.items():
        pan_, send, eqp, gain = bus_cfg(name)
        g = gain * p.gain.get(name, p.gain.get(name.split(".")[-1].rstrip("0123456789"), 1.0))
        ready[name] = (E.pan(E.eq(x, eqp) * g, pan_, width=0.9), send * send_scale)
    ir = E.hall_ir(hall, predelay=0.06)
    n, t = int(end * E.SR), int(tail * E.SR)
    outs = []
    for ph in phases:
        names = [b for b in ready if phase_of(b) <= ph]
        m = sum(ready[b][0] for b in names)
        s = sum(ready[b][0] * ready[b][1] for b in names)
        m = m * dry_level + E.convolve(s, ir) * wet
        m = E.eq(m, [(30, -4), (90, 0), (250, -0.5), (2500, 0), (11000, 0.5), (18000, -4)])
        m = master(m, target - (max(phases) - ph) * phase_step, loop, n, t, ratio)
        f = out_wav if len(phases) == 1 else out_wav.replace(".wav", "_p%d.wav" % ph)
        E.write_wav(f, m)
        print("  wrote %s (%.1f s, rms %.1f dBFS)" % (os.path.basename(f), len(m) / E.SR,
                                                    20 * np.log10(np.sqrt((m ** 2).mean()) + 1e-12)), flush=True)
        outs.append(f)
    return outs


if __name__ == "__main__":      # check the names and octaves of the sets: label against detected pitch
    import sys
    for name in sys.argv[1:]:
        inst = get(name)
        picks = inst.samples[:: max(len(inst.samples) // 3, 1)][:3]
        print(name, [(s[0], detect_midi(s[2])) for s in picks])
