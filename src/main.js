import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { LEVELS, EVIDENCE } from './levels.js';
import { loadCatalogs, buildStars, buildGalaxies, starMeta, galaxyMeta } from './catalog.js';
import {
  createBackdrop, createEarth, createSolarSystem, createMilkyWay,
  createMultiverse, createOmniverse, PLANETS,
} from './stages.js';

// Every shell is built to the same radius in scene units. That is the whole
// trick: the ladder spans 20 orders of magnitude in reality, but the renderer
// never sees a coordinate outside a few thousand units, so float32 precision
// is never stressed. Scale lives in the readout, not in the vertices.
const UNIT = 600;

const canvas = document.getElementById('scene');
const loadOverlay = document.getElementById('loadOverlay');
const loadFill = document.getElementById('loadFill');
const loadLabel = document.getElementById('loadLabel');
const ladderEl = document.getElementById('ladder');
const readoutName = document.getElementById('readoutName');
const readoutScale = document.getElementById('readoutScale');
const readoutEvidence = document.getElementById('readoutEvidence');
const zoomHint = document.getElementById('zoomHint');
const infoPanel = document.getElementById('infoPanel');
const infoKind = document.getElementById('infoKind');
const infoTitle = document.getElementById('infoTitle');
const infoBody = document.getElementById('infoBody');
const infoFacts = document.getElementById('infoFacts');
const infoSource = document.getElementById('infoSource');
const closeInfo = document.getElementById('closeInfo');
const searchInput = document.getElementById('searchInput');
const searchStatus = document.getElementById('searchStatus');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 1, 20000);
camera.position.set(0, UNIT * 0.55, UNIT * 1.75);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enableZoom = false;   // the wheel and pinch drive the scale ladder instead
controls.enablePan = false;     // frees the two-finger gesture for the ladder
controls.minDistance = UNIT * 0.4;
controls.maxDistance = UNIT * 4;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.22;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.55, 0.32);
composer.addPass(bloom);

scene.add(new THREE.AmbientLight(0x33507a, 0.5));

const backdrop = createBackdrop();
scene.add(backdrop.group);

// ------------------------------------------------------------ shell registry

// Each shell is built once, on first approach, then cached. Building all ten up
// front would stall the first paint for no benefit, since only two are ever
// visible at a time.
const shells = new Array(LEVELS.length).fill(null);

function buildShell(i) {
  const level = LEVELS[i];
  let built;
  switch (level.id) {
    case 'earth':          built = createEarth(UNIT * 0.5); break;
    case 'solar-system':   built = createSolarSystem(UNIT); break;
    case 'neighbourhood':  built = buildStars(25, UNIT, { magCuts: [4.0, 8.0] }); break;
    case 'orion-arm':      built = buildStars(1000, UNIT, { magCuts: [2.5, 5.5] }); break;
    case 'milky-way':      built = createMilkyWay(UNIT); break;
    case 'local-volume':   built = buildGalaxies(5, UNIT, { size: 6.4 }); break;
    case 'laniakea':       built = buildGalaxies(80, UNIT, { size: 4.6 }); break;
    case 'observable-universe': built = buildGalaxies(520, UNIT, { size: 3.2, opacity: 0.8 }); break;
    case 'multiverse':     built = createMultiverse(UNIT); break;
    case 'omniverse':      built = createOmniverse(UNIT); break;
    default: throw new Error('no builder for level ' + level.id);
  }
  built.group.visible = false;
  scene.add(built.group);
  shells[i] = built;
  return built;
}

function shellAt(i) {
  if (i < 0 || i >= LEVELS.length) return null;
  return shells[i] || buildShell(i);
}

// ------------------------------------------------------------- scale ladder

let pos = 0;        // continuous position on the ladder
let targetPos = 0;

LEVELS.forEach((level, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'rung ev-' + level.evidence;
  b.dataset.index = String(i);
  b.innerHTML = '<span class="rung-dot"></span><span class="rung-name">' + level.name + '</span>';
  b.addEventListener('click', () => { goTo(i); showLevelInfo(i); });
  ladderEl.appendChild(b);
});
const rungs = Array.from(ladderEl.children);

function goTo(i) {
  targetPos = Math.max(0, Math.min(LEVELS.length - 1, i));
  hideHint();
}

function hideHint() { zoomHint.classList.add('gone'); }

addEventListener('wheel', (e) => {
  // Trackpads emit many small deltas and mice a few large ones, so clamp the
  // per-event contribution rather than scaling it linearly.
  const step = Math.max(-1, Math.min(1, e.deltaY / 100)) * 0.28;
  targetPos = Math.max(0, Math.min(LEVELS.length - 1, targetPos + step));
  hideHint();
}, { passive: true });

// Touch has no wheel, so the pinch gesture drives the ladder instead. Ratio
// rather than pixel delta, so it behaves the same on any screen density.
const touches = new Map();
let pinchStart = 0, pinchFrom = 0;

function pinchSpan() {
  const [a, b] = [...touches.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2) { pinchStart = pinchSpan(); pinchFrom = targetPos; }
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size !== 2 || !pinchStart) return;
  // Spreading fingers means zooming in, which is descending the ladder.
  const zoom = Math.log2(pinchSpan() / pinchStart);
  targetPos = Math.max(0, Math.min(LEVELS.length - 1, pinchFrom - zoom * 2.2));
  hideHint();
});

function endTouch(e) {
  if (e.pointerType !== 'touch') return;
  touches.delete(e.pointerId);
  if (touches.size < 2) pinchStart = 0;
}
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);

if (matchMedia('(hover: none)').matches) {
  zoomHint.innerHTML = 'pinch to change scale \u2014 or tap the ladder, drag to look around';
}

addEventListener('keydown', (e) => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  if (e.key === 'ArrowUp' || e.key === 'PageUp') { goTo(Math.round(targetPos) - 1); showLevelInfo(Math.round(targetPos)); }
  if (e.key === 'ArrowDown' || e.key === 'PageDown') { goTo(Math.round(targetPos) + 1); showLevelInfo(Math.round(targetPos)); }
});

let lastNearest = -1;
function updateShells() {
  const nearest = Math.round(pos);
  for (let i = 0; i < LEVELS.length; i++) {
    const d = pos - i;
    const a = 1 - Math.abs(d);
    if (a <= 0.001) {
      if (shells[i]) shells[i].group.visible = false;
      continue;
    }
    const shell = shellAt(i);
    shell.group.visible = true;
    shell.setOpacity(Math.pow(a, 0.7));
    // Leaving a shell shrinks it toward a point, which is what zooming out of
    // it actually looks like. Approaching one has it swell into place.
    const s = d >= 0 ? 1 - d * 0.82 : 1 + (-d) * 0.55;
    shell.group.scale.setScalar(Math.max(0.02, s));
  }
  if (nearest !== lastNearest) {
    lastNearest = nearest;
    updateReadout(nearest);
    rungs.forEach((r, i) => r.classList.toggle('active', i === nearest));
  }
}

function updateReadout(i) {
  const level = LEVELS[i];
  const ev = EVIDENCE[level.evidence];
  readoutName.textContent = level.name;
  readoutScale.textContent = level.scaleLabel;
  readoutEvidence.querySelector('.pill').style.background = ev.color;
  readoutEvidence.querySelector('.pill-label').textContent = ev.label;
  readoutEvidence.querySelector('.pill-label').style.color = ev.color;
}

// ---------------------------------------------------------------- info panel

function setFacts(list) {
  infoFacts.innerHTML = '';
  (list || []).forEach((f) => {
    const li = document.createElement('li');
    li.textContent = f;
    infoFacts.appendChild(li);
  });
}

function showLevelInfo(i) {
  const level = LEVELS[i];
  const ev = EVIDENCE[level.evidence];
  infoKind.textContent = 'scale level ' + (i + 1) + ' of ' + LEVELS.length;
  infoTitle.textContent = level.name;
  const facts = (level.facts || []).slice();
  if (level.id === 'neighbourhood' || level.id === 'orion-arm') {
    const s = shells[i];
    if (s) facts.push(s.plotted.toLocaleString() + ' catalogued stars drawn at this level');
  }
  if (level.id === 'local-volume' || level.id === 'laniakea' || level.id === 'observable-universe') {
    const s = shells[i];
    if (s) facts.push(s.plotted.toLocaleString() + ' catalogued galaxies drawn at this level');
  }
  infoBody.innerHTML = '<span class="ev-tag ' + level.evidence + '">' + ev.label + '</span><br>' + level.summary;
  setFacts(facts);
  infoSource.innerHTML = '<strong>' + ev.blurb + '</strong><br>Source: ' + level.source;
  infoPanel.classList.remove('hidden');
}

function showPlanetInfo(p) {
  infoKind.textContent = 'Solar System';
  infoTitle.textContent = p.name;
  infoBody.innerHTML = '<span class="ev-tag measured">measured</span><br>' +
    'Orbits the Sun at ' + p.au + ' AU, completing one circuit every ' +
    p.days.toLocaleString() + ' days.';
  setFacts([
    'Semi-major axis ' + p.au + ' AU',
    'Equatorial radius ' + p.km.toLocaleString() + ' km',
    'Orbital period ' + p.days.toLocaleString() + ' days',
    'Light from the Sun arrives in ' + (p.au * 8.317).toFixed(1) + ' minutes',
  ]);
  infoSource.innerHTML = '<strong>Orbital radii on screen are compressed by a power law so Mercury stays visible beside Neptune. Every figure quoted above is the real one.</strong><br>Source: NASA planetary fact sheet';
  infoPanel.classList.remove('hidden');
}

function showStarInfo(s) {
  infoKind.textContent = 'Star';
  infoTitle.textContent = s.name;
  const bits = [
    'Distance ' + s.dist_ly.toLocaleString() + ' light years (' + s.dist_pc + ' pc)',
    'Apparent magnitude ' + s.mag,
  ];
  if (s.absmag != null) bits.push('Absolute magnitude ' + s.absmag);
  if (s.spect) bits.push('Spectral type ' + s.spect);
  if (s.lum_sun != null) bits.push('Luminosity ' + s.lum_sun.toLocaleString() + ' x the Sun');
  if (s.con) bits.push('Constellation ' + s.con);
  infoBody.innerHTML = '<span class="ev-tag measured">measured</span><br>' +
    'Plotted at its measured three-dimensional position, ' +
    s.dist_ly.toLocaleString() + ' light years from the Sun.';
  setFacts(bits);
  infoSource.innerHTML = 'Source: HYG v4.1 (Hipparcos, Yale Bright Star, Gliese), CC BY-SA 4.0';
  infoPanel.classList.remove('hidden');
}

function showGalaxyInfo(g) {
  infoKind.textContent = 'Galaxy';
  infoTitle.textContent = g.name;
  const bits = [
    'Distance ' + g.dist_mpc.toLocaleString() + ' Mpc (' + g.dist_mly.toLocaleString() + ' million light years)',
  ];
  if (g.morph) bits.push('Morphology ' + g.morph);
  if (g.messier) bits.push('Messier ' + g.messier);
  if (g.desig !== g.name) bits.push('Catalogue ' + g.desig);
  if (g.group) bits.push('Group ' + g.group);
  infoBody.innerHTML = '<span class="ev-tag measured">measured</span><br>' +
    (g.note || 'Plotted at its measured distance in supergalactic coordinates.');
  setFacts(bits);
  infoSource.innerHTML = 'Source: Cosmicflows-3, Tully et al. 2016, AJ 152, 50 (via CDS/VizieR)';
  infoPanel.classList.remove('hidden');
}

function showClusterInfo(c) {
  infoKind.textContent = 'Galaxy cluster';
  infoTitle.textContent = c.name;
  infoBody.innerHTML = '<span class="ev-tag measured">measured</span><br>' +
    (c.note || 'A gravitationally bound concentration of galaxies.');
  setFacts([
    'Distance ' + c.dist_mpc.toLocaleString() + ' Mpc (' + c.dist_mly.toLocaleString() + ' Mly)',
    c.members.toLocaleString() + ' member galaxies with measured distances',
    c.abell ? 'Abell catalogue ' + c.key : 'Designation ' + c.key,
  ]);
  infoSource.innerHTML = 'Source: Cosmicflows-3 group assignments, Tully et al. 2016';
  infoPanel.classList.remove('hidden');
}

closeInfo.addEventListener('click', () => infoPanel.classList.add('hidden'));

// -------------------------------------------------------------------- search

// One flat index over stars, galaxies and clusters, each carrying the ladder
// level it lives on so a hit can move the viewer to the right shell.
let searchIndex = [];

function levelForStarPc(pc) { return pc <= 25 ? 2 : 3; }
function levelForGalaxyMpc(mpc) { return mpc <= 5 ? 5 : mpc <= 80 ? 6 : 7; }

function buildSearchIndex() {
  const sm = starMeta(), gm = galaxyMeta();
  searchIndex = [];
  sm.named.forEach((s) => {
    searchIndex.push({
      kind: 'star', label: s.name, aliases: [s.name, s.bf || '', s.con || ''],
      level: levelForStarPc(s.dist_pc), row: s.i, payload: s,
      blurb: s.name + ' is a star ' + s.dist_ly + ' light years away, apparent magnitude ' + s.mag +
             (s.spect ? ', spectral type ' + s.spect : '') + '.',
    });
  });
  gm.named.forEach((g) => {
    searchIndex.push({
      kind: 'galaxy', label: g.name,
      aliases: [g.name, g.desig, g.messier || '', g.pgc ? 'PGC' + g.pgc : ''],
      level: levelForGalaxyMpc(g.dist_mpc), row: g.i, payload: g,
      blurb: g.name + ' is a ' + (g.morph || 'galaxy') + ' at ' + g.dist_mpc +
             ' Mpc (' + g.dist_mly + ' million light years).' + (g.note ? ' ' + g.note : ''),
    });
  });
  gm.clusters.forEach((c) => {
    searchIndex.push({
      kind: 'cluster', label: c.name, aliases: [c.name, c.key],
      level: levelForGalaxyMpc(c.dist_mpc), row: null, payload: c,
      blurb: c.name + ' is a galaxy cluster at ' + c.dist_mpc + ' Mpc with ' +
             c.members + ' member galaxies of measured distance.',
    });
  });
  LEVELS.forEach((l, i) => {
    searchIndex.push({
      kind: 'level', label: l.name, aliases: [l.name, l.id.replace(/-/g, ' ')],
      level: i, row: null, payload: l,
      blurb: l.name + ' (' + l.scaleLabel + ', ' + l.evidence + '): ' + l.summary,
    });
  });
}

function keywordSearch(q) {
  const query = q.trim().toLowerCase();
  if (!query) return null;
  const compact = query.replace(/[\s-]/g, '');
  let best = null, bestScore = 0;
  searchIndex.forEach((e) => {
    let score = 0;
    e.aliases.forEach((a) => {
      if (!a) return;
      const al = a.toLowerCase();
      const ac = al.replace(/[\s-]/g, '');
      if (ac === compact) score = Math.max(score, 100);
      else if (al.startsWith(query)) score = Math.max(score, 60);
      else if (al.includes(query)) score = Math.max(score, 35);
    });
    if (e.kind === 'level') score *= 0.8;
    if (score > bestScore) { bestScore = score; best = e; }
  });
  return bestScore > 0 ? best : null;
}

function focusEntry(entry) {
  goTo(entry.level);
  if (entry.kind === 'star') showStarInfo(entry.payload);
  else if (entry.kind === 'galaxy') showGalaxyInfo(entry.payload);
  else if (entry.kind === 'cluster') showClusterInfo(entry.payload);
  else showLevelInfo(entry.level);

  if (entry.row != null) {
    // The shell must exist before its row index can be resolved to a position.
    const shell = shellAt(entry.level);
    const p = shell.rowToPos && shell.rowToPos.get(entry.row);
    if (p) {
      pendingTarget = new THREE.Vector3(p[0], p[1], p[2]);
      controls.autoRotate = false;
    }
  }
}

let pendingTarget = null;

function runSearch(q) {
  if (!q.trim()) { searchStatus.classList.remove('show'); return; }
  const hit = keywordSearch(q);
  if (hit) {
    focusEntry(hit);
    searchStatus.textContent = 'found ' + hit.label + ' on level ' + (hit.level + 1) + ' — ' + LEVELS[hit.level].name;
  } else {
    searchStatus.textContent = 'nothing on the ladder matches that yet';
  }
  searchStatus.classList.add('show');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => searchStatus.classList.remove('show'), 4200);
}
let statusTimer;
let searchDebounce;
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { clearTimeout(searchDebounce); runSearch(searchInput.value); }
});
searchInput.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => runSearch(searchInput.value), 420);
});

// ---------------------------------------------------------------- picking

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;

addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
});

function pickables() {
  const i = Math.round(pos);
  const shell = shells[i];
  if (!shell) return [];
  if (shell.clickable) return shell.clickable;
  return [];
}

function pickHover() {
  const list = pickables();
  if (!list.length) {
    if (hovered) { hovered.scale.setScalar(1); hovered = null; canvas.style.cursor = 'default'; }
    return;
  }
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(list, false);
  const obj = hits.length ? hits[0].object : null;
  if (obj !== hovered) {
    if (hovered) hovered.scale.setScalar(1);
    hovered = obj;
    if (hovered) hovered.scale.setScalar(1.45);
    canvas.style.cursor = hovered ? 'pointer' : 'default';
  }
}

canvas.addEventListener('click', () => {
  if (!hovered) return;
  const d = hovered.userData;
  if (d.kind === 'planet') showPlanetInfo(d.planet);
});

// -------------------------------------------------------------------- boot

function setLoad(pct, label) {
  loadFill.style.width = pct + '%';
  if (label) loadLabel.textContent = label;
}

async function boot() {
  setLoad(12, 'reading the catalogues…');
  await loadCatalogs((frac, label) => setLoad(12 + frac * 55, label));

  setLoad(72, 'building the first shells…');
  shellAt(0); shellAt(1);

  setLoad(86, 'indexing everything with a name…');
  buildSearchIndex();

  updateReadout(0);
  rungs[0].classList.add('active');
  showLevelInfo(0);

  setLoad(100, 'ready');
  await new Promise((r) => setTimeout(r, 260));
  loadOverlay.classList.add('done');

  window.SOE = {
    scene, camera, controls, LEVELS, shells, searchIndex,
    starMeta: starMeta(), galaxyMeta: galaxyMeta(),
    goTo, runSearch, get pos() { return pos; }, get targetPos() { return targetPos; },
    shellAt,
  };

  // The embedding model is a progressive upgrade, not a dependency: keyword
  // search works from the first frame and is silently replaced if this lands.
  import('./semanticSearch.js').then((mod) => {
    mod.buildIndex(searchIndex, (frac) => {
      searchInput.placeholder = 'waking up the AI… ' + Math.round(frac * 100) + '%';
    }).then(() => {
      // The field is only ~210px wide on a phone, so the long form clips.
      searchInput.placeholder = innerWidth <= 760 ? 'Ask in plain words…' : 'Ask in plain words… (AI-powered)';
      semantic = mod;
    }).catch((err) => {
      searchInput.placeholder = 'Find a star, galaxy or cluster…';
      console.warn('semantic search unavailable, staying on keyword search:', err);
    });
  }).catch((err) => console.warn('semantic module failed to load:', err));
}

let semantic = null;

// Semantic search, when ready, replaces the keyword pass entirely.
const originalRunSearch = runSearch;
runSearch = function (q) {
  if (!semantic || !semantic.isReady()) return originalRunSearch(q);
  semantic.search(q).then((hit) => {
    if (hit && hit.entry) {
      focusEntry(hit.entry);
      searchStatus.textContent = 'matched by meaning: ' + hit.entry.label +
        ' (level ' + (hit.entry.level + 1) + ')';
      searchStatus.classList.add('show');
      clearTimeout(statusTimer);
      statusTimer = setTimeout(() => searchStatus.classList.remove('show'), 4200);
    } else {
      originalRunSearch(q);
    }
  }).catch(() => originalRunSearch(q));
};

boot().catch((err) => {
  setLoad(100, 'failed to start: ' + (err && err.message ? err.message : err));
  console.error('boot failed:', err);
});

// -------------------------------------------------------------- render loop

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
function animate() {
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  // Critically damped approach, so the ladder never overshoots into a shell
  // the viewer did not ask for.
  pos += (targetPos - pos) * Math.min(1, dt * 3.4);
  updateShells();

  backdrop.update(t);
  for (let i = 0; i < shells.length; i++) {
    const s = shells[i];
    if (s && s.group.visible && s.update) s.update(t, dt);
  }

  if (pendingTarget) {
    controls.target.lerp(pendingTarget, Math.min(1, dt * 2.6));
    if (controls.target.distanceTo(pendingTarget) < 0.6) pendingTarget = null;
  }

  pickHover();
  controls.update();
  composer.render();
  requestAnimationFrame(animate);
}
animate();

export { LEVELS, PLANETS };

// ------------------------------------------------- chat: grounded conversation

const chatToggle = document.getElementById('chatToggle');
const chatPanel = document.getElementById('chatPanel');
const chatClose = document.getElementById('chatClose');
const chatMessages = document.getElementById('chatMessages');
const chatStatus = document.getElementById('chatStatus');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatSend = document.getElementById('chatSend');

let chatState = 'idle';   // idle | loading | ready | unavailable | error
let chatMod = null;

function addMessage(role, text) {
  const el = document.createElement('div');
  el.className = 'chat-msg ' + role;
  el.textContent = text;
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return el;
}

// What the chat is allowed to treat as fact. Semantic search when it is ready,
// keyword otherwise, so grounding works even if the embedding model never loads.
async function groundingLookup(question) {
  if (semantic && semantic.isReady()) {
    const hit = await semantic.search(question, 0.2);
    if (hit && hit.entry) return hit.entry;
  }
  return keywordSearch(question);
}

async function ensureChat() {
  if (chatState === 'ready') return true;
  if (chatState === 'unavailable') return false;

  chatStatus.textContent = 'checking your GPU…';
  try {
    chatMod = await import('./chat.js');
  } catch (err) {
    chatState = 'error';
    chatStatus.textContent = '';
    addMessage('system', 'Could not load the chat module: ' + (err && err.message ? err.message : err));
    return false;
  }

  if (!(await chatMod.webgpuAvailable())) {
    chatState = 'unavailable';
    chatStatus.textContent = '';
    addMessage('system', 'This device cannot run the on-device model \u2014 it needs WebGPU with a usable GPU. Recent Chrome or Edge on a desktop works best. Everything else still works: the ladder, every catalogue and the search bar.');
    return false;
  }

  chatState = 'loading';
  chatStatus.textContent = 'downloading the model (about 2 GB, first visit only \u2014 cached afterwards)…';
  chatMod.attachSearch(groundingLookup);
  try {
    await chatMod.loadEngine((frac, text) => {
      chatStatus.textContent = text || ('loading the model… ' + Math.round(frac * 100) + '%');
    });
    chatState = 'ready';
    chatStatus.textContent = '';
    chatInput.disabled = false;
    chatSend.disabled = false;
    addMessage('system', 'Ready. Numbers in the answers come from the catalogues, not from the model.');
    return true;
  } catch (err) {
    chatState = 'error';
    chatStatus.textContent = '';
    addMessage('system', 'Could not load the model: ' + (err && err.message ? err.message : err));
    console.warn('chat engine failed:', err);
    return false;
  }
}

chatToggle.addEventListener('click', async () => {
  chatPanel.classList.remove('hidden');
  await ensureChat();
});
chatClose.addEventListener('click', () => chatPanel.classList.add('hidden'));

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = chatInput.value.trim();
  if (!q || chatState !== 'ready') return;
  chatInput.value = '';
  chatInput.disabled = true;
  chatSend.disabled = true;
  addMessage('user', q);
  const aiEl = addMessage('ai', '…');
  try {
    const res = await chatMod.ask(q, (partial) => {
      aiEl.textContent = partial || '…';
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
    aiEl.textContent = res.text || '(no response)';
    if (res.matched) {
      // Showing the grounding is not decoration: it lets the reader check
      // which catalogue row the numbers in that answer came from.
      const tag = document.createElement('div');
      tag.className = 'chat-msg data';
      tag.textContent = 'grounded in ' + res.matched.label + ' — ' + res.matched.kind +
        ', level ' + (res.matched.level + 1) + ' (' + LEVELS[res.matched.level].name + ')';
      chatMessages.appendChild(tag);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      focusEntry(res.matched);
    }
  } catch (err) {
    aiEl.textContent = 'Something went wrong generating that answer.';
    console.warn('generation failed:', err);
  } finally {
    chatInput.disabled = false;
    chatSend.disabled = false;
    chatInput.focus();
  }
});

window.SOE_CHAT = { ensureChat, state: () => chatState, groundingLookup };
