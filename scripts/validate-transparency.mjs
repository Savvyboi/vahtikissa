import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { unpackTransparencyGraph, edgeWeight } from '../transparency-model.js';

const root = new URL('../', import.meta.url), base = new URL('data/networks/', root);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(new URL('transparency.json', base)));
for (const source of manifest.sources) assert.equal(digest(await readFile(new URL(source.path, root))), source.sha256, source.path);
const bytes = await readFile(new URL(manifest.graphFile, base)); assert.equal(digest(bytes), manifest.graphSha256);
const evidenceBytes = await readFile(new URL(manifest.evidenceFile, base)); assert.equal(digest(evidenceBytes), manifest.evidenceSha256);
const packed = JSON.parse(bytes), graph = unpackTransparencyGraph(packed), evidence = JSON.parse(evidenceBytes);
assert.equal(graph.snapshotId, manifest.id); assert.equal(evidence.snapshotId, manifest.id);
const nodes = new Map(graph.nodes.map(node => [node.id, node])), edges = new Map(graph.edges.map(edge => [edge.id, edge]));
const degree = new Map(graph.nodes.map(node => [node.id, 0]));
const read = async path => JSON.parse(await readFile(new URL(path, root)));
const [influence, parliament, profiles] = await Promise.all(['data/influence.json', 'data/parliament.json', 'data/member-profiles.json'].map(read));
const clean = value => String(value || '').normalize('NFC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('fi');
const records = new Map(['interests', 'gifts', 'lobbying'].flatMap((key, i) => influence[key].map(row => [`${['sidonnaisuus', 'lahja', 'lobbaus'][i]}:${row.id}`, row])));
const targets = new Map(influence.targets.map(row => [String(row.id), row]));
const members = new Map(parliament.members.map(row => [String(row.id), row]));
assert.equal(nodes.size, graph.nodes.length); assert.equal(edges.size, graph.edges.length);
assert.deepEqual(evidence.targets, Object.fromEntries(influence.targets.map(row => [row.id, row])));
const strength = new Map(graph.nodes.map(node => [node.id, 0])), incomingRank = new Map(graph.nodes.map(node => [node.id, 0]));
let inferredCount = 0, directCount = 0;
for (const [index, edge] of graph.edges.entries()) {
  assert.equal(nodes.get(edge.source).type, 'org'); assert.equal(nodes.get(edge.target).type, 'mp');
  degree.set(edge.source, degree.get(edge.source) + 1); degree.set(edge.target, degree.get(edge.target) + 1);
  strength.set(edge.source, strength.get(edge.source) + edge.weight); strength.set(edge.target, strength.get(edge.target) + edge.weight);
  assert.equal(edgeWeight(edge.counts), edge.weight);
  assert.equal(packed.edges[index][2], edge.weight, `${edge.id}: packed weight must agree before decoding recomputes it`);
  const org = nodes.get(edge.source), mp = nodes.get(edge.target);
  for (const detail of edge.details) {
    const row = evidence.records[detail.id], original = records.get(detail.id);
    assert.ok(row && original, `${detail.id}: source record exists`);
    assert.equal(row.id, original.id); assert.equal(row.layer, detail.layer);
    if (detail.layer !== 'lobbaus') {
      assert.equal(row.mpId, mp.mpId, `${detail.id}: disclosed member identity`);
      assert.deepEqual(detail.periods, [String(row.year)]);
      if (detail.layer === 'lahja') {
        assert.deepEqual(row.raw, original.raw, `${detail.id}: preserved gift text`);
        assert.ok(org.aliases.some(alias => clean(row.donor).includes(clean(alias))), `${detail.id}: donor alias in source`);
        if (row.amount != null) assert.ok(Number.isFinite(row.amount) && row.amount >= 0);
      } else {
        assert.equal(row.description, original.description);
        assert.ok(org.aliases.some(alias => clean(row.organization || row.description).includes(clean(alias))), `${detail.id}: organisation text in declaration`);
        if (detail.board) assert.match(row.description, /hallitu|hallintoneuv|johtokun|\bboard\b|styrelse/iu, `${detail.id}: explicit governing board`);
      }
    } else {
      assert.equal(row.topic, original.topic); assert.deepEqual(row.period, original.period);
      assert.equal(row.reported, original.reported); assert.equal(row.companyId, original.companyId);
      assert.ok(row.period.start <= row.period.end && row.period.end < graph.asOf);
      const mentionedHE = [...new Set([...row.topic.matchAll(/\bHE\s*(\d+)\s*\/\s*(\d{4})\b/giu)].filter(match => Number(match[1])).map(match => `HE ${Number(match[1])}/${match[2]} vp`))].sort();
      assert.deepEqual(detail.heIds, mentionedHE, `${detail.id}: exact textual HE references`);
      assert.deepEqual(detail.periods, Array.from({ length: Number(row.period.end.slice(0, 4)) - Number(row.period.start.slice(0, 4)) + 1 }, (_, i) => String(Number(row.period.start.slice(0, 4)) + i)), `${detail.id}: contact period rather than disclosure date`);
      if (row.companyId) assert.equal(org.yTunnus, row.companyId, `${detail.id}: declared business/registry ID`);
      assert.ok(row.targetIds.map(String).includes(String(detail.targetId)), `${detail.id}: target must be declared`);
      const target = targets.get(String(detail.targetId)); assert.ok(target);
      if (detail.inferred) {
        inferredCount++;
        const labels = [target.fi?.unit, target.fi?.department, target.fi?.organization, target.sv?.unit].map(clean);
        const supported = profiles.members[mp.mpId].committees.some(membership => membership.id.replace(/\d+$/u, '') === detail.viaCommittee && Object.values(membership.name).some(label => labels.includes(clean(label))) && membership.from <= row.period.end && (!membership.to || membership.to >= row.period.start) && membership.role.fi !== 'Varajäsen');
        assert.ok(supported, `${detail.id}/${mp.mpId}: ordinary membership overlapping this exact reporting period`);
      } else {
        directCount++;
        const name = clean(target.fi?.name || target.sv?.name);
        assert.equal(name, clean(`${members.get(mp.mpId).firstName} ${members.get(mp.mpId).lastName}`), `${detail.id}: exact recipient name`);
        assert.equal(parliament.members.filter(member => clean(`${member.firstName} ${member.lastName}`) === name).length, 1, `${detail.id}: unambiguous recipient`);
      }
      assert.ok(row.sourceUrl.endsWith(`/diary-number/${encodeURIComponent(row.diaryNumber)}`), `${detail.id}: exact official declaration URL`);
    }
  }
}
assert.equal(inferredCount, graph.coverage.inferredCommitteeAssociations);
const government = [...new Set(parliament.members.filter(member => profiles.members[member.id].government.fi.some(term => term.from <= graph.asOf && (!term.to || term.to >= graph.asOf))).map(member => member.party))].sort();
assert.deepEqual(graph.method.government.parties, government);
const peers = new Map(graph.nodes.filter(node => node.type === 'mp').map(node => [node.id, new Set()]));
for (const edge of graph.mpInterlocks) {
  peers.get(edge.source).add(edge.target); peers.get(edge.target).add(edge.source);
  assert.equal(edge.weight, edge.sharedOrgs.length);
  assert.equal(edge.isCrossParty, nodes.get(edge.source).party !== nodes.get(edge.target).party);
  assert.equal(edge.isCrossBloc, nodes.get(edge.source).isGovernment !== nodes.get(edge.target).isGovernment);
  for (const org of edge.sharedOrgs) {
    const support = org.edgeIds.map(id => edges.get(id)); assert.equal(support.length, 2);
    assert.ok(support.every(tie => tie?.source === org.id));
    assert.deepEqual(support.map(tie => tie.target).sort(), [edge.source, edge.target].sort());
    for (const year of org.periods) assert.ok(support.every(tie => tie.details.some(detail => detail.board && detail.periods.includes(year))), `${edge.id}: source board evidence in common year ${year}`);
  }
}
for (const node of graph.nodes) {
  assert.equal(node.degree, degree.get(node.id));
  assert.equal(node.weightedDegree, +strength.get(node.id).toFixed(2));
  for (const key of ['betweenness', 'pagerank']) assert.ok(node[key] >= 0 && node[key] <= 1, `${node.id} ${key}`);
  assert.ok(node.eiIndex >= -1 && node.eiIndex <= 1); assert.ok(Number.isFinite(node.initialX)); assert.ok(Number.isFinite(node.initialY));
  if (node.type === 'org') {
    const people = graph.edges.filter(edge => edge.source === node.id).map(edge => nodes.get(edge.target));
    for (const party of new Set(people.map(mp => mp.party))) assert.ok(Math.abs(node.partyBreakdown[party] - people.filter(mp => mp.party === party).length / people.length) < 1e-10);
    let external = 0, internal = 0;
    for (let a = 0; a < people.length; a++) for (let b = a + 1; b < people.length; b++) if (people[a].isGovernment === people[b].isGovernment) internal++; else external++;
    assert.ok(Math.abs(node.eiIndex - (external + internal ? (external - internal) / (external + internal) : 0)) < 1e-12);
  } else {
    assert.equal(node.isGovernment, government.includes(node.party));
    const adjacent = [...peers.get(node.id)], same = adjacent.filter(id => nodes.get(id).party === node.party).length;
    assert.equal(node.eiIndex, adjacent.length ? (adjacent.length - 2 * same) / adjacent.length : 0);
  }
}
assert.ok(Math.abs(graph.nodes.reduce((sum, node) => sum + node.pagerank, 0) - 1) < 1e-8);
// Check the fixed-point equation across the entire actual source graph.
for (const edge of graph.edges) {
  incomingRank.set(edge.target, incomingRank.get(edge.target) + nodes.get(edge.source).pagerank * edge.weight / strength.get(edge.source));
  incomingRank.set(edge.source, incomingRank.get(edge.source) + nodes.get(edge.target).pagerank * edge.weight / strength.get(edge.target));
}
const dangling = graph.nodes.filter(node => !node.degree).reduce((sum, node) => sum + node.pagerank, 0);
for (const node of graph.nodes) assert.ok(Math.abs(node.pagerank - ((0.15 + 0.85 * dangling) / nodes.size + 0.85 * incomingRank.get(node.id))) < 1e-9, `${node.id}: weighted PageRank equation`);
for (const bill of graph.bills) {
  const matter = parliament.legislation.find(row => row.id === bill.heId);
  assert.equal(bill.available, !!matter); assert.equal(bill.title, matter?.title || ''); assert.equal(bill.voteCount, matter?.voteIds?.length || 0);
}
assert.ok(graph.orgCoalitions.length <= 150);
// Independent coalition construction: intersect each pair's topic sets,
// rather than accumulating pairs inside each source topic group.
const committeeNames = new Map(Object.values(profiles.members).flatMap(profile => profile.committees.flatMap(row => Object.values(row.name).map(name => [clean(name), row.id.replace(/\d+$/u, '')]))));
const orgTopics = new Map();
for (const row of influence.lobbying) {
  const org = `org:yt:${row.companyId}`;
  if (!nodes.has(org) || !row.period?.end || row.period.end >= graph.asOf) continue;
  if (!orgTopics.has(org)) orgTopics.set(org, new Set());
  const topics = orgTopics.get(org);
  for (const match of row.topic.matchAll(/\bHE\s*(\d+)\s*\/\s*(\d{4})\b/giu)) if (Number(match[1])) topics.add(`bill:HE ${Number(match[1])}/${match[2]} vp`);
  const committees = [...new Set(row.targetIds.flatMap(id => { const target = targets.get(String(id)); return [target?.fi?.unit, target?.fi?.department].map(label => committeeNames.get(clean(label))).filter(Boolean); }))].sort();
  if (committees.length) topics.add(`committees:${committees.join('+')}`);
}
const orgIds = [...orgTopics.keys()].sort(), topCoalitions = [];
for (let a = 0; a < orgIds.length; a++) for (let b = a + 1; b < orgIds.length; b++) {
  let first = orgTopics.get(orgIds[a]), second = orgTopics.get(orgIds[b]);
  if (first.size > second.size) [first, second] = [second, first];
  const sharedTopics = [...first].filter(topic => second.has(topic));
  if (!sharedTopics.length || topCoalitions.length === 150 && sharedTopics.length < topCoalitions.at(-1).weight) continue;
  const key = `${orgIds[a]}|${orgIds[b]}`;
  topCoalitions.push({ id: `coalition:${digest(key).slice(0, 16)}`, weight: sharedTopics.length, sharedTopics });
  topCoalitions.sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  if (topCoalitions.length > 150) topCoalitions.pop();
}
assert.deepEqual(graph.orgCoalitions.map(edge => [edge.id, edge.weight]), topCoalitions.map(edge => [edge.id, edge.weight]), 'Top 150 shared-target organisation pairs');
graph.orgCoalitions.forEach((edge, i) => assert.deepEqual([...edge.sharedTopics].sort(), topCoalitions[i].sharedTopics.sort(), `${edge.id}: exact shared HE/committee-set support`));
console.log(`Validated transparency snapshot ${manifest.id}: ${nodes.size} nodes, ${edges.size} ties; ${directCount} direct and ${inferredCount} inferred lobbying references. Packed weights, exact recipient IDs/names, original gifts, membership intervals, business IDs, E–I, party shares, PageRank equations and board support reconcile. This does not independently authenticate every upstream declaration.`);
