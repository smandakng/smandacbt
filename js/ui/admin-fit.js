function shouldSkipAdminHeaderFit() {
  if (typeof hasActiveTextSelectionIn === 'function' && hasActiveTextSelectionIn()) return true;
  if (typeof hasActiveTokenSelection === 'function' && hasActiveTokenSelection()) return true;
  const active = document.activeElement;
  if (active) {
    const tag = active.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
      if (active.closest('#main-system-view')) return true;
    }
  }
  if (window.visualViewport) {
    const keyboardOpen = window.innerHeight - window.visualViewport.height > 80;
    if (keyboardOpen) return true;
  }
  return false;
}

function fitAdminHeaderText() {
  if (shouldSkipAdminHeaderFit()) return;

  const container = document.getElementById('header-text-container');
  if (!container) return;

  const isPortraitMobile = window.matchMedia('(orientation: portrait) and (max-width: 768px)').matches;
  const isAuthHeader = Boolean(document.getElementById('auth-view') && container.closest('#auth-view'));
  const configs = [
    {
      el: document.getElementById('header-school-name'),
      max: isPortraitMobile ? (isAuthHeader ? 14 : 13) : 18,
      min: isPortraitMobile ? 7 : 6
    },
    {
      el: document.getElementById('header-exam-title'),
      max: isPortraitMobile ? (isAuthHeader ? 10 : 9) : 12,
      min: isPortraitMobile ? 6 : 6
    }
  ];

  configs.forEach(({ el, max, min }) => {
    if (!el) return;
    el.style.whiteSpace = 'nowrap';
    el.style.overflow = 'hidden';
    el.style.textOverflow = 'clip';
    el.style.lineHeight = '1.15';
    el.style.maxWidth = '100%';
    let size = max;
    el.style.fontSize = `${size}px`;
    while (size > min && el.scrollWidth > container.clientWidth) {
      size -= 0.5;
      el.style.fontSize = `${size}px`;
    }
    if (el.scrollWidth > container.clientWidth) {
      el.style.whiteSpace = 'normal';
      el.style.wordBreak = 'break-word';
      el.style.lineHeight = '1.2';
    }
  });
}

function fitConfirmationDialogText() {
  const panel = document.querySelector('#confirmation-dialog .confirmation-dialog-panel');
  const messageEl = document.getElementById('dialog-message');
  const titleEl = document.getElementById('dialog-title');
  const dialog = document.getElementById('confirmation-dialog');
  if (!panel || !messageEl || !dialog || dialog.classList.contains('hidden')) return;
  if (dialog.classList.contains('exam-success-modal')) return;

  const warningContent = messageEl.querySelector('.dialog-warning-content');

  const resetDialogTextSizing = () => {
    if (titleEl) titleEl.style.fontSize = '';
    messageEl.style.fontSize = '';
    panel.style.overflow = 'hidden';
    messageEl.style.overflow = 'hidden';
    messageEl.querySelectorAll('.dialog-warning-content *').forEach((el) => {
      el.style.fontSize = '';
    });
  };

  resetDialogTextSizing();

  let baseTitleSize = warningContent ? 22 : 24;
  let baseMsgSize = warningContent ? 17 : 18;
  const minMsgSize = warningContent ? 14 : 15;
  const minTitleSize = 18;

  const applySizes = () => {
    if (titleEl) titleEl.style.fontSize = `${baseTitleSize}px`;
    messageEl.style.fontSize = `${baseMsgSize}px`;
    if (warningContent) {
      warningContent.querySelectorAll('p, ul, li, strong, b, span').forEach((el) => {
        el.style.fontSize = 'inherit';
      });
    }
  };

  applySizes();

  while ((panel.scrollHeight > panel.clientHeight || messageEl.scrollHeight > messageEl.clientHeight) && baseMsgSize > minMsgSize) {
    baseMsgSize -= 0.5;
    baseTitleSize = Math.max(minTitleSize, baseTitleSize - 0.5);
    applySizes();
  }
}

function initAdminHeaderAutoFit() {
  fitAdminHeaderText();
  if (window.__adminHeaderFitBound) return;
  window.__adminHeaderFitBound = true;

  let headerFitTimer;
  const debouncedFitHeader = () => {
    clearTimeout(headerFitTimer);
    headerFitTimer = setTimeout(() => {
      if (!shouldSkipAdminHeaderFit()) fitAdminHeaderText();
    }, 150);
  };

  let dialogFitTimer;
  const debouncedFitDialog = () => {
    clearTimeout(dialogFitTimer);
    dialogFitTimer = setTimeout(fitConfirmationDialogText, 150);
  };

  window.addEventListener('resize', debouncedFitHeader);
  window.addEventListener('orientationchange', () => setTimeout(() => {
    if (!shouldSkipAdminHeaderFit()) fitAdminHeaderText();
  }, 200));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', debouncedFitHeader);
  }
  window.addEventListener('resize', debouncedFitDialog);
  window.addEventListener('orientationchange', () => setTimeout(fitConfirmationDialogText, 200));
}
