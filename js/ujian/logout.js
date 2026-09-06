async function handleProctorResetLogout() {
  if (window.__proctorResetLogoutInProgress) return;
  window.__proctorResetLogoutInProgress = true;
  stopExamTimer();
  window.__examTimerFrozen = true;

  if (typeof saveExamStateToLocal === 'function') {
    try { saveExamStateToLocal(); } catch (_) {}
  }
  if (typeof persistExamPauseKeepalive === 'function') {
    try { persistExamPauseKeepalive(EXAM_STATE, CURRENT_USER); } catch (_) {}
  }

  window.__proctorForcedLogout = true;
  clearExamPageActive();
  stopAntiCheatEngines();
  stopSplitScreenMonitor();
  hideSplitScreenWarningModal();
  if (unsubscribeSessionAlert) {
    unsubscribeSessionAlert();
    unsubscribeSessionAlert = null;
  }
  hideStudentAdminAlert();
  stopExamTimer();
  mySessionStorage.setItem('cbt-proctor-reset-msg', 'Sesi ujian direset proktor. Login kembali untuk melanjutkan — jawaban, nomor soal terakhir, dan sisa waktu ujian akan dipulihkan.');
  mySessionStorage.setItem('cbt-resume-exam', '1');
  mySessionStorage.removeItem('cbt-session');
  CURRENT_USER = null;
  if (typeof exitExamFullscreen === 'function') {
    exitExamFullscreen().catch(() => {});
  } else if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  window.location.replace('index.html');
}

async function handleProctorFinishLogout(adminUsername) {
  if (window.__proctorResetLogoutInProgress) return;
  window.__proctorResetLogoutInProgress = true;
  stopExamTimer();

  try {
    if (typeof EXAM_STATE !== 'undefined' && EXAM_STATE?.schedule?.id && CURRENT_USER?.nis) {
      if (typeof saveExamResultAndDeleteSession === 'function') {
        await saveExamResultAndDeleteSession(EXAM_STATE, CURRENT_USER, 'Proktor');
      } else if (typeof persistExamPauseKeepalive === 'function') {
        persistExamPauseKeepalive(EXAM_STATE, CURRENT_USER);
      }
    }
  } catch (err) {
    console.warn('handleProctorFinishLogout save check failed', err);
  }

  window.__examFinalized = true;
  stopExamCloudSync();
  window.__proctorForcedLogout = true;
  clearExamPageActive();
  stopAntiCheatEngines();
  stopSplitScreenMonitor();
  hideSplitScreenWarningModal();
  if (unsubscribeSessionAlert) {
    unsubscribeSessionAlert();
    unsubscribeSessionAlert = null;
  }
  hideStudentAdminAlert();
  stopExamTimer();
  if (CURRENT_USER?.activeScheduleId && CURRENT_USER?.nis) {
    myLocalStorage.removeItem(`ar_cbt_state_${CURRENT_USER.activeScheduleId}_${CURRENT_USER.nis}`);
  }
  mySessionStorage.setItem('cbt-login-status-msg', JSON.stringify({
    variant: 'info',
    title: 'Ujian Selesai',
    message: `Ujian telah diselesaikan manual oleh "${adminUsername || 'proktor'}"`,
    lucideIcon: 'check-circle'
  }));
  mySessionStorage.removeItem('cbt-session');
  CURRENT_USER = null;
  if (typeof exitExamFullscreen === 'function') {
    exitExamFullscreen().catch(() => {});
  } else if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  window.location.replace('index.html');
}

async function handleLogout() {
  mySessionStorage.removeItem('cbt-session');
  window.__examFinalized = false;
  window.__examStarted = false;
  stopExamCloudSync();
  stopStudentExamListeners();
  if (typeof stopStudentExamRealtimeUpdates === 'function') stopStudentExamRealtimeUpdates();
  if (!window.__proctorForcedLogout && CURRENT_USER && CURRENT_USER.activeScheduleId && CURRENT_USER.nis) {
    deleteExamSessionById(`${CURRENT_USER.activeScheduleId}_${CURRENT_USER.nis}`).catch(() => { });
  }
  window.__proctorForcedLogout = false;
  window.__proctorResetLogoutInProgress = false;
  stopAntiCheatEngines();
  if (EXAM_STATE.timerInterval) { clearInterval(EXAM_STATE.timerInterval); EXAM_STATE.timerInterval = null; }
  CURRENT_USER = null;
  window.location.href = 'index.html';
}
