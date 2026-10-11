import test from 'node:test';
import assert from 'node:assert/strict';
import { readingMode, readingModeURL } from '../reading-mode.js';

test('shared view URLs take precedence over a remembered reading mode', () => {
  assert.equal(readingMode('?view=full', 'simple'), 'full');
  assert.equal(readingMode('?view=simple', 'full'), 'simple');
  assert.equal(readingMode('', 'simple'), 'simple');
  assert.equal(readingMode('?view=unknown', 'simple'), 'simple');
  assert.equal(readingMode('', 'invalid'), 'full');
});

test('switching reading mode preserves the page, detail, and unrelated URL parameters', () => {
  const url = readingModeURL('https://example.org/vahtikissa/?campaign=test#/votes/2026-94-5', 'simple');
  assert.equal(url.pathname, '/vahtikissa/');
  assert.equal(url.hash, '#/votes/2026-94-5');
  assert.equal(url.searchParams.get('campaign'), 'test');
  assert.equal(url.searchParams.get('view'), 'simple');
  assert.equal(readingModeURL(url, 'full').searchParams.get('view'), 'full');
});