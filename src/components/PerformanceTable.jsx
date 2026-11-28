import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';

const inp = 'px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs w-full';
const btn = 'px-3 py-1.5 rounded-lg text-xs font-semibold';
const card = 'bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3';
const TIER = { Beginner: 'Stripe 1', Intermediate: 'Stripe 2', Advanced: 'Stripe 3' };
const STAGE = { 1: 'Putih', 2: 'Hitam Belang Putih', 3: 'Hitam Penuh' };
const RANK = { 1: 'Juara 1', 2: 'Juara 2', 3: 'Juara 3', 4: 'Separuh Akhir', 5: 'Suku Akhir' };
const RESULT = { juara1: 'Juara 1', juara2: 'Juara 2', juara3: 'Juara 3', separuh_akhir: 'Separuh Akhir', suku_akhir: 'Suku Akhir', penyertaan: 'Penyertaan', menang: 'Menang', seri: 'Seri', kalah: 'Kalah' };
const KIND = { tournament: 'Kejohanan', open_friendly: 'Open Sparring Friendly', internal: 'Sparring Dalaman' };
const EVT_KIND = { 'Open Tournament': 'tournament', 'State/National Selection': 'tournament', 'Open Friendly Sparring': 'open_friendly', 'Internal Friendly': 'internal' };
const RESULTS_FOR = { tournament: ['juara1', 'juara2', 'juara3', 'separuh_akhir', 'suku_akhir', 'penyertaan'], open_friendly: ['menang', 'seri', 'kalah', 'penyertaan'], internal: ['menang', 'seri', 'kalah', 'penyertaan'] };
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');

/** Langkah seterusnya + peraturan yang terpakai untuk pesilat. */
function nextStep(r) {
  if (r.class_tier === 'Beginner') return { key: 'stripe_1_2', label: 'Naik ke Stripe 2' };
  if (r.class_tier === 'Intermediate') return { key: 'stripe_2_3', label: 'Naik ke Stripe 3' };
  if (r.bengkung_stage < 3) return { key: 'bengkung', label: `Naik Bengkung → ${STAGE[r.bengkung_stage + 1]}` };
  return null;
}

function evaluate(r, rules) {
  const step = nextStep(r);
  const attPct = r.att_n > 0 ? Math.round((r.att_ok / r.att_n) * 100) : null;
  if (!step) return { ...r, step, attPct, checks: [], layak: false, failed: [], maxed: true };
  const rule = rules[step.key];
  if (!rule) return { ...r, step, attPct, checks: [], layak: false, failed: [], noRule: true };
  const days = r.last_test_date ? Math.floor((Date.now() - new Date(r.last_test_date).getTime()) / 86400000) : null;
  const checks = [
    { k: 'Skor keseluruhan', ok: (r.overall_score ?? 0) >= rule.min_overall, val: r.overall_score ?? 0, need: `≥ ${rule.min_overall}` },
    { k: 'Kehadiran 60 hari', ok: r.att_n >= 4 && attPct >= rule.min_att, val: r.att_n >= 4 ? `${attPct}%` : 'data kurang', need: `≥ ${rule.min_att}%` },
    { k: 'Rekod kejohanan/friendly/dalaman (12 bulan)', ok: r.n_all >= rule.min_perf, val: r.n_all, need: `≥ ${rule.min_perf}` },
    { k: 'Purata penilaian prestasi', ok: r.avg_rating != null && Number(r.avg_rating) >= Number(rule.min_rating), val: r.avg_rating ?? '-', need: `≥ ${rule.min_rating}` },
    { k: 'Jarak dari ujian terakhir', ok: days == null || days >= rule.cooldown_days, val: days == null ? 'belum pernah' : `${days} hari`, need: `≥ ${rule.cooldown_days} hari` },
  ];
  const failed = checks.filter((c) => !c.ok);
  return { ...r, step, attPct, checks, failed, layak: failed.length === 0 };
}

export default function PerformanceTable({ branchId, branchName, tournaments, isAdmin, reload }) {
  const [rows, setRows] = useState([]);
  const [recs, setRecs] = useState([]);
  const [tests, setTests] = useState([]);
  const [rulesList, setRulesList] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [onlyLayak, setOnlyLayak] = useState(false);
  const [form, setForm] = useState(null); // 'result' | 'test'
  const [ai, setAi] = useState({});
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const [o, p, t, g] = await Promise.all([
      supabase.rpc('grading_overview'),
      supabase.from('performance_records').select('*').order('event_date', { ascending: false }).limit(2000),
      supabase.from('grading_tests').select('*').order('test_date', { ascending: false }).limit(1000),
      supabase.from('grading_rules').select('*'),
    ]);
    setRows(o.data || []); setRecs(p.data || []); setTests(t.data || []); setRulesList(g.data || []);
    setBusy(false);
  }, []);
  useEffect(() => { if (open) load(); }, [open, load]);

  const rules = useMemo(() => Object.fromEntries(rulesList.map((r) => [r.key, r])), [rulesList]);
  const list = useMemo(() => rows
    .filter((r) => !branchId || branchId === 'ALL' || r.branch_id === branchId)
    .map((r) => evaluate(r, rules))
    .filter((r) => (!onlyLayak || r.layak) && (!q.trim() || `${r.id} ${r.short_name} ${r.full_name}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, rules, branchId, onlyLayak, q]);
  const layak = list.filter((r) => r.layak);
  const nameOf = (id) => rows.find((r) => r.id === id)?.short_name || id;

  const exportXlsx = () => {
    const all = rows.filter((r) => !branchId || branchId === 'ALL' || r.branch_id === branchId).map((r) => evaluate(r, rules));
    const ids = new Set(all.map((r) => r.id));
    const wb = XLSX.utils.book_new();
    const add = (name, aoa, w) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = w.map((x) => ({ wch: x })); XLSX.utils.book_append_sheet(wb, ws, name); };
    add('Prestasi', [
      ['ID', 'Pesilat', 'Cawangan', 'Bengkung', 'Tahap', 'Skor Keseluruhan', 'Kehadiran 60h (%)', 'Kejohanan (bil)', 'Keputusan Terbaik', 'Open Friendly (bil)', 'Sparring Dalaman (bil)', 'Purata Penilaian', 'Purata Skor Latihan (/10)', 'Latihan Terkini', 'Tarikh Latihan', 'Cadangan Latihan', 'Ujian Terakhir', 'Langkah Seterusnya', 'Status'],
      ...all.map((r) => [r.id, r.short_name, branchName[r.branch_id] || '', STAGE[r.bengkung_stage], TIER[r.class_tier], r.overall_score ?? '', r.attPct ?? '', r.n_t, RANK[r.best_rank] || '-', r.n_o, r.n_i, r.avg_rating ?? '', r.avg_train ?? '', r.last_type || '', r.last_date ? fmt(r.last_date) : '', r.plan || '',
        r.last_test_date ? `${fmt(r.last_test_date)} (${r.last_test_result})` : '', r.step?.label || 'Tertinggi', r.layak ? 'LAYAK DICADANG UJIAN' : r.maxed ? 'Tertinggi' : `Belum (${r.failed.length} syarat)`]),
    ], [10, 22, 22, 18, 10, 10, 10, 10, 14, 10, 10, 10, 10, 12, 12, 36, 20, 30, 22]);
    add('Keputusan', [['Tarikh', 'Pesilat', 'Jenis', 'Tajuk', 'Keputusan', 'Menang', 'Kalah', 'Penilaian', 'Nota'],
      ...recs.filter((x) => ids.has(x.student_id)).map((x) => [x.event_date, nameOf(x.student_id), KIND[x.kind], x.title || '', RESULT[x.result] || '', x.wins, x.losses, x.rating ?? '', x.notes || ''])], [12, 22, 22, 28, 14, 8, 8, 10, 36]);
    add('Ujian', [['Tarikh', 'Pesilat', 'Jenis', 'Dari', 'Ke', 'Keputusan', 'Markah', 'Nota'],
      ...tests.filter((x) => ids.has(x.student_id)).map((x) => [x.test_date, nameOf(x.student_id), x.kind === 'stripe' ? 'Naik Stripe' : 'Naik Bengkung', `${STAGE[x.from_stage]} / ${TIER[x.from_tier]}`, `${STAGE[x.to_stage]} / ${TIER[x.to_tier]}`, x.result, x.score ?? '', x.notes || ''])], [12, 22, 14, 30, 30, 10, 8, 36]);
    add('Syarat', [['Langkah', 'Skor min', 'Kehadiran min (%)', 'Rekod min', 'Penilaian min', 'Jarak ujian (hari)'], ...rulesList.map((r) => [r.label, r.min_overall, r.min_att, r.min_perf, r.min_rating, r.cooldown_days])], [44, 10, 16, 10, 12, 16]);
    XLSX.writeFile(wb, `Prestasi_Pesilat_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const line = (r) => `${r.short_name} (${r.age || '?'}th) ${STAGE[r.bengkung_stage]}/${TIER[r.class_tier]}; skor ${r.overall_score ?? '-'}; hadir ${r.attPct ?? '-'}%; kejohanan ${r.n_t} (terbaik ${RANK[r.best_rank] || '-'}), friendly ${r.n_o}, dalaman ${r.n_i}; penilaian ${r.avg_rating ?? '-'}/10; latihan ${r.avg_train ?? '-'}/10; syarat gagal: ${r.failed.map((c) => c.k).join(', ') || 'tiada'}; langkah: ${r.step?.label || 'tertinggi'}`;
  async function analyse(items) {
    setAiBusy(true);
    for (let i = 0; i < items.length; i += 3) {
      const part = items.slice(i, i + 3);
      const content = `Analisis kelayakan ujian pesilat berikut HANYA berdasarkan data (jangan reka). Untuk setiap pesilat tulis 3 baris pendek: Cadangan (Cadang ujian / Belum sedia), Sebab, Fokus latihan 2 minggu. Biarkan actions kosong.\n${part.map((r, n) => `${n + 1}. ${line(r)}`).join('\n')}`;
      const { data, error } = await supabase.functions.invoke('ai-chat', { body: { messages: [{ role: 'user', content }] } });
      let text = data?.reply; let err = data?.error;
      if (error && !err) { try { err = (await error.context.json()).error; } catch (_) { err = error.message; } }
      const joined = err || text || '(tiada jawapan)';
      setAi((a) => ({ ...a, ...Object.fromEntries(part.map((r) => [r.id, { text: joined, names: part.map((x) => x.short_name).join(', '), err: !!err }])) }));
    }
    setAiBusy(false);
  }

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-amber-400">Jadual Prestasi & Cadangan Ujian</h2>
        <button onClick={() => setOpen(!open)} className={`${btn} ${open ? 'bg-slate-800' : 'bg-amber-500 text-slate-950'}`}>{open ? 'Tutup' : 'Buka Jadual'}</button>
      </div>
      <p className="text-[11px] text-slate-400">Hanya Master Admin, Admin dan Jurulatih. Skor dikemas kini automatik daripada rekod latihan, kejohanan, friendly dan sparring dalaman. Bengkung/stripe hanya berubah selepas ujian dilulus.</p>
      {open && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <input className={`${inp} sm:w-56`} placeholder="Cari pesilat" value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="text-xs text-slate-300 flex items-center gap-1.5"><input type="checkbox" checked={onlyLayak} onChange={(e) => setOnlyLayak(e.target.checked)} />Layak ujian sahaja</label>
            <button onClick={() => setForm({ type: 'result' })} className={`${btn} bg-emerald-600`}>+ Rekod Keputusan</button>
            <button onClick={() => setForm({ type: 'test' })} className={`${btn} bg-purple-700`}>+ Rekod Ujian</button>
            <button onClick={exportXlsx} className={`${btn} bg-slate-800 text-amber-300`}>Eksport Excel</button>
            <button onClick={load} className={`${btn} bg-slate-800`}>{busy ? '...' : 'Muat semula'}</button>
          </div>

          {form && <PerfForm form={form} rows={list.length ? list : rows} tournaments={tournaments} branchId={branchId} onClose={() => setForm(null)} onDone={() => { setForm(null); load(); reload && reload(); }} />}

          <div className="border border-emerald-700/50 rounded-lg p-3 space-y-2 bg-emerald-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-emerald-300">Cadangan Ujian ({layak.length})</p>
              {layak.length > 0 && <button disabled={aiBusy} onClick={() => analyse(layak.slice(0, 6))} className={`${btn} bg-amber-500 text-slate-950 disabled:opacity-50`}>{aiBusy ? 'AI sedang analisis...' : 'Analisis AI (maks 6)'}</button>}
            </div>
            {layak.length === 0 && <p className="text-[11px] text-slate-400">Tiada pesilat yang memenuhi semua syarat buat masa ini.</p>}
            {layak.map((r) => (
              <div key={r.id} className="bg-slate-950 rounded p-2 text-xs flex flex-wrap items-center justify-between gap-2">
                <span><b className="text-white">{r.short_name}</b> <span className="text-slate-400">• {STAGE[r.bengkung_stage]} / {TIER[r.class_tier]} •</span> <b className="text-emerald-300">{r.step.label}</b> <span className="text-slate-400">• skor {r.overall_score}</span></span>
                <span className="flex gap-1.5">
                  <button disabled={aiBusy} onClick={() => analyse([r])} className={`${btn} bg-slate-800 text-amber-300`}>AI</button>
                  <button onClick={() => setForm({ type: 'test', student: r.id })} className={`${btn} bg-purple-700`}>Rekod Ujian</button>
                </span>
              </div>
            ))}
            {Object.entries(ai).length > 0 && (
              <div className="space-y-2 pt-1">
                {[...new Map(Object.values(ai).map((v) => [v.names, v])).values()].map((v) => (
                  <div key={v.names} className={`rounded p-2 text-[11px] whitespace-pre-line ${v.err ? 'bg-red-950/50 text-red-200' : 'bg-slate-950 text-slate-200'}`}><b className="text-amber-300">{v.names}</b>{'\n'}{v.text}</div>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead className="text-left text-slate-400 border-b border-slate-800">
                <tr>{['Pesilat', 'Bengkung / Tahap', 'Skor', 'Hadir', 'Kejohanan', 'Friendly', 'Dalaman', 'Penilaian', 'Latihan semasa', 'Cadangan latihan', 'Ujian terakhir', 'Status'].map((h) => <th key={h} className="px-2 py-1.5 font-semibold whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/60 align-top">
                    <td className="px-2 py-1.5 whitespace-nowrap"><b className="text-white">{r.short_name}</b><br /><span className="text-slate-500">{branchName[r.branch_id] || ''}</span></td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{STAGE[r.bengkung_stage]}<br /><span className="text-slate-400">{TIER[r.class_tier]}</span></td>
                    <td className="px-2 py-1.5 font-bold text-amber-300">{r.overall_score ?? '-'}</td>
                    <td className="px-2 py-1.5">{r.attPct != null ? `${r.attPct}%` : '-'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.n_t}{r.best_rank ? <><br /><span className="text-slate-400">{RANK[r.best_rank]}</span></> : null}</td>
                    <td className="px-2 py-1.5">{r.n_o}</td>
                    <td className="px-2 py-1.5">{r.n_i}</td>
                    <td className="px-2 py-1.5">{r.avg_rating ?? '-'}</td>
                    <td className="px-2 py-1.5 max-w-[160px]">{r.last_type ? <>{r.last_type} <span className="text-slate-500">{fmt(r.last_date)}</span><br /><span className="text-slate-400">{r.last_notes}</span></> : '-'}</td>
                    <td className="px-2 py-1.5 max-w-[200px] text-slate-300">{r.plan || '-'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{r.last_test_date ? <>{fmt(r.last_test_date)}<br /><span className={r.last_test_result === 'lulus' ? 'text-emerald-400' : 'text-red-300'}>{r.last_test_result}</span></> : '-'}</td>
                    <td className="px-2 py-1.5 min-w-[170px]">
                      {r.maxed ? <span className="text-slate-400">Tahap tertinggi</span>
                        : r.layak ? <b className="text-emerald-300">Layak: {r.step.label}</b>
                        : <span className="text-amber-300" title={r.failed.map((c) => `${c.k}: ${c.val} (perlu ${c.need})`).join('\n')}>Belum ({r.failed.length} syarat)<br /><span className="text-slate-500">{r.failed.map((c) => c.k).slice(0, 2).join(', ')}</span></span>}
                    </td>
                  </tr>
                ))}
                {list.length === 0 && <tr><td colSpan={12} className="px-2 py-3 text-slate-400">Tiada data.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-300">Rekod Keputusan Terkini</p>
            {recs.slice(0, 8).map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-2 bg-slate-950 rounded p-2 text-[11px]">
                <span>{fmt(x.event_date)} • <b>{nameOf(x.student_id)}</b> • {KIND[x.kind]} {x.title ? `• ${x.title}` : ''} • {RESULT[x.result] || '-'}{x.rating != null ? ` • ${x.rating}/10` : ''}</span>
                {isAdmin && <button onClick={async () => { if (confirm('Padam rekod ini? Skor yang telah dikemas kini tidak diundur.')) { await supabase.from('performance_records').delete().eq('id', x.id); load(); } }} className={`${btn} bg-red-950 text-red-300`}>Padam</button>}
              </div>
            ))}
            {recs.length === 0 && <p className="text-[11px] text-slate-400">Belum ada rekod.</p>}
          </div>

          {isAdmin && <RulesEditor rules={rulesList} onSaved={load} />}
        </div>
      )}
    </div>
  );
}

function PerfForm({ form, rows, tournaments, branchId, onClose, onDone }) {
  const pool = rows.filter((r) => !branchId || branchId === 'ALL' || r.branch_id === branchId);
  const [sid, setSid] = useState(form.student || '');
  const [f, setF] = useState({ kind: 'tournament', tournament_id: '', event_date: new Date().toISOString().slice(0, 10), title: '', result: '', wins: 0, losses: 0, rating: '', notes: '' });
  const [t, setT] = useState({ date: new Date().toISOString().slice(0, 10), result: 'lulus', score: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const student = pool.find((r) => r.id === sid);
  const step = student ? nextStep(student) : null;
  const tlist = tournaments.filter((x) => EVT_KIND[x.event_type] === f.kind);

  const saveResult = async () => {
    if (!sid) return alert('Pilih pesilat.');
    if (!f.result && f.rating === '') return alert('Isi keputusan atau penilaian.');
    setSaving(true);
    const { error } = await supabase.from('performance_records').insert({
      student_id: sid, kind: f.kind, tournament_id: f.tournament_id || null, event_date: f.event_date, title: f.title.trim() || null,
      result: f.result || null, wins: Number(f.wins) || 0, losses: Number(f.losses) || 0, rating: f.rating === '' ? null : Number(f.rating), notes: f.notes.trim() || null,
    });
    setSaving(false);
    if (error) return alert('Ralat: ' + error.message);
    onDone();
  };
  const saveTest = async () => {
    if (!sid) return alert('Pilih pesilat.');
    if (!step) return alert('Pesilat sudah di tahap tertinggi.');
    if (!confirm(`${t.result === 'lulus' ? `Lulus: ${student.short_name} akan ${step.label.toLowerCase()}.` : 'Gagal: tiada perubahan bengkung/stripe.'} Teruskan?`)) return;
    setSaving(true);
    const { error } = await supabase.rpc('record_grading_test', { p_student: sid, p_date: t.date, p_result: t.result, p_score: t.score === '' ? null : Number(t.score), p_notes: t.notes });
    setSaving(false);
    if (error) return alert('Ralat: ' + error.message);
    onDone();
  };

  return (
    <div className="bg-slate-950 border border-slate-700 rounded-lg p-3 space-y-2 text-xs">
      <p className="font-bold text-amber-300">{form.type === 'result' ? 'Rekod Keputusan (kejohanan / friendly / sparring dalaman)' : 'Rekod Ujian Naik Tahap / Bengkung'}</p>
      <select className={inp} value={sid} onChange={(e) => setSid(e.target.value)}>
        <option value="">— Pilih pesilat —</option>
        {pool.map((r) => <option key={r.id} value={r.id}>{r.short_name} ({STAGE[r.bengkung_stage]} / {TIER[r.class_tier]})</option>)}
      </select>
      {form.type === 'result' ? (
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="space-y-1"><span className="text-slate-400">Jenis</span>
            <select className={inp} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, tournament_id: '', result: '' })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="space-y-1"><span className="text-slate-400">Pilih acara (pilihan)</span>
            <select className={inp} value={f.tournament_id} onChange={(e) => { const tt = tournaments.find((x) => x.id === e.target.value); setF({ ...f, tournament_id: e.target.value, title: tt?.title || f.title, event_date: tt?.event_date || f.event_date }); }}>
              <option value="">— Tiada / lain-lain —</option>{tlist.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
          <label className="space-y-1"><span className="text-slate-400">Tarikh</span><input type="date" className={inp} value={f.event_date} onChange={(e) => setF({ ...f, event_date: e.target.value })} /></label>
          <label className="space-y-1 sm:col-span-2"><span className="text-slate-400">Tajuk / lawan</span><input className={inp} placeholder="Cth: Kejohanan Terbuka Selangor, lawan Amir" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
          <label className="space-y-1"><span className="text-slate-400">Keputusan</span>
            <select className={inp} value={f.result} onChange={(e) => setF({ ...f, result: e.target.value })}><option value="">—</option>{RESULTS_FOR[f.kind].map((k) => <option key={k} value={k}>{RESULT[k]}</option>)}</select></label>
          <label className="space-y-1"><span className="text-slate-400">Menang (perlawanan)</span><input type="number" min="0" className={inp} value={f.wins} onChange={(e) => setF({ ...f, wins: e.target.value })} /></label>
          <label className="space-y-1"><span className="text-slate-400">Kalah (perlawanan)</span><input type="number" min="0" className={inp} value={f.losses} onChange={(e) => setF({ ...f, losses: e.target.value })} /></label>
          <label className="space-y-1"><span className="text-slate-400">Penilaian jurulatih (0-10)</span><input type="number" min="0" max="10" step="0.5" className={inp} placeholder="Cth: 7.5" value={f.rating} onChange={(e) => setF({ ...f, rating: e.target.value })} /></label>
          <label className="space-y-1 sm:col-span-2"><span className="text-slate-400">Nota</span><input className={inp} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></label>
          <div className="sm:col-span-3 flex gap-2"><button disabled={saving} onClick={saveResult} className={`${btn} bg-emerald-600`}>Simpan & kemas kini skor</button><button onClick={onClose} className={`${btn} bg-slate-800`}>Batal</button></div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-3 gap-2">
          <p className="sm:col-span-3 text-slate-300">{student ? (step ? <>Ujian ini: <b className="text-emerald-300">{step.label}</b></> : 'Pesilat sudah di tahap tertinggi.') : 'Pilih pesilat untuk melihat jenis ujian.'}</p>
          <label className="space-y-1"><span className="text-slate-400">Tarikh ujian</span><input type="date" className={inp} value={t.date} onChange={(e) => setT({ ...t, date: e.target.value })} /></label>
          <label className="space-y-1"><span className="text-slate-400">Keputusan</span><select className={inp} value={t.result} onChange={(e) => setT({ ...t, result: e.target.value })}><option value="lulus">Lulus</option><option value="gagal">Gagal</option></select></label>
          <label className="space-y-1"><span className="text-slate-400">Markah ujian (0-100)</span><input type="number" min="0" max="100" className={inp} value={t.score} onChange={(e) => setT({ ...t, score: e.target.value })} /></label>
          <label className="space-y-1 sm:col-span-3"><span className="text-slate-400">Nota penguji</span><input className={inp} value={t.notes} onChange={(e) => setT({ ...t, notes: e.target.value })} /></label>
          <div className="sm:col-span-3 flex gap-2"><button disabled={saving} onClick={saveTest} className={`${btn} bg-purple-700`}>Simpan Keputusan Ujian</button><button onClick={onClose} className={`${btn} bg-slate-800`}>Batal</button></div>
        </div>
      )}
    </div>
  );
}

function RulesEditor({ rules, onSaved }) {
  const [v, setV] = useState(rules);
  useEffect(() => setV(rules), [rules]);
  const set = (key, field, val) => setV(v.map((r) => (r.key === key ? { ...r, [field]: val } : r)));
  const order = ['stripe_1_2', 'stripe_2_3', 'bengkung'];
  return (
    <div className="space-y-2 border-t border-slate-800 pt-3">
      <p className="text-xs font-bold text-amber-300">Syarat Cadangan Ujian (Master Admin)</p>
      {[...v].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key)).map((r) => (
        <div key={r.key} className="bg-slate-950 rounded p-2 grid grid-cols-2 sm:grid-cols-6 gap-2 items-end text-[11px]">
          <p className="col-span-2 sm:col-span-1 font-semibold text-white">{r.label}</p>
          {[['min_overall', 'Skor min'], ['min_att', 'Hadir min %'], ['min_perf', 'Rekod min'], ['min_rating', 'Penilaian min'], ['cooldown_days', 'Jarak ujian (hari)']].map(([f, l]) => (
            <label key={f} className="space-y-0.5"><span className="text-slate-400">{l}</span><input type="number" step="0.5" className={inp} value={r[f]} onChange={(e) => set(r.key, f, e.target.value)} /></label>
          ))}
        </div>
      ))}
      <button className={`${btn} bg-emerald-600`} onClick={async () => {
        for (const r of v) {
          const { error } = await supabase.from('grading_rules').update({ min_overall: Number(r.min_overall), min_att: Number(r.min_att), min_perf: Number(r.min_perf), min_rating: Number(r.min_rating), cooldown_days: Number(r.cooldown_days) }).eq('key', r.key);
          if (error) return alert('Ralat: ' + error.message);
        }
        onSaved();
      }}>Simpan Syarat</button>
    </div>
  );
}
