/* Cinematic + scientific observatory layer.
   Additive only: observes the existing UI/boot API and never replaces the
   renderer, catalogue, ladder, search, or chat engine. */
import { LEVELS, EVIDENCE } from './levels.js';

const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function el(tag, id, className, html = '') {
  const node = document.createElement(tag);
  if (id) node.id = id;
  if (className) node.className = className;
  node.innerHTML = html;
  return node;
}

function installCinematic() {
  if (document.getElementById('cinematicIntro')) return;
  const intro = el('div', 'cinematicIntro', '', `
    <div class="ci-core">
      <div class="ci-kicker">An interactive map of scale</div>
      <h1 class="ci-title">Scale of <em>Everything</em></h1>
      <p class="ci-sub">From the place beneath your feet to structures beyond direct measurement. Every boundary is labelled by what we actually know.</p>
      <div class="ci-scale"><span class="ci-from">1.7 m</span><span class="ci-arrow">→</span><span class="ci-to">the edge of the map</span></div>
      <div class="ci-enter">Scroll to begin · drag to look around</div>
    </div>`);
  const spine = el('div', 'scaleSpine');
  spine.appendChild(el('div', 'scaleSpineFill'));
  const order = el('div', 'scaleOrder');
  const readout = document.getElementById('readout');
  if (readout) readout.appendChild(order);
  const legend = el('div', 'evidenceLegend', '', `
    <div class="el-item el-measured"><span class="el-dot"></span>Measured</div>
    <div class="el-item el-modelled"><span class="el-dot"></span>Modelled</div>
    <div class="el-item el-hypothesis"><span class="el-dot"></span>Hypothesis</div>
    <div class="el-item el-notScience"><span class="el-dot"></span>Not science</div>`);
  const landmark = el('div', 'landmarkCard', '', '<div class="lc-eyebrow">Now entering</div><div class="lc-text"></div>');
  const flash = el('div', 'scaleFlash', '', '<div class="sf-inner"><div class="sf-kicker">Changing scale</div><div class="sf-power"></div></div>');
  const here = el('div', 'youAreHere', '', '<span class="yah-label">You are here</span>');
  document.body.append(intro, spine, legend, landmark, flash, here);

  const rungs = [...document.querySelectorAll('#ladder .rung')];
  const fill = document.getElementById('scaleSpineFill');
  const flashPower = flash.querySelector('.sf-power');
  const landmarkText = landmark.querySelector('.lc-text');
  let last = -1;
  let landmarkTimer = 0;
  const dismissIntro = () => intro.classList.add('dismissed');
  if (prefersReduced) intro.classList.add('dismissed');
  else {
    setTimeout(dismissIntro, 4300);
    ['wheel', 'pointerdown', 'keydown', 'touchstart'].forEach((event) => addEventListener(event, dismissIntro, { once: true, passive: true }));
  }
  function currentIndex() {
    const active = document.querySelector('#ladder .rung.active');
    return active ? Number(active.dataset.index) : 0;
  }
  function showTransition(i) {
    if (prefersReduced || i === last) return;
    flashPower.textContent = LEVELS[i]?.scaleLabel || '';
    flash.classList.remove('fire'); void flash.offsetWidth; flash.classList.add('fire');
    clearTimeout(landmarkTimer);
    landmarkText.textContent = LEVELS[i]?.summary?.split('. ')[0] || '';
    landmark.classList.add('show');
    landmarkTimer = setTimeout(() => landmark.classList.remove('show'), 2600);
  }
  function sync() {
    const i = currentIndex();
    const level = LEVELS[i];
    if (!level) return;
    const fraction = LEVELS.length <= 1 ? 0 : i / (LEVELS.length - 1);
    if (fill) fill.style.height = `${fraction * 100}%`;
    document.body.dataset.evidence = level.evidence;
    document.body.dataset.scaleId = level.id;
    order.textContent = `level ${i + 1} / ${LEVELS.length} · 10^${level.logSpan.toFixed(1)} m`;
    if (i !== last) {
      showTransition(i);
      if (readout) { readout.classList.remove('evolving'); void readout.offsetWidth; readout.classList.add('evolving'); }
      last = i;
    }
  }
  const observer = new MutationObserver(sync);
  rungs.forEach((rung) => observer.observe(rung, { attributes: true, attributeFilter: ['class'] }));
  sync();
  const searchStatus = document.getElementById('searchStatus');
  if (searchStatus) {
    const statusObserver = new MutationObserver(() => {
      if (!searchStatus.classList.contains('show')) return;
      searchStatus.animate([{ transform: 'translateX(-50%) translateY(-5px)' }, { transform: 'translateX(-50%) translateY(0)' }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
    statusObserver.observe(searchStatus, { attributes: true, attributeFilter: ['class'] });
  }
  setInterval(() => { const i = currentIndex(); if (i !== last) sync(); }, 500);
}

function formatNumber(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 3 });
}

function scientificScale(level) {
  const metres = Math.pow(10, level.logSpan);
  if (level.evidence === 'notScience') return 'undefined — no physical scale exists';
  if (level.evidence === 'hypothesis') return 'not physically measurable';
  if (metres >= 9.461e15) return `${formatNumber(metres / 9.461e15)} ly radius`;
  if (metres >= 1.496e11) return `${formatNumber(metres / 1.496e11)} AU radius`;
  if (metres >= 1000) return `${formatNumber(metres / 1000)} km radius`;
  return `${formatNumber(metres)} m radius`;
}

function lightCrossing(level) {
  if (level.evidence === 'notScience' || level.evidence === 'hypothesis') return 'not defined';
  const seconds = Math.pow(10, level.logSpan) / 299792458;
  if (seconds < 1) return `${(seconds * 1000).toFixed(1)} ms`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} h`;
  if (seconds < 31557600) return `${(seconds / 86400).toFixed(1)} days`;
  return `${(seconds / 31557600).toFixed(1)} years`;
}

function countForLevel(level, index, soe) {
  if (index === 0) return '1 planet';
  if (index === 1) return '8 planets + the Sun';
  if (index === 2 || index === 3) {
    const radius = level.starRadiusPc;
    const meta = soe?.starMeta;
    return meta?.ranges?.[String(radius)] ? `${formatNumber(meta.ranges[String(radius)])} catalogue stars in range` : 'stellar catalogue';
  }
  if (index >= 5 && index <= 7) {
    const radius = index === 5 ? 5 : index === 6 ? 80 : 520;
    const meta = soe?.galaxyMeta;
    return meta?.ranges?.[String(radius)] ? `${formatNumber(meta.ranges[String(radius)])} catalogue galaxies in range` : 'galaxy catalogue';
  }
  if (index === 4) return 'one modelled Milky Way';
  if (index === 8) return 'multiple theoretical domains';
  return 'no scientific object count';
}

function installObservatory() {
  if (document.getElementById('observatoryToggle')) return;
  const toggle = el('button', 'observatoryToggle', 'obs-toggle', '✦ <span>Deep Dive</span>');
  toggle.type = 'button';
  toggle.title = 'Open the scientific observatory';
  document.body.appendChild(toggle);
  const panel = el('aside', 'observatory', 'observatory-panel', `
    <div class="obs-topline"><span class="obs-kicker">COSMIC OBSERVATORY</span><button id="obsClose" class="obs-close" type="button">×</button></div>
    <div class="obs-heading"><div id="obsKind">SCALE LEVEL</div><h2 id="obsTitle">Earth</h2><div id="obsSubtitle"></div></div>
    <div class="obs-tabs" role="tablist">
      <button class="obs-tab active" data-tab="overview">Overview</button>
      <button class="obs-tab" data-tab="physics">Physics</button>
      <button class="obs-tab" data-tab="evidence">Evidence</button>
      <button class="obs-tab" data-tab="objects">Objects</button>
    </div>
    <div id="obsContent" class="obs-content"></div>
    <div class="obs-footer"><span>DATA-GROUNDED VIEW</span><span>LIVE</span></div>
  `);
  document.body.appendChild(panel);
  const content = panel.querySelector('#obsContent');
  const title = panel.querySelector('#obsTitle');
  const subtitle = panel.querySelector('#obsSubtitle');
  const kind = panel.querySelector('#obsKind');
  let activeTab = 'overview';
  let selectedEntry = null;

  function getIndex() {
    const rung = document.querySelector('#ladder .rung.active');
    return rung ? Number(rung.dataset.index) : 0;
  }
  function getSOE() { return window.SOE || null; }
  function objectEntries(index) {
    const soe = getSOE();
    if (!soe?.searchIndex) return [];
    return soe.searchIndex.filter((e) => e.level === index && e.kind !== 'level');
  }
  function renderOverview(index) {
    const level = LEVELS[index];
    const soe = getSOE();
    const ev = EVIDENCE[level.evidence];
    const rendered = soe?.shells?.[index]?.plotted;
    content.innerHTML = `
      <div class="obs-hero-stat"><span>REAL SCALE</span><strong>${level.scaleLabel}</strong><small>${scientificScale(level)}</small></div>
      <div class="obs-grid">
        <div class="obs-card"><span>WHAT THIS IS</span><b>${countForLevel(level, index, soe)}</b></div>
        <div class="obs-card"><span>LIGHT ACROSS RADIUS</span><b>${lightCrossing(level)}</b></div>
        ${rendered != null ? `<div class="obs-card"><span>RENDERED NOW</span><b>${formatNumber(rendered)}</b></div>` : ''}
        <div class="obs-card"><span>EVIDENCE</span><b class="${level.evidence}">${ev.label}</b></div>
      </div>
      <div class="obs-section"><label>THE SCIENTIFIC STORY</label><p>${level.summary}</p></div>
      <div class="obs-section"><label>KNOWN FACTS</label><ul>${(level.facts || []).map((f) => `<li>${f}</li>`).join('')}</ul></div>
    `;
  }
  function renderPhysics(index) {
    const level = LEVELS[index];
    const radius = Math.pow(10, level.logSpan);
    const diameter = radius * 2;
    const diameterKm = diameter / 1000;
    const diameterLy = diameter / 9.460730472e15;
    const diameterText = diameterLy >= 1 ? `${formatNumber(diameterLy)} ly` : `${formatNumber(diameterKm)} km`;
    const next = LEVELS[index + 1];
    const rows = [
      ['Logarithmic radius', `10^${level.logSpan.toFixed(1)} m`],
      ['Approx. diameter', diameterText],
      ['Light-crossing time', lightCrossing(level)],
      ['Next rung jump', next ? `×10^${(next.logSpan - level.logSpan).toFixed(1)}` : 'end of defined ladder'],
      ['Coordinate strategy', 'Independent shell space preserves float32 precision'],
    ];
    content.innerHTML = `
      <div class="obs-section"><label>SCALE ENGINE</label><p>The ladder is logarithmic. Earth and the observable universe are never forced into one literal coordinate system; that would destroy useful floating-point precision.</p></div>
      <div class="obs-metrics">${rows.map(([a,b]) => `<div><span>${a}</span><strong>${b}</strong></div>`).join('')}</div>
      <div class="obs-section"><label>WHY IT FEELS LIKE ZOOM</label><p>Adjacent shells cross-fade while real scale changes by orders of magnitude. The visual continuity is an explanatory device, not a claim that the universe has ten physical shells.</p></div>
    `;
  }
  function renderEvidence(index) {
    const level = LEVELS[index];
    const ev = EVIDENCE[level.evidence];
    const reading = level.evidence === 'measured'
      ? 'Individual positions/distances are tied to observational catalogues. Measurement still has uncertainty; “measured” does not mean infinitely precise.'
      : level.evidence === 'modelled'
        ? 'Large-scale structure is inferred from observations plus a physical model. Read the visualization as a scientific reconstruction, not a photograph.'
        : level.evidence === 'hypothesis'
          ? 'This is a theoretical proposal without observational confirmation. Its visualization is conceptual.'
          : 'This category is explicitly outside science so a dramatic visualization cannot be mistaken for evidence.';
    content.innerHTML = `
      <div class="obs-evidence-card ${level.evidence}"><span>STATUS</span><strong>${ev.label.toUpperCase()}</strong><p>${ev.blurb}</p></div>
      <div class="obs-section"><label>PROVENANCE</label><p>${level.source}</p></div>
      <div class="obs-section"><label>HOW TO READ THIS LEVEL</label><p>${reading}</p></div>
      <div class="obs-warning">⚠ Scientific visualization ≠ photograph. Geometry, brightness and transitions may be compressed for human readability.</div>
    `;
  }
  function renderObjects(index) {
    const entries = objectEntries(index).slice(0, 18);
    if (!entries.length) {
      content.innerHTML = `<div class="obs-empty"><strong>No named catalogue objects at this rung.</strong><p>This level is represented as a system or theoretical domain rather than a list of individually named objects.</p></div>`;
      return;
    }
    content.innerHTML = `<div class="obs-object-intro">Named objects available in the local catalogue. Select one to hand control to the existing grounded focus/search system.</div><div class="obs-object-list">${entries.map((e, n) => `<button class="obs-object" data-n="${n}"><span>${e.kind}</span><strong>${e.label}</strong><small>${e.blurb}</small></button>`).join('')}</div>`;
    content.querySelectorAll('.obs-object').forEach((button) => button.addEventListener('click', () => {
      const entry = entries[Number(button.dataset.n)];
      selectedEntry = entry;
      if (getSOE()?.runSearch) getSOE().runSearch(entry.label);
      panel.classList.add('focus-mode');
      renderSelected(entry);
    }));
  }
  function renderSelected(entry) {
    if (!entry) return;
    const p = entry.payload || {};
    const rows = Object.entries(p).filter(([k,v]) => v !== null && v !== '' && k !== 'i').slice(0, 14);
    content.innerHTML = `
      <button id="obsBack" class="obs-back">← Back to object list</button>
      <div class="obs-selected-kind">${entry.kind.toUpperCase()}</div>
      <h3 class="obs-selected-title">${entry.label}</h3>
      <p class="obs-selected-blurb">${entry.blurb}</p>
      <div class="obs-raw-grid">${rows.map(([k,v]) => `<div><span>${k.replace(/_/g,' ')}</span><b>${typeof v === 'number' ? formatNumber(v) : v}</b></div>`).join('')}</div>
      <div class="obs-section"><label>CATALOGUE ROLE</label><p>This detail comes from the repository's local catalogue metadata; the 3D position is resolved by the existing renderer when available.</p></div>
    `;
    content.querySelector('#obsBack').addEventListener('click', () => { selectedEntry = null; panel.classList.remove('focus-mode'); renderObjects(getIndex()); });
  }
  function render() {
    const index = getIndex();
    const level = LEVELS[index];
    kind.textContent = `SCALE LEVEL ${index + 1} / ${LEVELS.length}`;
    title.textContent = level.name;
    subtitle.textContent = `${level.scaleLabel} · ${EVIDENCE[level.evidence].label}`;
    if (selectedEntry) { renderSelected(selectedEntry); return; }
    if (activeTab === 'physics') renderPhysics(index);
    else if (activeTab === 'evidence') renderEvidence(index);
    else if (activeTab === 'objects') renderObjects(index);
    else renderOverview(index);
  }
  toggle.addEventListener('click', () => { panel.classList.toggle('open'); toggle.classList.toggle('active'); render(); });
  panel.querySelector('#obsClose').addEventListener('click', () => { panel.classList.remove('open'); toggle.classList.remove('active'); });
  panel.querySelectorAll('.obs-tab').forEach((tab) => tab.addEventListener('click', () => {
    activeTab = tab.dataset.tab;
    selectedEntry = null;
    panel.classList.remove('focus-mode');
    panel.querySelectorAll('.obs-tab').forEach((t) => t.classList.toggle('active', t === tab));
    render();
  }));
  const ladder = document.getElementById('ladder');
  if (ladder) new MutationObserver(() => { if (panel.classList.contains('open')) { selectedEntry = null; render(); } }).observe(ladder, { subtree: true, attributes: true, attributeFilter: ['class'] });
  const wait = setInterval(() => { if (window.SOE) { clearInterval(wait); render(); } }, 350);
  setTimeout(() => clearInterval(wait), 30000);
}

function bootExperience() {
  installCinematic();
  installObservatory();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootExperience, { once: true });
else bootExperience();
