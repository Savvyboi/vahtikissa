import test from 'node:test';
import assert from 'node:assert/strict';
import { filterItems, percent, routeFromHash, hydrateBallots, pageSlice, choiceLabel, localized, localizedSearchFields, memberMatchesQuery, parliamentMatterUrl, isLongSpeech, filterBallots, voteOutcome, paginationItems, searchSpeeches, voteAlternatives, brandName } from '../app-utils.js';
import { readFile } from 'node:fs/promises';

const source = async file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');


test('vote ballot filters expose one voting choice at a time', () => {
  const ballots = [{ choice: 'yes' }, { choice: 'no' }, { choice: 'yes' }, { choice: 'absent' }];
  assert.deepEqual(filterBallots(ballots, 'yes'), [ballots[0], ballots[2]]);
  assert.equal(filterBallots(ballots, 'all').length, 4);
});

test('paged filtered results retain their active filter', () => {
  const speeches = [{ party: 'kok' }, { party: 'sd' }, { party: 'kok' }];
  const filtered = filterItems(speeches, 'kok', ['party']);
  assert.deepEqual(pageSlice(filtered, 1, 1), [speeches[0]]);
  assert.deepEqual(pageSlice(filtered, 2, 1), [speeches[2]]);
});

test('vote comparison reports counts without inferring an official outcome', () => {
  assert.equal(voteOutcome({ yes: 101, no: 90 }), 'moreYes');
  assert.equal(voteOutcome({ yes: 80, no: 90 }), 'moreNo');
  assert.equal(voteOutcome({ yes: 90, no: 90 }), 'tie');
});


test('filterItems searches Finnish text case-insensitively', () => {
  const items = [{ title: 'Julkisen talouden suunnitelma', party: 'kok' }, { title: 'Kalastuslaki', party: 'kesk' }];
  assert.equal(filterItems(items, 'TALOUDEN').length, 1);
});

test('percent handles an empty denominator safely', () => {
  assert.equal(percent(0, 0), 0);
  assert.equal(percent(1, 4), 25);
});

test('hash parser supports details and defaults to overview', () => {
  assert.deepEqual(routeFromHash('#/members/123'), { page: 'members', id: '123' });
  assert.deepEqual(routeFromHash(''), { page: 'overview', id: null });
});

test('hydrateBallots joins packed ballots with MP names', () => {
  const ballots = [['2026-72-2', '1504', 'kok', 'yes']];
  const members = [{ id: '1504', firstName: 'Pauli', lastName: 'Aalto-Setälä', party: 'kok' }];
  assert.deepEqual(hydrateBallots(ballots, members), [{
    voteId: '2026-72-2', mpId: '1504', party: 'kok', choice: 'yes',
    firstName: 'Pauli', lastName: 'Aalto-Setälä'
  }]);
});

test('hydrateBallots gives a stable fallback for a missing MP record', () => {
  assert.deepEqual(hydrateBallots([['v1', '999', 'sit', 'absent']], []), [{
    voteId: 'v1', mpId: '999', party: 'sit', choice: 'absent',
    firstName: '', lastName: '', id: '999'
  }]);
});

test('pageSlice exposes all items through successive pages', () => {
  const items = Array.from({ length: 55 }, (_, id) => id);
  assert.deepEqual(pageSlice(items, 1, 25), items.slice(0, 25));
  assert.deepEqual(pageSlice(items, 3, 25), items.slice(50));
});

test('choice labels never expose internal English keys', () => {
  assert.equal(choiceLabel('yes', 'fi'), 'jaa');
  assert.equal(choiceLabel('yes', 'sv'), 'ja');
  assert.equal(choiceLabel('absent', 'sv'), 'frånvarande');
});

test('localized selects Swedish fields and falls back to Finnish', () => {
  assert.equal(localized({ fi: 'Laki', sv: 'Lag' }, 'sv'), 'Lag');
  assert.equal(localized({ fi: 'Laki', sv: '' }, 'sv'), 'Laki');
});

test('localized search includes both Finnish and Swedish variants', () => {
  assert.deepEqual(localizedSearchFields(['title', 'document']), ['title', 'titleSv', 'document', 'documentSv']);
});

test('member search matches party codes and localized party names', () => {
  const member = { firstName: 'Ada', lastName: 'Test', party: 'kok' };
  const names = { kok: { fi: 'Kansallinen Kokoomus', sv: 'Samlingspartiet' } };
  assert.equal(memberMatchesQuery(member, 'kokoomus', names), true);
  assert.equal(memberMatchesQuery(member, 'samlingspartiet', names), true);
  assert.equal(memberMatchesQuery(member, 'kok', names), true);
  assert.equal(memberMatchesQuery(member, 'keskusta', names), false);
});

test('Parliament matter links use the current public route', () => {
  assert.equal(parliamentMatterUrl('HE 119/2024 vp'), 'https://www.eduskunta.fi/asiat-ja-aanestykset/valtiopaivaasiat/HE%20119%2F2024%20vp');
  assert.equal(parliamentMatterUrl(''), '');
});

test('only genuinely long speeches need a read-more control', () => {
  assert.equal(isLongSpeech('x'.repeat(601)), true);
  assert.equal(isLongSpeech('x'.repeat(600)), false);
});

test('numbered pagination keeps first, neighbours and last page accessible', () => {
  assert.deepEqual(paginationItems(1, 10), [1, 2, 3, 'ellipsis', 10]);
  assert.deepEqual(paginationItems(5, 10), [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]);
  assert.deepEqual(paginationItems(10, 10), [1, 'ellipsis', 8, 9, 10]);
});

test('speech search includes complete loaded text and metadata', () => {
  const speeches = [
    { id: 'a', firstName: 'Ada', agenda: 'Talous' },
    { id: 'b', firstName: 'Bo', agendaSv: 'Miljö' }
  ];
  assert.deepEqual(searchSpeeches(speeches, 'hemlig fras', { b: 'En hemlig fras i hela anförandet' }), [speeches[1]]);
  assert.deepEqual(searchSpeeches(speeches, 'talous', {}), [speeches[0]]);
});

test('vote alternatives parse exact JA and NEJ choices', () => {
  assert.deepEqual(voteAlternatives('Valiokuntaan lähettäminen: puhemiesneuvoston ehdotus JAA / Suna Kymäläisen ehdotus EI'), {
    yes: 'puhemiesneuvoston ehdotus', no: 'Suna Kymäläisen ehdotus'
  });
  assert.deepEqual(voteAlternatives('Remiss: förslag A JA / förslag B NEJ', 'sv'), { yes: 'förslag A', no: 'förslag B' });
});

test('brand is localized to Vaktkatt in Swedish', () => {
  assert.equal(brandName('fi'), 'Vahtikissa');
  assert.equal(brandName('sv'), 'Vaktkatt');
});

test('app uses a nonmodal search panel and paginates every speech list', async () => {
  const [html, app] = await Promise.all([source('index.html'), source('app.js')]);
  assert.match(html, /class="search-panel"/);
  assert.doesNotMatch(html, /<dialog[^>]*search-dialog/);
  assert.match(app, /speech-search\.json/);
  assert.doesNotMatch(app, /loadAllSpeechTexts/);
  assert.match(app, /pagination\('speeches'/);
  assert.match(app, /pagination\('memberSpeeches'/);
  assert.match(app, /bindSpeechToggles/);
  assert.match(app, /href:href\('speeches',item\.id\)/);
});

test('member speech page resets when navigating to another member', async () => {
  const app = await source('app.js');
  assert.match(
    app,
    /function memberDetail\(m\)\{if\(!m\)return notFound\(\);if\(activeMemberId!==m\.id\)state\.memberSpeeches=1;activeMemberId=m\.id;/
  );
});

test('open-data attribution lives in the footer, not page headers', async () => {
  const [html, app] = await Promise.all([source('index.html'), source('app.js')]);
  assert.match(html, /footer-open-data/);
  assert.doesNotMatch(app, /parliament:'Suomen eduskunta · avoin data'/);
  assert.doesNotMatch(app, /parliament:'Finlands riksdag · öppna data'/);
});
