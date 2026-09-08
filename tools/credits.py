import os
HERE = os.path.dirname(os.path.abspath(__file__))
import json, io, os, re
import pathlib
REPO = str(pathlib.Path(__file__).resolve().parents[1])
pack=json.load(io.open(REPO+"/data/deepsky.json",encoding="utf-8"))
sol=json.load(io.open(REPO+"/data/planets.json",encoding="utf-8"))
clean=lambda t: re.sub(r"\s+"," ",t or "").replace("|","/").strip() or "Wikimedia Commons"
L=[]
L.append("# Image credits\n")
L.append("Every image in this repository is real observational data released under a free")
L.append("licence. None of them are renders. This file is generated from the datasets, so it")
L.append("cannot drift away from what actually ships.\n")
L.append("Regenerate with the numbered scripts in `tools/deepsky/` and `tools/planets/`,")
L.append("then `python tools/credits.py`.\n")
L.append("## Deep sky\n")
L.append("Each was downscaled to 760 px on its long edge, converted to WebP, and given a soft")
L.append("elliptical fade in its alpha channel so it does not read as a rectangle against the")
L.append("sky. Pixel values were not otherwise altered.\n")
L.append("| Object | File | Licence | Credit | Source page |")
L.append("|---|---|---|---|---|")
for o in sorted(pack["objects"], key=lambda r: r["name"]):
    f=os.path.basename(o["image"])
    cred=clean(o["image_credit"])
    L.append(f'| {o["name"]} | `{f}` | {o["image_licence"]} | {cred} | [Commons]({o["image_page"]}) |')
L.append("")
L.append("## Solar System\n")
L.append(sol["map_caveat"] + "\n")
L.append("Surface maps were resampled to 1024 x 512 equirectangular WebP; the photographs to")
L.append("640 px on their long edge. Figures come from " + sol["source"] + ".\n")
L.append("| Body | Image | Role | Licence | Credit | Source page |")
L.append("|---|---|---|---|---|---|")
for b in sol["bodies"]:
    rows=[("map",b["map_role"],b["map"]),("shot","photograph",b["shot"])]
    if "rings" in b: rows.append(("ring","ring strip",b["rings"]))
    for _,role,im in rows:
        L.append("| %s | `%s` | %s | %s | %s | [Commons](%s) |" % (
          b["name"], os.path.basename(im["src"]), role, im["licence"],
          clean(im["credit"]), im["page"]))
L.append("")
L.append("## Deep sky: positions and distances\n")
L.append("Coordinates: SIMBAD `basic` table, ICRS J2000 (https://simbad.cds.unistra.fr/simbad/sim-tap).")
L.append("Angular sizes: SIMBAD `galdim`, arcminutes, omitted where SIMBAD carries no value.")
L.append("Distances, per object, with the method that produced each one:\n")
L.append("| Object | Distance | Method | Reference |")
L.append("|---|---|---|---|")
for o in sorted(pack["objects"], key=lambda r: r["dist_ly"]):
    d = (f'{round(o["dist_ly"]/1e6):,} Mly' if o["dist_ly"]>=1e6 else f'{round(o["dist_ly"]):,} ly')
    L.append(f'| {o["name"]} | {d} | {o["dist_method"]} | {o["dist_ref"]} |')
L.append("")
io.open(REPO+"/CREDITS.md","w",encoding="utf-8",newline="\n").write("\n".join(L))
print("CREDITS.md:", len(L), "lines")
