import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGiftDisclosure } from '../civic-utils.js';
import { normalizeOrgName, extractHEIds, classifyOrganization, interestOrganizations, precomputeMetrics, buildTransparencyGraph } from '../scripts/transparency-graph.mjs';
import { packTransparencyGraph, unpackTransparencyGraph, filterTransparencyGraph, selectTransparencyView } from '../transparency-model.js';

test('multiline official gifts retain their donor, full description, exact amount and separate dates', () => {
  const raw = 'Ilmoitettu: 06.09.2024. Antaja: Example ry\n\n. Kuvaus: Matkat\nHotelli ja ruokailu, 2 332,98 euroa. Käyttöaika: 19.08.2024 - 25.08.2024.';
  const gift = parseGiftDisclosure(raw);
  assert.equal(gift.donor, 'Example ry'); assert.equal(gift.description, 'Matkat\nHotelli ja ruokailu');
  assert.equal(gift.amount, 2332.98); assert.equal(gift.reported, '06.09.2024'); assert.equal(gift.used, '19.08.2024 - 25.08.2024');
  assert.equal(gift.raw, raw);
});
test('punctuation aliases match without inventing bilingual or subsidiary identities', () => {
  assert.equal(normalizeOrgName('Musiikkituottajat – IFPI Finland r.y.'), normalizeOrgName('Musiikkituottajat- IFPI Finland ry'));
  assert.equal(normalizeOrgName('Example r.f.'), normalizeOrgName('Example rf'));
  assert.notEqual(normalizeOrgName('Example Finland Oy'), normalizeOrgName('Example Sweden AB'));
  assert.deepEqual(extractHEIds('HE 5/20245; HE 0/2024; HE 56/2026; HE113/2025.'), ['HE 113/2025 vp', 'HE 56/2026 vp']);
});
test('quoted amounts and use-period labels inside a gift description do not replace its appended fields', () => {
  const gift = parseGiftDisclosure('Ilmoitettu: 05.03.2025. Antaja: Example. Kuvaus: Lento, 100,00 euroa. Käyttöaika: vanha maininta, 3 324,30 euroa. Käyttöaika: 25.01.2025 - 01.02.2025.');
  assert.equal(gift.amount, 3324.3); assert.equal(gift.used, '25.01.2025 - 01.02.2025');
  assert.equal(gift.description, 'Lento, 100,00 euroa. Käyttöaika: vanha maininta');
});
test('administrative categories alone never establish a shared board', () => {
  const base = { declared: true, type: 'interest', category: 'Hallinto- ja luottamustehtävät' };
  for (const description of ['Example, kunnanvaltuuston jäsen', 'Example, valtuuskunnan jäsen', 'Example, edustaja', 'valtuutettu, Example 2022-2025']) assert.equal(interestOrganizations({ ...base, description })[0].board, false, description);
  for (const description of ['Example Oy, hallituksen jäsen', 'Example Oy:n hallintoneuvosto, jäsen', 'Example, johtokunnan puheenjohtaja']) assert.equal(interestOrganizations({ ...base, description })[0].board, true, description);
  for (const description of ['aluesyyttäjä (virkavapaalla)', 'Ylilääkäri, HUS, Akuutti, virkavapaa', 'Helsingin kaupunginvaltuutettu', 'Example hallitus, Another hallitus, Third edustajisto']) assert.deepEqual(interestOrganizations({ ...base, description }), [], description);
});
test('real role-first source shapes resolve the named body rather than merging people by job titles', () => {
  assert.equal(classifyOrganization('Energiavirasto'), 'Julkisyhteisöt & Valtionyhtiöt');
  const base = { declared: true, type: 'interest', category: 'Palkatut toimet ja luottamustehtävät' };
  for (const description of ['Kansanedustaja', 'Kansanedustaja (eduskunta, valtio)', 'Kaupunginvaltuutettu, kaupunginvaltuuston vpj., konsernijaoston jäsen. Salon kaupunki']) assert.deepEqual(interestOrganizations({ ...base, description }), []);
  for (const [description, name, board] of [
    ['Lakimies, Energiavirasto (virkavapaalla edustajatoimen vuoksi)', 'Energiavirasto', false],
    ['Toimitusjohtaja, MediaFactory oy', 'MediaFactory oy', false],
    ['Hallituksen jäsen, varapuheenjohtaja Carboreal oyj', 'Carboreal oyj', true],
    ['kaupunginvaltuuston 1. varapuheenjohtaja, Rovaniemen kaupunki', 'Rovaniemen kaupunki', false],
    ['Kaupunginvaltuutettu, kaupunginhallituksen varajäsen, Tampere', 'Tampere', true],
    ['Kaupunginvaltuutettu, kaupunginvaltuuston 2. varapuheenjohtaja (Naantalin kaupunki)', 'Naantalin kaupunki', false]
  ]) { const [actual] = interestOrganizations({ ...base, description }); assert.equal(actual?.name, name, description); assert.equal(actual.board, board, description); }
});

function boardFixture() {
  const members = [1, 2, 3].map(id => ({ id: String(id), firstName: `Person${id}`, lastName: 'Test', party: id === 1 ? 'g' : 'o' }));
  return { parliament: { members, legislation: [] }, governmentParties: ['g'], influence: { metadata: { generatedAt: '2026-11-01', parliamentSource: 'https://example.org/members', transparencySource: 'https://example.org/lobbying' }, lobbying: [], gifts: [], targets: [], interests: members.flatMap(member => [2024, 2025].map(year => ({ id: `${member.id}-${year}`, mpId: member.id, year, declared: true, type: 'interest', category: 'Hallinto- ja luottamustehtävät', organization: 'Shared Oy', description: 'hallituksen jäsen' }))) } };
}
test('interlock evidence years, E–I and party shares reconcile after period filtering', () => {
  const graph = unpackTransparencyGraph(packTransparencyGraph(buildTransparencyGraph(boardFixture()).graph));
  const first = graph.nodes.find(node => node.id === 'mp:1'), second = graph.nodes.find(node => node.id === 'mp:2'), org = graph.nodes.find(node => node.type === 'org');
  assert.equal(first.eiIndex, 1); assert.equal(second.eiIndex, 0);
  assert.ok(Math.abs(org.eiIndex - 1 / 3) < 1e-12);
  assert.deepEqual(org.partyBreakdown, { g: 1 / 3, o: 2 / 3 });
  const ties = filterTransparencyGraph(graph, { facets: { year: { include: ['2024'], exclude: ['2025'] } } });
  const view = selectTransparencyView(graph, ties, { preset: 'interlocks' });
  assert.equal(view.eligible.length, 2);
  for (const edge of view.edges) { assert.deepEqual(edge.periods, ['2024']); assert.deepEqual(edge.sharedOrgs[0].periods, ['2024']); }
  const councils = boardFixture(); councils.influence.interests.forEach(row => { row.description = 'kunnanvaltuuston jäsen'; });
  assert.equal(buildTransparencyGraph(councils).graph.mpInterlocks.length, 0);
});
test('old gift snapshots are repaired from preserved original text and provenance survives packing', () => {
  const input = boardFixture();
  input.influence.gifts = [{ id: 'gift', mpId: '1', year: 2024, donor: '', amount: 123.45, raw: { fi: 'Ilmoitettu: 1.9.2024. Antaja: Shared Oy\n. Kuvaus: A gift, 123,45 euroa. Käyttöaika: 1.6.2024.' } }];
  input.influence.interests[0].organization = undefined; input.influence.interests[0].description = 'Shared Oy, hallituksen jäsen';
  const { graph, records } = buildTransparencyGraph(input);
  assert.equal(records['lahja:gift'].donor, 'Shared Oy'); assert.equal(records['lahja:gift'].amount, 123.45);
  assert.equal(graph.edges.find(edge => edge.target === 'mp:1').counts.lahja, 1);
  const decoded = unpackTransparencyGraph(packTransparencyGraph(graph));
  assert.equal(decoded.edges.find(edge => edge.target === 'mp:1').details.find(d => d.id === 'sidonnaisuus:1-2024').extraction, 'automatic-role-text');
});

// A deliberately different reference method: enumerate every simple path in
// tiny graphs, keep the shortest paths, and count each intermediate actor.
function enumerateBetweenness(nodes, edges) {
  const neighbours = new Map(nodes.map(node => [node.id, []])), result = Object.fromEntries(nodes.map(node => [node.id, 0]));
  for (const edge of edges) { neighbours.get(edge.source).push(edge.target); neighbours.get(edge.target).push(edge.source); }
  for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
    let shortest = Infinity, paths = [];
    function walk(path) {
      const last = path.at(-1);
      if (last === nodes[b].id) { if (path.length < shortest) { shortest = path.length; paths = []; } if (path.length === shortest) paths.push(path); return; }
      if (path.length >= shortest) return;
      for (const next of neighbours.get(last)) if (!path.includes(next)) walk([...path, next]);
    }
    walk([nodes[a].id]);
    for (const path of paths) for (const id of path.slice(1, -1)) result[id] += 1 / paths.length;
  }
  for (const id of Object.keys(result)) result[id] *= nodes.length > 2 ? 2 / ((nodes.length - 1) * (nodes.length - 2)) : 0;
  return result;
}
// Solve (I - .85 P)r = .15/n directly, including uniform dangling mass.
function solvePageRank(nodes, edges) {
  const n = nodes.length, strength = Array(n).fill(0), transition = Array.from({ length: n }, () => Array(n).fill(0));
  const index = id => nodes.findIndex(node => node.id === id);
  for (const edge of edges) { const a = index(edge.source), b = index(edge.target); strength[a] += edge.weight; strength[b] += edge.weight; transition[a][b] += edge.weight; transition[b][a] += edge.weight; }
  const matrix = Array.from({ length: n }, (_, to) => [...Array.from({ length: n }, (_, from) => Number(to === from) - 0.85 * (strength[from] ? transition[from][to] / strength[from] : 1 / n)), 0.15 / n]);
  for (let col = 0; col < n; col++) {
    const pivot = matrix[col][col]; for (let j = col; j <= n; j++) matrix[col][j] /= pivot;
    for (let i = 0; i < n; i++) if (i !== col) { const factor = matrix[i][col]; for (let j = col; j <= n; j++) matrix[i][j] -= factor * matrix[col][j]; }
  }
  return matrix.map(row => row[n]);
}
test('Brandes and weighted PageRank agree with path enumeration and a linear-system solution', () => {
  const examples = [[], [[0, 1], [1, 2]], [[0, 1], [1, 2], [2, 3], [3, 0]], [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]], [[0, 1], [1, 2], [2, 0], [2, 3], [3, 4], [4, 5], [5, 3]]];
  for (const pairs of examples) {
    const nodes = Array.from({ length: 6 }, (_, i) => ({ id: String(i) }));
    const edges = pairs.map(([a, b], i) => ({ source: String(a), target: String(b), weight: 1 + (i % 3) * 2.5 }));
    const expectedBetween = enumerateBetweenness(nodes, edges), expectedRank = solvePageRank(nodes, edges);
    precomputeMetrics(nodes, edges);
    nodes.forEach((node, i) => {
      assert.ok(Math.abs(node.betweenness - expectedBetween[node.id]) < 1e-12, `betweenness ${JSON.stringify(pairs)} / ${node.id}`);
      assert.ok(Math.abs(node.pagerank - expectedRank[i]) < 1e-9, `weighted PageRank ${node.id}`);
      assert.equal(node.degree, edges.filter(edge => edge.source === node.id || edge.target === node.id).length);
      assert.equal(node.weightedDegree, edges.filter(edge => edge.source === node.id || edge.target === node.id).reduce((sum, edge) => sum + edge.weight, 0));
    });
  }
});
test('seeded weighted Louvain separates known dense groups and repeats exactly', () => {
  const create = () => Array.from({ length: 6 }, (_, i) => ({ id: String(i) }));
  const pairs = [[0, 1], [0, 2], [1, 2], [3, 4], [3, 5], [4, 5], [2, 3]];
  const edges = pairs.map(([a, b], i) => ({ source: String(a), target: String(b), weight: i === 6 ? 0.1 : 5 }));
  const nodes = create(), again = create(); precomputeMetrics(nodes, edges); precomputeMetrics(again, edges);
  assert.deepEqual(nodes, again);
  assert.equal(nodes[0].communityId, nodes[2].communityId); assert.equal(nodes[3].communityId, nodes[5].communityId);
  assert.notEqual(nodes[0].communityId, nodes[3].communityId);
});
