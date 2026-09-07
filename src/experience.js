/* Cinematic, additive interaction layer. It observes the existing UI instead of
   reaching into renderer internals, so the scientific/Three.js engine remains
   unchanged and this layer can fail soft if the page is partially loaded. */
import { LEVELS } from './levels.js';

const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const levelById = Object.fromEntries(LEVELS.map((level) => [level.id, level]));

function el(tag, id, className, html = '') {
  const node = document.createElement(tag);
  if (id) node.id = id;
  if (className) node.className = className;
  node.innerHTML = html;
  return node;
}

function install() {
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
  const readoutName = document.getElementById('readoutName');
  const readoutScale = document.getElementById('readoutScale');
  const fill = document.getElementById('scaleSpineFill');
  const flashPower = flash.querySelector('.sf-power');
  const landmarkText = landmark.querySelector('.lc-text');
  let last = -1;
  let landmarkTimer = 0;

  const dismissIntro = () => {
    intro.classList.add('dismissed');
  };
  if (prefersReduced) {
    intro.classList.add('dismissed');
  } else {
    setTimeout(dismissIntro, 4300);
    ['wheel', 'pointerdown', 'keydown', 'touchstart'].forEach((event) => {
      addEventListener(event, dismissIntro, { once: true, passive: true });
    });
  }

  function currentIndex() {
    const active = document.querySelector('#ladder .rung.active');
    return active ? Number(active.dataset.index) : 0;
  }

  function showTransition(i) {
    if (prefersReduced || i === last) return;
    flashPower.textContent = LEVELS[i]?.scaleLabel || '';
    flash.classList.remove('fire');
    void flash.offsetWidth;
    flash.classList.add('fire');
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
      if (readout) {
        readout.classList.remove('evolving');
        void readout.offsetWidth;
        readout.classList.add('evolving');
      }
      last = i;
    }
  }

  // The core app toggles .active on rungs as the continuous ladder crosses a
  // level. MutationObserver gives this layer a zero-coupling bridge to that
  // state, without duplicating or replacing the scale engine.
  const observer = new MutationObserver(sync);
  rungs.forEach((rung) => observer.observe(rung, { attributes: true, attributeFilter: ['class'] }));
  sync();

  // Give search results a tiny cinematic handoff without hijacking search.
  const searchStatus = document.getElementById('searchStatus');
  if (searchStatus) {
    const statusObserver = new MutationObserver(() => {
      if (!searchStatus.classList.contains('show')) return;
      searchStatus.animate(
        [{ transform: 'translateX(-50%) translateY(-5px)' }, { transform: 'translateX(-50%) translateY(0)' }],
        { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
    });
    statusObserver.observe(searchStatus, { attributes: true, attributeFilter: ['class'] });
  }

  // Keep landmark copy accurate if the underlying app changes the active rung
  // without a class mutation during startup.
  setInterval(() => {
    const i = currentIndex();
    if (i !== last) sync();
  }, 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
