(function(){
// Trends: five-year change on indicator tiles, research output over time, and the most-researched areas
const H = window.HD;
H.names.push('kpitr', 'wktr', 'evtrend', 'evtrsum', 'evfocus', 'evcfocus');

dash.calc('trend5', {
  inputs: ['series', 'catalog'],
  title: 'Five-year change',
  description: 'For each country and each indicator that has a yearly series: the latest value minus the value five years earlier (or the nearest earlier year, at least three years back), and whether that change is an improvement given the indicator\'s direction.',
  fn: (series, catalog) => {
    const dir = new Map(catalog.map((c) => [c.indicator, c.better]));
    const by = new Map();
    series.forEach((r) => { if (r.value === '' || r.value == null) return; const k = r.code + '|' + r.indicator; if (!by.has(k)) by.set(k, []); by.get(k).push({y: +r.year, v: +r.value, country: r.country, group: r.group}); });
    const out = [];
    by.forEach((pts, k) => {
      pts.sort((a, b) => a.y - b.y); const last = pts[pts.length - 1];
      const base = pts.filter((p) => p.y <= last.y - 3 && p.y >= last.y - 7).sort((a, b) => Math.abs(a.y - (last.y - 5)) - Math.abs(b.y - (last.y - 5)))[0];
      if (!base) return;
      const [code, indicator] = k.split('|'); const change = Math.round((last.v - base.v) * 10) / 10; const b = dir.get(indicator);
      out.push({code, country: last.country, group: last.group, indicator, from_year: base.y, to_year: last.y, from_value: base.v, to_value: last.v, change, change_pct: base.v ? Math.round((last.v - base.v) / Math.abs(base.v) * 1000) / 10 : null,
        direction: change === 0 ? 'flat' : !b || b === 'none' ? 'no direction' : (b === 'lower' ? change < 0 : change > 0) ? 'improving' : 'worsening'});
    });
    return out;
  }
});

H.trendLine = (el, code, ind) => {
  el.replaceChildren(); el.style.color = '';
  const d = dash.data('trend5'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
  const r = d.data.find((x) => x.code === code && x.indicator === ind);
  if (!r) { el.textContent = 'No yearly series for a trend'; return; }
  const c = H.cat().get(ind); const money = ['he_pc', 'gdp_pc'].includes(ind);
  const col = r.direction === 'worsening' ? 'var(--cds-chart-status-critical)' : r.direction === 'improving' ? dash.colors[0] : 'var(--color-fg-muted)';
  const b = document.createElement('b'); b.style.color = col;
  b.textContent = (r.change > 0 ? '▲ +' : r.change < 0 ? '▼ −' : '● ') + (money ? Math.abs(r.change_pct) + '%' : H.fmtI(Math.abs(r.change), c));
  b.setAttribute('data-source', 'trend5'); b.setAttribute('data-field', money ? 'change_pct' : 'change'); b.setAttribute('data-where', `code=${code}&indicator=${ind}`);
  el.append(b, ` since ${r.from_year}` + (r.direction === 'no direction' ? '' : ` · ${r.direction}`));
};
dash.draw('kpitr', (el) => H.trendLine(el, 'REG', el.closest('.kpi').dataset.ind));
dash.draw('wktr', (el) => { if (el.closest('[hidden]')) return; H.trendLine(el, H.s.country, el.closest('.wtile').querySelector('[data-ind]').dataset.ind); });

// ---------- research trends ----------
dash.calc('resgrowth', {
  inputs: ['restrend'],
  title: 'Research growth by country and topic',
  description: 'OpenAlex papers per year on each stakeholder topic, by author-institution country. Growth = papers in 2025 divided by papers in 2020; yearly growth rate is the compound rate over those five years. "MENA" is all 14 countries together, each paper counted once.',
  fn: (rows) => {
    const out = []; const key = (r) => r.stakeholder + '|' + r.code;
    const g = new Map(); rows.forEach((r) => { if (!g.has(key(r))) g.set(key(r), {}); g.get(key(r))[r.year] = +r.papers; });
    g.forEach((y, k) => { const [stakeholder, code] = k.split('|'); const a = y[2020] || 0, b = y[2025] || 0;
      out.push({stakeholder, code, papers_2016: y[2016] || 0, papers_2020: a, papers_2025: b, times: a ? Math.round(b / a * 10) / 10 : null, yearly_growth_pct: a && b ? Math.round((Math.pow(b / a, 0.2) - 1) * 1000) / 10 : null, peak_year: +Object.keys(y).sort((p, q) => y[q] - y[p])[0]}); });
    return out;
  }
});
const evSh = (el) => el.closest('.shblock').dataset.shb;
dash.draw('evtrsum', (el) => {
  if (el.closest('[hidden]')) return;
  const d = dash.data('resgrowth'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
  const sh = evSh(el); const me = d.data.find((r) => r.stakeholder === sh && r.code === H.s.country), all = d.data.find((r) => r.stakeholder === sh && r.code === 'MENA');
  el.replaceChildren(); if (!all) { el.textContent = '—'; return; }
  const b = (r, f, txt) => { const x = document.createElement('b'); x.textContent = txt; x.setAttribute('data-source', 'resgrowth'); x.setAttribute('data-field', f); x.setAttribute('data-where', `stakeholder=${sh}&code=${r.code}`); return x; };
  const name = (H.countries().get(H.s.country) || ['—'])[0];
  if (me) el.append(`${name}: `, b(me, 'papers_2025', d3.format(',')(me.papers_2025)), ' papers in 2025, ', b(me, 'times', me.times == null ? '—' : me.times + '×'), ' the 2020 level. ');
  el.append('MENA: ', b(all, 'papers_2025', d3.format(',')(all.papers_2025)), ' papers in 2025, ', b(all, 'times', all.times + '×'), ' the 2020 level (', b(all, 'yearly_growth_pct', (all.yearly_growth_pct > 0 ? '+' : '') + all.yearly_growth_pct + '%'), ' a year).');
});
dash.draw('evtrend', (el) => {
  if (el.closest('[hidden]')) return;
  el.replaceChildren(); const d = dash.data('restrend'); if (d.status !== 'ok') { el.textContent = '—'; return; }
  const sh = evSh(el); const rows = d.data.filter((r) => r.stakeholder === sh);
  const top = d3.rollups(rows.filter((r) => r.code !== 'MENA'), (v) => d3.sum(v, (r) => +r.papers), (r) => r.code).sort((a, b) => b[1] - a[1]).slice(0, 4).map((x) => x[0]);
  const codes = [...new Set([H.s.country, ...top])].filter((c) => rows.some((r) => r.code === c)).slice(0, 5);
  const names = H.countries();
  const series = codes.map((code) => ({code, name: (names.get(code) || [code])[0], pts: rows.filter((r) => r.code === code).map((r) => ({y: +r.year, v: +r.papers})).sort((a, b) => a.y - b.y)}));
  const W = el.clientWidth || 420, Hh = 250, m = {t: 10, r: 14, b: 24, l: 44};
  const x = d3.scaleLinear().domain([2016, 2025]).range([m.l, W - m.r]);
  const y = d3.scaleLinear().domain([0, d3.max(series, (s) => d3.max(s.pts, (p) => p.v)) || 1]).nice().range([Hh - m.b, m.t]);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', Hh).attr('role', 'img').attr('aria-label', 'Papers per year by country');
  svg.append('g').attr('transform', `translate(0,${Hh - m.b})`).call(d3.axisBottom(x).ticks(Math.min(10, W / 60)).tickFormat(d3.format('d'))).call((g) => g.selectAll('line,path').style('stroke', 'var(--cds-chart-axis)'));
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.l - m.r)).tickFormat(d3.format(',~f'))).call((g) => { g.select('path').remove(); g.selectAll('line').style('stroke', 'var(--cds-chart-grid)'); });
  let ci = 0; const col = new Map(series.map((s) => [s.code, s.code === H.s.country ? dash.colors[1] : [dash.colors[0], dash.colors[2], dash.colors[3], dash.colors[5], dash.colors[6]][ci++ % 5]]));
  const ln = d3.line().x((p) => x(p.y)).y((p) => y(p.v));
  svg.selectAll('path.s').data(series).join('path').attr('class', 's').attr('d', (s) => ln(s.pts)).style('fill', 'none').style('stroke', (s) => col.get(s.code)).style('stroke-width', (s) => (s.code === H.s.country ? 2.6 : 1.6));
  const leg = document.createElement('div'); leg.className = 'legend';
  series.forEach((s) => { const sp = document.createElement('span'); const i = document.createElement('i'); i.style.background = col.get(s.code); sp.append(i, s.name); leg.appendChild(sp); });
  el.appendChild(leg);
  const tip = H.tip(el); const guide = svg.append('line').attr('y1', m.t).attr('y2', Hh - m.b).style('stroke', 'var(--cds-chart-axis)').style('opacity', 0);
  svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', Math.max(0, W - m.l - m.r)).attr('height', Hh - m.t - m.b).style('fill', 'transparent')
    .on('pointermove', (ev) => { const [px, py] = d3.pointer(ev, el); const yr = Math.max(2016, Math.min(2025, Math.round(x.invert(px)))); guide.attr('x1', x(yr)).attr('x2', x(yr)).style('opacity', 1);
      tip.replaceChildren(); const hb = document.createElement('b'); hb.textContent = yr; tip.appendChild(hb);
      series.map((s) => [s.name, (s.pts.find((p) => p.y === yr) || {}).v || 0]).sort((a, b) => b[1] - a[1]).forEach(([n, v]) => { const dv = document.createElement('div'); dv.textContent = `${n}: ${d3.format(',')(v)} papers`; tip.appendChild(dv); });
      H.place(el, tip, px, py); })
    .on('pointerleave', () => { tip.hidden = true; guide.style('opacity', 0); });
});
// Ranked list with bars: label and count
H.focusBars = (el, rows, src, where, extra) => {
  el.replaceChildren(); if (!rows.length) { el.textContent = '—'; return; }
  const max = d3.max(rows, (r) => r.papers);
  rows.forEach((r) => {
    const row = document.createElement('div'); row.className = 'fb';
    const lab = document.createElement('span'); lab.className = 'fb-l'; lab.textContent = r.label;
    const bar = document.createElement('span'); bar.className = 'fb-b'; const fill = document.createElement('i'); fill.style.width = Math.max(2, r.papers / max * 100) + '%'; fill.style.background = dash.colors[0]; bar.appendChild(fill);
    const val = document.createElement('span'); val.className = 'fb-v'; const b = document.createElement('b'); b.textContent = d3.format(',')(r.papers);
    b.setAttribute('data-source', src); b.setAttribute('data-field', 'papers'); b.setAttribute('data-where', where(r));
    val.append(b, extra ? extra(r) : ''); row.append(lab, bar, val); el.appendChild(row);
  });
};
dash.draw('evfocus', (el) => {
  if (el.closest('[hidden]')) return;
  const d = dash.data('resfocus'); if (d.status !== 'ok') { el.textContent = '—'; return; }
  const sh = evSh(el);
  H.focusBars(el, d.data.filter((r) => r.stakeholder === sh).map((r) => ({label: r.topic, papers: +r.papers, topic: r.topic})).sort((a, b) => b.papers - a.papers).slice(0, 8), 'resfocus', (r) => `stakeholder=${sh}&topic=${encodeURIComponent(r.topic)}`);
});
dash.calc('cfocus_rank', {
  inputs: ['rescountry'],
  title: 'Health research focus by country',
  description: 'OpenAlex health-sciences papers by research area (subfield) and author-institution country: the ten largest areas by papers in 2021–2025, with growth against 2016–2020.',
  fn: (rows) => {
    const out = [];
    d3.groups(rows, (r) => r.code).forEach(([code, v]) => {
      const rec = v.filter((r) => r.period === 'recent'), early = new Map(v.filter((r) => r.period === 'early').map((r) => [r.area, +r.papers]));
      rec.sort((a, b) => +b.papers - +a.papers).forEach((r, i) => { const e = early.get(r.area); out.push({code, area: r.area, rank: i + 1, papers: +r.papers, papers_2016_2020: e || 0, growth_pct: e ? Math.round((+r.papers / e - 1) * 100) : null}); });
    });
    return out;
  }
});
dash.draw('evcfocus', (el) => {
  if (el.closest('[hidden]')) return;
  const d = dash.data('cfocus_rank'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
  const code = d.data.some((r) => r.code === H.s.country) ? H.s.country : 'MENA';
  H.focusBars(el, d.data.filter((r) => r.code === code && r.rank <= 10).map((r) => ({label: r.area, papers: r.papers, growth: r.growth_pct, area: r.area})), 'cfocus_rank', (r) => `code=${code}&area=${encodeURIComponent(r.area)}`, (r) => (r.growth == null ? '' : ` · ${r.growth >= 0 ? '+' : ''}${r.growth}% vs 2016–20`));
});
document.querySelectorAll('.hd [data-dlres]').forEach((b) => b.addEventListener('click', () => {
  const sh = b.closest('.shblock').dataset.shb, k = b.dataset.dlres;
  if (k === 'trend') { const d = dash.data('restrend'); if (d.status === 'ok') H.download(`research_trend_${sh}.csv`, H.csv(d.data.filter((r) => r.stakeholder === sh), ['stakeholder', 'code', 'year', 'papers'])); }
  else { const d = dash.data('cfocus_rank'); if (d.status === 'ok' && d.data) H.download('research_focus_by_country.csv', H.csv(d.data, ['code', 'area', 'rank', 'papers', 'papers_2016_2020', 'growth_pct'])); }
}));

})();
