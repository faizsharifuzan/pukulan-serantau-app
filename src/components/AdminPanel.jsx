import React, { useMemo, useState } from 'react';
import { Trash2, Plus, Upload, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const inp = 'px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs w-full';
const btn = 'px-3 py-1.5 rounded-lg text-xs font-semibold';
const card = 'bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3';

const STATUS_STYLE = {
  paid: 'bg-emerald-900 text-emerald-300',
  pending: 'bg-amber-900 text-amber-300',
  pending_verification: 'bg-sky-900 text-sky-300',
  failed: 'bg-red-900 text-red-300',
  cancelled: 'bg-slate-800 text-slate-400',
};
export const STATUS_LABEL = {
  paid: 'Berjaya',
  pending: 'Menunggu Bayaran',
  pending_verification: 'Menunggu Pengesahan',
  failed: 'Gagal',
  cancelled: 'Dibatalkan',
};
export const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${STATUS_STYLE[status] || 'bg-slate-800 text-slate-300'}`}>
    {STATUS_LABEL[status] || status}
  </span>
);

function useRun(reload) {
  const [busy, setBusy] = useState(false);
  return {
    busy,
    run: async (fn, okMsg) => {
      setBusy(true);
      try {
        const { error } = await fn();
        if (error) { alert('Ralat: ' + error.message); return false; }
        if (okMsg) alert(okMsg);
        await reload();
        return true;
      } finally { setBusy(false); }
    },
  };
}

/* ---------------- USERS ---------------- */
function UserRow({ u, me, branches, branchName, run }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(u);
  const isMe = u.id === me;
  const save = async () => {
    const ic = (f.ic_no || '').replace(/\D/g, '');
    if (ic && ic.length !== 12) return alert('No. IC mesti 12 digit.');
    const ph = (f.phone || '').replace(/\D/g, '').replace(/^60/, '').replace(/^0/, '');
    if (ph && (ph.length < 8 || ph.length > 11)) return alert('No. telefon tidak sah.');
    const ok = await run(() => supabase.from('profiles').update({
      full_name: (f.full_name || '').trim().toUpperCase(),
      ic_no: ic, phone: ph ? `+60${ph}` : '', branch_id: f.branch_id || null,
    }).eq('id', u.id));
    if (ok) setEdit(false);
  };
  const setRole = (role) => run(() => supabase.from('profiles').update({ role }).eq('id', u.id));
  const setActive = (v) => run(() => supabase.from('profiles').update({ is_active: v }).eq('id', u.id));
  const del = () => {
    if (!confirm(`Padam akaun ${u.full_name} secara kekal? Tindakan ini tidak boleh dipulihkan.`)) return;
    run(() => supabase.rpc('admin_delete_user', { p_user: u.id }));
  };
  return (
    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold text-white">
            {u.full_name} {isMe && <span className="text-amber-400">(Anda)</span>}
            {u.is_active === false && <span className="ml-2 text-red-400">NYAHAKTIF</span>}
          </p>
          <p className="text-[11px] text-slate-400">{u.phone || '-'} • IC: {u.ic_no || '-'} • {branchName[u.branch_id] || 'Tiada Cawangan'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {u.requested_role === 'coach' && u.role !== 'coach' && (
            <button onClick={() => setRole('coach')} className={`${btn} bg-amber-500 text-slate-950`}>Lulus Jurulatih</button>
          )}
          <select
            className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-300 disabled:opacity-50"
            value={u.role} disabled={isMe} onChange={(e) => setRole(e.target.value)}
          >
            <option value="parent">Ibu Bapa</option>
            <option value="student">Pesilat</option>
            <option value="coach">Jurulatih</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={() => setEdit(!edit)} className={`${btn} bg-slate-800 text-amber-300`}>{edit ? 'Tutup' : 'Edit'}</button>
          {!isMe && (
            <>
              <button onClick={() => setActive(u.is_active === false)} className={`${btn} bg-slate-800 text-slate-200`}>
                {u.is_active === false ? 'Aktifkan' : 'Nyahaktif'}
              </button>
              {u.role !== 'admin' && (
                <button onClick={del} className="p-1.5 rounded-lg bg-red-950 text-red-300 hover:bg-red-900" title="Padam"><Trash2 className="w-4 h-4" /></button>
              )}
            </>
          )}
        </div>
      </div>
      {edit && (
        <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800">
          <input className={`${inp} uppercase`} placeholder="Nama" value={f.full_name || ''} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          <input className={inp} placeholder="No. IC (12 digit)" maxLength={12} value={f.ic_no || ''} onChange={(e) => setF({ ...f, ic_no: e.target.value.replace(/\D/g, '') })} />
          <input className={inp} placeholder="No. Tel (+60...)" value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <select className={inp} value={f.branch_id || ''} onChange={(e) => setF({ ...f, branch_id: e.target.value })}>
            <option value="">Tiada Cawangan</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button onClick={save} className={`${btn} bg-emerald-600 sm:col-span-2`}>Simpan Pengguna</button>
        </div>
      )}
    </div>
  );
}

function UsersSection({ profiles, me, branches, branchName, run }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return profiles.filter((p) => !s || `${p.full_name} ${p.ic_no} ${p.phone}`.toLowerCase().includes(s));
  }, [profiles, q]);
  const pendingCoach = profiles.filter((p) => p.requested_role === 'coach' && p.role !== 'coach');
  return (
    <div className={card}>
      <h2 className="text-sm font-bold text-amber-400">Pengguna & Peranan ({profiles.length})</h2>
      {pendingCoach.length > 0 && (
        <p className="text-[11px] bg-amber-500/10 border border-amber-500/40 text-amber-300 rounded-lg p-2">
          {pendingCoach.length} permohonan jurulatih menunggu kelulusan.
        </p>
      )}
      <input className={inp} placeholder="Cari nama / IC / telefon" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="space-y-2">
        {list.map((u) => <UserRow key={u.id} u={u} me={me} branches={branches} branchName={branchName} run={run} />)}
      </div>
    </div>
  );
}

/* ---------------- STUDENT <-> ACCOUNT LINKS ---------------- */
function LinksSection({ students, profiles, run }) {
  const [q, setQ] = useState('');
  const nameOf = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p.full_name])), [profiles]);
  const parents = profiles.filter((p) => p.role !== 'student');
  const studentAccts = profiles.filter((p) => p.role === 'student');
  const list = students.filter((s) => {
    const t = q.trim().toLowerCase();
    return !t || `${s.id} ${s.full_name} ${s.short_name}`.toLowerCase().includes(t);
  });
  const pending = students.filter((s) => s.pending_claimant);
  const assign = (id, kind, user) => run(() => supabase.rpc('assign_student_account', { p_student: id, p_kind: kind, p_user: user || null }));
  const review = (id, approve) => run(() => supabase.rpc('review_claim', { p_id: id, p_approve: approve }));
  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <div className={`${card} border-amber-500/40`}>
          <h2 className="text-sm font-bold text-amber-400">Tuntutan Menunggu Kelulusan ({pending.length})</h2>
          {pending.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-3 rounded-lg text-xs">
              <p>
                <b>{nameOf[s.pending_claimant] || 'Pengguna'}</b> mahu tuntut <b>{s.full_name || s.short_name}</b>{' '}
                <span className="text-slate-400">({s.pending_claim_role === 'student' ? 'sebagai pesilat' : 'sebagai ibu bapa'})</span>
              </p>
              <div className="flex gap-2">
                <button onClick={() => review(s.id, true)} className={`${btn} bg-emerald-600 flex items-center gap-1`}><Check className="w-3.5 h-3.5" />Lulus</button>
                <button onClick={() => review(s.id, false)} className={`${btn} bg-red-900 text-red-200 flex items-center gap-1`}><X className="w-3.5 h-3.5" />Tolak</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className={card}>
        <h2 className="text-sm font-bold text-amber-400">Pautkan Pesilat ke Akaun Ibu Bapa / Pesilat</h2>
        <input className={inp} placeholder="Cari pesilat (ID / nama)" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {list.map((s) => (
            <div key={s.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 grid sm:grid-cols-3 gap-2 items-center text-xs">
              <div>
                <p className="font-bold text-white">{s.full_name || s.short_name}</p>
                <p className="text-[10px] font-mono text-emerald-400">{s.id}</p>
              </div>
              <select className={inp} value={s.parent_id || ''} onChange={(e) => assign(s.id, 'parent', e.target.value)}>
                <option value="">— Tiada ibu bapa —</option>
                {parents.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
              </select>
              <select className={inp} value={s.student_user_id || ''} onChange={(e) => assign(s.id, 'student', e.target.value)}>
                <option value="">— Tiada akaun pesilat —</option>
                {studentAccts.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- TOURNAMENTS ---------------- */
const EVENT_TYPES = ['Open Tournament', 'State/National Selection', 'Open Friendly Sparring', 'Internal Friendly'];
function TournamentForm({ init, onSave, onCancel, upload, label }) {
  const [t, setT] = useState(init);
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <input className={inp} placeholder="Nama Kejohanan" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} />
      <select className={inp} value={t.event_type} onChange={(e) => setT({ ...t, event_type: e.target.value })}>
        {EVENT_TYPES.map((x) => <option key={x}>{x}</option>)}
      </select>
      <input type="date" className={inp} value={t.event_date || ''} onChange={(e) => setT({ ...t, event_date: e.target.value })} />
      <input type="number" min="0" step="0.01" className={inp} placeholder="Yuran (RM)" value={t.entry_fee} onChange={(e) => setT({ ...t, entry_fee: e.target.value })} />
      <input className={inp} placeholder="Lokasi" value={t.location || ''} onChange={(e) => setT({ ...t, location: e.target.value })} />
      <label className={`${inp} cursor-pointer flex items-center gap-2`}>
        <Upload className="w-4 h-4 text-amber-400" /> {t.poster_url ? 'Poster ✓ (tukar)' : 'Muat Naik Poster'}
        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) { const url = await upload(f, 'posters'); if (url) setT({ ...t, poster_url: url }); }
        }} />
      </label>
      <textarea rows={2} className={`${inp} sm:col-span-2`} placeholder="Keterangan" value={t.description || ''} onChange={(e) => setT({ ...t, description: e.target.value })} />
      <div className="sm:col-span-2 flex gap-2">
        <button onClick={() => {
          if (!t.title?.trim() || !t.event_date) return alert('Isi nama & tarikh.');
          if (Number(t.entry_fee) < 0 || Number.isNaN(Number(t.entry_fee))) return alert('Yuran tidak sah.');
          onSave({ ...t, title: t.title.trim(), entry_fee: Number(t.entry_fee) || 0 });
        }} className={`${btn} bg-emerald-600`}>{label}</button>
        {onCancel && <button onClick={onCancel} className={`${btn} bg-slate-800`}>Batal</button>}
      </div>
    </div>
  );
}
function TournamentsSection({ tournaments, run, me, upload }) {
  const [editId, setEditId] = useState(null);
  const blank = { title: '', event_type: 'Open Friendly Sparring', event_date: '', location: '', entry_fee: 30, poster_url: '', description: '' };
  return (
    <div className="space-y-4">
      <div className={card}>
        <h2 className="text-sm font-bold text-amber-400">Terbitkan Kejohanan Baharu</h2>
        <TournamentForm key={tournaments.length} init={blank} upload={upload} label="Terbitkan"
          onSave={(t) => run(() => supabase.from('tournaments').insert({ ...t, created_by: me }))} />
      </div>
      <div className={card}>
        <h2 className="text-sm font-bold text-amber-400">Senarai Kejohanan ({tournaments.length})</h2>
        {tournaments.map((t) => (
          <div key={t.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-2">
            {editId === t.id ? (
              <TournamentForm init={t} upload={upload} label="Simpan" onCancel={() => setEditId(null)}
                onSave={async (v) => {
                  const { id, created_at, created_by, ...rest } = v;
                  if (await run(() => supabase.from('tournaments').update(rest).eq('id', t.id))) setEditId(null);
                }} />
            ) : (
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <p className="font-bold text-white">{t.title} <span className="text-amber-300 font-normal">• {t.event_type}</span></p>
                  <p className="text-slate-400">{t.event_date} • {t.location || '-'} • RM{Number(t.entry_fee).toFixed(2)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditId(t.id)} className={`${btn} bg-slate-800 text-amber-300`}>Edit</button>
                  <button onClick={() => confirm(`Padam kejohanan "${t.title}"?`) && run(() => supabase.from('tournaments').delete().eq('id', t.id))}
                    className="p-1.5 rounded-lg bg-red-950 text-red-300"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- PRODUCTS & FEES ---------------- */
function ProductRow({ p, run, upload }) {
  const [f, setF] = useState(p);
  const dirty = JSON.stringify(f) !== JSON.stringify(p);
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 grid sm:grid-cols-6 gap-2 items-center text-xs">
      <input className={`${inp} sm:col-span-2`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input type="number" min="0" step="0.01" className={inp} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
      <label className="flex items-center gap-1.5 cursor-pointer">
        <input type="checkbox" checked={!!f.in_stock} onChange={(e) => setF({ ...f, in_stock: e.target.checked })} /> Ada Stok
      </label>
      <label className={`${btn} bg-slate-800 cursor-pointer text-center`}>
        {f.image_url ? 'Gambar ✓' : 'Gambar'}
        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) { const url = await upload(file, 'products'); if (url) setF({ ...f, image_url: url }); }
        }} />
      </label>
      <div className="flex gap-2 justify-end">
        <button disabled={!dirty} onClick={() => run(() => supabase.from('products').update({
          name: f.name.trim(), price: Number(f.price), in_stock: f.in_stock, image_url: f.image_url,
        }).eq('id', p.id))} className={`${btn} bg-emerald-600 disabled:opacity-40`}>Simpan</button>
        <button onClick={() => confirm(`Padam produk "${p.name}"?`) && run(() => supabase.from('products').delete().eq('id', p.id))}
          className="p-1.5 rounded-lg bg-red-950 text-red-300"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
function FeeRow({ fee, run }) {
  const [f, setF] = useState(fee);
  const dirty = JSON.stringify(f) !== JSON.stringify(fee);
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 grid sm:grid-cols-5 gap-2 items-center text-xs">
      <span className="font-mono text-emerald-400">{fee.code}</span>
      <input className={`${inp} sm:col-span-2`} value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
      <input type="number" min="0" step="0.01" className={inp} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
      <div className="flex items-center gap-2 justify-end">
        <label className="flex items-center gap-1"><input type="checkbox" checked={!!f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} />Aktif</label>
        <button disabled={!dirty} onClick={() => run(() => supabase.from('fee_types').update({ label: f.label.trim(), amount: Number(f.amount), active: f.active }).eq('code', fee.code))}
          className={`${btn} bg-emerald-600 disabled:opacity-40`}>Simpan</button>
      </div>
    </div>
  );
}
function CatalogSection({ products, feeTypes, run, upload }) {
  const [np, setNp] = useState({ name: '', price: 45, category: 'Merchandise', image_url: '' });
  const [nf, setNf] = useState({ code: '', label: '', amount: 20 });
  return (
    <div className="space-y-4">
      <div className={card}>
        <h2 className="text-sm font-bold text-amber-400">Jenis Yuran</h2>
        {feeTypes.map((f) => <FeeRow key={f.code} fee={f} run={run} />)}
        <div className="grid sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs">
          <input className={inp} placeholder="Kod (cth: tournament_prep)" value={nf.code} onChange={(e) => setNf({ ...nf, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
          <input className={inp} placeholder="Nama yuran" value={nf.label} onChange={(e) => setNf({ ...nf, label: e.target.value })} />
          <input type="number" min="0" step="0.01" className={inp} value={nf.amount} onChange={(e) => setNf({ ...nf, amount: e.target.value })} />
          <button className={`${btn} bg-emerald-600 flex items-center justify-center gap-1`} onClick={async () => {
            if (!nf.code || !nf.label.trim()) return alert('Isi kod & nama.');
            if (await run(() => supabase.from('fee_types').insert({ code: nf.code, label: nf.label.trim(), amount: Number(nf.amount), active: true, sort: feeTypes.length + 1 }))) setNf({ code: '', label: '', amount: 20 });
          }}><Plus className="w-3.5 h-3.5" />Tambah</button>
        </div>
      </div>
      <div className={card}>
        <h2 className="text-sm font-bold text-amber-400">Produk / Merchandise</h2>
        {products.map((p) => <ProductRow key={p.id + p.price + p.name + p.in_stock + p.image_url} p={p} run={run} upload={upload} />)}
        <div className="grid sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs">
          <input className={inp} placeholder="Nama produk" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} />
          <input type="number" min="0" step="0.01" className={inp} value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} />
          <label className={`${inp} cursor-pointer flex items-center gap-2`}>
            <Upload className="w-4 h-4 text-amber-400" />{np.image_url ? 'Gambar ✓' : 'Gambar'}
            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) { const url = await upload(f, 'products'); if (url) setNp({ ...np, image_url: url }); }
            }} />
          </label>
          <button className={`${btn} bg-emerald-600 flex items-center justify-center gap-1`} onClick={async () => {
            if (!np.name.trim() || Number(np.price) <= 0) return alert('Isi nama & harga.');
            if (await run(() => supabase.from('products').insert({ name: np.name.trim(), price: Number(np.price), category: np.category, image_url: np.image_url || null }))) setNp({ name: '', price: 45, category: 'Merchandise', image_url: '' });
          }}><Plus className="w-3.5 h-3.5" />Tambah</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- BRANCHES ---------------- */
function BranchRow({ b, run }) {
  const [f, setF] = useState(b);
  const dirty = JSON.stringify(f) !== JSON.stringify(b);
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 grid sm:grid-cols-5 gap-2 items-center text-xs">
      <input className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input className={inp} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} />
      <input className={inp} placeholder="Alamat" value={f.address || ''} onChange={(e) => setF({ ...f, address: e.target.value })} />
      <input className={inp} placeholder="Jadual" value={f.training_schedule || ''} onChange={(e) => setF({ ...f, training_schedule: e.target.value })} />
      <div className="flex gap-2 justify-end">
        <button disabled={!dirty} onClick={() => run(() => supabase.from('branches').update({ name: f.name.trim(), state: f.state.trim(), address: f.address, training_schedule: f.training_schedule }).eq('id', b.id))}
          className={`${btn} bg-emerald-600 disabled:opacity-40`}>Simpan</button>
        <button onClick={() => confirm(`Padam cawangan ${b.name}?`) && run(() => supabase.from('branches').delete().eq('id', b.id))}
          className="p-1.5 rounded-lg bg-red-950 text-red-300"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
function BranchesSection({ branches, run }) {
  const [nb, setNb] = useState({ name: '', state: '', address: '', training_schedule: '' });
  return (
    <div className={card}>
      <h2 className="text-sm font-bold text-amber-400">Cawangan</h2>
      {branches.map((b) => <BranchRow key={b.id + b.name + b.state} b={b} run={run} />)}
      <div className="grid sm:grid-cols-5 gap-2 pt-2 border-t border-slate-800 text-xs">
        <input className={inp} placeholder="Nama" value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} />
        <input className={inp} placeholder="Negeri" value={nb.state} onChange={(e) => setNb({ ...nb, state: e.target.value })} />
        <input className={inp} placeholder="Alamat" value={nb.address} onChange={(e) => setNb({ ...nb, address: e.target.value })} />
        <input className={inp} placeholder="Jadual" value={nb.training_schedule} onChange={(e) => setNb({ ...nb, training_schedule: e.target.value })} />
        <button className={`${btn} bg-emerald-600 flex items-center justify-center gap-1`} onClick={async () => {
          if (!nb.name.trim() || !nb.state.trim()) return alert('Isi nama & negeri.');
          if (await run(() => supabase.from('branches').insert({ ...nb, name: nb.name.trim(), state: nb.state.trim() }))) setNb({ name: '', state: '', address: '', training_schedule: '' });
        }}><Plus className="w-3.5 h-3.5" />Tambah</button>
      </div>
    </div>
  );
}

/* ---------------- PAYMENTS ---------------- */
export function PaymentsSection({ payments, profiles, run, isAdmin }) {
  const [filter, setFilter] = useState('all');
  const nameOf = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p.full_name])), [profiles]);
  const list = payments.filter((p) => filter === 'all' || p.status === filter);
  const total = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.total_amount), 0);
  const setStatus = (id, status) => run(() => supabase.rpc('admin_set_payment_status', { p_id: id, p_status: status }));
  return (
    <div className={card}>
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-sm font-bold text-amber-400">Pengurusan Bayaran</h2>
        <p className="text-xs text-slate-300">Jumlah berjaya: <b className="text-emerald-400">RM{total.toFixed(2)}</b></p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {['all', 'pending', 'pending_verification', 'paid', 'failed', 'cancelled'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`${btn} ${filter === s ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
            {s === 'all' ? 'Semua' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {list.length === 0 && <p className="text-xs text-slate-400">Tiada rekod.</p>}
        {list.map((p) => (
          <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-2">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-bold text-white">{p.reference_no} <span className="text-slate-400 font-normal">• {p.payment_method === 'fpx' ? 'FPX (Herepay)' : 'Bank Transfer'}</span></p>
                <p className="text-slate-400">{nameOf[p.parent_id] || p.parent_id} • {new Date(p.created_at).toLocaleString('ms-MY')}</p>
                {p.bank_transfer_ref && <p className="text-slate-400">Ref Bank: {p.bank_transfer_ref}</p>}
                {p.gateway_payment_code && <p className="text-slate-500 font-mono text-[10px]">Herepay: {p.gateway_payment_code}</p>}
              </div>
              <div className="text-right space-y-1">
                <p className="text-base font-bold text-amber-400">RM{Number(p.total_amount).toFixed(2)}</p>
                <StatusBadge status={p.status} />
              </div>
            </div>
            <ul className="text-[11px] text-slate-400 list-disc pl-4">
              {(p.items || []).map((i, idx) => <li key={idx}>{i.label} — RM{Number(i.amount).toFixed(2)}</li>)}
            </ul>
            {p.status !== 'paid' && (
              <div className="flex flex-wrap gap-2">
                {(isAdmin || (p.payment_method === 'bank_transfer' && p.status === 'pending_verification')) && (
                  <button onClick={() => confirm(`Sahkan RM${Number(p.total_amount).toFixed(2)} telah diterima?`) && setStatus(p.id, 'paid')} className={`${btn} bg-emerald-600`}>Sahkan Diterima</button>
                )}
                {isAdmin && p.status !== 'failed' && <button onClick={() => setStatus(p.id, 'failed')} className={`${btn} bg-red-900 text-red-200`}>Tanda Gagal</button>}
                {isAdmin && p.status !== 'cancelled' && <button onClick={() => setStatus(p.id, 'cancelled')} className={`${btn} bg-slate-800 text-slate-200`}>Batalkan</button>}
                {isAdmin && (
                  <button onClick={() => confirm('Padam rekod bayaran ini?') && run(() => supabase.rpc('admin_delete_payment', { p_id: p.id }))}
                    className="p-1.5 rounded-lg bg-red-950 text-red-300"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- SHELL ---------------- */
export default function AdminPanel({
  me, isAdmin, profiles, branches, students, tournaments, products, feeTypes, payments,
  branchName, reload, upload,
}) {
  const { run } = useRun(reload);
  const sections = isAdmin
    ? [['users', 'Pengguna'], ['links', 'Pesilat ↔ Akaun'], ['payments', 'Bayaran'], ['events', 'Kejohanan'], ['catalog', 'Yuran & Produk'], ['branches', 'Cawangan']]
    : [['links', 'Pesilat ↔ Akaun'], ['payments', 'Bayaran']];
  const [sec, setSec] = useState(sections[0][0]);
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {sections.map(([id, label]) => (
          <button key={id} onClick={() => setSec(id)} className={`${btn} whitespace-nowrap ${sec === id ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>{label}</button>
        ))}
      </div>
      {sec === 'users' && isAdmin && <UsersSection profiles={profiles} me={me} branches={branches} branchName={branchName} run={run} />}
      {sec === 'links' && <LinksSection students={students} profiles={profiles} run={run} />}
      {sec === 'payments' && <PaymentsSection payments={payments} profiles={profiles} run={run} isAdmin={isAdmin} />}
      {sec === 'events' && isAdmin && <TournamentsSection tournaments={tournaments} run={run} me={me} upload={upload} />}
      {sec === 'catalog' && isAdmin && <CatalogSection products={products} feeTypes={feeTypes} run={run} upload={upload} />}
      {sec === 'branches' && isAdmin && <BranchesSection branches={branches} run={run} />}
    </div>
  );
}
