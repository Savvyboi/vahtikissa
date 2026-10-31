import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SITE_NAME, SITE_URL, siteMetadata } from '../seo.js';

const source = path => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('homepage metadata gives every supported language a descriptive title and snippet', () => {
  assert.equal(SITE_URL, 'https://savvyboi.github.io/vahtikissa/');
  assert.equal(SITE_NAME, 'Vahtikissa');
  assert.equal(siteMetadata().title, 'Vahtikissa – eduskunnan äänestykset ja kansanedustajat');
  const locales = { fi: 'fi_FI', sv: 'sv_FI', en: 'en_GB' };
  const descriptions = new Set();
  for (const [language, locale] of Object.entries(locales)) {
    const metadata = siteMetadata(language);
    assert.equal(metadata.locale, locale);
    assert.match(metadata.title, /Vahtikissa|Vaktkatt/);
    assert.ok(metadata.title.length > SITE_NAME.length + 10);
    assert.ok(metadata.description.length > 50);
    assert.doesNotMatch(metadata.description, /undefined|null/);
    descriptions.add(metadata.description);
  }
  assert.equal(descriptions.size, 3, 'Each interface language has its own snippet');
  assert.deepEqual(siteMetadata('unsupported'), siteMetadata('fi'));
});

test('route and detail metadata explain the content being viewed', () => {
  for (const language of ['fi', 'sv', 'en']) {
    const homepage = siteMetadata(language);
    const votes = siteMetadata(language, { page: 'votes' });
    const members = siteMetadata(language, { page: 'members' });
    const member = siteMetadata(language, { page: 'members', id: '123' }, 'Testi Edustaja');
    assert.notEqual(votes.title, homepage.title);
    assert.notEqual(votes.description, homepage.description);
    assert.notEqual(members.description, votes.description);
    assert.match(member.title, /Testi Edustaja/);
    assert.match(member.description, /Testi Edustaja/);
    assert.doesNotMatch(siteMetadata(language, { page: 'missing' }).title, /undefined|null/);
    assert.equal(member.locale, homepage.locale);
  }
});

test('initial HTML has a substantive homepage, synchronized social tags and structured data', async () => {
  const html = await source('index.html');
  assert.match(html, /<title>Vahtikissa – eduskunnan äänestykset ja kansanedustajat<\/title>/);
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1];
  assert.ok(main, 'Homepage content is delivered in the HTTP response');
  assert.match(main, /class="[^"]*site-introduction/);
  assert.match(main, /<h1\b[^>]*>[^<]+<\/h1>/);
  assert.match(main, /<h2\b/);
  assert.match(main, /href="https:\/\/api\.eduskunta\.fi\//);
  assert.doesNotMatch(main, /<noscript\b/);
  for (const key of ['og:title', 'og:description', 'og:locale', 'og:url', 'og:image', 'twitter:title', 'twitter:description', 'twitter:image']) {
    assert.equal((html.match(new RegExp(`(?:name|property)="${key}"`, 'g')) || []).length, 1, key + ' appears once');
  }
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.match(html, new RegExp(`<link[^>]*rel="canonical"[^>]*href="${SITE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  const script = html.match(/<script\b(?=[^>]*id="site-structured-data")(?=[^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(script, 'Structured data is present before JavaScript runs');
  const structured = JSON.parse(script[1]);
  assert.equal(structured['@context'], 'https://schema.org');
  const graph = structured['@graph'] || [structured];
  for (const type of ['WebSite', 'WebApplication']) {
    const item = graph.find(item => item['@type'] === type || Array.isArray(item['@type']) && item['@type'].includes(type));
    assert.ok(item, type + ' describes the service');
    assert.equal(item.url, SITE_URL);
    assert.equal(item.name, SITE_NAME);
  }
});

test('sitemap lists real canonical pages and crawler discovery does not block site assets', async () => {
  const [sitemap, robots] = await Promise.all([source('sitemap.xml'), source('robots.txt')]);
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  assert.deepEqual(urls, [SITE_URL]);
  assert.ok(urls.every(url => !new URL(url).hash && !new URL(url).search));
  assert.match(sitemap, /http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9/);
  assert.match(robots, /User-agent:\s*\*/i);
  assert.match(robots, /Sitemap:\s*https:\/\/savvyboi\.github\.io\/vahtikissa\/sitemap\.xml/i);
  assert.doesNotMatch(robots, /^Disallow:\s*\/(?:\s*$|(?:assets|data|.*\.js)(?:\/|\s*$))/im);
});

test('cat favicon raster dimensions and ICO frames match browser declarations', async () => {
  const pngs = new Map();
  for (const [filename, size] of [
    ['favicon-16x16.png', 16], ['favicon-32x32.png', 32], ['favicon-48x48.png', 48],
    ['favicon-96x96.png', 96], ['apple-touch-icon.png', 180]
  ]) {
    const bytes = await readFile(new URL('../' + filename, import.meta.url));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], filename + ' is PNG');
    assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
    assert.equal(bytes.readUInt32BE(16), size, filename + ' width');
    assert.equal(bytes.readUInt32BE(20), size, filename + ' height');
    pngs.set(size, bytes);
  }
  const ico = await readFile(new URL('../favicon.ico', import.meta.url));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1, 'The file is an icon');
  assert.equal(ico.readUInt16LE(4), 3, 'The icon has three size variants');
  const dimensions = [];
  for (let frame = 0; frame < 3; frame++) {
    const entry = 6 + frame * 16;
    const width = ico[entry] || 256, height = ico[entry + 1] || 256;
    dimensions.push(width);
    assert.equal(width, height);
    const length = ico.readUInt32LE(entry + 8), offset = ico.readUInt32LE(entry + 12);
    assert.ok(offset >= 54 && offset + length <= ico.length, 'The frame points to a complete image');
    assert.deepEqual(ico.subarray(offset, offset + length), pngs.get(width), width + 'px ICO frame matches the cat favicon PNG');
  }
  assert.deepEqual(dimensions.sort((a, b) => a - b), [16, 32, 48]);
});
