// Integrasi perangkat: notifikasi, bunyi, getar, bagikan gambar. Bekerja di Android (Capacitor) dan web.
import { isNative } from './datasource.js';

// Panggil plugin native langsung lewat jembatan Capacitor (tanpa bundler)
const plugin = name => (isNative() && window.Capacitor?.nativePromise
  ? new Proxy({}, { get: (_, method) => (opts = {}) => window.Capacitor.nativePromise(name, method, opts) })
  : null);
let notifId = 1;

export async function askNotifyPermission() {
  try {
    const LN = plugin('LocalNotifications');
    if (LN) { await LN.requestPermissions(); return; }
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
  } catch { /* abaikan */ }
}

export async function notify(title, body) {
  beep();
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* */ }
  try {
    const LN = plugin('LocalNotifications');
    if (LN) { await LN.schedule({ notifications: [{ id: notifId++, title, body }] }); return; }
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: 'icon.svg' });
  } catch (e) { console.warn(e); }
}

let audio;
export function beep() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    for (const [k, f] of [[0, 880], [0.18, 1175], [0.36, 880]]) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t + k); g.gain.exponentialRampToValueAtTime(0.25, t + k + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + k + 0.16);
      o.connect(g).connect(audio.destination); o.start(t + k); o.stop(t + k + 0.17);
    }
  } catch { /* */ }
}

// Bagikan / simpan gambar PNG (dataURL)
export async function shareImage(dataUrl, filename) {
  const FS = plugin('Filesystem'), SH = plugin('Share');
  if (FS && SH) {
    const res = await FS.writeFile({ path: filename, data: dataUrl.split(',')[1], directory: 'CACHE' });
    await SH.share({ title: 'LokiChart', files: [res.uri], dialogTitle: 'Bagikan chart' });
    return 'shared';
  }
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'LokiChart' }); return 'shared'; }
  } catch (e) { if (e?.name === 'AbortError') return 'cancel'; }
  const a = document.createElement('a'); a.href = dataUrl; a.download = filename; a.click();
  return 'downloaded';
}
