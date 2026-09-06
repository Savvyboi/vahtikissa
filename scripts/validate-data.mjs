import { readFile } from 'node:fs/promises';

const path = new URL('../data/parliament.json', import.meta.url);
const speechPath = new URL('../data/speech-texts.json', import.meta.url);
let data;
let speechTexts;
try {
  [data, speechTexts] = await Promise.all([readFile(path, 'utf8'), readFile(speechPath, 'utf8')]).then(files => files.map(JSON.parse));
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
if (Object.keys(speechTexts).length !== data.speeches.length || data.speeches.some(speech => !(speech.id in speechTexts))) throw new Error('Full speech text collection does not match speech metadata');
if (!Object.values(speechTexts).some(text => text.length > 1200)) throw new Error('Full speech texts are missing');
if (!data.speeches.some(speech => speech.agendaSv)) throw new Error('Swedish speech metadata is missing');
if (!data.legislation.some(matter => matter.titleSv && matter.stagesSv?.length)) throw new Error('Swedish parliamentary matter metadata is missing');
console.log(`Validated ${data.votes.length} votes, ${data.ballots.length} ballots, ${data.speeches.length} complete speeches and ${data.legislation.length} bilingual matters.`);
