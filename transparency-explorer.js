import { escapeHTML as e } from './app-utils.js';
import { activeFilterCount, collectionState, mountCollectionTools, applyCollection, facetOptions } from './collection-tools.js';
import { defaultTransparencyActorLimit, unpackTransparencyGraph, filterTransparencyGraph, selectTransparencyView, shortestTransparencyPath, transparencyFocusEdges } from './transparency-model.js';
import { relationshipNavigation } from './relationship-navigation.js';
import { transparencyPickerMarkup, mountTransparencyPicker } from './transparency-picker.js';

let snapshotPromise;
const evidenceCache = new Map();
const presetIconPaths = {
  backbone: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="3" r="2"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="19" r="2"/><path d="M12 5v4m-2.3 5L5.5 17.5m8.8-3.5 4.2 3.5"/>',
  dual: '<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>',
  brokers: '<path d="M2 18h20M4 18v-7m16 7v-7M4 14c3 0 5-2 8-6 3 4 5 6 8 6M8 18v-5m8 5v-5"/>',
  interlocks: '<path d="M3 9h18L12 3 3 9Zm2 4h14M6 13v6m6-6v6m6-6v6M3 21h18"/>',
  bills: '<path d="M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h6m-6 4h6"/>'
};

function presetIcon(key) {
  return `<svg class="sna-preset-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${presetIconPaths[key]}</svg>`;
}
async function verifiedJSON(path, expected) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(path, { signal: controller.signal, cache: 'no-cache' });
    if (!response.ok) throw Error(`Snapshot unavailable (${response.status})`);
    const text = await response.text();
    if (expected && globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      if ([...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('') !== expected) throw Error('Snapshot integrity mismatch');
    }
    return JSON.parse(text);
  } finally { clearTimeout(timeout); }
}
async function loadSnapshot() {
  if (!snapshotPromise) snapshotPromise = (async () => {
    const manifest = await verifiedJSON('./data/networks/transparency.json');
    if (!/^[a-f0-9]{24}$/u.test(manifest.id) || manifest.graphFile !== `transparency-${manifest.id}/graph.json` || manifest.evidenceFile !== `transparency-${manifest.id}/evidence.json`) throw Error('Invalid snapshot manifest');
    if (![manifest.graphSha256, manifest.evidenceSha256].every(hash => /^[a-f0-9]{64}$/u.test(hash))) throw Error('Invalid snapshot integrity metadata');
    const graph = unpackTransparencyGraph(await verifiedJSON(`./data/networks/${manifest.graphFile}`, manifest.graphSha256));
    if (graph.snapshotId !== manifest.id) throw Error('Snapshot version mismatch');
    return { manifest, graph };
  })().catch(error => { snapshotPromise = null; throw error; });
  return snapshotPromise;
}
function evidenceFor(manifest) {
  if (!evidenceCache.has(manifest.id)) evidenceCache.set(manifest.id, verifiedJSON(`./data/networks/${manifest.evidenceFile}`, manifest.evidenceSha256).then(data => {
    if (data.snapshotId !== manifest.id) throw Error('Evidence version mismatch'); return data;
  }).catch(error => { evidenceCache.delete(manifest.id); throw error; }));
  return evidenceCache.get(manifest.id);
}
const safeURL = value => /^https?:\/\//u.test(String(value)) ? String(value) : '';

export async function renderTransparencyExplorer(root, { lang = 'fi', view = 'full', current = () => true } = {}) {
  const tr = (fi, sv, en) => lang === 'sv' ? sv : lang === 'en' ? en : fi;
  const number = (value, digits = 0) => Number(value).toLocaleString(lang === 'en' ? 'en-GB' : `${lang}-FI`, { maximumFractionDigits: digits });
  root.innerHTML = `<div class="page sna-page">${relationshipNavigation(lang, 'map')}<span class="eyebrow">${tr('Politiikan läpinäkyvyys', 'Politisk transparens', 'Political transparency')}</span><h1>${tr('Verkostokartta', 'Nätverkskartan', 'Network explorer')}</h1><p role="status">${tr('Ladataan esilaskettua verkostoa…', 'Laddar det förberäknade nätverket…', 'Loading the precomputed network…')}</p></div>`;
  let snapshot;
  try { snapshot = await loadSnapshot(); } catch (error) {
    if (current()) {
      root.innerHTML = `<div class="page sna-page">${relationshipNavigation(lang, 'map')}<h1>${tr('Verkosto ei ole saatavilla', 'Nätverket är inte tillgängligt', 'Network unavailable')}</h1><p role="alert">${tr('Aineistoa ei voitu ladata. Tarkista verkkoyhteys ja yritä uudelleen.', 'Materialet kunde inte laddas. Kontrollera anslutningen och försök igen.', 'The data could not be loaded. Check your connection and try again.')}</p><button type="button" class="sna-open-canvas" data-sna-retry>${tr('Yritä uudelleen', 'Försök igen', 'Try again')}</button> <a href="#/relationships?feature=vote-neighbours">${tr('Avaa muut verkostoanalyysit', 'Öppna andra nätverksanalyser', 'Open other network analyses')} →</a></div>`;
      root.querySelector('[data-sna-retry]').onclick = () => renderTransparencyExplorer(root, { lang, view, current });
    }
    return;
  }
  if (!current()) return;
  const { manifest, graph } = snapshot, nodeMap = new Map([...graph.nodes, ...graph.bills, ...(graph.committees || [])].map(node => [node.id, node]));
  const params = new URLSearchParams(location.hash.split('?')[1] || ''), state = collectionState('weight', 'desc');
  const presetNames = {
    backbone: [tr('Verkoston selkäranka', 'Nätverkets ryggrad', 'Network backbone'), tr('Vahvimmat yhteydet', 'Starkaste relationerna', 'Strongest ties')],
    dual: [tr('Kaksoisroolit', 'Dubbla roller', 'Overlapping roles'), tr('Lobbaus + sidonnaisuus tai lahja', 'Lobbying + bindning eller gåva', 'Lobbying + interest or gift')],
    brokers: [tr('Sillanrakentajat', 'Brobyggare', 'Network brokers'), tr('Keskeiset edustajat ja organisaatiot', 'Centrala ledamöter och organisationer', 'Key MPs and organisations')],
    interlocks: [tr('Yhteiset pöydät', 'Gemensamma bord', 'Shared boards'), tr('Hallitus ↔ oppositio', 'Regering ↔ opposition', 'Government ↔ opposition')],
    bills: [tr('Lobbaus lakihankkeittain', 'Lobbying per lagförslag', 'Lobbying by bill'), tr('Organisaatio → edustaja → HE', 'Organisation → ledamot → RP', 'Organisation → MP → bill')]
  };
  const layerLabel = key => key === 'membership' ? tr('Valiokuntajäsenyys', 'Utskottsmedlemskap', 'Committee membership') : ({ sidonnaisuus: tr('Sidonnaisuus', 'Bindning', 'Interest'), lobbaus: tr('Lobbaus', 'Lobbying', 'Lobbying'), lahja: tr('Lahja', 'Gåva', 'Gift'), multiplex: tr('Kaksoisrooli / Multiplex', 'Flera relationslager', 'Multiple layers'), interlock: tr('Yhteinen hallintotehtävä', 'Gemensamt styrelseuppdrag', 'Shared board'), bill: tr('HE mainittu ilmoituksessa', 'RP nämnd i anmälan', 'Bill named in disclosure') }[key] || key);
  const categoryLabel = key => ({ 'Työmarkkinajärjestöt': tr('Työmarkkinajärjestöt', 'Arbetsmarknadsorganisationer', 'Labour market organisations'), 'Konsultit & Vaikuttajaviestintä': tr('Konsultit & Vaikuttajaviestintä', 'Konsulter & påverkanskommunikation', 'Consultants & public affairs'), 'Julkisyhteisöt & Valtionyhtiöt': tr('Julkisyhteisöt & Valtionyhtiöt', 'Offentliga organ & statsbolag', 'Public bodies & state companies'), 'Järjestöt & Säätiöt': tr('Järjestöt & Säätiöt', 'Föreningar & stiftelser', 'Associations & foundations'), 'Elinkeinoelämä & Yhtiöt': tr('Elinkeinoelämä & Yhtiöt', 'Näringsliv & företag', 'Business & companies') }[key] || key);
  const typeLabel = node => node.type === 'mp' ? node.party.toUpperCase() : node.type === 'bill' ? tr('Lakiasia', 'Lagärende', 'Bill') : node.type === 'committee' ? tr('Valiokunta', 'Utskott', 'Committee') : categoryLabel(node.category);
  const weightMax = Math.ceil(graph.edges.reduce((max, edge) => Math.max(max, edge.weight), 1));
  state.query = (params.get('q') || '').slice(0, 200);
  state.minWeight = Math.max(0, Math.min(weightMax, Math.round((Number(params.get('min')) || 0) * 2) / 2));
  let inferredPreference = params.get('inferred') === '0' ? false : params.get('inferred') === '1' ? true : null;
  if (params.get('sort') === 'name') state.sort = 'name';
  if (params.get('direction') === 'asc') state.direction = 'asc';
  const actorId = (type, ...values) => values.find(id => nodeMap.get(id)?.type === type) || null;
  const legacy = params.get('ego');
  const focus = {
    mp: actorId('mp', `mp:${params.get('mp')}`, legacy),
    org: actorId('org', params.get('org'), legacy)
  };
  const focusIds = () => [focus.mp, focus.org].filter(Boolean);
  const parseActorLimit = value => /^\d+$/u.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= 2 ? Number(value) : null;
  let customActorLimit = parseActorLimit(params.get('actors'));
  let showAllActors = params.get('actors') === 'all';
  const actorLimit = () => showAllActors ? 'all' : customActorLimit;
  const defaultInferred = () => !focus.mp && !focus.org;
  state.inferred = inferredPreference ?? defaultInferred();
  let preset = !focusIds().length && Object.hasOwn(presetNames, params.get('preset')) ? params.get('preset') : 'backbone';
  let layout = ['force', 'columns', 'rings'].includes(params.get('layout')) ? params.get('layout') : 'force';
  let metric = ['degree', 'betweenness', 'pagerank'].includes(params.get('size')) ? params.get('size') : 'degree';
  const facetDefinitions = [
    { key: 'year', label: tr('Vuosi / ilmoituskausi', 'År / rapporteringsperiod', 'Year / reporting period'), options: [...new Set(['2023', '2024', '2025', '2026', ...graph.edges.flatMap(edge => edge.periods)])].sort().reverse().map(key => ({ key, label: key })) },
    { key: 'layer', label: tr('Suhdetyyppi', 'Relationstyp', 'Relationship type'), options: ['sidonnaisuus', 'lobbaus', 'lahja', 'multiplex'].map(key => ({ key, label: layerLabel(key) })) },
    { key: 'party', label: tr('Eduskuntaryhmä', 'Riksdagsgrupp', 'Parliamentary group'), options: facetOptions(graph.nodes.filter(node => node.type === 'mp'), node => node.party, key => key.toUpperCase(), lang) },
    { key: 'bloc', label: tr('Hallitus–oppositio', 'Regering–opposition', 'Government–opposition'), options: [{ key: 'government', label: tr('Hallitus', 'Regering', 'Government') }, { key: 'opposition', label: tr('Oppositio', 'Opposition', 'Opposition') }] },
    { key: 'committee', label: tr('Valiokunta', 'Utskott', 'Committee'), options: facetOptions(graph.nodes, node => node.committees || [], key => key.toUpperCase(), lang) },
    { key: 'category', label: tr('Toimijakategoria', 'Aktörskategori', 'Organisation category'), options: facetOptions(graph.nodes.filter(node => node.type === 'org'), node => node.category, categoryLabel, lang) }
  ];
  try { const saved = JSON.parse(params.get('facets') || '{}'); for (const facet of facetDefinitions) if (saved[facet.key]) state.facets[facet.key] = Object.fromEntries(['include', 'exclude'].map(mode => [mode, Array.isArray(saved[facet.key][mode]) ? saved[facet.key][mode].filter(value => facet.options.some(option => option.key === value)).slice(0, 80) : []])); } catch { /* Invalid optional URL filters do not block reading. */ }
  const expanded = new Set(), pruned = new Set();
  let filtered = [], display = { nodes: [], edges: [], eligible: [] }, canvas = null, canvasPromise = null, selected = null, selectedKind = null, selectedRevision = 0, activePath = null, hulls = 'none', page = 1, listMode = view === 'simple' || matchMedia('(max-width: 760px)').matches ? 'cards' : 'table';
  const mobile = matchMedia('(max-width: 760px)');
  let canvasOpen = !!focusIds().length || view !== 'simple' && !mobile.matches;
  let candidateIds = '', candidates = graph.edges, lastFilter = '', pathOptions = new Map();
  const allDual = graph.edges.filter(edge => edge.isDualRole).length;
  const pickerMarkup = [
    transparencyPickerMarkup({ type: 'mp', label: tr('Kansanedustaja', 'Riksdagsledamot', 'MP'), placeholder: tr('Hae nimellä', 'Sök på namn', 'Search by name'), clearLabel: tr('Tyhjennä edustajavalinta', 'Rensa ledamotsval', 'Clear MP selection') }),
    transparencyPickerMarkup({ type: 'org', label: tr('Organisaatio', 'Organisation', 'Organisation'), placeholder: tr('Nimi tai Y-tunnus', 'Namn eller FO-nr', 'Name or ID'), clearLabel: tr('Tyhjennä organisaatiovalinta', 'Rensa organisationsval', 'Clear organisation selection') })
  ].join('');
  root.innerHTML = `<div class="page sna-page" data-sna-page>
    ${relationshipNavigation(lang, 'map')}
    <section class="sna-presets-section" aria-labelledby="sna-presets-heading"><div class="sna-section-label"><h2 id="sna-presets-heading">${tr('Pikavalinnat / Ilmiökartat', 'Snabbval / Fenomenkartor', 'Quick views / Explore a pattern')}</h2><span>${tr('Valitse näkökulma', 'Välj ett perspektiv', 'Choose a lens')}</span></div><div class="sna-presets" role="group" aria-labelledby="sna-presets-heading">${Object.entries(presetNames).map(([key, [name, hint]]) => `<button type="button" data-sna-preset="${key}" aria-pressed="${preset === key}">${presetIcon(key)}<span><strong>${e(name)}</strong><small>${e(hint)}</small></span></button>`).join('')}</div></section>
    <div class="sna-actor-pickers">${pickerMarkup}</div>
    <p class="sna-focus-help">${tr('Yksi valinta näyttää toimijan yhteydet, kaksi niiden välisen yhteyden.', 'Ett val visar aktörens relationer, två visar relationen mellan dem.', 'One selection shows an actor’s ties. Two show the tie between them.')}</p>
    <details class="sna-filters"><summary>${tr('Sisällytä / Sulje pois', 'Inkludera / Uteslut', 'Include / Exclude')}<span data-sna-filter-count></span></summary><div data-sna-filters></div><label class="sna-inferred"><input type="checkbox" data-sna-inferred ${state.inferred ? 'checked' : ''}>${tr('Näytä myös valiokuntajohdannaiset', 'Visa även härledda utskottskopplingar', 'Include inferred committee links')}</label></details>
    <section class="sna-map-panel" aria-labelledby="sna-map-heading">
      <header class="sna-map-heading"><div><span class="eyebrow">${tr('Eduskunta × Avoimuusrekisteri', 'Riksdagen × Öppenhetsregistret', 'Parliament × Transparency Register')}</span><h1 id="sna-map-heading">${tr('Politiikan verkostokartta', 'Politikens nätverkskarta', 'Political network map')}</h1><p data-sna-status role="status" aria-live="polite" aria-atomic="true"></p></div><div class="sna-map-meta"><p class="sna-snapshot">${tr('Aineistopäivä', 'Datadatum', 'Snapshot')} <time datetime="${e(graph.asOf)}">${e(graph.asOf)}</time></p>
        <button type="button" class="sna-open-canvas" data-sna-open aria-expanded="${canvasOpen}" aria-controls="sna-stage">${tr('Avaa kartta', 'Öppna kartan', 'Open map')}</button></div></header>
      <div class="sna-no-results" data-sna-no-results hidden><p data-sna-empty-message></p><button type="button" data-sna-reset-filters>${tr('Tyhjennä rajaukset', 'Rensa filter', 'Clear filters')}</button><button type="button" data-sna-include-inferred>${tr('Näytä valiokuntajohdannaiset', 'Visa härledda utskottskopplingar', 'Show inferred committee links')}</button></div>
      <div class="sna-stage" id="sna-stage" data-sna-stage ${canvasOpen ? '' : 'hidden'}>
      <div class="sna-actor-limit">
        <label>${tr('Toimijoita enintään', 'Högst antal aktörer', 'Maximum actors')} <input type="number" min="2" step="1" inputmode="numeric" data-sna-actor-limit></label>
        <label><input type="checkbox" data-sna-all-actors> ${tr('Näytä kaikki', 'Visa alla', 'Show all')}</label>
        <p data-sna-actor-count role="status"></p>
      </div>
      <details class="sna-map-tools"${mobile.matches || focusIds().length ? '' : ' open'}><summary>${tr('Kartan asetukset ja työkalut', 'Kartinställningar och verktyg', 'Map settings and tools')}</summary>
      <div class="sna-toolbar"><label>${tr('Asettelu', 'Layout', 'Layout')}<select data-sna-layout><option value="force">${tr('Voimakenttä', 'Kraftfält', 'Clustered force')}</option><option value="columns">${tr('Kerrosnäkymä', 'Kolumner', 'Bipartite columns')}</option><option value="rings">${tr('Kehänäkymä', 'Koncentriska ringar', 'Centrality rings')}</option></select></label><label>${tr('Solmun koko', 'Nodstorlek', 'Node size')}<select data-sna-metric><option value="degree">${tr('Yhteyksien määrä', 'Antal förbindelser', 'Degree')}</option><option value="betweenness">${tr('Sillanrakentaja', 'Mellanliggande position', 'Betweenness')}</option><option value="pagerank">${tr('Keskeisyys (PageRank)', 'Nätverkscentralitet (PageRank)', 'Network prominence (PageRank)')}</option></select></label><label>${tr('Ryhmäalueet', 'Gruppområden', 'Group outlines')}<select data-sna-hull><option value="none">${tr('Ei alueita', 'Inga områden', 'None')}</option><option value="party">${tr('Eduskuntaryhmät', 'Riksdagsgrupper', 'Parties')}</option><option value="committee">${tr('Valiokunnat', 'Utskott', 'Committees')}</option></select></label><div class="sna-map-actions"><button type="button" data-sna-fit title="${tr('Sovita kartta (F)', 'Anpassa kartan (F)', 'Fit map (F)')}">⤢ <span>${tr('Sovita', 'Anpassa', 'Fit')}</span></button><button type="button" data-sna-fullscreen>${tr('Koko näyttö', 'Helskärm', 'Fullscreen')} ↗</button><label class="sna-export-label">${tr('Vie kartta', 'Exportera', 'Export')}<select data-sna-export aria-label="${tr('Vie nykyinen kartta', 'Exportera aktuell karta', 'Export current map')}"><option value="">${tr('Lataa…', 'Ladda ner…', 'Download…')}</option><option value="png">PNG</option><option value="svg">SVG</option><option value="json">JSON</option></select></label></div></div>
      <div class="sna-explore-controls"><label class="sna-weight">${tr('Yhteyden vahvuusraja', 'Minsta relationsvikt', 'Minimum tie strength')} <output data-sna-weight-value>${number(state.minWeight, 1)}</output><input type="range" data-sna-weight min="0" max="${weightMax}" step="0.5" value="${state.minWeight}"></label><form class="sna-pathfinder" data-sna-path><span>${tr('Etsi ketju', 'Hitta kedja', 'Find a path')}</span><label class="sr-only" for="sna-path-a">${tr('Toimija A', 'Aktör A', 'Actor A')}</label><input id="sna-path-a" name="from" list="sna-node-options" placeholder="${tr('Toimija A', 'Aktör A', 'Actor A')}" autocomplete="off"><span aria-hidden="true">↔</span><label class="sr-only" for="sna-path-b">${tr('Toimija B', 'Aktör B', 'Actor B')}</label><input id="sna-path-b" name="to" list="sna-node-options" placeholder="${tr('Toimija B', 'Aktör B', 'Actor B')}" autocomplete="off"><button type="submit">${tr('Etsi', 'Sök', 'Find')}</button><button type="button" data-sna-clear-path aria-label="${tr('Tyhjennä ketju', 'Rensa kedjan', 'Clear path')}">×</button><datalist id="sna-node-options"></datalist></form></div>
      </details>
      <p class="sna-path-status" data-sna-path-status role="status"></p>
      <div class="sna-workspace"><div class="sna-map"><div class="sna-map-kicker"><span data-sna-layout-label></span><span>${tr('ESILASKETTU VERKOSTO', 'FÖRBERÄKNAT NÄTVERK', 'PRECOMPUTED NETWORK')}</span></div><div class="sna-canvas" data-sna-canvas tabindex="0" role="img" aria-label="${tr('Verkostokartta. Samat yhteydet ovat alla luettelossa. Nuolinäppäimet siirtävät, plus ja miinus zoomaavat, F sovittaa.', 'Nätverkskarta. Samma relationer finns i listan nedan. Piltangenter flyttar, plus och minus zoomar, F anpassar.', 'Network map. The same connections are listed below. Arrow keys pan, plus and minus zoom, F fits.')}"></div><div class="sna-map-footer"><span data-sna-map-count></span><span>${tr('Ota kartan siirto käyttöön, niin voit vetää ja zoomata vierittämällä tai nipistämällä.', 'Aktivera kartförflyttning för att dra och zooma med rullning eller nypning.', 'Enable Pan map to drag and zoom by scrolling or pinching.')}</span></div><div class="sna-map-empty" data-sna-map-empty hidden>${tr('Kartalla ei ole yhteyksiä.', 'Kartan visar inga relationer.', 'There are no ties on the map.')}</div></div><aside class="sna-drawer" data-sna-drawer aria-label="${tr('Valinnan tiedot ja lähteet', 'Detaljer och källor', 'Selection details and evidence')}"></aside></div>
      <div class="sna-legend"><span><i class="sna-shape-mp"></i>${tr('Edustaja', 'Ledamot', 'MP')}</span><span><i class="sna-shape-org"></i>${tr('Organisaatio', 'Organisation', 'Organisation')}</span><span><i class="sna-shape-bill"></i>${tr('Lakiasia', 'Lagärende', 'Bill')}</span><span class="sna-legend-divider"></span>${['sidonnaisuus', 'lobbaus', 'lahja'].map(key => `<span><i class="sna-line-${key}"></i>${layerLabel(key)}</span>`).join('')}<span><b>×</b> ${tr('Useita suhdetyyppejä', 'Flera lager', 'Multiple layers')}</span></div>
      </div>
    </section>
    <p class="sna-meaning">${tr('Yhteys kertoo ilmoituksesta, ei vaikutuksen onnistumisesta. Valiokuntajohdannainen yhdistää ilmoitetun kohdevaliokunnan sen jäseneen; se ei osoita henkilökohtaista yhteydenottoa.', 'En koppling beskriver en anmälan, inte lyckad påverkan. Härledda utskottskopplingar länkar ett rapporterat utskott till en medlem; de visar inte personlig kontakt.', 'A tie describes a disclosure, not successful influence. Inferred committee links connect a declared committee target to a member; they do not establish personal contact.')}</p>
    <div class="sna-stats"><div><strong>${number(graph.nodes.filter(node => node.type === 'mp').length)}</strong><span>${tr('edustajaa aineistossa', 'ledamöter i materialet', 'MPs in the snapshot')}</span></div><div><strong>${number(graph.nodes.filter(node => node.type === 'org').length)}</strong><span>${tr('yhdistettyä organisaatiota', 'sammanförda organisationer', 'resolved organisations')}</span></div><div><strong>${number(graph.edges.length)}</strong><span>${tr('koottua yhteyttä', 'aggregerade relationer', 'aggregated ties')}</span></div><div><strong>${number(allDual)}</strong><span>${tr('lobbaus- ja muu sidos', 'lobbying och annan bindning', 'lobbying + another tie')}</span></div></div>
    <section class="sna-insights" data-sna-insights aria-label="${tr('Nostot aineistosta', 'Insikter i materialet', 'Snapshot insights')}"></section>
    <section class="sna-records" aria-labelledby="sna-records-heading"><div class="sna-section-label"><h2 id="sna-records-heading">${tr('Yhteydet ja lähteet', 'Relationer och källor', 'Connections & evidence')}</h2><div class="sna-list-switch" role="group" aria-label="${tr('Luettelon esitystapa', 'Listvy', 'List view')}"><button type="button" data-sna-list="table">${tr('Taulukko', 'Tabell', 'Table')}</button><button type="button" data-sna-list="cards">${tr('Kortit', 'Kort', 'Cards')}</button></div></div><p class="sna-record-count" data-sna-record-count></p><div data-sna-records></div><div class="sna-pagination"><button type="button" data-sna-prev>${tr('Edelliset', 'Föregående', 'Previous')}</button><span data-sna-pagination></span><button type="button" data-sna-next>${tr('Seuraavat', 'Nästa', 'Next')}</button></div></section>
    <details class="sna-heatmap"><summary>${tr('Eduskuntaryhmä × organisaatio', 'Riksdagsgrupp × organisation', 'Party × organisation')}<span>${tr('Yhteyksien jakautuminen · 10 organisaatiota', 'Fördelning av relationer · 10 organisationer', 'Distribution of ties · 10 organisations')}</span></summary><div data-sna-heatmap></div></details>
    <details class="sna-method"><summary>${tr('Mistä luvut tulevat? Aineisto ja menetelmät', 'Varifrån kommer siffrorna? Data och metoder', 'Where do the figures come from? Data & methods')}</summary><div data-sna-method></div></details>
  </div>`;
  const pageRoot = root.querySelector('[data-sna-page]'), $ = selector => pageRoot.querySelector(selector);
  pageRoot.dataset.snaEasy = String(view === 'simple');
  let inspectionTrigger = null;
  $('.sna-legend').insertAdjacentHTML('beforeend', `<span data-sna-committee-legend hidden><i class="sna-shape-committee"></i>${tr('Valiokunta · pisteviiva = jäsenyys', 'Utskott · prickad linje = medlemskap', 'Committee · dotted line = membership')}</span>`);
  const lifecycle = new MutationObserver(() => { if (!pageRoot.isConnected) { canvas?.destroy(); lifecycle.disconnect(); mobile.removeEventListener('change', onMobile); } }); lifecycle.observe(root, { childList: true });
  function persist() {
    // Keep the primary route stable until a meaningful setting is selected.
    // Rewriting the default link made repeat navigation add duplicate history
    // entries and broke the shared route/reading-position contract.
    const p = new URLSearchParams();
    if (preset !== 'backbone') p.set('preset', preset);
    if (layout !== 'force') p.set('layout', layout);
    if (metric !== 'degree') p.set('size', metric);
    if (actorLimit() !== null) p.set('actors', actorLimit());
    if (focus.mp) p.set('mp', nodeMap.get(focus.mp).mpId);
    if (focus.org) p.set('org', focus.org);
    if (state.query) p.set('q', state.query);
    if (state.minWeight) p.set('min', state.minWeight);
    if (inferredPreference !== null) p.set('inferred', state.inferred ? '1' : '0');
    if (state.sort !== 'weight') p.set('sort', state.sort);
    if (state.direction !== 'desc') p.set('direction', state.direction);
    const facets = Object.fromEntries(Object.entries(state.facets).filter(([, selection]) => selection.include?.length || selection.exclude?.length)); if (Object.keys(facets).length) p.set('facets', JSON.stringify(facets));
    const hash = `#/relationships${p.size ? `?${p}` : ''}`;
    if (location.hash !== hash) history.replaceState(history.state, '', hash);
    root.dataset.route = location.hash;
  }
  function billLinks(ids) {
    return ids.map(id => { const bill = nodeMap.get(`bill:${id}`); return `<div class="sna-bill-link"><strong>${e(id)}</strong>${bill?.available ? `<a href="#/legislation/${encodeURIComponent(id)}">${tr('Katso äänestykset ja puheenvuorot tästä lakiasiasta', 'Se omröstningar och anföranden om ärendet', 'See votes and speeches for this bill')} →</a>` : `<span>${tr('Lakiasiaa ei ole tallennetussa asiakokoelmassa.', 'Ärendet finns inte i den lagrade samlingen.', 'This bill is outside the stored legislation collection.')}</span>`}<a href="#/speeches?${new URLSearchParams({ q: id.replace(/ vp$/u, '') })}">${tr('Hae puheenvuoroista', 'Sök bland anföranden', 'Search speeches')} →</a></div>`; }).join('');
  }
  function showDrawer() {
    const drawer = $('[data-sna-drawer]'), revision = ++selectedRevision;
    if (!selected) {
      if (drawer.classList.contains('sna-standalone-drawer')) { drawer.classList.remove('sna-standalone-drawer'); $('.sna-workspace').append(drawer); }
      drawer.innerHTML = `<span class="eyebrow">${tr('Seuraa yhtä yhteyttä', 'Följ en relation', 'Follow a connection')}</span><h2>${tr('Kartta on lähtöpiste.', 'Kartan är en början.', 'Start with a connection.')}</h2><p>${tr('Valitse toimija tai yhteys. Näet ilmoitukset, suhdetyypit ja linkit alkuperäisiin lähteisiin.', 'Välj en aktör eller relation för att se anmälningar, relationstyper och ursprungliga källor.', 'Select an actor or a tie to see disclosures, relationship types and original sources.')}</p><ol><li>${tr('Vie hiiri toimijan päälle nähdäksesi sen lähipiirin.', 'Hovra för att se aktörens närmaste nätverk.', 'Hover to spotlight an actor’s neighbours.')}</li><li>${tr('Avaa tiedot napsauttamalla.', 'Klicka för att öppna detaljer.', 'Click to inspect the evidence.')}</li>${focusIds().length ? '' : `<li>${tr('Laajenna verkostoa kaksoisnapsauttamalla.', 'Dubbelklicka för att utöka nätverket.', 'Double-click to expand the network.')}</li>`}</ol>${focusIds().length ? '' : `<button type="button" class="sna-primary" data-sna-example>${tr('Tutki kaksoisroolia', 'Utforska en dubbel roll', 'Explore an overlapping role')} →</button>`}<p class="sna-small">${tr('Ympyrä = edustaja, neliö = organisaatio. Solmun koko kuvaa valitsemaasi verkostomittaria.', 'Cirkel = ledamot, fyrkant = organisation. Nodstorleken visar det valda nätverksmåttet.', 'Circle = MP, square = organisation. Node size represents the selected network metric.')}</p>`;
      const example = $('[data-sna-example]');
      if (example) example.onclick = () => { choosePreset('dual'); const edge = display.edges[0]; if (edge) inspect('edge', edge.id); };
      return;
    }
    const node = selectedKind === 'node' ? nodeMap.get(selected) : null;
    const edge = !node ? [...display.edges, ...display.eligible, ...filtered].find(edge => edge.id === selected) : null;
    if (!node && !edge) { selected = null; selectedKind = null; showDrawer(); return; }
    const committee = node?.type === 'committee' ? node : edge?.layers.includes('membership') ? nodeMap.get(edge.target) : null;
    if (committee) {
      const members = graph.nodes.filter(mp => mp.type === 'mp' && mp.committees.includes(committee.name) && (!edge || mp.id === edge.source));
      drawer.innerHTML = `<div class="sna-drawer-top"><span class="eyebrow">${tr('Valiokuntajäsenyys', 'Utskottsmedlemskap', 'Committee membership')}</span><button type="button" data-sna-close aria-label="${tr('Sulje tiedot', 'Stäng detaljer', 'Close details')}">×</button></div><h2>${e(committee.fullName)}</h2><p>${tr('Lähteen jäsenyydet aineistopäivänä', 'Källans medlemskap på datadatumet', 'Source memberships at snapshot')}: ${e(graph.asOf)}.</p>${members.map(mp => `<section class="sna-membership"><a class="sna-inline-link" href="#/members/${encodeURIComponent(mp.mpId)}">${e(mp.name)} · ${e(mp.party.toUpperCase())}</a>${mp.memberships.filter(m => m.id === committee.name && m.from <= graph.asOf && m.to >= graph.asOf).map(m => `<p>${e(m.role)} · ${e(m.from)} – ${e(m.to)}</p>`).join('')}${safeURL(mp.sourceUrl) ? `<a class="sna-inline-link" href="${e(mp.sourceUrl)}" target="_blank" rel="noopener noreferrer">${tr('Virallinen jäsenyyslähde', 'Officiell medlemskälla', 'Official membership source')} ↗</a>` : ''}</section>`).join('')}`;
      $('[data-sna-close]').onclick = clearSelection; return;
    }
    let descriptors;
    if (node?.type === 'bill' || edge?.supportEdgeIds) {
      const billIds = node ? [node.heId] : edge.heIds;
      const support = edge?.supportEdgeIds ? new Set(edge.supportEdgeIds) : null;
      descriptors = filtered.flatMap(tie => support && !support.has(tie.id) || !tie.heIds.some(id => billIds.includes(id)) ? [] : tie.details.filter(detail => detail.heIds.some(id => billIds.includes(id))));
    } else if (edge?.sharedOrgs) {
      const byId = new Map(filtered.map(tie => [tie.id, tie]));
      descriptors = edge.sharedOrgs.flatMap(org => org.edgeIds.flatMap(id => byId.get(id)?.details.filter(detail => detail.board && detail.periods.some(year => org.periods.includes(year))) || []));
    } else {
      descriptors = node ? filtered.flatMap(tie => tie.source === node.id || tie.target === node.id ? tie.details : []) : edge.details;
    }
    const heIds = node?.heId ? [node.heId] : edge?.supportEdgeIds ? edge.heIds : [...new Set(descriptors.flatMap(detail => detail.heIds))];
    const name = node?.name || `${nodeMap.get(edge.source)?.name} ↔ ${nodeMap.get(edge.target)?.name}`;
    const peers = new Set(display.eligible.filter(edge => edge.source === node?.id || edge.target === node?.id).map(edge => edge.source === node?.id ? edge.target : edge.source));
    const visibleEdges = new Set(display.edges.map(edge => edge.id));
    const hidden = display.eligible.filter(edge => (edge.source === node?.id || edge.target === node?.id) && !visibleEdges.has(edge.id)).length;
    const population = node ? graph.nodes.filter(item => item.type === node.type) : [], percentile = node?.type !== 'bill' && node ? Math.max(1, Math.ceil(100 * population.filter(item => item.betweenness >= node.betweenness).length / population.length)) : 100;
    drawer.innerHTML = `<div class="sna-drawer-top"><span class="eyebrow">${node ? e(typeLabel(node)) : tr('Yhteyden tiedot', 'Relationsdetaljer', 'Connection evidence')}</span><button type="button" data-sna-close aria-label="${tr('Sulje tiedot', 'Stäng detaljer', 'Close details')}">×</button></div><h2>${e(name)}</h2>${node?.electoralDistrict ? `<p class="sna-small">${e(node.electoralDistrict)}${node.isMinister ? ` · ${tr('Ministeri', 'Minister', 'Minister')}` : ''}</p>` : ''}
      ${node && node.type !== 'bill' ? `<p class="sna-node-summary">${percentile <= 5 ? tr(`Sillanrakentajien kärki ${percentile} %`, `Bland de främsta ${percentile} % brobyggarna`, `Top ${percentile}% by betweenness`) : tr('Asema tallennetussa verkostossa', 'Position i det lagrade nätverket', 'Position in the stored network')} · ${tr(`yhteyksiä ${node.crossPartyCount || 0} eri eduskuntaryhmään.`, `kopplingar till ${node.crossPartyCount || 0} riksdagsgrupper.`, `connections across ${node.crossPartyCount || 0} parliamentary groups.`)}</p><dl class="sna-node-metrics"><div><dt>${tr('Yhteyksiä', 'Relationer', 'Degree')}</dt><dd>${number(node.degree)}</dd></div><div><dt>${tr('Välillisyys', 'Mellanliggande', 'Betweenness')}</dt><dd>${number(node.betweenness, 4)}</dd></div><div><dt>PageRank</dt><dd>${number(node.pagerank, 4)}</dd></div><div><dt>E–I</dt><dd>${number(node.eiIndex, 2)}</dd></div></dl><p class="sna-small">${tr('Mittarit ja puolueosuudet kuvaavat koko aineistoa, myös valiokuntajohdannaisia. Hallitus–oppositio ja valiokuntasuodatin käyttävät aineistopäivän kokoonpanoa.', 'Mått och partiandelar gäller hela materialet, även härledda utskottskopplingar. Block och utskottsfilter använder sammansättningen på datadatumet.', 'Metrics and party shares describe the full snapshot, including inferred committee links. Bloc and committee filters use snapshot membership.')}</p><details class="sna-metric-help"><summary>${tr('Mitä mittarit tarkoittavat?', 'Vad betyder måtten?', 'What do these metrics mean?')}</summary><p>${tr('Yhteyksiä = eri toimijoiden määrä. Välillisyys kertoo, kuinka usein toimija on verkoston lyhimmällä polulla. PageRank painottaa yhteyksiä keskeisiin naapureihin. Nämä luvut eivät mittaa poliittista vaikutusvaltaa.', 'Relationer = antal olika aktörer. Förmedling beskriver hur ofta aktören ligger på nätverkets kortaste vägar. PageRank väger relationer till centrala grannar. Måtten mäter inte politiskt inflytande.', 'Degree counts distinct neighbours. Betweenness describes how often an actor lies on shortest graph paths. PageRank weights ties to central neighbours. These figures do not measure political influence.')}</p><p>${tr('E–I vertaa ulkoisia ja sisäisiä yhteyksiä: edustajalla eri puolueiden ja oman puolueen hallintotehtäväkumppaneita, organisaatiolla eri hallitusblokkien ja saman blokin edustajapareja. +1 = vain ulkoisia, −1 = vain sisäisiä. Nolla voi tarkoittaa tasapainoa tai liian vähän yhteyksiä.', 'E–I jämför externa och interna relationer: ledamöters styrelsekollegor från andra eller samma parti, och organisationers ledamotspar från olika eller samma regeringsblock. +1 = enbart externa, −1 = enbart interna. Noll kan betyda balans eller för få relationer.', 'E–I compares external and internal ties: an MP’s board peers from other or the same party; an organisation’s MP pairs across or within government blocs. +1 means only external, −1 only internal. Zero can mean balance or insufficient ties.')}</p></details>${node.yTunnus ? `<p class="sna-small">${tr('Yritys-/rekisteritunnus', 'FO-/registernummer', 'Business / registry ID')}: ${e(node.yTunnus)}</p>` : ''}<div class="sna-ego-actions"><button type="button" data-sna-expand ${!peers.size ? 'disabled' : ''}>${hidden ? `+${number(hidden)} ` : ''}${tr('Laajenna yhteydet', 'Utöka relationer', 'Expand neighbours')}</button><button type="button" data-sna-prune>${tr('Poista kartalta', 'Ta bort från kartan', 'Prune from map')}</button></div>${node.type === 'mp' ? `<a class="sna-inline-link" href="#/members/${encodeURIComponent(node.mpId)}">${tr('Edustajan oma sivu', 'Ledamotens sida', 'MP profile')} →</a>` : `<p class="sna-small">${tr('Eduskuntaryhmien osuudet koko aineistossa', 'Riksdagsgruppernas andelar i hela materialet', 'Parliamentary group shares in the full snapshot')}</p><div class="sna-party-breakdown">${Object.entries(node.partyBreakdown || {}).sort((a, b) => b[1] - a[1]).map(([party, share]) => `<div><span>${e(party.toUpperCase())}</span><meter min="0" max="1" value="${share}" aria-label="${e(party.toUpperCase())}">${number(share * 100)} %</meter><span>${number(share * 100)} %</span></div>`).join('')}</div>`}` : ''}
      ${edge ? `<div class="sna-layer-chips">${(edge.layers || []).map(layer => `<span>${layerLabel(layer)}</span>`).join('')}</div><p class="sna-small">${tr('Paino', 'Vikt', 'Weight')}: ${number(edge.weight, 2)} · ${e((edge.periods || []).join(', '))}</p>${edge.sharedOrgs ? `<ul>${edge.sharedOrgs.map(org => `<li>${e(nodeMap.get(org.id)?.name)} · ${e(org.periods.join(', '))}</li>`).join('')}</ul><p class="sna-small">${tr('Yhteinen ilmoitusvuosi ei vahvista samanaikaista hallitusjäsenyyttä.', 'Ett gemensamt anmälningsår bekräftar inte samtidiga styrelseuppdrag.', 'A common disclosure year does not confirm simultaneous board service.')}</p>` : ''}` : ''}
      ${billLinks(heIds)}<h3 class="sna-evidence-heading">${tr('Ilmoitukset ja alkuperäislähteet', 'Anmälningar och originalkällor', 'Disclosures & original sources')}</h3><div data-sna-evidence><p role="status">${tr('Ladataan ilmoituksia…', 'Laddar anmälningar…', 'Loading disclosures…')}</p></div>`;
    $('[data-sna-close]').onclick = clearSelection;
    if (node && node.type !== 'bill') {
      const expandButton = $('[data-sna-expand]'), pruneButton = $('[data-sna-prune]');
      if (focusIds().length) { expandButton.hidden = true; pruneButton.hidden = true; }
      expandButton.onclick = () => expand(node.id);
      pruneButton.onclick = () => { pruned.add(node.id); expanded.delete(node.id); selected = null; redraw(); };
    }
    if (!descriptors.length) { $('[data-sna-evidence]').textContent = tr('Ei ilmoituksia nykyisellä rajauksella.', 'Inga anmälningar med dessa filter.', 'No disclosures match the current filters.'); return; }
    evidenceFor(manifest).then(({ records, targets = {} }) => {
      if (!current() || !pageRoot.isConnected || revision !== selectedRevision) return;
      const byRecord = new Map();
      for (const detail of descriptors) {
        if (!byRecord.has(detail.id)) byRecord.set(detail.id, []);
        byRecord.get(detail.id).push(detail);
      }
      const ids = [...byRecord.keys()]; let count = 15;
      const render = () => {
        $('[data-sna-evidence]').innerHTML = `<p class="sna-small">${number(ids.length)} ${tr('eri lähdeilmoitusta', 'olika källanmälningar', 'distinct source records')}</p>${ids.slice(0, count).map(id => {
          const row = records[id], links = byRecord.get(id); if (!row) return '';
          const inferred = links.some(detail => detail.inferred), source = safeURL(row.sourceUrl);
          const recipients = [...new Set(links.map(detail => detail.targetId).filter(Boolean))].map(id => { const target = targets[id]; return target ? [target.fi?.name || target.sv?.name, lang === 'sv' ? target.sv?.unit || target.fi?.unit : target.fi?.unit || target.sv?.unit, target.fi?.title].filter(Boolean).join(' · ') + ` (ID ${id})` : `ID ${id}`; });
          return `<details class="sna-disclosure"><summary>${e(layerLabel(row.layer))} · ${e(row.reported || row.year || row.period?.end || '')}${inferred ? ` · ${tr('sisältää johdannaisia', 'innehåller härledda kopplingar', 'includes inferred links')}` : ''}</summary>${inferred ? `<p class="sna-evidence-tag">${tr('Valiokuntajohdannainen, ei henkilökohtainen yhteydenotto', 'Härledd utskottskoppling, inte personlig kontakt', 'Inferred committee link, not personal contact')} (${e([...new Set(links.filter(detail => detail.inferred).map(detail => detail.viaCommittee))].join(', '))})</p>` : ''}<p>${e(row.mpName || row.actor || '')}</p><p class="sna-small">${tr('Lähdetietue', 'Källpost', 'Source record')}: ${e(row.id)}</p>${links.some(detail => detail.organizationIdentity === 'unique-normalized-name-to-business-id') ? `<p class="sna-evidence-tag">${tr('Organisaation tunnus on yhdistetty yksikäsitteisellä normalisoidulla nimellä. Tarkista alkuperäinen nimi.', 'Organisationsnumret har matchats med ett entydigt normaliserat namn. Kontrollera originalnamnet.', 'The organisation ID was matched by an unambiguous normalized name. Check the original name.')}</p>` : ''}${recipients.length ? `<p class="sna-small">${tr('Näiden yhteyksien ilmoitetut kohteet', 'Rapporterade mottagare för dessa relationer', 'Declared targets supporting these ties')}: ${e(recipients.join('; '))}</p>` : ''}${row.customer ? `<p class="sna-small">${tr('Ilmoitettu asiakas', 'Rapporterad kund', 'Declared client')}: ${e(row.customer)}</p>` : ''}${row.period ? `<p class="sna-small">${tr('Ilmoituskausi', 'Rapporteringsperiod', 'Reporting period')}: ${e(row.period.start)} – ${e(row.period.end)}</p>` : ''}${row.category ? `<p class="sna-small">${e(row.category)}</p>` : ''}<p class="sna-source-text">${e(row.topic || row.description || '')}</p>${row.layer === 'lahja' ? `<p>${e(row.donor)} · ${row.amount == null ? tr('Arvoa ei ilmoitettu', 'Värde ej angivet', 'Value not disclosed') : `${number(row.amount, 2)} €`}</p><p class="sna-small">${tr('Lähteen käyttöaika', 'Användningstid enligt källan', 'Source period of use')}: ${e(row.used || '—')}</p>` : ''}${row.methods?.length ? `<p class="sna-small">${tr('Ilmoituksen yhteydenpitotavat (kaikki kohteet)', 'Anmälans kontaktmetoder (alla mottagare)', 'Disclosure contact methods (all targets)')}: ${e(row.methods.map(method => ({ meeting: tr('Tapaaminen', 'Möte', 'Meeting'), mail: tr('Sähköposti', 'E-post', 'Email'), phone: tr('Puhelin', 'Telefon', 'Phone'), online: tr('Verkkotapaaminen', 'Webbmöte', 'Online meeting'), other: tr('Muu', 'Annat', 'Other') }[method] || method)).join(', '))}${row.otherMethod ? ` · ${e(row.otherMethod)}` : ''}</p>` : ''}${row.notificationId ? `<p class="sna-small">${tr('Ilmoitustunnus', 'Anmälnings-ID', 'Declaration ID')}: ${e(row.notificationId)} · ${e(row.diaryNumber || '')}</p>` : ''}${source ? `<a href="${e(source)}" target="_blank" rel="noopener noreferrer">${tr('Virallinen lähde', 'Officiell källa', 'Official source')} ↗</a>` : ''}</details>`;
        }).join('')}${ids.length > count ? `<button type="button" data-sna-more-evidence>${tr('Näytä lisää ilmoituksia', 'Visa fler anmälningar', 'Show more disclosures')}</button>` : ''}`;
        const more = $('[data-sna-more-evidence]'); if (more) more.onclick = () => { count += 30; render(); };
      }; render();
    }).catch(() => { if (current() && pageRoot.isConnected && revision === selectedRevision) $('[data-sna-evidence]').textContent = tr('Lähdeilmoituksia ei voitu ladata. Yritä avaamalla valinta uudelleen.', 'Källorna kunde inte laddas. Öppna valet igen.', 'Could not load evidence. Reopen the selection to retry.'); });
  }
  function inspect(kind, id) {
    inspectionTrigger = document.activeElement;
    selectedKind = kind; selected = id; canvas?.select(id); showDrawer();
    if (!canvasOpen) { const aside = $('[data-sna-drawer]'); aside.classList.add('sna-standalone-drawer'); $('[data-sna-records]').before(aside); aside.scrollIntoView({ behavior: 'instant', block: 'nearest' }); }
    else { const aside = $('[data-sna-drawer]'), box = aside.getBoundingClientRect(); if (box.top > innerHeight || box.bottom < 70) aside.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' }); }
    const heading = $('[data-sna-drawer] h2'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
  function clearSelection() {
    selected = null; selectedKind = null; canvas?.select(focus.mp || focus.org || ''); showDrawer();
    if (!canvasOpen) { const drawer = $('[data-sna-drawer]'); drawer.classList.remove('sna-standalone-drawer'); $('.sna-workspace').append(drawer); }
    if (inspectionTrigger?.isConnected) inspectionTrigger.focus({ preventScroll: true });
    else if (canvasOpen) $('[data-sna-canvas]').focus({ preventScroll: true });
  }
  function expand(id) {
    if (focusIds().length) return;
    if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
    pruned.delete(id); redraw();
  }
  function resetInspection() {
    selected = null; selectedKind = null; inspectionTrigger = null;
    expanded.clear(); pruned.clear(); page = 1;
    $('[data-sna-path]').reset();
  }
  function syncInferred() {
    state.inferred = inferredPreference ?? defaultInferred();
    $('[data-sna-inferred]').checked = state.inferred;
  }
  function changeFocus(type, id) {
    if (id && !focusIds().length) $('.sna-map-tools').open = false;
    focus[type] = id;
    preset = 'backbone';
    syncInferred();
    resetInspection();
    redraw();
    if (id && !canvasOpen) setCanvasOpen(true);
  }
  const pickers = Object.fromEntries(['mp', 'org'].map(type => [type, mountTransparencyPicker($(`[data-sna-picker="${type}"]`), {
    actors: graph.nodes.filter(node => node.type === type),
    selected: focus[type],
    describe: node => node.type === 'mp' ? [typeLabel(node), node.electoralDistrict].filter(Boolean).join(' · ') : [node.yTunnus, typeLabel(node)].filter(Boolean).join(' · '),
    onChange: id => changeFocus(type, id), tr, lang
  })]));
  function choosePreset(key) {
    preset = key;
    focus.mp = null; focus.org = null;
    syncInferred();
    for (const picker of Object.values(pickers)) picker.set(null);
    resetInspection();
    redraw();
  }
  const sortConfig = { label: tr('Verkostokartan rajaukset', 'Nätverksfilter', 'Network filters'), visible: true, embedded: true, sorts: [{ key: 'weight', label: tr('Yhteyden vahvuus', 'Relationsstyrka', 'Tie strength'), value: edge => edge.weight }, { key: 'name', label: tr('Toimijan nimi', 'Aktörens namn', 'Actor name'), value: edge => nodeMap.get(edge.source)?.name }], search: edge => [nodeMap.get(edge.source)?.name, nodeMap.get(edge.target)?.name, ...edge.heIds], facets: facetDefinitions };
  const filterTools = mountCollectionTools($('[data-sna-filters]'), 'sna-filter', state, sortConfig, lang, () => { page = 1; redraw(); });
  filterTools.querySelector('[data-tool="query"]').maxLength = 200;
  const clearFilters = filterTools.querySelector('[data-tool-clear]');
  clearFilters.addEventListener('click', () => {
    state.minWeight = 0; inferredPreference = null; syncInferred();
    $('[data-sna-weight]').value = 0;
    $('[data-sna-weight-value]').value = number(0);
  }, { capture: true });
  $('[data-sna-reset-filters]').onclick = () => {
    clearFilters.click();
    $('#sna-map-heading').tabIndex = -1;
    $('#sna-map-heading').focus({ preventScroll: true });
  };
  const onlyInferred = () => candidates.length > 0 && !state.inferred && candidates.every(edge => edge.details.every(detail => detail.inferred));
  function describeEmpty(focused) {
    if (focused.length && onlyInferred()) return tr('Aineistossa on vain valiokuntajohdannaisia. Ne perustuvat valiokuntajäsenyyteen.', 'Materialet innehåller bara härledda utskottskopplingar. De bygger på utskottsmedlemskap.', 'The snapshot contains only inferred committee links here, based on committee membership.');
    if (candidates.length && focused.length && !filtered.length) return tr('Valituille toimijoille on ilmoituksia. Nykyiset rajaukset piilottavat ne.', 'Det finns anmälningar för de valda aktörerna. De aktuella filtren döljer dem.', 'The selected actors have disclosures hidden by the current filters.');
    if (focused.length === 2) return tr('Tälle kansanedustajan ja organisaation parille ei ole ilmoitettua yhteyttä aineistossa. Vaihda tai tyhjennä toinen valinta.', 'Det finns ingen rapporterad relation mellan ledamoten och organisationen i materialet. Ändra eller rensa ett av valen.', 'This MP and organisation have no disclosed tie in the snapshot. Change or clear either selection.');
    if (focused.length === 1) return tr('Valitulla toimijalla ei ole ilmoitettuja yhteyksiä aineistossa. Kokeile toista toimijaa.', 'Den valda aktören har inga rapporterade relationer i materialet. Prova en annan aktör.', 'This actor has no disclosed ties in the snapshot. Try another actor.');
    return tr('Nykyiseen pikavalintaan ja rajauksiin ei löydy yhteyksiä. Kokeile toista pikavalintaa tai tyhjennä rajaukset.', 'Inga relationer matchar snabbvalet och filtren. Prova ett annat snabbval eller rensa filtren.', 'No ties match the current quick view and filters. Try another quick view or clear the filters.');
  }
  function renderRecords() {
    const eligible = state.sort === 'weight' && state.direction === 'desc' ? display.eligible : applyCollection(display.eligible, { ...state, query: '', facets: {} }, { sorts: sortConfig.sorts }, lang);
    const count = eligible.length;
    page = Math.max(1, Math.min(page, Math.ceil(count / 25) || 1));
    const shown = eligible.slice((page - 1) * 25, page * 25), recordHost = $('[data-sna-records]');
    const sourceButton = edge => `<button type="button" class="sna-evidence-button" data-sna-inspect-edge="${e(edge.id)}">${tr('Avaa lähteet', 'Öppna källor', 'View evidence')} →</button>`;
    const entity = id => `<button type="button" class="sna-entity-button" data-sna-inspect-node="${e(id)}">${e(nodeMap.get(id)?.name || id)}</button><small>${e(typeLabel(nodeMap.get(id)))}</small>`;
    $('[data-sna-record-count]').textContent = tr(`Luettelossa kaikki ${number(count)} valintaan ja rajauksiin sopivaa yhteyttä. Kartalla ${number(display.nodes.length)} toimijaa ja ${number(display.edges.length)} yhteyttä.`, `Listan visar alla ${number(count)} matchande relationer. Kartan visar ${number(display.nodes.length)} aktörer och ${number(display.edges.length)} relationer.`, `The list contains all ${number(count)} ties matching your selection and filters. The map shows ${number(display.nodes.length)} actors and ${number(display.edges.length)} ties.`);
    if (!count) recordHost.innerHTML = `<p class="sna-empty">${e(describeEmpty(focusIds()))}</p>`;
    else if (listMode === 'table') recordHost.innerHTML = `<div class="table-wrap sna-table" tabindex="0" role="region" aria-label="${tr('Yhteystaulukko, vieritä sivusuunnassa', 'Relationstabell, rulla i sidled', 'Connections table, scroll horizontally')}"><table><caption class="sr-only">${tr('Rajatut yhteydet ja lähteet', 'Filtrerade relationer och källor', 'Filtered ties and evidence')}</caption><thead><tr><th scope="col">${preset === 'interlocks' ? tr('Edustaja', 'Ledamot', 'MP') : tr('Organisaatio', 'Organisation', 'Organisation')}</th><th scope="col">${tr('Edustaja', 'Ledamot', 'MP')}</th><th scope="col">${tr('Suhdetyypit', 'Relationstyper', 'Layers')}</th><th scope="col">${tr('Paino', 'Vikt', 'Weight')}</th><th scope="col">${tr('Vuodet', 'År', 'Years')}</th><th scope="col">${tr('Lähteet', 'Källor', 'Evidence')}</th></tr></thead><tbody>${shown.map(edge => `<tr><td>${entity(edge.source)}</td><td>${entity(edge.target)}</td><td>${edge.layers.map(layer => `<span class="sna-table-layer">${e(layerLabel(layer))}</span>`).join('')}${edge.hasInferred ? `<small>${tr('Sisältää johdannaisia', 'Innehåller härledda länkar', 'Includes inferred links')}</small>` : ''}</td><td class="sna-numeric">${number(edge.weight, 2)}</td><td>${e(edge.periods.join(', '))}</td><td>${sourceButton(edge)}</td></tr>`).join('')}</tbody></table></div>`;
    else recordHost.innerHTML = `<div class="sna-ego-cards">${shown.map(edge => `<article><div>${entity(edge.source)}</div><span class="sna-card-arrow" aria-hidden="true">↕</span><div>${entity(edge.target)}</div><p>${e(edge.layers.map(layerLabel).join(' · '))} · ${number(edge.weight, 2)}</p><small>${e(edge.periods.join(', '))}</small>${sourceButton(edge)}</article>`).join('')}</div>`;
    $('[data-sna-pagination]').textContent = `${page} / ${Math.ceil(count / 25) || 1}`; $('[data-sna-prev]').disabled = page <= 1; $('[data-sna-next]').disabled = page * 25 >= count;
    pageRoot.querySelectorAll('[data-sna-list]').forEach(button => button.setAttribute('aria-pressed', button.dataset.snaList === listMode));
  }
  function disclosedForView() {
    if (preset !== 'interlocks') return display.eligible;
    const support = new Set(display.eligible.flatMap(edge => edge.sharedOrgs.flatMap(org => org.edgeIds)));
    return filtered.filter(edge => support.has(edge.id));
  }
  function renderInsights() {
    const disclosed = disclosedForView();
    const dual = [];
    for (const edge of disclosed) {
      if (edge.isDualRole) dual.push(edge);
      if (dual.length === 3) break;
    }
    $('[data-sna-insights]').innerHTML = `<div class="sna-section-label"><h2>${tr('Pinnalla tässä rajauksessa', 'I fokus med dessa filter', 'Patterns in this selection')}</h2><span>${tr('Sama organisaatio, useita suhdetyyppejä', 'Samma organisation, flera relationstyper', 'One organisation, multiple relationship types')}</span></div><div class="sna-insight-grid">${dual.length ? dual.map(edge => `<button type="button" class="sna-insight" data-sna-inspect-edge="${e(edge.id)}"><span class="sna-insight-tag">× ${tr('KAKSOISROOLI', 'DUBBEL ROLL', 'OVERLAPPING TIES')}</span><strong>${e(nodeMap.get(edge.source).name)}</strong><span>↔ ${e(nodeMap.get(edge.target).name)} <small>${e(nodeMap.get(edge.target).party.toUpperCase())}</small></span><small>${e(edge.layers.map(layer => `${layerLabel(layer)} ${edge.counts[layer]}`).join(' · '))}</small><span class="sna-insight-cta">${tr('Tutki ilmoituksia', 'Granska anmälningar', 'Inspect disclosures')} →</span></button>`).join('') : `<p>${tr('Ei lobbaus- ja muiden sidosten päällekkäisyyksiä tässä rajauksessa.', 'Inga överlappande lobbyingrelationer med dessa filter.', 'No overlapping lobbying and other ties match these filters.')}</p>`}</div>`;
    renderHeatmap(disclosed);
  }
  function renderHeatmap(disclosed) {
    if (!$('.sna-heatmap').open) return;
    const parties = [...new Set(disclosed.map(edge => nodeMap.get(edge.target).party))].sort(), organizations = new Map();
    for (const edge of disclosed) { if (!organizations.has(edge.source)) organizations.set(edge.source, { count: 0, parties: {} }); const row = organizations.get(edge.source); row.count++; const party = nodeMap.get(edge.target).party; row.parties[party] = (row.parties[party] || 0) + 1; }
    $('[data-sna-heatmap]').innerHTML = `<div class="table-wrap" tabindex="0" role="region" aria-label="${tr('Eduskuntaryhmämatriisi, vieritä sivusuunnassa', 'Partimatris, rulla i sidled', 'Party matrix, scroll horizontally')}"><table><caption>${tr('Valittua pikavalintaa ja rajauksia tukevat yksilölliset organisaatio–edustajayhteydet, myös kartan rajatun otoksen ulkopuolelta.', 'Unika organisations–ledamotsrelationer som stöder valt snabbval och filter, även utanför kartans begränsade urval.', 'Unique organisation–MP ties supporting the selected preset and filters; includes ties outside the map’s display cap.')}</caption><thead><tr><th scope="col">${tr('Organisaatio', 'Organisation', 'Organisation')}</th>${parties.map(party => `<th scope="col">${e(party.toUpperCase())}</th>`).join('')}</tr></thead><tbody>${[...organizations].sort((a, b) => b[1].count - a[1].count).slice(0, 10).map(([id, row]) => `<tr><th scope="row"><button type="button" class="sna-entity-button" data-sna-inspect-node="${e(id)}">${e(nodeMap.get(id).name)}</button></th>${parties.map(party => `<td class="sna-heat-cell ${row.parties[party] ? 'sna-heat-filled' : ''}">${row.parties[party] || '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  async function ensureCanvas() {
    if (!canvasOpen || !display.edges.length || canvas || canvasPromise) return canvasPromise;
    canvasPromise = import('./transparency-canvas.js').then(({ createTransparencyCanvas }) => {
      if (!current() || !pageRoot.isConnected || !canvasOpen || !display.edges.length) return;
      canvas = createTransparencyCanvas($('[data-sna-canvas]'), { lang, onInspect: inspect, onExpand: expand });
      canvas.setView(canvasView(), { layout, metric });
      canvas.select(selected || focus.mp || focus.org || '');
      canvas.setHull(hulls);
    }).catch(() => { if (current() && pageRoot.isConnected) $('[data-sna-path-status]').textContent = tr('Karttaa ei voitu avata. Kaikki yhteydet ovat edelleen luettelossa.', 'Kartan kunde inte öppnas. Alla relationer finns i listan.', 'Could not open the canvas. All connections are available in the list.'); }).finally(() => { canvasPromise = null; });
    return canvasPromise;
  }
  function canvasView() {
    const coordinates = graph.layouts?.[preset] || {};
    return { ...display, focus: focusIds(), nodes: display.nodes.map(node => ({ ...node, initialX: coordinates[node.id]?.x ?? node.initialX, initialY: coordinates[node.id]?.y ?? node.initialY })) };
  }
  function updatePathOptions() {
    const labels = display.nodes.map(node => `${node.name} · ${typeLabel(node)}`);
    const counts = new Map();
    for (const label of labels) counts.set(label, (counts.get(label) || 0) + 1);
    pathOptions = new Map(labels.map((label, i) => {
      const node = display.nodes[i];
      return [counts.get(label) > 1 ? `${label} · ${node.yTunnus || node.id}` : label, node.id];
    }));
    $('#sna-node-options').innerHTML = [...pathOptions.keys()].map(label => `<option value="${e(label)}"></option>`).join('');
  }
  function redraw(animate = false) {
    if (!current() || !pageRoot.isConnected) return;
    const focused = focusIds(), key = JSON.stringify(focused);
    if (key !== candidateIds) {
      candidateIds = key;
      candidates = transparencyFocusEdges(graph.edges, focused);
    }
    const filterKey = JSON.stringify([key, state.query, state.minWeight, state.inferred, state.facets]);
    if (filterKey !== lastFilter) {
      lastFilter = filterKey;
      filtered = filterTransparencyGraph({ ...graph, edges: candidates }, state);
    }
    display = selectTransparencyView(graph, filtered, { preset, expanded, pruned, focus: focused, layout, actorLimit: actorLimit() });
    const visibleActors = display.nodes.filter(node => node.type === 'mp' || node.type === 'org').length;
    const actorCountText = tr(`Kartalla ${number(visibleActors)} / ${number(display.actorCount)} toimijaa`, `${number(visibleActors)} av ${number(display.actorCount)} aktörer på kartan`, `${number(visibleActors)} of ${number(display.actorCount)} actors on the map`);
    if ($('[data-sna-actor-count]').textContent !== actorCountText) $('[data-sna-actor-count]').textContent = actorCountText;
    const limitInput = $('[data-sna-actor-limit]');
    limitInput.disabled = showAllActors;
    if (document.activeElement !== limitInput || limitInput.value === '') limitInput.value = customActorLimit ?? defaultTransparencyActorLimit(preset, focused.length);
    $('[data-sna-all-actors]').checked = showAllActors;
    const context = focused.length ? focused.map(id => nodeMap.get(id).name).join(' ↔ ') : presetNames[preset][0];
    const message = `${number(display.filteredCount)} ${tr('yhteyttä', 'relationer', 'ties')} · ${context}`;
    if ($('[data-sna-status]').textContent !== message) $('[data-sna-status]').textContent = message;
    const active = activeFilterCount(state) + Number(state.minWeight > 0) + Number(state.inferred !== defaultInferred());
    $('[data-sna-filter-count]').textContent = active ? tr(`${active} aktiivista rajausta`, `${active} aktiva filter`, `${active} active filters`) : tr('Vuosi, suhdetyyppi, eduskuntaryhmä ja muut rajaukset', 'År, relationstyp, riksdagsgrupp och andra filter', 'Year, relationship type, parliamentary group and more');
    $('[data-sna-no-results]').hidden = display.filteredCount > 0;
    $('[data-sna-empty-message]').textContent = display.filteredCount ? '' : describeEmpty(focused);
    $('[data-sna-reset-filters]').hidden = !active || (!!focused.length && !candidates.length);
    $('[data-sna-include-inferred]').hidden = !focused.length || !onlyInferred();
    $('[data-sna-map-count]').textContent = `${number(display.nodes.length)} ${tr('toimijaa', 'aktörer', 'actors')} / ${number(display.edges.length)} ${tr('yhteyttä', 'relationer', 'ties')}`;
    $('[data-sna-layout] option[value="force"]').textContent = focused.length ? tr('Toimijakeskeinen', 'Aktörscentrerad', 'Centred on actors') : tr('Voimakenttä', 'Kraftfält', 'Clustered force');
    $('[data-sna-layout-label]').textContent = $('[data-sna-layout]').selectedOptions[0].textContent;
    $('[data-sna-committee-legend]').hidden = !!focused.length || layout !== 'columns' || preset === 'bills';
    $('[data-sna-map-empty]').hidden = display.edges.length > 0;
    $('[data-sna-canvas]').inert = !display.edges.length;
    $('[data-sna-path-status]').textContent = ''; activePath = null;
    updatePathOptions();
    pageRoot.querySelectorAll('[data-sna-preset]').forEach(button => button.setAttribute('aria-pressed', !focused.length && button.dataset.snaPreset === preset));
    showDrawer();
    canvas?.setView(canvasView(), { layout, metric, animate });
    canvas?.select(selected || focused[0] || '');
    ensureCanvas(); renderRecords(); renderInsights(); persist();
  }
  function setCanvasOpen(value) {
    canvasOpen = value; $('[data-sna-stage]').hidden = !value; $('[data-sna-open]').setAttribute('aria-expanded', value); $('[data-sna-open]').textContent = value ? tr('Piilota kartta', 'Dölj kartan', 'Hide map') : tr('Avaa kartta', 'Öppna kartan', 'Open map');
    if (value) { const drawer = $('[data-sna-drawer]'); drawer.classList.remove('sna-standalone-drawer'); $('.sna-workspace').append(drawer); ensureCanvas().then(() => { canvas?.setHull(hulls); canvas?.fit(); }); } else { canvas?.destroy(); canvas = null; if (selected) { const drawer = $('[data-sna-drawer]'); drawer.classList.add('sna-standalone-drawer'); $('[data-sna-records]').before(drawer); } }
  }
  function onMobile(event) { if (event.matches && !focusIds().length) setCanvasOpen(false); }
  mobile.addEventListener('change', onMobile);
  pageRoot.addEventListener('click', event => { const node = event.target.closest('[data-sna-inspect-node]'), edge = event.target.closest('[data-sna-inspect-edge]'); if (node) inspect('node', node.dataset.snaInspectNode); if (edge) inspect('edge', edge.dataset.snaInspectEdge); });
  pageRoot.querySelectorAll('[data-sna-preset]').forEach(button => { button.onclick = () => choosePreset(button.dataset.snaPreset); });
  $('.sna-heatmap').ontoggle = () => { if ($('.sna-heatmap').open) renderHeatmap(disclosedForView()); };
  $('[data-sna-layout]').value = layout; $('[data-sna-layout]').onchange = event => { layout = event.target.value; redraw(true); };
  $('[data-sna-metric]').value = metric; $('[data-sna-metric]').onchange = event => { metric = event.target.value; canvas?.setMetric(metric); persist(); };
  const limitInput = $('[data-sna-actor-limit]');
  function changeActorLimit() {
    const nextLimit = parseActorLimit(limitInput.value);
    limitInput.value = nextLimit ?? defaultTransparencyActorLimit(preset, focusIds().length);
    if (customActorLimit === nextLimit) return;
    customActorLimit = nextLimit;
    redraw();
  }
  limitInput.onchange = changeActorLimit;
  limitInput.onkeydown = event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    limitInput.blur();
    limitInput.focus({ preventScroll: true });
  };
  $('[data-sna-all-actors]').onchange = event => { showAllActors = event.target.checked; redraw(); };
  $('[data-sna-hull]').onchange = event => { hulls = event.target.value; canvas?.setHull(hulls); };
  $('[data-sna-weight]').oninput = event => { state.minWeight = +event.target.value; $('[data-sna-weight-value]').value = number(state.minWeight, 1); page = 1; redraw(); };
  function changeInferred(checked) {
    inferredPreference = checked; syncInferred(); page = 1; redraw();
  }
  $('[data-sna-inferred]').onchange = event => changeInferred(event.target.checked);
  $('[data-sna-include-inferred]').onclick = () => {
    changeInferred(true);
    $('#sna-map-heading').tabIndex = -1;
    $('#sna-map-heading').focus({ preventScroll: true });
  };
  $('[data-sna-fit]').onclick = () => canvas?.fit(); $('[data-sna-open]').onclick = () => setCanvasOpen(!canvasOpen);
  const stage = $('[data-sna-stage]'), fullscreenButton = $('[data-sna-fullscreen]');
  stage.addEventListener('fullscreenchange', () => {
    fullscreenButton.textContent = document.fullscreenElement === stage
      ? tr('Poistu koko näytöstä', 'Stäng helskärm', 'Exit fullscreen')
      : tr('Koko näyttö', 'Helskärm', 'Fullscreen') + ' ↗';
  });
  fullscreenButton.onclick = async () => {
    try {
      if (document.fullscreenElement === stage) await document.exitFullscreen();
      else await stage.requestFullscreen();
    } catch {
      $('[data-sna-path-status]').textContent = tr('Koko näytön tila ei ole käytettävissä tässä selaimessa.', 'Helskärm är inte tillgängligt i denna webbläsare.', 'Fullscreen is unavailable in this browser.');
    }
  };
  $('[data-sna-prev]').onclick = () => { page--; renderRecords(); }; $('[data-sna-next]').onclick = () => { page++; renderRecords(); };
  pageRoot.querySelectorAll('[data-sna-list]').forEach(button => { button.onclick = () => { listMode = button.dataset.snaList; renderRecords(); }; });
  $('[data-sna-path]').onsubmit = event => {
    event.preventDefault();
    const form = event.currentTarget, lookup = value => {
      if (pathOptions.has(value)) return pathOptions.get(value);
      const matches = display.nodes.filter(node => node.name === value.trim());
      return matches.length === 1 ? matches[0].id : null;
    };
    const path = shortestTransparencyPath(display.nodes, display.edges, lookup(form.elements.from.value), lookup(form.elements.to.value)); activePath = path; canvas?.highlightPath(path);
    $('[data-sna-path-status]').textContent = path ? path.nodes.map(id => nodeMap.get(id).name).join(' → ') : tr('Enintään neljän askeleen ketjua ei löytynyt. Valitse molemmat toimijat kartan vaihtoehdoista.', 'Ingen kedja på högst fyra steg hittades. Välj båda aktörerna från kartans alternativ.', 'No path within four hops. Choose both actors from the current map’s suggestions.');
  };
  $('[data-sna-clear-path]').onclick = () => { $('[data-sna-path]').reset(); activePath = null; canvas?.highlightPath(null); $('[data-sna-path-status]').textContent = ''; };
  $('[data-sna-export]').onchange = async event => {
    const format = event.target.value; event.target.value = ''; if (!format) return;
    const exported = { snapshotId: manifest.id, asOf: graph.asOf, preset, layout, metric, filters: { ...state, expanded: [...expanded], pruned: [...pruned], focus: { ...focus }, actorLimit: actorLimit() }, appearance: { theme: document.documentElement.dataset.theme, hulls, selection: { kind: selectedKind, id: selected }, path: activePath, viewport: canvas?.viewport() }, method: graph.method, positions: canvas?.positions() || {}, nodes: display.nodes, edges: display.edges, sourceManifest: manifest, sourceGraph: `data/networks/transparency-${manifest.id}/graph.json` };
    try {
      const blob = format === 'png' ? await canvas.png() : new Blob([format === 'svg' ? canvas.svg({ snapshotId: manifest.id, preset, layout, filters: exported.filters }) : JSON.stringify(exported, null, 2)], { type: format === 'svg' ? 'image/svg+xml' : 'application/json' });
      const link = document.createElement('a'), url = URL.createObjectURL(blob); link.href = url; link.download = `vahtikissa-${preset}-${graph.asOf}.${format}`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { $('[data-sna-path-status]').textContent = tr('Vienti epäonnistui. Kokeile uudelleen kartan latauduttua.', 'Export misslyckades. Försök igen när kartan laddats.', 'Export failed. Try again after the map has loaded.'); }
  };
  $('[data-sna-method]').innerHTML = `<p>${tr('Verkostomittarit ja asettelu lasketaan aineiston rakennusvaiheessa. Suodatus muuttaa näkyviä yhteyksiä; mittarit kuvaavat koko lähdeversiota. PageRank kuvaa verkoston keskeisyyttä, ei mitattua poliittista vaikutusvaltaa.', 'Nätverksmått och layout beräknas vid databygget. Filter ändrar synliga relationer, medan måtten gäller hela versionen. PageRank beskriver centralitet, inte uppmätt politiskt inflytande.', 'Metrics and layout are computed offline. Filters change visible ties; centralities describe the complete snapshot. PageRank measures network prominence, not demonstrated political influence.')}</p><p>${tr('Organisaatiot yhdistetään Y-tunnuksella tai yksikäsitteisellä normalisoidulla nimellä. Henkilövastaanottajat yhdistetään täsmällisellä yksikäsitteisellä nimellä. Luokittelu ja roolitekstin erottelu ovat automaattisia; tarkista alkuperäisilmoitus.', 'Organisationer matchas med FO-nummer eller entydigt normaliserat namn. Personmottagare matchas med exakt entydigt namn. Klassificering och rolltolkning är automatiska; kontrollera originalet.', 'Organisations match by business ID or an unambiguous normalized name. People match by unique exact full name. Categories and extracted role text are automatic; inspect the source record.')}</p><p>${tr(`Jäsentämättä jäi ${number(graph.coverage.omittedInterests)} sidonnaisuus- tai tuloilmoitusta. Näihin kuuluu myös omaisuus- ja velkatietoja. Kohdistamatta jäi ${number(graph.coverage.unresolvedTargets)} vastaanottajamainintaa. Valiokuntajohdannaisia on ${number(graph.coverage.inferredCommitteeAssociations)}.`, `${number(graph.coverage.omittedInterests)} bindnings- eller inkomstposter utelämnades. ${number(graph.coverage.unresolvedTargets)} mottagarreferenser kunde inte matchas. ${number(graph.coverage.inferredCommitteeAssociations)} utskottskopplingar är härledda.`, `${number(graph.coverage.omittedInterests)} interest or income records were not parsed, including assets and debts. ${number(graph.coverage.unresolvedTargets)} target references were not matched. ${number(graph.coverage.inferredCommitteeAssociations)} committee associations are inferred.`)}</p><p>${tr('Hallituspuolueet aineistopäivänä', 'Regeringspartier på datadatumet', 'Government parties at snapshot')}: ${e(graph.method.government.parties.map(party => party.toUpperCase()).join(', '))}. ${tr('Johdettu lähdeaineiston ministerijaksoista. Tämä ei kuvaa historiallista hallitusasemaa koko ilmoituskauden aikana.', 'Härlett från ministerperioder i källan, inte historisk regeringsställning under hela perioden.', 'Derived from ministerial terms in the source, rather than historical bloc membership throughout each reporting period.')}</p><p>${tr('Lähdeversio', 'Källversion', 'Snapshot')}: <code>${e(manifest.id)}</code> · CC BY 4.0</p><details><summary>${tr('Laskentamenetelmien tekninen kuvaus', 'Teknisk metodbeskrivning', 'Technical methods')}</summary><pre>${e(JSON.stringify(graph.method, null, 2))}</pre></details><a href="./data/networks/${e(manifest.graphFile)}" download>${tr('Lataa koko esilaskettu verkosto (JSON)', 'Ladda ner hela nätverket (JSON)', 'Download full precomputed graph (JSON)')} ↗</a>`;
  redraw(); setCanvasOpen(canvasOpen);
}
