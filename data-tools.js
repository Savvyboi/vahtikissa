function flatValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(flatValue).join('; ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function csvCell(value) {
  const text = flatValue(value);
  return /["\r\n,;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeCSV(rows, columns = null) {
  const source = Array.isArray(rows) ? rows : [];
  const keys = columns?.length ? columns : [...new Set(source.flatMap(row => Object.keys(row || {})))];
  return [keys.map(csvCell).join(','), ...source.map(row => keys.map(key => csvCell(row?.[key])).join(','))].join('\r\n');
}

export function serializeJSON(rows) {
  return JSON.stringify(Array.isArray(rows) ? rows : [], null, 2);
}

export function safeFilename(value) {
  return String(value || 'vahtikissa-data')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fi')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'vahtikissa-data';
}

export function downloadRows(rows, filename, format = 'csv') {
  const json = format === 'json';
  const body = json ? serializeJSON(rows) : `\uFEFF${serializeCSV(rows)}`;
  const blob = new Blob([body], { type: json ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFilename(filename)}.${json ? 'json' : 'csv'}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportButtons(key, lang = 'fi') {
  const label = lang === 'sv' ? 'Ladda ner data' : 'Lataa data';
  return `<div class="export-tools" aria-label="${label}"><span>${label}</span><button type="button" data-export-key="${key}" data-export-format="csv">.csv</button><button type="button" data-export-key="${key}" data-export-format="json">.json</button></div>`;
}

export function bindExportButtons(container, key, getRows, filename) {
  container.querySelectorAll(`[data-export-key="${key}"]`).forEach(button => {
    button.onclick = () => downloadRows(getRows(), typeof filename === 'function' ? filename() : filename, button.dataset.exportFormat);
  });
}
