// Mesin chart berbasis Canvas: candle, sumbu, crosshair, zoom/geser, indikator, dan alat gambar.
import { Geo, render, hit, roundRect } from './geo.js';
import { TOOLS } from './tools.js';

const AXIS_W = 74, TIME_H = 26;
const isTouch = e => e.pointerType === 'touch' || e.pointerType === 'pen';
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = o => JSON.parse(JSON.stringify(o));

export const THEMES = {
  light: { bg: '#ffffff', grid: '#f0f3fa', text: '#131722', axisText: '#363a45', up: '#089981', down: '#f23645', wick: null, cross: '#9598a1', crossBg: '#131722', line: '#2962ff' },
  dark: { bg: '#131722', grid: '#1e222d', text: '#d1d4dc', axisText: '#b2b5be', up: '#089981', down: '#f23645', wick: null, cross: '#758696', crossBg: '#363a45', line: '#2962ff' },
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
    this.indicators = { volume: true, sma20: false, ema50: false, ema200: false, bb: false };
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
  get plot() { return { w: this.W - AXIS_W, h: this.H - TIME_H }; }

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
    this._calcIndicators();
    this.invalidate();
  }
  updateLast(bars) {
    // gabungkan bar terbaru (bar terakhir diperbarui / bar baru ditambahkan)
    const c = this.candles;
    let added = 0;
    for (const b of bars) {
      const last = c[c.length - 1];
      if (!last || b.t > last.t) { c.push(b); added++; }
      else if (b.t === last.t) c[c.length - 1] = b;
    }
    if (added && this.scroll >= c.length - 1 - added) this.scroll += added;
    this._calcIndicators();
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
    if (this.indicators.bb && this.ind.bbU) for (let i = a; i <= b; i++) {
      if (this.ind.bbU[i] != null) { hi = Math.max(hi, this.ind.bbU[i]); lo = Math.min(lo, this.ind.bbL[i]); }
    }
    if (!isFinite(lo)) return;
    const pad = (hi - lo) * 0.1 || hi * 0.001 || 1;
    this.pmin = lo - pad; this.pmax = hi + pad * (this.indicators.volume ? 1.2 : 1);
    if (this.indicators.volume) this.pmin -= (hi - lo) * 0.2;
  }
  zoom(factor, anchorX = this.plot.w) {
    const i = this.xi(anchorX);
    this.spacing = Math.max(1.5, Math.min(60, this.spacing * factor));
    this.scroll = i + (this.plot.w - this.spacing / 2 - anchorX) / this.spacing;
    this._clampScroll();
    this.invalidate();
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
  _calcIndicators() {
    const c = this.candles.map(x => x.c);
    const sma = (n) => { const o = []; let s = 0; c.forEach((v, i) => { s += v; if (i >= n) s -= c[i - n]; o.push(i >= n - 1 ? s / n : null); }); return o; };
    const ema = (n) => { const o = []; const k = 2 / (n + 1); let e = null; c.forEach((v, i) => { e = e == null ? v : v * k + e * (1 - k); o.push(i >= n - 1 ? e : null); }); return o; };
    const s20 = sma(20);
    const bbU = [], bbL = [];
    c.forEach((v, i) => {
      if (i < 19) { bbU.push(null); bbL.push(null); return; }
      let d = 0; for (let k = i - 19; k <= i; k++) d += (c[k] - s20[i]) ** 2;
      d = Math.sqrt(d / 20) * 2; bbU.push(s20[i] + d); bbL.push(s20[i] - d);
    });
    this.ind = { sma20: s20, ema50: ema(50), ema200: ema(200), bbU, bbL };
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
    try { tool.build(g, P, d, this.ctxApi()); } catch (e) { console.warn(e); }
    return { g, P };
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
  _hitHandle(d, x, y, tol) {
    const P = d.points.map(p => this.toPx(p));
    for (let k = 0; k < P.length; k++) if (Math.hypot(P[k].x - x, P[k].y - y) <= tol) return k;
    return -1;
  }
  _hitDrawing(x, y, tol) {
    if (this.hidden) return null;
    for (let k = this.drawings.length - 1; k >= 0; k--) {
      const d = this.drawings[k];
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
      else if (y > this.plot.h) { this.spacing = 8; this.goLatest(); }
      else {
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
    if (x > this.plot.w) { this.drag = { type: 'price', y, pmin: this.pmin, pmax: this.pmax }; this.autoScale = false; return; }
    if (y > this.plot.h) { this.drag = { type: 'time', x, spacing: this.spacing }; return; }

    if (this.tool === 'zoomin') { this.drag = { type: 'zoomrect', x0: x, y0: y, x, y }; return; }
    if (this.tool === 'eraser') {
      const d = this._hitDrawing(x, y, tol);
      if (d) this.removeDrawing(d);
      return;
    }
    if (this.tool && TOOLS[this.tool]) {
      const pt = this._snap(x, y);
      const tool = TOOLS[this.tool];
      if (!this.pending) {
        this.pending = { id: uid(), tool: this.tool, points: [pt], style: { ...this.defaultStyle(this.tool) } };
        if (tool.n === 1) return this._finishPending();
        this.pending.points.push({ ...pt });
        this.drag = { type: 'place', x, y, moved: false };
      } else {
        this.pending.points[this.pending.points.length - 1] = pt;
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
        pts[pts.length - 1] = this._snap(x, y);
        TOOLS[this.pending.tool].constrain?.(pts);
      }
    }
    if (dr) {
      if (dr.type === 'pinch' && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const target = dr.spacing * dist / dr.dist;
        this.zoom(target / this.spacing, dr.cx);
      } else if (dr.type === 'pan') {
        this.scroll = dr.scroll + (dr.x - x) / this.spacing;
        this._clampScroll();
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
        dr.d.points[dr.k] = this._snap(x, y);
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
    const dr = this.drag;
    if (!dr) return;
    if (dr.type === 'pinch') { if (this.pointers.size < 2) this.drag = null; return; }
    this.drag = null;
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

  defaultStyle(tool) {
    const s = this.styleDefaults?.[tool];
    return s || { color: '#2962ff', width: 2, dash: [] };
  }

  _crossInfo(x) {
    const i = Math.round(this.xi(x));
    const c = this.candles[i];
    return c ? { ...c, i, prev: this.candles[i - 1] } : null;
  }

  // ---------- Render ----------
  draw() {
    const { ctx, dpr, theme: th } = this;
    const { w, h } = this.plot;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, this.W, this.H);
    if (!this.candles.length) {
      ctx.fillStyle = th.axisText; ctx.font = '14px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('Memuat data…', w / 2, h / 2);
      return;
    }
    this._autoscale();
    const series = this._series();
    const [from, to] = this.visibleRange();

    // grid + sumbu harga
    const step = niceStep((this.pmax - this.pmin) / Math.max(2, h / 55));
    ctx.font = '11px system-ui'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const ticks = [];
    for (let p = Math.ceil(this.pmin / step) * step; p <= this.pmax; p += step) ticks.push(p);
    ctx.strokeStyle = th.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const p of ticks) { const y = Math.round(this.py(p)) + 0.5; ctx.moveTo(0, y); ctx.lineTo(w, y); }
    const tLabels = this._timeTicks(from, to);
    for (const t of tLabels) { const x = Math.round(t.x) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    ctx.stroke();

    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();

    // volume
    if (this.indicators.volume) {
      let vmax = 0; for (let i = from; i <= to; i++) vmax = Math.max(vmax, this.candles[i].v || 0);
      if (vmax > 0) for (let i = from; i <= to; i++) {
        const c = this.candles[i], vh = (c.v / vmax) * h * 0.16, x = this.ix(i);
        ctx.fillStyle = c.c >= c.o ? 'rgba(8,153,129,.25)' : 'rgba(242,54,69,.25)';
        ctx.fillRect(x - Math.max(1, this.spacing * 0.35), h - vh, Math.max(1, this.spacing * 0.7), vh);
      }
    }

    // seri harga
    this._drawSeries(series, from, to);

    // indikator overlay
    const line = (arr, color, wdt = 1.5) => {
      ctx.strokeStyle = color; ctx.lineWidth = wdt; ctx.beginPath(); let st = false;
      for (let i = from; i <= to; i++) { const v = arr[i]; if (v == null) { st = false; continue; } const X = this.ix(i), Y = this.py(v); st ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); st = true; }
      ctx.stroke();
    };
    if (this.indicators.bb) { line(this.ind.bbU, 'rgba(41,98,255,.7)', 1); line(this.ind.bbL, 'rgba(41,98,255,.7)', 1); line(this.ind.sma20, 'rgba(255,152,0,.8)', 1); }
    if (this.indicators.sma20 && !this.indicators.bb) line(this.ind.sma20, '#ff9800');
    if (this.indicators.ema50) line(this.ind.ema50, '#2962ff');
    if (this.indicators.ema200) line(this.ind.ema200, '#9c27b0');

    // garis harga terakhir
    const last = this.candles[this.candles.length - 1];
    const lastCol = last.c >= last.o ? th.up : th.down;
    const ly = Math.round(this.py(last.c)) + 0.5;
    ctx.setLineDash([2, 3]); ctx.strokeStyle = lastCol; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(w, ly); ctx.stroke(); ctx.setLineDash([]);

    // gambar
    if (!this.hidden) {
      for (const d of this.drawings) this._drawDrawing(d, d === this.selected);
    }
    if (this.pending) this._drawDrawing(this.pending, true);

    // zoom rect
    if (this.drag?.type === 'zoomrect') {
      const r = this.drag;
      ctx.fillStyle = 'rgba(41,98,255,.12)'; ctx.strokeStyle = '#2962ff'; ctx.lineWidth = 1;
      ctx.fillRect(Math.min(r.x0, r.x), Math.min(r.y0, r.y), Math.abs(r.x - r.x0), Math.abs(r.y - r.y0));
      ctx.strokeRect(Math.min(r.x0, r.x), Math.min(r.y0, r.y), Math.abs(r.x - r.x0), Math.abs(r.y - r.y0));
    }

    // crosshair
    const cur = this.cursor;
    if (cur && cur.x < w && cur.y < h) {
      const cx = Math.round(this.ix(Math.round(this.xi(cur.x)))) + 0.5, cy = Math.round(cur.y) + 0.5;
      ctx.strokeStyle = th.cross; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();

    // area sumbu
    ctx.fillStyle = th.bg;
    ctx.fillRect(w, 0, AXIS_W, this.H); ctx.fillRect(0, h, this.W, TIME_H);
    ctx.strokeStyle = th.grid; ctx.beginPath(); ctx.moveTo(w + 0.5, 0); ctx.lineTo(w + 0.5, h); ctx.moveTo(0, h + 0.5); ctx.lineTo(w, h + 0.5); ctx.stroke();
    ctx.fillStyle = th.axisText; ctx.textAlign = 'left'; ctx.font = '11px system-ui';
    for (const p of ticks) ctx.fillText(this.fmt(p), w + 8, this.py(p));
    ctx.textAlign = 'center';
    for (const t of tLabels) { ctx.font = t.bold ? 'bold 11px system-ui' : '11px system-ui'; ctx.fillText(t.s, t.x, h + 14); }

    // label harga terakhir + hitung mundur
    const remain = this.tfMs - ((Date.now() - last.t) % this.tfMs);
    this._axisLabel(ly, this.fmt(last.c), lastCol, '#fff', remain > 0 && this.tfMs <= 86400000 ? fmtCountdown(remain) : null);

    // label sumbu untuk gambar terpilih
    if (this.selected && !this.hidden) {
      const pts = this.selected.points;
      for (const p of pts) {
        const P = this.toPx(p);
        this._axisLabel(P.y, this.fmt(p.p), '#2962ff', '#fff');
        if (pts.length <= 2) this._timeLabel(P.x, fmtTime(p.t, this.tfMs), '#2962ff');
      }
    }
    if (cur && cur.x < w && cur.y < h) {
      this._axisLabel(cur.y, this.fmt(this.yp(cur.y)), th.crossBg, '#fff');
      const i = Math.round(this.xi(cur.x));
      this._timeLabel(this.ix(i), fmtTime(this.iToT(i), this.tfMs), th.crossBg);
    }
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
    const bw = Math.max(1, Math.floor(this.spacing * 0.7));
    for (let i = from; i <= to; i++) {
      const c = s[i], up = c.c >= c.o, col = up ? th.up : th.down;
      const x = Math.round(this.ix(i));
      const yo = this.py(c.o), yc = this.py(c.c), yh = this.py(c.h), yl = this.py(c.l);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1;
      if (type === 'bars') {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, yh); ctx.lineTo(x + 0.5, yl);
        ctx.moveTo(x - bw / 2, Math.round(yo) + 0.5); ctx.lineTo(x + 0.5, Math.round(yo) + 0.5);
        ctx.moveTo(x + 0.5, Math.round(yc) + 0.5); ctx.lineTo(x + bw / 2 + 1, Math.round(yc) + 0.5);
        ctx.stroke(); continue;
      }
      ctx.beginPath(); ctx.moveTo(x + 0.5, yh); ctx.lineTo(x + 0.5, yl); ctx.stroke();
      const top = Math.round(Math.min(yo, yc)), hgt = Math.max(1, Math.round(Math.abs(yc - yo)));
      if (bw <= 2) continue;
      if (type === 'hollow' && up) {
        ctx.fillStyle = th.bg; ctx.fillRect(x - Math.floor(bw / 2), top, bw, hgt);
        ctx.strokeRect(x - Math.floor(bw / 2) + 0.5, top + 0.5, bw - 1, Math.max(0, hgt - 1));
      } else ctx.fillRect(x - Math.floor(bw / 2), top, bw, hgt);
    }
  }

  _drawDrawing(d, selected) {
    const ctx = this.ctx;
    const { g, P } = this._geo(d);
    render(ctx, g, selected);
    if (selected) {
      for (const p of P) {
        ctx.beginPath(); ctx.arc(p.x, p.y, this.cursor?.touch ? 7 : 5, 0, Math.PI * 2);
        ctx.fillStyle = this.theme.bg; ctx.fill(); ctx.strokeStyle = '#2962ff'; ctx.lineWidth = 2; ctx.stroke();
      }
    }
  }

  _axisLabel(y, s, bg, fg, sub) {
    const { ctx } = this, x = this.plot.w + 1, hgt = sub ? 30 : 18;
    if (y < -20 || y > this.plot.h + 20) return;
    ctx.fillStyle = bg; roundRect(ctx, x, y - 9, AXIS_W - 2, hgt, 2); ctx.fill();
    ctx.fillStyle = fg; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x + 6, y);
    if (sub) { ctx.font = '10px system-ui'; ctx.fillText(sub, x + 6, y + 13); }
  }
  _timeLabel(x, s, bg) {
    const { ctx } = this;
    ctx.font = '11px system-ui';
    const tw = ctx.measureText(s).width + 12;
    ctx.fillStyle = bg; roundRect(ctx, x - tw / 2, this.plot.h + 2, tw, 20, 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, this.plot.h + 12);
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

  screenshot() { return this.canvas.toDataURL('image/png'); }
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pad = n => String(n).padStart(2, '0');
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
