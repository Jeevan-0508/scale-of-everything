# Image credits

Every image in `assets/deepsky/` is real observational data released under a free
licence. None of them are renders. Each was downscaled to 760 px on its long edge,
converted to WebP, and given a soft elliptical fade in its alpha channel so it does
not read as a rectangle against the sky. Pixel values were not otherwise altered.

Regenerate with `python tools/build_deepsky.py`.

| Object | File | Licence | Credit | Source page |
|---|---|---|---|---|
| Carina Nebula | `NGC3372.webp` | CC BY 4.0 | ESO | [Commons](https://commons.wikimedia.org/wiki/File:Carina_Nebula_by_ESO.jpg) |
| Cat's Eye Nebula | `NGC6543.webp` | CC BY 4.0 | ESA/Hubble & NASA, Z. Tsvetanov | [Commons](https://commons.wikimedia.org/wiki/File:Looking_at_the_Cat%E2%80%99s_Eye_Nebula_with_Hubble_(potm2602b).jpg) |
| Crab Nebula | `M1.webp` | Public domain | NASA , ESA , J. Hester and A. Loll (Arizona State University) | [Commons](https://commons.wikimedia.org/wiki/File:Crab_Nebula.jpg) |
| Dumbbell Nebula | `M27.webp` | CC0 | Taavi Niittee | [Commons](https://commons.wikimedia.org/wiki/File:Dumbbell_Nebula_(Messier_27).png) |
| Helix Nebula | `NGC7293.webp` | Public domain | The HST data are from proposal 9700. Processed images may be obtained from the Helix MAST web site. The Hubble Helix Team includes M. Meixner, H.E. Bond, G. Chapman (STScI), Y.-H. Chu (U. Illinois, Ur | [Commons](https://commons.wikimedia.org/wiki/File:NGC7293_(2004).jpg) |
| Horsehead Nebula | `B33.webp` | CC0 | Gianni.lacroce | [Commons](https://commons.wikimedia.org/wiki/File:Ic434_Horsehead_Nebula_B33_Flame_Nebula_Ngc2024.jpg) |
| Lagoon Nebula | `M8.webp` | CC BY 4.0 | ESO/S. Guisard | [Commons](https://commons.wikimedia.org/wiki/File:Lagoon_Nebula_(ESO).jpg) |
| North America Nebula | `NGC7000.webp` | CC BY 4.0 | KPNO/NOIRLab/NSF/AURA/Adam Block | [Commons](https://commons.wikimedia.org/wiki/File:NGC_7000-_The_North_America_Nebula_and_the_Pelican_Nebula_(noao-n7000mosblock).jpg) |
| Omega Centauri | `NGC5139.webp` | CC BY 4.0 | ESO | [Commons](https://commons.wikimedia.org/wiki/File:Omega_Centauri_by_ESO.jpg) |
| Orion Nebula | `M42.webp` | Public domain | NASA, ESA, M. Robberto (Space Telescope Science Institute/ESA) and the Hubble Space Telescope Orion Treasury Project Team | [Commons](https://commons.wikimedia.org/wiki/File:Orion_Nebula_-_Hubble_2006_mosaic.jpg) |
| Pillars of Creation | `M16.webp` | Public domain | SCIENCE: NASA, ESA, CSA, STScI; IMAGE PROCESSING: Joseph DePasquale (STScI), Anton M. Koekemoer (STScI), Alyssa Pagan (STScI) | [Commons](https://commons.wikimedia.org/wiki/File:Pillars_of_Creation_(NIRCam_Image).jpg) |
| Pleiades | `M45.webp` | Public domain | NASA, ESA, AURA/Caltech, Palomar Observatory The science team consists of: D. Soderblom and E. Nelan (STScI), F. Benedict and B. Arthur (U. Texas), and B. Jones (Lick Obs.) | [Commons](https://commons.wikimedia.org/wiki/File:Pleiades_large.jpg) |
| Ring Nebula | `M57.webp` | Public domain | NASA, ESA, C.R. Robert O’Dell (Vanderbilt University), G.J. Ferland (University of Kentucky), W.J. Henney and M. Peimbert (National Autonomous University of Mexico) Credit for Large Binocular Telescop | [Commons](https://commons.wikimedia.org/wiki/File:Hubble_reveals_the_Ring_Nebula%E2%80%99s_true_shape.jpg) |
| Sombrero Galaxy | `M104.webp` | Public domain | NASA/ESA and The Hubble Heritage Team (STScI/AURA) | [Commons](https://commons.wikimedia.org/wiki/File:M104_ngc4594_sombrero_galaxy_hi-res.jpg) |
| Tarantula Nebula | `NGC2070.webp` | Public domain | NASA, ESA, CSA, STScI, Webb ERO Production Team | [Commons](https://commons.wikimedia.org/wiki/File:Tarantula_Nebula_by_JWST.jpg) |
| Trifid Nebula | `M20.webp` | CC BY 4.0 | International Gemini Observatory/Ingrid Braul, Southlands Elementary, Vancouver BC | [Commons](https://commons.wikimedia.org/wiki/File:Trifid_Nebula_(M20)_(gemini0207a).jpg) |
| Veil Nebula | `NGC6960.webp` | CC BY 4.0 | ESA/Hubble & NASA, Z. Levay | [Commons](https://commons.wikimedia.org/wiki/File:Return_to_the_Veil_Nebula.jpg) |
| Whirlpool Galaxy | `M51.webp` | Public domain | NASA and European Space Agency | [Commons](https://commons.wikimedia.org/wiki/File:Messier51_sRGB.jpg) |

## Positions and distances

Coordinates: SIMBAD `basic` table, ICRS J2000 (https://simbad.cds.unistra.fr/simbad/sim-tap).
Angular sizes: SIMBAD `galdim`, arcminutes, omitted where SIMBAD carries no value.
Distances, per object, with the method that produced each one:

| Object | Distance | Method | Reference |
|---|---|---|---|
| Pleiades | 443 ly | Gaia parallax of cluster members, 7.364 mas | Gaia DR3 via SIMBAD |
| Helix Nebula | 651 ly | Gaia parallax of the central star, 5.012 mas | Gaia DR3 via SIMBAD |
| Dumbbell Nebula | 1,269 ly | Gaia parallax of the central star, 2.570 mas | Gaia DR3 via SIMBAD |
| Orion Nebula | 1,344 ly | VLBA trigonometric parallax | Menten et al. 2007, A&A 474, 515 — 414 ± 7 pc |
| Horsehead Nebula | 1,375 ly | distance to the parent Orion B molecular cloud | Orion B cloud distance, about 420 pc |
| Veil Nebula | 2,400 ly | Gaia distances to stars bracketing the shell | Fesen et al. 2018, ApJ 855, 147 — 735 pc |
| Ring Nebula | 2,569 ly | Gaia parallax of the central star, 1.270 mas | Gaia DR3 via SIMBAD |
| North America Nebula | 2,600 ly | three-dimensional dust mapping | Zucker et al. 2020, A&A 633, A51 — about 795 pc |
| Lagoon Nebula | 4,100 ly | Gaia parallaxes of NGC 6530 members | Damiani et al. 2019, A&A 623, A25 — 1.25 kpc |
| Trifid Nebula | 4,129 ly | Gaia parallax of the ionising cluster, 0.790 mas | Gaia DR2 via SIMBAD |
| Cat's Eye Nebula | 4,455 ly | Gaia parallax of the central star, 0.732 mas | Gaia DR3 via SIMBAD |
| Pillars of Creation | 5,763 ly | Gaia parallax of the ionising cluster NGC 6611, 0.566 mas | Gaia DR2 via SIMBAD |
| Crab Nebula | 6,500 ly | supernova-remnant expansion distance | Trimble 1973, PASP 85, 579 — about 2 kpc |
| Carina Nebula | 8,583 ly | parallax of the ionising cluster Trumpler 16, 0.380 mas | Gaia via SIMBAD |
| Omega Centauri | 16,899 ly | Gaia parallax, 0.193 mas | Gaia DR3 via SIMBAD |
| Tarantula Nebula | 163,000 ly | distance to the Large Magellanic Cloud | Pietrzynski et al. 2019, Nature 567, 200 — 49.59 kpc |
| Whirlpool Galaxy | 24 Mly | Cosmicflows-3 measured distance to NGC 5195, 7.31 Mpc | Tully et al. 2016, AJ 152, 50 |
| Sombrero Galaxy | 37 Mly | Cosmicflows-3 measured distance, 11.27 Mpc | Tully et al. 2016, AJ 152, 50 — the catalogue this project already ships |
