import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { Field } from './Media';
import { STATUS_LABEL, METHOD_LABEL, rm } from './PaymentUI';

const inp = 'px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs w-full';
const btn = 'px-3 py-1.5 rounded-lg text-xs font-semibold';
const card = 'bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3';
const PAID = ['paid', 'partially_refunded', 'refunded'];
const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];

/** Senarai jenis yuran (kod → label) termasuk yuran khas cawangan. */
function feeCatalog(allFeeTypes, branchFees) {
  const m = {};
  allFeeTypes.forEach((f) => { m[f.code] = f.label; });
  branchFees.forEach((b) => { if (!m[b.fee_code]) m[b.fee_code] = b.label || b.fee_code; });
  return m;
}

export function FinanceExport({ payments, profiles, students, branches, allFeeTypes, branchFees, isAdmin, myBranch, branchName }) {
  const now = new Date();
  const [mode, setMode] = useState('month');
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [year, setYear] = useState(String(now.getFullYear()));
  const [branch, setBranch] = useState(isAdmin ? '' : myBranch || '');
  const [withPending, setWithPending] = useState(false);
  const fees = useMemo(() => feeCatalog(allFeeTypes, branchFees), [allFeeTypes, branchFees]);
  const typeKeys = useMemo(() => [
    ...Object.entries(fees).map(([code, label]) => ({ key: `fee:${code}`, label })),
    { key: 'tournament', label: 'Yuran Kejohanan' },
    { key: 'product', label: 'Merchandise / Pembelian' },
  ], [fees]);
  const [sel, setSel] = useState(() => Object.fromEntries(typeKeys.map((t) => [t.key, true])));
  const isOn = (k) => sel[k] !== false;
  const keyOf = (it) => (it.type === 'fee' || it.type === 'member_fee' ? `fee:${it.fee_code}` : it.type);
  const labelOf = (k) => typeKeys.find((t) => t.key === k)?.label || k;

  const nameOf = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p])), [profiles]);
  const stuOf = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);

  const rows = useMemo(() => {
    const out = [];
    payments.forEach((p) => {
      const okStatus = PAID.includes(p.status) || (withPending && p.status === 'pending_verification');
      if (!okStatus) return;
      if (branch && p.branch_id !== branch) return;
      const d = new Date(p.paid_at || p.created_at);
      const inRange = mode === 'month'
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === month
        : String(d.getFullYear()) === String(year);
      if (!inRange) return;
      const payer = nameOf[p.parent_id];
      (p.items || []).forEach((it, i) => {
        const k = keyOf(it);
        if (!isOn(k)) return;
        const s = stuOf[it.student_id];
        out.push({
          d, p, it, k, payer, s,
          refund: i === 0 ? Number(p.refunded_total || 0) : 0,
        });
      });
    });
    return out.sort((a, b) => a.d - b.d);
  }, [payments, mode, month, year, branch, withPending, sel, nameOf, stuOf]); // eslint-disable-line

  const total = rows.reduce((s, r) => s + Number(r.it.amount || 0), 0);
  const fmtDate = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

  const download = () => {
    if (rows.length === 0) return alert('Tiada data untuk pilihan ini.');
    const head = ['Tarikh', 'No. Rujukan', 'Cawangan', 'Pembayar', 'No. Ahli Pembayar', 'Pesilat', 'ID Pesilat', 'Jenis', 'Butiran', 'Catatan', 'Jumlah (RM)', 'Kaedah', 'Status', 'Refund Resit (RM)'];
    const detail = [head, ...rows.map((r) => [
      fmtDate(r.d), r.p.reference_no, branchName[r.p.branch_id] || '-', r.payer?.full_name || '-', r.payer?.member_no || '',
      r.s?.full_name || r.s?.short_name || '', r.it.student_id || '', labelOf(r.k), r.it.label || '', r.it.remark || '',
      Number(r.it.amount || 0), METHOD_LABEL[r.p.payment_method] || r.p.payment_method, STATUS_LABEL[r.p.status] || r.p.status, r.refund || '',
    ]), [], ['JUMLAH', '', '', '', '', '', '', '', '', '', total]];

    const byType = {};
    rows.forEach((r) => { const t = (byType[r.k] ||= { n: 0, amt: 0 }); t.n += 1; t.amt += Number(r.it.amount || 0); });
    const sumType = [['Jenis', 'Bilangan', 'Jumlah (RM)'], ...Object.entries(byType).map(([k, v]) => [labelOf(k), v.n, v.amt]), [], ['JUMLAH', rows.length, total]];

    const usedKeys = Object.keys(byType);
    const mHead = ['Bulan', ...usedKeys.map(labelOf), 'Jumlah (RM)'];
    const monthRows = (mode === 'year' ? MONTHS.map((m, i) => ({ m, i })) : [{ m: month, i: null }]).map(({ m, i }) => {
      const part = rows.filter((r) => (i === null ? true : r.d.getMonth() === i));
      const cells = usedKeys.map((k) => part.filter((r) => r.k === k).reduce((s, r) => s + Number(r.it.amount || 0), 0));
      return [m, ...cells, cells.reduce((a, b) => a + b, 0)];
    });
    const sumMonth = [mHead, ...monthRows, ['JUMLAH', ...usedKeys.map((_, ci) => monthRows.reduce((s, r) => s + r[ci + 1], 0)), total]];

    const wb = XLSX.utils.book_new();
    const add = (name, aoa, widths) => {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = widths.map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, name);
    };
    add('Butiran', detail, [11, 18, 22, 22, 13, 24, 12, 22, 36, 28, 12, 14, 18, 14]);
    add('Ringkasan Jenis', sumType, [28, 10, 14]);
    add('Ringkasan Bulanan', sumMonth, [12, ...usedKeys.map(() => 20), 14]);
    const tag = mode === 'month' ? month : year;
    const bn = branch ? (branchName[branch] || 'cawangan').split(',')[0].replace(/[^\w]+/g, '_') : 'semua';
    XLSX.writeFile(wb, `Bayaran_${tag}_${bn}.xlsx`);
  };

  return (
    <div className={card}>
      <h2 className="text-sm font-bold text-amber-400">Eksport Data Bayaran (Excel)</h2>
      <p className="text-[11px] text-slate-400">Hanya Master Admin dan Admin Cawangan boleh melihat dan mengeksport data ini.</p>
      <div className="grid sm:grid-cols-3 gap-2">
        <Field label="Tempoh" hint="Eksport ikut bulan atau setahun penuh">
          <select className={inp} value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="month">Bulanan</option><option value="year">Tahunan</option>
          </select>
        </Field>
        <Field label={mode === 'month' ? 'Pilih bulan' : 'Pilih tahun'} hint="Ikut tarikh bayaran disahkan">
          {mode === 'month'
            ? <input type="month" className={inp} value={month} onChange={(e) => setMonth(e.target.value)} />
            : <input type="number" min="2020" max="2100" className={inp} value={year} onChange={(e) => setYear(e.target.value)} />}
        </Field>
        <Field label="Cawangan" hint={isAdmin ? 'Pilih satu cawangan atau semua' : 'Cawangan anda sahaja'}>
          {isAdmin
            ? <select className={inp} value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Semua Cawangan</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            : <div className={`${inp} text-slate-400`}>{branchName[myBranch] || '-'}</div>}
        </Field>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-slate-300 mb-1">Jenis yang hendak dikeluarkan</p>
        <div className="flex flex-wrap gap-2">
          {typeKeys.map((t) => (
            <label key={t.key} className={`${btn} cursor-pointer flex items-center gap-1.5 ${isOn(t.key) ? 'bg-emerald-900/60 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>
              <input type="checkbox" checked={isOn(t.key)} onChange={(e) => setSel({ ...sel, [t.key]: e.target.checked })} />{t.label}
            </label>
          ))}
        </div>
        <div className="flex gap-2 mt-1.5">
          <button className={`${btn} bg-slate-800`} onClick={() => setSel(Object.fromEntries(typeKeys.map((t) => [t.key, true])))}>Pilih semua</button>
          <button className={`${btn} bg-slate-800`} onClick={() => setSel(Object.fromEntries(typeKeys.map((t) => [t.key, false])))}>Kosongkan</button>
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={withPending} onChange={(e) => setWithPending(e.target.checked)} />
        Sertakan bayaran yang masih menunggu pengesahan (lalai: hanya yang telah disahkan)
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={download} className={`${btn} bg-emerald-600`}>Muat turun Excel</button>
        <p className="text-xs text-slate-300">{rows.length} item • Jumlah <b className="text-emerald-400">{rm(total)}</b></p>
      </div>
    </div>
  );
}

export function FeeExemptions({ students, profiles, branches, allFeeTypes, branchFees, branchName, run }) {
  const [q, setQ] = useState('');
  const [bf, setBf] = useState('');
  const [onlyEx, setOnlyEx] = useState(false);
  const [kind, setKind] = useState('students');
  const fees = useMemo(() => feeCatalog(allFeeTypes, branchFees), [allFeeTypes, branchFees]);
  const codesFor = (s) => {
    const c = allFeeTypes.map((f) => f.code);
    branchFees.filter((b) => b.branch_id === s.branch_id && !c.includes(b.fee_code)).forEach((b) => c.push(b.fee_code));
    return c;
  };
  const memberNo = (s) => profiles.find((p) => p.id === s.student_user_id)?.member_no || profiles.find((p) => p.id === s.parent_id)?.member_no || '';
  const isCoach = kind === 'coaches';
  const source = isCoach ? profiles.filter((p) => p.role === 'coach').map((p) => ({ ...p, short_name: p.full_name })) : students;
  const list = source.filter((s) => {
    const t = q.trim().toLowerCase();
    return (!bf || s.branch_id === bf) && (!onlyEx || s.fee_exempt || s.fee_only)
      && (!t || `${s.id} ${s.full_name} ${s.short_name} ${isCoach ? s.member_no || '' : memberNo(s)}`.toLowerCase().includes(t));
  }).slice(0, 60);
  const save = (s, patch) => run(() => supabase.from(isCoach ? 'profiles' : 'students').update(patch).eq('id', s.id));
  return (
    <div className={card}>
      <h2 className="text-sm font-bold text-amber-400">Pengecualian Yuran</h2>
      <p className="text-[11px] text-slate-400">Pesilat yang dikecualikan atau dihadkan jenis yuran masih ada ID ahli dan masih boleh membeli merchandise dan menyertai kejohanan seperti biasa.</p>
      <div className="flex gap-2">
        {[['students', 'Pesilat'], ['coaches', 'Jurulatih']].map(([k, l]) => (
          <button key={k} onClick={() => setKind(k)} className={`${btn} ${kind === k ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>{l}</button>
        ))}
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <input className={inp} placeholder="Cari nama / ID / No. Ahli / No. Ahli" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={inp} value={bf} onChange={(e) => setBf(e.target.value)}>
          <option value="">Semua Cawangan</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={onlyEx} onChange={(e) => setOnlyEx(e.target.checked)} />Tunjuk yang dikecualikan sahaja</label>
      </div>
      <div className="space-y-2">
        {list.length === 0 && <p className="text-xs text-slate-400">Tiada pesilat.</p>}
        {list.map((s) => {
          const codes = codesFor(s);
          if (!codes.length) return null;
          const active = s.fee_only || codes;
          return (
            <div key={s.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-xs">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold text-white">{s.full_name || s.short_name} <span className="font-normal text-slate-500">• {isCoach ? 'Jurulatih' : s.id} • {branchName[s.branch_id] || '-'}{(isCoach ? s.member_no : memberNo(s)) ? ` • ${isCoach ? s.member_no : memberNo(s)}` : ''}</span></p>
                <label className="flex items-center gap-1.5 text-amber-300">
                  <input type="checkbox" checked={!!s.fee_exempt} onChange={(e) => save(s, { fee_exempt: e.target.checked })} />Dikecualikan semua yuran
                </label>
              </div>
              {!s.fee_exempt && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400">Perlu bayar:</span>
                  {codes.map((c) => (
                    <label key={c} className={`${btn} cursor-pointer flex items-center gap-1 ${active.includes(c) ? 'bg-emerald-900/60 text-emerald-200' : 'bg-slate-800 text-slate-500'}`}>
                      <input type="checkbox" checked={active.includes(c)} onChange={(e) => {
                        const next = e.target.checked ? [...new Set([...active, c])] : active.filter((x) => x !== c);
                        save(s, { fee_only: next.length === codes.length ? null : next });
                      }} />{fees[c] || c}
                    </label>
                  ))}
                  {s.fee_only && <button className={`${btn} bg-slate-800`} onClick={() => save(s, { fee_only: null })}>Semua yuran</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
