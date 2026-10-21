import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const DEPLOYMENT_FILES = Object.freeze([
  'index.html',
  'app.js',
  'styles.css',
  'app-utils.js',
  'parliament-data.js',
  'budget-utils.js',
  'budget-app.js',
  'civic-apps.js',
  'speech-research-app.js',
  'data/parliament/core.json',
  'data/budget.json',
  'data/elections-2023.json',
  'data/influence.json',
  'data/programmes.json',
  'data/ai-insights.json'
]);

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function remoteDigest(url, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error('Deployment asset request timed out');
      error.name = 'TimeoutError';
      reject(error);
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([deadline, (async () => {
      const response = await fetchImpl(url, { signal: controller.signal, cache: 'no-store', redirect: 'follow', headers: { 'Cache-Control': 'no-cache' } });
      if (!response.ok) return { reason: 'HTTP ' + Number(response.status) };
      const hash = createHash('sha256');
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            hash.update(value);
          }
        } finally { reader.releaseLock(); }
      } else {
        hash.update(new Uint8Array(await response.arrayBuffer()));
      }
      return { digest: hash.digest('hex') };
    })()]);
  } catch (error) {
    return { reason: error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'request timed out' : 'request failed' };
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyLiveDeployment({
  baseURL,
  localBase = new URL('../', import.meta.url),
  files = DEPLOYMENT_FILES,
  fetchImpl = globalThis.fetch,
  wait = pause,
  attempts = 6,
  delayMs = 10000,
  timeoutMs = 15000,
  concurrency = 4,
  log = console.log
} = {}) {
  const site = new URL(baseURL);
  if (site.protocol !== 'https:' || site.username || site.password) throw new Error('SITE_URL must be a public HTTPS URL without credentials');
  site.search = '';
  site.hash = '';
  if (!site.pathname.endsWith('/')) site.pathname += '/';
  const local = new URL(localBase);
  if (local.protocol !== 'file:') throw new Error('The deployment asset base must be a local file URL');
  if (!local.pathname.endsWith('/')) local.pathname += '/';
  if (!Array.isArray(files) || !files.length || files.some(file => typeof file !== 'string' || !file || /[\\?#:]/u.test(file) || file.startsWith('/') || file.split('/').some(part => part === '..' || part === '.'))) throw new Error('Deployment assets must be relative file paths');
  if (new Set(files).size !== files.length) throw new Error('Deployment asset paths must be unique');
  if (!Number.isInteger(attempts) || attempts < 1 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8 || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(delayMs) || delayMs < 0) throw new Error('Invalid deployment verification retry settings');
  if (typeof fetchImpl !== 'function' || typeof wait !== 'function') throw new Error('Deployment verification needs fetch and wait functions');
  const expected = new Map();
  for (const file of files) expected.set(file, createHash('sha256').update(await readFile(new URL(file, local))).digest('hex'));
  const token = Date.now().toString(36);
  let unmatched = [];
  for (let round = 1; round <= attempts; round++) {
    const results = new Array(files.length);
    let next = 0;
    // Recheck every asset each round so separate partial snapshots cannot combine into success.
    await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, async () => {
      while (next < files.length) {
        const index = next++, file = files[index], url = new URL(file, site);
        url.searchParams.set('__deployment', expected.get(file) + '-' + token + '-' + round);
        const result = await remoteDigest(url, fetchImpl, timeoutMs);
        results[index] = { file, matched: result.digest === expected.get(file), reason: result.reason || 'content differs' };
      }
    }));
    unmatched = results.filter(result => !result.matched);
    log('Live assets: ' + (files.length - unmatched.length) + '/' + files.length + ' match (attempt ' + round + '/' + attempts + ').');
    if (!unmatched.length) {
      log('Live deployment verified: ' + files.join(', ') + '.');
      return { matched: true, attempts: round, files: [...files] };
    }
    if (round < attempts) await wait(delayMs);
  }
  throw new Error('Live deployment did not match uploaded files after ' + attempts + ' attempts: ' + unmatched.map(result => result.file + ' (' + result.reason + ')').join(', '));
}

const modulePath = decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/(?=[A-Za-z]:\/)/u, '');
if (process.argv[1]?.replaceAll('\\', '/') === modulePath) {
  verifyLiveDeployment({ baseURL: process.env.SITE_URL || 'https://vahtikissa.fi/' })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
