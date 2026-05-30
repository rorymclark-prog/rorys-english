#!/usr/bin/env python3
"""One-time icon generator for Rory's English.

Draws a simple amber tile with a navy "RE" monogram. Output PNGs are committed
static assets under public/icons (not regenerated on each build), so this script
only needs to run when the icon design changes.
"""
from PIL import Image, ImageDraw, ImageFont
import os

AMBER = (245, 158, 11)
NAVY = (30, 58, 95)
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(OUT, exist_ok=True)


def load_font(size):
    for path in (
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/SFNSRounded.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    ):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
    return ImageFont.load_default()


def draw_icon(size, maskable=False):
    img = Image.new("RGB", (size, size), AMBER)
    d = ImageDraw.Draw(img)
    # Maskable icons need their content inside a safe centre circle; the full
    # amber bleed already satisfies that. Draw a navy rounded plate + monogram.
    pad = int(size * (0.20 if maskable else 0.14))
    plate = [pad, pad, size - pad, size - pad]
    radius = int(size * 0.18)
    d.rounded_rectangle(plate, radius=radius, fill=NAVY)
    text = "RE"
    font = load_font(int(size * 0.34))
    tb = d.textbbox((0, 0), text, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    d.text(((size - tw) / 2 - tb[0], (size - th) / 2 - tb[1]), text, font=font, fill=AMBER)
    return img


draw_icon(512, maskable=True).save(os.path.join(OUT, "icon-512.png"))
draw_icon(192, maskable=True).save(os.path.join(OUT, "icon-192.png"))
# Apple touch icon: opaque, iOS applies its own rounding.
draw_icon(180, maskable=False).save(os.path.join(OUT, "apple-touch-icon.png"))
print("Wrote icon-512.png, icon-192.png, apple-touch-icon.png to", os.path.normpath(OUT))
