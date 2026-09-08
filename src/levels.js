// The scale ladder. Each shell is rendered in its own coordinate space at a
// comfortable magnitude, because a single float32 scene cannot span 6371 km to
// 8.8e26 m — that is 20 orders of magnitude against ~7 significant digits.
//
// `logSpan` is log10 of the shell's real radius in metres. It drives the readout
// and the cross-fade thresholds; nothing in the renderer uses real metres.
//
// `evidence` is deliberately part of the data model, not a comment. Levels built
// from measured catalogues and levels built from models must not look alike.

export const EVIDENCE = {
  measured: {
    key: 'measured',
    label: 'measured',
    blurb: 'Positions come from published observational catalogues.',
    color: '#38bdf8',
  },
  modelled: {
    key: 'modelled',
    label: 'modelled',
    blurb: 'Structure is inferred, not individually observed. Shown to scale, not to catalogue.',
    color: '#fbbf24',
  },
  hypothesis: {
    key: 'hypothesis',
    label: 'hypothesis',
    blurb: 'A published but untested proposal. No observational confirmation exists.',
    color: '#a78bfa',
  },
  notScience: {
    key: 'notScience',
    label: 'not science',
    blurb: 'No scientific literature supports this as a physical structure.',
    color: '#fb7185',
  },
};

export const LEVELS = [
  {
    id: 'earth',
    name: 'Earth',
    scaleLabel: '6,371 km',
    logSpan: 6.8,
    evidence: 'measured',
    summary:
      'One rocky planet, 6,371 km in mean radius. Everything any human has ever touched is on or just above this surface.',
    facts: [
      'Mean radius 6,371 km',
      'Mass 5.972e24 kg',
      'Age 4.54 billion years',
    ],
    source: 'IAU / NASA planetary fact sheet',
  },
  {
    id: 'solar-system',
    name: 'Solar System',
    scaleLabel: '39 AU to Pluto',
    logSpan: 12.77,
    evidence: 'measured',
    summary:
      'Eight planets, the Moon and Pluto on measured orbits around one ordinary star, each wearing the surface a spacecraft mapped. Pluto sits 39 astronomical units out — about 5.9 billion km.',
    facts: [
      'Neptune orbits at 30.07 AU, Pluto at 39.48 AU',
      'Light takes 8 minutes 20 seconds to reach Earth from the Sun',
      'The Sun holds 99.86% of the system mass',
      'Venus and Uranus and Pluto all rotate backwards',
    ],
    source: 'NASA planetary fact sheets',
  },
  {
    id: 'neighbourhood',
    name: 'Stellar Neighbourhood',
    scaleLabel: '25 parsecs',
    logSpan: 17.9,
    evidence: 'measured',
    starRadiusPc: 25,
    summary:
      'Every star within 25 parsecs — 82 light years — at its measured three-dimensional position. Proxima Centauri is the nearest at 4.23 light years.',
    facts: [
      'Nearest star: Proxima Centauri, 4.23 ly',
      'Distances from Hipparcos parallax',
      'Positions are real, not decorative',
    ],
    source: 'HYG v4.1 (Hipparcos + Yale + Gliese)',
  },
  {
    id: 'orion-arm',
    name: 'Orion Arm',
    scaleLabel: '1,000 parsecs',
    logSpan: 19.5,
    evidence: 'measured',
    starRadiusPc: 1000,
    summary:
      'Our stretch of one spiral arm, out to 1,000 parsecs. This is roughly where parallax measurement stops being trustworthy, so it is also the edge of what we can honestly plot star by star.',
    facts: [
      'Deneb, at 433 pc, is near the far edge',
      'Beyond this, individual distances carry large errors',
      'The field looks spherical because the sample is magnitude-limited: we can see bright stars in every direction, so this is our detection horizon rather than the arm true shape',
    ],
    source: 'HYG v4.1',
  },
  {
    id: 'milky-way',
    name: 'Milky Way',
    scaleLabel: '26.8 kiloparsecs',
    logSpan: 21.0,
    evidence: 'modelled',
    summary:
      'We live inside this galaxy, which is precisely why it must be modelled. Dust blocks the far side of the disc, and no catalogue contains individually measured positions for stars across it. The real stars you just flew through occupy a region smaller than this dot.',
    facts: [
      'Disc radius about 26.8 kpc',
      'Contains 100-400 billion stars',
      'The Sun sits about 8.2 kpc from the centre',
      'Sagittarius A*: 4.3 million solar masses',
    ],
    source: 'Modelled from published structural parameters',
  },
  {
    id: 'local-volume',
    name: 'Local Volume',
    scaleLabel: '5 megaparsecs',
    logSpan: 23.2,
    evidence: 'measured',
    summary:
      'Our own Local Group plus its nearest neighbours, every one at a measured distance. Andromeda dominates the inner region and is approaching us at 110 km/s; it will merge with the Milky Way in roughly 4.5 billion years.',
    facts: [
      'Andromeda (M31): 0.77 Mpc',
      'Large Magellanic Cloud: 0.05 Mpc',
      'Triangulum (M33): 0.91 Mpc',
      'Centaurus A: 3.66 Mpc',
      'Southern Pinwheel (M83): 4.66 Mpc',
    ],
    source: 'Cosmicflows-3 individual distance measurements',
  },
  {
    id: 'laniakea',
    name: 'Laniakea Supercluster',
    scaleLabel: '80 megaparsecs',
    logSpan: 24.4,
    evidence: 'measured',
    summary:
      'A hundred thousand galaxies whose motions all converge on a single gravitational basin. Defined in 2014 by mapping measured galaxy velocities, not by drawing a boundary on the sky.',
    facts: [
      'Roughly 100,000 galaxies',
      'Diameter about 160 Mpc',
      'Flows converge toward the Great Attractor',
    ],
    source: 'Cosmicflows-3 (Tully et al. 2016, AJ 152, 50)',
  },
  {
    id: 'observable-universe',
    name: 'Observable Universe',
    scaleLabel: '14.3 gigaparsecs',
    logSpan: 26.9,
    evidence: 'modelled',
    summary:
      'The filaments and voids of the cosmic web, out to the limit of what light has had time to reach us from. Real survey data fills the near part; the outer shell is modelled, because no catalogue reaches the horizon.',
    facts: [
      'Comoving radius 14.3 Gpc (46.5 billion ly)',
      'Age of the universe 13.79 billion years',
      'An estimated 2 trillion galaxies',
    ],
    source: 'Cosmicflows-3 near field, modelled beyond survey depth',
  },
  {
    id: 'multiverse',
    name: 'Multiverse',
    scaleLabel: 'beyond measurement',
    logSpan: 28.5,
    evidence: 'hypothesis',
    summary:
      'Several distinct proposals share this name. Tegmark grouped them into four levels: regions beyond our horizon, other bubbles in eternal inflation, the many-worlds reading of quantum mechanics, and the claim that all consistent mathematics is physically real. None has been observationally confirmed.',
    facts: [
      'Level I: beyond our cosmic horizon',
      'Level II: other inflationary bubbles',
      'Level III: many-worlds quantum branches',
      'Level IV: all mathematical structures',
    ],
    source: 'Tegmark 2003, Scientific American — a hypothesis, not a measurement',
  },
  {
    id: 'omniverse',
    name: 'Omniverse',
    scaleLabel: 'undefined',
    logSpan: 30.0,
    evidence: 'notScience',
    summary:
      'This one is honest fiction. "Omniverse" comes from comics and fan writing, not from physics — there is no scientific literature that treats it as a physical structure, and no definition precise enough to test. It is on this ladder because you asked where the ladder ends, and the truthful answer is that it ends before this.',
    facts: [
      'No peer-reviewed physical definition exists',
      'Originates in comics and fan taxonomy',
      'Included as the boundary of the map, not as a claim',
    ],
    source: 'None. Labelled so it cannot be mistaken for the levels below it.',
  },
];

export const LEVEL_BY_ID = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

export function levelAt(index) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, Math.round(index)))];
}
