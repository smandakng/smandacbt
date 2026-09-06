const BLOCKED_EXAM_EVENTS = ['contextmenu', 'selectstart', 'dragstart', 'drop', 'copy', 'cut', 'paste'];

const INTERNAL_MODAL_IDS = [
  'mobile-bottom-sheet',
  'fontSizeMenu',
  'mobile-fontsize-sheet',
  'mobileCombinedMenu',
  'student-admin-alert-modal',
  'split-screen-warning-modal',
  'finish-modal',
  'confirmation-dialog',
  'global-spinner'
];

const VIOLATION_DESCRIPTIONS = {
  fullscreen: { reason: 'Keluar Mode Layar Penuh', msg: 'Wajib Layar Penuh!' },
  split: { reason: 'Belah Layar', msg: 'Belah layar dicegah. Lanjutkan ujian.' },
  overlay: { reason: 'Layar Tertutup', msg: 'Jangan Menutup Halaman Ujian!' },
  visibility: { reason: 'Keluar Layar/Tab', msg: 'Jangan keluar halaman ujian!' },
  rotate: { reason: 'Rotasi Layar', msg: 'Rotasi layar terdeteksi!' },
  blur: { reason: 'Kehilangan Fokus', msg: 'Jangan berpindah jendela atau aplikasi!' },
  reload: { reason: 'Refresh Halaman', msg: 'Refresh halaman dilarang selama ujian!' }
};

let overlayCheckInterval = null;
let appPinningCheckInterval = null;
let examLossOfFocusActive = false;

function shouldSkipDuplicateViolation() {
  const now = Date.now();
  if (now - examViolationLastAt < 900) return true;
  examViolationLastAt = now;
  return false;
}

// getMaxExamViolations() didefinisikan di media-settings.js dan selalu membaca
// nilai batas toleransi pelanggaran dari database (window.__securitySettingsCache).
// Jangan mendefinisikan ulang fungsi ini di sini agar tidak meng-shadow versi yang lebih akurat.

function registerExamTabViolation(source) {
  if (!isStudentExamActive() || window.__examFinalized || window.__examSubmitInFlight || window.__proctorResetLogoutInProgress || (typeof isStudentAdminAlertVisible === 'function' && isStudentAdminAlertVisible())) return;
  if (shouldSkipDuplicateViolation()) return;
  EXAM_STATE.cheatTabCount = (EXAM_STATE.cheatTabCount || 0) + 1;
  if (typeof saveExamStateToLocal === 'function') saveExamStateToLocal();
  const maxAllowed = getMaxExamViolations();
  const info = VIOLATION_DESCRIPTIONS[source] || { reason: 'Keluar Layar/Tab', msg: 'Jangan keluar halaman ujian!' };

  // Laporkan segera ke Session Ujian agar terpantau di monitor pengawas/admin
  if (typeof reportExamViolationToSession === 'function') {
    reportExamViolationToSession(source, EXAM_STATE.cheatTabCount);
  }

  if (EXAM_STATE.cheatTabCount >= maxAllowed) {
    if (typeof showNotification === 'function') showNotification('Curang Terdeteksi', 'Ujian otomatis dikirim karena mencapai batas toleransi pelanggaran.', 'danger');
    if (typeof autoSubmitExam === 'function') autoSubmitExam(`Curang: ${info.reason}`);
    return;
  }
  const remaining = maxAllowed - EXAM_STATE.cheatTabCount;
  if (typeof showNotification === 'function') showNotification('Peringatan Keamanan', `${info.msg} (${EXAM_STATE.cheatTabCount}/${maxAllowed}). Sisa toleransi: ${remaining}x`, 'danger');
  if (isFullscreenEnabled() && typeof requestExamFullscreen === 'function') requestExamFullscreen();
}

function registerExamBackgroundViolation() {
  if (!isStudentExamActive() || window.__examFinalized || window.__examSubmitInFlight || window.__proctorResetLogoutInProgress) return;
  if (shouldSkipDuplicateViolation()) return;
  EXAM_STATE.cheatFocusCount = (EXAM_STATE.cheatFocusCount || 0) + 1;
  if (typeof showNotification === 'function') showNotification('Peringatan', `Kembali lagi ke ujian. (${EXAM_STATE.cheatFocusCount}x keluar layar)`, 'info');
}

function isOverlayDetectionEnabled() {
  const cached = myLocalStorage.getItem('er_enable_overlay_detection');
  return cached !== null ? cached === 'true' : (window.__securitySettingsCache?.enableOverlayDetection ?? true);
}

function isInternalModalOpen() {
  return INTERNAL_MODAL_IDS.some(id => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  });
}

function checkExternalOverlayOcclusion() {
  try {
    if (!isStudentExamActive() || window.__examFinalized || window.__examSubmitInFlight || window.__proctorResetLogoutInProgress) return;
    if (!isOverlayDetectionEnabled() || isInternalModalOpen()) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w <= 0 || h <= 0) return;
    const mx = Math.floor(w / 2), my = Math.floor(h / 2);
    const q1x = Math.floor(w / 4), q3x = Math.floor(3 * w / 4);
    const q1y = Math.floor(h / 4), q3y = Math.floor(3 * h / 4);
    const sampleCoords = [
      [12, 12], [w - 12, 12], [12, h - 12], [w - 12, h - 12],
      [mx, 12], [mx, h - 12], [12, my], [w - 12, my],
      [mx, my], [q1x, q1y], [q3x, q1y], [q1x, q3y], [q3x, q3y]
    ];
    let pointsOccluded = 0;
    for (let i = 0; i < sampleCoords.length; i++) {
      if (!document.elementFromPoint(sampleCoords[i][0], sampleCoords[i][1])) pointsOccluded++;
    }
    if (pointsOccluded >= 2 || (document.visibilityState === 'visible' && !document.hasFocus())) {
      if (examLossOfFocusActive) return;
      examLossOfFocusActive = true;
      registerExamTabViolation('overlay');
    }
  } catch (_) {}
}

function startOverlayDetectionMonitor() {
  stopOverlayDetectionMonitor();
  if (!isOverlayDetectionEnabled()) return;
  overlayCheckInterval = setInterval(checkExternalOverlayOcclusion, 1500);
}

function stopOverlayDetectionMonitor() {
  if (overlayCheckInterval) { clearInterval(overlayCheckInterval); overlayCheckInterval = null; }
}

function checkAppPinningStatus() {
  try {
    if (!isStudentExamActive() || window.__examFinalized || window.__examSubmitInFlight || window.__proctorResetLogoutInProgress) return;
    const isMobile = typeof isMobileDevice === 'function'
      ? isMobileDevice()
      : /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    if (!isMobile) return;
    if (typeof isAppPinningRequired === 'function' && !isAppPinningRequired()) return;
    if (typeof isExamBrowserEnvironment === 'function' && !isExamBrowserEnvironment()) return;
    if (typeof isExamAppPinned === 'function' && isExamAppPinned()) return;
    stopAppPinningMonitor();
    mySessionStorage.setItem('cbt-login-status-msg', JSON.stringify({
      variant: 'error',
      title: 'Sematan Aplikasi Terlepas',
      message: 'Sematan aplikasi telah dilepas / dinonaktifkan. Ujian dihentikan dan Anda otomatis dikeluarkan.',
      lucideIcon: 'shield-alert'
    }));
    if (typeof handleLogout === 'function') handleLogout();
    else window.location.href = 'index.html';
  } catch (_) {}
}

function startAppPinningMonitor() {
  stopAppPinningMonitor();
  if (typeof isAppPinningRequired === 'function' && !isAppPinningRequired()) return;
  appPinningCheckInterval = setInterval(checkAppPinningStatus, 1500);
}

function stopAppPinningMonitor() {
  if (appPinningCheckInterval) { clearInterval(appPinningCheckInterval); appPinningCheckInterval = null; }
}

function isFullscreenEnabled() {
  const cached = myLocalStorage.getItem('er_enable_fullscreen');
  return cached !== null ? cached === 'true' : (window.__securitySettingsCache?.enableFullscreen ?? true);
}

function handleNativeFullscreenExit() {
  if (!isStudentExamActive() || window.__examFinalized || window.__examSubmitInFlight || window.__proctorResetLogoutInProgress) return;
  if (!isFullscreenEnabled()) return;
  registerExamTabViolation('fullscreen');
}

function handleExamBlur() {
  if (!isStudentExamActive() || window.__examFinalized || window.__examSubmitInFlight || window.__proctorResetLogoutInProgress || isInternalModalOpen() || (typeof isStudentAdminAlertVisible === 'function' && isStudentAdminAlertVisible())) return;
  if (examLossOfFocusActive) return;
  examLossOfFocusActive = true;
  if (document.visibilityState === 'hidden') {
    registerExamTabViolation('visibility');
  } else {
    registerExamTabViolation(isOverlayDetectionEnabled() ? 'overlay' : 'blur');
  }
}

function restoreExamFocusState() {
  examLossOfFocusActive = false;
  EXAM_STATE.cheatFocusCount = 0;
  try { if (typeof updateExamProgressUI === 'function') updateExamProgressUI(); } catch (_) { }
  try { if (typeof toggleMobileSheet === 'function') toggleMobileSheet(false); } catch (_) { }
  if (isFullscreenEnabled() && typeof requestExamFullscreen === 'function') requestExamFullscreen();
  if (typeof syncExamViewportLayout === 'function') syncExamViewportLayout();
}

function handleExamVisibility() {
  if (!isStudentExamActive() || window.__examFinalized || window.__examSubmitInFlight || window.__proctorResetLogoutInProgress) return;
  if (document.visibilityState === 'hidden') {
    if (examLossOfFocusActive) return;
    examLossOfFocusActive = true;
    registerExamTabViolation('visibility');
  } else {
    restoreExamFocusState();
  }
}

function handleExamOrientation() {
  if (!isStudentExamActive() || window.__examFinalized || window.__examSubmitInFlight || window.__proctorResetLogoutInProgress) return;
  if (!window.__examStarted) return;
  if (typeof isStudentAdminAlertVisible === 'function' && isStudentAdminAlertVisible()) return;
  const nowOri = window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
  if (!examOrientationBaseline) examOrientationBaseline = nowOri;
  if (nowOri !== examOrientationBaseline) {
    registerExamTabViolation('rotate');
    examOrientationBaseline = nowOri;
  }
  if (typeof syncExamViewportLayout === 'function') syncExamViewportLayout();
}

function startAntiCheatEngines() {
  if (window.__antiCheatEnginesActive) { markExamPageActive(); return; }
  window.__antiCheatEnginesActive = true;
  examLossOfFocusActive = false;
  EXAM_STATE.cheatTabCount = EXAM_STATE.cheatTabCount || 0;
  EXAM_STATE.cheatFocusCount = 0;
  EXAM_STATE.splitScreenDetected = false;
  window.__examNativeFullscreenActive = false;
  examViolationLastAt = 0;
  markExamPageActive();
  BLOCKED_EXAM_EVENTS.forEach(evt => {
    window.addEventListener(evt, blockEvent, true);
    document.addEventListener(evt, blockEvent, true);
  });
  document.addEventListener('keydown', blockInspections, true);
  if (typeof handleBeforeUnload === 'function') window.addEventListener('beforeunload', handleBeforeUnload);
  if (typeof handleExamPageShow === 'function') window.addEventListener('pageshow', handleExamPageShow);
  window.addEventListener('blur', handleExamBlur);
  window.addEventListener('focus', restoreExamFocusState);
  document.addEventListener('visibilitychange', handleExamVisibility);
  window.addEventListener('orientationchange', handleExamOrientation);
  if (typeof bindExamFullscreenListeners === 'function') bindExamFullscreenListeners(handleNativeFullscreenExit);
  if (typeof bindExamMobileSecurityListeners === 'function') bindExamMobileSecurityListeners();
  if (typeof bindExamViewportSyncListeners === 'function') bindExamViewportSyncListeners();
  if (typeof startSplitScreenMonitor === 'function') startSplitScreenMonitor();
  startOverlayDetectionMonitor();
  startAppPinningMonitor();
  if (typeof startStudentSessionAlertListener === 'function') startStudentSessionAlertListener();
}

function stopAntiCheatEngines() {
  window.__antiCheatEnginesActive = false;
  examLossOfFocusActive = false;
  BLOCKED_EXAM_EVENTS.forEach(evt => {
    window.removeEventListener(evt, blockEvent, true);
    document.removeEventListener(evt, blockEvent, true);
  });
  document.removeEventListener('keydown', blockInspections, true);
  if (typeof handleBeforeUnload === 'function') window.removeEventListener('beforeunload', handleBeforeUnload);
  if (typeof handleExamPageShow === 'function') window.removeEventListener('pageshow', handleExamPageShow);
  window.removeEventListener('blur', handleExamBlur);
  window.removeEventListener('focus', restoreExamFocusState);
  document.removeEventListener('visibilitychange', handleExamVisibility);
  window.removeEventListener('orientationchange', handleExamOrientation);
  if (typeof unbindExamFullscreenListeners === 'function') unbindExamFullscreenListeners();
  if (typeof unbindExamMobileSecurityListeners === 'function') unbindExamMobileSecurityListeners();
  if (typeof unbindExamViewportSyncListeners === 'function') unbindExamViewportSyncListeners();
  if (typeof exitExamFullscreen === 'function') exitExamFullscreen();
  if (typeof stopSplitScreenMonitor === 'function') stopSplitScreenMonitor();
  stopOverlayDetectionMonitor();
  stopAppPinningMonitor();
  if (typeof stopStudentExamListeners === 'function') stopStudentExamListeners();
  clearExamPageActive();
}

function blockEvent(e) {
  e.preventDefault();
}

function blockInspections(e) {
  if (typeof isStudentAdminAlertVisible === 'function' && isStudentAdminAlertVisible()) {
    e.preventDefault();
    return false;
  }
  const keyCode = e.keyCode || e.which;
  const key = (e.key || '').toLowerCase();
  const ctrlOrMeta = Boolean(e.ctrlKey || e.metaKey);

  // F12 or Developer tools shortcuts (Ctrl+Shift+I/J/C/K/M/S/X) or F11 Fullscreen toggle
  if (keyCode === 123 || keyCode === 122 || key === 'f11' || (ctrlOrMeta && e.shiftKey && (['i', 'j', 'c', 'k', 'm', 's', 'x'].includes(key) || [73, 74, 67, 75, 77, 83, 88].includes(keyCode)))) {
    e.preventDefault();
    return false;
  }
  // View source (Ctrl+U)
  if (ctrlOrMeta && (keyCode === 85 || key === 'u')) {
    e.preventDefault();
    return false;
  }
  // Save page (Ctrl+S), Print (Ctrl+P), Open (Ctrl+O)
  if (ctrlOrMeta && (['s', 'p', 'o'].includes(key) || [83, 80, 79].includes(keyCode))) {
    e.preventDefault();
    return false;
  }
  // History (Ctrl+H), Downloads (Ctrl+J)
  if (ctrlOrMeta && (['h', 'j'].includes(key) || [72, 74].includes(keyCode))) {
    e.preventDefault();
    return false;
  }
  // New tab/window (Ctrl+T, Ctrl+N, Ctrl+Shift+N)
  if (ctrlOrMeta && (['t', 'n'].includes(key) || [84, 78].includes(keyCode))) {
    e.preventDefault();
    return false;
  }
  // Close tab/window (Ctrl+W, Ctrl+F4)
  if ((ctrlOrMeta && (key === 'w' || keyCode === 87 || keyCode === 115)) || (e.altKey && (keyCode === 115 || key === 'f4'))) {
    e.preventDefault();
    return false;
  }
  // History navigation (Alt+Left/Right)
  if (e.altKey && (keyCode === 37 || keyCode === 39 || key === 'arrowleft' || key === 'arrowright')) {
    e.preventDefault();
    return false;
  }
  // Refresh page (F5, Ctrl+R, Ctrl+F5)
  if (keyCode === 116 || (ctrlOrMeta && (key === 'r' || keyCode === 82))) {
    e.preventDefault();
    if (typeof showRefreshBlockedWarning === 'function') showRefreshBlockedWarning();
    return false;
  }
}

window.startAntiCheatEngines = startAntiCheatEngines;
window.stopAntiCheatEngines = stopAntiCheatEngines;
window.registerExamTabViolation = registerExamTabViolation;
window.checkAppPinningStatus = checkAppPinningStatus;
// window.getMaxExamViolations sudah di-export oleh media-settings.js
window.isOverlayDetectionEnabled = isOverlayDetectionEnabled;
window.startOverlayDetectionMonitor = startOverlayDetectionMonitor;
window.stopOverlayDetectionMonitor = stopOverlayDetectionMonitor;
window.checkExternalOverlayOcclusion = checkExternalOverlayOcclusion;

