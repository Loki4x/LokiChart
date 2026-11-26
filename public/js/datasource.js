// Memilih sumber data:
//  - "server": versi web yang dilayani server Node (kredensial di .env server)
//  - "langsung": aplikasi Android (atau tanpa server) — memanggil API broker langsung,
//                kredensial disimpan di perangkat melalui layar Pengaturan.
import { getCandles, listSymbols, brokerStatus } from './data/index.js';

const KEY = 'ac:creds';
export const isNative = () => !!window.Capacitor?.isNativePlatform?.();

export function loadCreds() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
export function saveCreds(c) { localStorage.setItem(KEY, JSON.stringify(c)); }

async function api(path) {
  const r = await fetch(path);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

export const ds = {
  mode: 'langsung',
  async init() {
    if (isNative()) { this.mode = 'langsung'; return; }
    try { await api('/api/status'); this.mode = 'server'; } catch { this.mode = 'langsung'; }
  },
  candles(broker, symbol, tf, count) {
    if (this.mode === 'server') return api(`/api/candles?symbol=${symbol}&broker=${broker}&tf=${tf}&count=${count}`);
    return getCandles(loadCreds(), broker, symbol, tf, count).catch(e => {
      if (e instanceof TypeError && !isNative()) {
        throw new Error('tidak dapat menghubungi broker dari browser (diblokir CORS). Gunakan aplikasi Android atau jalankan server (npm start).');
      }
      throw e;
    });
  },
  async symbols() { return this.mode === 'server' ? api('/api/symbols') : listSymbols(); },
  async status() { return this.mode === 'server' ? (await api('/api/status')).brokers : brokerStatus(loadCreds()); },
};
