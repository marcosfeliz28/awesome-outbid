#!/usr/bin/env python3
"""Genera un reveal reproducible del emblema Nexora sin servicios externos."""

from __future__ import annotations

import math
import subprocess
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "apps/web/public/nexora-prisma-mark.webp"
OUTPUT = ROOT / "docs/diseno/obsidian-lumina/motion"
WIDTH, HEIGHT, FPS, SECONDS = 1280, 720, 30, 6


def cover(image: Image.Image, width: int, height: int) -> Image.Image:
    scale = min(width / image.width, height / image.height) * 0.82
    size = (round(image.width * scale), round(image.height * scale))
    resized = image.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, height), (3, 4, 10))
    canvas.paste(resized, ((width - resized.width) // 2, (height - resized.height) // 2))
    return canvas


def frame_at(source: Image.Image, index: int) -> Image.Image:
    progress = index / max(1, FPS * SECONDS - 1)
    ease = 0.5 - 0.5 * math.cos(progress * math.pi)
    scale = 1 + 0.025 * ease
    canvas = cover(source, round(WIDTH * scale), round(HEIGHT * scale))
    x = (canvas.width - WIDTH) // 2
    y = (canvas.height - HEIGHT) // 2
    canvas = canvas.crop((x, y, x + WIDTH, y + HEIGHT))
    canvas = ImageEnhance.Contrast(canvas).enhance(1.025)

    glow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    travel = -420 + progress * (WIDTH + 840)
    polygon = [
        (travel - 90, HEIGHT + 180),
        (travel + 20, HEIGHT + 180),
        (travel + 560, -180),
        (travel + 450, -180),
    ]
    draw.polygon(polygon, fill=(67, 227, 177, 72))
    draw.line((travel - 35, HEIGHT + 160, travel + 505, -160), fill=(147, 110, 255, 150), width=5)
    glow = glow.filter(ImageFilter.GaussianBlur(24))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), glow)

    # Viñeta muy ligera para conservar el foco en el emblema y la palabra.
    mask = Image.new("L", (WIDTH, HEIGHT), 0)
    vignette = Image.new("L", (WIDTH, HEIGHT), 255)
    ImageDraw.Draw(mask).ellipse((-160, -100, WIDTH + 160, HEIGHT + 180), fill=220)
    mask = ImageChops.invert(mask.filter(ImageFilter.GaussianBlur(90)))
    shade = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 8, 115))
    canvas = Image.composite(shade, canvas, mask)

    fade = min(1.0, progress / 0.09, (1.0 - progress) / 0.09)
    if fade < 1:
        black = Image.new("RGBA", (WIDTH, HEIGHT), (3, 4, 10, 255))
        canvas = Image.blend(black, canvas, max(0.0, fade))
    return canvas.convert("RGB")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    mp4 = OUTPUT / "nexora-prism-reveal-16x9.mp4"
    command = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24",
        "-s", f"{WIDTH}x{HEIGHT}", "-r", str(FPS), "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "19",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    poster = None
    for index in range(FPS * SECONDS):
        frame = frame_at(source, index)
        if index == FPS * 2:
            poster = frame.copy()
        process.stdin.write(frame.tobytes())
    process.stdin.close()
    if process.wait() != 0:
        raise SystemExit("ffmpeg no pudo generar el MP4")

    assert poster is not None
    poster.save(OUTPUT / "nexora-prism-reveal-poster.webp", "WEBP", quality=90, method=6)
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error", "-i", str(mp4),
            "-an", "-c:v", "libvpx-vp9", "-crf", "31", "-b:v", "0",
            "-row-mt", "1", str(OUTPUT / "nexora-prism-reveal-16x9.webm"),
        ],
        check=True,
    )


if __name__ == "__main__":
    main()
