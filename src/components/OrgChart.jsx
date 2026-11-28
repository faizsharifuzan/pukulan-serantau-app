import React from 'react';

const Box = ({ o, tone = 'main' }) => (
  <div className={`rounded-lg text-center border ${tone === 'top' ? 'p-2.5 border-amber-400/60 bg-amber-500/10' : tone === 'sub' ? 'px-1.5 py-1 border-slate-700 bg-slate-950' : 'p-2 border-amber-500/30 bg-slate-950'}`}>
    <p className="text-[9px] sm:text-[10px] text-emerald-400 font-semibold uppercase leading-tight">{o.role}</p>
    <p className={`${tone === 'sub' ? 'text-[11px]' : 'text-xs sm:text-sm'} font-bold text-white leading-tight break-words`}>{o.name}</p>
    {o.branch && <p className="text-[9px] text-slate-400 leading-tight">{o.branch}</p>}
  </div>
);

export default function OrgChart({ org = [] }) {
  const lv = (n) => org.filter((o) => (o.level ?? 2) === n);
  const gurus = lv(2);
  const orphan = lv(3).filter((o) => !gurus.some((g) => g.name === o.under));
  const Line = () => <div className="mx-auto w-px h-3 bg-amber-500/40" />;
  return (
    <div className="space-y-0">
      {lv(0).length > 0 && <div className="max-w-[220px] mx-auto space-y-1.5">{lv(0).map((o, i) => <Box key={i} o={o} tone="top" />)}</div>}
      {lv(1).length > 0 && <><Line /><div className="grid grid-cols-2 gap-2 max-w-sm mx-auto">{lv(1).map((o, i) => <Box key={i} o={o} />)}</div></>}
      {gurus.length > 0 && <Line />}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {gurus.map((g, i) => {
          const kids = lv(3).filter((o) => o.under === g.name);
          return (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/60 p-1.5 space-y-1">
              <Box o={g} />
              {kids.length > 0 && <div className="pl-2 border-l-2 border-amber-500/30 space-y-1">{kids.map((o, k) => <Box key={k} o={o} tone="sub" />)}</div>}
            </div>
          );
        })}
      </div>
      {orphan.length > 0 && <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 pt-2">{orphan.map((o, k) => <Box key={k} o={o} tone="sub" />)}</div>}
    </div>
  );
}
