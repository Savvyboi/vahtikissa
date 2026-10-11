const SCROLL_KEY = 'vahtikissaScroll';
const pendingRenders = new WeakMap();

export const currentScrollPosition = () => ({ x: window.scrollX, y: window.scrollY });

// Undefined distinguishes a new direct link from a history entry with a saved position.
export function savedScrollPosition() {
  const position = history.state?.[SCROLL_KEY];
  return position && Number.isFinite(position.x) && Number.isFinite(position.y) ? position : undefined;
}

export function rememberScrollPosition() {
  history.replaceState({ ...history.state, [SCROLL_KEY]: currentScrollPosition() }, '', location.href);
}

export function pushRoute(hash) {
  if (hash === location.hash) return false;
  rememberScrollPosition();
  history.pushState({ [SCROLL_KEY]: currentScrollPosition() }, '', hash);
  return true;
}

export function trackScrollHistory() {
  history.scrollRestoration = 'manual';
  // DOM replacements have their own explicit restoration; native anchoring can apply a second, delayed jump.
  document.documentElement.style.overflowAnchor = 'none';
  let frame;
  window.addEventListener('scroll', () => {
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = null; rememberScrollPosition(); });
  }, { passive: true });
  window.addEventListener('pagehide', rememberScrollPosition);
}

/** Keep a loading placeholder from collapsing the document and losing the reader's place. */
export function preservePageScroll(root, update, position = currentScrollPosition()) {
  const previous = pendingRenders.get(root);
  const render = { minHeight: previous?.minHeight ?? root.style.minHeight };
  pendingRenders.set(root, render);
  const documentTop = root.getBoundingClientRect().top + window.scrollY;
  root.style.minHeight = `${Math.max(root.offsetHeight, position.y + window.innerHeight - documentTop)}px`;
  const restore = point => window.scrollTo({ left: point.x, top: point.y, behavior: 'instant' });
  const finish = () => {
    if (pendingRenders.get(root) !== render) return;
    // Readers may have moved while the data was loading; keep their latest position.
    const latest = currentScrollPosition();
    root.style.minHeight = render.minHeight;
    pendingRenders.delete(root);
    restore(latest);
  };
  try {
    const result = update();
    restore(position);
    if (result?.then) return Promise.resolve(result).finally(finish);
    finish();
    return result;
  } catch (error) {
    finish();
    throw error;
  }
}
