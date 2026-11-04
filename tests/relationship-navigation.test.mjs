import test from 'node:test';
import assert from 'node:assert/strict';
import { relationshipNavigation } from '../relationship-navigation.js';

test('network and analysis navigation keep both destinations and mark only the active page in every language', () => {
  for (const lang of ['fi', 'sv', 'en']) {
    for (const active of ['map', 'analysis']) {
      const html = relationshipNavigation(lang, active);
      assert.equal((html.match(/<a /gu) || []).length, 2);
      assert.equal((html.match(/aria-current="page"/gu) || []).length, 1);
      const destination = active === 'map' ? '#/relationships' : '#/relationships?feature=vote-neighbours';
      assert.ok(html.includes(`href="${destination}" aria-current="page"`));
      assert.ok(!html.includes('↗'), 'Same-app navigation does not suggest an external destination');
    }
  }
});
