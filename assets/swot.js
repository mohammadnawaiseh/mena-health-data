(function(){
// SWOT per stakeholder group: strengths/weaknesses from each group's indicator set, potential/risks from group-specific screening rules
const H = window.HD;
H.names.push('shswot', 'shswotsum');
const SH_INDS = {
  ministries: ['ncd_3070', 'hale', 'life_exp', 'uhc', 'obesity', 'diabetes', 'hypertension', 'tobacco', 'inactivity', 'he_gdp', 'u5mr', 'mmr'],
  payers: ['oop', 'he_pc', 'he_gdp', 'uhc', 'diabetes', 'obesity', 'hypertension', 'hyp_control', 'diab_death'],
  pharma: ['diabetes', 'obesity', 'obesity_child', 'hypertension', 'hyp_control', 'cvd_rate', 'stroke_rate', 'diab_death', 'he_pc'],
  providers: ['physicians', 'nurses', 'beds', 'uhc', 'hyp_control', 'diabetes', 'cvd_rate', 'stroke_rate', 'oop'],
  investors: ['he_pc', 'gdp_pc', 'he_gdp', 'oop', 'uhc', 'diabetes', 'obesity', 'inactivity'],
  publichealth: ['obesity', 'obesity_child', 'inactivity', 'tobacco', 'hypertension', 'pm25', 'road', 'ncd_3070', 'diabetes']
};

dash.calc('swot_sh', {
  inputs: ['latest', 'catalog', 'series', 'trials_live'],
  title: 'SWOT by stakeholder group',
  description: 'For each MENA country and each stakeholder group. Strengths and weaknesses: indicators from that group\'s set that are at least 10% better or worse than the world average (both sexes), largest gaps first, up to 5 each. Potential and risks: screening rules per group — e.g. out-of-pocket above 30% (payers: room for insurance), hypertension control below 25% (pharma: treatment gap), physicians below the world average (providers: capacity investment), health market above US$10 bn or spending growth above 4% a year (investors), risk factors 1.5× the world (public health). Growth = yearly growth in health spending per person 2013–2023; market size = population × spending per person; trials per million from the ClinicalTrials.gov snapshot.',
  fn: (latest, catalog, series, trials) => {
    const cat = new Map(catalog.map((c) => [c.indicator, c]));
    const v = (code, i, f = 'value') => { const r = latest.find((x) => x.code === code && x.indicator === i); return r && r[f] !== '' && r[f] != null ? +r[f] : null; };
    const W = (i) => v('WLD', i);
    const mena = [...new Set(latest.filter((r) => !['Aggregate', 'Global benchmark'].includes(r.group)).map((r) => r.code))];
    const best = (i) => { const c = cat.get(i); let b = null; mena.forEach((m) => { const x = v(m, i); if (x == null) return; if (!b || (c.better === 'lower' ? x < b.v : x > b.v)) b = {v: x, code: m}; }); return b; };
    const cagr = (code) => { const s = series.filter((r) => r.code === code && r.indicator === 'he_pc'); const a = s.find((r) => r.year === '2013'), b = s.find((r) => r.year === '2023'); return a && b && +a.value > 0 ? (Math.pow(+b.value / +a.value, 0.1) - 1) * 100 : null; };
    const name = (code) => (latest.find((r) => r.code === code) || {}).country;
    const f = (x, d = 1) => (x == null ? '—' : x.toLocaleString('en-US', {maximumFractionDigits: d, minimumFractionDigits: d}));
    const out = [];
    mena.forEach((code) => {
      const country = name(code), group = (latest.find((r) => r.code === code) || {}).group;
      const pop = v(code, 'population'), pc = v(code, 'he_pc'), g = cagr(code), gw = cagr('WLD');
      const size = pop && pc ? pop * pc / 1e9 : null;
      const t = trials.find((x) => x.code === code); const tpm = t && pop ? +t.active_trials / (pop / 1e6) : null;
      const ratio = (i) => (v(code, i) != null && W(i) ? v(code, i) / W(i) : null);
      const add = (sh, quadrant, indicator, item, value, note) => { const c = cat.get(indicator) || {}; out.push({code, country, group, stakeholder: sh, quadrant, indicator, item, value: value == null ? null : Math.round(value * 10) / 10, world: indicator === 'he_pc_growth' ? (gw == null ? null : Math.round(gw * 10) / 10) : indicator === 'market_size' || indicator === 'trials_pm' ? null : W(indicator), unit: indicator === 'he_pc_growth' ? '% a year' : indicator === 'market_size' ? 'US$ bn' : indicator === 'trials_pm' ? 'per million' : c.unit || '', note}); };
      // Strengths & weaknesses from each group's indicator set
      Object.entries(SH_INDS).forEach(([sh, ids]) => {
        const sw = [];
        ids.forEach((i) => {
          const c = cat.get(i); const x = v(code, i), w = W(i);
          if (!c || c.better === 'none' || x == null || !w) return;
          const d = (x - w) / Math.abs(w) * (c.better === 'lower' ? -1 : 1);
          if (Math.abs(d) >= 0.1) sw.push({i, c, x, w, d});
        });
        sw.filter((s) => s.d > 0).sort((a, b) => b.d - a.d).slice(0, 5).forEach((s) => add(sh, 'Strength', s.i, s.c.name, s.x, `${Math.round(s.d * 100)}% better than the world (${f(s.w, +s.c.decimals)})`));
        sw.filter((s) => s.d < 0).sort((a, b) => a.d - b.d).slice(0, 5).forEach((s) => add(sh, 'Weakness', s.i, s.c.name, s.x, `${Math.round(-s.d * 100)}% worse than the world (${f(s.w, +s.c.decimals)})`));
      });
      const rule = (sh, q, ind, test, item, note, value) => { if (test) add(sh, q, ind, item, value === undefined ? v(code, ind) : value, note); };
      const gap = (i) => { const b = best(i); return b ? {b, gap: Math.abs(v(code, i) - b.v), name: name(b.code)} : null; };
      // Ministries
      const hg = gap('hale');
      rule('ministries', 'Potential', 'hale', hg && hg.gap >= 2, 'Healthy years to gain', hg ? `${f(hg.gap)} years behind the MENA best (${hg.name}, ${f(hg.b.v)})` : '');
      rule('ministries', 'Potential', 'uhc', v(code, 'uhc') < 80, 'Expand service coverage', `UHC index below 80; the MENA best is ${f(best('uhc').v, 0)}`);
      rule('ministries', 'Potential', 'tobacco', ratio('tobacco') >= 1, 'Tobacco control is a quick win', `Tobacco use at or above the world rate; men ${f(v(code, 'tobacco', 'male'))}%, women ${f(v(code, 'tobacco', 'female'))}%`);
      const top = ['obesity', 'diabetes', 'inactivity', 'hypertension'].filter((i) => ratio(i) >= 1.5).sort((a, b) => ratio(b) - ratio(a))[0];
      rule('ministries', 'Potential', top || 'obesity', !!top, 'National prevention programme', top ? `${(cat.get(top) || {}).name} is ${f(ratio(top))}× the world rate: population-wide prevention and screening` : '');
      rule('ministries', 'Risk', 'ncd_3070', ratio('ncd_3070') >= 1, 'Premature NCD deaths above world', 'Off track for SDG 3.4 (cut premature NCD deaths by a third)');
      rule('ministries', 'Risk', 'obesity_child', ratio('obesity_child') >= 1.5, 'Child obesity signals a future NCD wave', `${f(ratio('obesity_child'))}× the world rate`);
      rule('ministries', 'Risk', 'he_gdp', ratio('he_gdp') < 0.6, 'Low health spending share of GDP', `vs ${f(W('he_gdp'))}% of GDP worldwide`);
      // Payers
      rule('payers', 'Potential', 'oop', v(code, 'oop') >= 30, 'Room to grow insurance coverage', 'Households pay 30%+ of health costs directly');
      rule('payers', 'Potential', 'hyp_control', v(code, 'hyp_control') < 25, 'Disease management can avoid costly complications', 'Fewer than 1 in 4 people with hypertension are controlled');
      rule('payers', 'Potential', 'he_pc_growth', g != null && g >= 4, 'Fast-growing premium base', `Spending per person growing ${f(g)}% a year`, g);
      rule('payers', 'Risk', 'diabetes', ratio('diabetes') >= 1.5, 'Costly diabetic risk pool', `${f(ratio('diabetes'))}× the world prevalence: complication claims`);
      rule('payers', 'Risk', 'obesity', ratio('obesity') >= 2, 'Obesity drives future claims', `${f(ratio('obesity'))}× the world rate`);
      rule('payers', 'Risk', 'he_pc_growth', g != null && gw != null && g > gw + 1, 'Medical cost inflation above world', `${f(g)}% a year vs ${f(gw)}% worldwide`, g);
      // Pharma
      rule('pharma', 'Potential', 'diabetes', ratio('diabetes') >= 1.5 && pc >= 1000, 'High-value cardiometabolic market', `Diabetes ${f(ratio('diabetes'))}× world with US$${f(pc, 0)} spent per person`);
      rule('pharma', 'Potential', 'obesity', ratio('obesity') >= 2, 'Demand for anti-obesity medicines', `${f(ratio('obesity'))}× the world rate`);
      rule('pharma', 'Potential', 'hyp_control', v(code, 'hyp_control') < 25, 'Treatment gap in hypertension', 'Under 25% controlled: adherence, combination therapy, RWE');
      rule('pharma', 'Potential', 'trials_pm', tpm != null && tpm < 5 && ratio('diabetes') >= 1.2, 'Under-researched, high-burden trial site', `${f(tpm)} open trials per million people`, tpm);
      rule('pharma', 'Risk', 'he_pc', pc != null && pc < 400, 'Affordability and price pressure', 'Low health spending per person');
      rule('pharma', 'Risk', 'oop', v(code, 'oop') >= 40, 'Patients pay out of pocket', 'Uptake of new medicines depends on household income');
      rule('pharma', 'Risk', 'market_size', pop != null && pop < 5e6, 'Small market', `${f(pop / 1e6)} m people: launch with regional partners`, size);
      // Providers
      rule('providers', 'Potential', 'physicians', ratio('physicians') < 1, 'Physician capacity gap', `vs ${f(W('physicians'))} per 1,000 worldwide`);
      rule('providers', 'Potential', 'beds', ratio('beds') < 0.8, 'Bed capacity demand', `vs ${f(W('beds'))} per 1,000 worldwide`);
      rule('providers', 'Potential', 'cvd_rate', ratio('cvd_rate') >= 1.2 || ratio('diabetes') >= 1.5, 'Specialty service lines: cardiology, endocrinology, renal', 'High cardiometabolic burden', v(code, 'cvd_rate'));
      rule('providers', 'Risk', 'nurses', ratio('nurses') < 1, 'Nursing shortage', `vs ${f(W('nurses'))} per 10,000 worldwide`);
      rule('providers', 'Risk', 'uhc', v(code, 'uhc') < 70, 'Low coverage: payment risk', 'Many patients outside coverage schemes');
      rule('providers', 'Risk', 'oop', v(code, 'oop') >= 40, 'Bad-debt and affordability risk', '40%+ of spending paid out of pocket');
      // Investors
      rule('investors', 'Potential', 'market_size', size >= 10, 'Large health market', 'Population × health spending per person', size);
      rule('investors', 'Potential', 'he_pc_growth', g != null && g >= 4, 'Fast-growing spending', `${f(g)}% a year, 2013–2023`, g);
      rule('investors', 'Potential', 'inactivity', ratio('inactivity') >= 1.5, 'Digital health and wellness demand', `Inactivity ${f(ratio('inactivity'))}× the world rate`);
      rule('investors', 'Potential', 'oop', v(code, 'oop') >= 30 && v(code, 'gdp_pc') >= 4000, 'Consumer-pay health services', 'High out-of-pocket share with middle-income buyers');
      rule('investors', 'Risk', 'market_size', size != null && size < 3, 'Small market', 'Population × health spending per person', size);
      rule('investors', 'Risk', 'he_pc_growth', g != null && g < 0, 'Shrinking spending per person (US$)', `${f(g)}% a year, often currency-driven`, g);
      rule('investors', 'Risk', 'gdp_pc', v(code, 'gdp_pc') < 5000, 'Limited purchasing power', `vs US$${f(W('gdp_pc'), 0)} worldwide`);
      // Public health
      ['obesity', 'obesity_child', 'inactivity', 'pm25'].forEach((i) => rule('publichealth', 'Potential', i, ratio(i) >= 1.5, `Prevention target: ${(cat.get(i) || {}).name}`, `${f(ratio(i))}× the world rate`));
      const tm = v(code, 'tobacco', 'male'), tf = v(code, 'tobacco', 'female');
      rule('publichealth', 'Potential', 'tobacco', tm != null && tm >= 30, 'Tobacco cessation for men', `${f(tm)}% of men vs ${f(tf)}% of women use tobacco`, tm);
      rule('publichealth', 'Risk', 'road', ratio('road') >= 1.2, 'Road traffic deaths above world', `vs ${f(W('road'))} worldwide`);
      rule('publichealth', 'Risk', 'ncd_3070', ratio('ncd_3070') >= 1, 'Premature NCD deaths above world', `vs ${f(W('ncd_3070'))}% worldwide`);
      rule('publichealth', 'Risk', 'diabetes', ratio('diabetes') >= 1.5, 'Diabetes epidemic', `${f(ratio('diabetes'))}× the world prevalence`);
      rule('publichealth', 'Risk', 'pm25', ratio('pm25') >= 1.5, 'Air pollution exposure', `vs ${f(W('pm25'))} worldwide`);
    });
    return out;
  }
});

const SHQ = {Strength: 'S', Weakness: 'W', Potential: 'P', Risk: 'R'};
dash.draw('shswot', (ul) => {
  ul.replaceChildren(); const d = dash.data('swot_sh'); if (d.status !== 'ok' || !d.data) return;
  const rows = d.data.filter((r) => r.code === H.s.country && r.stakeholder === ul.closest('.shblock').dataset.shb && r.quadrant === ul.dataset.q);
  if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Nothing flagged for this country.'; ul.appendChild(li); return; }
  rows.forEach((r) => {
    const li = document.createElement('li');
    const t = document.createElement('span'); t.className = 'sw-item'; t.textContent = r.item;
    const v = document.createElement('span'); v.className = 'sw-val';
    if (r.value != null) {
      const b = document.createElement('b'); b.textContent = r.value.toLocaleString('en-US', {maximumFractionDigits: 1});
      b.setAttribute('data-source', 'swot_sh'); b.setAttribute('data-field', 'value'); b.setAttribute('data-where', `code=${r.code}&stakeholder=${r.stakeholder}&quadrant=${r.quadrant}&indicator=${r.indicator}`);
      v.append(b, ` ${r.unit} · `);
    }
    v.append(r.note);
    li.append(t, v);
    if (H.cat().has(r.indicator)) { li.style.cursor = 'pointer'; li.onclick = () => { H.s.ind = r.indicator; H.redraw(); H.go('explorer'); }; }
    ul.appendChild(li);
  });
});
dash.draw('shswotsum', (el) => {
  const d = dash.data('swot_sh'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
  const rows = d.data.filter((r) => r.code === H.s.country && r.stakeholder === el.closest('.shblock').dataset.shb);
  const n = (q) => rows.filter((r) => r.quadrant === q).length;
  const c = (H.countries().get(H.s.country) || ['—'])[0];
  const p = (k, one, many) => `${k} ${k === 1 ? one : many}`;
  el.textContent = `${c}: ${p(n('Strength'), 'strength', 'strengths')}, ${p(n('Weakness'), 'weakness', 'weaknesses')}, ${p(n('Potential'), 'opportunity', 'opportunities')} and ${p(n('Risk'), 'risk', 'risks')} flagged for this group.`;
});
document.querySelectorAll('.hd [data-dlswot]').forEach((b) => b.addEventListener('click', () => {
  const d = dash.data('swot_sh'); if (d.status !== 'ok' || !d.data) return;
  const all = b.dataset.dlswot === 'all', sh = b.closest('.shblock').dataset.shb;
  const rows = d.data.filter((r) => r.stakeholder === sh && (all || r.code === H.s.country));
  H.download(`swot_${sh}_${all ? 'all_countries' : H.s.country}.csv`, H.csv(rows, ['country', 'group', 'stakeholder', 'quadrant', 'item', 'value', 'unit', 'world', 'note', 'indicator']));
}));

})();
