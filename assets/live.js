(function(){
// Live data: open-trial counts per MENA country, fetched from ClinicalTrials.gov each time the page opens
const H = window.HD;
H.LIVE_C = [['ARE', 'United Arab Emirates'], ['SAU', 'Saudi Arabia'], ['QAT', 'Qatar'], ['KWT', 'Kuwait'], ['BHR', 'Bahrain'], ['OMN', 'Oman'], ['JOR', 'Jordan'], ['LBN', 'Lebanon'], ['IRQ', 'Iraq'], ['EGY', 'Egypt'], ['MAR', 'Morocco'], ['TUN', 'Tunisia'], ['DZA', 'Algeria'], ['LBY', 'Libya']];
H.names.push('livepill');
H.LIVE_C.forEach(([code]) => dash.loader('tl_' + code, {
  description: 'Keeps only the total number of matching trials from the ClinicalTrials.gov answer.',
  fn: ({answer}) => {
    if (!answer || answer.total == null) throw new Error((answer && (answer.error || answer.message)) || 'No total in the answer');
    return {data: [{total: Number(answer.total)}]};
  }
}));

dash.calc('trials_live', {
  inputs: ['trials', ...H.LIVE_C.map(([c]) => 'tl_' + c)],
  title: 'Open clinical trials by country (live)',
  description: 'Recruiting or not-yet-recruiting trials per country, counted live on ClinicalTrials.gov when the page opens. Where a live count is not available to the reader, the 10 Nov 2026 snapshot is used and the row says so. The cardiometabolic count is from the snapshot.',
  fn: (snapshot, ...live) => snapshot.map((s) => {
    const i = H.LIVE_C.findIndex(([c]) => c === s.code);
    const l = i >= 0 && live[i] && live[i][0] ? Number(live[i][0].total) : null;
    const total = l != null && !isNaN(l) ? l : Number(s.active_trials);
    const cardio = Math.min(Number(s.cardiometabolic_trials), total);
    return {code: s.code, country: s.country, group: s.group, active_trials: total, cardiometabolic_trials: cardio, other_trials: total - cardio, counted: l != null && !isNaN(l) ? 'live' : 'snapshot ' + s.snapshot_date};
  })
});

dash.draw('livepill', (el) => {
  const d = dash.data('trials_live'); const rows = d.status === 'ok' && d.data ? d.data : [];
  const n = rows.filter((r) => r.counted === 'live').length;
  el.textContent = n ? `Trial counts live (${n}/14 countries)` : 'Trial counts: 10 Nov 2026 snapshot';
  el.setAttribute('data-source', 'trials_live'); el.setAttribute('data-field', 'counted');
});

})();
