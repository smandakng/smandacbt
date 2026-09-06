function getPageNumber(key) {
  return PAGINATION_STATE[key] || 1;
}

function setPageNumber(key, page) {
  PAGINATION_STATE[key] = Math.max(1, page);
}

function resetPageNumber(key) {
  PAGINATION_STATE[key] = 1;
}

function isAdminPortraitMobile() {
  return window.matchMedia('(orientation: portrait) and (max-width: 1024px)').matches;
}

function shouldDeferAdminRealtimeRender() {
  if (isAdminPortraitMobile()) return true;
  if (typeof hasActiveTextSelectionIn === 'function' && hasActiveTextSelectionIn()) return true;
  if (typeof hasActiveTokenSelection === 'function' && hasActiveTokenSelection()) return true;
  return false;
}

function runAdminRealtimeDomUpdate(fn) {
  if (isAdminPortraitMobile()) return;
  const fnKey = fn.toString();
  if (adminDomUpdateTimers[fnKey]) return;
  adminDomUpdateTimers[fnKey] = setTimeout(() => {
    delete adminDomUpdateTimers[fnKey];
    fn();
  }, 2000);
}

function renderCurrentAdminView() {
  const viewId = CURRENT_ADMIN_VIEW;
  if (viewId === 'admin-dashboard') {
    renderDashboardActiveExamsTable();
    updateAdminTokenBars(true);
  } else if (viewId === 'admin-monitor') renderActiveMonitorList();
  else if (viewId === 'admin-students') renderStudentsCards();
  else if (viewId === 'admin-results') {
    refreshResultsFromDatabase();
  } else if (viewId === 'admin-banksoal') renderBankSoalQuestionList();
  else if (viewId === 'admin-admins') renderAdminsCards();
  else if (viewId === 'admin-schedule') renderSchedules();
  else if (viewId === 'admin-settings-security') renderSecuritySettingsForm();
  else if (viewId === 'admin-settings-barcode') renderBarcodeSettingsForm();
}

async function renderSecuritySettingsForm() {
  const settings = await loadSecuritySettingsFromCloud();
  const checkboxLock = document.getElementById('input-lock-mobile-browser');
  const checkboxOperator = document.getElementById('input-show-operator-login-link');
  const checkboxSplit = document.getElementById('input-enable-split-screen');
  const checkboxFull = document.getElementById('input-enable-fullscreen');
  const checkboxOverlay = document.getElementById('input-enable-overlay-detection');
  const checkboxPinning = document.getElementById('input-require-app-pinning');
  const inputMax = document.getElementById('input-max-violations');
  if (checkboxLock) {
    checkboxLock.checked = Boolean(settings?.lockMobileBrowser);
  }
  if (checkboxOperator) {
    checkboxOperator.checked = Boolean(settings?.showOperatorLoginLink);
  }
  if (checkboxSplit) {
    checkboxSplit.checked = settings?.enableSplitScreen !== undefined ? Boolean(settings?.enableSplitScreen) : true;
  }
  if (checkboxFull) {
    checkboxFull.checked = settings?.enableFullscreen !== undefined ? Boolean(settings?.enableFullscreen) : true;
  }
  if (checkboxOverlay) {
    checkboxOverlay.checked = settings?.enableOverlayDetection !== undefined ? Boolean(settings?.enableOverlayDetection) : true;
  }
  if (checkboxPinning) {
    checkboxPinning.checked = settings?.requireAppPinning !== undefined ? Boolean(settings?.requireAppPinning) : true;
  }
  if (inputMax) {
    inputMax.value = settings?.maxViolations || 3;
  }
}

async function commitSecuritySettingsFromForm() {
  const checkboxLock = document.getElementById('input-lock-mobile-browser');
  const checkboxOperator = document.getElementById('input-show-operator-login-link');
  const checkboxSplit = document.getElementById('input-enable-split-screen');
  const checkboxFull = document.getElementById('input-enable-fullscreen');
  const checkboxOverlay = document.getElementById('input-enable-overlay-detection');
  const checkboxPinning = document.getElementById('input-require-app-pinning');
  const inputMax = document.getElementById('input-max-violations');
  const isLocked = checkboxLock ? checkboxLock.checked : true;
  const showOperator = checkboxOperator ? checkboxOperator.checked : true;
  const enableSplit = checkboxSplit ? checkboxSplit.checked : true;
  const enableFull = checkboxFull ? checkboxFull.checked : true;
  const enableOverlay = checkboxOverlay ? checkboxOverlay.checked : true;
  const requirePinning = checkboxPinning ? checkboxPinning.checked : true;
  const maxViolations = inputMax ? Math.max(1, Math.min(10, Number(inputMax.value) || 3)) : 3;
  await saveSecuritySettingsToCloud(isLocked, showOperator, enableSplit, enableFull, maxViolations, enableOverlay, requirePinning);
  showToast('Pengaturan Keamanan Ujian berhasil disimpan.', 'success');
}

window.commitSecuritySettings = () => commitSecuritySettingsFromForm();

var activeQrInstance = null;

async function renderBarcodeSettingsForm() {
  const settings = await loadBarcodeSettingsFromCloud();
  const titleInput = document.getElementById('input-barcode-title');
  const urlInput = document.getElementById('input-barcode-url');

  if (titleInput) titleInput.value = settings.barcodeTitle || 'Scan CBT Android';
  if (urlInput) urlInput.value = settings.barcodeUrl || getDefaultBarcodeUrl();

  generateBarcodePreview();
}

function generateBarcodePreview() {
  const titleInput = document.getElementById('input-barcode-title');
  const urlInput = document.getElementById('input-barcode-url');
  const canvas = document.getElementById('barcode-preview-canvas');
  const previewText = document.getElementById('barcode-preview-url-text');

  const title = (titleInput?.value || 'Scan CBT Android').trim();
  const url = (urlInput?.value || getDefaultBarcodeUrl()).trim();

  if (previewText) previewText.textContent = url;

  if (canvas && typeof QRious !== 'undefined') {
    activeQrInstance = new QRious({
      element: canvas,
      value: url,
      size: 240,
      level: 'H'
    });
  }
}

async function commitBarcodeSettingsFromForm() {
  const titleInput = document.getElementById('input-barcode-title');
  const urlInput = document.getElementById('input-barcode-url');

  const title = (titleInput?.value || 'Scan CBT Android').trim();
  const url = (urlInput?.value || getDefaultBarcodeUrl()).trim();

  if (typeof toggleLoader === 'function') toggleLoader(true);
  try {
    await saveBarcodeSettingsToCloud(title, url);
    generateBarcodePreview();
    showToast('Pengaturan Barcode berhasil disimpan dan diperbarui.', 'success');
  } catch (err) {
    console.error('commitBarcodeSettingsFromForm error:', err);
    showToast('Gagal menyimpan pengaturan barcode ke database.', 'error');
  } finally {
    if (typeof toggleLoader === 'function') toggleLoader(false);
  }
}

function printBarcodePDF() {
  const titleInput = document.getElementById('input-barcode-title');
  const urlInput = document.getElementById('input-barcode-url');
  const canvas = document.getElementById('barcode-preview-canvas');

  const title = (titleInput?.value || 'Scan CBT Android').trim();
  const url = (urlInput?.value || getDefaultBarcodeUrl()).trim();
  const appSettings = readAppSettingsFromLocal();
  const schoolName = appSettings.schoolName || 'SMA NEGERI 2 KUNINGAN';
  const examTitle = appSettings.examTitle || 'Asesmen Sumatif Akhir Tahun';

  if (!canvas || typeof jspdf === 'undefined') {
    showToast('Pustaka PDF belum siap.', 'error');
    return;
  }

  try {
    const { jsPDF } = jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Outer Frame with rounded corners
    const margin = 15;
    const cardW = pageWidth - (margin * 2);
    const cardH = pageHeight - (margin * 2) - 10;

    doc.setDrawColor(90, 105, 120);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, margin, cardW, cardH, 6, 6, 'D');

    // 1. School Name
    let currentY = 32;
    doc.setTextColor(15, 23, 42); // slate-900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(schoolName.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });

    // 2. Exam Subtitle
    currentY += 11;
    doc.setTextColor(51, 65, 85); // slate-700
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(examTitle, pageWidth / 2, currentY, { align: 'center' });

    // 3. Pill Badge for Title
    currentY += 15;
    const badgeW = Math.max(75, doc.getTextWidth(title) + 24);
    const badgeH = 12;
    const badgeX = (pageWidth - badgeW) / 2;

    doc.setDrawColor(59, 130, 246); // blue-500
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(badgeX, currentY, badgeW, badgeH, 6, 6, 'FD');

    doc.setTextColor(37, 99, 235); // blue-600
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, pageWidth / 2, currentY + 8, { align: 'center' });

    // 4. Dashed Container around QR Code
    currentY += 22;
    const qrContainerSize = 114;
    const qrContainerX = (pageWidth - qrContainerSize) / 2;
    const qrContainerY = currentY;

    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(qrContainerX, qrContainerY, qrContainerSize, qrContainerSize, 'D');
    doc.setLineDashPattern([], 0); // reset line dash

    // Add QR Code Image inside container
    const qrDataUrl = canvas.toDataURL('image/png');
    const qrSize = 104;
    const qrX = (pageWidth - qrSize) / 2;
    const qrY = qrContainerY + (qrContainerSize - qrSize) / 2;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // 5. URL Box Below QR Code
    currentY = qrContainerY + qrContainerSize + 5;
    const urlBoxW = cardW - 30;
    const urlBoxH = 10;
    const urlBoxX = (pageWidth - urlBoxW) / 2;

    doc.setDrawColor(241, 245, 249); // slate-100
    doc.setFillColor(248, 250, 252); // slate-50
    doc.roundedRect(urlBoxX, currentY, urlBoxW, urlBoxH, 2, 2, 'FD');

    doc.setFont('courier', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`URL: ${url}`, pageWidth / 2, currentY + 6.5, { align: 'center' });

    // 6. Instructions Section with Left Blue Vertical Accent Bar
    currentY += 28; // 2x enter gap below URL box
    const instrLeftX = margin + 12;
    const barX = instrLeftX;
    const barTopY = currentY - 3;
    const barH = 34;

    // Draw Left Vertical Blue Accent Bar (Thinned line width 1.2mm)
    doc.setFillColor(37, 99, 235); // blue-600 accent bar
    doc.roundedRect(barX, barTopY, 1.2, barH, 0.6, 0.6, 'F');

    const textX = barX + 6;

    // Draw Vector Pin Icon (Red Pin head + Metallic needle)
    const pinX = textX + 1.5;
    const pinY = currentY - 2.5;

    // Needle
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.7);
    doc.line(pinX - 1.2, pinY + 1.2, pinX - 3.2, pinY + 3.8);

    // Pin head (Red circle & body)
    doc.setFillColor(225, 29, 72); // rose-600
    doc.setDrawColor(190, 18, 60);
    doc.setLineWidth(0.3);
    doc.circle(pinX, pinY, 2.2, 'FD');

    // Pin cap highlight
    doc.setFillColor(251, 113, 133);
    doc.circle(pinX - 0.6, pinY - 0.6, 0.7, 'F');

    // Header Title
    const titleX = textX + 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(37, 99, 235); // blue-600
    doc.text('Petunjuk Akses Ujian untuk Siswa:', titleX, currentY);

    // Bullet 1
    currentY += 8.5;
    const bulletX = textX + 1;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85); // slate-700
    doc.text('•  Perangkat iPhone / Android :', bulletX, currentY);

    const b1PrefixW = doc.getTextWidth('•  Perangkat iPhone / Android : ');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text('Buka aplikasi SEB (iPhone) / CBT Exam Browser (Android),', bulletX + b1PrefixW, currentY);

    currentY += 5.5;
    const indentSubX = bulletX + doc.getTextWidth('•  ');
    doc.text('kemudian Scan Barcode untuk membuka halaman login.', indentSubX, currentY);

    // Bullet 2
    currentY += 7.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('•  Pastikan perangkat Anda terhubung dengan internet.', bulletX, currentY);

    doc.save(`Barcode_Login_CBT_${title.replace(/\s+/g, '_')}.pdf`);
    showToast('Berkas PDF Barcode berhasil diunduh.', 'success');
  } catch (err) {
    console.error('printBarcodePDF error', err);
    showToast('Gagal mencetak PDF Barcode.', 'error');
  }
}

window.generateBarcodePreview = generateBarcodePreview;
window.commitBarcodeSettings = () => commitBarcodeSettingsFromForm();
window.printBarcodePDF = printBarcodePDF;

function renderIfViewActive(viewId, fn) {
  if (CURRENT_ADMIN_VIEW !== viewId) return;
  if (shouldDeferAdminRealtimeRender()) {
    window.__deferredAdminRender = window.__deferredAdminRender || {};
    window.__deferredAdminRender[viewId] = fn;
    return;
  }
  fn();
}

function flushDeferredAdminRenders() {
  if (shouldDeferAdminRealtimeRender()) return;
  const deferred = window.__deferredAdminRender;
  if (deferred) {
    Object.keys(deferred).forEach((viewId) => {
      if (CURRENT_ADMIN_VIEW === viewId && typeof deferred[viewId] === 'function') {
        deferred[viewId]();
        delete deferred[viewId];
      }
    });
  }
  if (window.__deferredUpdateAdminTokenBars) {
    window.__deferredUpdateAdminTokenBars = false;
    updateAdminTokenBars(true);
  }
}

function initAdminPortraitRenderGuard() {
  if (window.__adminPortraitRenderGuardBound) return;
  window.__adminPortraitRenderGuardBound = true;
  let layoutTimer;
  const handleAdminLayoutChange = () => {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(() => {
      if (!isAdminPortraitMobile() && CURRENT_USER?.role === 'admin') {
        flushDeferredAdminRenders();
        renderCurrentAdminView();
        updateAdminTokenBars(true);
        refreshCachedDashboardStats(true);
      }
    }, 250);
  };
  window.addEventListener('orientationchange', handleAdminLayoutChange);
  window.addEventListener('resize', handleAdminLayoutChange);
}

function initAdminSelectionGuard() {
  if (window.__adminSelectionGuardBound) return;
  window.__adminSelectionGuardBound = true;
  let selectionFlushTimer;
  document.addEventListener('selectionchange', () => {
    clearTimeout(selectionFlushTimer);
    selectionFlushTimer = setTimeout(flushDeferredAdminRenders, 120);
  });
}

function runAdminFilterRender(key, renderFn) {
  preserveScrollWhile(() => {
    resetPageNumber(key);
    renderFn();
  });
}

window.processLocalLogo = processLocalLogoUpload;
window.commitSettings = () => commitAppSettingsFromForm();
window.resetSettingsToDefault = () => resetAppSettingsToDefault();
window.toggleGlobalClass = function (grade, checked, nameAttr) {
  const checkboxes = document.querySelectorAll(`input[name="${nameAttr}"]`);
  checkboxes.forEach(cb => {
    const val = cb.value.toUpperCase().trim();
    let match = false;
    if (grade === 'X') {
      match = (val.startsWith('X') && !val.startsWith('XI') && !val.startsWith('XII')) || val.startsWith('10') || val.startsWith('KLS X') || val.startsWith('KLS 10');
    } else if (grade === 'XI') {
      match = (val.startsWith('XI') && !val.startsWith('XII')) || val.startsWith('11') || val.startsWith('KLS XI') || val.startsWith('KLS 11');
    } else if (grade === 'XII') {
      match = val.startsWith('XII') || val.startsWith('12') || val.startsWith('KLS XII') || val.startsWith('KLS 12');
    }
    if (match) {
      cb.checked = checked;
    }
  });
};

window.switchView = function (viewId) {
  document.querySelectorAll('.page-view').forEach(view => view.classList.add('hidden'));
  const activePage = document.getElementById(`view-${viewId}`);
  if (activePage) activePage.classList.remove('hidden');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    const isMobileNav = btn.closest('#mobile-admin-nav');
    const isSubmenuItem = btn.closest('#settings-submenu');
    const isMobileSettingsTab = btn.closest('.settings-mobile-tabs');
    const icon = btn.querySelector('i');
    const navVal = btn.getAttribute('data-nav');
    const isActive = (navVal === viewId) || (isMobileNav && navVal === 'admin-settings' && viewId.startsWith('admin-settings'));

    if (isActive) {
      if (isMobileNav) {
        btn.className = "nav-btn flex flex-col items-center justify-center w-full h-full text-[#3b82f6] transition-colors relative pt-1 active:scale-95";
      } else if (isSubmenuItem) {
        btn.className = "nav-btn group flex items-center px-3 py-2 rounded-md text-white bg-blue-600/40 font-bold text-xs transition-all w-full text-left border border-blue-400/30";
        if (icon) {
          icon.className = "far fa-dot-circle text-[10px] mr-2.5 text-[#3b82f6]";
        }
      } else if (isMobileSettingsTab) {
        btn.className = "nav-btn settings-tab-btn flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white font-extrabold text-[11px] sm:text-xs shadow-sm transition-all whitespace-nowrap";
      } else {
        btn.className = `nav-btn flex items-center px-3 py-2.5 mx-3 mb-1 bg-white/20 text-white rounded-md border border-white/30 shadow-md transition-all duration-300 ${sidebarCollapsed ? 'justify-center px-0' : ''}`;
        if (icon) {
          icon.classList.remove('text-[#9db9d8]');
          icon.classList.add('text-[#3b82f6]');
        }
      }
    } else {
      if (isMobileNav) {
        btn.className = "nav-btn flex flex-col items-center justify-center w-full h-full text-[#b5cbdf] transition-colors relative pt-1 active:scale-95";
      } else if (isSubmenuItem) {
        btn.className = "nav-btn group flex items-center px-3 py-2 rounded-md text-[#8fa8c0] hover:text-white hover:bg-white/10 text-xs transition-all w-full text-left";
        if (icon) {
          icon.className = "far fa-circle text-[10px] mr-2.5 text-[#7a93a8] group-hover:text-white";
        }
      } else if (isMobileSettingsTab) {
        btn.className = "nav-btn settings-tab-btn flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-[11px] sm:text-xs transition-all whitespace-nowrap border border-slate-200/50 dark:border-slate-700/50";
      } else if (btn.id !== 'btn-settings-dropdown-toggle') {
        btn.className = `nav-btn sidebar-menu-link group flex items-center px-3 py-2.5 mx-3 mb-1 rounded-md text-[#b5cbdf] hover:text-white ${sidebarCollapsed ? 'justify-center px-0' : ''}`;
        if (icon) {
          icon.classList.remove('text-[#3b82f6]');
          icon.classList.add('text-[#9db9d8]');
        }
      }
    }
  });
  const safeViewId = viewId || '';
  CURRENT_ADMIN_VIEW = safeViewId;

  const activeSessionBar = document.getElementById('admin-active-session-bar');
  if (activeSessionBar) {
    if (CURRENT_USER && CURRENT_USER.role === 'admin' && safeViewId === 'admin-dashboard') {
      activeSessionBar.classList.remove('hidden');
    } else {
      activeSessionBar.classList.add('hidden');
    }
  }

  renderCurrentAdminView();
  if (isAdminPortraitMobile()) {
    updateClassSelectors(true);
    refreshCachedDashboardStats(true);
  }
}
