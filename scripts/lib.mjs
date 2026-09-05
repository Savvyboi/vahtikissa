export const START_DATE = '2023-04-02';

export function rowsToObjects(payload) {
  if (!payload?.columnNames || !payload?.rowData) return [];
  return payload.rowData.map(row => Object.fromEntries(payload.columnNames.map((name, index) => [name, row[index]])));
}

export function isInRange(value) {
  if (!value) return false;
  return String(value).slice(0, 10) >= START_DATE;
}

export function normalizeParty(value) {
  return String(value || 'sit').trim().toLowerCase().replace(/[^a-zåäö0-9-]/gi, '') || 'sit';
}

export function normalizeVote(value) {
  const label = String(value || '').trim().toLocaleLowerCase('fi');
  if (['jaa', 'ja', 'yes'].includes(label)) return 'yes';
  if (['ei', 'no'].includes(label)) return 'no';
  if (label.startsWith('tyhj') || label.includes('pidättä')) return 'abstain';
  if (label.startsWith('poissa') || label === 'absent') return 'absent';
  return 'other';
}

export function textFromXml(xml = '') {
  return String(xml).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function pick(obj, ...keys) {
  for (const key of keys) if (obj?.[key] !== undefined && obj[key] !== null && String(obj[key]).trim()) return obj[key];
  return '';
}

const emptyStats = () => ({ votes: 0, yes: 0, no: 0, abstain: 0, absent: 0, other: 0, speeches: 0, participation: 0, loyalty: 0, loyaltyVotes: 0 });

export function deriveMembers(...collections) {
  const latest = new Map();
  for (const item of collections.flat()) {
    if (!item.mpId) continue;
    const date = String(item.date || '');
    if (!latest.has(item.mpId) || date > latest.get(item.mpId).date) latest.set(item.mpId, { ...item, date });
  }
  return [...latest.values()].map(item => ({ id: item.mpId, firstName: item.firstName || '', lastName: item.lastName || '', party: item.party || 'sit' }))
    .sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`, 'fi'));
}

export function buildIndexes(data) {
  const members = Object.fromEntries(data.members.map(member => [member.id, { ...member, stats: emptyStats() }]));
  const parties = {};
  const ensureParty = code => parties[code] ||= { code, name: code.toUpperCase(), stats: emptyStats(), memberIds: [] };
  for (const member of data.members) {
    const party = ensureParty(member.party);
    if (!party.memberIds.includes(member.id)) party.memberIds.push(member.id);
  }
  const voteBallots = {};
  for (const ballot of data.ballots) {
    const member = members[ballot.mpId] ||= { id: ballot.mpId, firstName: '', lastName: `Edustaja ${ballot.mpId}`, party: ballot.party, stats: emptyStats() };
    const party = ensureParty(ballot.party || member.party);
    member.stats.votes++;
    member.stats[ballot.choice] = (member.stats[ballot.choice] || 0) + 1;
    party.stats.votes++;
    party.stats[ballot.choice] = (party.stats[ballot.choice] || 0) + 1;
    (voteBallots[ballot.voteId] ||= []).push(ballot);
  }
  for (const speech of data.speeches) {
    if (members[speech.mpId]) members[speech.mpId].stats.speeches++;
    ensureParty(speech.party).stats.speeches++;
  }
  for (const item of [...Object.values(members), ...Object.values(parties)]) {
    const s = item.stats;
    s.participation = s.votes ? Math.round(((s.yes + s.no + s.abstain) / s.votes) * 100) : 0;
  }
  for (const ballots of Object.values(voteBallots)) {
    const majorities = {};
    for (const ballot of ballots) {
      const key = ballot.party;
      majorities[key] ||= { yes: 0, no: 0, abstain: 0 };
      if (ballot.choice in majorities[key]) majorities[key][ballot.choice]++;
    }
    for (const ballot of ballots) {
      const values = majorities[ballot.party];
      const ranked = Object.entries(values).sort((a, b) => b[1] - a[1]);
      const tied = !ranked[0]?.[1] || ranked[0][1] === ranked[1]?.[1];
      if (!tied && members[ballot.mpId] && ['yes', 'no', 'abstain'].includes(ballot.choice)) {
        members[ballot.mpId].stats.loyaltyVotes++;
        if (ballot.choice === ranked[0][0]) members[ballot.mpId].stats.loyalty++;
      }
    }
  }
  for (const member of Object.values(members)) {
    member.stats.loyalty = member.stats.loyaltyVotes ? Math.round((member.stats.loyalty / member.stats.loyaltyVotes) * 100) : 0;
  }
  return { members, parties, voteBallots };
}
