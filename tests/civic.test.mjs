import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { filterBudgetItems, filterElectionCandidates, filterInfluence, jsonStatRows, parseCSVLine, parseGiftDisclosure } from '../civic-utils.js';

const source = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('budget CSV parser preserves quoted commas and escaped quotes', () => {
  assert.deepEqual(parseCSVLine('"31.","Liikenne, viestintä","Hän sanoi ""hei""",12.50'), ['31.', 'Liikenne, viestintä', 'Hän sanoi "hei"', '12.50']);
});

test('gift disclosures expose donor, description, value and dates', () => {
  const gift = parseGiftDisclosure('Ilmoitettu: 06.07.2025. Antaja: Turun kaupunki. Kuvaus: Ruisrock VIP-liput, 678,00 euroa. Käyttöaika: 05.07.2025. ');
  assert.equal(gift.reported, '06.07.2025');
  assert.equal(gift.donor, 'Turun kaupunki');
  assert.equal(gift.description, 'Ruisrock VIP-liput');
  assert.equal(gift.amount, 678);
  assert.equal(gift.used, '05.07.2025');
});

test('JSON-stat2 cells expand in the declared dimension order', () => {
  const rows = jsonStatRows({
    id: ['party', 'metric'], size: [2, 2], value: [10, 20, 30, 40],
    dimension: {
      party: { category: { index: { a: 0, b: 1 }, label: { a: 'A', b: 'B' } } },
      metric: { category: { index: ['votes', 'share'], label: { votes: 'Votes', share: 'Share' } } }
    }
  });
  assert.deepEqual(rows.map(row => [row.party, row.metric, row.value]), [['a','votes',10],['a','share',20],['b','votes',30],['b','share',40]]);
});

test('civic filters search bilingual labels and combine structured filters', () => {
  const budgets = [{ code:'29', name:{ fi:'Opetus- ja kulttuuriministeriö', sv:'Undervisnings- och kulturministeriet' } }];
  assert.equal(filterBudgetItems(budgets, 'undervisnings').length, 1);
  const candidates = [{ name:'Test Ada', partyCode:'03', districtCode:'010000', party:{fi:'KOK',sv:'SAML'}, district:{fi:'Helsinki',sv:'Helsingfors'} }];
  assert.equal(filterElectionCandidates(candidates, { query:'helsingfors', party:'03', district:'010000' }).length, 1);
  const contacts = [{ actor:'Testiyhtiö', periodYear:2025, targetKinds:['mp'], topic:'Liikenne', targets:[{fi:{name:'Ada Edustaja'},sv:{name:'Ada Ledamot'}}] }];
  assert.equal(filterInfluence(contacts, { query:'ledamot', year:'2025', kind:'mp' }).length, 1);
});

test('the three civic applications are separate bilingual menu items', async () => {
  const [html, app] = await Promise.all([source('index.html'), source('app.js')]);
  for (const page of ['budget', 'elections', 'influence']) assert.match(html, new RegExp(`data-page="${page}"`));
  assert.match(app, /budget:'Budjetti'/);
  assert.match(app, /budget:'Budget'/);
  assert.match(app, /influence:'Lahjat ja lobbaus'/);
  assert.match(app, /influence:'Gåvor och lobbning'/);
  assert.match(app, /renderBudget\(root,lang,r\.id,e\)/);
  assert.match(app, /renderElections\(root,lang,e\)/);
  assert.match(app, /renderInfluence\(root,lang,e\)/);
});

test('civic snapshots refresh weekly and deploy through Pages', async () => {
  const [workflow, pages] = await Promise.all([source('.github/workflows/weekly-civic-sync.yml'), source('.github/workflows/pages.yml')]);
  assert.match(workflow, /cron: ['"]\d+ \d+ \* \* \d['"]/);
  assert.match(workflow, /npm run sync:civic/);
  assert.match(workflow, /data\/budget\.json data\/elections-2023\.json data\/influence\.json/);
  assert.match(pages, /Weekly budget, election and influence data sync/);
});
