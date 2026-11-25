/* MENA Health Data — 3D depth layer.
   Gives every chart a 3D look without moving any value: bars get a lit top face and a shaded side face,
   large blocks (treemap tiles) get a bevel, filled shapes (map countries) are raised, lines are lifted with a
   shadow and dots become small spheres. Values are still read from each mark's front face, so they stay exact.
   A 3D / Flat switch in the top bar turns the effect off; the choice is remembered in this browser. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const html = document.documentElement;
  let flat = false;
  try { flat = localStorage.getItem('hd-view') === 'flat'; } catch (e) { /* storage blocked */ }
  html.classList.toggle('hd-flat', flat);
  const tracked = new Set();

  // ---------- colour helpers ----------
  const parse = (c) => {
    const str = String(c || '');
    let m = str.match(/rgba?\(([^)]+)\)/);
    if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return {r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1}; }
    m = str.match(/color\(srgb ([^)]+)\)/);
    if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return {r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p.length > 3 ? p[3] : 1}; }
    return null;
  };
  const lum = (c) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  const probe = () => { let s = document.getElementById('hd-probe'); if (!s) { s = document.createElement('span'); s.id = 'hd-probe'; s.style.display = 'none'; document.body.appendChild(s); } return s; };
  const resolve = (v) => { const s = probe(); s.style.color = ''; s.style.color = v; return parse(getComputedStyle(s).color); };
  const mix = (c, t, k) => `rgb(${Math.round(c.r + (t - c.r) * k)},${Math.round(c.g + (t - c.g) * k)},${Math.round(c.b + (t - c.b) * k)})`;
  const near = (a, b, tol = 12) => a && b && Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < tol;
  let skip = [];
  const refreshSkip = () => { skip = ['--cds-chart-grid', '--color-panel', '--color-bg', '--color-border-line', '--cds-chart-axis', '--cds-surface-popover'].map((v) => resolve(`var(${v})`)).filter(Boolean); };

  // ---------- geometry ----------
  const num = (el, a, d = 0) => { const v = parseFloat(el.getAttribute(a)); return isNaN(v) ? d : v; };
  const poly = (cls) => { const p = document.createElementNS(NS, 'polygon'); p.setAttribute('class', 'hd3d-face ' + cls); p.setAttribute('pointer-events', 'none'); p.setAttribute('aria-hidden', 'true'); return p; };
  const pts = (a) => a.map((p) => p.map((v) => Math.round(v * 10) / 10).join(',')).join(' ');
  const paintFaces = (el, st) => {
    const fill = parse(getComputedStyle(el).fill); if (!fill) return;
    const op = getComputedStyle(el).fillOpacity;
    st.faces.forEach((f) => { f.setAttribute('fill-opacity', op); const t = el.getAttribute('transform'); if (t) f.setAttribute('transform', t); else f.removeAttribute('transform'); });
    if (st.mode === 'bar') { st.faces[0].setAttribute('fill', mix(fill, 255, 0.38)); st.faces[1].setAttribute('fill', mix(fill, 0, 0.32)); }
  };
  const shapeBar = (el, st) => {
    const x = num(el, 'x'), y = num(el, 'y'), w = num(el, 'width'), h = num(el, 'height');
    const d = Math.max(2.5, Math.min(5, Math.min(w, h) * 0.35));
    st.faces[0].setAttribute('points', pts([[x, y], [x + d, y - d], [x + w + d, y - d], [x + w, y]]));
    st.faces[1].setAttribute('points', pts([[x + w, y], [x + w + d, y - d], [x + w + d, y + h - d], [x + w, y + h]]));
    const hide = w < 1.5 || h < 1.5; st.faces.forEach((f) => { f.style.display = hide ? 'none' : ''; });
  };
  const shapeBevel = (el, st) => {
    const x = num(el, 'x'), y = num(el, 'y'), w = num(el, 'width'), h = num(el, 'height');
    const b = Math.max(1.5, Math.min(4, w / 8, h / 8));
    st.faces[0].setAttribute('points', pts([[x, y], [x + w, y], [x + w - b, y + b], [x + b, y + b], [x + b, y + h - b], [x, y + h]]));
    st.faces[1].setAttribute('points', pts([[x + w, y], [x + w, y + h], [x, y + h], [x + b, y + h - b], [x + w - b, y + h - b], [x + w - b, y + b]]));
  };
  const shapeSphere = (el, st) => {
    const r = num(el, 'r'), cx = num(el, 'cx'), cy = num(el, 'cy');
    st.faces[0].setAttribute('cx', cx - r * 0.32); st.faces[0].setAttribute('cy', cy - r * 0.34); st.faces[0].setAttribute('r', Math.max(0.8, r * 0.38));
    const t = el.getAttribute('transform'); if (t) st.faces[0].setAttribute('transform', t);
  };
  const update = (el) => {
    const st = el.__hd; if (!st) return;
    if (st.mode === 'bar') shapeBar(el, st); else if (st.mode === 'bevel') shapeBevel(el, st); else if (st.mode === 'sphere') shapeSphere(el, st);
    if (st.mode !== 'sphere') paintFaces(el, st);
  };

  // ---------- classify ----------
  const inAxis = (el) => !!el.closest('.tick, .domain, .legend, defs, clipPath, mask, pattern, marker');
  const svgSize = (el) => { const s = el.ownerSVGElement; if (!s) return {w: 0, h: 0}; return {w: num(s, 'width', s.clientWidth), h: num(s, 'height', s.clientHeight)}; };
  const solidFill = (el) => {
    const cs = getComputedStyle(el); const f = parse(cs.fill);
    if (!f || f.a < 0.05 || +cs.fillOpacity < 0.3 || +cs.opacity < 0.2) return null;
    if (skip.some((s) => near(s, f))) return null;
    return f;
  };
  const addRect = (el) => {
    const w = num(el, 'width'), h = num(el, 'height');
    if (!solidFill(el)) return;
    const s = svgSize(el); if (w >= 0.8 * s.w && h >= 0.6 * s.h) return; // a background panel, not a mark
    const tile = !!el.closest('g.tile') || (w >= 30 && h >= 30);
    const st = {mode: tile ? 'bevel' : 'bar', faces: [poly(tile ? 'hd3d-hi' : 'hd3d-top'), poly(tile ? 'hd3d-lo' : 'hd3d-side')]};
    if (tile) { const nx = el.nextSibling; st.faces.forEach((f) => el.parentNode.insertBefore(f, nx)); } // bevel sits on top of the tile
    else st.faces.forEach((f) => el.parentNode.insertBefore(f, el)); // extrusion sits behind the bar
    if (!tile) { st.rx = el.getAttribute('rx'); if (!flat && st.rx != null) el.setAttribute('rx', Math.min(+st.rx, 1.5)); }
    el.__hd = st; tracked.add(el); el.classList.add('hd3d-' + st.mode); update(el);
  };
  const addCircle = (el) => {
    const r = num(el, 'r'); if (r < 3 || !solidFill(el)) return;
    const c = document.createElementNS(NS, 'circle'); c.setAttribute('class', 'hd3d-face hd3d-shine'); c.setAttribute('pointer-events', 'none'); c.setAttribute('aria-hidden', 'true');
    el.parentNode.insertBefore(c, el.nextSibling);
    el.__hd = {mode: 'sphere', faces: [c]}; tracked.add(el); el.classList.add('hd3d-sphere'); update(el);
  };
  const addPath = (el) => {
    const cs = getComputedStyle(el);
    const f = solidFill(el);
    if (f) { // raise data shapes (map countries, filled areas); leave pale background land flat
      const bgDark = lum(skip[2] || {r: 240, g: 245, b: 250}) < 0.3;
      const isData = cs.cursor === 'pointer';
      if (!isData && (skip.some((k) => near(k, f, 30)) || (!bgDark && lum(f) > 0.86) || (bgDark && lum(f) < 0.16))) return;
      el.classList.add('hd3d-slab'); el.__hd = {mode: 'css', faces: []}; return;
    }
    const st = parse(cs.stroke);
    if (cs.fill === 'none' && st && st.a > 0.2 && parseFloat(cs.strokeWidth) >= 1.5 && !skip.some((s) => near(s, st))) { el.classList.add('hd3d-lift'); el.__hd = {mode: 'css', faces: []}; }
  };
  const scan = () => {
    if (!skip.length) refreshSkip();
    document.querySelectorAll('#dash-root svg').forEach((svg) => {
      if (svg.closest('.brandrow, .r-brand, .site-top') || svg.classList.contains('brandmark')) return;
      svg.querySelectorAll('rect, circle, path').forEach((el) => {
        if (el.__hd || el.classList.contains('hd3d-face') || inAxis(el) || el.closest('[hidden]')) return;
        if (el.classList.contains('hit')) { el.__hd = {mode: 'none', faces: []}; return; }
        const t = el.tagName.toLowerCase();
        if (t === 'rect') addRect(el); else if (t === 'circle') addCircle(el); else addPath(el);
        if (!el.__hd) el.__hd = {mode: 'none', faces: []};
      });
    });
    tracked.forEach((el) => { if (!el.isConnected) { el.__hd.faces.forEach((f) => f.remove()); tracked.delete(el); } });
  };

  // ---------- keep faces in step with the charts (redraws, filters, animations) ----------
  let scanQueued = false; const dirty = new Set(); let frame = 0;
  const flush = () => {
    frame = 0;
    if (scanQueued) { scanQueued = false; scan(); }
    dirty.forEach((el) => { if (el.isConnected) update(el); }); dirty.clear();
  };
  const queue = () => { if (!frame) frame = requestAnimationFrame(flush); };
  const mo = new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'childList') {
        if ([...m.addedNodes].some((n) => n.nodeType === 1 && !(n.classList && n.classList.contains('hd3d-face')))) scanQueued = true;
        m.removedNodes.forEach((n) => { if (n.__hd) n.__hd.faces.forEach((f) => f.remove()); });
      } else if (m.target.__hd && m.target.__hd.faces.length) dirty.add(m.target);
      else if (m.attributeName === 'hidden') scanQueued = true;
    }
    if (scanQueued || dirty.size) queue();
  });
  const start = () => {
    const root = document.getElementById('dash-root'); if (!root) return;
    mo.observe(root, {childList: true, subtree: true, attributes: true, attributeFilter: ['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'transform', 'fill', 'fill-opacity', 'style', 'hidden', 'class']});
    scanQueued = true; queue();
    // re-read colours when the system switches light/dark
    if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { refreshSkip(); tracked.forEach((el) => update(el)); });
    addSwitch();
  };

  // ---------- 3D / Flat switch ----------
  const setFlat = (f) => {
    flat = f; html.classList.toggle('hd-flat', f);
    try { localStorage.setItem('hd-view', f ? 'flat' : '3d'); } catch (e) { /* ignore */ }
    tracked.forEach((el) => { const st = el.__hd; if (st && st.rx != null) el.setAttribute('rx', f ? st.rx : Math.min(+st.rx, 1.5)); });
    document.querySelectorAll('.hd3d-switch button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.v === 'flat') === f)));
  };
  const addSwitch = () => {
    const top = document.querySelector('.site-top'); if (!top || top.querySelector('.hd3d-switch')) return;
    const wrap = document.createElement('div'); wrap.className = 'hd3d-switch'; wrap.setAttribute('role', 'group'); wrap.setAttribute('aria-label', 'Chart style');
    [['3d', '3D'], ['flat', 'Flat']].forEach(([v, t]) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.v = v; b.textContent = t; b.title = v === 'flat' ? 'Plain flat charts' : '3D charts with depth'; b.setAttribute('aria-pressed', String((v === 'flat') === flat)); b.addEventListener('click', () => setFlat(v === 'flat')); wrap.appendChild(b); });
    top.appendChild(wrap);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
