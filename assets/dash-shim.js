/* MENA Health Data — small data layer for the standalone site.
   Loads the CSV/JSON files in /data, calls the public ClinicalTrials.gov and PubMed APIs from the visitor's browser,
   and gives the page scripts the same `dash` interface they were written against. */
(function () {
  const FILES = {
    latest: ['data/latest.csv', 'Latest indicators', 'Latest value per country for 30 indicators, with values by sex where WHO reports them. World Bank World Development Indicators (CC BY 4.0), WHO Global Health Observatory and WHO Global Health Estimates 2021.'],
    series: ['data/series.csv', 'Yearly series', 'Yearly values 2000–2024 for the 12 indicators that have a time series.'],
    catalog: ['data/catalog.csv', 'Indicator catalogue', 'Name, unit, source and good/bad direction of each indicator.'],
    platforms: ['data/platforms.csv', 'Platform benchmark', 'Comparable health-data platforms worldwide and what each teaches a MENA platform.'],
    trials: ['data/trials.csv', 'Clinical trials snapshot', 'Recruiting or not-yet-recruiting trials per country on ClinicalTrials.gov on 10 Nov 2026, all conditions and a cardiometabolic keyword match. Used when the live count cannot be reached.'],
    evidence: ['data/evidence.csv', 'Selected open-access studies', '31 peer-reviewed, open-access MENA studies (2018–2026) found through PubMed and Europe PMC. Key findings are short paraphrases of each abstract — check the paper before citing.'],
    pubcounts: ['data/pubcounts.csv', 'Research output by country and topic', 'Papers 2016–2026 per country and stakeholder topic from PubMed and OpenAlex, searched 11 Nov 2026. The two sources search different fields, so compare countries within one source.'],
    restrend: ['data/restrend.csv', 'Research output per year', 'OpenAlex papers per year 2016–2025 on each stakeholder topic, by author-institution country. Searched 11 Nov 2026.'],
    resfocus: ['data/resfocus.csv', 'Research topics by stakeholder group', 'The ten most common OpenAlex topics among 2021–2025 MENA papers matching each stakeholder topic search.'],
    rescountry: ['data/rescountry.csv', 'Health research areas by country', 'OpenAlex health-sciences papers by research area and country, 2016–2020 and 2021–2025.'],
    geo: ['data/mena_geo.json', 'Country boundaries', 'Natural Earth boundaries via the world-atlas package. They do not imply any position on disputed borders.']
  };
  const COUNTRIES = {ARE: 'United Arab Emirates', SAU: 'Saudi Arabia', QAT: 'Qatar', KWT: 'Kuwait', BHR: 'Bahrain', OMN: 'Oman', JOR: 'Jordan', LBN: 'Lebanon', IRQ: 'Iraq', EGY: 'Egypt', MAR: 'Morocco', TUN: 'Tunisia', DZA: 'Algeria', LBY: 'Libya'};
  const CONDITIONS = ['diabetes', 'obesity', 'hypertension', 'cardiovascular disease', 'chronic kidney disease', 'cancer', 'asthma OR COPD', 'depression OR anxiety', 'Alzheimer OR dementia'];
  const PM_TOPIC = {
    ministries: '("health policy"[MeSH Terms] OR "noncommunicable diseases"[MeSH Terms] OR "burden of disease"[Title/Abstract] OR "universal health coverage"[Title/Abstract])',
    payers: '("insurance, health"[MeSH Terms] OR "health expenditures"[MeSH Terms] OR "cost of illness"[MeSH Terms] OR "out-of-pocket"[Title/Abstract] OR "cost-effectiveness"[Title/Abstract])',
    pharma: '("clinical trials as topic"[MeSH Terms] OR "drug utilization"[MeSH Terms] OR "medication adherence"[MeSH Terms] OR "real-world evidence"[Title/Abstract] OR "glycemic control"[Title/Abstract])',
    providers: '("health workforce"[MeSH Terms] OR "workforce"[Title/Abstract] OR "bed capacity"[Title/Abstract] OR "hospital administration"[MeSH Terms] OR "health services accessibility"[MeSH Terms])',
    investors: '("telemedicine"[MeSH Terms] OR "digital health"[Title/Abstract] OR "mobile applications"[MeSH Terms] OR "artificial intelligence"[MeSH Terms])',
    publichealth: '(("risk factors"[MeSH Terms] AND "prevalence"[MeSH Terms]) OR "health promotion"[MeSH Terms] OR "primary prevention"[MeSH Terms])'
  };
  const CT = 'https://clinicaltrials.gov/api/v2/studies', EU = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
  const getJSON = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  const locn = (name) => 'query.locn=' + encodeURIComponent(`AREA[LocationCountry]"${name}"`) + '&filter.overallStatus=RECRUITING,NOT_YET_RECRUITING&countTotal=true';
  const MONTHS = {Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'};

  // Live sources: key() says which filter values the call depends on; get() returns the answer the page's loader expects
  const LIVE = {};
  Object.entries(COUNTRIES).forEach(([code, name]) => {
    LIVE['tl_' + code] = {title: 'Live: open trials in ' + name, description: 'Recruiting or not-yet-recruiting trials with a site in ' + name + ', counted on ClinicalTrials.gov when the page opens.', key: () => '', get: () => getJSON(`${CT}?${locn(name)}&pageSize=1`).then((j) => ({total: j.totalCount}))};
  });
  LIVE.live_trials = {title: 'Live: open trials by country and condition', description: 'Recruiting or not-yet-recruiting ClinicalTrials.gov studies for the chosen country and condition (first 25).',
    key: (p) => p.country + '|' + p.condition,
    get: (p) => {
      if (!Object.values(COUNTRIES).includes(p.country) || !CONDITIONS.includes(p.condition)) return Promise.reject(new Error('Unknown country or condition'));
      return getJSON(`${CT}?query.cond=${encodeURIComponent(p.condition)}&${locn(p.country)}&pageSize=25`).then((j) => ({total: j.totalCount, items: (j.studies || []).map((s) => {
        const ps = s.protocolSection || {}, id = ps.identificationModule || {}, st = ps.statusModule || {}, de = ps.designModule || {};
        return {nct_id: id.nctId, title: id.briefTitle, status: st.overallStatus, phase: de.phases || [], conditions: (ps.conditionsModule || {}).conditions || [], sponsor: ((ps.sponsorCollaboratorsModule || {}).leadSponsor || {}).name || '', enrollment: (de.enrollmentInfo || {}).count ?? null, start_date: (st.startDateStruct || {}).date || '', study_type: de.studyType || ''};
      })}));
    }};
  Object.entries(PM_TOPIC).forEach(([sh, q]) => {
    LIVE['pm_' + sh] = {title: 'Live: newest PubMed studies (' + sh + ')', description: 'The eight newest free-full-text PubMed articles since 2018 on this group\'s topics for the focus country. Search: ' + q + ' AND country in MeSH or title/abstract AND free full text.',
      key: (p) => p.pmcountry,
      get: (p) => {
        if (!Object.values(COUNTRIES).includes(p.pmcountry)) return Promise.reject(new Error('Unknown country'));
        const term = `${q} AND ("${p.pmcountry}"[MeSH Terms] OR "${p.pmcountry}"[Title/Abstract]) AND free full text[sb]`;
        return getJSON(`${EU}esearch.fcgi?db=pubmed&retmode=json&retmax=8&sort=pub_date&datetype=pdat&mindate=2018&maxdate=3000&term=${encodeURIComponent(term)}`).then((j) => ({pmids: j.esearchresult.idlist || [], total_count: Number(j.esearchresult.count || 0)}));
      }};
  });
  LIVE.pm_meta = {title: 'Live: PubMed article details', description: 'Title, authors, journal, date and DOI for the articles the live PubMed search returned.',
    key: (p) => String(p.pmids || []),
    get: (p) => {
      const ids = (p.pmids || []).map(String).filter((i) => /^[0-9]{1,9}$/.test(i));
      if (!ids.length) return Promise.resolve({articles: []});
      return getJSON(`${EU}esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`).then((j) => ({articles: ids.map((i) => j.result && j.result[i]).filter(Boolean).map((a) => {
        const aid = (t) => ((a.articleids || []).find((x) => x.idtype === t) || {}).value || '';
        const d = String(a.pubdate || '').split(' ');
        return {identifiers: {pmid: a.uid, doi: aid('doi'), pmc: aid('pmc')}, title: a.title || '', journal: {iso_abbreviation: a.source || ''}, authors: (a.authors || []).map((x) => ({last_name: String(x.name || '').replace(/\s+[A-Z]{1,3}$/, '')})), publication_date: {year: d[0] || '', month: MONTHS[d[1]] || ''}, article_types: a.pubtype || []};
      })}));
    }};

  const files = {}, live = {}, calcs = {}, loaders = {}, draws = {}, watchers = [];
  let params = {condition: 'diabetes', country: 'United Arab Emirates', pmcountry: 'United Arab Emirates', pmids: []};
  let version = 0, timer = null, started = false;
  const calcCache = new Map();
  const bump = () => { version++; calcCache.clear(); schedule(); };
  const schedule = () => { if (!started || timer) return; timer = setTimeout(() => { timer = null; redraw(); }, 40); };
  const runDraw = (name) => {
    const fn = draws[name]; if (!fn) return;
    document.querySelectorAll('[data-draw="' + name + '"]').forEach((el) => { if (el.closest('[hidden]')) return; try { fn(el); } catch (e) { console.error('draw ' + name, e); } });
  };
  const redraw = () => { Object.keys(draws).forEach(runDraw); watchers.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); };

  const loadLive = (id) => {
    const def = LIVE[id], key = def.key(params);
    const st = live[id] || (live[id] = {cache: new Map(), key: null, last: null});
    st.key = key;
    let e = st.cache.get(key);
    if (!e) {
      e = {status: 'loading', data: [], meta: null};
      st.cache.set(key, e);
      def.get(params).then((answer) => {
        const L = loaders[id]; const r = L ? L.fn({answer}) : {data: answer};
        e.status = 'ok'; e.data = r.data || []; e.meta = r.meta || null; e.columns = r.columns;
      }).catch((err) => { e.status = 'error'; e.message = String(err && err.message || err); }).then(() => { if (st.key === key) st.last = e.status === 'ok' ? e : st.last; bump(); });
    }
    if (e.status === 'loading' && st.last) return {status: 'ok', data: st.last.data, meta: st.last.meta, refreshing: true};
    return {status: e.status, data: e.data, meta: e.meta, message: e.message, refreshing: false, columns: e.columns};
  };
  const rowsOf = (id) => { const d = dash.data(id); return calcs[id] ? d.data : (d.status === 'ok' && Array.isArray(d.data) ? d.data : []); };

  const dash = window.dash = {
    colors: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => 'var(--hd-c' + i + ')'),
    data: (id) => {
      if (files[id]) return files[id];
      if (LIVE[id]) return loadLive(id);
      if (calcs[id]) {
        if (calcCache.has(id)) return calcCache.get(id);
        const c = calcs[id]; let out;
        calcCache.set(id, {status: 'loading', data: null});
        try {
          const waiting = c.inputs.some((i) => FILES[i] && files[i].status !== 'ok');
          out = waiting ? {status: 'loading', data: null} : {status: 'ok', data: c.fn(...c.inputs.map(rowsOf))};
        } catch (e) { console.error('calc ' + id, e); out = {status: 'error', data: null, message: String(e.message)}; }
        calcCache.set(id, out); return out;
      }
      return {status: 'missing', data: []};
    },
    calc: (id, o) => { calcs[id] = o; },
    loader: (id, o) => { loaders[id] = o; },
    draw: (name, fn) => { if (fn) draws[name] = fn; else runDraw(name); },
    onData: (fn) => { watchers.push(fn); if (started) fn(); },
    refresh: (id) => { if (live[id]) { live[id].cache.delete(live[id].key); bump(); } },
    params: () => ({...params}),
    setParams: (p) => { let ch = false; Object.entries(p).forEach(([k, v]) => { if (String(params[k]) !== String(v)) { params[k] = v; ch = true; } }); if (ch) bump(); },
    resetParams: () => { params = {condition: 'diabetes', country: 'United Arab Emirates', pmcountry: 'United Arab Emirates', pmids: []}; bump(); },
    setLink: (name) => { try { history.replaceState(null, '', '#/' + name); } catch (e) { /* ignore */ } },
    describe: () => ({files: Object.entries(FILES).map(([id, f]) => ({id, path: f[0], title: f[1], description: f[2]})), live: Object.entries(LIVE).filter(([id]) => !/^tl_(?!ARE)/.test(id)).map(([id, l]) => ({id, title: l.title, description: l.description})), calcs: Object.entries(calcs).map(([id, c]) => ({id, title: c.title, description: c.description}))})
  };

  Object.keys(FILES).forEach((id) => { files[id] = {status: 'loading', data: []}; });
  dash.start = () => {
    started = true; redraw();
    Object.entries(FILES).forEach(([id, f]) => {
      const done = (data) => { files[id] = {status: 'ok', data}; if (Array.isArray(data) && data.columns) files[id].columns = data.columns; bump(); };
      (f[0].endsWith('.json') ? d3.json(f[0]) : d3.csv(f[0])).then(done).catch((e) => { files[id] = {status: 'error', data: [], message: String(e.message)}; bump(); });
    });
    // Anything that becomes visible (tabs, sub-tabs, workspaces) is drawn at its real width
    new MutationObserver((ms) => { if (ms.some((m) => !m.target.classList.contains('tip'))) schedule(); }).observe(document.getElementById('dash-root'), {attributes: true, attributeFilter: ['hidden'], subtree: true});
    let w = window.innerWidth; window.addEventListener('resize', () => { if (window.innerWidth !== w) { w = window.innerWidth; schedule(); } });
  };
})();
