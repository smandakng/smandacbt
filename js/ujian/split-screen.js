function isKeyboardLikelyOpenForSplitCheck() {
  const active = document.activeElement;
  if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return true;
  const vv = window.visualViewport;
  if (!vv) return false;
  const heightLoss = window.innerHeight - vv.height;
  const widthRatio = vv.width / Math.max(window.innerWidth, 1);
  return heightLoss > 120 && widthRatio > 0.92;
}

function captureSplitScreenBaseline() {
  const vv = window.visualViewport;
  const availW = Math.round(window.screen?.availWidth || window.screen?.width || 0);
  const availH = Math.round(window.screen?.availHeight || window.screen?.height || 0);
  splitScreenBaseline = {
    width: Math.round(vv?.width ?? window.innerWidth),
    height: Math.round(vv?.height ?? window.innerHeight),
    screenWidth: availW,
    screenHeight: availH
  };
}

function isSplitScreenLikely() {
  if (!isStudentExamActive() || document.visibilityState !== 'visible') return false;
  if (window.__examFinalized || window.__examSubmitInFlight || window.__proctorResetLogoutInProgress) return false;
  if (typeof isStudentAdminAlertVisible === 'function' && isStudentAdminAlertVisible()) return false;
  if (isKeyboardLikelyOpenForSplitCheck()) return false;

  const platform = typeof detectExamPlatform === 'function' ? detectExamPlatform() : {};

  if (platform.isIOSPhone) return false;

  const vv = window.visualViewport;
  const viewW = Math.round(vv?.width ?? window.innerWidth);
  const viewH = Math.round(vv?.height ?? window.innerHeight);
  if (!splitScreenBaseline) return false;

  const baseW = Math.max(splitScreenBaseline.width, 1);
  const baseH = Math.max(splitScreenBaseline.height, 1);
  const widthVsBaseline = viewW / baseW;
  const heightVsBaseline = viewH / baseH;

  if (widthVsBaseline < 0.82) return true;
  if (heightVsBaseline < 0.78) return true;

  const screenW = Math.max(splitScreenBaseline.screenWidth || window.screen?.availWidth || viewW, 1);
  const screenH = Math.max(splitScreenBaseline.screenHeight || window.screen?.availHeight || viewH, 1);
  const widthVsScreen = viewW / screenW;
  const heightVsScreen = viewH / screenH;
  if (widthVsScreen < 0.72 && widthVsBaseline < 0.92) return true;
  if (heightVsScreen < 0.68 && heightVsBaseline < 0.9) return true;

  return false;
}

function clearSplitScreenTimer() {
  if (splitScreenTimer) {
    clearTimeout(splitScreenTimer);
    splitScreenTimer = null;
  }
  if (splitScreenCountdownInterval) {
    clearInterval(splitScreenCountdownInterval);
    splitScreenCountdownInterval = null;
  }
}

function pulseSplitScreenCountdownEl() {
  const countdownEl = document.getElementById('split-screen-countdown');
  if (!countdownEl) return;
  countdownEl.classList.remove('split-countdown-tick');
  void countdownEl.offsetWidth;
  countdownEl.classList.add('split-countdown-tick');
}

function showSplitScreenWarningModal(secondsLeft) {
  const modal = document.getElementById('split-screen-warning-modal');
  const countdownEl = document.getElementById('split-screen-countdown');
  if (!modal) return;
  const sec = secondsLeft !== undefined ? secondsLeft : Math.max(1, Math.ceil(SPLIT_SCREEN_SUBMIT_MS / 1000));
  if (countdownEl) countdownEl.textContent = String(sec);
  modal.classList.remove('hidden');
  document.body.classList.add('split-screen-warning-open');
  pulseSplitScreenCountdownEl();
}

function hideSplitScreenWarningModal() {
  const modal = document.getElementById('split-screen-warning-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.classList.remove('split-screen-warning-open');
  const countdownEl = document.getElementById('split-screen-countdown');
  if (countdownEl) countdownEl.classList.remove('split-countdown-tick');
}

function startSplitScreenCountdown() {
  splitScreenSecondsLeft = Math.max(1, Math.ceil(SPLIT_SCREEN_SUBMIT_MS / 1000));
  showSplitScreenWarningModal(splitScreenSecondsLeft);
  if (splitScreenCountdownInterval) clearInterval(splitScreenCountdownInterval);
  splitScreenCountdownInterval = setInterval(() => {
    splitScreenSecondsLeft -= 1;
    const countdownEl = document.getElementById('split-screen-countdown');
    if (countdownEl) countdownEl.textContent = String(Math.max(splitScreenSecondsLeft, 0));
    pulseSplitScreenCountdownEl();
    if (splitScreenSecondsLeft <= 0 && splitScreenCountdownInterval) {
      clearInterval(splitScreenCountdownInterval);
      splitScreenCountdownInterval = null;
    }
  }, 1000);
}

function registerSplitScreenEarlyReturnViolation() {
  if (!isStudentExamActive() || window.__examFinalized || window.__examSubmitInFlight) return;
  EXAM_STATE.splitScreenDetected = true;
  if (typeof registerExamTabViolation === 'function') {
    registerExamTabViolation('split');
  } else {
    EXAM_STATE.cheatTabCount = (EXAM_STATE.cheatTabCount || 0) + 1;
    const maxAllowed = typeof getMaxExamViolations === 'function'
      ? getMaxExamViolations()
      : (window.__securitySettingsCache?.maxViolations || 3);
    if (EXAM_STATE.cheatTabCount >= maxAllowed) {
      if (typeof showNotification === 'function') {
        showNotification('Curang Terdeteksi', 'Ujian otomatis dikirim karena mencapai batas toleransi pelanggaran.', 'danger');
      }
      if (typeof autoSubmitExam === 'function') {
        autoSubmitExam('Curang: Belah Layar');
      }
    } else {
      const remaining = maxAllowed - EXAM_STATE.cheatTabCount;
      showNotification(
        'Peringatan Keamanan',
        `Belah layar dicegah. Lanjutkan ujian. (${EXAM_STATE.cheatTabCount}/${maxAllowed}). Sisa toleransi: ${remaining}x`,
        'danger'
      );
    }
  }
}

function resolveSplitScreenWarningCleared() {
  const hadWarning = Boolean(window.__splitScreenWarnShown || splitScreenTimer || splitScreenCountdownInterval);
  clearSplitScreenTimer();
  hideSplitScreenWarningModal();
  window.__splitScreenWarnShown = false;
  if (hadWarning) {
    registerSplitScreenEarlyReturnViolation();
  }

  setTimeout(() => {
    if (!isSplitScreenLikely()) captureSplitScreenBaseline();
  }, 400);
}

function isSplitScreenEnabled() {
  const cached = myLocalStorage.getItem('er_enable_split_screen');
  return cached !== null ? cached === 'true' : (window.__securitySettingsCache?.enableSplitScreen ?? true);
}

function handleSplitScreenCheck() {
  if (!isSplitScreenEnabled()) {
    if (window.__splitScreenWarnShown || splitScreenTimer || splitScreenCountdownInterval) {
      clearSplitScreenTimer();
      hideSplitScreenWarningModal();
      window.__splitScreenWarnShown = false;
    }
    return;
  }

  if (!isStudentExamActive() || window.__splitScreenSubmitting) return;
  if (window.__examFinalized || window.__examSubmitInFlight || window.__proctorResetLogoutInProgress) return;

  if (isSplitScreenLikely()) {
    if (!splitScreenTimer) {
      if (!window.__splitScreenWarnShown) {
        showSplitScreenWarningModal(Math.max(1, Math.ceil(SPLIT_SCREEN_SUBMIT_MS / 1000)));
        window.__splitScreenWarnShown = true;
        if (typeof reportExamViolationToSession === 'function') {
          reportExamViolationToSession('split', 1);
        }
        startSplitScreenCountdown();
      }
      splitScreenTimer = setTimeout(() => {
        splitScreenTimer = null;
        if (!isStudentExamActive() || window.__splitScreenSubmitting || window.__examFinalized || window.__examSubmitInFlight) return;
        if (!isSplitScreenLikely()) {
          resolveSplitScreenWarningCleared();
          return;
        }
        EXAM_STATE.splitScreenDetected = true;
        hideSplitScreenWarningModal();
        clearSplitScreenTimer();
        window.__splitScreenWarnShown = false;
        if (typeof registerExamTabViolation === 'function') {
          registerExamTabViolation('split');
        }
        window.__splitScreenSubmitting = false;
      }, SPLIT_SCREEN_SUBMIT_MS);
    }
    return;
  }

  if (window.__splitScreenWarnShown || splitScreenTimer || splitScreenCountdownInterval) {
    resolveSplitScreenWarningCleared();
    return;
  }

  hideSplitScreenWarningModal();
  clearSplitScreenTimer();
}

function startSplitScreenMonitor() {
  stopSplitScreenMonitor();
  if (!isSplitScreenEnabled()) return;
  captureSplitScreenBaseline();
  window.__splitScreenWarnShown = false;
  window.__splitScreenSubmitting = false;
  handleSplitScreenCheck();

  window._splitScreenResizeHandler = () => {
    clearTimeout(window._splitScreenResizeDebounce);
    window._splitScreenResizeDebounce = setTimeout(handleSplitScreenCheck, 200);
  };

  window.addEventListener('resize', window._splitScreenResizeHandler);
  window._splitScreenOrientationHandler = () => {
    setTimeout(() => {
      if (!window.__splitScreenWarnShown && !isSplitScreenLikely()) {
        captureSplitScreenBaseline();
      }
      handleSplitScreenCheck();
    }, 350);
  };
  window.addEventListener('orientationchange', window._splitScreenOrientationHandler);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', window._splitScreenResizeHandler);
  }

  window._splitScreenInterval = setInterval(handleSplitScreenCheck, 1000);
}

function stopSplitScreenMonitor() {
  clearSplitScreenTimer();
  hideSplitScreenWarningModal();
  if (window._splitScreenResizeDebounce) {
    clearTimeout(window._splitScreenResizeDebounce);
    window._splitScreenResizeDebounce = null;
  }
  if (window._splitScreenInterval) {
    clearInterval(window._splitScreenInterval);
    window._splitScreenInterval = null;
  }
  if (window._splitScreenResizeHandler) {
    window.removeEventListener('resize', window._splitScreenResizeHandler);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', window._splitScreenResizeHandler);
    }
    delete window._splitScreenResizeHandler;
  }
  if (window._splitScreenOrientationHandler) {
    window.removeEventListener('orientationchange', window._splitScreenOrientationHandler);
    delete window._splitScreenOrientationHandler;
  }
  window.__splitScreenWarnShown = false;
  window.__splitScreenSubmitting = false;
  splitScreenBaseline = null;
}

window.isSplitScreenLikely = isSplitScreenLikely;
window.isSplitScreenEnabled = isSplitScreenEnabled;
window.startSplitScreenMonitor = startSplitScreenMonitor;
window.stopSplitScreenMonitor = stopSplitScreenMonitor;
window.hideSplitScreenWarningModal = hideSplitScreenWarningModal;

