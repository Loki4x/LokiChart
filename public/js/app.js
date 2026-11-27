import { Chart, THEMES, DEFAULT_CS } from './chart.js';
import { TOOLS, CATEGORIES, UTILITIES } from './tools.js';
import { INDICATORS, defaultParams, indicatorLabel, technicalRating } from './indicators.js';
import { ds, isNative, loadCreds, saveCreds } from './datasource.js';
import { notify, askNotifyPermission, shareImage } from './native.js';
import { Overview, drawGauge } from './overview.js';
import { Explore, MenuPage } from './pages.js';
import { initDrawUI } from './drawui.js';
import { initSettings } from './settings.js';
import { initStudyUI } from './studyui.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => Math.random().toString(36).slice(2, 10);
const icon = d => `<svg class="i" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const BROKERS = { oanda: 'OANDA', forexcom: 'FOREX.com' };
const TFS = [['1m', '1 menit'], ['3m', '3 menit'], ['5m', '5 menit'], ['15m', '15 menit'], ['30m', '30 menit'], ['1h', '1 jam'], ['2h', '2 jam'], ['4h', '4 jam'], ['1D', '1 hari'], ['1W', '1 minggu']];
const TF_SHORT = { '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1j', '2h': '2j', '4h': '4j', '1D': '1H', '1W': '1M' };
const TF_MS = { '1m': 60e3, '3m': 180e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3, '1h': 3600e3, '2h': 7200e3, '4h': 14400e3, '1D': 86400e3, '1W': 604800e3 };
const TYPES = [['candles', 'Candle'], ['hollow', 'Candle kosong'], ['heikin', 'Heikin Ashi'], ['bars', 'Bar'], ['line', 'Garis'], ['area', 'Area']];
const IC = {
  cursor: 'M5 3L19 12L12 13.5L9 20Z', undo: 'M9 14L4 9L9 4 M4 9H15a5 5 0 0 1 0 10H11', redo: 'M15 14L20 9L15 4 M20 9H9a5 5 0 0 0 0 10H13',
  share: 'M12 15V3 M8 7L12 3L16 7 M5 12V20H19V12', full: 'M4 9V4H9 M15 4H20V9 M20 15V20H15 M9 20H4V15',
  close: 'M6 6L18 18 M18 6L6 18', back: 'M15 5L8 12L15 19', search: 'M10 10m-6.5 0a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0 M20 20L15 15',
  all: 'M4 4h6v6h-6z M14 4h6v6h-6z M4 14h6v6h-6z M14 14h6v6h-6z', trash: 'M4 6H20 M9 6V3H15V6 M6 6L7 21H17L18 6',
  lock: 'M6 11H18V21H6Z M8 11V7a4 4 0 0 1 8 0', unlock: 'M6 11H18V21H6Z M8 11V7a4 4 0 0 1 7.5 -2',
  gear: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M12 2V5 M12 19V22 M2 12H5 M19 12H22 M4.9 4.9L7 7 M17 17L19.1 19.1 M4.9 19.1L7 17 M17 7L19.1 4.9',
  pen: 'M4 20L4.5 16.5L16 5L19 8L7.5 19.5Z M14 7L17 10', ind: 'M3 17L9 11L13 15L21 7 M15 7H21V13',
  layout: 'M4 4H20V20H4Z M12 4V20 M4 12H20', bell: 'M12 13m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M12 9V13L14 15 M5 3L2 6 M19 3L22 6',
  candle: 'M8 3V7 M8 17V21 M6 7H10V17H6Z M16 6V9 M16 15V18 M14 9H18V15H14Z', replay: 'M11 18L3 12L11 6Z M21 18L13 12L21 6Z',
  layers: 'M12 3L22 8L12 13L2 8Z M2 12L12 17L22 12 M2 16L12 21L22 16', more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  eye: 'M2 12C5 6 9 4 12 4S19 6 22 12C19 18 15 20 12 20S5 18 2 12Z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  eyeoff: 'M3 3L21 21 M10.6 10.6a3 3 0 0 0 4.2 4.2 M9.9 5.1A9.7 9.7 0 0 1 12 5c4 0 7.5 2.5 10 7a17 17 0 0 1 -3 4 M6.6 6.6C4.6 8 3.2 9.8 2 12c2.5 4.5 6 7 10 7c1.6 0 3.1 -.4 4.4 -1.1',
  play: 'M7 4L20 12L7 20Z', pause: 'M7 4V20 M17 4V20', step: 'M5 4L15 12L5 20Z M19 4V20', start: 'M12 3V21 M4 12H10',
  star: 'M12 3L14.8 8.8L21 9.6L16.5 14L17.6 20.2L12 17.2L6.4 20.2L7.5 14L3 9.6L9.2 8.8Z', tpl: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M17.5 14v7 M14 17.5h7',
  chart: 'M3 20V4 M3 20H21 M7 16L11 11L14 14L20 7', list: 'M8 6H20 M8 12H20 M8 18H20 M4 6h.01 M4 12h.01 M4 18h.01',
  compass: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M15.5 8.5L13.5 13.5L8.5 15.5L10.5 10.5Z', menu: 'M4 6H20 M4 12H20 M4 18H20',
  save: 'M12 3V15 M7 10L12 15L17 10 M5 19H19', open: 'M3 7H10L12 9H21V19H3Z', plus: 'M12 5V19 M5 12H19', info: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M12 11V16 M12 8h.01',
  gauge: 'M4 16a8 8 0 0 1 16 0 M12 16L16 10', help: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0 M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14 M12 17h.01',
  alarmBig: 'M12 13m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M12 9V13L14 15 M5 3L2 6 M19 3L22 6 M18 18h5 M20.5 15.5v5',
};

// ---------- State ----------
const saved = JSON.parse(localStorage.getItem('ac:state') || '{}');
const defStudies = () => [{ id: uid(), type: 'volume', params: defaultParams('volume') }];
const state = {
  layout: '1', active: 0, theme: 'light', page: 'chart',
  panes: [{ symbol: 'XAUUSD', broker: 'oanda', tf: '5m', chartType: 'candles', studies: defStudies() }],
  favorites: ['trendline', 'vline', 'fibret', 'fibcircles', 'gannbox', 'gannfan'],
  watchlist: [['XAUUSD', 'oanda'], ['XAUUSD', 'forexcom'], ['BTCUSD', 'oanda'], ['NAS100', 'forexcom'], ['GBPJPY', 'oanda'], ['AUDUSD', 'oanda'], ['EURUSD', 'oanda'], ['USDJPY', 'forexcom'], ['US30', 'oanda'], ['USDIDR', 'forexcom']],
  magnet: 'off', panelTab: 'tren', styleDefaults: {}, extraDefaults: {}, templates: {}, recent: [],
  sync: { symbol: false, interval: false, crosshair: true, time: false }, cs: {}, indFav: [], indTemplates: [], layouts: [], rail: false, keepAwake: false,
  ...saved,
};
if (state.layout === '3') state.layout = '3l';
if (saved.symbol) { state.panes[0] = { ...state.panes[0], symbol: saved.symbol, broker: saved.broker || 'oanda', tf: saved.tf || '5m' }; }
['symbol', 'broker', 'tf', 'chartType', 'indicators', 'ovOpen'].forEach(k => delete state[k]);
const save = () => localStorage.setItem('ac:state', JSON.stringify(state));
let SYMBOLS = [];
const symInfo = (s, b) => SYMBOLS.find(x => x.symbol === s && (!b || x.broker === b));
const LAYOUTS = { 1: ['1'], 2: ['2h', '2v'], 3: ['3c', '3r', '3l', '3t'], 4: ['4', '4c', '4r', '4l'], 6: ['6', '6v'], 8: ['8'] };
const LAYOUT_N = Object.fromEntries(Object.entries(LAYOUTS).flatMap(([n, ls]) => ls.map(l => [l, +n])));

function toast(msg, ms = 2200) {
  const el = $('#toast'); el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add('hidden'), ms);
}
const fmtP = (v, dg) => v == null || !isFinite(v) ? '—' : Number(v).toLocaleString('id-ID', { minimumFractionDigits: dg, maximumFractionDigits: dg });
function symIconHtml(s) {
  const info = symInfo(s) || { icon: 'fx' };
  const map = { gold: ['#d4a017', 'Au'], silver: ['#9e9e9e', 'Ag'], btc: ['#f7931a', '₿'], eth: ['#627eea', 'Ξ'], index: ['#2962ff', '▲'], oil: ['#37474f', '◆'], usd: ['#1b5e20', '$'] };
  const [bg, ch] = map[info.icon] || ['#3f51b5', ({ EUR: '€', GBP: '£', USD: '$', AUD: 'A$', NZD: 'N$', JPY: '¥', CAD: 'C$', CHF: '₣' })[s.slice(0, 3)] || s[0]];
  return `<span class="sym-icon" style="background:${bg}">${ch}</span>`;
}

// =====================================================================
// Halaman
// =====================================================================
const TAB_ICONS = { watch: IC.list, chart: IC.chart, explore: IC.compass, menu: IC.menu };
document.querySelectorAll('#tabbar button').forEach(b => { b.querySelector('span').innerHTML = icon(TAB_ICONS[b.dataset.page]); });
$('#tabbar').onclick = e => { const b = e.target.closest('[data-page]'); if (b) showPage(b.dataset.page); };
function showPage(p) {
  state.page = p; save();
  document.querySelectorAll('.page').forEach(x => x.classList.toggle('on', x.id === 'pg-' + p));
  document.querySelectorAll('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.page === p));
  if (p === 'chart') requestAnimationFrame(() => panes.forEach(x => x.chart.resize()));
  if (p === 'watch') { renderWatchlist(); showOverview(); }
  if (p === 'explore') explore.show($('#exBroker').value);
  if (p === 'menu') menuPage.render();
}

// =====================================================================
// Pane chart
// =====================================================================
const G = { stay: false, hidden: false, lockAll: false, hideStudies: false };
let panes = [];
const act = () => panes[state.active] || panes[0];
const chart = () => act().chart;

class Pane {
  constructor(idx) {
    this.idx = idx;
    this.el = document.createElement('div'); this.el.className = 'pane';
    this.el.innerHTML = `<div class="chart"></div><div class="legend"></div><button class="go-latest hidden" title="Ke bar terbaru">»</button>`;
    $('#charts').appendChild(this.el);
    this.legend = this.el.querySelector('.legend');
    this.chart = new Chart(this.el.querySelector('.chart'));
    const c = this.chart;
    applyChartLook(c);
    Object.assign(c, { magnet: state.magnet, styleDefaults: state.styleDefaults, extraDefaults: state.extraDefaults, stay: G.stay, hidden: G.hidden, lockAll: G.lockAll, hideStudies: G.hideStudies, angleSnap: !!state.angleSnap, legendCollapsed: !!state.legendCollapsed });
    this.el.addEventListener('pointerdown', () => setActive(this.idx), true);
    this.el.querySelector('.go-latest').onclick = () => c.goLatest();
    this.legend.addEventListener('click', e => { if (e.target.closest('.t')) openChartSettings(); });
    c.on('crosshair', info => {
      this.hover = info; this.updateLegend();
      if (state.sync.crosshair) for (const p of panes) if (p !== this) { p.chart.extCross = info ? info.t : null; p.chart.invalidate(); }
    });
    c.canvas.addEventListener('pointerleave', () => { this.hover = null; this.updateLegend(); for (const p of panes) if (p !== this) { p.chart.extCross = null; p.chart.invalidate(); } });
    c.on('view', () => {
      if (!state.sync.time || this.idx !== state.active) return;
      const t = c.iToT(c.scroll);
      for (const p of panes) if (p !== this && p.chart.candles.length) { p.chart.scroll = p.chart.tToI(t); p.chart.spacing = c.spacing; p.chart.invalidate(); }
    });
    c.on('select', d => { if (this.idx === state.active) onSelect(d); });
    c.on('tool', () => { renderRail(); renderToolGrid(); renderReplayBar(); renderDrawMode(); });
    c.on('toolset', () => { if (this.idx === state.active) { renderRail(); renderToolGrid(); renderDrawMode(); } });
    c.on('drawings', list => {
      localStorage.setItem(`ac:drawings:${this.cfg.symbol}`, JSON.stringify(list.filter(d => !TOOLS[d.tool].temp)));
      for (const p of panes) if (p !== this && p.cfg.symbol === this.cfg.symbol) p.chart.setDrawings(JSON.parse(JSON.stringify(list)));
      if (!$('#treePanel').classList.contains('hidden')) renderTree();
    });
    c.on('study', ({ id, rect }) => { setActive(this.idx); studyUI.show(this, id, rect); });
    c.on('legendcollapse', v => { state.legendCollapsed = v; save(); for (const p of panes) { p.chart.legendCollapsed = v; p.chart.invalidate(); } });
    c.on('dbltap', () => { setActive(this.idx); openChartSettings(); });
    c.on('dbldraw', d => { setActive(this.idx); c.selected = d; onSelect(d); c.invalidate(); drawUI.openSettings(d); });
    c.on('drawstep', st => { if (this.idx === state.active) renderStep(st); });
    c.on('alertmove', al => { const a = alerts.find(x => x.id === al.id); if (a) { a.price = al.price; a.active = true; saveAlerts(); toast(`Peringatan dipindah ke ${c.fmt(al.price)}`); } });
    c.on('alertclick', al => editAlert(alerts.find(x => x.id === al.id)));
    c.on('replay', () => { if (this.idx === state.active) renderReplayBar(); });
  }
  get cfg() { return state.panes[this.idx]; }
  destroy() { clearInterval(this.timer); this.el.remove(); }
  async load() {
    const seq = this.seq = (this.seq || 0) + 1;
    clearInterval(this.timer);
    const c = this.chart, cfg = this.cfg;
    if (c.replay) c.stopReplay();
    c.chartType = cfg.chartType; c.studies = cfg.studies; c.loadingText = null;
    c.setData([], {});
    c.setDrawings(JSON.parse(localStorage.getItem(`ac:drawings:${cfg.symbol}`) || '[]'));
    syncAlerts(); this.updateLegend();
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
      this.el.querySelector('.go-latest').classList.toggle('hidden', this.chart.scroll >= this.chart.candles.length - 3);
    } catch { /* abaikan kegagalan sementara */ }
  }
  updateLegend() {
    const cfg = this.cfg, info = symInfo(cfg.symbol, cfg.broker), cs = state.cs;
    this.chart.watermarkText = `${cfg.symbol}, ${TF_SHORT[cfg.tf]}`;
    const c = this.hover || this.chart.candles.at(-1);
    const prev = this.hover ? this.hover.prev : this.chart.candles.at(-2);
    const name = `<span class="t" title="Pengaturan simbol">${cs.legendTitle === 'symbol' ? cfg.symbol : info?.desc || cfg.symbol} · ${TF_SHORT[cfg.tf]} · ${BROKERS[cfg.broker]}</span>`;
    if (!c) this.legend.innerHTML = name;
    else {
      const cls = c.c >= c.o ? 'up' : 'down', f = v => this.chart.fmt(v);
      const ch = prev ? c.c - prev.c : 0, chp = prev ? (ch / prev.c) * 100 : 0;
      this.legend.innerHTML = name + (cs.legend !== false ? `
        <span>O<span class="v ${cls}"> ${f(c.o)}</span></span><span>H<span class="v ${cls}"> ${f(c.h)}</span></span>
        <span>L<span class="v ${cls}"> ${f(c.l)}</span></span><span>C<span class="v ${cls}"> ${f(c.c)}</span></span>` : '') +
        (cs.legendChange !== false ? `<span class="v ${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '+' : ''}${f(ch)} (${ch >= 0 ? '+' : ''}${chp.toFixed(2)}%)</span>` : '') +
        (cs.legendVolume ? `<span>Vol <span class="v">${Math.round(c.v || 0).toLocaleString('id-ID')}</span></span>` : '');
    }
    const top = this.legend.offsetTop + this.legend.offsetHeight + 10;
    if (top !== this.chart.legendTop) { this.chart.legendTop = top; this.chart.invalidate(); }
  }
}
function applyChartLook(c) { c.theme = THEMES[state.theme]; c.cs = { ...DEFAULT_CS, ...state.cs }; c.invalidate(); }

function buildPanes() {
  const n = LAYOUT_N[state.layout] || 1;
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
  prev.chart.setTool(null); prev.chart.selected = null; prev.chart.invalidate(); onSelect(null);
  state.active = k; save();
  panes.forEach((p, i) => p.el.classList.toggle('active', i === k));
  renderHeader(); renderRail(); renderToolGrid(); renderReplayBar(); renderDrawMode();
  setSource(act().source || 'demo');
  if (!$('#treePanel').classList.contains('hidden')) renderTree();
}
function remember(cfg) {
  state.recent = [{ symbol: cfg.symbol, broker: cfg.broker, tf: cfg.tf }, ...state.recent.filter(r => !(r.symbol === cfg.symbol && r.broker === cfg.broker))].slice(0, 12);
}
function loadActive() { remember(act().cfg); save(); renderHeader(); act().load(); }
function setSymbol(symbol, broker, tf) {
  const targets = state.sync.symbol ? panes : [act()];
  for (const p of targets) { p.cfg.symbol = symbol; p.cfg.broker = broker; if (tf && p === act()) p.cfg.tf = tf; if (p !== act()) p.load(); }
  loadActive();
}
function setTf(tf) {
  const targets = state.sync.interval ? panes : [act()];
  for (const p of targets) { p.cfg.tf = tf; if (p !== act()) p.load(); }
  loadActive();
}

// ---------- Header (toolbar bawah kiri) ----------
function setSource(src) {
  const b = $('#srcBadge');
  b.className = 'src-badge ' + src;
  b.textContent = src === 'live' ? '● LIVE' : 'DATA DEMO';
  b.title = src === 'live' ? 'Data langsung dari broker' : 'Akun broker belum diisi — data sintetis, bukan harga asli. Ketuk untuk mengisi.';
}
$('#srcBadge').onclick = () => openBroker();
function renderHeader() {
  const cfg = act().cfg;
  $('#symName').textContent = cfg.symbol;
  $('#tfBtn').textContent = TF_SHORT[cfg.tf];
  document.title = `${cfg.symbol} · ${BROKERS[cfg.broker]} — LokiChart`;
  renderWatchlist();
}
$('#symbolBtn').onclick = openSearch;
$('#tfBtn').onclick = e => popMenu(e.currentTarget, '<div class="mh">Interval</div>' + TFS.map(([v, n]) => `<button class="mi ${act().cfg.tf === v ? 'on' : ''}" data-v="${v}">${n}</button>`).join(''), setTf);

function setTheme(t) {
  state.theme = t; save();
  document.body.classList.toggle('dark', t === 'dark');
  for (const p of panes) applyChartLook(p.chart);
  document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#131722' : '#ffffff';
}

// ---------- Toolbar bawah ----------
const BB_ICONS = { draw: IC.pen, ind: IC.ind, layout: IC.layout, alert: IC.bell, type: IC.candle, replay: IC.replay, tree: IC.layers, more: IC.more, undo: IC.undo, redo: IC.redo, full: IC.full, share: IC.share };
document.querySelectorAll('[data-bb]').forEach(b => { b.innerHTML = icon(BB_ICONS[b.dataset.bb]); });
$('#bottombar').onclick = e => {
  const b = e.target.closest('[data-bb]'); if (!b) return;
  switch (b.dataset.bb) {
    case 'draw': togglePanel('drawPanel'); break;
    case 'ind': openIndicators(); break;
    case 'layout': togglePanel('layoutPanel'); renderLayoutPanel(); break;
    case 'alert': togglePanel('alertPanel'); renderAlerts(); askNotifyPermission(); break;
    case 'type': popMenu(b, '<div class="mh">Jenis chart</div>' + TYPES.map(([v, n]) => `<button class="mi ${act().cfg.chartType === v ? 'on' : ''}" data-v="${v}">${n}</button>`).join('') + '<button class="mi" data-v="settings">Pengaturan chart…</button>', v => {
      if (v === 'settings') return openChartSettings();
      act().cfg.chartType = chart().chartType = v; save(); chart().invalidate();
    }); break;
    case 'replay': replayToggle(); break;
    case 'tree': togglePanel('treePanel'); renderTree(); break;
    case 'more': togglePanel('hubPanel'); renderHub(); break;
    case 'undo': chart().undo(); break;
    case 'redo': chart().redo(); break;
    case 'full': toggleFull(); break;
    case 'share': doShare(); break;
  }
};
const PANELS = ['drawPanel', 'layoutPanel', 'treePanel', 'alertPanel', 'hubPanel'];
function togglePanel(id, force) {
  const el = $('#' + id), open = force ?? el.classList.contains('hidden');
  for (const p of PANELS) {
    const left = ['drawPanel', 'layoutPanel'].includes(p) === ['drawPanel', 'layoutPanel'].includes(id);
    if (p !== id && left) $('#' + p).classList.add('hidden');
  }
  el.classList.toggle('hidden', !open);
  renderRail();
}
for (const [btn, pnl] of [['closeDraw', 'drawPanel'], ['closeLayout', 'layoutPanel'], ['closeTree', 'treePanel'], ['closeAlert', 'alertPanel'], ['closeHub', 'hubPanel']]) {
  $('#' + btn).innerHTML = icon(IC.close); $('#' + btn).onclick = () => togglePanel(pnl, false);
}
for (const id of ['closeInd', 'closeForm', 'closeSet']) $('#' + id).innerHTML = icon(IC.close);
$('#closeSearch').innerHTML = icon(IC.back);
document.querySelectorAll('.search-ico').forEach(e => { e.innerHTML = icon(IC.search); });
$('#wlSearch').innerHTML = icon(IC.search);

function toggleFull() {
  const on = !document.body.classList.contains('focus');
  document.body.classList.toggle('focus', on);
  try { on ? document.documentElement.requestFullscreen?.() : document.fullscreenElement && document.exitFullscreen(); } catch { /* */ }
  setTimeout(() => panes.forEach(p => p.chart.resize()), 120);
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
  const x = Math.min(r.left, innerWidth - mw - 8);
  let y = r.bottom + 4; if (y + mh > innerHeight - 8) y = Math.max(8, r.top - mh - 4);
  m.style.left = Math.max(8, x) + 'px'; m.style.top = y + 'px';
  m.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; if (!b.dataset.keep) m.classList.add('hidden'); onClick(b.dataset.v, b); };
}
document.addEventListener('pointerdown', e => { if (!e.target.closest('#popMenu') && !e.target.closest('.more') && !e.target.closest('[data-bb]') && !e.target.closest('#tfBtn') && !e.target.closest('#syncBtn') && !e.target.closest('#wlTitle')) $('#popMenu').classList.add('hidden'); });

// =====================================================================
// Rail opsional & panel alat gambar
// =====================================================================
const QUICK = ['trendline', 'hline', 'parallel', 'fibret', 'xabcd', 'longpos', 'rect', 'brush', 'text'];
const UT = id => UTILITIES.find(u => u.id === id).icon;
function applyRail() { $('#rail').classList.toggle('hidden', !state.rail); requestAnimationFrame(() => panes.forEach(p => p.chart.resize())); renderRail(); }
function renderRail() {
  const c = chart(); if (!c || !state.rail) return;
  $('#rail').innerHTML = `
    <button class="icon-btn ${!c.tool ? 'on' : ''}" data-act="cursor" title="Kursor">${icon(IC.cursor)}</button>
    ${QUICK.map(id => `<button class="icon-btn ${c.tool === id ? 'on' : ''}" data-tool="${id}" title="${TOOLS[id].name}">${icon(TOOLS[id].icon)}</button>`).join('')}
    <button class="icon-btn ${!$('#drawPanel').classList.contains('hidden') ? 'on' : ''}" data-act="panel" title="Semua alat gambar">${icon(IC.all)}</button>
    <div class="sep"></div>
    <button class="icon-btn ${c.tool === 'measure' ? 'on' : ''}" data-act="measure" title="Pengukuran">${icon(TOOLS.measure.icon)}</button>
    <button class="icon-btn ${state.magnet !== 'off' ? 'on' : ''}" data-act="magnet" title="Magnet">${icon(UT('magnet'))}<span class="badge">${{ off: '', weak: 'L', strong: 'K' }[state.magnet]}</span></button>
    <button class="icon-btn ${state.angleSnap ? 'on' : ''}" data-act="angle" title="Penggaris sudut">${icon('M4 20H20L4 4Z M4 14a6 6 0 0 1 6 6')}</button>
    <button class="icon-btn ${G.hidden ? 'on' : ''}" data-act="hide" title="Sembunyikan gambar">${icon(UT('hide'))}</button>
    <button class="icon-btn" data-act="clear" title="Hapus gambar">${icon(IC.trash)}</button>`;
}
$('#rail').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tool) return selectTool(chart().tool === b.dataset.tool ? null : b.dataset.tool);
  runUtility(b.dataset.act);
};
function selectTool(id) {
  chart().setTool(id);
  renderRail(); renderToolGrid(); renderDrawMode();
  if (id && TOOLS[id] && !chart().tcur) {
    const t = TOOLS[id];
    toast(t.freehand ? `${t.name}: seret jari untuk menggambar` : t.n === Infinity ? `${t.name}: ketuk titik-titik, ketuk titik terakhir lagi untuk selesai` : `${t.name}: ketuk ${t.n} titik pada chart`, 2000);
  }
}
const allCharts = () => panes.map(p => p.chart);

// ---------- Mode menggambar: banner langkah & toolbar bawah khusus ----------
const MAG_IC = UTILITIES.find(u => u.id === 'magnet').icon;
const ANG_IC = 'M4 20H20L4 4Z M4 14a6 6 0 0 1 6 6';
function renderStep(st) {
  const b = $('#stepBanner');
  if (!st) { b.classList.add('hidden'); return; }
  b.querySelector('.sb-k').textContent = st.total ? `${st.k} dari ${st.total}` : `Titik ${Math.ceil(st.k / 2)}`;
  b.querySelector('.sb-t').textContent = st.text;
  b.classList.remove('hidden');
}
$('#stepCancel').innerHTML = icon(IC.trash);
$('#stepCancel').onclick = () => { selectTool(null); renderStep(null); };
function renderDrawMode() {
  const c = chart(), t = c?.tool && TOOLS[c.tool];
  $('#bottombar').classList.toggle('drawing', !!t);
  if (!t) { renderStep(null); return; }
  const q = k => document.querySelector(`[data-dm="${k}"]`);
  q('tool').innerHTML = icon(t.icon); q('tool').title = `${t.name} (ketuk untuk batal)`;
  q('magnet').innerHTML = icon(MAG_IC); q('magnet').classList.toggle('act', state.magnet !== 'off');
  q('stay').innerHTML = icon(UT('stay')); q('stay').classList.toggle('act', G.stay);
  q('angle').innerHTML = icon(ANG_IC); q('angle').classList.toggle('act', !!state.angleSnap);
  q('hide').innerHTML = icon(UT('hide')); q('hide').classList.toggle('act', G.hidden);
  q('tree').innerHTML = icon(IC.layers); q('full').innerHTML = icon(IC.full);
}
document.querySelector('.bb-draw').onclick = e => {
  const b = e.target.closest('[data-dm]'); if (!b) return;
  const k = b.dataset.dm;
  if (k === 'tool') { selectTool(null); return; }
  if (k === 'magnet') {
    const mi = (v, n) => `<button class="mi ${state.magnet === v ? 'on' : ''}" data-v="${v}">${icon(MAG_IC)} ${n}</button>`;
    return popMenu(b, mi('weak', 'Magnet Lemah') + mi('strong', 'Magnet Kuat') + mi('off', 'Magnet Mati'), v => { setMagnet(v); renderDrawMode(); });
  }
  if (k === 'stay') runUtility('stay');
  if (k === 'angle') runUtility('angle');
  if (k === 'hide') runUtility('hide');
  if (k === 'tree') { togglePanel('treePanel'); renderTree(); }
  if (k === 'full') toggleFull();
  renderDrawMode();
};
function setGlobal(key, val) { G[key] = val; for (const c of allCharts()) { c[key] = val; if (key === 'hidden') c.selected = null; c.invalidate(); } }
function runUtility(a) {
  const c = chart();
  switch (a) {
    case 'cursor': selectTool(null); break;
    case 'panel': togglePanel('drawPanel'); break;
    case 'measure': selectTool(c.tool === 'measure' ? null : 'measure'); break;
    case 'eraser': selectTool(c.tool === 'eraser' ? null : 'eraser'); break;
    case 'zoomin': selectTool(c.tool === 'zoomin' ? null : 'zoomin'); if (chart().tool) toast('Seret area pada chart untuk memperbesar'); break;
    case 'zoomout': c.zoomOut(); break;
    case 'angle': setAngleSnap(!state.angleSnap); break;
    case 'stay': setGlobal('stay', !G.stay); toast(G.stay ? 'Tetap menggambar: AKTIF' : 'Tetap menggambar: NONAKTIF'); break;
    case 'hide': setGlobal('hidden', !G.hidden); onSelect(null); break;
    case 'hidestudies': setGlobal('hideStudies', !G.hideStudies); break;
    case 'hideall': { const v = !(G.hidden && G.hideStudies); setGlobal('hidden', v); setGlobal('hideStudies', v); onSelect(null); break; }
    case 'lock': setGlobal('lockAll', !G.lockAll); toast(G.lockAll ? 'Semua gambar dikunci' : 'Kunci gambar dibuka'); break;
    case 'magnet': { const o = ['off', 'weak', 'strong']; setMagnet(o[(o.indexOf(state.magnet) + 1) % 3]); break; }
    case 'magnet-off': setMagnet('off'); break;
    case 'magnet-weak': setMagnet('weak'); break;
    case 'magnet-strong': setMagnet('strong'); break;
    case 'clear': if (c.drawings.length && confirm(`Hapus semua gambar (${c.drawings.length}) di ${act().cfg.symbol}?`)) c.clearDrawings(); break;
    case 'clearstudies': if (act().cfg.studies.length && confirm('Hapus semua indikator di chart ini?')) { act().cfg.studies.length = 0; save(); c.invalidate(); } break;
    case 'clearall': if (confirm('Hapus semua gambar dan indikator di chart ini?')) { c.clearDrawings(); act().cfg.studies.length = 0; save(); c.invalidate(); } break;
  }
  renderRail(); renderToolGrid(); renderDrawMode();
  if (!$('#treePanel').classList.contains('hidden')) renderTree();
}
// Penggaris sudut: saat diaktifkan, gambar yang sedang dipilih langsung diluruskan
function setAngleSnap(on) {
  state.angleSnap = on; save();
  for (const c of allCharts()) c.angleSnap = on;
  const c = chart(), d = c.selected;
  if (on && d && !TOOLS[d.tool].freehand && d.points.length > 1 && !d.locked) {
    c.snapshot();
    for (let k = 1; k < d.points.length; k++) {
      const px = c.toPx(d.points[k]);
      const np = c._angled(d.points[k - 1], px.x, px.y, d.tool);
      if (np) d.points[k] = np;
    }
    c._angleHint = null; c.commit(); drawUI.render(d);
  }
  toast(on ? 'Penggaris sudut AKTIF: garis diluruskan ke 0°, 15°, 30°, 45°, 90°…' : 'Penggaris sudut nonaktif');
  renderRail(); renderToolGrid(); renderDrawMode();
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
const SUBMENU = {
  hide: [['hide', 'Sembunyikan gambar'], ['hidestudies', 'Sembunyikan indikator'], ['hideall', 'Sembunyikan semua']],
  magnet: [['magnet-off', 'Magnet mati'], ['magnet-weak', 'Magnet Lemah'], ['magnet-strong', 'Magnet Kuat']],
  clear: [['clear', 'Hapus gambar'], ['clearstudies', 'Hapus indikator'], ['clearall', 'Hapus semua']],
};
function utilOn(u) {
  const c = chart();
  return { measure: c.tool === 'measure', eraser: c.tool === 'eraser', zoomin: c.tool === 'zoomin', angle: !!state.angleSnap, stay: G.stay, hide: G.hidden, lock: G.lockAll, magnet: state.magnet !== 'off' }[u.id] || false;
}
function renderToolGrid() {
  const c = chart(); if (!c) return;
  const q = $('#toolSearch').value.trim().toLowerCase();
  let html;
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
    if (window.innerWidth < 820 && chart().tool) togglePanel('drawPanel', false);
  }
};

// =====================================================================
// Gambar terpilih (toolbar + dialog pengaturan)
// =====================================================================
const drawUI = initDrawUI({
  chart, pane: act, state, save, toast,
  onSelect: d => onSelect(d),
  applyDefaults: () => { for (const c of allCharts()) { c.styleDefaults = state.styleDefaults; c.extraDefaults = state.extraDefaults; } },
  addLineAlert: d => editAlert(null, d),
  setAngleSnap: on => setAngleSnap(on),
});
function onSelect(d) {
  drawUI.reset(); drawUI.render(d);
  if (!$('#treePanel').classList.contains('hidden')) renderTree();
}
setInterval(() => { const c = chart(); if (c?.selected) drawUI.position(c.selected); }, 250);

// =====================================================================
// Layout & sinkronisasi
// =====================================================================
function layoutIcon(l) {
  const cells = { '1': [[1, 1, 1, 1]], '2h': [[1, 1, 1, 1], [2, 1, 1, 1]], '2v': [[1, 1, 1, 1], [1, 2, 1, 1]] };
  const tpl = { '1': '1fr/1fr', '2h': '1fr/1fr 1fr', '2v': '1fr 1fr/1fr', '3c': '1fr/1fr 1fr 1fr', '3r': '1fr 1fr 1fr/1fr', '3l': '1fr 1fr/1fr 1fr', '3t': '1fr 1fr/1fr 1fr', '4': '1fr 1fr/1fr 1fr', '4c': '1fr/repeat(4,1fr)', '4r': 'repeat(4,1fr)/1fr', '4l': 'repeat(3,1fr)/2fr 1fr', '6': '1fr 1fr/repeat(3,1fr)', '6v': 'repeat(3,1fr)/1fr 1fr', '8': '1fr 1fr/repeat(4,1fr)' }[l];
  const n = LAYOUT_N[l];
  const first = l === '3l' ? 'grid-row:span 2' : l === '3t' ? 'grid-column:span 2' : l === '4l' ? 'grid-row:span 3' : '';
  void cells;
  return `<button class="lg-btn ${state.layout === l ? 'on' : ''}" data-l="${l}" style="grid-template:${tpl}">${Array.from({ length: n }, (_, k) => `<i style="${k === 0 ? first : ''}"></i>`).join('')}</button>`;
}
function renderLayoutPanel() {
  $('#layoutGrid').innerHTML = Object.entries(LAYOUTS).map(([n, ls]) => `<h5>${n}</h5><div class="lg-row">${ls.map(layoutIcon).join('')}</div>`).join('');
}
$('#layoutGrid').onclick = e => {
  const b = e.target.closest('[data-l]'); if (!b) return;
  state.layout = b.dataset.l; save(); buildPanes(); renderHeader(); renderLayoutPanel();
};
$('#syncBtn').onclick = e => {
  const S = [['symbol', 'Simbol'], ['interval', 'Interval'], ['crosshair', 'Crosshair'], ['time', 'Waktu (geser bersama)']];
  const draw = () => '<div class="mh">Sinkronkan antar chart</div>' + S.map(([k, n]) => `<button class="mi" data-v="${k}" data-keep="1">${state.sync[k] ? '☑' : '☐'} ${n}</button>`).join('');
  popMenu(e.currentTarget, draw(), v => { state.sync[v] = !state.sync[v]; save(); $('#popMenu').innerHTML = draw(); });
};

// =====================================================================
// Pohon objek
// =====================================================================
function renderTree() {
  const p = act(), c = p.chart, cfg = p.cfg;
  const studies = cfg.studies.map(s => `<div class="tree-row ${s.hidden ? 'dim' : ''}" data-study="${s.id}">
      ${icon(IC.ind)}<span class="nm">${esc(indicatorLabel(s))}</span>
      <button class="icon-btn" data-t="seye" title="Tampil/sembunyi">${icon(s.hidden ? IC.eyeoff : IC.eye)}</button>
      <button class="icon-btn" data-t="sdel" title="Hapus">${icon(IC.trash)}</button></div>`).join('');
  const draws = c.drawings.slice().reverse().map(d => `<div class="tree-row ${d.hidden ? 'dim' : ''} ${c.selected === d ? 'on' : ''}" data-draw="${d.id}">
      ${icon(TOOLS[d.tool].icon)}<span class="nm">${esc(d.name || TOOLS[d.tool].name)}${d.text ? ': ' + esc(d.text) : ''}</span>
      <button class="icon-btn" data-t="deye" title="Tampil/sembunyi">${icon(d.hidden ? IC.eyeoff : IC.eye)}</button>
      <button class="icon-btn" data-t="dlock" title="Kunci">${icon(d.locked ? IC.lock : IC.unlock)}</button>
      <button class="icon-btn" data-t="ddel" title="Hapus">${icon(IC.trash)}</button></div>`).join('');
  $('#treeList').innerHTML = `<div class="tree-row">${icon(IC.candle)}<span class="nm"><b>${cfg.symbol} · ${BROKERS[cfg.broker]}, ${TF_SHORT[cfg.tf]}</b></span></div>
    ${studies}${draws || '<p class="note">Belum ada gambar</p>'}`;
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
  }
  renderTree();
};

// =====================================================================
// Indikator, metrik dan strategi
// =====================================================================
const IND_GROUPS = {
  tren: ['sma', 'ema', 'wma', 'bb', 'vwap', 'ichimoku', 'supertrend', 'pivots', 'structure'],
  osilator: ['rsi', 'macd', 'stoch', 'cci', 'adx'],
  volume: ['volume', 'obv', 'vwap'], volatilitas: ['atr', 'bb', 'supertrend'],
};
let indNav = 'teknikal', indChip = 'all';
function openIndicators() { $('#indModal').classList.remove('hidden'); $('#indSearch').value = ''; renderIndModal(); }
$('#closeInd').onclick = () => $('#indModal').classList.add('hidden');
$('#indModal').onclick = e => { if (e.target.id === 'indModal') $('#indModal').classList.add('hidden'); };
$('#indSearch').oninput = renderIndModal;
function renderIndModal() {
  const nav = [['PRIBADI', [['favorit', 'Favorit', IC.star], ['template', 'Template', IC.tpl], ['aktif', 'Di chart ini', IC.layers]]], ['BAWAAN', [['teknikal', 'Teknikal', IC.ind]]]];
  $('#indNav').innerHTML = nav.map(([h, items]) => `<h6>${h}</h6>` + items.map(([k, n, ic]) => `<button data-nav="${k}" class="${indNav === k ? 'on' : ''}">${icon(ic)}${n}</button>`).join('')).join('');
  const q = $('#indSearch').value.trim().toLowerCase(), cfg = act().cfg;
  $('#indChips').innerHTML = indNav === 'teknikal' && !q ? [['all', 'Seluruh'], ['tren', 'Tren'], ['osilator', 'Osilator'], ['volume', 'Volume'], ['volatilitas', 'Volatilitas']].map(([k, n]) => `<button data-chip="${k}" class="${indChip === k ? 'on' : ''}">${n}</button>`).join('') : '';
  const row = (k, d) => `<div class="ind-row" data-add="${k}"><button class="st ${state.indFav.includes(k) ? 'fav' : ''}" data-fav="${k}" title="Favorit">★</button>
    <div class="nm">${esc(d.name)}<small>${d.pane === 'sub' ? 'Pane terpisah' : 'Di chart utama'}</small></div><span class="tag">+ Tambah</span></div>`;
  let html = '';
  if (q || indNav === 'teknikal' || indNav === 'favorit') {
    html = Object.entries(INDICATORS).filter(([k, d]) => (!q || d.name.toLowerCase().includes(q)) && (q || indNav !== 'favorit' || state.indFav.includes(k)) && (q || indNav !== 'teknikal' || indChip === 'all' || IND_GROUPS[indChip].includes(k))).map(([k, d]) => row(k, d)).join('')
      || `<div class="empty">${indNav === 'favorit' ? 'Belum ada favorit. Ketuk ★ pada indikator.' : 'Tidak ditemukan.'}</div>`;
  } else if (indNav === 'aktif') {
    html = cfg.studies.map(s => `<div class="ind-row" data-id="${s.id}"><div class="nm">${esc(indicatorLabel(s))}<small>${INDICATORS[s.type].pane === 'sub' ? 'Pane terpisah' : 'Di chart utama'}</small></div>
      <button class="icon-btn" data-a="eye" title="Tampil/sembunyi">${icon(s.hidden ? IC.eyeoff : IC.eye)}</button>
      <button class="icon-btn" data-a="set" title="Pengaturan">${icon(IC.gear)}</button>
      <button class="icon-btn" data-a="del" title="Hapus">${icon(IC.trash)}</button></div>`).join('') || '<div class="empty">Belum ada indikator di chart ini.</div>';
  } else if (indNav === 'template') {
    html = `<button class="primary block" data-tsave="1">Simpan indikator chart ini sebagai template</button>` + (state.indTemplates.map((t, k) => `<div class="ind-row" data-tpl="${k}"><div class="nm">${esc(t.name)}<small>${t.studies.map(s => INDICATORS[s.type]?.short).join(', ')}</small></div>
      <span class="tag">Terapkan</span><button class="icon-btn" data-tdel="${k}" title="Hapus">${icon(IC.trash)}</button></div>`).join('') || '<div class="empty">Belum ada template indikator.</div>');
  }
  $('#indList').innerHTML = html;
}
$('#indNav').onclick = e => { const b = e.target.closest('[data-nav]'); if (b) { indNav = b.dataset.nav; renderIndModal(); } };
$('#indChips').onclick = e => { const b = e.target.closest('[data-chip]'); if (b) { indChip = b.dataset.chip; renderIndModal(); } };
$('#indList').onclick = e => {
  const p = act(), cfg = p.cfg;
  const fav = e.target.closest('[data-fav]');
  if (fav) { const k = fav.dataset.fav; state.indFav = state.indFav.includes(k) ? state.indFav.filter(x => x !== k) : [...state.indFav, k]; save(); return renderIndModal(); }
  if (e.target.closest('[data-tsave]')) {
    if (!cfg.studies.length) return toast('Belum ada indikator di chart ini');
    const name = prompt('Nama template indikator:', `Template ${state.indTemplates.length + 1}`);
    if (name) { state.indTemplates.push({ name, studies: cfg.studies.map(s => ({ type: s.type, params: { ...s.params } })) }); save(); renderIndModal(); }
    return;
  }
  const tdel = e.target.closest('[data-tdel]'); if (tdel) { state.indTemplates.splice(+tdel.dataset.tdel, 1); save(); return renderIndModal(); }
  const tpl = e.target.closest('[data-tpl]');
  if (tpl) { cfg.studies = state.indTemplates[+tpl.dataset.tpl].studies.map(s => ({ id: uid(), type: s.type, params: { ...s.params } })); p.chart.studies = cfg.studies; save(); p.chart.invalidate(); toast('Template diterapkan'); return; }
  const add = e.target.closest('[data-add]');
  if (add) { cfg.studies.push({ id: uid(), type: add.dataset.add, params: studyParams(add.dataset.add) }); save(); p.chart.invalidate(); toast(`${INDICATORS[add.dataset.add].name} ditambahkan`); return; }
  const row = e.target.closest('[data-id]'), a = e.target.closest('[data-a]')?.dataset.a; if (!row || !a) return;
  const s = cfg.studies.find(x => x.id === row.dataset.id);
  if (a === 'eye') s.hidden = !s.hidden;
  if (a === 'del') cfg.studies.splice(cfg.studies.indexOf(s), 1);
  if (a === 'set') return openStudySettings(p, s.id);
  save(); p.chart.invalidate(); renderIndModal();
};
function openStudySettings(pane, id) { studyUI.open(pane, id); }
const studyParams = k => ({ ...defaultParams(k), ...(state.studyDefaults?.[k] || {}) });

// ---------- Form generik (dengan tab opsional) ----------
function openForm(title, fields, onSave, extra = [], onLive) {
  $('#formTitle').textContent = title;
  const tabs = [...new Set(fields.map(f => f.tab).filter(Boolean))];
  let tab = tabs[0];
  const fieldHtml = f => {
    const v = f.value ?? f.def, hid = f.tab && f.tab !== tab ? 'hidden' : '';
    if (f.type === 'bool') return `<label class="chk ${hid}" data-tab="${f.tab || ''}"><input type="checkbox" data-k="${f.key}" ${v ? 'checked' : ''}/> ${esc(f.label)}</label>`;
    if (f.type === 'select') return `<label class="${hid}" data-tab="${f.tab || ''}">${esc(f.label)}<select data-k="${f.key}">${f.options.map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select></label>`;
    if (f.type === 'color') return `<label class="${hid}" data-tab="${f.tab || ''}">${esc(f.label)}<input type="color" data-k="${f.key}" value="${esc(v)}"/></label>`;
    if (f.type === 'text') return `<label class="${hid}" data-tab="${f.tab || ''}">${esc(f.label)}<input data-k="${f.key}" value="${esc(v ?? '')}" placeholder="${esc(f.placeholder || '')}"/></label>`;
    if (f.type === 'heading') return `<div class="fsec ${hid}" data-tab="${f.tab || ''}">${esc(f.label)}</div>`;
    return `<label class="${hid}" data-tab="${f.tab || ''}">${esc(f.label)}<input type="number" inputmode="decimal" data-k="${f.key}" value="${v}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} step="${f.step || 'any'}"/></label>`;
  };
  $('#formTabs').classList.toggle('hidden', !tabs.length);
  $('#formTabs').innerHTML = tabs.map(t => `<button data-ft="${t}" class="${t === tab ? 'on' : ''}">${t}</button>`).join('');
  $('#formTabs').onclick = e => {
    const b = e.target.closest('[data-ft]'); if (!b) return; tab = b.dataset.ft;
    $('#formTabs').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    $('#formBody').querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('hidden', !!x.dataset.tab && x.dataset.tab !== tab));
  };
  $('#formBody').innerHTML = fields.map(fieldHtml).join('');
  const read = () => {
    const vals = {};
    for (const f of fields) {
      if (f.type === 'heading') continue;
      const el = $('#formBody').querySelector(`[data-k="${f.key}"]`);
      let v = f.type === 'bool' ? el.checked : el.value;
      if (f.type === 'number') { v = parseFloat(String(v).replace(',', '.')); if (!isFinite(v)) v = f.def; if (f.min != null) v = Math.max(f.min, v); if (f.max != null) v = Math.min(f.max, v); }
      vals[f.key] = v;
    }
    return vals;
  };
  $('#formBody').oninput = $('#formBody').onchange = () => onLive?.(read());
  $('#formActions').innerHTML = extra.map(([n], k) => `<button class="ghost" data-x="${k}">${n}</button>`).join('') + '<span class="spacer"></span><button class="ghost" data-x="cancel">Batal</button><button class="primary" data-x="ok">Ok</button>';
  $('#formActions').onclick = e => {
    const x = e.target.closest('[data-x]')?.dataset.x; if (x == null) return;
    if (x === 'ok') { if (onSave(read()) === false) return; }
    else if (x === 'cancel') formCancel?.();
    else extra[+x][1]();
    $('#formModal').classList.add('hidden');
  };
  $('#formModal').classList.remove('hidden');
}
let formCancel = null;
$('#closeForm').onclick = () => { formCancel?.(); $('#formModal').classList.add('hidden'); };
$('#formModal').onclick = e => { if (e.target.id === 'formModal') { formCancel?.(); $('#formModal').classList.add('hidden'); } };

// ---------- Pengaturan chart (dialog bermenu kiri; juga dibuka dengan ketuk 2x pada chart) ----------
const studyUI = initStudyUI({ pane: act, state, save, toast, popMenu, uid });
const chartSettings = initSettings({
  state, save, toast,
  apply: () => panes.forEach(p => { applyChartLook(p.chart); p.updateLegend(); }),
  chartType: () => act().cfg.chartType,
  setChartType: v => { act().cfg.chartType = chart().chartType = v; chart().invalidate(); save(); },
});
function openChartSettings(sec) { chartSettings.open(sec); }

// =====================================================================
// Peringatan (harga & garis gambar)
// =====================================================================
const COND = { cross: 'Melintasi', up: 'Melintasi ke atas', down: 'Melintasi ke bawah', above: 'Di atas', below: 'Di bawah' };
let alerts = JSON.parse(localStorage.getItem('ac:alerts') || '[]');
let alertLog = JSON.parse(localStorage.getItem('ac:alertlog') || '[]');
let alertTab = 'list';
const lastSeen = new Map();
function saveAlerts() {
  localStorage.setItem('ac:alerts', JSON.stringify(alerts)); localStorage.setItem('ac:alertlog', JSON.stringify(alertLog.slice(0, 200)));
  syncAlerts(); if (!$('#alertPanel').classList.contains('hidden')) renderAlerts();
}
function syncAlerts() {
  for (const p of panes) { p.chart.alerts = alerts.filter(a => !a.drawId && a.symbol === p.cfg.symbol && a.broker === p.cfg.broker); p.chart.invalidate(); }
}
function lineLevel(a) {
  const p = panes.find(x => x.cfg.symbol === a.symbol && x.chart.candles.length);
  const d = p?.chart.drawings.find(x => x.id === a.drawId);
  return d ? p.chart.lineValueAt(d, p.chart.tToI(Date.now())) : null;
}
function checkAlerts(symbol, broker, price) {
  if (price == null) return;
  const key = `${symbol}|${broker}`, prev = lastSeen.get(key);
  lastSeen.set(key, price);
  let changed = false;
  for (const a of alerts) {
    if (!a.active || a.symbol !== symbol || a.broker !== broker) continue;
    const lvl = a.drawId ? lineLevel(a) : a.price;
    if (lvl == null) continue;
    const pl = a.drawId ? a._prevLvl ?? lvl : lvl; a._prevLvl = lvl;
    const hit = {
      cross: prev != null && ((prev < pl && price >= lvl) || (prev > pl && price <= lvl)),
      up: prev != null && prev < pl && price >= lvl, down: prev != null && prev > pl && price <= lvl,
      above: price > lvl, below: price < lvl,
    }[a.cond];
    if (!hit) continue;
    a.active = !!a.repeat; a.triggeredAt = Date.now(); changed = true;
    const dg = symInfo(symbol)?.digits ?? 2;
    const what = a.drawId ? `${a.drawName || 'garis'} (${fmtP(lvl, dg)})` : fmtP(lvl, dg);
    const msg = `${symbol} ${COND[a.cond].toLowerCase()} ${what} — harga ${fmtP(price, dg)}${a.msg ? '. ' + a.msg : ''}`;
    alertLog.unshift({ t: Date.now(), msg, symbol, broker });
    toast('⏰ ' + msg, 8000); notify('⏰ Peringatan LokiChart', msg);
  }
  if (changed) saveAlerts();
}
$('#newAlert').onclick = () => editAlert(null);
$('#alertSearch').oninput = renderAlerts;
document.querySelector('#alertPanel .seg2').onclick = e => { const b = e.target.closest('[data-at]'); if (!b) return; alertTab = b.dataset.at; document.querySelectorAll('#alertPanel .seg2 button').forEach(x => x.classList.toggle('on', x === b)); renderAlerts(); };
function renderAlerts() {
  const q = $('#alertSearch').value.trim().toUpperCase();
  if (alertTab === 'log') {
    const l = alertLog.filter(x => !q || x.msg.toUpperCase().includes(q));
    $('#alertList').innerHTML = l.map(x => `<div class="tree-row"><span class="nm">${esc(x.msg)}<small>${new Date(x.t).toLocaleString('id-ID')}</small></span></div>`).join('') || `<div class="empty-al">${icon(IC.alarmBig)}<b>Log masih kosong</b>Peringatan yang terpicu akan tercatat di sini.</div>`;
    return;
  }
  const l = alerts.filter(a => !q || a.symbol.includes(q) || (a.msg || '').toUpperCase().includes(q));
  $('#alertList').innerHTML = l.slice().reverse().map(a => {
    const dg = symInfo(a.symbol)?.digits ?? 2;
    return `<div class="tree-row ${a.active ? '' : 'dim'}" data-id="${a.id}"><span class="nm"><b>${a.symbol}</b> · ${BROKERS[a.broker]}
      <small>${COND[a.cond]} ${a.drawId ? esc(a.drawName || 'garis gambar') : fmtP(a.price, dg)}${a.msg ? ' — ' + esc(a.msg) : ''} · ${a.active ? 'Aktif' : a.triggeredAt ? 'Terpicu' : 'Dijeda'}</small></span>
      <button class="icon-btn" data-a="toggle" title="Aktif/jeda">${icon(a.active ? IC.pause : IC.play)}</button>
      <button class="icon-btn" data-a="edit" title="Ubah">${icon(IC.gear)}</button>
      <button class="icon-btn" data-a="del" title="Hapus">${icon(IC.trash)}</button></div>`;
  }).join('') || `<div class="empty-al">${icon(IC.alarmBig)}<b>Belum ada peringatan di sini</b>Buat peringatan untuk menerima notifikasi saat pasar bergerak sesuai kriteria Anda.</div>`;
}
$('#alertList').onclick = e => {
  const row = e.target.closest('[data-id]'), a = e.target.closest('[data-a]')?.dataset.a; if (!row || !a) return;
  const al = alerts.find(x => x.id === row.dataset.id);
  if (a === 'del') alerts.splice(alerts.indexOf(al), 1);
  if (a === 'toggle') { al.active = !al.active; if (al.active) al.triggeredAt = null; }
  if (a === 'edit') return editAlert(al);
  saveAlerts();
};
function editAlert(al, drawing) {
  const cfg = act().cfg, last = chart().candles.at(-1)?.c;
  const d = drawing || (al?.drawId ? chart().drawings.find(x => x.id === al.drawId) : null);
  const isLine = !!(d || al?.drawId);
  const symOpts = SYMBOLS.map(s => [`${s.symbol}|${s.broker}`, `${s.symbol} · ${BROKERS[s.broker]}`]);
  const fields = [];
  if (!isLine) fields.push({ key: 'sym', label: 'Simbol', type: 'select', options: symOpts, value: al ? `${al.symbol}|${al.broker}` : `${cfg.symbol}|${cfg.broker}` });
  fields.push({ key: 'cond', label: 'Kondisi', type: 'select', options: Object.entries(COND).filter(([k]) => !isLine || ['cross', 'up', 'down'].includes(k)), value: al?.cond || 'cross' });
  if (!isLine) fields.push({ key: 'price', label: 'Harga', type: 'number', value: al?.price ?? last ?? 0, step: 'any' });
  fields.push({ key: 'repeat', label: 'Picu setiap kali (tidak hanya sekali)', type: 'bool', value: !!al?.repeat });
  fields.push({ key: 'msg', label: 'Pesan (opsional)', type: 'text', value: al?.msg || '' });
  formCancel = null;
  openForm(isLine ? `Peringatan: ${d ? (d.name || TOOLS[d.tool].name) : al.drawName}` : al ? 'Ubah peringatan' : 'Buat peringatan', fields, v => {
    const [symbol, broker] = isLine ? [al?.symbol || cfg.symbol, al?.broker || cfg.broker] : v.sym.split('|');
    const base = { symbol, broker, cond: v.cond, msg: v.msg, repeat: v.repeat, active: true, triggeredAt: null };
    if (isLine) Object.assign(base, { drawId: d?.id || al.drawId, drawName: d ? (d.name || TOOLS[d.tool].name) : al.drawName });
    else base.price = v.price;
    if (al) Object.assign(al, base); else alerts.push({ id: uid(), created: Date.now(), ...base });
    saveAlerts(); askNotifyPermission(); toast('Peringatan disimpan');
  }, al ? [['Hapus', () => { alerts.splice(alerts.indexOf(al), 1); saveAlerts(); }]] : []);
}
setInterval(async () => {
  const shown = new Set(panes.map(p => `${p.cfg.symbol}|${p.cfg.broker}`));
  const keys = [...new Set(alerts.filter(a => a.active).map(a => `${a.symbol}|${a.broker}`))].filter(k => !shown.has(k));
  for (const k of keys) {
    const [s, b] = k.split('|');
    try { const d = await ds.candles(b, s, '1m', 2); checkAlerts(s, b, d.candles.at(-1)?.c); } catch { /* */ }
  }
}, 10000);

// =====================================================================
// Replay
// =====================================================================
let replayTimer = null, replaySpeed = 1;
function replayToggle() {
  const c = chart();
  if (c.replay || c.tool === 'replay') return stopReplay();
  c.setTool('replay');
  toast('Replay: ketuk bar tempat replay dimulai', 3000);
  renderReplayBar();
}
function stopReplay() { clearInterval(replayTimer); replayTimer = null; const c = chart(); c.stopReplay(); if (c.tool === 'replay') c.setTool(null); renderReplayBar(); }
function renderReplayBar() {
  const c = chart(), bar = $('#replayBar'), on = !!(c?.replay || c?.tool === 'replay');
  bar.classList.toggle('hidden', !on); $('#bottombar').classList.toggle('hidden', on);
  requestAnimationFrame(() => panes.forEach(p => p.chart.resize()));
  if (!on) { clearInterval(replayTimer); replayTimer = null; return; }
  const cfg = act().cfg;
  if (!c.replay) { bar.innerHTML = `<button class="icon-btn on" title="Pilih titik awal">${icon(IC.start)}</button><span class="lbl">Ketuk bar di chart untuk memulai replay</span><span class="spacer"></span><button class="icon-btn" data-r="exit" title="Keluar">${icon(IC.close)}</button>`; return; }
  const left = c.replay.full.length - 1 - c.replay.idx;
  bar.innerHTML = `<button class="icon-btn" data-r="pick" title="Pilih titik awal">${icon(IC.start)}</button>
    <button class="icon-btn" data-r="play" title="${replayTimer ? 'Jeda' : 'Putar'}">${icon(replayTimer ? IC.pause : IC.play)}</button>
    <button class="icon-btn" data-r="step" title="Maju 1 bar">${icon(IC.step)}</button>
    <select data-r="speed">${[1, 2, 3, 5, 10, 25].map(s => `<option value="${s}" ${s === replaySpeed ? 'selected' : ''}>${s}x</option>`).join('')}</select>
    <span class="lbl">${TF_SHORT[cfg.tf]} · ${left} bar tersisa</span><span class="spacer"></span>
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
// Pusat analisis
// =====================================================================
function renderHub() {
  const b = (id, n, ic, dis) => `<button data-h="${id}" ${dis ? 'disabled' : ''}>${icon(ic)}${n}</button>`;
  $('#hubBody').innerHTML = `<div class="hub-grid">${b('layout', 'Setup layout', IC.layout)}${b('save', 'Simpan layout', IC.save)}${b('open', 'Buka layout', IC.open)}${b('new', 'Buat baru', IC.plus)}${b('settings', 'Pengaturan chart', IC.gear)}${b('share', 'Bagikan gambar', IC.share)}</div>
    <div class="hub-sec">Info</div>
    <div class="hub-grid">${b('detail', 'Detail simbol', IC.info)}${b('tech', 'Teknikal', IC.gauge)}${b('fund', 'Fundamental', IC.chart, true)}</div>
    <div class="hub-sec">Lainnya</div>
    <div class="hub-grid">${b('alerts', 'Peringatan', IC.bell)}${b('tree', 'Pohon objek', IC.layers)}${b('help', 'Bantuan', IC.help)}</div>`;
}
$('#hubBody').onclick = e => {
  const h = e.target.closest('[data-h]')?.dataset.h; if (!h) return;
  const cfg = act().cfg;
  if (h === 'layout') { togglePanel('layoutPanel', true); renderLayoutPanel(); }
  if (h === 'save') {
    const name = prompt('Nama layout:', `Layout ${state.layouts.length + 1}`);
    if (name) { state.layouts = state.layouts.filter(l => l.name !== name); state.layouts.push({ name, layout: state.layout, panes: JSON.parse(JSON.stringify(state.panes)) }); save(); toast('Layout disimpan'); }
  }
  if (h === 'open') {
    if (!state.layouts.length) return toast('Belum ada layout tersimpan');
    popMenu(e.target.closest('[data-h]'), '<div class="mh">Layout tersimpan</div>' + state.layouts.map((l, k) => `<button class="mi" data-v="${k}">${esc(l.name)} <span class="x">${LAYOUT_N[l.layout]} chart</span></button>`).join(''), v => {
      const l = state.layouts[+v]; state.layout = l.layout; state.panes = JSON.parse(JSON.stringify(l.panes)); state.active = 0; save();
      panes.forEach(p => p.destroy()); panes = []; $('#charts').innerHTML = ''; buildPanes(); renderHeader();
    });
  }
  if (h === 'new' && confirm('Buat layout baru (1 chart, tanpa indikator)?')) {
    state.layout = '1'; state.panes = [{ symbol: cfg.symbol, broker: cfg.broker, tf: cfg.tf, chartType: 'candles', studies: defStudies() }]; state.active = 0; save();
    panes.forEach(p => p.destroy()); panes = []; $('#charts').innerHTML = ''; buildPanes(); renderHeader();
  }
  if (h === 'settings') openChartSettings();
  if (h === 'share') doShare();
  if (h === 'detail') {
    const s = symInfo(cfg.symbol, cfg.broker);
    openForm('Detail simbol', [{ type: 'heading', label: `${s.symbol} — ${s.desc}` }, { type: 'heading', label: `Broker: ${BROKERS[cfg.broker]} · Jenis: ${s.type} · Desimal: ${s.digits}` }, { type: 'heading', label: `Sumber data: ${act().source === 'live' ? 'LIVE dari broker' : 'DEMO (sintetis)'}` }], () => {});
  }
  if (h === 'tech') {
    const r = technicalRating(chart().candles);
    if (!r) return toast('Data belum cukup');
    openForm(`Teknikal · ${cfg.symbol} ${TF_SHORT[cfg.tf]}`, [{ type: 'heading', label: `Rata-rata bergerak: ${r.ma.buy} beli · ${r.ma.sell} jual · Osilator: ${r.osc.buy} beli · ${r.osc.sell} jual` }], () => {});
    const cv = document.createElement('canvas'); cv.style.width = '100%'; $('#formBody').prepend(cv); drawGauge(cv, r.score, r.label);
  }
  if (h === 'alerts') { togglePanel('alertPanel', true); renderAlerts(); }
  if (h === 'tree') { togglePanel('treePanel', true); renderTree(); }
  if (h === 'help') toast('Lihat README di repo GitHub LokiChart untuk panduan lengkap', 4000);
};

// =====================================================================
// Keyboard
// =====================================================================
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select') || state.page !== 'chart') return;
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
let ovSel = null;
const overview = new Overview($('#overview'), {
  fmt: fmtP, iconHtml: s => symIconHtml(s), brokers: BROKERS,
  onOpenChart: () => { if (ovSel) setSymbol(ovSel[0], ovSel[1]); showPage('chart'); },
  onBack: () => $('#pg-watch').classList.remove('detail'),
});
function showOverview() {
  const [s, b] = ovSel || [act().cfg.symbol, act().cfg.broker];
  const q = quotes[`${s}|${b}`];
  overview.show(symInfo(s, b), b, q?.last);
}
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
  const sel = ovSel || [act()?.cfg.symbol, act()?.cfg.broker];
  $('#wlList').innerHTML = state.watchlist.map(([s, b]) => {
    const q = quotes[`${s}|${b}`], info = symInfo(s, b);
    const ch = q ? q.last - q.prev : null, chp = q ? (ch / q.prev) * 100 : null;
    const cls = ch == null ? '' : ch >= 0 ? 'up' : 'down';
    return `<div class="wl-row ${s === sel[0] && b === sel[1] ? 'on' : ''}" data-s="${s}" data-b="${b}">
      ${symIconHtml(s)}<div style="min-width:0"><b>${s}</b><small>${info?.desc || ''} · ${BROKERS[b]}</small></div>
      <div class="r"><b>${q ? fmtP(q.last, q.digits) : '—'}</b><small class="${cls}">${ch == null ? '' : `${ch >= 0 ? '+' : ''}${fmtP(ch, q.digits)} ${ch >= 0 ? '+' : ''}${chp.toFixed(2)}%`}</small></div></div>`;
  }).join('');
}
$('#wlList').onclick = e => {
  const r = e.target.closest('.wl-row'); if (!r) return;
  ovSel = [r.dataset.s, r.dataset.b];
  setSymbol(r.dataset.s, r.dataset.b);
  renderWatchlist(); showOverview();
  $('#pg-watch').classList.add('detail');
};
$('#wlList').oncontextmenu = e => {
  const r = e.target.closest('.wl-row'); if (!r) return;
  e.preventDefault();
  if (confirm(`Hapus ${r.dataset.s} (${BROKERS[r.dataset.b]}) dari daftar pantau?`)) { state.watchlist = state.watchlist.filter(([s, b]) => !(s === r.dataset.s && b === r.dataset.b)); save(); renderWatchlist(); }
};
$('#wlTitle').onclick = e => popMenu(e.currentTarget, '<button class="mi" data-v="add">Tambah simbol</button><button class="mi" data-v="sort">Urutkan A–Z</button><button class="mi" data-v="clear">Kosongkan daftar</button>', v => {
  if (v === 'add') openSearch();
  if (v === 'sort') { state.watchlist.sort((a, b) => a[0].localeCompare(b[0])); save(); renderWatchlist(); }
  if (v === 'clear' && confirm('Kosongkan daftar pantau?')) { state.watchlist = []; save(); renderWatchlist(); }
});
$('#wlAdd').onclick = $('#wlAdd2').onclick = $('#wlSearch').onclick = () => openSearch();

// =====================================================================
// Pencarian simbol
// =====================================================================
const SYM_TABS = [['all', 'Seluruh'], ['forex', 'Forex'], ['commodity', 'Komoditas'], ['crypto', 'Kripto'], ['index', 'Indeks'], ['oanda', 'OANDA'], ['forexcom', 'FOREX.com']];
let symTab = 'all';
function openSearch() { $('#searchModal').classList.remove('hidden'); $('#symSearch').value = ''; renderSymList(); setTimeout(() => $('#symSearch').focus(), 50); }
function renderSymList() {
  $('#symTabs').innerHTML = SYM_TABS.map(([k, n]) => `<button data-k="${k}" class="${symTab === k ? 'on' : ''}">${n}</button>`).join('');
  const q = $('#symSearch').value.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '');
  const row = s => {
    const inWl = state.watchlist.some(([a, b]) => a === s.symbol && b === s.broker);
    return `<div class="sym-row" data-s="${s.symbol}" data-b="${s.broker}">${symIconHtml(s.symbol)}<div><b>${s.symbol}</b><small>${s.desc}</small></div>
      <div class="r"><b>${BROKERS[s.broker]}</b><small>${s.type}</small></div>
      <button class="add" data-add="1" title="${inWl ? 'Hapus dari' : 'Tambah ke'} daftar pantau">${inWl ? '✓' : '+'}</button></div>`;
  };
  const list = SYMBOLS.filter(s => {
    if (symTab === 'oanda' || symTab === 'forexcom') { if (s.broker !== symTab) return false; }
    else if (symTab !== 'all' && !s.type.includes(symTab)) return false;
    return !q || s.symbol.includes(q) || s.desc.toUpperCase().includes(q);
  });
  const recent = !q && symTab === 'all' ? state.recent.map(r => symInfo(r.symbol, r.broker)).filter(Boolean) : [];
  $('#symList').innerHTML = (recent.length ? '<div class="sym-sec">Simbol terbaru</div>' + recent.map(row).join('') + '<div class="sym-sec">Semua simbol</div>' : '') + (list.map(row).join('') || '<div class="empty">Simbol tidak ditemukan</div>');
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
  if (state.page === 'watch') { ovSel = [s, b]; showOverview(); renderWatchlist(); $('#pg-watch').classList.add('detail'); }
  setSymbol(s, b);
};
$('#closeSearch').onclick = () => $('#searchModal').classList.add('hidden');
$('#searchModal').onclick = e => { if (e.target.id === 'searchModal') $('#searchModal').classList.add('hidden'); };

// =====================================================================
// Akun broker
// =====================================================================
const F = ['oandaKey', 'oandaEnv', 'fxUser', 'fxPass', 'fxKey', 'fxUrl', 'fxIds'];
function openBroker() {
  const c = loadCreds(), server = ds.mode === 'server';
  const v = { oandaKey: c.oanda?.apiKey || '', oandaEnv: c.oanda?.env || 'practice', fxUser: c.forexcom?.username || '', fxPass: c.forexcom?.password || '', fxKey: c.forexcom?.appKey || '', fxUrl: c.forexcom?.baseUrl || '', fxIds: c.forexcom?.marketIds || '' };
  for (const k of F) { $('#' + k).value = v[k]; $('#' + k).disabled = server; }
  $('#setNote').innerHTML = server ? 'Versi web ini memakai server: kredensial diatur di file <code>.env</code> server, bukan di sini.' : 'Kredensial hanya disimpan di perangkat ini dan dikirim langsung ke server broker. Kosongkan untuk memakai data demo.';
  $('#saveSet').classList.toggle('hidden', server);
  $('#setStatus').textContent = '';
  $('#settingsModal').classList.remove('hidden');
}
$('#closeSet').onclick = () => $('#settingsModal').classList.add('hidden');
$('#settingsModal').onclick = e => { if (e.target.id === 'settingsModal') $('#settingsModal').classList.add('hidden'); };
$('#saveSet').onclick = async () => {
  const g = k => $('#' + k).value.trim();
  saveCreds({ oanda: { apiKey: g('oandaKey'), env: g('oandaEnv') }, forexcom: { username: g('fxUser'), password: $('#fxPass').value, appKey: g('fxKey'), baseUrl: g('fxUrl'), marketIds: g('fxIds') } });
  $('#setStatus').textContent = 'Menguji koneksi…';
  const out = [];
  for (const b of ['oanda', 'forexcom']) {
    const st = (await ds.status())[b];
    if (st !== 'live') { out.push(`${BROKERS[b]}: demo (belum diisi)`); continue; }
    try { await ds.candles(b, 'EURUSD', '1h', 2); out.push(`${BROKERS[b]}: ✓ terhubung`); } catch (e) { out.push(`${BROKERS[b]}: ✗ ${e.message}`); }
  }
  $('#setStatus').textContent = out.join('\n');
  panes.forEach(p => p.load()); refreshQuotes(); menuPage.render();
};

// =====================================================================
// Halaman Jelajahi & Menu
// =====================================================================
const explore = new Explore($('#exploreBody'), {
  symbols: () => SYMBOLS, fmt: fmtP, iconHtml: s => symIconHtml(s),
  open: (s, b) => { ovSel = [s, b]; setSymbol(s, b); showPage('watch'); $('#pg-watch').classList.add('detail'); },
});
$('#exBroker').onchange = e => explore.show(e.target.value);
let brokerStatus = {};
const menuPage = new MenuPage($('#menuBody'), {
  state, save, toast, setTheme, applyRail, openChartSettings, openBroker,
  askNotify: async () => { await askNotifyPermission(); toast('Izin notifikasi diminta'); },
  status: () => Object.entries(brokerStatus).map(([k, v]) => `${BROKERS[k]}: ${v === 'live' ? 'LIVE' : 'demo'}`).join(' · ') || '›',
});

// =====================================================================
// Mulai
// =====================================================================
(async function init() {
  document.body.classList.toggle('dark', state.theme === 'dark');
  await ds.init();
  try { SYMBOLS = await ds.symbols(); } catch { toast('Gagal memuat daftar simbol'); }
  try { brokerStatus = await ds.status(); } catch { /* */ }
  state.panes.forEach(p => { if (!symInfo(p.symbol, p.broker)) { p.symbol = 'XAUUSD'; p.broker = 'oanda'; } p.studies ||= defStudies(); p.chartType ||= 'candles'; });
  buildPanes();
  setTheme(state.theme);
  applyRail();
  renderToolTabs(); renderToolGrid(); renderHeader(); renderReplayBar(); renderDrawMode();
  if (!state.recent.length) remember(act().cfg);
  showPage(state.page || 'chart');
  if (state.keepAwake) menuPage.setKeepAwake(true);
  refreshQuotes();
  setInterval(refreshQuotes, 15000);
  window.lc = { get panes() { return panes; }, chart, state, act }; // untuk debugging dari konsol
})();
