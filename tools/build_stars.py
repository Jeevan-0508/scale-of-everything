#!/usr/bin/env python3
"""Pack the HYG star catalogue into a browser-sized binary.

Input : hygdata_v41.csv from astronexus/HYG-Database (CC BY-SA 4.0)
Output: data/stars.bin   little-endian float32, 5 per star: x y z mag ci
        data/stars.json  named stars + provenance, indexed into stars.bin

Stars are sorted by distance from the Sun so the renderer can draw a
radius-limited subset with a single drawRange call instead of rebuilding
geometry whenever the viewer changes scale level.
"""
import csv, json, struct, sys, math
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "hyg.csv")
OUT = Path(__file__).resolve().parent.parent / "data"
MAX_DIST_PC = 1000.0   # HYG parallax distances degrade badly past this
MAX_STARS = 60000      # ~1.2 MB at 20 bytes/star

rows = []
with SRC.open(newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        try:
            dist = float(r["dist"])
            mag = float(r["mag"])
            x, y, z = float(r["x"]), float(r["y"]), float(r["z"])
        except (ValueError, TypeError, KeyError):
            continue
        # HYG uses dist=100000 as a sentinel for "parallax unusable"
        if not (0.0 <= dist <= MAX_DIST_PC) or dist >= 100000:
            continue
        if not all(map(math.isfinite, (x, y, z, mag))):
            continue
        try:
            ci = float(r["ci"])
        except (ValueError, TypeError):
            ci = 0.65  # Sun-like default when colour index is absent
        rows.append({
            "x": x, "y": y, "z": z, "dist": dist, "mag": mag, "ci": ci,
            "proper": (r.get("proper") or "").strip(),
            "bf": (r.get("bf") or "").strip(),
            "spect": (r.get("spect") or "").strip(),
            "con": (r.get("con") or "").strip(),
            "absmag": r.get("absmag") or "",
            "lum": r.get("lum") or "",
        })

total_in_range = len(rows)

# Keep every named star, then fill the remaining budget with the brightest.
named = [r for r in rows if r["proper"]]
unnamed = sorted((r for r in rows if not r["proper"]), key=lambda r: r["mag"])
keep = named + unnamed[: max(0, MAX_STARS - len(named))]
keep.sort(key=lambda r: r["dist"])

buf = bytearray()
for r in keep:
    buf += struct.pack("<5f", r["x"], r["y"], r["z"], r["mag"], r["ci"])

OUT.mkdir(parents=True, exist_ok=True)
(OUT / "stars.bin").write_bytes(buf)

named_out = []
for i, r in enumerate(keep):
    if not r["proper"]:
        continue
    named_out.append({
        "i": i, "name": r["proper"],
        "bf": r["bf"] or None,
        "dist_pc": round(r["dist"], 4),
        "dist_ly": round(r["dist"] * 3.261563777, 3),
        "mag": round(r["mag"], 3),
        "absmag": round(float(r["absmag"]), 3) if r["absmag"] not in ("", None) else None,
        "spect": r["spect"] or None,
        "con": r["con"] or None,
        "lum_sun": round(float(r["lum"]), 4) if r["lum"] not in ("", None) else None,
    })
named_out.sort(key=lambda s: s["mag"])

# Index boundaries so a level can draw "everything within R parsecs"
# as one contiguous range.
def count_within(pc):
    lo, hi = 0, len(keep)
    while lo < hi:
        mid = (lo + hi) // 2
        if keep[mid]["dist"] <= pc:
            lo = mid + 1
        else:
            hi = mid
    return lo

meta = {
    "source": "HYG Stellar Database v4.1 (Hipparcos + Yale Bright Star + Gliese)",
    "source_url": "https://github.com/astronexus/HYG-Database",
    "license": "CC BY-SA 4.0",
    "attribution": "David Nash / astronexus",
    "units": "positions in parsecs, equatorial cartesian, epoch/equinox J2000",
    "fields": ["x", "y", "z", "mag", "ci"],
    "bytes_per_star": 20,
    "count": len(keep),
    "catalogue_rows_within_range": total_in_range,
    "max_dist_pc": MAX_DIST_PC,
    "ranges": {str(pc): count_within(pc) for pc in (5, 10, 25, 50, 100, 250, 500, 1000)},
    "named": named_out,
}
(OUT / "stars.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")

print(f"in-range catalogue rows : {total_in_range}")
print(f"packed stars            : {len(keep)}  ({len(buf)/1e6:.2f} MB)")
print(f"named stars             : {len(named_out)}")
print("ranges (pc -> star count):", meta["ranges"])
