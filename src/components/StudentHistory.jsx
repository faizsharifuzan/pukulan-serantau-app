import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function StudentHistory({ students }) {
  const [d, setD] = useState({ att: [], logs: [], w: [] });
  const ids = students.map((s) => s.id);
  useEffect(() => {
    if (!ids.length) return;
    Promise.all([
      supabase.from('attendance').select('*').in('student_id', ids).order('session_date', { ascending: false }).limit(300),
      supabase.from('training_logs').select('*').in('student_id', ids).order('created_at', { ascending: false }).limit(100),
      supabase.from('weight_logs').select('*').in('student_id', ids).order('recorded_at', { ascending: false }).limit(100),
    ]).then(([a, l, w]) => setD({ att: a.data || [], logs: l.data || [], w: w.data || [] }));
  }, [ids.join(',')]); // eslint-disable-line
  if (!students.length) return <p className="text-xs text-slate-400">Pautkan pesilat di tab utama dahulu.</p>;
  return (
    <div className="space-y-4">
      {students.map((s) => {
        const a = d.att.filter((x) => x.student_id === s.id);
        const present = a.filter((x) => x.status !== 'Tidak Hadir').length;
        return (
          <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-amber-400">{s.full_name || s.short_name}</h2>
              <span className="text-slate-300">Kehadiran {a.length ? Math.round((present / a.length) * 100) : 0}% ({present}/{a.length})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {a.slice(0, 20).map((x) => (
                <span key={x.id} title={x.status} className={`px-1.5 py-0.5 rounded text-[10px] ${x.status === 'Hadir' ? 'bg-emerald-900 text-emerald-300' : x.status === 'Lewat' ? 'bg-amber-900 text-amber-300' : 'bg-red-900 text-red-300'}`}>
                  {x.session_date.slice(5)} {x.status[0]}
                </span>
              ))}
              {a.length === 0 && <span className="text-slate-500">Belum ada rekod kehadiran.</span>}
            </div>
            <div>
              <p className="font-semibold text-slate-300 mb-1">Catatan Latihan</p>
              {d.logs.filter((x) => x.student_id === s.id).slice(0, 8).map((x) => (
                <p key={x.id} className="bg-slate-950 rounded p-2 mb-1"><b>{new Date(x.created_at).toLocaleDateString('ms-MY')} • {x.session_type}</b>{x.score_awarded != null ? ` • skor ${x.score_awarded}/10` : ''}<br />{x.raw_notes}</p>
              ))}
              {d.logs.filter((x) => x.student_id === s.id).length === 0 && <p className="text-slate-500">Tiada catatan.</p>}
            </div>
            <div>
              <p className="font-semibold text-slate-300 mb-1">Sejarah Berat</p>
              <p className="text-slate-400">{d.w.filter((x) => x.student_id === s.id).slice(0, 8).map((x) => `${new Date(x.recorded_at).toLocaleDateString('ms-MY')}: ${x.weight_kg}kg`).join(' • ') || 'Tiada rekod.'}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
