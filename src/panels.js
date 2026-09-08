/* Four independent layers each open a panel in the same right-hand column and
   none of them knows the others exist, so without a referee they pile up and
   an invisible one can sit on top of a live button. One panel at a time. */

const PANELS = [
  { id: 'cxInstrument', flag: 'open',   open: true  },
  { id: 'observatory',  flag: 'open',   open: true  },
  { id: 'infoPanel',    flag: 'hidden', open: false },
  { id: 'chatPanel',    flag: 'hidden', open: false },
];

const el = (id) => document.getElementById(id);
const isOpen = (p) => {
  const n = el(p.id);
  return !!n && n.classList.contains(p.flag) === p.open;
};

function close(p) {
  const n = el(p.id);
  if (!n) return;
  if (p.open) n.classList.remove(p.flag);
  else n.classList.add(p.flag);
  if (p.id === 'observatory') el('observatoryToggle')?.classList.remove('active');
}

let settling = false;

function syncFlag() {
  document.body.classList.toggle('sheet-open', PANELS.some(isOpen));
}

function reconcile(justOpened) {
  if (settling) return;
  settling = true;
  for (const p of PANELS) if (p.id !== justOpened && isOpen(p)) close(p);
  settling = false;
  syncFlag();
}

function watch() {
  for (const p of PANELS) {
    const node = el(p.id);
    if (!node || node.dataset.refereed === '1') continue;
    node.dataset.refereed = '1';
    // A panel closing must not cascade into closing the others.
    new MutationObserver(() => { if (isOpen(p)) reconcile(p.id); else syncFlag(); })
      .observe(node, { attributes: true, attributeFilter: ['class'] });
  }
}

// The panels are created by scripts that run at different times, so keep
// looking until every one of them exists.
watch();
new MutationObserver(watch).observe(document.body, { childList: true });
