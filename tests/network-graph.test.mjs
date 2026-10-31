import test from 'node:test';
import assert from 'node:assert/strict';
import { weightedBetweenness, graphComponents, buildVotingGraph, detectCommunities, adjustedRandIndex, analyzeVotingGraph } from '../network-graph.js';
const graph = (nodes, edges) => ({ nodes: nodes.map(id => ({ id })), edges: edges.map(([a, b, weight = 1]) => ({ a, b, weight, distance: 1 / weight })) });
test('weighted Brandes matches hand-checkable line and disconnected normalization', () => {
  const line = graph(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]);
  assert.deepEqual(weightedBetweenness(line).map(x => x.score), [0, 1, 0]);
  const disconnected = graph(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c']]);
  assert.equal(weightedBetweenness(disconnected)[1].score, 1 / 3);
  assert.deepEqual(graphComponents(disconnected), [['a', 'b', 'c'], ['d']]);
});
test('tied shortest paths split credit and similarities convert to distances', () => {
  const diamond = graph(['a', 'b', 'c', 'd'], [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd']]);
  for (const result of weightedBetweenness(diamond)) assert.ok(Math.abs(result.score - 1 / 6) < 1e-12);
  const triangle = graph(['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['a', 'c', .2]]);
  assert.equal(weightedBetweenness(triangle)[1].score, 1);
});
test('k-neighbour union retains kth-place ties, positive supported edges only', () => {
  const analysis = { nodes: ['a', 'b', 'c'].map(id => ({ id })), method: { minCommon: 2 }, pairs: [
    { a: 'a', b: 'b', agreement: .9, common: 3 }, { a: 'a', b: 'c', agreement: .9, common: 3 }, { a: 'b', b: 'c', agreement: 1, common: 1 }
  ] };
  const result = buildVotingGraph(analysis, { k: 1 });
  assert.equal(result.edges.length, 2); assert.equal(result.edges[0].distance, 1 / .9);
});
test('seeded communities reproducible, connected, and label-invariant evaluation', () => {
  const g = graph(['a', 'b', 'c', 'd', 'e', 'f'], [['a', 'b'], ['b', 'c'], ['a', 'c'], ['d', 'e'], ['e', 'f'], ['d', 'f'], ['c', 'd', .01]]);
  const first = detectCommunities(g, { seed: 7 });
  assert.deepEqual(detectCommunities(g, { seed: 7 }), first);
  assert.equal(first.groups, 2); assert.ok(first.modularity > .4);
  assert.equal(adjustedRandIndex({ a: 0, b: 0, c: 1 }, { a: 7, b: 7, c: 8 }), 1);
  assert.equal(analyzeVotingGraph(g).communities.assignments, null);
  const evaluated = analyzeVotingGraph(g, { sensitivityGraphs: [g] });
  assert.equal(evaluated.communities.status, 'exploratory-stable');
  assert.equal(evaluated.brokerage.rankingsPublished, false);
});
test('empty and small graphs remain finite, rankings suppressed without sensitivity', () => {
  assert.deepEqual(weightedBetweenness(graph([], [])), []);
  assert.equal(weightedBetweenness(graph(['a'], []))[0].score, 0);
  assert.equal(analyzeVotingGraph(graph(['a', 'b'], [])).brokerage.status, 'sensitivity-pending');
});
