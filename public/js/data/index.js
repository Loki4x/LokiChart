// Lapisan data bersama: dipakai oleh server Node (versi web) dan langsung oleh aplikasi Android.
// cfg = { oanda: { apiKey, env }, forexcom: { username, password, appKey, baseUrl, marketIds } }
import { SYMBOLS, TIMEFRAMES, findSymbol } from './symbols.js';
import { oanda } from './oanda.js';
import { forexcom } from './forexcom.js';
import { demo } from './demo.js';

export const PROVIDERS = { oanda, forexcom };
export { SYMBOLS, TIMEFRAMES };

export function listSymbols() {
  const list = [];
  for (const s of SYMBOLS) {
    for (const b of ['oanda', 'forexcom']) {
      if (s[b]) list.push({ symbol: s.symbol, desc: s.desc, type: s.type, icon: s.icon, broker: b, digits: s.digits });
    }
  }
  return list;
}

export function brokerStatus(cfg) {
  return Object.fromEntries(Object.entries(PROVIDERS).map(([k, p]) => [k, p.configured(cfg?.[k]) ? 'live' : 'demo']));
}

function aggregate(candles, tfSec) {
  const ms = tfSec * 1000;
  const out = [];
  for (const c of candles) {
    const t = Math.floor(c.t / ms) * ms;
    const last = out[out.length - 1];
    if (last && last.t === t) {
      last.h = Math.max(last.h, c.h); last.l = Math.min(last.l, c.l); last.c = c.c; last.v += c.v;
    } else out.push({ ...c, t });
  }
  return out;
}

export async function getCandles(cfg, brokerName, symbol, tf, count) {
  const sym = findSymbol(symbol);
  if (!sym) throw new Error('Simbol tidak ditemukan');
  const tfSec = TIMEFRAMES[tf];
  if (!tfSec) throw new Error('Timeframe tidak dikenal');
  const broker = PROVIDERS[brokerName];
  if (!broker) throw new Error('Broker tidak dikenal');
  const bcfg = cfg?.[brokerName];
  const live = broker.configured(bcfg);
  const provider = live ? broker : demo;
  let candles;
  if (live && tf === '3m') {
    // 3 menit tidak tersedia di semua broker -> agregasi dari 1 menit
    candles = aggregate(await provider.candles(bcfg, sym, 60, count * 3), 180).slice(-count);
  } else {
    candles = await provider.candles(bcfg, sym, tfSec, count);
  }
  return { broker: brokerName, source: live ? 'live' : 'demo', symbol: sym.symbol, tf, digits: sym.digits, candles };
}
