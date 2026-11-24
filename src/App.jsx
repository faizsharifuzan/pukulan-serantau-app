import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  Users, Trophy, ShoppingBag, CreditCard, Upload, Download,
  LogOut, ShieldCheck, Scale, Plus, RefreshCw, UserCog, ArrowLeftRight,
  Sparkles, Building2, Info, Trash2, Send, CalendarCheck, X
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { getPersilatWeightClass, getAgeCategory, checkTournamentEligibility } from './lib/persilat';
import { SEED_STUDENTS } from './data/seedStudents';
import PSSPSLogo from './components/PSSPSLogo';
import BengkungVisualizer from './components/BengkungVisualizer';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [allProfiles, setAllProfiles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [academyInfo, setAcademyInfo] = useState({ about: {}, org_chart: [], rules: {} });
  const [viewAsParent, setViewAsParent] = useState(false);

  // Auth states
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [icNo, setIcNo] = useState('');
  const [phone, setPhone] = useState('');
  const [regRole, setRegRole] = useState('parent'); // 'parent' | 'coach' | 'student'
  const [regBranchId, setRegBranchId] = useState('');
  const [authMsg, setAuthMsg] = useState('');

  // Main app states
  const [tab, setTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [products, setProducts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);

  // Forms & Modals
  const [editingStudent, setEditingStudent] = useState(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({
    id: '', short_name: '', full_name: '', ic_no: '', age: 10, gender: 'Lelaki',
    school: '', parent_name: '', parent_phone: '', current_weight: '', branch_id: '', class_tier: 'Beginner', bengkung_stage: 1
  });
  const [newBranch, setNewBranch] = useState({ name: '', state: '', address: '', training_schedule: '' });
  const [newEvent, setNewEvent] = useState({
    title: '', event_type: 'Open Friendly Sparring', event_date: '', location: '', entry_fee: 30, poster_url: ''
  });
  const [newProduct, setNewProduct] = useState({
    name: '', category: 'Merchandise', price: 45, description: '', image_url: ''
  });
  const [bankRef, setBankRef] = useState('');
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutForm, setAboutForm] = useState({ title: '', tagline: '', description: '', vision: '', mission: '' });

  // AI Chat states
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'ai', text: 'Assalamualaikum! Saya Pembantu AI Akademi Pukulan Serantau. Bagaimana saya boleh bantu anda hari ini?' }
  ]);

  useEffect(() => {
    supabase.from('branches').select('*').order('name').then(({ data }) => {
      if (data?.length) {
        setBranches(data);
        setRegBranchId(data[0].id);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadAllData(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setIsResettingPassword(true);
      setSession(session);
      if (session) loadAllData(session.user.id);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadAllData(userId) {
    setLoading(true);
    const [
      { data: prof },
      { data: studs },
      { data: tourns },
      { data: prods },
      { data: pays },
      { data: brs },
      { data: infoRows }
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('students').select('*').order('id'),
      supabase.from('tournaments').select('*').order('event_date', { ascending: false }),
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('payments').select('*').order('created_at', { ascending: false }),
      supabase.from('branches').select('*').order('name'),
      supabase.from('academy_info').select('*'),
    ]);

    const currentProf = prof || { id: userId, role: 'parent', full_name: 'Pengguna' };
    setProfile(currentProf);
    setStudents(studs || []);
    setTournaments(tourns || []);
    setProducts(prods || []);
    setPayments(pays || []);
    if (brs) setBranches(brs);

    const infoMap = Object.fromEntries((infoRows || []).map((r) => [r.key, r.value]));
    setAcademyInfo({
      about: infoMap.about || {},
      org_chart: infoMap.org_chart || [],
      rules: infoMap.rules || {},
    });
    setAboutForm(infoMap.about || { title: 'Akademi Pukulan Serantau', tagline: '', description: '', vision: '', mission: '' });

    if (currentProf.role === 'admin' || currentProf.role === 'coach') {
      const { data: profList } = await supabase.from('profiles').select('*').order('full_name');
      setAllProfiles(profList || []);
    }
    setLoading(false);
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthMsg('');
    if (authMode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      if (error) return setAuthMsg(error.message);
      setAuthMsg('Pautan reset kata laluan telah dihantar ke emel anda. Sila semak Inbox atau Spam.');
      return;
    }
    if (authMode === 'register') {
      const cleanIc = icNo.replace(/\D/g, '');
      if (cleanIc.length !== 12) return setAuthMsg('No. IC mestilah tepat 12 digit tanpa tanda sengkang (-).');
      const cleanPhone = phone.replace(/\D/g, '').replace(/^60/, '').replace(/^0/, '');
      if (cleanPhone.length < 8) return setAuthMsg('Sila masukkan nombor telefon yang sah (cth: 123456789).');

      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return setAuthMsg(error.message);
      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          full_name: fullName.trim().toUpperCase(),
          ic_no: cleanIc,
          phone: `+60${cleanPhone}`,
          role: regRole,
          branch_id: regBranchId || null,
        });
      }
      setAuthMsg('Akaun berjaya didaftar! Sila log masuk.');
      setAuthMode('login');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthMsg(error.message);
    }
  }

  async function handleUpdatePassword(e) {
    e.preventDefault();
    setAuthMsg('');
    if (newPassword.length < 6) return setAuthMsg('Kata laluan mestilah sekurang-kurangnya 6 aksara.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return setAuthMsg(error.message);
    setNewPassword('');
    setIsResettingPassword(false);
    alert('Kata laluan baharu berjaya disimpan!');
  }

  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'admin' || profile?.role === 'coach';
  const isStudentRole = profile?.role === 'student';
  const actingAsStaff = isStaff && !viewAsParent;

  const branchNameById = useMemo(
    () => Object.fromEntries(branches.map((b) => [b.id, b.name])),
    [branches]
  );

  async function updateUserRole(targetId, newRole) {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', targetId);
    if (error) return alert('Ralat tukar peranan: ' + error.message);
    loadAllData(session.user.id);
  }

  async function deleteUserProfile(targetId, name) {
    if (!confirm(`Padam profil pengguna ${name} daripada sistem?`)) return;
    const { error } = await supabase.from('profiles').delete().eq('id', targetId);
    if (error) return alert('Ralat padam: ' + error.message);
    loadAllData(session.user.id);
  }

  async function handleAddBranch(e) {
    e.preventDefault();
    if (!newBranch.name || !newBranch.state) return alert('Isi nama cawangan & negeri.');
    const { error } = await supabase.from('branches').insert(newBranch);
    if (error) return alert('Ralat tambah cawangan: ' + error.message);
    setNewBranch({ name: '', state: '', address: '', training_schedule: '' });
    loadAllData(session.user.id);
  }

  async function handleDeleteBranch(id, name) {
    if (!confirm(`Padam cawangan ${name}?`)) return;
    const { error } = await supabase.from('branches').delete().eq('id', id);
    if (error) return alert('Ralat padam cawangan: ' + error.message);
    loadAllData(session.user.id);
  }

  async function handleAddStudent(e) {
    e.preventDefault();
    const age = parseInt(newStudent.age, 10) || 10;
    const wt = parseFloat(newStudent.current_weight) || null;
    const cleanIc = (newStudent.ic_no || '').replace(/\D/g, '');
    const id = (newStudent.id || `PS-${Date.now().toString().slice(-4)}`).trim().toUpperCase();
    const payload = {
      id,
      short_name: (newStudent.short_name || newStudent.full_name).trim().toUpperCase(),
      full_name: newStudent.full_name.trim().toUpperCase(),
      ic_no: cleanIc,
      age,
      age_category: getAgeCategory(age),
      gender: newStudent.gender,
      school: newStudent.school.trim(),
      parent_name: newStudent.parent_name.trim().toUpperCase(),
      parent_phone: newStudent.parent_phone ? `+60${newStudent.parent_phone.replace(/\D/g, '').replace(/^60/, '').replace(/^0/, '')}` : '',
      current_weight: wt,
      weight_class: wt ? getPersilatWeightClass(age, wt) : 'Belum Ditimbang',
      branch_id: newStudent.branch_id || branches[0]?.id || null,
      class_tier: newStudent.class_tier,
      bengkung_stage: Number(newStudent.bengkung_stage) || 1,
    };
    const { error } = await supabase.from('students').upsert(payload, { onConflict: 'id' });
    if (error) return alert('Ralat tambah pesilat: ' + error.message);
    setShowAddStudent(false);
    setNewStudent({
      id: '', short_name: '', full_name: '', ic_no: '', age: 10, gender: 'Lelaki',
      school: '', parent_name: '', parent_phone: '', current_weight: '', branch_id: '', class_tier: 'Beginner', bengkung_stage: 1
    });
    loadAllData(session.user.id);
  }

  async function handleDeleteStudent(id, name) {
    if (!confirm(`Padam rekod pesilat ${name} (${id})?`)) return;
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) return alert('Ralat padam pesilat: ' + error.message);
    loadAllData(session.user.id);
  }

  async function handleSeedStudents() {
    if (!confirm('Muat naik 44 pesilat asal (Cawangan Putrajaya) ke Supabase?')) return;
    const putrajaya = branches.find((b) => b.name.toLowerCase().includes('putrajaya'))?.id || branches[0]?.id || null;
    const rows = SEED_STUDENTS.map((s) => ({
      ...s,
      branch_id: putrajaya,
      weight_class: getPersilatWeightClass(s.age, s.current_weight),
    }));
    const { error } = await supabase.from('students').upsert(rows, { onConflict: 'id' });
    if (error) return alert('Ralat: ' + error.message);
    alert('44 Pesilat berjaya dimasukkan!');
    loadAllData(session.user.id);
  }

  function downloadExcelTemplate() {
    const rows = (students.length ? students : SEED_STUDENTS).map((s) => ({
      ID: s.id,
      Nama_Pendek: s.short_name,
      Nama_Penuh: s.full_name || s.short_name,
      No_IC: s.ic_no || '',
      Umur: s.age || 10,
      Jantina: s.gender || 'Lelaki',
      Cawangan: branchNameById[s.branch_id] || 'Putrajaya',
      No_Tel_Pesilat: s.student_phone || '',
      Sekolah: s.school || '',
      Alamat: s.address || '',
      Nama_Ibu_Bapa: s.parent_name || '',
      No_Tel_Ibu_Bapa: s.parent_phone || '',
      Berat_kg: s.current_weight || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pesilat_APS');
    XLSX.writeFile(wb, 'Template_Pesilat_APS.xlsx');
  }

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
        const matchedBranch = branches.find((b) => b.name.toLowerCase() === String(r.Cawangan || '').trim().toLowerCase());
        const fallbackBranch = selectedBranch !== 'ALL' ? selectedBranch : branches[0]?.id || null;
        return {
          id: String(r.ID || `PS-${String(idx + 1).padStart(3, '0')}`).trim().toUpperCase(),
          short_name: String(r.Nama_Pendek || r.Nama_Penuh || 'Pesilat').trim().toUpperCase(),
          full_name: String(r.Nama_Penuh || r.Nama_Pendek || '').trim().toUpperCase(),
          ic_no: String(r.No_IC || '').replace(/\D/g, ''),
          age,
          age_category: getAgeCategory(age),
          gender: r.Jantina === 'Perempuan' ? 'Perempuan' : 'Lelaki',
          branch_id: matchedBranch?.id || fallbackBranch,
          student_phone: String(r.No_Tel_Pesilat || '').trim(),
          school: String(r.Sekolah || '').trim(),
          address: String(r.Alamat || '').trim(),
          parent_name: String(r.Nama_Ibu_Bapa || '').trim().toUpperCase(),
          parent_phone: String(r.No_Tel_Ibu_Bapa || '').trim(),
          current_weight: wt,
          weight_class: wt ? getPersilatWeightClass(age, wt) : 'Belum Ditimbang',
          weight_updated_at: wt ? new Date().toISOString() : null,
        };
      });

    const { error } = await supabase.from('students').upsert(updates, { onConflict: 'id' });
    if (error) return alert('Gagal kemaskini Excel: ' + error.message);
    alert(`${updates.length} rekod pesilat berjaya dikemaskini!`);
    loadAllData(session.user.id);
  }

  async function saveStudentEdit(e) {
    e.preventDefault();
    const s = editingStudent;
    const wt = parseFloat(s.current_weight) || null;
    const wClass = wt ? getPersilatWeightClass(s.age, wt) : 'Belum Ditimbang';
    const payload = {
      ...s,
      full_name: (s.full_name || '').trim().toUpperCase(),
      ic_no: (s.ic_no || '').replace(/\D/g, ''),
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

  async function claimStudent(studentId) {
    const col = isStudentRole ? 'student_user_id' : 'parent_id';
    const { error } = await supabase.from('students').update({ [col]: session.user.id }).eq('id', studentId);
    if (error) return alert(error.message);
    loadAllData(session.user.id);
  }

  async function unclaimStudent(studentId, colType) {
    if (!confirm('Batal tuntutan profil pesilat ini?')) return;
    const col = colType || (isStudentRole ? 'student_user_id' : 'parent_id');
    const { error } = await supabase.from('students').update({ [col]: null }).eq('id', studentId);
    if (error) return alert(error.message);
    loadAllData(session.user.id);
  }

  async function handleSaveAbout(e) {
    e.preventDefault();
    const { error } = await supabase.from('academy_info').upsert({
      key: 'about', value: aboutForm, updated_at: new Date().toISOString()
    });
    if (error) return alert('Ralat simpan info: ' + error.message);
    setEditingAbout(false);
    loadAllData(session.user.id);
  }

  async function handleSendChat(e) {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    setChatLoading(true);

    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: { message: userMsg, mode: viewAsParent ? 'parent' : profile?.role }
    });

    if (error || data?.error) {
      setChatMessages((prev) => [...prev, { role: 'ai', text: 'Maaf, berlaku ralat AI: ' + (data?.error || error.message) }]);
    } else {
      const execNote = data?.executed?.length
        ? `\n\n✅ Tindakan automatik selesai:\n• ${data.executed.join('\n• ')}`
        : '';
      setChatMessages((prev) => [...prev, { role: 'ai', text: (data?.reply || 'Selesai.') + execNote }]);
      if (data?.executed?.length) loadAllData(session.user.id);
    }
    setChatLoading(false);
  }

  const cartTotal = useMemo(() => cart.reduce((sum, i) => sum + Number(i.amount || 0), 0), [cart]);
  function addToCart(item) {
    setCart((prev) => [...prev, { ...item, cartId: Date.now() + Math.random() }]);
  }

  async function checkoutFPX() {
    if (!cart.length) return;
    const { data, error } = await supabase.functions.invoke('create-fpx-bill', {
      body: {
        items: cart, totalAmount: cartTotal,
        parentName: profile?.full_name || 'Ibu Bapa',
        parentEmail: session.user.email,
        parentPhone: profile?.phone || '+60123456789',
      },
    });
    if (error || !data?.payment_url) {
      return alert('FPX belum diaktifkan. Sila guna Direct Bank Transfer buat masa ini.');
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

  if (isResettingPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-emerald-950 via-slate-950 to-black">
        <div className="w-full max-w-md bg-slate-900/90 border border-emerald-800/60 rounded-2xl p-6 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-6">
            <PSSPSLogo size={76} />
            <h1 className="mt-3 text-xl font-bold text-amber-400">Tetapkan Kata Laluan Baharu</h1>
          </div>
          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <input
              type="password"
              className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm"
              placeholder="Kata Laluan Baharu (min. 6 aksara)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            {authMsg && <p className="text-xs text-amber-400">{authMsg}</p>}
            <button className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-sm">
              Simpan Kata Laluan Baharu
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-emerald-950 via-slate-950 to-black">
        <div className="w-full max-w-md bg-slate-900/90 border border-emerald-800/60 rounded-2xl p-6 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-6">
            <PSSPSLogo size={76} />
            <h1 className="mt-3 text-xl font-bold text-amber-400">AKADEMI PUKULAN SERANTAU</h1>
            <p className="text-xs text-slate-400">Portal Rasmi Pengurusan, Penilaian & Pembayaran</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-3">
            {authMode === 'register' && (
              <>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Daftar Sebagai</label>
                  <select className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm" value={regRole} onChange={(e) => setRegRole(e.target.value)}>
                    <option value="parent">Ibu Bapa / Penjaga</option>
                    <option value="student">Pesilat (Pelajar)</option>
                    <option value="coach">Jurulatih (Coach)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Cawangan</label>
                  <select className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm" value={regBranchId} onChange={(e) => setRegBranchId(e.target.value)}>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.state})</option>
                    ))}
                  </select>
                </div>
                <input
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm uppercase"
                  placeholder="Nama Penuh (Sama Seperti IC)"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <input
                  className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm"
                  placeholder="No. IC (12 digit tanpa - cth: 950101145522)"
                  maxLength={12}
                  value={icNo}
                  onChange={(e) => setIcNo(e.target.value.replace(/\D/g, ''))}
                  required
                />
                <div className="flex items-center rounded-lg bg-slate-800 border border-slate-700 overflow-hidden">
                  <span className="px-3 py-2.5 bg-slate-700 text-amber-300 font-bold text-sm">+60</span>
                  <input
                    className="w-full px-3 py-2.5 bg-transparent text-sm outline-none"
                    placeholder="123456789 (WhatsApp)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').replace(/^0/, ''))}
                    required
                  />
                </div>
              </>
            )}
            <input type="email" className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm" placeholder="Emel" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {authMode !== 'forgot' && (
              <input type="password" className="w-full px-3 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-sm" placeholder="Kata Laluan" value={password} onChange={(e) => setPassword(e.target.value)} required />
            )}
            {authMsg && <p className="text-xs text-amber-400">{authMsg}</p>}
            <button className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-sm">
              {authMode === 'login' ? 'Log Masuk' : authMode === 'register' ? 'Daftar Akaun' : 'Hantar Pautan Reset'}
            </button>
          </form>

          <div className="mt-4 space-y-2 text-center">
            {authMode === 'login' && (
              <button onClick={() => { setAuthMode('forgot'); setAuthMsg(''); }} className="block w-full text-xs text-amber-400 hover:underline">
                Lupa Kata Laluan?
              </button>
            )}
            <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthMsg(''); }} className="block w-full text-xs text-emerald-400 hover:underline">
              {authMode === 'login' ? 'Belum ada akaun? Daftar di sini' : 'Kembali ke Log Masuk'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const branchFilteredStudents = selectedBranch === 'ALL'
    ? students
    : students.filter((s) => s.branch_id === selectedBranch);

  const myStudents = actingAsStaff
    ? branchFilteredStudents
    : isStudentRole
      ? students.filter((s) => s.student_user_id === session.user.id)
      : students.filter((s) => s.parent_id === session.user.id);

  const unclaimedStudents = isStudentRole
    ? students.filter((s) => !s.student_user_id)
    : students.filter((s) => !s.parent_id);

  const navTabs = [
    { id: 'students', label: actingAsStaff ? 'Pesilat & Excel' : isStudentRole ? 'Profil & Latihan' : 'Anak Saya', icon: Users },
    { id: 'ai', label: 'AI Pembantu', icon: Sparkles },
    { id: 'tournaments', label: 'Kejohanan', icon: Trophy },
    { id: 'shop', label: 'Kedai & Yuran', icon: ShoppingBag },
    { id: 'checkout', label: `Troli (${cart.length})`, icon: CreditCard },
    { id: 'about', label: 'Tentang Kami', icon: Info },
  ];
  if (actingAsStaff) {
    navTabs.push({ id: 'manage', label: 'Cawangan & Ahli', icon: Building2 });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      <header className="sticky top-0 z-30 bg-emerald-950/95 backdrop-blur border-b border-emerald-800/60 px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <PSSPSLogo size={42} />
          <div>
            <h1 className="text-sm sm:text-base font-bold text-amber-400 leading-tight">AKADEMI PUKULAN SERANTAU</h1>
            <p className="text-[11px] text-emerald-200">
              {profile?.full_name} • <span className="uppercase font-semibold">{viewAsParent ? 'MOD IBU BAPA' : profile?.role}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isStaff && (
            <button
              onClick={() => { setViewAsParent(!viewAsParent); setTab('students'); }}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[11px] font-semibold flex items-center gap-1"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              {viewAsParent ? 'Mod Staf' : 'Mod Ibu Bapa'}
            </button>
          )}
          <button onClick={() => loadAllData(session.user.id)} className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800" title="Muat Semula">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => supabase.auth.signOut()} className="p-2 rounded-lg bg-red-950/80 text-red-300 hover:bg-red-900" title="Log Keluar">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto px-4 py-3 bg-slate-900/80 border-b border-slate-800">
        {navTabs.map((t) => (
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
            {actingAsStaff && (
              <div className="space-y-3 bg-slate-900 p-4 rounded-xl border border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">Tapis Cawangan:</span>
                  <button
                    onClick={() => setSelectedBranch('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${selectedBranch === 'ALL' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
                  >
                    Semua ({students.length})
                  </button>
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBranch(b.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${selectedBranch === b.id ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}
                    >
                      {b.name} ({students.filter((s) => s.branch_id === b.id).length})
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                  <button onClick={() => setShowAddStudent(true)} className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Tambah Pesilat Baharu
                  </button>
                  <button onClick={handleSeedStudents} className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Seed 44 Pesilat Asal
                  </button>
                  <button onClick={downloadExcelTemplate} className="px-3 py-2 rounded-lg bg-slate-800 text-slate-200 font-semibold text-xs flex items-center gap-1.5">
                    <Download className="w-4 h-4" /> Template Excel
                  </button>
                  <label className="px-3 py-2 rounded-lg bg-slate-800 border border-emerald-600 text-emerald-300 font-semibold text-xs flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-4 h-4" /> Muat Naik Excel / CSV
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleExcelUpload} className="hidden" />
                  </label>
                </div>
              </div>
            )}

            {!actingAsStaff && unclaimedStudents.length > 0 && (
              <div className="bg-emerald-950/50 border border-emerald-800 p-4 rounded-xl">
                <h2 className="text-sm font-bold text-amber-400 mb-2">
                  {isStudentRole ? 'Pilih & Tuntut Profil Anda' : 'Pilih & Tuntut Profil Anak Anda'}
                </h2>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {unclaimedStudents.map((s) => (
                    <button key={s.id} onClick={() => claimStudent(s.id)} className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-emerald-700 text-xs hover:bg-emerald-800">
                      + {s.full_name || s.short_name} ({branchNameById[s.branch_id] || 'Putrajaya'})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myStudents.map((s) => (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {s.id} • {branchNameById[s.branch_id] || 'Putrajaya'} • {s.age_category}
                      </span>
                      <h3 className="font-bold text-base text-white">{s.full_name || s.short_name}</h3>
                      <p className="text-xs text-slate-400">Umur: {s.age} thn • IC: {s.ic_no || '-'}</p>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-emerald-900/80 text-emerald-300 font-bold text-xs">
                      {s.overall_score || 0}%
                    </span>
                  </div>

                  <div className="bg-slate-950 border border-amber-500/30 rounded-lg p-2.5 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <p className="text-[11px] text-slate-400">Berat Semasa (PERSILAT Dunia)</p>
                      <p className="text-xs font-bold text-amber-300">
                        {s.current_weight ? `${s.current_weight} kg` : 'Belum Ditimbang'} • {s.weight_class || getPersilatWeightClass(s.age, s.current_weight)}
                      </p>
                    </div>
                  </div>

                  <BengkungVisualizer classTier={s.class_tier} ageCategory={s.age_category} bengkungStage={s.bengkung_stage} />

                  {/* AI Analysis & Weekly Daily Training Plan */}
                  {(s.ai_analysis || (Array.isArray(s.weekly_training_plan) && s.weekly_training_plan.length > 0)) && (
                    <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-lg p-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                        <CalendarCheck className="w-4 h-4" /> Analisis & Latihan Harian (AI)
                      </div>
                      {s.ai_analysis && <p className="text-[11px] text-slate-300 leading-relaxed">{s.ai_analysis}</p>}
                      {Array.isArray(s.weekly_training_plan) && s.weekly_training_plan.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-emerald-900/60">
                          {s.weekly_training_plan.map((item, idx) => (
                            <div key={idx} className="text-[11px] bg-slate-950/70 p-2 rounded">
                              <span className="font-bold text-emerald-400">{item.day}:</span>{' '}
                              <span className="text-white font-semibold">{item.focus}</span>
                              {item.drills && <p className="text-slate-400 text-[10px] mt-0.5">{item.drills}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-800">
                    <p>Sekolah: {s.school || '-'}</p>
                    <p>Ibu Bapa: {s.parent_name || '-'} ({s.parent_phone || '-'})</p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {actingAsStaff ? (
                      <>
                        <button onClick={() => setEditingStudent(s)} className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-amber-300">
                          Edit & Berat
                        </button>
                        {s.parent_id && (
                          <button onClick={() => unclaimStudent(s.id, 'parent_id')} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300">
                            Lepas Ibu Bapa
                          </button>
                        )}
                        <button onClick={() => handleDeleteStudent(s.id, s.short_name)} className="p-1.5 rounded-lg bg-red-950/80 text-red-300 hover:bg-red-900" title="Padam Pesilat">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => unclaimStudent(s.id)}
                        className="w-full py-1.5 rounded-lg bg-red-950/60 border border-red-900/60 hover:bg-red-900/60 text-[11px] font-semibold text-red-300"
                      >
                        Batal Tuntutan (Tersalah Pilih)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: AI CHATBOX */}
        {tab === 'ai' && (
          <div className="bg-slate-900 border border-emerald-800/60 rounded-2xl overflow-hidden flex flex-col h-[72vh]">
            <div className="p-4 bg-emerald-950/60 border-b border-emerald-800/60">
              <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Pembantu AI Akademi Pukulan Serantau
              </h2>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {actingAsStaff
                  ? 'Mod Staf/Admin: Tampal keputusan sparring/latihan untuk auto-skor & jana latihan harian pesilat. Admin juga boleh arahkan AI tambah cawangan atau kemaskini info kelab.'
                  : 'Tanya tentang bengkung, syarat kejohanan, atau analisis & cadangan latihan anak anda (data peribadi dilindungi).'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs whitespace-pre-wrap leading-relaxed ${
                    m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-100 border border-slate-700'
                  }`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && <p className="text-xs text-amber-400 animate-pulse">AI sedang memproses & menganalisis...</p>}
            </div>
            <form onSubmit={handleSendChat} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
              <input
                className="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs outline-none focus:border-emerald-500"
                placeholder={actingAsStaff ? 'Cth: Keputusan sparring hari ini — Ahmad menang 12-8, stamina kurang pusingan 3. Jana latihan mingguan...' : 'Tanya soalan tentang bengkung, syarat, atau prestasi...'}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
              />
              <button disabled={chatLoading} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs flex items-center gap-1.5">
                <Send className="w-4 h-4" /> Hantar
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: TOURNAMENTS */}
        {tab === 'tournaments' && (
          <div className="space-y-4">
            {actingAsStaff && (
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
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Tarikh Kejohanan</label>
                    <input type="date" className="w-full px-3 py-2 rounded-lg bg-slate-800 text-xs" value={newEvent.event_date} onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">Yuran Penyertaan (RM)</label>
                    <input type="number" className="w-full px-3 py-2 rounded-lg bg-slate-800 text-xs" value={newEvent.entry_fee} onChange={(e) => setNewEvent({ ...newEvent, entry_fee: e.target.value })} />
                  </div>
                  <input className="px-3 py-2 rounded-lg bg-slate-800 text-xs" placeholder="Lokasi" value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })} />
                  <label className="px-3 py-2 rounded-lg bg-slate-800 text-xs cursor-pointer flex items-center gap-2">
                    <Upload className="w-4 h-4 text-amber-400" /> {newEvent.poster_url ? 'Poster Dimuat Naik ✓' : 'Muat Naik Poster'}
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
                    {!actingAsStaff && myStudents.map((child) => {
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

        {/* TAB 4: SHOP & FEES */}
        {tab === 'shop' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-bold text-amber-400 mb-3">Yuran Rasmi Akademi (Multi-Anak)</h2>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { label: 'Yuran Tahunan Akademi', amount: 50 },
                  { label: 'Yuran Bulanan Latihan', amount: 20 },
                  { label: 'Yuran Ujian Kenaikan Bengkung', amount: 50 },
                ].map((fee) => (
                  <div key={fee.label} className="bg-slate-950 border border-slate-800 p-3 rounded-lg space-y-2">
                    <p className="text-xs font-bold">{fee.label}</p>
                    <p className="text-lg font-bold text-emerald-400">RM{fee.amount.toFixed(2)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {myStudents.slice(0, 6).map((c) => (
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

            {actingAsStaff && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                <h2 className="text-sm font-bold text-amber-400">Tambah Merchandise / Combat Gear</h2>
                <div className="grid sm:grid-cols-3 gap-2">
                  <input className="px-3 py-2 rounded-lg bg-slate-800 text-xs" placeholder="Nama Produk" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
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

            <div className="grid sm:grid-cols-3 gap-4">
              {products.map((p) => (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  {p.image_url && <img src={p.image_url} alt={p.name} className="w-full h-36 object-cover" />}
                  <div className="p-3 space-y-2">
                    <h3 className="text-sm font-bold">{p.name}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-400 font-bold text-sm">RM{Number(p.price).toFixed(2)}</span>
                      <button onClick={() => addToCart({ type: 'product', label: p.name, amount: Number(p.price) })} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-xs font-semibold flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Troli
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: CHECKOUT */}
        {tab === 'checkout' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-amber-400">Troli Pembayaran Gabungan</h2>
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
                    {actingAsStaff && p.status !== 'paid' && (
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

        {/* TAB 6: ABOUT ACADEMY, ORG CHART, BRANCHES & RULES */}
        {tab === 'about' && (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-emerald-800/60 rounded-xl p-5 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-amber-400">{academyInfo.about?.title || 'Akademi Pukulan Serantau'}</h2>
                  <p className="text-xs text-emerald-300 italic">{academyInfo.about?.tagline}</p>
                </div>
                {isAdmin && (
                  <button onClick={() => setEditingAbout(!editingAbout)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-amber-300 text-xs font-semibold">
                    {editingAbout ? 'Batal' : 'Edit Info'}
                  </button>
                )}
              </div>

              {editingAbout ? (
                <form onSubmit={handleSaveAbout} className="space-y-2 text-xs">
                  <input className="w-full px-3 py-2 rounded bg-slate-800" placeholder="Tajuk" value={aboutForm.title || ''} onChange={(e) => setAboutForm({ ...aboutForm, title: e.target.value })} />
                  <input className="w-full px-3 py-2 rounded bg-slate-800" placeholder="Tagline" value={aboutForm.tagline || ''} onChange={(e) => setAboutForm({ ...aboutForm, tagline: e.target.value })} />
                  <textarea rows={3} className="w-full px-3 py-2 rounded bg-slate-800" placeholder="Pengenalan" value={aboutForm.description || ''} onChange={(e) => setAboutForm({ ...aboutForm, description: e.target.value })} />
                  <input className="w-full px-3 py-2 rounded bg-slate-800" placeholder="Visi" value={aboutForm.vision || ''} onChange={(e) => setAboutForm({ ...aboutForm, vision: e.target.value })} />
                  <input className="w-full px-3 py-2 rounded bg-slate-800" placeholder="Misi" value={aboutForm.mission || ''} onChange={(e) => setAboutForm({ ...aboutForm, mission: e.target.value })} />
                  <button className="px-4 py-2 rounded-lg bg-emerald-600 font-bold">Simpan Info</button>
                </form>
              ) : (
                <div className="space-y-2 text-xs text-slate-300">
                  <p>{academyInfo.about?.description}</p>
                  <div className="grid sm:grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <p className="font-bold text-amber-300 mb-1">Visi</p>
                      <p>{academyInfo.about?.vision}</p>
                    </div>
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                      <p className="font-bold text-amber-300 mb-1">Misi</p>
                      <p>{academyInfo.about?.mission}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-amber-400">Carta Organisasi</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                {(academyInfo.org_chart || []).map((o, i) => (
                  <div key={i} className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                    <p className="text-[10px] text-emerald-400 font-semibold uppercase">{o.role}</p>
                    <p className="text-sm font-bold text-white mt-0.5">{o.name}</p>
                    <p className="text-[11px] text-slate-400">{o.branch}</p>
                  </div>
                ))}
              </div>
              {isAdmin && <p className="text-[11px] text-slate-400">Tip: Anda boleh arahkan AI Pembantu untuk kemaskini Carta Organisasi atau Syarat pada bila-bila masa.</p>}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-amber-400">Cawangan Rasmi</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {branches.map((b) => (
                  <div key={b.id} className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs space-y-1">
                    <p className="font-bold text-white text-sm">{b.name} <span className="text-emerald-400 font-normal">({b.state})</span></p>
                    <p className="text-slate-400">{b.address || '-'}</p>
                    <p className="text-amber-300/90 text-[11px]">Jadual: {b.training_schedule || '-'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-2 text-xs text-slate-300">
              <h3 className="text-sm font-bold text-amber-400">Bengkung & Syarat Penyertaan</h3>
              <p><strong className="text-white">Tahap Bengkung:</strong> {academyInfo.rules?.bengkung}</p>
              <p><strong className="text-white">Syarat Am:</strong> {academyInfo.rules?.syarat_am}</p>
              <p><strong className="text-white">Syarat Khas:</strong> {academyInfo.rules?.syarat_khas}</p>
            </div>
          </div>
        )}

        {/* TAB 7: MANAGE BRANCHES & USERS (ADMIN & COACH) */}
        {tab === 'manage' && actingAsStaff && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-amber-400">Urus Cawangan Akademi</h2>
              <form onSubmit={handleAddBranch} className="grid sm:grid-cols-2 gap-2 text-xs">
                <input className="px-3 py-2 rounded-lg bg-slate-800" placeholder="Nama Cawangan (cth: Kuala Lumpur)" value={newBranch.name} onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })} required />
                <input className="px-3 py-2 rounded-lg bg-slate-800" placeholder="Negeri (cth: WP Kuala Lumpur)" value={newBranch.state} onChange={(e) => setNewBranch({ ...newBranch, state: e.target.value })} required />
                <input className="px-3 py-2 rounded-lg bg-slate-800" placeholder="Alamat Gelanggang" value={newBranch.address} onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })} />
                <input className="px-3 py-2 rounded-lg bg-slate-800" placeholder="Jadual Latihan" value={newBranch.training_schedule} onChange={(e) => setNewBranch({ ...newBranch, training_schedule: e.target.value })} />
                <button className="sm:col-span-2 py-2 rounded-lg bg-emerald-600 font-bold">Tambah Cawangan Baharu</button>
              </form>
              <div className="space-y-2 pt-2">
                {branches.map((b) => (
                  <div key={b.id} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                    <div>
                      <p className="font-bold text-white">{b.name} ({b.state})</p>
                      <p className="text-[11px] text-slate-400">{b.address} • {b.training_schedule}</p>
                    </div>
                    <button onClick={() => handleDeleteBranch(b.id, b.name)} className="p-1.5 rounded bg-red-950 text-red-300 hover:bg-red-900">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-amber-400">Urus Peranan Pengguna (Coach / Ibu Bapa / Pesilat)</h2>
              <div className="space-y-2">
                {allProfiles.map((u) => (
                  <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
                    <div>
                      <p className="font-bold text-white">{u.full_name}</p>
                      <p className="text-[11px] text-slate-400">
                        {u.phone || '-'} • IC: {u.ic_no || '-'} • {branchNameById[u.branch_id] || 'Tiada Cawangan'}
                      </p>
                    </div>
                    {u.role === 'admin' ? (
                      <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 font-bold text-[11px]">MASTER ADMIN</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-emerald-300"
                          value={u.role}
                          onChange={(e) => updateUserRole(u.id, e.target.value)}
                        >
                          <option value="parent">Ibu Bapa</option>
                          <option value="student">Pesilat</option>
                          <option value="coach">Jurulatih (Coach)</option>
                        </select>
                        <button onClick={() => deleteUserProfile(u.id, u.full_name)} className="p-1.5 rounded-lg bg-red-950 text-red-300 hover:bg-red-900" title="Padam Pengguna">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL TAMBAH PESILAT */}
      {showAddStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleAddStudent} className="w-full max-w-lg bg-slate-900 border border-emerald-700 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-amber-400">Tambah Pesilat Baharu</h2>
              <button type="button" onClick={() => setShowAddStudent(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input className="col-span-2 px-3 py-2 rounded bg-slate-800 uppercase" placeholder="Nama Penuh (Sama Seperti IC)" value={newStudent.full_name} onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })} required />
              <input className="px-3 py-2 rounded bg-slate-800 uppercase" placeholder="Nama Panggilan" value={newStudent.short_name} onChange={(e) => setNewStudent({ ...newStudent, short_name: e.target.value })} />
              <input className="px-3 py-2 rounded bg-slate-800" placeholder="No. IC (12 digit tanpa -)" maxLength={12} value={newStudent.ic_no} onChange={(e) => setNewStudent({ ...newStudent, ic_no: e.target.value.replace(/\D/g, '') })} />
              <select className="px-3 py-2 rounded bg-slate-800" value={newStudent.branch_id} onChange={(e) => setNewStudent({ ...newStudent, branch_id: e.target.value })}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <input type="number" className="px-3 py-2 rounded bg-slate-800" placeholder="Umur" value={newStudent.age} onChange={(e) => setNewStudent({ ...newStudent, age: e.target.value })} />
              <input type="number" step="0.1" className="px-3 py-2 rounded bg-slate-800" placeholder="Berat (kg)" value={newStudent.current_weight} onChange={(e) => setNewStudent({ ...newStudent, current_weight: e.target.value })} />
              <select className="px-3 py-2 rounded bg-slate-800" value={newStudent.gender} onChange={(e) => setNewStudent({ ...newStudent, gender: e.target.value })}>
                <option>Lelaki</option>
                <option>Perempuan</option>
              </select>
              <input className="px-3 py-2 rounded bg-slate-800 uppercase" placeholder="Nama Ibu Bapa" value={newStudent.parent_name} onChange={(e) => setNewStudent({ ...newStudent, parent_name: e.target.value })} />
              <input className="px-3 py-2 rounded bg-slate-800" placeholder="No. Tel Ibu Bapa (tanpa +60)" value={newStudent.parent_phone} onChange={(e) => setNewStudent({ ...newStudent, parent_phone: e.target.value.replace(/\D/g, '') })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAddStudent(false)} className="px-4 py-2 rounded-lg bg-slate-800 text-xs">Batal</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-xs font-bold">Simpan Pesilat</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL EDIT PESILAT */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={saveStudentEdit} className="w-full max-w-lg bg-slate-900 border border-emerald-700 rounded-2xl p-5 space-y-3">
            <h2 className="text-base font-bold text-amber-400">Edit Pesilat: {editingStudent.id}</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input className="col-span-2 px-3 py-2 rounded bg-slate-800 uppercase" placeholder="Nama Penuh" value={editingStudent.full_name || ''} onChange={(e) => setEditingStudent({ ...editingStudent, full_name: e.target.value })} />
              <input className="px-3 py-2 rounded bg-slate-800" placeholder="No. IC (tanpa -)" maxLength={12} value={editingStudent.ic_no || ''} onChange={(e) => setEditingStudent({ ...editingStudent, ic_no: e.target.value.replace(/\D/g, '') })} />
              <select className="px-3 py-2 rounded bg-slate-800" value={editingStudent.branch_id || ''} onChange={(e) => setEditingStudent({ ...editingStudent, branch_id: e.target.value })}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <input type="number" className="px-3 py-2 rounded bg-slate-800" placeholder="Umur" value={editingStudent.age || ''} onChange={(e) => setEditingStudent({ ...editingStudent, age: e.target.value })} />
              <input type="number" step="0.1" className="px-3 py-2 rounded bg-slate-800 border border-amber-500/60" placeholder="Berat Semasa (kg)" value={editingStudent.current_weight || ''} onChange={(e) => setEditingStudent({ ...editingStudent, current_weight: e.target.value })} />
              <div className="col-span-2 px-3 py-2 rounded bg-slate-950 text-amber-300 font-semibold">
                Kelas Berat: {getPersilatWeightClass(editingStudent.age, editingStudent.current_weight)}
              </div>
              <input className="px-3 py-2 rounded bg-slate-800" placeholder="Sekolah" value={editingStudent.school || ''} onChange={(e) => setEditingStudent({ ...editingStudent, school: e.target.value })} />
              <input className="px-3 py-2 rounded bg-slate-800" placeholder="No. Tel Pesilat" value={editingStudent.student_phone || ''} onChange={(e) => setEditingStudent({ ...editingStudent, student_phone: e.target.value })} />
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

