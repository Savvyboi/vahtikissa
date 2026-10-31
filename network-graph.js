// Small, dependency-free undirected weighted graph methods for offline builds.
export const GRAPH_METHOD_VERSION = 'voting-graph-1';
const EPS = 1e-10;
const idOf = node => String(typeof node === 'object' ? node.id : node);
export function buildVotingGraph(analysis, options = {}) {
  const { k = 5, minAgreement = 0.5, minCommon = analysis.method?.minCommon || 30, weighting = 'agreement' } = options;
  if (!Number.isInteger(k) || k < 1 || minAgreement < 0 || minAgreement > 1 || minCommon < 1 || !['agreement', 'matterWeighted', 'sessionWeighted', 'yesNo', 'contested'].includes(weighting)) throw new Error('Invalid graph settings');
  const nodes = analysis.nodes || [], candidates = new Map(nodes.map(n => [String(n.id), []]));
  for (const p of analysis.pairs || []) {
    const weight = weighting === 'agreement' ? p.agreement : p[weighting]?.agreement;
    const support = ['yesNo', 'contested'].includes(weighting) ? p[weighting]?.common || 0 : p.common;
    if (support < minCommon || weight === null || !Number.isFinite(weight) || weight < minAgreement || weight <= 0) continue;
    const edge = { a: p.a, b: p.b, weight, distance: 1 / weight, common: support, agreement: p.agreement, voteIds: p.voteIds };
    candidates.get(String(p.a))?.push(edge); candidates.get(String(p.b))?.push(edge);
  }
  const edges = new Map();
  for (const list of candidates.values()) {
    list.sort((a, b) => b.weight - a.weight || a.a.localeCompare(b.a) || a.b.localeCompare(b.b));
    // Include all ties at kth place: ID order must not manufacture an edge choice.
    const threshold = list[Math.min(k, list.length) - 1]?.weight;
    for (const edge of list) if (edge.weight >= threshold - EPS) edges.set(`${edge.a}\0${edge.b}`, edge);
  }
  return { nodes, edges: [...edges.values()], method: { version: GRAPH_METHOD_VERSION, layer: 'voting', k, minAgreement, minCommon, weighting, sparsification: 'union of k nearest supported neighbours, including kth-place ties', distance: '1 / positive similarity', interpretation: 'Analytical similarity paths; not observed communication routes. Layout has no analytical meaning.' } };
}

function indexed(graph) {
  const ids = graph.nodes.map(idOf), positions = new Map(ids.map((id, i) => [id, i])), adjacent = ids.map(() => []);
  const seen = new Set();
  for (const edge of graph.edges) {
    const a = positions.get(String(edge.a)), b = positions.get(String(edge.b)), weight = edge.weight ?? 1, distance = edge.distance ?? 1 / weight;
    if (a === undefined || b === undefined || a === b || !(weight > 0) || !(distance > 0) || !Number.isFinite(distance)) continue;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (seen.has(key)) continue; seen.add(key);
    adjacent[a].push({ node: b, weight, distance }); adjacent[b].push({ node: a, weight, distance });
  }
  return { ids, adjacent };
}

export function graphComponents(graph) {
  const { ids, adjacent } = indexed(graph), visited = new Set(), components = [];
  for (let node = 0; node < ids.length; node++) {
    if (visited.has(node)) continue;
    const queue = [node]; visited.add(node);
    for (let q = 0; q < queue.length; q++) for (const edge of adjacent[queue[q]]) if (!visited.has(edge.node)) { visited.add(edge.node); queue.push(edge.node); }
    components.push(queue.map(i => ids[i]));
  }
  return components;
}

// Brandes with Dijkstra; O(V^3 + VE) is bounded for the ~220-MP snapshot.
export function weightedBetweenness(graph) {
  const { ids, adjacent } = indexed(graph), n = ids.length, centrality = new Float64Array(n);
  for (let source = 0; source < n; source++) {
    const distance = new Float64Array(n).fill(Infinity), paths = new Float64Array(n), done = new Uint8Array(n), predecessors = ids.map(() => []), stack = [];
    distance[source] = 0; paths[source] = 1;
    for (let step = 0; step < n; step++) {
      let v = -1;
      for (let i = 0; i < n; i++) if (!done[i] && (v < 0 || distance[i] < distance[v])) v = i;
      if (v < 0 || !Number.isFinite(distance[v])) break;
      done[v] = 1; stack.push(v);
      for (const edge of adjacent[v]) {
        const w = edge.node, candidate = distance[v] + edge.distance;
        if (candidate < distance[w] - EPS) { distance[w] = candidate; paths[w] = paths[v]; predecessors[w] = [v]; }
        else if (Math.abs(candidate - distance[w]) <= EPS) { paths[w] += paths[v]; predecessors[w].push(v); }
      }
    }
    const dependency = new Float64Array(n);
    for (let j = stack.length - 1; j >= 0; j--) {
      const w = stack[j];
      for (const v of predecessors[w]) dependency[v] += paths[v] / paths[w] * (1 + dependency[w]);
      if (w !== source) centrality[w] += dependency[w];
    }
  }
  // Undirected paths were counted twice. Global normalization retains isolates.
  return ids.map((id, i) => ({ id, score: n > 2 ? centrality[i] / ((n - 1) * (n - 2)) : 0, raw: centrality[i] / 2 }));
}

function random(seed) { let state = seed >>> 0; return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; }; }
export function modularity(graph, labels, resolution = 1) {
  const { ids, adjacent } = indexed(graph), assignments = labels instanceof Map ? labels : new Map(Object.entries(labels));
  const degree = adjacent.map(list => list.reduce((sum, edge) => sum + edge.weight, 0)), twiceWeight = degree.reduce((a, b) => a + b, 0);
  if (!twiceWeight) return 0;
  const totals = new Map(); let inside = 0;
  for (let i = 0; i < ids.length; i++) {
    const label = assignments.get(ids[i]); totals.set(label, (totals.get(label) || 0) + degree[i]);
    for (const edge of adjacent[i]) if (label === assignments.get(ids[edge.node])) inside += edge.weight;
  }
  return inside / twiceWeight - resolution * [...totals.values()].reduce((sum, total) => sum + (total / twiceWeight) ** 2, 0);
}

// Seeded modularity local moving, with singleton initialisation and a declared
// resolution. This is not advertised as Leiden or as evidence of factions.
export function detectCommunities(graph, { seed = 1, resolution = 1, maxPasses = 100 } = {}) {
  const { ids, adjacent } = indexed(graph), n = ids.length, degree = adjacent.map(list => list.reduce((s, e) => s + e.weight, 0)), total = degree.reduce((a, b) => a + b, 0), labels = ids.map((_, i) => i), communityDegree = [...degree], rng = random(seed);
  if (total) for (let pass = 0; pass < maxPasses; pass++) {
    const order = ids.map((_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    let moved = false;
    for (const node of order) {
      const old = labels[node], links = new Map();
      for (const edge of adjacent[node]) links.set(labels[edge.node], (links.get(labels[edge.node]) || 0) + edge.weight);
      communityDegree[old] -= degree[node];
      let best = old, bestGain = (links.get(old) || 0) - resolution * degree[node] * communityDegree[old] / total;
      for (const [community, weight] of links) {
        const gain = weight - resolution * degree[node] * communityDegree[community] / total;
        if (gain > bestGain + EPS) { bestGain = gain; best = community; }
      }
      labels[node] = best; communityDegree[best] += degree[node]; moved ||= best !== old;
    }
    if (!moved) break;
  }
  // Split disconnected groups; a modularity label alone cannot assert connectivity.
  const assigned = new Map(), seen = new Set(); let group = 0;
  for (let i = 0; i < n; i++) {
    if (seen.has(i)) continue;
    const queue = [i]; seen.add(i);
    for (let q = 0; q < queue.length; q++) for (const edge of adjacent[queue[q]]) if (!seen.has(edge.node) && labels[edge.node] === labels[i]) { seen.add(edge.node); queue.push(edge.node); }
    for (const node of queue) assigned.set(ids[node], group); group++;
  }
  return { assignments: Object.fromEntries(assigned), groups: group, modularity: modularity(graph, assigned, resolution), seed, resolution };
}

export function adjustedRandIndex(left, right) {
  const ids = Object.keys(left).filter(id => Object.hasOwn(right, id)), rows = new Map(), columns = new Map(), cells = new Map(), choose = x => x * (x - 1) / 2;
  for (const id of ids) {
    const a = left[id], b = right[id], key = `${a}\0${b}`;
    rows.set(a, (rows.get(a) || 0) + 1); columns.set(b, (columns.get(b) || 0) + 1); cells.set(key, (cells.get(key) || 0) + 1);
  }
  const n = choose(ids.length); if (!n) return 1;
  const a = [...rows.values()].reduce((s, x) => s + choose(x), 0), b = [...columns.values()].reduce((s, x) => s + choose(x), 0), observed = [...cells.values()].reduce((s, x) => s + choose(x), 0), expected = a * b / n, maximum = (a + b) / 2;
  return Math.abs(maximum - expected) < EPS ? 1 : (observed - expected) / (maximum - expected);
}

export function analyzeVotingGraph(graph, { sensitivityGraphs = [], seeds = [1, 7, 19], resolutions = [0.75, 1, 1.25], stabilityTarget = 0.9 } = {}) {
  const scores = weightedBetweenness(graph), byId = new Map(scores.map(x => [x.id, [x.score]]));
  for (const variant of sensitivityGraphs) for (const result of weightedBetweenness(variant)) byId.get(result.id)?.push(result.score);
  const betweenness = scores.map(row => {
    const values = byId.get(row.id), min = Math.min(...values), max = Math.max(...values);
    return { ...row, min, max, stable: values.length > 1 && max - min <= Math.max(0.005, max * 0.25) };
  });
  const runs = [];
  for (const seed of seeds) for (const resolution of resolutions) runs.push(detectCommunities(graph, { seed, resolution }));
  const reference = runs.find(run => run.seed === seeds[0] && run.resolution === 1) || runs[0];
  const stability = reference ? runs.map(run => adjustedRandIndex(reference.assignments, run.assignments)) : [];
  const partyLabels = Object.fromEntries(graph.nodes.map(node => [idOf(node), node.party || `unknown:${idOf(node)}`]));
  const baseline = reference ? adjustedRandIndex(reference.assignments, partyLabels) : null;
  // Sensitivity also checks sparsification/weighting variants, not only RNG seeds.
  const variantRuns = sensitivityGraphs.map(variant => detectCommunities(variant, { seed: seeds[0], resolution: 1 }));
  const variantStability = reference ? variantRuns.map(run => adjustedRandIndex(reference.assignments, run.assignments)) : [];
  const stable = stability.length > 1 && variantStability.length > 0 && Math.min(...stability, ...variantStability) >= stabilityTarget && reference.groups > 1 && reference.modularity > 0.1;
  return {
    betweenness,
    brokerage: { status: sensitivityGraphs.length ? (betweenness.every(row => row.stable) ? 'exploratory-stable' : 'exploratory-unstable') : 'sensitivity-pending', rankingsPublished: false, explanation: 'Scores describe constructed network position. No public ordinal ranking; see sensitivity range.' },
    communities: { status: stable ? 'exploratory-stable' : 'unavailable-unstable', assignments: stable ? reference.assignments : null, evaluationAssignments: reference?.assignments || {}, groups: reference?.groups || 0, stability: stability.length ? Math.min(...stability) : null, variantStability: variantStability.length ? Math.min(...variantStability) : null, stabilityTarget, partyAdjustedRand: baseline, partyModularity: modularity(graph, partyLabels), modularity: reference?.modularity ?? null, runs: runs.map(({ assignments, ...run }) => run), variantRuns: variantRuns.map(({ assignments, ...run }) => run), explanation: 'Seeded modularity local moving, disconnected groups split. Analytical groupings are not official factions.' },
    components: graphComponents(graph),
    coverage: { nodes: graph.nodes.length, edges: graph.edges.length },
    method: { ...graph.method, centrality: 'weighted Brandes; undirected globally normalized by (n-1)(n-2), endpoints excluded; isolates retained', communities: 'seeded modularity local moving with connected-component refinement', seeds, resolutions, stabilityTarget }
  };
}
