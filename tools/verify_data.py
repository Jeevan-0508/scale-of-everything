#!/usr/bin/env python3
"""Assert the shipped data files are internally consistent and fully backed.

Run after any pipeline change. Every alias must resolve to a real catalogue
row, every binary must match its declared row count, and a set of distances
with well-established published values must still agree.
"""
import json, struct, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from aliases import COMMON, CLUSTER_NAMES, MESSIER

DATA = Path(__file__).resolve().parent.parent / "data"
failures = []

def check(cond, msg):
    if cond:
        print(f"  ok   {msg}")
    else:
        failures.append(msg)
        print(f"  FAIL {msg}")

print("stars.bin / stars.json")
stars = json.loads((DATA / "stars.json").read_text(encoding="utf-8"))
sbin = (DATA / "stars.bin").read_bytes()
check(len(sbin) == stars["count"] * 20, f"binary length matches count ({stars['count']} stars)")
check(len(sbin) % 20 == 0, "binary is a whole number of 20-byte records")
sxyz = struct.unpack(f"<{len(sbin)//4}f", sbin)
check(all(abs(v) < 2000 for v in sxyz[0:3]), "first star (Sol) sits at the origin")

# Distances with long-published values. Tolerance is loose where the
# literature itself disagrees (Betelgeuse's parallax is famously contested).
STAR_TRUTH = {
    "Sirius": (8.60, 0.1), "Proxima Centauri": (4.25, 0.1),
    "Vega": (25.04, 0.3), "Arcturus": (36.7, 0.6),
    "Polaris": (433.0, 25.0), "Rigel": (860.0, 60.0),
}
byname = {s["name"]: s for s in stars["named"]}
for name, (truth, tol) in STAR_TRUTH.items():
    s = byname.get(name)
    if not s:
        check(False, f"{name} present in stars.json")
        continue
    check(abs(s["dist_ly"] - truth) <= tol,
          f"{name} at {s['dist_ly']} ly (published {truth} +/- {tol})")

print("\ngalaxies.bin / galaxies.json")
gal = json.loads((DATA / "galaxies.json").read_text(encoding="utf-8"))
gbin = (DATA / "galaxies.bin").read_bytes()
check(len(gbin) == gal["count"] * 20, f"binary length matches count ({gal['count']} galaxies)")

have_desig = {g["desig"] for g in gal["named"]}
dead = sorted(k for k in COMMON if k not in have_desig)
check(not dead, f"every COMMON alias resolves to a catalogue row (dead: {dead or 'none'})")

have_cluster = {c["key"] for c in gal["clusters"]}
deadc = sorted(k for k in CLUSTER_NAMES if k not in have_cluster)
check(not deadc, f"every CLUSTER_NAMES alias resolves (dead: {deadc or 'none'})")

named_desigs = {g["desig"] for g in gal["named"]}
dead_m = sorted(m for m, d in MESSIER.items() if d in COMMON and d not in named_desigs)
check(not dead_m, f"every Messier cross-id with a blurb is present (dead: {dead_m or 'none'})")

GAL_TRUTH = {
    "NGC224": (0.78, 0.05), "NGC598": (0.87, 0.06), "LMC": (0.0499, 0.01),
    "NGC4486": (16.4, 1.0), "NGC5236": (4.66, 0.4), "NGC3034": (3.6, 0.3),
    "NGC5055": (8.99, 0.5),
}
bydesig = {g["desig"]: g for g in gal["named"]}
for desig, (truth, tol) in GAL_TRUTH.items():
    g = bydesig.get(desig)
    if not g:
        check(False, f"{desig} present in galaxies.json")
        continue
    check(abs(g["dist_mpc"] - truth) <= tol,
          f"{g['name']} at {g['dist_mpc']} Mpc (published {truth} +/- {tol})")

CLUSTER_TRUTH = {"A1656": (99.0, 8.0), "Virgo": (16.5, 2.0), "Fornax": (19.0, 3.0)}
bykey = {c["key"]: c for c in gal["clusters"]}
for key, (truth, tol) in CLUSTER_TRUTH.items():
    c = bykey.get(key)
    if not c:
        check(False, f"{key} present in clusters")
        continue
    check(abs(c["dist_mpc"] - truth) <= tol,
          f"{c['name']} at {c['dist_mpc']} Mpc (published {truth} +/- {tol})")

print("\nranges are monotonic")
for label, obj in (("stars", stars), ("galaxies", gal)):
    vals = [v for _, v in sorted(obj["ranges"].items(), key=lambda kv: float(kv[0]))]
    check(vals == sorted(vals), f"{label}: cumulative counts increase with radius")
    check(vals[-1] == obj["count"], f"{label}: widest range equals total count")

print()
if failures:
    print(f"{len(failures)} CHECK(S) FAILED")
    for f in failures:
        print("  -", f)
    sys.exit(1)
print("all data checks passed")
