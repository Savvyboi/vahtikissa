import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  VTV, businessId, candidateDatasets, cleanText, elections2027, expires2023,
  helsinkiDate, normalized, partyBusinessIds, partyDatasets, trackerRows
} from '../campaign-finance-data.js';

const root = new URL('../', import.meta.url);
const output = new URL('data/campaign-finance.json', root);
const partyStatements = VTV + '/en/frontpage/politicalpartyfunding/political-party-funding-disclosures/politicalpartysfinancialstatements';
const candidateFilings = VTV + '/fi/index/vaalirahoitus/ilmoituksetvaaleittain';
const cachedFile = (directory, name) => readFile(resolve(directory, name), 'utf8');

export function vtvLinks(html, base) {
  return [...new Set([...html.matchAll(/\bhref="([^"]+)"/giu)].map(match => {
    try { return new URL(match[1].replaceAll('&amp;', '&'), base); } catch { return null; }
  }).filter(url => url?.origin === VTV).map(url => url.href))];
}

// The candidate exports quote fields with apostrophes. Party exports use standard CSV quoting.
export function readVtvCsv(csv) {
  const text = csv.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n');
  const quote = text.startsWith("'") ? "'" : '"';
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index], next = text[index + 1];
    if (quoted) {
      if (char === quote && next === quote) {
        field += quote;
        index++;
      } else if (char === quote && (next === ';' || next === '\n' || next === undefined)) {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === quote && field === '') {
      quoted = true;
    } else if (char === ';' || char === '\n') {
      row.push(cleanText(field));
      field = '';
      if (char === '\n') {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('Unclosed quoted field in VTV CSV');
  if (row.length || field) rows.push([...row, cleanText(field)]);
  if (!rows.length) throw new Error('Empty VTV CSV');
  return rows;
}

const headerKey = value => normalized(value).normalize('NFD').replace(/\p{Mark}/gu, '');
const date = value => {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/u.exec(value);
  return match ? [match[3], match[2].padStart(2, '0'), match[1].padStart(2, '0')].join('-') : null;
};

function cents(value) {
  const formatted = String(value ?? '').replace(/&(?:nbsp|#160|#8239);|\s/gu, '').replace(',', '.');
  return /^-?\d+(?:\.\d{1,2})?$/u.test(formatted) ? Math.round(Number(formatted) * 100) : null;
}

const expenseKeys = ['press', 'radio', 'television', 'online', 'otherMedia', 'outdoor', 'print', 'design', 'events', 'fundraising', 'other'];
const fundingKeys = ['own', 'loans', 'individuals', 'companies', 'party', 'partyAssociations', 'other', 'transferred'];

export function parseCandidates(csv, elections, year, type) {
  const [header, ...rows] = readVtvCsv(csv);
  const keys = header.map(headerKey);
  const find = prefix => keys.findIndex(key => key.startsWith(prefix));
  const expenses = find('vaalikampanjan kulut yhteensa');
  const funding = find('vaalikampanjan rahoitus yhteensa');
  const expenseIndexes = ['sanoma-', 'radio', 'televisio', 'tietoverkot', 'muut viestintavalineet', 'ulkomainonta', 'vaalilehtien', 'mainonnan suunnittelu', 'vaalitilaisuudet', 'vastikeellisen tuen hankintakulut', 'muut kulut'].map(find);
  const fundingIndexes = fundingKeys.map((_, index) => find(`2.${index + 1} rahoitus sisaltaa`));
  const districts = new Map(elections.districts.map(row => [normalized(row.name.fi.replace(/^VP\d+\s*/u, '')), row.code.slice(0, 2)]));
  const resultById = new Map(elections.candidates.map(item => [item.id.slice(0, 2) + item.id.slice(-4), item]));
  if (keys[0] !== 'ehdokasnumero' || keys[1] !== 'etunimet' || keys[2] !== 'sukunimi' || !keys[4].startsWith('vaalipiiri') || keys[5] !== 'puolue' || expenses === -1 || funding === -1) {
    throw new Error(`Unexpected candidate CSV columns for ${year} ${type}`);
  }
  const records = new Map();
  for (const row of rows) {
    const [number, first, last, , district, sourceParty, filed, amended] = row;
    const districtId = districts.get(normalized(district));
    if (!districtId || !/^\d{1,4}$/u.test(number) || !first || !last || row.length !== header.length) {
      throw new Error(`Unrecognised or shifted candidate row in ${year} ${type}`);
    }
    const padded = number.padStart(4, '0');
    const key = districtId + padded;
    if (records.has(key)) throw new Error(`Duplicate candidate number and district in ${year} ${type}: ${key}`);
    const name = `${first} ${last}`;
    const result = year === 2023 ? resultById.get(key) : null;
    if (result && !sameCandidate(result.name, first, last)) throw new Error(`Result identity mismatch: ${key}`);
    const party = sourceParty.toUpperCase() === 'LIIK' ? 'LIIKE' : sourceParty.toUpperCase();
    records.set(key, {
      key, year, number: Number(number), name, first, last, district, districtId, party, filed: date(filed), amended: date(amended),
      expenses: cents(row[expenses]), funding: cents(row[funding]),
      expensesByType: Object.fromEntries(expenseKeys.map((key, index) => [key, cents(row[expenseIndexes[index]])])),
      fundingSources: Object.fromEntries(fundingKeys.map((key, index) => [key, cents(row[fundingIndexes[index]])])),
      resultId: result?.id ?? null, votes: result?.votes ?? null,
      source: `${candidateFilings}/eduskuntavaalit${year}/${districtId}/${padded}/${type === 'advance' ? 'ennakkoilmoitus' : 'vaalirahoitusilmoitus'}.html`
    });
  }
  return [...records.values()];
}

function nameTokens(value) {
  return normalized(value).replace(/["“”()]/gu, ' ').split(/\s+/u).filter(Boolean);
}

function sameCandidate(result, first, last) {
  const resultTokens = nameTokens(result);
  const lastTokens = nameTokens(last);
  return lastTokens.every((word, index) => resultTokens[index] === word)
    && resultTokens.slice(lastTokens.length).some(word => nameTokens(first).includes(word));
}

export function parseCandidateDonations(csv, candidates) {
  const [header, ...rows] = readVtvCsv(csv);
  if (headerKey(header[1]) !== 'tukijan y-tunnus/yhdistysrekisterinumero jos on' || headerKey(header[8]) !== 'tuen maara') {
    throw new Error('Unexpected VTV candidate donation CSV columns');
  }
  const byName = new Map(candidates.map(candidate => [normalized([candidate.first, candidate.last, candidate.district, candidate.party].join('|')), candidate.key]));
  const donations = [];
  for (const row of rows) {
    if (row.length !== 13) continue;
    const [organisation, rawId, first, last, , category, , , amount, recipientFirst, recipientLast, district, sourceParty] = row;
    const person = [first, last].filter(Boolean).join(' ');
    const name = person || organisation;
    const value = cents(amount);
    if (!name || !value || !/^2\.[3-8]$/u.test(category)) continue;
    const id = person || category === '2.3' ? '' : businessId(rawId);
    const party = sourceParty.toUpperCase() === 'LIIK' ? 'LIIKE' : sourceParty.toUpperCase();
    const candidateKey = byName.get(normalized([recipientFirst, recipientLast, district, party].join('|')));
    if (candidateKey) donations.push({ name, candidateKey, amount: value, transferred: category === '2.8', ...(id && { id }) });
  }
  return donations;
}

export function parsePartyReceipts(csv, year, url) {
  const [header, ...rows] = readVtvCsv(csv);
  if (header.length !== 17 || !headerKey(header[3]).includes('ilmoittajan rekisteritunnus') || !headerKey(header[8]).includes('tuen maara')) {
    throw new Error(`Unexpected party CSV columns for ${year}`);
  }
  const totals = new Map();
  for (const row of rows) {
    const [, , recipient, id, , supportYear, organisation, , orgAmount, , givenName, surname, , personAmount] = row;
    // Export rows often repeat the contribution amount in both amount columns.
    let amount = cents(organisation ? orgAmount : personAmount);
    const extra = row.length - header.length;
    // A bare semicolon in an organisation name can shift its ID and amount to the right.
    if (organisation && amount === null && extra > 0 && businessId(row[7 + extra])) {
      amount = cents(row[8 + extra]);
    }
    if (!recipient || supportYear !== year || !Number.isFinite(amount) || !(organisation || givenName || surname)) continue;
    const key = id || normalized(recipient);
    const current = totals.get(key) ?? { id, recipient, year: Number(year), amount: 0, count: 0, source: url };
    current.amount += amount;
    current.count++;
    totals.set(key, current);
  }
  return [...totals.values()];
}

export function parsePartyStatement(html, id, party, year, url) {
  const summary = html.split('id="rahoituksen-yhteenveto"')[1]?.split('</table>')[0];
  const identity = html.split('id="ilmoittajan-tiedot"')[1]?.split('</table>')[0];
  if (!summary || !identity?.includes(`>${id}</td>`)) throw new Error(`Unrecognised VTV party statement for ${party}`);
  const amounts = [...summary.matchAll(/<td\b[^>]*class="[^"]*\brahasumma\b[^"]*"[^>]*>([^<]*)<\/td>/gu)].map(match => cents(match[1]));
  if (amounts.length < 2 || !amounts.slice(0, 2).every(Number.isFinite)) throw new Error(`Missing statement totals for ${party}`);
  return { id, party, year, expenses: amounts[0], funding: amounts[1], source: url };
}

async function fetchVtv(url, { soft404 = false } = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (response.status === 404 && soft404) return null;
  if (!response.ok) throw new Error(`VTV returned HTTP ${response.status} for ${url}`);
  return response.text();
}

async function collect(items, load) {
  const records = [];
  for (let index = 0; index < items.length; index += 4) {
    records.push(...await Promise.all(items.slice(index, index + 4).map(load)));
  }
  return records.filter(Boolean);
}

function candidateFile(links, year, kind, prefix = '') {
  return links.find(url => new URL(url).pathname.endsWith(`/${prefix}E_${kind}_eduskuntavaalit${year}.csv`));
}

async function loadCandidateData(links, elections, get) {
  const candidateFileUrl = candidateFile(links, 2023, 'VI');
  const donorFileUrl = candidateFile(links, 2023, 'VI', 'RAHOITUSRIVIT_');
  if (!candidateFileUrl || !donorFileUrl) throw new Error('VTV candidate or donor export is missing.');
  const candidates = parseCandidates(await get(candidateFileUrl, 'candidate'), elections, 2023, 'final');
  if (candidates.length < 273 || candidates.filter(row => row.resultId).length !== elections.candidates.length) {
    throw new Error('The 2023 VTV snapshot does not cover the 273 expected disclosures and all elected results.');
  }
  const contributions = parseCandidateDonations(await get(donorFileUrl, 'donors'), candidates);
  if (!contributions.length) throw new Error('VTV candidate donor data is unavailable.');
  return { candidates, contributions };
}

async function loadTrackerFile(links, elections, get, type) {
  const url = candidateFile(links, 2027, type === 'advance' ? 'EI' : 'VI');
  return url ? parseCandidates(await get(url, '2027-' + type), elections, 2027, type) : null;
}

async function loadPartyReceipts(get, prior, track) {
  const links = vtvLinks(await get(partyDatasets, 'parties'), partyDatasets);
  const files = links.filter(url => /\/\d{4}_ajantasaiset_ilmoitukset\.csv$/u.test(new URL(url).pathname));
  if (!files.length) throw new Error('No VTV annual party contributions CSVs found');
  const byYear = new Map(files.map(url => [/\/(\d{4})_ajantasaiset_ilmoitukset/u.exec(url)[1], url]));
  for (const year of prior.years || []) if (!byYear.has(String(year))) byYear.set(String(year), null);
  const years = await collect([...byYear], async ([year, url]) => {
    const old = prior.receipts?.filter(row => row.year === Number(year));
    const totals = await track('receipts-' + year, async () => {
      if (!url) throw new Error('Year is missing from the VTV dataset index.');
      const rows = parsePartyReceipts(await get(url, 'party' + year), year, url);
      if (!rows.length && old?.length) throw new Error('Export contains no valid contribution rows.');
      return rows;
    }, prior.years?.includes(Number(year)) ? old : null);
    return totals && { year: Number(year), totals };
  });
  return { years: years.map(row => row.year).sort((a, b) => b - a), receipts: years.flatMap(row => row.totals) };
}

async function loadPartyStatements(get, prior, track) {
  return collect(Object.entries(partyBusinessIds), async ([party, id]) => {
    const url = `${partyStatements}/2023/${id}/P_VI_EV2023.html`;
    return track('statement-' + party, async () => {
      const html = await get(url, 'statement-' + party, { soft404: true });
      return html ? parsePartyStatement(html, id, party, 2023, url) : null;
    }, prior.statements?.find(row => row.party === party));
  });
}

async function previousSnapshot(file, publishedURL) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!publishedURL) return {};
  try {
    const response = await fetch(publishedURL, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const snapshot = await response.json();
    if (!Array.isArray(snapshot.years) || !Array.isArray(snapshot.receipts) || !Array.isArray(snapshot.statements)) {
      throw new Error('Unexpected campaign finance snapshot');
    }
    return snapshot;
  } catch (error) {
    console.warn('Previous published campaign finance snapshot unavailable: ' + error.message);
    return {};
  }
}

export async function syncCampaignFinance({
  directory, now = new Date(), publishedURL, outputFile = output,
  get = (url, name, options) => directory ? cachedFile(directory, name) : fetchVtv(url, options)
} = {}) {
  const today = helsinkiDate(now), checkedAt = now.toISOString();
  const prior = await previousSnapshot(outputFile, publishedURL);
  const sources = {};
  const track = async (key, load, fallback) => {
    const updatedAt = fallback == null ? null : prior.sources?.[key]?.updatedAt || prior.generatedAt;
    try {
      const data = await load();
      sources[key] = data == null
        ? { checkedAt, updatedAt, state: fallback == null ? 'pending' : 'retained' }
        : { checkedAt, updatedAt: checkedAt, state: 'current' };
      return data ?? fallback;
    } catch (error) {
      console.warn(key + ': ' + error.message);
      sources[key] = { checkedAt, updatedAt, state: fallback == null ? 'unavailable' : 'retained' };
      return fallback;
    }
  };
  const elections = JSON.parse(await readFile(new URL('data/elections-2023.json', root), 'utf8'));
  const inTrackerPeriod = today >= elections2027.advanceStart && today < elections2027.expiresFrom;
  const links = today < expires2023 || inTrackerPeriod
    ? Promise.resolve().then(() => get(candidateDatasets, 'index')).then(html => vtvLinks(html, candidateDatasets))
    : Promise.resolve([]);
  const [candidateData, parties, statements, advance, final] = await Promise.all([
    today < expires2023 ? track('candidates', async () => loadCandidateData(await links, elections, get),
      prior.candidates?.length ? { candidates: prior.candidates, contributions: prior.contributions } : null) : null,
    track('receipts-index', () => loadPartyReceipts(get, prior, track),
      prior.years?.length ? { years: prior.years, receipts: prior.receipts } : null),
    loadPartyStatements(get, prior, track),
    inTrackerPeriod ? track('advance', async () => loadTrackerFile(await links, elections, get, 'advance'), prior.tracker?.advances) : null,
    inTrackerPeriod ? track('final', async () => loadTrackerFile(await links, elections, get, 'final'), prior.tracker?.finals) : null
  ]);
  const tracker = trackerRows(advance, final, today);
  const snapshot = {
    generatedAt: checkedAt, sources: Object.fromEntries(Object.entries(sources).sort(([a], [b]) => a.localeCompare(b))),
    candidates: [], contributions: [], years: [], receipts: [],
    ...candidateData, ...parties, statements,
    tracker: {
      advances: tracker.flatMap(row => row.advance ? [row.advance] : []),
      finals: tracker.flatMap(row => row.final ? [row.final] : [])
    }
  };
  const temp = new URL(outputFile.href + '.' + process.pid + '.tmp');
  try {
    await writeFile(temp, JSON.stringify(snapshot) + '\n');
    await rename(temp, outputFile);
  } finally {
    await rm(temp, { force: true });
  }
  console.log(`Campaign finance: ${snapshot.candidates?.length ?? 0} final 2023 filings, ${snapshot.contributions?.length ?? 0} named contribution rows, ${snapshot.years?.length ?? 0} annual party datasets and ${snapshot.statements.length} party statements.`);
  return snapshot;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const directory = process.argv.find(arg => arg.startsWith('--from='))?.slice('--from='.length);
  syncCampaignFinance({ directory, publishedURL: process.env.PUBLISHED_FINANCE_URL })
    .catch(error => { console.error(error.message, fileURLToPath(output)); process.exitCode = 1; });
}
