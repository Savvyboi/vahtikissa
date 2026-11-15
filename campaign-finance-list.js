import { escapeHTML as e } from './app-utils.js';

export const control = (id, label, markup) => `<label for="${id}">${e(label)}${markup}</label>`;
export const select = (id, options, selected = '') => `<select id="${id}">${options.map(([value, label]) =>
  `<option value="${e(value)}"${String(value) === String(selected) ? ' selected' : ''}>${e(label)}</option>`).join('')}</select>`;
export const input = (id, value = '') => `<input type="search" id="${id}" value="${e(value)}">`;
export const choiceList = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fi')).map(value => [value, value]);

export function mountFinanceList(host, ui, {
  id, title, view, columns, filters, rows, card, resultLabel, defaultSort = columns[0].key,
  note = '', emptyText = ui.noRows, onFilter
}) {
  const { L, number } = ui;
  const initialLayout = view === 'simple' ? 'cards' : 'list';
  const titleId = id + '-results-title';
  const orderId = id + '-order';
  const directionId = id + '-direction';
  const orderLabel = L('Järjestä sarakkeen mukaan', 'Sortera efter', 'Sort by');
  const directionLabel = L('Järjestys', 'Ordning', 'Order');
  const directions = [['desc', L('Laskeva', 'Fallande', 'Descending')], ['asc', L('Nouseva', 'Stigande', 'Ascending')]];
  const defaultDirection = key => columns.find(column => column.key === key)?.direction || 'asc';
  host.innerHTML = `<div class="finance-results-heading">
    <h2 id="${titleId}">${e(title)}</h2>
    <div class="finance-layout" role="group" aria-label="${L('Tulosten näkymä', 'Visning av resultat', 'Results layout')}">
      ${[['list', L('Lista', 'Lista', 'List')], ['cards', L('Kortit', 'Kort', 'Cards')]].map(([value, label]) =>
        `<button type="button" data-finance-layout="${value}" aria-pressed="${value === initialLayout}">${label}</button>`).join('')}
    </div>
  </div>
  <div class="finance-controls">
    ${filters}
    ${control(orderId, orderLabel, select(orderId, columns.map(({ key, label }) => [key, label]), defaultSort))}
    ${control(directionId, directionLabel, select(directionId, directions, defaultDirection(defaultSort)))}
  </div>
  ${note ? `<p class="finance-meta">${e(note)}</p>` : ''}
  <p class="finance-meta" data-finance-count role="status"></p>
  <p data-finance-empty hidden>${e(emptyText)}</p>
  <div class="finance-table" data-finance-table role="region" aria-labelledby="${titleId}" tabindex="0" hidden>
    <table aria-labelledby="${titleId}"><thead><tr>${columns.map(({ key, label }) =>
      `<th scope="col"><button type="button" data-finance-sort="${key}">${e(label)}</button></th>`).join('')}</tr></thead><tbody></tbody></table>
  </div>
  <div data-finance-cards hidden><div class="finance-list" data-finance-rows></div>
    <button type="button" class="finance-more" data-finance-more hidden>${ui.showMore}</button>
  </div>`;

  const order = host.querySelector('#' + orderId);
  const direction = host.querySelector('#' + directionId);
  const fields = [...host.querySelectorAll('.finance-controls input,.finance-controls select')].filter(field => field !== order && field !== direction);
  const table = host.querySelector('[data-finance-table]');
  const tbody = table.querySelector('tbody');
  const cards = host.querySelector('[data-finance-cards]');
  const cardList = cards.querySelector('[data-finance-rows]');
  const more = cards.querySelector('[data-finance-more]');
  const status = host.querySelector('[data-finance-count]');
  const empty = host.querySelector('[data-finance-empty]');
  const sortButtons = [...table.querySelectorAll('[data-finance-sort]')];
  const layouts = [...host.querySelectorAll('[data-finance-layout]')];
  const pageSize = 18;
  let limit = pageSize;
  let layout = initialLayout;

  function draw() {
    const values = Object.fromEntries(fields.map(field => [field.id, field.value]));
    const shown = rows(values);
    onFilter?.(shown);
    status.textContent = `${number(shown.length)} ${resultLabel}`;
    empty.hidden = shown.length > 0;
    const key = order.value;
    const ascending = direction.value === 'asc';
    const ordered = shown.toSorted((a, b) => {
      const first = a[key], second = b[key];
      if (first == null || second == null) return Number(first == null) - Number(second == null);
      const comparison = typeof first === 'number' ? first - second : String(first).localeCompare(String(second), 'fi');
      return ascending ? comparison : -comparison;
    });
    table.hidden = layout !== 'list' || !ordered.length;
    cards.hidden = layout !== 'cards' || !ordered.length;
    if (layout === 'list') {
      for (const button of sortButtons) {
        if (button.dataset.financeSort === key) button.parentElement.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
        else button.parentElement.removeAttribute('aria-sort');
      }
      tbody.innerHTML = ordered.map(row => `<tr>${columns.map((column, index) => {
        const content = column.render ? column.render(row) : e(row[column.key] ?? '—');
        return index === 0 ? `<th scope="row">${content}</th>` : `<td>${content}</td>`;
      }).join('')}</tr>`).join('');
    } else {
      cardList.innerHTML = ordered.slice(0, limit).map(card).join('');
      more.hidden = ordered.length <= limit;
    }
  }

  const redraw = () => { limit = pageSize; draw(); };
  for (const field of [...fields, direction]) {
    field.addEventListener(field.type === 'search' ? 'input' : 'change', redraw);
  }
  order.onchange = () => {
    direction.value = defaultDirection(order.value);
    redraw();
  };
  for (const button of sortButtons) {
    button.onclick = () => {
      const key = button.dataset.financeSort;
      direction.value = order.value === key ? (direction.value === 'asc' ? 'desc' : 'asc') : defaultDirection(key);
      order.value = key;
      redraw();
    };
  }
  for (const button of layouts) {
    button.onclick = () => {
      if (layout === button.dataset.financeLayout) return;
      layout = button.dataset.financeLayout;
      for (const option of layouts) option.setAttribute('aria-pressed', String(option === button));
      redraw();
    };
  }
  more.onclick = () => {
    const previous = limit;
    limit += pageSize;
    draw();
    const first = cardList.children[previous];
    first?.setAttribute('tabindex', '-1');
    first?.focus();
  };
  draw();
}
