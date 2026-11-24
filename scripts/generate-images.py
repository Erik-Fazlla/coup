"""
Makes the two decorative images of the Noir Neon look.

    python -I scripts/generate-images.py

  assets/images/haze.png        512x512: a soft cyan glow fading to transparent at the edge.
                                Laid over the black background in the top-left corner.
  assets/images/card-shade.png  16x128: light at the top, clear in the middle, dark at the
                                bottom. Stretched over a coloured card it turns the flat fill
                                into a gradient of the same colour.
Needs Pillow and NumPy.
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "images"
CYAN = (0, 229, 255)


def haze() -> Image.Image:
    size = 512
    y, x = np.mgrid[0:size, 0:size]
    centre = (size - 1) / 2
    distance = np.sqrt((x - centre) ** 2 + (y - centre) ** 2) / centre  # 0 centre .. 1 edge
    alpha = np.clip(1 - distance, 0, 1) ** 2 * 0.16 * 255
    rgba = np.zeros((size, size, 4), dtype=np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = CYAN
    rgba[..., 3] = alpha.astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def card_shade() -> Image.Image:
    width, height = 16, 128
    t = np.linspace(0, 1, height)
    rgba = np.zeros((height, width, 4), dtype=np.uint8)
    for row, v in enumerate(t):
        if v < 0.5:  # white highlight fading out towards the middle
            colour, alpha = 255, (0.5 - v) / 0.5 * 0.22
        else:  # black shadow growing towards the bottom
            colour, alpha = 0, (v - 0.5) / 0.5 * 0.38
        rgba[row, :, 0:3] = colour
        rgba[row, :, 3] = int(alpha * 255)
    return Image.fromarray(rgba, "RGBA")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    haze().save(OUT / "haze.png", optimize=True)
    card_shade().save(OUT / "card-shade.png", optimize=True)
    print(f"Wrote {OUT / 'haze.png'} and {OUT / 'card-shade.png'}")


if __name__ == "__main__":
    main()
