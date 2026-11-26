import { Chart, THEMES } from './chart.js';
import { TOOLS, CATEGORIES, UTILITIES } from './tools.js';
import { INDICATORS, defaultParams, indicatorLabel } from './indicators.js';
import { ds, isNative, loadCreds, saveCreds } from './datasource.js';
import { notify, askNotifyPermission, shareImage } from './native.js';
import { Overview } from './overview.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => Math.random().toString(36).slice(2, 10);
const icon = d => `<svg class="i" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const BROKERS = { oanda: 'OANDA', forexcom: 'FOREX.com' };
const TFS = [['1m', '1m'], ['3m', '3m'], ['5m', '5m'], ['15m', '15m'], ['30m', '30m'], ['1h', '1j'], ['2h', '2j'], ['4h', '4j'], ['1D', '1H'], ['1W', '1M']];
const TF_MS = { '1m': 60e3, '3m': 180e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3, '1h': 3600e3, '2h': 7200e3, '4h': 14400e3, '1D': 86400e3, '1W': 604800e3 };
const tfLabel = tf => TFS.find(t => t[0] === tf)?.[1] || tf;
const IC = {
  cursor: 'M5 3L19 12L12 13.5L9 20Z',
  undo: 'M9 14L4 9L9 4 M4 9H15a5 5 0 0 1 0 10H11', redo: 'M15 14L20 9L15 4 M20 9H9a5 5 0 0 0 0 10H13',
  share: 'M12 15V3 M8 7L12 3L16 7 M5 12V20H19V12', full: 'M4 9V4H9 M15 4H20V9 M20 15V20H15 M9 20H4V15', list: 'M8 6H20 M8 12H20 M8 18H20 M4 6h.01 M4 12h.01 M4 18h.01',
  theme: 'M12 3a9 9 0 1 0 9 9a7 7 0 0 1 -9 -9Z', close: 'M6 6L18 18 M18 6L6 18', back: 'M15 5L8 12L15 19',
  search: 'M10 10m-6.5 0a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0 M20 20L15 15', plus: 'M12 5V19 M5 12H19',
  all: 'M4 4h6v6h-6z M14 4h6v6h-6z M4 14h6v6h-6z M14 14h6v6h-6z', clone: 'M8 8H20V20H8Z M4 16V4H16',
  trash: 'M4 6H20 M9 6V3H15V6 M6 6L7 21H17L18 6', lock: 'M6 11H18V21H6Z M8 11V7a4 4 0 0 1 8 0', unlock: 'M6 11H18V21H6Z M8 11V7a4 4 0 0 1 7.5 -2',
  extend: 'M3 12H21 M17 8L21 12L17 16', text: 'M5 5H19 M12 5V20 M9 20H15',
  gear: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M12 2V5 M12 19V22 M2 12H5 M19 12H22 M4.9 4.9L7 7 M17 17L19.1 19.1 M4.9 19.1L7 17 M17 7L19.1 4.9',
  pen: 'M4 20L15 9L19 13L8 24 M15 9L18 6L22 10L19 13 M4 20L3 21', ind: 'M3 20L9 12L13 16L21 6 M3 4V20H21',
  layout: 'M3 4H21V20H3Z M12 4V20 M3 12H12', bell: 'M6 16V11a6 6 0 0 1 12 0V16L20 18H4Z M10 21h4',
  replay: 'M11 18L3 12L11 6Z M21 18L13 12L21 6Z', layers: 'M12 3L22 8L12 13L2 8Z M2 12L12 17L22 12 M2 16L12 21L22 16',
  eye: 'M2 12C5 6 9 4 12 4S19 6 22 12C19 18 15 20 12 20S5 18 2 12Z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  eyeoff: 'M3 3L21 21 M10.6 10.6a3 3 0 0 0 4.2 4.2 M9.9 5.1A9.7 9.7 0 0 1 12 5c4 0 7.5 2.5 10 7a17 17 0 0 1 -3 4 M6.6 6.6C4.6 8 3.2 9.8 2 12c2.5 4.5 6 7 10 7c1.6 0 3.1 -.4 4.4 -1.1',
  play: 'M7 4L20 12L7 20Z', pause: 'M7 4V20 M17 4V20', step: 'M5 4L15 12L5 20Z M19 4V20', start: 'M12 3V21 M4 12H10',
  more: 'M12 5h.01 M12 12h.01 M12 19h.01',
};

// ---------- State ----------
const saved = JSON.parse(localStorage.getItem('ac:state') || '{}');
const defStudies = () => [{ id: uid(), type: 'volume', params: defaultParams('volume') }];
const state = {
  layout: '1', active: 0, theme: 'light',
  panes: [{ symbol: saved.symbol || 'XAUUSD', broker: saved.broker || 'oanda', tf: saved.tf || '5m', chartType: saved.chartType || 'candles', studies: defStudies() }],
  favorites: ['trendline', 'vline', 'fibret', 'fibcircles', 'gannbox', 'gannfan'],
  watchlist: [['XAUUSD', 'oanda'], ['XAUUSD', 'forexcom'], ['EURUSD', 'oanda'], ['USDJPY', 'forexcom'], ['GBPUSD', 'oanda'], ['BTCUSD', 'oanda'], ['NAS100', 'forexcom'], ['USDIDR', 'forexcom']],
  magnet: 'off', panelTab: 'tren', styleDefaults: {}, recent: [], ovOpen: true,
  ...saved,
};
delete state.symbol; delete state.broker; delete state.tf; delete state.chartType; delete state.indicators;
const save = () => localStorage.setItem('ac:state', JSON.stringify(state));
let SYMBOLS = [];
const symInfo = (s, b) => SYMBOLS.find(x => x.symbol === s && (!b || x.broker === b));
const LAYOUTS = { 1: 1, '2h': 2, '2v': 2, 3: 3, 4: 4 };

function toast(msg, ms = 2200) {
  const el = $('#toast'); el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add('hidden'), ms);
}
const fmtP = (v, dg) => v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('id-ID', { minimumFractionDigits: dg, maximumFractionDigits: dg });

// ---------- Ikon simbol ----------
function symIconHtml(s, cls = 'sym-icon') {
  const info = symInfo(s) || { icon: 'fx' };
  const map = { gold: ['#d4a017', 'Au'], silver: ['#9e9e9e', 'Ag'], btc: ['#f7931a', '₿'], eth: ['#627eea', 'Ξ'], index: ['#2962ff', '▲'], oil: ['#37474f', '◆'], usd: ['#1b5e20', '$'] };
  const [bg, ch] = map[info.icon] || ['#3f51b5', ({ EUR: '€', GBP: '£', USD: '$', AUD: 'A$', NZD: 'N$', JPY: '¥', CAD: 'C$', CHF: '₣' })[s.slice(0, 3)] || s[0]];
  return `<span class="${cls}" style="background:${bg}">${ch}</span>`;
}

// =====================================================================
// Pane chart
// =====================================================================
class Pane {
  constructor(idx) {
    this.idx = idx;
    this.el = document.createElement('div'); this.el.className = 'pane';
    this.el.innerHTML = `<div class="chart"></div><div class="legend"></div><button class="go-latest hidden" title="Ke bar terbaru">»</button>`;
    $('#charts').appendChild(this.el);
    this.legend = this.el.querySelector('.legend');
    this.chart = new Chart(this.el.querySelector('.chart'));
    const c = this.chart;
    c.theme = THEMES[state.theme]; c.magnet = state.magnet; c.styleDefaults = state.styleDefaults;
    c.stay = G.stay; c.hidden = G.hidden; c.lockAll = G.lockAll; c.hideStudies = G.hideStudies;
    this.el.addEventListener('pointerdown', () => setActive(this.idx), true);
    this.el.querySelector('.go-latest').onclick = () => c.goLatest();
    c.on('crosshair', info => { this.hover = info; this.updateLegend(); });
    c.canvas.addEventListener('pointerleave', () => { this.hover = null; this.updateLegend(); });
    c.on('select', d => { if (this.idx === state.active) onSelect(d); });
    c.on('tool', () => { renderRail(); renderToolGrid(); });
    c.on('drawings', list => {
      localStorage.setItem(`ac:drawings:${this.cfg.symbol}`, JSON.stringify(list.filter(d => !TOOLS[d.tool].temp)));
      for (const p of panes) if (p !== this && p.cfg.symbol === this.cfg.symbol) p.chart.setDrawings(JSON.parse(JSON.stringify(list)));
      if (!$('#treePanel').classList.contains('hidden')) renderTree();
    });
    c.on('study', id => openStudySettings(this, id));
    c.on('alertmove', al => { const a = alerts.find(x => x.id === al.id); if (a) { a.price = al.price; a.active = true; saveAlerts(); toast(`Alarm dipindah ke ${c.fmt(al.price)}`); } });
    c.on('alertclick', al => editAlert(alerts.find(x => x.id === al.id)));
    c.on('replay', r => { if (this.idx === state.active) renderReplayBar(); });
  }
  get cfg() { return state.panes[this.idx]; }
  destroy() { clearInterval(this.timer); this.el.remove(); }
  async load() {
    const seq = this.seq = (this.seq || 0) + 1;
    clearInterval(this.timer);
    const c = this.chart, cfg = this.cfg;
    if (c.replay) c.stopReplay();
    c.chartType = cfg.chartType;
    c.studies = cfg.studies;
    c.setData([], {});
    c.setDrawings(JSON.parse(localStorage.getItem(`ac:drawings:${cfg.symbol}`) || '[]'));
    syncAlerts();
    this.updateLegend();
    try {
      const d = await ds.candles(cfg.broker, cfg.symbol, cfg.tf, 1500);
      if (seq !== this.seq) return;
      c.setData(d.candles, { tfMs: TF_MS[cfg.tf], digits: d.digits });
      this.source = d.source;
      if (this.idx === state.active) setSource(d.source);
      this.updateLegend();
      this.timer = setInterval(() => this.poll(), 2000);
    } catch (e) {
      c.loadingText = 'Gagal memuat data'; c.invalidate();
      toast('Gagal memuat data: ' + e.message, 5000);
    }
  }
  async poll() {
    const seq = this.seq, cfg = this.cfg;
    try {
      const d = await ds.candles(cfg.broker, cfg.symbol, cfg.tf, 3);
      if (seq !== this.seq) return;
      this.chart.updateLast(d.candles);
      if (!this.hover) this.updateLegend();
      checkAlerts(cfg.symbol, cfg.broker, d.candles.at(-1)?.c);
      if (this.idx === state.active) overview.show(symInfo(cfg.symbol, cfg.broker), cfg.broker, d.candles.at(-1)?.c);
      this.el.querySelector('.go-latest').classList.toggle('hidden', this.chart.scroll >= this.chart.candles.length - 3);
    } catch { /* abaikan kegagalan sementara */ }
  }
  updateLegend() {
    const c = this.hover || this.chart.candles.at(-1), cfg = this.cfg;
    const prev = this.hover ? this.hover.prev : this.chart.candles.at(-2);
    const name = `<span class="t">${cfg.symbol} · ${tfLabel(cfg.tf)} · ${BROKERS[cfg.broker]}</span>`;
    if (!c) { this.legend.innerHTML = name; return; }
    const cls = c.c >= c.o ? 'up' : 'down', f = v => this.chart.fmt(v);
    const ch = prev ? c.c - prev.c : 0, chp = prev ? (ch / prev.c) * 100 : 0;
    this.legend.innerHTML = `${name}
      <span>O<span class="v ${cls}"> ${f(c.o)}</span></span><span>H<span class="v ${cls}"> ${f(c.h)}</span></span>
      <span>L<span class="v ${cls}"> ${f(c.l)}</span></span><span>C<span class="v ${cls}"> ${f(c.c)}</span></span>
      <span class="v ${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '+' : ''}${f(ch)} (${ch >= 0 ? '+' : ''}${chp.toFixed(2)}%)</span>`;
    const top = this.legend.offsetTop + this.legend.offsetHeight + 10;
    if (top !== this.chart.legendTop) { this.chart.legendTop = top; this.chart.invalidate(); }
  }
}

const G = { stay: false, hidden: false, lockAll: false, hideStudies: false };
let panes = [];
const act = () => panes[state.active] || panes[0];
const chart = () => act().chart;

function buildPanes() {
  const n = LAYOUTS[state.layout] || 1;
  while (state.panes.length < n) state.panes.push({ ...JSON.parse(JSON.stringify(state.panes[state.panes.length - 1])), studies: defStudies() });
  while (panes.length > n) panes.pop().destroy();
  const fresh = [];
  while (panes.length < n) { const p = new Pane(panes.length); panes.push(p); fresh.push(p); }
  if (state.active >= n) state.active = 0;
  $('#charts').className = 'l' + state.layout;
  $('#app').classList.toggle('multi', n > 1);
  panes.forEach((p, k) => p.el.classList.toggle('active', k === state.active));
  fresh.forEach(p => p.load());
  requestAnimationFrame(() => panes.forEach(p => p.chart.resize()));
}
function setActive(k) {
  if (k === state.active) return;
  const prev = act();
  prev?.chart.setTool(null); prev.chart.selected = null; prev.chart.invalidate(); onSelect(null);
  state.active = k; save();
  panes.forEach((p, i) => p.el.classList.toggle('active', i === k));
  renderHeader(); renderRail(); renderToolGrid(); renderReplayBar();
  setSource(act().source || 'demo');
  if (!$('#treePanel').classList.contains('hidden')) renderTree();
}
function loadActive() {
  const cfg = act().cfg;
  state.recent = [{ symbol: cfg.symbol, broker: cfg.broker, tf: cfg.tf }, ...state.recent.filter(r => !(r.symbol === cfg.symbol && r.broker === cfg.broker && r.tf === cfg.tf))].slice(0, 10);
  save(); renderHeader(); act().load();
}
function setSymbol(symbol, broker, tf) {
  const cfg = act().cfg; cfg.symbol = symbol; cfg.broker = broker; if (tf) cfg.tf = tf; loadActive();
}

// =====================================================================
// Header & sumber data
// =====================================================================
function setSource(src) {
  const b = $('#srcBadge');
  b.className = 'src-badge ' + src;
  b.textContent = src === 'live' ? '● LIVE' : innerWidth < 820 ? 'DEMO' : 'DATA DEMO';
  b.title = src === 'live' ? 'Data langsung dari broker' : 'Kredensial broker belum diisi — menampilkan data sintetis, bukan harga pasar asli. Ketuk untuk membuka Pengaturan.';
}
function renderHeader() {
  const cfg = act().cfg;
  $('#symIcon').outerHTML = symIconHtml(cfg.symbol).replace('class="sym-icon"', 'id="symIcon" class="sym-icon"');
  $('#symName').textContent = cfg.symbol;
  $('#symBroker').textContent = BROKERS[cfg.broker];
  document.querySelectorAll('#tfBar button').forEach(b => b.classList.toggle('on', b.dataset.tf === cfg.tf));
  $('#tfSelect').value = cfg.tf;
  $('#chartType').value = cfg.chartType;
  document.title = `${cfg.symbol} · ${BROKERS[cfg.broker]} — LokiChart`;
  renderWatchlist(); renderRecent();
  overview.show(symInfo(cfg.symbol, cfg.broker), cfg.broker, act().chart.candles.at(-1)?.c);
}
$('#tfBar').innerHTML = TFS.map(([v, l]) => `<button data-tf="${v}">${l}</button>`).join('');
$('#tfBar').insertAdjacentHTML('afterend', `<select id="tfSelect">${TFS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`);
$('#tfBar').onclick = e => { const tf = e.target.dataset.tf; if (tf) { act().cfg.tf = tf; loadActive(); } };
$('#tfSelect').onchange = e => { act().cfg.tf = e.target.value; loadActive(); };
$('#chartType').onchange = e => { act().cfg.chartType = chart().chartType = e.target.value; save(); chart().invalidate(); };

function setTheme(t) {
  state.theme = t; save();
  document.body.classList.toggle('dark', t === 'dark');
  for (const p of panes) { p.chart.theme = THEMES[t]; p.chart.invalidate(); }
  document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#131722' : '#ffffff';
}
$('#themeBtn').innerHTML = icon(IC.theme); $('#wlBtn').innerHTML = icon(IC.list); $('#setBtn').innerHTML = icon(IC.gear);
for (const id of ['closeDraw', 'closeSet', 'closeTree', 'closeInd', 'closeForm', 'closeAlert']) $('#' + id).innerHTML = icon(IC.close);
$('#closeSearch').innerHTML = icon(IC.back);
document.querySelectorAll('.search-ico').forEach(e => { e.innerHTML = icon(IC.search); });
$('#wlAdd').innerHTML = icon(IC.plus);
$('#themeBtn').onclick = () => setTheme(state.theme === 'light' ? 'dark' : 'light');
$('#wlBtn').onclick = () => { $('#watchlist').classList.toggle('hidden'); $('#wlBtn').classList.toggle('on'); panes.forEach(p => p.chart.resize()); };

// =====================================================================
// Toolbar bawah & simbol terakhir
// =====================================================================
const BB_ICONS = { draw: IC.pen, ind: IC.ind, layout: IC.layout, alert: IC.bell, replay: IC.replay, tree: IC.layers, undo: IC.undo, redo: IC.redo, full: IC.full, share: IC.share };
document.querySelectorAll('[data-bb]').forEach(b => { b.innerHTML = icon(BB_ICONS[b.dataset.bb]); });
$('#bottombar').onclick = e => {
  const r = e.target.closest('[data-recent]');
  if (r) { const x = state.recent[+r.dataset.recent]; return setSymbol(x.symbol, x.broker, x.tf); }
  const b = e.target.closest('[data-bb]'); if (!b) return;
  switch (b.dataset.bb) {
    case 'draw': runUtility('panel'); break;
    case 'ind': openIndicators(); break;
    case 'layout': layoutMenu(b); break;
    case 'alert': openAlerts(); break;
    case 'replay': replayToggle(); break;
    case 'tree': toggleTree(); break;
    case 'undo': chart().undo(); break;
    case 'redo': chart().redo(); break;
    case 'full': toggleFull(); break;
    case 'share': doShare(); break;
  }
};
function renderRecent() {
  const cfg = act().cfg;
  $('#recent').innerHTML = state.recent.map((r, k) => `<button data-recent="${k}" class="${r.symbol === cfg.symbol && r.broker === cfg.broker && r.tf === cfg.tf ? 'on' : ''}"><b>${r.symbol}</b><small>${tfLabel(r.tf)} · ${BROKERS[r.broker]}</small></button>`).join('');
}
function toggleFull() {
  const on = !document.body.classList.contains('focus');
  document.body.classList.toggle('focus', on);
  try { on ? document.documentElement.requestFullscreen?.() : document.fullscreenElement && document.exitFullscreen(); } catch { /* */ }
  setTimeout(() => panes.forEach(p => p.chart.resize()), 100);
}
async function doShare() {
  const cfg = act().cfg;
  try {
    const r = await shareImage(chart().screenshot(), `LokiChart_${cfg.symbol}_${cfg.tf}_${Date.now()}.png`);
    if (r === 'downloaded') toast('Gambar chart disimpan');
  } catch (e) { toast('Gagal membagikan: ' + e.message); }
}

// ---------- Menu popup ----------
function popMenu(anchor, html, onClick) {
  const m = $('#popMenu');
  m.innerHTML = html; m.classList.remove('hidden');
  const r = anchor.getBoundingClientRect(), mw = m.offsetWidth, mh = m.offsetHeight;
  let x = Math.min(r.left, innerWidth - mw - 8), y = r.bottom + 4;
  if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 4);
  m.style.left = Math.max(8, x) + 'px'; m.style.top = y + 'px';
  m.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; m.classList.add('hidden'); onClick(b.dataset.v); };
}
document.addEventListener('pointerdown', e => { if (!e.target.closest('#popMenu') && !e.target.closest('.more') && !e.target.closest('[data-bb=layout]')) $('#popMenu').classList.add('hidden'); });
function layoutMenu(anchor) {
  const L = [['1', '1 chart'], ['2h', '2 chart berdampingan'], ['2v', '2 chart bertumpuk'], ['3', '3 chart'], ['4', '4 chart (2×2)']];
  popMenu(anchor, '<div class="mh">Layout</div>' + L.map(([v, n]) => `<button class="mi ${state.layout === v ? 'on' : ''}" data-v="${v}">${n}</button>`).join(''), v => {
    state.layout = v; save(); buildPanes(); renderHeader();
  });
}

// =====================================================================
// Rail (bilah alat kiri) & panel alat gambar
// =====================================================================
const QUICK = ['trendline', 'hline', 'parallel', 'fibret', 'xabcd', 'longpos', 'rect', 'brush', 'text'];
const UT = id => UTILITIES.find(u => u.id === id).icon;
function renderRail() {
  const c = chart(); if (!c) return;
  const magnetLabel = { off: '', weak: 'L', strong: 'K' }[state.magnet];
  $('#rail').innerHTML = `
    <button class="icon-btn ${!c.tool ? 'on' : ''}" data-act="cursor" title="Kursor">${icon(IC.cursor)}</button>
    ${QUICK.map(id => `<button class="icon-btn ${c.tool === id ? 'on' : ''}" data-tool="${id}" title="${TOOLS[id].name}">${icon(TOOLS[id].icon)}</button>`).join('')}
    <button class="icon-btn ${!$('#drawPanel').classList.contains('hidden') ? 'on' : ''}" data-act="panel" title="Semua alat gambar">${icon(IC.all)}</button>
    <div class="sep"></div>
    <button class="icon-btn ${c.tool === 'measure' ? 'on' : ''}" data-act="measure" title="Pengukuran">${icon(TOOLS.measure.icon)}</button>
    <button class="icon-btn ${c.tool === 'zoomin' ? 'on' : ''}" data-act="zoomin" title="Perbesar (seret area)">${icon(UT('zoomin'))}</button>
    <button class="icon-btn ${state.magnet !== 'off' ? 'on' : ''}" data-act="magnet" title="Magnet: ${state.magnet}">${icon(UT('magnet'))}<span class="badge">${magnetLabel}</span></button>
    <button class="icon-btn ${G.stay ? 'on' : ''}" data-act="stay" title="Tetap menggambar">${icon(UT('stay'))}</button>
    <button class="icon-btn ${G.lockAll ? 'on' : ''}" data-act="lock" title="Kunci seluruh gambar">${icon(IC.lock)}</button>
    <button class="icon-btn ${G.hidden ? 'on' : ''}" data-act="hide" title="Sembunyikan gambar">${icon(UT('hide'))}</button>
    <button class="icon-btn ${c.tool === 'eraser' ? 'on' : ''}" data-act="eraser" title="Penghapus">${icon(UT('eraser'))}</button>
    <button class="icon-btn" data-act="clear" title="Hapus gambar">${icon(IC.trash)}</button>`;
}
$('#rail').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tool) return selectTool(chart().tool === b.dataset.tool ? null : b.dataset.tool);
  runUtility(b.dataset.act, b);
};
function selectTool(id) {
  chart().setTool(id);
  renderRail(); renderToolGrid();
  if (id && TOOLS[id]) {
    const t = TOOLS[id];
    toast(t.freehand ? `${t.name}: seret jari untuk menggambar` : t.n === Infinity ? `${t.name}: ketuk titik-titik, ketuk titik terakhir lagi untuk selesai` : `${t.name}: ketuk ${t.n} titik pada chart`, 2000);
  }
}
const allCharts = () => panes.map(p => p.chart);
function setGlobal(key, val) { G[key] = val; for (const c of allCharts()) { c[key] = val; if (key === 'hidden') c.selected = null; c.invalidate(); } }

function runUtility(act_, anchor) {
  const c = chart();
  switch (act_) {
    case 'cursor': selectTool(null); break;
    case 'panel': $('#drawPanel').classList.toggle('hidden'); break;
    case 'measure': selectTool(c.tool === 'measure' ? null : 'measure'); break;
    case 'eraser': selectTool(c.tool === 'eraser' ? null : 'eraser'); break;
    case 'zoomin': selectTool(c.tool === 'zoomin' ? null : 'zoomin'); if (chart().tool) toast('Seret area pada chart untuk memperbesar'); break;
    case 'zoomout': c.zoomOut(); break;
    case 'stay': setGlobal('stay', !G.stay); toast(G.stay ? 'Tetap menggambar: AKTIF' : 'Tetap menggambar: NONAKTIF'); break;
    case 'hide': setGlobal('hidden', !G.hidden); onSelect(null); break;
    case 'hidestudies': setGlobal('hideStudies', !G.hideStudies); break;
    case 'hideall': { const v = !(G.hidden && G.hideStudies); setGlobal('hidden', v); setGlobal('hideStudies', v); onSelect(null); break; }
    case 'lock': setGlobal('lockAll', !G.lockAll); toast(G.lockAll ? 'Semua gambar dikunci' : 'Kunci gambar dibuka'); break;
    case 'magnet': {
      const order = ['off', 'weak', 'strong'];
      setMagnet(order[(order.indexOf(state.magnet) + 1) % 3]); break;
    }
    case 'magnet-off': setMagnet('off'); break;
    case 'magnet-weak': setMagnet('weak'); break;
    case 'magnet-strong': setMagnet('strong'); break;
    case 'clear':
      if (c.drawings.length && confirm(`Hapus semua gambar (${c.drawings.length}) di ${act().cfg.symbol}?`)) c.clearDrawings();
      break;
    case 'clearstudies':
      if (act().cfg.studies.length && confirm('Hapus semua indikator di chart ini?')) { act().cfg.studies.length = 0; save(); c.invalidate(); }
      break;
    case 'clearall':
      if (confirm('Hapus semua gambar dan indikator di chart ini?')) { c.clearDrawings(); act().cfg.studies.length = 0; save(); c.invalidate(); }
      break;
  }
  renderRail(); renderToolGrid();
  if (!$('#treePanel').classList.contains('hidden')) renderTree();
}
function setMagnet(m) {
  state.magnet = m; save();
  for (const c of allCharts()) c.magnet = m;
  toast({ off: 'Magnet: mati', weak: 'Magnet Lemah: menempel ke OHLC terdekat', strong: 'Magnet Kuat: selalu menempel ke OHLC' }[m]);
}

function renderToolTabs() {
  $('#toolTabs').innerHTML = CATEGORIES.map(([k, n]) => `<button data-k="${k}" class="${state.panelTab === k ? 'on' : ''}">${n}</button>`).join('');
}
$('#toolTabs').onclick = e => { const k = e.target.dataset.k; if (k) { state.panelTab = k; save(); renderToolTabs(); renderToolGrid(); } };
$('#toolSearch').oninput = renderToolGrid;
$('#closeDraw').onclick = () => { $('#drawPanel').classList.add('hidden'); renderRail(); };

const SUBMENU = {
  hide: [['hide', 'Sembunyikan gambar'], ['hidestudies', 'Sembunyikan indikator'], ['hideall', 'Sembunyikan semua']],
  magnet: [['magnet-off', 'Magnet mati'], ['magnet-weak', 'Magnet Lemah'], ['magnet-strong', 'Magnet Kuat']],
  clear: [['clear', 'Hapus gambar'], ['clearstudies', 'Hapus indikator'], ['clearall', 'Hapus semua']],
};
function utilOn(u) {
  const c = chart();
  return { measure: c.tool === 'measure', eraser: c.tool === 'eraser', zoomin: c.tool === 'zoomin', stay: G.stay, hide: G.hidden, lock: G.lockAll, magnet: state.magnet !== 'off' }[u.id] || false;
}
function renderToolGrid() {
  const c = chart(); if (!c) return;
  const q = $('#toolSearch').value.trim().toLowerCase();
  let html = '';
  if (!q && state.panelTab === 'peralatan') {
    html = UTILITIES.map(u => {
      const name = u.id === 'magnet' ? { off: 'Magnet (Mati)', weak: 'Magnet Lemah', strong: 'Magnet Kuat' }[state.magnet] : u.id === 'lock' && G.lockAll ? 'Buka kunci gambar' : u.id === 'hide' && G.hidden ? 'Tampilkan gambar' : u.name;
      const dis = u.id === 'zoomout' && !c.zoomStack.length;
      return `<div class="tile ${utilOn(u) ? 'on' : ''} ${dis ? 'disabled' : ''} ${u.kind !== 'tool' ? 'flat' : ''}" data-util="${u.id}">
        ${icon(u.icon)}<span>${name}</span>${SUBMENU[u.id] ? `<span class="more" data-more="${u.id}">⋮</span>` : ''}</div>`;
    }).join('');
  } else {
    const ids = Object.keys(TOOLS).filter(id => {
      const t = TOOLS[id];
      if (q) return t.name.toLowerCase().includes(q);
      if (state.panelTab === 'favorit') return state.favorites.includes(id);
      return t.cat === state.panelTab;
    });
    html = ids.map(id => `<div class="tile ${c.tool === id ? 'on' : ''}" data-tool="${id}">
        <button class="star ${state.favorites.includes(id) ? 'fav' : ''}" data-star="${id}" title="Favorit">★</button>
        ${icon(TOOLS[id].icon)}<span>${TOOLS[id].name}</span></div>`).join('') ||
      `<div class="empty">${state.panelTab === 'favorit' ? 'Belum ada favorit. Ketuk ★ pada alat untuk menambahkannya.' : 'Tidak ada alat yang cocok.'}</div>`;
  }
  $('#toolGrid').innerHTML = html;
}
$('#toolGrid').onclick = e => {
  const more = e.target.closest('[data-more]');
  if (more) {
    e.stopPropagation();
    const cur = { hide: G.hidden ? 'hide' : '', magnet: 'magnet-' + state.magnet, clear: '' }[more.dataset.more];
    return popMenu(more, SUBMENU[more.dataset.more].map(([v, n]) => `<button class="mi ${v === cur ? 'on' : ''}" data-v="${v}">${n}</button>`).join(''), v => runUtility(v));
  }
  const star = e.target.closest('[data-star]');
  if (star) {
    const id = star.dataset.star;
    state.favorites = state.favorites.includes(id) ? state.favorites.filter(x => x !== id) : [...state.favorites, id];
    save(); renderToolGrid(); return;
  }
  const t = e.target.closest('.tile'); if (!t) return;
  if (t.dataset.util) return runUtility(t.dataset.util);
  if (t.dataset.tool) {
    selectTool(chart().tool === t.dataset.tool ? null : t.dataset.tool);
    if (window.innerWidth < 820 && chart().tool) { $('#drawPanel').classList.add('hidden'); renderRail(); }
  }
};

// =====================================================================
// Bar gaya gambar terpilih
// =====================================================================
const COLORS = ['#2962ff', '#f23645', '#089981', '#ff9800', '#9c27b0', '#131722', '#00bcd4', '#e91e63', '#4caf50', '#795548', '#787b86', '#ffeb3b'];
function onSelect(d) {
  const bar = $('#drawBar');
  if (d && bar.dataset.id === d.id && !bar.classList.contains('hidden')) positionDrawBar(d);
  else { showDrawBar(d); bar.dataset.id = d?.id || ''; }
  if (!$('#treePanel').classList.contains('hidden')) renderTree();
}
function showDrawBar(d) {
  const bar = $('#drawBar');
  if (!d || G.hidden) { bar.classList.add('hidden'); return; }
  const t = TOOLS[d.tool];
  const dashLabel = !d.style.dash?.length ? '—' : d.style.dash[0] > 2 ? '- -' : '···';
  bar.innerHTML = `
    <button class="icon-btn" data-a="color" title="Warna"><span class="dot" style="background:${d.style.color}"></span></button>
    <button class="icon-btn w" data-a="width" title="Ketebalan garis">${d.style.width}px</button>
    <button class="icon-btn w" data-a="dash" title="Gaya garis">${dashLabel}</button>
    ${['fibret', 'fibext'].includes(d.tool) ? `<button class="icon-btn ${d.extend ? 'on' : ''}" data-a="extend" title="Perpanjang ke kanan">${icon(IC.extend)}</button>` : ''}
    ${t.needsText ? `<button class="icon-btn" data-a="text" title="Ubah teks">${icon(IC.text)}</button>` : ''}
    <button class="icon-btn ${d.locked ? 'on' : ''}" data-a="lock" title="Kunci">${icon(d.locked ? IC.lock : IC.unlock)}</button>
    <button class="icon-btn" data-a="clone" title="Duplikat">${icon(IC.clone)}</button>
    <button class="icon-btn" data-a="delete" title="Hapus">${icon(IC.trash)}</button>
    <div class="colors">${COLORS.map(c => `<span data-c="${c}" style="background:${c}"></span>`).join('')}</div>`;
  bar.classList.remove('hidden');
  positionDrawBar(d);
}
function positionDrawBar(d) {
  const bar = $('#drawBar'); if (bar.classList.contains('hidden')) return;
  const p = act(), b = p.chart.boundsOf(d);
  const ox = p.el.offsetLeft, oy = p.el.offsetTop, pw = p.el.clientWidth, ph = p.el.clientHeight;
  const bw = bar.offsetWidth || 300;
  const x = Math.min(Math.max(8, (b.x0 + b.x1) / 2 - bw / 2), pw - bw - 80);
  let y = b.y0 - 56; if (y < 40) y = Math.min(b.y1 + 16, ph - 90);
  bar.style.left = ox + Math.max(4, x) + 'px'; bar.style.top = oy + Math.max(40, y) + 'px';
}
$('#drawBar').onclick = e => {
  const c = chart(), d = c.selected; if (!d) return;
  const col = e.target.closest('[data-c]');
  const remember = () => { state.styleDefaults[d.tool] = { ...d.style }; save(); };
  if (col) { c.snapshot(); d.style.color = col.dataset.c; remember(); c.commit(); return showDrawBar(d); }
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (!a) return;
  if (a === 'color') return $('#drawBar .colors').classList.toggle('open');
  c.snapshot();
  if (a === 'width') d.style.width = d.style.width >= 4 ? 1 : d.style.width + 1;
  if (a === 'dash') d.style.dash = !d.style.dash?.length ? [6, 4] : d.style.dash[0] > 2 ? [1, 3] : [];
  if (a === 'extend') d.extend = !d.extend;
  if (a === 'lock') d.locked = !d.locked;
  if (a === 'text') { const s = prompt('Ubah teks:', d.text || ''); if (s != null) d.text = s; }
  if (a === 'clone') { c.history.pop(); return c.cloneDrawing(d); }
  if (a === 'delete') { c.history.pop(); return c.removeDrawing(d); }
  if (['width', 'dash'].includes(a)) remember();
  c.commit(); showDrawBar(d);
};
setInterval(() => { const c = chart(); if (c?.selected) positionDrawBar(c.selected); }, 300);

// =====================================================================
// Pohon objek
// =====================================================================
function toggleTree() { $('#treePanel').classList.toggle('hidden'); renderTree(); }
$('#closeTree').onclick = () => $('#treePanel').classList.add('hidden');
function renderTree() {
  const p = act(), c = p.chart, cfg = p.cfg;
  const studies = cfg.studies.map(s => `<div class="tree-row ${s.hidden ? 'dim' : ''}" data-study="${s.id}">
      <span class="sw" style="background:${s.params.color || '#787b86'}"></span><span class="nm">${esc(indicatorLabel(s))}</span>
      <button class="icon-btn" data-t="seye" title="Tampil/sembunyi">${icon(s.hidden ? IC.eyeoff : IC.eye)}</button>
      <button class="icon-btn" data-t="sset" title="Pengaturan">${icon(IC.gear)}</button>
      <button class="icon-btn" data-t="sdel" title="Hapus">${icon(IC.trash)}</button></div>`).join('') || '<div class="note">Belum ada indikator</div>';
  const draws = c.drawings.slice().reverse().map(d => `<div class="tree-row ${d.hidden ? 'dim' : ''} ${c.selected === d ? 'on' : ''}" data-draw="${d.id}">
      <span class="sw" style="background:${d.style.color}"></span><span class="nm">${esc(TOOLS[d.tool].name)}${d.text ? ': ' + esc(d.text) : ''}</span>
      <button class="icon-btn" data-t="deye" title="Tampil/sembunyi">${icon(d.hidden ? IC.eyeoff : IC.eye)}</button>
      <button class="icon-btn" data-t="dlock" title="Kunci">${icon(d.locked ? IC.lock : IC.unlock)}</button>
      <button class="icon-btn" data-t="ddel" title="Hapus">${icon(IC.trash)}</button></div>`).join('') || '<div class="note">Belum ada gambar</div>';
  const als = alerts.filter(a => a.symbol === cfg.symbol && a.broker === cfg.broker).map(a => `<div class="tree-row ${a.active ? '' : 'dim'}" data-alert="${a.id}">
      <span class="sw" style="background:#ff9800"></span><span class="nm">${COND[a.cond]} ${fmtP(a.price, c.digits)}</span>
      <button class="icon-btn" data-t="aedit" title="Ubah">${icon(IC.gear)}</button>
      <button class="icon-btn" data-t="adel" title="Hapus">${icon(IC.trash)}</button></div>`).join('') || '<div class="note">Belum ada alarm</div>';
  $('#treeList').innerHTML = `<div class="note">${cfg.symbol} · ${tfLabel(cfg.tf)} · ${BROKERS[cfg.broker]}</div>
    <h4>Indikator</h4>${studies}<h4>Gambar (${c.drawings.length})</h4>${draws}<h4>Alarm</h4>${als}`;
}
$('#treeList').onclick = e => {
  const p = act(), c = p.chart, row = e.target.closest('.tree-row'); if (!row) return;
  const t = e.target.closest('[data-t]')?.dataset.t;
  if (row.dataset.study) {
    const s = p.cfg.studies.find(x => x.id === row.dataset.study);
    if (t === 'seye') s.hidden = !s.hidden;
    else if (t === 'sdel') p.cfg.studies.splice(p.cfg.studies.indexOf(s), 1);
    else return openStudySettings(p, s.id);
    save(); c.invalidate();
  } else if (row.dataset.draw) {
    const d = c.drawings.find(x => x.id === row.dataset.draw);
    if (t === 'deye') { c.snapshot(); d.hidden = !d.hidden; if (d.hidden && c.selected === d) { c.selected = null; onSelect(null); } c.commit(); }
    else if (t === 'dlock') { c.snapshot(); d.locked = !d.locked; c.commit(); }
    else if (t === 'ddel') c.removeDrawing(d);
    else if (!d.hidden) { c.selected = d; onSelect(d); c.invalidate(); }
  } else if (row.dataset.alert) {
    const a = alerts.find(x => x.id === row.dataset.alert);
    if (t === 'adel') { alerts.splice(alerts.indexOf(a), 1); saveAlerts(); }
    else editAlert(a);
  }
  renderTree();
};

// =====================================================================
// Indikator
// =====================================================================
function openIndicators() { $('#indModal').classList.remove('hidden'); $('#indSearch').value = ''; renderIndList(); }
$('#closeInd').onclick = () => $('#indModal').classList.add('hidden');
$('#indModal').onclick = e => { if (e.target.id === 'indModal') $('#indModal').classList.add('hidden'); };
$('#indSearch').oninput = renderIndList;
function renderIndList() {
  const q = $('#indSearch').value.trim().toLowerCase(), cfg = act().cfg;
  const activeHtml = cfg.studies.map(s => `<div class="ind-row" data-id="${s.id}"><div class="nm">${esc(indicatorLabel(s))}<small>${INDICATORS[s.type].pane === 'sub' ? 'Pane terpisah' : 'Di chart utama'}</small></div>
    <button class="icon-btn" data-a="eye" title="Tampil/sembunyi">${icon(s.hidden ? IC.eyeoff : IC.eye)}</button>
    <button class="icon-btn" data-a="set" title="Pengaturan">${icon(IC.gear)}</button>
    <button class="icon-btn" data-a="del" title="Hapus">${icon(IC.trash)}</button></div>`).join('');
  const list = Object.entries(INDICATORS).filter(([, d]) => !q || d.name.toLowerCase().includes(q)).map(([k, d]) =>
    `<div class="ind-row" data-add="${k}" style="cursor:pointer"><div class="nm">${esc(d.name)}<small>${d.pane === 'sub' ? 'Pane terpisah' : 'Di chart utama'}</small></div><span class="tag">+ Tambah</span></div>`).join('');
  $('#indList').innerHTML = (activeHtml && !q ? `<h4 style="margin:6px 0">Aktif di chart ini</h4>${activeHtml}<h4 style="margin:14px 0 6px">Semua indikator</h4>` : '') + list;
}
$('#indList').onclick = e => {
  const p = act(), cfg = p.cfg;
  const add = e.target.closest('[data-add]');
  if (add) {
    cfg.studies.push({ id: uid(), type: add.dataset.add, params: defaultParams(add.dataset.add) });
    save(); p.chart.invalidate(); renderIndList(); toast(`${INDICATORS[add.dataset.add].name} ditambahkan`); return;
  }
  const row = e.target.closest('[data-id]'), a = e.target.closest('[data-a]')?.dataset.a; if (!row || !a) return;
  const s = cfg.studies.find(x => x.id === row.dataset.id);
  if (a === 'eye') s.hidden = !s.hidden;
  if (a === 'del') cfg.studies.splice(cfg.studies.indexOf(s), 1);
  if (a === 'set') return openStudySettings(p, s.id);
  save(); p.chart.invalidate(); renderIndList();
};
function openStudySettings(pane, id) {
  const s = pane.cfg.studies.find(x => x.id === id); if (!s) return;
  const def = INDICATORS[s.type];
  openForm(def.name, def.params.map(p => ({ ...p, value: s.params[p.key] })), vals => {
    s.params = { ...s.params, ...vals }; save(); pane.chart.invalidate();
    if (!$('#indModal').classList.contains('hidden')) renderIndList();
  }, [['Hapus', () => { pane.cfg.studies.splice(pane.cfg.studies.indexOf(s), 1); save(); pane.chart.invalidate(); }], ['Reset', () => { s.params = defaultParams(s.type); save(); pane.chart.invalidate(); }]]);
}

// ---------- Form generik ----------
function openForm(title, fields, onSave, extra = []) {
  $('#formTitle').textContent = title;
  $('#formBody').innerHTML = fields.map(f => {
    const v = f.value ?? f.def;
    if (f.type === 'bool') return `<label class="chk"><input type="checkbox" data-k="${f.key}" ${v ? 'checked' : ''}/> ${esc(f.label)}</label>`;
    if (f.type === 'select') return `<label>${esc(f.label)}<select data-k="${f.key}">${f.options.map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select></label>`;
    if (f.type === 'color') return `<label>${esc(f.label)}<input type="color" data-k="${f.key}" value="${esc(v)}"/></label>`;
    if (f.type === 'text') return `<label>${esc(f.label)}<input data-k="${f.key}" value="${esc(v ?? '')}" placeholder="${esc(f.placeholder || '')}"/></label>`;
    return `<label>${esc(f.label)}<input type="number" inputmode="decimal" data-k="${f.key}" value="${v}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} step="${f.step || 'any'}"/></label>`;
  }).join('');
  $('#formActions').innerHTML = extra.map(([n], k) => `<button class="ghost" data-x="${k}">${n}</button>`).join('') + '<button class="primary" data-x="ok">Simpan</button>';
  $('#formActions').onclick = e => {
    const x = e.target.closest('[data-x]')?.dataset.x; if (x == null) return;
    if (x === 'ok') {
      const vals = {};
      for (const f of fields) {
        const el = $('#formBody').querySelector(`[data-k="${f.key}"]`);
        let v = f.type === 'bool' ? el.checked : el.value;
        if (f.type === 'number') { v = parseFloat(String(v).replace(',', '.')); if (!isFinite(v)) v = f.def; if (f.min != null) v = Math.max(f.min, v); if (f.max != null) v = Math.min(f.max, v); }
        vals[f.key] = v;
      }
      if (onSave(vals) === false) return;
    } else extra[+x][1]();
    $('#formModal').classList.add('hidden');
  };
  $('#formModal').classList.remove('hidden');
}
$('#closeForm').onclick = () => $('#formModal').classList.add('hidden');
$('#formModal').onclick = e => { if (e.target.id === 'formModal') $('#formModal').classList.add('hidden'); };

// =====================================================================
// Alarm harga
// =====================================================================
const COND = { cross: 'Melintasi', up: 'Melintasi ke atas', down: 'Melintasi ke bawah', above: 'Di atas', below: 'Di bawah' };
let alerts = JSON.parse(localStorage.getItem('ac:alerts') || '[]');
const lastSeen = new Map();
function saveAlerts() { localStorage.setItem('ac:alerts', JSON.stringify(alerts)); syncAlerts(); if (!$('#alertModal').classList.contains('hidden')) renderAlerts(); }
function syncAlerts() {
  for (const p of panes) { p.chart.alerts = alerts.filter(a => a.symbol === p.cfg.symbol && a.broker === p.cfg.broker); p.chart.invalidate(); }
}
function checkAlerts(symbol, broker, price) {
  if (price == null) return;
  const key = `${symbol}|${broker}`, prev = lastSeen.get(key);
  lastSeen.set(key, price);
  let changed = false;
  for (const a of alerts) {
    if (!a.active || a.symbol !== symbol || a.broker !== broker) continue;
    const hit = {
      cross: prev != null && ((prev < a.price && price >= a.price) || (prev > a.price && price <= a.price)),
      up: prev != null && prev < a.price && price >= a.price,
      down: prev != null && prev > a.price && price <= a.price,
      above: price > a.price, below: price < a.price,
    }[a.cond];
    if (!hit) continue;
    a.active = false; a.triggeredAt = Date.now(); changed = true;
    const dg = symInfo(symbol)?.digits ?? 2;
    const msg = `${symbol} (${BROKERS[broker]}) ${COND[a.cond].toLowerCase()} ${fmtP(a.price, dg)} — harga ${fmtP(price, dg)}${a.msg ? '. ' + a.msg : ''}`;
    toast('⏰ ' + msg, 8000);
    notify('⏰ Alarm LokiChart', msg);
  }
  if (changed) saveAlerts();
}
function openAlerts() { $('#alertModal').classList.remove('hidden'); renderAlerts(); askNotifyPermission(); }
$('#closeAlert').onclick = () => $('#alertModal').classList.add('hidden');
$('#alertModal').onclick = e => { if (e.target.id === 'alertModal') $('#alertModal').classList.add('hidden'); };
$('#newAlert').onclick = () => editAlert(null);
function renderAlerts() {
  $('#alertList').innerHTML = alerts.slice().reverse().map(a => {
    const dg = symInfo(a.symbol)?.digits ?? 2;
    return `<div class="ind-row" data-id="${a.id}"><div class="nm"><b>${a.symbol}</b> · ${BROKERS[a.broker]} <span class="tag ${a.active ? 'on' : ''}">${a.active ? 'Aktif' : a.triggeredAt ? 'Terpicu ' + new Date(a.triggeredAt).toLocaleString('id-ID') : 'Nonaktif'}</span>
      <small>${COND[a.cond]} ${fmtP(a.price, dg)}${a.msg ? ' — ' + esc(a.msg) : ''}</small></div>
      <button class="icon-btn" data-a="toggle" title="Aktif/nonaktif">${icon(a.active ? IC.pause : IC.play)}</button>
      <button class="icon-btn" data-a="edit" title="Ubah">${icon(IC.gear)}</button>
      <button class="icon-btn" data-a="del" title="Hapus">${icon(IC.trash)}</button></div>`;
  }).join('') || '<div class="empty">Belum ada alarm. Anda juga bisa menyeret garis alarm di chart untuk mengubah harganya.</div>';
}
$('#alertList').onclick = e => {
  const row = e.target.closest('[data-id]'), a = e.target.closest('[data-a]')?.dataset.a; if (!row || !a) return;
  const al = alerts.find(x => x.id === row.dataset.id);
  if (a === 'del') alerts.splice(alerts.indexOf(al), 1);
  if (a === 'toggle') { al.active = !al.active; if (al.active) al.triggeredAt = null; }
  if (a === 'edit') return editAlert(al);
  saveAlerts();
};
function editAlert(al) {
  const cfg = act().cfg, last = chart().candles.at(-1)?.c;
  const symOpts = [...new Set(SYMBOLS.map(s => `${s.symbol}|${s.broker}`))].map(k => { const [s, b] = k.split('|'); return [k, `${s} · ${BROKERS[b]}`]; });
  openForm(al ? 'Ubah alarm' : 'Buat alarm', [
    { key: 'sym', label: 'Simbol', type: 'select', options: symOpts, value: al ? `${al.symbol}|${al.broker}` : `${cfg.symbol}|${cfg.broker}` },
    { key: 'cond', label: 'Kondisi', type: 'select', options: Object.entries(COND), value: al?.cond || 'cross' },
    { key: 'price', label: 'Harga', type: 'number', value: al?.price ?? last ?? 0, step: 'any' },
    { key: 'msg', label: 'Pesan (opsional)', type: 'text', value: al?.msg || '' },
  ], v => {
    const [symbol, broker] = v.sym.split('|');
    if (al) Object.assign(al, { symbol, broker, cond: v.cond, price: v.price, msg: v.msg, active: true, triggeredAt: null });
    else alerts.push({ id: uid(), symbol, broker, cond: v.cond, price: v.price, msg: v.msg, active: true, created: Date.now() });
    saveAlerts(); askNotifyPermission(); toast('Alarm disimpan');
  }, al ? [['Hapus', () => { alerts.splice(alerts.indexOf(al), 1); saveAlerts(); }]] : []);
}
// pantau alarm untuk simbol yang tidak sedang dibuka
setInterval(async () => {
  const shown = new Set(panes.map(p => `${p.cfg.symbol}|${p.cfg.broker}`));
  const keys = [...new Set(alerts.filter(a => a.active).map(a => `${a.symbol}|${a.broker}`))].filter(k => !shown.has(k));
  for (const k of keys) {
    const [s, b] = k.split('|');
    try { const d = await ds.candles(b, s, '1m', 2); checkAlerts(s, b, d.candles.at(-1)?.c); } catch { /* */ }
  }
}, 10000);

// =====================================================================
// Replay bar
// =====================================================================
let replayTimer = null, replaySpeed = 1;
function replayToggle() {
  const c = chart();
  if (c.replay) { stopReplay(); return; }
  c.setTool('replay'); renderRail();
  toast('Replay: ketuk bar tempat replay dimulai', 3000);
  renderReplayBar(true);
}
function stopReplay() { clearInterval(replayTimer); replayTimer = null; chart().stopReplay(); if (chart().tool === 'replay') chart().setTool(null); renderReplayBar(); }
function renderReplayBar(selecting) {
  const c = chart(), bar = $('#replayBar');
  if (!c.replay && !selecting && c.tool !== 'replay') { bar.classList.add('hidden'); clearInterval(replayTimer); replayTimer = null; return; }
  bar.classList.remove('hidden');
  if (!c.replay) { bar.innerHTML = `<span class="lbl">Pilih titik awal replay di chart</span><button class="icon-btn" data-r="exit" title="Batal">${icon(IC.close)}</button>`; return; }
  const left = c.replay.full.length - 1 - c.replay.idx;
  bar.innerHTML = `<button class="icon-btn" data-r="pick" title="Pilih titik awal">${icon(IC.start)}</button>
    <button class="icon-btn" data-r="play" title="${replayTimer ? 'Jeda' : 'Putar'}">${icon(replayTimer ? IC.pause : IC.play)}</button>
    <button class="icon-btn" data-r="step" title="Maju 1 bar">${icon(IC.step)}</button>
    <select data-r="speed">${[1, 2, 5, 10, 25].map(s => `<option value="${s}" ${s === replaySpeed ? 'selected' : ''}>${s}x</option>`).join('')}</select>
    <span class="lbl">${left} bar tersisa</span>
    <button class="icon-btn" data-r="exit" title="Keluar replay">${icon(IC.close)}</button>`;
}
$('#replayBar').onclick = e => {
  const r = e.target.closest('[data-r]')?.dataset.r; if (!r || r === 'speed') return;
  const c = chart();
  if (r === 'exit') return stopReplay();
  if (r === 'pick') { clearInterval(replayTimer); replayTimer = null; c.setTool('replay'); toast('Ketuk bar tempat replay dimulai'); return renderReplayBar(); }
  if (r === 'step') { c.replayStep(1); return renderReplayBar(); }
  if (r === 'play') {
    if (replayTimer) { clearInterval(replayTimer); replayTimer = null; }
    else replayTimer = setInterval(() => { if (!chart().replayStep(1)) { clearInterval(replayTimer); replayTimer = null; toast('Replay mencapai bar terakhir'); } renderReplayBar(); }, 1000 / replaySpeed);
    renderReplayBar();
  }
};
$('#replayBar').onchange = e => {
  if (e.target.dataset.r !== 'speed') return;
  replaySpeed = +e.target.value;
  if (replayTimer) { clearInterval(replayTimer); replayTimer = null; $('#replayBar [data-r=play]').click(); }
};

// =====================================================================
// Keyboard
// =====================================================================
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) return;
  const c = chart();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? c.redo() : c.undo(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); c.redo(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && c.selected) c.removeDrawing(c.selected);
  else if (e.key === 'Escape') { selectTool(null); c.pending = null; c.selected = null; onSelect(null); c.invalidate(); }
  else if (e.altKey && e.key.toLowerCase() === 't') selectTool('trendline');
  else if (e.altKey && e.key.toLowerCase() === 'h') selectTool('hline');
  else if (e.altKey && e.key.toLowerCase() === 'f') selectTool('fibret');
  else if (e.altKey && e.key.toLowerCase() === 'a') editAlert(null);
  else if (c.replay && e.key === 'ArrowRight') { c.replayStep(1); renderReplayBar(); }
  else if (/^[a-z]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && $('#searchModal').classList.contains('hidden')) {
    openSearch(); $('#symSearch').value = e.key.toUpperCase(); renderSymList(); e.preventDefault();
  }
});

// =====================================================================
// Daftar pantau & ikhtisar
// =====================================================================
const overview = new Overview($('#overview'), { fmt: fmtP, iconHtml: s => symIconHtml(s), brokers: BROKERS });
const quotes = {};
async function refreshQuotes() {
  await Promise.all(state.watchlist.map(async ([s, b]) => {
    try {
      const d = await ds.candles(b, s, '1D', 2);
      const [p, c] = d.candles.length > 1 ? d.candles.slice(-2) : [d.candles[0], d.candles[0]];
      quotes[`${s}|${b}`] = { last: c.c, prev: p.c, digits: d.digits };
      checkAlerts(s, b, c.c);
    } catch { /* abaikan */ }
  }));
  renderWatchlist();
}
function renderWatchlist() {
  const cfg = act()?.cfg;
  $('#wlList').innerHTML = state.watchlist.map(([s, b]) => {
    const q = quotes[`${s}|${b}`];
    const ch = q ? ((q.last - q.prev) / q.prev) * 100 : null;
    const cls = ch == null ? '' : ch >= 0 ? 'up' : 'down';
    return `<div class="wl-row ${cfg && s === cfg.symbol && b === cfg.broker ? 'on' : ''}" data-s="${s}" data-b="${b}">
      <div class="s">${symIconHtml(s)}<div><b>${s}</b><small>${BROKERS[b]}</small></div></div>
      <span class="n">${q ? fmtP(q.last, q.digits) : '—'}</span>
      <span class="n ${cls}">${ch == null ? '' : (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%'}</span></div>`;
  }).join('');
}
$('#wlList').onclick = e => { const r = e.target.closest('.wl-row'); if (r) { setSymbol(r.dataset.s, r.dataset.b); if (innerWidth < 820) $('#wlBtn').click(); } };
$('#wlList').oncontextmenu = e => {
  const r = e.target.closest('.wl-row'); if (!r) return;
  e.preventDefault();
  if (confirm(`Hapus ${r.dataset.s} (${BROKERS[r.dataset.b]}) dari daftar pantau?`)) {
    state.watchlist = state.watchlist.filter(([s, b]) => !(s === r.dataset.s && b === r.dataset.b)); save(); renderWatchlist();
  }
};

// =====================================================================
// Pencarian simbol
// =====================================================================
const SYM_TABS = [['all', 'Seluruh'], ['forex', 'Forex'], ['commodity', 'Komoditas'], ['crypto', 'Kripto'], ['index', 'Indeks'], ['oanda', 'OANDA'], ['forexcom', 'FOREX.com']];
let symTab = 'all';
function openSearch() { $('#searchModal').classList.remove('hidden'); $('#symSearch').value = ''; renderSymList(); setTimeout(() => $('#symSearch').focus(), 50); }
function renderSymList() {
  $('#symTabs').innerHTML = SYM_TABS.map(([k, n]) => `<button data-k="${k}" class="${symTab === k ? 'on' : ''}">${n}</button>`).join('');
  const q = $('#symSearch').value.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '');
  const list = SYMBOLS.filter(s => {
    if (symTab === 'oanda' || symTab === 'forexcom') { if (s.broker !== symTab) return false; }
    else if (symTab !== 'all' && !s.type.includes(symTab)) return false;
    return !q || s.symbol.includes(q) || s.desc.toUpperCase().includes(q);
  });
  $('#symList').innerHTML = list.map(s => {
    const inWl = state.watchlist.some(([a, b]) => a === s.symbol && b === s.broker);
    return `<div class="sym-row" data-s="${s.symbol}" data-b="${s.broker}">
      ${symIconHtml(s.symbol)}<div><b>${s.symbol}</b><small>${s.desc}</small></div>
      <div class="r"><b>${BROKERS[s.broker]}</b><br><small>${s.type}</small></div>
      <button class="add" data-add="1" title="${inWl ? 'Hapus dari' : 'Tambah ke'} daftar pantau">${inWl ? '✓' : '+'}</button></div>`;
  }).join('') || '<div class="empty">Simbol tidak ditemukan</div>';
}
$('#symSearch').oninput = renderSymList;
$('#symTabs').onclick = e => { if (e.target.dataset.k) { symTab = e.target.dataset.k; renderSymList(); } };
$('#symList').onclick = e => {
  const r = e.target.closest('.sym-row'); if (!r) return;
  const { s, b } = r.dataset;
  if (e.target.closest('[data-add]')) {
    const has = state.watchlist.some(([x, y]) => x === s && y === b);
    state.watchlist = has ? state.watchlist.filter(([x, y]) => !(x === s && y === b)) : [...state.watchlist, [s, b]];
    save(); renderSymList(); refreshQuotes(); return;
  }
  $('#searchModal').classList.add('hidden');
  setSymbol(s, b);
};
$('#symbolBtn').onclick = openSearch;
$('#wlAdd').onclick = openSearch;
$('#closeSearch').onclick = () => $('#searchModal').classList.add('hidden');
$('#searchModal').onclick = e => { if (e.target.id === 'searchModal') $('#searchModal').classList.add('hidden'); };

// =====================================================================
// Pengaturan broker
// =====================================================================
const F = ['oandaKey', 'oandaEnv', 'fxUser', 'fxPass', 'fxKey', 'fxUrl', 'fxIds'];
function openSettings() {
  const c = loadCreds(), server = ds.mode === 'server';
  const v = {
    oandaKey: c.oanda?.apiKey || '', oandaEnv: c.oanda?.env || 'practice',
    fxUser: c.forexcom?.username || '', fxPass: c.forexcom?.password || '', fxKey: c.forexcom?.appKey || '',
    fxUrl: c.forexcom?.baseUrl || '', fxIds: c.forexcom?.marketIds || '',
  };
  for (const k of F) { $('#' + k).value = v[k]; $('#' + k).disabled = server; }
  $('#setNote').innerHTML = server
    ? 'Versi web ini memakai server: kredensial diatur di file <code>.env</code> server, bukan di sini.'
    : 'Kredensial hanya disimpan di perangkat ini dan dikirim langsung ke server broker. Kosongkan untuk memakai data demo.';
  $('#saveSet').classList.toggle('hidden', server);
  $('#setStatus').textContent = '';
  $('#settingsModal').classList.remove('hidden');
}
$('#setBtn').onclick = openSettings;
$('#srcBadge').onclick = openSettings;
$('#closeSet').onclick = () => $('#settingsModal').classList.add('hidden');
$('#settingsModal').onclick = e => { if (e.target.id === 'settingsModal') $('#settingsModal').classList.add('hidden'); };
$('#saveSet').onclick = async () => {
  const g = k => $('#' + k).value.trim();
  saveCreds({
    oanda: { apiKey: g('oandaKey'), env: g('oandaEnv') },
    forexcom: { username: g('fxUser'), password: $('#fxPass').value, appKey: g('fxKey'), baseUrl: g('fxUrl'), marketIds: g('fxIds') },
  });
  $('#setStatus').textContent = 'Menguji koneksi…';
  const out = [];
  for (const b of ['oanda', 'forexcom']) {
    const st = (await ds.status())[b];
    if (st !== 'live') { out.push(`${BROKERS[b]}: demo (belum diisi)`); continue; }
    try { await ds.candles(b, 'EURUSD', '1h', 2); out.push(`${BROKERS[b]}: ✓ terhubung`); }
    catch (e) { out.push(`${BROKERS[b]}: ✗ ${e.message}`); }
  }
  $('#setStatus').textContent = out.join('\n');
  panes.forEach(p => p.load()); refreshQuotes();
};

// =====================================================================
// Mulai
// =====================================================================
(async function init() {
  document.body.classList.toggle('dark', state.theme === 'dark');
  await ds.init();
  try { SYMBOLS = await ds.symbols(); } catch { toast('Gagal memuat daftar simbol'); }
  state.panes.forEach(p => { if (!symInfo(p.symbol, p.broker)) { p.symbol = 'XAUUSD'; p.broker = 'oanda'; } p.studies ||= defStudies(); });
  if (window.innerWidth > 1100) { $('#watchlist').classList.remove('hidden'); $('#wlBtn').classList.add('on'); }
  buildPanes();
  setTheme(state.theme);
  renderToolTabs(); renderToolGrid(); renderRail(); renderHeader();
  if (!state.recent.length) { const c = act().cfg; state.recent = [{ symbol: c.symbol, broker: c.broker, tf: c.tf }]; renderRecent(); }
  refreshQuotes();
  setInterval(refreshQuotes, 15000);
  window.lc = { panes, chart, state }; // untuk debugging dari konsol
})();
