"""Die Musik von Harter Karter: ein Stück je Szene, geschrieben wie in Dodeka Pylai (Noten als Text,
gerendert mit den VSCO-Samples und den selbstgebauten Instrumenten aus synth.py).

Das Hauptthema (ein Walzer in d-Moll, „das Eimer-Thema“) zieht sich durch Titel, Prolog, Epilog und
Verloren. Die Kneipe hat ihr eigenes Lied, das am Tresen als Ballade wiederkommt.

REG: Name -> (Nummer, Titel, Funktion, Mix-Optionen). Eine Funktion liefert das Piece.
Jeder Takt einer Melodie steht als eigener Text; mel() prüft, dass er genau einen Takt füllt.
"""
import math
import re

import engine as E
import echt
import synth
from kit import Piece

synth.register()
echt.register()
REG = {}


def stueck(nr, titel, **mix):
    def deko(fn):
        REG[fn.__name__] = (nr, titel, fn, mix)
        return fn
    return deko


def m(n, d=0):
    return (E.midi(n) if isinstance(n, str) else n) + d


def lage(n, lo, hi):
    n = m(n)
    while n > hi:
        n -= 12
    while n < lo:
        n += 12
    return n


def swing(text, anteil=0.667):
    """Achtel auf Zählzeit-Hälften werden geswingt: jede Position x.5 rückt nach x.667."""
    def w(x):
        f = x - math.floor(x)
        return math.floor(x) + (anteil if abs(f - 0.5) < 1e-6 else f)
    out, b = [], 0.0
    for tok in text.split():
        parts = tok.split(":")
        d = float(parts[1])
        parts[1] = "%.4f" % (w(b + d) - w(b))
        out.append(":".join(parts))
        b += d
    return " ".join(out)


def mel(p, bus, inst, bar, takte, loud, tr=0, sw=None, **o):
    for k, t in enumerate(takte):
        total = sum(float(x.split(":")[1]) for x in t.split())
        assert abs(total - p.beats) < 1e-3, "%s Takt %d hat %.3f Schläge" % (inst, bar + k, total)
        p.seq(bus, inst, bar + k, swing(t, sw) if sw else t, loud, tr=tr, **o)


def strum(p, bus, inst, bar, beat, chord, dur, loud, spread=0.025, tr=0, **o):
    for k, n in enumerate(chord.split("+")):
        p.note(bus, inst, m(n, tr), bar, beat, dur, loud * (1 - 0.05 * k), delay=k * spread, **o)


def gliss(p, bus, inst, bar, beat, notes, loud, step=0.05):
    ns = notes.split()
    for k, n in enumerate(ns):
        p.note(bus, inst, n, bar, beat, 1.0, loud * (0.6 + 0.4 * k / len(ns)), delay=k * step, human=0.002)


def slide(p, bus, inst, bar, beat, a, b, beats, loud):
    a, b = m(a), m(b)
    n = abs(b - a) + 1
    d = beats / n
    for k in range(n):
        p.note(bus, inst, a + (k if b > a else -k), bar, beat + k * d, d, loud, attack=0.03, legato=1.6, release=0.35)


def hits(p, bus, inst, bar, bars, beats, loud, note=None, **o):
    """Ein Schlag auf jeder der Zählzeiten `beats` (Liste oder (Zählzeit, Lautstärke)) über `bars` Takte."""
    i_note = note
    for k in range(bars):
        for b in beats:
            bt, lv = (b, 1.0) if not isinstance(b, tuple) else b
            p.note(bus, inst, i_note if i_note is not None else 60, bar + k, bt, 0.5, loud * lv, **o)


# ======================================================================== Hauptthema: Walzer in d-Moll

THEMA = ["A4:2 D5:1", "F5:2 E5:1", "D5:1 C#5:1 D5:1", "A4:3",
         "Bb4:2 D5:1", "G5:2 F5:1", "E5:1 D5:1 C#5:1", "E5:3",
         "F5:2 A5:1", "G5:1 F5:1 E5:1", "D5:2 F5:1", "Bb4:1 A4:1 G4:1",
         "A4:1 D5:1 F5:1", "E5:2 C#5:1", "D5:3", "-:3"]
THEMA_AKK = "Dm Dm A7 Dm Gm Gm A7 A7 F C Dm Gm Dm A7 Dm Dm".split()
GEGEN = ["F4:3", "F4:3", "E4:3", "F4:3", "D4:3", "D4:3", "C#4:3", "C#4:3",
         "C4:3", "C4:3", "D4:3", "D4:3", "F4:3", "E4:3", "D4:3", "-:3"]


def dur(takte):
    """Das Thema in D-Dur."""
    return [re.sub(r"Bb(\d)", r"B\1", re.sub(r"F(\d)", r"F#\1", t)) for t in takte]


THEMA_DUR = dur(THEMA)
THEMA_DUR_AKK = "D D A7 D G G A7 A7 D A Bm G D A7 D D".split()
WALZ = {"Dm": ("D2", "D4+F4+A4"), "A7": ("A1", "C#4+E4+G4"), "Gm": ("G1", "D4+G4+Bb4"), "F": ("F1", "C4+F4+A4"),
        "C": ("C2", "C4+E4+G4"), "D": ("D2", "D4+F#4+A4"), "G": ("G1", "D4+G4+B4"), "A": ("A1", "C#4+E4+A4"),
        "Bm": ("B1", "D4+F#4+B4"), "Bb": ("Bb1", "D4+F4+Bb4"), "Eb": ("Eb2", "Eb4+G4+Bb4"), "Cm": ("C2", "C4+Eb4+G4"),
        "F7": ("F1", "C4+Eb4+A4"), "E": ("E2", "E4+G#4+B4"), "C#m": ("C#2", "C#4+E4+G#4"), "G#m": ("G#1", "D#4+G#4+B4"),
        "B": ("B1", "D#4+F#4+B4"), "F#m": ("F#1", "C#4+F#4+A4"), "Am": ("A1", "C4+E4+A4"), "E7": ("E2", "D4+E4+G#4")}


def walzer(p, bar, akk, loud, bass=("pizz", "cb_pizz"), akkord=("lyre", "lyre"), bt=0, ct=0, **o):
    for k, a in enumerate(akk):
        b, ch = WALZ[a]
        if bass:
            p.note(bass[0], bass[1], m(b, 12 + bt), bar + k, 0, 1, loud)
        if akkord:
            for beat in (1, 2):
                strum(p, akkord[0], akkord[1], bar + k, beat, ch, 1, loud * (0.7 if beat == 1 else 0.6), tr=ct, **o)


@stueck(1, "Titel – Harter Karter", target=-21.0, hall=4.0)
def titel():
    """Spieluhr: das Eimer-Thema auf dem Glockenspiel, dann die Klarinette, darunter die Bratschen."""
    p = Piece(100, beats=3, bars=32, seed=1)
    walzer(p, 1, THEMA_AKK * 2, 0.4)
    mel(p, "bells", "glock", 1, THEMA, 0.4, tr=12)
    mel(p, "reed", "clar", 17, THEMA, 0.5)
    mel(p, "vla", "vla", 17, GEGEN, 0.3)
    mel(p, "bells", "glock", 25, THEMA[8:], 0.2, tr=12)
    for b in range(17, 33):
        p.note("low", "tuba", m(WALZ[THEMA_AKK[(b - 1) % 16]][0], 12), b, 0, 1, 0.22)
    p.note("bells", "tb", "D5", 1, 0, 6, 0.25)
    p.note("bells", "tb", "A4", 17, 0, 6, 0.2)
    p.hold("cb", "cb", 1, 16, "D2", 0.12, attack=2.0)
    gliss(p, "lyre", "lyre", 32, 1.5, "A3 D4 F4 A4 D5 F5 A5", 0.3)
    return p


@stueck(2, "Prolog – Regennacht", target=-23.0, hall=6.0)
def prolog():
    """Eine verregnete Nacht: das Thema tief auf der Klarinette, Harfe und Bratschen, ganz unten die Pauke."""
    p = Piece(76, beats=3, bars=24, seed=2)
    p.hold("cb", "cb", 1, 24, "D2", 0.16, attack=3.0, swell=(0.4, 1.0, 0.7, 0.3))
    p.note("timp", "timp_roll", "D2", 1, 0, 9, 0.35, swell=(0.0, 1.0, 0.0, 0.6))
    for b in range(1, 5):
        p.note("lyre", "lyre", "D3", b, 0, 3, 0.3)
        p.note("lyre", "lyre", "A3", b, 1.5, 1.5, 0.22)
    for k, a in enumerate(THEMA_AKK):
        b, ch = WALZ[a]
        bar = 5 + k
        p.note("lyre", "lyre", m(b, 12), bar, 0, 3, 0.3)
        for j, n in enumerate(ch.split("+")):
            p.note("lyre", "lyre", n, bar, 1 + j * 0.5, 2, 0.2)
        p.hold("vla", "vla", bar, 1, ch.split("+")[1], 0.18)
    mel(p, "reed", "clar", 5, THEMA, 0.42, tr=-12)
    mel(p, "vc", "vc", 13, ["A3:3", "G3:3", "F3:3", "E3:3", "F3:3", "E3:3", "D3:3", "A2:3"], 0.25)
    for b in range(21, 25):
        p.note("lyre", "lyre", "D3", b, 0, 3, 0.26)
    p.note("bells", "tb", "D4", 21, 0, 6, 0.18)
    p.note("timp", "timp_roll", "A2", 24, 0, 3, 0.25, swell=(0.0, 1.0, 0.5, 0.9))
    return p


@stueck(3, "Epilog – Morgengrauen", target=-21.0, hall=5.0)
def epilog():
    """Am nächsten Morgen: das Thema in Dur, erst Flöte und Harfe, dann die Geigen mit Hörnern."""
    p = Piece(88, beats=3, bars=32, seed=3)
    akk = THEMA_DUR_AKK * 2
    walzer(p, 1, akk[:16], 0.36)
    walzer(p, 17, akk[16:], 0.42, bass=("low", "tuba"), akkord=("horn", "horn_stac"), ct=-12)
    mel(p, "flute", "flute", 1, THEMA_DUR, 0.45)
    mel(p, "vln", "vln", 17, THEMA_DUR, 0.5)
    mel(p, "flute", "flute", 25, THEMA_DUR[8:], 0.32, tr=12)
    for k, a in enumerate(akk):
        tones = WALZ[a][1].split("+")
        p.note("vc", "vc", m(WALZ[a][0], 12), 1 + k, 0, 3, 0.22)
        p.note("vla", "vla", tones[1], 1 + k, 0, 3, 0.16)
    p.note("timp", "timp", "D3", 17, 0, 2, 0.45)
    for b in (1, 9, 17, 25):
        p.note("bells", "glock", "A6", b, 0, 2, 0.18)
    return p


@stueck(4, "Verloren", target=-23.0, hall=4.0)
def verloren():
    """Das Thema auf dem Fagott, schleppend; die Harfe zupft nur noch."""
    p = Piece(66, beats=3, bars=8, seed=4)
    takte = THEMA[:4] + THEMA[12:]
    akk = "Dm Dm A7 Dm Dm A7 Dm Dm".split()
    walzer(p, 1, akk, 0.3, bass=("low", "tuba"))
    mel(p, "reed", "bsn", 1, takte, 0.45, tr=-12)
    p.note("bells", "tb", "D4", 1, 0, 6, 0.15)
    p.seq("low", "tbn", 7, "A2:1 Ab2:1 G2:1.5 F#2:2.5", 0.2, attack=0.08)
    return p


# ======================================================================== Die Kneipe: Swing in F-Dur

KN_A = ["-:0.5 C5:0.5 D5:0.5 F5:0.5 A5:1.5 G5:0.5", "F#5:1 D5:0.5 C5:0.5 A4:2",
        "-:0.5 Bb4:0.5 D5:0.5 F5:0.5 A5:1 G5:1", "E5:0.5 F5:0.5 E5:0.5 D5:0.5 C5:2",
        "-:0.5 C5:0.5 D5:0.5 F5:0.5 A5:1.5 C6:0.5", "A5:1 F#5:0.5 A5:0.5 D6:2",
        "C6:0.5 Bb5:0.5 A5:0.5 G5:0.5 E5:0.5 D5:0.5 C5:0.5 Bb4:0.5", "A4:1.5 F4:0.5 -:2"]
KN_A2 = KN_A[:7] + ["A4:1 F4:3"]
KN_B = ["D5:1.5 F5:0.5 G5:1 F5:1", "Db5:1.5 F5:0.5 G5:1 F5:1",
        "C5:0.5 D5:0.5 C5:0.5 A4:0.5 F4:2", "F#4:0.5 A4:0.5 C5:0.5 D5:0.5 F#5:2",
        "G5:1.5 F5:0.5 D5:1 B4:1", "A4:0.5 B4:0.5 D5:0.5 F5:0.5 A5:2",
        "Bb5:1 A5:0.5 G5:0.5 F5:1 D5:1", "E5:1 G5:1 Bb5:1 -:1"]
KN_AKK_A = ["F6", "D7", "Gm7", "C7", "F6", "D7", "Gm7 C7", "F6 C7"]
KN_AKK_B = ["Bb6", "Bbm6", "F6", "D7", "G7", "G7", "Gm7", "C7"]
KN_FORM = KN_AKK_A + KN_AKK_A[:7] + ["F6"] + KN_AKK_B + KN_AKK_A[:7] + ["F6 C7"]
VOI = {"F6": "A3+C4+D4+F4", "D7": "F#3+C4+E4+A4", "Gm7": "Bb3+D4+F4+A4", "C7": "Bb3+D4+E4+G4",
       "Bb6": "Bb3+D4+F4+G4", "Bbm6": "Bb3+Db4+F4+G4", "G7": "B3+D4+F4+A4"}
GRUND = {"F6": ("F2", 4), "D7": ("D2", 4), "Gm7": ("G2", 3), "C7": ("C2", 4), "Bb6": ("Bb1", 4), "Bbm6": ("Bb1", 3), "G7": ("G2", 4)}


def walking(p, bar, form, loud, bus="pizz", inst="cb_pizz", lo=33, hi=52):
    for k, ch in enumerate(form):
        cs = ch.split()
        nxt = lage(GRUND[form[(k + 1) % len(form)].split()[0]][0], lo, hi)
        r = lage(GRUND[cs[0]][0], lo, hi)
        if len(cs) == 1:
            ns = [r, r + GRUND[cs[0]][1], r + 7, nxt + (1 if k % 2 else -1)]
        else:
            r2 = lage(GRUND[cs[1]][0], lo, hi)
            ns = [r, r + 7, r2, nxt + (1 if k % 2 else -1)]
        for j, n in enumerate(ns):
            p.note(bus, inst, lage(n, lo, hi), bar + k, j, 1, loud * (1.0 if j % 2 == 0 else 0.82))


COMP = [[(0, 0.9, 1.0), (1.667, 0.33, 0.8)], [(0.667, 0.33, 0.7), (2.0, 1.0, 1.0)], [(1.0, 0.33, 0.75), (2.667, 1.0, 0.9)]]


def comping(p, bar, form, loud, bus="keys", inst="epiano", tr=0):
    for k, ch in enumerate(form):
        cs = ch.split()
        if len(cs) == 2:
            strum(p, bus, inst, bar + k, 0, VOI[cs[0]], 1.5, loud, tr=tr)
            strum(p, bus, inst, bar + k, 2, VOI[cs[1]], 1.5, loud * 0.9, tr=tr)
        else:
            for beat, d, lv in COMP[(k * 7) % 3]:
                strum(p, bus, inst, bar + k, beat, VOI[cs[0]], d, loud * lv, tr=tr)


def ride_swing(p, bar, bars, loud):
    for k in range(bars):
        for beat, lv in ((0, 0.7), (1, 1.0), (1.667, 0.55), (2, 0.75), (3, 1.0), (3.667, 0.55)):
            p.note("hats", "dride", 60, bar + k, beat, 1, loud * lv)
        for beat in (1, 3):
            p.note("hats", "dhat", 60, bar + k, beat, 0.5, loud * 0.55)
            p.note("kit", "besen", 38, bar + k, beat, 1, loud * 0.8)
        if k % 4 == 3:          # ein leiser Nachschlag auf der Snare
            p.note("kit", "dsnare", 60, bar + k, 3.667, 0.5, loud * 0.45)


@stueck(10, "Zum Goldenen Eimer", target=-21.0, hall=2.6, wet=0.6)
def kneipe():
    """Die Kneipe: ein Swing in F, AABA, zweimal. Klarinette vorne, dann die Posaune, E-Piano, Kontrabass."""
    p = Piece(112, beats=4, bars=64, seed=10)
    p.gain["hats"] = 0.6
    form = KN_FORM * 2
    walking(p, 1, form, 0.5)
    comping(p, 1, form, 0.32, inst="piano")
    ride_swing(p, 1, 64, 0.34)
    hits(p, "kit", "dkick", 1, 64, [0, (2, 0.7)], 0.16, note=60)
    mel(p, "reed", "clar", 1, KN_A, 0.5, sw=0.667)
    mel(p, "reed", "clar", 9, KN_A2, 0.5, sw=0.667)
    mel(p, "reed", "clar", 17, KN_B, 0.5, sw=0.667)
    mel(p, "reed", "clar", 25, KN_A, 0.5, sw=0.667)
    mel(p, "reed", "tsax", 33, KN_A, 0.5, tr=-12, sw=0.667)
    mel(p, "reed", "tsax", 41, KN_A2, 0.5, tr=-12, sw=0.667)
    mel(p, "reed", "clar", 49, KN_B, 0.48, sw=0.667)
    mel(p, "horn", "tbn", 49, ["D4:4", "Db4:4", "C4:4", "C4:4", "B3:4", "B3:4", "Bb3:4", "Bb3:4"], 0.22)
    mel(p, "reed", "clar", 57, KN_A, 0.45, sw=0.667)
    mel(p, "reed", "tsax", 57, KN_A, 0.34, tr=-12, sw=0.667)
    for b in (8, 24, 40):
        p.seq("bells", "glock", b, "C6:0.33 A5:0.33 F5:0.34", 0.18, beat=2.5)
    return p


@stueck(11, "Am Tresen – später", target=-22.0, hall=2.4, wet=0.55)
def tresen():
    """Das Kneipenlied als Ballade: nah, müde, freundlich. E-Piano, Besen, Klarinette, Cello."""
    p = Piece(72, beats=4, bars=32, seed=11)
    form = KN_AKK_A + KN_AKK_B + KN_AKK_A[:7] + ["F6"] + KN_AKK_A
    for k, ch in enumerate(form):
        cs = ch.split()
        if len(cs) == 2:
            strum(p, "keys", "wurli", 1 + k, 0, VOI[cs[0]], 2, 0.3, spread=0.04)
            strum(p, "keys", "wurli", 1 + k, 2, VOI[cs[1]], 2, 0.28, spread=0.04)
            p.note("pizz", "cb_pizz", lage(GRUND[cs[0]][0], 33, 50), 1 + k, 0, 2, 0.45)
            p.note("pizz", "cb_pizz", lage(GRUND[cs[1]][0], 33, 50), 1 + k, 2, 2, 0.42)
        else:
            strum(p, "keys", "wurli", 1 + k, 0, VOI[cs[0]], 3.5, 0.3, spread=0.05)
            r = lage(GRUND[cs[0]][0], 33, 50)
            p.note("pizz", "cb_pizz", r, 1 + k, 0, 2, 0.45)
            p.note("pizz", "cb_pizz", r + 7, 1 + k, 2, 2, 0.38)
        for beat in (1, 3):
            p.note("kit", "besen", 38, 1 + k, beat, 1, 0.3)
        for beat in (0, 1, 2, 3):
            p.note("hats", "dride", 60, 1 + k, beat, 1, 0.14)
    mel(p, "reed", "tsax", 1, KN_A, 0.42, tr=-12, sw=0.62)
    mel(p, "solo", "vc", 9, KN_B, 0.4, tr=-12, sw=0.62)
    mel(p, "keys", "wurli", 17, KN_A2, 0.4, sw=0.62)
    mel(p, "reed", "tsax", 25, KN_A, 0.4, tr=-12, sw=0.62)
    mel(p, "solo", "vc", 25, KN_A, 0.26, tr=-24, sw=0.62)
    return p


# ======================================================================== Klo: Bossa wie im Kaufhausfahrstuhl

WC_AKK = ["Ebmaj7", "Ebmaj7", "Fm7", "Bb7", "Gm7", "C7", "Fm7", "Bb7",
          "Abmaj7", "Abm6", "Gm7", "C7", "Fm7", "Bb7", "Ebmaj7", "Bb7"]
WC_VOI = {"Ebmaj7": ("Eb2", "G3+Bb3+D4+F4"), "Fm7": ("F2", "Ab3+C4+Eb4+G4"), "Bb7": ("Bb1", "Ab3+C4+D4+G4"),
          "Gm7": ("G2", "F3+Bb3+D4+G4"), "C7": ("C2", "E3+Bb3+Db4+G4"), "Abmaj7": ("Ab1", "G3+C4+Eb4+Ab4"),
          "Abm6": ("Ab1", "F3+Ab3+B3+Eb4")}
WC_MEL = ["G5:1.5 F5:0.5 G5:1 Bb5:1", "D5:3 -:1", "C5:1.5 Bb4:0.5 C5:1 Eb5:1", "D5:3 -:1",
          "Bb4:1 D5:1 F5:1.5 G5:0.5", "E5:2 Db5:1 C5:1", "Ab4:1 C5:1 Eb5:1.5 F5:0.5", "D5:2 -:2",
          "Eb5:1.5 C5:0.5 G5:2", "F5:1.5 Eb5:0.5 B4:2", "Bb4:1 D5:1 G5:2", "Bb4:1 Db5:1 E5:2",
          "Ab4:1.5 G4:0.5 F4:1 C5:1", "D5:1.5 C5:0.5 Bb4:1 Ab4:1", "G4:4", "-:2 Bb4:1 D5:1"]


@stueck(12, "Kachelbossa (Toiletten)", target=-23.0, hall=1.6, wet=0.95)
def wc():
    """Klomusik: Bossa nova, als käme sie aus einem alten Deckenlautsprecher. Flöte, dann Marimba."""
    p = Piece(132, beats=4, bars=32, seed=12)
    p.key = {3, 10}
    for k in range(32):
        a = WC_AKK[k % 16]
        r, ch = WC_VOI[a]
        r = lage(r, 31, 48)
        for beat, n, d in ((0, r, 1.5), (1.5, r + 7, 0.5), (2, r + 7, 1.5), (3.5, r, 0.5)):
            p.note("pizz", "cb_pizz", n, 1 + k, beat, d, 0.45)
        for beat in ((0, 1.5, 3) if k % 2 == 0 else (1, 2.5)):
            strum(p, "keys", "wurli", 1 + k, beat, ch, 0.45, 0.26, spread=0.012)
            p.note("hand", "claves", 76, 1 + k, beat, 0.5, 0.2)
        for j in range(8):
            p.note("metal", "tamb", 70, 1 + k, j * 0.5, 0.5, 0.12 if j % 2 else 0.18)
        p.note("kit", "kick", 36, 1 + k, 0, 1, 0.2)
        p.note("kit", "kick", 36, 1 + k, 2, 1, 0.15)
    mel(p, "flute", "flute", 1, WC_MEL, 0.42)
    mel(p, "bells", "marimba", 17, WC_MEL, 0.45, tr=-12)
    mel(p, "flute", "flute_nv", 25, WC_MEL[8:], 0.25)
    for b in (4, 11, 19, 27):        # es tropft
        p.note("bells", "glock", "Bb6", b, 3.25, 0.5, 0.12)
    return p


# ======================================================================== Der Laden: Ländler

LA_A = ["B4:1 D5:1 G5:1", "B5:2 A5:1", "F#5:1 A5:1 C6:1", "A5:2 F#5:1",
        "D5:1 F#5:1 A5:1", "C6:1 B5:1 A5:1", "G5:1 B5:1 D6:1", "B5:2 -:1",
        "B4:1 D5:1 G5:1", "B5:2 A5:1", "C6:1 B5:1 A5:1", "G5:1 E5:1 C5:1",
        "B4:1 G5:1 B5:1", "A5:1 F#5:1 A5:1", "G5:2 D5:1", "G5:2 -:1"]
LA_A_AKK = "G G D7 D7 D7 D7 G G G G C C G D7 G G".split()
LA_T = ["E5:2 G5:1", "C6:2 G5:1", "F5:1 D5:1 B4:1", "G4:2 -:1",
        "F5:2 G5:1", "B5:1 A5:1 G5:1", "E5:1 G5:1 C6:1", "C6:2 -:1",
        "A5:2 C6:1", "A5:1 F5:1 C5:1", "G5:2 E5:1", "C5:2 -:1",
        "D5:1 F5:1 B5:1", "A5:1 G5:1 F5:1", "E5:2 D5:1", "C5:1 D5:1 F#5:1"]
LA_T_AKK = "C C G7 G7 G7 G7 C C F F C C G7 G7 C D7".split()
LA = {"G": ("G1", "D2", "B3+D4+G4"), "D7": ("D2", "A1", "A3+C4+F#4"), "C": ("C2", "G1", "C4+E4+G4"),
      "G7": ("G1", "D2", "B3+D4+F4"), "F": ("F1", "C2", "C4+F4+A4")}


@stueck(13, "Bergkäse-Ländler (Laden)", target=-21.0, hall=3.0)
def laden():
    """Volksmusik zum Einkaufen: Klarinette, Tuba, Hörner, eine Orgel als Quetschkommode."""
    p = Piece(138, beats=3, bars=48, seed=13)
    akk = LA_A_AKK + LA_T_AKK + LA_A_AKK
    for k, a in enumerate(akk):
        r1, r2, ch = LA[a]
        p.note("low", "tuba", m(r1 if k % 2 == 0 else r2, 12), 1 + k, 0, 1, 0.45)
        for beat in (1, 2):
            strum(p, "horn", "horn_stac", 1 + k, beat, ch, 0.5, 0.3, spread=0.01)
            strum(p, "organ", "organ", 1 + k, beat, ch, 0.45, 0.16, spread=0.0, tr=12)
    mel(p, "reed", "clar", 1, LA_A, 0.5)
    mel(p, "flute", "flute", 17, LA_T, 0.45)
    mel(p, "reed", "clar", 17, ["C5:3", "E5:3", "D5:3", "B4:3", "B4:3", "D5:3", "C5:3", "E5:3",
                                "C5:3", "C5:3", "C5:3", "G4:3", "B4:3", "B4:3", "G4:3", "A4:3"], 0.28)
    mel(p, "flute", "flute", 33, LA_A, 0.42)
    mel(p, "reed", "clar", 33, LA_A, 0.4, tr=-12)
    mel(p, "bells", "glock", 33, LA_A[:8], 0.18, tr=12)
    for b in (8, 24, 40):
        p.seq("bells", "xylo", b, "D6:0.5 D6:0.5", 0.3, beat=2)
    return p


# ======================================================================== Gasse und Straße

GA_AKK = ["Cm", "Cm", "Ab7", "G7", "Cm", "Cm", "Fm", "G7", "Ab", "Ab", "Fm", "Fm", "Dm7b5", "G7", "Cm", "G7"]
GA = {"Cm": ("C2", 3, "Eb4+G4+Bb4"), "Ab7": ("Ab1", 4, "Eb4+Gb4+C5"), "G7": ("G1", 4, "D4+F4+B4"),
      "Fm": ("F1", 3, "Ab3+C4+Eb4"), "Ab": ("Ab1", 4, "Eb4+G4+C5"), "Dm7b5": ("D2", 3, "Ab3+C4+F4")}
GA_MEL = ["G4:1.5 Ab4:0.5 G4:1 Eb4:1", "C4:3 -:1", "Eb4:1 Gb4:1 Ab4:1 C5:1", "B4:2 -:0.5 D4:0.5 F4:0.5 Ab4:0.5",
          "G4:1.5 Ab4:0.5 G4:1 Eb5:1", "D5:1 C5:1 G4:2", "Ab4:1 C5:1 F5:1.5 Eb5:0.5", "D5:2 B4:1 G4:1",
          "C5:1.5 Eb5:0.5 Ab5:2", "G5:1 F5:1 Eb5:2", "F5:1.5 Ab4:0.5 C5:2", "Bb4:1 Ab4:1 F4:2",
          "F4:1 Ab4:1 C5:1 D5:1", "B4:1.5 Ab4:0.5 G4:1 F4:1", "Eb4:4", "-:2 D4:1 F4:1"]


@stueck(20, "Hintergasse (Noir)", target=-22.0, hall=4.5, wet=0.7)
def gasse():
    """Hinter dem Haus, nachts, im Regen: Klarinette tief, langsamer Kontrabass, Besen, ferne Glocke."""
    p = Piece(78, beats=4, bars=32, seed=20)
    for k in range(32):
        a = GA_AKK[k % 16]
        r, t, ch = GA[a]
        r = lage(r, 31, 46)
        nxt = lage(GA[GA_AKK[(k + 1) % 16]][0], 31, 46)
        for j, n in enumerate((r, r + t, r + 7, nxt + (1 if k % 2 else -1))):
            p.note("pizz", "cb_pizz", n, 1 + k, j, 1, 0.48 if j % 2 == 0 else 0.4)
        p.hold("vla", "vla_trem" if k % 8 >= 6 else "vla", 1 + k, 1, ch.split("+")[0], 0.14)
        for beat in (1.667, 3.667):
            p.note("pizz", "vln_pizz", ch.split("+")[2], 1 + k, beat, 0.3, 0.18)
        for beat in (1, 3):
            p.note("kit", "besen", 38, 1 + k, beat, 1, 0.26)
            p.note("hats", "hat", 42, 1 + k, beat, 0.5, 0.12)
    mel(p, "reed", "tsax", 1, GA_MEL, 0.48, tr=-12, sw=0.64)
    mel(p, "lead", "trp", 17, GA_MEL, 0.34, sw=0.64)
    mel(p, "reed", "bsn", 25, GA_MEL[8:], 0.26, tr=-12, sw=0.64)
    p.note("bells", "tb", "C4", 1, 0, 8, 0.16)
    p.note("bells", "tb", "G3", 17, 0, 8, 0.14)
    return p


ST_AKK = ["Em7", "Em7", "A7", "A7", "Em7", "Em7", "A7", "A7", "Cmaj7", "Cmaj7", "B7", "B7", "Em7", "Em7", "A7", "B7"]
ST = {"Em7": ("E2", "G3+B3+D4+F#4"), "A7": ("A1", "G3+C#4+E4+B4"), "Cmaj7": ("C2", "G3+B3+E4"), "B7": ("B1", "A3+D#4+F#4")}
ST_MEL = ["-:0.5 B4:0.5 D5:0.5 E5:1 G5:0.5 E5:1", "D5:0.5 B4:0.5 A4:0.5 B4:2.5",
          "-:0.5 C#5:0.5 E5:0.5 G5:1 A5:0.5 G5:1", "E5:0.5 C#5:0.5 A4:3",
          "-:0.5 B4:0.5 D5:0.5 E5:1 G5:0.5 E5:1", "D5:0.5 B4:0.5 A4:0.5 B4:2.5",
          "-:0.5 C#5:0.5 E5:0.5 G5:1 A5:0.5 G5:1", "E5:0.5 G5:0.5 A5:3",
          "B5:1.5 G5:0.5 E5:1 B4:1", "C5:0.5 D5:0.5 E5:0.5 G5:0.5 B5:2",
          "A5:1.5 F#5:0.5 D#5:1 B4:1", "C5:0.5 B4:0.5 A4:0.5 F#4:0.5 D#5:2",
          "E5:1.5 G5:0.5 B5:1 A5:1", "G5:0.5 E5:0.5 D5:0.5 B4:2.5",
          "C#5:1 E5:1 G5:1 A5:1", "F#5:1 D#5:1 B4:1 A4:1"]
FUNK = [(0, 0, 1.0), (0.75, 0, 0.6), (1.5, 12, 0.7), (2.0, 0, 0.8), (2.75, 10, 0.6), (3.0, 7, 0.7), (3.5, 12, 0.55)]
FUNK_DUR = [(0, 0, 1.0), (0.75, 0, 0.6), (1.5, 12, 0.7), (2.0, 0, 0.8), (3.0, 7, 0.7), (3.5, 12, 0.55)]


@stueck(21, "Vor der Tür (Straße)", target=-21.0, hall=3.0, wet=0.6)
def strasse():
    """Die Straße vor dem Eimer: ein lässiger Groove in e-Moll, Pizzicato-Funk, E-Piano, Bläser, Flöte."""
    p = Piece(98, beats=4, bars=32, seed=21)
    for k in range(32):
        a = ST_AKK[k % 16]
        r, ch = ST[a]
        r = lage(r, 33, 45)
        for beat, step, acc in (FUNK_DUR if a == "Cmaj7" else FUNK):
            p.note("bass", "ebass", r + step, 1 + k, beat, 0.45, 0.5 * acc)
        for beat, lv in ((0.5, 0.9), (1.75, 0.6), (2.5, 0.85), (3.75, 0.6)):
            strum(p, "keys", "wurli", 1 + k, beat, ch, 0.3, 0.28 * lv, spread=0.008)
        if k % 2 == 1:
            for n in ch.split("+"):
                p.note("stab", "trps_stc", m(n, 12), 1 + k, 3.5, 0.4, 0.34)
                p.note("stab", "tbn_stac", m(n), 1 + k, 3.5, 0.4, 0.28)
    p.grid("kit", "dkick", 1, 32, "X.....x...X.....", 0.45)
    p.grid("kit", "dsnare", 1, 32, "....X.......X...", 0.4)
    p.grid("kit", "dsnare", 1, 32, ".......o.o......", 0.14)
    p.grid("hats", "dhat", 1, 32, "x.o.x.o.x.o.x.oo", 0.34)
    mel(p, "flute", "flute", 1, ST_MEL, 0.45)
    mel(p, "reed", "tsax", 17, ST_MEL, 0.46, tr=-12)
    mel(p, "flute", "flute", 25, ST_MEL[8:], 0.32, tr=12)
    for b in (1, 17):
        p.note("bells", "glock", "E6", b, 0, 2, 0.2)
    return p


# ======================================================================== Das Dach

DA_AKK = ["F", "C", "Dm", "Bb", "F", "C", "Bb", "C", "Dm", "Bb", "F", "C", "Bb", "C", "F", "F"]
DA = {"F": "F2 C3 F3 A3 C4 A3", "C": "E2 C3 G3 C4 E4 C4", "Dm": "D2 A2 D3 F3 A3 F3", "Bb": "Bb1 F2 Bb2 D3 F3 D3"}
DA_MEL = ["C5:3 A5:2 G5:1", "G5:4 E5:2", "F5:3 D5:2 E5:1", "F5:4 D5:2",
          "C5:2 F5:1 A5:2 C6:1", "Bb5:2 A5:1 G5:3", "F5:2 G5:1 A5:2 D5:1", "G5:6",
          "A5:3 F5:2 D5:1", "D6:4 Bb5:2", "A5:3 C6:2 A5:1", "G5:4 E5:2",
          "F5:2 D5:1 Bb5:2 A5:1", "G5:2 E5:1 C5:3", "F5:6", "-:6"]
DA_GEGEN = ["A5:6", "G5:6", "F5:6", "F5:6", "A5:6", "G5:6", "F5:6", "E5:6",
            "F5:6", "F5:6", "F5:6", "E5:6", "D5:6", "E5:6", "C5:6", "-:6"]


@stueck(22, "Auf dem Dach", target=-23.0, hall=5.5, wet=0.85)
def dach():
    """Oben über der Stadt: Harfe in wiegenden Achteln, die Flöte, später die Solo-Geige, Sterne im Glockenspiel."""
    p = Piece(120, beats=6, bars=32, seed=22)
    for k in range(32):
        a = DA_AKK[k % 16]
        for j, n in enumerate(DA[a].split()):
            p.note("lyre", "lyre", n, 1 + k, j, 1.5, 0.34 if j == 0 else 0.24)
        p.hold("vc", "vc", 1 + k, 1, DA[a].split()[0], 0.12)
        if k % 4 == 2:
            p.note("bells", "glock", m(DA[a].split()[4], 24), 1 + k, 4, 2, 0.12)
    mel(p, "flute", "flute", 1, DA_MEL, 0.42)
    mel(p, "solo", "solo", 17, DA_MEL, 0.42, tr=-12)
    mel(p, "flute", "flute_nv", 17, DA_GEGEN, 0.22)
    p.hold("vla", "vla", 1, 32, "F3", 0.08, attack=3.0)
    return p


@stueck(23, "Lilly", target=-23.0, hall=5.0)
def romantik():
    """Zärtlicher Walzer in B-Dur: Solo-Geige und Harfe, dann die Flöte mit der Geige darunter."""
    p = Piece(84, beats=3, bars=32, seed=23)
    mel_ = ["F5:2 D5:1", "Bb5:2 G5:1", "G5:1 F5:1 Eb5:1", "C5:3",
            "D5:2 F5:1", "Bb5:2 G5:1", "Eb5:1 C5:1 A4:1", "Bb4:3",
            "G5:2 Bb5:1", "C6:2 G5:1", "A5:1 G5:1 F5:1", "D5:3",
            "Eb5:2 G5:1", "F5:2 D5:1", "C5:1 Eb5:1 A4:1", "Bb4:3"]
    akk = "Bb Gm Eb F Bb Eb Cm Bb Eb Cm F Bb Eb Bb F7 Bb".split()
    walzer(p, 1, akk * 2, 0.34)
    mel(p, "solo", "solo", 1, mel_, 0.45)
    mel(p, "flute", "flute", 17, mel_, 0.42)
    mel(p, "solo", "solo", 17, ["D5:3", "D5:3", "Bb4:3", "A4:3", "F4:3", "G4:3", "G4:3", "F4:3",
                                "Bb4:3", "G4:3", "F4:3", "F4:3", "G4:3", "F4:3", "Eb4:3", "D4:3"], 0.3)
    for k, a in enumerate(akk * 2):
        p.note("vla", "vla", WALZ[a][1].split("+")[0], 1 + k, 0, 3, 0.14)
    return p


# ======================================================================== Muskelkater: Orchester-Disco

CL_AKK = ["Am7", "Dm7", "Fmaj7", "E7"]
CL = {"Am7": ("A1", "G3+C4+E4+A4"), "Dm7": ("D2", "F3+A3+C4+E4"), "Fmaj7": ("F1", "E3+A3+C4+F4"), "E7": ("E2", "D4+E4+G#4+B4")}
CL_HOOK = ["E5:0.5 E5:0.5 -:0.5 E5:0.5 G5:0.5 A5:1 -:0.5", "F5:0.5 F5:0.5 -:0.5 F5:0.5 A5:0.5 C6:1 -:0.5",
           "C6:1 B5:0.5 A5:0.5 G5:1 E5:1", "G#5:1.5 B5:0.5 D6:1 B5:1",
           "E5:0.5 E5:0.5 -:0.5 E5:0.5 G5:0.5 A5:1 -:0.5", "F5:0.5 F5:0.5 -:0.5 F5:0.5 A5:0.5 C6:1 -:0.5",
           "C6:1 B5:0.5 A5:0.5 G5:1 E5:1", "G#5:1 E5:1 -:2"]


@stueck(30, "Muskelkater (Ladies Night)", target=-19.0, hall=2.8, wet=0.5, ratio=2.0)
def club():
    """Stripclub-Disco mit Orchester: Bassdrum durch, Synthbass in Oktaven, Philly-Streicher, Bläserstöße."""
    p = Piece(118, beats=4, bars=48, seed=30)
    pause = range(25, 33)
    for k in range(48):
        b = 1 + k
        r, ch = CL[CL_AKK[k % 4]]
        r = lage(r, 33, 45)
        if b in pause:
            p.note("bass", "ebass", r, b, 0, 4, 0.4)
            p.hold("vln", "vln_trem", b, 1, ch.split("+")[-1], 0.2, swell=(0.2, 1.0, 0.6, 0.6))
            for j, n in enumerate(ch.split("+")):
                p.note("bells", "glock", m(n, 24), b, j * 1.0, 1, 0.12)
            continue
        for j in range(8):
            p.note("bass", "ebass", r + (12 if j % 2 else 0), b, j * 0.5, 0.45, 0.5 if j % 2 == 0 else 0.42)
            p.note("bass", "sbass", r + (12 if j % 2 else 0), b, j * 0.5, 0.4, 0.25)
        strum(p, "keys", "wurli", b, 0, ch, 2, 0.24)
        for beat in (1.5, 3.5):
            for n in ch.split("+"):
                p.note("drv", "vln_spic", m(n, 12), b, beat, 0.3, 0.3)
                p.note("drv", "vla_spic", m(n), b, beat, 0.3, 0.26)
        if b >= 33 and k % 2 == 0:
            for n in ch.split("+")[:3]:
                p.note("stab", "trps_stc", m(n, 12), b, 3.5, 0.4, 0.42)
                p.note("stab", "horn_stac", m(n, 12), b, 3.5, 0.4, 0.32)
                p.note("stab", "tbn_stac", m(n), b, 3.5, 0.4, 0.36)
    for s0, s1 in ((1, 24), (33, 48)):
        n = s1 - s0 + 1
        p.grid("kit", "dkick", s0, n, "X...X...X...X...", 0.55)
        p.grid("kit", "kick", s0, n, "X...X...X...X...", 0.25)
        p.grid("kit", "dsnare", s0, n, "....X.......X...", 0.42)
        p.grid("kit", "clap", s0, n, "....X.......X...", 0.24)
        p.grid("hats", "dhat_o", s0, n, "..x...x...x...x.", 0.3)
        p.grid("hats", "dhat", s0, n, "o.o.o.o.o.o.o.o.", 0.22)
    for j in range(16):                          # Wirbel aus der Pause zurück
        p.note("kit", "dsnare", 60, 32, j * 0.25, 0.25, 0.12 + 0.4 * j / 16)
    for s0 in (9, 17, 33, 41):
        mel(p, "vln", "vln", s0, CL_HOOK, 0.48)
        mel(p, "flute", "flute", s0, CL_HOOK, 0.3, tr=12)
    for b in (1, 9, 17, 33, 41):
        p.note("crash", "dcrash", 60, b, 0, 4, 0.42)
    return p


# ======================================================================== Shisha 1001 (zwei Phasen: Lounge, Duell)

SH_MEL = ["A4:1.5 Bb4:0.5 A4:1 G4:0.5 F#4:0.5", "Eb4:1 F#4:1 D4:2",
          "G4:1.5 A4:0.5 Bb4:1 C5:1", "A4:4",
          "Bb4:1 C5:0.5 D5:0.5 Eb5:1 D5:1", "C5:0.5 Bb4:0.5 A4:0.5 G4:0.5 F#4:2",
          "G4:1 F#4:1 Eb4:1 F#4:1", "D4:4"]
SH_AKK = ["D", "D", "Cm", "D", "Gm", "D", "D", "D"]


@stueck(31, "Shisha 1001", target=-20.0, hall=3.4, wet=0.65, phases=(1, 2), phase_step=1.5)
def shisha():
    """Hidschas auf D: Rahmentrommel und Conga im Maqsum, die Harfe wie eine Oud, die Flöte wie eine Nay.
    Phase 2 ist das Rauchduell: Celli treiben, Posaunen stoßen, alles enger."""
    p = Piece(96, beats=4, bars=32, seed=31)
    p.key = {2, 9}
    oud = {"D": "D3 A3 D4 Eb4 F#4 Eb4 D4 A3", "Cm": "C3 G3 C4 Eb4 G4 Eb4 C4 G3", "Gm": "G2 D3 G3 Bb3 D4 Bb3 G3 D3"}
    for k in range(32):
        b = 1 + k
        a = SH_AKK[k % 8]
        for j, n in enumerate(oud[a].split()):
            p.note("lyre", "lyre", n, b, j * 0.5, 0.5, 0.28 if j % 4 == 0 else 0.2)
        p.grid("hand", "frame", b, 1, "X...x...X.......", 0.45)
        p.grid("hand", "conga", b, 1, "..x...x.....x...", 0.32)
        p.grid("metal", "tamb", b, 1, "o.o.o.o.o.o.o.oo", 0.14)
        p.note("pizz", "cb_pizz", {"D": "D2", "Cm": "C2", "Gm": "G1"}[a], b, 0, 1.5, 0.42)
        # Phase 2: das Duell
        r = m({"D": "D3", "Cm": "C3", "Gm": "G2"}[a])
        for j, s in enumerate((0, 0, 1, 0, 4, 0, 1, 0, 0, 0, 1, 0, 5, 4, 1, 0)):
            p.note("p2.drv", "vc_spic", r + s, b, j * 0.25, 0.25, 0.42 if j % 4 == 0 else 0.28, release=0.12)
        p.grid("p2.hand", "tumba", b, 1, "x.xxx.x.x.xxx.xx", 0.3)
        p.grid("p2.hand", "log_hi", b, 1, "..x...x...x...x.", 0.22)
        if k % 2 == 1:
            for n in ("D3", "A3", "D4"):
                p.note("p2.stab", "tbn_stac", n, b, 3.5, 0.5, 0.42)
    p.hold("cb", "cb", 1, 32, "D2", 0.16)
    mel(p, "flute", "flute_nv", 5, SH_MEL, 0.44)
    mel(p, "flute", "flute_nv", 21, SH_MEL, 0.4, tr=12)
    mel(p, "p2.reed", "oboe", 13, SH_MEL, 0.42, tr=12)
    for s0 in (1, 17):
        p.note("p2.vln", "vln_trem", "D5", s0, 0, 16 * 4, 0.18, swell=(0.2, 1.0, 0.6, 0.5))
        p.note("p2.vln", "vln_trem", "Eb5", s0, 0, 16 * 4, 0.14, swell=(0.2, 1.0, 0.6, 0.5))
        p.note("p2.timp", "timp", "D3", s0, 0, 2, 0.5)
    return p


# ======================================================================== Masala Basar (Laden und Putzen)

# D-Lydisch (wie Raga Yaman auf D): hell und freundlich, die übermäßige Quarte G# gibt die Farbe
BA_A = ["D5:1 E5:0.5 F#5:0.5 G#5:1 A5:1", "B5:1.5 A5:0.5 G#5:1 F#5:1",
        "E5:0.5 F#5:0.5 G#5:0.5 F#5:0.5 E5:1 D5:1", "A4:3 -:1",
        "D5:1 F#5:1 A5:1 C#6:1", "B5:1 A5:0.5 B5:0.5 A5:1 G#5:1",
        "F#5:0.5 G#5:0.5 A5:0.5 G#5:0.5 F#5:1 E5:1", "D5:3 -:1"]
BA_B = ["A4:1 B4:0.5 C#5:0.5 D5:2", "C#5:0.5 B4:0.5 A4:1 G#4:1 A4:1",
        "F#4:1 G#4:1 A4:1 B4:1", "A4:4",
        "D5:1 C#5:0.5 B4:0.5 A4:1 B4:1", "G#4:1 A4:0.5 G#4:0.5 F#4:1 E4:1",
        "F#4:0.5 G#4:0.5 A4:0.5 B4:0.5 C#5:1 B4:1", "D5:4"]


@stueck(32, "Masala Basar", target=-21.0, hall=3.2, wet=0.62)
def basar():
    """Adshayans Laden: Bordun auf D und A, die Harfe zupft wie eine Tanpura, Tumba und Conga im Tabla-Muster,
    die Flöte wie eine Bansuri, die Oboe wie eine Shehnai."""
    p = Piece(100, beats=4, bars=32, seed=32)
    p.key = {2, 9}
    p.hold("cb", "cb", 1, 32, "D2", 0.16)
    p.hold("vla", "vla", 1, 32, "A3 D4", 0.09)
    for k in range(32):
        b = 1 + k
        # Tanpura: Pa – Sa – Sa – Sa (tief), leicht verschliffen
        for j, n in enumerate(("A3", "D4", "D4", "D3")):
            p.note("lyre", "lyre", n, b, j, 1.5, 0.22 if j == 0 else 0.16, delay=0.01 * j)
        if 4 <= k < 28:
            p.grid("hand", "tumba", b, 1, "X.....x...X..x..", 0.42)
            p.grid("hand", "conga", b, 1, "..x.x.xx.xx.x.xx" if k % 4 == 3 else "..x.x..x..x.x.x.", 0.3)
            p.grid("hand", "log_hi", b, 1, "...x.......x....", 0.12)
            p.note("pizz", "cb_pizz", "D2", b, 0, 1.5, 0.36)
            p.note("pizz", "cb_pizz", "A2", b, 2.5, 1, 0.28)
        elif k < 4:
            p.grid("hand", "tumba", b, 1, "X...............", 0.3 + 0.03 * k)
    mel(p, "flute", "flute_nv", 5, BA_A, 0.44)
    mel(p, "reed", "oboe", 13, BA_B, 0.4)
    mel(p, "flute", "flute_nv", 21, BA_A, 0.42)
    mel(p, "reed", "oboe", 21, BA_A, 0.3, tr=-12)
    # kleine Verzierungen: Harfen-Glissandi in den Atempausen der Melodie
    for b in (8, 16, 24, 32):
        gliss(p, "lyre", "lyre", b, 3, "D4 E4 F#4 G#4 A4 B4 C#5 D5", 0.2, step=0.06)
    p.note("bells", "glock", "A6", 1, 0, 2, 0.12)
    p.note("bells", "glock", "D6", 17, 0, 2, 0.12)
    return p


@stueck(46, "Curry-Alarm (Putzen)", target=-20.0, hall=2.2, wet=0.5)
def putzen():
    """Putzen gegen die Zeit: das Basar-Thema doppelt so eilig, Xylophon in Sechzehnteln, Tumba und Conga rasen,
    Pizzicato hüpft, ein Holzblock tickt wie eine Uhr."""
    p = Piece(150, beats=4, bars=16, seed=46)
    p.key = {2, 9}
    arp = {"D": "D5 F#5 A5 F#5", "G#": "D5 G#5 B5 G#5", "A": "C#5 E5 A5 E5", "E": "B4 E5 G#5 E5"}
    akk = ["D", "D", "G#", "A", "D", "E", "A", "D"]
    for k in range(16):
        b = 1 + k
        a = akk[k % 8]
        for j, n in enumerate(arp[a].split() * 4):
            p.note("bells", "xylo", n, b, j * 0.25, 0.25, 0.2 if j % 4 == 0 else 0.13)
        p.grid("hand", "tumba", b, 1, "X..x..X.X..x.x..", 0.44)
        p.grid("hand", "conga", b, 1, ".xx.xx.x.xx.x.xx", 0.28)
        for beat in range(4):
            p.note("tick", "log_hi", 57, b, beat, 0.5, 0.2 if beat % 2 == 0 else 0.14)
        root = {"D": "D2", "G#": "E2", "A": "A1", "E": "E2"}[a]
        p.note("pizz", "cb_pizz", root, b, 0, 1, 0.44)
        p.note("pizz", "cb_pizz", m(root, 7), b, 1, 1, 0.34)
        p.note("pizz", "cb_pizz", root, b, 2, 1, 0.4)
        p.note("pizz", "cb_pizz", m(root, 12), b, 3, 1, 0.32)
        for beat in (0.5, 1.5, 2.5, 3.5):
            strum(p, "pizz", "vln_pizz", b, beat, {"D": "F#4+A4+D5", "G#": "G#4+B4+D5", "A": "E4+A4+C#5", "E": "E4+G#4+B4"}[a], 0.3, 0.15, spread=0.006)
    mel(p, "flute", "flute_nv", 1, BA_A, 0.42, release=0.12)
    mel(p, "flute", "flute_nv", 9, BA_A, 0.4, release=0.12)
    mel(p, "reed", "oboe", 9, BA_A, 0.3, tr=-12, release=0.12)
    for b in (1, 9):
        p.note("crash", "cymbal", 80, b, 0, 2, 0.16)
    return p


# ======================================================================== Kämpfe

@stueck(40, "Disco-Inferno (Kampf gegen Emilian)", target=-18.0, hall=3.0, wet=0.5, send_scale=0.7, ratio=2.2)
def kampf():
    """Ein Kampf auf der Tanzfläche: Disco-Bassdrum unter einem Orchester, das um sein Leben spielt."""
    p = Piece(140, beats=4, bars=32, seed=40)
    p.key = {4, 11}
    akk = ["Em", "Em", "C", "D", "Em", "Em", "C", "B7"]
    root = {"Em": "E2", "C": "C2", "D": "D2", "B7": "B1"}
    tones = {"Em": "E3+G3+B3", "C": "E3+G3+C4", "D": "D3+F#3+A3", "B7": "D#3+F#3+A3"}
    drive = (0, 0, 12, 0, 0, 10, 0, 7, 0, 0, 12, 0, 10, 0, 7, 3)
    pause = range(25, 29)
    for k in range(32):
        b = 1 + k
        a = akk[k % 8]
        r = m(root[a])
        lv = 0.3 if b in pause else 0.48
        for j, s in enumerate(drive):
            ss = s if a == "Em" or s in (0, 12, 7) else (0 if s == 3 else 12 if s == 10 else s)
            p.note("drv", "vc_spic", r + 12 + ss, b, j * 0.25, 0.25, lv * (1.0 if j % 4 == 0 else 0.62), release=0.12)
        for j in range(4):
            p.note("cb", "cb_spic", r, b, j, 1, 0.45, release=0.15)
        if b not in pause:
            for j in range(8):
                p.note("bass", "sbass", r + (12 if j % 2 else 0), b, j * 0.5, 0.4, 0.3)
            for beat in (1.5, 3.5) if k % 2 == 0 else (0.75, 2.5):
                for n in tones[a].split("+"):
                    p.note("stab", "tbn_stac", m(n), b, beat, 0.4, 0.48)
                    p.note("stab", "horn_stac", m(n, 12), b, beat, 0.4, 0.38)
                    p.note("stab", "trps_stc", m(n, 24), b, beat, 0.4, 0.36)
    for s0, n in ((1, 24), (29, 4)):
        p.grid("kit", "kick", s0, n, "X...X...X...X...", 0.5)
        p.grid("kit", "dkick", s0, n, "X...X...X...X...", 0.45)
        p.grid("kit", "dsnare", s0, n, "....X.......X...", 0.46)
        p.grid("kit", "clap", s0, n, "....X.......X...", 0.22)
        p.grid("hats", "dhat_o", s0, n, "..x...x...x...x.", 0.28)
        p.grid("hand", "tumba", s0, n, "x.xx..x.x.xx..xx", 0.3)
    for b in (1, 9, 17, 29):
        p.note("drums", "bd", 36, b, 0, 2, 0.8)
        p.note("crash", "dcrash", 60, b, 0, 4, 0.5)
        p.note("timp", "timp", "E3", b, 0, 2, 0.6)
        for inst, n in (("tuba", "E1"), ("tbn", "E2"), ("tbn", "B2")):
            p.note("braam", inst, n, b, 0, 8, 0.6, attack=0.03, swell=(0.7, 1.0, 0.2, 0.06))
    for d in (24, 25):
        p.note("vln", "vln_trem", m("E4", d), 1, 0, 32, 0.28, swell=(0.1, 1.0, 1.0, 0.95))
    hmel = ["E4:1.5 G4:0.5 B4:2", "A4:1 G4:1 F#4:1 G4:1", "E4:1.5 G4:0.5 C5:2", "B4:1 A4:1 F#4:2",
            "E4:1.5 G4:0.5 B4:1 E5:1", "D5:1 B4:1 G4:2", "C5:1 B4:1 A4:1 G4:1", "F#4:2 D#4:2"]
    mel(p, "lead", "horn", 9, hmel, 0.6)
    mel(p, "lead", "horn", 17, hmel, 0.6)
    mel(p, "vln", "vln", 17, hmel, 0.45, tr=12)
    for j in range(16):
        p.note("rise", "dsnare", 60, 28, j * 0.25, 0.25, 0.1 + 0.5 * j / 16)
    p.note("timp", "timp_roll", "B2", 28, 0, 4, 0.5, swell=(0.05, 1.0, 1.0, 0.98))
    return p


PR_MEL = ["C5:0.5 C5:0.5 A4:0.5 C5:0.5 F5:1 A5:1", "G5:0.5 F5:0.5 E5:0.5 F5:0.5 C5:2",
          "Bb4:0.5 Bb4:0.5 G4:0.5 Bb4:0.5 E5:1 G5:1", "F5:0.5 E5:0.5 D5:0.5 E5:0.5 C5:2",
          "E5:0.5 G5:0.5 Bb5:0.5 G5:0.5 E5:0.5 C5:0.5 Bb4:0.5 G4:0.5", "C5:1 E5:1 G5:1 Bb5:1",
          "A5:1 F5:0.5 C5:0.5 A4:1 C5:1", "F5:2 -:2",
          "D5:0.5 D5:0.5 Bb4:0.5 D5:0.5 F5:1 Bb5:1", "A5:0.5 Bb5:0.5 A5:0.5 G5:0.5 F5:2",
          "C5:0.5 F5:0.5 A5:0.5 C6:0.5 A5:1 F5:1", "F#5:1 A5:1 C6:1 A5:1",
          "B5:1 G5:0.5 F5:0.5 D5:1 B4:1", "C5:0.5 E5:0.5 G5:0.5 Bb5:0.5 C6:1 Bb5:1",
          "A5:1 C6:0.5 A5:0.5 F5:1 C5:1", "Bb4:0.5 C5:0.5 D5:0.5 E5:0.5 G5:1 -:1"]
PR_AKK = "F F C7 C7 C7 C7 F F Bb Bb F D7 G7 C7 F C7".split()
OOM = {"F": ("F1", "C2", "A3+C4+F4"), "C7": ("C2", "G1", "Bb3+E4+G4"), "Bb": ("Bb1", "F1", "Bb3+D4+F4"),
       "D7": ("D2", "A1", "A3+C4+F#4"), "G7": ("G1", "D2", "B3+D4+F4"), "C": ("C2", "G1", "C4+E4+G4")}


@stueck(41, "Kneipenschlägerei", target=-19.0, hall=2.4, wet=0.55)
def pruegel():
    """Slapstick: Xylophon und Flöte rasen, die Tuba stampft, die Posaune rutscht aus."""
    p = Piece(152, beats=4, bars=32, seed=41)
    p.key = {5, 0}
    for k in range(32):
        a = PR_AKK[k % 16]
        r1, r2, ch = OOM[a]
        p.note("low", "tuba", m(r1, 12), 1 + k, 0, 1, 0.5)
        p.note("low", "tuba", m(r2, 12), 1 + k, 2, 1, 0.45)
        for beat in (1, 3):
            strum(p, "stab", "horn_stac", 1 + k, beat, ch, 0.5, 0.26, spread=0.005)
            strum(p, "keys", "piano", 1 + k, beat, ch, 0.5, 0.42, spread=0.006, tr=12)
        p.note("keys", "piano", m(r1, 24), 1 + k, 0, 1, 0.45)
        p.note("keys", "piano", m(r2, 24), 1 + k, 2, 1, 0.42)
        p.grid("kit", "dsnare", 1 + k, 1, "x.o.X.o.x.o.X.oo", 0.3)
        p.note("drums", "bd", 36, 1 + k, 0, 1, 0.3)
    mel(p, "bells", "xylo", 1, PR_MEL, 0.5)
    mel(p, "bells", "xylo", 17, PR_MEL, 0.45)
    mel(p, "flute", "flute", 17, PR_MEL, 0.42)
    mel(p, "vln", "vln", 25, PR_MEL[8:], 0.36)
    for b in (8, 24):
        slide(p, "horn", "tbn", b, 2, "F3", "C3", 2, 0.42)
    for b in (1, 17):
        p.note("crash", "crash", 80, b, 0, 4, 0.36)
    p.note("crash", "cymbal", 80, 32, 2, 2, 0.3)
    return p


GA_GALOPP = ["E5:0.25 F5:0.25 G5:0.5 C6:0.5 G5:0.5", "E5:0.5 G5:0.5 C5:1",
             "D5:0.25 E5:0.25 F5:0.5 B5:0.5 F5:0.5", "D5:0.5 F5:0.5 B4:1",
             "G5:0.5 F5:0.5 E5:0.5 D5:0.5", "B4:0.5 D5:0.5 G5:1",
             "E5:0.5 G5:0.5 C6:0.5 E6:0.5", "C6:1 -:1",
             "G5:0.5 E5:0.5 G5:0.5 C6:0.5", "B5:0.5 A5:0.5 G5:1",
             "A5:0.5 F5:0.5 A5:0.5 C6:0.5", "C6:0.5 A5:0.5 F5:1",
             "E5:0.5 G5:0.5 C6:0.5 G5:0.5", "F5:0.5 D5:0.5 B4:0.5 G4:0.5",
             "C5:0.5 E5:0.5 G5:0.5 E5:0.5", "C5:1 -:1"]
GALOPP_AKK = "C C G7 G7 G7 G7 C C C C F F C G7 C C".split()


@stueck(42, "Klepper-Galopp (Derby, Ratte)", target=-19.0, hall=2.6, wet=0.55)
def galopp():
    """Ein Galopp zum Wetten: Flöte, Xylophon, Geigen, Tuba im Zweiertakt, Becken bei jedem Zieleinlauf."""
    p = Piece(168, beats=2, bars=48, seed=42)
    p.key = {0, 7}
    for k in range(48):
        a = GALOPP_AKK[k % 16]
        r1, r2, ch = OOM[a]
        p.note("low", "tuba", m(r1, 12), 1 + k, 0, 0.5, 0.5)
        p.note("low", "tuba", m(r2, 12), 1 + k, 1, 0.5, 0.42)
        for beat in (0.5, 1.5):
            strum(p, "stab", "horn_stac", 1 + k, beat, ch, 0.4, 0.32, spread=0.004)
        p.grid("kit", "dsnare", 1 + k, 1, "X.x.x.xo", 0.26)
    mel(p, "flute", "flute", 1, GA_GALOPP, 0.46)
    mel(p, "bells", "xylo", 1, GA_GALOPP, 0.36)
    mel(p, "vln", "vln", 17, GA_GALOPP, 0.46)
    mel(p, "flute", "flute", 33, GA_GALOPP, 0.46)
    mel(p, "vln", "vln", 33, GA_GALOPP, 0.4, tr=-12)
    mel(p, "bells", "xylo", 33, GA_GALOPP, 0.4)
    for b in (1, 17, 33):
        p.note("crash", "crash", 80, b, 0, 2, 0.34)
    for b in (16, 32, 48):
        p.note("metal", "triangle", 90, b, 0, 1, 0.3)
    return p


# ======================================================================== Rätsel, PC, Pomp

@stueck(43, "Denkpause (Quiz)", target=-22.0, hall=2.4, wet=0.55)
def quiz():
    """Quizmusik: eine Uhr tickt (Holzblock, Claves), das Fagott denkt laut nach, die Klarinette weiß es besser."""
    p = Piece(108, beats=4, bars=32, seed=43)
    p.key = {0, 7}
    akk = ["C", "Am", "Dm7", "G7", "C", "A7", "Dm7 G7", "C", "F", "Fm", "C", "A7", "Dm7", "G7", "C", "G7"]
    vo = {"C": ("C2", "E4+G4+C5"), "Am": ("A1", "E4+A4+C5"), "Dm7": ("D2", "F4+A4+C5"), "G7": ("G1", "F4+B4+D5"),
          "A7": ("A1", "E4+G4+C#5"), "F": ("F1", "F4+A4+C5"), "Fm": ("F1", "F4+Ab4+C5")}
    for k in range(32):
        cs = akk[k % 16].split()
        for half, c in enumerate(cs):
            r, ch = vo[c]
            start = half * 2
            p.note("pizz", "cb_pizz", m(r, 12), 1 + k, start, 1, 0.42)
            if len(cs) == 1:
                p.note("pizz", "cb_pizz", m(r, 19), 1 + k, 2, 1, 0.36)
            for beat in ((start + 0.5, start + 1.5) if len(cs) == 2 else (0.5, 1.5, 2.5, 3.5)):
                strum(p, "pizz", "vln_pizz", 1 + k, beat, ch, 0.4, 0.2, spread=0.006)
        for beat in range(4):
            p.note("hand", "log_hi", 57, 1 + k, beat, 0.5, 0.26 if beat % 2 == 0 else 0.18)
            p.note("hand", "claves", 76, 1 + k, beat + 0.5, 0.5, 0.1)
    a_mel = ["C4:0.5 E4:0.5 G4:0.5 E4:0.5 C4:1 -:1", "A3:0.5 C4:0.5 E4:0.5 C4:0.5 A3:1 -:1",
             "F4:0.5 E4:0.5 D4:0.5 F4:0.5 A4:1 C5:1", "B4:1 G4:1 -:2",
             "E4:0.5 G4:0.5 C5:1 B4:0.5 C5:0.5 -:1", "C#4:0.5 E4:0.5 A4:1 G4:1 -:1",
             "F4:1 A4:1 G4:0.5 F4:0.5 D4:1", "C4:2 -:2"]
    b_mel = ["A4:1 C5:1 F5:2", "Ab4:1 C5:1 F5:2", "G4:0.5 E4:0.5 G4:0.5 C5:0.5 E5:2", "C#5:1 E5:1 G5:1 E5:1",
             "F5:1.5 E5:0.5 D5:1 A4:1", "B4:0.5 C5:0.5 D5:0.5 F5:0.5 G5:2", "E5:1 C5:1 G4:2",
             "D5:0.5 B4:0.5 G4:0.5 F4:0.5 D4:1 G3:1"]
    for s0 in (1, 17):
        mel(p, "reed", "bsn", s0, a_mel, 0.5, release=0.25)
        mel(p, "reed", "clar", s0 + 8, b_mel, 0.46)
    mel(p, "bells", "glock", 17, a_mel, 0.16, tr=24)
    p.note("bells", "glock", "C7", 1, 0, 2, 0.2)
    return p


@stueck(44, "Block Blast (PC)", target=-21.0, hall=1.4, wet=0.35)
def pc():
    """Am Rechner: Chiptune, Pulswelle vorne, Dreieck im Bass, Arpeggien, Rauschen als Snare."""
    p = Piece(144, beats=4, bars=32, seed=44)
    akk = ["Am", "F", "C", "G"] * 4 + ["Dm", "Am", "Dm", "E"] * 2 + ["Am", "F", "C", "G"] * 2
    arp = {"Am": (45, (0, 3, 7, 12)), "F": (41, (0, 4, 7, 12)), "C": (48, (0, 4, 7, 12)), "G": (43, (0, 4, 7, 12)),
           "Dm": (50, (0, 3, 7, 12)), "E": (40, (0, 4, 7, 11))}
    for k, a in enumerate(akk):
        r, iv = arp[a]
        for j in range(8):
            p.note("chip", "dreieck", r - 12 + (12 if j % 2 else 0), 1 + k, j * 0.5, 0.45, 0.5)
        if k >= 8:
            for j in range(16):
                p.note("chip", "puls50", r + 24 + iv[j % 4], 1 + k, j * 0.25, 0.2, 0.22)
    p.grid("kit", "kick", 1, 32, "X.......X.x.....", 0.45)
    p.grid("kit", "chipsnare", 1, 32, "....X.......X..x", 0.4)
    p.grid("hats", "hat", 1, 32, "x.x.x.x.x.x.x.x.", 0.22)
    lead = ["A4:0.5 C5:0.5 E5:0.5 A5:0.5 G5:0.5 E5:0.5 C5:1", "F5:0.5 E5:0.5 C5:0.5 A4:0.5 C5:2",
            "G4:0.5 C5:0.5 E5:0.5 G5:0.5 E5:1 D5:1", "D5:0.5 B4:0.5 G4:1 B4:1 D5:1",
            "E5:1 A5:1 G5:0.5 A5:0.5 B5:1", "C6:1.5 A5:0.5 F5:2",
            "E5:0.5 G5:0.5 C6:1 B5:0.5 G5:0.5 E5:1", "D5:2 -:2"]
    mitte = ["D5:0.5 F5:0.5 A5:1 F5:0.5 D5:0.5 A4:1", "C5:0.5 E5:0.5 A5:1 E5:0.5 C5:0.5 A4:1",
             "F5:1 E5:0.5 D5:0.5 F5:1 A5:1", "G#5:1 B5:1 E5:2"]
    mel(p, "chip", "puls", 1, lead, 0.5)
    mel(p, "chip", "puls", 9, lead, 0.5)
    mel(p, "chip", "puls", 17, mitte + mitte, 0.5)
    mel(p, "chip", "puls", 25, lead, 0.45, tr=12)
    return p


MA_MEL = ["F5:1.5 F5:0.5 Bb5:1 D6:1", "F6:2 D6:1 Bb5:1", "C6:1.5 C6:0.5 Eb6:1 C6:1", "A5:2 F5:2",
          "Eb6:1.5 D6:0.5 C6:1 A5:1", "C6:1.5 Bb5:0.5 A5:1 F5:1", "Bb5:1 D6:1 F6:1 D6:1", "Bb5:2 -:2",
          "G5:1.5 G5:0.5 Bb5:1 Eb6:1", "G6:2 Eb6:1 Bb5:1", "F6:1.5 D6:0.5 Bb5:1 F5:1", "D6:2 Bb5:2",
          "C6:1.5 E6:0.5 G6:1 E6:1", "F6:1.5 Eb6:0.5 C6:1 A5:1", "Bb5:1 F5:1 D6:1 Bb5:1", "-:1 F5:1 F5:0.5 F5:0.5 F5:1"]
MA_AKK = "Bb Bb F7 F7 F7 F7 Bb Bb Eb Eb Bb Bb C7 F7 Bb F7".split()
MA = {"Bb": ("Bb1", "F2", "Bb3+D4+F4"), "F7": ("F1", "C2", "A3+C4+Eb4"), "Eb": ("Eb2", "Bb1", "G3+Bb3+Eb4"),
      "C7": ("C2", "G1", "Bb3+E4+G4")}


@stueck(45, "Ruhm und Ehre (Claudius)", target=-20.0, hall=3.2)
def marsch():
    """Ein Marsch für einen Mann in Galauniform: Trommeln, Tuba, Hörner, viel zu viel Glockenspiel."""
    p = Piece(116, beats=4, bars=32, seed=45)
    p.key = {10, 5}
    for k in range(32):
        r1, r2, ch = MA[MA_AKK[k % 16]]
        p.note("low", "tuba", m(r1, 12), 1 + k, 0, 1, 0.5)
        p.note("low", "tuba", m(r2, 12), 1 + k, 2, 1, 0.45)
        for beat in (1, 3):
            strum(p, "stab", "horn_stac", 1 + k, beat, ch, 0.5, 0.34, spread=0.004)
        p.grid("kit", "dsnare", 1 + k, 1, "X..xX.x.X..xX.xx" if k % 4 == 3 else "X..xX...X..xX...", 0.32)
        p.note("drums", "bd", 36, 1 + k, 0, 1, 0.42)
        p.note("drums", "bd", 36, 1 + k, 2, 1, 0.34)
    mel(p, "lead", "trp", 1, MA_MEL, 0.55, tr=-12)
    mel(p, "horn", "horn", 1, MA_MEL, 0.36, tr=-12)
    mel(p, "low", "tbn", 1, MA_MEL, 0.42, tr=-24)
    mel(p, "bells", "glock", 1, MA_MEL, 0.24)
    mel(p, "lead", "trp", 17, MA_MEL, 0.58, tr=-12)
    mel(p, "horn", "horn", 17, MA_MEL, 0.42, tr=-12)
    mel(p, "flute", "flute", 17, MA_MEL, 0.46)
    mel(p, "vln", "vln", 17, MA_MEL, 0.4, tr=-12)
    for b in (1, 9, 17, 25):
        p.note("crash", "cymbal", 80, b, 0, 4, 0.32)
    for j in range(8):
        p.note("kit", "dsnare", 60, 16, 2 + j * 0.25, 0.25, 0.2 + 0.4 * j / 8)
    return p


# ======================================================================== Hölle: der Lieferant (drei Phasen)

@stueck(50, "Der Lieferant (Endkampf)", target=-17.0, hall=3.0, wet=0.45, send_scale=0.7, ratio=2.4,
        phases=(1, 2, 3), phase_step=1.5)
def hoelle():
    """Höllenmetal mit Orgel: verzerrte Gitarren in e-Phrygisch, Orgel und Glocken (Phase 1), Chor,
    Blech und treibende Celli (Phase 2), Leadgitarre, Doppelbass und Gong (Phase 3)."""
    p = Piece(150, beats=4, bars=32, seed=50)
    p.key = {4, 11}
    roots = ["E1", "E1", "F1", "E1", "E1", "E1", "G1", "F1", "C2", "C2", "B1", "B1", "C2", "D2", "E1", "E1"]
    orgel = {"E1": "E3+B3+E4+G4", "F1": "F3+C4+F4+A4", "G1": "G3+D4+G4+B4", "C2": "C3+G3+C4+E4", "B1": "B2+F#3+B3+D4",
             "D2": "D3+A3+D4+F#4"}
    chug = "X.xxX.xxX.x.Xx.x"
    for k in range(32):
        b = 1 + k
        rn = roots[k % 16]
        r = m(rn)
        for j, c in enumerate(chug):
            if c == "X":
                p.note("gtr", "zerre", r + 12 if j == 0 else r, b, j * 0.25, 0.25 if j else 0.9, 0.62)
            elif c == "x":
                p.note("gtr", "chug", r, b, j * 0.25, 0.22, 0.5)
            if c in "Xx":
                p.note("bass", "ebass", r, b, j * 0.25, 0.22, 0.5 if c == "X" else 0.4)
        if k % 2 == 0:
            strum(p, "organ", "organ_loud", b, 0, orgel[rn], 8, 0.38, spread=0.0)
            p.note("p2.choir", "choir_a", orgel[rn].split("+")[1], b, 0, 8, 0.42, attack=0.2)
            p.note("p2.choir", "choir_a", orgel[rn].split("+")[3], b, 0, 8, 0.38, attack=0.2)
        for j in range(8):
            p.note("p2.drv", "vc_spic", r + 24, b, j * 0.5, 0.5, 0.42 if j % 2 == 0 else 0.3, release=0.12)
        if k % 2 == 1:
            for n in orgel[rn].split("+")[:3]:
                p.note("p2.stab", "tbn_stac", m(n), b, 2.5, 0.5, 0.5)
                p.note("p2.stab", "horn_stac", m(n, 12), b, 3.5, 0.5, 0.45)
    p.grid("kit", "dkick", 1, 32, "X.......X.x.....", 0.6)
    p.grid("kit", "kick", 1, 32, "X.......X.x.....", 0.3)
    p.grid("kit", "dsnare", 1, 32, "....X.......X...", 0.58)
    p.grid("hats", "dride", 1, 32, "x.x.x.x.x.x.x.x.", 0.24)
    p.grid("p2.kit", "dkick2", 1, 32, "..x.x.x...x.x.x.", 0.5)
    p.grid("p3.kit", "dkick", 1, 32, ".x.x.x.x.x.x.x.x", 0.45)
    p.grid("p3.kit", "esnare", 1, 32, "....X.......X...", 0.26)
    for b in range(1, 33, 4):
        p.note("bells", "tb", "E4", b, 0, 4, 0.3)
        p.note("timp", "timp", "E3", b, 0, 2, 0.6)
        p.note("p2.crash", "dchina", 60, b, 0, 4, 0.42)
        p.note("crash", "dcrash", 60, b, 0, 4, 0.38)
    for b in (1, 9, 17, 25):
        p.note("p3.metal", "gong", 40, b, 0, 8, 0.45)
        for inst, n in (("tuba", "E1"), ("tbn", "E2"), ("tbn", "B2")):
            p.note("p3.braam", inst, n, b, 0, 8, 0.62, attack=0.03, swell=(0.7, 1.0, 0.2, 0.06))
    orgel_mel = ["E4:4", "F4:2 E4:2", "G4:4", "F4:2 E4:2", "E4:4", "F4:2 G4:2", "A4:2 G4:2", "F4:4"]
    mel(p, "organ", "organ_loud", 1, orgel_mel, 0.42, tr=12)
    mel(p, "p2.choir9", "choir_o", 17, orgel_mel, 0.45)
    lead = ["E5:1 G5:1 B5:2", "C6:1.5 B5:0.5 G5:2", "F#5:1 A5:1 B5:2", "C6:1 B5:1 A5:1 F#5:1",
            "G5:1 A5:1 B5:1 C6:1", "D6:1 C6:1 A5:1 F#5:1", "E6:2 D6:1 B5:1", "E6:4"]
    mel(p, "p3.lead", "glead", 9, lead, 0.55)
    mel(p, "p3.lead", "glead", 25, lead, 0.55)
    mel(p, "p2.vln", "vln", 9, lead, 0.36)
    for d in (36, 37):
        p.note("p3.vln", "vln_trem", m("E1", d + 12), 1, 0, 64, 0.24, swell=(0.3, 1.0, 0.8, 0.5))
        p.note("p3.vln", "vln_trem", m("E1", d + 12), 17, 0, 64, 0.24, swell=(0.3, 1.0, 0.8, 0.5))
    return p


@stueck(51, "Ritual", target=-22.0, hall=7.0, wet=0.9)
def ritual():
    """Im Pentagramm: Chor auf einem Ton, Herzschlag, Glocken im Tritonus, Streicher, die wegrutschen."""
    p = Piece(60, beats=4, bars=16, seed=51)
    p.hold("choir", "choir_u", 1, 16, "E3 B3", 0.4)
    p.hold("organ", "organ", 1, 16, "E2", 0.24)
    for s0 in (5, 13):
        p.note("choir", "choir_a", "E4", s0, 0, 16, 0.36, swell=(0.0, 1.0, 0.0, 0.6))
        p.note("choir", "choir_a", "F4", s0, 0, 16, 0.32, swell=(0.0, 1.0, 0.0, 0.7))
    for b in range(1, 17):
        p.note("drums", "bd", 36, b, 0, 1, 0.45)
        p.note("drums", "bd", 36, b, 0.4, 1, 0.3)
    for b, n in ((1, "E4"), (5, "Bb3"), (9, "E4"), (13, "Bb3")):
        p.note("bells", "tb", n, b, 0, 8, 0.3)
    for b in (4, 8, 12, 16):
        p.note("timp", "timp_roll", "E2", b, 0, 4, 0.45, swell=(0.0, 1.0, 1.0, 0.98))
    for s0 in (1, 9):
        p.note("vc", "vc_trem", "E2", s0, 0, 32, 0.3, swell=(0.2, 1.0, 0.4, 0.5))
        p.note("vla", "vla_trem", "F3", s0, 0, 32, 0.18, swell=(0.0, 1.0, 0.2, 0.7))
    for b in (7, 15):
        slide(p, "vln", "vln_trem", b, 0, "E5", "Bb4", 4, 0.2)
    for b in (3, 11):
        p.note("fx", "scrape", 60, b, 0, 4, 0.3)
        p.note("fx", "chain", 60, b + 4, 2, 4, 0.22)
    for inst, n in (("tuba", "E1"), ("tbn", "Bb1")):
        p.note("low", inst, n, 9, 0, 16, 0.4, attack=1.5, swell=(0.0, 1.0, 0.0, 0.5))
    return p


# ======================================================================== Zwischensequenzen

@stueck(60, "Spannung", target=-22.0, hall=4.0)
def spannung():
    """Etwas stimmt nicht: Pizzicato im Kreis, zitternde Bratschen, die Pauke, eine tiefe Klarinette."""
    p = Piece(92, beats=4, bars=16, seed=60)
    p.key = {2, 9}
    figur = ["D2", "D2", "F2", "D2", "E2", "D2", "C#2", "D2"]
    for b in range(1, 17):
        for j, n in enumerate(figur):
            p.note("pizz", "cb_pizz", m(n, -2) if b in (4, 12) and j % 2 else n, b, j * 0.5, 0.5, 0.45 if j % 2 == 0 else 0.32)
        if b % 2 == 1:
            p.note("timp", "timp", "D3", b, 0, 2, 0.4)
    p.hold("vla", "vla_trem", 1, 8, "D4 F4", 0.18)
    p.hold("vla", "vla_trem", 9, 8, "D4 Eb4", 0.2)
    mel(p, "reed", "clar", 3, ["A3:2 Bb3:1 A3:1", "F3:4", "-:4", "-:4", "A3:2 Bb3:1 C#4:1", "D4:4"], 0.38)
    for s0 in (9, 13):
        p.note("vln", "vln_trem", "A5", s0, 0, 16, 0.18, swell=(0.0, 1.0, 0.1, 0.8))
        p.note("vln", "vln_trem", "Bb5", s0, 0, 16, 0.16, swell=(0.0, 1.0, 0.1, 0.85))
    for b in (6, 14):
        p.note("bells", "glock", "Eb6", b, 3, 1, 0.12)
    p.note("horn", "horn", "D3", 13, 0, 12, 0.3, swell=(0.0, 1.0, 0.3, 0.7))
    return p


@stueck(61, "Traurig", target=-23.0, hall=5.5)
def traurig():
    """Das Cello singt allein, die Harfe trägt; später übernehmen die Geigen."""
    p = Piece(63, beats=3, bars=24, seed=61)
    vc_mel = ["A3:2 D4:1", "F4:2 E4:1", "D4:2 Bb3:1", "C#4:3", "D4:1 E4:1 F4:1", "G4:2 F4:1", "E4:1 F4:1 G4:1", "A4:3",
              "Bb4:2 A4:1", "A4:2 G4:1", "G4:2 F4:1", "F4:2 E4:1", "D4:1 E4:1 F4:1", "E4:2 C#4:1", "D4:3", "-:3"]
    akk = "Dm Bb Gm A Dm Gm C A Bb F Gm Dm Gm A7 Dm Dm".split() + "Dm Bb Gm A Dm Gm C A".split()
    walzer(p, 1, akk, 0.3, bass=("cb", "cb"))
    mel(p, "solo", "vc", 1, vc_mel, 0.48)
    mel(p, "vln", "vln", 17, vc_mel[:8], 0.42, tr=12)
    mel(p, "solo", "vc", 17, ["F3:3", "D3:3", "D3:3", "E3:3", "F3:3", "D3:3", "E3:3", "C#3:3"], 0.3)
    p.hold("horn", "horn", 9, 8, "F3", 0.16)
    return p


@stueck(62, "Erlösung", target=-23.0, hall=6.5)
def erloesung():
    """Stille, Rauch, jemand ganz in Weiß: Chor und Orgel in E-Dur, die Harfe steigt, eine Geige."""
    p = Piece(66, beats=4, bars=16, seed=62)
    akk = ["E", "C#m", "A", "B", "E", "G#m", "A", "B", "E", "C#m", "F#m", "B", "C#m", "A", "B", "E"]
    for k, a in enumerate(akk):
        b, ch = WALZ[a]
        for n in ch.split("+"):
            p.note("choir", "choir_o", n, 1 + k, 0, 4, 0.34)
        p.note("organ", "organ", m(b, 12), 1 + k, 0, 4, 0.22)
        tones = [m(b, 24)] + [m(n, 12) for n in ch.split("+")]
        for j in range(8):
            p.note("lyre", "lyre", tones[j % 4] + (12 if j >= 4 else 0), 1 + k, j * 0.5, 1, 0.22)
    mel(p, "solo", "solo", 5, ["B4:2 G#4:1 B4:1", "D#5:3 B4:1", "C#5:2 E5:1 C#5:1", "B4:4",
                               "E5:2 F#5:1 G#5:1", "A5:3 G#5:1", "F#5:2 E5:1 C#5:1", "D#5:4"], 0.42)
    for b in (1, 9):
        p.note("bells", "glock", "E6", b, 0, 4, 0.16)
        p.note("bells", "tb", "E4", b, 0, 8, 0.16)
    return p


@stueck(63, "Monster", target=-20.0, hall=5.0)
def monster():
    """Horror: Streicher-Cluster, Blech schwillt an, Glissandi, ein Herz, Metall auf Stein."""
    p = Piece(100, beats=4, bars=16, seed=63)
    p.key = {4, 10}
    for b in range(1, 17):
        p.note("cb", "cb_pizz", "E1" if b % 2 else "Bb1", b, 0, 1, 0.5)
        p.note("drums", "bd", 36, b, 0, 1, 0.5)
        p.note("drums", "bd", 36, b, 0.45, 1, 0.34)
        p.grid("hand", "tumba", b, 1, "x.....x...x.....", 0.3)
    for s0 in (1, 5, 9, 13):
        for inst, n in (("tuba", "E1"), ("tbn", "Bb1"), ("tbn", "F2")):
            p.note("braam", inst, n, s0, 0, 16, 0.55, attack=1.2, swell=(0.0, 1.0, 0.3, 0.7))
        for n in ("E6", "F6", "F#6"):
            p.note("vln", "vln_trem", n, s0, 0, 16, 0.2, swell=(0.0, 1.0, 0.4, 0.8))
    for b in (4, 8, 12, 16):
        slide(p, "vln", "vln_trem", b, 0, "F5", "E4", 4, 0.24)
        p.note("vc", "vc_trem", "E2", b, 0, 4, 0.34, swell=(0.0, 1.0, 1.0, 0.95))
    for b in (3, 7, 11, 15):
        p.note("fx", "scrape", 61, b, 2, 4, 0.34)
        p.note("metal", "anvil", 84, b + 1, 0, 1, 0.2)
    for b in (1, 9):
        p.note("timp", "timp", "E2", b, 0, 2, 0.6)
        p.note("crash", "swell", 81, b + 4, 0, 16, 0.3, delay=-2.0)
    return p
