// Paper trading saat Replay: Beli/Jual dengan uang virtual, SL/TP, P/L, riwayat & statistik.
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = d => `<svg class="i" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const uid = () => Math.random().toString(36).slice(2, 10);
const money = v => (v >= 0 ? '+' : '') + v.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = v => v.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function initPaper(ctx) {
  // ctx: { chart(), cfg(), state, save, toast, openForm(title, fields, onSave, extra), fmt(v) }
  let acc = null; // { start, balance, positions, history, symbol, tf, startedAt }
  const panel = $('#paperPanel');

  function ensure() {
    const c = ctx.chart(), cfg = ctx.cfg();
    if (!acc || acc.symbol !== cfg.symbol || acc.tf !== cfg.tf) {
      const start = ctx.state.paperStart || 10000;
      acc = { start, balance: start, positions: [], history: [], symbol: cfg.symbol, tf: cfg.tf, startedAt: c.candles.at(-1)?.t };
    }
    return acc;
  }
  const price = () => ctx.chart().candles.at(-1)?.c;
  const pnl = (p, px) => (px - p.entry) * p.dir * p.units;
  const openPnl = () => acc ? acc.positions.reduce((a, p) => a + pnl(p, price()), 0) : 0;
  const quote = () => { const s = ctx.cfg().symbol; return /^[A-Z]{6}$/.test(s) && !s.startsWith('X') ? s.slice(3) : 'USD'; };

  function sync() {
    const c = ctx.chart();
    c.paper = acc ? { positions: acc.positions.map(p => ({ ...p, pnl: pnl(p, price()) })), marks: acc.history.flatMap(h => [{ t: h.t0, p: h.entry, dir: h.dir, kind: 'in' }, { t: h.t1, p: h.exit, dir: h.dir, kind: 'out', win: h.pnl >= 0 }]).concat(acc.positions.map(p => ({ t: p.t, p: p.entry, dir: p.dir, kind: 'in' }))) } : null;
    c.invalidate();
    if (!panel.classList.contains('hidden')) render();
    ctx.onChange?.();
  }

  function order(dir) {
    ensure();
    const px = price(); if (px == null) return;
    const last = ctx.state.paperUnits || 1;
    ctx.openForm(`${dir > 0 ? 'Beli' : 'Jual'} ${ctx.cfg().symbol} @ ${ctx.fmt(px)}`, [
      { key: 'units', label: 'Jumlah (unit)', type: 'number', value: last, min: 0.0001, max: 1e9, step: 'any' },
      { key: 'sl', label: `Stop loss (harga, opsional) — ${dir > 0 ? 'di bawah' : 'di atas'} ${ctx.fmt(px)}`, type: 'text', value: '' },
      { key: 'tp', label: `Take profit (harga, opsional) — ${dir > 0 ? 'di atas' : 'di bawah'} ${ctx.fmt(px)}`, type: 'text', value: '' },
    ], v => {
      const pf = x => { const t = String(x ?? '').trim(); if (!t) return null; const n = parseFloat(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t); return isFinite(n) && n > 0 ? n : null; };
      const sl = pf(v.sl), tp = pf(v.tp);
      if (sl != null && (dir > 0 ? sl >= px : sl <= px)) { ctx.toast('Stop loss harus ' + (dir > 0 ? 'di bawah' : 'di atas') + ' harga masuk'); return false; }
      if (tp != null && (dir > 0 ? tp <= px : tp >= px)) { ctx.toast('Take profit harus ' + (dir > 0 ? 'di atas' : 'di bawah') + ' harga masuk'); return false; }
      ctx.state.paperUnits = v.units; ctx.save();
      acc.positions.push({ id: uid(), dir, units: v.units, entry: px, t: ctx.chart().candles.at(-1).t, sl, tp });
      ctx.toast(`${dir > 0 ? 'Beli' : 'Jual'} ${v.units} unit @ ${ctx.fmt(px)}`);
      sync();
    });
  }

  function close(p, px, reason, t) {
    const r = pnl(p, px);
    acc.balance += r;
    acc.positions = acc.positions.filter(x => x !== p);
    acc.history.unshift({ ...p, exit: px, pnl: r, reason, t0: p.t, t1: t ?? ctx.chart().candles.at(-1).t });
  }

  // dipanggil setiap bar replay bertambah: cek SL/TP memakai high/low bar
  function onBar() {
    if (!acc || !acc.positions.length) return sync();
    const bar = ctx.chart().candles.at(-1); if (!bar) return;
    for (const p of [...acc.positions]) {
      if (bar.t <= p.t) continue;
      const hitSL = p.sl != null && (p.dir > 0 ? bar.l <= p.sl : bar.h >= p.sl);
      const hitTP = p.tp != null && (p.dir > 0 ? bar.h >= p.tp : bar.l <= p.tp);
      if (hitSL) { close(p, p.sl, 'SL', bar.t); ctx.toast(`Stop loss tersentuh: ${money(pnl(p, p.sl))} ${quote()}`); } // SL diutamakan bila keduanya tersentuh di bar yang sama
      else if (hitTP) { close(p, p.tp, 'TP', bar.t); ctx.toast(`Take profit tercapai: ${money(pnl(p, p.tp))} ${quote()}`); }
    }
    sync();
  }

  function stats() {
    const h = acc?.history || [], wins = h.filter(x => x.pnl > 0), losses = h.filter(x => x.pnl <= 0);
    const gp = wins.reduce((a, x) => a + x.pnl, 0), gl = -losses.reduce((a, x) => a + x.pnl, 0);
    return { n: h.length, winrate: h.length ? (wins.length / h.length) * 100 : 0, net: gp - gl, pf: gl ? gp / gl : gp ? Infinity : 0, best: h.length ? Math.max(...h.map(x => x.pnl)) : 0, worst: h.length ? Math.min(...h.map(x => x.pnl)) : 0 };
  }

  function summaryChip() {
    if (!acc) return '';
    const eq = acc.balance + openPnl(), op = openPnl();
    return `<button class="pill paper-chip" data-p="panel">Ekuitas ${num(eq)}${acc.positions.length ? ` · <b class="${op >= 0 ? 'up' : 'down'}">${money(op)}</b>` : ''}</button>`;
  }

  function render() {
    ensure();
    const s = stats(), op = openPnl(), q = quote(), px = price();
    const log = JSON.parse(localStorage.getItem('ac:paperlog') || '[]');
    $('#paperBody').innerHTML = `
      <div class="pp-grid">
        <div><small>Saldo awal</small><b>${num(acc.start)}</b></div><div><small>Saldo</small><b>${num(acc.balance)}</b></div>
        <div><small>P/L terbuka</small><b class="${op >= 0 ? 'up' : 'down'}">${money(op)}</b></div><div><small>Ekuitas</small><b>${num(acc.balance + op)}</b></div>
      </div>
      <p class="note">Mata uang hasil: ${q}. Harga sekarang ${px != null ? ctx.fmt(px) : '—'}.</p>
      <div class="pp-btns"><button class="pp-sell" data-p="sell">Jual</button><button class="pp-buy" data-p="buy">Beli</button></div>
      <h4>Posisi terbuka (${acc.positions.length})</h4>
      ${acc.positions.map(p => `<div class="tree-row"><span class="nm"><b class="${p.dir > 0 ? 'up' : 'down'}">${p.dir > 0 ? 'Long' : 'Short'} ${p.units}</b> @ ${ctx.fmt(p.entry)}
        <small>SL ${p.sl != null ? ctx.fmt(p.sl) : '—'} · TP ${p.tp != null ? ctx.fmt(p.tp) : '—'} · <span class="${pnl(p, px) >= 0 ? 'up' : 'down'}">${money(pnl(p, px))}</span></small></span>
        <button class="pill" data-close="${p.id}">Tutup</button></div>`).join('') || '<p class="note">Tidak ada posisi terbuka.</p>'}
      ${acc.positions.length > 1 ? '<button class="ghost" data-p="closeall">Tutup semua</button>' : ''}
      <h4>Statistik sesi</h4>
      <div class="pp-grid">
        <div><small>Trade</small><b>${s.n}</b></div><div><small>Winrate</small><b>${s.winrate.toFixed(0)}%</b></div>
        <div><small>P/L bersih</small><b class="${s.net >= 0 ? 'up' : 'down'}">${money(s.net)}</b></div><div><small>Profit factor</small><b>${s.pf === Infinity ? '∞' : s.pf.toFixed(2)}</b></div>
        <div><small>Terbaik</small><b class="${s.best >= 0 ? 'up' : 'down'}">${money(s.best)}</b></div><div><small>Terburuk</small><b class="${s.worst >= 0 ? 'up' : 'down'}">${money(s.worst)}</b></div>
      </div>
      <h4>Riwayat</h4>
      ${acc.history.map(h => `<div class="tree-row"><span class="nm">${h.dir > 0 ? 'Long' : 'Short'} ${h.units} · ${ctx.fmt(h.entry)} → ${ctx.fmt(h.exit)} <small>${h.reason} · <span class="${h.pnl >= 0 ? 'up' : 'down'}">${money(h.pnl)}</span></small></span></div>`).join('') || '<p class="note">Belum ada trade.</p>'}
      <div class="pp-btns"><button class="ghost" data-p="reset">Reset akun</button><button class="ghost" data-p="start">Saldo awal…</button></div>
      ${log.length ? `<h4>Sesi sebelumnya</h4>${log.slice(0, 20).map(l => `<div class="tree-row"><span class="nm">${esc(l.symbol)} ${esc(l.tf)} · ${l.trades} trade · winrate ${l.winrate.toFixed(0)}% <small>${new Date(l.at).toLocaleString('id-ID')} · <span class="${l.net >= 0 ? 'up' : 'down'}">${money(l.net)}</span></small></span></div>`).join('')}` : ''}`;
  }

  panel.addEventListener('click', e => {
    const cl = e.target.closest('[data-close]');
    if (cl) { const p = acc.positions.find(x => x.id === cl.dataset.close); if (p) { close(p, price(), 'Manual'); ctx.toast(`Posisi ditutup: ${money(acc.history[0].pnl)}`); } return sync(); }
    const a = e.target.closest('[data-p]')?.dataset.p;
    if (a === 'buy') order(1);
    if (a === 'sell') order(-1);
    if (a === 'closeall') { for (const p of [...acc.positions]) close(p, price(), 'Manual'); sync(); }
    if (a === 'reset' && confirm('Reset akun paper trading sesi ini?')) { acc = null; ensure(); sync(); }
    if (a === 'start') ctx.openForm('Saldo awal paper trading', [{ key: 'v', label: 'Saldo awal', type: 'number', value: ctx.state.paperStart || 10000, min: 1, max: 1e12 }], v => { ctx.state.paperStart = v.v; ctx.save(); if (acc && !acc.history.length && !acc.positions.length) { acc.start = acc.balance = v.v; } sync(); });
  });

  // akhir sesi replay: tutup posisi pada harga terakhir, simpan ringkasan
  function endSession() {
    if (!acc) return;
    for (const p of [...acc.positions]) close(p, price(), 'Akhir replay');
    const s = stats();
    if (s.n) {
      const log = JSON.parse(localStorage.getItem('ac:paperlog') || '[]');
      log.unshift({ at: Date.now(), symbol: acc.symbol, tf: acc.tf, trades: s.n, winrate: s.winrate, net: s.net });
      localStorage.setItem('ac:paperlog', JSON.stringify(log.slice(0, 100)));
      ctx.toast(`Sesi replay selesai: ${s.n} trade · winrate ${s.winrate.toFixed(0)}% · P/L ${money(s.net)}`, 6000);
    }
    acc = null; ctx.chart().paper = null; ctx.chart().invalidate();
    panel.classList.add('hidden');
  }

  return { order, onBar, summaryChip, open: () => { ensure(); render(); panel.classList.remove('hidden'); }, endSession, active: () => !!acc };
}
