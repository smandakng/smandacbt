function estimateDataUrlBytes(dataUrl) {
  const base64 = String(dataUrl).split(',')[1] || '';
  return Math.ceil(base64.length * 0.75);
}

function compressImageToTargetSize(b64, maxKB = 50) {
  return new Promise((res) => {
    const maxBytes = Math.max(4, Number(maxKB) || 50) * 1024;
    const img = new Image();
    img.decoding = 'async';

    img.onload = () => {
      const srcW = Math.max(1, img.naturalWidth || img.width || 1);
      const srcH = Math.max(1, img.naturalHeight || img.height || 1);

      const encode = (width, height, quality) => {
        const cvs = document.createElement('canvas');
        cvs.width = width;
        cvs.height = height;
        const ctx = cvs.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        return cvs.toDataURL('image/jpeg', Math.min(0.95, Math.max(0.35, quality)));
      };

      const fit = (maxDim) => {
        const long = Math.max(srcW, srcH);
        if (long <= maxDim) return { w: srcW, h: srcH };
        const scale = maxDim / long;
        return {
          w: Math.max(1, Math.round(srcW * scale)),
          h: Math.max(1, Math.round(srcH * scale))
        };
      };

      const bestAtSize = (w, h) => {
        let candidate = encode(w, h, 0.9);
        if (estimateDataUrlBytes(candidate) <= maxBytes) return candidate;

        let lo = 0.42;
        let hi = 0.9;
        let best = null;
        for (let i = 0; i < 9; i++) {
          const mid = (lo + hi) / 2;
          candidate = encode(w, h, mid);
          if (estimateDataUrlBytes(candidate) <= maxBytes) {
            best = candidate;
            lo = mid;
          } else {
            hi = mid;
          }
        }
        return best;
      };

      const startDim = maxKB <= 50 ? 960 : 1280;
      const dimLadder = [];
      for (let d = startDim; d >= 140; d = Math.floor(d * 0.82)) {
        if (!dimLadder.length || dimLadder[dimLadder.length - 1] !== d) dimLadder.push(d);
      }

      let best = null;
      let bestW = 0;
      let bestH = 0;
      for (const maxDim of dimLadder) {
        const { w, h } = fit(maxDim);
        const candidate = bestAtSize(w, h);
        if (candidate) {
          best = candidate;
          bestW = w;
          bestH = h;
          break;
        }
      }

      if (!best) {
        const { w, h } = fit(120);
        bestW = w;
        bestH = h;
        best = encode(w, h, 0.4);
      }

      let guard = 0;
      while (estimateDataUrlBytes(best) > maxBytes && bestW > 48 && bestH > 48 && guard < 14) {
        bestW = Math.max(48, Math.round(bestW * 0.88));
        bestH = Math.max(48, Math.round(bestH * 0.88));
        best = encode(bestW, bestH, 0.45);
        guard += 1;
      }

      res(best);
    };

    img.onerror = () => res(b64);
    img.src = b64;
  });
}

async function ensureImageUnderMaxKb(dataUrl, maxKB = 50) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
    return dataUrl;
  }
  return compressImageToTargetSize(dataUrl, maxKB);
}

async function compressDataUrlsInHtml(html, maxKB = 50) {
  if (!html || typeof html !== 'string' || !html.includes('data:image')) return html || '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="__cbt_img_root">${html}</div>`, 'text/html');
  const root = doc.getElementById('__cbt_img_root');
  if (!root) return html;
  const imgs = Array.from(root.querySelectorAll('img'));
  for (const el of imgs) {
    const src = el.getAttribute('src') || '';
    if (!src.startsWith('data:image')) continue;
    el.setAttribute('src', await ensureImageUnderMaxKb(src, maxKB));
  }
  return root.innerHTML;
}

var BANK_SOAL_IMAGE_MAX_KB = 50;
var LOGO_MAX_KB = 50;

var LOGO_ASSET_PREFIX = 'cbt_logo_asset_';
var LOGO_STORAGE_BUCKET = 'cbt-logos';
var PACKET_STORAGE_BUCKET = 'cbt-packets';
var PACKET_STORAGE_CACHE_CONTROL = '120';
var LOGO_ASSET_ID_LENGTH = 10;

function generateLogoAssetId(length = LOGO_ASSET_ID_LENGTH) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function isLogoAssetRef(value) {
  if (!value || typeof value !== 'string') return false;
  const ref = value.trim();
  if (/^https?:\/\//i.test(ref) || /^data:image\//i.test(ref)) return false;
  return /^[A-Za-z0-9]{1,10}$/.test(ref);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = String(dataUrl).split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function getLogoStoragePublicUrl(logoId) {
  const base = supabaseUrl;
  if (!base || !logoId) return null;
  return `${base.replace(/\/$/, '')}/storage/v1/object/public/${LOGO_STORAGE_BUCKET}/${logoId}.jpg`;
}

function resolveSchoolLogoUrl(logoRef) {
  const ref = String(logoRef || '').trim();
  if (!ref) return DEFAULT_APP_SETTINGS.schoolLogo;
  if (/^https?:\/\//i.test(ref) || /^data:image\//i.test(ref)) return ref;
  if (isLogoAssetRef(ref)) {
    const cached = myLocalStorage.getItem(`${LOGO_ASSET_PREFIX}${ref}`);
    if (cached) return cached;
    return getLogoStoragePublicUrl(ref) || DEFAULT_APP_SETTINGS.schoolLogo;
  }
  return ref;
}

async function tryUploadLogoToStorage(logoId, blob) {
  try {
    const path = `${logoId}.jpg`;
    const { error } = await supabaseClient.storage.from(LOGO_STORAGE_BUCKET).upload(path, blob, {
      upsert: true,
      contentType: 'image/jpeg',
      cacheControl: '3600'
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Logo storage upload failed, using local cache', e);
    return false;
  }
}

async function uploadSchoolLogoFromFile(file) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('File harus berupa gambar (PNG, JPG, WEBP, dll).');
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Ukuran file terlalu besar! Maksimal 2MB.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const compressed = await compressImageToTargetSize(rawDataUrl, LOGO_MAX_KB);
  const logoId = generateLogoAssetId(LOGO_ASSET_ID_LENGTH);
  const blob = dataUrlToBlob(compressed);

  myLocalStorage.setItem(`${LOGO_ASSET_PREFIX}${logoId}`, compressed);
  await tryUploadLogoToStorage(logoId, blob);

  const current = readAppSettingsFromLocal();
  const payload = {
    schoolName: current.schoolName,
    examTitle: current.examTitle,
    schoolLogo: logoId,
    footerText: current.footerText
  };
  await saveAppSettingsToCloud(payload);
  appSettingsToLocalKeys(payload);
  window.tempUploadedLogo = null;
  return logoId;
}

function hasActiveTextSelectionIn(rootSelector = '#main-system-view') {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
  const root = document.querySelector(rootSelector);
  if (!root) return false;
  const anchor = sel.anchorNode;
  return !!(anchor && root.contains(anchor));
}

function isSelectionInsideElement(el) {
  if (!el) return false;
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return false;
  const nodeInEl = (node) => {
    if (!node) return false;
    const target = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    return !!(target && el.contains(target));
  };
  return nodeInEl(sel.anchorNode) || nodeInEl(sel.focusNode);
}

function hasActiveTokenSelection() {
  const tokenBar = document.getElementById('admin-active-session-bar');
  if (tokenBar && isSelectionInsideElement(tokenBar)) return true;
  return ['token-display-x', 'token-display-xi', 'token-display-xii'].some((id) => {
    const el = document.getElementById(id);
    return el && isSelectionInsideElement(el);
  });
}

function setElementTextPreservingSelection(el, text) {
  if (!el) return false;
  if (isSelectionInsideElement(el)) return false;
  const next = String(text ?? '');
  if (el.textContent === next) return true;
  el.textContent = next;
  return true;
}

var STANDARD_FOOTER_TEXT = '© 2026 Computer Based Test | Developed By ARNNON';

var DEFAULT_APP_SETTINGS = {
  schoolName: 'SMA Negeri 2 Kuningan',
  examTitle: 'Asesmen Sumatif Akhir Tahun',
  schoolLogo: 'https://iili.io/KSdduPR.png',
  footerText: STANDARD_FOOTER_TEXT
};

var APP_SETTINGS_LOCAL_KEYS = {
  schoolName: 'er_sh_name',
  examTitle: 'er_ex_title',
  schoolLogo: 'er_sh_logo',
  footerText: 'er_footer_text',
  supabaseUrl: 'er_sb_url',
  supabaseKey: 'er_sb_key'
};

var serverTimeOffsetMs = 0;
var serverTimeSyncedAt = 0;

function applyServerTimeFromIso(iso) {
  if (!iso) return serverTimeOffsetMs;
  const serverMs = new Date(iso).getTime();
  if (Number.isNaN(serverMs)) return serverTimeOffsetMs;
  serverTimeOffsetMs = serverMs - Date.now();
  serverTimeSyncedAt = Date.now();
  return serverTimeOffsetMs;
}

async function syncServerTimeOffset(force = false) {
  const staleMs = 300 * 1000;
  if (!force && serverTimeSyncedAt && Date.now() - serverTimeSyncedAt < staleMs) {
    return serverTimeOffsetMs;
  }
  const t0 = Date.now();
  const { data, error } = await supabaseClient.rpc('cbt_server_now');
  if (error) {
    console.warn('syncServerTimeOffset failed', error);
    return serverTimeOffsetMs;
  }
  const serverMs = new Date(data).getTime();
  const t1 = Date.now();
  serverTimeOffsetMs = serverMs - Math.round((t0 + t1) / 2);
  serverTimeSyncedAt = Date.now();
  return serverTimeOffsetMs;
}

function getServerNowMs() {
  return Date.now() + serverTimeOffsetMs;
}

function getExamScheduleStartMs(schedule) {
  if (!schedule?.mulai) return null;
  return new Date(schedule.mulai).getTime();
}

function getExamScheduleEndMs(schedule) {
  if (schedule?.selesai) {
    const endMs = new Date(schedule.selesai).getTime();
    if (!Number.isNaN(endMs)) return endMs;
  }
  const startMs = getExamScheduleStartMs(schedule);
  if (startMs == null) return null;
  const durMs = (schedule.durasi || 60) * 60 * 1000;
  return startMs + durMs;
}

function formatDatetimeLocalValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function computeScheduleDurationMinutes(mulai, selesai) {
  const startMs = new Date(mulai).getTime();
  const endMs = new Date(selesai).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return null;
  return Math.round((endMs - startMs) / 60000);
}

function resolveScheduleEndDatetime(mulai, selesai, durasiMinutes) {
  const startMs = new Date(mulai).getTime();
  if (Number.isNaN(startMs)) throw new Error('Waktu mulai tidak valid.');

  if (selesai) {
    const endMs = new Date(selesai).getTime();
    if (Number.isNaN(endMs) || endMs <= startMs) {
      throw new Error('Waktu selesai harus setelah waktu mulai.');
    }
    return {
      mulai: new Date(startMs).toISOString(),
      selesai: new Date(endMs).toISOString(),
      durasi: computeScheduleDurationMinutes(mulai, selesai) || durasiMinutes || 60
    };
  }

  const dur = Number(durasiMinutes) || 60;
  const endIso = new Date(startMs + dur * 60000).toISOString();
  return {
    mulai: new Date(startMs).toISOString(),
    selesai: endIso,
    durasi: dur
  };
}

function getScheduleSelesaiForForm(schedule) {
  if (schedule?.selesai) return formatDatetimeLocalValue(schedule.selesai);
  if (schedule?.mulai && schedule?.durasi) {
    const endMs = new Date(schedule.mulai).getTime() + (Number(schedule.durasi) || 0) * 60000;
    return formatDatetimeLocalValue(new Date(endMs).toISOString());
  }
  return '';
}

function validateExamWindow(schedule, nowMs = getServerNowMs()) {
  const startMs = getExamScheduleStartMs(schedule);
  const endMs = getExamScheduleEndMs(schedule);
  if (startMs == null || endMs == null) {
    throw new Error('Jadwal ujian belum valid (waktu mulai belum diatur).');
  }
  if (nowMs < startMs) throw new Error('Ujian belum dimulai.');
  if (nowMs > endMs) throw new Error('Ujian telah selesai.');
  return {
    startMs,
    endMs,
    remainingSec: Math.max(0, Math.floor((endMs - nowMs) / 1000))
  };
}

function computeExamTimeRemainingSeconds(schedule, nowMs = getServerNowMs()) {
  const endMs = getExamScheduleEndMs(schedule);
  if (endMs == null) return 0;
  return Math.max(0, Math.floor((endMs - nowMs) / 1000));
}

function assertExamSubmissionAllowed(schedule, reason, nowMs = getServerNowMs(), graceSec = 20) {
  const endMs = getExamScheduleEndMs(schedule);
  if (endMs == null) return true;
  const autoReasons = [
    'Durasi Habis',
    'Keluar Layar/Tab',
    'Keluar Mode Layar Penuh',
    'Belah Layar',
    'Layar Tertutup',
    'Rotasi Layar',
    'Kehilangan Fokus',
    'Pelanggaran Ujian',
    'Refresh Halaman',
    'Curang Terdeteksi',
    'Curang'
  ];
  const reasonText = String(reason || '');
  if (autoReasons.some((r) => reasonText.includes(r))) {
    return true;
  }
  if (nowMs > endMs + graceSec * 1000) {
    throw new Error('Waktu ujian telah berakhir (validasi server).');
  }
  return true;
}

function readAppSettingsFromLocal() {
  const localFooter = myLocalStorage.getItem(APP_SETTINGS_LOCAL_KEYS.footerText);
  const footerText = (!localFooter || String(localFooter).trim() !== STANDARD_FOOTER_TEXT)
    ? STANDARD_FOOTER_TEXT
    : localFooter;
  return {
    schoolName: myLocalStorage.getItem(APP_SETTINGS_LOCAL_KEYS.schoolName) || DEFAULT_APP_SETTINGS.schoolName,
    examTitle: myLocalStorage.getItem(APP_SETTINGS_LOCAL_KEYS.examTitle) || DEFAULT_APP_SETTINGS.examTitle,
    schoolLogo: myLocalStorage.getItem(APP_SETTINGS_LOCAL_KEYS.schoolLogo) || DEFAULT_APP_SETTINGS.schoolLogo,
    footerText: footerText,
    supabaseUrl: myLocalStorage.getItem(APP_SETTINGS_LOCAL_KEYS.supabaseUrl) || '',
    supabaseKey: myLocalStorage.getItem(APP_SETTINGS_LOCAL_KEYS.supabaseKey) || ''
  };
}

function appSettingsToLocalKeys(settings) {
  const s = settings || DEFAULT_APP_SETTINGS;
  myLocalStorage.setItem(APP_SETTINGS_LOCAL_KEYS.schoolName, s.schoolName || DEFAULT_APP_SETTINGS.schoolName);
  myLocalStorage.setItem(APP_SETTINGS_LOCAL_KEYS.examTitle, s.examTitle || DEFAULT_APP_SETTINGS.examTitle);
  myLocalStorage.setItem(APP_SETTINGS_LOCAL_KEYS.schoolLogo, s.schoolLogo || DEFAULT_APP_SETTINGS.schoolLogo);
  myLocalStorage.setItem(APP_SETTINGS_LOCAL_KEYS.footerText, s.footerText || DEFAULT_APP_SETTINGS.footerText);
}

function rowToAppSettings(row) {
  if (!row) return null;
  return {
    schoolName: row.nama_sekolah || DEFAULT_APP_SETTINGS.schoolName,
    examTitle: row.judul_ujian || DEFAULT_APP_SETTINGS.examTitle,
    schoolLogo: row.logo_url || DEFAULT_APP_SETTINGS.schoolLogo,
    footerText: row.footer_text || DEFAULT_APP_SETTINGS.footerText
  };
}

function appSettingsToRow(settings) {
  const s = settings || DEFAULT_APP_SETTINGS;
  return {
    id: 'app',
    nama_sekolah: s.schoolName || DEFAULT_APP_SETTINGS.schoolName,
    judul_ujian: s.examTitle || DEFAULT_APP_SETTINGS.examTitle,
    logo_url: s.schoolLogo || DEFAULT_APP_SETTINGS.schoolLogo,
    footer_text: s.footerText || DEFAULT_APP_SETTINGS.footerText,
    updated_at: new Date().toISOString()
  };
}

var __appSettingsCache = null;
var __appSettingsCacheAt = 0;
var APP_SETTINGS_CACHE_TTL_MS = 600000;

async function loadAppSettingsFromCloud(force = false) {
  if (!force && __appSettingsCache && (Date.now() - __appSettingsCacheAt < APP_SETTINGS_CACHE_TTL_MS)) {
    return __appSettingsCache;
  }
  const snap = await getDoc(getPublicDoc('Pengaturan', 'app'));
  if (!snap.exists()) return null;
  const settings = rowToAppSettings(snap.data());
  __appSettingsCache = settings;
  __appSettingsCacheAt = Date.now();
  return settings;
}

async function saveAppSettingsToCloud(settings) {
  await setDoc(getPublicDoc('Pengaturan', 'app'), appSettingsToRow(settings), { merge: true });
  __appSettingsCache = settings;
  __appSettingsCacheAt = Date.now();
}

async function initAppSettings(options = {}) {
  const { migrateLocal = true } = options;
  const isLegacyOrEmpty = (txt) => {
    const val = String(txt || '').trim();
    return !val || val !== STANDARD_FOOTER_TEXT;
  };
  try {
    let cloud = await loadAppSettingsFromCloud();
    if (!cloud && migrateLocal) {
      const hasLocal = myLocalStorage.getItem(APP_SETTINGS_LOCAL_KEYS.schoolName)
        || myLocalStorage.getItem(APP_SETTINGS_LOCAL_KEYS.examTitle)
        || myLocalStorage.getItem(APP_SETTINGS_LOCAL_KEYS.schoolLogo);
      if (hasLocal) {
        const local = readAppSettingsFromLocal();
        await saveAppSettingsToCloud(local);
        cloud = local;
      }
    }
    if (cloud) {
      if (isLegacyOrEmpty(cloud.footerText)) {
        cloud.footerText = STANDARD_FOOTER_TEXT;
      }
      appSettingsToLocalKeys(cloud);
    } else {
      appSettingsToLocalKeys(DEFAULT_APP_SETTINGS);
    }
    const storedFooter = myLocalStorage.getItem(APP_SETTINGS_LOCAL_KEYS.footerText);
    if (isLegacyOrEmpty(storedFooter)) {
      myLocalStorage.setItem(APP_SETTINGS_LOCAL_KEYS.footerText, STANDARD_FOOTER_TEXT);
    }
  } catch (e) {
    console.warn('initAppSettings failed, using local cache', e);
  }
  return readAppSettingsFromLocal();
}

var __securitySettingsCache = null;
var SECURITY_SETTINGS_LOCK_KEY = 'er_lock_mobile';
var SECURITY_SETTINGS_OPERATOR_KEY = 'er_show_operator_link';
var SECURITY_SETTINGS_SPLIT_SCREEN_KEY = 'er_enable_split_screen';
var SECURITY_SETTINGS_FULLSCREEN_KEY = 'er_enable_fullscreen';
var SECURITY_SETTINGS_MAX_VIOLATIONS_KEY = 'er_max_violations';
var SECURITY_SETTINGS_OVERLAY_KEY = 'er_enable_overlay_detection';
var SECURITY_SETTINGS_APP_PINNING_KEY = 'er_require_app_pinning';

function isExamAppPinned() {
  try {
    const isMobile = typeof isMobileDevice === 'function'
      ? isMobileDevice()
      : /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
    if (!isMobile) return true; // Perangkat Desktop/Laptop tidak menggunakan sematan aplikasi mobile

    // 1. Android CBT Exam Browser interface / Android JavaScript bridge check
    if (window.Android && typeof window.Android.isAppPinned === 'function') {
      return Boolean(window.Android.isAppPinned());
    }
    if (window.Android && typeof window.Android.isLockTaskMode === 'function') {
      return Boolean(window.Android.isLockTaskMode());
    }
    if (window.cbtExamBrowser && typeof window.cbtExamBrowser.isPinned === 'function') {
      return Boolean(window.cbtExamBrowser.isPinned());
    }
    if (window.cbtExamBrowser && typeof window.cbtExamBrowser.isLockTask === 'function') {
      return Boolean(window.cbtExamBrowser.isLockTask());
    }
    if (window.examBrowser && typeof window.examBrowser.isAppPinned === 'function') {
      return Boolean(window.examBrowser.isAppPinned());
    }

    // 2. Safe Exam Browser (iOS / SEB) Guided Access check
    if (window.SEB && typeof window.SEB.isGuidedAccessActive === 'function') {
      return Boolean(window.SEB.isGuidedAccessActive());
    }
    if (window.SEB && window.SEB.guidedAccessActive !== undefined) {
      return Boolean(window.SEB.guidedAccessActive);
    }
    if (window.safeExamBrowser && typeof window.safeExamBrowser.isGuidedAccessActive === 'function') {
      return Boolean(window.safeExamBrowser.isGuidedAccessActive());
    }

    // 3. Fallback jika bridge menginjeksi flag ke window
    if (window.__appPinned === true || window.__cbtAppPinned === true) {
      return true;
    }

    // 4. Deteksi apakah host app menyediakan bridge pinning
    const hasBridge = Boolean(
      (window.Android && (typeof window.Android.isAppPinned === 'function' || typeof window.Android.isLockTaskMode === 'function')) ||
      (window.cbtExamBrowser && (typeof window.cbtExamBrowser.isPinned === 'function' || typeof window.cbtExamBrowser.isLockTask === 'function')) ||
      (window.examBrowser && typeof window.examBrowser.isAppPinned === 'function') ||
      (window.SEB && (typeof window.SEB.isGuidedAccessActive === 'function' || window.SEB.guidedAccessActive !== undefined)) ||
      (window.safeExamBrowser && typeof window.safeExamBrowser.isGuidedAccessActive === 'function')
    );
    if (hasBridge) {
      // Jika bridge ada tapi semua fungsi mengembalikan false, berarti aplikasi belum disematkan
      return false;
    }

    // Jika lingkungan tidak menyediakan bridge interface (misal SafeExamBrowser iOS standar atau Exambro umum),
    // periksa apakah berjalan di dalam lingkungan exam browser yang sah agar tidak salah memblokir siswa
    if (typeof isExamBrowserEnvironment === 'function' && isExamBrowserEnvironment()) {
      return true;
    }
  } catch (err) {
    console.warn('isExamAppPinned evaluation error:', err);
  }
  return false;
}

function isAppPinningRequired() {
  const cached = myLocalStorage.getItem(SECURITY_SETTINGS_APP_PINNING_KEY);
  if (cached !== null) return cached === 'true';
  if (typeof window.__securitySettingsCache?.requireAppPinning === 'boolean') {
    return window.__securitySettingsCache.requireAppPinning;
  }
  return true;
}

function isMobileDevice() {
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isExamBrowserEnvironment() {
  const ua = navigator.userAgent || '';
  const isApproved = /CBTBrowser|CBT[_-]?Browser|ExamBrowser|Exam[_-]?Browser|Exambro|Exambrozer|SEB|Safe[_-]?Exam[_-]?Browser|CandyCBT|Kiosk|SMANDA|ARCBT/i.test(ua)
    || /wv/.test(ua)
    || /SEB/i.test(navigator.appVersion || '')
    || Boolean(window.SEB || window.safeExamBrowser || window.cbtExamBrowser || (window.Android && typeof window.Android.isAppPinned === 'function'));
  return Boolean(isApproved);
}

function isMobileBrowserLockEnabled() {
  const cached = myLocalStorage.getItem(SECURITY_SETTINGS_LOCK_KEY);
  if (cached !== null) return cached === 'true';
  if (typeof window.__securitySettingsCache?.lockMobileBrowser === 'boolean') {
    return window.__securitySettingsCache.lockMobileBrowser;
  }
  return true;
}

function saveSecuritySettingsToLocalCache(s) {
  if (!s) return;
  myLocalStorage.setItem(SECURITY_SETTINGS_LOCK_KEY, String(s.lockMobileBrowser));
  myLocalStorage.setItem(SECURITY_SETTINGS_OPERATOR_KEY, String(s.showOperatorLoginLink));
  myLocalStorage.setItem(SECURITY_SETTINGS_SPLIT_SCREEN_KEY, String(s.enableSplitScreen));
  myLocalStorage.setItem(SECURITY_SETTINGS_FULLSCREEN_KEY, String(s.enableFullscreen));
  myLocalStorage.setItem(SECURITY_SETTINGS_MAX_VIOLATIONS_KEY, String(s.maxViolations));
  myLocalStorage.setItem(SECURITY_SETTINGS_OVERLAY_KEY, String(s.enableOverlayDetection));
  myLocalStorage.setItem(SECURITY_SETTINGS_APP_PINNING_KEY, String(s.requireAppPinning));
}

async function loadSecuritySettingsFromCloud(force = false) {
  if (!force && __securitySettingsCache !== null) {
    return __securitySettingsCache;
  }
  try {
    const snap = await getDoc(getPublicDoc('Keamanan', 'app'));
    if (snap.exists()) {
      const data = snap.data();
      __securitySettingsCache = {
        lockMobileBrowser: data.lock_mobile_browser !== undefined ? Boolean(data.lock_mobile_browser) : true,
        showOperatorLoginLink: data.show_operator_login_link !== undefined ? Boolean(data.show_operator_login_link) : true,
        enableSplitScreen: data.enable_split_screen !== undefined ? Boolean(data.enable_split_screen) : true,
        enableFullscreen: data.enable_fullscreen !== undefined ? Boolean(data.enable_fullscreen) : true,
        maxViolations: Math.max(1, Math.min(10, Number(data.max_violations) || 3)),
        enableOverlayDetection: data.enable_overlay_detection !== undefined ? Boolean(data.enable_overlay_detection) : true,
        requireAppPinning: data.require_app_pinning !== undefined ? Boolean(data.require_app_pinning) : true
      };
      saveSecuritySettingsToLocalCache(__securitySettingsCache);
      // Sync ke window agar semua script (anti-cheat, submit, split-screen) membaca nilai dari database
      if (typeof window !== 'undefined') window.__securitySettingsCache = __securitySettingsCache;
      return __securitySettingsCache;
    }
  } catch (e) {
    console.warn('loadSecuritySettingsFromCloud failed', e);
  }
  const getCachedBool = (key, def = true) => {
    const val = myLocalStorage.getItem(key);
    return val !== null ? val === 'true' : def;
  };
  __securitySettingsCache = {
    lockMobileBrowser: getCachedBool(SECURITY_SETTINGS_LOCK_KEY, true),
    showOperatorLoginLink: getCachedBool(SECURITY_SETTINGS_OPERATOR_KEY, true),
    enableSplitScreen: getCachedBool(SECURITY_SETTINGS_SPLIT_SCREEN_KEY, true),
    enableFullscreen: getCachedBool(SECURITY_SETTINGS_FULLSCREEN_KEY, true),
    maxViolations: Math.max(1, Math.min(10, Number(myLocalStorage.getItem(SECURITY_SETTINGS_MAX_VIOLATIONS_KEY)) || 3)),
    enableOverlayDetection: getCachedBool(SECURITY_SETTINGS_OVERLAY_KEY, true),
    requireAppPinning: getCachedBool(SECURITY_SETTINGS_APP_PINNING_KEY, true)
  };
  // Sync ke window (nilai fallback dari localStorage)
  if (typeof window !== 'undefined') window.__securitySettingsCache = __securitySettingsCache;
  return __securitySettingsCache;
}

function getMaxExamViolations() {
  const fromCache = window?.__securitySettingsCache?.maxViolations ?? __securitySettingsCache?.maxViolations;
  if (typeof fromCache === 'number' && !Number.isNaN(fromCache) && fromCache >= 1 && fromCache <= 10) {
    return fromCache;
  }
  const cached = Number(myLocalStorage.getItem(SECURITY_SETTINGS_MAX_VIOLATIONS_KEY));
  if (!Number.isNaN(cached) && cached >= 1 && cached <= 10) {
    return Math.max(1, Math.min(10, cached));
  }
  return 3;
}
if (typeof window !== 'undefined') {
  window.getMaxExamViolations = getMaxExamViolations;
}

async function saveSecuritySettingsToCloud(lockMobileBrowser, showOperatorLoginLink = true, enableSplitScreen = true, enableFullscreen = true, maxViolations = 3, enableOverlayDetection = true, requireAppPinning = true) {
  const lockVal = Boolean(lockMobileBrowser);
  const operatorVal = Boolean(showOperatorLoginLink);
  const splitVal = Boolean(enableSplitScreen);
  const fullVal = Boolean(enableFullscreen);
  const maxVal = Math.max(1, Math.min(10, Number(maxViolations) || 3));
  const overlayVal = Boolean(enableOverlayDetection);
  const pinningVal = Boolean(requireAppPinning);
  try {
    await setDoc(getPublicDoc('Keamanan', 'app'), {
      id: 'app',
      lock_mobile_browser: lockVal,
      show_operator_login_link: operatorVal,
      enable_split_screen: splitVal,
      enable_fullscreen: fullVal,
      max_violations: maxVal,
      enable_overlay_detection: overlayVal,
      require_app_pinning: pinningVal,
      updated_at: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn('saveSecuritySettingsToCloud failed', e);
  }
  __securitySettingsCache = {
    lockMobileBrowser: lockVal,
    showOperatorLoginLink: operatorVal,
    enableSplitScreen: splitVal,
    enableFullscreen: fullVal,
    maxViolations: maxVal,
    enableOverlayDetection: overlayVal,
    requireAppPinning: pinningVal
  };
  saveSecuritySettingsToLocalCache(__securitySettingsCache);
  // Sync ke window agar semua script membaca nilai terbaru
  if (typeof window !== 'undefined') window.__securitySettingsCache = __securitySettingsCache;
}

var __barcodeSettingsCache = null;
var BARCODE_SETTINGS_TITLE_KEY = 'er_barcode_title';
var BARCODE_SETTINGS_URL_KEY = 'er_barcode_url';

function getDefaultBarcodeUrl() {
  const origin = window.location.origin || '';
  const pathname = window.location.pathname || '';
  const basePath = pathname.substring(0, pathname.lastIndexOf('/') + 1);
  return `${origin}${basePath}index.html`;
}

async function loadBarcodeSettingsFromCloud(force = false) {
  if (!force && __barcodeSettingsCache !== null) {
    return __barcodeSettingsCache;
  }
  const defaultUrl = getDefaultBarcodeUrl();
  try {
    const snap = await getDoc(getPublicDoc('Barcode', 'app'));
    if (snap.exists()) {
      const data = snap.data();
      const title = data.barcode_title || 'Scan CBT Android';
      const url = data.barcode_url || defaultUrl;
      __barcodeSettingsCache = { barcodeTitle: title, barcodeUrl: url };
      try {
        myLocalStorage.setItem(BARCODE_SETTINGS_TITLE_KEY, title);
        myLocalStorage.setItem(BARCODE_SETTINGS_URL_KEY, url);
      } catch (e) {
        console.warn('loadBarcodeSettingsFromCloud local cache setItem failed', e);
      }
      return __barcodeSettingsCache;
    }
  } catch (e) {
    console.warn('loadBarcodeSettingsFromCloud failed', e);
  }
  const cachedTitle = myLocalStorage.getItem(BARCODE_SETTINGS_TITLE_KEY) || 'Scan CBT Android';
  const cachedUrl = myLocalStorage.getItem(BARCODE_SETTINGS_URL_KEY) || defaultUrl;
  __barcodeSettingsCache = { barcodeTitle: cachedTitle, barcodeUrl: cachedUrl };
  return __barcodeSettingsCache;
}

async function saveBarcodeSettingsToCloud(title, url) {
  const t = String(title || 'Scan CBT Android').trim();
  const u = String(url || getDefaultBarcodeUrl()).trim();
  const payload = {
    id: 'app',
    barcode_title: t,
    barcode_url: u,
    updated_at: new Date().toISOString()
  };

  __barcodeSettingsCache = { barcodeTitle: t, barcodeUrl: u };
  try {
    myLocalStorage.setItem(BARCODE_SETTINGS_TITLE_KEY, t);
    myLocalStorage.setItem(BARCODE_SETTINGS_URL_KEY, u);
  } catch (e) {
    console.warn('saveBarcodeSettingsToCloud local storage setItem failed', e);
  }

  const saveFn = async () => {
    await setDoc(getPublicDoc('Barcode', 'app'), payload, { merge: true });
  };

  try {
    if (typeof retryWithBackoff === 'function') {
      await retryWithBackoff(saveFn, { maxAttempts: 3, baseMs: 500, maxMs: 4000 });
    } else {
      await saveFn();
    }
  } catch (e) {
    console.error('saveBarcodeSettingsToCloud database setDoc failed', e);
    throw e;
  }
}
