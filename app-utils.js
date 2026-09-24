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

export function hydrateBallots(ballots, members) {
  const membersById = new Map(members.map(member => [String(member.id), member]));
  return ballots.map(ballot => {
    const record = Array.isArray(ballot)
      ? { voteId: ballot[0], mpId: ballot[1], party: ballot[2], choice: ballot[3] }
      : { ...ballot };
    const member = membersById.get(String(record.mpId));
    return member
      ? { ...record, firstName: member.firstName || '', lastName: member.lastName || '' }
      : { ...record, firstName: record.firstName || '', lastName: record.lastName || '', id: record.id || record.mpId };
  });
}

export function pageSlice(items, page = 1, pageSize = 25) {
  const safePage = Math.max(1, Number(page) || 1);
  return items.slice((safePage - 1) * pageSize, safePage * pageSize);
}

export function localized(value, lang = 'fi') {
  if (!value || typeof value !== 'object') return value || '';
  return value[lang] || value.fi || value.sv || '';
}

export function localizedSearchFields(fields) {
  return fields.flatMap(field => [field, `${field}Sv`]);
}

export function memberMatchesQuery(member, query, partyNames = {}) {
  const q = String(query || '').trim().toLocaleLowerCase('fi');
  if (!q) return true;
  const party = partyNames[member.party] || {};
  return [member.firstName, member.lastName, member.party, party.fi, party.sv]
    .some(value => String(value || '').toLocaleLowerCase('fi').includes(q));
}

export function parliamentMatterUrl(document) {
  return document ? `https://www.eduskunta.fi/asiat-ja-aanestykset/valtiopaivaasiat/${encodeURIComponent(document)}` : '';
}

export function isLongSpeech(text, threshold = 600) {
  return String(text || '').length > threshold;
}

export function paginationItems(currentPage, totalPages) {
  const total = Math.max(1, Number(totalPages) || 1);
  const current = Math.min(total, Math.max(1, Number(currentPage) || 1));
  const pages = new Set([1, total]);
  if (current <= 3) [1, 2, 3].forEach(page => page <= total && pages.add(page));
  else if (current >= total - 2) [total - 2, total - 1, total].forEach(page => page > 0 && pages.add(page));
  else [current - 1, current, current + 1].forEach(page => pages.add(page));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((page, index) => index && page - sorted[index - 1] > 1 ? ['ellipsis', page] : [page]);
}

export function normalizeSpeechSearchText(value) {
  return String(value || '').toLocaleLowerCase('fi').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

export function decodeSpeechSearchIndex(index) {
  if (!Array.isArray(index) || index.length !== 2 || !Array.isArray(index[0]) || !Array.isArray(index[1])) throw new TypeError('Invalid speech search index');
  const [words, speeches] = index;
  if (words.some(word => typeof word !== 'string') || speeches.some(tokens => !Array.isArray(tokens) || tokens.some(token => !Number.isInteger(token) || token < 0 || token >= words.length))) throw new TypeError('Invalid speech search index');
  return speeches.map(tokens => tokens.map(token => words[token]).join(' '));
}

export function searchSpeeches(speeches, query, texts = {}) {
  const q = normalizeSpeechSearchText(query);
  if (!q) return speeches;
  return speeches.filter((speech, index) => [
    speech.firstName, speech.lastName, speech.party, speech.agenda, speech.agendaSv,
    speech.type, Array.isArray(texts) ? texts[index] : texts[speech.id], speech.text
  ].some(value => normalizeSpeechSearchText(value).includes(q)));
}

export function legislationStatusKey(item) {
  return String(item?.decision || '').trim() || '__pending__';
}

export function filterAndSortLegislation(items, { query = '', status = 'all', sort = 'date-desc' } = {}) {
  const q = String(query || '').trim().toLocaleLowerCase('fi');
  const filtered = items.filter(item => {
    if (status !== 'all' && legislationStatusKey(item) !== status) return false;
    if (!q) return true;
    return [
      item.document, item.documentSv, item.title, item.titleSv, item.decision, item.decisionSv,
      ...(item.stages || []), ...(item.stagesSv || [])
    ].some(value => String(value || '').toLocaleLowerCase('fi').includes(q));
  });
  const date = item => String(item.latestDate || item.firstDate || '');
  const votes = item => Array.isArray(item.voteIds) ? item.voteIds.length : 0;
  const direction = sort.endsWith('-asc') ? 1 : -1;
  const byVotes = sort.startsWith('votes-');
  return [...filtered].sort((a, b) => {
    const primary = byVotes ? votes(a) - votes(b) : date(a).localeCompare(date(b));
    if (primary) return primary * direction;
    const recentFirst = date(b).localeCompare(date(a));
    return recentFirst || String(a.document || '').localeCompare(String(b.document || ''), 'fi');
  });
}

export function voteAlternatives(question, lang = 'fi') {
  const yesWord = lang === 'sv' ? 'JA' : 'JAA';
  const noWord = lang === 'sv' ? 'NEJ' : 'EI';
  const pattern = new RegExp(`(?:^|:)\\s*(.*?)\\s+${yesWord}\\s*\\/\\s*(.*?)\\s+${noWord}(?:\\s|$)`, 'i');
  const match = String(question || '').match(pattern);
  if (!match) return { yes: '', no: '' };
  return { yes: match[1].split(':').at(-1).trim(), no: match[2].trim() };
}

export function brandName(lang = 'fi') {
  return lang === 'sv' ? 'Vaktkatt' : 'Vahtikissa';
}

export function filterBallots(ballots, choice = 'all') {
  return choice === 'all' ? ballots : ballots.filter(ballot => ballot.choice === choice);
}

export function voteOutcome(vote) {
  const yes = Number(vote?.yes) || 0;
  const no = Number(vote?.no) || 0;
  return yes === no ? 'tie' : yes > no ? 'moreYes' : 'moreNo';
}

export function choiceLabel(choice, lang = 'fi') {
  const labels = {
    fi: { yes: 'jaa', no: 'ei', abstain: 'tyhjää', absent: 'poissa', other: 'muu' },
    sv: { yes: 'ja', no: 'nej', abstain: 'blankt', absent: 'frånvarande', other: 'övrigt' }
  };
  return labels[lang]?.[choice] || labels.fi[choice] || String(choice || '');
}

export function formatDate(value, locale = 'fi-FI') {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}
