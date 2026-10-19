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
  assert.equal((civic.match(/continue-on-error: true/g)||[]).length,4);
  assert.match(pages,/ref: main/);
  assert.match(pages,/head_branch == 'main'/);
});

test('AI backfill reserves the daily budget before inference and deploys only changed content',async()=>{
 const ai=await readFile(new URL('../.github/workflows/daily-ai-sync.yml',import.meta.url),'utf8');
 const pages=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 assert.match(ai,/group: daily-data-sync/);assert.match(ai,/AI_CONCURRENCY: '10'/);
 assert.match(ai,/default: '150'/);assert.match(ai,/4,34,49 \* \* \* \*/);
 assert.ok(ai.indexOf('git commit -m "data: reserve daily AI request budget"')<ai.indexOf('name: Generate cached AI insights'));
 assert.match(ai,/AI_BUDGET_RESERVATION:/);assert.match(ai,/steps\.budget\.outputs\.requests != '0'/);
 assert.match(ai,/actions: write/);assert.match(ai,/steps\.commit\.outputs\.content_changed == 'true'/);
 assert.match(ai,/actions\/workflows\/pages.yml\/dispatches/);
 assert.doesNotMatch(pages,/"Daily AI briefs and programme tags"/);
});
