// Halaman Jelajahi (penggerak pasar, peta panas) dan Menu (pengaturan aplikasi)
import { ds, isNative } from './datasource.js';
import { VERSION } from './version.js';

const CATS = [['all', 'Semua'], ['forex', 'Forex'], ['commodity', 'Komoditas'], ['index', 'Indeks'], ['crypto', 'Kripto']];

export class Explore {
  constructor(el, { symbols, fmt, iconHtml, open }) {
    this.el = el; this.symbols = symbols; this.fmt = fmt; this.iconHtml = iconHtml; this.open = open;
    this.cat = 'all'; this.data = new Map(); this.at = 0; this.broker = 'oanda';
  }
  async show(broker = this.broker) {
    const changed = broker !== this.broker; this.broker = broker;
    if (changed) this.data.clear();
    this.render();
    if (Date.now() - this.at < 5 * 60e3 && !changed) return;
    this.at = Date.now();
    const list = this.symbols().filter(s => s.broker === broker);
    this.el.querySelector('.ex-status').textContent = `Memuat ${list.length} simbol…`;
    let done = 0;
    await Promise.all(list.map(async (s, k) => {
      await new Promise(r => setTimeout(r, k * 40)); // jangan membanjiri API broker
      try {
        const d = await ds.candles(broker, s.symbol, '1D', 30);
        const c = d.candles; if (c.length < 2) return;
        const last = c.at(-1), prev = c.at(-2);
        const vol = c.slice(-20).reduce((a, x) => a + (x.h - x.l) / x.c, 0) / Math.min(20, c.length);
        this.data.set(s.symbol, { s, last: last.c, chg: ((last.c - prev.c) / prev.c) * 100, vol: vol * 100, spark: c.map(x => x.c), digits: d.digits, source: d.source });
      } catch { /* abaikan */ }
      done++;
      if (done % 8 === 0) this.render();
    }));
    this.render();
  }
  render() {
    const rows = [...this.data.values()].filter(r => this.cat === 'all' || r.s.type.includes(this.cat));
    const card = r => `<div class="ex-card" data-s="${r.s.symbol}"><div class="top">${this.iconHtml(r.s.symbol)}<div><b>${r.s.symbol}</b><br><small class="note">${r.s.desc}</small></div></div>
      <div class="px">${this.fmt(r.last, r.digits)} <small class="${r.chg >= 0 ? 'up' : 'down'}">${r.chg >= 0 ? '+' : ''}${r.chg.toFixed(2)}%</small></div><canvas data-spark="${r.s.symbol}"></canvas></div>`;
    const up = [...rows].sort((a, b) => b.chg - a.chg).slice(0, 6);
    const dn = [...rows].sort((a, b) => a.chg - b.chg).slice(0, 6);
    const vola = [...rows].sort((a, b) => b.vol - a.vol).slice(0, 6);
    const heat = [...rows].sort((a, b) => b.chg - a.chg).map(r => {
      const k = Math.max(-1, Math.min(1, r.chg / 2)), col = k >= 0 ? `rgba(8,153,129,${0.35 + k * 0.65})` : `rgba(242,54,69,${0.35 - k * 0.65})`;
      return `<div data-s="${r.s.symbol}" style="background:${col}"><b>${r.s.symbol}</b>${r.chg >= 0 ? '+' : ''}${r.chg.toFixed(2)}%</div>`;
    }).join('');
    const demo = rows.some(r => r.source === 'demo');
    this.el.innerHTML = `<div class="chips">${CATS.map(([k, n]) => `<button data-cat="${k}" class="${this.cat === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="note ex-status">${demo ? 'Menampilkan DATA DEMO — isi akun broker di Menu untuk harga asli.' : ''}</div>
      <div class="ex-sec"><h3>Kenaikan terbesar</h3></div><div class="ex-grid">${up.map(card).join('') || '<div class="empty">Memuat…</div>'}</div>
      <div class="ex-sec"><h3>Penurunan terbesar</h3></div><div class="ex-grid">${dn.map(card).join('')}</div>
      <div class="ex-sec"><h3>Paling volatil (rata-rata rentang 20 hari)</h3></div><div class="ex-grid">${vola.map(card).join('')}</div>
      <div class="ex-sec"><h3>Peta panas hari ini</h3></div><div class="heat">${heat}</div>
      <p class="note">Berita, kalender ekonomi, dan ide komunitas belum tersedia karena OANDA/FOREX.com tidak menyediakan data tersebut.</p>`;
    this.el.querySelectorAll('canvas[data-spark]').forEach(cv => spark(cv, this.data.get(cv.dataset.spark)));
    this.el.onclick = e => {
      const c = e.target.closest('[data-cat]'); if (c) { this.cat = c.dataset.cat; return this.render(); }
      const s = e.target.closest('[data-s]'); if (s) this.open(s.dataset.s, this.broker);
    };
  }
}
function spark(cv, r) {
  if (!r) return;
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 150, H = 34;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const v = r.spark, lo = Math.min(...v), hi = Math.max(...v);
  ctx.strokeStyle = r.chg >= 0 ? '#089981' : '#f23645'; ctx.lineWidth = 1.5; ctx.beginPath();
  v.forEach((x, i) => { const X = (i / (v.length - 1)) * W, Y = H - 2 - ((x - lo) / (hi - lo || 1)) * (H - 4); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
  ctx.stroke();
}

// ---------- Menu / Pengaturan ----------
export class MenuPage {
  constructor(el, api) { this.el = el; this.api = api; this.wake = null; }
  async setKeepAwake(on) {
    this.api.state.keepAwake = on; this.api.save();
    try {
      if (on && 'wakeLock' in navigator) { this.wake = await navigator.wakeLock.request('screen'); }
      else if (!on && this.wake) { await this.wake.release(); this.wake = null; }
    } catch { /* tidak didukung */ }
    this.render();
  }
  render() {
    const st = this.api.state;
    const item = (id, name, sub, right = '›') => `<div class="menu-item" data-m="${id}"><div class="nm">${name}${sub ? `<small>${sub}</small>` : ''}</div><span class="val">${right}</span></div>`;
    const sw = on => `<span class="switch ${on ? 'on' : ''}"></span>`;
    this.el.innerHTML = `
      <div class="menu-list">
        ${item('broker', 'Akun broker', 'Token OANDA & akun FOREX.com', this.api.status())}
      </div>
      <div class="menu-list">
        ${item('theme', 'Tema', '', st.theme === 'dark' ? 'Gelap' : 'Terang')}
        ${item('awake', 'Layar tetap menyala', 'Saat aplikasi terbuka', sw(st.keepAwake))}
        ${item('rail', 'Bilah alat gambar di kiri', 'Akses cepat alat gambar di chart', sw(st.rail))}
        ${item('chart', 'Pengaturan chart', 'Warna candle, latar, grid, garis harga')}
        ${item('notif', 'Notifikasi peringatan', 'Izinkan notifikasi untuk alarm harga')}
      </div>
      <div class="menu-list">
        ${item('reset', 'Hapus data aplikasi', 'Gambar, indikator, alarm, daftar pantau', '')}
        ${item('about', 'Tentang LokiChart', `Versi ${VERSION}${isNative() ? ' · Android' : ' · Web'}`, '')}
      </div>`;
    this.el.onclick = e => {
      const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return;
      if (m === 'broker') this.api.openBroker();
      if (m === 'theme') { this.api.setTheme(st.theme === 'dark' ? 'light' : 'dark'); this.render(); }
      if (m === 'awake') this.setKeepAwake(!st.keepAwake);
      if (m === 'rail') { st.rail = !st.rail; this.api.save(); this.api.applyRail(); this.render(); }
      if (m === 'chart') this.api.openChartSettings();
      if (m === 'notif') this.api.askNotify();
      if (m === 'reset' && confirm('Hapus semua data LokiChart di perangkat ini (gambar, indikator, alarm, daftar pantau, kredensial)?')) { localStorage.clear(); location.reload(); }
      if (m === 'about') this.api.toast(`LokiChart ${VERSION} — data candle OANDA & FOREX.com`);
    };
  }
}
