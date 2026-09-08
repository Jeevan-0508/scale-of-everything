/* Real deep-sky objects: nebulae, star clusters and two galaxies, drawn as the
 * photographs telescopes actually took of them and placed at their published
 * distances inside the shells this project already renders.
 *
 * Nothing here is a render. Every image is real observational data under a free
 * licence, and every distance carries the method and reference that produced it,
 * because a picture is the easiest place in an app like this to start lying.
 *
 * Two things are deliberately not to scale and are labelled as such in the UI:
 * the marker size (true angular size would put the Cat's Eye below one pixel)
 * and the soft edge fade baked into each image's alpha channel.
 */
import * as THREE from 'three';

let pack = null;

export async function loadDeepSky() {
  const res = await fetch('data/deepsky.json');
  if (!res.ok) throw new Error('could not load data/deepsky.json (' + res.status + ')');
  const p = await res.json();
  if (!Array.isArray(p.objects) || p.objects.length !== p.count) {
    throw new Error('deepsky pack mismatch: declares ' + p.count + ', holds ' +
                    (p.objects ? p.objects.length : 0));
  }
  pack = p;
  return pack;
}

export function deepSkyMeta() { return pack; }

export function deepSkyAt(levelIndex) {
  return pack ? pack.objects.filter((o) => o.level === levelIndex) : [];
}

export function deepSkyObjects() { return pack ? pack.objects : []; }

const loader = new THREE.TextureLoader();

// The star catalogue is equatorial cartesian in parsecs with z as "up", and the
// renderer maps that to (x, z, -y). RA/Dec has to land in the same frame or the
// nebulae would sit in a sky rotated away from the stars lighting them.
function equatorialToScene(o, unitRadius) {
  const d = o.dist_pc;
  const ra = (o.ra_deg * Math.PI) / 180;
  const dec = (o.dec_deg * Math.PI) / 180;
  const x = d * Math.cos(dec) * Math.cos(ra);
  const y = d * Math.cos(dec) * Math.sin(ra);
  const z = d * Math.sin(dec);
  const s = unitRadius / o.shell_radius_pc;
  return new THREE.Vector3(x * s, z * s, -y * s);
}

const BASE_FRACTION = 0.12;
const BASE_OPACITY = 0.94;

/**
 * Add the objects belonging to `levelIndex` into an already-built shell, folding
 * them into that shell's own fade and click list so the layer can never outlive
 * or out-fade the rung it belongs to.
 */
export function attachDeepSky(shell, levelIndex, unitRadius) {
  const list = deepSkyAt(levelIndex);
  if (!list.length) return null;

  const group = new THREE.Group();
  group.name = 'deepsky-' + levelIndex;
  const entries = [];

  list.forEach((o) => {
    let p;
    if (o.space === 'cf3') {
      // Anchored to a Cosmicflows-3 row the shell already plotted. If the shell
      // does not carry that row, skip it rather than invent a position.
      const r = shell.rowToPos && shell.rowToPos.get(o.cf3_row);
      if (!r) return;
      p = new THREE.Vector3(r[0], r[1], r[2]);
    } else {
      p = equatorialToScene(o, unitRadius);
    }

    const tex = loader.load(o.image);
    tex.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: BASE_OPACITY,
    });
    const sprite = new THREE.Sprite(material);
    const ar = o.image_w / o.image_h;
    const base = unitRadius * BASE_FRACTION * (o.space === 'cf3' ? 0.62 : 1);
    const w = ar >= 1 ? base : base * ar;
    const h = ar >= 1 ? base / ar : base;
    sprite.scale.set(w, h, 1);
    sprite.position.copy(p);
    sprite.userData = { kind: 'deepsky', obj: o, baseScale: sprite.scale.clone() };
    group.add(sprite);
    entries.push({ obj: o, sprite, material });
  });

  if (!entries.length) return null;
  shell.group.add(group);

  const inherited = shell.setOpacity.bind(shell);
  shell.setOpacity = (a) => {
    inherited(a);
    entries.forEach((e) => { e.material.opacity = BASE_OPACITY * a; });
  };
  shell.clickable = (shell.clickable || []).concat(entries.map((e) => e.sprite));
  shell.deepSky = entries;
  return { group, entries };
}

export function deepSkyFacts(o) {
  const bits = [];
  if (o.dist_ly >= 1e6) {
    bits.push('Distance ' + Math.round(o.dist_ly / 1e6).toLocaleString() +
              ' million light years (' + o.dist_pc.toLocaleString() + ' pc)');
  } else {
    bits.push('Distance ' + Math.round(o.dist_ly).toLocaleString() +
              ' light years (' + Math.round(o.dist_pc).toLocaleString() + ' pc)');
  }
  bits.push('Measured by ' + o.dist_method);
  if (o.ang_maj_arcmin != null) {
    const size = o.ang_maj_arcmin === o.ang_min_arcmin
      ? o.ang_maj_arcmin + "'"
      : o.ang_maj_arcmin + "' x " + o.ang_min_arcmin + "'";
    bits.push('Apparent size ' + size + ' of arc (' + o.ang_source + ')');
  }
  bits.push('Type ' + o.type);
  bits.push('Constellation ' + o.constellation);
  if (o.desig) bits.push('Also catalogued as ' + o.desig);
  return bits;
}
