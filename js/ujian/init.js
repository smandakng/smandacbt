async function initExamPage() {
  if (typeof safeCreateIcons === 'function') safeCreateIcons();
  if (typeof applyTheme === 'function') applyTheme();
  if (typeof initAdminHeaderAutoFit === 'function') initAdminHeaderAutoFit();
  if (typeof initAppSettingsElements === 'function') {
    initAppSettingsElements({
      headerLogo: 'exam-header-logo',
      headerName: 'exam-header-school-name',
      headerExam: 'exam-header-exam-title'
    });
  }
  try {
    if (typeof initAppSettings === 'function') await initAppSettings();
  } catch (err) {
    console.warn('initAppSettings failed', err);
  }
  if (typeof renderAppSettingsUI === 'function') renderAppSettingsUI();
  if (typeof populateExamHeader === 'function') populateExamHeader();
  if (typeof setupInteractiveListeners === 'function') setupInteractiveListeners();
  if (typeof toggleLoader === 'function') toggleLoader(true, 'MENGHUBUNGKAN...');
  try {
    if (typeof initAuth === 'function') await initAuth();
    if (typeof checkSavedSession === 'function') await checkSavedSession();
  } catch (err) {
    if (typeof showNotification === 'function') showNotification('Koneksi Gagal', 'Gagal menghubungi server.', 'danger');
  } finally {
    if (!window.__examStarted && !window.__examSubmitInFlight && typeof toggleLoader === 'function') {
      toggleLoader(false);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initExamPage);
} else {
  initExamPage();
}

window.toggleMobileSheet = function (show) {
  const sheet = document.getElementById('mobile-bottom-sheet');
  if (!sheet) return;
  if (show) {
    sheet.classList.remove('hidden');
    sheet.classList.add('flex');
    document.body.style.overflow = 'hidden';
  } else {
    sheet.classList.add('hidden');
    sheet.classList.remove('flex');
    if (document.body.classList.contains('exam-mode')) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
}
