import { escapeHTML as e, choiceLabel } from './app-utils.js';
import { browserNote, storageFailure } from './following-controls.js';
import { insightTags } from './ai-insights.js';
import { followingStore, followingSnapshots } from './following-store.js';
import { loadFollowingData, clearFollowingDataCache } from './following-data.js';

const L = (lang, fi, sv, en) => lang === 'sv' ? sv : lang === 'en' ? en : fi;
const name = member => `${member.firstName || ''} ${member.lastName || ''}`.trim() || String(member.id);
const localized = (value, lang) => value?.[lang] || value?.fi || '';
const date = (value, lang) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(lang === 'en' ? 'en-GB' : lang === 'sv' ? 'sv-FI' : 'fi-FI') : '—';
const sourceDate = (value, lang) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? new Date(value + 'T12:00:00Z').toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'sv' ? 'sv-FI' : 'fi-FI') : Number.isFinite(Date.parse(value)) ? date(value, lang) : value || '—';
let includeInfluence = false;

function importError(code, lang) {
  if (code === 'unknown-ids') return L(lang, 'Tiedosto sisältää tuntemattomia edustajia tai teemoja. Valintoja ei muutettu. Teematietojen latausvirhe voi myös estää tuonnin.', 'Filen innehåller okända ledamöter eller teman. Valen ändrades inte. Fel vid laddning av teman kan också hindra import.', 'The file contains unknown MPs or themes. Selections were not changed. A theme data loading failure can also prevent import.');
  if (code === 'storage') return storageFailure(lang);
  return L(lang, 'Tuonti epäonnistui: virheellinen, liian suuri tai yhteensopimaton JSON-tiedosto. Valintoja ei muutettu.', 'Importen misslyckades: ogiltig, för stor eller inkompatibel JSON-fil. Valen ändrades inte.', 'Import failed: invalid, oversized or incompatible JSON file. Selections were not changed.');
}

export async function renderFollowing(root, { data, lang, view, parliamentLoader, aiIndex, refresh, current = () => true }) {
  const ui = (fi, sv, en) => L(lang, fi, sv, en);
  const selections = followingStore.selections(), tags = aiIndex ? insightTags(aiIndex) : [];
  const memberMap = new Map(data.members.map(item => [String(item.id), item]));
  const tagMap = new Map(tags.map(item => [item.id, item]));
  root.innerHTML = `<div class="${view === 'simple' ? 'easy-page' : 'page'} following-page">
    <header class="${view === 'simple' ? 'easy-hero' : 'page-head'}"><div><p class="eyebrow">${ui('Oma selain', 'Min webbläsare', 'This browser')}</p><h1>${ui('Seuratut', 'Följer', 'Following')}</h1><p class="lead">${ui('Edustajat, ohjelmateemat ja niihin liittyvät tietueet.', 'Ledamöter, programteman och tillhörande poster.', 'MPs, programme themes and their related records.')}</p></div></header>
    <p>${browserNote(lang)}</p><p data-follow-status role="status">${followingStore.status().error ? storageFailure(lang) : ''}</p>
    <section class="following-selections" aria-labelledby="following-members"><h2 id="following-members">${ui('Edustajat', 'Ledamöter', 'MPs')} (${selections.members.length})</h2>
      ${selections.members.length ? `<ul>${selections.members.map(id => `<li>${memberMap.has(id) ? `<a href="#/members/${encodeURIComponent(id)}">${e(name(memberMap.get(id)))}</a>` : `<span>${ui('Edustajaa ei löydy nykyisestä aineistosta', 'Ledamoten finns inte i det aktuella materialet', 'MP unavailable in the current dataset')} (${e(id)})</span>`}<button type="button" data-follow-remove-member="${e(id)}" aria-label="${e(ui('Poista seurannasta: ', 'Sluta följa: ', 'Unfollow: ') + (memberMap.has(id) ? name(memberMap.get(id)) : id))}">${ui('Poista', 'Ta bort', 'Remove')}</button></li>`).join('')}</ul>` : `<p>${ui('Et vielä seuraa edustajia.', 'Du följer ännu inga ledamöter.', 'You are not following any MPs yet.')}</p>`}<p><a href="#/members">${ui('Etsi edustaja', 'Hitta en ledamot', 'Find an MP')} →</a></p>
    </section>
    <section class="following-selections" aria-labelledby="following-themes"><h2 id="following-themes">${ui('Ohjelmateemat', 'Programteman', 'Programme themes')} (${selections.tags.length})</h2>
      ${selections.tags.length ? `<ul>${selections.tags.map(id => `<li><div>${e(tagMap.has(id) ? localized(tagMap.get(id).label, lang) : ui('Teema ei ole saatavilla', 'Temat är inte tillgängligt', 'Theme unavailable') + ' (' + id + ')')}${tagMap.has(id) ? `<div class="following-actions"><a href="#/votes?tag=${encodeURIComponent(id)}">${ui('Äänestykset', 'Omröstningar', 'Votes')}</a><a href="#/legislation?tag=${encodeURIComponent(id)}">${ui('Ehdotukset', 'Förslag', 'Proposals')}</a>${[...new Map(tagMap.get(id).references.map(ref => [ref.programmeId, ref])).values()].map(ref => `<a href="#/programmes?party=${encodeURIComponent(ref.party)}">${e(ref.party.toUpperCase())} · ${ui('Ohjelma', 'Program', 'Programme')}</a>`).join('')}</div>` : ''}</div><button type="button" data-follow-remove-tag="${e(id)}" aria-label="${e(ui('Poista teema: ', 'Ta bort temat: ', 'Remove theme: ') + (tagMap.has(id) ? localized(tagMap.get(id).label, lang) : id))}">${ui('Poista', 'Ta bort', 'Remove')}</button></li>`).join('')}</ul>` : `<p>${ui('Et vielä seuraa ohjelmateemoja.', 'Du följer ännu inga programteman.', 'You are not following any programme themes yet.')}</p>`}
      <p><a href="#/votes?tag=followed">${ui('Valitse seurattavat teemat', 'Välj teman att följa', 'Choose themes to follow')} →</a></p>
      <p class="following-note">${ui('Teemat kattavat vain jo analysoidut ja nykyiseen lähdetietueeseen täsmäävät AI-tunnisteet. AI voi erehtyä. Yhteinen teema ei osoita puolueen tukea tai lupauksen toteutumista.', 'Teman omfattar endast redan analyserade AI-taggar som motsvarar den aktuella källposten. AI kan göra fel. Ett gemensamt tema visar inte partiets stöd eller att ett löfte uppfyllts.', 'Themes cover only already analysed AI tags matching the current source record. AI can make mistakes. A shared theme does not establish party support or fulfilment of a promise.')}</p>
    </section>
    <details class="following-transfer"><summary>${ui('Siirrä tai poista valinnat', 'Flytta eller ta bort val', 'Transfer or remove selections')}</summary><p>${ui('Vienti sisältää vain edustaja- ja teematunnukset. Havaintohistoriaa tai muita selainasetuksia ei viedä. Tuonti korvaa nykyiset valinnat onnistuneen tarkistuksen jälkeen (enintään 64 kt).', 'Exporten innehåller bara ledamot- och tema-ID:n. Observationshistorik och andra webbläsarinställningar exporteras inte. Import ersätter nuvarande val efter godkänd kontroll (högst 64 kB).', 'Export contains only MP and theme IDs. Observation history and other browser preferences are excluded. Import replaces current selections after validation (maximum 64 KB).')}</p><div class="following-actions"><button type="button" data-follow-export>${ui('Vie valinnat (.json)', 'Exportera val (.json)', 'Export selections (.json)')}</button><button type="button" data-follow-clear>${ui('Poista kaikki valinnat', 'Ta bort alla val', 'Remove all selections')}</button></div><label class="following-import">${ui('Tuo valinnat JSON-tiedostosta', 'Importera val från JSON-fil', 'Import selections from JSON file')}<input type="file" accept=".json,application/json" data-follow-import></label></details>
    <section class="following-feed" aria-labelledby="following-records"><h2 id="following-records">${ui('Seurannan tietueet', 'Poster för dina val', 'Records for your selections')}</h2>
      <p>${ui('Uusi havainto = tietuetunnus, jota tässä selaimessa ei ollut havaittu tästä lähteestä ennen nykyistä käyntiä. Vertailu käyttää Seuratut-näkymän aiempia onnistuneita latauksia. Ensimmäinen lataus luo vertailupohjan. Merkinnät säilyvät tämän sivustokäynnin ajan, myös kieltä tai näkymää vaihdettaessa.', 'Ny observation = ett post-ID som denna webbläsare inte hade observerat i källan före detta besök. Jämförelsen använder tidigare lyckade laddningar i vyn Följer. Första laddningen skapar jämförelsebasen. Markeringarna finns kvar under detta webbplatsbesök, även vid byte av språk eller vy.', 'Newly observed = a record ID this browser had not observed in this source before this visit. The comparison uses previous successful loads in Following. The first load establishes a baseline. Indicators remain for this website visit, including language and reading mode changes.')}</p>
      <details><summary>${ui('Vertailun rajat ja päivitykset', 'Jämförelsens gränser och uppdateringar', 'Comparison limits and updates')}</summary><p>${ui('Lähteet verrataan erikseen. Epäonnistunut tai puutteellinen lataus ei siirrä vertailupohjaa. Aiemmin nähdyn tietueen tekstimuutos tai paluu aineistoon ei ole uusi tietue. Myös vanhalle päivälle jälkikäteen lisätty tietue voi olla uusi havainto. Havaintoaika on selaimen latausaika, ei julkaisupäivä. Merkinnät eivät ole lukukuittauksia; seuraava sivun uudelleenlataus aloittaa uuden käynnin.', 'Källor jämförs var för sig. Misslyckad eller ofullständig laddning flyttar inte basen. Textändringar eller återkomst av en redan sedd post räknas inte som nya poster. En post som lagts till i efterhand med äldre datum kan vara en ny observation. Observationstiden är webbläsarens laddningstid, inte publiceringstid. Markeringar är inga läskvitton; nästa sidomladdning börjar ett nytt besök.', 'Sources are compared separately. Failed or incomplete loads do not advance the baseline. Text changes or reappearance of an already seen record do not count as new records. A backfilled record with an older date may be newly observed. Observation time is the browser load time, not publication time. Indicators are not read receipts; reloading the page starts a new visit.')}</p></details>
      <div class="following-actions"><button type="button" data-follow-refresh>${ui('Tarkista uusin tilannekuva', 'Kontrollera senaste ögonblicksbild', 'Check latest snapshot')}</button>${selections.members.length && !includeInfluence ? `<button type="button" data-follow-influence>${ui('Lataa myös lahjat ja lobbaus (noin 9 Mt)', 'Ladda också gåvor och lobbning (cirka 9 MB)', 'Also load gifts and lobbying (about 9 MB)')}</button>` : ''}</div>
      <p class="following-note">${ui('Koostetut lähdetilannekuvat eivät ole täydellinen reaaliaikainen virta. Sama tietue voi näkyä usean seurannan alla. Edustajan ääni voi olla myös poissaolomerkintä. Lahjat ja lobbaus ladataan erikseen; puuttuva tietue ei todista tapahtumien puuttumista.', 'Sammanställda ögonblicksbilder är ingen fullständig realtidsström. Samma post kan visas under flera val. En ledamots röst kan också vara en frånvaromarkering. Gåvor och lobbning laddas separat; avsaknad av poster bevisar inte att inget inträffat.', 'Compiled source snapshots are not a complete real-time feed. The same record may appear under several selections. An MP’s voting record can include an absence. Gifts and lobbying load separately; missing records do not prove that no activity occurred.')} <a href="#/influence">${ui('Tutki sidonnaisuuslähteitä', 'Utforska bindningskällor', 'Explore interests sources')} →</a></p>
      <p data-follow-summary role="status">${ui('Ladataan valittujen lähteiden tietoja…', 'Laddar valda källor…', 'Loading selected sources…')}</p><div data-follow-sources aria-busy="true"></div>
    </section></div>`;
  const status = root.querySelector('[data-follow-status]');
  const rerender = (focusSelector, message) => {
    const pending = renderFollowing(root, { data, lang, view, parliamentLoader, aiIndex, refresh, current });
    if (message) root.querySelector('[data-follow-status]').textContent = message;
    if (['[data-follow-import]', '[data-follow-clear]'].includes(focusSelector)) root.querySelector('.following-transfer').open = true;
    root.querySelector(focusSelector)?.focus({ preventScroll: true });
    // Status and focus are set immediately. Older source loads cannot later steal focus.
    return pending;
  };
  const change = async (operation, focusSelector) => {
    const result = operation();
    if (!result.ok) { status.textContent = storageFailure(lang); return; }
    await rerender(focusSelector, ui('Valinnat tallennettu tähän selaimeen.', 'Valen sparades i denna webbläsare.', 'Selections saved in this browser.'));
  };
  root.querySelectorAll('[data-follow-remove-member]').forEach(button => { button.onclick = () => change(() => followingStore.toggleMember(button.dataset.followRemoveMember), '#following-members'); });
  root.querySelectorAll('[data-follow-remove-tag]').forEach(button => { button.onclick = () => change(() => followingStore.toggleTag(button.dataset.followRemoveTag), '#following-themes'); });
  root.querySelectorAll('#following-members,#following-themes').forEach(heading => { heading.tabIndex = -1; });
  root.querySelector('[data-follow-clear]').onclick = () => change(() => followingStore.clear(), '[data-follow-clear]');
  root.querySelector('[data-follow-export]').onclick = () => {
    try {
      const blob = new Blob([followingStore.exportJSON()], { type: 'application/json;charset=utf-8' }), url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = 'vahtikissa-following.json'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 0);
      status.textContent = ui('Valintatiedosto luotu.', 'Valfilen skapades.', 'Selection file created.');
    } catch { status.textContent = ui('Vienti epäonnistui.', 'Exporten misslyckades.', 'Export failed.'); }
  };
  root.querySelector('[data-follow-import]').onchange = async event => {
    const file = event.target.files?.[0]; if (!file) return;
    const input = event.currentTarget, importPage = root.firstElementChild;
    try {
      if (file.size > 65536) { status.textContent = importError('oversize', lang); return; }
      const text = await file.text();
      if (!current() || !input.isConnected || root.firstElementChild !== importPage) return;
      const result = followingStore.importJSON(text, { memberIds: new Set(memberMap.keys()), tagIds: new Set(tagMap.keys()) });
      if (!current() || !status.isConnected) return;
      if (!result.ok) { status.textContent = importError(result.code, lang); return; }
      await rerender('[data-follow-import]', ui('Valinnat tuotu ja tallennettu tähän selaimeen.', 'Valen importerades och sparades i denna webbläsare.', 'Selections imported and saved in this browser.'));
    } catch { if (status.isConnected) status.textContent = importError('invalid', lang); }
  };
  root.querySelector('[data-follow-refresh]').onclick = async event => {
    const button = event.currentTarget; button.disabled = true;
    clearFollowingDataCache();
    await refresh();
    // A later selection/import interaction owns its focus even if this load finishes last.
    if ([document.body, root, button].includes(document.activeElement)) root.querySelector('[data-follow-refresh]')?.focus({ preventScroll: true });
  };
  root.querySelector('[data-follow-influence]')?.addEventListener('click', () => { includeInfluence = true; rerender('[data-follow-refresh]'); });

  const holder = root.querySelector('[data-follow-sources]'), summary = root.querySelector('[data-follow-summary]');
  const sources = await loadFollowingData({ parliamentLoader, core: data, members: selections.members, themes: selections.tags, aiIndex, includeInfluence });
  if (!current() || !holder.isConnected) return;
  let totalNew = 0, unavailable = 0;
  const kindLabel = kind => ({ votes: ui('Äänestykset', 'Omröstningar', 'Votes'), speeches: ui('Puheet', 'Anföranden', 'Speeches'), legislation: ui('Ehdotukset', 'Förslag', 'Proposals'), gifts: ui('Lahjat', 'Gåvor', 'Gifts'), lobbying: ui('Lobbaus', 'Lobbning', 'Lobbying') }[kind] || kind);
  holder.innerHTML = '';
  for (const source of sources) {
    const section = document.createElement('section'); section.className = 'following-source'; section.dataset.followSource = source.key;
    const owner = source.memberId ? memberMap.has(source.memberId) ? name(memberMap.get(source.memberId)) : source.memberId : localized(tagMap.get(source.themeId)?.label, lang) || source.themeId;
    section.innerHTML = `<h3>${e(owner)} · ${e(kindLabel(source.kind))}</h3>`;
    if (!source.complete) {
      unavailable++;
      section.innerHTML += `<p>${ui('Lähde ei ole saatavilla tai lataus jäi puutteelliseksi. Vertailupohjaa ei muutettu. Yritä tarkistaa tilannekuva uudelleen.', 'Källan är inte tillgänglig eller laddningen var ofullständig. Basen ändrades inte. Försök kontrollera ögonblicksbilden igen.', 'Source unavailable or incomplete. The baseline was not changed. Try checking the snapshot again.')}</p>`;
      holder.append(section); continue;
    }
    const observation = followingSnapshots.observe(source.key, { ids: source.records.map(item => item.id), snapshot: source.snapshot, complete: true });
    const newIds = observation.newIds || new Set(); totalNew += newIds.size;
    section.innerHTML += `<p class="following-note">${ui('Lähteen tilannekuva', 'Källans ögonblicksbild', 'Source snapshot')}: ${e(date(source.generatedAt, lang))} · ${source.records.length} ${ui('tietuetta', 'poster', 'records')}<br>${observation.previousObservedAt ? ui('Vertailupohja ladattu tässä selaimessa', 'Jämförelsebas laddad i denna webbläsare', 'Baseline loaded in this browser') + ': ' + e(date(observation.previousObservedAt, lang)) : ui('Ensimmäinen onnistunut lataus muodostaa vertailupohjan.', 'Första lyckade laddningen skapar jämförelsebasen.', 'The first successful load establishes the baseline.')}</p>`;
    if (source.aiGeneratedAt) section.innerHTML += `<p class="following-note">${ui('AI-tunnisteiden tilannekuva', 'Ögonblicksbild för AI-taggar', 'AI tag snapshot')}: ${e(date(source.aiGeneratedAt, lang))}</p>`;
    if (!observation.ok || observation.saved === false) section.innerHTML += `<p>${ui('Havaintojen tallennus epäonnistui. Seuraavan käynnin vertailu voi puuttua tai käyttää vanhempaa pohjaa.', 'Observationerna kunde inte sparas. Nästa besök kan sakna jämförelse eller använda en äldre bas.', 'Observations could not be saved. The next visit may lack a comparison or use an older baseline.')}</p>`;
    if (source.coverage === 'unique-name') section.innerHTML += `<p class="following-note">${ui('Lobbausyhteys perustuu yksikäsitteiseen nimiosumaan nykyisessä edustajaluettelossa. Ilmoituksen aikaväli ei ole yhteydenoton tarkka päivä. Ilmoitus ei osoita vaikutusta päätöksiin.', 'Lobbykopplingen bygger på en entydig namnträff i den aktuella ledamotslistan. Anmälningsperioden är inte kontaktens exakta datum. Anmälan visar inte påverkan på beslut.', 'Lobbying is linked by a unique name match in the current MP list. The reporting period is not the exact contact date. A disclosure does not establish influence over decisions.')}</p>`;
    const sorted = [...source.records].sort((a, b) => Number(newIds.has(b.id)) - Number(newIds.has(a.id)) || String(b.date || '').localeCompare(String(a.date || '')) || a.id.localeCompare(b.id));
    let visible = 10;
    const list = document.createElement('ol'); list.className = 'following-records';
    const recordDates = item => {
      if (item.kind === 'lobbying') return `${ui('Ilmoitettu', 'Anmält', 'Reported')}: ${e(sourceDate(item.reported, lang))}${item.period ? `<br>${ui('Ilmoituskausi', 'Rapporteringsperiod', 'Reporting period')}: ${e(sourceDate(item.period.start, lang))} – ${e(sourceDate(item.period.end, lang))}` : ''}`;
      if (item.kind === 'gifts') return `${ui('Lahja ilmoitettu', 'Gåvan anmäld', 'Gift disclosed')}: ${e(item.reported || '—')}${item.used ? `<br>${ui('Ilmoitettu käyttöaika', 'Anmäld användningstid', 'Declared use date')}: ${e(item.used)}` : ''}`;
      return `${ui('Lähteen päivä', 'Källans datum', 'Source date')}: ${e(sourceDate(item.date, lang))}`;
    };
    const draw = () => {
      list.innerHTML = sorted.slice(0, visible).map(item => `<li>${newIds.has(item.id) ? `<span class="following-new" data-follow-new>${ui('Uusi havainto', 'Ny observation', 'Newly observed')}</span><span class="following-note"> ${ui('Havaittu tässä selaimessa', 'Observerad i denna webbläsare', 'Observed in this browser')}: ${e(date(observation.firstObserved?.get(item.id) || observation.observedAt, lang))}</span>` : ''}<h4><a href="${e(item.href)}">${e(lang === 'sv' && item.titleSv || item.title || item.id)}</a></h4><p class="following-note">${recordDates(item)}</p>${item.choice ? `<p>${ui('Edustajan merkintä', 'Ledamotens registrerade röst', 'MP’s recorded vote')}: <strong>${e(choiceLabel(item.choice, lang))}</strong></p>` : ''}${item.url && /^https?:\/\//i.test(item.url) ? `<a href="${e(item.url)}" target="_blank" rel="noreferrer">${ui('Alkuperäinen lähde', 'Originalkälla', 'Original source')} ↗</a>` : ''}</li>`).join('');
    };
    if (sorted.length) { draw(); section.append(list); }
    else section.insertAdjacentHTML('beforeend', `<p>${ui('Ei tähän valintaan yhdistettyjä tietueita tässä aineistossa.', 'Inga poster kopplade till detta val i materialet.', 'No records linked to this selection in this dataset.')}</p>`);
    if (sorted.length > visible) {
      const more = document.createElement('button'); more.type = 'button'; more.textContent = ui('Näytä lisää tietueita', 'Visa fler poster', 'Show more records');
      more.onclick = () => { const previous = visible; visible += 20; draw(); if (visible >= sorted.length) more.hidden = true; list.children[previous]?.querySelector('a')?.focus({ preventScroll: true }); };
      section.append(more);
    }
    holder.append(section);
  }
  holder.setAttribute('aria-busy', 'false');
  summary.textContent = sources.length ? `${totalNew} ${ui('uutta havaintoa', 'nya observationer', 'newly observed records')}${unavailable ? ' · ' + unavailable + ' ' + ui('lähdettä ei saatavilla', 'källor otillgängliga', 'sources unavailable') : ''}.` : ui('Valitse edustajia tai teemoja nähdäksesi niihin liittyviä tietueita.', 'Välj ledamöter eller teman för att se tillhörande poster.', 'Choose MPs or themes to see their related records.');
}
