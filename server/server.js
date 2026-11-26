import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCandles as fetchCandles, listSymbols, brokerStatus } from '../public/js/data/index.js';

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

// Kredensial dari .env (versi web/server)
const cfg = () => ({
  oanda: { apiKey: process.env.OANDA_API_KEY, env: process.env.OANDA_ENV },
  forexcom: {
    username: process.env.FOREXCOM_USERNAME, password: process.env.FOREXCOM_PASSWORD,
    appKey: process.env.FOREXCOM_APPKEY, baseUrl: process.env.FOREXCOM_BASE_URL, marketIds: process.env.FOREXCOM_MARKET_IDS,
  },
});

// Cache singkat agar tidak membebani API broker saat polling
const cache = new Map();
const CACHE_MS = 1500;
async function getCandles(broker, symbol, tf, count) {
  const key = `${broker}|${symbol}|${tf}|${count}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = await fetchCandles(cfg(), broker, symbol, tf, count);
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
      return send(res, 200, { brokers: brokerStatus(cfg()) });
    }
    if (url.pathname === '/api/symbols') {
      const list = listSymbols();
      return send(res, 200, list);
    }
    if (url.pathname === '/api/candles') {
      const count = Math.max(2, Math.min(5000, +(url.searchParams.get('count') || 500)));
      const data = await getCandles(url.searchParams.get('broker') || 'oanda', url.searchParams.get('symbol') || '', url.searchParams.get('tf') || '5m', count);
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
  console.log(`LokiChart berjalan di http://localhost:${PORT}`);
  for (const [k, v] of Object.entries(brokerStatus(cfg()))) {
    console.log(`  ${k.padEnd(9)}: ${v === 'live' ? 'LIVE (kredensial terpasang)' : 'DEMO (isi kredensial di .env untuk data asli)'}`);
  }
});
