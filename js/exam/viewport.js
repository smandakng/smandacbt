var EXAM_ACTIVE_KEY = 'cbt-exam-active';

function isExamPageActiveFlag() {
  return mySessionStorage.getItem(EXAM_ACTIVE_KEY) === '1';
}

function markExamPageActiveFlag() {
  mySessionStorage.setItem(EXAM_ACTIVE_KEY, '1');
}

function clearExamPageActiveFlag() {
  mySessionStorage.removeItem(EXAM_ACTIVE_KEY);
}

function getAppBaseUrl() {
  const cfgUrl = window.__ARCBT_CONFIG__?.appBaseUrl;
  if (cfgUrl && typeof cfgUrl === 'string' && cfgUrl.trim()) {
    return cfgUrl.trim().replace(/\/$/, '');
  }
  if (window.location.protocol.startsWith('http')) {
    const path = window.location.pathname.replace(/[^/]*$/, '');
    return `${window.location.origin}${path}`.replace(/\/$/, '');
  }
  return 'https://arnnon28.github.io/smandacbt';
}

function buildExamOpenQrUrl(baseUrl, target = 'index.html', options = {}) {
  const base = String(baseUrl || getAppBaseUrl()).replace(/\/$/, '');
  const allowed = new Set(['index.html', 'ujian.html', 'admin.html']);
  let page = String(target || 'index.html').trim().replace(/^\.\//, '');
  if (!allowed.has(page)) page = 'index.html';

  const params = new URLSearchParams();
  params.set('to', page);

  const nis = String(options?.nis || '').trim();
  const password = options?.password != null ? String(options.password) : '';
  if (nis) params.set('nis', nis);
  if (password !== '') params.set('pw', password);

  return `${base}/open.html?${params.toString()}`;
}

function detectExamPlatform() {
  const ua = String(navigator.userAgent || '');
  const isIOS = /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isIPad = /iPad/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    || (isIOS && Math.min(window.screen?.width || 0, window.screen?.height || 0) >= 768);
  const isIOSPhone = isIOS && !isIPad;
  const isMobileBrowser = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
  const doc = document.documentElement;
  const supportsNativeFullscreen = !!(
    document.fullscreenEnabled
    || document.webkitFullscreenEnabled
    || doc.requestFullscreen
    || doc.webkitRequestFullscreen
  ) && !isIOSPhone;

  return {
    isIOSPhone,
    isMobile: isMobileBrowser,
    usesImmersiveFallback: isIOSPhone || (isMobileBrowser && !supportsNativeFullscreen)
  };
}

function getActiveFullscreenElement() {
  return document.fullscreenElement
    || document.webkitFullscreenElement
    || document.webkitCurrentFullScreenElement
    || document.msFullscreenElement
    || null;
}

function isExamImmersiveModeActive() {
  return document.body.classList.contains('exam-immersive-mode');
}

function resetExamViewportInlineStyles() {
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  document.body.style.height = '';
  document.body.style.position = '';
  document.documentElement.style.removeProperty('--exam-vv-height');
  document.documentElement.style.removeProperty('--exam-vv-offset-top');
  document.documentElement.style.removeProperty('--exam-shell-top');
  document.documentElement.style.removeProperty('--exam-shell-left');
  document.documentElement.style.removeProperty('--exam-shell-width');
  const examView = document.getElementById('view-student-exam');
  if (examView) {
    examView.style.top = '';
    examView.style.left = '';
    examView.style.height = '';
    examView.style.maxHeight = '';
    examView.style.width = '';
    examView.style.marginTop = '';
    examView.style.transform = '';
  }
  const footer = document.getElementById('exam-footer-nav');
  if (footer) {
    footer.style.removeProperty('display');
    footer.style.removeProperty('visibility');
    footer.style.removeProperty('transform');
  }
}

function isExamLayoutActive() {
  const examView = document.getElementById('view-student-exam');
  return document.body.classList.contains('exam-mode')
    && examView
    && !examView.classList.contains('hidden');
}

function syncExamViewportLayout() {
  if (!isExamLayoutActive()) return;

  const vv = window.visualViewport;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const vvHeight = Math.round(vv?.height ?? window.innerHeight);
  const vvOffsetLeft = Math.round(vv?.offsetLeft ?? 0);
  const vvWidth = Math.round(vv?.width ?? window.innerWidth);

  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  document.documentElement.style.setProperty('--exam-vv-height', `${vvHeight}px`);
  document.documentElement.style.setProperty('--exam-vv-offset-top', '0px');
  document.documentElement.style.setProperty('--exam-shell-top', '0px');
  document.documentElement.style.setProperty('--exam-shell-left', `${vvOffsetLeft}px`);
  document.documentElement.style.setProperty('--exam-shell-width', `${vvWidth}px`);

  const examView = document.getElementById('view-student-exam');
  if (isMobile && examView) {
    examView.style.top = '0px';
    examView.style.left = `${vvOffsetLeft}px`;
    examView.style.width = `${vvWidth}px`;
    examView.style.height = `${vvHeight}px`;
    examView.style.maxHeight = `${vvHeight}px`;
  } else if (examView) {
    examView.style.top = '';
    examView.style.left = '';
    examView.style.width = '';
    examView.style.height = '';
    examView.style.maxHeight = '';
  }
}

function bindExamViewportSyncListeners() {
  if (window.__examViewportSyncBound) return;
  window.__examViewportSyncBound = true;

  const handler = () => syncExamViewportLayout();
  const debouncedHandler = debounce(handler, 80);
  const orientationHandler = () => {
    setTimeout(handler, 80);
    setTimeout(handler, 320);
  };
  const fsHandler = () => setTimeout(handler, 60);

  window.__examViewportSyncHandler = debouncedHandler;
  window.__examViewportScrollHandler = handler;
  window.__examViewportOrientationHandler = orientationHandler;
  window.__examViewportFsHandler = fsHandler;

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', debouncedHandler);
    window.visualViewport.addEventListener('scroll', handler);
  }
  window.addEventListener('resize', debouncedHandler);
  window.addEventListener('orientationchange', orientationHandler);
  document.addEventListener('fullscreenchange', fsHandler);
  document.addEventListener('webkitfullscreenchange', fsHandler);
  syncExamViewportLayout();
}

function unbindExamViewportSyncListeners() {
  if (!window.__examViewportSyncBound) return;
  const debouncedHandler = window.__examViewportSyncHandler;
  const scrollHandler = window.__examViewportScrollHandler;
  const orientationHandler = window.__examViewportOrientationHandler;
  const fsHandler = window.__examViewportFsHandler;

  if (window.visualViewport) {
    if (debouncedHandler) window.visualViewport.removeEventListener('resize', debouncedHandler);
    if (scrollHandler) window.visualViewport.removeEventListener('scroll', scrollHandler);
  }
  if (debouncedHandler) window.removeEventListener('resize', debouncedHandler);
  if (orientationHandler) window.removeEventListener('orientationchange', orientationHandler);
  if (fsHandler) {
    document.removeEventListener('fullscreenchange', fsHandler);
    document.removeEventListener('webkitfullscreenchange', fsHandler);
  }

  delete window.__examViewportSyncHandler;
  delete window.__examViewportScrollHandler;
  delete window.__examViewportOrientationHandler;
  delete window.__examViewportFsHandler;
  window.__examViewportSyncBound = false;
  resetExamViewportInlineStyles();
}

function enterExamImmersiveMode() {
  document.documentElement.classList.add('exam-immersive-mode');
  document.body.classList.add('exam-immersive-mode');
  window.__examImmersiveActive = true;
  syncExamViewportLayout();
}

function exitExamImmersiveMode() {
  document.documentElement.classList.remove('exam-immersive-mode');
  document.body.classList.remove('exam-immersive-mode');
  window.__examImmersiveActive = false;
  resetExamViewportInlineStyles();
}

function isExamFullscreenActive() {
  return !!getActiveFullscreenElement() || isExamImmersiveModeActive();
}

async function requestExamFullscreen() {
  if (typeof isFullscreenEnabled === 'function' && !isFullscreenEnabled()) {
    return false;
  }
  const platform = detectExamPlatform();
  if (platform.isMobile || platform.usesImmersiveFallback) {
    enterExamImmersiveMode();
  }

  const el = document.documentElement;
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' });
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      await el.msRequestFullscreen();
    }
  } catch (err) {
    console.warn('requestExamFullscreen native failed', err);
  }

  window.__examNativeFullscreenActive = !!getActiveFullscreenElement();
  if (!window.__examNativeFullscreenActive && (platform.isMobile || platform.usesImmersiveFallback)) {
    enterExamImmersiveMode();
  }
  syncExamViewportLayout();
  return isExamFullscreenActive();
}

async function exitExamFullscreen() {
  exitExamImmersiveMode();
  window.__examNativeFullscreenActive = false;
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  } catch (_) {}
}

var examFullscreenExitHandler = null;

function bindExamFullscreenListeners(onNativeExit) {
  examFullscreenExitHandler = onNativeExit;
  if (window.__examFullscreenBound) return;
  window.__examFullscreenBound = true;

  const handler = () => {
    const active = getActiveFullscreenElement();
    if (active) {
      window.__examNativeFullscreenActive = true;
      syncExamViewportLayout();
      return;
    }
    if (window.__examNativeFullscreenActive && typeof examFullscreenExitHandler === 'function') {
      window.__examNativeFullscreenActive = false;
      examFullscreenExitHandler();
    }
    syncExamViewportLayout();
  };

  window.__examFullscreenChangeHandler = handler;
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
}

function unbindExamFullscreenListeners() {
  const handler = window.__examFullscreenChangeHandler;
  if (handler) {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
    delete window.__examFullscreenChangeHandler;
  }
  window.__examFullscreenBound = false;
  examFullscreenExitHandler = null;
}

function bindExamMobileSecurityListeners() {
  if (window.__examMobileSecurityBound) return;
  window.__examMobileSecurityBound = true;

  const blockGesture = (e) => { e.preventDefault(); };
  window.__examGestureStartHandler = blockGesture;
  document.addEventListener('gesturestart', blockGesture, { passive: false });
  document.addEventListener('gesturechange', blockGesture, { passive: false });

  let touchTimer = null;
  const cancelTouchHold = () => {
    if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
  };

  window.__examTouchStartHandler = (e) => {
    cancelTouchHold();
    const target = e.target;
    const isInteractive = target && (target.closest('button, label.option-row, input, select, a'));
    if (!isInteractive && e.touches && e.touches.length > 0) {
      touchTimer = setTimeout(() => {
        if (e.cancelable) e.preventDefault();
      }, 350);
    }
    if (isExamImmersiveModeActive() && typeof syncExamViewportLayout === 'function') {
      syncExamViewportLayout();
    }
  };

  window.__examTouchEndHandler = cancelTouchHold;

  document.addEventListener('touchstart', window.__examTouchStartHandler, { passive: false });
  document.addEventListener('touchend', window.__examTouchEndHandler, { passive: true });
  document.addEventListener('touchmove', window.__examTouchEndHandler, { passive: true });
  document.addEventListener('touchcancel', window.__examTouchEndHandler, { passive: true });
}

function unbindExamMobileSecurityListeners() {
  if (!window.__examMobileSecurityBound) return;
  if (window.__examGestureStartHandler) {
    document.removeEventListener('gesturestart', window.__examGestureStartHandler);
    document.removeEventListener('gesturechange', window.__examGestureStartHandler);
    delete window.__examGestureStartHandler;
  }
  if (window.__examTouchStartHandler) {
    document.removeEventListener('touchstart', window.__examTouchStartHandler);
    delete window.__examTouchStartHandler;
  }
  if (window.__examTouchEndHandler) {
    document.removeEventListener('touchend', window.__examTouchEndHandler);
    document.removeEventListener('touchmove', window.__examTouchEndHandler);
    document.removeEventListener('touchcancel', window.__examTouchEndHandler);
    delete window.__examTouchEndHandler;
  }
  window.__examMobileSecurityBound = false;
}
