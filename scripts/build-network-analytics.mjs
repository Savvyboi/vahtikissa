import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { policyTopicKeys } from '../app-utils.js';
import { buildVotingAnalysis, buildPartyEvidence, buildMatterBootstrapAnalyses } from '../network-voting.js';
import { buildVotingGraph, analyzeVotingGraph } from '../network-graph.js';
import { buildCommitteeAnalysis, compareLayers } from '../network-institutions.js';
import { buildLobbyingAnalysis } from '../network-lobbying.js';
import { buildSpeechAnalysis } from '../network-speech.js';
import { packPairs } from '../network-format.js';

const root = new URL('../', import.meta.url);
const output = new URL('data/networks/', root);
export const NETWORK_FEATURES = ['topic-profiles','vote-neighbours','keyword-comparisons','party-heatmap','emerging-phrases'];
const config = { version: 'relationships-1', minCommon: 30, contestedMinority: 0.1, graphLayer: 'voting', comparisonLayers: ['voting','committees'], features: NETWORK_FEATURES };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const workerPaths=['network-worker.js','network-speech.js','network-institutions.js','speech-research.js','speech-stopwords.js','speech-topics.js','app-utils.js'];
const methodPaths = ['scripts/build-network-analytics.mjs','scripts/network-reference-review.mjs','network-format.js','network-voting.js','network-graph.js','network-lobbying.js',...workerPaths];

export async function buildNetworkAnalytics({ force = false } = {}) {
  const parliamentBytes=await readFile(new URL('data/parliament.json',root));
  const parliament = JSON.parse(parliamentBytes);
  const chunks = [...new Set(parliament.speeches.map(s => s.textChunk))].sort((a,b)=>a-b);
  const sourcePaths = ['data/parliament.json','data/member-profiles.json','data/influence.json','data/committee-index.json',...chunks.map(n=>`data/speech-texts-${n}.json`)];
  const paths = [...sourcePaths,...methodPaths];
  const inputStats = await Promise.all(paths.map(async path => { const info=await stat(new URL(path,root));return {path,size:info.size,mtimeMs:info.mtimeMs}; }));
  if (!force) {
    try { const old=JSON.parse(await readFile(new URL('index.json',output),'utf8')); if(JSON.stringify(old.inputStats)===JSON.stringify(inputStats))return old; }
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  const contents = new Map(await Promise.all(paths.map(async path=>[path,path==='data/parliament.json'?parliamentBytes:await readFile(new URL(path,root))])));
  const components = paths.map(path=>({path,sha256:hash(contents.get(path)),bytes:contents.get(path).length,kind:sourcePaths.includes(path)?'source':'method'}));
  const id = hash(JSON.stringify({config,components})).slice(0,24);
  const target = new URL(`${id}/`, output);
  await mkdir(target,{recursive:true});
  const files = {};
  const code={};
  for(const path of workerPaths){const bytes=contents.get(path);code[path]={sha256:hash(bytes),bytes:bytes.length};await writeFile(new URL(path,target),bytes);}
  async function emit(name,data) {
    if(!/^[a-z0-9-]+\.json$/.test(name))throw Error(`Invalid payload name: ${name}`);
    const body=JSON.stringify({manifestId:id,data});
    files[name]={sha256:hash(body),bytes:Buffer.byteLength(body)};
    const destination=new URL(name,target);
    try {const prior=await readFile(destination,'utf8');if(prior!==body)throw Error(`Immutable payload collision: ${name}`);}
    catch(error){if(error.code!=='ENOENT')throw error;await writeFile(destination,body);}
  }
  const parse=path=>JSON.parse(contents.get(path));
  const profiles=parse('data/member-profiles.json'), influence=parse('data/influence.json'), committeeIndex=parse('data/committee-index.json');
  const votes=parliament.votes.map(v=>({...v,committees:committeeIndex.matters?.[v.document]||[]}));
  const dates=[...votes.map(v=>v.date.slice(0,10)),...parliament.speeches.map(s=>s.date.slice(0,10))].sort();
  const from=dates[0],to=dates.at(-1);
  const committee=buildCommitteeAnalysis(profiles,parliament.members,{from,to});
  await emit('committee-source.json',{members:Object.fromEntries(Object.entries(profiles.members).map(([key,p])=>[key,{id:p.id,sourceUrl:p.sourceUrl,committees:p.committees,bodies:p.bodies}]))});
  for(const m of parliament.members)await emit(`committee-member-${m.id}.json`,{memberships:committee.memberships.filter(r=>r.mpId===String(m.id)),pairs:committee.pairs.filter(r=>r.a===String(m.id)||r.b===String(m.id)),coverage:committee.coverage,method:committee.method});
  const lobbying=buildLobbyingAnalysis(influence,parliament.members);
  const organisations=[];
  for(let n=0;n<lobbying.organisations.length;n++){
    const org=lobbying.organisations[n],relationships=lobbying.relationships.filter(r=>r.organisationId===org.id);
    const topicTexts=Object.fromEntries(relationships.map(r=>[r.topicId,r.topic]));
    const file=`lobbying-${n}.json`;
    const targetIds=new Set(relationships.map(r=>r.targetId)),recordIds=new Set(relationships.flatMap(r=>r.sourceRecordIds));
    await emit(file,{organisation:org,relationEncoding:'organisation-1',relationships:relationships.map(r=>[r.id,r.declarationId,r.topicId,r.targetId,r.periodId,r.identityStatus,r.sourceRecordIds]),topicTexts,targets:lobbying.targets.filter(t=>targetIds.has(t.id)),declarations:lobbying.declarations.filter(d=>d.organisationId===org.id),sourceRecords:influence.lobbying.filter(r=>recordIds.has(String(r.id)))});
    organisations.push({...org,file});
  }
  await emit('lobbying-index.json',{organisations,periods:lobbying.periods,coverage:lobbying.coverage,method:lobbying.method,publicationGate:lobbying.publicationGate});
  const years=[...new Set(votes.map(v=>v.date.slice(0,4)))].sort();
  const topics=[...new Set(votes.flatMap(policyTopicKeys))].sort();
  const scopes=[{id:'all',label:'All stored votes',from,to},...years.map(year=>({id:`year-${year}`,label:year,from:`${year}-01-01`,to:`${year}-12-31`})),...topics.map(topic=>({id:`topic-${topic}`,label:topic,topic,from,to}))];
  const ballotsByMember=new Map(parliament.members.map(m=>[String(m.id),[]]));
  const ballotsByVote=new Map(votes.map(v=>[v.id,[]]));
  for(const b of parliament.ballots){ballotsByMember.get(String(b[1]))?.push(b);ballotsByVote.get(b[0])?.push(b);}
  for(const [mpId,ballots] of ballotsByMember)await emit(`ballots-${mpId}.json`,ballots);
  for(let n=0;n<votes.length;n++)await emit(`vote-${n}.json`,{vote:votes[n],ballots:ballotsByVote.get(votes[n].id)});
  await emit('vote-index.json',votes.map((v,n)=>({id:v.id,date:v.date,document:v.document,title:v.title,topics:policyTopicKeys(v),file:`vote-${n}.json`})));
  const byVoteId=new Map(votes.map(v=>[v.id,v]));
  await emit('party-events.json',buildPartyEvidence({...parliament,votes}).map(event=>({...event,topics:policyTopicKeys(byVoteId.get(event.id))})));
  let allVoting;
  const graphVariants=[];
  for(const scope of scopes){
    const selected=votes.filter(v=>v.date.slice(0,10)>=scope.from&&v.date.slice(0,10)<=scope.to&&(!scope.topic||policyTopicKeys(v).includes(scope.topic)));
    const voting=buildVotingAnalysis({...parliament,votes:selected},{...config,evidenceLimit:5});
    if(scope.id==='all')allVoting=voting;
    const memberPairs=new Map(parliament.members.map(m=>[String(m.id),[]]));
    for(const pair of voting.pairs){memberPairs.get(String(pair.a))?.push(pair);memberPairs.get(String(pair.b))?.push(pair);}
    for(const member of parliament.members){
      const mpId=String(member.id);
      await emit(`${scope.id}-member-${mpId}.json`,{pairEncoding:'neighbour-1',memberId:mpId,pairs:packPairs(memberPairs.get(mpId),mpId),crossParty:voting.crossParty.filter(x=>x.mpId===mpId),partyByMember:Object.fromEntries(voting.nodes.map(n=>[n.id,n.party])),coverage:voting.coverage,method:voting.method,scope});
    }
    await emit(`${scope.id}-parties.json`,{partyPairs:voting.partyPairs,cohesion:voting.cohesion,coverage:voting.coverage,method:voting.method,scope});
    scope.votes=selected.length;
    if(scope.id==='all'||scope.id.startsWith('year-')){
      const graph=buildVotingGraph(voting);
      graph.method.sensitivityScenario=scope.id;
      graph.method.window=voting.coverage;
      if(scope.id!=='all')graphVariants.push(graph);
      if(scope.id==='all'){
        for(const k of [3,8]){const variant=buildVotingGraph(voting,{k});variant.method.sensitivityScenario=`neighbours-${k}`;graphVariants.push(variant);}
        const matterVariant=buildVotingGraph(voting,{weighting:'matterWeighted'});matterVariant.method.sensitivityScenario='equal-matter-weight';graphVariants.push(matterVariant);
      }
    }
    console.log(`Relationships: ${scope.id}, ${selected.length} votes, ${voting.pairs.length} supported or observed pairs.`);
  }
  const graph=buildVotingGraph(allVoting);
  for(const resample of buildMatterBootstrapAnalyses({...parliament,votes},{baseAnalysis:allVoting,seeds:[11,29,47]})){
    const variant=buildVotingGraph(resample);variant.method.sensitivityScenario=`matter-bootstrap-${resample.method.seed}`;variant.method.resampling=resample.method;variant.method.coverage=resample.coverage.bootstrap;graphVariants.push(variant);
  }
  const graphAnalysis=analyzeVotingGraph(graph,{sensitivityGraphs:graphVariants});
  graphAnalysis.method.sensitivityScenarios=graphVariants.map(variant=>variant.method);
  delete graphAnalysis.communities.evaluationAssignments;
  await emit('graph.json',{graph,analysis:graphAnalysis,coverage:allVoting.coverage,method:allVoting.method});
  for(const member of parliament.members){
    const comparison=compareLayers(String(member.id),allVoting,committee,{from,to});
    comparison.layers=comparison.layers.map(layer=>layer.layer==='voting'?{...layer,pairEncoding:'neighbour-1',minCommon:allVoting.method.minCommon,relationships:packPairs(layer.relationships,member.id)}:{...layer,relationships:layer.relationships.map(({bodies,...pair})=>({...pair,bodies:bodies.map(({intervals,evidence,...body})=>body)}))});
    await emit(`layers-${member.id}.json`,comparison);
  }
  const texts=Object.assign({},...chunks.map(n=>parse(`data/speech-texts-${n}.json`)));
  const speech=buildSpeechAnalysis(parliament.speeches,texts,{members:parliament.members,coverageStart:from,coverageEnd:to});
  for(const member of parliament.members){const profile=speech.topicProfiles.find(p=>p.mpId===String(member.id))||{mpId:String(member.id),speeches:0,words:0,topics:[],matters:[]};await emit(`topics-member-${member.id}.json`,{results:profile,coverage:speech.coverage,method:speech.method});}
  for(const feature of ['emerging','phraseUptake'])await emit(`speech-${feature.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}.json`,{results:speech[feature]??[],coverage:speech.coverage,method:speech.method});
  const keywordPresets = [];
  for (const [index, comparison] of speech.keywordComparisons.entries()) {
    const file = `speech-keyword-${index}.json`;
    await emit(file, comparison);
    keywordPresets.push({ query: comparison.query, topic: comparison.topic, file });
  }
  await emit('speech-keyword-comparisons.json', { results: keywordPresets, coverage: speech.coverage, method: speech.method });
  const {candidates,...referenceSummary}=speech.references;
  await emit('speech-references.json',{results:referenceSummary,coverage:speech.coverage,method:speech.references.method});
  // Complete candidates are an offline evaluation artifact, never a public person ranking.
  await emit('reference-extraction.json',{...referenceSummary,candidates});
  const speechMonths=[...new Set(parliament.speeches.map(s=>s.date.slice(0,7)))].sort();
  const monthMetadata=[];
  for(const month of speechMonths){
    const records=parliament.speeches.filter(s=>s.date.slice(0,7)===month);
    const name=`speeches-${month}.json`;
    await emit(name,{speeches:records,texts:Object.fromEntries(records.map(s=>[s.id,texts[s.id]||'']))});
    monthMetadata.push({month,file:name,speeches:records.length,bytes:files[name].bytes});
  }
  const manifest={id,config,components,inputStats,coverage:{from,to,parliamentSnapshot:parliament.metadata.generatedAt,profilesSnapshot:profiles.metadata?.generatedAt,lobbyingSnapshot:influence.metadata?.generatedAt},scopes,members:parliament.members.map(({id,firstName,lastName,party})=>({id,firstName,lastName,party})),speechMonths:monthMetadata,files,code,publicationGates:{references:'Independent human evaluation pending; public person rankings disabled',lobbying:'Reviewed person identity crosswalk pending; person rankings disabled'}};
  // If a concurrent sync/editor changed any inputs, preserve the previous entry point.
  for(const expected of components){if(hash(await readFile(new URL(expected.path,root)))!==expected.sha256)throw Error(`Input changed during build: ${expected.path}; retry the build.`);}
  await writeFile(new URL('manifest.json',target),JSON.stringify(manifest));
  await mkdir(output,{recursive:true});
  const next=new URL(`index-${process.pid}.next.json`,output);
  await writeFile(next,JSON.stringify(manifest));
  await rename(next,new URL('index.json',output));
  console.log(`Prepared Relationships manifest ${id}; ${Object.keys(files).length} immutable payloads.`);
  return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)buildNetworkAnalytics({force:process.argv.includes('--force')}).catch(error=>{console.error(error);process.exitCode=1;});
