const labels = {
  fi: { search: 'Haku ja rajaukset', sort: 'Rajaa ja järjestä', active: 'aktiivista rajausta' },
  sv: { search: 'Sök och avgränsa', sort: 'Avgränsa och sortera', active: 'aktiva avgränsningar' },
  en: { search: 'Search and filters', sort: 'Filter and sort', active: 'active filters' }
};

// Native disclosures keep hidden controls out of the tab order without extra ARIA.
export function foldControls(toolbar, lang = 'fi', { key, sort = false, state } = {}) {
  if (toolbar.closest('[data-filter-panel]')) return;
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
    const count = [...toolbar.querySelectorAll('input, select')].filter(input => {
      if (input.matches('[data-option-search], [data-tool="sort"], [data-tool="direction"], [data-vote-sort], [data-member-sort], [data-legislation-sort]')) return false;
      if (input.type === 'checkbox') return input.checked;
      if (input.tagName === 'INPUT') return Boolean(input.value.trim());
      return input.value && !['all', 'contains'].includes(input.value);
    }).length;
    summary.querySelector('[data-panel-count]').textContent = count ? `${count} ${copy.active}` : '';
  };
  toolbar.addEventListener('input', update);
  toolbar.addEventListener('change', update);
  toolbar.addEventListener('click', update);
  update();
  return panel;
}

export function foldFilterToolbars(root, lang) {
  const selectors = '.vote-filters,.member-filters,.legislation-controls,.speech-filters,.influence-filters,.election-filters,.civic-toolbar:has([data-election-district]),.programme-filters,.budget-search-controls,.research-controls,.easy-toolbar';
  root.querySelectorAll(selectors).forEach((toolbar, index) => {
    // Year/metric navigation stays beside the budget; search/filter blocks fold.
    if (toolbar.classList.contains('easy-toolbar') && (!toolbar.querySelector('input[type="search"]') || toolbar.closest('details'))) return;
    foldControls(toolbar, lang, { key: `${toolbar.classList[0]}-${index}` });
  });
}
