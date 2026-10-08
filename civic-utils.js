export function parseCSVLine(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < String(line).length; index++) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index++;
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else value += character;
  }
  values.push(value);
  return values;
}

export function numberValue(value) {
  const normalized = String(value ?? '').replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseGiftDisclosure(text = '') {
  const value = String(text);
  const captured = pattern => value.match(pattern)?.[1]?.trim() || '';
  const amountText = captured(/(?:,|^)\s*([\d\s]+,\d{2})\s*euroa/i);
  return {
    reported: captured(/Ilmoitettu:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i),
    donor: captured(/Antaja:\s*(.*?)\.\s*Kuvaus:/i),
    description: captured(/Kuvaus:\s*(.*?)(?:,\s*[\d\s]+,\d{2}\s*euroa|\.\s*Käyttöaika:)/i),
    amount: amountText ? numberValue(amountText) : null,
    used: captured(/Käyttöaika:\s*(.*?)(?:\.\s*Luovutettu|\.\s*$)/i),
    raw: value.trim()
  };
}

export function jsonStatRows(dataset) {
  const ids = dataset?.id || [];
  const sizes = dataset?.size || [];
  if (!ids.length || ids.length !== sizes.length) throw new TypeError('Invalid JSON-stat2 dataset');
  const codes = ids.map(id => {
    const category = dataset.dimension?.[id]?.category || {};
    if (Array.isArray(category.index)) return category.index;
    return Object.entries(category.index || {}).sort((a, b) => a[1] - b[1]).map(([code]) => code);
  });
  const rows = [];
  const total = sizes.reduce((product, size) => product * size, 1);
  for (let flatIndex = 0; flatIndex < total; flatIndex++) {
    let remainder = flatIndex;
    const row = {};
    for (let dimension = sizes.length - 1; dimension >= 0; dimension--) {
      const position = remainder % sizes[dimension];
      remainder = Math.floor(remainder / sizes[dimension]);
      const id = ids[dimension];
      const code = codes[dimension][position];
      row[id] = code;
      row[`${id}Label`] = dataset.dimension?.[id]?.category?.label?.[code] || code;
    }
    row.value = Array.isArray(dataset.value) ? dataset.value[flatIndex] : dataset.value?.[flatIndex] ?? null;
    rows.push(row);
  }
  return rows;
}

export function filterBudgetItems(items, query = '') {
  const normalized = String(query).trim().toLocaleLowerCase('fi');
  if (!normalized) return items;
  return items.filter(item => [item.code, item.name?.fi, item.name?.sv]
    .some(value => String(value || '').toLocaleLowerCase('fi').includes(normalized)));
}

export function filterElectionCandidates(candidates, { query = '', party = 'all', district = 'all' } = {}) {
  const normalized = String(query).trim().toLocaleLowerCase('fi');
  return candidates.filter(candidate =>
    (party === 'all' || candidate.partyCode === party) &&
    (district === 'all' || candidate.districtCode === district) &&
    (!normalized || [candidate.name, candidate.party?.fi, candidate.party?.sv, candidate.district?.fi, candidate.district?.sv]
      .some(value => String(value || '').toLocaleLowerCase('fi').includes(normalized)))
  );
}

export function filterInfluence(items, {
  query = '', year = 'all', kind = 'all', mp = 'all', party = 'all', actor = 'all',
  method = 'all', category = 'all', excludedCategories = []
} = {}) {
  const normalized = String(query).trim().toLocaleLowerCase('fi');
  const excluded = new Set(excludedCategories || []);
  return items.filter(item =>
    (year === 'all' || String(item.year || item.periodYear) === String(year)) &&
    (kind === 'all' || item.targetKind === kind || item.targetKinds?.includes(kind)) &&
    (mp === 'all' || item.mpName === mp || item.mpNames?.includes(mp)) &&
    (party === 'all' || item.party === party || item.targetParties?.includes(party)) &&
    (actor === 'all' || item.actor === actor) &&
    (method === 'all' || item.methods?.includes(method)) &&
    (category === 'all' || item.industry === category) &&
    (!item.industry || !excluded.has(item.industry)) &&
    (!normalized || [item.mpName, item.donor, item.description, item.descriptionSv, item.category, item.categorySv, item.type, item.actor, item.topic,
      item.customer, item.industry, item.otherMethod, ...(item.methods || []), ...(item.mpNames || []),
      item.target?.fi?.name, item.target?.sv?.name, item.target?.fi?.department, item.target?.sv?.department,
      ...(item.targets || []).flatMap(target => [target.fi?.name, target.sv?.name, target.fi?.department, target.sv?.department])]
      .some(value => String(value || '').toLocaleLowerCase('fi').includes(normalized)))
  );
}
