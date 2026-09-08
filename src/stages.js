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
// A graticule of real parallels and meridians rather than a wireframe of the
// render mesh, which reads as scattered debris once there is a surface under it.
function graticule(R, stepDeg) {
  const pts = [];
  const seg = 128;
  for (let lat = -90 + stepDeg; lat < 90; lat += stepDeg) {
    const phi = (lat * Math.PI) / 180;
    const r = R * Math.cos(phi), y = R * Math.sin(phi);
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2, b = ((i + 1) / seg) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
      pts.push(new THREE.Vector3(Math.cos(b) * r, y, Math.sin(b) * r));
    }
  }
  for (let lon = 0; lon < 360; lon += stepDeg) {
    const th = (lon * Math.PI) / 180;
    for (let i = 0; i < seg; i++) {
      const a = -Math.PI / 2 + (i / seg) * Math.PI;
      const b = -Math.PI / 2 + ((i + 1) / seg) * Math.PI;
      pts.push(new THREE.Vector3(Math.cos(a) * Math.cos(th) * R, Math.sin(a) * R,
                                 Math.cos(a) * Math.sin(th) * R));
      pts.push(new THREE.Vector3(Math.cos(b) * Math.cos(th) * R, Math.sin(b) * R,
                                 Math.cos(b) * Math.sin(th) * R));
    }
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

// City lights belong only on the half the Sun is not lighting. Three's standard
// material applies emissive everywhere, so the night map is mixed in against the
// sun direction and faded across the terminator instead of glowing through
// daylight. Nothing is invented: the layer is real night imagery.
function addNightLights(material, nightTex, sunDir) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.nightMap = { value: nightTex };
    shader.uniforms.sunDir = { value: sunDir };
    // Both the normal and the UV are carried across in varyings of our own.
    // The stock vNormal is in view space, so it would drift with the camera,
    // and the stock UV varying has been renamed across three releases — vUv in
    // r151, vMapUv since r152 — so relying on either name is a trap.
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>',
        '#include <common>\nvarying vec3 soeWN;\nvarying vec2 soeUv;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nsoeWN = normalize(mat3(modelMatrix) * normal);\n' +
        'soeUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\nvarying vec3 soeWN;\nvarying vec2 soeUv;\n' +
        'uniform sampler2D nightMap;\nuniform vec3 sunDir;')
      .replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n' +
        'float soeLit = dot(normalize(soeWN), normalize(sunDir));\n' +
        'float soeNight = smoothstep(0.12, -0.18, soeLit);\n' +
        'totalEmissiveRadiance += texture2D(nightMap, soeUv).rgb * soeNight * 1.6;');
  };
  material.customProgramCacheKey = () => 'soe-night';
}

// tex is the Earth record from data/planets.json when it has loaded, so this
// rung wears the same measured surface as the planet one level out. Without it
// the shell still builds, just plain.
export function createEarth(unitRadius, tex) {
  const group = new THREE.Group();
  const R = unitRadius;

  const sunDir = new THREE.Vector3(3, 1.4, 2).normalize();
  const loader = new THREE.TextureLoader();
  const load = (src) => {
    const t = loader.load(src);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  // A mask carries data, not colour, so it must not go through sRGB decoding.
  const loadMask = (src) => {
    const t = loader.load(src);
    t.colorSpace = THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };

  const globeMat = tex
    ? new THREE.MeshStandardMaterial({
      map: load(tex.map.src), roughness: 0.82, metalness: 0.04,
      transparent: true, opacity: 1,
    })
    : new THREE.MeshStandardMaterial({
      color: 0x18406e, emissive: 0x081a33, emissiveIntensity: 0.9,
      roughness: 0.85, metalness: 0.1, transparent: true, opacity: 1,
    });
  if (tex && tex.layers && tex.layers.night) {
    addNightLights(globeMat, load(tex.layers.night.src), sunDir);
  }
  const spin = new THREE.Group();
  group.add(spin);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), globeMat);
  spin.add(globe);

  const mats = [globeMat];

  if (tex && tex.layers && tex.layers.clouds) {
    // The cloud composite ships as greyscale and is used as an alpha mask on
    // white, so the clouds are lit by the same Sun as the surface below them.
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, alphaMap: loadMask(tex.layers.clouds.src),
      transparent: true, opacity: 0.78,
      roughness: 1, metalness: 0, depthWrite: false,
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.006, 72, 48), cloudMat);
    spin.add(clouds);
    mats.push(cloudMat);
  }

  const grid = new THREE.LineSegments(
    graticule(R * 1.0015, 30),
    new THREE.LineBasicMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.13 })
  );
  spin.add(grid);
  mats.push(grid.material);

  // Karman line at 100 km, to scale against the 6,371 km radius.
  const air = new THREE.Mesh(
    new THREE.SphereGeometry(R * (1 + 100 / 6371), 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x64b7ff, transparent: true, opacity: 0.13,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  group.add(air);
  mats.push(air.material);

  // No decorative halo: an additive shell has a hard silhouette edge, which read
  // as a flat blue disc once a real surface sat inside it. The Karman line above
  // is the only atmosphere here, and it is to scale.

  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.copy(sunDir).multiplyScalar(R * 4);
  group.add(sun);

  return {
    group,
    update(t) { spin.rotation.y = t * 0.05; },
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

// Eternal inflation describes a foam of bubbles that nucleate, inflate and
// touch, so this shell is a foam: thin soap-film shells, nothing solid, no
// surface, no detail that could be mistaken for an image of anything. It keeps
// the hypothesis violet and ours is the one lit cyan. A film you can see
// straight through is still plainly not a photograph, but a bubble universe
// should at least look like a bubble.
const BUBBLE_VERT = [
  'varying vec3 vN;',
  'varying vec3 vV;',
  'void main() {',
  '  vec4 wp = modelMatrix * vec4(position, 1.0);',
  '  vN = normalize(mat3(modelMatrix) * normal);',
  '  vV = normalize(cameraPosition - wp.xyz);',
  '  gl_Position = projectionMatrix * viewMatrix * wp;',
  '}',
].join('\n');

// The rim term is Fresnel: a soap film is nearly invisible face on and bright
// at a grazing angle, which is what makes a bubble read as a bubble. The colour
// walk with incidence is thin-film interference, the reason a real bubble is
// iridescent.
const BUBBLE_FRAG = [
  'uniform vec3 uTint;',
  'uniform float uBase;',
  'uniform float uFade;',
  'uniform float uTime;',
  'uniform float uSeed;',
  'varying vec3 vN;',
  'varying vec3 vV;',
  'void main() {',
  '  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));',
  '  float rim = pow(f, 3.0);',
  '  float p = f * 6.2831 + uTime * 0.22 + uSeed;',
  '  vec3 film = 0.5 + 0.5 * cos(p + vec3(0.0, 2.094, 4.188));',
  '  vec3 col = mix(uTint, film, 0.4 * rim);',
  '  float a = (0.03 + rim * 0.9) * uBase * uFade;',
  '  gl_FragColor = vec4(col * (0.3 + rim), a);',
  '}',
].join('\n');

// Bubbles in a foam touch. A position is drawn until it lands in contact with a
// bubble already placed without being swallowed inside it, so the shell reads as
// a foam rather than as scattered marbles.
function foamPositions(R, radii) {
  const out = [new THREE.Vector3(0, 0, 0)];
  for (let i = 1; i < radii.length; i++) {
    let best = null;
    for (let attempt = 0; attempt < 240; attempt++) {
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const rr = R * (0.2 + Math.random() * 0.7);
      const sxz = Math.sqrt(1 - u * u);
      const cand = new THREE.Vector3(rr * sxz * Math.cos(phi), rr * u * 0.55,
                                     rr * sxz * Math.sin(phi));
      let touches = false, buried = false;
      for (let j = 0; j < out.length; j++) {
        const sum = radii[i] + radii[j];
        const d = cand.distanceTo(out[j]);
        if (d < sum) touches = true;
        if (d < sum * 0.5) buried = true;
      }
      if (buried) continue;
      if (touches) { best = cand; break; }
      if (!best) best = cand;
    }
    out.push(best || new THREE.Vector3(R * 0.5, 0, 0));
  }
  return out;
}

export function createMultiverse(unitRadius) {
  const group = new THREE.Group();
  const R = unitRadius;

  const N = 30;
  const radii = [];
  for (let i = 0; i < N; i++) {
    radii.push(R * (i === 0 ? 0.13 : 0.06 + Math.random() * 0.15));
  }
  const pos = foamPositions(R, radii);

  const bubbles = [];
  const films = [];
  for (let i = 0; i < N; i++) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: BUBBLE_VERT,
      fragmentShader: BUBBLE_FRAG,
      uniforms: {
        uTint: { value: new THREE.Color(i === 0 ? 0x7ef0ff : 0xa78bfa) },
        uBase: { value: i === 0 ? 1.0 : 0.42 + Math.random() * 0.34 },
        uFade: { value: 1 },
        uTime: { value: 0 },
        uSeed: { value: Math.random() * 6.2831 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(radii[i], 48, 32), mat);
    m.position.copy(pos[i]);
    m.userData = { kind: i === 0 ? 'our-universe' : 'bubble', index: i };
    group.add(m);
    films.push(mat);
    bubbles.push({ mesh: m, spin: (Math.random() - 0.5) * 0.06 });
  }

  return {
    group, bubbles,
    update(t, dt) {
      films.forEach((m) => { m.uniforms.uTime.value = t; });
      bubbles.forEach((b) => { b.mesh.rotation.y += dt * b.spin; });
    },
    // A ShaderMaterial ignores material.opacity, so the level crossfade drives
    // the film's own uniform instead of going through fadeable().
    setOpacity(a) { films.forEach((m) => { m.uniforms.uFade.value = a; }); },
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
