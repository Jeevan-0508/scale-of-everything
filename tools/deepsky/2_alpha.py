import os
HERE = os.path.dirname(os.path.abspath(__file__))
import json, os, math, shutil
from PIL import Image
import pathlib
REPO = str(pathlib.Path(__file__).resolve().parents[2])
man = json.load(open(HERE + "/manifest.json"))

# A soft elliptical edge fade, baked into the WebP alpha channel. Sprites in the
# scene need this: a rectangular photograph on a black sky reads as a rectangle,
# and there is no rectangle out there. Pixel values are untouched.
def vignette(im):
    w, h = im.size
    a = Image.new("L", (w, h))
    px = a.load()
    cx, cy = (w - 1) / 2, (h - 1) / 2
    for y in range(h):
        dy = (y - cy) / cy
        for x in range(w):
            dx = (x - cx) / cx
            r = math.hypot(dx, dy)
            if r <= 0.62: v = 1.0
            elif r >= 1.0: v = 0.0
            else:
                t = (r - 0.62) / 0.38
                v = 1 - (t * t * (3 - 2 * t))   # smoothstep
            px[x, y] = int(v * 255)
    return a

total = 0
for key, m in man.items():
    im = Image.open(HERE + "/out/" + key + ".webp").convert("RGB")
    im.putalpha(vignette(im))
    p = REPO + "/assets/deepsky/" + key + ".webp"
    im.save(p, "WEBP", quality=80, method=6)
    total += os.path.getsize(p)
    print(f"{key:9s} {im.width}x{im.height} {os.path.getsize(p)//1024:4d} KB  alpha")
print("TOTAL", total // 1024, "KB")
