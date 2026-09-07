/* Mobile-safe interaction bridge for Cosmic Explorer. */
(() => {
  const bind = () => {
    const button = document.getElementById('cxLaunch');
    const hero = document.getElementById('cosmicExplorer');
    const instrument = document.getElementById('cxInstrument');
    const timeline = document.getElementById('cxTimeline');
    if (!button || !hero) return false;

    if (button.dataset.mobileBound === '1') return true;
    button.dataset.mobileBound = '1';

    const enter = (event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      hero.classList.add('cx-dismiss');
      instrument?.classList.add('open');
      timeline?.classList.add('show');
      window.scrollTo?.(0, 0);
      setTimeout(() => hero.remove(), 700);
    };

    button.addEventListener('touchend', enter, { passive: false });
    button.addEventListener('click', enter, { passive: false });
    return true;
  };

  if (!bind()) {
    const observer = new MutationObserver(() => {
      if (bind()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
