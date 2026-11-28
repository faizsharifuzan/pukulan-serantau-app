import React, { useEffect, useRef, useState } from 'react';
import { Send, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getPersilatWeightClass } from '../lib/persilat';

const SCORE_KEYS = ['seni', 'power', 'speed', 'combat', 'agility', 'stamina', 'strength', 'tactical'];
const rm = (n) => `RM${Number(n || 0).toFixed(2)}`;

function describe(a, nm, bn) {
  switch (a.type) {
    case 'attendance': return `Kehadiran ${a.status} (${a.date}): ${a.student_ids.map(nm).join(', ')}`;
    case 'training_note': return `Catatan ${a.session_type} untuk ${nm(a.student_id)}: "${a.notes}"${a.score != null ? ` (skor ${a.score}/10)` : ''}`;
    case 'weight': return `Berat ${nm(a.student_id)}: ${a.kg}kg`;
    case 'scores': return `Kemas kini ${nm(a.student_id)}: ${Object.entries(a.scores).map(([k, v]) => `${k}=${v}`).join(', ')}${a.class_tier ? `, tahap ${a.class_tier}` : ''}${a.bengkung_stage ? `, bengkung ${a.bengkung_stage}` : ''}`;
    case 'tournament': return `Cipta kejohanan "${a.title}" (${a.event_type}) ${a.event_date}, ${rm(a.entry_fee)}, cawangan ${bn(a.branch_id)}`;
    case 'branch_fee': return `Yuran ${a.fee_code} cawangan ${bn(a.branch_id)}: ${rm(a.amount)}${a.active ? '' : ' (dimatikan)'}`;
    default: return a.type;
  }
}

async function run(a, me, students, isAssistant) {
  if (isAssistant && !['attendance', 'training_note', 'weight'].includes(a.type)) return { error: { message: 'Tidak dibenarkan untuk pembantu jurulatih' } };
  const st = (id) => students.find((s) => s.id === id);
  if (a.type === 'attendance')
    return supabase.from('attendance').upsert(a.student_ids.map((id) => ({ student_id: id, session_date: a.date, status: a.status, recorded_by: me })), { onConflict: 'student_id,session_date' });
  if (a.type === 'training_note')
    return supabase.from('training_logs').insert({ student_id: a.student_id, coach_id: me, session_type: a.session_type, raw_notes: a.notes, score_awarded: a.score });
  if (a.type === 'weight') {
    const s = st(a.student_id);
    const wc = getPersilatWeightClass(s?.age || 12, a.kg);
    const r = await supabase.from('weight_logs').insert({ student_id: a.student_id, weight_kg: a.kg, weight_class: wc, recorded_by: me });
    if (r.error) return r;
    return supabase.from('students').update({ current_weight: a.kg, weight_class: wc, weight_updated_at: new Date().toISOString() }).eq('id', a.student_id);
  }
  if (a.type === 'scores') {
    const s = st(a.student_id);
    const scores = { ...Object.fromEntries(SCORE_KEYS.map((k) => [k, 60])), ...(s?.scores || {}), ...a.scores };
    const patch = { scores, overall_score: Math.round(SCORE_KEYS.reduce((t, k) => t + Number(scores[k]), 0) / SCORE_KEYS.length) };
    if (a.class_tier) patch.class_tier = a.class_tier;
    if (a.bengkung_stage) patch.bengkung_stage = a.bengkung_stage;
    return supabase.from('students').update(patch).eq('id', a.student_id);
  }
  if (a.type === 'tournament')
    return supabase.from('tournaments').insert({ title: a.title, event_type: a.event_type, event_date: a.event_date, location: a.location, entry_fee: a.entry_fee, branch_id: a.branch_id, description: a.description, created_by: me });
  if (a.type === 'branch_fee')
    return supabase.from('branch_fees').upsert({ branch_id: a.branch_id, fee_code: a.fee_code, amount: a.amount, active: a.active, updated_at: new Date().toISOString() }, { onConflict: 'branch_id,fee_code' });
  return { error: { message: 'Tindakan tidak dikenali' } };
}

export default function AIChat({ isAssistant = false, me, isStaff, isAdmin, students, branchName, reload }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [diag, setDiag] = useState(null);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);
  const nm = (id) => students.find((s) => s.id === id)?.short_name || id;
  const bn = (id) => branchName[id] || id;

  async function send(t) {
    const content = (t ?? text).trim();
    if (!content || busy) return;
    const next = [...msgs, { role: 'user', content }];
    setMsgs(next); setText(''); setBusy(true);
    const { data, error } = await supabase.functions.invoke('ai-chat', { body: { messages: next.map(({ role, content }) => ({ role, content })) } });
    let err = data?.error; let tried = data?.tried;
    if (error && !err) { try { const b = await error.context.json(); err = b.error; tried = b.tried; } catch (_) { err = error.message; } }
    if (err && isAdmin && tried?.length) err += `\n[Admin] Percubaan gagal: ${tried.join(', ')}`;
    setBusy(false);
    if (err) return setMsgs([...next, { role: 'assistant', content: err, error: true }]);
    setMsgs([...next, { role: 'assistant', content: data.reply || '(tiada jawapan)', actions: (data.actions || []).map((a) => ({ a, state: 'pending' })) }]);
  }

  async function confirm(mi, ai) {
    const item = msgs[mi].actions[ai];
    const res = await run(item.a, me, students, isAssistant);
    setMsgs((m) => m.map((x, i) => i !== mi ? x : { ...x, actions: x.actions.map((y, k) => k !== ai ? y : { ...y, state: res.error ? 'error' : 'done', msg: res.error?.message }) }));
    if (!res.error) reload();
  }
  const skip = (mi, ai) => setMsgs((m) => m.map((x, i) => i !== mi ? x : { ...x, actions: x.actions.map((y, k) => k !== ai ? y : { ...y, state: 'skipped' }) }));
  const confirmAll = async (mi) => { for (let k = 0; k < msgs[mi].actions.length; k++) if (msgs[mi].actions[k].state === 'pending') await confirm(mi, k); };

  const quick = isStaff
    ? ['Siapa pesilat yang kerap tidak hadir bulan ini?', 'Tandakan semua pesilat Hadir hari ini', 'Apakah kejohanan akan datang?']
    : ['Cadangan latihan harian untuk hari ini', 'Apa yang perlu ditambah baik?', 'Analisis kehadiran dan berat badan'];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-amber-400">Pembantu AI {isStaff ? '(Jurulatih/Admin)' : ''}</h2>
        {isAdmin && (
          <button onClick={async () => { setDiag(['Menguji...']); const { data, error } = await supabase.functions.invoke('ai-chat', { body: { diag: true } }); setDiag(data?.diag || [error?.message || 'Gagal']); }} className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] text-slate-300">Uji sambungan AI</button>
        )}
      </div>
      {diag && <pre className="text-[10px] bg-slate-950 rounded p-2 whitespace-pre-wrap text-slate-300">{diag.join('\n')}</pre>}
      <p className="text-[10px] text-slate-500">
        {isStaff ? 'AI hanya mencadang; tiada perubahan berlaku sehingga anda tekan Sahkan. Akses anda dihadkan mengikut cawangan.' : 'AI hanya melihat data pesilat anda. Ini cadangan umum, bukan nasihat perubatan.'}
      </p>
      <div className="max-h-[55vh] overflow-y-auto space-y-2">
        {msgs.length === 0 && <div className="flex flex-wrap gap-2">{quick.map((q) => <button key={q} onClick={() => send(q)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-[11px] text-emerald-300 text-left">{q}</button>)}</div>}
        {msgs.map((m, mi) => (
          <div key={mi} className={`text-xs rounded-lg p-3 whitespace-pre-wrap ${m.role === 'user' ? 'bg-emerald-900/50 ml-8' : m.error ? 'bg-red-950/60 text-red-200 mr-8' : 'bg-slate-950 mr-8'}`}>
            {m.content}
            {m.actions?.length > 0 && (
              <div className="mt-2 space-y-1.5 border-t border-slate-800 pt-2">
                <p className="font-semibold text-amber-300">Tindakan dicadangkan:</p>
                {m.actions.map((x, ai) => (
                  <div key={ai} className="flex items-start justify-between gap-2 bg-slate-900 rounded p-2">
                    <span className={x.state === 'skipped' ? 'line-through text-slate-500' : ''}>{describe(x.a, nm, bn)}{x.state === 'error' && <b className="text-red-400"> — gagal: {x.msg}</b>}</span>
                    {x.state === 'pending' && (
                      <span className="flex gap-1 shrink-0">
                        <button onClick={() => confirm(mi, ai)} className="p-1.5 rounded bg-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => skip(mi, ai)} className="p-1.5 rounded bg-slate-700"><X className="w-3.5 h-3.5" /></button>
                      </span>
                    )}
                    {x.state === 'done' && <span className="text-emerald-400 shrink-0">✓ Siap</span>}
                  </div>
                ))}
                {m.actions.filter((x) => x.state === 'pending').length > 1 && <button onClick={() => confirmAll(mi)} className="px-3 py-1.5 rounded-lg bg-emerald-600 font-semibold">Sahkan Semua</button>}
              </div>
            )}
          </div>
        ))}
        {busy && <p className="text-xs text-slate-400">AI sedang berfikir...</p>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
        <input className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs" placeholder={isStaff ? 'Cth: tandakan AMIR dan SITI lewat hari ini' : 'Tanya tentang latihan anak anda...'} value={text} onChange={(e) => setText(e.target.value)} />
        <button disabled={busy} className="px-3 py-2 rounded-lg bg-emerald-600 disabled:opacity-50"><Send className="w-4 h-4" /></button>
      </form>
    </div>
  );
}
