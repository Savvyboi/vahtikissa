// Keep presentation order and sample support separate from the underlying scores.
export function votingComparisonRows(data, mp, members) {
  const byId = new Map(members.map(member => [String(member.id), member]));
  const minimum = data.method?.minCommon ?? 30;
  return (Array.isArray(data.pairs) ? data.pairs : Object.values(data.pairs || {})).map(pair => {
    const neighbour = String(pair.a) === String(mp) ? String(pair.b) : String(pair.a);
    const member = byId.get(neighbour);
    return { ...pair, neighbour, name: member ? `${member.firstName} ${member.lastName}` : neighbour,
      party: data.partyByMember?.[neighbour] || '', lowSupport: pair.lowSupport || pair.common < minimum };
  });
}

export function orderVotingComparisons(rows, direction = 'desc', lang = 'fi') {
  const collator = new Intl.Collator(lang, { sensitivity: 'base' });
  return [...rows].sort((a, b) => {
    if (a.agreement == null) return b.agreement == null ? collator.compare(a.name, b.name) : 1;
    if (b.agreement == null) return -1;
    return (a.agreement - b.agreement) * (direction === 'asc' ? 1 : -1) || collator.compare(a.name, b.name);
  });
}

export function agreementWidth(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value * 100)) : 0;
}
