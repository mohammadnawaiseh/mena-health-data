(function(){
// Stakeholder workspaces: per-group dashboards, smart tools and data
const H = window.HD;
H.s.mai = 'balanced'; H.s.cap = 'world';
H.names.push('wkname', 'wkv', 'wkd', 'wkcap', 'prio', 'bestgap', 'cdl', 'growth', 'mai', 'maitable', 'capgap', 'capbar', 'market', 'ppi', 'wsdata', 'wsfocus');
const NONMENA = ['Aggregate', 'Global benchmark'];

dash.calc('vsworld', {
  inputs: ['latest', 'catalog'],
  title: 'Every country vs world',
  description: 'For each country and indicator (both sexes): value, world value, difference, ratio to world and whether that is better or worse given the indicator direction.',
  fn: (latest, catalog) => {
    const w = new Map(latest.filter((r) => r.code === 'WLD').map((r) => [r.indicator, Number(r.value)]));
    const dir = new Map(catalog.map((c) => [c.indicator, c.better]));
    return latest.filter((r) => r.code !== 'WLD' && r.value !== '' && r.value != null).map((r) => {
      const v = Number(r.value), wv = w.get(r.indicator), b = dir.get(r.indicator);
      const diff = wv == null ? null : Math.round((v - wv) * 10) / 10;
      return {code: r.code, country: r.country, group: r.group, indicator: r.indicator, value: v, world: wv ?? null, diff, ratio: wv ? Math.round(v / wv * 100) / 100 : null,
        status: diff == null || b === 'none' ? 'neutral' : (b === 'lower' ? diff > 0 : diff < 0) ? 'worse' : 'better'};
    });
  }
});

dash.calc('bestgap', {
  inputs: ['latest', 'catalog'],
  title: 'Gap to the best MENA performer',
  description: 'For each MENA country and directional indicator: the best value among the 14 MENA countries, who holds it, and how far the country is from it.',
  fn: (latest, catalog) => {
    const out = [];
    catalog.filter((c) => c.better !== 'none').forEach((c) => {
      const rows = latest.filter((r) => r.indicator === c.indicator && !NONMENA.includes(r.group) && r.value !== '');
      if (!rows.length) return;
      const best = rows.reduce((a, b) => (c.better === 'lower' ? (+b.value < +a.value ? b : a) : (+b.value > +a.value ? b : a)));
      rows.forEach((r) => out.push({code: r.code, indicator: c.indicator, value: +r.value, best_value: +best.value, best_country: best.country, gap: Math.round(Math.abs(+r.value - +best.value) * 10) / 10, at_best: r.code === best.code}));
    });
    return out;
  }
});

dash.calc('cdl', {
  inputs: ['latest'],
  title: 'Chronic disease load index',
  description: 'Average of diabetes, adult obesity and hypertension prevalence, each as a ratio to the world average × 100 (world = 100).',
  fn: (latest) => {
    const g = (c, i) => { const r = latest.find((x) => x.code === c && x.indicator === i); return r && r.value !== '' ? +r.value : null; };
    const codes = [...new Set(latest.filter((r) => r.group !== 'Aggregate').map((r) => r.code))];
    return codes.map((code) => {
      const parts = ['diabetes', 'obesity', 'hypertension'].map((i) => (g(code, i) != null && g('WLD', i) ? g(code, i) / g('WLD', i) * 100 : null));
      const ok = parts.filter((p) => p != null);
      const r = latest.find((x) => x.code === code);
      return {code, country: r.country, group: r.group, diabetes_idx: parts[0] && Math.round(parts[0]), obesity_idx: parts[1] && Math.round(parts[1]), hypertension_idx: parts[2] && Math.round(parts[2]), index: ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : null};
    });
  }
});

dash.calc('growth', {
  inputs: ['series'],
  title: 'Health spending growth',
  description: 'Compound annual growth of health spending per person (current US$) from 2013 to 2023.',
  fn: (series) => {
    const rows = series.filter((r) => r.indicator === 'he_pc');
    const codes = [...new Set(rows.map((r) => r.code))];
    return codes.map((code) => {
      const a = rows.find((r) => r.code === code && r.year === '2013'), b = rows.find((r) => r.code === code && r.year === '2023');
      const cagr = a && b && +a.value > 0 ? Math.round((Math.pow(+b.value / +a.value, 1 / 10) - 1) * 1000) / 10 : null;
      return {code, country: (a || b || {}).country, group: (a || b || {}).group, he_pc_2013: a ? +a.value : null, he_pc_2023: b ? +b.value : null, cagr_pct: cagr};
    }).filter((r) => r.cagr_pct != null);
  }
});

dash.calc('mai', {
  inputs: ['latest', 'trials_live'],
  title: 'Pharma market attractiveness index',
  description: 'Four components scaled 0–100 across the 14 MENA countries: burden (mean of diabetes, obesity and cardiovascular death rate), ability to pay (health spending per person), size (log population) and research base (open trials per million). Weights: balanced 40/30/20/10, burden-led 60/15/15/10, access-led 20/50/20/10.',
  fn: (latest, trials) => {
    const g = (c, i) => { const r = latest.find((x) => x.code === c && x.indicator === i); return r && r.value !== '' ? +r.value : null; };
    const codes = [...new Set(latest.filter((r) => !NONMENA.includes(r.group)).map((r) => r.code))];
    const raw = codes.map((code) => {
      const t = trials.find((x) => x.code === code); const pop = g(code, 'population');
      return {code, country: latest.find((r) => r.code === code).country, group: latest.find((r) => r.code === code).group, diabetes: g(code, 'diabetes'), obesity: g(code, 'obesity'), cvd: g(code, 'cvd_rate'), pay: g(code, 'he_pc'), size: pop ? Math.log10(pop) : null, research: t && pop ? +t.active_trials / (pop / 1e6) : null};
    });
    const norm = (k) => { const v = raw.map((r) => r[k]).filter((x) => x != null); const lo = Math.min(...v), hi = Math.max(...v); return (x) => (x == null || hi === lo ? 0 : (x - lo) / (hi - lo) * 100); };
    const n = Object.fromEntries(['diabetes', 'obesity', 'cvd', 'pay', 'size', 'research'].map((k) => [k, norm(k)]));
    const W = {balanced: [0.4, 0.3, 0.2, 0.1], burden: [0.6, 0.15, 0.15, 0.1], access: [0.2, 0.5, 0.2, 0.1]};
    const out = [];
    raw.forEach((r) => {
      const burden = (n.diabetes(r.diabetes) + n.obesity(r.obesity) + n.cvd(r.cvd)) / 3, pay = n.pay(r.pay), size = n.size(r.size), research = n.research(r.research);
      Object.entries(W).forEach(([preset, w]) => out.push({code: r.code, country: r.country, group: r.group, preset, score: Math.round((w[0] * burden + w[1] * pay + w[2] * size + w[3] * research) * 10) / 10, burden: Math.round(burden), ability_to_pay: Math.round(pay), size: Math.round(size), research: Math.round(research)}));
    });
    return out;
  }
});

dash.calc('capgap', {
  inputs: ['latest'],
  title: 'Health workforce and bed gap',
  description: 'Additional physicians, nurses & midwives and hospital beds each MENA country would need to reach a target density: the world average, the UK, or the best MENA country. Needed = max(0, target − current) × population ÷ 1,000 (÷ 10,000 for nurses).',
  fn: (latest) => {
    const g = (c, i) => { const r = latest.find((x) => x.code === c && x.indicator === i); return r && r.value !== '' ? +r.value : null; };
    const mena = [...new Set(latest.filter((r) => !NONMENA.includes(r.group)).map((r) => r.code))];
    const res = [['physicians', 'Physicians', 1000], ['nurses', 'Nurses & midwives', 10000], ['beds', 'Hospital beds', 1000]];
    const out = [];
    mena.forEach((code) => res.forEach(([id, label, per]) => {
      const cur = g(code, id), pop = g(code, 'population');
      const best = Math.max(...mena.map((m) => g(m, id)).filter((v) => v != null));
      [['world', g('WLD', id)], ['uk', g('GBR', id)], ['best', best]].forEach(([target, tv]) => {
        if (cur == null || tv == null || !pop) return;
        out.push({code, country: latest.find((r) => r.code === code).country, group: latest.find((r) => r.code === code).group, target, resource: id, label, current: cur, target_value: tv, needed: Math.round(Math.max(0, tv - cur) * pop / per)});
      });
    }));
    return out;
  }
});

dash.calc('market', {
  inputs: ['latest'],
  title: 'Health market size',
  description: 'Total current health spending in US$ billions = population (2024) × health spending per person (2023).',
  fn: (latest) => {
    const g = (c, i) => { const r = latest.find((x) => x.code === c && x.indicator === i); return r && r.value !== '' ? +r.value : null; };
    return [...new Set(latest.filter((r) => r.group !== 'Aggregate').map((r) => r.code))].map((code) => {
      const r = latest.find((x) => x.code === code), pop = g(code, 'population'), pc = g(code, 'he_pc');
      return {code, country: r.country, group: r.group, population_m: pop ? Math.round(pop / 1e5) / 10 : null, he_pc: pc, size_bn: pop && pc ? Math.round(pop * pc / 1e8) / 10 : null};
    }).filter((r) => r.size_bn != null);
  }
});

dash.calc('ppi', {
  inputs: ['latest'],
  title: 'Prevention priority index',
  description: 'Average of six risk factors (adult obesity, child obesity, inactivity, tobacco, hypertension, PM2.5), each as a ratio to the world average × 100 (world = 100). Higher = more to gain from prevention.',
  fn: (latest) => {
    const g = (c, i) => { const r = latest.find((x) => x.code === c && x.indicator === i); return r && r.value !== '' ? +r.value : null; };
    const ids = ['obesity', 'obesity_child', 'inactivity', 'tobacco', 'hypertension', 'pm25'];
    return [...new Set(latest.filter((r) => r.group !== 'Aggregate').map((r) => r.code))].map((code) => {
      const r = latest.find((x) => x.code === code); const parts = {};
      ids.forEach((i) => { const v = g(code, i), w = g('WLD', i); parts[i + '_idx'] = v != null && w ? Math.round(v / w * 100) : null; });
      const ok = Object.values(parts).filter((p) => p != null);
      return {code, country: r.country, group: r.group, ...parts, index: ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : null};
    });
  }
});

// ---------- helpers ----------
H.vw = (code, ind) => { const d = dash.data('vsworld'); return d.status === 'ok' && d.data ? d.data.find((r) => r.code === code && r.indicator === ind) : null; };
H.inGrp = (r) => !NONMENA.includes(r.group) || (r.group === 'Global benchmark' && H.s.bench);
H.inSub = (r) => H.inGrp(r) && (!H.s.grp || r.group === H.s.grp || r.group === 'Global benchmark');
// Ranked bars from any rows: field = value column, src = dataset id for marks
H.rank = (el, rows, field, src, fmt, opt = {}) => {
  el.replaceChildren();
  rows = rows.filter((r) => r[field] != null).sort((a, b) => b[field] - a[field]);
  if (!rows.length) { el.textContent = '—'; return; }
  const W = el.clientWidth || 360, bh = 22, y0 = opt.ref != null ? 22 : 4;
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', rows.length * bh + y0 + 6).attr('role', 'img').attr('aria-label', opt.label || field);
  const tmp = svg.append('g'); const labW = d3.max(rows, (d) => { const t = tmp.append('text').text(d.country); const w = t.node().getComputedTextLength(); t.remove(); return w; }) || 60; tmp.remove();
  const left = labW + 10, right = 54;
  const x = d3.scaleLinear().domain([Math.min(0, d3.min(rows, (d) => d[field])), Math.max(d3.max(rows, (d) => d[field]), opt.ref || 0) * 1.04]).range([left, Math.max(left + 40, W - right)]);
  const g = svg.selectAll('g.b').data(rows).join('g').attr('class', 'b').attr('transform', (d, i) => `translate(0,${y0 + i * bh})`).style('cursor', 'pointer');
  g.append('text').attr('x', left - 8).attr('y', bh / 2).attr('dy', '.35em').attr('text-anchor', 'end').style('fill', (d) => (d.code === H.s.country ? 'var(--color-fg)' : null)).style('font-weight', (d) => (d.code === H.s.country ? 600 : null)).text((d) => d.country);
  g.append('rect').attr('x', (d) => Math.min(x(0), x(d[field]))).attr('y', (bh - 12) / 2).attr('height', 12).attr('rx', 3).attr('width', (d) => Math.max(1, Math.abs(x(d[field]) - x(0))))
    .style('fill', (d) => (d.group === 'Global benchmark' ? 'var(--cds-chart-muted)' : d.code === H.s.country ? dash.colors[1] : `color-mix(in srgb, ${dash.colors[0]} 78%, var(--color-panel))`));
  g.append('text').attr('x', (d) => Math.max(x(0), x(d[field])) + 5).attr('y', bh / 2).attr('dy', '.35em').style('fill', 'var(--color-fg)').style('font-variant-numeric', 'tabular-nums').text((d) => fmt(d[field]))
    .each(function (d) { this.setAttribute('data-source', src); this.setAttribute('data-field', field); if (opt.where) this.setAttribute('data-where', opt.where(d)); });
  if (opt.ref != null) {
    svg.append('line').attr('x1', x(opt.ref)).attr('x2', x(opt.ref)).attr('y1', y0 - 6).attr('y2', y0 + rows.length * bh).style('stroke', 'var(--color-fg)').style('stroke-dasharray', '3 3');
    svg.append('text').attr('class', 'ref').attr('x', x(opt.ref) + 3).attr('y', y0 - 9).style('fill', 'var(--color-fg)').style('font-weight', 600).text(opt.refLabel || '');
  }
  const tip = H.tip(el);
  g.on('pointermove', (ev, d) => { const [px, py] = d3.pointer(ev, el); tip.textContent = opt.tip ? opt.tip(d) : `${d.country}: ${fmt(d[field])}`; H.place(el, tip, px, py); })
   .on('pointerleave', () => { tip.hidden = true; })
   .on('click', (ev, d) => { if (d.group === 'Global benchmark') return; H.s.country = d.code; H.redraw(); });
};
const f1 = (v) => d3.format(',.1f')(v), f0 = (v) => d3.format(',.0f')(v);

// ---------- workspace dashboard tiles ----------
dash.draw('wsfocus', (el) => { const m = H.ok('latest') ? H.countries() : new Map(); el.textContent = m.has(H.s.country) ? m.get(H.s.country)[0] : '—'; });
dash.draw('wkname', (el) => { const c = H.cat().get(el.dataset.ind); el.textContent = c ? c.name : '—'; });
dash.draw('wkcap', (el) => { const c = H.cat().get(el.dataset.ind); const r = H.row(H.s.country, el.dataset.ind); el.textContent = c ? `${c.unit}${r ? ' · ' + r.year : ''} · world ${H.fmtI(H.num((H.row('WLD', el.dataset.ind) || {}).value), c)}` : '—'; });
dash.draw('wkv', (el) => {
  const c = H.cat().get(el.dataset.ind); const r = H.row(H.s.country, el.dataset.ind);
  el.setAttribute('data-source', 'latest'); el.setAttribute('data-field', 'value'); el.setAttribute('data-where', H.where(H.s.country, el.dataset.ind));
  el.textContent = r ? H.fmtI(H.num(r.value), c) : '—';
});
dash.draw('wkd', (el) => {
  const r = H.vw(H.s.country, el.dataset.ind);
  el.setAttribute('data-source', 'vsworld'); el.setAttribute('data-field', 'diff'); el.setAttribute('data-where', `code=${H.s.country}&indicator=${el.dataset.ind}`);
  if (!r || r.diff == null) { el.textContent = '—'; el.style.background = 'none'; return; }
  el.textContent = (r.diff > 0 ? '+' : r.diff < 0 ? '−' : '') + H.fmtI(Math.abs(r.diff), H.cat().get(el.dataset.ind));
  const col = r.status === 'worse' ? 'var(--cds-chart-status-critical)' : r.status === 'better' ? dash.colors[0] : 'var(--color-fg-muted)';
  el.style.color = col; el.style.background = `color-mix(in srgb, ${col} 12%, transparent)`;
});

// ---------- Ministries ----------
dash.draw('prio', (ol) => {
  ol.replaceChildren(); const d = dash.data('vsworld'); if (d.status !== 'ok' || !d.data) return;
  const cat = H.cat();
  const rows = d.data.filter((r) => r.code === H.s.country && r.status === 'worse' && r.world).map((r) => ({...r, gap: Math.abs(r.value - r.world) / Math.abs(r.world)})).sort((a, b) => b.gap - a.gap).slice(0, 5);
  if (!rows.length) { const li = document.createElement('li'); li.textContent = 'No indicator is worse than the world average.'; ol.appendChild(li); return; }
  rows.forEach((r) => {
    const c = cat.get(r.indicator); const li = document.createElement('li'); li.style.cursor = 'pointer';
    const t = document.createElement('span'); t.className = 'sw-item'; t.textContent = c.name;
    const v = document.createElement('span'); v.className = 'sw-val'; const b = document.createElement('b'); b.textContent = H.fmtI(r.value, c);
    b.setAttribute('data-source', 'vsworld'); b.setAttribute('data-field', 'value'); b.setAttribute('data-where', `code=${r.code}&indicator=${r.indicator}`);
    v.append(b, ` ${c.unit} · world ${H.fmtI(r.world, c)} · ${Math.round(r.gap * 100)}% worse`);
    li.append(t, v); li.onclick = () => { H.s.ind = r.indicator; H.redraw(); H.go('explorer'); }; ol.appendChild(li);
  });
});
dash.draw('bestgap', (tb) => {
  tb.replaceChildren(); const d = dash.data('bestgap'); if (d.status !== 'ok' || !d.data) return;
  const cat = H.cat();
  d.data.filter((r) => r.code === H.s.country).sort((a, b) => (a.at_best - b.at_best) || (b.gap / (Math.abs(b.best_value) || 1)) - (a.gap / (Math.abs(a.best_value) || 1))).forEach((r) => {
    const c = cat.get(r.indicator); const tr = document.createElement('tr');
    const cell = (txt, cls, mark) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = txt; if (mark) { td.setAttribute('data-source', 'bestgap'); td.setAttribute('data-field', mark); td.setAttribute('data-where', `code=${r.code}&indicator=${r.indicator}`); } tr.appendChild(td); };
    cell(c.name); cell(H.fmtI(r.value, c), 'n', 'value'); cell(H.fmtI(r.best_value, c), 'n', 'best_value'); cell(r.best_country); cell(r.at_best ? 'Leader' : H.fmtI(r.gap, c), 'n', r.at_best ? null : 'gap');
    tb.appendChild(tr);
  });
});

// ---------- Payers ----------
dash.draw('cdl', (el) => {
  const d = dash.data('cdl'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
  H.rank(el, d.data.filter(H.inSub), 'index', 'cdl', f0, {ref: 100, refLabel: 'World = 100', label: 'Chronic disease load index', where: (r) => `code=${r.code}`, tip: (r) => `${r.country}: index ${r.index} (diabetes ${r.diabetes_idx}, obesity ${r.obesity_idx}, hypertension ${r.hypertension_idx})`});
});
dash.draw('growth', (el) => {
  const d = dash.data('growth'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
  H.rank(el, d.data.filter((r) => r.group !== 'Aggregate' && H.inSub(r)), 'cagr_pct', 'growth', (v) => f1(v) + '%', {ref: (d.data.find((r) => r.code === 'WLD') || {}).cagr_pct, refLabel: 'World', label: 'Annual growth in health spending per person', where: (r) => `code=${r.code}`, tip: (r) => `${r.country}: ${f1(r.cagr_pct)}% a year (US$${f0(r.he_pc_2013)} → US$${f0(r.he_pc_2023)})`});
});

// ---------- Pharma ----------
dash.draw('mai', (el) => {
  const d = dash.data('mai'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
  H.rank(el, d.data.filter((r) => r.preset === H.s.mai && H.inSub(r)), 'score', 'mai', f1, {label: 'Market attractiveness index', where: (r) => `code=${r.code}&preset=${r.preset}`, tip: (r) => `${r.country}: ${f1(r.score)} — burden ${r.burden}, ability to pay ${r.ability_to_pay}, size ${r.size}, research ${r.research}`});
});
dash.draw('maitable', (tb) => {
  tb.replaceChildren(); const d = dash.data('mai'); if (d.status !== 'ok' || !d.data) return;
  d.data.filter((r) => r.preset === H.s.mai && H.inSub(r)).sort((a, b) => b.score - a.score).forEach((r, i) => {
    const tr = document.createElement('tr'); if (r.code === H.s.country) tr.className = 'sel';
    [String(i + 1), r.country, ['score', f1(r.score)], ['burden', r.burden], ['ability_to_pay', r.ability_to_pay], ['size', r.size], ['research', r.research]].forEach((x, k) => {
      const td = document.createElement('td'); if (k > 1) td.className = 'n';
      if (Array.isArray(x)) { td.textContent = x[1]; td.setAttribute('data-source', 'mai'); td.setAttribute('data-field', x[0]); td.setAttribute('data-where', `code=${r.code}&preset=${r.preset}`); } else td.textContent = x;
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
});

// ---------- Providers ----------
dash.draw('capgap', (tb) => {
  tb.replaceChildren(); const d = dash.data('capgap'); if (d.status !== 'ok' || !d.data) return;
  d.data.filter((r) => r.code === H.s.country && r.target === H.s.cap).forEach((r) => {
    const tr = document.createElement('tr');
    const unit = r.resource === 'nurses' ? 'per 10,000' : 'per 1,000';
    [[r.label], [f1(r.current) + ' ' + unit, 'current'], [f1(r.target_value) + ' ' + unit, 'target_value'], [r.needed > 0 ? f0(r.needed) : 'Target met', r.needed > 0 ? 'needed' : null]].forEach(([txt, mark], k) => {
      const td = document.createElement('td'); if (k) td.className = 'n'; td.textContent = txt;
      if (mark) { td.setAttribute('data-source', 'capgap'); td.setAttribute('data-field', mark); td.setAttribute('data-where', `code=${r.code}&target=${r.target}&resource=${r.resource}`); }
      if (k === 3 && r.needed > 0) td.style.fontWeight = 600;
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
});
dash.draw('capbar', (el) => {
  const d = dash.data('capgap'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
  H.rank(el, d.data.filter((r) => r.target === H.s.cap && r.resource === 'physicians' && H.inSub(r)), 'needed', 'capgap', f0, {label: 'Additional physicians needed', where: (r) => `code=${r.code}&target=${r.target}&resource=physicians`, tip: (r) => `${r.country}: ${f0(r.needed)} more physicians (now ${f1(r.current)} per 1,000, target ${f1(r.target_value)})`});
});

// ---------- Investors ----------
dash.draw('market', (el) => {
  const d = dash.data('market'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
  H.rank(el, d.data.filter(H.inSub), 'size_bn', 'market', (v) => 'US$' + f1(v) + ' bn', {label: 'Health market size', where: (r) => `code=${r.code}`, tip: (r) => `${r.country}: US$${f1(r.size_bn)} bn (${f1(r.population_m)} m people × US$${f0(r.he_pc)} per person)`});
});

// ---------- Public health ----------
dash.draw('ppi', (el) => {
  const d = dash.data('ppi'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
  H.rank(el, d.data.filter(H.inSub), 'index', 'ppi', f0, {ref: 100, refLabel: 'World = 100', label: 'Prevention priority index', where: (r) => `code=${r.code}`, tip: (r) => `${r.country}: ${r.index} — obesity ${r.obesity_idx}, child obesity ${r.obesity_child_idx}, inactivity ${r.inactivity_idx}, tobacco ${r.tobacco_idx}, hypertension ${r.hypertension_idx}, PM2.5 ${r.pm25_idx}`});
});

// ---------- Data sub-tab ----------
dash.draw('wsdata', (wrap) => {
  wrap.replaceChildren(); if (!H.ok('latest', 'catalog')) return;
  const cat = H.cat(); const inds = wrap.dataset.inds.split(',').map((i) => cat.get(i)).filter(Boolean);
  const rows = dash.data('latest').data;
  const codes = [...new Set(rows.filter((r) => H.inSub(r) || r.group === 'Aggregate').map((r) => r.code))];
  const tbl = document.createElement('table'); const tr0 = document.createElement('tr'); const th0 = document.createElement('th'); th0.textContent = 'Country'; tr0.appendChild(th0);
  inds.forEach((c) => { const th = document.createElement('th'); th.className = 'n'; th.textContent = `${c.name} (${c.unit})`; tr0.appendChild(th); });
  const th = document.createElement('thead'); th.appendChild(tr0); tbl.appendChild(th); const tb = document.createElement('tbody');
  codes.forEach((code) => {
    const tr = document.createElement('tr'); if (code === H.s.country) tr.className = 'sel';
    const td0 = document.createElement('td'); td0.textContent = (rows.find((r) => r.code === code) || {}).country; tr.appendChild(td0);
    inds.forEach((c) => { const r = H.row(code, c.indicator); const td = document.createElement('td'); td.className = 'n'; td.textContent = r ? H.fmtI(H.val(r, c), c) : '—'; if (r && H.val(r, c) != null) H.mark(td, code, c.indicator, c); tr.appendChild(td); });
    tb.appendChild(tr);
  });
  tbl.appendChild(tb); wrap.appendChild(tbl);
});

// ---------- listeners: sub-tabs, presets, downloads ----------
document.querySelectorAll('.hd .shblock').forEach((blk) => {
  blk.querySelectorAll('.subtab').forEach((b) => b.addEventListener('click', () => {
    blk.querySelectorAll('.subtab').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    blk.querySelectorAll('.wsub').forEach((s) => { s.hidden = s.dataset.sub !== b.dataset.sub; });
    setTimeout(H.redraw, 0);
  }));
});
document.querySelectorAll('.hd .seg[data-state] button').forEach((b) => b.addEventListener('click', () => {
  const seg = b.closest('.seg'); const key = seg.dataset.state;
  document.querySelectorAll(`.hd .seg[data-state="${key}"] button`).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === b.dataset.v)));
  H.s[key] = b.dataset.v; H.redraw();
}));
document.querySelectorAll('.hd [data-preset-x]').forEach((b) => b.addEventListener('click', () => { H.s.x = b.dataset.presetX; H.s.y = b.dataset.presetY; H.go('relations'); H.redraw(); }));
document.querySelectorAll('.hd [data-dlinds]').forEach((b) => b.addEventListener('click', () => {
  const ids = b.dataset.dlinds.split(','); const cat = H.cat();
  const rows = dash.data('latest').data.filter((r) => ids.includes(r.indicator)).map((r) => ({country: r.country, group: r.group, indicator: (cat.get(r.indicator) || {}).name, unit: (cat.get(r.indicator) || {}).unit, year: r.year, value: r.value, women: r.female, men: r.male, source: (cat.get(r.indicator) || {}).source}));
  H.download(`${b.dataset.name || 'workspace'}_indicators.csv`, H.csv(rows, ['country', 'group', 'indicator', 'unit', 'year', 'value', 'women', 'men', 'source']));
}));
document.querySelectorAll('.hd [data-dlcalc]').forEach((b) => b.addEventListener('click', () => {
  const d = dash.data(b.dataset.dlcalc); if (d.status !== 'ok' || !d.data || !d.data.length) return;
  H.download(`${b.dataset.dlcalc}.csv`, H.csv(d.data, Object.keys(d.data[0])));
}));
// Redraw after the workspace switch (charts drawn while hidden have no width)
document.querySelectorAll('.hd #shchips .chip').forEach((b) => b.addEventListener('click', () => setTimeout(H.redraw, 0)));

})();
