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
  const modal = document.querySelector('[role=menu], [role=dialog][aria-modal=true], [role=alertdialog], [role=region][aria-label$="full screen"]');
  if (modal && modal.getAttribute('role') === 'menu') {
    const mr = modal.getBoundingClientRect();
    if (mr.top < -1 || mr.bottom > innerHeight + 1 || mr.left < -1 || mr.right > innerWidth + 1) problems.push(`menu does not fit on screen (${Math.round(mr.left)},${Math.round(mr.top)} to ${Math.round(mr.right)},${Math.round(mr.bottom)} on ${innerWidth}x${innerHeight})`);
  }
  const isFixed = (el) => {
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      const pos = getComputedStyle(p).position;
      if (pos === 'fixed' || pos === 'sticky') return true;
    }
    return false;
  };
  const all = [...document.querySelectorAll(SEL)].filter((e) => (modal ? modal.contains(e) : !e.closest('[role=dialog]') || true)).filter(visible);
  const scope = modal ? all : all.filter((e) => !document.querySelector('[role=menu], [role=dialog][aria-modal=true]'));
  const fixedFlags = scope.map(isFixed);
  for (let i = 0; i < scope.length; i++) {
    const el = scope[i];
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
    const rects = scope.map((e) => e.getBoundingClientRect());
    for (let j = 0; j < scope.length; j++) {
      const other = scope[j];
      if (other === el || other.contains(el) || el.contains(other)) continue;
      const o = rects[j];
      if (o.bottom < 0 || o.top > innerHeight) continue;
      // A fixed bar floats over the page by design; whether it hides something is decided by the 'covered' test above.
      if (fixedFlags[i] || fixedFlags[j]) continue;
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
  // The page itself must never scroll sideways.
  if (document.documentElement.scrollWidth > innerWidth + 1) problems.push(`the page scrolls sideways (content ${document.documentElement.scrollWidth}px wide, screen ${innerWidth}px)`);
  // Text that spills out of its own box (big numbers, long names).
  for (const t of document.querySelectorAll('.num, h1, h2, h3, [data-fit]')) {
    if (!visible(t) || isFixed(t) && t.closest('[role=dialog]')) continue;
    const cs = getComputedStyle(t);
    if (/(hidden|clip)/.test(cs.overflowX)) continue;
    const box = (t.closest('.card, .card-solid, .glass, button, section, [role=dialog]') || t.parentElement).getBoundingClientRect();
    const r = t.getBoundingClientRect();
    // Measure only the text people can see: screen-reader-only copies sit off to the side by design.
    let left = Infinity;
    let right = -Infinity;
    const walker = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || n.parentElement.closest('.sr-only')) continue;
      const tr = document.createRange();
      tr.selectNodeContents(n);
      const b = tr.getBoundingClientRect();
      if (b.width > 0) {
        left = Math.min(left, b.left);
        right = Math.max(right, b.right);
      }
    }
    const rr = right > left ? { left, right, width: right - left } : { left: 0, right: 0, width: 0 };
    if (rr.width > 0 && (rr.right > box.right + 2 || rr.left < box.left - 2) && rr.right > r.right + 2) problems.push(`text spills out of its box: ${name(t)} (text ${Math.round(rr.left)}-${Math.round(rr.right)}, box ${Math.round(box.left)}-${Math.round(box.right)})`);
  }
  scrollTo({ top: 0, left: 0, behavior: 'instant' });
  return [...new Set(problems)];
}

export async function checkLayout(page) {
  return page.evaluate(inPage);
}
