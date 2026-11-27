// Interval (timeframe): format "<angka><satuan>" — s detik, m menit, h jam, D hari, W minggu, M bulan
const UNIT = { s: 1, m: 60, h: 3600, D: 86400, W: 604800 };
export function parseTf(tf) {
  const m = /^(\d+)(s|m|h|D|W|M)$/.exec(String(tf || ''));
  if (!m) return null;
  const n = +m[1], u = m[2];
  if (!n) return null;
  return u === 'M' ? { n, unit: 'M', month: n, sec: n * 2629746 } : { n, unit: u, sec: n * UNIT[u] };
}
export const tfMs = tf => (parseTf(tf)?.sec || 300) * 1000;
export const tfLabel = tf => tf;
export function tfName(tf) {
  const p = parseTf(tf); if (!p) return tf;
  return `${p.n} ${{ s: 'detik', m: 'menit', h: 'jam', D: 'hari', W: 'minggu', M: 'bulan' }[p.unit]}`;
}
export const TF_GROUPS = [
  ['DETIK', ['5s', '10s', '15s', '30s']],
  ['MENIT', ['1m', '2m', '3m', '5m', '10m', '15m', '30m', '45m']],
  ['JAM', ['1h', '2h', '3h', '4h', '6h', '8h', '12h']],
  ['HARI', ['1D', '1W', '1M', '3M', '6M', '12M']],
];
export const ALL_TFS = TF_GROUPS.flatMap(g => g[1]);

const MONDAY = 4 * 86400e3; // 1 Jan 1970 adalah Kamis; minggu dimulai Senin
// gabungkan candle ke interval yang lebih besar
export function aggregate(candles, target) {
  const out = [];
  let key = null;
  for (const c of candles) {
    let k, t0;
    if (target.month) {
      const d = new Date(c.t), mi = d.getUTCFullYear() * 12 + d.getUTCMonth();
      k = Math.floor(mi / target.month); const mStart = k * target.month;
      t0 = Date.UTC(Math.floor(mStart / 12), mStart % 12, 1);
    } else {
      const ms = target.sec * 1000, anchor = target.unit === 'W' ? MONDAY : 0;
      k = Math.floor((c.t - anchor) / ms); t0 = k * ms + anchor;
    }
    const last = out[out.length - 1];
    if (last && key === k) { last.h = Math.max(last.h, c.h); last.l = Math.min(last.l, c.l); last.c = c.c; last.v += c.v || 0; }
    else { out.push({ t: t0, o: c.o, h: c.h, l: c.l, c: c.c, v: c.v || 0 }); key = k; }
  }
  return out;
}
