function setupInteractiveListeners() {
  const safeAdd = (id, event, callback) => { const el = document.getElementById(id); if (el) el.addEventListener(event, callback); };

  document.querySelectorAll('.collapse-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sidebarCollapsed = !sidebarCollapsed;
      const sb = document.getElementById('system-sidebar');
      if (sb) {
        sb.classList.toggle('collapsed', sidebarCollapsed);
      }
      const submenu = document.getElementById('settings-submenu');
      if (submenu && sidebarCollapsed) {
        submenu.classList.add('hidden');
        submenu.classList.remove('flex');
      }
    });
  });

  safeAdd('btn-settings-dropdown-toggle', 'click', (e) => {
    e.stopPropagation();
    const submenu = document.getElementById('settings-submenu');
    const arrow = document.getElementById('settings-dropdown-arrow');
    if (submenu) {
      const isHidden = submenu.classList.contains('hidden');
      submenu.classList.toggle('hidden', !isHidden);
      submenu.classList.toggle('flex', isHidden);
      if (arrow) {
        arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    }
  });

  document.querySelectorAll('#settings-submenu .nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (sidebarCollapsed) {
        const submenu = document.getElementById('settings-submenu');
        if (submenu) {
          submenu.classList.add('hidden');
          submenu.classList.remove('flex');
        }
      }
    });
  });

  document.addEventListener('click', (e) => {
    if (sidebarCollapsed) {
      const dropdownGroup = document.querySelector('.sidebar-dropdown-group');
      const submenu = document.getElementById('settings-submenu');
      if (dropdownGroup && submenu && !dropdownGroup.contains(e.target)) {
        submenu.classList.add('hidden');
        submenu.classList.remove('flex');
      }
    }
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    const viewId = btn.getAttribute('data-nav');
    if (viewId) btn.addEventListener('click', () => switchView(viewId));
  });

  safeAdd('btn-sidebar-logout', 'click', handleLogout);
  safeAdd('excel-import-file', 'change', handleExcelImportSiswa);
  safeAdd('docx-import-file', 'change', handleDOCXImportSoal);
  safeAdd('import-database-file', 'change', handleImportDatabase);
  safeAdd('btn-download-template', 'click', downloadSiswaTemplate);
  safeAdd('btn-download-word-template', 'click', downloadWordTemplate);
  safeAdd('btn-generate-students-password', 'click', handleGenerateStudentsPassword);
  safeAdd('btn-add-student-manual', 'click', handleAddStudentManual);
  safeAdd('btn-delete-all-students', 'click', handleDeleteAllStudents);
  safeAdd('btn-download-kartu-ujian', 'click', handleDownloadKartuUjian);
  safeAdd('btn-add-admin', 'click', handleAddAdminManual);
  safeAdd('btn-add-schedule', 'click', handleAddSchedule);
  safeAdd('btn-export-database', 'click', handleExportDatabase);
  safeAdd('btn-delete-all-questions', 'click', handleDeleteAllQuestions);
  safeAdd('btn-delete-all-schedules', 'click', handleDeleteAllSchedules);
  safeAdd('btn-delete-exam-answers', 'click', handleDeleteExamAnswers);
  safeAdd('btn-purge-database', 'click', askPurgeDatabaseTotal);
  safeAdd('btn-generate-all-tokens', 'click', handleGenerateAllTokens);
  safeAdd('btn-refresh-database', 'click', askRefreshDatabase);
  safeAdd('btn-refresh-monitor', 'click', askRefreshDatabase);
  safeAdd('btn-save-manual-question', 'click', (e) => { e.preventDefault(); handleSaveManualQuestion(); });
  safeAdd('btn-clear-manual-question', 'click', (e) => { e.preventDefault(); clearManualQuestionTextarea(); });
  safeAdd('tab-banksoal-create', 'click', () => setBankSoalTab('create'));
  safeAdd('tab-banksoal-packets', 'click', () => setBankSoalTab('packets'));
  safeAdd('tab-banksoal-view', 'click', () => setBankSoalTab('view'));
  safeAdd('btn-global-monitor-chat', 'click', triggerGlobalMonitorChat);
  safeAdd('btn-reset-all-sessions', 'click', handleResetAllSessions);
  safeAdd('btn-export-results-report', 'click', handleExportResultsReport);
  safeAdd('btn-export-item-analysis-report', 'click', handleExportItemAnalysisReport);

  const debouncedRenderStudents = debounce(() => runAdminFilterRender('students', renderStudentsCards));
  const debouncedRenderMonitor = debounce(() => runAdminFilterRender('monitor', renderActiveMonitorList));
  const debouncedRenderResults = debounce(() => runAdminFilterRender('results', renderResultsCards));
  const debouncedRenderBankSoal = debounce(() => runAdminFilterRender('banksoal', renderBankSoalQuestionList));
  const debouncedRenderDashboard = debounce(() => runAdminFilterRender('dashboard', renderDashboardActiveExamsTable));

  const ss = document.getElementById('search-student'); if (ss) ss.addEventListener('input', debouncedRenderStudents);
  const fs = document.getElementById('filter-student-class'); if (fs) fs.addEventListener('change', () => { preserveScrollWhile(() => { resetPageNumber('students'); renderStudentsCards(); }); });
  const sps = document.getElementById('students-page-size'); if (sps) sps.addEventListener('change', () => { preserveScrollWhile(() => { resetPageNumber('students'); renderStudentsCards(); }); });
  const ms = document.getElementById('filter-monitor-search'); if (ms) ms.addEventListener('input', debouncedRenderMonitor);
  const mk = document.getElementById('filter-monitor-kelas'); if (mk) mk.addEventListener('change', () => { preserveScrollWhile(() => { resetPageNumber('monitor'); renderActiveMonitorList(); }); });
  const mt = document.getElementById('filter-monitor-status'); if (mt) mt.addEventListener('change', () => { preserveScrollWhile(() => { resetPageNumber('monitor'); renderActiveMonitorList(); }); });
  const mps = document.getElementById('monitor-page-size'); if (mps) mps.addEventListener('change', () => { preserveScrollWhile(() => { resetPageNumber('monitor'); renderActiveMonitorList(); }); });
  const rs = document.getElementById('filter-result-search'); if (rs) rs.addEventListener('input', debouncedRenderResults);
  const rk = document.getElementById('filter-result-kelas'); if (rk) rk.addEventListener('change', () => { preserveScrollWhile(() => { resetPageNumber('results'); renderResultsCards(); }); });
  const rm = document.getElementById('filter-result-mapel'); if (rm) rm.addEventListener('change', () => { preserveScrollWhile(() => { resetPageNumber('results'); renderResultsCards(); }); });
  const rsort = document.getElementById('filter-result-sort'); if (rsort) rsort.addEventListener('change', () => { preserveScrollWhile(() => { resetPageNumber('results'); renderResultsCards(); }); });
  const rp = document.getElementById('result-page-size'); if (rp) rp.addEventListener('change', () => { preserveScrollWhile(() => { resetPageNumber('results'); renderResultsCards(); }); });
  const fb = document.getElementById('filter-banksoal-packet'); if (fb) fb.addEventListener('change', () => { preserveScrollWhile(() => { resetPageNumber('banksoal'); renderBankSoalQuestionList(); }); });
  const sq = document.getElementById('search-banksoal-question'); if (sq) sq.addEventListener('input', debouncedRenderBankSoal);
  const bps = document.getElementById('banksoal-page-size'); if (bps) bps.addEventListener('change', () => { preserveScrollWhile(() => { resetPageNumber('banksoal'); renderBankSoalQuestionList(); }); });

  const sdm = document.getElementById('search-dashboard-mapel'); if (sdm) sdm.addEventListener('input', debouncedRenderDashboard);

  const fdk = document.getElementById('filter-dashboard-kelas'); if (fdk) fdk.addEventListener('change', () => { preserveScrollWhile(() => { resetPageNumber('dashboard'); renderDashboardActiveExamsTable(); }); });
  const dps = document.getElementById('dashboard-page-size'); if (dps) dps.addEventListener('change', () => { preserveScrollWhile(() => { resetPageNumber('dashboard'); renderDashboardActiveExamsTable(); }); });

  safeAdd('btn-header-profile', 'click', (e) => {
    e.stopPropagation();
    const dd = document.getElementById('header-profile-dropdown');
    if (dd) dd.classList.toggle('hidden');
  });
  document.addEventListener('click', () => {
    const dd = document.getElementById('header-profile-dropdown');
    if (dd) dd.classList.add('hidden');
  });
  safeAdd('btn-profile-change-password', 'click', () => {
    if (CURRENT_USER && CURRENT_USER.role === 'admin') {
      triggerEditAdmin(CURRENT_USER.username);
    }
  });
  safeAdd('btn-profile-logout', 'click', handleLogout);
}

function handleLogout() {
  mySessionStorage.removeItem('cbt-session');
  stopAdminRealtimeListeners();
  CURRENT_USER = null;
  window.location.href = 'index.html';
}

if (typeof renderResultsCards === 'function') window.renderResultsCards = renderResultsCards;
if (typeof renderActiveMonitorList === 'function') window.renderActiveMonitorList = renderActiveMonitorList;
if (typeof renderStudentsCards === 'function') window.renderStudentsCards = renderStudentsCards;
if (typeof renderSchedules === 'function') window.renderSchedules = renderSchedules;
if (typeof renderPacketsCards === 'function') window.renderPacketsCards = renderPacketsCards;
if (typeof renderBankSoalQuestionList === 'function') window.renderBankSoalQuestionList = renderBankSoalQuestionList;
if (typeof renderDashboardActiveExamsTable === 'function') window.renderDashboardActiveExamsTable = renderDashboardActiveExamsTable;
if (typeof renderAdminsCards === 'function') window.renderAdminsCards = renderAdminsCards;
if (typeof refreshCachedDashboardStats === 'function') window.refreshCachedDashboardStats = refreshCachedDashboardStats;
if (typeof updateAdminTokenBars === 'function') window.updateAdminTokenBars = updateAdminTokenBars;
if (typeof updateClassSelectors === 'function') window.updateClassSelectors = updateClassSelectors;
if (typeof refreshResultMapelDropdown === 'function') window.refreshResultMapelDropdown = refreshResultMapelDropdown;
if (typeof refreshBankSoalDropdowns === 'function') window.refreshBankSoalDropdowns = refreshBankSoalDropdowns;

async function initAdminPage() {
  if (typeof safeCreateIcons === 'function') safeCreateIcons();
  if (typeof setupInteractiveListeners === 'function') setupInteractiveListeners();

  if (typeof applyTheme === 'function') applyTheme();
  if (typeof initAppSettingsElements === 'function') initAppSettingsElements();
  try {
    if (typeof initAppSettings === 'function') await initAppSettings();
  } catch (err) {
    console.warn('initAppSettings failed', err);
  }
  if (typeof initDatabaseConfigUI === 'function') initDatabaseConfigUI();
  if (typeof refreshAppSettingsFromCloud === 'function') refreshAppSettingsFromCloud();
  if (typeof initAdminHeaderAutoFit === 'function') initAdminHeaderAutoFit();
  if (typeof initAdminSelectionGuard === 'function') initAdminSelectionGuard();
  if (typeof initAdminPortraitRenderGuard === 'function') initAdminPortraitRenderGuard();
  if (typeof startAppSettingsListener === 'function') {
    startAppSettingsListener(typeof debouncedRefreshAppSettingsFromCloud === 'function' ? debouncedRefreshAppSettingsFromCloud : null);
  }
  window.addEventListener('storage', () => {
    if (typeof debouncedRefreshAppSettingsFromCloud === 'function') debouncedRefreshAppSettingsFromCloud();
  });
  window.addEventListener('focus', () => {
    if (typeof debouncedRefreshAppSettingsFromCloud === 'function') debouncedRefreshAppSettingsFromCloud();
    if (typeof CURRENT_ADMIN_VIEW !== 'undefined' && CURRENT_ADMIN_VIEW === 'admin-results' && typeof refreshResultsFromDatabase === 'function') refreshResultsFromDatabase();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (typeof debouncedRefreshAppSettingsFromCloud === 'function') debouncedRefreshAppSettingsFromCloud();
      if (typeof CURRENT_ADMIN_VIEW !== 'undefined' && CURRENT_ADMIN_VIEW === 'admin-results' && typeof refreshResultsFromDatabase === 'function') refreshResultsFromDatabase();
    }
  });
  if (typeof toggleLoader === 'function') toggleLoader(true, 'MENGHUBUNGKAN...');
  try {
    if (typeof initAuth === 'function') await initAuth();
    if (typeof checkSavedSession === 'function') checkSavedSession();
  } catch (err) {
    if (typeof showNotification === 'function') showNotification('Koneksi Gagal', 'Gagal menghubungi server.', 'danger');
  } finally {
    if (typeof toggleLoader === 'function') toggleLoader(false);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminPage);
} else {
  initAdminPage();
}
