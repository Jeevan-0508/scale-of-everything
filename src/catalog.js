import * as THREE from 'three';

// Both binaries are packed as 5 little-endian float32 per record. Stars are
// x,y,z,mag,ci in parsecs; galaxies are sgx,sgy,sgz,dist,ksmag in megaparsecs.
const STRIDE = 5;

let starData = null;   // { pos: Float32Array, meta: object }
let galaxyData = null;

async function loadPack(binUrl, jsonUrl) {
  const [binRes, metaRes] = await Promise.all([fetch(binUrl), fetch(jsonUrl)]);
  if (!binRes.ok) throw new Error('could not load ' + binUrl + ' (' + binRes.status + ')');
  if (!metaRes.ok) throw new Error('could not load ' + jsonUrl + ' (' + metaRes.status + ')');
  const buf = await binRes.arrayBuffer();
  const meta = await metaRes.json();
  const pos = new Float32Array(buf);
  const count = pos.length / STRIDE;
  if (count !== meta.count) {
    // A mismatch means the binary and its metadata came from different builds,
    // which would silently mislabel every object. Better to fail loudly.
    throw new Error('pack mismatch for ' + binUrl + ': binary holds ' + count +
                    ' records, metadata declares ' + meta.count);
  }
  return { pos, meta, count };
}

export async function loadCatalogs(onProgress) {
  onProgress && onProgress(0.1, 'reading the star catalogue…');
  starData = await loadPack('data/stars.bin', 'data/stars.json');
  onProgress && onProgress(0.6, 'reading the galaxy catalogue…');
  galaxyData = await loadPack('data/galaxies.bin', 'data/galaxies.json');
  onProgress && onProgress(1, 'catalogues loaded');
  return { stars: starData, galaxies: galaxyData };
}

export function starMeta() { return starData && starData.meta; }
export function galaxyMeta() { return galaxyData && galaxyData.meta; }

// B-V colour index to RGB. Piecewise fit over the range real stars occupy:
// about -0.4 (hot blue O/B) through 2.0 (cool red M). Approximate but
// monotonic, which is what matters for reading temperature off a field.
export function bvToRgb(bv) {
  const t = Math.max(-0.4, Math.min(2.0, bv));
  let r, g, b;
  if (t < 0.0)      { r = 0.61 + 0.11 * t + 0.1 * t * t; g = 0.70 + 0.07 * t + 0.1 * t * t; b = 1.0; }
  else if (t < 0.4) { r = 0.83 + 0.17 * t; g = 0.87 + 0.11 * t; b = 1.0; }
  else if (t < 1.6) { r = 1.0;  g = 0.98 - 0.16 * (t - 0.4); b = 1.0 - 0.47 * (t - 0.4); }
  else              { r = 1.0;  g = 0.79 - 0.10 * (t - 1.6); b = 0.44 - 0.20 * (t - 1.6); }
  return [Math.min(1, r), Math.min(1, Math.max(0, g)), Math.min(1, Math.max(0, b))];
}

function discTexture(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d').createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.25)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  const ctx = c.getContext('2d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

let sprite = null;
function pointSprite() {
  if (!sprite) sprite = discTexture(64);
  return sprite;
}

// Brightness tiers exist so point size can vary without a custom shader:
// one PointsMaterial carries one size, so brightness becomes three draw calls
// instead of a vertex attribute. Three draw calls is cheaper than the risk.
const TIERS = [
  { name: 'bright', size: 7.0, opacity: 1.00 },
  { name: 'mid',    size: 3.6, opacity: 0.88 },
  { name: 'faint',  size: 1.9, opacity: 0.62 },
];

function tierFor(mag, cuts) {
  if (mag <= cuts[0]) return 0;
  if (mag <= cuts[1]) return 1;
  return 2;
}

/**
 * Build a point cloud of real stars within `radiusPc`, scaled so that radius
 * maps to `unitRadius` scene units. Returns a Group plus an index that maps
 * catalogue rows to scene positions, for search and camera fly-to.
 */
export function buildStars(radiusPc, unitRadius, opts) {
  if (!starData) throw new Error('star catalogue not loaded');
  const options = opts || {};
  const magCuts = options.magCuts || [3.0, 6.0];
  const scale = unitRadius / radiusPc;
  const { pos, count } = starData;

  const tiers = TIERS.map(() => ({ p: [], c: [] }));
  const rowToPos = new Map();

  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    const x = pos[o], y = pos[o + 1], z = pos[o + 2];
    const d = Math.sqrt(x * x + y * y + z * z);
    if (d > radiusPc) continue;
    const mag = pos[o + 3];
    const t = tiers[tierFor(mag, magCuts)];
    const sx = x * scale, sy = z * scale, sz = -y * scale; // catalogue z is "up"
    t.p.push(sx, sy, sz);
    const rgb = bvToRgb(pos[o + 4]);
    t.c.push(rgb[0], rgb[1], rgb[2]);
    rowToPos.set(i, [sx, sy, sz]);
  }

  const group = new THREE.Group();
  group.name = 'stars-' + radiusPc + 'pc';
  const materials = [];
  tiers.forEach((t, i) => {
    if (!t.p.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(t.p, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(t.c, 3));
    const mat = new THREE.PointsMaterial({
      size: TIERS[i].size,
      map: pointSprite(),
      vertexColors: true,
      transparent: true,
      opacity: TIERS[i].opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    materials.push({ mat, base: TIERS[i].opacity });
    group.add(new THREE.Points(geo, mat));
  });

  return {
    group, materials, rowToPos, scale,
    plotted: rowToPos.size,
    setOpacity(a) { materials.forEach((m) => { m.mat.opacity = m.base * a; }); },
  };
}

/**
 * Build a point cloud of real galaxies within `radiusMpc`. Colour runs from
 * warm (near) to cool (far) so depth is readable in a still image; galaxy
 * colour is not measured here, and the info panel says so.
 */
export function buildGalaxies(radiusMpc, unitRadius, opts) {
  if (!galaxyData) throw new Error('galaxy catalogue not loaded');
  const options = opts || {};
  const scale = unitRadius / radiusMpc;
  const { pos, count } = galaxyData;
  const pts = [], cols = [];
  const rowToPos = new Map();
  const near = new THREE.Color(0xffd9a8);
  const far = new THREE.Color(0x6f8ffb);
  const tmp = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const o = i * STRIDE;
    const d = pos[o + 3];
    if (d > radiusMpc) continue;
    const sx = pos[o] * scale, sy = pos[o + 2] * scale, sz = -pos[o + 1] * scale;
    pts.push(sx, sy, sz);
    tmp.copy(near).lerp(far, Math.min(1, d / radiusMpc));
    cols.push(tmp.r, tmp.g, tmp.b);
    rowToPos.set(i, [sx, sy, sz]);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const baseOpacity = options.opacity != null ? options.opacity : 0.92;
  const mat = new THREE.PointsMaterial({
    size: options.size || 4.2,
    map: pointSprite(),
    vertexColors: true,
    transparent: true,
    opacity: baseOpacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const group = new THREE.Group();
  group.name = 'galaxies-' + radiusMpc + 'mpc';
  group.add(new THREE.Points(geo, mat));

  return {
    group, rowToPos, scale,
    plotted: rowToPos.size,
    setOpacity(a) { mat.opacity = baseOpacity * a; },
  };
}
