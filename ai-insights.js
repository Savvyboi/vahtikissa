// Shared public schema. API secrets and generation stay in scripts/.
export const AI_SCHEMA_VERSION = 1;
export const AI_LANGUAGES = ['fi', 'sv', 'en'];
export const DEFAULT_AI_MODEL = 'google/gemma-4-31b-it:free';

export function recordSource(kind, item) {
  const keys = kind === 'votes'
    ? ['id', 'title', 'titleSv', 'question', 'questionSv', 'detail', 'detailSv', 'stage', 'stageSv', 'document', 'date', 'yes', 'no', 'abstain', 'absent', 'resultUrl', 'documentUrl']
    : ['id', 'title', 'titleSv', 'document', 'documentSv', 'firstDate', 'latestDate', 'stages', 'stagesSv', 'decision', 'decisionSv', 'url'];
  return Object.fromEntries(keys.map(key => [key, item[key] ?? null]));
}
// A deterministic cache signature, not a security or authentication primitive.
export function sourceFingerprint(kind, item) {
  const value = JSON.stringify(recordSource(kind, item));
  let a = 2166136261, b = 5381;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ value.charCodeAt(i);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
export function sameSource(kind, item, source) {
  return JSON.stringify(recordSource(kind, item)) === JSON.stringify(source);
}
export function emptyInsights() {
  return { version: AI_SCHEMA_VERSION, generatedAt: null, model: null, programmes: {}, records: { votes: {}, legislation: {} } };
}
export function insightTags(index) {
  const tags = new Map();
  for (const programme of Object.values(index.programmes || {})) for (const tag of programme.tags || []) {
    if (!tags.has(tag.id)) tags.set(tag.id, { ...tag, references: [] });
    tags.get(tag.id).references.push({ programmeId: programme.id, party: programme.party, title: programme.title, year: programme.year, url: programme.url, quote: tag.quote, promise: tag.promise });
  }
  return [...tags.values()].sort((a, b) => a.id.localeCompare(b.id));
}
export function currentInsight(index, kind, item) {
  const entry = index.records?.[kind]?.[item.id];
  return entry && entry.fingerprint === sourceFingerprint(kind, item) ? entry : null;
}
export function matchesAITags(entry, selected, followed = []) {
  if (!selected || selected === 'all') return true;
  const ids = entry?.tags || [];
  return selected === 'followed' ? ids.some(id => followed.includes(id)) : ids.includes(selected);
}
export function validateTranslations(value, maxLength = 1800) {
  if (!value || typeof value !== 'object') throw new Error('Missing translations');
  for (const language of AI_LANGUAGES) if (typeof value[language] !== 'string' || !value[language].trim() || value[language].length > maxLength) throw new Error('Invalid ' + language + ' translation');
  return Object.fromEntries(AI_LANGUAGES.map(language => [language, value[language].trim()]));
}
export function validateRecordResult(value, allowedTags) {
  const brief = validateTranslations(value?.brief);
  for (const [language, text] of Object.entries(brief)) {
    if (text.split(/\s+/u).length > 100) throw new Error("AI brief exceeds 100 words in " + language);
    if (/[{}]/u.test(text) || /(?:^|\s)(?:tags?|evidence(?:Ids)?|svensk sammanfattning|english summary)\s*[:=]/iu.test(text)) throw new Error("AI brief contains internal fields or language headings in " + language);
  }
  if (!Array.isArray(value.tags) || value.tags.length > 12 || value.tags.some(id => typeof id !== 'string' || !allowedTags.has(id))) throw new Error('Unknown or invalid AI tag');
  return { brief, tags: [...new Set(value.tags)] };
}
