import { createHash } from 'node:crypto';
import { UndirectedGraph } from 'graphology';
import louvain from 'graphology-communities-louvain';
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide, forceX, forceY } from 'd3-force';
import { selectTransparencyView } from '../transparency-model.js';

export const METHOD_VERSION = 'transparency-1';
const clean = value => String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
const norm = value => clean(value).toLocaleLowerCase('fi');
const unique = values => [...new Set(values)].sort();
const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 16);
const legal = /(?<![\p{L}\p{N}])(?:oyj?|ab|ry|rf|sr|osuuskunta|säätiö|stiftelse)(?![\p{L}\p{N}])/gu;
export function normalizeOrgName(value) {
  return norm(value).replace(/,\s*(?:ruotsiksi|på svenska)\s.*$/u, '').replace(/[.,:;()"'’]/gu, ' ').replace(legal, ' ').replace(/\s+/gu, ' ').trim();
}
export function extractHEIds(value) {
  return unique([...String(value).matchAll(/\bHE\s+(\d+)\s*\/\s*(\d{4})(?:\s*vp)?/gi)].map(m => `HE ${Number(m[1])}/${m[2]} vp`));
}
export function classifyOrganization(name, industry = '') {
  const text = norm(`${name} ${industry}`);
  if (/ammattiliitto|työmarkkina|työnantaja|elinkeinoelämän keskusliitto|\bsak\b|\bsttk\b|akava|teollisuusliitto|palkansaaja/u.test(text)) return 'Työmarkkinajärjestöt';
  if (/viestintä|suhdetoiminta|konsult|communications|advisory|public affairs|eurofacts|miltton|kreab|rud pedersen/u.test(text)) return 'Konsultit & Vaikuttajaviestintä';
  if (/kaupunki|kunta\b|kuntayhtym|hyvinvointialue|ministeriö|valtion|yliopisto|y\s*leisradio|\bneova\b|\balko\b|\bveikkaus\b|\bsenaatti\b/u.test(text)) return 'Julkisyhteisöt & Valtionyhtiöt';
  if (/\b(?:ry|rf|sr)\b|säätiö|stiftelse|yhdistys|järjestö|seura\b|liitto\b|förbund/u.test(text)) return 'Järjestöt & Säätiöt';
  return 'Elinkeinoelämä & Yhtiöt';
}
export function multiplexWeight(counts) {
  return +(counts.sidonnaisuus * 3 + counts.lahja * 2.5 + Math.log1p(counts.lobbaus) * 1.5).toFixed(2);
}
export function seededRandom(seed = 2026) {
  let state = seed >>> 0;
  return () => ((state = (1664525 * state + 1013904223) >>> 0) / 4294967296);
}

// Only structured organisation fields or unambiguous, short role declarations.
// Long narratives, debt, aggregate assets and income never become organisations.
export function interestOrganizations(row) {
  if (!row.declared || row.type === 'income') return [];
  if (row.organization) return [{ name: clean(row.organization), board: /Hallinto|hallitu|hallintoneuv|board/iu.test(`${row.category} ${row.description}`), extraction: 'structured' }];
  if (!/Hallinto|Palkatut toimet|julkisyhteisöjen virat/iu.test(row.category || '')) return [];
  const description = String(row.description || '');
  if (description.length > 500 || /erosin|jätin eroilmoitukseni|luovuin|päättyi|ei ilmoitettav/u.test(norm(description))) return [];
  const result = [];
  for (let line of description.split(/[;\n]+/u).map(s => s.replace(/^\s*[-•]\s*/u, '').trim()).filter(Boolean)) {
    if (line.length > 190) continue;
    const parts = line.split(',').map(clean);
    const roleOnly = /^(?:(?:hallituksen|hallintoneuvoston|johtokunnan|kaupunginvaltuuston|kunnanvaltuuston|valtuuston)\s+)?(?:vara)?(?:puheenjohtaja|jäsen|valtuutettu|kaupunginvaltuutettu|kunnanvaltuutettu|aluevaltuutettu)(?:\s+\d.*)?$/iu;
    let name = (roleOnly.test(parts[0]) ? parts[1] || '' : parts[0]).split(/[:(]/u)[0].trim().replace(/\s+\d{4}(?:\s*[-–].*)?$/u, '');
    const leading = /^(?:hallintoneuvoston|hallituksen|johtokunnan)\s+(?:vara)?(?:puheenjohtaja|jäsen)\s+(.+)$/iu.exec(name);
    if (leading) name = leading[1];
    else name = name.replace(/(?:\s+|:)(?:n\s+)?(?:hallituk\S*|hallintoneuvosto\S*|johtokun\S*|valtuuskun\S*|neuvottelukun\S*|hallitus|toimitusjohtaja|jäsen|puheenjohtaja).*$/iu, '').replace(/(?:\b(?:ry|rf|sr|oy|oyj|ab)):n$/iu, match => match.slice(0, -2));
    // Retain legal names; remove a possessive suffix only when followed by a role.
    name = name.replace(/(?:ry|rf|sr|oy|oyj|ab):n$/iu, match => match.slice(0, -2));
    if (name.length < 3 || name.length > 110 || roleOnly.test(name) || /^(?:hallituksen|hallintoneuvoston|johtokunnan|kaupunginvaltuuston|valtuuston)$/iu.test(name) || /\d{4}|\b(?:jäsen|puheenjohtaja|omistan|lisäksi|sekä|euroa|hallitus|hallintoneuvosto)\b/iu.test(name)) continue;
    result.push({ name, board: /Hallinto/iu.test(row.category || ''), extraction: 'automatic-role-text' });
  }
  return result;
}

/** Exact unweighted Brandes, including disconnected components and isolates. */
export function precomputeMetrics(nodes, edges) {
  const index = new Map(nodes.map((n, i) => [n.id, i])), n = nodes.length;
  const adjacent = nodes.map(() => []), weighted = new Float64Array(n);
  for (const edge of edges) {
    const a = index.get(edge.source), b = index.get(edge.target);
    adjacent[a].push([b, edge.weight]); adjacent[b].push([a, edge.weight]);
    weighted[a] += edge.weight; weighted[b] += edge.weight;
  }
  const between = new Float64Array(n);
  for (let source = 0; source < n; source++) {
    if (!adjacent[source].length) continue;
    const distance = new Int32Array(n).fill(-1), paths = new Float64Array(n), dependency = new Float64Array(n), predecessors = nodes.map(() => []), queue = [source];
    distance[source] = 0; paths[source] = 1;
    for (let q = 0; q < queue.length; q++) {
      const v = queue[q];
      for (const [w] of adjacent[v]) {
        if (distance[w] < 0) { distance[w] = distance[v] + 1; queue.push(w); }
        if (distance[w] === distance[v] + 1) { paths[w] += paths[v]; predecessors[w].push(v); }
      }
    }
    for (let q = queue.length - 1; q >= 0; q--) {
      const w = queue[q];
      for (const v of predecessors[w]) dependency[v] += paths[v] / paths[w] * (1 + dependency[w]);
      if (w !== source) between[w] += dependency[w];
    }
  }
  let rank = new Float64Array(n).fill(n ? 1 / n : 0);
  for (let iteration = 0; iteration < 120; iteration++) {
    let dangling = 0; rank.forEach((r, i) => { if (!weighted[i]) dangling += r; });
    const next = new Float64Array(n).fill(n ? (0.15 + 0.85 * dangling) / n : 0);
    for (let i = 0; i < n; i++) for (const [j, weight] of adjacent[i]) next[j] += 0.85 * rank[i] * weight / weighted[i];
    let delta = 0; next.forEach((r, i) => { delta += Math.abs(r - rank[i]); }); rank = next;
    if (delta < 1e-10) break;
  }
  const graph = new UndirectedGraph();
  nodes.forEach(node => graph.addNode(node.id));
  edges.forEach(edge => graph.addEdge(edge.source, edge.target, { weight: edge.weight }));
  const communities = edges.length ? louvain(graph, { rng: seededRandom(), resolution: 1 }) : Object.fromEntries(nodes.map((node, i) => [node.id, i]));
  nodes.forEach((node, i) => Object.assign(node, { degree: adjacent[i].length, weightedDegree: +weighted[i].toFixed(2), betweenness: n > 2 ? between[i] / ((n - 1) * (n - 2)) : 0, pagerank: rank[i], communityId: communities[node.id] }));
  const positions = nodes.map(node => ({ id: node.id }));
  forceSimulation(positions).stop().randomSource(seededRandom())
    .force('link', forceLink(edges.map(edge => ({ source: edge.source, target: edge.target }))).id(node => node.id).distance(90).strength(0.15))
    .force('charge', forceManyBody().strength(-80)).force('center', forceCenter()).force('collide', forceCollide(14)).tick(220);
  nodes.forEach((node, i) => Object.assign(node, { initialX: +positions[i].x.toFixed(2), initialY: +positions[i].y.toFixed(2) }));
  return { adjacent, index };
}

export function buildTransparencyGraph({ influence, parliament, profiles = {}, committeeIndex = {}, governmentParties }) {
  const asOf = influence.metadata.generatedAt.slice(0, 10), profileMap = profiles.members || profiles;
  governmentParties ||= unique(parliament.members.filter(member => (profileMap[String(member.id)]?.government?.fi || []).some(role => role.from <= asOf && (!role.to || role.to >= asOf))).map(member => member.party));
  const committeeNames = new Map(), committeeNodes = new Map(), nodes = [], mpMap = new Map(), names = new Map();
  for (const member of parliament.members) {
    const profile = profileMap[String(member.id)] || {}, name = clean(`${member.firstName} ${member.lastName}`);
    const memberships = (profile.committees || []).map(row => ({ id: row.id.replace(/\d+$/u, ''), from: row.from, to: row.to || asOf, role: row.role?.fi || '' }));
    for (const row of profile.committees || []) for (const label of Object.values(row.name || {})) committeeNames.set(norm(label), row.id.replace(/\d+$/u, ''));
    for (const row of profile.committees || []) { const code = row.id.replace(/\d+$/u, ''); committeeNodes.set(code, { id: `committee:${code}`, type: 'committee', name: code, fullName: row.name?.fi || row.name?.sv || code }); }
    const node = { id: `mp:${member.id}`, mpId: String(member.id), type: 'mp', name, party: member.party, isGovernment: governmentParties.includes(member.party), committees: unique(memberships.filter(r => r.from <= asOf && r.to >= asOf).map(r => r.id)), memberships, electoralDistrict: profile.district?.fi || '', status: profile.status || '', isMinister: (profile.government?.fi || []).some(r => r.from <= asOf && (!r.to || r.to >= asOf)), eiIndex: 0 };
    nodes.push(node); mpMap.set(String(member.id), node);
    node.sourceUrl = profile.sourceUrl || `${influence.metadata.parliamentSource}/${member.id}`;
    if (!names.has(norm(name))) names.set(norm(name), []);
    names.get(norm(name)).push(node);
  }
  const companiesByName = new Map(), organizations = new Map(), records = {}, edgeMap = new Map();
  for (const row of influence.lobbying || []) {
    const key = normalizeOrgName(row.actor);
    if (row.companyId) { if (!companiesByName.has(key)) companiesByName.set(key, new Set()); companiesByName.get(key).add(row.companyId); }
  }
  const organization = (name, businessId, industry = '') => {
    name = clean(name).replace(/,\s*(?:ruotsiksi|på svenska)\s.*$/iu, '').replace(/[.,;]$/u, ''); const key = normalizeOrgName(name);
    if (key.length < 2 || /^(?:ei|none|tuntematon|yksityishenkilö)$/u.test(key)) return null;
    const candidates = companiesByName.get(key);
    const yTunnus = businessId || (candidates?.size === 1 ? [...candidates][0] : null);
    const id = yTunnus ? `org:yt:${yTunnus}` : `org:name:${hash(key)}`;
    if (!organizations.has(id)) organizations.set(id, { id, type: 'org', name, category: classifyOrganization(name, industry), yTunnus, aliases: [], identity: yTunnus ? businessId ? 'business-id' : 'unique-normalized-name-to-business-id' : candidates?.size > 1 ? 'ambiguous-name-unmerged' : 'normalized-name', eiIndex: 0, partyBreakdown: {} });
    const node = organizations.get(id);
    if (!node.aliases.includes(name)) node.aliases.push(name);
    return node;
  };
  const add = (mp, org, row, layer, extra = {}) => {
    if (!mp || !org) return;
    const recordId = `${layer}:${row.id}`;
    if (!records[recordId]) records[recordId] = { ...row, layer, sourceUrl: row.sourceUrl || (layer === 'lobbaus' ? influence.metadata.transparencySource : profileMap[mp.mpId]?.sourceUrl || `${influence.metadata.parliamentSource}/${mp.mpId}`) };
    const key = `${mp.id}|${org.id}`;
    if (!edgeMap.has(key)) edgeMap.set(key, { id: `tie:${hash(key)}`, source: org.id, target: mp.id, details: [] });
    const edge = edgeMap.get(key);
    if (edge.details.some(d => d.id === recordId && d.viaCommittee === (extra.viaCommittee || null))) return;
    const periods = layer === 'lobbaus' ? unique([row.period.start.slice(0, 4), row.period.end.slice(0, 4)]) : [String(row.year)];
    edge.details.push({ id: recordId, layer, periods, heIds: layer === 'lobbaus' ? extractHEIds(row.topic) : [], board: false, inferred: false, viaCommittee: null, ...extra });
  };
  const coverage = { interests: (influence.interests || []).length, gifts: (influence.gifts || []).length, lobbying: (influence.lobbying || []).length, omittedInterests: 0, unresolvedTargets: 0, ambiguousTargets: 0, inferredCommitteeAssociations: 0, unclosedLobbying: 0 };
  for (const row of influence.lobbying || []) organization(row.actor, row.companyId, row.industry);
  for (const row of influence.interests || []) {
    const extracted = interestOrganizations(row);
    if (!extracted.length) coverage.omittedInterests++;
    for (const item of extracted) add(mpMap.get(String(row.mpId)), organization(item.name, row.companyId), row, 'sidonnaisuus', { board: item.board, extraction: item.extraction });
  }
  for (const row of influence.gifts || []) add(mpMap.get(String(row.mpId)), organization(row.donor, row.companyId), row, 'lahja');
  const targets = new Map((influence.targets || []).map(t => [String(t.id), t]));
  for (const row of influence.lobbying || []) {
    if (!row.period?.start || !row.period?.end || row.period.end >= asOf) { coverage.unclosedLobbying++; continue; }
    const org = organization(row.actor, row.companyId, row.industry);
    for (const targetId of unique((row.targetIds || []).map(String))) {
      const target = targets.get(targetId), candidates = target?.kind === 'mp' || target?.kind === 'minister' ? names.get(norm(target.fi?.name || target.sv?.name)) || [] : [];
      if (candidates.length === 1) add(candidates[0], org, row, 'lobbaus', { identity: 'unique-exact-name', targetId });
      else if (candidates.length > 1) coverage.ambiguousTargets++;
      else {
        const committee = [target?.fi?.unit, target?.fi?.department, target?.fi?.organization, target?.sv?.unit].map(label => committeeNames.get(norm(label))).find(Boolean);
        if (committee) for (const mp of mpMap.values()) {
          if (mp.memberships.some(m => m.id === committee && m.from <= row.period.end && m.to >= row.period.start && !/Varajäsen/iu.test(m.role))) {
            add(mp, org, row, 'lobbaus', { inferred: true, viaCommittee: committee, targetId, identity: 'committee-membership-overlap' }); coverage.inferredCommitteeAssociations++;
          }
        }
        else coverage.unresolvedTargets++;
      }
    }
  }
  const edges = [...edgeMap.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const edge of edges) {
    edge.details.sort((a, b) => a.id.localeCompare(b.id) || String(a.viaCommittee).localeCompare(String(b.viaCommittee)));
    edge.counts = Object.fromEntries(['sidonnaisuus', 'lobbaus', 'lahja'].map(layer => [layer, new Set(edge.details.filter(d => d.layer === layer).map(d => d.id)).size]));
    edge.layers = Object.keys(edge.counts).filter(layer => edge.counts[layer]); edge.isMultiplex = edge.layers.length >= 2;
    edge.isDualRole = !!(edge.counts.lobbaus && (edge.counts.sidonnaisuus || edge.counts.lahja));
    edge.weight = multiplexWeight(edge.counts); edge.heIds = unique(edge.details.flatMap(d => d.heIds)); edge.periods = unique(edge.details.flatMap(d => d.periods));
    edge.hasInferred = edge.details.some(d => d.inferred);
  }
  const connected = new Set(edges.flatMap(edge => [edge.source, edge.target]));
  nodes.push(...[...organizations.values()].filter(org => connected.has(org.id)).sort((a, b) => a.id.localeCompare(b.id)));
  const boardOrgs = new Map(), interlocks = new Map();
  for (const edge of edges) {
    const boardDetails = edge.details.filter(d => d.board);
    if (!boardDetails.length) continue;
    if (!boardOrgs.has(edge.source)) boardOrgs.set(edge.source, []);
    boardOrgs.get(edge.source).push({ edge, periods: unique(boardDetails.flatMap(d => d.periods)) });
  }
  for (const [orgId, ties] of boardOrgs) for (let i = 0; i < ties.length; i++) for (let j = i + 1; j < ties.length; j++) {
    const sharedPeriods = ties[i].periods.filter(p => ties[j].periods.includes(p));
    if (!sharedPeriods.length) continue;
    const [a, b] = [ties[i].edge.target, ties[j].edge.target].sort(), key = `${a}|${b}`;
    const ma = nodes.find(node => node.id === a), mb = nodes.find(node => node.id === b);
    if (!interlocks.has(key)) interlocks.set(key, { id: `interlock:${hash(key)}`, source: a, target: b, sharedOrgs: [], isCrossParty: ma.party !== mb.party, isCrossBloc: ma.isGovernment !== mb.isGovernment });
    interlocks.get(key).sharedOrgs.push({ id: orgId, periods: sharedPeriods, edgeIds: [ties[i].edge.id, ties[j].edge.id] });
  }
  const mpInterlocks = [...interlocks.values()].map(edge => ({ ...edge, weight: edge.sharedOrgs.length })).sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
  const groups = new Map();
  for (const row of influence.lobbying || []) {
    if (!row.period?.end || row.period.end >= asOf) continue;
    const org = organization(row.actor, row.companyId, row.industry); if (!org || !connected.has(org.id)) continue;
    const committees = unique((row.targetIds || []).flatMap(id => { const t = targets.get(String(id)); return [t?.fi?.unit, t?.fi?.department].map(label => committeeNames.get(norm(label))).filter(Boolean); }));
    for (const key of [...extractHEIds(row.topic).map(id => `bill:${id}`), ...(committees.length ? [`committees:${committees.join('+')}`] : [])]) {
      if (!groups.has(key)) groups.set(key, new Set()); groups.get(key).add(org.id);
    }
  }
  const coalitions = new Map();
  for (const [topic, set] of groups) { const ids = [...set].sort(); for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const key = `${ids[i]}|${ids[j]}`;
    if (!coalitions.has(key)) coalitions.set(key, { id: `coalition:${hash(key)}`, source: ids[i], target: ids[j], sharedTopics: [] });
    coalitions.get(key).sharedTopics.push(topic);
  } }
  precomputeMetrics(nodes, edges);
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  for (const node of nodes) {
    if (node.type === 'mp') {
      const ties = mpInterlocks.filter(edge => edge.source === node.id || edge.target === node.id), external = ties.filter(edge => edge.isCrossParty).length;
      node.eiIndex = ties.length ? (2 * external - ties.length) / ties.length : 0;
      node.crossPartyCount = new Set(ties.map(edge => nodeMap.get(edge.source === node.id ? edge.target : edge.source).party)).size;
    } else {
      const people = edges.filter(edge => edge.source === node.id).map(edge => nodeMap.get(edge.target));
      for (const mp of people) node.partyBreakdown[mp.party] = (node.partyBreakdown[mp.party] || 0) + 1 / people.length;
      const government = people.filter(mp => mp.isGovernment).length, opposition = people.length - government, external = government * opposition, internal = government * (government - 1) / 2 + opposition * (opposition - 1) / 2;
      node.eiIndex = external + internal ? (external - internal) / (external + internal) : 0;
      node.crossPartyCount = Object.keys(node.partyBreakdown).length;
    }
  }
  const matters = new Map((parliament.legislation || []).map(matter => [matter.id, matter]));
  const bills = unique(edges.flatMap(edge => edge.heIds)).map(he => { const matter = matters.get(he); return { id: `bill:${he}`, type: 'bill', name: he, heId: he, title: matter?.title || '', available: !!matter, voteCount: matter?.voteIds?.length || 0, committees: (committeeIndex.matters?.[he] || []).map(c => c.id.replace(/\d+$/u, '')) }; });
  const result = {
    graph: { schemaVersion: 1, asOf, nodes, edges, bills, mpInterlocks, orgCoalitions: [...coalitions.values()].map(edge => ({ ...edge, weight: edge.sharedTopics.length })).sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id)).slice(0, 150), coverage,
      method: { version: METHOD_VERSION, centralityScope: 'full snapshot; metrics are not recalculated when filtering', betweenness: 'exact unweighted undirected Brandes, normalized by (n-1)(n-2)', pagerank: 'weighted undirected, damping 0.85, sums to 1', community: 'weighted Louvain, resolution 1, seed 2026; descriptive clusters', force: 'offline d3-force, seed 2026, 220 ticks', weight: '3*interests + 2.5*gifts + 1.5*ln(1+lobbying)', lobbying: 'deduplicated disclosed topic records; not meetings; only closed reporting periods', identity: 'exact unique full-name matches; ambiguous names omitted; business IDs take precedence over legal-suffix-normalized names', committee: 'inferred from ordinary membership overlapping a reporting period; never evidence of personal contact', interests: 'short role text only; raw evidence retained; unresolved narratives, assets, debts and income omitted', interlocks: 'shared board organisations in a common disclosure year; no claim of simultaneous board service', eiIndex: 'MPs: unique cross-party vs same-party board peers. Organisations: cross-bloc vs same-bloc pairs of linked MPs. Zero if insufficient ties.', government: { parties: governmentParties, asOf, meaning: 'snapshot party alignment, not historical cabinet membership' }, categories: 'keyword heuristics; not an official classification', interpretation: 'Observed and inferred associations do not establish influence, improper conduct or lobbying effectiveness.' } }, records
  };
  result.graph.layouts = {};
  result.graph.committees = [...committeeNodes.values()].sort((a, b) => a.name.localeCompare(b.name));
  result.graph.method.backbone = 'up to 100 actors; retain each selected actor\'s strongest edge, then fill by weight to 200 edges; full matches remain in the list; explicit expansion removes this initial cap';
  result.graph.method.brokerPreset = 'up to 30 highest-betweenness MPs and 30 highest-betweenness organisations; retain each actor\'s strongest induced edge, then fill by weight to 200; both node types preserve bipartite connections';
  for (const preset of ['backbone', 'dual', 'brokers', 'interlocks', 'bills']) {
    const selected = selectTransparencyView(result.graph, [...edges].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id)), { preset });
    const positions = selected.nodes.map(node => ({ id: node.id }));
    forceSimulation(positions).stop().randomSource(seededRandom()).force('link', forceLink(selected.edges.map(edge => ({ source: edge.source, target: edge.target }))).id(node => node.id).distance(130).strength(0.12)).force('charge', forceManyBody().strength(-650)).force('center', forceCenter()).force('x', forceX().strength(0.07)).force('y', forceY().strength(0.07)).force('collide', forceCollide(40)).tick(260);
    result.graph.layouts[preset] = Object.fromEntries(positions.map(node => [node.id, { x: +node.x.toFixed(2), y: +node.y.toFixed(2) }]));
  }
  return result;
}
