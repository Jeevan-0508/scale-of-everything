"""Fetch the free-licensed surface maps and spacecraft photographs for the
Solar System rung, downscale them, and record every licence in manifest.json.

Two different kinds of image, deliberately kept apart:
  maps  - equirectangular projections wrapped onto the spheres
  shots - single spacecraft or telescope frames shown in the info panel
A map is a mosaic assembled into a projection, not a photograph, and the
project must not present it as one.
"""
import os, io, re, json, urllib.request, urllib.parse
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "soe-build/1.0 (jeevansiddhabhaktula@gmail.com)"}

MAPS = {
    "sun":     "File:Solarsystemscope texture 2k sun.jpg",
    "mercury": "File:Solarsystemscope texture 2k mercury.jpg",
    "venus":   "File:Solarsystemscope texture 2k venus atmosphere.jpg",
    "earth":   "File:Solarsystemscope texture 2k earth daymap.jpg",
    "moon":    "File:Solarsystemscope texture 2k moon.jpg",
    "mars":    "File:Solarsystemscope texture 2k mars.jpg",
    "jupiter": "File:Solarsystemscope texture 2k jupiter.jpg",
    "saturn":  "File:Solarsystemscope texture 2k saturn.jpg",
    "uranus":  "File:Solarsystemscope texture 2k uranus.jpg",
    "neptune": "File:Solarsystemscope texture 2k neptune.jpg",
    "pluto":   "File:Pluto color mapmosaic.jpg",
}
RING = ("saturn-ring", "File:Solarsystemscope texture 2k saturn ring alpha.png")

# Extra layers for the Earth rung, where the globe fills the screen and a single
# flat day map is not what Earth looks like. Both are real: the cloud layer is a
# satellite composite, the night layer is city lights from orbital night imagery.
LAYERS = {
    "earth-clouds": "File:Solarsystemscope texture 2k earth clouds.jpg",
    "earth-night":  "File:Solarsystemscope texture 2k earth nightmap.jpg",
}

SHOTS = {
    "sun":     "File:The Sun in white light.jpg",
    "mercury": "File:Mercury in true color.jpg",
    "venus":   "File:Venus from Mariner 10.jpg",
    "earth":   "File:The Earth seen from Apollo 17.jpg",
    "moon":    "File:FullMoon2010.jpg",
    "mars":    "File:OSIRIS Mars true color.jpg",
    "jupiter": "File:Jupiter and its shrunken Great Red Spot.jpg",
    "saturn":  "File:Saturn during Equinox.jpg",
    "uranus":  "File:Uranus2.jpg",
    "neptune": "File:Neptune - Voyager 2 (29347980845) flatten crop.jpg",
    "pluto":   "File:Pluto in True Color - High-Res.jpg",
}

MAP_W, SHOT_MAX = 1024, 640


def strip(h):
    if not h:
        return ""
    t = re.sub(r"<[^>]+>", " ", h).replace("&amp;", "&")
    return re.sub(r"\s+", " ", t).strip(" |;,")


def lookup(titles, width):
    out = {}
    titles = sorted(set(titles))
    for i in range(0, len(titles), 12):
        u = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode({
            "action": "query", "format": "json", "prop": "imageinfo",
            "iiprop": "url|size|extmetadata", "iiurlwidth": str(width),
            "titles": "|".join(titles[i:i + 12])})
        d = json.loads(urllib.request.urlopen(
            urllib.request.Request(u, headers=UA), timeout=120).read())
        for p in d["query"]["pages"].values():
            ii = p.get("imageinfo")
            assert ii, "missing on Commons: " + p["title"]
            em = ii[0].get("extmetadata", {})
            out[p["title"]] = {
                "thumb": ii[0]["thumburl"], "page": ii[0]["descriptionurl"],
                "lic": em.get("LicenseShortName", {}).get("value", "?"),
                "licurl": em.get("LicenseUrl", {}).get("value", ""),
                "artist": strip(em.get("Artist", {}).get("value", ""))[:200],
                "credit": strip(em.get("Credit", {}).get("value", ""))[:200]}
    return out


def grab(url):
    return urllib.request.urlopen(
        urllib.request.Request(url, headers=UA), timeout=240).read()


info = lookup(list(MAPS.values()) + [RING[1]] + list(LAYERS.values()), MAP_W)
info.update(lookup(SHOTS.values(), SHOT_MAX))

os.makedirs(HERE + "/out/maps", exist_ok=True)
os.makedirs(HERE + "/out/shots", exist_ok=True)
os.makedirs(HERE + "/out/layers", exist_ok=True)
manifest = {"maps": {}, "shots": {}, "layers": {}}


def record(section, key, title, path, im):
    m = info[title]
    manifest[section][key] = {
        "file": os.path.basename(path), "w": im.width, "h": im.height,
        "bytes": os.path.getsize(path), "commons": title, "page": m["page"],
        "lic": m["lic"], "licurl": m["licurl"],
        "artist": m["artist"], "credit": m["credit"]}
    print("%-6s %-12s %4dx%-4d %4d KB  %s"
          % (section, key, im.width, im.height,
             os.path.getsize(path) // 1024, m["lic"]))


for key, title in MAPS.items():
    im = Image.open(io.BytesIO(grab(info[title]["thumb"]))).convert("RGB")
    # Equirectangular means exactly 2:1. Every source here already is; assert
    # rather than squash, because a wrong aspect wraps the surface crookedly.
    assert abs(im.width / im.height - 2) < 0.03, (key, im.size)
    im = im.resize((MAP_W, MAP_W // 2), Image.LANCZOS)
    p = HERE + "/out/maps/" + key + ".webp"
    im.save(p, "WEBP", quality=80, method=6)
    record("maps", key, title, p, im)

# The ring is a radial strip: one pixel column per ring radius, alpha carrying
# the gaps. Kept with its alpha channel and not resampled vertically.
im = Image.open(io.BytesIO(grab(info[RING[1]]["thumb"]))).convert("RGBA")
im = im.resize((1024, 32), Image.LANCZOS)
p = HERE + "/out/maps/saturn-ring.webp"
im.save(p, "WEBP", quality=88, method=6, lossless=False)
record("maps", RING[0], RING[1], p, im)

# The cloud layer is the composite's own luminance kept as greyscale and used
# as an alpha mask on white. Stored without an alpha channel on purpose: a soft
# alpha gradient costs 380 KB in WebP where the same data as grey costs 30.
# Nothing is invented that the composite does not contain.
im = Image.open(io.BytesIO(grab(info[LAYERS["earth-clouds"]]["thumb"]))).convert("L")
im = im.resize((MAP_W, MAP_W // 2), Image.LANCZOS).convert("RGB")
p = HERE + "/out/layers/earth-clouds.webp"
im.save(p, "WEBP", quality=72, method=6)
record("layers", "earth-clouds", LAYERS["earth-clouds"], p, im)

im = Image.open(io.BytesIO(grab(info[LAYERS["earth-night"]]["thumb"]))).convert("RGB")
im = im.resize((MAP_W, MAP_W // 2), Image.LANCZOS)
p = HERE + "/out/layers/earth-night.webp"
im.save(p, "WEBP", quality=80, method=6)
record("layers", "earth-night", LAYERS["earth-night"], p, im)

for key, title in SHOTS.items():
    im = Image.open(io.BytesIO(grab(info[title]["thumb"]))).convert("RGB")
    im.thumbnail((SHOT_MAX, SHOT_MAX), Image.LANCZOS)
    p = HERE + "/out/shots/" + key + ".webp"
    im.save(p, "WEBP", quality=78, method=6)
    record("shots", key, title, p, im)

json.dump(manifest, open(HERE + "/manifest.json", "w"), indent=1)
total = sum(v["bytes"] for s in manifest.values() for v in s.values())
print("TOTAL", total // 1024, "KB")
