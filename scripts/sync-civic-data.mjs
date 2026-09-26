import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { jsonStatRows, numberValue, parseCSVLine, parseGiftDisclosure } from '../civic-utils.js';
import { normalizeParty } from './lib.mjs';

const OUT = new URL('../data/', import.meta.url);
const BUDGET_INDEX = 'https://api.tutkihallintoa.fi/valtiontalous/v1/budjettitalousvuosikuukausi';
const PX = 'https://pxdata.stat.fi/PxWeb/api/v1';
const PARLIAMENT = 'https://api.eduskunta.fi/api/v1/kansanedustajat';
const TRANSPARENCY = 'https://public.api.avoimuusrekisteri.fi';
const START_YEAR = 2020;
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const clean = value => String(value ?? '').trim();

const MAIN_CLASS_SV = {
  '11': 'Skatter och inkomster av skattenatur',
  '12': 'Inkomster av blandad natur',
  '13': 'Ränteinkomster, intäktsföring av vinst och försäljningsinkomster',
  '15': 'Lån',
  '21': 'Riksdagen',
  '22': 'Republikens president',
  '23': 'Statsrådets kanslis förvaltningsområde',
  '24': 'Utrikesministeriets förvaltningsområde',
  '25': 'Justitieministeriets förvaltningsområde',
  '26': 'Inrikesministeriets förvaltningsområde',
  '27': 'Försvarsministeriets förvaltningsområde',
  '28': 'Finansministeriets förvaltningsområde',
  '29': 'Undervisnings- och kulturministeriets förvaltningsområde',
  '30': 'Jord- och skogsbruksministeriets förvaltningsområde',
  '31': 'Kommunikationsministeriets förvaltningsområde',
  '32': 'Arbets- och näringsministeriets förvaltningsområde',
  '33': 'Social- och hälsovårdsministeriets förvaltningsområde',
  '35': 'Miljöministeriets förvaltningsområde',
  '36': 'Räntor på statsskulden'
};

async function request(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(options.timeout || 180_000),
        headers: { accept: 'application/json, text/csv;q=0.9, */*;q=0.8', 'user-agent': 'Vahtikissa/1.0 (+open civic data)', ...options.headers }
      });
      if (response.ok) return response;
      const message = `${response.status} ${url}: ${(await response.text()).slice(0, 300)}`;
      if (response.status < 500 && response.status !== 429) throw new Error(message);
      lastError = new Error(message);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) throw error;
    }
    await delay(700 * 2 ** (attempt - 1));
  }
  throw lastError;
}

async function json(url, options = {}) {
  return request(url, options).then(response => response.json());
}

function addBudgetValue(map, code, name, row) {
  if (!code) return;
  const entry = map.get(code) || { code, name: { fi: clean(name), sv: '' }, budget: 0, original: 0, supplemental: 0, actual: 0 };
  if (!entry.name.fi && name) entry.name.fi = clean(name);
  entry.original += numberValue(row.Alkuperäinen_talousarvio);
  entry.supplemental += numberValue(row.Lisätalousarvio);
  entry.budget += numberValue(row.Voimassaoleva_talousarvio);
  entry.actual += numberValue(row.Nettokertymä_ko_vuodelta);
  map.set(code, entry);
}

function finishBudgetItems(map, mainCode = '') {
  return [...map.values()].map(item => ({
    ...item,
    name: { ...item.name, sv: item.name.sv || (item.code.length === 2 ? MAIN_CLASS_SV[item.code] : '') },
    type: Number(item.code.slice(0, 2) || mainCode) < 20 ? 'income' : 'expense',
    original: Math.round(Math.abs(item.original)),
    supplemental: Math.round(item.supplemental),
    budget: Math.round(Math.abs(item.budget)),
    actual: Math.round(Math.abs(item.actual))
  })).filter(item => item.budget || item.actual).sort((a, b) => b.budget - a.budget || a.code.localeCompare(b.code));
}

async function aggregateBudgetYear(year, urls) {
  const mainClasses = new Map();
  const chapters = new Map();
  const moments = new Map();
  let latestMonth = 0;
  for (const url of urls.sort((a, b) => Number(a.match(/_(\d+)\.csv$/)?.[1]) - Number(b.match(/_(\d+)\.csv$/)?.[1]))) {
    const month = Number(url.match(/_(\d+)\.csv$/)?.[1]) || 0;
    latestMonth = Math.max(latestMonth, month);
    process.stdout.write(`  ${year}/${month}\r`);
    const text = await request(url, { timeout: 240_000 }).then(response => response.text());
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
    const headers = parseCSVLine(lines.shift() || '');
    for (const line of lines) {
      if (!line) continue;
      const values = parseCSVLine(line);
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
      const mainCode = clean(row.PaaluokkaOsasto_TunnusP).replace(/\D/g, '').slice(0, 2);
      const chapterCode = clean(row.Luku_TunnusP).replace(/\D/g, '').slice(0, 4);
      const momentCode = clean(row.Momentti_TunnusP).replace(/\D/g, '').slice(0, 6);
      addBudgetValue(mainClasses, mainCode, row.PaaluokkaOsasto_sNimi, row);
      addBudgetValue(chapters, chapterCode, row.Luku_sNimi, row);
      addBudgetValue(moments, momentCode, row.Momentti_sNimi, row);
    }
  }
  process.stdout.write(' '.repeat(30) + '\r');
  const mains = finishBudgetItems(mainClasses);
  const chapterItems = finishBudgetItems(chapters);
  const momentItems = finishBudgetItems(moments);
  for (const main of mains) main.children = chapterItems.filter(chapter => chapter.code.startsWith(main.code));
  for (const chapter of chapterItems) chapter.children = momentItems.filter(moment => moment.code.startsWith(chapter.code));
  return {
    year,
    latestMonth,
    income: mains.filter(item => item.type === 'income'),
    expense: mains.filter(item => item.type === 'expense')
  };
}

async function readExistingBudget() {
  try { return JSON.parse(await readFile(new URL('budget.json', OUT), 'utf8')); }
  catch { return { years: [] }; }
}

export async function syncBudget({ all = false } = {}) {
  console.log('Syncing State Treasury budget data…');
  const fileUrls = await json(BUDGET_INDEX);
  const yearsAvailable = [...new Set(fileUrls.map(url => Number(url.match(/budjettitalous\/(\d{4})\//)?.[1])).filter(year => year >= START_YEAR))].sort();
  const existing = await readExistingBudget();
  const latestYear = yearsAvailable.at(-1);
  const requestedYears = all || !existing.years?.length ? yearsAvailable : yearsAvailable.filter(year => year >= latestYear - (new Date().getMonth() < 2 ? 1 : 0));
  const replacements = [];
  for (const year of requestedYears) {
    const urls = fileUrls.filter(url => url.includes(`/budjettitalous/${year}/`));
    replacements.push(await aggregateBudgetYear(year, urls));
  }
  const replacementYears = new Set(replacements.map(item => item.year));
  const years = [...(existing.years || []).filter(item => !replacementYears.has(item.year)), ...replacements].sort((a, b) => a.year - b.year);
  const output = {
    metadata: { generatedAt: new Date().toISOString(), source: BUDGET_INDEX, startYear: START_YEAR, license: 'CC BY 4.0' },
    years
  };
  await writeFile(new URL('budget.json', OUT), `${JSON.stringify(output)}\n`);
  console.log(`Budget snapshot: ${years.map(item => item.year).join(', ')}`);
  return output;
}

function pxSelection(code, values) {
  return { code, selection: { filter: 'item', values } };
}

async function pxPost(path, query) {
  return json(`${PX}/fi/StatFin/evaa/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, response: { format: 'json-stat2' } })
  });
}

function variableMap(metadata, variableCode, otherMetadata = null) {
  const variable = metadata.variables.find(item => item.code === variableCode);
  const other = otherMetadata?.variables.find(item => item.code === variableCode);
  return new Map(variable.values.map((code, index) => [code, { fi: variable.valueTexts[index], sv: other?.valueTexts[index] || variable.valueTexts[index] }]));
}

export async function syncElection() {
  console.log('Syncing Statistics Finland election data…');
  const paths = ['13sw.px', '13t3.px', '13sv.px'];
  const [partyFi, candidateFi, turnoutFi, partySv, candidateSv, turnoutSv] = await Promise.all([
    ...paths.map(path => json(`${PX}/fi/StatFin/evaa/${path}`)),
    ...paths.map(path => json(`${PX}/sv/StatFin/evaa/${path}`))
  ]);
  const partyCode = partyFi.variables.find(item => item.text === 'Puolue').code;
  const locationCode = partyFi.variables.find(item => item.text.includes('Vaalipiiri')).code;
  const partyLabels = variableMap(partyFi, partyCode, partySv);
  const locationLabels = variableMap(partyFi, locationCode, partySv);
  const locationValues = [...locationLabels.keys()].filter(code => code === 'SSS' || /^\d{2}0000$/.test(code));
  const partyDataset = await pxPost('13sw.px', [
    pxSelection('timeperiod_y', ['2023']), pxSelection('sukupuoli_9_20180101', ['SSS']),
    pxSelection(partyCode, [...partyLabels.keys()]), pxSelection(locationCode, locationValues),
    pxSelection('contentscode', ['evaa_aanet', 'evaa_osuus_aanista'])
  ]);
  const partyCells = jsonStatRows(partyDataset);
  const resultMap = new Map();
  for (const cell of partyCells) {
    const code = cell[partyCode];
    if (code === 'SSS' || cell.value == null) continue;
    const key = `${cell[locationCode]}:${code}`;
    const result = resultMap.get(key) || { locationCode: cell[locationCode], partyCode: code, party: partyLabels.get(code), votes: 0, share: 0 };
    if (cell.contentscode === 'evaa_aanet') result.votes = Number(cell.value) || 0;
    else result.share = Number(cell.value) || 0;
    resultMap.set(key, result);
  }

  const candidateCode = candidateFi.variables.find(item => item.text === 'Ehdokas').code;
  const candidateLabels = variableMap(candidateFi, candidateCode, candidateSv);
  const candidateDataset = await pxPost('13t3.px', [
    pxSelection('timeperiod_y', ['2023']), pxSelection(candidateCode, [...candidateLabels.keys()]),
    pxSelection('vaalitiedot_21_20170101', ['1']), pxSelection('contentscode', ['evaa_aanet', 'vluku'])
  ]);
  const candidateCells = jsonStatRows(candidateDataset);
  const candidates = new Map();
  for (const cell of candidateCells) {
    if (cell.value == null) continue;
    const id = cell[candidateCode];
    const label = candidateLabels.get(id) || { fi: id, sv: id };
    const fiParts = label.fi.split(' / ');
    const svParts = label.sv.split(' / ');
    const party = id.slice(2, 4);
    const district = `${id.slice(0, 2)}0000`;
    const candidate = candidates.get(id) || {
      id, name: fiParts[0], partyCode: party, party: partyLabels.get(party) || { fi: fiParts[1], sv: svParts[1] },
      districtCode: district, district: locationLabels.get(district) || { fi: fiParts[2], sv: svParts[2] }, votes: 0, comparison: 0
    };
    if (cell.contentscode === 'evaa_aanet') candidate.votes = Number(cell.value) || 0;
    else candidate.comparison = Number(cell.value) || 0;
    candidates.set(id, candidate);
  }
  const elected = [...candidates.values()].filter(candidate => candidate.votes > 0).sort((a, b) => b.votes - a.votes);
  const seatCounts = new Map();
  elected.forEach(candidate => seatCounts.set(candidate.partyCode, (seatCounts.get(candidate.partyCode) || 0) + 1));

  const turnoutLocationCode = turnoutFi.variables.find(item => item.text.includes('Vaalipiiri')).code;
  const turnoutDataset = await pxPost('13sv.px', [
    pxSelection('timeperiod_y', ['2023']), pxSelection('sukupuoli_9_20180101', ['SSS']),
    pxSelection(turnoutLocationCode, ['SSS']), pxSelection('contentscode', ['evaa_ao', 'evaa_aanest', 'evaa_aanpros', 'evaa_hylatyt'])
  ]);
  const turnout = {};
  for (const cell of jsonStatRows(turnoutDataset)) turnout[cell.contentscode] = Number(cell.value) || 0;
  const districts = [...new Set([...resultMap.values()].filter(result => result.locationCode !== 'SSS' && result.votes).map(result => result.locationCode))]
    .map(code => ({ code, name: locationLabels.get(code) })).sort((a, b) => a.code.localeCompare(b.code));
  const parties = [...new Set([...resultMap.values()].filter(result => result.locationCode === 'SSS' && result.votes).map(result => result.partyCode))]
    .map(code => {
      const national = resultMap.get(`SSS:${code}`);
      return { code, name: partyLabels.get(code), votes: national.votes, share: national.share, seats: seatCounts.get(code) || 0 };
    }).sort((a, b) => b.votes - a.votes);
  const output = {
    metadata: { generatedAt: new Date().toISOString(), year: 2023, source: `${PX}/fi/StatFin/evaa/`, license: 'CC BY 4.0' },
    summary: { eligible: turnout.evaa_ao, voters: turnout.evaa_aanest, turnout: turnout.evaa_aanpros, rejected: turnout.evaa_hylatyt, seats: elected.length },
    parties, districts,
    districtResults: [...resultMap.values()].filter(result => result.locationCode !== 'SSS' && result.votes),
    candidates: elected
  };
  await writeFile(new URL('elections-2023.json', OUT), `${JSON.stringify(output)}\n`);
  console.log(`Election snapshot: ${parties.length} parties, ${districts.length} districts, ${elected.length} elected candidates.`);
  return output;
}

function isParliamentTarget(target) {
  const fi = target?.fi || {};
  return /eduskun|kansanedustaja/i.test([fi.organization, fi.department, fi.unit, fi.title].join(' '));
}

function targetKind(target) {
  const fi = target?.fi || {};
  return /kansanedustaja/i.test(fi.title) && clean(fi.name) !== '-' ? 'mp' : /avustaja/i.test(fi.title) ? 'assistant' : 'parliament';
}

function localizedTarget(target, language) {
  const value = target?.[language] || target?.fi || {};
  return { organization: clean(value.organization).replace(/^-$/, ''), department: clean(value.department).replace(/^-$/, ''), unit: clean(value.unit).replace(/^-$/, ''), title: clean(value.title).replace(/^-$/, ''), name: clean(value.name).replace(/^-$/, '') };
}

export async function syncInfluence() {
  console.log('Syncing Parliament gifts and Transparency Register lobbying data…');
  const [memberResponse, terms, targets] = await Promise.all([
    json(PARLIAMENT), json(`${TRANSPARENCY}/open-data-term`), json(`${TRANSPARENCY}/open-data-target/targets`, { timeout: 240_000 })
  ]);
  const members = memberResponse.kansanedustajat || [];
  const gifts = [];
  for (const member of members) {
    const fi = member.sidonnaisuudet?.fi || [];
    const sv = member.sidonnaisuudet?.sv || [];
    for (const disclosure of fi.filter(item => item.ilmoitusTyyppi === 'lahjailmoitus')) {
      const translated = sv.find(item => item.ilmoitusTyyppi === 'lahjailmoitus' && item.jarjestys === disclosure.jarjestys && item.vuosi === disclosure.vuosi);
      const parsed = parseGiftDisclosure(disclosure.sidonta);
      const translatedParsed = parseGiftDisclosure(translated?.sidonta || disclosure.sidonta);
      gifts.push({
        id: `${member.henkilonro}-${disclosure.vuosi}-${disclosure.jarjestys}`, mpId: clean(member.henkilonro),
        mpName: `${clean(member.kutsumanimi || member.etunimet)} ${clean(member.sukunimi)}`.trim(),
        party: normalizeParty(clean(member.viimeisinEduskuntaryhma?.tunnus).split('~')[0].replace(/\d+$/, '')), year: Number(disclosure.vuosi),
        reported: parsed.reported, donor: parsed.donor, description: parsed.description, descriptionSv: translatedParsed.description,
        amount: parsed.amount, used: parsed.used, raw: { fi: parsed.raw, sv: translatedParsed.raw }
      });
    }
  }
  gifts.sort((a, b) => b.reported.split('.').reverse().join('-').localeCompare(a.reported.split('.').reverse().join('-')) || b.amount - a.amount);

  const closedTerms = terms.filter(term => term.status === 'closed');
  const notifications = (await Promise.all(closedTerms.map(term => json(`${TRANSPARENCY}/open-data-activity-notification/term/${term.id}`, { timeout: 300_000 })))).flat();
  const targetById = new Map(targets.map(target => [target.id, target]));
  const parliamentTargets = new Map();
  const lobbying = [];
  let contactCount = 0;
  for (const notification of notifications) {
    for (const topic of notification.topics || []) {
      const topicText = clean(topic.contactTopicOther || topic.contactTopicProject?.title || topic.title);
      const contacts = (topic.contactedTargets || []).map(contact => ({ contact, target: targetById.get(contact.contactedTargetId) }))
        .filter(({ target }) => isParliamentTarget(target));
      if (!contacts.length) continue;
      const term = notification.term || terms.find(item => item.id === notification.termId) || {};
      const targetIds = [];
      for (const { contact, target } of contacts) {
        targetIds.push(contact.contactedTargetId);
        if (!parliamentTargets.has(contact.contactedTargetId)) parliamentTargets.set(contact.contactedTargetId, {
          id: contact.contactedTargetId, kind: targetKind(target),
          fi: localizedTarget(target, 'fi'), sv: localizedTarget(target, 'sv')
        });
      }
      contactCount += contacts.length;
      lobbying.push({
        id: `${notification.id}-${topic.id}`,
        notificationId: notification.id, diaryNumber: notification.diaryNumber, actor: clean(notification.companyName),
        companyId: clean(notification.companyId || notification.otherCompanyId), industry: clean(notification.mainIndustry),
        activityType: topic.activityType, topic: topicText,
        methods: [...new Set(contacts.flatMap(({ contact }) => contact.contactMethods || []))],
        otherMethod: [...new Set(contacts.map(({ contact }) => clean(contact.otherContactMethod)).filter(Boolean))].join(', '),
        targetIds: [...new Set(targetIds)],
        targetKinds: [...new Set(targetIds.map(id => parliamentTargets.get(id).kind))],
        periodYear: Number(clean(term.reportingStartDate).slice(0, 4)), period: { start: clean(term.reportingStartDate).slice(0, 10), end: clean(term.reportingEndDate).slice(0, 10) },
        reported: clean(notification.activityNotificationDate), customer: clean(topic.customerCompanyName)
      });
    }
  }
  lobbying.sort((a, b) => b.reported.localeCompare(a.reported) || a.actor.localeCompare(b.actor, 'fi'));
  const output = {
    metadata: { generatedAt: new Date().toISOString(), parliamentSource: PARLIAMENT, transparencySource: `${TRANSPARENCY}/open-data-activity-notification`, license: 'CC BY 4.0' },
    gifts, targets: [...parliamentTargets.values()], lobbying,
    counts: { gifts: gifts.length, giftValue: Math.round(gifts.reduce((sum, gift) => sum + gift.amount, 0)), lobbying: contactCount, lobbyingTopics: lobbying.length, actors: new Set(lobbying.map(item => item.actor)).size }
  };
  await writeFile(new URL('influence.json', OUT), `${JSON.stringify(output)}\n`);
  console.log(`Influence snapshot: ${gifts.length} gifts and ${contactCount} Parliament-related declared contacts in ${lobbying.length} topics.`);
  return output;
}

export async function syncCivicData(options = {}) {
  await syncBudget(options);
  await syncElection();
  await syncInfluence();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncCivicData({ all: process.argv.includes('--all') }).catch(error => { console.error(error); process.exitCode = 1; });
}
