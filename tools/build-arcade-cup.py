"""Prepare layered artwork for the interactive 80s cup, without regenerating it."""
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
im = Image.open(ROOT / "brand/cup/approved-80s-cup-source.png").convert("RGB")
rgb = np.asarray(im).copy()
mask = Image.new("L", im.size)
d = ImageDraw.Draw(mask)
d.ellipse((208, 320, 814, 452), fill=255)
d.polygon([(229, 389), (794, 389), (657, 1436), (636, 1450),
           (384, 1450), (355, 1432)], fill=255)
d.polygon([(526, 387), (575, 399), (625, 207), (643, 180),
           (790, 111), (790, 75), (771, 58), (615, 125),
           (586, 146), (571, 187)], fill=255)
mask = mask.filter(ImageFilter.MaxFilter(13)).filter(ImageFilter.GaussianBlur(4))

# Separate the warm white cream from cyan/white ice highlights.
r, g, b = rgb.astype(np.int16).transpose(2, 0, 1)
cream = ((r > 190) & (g > 160) & (r > b + 8) & (g > b + 3)).astype(np.uint8)*255
region = np.zeros_like(cream)
region[360:584, 255:774] = 255
cream &= region
cream = cv2.morphologyEx(cream, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
cream = cv2.dilate(cream, np.ones((9, 9), np.uint8))
clean = cv2.inpaint(rgb, cream, 12, cv2.INPAINT_TELEA)
shell = Image.fromarray(clean).convert("RGBA")
shell.putalpha(mask)
shell.save(ROOT / "site/assets/cup-80s-shell.webp", quality=94, method=6)
layer = Image.new("RGBA", im.size, (255, 255, 255, 0))
layer.putalpha(Image.fromarray(cream).filter(ImageFilter.GaussianBlur(.6)))
layer.save(ROOT / "site/assets/cup-80s-cream.png", optimize=True)
