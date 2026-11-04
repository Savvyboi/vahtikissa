import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrgName, extractHEIds, classifyOrganization, interestOrganizations, precomputeMetrics, buildTransparencyGraph } from '../scripts/transparency-graph.mjs';
import { packTransparencyGraph, unpackTransparencyGraph, filterTransparencyGraph, selectTransparencyView, shortestTransparencyPath, viewPositions } from '../transparency-model.js';

function fixture() {
  return {
    parliament: { members: [{ id: '1', firstName: 'Aino', lastName: 'Testi', party: 'kok' }, { id: '2', firstName: 'Bertil', lastName: 'Testi', party: 'sd' }, { id: '3', firstName: 'Cecilia', lastName: 'Testi', party: 'ps' }], legislation: [{ id: 'HE 151/2024 vp', title: 'Test bill', voteIds: ['vote-1'] }] },
    profiles: { members: { '1': { committees: [{ id: 'STV01', name: { fi: 'Sosiaali- ja terveysvaliokunta' }, role: { fi: 'Jäsen' }, from: '2023-04-01', to: '' }], government: { fi: [{ from: '2023-06-01', to: '' }] } }, '2': { committees: [{ id: 'STV01', name: { fi: 'Sosiaali- ja terveysvaliokunta' }, role: { fi: 'Jäsen' }, from: '2023-04-01', to: '2025-01-01' }] }, '3': { committees: [{ id: 'STV01', name: { fi: 'Sosiaali- ja terveysvaliokunta' }, role: { fi: 'Varajäsen' }, from: '2023-04-01', to: '' }] } } },
    influence: { metadata: { generatedAt: '2026-11-01T00:00:00Z', transparencySource: 'https://example.org/lobbying', parliamentSource: 'https://example.org/members' },
      interests: [{ id: 'i1', mpId: '1', declared: true, type: 'interest', category: 'Hallinto- ja luottamustehtävät', organization: 'Example Oy', description: 'hallituksen jäsen', year: 2024 }, { id: 'i2', mpId: '2', declared: true, type: 'interest', category: 'Hallinto- ja luottamustehtävät', organization: 'Example Ab', description: 'hallituksen jäsen', year: 2024 }],
      gifts: [{ id: 'g1', mpId: '1', donor: 'Example Oyj', year: 2024, description: 'Book', amount: 20, reported: '1.6.2024' }],
      targets: [{ id: 10, kind: 'mp', fi: { name: 'Aino Testi' } }, { id: 20, kind: 'parliament', fi: { unit: 'Sosiaali- ja terveysvaliokunta' } }],
      lobbying: [{ id: 'l1', notificationId: 'n1', actor: 'Example Oy', companyId: '1234567-8', topic: 'HE 151/2024 vp; HE 151/2024', methods: ['meeting'], period: { start: '2024-01-01', end: '2024-06-30' }, targetIds: [10, 10, 20] }]
    }
  };
}

test('canonical names strip Finnish and Swedish legal suffixes without stripping word fragments', () => {
  for (const name of ['Example Oy', 'Oy Example Ab', 'Example Oyj', 'Example ry', 'Example rf', 'Example sr', 'Example säätiö', 'Example stiftelse', 'Example osuuskunta']) assert.equal(normalizeOrgName(name), 'example', name);
  assert.equal(normalizeOrgName('Rytmi Oy'), 'rytmi');
  assert.equal(normalizeOrgName('SÄÄTIÖ Åbo Ab'), 'åbo');
  assert.equal(classifyOrganization('Akava ry'), 'Työmarkkinajärjestöt');
  assert.equal(classifyOrganization('Example Oy', 'Suhdetoiminta ja viestintä'), 'Konsultit & Vaikuttajaviestintä');
});
test('HE identifiers normalize case, spacing and optional vp while rejecting incomplete identifiers', () => {
  assert.deepEqual(extractHEIds('he 0151/2026; HE 151/2026 vp, HE 69 / 2026 VP, HE 3/26'), ['HE 151/2026 vp', 'HE 69/2026 vp']);
});
test('free text extraction retains roles and omits assets, income and ambiguous narratives', () => {
  const base = { declared: true, type: 'interest', category: 'Hallinto- ja luottamustehtävät' };
  assert.equal(interestOrganizations({ ...base, description: 'Example Oy, hallituksen jäsen' })[0].name, 'Example Oy');
  assert.equal(interestOrganizations({ ...base, description: 'Hallintoneuvoston puheenjohtaja Neova oy' })[0].name, 'Neova oy');
  assert.deepEqual(interestOrganizations({ ...base, type: 'income', description: 'Example Oy, 2000 euroa' }), []);
  assert.deepEqual(interestOrganizations({ ...base, description: 'Example Oy, hallituksen jäsen; jätin eroilmoitukseni vuonna 2024' }), []);
  assert.deepEqual(interestOrganizations({ ...base, category: 'Merkittävä varallisuus', description: 'Asunto, Helsinki' }), []);
  assert.equal(interestOrganizations({ ...base, description: 'Hallituksen puheenjohtaja, Laurea-ammattikorkeakoulu' })[0].name, 'Laurea-ammattikorkeakoulu');
  assert.equal(interestOrganizations({ ...base, description: 'valtuutettu, Etelä-Karjalan hyvinvointialue 2022-2025' })[0].name, 'Etelä-Karjalan hyvinvointialue');
  assert.deepEqual(interestOrganizations({ ...base, description: 'Hallituksen puheenjohtaja' }), []);
});
test('exact Brandes, weighted degree, PageRank and offline coordinates on a known star', () => {
  const nodes = ['a', 'b', 'c', 'd'].map(id => ({ id })), edges = ['b', 'c', 'd'].map(target => ({ source: 'a', target, weight: 2 }));
  precomputeMetrics(nodes, edges);
  assert.equal(nodes[0].betweenness, 1); assert.equal(nodes[1].betweenness, 0);
  assert.equal(nodes[0].degree, 3); assert.equal(nodes[0].weightedDegree, 6);
  assert.ok(Math.abs(nodes.reduce((sum, node) => sum + node.pagerank, 0) - 1) < 1e-9);
  assert.ok(nodes[0].pagerank > nodes[1].pagerank);
  for (const node of nodes) { assert.ok(Number.isInteger(node.communityId)); assert.ok(Number.isFinite(node.initialX)); assert.ok(Number.isFinite(node.initialY)); }
  const again = ['a', 'b', 'c', 'd'].map(id => ({ id })); precomputeMetrics(again, edges); assert.deepEqual(again, nodes);
  const isolated = [{ id: 'alone' }]; precomputeMetrics(isolated, []); assert.equal(isolated[0].betweenness, 0); assert.equal(isolated[0].pagerank, 1);
});
test('multiplex aggregation keeps business identity, deduplicates declarations and labels inferred committee associations', () => {
  const { graph, records } = buildTransparencyGraph(fixture());
  assert.equal(graph.nodes.filter(node => node.type === 'org').length, 1);
  const edge = graph.edges.find(edge => edge.target === 'mp:1');
  assert.deepEqual(edge.counts, { sidonnaisuus: 1, lobbaus: 1, lahja: 1 });
  assert.equal(edge.weight, +(3 + 2.5 + Math.log1p(1) * 1.5).toFixed(2));
  assert.equal(edge.isDualRole, true); assert.deepEqual(edge.heIds, ['HE 151/2024 vp']);
  assert.equal(graph.edges.find(edge => edge.target === 'mp:2').details.find(d => d.layer === 'lobbaus').inferred, true);
  assert.equal(graph.edges.some(edge => edge.target === 'mp:3'), false, 'A substitute is not inferred as a personal committee contact');
  assert.equal(records['lobbaus:l1'].topic, fixture().influence.lobbying[0].topic);
  assert.equal(graph.bills[0].available, true);
  assert.deepEqual(graph.method.government.parties, ['kok']);
  assert.equal(graph.mpInterlocks.length, 1); assert.equal(graph.mpInterlocks[0].isCrossBloc, true);
});
test('conflicting business IDs and ambiguous recipient names never manufacture merged identities', () => {
  const input = fixture();
  input.influence.lobbying.push({ ...input.influence.lobbying[0], id: 'l2', companyId: '9999999-9' });
  input.parliament.members[2].firstName = 'Aino';
  const { graph } = buildTransparencyGraph(input);
  assert.ok(graph.nodes.some(node => node.id === 'org:yt:1234567-8'));
  assert.ok(graph.nodes.some(node => node.id === 'org:yt:9999999-9'));
  assert.ok(graph.coverage.ambiguousTargets > 0);
  assert.equal(graph.edges.some(edge => edge.details.some(d => d.identity === 'unique-exact-name')), false);
  const closed = fixture(); closed.influence.lobbying[0].period.end = '2026-11-01';
  assert.equal(buildTransparencyGraph(closed).graph.edges.some(edge => edge.counts.lobbaus), false);
});
test('packed static JSON round trips weights, evidence provenance, projections and preset coordinates', () => {
  const { graph } = buildTransparencyGraph(fixture()), packed = packTransparencyGraph(graph), decoded = unpackTransparencyGraph(JSON.parse(JSON.stringify(packed)));
  assert.equal(packed.encoding, 'multiplex-1'); assert.equal(decoded.edges.length, graph.edges.length);
  assert.deepEqual(decoded.edges.map(edge => edge.counts), graph.edges.map(edge => edge.counts));
  assert.deepEqual(decoded.edges.map(edge => edge.weight), graph.edges.map(edge => edge.weight));
  const ids = new Set(decoded.edges.map(edge => edge.id));
  for (const edge of decoded.mpInterlocks) for (const org of edge.sharedOrgs) org.edgeIds.forEach(id => assert.ok(ids.has(id)));
  assert.ok(decoded.layouts.backbone['mp:1']);
});
test('facets use OR within a group, AND across groups, exclusions first, with period-specific counts', () => {
  const input = fixture(); input.influence.gifts.push({ ...input.influence.gifts[0], id: 'g2', year: 2025 });
  const { graph } = buildTransparencyGraph(input);
  const state = { facets: { party: { include: ['kok', 'sd'], exclude: ['sd'] }, layer: { include: ['multiplex'] }, year: { include: ['2024'] } } };
  const filtered = filterTransparencyGraph(graph, state);
  assert.equal(filtered.length, 1); assert.equal(filtered[0].counts.lahja, 1);
  state.facets.category = { exclude: ['Elinkeinoelämä & Yhtiöt'] }; assert.equal(filterTransparencyGraph(graph, state).length, 0);
  delete state.facets.category; state.minWeight = 100; assert.equal(filterTransparencyGraph(graph, state).length, 0);
  assert.equal(filterTransparencyGraph(graph, { facets: {}, inferred: false }).find(edge => edge.target === 'mp:2').counts.lobbaus, 0);
});
test('MP interlock projection requires surviving board disclosures in a common year', () => {
  const graph = unpackTransparencyGraph(packTransparencyGraph(buildTransparencyGraph(fixture()).graph));
  const all = filterTransparencyGraph(graph, { facets: {} });
  assert.equal(selectTransparencyView(graph, all, { preset: 'interlocks' }).edges.length, 1);
  const giftsOnly = filterTransparencyGraph(graph, { facets: { layer: { include: ['lahja'] } } });
  assert.equal(selectTransparencyView(graph, giftsOnly, { preset: 'interlocks' }).edges.length, 0);
  const nextYear = filterTransparencyGraph(graph, { facets: { year: { include: ['2025'] } } });
  assert.equal(selectTransparencyView(graph, nextYear, { preset: 'interlocks' }).edges.length, 0);
});
test('broker selection retains both bipartite node types and sparse backbones retain their selected actors', () => {
  const { graph } = buildTransparencyGraph(fixture()), filtered = filterTransparencyGraph(graph, { facets: {} });
  const brokers = selectTransparencyView(graph, filtered, { preset: 'brokers' });
  assert.ok(brokers.nodes.some(node => node.type === 'mp')); assert.ok(brokers.nodes.some(node => node.type === 'org')); assert.ok(brokers.edges.length);
  const nodes = [...Array.from({ length: 4 }, (_, i) => ({ id: `mp:${i}`, type: 'mp' })), ...Array.from({ length: 150 }, (_, i) => ({ id: `org:${i}`, type: 'org' }))];
  const edges = nodes.filter(node => node.type === 'org').flatMap(org => nodes.filter(node => node.type === 'mp').map(mp => ({ id: `${org.id}|${mp.id}`, source: org.id, target: mp.id, weight: 1 })));
  const sample = { nodes, edges, bills: [], mpInterlocks: [] };
  const view = selectTransparencyView(sample, edges); assert.equal(view.nodes.length, 100); assert.equal(view.edges.length, 200);
  const larger = selectTransparencyView(sample, edges, { actorLimit: 125 });
  assert.equal(larger.nodes.length, 125);
  assert.equal(larger.edges.length, 484);
  assert.equal(larger.actorCount, 154);
  for (const preset of ['backbone', 'brokers']) {
    const all = selectTransparencyView(sample, edges, { preset, actorLimit: 'all' });
    assert.equal(all.nodes.length, nodes.length);
    assert.equal(all.edges.length, edges.length);
  }
  const limitedExpansion = selectTransparencyView(sample, edges, { actorLimit: 4, expanded: new Set(['mp:2']) });
  assert.equal(limitedExpansion.nodes.length, 4);
  assert.ok(limitedExpansion.nodes.some(node => node.id === 'mp:2'));
  const ego = selectTransparencyView(sample, edges, { ego: 'mp:0' }); assert.equal(ego.nodes.length, 100);
  const expanded = selectTransparencyView(sample, edges, { ego: 'mp:0', expanded: new Set(['mp:0']) }); assert.ok(expanded.nodes.length > 100);
  const columns = selectTransparencyView(graph, filtered, { layout: 'columns' }); assert.ok(columns.nodes.some(node => node.type === 'committee')); assert.ok(columns.edges.some(edge => edge.layers.includes('membership')));
});
test('pathfinder obeys the four-hop limit and rejects hidden or disconnected endpoints', () => {
  const nodes = Array.from({ length: 6 }, (_, i) => ({ id: String(i) })), edges = nodes.slice(1).map((node, i) => ({ id: `e${i}`, source: String(i), target: node.id }));
  assert.deepEqual(shortestTransparencyPath(nodes, edges, '0', '4').nodes, ['0', '1', '2', '3', '4']);
  assert.equal(shortestTransparencyPath(nodes, edges, '0', '5'), null);
  assert.equal(shortestTransparencyPath(nodes.slice(1), edges.slice(1), '0', '2'), null);
  assert.deepEqual(shortestTransparencyPath(nodes, edges, '0', '0').edges, []);
});
test('actor focus keeps only incident ties and the exact organisation–MP pair', () => {
  const mp = { id: 'mp:1', type: 'mp' }, other = { id: 'mp:2', type: 'mp' };
  const organisations = Array.from({ length: 32 }, (_, i) => ({ id: `org:${i}`, type: 'org', name: 'Same name' }));
  const ties = organisations.map(({ id }, i) => ({ id: `tie:${i}`, source: id, target: mp.id, weight: 50 - i }));
  const unrelated = { id: 'other', source: organisations[0].id, target: other.id, weight: 25 };
  const graph = { nodes: [mp, other, ...organisations], edges: [...ties, unrelated] };
  const neighbours = selectTransparencyView(graph, graph.edges, { focus: [mp.id] });
  assert.equal(neighbours.eligible.length, 32);
  assert.equal(neighbours.edges.length, 28);
  assert.ok(neighbours.edges.every(edge => edge.target === mp.id));
  const limited = selectTransparencyView(graph, graph.edges, { focus: [mp.id], actorLimit: 5 });
  assert.equal(limited.nodes.length, 5);
  assert.equal(limited.eligible.length, 32);
  const all = selectTransparencyView(graph, graph.edges, { focus: [mp.id], actorLimit: 'all' });
  assert.equal(all.nodes.length, 33);
  assert.equal(all.edges.length, 32);
  assert.deepEqual(selectTransparencyView(graph, graph.edges, { focus: [organisations[0].id] }).eligible, [ties[0], unrelated]);
  const focus = [mp.id, organisations[0].id];
  const pair = selectTransparencyView(graph, graph.edges, { focus, layout: 'columns' });
  assert.deepEqual(pair.edges, [ties[0]]);
  assert.equal(selectTransparencyView(graph, graph.edges, { focus: [other.id, organisations[1].id] }).filteredCount, 0);
  const positions = viewPositions(pair.nodes, 'force', null, 'degree', focus);
  assert.equal(positions.get(mp.id).y, positions.get(organisations[0].id).y);
  assert.equal(positions.get(mp.id).x, -positions.get(organisations[0].id).x);
  assert.deepEqual(viewPositions(neighbours.nodes, 'force', other.id, 'degree', [mp.id]).get(mp.id), { x: 0, y: 0 });
});
test('column and ring layouts preserve type columns, party grouping and selected ego centre', () => {
  const nodes = [{ id: 'b', type: 'mp', party: 'sd', name: 'B', degree: 2 }, { id: 'a', type: 'mp', party: 'kok', name: 'A', degree: 3 }, { id: 'o', type: 'org', name: 'O', degree: 5 }, { id: 'he', type: 'bill', name: 'HE', degree: 1 }];
  const columns = viewPositions(nodes, 'columns'); assert.equal(columns.get('o').x, 0); assert.equal(columns.get('a').x, 520); assert.equal(columns.get('he').x, 1040); assert.ok(columns.get('a').y < columns.get('b').y);
  assert.deepEqual(viewPositions(nodes, 'rings', 'b').get('b'), { x: 0, y: 0 });
});
