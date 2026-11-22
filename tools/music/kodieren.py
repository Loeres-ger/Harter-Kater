"""Kodiert fertige WAVs aus export/musik/ für das Spiel (public/music/<name>.ogg und .mp4) und trägt ihre Länge in
src/music/musikDateien.ts ein. Für die Keller-Songs, die im Browser aus dem Synth gerendert werden
(audio.synthRendern('keller' | 'kellerClean' | 'duell'), als WAV nach export/musik/ gespeichert):

    python -I tools/music/kodieren.py keller kellerClean duell
"""
import os
import re
import subprocess
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIER)
import engine as E  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HIER))
WAV = os.path.join(ROOT, "export", "musik")
OUT = os.path.join(ROOT, "public", "music")
TS = os.path.join(ROOT, "src", "music", "musikDateien.ts")

laengen = {k: int(v) for k, v in re.findall(r"^\s+'?(\w+)'?: (\d+),", open(TS, encoding="utf8").read(), re.M)}
for name in sys.argv[1:]:
    w = os.path.join(WAV, name + ".wav")
    base = os.path.join(OUT, name)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", w, "-c:a", "libopus", "-b:a", "96k", "-vbr", "on", base + ".ogg"], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", w, "-c:a", "aac", "-b:a", "112k", "-movflags", "+faststart", base + ".mp4"], check=True)
    laengen[name] = len(E.read_wav(w)[0])
    print("  %-12s %.1f s" % (name, laengen[name] / E.SR), flush=True)
with open(TS, "w", encoding="utf8") as f:
    f.write("// Von tools/music/build.py erzeugt: Länge jeder Musikschleife in Samples bei 44,1 kHz.\n")
    f.write("export const MUSIK_LAENGE: Record<string, number> = {\n")
    for k in sorted(laengen):
        f.write("  %s: %d,\n" % (k, laengen[k]))
    f.write("};\n")
