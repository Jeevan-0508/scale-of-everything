/* Mobile-safe interaction bridge for Cosmic Explorer. */
(() => {
  let fired = false;

  const enter = (event) => {
    const target = event?.target?.closest?.('#cxLaunch');
    const button = target || document.getElementById('cxLaunch');
    const hero = document.getElementById('cosmicExplorer');
    if (!button || !hero || hero.classList.contains('cx-dismiss')) return;

    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }

    if (fired) return;
    fired = true;

    hero.classList.add('cx-dismiss');
    document.getElementById('cxInstrument')?.classList.add('open');
    document.getElementById('cxTimeline')?.classList.add('show');
    window.scrollTo?.(0, 0);
    setTimeout(() => hero.remove(), 700);
  };

  // Capture phase makes this work even if another layer/listener intercepts the tap.
  document.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') enter(e);
  }, true);

  document.addEventListener('touchend', enter, { passive: false, capture: true });

  const bindButton = () => {
    const button = document.getElementById('cxLaunch');
    if (!button || button.dataset.mobileBound === '1') return false;
    button.dataset.mobileBound = '1';
    button.style.touchAction = 'manipulation';
    button.addEventListener('click', enter, { capture: true });
    return true;
  };

  if (!bindButton()) {
    const observer = new MutationObserver(() => {
      if (bindButton()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
