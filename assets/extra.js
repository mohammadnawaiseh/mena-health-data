(function(){
// Map, key findings, clinical trials and analysis presets
const H = window.HD;
H.s.mapInd = 'diabetes';
H.names.push('map', 'mapsel', 'fval', 'trbar', 'trpm', 'trrows', 'trmeta');

dash.calc('findings', {
  inputs: ['latest', 'catalog'],
  title: 'Key findings',
  description: 'For each headline indicator, the worst-placed of the 14 MENA countries (highest where lower is better, lowest where higher is better), its value and its ratio to the world average. Both sexes.',
  fn: (latest, catalog) => {
    const ids = ['diabetes', 'obesity', 'hyp_control', 'oop', 'inactivity', 'tobacco', 'physicians', 'cvd_rate'];
    return ids.map((id) => {
      const c = catalog.find((x) => x.indicator === id) || {};
      const rows = latest.filter((r) => r.indicator === id && !['Aggregate', 'Global benchmark'].includes(r.group) && r.value !== '' && r.value != null);
      const worst = rows.reduce((a, b) => (c.better === 'higher' ? (+b.value < +a.value ? b : a) : (+b.value > +a.value ? b : a)), rows[0] || {});
      const w = latest.find((r) => r.indicator === id && r.code === 'WLD');
      return {indicator: id, country: worst.country, code: worst.code, value: +worst.value, world: w ? +w.value : null, ratio: w ? Math.round(+worst.value / +w.value * 10) / 10 : null, year: worst.year};
    });
  }
});

dash.calc('trials_pm', {
  inputs: ['trials_live', 'latest'],
  title: 'Trials per million people',
  description: 'Active trials (recruiting or not yet recruiting) and cardiometabolic trials per million population, using World Bank 2024 population.',
  fn: (trials, latest) => trials.map((t) => {
    const p = latest.find((r) => r.indicator === 'population' && r.code === t.code);
    const m = p ? +p.value / 1e6 : null;
    return {code: t.code, country: t.country, group: t.group, active_per_million: m ? Math.round(+t.active_trials / m * 10) / 10 : null, cardiometabolic_per_million: m ? Math.round(+t.cardiometabolic_trials / m * 10) / 10 : null};
  })
});

dash.loader('live_trials', {
  description: 'Turns the ClinicalTrials.gov search answer into one row per trial; the total number of matching trials goes into meta.',
  fn: ({answer}) => {
    if (!answer || !Array.isArray(answer.items)) throw new Error((answer && (answer.error || answer.message)) || 'No trial list in the answer');
    const data = answer.items.map((t) => ({
      nct_id: t.nct_id, title: t.title, status: t.status, phase: (t.phase || []).join(', ') || 'n/a',
      conditions: (t.conditions || []).slice(0, 3).join('; '), sponsor: t.sponsor || '', enrollment: t.enrollment == null ? null : Number(t.enrollment),
      start_date: t.start_date || '', study_type: t.study_type || ''
    }));
    return {data, columns: ['nct_id', 'title', 'status', 'phase', 'conditions', 'sponsor', 'enrollment', 'start_date', 'study_type'], cut: (answer.total || 0) > data.length,
      meta: [{label: 'Total matching trials', value: String(answer.total ?? data.length)}]};
  }
});

// ---------- Key findings ----------
dash.draw('fval', (el) => {
  const d = dash.data('findings');
  const r = d.status === 'ok' && d.data ? d.data.find((x) => x.indicator === el.dataset.ind) : null;
  const c = H.cat().get(el.dataset.ind);
  const part = el.dataset.part;
  if (!r) { el.textContent = '—'; return; }
  el.textContent = part === 'country' ? r.country : part === 'ratio' ? d3.format('.1f')(r.ratio) : H.fmtI(r[part], c);
});
document.querySelectorAll('.hd .finding').forEach((card) => card.addEventListener('click', () => {
  const d = dash.data('findings'); const r = d.status === 'ok' && d.data ? d.data.find((x) => x.indicator === card.dataset.ind) : null;
  H.s.ind = card.dataset.ind; if (r) H.s.country = r.code; H.redraw(); H.go('explorer');
}));

// ---------- Map ----------
dash.draw('mapsel', (sel) => { if (!H.ok('catalog')) return; H.catOptions(sel, H.s.mapInd, (v) => { H.s.mapInd = v; dash.draw('map'); }); });
dash.draw('map', (el) => {
  el.replaceChildren();
  const g = dash.data('geo');
  if (!H.ok('latest', 'catalog') || g.status !== 'ok' || !g.data || !g.data.features) { el.textContent = g.status === 'error' ? 'Failed to load' : '—'; return; }
  const ind = el.dataset.use === 'ind' ? H.s.ind : H.s.mapInd;
  const c = H.cat().get(ind); if (!c) { el.textContent = '—'; return; }
  const feats = g.data.features;
  const mena = feats.filter((f) => f.properties.code);
  const W = el.clientWidth || 640, Hh = Math.max(260, Math.round(W * 0.46));
  const proj = d3.geoMercator().fitExtent([[6, 6], [W - 6, Hh - 34]], {type: 'FeatureCollection', features: mena});
  const path = d3.geoPath(proj);
  const val = (code) => H.val(H.row(code, ind), c);
  const inGrp = (f) => { const r = H.row(f.properties.code, ind); return r && (!H.s.grp || r.group === H.s.grp); };
  const vals = mena.filter(inGrp).map((f) => val(f.properties.code)).filter((v) => v != null);
  const ext = d3.extent(vals);
  const t = (v) => (ext[1] > ext[0] ? (v - ext[0]) / (ext[1] - ext[0]) : 0.5);
  const fillFor = (v) => `color-mix(in srgb, ${dash.colors[0]} ${Math.round(12 + t(v) * 83)}%, var(--color-panel))`;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', Hh).attr('viewBox', `0 0 ${W} ${Hh}`).attr('role', 'img').attr('aria-label', `Map of ${c.name} across MENA`).style('overflow', 'hidden');
  svg.append('rect').attr('width', W).attr('height', Hh).style('fill', 'color-mix(in srgb, ' + dash.colors[0] + ' 5%, var(--color-panel))');
  svg.append('g').selectAll('path').data(feats.filter((f) => !f.properties.code)).join('path').attr('d', path).style('fill', 'color-mix(in srgb, var(--cds-chart-grid) 70%, var(--color-panel))').style('stroke', 'var(--color-panel)').style('stroke-width', 0.8);
  const tip = H.tip(el);
  const show = (ev, f) => { const [px, py] = d3.pointer(ev, el); const r = H.row(f.properties.code, ind); const v = val(f.properties.code); tip.textContent = `${r ? r.country : f.properties.name}: ${v == null ? 'no data' : H.fmtI(v, c) + ' ' + c.unit}${H.sexWord(c)}${r ? ' (' + r.year + ')' : ''}`; H.place(el, tip, px, py); };
  const go = (ev, f) => { H.s.country = f.properties.code; H.redraw(); H.go('profile'); };
  const shapes = svg.append('g').selectAll('path').data(mena).join('path').attr('d', path)
    .style('fill', (f) => { const v = val(f.properties.code); return !inGrp(f) || v == null ? 'var(--cds-chart-grid)' : fillFor(v); })
    .style('stroke', 'var(--color-fg-muted)').style('stroke-width', 0.7).style('cursor', 'pointer')
    .on('pointermove', show).on('pointerleave', () => { tip.hidden = true; }).on('click', go);
  // small states get a marker so they can be seen and clicked
  const small = mena.filter((f) => ['BHR', 'QAT', 'LBN', 'KWT'].includes(f.properties.code));
  svg.append('g').selectAll('circle').data(small).join('circle').attr('cx', (f) => path.centroid(f)[0]).attr('cy', (f) => path.centroid(f)[1]).attr('r', 5)
    .style('fill', (f) => { const v = val(f.properties.code); return !inGrp(f) || v == null ? 'var(--cds-chart-grid)' : fillFor(v); }).style('stroke', 'var(--color-fg)').style('stroke-width', 0.8).style('cursor', 'pointer')
    .on('pointermove', show).on('pointerleave', () => { tip.hidden = true; }).on('click', go);
  svg.append('g').selectAll('text').data(mena.filter((f) => !['BHR', 'QAT', 'LBN', 'KWT'].includes(f.properties.code) && inGrp(f))).join('text')
    .attr('x', (f) => path.centroid(f)[0]).attr('y', (f) => path.centroid(f)[1]).attr('text-anchor', 'middle').attr('dy', '.35em').style('pointer-events', 'none').style('font-size', '11px').style('font-weight', 600).style('paint-order', 'stroke').style('stroke', (f) => { const v = val(f.properties.code); return v != null && t(v) > 0.55 ? 'none' : 'var(--color-panel)'; }).style('stroke-width', 3)
    .style('fill', (f) => { const v = val(f.properties.code); return v != null && t(v) > 0.55 ? 'var(--color-bg)' : 'var(--color-fg)'; })
    .text((f) => H.fmtI(val(f.properties.code), c));
  // legend
  if (vals.length) {
    const lg = svg.append('g').attr('transform', `translate(8,${Hh - 22})`); const steps = 5, bw = 34;
    d3.range(steps).forEach((i) => { const v = ext[0] + (ext[1] - ext[0]) * i / (steps - 1); lg.append('rect').attr('x', i * bw).attr('width', bw).attr('height', 8).style('fill', fillFor(v)); });
    lg.append('text').attr('x', 0).attr('y', 20).text(H.fmtI(ext[0], c));
    lg.append('text').attr('x', steps * bw).attr('y', 20).attr('text-anchor', 'end').text(H.fmtI(ext[1], c));
    lg.append('text').attr('x', steps * bw + 10).attr('y', 8).text(`${c.name}${H.sexWord(c)} · ${c.unit}`);
  }
});

// ---------- Clinical trials ----------
H.hbars = (el, rows, parts, opt) => {
  el.replaceChildren();
  const W = el.clientWidth || 360, bh = 22, top = 4;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', rows.length * bh + top + 20).attr('role', 'img').attr('aria-label', opt.label);
  const tmp = svg.append('g'); const labW = d3.max(rows, (d) => { const tt = tmp.append('text').text(d.country); const w = tt.node().getComputedTextLength(); tt.remove(); return w; }) || 60; tmp.remove();
  const left = labW + 8, right = 56;
  const x = d3.scaleLinear().domain([0, (d3.max(rows, (d) => d3.sum(parts, (p) => +d[p[0]] || 0)) || 1) * 1.02]).range([left, Math.max(left + 40, W - right)]);
  const tip = H.tip(el);
  rows.forEach((d, i) => {
    const y = top + i * bh; let acc = 0;
    svg.append('text').attr('x', left - 6).attr('y', y + bh / 2).attr('dy', '.35em').attr('text-anchor', 'end').text(d.country);
    parts.forEach(([f, lab, col]) => {
      const v = +d[f] || 0;
      svg.append('rect').attr('x', x(acc)).attr('y', y + 3).attr('height', bh - 6).attr('width', Math.max(0, x(acc + v) - x(acc))).style('fill', col)
        .on('pointermove', (ev) => { const [px, py] = d3.pointer(ev, el); tip.textContent = `${d.country} · ${lab}: ${d3.format(',')(v)}`; H.place(el, tip, px, py); }).on('pointerleave', () => { tip.hidden = true; });
      acc += v;
    });
    svg.append('text').attr('x', x(acc) + 4).attr('y', y + bh / 2).attr('dy', '.35em').text(d3.format(',.' + (opt.dec || 0) + 'f')(acc));
  });
  if (parts.length > 1) { const leg = document.createElement('div'); leg.className = 'legend'; parts.forEach(([, l, col]) => { const sp = document.createElement('span'); const ii = document.createElement('i'); ii.style.background = col; sp.append(ii, l); leg.appendChild(sp); }); el.appendChild(leg); }
};
dash.draw('trbar', (el) => {
  const d = dash.data('trials_live'); if (d.status !== 'ok') { el.textContent = d.status === 'error' ? 'Failed to load' : '—'; return; }
  const rows = d.data.filter((r) => !H.s.grp || r.group === H.s.grp).slice().sort((a, b) => +b.active_trials - +a.active_trials);
  H.hbars(el, rows, [['cardiometabolic_trials', 'Cardiometabolic', dash.colors[0]], ['other_trials', 'Other conditions', 'var(--cds-chart-muted)']], {label: 'Active clinical trials by country'});
});
dash.draw('trpm', (el) => {
  const d = dash.data('trials_pm'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
  const rows = d.data.filter((r) => !H.s.grp || r.group === H.s.grp).slice().sort((a, b) => b.active_per_million - a.active_per_million);
  H.hbars(el, rows, [['active_per_million', 'Active trials per million', dash.colors[1]]], {label: 'Active trials per million people', dec: 1});
});
dash.draw('trmeta', (el) => {
  const d = dash.data('live_trials');
  if (d.status === 'ok') { const m = (d.meta || []).find((x) => x.label === 'Total matching trials'); el.textContent = `${m ? m.value : d.data.length} matching trials on ClinicalTrials.gov right now; the ${d.data.length} most relevant are listed.`; }
  else el.textContent = d.status === 'loading' ? 'Searching ClinicalTrials.gov…' : d.status === 'connect' ? 'Connect the Clinical Trials connector to see live results.' : d.status === 'error' ? 'The live search failed to load.' : '—';
});
dash.draw('trrows', (tb) => {
  const d = dash.data('live_trials'); tb.replaceChildren(); if (d.status !== 'ok') return;
  d.data.forEach((r) => {
    const tr = document.createElement('tr'); tr.setAttribute('data-key', r.nct_id);
    ['nct_id', 'title', 'status', 'phase', 'conditions', 'sponsor', 'enrollment', 'start_date'].forEach((c) => { const td = document.createElement('td'); if (c === 'enrollment') td.className = 'n'; td.textContent = c === 'enrollment' ? (r[c] == null ? '—' : d3.format(',')(r[c])) : (r[c] || ''); tr.appendChild(td); });
    tb.appendChild(tr);
  });
});
document.querySelectorAll('.hd #trcountry, .hd #trcond').forEach((s) => s.addEventListener('change', () => {
  const p = {}; document.querySelectorAll('.hd #trcountry').forEach((x) => { p.country = x.value; }); document.querySelectorAll('.hd #trcond').forEach((x) => { p.condition = x.value; }); dash.setParams(p);
}));

// ---------- Analysis presets ----------
document.querySelectorAll('.hd #presets .chip').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.hd #presets .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  H.s.x = b.dataset.x; H.s.y = b.dataset.y; ['xsel', 'ysel', 'scatter'].forEach((n) => dash.draw(n));
}));

// ---------- Design layer: KPI deltas and bullets, heat legend, refined bars and map ----------
H.names.push('kpid', 'kpib', 'heatleg');
dash.calc('kpi_delta', {
  inputs: ['latest', 'catalog'],
  title: 'Headline tiles vs world',
  description: 'Regional average minus world average for each headline tile indicator (both sexes), and whether that is better or worse given the indicator direction.',
  fn: (latest, catalog) => ['diabetes', 'obesity', 'hypertension', 'inactivity', 'ncd_3070', 'uhc', 'oop', 'hale'].map((id) => {
    const c = catalog.find((x) => x.indicator === id) || {};
    const r = latest.find((x) => x.indicator === id && x.code === 'REG'), w = latest.find((x) => x.indicator === id && x.code === 'WLD');
    const diff = r && w ? Math.round((+r.value - +w.value) * 10) / 10 : null;
    return {indicator: id, region: r ? +r.value : null, world: w ? +w.value : null, diff, status: diff == null || c.better === 'none' ? 'neutral' : (c.better === 'lower' ? diff > 0 : diff < 0) ? 'worse' : 'better'};
  })
});
dash.draw('kpid', (el) => {
  const d = dash.data('kpi_delta'); const r = d.status === 'ok' && d.data ? d.data.find((x) => x.indicator === el.dataset.ind) : null;
  if (!r || r.diff == null) { el.textContent = '—'; return; }
  el.textContent = (r.diff > 0 ? '+' : r.diff < 0 ? '−' : '') + d3.format('.1f')(Math.abs(r.diff));
  const col = r.status === 'worse' ? 'var(--cds-chart-status-critical)' : r.status === 'better' ? dash.colors[0] : 'var(--color-fg-muted)';
  el.style.color = col; el.style.background = `color-mix(in srgb, ${col} 12%, transparent)`;
});
dash.draw('kpib', (el) => {
  el.replaceChildren(); if (!H.ok('latest')) return;
  const ind = el.dataset.ind, reg = H.row('REG', ind), wld = H.row('WLD', ind);
  const rows = dash.data('latest').data.filter((r) => r.indicator === ind && !['Aggregate', 'Global benchmark'].includes(r.group) && H.num(r.value) != null);
  const vals = rows.map((r) => +r.value); if (!vals.length) return;
  const W = el.clientWidth || 180, all = [...vals, ...(reg ? [+reg.value] : []), ...(wld ? [+wld.value] : [])], lo = d3.min(all), hi = d3.max(all), pad = (hi - lo) * 0.08 || 1, x = d3.scaleLinear().domain([lo - pad, hi + pad]).range([2, W - 2]);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', 18).attr('role', 'img').attr('aria-label', 'Range across MENA countries with regional and world averages');
  svg.append('rect').attr('x', x(d3.min(vals))).attr('y', 7).attr('width', Math.max(2, x(d3.max(vals)) - x(d3.min(vals)))).attr('height', 4).attr('rx', 2).style('fill', `color-mix(in srgb, ${dash.colors[0]} 25%, transparent)`);
  svg.selectAll('circle.c').data(vals).join('circle').attr('cx', (v) => x(v)).attr('cy', 9).attr('r', 2).style('fill', `color-mix(in srgb, ${dash.colors[0]} 55%, transparent)`);
  if (wld) svg.append('line').attr('x1', x(+wld.value)).attr('x2', x(+wld.value)).attr('y1', 1).attr('y2', 17).style('stroke', 'var(--color-fg)').style('stroke-width', 2);
  if (reg) svg.append('circle').attr('cx', x(+reg.value)).attr('cy', 9).attr('r', 5).style('fill', dash.colors[0]).style('stroke', 'var(--color-panel)').style('stroke-width', 1.5);
});
dash.draw('heatleg', (el) => {
  el.replaceChildren();
  [['Worse than world', 'var(--cds-chart-status-critical)'], ['Better than world', dash.colors[0]], ['No good/bad direction or world value', 'transparent']].forEach(([l, c], i) => {
    const sp = document.createElement('span'); const ii = document.createElement('i'); ii.style.background = i < 2 ? `color-mix(in srgb, ${c} 45%, transparent)` : 'none'; ii.style.border = '1px solid var(--color-border-line)'; sp.append(ii, l); el.appendChild(sp);
  });
});

// Refined ranked bar chart (replaces the earlier style for every ranked chart)
H.bar = (el, ind, compact) => {
  el.replaceChildren();
  if (!H.ok('latest', 'catalog')) { el.textContent = dash.data('latest').status === 'error' ? 'Failed to load' : '—'; return; }
  const c = H.cat().get(ind); if (!c) { el.textContent = '—'; return; }
  const all = dash.data('latest').data.filter((r) => r.indicator === ind);
  const data = all.filter(H.inView).filter((r) => H.val(r, c) != null).sort((a, b) => H.val(b, c) - H.val(a, c));
  const reg = all.find((r) => r.code === 'REG'), wld = all.find((r) => r.code === 'WLD');
  const W = el.clientWidth || 360, bh = compact ? 19 : 24, head = compact ? 46 : 26, bottom = 6;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', data.length * bh + head + bottom).attr('role', 'img').attr('aria-label', c.name + ' by country');
  if (compact) {
    svg.append('text').attr('x', 0).attr('y', 14).style('fill', 'var(--color-fg)').style('font-weight', 600).style('font-size', '13px').text(c.name + H.sexWord(c));
    svg.append('text').attr('x', 0).attr('y', 30).style('font-size', '11px').text(c.unit + ' · ' + c.source + ' · click to explore');
  }
  const tmp = svg.append('g'); const labW = d3.max(data, (d) => { const t = tmp.append('text').text(d.country); const w = t.node().getComputedTextLength(); t.remove(); return w; }) || 60; tmp.remove();
  const left = labW + 10, right = 44;
  const vals = [...data.map((d) => H.val(d, c)), H.val(reg, c) || 0, H.val(wld, c) || 0];
  const x = d3.scaleLinear().domain([0, (d3.max(vals) || 1) * 1.04]).range([left, Math.max(left + 40, W - right)]);
  const y0 = head;
  svg.append('g').selectAll('line').data(x.ticks(4)).join('line').attr('x1', (v) => x(v)).attr('x2', (v) => x(v)).attr('y1', y0 - 4).attr('y2', y0 + data.length * bh).style('stroke', 'var(--cds-chart-grid)');
  const g = svg.selectAll('g.b').data(data).join('g').attr('class', 'b').attr('transform', (d, i) => `translate(0,${y0 + i * bh})`).style('cursor', 'pointer');
  g.append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', bh).style('fill', 'transparent');
  g.append('text').attr('x', left - 8).attr('y', bh / 2).attr('dy', '.35em').attr('text-anchor', 'end').style('fill', (d) => (d.code === H.s.country ? 'var(--color-fg)' : null)).style('font-weight', (d) => (d.code === H.s.country ? 600 : null)).text((d) => d.country);
  g.append('rect').attr('x', left).attr('y', (bh - (compact ? 10 : 13)) / 2).attr('height', compact ? 10 : 13).attr('rx', 3).attr('width', (d) => Math.max(1, x(H.val(d, c)) - left))
    .style('fill', (d) => (d.group === 'Global benchmark' ? 'var(--cds-chart-muted)' : d.code === H.s.country ? dash.colors[1] : `color-mix(in srgb, ${dash.colors[0]} 78%, var(--color-panel))`));
  g.append('text').attr('x', (d) => x(H.val(d, c)) + 5).attr('y', bh / 2).attr('dy', '.35em').style('font-variant-numeric', 'tabular-nums').style('fill', 'var(--color-fg)').text((d) => H.fmtI(H.val(d, c), c));
  const refs = [[reg, 'MENA avg', 'var(--cds-chart-status-critical)'], [wld, 'World', 'var(--color-fg)']].map(([r, lab, col]) => [H.val(r, c), lab, col]).filter(([v]) => v != null).sort((a, b) => a[0] - b[0]);
  refs.forEach(([v, lab, col], k) => {
    const xv = x(v), close = refs.length === 2 && Math.abs(x(refs[0][0]) - x(refs[1][0])) < 90;
    svg.append('line').attr('x1', xv).attr('x2', xv).attr('y1', y0 - 6).attr('y2', y0 + data.length * bh).style('stroke', col).style('stroke-dasharray', '3 3').style('stroke-width', 1.2);
    svg.append('text').attr('class', 'ref').attr('x', xv + (close && k === 0 ? -3 : 3)).attr('y', y0 - 9).attr('text-anchor', close && k === 0 ? 'end' : 'start').style('fill', col).style('font-weight', 600).text(`${lab} ${H.fmtI(v, c)}`);
  });
  const tip = H.tip(el);
  g.on('pointermove', (ev, d) => { const [px, py] = d3.pointer(ev, el); tip.textContent = `${d.country}: ${H.fmtI(H.val(d, c), c)} ${c.unit} (${d.year})`; H.place(el, tip, px, py); })
   .on('pointerleave', () => { tip.hidden = true; })
   .on('click', (ev, d) => { ev.stopPropagation(); if (d.group === 'Global benchmark') return; H.s.country = d.code; H.redraw(); H.go('profile'); });
};

})();
