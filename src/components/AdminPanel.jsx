import React, { useEffect, useMemo, useState } from 'react';
import { Trash2, Plus, Upload, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StatusBadge, STATUS_LABEL, METHOD_LABEL, RefundLines, openReceipt, rm } from './PaymentUI';
import { PayslipAdmin } from './Payslips';
import { Field, ImageUploader, imagesOf } from './Media';
import { FinanceExport, FeeExemptions } from './FinanceExport';

const inp = 'px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs w-full';
const btn = 'px-3 py-1.5 rounded-lg text-xs font-semibold';
const card = 'bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3';

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
function UserRow({ u, me, isAdmin, isBA, branches, branchName, run }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState(u);
  const isMe = u.id === me;
  const privileged = u.role === 'admin' || u.role === 'coach';
  const baTarget = isBA && !isMe && ['parent', 'student', 'coach'].includes(u.role);
  const canTouch = isAdmin || baTarget || (!privileged && !isMe);
  const canRole = isAdmin || baTarget;
  const save = async () => {
    const ic = (f.ic_no || '').replace(/\D/g, '');
    if (ic && ic.length !== 12) return alert('No. IC mesti 12 digit.');
    const ph = (f.phone || '').replace(/\D/g, '').replace(/^60/, '').replace(/^0/, '');
    if (ph && (ph.length < 8 || ph.length > 11)) return alert('No. telefon tidak sah.');
    const patch = { full_name: (f.full_name || '').trim().toUpperCase(), ic_no: ic, phone: ph ? `+60${ph}` : '' };
    if (isAdmin) patch.branch_id = f.branch_id || null;
    if (await run(() => supabase.from('profiles').update(patch).eq('id', u.id))) setEdit(false);
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
            {u.member_no ? <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300 font-mono text-[10px]">{u.member_no}</span>
              : u.membership_status === 'pending' ? <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px]">Mohon ahli</span>
              : <span className="ml-2 text-[10px] text-slate-500">Bukan ahli</span>}
          </p>
          <p className="text-[11px] text-slate-400">{u.phone || '-'} • IC: {u.ic_no || '-'} • {branchName[u.branch_id] || 'Tiada Cawangan'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canRole && u.requested_role === 'coach' && u.role !== 'coach' && (
            <button onClick={() => setRole('coach')} className={`${btn} bg-amber-500 text-slate-950`}>Lulus Jurulatih</button>
          )}
          {isAdmin && u.role === 'coach' && u.branch_id && (
            <button onClick={() => run(() => supabase.from('profiles').update({ is_branch_admin: !u.is_branch_admin }).eq('id', u.id))}
              className={`${btn} ${u.is_branch_admin ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-amber-300'}`}
              title="Admin Cawangan: akses seperti Master Admin tetapi untuk cawangan ini sahaja (1 orang setiap cawangan)">
              {u.is_branch_admin ? '★ Admin Cawangan (Batal)' : 'Lantik Admin Cawangan'}
            </button>
          )}
          {!isAdmin && u.is_branch_admin && <span className="px-2 py-1 rounded bg-amber-500 text-slate-950 font-bold text-[10px]">ADMIN CAWANGAN</span>}
          {canRole ? (
            <select className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-300 disabled:opacity-50"
              value={u.role} disabled={isMe} onChange={(e) => setRole(e.target.value)}>
              <option value="parent">Ibu Bapa</option>
              <option value="student">Pesilat</option>
              <option value="coach">Jurulatih</option>
              {isAdmin && <option value="admin">Admin</option>}
            </select>
          ) : (
            <span className="px-2 py-1 rounded bg-slate-800 text-emerald-300 font-semibold uppercase text-[10px]">{u.role}</span>
          )}
          {u.membership_status === 'pending' && ['parent', 'student'].includes(u.role) && (
            <>
              <button onClick={() => run(() => supabase.rpc('review_membership', { p_user: u.id, p_approve: true }))} className={`${btn} bg-emerald-600`}>Lulus Ahli</button>
              <button onClick={() => run(() => supabase.rpc('review_membership', { p_user: u.id, p_approve: false }))} className={`${btn} bg-red-900 text-red-200`}>Tolak</button>
            </>
          )}
          {u.membership_status === 'approved' && ['parent', 'student'].includes(u.role) && u.id !== me && (
            <button onClick={() => confirm(`Batalkan keahlian ${u.full_name}? Nombor ahli dikekalkan jika diluluskan semula.`) && run(() => supabase.rpc('review_membership', { p_user: u.id, p_approve: false }))} className={`${btn} bg-slate-800 text-slate-300`}>Batal Ahli</button>
          )}
          {canTouch && <button onClick={() => setEdit(!edit)} className={`${btn} bg-slate-800 text-amber-300`}>{edit ? 'Tutup' : 'Edit'}</button>}
          {canTouch && !isMe && (
            <>
              <button onClick={() => setActive(u.is_active === false)} className={`${btn} bg-slate-800 text-slate-200`}>{u.is_active === false ? 'Aktifkan' : 'Nyahaktif'}</button>
              {isAdmin && u.role !== 'admin' && <button onClick={del} className="p-1.5 rounded-lg bg-red-950 text-red-300 hover:bg-red-900" title="Padam"><Trash2 className="w-4 h-4" /></button>}
            </>
          )}
        </div>
      </div>
      {edit && (
        <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800">
          <input className={`${inp} uppercase`} placeholder="Nama" value={f.full_name || ''} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          <input className={inp} placeholder="No. IC (12 digit)" maxLength={12} value={f.ic_no || ''} onChange={(e) => setF({ ...f, ic_no: e.target.value.replace(/\D/g, '') })} />
          <input className={inp} placeholder="No. Tel (+60...)" value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          {isAdmin ? (
            <select className={inp} value={f.branch_id || ''} onChange={(e) => setF({ ...f, branch_id: e.target.value })}>
              <option value="">Tiada Cawangan</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          ) : <div />}
          <button onClick={save} className={`${btn} bg-emerald-600 sm:col-span-2`}>Simpan Pengguna</button>
        </div>
      )}
    </div>
  );
}

function UsersSection({ profiles, me, isAdmin, isBA, branches, branchName, run }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return profiles.filter((p) => !s || `${p.full_name} ${p.ic_no} ${p.phone} ${p.member_no || ''}`.toLowerCase().includes(s));
  }, [profiles, q]);
  const pendingCoach = profiles.filter((p) => p.requested_role === 'coach' && p.role !== 'coach');
  const pendingMem = profiles.filter((p) => p.membership_status === 'pending' && ['parent', 'student'].includes(p.role));
  const review = (id, ok) => run(() => supabase.rpc('review_membership', { p_user: id, p_approve: ok }));
  return (
    <div className={card}>
      <h2 className="text-sm font-bold text-amber-400">Pengguna {isAdmin || isBA ? '& Peranan' : ''}{isAdmin ? '' : ' (cawangan anda)'} ({profiles.length})</h2>
      {(isAdmin || isBA) && pendingCoach.length > 0 && (
        <p className="text-[11px] bg-amber-500/10 border border-amber-500/40 text-amber-300 rounded-lg p-2">{pendingCoach.length} permohonan jurulatih menunggu kelulusan.</p>
      )}
      {pendingMem.length > 0 && (
        <div className="border border-amber-500/40 rounded-lg p-2 space-y-1.5">
          <p className="text-[11px] font-bold text-amber-300">Permohonan Keahlian Menunggu Kelulusan ({pendingMem.length})</p>
          {pendingMem.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 rounded p-2 text-xs">
              <span><b>{p.full_name}</b> <span className="text-slate-400">• {p.role === 'student' ? 'Pesilat' : 'Ibu bapa'} • {branchName[p.branch_id] || '-'} • {p.phone || '-'}</span></span>
              <span className="flex gap-1.5">
                <button onClick={() => review(p.id, true)} className={`${btn} bg-emerald-600`}>Lulus & beri No. Ahli</button>
                <button onClick={() => review(p.id, false)} className={`${btn} bg-red-900 text-red-200`}>Tolak</button>
              </span>
            </div>
          ))}
        </div>
      )}
      <input className={inp} placeholder="Cari nama / IC / telefon / no. ahli" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="space-y-2">
        {list.map((u) => <UserRow key={u.id + u.role + u.is_active} u={u} me={me} isAdmin={isAdmin} branches={branches} branchName={branchName} run={run} />)}
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
              <p><b>{nameOf[s.pending_claimant] || 'Pengguna'}</b> mahu tuntut <b>{s.full_name || s.short_name}</b>{' '}
                <span className="text-slate-400">({s.pending_claim_role === 'student' ? 'sebagai pesilat' : 'sebagai ibu bapa'})</span></p>
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
                {s.parent_id && !parents.some((p) => p.id === s.parent_id) && <option value={s.parent_id}>(akaun lain)</option>}
                {parents.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.role})</option>)}
              </select>
              <select className={inp} value={s.student_user_id || ''} onChange={(e) => assign(s.id, 'student', e.target.value)}>
                <option value="">— Tiada akaun pesilat —</option>
                {s.student_user_id && !studentAccts.some((p) => p.id === s.student_user_id) && <option value={s.student_user_id}>(akaun lain)</option>}
                {studentAccts.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- PAYMENTS (refund) ---------------- */
function PaymentCard({ p, nameOf, refunds, run }) {
  const [refunding, setRefunding] = useState(false);
  const left = Number(p.total_amount) - Number(p.refunded_total || 0);
  const [amt, setAmt] = useState(left);
  const [reason, setReason] = useState('');
  const setStatus = (status) => run(() => supabase.rpc('admin_set_payment_status', { p_id: p.id, p_status: status }));
  const canRefund = ['paid', 'partially_refunded'].includes(p.status) && left > 0;
  const open = !['paid', 'partially_refunded', 'refunded'].includes(p.status);
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-2">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <p className="font-bold text-white">{p.reference_no} <span className="text-slate-400 font-normal">• {METHOD_LABEL[p.payment_method] || p.payment_method}</span></p>
          <p className="text-slate-400">{nameOf[p.parent_id] || 'Pengguna'} • {new Date(p.created_at).toLocaleString('ms-MY')}</p>
          {p.bank_transfer_ref && <p className="text-slate-400">Ref: {p.bank_transfer_ref}</p>}
        </div>
        <div className="text-right space-y-1">
          <p className="text-base font-bold text-amber-400">{rm(p.total_amount)}</p>
          <StatusBadge status={p.status} />
        </div>
      </div>
      <ul className="text-[11px] text-slate-400 list-disc pl-4">{(p.items || []).map((i, k) => <li key={k}>{i.label} — {rm(i.amount)}</li>)}</ul>
      <RefundLines refunds={refunds} />
      <div className="flex flex-wrap gap-2">
        {p.receipt_url && <button onClick={() => openReceipt(p.receipt_url)} className={`${btn} bg-slate-800 text-amber-300`}>Lihat Resit</button>}
        {['pending', 'pending_verification', 'failed', 'cancelled'].includes(p.status) && (
          <button onClick={() => confirm(`Sahkan ${rm(p.total_amount)} telah diterima?`) && setStatus('paid')} className={`${btn} bg-emerald-600`}>Sahkan Diterima</button>
        )}
        {open && p.status !== 'failed' && <button onClick={() => setStatus('failed')} className={`${btn} bg-red-900 text-red-200`}>Tanda Gagal / Tolak</button>}
        {open && p.status !== 'cancelled' && <button onClick={() => setStatus('cancelled')} className={`${btn} bg-slate-800 text-slate-200`}>Batalkan</button>}
        {canRefund && <button onClick={() => setRefunding(!refunding)} className={`${btn} bg-purple-800 text-purple-100`}>Refund</button>}
        {open && <button onClick={() => confirm('Padam rekod bayaran ini?') && run(() => supabase.rpc('admin_delete_payment', { p_id: p.id }))} className="p-1.5 rounded-lg bg-red-950 text-red-300"><Trash2 className="w-4 h-4" /></button>}
      </div>
      {refunding && (
        <div className="grid sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800">
          <input type="number" min="0.01" max={left} step="0.01" className={inp} value={amt} onChange={(e) => setAmt(e.target.value)} />
          <input className={`${inp} sm:col-span-2`} placeholder="Sebab refund (wajib)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className={`${btn} bg-purple-700`} onClick={async () => {
            if (!confirm(`Rekod refund ${rm(amt)}? Wang perlu dipulangkan secara manual kepada pembayar.`)) return;
            if (await run(() => supabase.rpc('refund_payment', { p_id: p.id, p_amount: Number(amt), p_reason: reason }))) { setRefunding(false); setReason(''); }
          }}>Rekod Refund (maks {rm(left)})</button>
        </div>
      )}
    </div>
  );
}

function PaymentsSection({ payments, refunds, profiles, run }) {
  const [filter, setFilter] = useState('all');
  const nameOf = useMemo(() => Object.fromEntries(profiles.map((p) => [p.id, p.full_name])), [profiles]);
  const list = payments.filter((p) => filter === 'all' || p.status === filter);
  const received = payments.reduce((s, p) => ['paid', 'partially_refunded', 'refunded'].includes(p.status) ? s + Number(p.total_amount) : s, 0);
  const refunded = payments.reduce((s, p) => s + Number(p.refunded_total || 0), 0);
  return (
    <div className={card}>
      <div className="flex flex-wrap justify-between items-center gap-2">
        <h2 className="text-sm font-bold text-amber-400">Pengurusan Bayaran</h2>
        <p className="text-xs text-slate-300">Diterima <b className="text-emerald-400">{rm(received)}</b> • Refund <b className="text-purple-300">{rm(refunded)}</b> • Bersih <b className="text-amber-300">{rm(received - refunded)}</b></p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {['all', 'pending', 'pending_verification', 'paid', 'partially_refunded', 'refunded', 'failed', 'cancelled'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`${btn} ${filter === s ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>
            {s === 'all' ? 'Semua' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {list.length === 0 && <p className="text-xs text-slate-400">Tiada rekod.</p>}
        {list.map((p) => <PaymentCard key={p.id + p.status + p.refunded_total} p={p} nameOf={nameOf} refunds={refunds.filter((r) => r.payment_id === p.id)} run={run} />)}
      </div>
    </div>
  );
}

/* ---------------- TOURNAMENTS ---------------- */
const EVENT_TYPES = ['Open Tournament', 'State/National Selection', 'Open Friendly Sparring', 'Internal Friendly'];
function BranchSelect({ value, onChange, branches, isAdmin, allLabel = 'Semua Cawangan' }) {
  if (!isAdmin) return <div className={`${inp} text-slate-400`}>{branches[0]?.name || '-'}</div>;
  return (
    <select className={inp} value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{allLabel}</option>
      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
    </select>
  );
}
function TournamentForm({ init, onSave, onCancel, upload, label, branches, isAdmin, myBranch }) {
  const [t, setT] = useState({ ...init, images: imagesOf(init, 'poster_url'), branch_id: isAdmin ? init.branch_id : myBranch });
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      <Field label="Nama kejohanan" hint="Cth: Kejohanan Silat Terbuka Selangor 2026"><input className={inp} placeholder="Nama kejohanan" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} /></Field>
      <Field label="Jenis kejohanan" hint="Menentukan syarat kelayakan pesilat"><select className={inp} value={t.event_type} onChange={(e) => setT({ ...t, event_type: e.target.value })}>
        {EVENT_TYPES.map((x) => <option key={x}>{x}</option>)}
      </select></Field>
      <Field label="Tarikh kejohanan" hint="Pilih tarikh acara berlangsung"><input type="date" className={inp} value={t.event_date || ''} onChange={(e) => setT({ ...t, event_date: e.target.value })} /></Field>
      <Field label="Yuran penyertaan (RM)" hint="Taip 0 jika percuma"><input type="number" min="0" step="0.01" className={inp} placeholder="Cth: 40" value={t.entry_fee} onChange={(e) => setT({ ...t, entry_fee: e.target.value })} /></Field>
      <Field label="Lokasi / tempat" hint="Cth: Stadium Shah Alam"><input className={inp} placeholder="Nama tempat / alamat" value={t.location || ''} onChange={(e) => setT({ ...t, location: e.target.value })} /></Field>
      <Field label="Cawangan" hint="Pilih 'Semua Cawangan' jika terbuka untuk semua"><BranchSelect value={t.branch_id} onChange={(v) => setT({ ...t, branch_id: v })} branches={branches} isAdmin={isAdmin} /></Field>
      <div className="sm:col-span-2"><ImageUploader label="Gambar / poster kejohanan" images={t.images} onChange={(images) => setT({ ...t, images })} upload={upload} folder="posters" /></div>
      <Field label="Keterangan" className="sm:col-span-2" hint="Maklumat tambahan: kategori, syarat, tarikh tutup pendaftaran dan sebagainya"><textarea rows={2} className={inp} placeholder="Tulis keterangan kejohanan" value={t.description || ''} onChange={(e) => setT({ ...t, description: e.target.value })} /></Field>
      <div className="sm:col-span-2 flex gap-2">
        <button onClick={() => {
          if (!t.title?.trim() || !t.event_date) return alert('Isi nama & tarikh.');
          if (Number(t.entry_fee) < 0 || Number.isNaN(Number(t.entry_fee))) return alert('Yuran tidak sah.');
          onSave({ ...t, title: t.title.trim(), entry_fee: Number(t.entry_fee) || 0, poster_url: t.images[0] || null });
        }} className={`${btn} bg-emerald-600`}>{label}</button>
        {onCancel && <button onClick={onCancel} className={`${btn} bg-slate-800`}>Batal</button>}
      </div>
    </div>
  );
}
function Roster({ t, students, canFinance }) {
  const [rows, setRows] = useState(null);
  const load = () => supabase.from('tournament_rsvps').select('*').eq('tournament_id', t.id).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []); // eslint-disable-line
  const nm = (id) => students.find((x) => x.id === id)?.full_name || id;
  const pool = students.filter((x) => (!t.branch_id || x.branch_id === t.branch_id) && !(rows || []).some((r) => r.student_id === x.id));
  const [add, setAdd] = useState('');
  return (
    <div className="bg-slate-900 rounded-lg p-2 space-y-1.5 text-[11px]">
      {(rows || []).map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2">
          <span>{nm(r.student_id)} • {r.rsvp_status} • {canFinance && <b className={r.payment_status === 'paid' ? 'text-emerald-400' : 'text-amber-300'}>{r.payment_status}</b>}</span>
          <span className="flex gap-1.5">
            <button onClick={async () => { await supabase.from('tournament_rsvps').update({ coach_override: !r.coach_override }).eq('id', r.id); load(); }} className={`${btn} ${r.coach_override ? 'bg-amber-500 text-slate-950' : 'bg-slate-800'}`}>Kebenaran khas {r.coach_override ? '✓' : ''}</button>
            <button onClick={async () => { if (confirm('Buang peserta?')) { await supabase.from('tournament_rsvps').delete().eq('id', r.id); load(); } }} className="p-1 rounded bg-red-950 text-red-300"><Trash2 className="w-3.5 h-3.5" /></button>
          </span>
        </div>
      ))}
      {rows && rows.length === 0 && <p className="text-slate-500">Belum ada peserta.</p>}
      <div className="flex gap-2 pt-1">
        <select className={inp} value={add} onChange={(e) => setAdd(e.target.value)}>
          <option value="">+ Jemput pesilat...</option>
          {pool.map((x) => <option key={x.id} value={x.id}>{x.full_name || x.short_name}</option>)}
        </select>
        <button disabled={!add} onClick={async () => { const { error } = await supabase.from('tournament_rsvps').insert({ tournament_id: t.id, student_id: add, rsvp_status: 'invited', coach_override: true }); if (error) alert(error.message); setAdd(''); load(); }} className={`${btn} bg-emerald-600 disabled:opacity-40`}>Jemput</button>
      </div>
    </div>
  );
}
function TournamentsSection({ canFinance, tournaments, run, me, upload, branches, branchName, isAdmin, myBranch, students }) {
  const [editId, setEditId] = useState(null);
  const [rosterId, setRosterId] = useState(null);
  const blank = { title: '', event_type: 'Open Friendly Sparring', event_date: '', location: '', entry_fee: 30, poster_url: '', images: [], description: '', branch_id: null };
  const mine = (t) => isAdmin || (t.branch_id && t.branch_id === myBranch);
  return (
    <div className="space-y-4">
      <div className={card}>
        <h2 className="text-sm font-bold text-amber-400">Terbitkan Kejohanan Baharu</h2>
        <TournamentForm key={tournaments.length} init={blank} upload={upload} label="Terbitkan" branches={branches} isAdmin={isAdmin} myBranch={myBranch}
          onSave={(t) => run(() => supabase.from('tournaments').insert({ ...t, created_by: me }))} />
      </div>
      <div className={card}>
        <h2 className="text-sm font-bold text-amber-400">Senarai Kejohanan ({tournaments.length})</h2>
        {tournaments.map((t) => (
          <div key={t.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-2">
            {editId === t.id ? (
              <TournamentForm init={t} upload={upload} label="Simpan" branches={branches} isAdmin={isAdmin} myBranch={myBranch} onCancel={() => setEditId(null)}
                onSave={async (v) => {
                  const { id, created_at, created_by, ...rest } = v;
                  if (await run(() => supabase.from('tournaments').update(rest).eq('id', t.id))) setEditId(null);
                }} />
            ) : (
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <p className="font-bold text-white">{t.title} <span className="text-amber-300 font-normal">• {t.event_type}</span></p>
                  <p className="text-slate-400">{t.event_date} • {t.location || '-'} • {rm(t.entry_fee)} • {t.branch_id ? branchName[t.branch_id] : 'Semua cawangan'}</p>
                </div>
                {mine(t) && (
                  <div className="flex gap-2">
                    <button onClick={() => setRosterId(rosterId === t.id ? null : t.id)} className={`${btn} bg-slate-800 text-emerald-300`}>Peserta</button>
                    <button onClick={() => setEditId(t.id)} className={`${btn} bg-slate-800 text-amber-300`}>Edit</button>
                    <button onClick={() => confirm(`Padam kejohanan "${t.title}"?`) && run(() => supabase.from('tournaments').delete().eq('id', t.id))} className="p-1.5 rounded-lg bg-red-950 text-red-300"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            )}
            {rosterId === t.id && <Roster t={t} students={students} canFinance={canFinance} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- FEES (default + per branch) & PRODUCTS ---------------- */
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
        <button disabled={!dirty} onClick={() => run(() => supabase.from('fee_types').update({ label: f.label.trim(), amount: Number(f.amount), active: f.active }).eq('code', fee.code))} className={`${btn} bg-emerald-600 disabled:opacity-40`}>Simpan</button>
      </div>
    </div>
  );
}
function BranchFeeRow({ fee, branchId, override, run }) {
  const [amt, setAmt] = useState(override ? override.amount : '');
  const [active, setActive] = useState(override ? override.active : true);
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 grid sm:grid-cols-5 gap-2 items-center text-xs">
      <div className="sm:col-span-2">
        <p className="font-semibold text-white">{fee.label}</p>
        <p className="text-[10px] text-slate-500">Default {rm(fee.amount)}{override ? '' : ' (guna default)'}</p>
      </div>
      <input type="number" min="0" step="0.01" className={inp} placeholder={`Default ${Number(fee.amount).toFixed(2)}`} value={amt} onChange={(e) => setAmt(e.target.value)} />
      <label className="flex items-center gap-1"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Ditawarkan</label>
      <div className="flex gap-2 justify-end">
        <button onClick={() => {
          if (amt === '' && active) return alert('Isi harga cawangan, atau tekan Reset untuk guna default.');
          run(() => supabase.from('branch_fees').upsert({ branch_id: branchId, fee_code: fee.code, amount: Number(amt || fee.amount), active, updated_at: new Date().toISOString() }, { onConflict: 'branch_id,fee_code' }));
        }} className={`${btn} bg-emerald-600`}>Simpan</button>
        {override && <button onClick={() => run(() => supabase.from('branch_fees').delete().eq('branch_id', branchId).eq('fee_code', fee.code))} className={`${btn} bg-slate-800`}>Reset</button>}
      </div>
    </div>
  );
}
function FeesSection({ feeTypes, allFeeTypes, branchFees, branches, isAdmin, myBranch, run }) {
  const scope = isAdmin ? branches : branches.filter((b) => b.id === myBranch);
  const [bid, setBid] = useState(scope[0]?.id || '');
  const [nf, setNf] = useState({ code: '', label: '', amount: 20 });
  const [custom, setCustom] = useState({ label: '', amount: 20 });
  const types = isAdmin ? allFeeTypes : feeTypes;
  const customRows = branchFees.filter((b) => b.branch_id === bid && !types.some((t) => t.code === b.fee_code));
  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h2 className="text-sm font-bold text-amber-400">Yuran Mengikut Cawangan</h2>
          {isAdmin ? (
            <select className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs" value={bid} onChange={(e) => setBid(e.target.value)}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          ) : <span className="text-xs text-emerald-300">{scope[0]?.name}</span>}
        </div>
        {!bid ? <p className="text-xs text-slate-400">Tiada cawangan.</p> : (
          <>
            {types.map((ft) => (
              <BranchFeeRow key={bid + ft.code + JSON.stringify(branchFees.find((b) => b.branch_id === bid && b.fee_code === ft.code) || {})}
                fee={ft} branchId={bid} override={branchFees.find((b) => b.branch_id === bid && b.fee_code === ft.code)} run={run} />
            ))}
            {customRows.map((c) => (
              <div key={c.fee_code} className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-white">{c.label || c.fee_code} <span className="text-slate-500 font-normal">(yuran khas cawangan)</span></span>
                <span className="flex items-center gap-2">
                  <b className="text-emerald-400">{rm(c.amount)}</b>
                  <button onClick={() => confirm('Padam yuran ini?') && run(() => supabase.from('branch_fees').delete().eq('branch_id', bid).eq('fee_code', c.fee_code))} className="p-1.5 rounded-lg bg-red-950 text-red-300"><Trash2 className="w-4 h-4" /></button>
                </span>
              </div>
            ))}
            <div className="grid sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs">
              <input className={`${inp} sm:col-span-2`} placeholder="Yuran khas cawangan (cth: Sewa Gelanggang)" value={custom.label} onChange={(e) => setCustom({ ...custom, label: e.target.value })} />
              <input type="number" min="0" step="0.01" className={inp} value={custom.amount} onChange={(e) => setCustom({ ...custom, amount: e.target.value })} />
              <button className={`${btn} bg-emerald-600 flex items-center justify-center gap-1`} onClick={async () => {
                if (!custom.label.trim()) return alert('Isi nama yuran.');
                if (await run(() => supabase.from('branch_fees').insert({ branch_id: bid, fee_code: `x_${Date.now().toString(36)}`, label: custom.label.trim(), amount: Number(custom.amount), active: true }))) setCustom({ label: '', amount: 20 });
              }}><Plus className="w-3.5 h-3.5" />Tambah</button>
            </div>
          </>
        )}
      </div>
      {isAdmin && (
        <div className={card}>
          <h2 className="text-sm font-bold text-amber-400">Yuran Default (semua cawangan)</h2>
          {allFeeTypes.map((f) => <FeeRow key={f.code + f.amount + f.label + f.active} fee={f} run={run} />)}
          <div className="grid sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs">
            <input className={inp} placeholder="Kod (cth: seragam)" value={nf.code} onChange={(e) => setNf({ ...nf, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })} />
            <input className={inp} placeholder="Nama yuran" value={nf.label} onChange={(e) => setNf({ ...nf, label: e.target.value })} />
            <input type="number" min="0" step="0.01" className={inp} value={nf.amount} onChange={(e) => setNf({ ...nf, amount: e.target.value })} />
            <button className={`${btn} bg-emerald-600 flex items-center justify-center gap-1`} onClick={async () => {
              if (!nf.code || !nf.label.trim()) return alert('Isi kod & nama.');
              if (await run(() => supabase.from('fee_types').insert({ code: nf.code, label: nf.label.trim(), amount: Number(nf.amount), active: true, sort: allFeeTypes.length + 1 }))) setNf({ code: '', label: '', amount: 20 });
            }}><Plus className="w-3.5 h-3.5" />Tambah</button>
          </div>
        </div>
      )}
    </div>
  );
}
function ProductRow({ p, run, upload, canEdit, branchName }) {
  const [f, setF] = useState({ ...p, images: imagesOf(p, 'image_url') });
  const base = JSON.stringify({ ...p, images: imagesOf(p, 'image_url') });
  const dirty = JSON.stringify(f) !== base;
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 text-xs">
      <div className="grid sm:grid-cols-6 gap-2 items-end">
        <Field label="Nama produk" className="sm:col-span-2"><input disabled={!canEdit} className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Harga (RM)"><input disabled={!canEdit} type="number" min="0" step="0.01" className={inp} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>
        <Field label="Cawangan"><span className="block text-[11px] text-slate-400 py-2">{p.branch_id ? branchName[p.branch_id] : 'Semua cawangan'}</span></Field>
        <label className="flex items-center gap-1.5 pb-2"><input disabled={!canEdit} type="checkbox" checked={!!f.in_stock} onChange={(e) => setF({ ...f, in_stock: e.target.checked })} /> Ada stok</label>
        {canEdit && (
          <div className="flex gap-2 justify-end pb-1">
            <button disabled={!dirty} onClick={() => run(() => supabase.from('products').update({ name: f.name.trim(), price: Number(f.price), in_stock: f.in_stock, images: f.images, image_url: f.images[0] || null }).eq('id', p.id))} className={`${btn} bg-emerald-600 disabled:opacity-40`}>Simpan</button>
            <button onClick={() => confirm(`Padam produk "${p.name}"?`) && run(() => supabase.from('products').delete().eq('id', p.id))} className="p-1.5 rounded-lg bg-red-950 text-red-300"><Trash2 className="w-4 h-4" /></button>
          </div>
        )}
      </div>
      {canEdit ? <ImageUploader label="Gambar produk" images={f.images} onChange={(images) => setF({ ...f, images })} upload={upload} folder="products" /> : null}
    </div>
  );
}
function CatalogSection({ products, feeTypes, allFeeTypes, branchFees, branches, branchName, isAdmin, myBranch, run, upload }) {
  const [np, setNp] = useState({ name: '', price: 45, category: 'Merchandise', images: [], branch_id: isAdmin ? null : myBranch });
  const scope = isAdmin ? branches : branches.filter((b) => b.id === myBranch);
  return (
    <div className="space-y-4">
      <FeesSection feeTypes={feeTypes} allFeeTypes={allFeeTypes} branchFees={branchFees} branches={branches} isAdmin={isAdmin} myBranch={myBranch} run={run} />
      <div className={card}>
        <h2 className="text-sm font-bold text-amber-400">Produk / Merchandise</h2>
        {products.map((p) => <ProductRow key={p.id + p.price + p.name + p.in_stock + (p.images || []).join('|')} p={p} run={run} upload={upload} branchName={branchName} canEdit={isAdmin || (p.branch_id && p.branch_id === myBranch)} />)}
        <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
          <p className="text-[11px] font-bold text-amber-300">Tambah produk baharu</p>
          <div className="grid sm:grid-cols-4 gap-2 items-end">
            <Field label="Nama produk" hint="Cth: Baju T-shirt Pukulan Serantau"><input className={inp} placeholder="Nama produk" value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} /></Field>
            <Field label="Harga (RM)" hint="Harga seunit"><input type="number" min="0" step="0.01" className={inp} placeholder="Cth: 50" value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} /></Field>
            <Field label="Cawangan" hint="Siapa boleh beli"><BranchSelect value={np.branch_id} onChange={(v) => setNp({ ...np, branch_id: v })} branches={scope} isAdmin={isAdmin} /></Field>
            <Field label="Kategori"><input className={inp} placeholder="Merchandise / Peralatan" value={np.category} onChange={(e) => setNp({ ...np, category: e.target.value })} /></Field>
          </div>
          <ImageUploader label="Gambar produk" images={np.images} onChange={(images) => setNp({ ...np, images })} upload={upload} folder="products" />
          <button className={`${btn} bg-emerald-600 flex items-center justify-center gap-1`} onClick={async () => {
            if (!np.name.trim() || Number(np.price) <= 0) return alert('Isi nama & harga.');
            if (await run(() => supabase.from('products').insert({ name: np.name.trim(), price: Number(np.price), category: np.category || 'Merchandise', images: np.images, image_url: np.images[0] || null, branch_id: isAdmin ? np.branch_id : myBranch }))) setNp({ ...np, name: '', price: 45, images: [] });
          }}><Plus className="w-3.5 h-3.5" />Tambah Produk</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- BRANCHES ---------------- */
function BranchRow({ b, run, isAdmin }) {
  const [f, setF] = useState(b);
  const dirty = JSON.stringify(f) !== JSON.stringify(b);
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 grid sm:grid-cols-5 gap-2 items-center text-xs">
      <input disabled={!isAdmin} className={inp} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input disabled={!isAdmin} className={inp} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} />
      <input className={inp} placeholder="Alamat gelanggang" value={f.address || ''} onChange={(e) => setF({ ...f, address: e.target.value })} />
      <input className={inp} placeholder="Jadual latihan" value={f.training_schedule || ''} onChange={(e) => setF({ ...f, training_schedule: e.target.value })} />
      <div className="flex gap-2 justify-end">
        <button disabled={!dirty} onClick={() => run(() => supabase.from('branches').update({ name: f.name.trim(), state: f.state.trim(), address: f.address, training_schedule: f.training_schedule }).eq('id', b.id))} className={`${btn} bg-emerald-600 disabled:opacity-40`}>Simpan</button>
        {isAdmin && <button onClick={() => confirm(`Padam cawangan ${b.name}?`) && run(() => supabase.from('branches').delete().eq('id', b.id))} className="p-1.5 rounded-lg bg-red-950 text-red-300"><Trash2 className="w-4 h-4" /></button>}
      </div>
    </div>
  );
}
function BranchesSection({ branches, run, isAdmin, myBranch }) {
  const [nb, setNb] = useState({ name: '', state: '', address: '', training_schedule: '' });
  const list = isAdmin ? branches : branches.filter((b) => b.id === myBranch);
  return (
    <div className={card}>
      <h2 className="text-sm font-bold text-amber-400">Cawangan & Gelanggang</h2>
      {list.map((b) => <BranchRow key={b.id + b.name + b.state + b.address + b.training_schedule} b={b} run={run} isAdmin={isAdmin} />)}
      {isAdmin && (
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
      )}
    </div>
  );
}

/* ---------------- SETTINGS (admin): payment info, about, org chart, rules ---------------- */
function PaymentSettings({ branchPay, branches, isAdmin, myBranch, run, upload }) {
  const list = isAdmin ? branches : branches.filter((b) => b.id === myBranch);
  const [bid, setBid] = useState(list[0]?.id || '');
  if (!bid) return <div className={card}><p className="text-xs text-slate-400">Cawangan belum ditetapkan.</p></div>;
  return <PaymentSettingsForm key={bid} bid={bid} setBid={setBid} list={list} info={branchPay[bid] || {}} run={run} upload={upload} />;
}
function PaymentSettingsForm({ bid, setBid, list, info, run, upload }) {
  const [f, setF] = useState({ bank_name: '', account_no: '', account_name: '', bank_logo_url: null, qr_url: null, ...info });
  const img = (key, label, folder) => (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold text-slate-300">{label}</p>
      {f[key] && <img src={f[key]} alt={label} className="h-24 w-auto rounded bg-white p-1 object-contain" />}
      <div className="flex gap-2">
        <label className={`${btn} bg-slate-800 cursor-pointer flex items-center gap-1.5`}>
          <Upload className="w-3.5 h-3.5 text-amber-400" /> {f[key] ? 'Tukar' : 'Muat Naik'}
          <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) { const url = await upload(file, folder); if (url) setF({ ...f, [key]: url }); }
          }} />
        </label>
        {f[key] && <button onClick={() => setF({ ...f, [key]: null })} className={`${btn} bg-slate-800 text-red-300`}>Buang</button>}
      </div>
    </div>
  );
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-amber-400">Akaun Bank &amp; QR Cawangan</h2>
        {list.length > 1 && (
          <select className={inp + ' !w-auto'} value={bid} onChange={(e) => setBid(e.target.value)}>
            {list.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>
      <p className="text-[11px] text-slate-400">Semua bayaran (yuran, kejohanan, merchandise) pesilat cawangan ini akan masuk ke akaun di bawah, dan disahkan oleh jurulatih/admin cawangan ini. Kejohanan "Semua Cawangan" yang dibuat admin masuk ke akaun Cawangan Pusat (HQ).</p>
      <div className="grid sm:grid-cols-3 gap-2">
        <Field label="Nama bank" hint="Cth: Bank Rakyat"><input className={inp} placeholder="Nama bank" value={f.bank_name || ''} onChange={(e) => setF({ ...f, bank_name: e.target.value })} /></Field>
        <Field label="No. akaun" hint="Nombor sahaja, tanpa sengkang"><input className={inp} placeholder="Cth: 1102427345" value={f.account_no || ''} onChange={(e) => setF({ ...f, account_no: e.target.value.replace(/[^0-9]/g, '') })} /></Field>
        <Field label="Nama pemegang akaun" hint="Seperti dalam buku bank"><input className={`${inp} uppercase`} placeholder="Nama pemegang akaun" value={f.account_name || ''} onChange={(e) => setF({ ...f, account_name: e.target.value })} /></Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {img('bank_logo_url', 'Logo bank (dipaparkan di sebelah no. akaun)', 'bank')}
        {img('qr_url', 'Kod QR DuitNow cawangan ini (dipaparkan semasa pembayaran)', 'qr')}
      </div>
      <button className={`${btn} bg-emerald-600`} onClick={() => {
        if (!f.account_no || !f.account_name?.trim()) return alert('Isi no. akaun & nama akaun.');
        run(() => supabase.from('branch_payment_settings').upsert({
          branch_id: bid, bank_name: f.bank_name || null, account_no: f.account_no, account_name: f.account_name.trim().toUpperCase(),
          bank_logo_url: f.bank_logo_url || null, qr_url: f.qr_url || null, updated_at: new Date().toISOString(),
        }), 'Tetapan bayaran cawangan disimpan.');
      }}>Simpan Tetapan Cawangan</button>
    </div>
  );
}
function AcademyEditor({ academyInfo, run }) {
  const [org, setOrg] = useState(academyInfo.org_chart || []);
  const [rules, setRules] = useState({ bengkung: '', syarat_am: '', syarat_khas: '', ...(academyInfo.rules || {}) });
  const [soc, setSoc] = useState({ facebook: '', instagram: '', tiktok: '', ...(academyInfo.social || {}) });
  const save = (key, value) => run(() => supabase.from('academy_info').upsert({ key, value, updated_at: new Date().toISOString() }), 'Disimpan.');
  return (
    <div className="space-y-4">
      <div className={card}>
        <h2 className="text-sm font-bold text-amber-400">Pautan Media Sosial (papar di laman awam)</h2>
        {[['facebook', 'Facebook', 'https://www.facebook.com/...'], ['instagram', 'Instagram', 'https://www.instagram.com/...'], ['tiktok', 'TikTok', 'https://www.tiktok.com/@...']].map(([k, l, ph]) => (
          <Field key={k} label={`Pautan ${l}`} hint="Tampal pautan penuh akaun / profil"><input className={inp} placeholder={ph} value={soc[k] || ''} onChange={(e) => setSoc({ ...soc, [k]: e.target.value })} /></Field>
        ))}
        <button onClick={() => { for (const v of Object.values(soc)) if (v && !/^https:\/\//.test(v)) return alert('Pautan mesti bermula dengan https://'); save('social', soc); }} className={`${btn} bg-emerald-600`}>Simpan Pautan</button>
      </div>
      <div className={card}>
        <h2 className="text-sm font-bold text-amber-400">Carta Organisasi</h2>
        {org.map((o, i) => (
          <div key={i} className="grid sm:grid-cols-6 gap-2">
            <select className={inp} value={o.level ?? 2} onChange={(e) => setOrg(org.map((x, k) => k === i ? { ...x, level: Number(e.target.value) } : x))}>
              <option value={0}>Guru Utama</option><option value={1}>Guru Adat</option><option value={2}>Guru</option><option value={3}>Jurulatih / Pembantu</option>
            </select>
            <input className={inp} placeholder="Jawatan (cth: Jurulatih Kanan)" value={o.role || ''} onChange={(e) => setOrg(org.map((x, k) => k === i ? { ...x, role: e.target.value } : x))} />
            <input className={inp} placeholder="Di bawah guru siapa (nama)" value={o.under || ''} onChange={(e) => setOrg(org.map((x, k) => k === i ? { ...x, under: e.target.value } : x))} />
            <input className={inp} placeholder="Nama penuh" value={o.name || ''} onChange={(e) => setOrg(org.map((x, k) => k === i ? { ...x, name: e.target.value } : x))} />
            <input className={inp} placeholder="Cawangan (cth: Puchong)" value={o.branch || ''} onChange={(e) => setOrg(org.map((x, k) => k === i ? { ...x, branch: e.target.value } : x))} />
            <button onClick={() => setOrg(org.filter((_, k) => k !== i))} className="p-1.5 rounded-lg bg-red-950 text-red-300 justify-self-start"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <div className="flex gap-2">
          <button onClick={() => setOrg([...org, { level: 3, role: 'Jurulatih', name: '', branch: '', under: '' }])} className={`${btn} bg-slate-800 flex items-center gap-1`}><Plus className="w-3.5 h-3.5" />Tambah</button>
          <button onClick={() => save('org_chart', org.filter((o) => o.name?.trim()))} className={`${btn} bg-emerald-600`}>Simpan Carta</button>
        </div>
      </div>
      <div className={card}>
        <h2 className="text-sm font-bold text-amber-400">Bengkung & Syarat Penyertaan</h2>
        <textarea rows={2} className={inp} placeholder="Senarai tahap bengkung (cth: Putih, Kuning, Hijau...)" value={rules.bengkung} onChange={(e) => setRules({ ...rules, bengkung: e.target.value })} />
        <textarea rows={2} className={inp} placeholder="Syarat am penyertaan (umur, kesihatan, dll)" value={rules.syarat_am} onChange={(e) => setRules({ ...rules, syarat_am: e.target.value })} />
        <textarea rows={2} className={inp} placeholder="Syarat khas (cth: kebenaran ibu bapa)" value={rules.syarat_khas} onChange={(e) => setRules({ ...rules, syarat_khas: e.target.value })} />
        <button onClick={() => save('rules', rules)} className={`${btn} bg-emerald-600`}>Simpan Syarat</button>
        <p className="text-[11px] text-slate-500">Tajuk, tagline, visi & misi: edit di tab "Tentang Kami".</p>
      </div>
    </div>
  );
}

/* ---------------- SHELL ---------------- */
export default function AdminPanel({
  me, isAdmin, myBranch, profiles, branches, students, tournaments, products, feeTypes, allFeeTypes, branchFees,
  payments, refunds, academyInfo, branchName, reload, upload, branchPay = {}, isBranchAdmin = false,
}) {
  const { run } = useRun(reload);
  const canFinance = isAdmin || isBranchAdmin;
  const scopedBranches = isAdmin ? branches : branches.filter((b) => b.id === myBranch);
  const sections = [
    ['users', 'Pengguna'], ['links', 'Pesilat ↔ Akaun'],
    ...(canFinance ? [['payments', 'Bayaran'], ['export', 'Eksport Excel']] : []), ...(isAdmin ? [['exempt', 'Pengecualian Yuran']] : []), ['events', 'Kejohanan'],
    ['catalog', 'Yuran & Produk'], ['branches', isAdmin ? 'Cawangan' : 'Cawangan Saya'],
    ['settings', 'Tetapan Bayaran'],
    ...(isAdmin ? [['academy', 'Maklumat Akademi'], ['payslips', 'Slip Gaji']] : isBranchAdmin ? [['payslips', 'Slip Gaji']] : []),
  ];
  const [sec, setSec] = useState('users');
  return (
    <div className="space-y-4">
      {!isAdmin && <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">{isBranchAdmin ? 'Admin Cawangan' : 'Akses jurulatih'}: terhad kepada cawangan {branchName[myBranch] || '(belum ditetapkan — hubungi admin)'}.</p>}
      <div className="flex gap-2 overflow-x-auto">
        {sections.map(([id, label]) => (
          <button key={id} onClick={() => setSec(id)} className={`${btn} whitespace-nowrap ${sec === id ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>{label}</button>
        ))}
      </div>
      {sec === 'users' && <UsersSection profiles={profiles} me={me} isAdmin={isAdmin} isBA={isBranchAdmin} branches={branches} branchName={branchName} run={run} />}
      {sec === 'links' && <LinksSection students={students} profiles={profiles} run={run} />}
      {sec === 'export' && canFinance && <FinanceExport payments={payments} profiles={profiles} students={students} branches={scopedBranches} allFeeTypes={allFeeTypes} branchFees={branchFees} isAdmin={isAdmin} myBranch={myBranch} branchName={branchName} />}
      {sec === 'exempt' && isAdmin && <FeeExemptions students={students} profiles={profiles} branches={branches} allFeeTypes={allFeeTypes} branchFees={branchFees} branchName={branchName} run={run} />}
      {sec === 'payments' && canFinance && <PaymentsSection payments={payments} refunds={refunds} profiles={profiles} run={run} />}
      {sec === 'events' && <TournamentsSection canFinance={canFinance} students={students} tournaments={tournaments} run={run} me={me} upload={upload} branches={scopedBranches} branchName={branchName} isAdmin={isAdmin} myBranch={myBranch} />}
      {sec === 'catalog' && <CatalogSection products={products} feeTypes={feeTypes} allFeeTypes={allFeeTypes} branchFees={branchFees} branches={branches} branchName={branchName} isAdmin={isAdmin} myBranch={myBranch} run={run} upload={upload} />}
      {sec === 'branches' && <BranchesSection branches={branches} run={run} isAdmin={isAdmin} myBranch={myBranch} />}
      {sec === 'settings' && <PaymentSettings branchPay={branchPay} branches={branches} isAdmin={isAdmin} myBranch={myBranch} run={run} upload={upload} />}
      {sec === 'academy' && isAdmin && <AcademyEditor academyInfo={academyInfo} run={run} />}
      {sec === 'payslips' && (isAdmin || isBranchAdmin) && <PayslipAdmin me={me} profiles={isAdmin ? profiles : profiles.filter((p) => p.branch_id === myBranch && p.id !== me)} branches={scopedBranches} clubName={academyInfo.about?.title} />}
    </div>
  );
}
