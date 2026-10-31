import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { evaluateReferences, REFERENCE_REVIEW_POLICY } from '../network-speech.js';

/** Files contain the extractor's unchanged candidates and predeclared sample.
 * A template never marks a record as reviewed or manufactures a human label. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

export function referenceExtractionDigest(extraction, { manifestId = null } = {}) {
  const bound = { manifestId, method: extraction.method, declaredPolicy: extraction.reviewPolicy, evaluationPolicy: REFERENCE_REVIEW_POLICY,
    sampleIds: extraction.sample.map(candidate => candidate.id), candidates: extraction.candidates };
  return createHash('sha256').update(JSON.stringify(canonical(bound))).digest('hex');
}

export function referenceReviewTemplate(extraction, { manifestId = null } = {}) {
  if (!Array.isArray(extraction.sample) || !Array.isArray(extraction.candidates)) throw new Error('Expected reference extraction with candidates and fixed sample');
  return { artifactVersion: 'reference-review-2', extractionDigest: referenceExtractionDigest(extraction, { manifestId }), manifestId,
    reviewPolicy: REFERENCE_REVIEW_POLICY,
    instructions: 'An independent human must read each full source passage, enter valid and targetMpId, and identify their review. Leave uncertain cases invalid. Agent-generated labels are not independent review.',
    sourceMethod: extraction.method, sampleIds: extraction.sample.map(candidate => candidate.id),
    labels: extraction.sample.map(candidate => ({ candidateId: candidate.id, speechId: candidate.speechId, passage: candidate.passage, candidateIds: candidate.candidateIds, valid: null, targetMpId: null, reviewer: '', independentHuman: false, note: '' })) };
}
export function evaluateReviewArtifact(extraction, review, { manifestId = null } = {}) {
  if (review.artifactVersion !== 'reference-review-2' || review.manifestId !== manifestId || review.extractionDigest !== referenceExtractionDigest(extraction, { manifestId })) throw new Error('Reference extraction changed; human labels must be reviewed against this exact corpus artifact');
  const required = extraction.sample.map(candidate => candidate.id), supplied = review.sampleIds || [];
  if (required.length !== supplied.length || required.some((id, index) => supplied[index] !== id)) throw new Error('Review sample changed; use the unchanged predeclared extraction sample');
  return evaluateReferences(extraction.candidates, review.labels, { sampleIds: required });
}

async function main() {
  const [command, input, output, labelsPath] = process.argv.slice(2);
  if (!['sample', 'evaluate'].includes(command) || !input || !output || (command === 'evaluate' && !labelsPath)) throw new Error('Usage: node scripts/network-reference-review.mjs sample <references.json> <review.json> | evaluate <references.json> <evaluation.json> <review.json>');
  const raw = JSON.parse(await readFile(input, 'utf8')), extraction = raw.references || raw.data || raw, context = { manifestId: raw.manifestId || null };
  const result = command === 'sample' ? referenceReviewTemplate(extraction, context) : evaluateReviewArtifact(extraction, JSON.parse(await readFile(labelsPath, 'utf8')), context);
  // Exclusive creation protects independently reviewed labels from accidental overwrite.
  await writeFile(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(command === 'sample' ? `Created ${result.labels.length} unreviewed sample records: ${output}` : `${result.publicationGate}: ${result.acceptedLabels} accepted labels; precision ${result.precision ?? 'unavailable'}; lower 95% ${result.lower95 ?? 'unavailable'}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
