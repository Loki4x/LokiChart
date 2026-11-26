import { Chart, THEMES } from './chart.js';
import { TOOLS, CATEGORIES, UTILITIES } from './tools.js';
import { ds, isNative, loadCreds, saveCreds } from './datasource.js';

const $ = s => document.querySelector(s);
const icon = (d, extra = '') => `<svg class="i" viewBox="0 0 24 24" ${extra}><path d="${d}"/></svg>`;
const BROKERS = { oanda: 'OANDA', forexcom: 'FOREX.com' };
const TFS = [['1m', '1m'], ['3m', '3m'], ['5m', '5m'], ['15m', '15m'], ['30m', '30m'], ['1h', '1j'], ['2h', '2j'], ['4h', '4j'], ['1D', '1H'], ['1W', '1M']];
const TF_MS = { '1m': 60e3, '3m': 180e3, '5m': 300e3, '15m': 900e3, '30m': 1800e3, '1h': 3600e3, '2h': 7200e3, '4h': 14400e3, '1D': 86400e3, '1W': 604800e3 };
const IC = {
  cursor: 'M5 3L19 12L12 13.5L9 20Z',
  undo: 'M9 14L4 9L9 4 M4 9H15a5 5 0 0 1 0 10H11', redo: 'M15 14L20 9L15 4 M20 9H9a5 5 0 0 0 0 10H13',
  camera: 'M4 7H8L10 4H14L16 7H20V19H4Z M12 13m-3.5 0a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0',
  full: 'M4 9V4H9 M15 4H20V9 M20 15V20H15 M9 20H4V15', list: 'M8 6H20 M8 12H20 M8 18H20 M4 6h.01 M4 12h.01 M4 18h.01',
  theme: 'M12 3a9 9 0 1 0 9 9a7 7 0 0 1 -9 -9Z', close: 'M6 6L18 18 M18 6L6 18', back: 'M15 5L8 12L15 19',
  search: 'M10 10m-6.5 0a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0 M20 20L15 15', plus: 'M12 5V19 M5 12H19',
  all: 'M4 4h6v6h-6z M14 4h6v6h-6z M4 14h6v6h-6z M14 14h6v6h-6z', clone: 'M8 8H20V20H8Z M4 16V4H16',
  trash: 'M4 6H20 M9 6V3H15V6 M6 6L7 21H17L18 6', lock: 'M6 11H18V21H6Z M8 11V7a4 4 0 0 1 8 0', unlock: 'M6 11H18V21H6Z M8 11V7a4 4 0 0 1 7.5 -2',
  gear: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M12 2V5 M12 19V22 M2 12H5 M19 12H22 M4.9 4.9L7 7 M17 17L19.1 19.1 M4.9 19.1L7 17 M17 7L19.1 4.9',
  dash: 'M3 12H7 M10 12H14 M17 12H21', extend: 'M3 12H21 M17 8L21 12L17 16', text: 'M5 5H19 M12 5V20 M9 20H15',
};

// ---------- State ----------
const saved = JSON.parse(localStorage.getItem('ac:state') || '{}');
const state = {
  symbol: 'XAUUSD', broker: 'oanda', tf: '5m', chartType: 'candles', theme: 'light',
  indicators: { volume: true, sma20: false, ema50: false, ema200: false, bb: false },
  favorites: ['trendline', 'vline', 'fibret', 'fibcircles', 'gannbox', 'gannfan'],
  watchlist: [['XAUUSD', 'oanda'], ['XAUUSD', 'forexcom'], ['EURUSD', 'oanda'], ['USDJPY', 'forexcom'], ['GBPUSD', 'oanda'], ['BTCUSD', 'oanda'], ['NAS100', 'forexcom'], ['USDIDR', 'forexcom']],
  magnet: 'off', panelTab: 'tren', styleDefaults: {},
  ...saved,
};
const save = () => localStorage.setItem('ac:state', JSON.stringify(state));
let SYMBOLS = [];
const symInfo = (s, b) => SYMBOLS.find(x => x.symbol === s && (!b || x.broker === b));

// ---------- Chart ----------
const chart = new Chart($('#chart'));
chart.chartType = state.chartType;
chart.indicators = state.indicators;
chart.magnet = state.magnet;
chart.styleDefaults = state.styleDefaults;
window.chart = chart; // untuk debugging dari konsol

function setTheme(t) {
  state.theme = t; save();
  document.body.classList.toggle('dark', t === 'dark');
  chart.theme = THEMES[t]; chart.invalidate();
}
setTheme(state.theme);

function toast(msg, ms = 2200) {
  const el = $('#toast'); el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add('hidden'), ms);
}

// ---------- Data ----------
let pollTimer = null, loadSeq = 0;
async function loadChart() {
  const seq = ++loadSeq;
  clearInterval(pollTimer);
  renderHeader();
  chart.setData([], {});
  chart.setDrawings(JSON.parse(localStorage.getItem(`ac:drawings:${state.symbol}`) || '[]'));
  try {
    const d = await ds.candles(state.broker, state.symbol, state.tf, 1500);
    if (seq !== loadSeq) return;
    chart.setData(d.candles, { tfMs: TF_MS[state.tf], digits: d.digits });
    setSource(d.source);
    updateLegend();
    pollTimer = setInterval(poll, 2000);
  } catch (e) {
    toast('Gagal memuat data: ' + e.message, 5000);
  }
}
async function poll() {
  const seq = loadSeq;
  try {
    const d = await ds.candles(state.broker, state.symbol, state.tf, 3);
    if (seq !== loadSeq) return;
    chart.updateLast(d.candles);
    if (!hoverInfo) updateLegend();
    renderOverview();
  } catch { /* abaikan kegagalan sementara */ }
}
function setSource(src) {
  const b = $('#srcBadge');
  b.className = 'src-badge ' + src;
  b.textContent = src === 'live' ? '● LIVE' : 'DATA DEMO';
  b.title = src === 'live' ? 'Data langsung dari broker' : 'Kredensial broker belum diisi — menampilkan data sintetis, bukan harga pasar asli. Ketuk untuk membuka Pengaturan.';
}

// ---------- Header ----------
function symIconHtml(s) {
  const info = symInfo(s) || { icon: 'fx' };
  const map = {
    gold: ['#d4a017', 'Au'], silver: ['#9e9e9e', 'Ag'], btc: ['#f7931a', '₿'], eth: ['#627eea', 'Ξ'],
    index: ['#2962ff', '▲'], oil: ['#37474f', '◆'], usd: ['#1b5e20', '$'],
  };
  let [bg, ch] = map[info.icon] || ['#3f51b5', ({ EUR: '€', GBP: '£', USD: '$', AUD: 'A$', NZD: 'N$', JPY: '¥' })[s.slice(0, 3)] || s[0]];
  return `<span class="sym-icon" style="background:${bg}">${ch}</span>`;
}
function renderHeader() {
  $('#symIcon').outerHTML = symIconHtml(state.symbol).replace('class="sym-icon"', 'id="symIcon" class="sym-icon"');
  $('#symName').textContent = state.symbol;
  $('#symBroker').textContent = BROKERS[state.broker];
  document.querySelectorAll('#tfBar button').forEach(b => b.classList.toggle('on', b.dataset.tf === state.tf));
  $('#tfSelect').value = state.tf;
  $('#chartType').value = state.chartType;
  document.title = `${state.symbol} · ${BROKERS[state.broker]} — LokiChart`;
  renderWatchlist();
}
$('#tfBar').innerHTML = TFS.map(([v, l]) => `<button data-tf="${v}">${l}</button>`).join('');
$('#tfBar').insertAdjacentHTML('afterend', `<select id="tfSelect">${TFS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`);
$('#tfBar').onclick = e => { const tf = e.target.dataset.tf; if (tf) { state.tf = tf; save(); loadChart(); } };
$('#tfSelect').onchange = e => { state.tf = e.target.value; save(); loadChart(); };
$('#chartType').onchange = e => { state.chartType = chart.chartType = e.target.value; save(); chart.invalidate(); };

const IND = [['volume', 'Volume', '#26a69a'], ['sma20', 'SMA 20', '#ff9800'], ['ema50', 'EMA 50', '#2962ff'], ['ema200', 'EMA 200', '#9c27b0'], ['bb', 'Bollinger Bands (20, 2)', '#2962ff']];
$('#indMenu').innerHTML = IND.map(([k, n, c]) => `<label><input type="checkbox" data-k="${k}" ${state.indicators[k] ? 'checked' : ''}/> <span class="sw" style="background:${c}"></span> ${n}</label>`).join('');
$('#indMenu').onchange = e => { state.indicators[e.target.dataset.k] = e.target.checked; save(); chart.invalidate(); };
$('#indBtn').onclick = e => {
  const m = $('#indMenu'), r = e.currentTarget.getBoundingClientRect();
  m.style.left = r.left + 'px'; m.style.top = r.bottom + 4 + 'px';
  m.classList.toggle('hidden'); e.stopPropagation();
};
document.addEventListener('click', e => { if (!e.target.closest('#indMenu')) $('#indMenu').classList.add('hidden'); });

$('#undoBtn').innerHTML = icon(IC.undo); $('#redoBtn').innerHTML = icon(IC.redo);
$('#themeBtn').innerHTML = icon(IC.theme); $('#shotBtn').innerHTML = icon(IC.camera);
$('#fullBtn').innerHTML = icon(IC.full); $('#setBtn').innerHTML = icon(IC.gear); $('#closeSet').innerHTML = icon(IC.close); $('#wlBtn').innerHTML = icon(IC.list);
$('#closeDraw').innerHTML = icon(IC.close); $('#closeSearch').innerHTML = icon(IC.back);
$('.search-ico').innerHTML = icon(IC.search); $('#wlAdd').innerHTML = icon(IC.plus);
$('#undoBtn').onclick = () => chart.undo();
$('#redoBtn').onclick = () => chart.redo();
$('#themeBtn').onclick = () => setTheme(state.theme === 'light' ? 'dark' : 'light');
$('#shotBtn').onclick = () => {
  const a = document.createElement('a');
  a.href = chart.screenshot(); a.download = `${state.symbol}_${state.tf}_${Date.now()}.png`; a.click();
  toast('Gambar chart disimpan');
};
$('#fullBtn').onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
$('#wlBtn').onclick = () => { $('#watchlist').classList.toggle('hidden'); $('#wlBtn').classList.toggle('on'); chart.resize(); };
if (window.innerWidth > 1100) { $('#watchlist').classList.remove('hidden'); $('#wlBtn').classList.add('on'); }

// ---------- Legend (OHLC) ----------
let hoverInfo = null;
chart.on('crosshair', info => { hoverInfo = info; updateLegend(); });
chart.canvas.addEventListener('pointerleave', () => { hoverInfo = null; updateLegend(); });
function updateLegend() {
  const c = hoverInfo || chart.candles.at(-1);
  const prev = hoverInfo ? hoverInfo.prev : chart.candles.at(-2);
  const name = `<span class="t">${state.symbol} · ${TFS.find(t => t[0] === state.tf)[1]} · ${BROKERS[state.broker]}</span>`;
  if (!c) { $('#legend').innerHTML = name; return; }
  const cls = c.c >= c.o ? 'up' : 'down';
  const ch = prev ? c.c - prev.c : 0, chp = prev ? (ch / prev.c) * 100 : 0;
  const f = v => chart.fmt(v);
  $('#legend').innerHTML = `${name}
    <span>O<span class="v ${cls}"> ${f(c.o)}</span></span><span>H<span class="v ${cls}"> ${f(c.h)}</span></span>
    <span>L<span class="v ${cls}"> ${f(c.l)}</span></span><span>C<span class="v ${cls}"> ${f(c.c)}</span></span>
    <span class="v ${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '+' : ''}${f(ch)} (${ch >= 0 ? '+' : ''}${chp.toFixed(2)}%)</span>`;
}

// ---------- Rail (bilah alat kiri) ----------
const QUICK = ['trendline', 'hline', 'parallel', 'fibret', 'xabcd', 'ewimpulse', 'longpos', 'rect', 'text'];
function renderRail() {
  const magnetLabel = { off: '', weak: 'L', strong: 'K' }[chart.magnet];
  $('#rail').innerHTML = `
    <button class="icon-btn ${!chart.tool ? 'on' : ''}" data-act="cursor" title="Kursor">${icon(IC.cursor)}</button>
    ${QUICK.map(id => `<button class="icon-btn ${chart.tool === id ? 'on' : ''}" data-tool="${id}" title="${TOOLS[id].name}">${icon(TOOLS[id].icon)}</button>`).join('')}
    <button class="icon-btn ${!$('#drawPanel').classList.contains('hidden') ? 'on' : ''}" data-act="panel" title="Semua alat gambar">${icon(IC.all)}</button>
    <div class="sep"></div>
    <button class="icon-btn ${chart.tool === 'measure' ? 'on' : ''}" data-tool="measure" title="Pengukuran">${icon(TOOLS.measure.icon)}</button>
    <button class="icon-btn ${chart.tool === 'zoomin' ? 'on' : ''}" data-act="zoomin" title="Perbesar (seret area)">${icon(UTILITIES.find(u => u.id === 'zoomin').icon)}</button>
    <button class="icon-btn ${chart.magnet !== 'off' ? 'on' : ''}" data-act="magnet" title="Magnet: ${chart.magnet}">${icon(UTILITIES.find(u => u.id === 'magnet').icon)}<span class="badge">${magnetLabel}</span></button>
    <button class="icon-btn ${chart.stay ? 'on' : ''}" data-act="stay" title="Tetap menggambar">${icon(UTILITIES.find(u => u.id === 'stay').icon)}</button>
    <button class="icon-btn ${chart.lockAll ? 'on' : ''}" data-act="lock" title="Kunci seluruh gambar">${icon(IC.lock)}</button>
    <button class="icon-btn ${chart.hidden ? 'on' : ''}" data-act="hide" title="Sembunyikan gambar">${icon(UTILITIES.find(u => u.id === 'hide').icon)}</button>
    <button class="icon-btn ${chart.tool === 'eraser' ? 'on' : ''}" data-act="eraser" title="Penghapus">${icon(UTILITIES.find(u => u.id === 'eraser').icon)}</button>
    <button class="icon-btn" data-act="clear" title="Hapus semua gambar">${icon(IC.trash)}</button>`;
}
$('#rail').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tool) return selectTool(chart.tool === b.dataset.tool ? null : b.dataset.tool);
  runUtility(b.dataset.act);
};
function selectTool(id) {
  chart.setTool(id);
  renderRail(); renderToolGrid();
  if (id && TOOLS[id]) toast(`${TOOLS[id].name}: ketuk ${TOOLS[id].n} titik pada chart`, 1800);
}
chart.on('tool', () => { renderRail(); renderToolGrid(); });

function runUtility(act) {
  switch (act) {
    case 'cursor': selectTool(null); break;
    case 'panel': $('#drawPanel').classList.toggle('hidden'); renderRail(); renderToolGrid(); break;
    case 'measure': selectTool(chart.tool === 'measure' ? null : 'measure'); break;
    case 'eraser': selectTool(chart.tool === 'eraser' ? null : 'eraser'); break;
    case 'zoomin': selectTool(chart.tool === 'zoomin' ? null : 'zoomin'); if (chart.tool) toast('Seret area pada chart untuk memperbesar'); break;
    case 'zoomout': chart.zoomOut(); break;
    case 'stay': chart.stay = !chart.stay; toast(chart.stay ? 'Tetap menggambar: AKTIF' : 'Tetap menggambar: NONAKTIF'); break;
    case 'hide': chart.hidden = !chart.hidden; chart.selected = null; showDrawBar(null); chart.invalidate(); break;
    case 'lock': chart.lockAll = !chart.lockAll; toast(chart.lockAll ? 'Semua gambar dikunci' : 'Kunci gambar dibuka'); break;
    case 'magnet': {
      const order = ['off', 'weak', 'strong'];
      chart.magnet = state.magnet = order[(order.indexOf(chart.magnet) + 1) % 3]; save();
      toast({ off: 'Magnet: mati', weak: 'Magnet Lemah: menempel ke OHLC terdekat', strong: 'Magnet Kuat: selalu menempel ke OHLC' }[chart.magnet]);
      break;
    }
    case 'clear':
      if (chart.drawings.length && confirm(`Hapus semua gambar (${chart.drawings.length}) di ${state.symbol}?`)) chart.clearDrawings();
      break;
  }
  renderRail(); renderToolGrid();
}

// ---------- Panel alat gambar ----------
function renderToolTabs() {
  $('#toolTabs').innerHTML = CATEGORIES.map(([k, n]) => `<button data-k="${k}" class="${state.panelTab === k ? 'on' : ''}">${n}</button>`).join('');
}
$('#toolTabs').onclick = e => { const k = e.target.dataset.k; if (k) { state.panelTab = k; save(); renderToolTabs(); renderToolGrid(); } };
$('#toolSearch').oninput = renderToolGrid;
$('#closeDraw').onclick = () => { $('#drawPanel').classList.add('hidden'); renderRail(); };

function utilState(u) {
  switch (u.id) {
    case 'measure': return chart.tool === 'measure';
    case 'eraser': return chart.tool === 'eraser';
    case 'zoomin': return chart.tool === 'zoomin';
    case 'stay': return chart.stay;
    case 'hide': return chart.hidden;
    case 'lock': return chart.lockAll;
    case 'magnet': return chart.magnet !== 'off';
    default: return false;
  }
}
function renderToolGrid() {
  const q = $('#toolSearch').value.trim().toLowerCase();
  let html = '';
  if (!q && state.panelTab === 'peralatan') {
    html = UTILITIES.map(u => {
      const name = u.id === 'magnet' ? { off: 'Magnet (Mati)', weak: 'Magnet Lemah', strong: 'Magnet Kuat' }[chart.magnet] : u.id === 'lock' && chart.lockAll ? 'Buka kunci gambar' : u.id === 'hide' && chart.hidden ? 'Tampilkan gambar' : u.name;
      const dis = u.id === 'zoomout' && !chart.zoomStack.length;
      return `<div class="tile ${utilState(u) ? 'on' : ''} ${dis ? 'disabled' : ''} ${u.kind === 'action' || u.kind === 'toggle' || u.kind === 'magnet' ? 'flat' : ''}" data-util="${u.id}">
        ${icon(u.icon)}<span>${name}</span>${u.id === 'magnet' || u.id === 'clear' || u.id === 'hide' ? '<span class="more">⋮</span>' : ''}</div>`;
    }).join('');
  } else {
    const ids = Object.keys(TOOLS).filter(id => {
      const t = TOOLS[id];
      if (q) return t.name.toLowerCase().includes(q);
      if (state.panelTab === 'favorit') return state.favorites.includes(id);
      return t.cat === state.panelTab;
    });
    html = ids.map(id => `<div class="tile ${chart.tool === id ? 'on' : ''}" data-tool="${id}">
        <button class="star ${state.favorites.includes(id) ? 'fav' : ''}" data-star="${id}" title="Favorit">★</button>
        ${icon(TOOLS[id].icon)}<span>${TOOLS[id].name}</span></div>`).join('') ||
      `<div class="empty">${state.panelTab === 'favorit' ? 'Belum ada favorit. Ketuk ★ pada alat untuk menambahkannya.' : 'Tidak ada alat yang cocok.'}</div>`;
  }
  $('#toolGrid').innerHTML = html;
}
$('#toolGrid').onclick = e => {
  const star = e.target.closest('[data-star]');
  if (star) {
    const id = star.dataset.star;
    state.favorites = state.favorites.includes(id) ? state.favorites.filter(x => x !== id) : [...state.favorites, id];
    save(); renderToolGrid(); return;
  }
  const t = e.target.closest('.tile'); if (!t) return;
  if (t.dataset.util) return runUtility(t.dataset.util);
  if (t.dataset.tool) {
    selectTool(chart.tool === t.dataset.tool ? null : t.dataset.tool);
    if (window.innerWidth < 820 && chart.tool) { $('#drawPanel').classList.add('hidden'); renderRail(); }
  }
};

// ---------- Bar gaya gambar terpilih ----------
const COLORS = ['#2962ff', '#f23645', '#089981', '#ff9800', '#9c27b0', '#131722', '#00bcd4', '#e91e63', '#4caf50', '#795548', '#787b86', '#ffeb3b'];
function showDrawBar(d) {
  const bar = $('#drawBar');
  if (!d || chart.hidden) { bar.classList.add('hidden'); return; }
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
  const b = chart.boundsOf(d), wrap = $('#chartWrap').getBoundingClientRect();
  const bw = bar.offsetWidth || 300;
  let x = Math.min(Math.max(8, (b.x0 + b.x1) / 2 - bw / 2), wrap.width - bw - 90);
  let y = b.y0 - 56; if (y < 40) y = Math.min(b.y1 + 16, wrap.height - 90);
  bar.style.left = x + 'px'; bar.style.top = Math.max(40, y) + 'px';
}
chart.on('select', d => {
  if (d && $('#drawBar').dataset.id === d.id && !$('#drawBar').classList.contains('hidden')) positionDrawBar(d);
  else { showDrawBar(d); $('#drawBar').dataset.id = d?.id || ''; }
});
$('#drawBar').onclick = e => {
  const d = chart.selected; if (!d) return;
  const c = e.target.closest('[data-c]');
  const remember = () => { state.styleDefaults[d.tool] = { ...d.style }; save(); };
  if (c) { chart.snapshot(); d.style.color = c.dataset.c; remember(); chart.commit(); return showDrawBar(d); }
  const a = e.target.closest('[data-a]')?.dataset.a;
  if (!a) return;
  if (a === 'color') return $('#drawBar .colors').classList.toggle('open');
  chart.snapshot();
  if (a === 'width') d.style.width = d.style.width >= 4 ? 1 : d.style.width + 1;
  if (a === 'dash') d.style.dash = !d.style.dash?.length ? [6, 4] : d.style.dash[0] > 2 ? [1, 3] : [];
  if (a === 'extend') d.extend = !d.extend;
  if (a === 'lock') d.locked = !d.locked;
  if (a === 'text') { const s = prompt('Ubah teks:', d.text || ''); if (s != null) d.text = s; }
  if (a === 'clone') { chart.history.pop(); return chart.cloneDrawing(d); }
  if (a === 'delete') { chart.history.pop(); return chart.removeDrawing(d); }
  if (['width', 'dash'].includes(a)) remember();
  chart.commit(); showDrawBar(d);
};
chart.on('drawings', list => {
  localStorage.setItem(`ac:drawings:${state.symbol}`, JSON.stringify(list.filter(d => !TOOLS[d.tool].temp)));
});

// tombol ke bar terbaru
setInterval(() => {
  const far = chart.scroll < chart.candles.length - 3;
  $('#goLatest').classList.toggle('hidden', !far);
  if (chart.selected) positionDrawBar(chart.selected);
}, 300);
$('#goLatest').onclick = () => chart.goLatest();

// ---------- Keyboard ----------
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? chart.redo() : chart.undo(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); chart.redo(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && chart.selected) chart.removeDrawing(chart.selected);
  else if (e.key === 'Escape') { selectTool(null); chart.selected = null; showDrawBar(null); chart.invalidate(); }
  else if (e.altKey && e.key.toLowerCase() === 't') selectTool('trendline');
  else if (e.altKey && e.key.toLowerCase() === 'h') selectTool('hline');
  else if (e.altKey && e.key.toLowerCase() === 'f') selectTool('fibret');
});

// ---------- Daftar pantau ----------
const quotes = {};
async function refreshQuotes() {
  await Promise.all(state.watchlist.map(async ([s, b]) => {
    try {
      const d = await ds.candles(b, s, '1D', 2);
      const [p, c] = d.candles.length > 1 ? d.candles.slice(-2) : [d.candles[0], d.candles[0]];
      quotes[`${s}|${b}`] = { last: c.c, prev: p.c, open: c.o, high: c.h, low: c.l, digits: d.digits, source: d.source };
    } catch { /* abaikan */ }
  }));
  renderWatchlist(); renderOverview();
}
const fmtP = (v, dg) => v == null ? '—' : Number(v).toLocaleString('id-ID', { minimumFractionDigits: dg, maximumFractionDigits: dg });
function renderWatchlist() {
  $('#wlList').innerHTML = state.watchlist.map(([s, b]) => {
    const q = quotes[`${s}|${b}`];
    const ch = q ? ((q.last - q.prev) / q.prev) * 100 : null;
    const cls = ch == null ? '' : ch >= 0 ? 'up' : 'down';
    return `<div class="wl-row ${s === state.symbol && b === state.broker ? 'on' : ''}" data-s="${s}" data-b="${b}">
      <div class="s">${symIconHtml(s)}<div><b>${s}</b><small>${BROKERS[b]}</small></div></div>
      <span class="n">${q ? fmtP(q.last, q.digits) : '—'}</span>
      <span class="n ${cls}">${ch == null ? '' : (ch >= 0 ? '+' : '') + ch.toFixed(2) + '%'}</span></div>`;
  }).join('');
}
$('#wlList').onclick = e => {
  const r = e.target.closest('.wl-row'); if (!r) return;
  state.symbol = r.dataset.s; state.broker = r.dataset.b; save(); loadChart();
};
$('#wlList').oncontextmenu = e => {
  const r = e.target.closest('.wl-row'); if (!r) return;
  e.preventDefault();
  if (confirm(`Hapus ${r.dataset.s} (${BROKERS[r.dataset.b]}) dari daftar pantau?`)) {
    state.watchlist = state.watchlist.filter(([s, b]) => !(s === r.dataset.s && b === r.dataset.b)); save(); renderWatchlist();
  }
};
function renderOverview() {
  const info = symInfo(state.symbol, state.broker);
  const q = quotes[`${state.symbol}|${state.broker}`];
  const last = chart.candles.at(-1);
  if (!info) { $('#overview').innerHTML = ''; return; }
  const price = last?.c ?? q?.last, dg = info.digits;
  const ch = q && price != null ? price - q.prev : null;
  $('#overview').innerHTML = `
    <div style="display:flex;gap:10px;align-items:center">${symIconHtml(state.symbol)}<div><b>${info.desc}</b><br><small style="color:var(--muted)">${state.symbol} · ${BROKERS[state.broker]}</small></div></div>
    <div class="big">${fmtP(price, dg)}</div>
    ${ch != null ? `<div class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '+' : ''}${fmtP(ch, dg)} (${ch >= 0 ? '+' : ''}${((ch / q.prev) * 100).toFixed(2)}%) hari ini</div>` : ''}
    <h4 style="margin:14px 0 6px">Poin data penting</h4>
    <div class="row"><span>Penutupan sebelumnya</span><span>${fmtP(q?.prev, dg)}</span></div>
    <div class="row"><span>Buka</span><span>${fmtP(q?.open, dg)}</span></div>
    <div class="row"><span>Rentang hari</span><span>${q ? `${fmtP(q.low, dg)} — ${fmtP(q.high, dg)}` : '—'}</span></div>`;
}

// ---------- Pencarian simbol ----------
const SYM_TABS = [['all', 'Seluruh'], ['forex', 'Forex'], ['commodity', 'Komoditas'], ['crypto', 'Kripto'], ['index', 'Indeks'], ['oanda', 'OANDA'], ['forexcom', 'FOREX.com']];
let symTab = 'all';
function openSearch() {
  $('#searchModal').classList.remove('hidden');
  $('#symSearch').value = ''; renderSymList();
  setTimeout(() => $('#symSearch').focus(), 50);
}
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
  state.symbol = s; state.broker = b; save();
  $('#searchModal').classList.add('hidden');
  loadChart();
};
$('#symbolBtn').onclick = openSearch;
$('#wlAdd').onclick = openSearch;
$('#closeSearch').onclick = () => $('#searchModal').classList.add('hidden');
$('#searchModal').onclick = e => { if (e.target.id === 'searchModal') $('#searchModal').classList.add('hidden'); };
document.addEventListener('keydown', e => {
  // ketik huruf langsung membuka pencarian simbol
  if (!e.target.matches('input, textarea, select') && /^[a-z]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey && $('#searchModal').classList.contains('hidden')) {
    openSearch(); $('#symSearch').value = e.key.toUpperCase(); renderSymList(); e.preventDefault();
  }
});

// ---------- Pengaturan (kredensial broker) ----------
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
  loadChart(); refreshQuotes();
};

// ---------- Mulai ----------
(async function init() {
  await ds.init();
  if (isNative()) $('#shotBtn').classList.add('hidden');
  try { SYMBOLS = await ds.symbols(); } catch (e) { toast('Gagal memuat daftar simbol'); }
  if (!symInfo(state.symbol, state.broker)) { state.symbol = 'XAUUSD'; state.broker = 'oanda'; }
  renderToolTabs(); renderToolGrid(); renderRail();
  await loadChart();
  refreshQuotes();
  setInterval(refreshQuotes, 15000);
})();
