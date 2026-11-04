import { normalizeSpeechSearchText, policyTopicKeys, filterSpeechesBySpeaker } from './app-utils.js';
import { matchRanges, filterResearchSpeeches, STOPWORDS, STOPWORD_VERSION } from './speech-research.js';
import { detailedAgendaTopics } from './speech-topics.js';

export const SPEECH_NETWORK_METHOD = 'speech-network-1';
export const REFERENCE_REVIEW_POLICY = Object.freeze({ version: 'explicit-reference-1', precisionTarget: 0.95, confidenceLevel: 0.95, minimumLabels: 100, independentHumanReviewRequired: true });
export const DEFAULT_NETWORK_QUERIES = ['ilmasto', 'talous', 'koulutus', 'turvallisuus'];
const KEYWORD_PRESET_GROUPS = {
  economy: ['talous', 'verotus', 'velka', 'inflaatio', 'palkka', 'työttömyys', 'budjetti', 'arbetslöshet'],
  environment: ['ilmasto', 'päästöt', 'luontokato', 'energia', 'ydinvoima', 'tuulivoima', 'klimat'],
  education: ['koulutus', 'varhaiskasvatus', 'opiskelija', 'tutkimus', 'utbildning'],
  'social-health': ['terveydenhuolto', 'mielenterveys', 'hoitojono', 'eläke', 'asumistuki', 'sjukvård'],
  defence: ['turvallisuus', 'puolustus', 'nato', 'ukraina', 'säkerhet'],
  justice: ['maahanmuutto', 'turvapaikka', 'poliisi', 'yhdenvertaisuus'],
  transport: ['joukkoliikenne', 'raideliikenne', 'liikenneturvallisuus']
};
const KEYWORD_PRESETS = Object.entries(KEYWORD_PRESET_GROUPS).flatMap(([topic, expressions]) =>
  expressions.map(query => ({ query, topic })));
// Keep the initial example familiar and let the interface group the remaining terms by topic.
KEYWORD_PRESETS.sort((a, b) => Number(b.query === 'ilmasto') - Number(a.query === 'ilmasto'));
const textFor = (speech, texts) => String(texts[speech.id] ?? speech.text ?? '');
const wordCount = text => normalizeSpeechSearchText(text).split(' ').filter(Boolean).length;
const unique = values => [...new Set(values.filter(value => value !== undefined && value !== null && value !== ''))];
const isoDay = date => String(date || '').slice(0, 10);
const numericDate = date => Date.parse(date);
const validDate = date => Number.isFinite(numericDate(date));
const monthShift = (month, offset) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + offset, 1)).toISOString().slice(0, 7);
const lastDay = month => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);

function scopeCorpus(speeches, texts, settings = {}) {
  const selected = filterSpeechesBySpeaker(speeches, settings).filter(speech => validDate(speech.date) &&
    (!settings.dateFrom || isoDay(speech.date) >= settings.dateFrom) && (!settings.dateTo || isoDay(speech.date) <= settings.dateTo));
  return filterResearchSpeeches(selected, texts, { ...settings, query: '' });
}
function evidence(speech, text, query = '', mode = 'contains') {
  const normalized = normalizeSpeechSearchText(text), match = matchRanges(normalized, query, mode)[0];
  return { id: speech.id, mpId: speech.mpId || null, party: speech.party || null, date: speech.date,
    textChunk: speech.textChunk ?? null, matterIds: unique((speech.documents || []).map(document => document.label)),
    href: `#/speeches/${encodeURIComponent(speech.id)}`, excerpt: query && match ? normalized.slice(Math.max(0, match.start - 90), match.end + 150) : text.slice(0, 240) };
}
function coverageOf(speeches, texts) {
  const dated = speeches.filter(speech => validDate(speech.date)), dates = dated.map(speech => isoDay(speech.date)).sort();
  return { start: dates[0] || null, end: dates.at(-1) || null, speeches: speeches.length, missingDates: speeches.length - dated.length,
    missingTexts: speeches.filter(speech => !textFor(speech, texts).trim()).length,
    nonMpSpeeches: speeches.filter(speech => !speech.mpId).length, words: speeches.reduce((sum, speech) => sum + wordCount(textFor(speech, texts)), 0) };
}

/** The denominator is the selected corpus after exclusion and before the positive query.
 * Metadata-only hits remain discoverable but add no transcript mentions or prevalence. */
export function compareKeywords(speeches, texts = {}, settings = {}) {
  const groups = settings.groups || [{ id: 'all', label: 'All' }];
  return comparePreparedKeywords(prepareKeywordCorpus(speeches, texts, settings, groups), settings);
}

function prepareKeywordCorpus(speeches, texts, settings, groups) {
  const corpus = scopeCorpus(speeches, texts, settings), coverage = coverageOf(corpus, texts);
  const prepared = new Map(corpus.map(speech => {
    const text = textFor(speech, texts);
    const normalized = normalizeSpeechSearchText(text);
    return [speech, { text, normalized, words: normalized ? normalized.split(' ').length : 0 }];
  }));
  const selected = groups.map(group => ({ group, speeches: filterSpeechesBySpeaker(corpus, group) }));
  return { texts, coverage, prepared, selected, groups };
}

function countContaining(text, query) {
  if (!query) return 0;
  let count = 0;
  for (let index = text.indexOf(query); index !== -1; index = text.indexOf(query, index + query.length)) count++;
  return count;
}

function comparePreparedKeywords({ texts, coverage, prepared, selected, groups }, settings) {
  const { query = '', mode = 'contains', scope = 'text' } = settings;
  const normalizedQuery = normalizeSpeechSearchText(query);
  const start = settings.dateFrom || coverage.start, end = settings.dateTo || coverage.end;
  const archiveEnd = settings.coverageEnd || coverage.end, archiveStart = settings.coverageStart || coverage.start;
  const monthKeys = [];
  if (start && end) for (let month = start.slice(0, 7); month <= end.slice(0, 7); month = monthShift(month, 1)) monthKeys.push(month);
  const series = selected.map(({ group, speeches }) => {
    const buckets = new Map(monthKeys.map(month => [month, { month, speeches: 0, words: 0, occurrences: 0, matchingSpeeches: 0, metadataOnlyMatches: 0, speakerIds: new Set(), partyIds: new Set(), speechIds: [], evidence: [] }]));
    for (const speech of speeches) {
      const month = String(speech.date).slice(0, 7), row = buckets.get(month);
      if (!row) continue;
      const { text, normalized, words } = prepared.get(speech);
      const count = mode === 'contains' ? countContaining(normalized, normalizedQuery) : matchRanges(text, query, mode).length;
      row.speeches++; row.words += words; row.occurrences += count;
      if (count) {
        row.matchingSpeeches++; row.speakerIds.add(speech.mpId || `external:${speech.firstName}:${speech.lastName}`);
        if (speech.party) row.partyIds.add(speech.party);
        row.speechIds.push(speech.id);
        if (row.evidence.length < 5) row.evidence.push(evidence(speech, text, query, mode));
      } else if (scope === 'all' && filterResearchSpeeches([speech], texts, { query, mode, scope }).length) row.metadataOnlyMatches++;
    }
    return { id: group.id || group.mpId || group.party || 'all', label: group.label || group.id || group.mpId || group.party || 'All', settings: group,
      points: [...buckets.values()].map(({ speakerIds, partyIds, ...row }) => ({ ...row, distinctSpeakers: speakerIds.size, partyBreadth: partyIds.size,
        per10000Words: row.words ? row.occurrences / row.words * 10000 : null,
        speechPrevalence: row.speeches ? row.matchingSpeeches / row.speeches : null,
        coverageGap: row.speeches === 0,
        partialMonth: !!((start && start > row.month + '-01' && start.slice(0, 7) === row.month) || (end && end < lastDay(row.month) && end.slice(0, 7) === row.month) || (archiveStart && archiveStart > row.month + '-01' && archiveStart.slice(0, 7) === row.month) || (archiveEnd && archiveEnd < lastDay(row.month) && archiveEnd.slice(0, 7) === row.month)) })) };
  });
  return { query, mode, scope, settings: { ...settings, groups }, coverage, series, points: series.length === 1 ? series[0].points : [],
    method: { version: SPEECH_NETWORK_METHOD, denominator: 'selected-transcripts-after-exclusion-before-positive-query', normalization: 'existing-speech-research', missingRate: null, speakerIdentity: 'recorded-mp-id-or-separate-external-name', metadataOnlyCountsAsTranscriptMatch: false } };
}

export function phraseUptake(speeches, texts = {}, settings = {}) {
  const query = settings.query || settings.phrase || '', mode = settings.mode || 'phrase';
  const corpus = scopeCorpus(speeches, texts, settings), archive = coverageOf(speeches, texts);
  const uses = query.trim() ? corpus.map(speech => {
    const text = textFor(speech, texts), occurrences = matchRanges(text, query, mode).length;
    return occurrences ? { ...evidence(speech, text, query, mode), occurrences, observedAt: new Date(numericDate(speech.date)).toISOString(),
      quotationMarkerPresent: /["“”«»]|\blainat|\bsiter|\bciter/iu.test(text) } : null;
  }).filter(Boolean).sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id)) : [];
  const first = uses[0]?.observedAt || null;
  return { query, mode, settings, corpusStart: settings.coverageStart || archive.start, corpusEnd: settings.coverageEnd || archive.end,
    firstObservedAt: first, firstUses: uses.filter(use => use.observedAt === first), uses, distinctSpeakers: unique(uses.map(use => use.mpId)).length,
    partyBreadth: unique(uses.map(use => use.party)).length, distinctDates: unique(uses.map(use => use.observedAt.slice(0, 10))).length,
    distinctMatters: unique(uses.flatMap(use => use.matterIds)).length,
    method: { version: SPEECH_NETWORK_METHOD, label: 'first observed in our corpus', normalization: 'existing-case-punctuation-whitespace-normalization', transmissionEdges: false, authorshipClaim: false, quotationMarkers: 'descriptive-only-not-inferred-authorship' } };
}

export function buildTopicProfiles(speeches, texts = {}, settings = {}) {
  const corpus = scopeCorpus(speeches, texts, settings), members = new Map();
  const topicTotals = new Map(), detailedTotals = new Map();
  function addTopic(buckets, totals, topic, speech, text, words) {
    totals.set(topic, (totals.get(topic) || 0) + 1);
    const row = buckets.get(topic) || { topic, speeches: 0, words: 0, speechIds: [], evidence: [] };
    row.speeches++;
    row.words += words;
    row.speechIds.push(speech.id);
    if (row.evidence.length < 5) row.evidence.push(evidence(speech, text));
    buckets.set(topic, row);
  }
  for (const speech of corpus) {
    if (!speech.mpId) continue;
    const id = String(speech.mpId), text = textFor(speech, texts), words = wordCount(text);
    const member = members.get(id) || {
      mpId: id, speeches: 0, words: 0, unclassifiedSpeeches: 0,
      topicBuckets: new Map(), detailedBuckets: new Map(), agendaBuckets: new Map(), matterBuckets: new Map(), dates: []
    };
    member.speeches++; member.words += words; member.dates.push(isoDay(speech.date));
    const broadTopics = policyTopicKeys(speech);
    for (const topic of broadTopics) addTopic(member.topicBuckets, topicTotals, topic, speech, text, words);
    const detailedTopics = detailedAgendaTopics(speech);
    const assigned = detailedTopics.length ? detailedTopics : broadTopics.filter(topic => topic !== 'other');
    for (const topic of assigned) addTopic(member.detailedBuckets, detailedTotals, topic, speech, text, words);
    if (!assigned.length) member.unclassifiedSpeeches++;

    const title = String(speech.agenda || speech.agendaSv || '').trim().replace(/\s+/gu, ' ');
    if (title) {
      const key = title.toLocaleLowerCase('fi');
      const row = member.agendaBuckets.get(key) || { title, titleSv: '', speeches: 0, speechIds: [], evidence: [] };
      row.titleSv ||= speech.agendaSv || '';
      row.speeches++;
      row.speechIds.push(speech.id);
      if (row.evidence.length < 5) row.evidence.push({ id: speech.id, mpId: id, date: speech.date });
      member.agendaBuckets.set(key, row);
    }
    for (const document of speech.documents || []) {
      if (!document.label) continue;
      const row = member.matterBuckets.get(document.label) || { matterId: document.label, url: document.url || `https://www.eduskunta.fi/asiat-ja-aanestykset/valtiopaivaasiat/${encodeURIComponent(document.label)}`, speeches: 0, speechIds: [] };
      if (!row.speechIds.includes(speech.id)) { row.speeches++; row.speechIds.push(speech.id); }
      member.matterBuckets.set(document.label, row);
    }
    members.set(id, member);
  }
  return [...members.values()].map(({ topicBuckets, detailedBuckets, agendaBuckets, matterBuckets, dates, ...member }) => {
    const shares = (buckets, totals) => [...buckets.values()].map(row => ({
      ...row,
      withinMpShare: row.speeches / member.speeches,
      withinMpWordShare: member.words ? row.words / member.words : null,
      topicParticipationShare: row.speeches / totals.get(row.topic),
      topicCorpusSpeeches: totals.get(row.topic)
    })).sort((a, b) => b.speeches - a.speeches || a.topic.localeCompare(b.topic));
    return {
      ...member, start: dates.sort()[0] || null, end: dates.at(-1) || null,
      topics: shares(topicBuckets, topicTotals),
      detailedTopics: shares(detailedBuckets, detailedTotals),
      agendas: [...agendaBuckets.values()].sort((a, b) => b.speeches - a.speeches || a.title.localeCompare(b.title, 'fi')),
      matters: [...matterBuckets.values()].map(row => ({ ...row, withinMpShare: row.speeches / member.speeches })).sort((a, b) => b.speeches - a.speeches || a.matterId.localeCompare(b.matterId))
    };
  });
}

export function emergingPhrases(speeches, texts = {}, settings = {}) {
  const corpus = scopeCorpus(speeches, texts, settings), coverage = coverageOf(corpus, texts);
  const latestMonth = (settings.coverageEnd || coverage.end || '2000-01-01').slice(0, 7);
  const recentStart = settings.recentStart || monthShift(latestMonth, -2) + '-01';
  const recentEnd = settings.recentEnd || lastDay(monthShift(latestMonth, -1));
  const baselineStart = settings.baselineStart || monthShift(recentStart.slice(0, 7), -2) + '-01';
  const baselineEnd = settings.baselineEnd || lastDay(monthShift(recentStart.slice(0, 7), -1));
  if (baselineStart > baselineEnd || recentStart > recentEnd || baselineEnd >= recentStart) throw new Error('Emerging phrase windows must be ordered and non-overlapping');
  const minOccurrences = settings.minOccurrences ?? 5, minSpeakers = settings.minSpeakers ?? 3, minParties = settings.minParties ?? 2;
  const windows = { baseline: { start: baselineStart, end: baselineEnd, words: 0, speeches: 0, months: new Set() }, recent: { start: recentStart, end: recentEnd, words: 0, speeches: 0, months: new Set() } }, frequency = new Map(), selectedSpeeches = [];
  const countsFor = text => {
    const tokens = normalizeSpeechSearchText(text).split(' ').filter(Boolean), counts = new Map(), acceptedEnds = new Map();
    for (let index = 0; index < tokens.length; index++) {
      const word = tokens[index];
      if (word.length < 4 || !/^\p{L}+$/u.test(word) || STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
      const next = tokens[index + 1];
      if (next && next.length >= 4 && /^\p{L}+$/u.test(next) && !STOPWORDS.has(next)) {
        const phrase = word + ' ' + next;
        if (index >= (acceptedEnds.get(phrase) || 0)) { counts.set(phrase, (counts.get(phrase) || 0) + 1); acceptedEnds.set(phrase, index + 2); }
      }
    }
    return counts;
  };
  // First pass stores only document frequencies. Rare phrases never allocate
  // per-speaker sets or excerpts, which bounds memory on the full transcript set.
  for (const speech of corpus) {
    const date = isoDay(speech.date), windowId = date >= recentStart && date <= recentEnd ? 'recent' : date >= baselineStart && date <= baselineEnd ? 'baseline' : null;
    if (!windowId) continue;
    const text = textFor(speech, texts), window = windows[windowId];
    window.words += wordCount(text); window.speeches++; window.months.add(date.slice(0, 7));
    selectedSpeeches.push({ speech, windowId });
    for (const [phrase, count] of countsFor(text)) {
      const row = frequency.get(phrase) || { baselineCount: 0, recentCount: 0, baselineSpeeches: 0, recentSpeeches: 0 };
      row[windowId + 'Count'] += count; row[windowId + 'Speeches']++; frequency.set(phrase, row);
    }
  }
  const candidates = new Map();
  for (const [phrase, row] of frequency) if (['baseline', 'recent'].some(id => row[id + 'Count'] >= minOccurrences && row[id + 'Speeches'] >= minSpeakers)) candidates.set(phrase, { query: phrase, baseline: { count: 0, speechIds: [], speakers: new Set(), parties: new Set(), evidence: [] }, recent: { count: 0, speechIds: [], speakers: new Set(), parties: new Set(), evidence: [] } });
  frequency.clear();
  for (const { speech, windowId } of selectedSpeeches) {
    const text = textFor(speech, texts);
    for (const [phrase, count] of countsFor(text)) {
      const row = candidates.get(phrase);
      if (!row) continue;
      const bucket = row[windowId]; bucket.count += count; bucket.speechIds.push(speech.id);
      bucket.speakers.add(speech.mpId || `external:${speech.firstName}:${speech.lastName}`); if (speech.party) bucket.parties.add(speech.party);
      if (bucket.evidence.length < 5) bucket.evidence.push(evidence(speech, text, phrase, 'phrase'));
    }
  }
  const finish = (bucket, window) => ({ count: bucket.count, matchingSpeeches: bucket.speechIds.length, distinctSpeakers: bucket.speakers.size, partyBreadth: bucket.parties.size, speechIds: bucket.speechIds, evidence: bucket.evidence, words: window.words, per10000Words: window.words ? bucket.count / window.words * 10000 : null });
  const rows = [...candidates.values()].filter(row => [row.baseline, row.recent].some(bucket => bucket.count >= minOccurrences && bucket.speakers.size >= minSpeakers && bucket.parties.size >= minParties)).map(row => {
    const baseline = finish(row.baseline, windows.baseline), recent = finish(row.recent, windows.recent), available = baseline.per10000Words !== null && recent.per10000Words !== null;
    const rateChange = available ? recent.per10000Words - baseline.per10000Words : null;
    return { query: row.query, baseline, recent, rateChange, rateRatio: available && baseline.per10000Words > 0 ? recent.per10000Words / baseline.per10000Words : null,
      direction: !available ? 'unavailable' : rateChange > 0 ? 'rising' : rateChange < 0 ? 'falling' : 'unchanged', zeroBaseline: baseline.count === 0,
      exploratory: true, lowSupport: [baseline, recent].some(bucket => bucket.count < minOccurrences || bucket.distinctSpeakers < minSpeakers || bucket.partyBreadth < minParties) };
  }).sort((a, b) => Math.abs(b.rateChange ?? 0) - Math.abs(a.rateChange ?? 0) || a.query.localeCompare(b.query)).slice(0, settings.limit ?? 30);
  return { rows, windows: Object.fromEntries(Object.entries(windows).map(([key, { months, ...window }]) => {
    const missingMonths = [];
    for (let month = window.start.slice(0, 7); month <= window.end.slice(0, 7); month = monthShift(month, 1)) if (!months.has(month)) missingMonths.push(month);
    return [key, { ...window, months: [...months].sort(), missingMonths, coverageGap: !window.words, partial: !!((coverage.start && window.start < coverage.start) || (coverage.end && window.end > coverage.end) || window.start.slice(8) !== '01' || window.end !== lastDay(window.end.slice(0, 7))) }];
  })), method: { version: SPEECH_NETWORK_METHOD, candidateLengths: [1, 2], contiguousTokens: true, minTokenLetters: 4, stopwords: STOPWORD_VERSION, minOccurrences, minSpeakers, minParties, defaultWindows: 'two-complete-calendar-months-versus-previous-two', recessAdjustment: 'rates-and-corpus-activity-only-no-significance-test', multipleComparisonWarning: 'exploratory-selection-among-many-terms', lemmatized: false, crossLanguageMerged: false } };
}

function surnameForms(name) {
  const normalized = normalizeSpeechSearchText(name);
  if (!normalized) return [];
  const forms = [normalized, normalized + 'n', normalized + 'lle', normalized + 'lta', normalized + 'ltä'];
  if (normalized.endsWith('nen')) for (const suffix of ['sen', 'selle', 'seltä']) forms.push(normalized.slice(0, -3) + suffix);
  return unique(forms);
}
/** Candidates are explicit lexical references, never reply-order inference or sentiment. */
export function extractReferences(speeches, texts = {}, members = [], settings = {}) {
  const names = new Map();
  for (const member of members) for (const form of surnameForms(member.lastName || '')) {
    if (!form) continue;
    const list = names.get(form) || []; list.push({ id: String(member.id), firstName: normalizeSpeechSearchText(member.firstName), lastName: member.lastName }); names.set(form, list);
  }
  const candidates = [];
  for (const speech of speeches) {
    const original = textFor(speech, texts), tokens = [...original.matchAll(/\p{L}+(?:[-‑]\p{L}+)*/gu)];
    for (let index = 0; index < tokens.length; index++) {
      const token = normalizeSpeechSearchText(tokens[index][0]), possible = names.get(token);
      if (!possible?.length) continue;
      const prefixTokens = tokens.slice(Math.max(0, index - 3), index).map(match => normalizeSpeechSearchText(match[0]));
      const explicitCue = prefixTokens.some(word => /^(?:edustaja|edustajan|edustajalle|ministeri|ministerin|ministerille|ledamot|ledamoten|minister|ministern|riksdagsledamot)$/u.test(word));
      const previous = prefixTokens.at(-1), fullMatches = possible.filter(person => previous && person.firstName.split(' ').at(-1) === previous);
      if (!explicitCue && !fullMatches.length) continue;
      const people = fullMatches.length ? fullMatches : possible;
      const targetIds = unique(people.map(person => person.id));
      const start = tokens[index].index, end = start + tokens[index][0].length;
      const before = original.slice(Math.max(0, start - 100), start), after = original.slice(end, end + 160);
      candidates.push({ id: `${speech.id}:${start}`, speechId: speech.id, sourceMpId: speech.mpId ? String(speech.mpId) : null,
        date: speech.date, textChunk: speech.textChunk ?? null, href: `#/speeches/${encodeURIComponent(speech.id)}`,
        start, end, mention: tokens[index][0], passage: before + tokens[index][0] + after,
        candidateIds: targetIds, targetMpId: targetIds.length === 1 ? targetIds[0] : null, ambiguous: targetIds.length !== 1,
        extractionType: fullMatches.length ? 'explicit-full-name' : 'titled-surname',
        confidence: targetIds.length === 1 ? 'rule-match-unvalidated' : 'ambiguous',
        negationMarkerPresent: /\b(?:ei|en|et|emme|ette|eivät|inte|ej)\b/iu.test(before), quotationMarkerPresent: /["“”«»]/u.test(before + after),
        relationMeaning: 'explicit-mention-only', selfReferenceCandidate: targetIds.includes(String(speech.mpId)), independentlyReviewed: false });
    }
  }
  const sampleSize = settings.sampleSize ?? 240;
  // Stable interleaving of ambiguity/type strata; no hand-picked easy examples.
  const strata = new Map();
  for (const candidate of candidates) { const key = `${candidate.ambiguous}:${candidate.extractionType}`; const bucket = strata.get(key) || []; bucket.push(candidate); strata.set(key, bucket); }
  for (const bucket of strata.values()) bucket.sort((a, b) => stableHash(a.id) - stableHash(b.id) || a.id.localeCompare(b.id));
  const sample = [], buckets = [...strata.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, values]) => values);
  for (let index = 0; sample.length < sampleSize; index++) { let added = false; for (const bucket of buckets) if (bucket[index] && sample.length < sampleSize) { sample.push(bucket[index]); added = true; } if (!added) break; }
  return { candidates, sample, counts: { candidates: candidates.length, ambiguous: candidates.filter(candidate => candidate.ambiguous).length, sample: sample.length },
    publicationGate: 'pending-independent-human-review', publicPersonRankingsEnabled: false, reviewPolicy: REFERENCE_REVIEW_POLICY,
    method: { version: 'explicit-reference-1', inflections: 'limited-transparent-surname-suffixes', confidenceIsProbability: false, sentimentClassification: false, replyOrderInference: false, sample: 'deterministic-hash-interleaving-by-ambiguity-and-rule', targetTypes: ['explicit-full-name', 'titled-surname'], independentLabels: 0 } };
}
function stableHash(value) { let hash = 2166136261; for (const char of value) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619); } return hash >>> 0; }

export function evaluateReferences(candidates, labels = [], settings = {}) {
  const policy = REFERENCE_REVIEW_POLICY, candidateMap = new Map(candidates.map(candidate => [candidate.id, candidate]));
  const seen = new Set(), accepted = [], rejected = [];
  for (const label of labels) {
    const candidate = candidateMap.get(label.candidateId);
    let reason = !candidate ? 'unknown-candidate' : seen.has(label.candidateId) ? 'duplicate-label' : label.independentHuman !== true || !String(label.reviewer || '').trim() ? 'independent-human-review-required' : typeof label.valid !== 'boolean' ? 'missing-validity-label' : label.valid && !candidate.candidateIds.includes(String(label.targetMpId)) ? 'target-not-a-candidate' : null;
    if (reason) rejected.push({ candidateId: label.candidateId, reason });
    else { accepted.push({ label, candidate }); seen.add(label.candidateId); }
  }
  const resolved = accepted.filter(({ candidate }) => !candidate.ambiguous);
  const truePositive = resolved.filter(({ label, candidate }) => label.valid && String(label.targetMpId) === candidate.targetMpId).length;
  const n = resolved.length, precision = n ? truePositive / n : null, z = 1.959963984540054;
  const lower95 = n ? (precision + z * z / (2 * n) - z * Math.sqrt(precision * (1 - precision) / n + z * z / (4 * n * n))) / (1 + z * z / n) : null;
  const requiredIds = unique(settings.sampleIds || []), sampleComplete = requiredIds.length > 0 && requiredIds.every(id => seen.has(id));
  // The fixed sampled review set is mandatory: selecting only easy candidates cannot open publication.
  const passed = sampleComplete && n >= policy.minimumLabels && lower95 >= policy.precisionTarget && !rejected.length;
  const attention = new Map();
  if (passed) for (const { candidate, label } of resolved.filter(({ label }) => label.valid)) {
    const id = String(label.targetMpId), row = attention.get(id) || { mpId: id, incomingReferences: 0, sourceIds: new Set(), speechIds: new Set() };
    row.incomingReferences++; if (candidate.sourceMpId) row.sourceIds.add(candidate.sourceMpId); row.speechIds.add(candidate.speechId); attention.set(id, row);
  }
  return { reviewPolicy: policy, acceptedLabels: accepted.length, evaluatedResolvedLabels: n, reviewedAmbiguousLabels: accepted.length - n, rejectedLabels: rejected, truePositive, precision, lower95, sampleComplete,
    publicationGate: passed ? 'passed-independent-human-review' : 'pending-independent-human-review', publicPersonRankingsEnabled: passed,
    attention: passed ? [...attention.values()].map(({ sourceIds, speechIds, ...row }) => ({ ...row, distinctReferringSpeakers: sourceIds.size, speechIds: [...speechIds], scope: 'independently-reviewed-references-only' })) : [] };
}

export function buildSpeechAnalysis(speeches, texts = {}, options = {}) {
  const queries = options.queries || DEFAULT_NETWORK_QUERIES;
  const keywordPresets = options.queries ? queries.map(query => ({ query })) : KEYWORD_PRESETS;
  const groupParties = unique(speeches.map(speech => speech.party)).sort().map(party => ({ id: party, party, label: party.toUpperCase() }));
  const settings = { coverageStart: options.coverageStart, coverageEnd: options.coverageEnd };
  const keywordCorpus = prepareKeywordCorpus(speeches, texts, settings, [{ id: 'all', label: 'All' }, ...groupParties]);
  const references = extractReferences(speeches, texts, options.members || [], { sampleSize: options.referenceSampleSize });
  return { coverage: coverageOf(speeches, texts), method: { version: SPEECH_NETWORK_METHOD, topicTags: 'existing-metadata-discovery-tags-not-stance', overlappingTopicShares: true, nonMpTopicProfiles: 'excluded', lexicalLanguageLimit: 'Finnish-and-Swedish-token-forms-no-lemmatization-or-concept-merging' },
    topicProfiles: buildTopicProfiles(speeches, texts, options), emerging: emergingPhrases(speeches, texts, { ...options, ...settings }),
    keywordComparisons: keywordPresets.map(({ query, topic }) => ({
      ...comparePreparedKeywords(keywordCorpus, { ...settings, query, mode: 'contains' }),
      topic
    })),
    phraseUptake: queries.map(query => phraseUptake(speeches, texts, { ...settings, query, mode: 'phrase' })), references };
}
