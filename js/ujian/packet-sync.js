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
}

async function startStudentExamRealtimeUpdates() {
  if (!CURRENT_USER?.activePacketId) return;
  stopStudentExamRealtimeUpdates();

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
