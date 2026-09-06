async function handleExportDatabase() {
  if (!CURRENT_USER || CURRENT_USER.role !== 'admin') return;
  toggleLoader(true);
  try {
    const payload = typeof buildDatabaseBackupPayload === 'function'
      ? await buildDatabaseBackupPayload()
      : null;
    if (!payload) throw new Error('Fungsi backup tidak tersedia.');
    const a = document.createElement('a');
    a.href = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(payload, null, 2));
    a.download = `CBT_Backup_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showNotification('OK', `Backup ${(window.CBT_DATABASE_TABLES || []).length} tabel berhasil diunduh.`, 'success');
  } catch (e) {
    console.error('handleExportDatabase failed', e);
    showNotification('Gagal', e.message || 'Gagal mengekspor database.', 'danger');
  } finally {
    toggleLoader(false);
  }
}

function handleImportDatabase(e) {
  if (!CURRENT_USER || CURRENT_USER.role !== 'admin') return;
  const f = e?.target?.files?.[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = async (ev) => {
    toggleLoader(true, 'Memulihkan backup...');
    try {
      const dt = JSON.parse(ev.target.result);
      const summary = typeof restoreDatabaseBackup === 'function'
        ? await restoreDatabaseBackup(dt)
        : [];
      mySessionStorage.removeItem('tokens_generated_session');
      await handleRefreshDatabase();
      const detail = summary.length ? summary.join('\n') : 'Semua tabel dipulihkan.';
      showNotification('OK', `Backup dipulihkan.\n${detail}`, 'success');
    } catch (er) {
      showNotification('Gagal', er.message || 'Impor gagal.', 'danger');
    } finally {
      toggleLoader(false);
      if (e.target) e.target.value = '';
    }
  };
  r.readAsText(f);
}
async function handleDeleteAllStudents() {
  if (!CURRENT_USER || CURRENT_USER.role !== 'admin') return;
  showConfirmation("Hapus Semua Siswa", "Hapus semua data siswa? Tindakan ini tidak dapat dibatalkan.", async () => {
    toggleLoader(true, "Menghapus semua data siswa...");
    try {
      const s = await getDocs(getPublicCollection("Siswa", 'nis'));
      let batch = writeBatch();
      let opCount = 0;
      for (const d of s.docs) {
        batch.delete(getPublicDoc("Siswa", d.id));
        opCount++;
        if (opCount >= 450) {
          await batch.commit();
          batch = writeBatch();
          opCount = 0;
        }
      }
      if (opCount > 0) await batch.commit();
      ALL_STUDENTS = [];
      renderStudentsCards();
      updateClassSelectors(true);
      refreshCachedDashboardStats(true);
      renderDashboardActiveExamsTable();
      showNotification("OK", "Semua data siswa berhasil dihapus", "success");
    } catch (e) {
      showNotification("Gagal", e.message || "Gagal menghapus siswa.", "danger");
    } finally {
      toggleLoader(false);
    }
  }, 'alert-triangle', null, 'Hapus');
}

function renderAdminsCards() {
  const tbody = document.getElementById('admins-table-body');
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!ALL_ADMINS.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-8 text-center text-slate-400 font-bold text-xs">Data admin tidak ditemukan</td></tr>`;
    return;
  }
  ALL_ADMINS.forEach((adm, index) => {
    const esc = typeof escapeHtmlAttr === 'function' ? escapeHtmlAttr : (v) => String(v ?? '');
    const usernameLit = esc(JSON.stringify(String(adm.username || '')));
    const usernameSafe = esc(adm.username);

    const idSuffix = encodeURIComponent(String(adm.username || '')).replace(/%/g, '_');
    tbody.innerHTML += `
      <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors border-b border-slate-100 dark:border-slate-800/80">
        <td class="py-3 px-4 font-bold text-slate-500 text-center">${index + 1}</td>
        <td class="py-3 px-4 font-semibold text-slate-700 dark:text-slate-200">${usernameSafe}</td>
        <td class="py-3 px-4 font-semibold text-slate-500 dark:text-slate-400 monospace">
          <div class="flex items-center gap-2">
            <span id="adm-pwd-text-${idSuffix}">••••••</span>
            <span id="adm-pwd-val-${idSuffix}" class="hidden">${esc(adm.password)}</span>
            <button onclick="toggleAdminDbPassword(${usernameLit})" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition" title="Lihat/Sembunyikan Password">
              <i data-lucide="eye" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
            </button>
          </div>
        </td>
        <td class="py-3 px-4 text-right">
          <div class="flex justify-end gap-1.5">
            <button onclick="triggerEditAdmin(${usernameLit})" class="p-1.5 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded-lg transition" title="Edit Password Admin">
              <i data-lucide="edit" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
            </button>
            <button onclick="triggerAdminDelete(${usernameLit})" class="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition" title="Hapus Admin">
              <i data-lucide="trash-2" class="w-3.5 h-3.5 sm:w-4 sm:h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });
  if (typeof safeCreateIcons === 'function') safeCreateIcons();
}

async function handleDeleteAllQuestions() {
  if (!CURRENT_USER || CURRENT_USER.role !== 'admin') return;
  showConfirmation("Hapus Semua Soal", "Hapus semua paket soal dan soal? Tindakan ini tidak dapat dibatalkan.", async () => {
    toggleLoader(true, "Menghapus semua data soal...");
    try {
      const s = await getDocs(getPublicCollection("Bank Soal", 'id_paket'));
      let batch = writeBatch();
      let opCount = 0;
      for (const d of s.docs) {
        batch.delete(getPublicDoc("Bank Soal", d.id));
        opCount++;
        if (opCount >= 450) {
          await batch.commit();
          batch = writeBatch();
          opCount = 0;
        }
      }
      if (opCount > 0) await batch.commit();
      ALL_PACKETS = [];
      renderPacketsCards();
      refreshBankSoalDropdowns(true);
      refreshCachedDashboardStats(true);
      renderDashboardActiveExamsTable();
      showNotification("OK", "Semua soal berhasil dihapus", "success");
    } catch (e) {
      showNotification("Gagal", e.message || "Gagal menghapus soal.", "danger");
    } finally {
      toggleLoader(false);
    }
  }, 'alert-triangle', null, 'Hapus');
}

async function handleDeleteAllSchedules() {
  if (!CURRENT_USER || CURRENT_USER.role !== 'admin') return;
  showConfirmation("Hapus Semua Jadwal", "Hapus semua jadwal ujian? Tindakan ini tidak dapat dibatalkan.", async () => {
    toggleLoader(true, "Menghapus semua jadwal...");
    try {
      const s = await getDocs(getPublicCollection("Jadwal Ujian", 'id'));
      let batch = writeBatch();
      let opCount = 0;
      for (const d of s.docs) {
        batch.delete(getPublicDoc("Jadwal Ujian", d.id));
        opCount++;
        if (opCount >= 450) {
          await batch.commit();
          batch = writeBatch();
          opCount = 0;
        }
      }
      if (opCount > 0) await batch.commit();
      ALL_SCHEDULES = [];
      renderSchedules();
      updateAdminTokenBars(true);
      refreshCachedDashboardStats(true);
      renderDashboardActiveExamsTable();
      showNotification("OK", "Semua jadwal berhasil dihapus", "success");
    } catch (e) {
      showNotification("Gagal", e.message || "Gagal menghapus jadwal.", "danger");
    } finally {
      toggleLoader(false);
    }
  }, 'alert-triangle', null, 'Hapus');
}

async function handleDeleteExamAnswers() {
  if (!CURRENT_USER || CURRENT_USER.role !== 'admin') return;
  showConfirmation("Hapus Jawaban", "Kosongkan semua jawaban ujian?", async () => {
    toggleLoader(true, "Menghapus semua jawaban...");
    try {
      const s = await getDocs(getPublicCollection("Jawaban Siswa", 'id'));
      let batch = writeBatch();
      let opCount = 0;
      for (const d of s.docs) {
        batch.delete(getPublicDoc("Jawaban Siswa", d.id));
        opCount++;
        if (opCount >= 450) {
          await batch.commit();
          batch = writeBatch();
          opCount = 0;
        }
      }
      if (opCount > 0) await batch.commit();
      ALL_RESULTS = [];
      if (typeof window.renderResultsCards === 'function') window.renderResultsCards();
      else if (typeof renderResultsCards === 'function') renderResultsCards();
      refreshCachedDashboardStats(true);
      showNotification("OK", "Semua jawaban berhasil dihapus", "success");
    } catch (e) {
      showNotification("Gagal", e.message || "Gagal menghapus jawaban.", "danger");
    } finally {
      toggleLoader(false);
    }
  }, 'alert-triangle', null, 'Hapus');
}

async function handlePurgeDatabaseTotal() {
  if (!CURRENT_USER || CURRENT_USER.role !== 'admin') return;
  const btn = document.getElementById('btn-purge-database');
  const originalHtml = btn ? btn.innerHTML : '';

  if (btn) {
    btn.disabled = true;
    btn.classList.add('opacity-75', 'cursor-not-allowed');
    btn.innerHTML = `<span class="inline-flex items-center justify-center gap-2"><svg class="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Menghapus Data...</span>`;
  }

  toggleLoader(true, 'Menghapus semua data database...');
  try {
    if (typeof purgeDatabaseExceptProtected === 'function') {
      await purgeDatabaseExceptProtected();
    }
    mySessionStorage.removeItem('tokens_generated_session');
    await handleRefreshDatabase();
    showNotification(
      'OK',
      'Data berhasil dibersihkan.<br>Tabel <strong>Admin</strong> dan <strong>Pengaturan</strong> tidak dihapus.',
      'success'
    );
  } catch (e) {
    showNotification('Gagal', e.message || 'Gagal menghapus data.', 'danger');
  } finally {
    toggleLoader(false);
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('opacity-75', 'cursor-not-allowed');
      btn.innerHTML = originalHtml;
    }
  }
}

function askPurgeDatabaseTotal() {
  showConfirmation(
    'Bersihkan Database',
    `Data siswa, bank soal, jadwal, sesi ujian, dan jawaban akan dihapus.<br><br>Tabel <strong>Admin</strong> dan <strong>Pengaturan</strong> tidak dihapus. Lanjutkan?`,
    async () => {
      await handlePurgeDatabaseTotal();
    },
    'alert-triangle',
    null,
    'Hapus Semua Data'
  );
}
async function handleResetAllSessions() {
  if (!CURRENT_USER || CURRENT_USER.role !== 'admin') return;
  showConfirmation(
    'Reset Sesi',
    'Logout semua siswa aktif? Jawaban, nomor soal terakhir, dan sisa waktu ujian tetap tersimpan. Siswa dapat login kembali untuk melanjutkan dari titik terakhir.',
    async () => {
      toggleLoader(true, 'Mengirim sinyal reset ke semua perangkat...');
      try {
        let sessions = (ACTIVE_MONITOR_DATA || [])
          .filter((s) => s && s.id && !s.force_finished && !s.force_reset)
          .map((s) => ({ id: s.id }));
        if (!sessions.length) {
          const s = await getDocs(getPublicCollection('Session Ujian', 'id'));
          sessions = (s.docs || []).map((d) => ({ id: d.id }));
        }
        if (!sessions.length) {
          showNotification('Kosong', 'Tidak ada sesi aktif yang perlu direset.', 'info');
          return;
        }

        let count = 0;
        if (typeof forceResetSessionsMany === 'function') {
          count = await forceResetSessionsMany(sessions, 'proktor_all');
        } else if (typeof updateSessionAlertFieldsMany === 'function') {
          await updateSessionAlertFieldsMany(sessions, {
            force_reset: true,
            force_reset_reason: 'proktor_all',
            force_reset_at: new Date().toISOString()
          });
          count = sessions.length;
          for (const session of sessions) {
            try { await deleteDoc(getPublicDoc('Session Ujian', session.id)); } catch (_) {}
          }
        } else {
          throw new Error('Modul reset massal tidak tersedia.');
        }

        ACTIVE_MONITOR_DATA = [];
        if (typeof renderActiveMonitorList === 'function') renderActiveMonitorList();
        if (typeof updateGlobalMonitorChatButton === 'function') updateGlobalMonitorChatButton();
        if (typeof refreshCachedDashboardStats === 'function') refreshCachedDashboardStats(true);
        showNotification('OK', `${count} siswa akan logout otomatis dari perangkat.`, 'success');
      } catch (e) {
        showNotification('Gagal', e.message || 'Gagal mereset sesi.', 'danger');
      } finally {
        toggleLoader(false);
      }
    },
    'alert-triangle'
  );
}
