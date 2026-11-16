// Finds controls that are covered by something else, overlap each other, or sit off-screen.
// Used by scripts/layout.mjs (CI) and can be pointed at any Playwright page.

/** Runs inside the page. Returns a list of human-readable problems. */
function inPage() {
  const problems = [];
  // Toasts come and go on their own and are meant to float over the page.
  for (const t of document.querySelectorAll('.toast-in')) t.style.display = 'none';
  const SEL = 'button, a[href], input:not([type=hidden]):not(.sr-only), select, textarea, [role=tab], [role=button], [role=switch], [role=radio], summary';
  const name = (el) => {
    const t = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}> "${t}"`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') return false;
    if (el.closest('[aria-hidden="true"], [inert], .sr-only')) return false;
    for (let p = el.parentElement; p; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    }
    return true;
  };
  const inHScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const s = getComputedStyle(p);
      if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return true;
    }
    return false;
  };
  // If a modal is open, only the modal's controls matter; the page behind is meant to be covered.
  const modal = document.querySelector('[role=dialog][aria-modal=true], [role=alertdialog]');
  const all = [...document.querySelectorAll(SEL)].filter((e) => (modal ? modal.contains(e) : !e.closest('[role=dialog]') || true)).filter(visible);
  const scope = modal ? all : all.filter((e) => !document.querySelector('[role=dialog][aria-modal=true]'));
  for (const el of scope) {
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) {
      // Could not be scrolled into view at all.
      problems.push(`cannot be scrolled into view: ${name(el)}`);
      continue;
    }
    if (!inHScroller(el) && (r.left < -1 || r.right > innerWidth + 1)) problems.push(`runs off the side of the screen: ${name(el)} (left ${Math.round(r.left)}, right ${Math.round(r.right)}, screen ${innerWidth})`);
    // Sample the centre and four inner points; any point that lands on something else is a cover.
    const pts = [[0.5, 0.5], [0.2, 0.5], [0.8, 0.5], [0.5, 0.2], [0.5, 0.8]];
    let covered = 0;
    let by = null;
    for (const [fx, fy] of pts) {
      const x = r.left + r.width * fx;
      const y = r.top + r.height * fy;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      const top = document.elementFromPoint(x, y);
      if (top && !(el === top || el.contains(top) || (top.closest('label') && top.closest('label').contains(el)))) {
        covered++;
        by = by || top;
      }
    }
    if (covered >= 2 || (covered >= 1 && by && getComputedStyle(by).position === 'fixed')) problems.push(`covered by ${name(by)}${by.className && typeof by.className === 'string' ? ' .' + by.className.split(' ').slice(0, 3).join('.') : ''}: ${name(el)}`);
    // Overlap with another control (neither contains the other).
    for (const other of scope) {
      if (other === el || other.contains(el) || el.contains(other)) continue;
      const o = other.getBoundingClientRect();
      const w = Math.min(r.right, o.right) - Math.max(r.left, o.left);
      const h = Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top);
      if (w > 4 && h > 4 && w * h > 0.15 * Math.min(r.width * r.height, o.width * o.height)) {
        const a = name(el), b = name(other);
        const key = [a, b].sort().join(' <-> ');
        const nv = document.querySelector('nav.fixed.bottom-0, nav[class*="bottom-0"]');
        const extra = ` [A ${Math.round(r.top)}-${Math.round(r.bottom)} / B ${Math.round(o.top)}-${Math.round(o.bottom)}; scrollY ${Math.round(scrollY)}, docH ${document.documentElement.scrollHeight}, viewH ${innerHeight}, mainPad ${getComputedStyle(document.querySelector('main')).paddingBottom}, nav ${nv ? Math.round(nv.getBoundingClientRect().top) : 'none'}]`;
        if (!problems.some((x) => x.startsWith(`overlap: ${key}`))) problems.push(`overlap: ${key}${extra}`);
      }
    }
  }
  scrollTo({ top: 0, left: 0, behavior: 'instant' });
  return [...new Set(problems)];
}

export async function checkLayout(page) {
  return page.evaluate(inPage);
}
