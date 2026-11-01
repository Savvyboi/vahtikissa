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
const graph = unpackTransparencyGraph(JSON.parse(bytes)), evidence = JSON.parse(evidenceBytes);
assert.equal(graph.snapshotId, manifest.id); assert.equal(evidence.snapshotId, manifest.id);
const nodes = new Map(graph.nodes.map(node => [node.id, node])), edges = new Map(graph.edges.map(edge => [edge.id, edge]));
const degree = new Map(graph.nodes.map(node => [node.id, 0]));
for (const edge of graph.edges) {
  assert.equal(nodes.get(edge.source).type, 'org'); assert.equal(nodes.get(edge.target).type, 'mp');
  degree.set(edge.source, degree.get(edge.source) + 1); degree.set(edge.target, degree.get(edge.target) + 1);
  assert.equal(edgeWeight(edge.counts), edge.weight);
  for (const detail of edge.details) { assert.ok(evidence.records[detail.id], detail.id); if (detail.inferred) assert.ok(detail.viaCommittee); }
}
for (const node of graph.nodes) {
  assert.equal(node.degree, degree.get(node.id));
  for (const key of ['betweenness', 'pagerank']) assert.ok(node[key] >= 0 && node[key] <= 1, `${node.id} ${key}`);
  assert.ok(node.eiIndex >= -1 && node.eiIndex <= 1); assert.ok(Number.isFinite(node.initialX)); assert.ok(Number.isFinite(node.initialY));
  if (node.type === 'org') assert.ok(Math.abs(Object.values(node.partyBreakdown).reduce((a, b) => a + b, 0) - 1) < 1e-8);
}
assert.ok(Math.abs(graph.nodes.reduce((sum, node) => sum + node.pagerank, 0) - 1) < 1e-8);
for (const edge of graph.mpInterlocks) for (const org of edge.sharedOrgs) org.edgeIds.forEach(id => assert.ok(edges.has(id)));
assert.ok(graph.orgCoalitions.length <= 150);
console.log(`Validated transparency snapshot ${manifest.id}: ${nodes.size} nodes, ${edges.size} ties; source hashes, metrics, evidence and projections reconcile.`);
