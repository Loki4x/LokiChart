// Geo: perekam primitif gambar. Primitif yang sama dipakai untuk render dan hit-test.
const FAR = 1e5;

export class Geo {
  constructor(style) {
    this.prims = [];
    this.style = style; // { color, width, dash }
  }
  seg(a, b, o = {}) { this.prims.push({ k: 'seg', a, b, ...o }); return this; }
  ray(a, b, o = {}) {
    const d = dir(a, b); if (!d) return this;
    return this.seg(a, { x: a.x + d.x * FAR, y: a.y + d.y * FAR }, o);
  }
  line(a, b, o = {}) {
    const d = dir(a, b); if (!d) return this;
    return this.seg({ x: a.x - d.x * FAR, y: a.y - d.y * FAR }, { x: a.x + d.x * FAR, y: a.y + d.y * FAR }, o);
  }
  hline(y, x0 = -FAR, x1 = FAR, o = {}) { return this.seg({ x: x0, y }, { x: x1, y }, o); }
  vline(x, o = {}) { return this.seg({ x, y: -FAR }, { x, y: FAR }, o); }
  poly(pts, o = {}) { this.prims.push({ k: 'poly', pts, close: false, ...o }); return this; }
  area(pts, fill, o = {}) { this.prims.push({ k: 'poly', pts, close: true, fill, stroke: false, ...o }); return this; }
  circle(c, r, o = {}) { this.prims.push({ k: 'arc', c, r, a0: 0, a1: Math.PI * 2, ...o }); return this; }
  arc(c, r, a0, a1, o = {}) { this.prims.push({ k: 'arc', c, r, a0, a1, ...o }); return this; }
  ellipse(c, rx, ry, rot = 0, o = {}) { this.prims.push({ k: 'ellipse', c, rx, ry, rot, ...o }); return this; }
  text(x, y, s, o = {}) { this.prims.push({ k: 'text', x, y, s, ...o }); return this; }
  arrowHead(a, b, size = 10, o = {}) {
    const d = dir(a, b); if (!d) return this;
    const n = { x: -d.y, y: d.x };
    const p1 = { x: b.x - d.x * size + n.x * size * 0.5, y: b.y - d.y * size + n.y * size * 0.5 };
    const p2 = { x: b.x - d.x * size - n.x * size * 0.5, y: b.y - d.y * size - n.y * size * 0.5 };
    return this.poly([p1, b, p2], o);
  }
}

export function dir(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy);
  return l < 1e-9 ? null : { x: dx / l, y: dy / l };
}

export function render(ctx, geo, selected) {
  const st = geo.style;
  ctx.globalAlpha = st.alpha ?? 1;
  for (const p of geo.prims) {
    const color = p.color || st.color;
    ctx.lineWidth = (p.width || st.width) + (selected && p.k !== 'text' ? 0.5 : 0);
    ctx.strokeStyle = color;
    ctx.setLineDash(p.dash || (p.k === 'text' ? [] : st.dash) || []);
    if (p.k === 'seg') {
      ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke();
    } else if (p.k === 'poly') {
      if (p.pts.length < 2) continue;
      ctx.beginPath(); ctx.moveTo(p.pts[0].x, p.pts[0].y);
      for (let i = 1; i < p.pts.length; i++) ctx.lineTo(p.pts[i].x, p.pts[i].y);
      if (p.close) ctx.closePath();
      if (p.fill) { ctx.fillStyle = p.fill; ctx.fill(); }
      if (p.stroke !== false) ctx.stroke();
    } else if (p.k === 'arc') {
      if (p.r <= 0) continue;
      ctx.beginPath(); ctx.arc(p.c.x, p.c.y, p.r, p.a0, p.a1);
      if (p.fill) { ctx.fillStyle = p.fill; ctx.fill(); }
      if (p.stroke !== false) ctx.stroke();
    } else if (p.k === 'ellipse') {
      ctx.beginPath(); ctx.ellipse(p.c.x, p.c.y, Math.abs(p.rx), Math.abs(p.ry), p.rot, 0, Math.PI * 2);
      if (p.fill) { ctx.fillStyle = p.fill; ctx.fill(); }
      ctx.stroke();
    } else if (p.k === 'text') {
      ctx.font = p.font || '12px system-ui, sans-serif';
      ctx.textAlign = p.align || 'left';
      ctx.textBaseline = p.base || 'middle';
      if (p.bg) {
        const w = ctx.measureText(p.s).width, h = 18;
        let x0 = p.x - (p.align === 'center' ? w / 2 : p.align === 'right' ? w : 0) - 5;
        const y0 = p.y - (p.base === 'top' ? 0 : p.base === 'bottom' ? h : h / 2);
        ctx.fillStyle = p.bg; roundRect(ctx, x0, y0, w + 10, h, 4); ctx.fill();
      }
      ctx.fillStyle = p.color || st.color;
      ctx.fillText(p.s, p.x, p.y + (p.base === 'top' ? 3 : p.base === 'bottom' ? -3 : 0));
    }
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function distSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function inPoly(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function normAng(a) { a %= Math.PI * 2; return a < 0 ? a + Math.PI * 2 : a; }

export function hit(geo, p, tol) {
  for (const q of geo.prims) {
    if (q.k === 'seg' && distSeg(p, q.a, q.b) <= tol) return true;
    if (q.k === 'poly') {
      if (q.fill && q.close && inPoly(p, q.pts)) return true;
      if (q.stroke !== false) for (let i = 1; i < q.pts.length; i++) if (distSeg(p, q.pts[i - 1], q.pts[i]) <= tol) return true;
    }
    if (q.k === 'arc') {
      const d = Math.hypot(p.x - q.c.x, p.y - q.c.y);
      if (q.fill && d <= q.r) return true;
      if (Math.abs(d - q.r) <= tol) {
        if (q.a1 - q.a0 >= Math.PI * 2 - 1e-6) return true;
        const a = normAng(Math.atan2(p.y - q.c.y, p.x - q.c.x) - q.a0);
        if (a <= q.a1 - q.a0) return true;
      }
    }
    if (q.k === 'ellipse') {
      const c = Math.cos(-q.rot), s = Math.sin(-q.rot);
      const dx = p.x - q.c.x, dy = p.y - q.c.y;
      const x = dx * c - dy * s, y = dx * s + dy * c;
      const v = (x * x) / (q.rx * q.rx || 1) + (y * y) / (q.ry * q.ry || 1);
      if (q.fill ? v <= 1.1 : Math.abs(Math.sqrt(v) - 1) * Math.min(Math.abs(q.rx), Math.abs(q.ry)) <= tol) return true;
    }
    if (q.k === 'text' && q.hit) {
      if (Math.abs(p.x - q.x) < 60 && Math.abs(p.y - q.y) < 12) return true;
    }
  }
  return false;
}
