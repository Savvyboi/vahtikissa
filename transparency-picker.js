import { escapeHTML as e } from './app-utils.js';

const limit = 10;
const normalize = (value, lang) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase(lang).trim();

export function transparencyPickerMarkup({ type, label, placeholder, clearLabel }) {
  const id = `sna-picker-${e(type)}`;
  return `<div class="sna-actor-picker" data-sna-picker="${e(type)}">
    <label id="${id}-label" for="${id}">${e(label)}</label>
    <div class="sna-actor-field">
      <input id="${id}" data-sna-picker-input type="text" role="combobox" aria-autocomplete="list"
        aria-expanded="false" aria-controls="${id}-list" aria-describedby="${id}-context" placeholder="${e(placeholder)}"
        autocomplete="off" autocapitalize="none" spellcheck="false">
      <button type="button" data-sna-picker-clear aria-label="${e(clearLabel)}" title="${e(clearLabel)}" hidden>×</button>
    </div>
    <div class="sna-actor-popup" hidden>
      <ul id="${id}-list" role="listbox" aria-labelledby="${id}-label" tabindex="-1"></ul>
      <p class="sna-actor-notice" aria-hidden="true" hidden></p>
    </div>
    <span class="sr-only" id="${id}-context" data-sna-picker-context></span>
    <span class="sr-only" role="status"></span>
  </div>`;
}

export function mountTransparencyPicker(host, { actors, selected, describe, onChange, tr, lang }) {
  const input = host.querySelector('[data-sna-picker-input]');
  const clear = host.querySelector('[data-sna-picker-clear]');
  const popup = host.querySelector('.sna-actor-popup');
  const list = popup.querySelector('[role="listbox"]');
  const notice = popup.querySelector('.sna-actor-notice');
  const context = host.querySelector('[data-sna-picker-context]');
  const status = host.querySelector('[role="status"]');
  const collator = new Intl.Collator(lang);
  const entries = actors.map(actor => {
    const context = describe(actor) || '';
    const names = [actor.name, ...(actor.aliases || [])].map(name => normalize(name, lang));
    const key = [...names, normalize(context, lang)].join(' ');
    return { id: actor.id, name: actor.name, context, key, names };
  }).sort((a, b) => collator.compare(a.name, b.name) || collator.compare(a.context, b.context) || a.id.localeCompare(b.id));
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  let selection, matches = [], active = -1;

  function close() {
    popup.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    status.textContent = '';
    active = -1;
  }

  function set(id) {
    selection = byId.get(id) || null;
    input.value = selection?.name || '';
    context.textContent = selection?.context || '';
    input.title = selection ? [selection.name, selection.context].filter(Boolean).join(' · ') : '';
    clear.hidden = !selection;
    host.classList.toggle('sna-actor-selected', Boolean(selection));
    close();
  }

  function commit(id) {
    const previous = selection?.id ?? null;
    set(id);
    input.focus({ preventScroll: true });
    input.select();
    if (previous !== (selection?.id ?? null)) onChange(selection?.id ?? null);
  }

  function show(value) {
    const query = normalize(value, lang);
    const words = query.split(/\s+/u);
    const found = query ? entries.filter(entry => words.every(word => entry.key.includes(word))) : entries;
    if (query) {
      const rank = entry => entry.names.includes(query) ? 0 : entry.names.some(name => name.startsWith(query)) ? 1 : 2;
      found.sort((a, b) => rank(a) - rank(b));
    }
    matches = found.slice(0, limit);
    if (!query && selection && !matches.includes(selection)) matches = [selection, ...matches.slice(0, -1)];
    active = -1;
    input.removeAttribute('aria-activedescendant');
    list.innerHTML = matches.map(({ name, context }, index) => `<li id="${e(list.id)}-${index}" role="option" aria-selected="false" data-index="${index}"><strong>${e(name)}</strong>${context ? `<small>${e(context)}</small>` : ''}</li>`).join('');
    const message = !matches.length
      ? tr('Nimellä tai tunnisteella ei löytynyt osumia.', 'Inga träffar på namn eller ID.', 'No names or IDs match.')
      : found.length > limit
        ? tr(`Näytetään ${limit} osumaa. Tarkenna hakua.`, `Visar ${limit} träffar. Förfina sökningen.`, `Showing ${limit} matches. Refine your search.`)
        : '';
    notice.textContent = message;
    notice.hidden = !message;
    list.hidden = !matches.length;
    popup.hidden = false;
    list.scrollTop = 0;
    input.setAttribute('aria-expanded', String(Boolean(matches.length)));
    status.textContent = message || tr(`Osumia ${matches.length}.`, `Träffar: ${matches.length}.`, `${matches.length} matches.`);
  }

  function highlight(index) {
    const option = list.children[index];
    if (!option) return;
    list.children[active]?.setAttribute('aria-selected', 'false');
    active = index;
    option.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', option.id);
    const bounds = list.getBoundingClientRect(), item = option.getBoundingClientRect();
    if (item.top < bounds.top) list.scrollTop += item.top - bounds.top;
    if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom;
  }

  input.addEventListener('focus', () => input.select());
  input.addEventListener('click', () => {
    if (!popup.hidden) return;
    input.select();
    show('');
  });
  input.addEventListener('input', () => show(input.value));
  input.addEventListener('blur', () => set(selection?.id));
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (popup.hidden) show('');
      const next = event.key === 'ArrowDown'
        ? Math.min(active + 1, matches.length - 1)
        : Math.max((active < 0 ? matches.length : active) - 1, 0);
      highlight(next);
    } else if (event.key === 'Enter' && !popup.hidden) {
      event.preventDefault();
      if (active >= 0) commit(matches[active].id);
      else if (matches.length === 1) commit(matches[0].id);
    } else if (event.key === 'Escape' && !popup.hidden) {
      event.preventDefault();
      event.stopPropagation();
      set(selection?.id);
      input.select();
    }
  });
  // Keep focus on the combobox while a pointer chooses an option. Allow touch scrolling.
  list.addEventListener('mousedown', event => event.preventDefault());
  list.addEventListener('click', event => {
    const option = event.target.closest('[role="option"]');
    if (option) commit(matches[Number(option.dataset.index)].id);
  });
  clear.addEventListener('click', () => commit(null));
  set(selected);
  return { set };
}
