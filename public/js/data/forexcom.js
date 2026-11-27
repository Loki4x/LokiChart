// FOREX.com — GAIN Capital Trading API (REST)
// Alur: POST /session (login) -> cari MarketId -> GET /market/{id}/barhistory
const INTERVAL = {
  60: ['MINUTE', 1], 300: ['MINUTE', 5], 900: ['MINUTE', 15], 1800: ['MINUTE', 30],
  3600: ['HOUR', 1], 7200: ['HOUR', 2], 14400: ['HOUR', 4], 86400: ['DAY', 1], 604800: ['WEEK', 1],
};

let session = null; // { token, user }
const marketIdCache = new Map();

function base(cfg) {
  return (cfg.baseUrl || 'https://ciapi.cityindex.com/TradingAPI').replace(/\/$/, '');
}

async function login(cfg) {
  const res = await fetch(`${base(cfg)}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      UserName: cfg.username,
      Password: cfg.password,
      AppKey: cfg.appKey,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.Session) {
    throw new Error(`Login FOREX.com gagal (${res.status}): ${JSON.stringify(json).slice(0, 200)}`);
  }
  session = { token: json.Session, user: cfg.username, key: cfg.password + cfg.appKey };
  return session.token;
}

async function api(cfg, path, retry = true) {
  if (!session || session.user !== cfg.username || session.key !== cfg.password + cfg.appKey) await login(cfg);
  const res = await fetch(`${base(cfg)}${path}`, {
    headers: { UserName: cfg.username, Session: session.token },
  });
  if (res.status === 401 && retry) {
    session = null;
    return api(cfg, path, false);
  }
  if (!res.ok) throw new Error(`FOREX.com ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function marketId(cfg, sym) {
  let overrides = cfg.marketIds || {};
  if (typeof overrides === 'string') { try { overrides = JSON.parse(overrides || '{}'); } catch { overrides = {}; } }
  if (overrides[sym.symbol]) return overrides[sym.symbol];
  if (marketIdCache.has(sym.symbol)) return marketIdCache.get(sym.symbol);
  const q = encodeURIComponent(sym.forexcom);
  const json = await api(cfg, `/market/search?SearchByMarketName=TRUE&Query=${q}&MaxResults=20`);
  const markets = json.Markets || [];
  const norm = s => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const want = norm(sym.forexcom);
  const m = markets.find(x => norm(x.Name) === want) ||
            markets.find(x => norm(x.Name).startsWith(want)) || markets[0];
  if (!m) throw new Error(`Market ${sym.forexcom} tidak ditemukan di FOREX.com`);
  marketIdCache.set(sym.symbol, m.MarketId);
  return m.MarketId;
}

const parseDate = s => +String(s).match(/-?\d+/)[0]; // "/Date(1700000000000)/"

export const forexcom = {
  name: 'forexcom',
  configured: cfg => !!(cfg?.username && cfg?.password && cfg?.appKey),
  async candles(cfg, sym, tfSec, count, to) {
    if (!sym.forexcom) throw new Error(`${sym.symbol} tidak tersedia di FOREX.com`);
    const iv = INTERVAL[tfSec];
    if (!iv) throw new Error('Timeframe tidak didukung FOREX.com');
    const id = await marketId(cfg, sym);
    const json = to
      ? await api(cfg, `/market/${id}/barhistorybefore?interval=${iv[0]}&span=${iv[1]}&maxResults=${Math.min(count, 4000)}&toTimeStampUTC=${Math.floor(to / 1000)}&priceType=MID`)
      : await api(cfg, `/market/${id}/barhistory?interval=${iv[0]}&span=${iv[1]}&PriceBars=${Math.min(count, 4000)}&priceType=MID`);
    const bars = [...(json.PriceBars || [])];
    if (json.PartialPriceBar && !to) bars.push(json.PartialPriceBar);
    return bars.map(b => ({
      t: parseDate(b.BarDate), o: b.Open, h: b.High, l: b.Low, c: b.Close, v: b.Volume ?? 0,
    }));
  },
};
