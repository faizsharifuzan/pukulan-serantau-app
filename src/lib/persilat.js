/**
 * Standard Kelas Berat PERSILAT Dunia (Persekutuan Pencak Silat Antarabangsa)
 */
export function getPersilatWeightClass(age, weightKg) {
  const w = parseFloat(weightKg);
  const a = parseInt(age, 10) || 12;
  if (!w || isNaN(w) || w <= 0) return 'Belum Ditimbang';

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // 1. Pra-Tunas, Tunas & Dini (5-12 Tahun): Sela 2 kg bermula 26 kg
  if (a <= 12) {
    if (w < 26) return 'Under (< 26 kg)';
    const idx = Math.floor((w - 26 - 0.0001) / 2);
    if (w === 26) return 'Kelas A (26–28 kg)';
    if (idx <= 18) {
      const low = 26 + idx * 2;
      const high = low + 2;
      return `Kelas ${letters[idx]} (${low}–${high} kg)`;
    }
    if (w <= 68) return 'Kelas Open (>64–68 kg)';
    return 'Open / Bebas (>68 kg)';
  }

  // 2. Pra-Remaja (13-14 Tahun): Sela 3 kg bermula 30 kg
  if (a <= 14) {
    if (w < 30) return 'Under (< 30 kg)';
    const idx = w === 30 ? 0 : Math.floor((w - 30 - 0.0001) / 3);
    if (idx <= 15) {
      const low = 30 + idx * 3;
      const high = low + 3;
      return `Kelas ${letters[idx]} (${low}–${high} kg)`;
    }
    if (w <= 84) return 'Kelas Open (>78–84 kg)';
    return 'Open / Bebas (>84 kg)';
  }

  // 3. Remaja (15-17 Tahun): Sela 4 kg bermula 39 kg
  if (a <= 17) {
    if (w < 39) return 'Under (< 39 kg)';
    const idx = w === 39 ? 0 : Math.floor((w - 39 - 0.0001) / 4);
    if (idx <= 11) {
      const low = 39 + idx * 4;
      const high = low + 4;
      return `Kelas ${letters[idx]} (${low}–${high} kg)`;
    }
    if (w <= 100) return 'Kelas Open 1 (>87–100 kg)';
    return 'Kelas Open 2 (>100 kg)';
  }

  // 4. Dewasa (18+ Tahun): Sela 5 kg bermula 45 kg
  if (w < 45) return 'Under (< 45 kg)';
  const idx = w === 45 ? 0 : Math.floor((w - 45 - 0.0001) / 5);
  if (idx <= 9) {
    const low = 45 + idx * 5;
    const high = low + 5;
    return `Kelas ${letters[idx]} (${low}–${high} kg)`;
  }
  if (w <= 110) return 'Kelas Open 1 (>95–110 kg)';
  return 'Kelas Open 2 (>110 kg)';
}

export function getAgeCategory(age) {
  const a = parseInt(age, 10) || 10;
  if (a <= 8) return 'Pra-Tunas & Tunas (5-8)';
  if (a <= 12) return 'Pra-Dini & Dini (9-12)';
  return 'Pra-Remaja & Remaja (13-17+)';
}

export function checkTournamentEligibility(student, eventType, coachOverride = false) {
  const score = student.overall_score || 0;
  const tier = student.class_tier || 'Beginner';

  if (score < 70 && !coachOverride) {
    return { eligible: false, reason: `Skor ${score}% (< 70% minimum)` };
  }

  if (eventType === 'Open Tournament' || eventType === 'State/National Selection') {
    if (tier === 'Advanced' && score >= 70) return { eligible: true, reason: 'Layak (Advanced ≥ 70%)' };
    return { eligible: false, reason: 'Perlu tahap Advanced & skor ≥ 70%' };
  }

  if (eventType === 'Open Friendly Sparring') {
    if ((tier === 'Advanced' || tier === 'Intermediate') && score >= 70) {
      return { eligible: true, reason: `Layak (${tier} ≥ 70%)` };
    }
    if (tier === 'Beginner' && coachOverride) {
      return { eligible: true, reason: 'Dibenarkan Jurulatih (Ujian Intermediate)' };
    }
    return { eligible: false, reason: 'Beginner perlu kebenaran Coach Override' };
  }

  // Internal Friendly
  return { eligible: true, reason: 'Layak (Internal Kelab)' };
}
