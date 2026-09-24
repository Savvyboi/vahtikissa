import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the Parliament dataset sync runs every day and remains manually runnable', async () => {
  const workflow = await readFile(new URL('../.github/workflows/daily-sync.yml', import.meta.url), 'utf8');
  assert.match(workflow, /schedule:\s*\n\s*- cron: ['"]\d+ \d+ \* \* \*['"]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /run: npm run sync/);
  assert.match(workflow, /run: npm run validate-data/);
  assert.match(workflow, /git add data\//);
});
