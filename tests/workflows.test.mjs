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

test('scheduled writers serialize and deployments read the current main branch', async () => {
  const [parliament,civic,pages] = await Promise.all(['daily-sync.yml','daily-civic-sync.yml','pages.yml'].map(file=>readFile(new URL(`../.github/workflows/${file}`,import.meta.url),'utf8')));
  for (const workflow of [parliament,civic]) {
    assert.match(workflow,/group: daily-data-sync/);
    assert.match(workflow,/fetch-depth: 0/);
    assert.match(workflow,/timeout-minutes: 90/);
  }
  assert.match(civic,/--only=budget --all/);
  assert.match(civic,/--only=elections/);
  assert.match(civic,/--only=influence/);
  assert.equal((civic.match(/continue-on-error: true/g)||[]).length,3);
  assert.match(pages,/ref: main/);
  assert.match(pages,/head_branch == 'main'/);
});
