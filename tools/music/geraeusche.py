"""Die Soundeffekte von Harter Karter. Jeder Effekt ist eine kleine Partitur aus Aufnahmen (Kenney Impact und
RPG Audio, VSCO-2-Geräusche, Body Percussion, alle CC0) und den Instrumenten der Musik:

    python -I tools/music/geraeusche.py [name ...]

Schreibt public/sfx/<name>.ogg (Opus) und .mp4 (AAC) und die Liste der fertigen Effekte nach
src/music/geraeuschDateien.ts. Was im Sound-Studio aufgenommen wurde (public/sounds), geht im Spiel vor;
Effekte ohne Datei (Text-Blips, Telefon, Katze, Schrei, Gitarre, Zischen) spielt weiter der Synth.
"""
import glob
import os
import subprocess
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIER)
import numpy as np  # noqa: E402

import echt  # noqa: E402
import engine as E  # noqa: E402
import synth  # noqa: E402
from kit import Piece  # noqa: E402

synth.register()
echt.register()
SR = E.SR
TP = os.environ.get("THIRDPARTY", r"C:\Users\heike\GameDev\thirdparty")
ROOT = os.path.dirname(os.path.dirname(HIER))
OUT = os.path.join(ROOT, "public", "sfx")
TS = os.path.join(ROOT, "src", "music", "geraeuschDateien.ts")


def ken(n):
    return os.path.join(TP, "kenney_audio", "impact-sounds", "Audio", n + ".ogg")


def rpg(n):
    return os.path.join(TP, "kenney_audio", "rpg-audio", "Audio", n + ".ogg")


def misc(n):
    return os.path.join(TP, "vsco2ce", "Miscellania Raw", "Misc 1", n + ".wav")


def body(n):
    return os.path.join(TP, "party", "body_percussion", "Samples", "body", n + ".wav")


def perc(muster):
    return sorted(glob.glob(os.path.join(TP, "vsco2ce", "Percussion", muster)))[0]


def lies(path):
    if path.endswith(".wav"):
        x, r = E.read_wav(path)
        if r != SR:
            x = E.resample(x, r / SR, int(len(x) * SR / r))
    else:
        x = echt.lies(path, 30.0)
    return np.repeat(x, 2, 1) if x.shape[1] == 1 else x


class Fx:
    def __init__(self, sek):
        self.x = np.zeros((int(sek * SR), 2), np.float32)
        self.p = Piece(60, beats=1, bars=int(sek) + 2)      # ein Schlag = eine Sekunde

    def datei(self, path, gain=1.0, t=0.0, rate=1.0, bis=None, fade=0.03):
        y = lies(path)
        y = E._trim_start(y)
        if rate != 1.0:
            y = E.resample(y, rate, int(len(y) / rate) - 2)
        if bis:
            y = y[: int(bis * SR)].copy()
            f = min(int(fade * SR), len(y))
            y[-f:] *= np.linspace(1, 0, f)[:, None]
        y = y / (np.abs(y).max() + 1e-9)
        a = int(t * SR)
        b = min(len(self.x), a + len(y))
        self.x[a:b] += y[: b - a] * gain

    def note(self, inst, n, t, dur, loud, **o):
        o.setdefault("human", 0.0)
        self.p.note("fx", inst, n, 1, t, dur, loud, **o)

    def rausch(self, t, dur, lo, hi, gain, an=0.01, ab=None):
        n = int(dur * SR)
        k = np.arange(n) / SR
        env = np.minimum(1.0, k / an) * np.exp(-k / ((ab or dur) / 3.0))
        y = np.stack([synth.band(synth.rauschen(dur), lo, hi) for _ in range(2)], 1)[:n] * env[:, None]
        y /= np.abs(y).max() + 1e-9
        a = int(t * SR)
        b = min(len(self.x), a + n)
        self.x[a:b] += y[: b - a] * gain

    def fertig(self, pegel, hall):
        if self.p.S.notes:
            nass = E.render(self.p.S, {"fx": {}}, len(self.x) / SR + 0.5)["fx"]
            nass /= np.abs(nass).max() + 1e-9
            self.x += nass[: len(self.x)] * self.p.gain.get("fx", 1.0)
        x = self.x
        if hall:
            x = x + E.convolve(x, E.hall_ir(hall, predelay=0.012))[: len(x)] * 0.22
        # hinten die Stille weg, kurz ausblenden
        lvl = np.abs(x).max(axis=1)
        last = np.nonzero(lvl > np.abs(x).max() * 0.003)[0]
        x = x[: (last[-1] + int(0.05 * SR)) if len(last) else len(x)]
        f = min(int(0.02 * SR), len(x))
        x[-f:] *= np.linspace(1, 0, f)[:, None]
        # lautester Ausschnitt (100 ms) auf den Zielpegel, Spitzen weich begrenzen
        w = int(0.1 * SR)
        c = np.concatenate([[0.0], np.cumsum((x.astype(np.float64) ** 2).mean(axis=1))])
        rms = np.sqrt(((c[w:] - c[:-w]) / w).max()) if len(x) > w else np.sqrt((x ** 2).mean())
        x = x * (10 ** (pegel / 20.0) / (rms + 1e-9))
        return E.soft_limit(x, 0.95)


# ---------------------------------------------------------------- die Effekte (Länge in s, Zielpegel dBFS, Hall)

def tbn_rutsch(f, von, bis, t, schritt, loud):
    for k, n in enumerate(range(E.midi(von), E.midi(bis) - 1, -1)):
        f.note("tbn", n, t + k * schritt, schritt * 1.4, loud, attack=0.02, legato=1.5, release=0.18)


def bruell(f, tief, lang, laut):
    """Kreatur: Blech-Cluster mit Flatterzunge, Atem darüber, ein Schlag darunter"""
    for k in range(int(lang / 0.045)):
        for n, w in ((tief, 1.0), (tief + 1, 0.7), (tief + 12, 0.6)):
            f.note("tuba" if n < tief + 12 else "tbn", n, k * 0.045, 0.06, laut * w * (1 - 0.5 * k * 0.045 / lang), release=0.05)
    f.rausch(0.02, lang, 180, 2200, 0.35, an=0.08, ab=lang)
    f.note("timp", tief + 24, 0, 1.0, 0.5)


FX = {
    "click": (0.3, -17, 0, lambda f: (f.datei(rpg("metalClick"), 0.8, bis=0.1), f.note("log_hi", 69, 0, 0.1, 0.25))),
    "step": (0.4, -23, 0, lambda f: f.datei(ken("footstep_concrete_001"), 1.0, bis=0.3)),
    "coin": (0.9, -17, 0.4, lambda f: (f.datei(rpg("handleCoins"), 0.9, bis=0.5), f.note("glock", "E7", 0.03, 0.4, 0.3))),
    "kaching": (1.4, -15, 0.6, lambda f: (f.datei(rpg("handleCoins2"), 0.7, bis=0.45), f.note("glock", "C7", 0.14, 0.9, 0.6),
                                         f.note("glock", "G7", 0.16, 0.9, 0.5), f.note("triangle", 90, 0.14, 1.0, 0.45))),
    "error": (0.7, -16, 0.3, lambda f: (f.note("tbn_stac", "Bb2", 0, 0.16, 0.7), f.note("tbn_stac", "A2", 0.17, 0.3, 0.7),
                                       f.note("tuba_stac", "A1", 0.17, 0.3, 0.5))),
    "refuse": (0.9, -16, 0.3, lambda f: tbn_rutsch(f, "D3", "A2", 0, 0.07, 0.55)),
    "angry": (0.7, -15, 0.2, lambda f: (f.note("bsn", "D3", 0, 0.12, 0.75, release=0.06), f.note("bsn", "C#3", 0.14, 0.24, 0.75, release=0.08),
                                       f.note("tuba_stac", "D2", 0, 0.12, 0.5), f.note("tuba_stac", "C#2", 0.14, 0.2, 0.5))),
    "glug": (0.8, -17, 0.2, lambda f: f.datei(misc("bubbles"), 1.0, bis=0.6, rate=0.75)),
    "lighter": (0.8, -18, 0.2, lambda f: (f.datei(rpg("metalLatch"), 0.8, bis=0.2), f.rausch(0.06, 0.12, 3000, 12000, 0.4, an=0.002, ab=0.1),
                                         f.rausch(0.1, 0.6, 250, 1400, 0.3, an=0.05, ab=0.6))),
    "sting": (2.2, -13, 1.2, lambda f: ([f.note(i, n, 0, 0.6, 0.8) for i, n in (("tbn_stac", "D2"), ("tbn_stac", "D3"), ("horn_stac", "A3"),
                                                                               ("horn_stac", "D4"), ("horn_stac", "F4"), ("trps_stc", "D5"))],
                                       f.note("timp", "D3", 0, 1.5, 0.9), f.note("dcrash", 60, 0, 2.0, 0.6),
                                       f.note("vln_trem", "D5", 0.05, 1.6, 0.5, swell=(1.0, 0.6, 0.0, 0.1)))),
    "chime": (1.3, -17, 0.8, lambda f: [(f.note("glock", n, i * 0.07, 0.8, 0.55), f.note("lyre", E.midi(n) - 12, i * 0.07, 0.8, 0.4))
                                        for i, n in enumerate(("C6", "E6", "G6", "C7"))]),
    "thud": (0.7, -14, 0.2, lambda f: (f.datei(ken("impactSoft_heavy_000"), 1.0, bis=0.5), f.datei(body("chestthump_l_vl2_rr1"), 0.6, bis=0.4),
                                      f.note("bd", 36, 0, 0.5, 0.45))),
    "slap": (0.5, -13, 0.2, lambda f: (f.datei(body("cheek_rout_rr1"), 1.0, bis=0.35), f.datei(body("handclap_vl2_rr1"), 0.35, bis=0.2))),
    "siren": (2.2, -15, 0.8, lambda f: [(f.note("horn", n, t, 0.44, 0.8, attack=0.02), f.note("trp", n, t, 0.44, 0.6, attack=0.02),
                                         f.note("tbn", E.midi(n) - 12, t, 0.44, 0.5, attack=0.02))
                                        for t, n in ((0, "A4"), (0.45, "D5"), (0.9, "A4"), (1.35, "D5"))]),
    "bell": (1.6, -17, 0.7, lambda f: (f.note("triangle", 90, 0, 1.3, 0.55), f.datei(perc("Sleighbells_Hit*"), 0.5, bis=0.8),
                                      f.note("glock", "E7", 0.01, 1.0, 0.35))),
    "splash": (1.0, -15, 0.3, lambda f: (f.datei(misc("bubbles2"), 0.8, bis=0.8), f.rausch(0, 0.6, 700, 7000, 0.5, an=0.004, ab=0.4),
                                        f.datei(ken("impactSoft_medium_000"), 0.5, bis=0.3))),
    "thunder": (3.5, -13, 2.5, lambda f: (f.note("timp_roll", "D2", 0, 2.6, 0.9, swell=(1.0, 0.7, 0.0, 0.1)), f.note("bd", 36, 0, 2.0, 0.9),
                                         f.note("gong", 40, 0.05, 3.0, 0.5), f.rausch(0, 3.2, 35, 700, 0.8, an=0.01, ab=2.6),
                                         f.rausch(0, 0.25, 1500, 8000, 0.4, an=0.002, ab=0.2))),
    "rumble": (2.0, -15, 1.0, lambda f: (f.note("timp_roll", "E2", 0, 1.8, 0.8, swell=(0.2, 1.0, 0.0, 0.3)),
                                        f.datei(perc("bassdrum_rub1*"), 0.6, bis=1.6), f.rausch(0, 1.8, 30, 260, 0.6, an=0.2, ab=1.8))),
    "growl": (1.2, -15, 0.4, lambda f: bruell(f, E.midi("F1"), 0.8, 0.5)),
    "roar": (1.9, -13, 0.8, lambda f: bruell(f, E.midi("E1"), 1.4, 0.75)),
    "demon": (2.4, -12, 1.4, lambda f: (bruell(f, E.midi("C1"), 1.8, 0.85), f.note("choir_a", "C3", 0, 1.8, 0.6, attack=0.05),
                                       f.note("choir_a", "C#3", 0, 1.8, 0.5, attack=0.05), f.note("organ_loud", "C2", 0, 1.8, 0.5))),
    "chomp": (0.5, -16, 0.1, lambda f: (f.datei(rpg("chop"), 0.8, rate=1.3, bis=0.2), f.datei(body("cheek_lin_rr1"), 0.5, t=0.06, bis=0.2))),
    "rummage": (0.9, -18, 0.2, lambda f: [f.datei(rpg(n), 0.75, t=t, bis=0.22) for n, t in (("cloth1", 0), ("handleSmallLeather", 0.13),
                                                                                         ("cloth3", 0.27), ("beltHandle1", 0.4))]),
    "clang": (1.2, -14, 0.5, lambda f: (f.datei(rpg("metalPot1"), 1.0, bis=1.0), f.note("anvil", 84, 0, 0.6, 0.35))),
    "retch": (1.0, -15, 0.3, lambda f: (f.note("tbn", "F2", 0, 0.7, 0.55, attack=0.1, swell=(0.2, 1.0, 0.2, 0.4)),
                                       f.note("bsn", "C2", 0.05, 0.6, 0.5, attack=0.08), f.rausch(0.05, 0.7, 150, 1400, 0.45, an=0.15, ab=0.7))),
    "puke": (1.4, -14, 0.3, lambda f: (f.datei(misc("bubbles"), 0.9, rate=0.65, bis=1.2), f.rausch(0, 1.1, 300, 4500, 0.6, an=0.02, ab=1.0),
                                      f.datei(misc("bubbles2"), 0.5, t=0.4, rate=0.8, bis=0.8))),
    "gurgle": (1.0, -16, 0.2, lambda f: f.datei(misc("bubbles4"), 1.0, rate=0.55, bis=0.9)),
    "fart": (0.8, -15, 0.1, lambda f: ([f.note("tuba", "F1" if k % 2 else "E1", k * 0.03, 0.05, 0.7 * (1 - k / 22), release=0.03) for k in range(18)],
                                      f.note("bsn", "F2", 0, 0.45, 0.4, release=0.08), f.rausch(0, 0.5, 70, 500, 0.4, an=0.01, ab=0.45))),
    "whoosh": (0.7, -17, 0.2, lambda f: [f.rausch(k * 0.07, 0.35, lo, lo * 4, 0.5, an=0.12, ab=0.3) for k, lo in enumerate((300, 600, 1200, 2400))]),
    "crack": (1.4, -13, 0.6, lambda f: (f.datei(ken("impactMining_000"), 1.0, bis=0.5), f.datei(misc("brick_scrape"), 0.6, t=0.06, bis=0.9),
                                       f.note("timp", "E2", 0, 1.0, 0.7), f.note("bd", 36, 0, 0.8, 0.5))),
    "glocke": (3.5, -15, 1.5, lambda f: (f.note("tb", "E3", 0, 3.2, 0.85), f.note("tb", "B3", 0.01, 3.0, 0.4), f.note("gong", 40, 0, 3.0, 0.25))),
    "gameover": (2.6, -15, 0.8, lambda f: [f.note("tbn", n, t, d, 0.6, attack=0.03, legato=1.0, release=0.3)
                                           for n, t, d in (("G3", 0, 0.33), ("F#3", 0.36, 0.33), ("F3", 0.72, 0.33), ("E3", 1.08, 1.2))]),
}


def enc(wav, base):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libopus", "-b:a", "64k", base + ".ogg"], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "aac", "-b:a", "96k", base + ".mp4"], check=True)


if __name__ == "__main__":
    namen = sys.argv[1:] or list(FX)
    os.makedirs(OUT, exist_ok=True)
    tmp = os.path.join(ROOT, "export", "sfx")
    os.makedirs(tmp, exist_ok=True)
    for name in namen:
        sek, pegel, hall, fn = FX[name]
        f = Fx(sek)
        fn(f)
        x = f.fertig(pegel, hall)
        w = os.path.join(tmp, name + ".wav")
        E.write_wav(w, x)
        enc(w, os.path.join(OUT, name))
        print("  %-9s %.2f s" % (name, len(x) / SR), flush=True)
    fertig = sorted(os.path.splitext(n)[0] for n in os.listdir(OUT) if n.endswith(".ogg"))
    with open(TS, "w", encoding="utf8") as fh:
        fh.write("// Von tools/music/geraeusche.py erzeugt: Soundeffekte, die als Datei in public/sfx/ liegen.\n")
        fh.write("export const GERAEUSCHE: readonly string[] = [%s];\n" % ", ".join("'%s'" % n for n in fertig))
    print("fertig", flush=True)
