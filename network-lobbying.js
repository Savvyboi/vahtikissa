const clean = value => String(value || '').normalize('NFC').trim().replace(/\s+/gu, ' ');
const norm = value => clean(value).toLocaleLowerCase('fi');
const byId = (a, b) => String(a.id).localeCompare(String(b.id), 'en');
function date(value) {
  const text = String(value || '').slice(0, 10);
  const parsed = Date.parse(`${text}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/u.test(text) && Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === text ? text : null;
}

export function buildLobbyingAnalysis(influence, members = [], options = {}) {
  const asOf = date(options.asOf || influence?.metadata?.generatedAt);
  if (!asOf) throw new Error('Lobbying analysis needs a valid snapshot cutoff');
  const from = options.from ? date(options.from) : null, to = options.to ? date(options.to) : asOf;
  if ((options.from && !from) || !to || (from && from > to)) throw new Error('Invalid lobbying analysis period');
  const memberMap = new Map(members.map(member => [String(member.id), member]));
  const names = new Map();
  for (const member of members) {
    const name = norm(`${member.firstName || ''} ${member.lastName || ''}`);
    if (!names.has(name)) names.set(name, []);
    names.get(name).push(String(member.id));
  }
  const reviewed = new Map();
  for (const row of options.crosswalk || []) {
    if (row.reviewedBy && row.reviewedAt && row.independentHuman === true && memberMap.has(String(row.mpId))) {
      const id = String(row.targetId);
      if (!reviewed.has(id)) reviewed.set(id, []);
      reviewed.get(id).push({ ...row, mpId: String(row.mpId) });
    }
  }
  const targets = (influence.targets || []).map(target => {
    const id = String(target.id), label = clean(target.fi?.name || target.sv?.name || target.fi?.organization || target.sv?.organization || id);
    const possible = names.get(norm(target.fi?.name || target.sv?.name)) || [];
    const reviews = reviewed.get(id) || [], reviewIds = [...new Set(reviews.map(row => row.mpId))];
    const matched = reviewIds.length === 1;
    const identityStatus = reviewIds.length > 1 ? 'ambiguous-reviewed' : matched ? 'reviewed-mp' : target.kind !== 'mp' ? 'non-mp' : possible.length > 1 ? 'ambiguous' : possible.length === 1 ? 'candidate-unreviewed' : 'unmatched';
    return { ...target, id, label, identityStatus, candidateMpIds: possible, ...(matched ? { mpId: reviewIds[0], review: { reviewedBy: reviews[0].reviewedBy, reviewedAt: reviews[0].reviewedAt, independentHuman: true } } : {}) };
  }).sort(byId);
  const targetMap = new Map(targets.map(target => [target.id, target]));
  const orgs = new Map(), periods = new Map(), relationships = new Map(), declarations = new Map(), excluded = [];
  let inputAssociations = 0, duplicateAssociations = 0, excludedAssociations = 0;
  const exclude = (row, reason) => { const associations = (row.targetIds || []).length; excludedAssociations += associations; excluded.push({ id: row.id, reason, associations }); };
  for (const row of influence.lobbying || []) {
    inputAssociations += (row.targetIds || []).length;
    const start = date(row.period?.start), end = date(row.period?.end);
    if (!start || !end || start > end) { exclude(row, 'unknown-or-invalid-period'); continue; }
    if (end >= asOf) { exclude(row, 'period-not-closed-at-snapshot'); continue; }
    // Periods cannot be split into dates of contact: select only fully contained reporting periods.
    if ((from && start < from) || end > to) { exclude(row, 'period-outside-selected-window'); continue; }
    const notificationId = String(row.notificationId || '');
    if (!notificationId) { exclude(row, 'missing-declaration-id'); continue; }
    const companyId = clean(row.companyId), organisationId = companyId || `unresolved:${notificationId}`;
    if (!orgs.has(organisationId)) orgs.set(organisationId, { id: organisationId, companyId: companyId || null, label: clean(row.actor) || organisationId, labels: new Set(), identityStatus: companyId ? 'company-id' : 'missing-company-id', declarations: new Set(), topics: new Set(), periods: new Set(), targets: new Set() });
    const org = orgs.get(organisationId), periodId = `${start}/${end}`, topic = clean(row.topic), topicKey = norm(topic);
    org.labels.add(clean(row.actor)); org.declarations.add(notificationId); org.topics.add(topicKey); org.periods.add(periodId);
    if (!periods.has(periodId)) periods.set(periodId, { id: periodId, from: start, to: end, organisations: new Set(), declarations: new Set(), topics: new Set(), targets: new Set() });
    const period = periods.get(periodId);
    period.organisations.add(organisationId); period.declarations.add(notificationId); period.topics.add(topicKey);
    const sourceUrl = row.sourceUrl || influence.metadata?.transparencySource || 'https://public.api.avoimuusrekisteri.fi/open-data-activity-notification';
    if (!declarations.has(notificationId)) declarations.set(notificationId, { id: notificationId, diaryNumber: row.diaryNumber || '', organisationId, companyId: companyId || null, period: { start, end }, sourceUrl, topicIds: new Set() });
    declarations.get(notificationId).topicIds.add(String(row.id));
    for (const targetId of (row.targetIds || []).map(String)) {
      const relationId = JSON.stringify([notificationId, topicKey, targetId]);
      if (relationships.has(relationId)) {
        duplicateAssociations++;
        const existing = relationships.get(relationId);
        if (!existing.sourceRecordIds.includes(String(row.id))) existing.sourceRecordIds.push(String(row.id));
        continue;
      }
      const target = targetMap.get(targetId);
      org.targets.add(targetId); period.targets.add(targetId);
      relationships.set(relationId, { id: `${notificationId}:${row.id}:${targetId}`, declarationId: notificationId, notificationId, diaryNumber: row.diaryNumber || '', topicId: String(row.id), organisationId, companyId: companyId || null, organisation: org.label, topic, targetId, targetLabel: target?.label || targetId, targetKind: target?.kind || 'unknown', identityStatus: target?.identityStatus || 'missing-target', ...(target?.mpId ? { mpId: target.mpId } : {}), period: { start, end }, periodId, sourceUrl, sourceRecordIds: [String(row.id)] });
    }
  }
  const count = row => Object.fromEntries(Object.entries(row).map(([name, value]) => [name, value instanceof Set ? value.size : value]));
  const organisations = [...orgs.values()].map(org => ({ ...count(org), labels: [...org.labels].filter(Boolean).sort(), declarationIds: [...org.declarations].sort(), periodIds: [...org.periods].sort() })).sort(byId);
  const result = [...relationships.values()].sort(byId);
  const statuses = {};
  for (const row of result) statuses[row.identityStatus] = (statuses[row.identityStatus] || 0) + 1;
  return {
    relationships: result, organisations, targets,
    periods: [...periods.values()].map(count).sort(byId),
    declarations: [...declarations.values()].map(row => ({ ...row, topicIds: [...row.topicIds].sort() })).sort(byId),
    coverage: { asOf, from, to, sourceTopics: (influence.lobbying || []).length, inputAssociations, relationships: result.length, duplicateAssociations, excludedAssociations, reconciliation: inputAssociations === result.length + duplicateAssociations + excludedAssociations, organisations: organisations.length, topics: new Set(result.map(row => norm(row.topic))).size, periods: periods.size, declarations: declarations.size, targets: new Set(result.map(row => row.targetId)).size, identityStatuses: statuses, excluded: excluded.length, exclusions: excluded },
    method: { version: 'lobbying-network-1', meaning: 'reported organisation-topic-target associations, not meetings', time: 'closed reporting periods only; selected dates must contain entire period', identity: 'company IDs; missing company IDs remain declaration-scoped unresolved organisations', deduplication: 'notification ID + normalized declared topic + target ID', recurringTarget: 'target IDs retained across periods; only independently reviewed crosswalks assign MP IDs', sourceLinks: 'source collection URL plus notification ID and diary number; local frozen declaration evidence preserves exact selected source records', forbiddenInterpretations: ['lobbying effectiveness', 'corruption', 'precise contact timestamps'] },
    publicationGate: { status: reviewed.size ? 'partially-reviewed' : 'pending-independent-human-crosswalk', personRankingsEnabled: false, reviewedTargetIds: [...reviewed.keys()].sort(), reason: 'No person rankings are published. Unreviewed, ambiguous and non-MP recipients remain distinct; reviewed records may be inspected individually.' }
  };
}
