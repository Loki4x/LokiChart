// Indikator teknikal. Setiap indikator: { name, pane: 'main'|'sub', params: [...], calc(candles, p, ctx) }
// Hasil calc:
//   lines:   [{ v: number[], color, width?, dash?, label? }]   (indeks = indeks bar; boleh melebihi jumlah candle)
//   bands:   [{ a: number[], b: number[], fill | fillUp/fillDown }]
//   hist:    [{ v: number[], colors: string[] }]
//   levels:  [{ p, color, dash? }]          (garis horizontal di pane)
//   segs:    [{ i0, i1, p, color, dash?, label?, labelColor? }]
//   boxes:   [{ i0, i1, top, bot, fill, stroke?, label? }]
//   marks:   [{ i, p, text, color, pos: 'above'|'below' }]
//   range:   [min, max] (opsional untuk pane)

const SRC = {
  close: c => c.c, open: c => c.o, high: c => c.h, low: c => c.l,
  hl2: c => (c.h + c.l) / 2, hlc3: c => (c.h + c.l + c.c) / 3, ohlc4: c => (c.o + c.h + c.l + c.c) / 4,
};
const SRC_OPT = Object.keys(SRC);

export function sma(arr, n) {
  const o = new Array(arr.length).fill(null); let s = 0, cnt = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]; if (v == null) continue;
    s += v; cnt++;
    if (cnt > n) s -= arr[i - n];
    if (cnt >= n) o[i] = s / n;
  }
  return o;
}
export function ema(arr, n) {
  const o = new Array(arr.length).fill(null); const k = 2 / (n + 1); let e = null, cnt = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]; if (v == null) continue;
    cnt++;
    e = e == null ? v : v * k + e * (1 - k);
    if (cnt >= n) o[i] = e;
  }
  return o;
}
function rma(arr, n) {
  const o = new Array(arr.length).fill(null); let e = null, cnt = 0, s = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]; if (v == null) continue;
    cnt++;
    if (cnt <= n) { s += v; if (cnt === n) e = s / n; }
    else e = (e * (n - 1) + v) / n;
    if (cnt >= n) o[i] = e;
  }
  return o;
}
function wma(arr, n) {
  const o = new Array(arr.length).fill(null);
  for (let i = n - 1; i < arr.length; i++) {
    let s = 0, w = 0;
    for (let k = 0; k < n; k++) { s += arr[i - k] * (n - k); w += n - k; }
    o[i] = s / w;
  }
  return o;
}
function stdev(arr, n, mean) {
  return arr.map((_, i) => {
    if (i < n - 1 || mean[i] == null) return null;
    let d = 0; for (let k = i - n + 1; k <= i; k++) d += (arr[k] - mean[i]) ** 2;
    return Math.sqrt(d / n);
  });
}
function trueRange(c) {
  return c.map((x, i) => i ? Math.max(x.h - x.l, Math.abs(x.h - c[i - 1].c), Math.abs(x.l - c[i - 1].c)) : x.h - x.l);
}
const highest = (c, i, n, f) => { let m = -Infinity; for (let k = Math.max(0, i - n + 1); k <= i; k++) m = Math.max(m, f(c[k])); return m; };
const lowest = (c, i, n, f) => { let m = Infinity; for (let k = Math.max(0, i - n + 1); k <= i; k++) m = Math.min(m, f(c[k])); return m; };
const dayKey = (t, tfMs, unit) => Math.floor(t / unit);

const num = (key, label, def, min = 1, max = 500, step = 1) => ({ key, label, type: 'number', def, min, max, step });
const col = (key, label, def) => ({ key, label, type: 'color', def });
const sel = (key, label, def, options) => ({ key, label, type: 'select', def, options });
const bool = (key, label, def) => ({ key, label, type: 'bool', def });

export const INDICATORS = {
  // ================= OVERLAY (pane utama) =================
  volume: {
    name: 'Volume', pane: 'main', short: 'Vol',
    params: [num('ma', 'MA volume (0 = mati)', 20, 0, 200)],
    calc(c, p) {
      const v = c.map(x => x.v || 0);
      return { volume: { v, colors: c.map(x => x.c >= x.o ? 'rgba(8,153,129,.3)' : 'rgba(242,54,69,.3)'), ma: p.ma > 0 ? sma(v, p.ma) : null } };
    },
  },
  sma: {
    name: 'Moving Average Sederhana (SMA)', pane: 'main', short: 'SMA',
    params: [num('period', 'Periode', 20), sel('source', 'Sumber', 'close', SRC_OPT), col('color', 'Warna', '#ff9800')],
    calc: (c, p) => ({ lines: [{ v: sma(c.map(SRC[p.source]), p.period), color: p.color }] }),
  },
  ema: {
    name: 'Moving Average Eksponensial (EMA)', pane: 'main', short: 'EMA',
    params: [num('period', 'Periode', 50), sel('source', 'Sumber', 'close', SRC_OPT), col('color', 'Warna', '#2962ff')],
    calc: (c, p) => ({ lines: [{ v: ema(c.map(SRC[p.source]), p.period), color: p.color }] }),
  },
  wma: {
    name: 'Moving Average Tertimbang (WMA)', pane: 'main', short: 'WMA',
    params: [num('period', 'Periode', 20), sel('source', 'Sumber', 'close', SRC_OPT), col('color', 'Warna', '#e91e63')],
    calc: (c, p) => ({ lines: [{ v: wma(c.map(SRC[p.source]), p.period), color: p.color }] }),
  },
  bb: {
    name: 'Bollinger Bands', pane: 'main', short: 'BB',
    params: [num('period', 'Periode', 20), num('mult', 'Deviasi standar', 2, 0.1, 10, 0.1), col('color', 'Warna', '#2962ff')],
    calc(c, p) {
      const s = c.map(x => x.c), m = sma(s, p.period), sd = stdev(s, p.period, m);
      const up = m.map((v, i) => v == null ? null : v + sd[i] * p.mult), lo = m.map((v, i) => v == null ? null : v - sd[i] * p.mult);
      return { lines: [{ v: m, color: '#ff9800', width: 1 }, { v: up, color: p.color, width: 1 }, { v: lo, color: p.color, width: 1 }], bands: [{ a: up, b: lo, fill: 'rgba(41,98,255,.06)' }] };
    },
  },
  vwap: {
    name: 'VWAP (reset harian)', pane: 'main', short: 'VWAP',
    params: [sel('anchor', 'Reset', 'Hari', ['Hari', 'Minggu', 'Bulan']), bool('bands', 'Pita ±1/2 deviasi', true), col('color', 'Warna', '#9c27b0')],
    calc(c, p) {
      const v = [], u1 = [], l1 = [], u2 = [], l2 = [];
      let pv = 0, vol = 0, pv2 = 0, key = null;
      for (const x of c) {
        const d = new Date(x.t);
        const k = p.anchor === 'Bulan' ? d.getUTCFullYear() * 12 + d.getUTCMonth() : p.anchor === 'Minggu' ? Math.floor((x.t / 86400000 + 3) / 7) : Math.floor(x.t / 86400000);
        if (k !== key) { pv = 0; vol = 0; pv2 = 0; key = k; }
        const tp = (x.h + x.l + x.c) / 3, w = x.v || 1;
        pv += tp * w; vol += w; pv2 += tp * tp * w;
        const m = pv / vol, sd = Math.sqrt(Math.max(0, pv2 / vol - m * m));
        v.push(m); u1.push(m + sd); l1.push(m - sd); u2.push(m + 2 * sd); l2.push(m - 2 * sd);
      }
      const lines = [{ v, color: p.color, width: 2 }];
      if (p.bands) lines.push({ v: u1, color: p.color, width: 1, dash: [4, 4] }, { v: l1, color: p.color, width: 1, dash: [4, 4] }, { v: u2, color: p.color, width: 1, dash: [1, 3] }, { v: l2, color: p.color, width: 1, dash: [1, 3] });
      return { lines, bands: p.bands ? [{ a: u1, b: l1, fill: 'rgba(156,39,176,.05)' }] : [] };
    },
  },
  ichimoku: {
    name: 'Ichimoku Cloud', pane: 'main', short: 'Ichimoku',
    params: [num('conv', 'Tenkan', 9), num('base', 'Kijun', 26), num('span', 'Senkou B', 52), num('disp', 'Pergeseran', 26)],
    calc(c, p) {
      const n = c.length, mid = (i, len) => (highest(c, i, len, x => x.h) + lowest(c, i, len, x => x.l)) / 2;
      const ten = [], kij = [], A = new Array(n + p.disp).fill(null), B = new Array(n + p.disp).fill(null), lag = new Array(n).fill(null);
      for (let i = 0; i < n; i++) {
        ten.push(i >= p.conv - 1 ? mid(i, p.conv) : null);
        kij.push(i >= p.base - 1 ? mid(i, p.base) : null);
        if (ten[i] != null && kij[i] != null) A[i + p.disp - 1] = (ten[i] + kij[i]) / 2;
        if (i >= p.span - 1) B[i + p.disp - 1] = mid(i, p.span);
        if (i - p.disp + 1 >= 0) lag[i - p.disp + 1] = c[i].c;
      }
      return {
        lines: [{ v: ten, color: '#2962ff', width: 1 }, { v: kij, color: '#b71c1c', width: 1 }, { v: lag, color: '#43a047', width: 1 }, { v: A, color: '#4caf50', width: 1 }, { v: B, color: '#f44336', width: 1 }],
        bands: [{ a: A, b: B, fillUp: 'rgba(76,175,80,.15)', fillDown: 'rgba(244,67,54,.15)' }],
      };
    },
  },
  supertrend: {
    name: 'Supertrend', pane: 'main', short: 'ST',
    params: [num('period', 'Periode ATR', 10), num('mult', 'Faktor', 3, 0.1, 20, 0.1)],
    calc(c, p) {
      const atr = rma(trueRange(c), p.period);
      const up = new Array(c.length).fill(null), dn = new Array(c.length).fill(null), marks = [];
      let fu = null, fl = null, trend = 1;
      for (let i = 0; i < c.length; i++) {
        if (atr[i] == null) continue;
        const hl = (c[i].h + c[i].l) / 2;
        let bu = hl + p.mult * atr[i], bl = hl - p.mult * atr[i];
        if (fu != null && !(bu < fu || c[i - 1].c > fu)) bu = fu;
        if (fl != null && !(bl > fl || c[i - 1].c < fl)) bl = fl;
        const prev = trend;
        if (fu != null) { if (trend === -1 && c[i].c > fu) trend = 1; else if (trend === 1 && c[i].c < fl) trend = -1; }
        fu = bu; fl = bl;
        if (trend === 1) up[i] = bl; else dn[i] = bu;
        if (prev !== trend) marks.push({ i, p: trend === 1 ? bl : bu, text: trend === 1 ? 'Beli' : 'Jual', color: trend === 1 ? '#089981' : '#f23645', pos: trend === 1 ? 'below' : 'above' });
      }
      return { lines: [{ v: up, color: '#089981', width: 2 }, { v: dn, color: '#f23645', width: 2 }], marks };
    },
  },
  pivots: {
    name: 'Pivot Points Standar', pane: 'main', short: 'Pivot',
    params: [sel('period', 'Periode', 'Otomatis', ['Otomatis', 'Hari', 'Minggu', 'Bulan']), sel('type', 'Jenis', 'Klasik', ['Klasik', 'Fibonacci', 'Camarilla'])],
    calc(c, p, ctx) {
      const unitName = p.period === 'Otomatis' ? (ctx.tfMs < 3600e3 ? 'Hari' : ctx.tfMs < 86400e3 ? 'Minggu' : 'Bulan') : p.period;
      const key = t => { const d = new Date(t); return unitName === 'Bulan' ? d.getUTCFullYear() * 12 + d.getUTCMonth() : unitName === 'Minggu' ? Math.floor((t / 86400000 + 3) / 7) : Math.floor(t / 86400000); };
      const groups = [];
      for (let i = 0; i < c.length; i++) {
        const k = key(c[i].t), g = groups[groups.length - 1];
        if (!g || g.k !== k) groups.push({ k, i0: i, i1: i, h: c[i].h, l: c[i].l, c: c[i].c });
        else { g.i1 = i; g.h = Math.max(g.h, c[i].h); g.l = Math.min(g.l, c[i].l); g.c = c[i].c; }
      }
      const segs = [];
      for (let g = 1; g < groups.length; g++) {
        const pr = groups[g - 1], cur = groups[g], P = (pr.h + pr.l + pr.c) / 3, R = pr.h - pr.l;
        let lv;
        if (p.type === 'Fibonacci') lv = { P, R1: P + 0.382 * R, R2: P + 0.618 * R, R3: P + R, S1: P - 0.382 * R, S2: P - 0.618 * R, S3: P - R };
        else if (p.type === 'Camarilla') lv = { P, R1: pr.c + R * 1.1 / 12, R2: pr.c + R * 1.1 / 6, R3: pr.c + R * 1.1 / 4, S1: pr.c - R * 1.1 / 12, S2: pr.c - R * 1.1 / 6, S3: pr.c - R * 1.1 / 4 };
        else lv = { P, R1: 2 * P - pr.l, R2: P + R, R3: pr.h + 2 * (P - pr.l), S1: 2 * P - pr.h, S2: P - R, S3: pr.l - 2 * (pr.h - P) };
        const i1 = g === groups.length - 1 ? cur.i1 + (cur.i1 - cur.i0 + 1) : cur.i1;
        for (const [name, val] of Object.entries(lv)) {
          const color = name === 'P' ? '#ff9800' : name[0] === 'R' ? '#f23645' : '#089981';
          segs.push({ i0: cur.i0, i1, p: val, color, label: name, width: 1 });
        }
      }
      return { segs };
    },
  },
  structure: {
    name: 'Struktur Pasar & Order Block (BOS/CHoCH)', pane: 'main', short: 'Struktur',
    params: [num('len', 'Panjang swing', 5, 2, 50), bool('ob', 'Tampilkan order block', true), num('obMax', 'Maks. order block', 5, 0, 30), bool('swings', 'Label HH/HL/LH/LL', true)],
    calc(c, p) {
      const L = p.len, n = c.length, segs = [], marks = [], boxes = [];
      let lastH = null, lastL = null, prevH = null, prevL = null, trend = 0;
      const obs = [];
      const avgVol = c.reduce((s, x) => s + (x.v || 0), 0) / (n || 1) || 1;
      const isPH = i => { for (let k = i - L; k <= i + L; k++) if (k !== i && (k < 0 || k >= n || (k < i ? c[k].h > c[i].h : c[k].h >= c[i].h))) return false; return true; };
      const isPL = i => { for (let k = i - L; k <= i + L; k++) if (k !== i && (k < 0 || k >= n || (k < i ? c[k].l < c[i].l : c[k].l <= c[i].l))) return false; return true; };
      for (let i = 0; i < n; i++) {
        // swing terkonfirmasi L bar kemudian
        const s = i - L;
        if (s >= L) {
          if (isPH(s)) {
            prevH = lastH; lastH = { i: s, p: c[s].h, broken: false };
            if (p.swings) marks.push({ i: s, p: c[s].h, text: prevH ? (c[s].h > prevH.p ? 'HH' : 'LH') : 'H', color: '#787b86', pos: 'above', small: true });
          }
          if (isPL(s)) {
            prevL = lastL; lastL = { i: s, p: c[s].l, broken: false };
            if (p.swings) marks.push({ i: s, p: c[s].l, text: prevL ? (c[s].l > prevL.p ? 'HL' : 'LL') : 'L', color: '#787b86', pos: 'below', small: true });
          }
        }
        // break struktur
        if (lastH && !lastH.broken && c[i].c > lastH.p) {
          lastH.broken = true;
          const kind = trend === -1 ? 'CHoCH' : 'BOS';
          trend = 1;
          segs.push({ i0: lastH.i, i1: i, p: lastH.p, color: '#089981', dash: [4, 3], label: kind, labelColor: '#089981', center: true });
          // order block bullish: candle bearish terakhir sebelum impuls naik
          const from = lastL ? lastL.i : lastH.i;
          for (let k = i - 1; k >= Math.max(0, from - 1); k--) if (c[k].c < c[k].o) { obs.push({ i0: k, top: c[k].h, bot: c[k].l, bull: true, vol: c[k].v || 0 }); break; }
        }
        if (lastL && !lastL.broken && c[i].c < lastL.p) {
          lastL.broken = true;
          const kind = trend === 1 ? 'CHoCH' : 'BOS';
          trend = -1;
          segs.push({ i0: lastL.i, i1: i, p: lastL.p, color: '#f23645', dash: [4, 3], label: kind, labelColor: '#f23645', center: true });
          const from = lastH ? lastH.i : lastL.i;
          for (let k = i - 1; k >= Math.max(0, from - 1); k--) if (c[k].c > c[k].o) { obs.push({ i0: k, top: c[k].h, bot: c[k].l, bull: false, vol: c[k].v || 0 }); break; }
        }
        // mitigasi order block
        for (const ob of obs) if (ob.i1 == null && i > ob.i0 + 1 && (ob.bull ? c[i].c < ob.bot : c[i].c > ob.top)) ob.i1 = i;
      }
      if (p.ob) {
        const active = obs.filter(o => o.i1 == null).slice(-p.obMax);
        for (const o of active) boxes.push({
          i0: o.i0, i1: n + 10, top: o.top, bot: o.bot,
          fill: o.bull ? 'rgba(8,153,129,.15)' : 'rgba(242,54,69,.15)', stroke: o.bull ? 'rgba(8,153,129,.6)' : 'rgba(242,54,69,.6)',
          label: `${o.bull ? 'OB Bull' : 'OB Bear'} · Vol ${(o.vol / avgVol).toFixed(1)}x`,
        });
      }
      return { segs, marks, boxes };
    },
  },

  // ================= PANE TERPISAH =================
  rsi: {
    name: 'Relative Strength Index (RSI)', pane: 'sub', short: 'RSI',
    params: [num('period', 'Periode', 14), num('ob', 'Overbought', 70, 50, 100), num('os', 'Oversold', 30, 0, 50), col('color', 'Warna', '#7e57c2')],
    calc(c, p) {
      const g = [null], l = [null];
      for (let i = 1; i < c.length; i++) { const d = c[i].c - c[i - 1].c; g.push(Math.max(0, d)); l.push(Math.max(0, -d)); }
      const ag = rma(g, p.period), al = rma(l, p.period);
      const v = ag.map((x, i) => x == null ? null : al[i] === 0 ? 100 : 100 - 100 / (1 + x / al[i]));
      return { lines: [{ v, color: p.color }], levels: [{ p: p.ob, color: '#787b86', dash: [4, 4] }, { p: 50, color: '#787b86', dash: [1, 3] }, { p: p.os, color: '#787b86', dash: [4, 4] }], zone: [p.os, p.ob], range: [0, 100] };
    },
  },
  macd: {
    name: 'MACD', pane: 'sub', short: 'MACD',
    params: [num('fast', 'Cepat', 12), num('slow', 'Lambat', 26), num('signal', 'Sinyal', 9)],
    calc(c, p) {
      const s = c.map(x => x.c), f = ema(s, p.fast), sl = ema(s, p.slow);
      const m = f.map((v, i) => v == null || sl[i] == null ? null : v - sl[i]);
      const sig = ema(m, p.signal);
      const h = m.map((v, i) => v == null || sig[i] == null ? null : v - sig[i]);
      const colors = h.map((v, i) => v == null ? null : v >= 0 ? (i && h[i - 1] != null && v < h[i - 1] ? '#b2dfdb' : '#26a69a') : (i && h[i - 1] != null && v > h[i - 1] ? '#ffcdd2' : '#ef5350'));
      return { hist: [{ v: h, colors }], lines: [{ v: m, color: '#2962ff' }, { v: sig, color: '#ff6d00' }], levels: [{ p: 0, color: '#787b86', dash: [1, 3] }] };
    },
  },
  stoch: {
    name: 'Stochastic', pane: 'sub', short: 'Stoch',
    params: [num('k', '%K', 14), num('smooth', 'Penghalusan %K', 3), num('d', '%D', 3)],
    calc(c, p) {
      const raw = c.map((x, i) => { const hh = highest(c, i, p.k, y => y.h), ll = lowest(c, i, p.k, y => y.l); return i < p.k - 1 ? null : hh === ll ? 50 : ((x.c - ll) / (hh - ll)) * 100; });
      const k = sma(raw, p.smooth), d = sma(k, p.d);
      return { lines: [{ v: k, color: '#2962ff' }, { v: d, color: '#ff6d00' }], levels: [{ p: 80, color: '#787b86', dash: [4, 4] }, { p: 20, color: '#787b86', dash: [4, 4] }], zone: [20, 80], range: [0, 100] };
    },
  },
  atr: {
    name: 'Average True Range (ATR)', pane: 'sub', short: 'ATR',
    params: [num('period', 'Periode', 14), col('color', 'Warna', '#f23645')],
    calc: (c, p) => ({ lines: [{ v: rma(trueRange(c), p.period), color: p.color }] }),
  },
  cci: {
    name: 'Commodity Channel Index (CCI)', pane: 'sub', short: 'CCI',
    params: [num('period', 'Periode', 20)],
    calc(c, p) {
      const tp = c.map(x => (x.h + x.l + x.c) / 3), m = sma(tp, p.period);
      const v = tp.map((x, i) => {
        if (m[i] == null) return null;
        let md = 0; for (let k = i - p.period + 1; k <= i; k++) md += Math.abs(tp[k] - m[i]);
        md /= p.period; return md ? (x - m[i]) / (0.015 * md) : 0;
      });
      return { lines: [{ v, color: '#2962ff' }], levels: [{ p: 100, color: '#787b86', dash: [4, 4] }, { p: 0, color: '#787b86', dash: [1, 3] }, { p: -100, color: '#787b86', dash: [4, 4] }], zone: [-100, 100] };
    },
  },
  obv: {
    name: 'On Balance Volume (OBV)', pane: 'sub', short: 'OBV',
    params: [col('color', 'Warna', '#2962ff')],
    calc(c, p) {
      let o = 0; const v = c.map((x, i) => { if (i) o += x.c > c[i - 1].c ? x.v || 0 : x.c < c[i - 1].c ? -(x.v || 0) : 0; return o; });
      return { lines: [{ v, color: p.color }] };
    },
  },
  adx: {
    name: 'ADX / DMI', pane: 'sub', short: 'ADX',
    params: [num('period', 'Periode', 14)],
    calc(c, p) {
      const pdm = [0], mdm = [0];
      for (let i = 1; i < c.length; i++) {
        const up = c[i].h - c[i - 1].h, dn = c[i - 1].l - c[i].l;
        pdm.push(up > dn && up > 0 ? up : 0); mdm.push(dn > up && dn > 0 ? dn : 0);
      }
      const tr = rma(trueRange(c), p.period), sp = rma(pdm, p.period), sm = rma(mdm, p.period);
      const pdi = sp.map((v, i) => v == null || !tr[i] ? null : (100 * v) / tr[i]), mdi = sm.map((v, i) => v == null || !tr[i] ? null : (100 * v) / tr[i]);
      const dx = pdi.map((v, i) => v == null || mdi[i] == null || v + mdi[i] === 0 ? null : (100 * Math.abs(v - mdi[i])) / (v + mdi[i]));
      return { lines: [{ v: rma(dx, p.period), color: '#ff9800', width: 2 }, { v: pdi, color: '#089981', width: 1 }, { v: mdi, color: '#f23645', width: 1 }], levels: [{ p: 25, color: '#787b86', dash: [4, 4] }] };
    },
  },
};

export function defaultParams(type) {
  return Object.fromEntries(INDICATORS[type].params.map(p => [p.key, p.def]));
}
export function indicatorLabel(inst) {
  const def = INDICATORS[inst.type];
  const vals = def.params.filter(p => p.type === 'number').map(p => inst.params[p.key]);
  return `${def.short}${vals.length ? ' ' + vals.join(', ') : ''}`;
}

// ---------- Ringkasan teknikal (meter Jual kuat … Beli kuat) ----------
// Skor -1..1 dari rata-rata bergerak dan osilator pada candle yang diberikan.
export function technicalRating(c) {
  if (c.length < 30) return null;
  const close = c.map(x => x.c), last = close[close.length - 1], n = c.length - 1;
  const vote = (b, s) => (b ? 1 : s ? -1 : 0);
  const ma = [];
  for (const p of [10, 20, 30, 50, 100, 200]) {
    if (c.length <= p) continue;
    const s = sma(close, p)[n], e = ema(close, p)[n];
    if (s != null) ma.push(vote(last > s, last < s));
    if (e != null) ma.push(vote(last > e, last < e));
  }
  const osc = [];
  const r = INDICATORS.rsi.calc(c, { period: 14, ob: 70, os: 30 }).lines[0].v;
  osc.push(vote(r[n] < 30 && r[n] > r[n - 1], r[n] > 70 && r[n] < r[n - 1]));
  const st = INDICATORS.stoch.calc(c, { k: 14, smooth: 3, d: 3 }).lines;
  osc.push(vote(st[0].v[n] < 20 && st[0].v[n] > st[1].v[n], st[0].v[n] > 80 && st[0].v[n] < st[1].v[n]));
  const cci = INDICATORS.cci.calc(c, { period: 20 }).lines[0].v;
  osc.push(vote(cci[n] < -100 && cci[n] > cci[n - 1], cci[n] > 100 && cci[n] < cci[n - 1]));
  const m = INDICATORS.macd.calc(c, { fast: 12, slow: 26, signal: 9 }).lines;
  osc.push(vote(m[0].v[n] > m[1].v[n], m[0].v[n] < m[1].v[n]));
  const mom = close[n] - close[n - 10], momP = close[n - 1] - close[n - 11];
  osc.push(vote(mom > momP, mom < momP));
  const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const count = a => ({ buy: a.filter(v => v > 0).length, sell: a.filter(v => v < 0).length, neutral: a.filter(v => v === 0).length });
  const sMa = avg(ma), sOsc = avg(osc), score = (sMa + sOsc) / 2;
  return { score, ma: { score: sMa, ...count(ma) }, osc: { score: sOsc, ...count(osc) }, label: ratingLabel(score) };
}
export function ratingLabel(s) {
  return s <= -0.5 ? 'Jual kuat' : s < -0.1 ? 'Jual' : s <= 0.1 ? 'Netral' : s < 0.5 ? 'Beli' : 'Beli kuat';
}
