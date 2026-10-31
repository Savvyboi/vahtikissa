// Pure offline voting statistics. Ballot party is the party recorded at that vote.
export const VOTING_METHOD_VERSION = 'voting-1';
const eligible = new Set(['yes', 'no', 'abstain']);
const ratio = (a, b) => b ? a / b : null;
const bucket = () => ({ common: 0, agree: 0 });
const finish = x => ({ ...x, agreement: ratio(x.agree, x.common) });
function increment(x, same) { x.common++; x.agree += Number(same); }
function visitPairGroupStats(byVote, votes, positions, n, groupKey, visit) {
  const grouped = new Map();
  for (const vote of votes) {
    const key = groupKey(vote);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(vote);
  }
  // Reuse dense scratch counters per matter/session rather than holding millions
  // of nested maps for the whole Parliament snapshot.
  const common = new Uint32Array(n * n), agree = new Uint32Array(n * n);
  let groupIndex = 0;
  for (const group of grouped.values()) {
    const touched = [];
    for (const vote of group) {
      const event = [...byVote.get(String(vote.id)).values()].sort((a, b) => positions.get(a.id) - positions.get(b.id));
      for (let i = 0; i < event.length; i++) for (let j = i + 1; j < event.length; j++) {
        const key = positions.get(event[i].id) * n + positions.get(event[j].id);
        if (!common[key]) touched.push(key);
        common[key]++; agree[key] += Number(event[i].choice === event[j].choice);
      }
    }
    for (const key of touched) {
      visit(key, common[key], agree[key], groupIndex);
      common[key] = 0; agree[key] = 0;
    }
    groupIndex++;
  }
  return grouped.size;
}
function addWeightedComparisons(byVote, votes, pairs, positions, n, groupKey, field) {
  visitPairGroupStats(byVote, votes, positions, n, groupKey, (key, common, agree) => {
    const p = pairs.get(key); p[field].common++; p[field].agree += agree / common;
  });
}

const sessionKey = vote => `${vote.year || String(vote.date).slice(0, 4)}:${vote.sessionNumber || String(vote.id).split('-').slice(0, 2).join('-')}`;
const matterKey = vote => vote.document || sessionKey(vote);

function prepareBallots(votes, ballots, { from = '', to = '' } = {}) {
  const selected = votes.filter(v => (!from || String(v.date).slice(0, 10) >= from) && (!to || String(v.date).slice(0, 10) <= to));
  const byVote = new Map(selected.map(v => [String(v.id), new Map()]));
  let excludedChoices = 0, duplicates = 0;
  const conflicting = new Set();
  for (const row of ballots) {
    const [voteId, mpId, party, choice] = row;
    const event = byVote.get(String(voteId));
    if (!event) continue;
    if (!eligible.has(choice)) { excludedChoices++; continue; }
    const id = String(mpId), conflictKey = `${voteId}\0${id}`;
    if (conflicting.has(conflictKey)) continue;
    if (event.has(id)) {
      duplicates++;
      if (event.get(id).choice !== choice || event.get(id).party !== String(party || '')) {
        event.delete(id); conflicting.add(conflictKey);
      }
      continue;
    }
    event.set(id, { id, party: String(party || ''), choice });
  }
  return { selected, byVote, excludedChoices, duplicates, conflicting };
}

/** Full compact roll-call party evidence, intended for a separate on-demand file. */
export function buildPartyEvidence({ votes = [], ballots = [] }, options = {}) {
  const { selected, byVote } = prepareBallots(votes, ballots, options);
  return selected.map(vote => {
    const parties = {};
    for (const row of byVote.get(String(vote.id)).values()) {
      if (!row.party) continue;
      // Define source-provided keys as own data, even if named '__proto__'.
      if (!Object.hasOwn(parties, row.party)) Object.defineProperty(parties, row.party, { value: { counts: { yes: 0, no: 0, abstain: 0 }, eligible: 0 }, enumerable: true });
      const party = parties[row.party]; party.eligible++; party.counts[row.choice]++;
    }
    for (const party of Object.values(parties)) {
      party.modalCount = Math.max(...Object.values(party.counts));
      const modes = Object.keys(party.counts).filter(choice => party.counts[choice] === party.modalCount);
      party.modalChoice = modes.length === 1 ? modes[0] : null;
      party.modalSupport = party.modalCount / party.eligible;
    }
    return { id: String(vote.id), date: vote.date, document: vote.document || '', parties };
  });
}

export function buildVotingAnalysis({ votes = [], ballots = [], members = [] }, options = {}) {
  const { minCommon = 30, contestedMinority = 0.1, evidenceLimit = 12 } = options;
  if (!(minCommon >= 1) || !(contestedMinority > 0 && contestedMinority <= 0.5)) throw new Error('Invalid voting thresholds');
  const { selected, byVote, excludedChoices, duplicates, conflicting } = prepareBallots(votes, ballots, options);
  const memberMap = new Map(members.map(m => [String(m.id), m]));
  const ids = [...new Set([...memberMap.keys(), ...[...byVote.values()].flatMap(event => [...event.keys()])])].sort();
  const positions = new Map(ids.map((id, i) => [id, i]));
  const pairs = new Map(), partyPairs = new Map(), cohesion = new Map(), cross = new Map(), recordedParties = new Map();
  let eligibleBallots = 0, contestedVotes = 0;
  const retain = (list, id) => { if (list.length < evidenceLimit) list.push(id); };
  for (const vote of selected) {
    const event = [...byVote.get(String(vote.id)).values()].sort((a, b) => positions.get(a.id) - positions.get(b.id));
    eligibleBallots += event.length;
    const choiceCounts = new Map(), groups = new Map();
    for (const row of event) {
      choiceCounts.set(row.choice, (choiceCounts.get(row.choice) || 0) + 1);
      if (!row.party) continue;
      if (!recordedParties.has(row.id)) recordedParties.set(row.id, new Map());
      const history = recordedParties.get(row.id); history.set(row.party, (history.get(row.party) || 0) + 1);
      if (!groups.has(row.party)) groups.set(row.party, { total: 0, counts: new Map() });
      const g = groups.get(row.party); g.total++; g.counts.set(row.choice, (g.counts.get(row.choice) || 0) + 1);
    }
    const contested = event.length > 0 && 1 - Math.max(...choiceCounts.values()) / event.length >= contestedMinority - 1e-12;
    contestedVotes += Number(contested);
    const matter = matterKey(vote);
    for (let i = 0; i < event.length; i++) for (let j = i + 1; j < event.length; j++) {
      const a = event[i], b = event[j], key = positions.get(a.id) * ids.length + positions.get(b.id), same = a.choice === b.choice;
      let p = pairs.get(key);
      if (!p) pairs.set(key, p = { a: a.id, b: b.id, ...bucket(), yesNo: bucket(), contested: bucket(), matterWeighted: bucket(), sessionWeighted: bucket(), voteIds: { agreement: [], disagreement: [] } });
      increment(p, same);
      if (a.choice !== 'abstain' && b.choice !== 'abstain') increment(p.yesNo, same);
      if (contested) increment(p.contested, same);
      retain(p.voteIds[same ? 'agreement' : 'disagreement'], String(vote.id));
    }
    const modes = [];
    for (const [party, g] of groups) {
      const ordered = [...g.counts].sort((a, b) => b[1] - a[1]);
      const unique = ordered.length === 1 || ordered[0][1] > ordered[1][1];
      let c = cohesion.get(party);
      if (!c) cohesion.set(party, c = { party, votes: 0, eligibleBallots: 0, modalBallots: 0, modalSupportSum: 0, tiedVotes: 0, voteIds: [] });
      c.votes++; c.eligibleBallots += g.total; c.modalBallots += ordered[0][1]; c.modalSupportSum += ordered[0][1] / g.total; c.tiedVotes += Number(!unique); retain(c.voteIds, String(vote.id));
      if (unique) modes.push([party, ordered[0][0]]);
    }
    modes.sort((a, b) => a[0].localeCompare(b[0]));
    for (let i = 0; i < modes.length; i++) for (let j = i + 1; j < modes.length; j++) {
      const [a, ca] = modes[i], [b, cb] = modes[j], key = `${a}\0${b}`, same = ca === cb;
      let p = partyPairs.get(key);
      if (!p) partyPairs.set(key, p = { a, b, ...bucket(), voteIds: { agreement: [], disagreement: [] } });
      increment(p, same); retain(p.voteIds[same ? 'agreement' : 'disagreement'], String(vote.id));
    }
    for (const row of event) for (const [party, group] of groups) {
      if (!row.party || row.party === party) continue;
      const key = `${row.id}\0${row.party}\0${party}`;
      let c = cross.get(key);
      if (!c) cross.set(key, c = { mpId: row.id, ownParty: row.party, party, events: 0, availableCounterpartBallots: 0, agreements: 0, eventAgreementSum: 0, matters: new Map(), voteIds: [] });
      const matches = group.counts.get(row.choice) || 0;
      c.events++; c.availableCounterpartBallots += group.total; c.agreements += matches; c.eventAgreementSum += matches / group.total;
      let mb = c.matters.get(matter); if (!mb) c.matters.set(matter, mb = { sum: 0, n: 0 }); mb.sum += matches / group.total; mb.n++;
      retain(c.voteIds, String(vote.id));
    }
  }
  addWeightedComparisons(byVote, selected, pairs, positions, ids.length, matterKey, 'matterWeighted');
  addWeightedComparisons(byVote, selected, pairs, positions, ids.length, sessionKey, 'sessionWeighted');
  return {
    nodes: ids.map(id => {
      const m = memberMap.get(id) || {}, history = [...(recordedParties.get(id) || [])].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      return { id, name: m.name || [m.firstName, m.lastName].filter(Boolean).join(' ') || id, party: history.length && (history.length === 1 || history[0][1] > history[1][1]) ? history[0][0] : '', recordedParties: Object.fromEntries(history), partyChanged: history.length > 1 };
    }),
    pairs: [...pairs.values()].map(p => ({ ...finish(p), yesNo: finish(p.yesNo), contested: finish(p.contested), matterWeighted: finish(p.matterWeighted), sessionWeighted: finish(p.sessionWeighted), lowSupport: p.common < minCommon, evidenceComplete: p.voteIds.agreement.length + p.voteIds.disagreement.length === p.common })).sort((a, b) => b.agreement - a.agreement || b.common - a.common || a.a.localeCompare(b.a) || a.b.localeCompare(b.b)),
    partyPairs: [...partyPairs.values()].map(p => ({ ...finish(p), lowSupport: p.common < minCommon, evidenceComplete: p.voteIds.agreement.length + p.voteIds.disagreement.length === p.common })),
    cohesion: [...cohesion.values()].map(({ modalSupportSum, ...c }) => ({ ...c, modalSupport: ratio(c.modalBallots, c.eligibleBallots), meanModalSupport: ratio(modalSupportSum, c.votes), evidenceComplete: c.voteIds.length === c.votes })),
    crossParty: [...cross.values()].map(({ matters, eventAgreementSum, ...c }) => ({ ...c, alignment: ratio(eventAgreementSum, c.events), ballotWeightedAlignment: ratio(c.agreements, c.availableCounterpartBallots), availableGroupSizeMean: ratio(c.availableCounterpartBallots, c.events), matterWeightedAlignment: matters.size ? [...matters.values()].reduce((s, m) => s + m.sum / m.n, 0) / matters.size : null, matters: matters.size, lowSupport: c.events < minCommon, evidenceComplete: c.voteIds.length === c.events })),
    coverage: { from: selected.map(v => String(v.date).slice(0, 10)).sort()[0] || null, to: selected.map(v => String(v.date).slice(0, 10)).sort().at(-1) || null, votes: selected.length, eligibleBallots, excludedChoices, duplicateBallots: duplicates, conflictingBallots: conflicting.size, contestedVotes },
    method: { version: VOTING_METHOD_VERSION, eligibleChoices: [...eligible], minCommon, contestedMinority, contestedDefinition: 'At least this share of eligible ballots differs from the overall modal choice.', partyIdentity: 'recorded per ballot; cross-party profiles split by own recorded party', graphPartyBaseline: 'unique most frequent recorded party in selected eligible ballots; ties/unknown blank; changes retained', missingParty: 'eligible for pair statistics; excluded from party-derived measures', matterWeighting: 'mean of within-pair agreement per document, missing document falls back to session', crossPartyNormalization: 'mean per-event fraction of eligible counterpart group agreeing; each group and event has equal weight', evidenceLimit: Number.isFinite(evidenceLimit) ? evidenceLimit : null, ties: 'equal agreements remain ties; display order is not a rank', interpretation: 'voting alignment, not influence' }
  };
}

/** Deterministic equal-matter block bootstrap for graph sensitivity, not CIs.
 * Original common-vote counts remain the support gate; absent sampled pair
 * observations produce null similarity, never an invented zero agreement.
 */
export function buildMatterBootstrapAnalyses(input, options = {}) {
  const { baseAnalysis, seeds = [11, 29, 47], minCommon = baseAnalysis?.method?.minCommon || 30 } = options;
  if (!Array.isArray(seeds) || !seeds.length || seeds.some(seed => !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) || !(minCommon >= 1)) throw new Error('Invalid bootstrap settings');
  const base = baseAnalysis || buildVotingAnalysis(input, options);
  const { selected, byVote } = prepareBallots(input.votes || [], input.ballots || [], options);
  if (base.coverage?.votes !== selected.length) throw new Error('Bootstrap base analysis has a different vote scope');
  const nodes = base.nodes || [], n = nodes.length, positions = new Map(nodes.map((node, index) => [String(node.id), index]));
  // Reject a mismatched identity scope rather than silently dropping ballots.
  for (const event of byVote.values()) for (const id of event.keys()) if (!positions.has(id)) throw new Error('Bootstrap base analysis has a different member scope');
  const blocks = [...new Set(selected.map(matterKey))].length;
  const variants = seeds.map(seed => {
    let state = seed >>> 0;
    const multiplicities = new Uint32Array(blocks);
    for (let draw = 0; draw < blocks; draw++) {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      multiplicities[Math.floor(state / 4294967296 * blocks)]++;
    }
    return { seed, multiplicities, sums: new Float64Array(n * n), observations: new Uint32Array(n * n) };
  });
  visitPairGroupStats(byVote, selected, positions, n, matterKey, (key, common, agree, group) => {
    const withinMatter = agree / common;
    for (const variant of variants) {
      const count = variant.multiplicities[group];
      if (!count) continue;
      variant.sums[key] += count * withinMatter; variant.observations[key] += count;
    }
  });
  return variants.map(variant => ({
    nodes,
    pairs: base.pairs.map(pair => {
      const a = positions.get(String(pair.a)), b = positions.get(String(pair.b)), key = Math.min(a, b) * n + Math.max(a, b), count = variant.observations[key];
      return { a: pair.a, b: pair.b, common: pair.common, agreement: count ? variant.sums[key] / count : null, sampledMatterObservations: count, lowSupport: pair.common < minCommon };
    }),
    coverage: { ...base.coverage, bootstrap: { seed: variant.seed, blocks, draws: blocks, distinctSampledBlocks: variant.multiplicities.filter(count => count > 0).length } },
    method: { version: 'voting-matter-bootstrap-1', baseVersion: base.method?.version, minCommon, seed: variant.seed, seedGenerator: 'LCG uint32 1664525*x+1013904223', weighting: 'equal within-matter agreement, weighted by bootstrap block multiplicity', block: 'document; missing document falls back to parliamentary year/session', draws: blocks, replacement: true, support: 'original joint eligible ballot count retained as minimum-support gate', interpretation: 'deterministic matter-block sensitivity; no confidence interval or causal interpretation' }
  }));
}
