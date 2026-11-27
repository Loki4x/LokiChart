// OANDA v20 REST API
// Dokumentasi: https://developer.oanda.com/rest-live-v20/instrument-ep/
const GRAN = {
  60: 'M1', 300: 'M5', 900: 'M15', 1800: 'M30',
  3600: 'H1', 7200: 'H2', 14400: 'H4', 86400: 'D', 604800: 'W',
};

function baseUrl(cfg) {
  return cfg.env === 'live'
    ? 'https://api-fxtrade.oanda.com'
    : 'https://api-fxpractice.oanda.com';
}

export const oanda = {
  name: 'oanda',
  configured: cfg => !!cfg?.apiKey,
  async candles(cfg, sym, tfSec, count, to) {
    if (!sym.oanda) throw new Error(`${sym.symbol} tidak tersedia di OANDA`);
    const gran = GRAN[tfSec];
    if (!gran) throw new Error('Timeframe tidak didukung OANDA');
    const url = `${baseUrl(cfg)}/v3/instruments/${encodeURIComponent(sym.oanda)}/candles` +
      `?granularity=${gran}&count=${Math.min(count, 5000)}&price=M&alignmentTimezone=UTC&dailyAlignment=0&weeklyAlignment=Monday` +
      (to ? `&to=${Math.floor(to / 1000)}` : '');
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Accept-Datetime-Format': 'UNIX',
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OANDA ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = await res.json();
    return json.candles.map(c => ({
      t: Math.round(parseFloat(c.time) * 1000),
      o: +c.mid.o, h: +c.mid.h, l: +c.mid.l, c: +c.mid.c,
      v: c.volume,
    }));
  },
};
