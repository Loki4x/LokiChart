// Indikator di legenda kiri atas: bingkai pilihan dengan tombol (👁 ⚙ 🗑 ⋯) dan dialog pengaturan Input / Corak / Visibilitas
import { INDICATORS, defaultParams, indicatorLabel } from './indicators.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = d => `<svg class="i" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const IC = {
  eye: 'M2 12C5 6 9 4 12 4S19 6 22 12C19 18 15 20 12 20S5 18 2 12Z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  eyeoff: 'M3 3L21 21 M10.6 10.6a3 3 0 0 0 4.2 4.2 M9.9 5.1A9.7 9.7 0 0 1 12 5c4 0 7.5 2.5 10 7a17 17 0 0 1 -3 4 M6.6 6.6C4.6 8 3.2 9.8 2 12c2.5 4.5 6 7 10 7c1.6 0 3.1 -.4 4.4 -1.1',
  set: 'M12 2L20.7 7V17L12 22L3.3 17V7Z M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
  trash: 'M4 6H20 M9 6V3H15V6 M6 6L7 21H17L18 6', more: 'M5 12h.01 M12 12h.01 M19 12h.01', close: 'M6 6L18 18 M18 6L6 18',
};

export function initStudyUI(ctx) {
  // ctx: { pane(), panes(), state, save, toast, popMenu(anchor, html, cb), uid() }
  const bar = $('#studyBar'), dlg = $('#studySettings');
  let cur = null; // { pane, id }

  const study = () => cur && cur.pane.cfg.studies.find(s => s.id === cur.id);
  const refresh = () => { cur?.pane.chart.invalidate(); ctx.save(); };

  function show(pane, id, rect) {
    cur = { pane, id };
    const s = study(); if (!s) return hide();
    bar.innerHTML = `<span class="sbn">${esc(indicatorLabel(s))}</span>
      <button class="icon-btn" data-a="eye" title="${s.hidden ? 'Tampilkan' : 'Sembunyikan'}">${icon(s.hidden ? IC.eyeoff : IC.eye)}</button>
      <button class="icon-btn" data-a="set" title="Pengaturan">${icon(IC.set)}</button>
      <button class="icon-btn" data-a="del" title="Hapus">${icon(IC.trash)}</button>
      <button class="icon-btn" data-a="more" title="Lainnya">${icon(IC.more)}</button>`;
    bar.classList.remove('hidden');
    const ox = pane.el.offsetLeft, oy = pane.el.offsetTop;
    bar.style.left = ox + Math.max(2, rect.x0 - 4) + 'px';
    bar.style.top = oy + rect.y0 + (rect.y1 - rect.y0) / 2 - bar.offsetHeight / 2 + 'px';
  }
  function hide() { bar.classList.add('hidden'); cur = null; }
  document.addEventListener('pointerdown', e => {
    if (!bar.classList.contains('hidden') && !bar.contains(e.target) && !e.target.closest('#popMenu') && !dlg.contains(e.target)) hide();
  }, true);

  bar.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a, s = study(); if (!a || !s) return;
    const list = cur.pane.cfg.studies;
    if (a === 'eye') { s.hidden = !s.hidden; refresh(); return hide(); }
    if (a === 'set') { const p = cur.pane; hide(); return open(p, s.id); }
    if (a === 'del') { list.splice(list.indexOf(s), 1); refresh(); ctx.toast(`${INDICATORS[s.type].name} dihapus`); return hide(); }
    if (a === 'more') {
      ctx.popMenu(e.target.closest('[data-a]'), `<button class="mi" data-v="dup">Duplikat</button>
        <button class="mi" data-v="top">Pindah ke atas</button><button class="mi" data-v="bottom">Pindah ke bawah</button>
        <button class="mi" data-v="hideall">Sembunyikan semua indikator</button><button class="mi" data-v="showall">Tampilkan semua indikator</button>
        <button class="mi" data-v="delall">Hapus semua indikator</button>`, v => {
        const i = list.indexOf(s);
        if (v === 'dup') list.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(s)), id: ctx.uid() });
        if (v === 'top') { list.splice(i, 1); list.unshift(s); }
        if (v === 'bottom') { list.splice(i, 1); list.push(s); }
        if (v === 'hideall') list.forEach(x => { x.hidden = true; });
        if (v === 'showall') list.forEach(x => { x.hidden = false; });
        if (v === 'delall' && confirm('Hapus semua indikator di chart ini?')) list.length = 0;
        refresh(); hide();
      });
    }
  });

  // ---------- dialog Input / Corak / Visibilitas ----------
  let orig = null, tab = 'input', dpane = null, did = null;
  const dstudy = () => dpane?.cfg.studies.find(s => s.id === did);
  function open(pane, id, startTab = 'input') {
    dpane = pane; did = id; tab = startTab;
    const s = dstudy(); if (!s) return;
    orig = JSON.parse(JSON.stringify(s));
    render(); dlg.classList.remove('hidden');
  }
  function field(p, v) {
    if (p.type === 'bool') return `<label class="chk"><input type="checkbox" data-k="${p.key}" ${v ? 'checked' : ''}> ${esc(p.label)}</label>`;
    if (p.type === 'select') return `<div class="frow"><span>${esc(p.label)}</span><div class="fctl"><select data-k="${p.key}">${p.options.map(o => `<option ${String(o) === String(v) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div></div>`;
    if (p.type === 'color') return `<div class="frow"><span>${esc(p.label)}</span><div class="fctl"><input type="color" data-k="${p.key}" value="${esc(v)}"></div></div>`;
    return `<div class="frow"><span>${esc(p.label)}</span><div class="fctl"><input type="number" inputmode="decimal" data-k="${p.key}" value="${v}" min="${p.min}" max="${p.max}" step="${p.step || 1}"></div></div>`;
  }
  function render() {
    const s = dstudy(), def = INDICATORS[s.type];
    const inputs = def.params.filter(p => p.type !== 'color'), colors = def.params.filter(p => p.type === 'color');
    let body = '';
    if (tab === 'input') body = inputs.length ? `<div class="fsec">INPUT</div>` + inputs.map(p => field(p, s.params[p.key])).join('') : '<p class="note">Indikator ini tidak memiliki input.</p>';
    else if (tab === 'corak') {
      body = (colors.length ? `<div class="fsec">WARNA</div>` + colors.map(p => field(p, s.params[p.key])).join('') : '') +
        `<div class="fsec">GARIS</div><div class="frow"><span>Ketebalan garis</span><div class="fctl"><select data-lw="1">${[['', 'Bawaan'], [1, '1px'], [2, '2px'], [3, '3px'], [4, '4px']].map(([v, n]) => `<option value="${v}" ${String(s.lw || '') === String(v) ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>`;
    } else {
      const v = s.vis || {};
      body = `<p class="note">Tampilkan indikator ini pada timeframe:</p>` + [['minutes', 'Menit'], ['hours', 'Jam'], ['days', 'Hari'], ['weeks', 'Minggu & bulan']].map(([k, n]) => `<label class="chk"><input type="checkbox" data-vis="${k}" ${v[k] !== false ? 'checked' : ''}> ${n}</label>`).join('');
    }
    dlg.querySelector('.ds-box').innerHTML = `
      <div class="panel-head"><h2 class="ellip">${esc(def.name)}</h2><button class="icon-btn" data-x="cancel" title="Tutup">${icon(IC.close)}</button></div>
      <div class="dtabs">${[['input', 'Input'], ['corak', 'Corak'], ['vis', 'Visibilitas']].map(([k, n]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="ds-body">${body}</div>
      <div class="ds-foot"><button class="ghost" data-x="def">Bawaan ▾</button><span class="spacer"></span><button class="ghost" data-x="cancel">Batal</button><button class="primary" data-x="ok">Ok</button></div>`;
  }
  const live = fn => { const s = dstudy(); if (s) { fn(s); dpane.chart.invalidate(); } };
  dlg.addEventListener('click', e => {
    if (e.target === dlg) return finish(false);
    const t = e.target.closest('[data-tab]'); if (t) { tab = t.dataset.tab; return render(); }
    const x = e.target.closest('[data-x]')?.dataset.x;
    if (x === 'ok') finish(true);
    if (x === 'cancel') finish(false);
    if (x === 'def') {
      const s = dstudy();
      ctx.popMenu(e.target.closest('[data-x]'), `<button class="mi" data-v="reset">Reset ke bawaan</button><button class="mi" data-v="save">Simpan sebagai bawaan</button>`, v => {
        if (v === 'reset') { live(st => { st.params = { ...defaultParams(st.type), ...(ctx.state.studyDefaults?.[st.type] || {}) }; delete st.lw; }); render(); }
        if (v === 'save') { ctx.state.studyDefaults ||= {}; ctx.state.studyDefaults[s.type] = { ...s.params }; ctx.save(); ctx.toast('Disimpan sebagai bawaan untuk indikator baru'); }
      });
    }
  });
  const onField = e => {
    const el = e.target;
    if (el.dataset.k) {
      const p = INDICATORS[dstudy().type].params.find(q => q.key === el.dataset.k);
      let v = p.type === 'bool' ? el.checked : el.value;
      if (p.type === 'number') { v = parseFloat(String(v).replace(',', '.')); if (!isFinite(v)) return; v = Math.max(p.min, Math.min(p.max, v)); }
      live(s => { s.params = { ...s.params, [p.key]: v }; });
    } else if (el.dataset.lw) live(s => { if (el.value) s.lw = +el.value; else delete s.lw; });
    else if (el.dataset.vis) live(s => { s.vis = { ...(s.vis || {}), [el.dataset.vis]: el.checked }; });
  };
  dlg.addEventListener('input', onField); dlg.addEventListener('change', onField);
  function finish(ok) {
    dlg.classList.add('hidden');
    const s = dstudy();
    if (!ok && s) { Object.keys(s).forEach(k => delete s[k]); Object.assign(s, orig); }
    dpane?.chart.invalidate(); ctx.save();
  }

  return { show, hide, open };
}
