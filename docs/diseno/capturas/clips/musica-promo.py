# Pista original para el promo de Norexos (compuesta por código, sin derechos de terceros).
# python3 musica-promo.py <segundos> <salida.wav>
import sys, wave
import numpy as np

SR = 44100
dur = float(sys.argv[1])
out = sys.argv[2]
bpm = 112
beat = 60 / bpm
n = int(SR * dur)
t = np.arange(n) / SR
mix = np.zeros(n)
rng = np.random.default_rng(7)

def env(length, a=0.01, r=0.3):
    x = np.arange(length) / SR
    return np.minimum(1, x / a) * np.exp(-x / r)

def add(sig, start):
    i = int(start * SR)
    j = min(n, i + len(sig))
    if i < n:
        mix[i:j] += sig[: j - i]

def note(f):
    return 440 * 2 ** ((f - 69) / 12)

# Progresión La m – Fa – Do – Sol, un compás (4 tiempos) por acorde.
chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
bar = 4 * beat
for k in range(int(dur / bar) + 1):
    ch = chords[k % 4]
    s = k * bar
    L = int(bar * SR)
    x = np.arange(L) / SR
    pad = sum(np.sin(2 * np.pi * note(m) * x) + 0.3 * np.sin(2 * np.pi * 2 * note(m) * x + 0.4) for m in ch)
    add(0.06 * pad * np.minimum(1, x / 0.4) * np.minimum(1, (bar - x) / 0.3), s)
    bass = np.sign(np.sin(2 * np.pi * note(ch[0] - 12) * x)) * 0.5 + np.sin(2 * np.pi * note(ch[0] - 12) * x)
    for b in range(4):
        add(0.07 * bass[: int(beat * SR)] * env(int(beat * SR), 0.005, 0.25), s + b * beat)
    # Arpegio en corcheas, una octava arriba.
    arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12]
    for e in range(8):
        f = note(arp[e % 4])
        L2 = int(beat / 2 * SR)
        x2 = np.arange(L2) / SR
        add(0.05 * np.sin(2 * np.pi * f * x2) * env(L2, 0.003, 0.12), s + e * beat / 2)

intro = 2 * bar  # la batería entra tras dos compases
for b in range(int(dur / beat)):
    s = b * beat
    if s >= intro:
        L = int(0.25 * SR)
        x = np.arange(L) / SR
        kick = np.sin(2 * np.pi * (50 + 90 * np.exp(-x * 40)) * x) * np.exp(-x * 9)
        add(0.35 * kick, s)
        if b % 2 == 1:
            snare = rng.standard_normal(int(0.18 * SR)) * env(int(0.18 * SR), 0.001, 0.06)
            add(0.08 * snare, s)
    if s >= intro / 2:
        for h in (0, 0.5):
            hat = rng.standard_normal(int(0.05 * SR))
            hat = np.diff(hat, prepend=0) * env(len(hat), 0.001, 0.015)
            add(0.04 * hat, s + h * beat)

# Entrada y salida suaves, normalizado.
fade = np.minimum(1, t / 1.0) * np.minimum(1, (dur - t) / 2.0)
mix *= fade
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.8
stereo = np.stack([mix, np.roll(mix, int(0.012 * SR))], axis=1)
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((stereo * 32767).astype(np.int16).tobytes())
