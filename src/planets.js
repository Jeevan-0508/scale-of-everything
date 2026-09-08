/* The Solar System rung, built from real imagery instead of coloured spheres.
 *
 * Each body wears the equirectangular map that spacecraft mosaics were
 * reprojected into, spins about a tilted axis at its real sidereal rate, and
 * carries a single photograph of itself beside the numbers in the panel.
 *
 * Three things are compressed for display and are labelled as such wherever
 * they appear: orbital radii, body radii, and the clock. Compression preserves
 * ratios, so Venus really does barely turn and Jupiter really does turn fastest.
 * Nothing numeric in the panel is compressed.
 *
 * The maps are mosaics assembled into a projection, not single frames. That is
 * a weaker evidence claim than the deep-sky photographs and the UI says so
 * rather than letting the two blur together.
 */
import * as THREE from 'three';

let pack = null;

export async function loadPlanets() {
  const res = await fetch('data/planets.json');
  if (!res.ok) throw new Error('could not load data/planets.json (' + res.status + ')');
  const p = await res.json();
  if (!Array.isArray(p.bodies) || p.bodies.length !== p.count) {
    throw new Error('planet pack mismatch: declares ' + p.count + ', holds ' +
                    (p.bodies ? p.bodies.length : 0));
  }
  pack = p;
  return pack;
}

export function planetMeta() { return pack; }
export function planetBodies() { return pack ? pack.bodies : []; }
export function planetById(id) { return planetBodies().find((b) => b.id === id) || null; }

const loader = new THREE.TextureLoader();

function surface(src) {
  const t = loader.load(src);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// True orbital spacing would put Mercury inside one pixel while Pluto sits at
// the edge, so radius is compressed by a power law for display only.
const ORBIT_COMPRESS = 0.62;

// Body radii span 1,188 km (Pluto) to 69,911 km (Jupiter). Drawn on a log
// scale so Pluto stays visible next to Jupiter.
const R_MIN_LOG = 3.07, R_LOG_SPAN = 1.78;
function drawnRadius(unitRadius, km) {
  return unitRadius * (0.008 + 0.022 * (Math.log10(km) - R_MIN_LOG) / R_LOG_SPAN);
}

// Orbits are sped up so the inner planets visibly move; spin gets its own,
// slower clock because at the orbital rate Earth would turn forty times a
// second. Both factors are uniform, so every ratio between bodies is real.
const ORBIT_SPEED = 40;
const SPIN_SECONDS_PER_HOUR = 0.167;

// The Moon really sits sixty Earth radii out. At the drawn radii that would
// throw it clear of the orbit line, so the separation is compressed too.
const MOON_OFFSET_RADII = 2.6;

export function createSolarSystem(unitRadius) {
  const group = new THREE.Group();
  const bodies = planetBodies();
  const sunRec = bodies.find((b) => b.id === 'sun');
  const orbiting = bodies.filter((b) => b.au != null);
  const moonRec = bodies.find((b) => b.id === 'moon');
  const maxAu = Math.max(...orbiting.map((b) => b.au));
  const rOf = (au) => unitRadius * Math.pow(au / maxAu, ORBIT_COMPRESS);

  const mats = [];
  const spinners = [];
  const orbits = [];
  const clickable = [];

  function makeBody(rec, radius) {
    // node: moves along the orbit, never tilted, so anything hung off it keeps
    // its own orbital plane. tilt: carries the axial tilt. mesh: spins.
    const node = new THREE.Group();
    const tilt = new THREE.Group();
    node.add(tilt);
    tilt.rotation.z = (rec.tilt_deg * Math.PI) / 180;
    const isSun = rec.id === 'sun';
    const tex = surface(rec.map.src);
    const mat = isSun
      ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 1 })
      : new THREE.MeshStandardMaterial({
        map: tex, roughness: 0.9, metalness: 0,
        // The night side would otherwise be unreadable at Neptune's distance
        // from the single light. This is a lighting choice, not extra data.
        emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.3,
        transparent: true, opacity: 1,
      });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat);
    mesh.userData = { kind: 'planet', body: rec };
    tilt.add(mesh);
    mats.push(mat);
    spinners.push({ mesh, hours: rec.rot_hours });
    clickable.push(mesh);
    return { node, tilt, mesh, radius };
  }

  const sun = makeBody(sunRec, unitRadius * 0.055);
  group.add(sun.node);
  group.add(new THREE.PointLight(0xfff0d0, 340, unitRadius * 4, 1.7));

  const glowMat = new THREE.SpriteMaterial({
    map: (function () {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, 'rgba(255,240,200,0.55)');
      g.addColorStop(0.34, 'rgba(255,200,120,0.22)');
      g.addColorStop(1, 'rgba(255,170,80,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    })(),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(unitRadius * 0.15);
  group.add(glow);
  mats.push(glowMat);

  orbiting.forEach((rec, i) => {
    const orbitR = rOf(rec.au);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        new THREE.EllipseCurve(0, 0, orbitR, orbitR, 0, Math.PI * 2).getPoints(180)
          .map((v) => new THREE.Vector3(v.x, 0, v.y))
      ),
      new THREE.LineBasicMaterial({
        color: rec.kind === 'planet' ? 0x4a6a9c : 0x6b5f8c,
        transparent: true, opacity: 0.3,
      })
    );
    group.add(line);
    mats.push(line.material);

    const b = makeBody(rec, drawnRadius(unitRadius, rec.radius_km));
    group.add(b.node);
    orbits.push({ node: b.node, orbitR, phase: (i * 2.2) % (Math.PI * 2), days: rec.orbit_days });

    if (rec.rings) attachRings(b, rec.rings);
    if (rec.id === 'earth' && moonRec) attachMoon(b, moonRec);
  });

  // Real ring geometry: the inner and outer edges sit at their measured multiples
  // of Saturn's radius, and the Cassini Division is a gap in the texture's alpha
  // channel rather than a drawn line.
  function attachRings(host, rings) {
    const inner = host.radius * rings.inner_radii;
    const outer = host.radius * rings.outer_radii;
    const geo = new THREE.RingGeometry(inner, outer, 160, 1);
    // RingGeometry maps UVs planar, which would smear the strip across the ring.
    // Remap so u runs radially, inner edge to outer edge.
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - inner) / (outer - inner), 0.5);
    }
    uv.needsUpdate = true;
    const tex = loader.load(rings.src);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity: 1,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    // On the tilt node, not the planet: the rings share Saturn's axis but not
    // its spin, because they orbit at their own rates.
    host.tilt.add(mesh);
    mats.push(mat);
  }

  function attachMoon(host, rec) {
    const m = makeBody(rec, drawnRadius(unitRadius, rec.radius_km));
    const pivot = new THREE.Group();
    pivot.add(m.node);
    m.node.position.x = host.radius * MOON_OFFSET_RADII;
    // Hung off the planet's orbit node rather than the tilted planet, so it
    // travels with Earth without inheriting Earth's 23.4 degree tilt.
    host.node.add(pivot);
    orbits.push({ node: pivot, spinOnly: true, days: rec.orbit_days,
                  phase: 1.1, orbitR: 0 });
  }

  return {
    group, bodies: orbits, clickable,
    update(t) {
      orbits.forEach((o) => {
        const a = o.phase + (t * ORBIT_SPEED * Math.PI * 2) / o.days;
        if (o.spinOnly) o.node.rotation.y = a;
        else o.node.position.set(Math.cos(a) * o.orbitR, 0, Math.sin(a) * o.orbitR);
      });
      spinners.forEach((s) => {
        s.mesh.rotation.y = (t * Math.PI * 2) / (s.hours * SPIN_SECONDS_PER_HOUR);
      });
      const s = 1 + Math.sin(t * 1.6) * 0.015;
      sun.mesh.scale.setScalar(s);
    },
    setOpacity: (function (materials) {
      const bases = materials.map((m) => (m.opacity != null ? m.opacity : 1));
      return function (a) {
        materials.forEach((m, i) => { m.transparent = true; m.opacity = bases[i] * a; });
      };
    })(mats),
  };
}

export function planetFacts(b) {
  const f = [];
  if (b.au != null) f.push('Semi-major axis ' + b.au + ' AU');
  if (b.orbit_km_from_earth) {
    f.push('Mean distance from Earth ' + b.orbit_km_from_earth.toLocaleString() + ' km');
  }
  f.push('Equatorial radius ' + b.radius_km.toLocaleString() + ' km');
  if (b.orbit_days != null) {
    f.push('Orbital period ' + b.orbit_days.toLocaleString() + ' days');
  }
  const h = Math.abs(b.rot_hours);
  f.push('Sidereal rotation ' + h.toLocaleString() + ' hours' +
         (b.rot_hours < 0 ? ' (retrograde)' : ''));
  f.push('Axial tilt ' + b.tilt_deg + ' degrees');
  if (b.rings) {
    f.push('Rings from ' + b.rings.inner_km.toLocaleString() + ' to ' +
           b.rings.outer_km.toLocaleString() + ' km from centre');
  }
  if (b.au != null) {
    f.push('Light from the Sun arrives in ' + (b.au * 8.317).toFixed(1) + ' minutes');
  }
  return f;
}
