import React from 'react';

export default function BengkungVisualizer({ classTier = 'Beginner', ageCategory = '', bengkungStage = 1 }) {
  const stripes = classTier === 'Advanced' ? 3 : classTier === 'Intermediate' ? 2 : 1;
  const isRemaja = ageCategory.includes('13-17');
  const stage = isRemaja ? (bengkungStage || 1) : 1;

  let beltStyle = 'bg-white border-slate-300 text-slate-900';
  let stageLabel = 'Bengkung Putih';
  if (stage === 2) {
    beltStyle = 'bg-slate-950 border-slate-700 text-white';
    stageLabel = 'Tahap 2: Hitam Belang Putih';
  } else if (stage === 3) {
    beltStyle = 'bg-black border-amber-500 text-amber-300';
    stageLabel = 'Tahap 3: Hitam Penuh';
  }

  return (
    <div className="space-y-1">
      <div className={`relative h-7 w-full rounded border ${beltStyle} flex items-center justify-between px-3 overflow-hidden shadow-inner`}>
        {stage === 2 && (
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-white opacity-95 pointer-events-none" />
        )}
        <span className="relative z-10 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/50 text-amber-300">
          {stageLabel}
        </span>
        <div className="relative z-10 flex items-center gap-1 pr-1">
          {Array.from({ length: stripes }).map((_, i) => (
            <span
              key={i}
              className={`inline-block w-1.5 h-5 rounded-sm ${stage === 1 ? 'bg-emerald-700' : 'bg-amber-400'}`}
            />
          ))}
        </div>
      </div>
      <p className="text-[11px] text-slate-400">
        {classTier} • {stripes} Stripe Hujung Tali
      </p>
    </div>
  );
}
