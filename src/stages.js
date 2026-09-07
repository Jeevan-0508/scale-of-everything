import * as THREE from 'three';

// Procedurally built shells. Anything in this file is drawn from published
// structural parameters rather than from a catalogue of individual objects,
// which is exactly why levels.js marks them 'modelled' rather than 'measured'.

function fadeable(materials) {
  const bases = materials.map((m) => (m.opacity != null ? m.opacity : 1));
  return function setOpacity(a) {
    materials.forEach((m, i) => {
      m.transparent = true;
      m.opacity = bases[i] * a;
    });
  };
}

// ---------------------------------------------------------------- backdrop

export function createBackdrop() {
  const group = new THREE.Group();
  const N = 5200;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    // Uniform on a sphere: acos of a uniform variate, not a uniform angle,
    // or the poles end up denser than the equator.
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const r = 7000 + Math.random() * 900;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = r * s * Math.cos(phi);
    pos[i * 3 + 1] = r * u;
    pos[i * 3 + 2] = r * s * Math.sin(phi);
    const w = 0.55 + Math.random() * 0.45;
    col[i * 3] = w; col[i * 3 + 1] = w; col[i * 3 + 2] = w * (0.9 + Math.random() * 0.1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 11, vertexColors: true, transparent: true, opacity: 0.7,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  group.add(new THREE.Points(geo, mat));
  return { group, update(t) { group.rotation.y = t * 0.004; }, setOpacity: fadeable([mat]) };
}

// ------------------------------------------------------------------- earth

// No surface texture is used. Inventing coastlines would be the one piece of
// fabricated data in a project whose entire point is that its numbers check
// out, so this level shows a graticule and the atmosphere at true relative
// thickness instead: 100 km of Karman line against 6,371 km of radius.
export function createEarth(unitRadius) {
  const group = new THREE.Group();
  const R = unitRadius;

  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(R, 64, 48),
    new THREE.MeshStandardMaterial({
      color: 0x18406e, emissive: 0x081a33, emissiveIntensity: 0.9,
      roughness: 0.85, metalness: 0.1, transparent: true, opacity: 1,
    })
  );
  group.add(globe);

  const grid = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(R * 1.002, 24, 16)),
    new THREE.LineBasicMaterial({ color: 0x5fa8e0, transparent: true, opacity: 0.22 })
  );
  group.add(grid);

  // Karman line at 100 km, to scale against the 6,371 km radius.
  const air = new THREE.Mesh(
    new THREE.SphereGeometry(R * (1 + 100 / 6371), 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x64b7ff, transparent: true, opacity: 0.16,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  group.add(air);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.16, 40, 28),
    new THREE.MeshBasicMaterial({
      color: 0x3d86d6, transparent: true, opacity: 0.07,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  group.add(halo);

  const sun = new THREE.DirectionalLight(0xfff4e0, 2.1);
  sun.position.set(3, 1.4, 2).multiplyScalar(R);
  group.add(sun);

  const mats = [globe.material, grid.material, air.material, halo.material];
  return {
    group,
    update(t) { group.rotation.y = t * 0.05; },
    setOpacity: fadeable(mats),
  };
}

// ------------------------------------------------------- solar system

// Semi-major axis in AU, equatorial radius in km, sidereal period in days.
// NASA planetary fact sheet values.
export const PLANETS = [
  { name: 'Mercury', au: 0.387,  km: 2439.7, days: 87.97,    color: 0x9a8f86 },
  { name: 'Venus',   au: 0.723,  km: 6051.8, days: 224.70,   color: 0xe6cda3 },
  { name: 'Earth',   au: 1.000,  km: 6371.0, days: 365.26,   color: 0x4d82d8 },
  { name: 'Mars',    au: 1.524,  km: 3389.5, days: 686.98,   color: 0xc35a34 },
  { name: 'Jupiter', au: 5.203,  km: 69911,  days: 4332.59,  color: 0xd8b98c },
  { name: 'Saturn',  au: 9.537,  km: 58232,  days: 10759.22, color: 0xe3d4a6 },
  { name: 'Uranus',  au: 19.191, km: 25362,  days: 30685.4,  color: 0xa9dce3 },
  { name: 'Neptune', au: 30.070, km: 24622,  days: 60189.0,  color: 0x4a6fd4 },
];

// True orbital spacing would put Mercury inside one pixel while Neptune sits at
// the edge, so radius is compressed by a power law for display only. Every
// number quoted in the info panel is the real one.
const ORBIT_COMPRESS = 0.62;

export function createSolarSystem(unitRadius) {
  const group = new THREE.Group();
  const maxAu = PLANETS[PLANETS.length - 1].au;
  const rOf = (au) => unitRadius * Math.pow(au / maxAu, ORBIT_COMPRESS);

  const sunMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(unitRadius * 0.055, 4),
    new THREE.MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 1 })
  );
  group.add(sunMesh);
  group.add(new THREE.PointLight(0xfff0d0, 340, unitRadius * 4, 1.7));

  const glowMat = new THREE.SpriteMaterial({
    map: (function () {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,240,200,0.95)');
      g.addColorStop(0.3, 'rgba(255,200,120,0.35)');
      g.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    })(),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(unitRadius * 0.44);
  group.add(glow);

  const mats = [sunMesh.material, glowMat];
  const bodies = [];

  PLANETS.forEach((p, i) => {
    const orbitR = rOf(p.au);
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        new THREE.EllipseCurve(0, 0, orbitR, orbitR, 0, Math.PI * 2).getPoints(180)
          .map((v) => new THREE.Vector3(v.x, 0, v.y))
      ),
      new THREE.LineBasicMaterial({ color: 0x4a6a9c, transparent: true, opacity: 0.3 })
    );
    group.add(ring);
    mats.push(ring.material);

    // Planet radii span 2,440 km to 69,911 km. Drawn on a log scale so
    // Mercury stays visible next to Jupiter.
    const size = unitRadius * (0.011 + 0.019 * (Math.log10(p.km) - 3.3) / 1.6);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 24, 18),
      new THREE.MeshStandardMaterial({
        color: p.color, emissive: p.color, emissiveIntensity: 0.32,
        roughness: 0.7, metalness: 0.15, transparent: true, opacity: 1,
      })
    );
    mesh.userData = { kind: 'planet', planet: p, index: i };
    group.add(mesh);
    mats.push(mesh.material);
    bodies.push({ mesh, orbitR, phase: (i * 2.2) % (Math.PI * 2), days: p.days });

    if (p.name === 'Saturn') {
      const rings = new THREE.Mesh(
        new THREE.RingGeometry(size * 1.5, size * 2.3, 48),
        new THREE.MeshBasicMaterial({
          color: 0xd8c89a, transparent: true, opacity: 0.4,
          side: THREE.DoubleSide, depthWrite: false,
        })
      );
      rings.rotation.x = Math.PI / 2.3;
      mesh.add(rings);
      mats.push(rings.material);
    }
  });

  return {
    group, bodies,
    clickable: bodies.map((b) => b.mesh),
    update(t) {
      bodies.forEach((b) => {
        // Angular rate from the real period, then sped up so the inner
        // planets visibly move: Earth completes a lap every few seconds.
        const a = b.phase + (t * 40 * Math.PI * 2) / b.days;
        b.mesh.position.set(Math.cos(a) * b.orbitR, 0, Math.sin(a) * b.orbitR);
      });
      const s = 1 + Math.sin(t * 1.6) * 0.015;
      sunMesh.scale.setScalar(s);
    },
    setOpacity: fadeable(mats),
  };
}

// --------------------------------------------------------------- milky way

// Modelled, not catalogued. We sit inside the disc and dust blocks the far
// side, so no survey holds individually measured positions across it. The
// Sun marker at 8.2 kpc and the 26.8 kpc disc radius are measured; the
// individual points are a model of a barred spiral, not real stars.
export function createMilkyWay(unitRadius) {
  const group = new THREE.Group();
  const N = 46000;
  const ARMS = 4;
  const R = unitRadius;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const inner = new THREE.Color(0xffd9a0);
  const outer = new THREE.Color(0x7fb4ff);
  const tmp = new THREE.Color();

  for (let i = 0; i < N; i++) {
    const f = Math.pow(Math.random(), 0.62);
    const rad = f * R;
    const arm = i % ARMS;
    const spiral = (arm / ARMS) * Math.PI * 2 + f * 3.1;
    const scatter = (1 - f) * 0.55 + 0.12;
    const ang = spiral + (Math.random() - 0.5) * scatter;
    const bulge = Math.exp(-f * 3.4);
    const thickness = R * (0.012 + 0.055 * bulge);
    pos[i * 3] = Math.cos(ang) * rad + (Math.random() - 0.5) * R * 0.03;
    pos[i * 3 + 1] = (Math.random() - 0.5) * thickness * 2;
    pos[i * 3 + 2] = Math.sin(ang) * rad + (Math.random() - 0.5) * R * 0.03;
    tmp.copy(inner).lerp(outer, Math.min(1, f * 1.15));
    col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 3.1, vertexColors: true, transparent: true, opacity: 0.85,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const disc = new THREE.Points(geo, mat);
  group.add(disc);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.055, 28, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff0cf, transparent: true, opacity: 0.9 })
  );
  group.add(core);

  // The Sun sits about 8.2 kpc out of a 26.8 kpc disc radius.
  const sunR = R * (8.2 / 26.8);
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.009, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x7ef0ff, transparent: true, opacity: 1 })
  );
  marker.position.set(sunR, 0, 0);
  marker.userData = { kind: 'sun-marker' };
  group.add(marker);

  const sunRing = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(
      new THREE.EllipseCurve(0, 0, sunR, sunR, 0, Math.PI * 2).getPoints(160)
        .map((v) => new THREE.Vector3(v.x, 0, v.y))
    ),
    new THREE.LineBasicMaterial({ color: 0x7ef0ff, transparent: true, opacity: 0.22 })
  );
  group.add(sunRing);

  const mats = [mat, core.material, marker.material, sunRing.material];
  return {
    group,
    sunMarker: marker,
    update(t, dt) { disc.rotation.y += dt * 0.022; },
    setOpacity: fadeable(mats),
  };
}

// ------------------------------------------------- speculative shells

// Rendered deliberately unlike every measured level: wireframe, cool violet,
// nothing solid. A viewer should be able to tell at a glance that the ground
// has changed from observation to proposal.
export function createMultiverse(unitRadius) {
  const group = new THREE.Group();
  const mats = [];
  const R = unitRadius;

  const bubbles = [];
  for (let i = 0; i < 26; i++) {
    const r = R * (0.06 + Math.random() * 0.15);
    const geo = new THREE.IcosahedronGeometry(r, 2);
    const mat = new THREE.MeshBasicMaterial({
      color: i === 0 ? 0x7ef0ff : 0xa78bfa,
      wireframe: true, transparent: true,
      opacity: i === 0 ? 0.55 : 0.14 + Math.random() * 0.13,
    });
    const m = new THREE.Mesh(geo, mat);
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const rr = R * (0.25 + Math.random() * 0.72);
    const s = Math.sqrt(1 - u * u);
    if (i === 0) m.position.set(0, 0, 0);
    else m.position.set(rr * s * Math.cos(phi), rr * u * 0.5, rr * s * Math.sin(phi));
    m.userData = { kind: i === 0 ? 'our-universe' : 'bubble', index: i };
    group.add(m);
    mats.push(mat);
    bubbles.push({ mesh: m, spin: (Math.random() - 0.5) * 0.1 });
  }

  return {
    group, bubbles,
    update(t, dt) { bubbles.forEach((b) => { b.mesh.rotation.y += dt * b.spin; }); },
    setOpacity: fadeable(mats),
  };
}

// Not a physical claim. Drawn as a bounding box with nothing measurable
// inside it, because that is honestly what the term denotes.
export function createOmniverse(unitRadius) {
  const group = new THREE.Group();
  const R = unitRadius;
  const mats = [];

  const box = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(R * 1.5, R * 1.5, R * 1.5)),
    new THREE.LineDashedMaterial({
      color: 0xfb7185, transparent: true, opacity: 0.5,
      dashSize: R * 0.05, gapSize: R * 0.035,
    })
  );
  box.computeLineDistances();
  group.add(box);
  mats.push(box.material);

  for (let i = 0; i < 5; i++) {
    const r = R * (0.28 + i * 0.16);
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2).getPoints(120)
          .map((v) => new THREE.Vector3(v.x, 0, v.y))
      ),
      new THREE.LineBasicMaterial({ color: 0xfb7185, transparent: true, opacity: 0.1 })
    );
    ring.rotation.x = i * 0.4;
    ring.rotation.z = i * 0.27;
    group.add(ring);
    mats.push(ring.material);
  }

  return {
    group,
    update(t, dt) { group.rotation.y += dt * 0.05; },
    setOpacity: fadeable(mats),
  };
}
