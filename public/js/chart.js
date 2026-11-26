// Mesin chart berbasis Canvas: candle, sumbu, crosshair, zoom/geser, indikator, dan alat gambar.
import { Geo, render, hit, roundRect } from './geo.js';
import { TOOLS } from './tools.js';
import { INDICATORS, indicatorLabel } from './indicators.js';

const AXIS_W = 74, TIME_H = 26;
const isTouch = e => e.pointerType === 'touch' || e.pointerType === 'pen';
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = o => JSON.parse(JSON.stringify(o));

export const THEMES = {
  light: { bg: '#ffffff', grid: '#f0f3fa', text: '#131722', axisText: '#363a45', up: '#089981', down: '#f23645', wick: null, cross: '#9598a1', crossBg: '#131722', line: '#2962ff' },
  dark: { bg: '#131722', grid: '#1e222d', text: '#d1d4dc', axisText: '#b2b5be', up: '#089981', down: '#f23645', wick: null, cross: '#758696', crossBg: '#363a45', line: '#2962ff' },
};

export const DEFAULT_CS = {
  upColor: '#089981', downColor: '#f23645', body: true, border: true, wick: true,
  upBorder: '#089981', downBorder: '#f23645', upWick: '#089981', downWick: '#f23645',
  prevClose: false, priceLine: true, countdown: true, grid: true, bg: '', legend: true,
};

export class Chart {
  constructor(el) {
    this.el = el;
    this.canvas = document.createElement('canvas');
    el.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.theme = THEMES.light;
    this.candles = [];
    this.tfMs = 300000;
    this.digits = 2;
    this.spacing = 8;
    this.scroll = 0; // indeks bar di tepi kanan area plot (float)
    this.rightMargin = 8; // bar kosong di kanan
    this.autoScale = true;
    this.pmin = 0; this.pmax = 1;
    this.chartType = 'candles';
    this.studies = []; // indikator aktif: [{ id, type, params, hidden }]
    this._cache = new Map();
    this.alerts = []; // [{ id, price, cond, active }]
    this.replay = null; // { full, idx }
    this.hideStudies = false;
    this.cs = { ...DEFAULT_CS }; // gaya chart (warna candle, latar, grid, dll.)
    this.extCross = null; // waktu crosshair dari chart lain (sinkronisasi)
    // gambar
    this.drawings = [];
    this.tool = null; // id alat aktif atau 'eraser' / 'zoomin'
    this.pending = null;
    this.selected = null;
    this.magnet = 'off'; // off | weak | strong
    this.hidden = false;
    this.lockAll = false;
    this.stay = false;
    this.zoomStack = [];
    this.history = []; this.future = [];
    this.cursor = null;
    this.pointers = new Map();
    this.listeners = {};
    this.dirty = true;

    this._bind();
    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    const loop = () => { if (this.dirty) { this.dirty = false; this.draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    setInterval(() => this.invalidate(), 1000); // hitung mundur penutupan bar
  }

  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  emit(ev, data) { (this.listeners[ev] || []).forEach(f => f(data)); }
  invalidate() { this.dirty = true; }

  resize() {
    const r = this.el.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.W = r.width; this.H = r.height; this.dpr = dpr;
    this.canvas.width = Math.round(r.width * dpr); this.canvas.height = Math.round(r.height * dpr);
    this.canvas.style.width = r.width + 'px'; this.canvas.style.height = r.height + 'px';
    this.invalidate();
  }
  get plot() { return { w: this.W - AXIS_W, h: this.layout().mainH }; }
  get timeY() { return this.H - TIME_H; }
  layout() {
    const subs = this.hideStudies ? [] : this.studies.filter(s => !s.hidden && INDICATORS[s.type]?.pane === 'sub');
    const avail = this.H - TIME_H;
    const ph = subs.length ? Math.max(60, Math.min(avail * 0.24, (avail * 0.55) / subs.length)) : 0;
    const mainH = Math.max(80, avail - ph * subs.length);
    return { mainH, panes: subs.map((st, k) => ({ st, top: mainH + k * ph, h: ph })) };
  }
  studyResult(st) {
    const c = this.candles, last = c[c.length - 1];
    if (!last) return null;
    const key = `${st.type}|${JSON.stringify(st.params)}|${c.length}|${c[0].t}|${last.t}|${last.c}|${last.h}|${last.l}|${this.tfMs}`;
    const hit = this._cache.get(st.id);
    if (hit && hit.key === key) return hit.r;
    let r = null;
    try { r = INDICATORS[st.type].calc(c, st.params, { tfMs: this.tfMs }); } catch (e) { console.warn(e); }
    this._cache.set(st.id, { key, r });
    return r;
  }
  _mainStudies() { return this.hideStudies ? [] : this.studies.filter(s => !s.hidden && INDICATORS[s.type]?.pane === 'main'); }

  // ---------- Data ----------
  setData(candles, { tfMs, digits, keepView = false } = {}) {
    const prevLen = this.candles.length;
    const atEnd = this.scroll >= prevLen - 1;
    this.candles = candles;
    if (tfMs) this.tfMs = tfMs;
    if (digits != null) this.digits = digits;
    if (!keepView) {
      this.scroll = candles.length - 1 + this.rightMargin;
      this.autoScale = true;
      this.zoomStack = [];
    } else if (atEnd) {
      this.scroll += candles.length - prevLen;
    }
    this.invalidate();
  }
  updateLast(bars) {
    // gabungkan bar terbaru (bar terakhir diperbarui / bar baru ditambahkan)
    if (this.replay) { // saat replay, data baru disimpan tanpa ditampilkan
      const f = this.replay.full;
      for (const b of bars) { const l = f[f.length - 1]; if (!l || b.t > l.t) f.push(b); else if (b.t === l.t) f[f.length - 1] = b; }
      return;
    }
    const c = this.candles;
    let added = 0;
    for (const b of bars) {
      const last = c[c.length - 1];
      if (!last || b.t > last.t) { c.push(b); added++; }
      else if (b.t === last.t) c[c.length - 1] = b;
    }
    if (added && this.scroll >= c.length - 1 - added) this.scroll += added;
    this.invalidate();
  }

  // ---------- Konversi koordinat ----------
  ix(i) { return this.plot.w - (this.scroll - i) * this.spacing - this.spacing / 2; }
  xi(x) { return this.scroll - (this.plot.w - this.spacing / 2 - x) / this.spacing; }
  py(p) { return ((this.pmax - p) / (this.pmax - this.pmin)) * this.plot.h; }
  yp(y) { return this.pmax - (y / this.plot.h) * (this.pmax - this.pmin); }
  tToI(t) {
    const c = this.candles, n = c.length;
    if (!n) return 0;
    if (t >= c[n - 1].t) return n - 1 + (t - c[n - 1].t) / this.tfMs;
    if (t <= c[0].t) return (t - c[0].t) / this.tfMs;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m].t <= t) lo = m; else hi = m; }
    return lo + (t - c[lo].t) / (c[hi].t - c[lo].t);
  }
  iToT(i) {
    const c = this.candles, n = c.length;
    if (!n) return 0;
    if (i >= n - 1) return c[n - 1].t + (i - (n - 1)) * this.tfMs;
    if (i <= 0) return c[0].t + i * this.tfMs;
    const lo = Math.floor(i), f = i - lo;
    return c[lo].t + f * (c[lo + 1].t - c[lo].t);
  }
  toPx(pt) { const i = this.tToI(pt.t); return { x: this.ix(i), y: this.py(pt.p), i, p: pt.p, t: pt.t }; }

  fmt(p) {
    return Number(p).toLocaleString('id-ID', { minimumFractionDigits: this.digits, maximumFractionDigits: this.digits });
  }
  dur(bars) {
    let s = Math.abs(bars) * this.tfMs / 1000, out = [];
    const u = [['mgg', 604800], ['h', 86400], ['j', 3600], ['m', 60]];
    for (const [n, v] of u) { const k = Math.floor(s / v); if (k) { out.push(k + n); s -= k * v; } if (out.length === 2) break; }
    return (bars < 0 ? '-' : '') + (out.join(' ') || '0m');
  }
  ctxApi() {
    return {
      fmt: p => this.fmt(p), dur: b => this.dur(b), plot: this.plot,
      ix: i => this.ix(i), xi: x => this.xi(x), py: p => this.py(p), yp: y => this.yp(y),
      bars: (i0, i1) => {
        const a = Math.max(0, Math.ceil(i0)), b = Math.min(this.candles.length - 1, Math.floor(i1));
        return b >= a ? this.candles.slice(a, b + 1).map((c, k) => ({ ...c, i: a + k })) : [];
      },
      lastIndex: () => this.candles.length - 1,
      closes: (i0, i1) => {
        const out = [];
        for (let i = Math.max(0, Math.ceil(i0)); i <= Math.min(this.candles.length - 1, Math.floor(i1)); i++) out.push({ i, c: this.candles[i].c });
        return out;
      },
    };
  }

  // ---------- Viewport ----------
  visibleRange() {
    const from = Math.max(0, Math.floor(this.xi(0)));
    const to = Math.min(this.candles.length - 1, Math.ceil(this.xi(this.plot.w)));
    return [from, to];
  }
  _autoscale() {
    if (!this.autoScale || !this.candles.length) return;
    const [a, b] = this.visibleRange();
    let lo = Infinity, hi = -Infinity;
    const src = this._series();
    for (let i = a; i <= b; i++) { const c = src[i]; if (!c) continue; if (c.l < lo) lo = c.l; if (c.h > hi) hi = c.h; }
    for (const st of this._mainStudies()) {
      if (st.type === 'structure' || st.type === 'pivots') continue;
      const r = this.studyResult(st);
      for (const ln of r?.lines || []) for (let i = a; i <= b; i++) { const v = ln.v[i]; if (v != null) { if (v > hi) hi = v; if (v < lo) lo = v; } }
    }
    if (!isFinite(lo)) return;
    const pad = (hi - lo) * 0.1 || hi * 0.001 || 1;
    const vol = this._mainStudies().some(s => s.type === 'volume');
    this.pmin = lo - pad; this.pmax = hi + pad;
    if (vol) this.pmin -= (hi - lo) * 0.22;
  }
  zoom(factor, anchorX = this.plot.w) {
    const i = this.xi(anchorX);
    this.spacing = Math.max(1.5, Math.min(60, this.spacing * factor));
    this.scroll = i + (this.plot.w - this.spacing / 2 - anchorX) / this.spacing;
    this._clampScroll();
    this.invalidate();
    this.emit('view');
  }
  _clampScroll() {
    const n = this.candles.length;
    const visBars = this.plot.w / this.spacing;
    this.scroll = Math.max(Math.min(visBars * 0.2, n), Math.min(n - 1 + visBars * 0.8, this.scroll));
  }
  goLatest() { this.scroll = this.candles.length - 1 + this.rightMargin; this.autoScale = true; this.invalidate(); }
  resetScale() { this.autoScale = true; this.invalidate(); }

  // ---------- Seri / indikator ----------
  _series() {
    if (this.chartType !== 'heikin') return this.candles;
    if (this._haSrc === this.candles && this._haLen === this.candles.length && this._haLast === this.candles.at(-1)) return this._ha;
    const out = [];
    this.candles.forEach((c, i) => {
      const cl = (c.o + c.h + c.l + c.c) / 4;
      const op = i ? (out[i - 1].o + out[i - 1].c) / 2 : (c.o + c.c) / 2;
      out.push({ t: c.t, o: op, c: cl, h: Math.max(c.h, op, cl), l: Math.min(c.l, op, cl), v: c.v });
    });
    this._ha = out; this._haSrc = this.candles; this._haLen = this.candles.length; this._haLast = this.candles.at(-1);
    return out;
  }

  // ---------- Gambar (drawings) ----------
  setDrawings(list) { this.drawings = list || []; this.selected = null; this.pending = null; this.history = []; this.future = []; this.invalidate(); }
  snapshot() { this.history.push(clone(this.drawings)); if (this.history.length > 100) this.history.shift(); this.future = []; }
  commit() { this.emit('drawings', this.drawings); this.invalidate(); }
  undo() { if (!this.history.length) return; this.future.push(clone(this.drawings)); this.drawings = this.history.pop(); this.selected = null; this.commit(); this.emit('select', null); }
  redo() { if (!this.future.length) return; this.history.push(clone(this.drawings)); this.drawings = this.future.pop(); this.selected = null; this.commit(); this.emit('select', null); }
  removeDrawing(d) { this.snapshot(); this.drawings = this.drawings.filter(x => x !== d); if (this.selected === d) { this.selected = null; this.emit('select', null); } this.commit(); }
  clearDrawings() { if (!this.drawings.length) return; this.snapshot(); this.drawings = []; this.selected = null; this.emit('select', null); this.commit(); }
  cloneDrawing(d) {
    this.snapshot();
    const n = clone(d); n.id = uid();
    n.points.forEach(p => { p.t += this.tfMs * 5; });
    this.drawings.push(n); this.selected = n; this.commit(); this.emit('select', n);
  }
  setTool(id) {
    this.tool = id; this.pending = null;
    if (id) { this.selected = null; this.emit('select', null); }
    this.canvas.style.cursor = id ? 'crosshair' : 'default';
    this.invalidate();
  }
  zoomOut() {
    const z = this.zoomStack.pop();
    if (z) Object.assign(this, z); else this.zoom(1 / 1.5, this.plot.w / 2);
    this.invalidate();
  }

  _geo(d) {
    const tool = TOOLS[d.tool];
    const g = new Geo(d.style);
    const P = d.points.map(p => this.toPx(p));
    const api = this.ctxApi();
    api.selected = this.selected === d || this.pending === d;
    try { tool.build(g, P, d, api); } catch (e) { console.warn(e); }
    // teks tambahan (tab "Teks" di pengaturan gambar)
    if (d.text && !tool.needsText && P.length) {
      const ts = d.textStyle || {};
      const font = `${ts.italic ? 'italic ' : ''}${ts.bold ? 'bold ' : ''}${ts.size || 13}px system-ui`;
      let x, y, align = ts.halign || 'center';
      if (tool.line && P[1]) {
        const a = P[0], b = P[1];
        const t = align === 'left' ? 0 : align === 'right' ? 1 : 0.5;
        x = a.x + (b.x - a.x) * t; y = a.y + (b.y - a.y) * t;
        align = 'center';
      } else {
        const xs = P.map(p => p.x), ys = P.map(p => p.y);
        x = align === 'left' ? Math.min(...xs) : align === 'right' ? Math.max(...xs) : (Math.min(...xs) + Math.max(...xs)) / 2;
        y = ts.valign === 'bottom' ? Math.max(...ys) : ts.valign === 'middle' ? (Math.min(...ys) + Math.max(...ys)) / 2 : Math.min(...ys);
      }
      const off = ts.valign === 'bottom' ? 14 : ts.valign === 'middle' ? 0 : -14;
      d.text.split('\n').forEach((line, k, arr) => g.text(x, y + off + (k - (ts.valign === 'bottom' ? 0 : arr.length - 1)) * ((ts.size || 13) + 4), line, { align, color: ts.color || d.style.color, font, dash: [] }));
    }
    return { g, P };
  }
  visibleOnTf(d) {
    const v = d.vis; if (!v) return true;
    const t = this.tfMs, k = t < 3600e3 ? 'minutes' : t < 86400e3 ? 'hours' : t < 604800e3 ? 'days' : 'weeks';
    return v[k] !== false;
  }
  // nilai harga garis gambar pada indeks bar tertentu (untuk alarm pada garis)
  lineValueAt(d, i) {
    const [a, b] = d.points; if (!a) return null;
    if (['hline', 'hray', 'pricelabel'].includes(d.tool) || !b) return a.p;
    const ia = this.tToI(a.t), ib = this.tToI(b.t);
    if (Math.abs(ib - ia) < 1e-9) return null;
    return a.p + ((b.p - a.p) * (i - ia)) / (ib - ia);
  }
  _snap(x, y) {
    let i = Math.round(this.xi(x));
    let p = this.yp(y);
    if (this.magnet !== 'off' && this.candles[i]) {
      const c = this._series()[i];
      let best = null, bd = Infinity;
      for (const v of [c.o, c.h, c.l, c.c]) { const d = Math.abs(this.py(v) - y); if (d < bd) { bd = d; best = v; } }
      if (this.magnet === 'strong' || bd < 30) p = best;
    }
    return { t: this.iToT(i), p };
  }
  // Penggaris sudut: titik menempel ke kelipatan 15° relatif terhadap titik jangkar (dalam piksel layar)
  _angled(anchor, x, y, tool) {
    if (!this.angleSnap || !anchor || TOOLS[tool]?.freehand || TOOLS[tool]?.n === 1) return null;
    const a = this.toPx(anchor), dx = x - a.x, dy = y - a.y, len = Math.hypot(dx, dy);
    if (len < 4) return null;
    const step = Math.PI / 12, ang = Math.round(Math.atan2(dy, dx) / step) * step;
    const L = Math.abs(dx * Math.cos(ang) + dy * Math.sin(ang)) || len;
    const nx = a.x + Math.cos(ang) * L, ny = a.y + Math.sin(ang) * L;
    let deg = Math.round((-ang * 180) / Math.PI); if (deg <= -180) deg += 360;
    this._angleHint = { x: nx, y: ny, deg };
    return { t: this.iToT(this.xi(nx)), p: this.yp(ny) };
  }
  _hitHandle(d, x, y, tol) {
    if (TOOLS[d.tool].freehand) return -1;
    const P = d.points.map(p => this.toPx(p));
    for (let k = 0; k < P.length; k++) if (Math.hypot(P[k].x - x, P[k].y - y) <= tol) return k;
    return -1;
  }
  _hitDrawing(x, y, tol) {
    if (this.hidden) return null;
    for (let k = this.drawings.length - 1; k >= 0; k--) {
      const d = this.drawings[k];
      if (d.hidden || !this.visibleOnTf(d)) continue;
      if (this._hitHandle(d, x, y, tol) >= 0) return d;
      if (hit(this._geo(d).g, { x, y }, tol)) return d;
    }
    return null;
  }
  _finishPending() {
    const d = this.pending; this.pending = null;
    const tool = TOOLS[d.tool];
    if (tool.needsText) {
      const s = window.prompt('Masukkan teks:', d.text || '');
      if (!s) { this.invalidate(); return; }
      d.text = s;
    }
    this.snapshot();
    this.drawings.push(d);
    if (!tool.temp) { this.selected = d; this.emit('select', d); }
    this.commit();
    if (!this.stay) { this.setTool(null); this.emit('tool', null); }
  }
  boundsOf(d) {
    const P = d.points.map(p => this.toPx(p));
    const xs = P.map(p => p.x), ys = P.map(p => p.y);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }

  // ---------- Input ----------
  _bind() {
    const cv = this.canvas;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', e => this._down(e));
    cv.addEventListener('pointermove', e => this._move(e));
    window.addEventListener('pointerup', e => this._up(e));
    window.addEventListener('pointercancel', e => this._up(e));
    cv.addEventListener('pointerleave', e => { if (!isTouch(e)) { this.cursor = null; this.invalidate(); } });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left;
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        this.scroll += (e.deltaX || e.deltaY) / this.spacing; this._clampScroll(); this.invalidate();
      } else this.zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, Math.min(x, this.plot.w));
    }, { passive: false });
    cv.addEventListener('dblclick', e => {
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (x > this.plot.w) this.resetScale();
      else if (y >= this.timeY) { this.spacing = 8; this.goLatest(); }
      else if (y > this.plot.h) { /* pane indikator */ }
      else if (this.pending && TOOLS[this.pending.tool].n === Infinity) {
        if (this.pending.points.length > 2) { this.pending.points.pop(); this._finishPending(); }
      } else {
        const d = this._hitDrawing(x, y, 6);
        if (d && TOOLS[d.tool].needsText) {
          const s = window.prompt('Ubah teks:', d.text || '');
          if (s != null) { this.snapshot(); d.text = s; this.commit(); }
        }
      }
    });
  }
  _pos(e) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  _down(e) {
    const { x, y } = this._pos(e);
    this.canvas.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x, y });
    const tol = isTouch(e) ? 16 : 7;
    this.cursor = { x, y, touch: isTouch(e) };

    // hapus pengukuran sementara pada klik berikutnya
    const temps = this.drawings.filter(d => TOOLS[d.tool].temp);
    if (temps.length && !(this.pending && TOOLS[this.pending.tool].temp)) { this.drawings = this.drawings.filter(d => !TOOLS[d.tool].temp); this.commit(); }

    if (this.pointers.size === 2) { // pinch
      const [a, b] = [...this.pointers.values()];
      this.drag = { type: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), spacing: this.spacing, cx: (a.x + b.x) / 2 };
      return;
    }
    const lh = (this._legendHits || []).find(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
    if (lh && !this.tool) { this.emit('study', lh.id); return; }
    if (y >= this.timeY) { this.drag = { type: 'time', x, spacing: this.spacing }; return; }
    if (y > this.plot.h) { this.drag = { type: 'pan', x, y, scroll: this.scroll, pmin: this.pmin, pmax: this.pmax, auto: true }; return; }
    if (x > this.plot.w) { this.drag = { type: 'price', y, pmin: this.pmin, pmax: this.pmax }; this.autoScale = false; return; }

    if (this.tool === 'replay') {
      const i = Math.max(10, Math.min(this.candles.length - 1, Math.round(this.xi(x))));
      this.setTool(null); this.emit('tool', null);
      this.startReplay(i);
      return;
    }
    if (this.tool === 'zoomin') { this.drag = { type: 'zoomrect', x0: x, y0: y, x, y }; return; }
    if (this.tool === 'eraser') {
      const d = this._hitDrawing(x, y, tol);
      if (d) this.removeDrawing(d);
      return;
    }
    if (this.tool && TOOLS[this.tool]) {
      const pt = this._snap(x, y);
      const tool = TOOLS[this.tool];
      if (tool.freehand) {
        this.pending = { id: uid(), tool: this.tool, points: [{ t: this.iToT(this.xi(x)), p: this.yp(y) }], style: { ...this.defaultStyle(this.tool) }, ...this.defaultExtras(this.tool) };
        this.drag = { type: 'brush', lx: x, ly: y };
        return;
      }
      if (tool.n === Infinity && this.pending) {
        const pts = this.pending.points, prev = pts.length > 1 ? this.toPx(pts[pts.length - 2]) : null;
        if (prev && Math.hypot(prev.x - x, prev.y - y) < (isTouch(e) ? 18 : 8) && pts.length > 2) { pts.pop(); return this._finishPending(); }
        const ap = this._angled(pts[pts.length - 2], x, y, this.pending.tool) || pt;
        pts[pts.length - 1] = ap; pts.push({ ...ap }); this.invalidate(); return;
      }
      if (!this.pending) {
        this.pending = { id: uid(), tool: this.tool, points: [pt], style: { ...this.defaultStyle(this.tool) }, ...this.defaultExtras(this.tool) };
        if (tool.n === 1) return this._finishPending();
        this.pending.points.push({ ...pt });
        this.drag = { type: 'place', x, y, moved: false };
      } else {
        this.pending.points[this.pending.points.length - 1] = this._angled(this.pending.points[this.pending.points.length - 2], x, y, this.pending.tool) || pt;
        if (this.pending.points.length >= tool.n) return this._finishPending();
        this.pending.points.push({ ...pt });
        tool.constrain?.(this.pending.points);
        this.drag = { type: 'place', x, y, moved: false };
      }
      this.invalidate();
      return;
    }
    // seleksi / geser gambar
    if (this.selected && !this.lockAll && !this.selected.locked) {
      const k = this._hitHandle(this.selected, x, y, tol + 3);
      if (k >= 0) { this.snapshot(); this.drag = { type: 'handle', d: this.selected, k }; return; }
    }
    const d = this._hitDrawing(x, y, tol);
    if (d) {
      if (this.selected !== d) { this.selected = d; this.emit('select', d); }
      if (!this.lockAll && !d.locked) {
        this.snapshot();
        const start = { i: this.xi(x), p: this.yp(y) };
        this.drag = { type: 'move', d, start, orig: clone(d.points), moved: false };
      }
      this.invalidate();
      return;
    }
    const al = this.alerts.find(a => Math.abs(this.py(a.price) - y) <= tol);
    if (al) { this.drag = { type: 'alert', al, moved: false }; return; }
    if (this.selected) { this.selected = null; this.emit('select', null); }
    this.drag = { type: 'pan', x, y, scroll: this.scroll, pmin: this.pmin, pmax: this.pmax, auto: this.autoScale };
    this.invalidate();
  }

  _move(e) {
    const { x, y } = this._pos(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x, y });
    this.cursor = { x, y, touch: isTouch(e) };
    const dr = this.drag;
    if (this.pending && (!dr || dr.type === 'place')) {
      if (dr) dr.moved ||= Math.hypot(x - dr.x, y - dr.y) > 8;
      if (!isTouch(e) || dr) {
        const pts = this.pending.points;
        pts[pts.length - 1] = this._angled(pts[pts.length - 2], x, y, this.pending.tool) || this._snap(x, y);
        TOOLS[this.pending.tool].constrain?.(pts);
      }
    }
    if (dr) {
      if (dr.type === 'brush' && this.pending) {
        if (Math.hypot(x - dr.lx, y - dr.ly) > 3) { this.pending.points.push({ t: this.iToT(this.xi(x)), p: this.yp(y) }); dr.lx = x; dr.ly = y; }
      } else if (dr.type === 'alert') {
        dr.al.price = this.yp(y); dr.moved = true;
      } else if (dr.type === 'pinch' && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const target = dr.spacing * dist / dr.dist;
        this.zoom(target / this.spacing, dr.cx);
      } else if (dr.type === 'pan') {
        this.scroll = dr.scroll + (dr.x - x) / this.spacing;
        this._clampScroll();
        this.emit('view');
        if (!dr.auto) {
          const dp = ((y - dr.y) / this.plot.h) * (dr.pmax - dr.pmin);
          this.pmin = dr.pmin + dp; this.pmax = dr.pmax + dp;
        }
      } else if (dr.type === 'price') {
        const f = Math.exp((y - dr.y) / 150);
        const midp = (dr.pmin + dr.pmax) / 2, half = (dr.pmax - dr.pmin) / 2 * f;
        this.pmin = midp - half; this.pmax = midp + half;
      } else if (dr.type === 'time') {
        this.spacing = Math.max(1.5, Math.min(60, dr.spacing * Math.exp((x - dr.x) / 150)));
        this.scroll = this.scroll; this._clampScroll();
      } else if (dr.type === 'handle') {
        const anc = dr.d.points[dr.k - 1] || dr.d.points[dr.k + 1];
        dr.d.points[dr.k] = this._angled(anc, x, y, dr.d.tool) || this._snap(x, y);
        TOOLS[dr.d.tool].constrain?.(dr.d.points);
        this.emit('select', dr.d);
      } else if (dr.type === 'move') {
        const di = Math.round(this.xi(x) - dr.start.i), dp = this.yp(y) - dr.start.p;
        dr.moved = true;
        dr.d.points = dr.orig.map(p => ({ t: this.iToT(Math.round(this.tToI(p.t)) + di), p: p.p + dp }));
        this.emit('select', dr.d);
      } else if (dr.type === 'zoomrect') { dr.x = x; dr.y = y; }
    }
    this.emit('crosshair', this._crossInfo(x));
    this.invalidate();
  }

  _up(e) {
    this.pointers.delete(e.pointerId);
    this._angleHint = null;
    const dr = this.drag;
    if (!dr) return;
    if (dr.type === 'pinch') { if (this.pointers.size < 2) this.drag = null; return; }
    this.drag = null;
    if (dr.type === 'brush') { if (this.pending?.points.length > 1) this._finishPending(); else this.pending = null; this.invalidate(); return; }
    if (dr.type === 'alert') { if (dr.moved) this.emit('alertmove', dr.al); else this.emit('alertclick', dr.al); this.invalidate(); return; }
    if (dr.type === 'place' && dr.moved && this.pending && this.pending.points.length === 2 && TOOLS[this.pending.tool].n === 2) {
      this._finishPending();
    } else if (dr.type === 'handle' || (dr.type === 'move' && dr.moved)) {
      this.commit();
    } else if (dr.type === 'move' && !dr.moved) {
      this.history.pop();
    } else if (dr.type === 'zoomrect') {
      if (Math.abs(dr.x - dr.x0) > 10) {
        this.zoomStack.push({ spacing: this.spacing, scroll: this.scroll, pmin: this.pmin, pmax: this.pmax, autoScale: this.autoScale });
        const i0 = this.xi(Math.min(dr.x, dr.x0)), i1 = this.xi(Math.max(dr.x, dr.x0));
        const p0 = this.yp(Math.max(dr.y, dr.y0)), p1 = this.yp(Math.min(dr.y, dr.y0));
        this.spacing = Math.max(1.5, Math.min(60, this.plot.w / Math.max(1, i1 - i0)));
        this.scroll = i1 + 0.5;
        if (Math.abs(dr.y - dr.y0) > 10) { this.autoScale = false; this.pmin = p0; this.pmax = p1; }
      }
      if (!this.stay) { this.setTool(null); this.emit('tool', null); }
    }
    if (isTouch(e) && !this.pending) { /* biarkan crosshair terakhir */ }
    this.invalidate();
  }

  defaultExtras(tool) {
    const x = this.extraDefaults?.[tool];
    return x ? JSON.parse(JSON.stringify(x)) : {};
  }
  defaultStyle(tool) {
    const s = this.styleDefaults?.[tool];
    return s || TOOLS[tool].defStyle || { color: '#2962ff', width: 2, dash: [] };
  }

  _crossInfo(x) {
    const i = Math.round(this.xi(x));
    const c = this.candles[i];
    return c ? { ...c, i, prev: this.candles[i - 1] } : null;
  }

  // ---------- Render ----------
  draw() {
    const { ctx, dpr, theme: th } = this;
    const { w } = this.plot;
    const L = this.layout(), h = L.mainH, tY = this.timeY;
    this._legendHits = [];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = this.cs.bg || th.bg; ctx.fillRect(0, 0, this.W, this.H);
    if (!this.candles.length) {
      ctx.fillStyle = th.axisText; ctx.font = '14px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(this.loadingText || 'Memuat data…', w / 2, h / 2);
      return;
    }
    this._autoscale();
    const series = this._series();
    const [from, to] = this.visibleRange();
    const toFar = Math.ceil(this.xi(w)) + 1;

    // grid + sumbu harga
    const step = niceStep((this.pmax - this.pmin) / Math.max(2, h / 55));
    ctx.font = '11px system-ui'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const ticks = [];
    for (let p = Math.ceil(this.pmin / step) * step; p <= this.pmax; p += step) ticks.push(p);
    ctx.strokeStyle = th.grid; ctx.lineWidth = 1;
    const tLabels = this._timeTicks(from, to);
    if (this.cs.grid) {
      ctx.beginPath();
      for (const p of ticks) { const y = Math.round(this.py(p)) + 0.5; ctx.moveTo(0, y); ctx.lineTo(w, y); }
      for (const t of tLabels) { const x = Math.round(t.x) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, tY); }
      ctx.stroke();
    }

    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();

    // indikator overlay (di belakang candle: volume, pita)
    const mainSt = this._mainStudies();
    const py = v => this.py(v);
    for (const st of mainSt) {
      const r = this.studyResult(st); if (!r) continue;
      if (r.volume) this._drawVolume(r.volume, from, to, h);
      this._drawResult(r, from, toFar, py, { back: true });
    }

    // seri harga (saat memilih titik replay, bar setelah garis dibuat pudar)
    const cur0 = this.cursor;
    const fadeFrom = this.tool === 'replay' && cur0 && cur0.x < w ? Math.round(this.xi(cur0.x)) + 1 : null;
    if (fadeFrom != null && fadeFrom <= to) {
      this._drawSeries(series, from, Math.min(to, fadeFrom - 1));
      ctx.globalAlpha = 0.25; this._drawSeries(series, Math.max(from, fadeFrom), to); ctx.globalAlpha = 1;
    } else this._drawSeries(series, from, to);

    for (const st of mainSt) { const r = this.studyResult(st); if (r) this._drawResult(r, from, toFar, py, { back: false }); }

    // garis harga terakhir
    const last = this.candles[this.candles.length - 1];
    const lastCol = last.c >= last.o ? this.cs.upColor : this.cs.downColor;
    const ly = Math.round(this.py(last.c)) + 0.5;
    if (this.cs.priceLine) {
      ctx.setLineDash([2, 3]); ctx.strokeStyle = lastCol; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(w, ly); ctx.stroke(); ctx.setLineDash([]);
    }

    // alarm
    for (const al of this.alerts) {
      const y = Math.round(this.py(al.price)) + 0.5;
      ctx.strokeStyle = al.active ? '#ff9800' : '#9598a1'; ctx.setLineDash([6, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); ctx.setLineDash([]);
    }

    // gambar
    if (!this.hidden) {
      for (const d of this.drawings) if (!d.hidden && this.visibleOnTf(d)) this._drawDrawing(d, d === this.selected);
    }
    if (this.pending) this._drawDrawing(this.pending, true);

    // zoom rect
    if (this.drag?.type === 'zoomrect') {
      const r = this.drag;
      ctx.fillStyle = 'rgba(41,98,255,.12)'; ctx.strokeStyle = '#2962ff'; ctx.lineWidth = 1;
      ctx.fillRect(Math.min(r.x0, r.x), Math.min(r.y0, r.y), Math.abs(r.x - r.x0), Math.abs(r.y - r.y0));
      ctx.strokeRect(Math.min(r.x0, r.x), Math.min(r.y0, r.y), Math.abs(r.x - r.x0), Math.abs(r.y - r.y0));
    }
    // pemilihan titik awal replay
    const cur = this.cursor;
    if (this.tool === 'replay' && cur && cur.x < w) {
      const x = this.ix(Math.round(this.xi(cur.x))) + this.spacing / 2;
      ctx.strokeStyle = '#2962ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    // crosshair dari chart lain (sinkronisasi layout)
    if (this.extCross != null && !(cur && cur.x < w)) {
      const x = Math.round(this.ix(Math.round(this.tToI(this.extCross)))) + 0.5;
      ctx.strokeStyle = th.cross; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); ctx.setLineDash([]);
    }
    if (this._angleHint && (this.drag || this.pending)) {
      const hnt = this._angleHint, s2 = `${hnt.deg}°`;
      ctx.font = 'bold 12px system-ui'; const tw = ctx.measureText(s2).width + 12;
      ctx.fillStyle = '#131722'; roundRect(ctx, hnt.x + 12, hnt.y - 28, tw, 20, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s2, hnt.x + 18, hnt.y - 18);
    }
    ctx.restore();

    // legenda indikator utama
    let ly0 = this.legendTop || 34;
    for (const st of mainSt) { this._legend(st, 10, ly0, this.studyResult(st)); ly0 += 18; }

    // pane indikator
    for (const pn of L.panes) this._drawPane(pn, from, toFar, tLabels);

    // crosshair
    if (cur && cur.x < w && cur.y < tY) {
      const cx = Math.round(this.ix(Math.round(this.xi(cur.x)))) + 0.5, cy = Math.round(cur.y) + 0.5;
      ctx.strokeStyle = th.cross; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, tY); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
      ctx.setLineDash([]);
    }

    // area sumbu
    ctx.fillStyle = this.cs.bg || th.bg;
    ctx.fillRect(w, 0, AXIS_W, h); ctx.fillRect(0, tY, this.W, TIME_H);
    ctx.strokeStyle = th.grid; ctx.beginPath(); ctx.moveTo(w + 0.5, 0); ctx.lineTo(w + 0.5, tY); ctx.moveTo(0, tY + 0.5); ctx.lineTo(this.W, tY + 0.5); ctx.stroke();
    ctx.fillStyle = th.axisText; ctx.textAlign = 'left'; ctx.font = '11px system-ui'; ctx.textBaseline = 'middle';
    for (const p of ticks) ctx.fillText(this.fmt(p), w + 8, this.py(p));
    ctx.textAlign = 'center';
    for (const t of tLabels) { ctx.font = t.bold ? 'bold 11px system-ui' : '11px system-ui'; ctx.fillText(t.s, t.x, tY + 14); }
    for (const pn of L.panes) this._paneAxis(pn);

    // label harga terakhir + hitung mundur
    const remain = this.tfMs - ((Date.now() - last.t) % this.tfMs);
    const showCd = this.cs.countdown && !this.replay && remain > 0 && this.tfMs <= 86400000;
    this._axisLabel(ly, this.fmt(last.c), lastCol, '#fff', showCd ? fmtCountdown(remain) : null);
    for (const al of this.alerts) this._axisLabel(this.py(al.price), '⏰ ' + this.fmt(al.price), al.active ? '#ff9800' : '#9598a1', '#fff');

    // label sumbu untuk gambar terpilih
    if (this.selected && !this.hidden) {
      const pts = this.selected.points;
      for (const p of pts) {
        const P = this.toPx(p);
        this._axisLabel(P.y, this.fmt(p.p), '#2962ff', '#fff');
        if (pts.length <= 2) this._timeLabel(P.x, fmtTime(p.t, this.tfMs), '#2962ff');
      }
    }
    if (cur && cur.x < w && cur.y < tY) {
      if (cur.y < h) this._axisLabel(cur.y, this.fmt(this.yp(cur.y)), th.crossBg, '#fff');
      else {
        const pn = L.panes.find(q => cur.y >= q.top && cur.y < q.top + q.h);
        if (pn?.map) this._axisLabel(cur.y, fmtNum(pn.map.inv(cur.y)), th.crossBg, '#fff');
      }
      const i = Math.round(this.xi(cur.x));
      this._timeLabel(this.ix(i), fmtTime(this.iToT(i), this.tfMs), th.crossBg);
    }
    if (this.replay) {
      ctx.fillStyle = 'rgba(41,98,255,.9)'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'right';
      ctx.fillText(`REPLAY · ${fmtTime(last.t, this.tfMs)}`, w - 8, h - 10);
    }
  }

  _drawVolume(vol, from, to, h) {
    const { ctx } = this;
    let vmax = 0; for (let i = from; i <= to; i++) vmax = Math.max(vmax, vol.v[i] || 0);
    if (!vmax) return;
    const bw = Math.max(1, this.spacing * 0.7);
    for (let i = from; i <= to; i++) {
      const vh = ((vol.v[i] || 0) / vmax) * h * 0.16;
      ctx.fillStyle = vol.colors[i]; ctx.fillRect(this.ix(i) - bw / 2, h - vh, bw, vh);
    }
    if (vol.ma) {
      ctx.strokeStyle = 'rgba(41,98,255,.6)'; ctx.lineWidth = 1; ctx.beginPath(); let st = false;
      for (let i = from; i <= to; i++) { const v = vol.ma[i]; if (v == null) { st = false; continue; } const X = this.ix(i), Y = h - (v / vmax) * h * 0.16; st ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); st = true; }
      ctx.stroke();
    }
  }

  _drawResult(r, from, to, py, { back }) {
    const { ctx } = this;
    const sp = this.spacing;
    if (back) {
      for (const bd of r.bands || []) {
        for (let i = Math.max(1, from); i <= to; i++) {
          const a0 = bd.a[i - 1], a1 = bd.a[i], b0 = bd.b[i - 1], b1 = bd.b[i];
          if (a0 == null || a1 == null || b0 == null || b1 == null) continue;
          ctx.fillStyle = bd.fill || (a1 >= b1 ? bd.fillUp : bd.fillDown);
          const x0 = this.ix(i - 1), x1 = this.ix(i);
          ctx.beginPath(); ctx.moveTo(x0, py(a0)); ctx.lineTo(x1, py(a1)); ctx.lineTo(x1, py(b1)); ctx.lineTo(x0, py(b0)); ctx.closePath(); ctx.fill();
        }
      }
      for (const bx of r.boxes || []) {
        if (bx.i1 < from || bx.i0 > to) continue;
        const x0 = this.ix(bx.i0) - sp / 2, x1 = this.ix(bx.i1), y0 = py(bx.top), y1 = py(bx.bot);
        ctx.fillStyle = bx.fill; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        if (bx.stroke) { ctx.strokeStyle = bx.stroke; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0, y1 - y0); }
        if (bx.label) { ctx.fillStyle = bx.stroke || '#787b86'; ctx.font = '10px system-ui'; ctx.textAlign = 'right'; ctx.textBaseline = 'top'; ctx.fillText(bx.label, Math.min(x1, this.plot.w) - 4, y0 + 2); }
      }
      return;
    }
    for (const hs of r.hist || []) {
      const z = py(0), bw = Math.max(1, sp * 0.6);
      for (let i = from; i <= to; i++) { const v = hs.v[i]; if (v == null) continue; ctx.fillStyle = hs.colors[i]; const y = py(v); ctx.fillRect(this.ix(i) - bw / 2, Math.min(y, z), bw, Math.max(1, Math.abs(y - z))); }
    }
    for (const ln of r.lines || []) {
      ctx.strokeStyle = ln.color; ctx.lineWidth = ln.width || 1.5; ctx.setLineDash(ln.dash || []);
      ctx.beginPath(); let st = false;
      for (let i = from; i <= to; i++) { const v = ln.v[i]; if (v == null) { st = false; continue; } const X = this.ix(i), Y = py(v); st ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); st = true; }
      ctx.stroke(); ctx.setLineDash([]);
    }
    for (const sg of r.segs || []) {
      if (sg.i1 < from || sg.i0 > to) continue;
      const x0 = this.ix(sg.i0), x1 = this.ix(sg.i1), y = Math.round(py(sg.p)) + 0.5;
      ctx.strokeStyle = sg.color; ctx.lineWidth = sg.width || 1; ctx.setLineDash(sg.dash || []);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
      if (sg.label) {
        ctx.fillStyle = sg.labelColor || sg.color; ctx.font = '10px system-ui'; ctx.textBaseline = 'bottom';
        if (sg.center) { ctx.textAlign = 'center'; ctx.fillText(sg.label, (x0 + x1) / 2, y - 2); }
        else { ctx.textAlign = 'right'; ctx.fillText(sg.label, Math.min(x1, this.plot.w) - 2, y - 1); }
      }
    }
    for (const m of r.marks || []) {
      if (m.i < from || m.i > to) continue;
      const x = this.ix(m.i), y = py(m.p) + (m.pos === 'above' ? -8 : 8);
      ctx.font = m.small ? '9px system-ui' : 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = m.pos === 'above' ? 'bottom' : 'top';
      if (!m.small) {
        const tw = ctx.measureText(m.text).width + 8, by = m.pos === 'above' ? y - 15 : y;
        ctx.fillStyle = m.color; roundRect(ctx, x - tw / 2, by, tw, 15, 3); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(m.text, x, m.pos === 'above' ? y - 2 : y + 2);
      } else { ctx.fillStyle = m.color; ctx.fillText(m.text, x, y); }
    }
  }

  _legend(st, x, y, r, extra = '') {
    const { ctx } = this;
    const def = INDICATORS[st.type];
    const i = this.cursor && this.cursor.x < this.plot.w ? Math.round(this.xi(this.cursor.x)) : this.candles.length - 1;
    ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const name = indicatorLabel(st);
    ctx.fillStyle = this.theme.axisText;
    ctx.fillText(name, x, y);
    let xx = x + ctx.measureText(name).width + 8;
    for (const ln of (r?.lines || []).slice(0, 5)) {
      const v = ln.v[i]; if (v == null) continue;
      const s = def.pane === 'main' ? this.fmt(v) : fmtNum(v);
      ctx.fillStyle = ln.color; ctx.fillText(s, xx, y); xx += ctx.measureText(s).width + 8;
    }
    if (r?.hist?.[0]) { const v = r.hist[0].v[i]; if (v != null) { const s = fmtNum(v); ctx.fillStyle = r.hist[0].colors[i]; ctx.fillText(s, xx, y); xx += ctx.measureText(s).width + 8; } }
    this._legendHits.push({ x0: x - 4, x1: xx, y0: y - 9, y1: y + 9, id: st.id });
  }

  _drawPane(pn, from, to, tLabels) {
    const { ctx, theme: th } = this;
    const { w } = this.plot;
    const r = this.studyResult(pn.st);
    ctx.save(); ctx.beginPath(); ctx.rect(0, pn.top, w + AXIS_W, pn.h); ctx.clip();
    ctx.strokeStyle = th.grid; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, pn.top + 0.5); ctx.lineTo(this.W, pn.top + 0.5); ctx.stroke();
    if (!r) { ctx.restore(); return; }
    let lo = Infinity, hi = -Infinity;
    if (r.range) [lo, hi] = r.range;
    else {
      const acc = v => { if (v != null && isFinite(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } };
      for (const ln of r.lines || []) for (let i = from; i <= to; i++) acc(ln.v[i]);
      for (const hs of r.hist || []) for (let i = from; i <= to; i++) acc(hs.v[i]);
      for (const lv of r.levels || []) acc(lv.p);
      if (!isFinite(lo)) { lo = 0; hi = 1; }
      const pad = (hi - lo) * 0.1 || 1; lo -= pad; hi += pad;
    }
    const top = pn.top + 6, hh = pn.h - 12;
    const map = v => top + ((hi - v) / (hi - lo)) * hh;
    map.inv = y => hi - ((y - top) / hh) * (hi - lo);
    pn.map = { f: map, inv: map.inv, lo, hi };
    if (r.zone) { ctx.fillStyle = 'rgba(126,87,194,.07)'; const y0 = map(r.zone[1]), y1 = map(r.zone[0]); ctx.fillRect(0, y0, w, y1 - y0); }
    for (const lv of r.levels || []) {
      const y = Math.round(map(lv.p)) + 0.5; ctx.strokeStyle = lv.color; ctx.setLineDash(lv.dash || []); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.beginPath(); ctx.rect(0, pn.top, w, pn.h); ctx.clip();
    this._drawResult(r, from, to, map, { back: true });
    this._drawResult(r, from, to, map, { back: false });
    ctx.restore();
    this._legend(pn.st, 10, pn.top + 12, r);
    pn.r = r;
  }
  _paneAxis(pn) {
    if (!pn.map) return;
    const { ctx } = this, { lo, hi, f } = pn.map;
    ctx.fillStyle = this.theme.axisText; ctx.font = '10px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const st = niceStep((hi - lo) / Math.max(2, pn.h / 30));
    for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) { const y = f(v); if (y > pn.top + 6 && y < pn.top + pn.h - 4) ctx.fillText(fmtNum(v), this.plot.w + 8, y); }
    const n = this.candles.length - 1;
    for (const ln of (pn.r?.lines || []).slice(0, 2)) { const v = ln.v[n]; if (v != null) this._axisLabel(f(v), fmtNum(v), ln.color, '#fff'); }
  }

  _drawSeries(s, from, to) {
    const { ctx, theme: th } = this;
    const type = this.chartType;
    if (type === 'line' || type === 'area') {
      ctx.beginPath();
      for (let i = from; i <= to; i++) { const X = this.ix(i), Y = this.py(s[i].c); i === from ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y); }
      ctx.strokeStyle = th.line; ctx.lineWidth = 2; ctx.stroke();
      if (type === 'area') {
        ctx.lineTo(this.ix(to), this.plot.h); ctx.lineTo(this.ix(from), this.plot.h); ctx.closePath();
        const gr = ctx.createLinearGradient(0, 0, 0, this.plot.h);
        gr.addColorStop(0, 'rgba(41,98,255,.35)'); gr.addColorStop(1, 'rgba(41,98,255,0)');
        ctx.fillStyle = gr; ctx.fill();
      }
      return;
    }
    const cs = this.cs;
    const bw = Math.max(1, Math.floor(this.spacing * 0.7));
    for (let i = from; i <= to; i++) {
      const c = s[i];
      const up = cs.prevClose && i > 0 ? c.c >= s[i - 1].c : c.c >= c.o;
      const body = up ? cs.upColor : cs.downColor, border = up ? cs.upBorder : cs.downBorder, wick = up ? cs.upWick : cs.downWick;
      const x = Math.round(this.ix(i));
      const yo = this.py(c.o), yc = this.py(c.c), yh = this.py(c.h), yl = this.py(c.l);
      ctx.lineWidth = 1;
      if (type === 'bars') {
        ctx.strokeStyle = body;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, yh); ctx.lineTo(x + 0.5, yl);
        ctx.moveTo(x - bw / 2, Math.round(yo) + 0.5); ctx.lineTo(x + 0.5, Math.round(yo) + 0.5);
        ctx.moveTo(x + 0.5, Math.round(yc) + 0.5); ctx.lineTo(x + bw / 2 + 1, Math.round(yc) + 0.5);
        ctx.stroke(); continue;
      }
      if (cs.wick) { ctx.strokeStyle = wick; ctx.beginPath(); ctx.moveTo(x + 0.5, yh); ctx.lineTo(x + 0.5, yl); ctx.stroke(); }
      const top = Math.round(Math.min(yo, yc)), hgt = Math.max(1, Math.round(Math.abs(yc - yo)));
      const x0 = x - Math.floor(bw / 2);
      if (bw <= 2) { if (!cs.wick) { ctx.fillStyle = body; ctx.fillRect(x, top, 1, hgt); } continue; }
      if (type === 'hollow' && up) { ctx.fillStyle = this.cs.bg || th.bg; ctx.fillRect(x0, top, bw, hgt); ctx.strokeStyle = body; ctx.strokeRect(x0 + 0.5, top + 0.5, bw - 1, Math.max(0, hgt - 1)); continue; }
      if (cs.body) { ctx.fillStyle = body; ctx.fillRect(x0, top, bw, hgt); }
      if (cs.border) { ctx.strokeStyle = border; ctx.strokeRect(x0 + 0.5, top + 0.5, bw - 1, Math.max(0, hgt - 1)); }
    }
  }


  _drawDrawing(d, selected) {
    const ctx = this.ctx;
    const { g, P } = this._geo(d);
    render(ctx, g, selected);
    if (selected) {
      const tl = TOOLS[d.tool];
      for (const p of (tl.freehand ? [P[0], P[P.length - 1]] : P)) {
        ctx.beginPath(); ctx.arc(p.x, p.y, this.cursor?.touch ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = this.theme.bg; ctx.fill(); ctx.strokeStyle = '#2962ff'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
  }

  _axisLabel(y, s, bg, fg, sub) {
    const { ctx } = this, x = this.plot.w + 1, hgt = sub ? 30 : 18;
    if (y < -20 || y > this.timeY + 10) return;
    ctx.fillStyle = bg; roundRect(ctx, x, y - 9, AXIS_W - 2, hgt, 2); ctx.fill();
    ctx.fillStyle = fg; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x + 6, y);
    if (sub) { ctx.font = '10px system-ui'; ctx.fillText(sub, x + 6, y + 13); }
  }
  _timeLabel(x, s, bg) {
    const { ctx } = this;
    ctx.font = '11px system-ui';
    const tw = ctx.measureText(s).width + 12;
    ctx.fillStyle = bg; roundRect(ctx, x - tw / 2, this.timeY + 2, tw, 20, 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, this.timeY + 12);
  }
  _timeTicks(from, to) {
    const iv = [60e3, 300e3, 900e3, 1800e3, 3600e3, 7200e3, 10800e3, 21600e3, 43200e3, 86400e3, 2 * 86400e3, 7 * 86400e3, 30 * 86400e3, 91 * 86400e3, 365 * 86400e3];
    const interval = iv.find(v => (v / this.tfMs) * this.spacing >= 70) || iv[iv.length - 1];
    const out = [];
    let prevKey = null, prevDay = null, prevMonth = null, lastX = -1e9;
    const i0 = Math.floor(this.xi(0)), i1 = Math.ceil(this.xi(this.plot.w));
    for (let i = Math.max(i0, -1e5); i <= i1; i++) {
      const t = this.iToT(i), dt = new Date(t);
      const local = t - dt.getTimezoneOffset() * 60000;
      let key;
      if (interval >= 365 * 86400e3) key = dt.getFullYear();
      else if (interval >= 30 * 86400e3) key = dt.getFullYear() * 12 + Math.floor(dt.getMonth() / (interval / (30 * 86400e3)));
      else key = Math.floor(local / interval);
      const day = Math.floor(local / 86400e3), month = dt.getMonth();
      if (prevKey !== null && key !== prevKey) {
        const x = this.ix(i);
        if (x - lastX > 50) {
          let s, bold = false;
          if (prevMonth !== null && month !== prevMonth && interval >= 86400e3) { s = month === 0 ? String(dt.getFullYear()) : BULAN[month]; bold = true; }
          else if (prevDay !== null && day !== prevDay) { s = interval >= 86400e3 ? String(dt.getDate()) : String(dt.getDate()); bold = interval < 86400e3; if (dt.getDate() === 1) s = BULAN[month]; }
          else s = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
          out.push({ x, s, bold }); lastX = x;
        }
      }
      prevKey = key; prevDay = day; prevMonth = month;
    }
    return out;
  }

  // ---------- Replay ----------
  startReplay(i) {
    const full = this.replay ? this.replay.full : this.candles;
    this.replay = { full, idx: i };
    this.candles = full.slice(0, i + 1);
    this.scroll = i + this.rightMargin; this.autoScale = true;
    this.emit('replay', this.replay); this.invalidate();
  }
  replayStep(n = 1) {
    const r = this.replay; if (!r) return false;
    if (r.idx >= r.full.length - 1) return false;
    r.idx = Math.min(r.full.length - 1, r.idx + n);
    const atEnd = this.scroll >= this.candles.length - 1;
    this.candles = r.full.slice(0, r.idx + 1);
    if (atEnd) this.scroll = r.idx + this.rightMargin;
    this.emit('replay', r); this.invalidate();
    return true;
  }
  stopReplay() {
    if (!this.replay) return;
    this.candles = this.replay.full; this.replay = null;
    this.goLatest(); this.emit('replay', null);
  }

  screenshot() { return this.canvas.toDataURL('image/png'); }
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pad = n => String(n).padStart(2, '0');
function fmtNum(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return (v / 1e3).toFixed(1) + 'K';
  return v.toLocaleString('id-ID', { maximumFractionDigits: a >= 100 ? 1 : a >= 1 ? 2 : 5 });
}
function niceStep(raw) {
  const p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
function fmtCountdown(ms) {
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h ? `${pad(h)}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}
export function fmtTime(t, tfMs) {
  const d = new Date(t);
  const date = `${['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][d.getDay()]} ${d.getDate()} ${BULAN[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
  return tfMs >= 86400000 ? date : `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
