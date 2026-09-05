import { mkdir, writeFile } from 'node:fs/promises';
import { normalizeParty, normalizeVote, buildIndexes, deriveMembers, isInRange, START_DATE } from './lib.mjs';

const API = process.env.EDUSKUNTA_API || 'https://api.eduskunta.fi/api/v1';
const OUT = new URL('../data/', import.meta.url);
const END_YEAR = new Date().getFullYear();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fi = value => typeof value === 'object' && value !== null ? value.fi ?? '' : value ?? '';
const clean = value => String(value ?? '').trim();
const iso = value => clean(value).replace(/^(\d{4}-\d\d-\d\d)\+.*$/, '$1');

async function request(path, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(`${API}${path}`, {
        ...options,
        signal: AbortSignal.timeout(60_000),
        headers: { accept: 'application/json', 'user-agent': 'EduskuntaVahti/1.0 (+open civic data)', ...options.headers }
      });
      if (response.ok) return await response.json();
      const body = await response.text();
      const error = new Error(`${response.status} ${path}: ${body}`);
      if (response.status < 500 && response.status !== 429) throw error;
      lastError = error;
      const retryAfter = Number(response.headers.get('retry-after'));
      if (retryAfter) await delay(retryAfter * 1000);
    } catch (error) {
      lastError = error;
      if (attempt === attempts || /^4\d\d /.test(error.message) && !error.message.startsWith('429 ')) throw error;
    }
    await delay(700 * 2 ** (attempt - 1));
  }
  throw lastError;
}

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
      return text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
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
  const question = clean(fi(row.aanestysotsikko));
  const document = clean(fi(row.kohta?.asiakirjat?.paaasiakirjaEduskuntatunnus));
  const date = iso(row.aanestysalkuaika || row.istuntopvm);
  return {
    vote: {
      id: clean(row.id), number: clean(row.aanestysnumero), sessionNumber: clean(row.istuntonumero), year: clean(row.istuntovpvuosi),
      date, startsAt: iso(row.aanestysalkuaika), title, question, detail: clean(fi(row.aanestyslisaotsikko)),
      stage: clean(fi(row.kohta?.kasittelyvaihenimi) || fi(row.kohta?.kasittelyotsikkonimi)),
      yes: Number(totals.jaa ?? counts.yes), no: Number(totals.ei ?? counts.no), abstain: Number(totals.tyhjia ?? counts.abstain), absent: Number(totals.poissa ?? counts.absent), total: events.length,
      document, documentUrl: document ? `https://www.eduskunta.fi/FI/vaski/KasittelytiedotValtiopaivaasia/Sivut/${encodeURIComponent(document)}.aspx` : '',
      minutes: clean(fi(row.paivajarjestyksenotsikko)), minutesUrl: '', resultUrl: `https://api.eduskunta.fi/api/v1/taysistunnot/aanestykset/${encodeURIComponent(row.id)}`,
      isAmendment: /ehdotus|vastalause|lausuma/i.test(`${title} ${question}`)
    }, ballots
  };
}

function normalizeSpeech(wrapper) {
  const row = wrapper.puheenvuoro;
  return {
    id: clean(row.id), mpId: clean(row.puhuja?.henkilonro), firstName: clean(row.puhuja?.etunimi), lastName: clean(row.puhuja?.sukunimi),
    party: normalizeParty(row.puhuja?.lisatieto || clean(row.puhuja?.eduskuntaryhma_tunnus).split('~')[0].replace(/\d+$/, '')),
    date: iso(row.aloitushetki), session: `${row.valtiopaivavuosi}-${row.taysistuntonumero}`,
    agenda: clean(row.asia?.fi?.nimeketeksti || row.poytakirjanasiankohta?.fi?.nimeketeksti), type: clean(row.puheenvuorotyyppinimi),
    // The UI displays an excerpt; cap it so one static file stays below GitHub's 100 MB limit.
    text: clean(row.puheenvuoro).slice(0, 1200), documents: (row.asiakirjaviitteet?.fi || []).map(doc => ({ name: clean(doc.asiakirjatyyppi), label: clean(doc.eduskuntatunnus), url: '' }))
  };
}

async function sync() {
  console.log(`Syncing current Parliament API from ${START_DATE}…`);
  const years = Array.from({ length: END_YEAR - 2023 + 1 }, (_, index) => 2023 + index);
  const voteWrappers = [];
  const speechWrappers = [];
  for (const year of years) {
    voteWrappers.push(...await search('aanestys', year, 'istuntopvm'));
    speechWrappers.push(...await search('puheenvuoro', year, 'aloitushetki'));
  }
  const normalizedVotes = voteWrappers.map(normalizeVoteRecord).filter(item => isInRange(item.vote.date));
  const votes = normalizedVotes.map(item => item.vote).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const ballots = normalizedVotes.flatMap(item => item.ballots);
  const speeches = speechWrappers.map(normalizeSpeech).filter(item => isInRange(item.date)).sort((a, b) => b.date.localeCompare(a.date));

  const officialMembers = (await request('/kansanedustajat')).kansanedustajat || [];
  const memberById = new Map(officialMembers.map(member => [clean(member.henkilonro), member]));
  const voteDates = Object.fromEntries(votes.map(vote => [vote.id, vote.date]));
  const derived = deriveMembers(ballots.map(ballot => ({ ...ballot, date: voteDates[ballot.voteId] || '' })), speeches);
  const members = derived.map(member => {
    const official = memberById.get(member.id);
    return official ? { ...member, firstName: clean(official.kutsumanimi || official.etunimet), lastName: clean(official.sukunimi) } : member;
  });
  const groupBy = (items, key) => items.reduce((result, item) => ((result[key(item)] ||= []).push(item), result), {});
  const sessions = Object.values(groupBy(votes, vote => `${vote.year}-${vote.sessionNumber}`)).map(group => ({ id: `${group[0].year}-${group[0].sessionNumber}`, year: group[0].year, number: group[0].sessionNumber, date: group[0].date, title: `Täysistunto ${group[0].sessionNumber}/${group[0].year}`, voteIds: group.map(vote => vote.id) })).sort((a, b) => b.date.localeCompare(a.date));
  const legislation = Object.values(groupBy(votes.filter(vote => vote.document), vote => vote.document)).map(group => ({ id: group[0].document, title: group[0].title, document: group[0].document, url: group[0].documentUrl, firstDate: group.at(-1).date, latestDate: group[0].date, stages: [...new Set(group.map(vote => vote.stage).filter(Boolean))], voteIds: group.map(vote => vote.id), amendmentCount: group.filter(vote => vote.isAmendment).length })).sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  const indexes = buildIndexes({ votes, ballots, speeches, members });
  const membersWithStats = members.map(member => ({ ...member, stats: indexes.members[member.id]?.stats || null }));
  const metadata = { generatedAt: new Date().toISOString(), source: API, startDate: START_DATE, counts: { votes: votes.length, ballots: ballots.length, speeches: speeches.length, members: members.length, parties: Object.keys(indexes.parties).length, sessions: sessions.length, legislation: legislation.length, amendments: votes.filter(vote => vote.isAmendment).length } };
  const packedBallots = ballots.map(ballot => [ballot.voteId, ballot.mpId, ballot.party, ballot.choice]);
  const data = { metadata, votes, ballots: packedBallots, speeches, members: membersWithStats, sessions, legislation, parties: Object.values(indexes.parties).sort((a, b) => b.stats.votes - a.stats.votes) };
  await mkdir(OUT, { recursive: true });
  await writeFile(new URL('parliament.json', OUT), `${JSON.stringify(data)}\n`);
  await writeFile(new URL('metadata.json', OUT), `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(JSON.stringify(metadata, null, 2));
}

sync().catch(error => { console.error(error); process.exitCode = 1; });
