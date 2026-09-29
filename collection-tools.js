import { escapeHTML as e } from './app-utils.js';

const copy = {
  fi: { tools: 'Rajaa ja järjestä', search: 'Hae tästä listasta', sort: 'Järjestä', direction: 'Suunta', asc: 'Nouseva (A–Ö / pienin ensin)', desc: 'Laskeva (Ö–A / suurin ensin)', include: 'Sisällytä', exclude: 'Sulje pois', help: 'Tyhjä sisällytys näyttää kaikki. Saman ryhmän valinnat yhdistetään TAI-ehdolla, eri ryhmät JA-ehdolla. Poissulkeminen on ensisijainen.', from: 'Alkaen', to: 'Asti', min: 'Vähintään', max: 'Enintään', clear: 'Tyhjennä lisärajaukset', options: 'Hae vaihtoehtoa', active: 'aktiivista rajausta', results: 'tulosta' },
  sv: { tools: 'Avgränsa och sortera', search: 'Sök i denna lista', sort: 'Sortera', direction: 'Riktning', asc: 'Stigande (A–Ö / minsta först)', desc: 'Fallande (Ö–A / största först)', include: 'Inkludera', exclude: 'Uteslut', help: 'Tom inkludering visar alla. Val inom en grupp kombineras med ELLER, olika grupper med OCH. Uteslutning har företräde.', from: 'Från', to: 'Till', min: 'Minst', max: 'Högst', clear: 'Rensa extra avgränsningar', options: 'Sök alternativ', active: 'aktiva avgränsningar', results: 'resultat' }
};

export function collectionState(sort = '', direction = 'asc') {
  return { query: '', sort, direction, facets: {}, from: '', to: '', min: '', max: '', open: {} };
}

function values(value) {
  return (Array.isArray(value) ? value : [value]).filter(value => value != null).map(String);
}

export function matchesSelection(value, selection = {}) {
  const keys = values(value);
  const include = values(selection.include || []), exclude = values(selection.exclude || []);
  return !exclude.some(key => keys.includes(key)) && (!include.length || include.some(key => keys.includes(key)));
}

export function applyCollection(items, state, config = {}, lang = 'fi') {
  const query = state.query.trim().toLocaleLowerCase(lang);
  const sort = config.sorts?.find(item => item.key === state.sort) || config.sorts?.[0];
  const filtered = items.filter(item => {
    if (query && !values(config.search?.(item)).some(value => value.toLocaleLowerCase(lang).includes(query))) return false;
    if ((config.facets || []).some(facet => !matchesSelection(facet.value(item), state.facets[facet.key]))) return false;
    const date = String(config.date?.(item) || '').slice(0, 10);
    if (config.date && ((state.from && date < state.from) || (state.to && (!date || date > state.to)))) return false;
    const amount = config.number?.value(item);
    if (config.number && ((state.min !== '' && (amount == null || !Number.isFinite(Number(amount)) || Number(amount) < Number(state.min))) || (state.max !== '' && (amount == null || !Number.isFinite(Number(amount)) || Number(amount) > Number(state.max))))) return false;
    return true;
  });
  if (!sort) return filtered;
  const collator = new Intl.Collator(lang, { numeric: true, sensitivity: 'base' });
  return filtered.sort((a, b) => {
    const av = sort.value(a), bv = sort.value(b);
    // Missing values remain last in either direction; sort is stable for equal values.
    if (av == null || av === '') return bv == null || bv === '' ? 0 : 1;
    if (bv == null || bv === '') return -1;
    const comparison = typeof av === 'number' && typeof bv === 'number' ? av - bv : collator.compare(String(av), String(bv));
    return comparison * (state.direction === 'desc' ? -1 : 1);
  });
}

export function facetOptions(items, value, label = value => value, lang = 'fi') {
  return [...new Set(items.flatMap(item => values(value(item))))].filter(Boolean)
    .map(key => ({ key, label: label(key) }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label), lang, { numeric: true }));
}

export function activeFilterCount(state) {
  return Object.values(state.facets).reduce((count, facet) => count + (facet.include?.length || 0) + (facet.exclude?.length || 0), 0)
    + ['query', 'from', 'to', 'min', 'max'].filter(key => state[key] !== '').length;
}

// Keep controls mounted while result lists change, so keyboard focus is retained.
export function mountCollectionTools(parent, key, state, config, lang, onChange) {
  const c = copy[lang] || copy.fi;
  const panel = document.createElement('section');
  panel.className = 'collection-tools';
  panel.dataset.collection = key;
  panel.setAttribute('aria-label', `${config.label || ''}: ${c.tools}`);
  const control = (label, content) => `<label class="filter-control"><span>${e(label)}</span>${content}</label>`;
  const advanced = lang === 'sv' ? 'Inkludera, uteslut och avgränsa' : 'Sisällytä, sulje pois ja rajaa';
  panel.innerHTML = `<div class="collection-order">
    ${config.search ? control(c.search, `<input type="search" data-tool="query" value="${e(state.query)}">`) : ''}
    ${control(c.sort, `<select data-tool="sort">${config.sorts.map(sort => `<option value="${e(sort.key)}" ${state.sort === sort.key ? 'selected' : ''}>${e(sort.label)}</option>`).join('')}</select>`)}
    ${control(c.direction, `<select data-tool="direction"><option value="asc" ${state.direction === 'asc' ? 'selected' : ''}>${c.asc}</option><option value="desc" ${state.direction === 'desc' ? 'selected' : ''}>${c.desc}</option></select>`)}
  </div><details class="collection-advanced" data-advanced ${state.open.__advanced ? 'open' : ''}><summary>${advanced}</summary><div class="collection-order">
    ${config.date ? control(c.from, `<input type="date" data-tool="from" value="${e(state.from)}">`) + control(c.to, `<input type="date" data-tool="to" value="${e(state.to)}">`) : ''}
    ${config.number ? control(`${config.number.label}: ${c.min}`, `<input type="number" step="any" data-tool="min" value="${e(state.min)}">`) + control(`${config.number.label}: ${c.max}`, `<input type="number" step="any" data-tool="max" value="${e(state.max)}">`) : ''}
  </div>
  ${(config.facets || []).length ? `<p class="filter-help" id="${key}-help">${c.help}</p><div class="collection-facets">${config.facets.map(facet => {
    const selection = state.facets[facet.key] || {};
    return `<details data-facet="${e(facet.key)}" ${state.open[facet.key] ? 'open' : ''}><summary>${e(facet.label)} <span data-facet-count>${(selection.include?.length || 0) + (selection.exclude?.length || 0)}</span></summary>
      <label class="facet-search"><span>${c.options}: ${e(facet.label)}</span><input type="search" data-option-search></label>
      <div class="facet-list" role="group" aria-label="${e(facet.label)}" aria-describedby="${key}-help">${facet.options.map(option => `<div class="facet-option" data-option-label="${e(String(option.label).toLocaleLowerCase(lang))}"><strong>${e(option.label)}</strong>${['include', 'exclude'].map(mode => `<label><input type="checkbox" data-selection="${mode}" value="${e(option.key)}" ${(selection[mode] || []).includes(String(option.key)) ? 'checked' : ''}><span>${c[mode]}<span class="sr-only">: ${e(option.label)} (${e(facet.label)})</span></span></label>`).join('')}</div>`).join('')}</div></details>`;
  }).join('')}</div>` : ''}
  </details><div class="collection-actions"><p data-active-count role="status" aria-live="polite"></p><button type="button" data-tool-clear>${c.clear}</button></div>`;
  parent.append(panel);
  const advancedDetails = panel.querySelector('[data-advanced]');
  advancedDetails.addEventListener('toggle', () => { state.open.__advanced = advancedDetails.open; });
  const updateCount = () => {
    panel.querySelector('[data-active-count]').textContent = `${activeFilterCount(state)} ${c.active}`;
    panel.querySelectorAll('[data-facet]').forEach(details => {
      const facet = state.facets[details.dataset.facet] || {};
      details.querySelector('[data-facet-count]').textContent = (facet.include?.length || 0) + (facet.exclude?.length || 0);
    });
  };
  panel.querySelectorAll('[data-tool]').forEach(input => {
    const change = () => { state[input.dataset.tool] = input.value; updateCount(); onChange(); };
    input.addEventListener(input.tagName === 'INPUT' && input.type === 'search' ? 'input' : 'change', change);
  });
  panel.querySelectorAll('[data-facet]').forEach(details => {
    const facet = details.dataset.facet;
    details.addEventListener('toggle', () => { state.open[facet] = details.open; });
    details.querySelector('[data-option-search]').oninput = event => {
      const query = event.target.value.trim().toLocaleLowerCase(lang);
      details.querySelectorAll('[data-option-label]').forEach(row => { row.hidden = !row.dataset.optionLabel.includes(query); });
    };
    details.querySelectorAll('[data-selection]').forEach(checkbox => checkbox.onchange = () => {
      const selection = state.facets[facet] ||= { include: [], exclude: [] };
      const mode = checkbox.dataset.selection, other = mode === 'include' ? 'exclude' : 'include';
      selection[mode] = checkbox.checked ? [...new Set([...(selection[mode] || []), checkbox.value])] : (selection[mode] || []).filter(value => value !== checkbox.value);
      if (checkbox.checked) {
        selection[other] = (selection[other] || []).filter(value => value !== checkbox.value);
        checkbox.closest('.facet-option').querySelector(`[data-selection="${other}"]`).checked = false;
      }
      updateCount(); onChange();
    });
  });
  panel.querySelector('[data-tool-clear]').onclick = () => {
    const sort = state.sort, direction = state.direction, open = state.open;
    Object.assign(state, collectionState(sort, direction), { open });
    panel.querySelectorAll('[data-selection]').forEach(checkbox => { checkbox.checked = false; });
    panel.querySelectorAll('[data-tool]').forEach(input => { input.value = state[input.dataset.tool]; });
    updateCount(); onChange();
  };
  updateCount();
  return panel;
}

export function collapseQuickFilters(root, lang) {
  root.querySelectorAll('.vote-filters,.member-filters,.legislation-controls,.speech-filters,.influence-filters,.election-filters').forEach(toolbar=>{
    if (toolbar.querySelector('.quick-filters')) return;
    const controls=[...toolbar.children].filter(element=>element.tagName==='LABEL'||element.tagName==='SELECT');
    if (!controls.length) return;
    const details=document.createElement('details');details.className='quick-filters';
    const summary=document.createElement('summary');summary.textContent=lang==='sv'?'Välj en snabbavgränsning':'Valitse pikarajaus';details.append(summary);
    const fields=document.createElement('div');fields.className='quick-filter-fields';fields.append(...controls);details.append(fields);toolbar.append(details);
  });
}

// Civic views rebuild their markup. Preserve the focused control and its caret.
export function preserveFocus(root, render) {
  const active = document.activeElement;
  const controls = [...root.querySelectorAll('input, select, button, summary, a')];
  const index = controls.indexOf(active);
  const id = active?.id;
  const signature = active ? [...active.attributes].filter(attribute => attribute.name.startsWith('data-')).map(attribute => [attribute.name, attribute.value]) : [];
  const value = active?.value, position = active?.selectionStart;
  const collection = active?.closest('[data-collection]')?.dataset.collection;
  const quickOpen=[...root.querySelectorAll('.quick-filters')].map(details=>details.open);
  render();
  root.querySelectorAll('.quick-filters').forEach((details,index)=>{details.open=quickOpen[index]||false;});
  const scope = collection ? [...root.querySelectorAll('[data-collection]')].find(panel => panel.dataset.collection === collection) : root;
  const candidates = [...(scope?.querySelectorAll('input, select, button, summary, a') || [])];
  const target = (id && document.getElementById(id)) || (signature.length ? candidates.find(input => signature.every(([name, content]) => input.getAttribute(name) === content) && (input.type !== 'checkbox' || input.value === value)) : null) || (!collection ? candidates[index] : null);
  target?.focus({ preventScroll: true });
  if (position != null && target?.type === 'search') target.setSelectionRange(position, position);
}
