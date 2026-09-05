export function filterItems(items, query, fields = null) {
  const q = String(query || '').trim().toLocaleLowerCase('fi');
  if (!q) return items;
  return items.filter(item => {
    const values = fields ? fields.map(key => item[key]) : Object.values(item);
    return values.some(value => typeof value === 'string' && value.toLocaleLowerCase('fi').includes(q));
  });
}

export function percent(part, total) {
  return total ? Math.round((Number(part) / Number(total)) * 100) : 0;
}

export function routeFromHash(hash) {
  const parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
  return { page: parts[0] || 'overview', id: parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : null };
}

export function formatDate(value, locale = 'fi-FI') {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}
