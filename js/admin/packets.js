function renderPacketsCards() {
  const c = document.getElementById('packets-cards-container');
  if (!c) return;
  if (!ALL_PACKETS.length) {
    c.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 font-bold text-xs">Kosong</td></tr>`;
    buildPaginationControls('packets-pagination-controls', 1, 0, null);
    refreshBankSoalDropdowns(true);
    return;
  }
  const pageSize = 10;
  let pageNumber = getPageNumber('packets');
  const pageCount = Math.max(1, Math.ceil(ALL_PACKETS.length / pageSize));
  if (pageNumber > pageCount) pageNumber = pageCount;
  setPageNumber('packets', pageNumber);
  const displayItems = ALL_PACKETS.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);

  const esc = typeof escapeHtmlAttr === 'function' ? escapeHtmlAttr : (v) => String(v ?? '');
  c.innerHTML = displayItems.map((pkt, idx) => {
    const globalIdx = (pageNumber - 1) * pageSize + idx + 1;
    const packetId = String(pkt.id_paket || '');
    return `<tr class="bg-white dark:bg-slate-900"><td class="px-3 py-3 text-slate-700 dark:text-slate-300">${globalIdx}</td><td class="px-3 py-3 text-left text-slate-800 dark:text-slate-100">${esc(pkt.nama_paket ?? '')}</td><td class="px-3 py-3 text-slate-700 dark:text-slate-300">${pkt.jumlah_soal ?? pkt.daftar_soal?.length ?? 0}</td><td class="px-3 py-3 text-center"><button type="button" data-action="delete-packet" data-packet-id="${esc(packetId)}" class="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl text-[9px] sm:text-[10px] font-semibold">Hapus</button></td></tr>`;
  }).join('');

  c.querySelectorAll('[data-action="delete-packet"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const packetId = btn.getAttribute('data-packet-id');
      if (packetId && typeof triggerDeletePacket === 'function') {
        triggerDeletePacket(packetId);
      }
    });
  });

  buildPaginationControls('packets-pagination-controls', pageNumber, pageCount, (newPage) => {
    setPageNumber('packets', newPage);
    renderPacketsCards();
  });
  if (typeof safeCreateIcons === 'function') safeCreateIcons();
  refreshBankSoalDropdowns(true);
}
