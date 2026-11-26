// Toolbar mengambang untuk gambar terpilih + dialog pengaturan gambar (Corak / Teks / Koordinat / Visibilitas)
import { TOOLS, opt, defaultLevels, rgba } from './tools.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clone = o => JSON.parse(JSON.stringify(o));
const icon = d => `<svg class="i" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const IC = {
  drag: 'M9 5h.01 M15 5h.01 M9 12h.01 M15 12h.01 M9 19h.01 M15 19h.01',
  tpl: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M17.5 14v7 M14 17.5h7',
  pen: 'M4 17L15 6L18 9L7 20H4Z M13 8L16 11',
  text: 'M6 5H18 M12 5V17',
  set: 'M12 2L20.7 7V17L12 22L3.3 17V7Z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  alarm: 'M12 13m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M12 9V13L14 15 M5 3L2 6 M19 3L22 6 M19 19h4 M21 17v4',
  lock: 'M6 11H18V21H6Z M8 11V7a4 4 0 0 1 8 0', unlock: 'M6 11H18V21H6Z M8 11V7a4 4 0 0 1 7.5 -2',
  hide: 'M3 3L21 21 M10.6 10.6a3 3 0 0 0 4.2 4.2 M9.9 5.1A9.7 9.7 0 0 1 12 5c4 0 7.5 2.5 10 7a17 17 0 0 1 -3 4 M6.6 6.6C4.6 8 3.2 9.8 2 12c2.5 4.5 6 7 10 7c1.6 0 3.1 -.4 4.4 -1.1',
  angle: 'M4 20H20L4 4Z M4 14a6 6 0 0 1 6 6 M8 20V18 M12 20V18 M16 20V18',
  trash: 'M4 6H20 M9 6V3H15V6 M6 6L7 21H17L18 6', more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  close: 'M6 6L18 18 M18 6L6 18', edit: 'M4 20h4L19 9l-4-4L4 16z',
};
const PALETTE = [
  '#ffffff', '#d1d4dc', '#b2b5be', '#9598a1', '#787b86', '#5d606b', '#434651', '#2a2e39', '#131722', '#000000',
  '#f23645', '#ff9800', '#ffeb3b', '#4caf50', '#089981', '#00bcd4', '#2962ff', '#673ab7', '#9c27b0', '#e91e63',
  '#fccbcd', '#ffe0b2', '#fff9c4', '#c8e6c9', '#ace5dc', '#b2ebf2', '#bbd9fb', '#d1c4e9', '#e1bee7', '#f8bbd0',
  '#f7525f', '#ffb74d', '#fff176', '#81c784', '#42bda8', '#4dd0e1', '#5b9cf6', '#9575cd', '#ba68c8', '#f06292',
  '#b22833', '#f57c00', '#fbc02d', '#388e3c', '#056656', '#0097a7', '#1848cc', '#512da8', '#7b1fa2', '#c2185b',
];
const DASHES = [['solid', [], 'Garis lurus'], ['dash', [6, 4], 'Putus-putus'], ['dot', [1, 3], 'Titik-titik']];
const dashKey = d => !d?.length ? 'solid' : d[0] > 2 ? 'dash' : 'dot';
const dashSvg = k => `<svg class="i" viewBox="0 0 24 24"><path d="M3 12H21" stroke-dasharray="${k === 'solid' ? '' : k === 'dash' ? '4 3' : '1 3'}"/></svg>`;
const LINE_TOOLS = t => !!TOOLS[t]?.line;
const ALERTABLE = t => LINE_TOOLS(t) || ['hline', 'hray', 'pricelabel'].includes(t);
const FILL_TOOLS = ['rect', 'ellipse', 'circle', 'triangle', 'rotrect', 'polyline', 'arcshape', 'parallel', 'flattop', 'disjoint', 'pitchfork', 'schiff', 'modschiff', 'insidepf', 'xabcd', 'cypher', 'headshoulders', 'trianglepat', 'timecycles', 'fibret', 'fibext', 'gannsquare', 'gannbox'];

export function initDrawUI(ctx) {
  // ctx: { chart(), pane(), state, save, toast, addLineAlert(d), onChange() }
  const bar = $('#drawBar');
  let manualPos = null, popover = null;

  function closePop() { popover?.remove(); popover = null; }
  function openPop(anchor, html, onClick, cls = '') {
    closePop();
    popover = document.createElement('div');
    popover.className = 'menu dpop ' + cls; popover.innerHTML = html;
    document.body.appendChild(popover);
    const r = anchor.getBoundingClientRect(), w = popover.offsetWidth, h = popover.offsetHeight;
    let x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8), y = r.bottom + 6;
    if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 6);
    popover.style.left = x + 'px'; popover.style.top = y + 'px';
    popover.addEventListener('click', e => onClick(e));
    popover.addEventListener('input', e => onClick(e));
  }
  document.addEventListener('pointerdown', e => { if (popover && !popover.contains(e.target) && !bar.contains(e.target)) closePop(); }, true);

  function colorPop(anchor, current, alpha, onPick) {
    const html = `<div class="pal">${PALETTE.map(c => `<span data-c="${c}" class="${c === current ? 'on' : ''}" style="background:${c}"></span>`).join('')}</div>
      <label class="pal-row">+ Warna khusus <input type="color" data-custom value="${/^#[0-9a-f]{6}$/i.test(current) ? current : '#2962ff'}"></label>
      ${alpha != null ? `<label class="pal-row">Opasitas <input type="range" min="0" max="100" value="${Math.round(alpha * 100)}" data-alpha><b>${Math.round(alpha * 100)}%</b></label>` : ''}`;
    openPop(anchor, html, e => {
      const c = e.target.closest('[data-c]');
      if (c && e.type === 'click') { onPick({ color: c.dataset.c }); popover.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('on', x === c)); }
      if (e.target.matches('[data-custom]') && e.type === 'input') onPick({ color: e.target.value });
      if (e.target.matches('[data-alpha]') && e.type === 'input') { e.target.nextElementSibling.textContent = e.target.value + '%'; onPick({ alpha: e.target.value / 100 }); }
    }, 'wide');
  }

  function edit(fn, remember = false) {
    const c = ctx.chart(), d = c.selected; if (!d) return;
    c.snapshot(); fn(d); c.commit();
    if (remember) { ctx.state.styleDefaults[d.tool] = { ...d.style }; ctx.save(); }
    render(d);
  }

  function render(d) {
    if (!d || ctx.chart().hidden) { bar.classList.add('hidden'); closePop(); manualPos = null; return; }
    const t = TOOLS[d.tool];
    const tcol = d.textStyle?.color || d.style.color;
    bar.innerHTML = `
      <span class="db-drag" data-a="drag" title="Geser toolbar">${icon(IC.drag)}</span>
      <button class="icon-btn" data-a="tpl" title="Template">${icon(IC.tpl)}</button>
      <button class="icon-btn ul" data-a="color" title="Warna garis">${icon(IC.pen)}<i style="background:${d.style.color}"></i></button>
      <button class="icon-btn ul" data-a="tcolor" title="Teks">${icon(IC.text)}<i style="background:${tcol}"></i></button>
      <button class="icon-btn w" data-a="width" title="Ketebalan garis"><svg class="i" viewBox="0 0 24 24"><path d="M3 12H10" stroke-width="${Math.min(4, d.style.width)}"/></svg>${d.style.width}px</button>
      <button class="icon-btn" data-a="dash" title="Gaya garis">${dashSvg(dashKey(d.style.dash))}</button>
      <button class="icon-btn" data-a="settings" title="Pengaturan">${icon(IC.set)}</button>
      ${ALERTABLE(d.tool) ? `<button class="icon-btn" data-a="alert" title="Tambah peringatan pada gambar">${icon(IC.alarm)}</button>` : ''}
      <button class="icon-btn ${d.locked ? 'on' : ''}" data-a="lock" title="${d.locked ? 'Buka kunci' : 'Kunci'}">${icon(d.locked ? IC.lock : IC.unlock)}</button>
      ${t.freehand || t.n === 1 ? '' : `<button class="icon-btn ${ctx.chart().angleSnap ? 'on dark' : ''}" data-a="angle" title="Penggaris sudut (menempel ke kelipatan 15°)">${icon(IC.angle)}</button>`}
      <button class="icon-btn" data-a="hide" title="Sembunyikan">${icon(IC.hide)}</button>
      <button class="icon-btn" data-a="delete" title="Hapus">${icon(IC.trash)}</button>
      <button class="icon-btn" data-a="more" title="Lainnya">${icon(IC.more)}</button>`;
    bar.classList.remove('hidden');
    position(d);
  }

  function position(d) {
    if (bar.classList.contains('hidden')) return;
    const p = ctx.pane(), wrap = $('#chartWrap');
    const W = wrap.clientWidth, bw = bar.offsetWidth, bh = bar.offsetHeight;
    if (manualPos) { bar.style.left = Math.min(Math.max(4, manualPos.x), W - bw - 4) + 'px'; bar.style.top = Math.max(4, manualPos.y) + 'px'; return; }
    const b = p.chart.boundsOf(d);
    const ox = p.el.offsetLeft, oy = p.el.offsetTop, pw = p.el.clientWidth, ph = p.el.clientHeight;
    const x = Math.min(Math.max(8, (b.x0 + b.x1) / 2 - bw / 2), pw - bw - 8);
    let y = b.y0 - bh - 24; if (y < 8) y = Math.min(b.y1 + 24, ph - bh - 8);
    bar.style.left = ox + Math.max(4, x) + 'px'; bar.style.top = oy + Math.max(4, y) + 'px';
  }

  // geser toolbar dengan pegangan ⋮⋮
  bar.addEventListener('pointerdown', e => {
    if (!e.target.closest('[data-a=drag]')) return;
    e.preventDefault();
    const r = bar.getBoundingClientRect(), wr = $('#chartWrap').getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mv = ev => { manualPos = { x: ev.clientX - wr.left - dx, y: ev.clientY - wr.top - dy }; position(ctx.chart().selected); };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  });

  bar.addEventListener('click', e => {
    const btn = e.target.closest('[data-a]'); if (!btn) return;
    const a = btn.dataset.a, c = ctx.chart(), d = c.selected; if (!d || a === 'drag') return;
    switch (a) {
      case 'color': {
        const alpha = d.style.alpha ?? 1;
        return colorPop(btn, d.style.color, alpha, v => edit(x => { if (v.color) x.style.color = v.color; if (v.alpha != null) x.style.alpha = v.alpha; }, true));
      }
      case 'tcolor': {
        const has = !!d.text || TOOLS[d.tool].needsText;
        return openPop(btn, `${has ? '' : `<button class="mi" data-v="add">Tambah teks…</button>`}
          <div class="pal">${PALETTE.map(col => `<span data-c="${col}" style="background:${col}"></span>`).join('')}</div>
          <div class="mh">Ukuran</div><div class="chips">${[10, 12, 14, 16, 20, 24, 28].map(sz => `<button data-sz="${sz}" class="${(d.textStyle?.size || 13) === sz ? 'on' : ''}">${sz}</button>`).join('')}</div>
          <button class="mi" data-v="edit">Ubah teks…</button>`, ev => {
          if (ev.type !== 'click') return;
          const col = ev.target.closest('[data-c]'), sz = ev.target.closest('[data-sz]'), v = ev.target.closest('[data-v]')?.dataset.v;
          if (col) edit(x => { x.textStyle = { ...(x.textStyle || {}), color: col.dataset.c }; });
          if (sz) edit(x => { x.textStyle = { ...(x.textStyle || {}), size: +sz.dataset.sz }; });
          if (v) { closePop(); openSettings(d, 'teks'); }
        }, 'wide');
      }
      case 'width':
        return openPop(btn, [1, 2, 3, 4].map(w => `<button class="mi ${d.style.width === w ? 'on' : ''}" data-w="${w}"><svg class="i" viewBox="0 0 24 24"><path d="M3 12H21" stroke-width="${w}"/></svg> ${w}px</button>`).join(''),
          ev => { const w = ev.target.closest('[data-w]'); if (w && ev.type === 'click') { closePop(); edit(x => { x.style.width = +w.dataset.w; }, true); } });
      case 'dash':
        return openPop(btn, DASHES.map(([k, , n]) => `<button class="mi ${dashKey(d.style.dash) === k ? 'on' : ''}" data-k="${k}">${dashSvg(k)} ${n}</button>`).join(''),
          ev => { const k = ev.target.closest('[data-k]'); if (k && ev.type === 'click') { closePop(); edit(x => { x.style.dash = DASHES.find(q => q[0] === k.dataset.k)[1]; }, true); } });
      case 'tpl': return templateMenu(btn, d, () => render(d));
      case 'settings': closePop(); return openSettings(d);
      case 'alert': closePop(); return ctx.addLineAlert(d);
      case 'lock': return edit(x => { x.locked = !x.locked; });
      case 'angle': { ctx.setAngleSnap(!c.angleSnap); return render(c.selected); }
      case 'hide': { closePop(); c.snapshot(); d.hidden = true; c.selected = null; c.commit(); ctx.onSelect(null); ctx.toast('Gambar disembunyikan — tampilkan lagi lewat Pohon Objek'); return; }
      case 'delete': closePop(); return c.removeDrawing(d);
      case 'more':
        return openPop(btn, `<button class="mi" data-v="clone">Klon</button><button class="mi" data-v="front">Bawa ke depan</button><button class="mi" data-v="back">Kirim ke belakang</button>
          <button class="mi" data-v="settings">Pengaturan…</button><button class="mi" data-v="delete">Hapus</button>`, ev => {
          const v = ev.target.closest('[data-v]')?.dataset.v; if (!v || ev.type !== 'click') return;
          closePop();
          if (v === 'clone') c.cloneDrawing(d);
          if (v === 'front' || v === 'back') { c.snapshot(); c.drawings = c.drawings.filter(x => x !== d); v === 'front' ? c.drawings.push(d) : c.drawings.unshift(d); c.commit(); }
          if (v === 'settings') openSettings(d);
          if (v === 'delete') c.removeDrawing(d);
        });
    }
  });

  // ---------- Template ----------
  function snapshotOf(d) { return { style: clone(d.style), opt: clone(d.opt || {}), textStyle: clone(d.textStyle || {}) }; }
  function applyTpl(d, tp) { d.style = clone(tp.style); d.opt = clone(tp.opt || {}); if (tp.textStyle) d.textStyle = clone(tp.textStyle); }
  function templateMenu(anchor, d, after) {
    const st = ctx.state; st.templates ||= {};
    const list = st.templates[d.tool] || [];
    openPop(anchor, `<button class="mi" data-v="save">Simpan sebagai…</button>
      <button class="mi" data-v="default">Jadikan default</button>
      <button class="mi" data-v="reset">Reset ke pengaturan awal</button>
      ${list.length ? '<div class="mh">Template tersimpan</div>' : ''}
      ${list.map((t, k) => `<button class="mi" data-v="apply" data-k="${k}">${esc(t.name)}<span class="x" data-del="${k}">✕</span></button>`).join('')}`, ev => {
      if (ev.type !== 'click') return;
      const del = ev.target.closest('[data-del]');
      if (del) { list.splice(+del.dataset.del, 1); st.templates[d.tool] = list; ctx.save(); closePop(); return; }
      const b = ev.target.closest('[data-v]'); if (!b) return;
      closePop();
      const c = ctx.chart();
      if (b.dataset.v === 'save') {
        const name = prompt('Nama template:', `${TOOLS[d.tool].name} ${list.length + 1}`);
        if (name) { list.push({ name, ...snapshotOf(d) }); st.templates[d.tool] = list; ctx.save(); ctx.toast('Template disimpan'); }
      } else if (b.dataset.v === 'default') {
        const s = snapshotOf(d); st.styleDefaults[d.tool] = s.style; st.extraDefaults ||= {}; st.extraDefaults[d.tool] = { opt: s.opt, textStyle: s.textStyle }; ctx.save(); ctx.applyDefaults(); ctx.toast('Dijadikan default untuk gambar baru');
      } else if (b.dataset.v === 'reset') {
        c.snapshot(); d.style = { ...(TOOLS[d.tool].defStyle || { color: '#2962ff', width: 2, dash: [] }) }; d.opt = {}; d.textStyle = {}; c.commit();
        delete st.styleDefaults[d.tool]; if (st.extraDefaults) delete st.extraDefaults[d.tool]; ctx.save(); ctx.applyDefaults();
      } else if (b.dataset.v === 'apply') { c.snapshot(); applyTpl(d, list[+b.dataset.k]); c.commit(); }
      after?.();
    });
  }

  // ---------- Dialog pengaturan (foto 2) ----------
  const dlg = $('#drawSettings');
  let orig = null, cur = null, tab = 'corak';
  function openSettings(d, startTab = 'corak') {
    const c = ctx.chart();
    orig = clone(d); cur = d; tab = startTab;
    c.snapshot();
    renderSettings();
    dlg.classList.remove('hidden');
  }
  function swatch(key, color, alpha) { return `<button class="swatch" data-sw="${key}" style="--c:${color};--a:${alpha ?? 1}"><i></i></button>`; }
  function sel(key, value, options) { return `<select data-f="${key}">${options.map(([v, l]) => `<option value="${v}" ${String(v) === String(value) ? 'selected' : ''}>${l}</option>`).join('')}</select>`; }
  function chk(key, on, label) { return `<label class="chk"><input type="checkbox" data-f="${key}" ${on ? 'checked' : ''}> ${label}</label>`; }

  function renderSettings() {
    const d = cur, t = TOOLS[d.tool], c = ctx.chart();
    const tabs = [['corak', 'Corak'], ['teks', 'Teks'], ['koordinat', 'Koordinat'], ['visibilitas', 'Visibilitas']];
    let body = '';
    if (tab === 'corak') {
      body += `<div class="frow"><span>Garis</span><div class="fctl">${swatch('line', d.style.color, d.style.alpha)}
        ${sel('dash', dashKey(d.style.dash), DASHES.map(([k, , n]) => [k, n]))}
        ${sel('width', d.style.width, [1, 2, 3, 4].map(w => [w, w + 'px']))}</div></div>`;
      if (t.line) {
        body += `<div class="frow"><span>Ujung garis</span><div class="fctl">${sel('leftEnd', opt(d, 'leftEnd'), [['normal', 'Kiri: biasa'], ['arrow', 'Kiri: panah']])}${sel('rightEnd', opt(d, 'rightEnd'), [['normal', 'Kanan: biasa'], ['arrow', 'Kanan: panah']])}</div></div>`;
      }
      if (t.line || t.fib) body += `<div class="frow"><span>Perpanjang</span><div class="fctl">${sel('extend', t.line ? opt(d, 'extend') : (d.opt?.extend || (d.extend ? 'right' : 'none')), [['none', 'Jangan perpanjang'], ['left', 'Perpanjang ke kiri'], ['right', 'Perpanjang ke kanan'], ['both', 'Perpanjang ke dua arah']])}</div></div>`;
      if (t.line) {
        body += chk('middle', opt(d, 'middle'), 'Titik tengah') + chk('priceLabels', opt(d, 'priceLabels'), 'Label harga');
        body += `<div class="fsec">INFO</div>
          <div class="frow"><span>Statistik</span><div class="fctl">${sel('stats', opt(d, 'stats'), [['hidden', 'Tersembunyi'], ['compact', 'Ringkas'], ['values', 'Nilai'], ['full', 'Lengkap']])}</div></div>
          <div class="frow"><span>Posisi statistik</span><div class="fctl">${sel('statsPos', opt(d, 'statsPos'), [['left', 'Kiri'], ['center', 'Tengah'], ['right', 'Kanan']])}</div></div>
          ${chk('alwaysStats', opt(d, 'alwaysStats'), 'Selalu tampilkan statistik')}`;
      }
      if (FILL_TOOLS.includes(d.tool)) {
        const fc = d.style.fill || rgba(d.style.color, 0.15);
        body += `<div class="frow"><span>${chk('fillOn', d.style.fillOn !== false, 'Latar belakang')}</span><div class="fctl">${swatch('fill', fc.startsWith('rgba') ? d.style.color : fc, d.style.fill ? undefined : 0.15)}</div></div>`;
      }
      if (t.fib) {
        const lv = d.opt?.levels || defaultLevels(t.fib);
        body += chk('labels', d.opt?.labels !== false, 'Tampilkan label level') + `<div class="fsec">LEVEL</div><div class="levels">${lv.map((l, k) =>
          `<div class="lvl"><input type="checkbox" data-lv-on="${k}" ${l.on ? 'checked' : ''}><input type="number" step="any" inputmode="decimal" data-lv-v="${k}" value="${l.v}">${swatch('lv' + k, l.color)}</div>`).join('')}</div>`;
      }
    } else if (tab === 'teks') {
      const ts = d.textStyle || {};
      body += `<textarea data-f="text" rows="3" placeholder="Tambahkan teks">${esc(d.text || '')}</textarea>
        <div class="frow"><span>Warna & ukuran</span><div class="fctl">${swatch('text', ts.color || d.style.color)}${sel('tsize', ts.size || 13, [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32].map(v => [v, v]))}
          <button class="tbtn ${ts.bold ? 'on' : ''}" data-tb="bold"><b>B</b></button><button class="tbtn ${ts.italic ? 'on' : ''}" data-tb="italic"><i>I</i></button></div></div>`;
      if (!t.needsText) body += `<div class="frow"><span>Posisi teks</span><div class="fctl">${sel('valign', ts.valign || 'top', [['top', 'Atas'], ['middle', 'Tengah'], ['bottom', 'Bawah']])}${sel('halign', ts.halign || 'center', [['left', 'Kiri'], ['center', 'Tengah'], ['right', 'Kanan']])}</div></div>`;
    } else if (tab === 'koordinat') {
      const pts = t.freehand ? [] : d.points;
      body += pts.map((p, k) => {
        const dt = new Date(p.t), loc = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        return `<div class="fsec">TITIK #${k + 1}</div><div class="frow"><span>Harga</span><div class="fctl"><input type="number" step="any" inputmode="decimal" data-pp="${k}" value="${+p.p.toFixed(c.digits)}"></div></div>
          <div class="frow"><span>Waktu</span><div class="fctl"><input type="datetime-local" data-pt="${k}" value="${loc}"></div></div>`;
      }).join('') || '<p class="note">Koordinat tidak tersedia untuk gambar bebas.</p>';
    } else {
      const v = d.vis || {};
      body += `<p class="note">Tampilkan gambar ini pada timeframe:</p>` + [['minutes', 'Menit'], ['hours', 'Jam'], ['days', 'Hari'], ['weeks', 'Minggu & bulan']].map(([k, n]) => chk('vis_' + k, v[k] !== false, n)).join('');
    }
    dlg.querySelector('.ds-box').innerHTML = `
      <div class="panel-head"><h2><span>${esc(d.name || t.name)}</span> <button class="icon-btn sm" data-x="rename" title="Ganti nama">${icon(IC.edit)}</button></h2><button class="icon-btn" data-x="cancel" title="Tutup">${icon(IC.close)}</button></div>
      <div class="dtabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="ds-body">${body}</div>
      <div class="ds-foot"><button class="ghost" data-x="tpl">Template ▾</button><span class="spacer"></span><button class="ghost" data-x="cancel">Batal</button><button class="primary" data-x="ok">Ok</button></div>`;
  }
  function live(fn) { fn(cur); ctx.chart().invalidate(); }
  dlg.addEventListener('click', e => {
    if (e.target === dlg) return finish(false);
    const tb = e.target.closest('[data-tab]'); if (tb) { tab = tb.dataset.tab; return renderSettings(); }
    const x = e.target.closest('[data-x]')?.dataset.x;
    if (x === 'cancel') return finish(false);
    if (x === 'ok') return finish(true);
    if (x === 'rename') { const n = prompt('Nama gambar:', cur.name || TOOLS[cur.tool].name); if (n != null) { live(d => { d.name = n || undefined; }); renderSettings(); } return; }
    if (x === 'tpl') return templateMenu(e.target.closest('[data-x]'), cur, renderSettings);
    const bold = e.target.closest('[data-tb]');
    if (bold) { live(d => { d.textStyle = { ...(d.textStyle || {}), [bold.dataset.tb]: !d.textStyle?.[bold.dataset.tb] }; }); return renderSettings(); }
    const sw = e.target.closest('[data-sw]');
    if (sw) {
      const k = sw.dataset.sw;
      const curCol = k === 'line' ? cur.style.color : k === 'text' ? (cur.textStyle?.color || cur.style.color) : k === 'fill' ? (cur.style.fill || cur.style.color) : (cur.opt?.levels || defaultLevels(TOOLS[cur.tool].fib))[+k.slice(2)].color;
      colorPop(sw, curCol, k === 'line' ? (cur.style.alpha ?? 1) : null, v => {
        live(d => {
          if (k === 'line') { if (v.color) d.style.color = v.color; if (v.alpha != null) d.style.alpha = v.alpha; }
          else if (k === 'text') d.textStyle = { ...(d.textStyle || {}), color: v.color };
          else if (k === 'fill') { d.style.fill = rgba(v.color, 0.2); d.style.fillOn = true; }
          else { d.opt ||= {}; d.opt.levels ||= defaultLevels(TOOLS[d.tool].fib); d.opt.levels[+k.slice(2)].color = v.color; }
        });
        renderSettings();
      });
    }
  });
  dlg.addEventListener('input', e => onField(e.target));
  dlg.addEventListener('change', e => onField(e.target));
  function onField(el) {
    const f = el.dataset.f;
    live(d => {
      d.opt ||= {};
      if (f === 'dash') d.style.dash = DASHES.find(q => q[0] === el.value)[1];
      else if (f === 'width') d.style.width = +el.value;
      else if (['leftEnd', 'rightEnd', 'extend', 'stats', 'statsPos'].includes(f)) d.opt[f] = el.value;
      else if (['middle', 'priceLabels', 'alwaysStats', 'labels'].includes(f)) d.opt[f] = el.checked;
      else if (f === 'fillOn') d.style.fillOn = el.checked;
      else if (f === 'text') d.text = el.value;
      else if (f === 'tsize') d.textStyle = { ...(d.textStyle || {}), size: +el.value };
      else if (f === 'valign' || f === 'halign') d.textStyle = { ...(d.textStyle || {}), [f]: el.value };
      else if (f?.startsWith('vis_')) { d.vis = { ...(d.vis || {}), [f.slice(4)]: el.checked }; }
      else if (el.dataset.lvOn != null || el.dataset.lvV != null) {
        d.opt.levels ||= defaultLevels(TOOLS[d.tool].fib);
        if (el.dataset.lvOn != null) d.opt.levels[+el.dataset.lvOn].on = el.checked;
        else { const v = parseFloat(el.value); if (isFinite(v)) d.opt.levels[+el.dataset.lvV].v = v; }
      } else if (el.dataset.pp != null) { const v = parseFloat(el.value); if (isFinite(v)) d.points[+el.dataset.pp].p = v; }
      else if (el.dataset.pt != null && el.value) { const t = new Date(el.value).getTime(); if (isFinite(t)) d.points[+el.dataset.pt].t = t; }
    });
  }
  function finish(ok) {
    const c = ctx.chart();
    dlg.classList.add('hidden'); closePop();
    if (!cur) return;
    if (!ok) {
      Object.keys(cur).forEach(k => delete cur[k]); Object.assign(cur, orig);
      c.history.pop(); c.invalidate();
    } else c.commit();
    render(c.selected); cur = null;
  }

  return { render, position, openSettings, isOpen: () => !dlg.classList.contains('hidden'), reset: () => { manualPos = null; } };
}
