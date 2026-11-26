import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYMBOLS, TIMEFRAMES, findSymbol } from './symbols.js';
import { oanda } from './providers/oanda.js';
import { forexcom } from './providers/forexcom.js';
import { demo } from './providers/demo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

// Muat .env sederhana (tanpa dependensi)
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const PROVIDERS = { oanda, forexcom };

// Cache singkat agar tidak membebani API broker saat polling
const cache = new Map();
const CACHE_MS = 1500;

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

async function getCandles(brokerName, sym, tf, count) {
  const tfSec = TIMEFRAMES[tf];
  if (!tfSec) throw new Error('Timeframe tidak dikenal');
  const broker = PROVIDERS[brokerName];
  if (!broker) throw new Error('Broker tidak dikenal');
  const live = broker.configured();
  const provider = live ? broker : demo;
  const key = `${provider.name}|${brokerName}|${sym.symbol}|${tf}|${count}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  let candles;
  if (provider !== demo && tf === '3m') {
    // 3 menit tidak tersedia di semua broker -> agregasi dari 1 menit
    candles = aggregate(await provider.candles(sym, 60, count * 3), 180).slice(-count);
  } else {
    candles = await provider.candles(sym, tfSec, count);
  }
  const data = { broker: brokerName, source: live ? 'live' : 'demo', symbol: sym.symbol, tf, digits: sym.digits, candles };
  cache.set(key, { at: Date.now(), data });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return data;
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname === '/api/status') {
      return send(res, 200, {
        brokers: Object.fromEntries(Object.entries(PROVIDERS).map(([k, p]) => [k, p.configured() ? 'live' : 'demo'])),
      });
    }
    if (url.pathname === '/api/symbols') {
      const list = [];
      for (const s of SYMBOLS) {
        for (const b of ['oanda', 'forexcom']) {
          if (s[b]) list.push({ symbol: s.symbol, desc: s.desc, type: s.type, icon: s.icon, broker: b, digits: s.digits });
        }
      }
      return send(res, 200, list);
    }
    if (url.pathname === '/api/candles') {
      const sym = findSymbol(url.searchParams.get('symbol') || '');
      if (!sym) return send(res, 404, { error: 'Simbol tidak ditemukan' });
      const count = Math.max(2, Math.min(5000, +(url.searchParams.get('count') || 500)));
      const data = await getCandles(url.searchParams.get('broker') || 'oanda', sym, url.searchParams.get('tf') || '5m', count);
      return send(res, 200, data);
    }
    // File statis
    let file = path.normalize(path.join(PUBLIC, decodeURIComponent(url.pathname)));
    if (!file.startsWith(PUBLIC)) return send(res, 403, 'Forbidden', 'text/plain');
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return send(res, 404, 'Not found', 'text/plain');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.error(err.message);
    send(res, 502, { error: err.message });
  }
});

const PORT = +(process.env.PORT || 3000);
server.listen(PORT, () => {
  console.log(`Analis Chart berjalan di http://localhost:${PORT}`);
  for (const [k, p] of Object.entries(PROVIDERS)) {
    console.log(`  ${k.padEnd(9)}: ${p.configured() ? 'LIVE (kredensial terpasang)' : 'DEMO (isi kredensial di .env untuk data asli)'}`);
  }
});
