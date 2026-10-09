import { readFile, writeFile } from 'node:fs/promises';
import { buildSpeechAnalytics } from '../app-utils.js';
import { buildWordClouds } from '../speech-research.js';

const DATA = new URL('../data/', import.meta.url);
const parliament = JSON.parse(await readFile(new URL('parliament.json', DATA), 'utf8'));
const chunks = new Map();
for (const chunk of new Set(parliament.speeches.map(speech => speech.textChunk).filter(Number.isInteger))) {
  chunks.set(chunk, JSON.parse(await readFile(new URL(`speech-texts-${chunk}.json`, DATA), 'utf8')));
}
const speeches = parliament.speeches.map(speech => ({ ...speech, text: chunks.get(speech.textChunk)?.[speech.id] || '' }));
const output = { generatedAt: new Date().toISOString(), ...buildSpeechAnalytics(speeches) };
await writeFile(new URL('speech-analytics.json', DATA), `${JSON.stringify(output)}\n`);
await writeFile(new URL('speech-wordclouds.json', DATA), `${JSON.stringify({generatedAt:parliament.metadata.generatedAt,...buildWordClouds(speeches,60,parliament.members.map(member=>member.id))})}\n`);
console.log(`Speech analytics: ${speeches.length} speeches across ${Object.keys(output.topics).length} topic groups.`);
