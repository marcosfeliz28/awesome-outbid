"""Reduce las capturas del recorrido a PNG de 128 colores (sin perder legibilidad).
Uso: python3 -I tests/qa/comprimir.py docs/qa/recorrido-26oct"""
import os
import sys
from PIL import Image

total_antes = total_despues = 0
for carpeta, _, archivos in os.walk(sys.argv[1]):
    for nombre in archivos:
        if not nombre.endswith(".png"):
            continue
        ruta = os.path.join(carpeta, nombre)
        antes = os.path.getsize(ruta)
        img = Image.open(ruta).convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT)
        img.save(ruta, optimize=True)
        total_antes += antes
        total_despues += os.path.getsize(ruta)
print(f"{total_antes/1e6:.1f} MB -> {total_despues/1e6:.1f} MB")
