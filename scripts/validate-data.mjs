import { readFile } from 'node:fs/promises';

const path = new URL('../data/parliament.json', import.meta.url);
let data;
let speechTextChunks;
let speechSearchIndex;
let speechAnalytics;
let committeeIndex;
try {
  data = JSON.parse(await readFile(path, 'utf8'));
  const chunkCount = Math.max(...data.speeches.map(speech => speech.textChunk)) + 1;
  speechTextChunks = await Promise.all(Array.from({ length: chunkCount }, (_, index) => readFile(new URL(`../data/speech-texts-${index}.json`, import.meta.url), 'utf8').then(JSON.parse)));
  speechSearchIndex = JSON.parse(await readFile(new URL('../data/speech-search.json', import.meta.url), 'utf8'));
  speechAnalytics = JSON.parse(await readFile(new URL('../data/speech-analytics.json', import.meta.url), 'utf8'));
  committeeIndex = JSON.parse(await readFile(new URL('../data/committee-index.json', import.meta.url), 'utf8'));
} catch (error) {
  console.error(`Invalid or missing generated data: ${error.message}`);
  process.exit(1);
}
for (const key of ['votes', 'ballots', 'speeches', 'members', 'sessions', 'legislation', 'parties']) {
  if (!Array.isArray(data[key])) throw new Error(`data.${key} must be an array`);
}
if (data.metadata?.startDate !== '2023-04-02') throw new Error('Unexpected data start date');
if (data.votes.some(vote => String(vote.date).slice(0, 10) < data.metadata.startDate)) throw new Error('Vote before configured start date');
if (data.metadata.counts.votes !== data.votes.length || data.metadata.counts.ballots !== data.ballots.length) throw new Error('Metadata counts do not match collections');
const speechTexts = Object.assign({}, ...speechTextChunks);
if (Object.keys(speechTexts).length !== data.speeches.length || data.speeches.some(speech => !(speech.id in speechTexts))) throw new Error('Full speech text collection does not match speech metadata');
if (!Object.values(speechTexts).some(text => text.length > 1200)) throw new Error('Full speech texts are missing');
if (!Array.isArray(speechSearchIndex) || speechSearchIndex.length !== 2 || !Array.isArray(speechSearchIndex[0]) || !Array.isArray(speechSearchIndex[1]) || speechSearchIndex[1].length !== data.speeches.length) throw new Error('Speech search index does not match speech metadata');
if (!speechAnalytics.topics?.all?.members?.length || !speechAnalytics.topics?.all?.parties?.length || !Object.keys(speechAnalytics.topics).includes('economy')) throw new Error('Speech analytics are missing or incomplete');
if (!committeeIndex.matters || !Object.values(committeeIndex.matters).some(committees => Array.isArray(committees) && committees.some(item => item.id && item.name))) throw new Error('Committee index is missing or incomplete');
if (!data.speeches.some(speech => speech.agendaSv)) throw new Error('Swedish speech metadata is missing');
if (!data.legislation.some(matter => matter.titleSv && matter.stagesSv?.length)) throw new Error('Swedish parliamentary matter metadata is missing');
const [budget, election, influence] = await Promise.all([
  readFile(new URL('../data/budget.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/elections-2023.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../data/influence.json', import.meta.url), 'utf8').then(JSON.parse)
]);
if (!Array.isArray(budget.years) || !budget.years.some(item => item.year === 2020) || budget.years.some(item => !item.income?.length || !item.expense?.length)) throw new Error('Budget data must contain complete annual income and expense views from 2020');
if (!budget.years.some(item => item.expense.some(group => group.name?.sv))) throw new Error('Swedish budget headings are missing');
if (election.metadata?.year !== 2023 || election.summary?.seats !== 200 || election.candidates?.length !== 200) throw new Error('The 2023 election data must contain all 200 elected candidates');
if (!election.parties?.some(item => item.name?.fi && item.name?.sv) || !election.districts?.some(item => item.name?.fi && item.name?.sv)) throw new Error('Bilingual election labels are missing');
if (!Array.isArray(influence.gifts) || !influence.gifts.some(item => item.donor && item.mpName) || !Array.isArray(influence.interests) || !influence.interests.some(item => item.mpName && item.category && item.description) || !Array.isArray(influence.targets) || !influence.targets.some(item => item.fi && item.sv) || !Array.isArray(influence.lobbying) || !influence.lobbying.some(item => item.targetIds?.length)) throw new Error('Interest, gift or lobbying data is missing');
console.log(`Validated ${data.votes.length} votes, ${data.ballots.length} ballots, ${data.speeches.length} complete speeches, ${Object.keys(committeeIndex.matters).length} committee assignments, ${budget.years.length} budgets, ${election.candidates.length} elected candidates, ${influence.interests.length} interest/income declarations, ${influence.gifts.length} gifts and ${influence.counts.lobbying} lobbying contacts in ${influence.lobbying.length} topics.`);

const programmes = JSON.parse(await readFile(new URL('../data/programmes.json', import.meta.url), 'utf8'));
if (!programmes.metadata?.generatedAt || !programmes.parties?.length || programmes.parties.some(party => !party.seats || !party.programmes?.length || party.programmes.some(p => !/^https:\/\/www\.fsd\.tuni\.fi\/pohtiva\/ohjelmalistat\/[A-Z]+\/\d+$/.test(p.url) || !p.title || !p.year || !['FI','SV','EN'].includes(p.language)))) throw new Error('Invalid parliamentary party programmes');
console.log('Validated '+programmes.parties.length+' parliamentary programme listings.');
