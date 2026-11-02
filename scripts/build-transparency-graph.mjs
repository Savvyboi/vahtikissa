import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { buildTransparencyGraph } from './transparency-graph.mjs';
import { packTransparencyGraph } from '../transparency-model.js';

const root = new URL('../', import.meta.url), output = new URL('data/networks/', root);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function buildTransparencyData({ force = false } = {}) {
  const paths = ['data/influence.json', 'data/parliament.json', 'data/member-profiles.json', 'data/committee-index.json', 'scripts/transparency-graph.mjs', 'scripts/build-transparency-graph.mjs', 'package-lock.json', 'transparency-model.js', 'collection-tools.js', 'civic-utils.js'];
  const inputs = await Promise.all(paths.map(async path => ({ path, bytes: await readFile(new URL(path, root)) })));
  const sources = inputs.map(({ path, bytes }) => ({ path, sha256: digest(bytes) }));
  const id = digest(JSON.stringify(sources)).slice(0, 24);
  const indexFile = new URL('transparency.json', output);
  if (!force) try {
    const old = JSON.parse(await readFile(indexFile, 'utf8'));
    if (old.id === id) {
      const [graph, evidence] = await Promise.all([readFile(new URL(old.graphFile, output)), readFile(new URL(old.evidenceFile, output))]);
      if (digest(graph) === old.graphSha256 && digest(evidence) === old.evidenceSha256) return old;
      // Repair incomplete/corrupted local outputs; an existing file alone is
      // insufficient evidence that this content-addressed snapshot is intact.
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const parse = path => JSON.parse(inputs.find(input => input.path === path).bytes);
  console.log('Precomputing transparency graph: entities, centralities, Louvain and force coordinates…');
  const { graph, records } = buildTransparencyGraph({ influence: parse(paths[0]), parliament: parse(paths[1]), profiles: parse(paths[2]), committeeIndex: parse(paths[3]) });
  const folder = new URL(`transparency-${id}/`, output); await mkdir(folder, { recursive: true });
  const graphBody = JSON.stringify({ ...packTransparencyGraph(graph), snapshotId: id }), evidenceBody = JSON.stringify({ snapshotId: id, records, targets: Object.fromEntries(parse(paths[0]).targets.map(target => [target.id, target])) });
  await writeFile(new URL('graph.json', folder), graphBody); await writeFile(new URL('evidence.json', folder), evidenceBody);
  const manifest = { id, asOf: graph.asOf, graphFile: `transparency-${id}/graph.json`, graphSha256: digest(graphBody), evidenceFile: `transparency-${id}/evidence.json`, evidenceSha256: digest(evidenceBody), sources, nodes: graph.nodes.length, edges: graph.edges.length };
  // A simultaneous sync must not publish coordinates from mixed input versions.
  for (const input of sources) if (digest(await readFile(new URL(input.path, root))) !== input.sha256) throw Error(`Transparency input changed: ${input.path}. Rebuild.`);
  const next = new URL(`transparency-${process.pid}.next.json`, output); await writeFile(next, JSON.stringify(manifest)); await rename(next, indexFile);
  console.log(`Prepared transparency snapshot ${id}: ${graph.nodes.length} nodes, ${graph.edges.length} ties, ${(Buffer.byteLength(graphBody) / 1e6).toFixed(1)} MB; raw evidence loads on inspection.`);
  return manifest;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildTransparencyData({ force: process.argv.includes('--force') }).catch(error => { console.error(error); process.exitCode = 1; });
