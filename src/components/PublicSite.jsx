import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import PSSPSLogo from './PSSPSLogo';
import { ImageGallery, imagesOf } from './Media';
import { Trophy, ShoppingBag, MapPin, Clock, Users, Facebook, Instagram, ExternalLink, Lock } from 'lucide-react';

const rm = (n) => `RM${Number(n || 0).toFixed(2)}`;
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return d; } };
const TikTokIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={p.className}><path d="M16.6 3c.3 2.4 1.7 3.9 4 4.1v3.2c-1.4.1-2.7-.3-4-1.1v6.2c0 3.9-3.2 6.1-6.3 5.5-2.6-.5-4.4-2.8-4.2-5.5.2-3 2.8-5 5.7-4.6v3.3c-1.6-.4-2.8.6-2.8 2 0 1.2 1 2.1 2.2 2 1.3-.1 1.9-1 1.9-2.3V3h3.5z" /></svg>
);

export default function PublicSite({ onLogin, onRegister }) {
  const [d, setD] = useState({ branches: [], info: {}, tournaments: [], products: [] });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      const [b, i, t, p] = await Promise.all([
        supabase.from('branches').select('*').order('name'),
        supabase.from('academy_info').select('*'),
        supabase.from('tournaments').select('*').order('event_date', { ascending: true }),
        supabase.from('products').select('*').eq('in_stock', true).order('created_at', { ascending: false }),
      ]);
      setD({
        branches: (b.data || []).filter((x) => x.is_active !== false),
        info: Object.fromEntries((i.data || []).map((r) => [r.key, r.value])),
        tournaments: t.data || [],
        products: p.data || [],
      });
      setReady(true);
    })();
  }, []);

  const about = d.info.about || {};
  const social = d.info.social || {};
  const rules = d.info.rules || {};
  const org = Array.isArray(d.info.org_chart) ? d.info.org_chart : [];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = d.tournaments.filter((t) => (t.event_date || '') >= today);
  const isHQ = (b) => /pusat|hq/i.test(b.address || '');
  const branches = [...d.branches].sort((a, b) => Number(isHQ(b)) - Number(isHQ(a)));
  const socials = [
    { k: 'facebook', label: 'Facebook', icon: <Facebook className="w-5 h-5" />, color: 'bg-blue-700/80' },
    { k: 'instagram', label: 'Instagram', icon: <Instagram className="w-5 h-5" />, color: 'bg-pink-700/80' },
    { k: 'tiktok', label: 'TikTok', icon: <TikTokIcon className="w-5 h-5" />, color: 'bg-slate-700' },
  ].filter((s) => social[s.k]);
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const Section = ({ id, title, icon, children }) => (
    <section id={id} className="max-w-5xl mx-auto px-4 py-8 scroll-mt-16">
      <h2 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2">{icon}{title}</h2>
      {children}
    </section>
  );
  const MemberNote = ({ text }) => (
    <div className="mt-3 text-[11px] bg-amber-500/10 border border-amber-500/40 text-amber-200 rounded-lg p-2 flex items-center justify-between gap-2 flex-wrap">
      <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" />{text}</span>
      <span className="flex gap-1.5">
        <button onClick={onRegister} className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold">Daftar</button>
        <button onClick={onLogin} className="px-2.5 py-1 rounded bg-slate-800 font-semibold">Log Masuk</button>
      </span>
    </div>
  );

  return (
    <div className="min-h-screen text-slate-100">
      <header className="sticky top-0 z-30 bg-emerald-950/95 backdrop-blur border-b border-emerald-800/60 px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <PSSPSLogo size={38} />
          <span className="text-sm font-bold text-amber-400 leading-tight hidden sm:block">AKADEMI PUKULAN SERANTAU</span>
        </div>
        <nav className="hidden md:flex gap-4 text-xs text-emerald-100">
          {[['tentang', 'Tentang'], ['cawangan', 'Cawangan'], ['kejohanan', 'Kejohanan'], ['merchandise', 'Merchandise'], ['sosial', 'Media Sosial']].map(([id, l]) => (
            <button key={id} onClick={() => go(id)} className="hover:text-amber-300">{l}</button>
          ))}
        </nav>
        <div className="flex gap-2">
          <button onClick={onLogin} className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold">Log Masuk</button>
          <button onClick={onRegister} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold">Daftar</button>
        </div>
      </header>

      <div className="text-center px-4 py-12 bg-gradient-to-b from-emerald-950/70 to-transparent">
        <div className="flex justify-center"><PSSPSLogo size={110} /></div>
        <h1 className="mt-4 text-2xl sm:text-4xl font-extrabold text-amber-400">{about.title || 'Akademi Pukulan Serantau'}</h1>
        <p className="mt-2 text-sm sm:text-base text-emerald-100 max-w-xl mx-auto">{about.tagline || 'Kelab Silat Olahraga Pukulan Serantau'}</p>
        <div className="mt-6 flex justify-center gap-3 flex-wrap">
          <button onClick={onRegister} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-sm">Daftar Sebagai Ahli</button>
          <button onClick={() => go('tentang')} className="px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 font-semibold text-sm">Kenali Kami</button>
        </div>
      </div>

      <Section id="tentang" title="Tentang Kami">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4 text-sm text-slate-200 leading-relaxed">
          {about.description && <p className="whitespace-pre-line">{about.description}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            {about.vision && <div className="bg-slate-950 rounded-lg p-3"><p className="text-xs font-bold text-amber-300 mb-1">Visi</p><p className="whitespace-pre-line">{about.vision}</p></div>}
            {about.mission && <div className="bg-slate-950 rounded-lg p-3"><p className="text-xs font-bold text-amber-300 mb-1">Misi</p><p className="whitespace-pre-line">{about.mission}</p></div>}
          </div>
          {(rules.bengkung || rules.syarat_am || rules.syarat_khas) && (
            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              {rules.bengkung && <div className="bg-slate-950 rounded-lg p-3"><p className="font-bold text-amber-300 mb-1">Tahap Bengkung</p><p className="whitespace-pre-line">{rules.bengkung}</p></div>}
              {rules.syarat_am && <div className="bg-slate-950 rounded-lg p-3"><p className="font-bold text-amber-300 mb-1">Syarat Am</p><p className="whitespace-pre-line">{rules.syarat_am}</p></div>}
              {rules.syarat_khas && <div className="bg-slate-950 rounded-lg p-3"><p className="font-bold text-amber-300 mb-1">Syarat Khas</p><p className="whitespace-pre-line">{rules.syarat_khas}</p></div>}
            </div>
          )}
          {org.length > 0 && (() => {
            const lv = (n) => org.filter((o) => (o.level ?? 2) === n);
            const Box = ({ o, small }) => (
              <div className={`bg-slate-950 border border-amber-500/30 rounded-lg ${small ? 'p-2' : 'p-3'} text-center`}>
                <p className="text-[10px] text-emerald-400 font-semibold uppercase">{o.role}</p>
                <p className={`${small ? 'text-xs' : 'text-sm'} font-bold text-white`}>{o.name}</p>
                {o.branch && <p className="text-[10px] text-slate-400">{o.branch}</p>}
              </div>
            );
            const gurus = lv(2);
            const orphan = lv(3).filter((o) => !gurus.some((g) => g.name === o.under));
            return (
              <div>
                <p className="text-xs font-bold text-amber-300 mb-2 flex items-center gap-1.5"><Users className="w-4 h-4" />Carta Organisasi</p>
                <div className="space-y-3">
                  <div className="max-w-xs mx-auto">{lv(0).map((o, i) => <Box key={i} o={o} />)}</div>
                  <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">{lv(1).map((o, i) => <Box key={i} o={o} />)}</div>
                  <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {gurus.map((g, i) => (
                      <div key={i} className="space-y-1.5">
                        <Box o={g} />
                        {lv(3).filter((o) => o.under === g.name).map((o, k) => <Box key={k} o={o} small />)}
                      </div>
                    ))}
                  </div>
                  {orphan.length > 0 && <div className="grid sm:grid-cols-3 gap-2">{orphan.map((o, k) => <Box key={k} o={o} small />)}</div>}
                </div>
              </div>
            );
          })()}
        </div>
      </Section>

      <Section id="cawangan" title="Cawangan & Jadual Latihan" icon={<MapPin className="w-5 h-5" />}>
        {!ready ? <p className="text-xs text-slate-400">Memuatkan...</p> : (
          <div className="grid sm:grid-cols-2 gap-3">
            {branches.map((b) => (
              <div key={b.id} className={`bg-slate-900/90 border rounded-xl p-4 text-sm ${isHQ(b) ? 'border-amber-500/60' : 'border-slate-800'}`}>
                <p className="font-bold text-white flex items-center gap-2">{b.name}, {b.state}{isHQ(b) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-bold">HQ</span>}</p>
                {b.address && <p className="text-xs text-slate-400 mt-1">{b.address}</p>}
                {b.training_schedule && <p className="text-xs text-emerald-200 mt-2 flex gap-1.5 whitespace-pre-line"><Clock className="w-3.5 h-3.5 shrink-0 mt-0.5" />{typeof b.training_schedule === 'string' ? b.training_schedule : JSON.stringify(b.training_schedule)}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section id="kejohanan" title="Kejohanan" icon={<Trophy className="w-5 h-5" />}>
        {upcoming.length === 0 ? <p className="text-xs text-slate-400">Tiada kejohanan akan datang buat masa ini.</p> : (
          <div className="grid sm:grid-cols-2 gap-4">
            {upcoming.map((t) => (
              <div key={t.id} className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
                <ImageGallery images={imagesOf(t, 'poster_url')} alt={t.title} />
                <div className="p-4 space-y-1">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">{t.event_type}</span>
                  <h3 className="font-bold text-base">{t.title}</h3>
                  <p className="text-xs text-slate-400">{fmtDate(t.event_date)} • {t.location || '-'}</p>
                  <p className="text-sm font-bold text-emerald-400">Yuran: {rm(t.entry_fee)}</p>
                  {t.description && <p className="text-xs text-slate-300 whitespace-pre-line">{t.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
        <MemberNote text="Untuk menyertai kejohanan, sila daftar akaun & log masuk dahulu." />
      </Section>

      <Section id="merchandise" title="Merchandise" icon={<ShoppingBag className="w-5 h-5" />}>
        {d.products.length === 0 ? <p className="text-xs text-slate-400">Tiada produk buat masa ini.</p> : (
          <div className="grid sm:grid-cols-3 gap-4">
            {d.products.map((p) => (
              <div key={p.id} className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden">
                <ImageGallery images={imagesOf(p, 'image_url')} alt={p.name} height="h-44" />
                <div className="p-3">
                  <h3 className="text-sm font-bold">{p.name}</h3>
                  <p className="text-emerald-400 font-bold text-sm">{rm(p.price)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <MemberNote text="Untuk membeli, sila daftar akaun & log masuk dahulu." />
      </Section>

      {socials.length > 0 && (
        <Section id="sosial" title="Ikuti Kami di Media Sosial">
          <p className="text-xs text-slate-400 mb-3">Lihat aktiviti terkini, video & reels kami di platform berikut.</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {socials.map((s) => (
              <a key={s.k} href={social[s.k]} target="_blank" rel="noopener noreferrer" className={`${s.color} rounded-xl p-4 flex items-center justify-between gap-2 hover:brightness-110`}>
                <span className="flex items-center gap-2 font-bold text-sm">{s.icon}{s.label}</span>
                <span className="text-[11px] flex items-center gap-1">Buka <ExternalLink className="w-3.5 h-3.5" /></span>
              </a>
            ))}
          </div>
        </Section>
      )}

      <footer className="text-center text-[11px] text-slate-500 py-8">
        © {new Date().getFullYear()} Akademi Pukulan Serantau / Kelab Silat Olahraga Pukulan Serantau
        <div className="mt-2"><button onClick={onLogin} className="text-emerald-400 hover:underline">Log Masuk Ahli</button></div>
      </footer>
    </div>
  );
}
