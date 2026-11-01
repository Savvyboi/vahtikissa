import { matchesSelection } from './collection-tools.js';

const unique = values => [...new Set(values)].sort();
export const relationLayers = ['sidonnaisuus', 'lobbaus', 'lahja'];
export const edgeWeight = counts => +(3 * counts.sidonnaisuus + 2.5 * counts.lahja + 1.5 * Math.log1p(counts.lobbaus)).toFixed(2);
export function summarizeEdge(edge, details = edge.details) {
  const counts = Object.fromEntries(relationLayers.map(layer => [layer, new Set(details.filter(detail => detail.layer === layer).map(detail => detail.id)).size]));
  const layers = relationLayers.filter(layer => counts[layer]);
  return { ...edge, details, counts, layers, isMultiplex: layers.length >= 2, isDualRole: !!(counts.lobbaus && (counts.sidonnaisuus || counts.lahja)), weight: edgeWeight(counts), heIds: unique(details.flatMap(detail => detail.heIds)), periods: unique(details.flatMap(detail => detail.periods)), hasInferred: details.some(detail => detail.inferred) };
}

// Shared record metadata is encoded once, rather than repeated for every MP.
// Decoding and faceting are linear; centralities and force physics stay offline.
export function packTransparencyGraph(graph) {
  const recordIndex = [], records = new Map(), indices = new Map(graph.nodes.map((node, i) => [node.id, i])), edgeIds = new Map();
  const edges = graph.edges.map((edge, i) => {
    edgeIds.set(edge.id, `tie:${i}`);
    return [indices.get(edge.source), indices.get(edge.target), edge.weight, edge.details.map(detail => {
      if (!records.has(detail.id)) { records.set(detail.id, recordIndex.length); recordIndex.push([detail.id, relationLayers.indexOf(detail.layer), detail.periods, detail.heIds]); }
      return [records.get(detail.id), (detail.board ? 1 : 0) | (detail.inferred ? 2 : 0), detail.viaCommittee || '', detail.extraction || detail.identity || '', detail.targetId || ''];
    })];
  });
  return { ...graph, encoding: 'multiplex-1', recordIndex, edges, mpInterlocks: graph.mpInterlocks.map(edge => ({ ...edge, sharedOrgs: edge.sharedOrgs.map(org => ({ ...org, edgeIds: org.edgeIds.map(id => edgeIds.get(id)) })) })) };
}
export function unpackTransparencyGraph(graph) {
  if (graph.encoding !== 'multiplex-1') return graph;
  const { recordIndex, encoding, ...result } = graph;
  result.edges = graph.edges.map(([source, target, weight, details], i) => summarizeEdge({ id: `tie:${i}`, source: graph.nodes[source].id, target: graph.nodes[target].id, weight, details: details.map(([record, flags, committee, identity, targetId]) => {
    const [id, layer, periods, heIds] = recordIndex[record];
    return { id, layer: relationLayers[layer], periods, heIds, board: !!(flags & 1), inferred: !!(flags & 2), viaCommittee: committee || null, identity, targetId };
  }) }));
  return result;
}

export function filterTransparencyGraph(graph, state) {
  const nodes = new Map(graph.nodes.map(node => [node.id, node])), query = (state.query || '').trim().toLocaleLowerCase('fi'), facets = state.facets || {};
  return graph.edges.flatMap(edge => {
    const mp = nodes.get(edge.target), org = nodes.get(edge.source);
    if (!matchesSelection(mp.party, facets.party) || !matchesSelection(mp.isGovernment ? 'government' : 'opposition', facets.bloc) || !matchesSelection(mp.committees, facets.committee) || !matchesSelection(org.category, facets.category)) return [];
    const details = edge.details.filter(detail => (state.inferred !== false || !detail.inferred) && matchesSelection(detail.periods, facets.year));
    if (!details.length) return [];
    const selected = summarizeEdge(edge, details);
    if (!matchesSelection([...selected.layers, ...(selected.isMultiplex ? ['multiplex'] : [])], facets.layer) || selected.weight < Number(state.minWeight || 0)) return [];
    if (query && !`${mp.name} ${org.name} ${selected.heIds.join(' ')}`.toLocaleLowerCase('fi').includes(query)) return [];
    return [selected];
  }).sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
}

function backbone(edges, limit) {
  const ids = new Set();
  for (const edge of edges) {
    const extra = Number(!ids.has(edge.source)) + Number(!ids.has(edge.target));
    if (ids.size + extra <= limit) { ids.add(edge.source); ids.add(edge.target); }
  }
  return ids;
}
export function selectTransparencyView(graph, filtered, { preset = 'backbone', expanded = new Set(), pruned = new Set(), ego = null, layout = 'force' } = {}) {
  let eligible = filtered, edges, ids;
  if (preset === 'dual') eligible = filtered.filter(edge => edge.isDualRole);
  if (preset === 'bills') eligible = filtered.filter(edge => edge.counts.lobbaus && edge.heIds.length);
  if (preset === 'interlocks') {
    const ties = new Map(filtered.map(edge => [edge.id, edge]));
    eligible = graph.mpInterlocks.flatMap(edge => {
      if (!edge.isCrossBloc) return [];
      const sharedOrgs = edge.sharedOrgs.filter(org => {
        const [a, b] = org.edgeIds.map(id => ties.get(id));
        if (!a || !b) return false;
        const years = a.details.filter(d => d.board).flatMap(d => d.periods);
        return b.details.some(d => d.board && d.periods.some(year => years.includes(year) && org.periods.includes(year)));
      });
      return sharedOrgs.length ? [{ ...edge, sharedOrgs, weight: sharedOrgs.length, layers: ['interlock'], periods: unique(sharedOrgs.flatMap(org => org.periods)), heIds: [], details: [], counts: { sidonnaisuus: sharedOrgs.length, lobbaus: 0, lahja: 0 } }] : [];
    }).sort((a, b) => b.weight - a.weight);
  }
  const connected = new Set(eligible.flatMap(edge => [edge.source, edge.target]));
  if (preset === 'brokers') ids = new Set(['mp', 'org'].flatMap(type => graph.nodes.filter(node => node.type === type && connected.has(node.id)).sort((a, b) => b.betweenness - a.betweenness || a.id.localeCompare(b.id)).slice(0, 30).map(node => node.id)));
  else ids = backbone(eligible, 100);
  if (ego && connected.has(ego)) ids = new Set([ego, ...eligible.filter(edge => edge.source === ego || edge.target === ego).slice(0, 99).map(edge => edge.source === ego ? edge.target : edge.source)]);
  for (const id of expanded) {
    if (connected.has(id)) ids.add(id);
    for (const edge of eligible) if (edge.source === id || edge.target === id) { ids.add(edge.source); ids.add(edge.target); }
  }
  pruned.forEach(id => ids.delete(id));
  edges = eligible.filter(edge => ids.has(edge.source) && ids.has(edge.target));
  if (['backbone', 'brokers'].includes(preset) && !expanded.size && !ego && edges.length > 200) {
    const retained = new Map();
    for (const id of ids) { const edge = edges.find(edge => edge.source === id || edge.target === id); if (edge) retained.set(edge.id, edge); }
    for (const edge of edges) { if (retained.size >= 200) break; retained.set(edge.id, edge); }
    edges = [...retained.values()];
  }
  if (preset === 'bills') {
    const billEdges = new Map();
    for (const edge of edges) for (const he of edge.heIds) {
      const key = `${edge.target}|bill:${he}`;
      if (!billEdges.has(key)) billEdges.set(key, { id: `he:${edge.id}:${he}`, source: edge.target, target: `bill:${he}`, weight: 1, layers: ['bill'], counts: { sidonnaisuus: 0, lobbaus: 0, lahja: 0 }, details: [], heIds: [he], periods: [], supportEdgeIds: [] });
      billEdges.get(key).supportEdgeIds.push(edge.id); ids.add(`bill:${he}`);
    }
    edges = [...edges, ...billEdges.values()].filter(edge => !pruned.has(edge.target));
  }
  if (layout === 'columns' && preset !== 'bills') {
    const visibleMPs = new Set(edges.flatMap(edge => [edge.source, edge.target]));
    const committees = new Set((graph.committees || []).map(node => node.id));
    for (const node of graph.nodes.filter(node => node.type === 'mp' && visibleMPs.has(node.id))) for (const code of node.committees) {
      const target = `committee:${code}`;
      if (!committees.has(target) || pruned.has(target)) continue;
      edges.push({ id: `membership:${node.id}:${code}`, source: node.id, target, weight: 1, layers: ['membership'], counts: { sidonnaisuus: 0, lobbaus: 0, lahja: 0 }, details: [], heIds: [], periods: [graph.asOf.slice(0, 4)] });
    }
  }
  const used = new Set(edges.flatMap(edge => [edge.source, edge.target]));
  const nodes = [...graph.nodes, ...graph.bills, ...(graph.committees || [])].filter(node => used.has(node.id));
  return { nodes, edges, eligible, filteredCount: eligible.length };
}

export function shortestTransparencyPath(nodes, edges, start, end, maxHops = 4) {
  const adjacent = new Map(nodes.map(node => [node.id, []]));
  if (!adjacent.has(start) || !adjacent.has(end)) return null;
  for (const edge of edges) { adjacent.get(edge.source)?.push({ node: edge.target, edge: edge.id }); adjacent.get(edge.target)?.push({ node: edge.source, edge: edge.id }); }
  const queue = [{ node: start, nodes: [start], edges: [] }], seen = new Set([start]);
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i]; if (item.node === end) return item;
    if (item.edges.length >= maxHops) continue;
    for (const next of adjacent.get(item.node)) if (!seen.has(next.node)) { seen.add(next.node); queue.push({ node: next.node, nodes: [...item.nodes, next.node], edges: [...item.edges, next.edge] }); }
  }
  return null;
}

export function viewPositions(nodes, mode, selected = null, size = 'degree') {
  const positions = new Map();
  if (mode === 'force') {
    const xs = nodes.map(node => node.initialX || 0), ys = nodes.map(node => node.initialY || 0);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    // Affine viewport scaling only; no force simulation or graph analysis in the browser.
    return new Map(nodes.map(node => [node.id, { x: ((node.initialX || 0) - (minX + maxX) / 2) * 1000 / (maxX - minX || 1), y: ((node.initialY || 0) - (minY + maxY) / 2) * 600 / (maxY - minY || 1) }]));
  }
  if (mode === 'columns') {
    for (const [column, type] of ['org', 'mp', 'bill'].entries()) {
      const group = nodes.filter(node => node.type === type || type === 'bill' && node.type === 'committee').sort((a, b) => (a.party || '').localeCompare(b.party || '') || a.name.localeCompare(b.name, 'fi'));
      group.forEach((node, i) => positions.set(node.id, { x: column * 520, y: (i - (group.length - 1) / 2) * 50 }));
    }
    return positions;
  }
  const ordered = [...nodes].sort((a, b) => Number(b.id === selected) - Number(a.id === selected) || (b[size] || 0) - (a[size] || 0));
  ordered.forEach((node, i) => {
    if (!i) { positions.set(node.id, { x: 0, y: 0 }); return; }
    const ring = Math.ceil((Math.sqrt(i + 1) - 1) / 2), before = (2 * ring - 1) ** 2, count = 8 * ring, angle = (i - before) / count * 2 * Math.PI;
    positions.set(node.id, { x: Math.cos(angle) * ring * 180, y: Math.sin(angle) * ring * 180 });
  });
  return positions;
}
