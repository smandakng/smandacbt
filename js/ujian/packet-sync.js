let studentPacketRealtimeChannel = null;
let studentPacketBroadcastChannel = null;
let studentPacketPollInterval = null;
let studentPacketCustomEventListener = null;
let lastFreshCheckAt = 0;

function applyBankSoalUpdateToExamState(packetData, options = {}) {
  if (!packetData || window.__examFinalized || window.__examSubmitInFlight) return false;
  const sig = typeof getBankSoalContentSignature === 'function'
    ? getBankSoalContentSignature(packetData)
    : '';
  if (sig && sig === window.__lastBankSoalSignature) return false;
  const hadSignature = !!window.__lastBankSoalSignature;
  window.__lastBankSoalSignature = sig;
  if (packetData.konten_versi) {
    window.__lastBankSoalContentVersion = String(packetData.konten_versi);
  }

  const prevIndex = EXAM_STATE.currentIndex || 0;
  const merged = typeof mergeSavedExamWithBankSoal === 'function'
    ? mergeSavedExamWithBankSoal({
      answers: EXAM_STATE.answers,
      doubts: EXAM_STATE.doubts,
      scrambledQuestions: EXAM_STATE.scrambledQuestions,
      scrambledOptions: EXAM_STATE.scrambledOptions,
      currentIndex: EXAM_STATE.currentIndex,
      timeRemaining: EXAM_STATE.timeRemaining
    }, packetData)
    : null;
  if (!merged) return false;

  EXAM_STATE.answers = merged.answers || {};
  EXAM_STATE.doubts = merged.doubts || {};
  EXAM_STATE.scrambledQuestions = merged.scrambledQuestions || [];
  EXAM_STATE.scrambledOptions = merged.scrambledOptions || {};
  EXAM_STATE.currentIndex = Number.isInteger(merged.currentIndex) ? merged.currentIndex : prevIndex;

  saveExamStateToLocal();
  try {
    if (typeof updateExamProgressUI === 'function') updateExamProgressUI();
    if (typeof renderDesktopMapGrid === 'function') renderDesktopMapGrid();
    if (typeof renderExamQuestion === 'function') renderExamQuestion();
  } catch (_) {}

  if (options.notify !== false && hadSignature && typeof showNotification === 'function') {
    showNotification('Soal Diperbarui', 'Perubahan soal dari proktor telah diterapkan. Jawaban Anda tetap tersimpan.', 'info');
  }
  return true;
}

async function loadBankSoalPacketMatchingVersion(packetId, remoteVersion) {
  let packetData = typeof loadBankSoalPacket === 'function'
    ? await loadBankSoalPacket(packetId, {
      preferStorage: true,
      forceRefresh: true,
      versionChanged: true,
      cacheBust: true
    })
    : null;
  if (packetData && remoteVersion && String(packetData.konten_versi || '') !== remoteVersion) {
    packetData = await loadBankSoalPacket(packetId, {
      preferStorage: false,
      forceRefresh: true,
      versionChanged: true,
      cacheBust: true
    });
  }
  return packetData;
}

async function ensureExamBankSoalFreshOnAction(forceCheck = false) {
  if (!CURRENT_USER?.activePacketId) return false;
  const now = Date.now();
  if (!forceCheck && now - lastFreshCheckAt < 2000) return false;
  lastFreshCheckAt = now;

  try {
    const packetId = CURRENT_USER.activePacketId;
    const { data, error } = await supabaseClient
      .from('Bank Soal')
      .select('konten_versi')
      .eq('id_paket', packetId)
      .single();

    if (error) {
      return false;
    }

    const remoteVersion = String(data?.konten_versi || '');
    const localVersion = String(window.__lastBankSoalContentVersion || '');

    if (remoteVersion && remoteVersion !== localVersion) {
      const updatedPacket = await loadBankSoalPacketMatchingVersion(packetId, remoteVersion);
      if (updatedPacket) {
        applyBankSoalUpdateToExamState(updatedPacket, { notify: true });
        if (typeof setCachedPacket === 'function') {
          setCachedPacket(packetId, updatedPacket);
        }
        return true;
      }
    }
  } catch (err) {
    console.warn('ensureExamBankSoalFreshOnAction error:', err);
  }
  return false;
}

function stopStudentExamRealtimeUpdates() {
  if (studentPacketPollInterval) {
    clearInterval(studentPacketPollInterval);
    studentPacketPollInterval = null;
  }
  if (studentPacketCustomEventListener) {
    window.removeEventListener('cbt-packet-updated', studentPacketCustomEventListener);
    studentPacketCustomEventListener = null;
  }
  if (studentPacketRealtimeChannel && supabaseClient) {
    try { supabaseClient.removeChannel(studentPacketRealtimeChannel); } catch (_) {}
    studentPacketRealtimeChannel = null;
  }
  if (studentPacketBroadcastChannel && supabaseClient) {
    try { supabaseClient.removeChannel(studentPacketBroadcastChannel); } catch (_) {}
    studentPacketBroadcastChannel = null;
  }
  stopStudentScheduleRealtimeUpdates();
}

async function startStudentExamRealtimeUpdates() {
  if (!CURRENT_USER?.activePacketId) return;
  stopStudentExamRealtimeUpdates();
  startStudentScheduleRealtimeUpdates();

  const packetId = CURRENT_USER.activePacketId;

  try {
    let packetData = typeof getCachedPacket === 'function'
      ? getCachedPacket(packetId)
      : null;

    if (!packetData) {
      packetData = await loadBankSoalPacket(packetId, { preferStorage: true });
    }

    if (packetData) {
      applyBankSoalUpdateToExamState(packetData, { notify: false });
      if (typeof setCachedPacket === 'function') setCachedPacket(packetId, packetData);
    }
  } catch (err) {
    console.warn('Gagal memuat paket soal awal:', err);
  }

  studentPacketCustomEventListener = (e) => {
    if (e.detail?.packetId === packetId) {
      if (e.detail?.record?.daftar_soal) {
        applyBankSoalUpdateToExamState(e.detail.record, { notify: true });
      } else {
        ensureExamBankSoalFreshOnAction(true);
      }
    }
  };
  window.addEventListener('cbt-packet-updated', studentPacketCustomEventListener);

  if (supabaseClient) {
    try {
      studentPacketRealtimeChannel = supabaseClient
        .channel(`public:Bank Soal:${packetId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'Bank Soal',
          filter: `id_paket=eq.${packetId}`
        }, async (payload) => {
          if (payload.new && Array.isArray(payload.new.daftar_soal) && payload.new.daftar_soal.length > 0) {
            applyBankSoalUpdateToExamState(payload.new, { notify: true });
            if (typeof setCachedPacket === 'function') setCachedPacket(packetId, payload.new);
          } else {
            ensureExamBankSoalFreshOnAction(true);
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('Postgres realtime channel subscription error:', e);
    }

    try {
      studentPacketBroadcastChannel = supabaseClient
        .channel(`cbt-packet-broadcast-${packetId}`)
        .on('broadcast', { event: 'packet_updated' }, async (payload) => {
          if (payload?.payload?.packetData?.daftar_soal) {
            applyBankSoalUpdateToExamState(payload.payload.packetData, { notify: true });
            if (typeof setCachedPacket === 'function') setCachedPacket(packetId, payload.payload.packetData);
          } else {
            ensureExamBankSoalFreshOnAction(true);
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('Broadcast channel subscription error:', e);
    }
  }

  studentPacketPollInterval = setInterval(() => {
    ensureExamBankSoalFreshOnAction(true);
  }, 2500);
}

let studentScheduleRealtimeChannel = null;
let studentScheduleBroadcastChannel = null;
let studentSchedulePollInterval = null;
let studentScheduleCustomEventListener = null;
let lastScheduleCheckAt = 0;

function applyScheduleUpdateToExamState(newSchedule, options = {}) {
  if (!newSchedule || window.__examFinalized || window.__examSubmitInFlight) return false;
  const oldSched = EXAM_STATE.schedule;
  if (!oldSched) {
    EXAM_STATE.schedule = newSchedule;
    return false;
  }

  const oldDur = Number(oldSched.durasi) || 0;
  const newDur = Number(newSchedule.durasi) || 0;
  const oldEnd = typeof getExamScheduleEndMs === 'function' ? getExamScheduleEndMs(oldSched) : null;
  const newEnd = typeof getExamScheduleEndMs === 'function' ? getExamScheduleEndMs(newSchedule) : null;

  let diffSec = 0;
  if (oldEnd !== null && newEnd !== null && oldEnd !== newEnd) {
    diffSec = Math.round((newEnd - oldEnd) / 1000);
  } else if (newDur !== oldDur) {
    diffSec = (newDur - oldDur) * 60;
  }

  const durationOrTimeChanged = diffSec !== 0 || newDur !== oldDur || oldSched.mulai !== newSchedule.mulai || oldSched.selesai !== newSchedule.selesai;

  EXAM_STATE.schedule = { ...oldSched, ...newSchedule };

  if (durationOrTimeChanged) {
    const prevTime = Number(EXAM_STATE.timeRemaining) || 0;
    EXAM_STATE.timeRemaining = Math.max(0, prevTime + diffSec);

    if (typeof syncTimerDisplay === 'function') syncTimerDisplay();
    if (typeof saveExamStateToLocal === 'function') saveExamStateToLocal();

    if (EXAM_STATE.timeRemaining > 0 && !window.__examFinalized && !window.__examSubmitInFlight) {
      if (window.__examEndSubmitScheduled) {
        window.__examEndSubmitScheduled = false;
      }
      if (typeof toggleLoader === 'function') toggleLoader(false);
      if (typeof startExamTimer === 'function') startExamTimer();
    }

    if (options.notify !== false && typeof showNotification === 'function') {
      const diffMin = Math.round(Math.abs(diffSec) / 60);
      let durMsg = '';
      if (diffSec > 0) {
        durMsg = `Durasi ujian ditambah ${diffMin > 0 ? diffMin + ' menit' : Math.abs(diffSec) + ' detik'} oleh admin. Sisa waktu: ${Math.floor(EXAM_STATE.timeRemaining / 60)} menit.`;
      } else if (diffSec < 0) {
        durMsg = `Durasi ujian dikurangi ${diffMin > 0 ? diffMin + ' menit' : Math.abs(diffSec) + ' detik'} oleh admin. Sisa waktu: ${Math.floor(EXAM_STATE.timeRemaining / 60)} menit.`;
      } else {
        durMsg = `Jadwal & durasi ujian diperbarui menjadi ${newDur} menit oleh admin.`;
      }
      showNotification('Waktu Ujian Diperbarui', durMsg, 'info');
    }
    return true;
  }
  return false;
}

async function ensureExamScheduleFreshOnAction(forceCheck = false) {
  const scheduleId = CURRENT_USER?.activeScheduleId || EXAM_STATE?.schedule?.id;
  if (!scheduleId) return false;
  const now = Date.now();
  if (!forceCheck && now - lastScheduleCheckAt < 2000) return false;
  lastScheduleCheckAt = now;

  try {
    const { data, error } = await supabaseClient
      .from('Jadwal Ujian')
      .select('id,mapel,id_paket,mulai,selesai,durasi,kelas_terpilih,token,tampil_nilai,acak_soal,acak_jawaban')
      .eq('id', scheduleId)
      .single();

    if (error || !data) return false;

    return applyScheduleUpdateToExamState(data, { notify: true });
  } catch (err) {
    console.warn('ensureExamScheduleFreshOnAction error:', err);
  }
  return false;
}

function stopStudentScheduleRealtimeUpdates() {
  if (studentSchedulePollInterval) {
    clearInterval(studentSchedulePollInterval);
    studentSchedulePollInterval = null;
  }
  if (studentScheduleCustomEventListener) {
    window.removeEventListener('cbt-schedule-updated', studentScheduleCustomEventListener);
    studentScheduleCustomEventListener = null;
  }
  if (studentScheduleRealtimeChannel && supabaseClient) {
    try { supabaseClient.removeChannel(studentScheduleRealtimeChannel); } catch (_) {}
    studentScheduleRealtimeChannel = null;
  }
  if (studentScheduleBroadcastChannel && supabaseClient) {
    try { supabaseClient.removeChannel(studentScheduleBroadcastChannel); } catch (_) {}
    studentScheduleBroadcastChannel = null;
  }
}

async function startStudentScheduleRealtimeUpdates() {
  const scheduleId = CURRENT_USER?.activeScheduleId || EXAM_STATE?.schedule?.id;
  if (!scheduleId) return;
  stopStudentScheduleRealtimeUpdates();

  studentScheduleCustomEventListener = (e) => {
    if (e.detail?.scheduleId === scheduleId || e.detail?.record?.id === scheduleId) {
      if (e.detail?.record) {
        applyScheduleUpdateToExamState(e.detail.record, { notify: true });
      } else {
        ensureExamScheduleFreshOnAction(true);
      }
    }
  };
  window.addEventListener('cbt-schedule-updated', studentScheduleCustomEventListener);

  if (supabaseClient) {
    try {
      studentScheduleRealtimeChannel = supabaseClient
        .channel(`public:Jadwal Ujian:${scheduleId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'Jadwal Ujian',
          filter: `id=eq.${scheduleId}`
        }, async (payload) => {
          if (payload.new && payload.new.id === scheduleId) {
            applyScheduleUpdateToExamState(payload.new, { notify: true });
          } else {
            ensureExamScheduleFreshOnAction(true);
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('Postgres schedule realtime channel subscription error:', e);
    }

    try {
      studentScheduleBroadcastChannel = supabaseClient
        .channel(`cbt-schedule-broadcast-${scheduleId}`)
        .on('broadcast', { event: 'schedule_updated' }, async (payload) => {
          if (payload?.payload?.schedule) {
            applyScheduleUpdateToExamState(payload.payload.schedule, { notify: true });
          } else {
            ensureExamScheduleFreshOnAction(true);
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('Schedule broadcast channel subscription error:', e);
    }
  }

  studentSchedulePollInterval = setInterval(() => {
    ensureExamScheduleFreshOnAction(true);
  }, 2500);
}

