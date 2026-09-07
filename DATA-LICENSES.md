# Data provenance and licensing

The code in this repository is MIT licensed. The astronomical data is not — it
carries its own terms, listed here per file.

## `data/stars.bin`, `data/stars.json`

**HYG Stellar Database v4.1** — a merge of the Hipparcos catalogue, the Yale
Bright Star Catalogue (5th edition) and the Gliese Catalogue of Nearby Stars
(3rd edition).

- Source: <https://github.com/astronexus/HYG-Database>
- Compiled by: David Nash / astronexus
- Licence: **Creative Commons Attribution-ShareAlike 4.0 International**
  (<https://creativecommons.org/licenses/by-sa/4.0/>)
- Derived files in `data/` remain under CC BY-SA 4.0, as share-alike requires.

Positions are equatorial cartesian in parsecs, epoch and equinox J2000.

## `data/galaxies.bin`, `data/galaxies.json`

**Cosmicflows-3** — a compilation of galaxy distance measurements.

- Citation: Tully R.B., Courtois H.M., Sorce J.G. 2016, *AJ* **152**, 50
- Retrieved from: CDS/VizieR catalogue `J/AJ/152/50/table3`
  (<https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=J/AJ/152/50>)
- Terms: VizieR data is provided for scientific use with acknowledgement of the
  original authors and of the CDS. The citation above is that acknowledgement.

Positions are supergalactic cartesian in megaparsecs, converted from the
published `SGLON`, `SGLAT` and `Dist` columns.

## Planetary figures

Semi-major axes, equatorial radii and sidereal periods in `src/stages.js` are
NASA planetary fact sheet values.

## What is not data

The Milky Way, multiverse and omniverse levels contain no catalogued objects.
They are generated from published structural parameters or, in the last case,
from nothing at all. Each is labelled in the interface, and `src/levels.js`
records the distinction as a field rather than a comment.
