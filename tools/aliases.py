"""Common names for galaxies, keyed by normalised NGC/IC designation.

Cosmicflows-3 identifies galaxies by catalogue number with inconsistent zero
padding (NGC0224, NGC147, N4486 all appear). Nobody searches for "NGC0224",
so designations are normalised and this table supplies the names people
actually use. Messier cross-identifications are standard and long-published.
"""

# Messier number -> normalised catalogue designation
MESSIER = {
    "M31": "NGC224",  "M32": "NGC221",  "M33": "NGC598",  "M49": "NGC4472",
    "M58": "NGC4579", "M59": "NGC4621", "M60": "NGC4649",
    "M61": "NGC4303", "M63": "NGC5055", "M64": "NGC4826", "M65": "NGC3623",
    "M66": "NGC3627", "M81": "NGC3031",
    "M82": "NGC3034", "M83": "NGC5236", "M84": "NGC4374", "M85": "NGC4382",
    "M86": "NGC4406", "M87": "NGC4486", "M88": "NGC4501", "M89": "NGC4552",
    "M90": "NGC4569", "M91": "NGC4548", "M94": "NGC4736", "M95": "NGC3351",
    "M96": "NGC3368", "M98": "NGC4192", "M99": "NGC4254", "M100": "NGC4321",
    "M101": "NGC5457", "M102": "NGC5866", "M104": "NGC4594", "M105": "NGC3379",
    "M106": "NGC4258", "M108": "NGC3556", "M109": "NGC3992", "M110": "NGC205",
}

# Normalised designation -> (common name, one-line note)
COMMON = {
    "NGC224":  ("Andromeda Galaxy", "The nearest large spiral, approaching us at 110 km/s; it will merge with the Milky Way in about 4.5 billion years."),
    "NGC598":  ("Triangulum Galaxy", "Third-largest member of the Local Group and probably a satellite of Andromeda."),
    "NGC205":  ("Andromeda's satellite M110", "A dwarf elliptical bound to Andromeda."),
    "NGC221":  ("M32", "A compact dwarf elliptical orbiting Andromeda, unusually dense for its size."),
    "NGC5457": ("Pinwheel Galaxy", "A face-on spiral roughly twice the diameter of the Milky Way."),
    "NGC4594": ("Sombrero Galaxy", "Seen nearly edge-on, with a dust lane so sharp it looks drawn."),
    "NGC4486": ("M87", "Home to the first black hole ever imaged, in 2019, at 6.5 billion solar masses."),
    "NGC3031": ("Bode's Galaxy", "A bright grand-design spiral, gravitationally tangled with the Cigar Galaxy."),
    "NGC3034": ("Cigar Galaxy", "A starburst galaxy forming stars roughly ten times faster than ours."),
    "NGC5236": ("Southern Pinwheel", "One of the closest and brightest barred spirals."),
    "NGC4826": ("Black Eye Galaxy", "A dark dust band across the nucleus, thought to be the debris of a merger."),
    "NGC5055": ("Sunflower Galaxy", "Tightly wound flocculent arms rather than clean spiral structure."),
    "NGC5128": ("Centaurus A", "The nearest radio galaxy, crossed by a dust lane from a swallowed spiral."),
    "NGC253":  ("Sculptor Galaxy", "A dusty starburst spiral, the brightest member of the Sculptor Group."),
    "NGC6822": ("Barnard's Galaxy", "An irregular dwarf in the Local Group, sometimes called a miniature Magellanic Cloud."),
    "NGC4258": ("M106", "Its distance is known unusually precisely, from water masers orbiting the central black hole."),
    "NGC4472": ("M49", "The brightest galaxy in the Virgo Cluster."),
    "LMC":     ("Large Magellanic Cloud", "A satellite galaxy visible to the naked eye from the southern hemisphere."),
    "SMC":     ("Small Magellanic Cloud", "The LMC's smaller companion, being tidally torn apart."),
    "NGC3379": ("M105", "A classic elliptical, used as a reference for elliptical galaxy structure."),
    "NGC4038": ("Antennae Galaxies", "Two spirals mid-collision, flinging out long tidal tails of stars."),
    "NGC891":  ("Silver Sliver", "An edge-on spiral with dust filaments rising out of the disc."),
    "NGC7331": ("Deer Lick Galaxy", "A spiral often mistaken for a Milky Way twin, seen with a group of far more distant galaxies behind it."),
    "NGC2403": ("NGC 2403", "An outlying member of the M81 group, rich in star-forming regions."),
}

# Well-known cluster designations
CLUSTER_NAMES = {
    "A1656": ("Coma Cluster", "A rich cluster of over a thousand galaxies; the place dark matter was first inferred, by Zwicky in 1933."),
    "A3526": ("Centaurus Cluster", "The nearest large cluster after Virgo and Fornax."),
    "A1060": ("Hydra Cluster", "A compact nearby cluster dominated by two giant ellipticals."),
    "A2199": ("Abell 2199", "Centred on the giant elliptical NGC 6166."),
    "A3558": ("Shapley Supercluster core", "The densest concentration of galaxies in the nearby universe."),
    "A2147": ("Abell 2147", "Part of the Hercules Supercluster."),
    "A0496": ("Abell 496", "A relaxed, symmetric cluster often used to study intracluster gas."),
    "A2634": ("Abell 2634", "Host of the radio galaxy 3C 465."),
    "A3716": ("Abell 3716", "A rich southern cluster."),
    "Virgo":  ("Virgo Cluster", "The heart of our supercluster, about 16 Mpc away and pulling the Local Group toward it."),
    "Fornax": ("Fornax Cluster", "The second-richest cluster within 20 Mpc."),
    "UrsaMajor": ("Ursa Major Group", "A loose, spiral-rich group in our supercluster."),
}


# CF3 sometimes labels a famous galaxy with an unrelated catalogue number
# (M64 appears as UGC08062). PGC is the stable LEDA identifier, so these are
# matched by number instead of by name. Every entry here was confirmed present
# in cf3.tsv before being added.
PGC_TO_DESIG = {
    28655: "NGC3034",   # M82, listed as "M82"
    44182: "NGC4826",   # M64, listed as "UGC08062"
    46153: "NGC5055",   # M63, listed as "UGC08334"
    2789:  "NGC253",    # listed as "AGC020535"
}

def normalise(name):
    """NGC0224 -> NGC224, N4486 -> NGC4486, IC0010 -> IC10."""
    n = (name or "").strip().replace(" ", "")
    if not n:
        return ""
    for prefix, canon in (("NGC", "NGC"), ("N", "NGC"), ("IC", "IC"), ("I", "IC")):
        if n.upper().startswith(prefix):
            rest = n[len(prefix):]
            if rest.isdigit():
                return canon + str(int(rest))
    return n
