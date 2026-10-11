const labels = { fi: 'Takaisin ylös', sv: 'Tillbaka till toppen', en: 'Back to top' };

export function setupBackToTop(button, content) {
  function updateLabel() {
    const label = labels[document.documentElement.lang] || labels.fi;
    button.setAttribute('aria-label', label);
    button.title = label;
  }
  // Observe a small marker instead of doing layout work on every scroll event.
  const marker = document.createElement('span');
  marker.className = 'back-to-top-marker';
  marker.setAttribute('aria-hidden', 'true');
  document.body.prepend(marker);
  const observer = new IntersectionObserver(([entry]) => {
    const visible = !entry.isIntersecting && entry.boundingClientRect.top < 0;
    if (!visible && document.activeElement === button) content.focus({ preventScroll: true });
    button.hidden = !visible;
  });
  observer.observe(marker);
  const languageObserver = new MutationObserver(updateLabel);
  languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  updateLabel();
  button.addEventListener('click', () => {
    content.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
}
