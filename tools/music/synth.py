"""Selbstgebaute Instrumente für Harter Karter. Sie ergänzen die Orchester-Samples (VSCO 2 CE, wie in
Dodeka Pylai) um das, was eine Kneipe, ein Stripclub und ein Höllenkeller brauchen: E-Piano,
Synthbass, Disco- und Metal-Schlagzeug, Besen, Ride, verzerrte Gitarre, Chiptune. Alles wird hier
mit numpy erzeugt, ohne fremde Samples. register() trägt sie in kit.CAT, kit.DEF und kit.BUS ein.
"""
import numpy as np

import engine as E
import kit

SR = E.SR
RNG = np.random.default_rng(23)


def hz(n):
    return 440.0 * 2 ** ((n - 69) / 12.0)


def zeit(sec):
    return np.arange(int(sec * SR)) / SR


def band(x, lo, hi, steil=4.0):
    """Bandpass per FFT mit weichen Flanken (x mono)."""
    n = len(x)
    size = 1 << (n - 1).bit_length()
    f = np.fft.rfftfreq(size, 1.0 / SR)
    g = 1.0 / (1 + (lo / np.maximum(f, 1.0)) ** steil) / (1 + (f / hi) ** steil)
    return np.fft.irfft(np.fft.rfft(x, size) * g, size)[:n]


def rauschen(sec):
    return RNG.normal(0.0, 1.0, int(sec * SR))


class Gen(E.Instrument):
    """Ein Instrument aus erzeugten Tönen: make(note, loud) -> (n,) oder (n, 2)."""

    def __init__(self, make, notes, louds=(0.4, 0.85), sustain=False, gain=1.0):
        self.samples, self.sustain, self.gain = [], sustain, gain
        for n in notes:
            for ld in louds:
                x = np.asarray(make(n, ld), dtype=np.float64)
                if x.ndim == 1:
                    x = x[:, None]
                rms = np.sqrt((x[: int(0.3 * SR)] ** 2).mean()) + 1e-9
                self.samples.append((n, ld, (x * (0.12 / rms * (0.6 + 0.4 * ld))).astype(np.float32)))
        self.base = notes[len(notes) // 2]


# ---------------------------------------------------------------- Tasten und Bass

def epiano(n, ld, sec=4.0):
    """FM-E-Piano (Rhodes-artig) mit Zinken-Anschlag und Stereo-Tremolo."""
    f, t = hz(n), zeit(sec)
    idx = (0.7 + 2.0 * ld) * np.exp(-t * 2.6)
    m = np.sin(2 * np.pi * f * t)
    x = np.sin(2 * np.pi * f * t + idx * m)
    x += 0.3 * np.sin(4 * np.pi * f * t + 0.5 * idx * m) * np.exp(-t * 1.6)
    x += (0.05 + 0.1 * ld) * np.sin(2 * np.pi * f * 14.0 * t) * np.exp(-t * 45)
    x *= (1 - np.exp(-t * 700)) * np.exp(-t * (0.55 + max(0, n - 48) * 0.035))
    tr = 0.16 * np.sin(2 * np.pi * 4.3 * t)
    return np.stack([x * (1 + tr), x * (1 - tr)], 1)


def saege(f, t, hell, max_hz=6000.0):
    """Bandbegrenzte Sägezahnwelle, die Helligkeit (Grenzharmonische über die Zeit) als Filter."""
    x = np.zeros_like(t)
    for k in range(1, max(1, int(max_hz / f)) + 1):
        x += np.sin(2 * np.pi * k * f * t + RNG.uniform(0, 0.3)) / k / (1 + (k / hell) ** 4)
    return x


def sbass(n, ld, sec=1.6):
    """Synthbass: Säge mit zuschnappendem Filter plus Sinus darunter (Disco, Funk)."""
    f, t = hz(n), zeit(sec)
    x = saege(f, t, 2.0 + (8 + 10 * ld) * np.exp(-t * 9)) + 0.6 * np.sin(2 * np.pi * f * t)
    return x * (1 - np.exp(-t * 400)) * np.exp(-t * 1.4)


# ---------------------------------------------------------------- Schlagzeug

def kick(n, ld, sec=0.7):
    t = zeit(sec)
    fr = 46 + (90 + 60 * ld) * np.exp(-t * 26)
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 6.0)
    x += 0.25 * band(rauschen(sec), 1500, 6000) * np.exp(-t * 260) * ld
    return x


def snare_e(n, ld, sec=0.5):
    """Elektronische Snare: Ton plus Rauschteppich (Metal, Disco)."""
    t = zeit(sec)
    ton = np.sin(2 * np.pi * np.cumsum(180 + 60 * np.exp(-t * 40)) / SR) * np.exp(-t * 22)
    return 0.6 * ton + band(rauschen(sec), 1200, 9000) * np.exp(-t * (11 - 3 * ld))


def clap(n, ld, sec=0.5):
    t = zeit(sec)
    env = np.exp(-t * 14)
    for d in (0.0, 0.011, 0.022):
        env += 1.5 * np.exp(-np.maximum(t - d, 0) * 180) * (t >= d)
    return band(rauschen(sec), 900, 3500) * env


def hat(n, ld, sec=0.25, auf=False):
    t = zeit(sec if not auf else 0.9)
    x = band(rauschen(len(t) / SR), 6500, 16000, 3.0)
    for fr in (3204, 4410, 5370, 6920):        # etwas Metall
        x += 0.08 * np.sign(np.sin(2 * np.pi * fr * t))
    return band(x, 6000, 17000) * np.exp(-t * (5.5 if auf else 60))


def besen(n, ld, sec=0.6):
    """Jazzbesen: ein Wischen mit weichem Einsatz."""
    t = zeit(sec)
    return band(rauschen(sec), 700, 7000, 2.0) * (1 - np.exp(-t * 50)) * np.exp(-t * 8)


def ride(n, ld, sec=2.6):
    t = zeit(sec)
    x = 0.4 * band(rauschen(sec), 5000, 14000) * np.exp(-t * 3.0)
    for k, fr in enumerate((3150, 4630, 6020, 7330, 8810, 10120)):
        x += np.sin(2 * np.pi * fr * t + k) * np.exp(-t * (1.6 + k * 0.5)) / (1 + k * 0.4)
    x += 0.6 * band(rauschen(sec), 3000, 12000) * np.exp(-t * 90) * ld      # Ping
    return x


def chipsnare(n, ld, sec=0.3):
    """Rauschen wie aus einer alten Konsole: grob abgetastet."""
    t = zeit(sec)
    x = np.repeat(RNG.uniform(-1, 1, len(t) // 6 + 1), 6)[: len(t)]
    return x * np.exp(-t * 16)


# ---------------------------------------------------------------- Gitarre (verzerrt, durch die Box)

BOX = [(60, -24), (90, -6), (130, 2), (400, -2), (900, 0), (2400, 3), (4200, -2), (6000, -16), (9000, -36)]


def box(x):
    return E.eq(x, BOX)


def gezupft(f, t, daempf):
    """Angeschlagene Saite: Harmonische klingen ab, die hohen schneller."""
    x = np.zeros_like(t)
    for k in range(1, int(5000 / f) + 1):
        x += np.sin(2 * np.pi * k * f * t + RNG.uniform(0, 6.3)) / k ** 0.9 * np.exp(-t * (0.5 + k * daempf))
    return x


def zerre(n, ld, sec=3.0, daempf=0.07, drive=9.0):
    """Powerchord (Grundton, Quinte, Oktave), doppelt eingespielt (links, rechts), verzerrt."""
    t = zeit(sec)
    seiten = []
    for cents in (-5.0, 5.0):
        f = hz(n) * 2 ** (cents / 1200)
        x = gezupft(f, t, daempf) + 0.8 * gezupft(f * 1.4983, t, daempf) + 0.5 * gezupft(f * 2, t, daempf)
        x = np.tanh(drive * (0.7 + 0.5 * ld) * x / (np.abs(x).max() + 1e-9))
        seiten.append(x * (1 - np.exp(-t * 900)))
    return box(np.stack(seiten, 1))


def chug(n, ld):
    """Palm-Mute: kurz, dumpf, viel Druck."""
    t = zeit(0.5)
    return zerre(n, ld, 0.5, daempf=0.45, drive=12.0) * np.exp(-t * 5.0)[:, None]


def glead(n, ld, sec=3.0):
    """Leadgitarre: singt, mit spät einsetzendem Vibrato."""
    t = zeit(sec)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.6 * t) * np.clip((t - 0.25) * 2, 0, 1)
    ph = 2 * np.pi * np.cumsum(hz(n) * vib) / SR
    x = np.zeros_like(t)
    for k in range(1, int(5000 / hz(n)) + 1):
        x += np.sin(k * ph) / k
    x = np.tanh(14 * (0.6 + 0.5 * ld) * x / (np.abs(x).max() + 1e-9)) * (1 - np.exp(-t * 300))
    x = box(np.stack([x, np.roll(x, 400)], 1))
    return x


# ---------------------------------------------------------------- Chiptune

def puls(n, ld, sec=2.0, breite=0.25):
    f, t = hz(n), zeit(sec)
    x = np.zeros_like(t)
    for k in range(1, int(9000 / f) + 1):
        x += np.sin(np.pi * k * breite) / k * np.cos(2 * np.pi * k * f * t)
    return x * (1 - np.exp(-t * 2000))


def dreieck(n, ld, sec=2.0):
    f, t = hz(n), zeit(sec)
    x = np.zeros_like(t)
    for k in range(1, int(6000 / f) + 1, 2):
        x += (-1) ** ((k - 1) // 2) / k ** 2 * np.sin(2 * np.pi * k * f * t)
    return x * (1 - np.exp(-t * 2000))


# ---------------------------------------------------------------- Eintragen

def register():
    cat = {
        "epiano": lambda: Gen(epiano, list(range(33, 97, 4)), gain=0.9),
        "sbass": lambda: Gen(sbass, list(range(24, 64, 3)), gain=1.0),
        "kick": lambda: Gen(kick, [36], gain=1.1),
        "esnare": lambda: Gen(snare_e, [38], gain=0.8),
        "clap": lambda: Gen(clap, [39], gain=0.7),
        "hat": lambda: Gen(hat, [42], gain=0.45),
        "hat_o": lambda: Gen(lambda n, ld: hat(n, ld, auf=True), [46], gain=0.35),
        "besen": lambda: Gen(besen, [38], gain=0.5),
        "ride": lambda: Gen(ride, [51], gain=0.32),
        "chipsnare": lambda: Gen(chipsnare, [38], gain=0.5),
        "zerre": lambda: Gen(zerre, list(range(28, 58, 2)), sustain=True, gain=0.8),
        "chug": lambda: Gen(chug, list(range(28, 58, 2)), gain=0.9),
        "glead": lambda: Gen(glead, list(range(52, 92, 3)), sustain=True, gain=0.7),
        "puls": lambda: Gen(puls, list(range(48, 100, 4)), sustain=True, gain=0.5),
        "puls50": lambda: Gen(lambda n, ld: puls(n, ld, breite=0.5), list(range(48, 100, 4)), sustain=True, gain=0.45),
        "dreieck": lambda: Gen(dreieck, list(range(28, 76, 4)), sustain=True, gain=0.9),
    }
    kit.CAT.update(cat)
    kit.DEF.update({
        "epiano": dict(release=0.45, human=0.008), "sbass": dict(release=0.06, human=0.002),
        "zerre": dict(release=0.08, human=0.002), "chug": dict(release=0.05, human=0.002),
        "glead": dict(attack=0.01, release=0.25, legato=1.0, human=0.004),
        "puls": dict(release=0.03, human=0.0), "puls50": dict(release=0.03, human=0.0), "dreieck": dict(release=0.03, human=0.0),
        **{k: dict(release=0.3, human=0.002) for k in ("kick", "esnare", "clap", "hat", "hat_o", "besen", "ride", "chipsnare")},
    })
    kit.BUS.update({
        "keys": (0.18, 0.42, [(40, -12), (150, -2), (800, 0), (4000, 0), (12000, -6)], 0.85),
        "bass": (0.0, 0.15, [(25, -6), (50, 1), (200, 0), (1500, -3), (5000, -12)], 0.9),
        "kit": (0.0, 0.16, [(28, -3), (60, 2), (300, 0), (4000, 0), (12000, -2)], 0.9),
        "hats": (0.28, 0.2, [(300, -14), (2000, -2), (8000, 0), (15000, -3)], 0.5),
        "gtr": (0.0, 0.18, [(70, -10), (120, 0), (2000, 0), (6000, -3)], 0.9),
        "chip": (0.0, 0.22, [(60, -8), (200, 0), (6000, 0), (14000, -6)], 0.6),
    })
