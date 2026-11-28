import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Upload, X, Star } from 'lucide-react';

export const imagesOf = (item, legacyKey) => {
  const arr = Array.isArray(item?.images) ? item.images.filter(Boolean) : [];
  if (arr.length) return arr;
  return item?.[legacyKey] ? [item[legacyKey]] : [];
};

/** Label kecil di atas medan borang supaya pengguna faham apa perlu diisi */
export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block text-left ${className}`}>
      <span className="block text-[11px] font-semibold text-slate-300 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-slate-500 mt-0.5">{hint}</span>}
    </label>
  );
}

/** Paparan galeri gambar (carousel ringkas) */
export function ImageGallery({ images, alt = '', height = 'h-44' }) {
  const list = (images || []).filter(Boolean);
  const [i, setI] = useState(0);
  if (!list.length) return null;
  const idx = Math.min(i, list.length - 1);
  const go = (d) => setI((idx + d + list.length) % list.length);
  return (
    <div className="relative bg-black">
      <img src={list[idx]} alt={alt} loading="lazy" className={`w-full ${height} object-cover`} />
      {list.length > 1 && (
        <>
          <button type="button" aria-label="Gambar sebelum" onClick={() => go(-1)} className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/60 text-white"><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" aria-label="Gambar seterusnya" onClick={() => go(1)} className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/60 text-white"><ChevronRight className="w-4 h-4" /></button>
          <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
            {list.map((_, k) => <button key={k} type="button" aria-label={`Gambar ${k + 1}`} onClick={() => setI(k)} className={`w-1.5 h-1.5 rounded-full ${k === idx ? 'bg-amber-400' : 'bg-white/50'}`} />)}
          </div>
          <span className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">{idx + 1}/{list.length}</span>
        </>
      )}
    </div>
  );
}

/** Muat naik beberapa gambar; gambar pertama = gambar utama */
export function ImageUploader({ images, onChange, upload, folder, max = 8, label = 'Gambar' }) {
  const list = (images || []).filter(Boolean);
  const [busy, setBusy] = useState(false);
  const add = async (files) => {
    const room = max - list.length;
    if (room <= 0) return alert(`Maksimum ${max} gambar.`);
    setBusy(true);
    const out = [...list];
    for (const f of Array.from(files).slice(0, room)) {
      const url = await upload(f, folder);
      if (url) out.push(url);
    }
    setBusy(false);
    onChange(out);
  };
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-slate-300">{label} <span className="font-normal text-slate-500">(boleh pilih beberapa gambar; gambar pertama = gambar utama; maks {max})</span></p>
      <div className="flex flex-wrap gap-2">
        {list.map((u, k) => (
          <div key={u} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-700">
            <img src={u} alt="" className="w-full h-full object-cover" />
            <button type="button" title="Buang" onClick={() => onChange(list.filter((x) => x !== u))} className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 text-red-300"><X className="w-3 h-3" /></button>
            {k > 0 ? (
              <button type="button" title="Jadikan gambar utama" onClick={() => onChange([u, ...list.filter((x) => x !== u)])} className="absolute bottom-0.5 left-0.5 p-0.5 rounded-full bg-black/70 text-amber-300"><Star className="w-3 h-3" /></button>
            ) : <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-amber-500 text-slate-950 font-bold">UTAMA</span>}
          </div>
        ))}
        <label className={`w-20 h-20 rounded-lg border border-dashed border-slate-600 flex flex-col items-center justify-center text-[10px] text-slate-400 cursor-pointer hover:border-amber-400 ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload className="w-4 h-4 text-amber-400 mb-0.5" />{busy ? 'Memuat...' : 'Tambah'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) add(e.target.files); e.target.value = ''; }} />
        </label>
      </div>
    </div>
  );
}
