(function(){
// Live PubMed evidence: the newest free-full-text studies for the focus country and the open stakeholder workspace
const H = window.HD;
H.names.push('pmlive', 'pmsum');
H.PM_SH = ['ministries', 'payers', 'pharma', 'providers', 'investors', 'publichealth'];
H.PM_SH.forEach((sh) => dash.loader('pm_' + sh, {
  description: 'Turns the PubMed search answer into one row per article id; the total number of matching articles goes into meta.',
  fn: ({answer}) => {
    if (!answer || !Array.isArray(answer.pmids)) throw new Error((answer && (answer.error || answer.message)) || 'No article list in the answer');
    return {data: answer.pmids.map((p, i) => ({pmid: String(p), position: i + 1, total_matching: Number(answer.total_count ?? answer.pmids.length)})), columns: ['pmid', 'position', 'total_matching'], cut: Number(answer.total_count || 0) > answer.pmids.length,
      meta: [{label: 'Total matching articles', value: String(answer.total_count ?? answer.pmids.length)}]};
  }
}));
dash.loader('pm_meta', {
  description: 'Turns PubMed article details into one row per article: title, first author, journal, date, DOI and PubMed Central id.',
  fn: ({answer}) => {
    if (!answer || !Array.isArray(answer.articles)) throw new Error((answer && (answer.error || answer.message)) || 'No articles in the answer');
    const data = answer.articles.map((a) => {
      const id = a.identifiers || {}, d = a.publication_date || {}, au = a.authors || [];
      return {pmid: String(id.pmid || ''), title: a.title || '', first_author: au[0] ? au[0].last_name || '' : '', authors: au.length, journal: (a.journal && (a.journal.iso_abbreviation || a.journal.title)) || '', year: d.year || '', month: d.month || '', doi: id.doi || a.doi || '', pmc: id.pmc || '', type: (a.article_types || []).filter((t) => t !== 'Journal Article')[0] || 'Journal Article'};
    });
    return {data, columns: ['pmid', 'title', 'first_author', 'authors', 'journal', 'year', 'month', 'doi', 'pmc', 'type']};
  }
});

// Which workspace's Evidence tab is on screen, and the focus country's PubMed name
H.pmOpen = () => {
  const sub = [...document.querySelectorAll('.hd .wsub[data-sub="evidence"]')].find((s) => !s.closest('[hidden]'));
  return sub ? sub.closest('.shblock').dataset.shb : null;
};
H.pmCountry = () => { const c = H.LIVE_C.find(([code]) => code === H.s.country); return c ? c[1] : null; };
// Keep the two live queries in step with the page: country first, then the article ids the search returned
H.pmSync = () => {
  const sh = H.pmOpen(), name = H.pmCountry(); if (!sh || !name) return;
  const p = dash.params();
  if (p.pmcountry !== name) { dash.setParams({pmcountry: name}); return; }
  const d = dash.data('pm_' + sh); if (d.status !== 'ok' || d.refreshing || !d.data || !d.data.length) return;
  const ids = d.data.map((r) => String(r.pmid));
  if (String(p.pmids) !== String(ids)) dash.setParams({pmids: ids});
};
const redraw0 = H.redraw;
H.redraw = () => { redraw0(); H.pmSync(); };
dash.onData(() => H.pmSync());

const PM_MSG = {loading: 'Loading the latest studies from PubMed…', connect: 'Connect the free PubMed connector to see the latest studies here; the selected studies below are always shown.', declined: 'PubMed is not available for this dashboard; the selected studies below are always shown.', error: 'PubMed could not be reached just now.', missing: '—'};
dash.draw('pmsum', (el) => {
  if (el.closest('[hidden]')) return;
  const sh = el.closest('.shblock').dataset.shb, name = H.pmCountry();
  if (!name) { el.textContent = 'Pick a MENA focus country to see its latest studies.'; return; }
  const d = dash.data('pm_' + sh);
  el.setAttribute('data-source', 'pm_' + sh);
  if (d.status !== 'ok') { el.textContent = PM_MSG[d.status] || '—'; return; }
  const tot = d.data[0] ? d.data[0].total_matching : 0;
  el.replaceChildren();
  const b = document.createElement('b'); b.textContent = d3.format(',')(tot); b.setAttribute('data-source', 'pm_' + sh); b.setAttribute('data-field', 'total_matching'); b.setAttribute('data-row', '0');
  el.append(b, ` free-full-text PubMed articles on this group's topics for ${name} since 2018. Showing the newest ${d.data.length}, fetched live when the page opens.`);
});
dash.draw('pmlive', (wrap) => {
  if (wrap.closest('[hidden]')) return;
  wrap.replaceChildren();
  const sh = wrap.closest('.shblock').dataset.shb; if (!H.pmCountry()) return;
  wrap.setAttribute('data-source', 'pm_meta pm_' + sh);
  const s = dash.data('pm_' + sh); if (s.status !== 'ok') return;
  const ids = s.data.map((r) => String(r.pmid));
  if (!ids.length) { const p = document.createElement('p'); p.className = 'sub'; p.textContent = 'No free-full-text articles found for this country and topic.'; wrap.appendChild(p); return; }
  const m = dash.data('pm_meta');
  if (m.status !== 'ok') { const p = document.createElement('p'); p.className = 'sub'; p.textContent = PM_MSG[m.status] || '—'; wrap.appendChild(p); return; }
  const by = new Map(m.data.map((r) => [String(r.pmid), r]));
  const rows = ids.map((i) => by.get(i)).filter(Boolean);
  if (!rows.length) { const p = document.createElement('p'); p.className = 'sub'; p.textContent = PM_MSG.loading; wrap.appendChild(p); return; }
  rows.forEach((r) => {
    const c = document.createElement('article'); c.className = 'ev';
    const top = document.createElement('div'); top.className = 'ev-top';
    const ty = document.createElement('span'); ty.className = 'tagpill'; ty.textContent = r.type;
    const dt = document.createElement('span'); dt.className = 'tagpill'; dt.textContent = [r.year, r.month].filter(Boolean).join('-');
    top.append(ty, dt);
    const h = document.createElement('a'); h.className = 'ev-t'; h.href = 'https://pubmed.ncbi.nlm.nih.gov/' + encodeURIComponent(r.pmid) + '/'; h.target = '_blank'; h.rel = 'noopener'; h.textContent = r.title;
    h.setAttribute('data-source', 'pm_meta'); h.setAttribute('data-field', 'title'); h.setAttribute('data-where', 'pmid=' + r.pmid);
    const meta = document.createElement('p'); meta.className = 'ev-m'; meta.textContent = `${r.first_author}${r.authors > 1 ? ' et al.' : ''} · ${r.journal} · PubMed PMID ${r.pmid}`;
    const links = document.createElement('p'); links.className = 'ev-m';
    if (r.doi) { const a = document.createElement('a'); a.className = 'ev-ft'; a.href = 'https://doi.org/' + r.doi; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'doi:' + r.doi; links.append(a); }
    if (r.pmc) { const a = document.createElement('a'); a.className = 'ev-ft'; a.href = 'https://pmc.ncbi.nlm.nih.gov/articles/' + encodeURIComponent(r.pmc) + '/'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Free full text (PMC) →'; if (r.doi) links.append(' · '); links.append(a); }
    c.append(top, h, meta, links); wrap.appendChild(c);
  });
});

})();
