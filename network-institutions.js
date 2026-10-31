// Pure institutional proximity calculations. All arithmetic uses UTC day numbers.
const DAY = 86400000;
const clean = value => String(value || '').normalize('NFC').trim().replace(/\s+/gu, ' ');
const key = value => clean(value).toLocaleLowerCase('fi');
function day(value) {
  const date = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) return null;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? time / DAY : null;
}
const iso = value => new Date(value * DAY).toISOString().slice(0, 10);
const sort = (a, b) => String(a).localeCompare(String(b), 'en');

export function buildCommitteeAnalysis(profiles, members = [], options = {}) {
  const source = profiles?.members || profiles || {};
  const from = day(options.from || '2023-04-02');
  const to = day(options.to || profiles?.metadata?.generatedAt);
  if (from === null || to === null || to < from) throw new Error('Committee analysis needs valid from/to coverage dates');
  const sourceEndConvention = options.sourceEndConvention || 'inclusive';
  if (!['inclusive', 'exclusive'].includes(sourceEndConvention)) throw new Error('Unknown source appointment end convention');
  // Official loppupvm dates are retained verbatim by ingestion. Inclusive interpretation
  // matches next-day role transitions and same-day appointments in the local snapshot.
  // Convert once to exclusive UTC boundaries for all intersection arithmetic.
  const end = to + 1;
  const ids = new Set(members.map(member => String(member.id)));
  const entries = Object.values(source).filter(profile => !ids.size || ids.has(String(profile.id)));
  const names = new Map();
  const known = new Map();
  for (const profile of entries) for (const row of profile.committees || []) {
    if (!row.id) continue;
    const bodyId = String(row.id);
    known.set(bodyId, { ...(known.get(bodyId) || {}), ...(typeof row.name === 'object' ? row.name : { fi: row.name }) });
    for (const label of Object.values(typeof row.name === 'object' ? row.name : { fi: row.name })) if (label) names.set(key(label), bodyId);
  }
  for (const [alias, canonical] of Object.entries(options.bodyAliases || {})) names.set(key(alias), names.get(key(canonical)) || String(canonical));
  const roleKey = value => {
    const label = key(value);
    if (/varapuheenjohtaja|vice.*ordförande/u.test(label)) return 'vice-chair';
    if (/puheenjohtaja|ordförande/u.test(label)) return 'chair';
    if (/varajäsen|ersättare/u.test(label)) return 'substitute';
    if (/jäsen|medlem/u.test(label)) return 'member';
    return label || 'unknown';
  };
  const groups = new Map(), excluded = [];
  let records = 0;
  for (const profile of entries) {
    // Finnish histories include former appointments; Swedish duplicates are not counted twice.
    const rows = [...(profile.committees || []), ...(profile.bodies?.fi || [])];
    for (const row of rows) {
      records++;
      const name = clean(typeof row.name === 'object' ? row.name.fi || row.name.sv : row.name);
      const bodyId = names.get(key(name)) || String(row.id || `name:${key(name)}`);
      const start = day(row.from), sourceStop = row.to ? day(row.to) : null;
      const stop = row.to ? sourceStop === null ? null : sourceStop + (sourceEndConvention === 'inclusive' ? 1 : 0) : end;
      const mpId = String(profile.id);
      if (start === null || stop === null || !name || (row.to && sourceStop < start)) {
        excluded.push({ mpId, bodyId, name, from: row.from || null, to: row.to || null, reason: 'unknown-or-invalid-dates-or-body' });
        continue;
      }
      const a = Math.max(start, from), b = Math.min(stop, end);
      if (b <= a) continue;
      const roleLabel = clean(typeof row.role === 'object' ? row.role.fi || row.role.sv : row.role);
      const role = roleKey(roleLabel), groupKey = `${mpId}\u0000${bodyId}\u0000${role}`;
      if (!groups.has(groupKey)) groups.set(groupKey, { mpId, bodyId, name, names: known.get(bodyId) || { fi: name }, role, roleLabel, sourceUrl: profile.sourceUrl || '', intervals: [] });
      groups.get(groupKey).intervals.push([a, b]);
    }
  }
  const memberships = [];
  for (const group of groups.values()) {
    const merged = [];
    for (const interval of group.intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
      const last = merged.at(-1);
      if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
      else merged.push([...interval]);
    }
    const { intervals, ...detail } = group;
    for (const [a, b] of merged) memberships.push({ ...detail, id: `membership:${group.mpId}:${group.bodyId}:${group.role}:${iso(a)}:${iso(b)}`, from: iso(a), to: iso(b), days: b - a });
  }
  memberships.sort((a, b) => sort(a.mpId, b.mpId) || sort(a.bodyId, b.bodyId) || sort(a.from, b.from) || sort(a.role, b.role));
  const bodies = new Map();
  for (const row of memberships) {
    if (!bodies.has(row.bodyId)) bodies.set(row.bodyId, []);
    bodies.get(row.bodyId).push(row);
  }
  const pairMap = new Map();
  for (const [bodyId, rows] of bodies) {
    const bounds = [...new Set(rows.flatMap(row => [day(row.from), day(row.to)]))].sort((a, b) => a - b);
    for (let i = 0; i < bounds.length - 1; i++) {
      const a = bounds[i], b = bounds[i + 1];
      const active = new Map();
      for (const row of rows) if (day(row.from) <= a && day(row.to) >= b) {
        if (!active.has(row.mpId)) active.set(row.mpId, []);
        active.get(row.mpId).push(row);
      }
      const people = [...active.keys()].sort(sort), n = people.length;
      for (let x = 0; x < n; x++) for (let y = x + 1; y < n; y++) {
        const first = people[x], second = people[y], pairKey = `${first}\u0000${second}`;
        if (!pairMap.has(pairKey)) pairMap.set(pairKey, { a: first, b: second, sharedDays: 0, weightedDays: 0, bodies: new Map() });
        const pair = pairMap.get(pairKey);
        if (!pair.bodies.has(bodyId)) pair.bodies.set(bodyId, { bodyId, name: rows[0].name, sharedDays: 0, weightedDays: 0, intervals: [], rolesA: new Set(), rolesB: new Set(), evidence: new Set() });
        const body = pair.bodies.get(bodyId), days = b - a, weighted = days / (n - 1);
        pair.sharedDays += days; pair.weightedDays += weighted;
        body.sharedDays += days; body.weightedDays += weighted;
        body.intervals.push({ from: iso(a), to: iso(b), days, activeMembers: n });
        for (const row of active.get(first)) { body.rolesA.add(row.role); body.evidence.add(row.id); }
        for (const row of active.get(second)) { body.rolesB.add(row.role); body.evidence.add(row.id); }
      }
    }
  }
  const pairs = [...pairMap.values()].map(pair => ({ ...pair, bodies: [...pair.bodies.values()].map(body => ({ ...body, rolesA: [...body.rolesA].sort(), rolesB: [...body.rolesB].sort(), evidence: [...body.evidence].sort() })).sort((a, b) => sort(a.bodyId, b.bodyId)) }));
  pairs.sort((a, b) => b.weightedDays - a.weightedDays || sort(a.a, b.a) || sort(a.b, b.b));
  return {
    memberships, pairs,
    coverage: { from: iso(from), to: iso(to), endExclusive: iso(end), members: entries.length, observedMembers: new Set(memberships.map(row => row.mpId)).size, bodies: bodies.size, sourceRecords: records, intervals: memberships.length, excluded: excluded.length, exclusions: excluded },
    method: { version: 'committee-overlap-2', interpretation: 'institutional proximity', dates: 'UTC derived [from,to); selected coverage end inclusive', sourceEndConvention, sourceEndEvidence: 'Inclusive source ends inferred from consecutive-day role changes and same-day appointments; source schema does not formally declare endpoint semantics', projection: 'sum shared body-days / (contemporaneously active tracked body members - 1)', roles: 'retained separately; simultaneous roles never multiply overlap', canonicalization: 'official body IDs and known Finnish/Swedish labels; supplied historical aliases; other names exact-normalized', missingDates: 'excluded and reported', openEnd: 'capped at analysis coverage end', unknownPartyHistory: 'no event-party claims derived from current party' }
  };
}

export function compareLayers(memberId, voting, committees, options = {}) {
  const id = String(memberId), related = rows => (rows || []).filter(row => String(row.a) === id || String(row.b) === id);
  return {
    memberId: id,
    layers: [
      { layer: 'voting', unit: 'agreement on jointly eligible ballots', coverage: voting?.coverage || null, available: Boolean(voting), relationships: related(voting?.pairs) },
      { layer: 'committees', unit: 'shared body-days; size-corrected body-days separately', coverage: committees?.coverage || null, available: Boolean(committees), relationships: related(committees?.pairs) }
    ],
    window: { from: options.from || null, to: options.to || null },
    interpretation: 'Separate units; missing observations are unavailable. Current member IDs provide the shared identity crosswalk. No combined score.'
  };
}
