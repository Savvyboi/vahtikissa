import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVotingAnalysis, buildPartyEvidence, buildMatterBootstrapAnalyses } from '../network-voting.js';
import { buildVotingGraph } from '../network-graph.js';

const votes = [
  { id: '1', date: '2024-01-01', document: 'A', sessionNumber: '1' },
  { id: '2', date: '2024-01-02', document: 'A', sessionNumber: '1' },
  { id: '3', date: '2024-02-01', document: 'B', sessionNumber: '2' },
  { id: '4', date: '2024-03-01', document: 'C', sessionNumber: '3' }
];
const members = ['a', 'b', 'c', 'd'].map(id => ({ id, party: 'present-party' }));
const ballots = [
  ['1', 'a', 'p', 'yes'], ['1', 'b', 'q', 'yes'], ['1', 'c', 'q', 'no'],
  ['2', 'a', 'p', 'abstain'], ['2', 'b', 'q', 'abstain'], ['2', 'c', 'q', 'absent'],
  ['3', 'a', 'q', 'no'], ['3', 'b', 'q', 'yes'], ['3', 'c', 'p', 'no'],
  ['4', 'a', 'q', 'absent'], ['4', 'b', 'q', 'unknown']
];
test('pair denominators, abstention, contested votes and equal-matter weighting reconcile', () => {
  const result = buildVotingAnalysis({ votes, ballots, members }, { minCommon: 4, evidenceLimit: 100 });
  const pair = result.pairs.find(p => p.a === 'a' && p.b === 'b');
  assert.equal(pair.common, 3); assert.equal(pair.agree, 2); assert.equal(pair.agreement, 2 / 3);
  assert.equal(pair.yesNo.common, 2); assert.equal(pair.yesNo.agreement, .5);
  assert.equal(pair.contested.common, 2); assert.equal(pair.contested.agreement, .5);
  assert.equal(pair.matterWeighted.common, 2); assert.equal(pair.matterWeighted.agreement, .5);
  assert.equal(pair.lowSupport, true); assert.equal(pair.evidenceComplete, true);
  assert.deepEqual(pair.voteIds, { agreement: ['1', '2'], disagreement: ['3'] });
  assert.equal(result.pairs.some(p => p.a === 'd' || p.b === 'd'), false);
  const reverse = buildVotingAnalysis({ votes, ballots: [...ballots].reverse(), members: [...members].reverse() }, { minCommon: 4, evidenceLimit: 100 });
  assert.deepEqual(reverse.pairs, result.pairs);
});
test('party modal ties excluded, cohesion separate, rosters and party switches event-time', () => {
  const result = buildVotingAnalysis({ votes, ballots, members }, { minCommon: 1 });
  const partyPair = result.partyPairs.find(p => p.a === 'p' && p.b === 'q');
  // Vote 1 q is tied; vote 3 q tied; only vote 2 has p/q unique modes.
  assert.equal(partyPair.common, 1); assert.equal(partyPair.agreement, 1);
  const q = result.cohesion.find(c => c.party === 'q');
  assert.equal(q.tiedVotes, 2); assert.equal(q.modalSupport, 3 / 5);
  const switched = result.crossParty.filter(c => c.mpId === 'a');
  assert.equal(switched.length, 2);
  assert.equal(switched.find(c => c.ownParty === 'p').alignment, .75);
  assert.equal(switched.find(c => c.ownParty === 'q').alignment, 1);
  assert.equal(result.crossParty.some(c => c.ownParty === 'present-party'), false);
});
test('date selection, missing overlaps, duplicate conflicts and unavailable rates', () => {
  const result = buildVotingAnalysis({ votes, ballots: [...ballots, ['1', 'a', 'p', 'no']], members }, { from: '2024-01-01', to: '2024-01-01' });
  assert.equal(result.coverage.conflictingBallots, 1);
  assert.equal(result.pairs.some(p => p.a === 'a'), false);
  const empty = buildVotingAnalysis({ votes, ballots, members }, { from: '2025-01-01' });
  assert.equal(empty.coverage.votes, 0); assert.deepEqual(empty.pairs, []); assert.equal(empty.coverage.from, null);
});
test('group-size correction gives each event equal weight and separates activity', () => {
  const result = buildVotingAnalysis({ votes: votes.slice(0, 2), members, ballots: [
    ['1', 'a', 'p', 'yes'], ['1', 'b', 'q', 'yes'],
    ['2', 'a', 'p', 'yes'], ['2', 'b', 'q', 'no'], ['2', 'c', 'q', 'no'], ['2', 'd', 'q', 'no']
  ] }, { minCommon: 1 });
  const a = result.crossParty.find(c => c.mpId === 'a');
  assert.equal(a.alignment, .5); assert.equal(a.ballotWeightedAlignment, .25); assert.equal(a.availableGroupSizeMean, 2);
});

test('full party evidence reproduces modal pair counts and both cohesion units', () => {
  const evidence = buildPartyEvidence({ votes, ballots });
  const analysis = buildVotingAnalysis({ votes, ballots, members }, { minCommon: 1 });
  assert.equal(evidence.length, votes.length);
  assert.deepEqual(evidence[0].parties.q, { counts: { yes: 1, no: 1, abstain: 0 }, eligible: 2, modalCount: 1, modalChoice: null, modalSupport: .5 });
  assert.deepEqual(evidence[3].parties, {});
  for (const pair of analysis.partyPairs) {
    const common = evidence.filter(row => row.parties[pair.a]?.modalChoice != null && row.parties[pair.b]?.modalChoice != null);
    assert.equal(common.length, pair.common);
    assert.equal(common.filter(row => row.parties[pair.a].modalChoice === row.parties[pair.b].modalChoice).length, pair.agree);
  }
  for (const cohesion of analysis.cohesion) {
    const positions = evidence.map(row => row.parties[cohesion.party]).filter(Boolean);
    assert.equal(positions.length, cohesion.votes);
    assert.equal(positions.reduce((sum, row) => sum + row.modalCount, 0) / positions.reduce((sum, row) => sum + row.eligible, 0), cohesion.modalSupport);
    assert.equal(positions.reduce((sum, row) => sum + row.modalSupport, 0) / positions.length, cohesion.meanModalSupport);
  }
  const q = analysis.cohesion.find(row => row.party === 'q');
  assert.equal(q.modalSupport, 3 / 5); assert.equal(q.meanModalSupport, 2 / 3);
});

test('party evidence matches exclusions, duplicate conflicts and inclusive scope', () => {
  const extended = [...ballots, ['1', 'a', 'p', 'yes'], ['1', 'b', 'q', 'no'], ['1', 'z', '', 'yes']];
  const rows = buildPartyEvidence({ votes, ballots: extended }, { from: '2024-01-01', to: '2024-01-01' });
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].parties.p.counts, { yes: 1, no: 0, abstain: 0 });
  assert.equal(rows[0].parties.q.eligible, 1); assert.equal(rows[0].parties.q.modalChoice, 'no');
  assert.equal(Object.hasOwn(rows[0].parties, ''), false);
});

test('matter bootstrap is deterministic and repeated identical amendments do not dominate', () => {
  const fixture = repeats => {
    const events = [...Array.from({ length: repeats }, (_, index) => ({ id: `A${index}`, date: '2024-01-01', document: 'A' })), { id: 'B', date: '2024-01-02', document: 'B' }];
    return { members: [{ id: 'a' }, { id: 'b' }], votes: events, ballots: events.flatMap(vote => [[vote.id, 'a', 'p', 'yes'], [vote.id, 'b', 'q', vote.document === 'A' ? 'yes' : 'no']]) };
  };
  const small = fixture(1), repeated = fixture(20);
  const first = buildMatterBootstrapAnalyses(small, { minCommon: 1 });
  assert.deepEqual(buildMatterBootstrapAnalyses(small, { minCommon: 1 }), first);
  assert.deepEqual(buildMatterBootstrapAnalyses(repeated, { minCommon: 1 }).map(variant => variant.pairs[0].agreement), first.map(variant => variant.pairs[0].agreement));
  assert.equal(first.length, 3); assert.deepEqual(first.map(variant => variant.method.seed), [11, 29, 47]);
  assert.equal(first[0].pairs[0].agreement, 1);
  assert.equal(first[0].pairs[0].common, 2);
  const withBase = buildMatterBootstrapAnalyses(small, { baseAnalysis: buildVotingAnalysis(small, { minCommon: 1 }) });
  assert.deepEqual(withBase, first);
});

test('bootstrap missing pair matters remain unavailable, fallback sessions form blocks', () => {
  const fixture = {
    members: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
    votes: [{ id: '1', date: '2024-01-01', document: 'A' }, { id: '2', date: '2024-01-02', sessionNumber: '2' }, { id: '3', date: '2024-01-03', sessionNumber: '3' }],
    ballots: [['1', 'a', 'p', 'yes'], ['1', 'b', 'q', 'no'], ['2', 'a', 'p', 'yes'], ['2', 'c', 'q', 'yes'], ['3', 'a', 'p', 'yes'], ['3', 'd', 'q', 'yes']]
  };
  const variants = buildMatterBootstrapAnalyses(fixture, { minCommon: 1 });
  for (const variant of variants) {
    assert.equal(variant.coverage.bootstrap.blocks, 3);
    assert.equal(variant.coverage.bootstrap.draws, 3);
    assert.equal(variant.pairs.some(pair => pair.a === 'b' && pair.b === 'c'), false);
    for (const pair of variant.pairs) {
      assert.equal(pair.agreement === null, pair.sampledMatterObservations === 0);
      assert.equal(pair.common, 1);
    }
  }
  assert.equal(variants.some(variant => variant.pairs.some(pair => pair.agreement === null)), true);
  const unsupported = buildMatterBootstrapAnalyses(fixture, { minCommon: 30 });
  for (const variant of unsupported) assert.equal(buildVotingGraph(variant).edges.length, 0);
  const empty = buildMatterBootstrapAnalyses({ votes: [], ballots: [], members: [] });
  assert.deepEqual(empty[0].pairs, []); assert.equal(empty[0].coverage.bootstrap.blocks, 0);
  assert.throws(() => buildMatterBootstrapAnalyses(fixture, { baseAnalysis: buildVotingAnalysis(fixture), from: '2024-01-02' }), /different vote scope/);
});
