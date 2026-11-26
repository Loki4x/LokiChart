// Penyedia data DEMO (sintetis, deterministik). Dipakai saat kredensial broker belum diisi,
// supaya aplikasi tetap bisa dicoba. Data ini BUKAN harga pasar sungguhan.
function hash(n, seed) {
  let x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453123;
  return (x - Math.floor(x)) * 2 - 1;
}
function noise(x, seed) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
}
function seedOf(str) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 100000;
  return h / 97;
}
function priceAt(tSec, base, seed) {
  const v =
    0.06 * noise(tSec / (86400 * 30), seed) +
    0.03 * noise(tSec / (86400 * 5), seed + 1) +
    0.012 * noise(tSec / 86400, seed + 2) +
    0.005 * noise(tSec / 14400, seed + 3) +
    0.0025 * noise(tSec / 3600, seed + 4) +
    0.0012 * noise(tSec / 600, seed + 5) +
    0.0006 * noise(tSec / 60, seed + 6) +
    0.0003 * noise(tSec / 10, seed + 7);
  return base * Math.exp(v);
}

export const demo = {
  name: 'demo',
  configured: () => true,
  async candles(sym, tfSec, count) {
    const seed = seedOf(sym.symbol);
    const now = Math.floor(Date.now() / 1000);
    const lastOpen = Math.floor(now / tfSec) * tfSec;
    const out = [];
    const samples = 16;
    for (let k = count - 1; k >= 0; k--) {
      const t0 = lastOpen - k * tfSec;
      const end = Math.min(t0 + tfSec, now);
      const o = priceAt(t0, sym.base, seed);
      let h = o, l = o, c = o;
      for (let s = 1; s <= samples; s++) {
        const ts = t0 + ((end - t0) * s) / samples;
        const p = priceAt(ts, sym.base, seed);
        h = Math.max(h, p); l = Math.min(l, p); c = p;
      }
      const f = 10 ** sym.digits;
      const r = v => Math.round(v * f) / f;
      const vol = Math.round(500 + 400 * (1 + noise(t0 / tfSec, seed + 9)) * (Math.abs(c - o) / (h - l + 1e-12) + 0.5));
      out.push({ t: t0 * 1000, o: r(o), h: r(h), l: r(l), c: r(c), v: vol });
    }
    return out;
  },
};
