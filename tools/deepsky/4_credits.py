import os
HERE = os.path.dirname(os.path.abspath(__file__))
import json, io, os, re
import pathlib
REPO = str(pathlib.Path(__file__).resolve().parents[2])
pack=json.load(io.open(REPO+"/data/deepsky.json",encoding="utf-8"))
L=[]
L.append("# Image credits\n")
L.append("Every image in `assets/deepsky/` is real observational data released under a free")
L.append("licence. None of them are renders. Each was downscaled to 760 px on its long edge,")
L.append("converted to WebP, and given a soft elliptical fade in its alpha channel so it does")
L.append("not read as a rectangle against the sky. Pixel values were not otherwise altered.\n")
L.append("Regenerate with `python tools/build_deepsky.py`.\n")
L.append("| Object | File | Licence | Credit | Source page |")
L.append("|---|---|---|---|---|")
for o in sorted(pack["objects"], key=lambda r: r["name"]):
    f=os.path.basename(o["image"])
    cred=re.sub(r"\s+"," ",o["image_credit"]).replace("|","/").strip() or "Wikimedia Commons"
    L.append(f'| {o["name"]} | `{f}` | {o["image_licence"]} | {cred} | [Commons]({o["image_page"]}) |')
L.append("")
L.append("## Positions and distances\n")
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
