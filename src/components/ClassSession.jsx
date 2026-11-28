import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const inp = 'px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs';
const STATUS = [['Hadir', 'bg-emerald-600'], ['Lewat', 'bg-amber-500 text-slate-950'], ['Tidak Hadir', 'bg-red-700']];
const today = () => new Date().toLocaleDateString('en-CA');

function Row({ s, status, me, weightClass, onSet, reload }) {
  const [open, setOpen] = useState(false);
  const [w, setW] = useState('');
  const [note, setNote] = useState({ type: 'Sparring', text: '', score: '' });
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState({ w: [], n: [] });
  const loadHist = async () => {
    const [a, b] = await Promise.all([
      supabase.from('weight_logs').select('id,weight_kg,weight_class,recorded_at').eq('student_id', s.id).order('recorded_at', { ascending: false }).limit(5),
      supabase.from('training_logs').select('id,session_type,raw_notes,score_awarded,created_at').eq('student_id', s.id).order('created_at', { ascending: false }).limit(5),
    ]);
    setHist({ w: a.data || [], n: b.data || [] });
  };
  useEffect(() => { if (open) loadHist(); }, [open]); // eslint-disable-line
  const delWeight = async (id) => {
    if (!confirm('Padam rekod berat ini?')) return;
    const { error } = await supabase.from('weight_logs').delete().eq('id', id);
    if (error) return alert(error.message);
    const { data } = await supabase.from('weight_logs').select('weight_kg,weight_class').eq('student_id', s.id).order('recorded_at', { ascending: false }).limit(1);
    const last = data?.[0];
    await supabase.from('students').update({ current_weight: last ? last.weight_kg : null, weight_class: last ? last.weight_class : null }).eq('id', s.id);
    loadHist(); reload();
  };
  const delNote = async (id) => {
    if (!confirm('Padam catatan ini?')) return;
    const { error } = await supabase.from('training_logs').delete().eq('id', id);
    if (error) return alert(error.message);
    loadHist();
  };
  const saveWeight = async () => {
    const kg = Number(w);
    if (!(kg > 10 && kg < 200)) return alert('Berat tidak sah.');
    setBusy(true);
    const wc = weightClass(s.age, kg);
    const a = await supabase.from('weight_logs').insert({ student_id: s.id, weight_kg: kg, weight_class: wc, recorded_by: me });
    const b = a.error ? a : await supabase.from('students').update({ current_weight: kg, weight_class: wc, weight_updated_at: new Date().toISOString() }).eq('id', s.id);
    setBusy(false);
    if (b.error) return alert(b.error.message);
    setW(''); reload(); loadHist();
  };
  const saveNote = async () => {
    if (!note.text.trim()) return alert('Isi catatan.');
    const sc = note.score === '' ? null : Number(note.score);
    if (sc !== null && !(sc >= 0 && sc <= 10)) return alert('Skor 0–10.');
    setBusy(true);
    const { error } = await supabase.from('training_logs').insert({ student_id: s.id, coach_id: me, session_type: note.type, raw_notes: note.text.trim(), score_awarded: sc });
    setBusy(false);
    if (error) return alert(error.message);
    setNote({ ...note, text: '', score: '' }); loadHist();
  };
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => setOpen(!open)} className="text-left">
          <p className="font-bold text-white">{s.full_name || s.short_name}</p>
          <p className="text-[10px] text-slate-400">{s.id} • {s.class_tier} • {s.current_weight ? `${s.current_weight}kg (${s.weight_class})` : 'belum ditimbang'}</p>
        </button>
        <div className="flex gap-1.5">
          {STATUS.map(([k, c]) => (
            <button key={k} onClick={() => onSet(s.id, k)} className={`px-2.5 py-1.5 rounded-lg font-semibold ${status === k ? c : 'bg-slate-800 text-slate-400'}`}>{k}</button>
          ))}
          {status && <button title="Kosongkan kehadiran" onClick={() => onSet(s.id, null)} className="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400">✕</button>}
        </div>
      </div>
      {open && (
        <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div className="flex gap-2">
            <input type="number" step="0.1" className={`${inp} flex-1`} placeholder="Berat (kg)" value={w} onChange={(e) => setW(e.target.value)} />
            <button disabled={busy} onClick={saveWeight} className="px-3 py-2 rounded-lg bg-emerald-600 font-semibold disabled:opacity-50">Simpan Berat</button>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <select className={`${inp} flex-1`} value={note.type} onChange={(e) => setNote({ ...note, type: e.target.value })}>
                {['Sparring', 'Seni', 'Fizikal', 'Teknik', 'Ujian'].map((t) => <option key={t}>{t}</option>)}
              </select>
              <input type="number" min="0" max="10" className={`${inp} w-24`} placeholder="Skor 0-10 (cth: 8)" value={note.score} onChange={(e) => setNote({ ...note, score: e.target.value })} />
            </div>
            <textarea rows={2} className={`${inp} w-full`} placeholder="Catatan latihan / maklum balas" value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} />
            <button disabled={busy} onClick={saveNote} className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold disabled:opacity-50">Simpan Catatan</button>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 uppercase">Berat terkini</p>
            {hist.w.map((x) => (
              <div key={x.id} className="flex items-center justify-between bg-slate-900 rounded px-2 py-1">
                <span>{String(x.recorded_at).slice(0, 10)} • {x.weight_kg}kg ({x.weight_class})</span>
                <button onClick={() => delWeight(x.id)} className="text-red-400 font-semibold">Padam</button>
              </div>
            ))}
            {!hist.w.length && <p className="text-slate-500">Tiada.</p>}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 uppercase">Catatan terkini</p>
            {hist.n.map((x) => (
              <div key={x.id} className="flex items-start justify-between gap-2 bg-slate-900 rounded px-2 py-1">
                <span className="min-w-0 break-words">{String(x.created_at).slice(0, 10)} • {x.session_type}{x.score_awarded != null ? ` • ${x.score_awarded}/10` : ''}: {x.raw_notes}</span>
                <button onClick={() => delNote(x.id)} className="text-red-400 font-semibold shrink-0">Padam</button>
              </div>
            ))}
            {!hist.n.length && <p className="text-slate-500">Tiada.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClassSession({ students, me, weightClass, reload }) {
  const [date, setDate] = useState(today());
  const [att, setAtt] = useState({});
  const [q, setQ] = useState('');
  const ids = useMemo(() => students.map((s) => s.id), [students]);
  const load = async () => {
    const { data } = await supabase.from('attendance').select('student_id,status').eq('session_date', date).in('student_id', ids);
    setAtt(Object.fromEntries((data || []).map((r) => [r.student_id, r.status])));
  };
  useEffect(() => { if (ids.length) load(); else setAtt({}); }, [date, ids.join(',')]); // eslint-disable-line
  const set = async (id, status) => {
    if (status === null) {
      setAtt((a) => { const n = { ...a }; delete n[id]; return n; });
      const { error } = await supabase.from('attendance').delete().eq('student_id', id).eq('session_date', date);
      if (error) { alert(error.message); load(); }
      return;
    }
    setAtt((a) => ({ ...a, [id]: status }));
    const { error } = await supabase.from('attendance').upsert({ student_id: id, session_date: date, status, recorded_by: me }, { onConflict: 'student_id,session_date' });
    if (error) { alert(error.message); load(); }
  };
  const all = async () => {
    const rows = students.filter((s) => !att[s.id]).map((s) => ({ student_id: s.id, session_date: date, status: 'Hadir', recorded_by: me }));
    if (!rows.length) return;
    const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'student_id,session_date' });
    if (error) return alert(error.message);
    load();
  };
  const clearAll = async () => {
    if (!confirm(`Kosongkan SEMUA kehadiran untuk ${date}?`)) return;
    const { error } = await supabase.from('attendance').delete().eq('session_date', date).in('student_id', ids);
    if (error) return alert(error.message);
    load();
  };
  const list = students.filter((s) => !q.trim() || `${s.id} ${s.full_name} ${s.short_name}`.toLowerCase().includes(q.trim().toLowerCase()));
  const c = (k) => Object.values(att).filter((v) => v === k).length;
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-amber-400">Kelas: Kehadiran, Berat & Catatan Latihan</h2>
        <span className="text-[11px] text-slate-400 self-center">Tarikh kelas:</span><input type="date" title="Tarikh kelas" className={inp} value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
      </div>
      <p className="text-[11px] text-slate-300">Hadir {c('Hadir')} • Lewat {c('Lewat')} • Tidak Hadir {c('Tidak Hadir')} • Belum ditanda {students.length - Object.keys(att).length}</p>
      <div className="flex gap-2">
        <input className={`${inp} flex-1`} placeholder="Cari pesilat (nama / ID)" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={all} className="px-3 py-2 rounded-lg bg-emerald-700 text-xs font-semibold">Semua yang belum = Hadir</button>
        <button onClick={clearAll} className="px-3 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-red-400">Kosongkan</button>
      </div>
      <p className="text-[10px] text-slate-500">Tekan nama pesilat untuk rekod berat & catatan latihan.</p>
      <div className="space-y-2">
        {list.map((s) => <Row key={s.id} s={s} status={att[s.id]} me={me} weightClass={weightClass} onSet={set} reload={reload} />)}
        {list.length === 0 && <p className="text-xs text-slate-400">Tiada pesilat.</p>}
      </div>
    </div>
  );
}
