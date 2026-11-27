// Binance — data pasar publik (tanpa akun / API key).
// GET /api/v3/klines?symbol=BTCUSDT&interval=5m&limit=1000[&endTime=ms]
// Respons: [[openTime, open, high, low, close, volume, closeTime, ...], ...]
const IV = {
  1: '1s', 60: '1m', 180: '3m', 300: '5m', 900: '15m', 1800: '30m', 3600: '1h', 7200: '2h',
  14400: '4h', 21600: '6h', 28800: '8h', 43200: '12h', 86400: '1d', 259200: '3d', 604800: '1w',
};
// data-api.binance.vision khusus data pasar publik; api.binance.com sebagai cadangan
const HOSTS = ['https://data-api.binance.vision', 'https://api.binance.com'];

async function get(path) {
  let lastErr;
  for (const h of HOSTS) {
    try {
      const r = await fetch(h + path);
      if (r.ok) return await r.json();
      const body = await r.text();
      lastErr = new Error(`Binance ${r.status}: ${body.slice(0, 150)}`);
      if (r.status === 400) break; // simbol/parameter salah: tidak perlu coba host lain
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('Binance tidak dapat dihubungi');
}

export const binance = {
  name: 'binance',
  configured: () => true, // data publik
  bases: Object.keys(IV).map(Number),
  supports: s => s === '1M' || !!IV[s],
  async candles(cfg, sym, tf, count, to) {
    if (!sym.binance) throw new Error(`${sym.symbol} tidak tersedia di Binance`);
    const iv = tf.month ? '1M' : IV[tf.sec];
    if (!iv) throw new Error('Interval tidak didukung Binance');
    const out = [];
    let end = to ? to - 1 : null, remaining = Math.min(count, 5000);
    while (remaining > 0) {
      const lim = Math.min(1000, remaining);
      const rows = await get(`/api/v3/klines?symbol=${sym.binance}&interval=${iv}&limit=${lim}${end != null ? `&endTime=${end}` : ''}`);
      const bars = rows.map(k => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
      out.unshift(...bars);
      if (bars.length < lim) break;
      end = bars[0].t - 1; remaining -= bars.length;
    }
    return out;
  },
};
