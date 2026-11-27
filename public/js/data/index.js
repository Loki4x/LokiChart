// Lapisan data bersama: dipakai oleh server Node (versi web) dan langsung oleh aplikasi Android.
// cfg = { oanda: { apiKey, env }, forexcom: { username, password, appKey, baseUrl, marketIds } }
import { SYMBOLS, findSymbol } from './symbols.js';
import { parseTf, aggregate } from './timeframes.js';
import { oanda } from './oanda.js';
import { forexcom } from './forexcom.js';
import { demo } from './demo.js';

export const PROVIDERS = { oanda, forexcom };
export { SYMBOLS };

export function listSymbols() {
  const list = [];
  for (const s of SYMBOLS) {
    for (const b of ['oanda', 'forexcom']) {
      if (s[b]) list.push({ symbol: s.symbol, desc: s.desc, type: s.type, icon: s.icon, broker: b, digits: s.digits, code: s[b] });
    }
  }
  return list;
}

export function brokerStatus(cfg) {
  return Object.fromEntries(Object.entries(PROVIDERS).map(([k, p]) => [k, p.configured(cfg?.[k]) ? 'live' : 'demo']));
}

export async function getCandles(cfg, brokerName, symbol, tf, count, to) {
  const sym = findSymbol(symbol);
  if (!sym) throw new Error('Simbol tidak ditemukan');
  const target = parseTf(tf);
  if (!target) throw new Error('Interval tidak dikenal');
  const broker = PROVIDERS[brokerName];
  if (!broker) throw new Error('Broker tidak dikenal');
  const bcfg = cfg?.[brokerName];
  const live = broker.configured(bcfg);
  const provider = live ? broker : demo;
  const supports = provider.supports || (() => true);
  let candles;
  if (target.month) {
    if (target.month === 1 && supports('1M')) candles = await provider.candles(bcfg, sym, target, count, to);
    else {
      // bulan dari candle harian
      const daily = await provider.candles(bcfg, sym, parseTf('1D'), Math.min(5000, count * 23 * target.month + 30), to);
      candles = aggregate(daily, target).slice(-count);
    }
  } else if (supports(target.sec)) {
    candles = await provider.candles(bcfg, sym, target, count, to);
  } else {
    // pakai interval dasar terbesar yang didukung dan membagi habis interval target
    const bases = (provider.bases || []).filter(b => b < target.sec && target.sec % b === 0);
    const base = Math.max(...bases);
    if (!isFinite(base)) throw new Error(`Interval ${tf} tidak tersedia di ${brokerName === 'oanda' ? 'OANDA' : 'FOREX.com'}`);
    const k = target.sec / base;
    const raw = await provider.candles(bcfg, sym, { sec: base, unit: 's', n: base }, Math.min(5000, count * k + k), to);
    candles = aggregate(raw, target).slice(-count);
  }
  if (to) candles = candles.filter(c => c.t < to);
  candles.sort((a, b) => a.t - b.t);
  return { broker: brokerName, source: live ? 'live' : 'demo', symbol: sym.symbol, tf, digits: sym.digits, candles };
}
