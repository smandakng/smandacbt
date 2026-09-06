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
    if (typeof loadSecuritySettingsFromCloud === 'function') await loadSecuritySettingsFromCloud(true);
  } catch (err) {
    console.warn('initAppSettings / loadSecuritySettingsFromCloud failed', err);
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
  sheet.classList.toggle('hidden', !show);
  sheet.classList.toggle('flex', !!show);
  document.body.style.overflow = show || document.body.classList.contains('exam-mode') ? 'hidden' : '';
};

window.toggleMobileFontSizeSheet = function (show) {
  const sheet = document.getElementById('mobile-fontsize-sheet');
  if (!sheet) return;
  sheet.classList.toggle('hidden', !show);
  sheet.classList.toggle('flex', !!show);
  document.body.style.overflow = show || document.body.classList.contains('exam-mode') ? 'hidden' : '';
};

window.toggleMobileCombinedMenu = function (show) {
  const menu = document.getElementById('mobileCombinedMenu');
  if (!menu) return;
  if (typeof show === 'boolean') {
    if (show) menu.classList.remove('hidden');
    else menu.classList.add('hidden');
  } else {
    menu.classList.toggle('hidden');
  }
  if (typeof safeCreateIcons === 'function') safeCreateIcons();
};
