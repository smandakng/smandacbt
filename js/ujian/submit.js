async function autoSubmitExam(r) {
  if (window.__examFinalized || window.__examSubmitInFlight) return;

  // Validasi 1: waktu ujian habis (sisi client atau sisi server/jadwal)
  const isServerScheduleEnded = Boolean(
    EXAM_STATE.schedule
    && typeof getExamScheduleEndMs === 'function'
    && typeof getServerNowMs === 'function'
    && getServerNowMs() >= getExamScheduleEndMs(EXAM_STATE.schedule)
  );
  const remainingSec = Number(EXAM_STATE.timeRemaining);
  const isTimeExpired = (!Number.isNaN(remainingSec) && remainingSec <= 0) || isServerScheduleEnded;

  // Validasi 2: jumlah pelanggaran >= batas toleransi dari database
  // getMaxExamViolations() selalu membaca dari window.__securitySettingsCache (database).
  // Jika fungsi belum tersedia, submit otomatis DICEGAH (safe-fail: tidak ada fallback).
  if (typeof getMaxExamViolations !== 'function') {
    console.warn(`[autoSubmitExam] Pengiriman otomatis dicegah — getMaxExamViolations belum tersedia. Alasan: "${r}".`);
    return;
  }
  const maxAllowed = getMaxExamViolations();
  const isViolationLimitReached = (EXAM_STATE.cheatTabCount || 0) >= maxAllowed;

  if (!isTimeExpired && !isViolationLimitReached) {
    console.warn(`[autoSubmitExam] Pengiriman otomatis dicegah. Alasan: "${r}". Durasi sisa: ${EXAM_STATE.timeRemaining}s, Pelanggaran: ${EXAM_STATE.cheatTabCount || 0}/${maxAllowed} (batas dari database).`);
    return;
  }

  console.info(`[autoSubmitExam] Kondisi terpenuhi — ${isTimeExpired ? 'Durasi habis' : ''}${isTimeExpired && isViolationLimitReached ? ' & ' : ''}${isViolationLimitReached ? `Pelanggaran ${EXAM_STATE.cheatTabCount || 0}/${maxAllowed} (batas database)` : ''}. Alasan: "${r}".`);
  window.__examEndSubmitScheduled = false;
  toggleLoader(true, "Mengirim...");
  await finalizeExamAnswersAndGrade(r);
}

function restoreExamAfterFailedSubmit() {
  if (window.__examFinalized || !window.__examStarted) return;
  window.__examEndSubmitScheduled = false;
  if (typeof startExamCloudSync === 'function') startExamCloudSync();
  if (typeof markExamPageActive === 'function') markExamPageActive();
  if (EXAM_STATE.timeRemaining > 0 && !EXAM_STATE.timerInterval && typeof startExamTimer === 'function') {
    if (!window.__examTimerPausedForProctor) startExamTimer();
  }
  if (typeof startIdleDetector === 'function') startIdleDetector();
  if (typeof requestExamFullscreen === 'function') requestExamFullscreen();
}

async function finalizeExamAnswersAndGrade(s) {
  if (!CURRENT_USER) {
    toggleLoader(false);
    showNotification("Gagal", "Sesi tidak valid. Silakan login ulang.", "danger");
    return;
  }
  if (window.__examFinalized) {
    toggleLoader(false);
    return;
  }
  if (window.__examSubmitInFlight || window.__examSubmitPreparing) {
    toggleLoader(false);
    return;
  }

  if (s !== "Kirim Manual" && s !== "Proktor") {
    // Guard submit otomatis: hanya diizinkan jika durasi habis ATAU pelanggaran >= batas database.
    const isScheduleEnded = Boolean(
      EXAM_STATE.schedule
      && typeof getExamScheduleEndMs === 'function'
      && typeof getServerNowMs === 'function'
      && getServerNowMs() >= getExamScheduleEndMs(EXAM_STATE.schedule)
    );
    const remainingSec = Number(EXAM_STATE.timeRemaining);
    const isTimeExpired = (!Number.isNaN(remainingSec) && remainingSec <= 0) || isScheduleEnded;

    // Batas toleransi pelanggaran selalu diambil dari database via getMaxExamViolations().
    // Jika fungsi belum tersedia, submit otomatis DITOLAK (safe-fail: tidak ada fallback hardcode).
    if (typeof getMaxExamViolations !== 'function') {
      toggleLoader(false);
      console.warn(`[finalizeExamAnswersAndGrade] Submit otomatis ditolak — getMaxExamViolations belum tersedia. Alasan: "${s}".`);
      return;
    }
    const maxAllowed = getMaxExamViolations();
    const isViolationLimitReached = (EXAM_STATE.cheatTabCount || 0) >= maxAllowed;

    if (!isTimeExpired && !isViolationLimitReached) {
      toggleLoader(false);
      console.warn(`[finalizeExamAnswersAndGrade] Submit otomatis ditolak. Alasan: "${s}". Durasi sisa: ${EXAM_STATE.timeRemaining}s, Pelanggaran: ${EXAM_STATE.cheatTabCount || 0}/${maxAllowed} (batas dari database).`);
      return;
    }
  }

  window.__examSubmitPreparing = true;
  stopExamTimer();
  if (typeof stopIdleDetector === 'function') stopIdleDetector();

  try {
    if (typeof ensureExamBankSoalFreshOnAction === 'function') {
      try { await ensureExamBankSoalFreshOnAction(); } catch (_) { }
    }
    if (typeof syncServerTimeOffset === 'function') await syncServerTimeOffset(true);
    if (typeof assertExamSubmissionAllowed === 'function') {
      assertExamSubmissionAllowed(EXAM_STATE.schedule, s);
    }
    stopExamCloudSync();
    if (window.__examFinalized || window.__proctorResetLogoutInProgress) return;

    window.__examSubmitInFlight = true;
    const saved = typeof saveExamResultAndDeleteSession === 'function'
      ? await saveExamResultAndDeleteSession(EXAM_STATE, CURRENT_USER, s)
      : false;
    if (!saved || saved.ok === false) throw new Error('Gagal menyimpan hasil ujian ke server.');

    window.__examFinalized = true;
    if (typeof stopAntiCheatEngines === 'function') stopAntiCheatEngines();

    const gr = (saved && typeof saved === 'object' && saved.nilai != null)
      ? saved.nilai
      : (typeof calculateExamScoreFromState === 'function'
        ? calculateExamScoreFromState(EXAM_STATE).nilai
        : 0);
    myLocalStorage.removeItem(`ar_cbt_state_${EXAM_STATE.schedule.id}_${CURRENT_USER.nis}`);

    const showScore = EXAM_STATE.schedule?.tampil_nilai === true;
    const alertMsg = showScore
      ? `Ujian Selesai! Nilai Akhir Anda: ${gr}`
      : "Ujian Selesai! Jawaban Anda telah sukses terkirim ke server.";

    if (typeof exitExamFullscreen === 'function') {
      await exitExamFullscreen();
    } else if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.warn(err));
    }
    const btnConfirm = document.getElementById('dialog-btn-confirm');
    const originalBtnText = btnConfirm ? btnConfirm.innerText : "Lanjutkan";
    if (btnConfirm) btnConfirm.innerText = "Kembali ke Halaman Utama";

    showNotification("Sukses", alertMsg, "success", () => {
      if (btnConfirm) btnConfirm.innerText = originalBtnText;
      handleLogout();
    });
  } catch (err) {
    if (!window.__examFinalized) {
      stopExamTimer();
      restoreExamAfterFailedSubmit();
      const canRetry = window.__examStarted && !window.__examFinalized;
      showNotification(
        "Gagal",
        (err.message || "Gagal mengirim ujian.") + (canRetry ? " Tekan OK untuk mencoba lagi." : ""),
        "danger",
        canRetry ? () => {
          if (s === "Kirim Manual" || s === "Proktor") {
            finalizeExamAnswersAndGrade(s);
          } else {
            autoSubmitExam(s);
          }
        } : undefined
      );
    } else {
      showNotification("Gagal", err.message || "Gagal mengirim ujian. Silakan coba lagi.", "danger");
    }
  } finally {
    window.__examSubmitPreparing = false;
    window.__examSubmitInFlight = false;
    toggleLoader(false);

    if (!window.__examFinalized && window.__pendingProctorFinishBy) {
      const by = window.__pendingProctorFinishBy;
      window.__pendingProctorFinishBy = null;
      window.__pendingProctorReset = false;
      if (typeof handleProctorFinishLogout === 'function') handleProctorFinishLogout(by);
    } else if (!window.__examFinalized && window.__pendingProctorReset) {
      window.__pendingProctorReset = false;
      if (typeof handleProctorResetLogout === 'function') handleProctorResetLogout();
    }
  }
}
