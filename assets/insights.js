/* MENA Health Data — Insights tab: ranking race, gap-to-target gauges, disease-burden treemap, forecast lines.
   Shared helpers live on HD.X so the Reports tab can reuse them. */
(function () {
const H = window.HD;
const X = H.X = {};
const S = H.ix = {race: {ind: 'obesity', year: null, playing: false, timer: null}, gap: {code: 'ARE'}, tm: {scope: 'ARE', measure: 'deaths', focus: null}, fc: {code: 'ARE', ind: 'ncd_3070', excovid: true}};

// ---------- shared helpers ----------
X.SERIES_INDS = ['life_exp', 'hale', 'uhc', 'obesity', 'hypertension', 'tobacco', 'ncd_3070', 'cvd_rate', 'stroke_rate', 'diab_death', 'oop', 'he_pc'];
X.GROUP_COLOR = {GCC: 0, 'Levant & Iraq': 2, 'North Africa': 1};
X.ready = (...ids) => ids.every((i) => dash.data(i).status === 'ok');
X.countries = () => {
  const seen = new Map();
  dash.data('latest').data.forEach((r) => { if (H.MENA.includes(r.group) && !seen.has(r.code)) seen.set(r.code, {code: r.code, name: r.country, group: r.group}); });
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
};
X.name = (code) => ({REG: 'Regional average', WLD: 'World', MENA: 'All 14 MENA countries', GBR: 'United Kingdom', USA: 'United States', FIN: 'Finland'}[code] || (X.countries().find((c) => c.code === code) || {}).name || code);
X.seriesOf = (code, ind) => dash.data('series').data.filter((r) => r.code === code && r.indicator === ind && r.value !== '').map((r) => ({year: +r.year, value: +r.value})).sort((a, b) => a.year - b.year);
X.latest = (code, ind) => { const r = H.row(code, ind); return r && r.value !== '' ? {value: +r.value, year: +r.year} : null; };
X.cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
X.inkOn = (cssVarName) => { // readable text colour on a filled tile
  const hex = X.cssVar(cssVarName).replace('#', ''); if (hex.length < 6) return '#fff';
  const ch = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return (1.05 / (L + 0.05)) >= 4.5 ? '#ffffff' : '#0f2233';
};
X.sel = (el, cls, label, items, cur, onPick) => {
  let s = el.querySelector('select.' + cls);
  if (!s) { const lab = document.createElement('label'); lab.textContent = label + ' '; s = document.createElement('select'); s.className = 'dash-select ' + cls; s.setAttribute('aria-label', label); lab.appendChild(s); el.appendChild(lab); s.addEventListener('change', () => onPick(s.value)); }
  const sig = items.map((i) => i[0]).join('|');
  if (s.dataset.sig !== sig) { s.replaceChildren(...items.map(([v, t]) => new Option(t, v))); s.dataset.sig = sig; }
  s.value = cur; return s;
};
X.countryItems = (extra = []) => [...extra, ...X.countries().map((c) => [c.code, c.name])];
X.indItems = (ids) => { const cat = H.cat(); return ids.filter((i) => cat.has(i)).map((i) => [i, cat.get(i).name]); };
X.fmtN = (v) => (v == null ? '—' : v >= 1e6 ? d3.format('.2~f')(v / 1e6) + ' m' : v >= 1e4 ? d3.format(',.0f')(v) : d3.format(',.0f')(v));

// ---------- targets (SDG / WHO) ----------
X.TARGETS = [
  {id: 'u5mr', label: 'Under-5 mortality', type: 'max', target: 25, unit: 'per 1,000 live births', src: 'SDG 3.2.1 — at most 25 per 1,000 live births by 2030'},
  {id: 'mmr', label: 'Maternal mortality', type: 'max', target: 70, unit: 'per 100,000 live births', src: 'SDG 3.1.1 — global target below 70 per 100,000 live births by 2030'},
  {id: 'ncd_3070', label: 'Premature NCD mortality (30–70)', type: 'rel', base: 2015, cut: 1 / 3, deadline: 2030, unit: '% probability', src: 'SDG 3.4.1 — one-third reduction 2015–2030', note: '2020–21 values include COVID-19 excess deaths'},
  {id: 'tobacco', label: 'Tobacco use', type: 'rel', base: 2010, cut: 0.30, deadline: 2025, unit: '% of adults 15+', src: 'WHO global NCD target — 30% relative reduction 2010–2025'},
  {id: 'hypertension', label: 'Hypertension prevalence', type: 'rel', base: 2010, cut: 0.25, deadline: 2025, unit: '% of adults', src: 'WHO global NCD target — 25% relative reduction 2010–2025 (latest WHO estimate 2019)'},
  {id: 'obesity', label: 'Adult obesity', type: 'halt', base: 2010, unit: '% of adults', src: 'WHO global NCD target — halt the rise (no increase from 2010)'},
  {id: 'workforce', label: 'Doctors, nurses & midwives', type: 'min', target: 44.5, unit: 'per 10,000 people', src: 'WHO Workforce 2030 — SDG index threshold of 44.5 per 10,000'},
  {id: 'oop', label: 'Out-of-pocket spending', type: 'max', target: 20, unit: '% of health spending', src: 'WHO World Health Report 2010 — financial hardship becomes rare below 15–20%'},
  {id: 'pm25', label: 'Air pollution (PM2.5)', type: 'max', target: 5, unit: 'µg/m³', src: 'WHO Air Quality Guidelines 2021 — annual mean at most 5 µg/m³'}
];
X.STATUS = {met: ['✓', 'Met', '--cds-chart-status-good'], ontrack: ['↗', 'On track', '--cds-chart-status-good'], offtrack: ['✗', 'Off track', '--cds-chart-status-critical'], notmet: ['✗', 'Not met', '--cds-chart-status-critical'], rising: ['✗', 'Still rising', '--cds-chart-status-critical'], nodata: ['–', 'No data', '--cds-chart-muted']};
X.assess = (code, t) => {
  const out = {t, status: 'nodata', value: null, year: null, target: null, base: null, baseYear: null, projected: null};
  if (t.id === 'workforce') {
    const p = X.latest(code, 'physicians'), n = X.latest(code, 'nurses');
    if (!p || !n) return out;
    Object.assign(out, {value: p.value * 10 + n.value, year: Math.min(p.year, n.year), target: t.target});
  } else if (t.type === 'max' || t.type === 'min') {
    const l = X.latest(code, t.id); if (!l) return out;
    Object.assign(out, {value: l.value, year: l.year, target: t.target});
  } else {
    const s = X.seriesOf(code, t.id); const b = s.find((r) => r.year === t.base); const l = s[s.length - 1];
    if (!b || !l) return out;
    Object.assign(out, {value: l.value, year: l.year, base: b.value, baseYear: b.year, target: t.type === 'halt' ? b.value : b.value * (1 - t.cut)});
  }
  const v = out.value, tg = out.target;
  if (t.type === 'max') out.status = v <= tg ? 'met' : 'notmet';
  else if (t.type === 'min') out.status = v >= tg ? 'met' : 'notmet';
  else if (t.type === 'halt') out.status = v <= tg + 0.05 ? 'met' : 'rising';
  else {
    if (v <= tg) out.status = 'met';
    else if (out.year >= t.deadline || out.year === out.baseYear) out.status = out.year >= t.deadline ? 'notmet' : 'offtrack';
    else { const slope = (v - out.base) / (out.year - out.baseYear); out.projected = v + slope * (t.deadline - out.year); out.status = out.projected <= tg ? 'ontrack' : 'offtrack'; }
  }
  return out;
};
X.statusChip = (st) => { const s = X.STATUS[st]; const sp = document.createElement('span'); sp.className = 'stchip'; sp.style.color = `var(${s[2]})`; sp.textContent = s[0] + ' ' + s[1]; return sp; };

// ---------- 1. Ranking race ----------
dash.draw('ix-race-ctrl', (el) => {
  if (!X.ready('series', 'catalog', 'latest')) return;
  X.sel(el, 'race-ind', 'Indicator', X.indItems(X.SERIES_INDS), S.race.ind, (v) => { S.race.ind = v; S.race.year = null; stopRace(); dash.draw('ix-race'); dash.draw('ix-race-ctrl'); });
  let b = el.querySelector('button.race-play');
  if (!b) {
    b = document.createElement('button'); b.className = 'btn sm race-play'; el.appendChild(b);
    b.addEventListener('click', () => (S.race.playing ? stopRace() : playRace()));
    const r = document.createElement('input'); r.type = 'range'; r.className = 'race-year'; r.setAttribute('aria-label', 'Year'); el.appendChild(r);
    r.addEventListener('input', () => { stopRace(); S.race.year = +r.value; dash.draw('ix-race'); });
    const yl = document.createElement('span'); yl.className = 'race-yl'; yl.setAttribute('aria-live', 'polite'); el.appendChild(yl);
  }
  b.textContent = S.race.playing ? '❚❚ Pause' : '▶ Play';
  const yrs = raceYears(); const r = el.querySelector('input.race-year');
  if (yrs.length) { r.min = yrs[0]; r.max = yrs[yrs.length - 1]; r.step = 1; r.value = S.race.year == null ? yrs[yrs.length - 1] : S.race.year; }
});
const raceYears = () => { const ys = [...new Set(dash.data('series').data.filter((r) => r.indicator === S.race.ind).map((r) => +r.year))].sort((a, b) => a - b); return ys.length ? d3.range(ys[0], ys[ys.length - 1] + 1) : []; };
const stopRace = () => { S.race.playing = false; clearTimeout(S.race.timer); dash.draw('ix-race-ctrl'); };
const playRace = () => {
  const yrs = raceYears(); if (!yrs.length) return;
  if (S.race.year == null || S.race.year >= yrs[yrs.length - 1]) S.race.year = yrs[0];
  S.race.playing = true; dash.draw('ix-race-ctrl'); dash.draw('ix-race');
  const step = () => {
    if (!S.race.playing) return;
    if (S.race.year >= yrs[yrs.length - 1]) { stopRace(); return; }
    S.race.year += 1; dash.draw('ix-race'); dash.draw('ix-race-ctrl');
    S.race.timer = setTimeout(step, 900);
  };
  S.race.timer = setTimeout(step, 900);
};
X.raceFrame = (ind, year) => { // values per country for a year; carries the last value forward up to 5 years, flagged
  const cs = X.countries(); const c = H.cat().get(ind) || {};
  const rows = cs.map((k) => {
    const s = X.seriesOf(k.code, ind); const exact = s.find((r) => r.year === year);
    const prev = [...s].reverse().find((r) => r.year < year && year - r.year <= 5);
    const p = exact || prev; return p ? {...k, value: p.value, from: p.year, carried: !exact} : null;
  }).filter(Boolean);
  const dir = c.better === 'lower' ? 1 : -1;
  rows.sort((a, b) => dir * (a.value - b.value)); rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
};
dash.draw('ix-race', (el) => {
  if (!X.ready('series', 'catalog', 'latest')) { el.textContent = 'Loading…'; return; }
  const yrs = raceYears(); if (!yrs.length) return;
  const year = S.race.year == null ? yrs[yrs.length - 1] : S.race.year;
  const c = H.cat().get(S.race.ind); const rows = X.raceFrame(S.race.ind, year);
  const all = dash.data('series').data.filter((r) => r.indicator === S.race.ind && H.MENA.includes(r.group)).map((r) => +r.value);
  const W = el.clientWidth || 600, rowH = 26, M = {t: 8, r: 64, b: 8, l: 30}, Hh = M.t + M.b + 14 * rowH;
  let svg = d3.select(el).select('svg.race');
  if (svg.empty()) {
    el.replaceChildren(); svg = d3.select(el).append('svg').attr('class', 'race').attr('role', 'img');
    svg.append('g').attr('class', 'bars');
  }
  svg.attr('width', W).attr('height', Hh).attr('viewBox', `0 0 ${W} ${Hh}`).attr('aria-label', `${c.name} ranking of MENA countries in ${year}`);
  const x = d3.scaleLinear().domain([0, d3.max(all) || 1]).range([0, W - M.l - M.r]);
  const yl = el.closest('.card') && el.closest('.card').querySelector('.race-yl'); if (yl) yl.textContent = year;
  const tip = H.tip(el);
  const dur = S.race.playing ? 800 : 300;
  const g = svg.select('g.bars').attr('transform', `translate(${M.l},${M.t})`).selectAll('g.rb').data(rows, (d) => d.code);
  const enter = g.enter().append('g').attr('class', 'rb').attr('transform', (d) => `translate(0,${(d.rank - 1) * rowH})`);
  enter.append('text').attr('class', 'rk').attr('x', -8).attr('y', rowH / 2).attr('dy', '0.35em').attr('text-anchor', 'end');
  enter.append('rect').attr('class', 'bar').attr('y', 3).attr('height', rowH - 6).attr('rx', 4);
  enter.append('text').attr('class', 'nm').attr('x', 6).attr('y', rowH / 2).attr('dy', '0.35em');
  enter.append('text').attr('class', 'vl').attr('y', rowH / 2).attr('dy', '0.35em');
  enter.append('rect').attr('class', 'hit').attr('width', W - M.l).attr('height', rowH).attr('fill', 'transparent');
  g.exit().remove();
  const m = enter.merge(g);
  m.transition().duration(dur).ease(d3.easeCubicInOut).attr('transform', (d) => `translate(0,${(d.rank - 1) * rowH})`);
  m.select('.rk').text((d) => d.rank);
  m.select('.bar').attr('fill', (d) => dash.colors[X.GROUP_COLOR[d.group]]).attr('fill-opacity', (d) => (d.carried ? 0.45 : 1))
    .transition().duration(dur).attr('width', (d) => Math.max(2, x(d.value)));
  m.select('.nm').text((d) => d.name).style('fill', (d) => X.inkOn('--hd-c' + X.GROUP_COLOR[d.group])).attr('opacity', (d) => (x(d.value) > d.name.length * 7.2 + 12 ? 1 : 0));
  m.select('.vl').text((d) => H.fmtI(d.value, c) + (x(d.value) > d.name.length * 7.2 + 12 ? '' : '  ' + d.name)).transition().duration(dur).attr('x', (d) => Math.max(2, x(d.value)) + 6);
  m.select('.hit').on('mousemove', (ev, d) => {
    tip.innerHTML = `<b>${d.name}</b><br>${c.name}: ${H.fmtI(d.value, c)} ${c.unit}<br>Rank ${d.rank} of ${rows.length} in ${year}` + (d.carried ? `<br><i>Latest value from ${d.from}</i>` : '');
    const [px, py] = d3.pointer(ev, el); H.place(el, tip, px, py);
  }).on('mouseleave', () => { tip.hidden = true; });
});
dash.draw('ix-race-note', (el) => {
  if (!X.ready('series', 'catalog', 'latest')) return;
  const c = H.cat().get(S.race.ind);
  el.textContent = `${c.name} (${c.unit}), ${c.source}. ` + (c.better === 'none' ? 'Largest first.' : c.better === 'lower' ? 'Lowest (best) first.' : 'Highest (best) first.') + ' Faded bars repeat a country\'s most recent value from up to 5 years earlier.';
});

// ---------- 2. Gap-to-target gauges ----------
dash.draw('ix-gap-ctrl', (el) => {
  if (!X.ready('latest', 'series')) return;
  X.sel(el, 'gap-c', 'Country', X.countryItems(), S.gap.code, (v) => { S.gap.code = v; dash.draw('ix-gap'); dash.draw('ix-gap-sum'); dash.draw('ix-gapmx'); });
});
dash.draw('ix-gap-sum', (el) => {
  if (!X.ready('latest', 'series')) return;
  const a = X.TARGETS.map((t) => X.assess(S.gap.code, t)).filter((r) => r.status !== 'nodata');
  const good = a.filter((r) => r.status === 'met' || r.status === 'ontrack').length;
  el.textContent = `${X.name(S.gap.code)} meets or is on track for ${good} of ${a.length} health targets with data.`;
});
X.gauges = (el, code, opts = {}) => {
  el.replaceChildren();
  const list = document.createElement('div'); list.className = 'gauges'; el.appendChild(list);
  X.TARGETS.forEach((t) => {
    const a = X.assess(code, t);
    const row = document.createElement('div'); row.className = 'gauge';
    const hd = document.createElement('div'); hd.className = 'g-hd';
    const nm = document.createElement('b'); nm.textContent = t.label; hd.append(nm, X.statusChip(a.status)); row.appendChild(hd);
    const W = Math.max(220, (el.clientWidth || 600) - 4), Hh = 34;
    if (a.value != null) {
      const vals = [a.value, a.target, a.base, a.projected].filter((v) => v != null);
      const x = d3.scaleLinear().domain([0, d3.max(vals) * 1.15]).range([0, W - 8]);
      const svg = d3.select(row).append('svg').attr('width', W).attr('height', Hh).attr('role', 'img')
        .attr('aria-label', `${t.label}: ${d3.format('.1f')(a.value)} vs target ${d3.format('.1f')(a.target)}`);
      svg.append('rect').attr('x', 0).attr('y', 9).attr('width', W - 8).attr('height', 12).attr('rx', 6).attr('fill', 'var(--cds-chart-grid)');
      svg.append('rect').attr('x', 0).attr('y', 9).attr('width', Math.max(3, x(a.value))).attr('height', 12).attr('rx', 6).attr('fill', 'var(--hd-c0)');
      if (a.base != null && t.type !== 'halt') svg.append('line').attr('x1', x(a.base)).attr('x2', x(a.base)).attr('y1', 5).attr('y2', 25).attr('stroke', 'var(--cds-chart-muted)').attr('stroke-width', 2);
      svg.append('line').attr('x1', x(a.target)).attr('x2', x(a.target)).attr('y1', 3).attr('y2', 27).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-width', 2.5);
      svg.append('text').attr('x', Math.min(x(a.target) + 4, W - 70)).attr('y', 33).attr('class', 'ref').text('target ' + d3.format(',.1~f')(a.target));
    }
    const p = document.createElement('p'); p.className = 'sub g-line';
    if (a.value == null) p.textContent = 'No data for this country. ' + t.src;
    else {
      let s = `${d3.format(',.1f')(a.value)} ${t.unit} (${a.year}) vs target ${d3.format(',.1f')(a.target)}`;
      if (a.base != null) s += `; ${a.baseYear} baseline ${d3.format(',.1f')(a.base)}`;
      if (a.projected != null) s += `; on the current trend ${d3.format(',.1f')(a.projected)} by ${t.deadline}`;
      p.textContent = s + '. ' + t.src + (t.note ? ' (' + t.note + ')' : '') + '.';
    }
    row.appendChild(p); list.appendChild(row);
  });
  if (!opts.noKey) { const k = document.createElement('p'); k.className = 'sub'; k.textContent = 'Blue bar = latest value · dark line = target · grey tick = baseline year.'; el.appendChild(k); }
};
dash.draw('ix-gap', (el) => { if (!X.ready('latest', 'series')) { el.textContent = 'Loading…'; return; } X.gauges(el, S.gap.code); });
dash.draw('ix-gapmx', (el) => {
  if (!X.ready('latest', 'series')) return;
  const tb = document.createElement('table'); tb.className = 'gapmx';
  const th = tb.createTHead().insertRow(); th.insertCell().outerHTML = '<th>Country</th>';
  X.TARGETS.forEach((t) => { const c = document.createElement('th'); c.textContent = t.label; c.title = t.src; th.appendChild(c); });
  const body = tb.createTBody();
  X.countries().forEach((c) => {
    const tr = body.insertRow(); if (c.code === S.gap.code) tr.className = 'sel';
    const n = tr.insertCell(); const b = document.createElement('button'); b.className = 'linkbtn'; b.textContent = c.name; b.addEventListener('click', () => { S.gap.code = c.code; ['ix-gap-ctrl', 'ix-gap', 'ix-gap-sum', 'ix-gapmx'].forEach((d) => dash.draw(d)); }); n.appendChild(b);
    X.TARGETS.forEach((t) => { const a = X.assess(c.code, t); const td = tr.insertCell(); const s = X.STATUS[a.status]; td.className = 'mx'; td.title = `${t.label}: ${s[1]}` + (a.value != null ? ` (${d3.format(',.1f')(a.value)} vs ${d3.format(',.1f')(a.target)})` : ''); td.style.color = `var(${s[2]})`; td.textContent = s[0]; });
  });
  el.replaceChildren(tb);
});

// ---------- 3. Disease-burden treemap ----------
X.causeTree = (scope, measure) => {
  const rows = dash.data('causes').data;
  const codes = scope === 'MENA' ? new Set(X.countries().map((c) => c.code)) : new Set([scope]);
  const agg = new Map();
  rows.filter((r) => codes.has(r.code)).forEach((r) => {
    const k = r.cause; const e = agg.get(k) || {cause: k, parent: r.parent, level: +r.level, title: r.title, deaths: 0, dalys: 0};
    e.deaths += +r.deaths; e.dalys += +r.dalys; agg.set(k, e);
  });
  const all = agg.get('0'); if (!all) return null;
  const kids = (p) => [...agg.values()].filter((e) => e.parent === p && e.level <= 3);
  const build = (e) => { const ch = kids(e.cause); return {...e, children: ch.length && e.level < 3 ? ch.map(build) : undefined}; };
  const root = d3.hierarchy(build(all)).sum((d) => (d.children ? 0 : Math.max(0, d[measure])));
  root.total = {deaths: all.deaths, dalys: all.dalys};
  return root;
};
X.GROUPCOL = {10: 1, 600: 0, 1510: 2};
X.topCauses = (scope, measure, n = 10) => { const r = X.causeTree(scope, measure); if (!r) return []; return r.leaves().filter((l) => l.data.level === 3 || !l.children).map((l) => ({title: l.data.title, v: l.data[measure], share: l.data[measure] / r.total[measure], group: l.ancestors().find((a) => a.depth === 1).data.cause})).sort((a, b) => b.v - a.v).slice(0, n); };
dash.draw('ix-tm-ctrl', (el) => {
  if (!X.ready('causes', 'latest')) return;
  X.sel(el, 'tm-scope', 'Country', X.countryItems([['MENA', 'All 14 MENA countries']]).concat([['GBR', 'United Kingdom'], ['USA', 'United States'], ['FIN', 'Finland']]), S.tm.scope, (v) => { S.tm.scope = v; S.tm.focus = null; ['ix-tm', 'ix-tm-top', 'ix-tm-crumb'].forEach((d) => dash.draw(d)); });
  let seg = el.querySelector('.tm-meas');
  if (!seg) {
    const lab = document.createElement('label'); lab.textContent = 'Measure '; seg = document.createElement('span'); seg.className = 'seg tm-meas';
    [['deaths', 'Deaths'], ['dalys', 'Healthy years lost (DALYs)']].forEach(([v, t]) => { const b = document.createElement('button'); b.dataset.m = v; b.textContent = t; b.addEventListener('click', () => { S.tm.measure = v; ['ix-tm', 'ix-tm-top', 'ix-tm-ctrl', 'ix-tm-crumb'].forEach((d) => dash.draw(d)); }); seg.appendChild(b); });
    lab.appendChild(seg); el.appendChild(lab);
  }
  seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === S.tm.measure)));
});
dash.draw('ix-tm-crumb', (el) => {
  if (!X.ready('causes')) return;
  el.replaceChildren();
  const root = X.causeTree(S.tm.scope, S.tm.measure); if (!root) return;
  const path = S.tm.focus ? root.find((n) => n.data.cause === S.tm.focus) : null;
  const chain = path ? path.ancestors().reverse() : [root];
  chain.forEach((n, i) => {
    if (i) el.append(' › ');
    const b = document.createElement('button'); b.className = 'linkbtn'; b.textContent = n.depth ? n.data.title : 'All causes';
    if (i === chain.length - 1) { b.disabled = true; b.classList.add('cur'); }
    b.addEventListener('click', () => { S.tm.focus = n.depth ? n.data.cause : null; dash.draw('ix-tm'); dash.draw('ix-tm-crumb'); });
    el.appendChild(b);
  });
  const hint = document.createElement('span'); hint.className = 'sub'; hint.textContent = path ? '' : '  — click a block to see the causes inside it'; el.appendChild(hint);
});
X.treemap = (el, scope, measure, focus, opts = {}) => {
  const root = X.causeTree(scope, measure); if (!root) { el.textContent = 'No cause-of-death data for this country.'; return; }
  const node = focus ? root.find((n) => n.data.cause === focus) || root : root;
  const W = el.clientWidth || 600, Hh = opts.height || Math.max(320, Math.min(460, W * 0.62));
  el.replaceChildren();
  const sub = d3.hierarchy(node.data).sum((d) => (d.children ? 0 : Math.max(0, d[measure])));
  sub.sort((p, q) => q.value - p.value);
  d3.treemap().size([W, Hh]).paddingInner(2).paddingTop((d) => (d.depth === 1 && d.children && !focus ? 18 : 0)).round(true)(sub);
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', Hh).attr('role', 'img').attr('aria-label', `Treemap of ${measure === 'deaths' ? 'deaths' : 'DALYs'} by cause, ${X.name(scope)}, 2023`);
  const grpOf = (d) => { if (focus) { const a = node.ancestors().find((x) => x.depth === 1); return a ? a.data.cause : node.data.cause; } const a = d.ancestors().find((x) => x.depth === 1); return a ? a.data.cause : d.data.cause; };
  const col = (d) => X.GROUPCOL[grpOf(d)] ?? 6;
  const total = root.total[measure];
  const tip = H.tip(el);
  const show = focus ? sub.children ? sub.children : [sub] : sub.descendants().filter((d) => d.depth === 2 || (d.depth === 1 && !d.children));
  if (!focus) svg.selectAll('text.grp').data(sub.children || []).join('text').attr('class', 'grp').attr('x', (d) => d.x0 + 4).attr('y', (d) => d.y0 + 13)
    .text((d) => { const w = d.x1 - d.x0; const full = `${d.data.title.replace('Communicable, maternal, perinatal and nutritional conditions', 'Communicable, maternal & nutritional').replace('Noncommunicable diseases', 'Noncommunicable')} · ${d3.format('.0%')(d.value / total)}`; const max = Math.floor((w - 6) / 6.8); return w < 40 ? '' : full.length <= max ? full : d3.format('.0%')(d.value / total); });
  const g = svg.selectAll('g.tile').data(show.filter((d) => d.value > 0)).join('g').attr('class', 'tile').attr('transform', (d) => `translate(${d.x0},${d.y0})`);
  g.append('rect').attr('width', (d) => Math.max(0, d.x1 - d.x0)).attr('height', (d) => Math.max(0, d.y1 - d.y0)).attr('rx', 3)
    .attr('fill', (d) => dash.colors[col(d)]).attr('fill-opacity', (d) => (focus ? 0.9 : 0.92)).style('cursor', (d) => (!opts.static && d.data.children ? 'pointer' : 'default'));
  g.each(function (d) {
    const w = d.x1 - d.x0, h = d.y1 - d.y0; if (w < 46 || h < 24) return;
    const ink = X.inkOn('--hd-c' + col(d)); const t = d3.select(this).append('text').attr('x', 5).attr('y', 15).style('fill', ink).style('font-size', '12px').style('font-weight', 600);
    const name = d.data.title; const maxCh = Math.floor((w - 8) / 6.6);
    t.append('tspan').text(name.length > maxCh ? name.slice(0, Math.max(3, maxCh - 1)) + '…' : name);
    if (h > 38) d3.select(this).append('text').attr('x', 5).attr('y', 31).style('fill', ink).style('font-size', '11.5px').text(d3.format('.1%')(d.value / total));
  });
  if (!opts.static) {
    g.on('mousemove', (ev, d) => {
      const dd = d.data; tip.innerHTML = `<b>${dd.title}</b><br>${X.fmtN(Math.round(dd.deaths))} deaths (${d3.format('.1%')(dd.deaths / root.total.deaths)})<br>${X.fmtN(Math.round(dd.dalys))} DALYs (${d3.format('.1%')(dd.dalys / root.total.dalys)})` + (dd.children ? '<br><i>Click to open</i>' : '');
      const [px, py] = d3.pointer(ev, el); H.place(el, tip, px, py);
    }).on('mouseleave', () => { tip.hidden = true; })
      .on('click', (ev, d) => { if (d.data.children) { S.tm.focus = d.data.cause; tip.hidden = true; dash.draw('ix-tm'); dash.draw('ix-tm-crumb'); } });
  }
};
dash.draw('ix-tm', (el) => { if (!X.ready('causes', 'latest')) { el.textContent = 'Loading…'; return; } X.treemap(el, S.tm.scope, S.tm.measure, S.tm.focus); });
dash.draw('ix-tm-top', (el) => {
  if (!X.ready('causes', 'latest')) return;
  const top = X.topCauses(S.tm.scope, S.tm.measure, 10); el.replaceChildren();
  const ol = document.createElement('ol'); ol.className = 'toplist';
  top.forEach((t) => { const li = document.createElement('li'); const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = dash.colors[X.GROUPCOL[t.group] ?? 6]; li.append(sw, `${t.title} — ${d3.format('.1%')(t.share)}`); ol.appendChild(li); });
  el.appendChild(ol);
});

// ---------- 4. Forecast lines ----------
const T90 = {1: 3.078, 2: 1.886, 3: 1.638, 4: 1.533, 5: 1.476, 6: 1.440, 7: 1.415, 8: 1.397, 9: 1.383, 10: 1.372, 12: 1.356, 15: 1.341, 20: 1.325};
const tq = (df) => { const ks = Object.keys(T90).map(Number); const k = ks.reduce((a, b) => (Math.abs(b - df) < Math.abs(a - df) ? b : a)); return T90[k]; };
X.forecast = (code, ind, excovid, to = 2030) => {
  const c = H.cat().get(ind) || {}; const s = X.seriesOf(code, ind);
  if (s.length < 5) return null;
  const last = s[s.length - 1].year;
  let fit = s.filter((r) => r.year >= last - 11);
  if (excovid) fit = fit.filter((r) => r.year !== 2020 && r.year !== 2021);
  if (fit.length < 4) fit = s.slice(-6);
  const n = fit.length, xb = d3.mean(fit, (r) => r.year), yb = d3.mean(fit, (r) => r.value);
  const sxx = d3.sum(fit, (r) => (r.year - xb) ** 2), sxy = d3.sum(fit, (r) => (r.year - xb) * (r.value - yb));
  const b = sxy / sxx, a = yb - b * xb;
  const res = d3.sum(fit, (r) => (r.value - (a + b * r.year)) ** 2); const se = Math.sqrt(res / Math.max(1, n - 2)); const t = tq(n - 2);
  const pct = /%|index/.test(c.unit || '');
  const clamp = (v) => (pct ? Math.max(0, Math.min(100, v)) : Math.max(0, v));
  const anchor = fit[fit.length - 1].year === last; const lv = s[s.length - 1].value;
  const proj = d3.range(last, to + 1).map((y) => { const yhat = a + b * y; const half = t * se * Math.sqrt(1 + 1 / n + (y - xb) ** 2 / sxx); const pin = anchor && y === last; return {year: y, value: clamp(pin ? lv : yhat), lo: clamp(pin ? lv : yhat - half), hi: clamp(pin ? lv : yhat + half)}; });
  return {hist: s, proj, slope: b, n, last, fitFrom: fit[0].year, c};
};
dash.draw('ix-fc-ctrl', (el) => {
  if (!X.ready('series', 'catalog', 'latest')) return;
  X.sel(el, 'fc-c', 'Country', X.countryItems([['REG', 'Regional average']]), S.fc.code, (v) => { S.fc.code = v; dash.draw('ix-fc'); dash.draw('ix-fc-note'); });
  X.sel(el, 'fc-i', 'Indicator', X.indItems(X.SERIES_INDS), S.fc.ind, (v) => { S.fc.ind = v; dash.draw('ix-fc'); dash.draw('ix-fc-note'); });
  let cb = el.querySelector('input.fc-cov');
  if (!cb) { const lab = document.createElement('label'); cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'fc-cov'; lab.append(cb, ' Leave out 2020–21 (COVID-19)'); el.appendChild(lab); cb.addEventListener('change', () => { S.fc.excovid = cb.checked; dash.draw('ix-fc'); dash.draw('ix-fc-note'); }); }
  cb.checked = S.fc.excovid;
});
X.fcChart = (el, code, ind, excovid, opts = {}) => {
  const f = X.forecast(code, ind, excovid); el.replaceChildren();
  if (!f) { el.textContent = 'Not enough yearly data to project this indicator for this country.'; return null; }
  const W = el.clientWidth || 600, Hh = opts.height || 300, M = {t: 14, r: 92, b: 26, l: 46};
  const t = X.TARGETS.find((x) => x.id === ind); const a = t ? X.assess(code, t) : null; const tgt = a && a.target != null ? a.target : null;
  const reg = code !== 'REG' ? X.seriesOf('REG', ind) : [];
  const ys = [...f.hist.map((r) => r.value), ...f.proj.flatMap((r) => [r.lo, r.hi]), ...reg.map((r) => r.value), tgt].filter((v) => v != null);
  const x = d3.scaleLinear().domain([f.hist[0].year, 2030]).range([M.l, W - M.r]);
  const y = d3.scaleLinear().domain([Math.min(0, d3.min(ys)), d3.max(ys) * 1.08]).nice().range([Hh - M.b, M.t]);
  const svg = d3.select(el).append('svg').attr('width', W).attr('height', Hh).attr('role', 'img').attr('aria-label', `${f.c.name}, ${X.name(code)}: history and straight-line projection to 2030`);
  svg.append('g').attr('transform', `translate(0,${Hh - M.b})`).call(d3.axisBottom(x).ticks(Math.min(8, W / 80)).tickFormat(d3.format('d')).tickSizeOuter(0)).call((g) => g.select('.domain').attr('stroke', 'var(--cds-chart-axis)')).call((g) => g.selectAll('line').attr('stroke', 'var(--cds-chart-axis)'));
  svg.append('g').attr('transform', `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-(W - M.l - M.r))).call((g) => g.select('.domain').remove()).call((g) => g.selectAll('line').attr('stroke', 'var(--cds-chart-grid)'));
  svg.append('rect').attr('x', x(f.last)).attr('y', M.t).attr('width', x(2030) - x(f.last)).attr('height', Hh - M.b - M.t).attr('fill', 'var(--cds-chart-grid)').attr('opacity', 0.45);
  svg.append('text').attr('class', 'ref').attr('x', x(f.last) + 4).attr('y', M.t + 10).text('projection');
  svg.append('path').datum(f.proj).attr('fill', 'var(--hd-c0)').attr('fill-opacity', 0.16).attr('d', d3.area().x((d) => x(d.year)).y0((d) => y(d.lo)).y1((d) => y(d.hi)));
  if (reg.length) svg.append('path').datum(reg).attr('fill', 'none').attr('stroke', 'var(--cds-chart-muted)').attr('stroke-width', 2).attr('d', d3.line().x((d) => x(d.year)).y((d) => y(d.value)));
  svg.append('path').datum(f.hist).attr('fill', 'none').attr('stroke', 'var(--hd-c0)').attr('stroke-width', 2).attr('d', d3.line().x((d) => x(d.year)).y((d) => y(d.value)));
  svg.append('path').datum(f.proj).attr('fill', 'none').attr('stroke', 'var(--hd-c0)').attr('stroke-width', 2).attr('stroke-dasharray', '5 4').attr('d', d3.line().x((d) => x(d.year)).y((d) => y(d.value)));
  if (tgt != null) {
    svg.append('line').attr('x1', M.l).attr('x2', W - M.r).attr('y1', y(tgt)).attr('y2', y(tgt)).attr('stroke', 'var(--cds-chart-reference)').attr('stroke-width', 1.5).attr('stroke-dasharray', '2 3');
    svg.append('text').attr('class', 'ref').attr('x', W - M.r + 4).attr('y', y(tgt)).attr('dy', '0.35em').text('target ' + d3.format(',.1~f')(tgt));
  }
  const end = f.proj[f.proj.length - 1];
  svg.append('text').attr('x', W - M.r + 4).attr('y', y(end.value)).attr('dy', '0.35em').style('font-weight', 600).style('fill', 'var(--color-fg)').text(`2030: ${d3.format(',.1f')(end.value)}`);
  if (reg.length) svg.append('text').attr('x', W - M.r + 4).attr('y', y(reg[reg.length - 1].value) + (Math.abs(y(reg[reg.length - 1].value) - y(end.value)) < 14 ? 14 : 0)).attr('dy', '0.35em').attr('class', 'ref').text('Regional avg');
  // crosshair
  const tip = H.tip(el); const cross = svg.append('line').attr('y1', M.t).attr('y2', Hh - M.b).attr('stroke', 'var(--cds-chart-axis)').attr('opacity', 0);
  svg.append('rect').attr('x', M.l).attr('y', M.t).attr('width', W - M.l - M.r).attr('height', Hh - M.t - M.b).attr('fill', 'transparent')
    .on('mousemove', (ev) => {
      const yr = Math.round(x.invert(d3.pointer(ev)[0])); cross.attr('x1', x(yr)).attr('x2', x(yr)).attr('opacity', 1);
      const h = f.hist.find((r) => r.year === yr), p = f.proj.find((r) => r.year === yr && yr > f.last), rg = reg.find((r) => r.year === yr);
      tip.innerHTML = `<b>${yr}</b>` + (h ? `<br>${X.name(code)}: ${d3.format(',.1f')(h.value)}` : '') + (p ? `<br>Projected: ${d3.format(',.1f')(p.value)} (80% range ${d3.format(',.1f')(p.lo)}–${d3.format(',.1f')(p.hi)})` : '') + (rg ? `<br>Regional average: ${d3.format(',.1f')(rg.value)}` : '');
      const [px, py] = d3.pointer(ev, el); H.place(el, tip, px, py);
    }).on('mouseleave', () => { tip.hidden = true; cross.attr('opacity', 0); });
  return f;
};
dash.draw('ix-fc', (el) => { if (!X.ready('series', 'catalog', 'latest')) { el.textContent = 'Loading…'; return; } X.fcChart(el, S.fc.code, S.fc.ind, S.fc.excovid); });
dash.draw('ix-fc-note', (el) => {
  if (!X.ready('series', 'catalog', 'latest')) return;
  const f = X.forecast(S.fc.code, S.fc.ind, S.fc.excovid); if (!f) { el.textContent = ''; return; }
  const end = f.proj[f.proj.length - 1]; const dirW = f.slope > 0 ? 'rising' : f.slope < 0 ? 'falling' : 'flat';
  el.textContent = `${f.c.name} in ${X.name(S.fc.code)} has been ${dirW} by about ${d3.format(',.2f')(Math.abs(f.slope))} ${f.c.unit} a year (fit on ${f.n} points from ${f.fitFrom}). If that continues, it reaches about ${d3.format(',.1f')(end.value)} by 2030 (80% range ${d3.format(',.1f')(end.lo)}–${d3.format(',.1f')(end.hi)}). This is a straight-line extrapolation, not a forecast model — policy, ageing or shocks can change the path.`;
});
})();
