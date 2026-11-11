(function(){
const H = window.HD;
dash.draw('method', (el) => {
  el.replaceChildren(); const d = dash.describe();
  [['Datasets', d.files], ['Live sources', d.live], ['Scores and calculations', d.calcs]].forEach(([title, list]) => {
    const h3 = document.createElement('h3'); h3.textContent = title; const dl = document.createElement('dl');
    list.forEach((x) => { const dt = document.createElement('dt'); dt.textContent = x.title || x.id; const dd = document.createElement('dd'); dd.textContent = x.description || ''; dl.append(dt, dd); });
    el.append(h3, dl);
  });
});
window.addEventListener('hashchange', () => { const id = (location.hash || '').replace(/^#\/?/, ''); if (id && document.querySelector('.hd section#' + CSS.escape(id))) H.go(id); });
})();
(function(){
const H = window.HD;
// Tabs, global filters, stakeholder chips, KPI tiles (listen; set hidden/aria)
const show = (id) => {
  document.querySelectorAll('.hd .tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
  document.querySelectorAll('.hd section').forEach((s) => { s.hidden = s.id !== id; });
  document.querySelectorAll('.hd #filters').forEach((f) => { f.hidden = ['benchmark', 'home', 'downloads', 'about'].includes(id); });
  document.querySelectorAll('.hd #hero').forEach((x) => { x.hidden = id === 'home'; });
  dash.setLink(id);
};
document.querySelectorAll('.hd .tab').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
const hash = (location.hash || '').replace(/^#\/?/, '');
if (hash && document.querySelector('.hd section#' + CSS.escape(hash))) show(hash); else show('home');
document.querySelectorAll('.hd #grp').forEach((s) => s.addEventListener('change', () => { H.s.grp = s.value; H.redraw(); }));
document.querySelectorAll('.hd #bench').forEach((c) => c.addEventListener('change', () => { H.s.bench = c.checked; H.redraw(); }));
document.querySelectorAll('.hd #sexseg button').forEach((b) => b.addEventListener('click', () => {
  H.s.sex = b.dataset.sex; document.querySelectorAll('.hd #sexseg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); H.redraw();
}));
document.querySelectorAll('.hd #shchips .chip').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.hd #shchips .chip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  document.querySelectorAll('.hd .shblock').forEach((blk) => { blk.hidden = blk.dataset.shb !== b.dataset.sh; });
}));
document.querySelectorAll('.hd .kpi').forEach((k) => k.addEventListener('click', () => { H.s.ind = k.dataset.ind; H.redraw(); show('explorer'); }));
})();
dash.start();
