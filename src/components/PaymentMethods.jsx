import React, { useState } from 'react';
import { Landmark, QrCode, CreditCard, Copy, Check, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { rm } from './PaymentUI';

const MAX = 5 * 1024 * 1024;
const OK_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function BankLogo({ url, name }) {
  return url ? (
    <img src={url} alt={name} className="h-12 w-auto max-w-[120px] rounded bg-white p-1 object-contain" />
  ) : (
    <div className="h-12 w-12 rounded-lg bg-slate-800 border border-slate-700 grid place-items-center" title={name}>
      <Landmark className="w-6 h-6 text-amber-400" />
    </div>
  );
}

export default function PaymentMethods({ info, items, cartTotal, session, onFpx, onDone, busy, setBusy }) {
  const fpxOn = !!info?.fpx_enabled;
  const [method, setMethod] = useState('bank_transfer');
  const [file, setFile] = useState(null);
  const [ref, setRef] = useState('');
  const [agree, setAgree] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(info.account_no); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (_) { /* ignore */ }
  };
  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!OK_TYPES.includes(f.type)) { e.target.value = ''; return alert('Format tidak disokong. Gunakan PDF, JPG atau PNG.'); }
    if (f.size > MAX) { e.target.value = ''; return alert('Saiz fail melebihi 5MB.'); }
    setFile(f);
  };

  async function submitManual() {
    if (!file) return alert('Sila muat naik resit pembayaran (PDF).');
    if (!agree) return alert('Sila tandakan pengesahan pembayaran.');
    setBusy(true);
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
    const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`;
    try {
      const up = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) return alert('Gagal muat naik resit: ' + up.error.message);
      const { data, error } = await supabase.rpc('create_payment_order', {
        p_items: items, p_method: method, p_bank_ref: ref.trim() || null, p_receipt: path,
      });
      if (error) { await supabase.storage.from('receipts').remove([path]); return alert(error.message); }
      setFile(null); setRef(''); setAgree(false);
      onDone(data);
    } finally { setBusy(false); }
  }

  const tab = (id, label, Icon, disabled) => (
    <button key={id} disabled={disabled} onClick={() => setMethod(id)}
      className={`flex-1 min-w-[100px] px-2 py-2 rounded-lg text-[11px] font-semibold flex flex-col items-center gap-1 border ${
        method === id ? 'bg-emerald-700 border-emerald-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  return (
    <div className="space-y-3 pt-2">
      <p className="text-xs font-bold text-amber-400">Pilih Kaedah Pembayaran</p>
      <div className="flex gap-2">
        {tab('fpx', fpxOn ? 'FPX Online' : 'FPX (belum aktif)', CreditCard, !fpxOn)}
        {tab('bank_transfer', 'Direct Transfer', Landmark, false)}
        {tab('duitnow_qr', 'DuitNow QR', QrCode, false)}
      </div>

      {method === 'fpx' && fpxOn && (
        <button disabled={busy} onClick={onFpx} className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold text-xs">
          {busy ? 'Memproses...' : `Bayar ${rm(cartTotal)} melalui FPX`}
        </button>
      )}

      {method === 'bank_transfer' && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
          <p className="text-[11px] text-slate-400">Pindahkan <b className="text-amber-300">{rm(cartTotal)}</b> ke akaun kelab:</p>
          <div className="flex items-center gap-3">
            <BankLogo url={info?.bank_logo_url} name={info?.bank_name} />
            <div className="flex-1">
              <p className="text-sm font-bold text-white">{info?.bank_name || 'Bank'}</p>
              <p className="text-[11px] text-slate-300">{info?.account_name}</p>
              <p className="text-lg font-mono font-bold text-emerald-400 tracking-wider">{info?.account_no}</p>
            </div>
            <button onClick={copy} className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-[11px] flex items-center gap-1">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Disalin' : 'Salin'}
            </button>
          </div>
        </div>
      )}

      {method === 'duitnow_qr' && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 text-center">
          <p className="text-[11px] text-slate-400">Imbas kod QR DuitNow dan bayar <b className="text-amber-300">{rm(cartTotal)}</b></p>
          {info?.qr_url ? (
            <img src={info.qr_url} alt="DuitNow QR" className="mx-auto max-h-72 rounded-lg bg-white p-2" />
          ) : (
            <p className="text-xs text-amber-300 py-6">Kod QR belum dimuat naik oleh admin. Sila guna Direct Transfer.</p>
          )}
          {info?.account_name && <p className="text-[11px] text-slate-300">{info.account_name}</p>}
        </div>
      )}

      {method !== 'fpx' && (
        <div className="bg-slate-950 border border-amber-500/30 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Muat Naik Resit (wajib)</p>
          <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={pick}
            className="block w-full text-[11px] text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-emerald-700 file:text-white" />
          {file && <p className="text-[11px] text-emerald-300">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>}
          <input className="w-full px-3 py-2 rounded-lg bg-slate-800 text-xs" placeholder="No. rujukan transaksi (pilihan)" value={ref} onChange={(e) => setRef(e.target.value)} />
          <label className="flex items-start gap-2 text-[11px] text-slate-300">
            <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            Saya mengesahkan telah membayar {rm(cartTotal)} dan resit yang dimuat naik adalah sah.
          </label>
          <button disabled={busy} onClick={submitManual} className="w-full py-2.5 rounded-lg bg-amber-500 disabled:opacity-50 text-slate-950 font-bold text-xs">
            {busy ? 'Menghantar...' : 'Hantar Resit & Sahkan Pembayaran'}
          </button>
          <p className="text-[10px] text-slate-500">Pembayaran disahkan oleh jurulatih/admin cawangan anda selepas semakan resit.</p>
        </div>
      )}
    </div>
  );
}
