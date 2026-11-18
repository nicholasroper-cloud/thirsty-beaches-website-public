#!/usr/bin/env python3
"""Build website assets from the user-approved neon logo raster.

The source is an approved image concept, not vector artwork. This preserves the
cup, lettering, palms, wave, cyan-blue/pink tagline, and pink side accents.
Only the near-black background is removed so the artwork blends into the site.
Requires Pillow and numpy. Run from any directory.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "brand" / "logo" / "approved-neon-blue-pink-tagline.png"
ASSETS = ROOT / "site" / "assets"
BACKGROUND = (8, 1, 28)


def contain_on_canvas(image, size, margin=0, background=(0, 0, 0, 0)):
    out = Image.new("RGBA", size, background)
    fitted = ImageOps.contain(
        image, (size[0] - margin * 2, size[1] - margin * 2),
        Image.Resampling.LANCZOS,
    )
    out.alpha_composite(
        fitted, ((size[0] - fitted.width) // 2, (size[1] - fitted.height) // 2)
    )
    return out


def build():
    source = Image.open(SOURCE).convert("RGB")
    rgb = np.asarray(source, dtype=np.float32)
    # Estimate the quiet background from the outer frame, not from the art.
    frame = np.concatenate(
        [rgb[:35].reshape(-1, 3), rgb[-35:].reshape(-1, 3),
         rgb[:, :35].reshape(-1, 3), rgb[:, -35:].reshape(-1, 3)]
    )
    bg = np.percentile(frame, 90, axis=0)
    signal = np.clip((rgb - bg) / (255 - bg), 0, 1)
    alpha = signal.max(axis=2)
    alpha[alpha < 0.025] = 0
    foreground = np.clip(
        bg + (rgb - bg) / np.maximum(alpha[:, :, None], 1e-6), 0, 255
    )
    rgba = np.dstack([foreground, alpha * 255]).round().astype("uint8")
    artwork = Image.fromarray(rgba).crop((85, 115, 1400, 1020))

    # Keep existing intrinsic dimensions to avoid changing any page's layout.
    master = contain_on_canvas(artwork, (1000, 666), margin=12)
    for filename in ("logo.png", "logo-512.png"):
        master.save(ASSETS / filename, optimize=True)
    for width in (480, 720):
        scaled = master.resize(
            (width, round(width * 666 / 1000)), Image.Resampling.LANCZOS
        )
        scaled.save(
            ASSETS / f"logo-{width}.webp", quality=80, alpha_quality=64, method=6
        )
    for suffix, size in (("", (158, 96)), ("@2x", (316, 192))):
        nav = contain_on_canvas(artwork, size, margin=2)
        nav.save(ASSETS / f"logo-nav{suffix}.png", optimize=True)
        nav.save(
            ASSETS / f"logo-nav{suffix}.webp",
            quality=82, alpha_quality=64, method=6,
        )

    for filename, size, margin in (
        ("icon-192.png", (192, 192), 6),
        ("icon-512.png", (512, 512), 16),
        ("icon-maskable.png", (512, 512), 64),
    ):
        icon = contain_on_canvas(artwork, size, margin=margin, background=(*BACKGROUND, 255))
        icon.convert("RGB").save(ASSETS / filename, optimize=True)

    og = contain_on_canvas(
        artwork, (1200, 630), margin=22, background=(*BACKGROUND, 255)
    )
    og.convert("RGB").save(ASSETS / "og.jpg", quality=92, optimize=True)
    print("Built the hero, nav, full-logo icons, and 1200x630 social image.")


if __name__ == "__main__":
    build()
