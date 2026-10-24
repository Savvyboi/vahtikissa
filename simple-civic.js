import { programmeAITags, decorateAI } from './ai-insights-app.js';
import { foldFilterToolbars } from './filter-panels.js';
import { escapeHTML as e, fetchJSONWithTimeout } from './app-utils.js';
import { budgetLevel, budgetClosestPath, budgetTotals, budgetEntries, searchBudgetEntries } from './budget-utils.js';
import { filterElectionCandidates } from './civic-utils.js';
import { influenceSelection, readInfluenceURL, syncInfluenceURL, influenceControls, bindInfluenceControls, influenceConfig, selectInfluence, memberNameLink, influenceTargetLink } from './influence-controls.js';
import { collectionState } from './collection-tools.js';
import { preserveFocus } from './collection-tools.js';

// The simple view shares the detailed view's source data and route addresses.
const cache = new Map(), renders = new WeakMap(), budgetStates = new Map(), influenceStates = new Map();
const electionState = { query: '', party: 'all', district: 'all', page: 1 };
const programmeState = { query: '', language: 'all', type: 'all', party: 'all' };
const PAGE_SIZE = 20;
async function load(file) {
  if (!cache.has(file)) cache.set(file, fetchJSONWithTimeout('./data/' + file + '.json').catch(error => { cache.delete(file); throw error; }));
  return cache.get(file);
}
const locale = lang => lang === 'en' ? 'en-GB' : lang === 'sv' ? 'sv-FI' : 'fi-FI';
const number = (value, lang, digits = 0) => new Intl.NumberFormat(locale(lang), { maximumFractionDigits: digits }).format(Number(value) || 0);
const local = (value, lang) => typeof value === 'object' && value ? value[lang] || value.fi || value.sv || '' : value || '';
const unique = values => [...new Set(values.filter(value => value !== undefined && value !== null && value !== ''))];
const nameOf = member => ((member.firstName || '') + ' ' + (member.lastName || '')).trim();
const languageOf = value => ({ FI: 'Suomi', SV: 'Svenska', EN: 'English' })[value] || value;
const textFor = lang => (fi, sv, en) => lang === 'en' ? en : lang === 'sv' ? sv : fi;
const date = (value, lang) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? String(value) : new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'long', year: 'numeric' }).format(parsed);
};
const money = (value, lang, compact = false) => {
  const amount = Number(value) || 0;
  if (compact && Math.abs(amount) >= 1e9) return number(amount / 1e9, lang, 1) + ' ' + (lang === 'en' ? 'bn €' : lang === 'sv' ? 'md €' : 'mrd. €');
  if (compact && Math.abs(amount) >= 1e6) return number(amount / 1e6, lang, 1) + ' ' + (lang === 'en' ? 'm €' : lang === 'sv' ? 'mn €' : 'milj. €');
  return new Intl.NumberFormat(locale(lang), { style: 'currency', currency: 'EUR', maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount);
};
function hero(L, eyebrow, title, lead) {
  return `<header class="easy-hero"><p class="easy-eyebrow">${e(eyebrow)}</p><h1>${e(title)}</h1><p class="easy-lead">${e(lead)}</p></header>`;
}
function fullButton(L) {
  return `<button type="button" class="easy-link" data-full-view>${L('Avaa laaja näkymä', 'Öppna den detaljerade vyn', 'Open the detailed view')} →</button>`;
}
function sourceNote(metadata, lang, L, sources, detail = '') {
  return `<aside class="easy-note" aria-label="${L('Lähteet ja päivitys', 'Källor och uppdatering', 'Sources and update')}"><p>${L('Tiedot päivitetty', 'Uppgifterna uppdaterade', 'Data updated')} ${e(date(metadata?.generatedAt, lang))}.${detail ? ' ' + e(detail) : ''}</p><div class="easy-choices">${sources.map(([label, url]) => `<a class="easy-link" href="${e(url)}" target="_blank" rel="noreferrer">${e(label)} ↗</a>`).join('')}</div></aside>`;
}
function options(values, selected, all, display = value => value) {
  return `<option value="all">${e(all)}</option>${values.map(value => `<option value="${e(value)}"${String(value) === String(selected) ? ' selected' : ''}>${e(display(value))}</option>`).join('')}`;
}
const field = (label, control) => `<label class="easy-field"><span>${e(label)}</span>${control}</label>`;
const empty = L => `<p class="easy-empty">${L('Näillä valinnoilla ei löytynyt tietoja. Kokeile toista hakua tai poista rajauksia.', 'Inga uppgifter hittades. Prova en annan sökning eller ta bort avgränsningar.', 'No records found. Try another search or clear the filters.')}</p>`;
function pages(items, state, lang, L) {
  const count = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  state.page = Math.max(1, Math.min(state.page || 1, count));
  const start = (state.page - 1) * PAGE_SIZE;
  return {
    shown: items.slice(start, start + PAGE_SIZE),
    count: `<p class="easy-results" role="status" aria-live="polite">${number(items.length, lang)} ${L('tulosta', 'resultat', 'results')}${items.length ? ' · ' + number(start + 1, lang) + '–' + number(Math.min(start + PAGE_SIZE, items.length), lang) : ''}</p>`,
    controls: count > 1 ? `<nav class="easy-pagination" aria-label="${L('Tulossivut', 'Resultatsidor', 'Result pages')}"><button type="button" data-easy-page="${state.page - 1}"${state.page === 1 ? ' disabled' : ''}>← ${L('Edelliset', 'Föregående', 'Previous')}</button><span>${L('Sivu', 'Sida', 'Page')} ${state.page} / ${count}</span><button type="button" data-easy-page="${state.page + 1}"${state.page === count ? ' disabled' : ''}>${L('Seuraavat', 'Nästa', 'Next')} →</button></nav>` : ''
  };
}
function bindPages(root, state, draw) {
  root.querySelectorAll('[data-easy-page]').forEach(button => button.onclick = () => { state.page = Number(button.dataset.easyPage); preserveFocus(root, draw); });
}
function bindFilters(root, state, draw) {
  foldFilterToolbars(root, document.documentElement.lang);
  root.querySelectorAll('[data-easy-filter]').forEach(control => {
    control.addEventListener(control.type === 'search' ? 'input' : 'change', () => {
      state[control.dataset.easyFilter] = control.value; state.page = 1; preserveFocus(root, draw);
    });
  });
}
const expenseNames = {
  '21': ['Eduskunta', 'Riksdagen', 'Parliament'], '22': ['Tasavallan presidentti', 'Republikens president', 'President of the Republic'],
  '23': ['Valtioneuvosto', 'Statsrådet', 'Government'], '24': ['Ulkoasiat', 'Utrikesfrågor', 'Foreign affairs'],
  '25': ['Oikeus', 'Rättsväsende', 'Justice'], '26': ['Sisäinen turvallisuus', 'Inre säkerhet', 'Internal security'],
  '27': ['Puolustus', 'Försvar', 'Defence'], '28': ['Valtiovarainministeriön menot', 'Finansministeriets utgifter', 'Ministry of Finance spending'],
  '29': ['Koulutus ja kulttuuri', 'Utbildning och kultur', 'Education and culture'], '30': ['Maa- ja metsätalous', 'Jord- och skogsbruk', 'Agriculture and forestry'],
  '31': ['Liikenne ja viestintä', 'Trafik och kommunikation', 'Transport and communications'], '32': ['Työ ja elinkeinot', 'Arbete och näringsliv', 'Employment and the economy'],
  '33': ['Sosiaali- ja terveys', 'Social- och hälsovård', 'Social affairs and health'], '35': ['Ympäristö', 'Miljö', 'Environment'],
  '36': ['Valtionvelan korot ja muut menot', 'Räntor och andra utgifter för statsskulden', 'Interest and other public debt costs']
};
const incomeNames = { '11': ['Verot', 'Skatter', 'Taxes'], '12': ['Muut tulot', 'Övriga inkomster', 'Other income'], '13': ['Korkotulot ja voitot', 'Ränteinkomster och vinster', 'Interest income and profits'], '15': ['Lainat', 'Lån', 'Loans'] };
const budgetPath = (year, type, codes = []) => '#/budget/' + [year, type, ...codes].join('/');
function renderBudget(root, snapshot, { lang, route }, isCurrent) {
  const L = textFor(lang), routeParts = String(route.id || '').split('/').filter(Boolean);
  const years = [...snapshot.years].sort((a, b) => a.year - b.year);
  const foundYear = years.find(item => String(item.year) === routeParts[0]), year = foundYear || years.at(-1);
  const type = routeParts[1] === 'income' ? 'income' : 'expense', codes = routeParts.slice(2);
  const level = routeParts[0] && !foundYear ? { valid: false, items: [], node: null } : budgetLevel(year, type, codes);
  const key = [year.year, type, ...codes].join('/');
  if (!budgetStates.has(key)) budgetStates.set(key, { query: '', page: 1 });
  const state = budgetStates.get(key), totals = budgetTotals(year), total = totals[type], names = type === 'expense' ? expenseNames : incomeNames;
  const label = item => item?.code?.length === 2 && names[item.code] ? L(...names[item.code]) : local(item?.name, lang);
  const official = item => `<span lang="${item?.name?.[lang] ? lang : 'fi'}">${e(local(item?.name, lang))}</span>`;
  const borrowing = budgetEntries(year, 'income').find(item => item.code === '150301')?.budget;
  function draw() {
    if (!isCurrent()) return;
    const searching = Boolean(state.query.trim());
    const pool = searching ? budgetEntries(year, type) : level.items.map(item => ({ ...item, path: [...codes, item.code] }));
    const searchLabel = item => ({ ...item, name: { ...item.name, en: [item.name?.en, ...(names[item.code] || [])].filter(Boolean).join(' ') } });
    const searched = searchBudgetEntries(pool.map(item => ({ ...searchLabel(item), ancestors: (item.ancestors || []).map(searchLabel), source: item })), state.query).map(item => item.source);
    const filtered = searched.sort((a, b) => (Number(b.budget) || 0) - (Number(a.budget) || 0)), pagination = pages(filtered, state, lang, L);
    const breadcrumbs = codes.map((code, index) => {
      const node = budgetLevel(year, type, codes.slice(0, index + 1)).node;
      return node ? `<a href="${budgetPath(year.year, type, codes.slice(0, index + 1))}">${e(label(node))}</a>` : '';
    }).filter(Boolean);
    const title = type === 'expense' ? L('Mihin valtion rahat menevät?', 'Vart går statens pengar?', 'Where does the state spend its money?') : L('Mistä valtion rahat tulevat?', 'Varifrån kommer statens pengar?', 'Where does the state get its money?');
    root.innerHTML = `<div class="easy-page">${hero(L, L('Yhteiset rahat', 'Våra gemensamma pengar', 'Our public money'), title, L('Budjetti on valtion rahasuunnitelma yhdelle vuodelle. Valitse vuosi ja avaa aihe, joka kiinnostaa sinua.', 'Budgeten är statens plan för pengarna under ett år. Välj år och öppna ett ämne som intresserar dig.', 'The budget is the state’s money plan for one year. Choose a year and open a topic that interests you.'))}
      <div class="easy-toolbar">${field(L('Vuosi', 'År', 'Year'), `<select data-easy-budget-year>${[...years].reverse().map(item => `<option value="${item.year}"${item.year === year.year ? ' selected' : ''}>${item.year}</option>`).join('')}</select>`)}<nav class="easy-choices" aria-label="${L('Menot ja tulot', 'Utgifter och inkomster', 'Spending and income')}"><a href="${budgetPath(year.year, 'expense')}"${type === 'expense' ? ' aria-current="page"' : ''}>${L('Mihin rahat menevät', 'Vart pengarna går', 'Money going out')}</a><a href="${budgetPath(year.year, 'income')}"${type === 'income' ? ' aria-current="page"' : ''}>${L('Mistä rahat tulevat', 'Varifrån pengarna kommer', 'Money coming in')}</a></nav></div>
      <div class="easy-stats"><article><span>${L('Suunnitellut menot', 'Planerade utgifter', 'Planned spending')} · ${year.year}</span><strong title="${e(money(totals.expense, lang))}">${e(money(totals.expense, lang, true))}</strong></article><article><span>${L('Tulot ja lainat yhteensä', 'Inkomster och lån totalt', 'Income and loans combined')}</span><strong title="${e(money(totals.income, lang))}">${e(money(totals.income, lang, true))}</strong></article>${Number.isFinite(borrowing) ? `<article><span>${L('Nettolainanotto', 'Nettoupplåning', 'Net borrowing')}</span><strong title="${e(money(borrowing, lang))}">${e(money(borrowing, lang, true))}</strong></article>` : ''}</div>
      <div class="easy-callout"><p>${L('Luvut ovat vuoden talousarviosta lisäbudjetteineen. Ne kertovat suunnitelmasta, eivät lopullisesta kulutuksesta. Nettolainanotto tarkoittaa uutta lainaa vähennettynä takaisin maksetuilla lainoilla.', 'Siffrorna kommer från årets budget inklusive tilläggsbudgetar. De visar planen, inte de slutliga utgifterna. Nettoupplåning betyder nya lån minus återbetalda lån.', 'These figures come from the annual budget, including supplementary budgets. They show the plan, rather than final spending. Net borrowing means new loans minus repayments.')}</p></div>
      <section class="easy-section"><nav class="easy-breadcrumb" aria-label="${L('Budjetin sijainti', 'Plats i budgeten', 'Budget location')}"><a href="${budgetPath(year.year, type)}">${L('Koko vuosi', 'Hela året', 'Whole year')} ${year.year}</a>${breadcrumbs.map(value => ' <span aria-hidden="true">/</span> ' + value).join('')}</nav><div class="easy-section-head"><h2>${searching ? L('Hakutulokset koko vuodelta', 'Sökresultat för hela året', 'Search results for the whole year') : level.node ? e(label(level.node)) : L('Avaa yksi aihe', 'Öppna ett ämne', 'Open a topic')}</h2>${fullButton(L)}</div>
      ${level.node && !searching ? `<div class="easy-detail"><p class="easy-meta">${official(level.node)} · ${e(level.node.code)}</p><p><strong>${e(money(level.node.budget, lang))}</strong> ${L('vuoden suunnitelmassa', 'i årets plan', 'in the annual plan')}</p>${Number.isFinite(level.node.actual) ? `<p class="easy-meta">${L('Toteutunut summa aineistossa', 'Utfall i materialet', 'Actual amount in the data')} (${year.year}, ${L('kuukausi', 'månad', 'month')} ${year.latestMonth}): ${e(money(level.node.actual, lang))}. ${year.latestMonth < 12 ? L('Vuosi on tässä aineistossa kesken.', 'Året är ofullständigt i detta material.', 'This is a partial year in this dataset.') : ''}</p>` : ''}</div>` : ''}
      ${level.valid ? `<div class="easy-toolbar">${field(L('Hae budjetista', 'Sök i budgeten', 'Search the budget'), `<input type="search" data-easy-filter="query" value="${e(state.query)}" placeholder="${L('Esimerkiksi koulutus, asumistuki tai puolustus', 'Till exempel utbildning, bostadsbidrag eller försvar', 'For example education, housing or defence')}">`)}</div>${searching ? `<p class="easy-note">${L('Haku näyttää myös aiheiden alakohtia. Pääkohta sisältää alakohtiensa rahat: summia ei pidä laskea yhteen.', 'Sökningen visar också underposter. En huvudpost innehåller sina underposters pengar: summera dem inte.', 'Search includes subcategories. A parent category already contains its children’s money: do not add them together.')}</p>` : ''}${pagination.count}<div class="easy-grid">${pagination.shown.map(item => {
        const share = total ? Number(item.budget) / total * 100 : 0;
        return `<article class="easy-card"><p class="easy-eyebrow">${e(item.code.match(/.{1,2}/g)?.join('.') || item.code)}</p><h3><a href="${budgetPath(year.year, type, item.path)}">${e(label(item))}</a></h3><p><strong title="${e(money(item.budget, lang))}">${e(money(item.budget, lang, true))}</strong></p>${item.name?.[lang] || lang === 'fi' ? '' : `<p class="easy-meta">${official(item)}</p>`}<div class="easy-bar" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, share))}%"></span></div><p class="easy-meta">${number(share, lang, 1)} % ${type === 'expense' ? L('vuoden menoista', 'av årets utgifter', 'of annual spending') : L('vuoden tuloista ja lainoista', 'av årets inkomster och lån', 'of annual income and loans')}</p><a class="easy-link" href="${budgetPath(year.year, type, item.path)}">${item.children?.length ? L('Katso, miten summa jakautuu', 'Se hur beloppet fördelas', 'See how this amount is divided') : L('Katso budjettikohta', 'Visa budgetposten', 'View this budget item')} →</a></article>`;
      }).join('') || (level.node && !searching ? `<p class="easy-note">${L('Tämä on aineiston tarkin taso. Voit palata ylemmäs yllä olevista linkeistä.', 'Detta är materialets mest detaljerade nivå. Länkarna ovan tar dig uppåt.', 'This is the most detailed level in the data. Use the links above to go back up.')}</p>` : empty(L))}</div>${pagination.controls}` : `<p class="easy-empty">${L('Tätä budjettikohtaa ei löytynyt.', 'Budgetposten hittades inte.', 'This budget item was not found.')} <a href="${budgetPath(year.year, type)}">${L('Avaa koko vuosi', 'Öppna hela året', 'Open the whole year')} →</a></p>`}</section>
      ${sourceNote(snapshot.metadata, lang, L, [[L('Valtiokonttorin lähdeaineisto', 'Statskontorets källdata', 'State Treasury source data'), snapshot.metadata.source]], L('Yksityiskohtaiset nimet säilyvät lähteen kielellä. Valtion budjetti ei kata kaikkia kuntien tai muiden julkisten toimijoiden menoja.', 'Detaljerade namn behåller källans språk. Statsbudgeten omfattar inte alla utgifter hos kommuner eller andra offentliga aktörer.', 'Detailed labels retain the source language. The state budget does not cover all spending by municipalities or other public bodies.'))}</div>`;
    bindFilters(root, state, draw); bindPages(root, state, draw);
    root.querySelector('[data-easy-budget-year]').onchange = event => {
      const next = years.find(item => String(item.year) === event.target.value);
      location.hash = budgetPath(next.year, type, budgetClosestPath(next, type, codes));
    };
  }
  draw();
}
function renderElections(root, snapshot, { lang, data }, isCurrent) {
  const L = textFor(lang), state = electionState;
  function draw() {
    if (!isCurrent()) return;
    const candidates = filterElectionCandidates(snapshot.candidates || [], state), pagination = pages(candidates, state, lang, L);
    root.innerHTML = `<div class="easy-page">${hero(L, L('Näin eduskunta valittiin', 'Så valdes riksdagen', 'How Parliament was elected'), L('Eduskuntavaalit 2023', 'Riksdagsvalet 2023', 'The 2023 parliamentary election'), L('Äänestäjät valitsevat eduskuntaan 200 edustajaa. Tässä näet puolueiden tulokset ja vaaleissa valitut ihmiset.', 'Väljarna väljer 200 ledamöter till riksdagen. Här ser du partiernas resultat och vilka personer som valdes.', 'Voters elect 200 people to Parliament. Here are the party results and the people elected.'))}
      <div class="easy-stats"><article><span>${L('Äänestysprosentti', 'Valdeltagande', 'Turnout')}</span><strong>${number(snapshot.summary.turnout, lang, 1)} %</strong></article><article><span>${L('Äänestäneitä', 'Personer som röstade', 'People who voted')}</span><strong>${number(snapshot.summary.voters, lang)}</strong></article><article><span>${L('Paikkoja eduskunnassa', 'Platser i riksdagen', 'Seats in Parliament')}</span><strong>${number(snapshot.summary.seats, lang)}</strong></article></div>
      <p class="easy-note">${L('Äänestysprosentti on koko maan luku: mukana ovat myös ulkomailla asuvat äänioikeutetut. Vaalitulos kertoo vuoden 2023 tilanteesta. Eduskunnan kokoonpano voi muuttua vaalien jälkeen.', 'Valdeltagandet gäller hela landet och inkluderar röstberättigade som bor utomlands. Resultatet visar valet 2023. Riksdagens sammansättning kan ändras efter valet.', 'Turnout covers all eligible voters, including those living abroad. These are the 2023 election results. The membership of Parliament can change after an election.')}</p>
      <section class="easy-section"><div class="easy-section-head"><h2>${L('Miten paikat jakautuivat?', 'Hur fördelades platserna?', 'How were the seats divided?')}</h2>${fullButton(L)}</div><p>${L('Äänet ovat äänestäjien antamia ääniä. Paikat kertovat, montako edustajaa ryhmä sai eduskuntaan.', 'Röster är väljarnas avgivna röster. Platser visar hur många ledamöter gruppen fick i riksdagen.', 'Votes are the ballots cast by voters. Seats show how many people a group won in Parliament.')}</p><div class="easy-grid">${snapshot.parties.map(party => `<article class="easy-card"><h3>${e(local(party.name, lang))}</h3><p><strong>${number(party.seats, lang)}</strong> ${L('paikkaa', 'platser', 'seats')}</p><div class="easy-bar" aria-hidden="true"><span style="width:${Math.max(0, Math.min(100, party.seats / snapshot.summary.seats * 100))}%"></span></div><p class="easy-meta">${number(party.votes, lang)} ${L('ääntä', 'röster', 'votes')} · ${number(party.share, lang, 1)} % ${L('äänistä', 'av rösterna', 'of votes')}</p></article>`).join('')}</div></section>
      <section class="easy-section"><h2>${L('Ketkä valittiin?', 'Vilka valdes?', 'Who was elected?')}</h2><div class="easy-toolbar">${field(L('Hae valittua edustajaa', 'Sök en invald ledamot', 'Search elected candidates'), `<input type="search" data-easy-filter="query" value="${e(state.query)}" placeholder="${L('Nimi tai vaalipiiri', 'Namn eller valkrets', 'Name or constituency')}">`)}${field(L('Puolue', 'Parti', 'Party'), `<select data-easy-filter="party">${options(snapshot.parties.map(item => item.code), state.party, L('Kaikki puolueet', 'Alla partier', 'All parties'), code => local(snapshot.parties.find(item => item.code === code).name, lang))}</select>`)}${field(L('Vaalipiiri', 'Valkrets', 'Constituency'), `<select data-easy-filter="district">${options(snapshot.districts.map(item => item.code), state.district, L('Kaikki vaalipiirit', 'Alla valkretsar', 'All constituencies'), code => local(snapshot.districts.find(item => item.code === code).name, lang))}</select>`)}</div>${pagination.count}<div class="easy-grid">${pagination.shown.map(candidate => `<article class="easy-card"><h3>${memberNameLink({},data?.members||[],candidate.name)}</h3><p>${e(local(candidate.party, lang))} · ${e(local(candidate.district, lang))}</p><p><strong>${number(candidate.votes, lang)}</strong> ${L('henkilökohtaista ääntä', 'personliga röster', 'personal votes')}</p></article>`).join('') || empty(L)}</div>${pagination.controls}</section>
      ${sourceNote(snapshot.metadata, lang, L, [[L('Tilastokeskuksen vaalitilastot', 'Statistikcentralens valstatistik', 'Statistics Finland election data'), snapshot.metadata.source]])}</div>`;
    bindFilters(root, state, draw); bindPages(root, state, draw);
  }
  draw();
}
const methodNames = {
  meeting: ['Tapaaminen', 'Möte', 'Meeting'], phone: ['Puhelu', 'Telefonsamtal', 'Phone call'], mail: ['Sähköposti', 'E-post', 'Email'],
  social_media: ['Sosiaalinen media', 'Sociala medier', 'Social media'], event: ['Tilaisuus', 'Evenemang', 'Event'],
  online: ['Verkkotapaaminen', 'Distansmöte', 'Online meeting'], other: ['Muu tapa', 'Annat sätt', 'Other method']
};
const partyNames = {
  kok: ['Kokoomus', 'Samlingspartiet', 'National Coalition'], ps: ['Perussuomalaiset', 'Sannfinländarna', 'Finns Party'], sd: ['SDP', 'SDP', 'Social Democrats'],
  kesk: ['Keskusta', 'Centern', 'Centre Party'], vihr: ['Vihreät', 'De gröna', 'Greens'], vas: ['Vasemmistoliitto', 'Vänsterförbundet', 'Left Alliance'],
  r: ['RKP', 'SFP', 'Swedish People’s Party'], kd: ['Kristillisdemokraatit', 'Kristdemokraterna', 'Christian Democrats'], liik: ['Liike Nyt', 'Rörelse Nu', 'Movement Now'], sit: ['Sitoutumaton', 'Obunden', 'Independent']
};
const normalizeName = value => String(value || '').trim().toLocaleLowerCase('fi').replace(/\s+/g, ' ');
function prepareInfluence(snapshot, members) {
  const targets = new Map((snapshot.targets || []).map(target => [String(target.id), target]));
  const memberParties = new Map(members.map(member => [normalizeName(nameOf(member)), member.party]));
  for (const gift of snapshot.gifts || []) memberParties.set(normalizeName(gift.mpName), gift.party);
  const partyOf = target => {
    const named = memberParties.get(normalizeName(target.fi?.name || target.sv?.name));
    if (named) return named;
    const description = [target.fi?.department, target.sv?.department, target.fi?.organization, target.sv?.organization].filter(Boolean).join(' ');
    return [['kok', /kokoom|samlings/i], ['ps', /perussuom|sannfin/i], ['sd', /sosialidem|socialdem/i], ['kesk', /keskusta|centern/i], ['vihr', /vihre|gröna/i], ['vas', /vasemmist|vänster/i], ['r', /ruotsal|svenska folk/i], ['kd', /kristillis|kristdem/i], ['liik', /liike nyt|rörelse nu/i]].find(([, pattern]) => pattern.test(description))?.[0] || '';
  };
  return { ...snapshot, lobbying: (snapshot.lobbying || []).map(item => {
    const recipients = item.targets || (item.targetIds || []).map(id => targets.get(String(id))).filter(Boolean);
    return { ...item, targets: recipients, mpNames: unique(recipients.filter(target => target.kind === 'mp').map(target => target.fi?.name || target.sv?.name)), targetParties: unique(recipients.map(partyOf)) };
  }) };
}
const influenceFilterState = (mp = 'all') => ({ ...influenceSelection(mp), page: 1, moreOpen: false, extra: collectionState('date','desc') });
function renderInfluence(root, rawSnapshot, context, isCurrent) {
  const { lang, route, data } = context, members = data?.members || [], L = textFor(lang), snapshot = prepareInfluence(rawSnapshot, members);
  const routeKey = String(route.id || 'all'), focusedMember = members.find(member => String(member.id) === String(route.id));
  const focusedName = focusedMember ? nameOf(focusedMember) : [...snapshot.gifts, ...snapshot.interests].find(item => String(item.mpId) === String(route.id))?.mpName;
  if (!influenceStates.has(routeKey)) influenceStates.set(routeKey, { tab: route.id ? 'interests' : 'gifts', tabs: Object.fromEntries(['gifts', 'interests', 'lobbying'].map(tab => [tab, influenceFilterState(focusedName || 'all')])) });
  const view = influenceStates.get(routeKey), selection=readInfluenceURL(location.hash,focusedName||'all');
  view.tab=selection.tab;view.hasDrawn=false;Object.assign(view.tabs[view.tab],selection.state,{extra:selection.extra});
  const tabLabel = tab => tab === 'gifts' ? L('Lahjat', 'Gåvor', 'Gifts') : tab === 'interests' ? L('Sidonnaisuudet ja tulot', 'Bindningar och inkomster', 'Interests and income') : L('Lobbaus', 'Lobbning', 'Lobbying');
  const partyLabel = code => partyNames[code] ? L(...partyNames[code]) : String(code || '').toUpperCase();
  const methodLabel = key => methodNames[key] ? L(...methodNames[key]) : key.replaceAll('_', ' ');
  const memberLink = item => memberNameLink(item,members);
  function draw() {
    if (!isCurrent()) return;
    const tab = view.tab, state = view.tabs[tab], lobby = tab === 'lobbying', gift = tab === 'gifts', source = snapshot[tab] || [];
    const mpNames = unique(source.flatMap(item => item.mpNames || [item.mpName])).sort((a, b) => a.localeCompare(b, lang));
    if (state.mp !== 'all' && !mpNames.includes(state.mp)) mpNames.unshift(state.mp);
    const parties = unique(source.flatMap(item => item.targetParties || [item.party])).sort((a, b) => partyLabel(a).localeCompare(partyLabel(b), lang));
    const extra=state.extra, config=influenceConfig(tab,lang);
    if(view.hasDrawn)syncInfluenceURL(root,tab,state,extra);
    view.hasDrawn=true;
    const filtered = selectInfluence(source,state,extra,config,tab,lang), pagination = pages(filtered, state, lang, L);
    const explanation = gift ? L('Kansanedustajat ilmoittavat saamiaan lahjoja ja etuja. Tässä näet, mitä he ovat ilmoittaneet, keneltä lahja tuli ja mikä sen ilmoitettu arvo on.', 'Ledamöterna anmäler gåvor och förmåner de fått. Här ser du vad de har anmält, vem gåvan kom från och dess anmälda värde.', 'MPs declare gifts and benefits they receive. Here you can see what they reported, who gave it and its declared value.') : lobby ? L('Lobbaus tarkoittaa yritystä vaikuttaa päätöksiin. Yritykset ja järjestöt ilmoittavat yhteydenpitoaan avoimuusrekisteriin. Yksi kortti näyttää yhden ilmoitetun aiheen, jolla voi olla useita kohteita.', 'Lobbning betyder försök att påverka beslut. Företag och organisationer anmäler kontakter till öppenhetsregistret. Ett kort visar ett anmält ämne, som kan ha flera mottagare.', 'Lobbying means trying to influence decisions. Businesses and organisations report contacts to the Transparency Register. Each card shows a reported topic, which may have several recipients.') : L('Sidonnaisuus voi olla esimerkiksi yritysomistus tai luottamustehtävä. Kansanedustajat ilmoittavat myös edustajantyön ulkopuolisia tulojaan. Tässä näet heidän omat ilmoituksensa.', 'En bindning kan vara till exempel företagsägande eller ett förtroendeuppdrag. Ledamöterna anmäler också inkomster utanför uppdraget. Här ser du deras egna anmälningar.', 'An interest can be a company holding or a position of trust. MPs also declare income outside their parliamentary work. These are their own declarations.');
    root.innerHTML = `<div class="easy-page">${hero(L, L('Päätöksenteon taustalla', 'Bakom besluten', 'Behind the decisions'), L('Lahjat, sidonnaisuudet ja lobbaus', 'Gåvor, bindningar och lobbning', 'Gifts, interests and lobbying'), L('Avoimuus auttaa kysymään parempia kysymyksiä. Tutki ilmoitettuja tietoja ja tarkista tarvittaessa alkuperäinen lähde.', 'Öppenhet hjälper oss att ställa bättre frågor. Undersök anmälda uppgifter och kontrollera originalkällan vid behov.', 'Transparency helps us ask better questions. Explore the declared information and check the original source when needed.'))}
      <div class="easy-choices" role="group" aria-label="${L('Valitse tiedot', 'Välj uppgifter', 'Choose records')}">${['gifts', 'interests', 'lobbying'].map(tabKey => `<button type="button" data-easy-influence-tab="${tabKey}" aria-pressed="${tab === tabKey}">${tabLabel(tabKey)}</button>`).join('')}</div>
      <section class="easy-section"><div class="easy-section-head"><h2>${tabLabel(tab)}</h2>${fullButton(L)}</div><p class="easy-lead">${e(explanation)}</p><div class="easy-callout"><p>${lobby ? L('Ilmoitettu yhteydenotto ei kerro, muuttiko se päätöstä. Rekisteri ei kata kaikkea yhteydenpitoa.', 'En anmäld kontakt visar inte om den ändrade ett beslut. Registret täcker inte all kontakt.', 'A reported contact does not tell us whether it changed a decision. The register does not cover every contact.') : L('Merkintä ei itsessään tarkoita väärinkäytöstä. Puuttuva merkintä ei todista, ettei lahjaa tai sidonnaisuutta ole.', 'En post betyder inte i sig att något olämpligt har hänt. En saknad post bevisar inte att en gåva eller bindning inte finns.', 'A record does not by itself mean wrongdoing. A missing record does not prove that a gift or interest does not exist.')} ${L('Viralliset kuvaukset säilyvät lähteen kielellä.', 'Officiella beskrivningar behåller källans språk.', 'Official descriptions retain the source language.')}</p></div>
      ${focusedName ? `<p class="easy-note">${L('Avasit edustajan tiedot', 'Du öppnade uppgifter för', 'You opened records for')}: <strong>${e(focusedName)}</strong>. <a href="#/influence">${L('Avaa kaikkien tiedot', 'Öppna alla uppgifter', 'Open everyone’s records')} →</a></p>` : route.id ? `<p class="easy-note">${L('Tällä tunnuksella ei löytynyt edustajaa. Näytetään kaikki tiedot.', 'Ingen ledamot hittades med denna kod. Alla uppgifter visas.', 'No MP was found with this ID. Showing all records.')}</p>` : ''}
      ${influenceControls(source,state,extra,tab,lang)}
      <details class="easy-detail" data-easy-influence-more${state.moreOpen ? ' open' : ''}><summary>${L('Lisää rajauksia', 'Fler avgränsningar', 'More filters')}</summary><div class="easy-toolbar">${field(L('Kansanedustaja','Ledamot','MP'),`<select data-easy-filter="mp">${options(mpNames,state.mp,L('Kaikki edustajat','Alla ledamöter','All MPs'))}</select>`)}${field(L('Puolue', 'Parti', 'Party'), `<select data-easy-filter="party">${options(parties, state.party, L('Kaikki puolueet', 'Alla partier', 'All parties'), partyLabel)}</select>`)}${lobby ? `${field(L('Ilmoittaja', 'Anmälare', 'Reporting organisation'), `<select data-easy-filter="actor">${options(unique(source.map(item => item.actor)).sort((a, b) => a.localeCompare(b, lang)), state.actor, L('Kaikki ilmoittajat', 'Alla anmälare', 'All organisations'))}</select>`)}${field(L('Yhteydenpitotapa', 'Kontaktform', 'Contact method'), `<select data-easy-filter="method">${options(unique(source.flatMap(item => item.methods || [])), state.method, L('Kaikki tavat', 'Alla former', 'All methods'), methodLabel)}</select>`)}${field(L('Toimiala', 'Bransch', 'Industry'), `<select data-easy-filter="category">${options(unique(source.map(item => item.industry)).sort((a, b) => a.localeCompare(b, lang)), state.category, L('Kaikki toimialat', 'Alla branscher', 'All industries'))}</select>`)}${field(L('Yhteydenoton kohde', 'Kontaktens mottagare', 'Recipient type'), `<select data-easy-filter="kind">${options(['mp', 'assistant', 'parliament'], state.kind, L('Kaikki kohteet', 'Alla mottagare', 'All recipients'), key => key === 'mp' ? L('Kansanedustaja', 'Ledamot', 'MP') : key === 'assistant' ? L('Avustaja', 'Assistent', 'Assistant') : L('Ryhmät ja eduskunta', 'Grupper och riksdagen', 'Groups and Parliament'))}</select>`)}` : ''}</div></details>
      <button type="button" class="easy-link" data-easy-clear>${L('Tyhjennä rajaukset', 'Rensa avgränsningarna', 'Clear filters')}</button>${pagination.count}<div class="easy-grid">${pagination.shown.map(item => gift ? `<article class="easy-card"><p class="easy-eyebrow">${item.year} · <span class="party-label" data-party="${e(item.party)}">${e(partyLabel(item.party))}</span></p><h3>${memberLink(item)}</h3><p>${e(lang === 'sv' ? item.descriptionSv || item.description : item.description)}</p><p><strong>${item.amount === null || item.amount === undefined ? L('Arvoa ei ilmoitettu', 'Värde inte anmält', 'Value not declared') : e(money(item.amount, lang))}</strong></p><p class="easy-meta">${L('Antaja', 'Givare', 'Donor')}: ${e(item.donor || '—')}</p><p class="easy-meta">${L('Ilmoituspäivä', 'Anmälningsdatum', 'Declaration date')}: ${e(item.reported || '—')}${item.used ? ' · ' + L('Käyttöaika', 'Användningstid', 'Period of use') + ': ' + e(item.used) : ''}</p>${item.raw ? `<details><summary>${L('Alkuperäinen ilmoitus', 'Originalanmälan', 'Original declaration')}</summary><p lang="${lang === 'sv' && item.raw.sv ? 'sv' : 'fi'}">${e(local(item.raw, lang))}</p></details>` : ''}</article>` : !lobby ? `<article class="easy-card"><p class="easy-eyebrow">${item.year} · ${item.type === 'income' ? L('Tuloilmoitus', 'Inkomstanmälan', 'Income declaration') : L('Sidonnaisuusilmoitus', 'Bindningsanmälan', 'Interest declaration')}</p><h3>${memberLink(item)}</h3><p class="easy-meta">${e(lang === 'sv' ? item.categorySv || item.category : item.category)} · ${e(partyLabel(item.party))}</p><p>${item.declared === false ? L('Ei ilmoitettavaa tässä kohdassa.', 'Inget att anmäla i denna post.', 'Nothing to declare in this category.') : e(lang === 'sv' ? item.descriptionSv || item.description : item.description)}</p></article>` : `<article class="easy-card"><p class="easy-eyebrow">${item.periodYear} · ${e(item.industry || L('Toimialaa ei ilmoitettu', 'Bransch inte anmäld', 'Industry not declared'))}</p><h3>${e(item.actor)}</h3><p>${e(item.topic || '—')}</p><p class="easy-meta"><strong>${L('Kohde', 'Mottagare', 'Recipient')}:</strong> ${(item.targets || []).slice(0, 3).map(target=>influenceTargetLink(target,members,lang)).filter(Boolean).join('; ') || '—'}${item.targets?.length > 3 ? ' · +' + (item.targets.length - 3) : ''}</p>${item.targets?.length > 3 ? `<details><summary>${L('Kaikki kohteet', 'Alla mottagare', 'All recipients')} (${item.targets.length})</summary><ul>${item.targets.map(target => `<li>${influenceTargetLink(target,members,lang)}</li>`).join('')}</ul></details>` : ''}<p class="easy-meta">${L('Tapa', 'Form', 'Method')}: ${e((item.methods || []).map(methodLabel).join(', ') || '—')}</p><p class="easy-meta">${L('Ilmoituskausi', 'Anmälningsperiod', 'Reporting period')}: ${e(item.period?.start || '—')}–${e(item.period?.end || '—')}</p>${item.customer ? `<p class="easy-meta">${L('Asiakas', 'Kund', 'Client')}: ${e(item.customer)}</p>` : ''}</article>`).join('') || empty(L)}</div>${pagination.controls}</section>
      ${sourceNote(snapshot.metadata, lang, L, [[lobby ? L('Avoimuusrekisteri', 'Öppenhetsregistret', 'Transparency Register') : L('Eduskunnan avoin data', 'Riksdagens öppna data', 'Parliamentary open data'), lobby ? 'https://www.avoimuusrekisteri.fi/' : 'https://api.eduskunta.fi/']], L('Tiedot perustuvat ilmoittajien omiin ilmoituksiin. Eri vuosien ja ilmoituslajien kattavuus voi vaihdella.', 'Uppgifterna bygger på anmälarnas egna anmälningar. Täckningen kan variera mellan år och typer av anmälningar.', 'The data is self-reported. Coverage can differ between years and types of declaration.'))}</div>`;
    root.querySelectorAll('[data-easy-influence-tab]').forEach(button => button.onclick = () => { view.tab = button.dataset.easyInfluenceTab; preserveFocus(root, draw); });
    bindInfluenceControls(root,state,extra,()=>{state.page=1;preserveFocus(root,draw)});
    bindFilters(root, state, draw); bindPages(root, state, draw);
    root.querySelector('[data-easy-influence-more]').ontoggle = event => { state.moreOpen = event.target.open; };
    root.querySelector('[data-easy-clear]').onclick = () => { Object.assign(state, influenceFilterState()); preserveFocus(root, draw); };
  }
  draw();
}
function renderProgrammes(root, snapshot, { lang }, isCurrent) {
  const L = textFor(lang), state = programmeState;
  state.party=new URLSearchParams(location.hash.split('?')[1]||'').get('party')||'all';
  const types = { vaaliohjelma: L('Vaaliohjelma', 'Valprogram', 'Election platform'), yleisohjelma: L('Periaateohjelma', 'Principprogram', 'Principles'), tavoiteohjelma: L('Tavoiteohjelma', 'Målprogram', 'Policy platform') };
  function draw() {
    if (!isCurrent()) return;
    const query = state.query.trim().toLocaleLowerCase('fi');
    const parties = snapshot.parties.filter(party=>state.party==='all'||party.code===state.party).map(party => ({ ...party, programmes: party.programmes.filter(programme => (state.language === 'all' || programme.language === state.language) && (state.type === 'all' || programme.type === state.type) && (!query || [party.name?.fi, party.name?.sv, party.code, programme.title, programme.year].some(value => String(value || '').toLocaleLowerCase('fi').includes(query)))) })).filter(party => party.programmes.length);
    const total = parties.reduce((sum, party) => sum + party.programmes.length, 0);
    root.innerHTML = `<div class="easy-page">${hero(L, L('Vaalikokoelma 2023', 'Valsamlingen 2023', '2023 election collection'), L('Mitä puolueet lupaavat?', 'Vad lovar partierna?', 'What do the parties promise?'), L('Puolueohjelma kertoo, mitä puolue haluaa tehdä. Näistä linkeistä pääset lukemaan puolueiden omat ohjelmat.', 'Ett partiprogram berättar vad partiet vill göra. Länkarna leder till partiernas egna program.', 'A party platform explains what a party wants to do. These links take you to the parties’ own documents.'))}
      <div class="easy-callout"><p>${L('Ohjelma kertoo tavoitteista, ei siitä, mitä on jo tehty. Kokoelma liittyy vuoden 2023 eduskuntavaaleihin ja sisältää myös vanhempia ohjelmia. Tarkista jokaisen ohjelman vuosi ja kieli.', 'Ett program beskriver mål, inte vad som redan har gjorts. Samlingen gäller riksdagsvalet 2023 och innehåller också äldre program. Kontrollera år och språk för varje dokument.', 'A platform describes goals, rather than what has already been done. This collection relates to the 2023 election and also contains older documents. Check the year and language of each document.')}</p></div>
      <section class="easy-section"><div class="easy-section-head"><h2>${L('Lue alkuperäiset ohjelmat', 'Läs originalprogrammen', 'Read the original platforms')}</h2>${fullButton(L)}</div><div class="easy-toolbar">${field(L('Haku', 'Sök', 'Search'), `<input type="search" data-easy-filter="query" value="${e(state.query)}" placeholder="${L('Puolue tai ohjelma', 'Parti eller program', 'Party or platform')}">`)}${field(L('Puolue','Parti','Party'),`<select data-easy-filter="party">${options(snapshot.parties.map(p=>p.code),state.party,L('Kaikki puolueet','Alla partier','All parties'),code=>local(snapshot.parties.find(p=>p.code===code).name,lang))}</select>`)}${field(L('Ohjelman kieli', 'Programmets språk', 'Document language'), `<select data-easy-filter="language">${options(['FI', 'SV', 'EN'], state.language, L('Kaikki kielet', 'Alla språk', 'All languages'), languageOf)}</select>`)}${field(L('Ohjelman tyyppi', 'Programtyp', 'Document type'), `<select data-easy-filter="type">${options(Object.keys(types), state.type, L('Kaikki ohjelmat', 'Alla program', 'All platforms'), key => types[key])}</select>`)}</div><p class="easy-results" role="status" aria-live="polite">${parties.length} ${L('puoluetta', 'partier', 'parties')} · ${total} ${L('ohjelmaa', 'program', 'platforms')}</p><div class="easy-grid">${parties.map(party => `<article class="easy-card"><h3>${e(local(party.name, lang))}</h3><ul>${party.programmes.map(programme => `<li><a class="easy-link" href="${e(programme.url)}" target="_blank" rel="noreferrer" lang="${e(programme.language.toLowerCase())}">${e(programme.title)} ↗</a><p class="easy-meta">${programme.year} · ${e(types[programme.type] || programme.type)} · ${e(languageOf(programme.language))} · ${L('Alkuperäinen lähde','Originalkälla','Original source')}: Pohtiva</p>${programmeAITags(programme.id,lang)}</li>`).join('')}</ul><a class="easy-link" href="#/parties/${encodeURIComponent(party.code)}">${L('Katso puolueen toiminta eduskunnassa', 'Se partiets arbete i riksdagen', 'See the party’s work in Parliament')} →</a></article>`).join('') || empty(L)}</div></section>
      ${sourceNote(snapshot.metadata, lang, L, [['Pohtiva', snapshot.metadata.source]], L('Mukana ovat tämän eduskunnan puolueet, joille Pohtivan vuoden 2023 vaalikokoelmassa on ohjelmia. Alkuperäisten asiakirjojen tekstejä ei ole yksinkertaistettu.', 'Här ingår den nuvarande riksdagens partier med program i Pohtivas valsamling för 2023. Originaldokumentens texter har inte förenklats.', 'Includes parties in the current Parliament with documents in Pohtiva’s 2023 election collection. The original documents have not been rewritten.'))}</div>`;
    bindFilters(root, state, draw);
    const partyControl=root.querySelector('[data-easy-filter="party"]');partyControl.addEventListener('change',()=>{const hash='#/programmes'+(state.party==='all'?'':'?party='+encodeURIComponent(state.party));history.replaceState(history.state,'',hash);root.dataset.route=hash;});
    decorateAI(root,{route:{page:'programmes'},lang});
  }
  draw();
}
function renderAbout(root, { lang, data }) {
  const L = textFor(lang);
  const definitions = [
    [L('Kansanedustaja', 'Riksdagsledamot', 'Member of Parliament'), L('Äänestäjien valitsema ihminen, joka päättää laeista ja valtion rahankäytöstä muiden edustajien kanssa.', 'En person som väljarna har valt och som beslutar om lagar och statens pengar tillsammans med andra ledamöter.', 'A person elected by voters who decides laws and state spending together with the other MPs.')],
    [L('Äänestys', 'Omröstning', 'Vote'), L('Edustajat valitsevat esitettyjen vaihtoehtojen välillä. Jaa ja ei tarkoittavat juuri kyseisen äänestyksen vaihtoehtoja. Ne eivät aina tarkoita koko lain kannattamista tai vastustamista.', 'Ledamöterna väljer mellan presenterade alternativ. Ja och nej avser alternativen i just den omröstningen. De betyder inte alltid stöd eller motstånd mot hela lagen.', 'MPs choose between the options put to them. Yes and no refer to that particular vote’s options. They do not always mean supporting or opposing an entire law.')],
    [L('Puheenvuoro', 'Anförande', 'Speech'), L('Edustajan puhe eduskunnan keskustelussa. Puheiden määrä kertoo osallistumisesta keskusteluun, ei puheiden laadusta tai vaikutuksesta.', 'Det en ledamot säger i riksdagens debatt. Antalet anföranden visar deltagande i debatten, inte deras kvalitet eller påverkan.', 'What an MP says during a parliamentary debate. The number of speeches describes participation in debate, rather than their quality or impact.')],
    [L('Lakiasia', 'Riksdagsärende', 'Parliamentary matter'), L('Eduskunnassa käsiteltävä asia, esimerkiksi lakiehdotus. Asian käsittely voi jatkua pitkään ja sisältää monta äänestystä.', 'Ett ärende som riksdagen behandlar, till exempel ett lagförslag. Behandlingen kan pågå länge och innehålla flera omröstningar.', 'A matter Parliament is considering, such as a proposed law. Its passage can take a long time and include several votes.')],
    [L('Osallistuminen', 'Deltagande', 'Participation'), L('Osuus kirjatuista äänestyksistä, joissa edustaja äänesti jaa, ei tai tyhjää. Poissa-merkintä ei kerro syytä. Taustalla voi olla esimerkiksi sairaus, ministeritehtävä tai sovittu äänestyspari.', 'Andelen registrerade omröstningar där ledamoten röstade ja, nej eller blankt. Frånvaro visar inte orsaken. Det kan till exempel gälla sjukdom, ministeruppdrag eller kvittning.', 'The share of recorded votes in which an MP voted yes, no or abstained. An absence does not tell us why: illness, ministerial duties or an agreed voting pair are possible reasons.')],
    [L('Ryhmälinja', 'Grupplinje', 'Party alignment'), L('Vertaa edustajan ääntä oman ryhmän tavallisimpaan ääneen samassa äänestyksessä. Poissaolot ja ryhmän tasatilanteet jätetään laskennasta pois. Luku ei arvioi työn laatua.', 'Jämför ledamotens röst med den vanligaste rösten i den egna gruppen i samma omröstning. Frånvaro och lika röstetal inom gruppen lämnas utanför. Siffran bedömer inte arbetets kvalitet.', 'Compares an MP’s vote with the most common vote in their group in the same division. Absences and ties within the group are excluded. It does not assess work quality.')]
  ];
  root.innerHTML = `<div class="easy-page">${hero(L, L('Avoin eduskunta', 'En öppen riksdag', 'An open Parliament'), L('Eduskunta, selkeästi', 'Riksdagen, tydligt', 'Parliament, clearly'), L('Vahtikissa kokoaa julkista tietoa eduskunnasta. Selkeä näkymä auttaa pääsemään alkuun. Laajassa näkymässä voit tutkia samoja tietoja tarkemmin.', 'Vaktkatt samlar offentlig information om riksdagen. Den tydliga vyn hjälper dig att komma igång. I den detaljerade vyn kan du undersöka samma uppgifter närmare.', 'Vahtikissa brings together public information about Finland’s Parliament. The simple view helps you get started. The detailed view lets you explore the same records further.'))}
    <div class="easy-callout"><p>${L('Vahtikissa on riippumaton avoimen lähdekoodin palvelu. Tilastot kuvaavat kirjattua toimintaa. Ne eivät yksin kerro, kuinka hyvin edustaja tekee työnsä.', 'Vaktkatt är en oberoende tjänst med öppen källkod. Statistiken beskriver registrerad aktivitet. Den visar inte ensam hur väl en ledamot gör sitt arbete.', 'Vahtikissa is an independent, open-source service. Its statistics describe recorded activity. On their own, they do not tell us how well an MP does their job.')}</p></div>
    <section class="easy-section"><div class="easy-section-head"><h2>${L('Mitä sanat tarkoittavat?', 'Vad betyder orden?', 'What do these words mean?')}</h2>${fullButton(L)}</div><div class="easy-grid">${definitions.map(([term, definition]) => `<article class="easy-card"><h3>${e(term)}</h3><p>${e(definition)}</p></article>`).join('')}</div></section>
    <section class="easy-section"><h2>${L('Mistä tiedot tulevat?', 'Varifrån kommer uppgifterna?', 'Where does the data come from?')}</h2><p>${L('Äänestykset, puheet ja lakiasiat ovat Eduskunnan avoimesta datasta. Aineisto alkaa 2.4.2023. Budjetti tulee Valtiokonttorilta, vaalitilastot Tilastokeskukselta, lobbaustiedot Avoimuusrekisteristä ja puolueohjelmat Pohtivasta.', 'Omröstningar, anföranden och ärenden kommer från riksdagens öppna data och börjar 2.4.2023. Budgeten kommer från Statskontoret, valstatistiken från Statistikcentralen, lobbningsuppgifterna från Öppenhetsregistret och partiprogrammen från Pohtiva.', 'Votes, speeches and parliamentary matters come from Parliament’s open data, starting on 2 April 2023. Budget data comes from the State Treasury, election data from Statistics Finland, lobbying records from the Transparency Register and party platforms from Pohtiva.')}</p><p>${L('Tiedot ovat tallennettuja tilannekuvia. Päivityspäivä kertoo, milloin aineisto on haettu, ei milloin yksittäinen päätös on tehty. Lähteissä voi olla puutteita tai viivettä. Virallinen lähde on ensisijainen, jos tiedoissa on eroa.', 'Uppgifterna är sparade ögonblicksbilder. Uppdateringsdatum visar när materialet hämtades, inte när ett beslut fattades. Källorna kan ha luckor eller fördröjningar. Originalkällan gäller om uppgifterna skiljer sig åt.', 'The data consists of saved snapshots. The update date shows when data was retrieved, rather than when a decision was made. Sources may have gaps or delays. The official source takes precedence if records differ.')}</p><p>${L('Helpon näkymän johdannot eivät muuta alkuperäisiä puheita, päätöksiä tai ilmoituksia. Osa yksityiskohtaisista teksteistä on saatavilla vain suomeksi tai ruotsiksi. Aiheiden automaattinen luokittelu voi sisältää virheitä.', 'De enkla introduktionerna ändrar inte originalanföranden, beslut eller anmälningar. Vissa detaljerade texter finns bara på finska eller svenska. Automatisk ämnesindelning kan innehålla fel.', 'The plain introductions do not change original speeches, decisions or declarations. Some detailed texts are available only in Finnish or Swedish. Automatic topic classifications can contain errors.')}</p>
    ${sourceNote(data?.metadata, lang, L, [[L('Eduskunnan avoin data', 'Riksdagens öppna data', 'Parliamentary open data'), 'https://api.eduskunta.fi/'], [L('Valtiokonttori', 'Statskontoret', 'State Treasury'), 'https://avoindata.tutkihallintoa.fi/'], [L('Tilastokeskus', 'Statistikcentralen', 'Statistics Finland'), 'https://pxdata.stat.fi/'], [L('Avoimuusrekisteri', 'Öppenhetsregistret', 'Transparency Register'), 'https://www.avoimuusrekisteri.fi/'], ['Pohtiva', 'https://www.fsd.tuni.fi/pohtiva/'], ['GitHub', 'https://github.com/Savvyboi/vahtikissa']])}</section></div>`;
}
export async function renderSimpleCivic(root, context) {
  const { lang, route } = context, L = textFor(lang), token = {};
  renders.set(root, token);
  const hash = location.hash, view = root.dataset.view, routeMarker = root.dataset.route;
  const routeIdentity=value=>['influence','programmes'].includes(route.page)?String(value).split('?')[0]:value;
  const isCurrent = () => renders.get(root) === token && routeIdentity(location.hash) === routeIdentity(hash) && root.dataset.view === view && routeIdentity(root.dataset.route) === routeIdentity(routeMarker) && document.documentElement.lang === lang;
  if (route.page === 'about') { renderAbout(root, context); root.setAttribute('aria-busy', 'false'); return; }
  const file = { budget: 'budget', elections: 'elections-2023', influence: 'influence', programmes: 'programmes' }[route.page];
  if (!file) return;
  root.setAttribute('aria-busy', 'true');
  try {
    const snapshot = await load(file);
    if (!isCurrent()) return;
    if (route.page === 'budget') renderBudget(root, snapshot, context, isCurrent);
    else if (route.page === 'elections') renderElections(root, snapshot, context, isCurrent);
    else if (route.page === 'influence') renderInfluence(root, snapshot, context, isCurrent);
    else renderProgrammes(root, snapshot, context, isCurrent);
    root.setAttribute('aria-busy', 'false');
  } catch {
    if (!isCurrent()) return;
    root.setAttribute('aria-busy', 'false');
    root.innerHTML = `<div class="easy-page"><section class="easy-empty" role="alert"><h1>${L('Tietoja ei saatu avattua', 'Uppgifterna kunde inte öppnas', 'The records could not be loaded')}</h1><p>${L('Tarkista verkkoyhteys ja yritä uudelleen.', 'Kontrollera anslutningen och försök igen.', 'Check your connection and try again.')}</p><button type="button" data-easy-retry>${L('Yritä uudelleen', 'Försök igen', 'Try again')}</button>${fullButton(L)}</section></div>`;
    root.querySelector('[data-easy-retry]').onclick = () => { if (isCurrent()) renderSimpleCivic(root, context); };
  }
}
