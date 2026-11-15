import assert from 'node:assert/strict';
import test from 'node:test';
import { stories, structure } from '../bill-stories/structure.js';
import { frames as fi } from '../bill-stories/content-fi.js';
import { frames as sv } from '../bill-stories/content-sv.js';
import { frames as en } from '../bill-stories/content-en.js';

const frameIDs = stories.flatMap(story => story.frames.map(frame => story.id + '-' + frame));
const hasText = value => typeof value === 'string' && value.trim().length > 0;

test('each published bill story frame has all three translations and its source links', () => {
  assert.deepEqual(Object.keys(structure), frameIDs);
  for (const [lang, frames] of Object.entries({ fi, sv, en })) {
    assert.deepEqual(Object.keys(frames), frameIDs);
    for (const id of frameIDs) {
      const { step, tag, title, lead, chart, more, notes, sources, sourceURLs, terms } = frames[id];
      const urls = structure[id].urls;
      const label = lang + ' ' + id;
      assert.ok([step, tag, title, lead, ...notes, ...more, ...sources].every(hasText), label);
      assert.ok(notes.length && more.length && terms.length, label);
      assert.ok(terms.every(term => term.length === 2 && term.every(hasText)), label);
      assert.equal(sources.length, urls.length, label);
      for (const [index, url] of Object.entries(sourceURLs ?? {})) {
        assert.ok(urls[index] && new URL(url).protocol === 'https:', label);
      }
      assert.ok(urls.every(url => new URL(url).protocol === 'https:'), label);
      const original = en[id].chart;
      assert.deepEqual(Object.keys(chart).sort(), Object.keys(original).sort(), label);
      assert.deepEqual(chart.rows?.map(row => row.length), original.rows?.map(row => row.length), label);
      assert.equal(chart.months?.length, original.months?.length, label);
      assert.ok(Object.values(chart).flat(2).every(value => typeof value === 'string'), label);
    }
  }
});
