window.changeExamFontSize = function (size) {
  const allowedSizes = ['10pt', '12pt', '14pt', '16pt', '18pt', '20pt'];
  const legacyMap = { small: '10pt', medium: '12pt', large: '16pt', kecil: '10pt', sedang: '12pt', besar: '16pt' };
  let targetSize = allowedSizes.includes(size) ? size : (legacyMap[size] || '12pt');

  const qContainer = document.getElementById('exam-question-text');
  const optionTexts = document.querySelectorAll('.option-text');
  const optionLetters = document.querySelectorAll('.option-letter');

  if (qContainer) {
    qContainer.style.setProperty('font-size', targetSize, 'important');
    qContainer.querySelectorAll('*').forEach(el => {
      el.style.setProperty('font-size', targetSize, 'important');
    });
  }

  optionTexts.forEach(el => {
    el.style.setProperty('font-size', targetSize, 'important');
    el.querySelectorAll('*').forEach(child => {
      child.style.setProperty('font-size', targetSize, 'important');
    });
  });

  optionLetters.forEach(el => {
    el.style.setProperty('font-size', `calc(${targetSize} * 0.85)`, 'important');
  });

  const activeLabel = document.getElementById('font-size-active-label');
  const activeLabelMobile = document.getElementById('font-size-active-label-mobile');
  const formattedLabel = `${targetSize.replace('pt', '')} pt`;
  if (activeLabel) activeLabel.innerText = formattedLabel;
  if (activeLabelMobile) activeLabelMobile.innerText = formattedLabel;

  myLocalStorage.setItem('fontSizePreference', targetSize);
  myLocalStorage.setItem('unbk-preferred-fontsize', targetSize);

  const fontSizeMenu = document.getElementById('fontSizeMenu');
  if (fontSizeMenu) fontSizeMenu.classList.add('hidden');
  if (typeof toggleMobileFontSizeSheet === 'function') toggleMobileFontSizeSheet(false);
};

function isExamReadyToFinish() {
  const questions = Array.isArray(EXAM_STATE.scrambledQuestions) ? EXAM_STATE.scrambledQuestions : [];
  const total = questions.length;
  if (total === 0) return false;

  return questions.every(q => EXAM_STATE.answers[q.id] !== undefined);
}

window.showFinishModal = function () {
  const modal = document.getElementById('finish-modal');
  const content = document.getElementById('finish-modal-content');
  if (!modal || !content) return;
  modal.classList.remove('hidden');
  setTimeout(() => {
    content.classList.remove('scale-95', 'opacity-0');
    content.classList.add('scale-100', 'opacity-100');
  }, 10);
  if (typeof safeCreateIcons === 'function') safeCreateIcons();
  else if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.hideFinishModal = function () {
  const modal = document.getElementById('finish-modal');
  const content = document.getElementById('finish-modal-content');
  if (!modal || !content) return;
  content.classList.remove('scale-100', 'opacity-100');
  content.classList.add('scale-95', 'opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
};

async function navigateExamQuestion(dir) {
  if (typeof ensureExamBankSoalFreshOnAction === 'function') {
    try { await ensureExamBankSoalFreshOnAction(); } catch (_) {}
  }
  if (dir === 1 && isExamReadyToFinish()) {
    showFinishModal();
    return;
  }
  const questions = Array.isArray(EXAM_STATE.scrambledQuestions) ? EXAM_STATE.scrambledQuestions : [];
  const total = questions.length;
  const target = EXAM_STATE.currentIndex + dir;
  if (target >= total) {
    for (let i = 0; i < total; i++) {
      const q = questions[i];
      if (EXAM_STATE.answers[q.id] === undefined || EXAM_STATE.doubts[q.id]) {
        EXAM_STATE.currentIndex = i;
        saveExamStateToLocal();
        renderExamQuestion();
        return;
      }
    }
  } else if (target >= 0) {
    EXAM_STATE.currentIndex = target;
    saveExamStateToLocal();
    renderExamQuestion();
  }
}
