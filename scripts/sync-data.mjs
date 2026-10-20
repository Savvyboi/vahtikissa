import { fetchParliamentMembers } from './parliament-members.mjs';
import { buildMemberProfiles } from './member-profiles.mjs';
import { buildWordClouds } from '../speech-research.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { normalizeParty, normalizeVote, buildIndexes, deriveMembers, isInRange, START_DATE } from './lib.mjs';
import { buildSpeechAnalytics, normalizeSpeechSearchText } from '../app-utils.js';
import { retryDelayMs } from './http-retry.mjs';

const parliamentMatterUrl = document => document ? `https://www.eduskunta.fi/asiat-ja-aanestykset/valtiopaivaasiat/${encodeURIComponent(document)}` : '';

const API = process.env.EDUSKUNTA_API || 'https://api.eduskunta.fi/api/v1';
const OUT = new URL('../data/', import.meta.url);
const END_YEAR = new Date().getFullYear();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fi = value => typeof value === 'object' && value !== null ? value.fi ?? '' : value ?? '';
const clean = value => String(value ?? '').trim();
const iso = value => clean(value).replace(/^(\d{4}-\d\d-\d\d)\+.*$/, '$1');

export function createParliamentRequest({ api = API, fetcher = fetch, wait = delay } = {}) {
  return async function request(path, options = {}, attempts = 4) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      let response;
      try {
        response = await fetcher(api + path, {
          ...options,
          signal: AbortSignal.timeout(60_000),
          headers: { accept: 'application/json', 'user-agent': 'EduskuntaVahti/1.0 (+open civic data)', ...options.headers }
        });
        if (response.ok) return await response.json();
        const body = await response.text();
        const error = new Error(response.status + ' ' + path + ': ' + body);
        if (response.status < 500 && response.status !== 429) throw error;
        lastError = error;
      } catch (error) {
        lastError = error;
        if (attempt === attempts || /^4\d\d /.test(error.message) && !error.message.startsWith('429 ')) throw error;
      }
      if (attempt < attempts) {
        const retryIn = retryDelayMs(response, attempt);
        if (response?.status === 429) console.warn('Parliament rate limit: retrying ' + path + ' in ' + Math.ceil(retryIn / 1000) + 's.');
        await wait(retryIn);
      }
    }
    throw lastError;
  };
}
const request = createParliamentRequest();

async function search(category, year, sortProperty) {
  const query = {
    category,
    expression: { and: [{ property: category === 'aanestys' ? 'istuntovpvuosi' : 'valtiopaivavuosi', match: String(year) }] },
    sort: [{ property: sortProperty, ascending: false }]
  };
  const job = await request('/search/dataset', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(query)
  });
  for (let poll = 0; poll < 120; poll++) {
    await delay(3000);
    const status = await request(`/search/dataset/status/${job.jobId}`);
    if (status.status === 'FAILED') throw new Error(`Dataset search failed: ${category} ${year}`);
    if (status.status === 'COMPLETED') {
      const response = await fetch(status.resultUrl, { signal: AbortSignal.timeout(120_000) });
      if (!response.ok) throw new Error(`Dataset download failed: ${response.status}`);
      const text = await response.text();
      const records = text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
      console.log(category + ' ' + year + ': ' + records.length + ' source records.');
      return records;
    }
  }
  throw new Error(`Dataset search timed out: ${category} ${year}`);
}

function normalizeVoteRecord(wrapper) {
  const row = wrapper.aanestys;
  const totals = row.aanestystulos || {};
  const events = row.aanestystapahtumat || [];
  const counts = { yes: 0, no: 0, abstain: 0, absent: 0 };
  const ballots = events.map(event => {
    const choice = normalizeVote(fi(event.kayttaytyminen));
    if (choice in counts) counts[choice]++;
    return { voteId: row.id, mpId: clean(event.henkilonumero), firstName: clean(event.etunimi), lastName: clean(event.sukunimi), party: normalizeParty(fi(event.edkryhmalyhenne)), choice };
  });
  const title = clean(fi(row.kohta?.otsikko) || fi(row.aanestysotsikko));
  const titleSv = clean(row.kohta?.otsikko?.sv || row.aanestysotsikko?.sv);
  const question = clean(fi(row.aanestysotsikko));
  const questionSv = clean(row.aanestysotsikko?.sv);
  const document = clean(fi(row.kohta?.asiakirjat?.paaasiakirjaEduskuntatunnus));
  const documentSv = clean(row.kohta?.asiakirjat?.paaasiakirjaEduskuntatunnus?.sv);
  const date = iso(row.aanestysalkuaika || row.istuntopvm);
  return {
    vote: {
      id: clean(row.id), number: clean(row.aanestysnumero), sessionNumber: clean(row.istuntonumero), year: clean(row.istuntovpvuosi),
      date, startsAt: iso(row.aanestysalkuaika), title, titleSv, question, questionSv, detail: clean(fi(row.aanestyslisaotsikko)), detailSv: clean(row.aanestyslisaotsikko?.sv),
      stage: clean(fi(row.kohta?.kasittelyvaihenimi) || fi(row.kohta?.kasittelyotsikkonimi)), stageSv: clean(row.kohta?.kasittelyvaihenimi?.sv || row.kohta?.kasittelyotsikkonimi?.sv),
      yes: Number(totals.jaa ?? counts.yes), no: Number(totals.ei ?? counts.no), abstain: Number(totals.tyhjia ?? counts.abstain), absent: Number(totals.poissa ?? counts.absent), total: events.length,
      document, documentSv, documentUrl: parliamentMatterUrl(document),
      minutes: clean(fi(row.paivajarjestyksenotsikko)), minutesSv: clean(row.paivajarjestyksenotsikko?.sv), minutesUrl: '', resultUrl: `https://api.eduskunta.fi/api/v1/taysistunnot/aanestykset/${encodeURIComponent(row.id)}`,
      isAmendment: /ehdotus|vastalause|lausuma/i.test(`${title} ${question}`)
    }, ballots
  };
}

export function normalizeSpeech(wrapper) {
  const row = wrapper.puheenvuoro;
  const documents = language => (row.asiakirjaviitteet?.[language] || []).map(doc => ({ name: clean(doc.asiakirjatyyppi), label: clean(doc.eduskuntatunnus), url: '' }));
  return {
    id: clean(row.id), mpId: clean(row.puhuja?.henkilonro), firstName: clean(row.puhuja?.etunimi), lastName: clean(row.puhuja?.sukunimi),
    party: normalizeParty(row.puhuja?.lisatieto || clean(row.puhuja?.eduskuntaryhma_tunnus).split('~')[0].replace(/\d+$/, '')),
    date: iso(row.aloitushetki), session: `${row.valtiopaivavuosi}-${row.taysistuntonumero}`,
    agenda: clean(row.asia?.fi?.nimeketeksti || row.poytakirjanasiankohta?.fi?.nimeketeksti), agendaSv: clean(row.asia?.sv?.nimeketeksti || row.poytakirjanasiankohta?.sv?.nimeketeksti), type: clean(row.puheenvuorotyyppinimi),
    text: clean(row.puheenvuoro), documents: documents('fi'), documentsSv: documents('sv')
  };
}

// A debate-only plenary must remain visible even when it has no roll-call votes.
export function buildSessions(votes, speeches) {
  const sessions = new Map();
  function ensure(id, date) {
    if (!/^\d{4}-\d+$/.test(id) || !isInRange(date)) return;
    const [year, number] = id.split('-');
    if (!sessions.has(id)) sessions.set(id, {
      id, year, number, date: String(date).slice(0, 10),
      title: 'Täysistunto ' + number + '/' + year, titleSv: 'Plenum ' + number + '/' + year, voteIds: [], speechCount: 0
    });
    const session = sessions.get(id);
    if (String(date).slice(0, 10) < session.date) session.date = String(date).slice(0, 10);
    return session;
  }
  for (const vote of votes) ensure(vote.year + '-' + vote.sessionNumber, vote.date)?.voteIds.push(vote.id);
  for (const speech of speeches) {
    const session = ensure(speech.session, speech.date);
    if (session) session.speechCount++;
  }
  return [...sessions.values()].sort((a, b) => b.date.localeCompare(a.date) || Number(b.number) - Number(a.number));
}

export function splitSpeeches(items, chunkSize = 1000) {
  const speechTextChunks = [];
  const speeches = items.map(({ text, ...speech }, index) => {
    const textChunk = Math.floor(index / chunkSize);
    (speechTextChunks[textChunk] ||= {})[speech.id] = text || '';
    return { ...speech, textChunk };
  });
  return { speeches, speechTextChunks };
}

export function buildSpeechSearchIndex(items) {
  const words = [];
  const wordIds = new Map();
  const speeches = items.map(item => normalizeSpeechSearchText(item.text).split(' ').filter(Boolean).map(word => {
    if (!wordIds.has(word)) {
      wordIds.set(word, words.length);
      words.push(word);
    }
    return wordIds.get(word);
  }));
  return [words, speeches];
}

export function normalizeMatter(wrapper) {
  const row = wrapper.valtiopaivaasia;
  const document = clean(row.eduskuntatunnus?.fi);
  const firstDate = iso(row.laadintapvm?.fi || row.laadintapvm?.sv || row.viimeisinJulkaisuajankohta?.fi || row.viimeisinJulkaisuajankohta?.sv);
  const latestDate = iso(row.viimeisinJulkaisuajankohta?.fi || row.viimeisinJulkaisuajankohta?.sv || firstDate);
  const stage = clean(row.viimeisinKasittelyvaihe?.fi);
  const stageSv = clean(row.viimeisinKasittelyvaihe?.sv);
  const committeeRows = language => [
    ...(row.valiokuntienViimeisimmatKasittelyt?.[language] || []),
    ...(row.kasittelyt?.[language] || [])
  ].map(item => item?.valiokunta || item).filter(item => item?.tunnus || item?.nimi);
  const committeesById = new Map();
  for (const committee of committeeRows('fi')) {
    const id = clean(committee.tunnus || committee.nimi);
    committeesById.set(id, { id, name: clean(committee.nimi), nameSv: '' });
  }
  for (const committee of committeeRows('sv')) {
    const id = clean(committee.tunnus || committee.nimi);
    const existing = committeesById.get(id) || { id, name: '', nameSv: '' };
    existing.nameSv = clean(committee.nimi);
    committeesById.set(id, existing);
  }
  return {
    id: document, document, documentSv: clean(row.eduskuntatunnus?.sv), title: clean(row.nimeke?.fi), titleSv: clean(row.nimeke?.sv),
    firstDate, latestDate, stages: stage ? [stage] : [], stagesSv: stageSv ? [stageSv] : [],
    decision: clean(row.kokonaispaatosnimi?.fi), decisionSv: clean(row.kokonaispaatosnimi?.sv), voteIds: [], amendmentCount: 0,
    ...(committeesById.size ? { committees: [...committeesById.values()] } : {}),
    url: parliamentMatterUrl(document)
  };
}

function committeeSnapshot(items) {
  return {
    generatedAt: new Date().toISOString(),
    matters: Object.fromEntries(items.filter(item => item.id && item.committees?.length).map(item => [item.id, item.committees]))
  };
}

export async function syncCommitteeIndex() {
  console.log(`Syncing Parliament committee assignments from ${START_DATE}…`);
  const years = Array.from({ length: END_YEAR - 2023 + 1 }, (_, index) => 2023 + index);
  const matterWrappers = [];
  for (const year of years) matterWrappers.push(...await search('valtiopaivaasia', year, 'laadintapvm'));
  const snapshot = committeeSnapshot(matterWrappers.map(normalizeMatter).filter(item => item.id && isInRange(item.firstDate)));
  await mkdir(OUT, { recursive: true });
  await writeFile(new URL('committee-index.json', OUT), `${JSON.stringify(snapshot)}\n`);
  console.log(`Committee index: ${Object.keys(snapshot.matters).length} matters.`);
  return snapshot;
}

export async function sync() {
  console.log(`Syncing current Parliament API from ${START_DATE}…`);
  const years = Array.from({ length: END_YEAR - 2023 + 1 }, (_, index) => 2023 + index);
  const voteWrappers = [];
  const speechWrappers = [];
  const matterWrappers = [];
  for (const year of years) {
    voteWrappers.push(...await search('aanestys', year, 'istuntopvm'));
    speechWrappers.push(...await search('puheenvuoro', year, 'aloitushetki'));
    matterWrappers.push(...await search('valtiopaivaasia', year, 'laadintapvm'));
  }
  const normalizedVotes = voteWrappers.map(normalizeVoteRecord).filter(item => isInRange(item.vote.date));
  const votes = normalizedVotes.map(item => item.vote).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const ballots = normalizedVotes.flatMap(item => item.ballots);
  const completeSpeeches = speechWrappers.map(normalizeSpeech).filter(item => isInRange(item.date)).sort((a, b) => b.date.localeCompare(a.date));
  const { speeches, speechTextChunks } = splitSpeeches(completeSpeeches);
  const speechSearchIndex = buildSpeechSearchIndex(completeSpeeches);
  const speechAnalytics = { generatedAt: new Date().toISOString(), ...buildSpeechAnalytics(completeSpeeches) };

  const voteDates = Object.fromEntries(votes.map(vote => [vote.id, vote.date]));
  const derived = deriveMembers(ballots.map(ballot => ({ ...ballot, date: voteDates[ballot.voteId] || '' })), speeches);
  const { members: officialMembers } = await fetchParliamentMembers(request, { memberIds: derived.map(member=>member.id) });
  const memberProfiles = buildMemberProfiles(officialMembers, derived.map(member=>member.id));
  const memberById = new Map(officialMembers.map(member => [clean(member.henkilonro), member]));
  const members = derived.map(member => {
    const official = memberById.get(member.id);
    return official ? { ...member, firstName: clean(official.kutsumanimi || official.etunimet), lastName: clean(official.sukunimi) } : member;
  });
  const groupBy = (items, key) => items.reduce((result, item) => ((result[key(item)] ||= []).push(item), result), {});
  const sessions = buildSessions(votes, speeches);
  const normalizedMatters = matterWrappers.map(normalizeMatter).filter(item => item.id && isInRange(item.firstDate));
  const committeeIndex = committeeSnapshot(normalizedMatters);
  const legislationById = new Map(normalizedMatters.map(item => {
    const { committees, ...matter } = item;
    return [matter.id, matter];
  }));
  for (const group of Object.values(groupBy(votes.filter(vote => vote.document), vote => vote.document))) {
    const matter = legislationById.get(group[0].document) || normalizeMatter({ valtiopaivaasia: { eduskuntatunnus: { fi: group[0].document, sv: group[0].documentSv }, nimeke: { fi: group[0].title, sv: group[0].titleSv }, laadintapvm: { fi: group.at(-1).date, sv: group.at(-1).date } } });
    matter.latestDate = [matter.latestDate, group[0].date].filter(Boolean).sort().at(-1) || '';
    matter.stages = [...new Set([...matter.stages, ...group.map(vote => vote.stage).filter(Boolean)])];
    matter.stagesSv = [...new Set([...matter.stagesSv, ...group.map(vote => vote.stageSv).filter(Boolean)])];
    matter.voteIds = group.map(vote => vote.id);
    matter.amendmentCount = group.filter(vote => vote.isAmendment).length;
    legislationById.set(matter.id, matter);
  }
  const legislation = [...legislationById.values()].sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  const indexes = buildIndexes({ votes, ballots, speeches, members });
  const membersWithStats = members.map(member => ({ ...member, stats: indexes.members[member.id]?.stats || null }));
  const metadata = { generatedAt: new Date().toISOString(), source: API, startDate: START_DATE, latest: { vote: votes[0]?.date || '', speech: speeches[0]?.date || '', session: sessions[0]?.date || '', matter: legislation[0]?.latestDate || '' }, counts: { votes: votes.length, ballots: ballots.length, speeches: speeches.length, members: members.length, parties: Object.keys(indexes.parties).length, sessions: sessions.length, legislation: legislation.length, amendments: votes.filter(vote => vote.isAmendment).length } };
  const packedBallots = ballots.map(ballot => [ballot.voteId, ballot.mpId, ballot.party, ballot.choice]);
  const data = { metadata, votes, ballots: packedBallots, speeches, members: membersWithStats, sessions, legislation, parties: Object.values(indexes.parties).sort((a, b) => b.stats.votes - a.stats.votes) };
  await mkdir(OUT, { recursive: true });
  await writeFile(new URL('parliament.json', OUT), `${JSON.stringify(data)}\n`);
  await Promise.all(speechTextChunks.map((chunk, index) => writeFile(new URL(`speech-texts-${index}.json`, OUT), `${JSON.stringify(chunk)}\n`)));
  await writeFile(new URL('speech-search.json', OUT), JSON.stringify(speechSearchIndex));
  await writeFile(new URL('speech-wordclouds.json', OUT), `${JSON.stringify({generatedAt:metadata.generatedAt,...buildWordClouds(completeSpeeches,60,members.map(member=>member.id),members.map(member=>member.lastName))})}\n`);
  await writeFile(new URL('member-profiles.json', OUT), `${JSON.stringify(memberProfiles)}\n`);
  await writeFile(new URL('speech-analytics.json', OUT), `${JSON.stringify(speechAnalytics)}\n`);
  await writeFile(new URL('committee-index.json', OUT), `${JSON.stringify(committeeIndex)}\n`);
  await writeFile(new URL('metadata.json', OUT), `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(JSON.stringify(metadata, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  (process.argv.includes('--committees-only') ? syncCommitteeIndex() : sync()).catch(error => { console.error(error); process.exitCode = 1; });
}
