#!/usr/bin/env python3
"""Pack Cosmicflows-3 into supergalactic cartesian coordinates.

Input : cf3.tsv  — VizieR J/AJ/152/50/table3 (Tully et al. 2016, AJ 152, 50)
Output: data/galaxies.bin   float32 x5 per galaxy: sgx sgy sgz dist_mpc ksmag
        data/galaxies.json  notable galaxies, clusters, provenance

Supergalactic coordinates are used because that is the frame Laniakea is
defined in: the supergalactic plane is the plane of the local flattened
distribution of galaxies, so real structure reads as structure rather than as
a smear across an arbitrary axis.

Sorted by distance so a level can draw a radius-limited subset via drawRange.
"""
import json, math, struct, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from aliases import normalise, MESSIER, COMMON, CLUSTER_NAMES, PGC_TO_DESIG

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "cf3.tsv")
OUT = Path(__file__).resolve().parent.parent / "data"
NEAR_MPC = 5.0        # keep every named galaxy inside this radius
BRIGHT_BEYOND = 500   # plus this many brightest beyond it

DESIG_TO_MESSIER = {v: k for k, v in MESSIER.items()}

lines = [l for l in SRC.read_text(encoding="utf-8", errors="replace").splitlines()
         if l and not l.startswith("#")]
header = lines[0].split("\t")
body = [l for l in lines[1:] if not l.startswith("---")]
if body and body[0].split("\t")[header.index("Dist")].strip() in ("Mpc", ""):
    body = body[1:]

def field(parts, name):
    try:
        return parts[header.index(name)].strip()
    except (ValueError, IndexError):
        return ""

rows = []
for line in body:
    parts = line.split("\t")
    if len(parts) < len(header):
        continue
    try:
        dist = float(field(parts, "Dist"))
        sgl = math.radians(float(field(parts, "SGLON")))
        sgb = math.radians(float(field(parts, "SGLAT")))
    except ValueError:
        continue
    if not (dist > 0) or not math.isfinite(dist):
        continue
    try:
        ks = float(field(parts, "Ksmag"))
    except ValueError:
        ks = float("nan")
    rows.append({
        "x": dist * math.cos(sgb) * math.cos(sgl),
        "y": dist * math.cos(sgb) * math.sin(sgl),
        "z": dist * math.sin(sgb),
        "dist": dist,
        "ks": ks,
        "raw": field(parts, "Name"),
        "pgc": field(parts, "PGC"),
        "mtype": field(parts, "MType"),
        "group": field(parts, "GName"),
        "abell": field(parts, "Abell"),
    })

rows.sort(key=lambda r: r["dist"])

buf = bytearray()
for r in rows:
    ks = r["ks"] if math.isfinite(r["ks"]) else 99.0
    buf += struct.pack("<5f", r["x"], r["y"], r["z"], r["dist"], ks)
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "galaxies.bin").write_bytes(buf)

# RC3 morphological type code -> plain words, so the info panel and the
# language model both get something readable instead of a number.
def morph(t):
    if t == "":
        return None
    try:
        v = float(t)
    except ValueError:
        return None
    if v <= -3.5: return "elliptical"
    if v <= -0.5: return "lenticular"
    if v <= 0.5:  return "spiral (S0/a)"
    if v <= 4.5:  return "spiral"
    if v <= 8.5:  return "late spiral"
    return "irregular"

candidates = []
for i, r in enumerate(rows):
    if not r["raw"]:
        continue
    # PGC first: CF3 labels a few famous galaxies with an unrelated
    # catalogue number, which name normalisation cannot recover.
    try:
        desig = PGC_TO_DESIG.get(int(r["pgc"])) or normalise(r["raw"])
    except ValueError:
        desig = normalise(r["raw"])
    common, note = COMMON.get(desig, (None, None))
    entry = {
        "i": i,
        "desig": desig,
        "name": common or desig,
        "messier": DESIG_TO_MESSIER.get(desig),
        "note": note,
        "pgc": r["pgc"] or None,
        "dist_mpc": round(r["dist"], 3),
        "dist_mly": round(r["dist"] * 3.261563777, 2),
        "morph": morph(r["mtype"]),
        "ksmag": round(r["ks"], 2) if math.isfinite(r["ks"]) else None,
        "group": r["group"] or None,
        "abell": r["abell"] or None,
        "notable": bool(common),
    }
    candidates.append(entry)

near = [g for g in candidates if g["dist_mpc"] <= NEAR_MPC]
notable = [g for g in candidates if g["notable"] and g["dist_mpc"] > NEAR_MPC]
rest = sorted((g for g in candidates
               if g["dist_mpc"] > NEAR_MPC and not g["notable"] and g["ksmag"] is not None),
              key=lambda g: g["ksmag"])[:BRIGHT_BEYOND]
seen, named = set(), []
for g in near + notable + rest:
    if g["i"] in seen:
        continue
    seen.add(g["i"])
    named.append(g)
named.sort(key=lambda g: g["dist_mpc"])

clusters = {}
for r in rows:
    key = r["abell"] or r["group"]
    if not key:
        continue
    c = clusters.setdefault(key, {"key": key, "members": 0, "dist_sum": 0.0,
                                  "abell": bool(r["abell"])})
    c["members"] += 1
    c["dist_sum"] += r["dist"]
cluster_list = []
for c in clusters.values():
    if c["members"] < 5:
        continue
    name, note = CLUSTER_NAMES.get(c["key"], (c["key"], None))
    cluster_list.append({
        "key": c["key"], "name": name, "note": note,
        "members": c["members"],
        "dist_mpc": round(c["dist_sum"] / c["members"], 2),
        "dist_mly": round(c["dist_sum"] / c["members"] * 3.261563777, 1),
        "abell": c["abell"],
    })
cluster_list.sort(key=lambda c: -c["members"])

def count_within(mpc):
    lo, hi = 0, len(rows)
    while lo < hi:
        mid = (lo + hi) // 2
        if rows[mid]["dist"] <= mpc:
            lo = mid + 1
        else:
            hi = mid
    return lo

meta = {
    "source": "Cosmicflows-3 (CF3)",
    "citation": "Tully R.B., Courtois H.M., Sorce J.G. 2016, AJ 152, 50",
    "source_url": "https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=J/AJ/152/50",
    "provider": "CDS/VizieR",
    "units": "supergalactic cartesian, megaparsecs",
    "fields": ["sgx", "sgy", "sgz", "dist_mpc", "ksmag"],
    "bytes_per_galaxy": 20,
    "count": len(rows),
    "dist_range_mpc": [round(rows[0]["dist"], 3), round(rows[-1]["dist"], 2)],
    "ranges": {str(m): count_within(m) for m in (1, 5, 10, 25, 50, 80, 160, 300, 520)},
    "named": named,
    "clusters": cluster_list[:100],
}
(OUT / "galaxies.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")

size = (OUT / "galaxies.json").stat().st_size
print(f"galaxies packed  : {len(rows)}  ({len(buf)/1e6:.2f} MB bin)")
print(f"named kept       : {len(named)} of {len(candidates)} candidates  (json {size/1e6:.2f} MB)")
print(f"with common names: {sum(1 for g in named if g['notable'])}")
print(f"clusters (>=5)   : {len(cluster_list)}")
print(f"distance range   : {meta['dist_range_mpc']} Mpc")
