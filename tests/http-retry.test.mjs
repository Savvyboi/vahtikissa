import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelayMs } from '../scripts/http-retry.mjs';
import { createParliamentRequest } from '../scripts/sync-data.mjs';

test('rate-limit retries wait for a quota window and honor both Retry-After formats', () => {
  const now = Date.parse('2026-10-20T16:00:00Z');
  const response = (status, header) => new Response('', { status, headers: header ? { 'retry-after': header } : {} });
  assert.equal(retryDelayMs(response(429), 1, now), 60_000);
  assert.equal(retryDelayMs(response(429, 'invalid'), 1, now), 60_000);
  assert.equal(retryDelayMs(response(429, '0'), 1, now), 60_000);
  assert.equal(retryDelayMs(response(429, '120'), 1, now), 120_000);
  assert.equal(retryDelayMs(response(429, 'Tue, 20 Oct 2026 16:02:00 GMT'), 1, now), 120_000);
  assert.equal(retryDelayMs(response(503, '30'), 1, now), 30_000);
  assert.equal(retryDelayMs(response(503), 3, now), 2800);
});

test('Parliament requests recover after a 429 without rapid repeated requests', async () => {
  const waits = [], calls = [];
  const responses = [new Response('', { status: 429 }), Response.json({ status: 'COMPLETED' })];
  const request = createParliamentRequest({
    api: 'https://example.test/api',
    fetcher: async url => { calls.push(url); return responses.shift(); },
    wait: async ms => { waits.push(ms); }
  });
  assert.deepEqual(await request('/search/dataset/status/test'), { status: 'COMPLETED' });
  assert.deepEqual(waits, [60_000]);
  assert.deepEqual(calls, ['https://example.test/api/search/dataset/status/test', 'https://example.test/api/search/dataset/status/test']);
});

test('Parliament retries stay bounded and non-retryable errors stop immediately', async () => {
  for (const [status, attempts, expectedWaits] of [[429, 3, [60_000, 60_000]], [404, 1, []]]) {
    let calls = 0;
    const waits = [];
    const request = createParliamentRequest({
      fetcher: async () => { calls++; return new Response('source unavailable', { status }); },
      wait: async ms => { waits.push(ms); }
    });
    await assert.rejects(request('/test', {}, 3), new RegExp('^Error: ' + status + ' /test: source unavailable$'));
    assert.equal(calls, attempts);
    assert.deepEqual(waits, expectedWaits);
  }
});
