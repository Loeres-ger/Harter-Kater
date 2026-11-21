"""Echte Instrumente für Kneipe, Gasse, Club und Hölle, aus freien Sample-Bibliotheken (liegen außerhalb des
Repos in thirdparty/party, Pfad über die Umgebungsvariable PARTY; Lizenzen siehe public/credits.html):

    piano   Flügel          Salamander Grand Piano V3 (Alexander Holm, CC-BY 3.0)
    wurli   Wurlitzer EP200 Greg Sullivan E-Pianos (CC-BY 3.0)
    tsax    Tenorsaxophon   MTG Solo Saxophones (MTG/UPF Barcelona, CC-BY 4.0), ebenso asax (Alt)
    trp     Trompete        Sonatina Symphonic Orchestra (CC Sampling Plus 1.0), trps_stc: Satz staccato
    ebass   E-Bass          Growlybass (Karoryfer, CC0)
    d*      Schlagzeug      MuldjordKit (Lars Muldjord, CC-BY 4.0), aus Overhead-, Raum- und Nahmikros gemischt

FLAC wird mit ffmpeg gelesen. Fertige Instrumente landen als Cache in export/samples/ (erster Lauf dauert).
"""
import os
import pickle
import re
import subprocess

import numpy as np

import engine as E
import kit

SR = E.SR
PARTY = os.environ.get("PARTY", r"C:\Users\heike\GameDev\thirdparty\party")
CACHE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "export", "samples")
KIT = os.path.join(PARTY, "drums_muldjord", "DrumGizmo", "MuldjordKit", "Samples")


def lies(path, sek, ac=2):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-t", str(sek), "-f", "f32le", "-acodec", "pcm_f32le",
                          "-ar", str(SR), "-ac", str(ac), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype="<f4").reshape(-1, ac).astype(np.float32)


def norm(x, loud, sustain):
    """wie engine.prepare: stillen Anfang weg, auf einen Pegel bringen"""
    x = E._trim_start(x)
    body = x[int(0.05 * SR): int((1.6 if sustain else 0.6) * SR)]
    if not len(body):
        body = x
    rms = float(np.sqrt((body.astype(np.float64) ** 2).mean()))
    return (x * (0.12 / rms * (0.6 + 0.4 * loud))).astype(np.float32) if rms > 1e-7 else x


class Fertig(E.Instrument):
    def __init__(self, samples, sustain, gain=1.0):
        self.samples, self.sustain, self.gain = samples, sustain, gain
        self.base = sorted(s[0] for s in samples)[len(samples) // 2]


def name_midi(s):
    return E.midi(s[0].upper() + s[1:])


def piano():
    d = os.path.join(PARTY, "piano_salamander", "Samples")
    out = []
    for f in sorted(os.listdir(d)):
        mm = re.fullmatch(r"([A-G]#?)(\d)v(\d+)\.flac", f)
        if mm and int(mm.group(3)) in (5, 10, 15):
            n = E.midi(mm.group(1) + mm.group(2))
            if 28 <= n <= 100:
                ld = {5: 0.35, 10: 0.65, 15: 0.95}[int(mm.group(3))]
                out.append((n, ld, norm(lies(os.path.join(d, f), 7.0), ld, False)))
    return Fertig(out, False, 0.9)


def wurli():
    d = os.path.join(PARTY, "epianos_gregsullivan", "Wurlitzer EP200", "Samples")
    out = []
    for f in sorted(os.listdir(d)):
        mm = re.fullmatch(r"([a-g][#b]?)(\d)(pp|mp|f|ff)\.flac", f)
        if mm and mm.group(3) in ("mp", "f", "ff"):
            ld = {"mp": 0.45, "f": 0.75, "ff": 0.95}[mm.group(3)]
            out.append((name_midi(mm.group(1) + mm.group(2)), ld, norm(lies(os.path.join(d, f), 5.0), ld, False)))
    return Fertig(out, False, 0.9)


def sax(art):
    base = os.path.join(PARTY, "mtg_solosax", "MTG Solo Saxophones")
    out = []
    for dyn, ld in (("p", 0.4), ("f", 0.85)):
        for line in open(os.path.join(base, "Data", "%s_%s_rr1.txt" % (art, dyn)), encoding="utf8"):
            mm = re.search(r"key=(\d+) sample=(\S+)\.\$EXT.*?tune=(-?\d+)", line)
            if not mm:
                continue
            x = lies(os.path.join(base, "Samples", mm.group(2) + ".flac"), 4.0)
            r = 2 ** (int(mm.group(3)) / 1200.0)          # die Stimmkorrektur der SFZ gleich einrechnen
            x = E.resample(x, r, int(len(x) / r) - 2)
            out.append((int(mm.group(1)), ld, norm(x, ld, True)))
    return Fertig(out, True, 0.85)


def trompete(stc=False):
    d = os.path.join(PARTY, "sso_trumpets", "Sonatina Symphonic Orchestra", "Samples", "Trumpets" if stc else "Trumpet")
    rx = r"trumpets-stc-rr1-([a-g]#?)(\d)\.wav" if stc else r"trumpet-([a-g]#?)(\d)\.wav"
    ent = [(os.path.join(d, f), name_midi(mm.group(1) + mm.group(2)), 0.7)
           for f in sorted(os.listdir(d)) for mm in [re.fullmatch(rx, f)] if mm]
    return kit.Samples(ent, sustain=not stc, gain=0.8)


def ebass():
    d = os.path.join(PARTY, "bass_growlybass", "Growlybass", "sustain")
    out = []
    for f in sorted(os.listdir(d)):
        mm = re.fullmatch(r"([a-g]b?)(\d)_(\w+?)_rr1\.wav", f)
        if mm:
            ld = {"p": 0.35, "mf": 0.6, "f": 0.85}.get(mm.group(3), 0.6)
            x = E.prepare(os.path.join(d, f), ld, True)
            out.append((name_midi(mm.group(1) + mm.group(2)), ld, x))
    inst = Fertig(out, True, 0.9)
    # Oktave prüfen: Beschriftung gegen erkannte Tonhöhe
    n, _, x = inst.samples[len(inst.samples) // 2]
    shift = int(round((kit.detect_midi(x) - n) / 12.0)) * 12
    inst.samples = [(a + shift, b, c) for a, b, c in inst.samples]
    return inst


def trommel(ordner, nah, n=6, sek=1.5):
    """Ein Teil des Schlagzeugs: von allen Anschlägen n über die Lautstärke verteilt, je Anschlag die Mikros gemischt."""
    d = os.path.join(KIT, ordner)
    idx = sorted({int(f.split("-")[0]) for f in os.listdir(d) if f[0].isdigit()})
    mik = lambda i, m: os.path.join(d, "%d-%s-%s.flac" % (i, ordner, m))
    ref = next(iter(nah)) if nah else "OHL"
    kraft = [(float(np.abs(lies(mik(i, ref), 0.25, 1)).max()), i) for i in idx]
    kraft.sort()
    wahl = [kraft[int(round(k * (len(kraft) - 1) / (n - 1)))][1] for k in range(n)]
    out = []
    for rang, i in enumerate(wahl):
        oh = [lies(mik(i, m), sek, 1)[:, 0] for m in ("OHL", "OHR", "AmbL", "AmbR")]
        lang = max(len(o) for o in oh)
        pad = lambda v: np.pad(v, (0, lang - len(v)))
        l, r, al, ar = (pad(o) for o in oh)
        close = sum(pad(lies(mik(i, m), sek, 1)[:, 0]) * w for m, w in nah.items()) if nah else 0
        x = np.stack([l + 0.35 * al + 0.7 * close, r + 0.35 * ar + 0.7 * close], 1)
        ld = 0.25 + 0.75 * rang / (n - 1)
        out.append((60, ld, (x * (0.6 * (0.6 + 0.4 * ld) / (np.abs(x).max() + 1e-9))).astype(np.float32)))   # nach Spitze, nicht nach Ausklang
    return Fertig(out, False, 1.0)


def gecacht(name, fn):
    def lade():
        p = os.path.join(CACHE, name + ".pkl")
        if os.path.exists(p):
            with open(p, "rb") as f:
                samples, sustain, gain = pickle.load(f)
            inst = Fertig(samples, sustain, gain)
        else:
            inst = fn()
            os.makedirs(CACHE, exist_ok=True)
            with open(p, "wb") as f:
                pickle.dump((inst.samples, inst.sustain, inst.gain), f)
        return inst
    return lade


def register():
    cat = {
        "piano": piano, "wurli": wurli, "tsax": lambda: sax("ten"), "asax": lambda: sax("alt"),
        "trp": trompete, "trps_stc": lambda: trompete(True), "ebass": ebass,
        "dkick": lambda: trommel("KdrumL", {"KdrumL": 1.0}), "dkick2": lambda: trommel("KdrumR", {"KdrumR": 1.0}),
        "dsnare": lambda: trommel("Snare", {"Snare_top": 1.0, "Snare_bottom": 0.4}, n=8),
        "dhat": lambda: trommel("HihatClosed", {"Hihat": 1.0}, sek=0.8),
        "dhat_o": lambda: trommel("HihatOpen", {"Hihat": 1.0}, n=4, sek=2.5),
        "dride": lambda: trommel("RideL", {"RideL": 0.6}, sek=3.0),
        "dcrash": lambda: trommel("CrashL", {}, n=4, sek=4.0),
        "dchina": lambda: trommel("China", {}, n=4, sek=3.0),
        "dtom": lambda: trommel("Tom2", {"Tom2": 1.0}, n=4), "dtom_lo": lambda: trommel("Tom4", {"Tom4": 1.0}, n=4),
    }
    kit.CAT.update({k: gecacht(k, v) for k, v in cat.items()})
    kit.DEF.update({
        "piano": dict(release=0.5, human=0.006), "wurli": dict(release=0.35, human=0.006),
        "tsax": dict(attack=0.03, release=0.25, legato=1.03), "asax": dict(attack=0.03, release=0.25, legato=1.03),
        "trp": dict(attack=0.03, release=0.3, legato=1.03), "trps_stc": dict(release=0.15), "ebass": dict(release=0.12),
        **{k: dict(release=0.5, human=0.003) for k in cat if k.startswith("d")},
    })
