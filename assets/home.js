(function(){
// Home page, country SWOT and data downloads
const H = window.HD;
H.names.push('statn', 'swotsel', 'swotq', 'swotsum', 'dlcount');

dash.calc('stats', {
  inputs: ['latest', 'series', 'catalog', 'trials_live'],
  title: 'Platform coverage',
  description: 'Counts of countries, indicators, data points and active clinical trials held in the platform.',
  fn: (latest, series, catalog, trials) => [
    {key: 'countries', value: new Set(latest.filter((r) => !['Aggregate', 'Global benchmark'].includes(r.group)).map((r) => r.code)).size},
    {key: 'indicators', value: catalog.length},
    {key: 'datapoints', value: latest.length + series.length},
    {key: 'trials', value: trials.reduce((s, t) => s + Number(t.active_trials || 0), 0)}
  ]
});

dash.calc('swot', {
  inputs: ['latest', 'catalog', 'trials_live'],
  title: 'Country SWOT (rule-based)',
  description: 'Strengths and weaknesses: indicators at least 10% better or worse than the world average (top 6 by gap). Potential and risks: fixed screening rules on the latest values, listed with each rule. Both sexes. A screening aid, not advice.',
  fn: (latest, catalog, trials) => {
    const get = (code, id) => { const r = latest.find((x) => x.code === code && x.indicator === id); return r && r.value !== '' ? Number(r.value) : null; };
    const cat = new Map(catalog.map((c) => [c.indicator, c]));
    const codes = [...new Set(latest.filter((r) => !['Aggregate', 'Global benchmark'].includes(r.group)).map((r) => r.code))];
    const name = (code) => (latest.find((r) => r.code === code) || {}).country;
    const rules = {
      Potential: [
        ['diabetes', (v) => v >= 15, 'Large diabetes population (≥15% of adults): demand for cardiometabolic care, trials and real-world evidence'],
        ['obesity', (v) => v >= 30, 'High adult obesity (≥30%): market for anti-obesity medicines, bariatric and lifestyle programmes'],
        ['he_pc', (v) => v >= 1000, 'High health spending per person (≥US$1,000): strong ability to pay for innovation'],
        ['uhc', (v) => v >= 80, 'Broad service coverage (UHC ≥80): mature system ready for value-based care and data partnerships'],
        ['hyp_control', (v) => v < 20, 'Under 20% of hypertension controlled: large disease-management and adherence opportunity'],
        ['oop', (v) => v >= 30, 'High out-of-pocket share (≥30%): room for insurance expansion and affordable care models'],
        ['age65', (v) => v < 5, 'Young population (<5% aged 65+): long horizon for prevention and digital-health adoption'],
        ['trials_pm', (v) => v >= 5, 'Active research base (≥5 open trials per million people): trial-site partnerships']
      ],
      Risk: [
        ['ncd_3070', (v) => v >= 15, 'High premature NCD mortality (≥15%): rising burden on hospitals and payers'],
        ['inactivity', (v) => v >= 40, 'Over 40% of adults inactive: chronic disease likely to keep growing'],
        ['tobacco', (v) => v >= 25, 'High tobacco use (≥25%): future cancer, heart and lung disease'],
        ['physicians', (v) => v < 1.5, 'Fewer than 1.5 physicians per 1,000: workforce shortage limits capacity'],
        ['oop', (v) => v >= 40, 'Out-of-pocket share ≥40%: financial hardship and unmet need'],
        ['pm25', (v) => v >= 35, 'Air pollution PM2.5 ≥35 µg/m³: respiratory and cardiovascular risk'],
        ['he_gdp', (v) => v < 4, 'Health spending under 4% of GDP: limited public investment'],
        ['obesity_child', (v) => v >= 20, 'Child obesity ≥20%: tomorrow\'s diabetes and heart disease']
      ]
    };
    const out = [];
    codes.forEach((code) => {
      const gaps = [];
      catalog.forEach((c) => {
        if (c.better === 'none') return;
        const v = get(code, c.indicator), w = get('WLD', c.indicator); if (v == null || w == null || w === 0) return;
        const rel = (v - w) / Math.abs(w), good = c.better === 'lower' ? -rel : rel;
        if (Math.abs(good) >= 0.1) gaps.push({c, v, w, good});
      });
      ['Strength', 'Weakness'].forEach((q) => gaps.filter((g) => (q === 'Strength' ? g.good > 0 : g.good < 0)).sort((a, b) => Math.abs(b.good) - Math.abs(a.good)).slice(0, 6)
        .forEach((g) => out.push({code, country: name(code), quadrant: q, indicator: g.c.indicator, item: g.c.name, value: g.v, world: g.w, unit: g.c.unit, note: `${Math.round(Math.abs(g.good) * 100)}% ${g.good > 0 ? 'better' : 'worse'} than world`})));
      Object.entries(rules).forEach(([q, list]) => list.forEach(([id, test, text]) => {
        let v;
        if (id === 'trials_pm') { const t = trials.find((x) => x.code === code); const p = get(code, 'population'); v = t && p ? Math.round(Number(t.active_trials) / (p / 1e6) * 10) / 10 : null; }
        else v = get(code, id);
        if (v != null && test(v)) out.push({code, country: name(code), quadrant: q, indicator: id, item: text, value: v, world: id === 'trials_pm' ? null : get('WLD', id), unit: id === 'trials_pm' ? 'per million people' : (cat.get(id) || {}).unit, note: 'Screening rule'});
      }));
    });
    return out;
  }
});

// ---------- Home ----------
dash.draw('statn', (el) => {
  const d = dash.data('stats'); const r = d.status === 'ok' && d.data ? d.data.find((x) => x.key === el.dataset.key) : null;
  el.textContent = r ? d3.format(',')(r.value) : '—';
});
document.querySelectorAll('.hd [data-go]').forEach((b) => b.addEventListener('click', () => {
  H.go(b.dataset.go);
  if (b.dataset.sh) document.querySelectorAll(`.hd #shchips .chip[data-sh="${b.dataset.sh}"]`).forEach((c) => c.click());
}));

// ---------- SWOT ----------
dash.draw('swotsel', (sel) => {
  if (!H.ok('latest')) return;
  const m = new Map(); dash.data('latest').data.forEach((r) => { if (!['Aggregate', 'Global benchmark'].includes(r.group) && !m.has(r.code)) m.set(r.code, r.country); });
  H.optList(sel, [...m].map(([c, n]) => [c, n]), H.s.country);
  sel.onchange = () => { H.s.country = sel.value; H.redraw(); };
});
dash.draw('swotsum', (el) => {
  const d = dash.data('swot'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
  const rows = d.data.filter((r) => r.code === H.s.country); const n = (q) => rows.filter((r) => r.quadrant === q).length;
  el.textContent = `${rows[0] ? rows[0].country : '—'}: ${n('Strength')} strengths, ${n('Weakness')} weaknesses, ${n('Potential')} areas of potential and ${n('Risk')} risks flagged.`;
});
dash.draw('swotq', (ul) => {
  ul.replaceChildren();
  const d = dash.data('swot'); if (d.status !== 'ok' || !d.data) return;
  const c = H.cat();
  const rows = d.data.filter((r) => r.code === H.s.country && r.quadrant === ul.dataset.q);
  if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Nothing flagged on the current indicators.'; ul.appendChild(li); return; }
  rows.forEach((r) => {
    const li = document.createElement('li'); li.style.cursor = r.indicator === 'trials_pm' ? 'default' : 'pointer';
    const t = document.createElement('span'); t.className = 'sw-item'; t.textContent = r.item;
    const v = document.createElement('span'); v.className = 'sw-val';
    const num = document.createElement('b'); num.textContent = H.fmtI(r.value, c.get(r.indicator)) ; num.setAttribute('data-source', 'swot'); num.setAttribute('data-field', 'value'); num.setAttribute('data-where', `code=${r.code}&quadrant=${r.quadrant}&indicator=${r.indicator}`);
    v.append(num, ` ${r.unit || ''}`);
    if (r.world != null) v.append(` · world ${H.fmtI(r.world, c.get(r.indicator))}`);
    if (r.note && r.note !== 'Screening rule') { const s = document.createElement('em'); s.textContent = ` · ${r.note}`; v.appendChild(s); }
    li.append(t, v);
    if (r.indicator !== 'trials_pm') li.onclick = () => { H.s.ind = r.indicator; H.redraw(); H.go('explorer'); };
    ul.appendChild(li);
  });
});

// ---------- Downloads ----------
dash.draw('dlcount', (el) => {
  const id = el.dataset.ds; const d = dash.data(id);
  el.textContent = d.status === 'ok' && Array.isArray(d.data) ? `${d3.format(',')(d.data.length)} rows` : d.status === 'loading' ? 'loading…' : '—';
});
H.csv = (rows, cols) => {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
};
H.download = (name, text) => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + text], {type: 'text/csv;charset=utf-8'})); a.download = name;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
document.querySelectorAll('.hd [data-dl]').forEach((b) => b.addEventListener('click', () => {
  const what = b.dataset.dl;
  const country = H.s.country;
  if (what === 'profile') {
    const cat = H.cat(); const rows = dash.data('latest').data.filter((r) => r.code === country || r.code === 'REG' || r.code === 'WLD');
    const out = [...cat.values()].map((c) => { const g = (code) => (rows.find((r) => r.code === code && r.indicator === c.indicator) || {}); const me = g(country);
      return {country: me.country || country, indicator: c.name, category: c.category, unit: c.unit, value: me.value, women: me.female, men: me.male, year: me.year, regional_average: g('REG').value, world: g('WLD').value, source: c.source}; });
    H.download(`profile_${country}.csv`, H.csv(out, ['country', 'indicator', 'category', 'unit', 'value', 'women', 'men', 'year', 'regional_average', 'world', 'source']));
    return;
  }
  if (what === 'swot_country' || what === 'swot_all') {
    const d = dash.data('swot'); if (d.status !== 'ok' || !d.data) return;
    const rows = what === 'swot_all' ? d.data : d.data.filter((r) => r.code === country);
    H.download(what === 'swot_all' ? 'swot_all_countries.csv' : `swot_${country}.csv`, H.csv(rows, ['country', 'quadrant', 'item', 'value', 'unit', 'world', 'note']));
    return;
  }
  const d = dash.data(what); if (d.status !== 'ok' || !Array.isArray(d.data)) return;
  const cols = d.columns || Object.keys(d.data[0] || {});
  H.download(`${what}.csv`, H.csv(d.data, cols));
}));

})();
