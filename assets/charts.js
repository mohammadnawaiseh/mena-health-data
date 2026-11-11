(function(){
const H = window.HD;
dash.calc('headline', {
  inputs: ['latest'],
  title: 'Headline figures',
  description: 'Highest diabetes prevalence among the 14 MENA countries, and Eastern Mediterranean adult obesity divided by the world rate.',
  fn: (latest) => {
    const d = latest.filter((r) => r.indicator === 'diabetes' && !['Aggregate', 'Global benchmark'].includes(r.group));
    const top = d.reduce((a, b) => (+b.value > +a.value ? b : a), d[0] || {});
    const ob = (c) => latest.find((r) => r.indicator === 'obesity' && r.code === c);
    const reg = ob('REG'), wld = ob('WLD');
    return [
      {key: 'top_diabetes', country: top.country, value: +top.value},
      {key: 'obesity_ratio', country: 'E. Med. region vs world', value: reg && wld ? Math.round(+reg.value / +wld.value * 10) / 10 : null}
    ];
  }
});
dash.calc('ranks', {
  inputs: ['latest', 'catalog'],
  title: 'MENA ranks',
  description: 'Rank of each of the 14 MENA countries on each indicator, both sexes: 1 = best where lower or higher is better, else 1 = largest.',
  fn: (latest, catalog) => {
    const out = [];
    catalog.forEach((c) => {
      const rows = latest.filter((r) => r.indicator === c.indicator && !['Aggregate', 'Global benchmark'].includes(r.group) && r.value !== '' && r.value != null);
      rows.sort((a, b) => (c.better === 'lower' ? +a.value - +b.value : +b.value - +a.value));
      rows.forEach((r, i) => out.push({code: r.code, indicator: c.indicator, rank: i + 1, of: rows.length}));
    });
    return out;
  }
});
const hl = (key, field, fmt) => (el) => { const d = dash.data('headline'); const r = d.status === 'ok' && d.data ? d.data.find((x) => x.key === key) : null; el.textContent = r && r[field] != null ? fmt(r[field]) : '—'; };
dash.draw('topCountry', hl('top_diabetes', 'country', String));
dash.draw('topValue', hl('top_diabetes', 'value', (v) => d3.format('.1f')(v)));
dash.draw('obRatio', hl('obesity_ratio', 'value', (v) => d3.format('.1f')(v)));
const kpi = (code) => (el) => {
  if (!H.ok('latest', 'catalog')) { el.textContent = '—'; return; }
  const ind = el.dataset.ind, c = H.cat().get(ind), r = H.row(code, ind);
  el.setAttribute('data-field', 'value'); el.setAttribute('data-where', H.where(code, ind)); el.textContent = H.fmtI(r ? H.num(r.value) : null, c);
};
dash.draw('kpi', kpi('REG'));
dash.draw('kpiw', kpi('WLD'));
})();
(function(){
const H = window.HD;
// Heat map scorecard
dash.draw('heat', (el) => {
  el.replaceChildren();
  if (!H.ok('latest', 'catalog')) { el.textContent = dash.data('latest').status === 'error' ? 'Failed to load' : '—'; return; }
  const cat = H.cat();
  const cols = ['diabetes', 'obesity', 'hypertension', 'inactivity', 'tobacco', 'ncd_3070', 'cvd_rate', 'hale', 'uhc', 'hyp_control', 'oop', 'physicians'].map((i) => cat.get(i)).filter(Boolean);
  const codes = [...new Set(dash.data('latest').data.filter(H.inView).map((r) => r.code))];
  const tbl = document.createElement('table'); tbl.className = 'heat';
  const hr = document.createElement('tr'); const th0 = document.createElement('th'); th0.textContent = 'Country'; hr.appendChild(th0);
  cols.forEach((c) => { const th = document.createElement('th'); th.className = 'n'; th.textContent = c.name.replace(/ \(.*\)/, '') + H.sexWord(c); hr.appendChild(th); });
  const thead = document.createElement('thead'); thead.appendChild(hr); tbl.appendChild(thead);
  const tb = document.createElement('tbody');
  [...codes, 'REG', 'WLD'].forEach((code) => {
    const tr = document.createElement('tr');
    const nm = document.createElement('td'); nm.className = 'name'; const any = dash.data('latest').data.find((r) => r.code === code); nm.textContent = any ? any.country : code;
    if (code !== 'REG' && code !== 'WLD') nm.onclick = () => { H.s.country = code; H.redraw(); H.go('profile'); };
    tr.appendChild(nm);
    cols.forEach((c) => {
      const td = document.createElement('td'); td.className = 'c';
      const r = H.row(code, c.indicator), v = H.val(r, c), w = H.val(H.row('WLD', c.indicator), c);
      td.textContent = H.fmtI(v, c);
      if (r && v != null) H.mark(td, code, c.indicator, c);
      const st = code === 'WLD' ? 0 : H.status(v, w, c.better);
      if (st) { td.style.backgroundColor = st < 0 ? 'var(--cds-chart-status-critical)' : 'var(--cds-chart-status-good)'; td.style.backgroundColor = st < 0 ? 'color-mix(in srgb, var(--cds-chart-status-critical) ' + Math.round(Math.min(1, Math.abs(st)) * 55 + 8) + '%, transparent)' : 'color-mix(in srgb, ' + dash.colors[0] + ' ' + Math.round(Math.min(1, Math.abs(st)) * 55 + 8) + '%, transparent)'; }
      td.onclick = () => { H.s.ind = c.indicator; H.redraw(); H.go('explorer'); };
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  tbl.appendChild(tb); el.appendChild(tbl);
});
})();
(function(){
const H = window.HD;
// Ranked bar chart (shared)
H.bar = (el, ind, compact) => {
  el.replaceChildren();
  if (!H.ok('latest', 'catalog')) { el.textContent = dash.data('latest').status === 'error' ? 'Failed to load' : '—'; return; }
  const c = H.cat().get(ind); if (!c) { el.textContent = '—'; return; }
  const all = dash.data('latest').data.filter((r) => r.indicator === ind);
  const data = all.filter(H.inView).filter((r) => H.val(r, c) != null).sort((a, b) => H.val(b, c) - H.val(a, c));
  const reg = all.find((r) => r.code === 'REG'), wld = all.find((r) => r.code === 'WLD');
  const W = el.clientWidth || 360, bh = compact ? 16 : 22, top = compact ? 22 : 6, bottom = 22;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', data.length * bh + top + bottom).attr('role', 'img').attr('aria-label', c.name + ' by country');
  if (compact) svg.append('text').attr('x', 0).attr('y', 13).style('fill', 'var(--color-fg)').style('font-weight', 600).text(c.name + H.sexWord(c) + ' · ' + c.unit);
  const tmp = svg.append('g'); const labW = d3.max(data, (d) => { const t = tmp.append('text').text(d.country); const w = t.node().getComputedTextLength(); t.remove(); return w; }) || 60; tmp.remove();
  const left = labW + 8, right = 46;
  const vals = [...data.map((d) => H.val(d, c)), H.val(reg, c) || 0, H.val(wld, c) || 0];
  const x = d3.scaleLinear().domain([0, (d3.max(vals) || 1) * 1.04]).range([left, Math.max(left + 40, W - right)]);
  const g = svg.selectAll('g.b').data(data).join('g').attr('class', 'b').attr('transform', (d, i) => `translate(0,${top + i * bh})`).style('cursor', 'pointer');
  g.append('text').attr('x', left - 6).attr('y', bh / 2).attr('dy', '.35em').attr('text-anchor', 'end').text((d) => d.country);
  g.append('rect').attr('x', left).attr('y', 2).attr('height', bh - 4).attr('rx', 2).attr('width', (d) => Math.max(0, x(H.val(d, c)) - left)).style('fill', (d) => (d.group === 'Global benchmark' ? 'var(--cds-chart-muted)' : d.code === H.s.country ? dash.colors[1] : dash.colors[0]));
  g.append('text').attr('x', (d) => x(H.val(d, c)) + 4).attr('y', bh / 2).attr('dy', '.35em').text((d) => H.fmtI(H.val(d, c), c));
  const h = data.length * bh + top;
  [[reg, 'Region', 'var(--cds-chart-status-critical)', 'end'], [wld, 'World', 'var(--cds-chart-reference)', 'start']].forEach(([r, lab, col, anc]) => {
    const v = H.val(r, c); if (v == null) return;
    svg.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', top - 2).attr('y2', h).style('stroke', col).style('stroke-dasharray', '4 3');
    svg.append('text').attr('x', x(v) + (anc === 'end' ? -3 : 3)).attr('y', h + 14).attr('text-anchor', anc).text(`${lab} ${H.fmtI(v, c)}`);
  });
  const tip = H.tip(el);
  g.on('pointermove', (ev, d) => { const [px, py] = d3.pointer(ev, el); tip.textContent = `${d.country}: ${H.fmtI(H.val(d, c), c)} ${c.unit} (${d.year})`; H.place(el, tip, px, py); })
   .on('pointerleave', () => { tip.hidden = true; })
   .on('click', (ev, d) => { if (d.group === 'Global benchmark') return; H.s.country = d.code; H.redraw(); H.go('profile'); });
};
dash.draw('mini', (el) => { H.bar(el, el.dataset.ind, true); el.onclick = (ev) => { if (ev.target.closest('g.b')) return; H.s.ind = el.dataset.ind; H.redraw(); H.go('explorer'); }; });
dash.draw('exbar', (el) => H.bar(el, H.s.ind, false));
})();
(function(){
const H = window.HD;
// Explorer controls, trend and sex charts
dash.draw('indsel', (sel) => { if (!H.ok('catalog')) return; H.catOptions(sel, H.s.ind, (v) => { H.s.ind = v; H.redraw(); }); });
dash.draw('indmeta', (el) => {
  const c = H.cat().get(H.s.ind); if (!c) { el.textContent = '—'; return; }
  const yrs = H.ok('latest') ? [...new Set(dash.data('latest').data.filter((r) => r.indicator === c.indicator).map((r) => r.year))].sort() : [];
  el.textContent = `${c.category} · ${c.unit}${H.sexWord(c)} · Source: ${c.source} · Latest year: ${yrs.join(', ') || '—'} · Regional average: ${c.regional_average} · ` + (c.better === 'none' ? 'No good/bad direction' : (c.better === 'lower' ? 'Lower is better' : 'Higher is better'));
});
dash.draw('picks', (el) => {
  el.replaceChildren(); if (!H.ok('latest')) return;
  const seen = new Map(); dash.data('latest').data.forEach((r) => { if (!seen.has(r.code) && (r.group !== 'Global benchmark' || H.s.bench) && (!H.s.grp || r.group === H.s.grp || r.group === 'Aggregate' || r.group === 'Global benchmark')) seen.set(r.code, r.country); });
  seen.forEach((name, code) => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = name; b.setAttribute('aria-pressed', String(H.s.picks.has(code))); b.onclick = () => { H.s.picks.has(code) ? H.s.picks.delete(code) : H.s.picks.add(code); dash.draw('picks'); dash.draw('exline'); }; el.appendChild(b); });
});
dash.draw('exline', (el) => {
  el.replaceChildren();
  if (!H.ok('series', 'catalog')) { el.textContent = dash.data('series').status === 'error' ? 'Failed to load' : '—'; return; }
  const c = H.cat().get(H.s.ind);
  const rows = dash.data('series').data.filter((r) => r.indicator === H.s.ind && H.s.picks.has(r.code) && H.num(r.value) != null);
  if (!rows.length) { const p = document.createElement('p'); p.className = 'sub'; p.textContent = 'No yearly series for this indicator in the current sources — only the latest value. Try life expectancy, obesity, hypertension, tobacco, UHC, HALE, out-of-pocket, spending per person, NCD mortality or the cause-specific death rates.'; el.appendChild(p); return; }
  const series = d3.groups(rows, (r) => r.code).map(([code, v]) => ({code, country: v[0].country, agg: v[0].group === 'Aggregate', pts: v.map((r) => ({year: +r.year, v: +r.value}))}));
  const W = el.clientWidth || 360, Hh = 260, m = {t: 10, r: 12, b: 24, l: 46};
  const x = d3.scaleLinear().domain(d3.extent(rows, (r) => +r.year)).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain(d3.extent(rows, (r) => +r.value)).nice().range([Hh - m.b, m.t]);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', Hh).attr('role', 'img').attr('aria-label', c.name + ' over time');
  svg.append('g').attr('transform', `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).ticks(Math.min(6, W / 70)).tickFormat(d3.format('d'))).call((g) => g.selectAll('line,path').style('stroke', 'var(--cds-chart-axis)'));
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(d3.format(',~f'))).call((g) => { g.select('path').remove(); g.selectAll('line').style('stroke', 'var(--cds-chart-grid)'); });
  const cmap = new Map(); let ci = 0;
  series.forEach((s) => cmap.set(s.code, s.code === 'REG' ? 'var(--cds-chart-status-critical)' : s.code === 'WLD' ? 'var(--cds-chart-reference)' : dash.colors[ci++ % dash.colors.length]));
  const ln = d3.line().defined((p) => p.v != null).x((p) => x(p.year)).y((p) => y(p.v));
  svg.selectAll('path.s').data(series).join('path').attr('class', 's').attr('d', (s) => ln(s.pts)).style('fill', 'none').style('stroke', (s) => cmap.get(s.code)).style('stroke-width', (s) => (s.agg ? 2.4 : 1.6)).style('stroke-dasharray', (s) => (s.agg ? '5 3' : null));
  svg.selectAll('circle.s').data(series.flatMap((s) => s.pts.length < 8 ? s.pts.map((p) => ({...p, code: s.code})) : [])).join('circle').attr('r', 2.5).attr('cx', (p) => x(p.year)).attr('cy', (p) => y(p.v)).style('fill', (p) => cmap.get(p.code));
  const leg = document.createElement('div'); leg.className = 'legend';
  series.forEach((s) => { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = cmap.get(s.code); sp.append(i, s.country); leg.appendChild(sp); });
  el.appendChild(leg);
  const tip = H.tip(el);
  const guide = svg.append('line').attr('y1', m.t).attr('y2', Hh - m.b).style('stroke', 'var(--cds-chart-axis)').style('opacity', 0);
  svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', Math.max(0, W - m.l - m.r)).attr('height', Hh - m.t - m.b).style('fill', 'transparent')
    .on('pointermove', (ev) => {
      const [px, py] = d3.pointer(ev, el); const yr = Math.round(x.invert(px)); guide.attr('x1', x(yr)).attr('x2', x(yr)).style('opacity', 1);
      const vals = series.map((s) => [s.country, (s.pts.find((p) => p.year === yr) || {}).v]).filter((a) => a[1] != null).sort((a, b) => b[1] - a[1]);
      tip.replaceChildren(); const hb = document.createElement('b'); hb.textContent = yr; tip.appendChild(hb);
      vals.forEach(([cn, v]) => { const dv = document.createElement('div'); dv.textContent = `${cn}: ${H.fmtI(v, c)}`; tip.appendChild(dv); });
      if (vals.length) H.place(el, tip, px, py); else tip.hidden = true;
    })
    .on('pointerleave', () => { tip.hidden = true; guide.style('opacity', 0); });
});
dash.draw('exsex', (el) => {
  el.replaceChildren();
  if (!H.ok('latest', 'catalog')) { el.textContent = '—'; return; }
  const c = H.cat().get(H.s.ind);
  if (!c || c.by_sex !== '1') { const p = document.createElement('p'); p.className = 'sub'; p.textContent = 'This indicator is not reported by sex.'; el.appendChild(p); return; }
  const rows = dash.data('latest').data.filter((r) => r.indicator === c.indicator && (H.inView(r) || r.group === 'Aggregate') && H.num(r.male) != null).sort((a, b) => (+b.female) - (+a.female));
  const W = el.clientWidth || 360, bh = 22, top = 8, bottom = 24, left = 120, right = 20;
  const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => Math.max(+r.male, +r.female)) * 1.05]).range([left, W - right]);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', rows.length * bh + top + bottom).attr('role', 'img').attr('aria-label', c.name + ' for women and men');
  svg.append('g').attr('transform', `translate(0,${rows.length * bh + top})`).call(d3.axisBottom(x).ticks(5)).call((g) => g.selectAll('line,path').style('stroke', 'var(--cds-chart-axis)'));
  const g = svg.selectAll('g.r').data(rows).join('g').attr('transform', (d, i) => `translate(0,${top + i * bh + bh / 2})`);
  g.append('text').attr('x', left - 8).attr('dy', '.35em').attr('text-anchor', 'end').text((d) => d.country);
  g.append('line').attr('x1', (d) => x(+d.male)).attr('x2', (d) => x(+d.female)).style('stroke', 'var(--cds-chart-grid)').style('stroke-width', 3);
  g.append('circle').attr('cx', (d) => x(+d.female)).attr('r', 5).style('fill', dash.colors[1]);
  g.append('circle').attr('cx', (d) => x(+d.male)).attr('r', 5).style('fill', dash.colors[0]);
  const leg = document.createElement('div'); leg.className = 'legend';
  [['Women', dash.colors[1]], ['Men', dash.colors[0]]].forEach(([l, col]) => { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = col; sp.append(i, l); leg.appendChild(sp); });
  el.appendChild(leg);
  const tip = H.tip(el);
  g.on('pointermove', (ev, d) => { const [px, py] = d3.pointer(ev, el); tip.textContent = `${d.country}: women ${H.fmtI(+d.female, c)}, men ${H.fmtI(+d.male, c)} ${c.unit}`; H.place(el, tip, px, py); }).on('pointerleave', () => { tip.hidden = true; });
});
})();
(function(){
const H = window.HD;
// Country profile
H.countries = () => { const m = new Map(); dash.data('latest').data.forEach((r) => { if (!m.has(r.code)) m.set(r.code, [r.country, r.group]); }); return m; };
dash.draw('csel', (sel) => {
  if (!H.ok('latest')) return; const m = H.countries();
  H.optList(sel, [...m].filter(([, [, g]]) => g !== 'Aggregate').map(([code, [n]]) => [code, n]), H.s.country);
  sel.onchange = () => { H.s.country = sel.value; H.redraw(); };
});
dash.draw('cmpsel', (sel) => {
  if (!H.ok('latest')) return; const m = H.countries();
  H.optList(sel, [...m].filter(([code]) => code !== H.s.country).map(([code, [n]]) => [code, n]), H.s.cmp);
  sel.onchange = () => { H.s.cmp = sel.value; H.redraw(); };
});
dash.draw('h-country', (el) => { const m = H.ok('latest') ? H.countries() : new Map(); el.textContent = m.has(H.s.country) ? m.get(H.s.country)[0] : '—'; });
dash.draw('h-cmp', (el) => { const m = H.ok('latest') ? H.countries() : new Map(); el.textContent = m.has(H.s.cmp) ? m.get(H.s.cmp)[0] : '—'; });
dash.draw('causes', (el) => {
  el.replaceChildren(); if (!H.ok('latest')) { el.textContent = '—'; return; }
  const parts = [['ncd_share', 'Non-communicable', dash.colors[0]], ['comm_share', 'Communicable, maternal & nutritional', dash.colors[2]], ['injury_share', 'Injuries', dash.colors[3]]];
  const codes = [...new Set([H.s.country, H.s.cmp, 'WLD'])];
  const rows = codes.map((code) => ({code, name: (H.countries().get(code) || [code])[0], v: parts.map(([ind]) => H.num((H.row(code, ind) || {}).value))}));
  const W = el.clientWidth || 360, bh = 34, left = 120, right = 12;
  const x = d3.scaleLinear().domain([0, 100]).range([left, W - right]);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', rows.length * (bh + 10) + 10).attr('role', 'img').attr('aria-label', 'Share of deaths by broad cause');
  const tip = H.tip(el);
  rows.forEach((r, i) => {
    const yy = 6 + i * (bh + 10); let acc = 0;
    svg.append('text').attr('x', left - 8).attr('y', yy + bh / 2).attr('dy', '.35em').attr('text-anchor', 'end').text(r.name);
    parts.forEach(([ind, lab, col], k) => {
      const v = r.v[k]; if (v == null) return;
      const rect = svg.append('rect').attr('x', x(acc)).attr('y', yy).attr('width', Math.max(0, x(acc + v) - x(acc))).attr('height', bh).style('fill', col);
      if (x(acc + v) - x(acc) > 34) svg.append('text').attr('x', x(acc) + 4).attr('y', yy + bh / 2).attr('dy', '.35em').style('fill', 'var(--color-bg)').text(Math.round(v) + '%');
      rect.on('pointermove', (ev) => { const [px, py] = d3.pointer(ev, el); tip.textContent = `${r.name} · ${lab}: ${H.fmt(v)}% of deaths`; H.place(el, tip, px, py); }).on('pointerleave', () => { tip.hidden = true; });
      acc += v;
    });
  });
  const leg = document.createElement('div'); leg.className = 'legend';
  parts.forEach(([, l, col]) => { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = col; sp.append(i, l); leg.appendChild(sp); });
  el.appendChild(leg);
});
dash.draw('risks', (el) => {
  el.replaceChildren(); if (!H.ok('latest', 'catalog')) { el.textContent = '—'; return; }
  const cat = H.cat(); const inds = ['obesity', 'obesity_child', 'hypertension', 'inactivity', 'tobacco', 'diabetes', 'pm25'].map((i) => cat.get(i)).filter(Boolean);
  const who = [[H.s.country, dash.colors[0]], [H.s.cmp, 'var(--cds-chart-status-critical)'], ['WLD', 'var(--cds-chart-reference)']];
  const W = el.clientWidth || 360, left = 130, right = 44, bh = 9, gap = 14, rowH = bh * 3 + gap + 14;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', inds.length * rowH).attr('role', 'img').attr('aria-label', 'Risk factors compared');
  const tip = H.tip(el); const names = H.countries();
  inds.forEach((c, i) => {
    const vals = who.map(([code]) => H.val(H.row(code, c.indicator), c));
    const x = d3.scaleLinear().domain([0, (d3.max(vals) || 1) * 1.05]).range([left, W - right]);
    const y0 = i * rowH;
    svg.append('text').attr('x', 0).attr('y', y0 + 12).style('fill', 'var(--color-fg)').text(c.name.replace(/ \(.*\)/, '') + H.sexWord(c));
    who.forEach(([code, col], k) => {
      const v = vals[k]; const yy = y0 + 16 + k * bh;
      if (v == null) return;
      const rect = svg.append('rect').attr('x', left).attr('y', yy).attr('height', bh - 2).attr('width', Math.max(0, x(v) - left)).style('fill', col);
      svg.append('text').attr('x', x(v) + 4).attr('y', yy + bh / 2).attr('dy', '.3em').style('font-size', '10.5px').text(H.fmtI(v, c));
      svg.append('text').attr('x', left - 6).attr('y', yy + bh / 2).attr('dy', '.3em').attr('text-anchor', 'end').style('font-size', '10.5px').text((names.get(code) || [code])[0]);
      rect.on('pointermove', (ev) => { const [px, py] = d3.pointer(ev, el); tip.textContent = `${(names.get(code) || [code])[0]}: ${H.fmtI(v, c)} ${c.unit}`; H.place(el, tip, px, py); }).on('pointerleave', () => { tip.hidden = true; });
    });
  });
});
dash.draw('score', (tb) => {
  tb.replaceChildren(); if (!H.ok('latest', 'catalog')) return;
  const ranks = dash.data('ranks'); const rk = ranks.status === 'ok' && ranks.data ? ranks.data : [];
  d3.groups([...H.cat().values()], (c) => c.category).forEach(([g, list]) => {
    const gr = document.createElement('tr'); gr.className = 'grp'; const gd = document.createElement('td'); gd.colSpan = 7; gd.textContent = g; gr.appendChild(gd); tb.appendChild(gr);
    list.forEach((c) => {
      const tr = document.createElement('tr');
      const cell = (txt, cls) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = txt; tr.appendChild(td); return td; };
      const nm = cell(c.name + H.sexWord(c) + ' (' + c.unit + ')'); nm.style.cursor = 'pointer'; nm.onclick = () => { H.s.ind = c.indicator; H.redraw(); H.go('explorer'); };
      const r1 = H.row(H.s.country, c.indicator), r2 = H.row(H.s.cmp, c.indicator), rw = H.row('WLD', c.indicator);
      [[r1, H.s.country], [r2, H.s.cmp], [rw, 'WLD']].forEach(([r, code]) => { const td = cell(H.fmtI(H.val(r, c), c), 'n'); if (r && H.val(r, c) != null) H.mark(td, code, c.indicator, c); });
      const rr = rk.find((x) => x.code === H.s.country && x.indicator === c.indicator);
      const rtd = cell(rr ? `${rr.rank} of ${rr.of}` : '—', 'n');
      if (rr) { rtd.setAttribute('data-source', 'ranks'); rtd.setAttribute('data-field', 'rank'); rtd.setAttribute('data-where', H.where(H.s.country, c.indicator)); }
      const st = H.status(H.val(r1, c), H.val(rw, c), c.better);
      const std = document.createElement('td'); const dot = document.createElement('span'); dot.className = 'dot';
      dot.style.background = c.better === 'none' || H.val(r1, c) == null ? 'var(--cds-chart-muted)' : st < -0.05 ? 'var(--cds-chart-status-critical)' : st > 0.05 ? dash.colors[0] : 'var(--cds-chart-status-warning)';
      std.append(dot, c.better === 'none' ? 'n/a' : H.val(r1, c) == null ? 'no data' : st < -0.05 ? 'Worse' : st > 0.05 ? 'Better' : 'Similar'); tr.appendChild(std);
      cell(r1 ? r1.year : '—');
      tb.appendChild(tr);
    });
  });
});
})();
(function(){
const H = window.HD;
// Relationships scatter
dash.draw('xsel', (sel) => { if (!H.ok('catalog')) return; H.catOptions(sel, H.s.x, (v) => { H.s.x = v; dash.draw('scatter'); }); });
dash.draw('ysel', (sel) => { if (!H.ok('catalog')) return; H.catOptions(sel, H.s.y, (v) => { H.s.y = v; dash.draw('scatter'); }); });
dash.draw('scatter', (el) => {
  el.replaceChildren(); if (!H.ok('latest', 'catalog')) { el.textContent = '—'; return; }
  const cat = H.cat(), cx = cat.get(H.s.x), cy = cat.get(H.s.y); if (!cx || !cy) { el.textContent = '—'; return; }
  const lat = dash.data('latest').data;
  const codes = [...new Set(lat.filter((r) => H.inView(r) || r.group === 'Aggregate').map((r) => r.code))];
  const pts = codes.map((code) => { const a = H.row(code, cx.indicator), b = H.row(code, cy.indicator), p = H.row(code, 'population'); return {code, country: (a || b || {}).country, group: (a || b || {}).group, x: H.val(a, cx), y: H.val(b, cy), pop: p ? +p.value : null}; }).filter((p) => p.x != null && p.y != null && (!H.isLog(cx.indicator) || p.x > 0) && (!H.isLog(cy.indicator) || p.y > 0));
  const W = el.clientWidth || 360, Hh = 340, m = {t: 12, r: 20, b: 40, l: 56};
  const mk = (id, dom, rng) => (H.isLog(id) ? d3.scaleLog() : d3.scaleLinear()).domain(dom).nice().range(rng);
  const x = mk(cx.indicator, d3.extent(pts, (p) => p.x), [m.l, W - m.r]), y = mk(cy.indicator, d3.extent(pts, (p) => p.y), [Hh - m.b, m.t]);
  const rs = d3.scaleSqrt().domain([0, d3.max(pts.filter((p) => p.group !== 'Aggregate'), (p) => p.pop) || 1]).range([3, 18]);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', Hh).attr('role', 'img').attr('aria-label', `${cy.name} against ${cx.name}`);
  svg.append('g').attr('transform', `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).ticks(Math.min(6, W / 80), '~s')).call((g) => g.selectAll('line,path').style('stroke', 'var(--cds-chart-axis)'));
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6, '~s')).call((g) => g.selectAll('line,path').style('stroke', 'var(--cds-chart-axis)'));
  svg.append('text').attr('x', W - m.r).attr('y', Hh - 6).attr('text-anchor', 'end').text(cx.name + H.sexWord(cx) + ' (' + cx.unit + ')');
  svg.append('text').attr('x', m.l).attr('y', 10).text(cy.name + H.sexWord(cy) + ' (' + cy.unit + ')').attr('dx', 4);
  const col = (p) => p.group === 'Aggregate' ? 'var(--cds-chart-status-critical)' : p.group === 'Global benchmark' ? 'var(--cds-chart-muted)' : dash.colors[H.MENA.indexOf(p.group)];
  const g = svg.selectAll('g.p').data(pts.sort((a, b) => (b.pop || 0) - (a.pop || 0))).join('g').attr('class', 'p').attr('transform', (p) => `translate(${x(p.x)},${y(p.y)})`).style('cursor', 'pointer');
  g.append('circle').attr('r', (p) => (p.group === 'Aggregate' ? 5 : rs(p.pop || 0))).style('fill', col).style('fill-opacity', 0.6).style('stroke', col);
  g.append('text').attr('x', (p) => (p.group === 'Aggregate' ? 7 : rs(p.pop || 0) + 3)).attr('dy', '.35em').text((p) => (p.code === 'REG' ? 'Region' : p.code === 'WLD' ? 'World' : p.code));
  const leg = document.createElement('div'); leg.className = 'legend';
  [['GCC', dash.colors[0]], ['Levant & Iraq', dash.colors[1]], ['North Africa', dash.colors[2]], ['Regional / world average', 'var(--cds-chart-status-critical)']].forEach(([l, c]) => { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = c; sp.append(i, l); leg.appendChild(sp); });
  el.appendChild(leg);
  const tip = H.tip(el);
  g.on('pointermove', (ev, p) => { const [px, py] = d3.pointer(ev, el); tip.textContent = `${p.country}: ${H.fmtI(p.x, cx)} ${cx.unit} · ${H.fmtI(p.y, cy)} ${cy.unit}`; H.place(el, tip, px, py); })
   .on('pointerleave', () => { tip.hidden = true; })
   .on('click', (ev, p) => { if (p.group === 'Aggregate' || p.group === 'Global benchmark') return; H.s.country = p.code; H.redraw(); H.go('profile'); });
});
})();
(function(){
const H = window.HD;
dash.draw('platformRows', (tb) => {
  const d = dash.data('platforms'); tb.replaceChildren(); if (d.status !== 'ok') return;
  const cols = ['platform', 'home_market', 'category', 'data_assets', 'how_buyers_access', 'revenue_model', 'lesson_for_mena'];
  d.data.forEach((r) => { const tr = document.createElement('tr'); cols.forEach((c) => { const td = document.createElement('td'); td.textContent = r[c] || ''; tr.appendChild(td); }); tb.appendChild(tr); });
});
})();
