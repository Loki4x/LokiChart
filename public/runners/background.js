// LokiChart — pemeriksa peringatan di latar belakang (Capacitor Background Runner).
// Dijalankan Android kira-kira setiap 15 menit walau aplikasi ditutup.
// Data (peringatan + kredensial) dikirim aplikasi lewat event 'sync' dan disimpan di CapacitorKV.

function load() {
  try { return JSON.parse(CapacitorKV.get('lc').value || '{}'); } catch (e) { return {}; }
}
function store(d) { CapacitorKV.set('lc', JSON.stringify(d)); }

addEventListener('sync', (resolve, reject, args) => {
  try {
    const d = load();
    d.alerts = args.alerts || [];
    d.creds = args.creds || {};
    d.last = Object.assign(d.last || {}, args.last || {});
    store(d);
    resolve({ ok: true });
  } catch (e) { reject(e); }
});

// aplikasi mengambil daftar peringatan yang terpicu di latar belakang
addEventListener('pull', (resolve, reject) => {
  try {
    const d = load();
    const triggered = d.triggered || [];
    d.triggered = [];
    store(d);
    resolve({ triggered, checkedAt: d.checkedAt || null });
  } catch (e) { reject(e); }
});

async function oandaBars(cr, code, fromMs) {
  const base = cr.env === 'live' ? 'https://api-fxtrade.oanda.com' : 'https://api-fxpractice.oanda.com';
  const from = Math.floor(Math.max(fromMs, Date.now() - 6 * 3600e3) / 1000);
  const r = await fetch(`${base}/v3/instruments/${code}/candles?granularity=M1&price=M&from=${from}`, { headers: { Authorization: 'Bearer ' + cr.apiKey, 'Accept-Datetime-Format': 'UNIX' } });
  if (!r.ok) throw new Error('OANDA ' + r.status);
  const j = await r.json();
  return (j.candles || []).map(c => ({ t: Math.round(parseFloat(c.time) * 1000), o: +c.mid.o, h: +c.mid.h, l: +c.mid.l, c: +c.mid.c }));
}
async function binanceBars(code, fromMs) {
  const start = Math.max(fromMs, Date.now() - 16 * 3600e3);
  const fut = code.startsWith('F:'), c = fut ? code.slice(2) : code;
  const urls = fut ? [`https://fapi.binance.com/fapi/v1/klines?symbol=${c}&interval=1m&startTime=${start}&limit=1000`]
    : ['https://data-api.binance.vision', 'https://api.binance.com'].map(h => `${h}/api/v3/klines?symbol=${c}&interval=1m&startTime=${start}&limit=1000`);
  let r = null;
  for (const u of urls) {
    try { r = await fetch(u); if (r.ok) break; } catch (e) { r = null; }
  }
  if (!r || !r.ok) throw new Error('Binance tidak dapat dihubungi');
  const j = await r.json();
  return j.map(k => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4] }));
}
async function forexcomBars(cr, d, code, fromMs) {
  const base = (cr.baseUrl || 'https://ciapi.cityindex.com/TradingAPI').replace(/\/$/, '');
  if (!d.fxSession) {
    const r = await fetch(base + '/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ UserName: cr.username, Password: cr.password, AppKey: cr.appKey }) });
    const j = await r.json(); if (!j.Session) throw new Error('login FOREX.com gagal');
    d.fxSession = j.Session;
  }
  const h = { UserName: cr.username, Session: d.fxSession };
  d.fxIds = d.fxIds || {};
  if (!d.fxIds[code]) {
    const r = await fetch(`${base}/market/search?SearchByMarketName=TRUE&Query=${encodeURIComponent(code)}&MaxResults=20`, { headers: h });
    if (r.status === 401) { d.fxSession = null; throw new Error('sesi FOREX.com kedaluwarsa'); }
    const j = await r.json(); const norm = s => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const m = (j.Markets || []).find(x => norm(x.Name) === norm(code)) || (j.Markets || [])[0];
    if (!m) throw new Error('market tidak ditemukan'); d.fxIds[code] = m.MarketId;
  }
  const n = Math.min(360, Math.max(2, Math.ceil((Date.now() - fromMs) / 60000) + 2));
  const r = await fetch(`${base}/market/${d.fxIds[code]}/barhistory?interval=MINUTE&span=1&PriceBars=${n}&priceType=MID`, { headers: h });
  if (r.status === 401) { d.fxSession = null; throw new Error('sesi FOREX.com kedaluwarsa'); }
  const j = await r.json();
  const bars = (j.PriceBars || []).concat(j.PartialPriceBar ? [j.PartialPriceBar] : []);
  return bars.map(b => ({ t: +String(b.BarDate).match(/-?\d+/)[0], o: b.Open, h: b.High, l: b.Low, c: b.Close })).filter(b => b.t >= fromMs - 60000);
}

const COND = { cross: 'melintasi', up: 'melintasi ke atas', down: 'melintasi ke bawah', above: 'di atas', below: 'di bawah' };

addEventListener('checkAlerts', async (resolve, reject) => {
  try {
    const d = load();
    const alerts = (d.alerts || []).filter(a => a.active && a.code);
    if (!alerts.length) { d.checkedAt = Date.now(); store(d); return resolve(); }
    d.last = d.last || {}; d.triggered = d.triggered || [];
    const groups = {};
    for (const a of alerts) (groups[a.symbol + '|' + a.broker] = groups[a.symbol + '|' + a.broker] || []).push(a);
    let nid = Math.floor(Date.now() / 1000) % 1000000;
    for (const key of Object.keys(groups)) {
      const list = groups[key], a0 = list[0], cr = (d.creds || {})[a0.broker];
      if (!cr && a0.broker !== 'binance') continue;
      const since = (d.last[key] && d.last[key].t) || Date.now() - 20 * 60000;
      let bars;
      try { bars = a0.broker === 'binance' ? await binanceBars(a0.code, since) : a0.broker === 'oanda' ? await oandaBars(cr, a0.code, since) : await forexcomBars(cr, d, a0.code, since); } catch (e) { continue; }
      if (!bars.length) continue;
      const hi = Math.max(...bars.map(b => b.h)), lo = Math.min(...bars.map(b => b.l)), lastBar = bars[bars.length - 1];
      const prev = d.last[key] && d.last[key].p != null ? d.last[key].p : bars[0].o;
      for (const a of list) {
        const lvl = a.line ? a.line.p0 + a.line.slope * (lastBar.t - a.line.t0) : a.price;
        const crossedUp = prev < lvl && hi >= lvl, crossedDown = prev > lvl && lo <= lvl;
        const hit = { cross: crossedUp || crossedDown, up: crossedUp, down: crossedDown, above: lastBar.c > lvl, below: lastBar.c < lvl }[a.cond];
        if (!hit) continue;
        const body = `${a.symbol} ${COND[a.cond]} ${a.label || lvl.toFixed(a.digits != null ? a.digits : 2)} — harga ${lastBar.c.toFixed(a.digits != null ? a.digits : 2)}${a.msg ? '. ' + a.msg : ''}`;
        CapacitorNotifications.schedule([{ id: nid++, title: '⏰ Peringatan LokiChart', body, autoCancel: true }]);
        d.triggered.push({ id: a.id, at: Date.now(), msg: body, symbol: a.symbol, broker: a.broker });
        if (!a.repeat) a.active = false;
      }
      d.last[key] = { t: lastBar.t, p: lastBar.c };
    }
    d.checkedAt = Date.now();
    store(d);
    resolve();
  } catch (e) { reject(e); }
});
