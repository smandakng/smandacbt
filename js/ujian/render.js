function updateExamAnswerSelection() {
  document.querySelectorAll('#exam-options-container .option-input').forEach((radio) => {
    const q = EXAM_STATE.scrambledQuestions[EXAM_STATE.currentIndex];
    if (!q) return;
    radio.checked = EXAM_STATE.answers[q.id] === radio.value;
  });
  updateExamProgressUI();
  renderDesktopMapGrid();
}

function renderExamQuestion() {
  const q = EXAM_STATE.scrambledQuestions[EXAM_STATE.currentIndex];
  const qNumDesktop = document.getElementById('current-q-num-desktop');
  const qNumMobile = document.getElementById('current-q-num-mobile');
  const tEl = document.getElementById('exam-question-text');
  const mb = document.getElementById('exam-media-placeholder');
  const mi = document.getElementById('exam-question-image');
  const chkRagu = document.getElementById('chk-ragu');
  const oc = document.getElementById('exam-options-container');
  const qNum = EXAM_STATE.currentIndex + 1;

  if (qNumDesktop) qNumDesktop.innerText = q ? qNum : '0';
  if (qNumMobile) qNumMobile.innerText = q ? qNum : '0';

  if (!q) {
    if (tEl) tEl.innerText = 'Tidak ada soal tersedia.';
    if (mb) mb.classList.add('hidden');
    if (chkRagu) chkRagu.disabled = true;
    if (oc) oc.innerHTML = `<div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 text-sm">Belum ada soal pada paket ini.</div>`;
    updateExamProgressUI();
    renderDesktopMapGrid();
    return;
  }

  if (tEl) {
    let cleanSoal = q.soal || '-';
    cleanSoal = stripQuestionKeyFromHtml(cleanSoal);
    cleanSoal = cleanSoal.replace(/^(?:<p[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>|<br\s*\/?>)+|(?:<p[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>|<br\s*\/?>)+$/gi, '').trim();
    tEl.innerHTML = sanitizeHtmlContent(cleanSoal);
  }
  const currentQuestionImageAsset = normalizeImageAsset(q.image);
  if (currentQuestionImageAsset && mi && mb) {
    mi.src = currentQuestionImageAsset.data;
    mb.classList.remove('hidden');
  } else if (mb) mb.classList.add('hidden');

  if (chkRagu) {
    chkRagu.disabled = false;
    chkRagu.checked = !!EXAM_STATE.doubts[q.id];
  }

  if (oc) {
    oc.innerHTML = "";
    const so = (EXAM_STATE.scrambledOptions && EXAM_STATE.scrambledOptions[q.id]) ? EXAM_STATE.scrambledOptions[q.id] : (q.opsi || []);
    so.forEach((opt, index) => {
      const isChecked = EXAM_STATE.answers[q.id] === opt.key;
      const optId = `opt-${q.id}-${opt.key}`;
      const displayLabel = opt.displayKey || String.fromCharCode(65 + index);
      let rawOptText = opt.text || '';
      rawOptText = rawOptText.replace(/^(?:<p[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>|<br\s*\/?>)+|(?:<p[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>|<br\s*\/?>)+$/gi, '').trim();
      const optTextHtml = sanitizeHtmlContent(rawOptText);
      const optionImageAsset = typeof normalizeImageAsset === 'function'
        ? normalizeImageAsset(opt.image)
        : null;
      const hasText = !!(rawOptText && String(rawOptText).replace(/<[^>]*>/g, '').trim());
      const optionImageHtml = optionImageAsset && !/<img[\s\S]*src=['\"]?data:image/i.test(optTextHtml)
        ? `<div class="mt-1"><img src="${optionImageAsset.data}" alt="Opsi ${displayLabel}" class="max-w-full h-auto rounded-xl object-contain"></div>`
        : '';
      const bodyHtml = hasText || optionImageHtml
        ? `${hasText ? optTextHtml : ''}${optionImageHtml}`
        : (optTextHtml && optTextHtml !== '-' ? optTextHtml : '');
      const wrapper = document.createElement('div');
      wrapper.className = 'relative w-full ml-0 pl-0';
      wrapper.innerHTML = `
        <input type="radio" name="answer" id="${optId}" class="option-input peer sr-only" value="${opt.key}" ${isChecked ? 'checked' : ''}>
        <label for="${optId}" class="group option-label flex items-baseline py-1 px-0 pl-0 ml-0 rounded-lg border-0 border-transparent outline-none focus:outline-none focus:ring-0 bg-white dark:bg-slate-800 cursor-pointer w-full">
          <span class="option-letter shrink-0 rounded-full flex items-center justify-center font-semibold text-slate-700 dark:text-slate-300 mr-2 group-hover:text-primary dark:group-hover:text-blue-400 ml-0" style="width:1.75em; height:1.75em; font-size: 0.85em; line-height:1; transform: translateY(0.1em);">${displayLabel}<span class="option-letter-suffix">)</span></span>
          <div class="option-text text-slate-700 dark:text-slate-300 text-[12pt] font-normal leading-relaxed text-justify">${bodyHtml}</div>
        </label>`;
      const radio = wrapper.querySelector('input');
      radio.addEventListener('change', () => {
        const currentQ = EXAM_STATE.scrambledQuestions[EXAM_STATE.currentIndex];
        if (!currentQ) return;
        EXAM_STATE.answers[currentQ.id] = opt.key;
        saveExamStateToLocal();
        updateExamAnswerSelection();
        if (typeof sendExamHeartbeat === 'function') sendExamHeartbeat();
      });
      oc.appendChild(wrapper);
    });
  }

  const preferredSize = myLocalStorage.getItem('fontSizePreference')
    || myLocalStorage.getItem('unbk-preferred-fontsize')
    || '12pt';
  changeExamFontSize(preferredSize);
  updateExamProgressUI();
  renderDesktopMapGrid();
  const scrollArea = document.querySelector('.exam-scroll-area');
  if (scrollArea) scrollArea.scrollTop = 0;
  if (typeof safeCreateIcons === 'function') safeCreateIcons();
  else if (typeof lucide !== 'undefined') lucide.createIcons();
}
