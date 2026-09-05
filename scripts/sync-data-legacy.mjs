import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { rowsToObjects, normalizeParty, normalizeVote, textFromXml, buildIndexes, deriveMembers, isInRange, START_DATE } from './lib.mjs';

const API = process.env.EDUSKUNTA_API || 'https://avoindata.eduskunta.fi/api/v1';
const OUT = new URL('../data/', import.meta.url);
const END_YEAR = new Date().getFullYear();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function get(path, params = {}, attempts = 4) {
  const url = new URL(`${API}${path}`);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') url.searchParams.set(key, value);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { accept: 'application/json', 'user-agent': 'EduskuntaVahti/1.0 (+open civic data)' } });
      if (response.ok) return await response.json();
      const body = await response.text();
      if (response.status < 500 && response.status !== 429) throw new Error(`${response.status} ${url}: ${body}`);
      lastError = new Error(`${response.status} ${url}: ${body}`);
      const retryAfter = Number(response.headers.get('retry-after'));
      if (retryAfter) await delay(retryAfter * 1000);
    } catch (error) {
      lastError = error;
      if (attempt === attempts || /^4\d\d /.test(error.message) && !error.message.startsWith('429 ')) throw error;
    }
    if (attempt < attempts) await delay(500 * 2 ** (attempt - 1));
  }
  throw lastError;
}

async function tableRows(tableName, params = {}) {
  const perPage = Math.min(100, Number(params.perPage || 100));
  const rows = [];
  for (let page = 0; ; page++) {
    const payload = await get(`/tables/${tableName}/rows`, { ...params, perPage, page });
    rows.push(...rowsToObjects(payload));
    if (!payload.hasMore) return rows;
  }
}

async function tableBatch(tableName, pkName, startValue = 0, perPage = 1000) {
  const rows = [];
  let pkStartValue = startValue;
  for (;;) {
    const payload = await get(`/tables/${tableName}/batch`, { pkName, pkStartValue, perPage });
    rows.push(...rowsToObjects(payload));
    if (!payload.hasMore || payload.pkLastValue === null || payload.pkLastValue === undefined) return rows;
    const next = Number(payload.pkLastValue) + 1;
    if (!Number.isFinite(next) || next <= pkStartValue) return rows;
    pkStartValue = next;
  }
}

function n(value) { return Number(String(value || 0).trim()) || 0; }
function clean(value) { return String(value || '').trim(); }
function iso(value) { return clean(value).replace(' ', 'T'); }
function eduskuntaUrl(path) { return path ? `https://www.eduskunta.fi/FI${path}` : ''; }

async function sync() {
  console.log(`Syncing Eduskunta data from ${START_DATE}…`);
  const voteRaw = (await Promise.all(Array.from({ length: END_YEAR - 2023 + 1 }, (_, i) =>
    tableRows('SaliDBAanestys', { columnName: 'IstuntoVPVuosi', columnValue: 2023 + i, perPage: 1000 })
  ))).flat().filter(row => clean(row.KieliId) === '1' && isInRange(row.IstuntoPvm));

  const votes = voteRaw.map(row => ({
    id: clean(row.AanestysId), number: clean(row.AanestysNumero), sessionNumber: clean(row.IstuntoNumero), year: clean(row.IstuntoVPVuosi),
    date: iso(row.IstuntoPvm), startsAt: iso(row.AanestysAlkuaika), title: clean(row.KohtaOtsikko || row.AanestysOtsikko),
    question: clean(row.AanestysOtsikko), detail: clean(row.AanestysLisaOtsikko || row.KohtaHuomautus), stage: clean(row.KohtaKasittelyOtsikko),
    yes: n(row.AanestysTulosJaa), no: n(row.AanestysTulosEi), abstain: n(row.AanestysTulosTyhjia), absent: n(row.AanestysTulosPoissa), total: n(row.AanestysTulosYhteensa),
    document: clean(row.AanestysValtiopaivaasia), documentUrl: eduskuntaUrl(row.AanestysValtiopaivaasiaUrl), minutes: clean(row.AanestysPoytakirja), minutesUrl: eduskuntaUrl(row.AanestysPoytakirjaUrl),
    resultUrl: eduskuntaUrl(row.Url), isAmendment: /ehdotus|vastalause|lausuma/i.test(`${row.AanestysOtsikko} ${row.AanestysLisaOtsikko}`)
  })).sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  console.log(`Fetching ballots for ${votes.length} votes…`);
  const ballotPages = [];
  for (let i = 0; i < votes.length; i += 10) {
    const chunk = votes.slice(i, i + 10);
    ballotPages.push(...await Promise.all(chunk.map(vote => tableRows('SaliDBAanestysEdustaja', { columnName: 'AanestysId', columnValue: vote.id, perPage: 100 }))));
  }
  const ballots = ballotPages.flat().map(row => ({ id: clean(row.EdustajaId), voteId: clean(row.AanestysId), mpId: clean(row.EdustajaHenkiloNumero), firstName: clean(row.EdustajaEtunimi), lastName: clean(row.EdustajaSukunimi), party: normalizeParty(row.EdustajaRyhmaLyhenne), choice: normalizeVote(row.EdustajaAanestys) }));

  console.log('Fetching speeches and session agenda…');
  const [speechRaw, sessionRaw, agendaRaw, documentRaw] = await Promise.all([
    tableBatch('SaliDBPuheenvuoro', 'Id', 0, 100), tableBatch('SaliDBIstunto', 'Id', 0, 100),
    tableBatch('SaliDBKohta', 'Id', 0, 100), tableBatch('SaliDBKohtaAsiakirja', 'Id', 0, 100)
  ]);
  const agendaByKey = Object.fromEntries(agendaRaw.map(row => [clean(row.TekninenAvain), row]));
  const docsByAgenda = Object.groupBy(documentRaw, row => clean(row.KohtaTekninenAvain));
  const sessionsByKey = Object.fromEntries(sessionRaw.map(row => [clean(row.TekninenAvain), row]));
  const speeches = speechRaw.filter(row => isInRange(row.PyyntoAika || row.Created)).map(row => {
    const agenda = agendaByKey[clean(row.KohtaTekninenAvain)] || {};
    const session = sessionsByKey[clean(row.IstuntoTekninenAvain)] || {};
    return { id: clean(row.Id), mpId: clean(row.henkilonumero), firstName: clean(row.Etunimi), lastName: clean(row.Sukunimi), party: normalizeParty(row.RyhmaLyhenneFI), date: iso(row.PyyntoAika || row.Created), session: clean(row.IstuntoTekninenAvain), agenda: clean(agenda.OtsikkoFI), type: clean(row.PVTyyppi), text: textFromXml(row.XmlData), documents: (docsByAgenda[clean(row.KohtaTekninenAvain)] || []).map(doc => ({ name: clean(doc.NimiFI), label: clean(doc.LinkkiTekstiFI), url: clean(doc.LinkkiUrlFI) })) };
  }).sort((a, b) => b.date.localeCompare(a.date));

  const voteDates = Object.fromEntries(votes.map(vote => [vote.id, vote.date]));
  const datedBallots = ballots.map(ballot => ({ ...ballot, date: voteDates[ballot.voteId] || '' }));
  const members = deriveMembers(datedBallots, speeches);
  const sessions = Object.values(Object.groupBy(votes, vote => `${vote.year}-${vote.sessionNumber}`)).map(group => ({ id: `${group[0].year}-${group[0].sessionNumber}`, year: group[0].year, number: group[0].sessionNumber, date: group[0].date, title: `Täysistunto ${group[0].sessionNumber}/${group[0].year}`, voteIds: group.map(vote => vote.id) })).sort((a, b) => b.date.localeCompare(a.date));
  const legislation = Object.values(Object.groupBy(votes.filter(vote => vote.document), vote => vote.document)).map(group => ({ id: group[0].document, title: group[0].title, document: group[0].document, url: group[0].documentUrl, firstDate: group.at(-1).date, latestDate: group[0].date, stages: [...new Set(group.map(vote => vote.stage).filter(Boolean))], voteIds: group.map(vote => vote.id), amendmentCount: group.filter(vote => vote.isAmendment).length })).sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  const indexes = buildIndexes({ votes, ballots, speeches, members });
  const membersWithStats = members.map(member => ({ ...member, stats: indexes.members[member.id]?.stats || null }));
  const metadata = { generatedAt: new Date().toISOString(), source: API, startDate: START_DATE, counts: { votes: votes.length, ballots: ballots.length, speeches: speeches.length, members: members.length, parties: Object.keys(indexes.parties).length, sessions: sessions.length, legislation: legislation.length, amendments: votes.filter(vote => vote.isAmendment).length } };
  // Ballots dominate the dataset. Store them as positional tuples to keep the
  // static download practical: [voteId, mpId, party, choice].
  const packedBallots = ballots.map(ballot => [ballot.voteId, ballot.mpId, ballot.party, ballot.choice]);
  const data = { metadata, votes, ballots: packedBallots, speeches, members: membersWithStats, sessions, legislation, parties: Object.values(indexes.parties).sort((a, b) => b.stats.votes - a.stats.votes) };
  await mkdir(OUT, { recursive: true });
  await writeFile(new URL('parliament.json', OUT), `${JSON.stringify(data)}\n`);
  await writeFile(new URL('metadata.json', OUT), `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(JSON.stringify(metadata, null, 2));
}

sync().catch(async error => {
  console.error(error);
  try { await readFile(new URL('parliament.json', OUT)); console.warn('Keeping previously generated data.'); } catch {}
  process.exitCode = 1;
});
