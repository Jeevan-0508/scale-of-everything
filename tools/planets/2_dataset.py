"""Build data/planets.json from the NASA fact-sheet table plus the image
manifest, and copy the images into assets/planets/.

Everything numeric here comes from the NASA planetary fact sheets. Nothing is
interpolated, and where a value does not exist for a body the key is omitted
rather than filled in.
"""
import io, json, os, pathlib, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = str(pathlib.Path(__file__).resolve().parents[2])

FACT = "NASA planetary fact sheets, nssdc.gsfc.nasa.gov/planetary/factsheet"

# key: name, kind, parent, semi-major axis (AU, or km for the Moon),
# equatorial radius (km), sidereal orbital period (days),
# sidereal rotation period (hours, negative = retrograde),
# axial tilt (degrees, to the orbital plane)
BODIES = [
 ("sun", "Sun", "star", None, None, 695700.0, None, 609.12, 7.25),
 ("mercury", "Mercury", "planet", "Sun", 0.387, 2439.7, 87.97, 1407.6, 0.034),
 ("venus", "Venus", "planet", "Sun", 0.723, 6051.8, 224.70, -5832.5, 177.36),
 ("earth", "Earth", "planet", "Sun", 1.000, 6371.0, 365.26, 23.9345, 23.44),
 ("moon", "Moon", "natural satellite", "Earth", None, 1737.4, 27.3217, 655.728, 6.68),
 ("mars", "Mars", "planet", "Sun", 1.524, 3389.5, 686.98, 24.6229, 25.19),
 ("jupiter", "Jupiter", "planet", "Sun", 5.203, 69911.0, 4332.59, 9.9250, 3.13),
 ("saturn", "Saturn", "planet", "Sun", 9.537, 58232.0, 10759.22, 10.656, 26.73),
 ("uranus", "Uranus", "planet", "Sun", 19.191, 25362.0, 30685.4, -17.24, 97.77),
 ("neptune", "Neptune", "planet", "Sun", 30.070, 24622.0, 60189.0, 16.11, 28.32),
 ("pluto", "Pluto", "dwarf planet", "Sun", 39.482, 1188.3, 90560.0, -153.2928, 122.53),
]

# The Moon's orbit is quoted from Earth, not from the Sun.
MOON_KM_FROM_EARTH = 384400.0

BLURB = {
 "sun": "One star, holding 99.86 per cent of the mass of everything else on this level combined.",
 "mercury": "No atmosphere to move heat around, so the same body runs 430 C in daylight and -180 C at night.",
 "venus": "The surface map is hidden under permanent cloud; what you see here is the cloud deck, not the ground.",
 "earth": "The only one of these where the surface, the ocean and the air have been measured from the inside.",
 "moon": "Locked so that the same hemisphere always faces Earth. Its rotation period and its orbital period are the same number.",
 "mars": "Two thirds the diameter of Earth, with the tallest volcano and the deepest canyon in the Solar System.",
 "jupiter": "More massive than every other planet put together. The banding is weather, and it moves.",
 "saturn": "The rings are ice and rock in orbit, not a solid sheet, and they are thinner relative to their width than a sheet of paper.",
 "uranus": "Tipped 98 degrees, so it rolls along its orbit rather than spinning upright.",
 "neptune": "Never visited since Voyager 2 in 1989. Every image of it is from that one week.",
 "pluto": "Reclassified in 2006, then photographed close up for the first time in 2015. The heart-shaped plain is nitrogen ice.",
}

# NASA Saturn fact sheet: D ring inner edge to A ring outer edge, kilometres
# from Saturn's centre.
RINGS = {"inner_km": 66900.0, "outer_km": 136775.0,
         "note": "D ring inner edge to A ring outer edge. The Cassini Division and the "
                 "gaps inside it are carried in the texture's alpha channel, not faked."}

# What the map actually shows. The four giants and Venus have no visible solid
# surface, so calling their textures a "surface map" would be wrong.
MAP_ROLE = {
 "sun": "photosphere map",
 "venus": "cloud-top map", "jupiter": "cloud-top map", "saturn": "cloud-top map",
 "uranus": "cloud-top map", "neptune": "cloud-top map",
}

MAP_CAVEAT = ("Surface maps are photographic mosaics reprojected onto a rectangle, "
              "assembled from many frames taken at different times, angles and "
              "resolutions. They are derived from real observations but they are not "
              "single photographs, which is why the single photograph is shown beside "
              "each one.")

man = json.load(io.open(HERE + "/manifest.json", encoding="utf-8"))
dst = REPO + "/assets/planets"
os.makedirs(dst, exist_ok=True)


def img(section, key, prefix):
    m = man[section][key]
    shutil.copyfile(HERE + "/out/" + section + "/" + m["file"], dst + "/" + prefix + m["file"])
    return {
        "src": "assets/planets/" + prefix + m["file"], "w": m["w"], "h": m["h"],
        "credit": (m["artist"] or m["credit"] or "Wikimedia Commons"),
        "licence": m["lic"], "licence_url": m["licurl"], "page": m["page"],
    }


out = []
for key, name, kind, parent, au, radius_km, orbit_days, rot_hours, tilt in BODIES:
    rec = {"id": key, "name": name, "kind": kind, "radius_km": radius_km,
           "rot_hours": rot_hours, "tilt_deg": tilt, "blurb": BLURB[key],
           "map_role": MAP_ROLE.get(key, "surface map"),
           "map": img("maps", key, "map-"), "shot": img("shots", key, "shot-")}
    if parent:
        rec["parent"] = parent
    if au is not None:
        rec["au"] = au
        rec["orbit_days"] = orbit_days
    if key == "moon":
        rec["orbit_km_from_earth"] = MOON_KM_FROM_EARTH
        rec["orbit_days"] = orbit_days
    if key == "earth":
        # The Earth rung fills the screen with this one body, so it gets the
        # cloud and night-lights layers the small orbital view cannot show.
        rec["layers"] = {"clouds": img("layers", "earth-clouds", "map-"),
                         "night": img("layers", "earth-night", "map-")}
    if key == "saturn":
        r = dict(RINGS)
        r.update(img("maps", "saturn-ring", "map-"))
        r["inner_radii"] = round(RINGS["inner_km"] / radius_km, 4)
        r["outer_radii"] = round(RINGS["outer_km"] / radius_km, 4)
        rec["rings"] = r
    out.append(rec)

assert len(out) == len(BODIES) == 11
assert sum(1 for r in out if r["kind"] == "planet") == 8

pack = {
    "generated_by": "tools/planets/",
    "source": FACT,
    "evidence": "measured",
    "map_caveat": MAP_CAVEAT,
    "note": "Orbital radii and body radii are compressed for display; every figure "
            "quoted in the panel is the real one.",
    "count": len(out),
    "bodies": out,
}
json.dump(pack, io.open(REPO + "/data/planets.json", "w", encoding="utf-8"),
          indent=1, ensure_ascii=False)

kb = sum(os.path.getsize(dst + "/" + f) for f in os.listdir(dst)) // 1024
print("bodies:", len(out), "| images:", len(os.listdir(dst)), "| KB:", kb)
for r in out:
    print("  %-8s %-18s r=%9.1f km  rot=%s h" % (r["id"], r["kind"], r["radius_km"], r["rot_hours"]))
