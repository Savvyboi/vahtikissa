import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const source = new URL('../data/parliament.json', import.meta.url);
const committees = new URL('../data/committee-index.json', import.meta.url);
const output = new URL('../data/parliament/', import.meta.url);

// Keep the original snapshot for validation/exports; derive smaller browser payloads.
export function parliamentChunks(data, committeeIndex = {}) {
  const snapshot = data.metadata.generatedAt;
  const votes = data.votes.map(vote => ({ ...vote, committees: committeeIndex.matters?.[vote.document] || [] }));
  const legislation = data.legislation.map(matter => ({ ...matter, committees: committeeIndex.matters?.[matter.id] || [] }));
  const byVote = new Map(votes.map(vote => [vote.id, []]));
  const byMember = new Map(data.members.map(member => [String(member.id), { ballots: [], speeches: [] }]));
  const partyVotes = {};
  for (const ballot of data.ballots) {
    const [voteId, mpId, party, choice] = Array.isArray(ballot) ? ballot : [ballot.voteId, ballot.mpId, ballot.party, ballot.choice];
    byVote.get(voteId)?.push(ballot);
    byMember.get(String(mpId))?.ballots.push(ballot);
    const tally = ((partyVotes[voteId] ||= {})[party] ||= { yes: 0, no: 0, abstain: 0, absent: 0, other: 0, total: 0 });
    tally[choice] = (tally[choice] || 0) + 1;
    tally.total++;
  }
  for (const speech of data.speeches) byMember.get(String(speech.mpId))?.speeches.push(speech);
  const mattersByVote = new Map();
  for (const matter of legislation) for (const id of matter.voteIds || []) {
    if (!mattersByVote.has(id)) mattersByVote.set(id, []);
    mattersByVote.get(id).push(matter);
  }
  const mattersById = new Map(legislation.map(matter => [matter.id, matter]));
  const chunks = new Map([
    ['core.json', { metadata: data.metadata, votes: data.votes, members: data.members, parties: data.parties, sessions: data.sessions,
      voteCommittees: Object.fromEntries([...new Set(votes.map(vote => vote.document))].filter(id => committeeIndex.matters?.[id]).map(id => [id, committeeIndex.matters[id]])) }],
    ['speeches.json', { snapshot, speeches: data.speeches }],
    ['legislation.json', { snapshot, legislation }],
    ['party-votes.json', { snapshot, partyVotes }]
  ]);
  votes.forEach((vote, index) => chunks.set(`vote-${index}.json`, {
    snapshot, ballots: byVote.get(vote.id),
    legislation: mattersByVote.get(vote.id) || (mattersById.has(vote.document) ? [mattersById.get(vote.document)] : [])
  }));
  data.members.forEach((member, index) => chunks.set(`member-${index}.json`, { snapshot, ...byMember.get(String(member.id)) }));
  return chunks;
}

export async function buildParliamentData({ force = false } = {}) {
  if (!force) {
    try {
      const [core, raw, committee, builder] = await Promise.all([stat(new URL('core.json', output)), stat(source), stat(committees), stat(new URL(import.meta.url))]);
      if (core.mtimeMs >= Math.max(raw.mtimeMs, committee.mtimeMs, builder.mtimeMs)) return;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const [data, index] = await Promise.all([readFile(source, 'utf8').then(JSON.parse), readFile(committees, 'utf8').then(JSON.parse)]);
  const chunks = parliamentChunks(data, index);
  await mkdir(output, { recursive: true });
  const entries = [...chunks].filter(([name]) => name !== 'core.json');
  for (let start = 0; start < entries.length; start += 32) {
    await Promise.all(entries.slice(start, start + 32).map(([name, payload]) => writeFile(new URL(name, output), JSON.stringify(payload))));
  }
  // Write the entry point last so an interrupted build is regenerated next time.
  await writeFile(new URL('core.json', output), JSON.stringify(chunks.get('core.json')));
  console.log(`Prepared ${chunks.size} Parliament payloads; core ${(Buffer.byteLength(JSON.stringify(chunks.get('core.json'))) / 1e6).toFixed(2)} MB.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  buildParliamentData({ force: true }).catch(error => { console.error(error); process.exitCode = 1; });
}
