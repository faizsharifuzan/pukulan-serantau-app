import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Users, Trophy, ShoppingBag, CreditCard, Upload, Download,
  LogOut, ShieldCheck, Scale, CheckCircle2, XCircle, Plus, RefreshCw
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { getPersilatWeightClass, getAgeCategory, checkTournamentEligibility } from './lib/persilat';
import { SEED_STUDENTS } from './data/seedStudents';
import PSSPSLogo from './components/PSSPSLogo';
import BengkungVisualizer from './components/BengkungVisualizer';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [authMsg, setAuthMsg] = useState('');

  const [tab, setTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [rsvps, setRsvps] = useState([]);
  const [products, setProducts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);

  // Edit Student Modal State
  const [editingStudent, setEditingStudent] = useState(null);

  // New Tournament Form
  const [newEvent, setNewEvent] = useState({
    title: '', event_type: 'Open Friendly Sparring', event_date: '', location: '', entry_fee: 30, poster_url: ''
  });

  // New Product Form
  const [newProduct, setNewProduct] = useState({
    name: '', category: 'Merchandise', price: 45, description: '', image_url: ''
  });

  // Bank Transfer State
  const [bankRef, setBankRef] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadAllData(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadAllData(session.user.id);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadAllData(userId) {
    setLoading(true);
    const [{ data: prof }, { data: studs }, { data: tourns }, { data: rsvpData }, { data: prods }, { data: pays }] =
      await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('students').select('*').order('id'),
        supabase.from('tournaments').select('*').order('event_date', { ascending: false }),
        supabase.from('tournament_rsvps').select('*'),
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*').order('created_at', { ascending: false }),
      ]);
    setProfile(prof || { id: userId, role: 'parent', full_name: 'Pengguna' });
    setStudents(studs || []);
    setTournaments(tourns || []);
    setRsvps(rsvpData || []);
    setProducts(prods || []);
    setPayments(pays || []);
    setLoading(false);
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthMsg('');
    if (authMode === 'register') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return setAuthMsg(error.message);
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id, full_name: fullName || email.split('@')[0], phone, role: 'parent'
        });
      }
      setAuthMsg('Akaun berjaya didaftar! Sila log masuk (atau sahkan emel jika diminta).');
      setAuthMode('login');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthMsg(error.message);
    }
  }

  const isStaff = profile?.role === 'admin' || profile?.role === 'coach';

  // Seed 44 Students to Supabase
  async function handleSeedStudents() {
    if (!confirm('Muat naik 44 pesilat asal ke Supabase Production?')) return;
    const rows = SEED_STUDENTS.map((s) => ({
      ...s,
      weight_class: getPersilatWeightClass(s.age, s.current_weight),
    }));
    const { error } = await supabase.from('students').upsert(rows, { onConflict: 'id' });
    if (error) return alert('Ralat: ' + error.message);
    alert('44 Pesilat berjaya dimasukkan ke Supabase!');
    loadAllData(session.user.id);
  }

  // Download Excel Template
  function downloadExcelTemplate() {
    const rows = (students.length ? students : SEED_STUDENTS).map((s) => ({
      ID: s.id,
      Nama_Pendek: s.short_name,
      Nama_Penuh: s.full_name || s.short_name,
      No_IC: s.ic_no || '',
      Umur: s.age || 10,
      Jantina: s.gender || 'Lelaki',
      No_Tel_Pesilat: s.student_phone || '',
      Sekolah: s.school || '',
      Alamat: s.address || '',
      Nama_Ibu_Bapa: s.parent_name || '',
      No_Tel_Ibu_Bapa: s.parent_phone || '',
      Berat_kg: s.current_weight || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pesilat_PSSPS');
    XLSX.writeFile(wb, 'Template_Pesilat_PSSPS.xlsx');
  }

  // Upload Excel / CSV directly to Supabase Production
  async function handleExcelUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const updates = rows
      .filter((r) => r.ID || r.Nama_Penuh)
      .map((r, idx) => {
        const age = parseInt(r.Umur, 10) || 12;
        const wt = parseFloat(r.Berat_kg) || null;
        return {
          id: String(r.ID || `PS-${String(idx + 1).padStart(3, '0')}`).trim(),
          short_name: String(r.Nama_Pendek || r.Nama_Penuh || 'Pesilat').trim(),
          full_name: String(r.Nama_Penuh || r.Nama_Pendek || '').trim(),
          ic_no: String(r.No_IC || '').trim(),
          age,
          age_category: getAgeCategory(age),
          gender: r.Jantina === 'Perempuan' ? 'Perempuan' : 'Lelaki',
          student_phone: String(r.No_Tel_Pesilat || '').trim(),
          school: String(r.Sekolah || '').trim(),
          address: String(r.Alamat || '').trim(),
          parent_name: String(r.Nama_Ibu_Bapa || '').trim(),
          parent_phone: String(r.No_Tel_Ibu_Bapa || '').trim(),
          current_weight: wt,
          weight_class: wt ? getPersilatWeightClass(age, wt) : 'Belum Ditimbang',
          weight_updated_at: wt ? new Date().toISOString() : null,
        };
      });

    const { error } = await supabase.from('students').upsert(updates, { onConflict: 'id' });
    if (error) return alert('Gagal kemaskini Excel: ' + error.message);
    alert(`${updates.length} rekod pesilat berjaya dikemaskini terus ke Production!`);
    loadAllData(session.user.id);
  }

  // Save Single Student Edit (including Weight Log)
  async function saveStudentEdit(e) {
    e.preventDefault();
    const s = editingStudent;
    const wt = parseFloat(s.current_weight) || null;
    const wClass = wt ? getPersilatWeightClass(s.age, wt) : 'Belum Ditimbang';
    const payload = {
      ...s,
      age: parseInt(s.age, 10) || 10,
      age_category: getAgeCategory(s.age),
      current_weight: wt,
      weight_class: wClass,
      weight_updated_at: wt ? new Date().toISOString() : s.weight_updated_at,
    };
    const { error } = await supabase.from('students').update(payload).eq('id', s.id);
    if (error) return alert('Ralat simpan: ' + error.message);
    if (wt) {
      await supabase.from('weight_logs').insert({
        student_id: s.id, weight_kg: wt, weight_class: wClass, recorded_by: session.user.id
      });
    }
    setEditingStudent(null);
    loadAllData(session.user.id);
  }

  // Upload Image to Supabase Storage (club-media)
  async function uploadClubImage(file, folder) {
    const ext = file.name.split('.').pop();
    const path = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('club-media').upload(path, file);
    if (error) {
      alert('Ralat muat naik gambar: ' + error.message);
      return '';
    }
    const { data } = supabase.storage.from('club-media').getPublicUrl(path);
    return data.publicUrl;
  }

  // Parent Claim Child
  async function claimChild(studentId) {
    const { error } = await supabase
      .from('students')
      .update({ parent_id: session.user.id })
      .eq('id', studentId);
    if (error) return alert(error.message);
    loadAllData(session.user.id);
  }

  // Cart & Multi-Pay Checkout
  const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + Number(i.amount || 0), 0), [cart]);

  function addToCart(item) {
    setCart((prev) => [...prev, { ...item, cartId: Date.now() + Math.random() }]);
  }

  async function checkoutFPX() {
    if (!cart.length) return;
    const { data, error } = await supabase.functions.invoke('create-fpx-bill', {
      body: {
        items: cart,
        totalAmount: cartTotal,
        parentName: profile?.full_name || 'Ibu Bapa',
        parentEmail: session.user.email,
        parentPhone: profile?.phone || '0123456789',
      },
    });
    if (error || !data?.payment_url) {
      return alert('FPX belum diaktifkan di Supabase Secrets. Sila guna Direct Bank Transfer buat masa ini.');
    }
    window.location.href = data.payment_url;
  }

  async function checkoutBankTransfer() {
    if (!cart.length || !bankRef.trim()) return alert('Sila masukkan nombor rujukan transaksi bank.');
    const refNo = `PS-TRF-${Date.now()}`;
    const { error } = await supabase.from('payments').insert({
      parent_id: session.user.id,
      reference_no: refNo,
      payment_method: 'bank_transfer',
      total_amount: cartTotal,
      items: cart,
      bank_transfer_ref: bankRef.trim(),
      status: 'pending_verification',
    });
    if (error) return alert(error.message);
    setCart([]);
    setBankRef('');
    alert(`Bukti bayaran (${refNo}) berjaya dihantar untuk pengesahan jurulatih.`);
    loadAllData(session.user.id);
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-emerald-950 via-slate-950 to-black">
        <div className="w-full max-w-md bg-slate-900/90 border border-emerald-800/60 rounded-2xl p-6 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-6">
            <PSSPSLogo size={76} />
            <h1 className="mt-3 text-xl font-bold text-amber-400">Kelab Silat Olahraga Pukulan Serantau</h1>
            <p className="text-xs text-slate-400">Portal Rasmi Pengurusan, Penilaian & Pembayaran (PSSPS)</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-3">
            {authMode === 'register' && (
              <>
                <input className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm" placeholder="Nama Penuh Ibu Bapa" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                <input className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm" placeholder="No. Telefon (WhatsApp)" value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </>
            )}
            <input type="email" className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm" placeholder="Emel" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm" placeholder="Kata Laluan" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {authMsg && <p className="text-xs text-amber-400">{authMsg}</p>}
            <button className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-sm">
              {authMode === 'login' ? 'Log Masuk' : 'Daftar Akaun Ibu Bapa'}
            </button>
          </form>
          <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="mt-4 w-full text-center text-xs text-emerald-400 hover:underline">
            {authMode === 'login' ? 'Belum ada akaun? Daftar di sini' : 'Sudah ada akaun? Log masuk'}
          </button>
        </div>
      </div>
    );
  }

  const myChildren = isStaff ? students : students.filter((s) => s.parent_id === session.user.id);
  const unclaimedChildren = students.filter((s) => !s.parent_id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-emerald-950/95 backdrop-blur border-b border-emerald-800/60 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PSSPSLogo size={42} />
          <div>
            <h1 className="text-sm sm:text-base font-bold text-amber-400 leading-tight">Pukulan Serantau (PSSPS)</h1>
            <p className="text-[11px] text-emerald-200">
              {profile?.full_name} • <span className="uppercase font-semibold">{profile?.role}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadAllData(session.user.id)} className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800" title="Muat Semula">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => supabase.auth.signOut()} className="p-2 rounded-lg bg-red-950/80 text-red-300 hover:bg-red-900" title="Log Keluar">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex gap-2 overflow-x-auto px-4 py-3 bg-slate-900/80 border-b border-slate-800">
        {[
          { id: 'students', label: isStaff ? 'Pesilat & Excel' : 'Anak Saya', icon: Users },
          { id: 'tournaments', label: 'Kejohanan & RSVP', icon: Trophy },
          { id: 'shop', label: 'Kedai & Yuran', icon: ShoppingBag },
          { id: 'checkout', label: `Troli (${cart.length})`, icon: CreditCard },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${
              tab === t.id ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </nav>

      <main className="max-w-5xl mx-auto p-4 space-y-6">
        {/* TAB 1: STUDENTS */}
        {tab === 'students' && (
          <div className="space-y-4">
            {isStaff && (
              <div className="flex flex-wrap gap-2 bg-slate-900 p-4 rounded-xl border border-slate-800">
                <button onClick={handleSeedStudents} className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Seed 44 Pesilat Asal
                </button>
                <button onClick={downloadExcelTemplate} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-200 font-semibold text-xs flex items-center gap-1.5">
                  <Download className="w-4 h-4" /> Muat Turun Template Excel
                </button>
                <label className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-4 h-4" /> Muat Naik Excel / CSV (Production)
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} className="hidden" />
                </label>
              </div>
            )}

            {!isStaff && unclaimedChildren.length > 0 && (
              <div className="bg-emerald-950/50 border border-emerald-800 p-4 rounded-xl">
                <h2 className="text-sm font-bold text-amber-400 mb-2">Pilih & Tuntut Profil Anak Anda</h2>
                <div className="flex flex-wrap gap-2">
                  {unclaimedChildren.map((s) => (
                    <button key={s.id} onClick={() => claimChild(s.id)} className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-emerald-700 text-xs hover:bg-emerald-800">
                      + {s.full_name || s.short_name} ({s.age_category.split(' ')[0]})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myChildren.map((s) => (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-mono text-emerald-400">{s.id} • {s.age_category}</span>
                      <h3 className="font-bold text-base text-white">{s.full_name || s.short_name}</h3>
                      <p className="text-xs text-slate-400">Umur: {s.age} thn • IC: {s.ic_no || '-'}</p>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-emerald-900/80 text-emerald-300 font-bold text-xs">
                      {s.overall_score || 0}%
                    </span>
                  </div>

                  {/* Berat & Kelas PERSILAT Dunia */}
                  <div className="bg-slate-950 border border-amber-500/30 rounded-lg p-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-amber-400" />
                      <div>
                        <p className="text-[11px] text-slate-400">Berat Semasa (PERSILAT Dunia)</p>
                        <p className="text-xs font-bold text-amber-300">
                          {s.current_weight ? `${s.current_weight} kg` : 'Belum Ditimbang'} • {s.weight_class || getPersilatWeightClass(s.age, s.current_weight)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <BengkungVisualizer classTier={s.class_tier} ageCategory={s.age_category} bengkungStage={s.bengkung_stage} />

                  <div className="text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-800">
                    <p>Sekolah: {s.school || '-'}</p>
                    <p>Ibu Bapa: {s.parent_name || '-'} ({s.parent_phone || '-'})</p>
                  </div>

                  {isStaff && (
                    <button onClick={() => setEditingStudent(s)} className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300">
                      Edit Maklumat & Kemaskini Berat
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: TOURNAMENTS & RSVP */}
        {tab === 'tournaments' && (
          <div className="space-y-4">
            {isStaff && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <h2 className="text-sm font-bold text-amber-400">Cipta Iklan Kejohanan / Open Friendly</h2>
                <div className="grid sm:grid-cols-2 gap-2">
                  <input className="px-3 py-2 rounded-lg bg-slate-800 text-xs" placeholder="Nama Kejohanan" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} />
                  <select className="px-3 py-2 rounded-lg bg-slate-800 text-xs" value={newEvent.event_type} onChange={(e) => setNewEvent({ ...newEvent, event_type: e.target.value })}>
                    <option>Open Tournament</option>
                    <option>State/National Selection</option>
                    <option>Open Friendly Sparring</option>
                    <option>Internal Friendly</option>
                  </select>
                  <input type="date" className="px-3 py-2 rounded-lg bg-slate-800 text-xs" value={newEvent.event_date} onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })} />
                  <input type="number" className="px-3 py-2 rounded-lg bg-slate-800 text-xs" placeholder="Yuran Penyertaan (RM)" value={newEvent.entry_fee} onChange={(e) => setNewEvent({ ...newEvent, entry_fee: e.target.value })} />
                  <input className="px-3 py-2 rounded-lg bg-slate-800 text-xs" placeholder="Lokasi" value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })} />
                  <label className="px-3 py-2 rounded-lg bg-slate-800 text-xs cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4 text-amber-400" /> {newEvent.poster_url ? 'Poster Dimuat Naik ✓' : 'Muat Naik Poster Iklan'}
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      if (e.target.files?.[0]) {
                        const url = await uploadClubImage(e.target.files[0], 'posters');
                        setNewEvent({ ...newEvent, poster_url: url });
                      }
                    }} />
                  </label>
                </div>
                <button
                  onClick={async () => {
                    if (!newEvent.title || !newEvent.event_date) return alert('Isi nama & tarikh kejohanan.');
                    await supabase.from('tournaments').insert({ ...newEvent, created_by: session.user.id });
                    setNewEvent({ title: '', event_type: 'Open Friendly Sparring', event_date: '', location: '', entry_fee: 30, poster_url: '' });
                    loadAllData(session.user.id);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-xs font-bold"
                >
                  Terbitkan Kejohanan
                </button>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {tournaments.map((t) => (
                <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  {t.poster_url && <img src={t.poster_url} alt={t.title} className="w-full h-44 object-cover" />}
                  <div className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">{t.event_type}</span>
                        <h3 className="font-bold text-base mt-1">{t.title}</h3>
                        <p className="text-xs text-slate-400">{t.event_date} • {t.location}</p>
                      </div>
                      <span className="text-sm font-bold text-emerald-400">RM{Number(t.entry_fee).toFixed(2)}</span>
                    </div>
                    {!isStaff && myChildren.map((child) => {
                      const elig = checkTournamentEligibility(child, t.event_type);
                      return (
                        <div key={child.id} className="mt-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold">{child.full_name || child.short_name}</p>
                            <p className="text-[10px] text-slate-400">{child.weight_class || getPersilatWeightClass(child.age, child.current_weight)} • {elig.reason}</p>
                          </div>
                          {elig.eligible ? (
                            <button
                              onClick={() => addToCart({ student_id: child.id, type: 'tournament', label: `Yuran ${t.title} (${child.short_name})`, amount: Number(t.entry_fee) })}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-[11px] font-bold whitespace-nowrap"
                            >
                              RSVP & Bayar
                            </button>
                          ) : (
                            <span className="text-[10px] text-red-400 font-semibold">Tidak Layak</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SHOP & FEES */}
        {tab === 'shop' && (
          <div className="space-y-6">
            {/* Yuran Kelab Tetap */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-bold text-amber-400 mb-3">Yuran Rasmi Kelab (Multi-Anak)</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { label: 'Yuran Tahunan Kelab', amount: 50 },
                  { label: 'Yuran Bulanan Latihan', amount: 20 },
                  { label: 'Yuran Ujian Kenaikan Bengkung', amount: 50 },
                ].map((fee) => (
                  <div key={fee.label} className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-2">
                    <p className="text-xs font-bold">{fee.label}</p>
                    <p className="text-lg font-bold text-emerald-400">RM{fee.amount.toFixed(2)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {myChildren.slice(0, 6).map((c) => (
                        <button
                          key={c.id}
                          onClick={() => addToCart({ student_id: c.id, type: 'fee', label: `${fee.label} (${c.short_name})`, amount: fee.amount })}
                          className="px-2 py-1 rounded bg-emerald-900/70 hover:bg-emerald-700 text-[10px]"
                        >
                          + {c.short_name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tambah Produk (Staff) */}
            {isStaff && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <h2 className="text-sm font-bold text-amber-400">Tambah Merchandise / Combat Gear</h2>
                <div className="grid sm:grid-cols-3 gap-2">
                  <input className="px-3 py-2 rounded-lg bg-slate-800 text-xs" placeholder="Nama Produk (cth: Baju Kelab)" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
                  <input type="number" className="px-3 py-2 rounded-lg bg-slate-800 text-xs" placeholder="Harga (RM)" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} />
                  <label className="px-3 py-2 rounded-lg bg-slate-800 text-xs cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4 text-amber-400" /> {newProduct.image_url ? 'Gambar Siap ✓' : 'Muat Naik Gambar'}
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      if (e.target.files?.[0]) {
                        const url = await uploadClubImage(e.target.files[0], 'products');
                        setNewProduct({ ...newProduct, image_url: url });
                      }
                    }} />
                  </label>
                </div>
                <button
                  onClick={async () => {
                    if (!newProduct.name) return;
                    await supabase.from('products').insert(newProduct);
                    setNewProduct({ name: '', category: 'Merchandise', price: 45, description: '', image_url: '' });
                    loadAllData(session.user.id);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-xs font-bold"
                >
                  Simpan Produk
                </button>
              </div>
            )}

            {/* Senarai Produk */}
            <div className="grid sm:grid-cols-3 gap-4">
              {products.map((p) => (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover" />}
                  <div className="p-3 space-y-2">
                    <h3 className="text-sm font-bold">{p.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-bold text-sm">RM{Number(p.price).toFixed(2)}</span>
                      <button
                        onClick={() => addToCart({ type: 'product', label: p.name, amount: Number(p.price) })}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-xs font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Troli
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: MULTI-PAY CHECKOUT */}
        {tab === 'checkout' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-amber-400">Troli Pembayaran Gabungan (Multi-Pay)</h2>
              {cart.length === 0 ? (
                <p className="text-xs text-slate-400">Tiada item dalam troli.</p>
              ) : (
                <>
                  {cart.map((item) => (
                    <div key={item.cartId} className="flex justify-between items-center text-xs bg-slate-950 p-2.5 rounded-lg">
                      <span>{item.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-emerald-400">RM{item.amount.toFixed(2)}</span>
                        <button onClick={() => setCart(cart.filter((c) => c.cartId !== item.cartId))} className="text-red-400">Buang</button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                    <span className="font-bold">Jumlah Keseluruhan</span>
                    <span className="text-xl font-bold text-amber-400">RM{cartTotal.toFixed(2)}</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3 pt-2">
                    <button onClick={checkoutFPX} className="py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold text-xs">
                      Bayar Online FPX (toyyibPay)
                    </button>
                    <div className="flex gap-2">
                      <input className="flex-1 px-3 py-2 rounded-lg bg-slate-800 text-xs" placeholder="No. Rujukan Bank Transfer" value={bankRef} onChange={(e) => setBankRef(e.target.value)} />
                      <button onClick={checkoutBankTransfer} className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs">
                        Hantar Transfer
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Rekod Pembayaran */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
              <h2 className="text-sm font-bold text-amber-400">Sejarah Pembayaran</h2>
              {payments.map((p) => (
                <div key={p.id} className="flex flex-wrap justify-between items-center gap-2 bg-slate-950 p-3 rounded-lg text-xs">
                  <div>
                    <p className="font-bold">{p.reference_no} ({p.payment_method.toUpperCase()})</p>
                    <p className="text-[11px] text-slate-400">Ref Bank: {p.bank_transfer_ref || '-'} • RM{Number(p.total_amount).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-semibold ${p.status === 'paid' ? 'bg-emerald-900 text-emerald-300' : 'bg-amber-900 text-amber-300'}`}>
                      {p.status}
                    </span>
                    {isStaff && p.status !== 'paid' && (
                      <button
                        onClick={async () => {
                          await supabase.from('payments').update({ status: 'paid', verified_by: session.user.id, paid_at: new Date().toISOString() }).eq('id', p.id);
                          loadAllData(session.user.id);
                        }}
                        className="px-2 py-1 rounded bg-emerald-600 text-[11px] font-bold"
                      >
                        Sahkan Bayaran
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={saveStudentEdit} className="w-full max-w-lg bg-slate-900 border border-emerald-700 rounded-2xl p-5 space-y-3">
            <h2 className="text-base font-bold text-amber-400">Edit Pesilat: {editingStudent.id}</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input className="col-span-2 px-3 py-2 rounded bg-slate-800" placeholder="Nama Penuh" value={editingStudent.full_name || ''} onChange={(e) => setEditingStudent({ ...editingStudent, full_name: e.target.value })} />
              <input className="px-3 py-2 rounded bg-slate-800" placeholder="No. IC" value={editingStudent.ic_no || ''} onChange={(e) => setEditingStudent({ ...editingStudent, ic_no: e.target.value })} />
              <input type="number" className="px-3 py-2 rounded bg-slate-800" placeholder="Umur" value={editingStudent.age || ''} onChange={(e) => setEditingStudent({ ...editingStudent, age: e.target.value })} />
              <input type="number" step="0.1" className="px-3 py-2 rounded bg-slate-800 border border-amber-500/60" placeholder="Berat Semasa (kg)" value={editingStudent.current_weight || ''} onChange={(e) => setEditingStudent({ ...editingStudent, current_weight: e.target.value })} />
              <div className="px-3 py-2 rounded bg-slate-950 text-amber-300 font-semibold flex items-center">
                {getPersilatWeightClass(editingStudent.age, editingStudent.current_weight)}
              </div>
              <input className="px-3 py-2 rounded bg-slate-800" placeholder="No. Tel Pesilat" value={editingStudent.student_phone || ''} onChange={(e) => setEditingStudent({ ...editingStudent, student_phone: e.target.value })} />
              <input className="px-3 py-2 rounded bg-slate-800" placeholder="Sekolah" value={editingStudent.school || ''} onChange={(e) => setEditingStudent({ ...editingStudent, school: e.target.value })} />
              <input className="col-span-2 px-3 py-2 rounded bg-slate-800" placeholder="Alamat Rumah Semasa" value={editingStudent.address || ''} onChange={(e) => setEditingStudent({ ...editingStudent, address: e.target.value })} />
              <input className="px-3 py-2 rounded bg-slate-800" placeholder="Nama Ibu Bapa" value={editingStudent.parent_name || ''} onChange={(e) => setEditingStudent({ ...editingStudent, parent_name: e.target.value })} />
              <input className="px-3 py-2 rounded bg-slate-800" placeholder="No. Tel Ibu Bapa" value={editingStudent.parent_phone || ''} onChange={(e) => setEditingStudent({ ...editingStudent, parent_phone: e.target.value })} />
              <select className="px-3 py-2 rounded bg-slate-800" value={editingStudent.class_tier} onChange={(e) => setEditingStudent({ ...editingStudent, class_tier: e.target.value })}>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
              <select className="px-3 py-2 rounded bg-slate-800" value={editingStudent.bengkung_stage || 1} onChange={(e) => setEditingStudent({ ...editingStudent, bengkung_stage: Number(e.target.value) })}>
                <option value={1}>Tahap 1: Bengkung Putih</option>
                <option value={2}>Tahap 2: Hitam Belang Putih</option>
                <option value={3}>Tahap 3: Hitam Penuh</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingStudent(null)} className="px-4 py-2 rounded-lg bg-slate-800 text-xs">Batal</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-xs font-bold">Simpan Perubahan</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
