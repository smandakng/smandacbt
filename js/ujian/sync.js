let heartbeatInterval = null;

async function sendExamHeartbeat() {
  if (!EXAM_STATE.schedule?.id || !CURRENT_USER?.nis) return;
  const id = `${EXAM_STATE.schedule.id}_${CURRENT_USER.nis}`;
  const allAnswers = EXAM_STATE.answers || {};
  const answeredCount = Object.keys(allAnswers).filter(
    (k) => allAnswers[k] !== undefined && allAnswers[k] !== null && String(allAnswers[k]).trim() !== ''
  ).length;

  let currentNilai = 0;
  const questions = EXAM_STATE.scrambledQuestions || [];
  if (questions.length > 0) {
    let benar = 0;
    questions.forEach((q) => {
      if (q && q.id && allAnswers[q.id] !== undefined) {
        const studentAns = String(allAnswers[q.id]).trim().toUpperCase();
        const correctKey = String(q.correct_key || 'A').trim().toUpperCase();
        if (studentAns === correctKey) benar += 1;
      }
    });
    currentNilai = Math.round((benar / questions.length) * 100);
  }

  const isCheat = Boolean(
    (EXAM_STATE.cheatTabCount || 0) > 0 ||
    EXAM_STATE.splitScreenDetected
  );

  try {
    const { error } = await supabaseClient
      .from('Session Ujian')
      .update({
        waktu_terakhir: new Date().toISOString(),
        progress: answeredCount,
        nilai: currentNilai,
        cheat_detected: isCheat
      })
      .eq('id', id);
    if (error) console.warn('Heartbeat failed', error);
  } catch (err) {
    console.warn('Heartbeat error', err);
  }

  try {
    const buildProgressFn = (typeof window !== 'undefined' && typeof window.buildExamProgressPayload === 'function')
      ? window.buildExamProgressPayload
      : (typeof buildExamProgressPayload === 'function' ? buildExamProgressPayload : null);
    if (buildProgressFn) {
      const progressPayload = buildProgressFn(EXAM_STATE);
      const getNowMsFn = (typeof window !== 'undefined' && typeof window.getServerNowMs === 'function')
        ? window.getServerNowMs
        : (typeof getServerNowMs === 'function' ? getServerNowMs : null);
      const nowIso = new Date(getNowMsFn ? getNowMsFn() : Date.now()).toISOString();

      let isAlreadyFinished = false;
      const getDocFn = (typeof window !== 'undefined' && typeof window.getDoc === 'function')
        ? window.getDoc
        : (typeof getDoc === 'function' ? getDoc : null);
      const getPublicDocFn = (typeof window !== 'undefined' && typeof window.getPublicDoc === 'function')
        ? window.getPublicDoc
        : (typeof getPublicDoc === 'function' ? getPublicDoc : null);
      if (getDocFn && getPublicDocFn) {
        try {
          const ansDoc = await getDocFn(getPublicDocFn('Jawaban Siswa', id, 'id,status'));
          if (ansDoc.exists()) {
            const st = String(ansDoc.data()?.status || '').trim().toLowerCase();
            if (st === 'selesai') isAlreadyFinished = true;
          }
        } catch (_) {}
      }

      if (!isAlreadyFinished && typeof supabaseUrl === 'string' && supabaseUrl && typeof supabaseKey === 'string' && supabaseKey) {
        const row = {
          id,
          nis: CURRENT_USER.nis,
          nama: CURRENT_USER.nama || '',
          kelas: CURRENT_USER.kelas || '',
          mapel: EXAM_STATE.schedule.mapel || '',
          status: 'Proses',
          jawaban: progressPayload,
          waktu_kirim: nowIso,
          penjelasan: 'Progress Exam'
        };

        const endpoint = `${String(supabaseUrl).replace(/\/$/, '')}/rest/v1/${encodeURIComponent('Jawaban Siswa')}?on_conflict=id`;
        fetch(endpoint, {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify(row),
          keepalive: true,
          mode: 'cors',
          credentials: 'omit'
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Sync progress to Jawaban Siswa failed', err);
  }
}

function startExamCloudSync() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  sendExamHeartbeat();
  heartbeatInterval = setInterval(sendExamHeartbeat, 60000);
}

function stopExamCloudSync() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function touchExamClientUpdatedAt() {
  const nowIso = new Date(typeof getServerNowMs === 'function' ? getServerNowMs() : Date.now()).toISOString();
  EXAM_STATE.clientUpdatedAt = nowIso;
  return nowIso;
}

function saveExamStateToLocal() {
  if (!EXAM_STATE.schedule?.id || !CURRENT_USER?.nis) return;
  touchExamClientUpdatedAt();
  const key = `ar_cbt_state_${EXAM_STATE.schedule.id}_${CURRENT_USER.nis}`;
  const slim = {
    answers: EXAM_STATE.answers || {},
    doubts: EXAM_STATE.doubts || {},
    scrambledQuestionIds: (EXAM_STATE.scrambledQuestions || []).map((q) => q.id),
    scrambledOptionKeys: Object.fromEntries(
      Object.entries(EXAM_STATE.scrambledOptions || {}).map(([qId, opts]) => [
        qId,
        Array.isArray(opts) ? opts.map((o) => o.key || o) : opts
      ])
    ),
    currentIndex: EXAM_STATE.currentIndex || 0,
    cheatTabCount: EXAM_STATE.cheatTabCount || 0,
    timeRemaining: EXAM_STATE.timeRemaining || 0,
    frozenTimeRemaining: EXAM_STATE.timeRemaining || 0,
    timerFrozen: !!window.__examTimerFrozen,
    clientUpdatedAt: EXAM_STATE.clientUpdatedAt || null,
    serverSyncedAt: EXAM_STATE.serverSyncedAt || null
  };
  try {
    myLocalStorage.setItem(key, JSON.stringify(slim));
  } catch (err) {
    console.warn('saveExamStateToLocal failed', err);
  }
}

async function reportExamViolationToSession(source = '', count = 1) {
  if (!EXAM_STATE?.schedule?.id || !CURRENT_USER?.nis) return;
  const id = `${EXAM_STATE.schedule.id}_${CURRENT_USER.nis}`;
  const payload = {
    cheat_detected: true,
    waktu_terakhir: new Date().toISOString()
  };
  try {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      await supabaseClient
        .from('Session Ujian')
        .update(payload)
        .eq('id', id);
    } else if (typeof updateDoc === 'function' && typeof getPublicDoc === 'function') {
      await updateDoc(getPublicDoc('Session Ujian', id), payload);
    }
  } catch (err) {
    console.warn('reportExamViolationToSession failed', err);
  }
}
