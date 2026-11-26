// Definisi semua alat gambar.
// Setiap alat: { name, cat, n (jumlah titik), icon (path SVG 24x24), build(g, P, d, c) }
//   g = Geo (perekam primitif), P = titik piksel [{x,y,i,p,t}], d = objek gambar, c = konteks chart
import { dir } from './geo.js';

const LV = ['#787b86', '#f23645', '#ff9800', '#4caf50', '#089981', '#00bcd4', '#2962ff', '#9c27b0', '#e91e63', '#673ab7', '#795548'];
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};
// warna isi: ikuti pengaturan "Latar belakang" di dialog pengaturan gambar
export const fillOf = (d, a = 0.15) => d.style.fillOn === false ? 'rgba(0,0,0,0)' : d.style.fill || rgba(d.style.color, a);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const fmtN = (v, k = 3) => (Math.round(v * 10 ** k) / 10 ** k).toString();
const pct = (a, b) => ((b - a) / a) * 100;

function labelPoints(g, P, labels, d) {
  P.forEach((p, k) => {
    if (!labels[k]) return;
    const up = k > 0 ? p.y <= P[k - 1].y : P[1] ? p.y <= P[1].y : true;
    g.text(p.x, p.y + (up ? -14 : 14), labels[k], { align: 'center', color: '#fff', bg: d.style.color, font: 'bold 11px system-ui' });
  });
}
function ratioLabel(g, a, b, v) {
  if (!isFinite(v)) return;
  const m = mid(a, b);
  g.text(m.x, m.y, fmtN(v), { align: 'center', color: '#fff', bg: 'rgba(80,80,90,.85)', font: '11px system-ui' });
}
function priceTag(g, x, y, s, color, align = 'left') {
  g.text(x, y, s, { align, color, font: '11px system-ui', base: 'bottom' });
}

// ---------- Fibonacci helper ----------
const FIB_RET = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236];
const FIB_EXT = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];

export function defaultLevels(vals) { return vals.map((v, k) => ({ v, on: true, color: LV[k % LV.length] })); }
function fibLevels(g, c, xs, x1, levels, priceOf, d) {
  const ext = d.opt?.extend || (d.extend ? 'right' : 'none');
  const x0 = ext === 'left' || ext === 'both' ? 0 : xs, xe = ext === 'right' || ext === 'both' ? c.plot.w : x1;
  let prevY = null;
  const showBg = d.style.fillOn !== false;
  levels.filter(l => l.on).sort((a, b) => a.v - b.v).forEach(l => {
    const p = priceOf(l.v), y = c.py(p), col = l.color;
    g.seg({ x: x0, y }, { x: xe, y }, { color: col, dash: [] });
    if (prevY !== null && showBg) g.area([{ x: x0, y: prevY }, { x: xe, y: prevY }, { x: xe, y }, { x: x0, y }], rgba(col, 0.12));
    if (d.opt?.labels !== false) priceTag(g, xs + 4, y, `${l.v} (${c.fmt(p)})`, col);
    prevY = y;
  });
}

// ---------- Ikon (path SVG sederhana) ----------
const I = {
  trend: 'M4 20L20 4 M4 20m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M20 4m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  ray: 'M5 19L21 3 M5 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  info: 'M4 20L16 8 M17 3h5v5h-5z M4 20m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  ext: 'M2 22L22 2 M8 16m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0 M16 8m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  angle: 'M3 20H21 M3 20L17 6 M10 20a7 7 0 0 0 -2 -5',
  hline: 'M2 12H22 M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  hray: 'M6 12H22 M6 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  vline: 'M12 2V22 M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
  cross: 'M12 2V22 M2 12H22',
  channel: 'M3 15L15 3 M9 21L21 9 M3 15m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0 M21 9m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0',
  regr: 'M3 13L21 5 M3 19L21 11 M3 7L21 -1 M3 7V19 M21 5V11',
  flat: 'M3 18L21 10 M3 5H21',
  disjoint: 'M3 6L21 12 M3 18L21 12 M3 6m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0',
  pitchfork: 'M3 18L12 12 M12 12L22 6 M8 6L22 2 M14 20L22 12 M8 6L14 20',
  fibret: 'M3 4H21 M3 9H21 M3 13H21 M3 17H21 M3 21H21',
  fibext: 'M3 20L9 6L13 14 M13 4H22 M13 10H22 M13 16H22',
  fibchan: 'M3 12L12 3 M6 18L18 6 M10 22L22 10',
  fibtime: 'M3 3V21 M7 3V21 M10 3V21 M15 3V21 M22 3V21',
  fan: 'M3 21L21 3 M3 21L21 9 M3 21L21 15 M3 21L15 3',
  circles: 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0 M12 12m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0 M12 12m-9.5 0a9.5 9.5 0 1 0 19 0a9.5 9.5 0 1 0 -19 0',
  spiral: 'M12 12a2 2 0 0 1 2 2a4 4 0 0 1 -4 4a6 6 0 0 1 -6 -6a8 8 0 0 1 8 -8a9 9 0 0 1 9 9',
  arcs: 'M3 20a9 9 0 0 1 18 0 M7 20a5 5 0 0 1 10 0 M3 20H21',
  wedge: 'M3 20L21 4 M3 20L21 16 M14 10a10 10 0 0 1 0 8 M9 14a5 5 0 0 1 0 4',
  pitchfan: 'M3 20L21 4 M3 20L21 10 M3 20L21 16 M21 4V16',
  gannbox: 'M3 3H21V21H3Z M3 9H21 M3 15H21 M9 3V21 M15 3V21',
  gannfix: 'M3 3H21V21H3Z M3 21L21 3 M3 3L21 21 M12 3V21 M3 12H21',
  gannsq: 'M3 3H21V21H3Z M3 21L21 9 M3 21L15 3 M3 21L21 3',
  gannfan: 'M3 21L21 3 M3 21L21 11 M3 21L11 3 M3 21L21 16 M3 21L16 3',
  xabcd: 'M2 18L7 4L11 14L16 7L22 20 M2 18L11 14 M11 14L22 20',
  cypher: 'M2 16L7 4L11 12L16 3L22 20 M2 16L11 12',
  hs: 'M2 20L5 12L8 16L12 4L16 16L19 12L22 20 M5 17H19',
  abcd: 'M3 20L9 5L15 14L21 3',
  triangle: 'M3 4L21 11L3 20Z M3 4L8 18L12 7L16 14',
  drives: 'M2 20L5 14L8 17L12 9L15 12L19 4L22 7',
  ew5: 'M2 20L6 12L9 15L15 4L18 9L22 2',
  ewabc: 'M3 4L10 18L14 11L21 20',
  ewtri: 'M2 6L7 18L11 9L15 16L18 11L22 14',
  ewwxy: 'M3 4L9 16L14 8L21 20',
  ewwxyxz: 'M2 4L6 14L9 8L13 17L16 11L22 21',
  cycles: 'M3 3V21 M8 3V21 M13 3V21 M18 3V21',
  timecyc: 'M2 18a4 4 0 0 1 8 0a4 4 0 0 1 8 0a3 3 0 0 1 4 0',
  sine: 'M2 12C5 2 8 2 11 12S17 22 22 12',
  measure: 'M3 17L17 3L21 7L7 21Z M7 13L9 15 M10 10L12 12 M13 7L15 9',
  long: 'M3 3H21V11H3Z M3 11H21V17H3Z M3 11H21',
  short: 'M3 7H21V13H3Z M3 13H21V21H3Z',
  prange: 'M12 3V21 M8 7L12 3L16 7 M8 17L12 21L16 17 M4 3H20 M4 21H20',
  drange: 'M3 12H21 M7 8L3 12L7 16 M17 8L21 12L17 16 M3 4V20 M21 4V20',
  dprange: 'M3 3H21V21H3Z M12 6V18 M6 12H18',
  rect: 'M3 6H21V18H3Z',
  ellipse: 'M12 12m-9 0a9 6 0 1 0 18 0a9 6 0 1 0 -18 0',
  arrow: 'M4 20L20 4 M12 4H20V12',
  text: 'M5 5H19 M12 5V20 M9 20H15',
  callout: 'M3 4H21V15H12L7 20V15H3Z',
};

// ---------- Pola gelombang generik ----------
function wave(labels) {
  return (g, P, d) => {
    g.poly(P);
    labelPoints(g, P, labels, d);
  };
}

export const CATEGORIES = [
  ['favorit', 'Favorit'],
  ['peralatan', 'Peralatan'],
  ['tren', 'Peralatan Tren'],
  ['fib', 'Gann dan Fibonacci'],
  ['motif', 'Motif'],
  ['proyeksi', 'Proyeksi dan Pengukuran'],
  ['volume', 'Berbasis Volume'],
  ['kuas', 'Kuas'],
  ['teks', 'Teks dan Catatan'],
  ['bentuk', 'Bentuk'],
];

// Alat utilitas (bukan gambar) untuk tab "Peralatan" — ditangani di app.js
export const UTILITIES = [
  { id: 'measure', name: 'Pengukuran', icon: I.measure, kind: 'tool' },
  { id: 'eraser', name: 'Penghapus', icon: 'M7 21H21 M4 15L14 5L20 11L12 19H8Z M9 10L15 16', kind: 'tool' },
  { id: 'angle', name: 'Penggaris sudut', icon: 'M4 20H20L4 4Z M4 14a6 6 0 0 1 6 6 M8 20V18 M12 20V18 M16 20V18', kind: 'toggle' },
  { id: 'stay', name: 'Tetap menggambar', icon: 'M4 20L15 9L19 13L8 24 M15 9L18 6L22 10L19 13 M13 17h6v6h-6z', kind: 'toggle' },
  { id: 'hide', name: 'Sembunyikan gambar', icon: 'M2 12C5 6 9 4 12 4S19 6 22 12C19 18 15 20 12 20S5 18 2 12Z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', kind: 'toggle' },
  { id: 'lock', name: 'Kunci seluruh gambar', icon: 'M6 11H18V21H6Z M8 11V7a4 4 0 0 1 8 0', kind: 'toggle' },
  { id: 'magnet', name: 'Magnet', icon: 'M6 3V12a6 6 0 0 0 12 0V3H14V12a2 2 0 0 1 -4 0V3Z', kind: 'magnet' },
  { id: 'clear', name: 'Hapus gambar', icon: 'M4 6H20 M9 6V3H15V6 M6 6L7 21H17L18 6', kind: 'action' },
  { id: 'zoomin', name: 'Perbesar', icon: 'M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M21 21L15 15 M10 7V13 M7 10H13', kind: 'tool' },
  { id: 'zoomout', name: 'Perkecil', icon: 'M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M21 21L15 15 M7 10H13', kind: 'action' },
];

export const TOOLS = {
  // ===================== PERALATAN TREN =====================
  trendline: { name: 'Garis Tren', cat: 'tren', n: 2, icon: I.trend, line: true, build: lineTool },
  ray: { name: 'Sinar', cat: 'tren', n: 2, icon: I.ray, line: true, defOpt: { extend: 'right' }, build: lineTool },
  infoline: { name: 'Garis Info', cat: 'tren', n: 2, icon: I.info, line: true, defOpt: { stats: 'full', alwaysStats: true }, build: lineTool },
  extended: { name: 'Garis Perpanjangan', cat: 'tren', n: 2, icon: I.ext, line: true, defOpt: { extend: 'both' }, build: lineTool },
  trendangle: {
    name: 'Sudut Tren', cat: 'tren', n: 2, icon: I.angle,
    build(g, [a, b]) {
      g.seg(a, b);
      const len = Math.max(30, Math.hypot(b.x - a.x, b.y - a.y) * 0.4);
      g.seg(a, { x: a.x + len * Math.sign(b.x - a.x || 1), y: a.y }, { dash: [4, 4] });
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const base = b.x >= a.x ? 0 : Math.PI;
      g.arc(a, len * 0.6, Math.min(base, ang), Math.max(base, ang));
      const deg = (Math.atan2(a.y - b.y, Math.abs(b.x - a.x)) * 180) / Math.PI;
      g.text(a.x + len * 0.7 * Math.sign(b.x - a.x || 1), a.y - 10, `${deg.toFixed(1)}°`, { font: '11px system-ui' });
    },
  },
  hline: {
    name: 'Garis Horizontal', cat: 'tren', n: 1, icon: I.hline,
    build(g, [a], d, c) { g.hline(a.y); g.text(c.plot.w - 6, a.y - 9, c.fmt(a.p), { align: 'right', font: '11px system-ui' }); },
  },
  hray: {
    name: 'Sinar Horizontal', cat: 'tren', n: 1, icon: I.hray,
    build(g, [a], d, c) { g.hline(a.y, a.x); g.text(a.x + 6, a.y - 9, c.fmt(a.p), { font: '11px system-ui' }); },
  },
  vline: { name: 'Garis Vertikal', cat: 'tren', n: 1, icon: I.vline, build: (g, [a]) => g.vline(a.x) },
  crossline: { name: 'Garis Persilangan', cat: 'tren', n: 1, icon: I.cross, build: (g, [a]) => g.vline(a.x).hline(a.y) },
  parallel: {
    name: 'Kanal Paralel', cat: 'tren', n: 3, icon: I.channel,
    build(g, [a, b, c3], d) {
      if (!c3) return g.seg(a, b);
      const t = b.x !== a.x ? (c3.x - a.x) / (b.x - a.x) : 0;
      const off = c3.y - (a.y + (b.y - a.y) * t);
      const a2 = { x: a.x, y: a.y + off }, b2 = { x: b.x, y: b.y + off };
      g.area([a, b, b2, a2], fillOf(d, 0.1));
      g.seg(a, b).seg(a2, b2).seg(mid(a, a2), mid(b, b2), { dash: [5, 5] });
    },
  },
  regression: {
    name: 'Tren Regresi', cat: 'tren', n: 2, icon: I.regr,
    build(g, [a, b], d, c) {
      const pts = c.closes(Math.min(a.i, b.i), Math.max(a.i, b.i));
      if (pts.length < 2) return g.seg(a, b, { dash: [4, 4] });
      const n = pts.length;
      let sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (const p of pts) { sx += p.i; sy += p.c; sxx += p.i * p.i; sxy += p.i * p.c; }
      const den = n * sxx - sx * sx || 1;
      const m = (n * sxy - sx * sy) / den, k = (sy - m * sx) / n;
      let dev = 0;
      for (const p of pts) dev += (p.c - (m * p.i + k)) ** 2;
      dev = Math.sqrt(dev / n) * 2;
      const i0 = pts[0].i, i1 = pts[n - 1].i;
      const P = (i, off) => ({ x: c.ix(i), y: c.py(m * i + k + off) });
      g.area([P(i0, dev), P(i1, dev), P(i1, 0), P(i0, 0)], rgba('#2962ff', 0.1));
      g.area([P(i0, 0), P(i1, 0), P(i1, -dev), P(i0, -dev)], rgba('#f23645', 0.1));
      g.seg(P(i0, 0), P(i1, 0), { color: '#f23645' });
      g.seg(P(i0, dev), P(i1, dev)).seg(P(i0, -dev), P(i1, -dev));
      g.seg(a, P(i0, 0), { dash: [2, 3], width: 1 }).seg(b, P(i1, 0), { dash: [2, 3], width: 1 });
    },
  },
  flattop: {
    name: 'Puncak/Dasar Datar', cat: 'tren', n: 3, icon: I.flat,
    build(g, [a, b, c3], d) {
      if (!c3) return g.seg(a, b);
      const a2 = { x: a.x, y: c3.y }, b2 = { x: b.x, y: c3.y };
      g.area([a, b, b2, a2], fillOf(d, 0.1));
      g.seg(a, b).seg(a2, b2);
    },
  },
  disjoint: {
    name: 'Kanal Disjoin', cat: 'tren', n: 3, icon: I.disjoint,
    build(g, [a, b, c3], d) {
      if (!c3) return g.seg(a, b);
      const a2 = { x: a.x, y: c3.y }, b2 = { x: b.x, y: c3.y - (b.y - a.y) };
      g.area([a, b, b2, a2], fillOf(d, 0.1));
      g.seg(a, b).seg(a2, b2);
    },
  },
  pitchfork: { name: 'Pitchfork', cat: 'tren', n: 3, icon: I.pitchfork, build: pitchfork('std') },
  schiff: { name: 'Schiff Pitchfork', cat: 'tren', n: 3, icon: I.pitchfork, build: pitchfork('schiff') },
  modschiff: { name: 'Pitchfork Schiff Termodifikasi', cat: 'tren', n: 3, icon: I.pitchfork, build: pitchfork('mod') },
  insidepf: { name: 'Pitchfork Dalam', cat: 'tren', n: 3, icon: I.pitchfork, build: pitchfork('inside') },

  // ===================== GANN & FIBONACCI =====================
  fibret: {
    name: 'Fib Retracement', cat: 'fib', n: 2, fib: FIB_RET.slice(0, 9), icon: I.fibret,
    build(g, [a, b], d, c) {
      g.seg(a, b, { dash: [4, 4], color: '#787b86' });
      fibLevels(g, c, Math.min(a.x, b.x), Math.max(a.x, b.x), d.opt?.levels || defaultLevels(FIB_RET.slice(0, 9)), lv => b.p + (a.p - b.p) * lv, d);
    },
  },
  fibext: {
    name: 'Fib Ekstensi Berbasis Tren', cat: 'fib', n: 3, fib: FIB_EXT, icon: I.fibext,
    build(g, [a, b, c3], d, c) {
      g.seg(a, b, { dash: [4, 4], color: '#787b86' });
      if (!c3) return;
      g.seg(b, c3, { dash: [4, 4], color: '#787b86' });
      fibLevels(g, c, Math.min(b.x, c3.x), Math.max(b.x, c3.x) + 40, d.opt?.levels || defaultLevels(FIB_EXT), lv => c3.p + (b.p - a.p) * lv, d);
    },
  },
  fibchannel: {
    name: 'Fib Kanal', cat: 'fib', n: 3, icon: I.fibchan,
    build(g, [a, b, c3]) {
      if (!c3) return g.seg(a, b);
      const t = b.x !== a.x ? (c3.x - a.x) / (b.x - a.x) : 0;
      const off = c3.y - (a.y + (b.y - a.y) * t);
      [0, 0.382, 0.618, 1, 1.618, 2.618].forEach((lv, k) => {
        const col = LV[k % LV.length];
        const a2 = { x: a.x, y: a.y + off * lv }, b2 = { x: b.x, y: b.y + off * lv };
        g.ray(a2, b2, { color: col });
        g.text(a2.x - 4, a2.y, String(lv), { align: 'right', color: col, font: '11px system-ui' });
      });
    },
  },
  fibtimezone: {
    name: 'Fib Zona Waktu', cat: 'fib', n: 2, icon: I.fibtime,
    build(g, [a, b], d, c) {
      const step = b.i - a.i;
      g.seg(a, b, { dash: [4, 4], color: '#787b86' });
      if (Math.abs(step) < 1e-6) return;
      [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144].forEach((f, k) => {
        const x = c.ix(a.i + step * f), col = LV[k % LV.length];
        g.vline(x, { color: col });
        g.text(x + 3, c.plot.h - 12, String(f), { color: col, font: '11px system-ui' });
      });
    },
  },
  fibfan: {
    name: 'Fib Kipas Resisten Kecepatan', cat: 'fib', n: 2, icon: I.fan,
    build(g, [a, b]) {
      const L = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1];
      g.poly([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }, a], { color: '#787b86', dash: [2, 3], width: 1 });
      L.forEach((lv, k) => {
        const col = LV[k % LV.length];
        if (lv > 0) g.ray(a, { x: b.x, y: a.y + (b.y - a.y) * lv }, { color: col });
        if (lv > 0 && lv < 1) g.ray(a, { x: a.x + (b.x - a.x) * lv, y: b.y }, { color: col });
        g.seg({ x: a.x, y: a.y + (b.y - a.y) * lv }, { x: b.x, y: a.y + (b.y - a.y) * lv }, { color: col, width: 1, dash: [1, 3] });
        g.text(b.x + 4, a.y + (b.y - a.y) * lv, String(lv), { color: col, font: '10px system-ui' });
      });
    },
  },
  fibtrendtime: {
    name: 'Fib Waktu Berbasis Tren', cat: 'fib', n: 3, icon: I.fibtime,
    build(g, [a, b, c3], d, c) {
      g.seg(a, b, { dash: [4, 4], color: '#787b86' });
      if (!c3) return;
      g.seg(b, c3, { dash: [4, 4], color: '#787b86' });
      const step = b.i - a.i;
      [0, 0.382, 0.5, 0.618, 1, 1.382, 1.618, 2, 2.382, 2.618, 3, 3.618, 4.236].forEach((lv, k) => {
        const x = c.ix(c3.i + step * lv), col = LV[k % LV.length];
        g.vline(x, { color: col });
        g.text(x + 3, 14, String(lv), { color: col, font: '10px system-ui' });
      });
    },
  },
  fibcircles: {
    name: 'Fib Lingkaran', cat: 'fib', n: 2, icon: I.circles,
    build(g, [a, b]) {
      const cen = mid(a, b), R = Math.hypot(b.x - a.x, b.y - a.y) / 2;
      g.seg(a, b, { dash: [4, 4], color: '#787b86' });
      [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618, 3.618, 4.236].forEach((lv, k) => g.circle(cen, R * lv, { color: LV[(k + 1) % LV.length] }));
    },
  },
  fibspiral: {
    name: 'Fib Spiral', cat: 'fib', n: 2, icon: I.spiral,
    build(g, [a, b]) {
      const R = Math.hypot(b.x - a.x, b.y - a.y), a0 = Math.atan2(b.y - a.y, b.x - a.x), phi = 1.6180339887;
      const pts = [];
      for (let th = -6 * Math.PI; th <= 2 * Math.PI; th += 0.05) {
        const r = R * phi ** ((2 * th) / Math.PI);
        if (r > 1e5) break;
        pts.push({ x: a.x + r * Math.cos(a0 - th), y: a.y + r * Math.sin(a0 - th) });
      }
      g.seg(a, b, { dash: [4, 4], color: '#787b86' });
      g.poly(pts);
    },
  },
  fibarcs: {
    name: 'Fib Busur Resisten Kecepatan', cat: 'fib', n: 2, icon: I.arcs,
    build(g, [a, b]) {
      const R = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      g.seg(a, b, { dash: [4, 4], color: '#787b86' });
      [0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618].forEach((lv, k) =>
        g.arc(b, R * lv, ang - Math.PI / 2 + Math.PI, ang + Math.PI / 2 + Math.PI, { color: LV[(k + 1) % LV.length] }));
    },
  },
  fibwedge: {
    name: 'Fib Baji', cat: 'fib', n: 3, icon: I.wedge,
    build(g, [a, b, c3]) {
      g.seg(a, b);
      if (!c3) return;
      const R = Math.hypot(b.x - a.x, b.y - a.y);
      const a1 = Math.atan2(b.y - a.y, b.x - a.x);
      let a2 = Math.atan2(c3.y - a.y, c3.x - a.x);
      const d = dir(a, c3);
      if (d) g.seg(a, { x: a.x + d.x * R, y: a.y + d.y * R });
      let lo = a1, hi = a2;
      if (((hi - lo) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) > Math.PI) [lo, hi] = [a2, a1];
      if (hi < lo) hi += Math.PI * 2;
      [0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach((lv, k) => g.arc(a, R * lv, lo, hi, { color: LV[(k + 1) % LV.length] }));
    },
  },
  pitchfan: {
    name: 'Pitchfan', cat: 'fib', n: 3, icon: I.pitchfan,
    build(g, [a, b, c3]) {
      g.seg(a, b);
      if (!c3) return;
      g.seg(b, c3);
      [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach((lv, k) => g.ray(a, lerp(b, c3, lv), { color: LV[k % LV.length] }));
    },
  },
  gannbox: {
    name: 'Kotak Gann', cat: 'fib', n: 2, icon: I.gannbox,
    build(g, [a, b]) {
      const L = [0, 0.25, 0.382, 0.5, 0.618, 0.75, 1];
      L.forEach((lv, k) => {
        const col = LV[k % LV.length];
        const y = a.y + (b.y - a.y) * lv, x = a.x + (b.x - a.x) * lv;
        g.seg({ x: a.x, y }, { x: b.x, y }, { color: col });
        g.seg({ x, y: a.y }, { x, y: b.y }, { color: col });
        g.text(a.x - 4, y, String(lv), { align: 'right', color: col, font: '10px system-ui' });
        g.text(x, Math.max(a.y, b.y) + 10, String(lv), { align: 'center', color: col, font: '10px system-ui' });
      });
      g.area([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }], 'rgba(41,98,255,.05)');
    },
  },
  gannfixed: {
    name: 'Kotak Gann Paten', cat: 'fib', n: 2, icon: I.gannfix,
    build(g, [a, b]) {
      const c1 = { x: b.x, y: a.y }, c2 = { x: a.x, y: b.y };
      g.poly([a, c1, b, c2, a]);
      g.seg(a, b).seg(c1, c2);
      for (let k = 1; k < 8; k++) {
        const t = k / 8;
        g.seg(lerp(a, c1, t), lerp(c2, b, t), { width: 1, color: '#787b86' });
        g.seg(lerp(a, c2, t), lerp(c1, b, t), { width: 1, color: '#787b86' });
      }
      const w = b.x - a.x, h = b.y - a.y;
      g.ellipse(mid(a, b), w / 2, h / 2, 0, { color: '#ff9800' });
    },
  },
  gannsquare: {
    name: 'Persegi Gann', cat: 'fib', n: 2, icon: I.gannsq,
    build(g, [a, b]) {
      const c1 = { x: b.x, y: a.y }, c2 = { x: a.x, y: b.y };
      g.area([a, c1, b, c2], 'rgba(255,152,0,.06)');
      g.poly([a, c1, b, c2, a]);
      [0.25, 0.382, 0.5, 0.618, 0.75].forEach((lv, k) => {
        const col = LV[(k + 1) % LV.length];
        g.seg(lerp(a, c2, lv), lerp(c1, b, lv), { color: col, width: 1 });
        g.seg(lerp(a, c1, lv), lerp(c2, b, lv), { color: col, width: 1 });
        g.seg(a, lerp(c2, b, lv), { color: col, width: 1, dash: [3, 3] });
        g.seg(a, lerp(c1, b, lv), { color: col, width: 1, dash: [3, 3] });
      });
      g.seg(a, b, { color: '#f23645' });
    },
  },
  gannfan: {
    name: 'Kipas Gann', cat: 'fib', n: 2, icon: I.gannfan,
    build(g, [a, b]) {
      const R = [[1, 8], [1, 4], [1, 3], [1, 2], [1, 1], [2, 1], [3, 1], [4, 1], [8, 1]];
      const dx = b.x - a.x, dy = b.y - a.y;
      R.forEach(([p, t], k) => {
        const col = LV[k % LV.length];
        const e = { x: a.x + dx * Math.min(1, t / p), y: a.y + dy * Math.min(1, p / t) };
        g.ray(a, e, { color: col });
        g.text(e.x + 4, e.y, `${p}/${t}`, { color: col, font: '10px system-ui' });
      });
    },
  },

  // ===================== MOTIF / POLA =====================
  xabcd: {
    name: 'Motif XABCD', cat: 'motif', n: 5, icon: I.xabcd,
    build(g, P, d) {
      const [X, A, B, C, D] = P;
      if (B) g.area([X, A, B], fillOf(d, 0.15));
      if (D) g.area([B, C, D], fillOf(d, 0.15));
      g.poly(P);
      if (B) g.seg(X, B, { dash: [4, 4] });
      if (D) { g.seg(B, D, { dash: [4, 4] }); g.seg(X, D, { dash: [4, 4] }); }
      if (B) ratioLabel(g, X, B, Math.abs((B.p - A.p) / (A.p - X.p)));
      if (C) ratioLabel(g, A, C, Math.abs((C.p - B.p) / (B.p - A.p)));
      if (D) { ratioLabel(g, B, D, Math.abs((D.p - C.p) / (C.p - B.p))); ratioLabel(g, X, D, Math.abs((D.p - A.p) / (A.p - X.p))); }
      labelPoints(g, P, ['X', 'A', 'B', 'C', 'D'], d);
    },
  },
  cypher: {
    name: 'Motif Cypher', cat: 'motif', n: 5, icon: I.cypher,
    build(g, P, d) {
      const [X, A, B, C, D] = P;
      if (B) g.area([X, A, B], fillOf(d, 0.15));
      if (D) g.area([B, C, D], fillOf(d, 0.15));
      g.poly(P);
      if (B) ratioLabel(g, X, B, Math.abs((B.p - A.p) / (A.p - X.p)));
      if (C) ratioLabel(g, A, C, Math.abs((C.p - X.p) / (A.p - X.p)));
      if (D) ratioLabel(g, X, D, Math.abs((C.p - D.p) / (C.p - X.p)));
      labelPoints(g, P, ['X', 'A', 'B', 'C', 'D'], d);
    },
  },
  headshoulders: {
    name: 'Head dan Shoulder', cat: 'motif', n: 7, icon: I.hs,
    build(g, P, d) {
      g.poly(P);
      if (P[4]) {
        g.line(P[2], P[4], { dash: [5, 4] });
        g.area([P[1], P[2], P[4], P[5] || P[4]].filter(Boolean), fillOf(d, 0.1));
      }
      labelPoints(g, P, ['', 'Bahu Kiri', '', 'Kepala', '', 'Bahu Kanan', ''], d);
    },
  },
  abcd: {
    name: 'Motif ABCD', cat: 'motif', n: 4, icon: I.abcd,
    build(g, P, d) {
      const [A, B, C, D] = P;
      g.poly(P);
      if (C) { g.seg(A, C, { dash: [4, 4] }); ratioLabel(g, A, C, Math.abs((C.p - B.p) / (B.p - A.p))); }
      if (D) { g.seg(B, D, { dash: [4, 4] }); ratioLabel(g, B, D, Math.abs((D.p - C.p) / (C.p - B.p))); }
      labelPoints(g, P, ['A', 'B', 'C', 'D'], d);
    },
  },
  trianglepat: {
    name: 'Motif Segitiga', cat: 'motif', n: 4, icon: I.triangle,
    build(g, P, d) {
      g.poly(P);
      if (P[2]) g.seg(P[0], P[2], { dash: [4, 4] });
      if (P[3]) {
        g.seg(P[1], P[3], { dash: [4, 4] });
        g.area([P[0], P[1], P[3], P[2]], fillOf(d, 0.12));
      }
      labelPoints(g, P, ['A', 'B', 'C', 'D'], d);
    },
  },
  threedrives: {
    name: 'Three Drives Pattern', cat: 'motif', n: 7, icon: I.drives,
    build(g, P, d) {
      g.poly(P);
      labelPoints(g, P, ['', 'Drive 1', '', 'Drive 2', '', 'Drive 3', ''], d);
      if (P[3]) ratioLabel(g, P[1], P[3], Math.abs((P[3].p - P[2].p) / (P[1].p - P[2].p)));
      if (P[5]) ratioLabel(g, P[3], P[5], Math.abs((P[5].p - P[4].p) / (P[3].p - P[4].p)));
    },
  },
  ewimpulse: { name: 'Gelombang Impulse Elliott (1·2·3·4·5)', cat: 'motif', n: 6, icon: I.ew5, build: wave(['', '(1)', '(2)', '(3)', '(4)', '(5)']) },
  ewcorrect: { name: 'Gelombang Koreksi Elliott (A·B·C)', cat: 'motif', n: 4, icon: I.ewabc, build: wave(['', '(A)', '(B)', '(C)']) },
  ewtriangle: { name: 'Gelombang Segitiga Elliott (A·B·C·D·E)', cat: 'motif', n: 6, icon: I.ewtri, build: wave(['', '(A)', '(B)', '(C)', '(D)', '(E)']) },
  ewdouble: { name: 'Gelombang Kombo Dobel Elliott (W·X·Y)', cat: 'motif', n: 4, icon: I.ewwxy, build: wave(['', '(W)', '(X)', '(Y)']) },
  ewtriple: { name: 'Gelombang Kombo Tripel Elliott (W·X·Y·X·Z)', cat: 'motif', n: 6, icon: I.ewwxyxz, build: wave(['', '(W)', '(X)', '(Y)', '(X)', '(Z)']) },
  cyclelines: {
    name: 'Garis Siklus', cat: 'motif', n: 2, icon: I.cycles,
    build(g, [a, b], d, c) {
      const step = b.i - a.i;
      if (Math.abs(step) < 0.5) return g.vline(a.x);
      const s = Math.abs(step);
      const kMin = Math.floor((c.xi(0) - a.i) / s) - 1, kMax = Math.ceil((c.xi(c.plot.w) - a.i) / s) + 1;
      for (let k = Math.max(0, kMin); k <= kMax; k++) g.vline(c.ix(a.i + s * k));
    },
  },
  timecycles: {
    name: 'Siklus Waktu', cat: 'motif', n: 2, icon: I.timecyc,
    build(g, [a, b], d, c) {
      const s = Math.abs(b.i - a.i);
      if (s < 0.5) return;
      const r = (c.ix(a.i + s) - c.ix(a.i)) / 2;
      const kMax = Math.ceil((c.xi(c.plot.w) - a.i) / s) + 1;
      for (let k = 0; k <= kMax; k++) {
        const cx = c.ix(a.i + s * k) + r;
        g.arc({ x: cx, y: a.y }, r, Math.PI, Math.PI * 2, { fill: fillOf(d, 0.08) });
      }
      g.hline(a.y, a.x, c.plot.w, { dash: [3, 3], width: 1 });
    },
  },
  sine: {
    name: 'Garis Sinus', cat: 'motif', n: 2, icon: I.sine,
    build(g, [a, b], d, c) {
      const half = b.x - a.x;
      if (Math.abs(half) < 2) return g.seg(a, b);
      const amp = (a.y - b.y) / 2, cy = (a.y + b.y) / 2;
      const pts = [];
      for (let x = 0; x <= c.plot.w; x += 3) pts.push({ x, y: cy + amp * Math.cos((Math.PI * (x - a.x)) / half) });
      g.poly(pts);
    },
  },

  // ===================== PROYEKSI & PENGUKURAN =====================
  measure: {
    name: 'Pengukuran', cat: 'proyeksi', n: 2, icon: I.measure, temp: true,
    build(g, [a, b], d, c) { measureBox(g, a, b, c, true, true); },
  },
  longpos: { name: 'Posisi Long', cat: 'proyeksi', n: 3, icon: I.long, build: position(1), constrain: posConstrain },
  shortpos: { name: 'Posisi Short', cat: 'proyeksi', n: 3, icon: I.short, build: position(-1), constrain: posConstrain },
  pricerange: { name: 'Rentang Harga', cat: 'proyeksi', n: 2, icon: I.prange, build: (g, [a, b], d, c) => measureBox(g, a, b, c, true, false) },
  daterange: { name: 'Rentang Tanggal', cat: 'proyeksi', n: 2, icon: I.drange, build: (g, [a, b], d, c) => measureBox(g, a, b, c, false, true) },
  dateprice: { name: 'Rentang Tanggal dan Harga', cat: 'proyeksi', n: 2, icon: I.dprange, build: (g, [a, b], d, c) => measureBox(g, a, b, c, true, true) },

  // ===================== BERBASIS VOLUME =====================
  avwap: {
    name: 'VWAP Berjangkar', cat: 'volume', n: 1, icon: 'M3 18C8 16 10 8 14 9S19 6 21 5 M3 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    build(g, [a], d, c) {
      const bars = c.bars(a.i, c.lastIndex());
      let pv = 0, vol = 0; const pts = [];
      for (const b of bars) { const tp = (b.h + b.l + b.c) / 3, w = b.v || 1; pv += tp * w; vol += w; pts.push({ x: c.ix(b.i), y: c.py(pv / vol) }); }
      if (pts.length < 2) return g.seg(a, { x: a.x + 1, y: a.y });
      g.poly(pts);
      const l = pts[pts.length - 1];
      g.text(l.x + 6, l.y, `VWAP ${c.fmt(c.yp(l.y))}`, { font: '11px system-ui' });
    },
  },
  volprofile: {
    name: 'Profil Volume Rentang Tetap', cat: 'volume', n: 2, icon: 'M3 3V21 M3 5H10 M3 8H15 M3 11H21 M3 14H13 M3 17H8 M3 20H5',
    build(g, [a, b], d, c) {
      const i0 = Math.min(a.i, b.i), i1 = Math.max(a.i, b.i);
      const bars = c.bars(i0, i1);
      const x0 = c.ix(i0), x1 = c.ix(i1);
      if (!bars.length) return g.poly([{ x: x0, y: a.y }, { x: x1, y: a.y }, { x: x1, y: b.y }, { x: x0, y: b.y }, { x: x0, y: a.y }], { dash: [4, 4] });
      let lo = Infinity, hi = -Infinity;
      for (const k of bars) { lo = Math.min(lo, k.l); hi = Math.max(hi, k.h); }
      const rows = 24, step = (hi - lo) / rows || 1, up = new Array(rows).fill(0), dn = new Array(rows).fill(0);
      for (const k of bars) {
        const r0 = Math.max(0, Math.floor((k.l - lo) / step)), r1 = Math.min(rows - 1, Math.floor((k.h - lo) / step));
        const share = (k.v || 1) / (r1 - r0 + 1);
        for (let r = r0; r <= r1; r++) (k.c >= k.o ? up : dn)[r] += share;
      }
      const tot = up.map((v, r) => v + dn[r]), max = Math.max(...tot), poc = tot.indexOf(max);
      // area nilai 70%
      const all = tot.reduce((s2, v) => s2 + v, 0);
      let va = tot[poc], lo2 = poc, hi2 = poc;
      while (va < all * 0.7 && (lo2 > 0 || hi2 < rows - 1)) {
        const nl = lo2 > 0 ? tot[lo2 - 1] : -1, nh = hi2 < rows - 1 ? tot[hi2 + 1] : -1;
        if (nh >= nl) va += tot[++hi2]; else va += tot[--lo2];
      }
      const W = Math.max(40, (x1 - x0) * 0.7);
      g.area([{ x: x0, y: c.py(hi) }, { x: x1, y: c.py(hi) }, { x: x1, y: c.py(lo) }, { x: x0, y: c.py(lo) }], 'rgba(41,98,255,.04)');
      for (let r = 0; r < rows; r++) {
        const yT = c.py(lo + (r + 1) * step) + 1, yB = c.py(lo + r * step) - 1;
        const inVA = r >= lo2 && r <= hi2;
        const wu = (up[r] / max) * W, wd = (dn[r] / max) * W;
        g.area([{ x: x0, y: yT }, { x: x0 + wu, y: yT }, { x: x0 + wu, y: yB }, { x: x0, y: yB }], inVA ? 'rgba(8,153,129,.55)' : 'rgba(8,153,129,.25)');
        g.area([{ x: x0 + wu, y: yT }, { x: x0 + wu + wd, y: yT }, { x: x0 + wu + wd, y: yB }, { x: x0 + wu, y: yB }], inVA ? 'rgba(242,54,69,.55)' : 'rgba(242,54,69,.25)');
      }
      const pocY = c.py(lo + (poc + 0.5) * step);
      g.seg({ x: x0, y: pocY }, { x: x1, y: pocY }, { color: '#f23645', width: 2, dash: [] });
      g.text(x1 + 4, pocY, `POC ${c.fmt(lo + (poc + 0.5) * step)}`, { color: '#f23645', font: '11px system-ui' });
      g.seg({ x: x0, y: c.py(hi) }, { x: x0, y: c.py(lo) }, { width: 1, dash: [] });
    },
  },

  // ===================== KUAS =====================
  brush: {
    name: 'Kuas', cat: 'kuas', n: 0, freehand: true, icon: 'M3 21c3 0 4-2 4-4s2-3 4-1-1 5-8 5Z M11 15L20 4',
    build: (g, P) => g.poly(P),
  },
  highlighter: {
    name: 'Stabilo', cat: 'kuas', n: 0, freehand: true, icon: 'M4 20H12 M7 16L15 4L20 8L12 20Z',
    defStyle: { color: '#ffeb3b', width: 3, dash: [] },
    build: (g, P, d) => g.poly(P, { width: d.style.width * 5, color: fillOf(d, 0.4) }),
  },

  // ===================== TEKS DAN CATATAN =====================
  pricelabel: {
    name: 'Label Harga', cat: 'teks', n: 1, icon: 'M3 8H15L21 12L15 16H3Z',
    build(g, [a], d, c) {
      g.circle(a, 3, { fill: d.style.color });
      g.text(a.x + 10, a.y - 16, c.fmt(a.p), { color: '#fff', bg: d.style.color, font: 'bold 11px system-ui', hit: true });
      g.seg(a, { x: a.x + 8, y: a.y - 12 });
    },
  },
  pricenote: {
    name: 'Catatan Harga', cat: 'teks', n: 2, icon: 'M3 20L14 9 M14 5H21V12H14Z',
    build(g, [a, b], d, c) {
      g.seg(a, b); g.circle(a, 3, { fill: d.style.color });
      g.text(b.x, b.y - 2, c.fmt(a.p), { color: '#fff', bg: d.style.color, align: 'center', base: 'bottom', font: 'bold 11px system-ui', hit: true });
    },
  },
  flag: {
    name: 'Bendera', cat: 'teks', n: 1, icon: 'M5 21V3 M5 4H18L15 8L18 12H5',
    build(g, [a], d) {
      g.seg(a, { x: a.x, y: a.y - 30 }, { width: 2 });
      g.area([{ x: a.x, y: a.y - 30 }, { x: a.x + 22, y: a.y - 30 }, { x: a.x + 16, y: a.y - 24 }, { x: a.x + 22, y: a.y - 18 }, { x: a.x, y: a.y - 18 }], d.style.color);
    },
  },
  signpost: {
    name: 'Penanda', cat: 'teks', n: 1, needsText: true, icon: 'M12 21V9 M5 3H19V9H5Z',
    build(g, [a], d, c) {
      g.seg({ x: a.x, y: a.y }, { x: a.x, y: a.y - 34 }, { width: 1, dash: [3, 3] });
      g.circle(a, 3, { fill: d.style.color });
      g.text(a.x, a.y - 36, d.text || 'Penanda', { color: '#fff', bg: d.style.color, align: 'center', base: 'bottom', font: '12px system-ui', hit: true });
    },
  },
  note: {
    name: 'Komentar', cat: 'teks', n: 1, needsText: true, icon: 'M4 4H20V16H9L4 20Z',
    build(g, [a], d) {
      const t = d.text || 'Komentar';
      g.text(a.x + 4, a.y - 14, t, { color: '#131722', bg: fillOf(d, 0.25), font: '12px system-ui', hit: true });
      g.poly([a, { x: a.x + 4, y: a.y - 6 }, { x: a.x + 12, y: a.y - 6 }], { fill: fillOf(d, 0.25), close: true, stroke: false });
    },
  },
  arrowup: {
    name: 'Penanda Panah Naik', cat: 'teks', n: 1, icon: 'M12 20V5 M6 11L12 5L18 11',
    defStyle: { color: '#089981', width: 2, dash: [] },
    build: (g, [a], d) => g.area([{ x: a.x, y: a.y }, { x: a.x + 9, y: a.y + 12 }, { x: a.x + 4, y: a.y + 12 }, { x: a.x + 4, y: a.y + 24 }, { x: a.x - 4, y: a.y + 24 }, { x: a.x - 4, y: a.y + 12 }, { x: a.x - 9, y: a.y + 12 }], d.style.color),
  },
  arrowdown: {
    name: 'Penanda Panah Turun', cat: 'teks', n: 1, icon: 'M12 4V19 M6 13L12 19L18 13',
    defStyle: { color: '#f23645', width: 2, dash: [] },
    build: (g, [a], d) => g.area([{ x: a.x, y: a.y }, { x: a.x + 9, y: a.y - 12 }, { x: a.x + 4, y: a.y - 12 }, { x: a.x + 4, y: a.y - 24 }, { x: a.x - 4, y: a.y - 24 }, { x: a.x - 4, y: a.y - 12 }, { x: a.x - 9, y: a.y - 12 }], d.style.color),
  },

  // ===================== BENTUK =====================
  rotrect: {
    name: 'Persegi Diputar', cat: 'bentuk', n: 3, icon: 'M3 12L12 3L21 12L12 21Z',
    build(g, [a, b, c3], d) {
      if (!c3) return g.seg(a, b);
      const dv = dir(a, b); if (!dv) return;
      const nx = -dv.y, ny = dv.x, off = (c3.x - a.x) * nx + (c3.y - a.y) * ny;
      const pts = [a, b, { x: b.x + nx * off, y: b.y + ny * off }, { x: a.x + nx * off, y: a.y + ny * off }];
      g.area(pts, fillOf(d, 0.15)).poly([...pts, a]);
    },
  },
  circle: {
    name: 'Lingkaran', cat: 'bentuk', n: 2, icon: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    build: (g, [a, b], d) => g.circle(a, Math.hypot(b.x - a.x, b.y - a.y), { fill: fillOf(d, 0.15) }),
  },
  triangle: {
    name: 'Segitiga', cat: 'bentuk', n: 3, icon: 'M12 3L22 20H2Z',
    build: (g, P, d) => P.length < 3 ? g.seg(P[0], P[1]) : g.area(P, fillOf(d, 0.15)).poly([...P, P[0]]),
  },
  arcshape: {
    name: 'Busur', cat: 'bentuk', n: 3, icon: 'M3 18Q12 0 21 18',
    build: (g, P, d) => P.length < 3 ? g.seg(P[0], P[1]) : g.poly(quad(P[0], ctrlThrough(P[0], P[2], P[1]), P[2]), { fill: fillOf(d, 0.12), close: true }),
  },
  curve: {
    name: 'Kurva', cat: 'bentuk', n: 3, icon: 'M3 18Q8 2 21 12',
    build: (g, P) => P.length < 3 ? g.seg(P[0], P[1]) : g.poly(quad(P[0], P[2], P[1])).seg(P[0], P[2], { dash: [2, 3], width: 1, color: '#9598a1' }).seg(P[2], P[1], { dash: [2, 3], width: 1, color: '#9598a1' }),
  },
  doublecurve: {
    name: 'Kurva Ganda', cat: 'bentuk', n: 4, icon: 'M2 12C6 0 10 0 12 12S18 24 22 12',
    build: (g, P) => P.length < 4 ? g.poly(P) : g.poly(cubic(P[0], P[2], P[3], P[1])),
  },
  path: {
    name: 'Jalur', cat: 'bentuk', n: Infinity, icon: 'M3 20L8 10L14 14L21 4 M18 4H21V7',
    build: (g, P) => { g.poly(P); if (P.length > 1) g.arrowHead(P[P.length - 2], P[P.length - 1], 10); },
  },
  polyline: {
    name: 'Polyline', cat: 'bentuk', n: Infinity, icon: 'M3 18L8 6L16 9L21 19Z',
    build: (g, P, d) => P.length > 2 ? g.area(P, fillOf(d, 0.12)).poly([...P, P[0]]) : g.poly(P),
  },

  // ===================== BENTUK & TEKS (lama) =====================
  rect: {
    name: 'Persegi Panjang', cat: 'bentuk', n: 2, icon: I.rect,
    build: (g, [a, b], d) => g.area([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }], fillOf(d, 0.15)).poly([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }, a]),
  },
  ellipse: {
    name: 'Elips', cat: 'bentuk', n: 2, icon: I.ellipse,
    build: (g, [a, b], d) => g.ellipse(mid(a, b), (b.x - a.x) / 2, (b.y - a.y) / 2, 0, { fill: fillOf(d, 0.15) }),
  },
  arrow: { name: 'Panah', cat: 'bentuk', n: 2, icon: I.arrow, line: true, defOpt: { rightEnd: 'arrow' }, build: lineTool },
  text: {
    name: 'Teks', cat: 'teks', n: 1, icon: I.text, needsText: true,
    build: (g, [a], d) => g.text(a.x, a.y, d.text || 'Teks', { font: `${(d.style.width || 1) * 4 + 10}px system-ui`, hit: true, dash: [] }),
  },
  callout: {
    name: 'Catatan', cat: 'teks', n: 2, icon: I.callout, needsText: true,
    build(g, [a, b], d) {
      g.seg(a, b);
      g.text(b.x, b.y, d.text || 'Catatan', { color: '#fff', bg: d.style.color, align: 'center', font: '13px system-ui', hit: true });
    },
  },
};

function quad(a, c, b, n = 32) {
  const out = [];
  for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t; out.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }); }
  return out;
}
function cubic(a, c1, c2, b, n = 48) {
  const out = [];
  for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t; out.push({ x: u ** 3 * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t ** 3 * b.x, y: u ** 3 * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t ** 3 * b.y }); }
  return out;
}
// titik kontrol agar kurva kuadrat melewati titik m di t=0.5
function ctrlThrough(a, b, m) { return { x: 2 * m.x - (a.x + b.x) / 2, y: 2 * m.y - (a.y + b.y) / 2 }; }

// ---------- Alat garis generik (Garis Tren, Sinar, Garis Info, Perpanjangan, Panah) ----------
export const opt = (d, k) => d.opt?.[k] ?? TOOLS[d.tool].defOpt?.[k] ?? OPT_DEF[k];
const OPT_DEF = { extend: 'none', leftEnd: 'normal', rightEnd: 'normal', middle: false, priceLabels: false, stats: 'hidden', statsPos: 'right', alwaysStats: false };
function lineTool(g, P, d, c) {
  const [a, b] = P;
  if (!b) return;
  const ext = opt(d, 'extend'), dv = dir(a, b);
  let s = a, e = b;
  if (dv && (ext === 'left' || ext === 'both')) s = { x: a.x - dv.x * 1e5, y: a.y - dv.y * 1e5 };
  if (dv && (ext === 'right' || ext === 'both')) e = { x: b.x + dv.x * 1e5, y: b.y + dv.y * 1e5 };
  g.seg(s, e);
  const ah = 8 + d.style.width * 2;
  if (opt(d, 'rightEnd') === 'arrow') g.arrowHead(a, b, ah, { dash: [] });
  if (opt(d, 'leftEnd') === 'arrow') g.arrowHead(b, a, ah, { dash: [] });
  if (opt(d, 'middle')) g.circle(mid(a, b), 3 + d.style.width, { fill: d.style.color });
  if (opt(d, 'priceLabels')) {
    g.text(a.x, a.y + (a.y >= b.y ? 12 : -12), c.fmt(a.p), { align: 'center', color: '#fff', bg: d.style.color, font: '11px system-ui' });
    g.text(b.x, b.y + (b.y > a.y ? 12 : -12), c.fmt(b.p), { align: 'center', color: '#fff', bg: d.style.color, font: '11px system-ui' });
  }
  const st = opt(d, 'stats');
  if (st !== 'hidden' && (opt(d, 'alwaysStats') || c.selected)) {
    const dp = b.p - a.p, bars = Math.round(b.i - a.i);
    const ang = (Math.atan2(a.y - b.y, b.x - a.x) * 180) / Math.PI;
    const lines = [`${c.fmt(dp)} (${pct(a.p, b.p).toFixed(2)}%)`];
    if (st === 'values' || st === 'full') lines.push(`${bars} bar, ${c.dur(bars)}`);
    if (st === 'full') lines.push(`${ang.toFixed(1)}°`);
    const pos = opt(d, 'statsPos'), anchor = pos === 'left' ? a : pos === 'center' ? mid(a, b) : b;
    const al = pos === 'left' ? 'right' : pos === 'center' ? 'center' : 'left', dx = pos === 'left' ? -12 : pos === 'center' ? 0 : 12;
    lines.forEach((t, k) => g.text(anchor.x + dx, anchor.y + (k - (lines.length - 1) / 2) * 20, t, { align: al, bg: 'rgba(30,34,45,.88)', color: '#fff', font: '11px system-ui' }));
  }
}

function posConstrain(pts) {
  if (pts[2]) pts[2].t = pts[0].t;
}
function position(side) {
  return (g, [a, b, s], d, c) => {
    const x0 = a.x, x1 = b ? Math.max(b.x, a.x + 40) : a.x + 80;
    const tgt = b ? b.y : a.y;
    const stop = s ? s.y : a.y + (a.y - tgt);
    const stopP = s ? s.p : a.p - (b.p - a.p);
    g.area([{ x: x0, y: a.y }, { x: x1, y: a.y }, { x: x1, y: tgt }, { x: x0, y: tgt }], 'rgba(8,153,129,.22)');
    g.area([{ x: x0, y: a.y }, { x: x1, y: a.y }, { x: x1, y: stop }, { x: x0, y: stop }], 'rgba(242,54,69,.22)');
    g.seg({ x: x0, y: a.y }, { x: x1, y: a.y }, { color: '#787b86' });
    const reward = (b.p - a.p) * side, risk = (a.p - stopP) * side;
    const rr = risk > 0 ? (reward / risk).toFixed(2) : '∞';
    const xm = (x0 + x1) / 2;
    g.text(xm, tgt + (tgt < a.y ? -12 : 12), `Target: ${c.fmt(b.p)} (${pct(a.p, b.p).toFixed(2)}%)`, { align: 'center', color: '#fff', bg: '#089981', font: '11px system-ui' });
    g.text(xm, stop + (stop > a.y ? 12 : -12), `Stop: ${c.fmt(stopP)} (${pct(a.p, stopP).toFixed(2)}%)`, { align: 'center', color: '#fff', bg: '#f23645', font: '11px system-ui' });
    g.text(xm, a.y, `${side > 0 ? 'Long' : 'Short'} @ ${c.fmt(a.p)}  R:R ${rr}`, { align: 'center', color: '#fff', bg: 'rgba(60,64,75,.9)', font: '11px system-ui' });
  };
}
function measureBox(g, a, b, c, price, time) {
  const up = b.p >= a.p;
  const col = up ? '#2962ff' : '#f23645';
  const fill = up ? 'rgba(41,98,255,.15)' : 'rgba(242,54,69,.15)';
  g.area([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }], fill);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  if (price) g.seg({ x: mx, y: a.y }, { x: mx, y: b.y }, { color: col }).arrowHead({ x: mx, y: a.y }, { x: mx, y: b.y }, 8, { color: col });
  if (time) g.seg({ x: a.x, y: my }, { x: b.x, y: my }, { color: col }).arrowHead({ x: a.x, y: my }, { x: b.x, y: my }, 8, { color: col });
  const bars = Math.round(b.i - a.i);
  const parts = [];
  if (price) parts.push(`${c.fmt(b.p - a.p)} (${pct(a.p, b.p).toFixed(2)}%)`);
  if (time) parts.push(`${bars} bar, ${c.dur(bars)}`);
  const ty = up ? Math.min(a.y, b.y) - 14 : Math.max(a.y, b.y) + 14;
  g.text(mx, ty, parts.join('  ·  '), { align: 'center', color: '#fff', bg: col, font: '11px system-ui' });
}
function pitchfork(kind) {
  return (g, [a, b, c3], d) => {
    if (!c3) return g.seg(a, b);
    let o = a;
    if (kind === 'schiff') o = { x: a.x, y: (a.y + b.y) / 2 };
    if (kind === 'mod') o = mid(a, b);
    const m = mid(b, c3);
    const dv = dir(o, m);
    if (!dv) return;
    const far = (p) => ({ x: p.x + dv.x * 1e5, y: p.y + dv.y * 1e5 });
    g.seg(b, c3);
    g.ray(o, m, { color: '#f23645' });
    g.seg(b, far(b)).seg(c3, far(c3));
    g.area([b, far(b), far(c3), c3], fillOf(d, 0.08));
    if (kind === 'inside') {
      [0.25, 0.75].forEach(t => { const p = lerp(b, c3, t); g.seg(p, far(p), { dash: [4, 4] }); });
    }
    if (kind !== 'std') g.seg(a, o, { dash: [3, 3], width: 1 });
  };
}

export const ALL_IDS = Object.keys(TOOLS);
export { rgba };
