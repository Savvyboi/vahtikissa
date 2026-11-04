import test from 'node:test';
import assert from 'node:assert/strict';
import { compareKeywords, phraseUptake, buildTopicProfiles, emergingPhrases, extractReferences, evaluateReferences, buildSpeechAnalysis, REFERENCE_REVIEW_POLICY } from '../network-speech.js';
import { researchSummary, filterResearchSpeeches } from '../speech-research.js';
import { referenceReviewTemplate, evaluateReviewArtifact, referenceExtractionDigest } from '../scripts/network-reference-review.mjs';

const speech = (id, date, mpId = '1', party = 'a', extra = {}) => ({ id, date, mpId, party, firstName: 'Test', lastName: mpId, ...extra });

test('keyword rates reproduce existing corpus/exclusion semantics and metadata-only hits do not inflate counts', () => {
  const speeches = [speech('a', '2024-01-02'), speech('b', '2024-01-10'), speech('c', '2024-02-01', '2', 'b', { agenda: 'Talous' }), speech('d', '2024-02-02')];
  const texts = { a: 'talous talous kasvaa', b: 'koulutus kehittyy', c: 'Muu puhe', d: 'talous salainen' };
  const settings = { query: 'talous', exclude: 'salainen', mode: 'word', scope: 'all' }, actual = compareKeywords(speeches, texts, settings);
  const corpus = filterResearchSpeeches(speeches, texts, { ...settings, query: '' }), expected = researchSummary(corpus, texts, 'talous', 'word');
  assert.equal(actual.points.reduce((sum, point) => sum + point.words, 0), expected.words);
  assert.equal(actual.points.reduce((sum, point) => sum + point.occurrences, 0), expected.occurrences);
  assert.equal(actual.points[0].per10000Words, 4000);
  assert.equal(actual.points[1].metadataOnlyMatches, 1);
  assert.equal(actual.points[1].matchingSpeeches, 0);
  assert.equal(actual.points[1].speechPrevalence, 0);
  assert.deepEqual(actual.points[0].speechIds, ['a']);
});

test('keyword groups use event-time party and denominator filters, with null gaps and marked partial months', () => {
  const speeches = [speech('a', '2024-01-20', '1', 'a'), speech('b', '2024-03-10', '1', 'b'), speech('c', '2024-03-11', '2', 'b')], texts = { a: 'talous', b: 'talous', c: '' };
  const report = compareKeywords(speeches, texts, { query: 'talous', dateFrom: '2024-01-10', dateTo: '2024-03-11', groups: [{ party: 'a' }, { mpId: '1' }] });
  assert.equal(report.series[0].points[0].partialMonth, true);
  assert.equal(report.series[0].points[1].per10000Words, null);
  assert.equal(report.series[0].points[1].coverageGap, true);
  assert.equal(report.series[1].points[2].occurrences, 1);
  assert.equal(report.series[1].points[2].partialMonth, true);
  assert.equal(report.series[1].points[0].distinctSpeakers, 1);
  assert.equal(compareKeywords(speeches, texts, { query: 'talous', party: 'b' }).points[0].occurrences, 1);
});

test('phrase uptake preserves simultaneous absolute instants, later quotations and archive limitations', () => {
  const speeches = [speech('b', '2024-01-01T10:00:00Z', '2', 'b'), speech('a', '2024-01-01T12:00:00+02:00'), speech('c', '2024-02-01T10:00:00Z', '3', 'c'), speech('d', 'invalid')];
  const texts = { a: 'Vihreä, siirtymä', b: 'vihreä siirtymä', c: '"vihreä siirtymä" vihreä siirtymä', d: 'vihreä siirtymä' };
  const report = phraseUptake(speeches, texts, { query: 'vihreä siirtymä', coverageStart: '2023-04-25' });
  assert.deepEqual(report.firstUses.map(use => use.id), ['a', 'b']);
  assert.equal(report.uses[2].occurrences, 2);
  assert.equal(report.uses[2].quotationMarkerPresent, true);
  assert.equal(report.corpusStart, '2023-04-25');
  assert.equal(report.method.authorshipClaim, false); assert.equal(report.method.transmissionEdges, false);
  assert.equal(phraseUptake(speeches, texts, { query: 'absent' }).firstObservedAt, null);
  assert.equal(phraseUptake(speeches, texts, { query: '' }).uses.length, 0);
});

test('topic profiles normalize within-MP attention and retain matters and external speaker exclusion', () => {
  const speeches = [speech('a', '2024-01-01', '1', 'a', { agenda: 'Koulutus', documents: [{ label: 'HE 1/2024 vp' }] }), speech('b', '2024-01-02', '1', 'a', { agenda: 'Terveys' }), speech('c', '2024-01-03', '2', 'b', { agenda: 'Koulutus' }), speech('d', '2024-01-03', '', '', { agenda: 'Koulutus' })];
  const profiles = buildTopicProfiles(speeches, { a: 'a b', b: 'b', c: 'c', d: 'd' });
  assert.equal(profiles.length, 2); assert.equal(profiles[0].speeches, 2);
  assert.ok(profiles[0].topics.some(topic => topic.withinMpShare === 0.5 && topic.topicParticipationShare === 0.5));
  assert.equal(profiles[0].matters[0].matterId, 'HE 1/2024 vp');
  assert.equal(profiles[0].matters[0].withinMpShare, 0.5);
});

test('topic profiles distinguish detailed agenda subjects and preserve exact uncategorised debates', () => {
  const speeches = [
    speech('a', '2026-01-01', '1', 'a', { agenda: 'Välineellistetyn maahantulon torjuminen' }),
    speech('b', '2026-01-02', '1', 'a', { agenda: ' Välineellistetyn   maahantulon torjuminen ' }),
    speech('c', '2026-01-03', '1', 'a', { agenda: 'Päiväjärjestys', agendaSv: 'Östgränsens övergångsställen' }),
    speech('d', '2026-01-04', '1', 'a', { agenda: 'Istunnon avaaminen' }),
    speech('e', '2026-01-05', '2', 'b', { agenda: 'Turvapaikkamenettely' })
  ];
  const [profile] = buildTopicProfiles(speeches);
  assert.equal(profile.unclassifiedSpeeches, 1);
  const migration = profile.detailedTopics.find(row => row.topic === 'migration');
  assert.equal(migration.withinMpShare, 0.5);
  assert.equal(migration.topicParticipationShare, 2 / 3);
  assert.ok(profile.detailedTopics.some(row => row.topic === 'border-security'));
  assert.deepEqual(profile.agendas[0].evidence.map(row => row.id), ['a', 'b']);
  assert.ok(profile.agendas.some(row => row.title === 'Istunnon avaaminen'));
  assert.ok(!profile.detailedTopics.some(row => row.topic === 'other'));
});

test('emerging phrases separate repetition from breadth and handle zero baseline and missing windows', () => {
  const speeches = [], texts = {};
  for (let index = 0; index < 3; index++) { const id = `s${index}`; speeches.push(speech(id, '2024-04-05', String(index), index ? 'b' : 'a')); texts[id] = 'metsäkato metsäkato vihreä siirtymä'; }
  speeches.push(speech('solo', '2024-04-06')); texts.solo = 'yksintoisto '.repeat(50);
  speeches.push(speech('base', '2024-02-01')); texts.base = 'taustasana';
  const report = emergingPhrases(speeches, texts, { baselineStart: '2024-01-01', baselineEnd: '2024-02-29', recentStart: '2024-03-01', recentEnd: '2024-04-30', minOccurrences: 3 });
  assert.ok(!report.rows.some(row => row.query === 'yksintoisto'));
  const row = report.rows.find(row => row.query === 'metsäkato'); assert.equal(row.zeroBaseline, true); assert.equal(row.rateRatio, null); assert.equal(row.recent.distinctSpeakers, 3); assert.equal(row.recent.partyBreadth, 2); assert.equal(row.direction, 'rising');
  assert.deepEqual(report.windows.recent.missingMonths, ['2024-03']);
  const absentBaseline = emergingPhrases(speeches.filter(s => s.id !== 'base'), texts, { baselineStart: '2024-01-01', baselineEnd: '2024-02-29', recentStart: '2024-03-01', recentEnd: '2024-04-30', minOccurrences: 3 });
  assert.equal(absentBaseline.rows[0].direction, 'unavailable'); assert.equal(absentBaseline.rows[0].baseline.per10000Words, null);
  assert.throws(() => emergingPhrases([], {}, { baselineStart: '2024-01-01', baselineEnd: '2024-03-01', recentStart: '2024-02-01', recentEnd: '2024-04-01' }), /non-overlapping/);
});

test('emerging repeated bigrams use existing non-overlapping phrase semantics', () => {
  const speeches = [speech('a', '2024-03-01')], texts = { a: 'metsäkato metsäkato metsäkato' };
  const result = emergingPhrases(speeches, texts, { baselineStart: '2024-01-01', baselineEnd: '2024-02-29', recentStart: '2024-03-01', recentEnd: '2024-04-30', minOccurrences: 1, minSpeakers: 1, minParties: 1 });
  assert.equal(result.rows.find(row => row.query === 'metsäkato metsäkato').recent.count, 1);
  const numeric = emergingPhrases(speeches, { a: 'ilmasto 2024 turvallisuus' }, { baselineStart: '2024-01-01', baselineEnd: '2024-02-29', recentStart: '2024-03-01', recentEnd: '2024-04-30', minOccurrences: 1, minSpeakers: 1, minParties: 1 });
  assert.ok(!numeric.rows.some(row => row.query === 'ilmasto turvallisuus'));
});

test('reference extraction keeps ambiguous names, negation and quotations without reply inference', () => {
  const members = [{ id: '1', firstName: 'Anna', lastName: 'Virtanen' }, { id: '2', firstName: 'Eero', lastName: 'Virtanen' }, { id: '3', firstName: 'Matti', lastName: 'Korhonen' }];
  const speeches = [speech('a', '2024-01-01'), speech('b', '2024-01-02', '3', 'a', { type: 'Vastauspuheenvuoro' })];
  const texts = { a: 'En tue edustaja Virtasen ehdotusta. Anna Virtanen sanoi "ei". Ministeri Korhonen vastasi.', b: 'En ole samaa mieltä.' };
  const result = extractReferences(speeches, texts, members);
  assert.equal(result.candidates.length, 3); assert.equal(result.candidates[0].ambiguous, true);
  assert.deepEqual(result.candidates[0].candidateIds, ['1', '2']);
  assert.equal(result.candidates[1].targetMpId, '1'); assert.equal(result.candidates[1].quotationMarkerPresent, true);
  assert.equal(result.candidates[2].targetMpId, '3'); assert.equal(result.publicPersonRankingsEnabled, false);
  assert.ok(result.candidates.every(candidate => candidate.speechId === 'a'));
  assert.deepEqual(result.sample, extractReferences(speeches, texts, members).sample);
});

test('reference review requires fixed sample and independent humans; perfect small/agent samples cannot open gate', () => {
  const extraction = extractReferences([speech('a', '2024-01-01')], { a: 'Edustaja Virtanen puhui.' }, [{ id: '2', firstName: 'Anna', lastName: 'Virtanen' }]);
  const template = referenceReviewTemplate(extraction); assert.equal(template.labels[0].valid, null); assert.equal(template.labels[0].independentHuman, false);
  assert.equal(evaluateReviewArtifact(extraction, template).acceptedLabels, 0);
  const labels = template.labels.map(label => ({ ...label, valid: true, targetMpId: '2', reviewer: 'Independent reviewer', independentHuman: true }));
  const evaluated = evaluateReferences(extraction.candidates, labels, { sampleIds: extraction.sample.map(candidate => candidate.id) });
  assert.equal(evaluated.precision, 1); assert.equal(evaluated.publicPersonRankingsEnabled, false); assert.deepEqual(evaluated.attention, []);
  assert.throws(() => evaluateReviewArtifact(extraction, { ...template, sampleIds: [] }), /sample changed/);
  assert.equal(evaluateReferences(extraction.candidates, [...labels, ...labels]).rejectedLabels[0].reason, 'duplicate-label');
});

test('predeclared precision target uses lower confidence bound and all unchanged sampled labels', () => {
  const candidates = Array.from({ length: 120 }, (_, index) => ({ id: `c${index}`, candidateIds: ['2'], targetMpId: '2', ambiguous: false, speechId: `s${index}`, sourceMpId: index % 2 ? '1' : '3' }));
  const labels = candidates.map(candidate => ({ candidateId: candidate.id, valid: true, targetMpId: '2', reviewer: 'Human', independentHuman: true }));
  const evaluation = evaluateReferences(candidates, labels, { sampleIds: candidates.map(candidate => candidate.id) });
  assert.equal(REFERENCE_REVIEW_POLICY.precisionTarget, 0.95); assert.ok(evaluation.lower95 > 0.95); assert.equal(evaluation.publicPersonRankingsEnabled, true);
  assert.equal(evaluation.attention[0].incomingReferences, 120); assert.equal(evaluation.attention[0].distinctReferringSpeakers, 2);
  assert.equal(evaluateReferences(candidates, labels).publicPersonRankingsEnabled, false);
});

test('human review artifacts bind complete candidate contents and source manifest, even when IDs remain the same', () => {
  const extraction = extractReferences([speech('a', '2024-01-01')], { a: 'Edustaja Virtanen puhui.' }, [{ id: '2', firstName: 'Anna', lastName: 'Virtanen' }]);
  const context = { manifestId: 'a'.repeat(24) }, review = referenceReviewTemplate(extraction, context);
  assert.equal(review.extractionDigest.length, 64);
  assert.equal(evaluateReviewArtifact(extraction, review, context).publicPersonRankingsEnabled, false);
  const changed = structuredClone(extraction); changed.candidates[0].passage = 'Same candidate ID, changed source context and negation.';
  assert.equal(changed.candidates[0].id, extraction.candidates[0].id);
  assert.throws(() => evaluateReviewArtifact(changed, review, context), /extraction changed/);
  assert.throws(() => evaluateReviewArtifact(extraction, review, { manifestId: 'b'.repeat(24) }), /extraction changed/);
  const differentIdentity = structuredClone(extraction); differentIdentity.candidates[0].candidateIds = ['unreviewed-person'];
  assert.throws(() => evaluateReviewArtifact(differentIdentity, review, context), /extraction changed/);
  const changedMethod = { ...extraction, method: { ...extraction.method, version: 'changed-method' } };
  assert.throws(() => evaluateReviewArtifact(changedMethod, review, context), /extraction changed/);
  const reorderedKeys = Object.fromEntries(Object.entries(extraction).reverse());
  assert.equal(referenceExtractionDigest(reorderedKeys, context), review.extractionDigest);
  const noBinding = { ...review }; delete noBinding.extractionDigest;
  assert.throws(() => evaluateReviewArtifact(extraction, noBinding, context), /extraction changed/);
});

test('speech summary is JSON-safe and emits explicit gate for empty or missing corpus', () => {
  const result = buildSpeechAnalysis([], {}, { members: [] });
  assert.deepEqual(result.topicProfiles, []); assert.equal(result.coverage.words, 0);
  assert.equal(result.references.publicationGate, 'pending-independent-human-review');
  assert.doesNotThrow(() => JSON.stringify(result));
});
