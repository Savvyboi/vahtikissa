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
  const parts = String(hash || '').split('?')[0].replace(/^#\/?/, '').split('/').filter(Boolean);
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

const POLICY_TOPICS = [
  { key: 'social-health', fi: 'Sosiaali- ja terveys', sv: 'Social- och hälsovård', pattern: /sosiaali|terveys|hyvinvointi|eläke|sairau|lääke|lastensuoj|vammais|social|häls|välfärd|pension|sjuk|läkemed|barnskydd|funktionshind/i },
  { key: 'economy', fi: 'Talous ja verotus', sv: 'Ekonomi och beskattning', pattern: /talous|vero|budjet|rahoit|pankki|yrity|kauppa|työmarkkin|julkinen velka|ekonomi|skatt|budget|finans|bank|företag|handel|arbetsmarknad|offentlig skuld/i },
  { key: 'defence', fi: 'Puolustus ja turvallisuus', sv: 'Försvar och säkerhet', pattern: /puolustus|sotilas|asevelvoll|nato|rajaturvall|kriisinhall|försvar|militär|värnplikt|gränssäker|krishanter/i },
  { key: 'environment', fi: 'Ympäristö ja energia', sv: 'Miljö och energi', pattern: /ympär|ilmasto|luonnon|metsä|kaivos|energia|päästö|vesien|jäte|miljö|klimat|natur|skog|gruv|energi|utsläpp|vatten|avfall/i },
  { key: 'education', fi: 'Koulutus ja kulttuuri', sv: 'Utbildning och kultur', pattern: /opetus|koul|yliopisto|ammattikorkea|tutkimus|kulttuur|nuori|liikunta|utbild|skol|universitet|forskning|kultur|ungdom|idrott/i },
  { key: 'justice', fi: 'Oikeus ja perusoikeudet', sv: 'Rättsväsende och grundrättigheter', pattern: /oikeus|rikos|poliisi|vankeus|tuomio|perustus|yhdenver|tietosuoja|rätt|brott|polis|fäng|domstol|grundlag|jämlik|dataskydd/i },
  { key: 'transport', fi: 'Liikenne ja viestintä', sv: 'Kommunikation och trafik', pattern: /liikenne|tie\b|raide|rautatie|ilmailu|merenkul|viestintä|digitaal|tietoverk|trafik|väg\b|järnväg|luftfart|sjöfart|kommunikation|digital|datanät/i },
  { key: 'agriculture', fi: 'Maa- ja metsätalous', sv: 'Jord- och skogsbruk', pattern: /maatalou|metsätalou|kalast|elintarvi|eläinsuoj|maaseu|jordbruk|skogsbruk|fiske|livsmed|djurskydd|landsbygd/i },
  { key: 'foreign-eu', fi: 'Ulkoasiat ja EU', sv: 'Utrikesfrågor och EU', pattern: /ulkoasi|euroopan unioni|\beu[:\s-]|kehitysyhte|kansainväli|utrikes|europeiska union|utvecklingssamarb|internationell/i },
  { key: 'governance', fi: 'Hallinto ja kunnat', sv: 'Förvaltning och kommuner', pattern: /hallinto|kunta|aluehall|vaali|kansalaisuus|maahanmuut|virkamie|förvaltning|kommun|regionförvalt|val\b|medborgarskap|invandring|tjänsteman/i },
  { key: 'other', fi: 'Muu aihe', sv: 'Övrigt ämne', pattern: null }
];

export function policyTopicOptions(lang = 'fi') {
  return POLICY_TOPICS.map(topic => ({ key: topic.key, label: topic[lang] || topic.fi }));
}

export function policyTopicLabel(key, lang = 'fi') {
  const topic = POLICY_TOPICS.find(item => item.key === key) || POLICY_TOPICS.at(-1);
  return topic[lang] || topic.fi;
}

export function policyTopicKeys(item) {
  const text = [item?.title, item?.titleSv, item?.question, item?.questionSv, item?.agenda, item?.agendaSv, item?.document, item?.documentSv]
    .filter(Boolean).join(' ');
  const matches = POLICY_TOPICS.filter(topic => topic.pattern?.test(text)).map(topic => topic.key);
  return matches.length ? matches.slice(0, 3) : ['other'];
}

export function committeeOptions(items, lang = 'fi') {
  const committees = new Map();
  for (const item of items || []) for (const committee of item.committees || []) {
    const id = String(committee.id || committee.code || committee.name || '');
    if (id && !committees.has(id)) committees.set(id, lang === 'sv' ? committee.nameSv || committee.name : committee.name || committee.nameSv);
  }
  return [...committees].sort((a, b) => String(a[1]).localeCompare(String(b[1]), lang));
}

export function hasCommittee(item, committee = 'all') {
  return committee === 'all' || (item?.committees || []).some(value => String(value.id || value.code || value.name) === String(committee));
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

export function isLongSpeech(text, threshold = 180) {
  return String(text || '').length > threshold;
}

export function speechParagraphs(text, targetLength = 480) {
  const normalized = String(text || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return [];
  const paragraphs = [];
  let words = [];
  let length = 0;
  const flush = () => {
    if (!words.length) return;
    paragraphs.push(words.join(' '));
    words = [];
    length = 0;
  };
  normalized.split(' ').forEach(word => {
    words.push(word);
    length += word.length + (words.length > 1 ? 1 : 0);
    const sentenceEnd = /[.!?…]["'”’»)]?$/.test(word);
    if (length >= targetLength && sentenceEnd) flush();
  });
  flush();
  return paragraphs;
}

export function filterSpeechesBySpeaker(speeches, { party = 'all', mpId = 'all', topic = 'all' } = {}) {
  return speeches.filter(speech =>
    (party === 'all' || speech.party === party) &&
    (mpId === 'all' || String(speech.mpId) === String(mpId)) &&
    (topic === 'all' || policyTopicKeys(speech).includes(topic))
  );
}

export function buildSpeechAnalytics(speeches) {
  const buckets = new Map();
  const bucketFor = key => {
    if (!buckets.has(key)) buckets.set(key, { members: new Map(), parties: new Map() });
    return buckets.get(key);
  };
  for (const speech of speeches || []) {
    const words = String(speech.text || '').trim().split(/\s+/u).filter(Boolean).length;
    const topics = ['all', ...policyTopicKeys(speech)];
    for (const topic of topics) {
      const bucket = bucketFor(topic);
      const memberKey = String(speech.mpId || `${speech.firstName}-${speech.lastName}`);
      const member = bucket.members.get(memberKey) || { mpId: memberKey, firstName: speech.firstName || '', lastName: speech.lastName || '', party: speech.party || '', speeches: 0, words: 0 };
      member.speeches += 1; member.words += words; bucket.members.set(memberKey, member);
      const partyKey = String(speech.party || 'other');
      const party = bucket.parties.get(partyKey) || { party: partyKey, speeches: 0, words: 0 };
      party.speeches += 1; party.words += words; bucket.parties.set(partyKey, party);
    }
  }
  const finish = map => [...map.values()].map(item => ({ ...item, averageWords: item.speeches ? Math.round(item.words / item.speeches) : 0 }))
    .sort((a, b) => b.words - a.words || b.speeches - a.speeches);
  return { topics: Object.fromEntries([...buckets].map(([key, bucket]) => [key, { members: finish(bucket.members), parties: finish(bucket.parties) }])) };
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
  return String(value || '').normalize('NFC').toLocaleLowerCase('fi').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
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

export function legislationMatterType(item) {
  return String(item?.document || '').trim().split(/\s+/)[0].toUpperCase() || 'OTHER';
}

export function legislationStatusTone(item) {
  const decision = `${item?.decision || ''} ${item?.decisionSv || ''}`.toLocaleLowerCase('fi');
  if (!decision.trim()) return 'ongoing';
  if (/muutett|ändring/.test(decision)) return 'changed';
  if (/hyväks|godkän/.test(decision)) return 'approved';
  if (/hylät|förkast/.test(decision)) return 'rejected';
  if (/peruut|återtag/.test(decision)) return 'withdrawn';
  if (/rauen|förfall/.test(decision)) return 'expired';
  return 'closed';
}

export function legislationPhase(item) {
  if (legislationStatusTone(item) !== 'ongoing') return 6;
  const stage = [...(item?.stages || []), ...(item?.stagesSv || [])].at(-1)?.toLocaleLowerCase('fi') || '';
  if (/vastauk|kirjelm|response|svar/.test(stage)) return 6;
  if (/toinen|andra behand/.test(stage)) return 5;
  if (/ensimmäinen|första behand/.test(stage)) return 4;
  if (/pöydälle|bordlägg/.test(stage)) return 3;
  if (/valiok|utskott|asiantuntija|expert|sakkunn|mietint|betänk|lausun|utlåt|valmistava|beredande/.test(stage)) return 2;
  if (/lähete|remiss/.test(stage)) return 1;
  return 0;
}

export function filterAndSortLegislation(items, { query = '', status = 'all', type = 'all', topic = 'all', committee = 'all', sort = 'date-desc' } = {}) {
  const q = String(query || '').trim().toLocaleLowerCase('fi');
  const filtered = items.filter(item => {
    const tone = legislationStatusTone(item);
    if (status !== 'all' && status !== `__${tone}__` && legislationStatusKey(item) !== status) return false;
    if (type !== 'all' && legislationMatterType(item) !== type) return false;
    if (topic !== 'all' && !policyTopicKeys(item).includes(topic)) return false;
    if (!hasCommittee(item, committee)) return false;
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

export function filterVotes(votes, { query = '', outcome = 'all', type = 'all', stage = 'all', topic = 'all', committee = 'all' } = {}) {
  const matchesQuery = filterItems(votes, query, localizedSearchFields(['title', 'question', 'document', 'stage']));
  return matchesQuery.filter(vote =>
    (outcome === 'all' || voteOutcome(vote) === outcome) &&
    (type === 'all' || (type === 'amendment' ? Boolean(vote.isAmendment) : !vote.isAmendment)) &&
    (stage === 'all' || vote.stage === stage) &&
    (topic === 'all' || policyTopicKeys(vote).includes(topic)) &&
    hasCommittee(vote, committee)
  );
}

export function filterAndSortMembers(members, { query = '', party = 'all', sort = 'name' } = {}, partyNames = {}) {
  const filtered = members.filter(member =>
    (party === 'all' || member.party === party) && memberMatchesQuery(member, query, partyNames)
  );
  const name = member => `${member.lastName || ''} ${member.firstName || ''}`.trim();
  const score = (member, key) => Number(member.stats?.[key]) || 0;
  return [...filtered].sort((a, b) => {
    if (sort === 'participation-desc') return score(b, 'participation') - score(a, 'participation') || name(a).localeCompare(name(b), 'fi');
    if (sort === 'speeches-desc') return score(b, 'speeches') - score(a, 'speeches') || name(a).localeCompare(name(b), 'fi');
    return name(a).localeCompare(name(b), 'fi');
  });
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

export async function fetchJSONWithTimeout(url, { timeout = 15000, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('Fetch is not available');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out', 'TimeoutError')), timeout);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) {
      const timeoutError = new Error(`Request timed out after ${timeout} ms`);
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}
