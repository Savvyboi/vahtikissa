// Explicit URLs win over the remembered preference, including a shared full view.
export function readingMode(search, remembered = 'full') {
  const requested = new URLSearchParams(search).get('view');
  return ['simple', 'full'].includes(requested) ? requested : remembered === 'simple' ? 'simple' : 'full';
}

export function readingModeURL(url, mode) {
  const next = new URL(url);
  next.searchParams.set('view', mode === 'simple' ? 'simple' : 'full');
  return next;
}