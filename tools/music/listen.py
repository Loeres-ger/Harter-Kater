"""Looks at a rendered piece in place of ears: loudness and brightness section by section, the pitch
classes that sound in each (to check the harmony), the clicks at the loop's seam and clipping.

    python -I tools/music/listen.py <piece.wav> <sections: name:start_s:end_s,...>
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402

import engine as E  # noqa: E402

NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
x, sr = E.read_wav(sys.argv[1])
mono = x.mean(axis=1)
print("length %.1f s, peak %.2f, clipped samples %d" % (len(mono) / sr, np.abs(x).max(), int((np.abs(x) > 0.999).sum())))
seam = np.abs(np.diff(np.concatenate([mono[-200:], mono[:200]])))
print("loop seam: largest step %.4f (typical %.4f)" % (seam.max(), np.abs(np.diff(mono[: sr])).mean()))
for spec in sys.argv[2].split(","):
    name, a, b = spec.split(":")
    seg = mono[int(float(a) * sr): int(float(b) * sr)]
    if len(seg) < sr // 4:
        continue
    rms = 20 * np.log10(np.sqrt((seg ** 2).mean()) + 1e-9)
    size = 1 << 15
    chroma = np.zeros(12)
    centroid = []
    for s in range(0, len(seg) - size, size // 2):
        w = seg[s:s + size] * np.hanning(size)
        mag = np.abs(np.fft.rfft(w))
        f = np.fft.rfftfreq(size, 1 / sr)
        band = (f > 55) & (f < 2000)
        pc = np.round(12 * np.log2(f[band] / 440.0) + 69).astype(int) % 12
        np.add.at(chroma, pc, mag[band] ** 2)
        centroid.append((f * mag).sum() / (mag.sum() + 1e-9))
    chroma /= chroma.max() + 1e-12
    top = np.argsort(chroma)[::-1][:5]
    print("%-10s %6.1f–%6.1f s  rms %6.1f dB  bright %5.0f Hz  notes: %s" % (
        name, float(a), float(b), rms, np.mean(centroid),
        "  ".join("%s %.2f" % (NAMES[i], chroma[i]) for i in top)))
