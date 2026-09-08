function checkSavedSession() {
  const sessionStr = mySessionStorage.getItem('cbt-session');
  if (!sessionStr) {
    window.location.href = 'index.html';
    return Promise.resolve();
  }

  try {
    const user = JSON.parse(sessionStr);
    if (user.role !== 'student') {
      window.location.href = 'index.html';
      return Promise.resolve();
    }
    return setupSessionEnvironment(user);
  } catch (err) {
    mySessionStorage.removeItem('cbt-session');
    window.location.href = 'index.html';
    return Promise.resolve();
  }
}

function setupSessionEnvironment(user) {
  const isMobile = typeof isMobileDevice === 'function'
    ? isMobileDevice()
    : /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  const isApproved = typeof isExamBrowserEnvironment === 'function'
    ? isExamBrowserEnvironment()
    : false;
  const lockMobile = typeof isMobileBrowserLockEnabled === 'function'
    ? isMobileBrowserLockEnabled()
    : true;
  const requirePinning = typeof isAppPinningRequired === 'function'
    ? isAppPinningRequired()
    : true;
  const isPinned = typeof isExamAppPinned === 'function'
    ? isExamAppPinned()
    : false;

  // 1. Jika mode penguncian browser HP diaktifkan, cegah browser biasa (Chrome/Safari standar)
  if (isMobile && lockMobile && !isApproved) {
    mySessionStorage.setItem('cbt-login-status-msg', JSON.stringify({
      variant: 'error',
      title: 'Browser Tidak Diizinkan',
      message: 'Ujian di perangkat HP/Tablet wajib menggunakan aplikasi CBT Exam Browser / Exambro resmi.',
      lucideIcon: 'shield-alert'
    }));
    mySessionStorage.removeItem('cbt-session');
    window.location.href = 'index.html';
    return Promise.resolve();
  }

  // 2. Jika sematan aplikasi diwajibkan di lingkungan aplikasi CBT mobile, pastikan sudah di-pin
  if (requirePinning && isMobile && isApproved && !isPinned) {
    mySessionStorage.setItem('cbt-login-status-msg', JSON.stringify({
      variant: 'error',
      title: 'Aplikasi Belum Disematkan',
      message: 'Aplikasi CBT Exam Browser / Safe Exam Browser wajib disematkan (App Pinning / Guided Access). Anda telah dikeluarkan dari ujian.',
      lucideIcon: 'shield-alert'
    }));
    mySessionStorage.removeItem('cbt-session');
    window.location.href = 'index.html';
    return Promise.resolve();
  }

  CURRENT_USER = user;
  window.__examFinalized = false;
  window.__examStarted = false;
  window.__examSaveOnExitDone = false;

  const mainSystemView = document.getElementById('main-system-view');
  document.body.classList.add('exam-mode');
  if (mainSystemView) {
    mainSystemView.classList.remove('hidden');
  }

  return initStudentExamView();
}

function isStudentExamActive() {
  return CURRENT_USER && CURRENT_USER.role === 'student' && isExamPageActiveFlag();
}

function markExamPageActive() {
  markExamPageActiveFlag();
}

function clearExamPageActive() {
  clearExamPageActiveFlag();
}

function wasPageReloaded() {
  const navEntry = performance.getEntriesByType('navigation')[0];
  return navEntry?.type === 'reload';
}

function showRefreshBlockedWarning() {
  if (!isStudentExamActive()) return;
  showNotification("Peringatan", "Refresh halaman dilarang selama ujian berlangsung!", "danger");
}

function handleBeforeUnload(e) {
  if (!isStudentExamActive()) return;
  e.preventDefault();
  e.returnValue = 'Ujian sedang berlangsung. Refresh halaman dilarang dan dapat mengakhiri ujian.';
  return e.returnValue;
}

function handleExamPageShow(e) {
  if (e.persisted && isStudentExamActive()) {
    if (typeof registerExamTabViolation === 'function') {
      registerExamTabViolation('reload');
    } else {
      showNotification("Peringatan", "Refresh halaman dilarang selama ujian berlangsung!", "danger");
    }
  }
}
