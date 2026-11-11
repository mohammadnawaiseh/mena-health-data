(function(){
// Evidence sub-tab: research output per country (PubMed, OpenAlex) and key MENA studies for each stakeholder group
const H = window.HD;
H.names.push('evsum', 'evbar', 'evlist');
const evSh = (el) => el.closest('.shblock').dataset.shb;
const EV_REGION = {GCC: ['ARE', 'SAU', 'QAT', 'KWT', 'BHR', 'OMN'], 'Arab countries': null, MENA: null, EMR: null, 'Middle East': null};

dash.calc('pubrank', {
  inputs: ['pubcounts', 'latest'],
  title: 'Research output per million people',
  description: 'PubMed papers on each stakeholder topic (2016–2026) divided by population in millions, each country\'s rank among the 14 MENA countries by PubMed count, and the share of OpenAlex papers that are free to read (open access).',
  fn: (pc, latest) => {
    const pop = new Map(latest.filter((r) => r.indicator === 'population').map((r) => [r.code, +r.value]));
    const out = [];
    [...new Set(pc.map((r) => r.stakeholder))].forEach((sh) => {
      const rows = pc.filter((r) => r.stakeholder === sh).sort((a, b) => +b.pubmed - +a.pubmed);
      rows.forEach((r, i) => out.push({stakeholder: sh, code: r.code, country: r.country, pubmed: +r.pubmed, openalex: +r.openalex, oa: +r.openalex_open_access, oa_pct: +r.openalex ? Math.round(+r.openalex_open_access / +r.openalex * 100) : null, rank: i + 1, of: rows.length, per_million: pop.get(r.code) ? Math.round(+r.pubmed / (pop.get(r.code) / 1e6) * 10) / 10 : null}));
    });
    return out;
  }
});

dash.draw('evsum', (el) => {
  const d = dash.data('pubrank'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
  const sh = evSh(el); const rows = d.data.filter((r) => r.stakeholder === sh);
  const me = rows.find((r) => r.code === H.s.country);
  const tot = d3.sum(rows, (r) => r.pubmed);
  el.replaceChildren();
  const b = (txt, field, where) => { const x = document.createElement('b'); x.textContent = txt; if (field) { x.setAttribute('data-source', 'pubrank'); x.setAttribute('data-field', field); x.setAttribute('data-where', where); } return x; };
  if (!me) { el.textContent = '—'; return; }
  const w = `stakeholder=${sh}&code=${me.code}`;
  el.append(`${me.country} has `, b(d3.format(',')(me.pubmed), 'pubmed', w), ' PubMed and ', b(d3.format(',')(me.openalex), 'openalex', w), ` OpenAlex papers on this group's topics since 2016 (`, b(me.oa_pct + '%', 'oa_pct', w), ` free to read) — rank `, b(String(me.rank), 'rank', w), ` of 14 in MENA, `, b(d3.format(',.1f')(me.per_million), 'per_million', w), ` per million people. All 14 countries together: ${d3.format(',')(tot)} PubMed papers (a paper can count for several countries).`);
});

dash.draw('evbar', (el) => {
  el.replaceChildren(); const d = dash.data('pubrank'); if (d.status !== 'ok' || !d.data) { el.textContent = '—'; return; }
  const sh = evSh(el); const rows = d.data.filter((r) => r.stakeholder === sh && (!H.s.grp || (dash.data('latest').data.find((x) => x.code === r.code) || {}).group === H.s.grp)).sort((a, b) => b.pubmed - a.pubmed);
  const W = el.clientWidth || 420, bh = 26, left = 100, right = 56, top = 4;
  const x = d3.scaleLinear().domain([0, d3.max(rows, (r) => Math.max(r.pubmed, r.openalex)) * 1.05]).range([left, Math.max(left + 60, W - right)]);
  const svg = d3.select(el).append('svg').attr('width', '100%').attr('height', rows.length * bh + top + 6).attr('role', 'img').attr('aria-label', 'Papers by country, PubMed and OpenAlex');
  const g = svg.selectAll('g.b').data(rows).join('g').attr('class', 'b').attr('transform', (r, i) => `translate(0,${top + i * bh})`).style('cursor', 'pointer');
  g.append('text').attr('x', left - 8).attr('y', bh / 2).attr('dy', '.35em').attr('text-anchor', 'end').style('fill', (r) => (r.code === H.s.country ? 'var(--color-fg)' : null)).style('font-weight', (r) => (r.code === H.s.country ? 600 : null)).text((r) => r.country);
  [['pubmed', 3, dash.colors[0]], ['openalex', 13, dash.colors[2]]].forEach(([f, y, col]) => {
    g.append('rect').attr('x', left).attr('y', y).attr('height', 9).attr('rx', 2).attr('width', (r) => Math.max(1, x(r[f]) - left)).style('fill', (r) => (r.code === H.s.country ? dash.colors[1] : col)).style('opacity', f === 'openalex' ? 0.75 : 1);
    g.append('text').attr('x', (r) => x(r[f]) + 4).attr('y', y + 5).attr('dy', '.35em').style('font-size', '10.5px').style('font-variant-numeric', 'tabular-nums').text((r) => d3.format(',')(r[f]))
      .each(function (r) { this.setAttribute('data-source', 'pubrank'); this.setAttribute('data-field', f); this.setAttribute('data-where', `stakeholder=${sh}&code=${r.code}`); });
  });
  const leg = document.createElement('div'); leg.className = 'legend';
  [['PubMed (topic in MeSH, title, abstract or affiliation)', dash.colors[0]], ['OpenAlex (author institution country)', dash.colors[2]], ['Focus country', dash.colors[1]]].forEach(([l, c]) => { const s = document.createElement('span'); const i = document.createElement('i'); i.style.background = c; s.append(i, l); leg.appendChild(s); });
  el.appendChild(leg);
  const tip = H.tip(el);
  g.on('pointermove', (ev, r) => { const [px, py] = d3.pointer(ev, el); tip.textContent = `${r.country}: ${d3.format(',')(r.pubmed)} PubMed, ${d3.format(',')(r.openalex)} OpenAlex (${r.oa_pct}% open access) · ${d3.format(',.1f')(r.per_million)} PubMed papers per million people`; H.place(el, tip, px, py); })
   .on('pointerleave', () => { tip.hidden = true; })
   .on('click', (ev, r) => { H.s.country = r.code; H.redraw(); });
});

dash.draw('evlist', (wrap) => {
  wrap.replaceChildren(); const d = dash.data('evidence'); if (d.status !== 'ok' || !d.data) return;
  const sh = evSh(wrap);
  const touches = (r) => r.scope === H.s.country || (r.scope === 'GCC' && EV_REGION.GCC.includes(H.s.country)) || ['MENA', 'EMR', 'Middle East', 'Arab countries'].includes(r.scope);
  const rows = d.data.filter((r) => r.stakeholder === sh).sort((a, b) => (touches(b) - touches(a)) || (+b.year - +a.year));
  rows.forEach((r) => {
    const c = document.createElement('article'); c.className = 'ev' + (touches(r) ? ' on' : '');
    const top = document.createElement('div'); top.className = 'ev-top';
    const sc = document.createElement('span'); sc.className = 'tagpill'; sc.textContent = r.scope;
    const ty = document.createElement('span'); ty.className = 'tagpill'; ty.textContent = r.study_type;
    top.append(sc, ty); if (touches(r)) { const f = document.createElement('span'); f.className = 'tagpill hl'; f.textContent = 'Covers focus country'; top.appendChild(f); }
    const h = document.createElement('a'); h.className = 'ev-t'; h.href = r.url; h.target = '_blank'; h.rel = 'noopener'; h.textContent = r.title;
    const m = document.createElement('p'); m.className = 'ev-m'; m.textContent = `${r.first_author} et al. (${r.year}) · ${r.journal} · PMID ${r.pmid} · cited ${r.citations}×` + (r.doi ? ` · doi:${r.doi}` : '');
    const k = document.createElement('p'); k.className = 'ev-k'; k.textContent = r.key_finding;
    k.setAttribute('data-source', 'evidence'); k.setAttribute('data-field', 'key_finding'); k.setAttribute('data-where', `pmid=${r.pmid}`);
    const ft = document.createElement('a'); ft.className = 'ev-ft'; ft.href = r.full_text; ft.target = '_blank'; ft.rel = 'noopener'; ft.textContent = 'Free full text (Europe PMC) →';
    c.append(top, h, m, k, ft); wrap.appendChild(c);
  });
});

document.querySelectorAll('.hd [data-dlev]').forEach((b) => b.addEventListener('click', () => {
  const sh = b.closest('.shblock').dataset.shb;
  if (b.dataset.dlev === 'studies') { const d = dash.data('evidence'); if (d.status !== 'ok') return; H.download(`evidence_${sh}.csv`, H.csv(d.data.filter((r) => r.stakeholder === sh), ['stakeholder', 'first_author', 'year', 'title', 'journal', 'scope', 'study_type', 'key_finding', 'pmid', 'pmcid', 'doi', 'citations', 'full_text', 'url'])); }
  else { const d = dash.data('pubrank'); if (d.status !== 'ok') return; H.download(`publications_${sh}.csv`, H.csv(d.data.filter((r) => r.stakeholder === sh), ['stakeholder', 'country', 'code', 'pubmed', 'openalex', 'oa', 'oa_pct', 'rank', 'per_million'])); }
}));

})();
