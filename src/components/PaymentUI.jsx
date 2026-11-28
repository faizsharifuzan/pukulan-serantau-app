import React from 'react';
import { supabase } from '../lib/supabase';

export const STATUS_STYLE = {
  paid: 'bg-emerald-900 text-emerald-300',
  pending: 'bg-amber-900 text-amber-300',
  pending_verification: 'bg-sky-900 text-sky-300',
  failed: 'bg-red-900 text-red-300',
  cancelled: 'bg-slate-800 text-slate-400',
  partially_refunded: 'bg-purple-900 text-purple-200',
  refunded: 'bg-purple-900 text-purple-200',
};
export const STATUS_LABEL = {
  paid: 'Berjaya',
  pending: 'Menunggu Bayaran',
  pending_verification: 'Menunggu Pengesahan',
  failed: 'Gagal',
  cancelled: 'Dibatalkan',
  partially_refunded: 'Refund Separa',
  refunded: 'Direfund',
};
export const METHOD_LABEL = { fpx: 'FPX Online', bank_transfer: 'Bank Transfer', duitnow_qr: 'DuitNow QR' };
export const rm = (n) => `RM${Number(n || 0).toFixed(2)}`;

export const StatusBadge = ({ status }) => (
  <span className={`px-2 py-0.5 rounded font-semibold text-[11px] ${STATUS_STYLE[status] || 'bg-slate-800 text-slate-300'}`}>
    {STATUS_LABEL[status] || status}
  </span>
);

export async function openReceipt(path) {
  const w = window.open('', '_blank'); // open synchronously so mobile browsers do not block it
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 120);
  if (error || !data?.signedUrl) { if (w) w.close(); return alert('Tidak dapat membuka resit: ' + (error?.message || '')); }
  if (w) w.location.href = data.signedUrl; else window.location.href = data.signedUrl;
}

export function RefundLines({ refunds }) {
  if (!refunds?.length) return null;
  return (
    <div className="bg-purple-950/40 border border-purple-900/60 rounded-lg p-2 space-y-1">
      {refunds.map((r) => (
        <p key={r.id} className="text-[11px] text-purple-200">
          Refund {rm(r.amount)} • {new Date(r.created_at).toLocaleDateString('ms-MY')} • {r.reason}
          {r.refunded_by_name ? ` (oleh ${r.refunded_by_name})` : ''}
        </p>
      ))}
    </div>
  );
}

export function PaymentHistory({ payments, refunds, onCancel }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
      <h2 className="text-sm font-bold text-amber-400">Sejarah Pembayaran</h2>
      {payments.length === 0 && <p className="text-xs text-slate-400">Belum ada pembayaran.</p>}
      {payments.map((p) => (
        <div key={p.id} className="bg-slate-950 p-3 rounded-lg text-xs space-y-1.5">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div>
              <p className="font-bold">{p.reference_no} <span className="font-normal text-slate-400">({METHOD_LABEL[p.payment_method] || p.payment_method})</span></p>
              <p className="text-[11px] text-slate-400">
                {new Date(p.created_at).toLocaleString('ms-MY')} • {rm(p.total_amount)}
                {Number(p.refunded_total) > 0 ? ` • Direfund ${rm(p.refunded_total)}` : ''}
                {p.bank_transfer_ref ? ` • Ref: ${p.bank_transfer_ref}` : ''}
              </p>
            </div>
            <StatusBadge status={p.status} />
          </div>
          <ul className="text-[11px] text-slate-500 list-disc pl-4">{(p.items || []).map((i, k) => <li key={k}>{i.label}{i.remark ? <span className="text-amber-300"> — Catatan: {i.remark}</span> : null}</li>)}</ul>
          <RefundLines refunds={refunds.filter((r) => r.payment_id === p.id)} />
          <div className="flex flex-wrap gap-2 pt-1">
            {p.receipt_url && (
              <button onClick={() => openReceipt(p.receipt_url)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-[11px] font-semibold text-amber-300">Lihat Resit</button>
            )}
            {p.status === 'pending' && (
              <>
                {p.payment_method === 'fpx' && p.pay_url && (
                  <a href={p.pay_url} className="px-3 py-1.5 rounded-lg bg-emerald-600 font-bold text-[11px]">Teruskan Bayaran</a>
                )}
                <button onClick={() => onCancel(p.id)} className="px-3 py-1.5 rounded-lg bg-red-950/70 border border-red-900 text-red-300 font-semibold text-[11px]">Batalkan</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
