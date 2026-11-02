// Independent comparison with downloaded official responses, never the graph
// builder's own parsing helpers. Raw responses stay in an ignored review folder.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const folder = resolve(process.argv.find(arg => arg.startsWith('--source-dir='))?.split('=').slice(1).join('=') || '.hermes-tmp.transparency-review');
const read = async path => JSON.parse(await readFile(path, 'utf8'));
const influence = await read('data/influence.json'), parliament = await read('data/parliament.json'), profiles = await read('data/member-profiles.json');
const manifest = await read('data/networks/transparency.json'), evidence = await read(`data/networks/${manifest.evidenceFile}`);
const clean = value => String(value ?? '').normalize('NFC').replace(/\s+/gu, ' ').trim();
const unique = items => [...new Set(items)].sort();
const capture = (text, start, end) => text.split(start)[1]?.split(end)[0]?.trim() || '';
const source = 'https://public.api.avoimuusrekisteri.fi';
if (process.argv.includes('--fetch')) {
  await mkdir(folder, { recursive: true });
  const fetchJSON = async (name, url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
    assert.ok(response.ok, `${url}: HTTP ${response.status}`);
    const body = await response.text(); JSON.parse(body);
    await writeFile(resolve(folder, `${name}.json`), body);
    return JSON.parse(body);
  };
  const terms = await fetchJSON('terms', `${source}/open-data-term`);
  await fetchJSON('targets', `${source}/open-data-target/targets`);
  // Includes explicit boards, municipal roles, a multi-organisation narrative,
  // gifts with decimals and use dates different from their disclosure dates.
  const ids = process.argv.includes('--all') ? parliament.members.map(member => String(member.id)) : ['1306', '1412', '960', '1137', '1202', '913', '1131', '301'];
  const queue = [...ids];
  await Promise.all(Array.from({ length: 4 }, async () => { while (queue.length) { const id = queue.shift(); await fetchJSON(`member-${id}`, `https://api.eduskunta.fi/api/v1/kansanedustajat/${id}`); } }));
  const closed = terms.filter(term => term.status === 'closed').sort((a, b) => b.reportingEndDate.localeCompare(a.reportingEndDate));
  for (const term of process.argv.includes('--all') ? closed : closed.slice(0, 1)) await fetchJSON(`term-${term.id}`, `${source}/open-data-activity-notification/term/${term.id}`);
}
const files = await readdir(folder), counts = { profiles: 0, interests: 0, gifts: 0, lobbying: 0, targetReferences: 0 };
for (const file of files.filter(name => /^member-\d+\.json$/u.test(name))) {
  const member = await read(resolve(folder, file)), id = String(member.henkilonro);
  assert.equal(id, file.match(/\d+/u)[0], `${file}: exact requested member ID`);
  const stored = profiles.members[id], identity = parliament.members.find(row => String(row.id) === id);
  assert.ok(stored && identity, `${id}: stored member`);
  assert.equal(stored.status, member.edustajantoimenTila, `${id}: current/former/interrupted status`);
  const party = member.viimeisinEduskuntaryhma.tunnus.split('~')[0].replace(/\d+$/u, '').toLocaleLowerCase('fi');
  assert.equal(identity.party, party === 'pg' ? 'tv' : party, `${id}: snapshot parliamentary group (PG is the source code for Timo Vornanen)`);
  assert.equal(`${identity.firstName} ${identity.lastName}`, `${clean(member.kutsumanimi || member.etunimet)} ${clean(member.sukunimi)}`, `${id}: exact identity`);
  assert.deepEqual(stored.committees.map(row => [row.id, row.from, row.to, row.role.fi]), member.valiokuntajasenyydet.map(row => [row.valiokuntaTunnus, clean(row.alkupvm), clean(row.loppupvm), row.rooli.fi]), `${id}: membership intervals and roles`);
  assert.deepEqual(stored.government.fi.map(row => [row.name, row.from, row.to]), member.valtioneuvostonJasenyydet.fi.map(row => [clean(row.nimi), clean(row.alkupvm), clean(row.loppupvm)]), `${id}: ministerial intervals`);
  const declaredGifts = member.sidonnaisuudet.fi.filter(row => row.ilmoitusTyyppi === 'lahjailmoitus').map(row => `${id}-${row.vuosi}-${row.jarjestys}`).sort();
  const declaredInterests = member.sidonnaisuudet.fi.filter(row => ['sidonnaisuusilmoitus', 'tuloilmoitus'].includes(row.ilmoitusTyyppi)).map(row => `${id}-${row.vuosi}-${row.ilmoitusTyyppi}-${row.jarjestys}`).sort();
  assert.deepEqual(influence.gifts.filter(row => row.mpId === id).map(row => row.id).sort(), declaredGifts, `${id}: gift inclusion and omission coverage`);
  assert.deepEqual(influence.interests.filter(row => row.mpId === id).map(row => row.id).sort(), declaredInterests, `${id}: interest/income inclusion and omission coverage`);
  for (const declaration of member.sidonnaisuudet.fi) {
    if (declaration.ilmoitusTyyppi === 'lahjailmoitus') {
      const key = `${id}-${declaration.vuosi}-${declaration.jarjestys}`, gift = evidence.records[`lahja:${key}`];
      assert.ok(gift, `${key}: omitted gift`);
      assert.equal(gift.year, Number(declaration.vuosi));
      assert.equal(gift.mpId, id); assert.equal(gift.raw.fi, declaration.sidonta.trim(), `${key}: original gift text`);
      const text = declaration.sidonta, amount = /,\s*([\d\s]+,\d\d)\s+euroa\.\s*Käyttöaika:/u.exec(text)?.[1];
      assert.equal(gift.amount, amount ? Number(amount.replace(/\s/gu, '').replace(',', '.')) : null, `${key}: euro amount`);
      assert.equal(gift.reported, capture(text, 'Ilmoitettu:', '. Antaja:'), `${key}: disclosure date`);
      assert.equal(gift.donor, capture(text, 'Antaja:', '. Kuvaus:'), `${key}: donor`);
      assert.equal(gift.used, text.split('Käyttöaika:').at(-1)?.split('. Luovutettu')[0]?.trim().replace(/\.$/u, '') || '', `${key}: use period`);
      counts.gifts++;
    } else if (['sidonnaisuusilmoitus', 'tuloilmoitus'].includes(declaration.ilmoitusTyyppi)) {
      const key = `${id}-${declaration.vuosi}-${declaration.ilmoitusTyyppi}-${declaration.jarjestys}`;
      const row = influence.interests.find(row => row.id === key);
      assert.ok(row, `${key}: omitted interest/income record`);
      assert.equal(row.year, Number(declaration.vuosi));
      assert.equal(row.mpId, id); assert.equal(clean(row.description), clean(declaration.sidonta), `${key}: role text`);
      assert.equal(row.category, clean(declaration.ryhmaotsikko)); counts.interests++;
    }
  }
  counts.profiles++;
}
const targets = new Map((await read(resolve(folder, 'targets.json'))).map(target => [target.id, target]));
const localTargets = new Map(influence.targets.map(target => [target.id, target]));
for (const file of files.filter(name => /^term-\d+\.json$/u.test(name))) {
  const notifications = await read(resolve(folder, file));
  const expected = new Set(), periods = new Set();
  for (const notification of notifications) {
    const period = { start: notification.term.reportingStartDate.slice(0, 10), end: notification.term.reportingEndDate.slice(0, 10) };
    periods.add(`${period.start}/${period.end}`);
    assert.equal(notification.term.status, 'closed', `${file}: only closed periods`);
    for (const topic of notification.topics) {
      const contacts = topic.contactedTargets.filter(contact => {
        const target = targets.get(contact.contactedTargetId)?.fi;
        return target && /eduskun|kansanedustaja/iu.test([target.organization, target.department, target.unit, target.title].join(' '));
      });
      if (!contacts.length) continue;
      const key = `${notification.id}-${topic.id}`, row = influence.lobbying.find(row => row.id === key);
      expected.add(key); assert.ok(row, `${key}: omitted parliamentary topic`);
      assert.equal(row.actor, clean(notification.companyName)); assert.equal(row.companyId, clean(notification.companyId || notification.otherCompanyId));
      assert.equal(row.diaryNumber, notification.diaryNumber); assert.equal(row.notificationId, notification.id);
      assert.equal(row.customer, clean(topic.customerCompanyName)); assert.deepEqual(row.period, period);
      assert.equal(row.reported, notification.activityNotificationDate);
      assert.equal(clean(row.topic), [topic.contactTopicOther, topic.contactTopicProject?.fi, topic.contactTopicProject?.title, topic.title].map(clean).find(Boolean) || '');
      assert.deepEqual(unique(row.targetIds), unique(contacts.map(contact => contact.contactedTargetId)), `${key}: exact target IDs`);
      assert.deepEqual(unique(row.methods), unique(contacts.flatMap(contact => contact.contactMethods)), `${key}: topic methods`);
      for (const contact of contacts) {
        const original = targets.get(contact.contactedTargetId), stored = localTargets.get(original.id);
        assert.ok(stored, `${key}: stored target ${original.id}`);
        for (const language of ['fi', 'sv']) for (const field of ['name', 'title', 'unit', 'department', 'organization']) assert.equal(stored[language][field], clean(original[language][field]).replace(/^-$/u, ''), `${key}: target ${original.id}/${language}/${field}`);
        counts.targetReferences++;
      }
      counts.lobbying++;
    }
  }
  const actual = influence.lobbying.filter(row => periods.has(`${row.period.start}/${row.period.end}`)).map(row => row.id);
  assert.deepEqual(actual.sort(), [...expected].sort(), `${file}: source inclusion and omission reconciliation`);
}
assert.ok(counts.profiles && counts.lobbying, 'Download representative primary sources with --fetch first.');
console.log(`Independent official-source comparison passed: ${JSON.stringify(counts)}. Downloaded source fields and stored coverage agree; this does not authenticate the declared claims or manually resolve every automatic role/name interpretation.`);
