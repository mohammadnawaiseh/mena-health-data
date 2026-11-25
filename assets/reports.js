/* MENA Health Data — Reports tab: Country Health Brief, Stakeholder Market Brief, Disease Spotlight.
   Each report is built from the site's data in the visitor's browser and saved as PDF with the browser's print dialog. */
(function () {
const H = window.HD, X = H.X;
const R = H.rp = {type: 'country', code: 'ARE', sh: 'ministries', dis: 'diabetes', scope: 'MENA'};
const SH = {
  ministries: {name: 'Ministries & regulators', q: 'Where is the system on track, and where is the chronic-disease burden heading?', inds: ['life_exp', 'hale', 'ncd_3070', 'uhc', 'u5mr', 'mmr', 'diabetes', 'obesity', 'he_gdp'], mods: ['gauges', 'tmDeaths']},
  payers: {name: 'Payers & insurers', q: 'Where are costs and financial risk concentrated?', inds: ['he_pc', 'he_gdp', 'oop', 'uhc', 'diabetes', 'obesity', 'hypertension', 'hyp_control'], mods: ['fc:he_pc', 'fc:oop', 'tmDalys']},
  pharma: {name: 'Pharma & CROs', q: 'How large is the disease burden, how well is it treated, and how active is clinical research?', inds: ['diabetes', 'obesity', 'hypertension', 'hyp_control', 'cvd_rate', 'diab_death', 'he_pc', 'population'], mods: ['trials', 'tmDalys']},
  providers: {name: 'Hospitals & providers', q: 'Is capacity keeping up with demand?', inds: ['physicians', 'nurses', 'beds', 'uhc', 'age65', 'diabetes', 'cvd_rate', 'oop'], mods: ['workforce', 'fc:life_exp', 'tmDeaths']},
  investors: {name: 'Investors & health-tech', q: 'How big is the market and how fast is health spending growing?', inds: ['population', 'gdp_pc', 'he_pc', 'he_gdp', 'oop', 'age65', 'uhc', 'diabetes'], mods: ['market', 'fc:he_pc', 'trials']},
  publichealth: {name: 'Public health & researchers', q: 'Which modifiable risks matter most, and is prevention working?', inds: ['obesity', 'obesity_child', 'tobacco', 'inactivity', 'hypertension', 'pm25', 'road', 'ncd_3070'], mods: ['gauges', 'fc:obesity', 'tmDalys']}
};
const DIS = {
  diabetes: {name: 'Diabetes', ghe: '800', ct: 'diabetes', pm: '"diabetes mellitus"[MeSH Terms]', inds: ['diabetes', 'diab_death', 'obesity', 'inactivity', 'hyp_control'], why: 'Diabetes drives kidney failure, heart disease, blindness and amputations, and the region has some of the highest adult prevalence in the world.'},
  cvd: {name: 'Cardiovascular disease', ghe: '1100', ct: 'cardiovascular disease', pm: '"cardiovascular diseases"[MeSH Terms]', inds: ['cvd_rate', 'stroke_rate', 'hypertension', 'hyp_control', 'tobacco'], why: 'Heart disease and stroke are the leading causes of death across the region; most of the risk is preventable or treatable.'},
  cancer: {name: 'Cancer', ghe: '610', ct: 'cancer', pm: '"neoplasms"[MeSH Terms]', inds: ['tobacco', 'obesity', 'ncd_3070', 'age65'], why: 'Cancer deaths rise as populations age; screening, early diagnosis and tobacco control decide much of the outcome.'},
  resp: {name: 'Chronic respiratory disease', ghe: '1170', ct: 'asthma OR COPD', pm: '("pulmonary disease, chronic obstructive"[MeSH Terms] OR "asthma"[MeSH Terms])', inds: ['tobacco', 'pm25'], why: 'COPD and asthma are driven by tobacco and air pollution — both high in parts of the region.'},
  mental: {name: 'Mental health & substance use', ghe: '820', ct: 'depression OR anxiety', pm: '"mental disorders"[MeSH Terms]', inds: [], dalys: true, why: 'Mental disorders cause few deaths but a large share of years lived with disability, so healthy years lost (DALYs) is the better measure.'},
  kidney: {name: 'Chronic kidney disease', ghe: '1270', ct: 'chronic kidney disease', pm: '"renal insufficiency, chronic"[MeSH Terms]', inds: ['diabetes', 'hypertension', 'hyp_control'], why: 'Kidney disease follows diabetes and high blood pressure; late detection leads to costly dialysis.'}
};
const CT = 'https://clinicaltrials.gov/api/v2/studies', EU = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
const CTNAME = {ARE: 'United Arab Emirates'};
const cache = new Map();
const once = (key, fn) => { if (!cache.has(key)) { const e = {status: 'loading', data: null}; cache.set(key, e); fn().then((d) => { e.status = 'ok'; e.data = d; }).catch((err) => { e.status = 'error'; e.msg = String(err); }).then(() => dash.draw('rp-body')); } return cache.get(key); };
const getJSON = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
const ctCount = (code, cond) => once(`ct|${code}|${cond}`, () => getJSON(`${CT}?query.cond=${encodeURIComponent(cond)}&query.locn=${encodeURIComponent(`AREA[LocationCountry]"${CTNAME[code] || X.name(code)}"`)}&filter.overallStatus=RECRUITING,NOT_YET_RECRUITING&countTotal=true&pageSize=1`).then((j) => j.totalCount));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pmLatest = (cond, scope) => once(`pm|${cond}|${scope}`, async () => {
  const names = scope === 'MENA' ? X.countries().map((c) => CTNAME[c.code] || c.name) : [CTNAME[scope] || X.name(scope)];
  const place = '(' + names.map((n) => `"${n}"[Title/Abstract] OR "${n}"[MeSH Terms]`).join(' OR ') + ')';
  const term = `${cond} AND ${place} AND free full text[sb] AND ("2022"[dp] : "3000"[dp])`;
  const s = await getJSON(`${EU}esearch.fcgi?db=pubmed&retmode=json&sort=pub_date&retmax=5&term=${encodeURIComponent(term)}`);
  const ids = (s.esearchresult && s.esearchresult.idlist) || []; const count = +(s.esearchresult && s.esearchresult.count) || 0;
  if (!ids.length) return {count, items: []};
  await sleep(400);
  const j = await getJSON(`${EU}esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`);
  return {count, items: ids.map((i) => j.result[i]).filter(Boolean).map((a) => ({pmid: a.uid, title: a.title, journal: a.source, date: a.pubdate, first: ((a.authors || [])[0] || {}).name || '', doi: ((a.articleids || []).find((x) => x.idtype === 'doi') || {}).value || ''}))};
});

// ---------- small DOM builders ----------
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const LOGO = '<svg width="34" height="34" viewBox="0 0 52 52" aria-hidden="true"><rect width="52" height="52" rx="12" fill="#1d4e89"/><polyline points="9,36 14,22 19,36 23,27 26,16 29,33 33,27 38,22 43,36" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="26" cy="16" r="2.6" fill="#e2711d"/></svg>';
const head = (kind, title, sub) => {
  const h = el('header', 'r-head');
  const brand = el('div', 'r-brand'); brand.innerHTML = LOGO; brand.append(el('span', '', 'MENA Health Data'));
  const d = new Date(); brand.append(el('span', 'r-date', `${kind} · ${d.toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'})}`));
  h.append(brand, el('h1', '', title)); if (sub) h.append(el('p', 'r-sub', sub)); return h;
};
const sec = (title, note) => { const s = el('section', 'r-sec'); s.append(el('h2', '', title)); if (note) s.append(el('p', 'r-note', note)); return s; };
const chartBox = (cls = '') => el('div', 'chart r-chart ' + cls);
const fmtV = (v, c) => (v == null ? '—' : H.fmtI(v, c));
const kpis = (code, inds) => {
  const cat = H.cat(); const g = el('div', 'r-kpis');
  inds.forEach((i) => {
    const c = cat.get(i); if (!c) return; const r = H.row(code, i); const v = r && r.value !== '' ? +r.value : null;
    const reg = X.latest('REG', i), w = X.latest('WLD', i);
    const t = el('div', 'r-kpi'); t.append(el('div', 'k-name', c.name), el('div', 'k-val', fmtV(v, c)), el('div', 'k-unit', `${c.unit}${r && r.year ? ' · ' + r.year : ''}`));
    if (v != null && w) {
      const s = H.status(v, w.value, c.better);
      const cmp = el('div', 'k-cmp'); const word = c.better === 'none' ? (v > w.value ? 'above' : 'below') : (s >= 0.1 ? 'better than' : s <= -0.1 ? 'worse than' : 'close to');
      cmp.textContent = `${c.better === 'none' ? '' : s >= 0.1 ? '▲ ' : s <= -0.1 ? '▼ ' : '● '}${word} world (${fmtV(w.value, c)})` + (reg ? ` · region ${fmtV(reg.value, c)}` : '');
      if (c.better !== 'none') cmp.style.color = s >= 0.1 ? 'var(--cds-chart-status-good)' : s <= -0.1 ? 'var(--cds-chart-status-critical)' : 'var(--color-fg-muted)';
      t.append(cmp);
    }
    g.append(t);
  });
  return g;
};
const swotBlock = (rows) => {
  const g = el('div', 'r-swot');
  [['Strength', 'Strengths'], ['Weakness', 'Weaknesses'], ['Potential', 'Potential'], ['Risk', 'Risks']].forEach(([q, t]) => {
    const b = el('div', 'r-swq r-swq-' + q.toLowerCase()); b.append(el('h3', '', t)); const ul = el('ul');
    const list = rows.filter((r) => r.quadrant === q).slice(0, 4);
    if (!list.length) ul.append(el('li', 'muted', 'None flagged'));
    list.forEach((r) => { const li = el('li'); li.append(el('b', '', r.item)); if (r.note) li.append(' — ' + r.note); ul.append(li); });
    b.append(ul); g.append(b);
  });
  return g;
};
const barList = (box, rows, opts = {}) => { // rows: {label, value, hi}
  const W = box.clientWidth || 680, rowH = 22, M = {l: opts.left || 150, r: 70}; const Hh = rows.length * rowH + 6;
  const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => r.value) || 1]).range([0, W - M.l - M.r]);
  const svg = d3.select(box).append('svg').attr('width', W).attr('height', Hh).attr('role', 'img').attr('aria-label', opts.label || 'Bar chart');
  const g = svg.selectAll('g').data(rows).join('g').attr('transform', (d, i) => `translate(0,${i * rowH})`);
  const maxCh = Math.floor((M.l - 10) / 6.9);
  g.append('text').attr('x', M.l - 8).attr('y', rowH / 2).attr('dy', '0.35em').attr('text-anchor', 'end').text((d) => (d.label.length > maxCh ? d.label.slice(0, maxCh - 1) + '…' : d.label)).style('font-weight', (d) => (d.hi ? 700 : 400)).style('fill', (d) => (d.hi ? 'var(--color-fg)' : null));
  g.append('rect').attr('x', M.l).attr('y', 4).attr('height', rowH - 8).attr('rx', 4).attr('width', (d) => Math.max(2, x(d.value))).attr('fill', (d) => (d.hi ? 'var(--hd-c1)' : 'var(--hd-c0)'));
  g.append('text').attr('x', (d) => M.l + Math.max(2, x(d.value)) + 6).attr('y', rowH / 2).attr('dy', '0.35em').text((d) => (opts.fmt || d3.format(',.1f'))(d.value));
};
const sources = (extra = []) => {
  const s = sec('Sources & notes'); const ul = el('ul', 'r-src');
  ['Indicators: World Bank World Development Indicators (CC BY 4.0) and WHO Global Health Observatory (CC BY-NC-SA 3.0 IGO).', 'Causes of death and healthy years lost: WHO Global Health Estimates 2023 (deaths and DALYs, both sexes, all ages).', ...extra,
    'Targets: UN Sustainable Development Goals and WHO global NCD, workforce and air-quality targets, as labelled.',
    'Rule-based screening and straight-line projections are a starting point for discussion, not advice. Check primary sources before citing.'].forEach((t) => ul.append(el('li', '', t)));
  s.append(ul); const f = el('p', 'r-foot'); f.innerHTML = 'MENA Health Data — free, open health intelligence for 14 MENA countries · <a href="https://mohammadnawaiseh.github.io/mena-health-data/">mohammadnawaiseh.github.io/mena-health-data</a>'; s.append(f); return s;
};
const later = []; // charts are drawn after the article is in the page, so they know their width
const addChart = (parent, fn, cls) => { const b = chartBox(cls); parent.append(b); later.push(() => fn(b)); return b; };
const trialsBlock = (s, code) => {
  const t = dash.data('trials_live'); const r = t.status === 'ok' ? t.data.find((x) => x.code === code) : null;
  const pop = X.latest(code, 'population');
  if (r) {
    const total = +r.active_trials, cardio = +r.cardiometabolic_trials; const per = pop ? total / (pop.value / 1e6) : null;
    s.append(el('p', '', `${d3.format(',')(total)} clinical trials are recruiting or about to recruit with a site in ${X.name(code)}${per != null ? ` (${d3.format('.1f')(per)} per million people)` : ''}; ${d3.format(',')(cardio)} of them match cardiometabolic keywords. Source: ClinicalTrials.gov${r.counted === 'live' ? ', counted live today' : ', ' + r.counted}.`));
    const rows = t.data.filter((x) => x.code && X.countries().some((c) => c.code === x.code)).map((x) => ({label: X.name(x.code), value: +x.active_trials, hi: x.code === code})).sort((a, b) => b.value - a.value);
    addChart(s, (b) => barList(b, rows, {label: 'Open clinical trials by country', fmt: d3.format(',')}));
  } else s.append(el('p', 'r-note', 'Trial counts are loading…'));
};
const pubmedBlock = (s, d, scope) => {
  const e = pmLatest(d.pm, scope);
  if (e.status !== 'ok') { s.append(el('p', 'r-note', e.status === 'error' ? 'PubMed could not be reached just now.' : 'Searching PubMed…')); return; }
  s.append(el('p', '', `${d3.format(',')(e.data.count)} free full-text articles since 2022 in PubMed mention ${d.name.toLowerCase()} and ${scope === 'MENA' ? 'a MENA country' : X.name(scope)}. The newest:`));
  const ol = el('ol', 'r-pubs');
  e.data.items.forEach((a) => { const li = el('li'); li.append(el('b', '', a.title.replace(/\.$/, '')), ` ${a.first ? a.first + ' et al. ' : ''}${a.journal}, ${a.date}. `); const lk = el('a', '', a.doi ? 'doi:' + a.doi : 'PMID ' + a.pmid); lk.href = a.doi ? 'https://doi.org/' + a.doi : 'https://pubmed.ncbi.nlm.nih.gov/' + a.pmid + '/'; li.append(lk); ol.append(li); });
  s.append(ol, el('p', 'r-note', 'Source: PubMed, U.S. National Library of Medicine — searched live when this report was opened.'));
};

// ---------- report 1: Country Health Brief ----------
const countryBrief = (code) => {
  const a = el('article', 'report'); const name = X.name(code);
  a.append(head('Country Health Brief', `${name}: country health brief`, 'Key indicators, causes of death, progress on global targets, trends, risks and research activity.'));
  const le = X.latest(code, 'life_exp'), lew = X.latest('WLD', 'life_exp'); const top = X.topCauses(code, 'deaths', 3);
  const met = X.TARGETS.map((t) => X.assess(code, t)).filter((r) => r.status !== 'nodata'); const ok = met.filter((r) => ['met', 'ontrack'].includes(r.status)).length;
  const s0 = sec('At a glance'); const ul = el('ul', 'r-bul');
  if (le && lew) ul.append(el('li', '', `Life expectancy is ${d3.format('.1f')(le.value)} years (${le.year}), ${le.value >= lew.value ? d3.format('.1f')(le.value - lew.value) + ' years above' : d3.format('.1f')(lew.value - le.value) + ' years below'} the world average.`));
  if (top.length) ul.append(el('li', '', `The leading causes of death are ${top.map((t) => `${t.title.toLowerCase()} (${d3.format('.0%')(t.share)})`).join(', ')} — WHO estimates for 2023.`));
  ul.append(el('li', '', `It meets or is on track for ${ok} of the ${met.length} health targets with data.`));
  s0.append(ul); a.append(s0);
  const s1 = sec('Key indicators', '▲ better / ▼ worse than the world average by 10% or more.'); s1.append(kpis(code, ['life_exp', 'hale', 'u5mr', 'ncd_3070', 'diabetes', 'obesity', 'uhc', 'he_pc', 'oop'])); a.append(s1);
  const s2 = sec('What people die from', 'Share of all deaths by cause, 2023. Blue = noncommunicable, orange = communicable, maternal & nutritional, teal = injuries.'); addChart(s2, (b) => X.treemap(b, code, 'deaths', null, {static: true, height: 300})); a.append(s2);
  const s3 = sec('Progress on global health targets'); addChart(s3, (b) => X.gauges(b, code, {noKey: false})); a.append(s3);
  const s4 = sec('Trends and 2030 projections', 'Solid line = history, dashed = straight-line projection with 80% range, grey = regional average, dotted = target.'); const g4 = el('div', 'r-grid2');
  ['obesity', 'ncd_3070', 'uhc', 'oop'].forEach((i) => { const w = el('div'); w.append(el('h3', '', (H.cat().get(i) || {}).name)); addChart(w, (b) => X.fcChart(b, code, i, true, {height: 190})); g4.append(w); });
  s4.append(g4); a.append(s4);
  const sw = dash.data('swot'); const s5 = sec('SWOT', 'Rule-based screening against world averages and fixed thresholds.');
  s5.append(sw.status === 'ok' ? swotBlock(sw.data.filter((r) => r.code === code)) : el('p', 'r-note', 'Loading…')); a.append(s5);
  const s6 = sec('Clinical trials'); trialsBlock(s6, code); a.append(s6);
  const rc = dash.data('rescountry');
  if (rc.status === 'ok') {
    const s7 = sec('Research focus', 'Health-sciences papers with an author in the country, 2021–2025, by research area (OpenAlex).');
    const rows = rc.data.filter((r) => r.code === code && r.period === 'recent').map((r) => ({label: r.area, value: +r.papers})).sort((x, y) => y.value - x.value).slice(0, 8);
    addChart(s7, (b) => barList(b, rows, {left: 230, fmt: d3.format(','), label: 'Papers by research area'})); a.append(s7);
  }
  a.append(sources(['Clinical trials: ClinicalTrials.gov (public domain). Research output: OpenAlex (CC0).']));
  return a;
};

// ---------- report 2: Stakeholder Market Brief ----------
const marketBrief = (sh, code) => {
  const d = SH[sh]; const a = el('article', 'report'); const name = X.name(code);
  a.append(head('Stakeholder Market Brief', `${name}: brief for ${d.name.toLowerCase()}`, d.q));
  const ss = dash.data('swot_sh'); const rows = ss.status === 'ok' ? ss.data.filter((r) => r.code === code && r.stakeholder === sh) : [];
  const s0 = sec('At a glance'); const ul = el('ul', 'r-bul');
  const cnt = (q) => rows.filter((r) => r.quadrant === q).length;
  ul.append(el('li', '', `Screening flags ${cnt('Strength')} strengths, ${cnt('Weakness')} weaknesses, ${cnt('Potential')} opportunities and ${cnt('Risk')} risks for ${d.name.toLowerCase()} in ${name}.`));
  const pop = X.latest(code, 'population'), pc = X.latest(code, 'he_pc');
  if (pop && pc) ul.append(el('li', '', `Total health spending is about US$${d3.format(',.1f')(pop.value * pc.value / 1e9)} billion a year (${pc.year}): ${d3.format(',.0f')(pc.value)} per person for ${d3.format('.1f')(pop.value / 1e6)} million people.`));
  const f = X.forecast(code, 'he_pc', true); if (f) ul.append(el('li', '', `Health spending per person has grown by about US$${d3.format(',.0f')(f.slope)} a year; on that trend it reaches about US$${d3.format(',.0f')(f.proj[f.proj.length - 1].value)} by 2030.`));
  s0.append(ul); a.append(s0);
  const s1 = sec('Indicators that matter for ' + d.name.toLowerCase()); s1.append(kpis(code, d.inds)); a.append(s1);
  const s2 = sec('SWOT for ' + d.name.toLowerCase()); s2.append(ss.status === 'ok' ? swotBlock(rows) : el('p', 'r-note', 'Loading…')); a.append(s2);
  d.mods.forEach((m) => {
    if (m === 'gauges') { const s = sec('Progress on global health targets'); addChart(s, (b) => X.gauges(b, code)); a.append(s); }
    if (m === 'tmDeaths' || m === 'tmDalys') { const y = m === 'tmDalys'; const s = sec(y ? 'Where healthy years are lost' : 'What people die from', y ? 'Share of disability-adjusted life years (DALYs) by cause, 2023 — counts both early death and years lived with illness.' : 'Share of all deaths by cause, 2023.'); addChart(s, (b) => X.treemap(b, code, y ? 'dalys' : 'deaths', null, {static: true, height: 280})); a.append(s); }
    if (m.startsWith('fc:')) { const i = m.slice(3); const c = H.cat().get(i) || {}; const s = sec(`${c.name}: trend and 2030 projection`, 'Straight-line projection with 80% range; grey = regional average.'); addChart(s, (b) => X.fcChart(b, code, i, true, {height: 220})); a.append(s); }
    if (m === 'trials') { const s = sec('Clinical trial activity'); trialsBlock(s, code); a.append(s); }
    if (m === 'workforce') { const s = sec('Health workforce vs WHO threshold'); const t = X.TARGETS.find((x) => x.id === 'workforce'); const r = X.assess(code, t); s.append(el('p', '', r.value == null ? 'No workforce data.' : `${d3.format('.1f')(r.value)} doctors, nurses and midwives per 10,000 people against the WHO threshold of 44.5 — ${X.STATUS[r.status][1].toLowerCase()}.`)); const rows2 = X.countries().map((c) => ({label: c.name, value: X.assess(c.code, t).value, hi: c.code === code})).filter((x) => x.value != null).sort((x, y) => y.value - x.value); addChart(s, (b) => barList(b, rows2, {label: 'Health workers per 10,000 people'})); a.append(s); }
    if (m === 'market') { const s = sec('Market size across the region', 'Total health spending = population × health spending per person (latest year, US$ billion).'); const rows2 = X.countries().map((c) => { const p = X.latest(c.code, 'population'), h = X.latest(c.code, 'he_pc'); return {label: c.name, value: p && h ? p.value * h.value / 1e9 : null, hi: c.code === code}; }).filter((x) => x.value != null).sort((x, y) => y.value - x.value); addChart(s, (b) => barList(b, rows2, {label: 'Health spending, US$ billion'})); a.append(s); }
  });
  const rt = dash.data('restrend'), ev = dash.data('evidence');
  const s3 = sec('Research and evidence');
  if (rt.status === 'ok') {
    const ys = rt.data.filter((r) => r.stakeholder === sh && r.code === code); const sum = (a1, b1) => d3.sum(ys.filter((r) => +r.year >= a1 && +r.year <= b1), (r) => +r.papers);
    const e1 = sum(2016, 2020), e2 = sum(2021, 2025);
    s3.append(el('p', '', `${d3.format(',')(e2)} papers on this group's topics had an author in ${name} in 2021–2025, against ${d3.format(',')(e1)} in 2016–2020${e1 ? ` (${e2 >= e1 ? '+' : ''}${d3.format('.0%')((e2 - e1) / e1)})` : ''}. Source: OpenAlex.`));
  }
  if (ev.status === 'ok') {
    const list = ev.data.filter((r) => r.stakeholder === sh).sort((x, y) => (y.scope.includes(name) - x.scope.includes(name)) || (+y.year - +x.year)).slice(0, 4);
    if (list.length) { s3.append(el('p', '', 'Selected open-access studies:')); const ol = el('ol', 'r-pubs'); list.forEach((r) => { const li = el('li'); li.append(el('b', '', r.title), ` ${r.first_author} et al., ${r.journal} ${r.year}. ${r.key_finding} `); const lk = el('a', '', 'doi:' + r.doi); lk.href = 'https://doi.org/' + r.doi; li.append(lk); ol.append(li); }); s3.append(ol, el('p', 'r-note', 'Studies found through PubMed and Europe PMC; findings are short paraphrases of each abstract.')); }
  }
  a.append(s3);
  a.append(sources(['Clinical trials: ClinicalTrials.gov. Research output: OpenAlex (CC0). Studies: PubMed / Europe PMC, open access.']));
  return a;
};

// ---------- report 3: Disease Spotlight ----------
const causeRows = (cause) => dash.data('causes').data.filter((r) => r.cause === cause);
const spotlight = (dk, scope) => {
  const d = DIS[dk]; const a = el('article', 'report'); const sname = X.name(scope); const meas = d.dalys ? 'dalys' : 'deaths';
  a.append(head('Disease Spotlight', `${d.name} in ${scope === 'MENA' ? 'the MENA region' : sname}`, d.why));
  const cs = X.countries(); const codes = scope === 'MENA' ? cs.map((c) => c.code) : [scope];
  const rows = causeRows(d.ghe); const all = dash.data('causes').data.filter((r) => r.cause === '0');
  const pick = (arr, f) => d3.sum(arr.filter((r) => codes.includes(r.code)), (r) => +r[f]);
  const deaths = pick(rows, 'deaths'), dalys = pick(rows, 'dalys'), tD = pick(all, 'deaths'), tY = pick(all, 'dalys'), popn = pick(all, 'population');
  const s0 = sec('Key numbers, 2023');
  const g = el('div', 'r-kpis');
  [['Deaths', X.fmtN(Math.round(deaths)), `${d3.format('.1%')(deaths / tD)} of all deaths`], ['Death rate', d3.format(',.1f')(deaths / popn * 1e5), 'per 100,000 people (crude)'], ['Healthy years lost', X.fmtN(Math.round(dalys)), `DALYs · ${d3.format('.1%')(dalys / tY)} of all`], ['DALY rate', d3.format(',.0f')(dalys / popn * 1e5), 'per 100,000 people (crude)']]
    .forEach(([n, v, u]) => { const t = el('div', 'r-kpi'); t.append(el('div', 'k-name', n), el('div', 'k-val', v), el('div', 'k-unit', u)); g.append(t); });
  s0.append(g); a.append(s0);
  const s1 = sec(`${d.dalys ? 'Healthy years lost' : 'Death rate'} by country`, `${d.dalys ? 'DALYs' : 'Deaths'} per 100,000 people, 2023, crude (not adjusted for age — countries with older populations rank higher).`);
  const br = cs.map((c) => { const r = rows.find((x) => x.code === c.code); return r ? {label: c.name, value: +r[meas] / +r.population * 1e5, hi: c.code === scope} : null; }).filter(Boolean).sort((x, y) => y.value - x.value);
  addChart(s1, (b) => barList(b, br, {label: 'Rate per 100,000 by country'})); a.append(s1);
  const tr = dash.data('cause_trend').data.filter((r) => r.cause === d.ghe);
  if (tr.length) {
    const s2 = sec('Trend 2000–2023', 'Deaths per 100,000 people (crude). Orange = United Kingdom for reference.');
    const series = (cc) => d3.rollups(tr.filter((r) => cc.includes(r.code)), (v) => { const dd = d3.sum(v, (r) => +r.deaths); const p = d3.sum(v, (r) => (+r.rate100k > 0 ? +r.deaths / +r.rate100k * 1e5 : 0)); return p ? dd / p * 1e5 : 0; }, (r) => +r.year).map(([year, value]) => ({year, value})).sort((x, y) => x.year - y.year);
    const A = series(codes), B = series(['GBR']);
    addChart(s2, (b) => {
      const W = b.clientWidth || 680, Hh = 220, M = {t: 14, r: 170, b: 24, l: 44};
      const x = d3.scaleLinear().domain([2000, 2023]).range([M.l, W - M.r]); const y = d3.scaleLinear().domain([0, d3.max([...A, ...B], (r) => r.value) * 1.1]).nice().range([Hh - M.b, M.t]);
      const svg = d3.select(b).append('svg').attr('width', W).attr('height', Hh).attr('role', 'img').attr('aria-label', `${d.name} death rate trend`);
      svg.append('g').attr('transform', `translate(0,${Hh - M.b})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSizeOuter(0)).call((gg) => gg.selectAll('line,path').attr('stroke', 'var(--cds-chart-axis)'));
      svg.append('g').attr('transform', `translate(${M.l},0)`).call(d3.axisLeft(y).ticks(4).tickSize(-(W - M.l - M.r))).call((gg) => gg.select('.domain').remove()).call((gg) => gg.selectAll('line').attr('stroke', 'var(--cds-chart-grid)'));
      [[A, 'var(--hd-c0)', scope === 'MENA' ? 'MENA (14)' : sname], [B, 'var(--hd-c1)', 'United Kingdom']].forEach(([s, col, lab]) => {
        if (!s.length) return; svg.append('path').datum(s).attr('fill', 'none').attr('stroke', col).attr('stroke-width', 2).attr('d', d3.line().x((r) => x(r.year)).y((r) => y(r.value)));
        svg.append('text').attr('x', W - M.r + 6).attr('y', y(s[s.length - 1].value)).attr('dy', '0.35em').style('fill', 'var(--color-fg)').text(`${lab}: ${d3.format('.1f')(s[s.length - 1].value)}`);
      });
    });
    a.append(s2);
  }
  const kids = dash.data('causes').data.filter((r) => r.parent === d.ghe && codes.includes(r.code));
  if (kids.length) {
    const s3 = sec('What it is made of', `Share of ${d.name.toLowerCase()} ${d.dalys ? 'DALYs' : 'deaths'} by specific cause, 2023.`);
    const agg = d3.rollups(kids, (v) => d3.sum(v, (r) => +r[meas]), (r) => r.title).map(([label, value]) => ({label, value: value / (d.dalys ? dalys : deaths) * 100})).filter((r) => r.value >= 0.5).sort((x, y) => y.value - x.value).slice(0, 10);
    addChart(s3, (b) => barList(b, agg, {left: 210, fmt: (v) => d3.format('.1f')(v) + '%', label: 'Share by specific cause'})); a.append(s3);
  }
  if (d.inds.length) {
    const s4 = sec('Related indicators'); const tb = el('table', 'r-tbl'); const cat = H.cat();
    tb.innerHTML = `<thead><tr><th>Indicator</th><th class="n">${scope === 'MENA' ? 'Regional average' : sname}</th><th class="n">World</th><th>Unit</th></tr></thead>`;
    const body = tb.createTBody(); d.inds.forEach((i) => { const c = cat.get(i); if (!c) return; const v = X.latest(scope === 'MENA' ? 'REG' : scope, i), w = X.latest('WLD', i); const tr2 = body.insertRow(); [c.name, fmtV(v && v.value, c), fmtV(w && w.value, c), c.unit].forEach((t, k) => { const td = tr2.insertCell(); td.textContent = t; if (k === 1 || k === 2) td.className = 'n'; }); });
    s4.append(tb); a.append(s4);
  }
  const s5 = sec('Clinical trials recruiting now', `Trials for ${d.ct.replace(' OR ', ' or ')} recruiting or about to recruit, by country (ClinicalTrials.gov, live). A trial with sites in several countries is counted in each.`);
  const counts = cs.map((c) => ({c, e: ctCount(c.code, d.ct)}));
  if (counts.every((x) => x.e.status !== 'loading')) {
    const rows2 = counts.filter((x) => x.e.status === 'ok').map((x) => ({label: x.c.name, value: x.e.data, hi: x.c.code === scope})).sort((x, y) => y.value - x.value);
    addChart(s5, (b) => barList(b, rows2, {fmt: d3.format(','), label: 'Open trials by country'}));
  } else s5.append(el('p', 'r-note', 'Counting trials on ClinicalTrials.gov…'));
  a.append(s5);
  const s6 = sec('Latest open-access research'); pubmedBlock(s6, d, scope); a.append(s6);
  a.append(sources(['Clinical trials: ClinicalTrials.gov (public domain), counted live. Articles: PubMed, U.S. National Library of Medicine.']));
  return a;
};

// ---------- controls & rendering ----------
dash.draw('rp-ctrl', (box) => {
  if (!X.ready('latest', 'catalog')) return;
  let seg = box.querySelector('.rp-type');
  if (!seg) {
    seg = el('span', 'seg rp-type'); [['country', 'Country Health Brief'], ['market', 'Stakeholder Market Brief'], ['disease', 'Disease Spotlight']].forEach(([v, t]) => { const b = el('button', '', t); b.dataset.t = v; b.addEventListener('click', () => { R.type = v; dash.draw('rp-ctrl'); dash.draw('rp-body'); }); seg.append(b); });
    const lab = el('label', '', 'Report '); lab.append(seg); box.append(lab);
    const opts = el('span', 'rp-opts'); box.append(opts);
    const pr = el('button', 'btn primary rp-print', 'Download PDF'); pr.addEventListener('click', () => window.print()); box.append(pr);
  }
  seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === R.type)));
  const opts = box.querySelector('.rp-opts'); opts.replaceChildren();
  const redo = () => dash.draw('rp-body');
  if (R.type === 'country' || R.type === 'market') X.sel(opts, 'rp-c', 'Country', X.countryItems(), R.code, (v) => { R.code = v; redo(); });
  if (R.type === 'market') X.sel(opts, 'rp-sh', 'Stakeholder', Object.entries(SH).map(([k, v]) => [k, v.name]), R.sh, (v) => { R.sh = v; redo(); });
  if (R.type === 'disease') { X.sel(opts, 'rp-d', 'Disease', Object.entries(DIS).map(([k, v]) => [k, v.name]), R.dis, (v) => { R.dis = v; redo(); }); X.sel(opts, 'rp-s', 'Where', X.countryItems([['MENA', 'All 14 MENA countries']]), R.scope, (v) => { R.scope = v; redo(); }); }
});
dash.draw('rp-body', (box) => {
  if (!X.ready('latest', 'catalog', 'series', 'causes', 'cause_trend')) { box.textContent = 'Loading data…'; return; }
  const y = window.scrollY; later.length = 0;
  const art = R.type === 'country' ? countryBrief(R.code) : R.type === 'market' ? marketBrief(R.sh, R.code) : spotlight(R.dis, R.scope);
  box.replaceChildren(art);
  later.forEach((f) => { try { f(); } catch (e) { console.error('report chart', e); } });
  art.querySelectorAll('svg').forEach((s) => { if (!s.getAttribute('viewBox') && s.getAttribute('width')) s.setAttribute('viewBox', `0 0 ${s.getAttribute('width')} ${s.getAttribute('height')}`); });
  document.title = `${art.querySelector('h1').textContent} — MENA Health Data`;
  window.scrollTo(0, y);
});
window.addEventListener('afterprint', () => { document.title = 'MENA Health Data — open health intelligence for the Middle East & North Africa'; });
})();
