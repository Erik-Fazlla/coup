"""
Makes every Android launcher icon from one square picture (default: assets/source/app_icon.png).

    python scripts/generate-icons.py [path/to/icon.png]

Writes, for each screen density (mdpi .. xxxhdpi) under android/app/src/main/res:
  - mipmap-*/ic_launcher_foreground.png  adaptive icon foreground (Android 8+): the hat on a
                                          transparent layer, scaled so all of it sits inside the
                                          66 dp circle every launcher mask keeps (round, squircle,
                                          teardrop...). The background layer is plain black
                                          (values/ic_launcher_background.xml).
  - mipmap-*/ic_launcher.png             legacy square icon (Android 7 and older)
  - mipmap-*/ic_launcher_round.png       legacy round icon (Android 7 and older)

The picture must be bright artwork on pure black. Needs Pillow and NumPy.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "android" / "app" / "src" / "main" / "res"
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "assets" / "source" / "app_icon.png"

# dp -> px multipliers
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
LEGACY_DP = 48
ADAPTIVE_DP = 108
SAFE_RADIUS_DP = 33  # the 66 dp circle in the middle of the 108 dp layer
SAFE_MARGIN = 0.96  # keep the glow a hair inside that circle
VISIBLE = 30  # 0-255: brighter than this counts as part of the hat (glow included)


def main() -> None:
    src = Image.open(SOURCE).convert("RGB")
    rgb = np.asarray(src).astype(np.float64)
    brightness = rgb.max(axis=2)

    # Where the hat is, and how far its farthest visible pixel is from its middle.
    ys, xs = np.where(brightness > VISIBLE)
    cx = (xs.min() + xs.max()) / 2
    cy = (ys.min() + ys.max()) / 2
    reach = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2).max()

    # The hat as a layer of its own: black becomes transparent, and the colours are
    # un-premultiplied so that, laid on the black background layer, it looks exactly as before.
    alpha = np.clip(brightness * 4, 0, 255)
    safe_alpha = np.where(alpha > 0, alpha, 1)
    colour = np.clip(rgb * 255 / safe_alpha[..., None], 0, 255)
    layer = Image.fromarray(np.dstack([colour, alpha]).astype(np.uint8), "RGBA")

    for name, scale in DENSITIES.items():
        folder = RES / f"mipmap-{name}"
        folder.mkdir(parents=True, exist_ok=True)

        # Adaptive foreground: scale so `reach` lands on the safe circle, centred on the hat.
        size = round(ADAPTIVE_DP * scale)
        k = (SAFE_RADIUS_DP * scale * SAFE_MARGIN) / reach
        scaled = layer.resize((round(src.width * k), round(src.height * k)), Image.LANCZOS)
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        canvas.alpha_composite(scaled, (round(size / 2 - cx * k), round(size / 2 - cy * k)))
        canvas.save(folder / "ic_launcher_foreground.png", optimize=True)

        # Legacy icons: the whole picture, full bleed; the round one cut to a circle.
        legacy = round(LEGACY_DP * scale)
        square = src.resize((legacy, legacy), Image.LANCZOS)
        square.save(folder / "ic_launcher.png", optimize=True)
        big = legacy * 4  # draw the circle large, then shrink it, for a smooth edge
        mask = Image.new("L", (big, big), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
        round_icon = square.convert("RGBA")
        round_icon.putalpha(mask.resize((legacy, legacy), Image.LANCZOS))
        round_icon.save(folder / "ic_launcher_round.png", optimize=True)

    print(f"hat centre ({cx:.0f}, {cy:.0f}), reach {reach:.0f}px of {src.width}px; icons written to {RES}")


if __name__ == "__main__":
    main()
