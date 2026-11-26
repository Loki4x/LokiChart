// Panel ikhtisar simbol: grafik garis per periode, perubahan, poin data penting, dan musiman.
import { ds } from './datasource.js';

const PERIODS = [
  ['1D', '1H', '5m', 288], ['5D', '5H', '30m', 240], ['1M', '1B', '4h', 186], ['3M', '3B', '1D', 92],
  ['YTD', 'YTD', '1D', 370], ['1Y', '1T', '1D', 370], ['5Y', '5T', '1W', 262], ['ALL', 'Seluruh', '1W', 2000],
];
const YEAR_COLORS = ['#2962ff', '#ff9800', '#089981', '#9c27b0'];
const cache = new Map();
async function get(broker, symbol, tf, count) {
  const k = `${broker}|${symbol}|${tf}|${count}`, hit = cache.get(k);
  if (hit && Date.now() - hit.at < 60000) return hit.d;
  const d = await ds.candles(broker, symbol, tf, count);
  cache.set(k, { at: Date.now(), d });
  return d;
}

export class Overview {
  constructor(el, { fmt, iconHtml, brokers }) {
    this.el = el; this.fmt = fmt; this.iconHtml = iconHtml; this.brokers = brokers;
    this.period = '1D'; this.key = null;
  }
  async show(info, broker, livePrice) {
    if (!info) { this.el.innerHTML = ''; return; }
    const key = `${info.symbol}|${broker}`;
    const first = this.key !== key;
    this.key = key; this.info = info; this.broker = broker;
    if (first) this._skeleton();
    this._price(livePrice);
    if (first || Date.now() - (this.loadedAt || 0) > 60000) {
      this.loadedAt = Date.now();
      try {
        const [daily, all] = await Promise.all([get(broker, info.symbol, '1D', 1100), get(broker, info.symbol, '1W', 2000)]);
        if (this.key !== key) return;
        this.daily = daily.candles; this.all = all.candles;
        this._price(livePrice); this._stats(); this._season(); this._period();
      } catch (e) { this.el.querySelector('.ov-err').textContent = 'Gagal memuat ikhtisar: ' + e.message; }
    }
  }
  _skeleton() {
    const { info } = this;
    this.el.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center">${this.iconHtml(info.symbol)}<div><b>${info.desc}</b><br><small style="color:var(--muted)">${info.symbol} · ${this.brokers[this.broker]}</small></div></div>
      <div class="big ov-price">—</div>
      <div class="ov-day"></div>
      <div class="ov-all" style="font-size:12px"></div>
      <div class="periods">${PERIODS.map(([k, l]) => `<button data-p="${k}" class="${k === this.period ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="ov-pchg" style="font-size:12px;margin-bottom:4px"></div>
      <canvas class="ov-line" height="150"></canvas>
      <div class="ov-err" style="color:var(--down);font-size:12px"></div>
      <h4>Poin data penting</h4>
      <div class="ov-stats"></div>
      <h4>Musiman</h4>
      <div class="lgd ov-lgd"></div>
      <canvas class="ov-season" height="150"></canvas>`;
    this.el.querySelector('.periods').onclick = e => {
      const p = e.target.dataset.p; if (!p) return;
      this.period = p;
      this.el.querySelectorAll('.periods button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
      this._period();
    };
  }
  _price(live) {
    const d = this.daily, dg = this.info.digits;
    const last = live ?? d?.at(-1)?.c;
    this.el.querySelector('.ov-price').textContent = last != null ? this.fmt(last, dg) : '—';
    if (d?.length > 1 && last != null) {
      const prev = d.at(-2).c, ch = last - prev;
      const el = this.el.querySelector('.ov-day');
      el.className = 'ov-day ' + (ch >= 0 ? 'up' : 'down');
      el.textContent = `${ch >= 0 ? '+' : ''}${this.fmt(ch, dg)} (${ch >= 0 ? '+' : ''}${((ch / prev) * 100).toFixed(2)}%) hari ini`;
    }
    if (this.all?.length && last != null) {
      const f = this.all[0].o, ch = last - f, el = this.el.querySelector('.ov-all');
      el.className = 'ov-all ' + (ch >= 0 ? 'up' : 'down');
      el.textContent = `${ch >= 0 ? '+' : ''}${this.fmt(ch, dg)} (${ch >= 0 ? '+' : ''}${((ch / f) * 100).toFixed(2)}%) sepanjang data tersedia (sejak ${new Date(this.all[0].t).getFullYear()})`;
    }
  }
  _stats() {
    const d = this.daily, dg = this.info.digits; if (!d?.length) return;
    const last = d.at(-1), prev = d.at(-2) || last;
    const y = d.slice(-260);
    const hi = Math.max(...y.map(x => x.h)), lo = Math.min(...y.map(x => x.l));
    const rows = [
      ['Penutupan sebelumnya', this.fmt(prev.c, dg)], ['Buka', this.fmt(last.o, dg)],
      ['Rentang hari', `${this.fmt(last.l, dg)} — ${this.fmt(last.h, dg)}`], ['Rentang 52 minggu', `${this.fmt(lo, dg)} — ${this.fmt(hi, dg)}`],
    ];
    this.el.querySelector('.ov-stats').innerHTML = rows.map(([a, b]) => `<div class="row"><span>${a}</span><span>${b}</span></div>`).join('');
  }
  async _period() {
    const [k, , tf, count] = PERIODS.find(p => p[0] === this.period);
    const key = this.key;
    let c;
    try { c = (await get(this.broker, this.info.symbol, tf, count)).candles; } catch (e) { return; }
    if (key !== this.key) return;
    if (k === 'YTD') { const y0 = Date.UTC(new Date().getUTCFullYear(), 0, 1); c = c.filter(x => x.t >= y0); }
    if (k === '1Y') c = c.filter(x => x.t >= Date.now() - 365 * 864e5);
    if (k === '5D') c = c.filter(x => x.t >= Date.now() - 5 * 864e5);
    if (!c.length) return;
    const ch = c.at(-1).c - c[0].o, el = this.el.querySelector('.ov-pchg');
    el.className = 'ov-pchg ' + (ch >= 0 ? 'up' : 'down');
    el.textContent = `${ch >= 0 ? '+' : ''}${this.fmt(ch, this.info.digits)} (${ch >= 0 ? '+' : ''}${((ch / c[0].o) * 100).toFixed(2)}%) dalam periode ini`;
    lineChart(this.el.querySelector('.ov-line'), [{ v: c.map(x => x.c), color: ch >= 0 ? '#089981' : '#f23645', fill: true }], {
      labels: axisLabels(c, k), fmt: v => this.fmt(v, this.info.digits),
    });
  }
  _season() {
    const d = this.daily; if (!d?.length) return;
    const years = [...new Set(d.map(x => new Date(x.t).getUTCFullYear()))].slice(-3);
    const series = years.map((y, k) => {
      const ys = d.filter(x => new Date(x.t).getUTCFullYear() === y); if (!ys.length) return null;
      const base = ys[0].o, v = new Array(366).fill(null);
      for (const x of ys) { const doy = Math.floor((x.t - Date.UTC(y, 0, 1)) / 864e5); v[doy] = ((x.c - base) / base) * 100; }
      return { v, color: YEAR_COLORS[k], year: y, gaps: true };
    }).filter(Boolean);
    this.el.querySelector('.ov-lgd').innerHTML = series.map(s => `<span><i style="background:${s.color}"></i>${s.year}</span>`).join('');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    lineChart(this.el.querySelector('.ov-season'), series, {
      labels: months.map((m, k) => ({ i: Math.floor((k * 365) / 12), s: k % 3 === 0 ? m : '' })), zero: true, fmt: v => v.toFixed(1) + '%', len: 366,
    });
  }
}

function axisLabels(c, k) {
  const n = c.length, out = [];
  for (let j = 0; j < 4; j++) {
    const i = Math.floor((j * (n - 1)) / 3), d = new Date(c[i].t);
    const s = k === '1D' ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : k === '5Y' || k === 'ALL' ? String(d.getFullYear()) : `${d.getDate()}/${d.getMonth() + 1}`;
    out.push({ i, s });
  }
  return out;
}

function lineChart(cv, series, { labels = [], zero = false, fmt = String, len } = {}) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 280, H = 150;
  cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + 'px';
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const dark = document.body.classList.contains('dark');
  const N = len || Math.max(...series.map(s => s.v.length));
  let lo = Infinity, hi = -Infinity;
  for (const s of series) for (const v of s.v) if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  if (zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (!isFinite(lo)) return;
  const pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
  const pw = W - 56, ph = H - 20;
  const X = i => (i / Math.max(1, N - 1)) * pw, Y = v => ((hi - v) / (hi - lo)) * ph;
  ctx.font = '10px system-ui'; ctx.fillStyle = dark ? '#868993' : '#6a6d78'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = dark ? '#2a2e39' : '#eef0f4';
  for (let k = 0; k <= 3; k++) { const v = lo + ((hi - lo) * k) / 3, y = Y(v); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(pw, y); ctx.stroke(); ctx.fillText(fmt(v), pw + 6, y); }
  if (zero) { ctx.strokeStyle = '#9598a1'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(pw, Y(0)); ctx.stroke(); ctx.setLineDash([]); }
  ctx.textAlign = 'center';
  for (const l of labels) if (l.s) ctx.fillText(l.s, Math.min(pw - 14, Math.max(14, X(l.i))), H - 7);
  for (const s of series) {
    ctx.strokeStyle = s.color; ctx.lineWidth = 1.6; ctx.beginPath(); let st = false, first = null, lastX = 0;
    s.v.forEach((v, i) => { if (v == null) return; const x = X(i), y = Y(v); if (!st) { ctx.moveTo(x, y); first = x; st = true; } else ctx.lineTo(x, y); lastX = x; });
    ctx.stroke();
    if (s.fill && st) {
      ctx.lineTo(lastX, ph); ctx.lineTo(first, ph); ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, ph); g.addColorStop(0, s.color + '55'); g.addColorStop(1, s.color + '00');
      ctx.fillStyle = g; ctx.fill();
    }
  }
}
