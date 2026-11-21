"""Rendert die Stücke aus stuecke.py und legt sie für das Spiel ab:

    python -I tools/music/build.py all | <name> ...

WAV-Master landen in export/musik/ (nicht im Repo), das Spiel bekommt je Datei eine .ogg (Opus) und eine
.mp4 (AAC, für Safari) in public/music/. src/music/musikDateien.ts hält die Länge jeder Schleife in
Samples (44,1 kHz), damit der Spieler sie genau schließen kann. Mehrphasige Stücke (Shisha, Hölle)
geben name_p1, name_p2, … aus.
"""
import json
import os
import re
import subprocess
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIER)
import engine as E  # noqa: E402
import kit  # noqa: E402
import stuecke  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HIER))
WAV = os.path.join(ROOT, "export", "musik")
OUT = os.path.join(ROOT, "public", "music")
TS = os.path.join(ROOT, "src", "music", "musikDateien.ts")
names = list(stuecke.REG) if sys.argv[1:] == ["all"] else sys.argv[1:]


def enc(wav, base):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "libopus", "-b:a", "96k", "-vbr", "on",
                    base + ".ogg"], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-c:a", "aac", "-b:a", "112k", "-movflags", "+faststart",
                    base + ".mp4"], check=True)


os.makedirs(WAV, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
laengen = {}
if os.path.exists(TS):
    laengen = {k: int(v) for k, v in re.findall(r"^\s+'?(\w+)'?: (\d+),", open(TS, encoding="utf8").read(), re.M)}
for name in names:
    nr, titel, fn, opts = stuecke.REG[name]
    print("== %02d %s" % (nr, titel), flush=True)
    outs = kit.mix(fn(), os.path.join(WAV, name + ".wav"), **opts)
    for w in outs:
        base = os.path.splitext(os.path.basename(w))[0]
        enc(w, os.path.join(OUT, base))
        laengen[base] = len(E.read_wav(w)[0])
with open(TS, "w", encoding="utf8") as f:
    f.write("// Von tools/music/build.py erzeugt: Länge jeder Musikschleife in Samples bei 44,1 kHz.\n")
    f.write("export const MUSIK_LAENGE: Record<string, number> = {\n")
    for k in sorted(laengen):
        f.write("  %s: %d,\n" % (k, laengen[k]))
    f.write("};\n")
print("fertig", flush=True)
