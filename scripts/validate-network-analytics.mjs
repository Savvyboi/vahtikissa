import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { commonBallotEvidence } from '../network-data.js';
import { decodeNetworkData } from '../network-format.js';
import { NETWORK_FEATURES } from './build-network-analytics.mjs';

const base=new URL('../data/networks/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('index.json',base),'utf8'));
assert.deepEqual(manifest.config.features,NETWORK_FEATURES);
assert.equal(manifest.config.graphLayer,'voting');
assert.deepEqual(manifest.config.comparisonLayers,['voting','committees']);
const digest=value=>createHash('sha256').update(value).digest('hex');
const directory=new URL(`${manifest.id}/`,base);
let bytes=0;
for(const [name,expected] of Object.entries(manifest.files)){
  assert.match(name,/^[a-z0-9-]+\.json$/);
  const raw=await readFile(new URL(name,directory));bytes+=raw.length;
  assert.equal(digest(raw),expected.sha256,`${name}: content hash`);
  assert.equal(raw.length,expected.bytes,`${name}: byte length`);
  const payload=JSON.parse(raw);assert.equal(payload.manifestId,manifest.id,`${name}: manifest binding`);
}
for(const component of manifest.components){const raw=await readFile(new URL('../'+component.path,import.meta.url));assert.equal(digest(raw),component.sha256,`${component.path}: input changed since analysis build`);}
for(const [name,expected] of Object.entries(manifest.code)){const raw=await readFile(new URL(name,directory));assert.equal(digest(raw),expected.sha256,`${name}: frozen worker code`);assert.equal(raw.length,expected.bytes);}
const load=async name=>decodeNetworkData(JSON.parse(await readFile(new URL(name,directory),'utf8')).data);
const voting=await load(`all-member-${manifest.members[0].id}.json`);
const sample=voting.pairs[0],index=await load('vote-index.json');
const common=commonBallotEvidence(await load(`ballots-${sample.a}.json`),await load(`ballots-${sample.b}.json`),index,manifest.scopes[0]);
assert.equal(common.length,sample.common);assert.equal(common.filter(x=>x.agreement).length,sample.agree);
for(const row of common.slice(0,3)){const frozen=await load(row.file);assert.equal(frozen.vote.id,row.voteId);assert.equal(frozen.ballots.find(b=>b[1]===sample.a)[3],row.choiceA);}
const lobbying=await load('lobbying-index.json');assert.equal(lobbying.coverage.reconciliation,true);assert.equal(lobbying.publicationGate.personRankingsEnabled,false);
const references=await load('speech-references.json');assert.equal(references.results.publicPersonRankingsEnabled,false);assert.equal(references.results.publicationGate,'pending-independent-human-review');
const graph=await load('graph.json');assert.equal(graph.analysis.brokerage.rankingsPublished,false);assert.equal('evaluationAssignments' in graph.analysis.communities,false);
if(graph.analysis.communities.status==='unavailable-unstable')assert.equal(graph.analysis.communities.assignments,null);
console.log(`Validated Relationships manifest ${manifest.id}: ${Object.keys(manifest.files).length} payload hashes, ${(bytes/1e6).toFixed(1)} MB on disk, ${NETWORK_FEATURES.length} public analyses, exact sampled pair evidence and publication gates.`);
