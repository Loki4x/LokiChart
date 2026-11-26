// Dialog "Pengaturan" chart dengan menu kiri (Simbol, Baris status, Skala dan garis, Canvas, Trading, Peringatan, Peristiwa)
import { DEFAULT_CS, THEMES } from './chart.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = d => `<svg class="i" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const NAV = [
  ['simbol', 'Simbol', 'M8 3V7 M8 17V21 M6 7H10V17H6Z M16 6V9 M16 15V18 M14 9H18V15H14Z'],
  ['status', 'Baris status', 'M4 6H20 M4 12H14 M4 18H17'],
  ['skala', 'Skala dan garis', 'M4 4V20H20 M8 16L12 10L15 13L20 7'],
  ['canvas', 'Canvas', 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z M7.5 11h.01 M10 7h.01 M15 7h.01'],
  ['trading', 'Trading', 'M3 17L9 11L13 15L21 7 M15 7H21V13'],
  ['peringatan', 'Peringatan', 'M12 13m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M12 9V13L14 15 M5 3L2 6 M19 3L22 6'],
  ['peristiwa', 'Peristiwa', 'M4 5H20V20H4Z M4 9H20 M8 3V7 M16 3V7'],
];
const TZ = [['local', 'Waktu perangkat'], ['UTC', 'UTC'], ['Asia/Jakarta', '(UTC+7) Jakarta'], ['Asia/Makassar', '(UTC+8) Makassar'], ['Asia/Jayapura', '(UTC+9) Jayapura'], ['Asia/Singapore', '(UTC+8) Singapura'], ['Asia/Tokyo', '(UTC+9) Tokyo'], ['Asia/Hong_Kong', '(UTC+8) Hong Kong'], ['Australia/Sydney', 'Sydney'], ['Europe/London', 'London'], ['Europe/Berlin', 'Frankfurt'], ['America/New_York', 'New York'], ['America/Chicago', 'Chicago']];
const PREC = [['', 'Bawaan'], ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => [String(n), n === 0 ? '1' : '0.' + '0'.repeat(n - 1) + '1'])];

export function initSettings(ctx) {
  // ctx: { state, save, apply(), panesInfo(), toast, chartType(), setChartType(v) }
  const dlg = $('#chartSettings');
  let sec = 'simbol', before = null, ctBefore = null;

  const cs = () => ({ ...DEFAULT_CS, ...ctx.state.cs });
  const set = (k, v) => { ctx.state.cs = { ...ctx.state.cs, [k]: v }; ctx.apply(); };
  const chk = (k, label, on = cs()[k], hint = '') => `<label class="chk"><input type="checkbox" data-k="${k}" ${on !== false && on ? 'checked' : ''}> ${label}${hint ? ` <small class="note">${hint}</small>` : ''}</label>`;
  const col = (k, v) => `<input type="color" data-c="${k}" value="${v}">`;
  const sel = (k, v, opts) => `<select data-s="${k}">${opts.map(([a, b]) => `<option value="${esc(a)}" ${String(a) === String(v) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  const row = (label, ctl) => `<div class="frow"><span>${label}</span><div class="fctl">${ctl}</div></div>`;
  const hd = t => `<div class="fsec">${t}</div>`;

  function body() {
    const c = cs(), th = THEMES[ctx.state.theme];
    switch (sec) {
      case 'simbol': return hd('CANDLE') +
        row('Corak', sel('_type', ctx.chartType(), [['candles', 'Candle'], ['hollow', 'Candle kosong'], ['heikin', 'Heikin Ashi'], ['bars', 'Bar'], ['line', 'Garis'], ['area', 'Area']])) +
        chk('prevClose', 'Warnai bar berdasarkan penutupan sebelumnya') +
        row(chk('body', 'Badan'), col('upColor', c.upColor) + col('downColor', c.downColor)) +
        row(chk('border', 'Batas-batas'), col('upBorder', c.upBorder) + col('downBorder', c.downBorder)) +
        row(chk('wick', 'Sumbu'), col('upWick', c.upWick) + col('downWick', c.downWick)) +
        hd('MODIFIKASI DATA') + row('Presisi', sel('precision', c.precision, PREC)) + row('Zona waktu', sel('tz', c.tz, TZ));
      case 'status': return hd('INSTRUMEN') +
        row('Judul', sel('legendTitle', c.legendTitle || 'desc', [['desc', 'Deskripsi'], ['symbol', 'Simbol']])) +
        chk('legend', 'Nilai OHLC') + chk('legendChange', 'Nilai perubahan bar', c.legendChange !== false) + chk('legendVolume', 'Volume', !!c.legendVolume) +
        hd('INDIKATOR') + chk('studyTitle', 'Judul', c.studyTitle !== false) + chk('studyInputs', 'Input (parameter)', c.studyInputs !== false) + chk('studyValues', 'Nilai', c.studyValues !== false) + chk('legendBg', 'Latar belakang', !!c.legendBg);
      case 'skala': return hd('LABEL & GARIS HARGA') +
        chk('lastLabel', 'Label harga terakhir', c.lastLabel !== false) + chk('priceLine', 'Garis harga terakhir') + chk('countdown', 'Hitung mundur penutupan bar') +
        chk('prevDayClose', 'Garis penutupan hari sebelumnya', !!c.prevDayClose) + chk('hiLo', 'Label tertinggi & terendah (area terlihat)', !!c.hiLo) +
        hd('SKALA WAKTU') + row('Format waktu', sel('time12', c.time12 ? '1' : '', [['', '24 jam'], ['1', '12 jam (AM/PM)']]));
      case 'canvas': return hd('LATAR CHART') +
        row('Latar', col('bg', c.bg || th.bg)) +
        row(chk('gridV', 'Garis grid vertikal', c.gridV !== false && c.grid !== false), '') + row(chk('gridH', 'Garis grid horizontal', c.gridH !== false && c.grid !== false), col('gridColor', c.gridColor || th.grid)) +
        row('Crosshair', col('crossColor', c.crossColor || th.cross) + sel('crossStyle', c.crossStyle, [['dash', 'Putus-putus'], ['dot', 'Titik-titik'], ['solid', 'Lurus']])) +
        chk('watermark', 'Tanda air (nama simbol)', !!c.watermark) +
        hd('SKALA') + row('Teks', col('scaleText', c.scaleText || th.axisText) + sel('scaleSize', c.scaleSize, [10, 11, 12, 13, 14].map(n => [n, n + 'px']))) +
        hd('MARGIN') + row('Atas (%)', `<input type="number" data-n="marginTop" min="0" max="50" value="${c.marginTop}">`) + row('Bawah (%)', `<input type="number" data-n="marginBottom" min="0" max="50" value="${c.marginBottom}">`);
      case 'trading': return `<p class="note">Fitur trading (order, posisi, eksekusi) belum tersedia — LokiChart saat ini hanya untuk analisa. Gunakan alat <b>Posisi Long/Short</b> di panel Gambar untuk merencanakan entry, target, dan stop.</p>`;
      case 'peringatan': return hd('GARIS PERINGATAN') + row('Warna garis peringatan', col('alertColor', c.alertColor)) + chk('alertsActiveOnly', 'Hanya tampilkan peringatan aktif', !!c.alertsActiveOnly);
      case 'peristiwa': return `<p class="note">Kalender ekonomi, dividen, dan berita belum tersedia karena OANDA/FOREX.com tidak menyediakan data tersebut.</p>`;
    }
    return '';
  }
  function render() {
    dlg.querySelector('.cs-nav').innerHTML = NAV.map(([k, n, ic]) => `<button data-sec="${k}" class="${sec === k ? 'on' : ''}">${icon(ic)}<span>${n}</span></button>`).join('');
    dlg.querySelector('.cs-body').innerHTML = body();
  }
  function open(startSec) {
    before = JSON.parse(JSON.stringify(ctx.state.cs || {})); ctBefore = ctx.chartType();
    if (startSec) sec = startSec;
    render(); dlg.classList.remove('hidden');
  }
  function close(ok) {
    dlg.classList.add('hidden'); $('#csTplMenu')?.remove();
    if (!ok) { ctx.state.cs = before; ctx.setChartType(ctBefore); ctx.apply(); }
    ctx.save();
  }
  dlg.addEventListener('click', e => {
    if (e.target === dlg) return close(false);
    const s = e.target.closest('[data-sec]'); if (s) { sec = s.dataset.sec; return render(); }
    const x = e.target.closest('[data-x]')?.dataset.x;
    if (x === 'ok') close(true);
    if (x === 'cancel') close(false);
    if (x === 'tpl') tplMenu(e.target.closest('[data-x]'));
  });
  dlg.addEventListener('input', onInput); dlg.addEventListener('change', onInput);
  function onInput(e) {
    const el = e.target;
    if (el.dataset.k) set(el.dataset.k, el.checked);
    else if (el.dataset.c) set(el.dataset.c, el.value);
    else if (el.dataset.n) { const v = parseFloat(el.value); if (isFinite(v)) set(el.dataset.n, Math.max(0, Math.min(50, v))); }
    else if (el.dataset.s === '_type') ctx.setChartType(el.value);
    else if (el.dataset.s === 'time12') set('time12', el.value === '1');
    else if (el.dataset.s === 'scaleSize') set('scaleSize', +el.value);
    else if (el.dataset.s) set(el.dataset.s, el.value);
    if (el.dataset.k === 'gridV' || el.dataset.k === 'gridH') set('grid', true);
  }
  function tplMenu(anchor) {
    $('#csTplMenu')?.remove();
    const st = ctx.state; st.csTemplates ||= [];
    const m = document.createElement('div'); m.id = 'csTplMenu'; m.className = 'menu';
    m.innerHTML = `<button class="mi" data-t="save">Simpan sebagai…</button><button class="mi" data-t="default">Terapkan default</button>
      ${st.csTemplates.length ? '<div class="mh">Template tersimpan</div>' : ''}${st.csTemplates.map((t, k) => `<button class="mi" data-t="apply" data-i="${k}">${esc(t.name)}<span class="x" data-del="${k}">✕</span></button>`).join('')}`;
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect(); m.style.left = r.left + 'px'; m.style.top = Math.max(8, r.top - m.offsetHeight - 6) + 'px';
    m.onclick = e => {
      const del = e.target.closest('[data-del]'); if (del) { st.csTemplates.splice(+del.dataset.del, 1); ctx.save(); m.remove(); return; }
      const t = e.target.closest('[data-t]')?.dataset.t; if (!t) return;
      m.remove();
      if (t === 'save') { const n = prompt('Nama template pengaturan:', `Template ${st.csTemplates.length + 1}`); if (n) { st.csTemplates.push({ name: n, cs: JSON.parse(JSON.stringify(st.cs || {})) }); ctx.save(); ctx.toast('Template disimpan'); } }
      if (t === 'default') { st.cs = {}; ctx.apply(); render(); }
      if (t === 'apply') { st.cs = JSON.parse(JSON.stringify(st.csTemplates[+e.target.closest('[data-i]').dataset.i].cs)); ctx.apply(); render(); }
    };
    setTimeout(() => document.addEventListener('pointerdown', function h(ev) { if (!m.contains(ev.target)) { m.remove(); document.removeEventListener('pointerdown', h); } }), 0);
  }
  return { open };
}
