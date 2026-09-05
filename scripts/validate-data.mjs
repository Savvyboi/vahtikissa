import { readFile } from 'node:fs/promises';

const path = new URL('../data/parliament.json', import.meta.url);
let data;
try {
  data = JSON.parse(await readFile(path, 'utf8'));
} catch (error) {
  console.error(`Invalid or missing ${path.pathname}: ${error.message}`);
  process.exit(1);
}
for (const key of ['votes', 'ballots', 'speeches', 'members', 'sessions', 'legislation', 'parties']) {
  if (!Array.isArray(data[key])) throw new Error(`data.${key} must be an array`);
}
if (data.metadata?.startDate !== '2023-04-02') throw new Error('Unexpected data start date');
if (data.votes.some(vote => String(vote.date).slice(0, 10) < data.metadata.startDate)) throw new Error('Vote before configured start date');
if (data.metadata.counts.votes !== data.votes.length || data.metadata.counts.ballots !== data.ballots.length) throw new Error('Metadata counts do not match collections');
console.log(`Validated ${data.votes.length} votes and ${data.ballots.length} ballots.`);
