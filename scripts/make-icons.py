#!/usr/bin/env python3
"""Generate the same blue, Georgia-italic r. mark used inside the app."""
from PIL import Image, ImageDraw, ImageFont
import os

BLUE = (54, 86, 170)
CREAM = (250, 248, 245)
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(OUT, exist_ok=True)


def load_font(size):
    for path in (
        "/System/Library/Fonts/Supplemental/Georgia Italic.ttf",
        "/Library/Fonts/Georgia Italic.ttf",
    ):
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
    return ImageFont.load_default()


def draw_icon(size, maskable=False):
    img = Image.new("RGB", (size, size), CREAM)
    d = ImageDraw.Draw(img)
    pad = int(size * (0.11 if maskable else 0.07))
    plate = [pad, pad, size - pad, size - pad]
    radius = int(size * 0.20)
    d.rounded_rectangle(plate, radius=radius, fill=BLUE)
    text = "r."
    font = load_font(int(size * 0.49))
    tb = d.textbbox((0, 0), text, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    d.text(((size - tw) / 2 - tb[0], (size - th) / 2 - tb[1] - size * 0.015), text, font=font, fill=(255, 255, 255))
    return img


APP_ICON = os.path.join(os.path.dirname(__file__), "..", "src", "app", "icon.png")

draw_icon(512, maskable=True).save(os.path.join(OUT, "icon-512.png"))
draw_icon(192, maskable=True).save(os.path.join(OUT, "icon-192.png"))
draw_icon(512, maskable=True).save(os.path.join(OUT, "r-icon-512.png"))
draw_icon(192, maskable=True).save(os.path.join(OUT, "r-icon-192.png"))
# Apple touch icon: opaque, iOS applies its own rounding.
draw_icon(180, maskable=False).save(os.path.join(OUT, "apple-touch-icon.png"))
draw_icon(180, maskable=False).save(os.path.join(OUT, "r-apple-touch-icon.png"))
# Next.js file-convention favicon (App Router auto-serves src/app/icon.png as an
# additional icon route). Not a maskable PWA icon, so match the apple-touch-icon
# framing (non-maskable padding) rather than the maskable icons above.
draw_icon(192, maskable=False).save(os.path.normpath(APP_ICON))
print(
    "Wrote icon-512.png, icon-192.png, apple-touch-icon.png to",
    os.path.normpath(OUT),
    "and icon.png to",
    os.path.normpath(APP_ICON),
)
