function toggleLoader(show, text = "MENGOLAH...") {
  const loader = document.getElementById('global-spinner');
  if (!loader) return;
  const label = loader.querySelector('p, span, .loader-text') || document.getElementById('global-spinner-text');
  if (label && text) label.textContent = text;
  if (show) {
    loader.classList.remove('hidden');
  } else {
    loader.classList.add('hidden');
  }
}
if (typeof window !== 'undefined') {
  window.toggleLoader = toggleLoader;
}
