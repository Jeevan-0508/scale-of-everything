import os
HERE = os.path.dirname(os.path.abspath(__file__))
import json, math, os, shutil, re

PC_LY = 3.261563; LY_M = 9.4607304725808e15
import pathlib
REPO = str(pathlib.Path(__file__).resolve().parents[2])

# radius of each ladder shell, log10 metres, copied from src/levels.js
LEVELS = [("earth",6.8),("solar-system",12.7),("neighbourhood",17.9),("orion-arm",19.5),
          ("milky-way",21.0),("local-volume",23.2),("laniakea",24.4),
          ("observable-universe",26.9),("multiverse",28.5),("omniverse",30.0)]

# ra/dec: SIMBAD basic (ICRS, degrees). majaxis/minaxis: SIMBAD galdim, arcminutes;
# null where SIMBAD carries no value — an omission, never a guess.
SIM = {
 "M42":(83.8201,-5.3876,"H II region",66,66),
 "M16":(274.688,-13.792,"H II region + open cluster",80,80),
 "NGC6543":(269.63918,66.63299,"planetary nebula",0.623,0.536),
 "M57":(283.39624,33.02913,"planetary nebula",1.153,1.153),
 "NGC7293":(337.41061,-20.83715,"planetary nebula",13.4,13.4),
 "M1":(83.6324,22.0174,"supernova remnant",7,5),
 "NGC3372":(161.25929,-59.69994,"H II region",None,None),
 "NGC6960":(311.40833,30.70833,"supernova remnant",None,None),
 "M8":(270.90417,-24.38667,"H II region",None,None),
 "B33":(85.246,-2.458,"dark nebula",None,None),
 "NGC5139":(201.697,-47.47947,"globular cluster",36.3,36.3),
 "M45":(56.60083,24.11389,"open cluster",76.86,76.86),
 "M20":(270.675,-22.97167,"H II region",28,28),
 "NGC7000":(314.69583,44.33,"H II region",None,None),
 "M27":(299.90151,22.7212,"planetary nebula",6.7,6.7),
 "NGC2070":(84.675,-69.1,"H II region",3.5,3.5),
 "M104":(189.99763,-11.62305,"spiral galaxy",8.51,5.01),
 "M51":(202.46958,47.19526,"interacting spiral pair",9.04,7.78),
}

# dist_ly, method, reference, caveat
DIST = {
 "M42":(1344,"VLBA trigonometric parallax","Menten et al. 2007, A&A 474, 515 — 414 ± 7 pc",None),
 "M16":(5763,"Gaia parallax of the ionising cluster NGC 6611, 0.566 mas","Gaia DR2 via SIMBAD",
        "The parallax belongs to the cluster lighting the pillars, not to the dust itself."),
 "NGC6543":(4455,"Gaia parallax of the central star, 0.732 mas","Gaia DR3 via SIMBAD",
        "A single-star parallax at 1.4 kpc carries a real uncertainty; published distances for this nebula range from about 1.0 to 1.5 kpc."),
 "M57":(2569,"Gaia parallax of the central star, 1.270 mas","Gaia DR3 via SIMBAD",None),
 "NGC7293":(651,"Gaia parallax of the central star, 5.012 mas","Gaia DR3 via SIMBAD",None),
 "M1":(6500,"supernova-remnant expansion distance","Trimble 1973, PASP 85, 579 — about 2 kpc",
        "Expansion distances are model-dependent; this one is not a parallax."),
 "NGC3372":(8583,"parallax of the ionising cluster Trumpler 16, 0.380 mas","Gaia via SIMBAD",None),
 "NGC6960":(2400,"Gaia distances to stars bracketing the shell","Fesen et al. 2018, ApJ 855, 147 — 735 pc",None),
 "M8":(4100,"Gaia parallaxes of NGC 6530 members","Damiani et al. 2019, A&A 623, A25 — 1.25 kpc",None),
 "B33":(1375,"distance to the parent Orion B molecular cloud","Orion B cloud distance, about 420 pc",
        "The Horsehead is a silhouette in a cloud; the distance is the cloud's, not a direct measurement of the pillar."),
 "NGC5139":(16899,"Gaia parallax, 0.193 mas","Gaia DR3 via SIMBAD",None),
 "M45":(443,"Gaia parallax of cluster members, 7.364 mas","Gaia DR3 via SIMBAD",None),
 "M20":(4129,"Gaia parallax of the ionising cluster, 0.790 mas","Gaia DR2 via SIMBAD",None),
 "NGC7000":(2600,"three-dimensional dust mapping","Zucker et al. 2020, A&A 633, A51 — about 795 pc",None),
 "M27":(1269,"Gaia parallax of the central star, 2.570 mas","Gaia DR3 via SIMBAD",None),
 "NGC2070":(163000,"distance to the Large Magellanic Cloud","Pietrzynski et al. 2019, Nature 567, 200 — 49.59 kpc",
        "The nebula's distance is inherited from its host galaxy."),
 "M104":(36760000,"Cosmicflows-3 measured distance, 11.27 Mpc","Tully et al. 2016, AJ 152, 50 — the catalogue this project already ships",None),
 "M51":(23840000,"Cosmicflows-3 measured distance to NGC 5195, 7.31 Mpc","Tully et al. 2016, AJ 152, 50",
        "CF3 lists the companion NGC 5195; the pair shares a distance to within its own uncertainty."),
}

NAMES = {
 "M42":("Orion Nebula","M 42 / NGC 1976","Orion","The closest region of massive star formation. Four thousand young stars sit inside it, and the four hottest are burning the cavity you are looking into."),
 "M16":("Pillars of Creation","M 16 / NGC 6611, Eagle Nebula","Serpens","Columns of cold molecular dust being eaten away from the outside by ultraviolet light from the cluster above them. They are shrinking, not growing."),
 "NGC6543":("Cat's Eye Nebula","NGC 6543","Draco","A dying sun-like star shedding its outer layers in concentric shells about every 1,500 years. The rings are a record of that rhythm."),
 "M57":("Ring Nebula","M 57 / NGC 6720","Lyra","Not a ring but a barrel seen down its axis. The dark centre is the hole through the middle."),
 "NGC7293":("Helix Nebula","NGC 7293","Aquarius","One of the nearest planetary nebulae, which is why it looks so large. The knots around the inner edge are each about the size of our solar system."),
 "M1":("Crab Nebula","M 1 / NGC 1952","Taurus","The wreckage of a star seen exploding by Chinese astronomers in 1054 CE. A neutron star at the centre spins thirty times a second."),
 "NGC3372":("Carina Nebula","NGC 3372","Carina","A star-forming complex far larger and more violent than Orion, holding Eta Carinae — a star that may already be dead."),
 "NGC6960":("Veil Nebula","NGC 6960, Cygnus Loop","Cygnus","A supernova shock wave still expanding after roughly ten thousand years, now spread across six times the width of the full Moon."),
 "M8":("Lagoon Nebula","M 8 / NGC 6523","Sagittarius","A star nursery bright enough to see without a telescope from a dark site, split by a dust lane that gives it its name."),
 "B33":("Horsehead Nebula","Barnard 33 / IC 434","Orion","A column of opaque dust in front of a glowing background. You are seeing the shape of what blocks the light, not the light."),
 "NGC5139":("Omega Centauri","NGC 5139","Centaurus","Ten million stars bound into a sphere. It may be the stripped core of a small galaxy the Milky Way swallowed."),
 "M45":("Pleiades","M 45, the Seven Sisters","Taurus","A cluster young enough that its stars still drift through the dust they formed from. The blue haze is reflected starlight."),
 "M20":("Trifid Nebula","M 20 / NGC 6514","Sagittarius","Three kinds of nebula at once: emission, reflection, and the dark lanes that cut it into three."),
 "NGC7000":("North America Nebula","NGC 7000","Cygnus","An emission nebula whose outline happens to resemble a continent. The resemblance is a coincidence of perspective."),
 "M27":("Dumbbell Nebula","M 27 / NGC 6853","Vulpecula","The first planetary nebula ever found, by Messier in 1764, long before anyone knew what it was."),
 "NGC2070":("Tarantula Nebula","NGC 2070, 30 Doradus","Dorado","The most active star-forming region known in the Local Group — and it is not even in our galaxy."),
 "M104":("Sombrero Galaxy","M 104 / NGC 4594","Virgo","An edge-on spiral with a dust lane sharp enough to look drawn, wrapped around an unusually large bulge."),
 "M51":("Whirlpool Galaxy","M 51 / NGC 5194 and NGC 5195","Canes Venatici","A face-on spiral being pulled out of shape by the smaller galaxy at the end of one arm."),
}

def level_for(dist_ly):
    m = dist_ly * LY_M
    for i,(id_,ls) in enumerate(LEVELS):
        if 10**ls >= m: return i, id_
    raise ValueError(dist_ly)

# Placement space. The 16 galactic objects are placed from RA/Dec inside the
# shell that already renders the HYG star field, so they share its scale exactly.
# The three objects that live in galaxy space are anchored to the Cosmicflows-3
# row the project already ships, rather than to a second, disagreeing distance.
SHELL_RADIUS_PC = {"orion-arm": 1000, "milky-way": 26800}
CF3_ROW = {"NGC2070": (0, "Anchored to the Large Magellanic Cloud row in Cosmicflows-3, which is its host galaxy."),
           "M104": (405, None),
           "M51": (258, "Anchored to the Cosmicflows-3 row for NGC 5195, the interacting companion.")}

man = json.load(open(HERE + "/manifest.json"))
out = []
for key,(ra,dec,otype,maj,minr) in SIM.items():
    d_ly, method, ref, caveat = DIST[key]
    name, desig, con, blurb = NAMES[key]
    lvl, lvl_id = level_for(d_ly)
    im = man[key]
    rec = {
      "id": key.lower(), "name": name, "desig": desig, "type": otype,
      "constellation": con, "blurb": blurb,
      "ra_deg": ra, "dec_deg": dec,
      "dist_ly": d_ly, "dist_pc": round(d_ly / PC_LY, 2),
      "dist_method": method, "dist_ref": ref,
      "level": lvl, "level_id": lvl_id,
      "image": "assets/deepsky/" + im["file"], "image_w": im["w"], "image_h": im["h"],
      "image_credit": (im["artist"] or im["credit"] or "Wikimedia Commons"),
      "image_licence": im["lic"], "image_licence_url": im["licurl"],
      "image_page": im["page"],
      "coord_source": "SIMBAD basic, ICRS J2000",
    }
    if key in CF3_ROW:
      row, note = CF3_ROW[key]
      rec["space"] = "cf3"
      rec["cf3_row"] = row
      if note: rec["anchor_note"] = note
    else:
      rec["space"] = "equatorial"
      rec["shell_radius_pc"] = SHELL_RADIUS_PC[lvl_id]
      assert rec["dist_pc"] <= rec["shell_radius_pc"], (key, rec["dist_pc"])
    if maj is not None:
        rec["ang_maj_arcmin"] = maj
        rec["ang_min_arcmin"] = minr
        rec["ang_source"] = "SIMBAD galdim"
    if caveat: rec["caveat"] = caveat
    out.append(rec)

out.sort(key=lambda r: r["dist_ly"])
pack = {
  "generated_by": "tools/deepsky/",
  "coordinates": "SIMBAD basic table, ICRS J2000, degrees",
  "coordinate_source_url": "https://simbad.cds.unistra.fr/simbad/sim-tap",
  "angular_sizes": "SIMBAD galdim, arcminutes; omitted where SIMBAD has no value",
  "evidence": "measured",
  "note": "Every distance is a published measurement with its method and reference recorded. Images are real telescope data, not renders.",
  "count": len(out),
  "objects": out,
}
os.makedirs(REPO+"/assets/deepsky", exist_ok=True)
json.dump(pack, open(REPO+"/data/deepsky.json","w"), indent=1, ensure_ascii=False)

by = {}
for r in out: by.setdefault(r["level_id"], []).append(r["name"])
for k,v in by.items(): print(f"{k:20s} {len(v):2d}  {', '.join(v)}")
print("objects:", len(out), "| images:", len(os.listdir(REPO+"/assets/deepsky")),
      "| KB:", sum(os.path.getsize(REPO+"/assets/deepsky/"+f) for f in os.listdir(REPO+"/assets/deepsky"))//1024)
