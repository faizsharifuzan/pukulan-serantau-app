import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Printer, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { rm } from './PaymentUI';

const inp = 'px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs w-full';
const btn = 'px-3 py-1.5 rounded-lg text-xs font-semibold';
const monthLabel = (d) => new Date(d + 'T00:00:00').toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' });

export function PayslipView({ slip, clubName, onClose }) {
  const lines = (arr) => (Array.isArray(arr) ? arr : []).filter((x) => Number(x.amount) > 0);
  return (
    <div className="fixed inset-0 z-50 bg-black/80 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto">
        <div className="no-print flex justify-end gap-2 mb-2">
          <button onClick={() => window.print()} className={`${btn} bg-emerald-600 flex items-center gap-1.5`}><Printer className="w-4 h-4" /> Cetak / Simpan PDF</button>
          <button onClick={onClose} className={`${btn} bg-slate-800 flex items-center gap-1.5`}><X className="w-4 h-4" /> Tutup</button>
        </div>
        <div className="print-area bg-white text-black rounded-lg p-6 text-sm">
          <div className="text-center border-b-2 border-black pb-3 mb-4">
            <h1 className="text-lg font-bold uppercase">{clubName || 'Kelab Silat Olahraga Pukulan Serantau'}</h1>
            <p className="text-xs">SLIP GAJI JURULATIH</p>
          </div>
          <table className="w-full text-xs mb-4">
            <tbody>
              <tr><td className="py-0.5 w-32">No. Slip</td><td>: {slip.payslip_no}</td><td className="w-24">Bulan</td><td>: {monthLabel(slip.period)}</td></tr>
              <tr><td className="py-0.5">Nama</td><td>: {slip.coach_name}</td><td>Cawangan</td><td>: {slip.branch_name || '-'}</td></tr>
              <tr><td className="py-0.5">No. IC</td><td>: {slip.coach_ic ? `${slip.coach_ic.slice(0, 6)}-**-****` : '-'}</td><td>Tarikh Keluar</td><td>: {slip.issued_at ? new Date(slip.issued_at).toLocaleDateString('ms-MY') : '-'}</td></tr>
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-bold border-b border-black mb-1">PENDAPATAN</p>
              <div className="flex justify-between py-0.5"><span>Gaji / Honorarium Asas</span><span>{rm(slip.basic_pay)}</span></div>
              {lines(slip.allowances).map((a, i) => <div key={i} className="flex justify-between py-0.5"><span>{a.label}</span><span>{rm(a.amount)}</span></div>)}
              <div className="flex justify-between py-1 mt-1 border-t border-black font-bold"><span>Jumlah Pendapatan</span><span>{rm(slip.total_earnings)}</span></div>
            </div>
            <div>
              <p className="font-bold border-b border-black mb-1">POTONGAN</p>
              {lines(slip.deductions).length === 0 && <p className="py-0.5">-</p>}
              {lines(slip.deductions).map((a, i) => <div key={i} className="flex justify-between py-0.5"><span>{a.label}</span><span>{rm(a.amount)}</span></div>)}
              <div className="flex justify-between py-1 mt-1 border-t border-black font-bold"><span>Jumlah Potongan</span><span>{rm(slip.total_deductions)}</span></div>
            </div>
          </div>
          <div className="mt-4 border-2 border-black p-2 flex justify-between font-bold text-base">
            <span>GAJI BERSIH</span><span>{rm(slip.net_pay)}</span>
          </div>
          {slip.notes && <p className="mt-3 text-xs"><b>Catatan:</b> {slip.notes}</p>}
          <p className="mt-6 text-[10px] text-gray-600 text-center">Slip ini dijana secara komputer dan sah tanpa tandatangan.</p>
        </div>
      </div>
    </div>
  );
}

export function MyPayslips({ clubName }) {
  const [rows, setRows] = useState([]);
  const [view, setView] = useState(null);
  useEffect(() => {
    supabase.from('payslips').select('*').order('period', { ascending: false }).then(({ data }) => setRows(data || []));
  }, []);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
      <h2 className="text-sm font-bold text-amber-400">Slip Gaji Saya</h2>
      {rows.length === 0 && <p className="text-xs text-slate-400">Belum ada slip gaji dikeluarkan.</p>}
      {rows.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-3 rounded-lg text-xs">
          <div>
            <p className="font-bold text-white">{monthLabel(s.period)}</p>
            <p className="text-slate-400">{s.payslip_no} • Bersih {rm(s.net_pay)}</p>
          </div>
          <button onClick={() => setView(s)} className={`${btn} bg-emerald-600`}>Lihat / Cetak</button>
        </div>
      ))}
      {view && <PayslipView slip={view} clubName={clubName} onClose={() => setView(null)} />}
    </div>
  );
}

const blank = () => ({
  id: null, coach_id: '', month: new Date().toISOString().slice(0, 7), basic_pay: '', allowances: [], deductions: [], notes: '', status: 'issued',
});

function LineEditor({ title, rows, onChange }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-bold text-amber-300">{title}</p>
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input className={inp} placeholder="Keterangan (cth: Elaun transport)" value={r.label} onChange={(e) => onChange(rows.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
          <input type="number" min="0" step="0.01" className={`${inp} w-28`} placeholder="RM" value={r.amount} onChange={(e) => onChange(rows.map((x, k) => (k === i ? { ...x, amount: e.target.value } : x)))} />
          <button onClick={() => onChange(rows.filter((_, k) => k !== i))} className="p-1.5 rounded-lg bg-red-950 text-red-300"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
      <button onClick={() => onChange([...rows, { label: '', amount: '' }])} className={`${btn} bg-slate-800 flex items-center gap-1`}><Plus className="w-3.5 h-3.5" />Tambah baris</button>
    </div>
  );
}

export function PayslipAdmin({ me, profiles, branches, clubName }) {
  const coaches = useMemo(() => profiles.filter((p) => p.role === 'coach'), [profiles]);
  const [rows, setRows] = useState([]);
  const [f, setF] = useState(blank());
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => supabase.from('payslips').select('*').order('period', { ascending: false }).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);

  const clean = (arr) => arr.filter((x) => x.label.trim() && Number(x.amount) > 0).map((x) => ({ label: x.label.trim(), amount: Number(Number(x.amount).toFixed(2)) }));
  const preview = useMemo(() => {
    const a = clean(f.allowances).reduce((s, x) => s + x.amount, 0);
    const d = clean(f.deductions).reduce((s, x) => s + x.amount, 0);
    return { earn: Number(f.basic_pay || 0) + a, ded: d, net: Number(f.basic_pay || 0) + a - d };
  }, [f]);

  async function save() {
    const coach = coaches.find((c) => c.id === f.coach_id);
    if (!coach) return alert('Pilih jurulatih.');
    if (!f.month) return alert('Pilih bulan.');
    if (!(Number(f.basic_pay) >= 0) || f.basic_pay === '') return alert('Isi gaji asas.');
    if (preview.net < 0) return alert('Potongan melebihi pendapatan.');
    setBusy(true);
    const payload = {
      coach_id: coach.id, coach_name: coach.full_name.trim(), coach_ic: coach.ic_no || null,
      branch_id: coach.branch_id || null, branch_name: branches.find((b) => b.id === coach.branch_id)?.name || null,
      period: `${f.month}-01`, basic_pay: Number(f.basic_pay), allowances: clean(f.allowances), deductions: clean(f.deductions),
      notes: f.notes.trim() || null, status: f.status, created_by: me,
    };
    const { error } = await supabase.from('payslips').upsert(payload, { onConflict: 'coach_id,period' });
    setBusy(false);
    if (error) return alert('Ralat: ' + error.message);
    setF(blank());
    load();
  }

  const edit = (s) => setF({
    id: s.id, coach_id: s.coach_id || '', month: s.period.slice(0, 7), basic_pay: s.basic_pay,
    allowances: s.allowances || [], deductions: s.deductions || [], notes: s.notes || '', status: s.status,
  });

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-bold text-amber-400">{f.id ? 'Edit Slip Gaji' : 'Buat Slip Gaji Jurulatih'}</h2>
        <div className="grid sm:grid-cols-3 gap-2">
          <select className={inp} value={f.coach_id} onChange={(e) => setF({ ...f, coach_id: e.target.value })} disabled={!!f.id}>
            <option value="">— Pilih jurulatih —</option>
            {coaches.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <input type="month" className={inp} value={f.month} onChange={(e) => setF({ ...f, month: e.target.value })} disabled={!!f.id} />
          <input type="number" min="0" step="0.01" className={inp} placeholder="Gaji / honorarium asas (RM)" value={f.basic_pay} onChange={(e) => setF({ ...f, basic_pay: e.target.value })} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <LineEditor title="Elaun / Bonus" rows={f.allowances} onChange={(allowances) => setF({ ...f, allowances })} />
          <LineEditor title="Potongan" rows={f.deductions} onChange={(deductions) => setF({ ...f, deductions })} />
        </div>
        <textarea rows={2} className={inp} placeholder="Catatan / Remark (pilihan)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-300">Pendapatan {rm(preview.earn)} − Potongan {rm(preview.ded)} = <b className="text-emerald-400">Bersih {rm(preview.net)}</b></p>
          <div className="flex items-center gap-2">
            <select className="px-2 py-1.5 rounded-lg bg-slate-800 text-xs" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="issued">Keluarkan (jurulatih boleh lihat)</option>
              <option value="draft">Draf (admin sahaja)</option>
            </select>
            <button disabled={busy} onClick={save} className={`${btn} bg-emerald-600 disabled:opacity-50`}>{f.id ? 'Simpan' : 'Jana Slip'}</button>
            {f.id && <button onClick={() => setF(blank())} className={`${btn} bg-slate-800`}>Batal</button>}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
        <h2 className="text-sm font-bold text-amber-400">Rekod Slip Gaji ({rows.length})</h2>
        {rows.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-3 rounded-lg text-xs">
            <div>
              <p className="font-bold text-white">{s.coach_name} • {monthLabel(s.period)} {s.status === 'draft' && <span className="text-amber-400">(DRAF)</span>}</p>
              <p className="text-slate-400">{s.payslip_no} • {s.branch_name || '-'} • Bersih {rm(s.net_pay)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setView(s)} className={`${btn} bg-slate-800 text-emerald-300`}>Lihat / Cetak</button>
              <button onClick={() => edit(s)} className={`${btn} bg-slate-800 text-amber-300`}>Edit</button>
              <button onClick={async () => {
                if (!confirm('Padam slip gaji ini?')) return;
                const { error } = await supabase.from('payslips').delete().eq('id', s.id);
                if (error) return alert(error.message);
                load();
              }} className="p-1.5 rounded-lg bg-red-950 text-red-300"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      {view && <PayslipView slip={view} clubName={clubName} onClose={() => setView(null)} />}
    </div>
  );
}
