import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyLiveDeployment } from '../scripts/check-live-deployment.mjs';

async function fixture(t, contents = { 'index.html': '<!doctype html>new page', 'data/snapshot.json': '{"version":2}' }) {
  const directory = await mkdtemp(join(tmpdir(), 'vahtikissa-live-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const localBase = pathToFileURL(directory + '/');
  for (const [file, text] of Object.entries(contents)) {
    await mkdir(new URL('./', new URL(file, localBase)), { recursive: true });
    await writeFile(new URL(file, localBase), text);
  }
  return { localBase, files: Object.keys(contents), contents };
}

test('live verification preserves hosted project paths and hashes response bytes', async t => {
  const input = await fixture(t, { 'index.html': 'päivitetty 🐈', 'data/snapshot.json': '{"version":2}' });
  const requests = [];
  const result = await verifyLiveDeployment({
    ...input, baseURL: 'https://example.test/project?old=1#section', attempts: 1, log: () => {},
    fetchImpl: async (url, options) => {
      const remote = new URL(url), file = remote.pathname.slice('/project/'.length);
      requests.push({ remote, options });
      assert.equal(remote.protocol, 'https:');
      assert.equal(remote.pathname.startsWith('/project/'), true);
      assert.equal(remote.searchParams.has('__deployment'), true);
      assert.equal(remote.searchParams.has('old'), false);
      assert.equal(remote.hash, '');
      return new Response(input.contents[file]);
    }
  });
  assert.equal(result.matched, true);
  assert.equal(result.attempts, 1);
  assert.equal(requests.length, input.files.length);
  assert.equal(requests.every(request => request.options.cache === 'no-store' && request.options.redirect === 'follow' && request.options.headers['Cache-Control'] === 'no-cache'), true);
});

test('mixed CDN snapshots retry all assets and cannot accumulate partial matches', async t => {
  const input = await fixture(t), calls = new Map(), waits = [];
  const result = await verifyLiveDeployment({
    ...input, baseURL: 'https://example.test/', attempts: 3, delayMs: 7, log: () => {},
    wait: async ms => { waits.push(ms); },
    fetchImpl: async url => {
      const file = new URL(url).pathname.slice(1), round = (calls.get(file) || 0) + 1;
      calls.set(file, round);
      const matched = round === 3 || round === 1 && file === 'index.html' || round === 2 && file !== 'index.html';
      return new Response(matched ? input.contents[file] : 'old asset');
    }
  });
  assert.equal(result.attempts, 3);
  assert.deepEqual([...calls.values()], [3, 3]);
  assert.deepEqual(waits, [7, 7]);
});

test('persistent mismatches fail after the final complete round', async t => {
  const input = await fixture(t), calls = new Map();
  await assert.rejects(verifyLiveDeployment({
    ...input, baseURL: 'https://example.test/', attempts: 2, wait: async () => {}, log: () => {},
    fetchImpl: async url => {
      const file = new URL(url).pathname.slice(1);
      calls.set(file, (calls.get(file) || 0) + 1);
      return new Response(file === 'index.html' ? input.contents[file] : 'old snapshot');
    }
  }), /data\/snapshot\.json \(content differs\)/u);
  assert.deepEqual([...calls.values()], [2, 2]);
});

test('HTTP and network failures never expose response or exception bodies', async t => {
  const input = await fixture(t);
  await assert.rejects(verifyLiveDeployment({
    ...input, baseURL: 'https://example.test/', attempts: 1, log: () => {},
    fetchImpl: async url => {
      if (new URL(url).pathname === '/index.html') return { ok: false, status: 503, arrayBuffer() { throw new Error('PRIVATE RESPONSE BODY'); } };
      throw new Error('PRIVATE NETWORK BODY');
    }
  }), error => {
    assert.match(error.message, /index\.html \(HTTP 503\)/u);
    assert.match(error.message, /data\/snapshot\.json \(request failed\)/u);
    assert.doesNotMatch(error.message, /PRIVATE/u);
    return true;
  });
});

for (const phase of ['fetch', 'body']) test('deadline includes a stalled ' + phase, async t => {
  const input = await fixture(t, { 'index.html': 'new page' });
  let signal;
  await assert.rejects(verifyLiveDeployment({
    ...input, baseURL: 'https://example.test/', attempts: 1, timeoutMs: 10, log: () => {},
    fetchImpl: async (_url, options) => {
      signal = options.signal;
      if (phase === 'fetch') return new Promise(() => {});
      return { ok: true, arrayBuffer: () => new Promise(() => {}) };
    }
  }), /request timed out/u);
  assert.equal(signal.aborted, true);
});

test('verification refuses HTTP URLs and credential-bearing origins before requests', async t => {
  const input = await fixture(t);
  for (const baseURL of ['http://example.test/', 'https://user:password@example.test/']) {
    await assert.rejects(verifyLiveDeployment({
      ...input, baseURL, fetchImpl: () => { throw new Error('must not fetch'); }, log: () => {}
    }), /public HTTPS URL without credentials/u);
  }
});
