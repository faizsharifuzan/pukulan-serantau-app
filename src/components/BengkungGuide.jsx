import React from 'react';

/* Satu bengkung: warna asas, garisan tengah (pilihan) dan stripe hujung tali. */
function Belt({ base, line, stripes = 0, stripeColor = 'bg-amber-400', border = 'border-slate-600' }) {
  return (
    <div className={`relative h-6 w-full rounded border ${border} ${base} overflow-hidden shadow-inner flex items-center justify-end px-2`}>
      {line && <div className={`absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 ${line}`} />}
      <div className="relative z-10 flex items-center gap-1">
        {Array.from({ length: stripes }).map((_, i) => <span key={i} className={`inline-block w-1.5 h-4 rounded-sm ${stripeColor}`} />)}
      </div>
    </div>
  );
}

const STRIPE = ['Stripe 1 (Pemula)', 'Stripe 2 (Pertengahan)', 'Stripe 3 (Mahir)'];

const LEVELS = [
  { no: 'Tahap 1', name: 'Bengkung Putih', base: 'bg-white', border: 'border-slate-300', stripeColor: 'bg-emerald-700', stripes: true },
  { no: 'Tahap 2', name: 'Hitam Belang Putih', base: 'bg-slate-950', line: 'bg-white', border: 'border-slate-600', stripes: true, note: 'Kategori Remaja (13-17 tahun)' },
  { no: 'Tahap 3', name: 'Hitam Penuh', base: 'bg-black', border: 'border-amber-500', stripes: true, note: 'Kategori Remaja (13-17 tahun)' },
];

const TEACHERS = [
  { no: 'Selepas Tahap 3', name: 'Pembantu Jurulatih', desc: 'Bengkung hitam, garisan merah di tengah. Tahap mengikut bilangan stripe.', base: 'bg-black', line: 'bg-red-600', border: 'border-red-700', stripes: true },
  { no: 'Jurulatih', name: 'Jurulatih', desc: 'Bengkung merah penuh, tanpa stripe.', base: 'bg-red-600', border: 'border-red-400', stripes: false },
  { no: 'Guru', name: 'Guru', desc: 'Bengkung merah, garisan hitam di tengah.', base: 'bg-red-600', line: 'bg-black', border: 'border-red-400', stripes: false },
];

function Row({ item, children }) {
  return (
    <div className="bg-slate-950 rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <p className="text-xs font-bold text-white">{item.name}</p>
        <p className="text-[10px] text-amber-300 font-semibold">{item.no}</p>
      </div>
      {children}
      {(item.note || item.desc) && <p className="text-[11px] text-slate-400">{item.desc || item.note}</p>}
    </div>
  );
}

export default function BengkungGuide() {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-400">Setiap tahap mempunyai 3 peringkat mengikut bilangan stripe di hujung tali.</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {LEVELS.map((l) => (
          <Row key={l.no} item={l}>
            <div className="space-y-1.5">
              {[1, 2, 3].map((n) => (
                <div key={n}>
                  <Belt base={l.base} line={l.line} border={l.border} stripes={n} stripeColor={l.stripeColor} />
                  <p className="text-[10px] text-slate-500 mt-0.5">{STRIPE[n - 1]}</p>
                </div>
              ))}
            </div>
          </Row>
        ))}
      </div>
      <p className="text-xs font-bold text-amber-300 pt-1">Bengkung Pengajar</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {TEACHERS.map((l) => (
          <Row key={l.name} item={l}>
            {l.stripes ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map((n) => (
                  <div key={n}>
                    <Belt base={l.base} line={l.line} border={l.border} stripes={n} />
                    <p className="text-[10px] text-slate-500 mt-0.5">Stripe {n}</p>
                  </div>
                ))}
              </div>
            ) : <Belt base={l.base} line={l.line} border={l.border} />}
          </Row>
        ))}
      </div>
    </div>
  );
}
