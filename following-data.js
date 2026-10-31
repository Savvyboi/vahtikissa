import { fetchJSONWithTimeout } from './app-utils.js';
import { currentInsight, insightTags } from './ai-insights.js';

// Following loads only the selected MPs' shards. The large civic snapshot is opt-in.
let influenceRequest;
export function clearFollowingDataCache() { influenceRequest = undefined; }
const idOf = value => String(value ?? '');
// Validate the JSON value before canonicalising it. Objects, arrays and booleans
// must never turn into apparently stable IDs through String(value).
const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 180 && !/[\u0000-\u001f\u007f]/u.test(value);
const validScalarId = value => validId(value) || typeof value === 'number' && Number.isFinite(value);
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const unique = values => [...new Set(values.map(idOf))];
const route = (page, id) => '#/' + page + '/' + encodeURIComponent(id);
const sourceURL = value => {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''; } catch { return ''; }
};
const failed = (key, kind, identity, error) => ({ key, kind, ...identity, complete: false, records: [], error: String(error?.message || error || 'Unavailable source') });
function requireRecords(items, key = 'id', allowNumeric = false) {
  const validate = allowNumeric ? validScalarId : validId;
  if (!Array.isArray(items) || items.some(item => !item || typeof item !== 'object' || Array.isArray(item) || !validate(item[key])) || new Set(items.map(item => idOf(item[key]))).size !== items.length) throw new Error('Incomplete or invalid source records');
}
function source(key, kind, identity, generatedAt, records, extra = {}) {
  if (!validDate(generatedAt)) throw new Error('Missing or invalid source snapshot timestamp');
  return { key, kind, ...identity, generatedAt, snapshot: generatedAt, records, complete: true, ...extra };
}
function requireCore(core) {
  if (!validDate(core?.metadata?.generatedAt) || !Array.isArray(core.members)) throw new Error('Invalid Parliament catalogue');
  requireRecords(core.members, 'id', true);
  requireRecords(core.votes);
  if (Number.isInteger(core.metadata.counts?.votes) && core.metadata.counts.votes !== core.votes.length) throw new Error('Incomplete Parliament vote catalogue');
}
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function requireAIIndex(index) {
  if (!isRecord(index) || index.version !== 1 || !validDate(index.generatedAt) || !isRecord(index.programmes) || !isRecord(index.records)) throw new Error('AI index unavailable or invalid');
  for (const programme of Object.values(index.programmes)) {
    if (!isRecord(programme) || !Array.isArray(programme.tags) || programme.tags.some(tag => !isRecord(tag) || !validId(tag.id))) throw new Error('Invalid AI programme themes');
  }
  // Partial analysis coverage is valid. Validate present entries without requiring
  // an AI record for every parliamentary record.
  for (const kind of ['votes', 'legislation']) {
    const entries = index.records[kind];
    if (!isRecord(entries) || Object.entries(entries).some(([id, entry]) => !validId(id) || !isRecord(entry) || !validId(entry.fingerprint) || !Array.isArray(entry.tags) || entry.tags.some(tag => !validId(tag)))) throw new Error('Invalid AI record associations');
  }
}
function parliamentaryRecord(kind, item, extra = {}) {
  return {
    id: idOf(item.id), kind, title: item.title || item.agenda || item.document || '',
    titleSv: item.titleSv || item.agendaSv || item.documentSv || '',
    date: item.date || item.latestDate || item.firstDate || '',
    url: sourceURL(item.resultUrl || item.url || item.documentUrl || item.documents?.find(document => document.url)?.url),
    href: route(kind, item.id), memberIds: [], themeIds: [], ...extra
  };
}

// Only fingerprint-valid associations are used; stale AI labels cannot attach to a changed record.
export function themeRecords(kind, items, aiIndex, themeId) {
  requireRecords(items);
  return items.filter(item => currentInsight(aiIndex, kind, item)?.tags?.includes(themeId))
    .map(item => parliamentaryRecord(kind, item, { themeIds: [themeId] }));
}

async function memberSources(loader, core, memberId) {
  const keys = ['votes', 'speeches'].map(kind => ['mp:' + memberId + ':' + kind, kind]);
  try {
    requireCore(core);
    const member = core.members.find(item => idOf(item.id) === memberId);
    if (!member) throw new Error('This MP is no longer in the current catalogue');
    const data = await loader.loadRoute({ page: 'members', id: memberId }, 'full');
    if (data.snapshot !== core.metadata.generatedAt) throw new Error('Mixed Parliament snapshots');
    requireRecords(data.ballots, 'voteId'); requireRecords(data.speeches);
    if (data.ballots.some(ballot => !validScalarId(ballot.mpId) || idOf(ballot.mpId) !== memberId) || data.speeches.some(speech => !validScalarId(speech.mpId) || idOf(speech.mpId) !== memberId)) throw new Error('Unexpected MP association in member shard');
    const voteMap = new Map(core.votes.map(vote => [idOf(vote.id), vote]));
    if (data.ballots.some(ballot => !voteMap.has(idOf(ballot.voteId)))) throw new Error('A member vote is missing from the source snapshot');
    for (const [name, items] of [['votes', data.ballots], ['speeches', data.speeches]]) {
      if (Number.isInteger(member.stats?.[name]) && member.stats[name] !== items.length) throw new Error('Incomplete member shard');
    }
    return [
      source(keys[0][0], 'votes', { memberId }, core.metadata.generatedAt,
        data.ballots.map(ballot => parliamentaryRecord('votes', voteMap.get(idOf(ballot.voteId)), { memberIds: [memberId], choice: ballot.choice })), { coverage: 'explicit-mp-id' }),
      source(keys[1][0], 'speeches', { memberId }, core.metadata.generatedAt,
        data.speeches.map(speech => parliamentaryRecord('speeches', speech, { memberIds: [memberId] })), { coverage: 'explicit-mp-id' })
    ];
  } catch (error) { return keys.map(([key, kind]) => failed(key, kind, { memberId }, error)); }
}

async function themeSources(loader, core, themes, aiIndex) {
  let allowed, stamp;
  try {
    requireCore(core);
    requireAIIndex(aiIndex);
    allowed = new Set(insightTags(aiIndex).map(tag => tag.id));
    // A tag refresh and a Parliament refresh are separate source changes.
    stamp = core.metadata.generatedAt + ' / AI ' + aiIndex.generatedAt;
  } catch (error) {
    return themes.flatMap(themeId => ['votes', 'legislation'].map(kind => failed('theme:' + themeId + ':' + kind, kind, { themeId }, error)));
  }
  const result = [], active = [];
  for (const themeId of themes) {
    if (!allowed.has(themeId)) {
      for (const kind of ['votes', 'legislation']) result.push(failed('theme:' + themeId + ':' + kind, kind, { themeId }, 'This theme is unavailable in the current AI catalogue'));
    } else active.push(themeId);
  }
  if (!active.length) return result;
  const make = (kind, items) => active.map(themeId => ({
    ...source('theme:' + themeId + ':' + kind, kind, { themeId }, core.metadata.generatedAt,
      themeRecords(kind, items, aiIndex, themeId), { coverage: 'ai-tag', aiGeneratedAt: aiIndex.generatedAt }), snapshot: stamp
  }));
  try { requireCore(core); result.push(...make('votes', core.votes)); }
  catch (error) { result.push(...active.map(themeId => failed('theme:' + themeId + ':votes', 'votes', { themeId }, error))); }
  try {
    requireCore(core);
    const data = await loader.loadRoute({ page: 'legislation' }, 'full');
    if (data.snapshot !== core.metadata.generatedAt) throw new Error('Mixed Parliament snapshots');
    requireRecords(data.legislation);
    if (Number.isInteger(core.metadata.counts?.legislation) && core.metadata.counts.legislation !== data.legislation.length) throw new Error('Incomplete legislation snapshot');
    result.push(...make('legislation', data.legislation));
  } catch (error) { result.push(...active.map(themeId => failed('theme:' + themeId + ':legislation', 'legislation', { themeId }, error))); }
  return result;
}

const normalizeName = value => String(value || '').normalize('NFC').trim().toLocaleLowerCase('fi').replace(/\s+/g, ' ');
// Match the existing public profile link rule: exactly one complete name, never a partial match.
export function lobbyingMemberIds(item, targets, members) {
  const ids = [];
  for (const targetId of item.targetIds || []) {
    if (!validScalarId(targetId)) continue;
    const target = targets.get(idOf(targetId));
    if (!target || target.kind !== 'mp') continue;
    const name = normalizeName(target.fi?.name || target.sv?.name);
    const matches = members.filter(member => validScalarId(member.id) && [normalizeName(member.firstName + ' ' + member.lastName), normalizeName(member.lastName + ' ' + member.firstName)].includes(name));
    if (name && matches.length === 1) ids.push(idOf(matches[0].id));
  }
  return unique(ids);
}
function giftDate(item) {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(item.reported || '');
  return match ? match[3] + '-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0') : item.reported || '';
}
async function influenceSources(core, members, fetchJSON) {
  try {
    if (!influenceRequest) influenceRequest = fetchJSON('./data/influence.json', { cache: 'no-cache' }).catch(error => { influenceRequest = undefined; throw error; });
    const data = await influenceRequest;
    if (!validDate(data.metadata?.generatedAt)) throw new Error('Invalid civic snapshot timestamp');
    requireRecords(core.members, 'id', true);
    requireRecords(data.gifts); requireRecords(data.lobbying); requireRecords(data.targets, 'id', true);
    if (Number.isInteger(data.counts?.gifts) && data.counts.gifts !== data.gifts.length) throw new Error('Incomplete gifts snapshot');
    if (Number.isInteger(data.counts?.lobbyingTopics) && data.counts.lobbyingTopics !== data.lobbying.length) throw new Error('Incomplete lobbying snapshot');
    const targetIds = new Set(data.targets.map(target => idOf(target.id)));
    if (data.gifts.some(item => !validScalarId(item.mpId)) || data.lobbying.some(item => !Array.isArray(item.targetIds) || item.targetIds.some(id => !validScalarId(id) || !targetIds.has(idOf(id))))) throw new Error('Incomplete civic associations');
    const targets = new Map(data.targets.map(target => [idOf(target.id), target]));
    const targetMembers = new Map(data.targets.map(target => [idOf(target.id), lobbyingMemberIds({ targetIds: [target.id] }, targets, core.members)]));
    const gifts = data.gifts.map(item => ({
      id: idOf(item.id), kind: 'gifts', title: item.description || item.donor || '', titleSv: item.descriptionSv || '', date: giftDate(item),
      // The snapshot has no per-gift URL. Retain its published dataset source.
      url: sourceURL(item.url) || sourceURL(data.metadata.parliamentSource),
      href: route('influence', item.mpId) + '?tab=gifts', memberIds: [idOf(item.mpId)], themeIds: [], donor: item.donor, reported: item.reported, used: item.used
    }));
    const lobbying = data.lobbying.map(item => ({
      id: idOf(item.id), kind: 'lobbying', title: item.actor + ': ' + item.topic, titleSv: '', date: item.reported || '',
      url: sourceURL(item.url) || sourceURL(data.metadata.transparencySource),
      href: '#/influence?tab=lobbying&actor=' + encodeURIComponent(item.actor || ''),
      memberIds: unique(item.targetIds.flatMap(id => targetMembers.get(idOf(id)) || [])), themeIds: [], period: item.period, reported: item.reported
    }));
    return members.flatMap(memberId => [
      source('mp:' + memberId + ':gifts', 'gifts', { memberId }, data.metadata.generatedAt, gifts.filter(item => item.memberIds.includes(memberId)), { coverage: 'explicit-mp-id' }),
      source('mp:' + memberId + ':lobbying', 'lobbying', { memberId }, data.metadata.generatedAt, lobbying.filter(item => item.memberIds.includes(memberId)), { coverage: 'unique-name', association: 'unique-name', notice: 'Only MP targets with one exact full-name match. Declared contacts do not establish influence on decisions.' })
    ]);
  } catch (error) {
    // A malformed fetched snapshot must be retryable as well as a network failure.
    influenceRequest = undefined;
    return members.flatMap(memberId => ['gifts', 'lobbying'].map(kind => failed('mp:' + memberId + ':' + kind, kind, { memberId }, error)));
  }
}

export async function loadFollowingData({ parliamentLoader, core, members = [], themes = [], aiIndex = null, includeInfluence = false, fetchJSON = fetchJSONWithTimeout }) {
  const mpIds = unique(members), themeIds = unique(themes);
  const tasks = mpIds.map(memberId => memberSources(parliamentLoader, core, memberId));
  if (themeIds.length) tasks.push(themeSources(parliamentLoader, core, themeIds, aiIndex));
  if (includeInfluence && mpIds.length) tasks.push(influenceSources(core, mpIds, fetchJSON));
  return (await Promise.all(tasks)).flat();
}
