const labels = {
  fi: { search: 'Haku, rajaukset ja järjestys', sort: 'Haku, rajaukset ja järjestys', active: 'aktiivista rajausta' },
  sv: { search: 'Sök, avgränsa och sortera', sort: 'Sök, avgränsa och sortera', active: 'aktiva avgränsningar' },
  en: { search: 'Search, filter and sort', sort: 'Search, filter and sort', active: 'active filters' }
};

// Native disclosures keep hidden controls out of the tab order without extra ARIA.
export function foldControls(toolbar, lang = 'fi', { key, sort = false, state } = {}) {
  const existing = toolbar.closest('[data-filter-panel]');
  if (existing) {
    if (state) { if (state.open.__panel !== undefined) existing.open = Boolean(state.open.__panel); existing.addEventListener('toggle', () => { if (existing.isConnected) state.open.__panel = existing.open; }); }
    existing.dispatchEvent(new Event('change', {bubbles:true}));
    return existing;
  }
  const copy = labels[lang] || labels.fi;
  const panel = document.createElement('details');
  panel.className = 'filter-panel';
  panel.dataset.filterPanel = key;
  panel.open = Boolean(state?.open?.__panel);
  const summary = document.createElement('summary');
  summary.innerHTML = `<span class="cat-paw" aria-hidden="true"></span><span>${copy[sort ? 'sort' : 'search']}</span><span class="filter-panel-count" data-panel-count></span>`;
  toolbar.before(panel);
  panel.append(summary, toolbar);
  if (state) panel.addEventListener('toggle', () => {
    if (panel.isConnected) state.open.__panel = panel.open;
  });
  const update = () => {
    const count = [...panel.querySelectorAll('input, select')].filter(input => {
      if (input.matches('[data-option-search], [data-tool="sort"], [data-tool="direction"], [data-vote-sort], [data-member-sort], [data-legislation-sort]')) return false;
      if (input.type === 'checkbox') return input.checked;
      if (input.tagName === 'INPUT') return Boolean(input.value.trim());
      return input.value && !['all', 'contains'].includes(input.value);
    }).length;
    summary.querySelector('[data-panel-count]').textContent = count ? `${count} ${copy.active}` : '';
  };
  panel.addEventListener('input', update);
  panel.addEventListener('change', update);
  panel.addEventListener('click', update);
  update();
  return panel;
}

export function foldFilterToolbars(root, lang) {
  const selectors = '.vote-filters,.member-filters,.legislation-controls,.speech-search-controls,.influence-filters,.election-filters,.civic-toolbar:has([data-election-district]),.programme-filters,.budget-search-controls,.easy-toolbar';
  root.querySelectorAll(selectors).forEach((toolbar, index) => {
    if (toolbar.closest('[data-visible-controls]')) return;
    // Year/metric navigation stays beside the budget; search/filter blocks fold.
    if (toolbar.classList.contains('easy-toolbar') && (!toolbar.querySelector('input[type="search"]') || toolbar.closest('details'))) return;
    foldControls(toolbar, lang, { key: `${toolbar.classList[0]}-${index}` });
  });
}
