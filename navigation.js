const SCROLL_KEY = 'vahtikissaScroll';
const pendingRenders = new WeakMap();
const navigationSwedishEnglish = {
  overview: ['Aktuellt i riksdagen', 'Latest from Parliament'],
  following: ['Ledamöter och teman du följer', 'MPs and themes you follow'],
  parliament: ['Riksdagens arbete', 'Parliament’s work'],
  parliamentHint: ['Omröstningar, lagar och anföranden', 'Votes, bills and speeches'],
  votes: ['Resultat och ledamöternas röster', 'Results and how MPs voted'],
  sessions: ['Plenisammanträden efter datum', 'Plenary sessions by date'],
  legislation: ['Lagförslag och behandlingsskeden', 'Bills and legislative stages'],
  stories: ['Förklaringar av lagförslag', 'Bills explained in plain language'],
  speeches: ['Anföranden efter ämne', 'Parliamentary speeches by topic'],
  people: ['Ledamöter och partier', 'MPs and parties'],
  peopleHint: ['Ledamöter, program och val', 'MPs, platforms and elections'],
  members: ['Ledamöternas profiler och arbete', 'MP profiles and activity'],
  parties: ['Riksdagsgrupper och jämförelser', 'Parliamentary groups and comparisons'],
  programmes: ['Valprogram och politiska mål', 'Election platforms and policies'],
  elections: ['Resultat och valkretsar', 'Results and electoral districts'],
  'campaign-finance': ['Kampanjer och stödgivare', 'Campaigns and donors'],
  power: ['Pengar och inflytande', 'Money and influence'],
  powerHint: ['Budget, bindningar och nätverk', 'Budget, disclosures and networks'],
  budget: ['Statens utgifter och anslag', 'State spending and appropriations'],
  influence: ['Inkomster, gåvor och lobbning', 'Income, gifts and lobbying'],
  relationships: ['Röster, anföranden och lobbykontakter', 'Voting, speech and lobbying ties']
};

export function setupPrimaryNavigation(nav, toggle, { getPage, translate, menuLabel, onOpen }) {
  const desktop = matchMedia('(min-width: 1360px)');
  const links = Array.from(nav.querySelectorAll('a[data-page]'));
  const groups = Array.from(nav.querySelectorAll('details[data-nav-group]'));
  const copy = Array.from(nav.querySelectorAll('[data-nav-copy]'), node => [node, node.textContent]);
  const groupFor = page => links.find(link => link.dataset.page === page)?.closest('details');
  let selectedPage;

  const localizeToggle = () => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    toggle.querySelector('[data-menu-label]').textContent = menuLabel();
    toggle.setAttribute('aria-label', open ?
      translate('Sulje valikko', 'Stäng meny', 'Close menu') :
      translate('Avaa valikko', 'Öppna meny', 'Open menu'));
  };
  const setDrawer = (open, restore = false) => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
    localizeToggle();
    if (restore) toggle.focus({ preventScroll: true });
  };
  const openGroup = page => {
    const group = groupFor(page);
    if (group) group.open = true;
  };
  const applyBreakpoint = () => {
    const wasOpen = nav.classList.contains('open');
    const focusInNav = nav.contains(document.activeElement);
    const focusOnToggle = document.activeElement === toggle;
    const current = getPage();
    const currentGroup = groupFor(current) || groups[0];
    for (const group of groups) group.open = desktop.matches || group === currentGroup;
    setDrawer(false, !desktop.matches && focusInNav);
    if (desktop.matches && (wasOpen || focusOnToggle)) {
      (links.find(link => link.dataset.page === current && link.getClientRects().length) || links[0]).focus({ preventScroll: true });
    }
  };

  toggle.addEventListener('click', () => {
    if (nav.classList.contains('open')) {
      setDrawer(false, true);
      return;
    }
    onOpen();
    setDrawer(true);
    openGroup(getPage());
    nav.scrollTop = 0;
    links[0].focus({ preventScroll: true });
  });
  nav.addEventListener('click', event => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
        event.target.closest('a[data-page]')) setDrawer(false);
  });
  const dismissOutside = event => {
    if (nav.classList.contains('open') && !nav.contains(event.target) && !toggle.contains(event.target)) setDrawer(false);
  };
  document.addEventListener('click', dismissOutside);
  document.addEventListener('focusin', dismissOutside);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav.classList.contains('open')) setDrawer(false, true);
  });
  desktop.addEventListener('change', applyBreakpoint);
  applyBreakpoint();

  return {
    close: () => setDrawer(false),
    localize(simple, labelFor) {
      nav.setAttribute('aria-label', translate('Päänavigaatio', 'Huvudnavigation', 'Main navigation'));
      for (const link of links) link.querySelector('[data-nav-label]').textContent = labelFor(link.dataset.page);
      for (const [node, finnish] of copy) {
        const key = node.dataset.navCopy;
        node.textContent = simple && key === 'people' ? translate('Edustajat', 'Ledamöter', 'MPs') :
          simple && key === 'peopleHint' ? translate('Edustajaprofiilit ja vaalirahoitus', 'Ledamotsprofiler och valfinansiering', 'MP profiles and campaign finance') :
          translate(finnish, ...navigationSwedishEnglish[key]);
      }
      localizeToggle();
    },
    select(page) {
      if (selectedPage === page) return;
      selectedPage = page;
      for (const link of links) {
        if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
      openGroup(page);
    }
  };
}

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
