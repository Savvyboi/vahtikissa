import { filterBudgetItems, filterElectionCandidates, filterInfluence } from './civic-utils.js';
import { fetchJSONWithTimeout } from './app-utils.js';
import { bindExportButtons, exportButtons } from './data-tools.js';
import { collectionState, applyCollection, facetOptions, mountCollectionTools, preserveFocus, collapseQuickFilters } from './collection-tools.js';

const cache = new Map();
const extraStates = new Map();
function extraState(key, sort, direction = 'desc') {
  if (!extraStates.has(key)) extraStates.set(key, collectionState(sort, direction));
  return extraStates.get(key);
}
function extraFacet(items, key, label, value, display = value => value, lang = 'fi') {
  return {key, label, value, options: facetOptions(items,value,display,lang)};
}
function attachExtra(root, key, state, config, lang, before, rerender) {
  const holder = document.createElement('div');
  root.querySelector(before).before(holder);
  collapseQuickFilters(root,lang);
  const hasSearch=root.querySelector('.filters input[type="search"]');
  mountCollectionTools(holder,key,state,hasSearch?{...config,search:undefined}:config,lang,()=>preserveFocus(root,rerender));
}
function setupViewButtons(root, selector, lang) {
  const buttons = [...root.querySelectorAll(selector)];
  const group = buttons[0]?.parentElement;
  if (!group) return;
  group.setAttribute('role','group');
  group.setAttribute('aria-label',lang==='sv'?'Välj vy':'Valitse näkymä');
  buttons.forEach(button=>{
    button.removeAttribute('role');
    button.setAttribute('aria-pressed',button.getAttribute('aria-selected'));
    button.removeAttribute('aria-selected');
    const action=button.onclick;
    button.onclick=event=>preserveFocus(root,()=>action(event));
  });
}
const budgetState = { metric: 'budget', query: '' };
const electionState = { tab: 'parties', query: '', party: 'all', district: 'all' };
const influenceState = {
  tab: 'gifts', query: '', year: 'all', kind: 'all', mp: 'all', party: 'all', actor: 'all',
  method: 'all', category: 'all', excludedCategories: new Set(), categoryQuery: '', limit: 100
};
const colors = ['#003b70', '#6f2da8', '#287b70', '#b45309', '#8f3548', '#47682c', '#335c81', '#795548', '#5c5aa7', '#1d6b52', '#9a4d22', '#596273'];
const partyColors = { '03':'#245b87', '02':'#40577a', '01':'#9a3948', '04':'#2f6b52', '05':'#4b7044', '06':'#9a4055', '07':'#95601e', '08':'#5a5684', '09':'#356c70' };
const text = {
  fi: {
    budget:'Valtion budjetti', budgetLead:'Näe ensin kokonaisuus ja avaa sitten, mihin jokainen euro menee tai mistä se tulee.',
    elections:'Eduskuntavaalit 2023', electionLead:'Viralliset tulokset puolueittain, vaalipiireittäin ja valittuina kansanedustajina.',
    influence:'Sidonnaisuudet, lahjat ja lobbaus', influenceLead:'Hae kansanedustajien sidonnaisuus-, tulo- ja lahjailmoituksia sekä avoimuusrekisteriin ilmoitettuja yhteydenottoja.',
    updated:'Päivitetty', expense:'Menot', income:'Tulot', budgetMetric:'Talousarvio', actual:'Toteuma', search:'Hae nimellä tai tunnuksella…',
    compared:'edellisvuodesta', noData:'Ei tietoja valituilla rajauksilla.', officialTerms:'Yksityiskohtaiset budjettinimet ovat lähdeaineistossa suomeksi.',
    parties:'Puolueet', elected:'Valitut', votes:'ääntä', seats:'paikkaa', turnout:'Äänestysprosentti', voters:'Äänestäneitä', eligible:'Äänioikeutettuja', rejected:'Hylättyjä ääniä',
    wholeCountry:'Koko maa', district:'Vaalipiiri', party:'Puolue', candidateSearch:'Hae valittua nimellä…', candidate:'Valittu', comparison:'Vertausluku',
    gifts:'Lahjat', interests:'Sidonnaisuudet ja tulot', lobbying:'Lobbaus', contacts:'Yhteydenottoja', topics:'ilmoitettua aihetta', giftValue:'Ilmoitettu arvo', actors:'Ilmoittajaa', donor:'Antaja', recipient:'Vastaanottaja', value:'Arvo', useTime:'Käyttöaika',
    allYears:'Kaikki vuodet', allTargets:'Kaikki eduskuntakohteet', mps:'Kansanedustajat', assistants:'Avustajat', parliament:'Ryhmät ja eduskunta',
    actor:'Ilmoittaja', topic:'Aihe', target:'Kohde', methods:'Yhteydenpitotavat', period:'Ilmoituskausi', showMore:'Näytä lisää',
    sourceText:'Lähdetiedot ovat ilmoittajien itsensä toimittamia. Merkintä kertoo ilmoitetusta yhteydenotosta, ei sen vaikutuksesta päätöksiin.',
    oneCategory:'Yksi toimiala', excludeCategories:'Sulje pois toimialoja', clearFilters:'Tyhjennä rajaukset', allMps:'Kaikki kansanedustajat', allParties:'Kaikki puolueet', allActors:'Kaikki ilmoittajat', allMethods:'Kaikki yhteydenpitotavat',
    giftSourceText:'Lahjat ovat Eduskunnan avoimen datan julkaisemia kansanedustajien lahjailmoituksia. Tekstit näytetään virallisen lähteen muodossa.',
    interestSourceText:'Sidonnaisuus- ja tuloilmoitukset ovat kansanedustajien Eduskunnalle ilmoittamia tietoja. Myös “ei ilmoitettavaa” -merkinnät säilytetään, jotta rekisteri on tarkistettavissa edustajittain.'
  },
  sv: {
    budget:'Statsbudgeten', budgetLead:'Se först helheten och öppna sedan vart varje euro går eller varifrån den kommer.',
    elections:'Riksdagsvalet 2023', electionLead:'Officiella resultat per parti och valkrets samt alla invalda riksdagsledamöter.',
    influence:'Bindningar, gåvor och lobbning', influenceLead:'Sök ledamöternas bindnings-, inkomst- och gåvoanmälningar samt kontakter till riksdagen i öppenhetsregistret.',
    updated:'Uppdaterad', expense:'Utgifter', income:'Inkomster', budgetMetric:'Budget', actual:'Utfall', search:'Sök med namn eller kod…',
    compared:'från föregående år', noData:'Inga uppgifter med de valda avgränsningarna.', officialTerms:'Detaljerade budgetbenämningar finns endast på finska i källdatan.',
    parties:'Partier', elected:'Invalda', votes:'röster', seats:'mandat', turnout:'Valdeltagande', voters:'Väljare', eligible:'Röstberättigade', rejected:'Kasserade röster',
    wholeCountry:'Hela landet', district:'Valkrets', party:'Parti', candidateSearch:'Sök invald med namn…', candidate:'Invald', comparison:'Jämförelsetal',
    gifts:'Gåvor', interests:'Bindningar och inkomster', lobbying:'Lobbning', contacts:'Kontakter', topics:'anmälda ämnen', giftValue:'Anmält värde', actors:'Anmälare', donor:'Givare', recipient:'Mottagare', value:'Värde', useTime:'Användningstid',
    allYears:'Alla år', allTargets:'Alla riksdagsmål', mps:'Riksdagsledamöter', assistants:'Assistenter', parliament:'Grupper och riksdagen',
    actor:'Anmälare', topic:'Ämne', target:'Mål', methods:'Kontaktformer', period:'Anmälningsperiod', showMore:'Visa fler',
    sourceText:'Källuppgifterna har lämnats av anmälarna själva. En post visar en anmäld kontakt, inte dess inverkan på besluten.',
    oneCategory:'En bransch', excludeCategories:'Uteslut branscher', clearFilters:'Rensa avgränsningar', allMps:'Alla riksdagsledamöter', allParties:'Alla partier', allActors:'Alla anmälare', allMethods:'Alla kontaktformer',
    giftSourceText:'Gåvorna är ledamöternas gåvoanmälningar som publicerats i riksdagens öppna data. Texten visas i den officiella källans form.',
    interestSourceText:'Bindnings- och inkomstuppgifterna har anmälts av ledamöterna till riksdagen. Även poster med “inget att anmäla” bevaras för att registret ska kunna granskas per ledamot.'
  }
};

const tr = (lang, key) => text[lang]?.[key] || text.fi[key] || key;
const localized = (value, lang) => value?.[lang] || value?.fi || value?.sv || '';
const formatNumber = (value, lang, digits = 0) => new Intl.NumberFormat(lang === 'sv' ? 'sv-FI' : 'fi-FI', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Number(value) || 0);
const formatMoney = (value, lang, compact = false) => {
  const amount = Number(value) || 0;
  if (compact && Math.abs(amount) >= 1e9) return `${formatNumber(amount / 1e9, lang, 1)} ${lang === 'sv' ? 'md €' : 'mrd. €'}`;
  if (compact && Math.abs(amount) >= 1e6) return `${formatNumber(amount / 1e6, lang, 1)} ${lang === 'sv' ? 'mn €' : 'milj. €'}`;
  return new Intl.NumberFormat(lang === 'sv' ? 'sv-FI' : 'fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
};
const formatDate = (value, lang) => value ? new Intl.DateTimeFormat(lang === 'sv' ? 'sv-FI' : 'fi-FI', { day:'numeric', month:'long', year:'numeric' }).format(new Date(value)) : '—';
const pct = (part, total) => total ? Math.max(0, Math.min(100, part / total * 100)) : 0;

async function load(path) {
  if (!cache.has(path)) cache.set(path, fetchJSONWithTimeout(path).catch(error => { cache.delete(path); throw error; }));
  return cache.get(path);
}

function loading(root, lang) {
  root.innerHTML = `<section class="loading"><span class="spinner" aria-hidden="true"></span><p>${lang === 'sv' ? 'Öppna data laddas…' : 'Ladataan avointa dataa…'}</p></section>`;
}

function errorView(root, lang, escapeHTML, error, retry) {
  const timeout=error?.name==='TimeoutError';
  root.innerHTML = `<div class="page"><section class="load-error" role="alert"><span class="eyebrow">${lang === 'sv' ? 'Laddningsfel' : 'Latausvirhe'}</span><h1>${lang === 'sv' ? 'Uppgifterna kunde inte laddas' : 'Tietoja ei voitu ladata'}</h1><p>${lang === 'sv' ? (timeout?'Laddningen tog för lång tid. Kontrollera anslutningen och försök igen.':'Kontrollera anslutningen och försök igen.') : (timeout?'Lataus kesti liian kauan. Tarkista verkkoyhteys ja yritä uudelleen.':'Tarkista verkkoyhteys ja yritä uudelleen.')}</p><details><summary>${lang === 'sv' ? 'Tekniska detaljer' : 'Tekniset tiedot'}</summary><code>${escapeHTML(error?.message||'Unknown error')}</code></details><button type="button" data-retry>${lang === 'sv' ? 'Försök igen' : 'Yritä uudelleen'}</button></section></div>`;
  root.querySelector('[data-retry]').onclick=retry;
}

function pageHeader(lang, escapeHTML, kicker, title, lead, generatedAt) {
  return `<div class="page-head"><div><div class="eyebrow">${escapeHTML(kicker)}</div><h1>${escapeHTML(title)}</h1><p class="lead">${escapeHTML(lead)}</p></div><div class="updated">${tr(lang,'updated')} ${formatDate(generatedAt,lang)}</div></div>`;
}

function sourceNote(content, links = []) {
  return `<aside class="civic-note"><p>${content}</p><div class="source-links">${links.map(link => `<a href="${link.href}" target="_blank" rel="noreferrer">${link.label} ↗</a>`).join('')}</div></aside>`;
}

function metricValue(item) {
  return Number(item?.[budgetState.metric]) || 0;
}

function budgetPath(year, type, codes = []) {
  return `#/budget/${[year, type, ...codes].join('/')}`;
}

function findBudgetLevel(yearData, codes) {
  if (!codes.length) return null;
  const main = [...yearData.income, ...yearData.expense].find(item => item.code === codes[0]);
  if (codes.length === 1) return main;
  return main?.children?.find(item => item.code === codes[1]) || null;
}

function budgetRouteId(hash) {
  return String(hash || '').replace(/^#\/budget\/?/, '');
}

function renderBudgetContent(root, lang, escapeHTML, data, routeId = '') {
  const route = String(routeId || '').split('/').filter(Boolean);
  const latest = data.years.at(-1);
  const yearNumber = Number(route[0]);
  const yearData = data.years.find(item => item.year === yearNumber) || latest;
  const type = route[1] === 'income' ? 'income' : 'expense';
  const codes = route.slice(2, 4);
  const currentLevel = findBudgetLevel(yearData, codes);
  const allItems = currentLevel?.children || yearData[type];
  const extra=extraState(`budget-${yearData.year}-${type}-${codes.join('-')}`,'amount'), config={
    label:tr(lang,'budget'),sorts:[{key:'amount',label:tr(lang,budgetState.metric==='budget'?'budgetMetric':'actual'),value:metricValue},{key:'name',label:lang==='sv'?'Namn':'Nimi',value:item=>localized(item.name,lang)},{key:'code',label:lang==='sv'?'Kod':'Tunnus',value:item=>item.code}],
    number:{label:lang==='sv'?'Belopp (€)':'Summa (€)',value:metricValue},facets:[extraFacet(allItems,'code',lang==='sv'?'Budgetposter':'Budjettikohdat',item=>item.code,code=>localized(allItems.find(item=>item.code===code)?.name,lang),lang)]
  };
  const items=applyCollection(filterBudgetItems(allItems||[],budgetState.query),extra,config,lang);
  const total = (yearData[type] || []).reduce((sum, item) => sum + metricValue(item), 0);
  const incomeTotal = yearData.income.reduce((sum, item) => sum + metricValue(item), 0);
  const expenseTotal = yearData.expense.reduce((sum, item) => sum + metricValue(item), 0);
  const previous = data.years.find(item => item.year === yearData.year - 1);
  const previousLevel = previous ? findBudgetLevel(previous, codes) : null;
  const previousItems = previousLevel?.children || previous?.[type] || [];
  const scopeTotal = (allItems || []).reduce((sum,item)=>sum+metricValue(item),0) || metricValue(currentLevel) || total;
  const levelName = localized(currentLevel?.name,lang) || `${tr(lang,type)} ${yearData.year}`;
  const crumbs = [
    `<a data-budget-route href="${budgetPath(yearData.year,type)}">${tr(lang,type)}</a>`,
    ...codes.map((code,index) => {
      const node = findBudgetLevel(yearData,codes.slice(0,index+1));
      return index===codes.length-1
        ? `<span aria-current="page">${escapeHTML(localized(node?.name,lang)||code)}</span>`
        : `<a data-budget-route href="${budgetPath(yearData.year,type,codes.slice(0,index+1))}">${escapeHTML(localized(node?.name,lang)||code)}</a>`;
    })
  ];
  const composition=items.slice(0,12).map((item,index)=>`<span style="width:${pct(metricValue(item),scopeTotal)}%;background:${colors[(Number(item.code.slice(-2))||index)%colors.length]}" title="${escapeHTML(localized(item.name,lang))}: ${formatNumber(pct(metricValue(item),scopeTotal),lang,1)} %"></span>`).join('');
  root.innerHTML = `<div class="page civic-page budget-page">
    ${pageHeader(lang,escapeHTML,lang==='sv'?'Statskontoret · öppen data':'Valtiokonttori · avoin data',tr(lang,'budget'),tr(lang,'budgetLead'),data.metadata.generatedAt)}
    <div class="civic-toolbar budget-toolbar">
      <label class="filter-control"><span>${lang==='sv'?'År':'Vuosi'}</span><select data-budget-year>${data.years.map(item=>`<option value="${item.year}" ${item.year===yearData.year?'selected':''}>${item.year}${item.latestMonth<12?` · ${item.latestMonth}/${12}`:''}</option>`).join('')}</select></label>
      <div class="segmented" role="group" aria-label="${lang==='sv'?'Typ':'Tyyppi'}"><a data-budget-route class="${type==='expense'?'active':''}" href="${budgetPath(yearData.year,'expense')}">${tr(lang,'expense')}</a><a data-budget-route class="${type==='income'?'active':''}" href="${budgetPath(yearData.year,'income')}">${tr(lang,'income')}</a></div>
      <div class="segmented" role="group" aria-label="${lang==='sv'?'Mått':'Mittari'}"><button data-budget-metric="budget" class="${budgetState.metric==='budget'?'active':''}">${tr(lang,'budgetMetric')}</button><button data-budget-metric="actual" class="${budgetState.metric==='actual'?'active':''}">${tr(lang,'actual')}</button></div>
    </div>
    <section class="budget-summary" aria-label="${tr(lang,'budget')}"><div><span>${tr(lang,type)} ${yearData.year}</span><strong>${formatMoney(total,lang,true)}</strong></div><div><span>${tr(lang,'income')}</span><strong>${formatMoney(incomeTotal,lang,true)}</strong></div><div><span>${tr(lang,'expense')}</span><strong>${formatMoney(expenseTotal,lang,true)}</strong></div><div><span>${lang==='sv'?'Balans':'Tasapaino'}</span><strong class="${incomeTotal-expenseTotal<0?'negative':''}">${formatMoney(incomeTotal-expenseTotal,lang,true)}</strong></div></section>
    <nav class="budget-crumbs" aria-label="${lang==='sv'?'Sökväg':'Murupolku'}">${crumbs.join('<span>›</span>')}</nav>
    <section class="budget-explorer-head">
      <div><span class="eyebrow">${codes.length?`${lang==='sv'?'Nivå':'Taso'} ${codes.length+1}`:(lang==='sv'?'Helhetsbild':'Kokonaiskuva')}</span><h2>${escapeHTML(levelName)}</h2><p>${codes.length?(lang==='sv'?'Välj en rad för att gå djupare. Använd sökvägen ovan för att gå tillbaka.':'Valitse rivi nähdäksesi tarkemman jaon. Palaa ylemmälle tasolle murupolusta.'):(lang==='sv'?'Beloppen är ordnade från störst till minst. Stapeln visar andelen av den valda helheten.':'Summat ovat suurimmasta pienimpään. Palkki näyttää osuuden valitusta kokonaisuudesta.')}</p></div>
      <div class="budget-scope-total"><span>${lang==='sv'?'Denna nivå':'Tämä taso'}</span><strong>${formatMoney(scopeTotal,lang,true)}</strong></div>
    </section>
    <div class="budget-composition" role="img" aria-label="${escapeHTML(lang==='sv'?'Fördelningen på denna nivå':'Tämän tason jakauma')}">${composition}</div>
    <div class="filters civic-search budget-list-controls"><input data-budget-search type="search" value="${escapeHTML(budgetState.query)}" placeholder="${escapeHTML(tr(lang,'search'))}" aria-label="${escapeHTML(tr(lang,'search'))}"></div>
    <div class="data-actions"><p class="filter-summary" role="status" aria-live="polite">${formatNumber(items.length,lang)} ${lang==='sv'?'poster':'kohtaa'}</p>${exportButtons('budget',lang)}</div>
    <div class="budget-bars">${items.length?items.map((item,index)=>{
      const old=previousItems.find(previousItem=>previousItem.code===item.code),value=metricValue(item),oldValue=metricValue(old),delta=oldValue?(value-oldValue)/oldValue*100:null;
      const childCodes=[...codes,item.code];const hasChildren=item.children?.length;
      const share=pct(value,scopeTotal),color=colors[(Number(item.code.slice(-2))||index)%colors.length];
      const content=`<div class="budget-row-head"><div><span class="budget-rank">${index+1}</span><span class="pill">${escapeHTML(item.code)}</span><strong>${escapeHTML(localized(item.name,lang))}</strong></div><div><strong>${formatMoney(value,lang,true)}</strong><span class="budget-share">${formatNumber(share,lang,1)} %</span>${delta!==null?`<small class="${delta>0?'up':delta<0?'down':''}">${delta>0?'+':''}${formatNumber(delta,lang,1)} % ${tr(lang,'compared')}</small>`:''}</div></div><div class="budget-track" role="img" aria-label="${escapeHTML(localized(item.name,lang))}: ${formatMoney(value,lang)}"><span style="width:${Math.max(share,.6)}%"></span></div>${hasChildren?`<span class="budget-open">${lang==='sv'?'Öppna fördelningen':'Avaa tarkempi jako'} →</span>`:''}`;
      return hasChildren?`<a data-budget-route class="budget-row budget-row-link" style="--budget-color:${color}" href="${budgetPath(yearData.year,type,childCodes)}">${content}</a>`:`<article class="budget-row" style="--budget-color:${color}">${content}</article>`;
    }).join(''):`<div class="empty">${tr(lang,'noData')}</div>`}</div>
    ${sourceNote(escapeHTML(tr(lang,'officialTerms')),[{href:'https://avoindata.tutkihallintoa.fi/api-details#api=valtiontalous&operation=BudjettitaloudenTapahtumatTiedostot',label:lang==='sv'?'Statskontorets budget-API':'Valtiokonttorin budjettirajapinta'}])}
  </div>`;
  attachExtra(root,'budget',extra,config,lang,'.data-actions',()=>renderBudgetContent(root,lang,escapeHTML,data,[yearData.year,type,...codes].join('/')));
  root.querySelectorAll('[data-budget-metric]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.budgetMetric===budgetState.metric)));
  root.querySelectorAll('.segmented [data-budget-route]').forEach(link=>{if(link.classList.contains('active'))link.setAttribute('aria-current','page')});
  const navigate = hash => { history.pushState(null,'',hash); renderBudgetContent(root,lang,escapeHTML,data,budgetRouteId(hash)); };
  bindExportButtons(root,'budget',()=>items.map(item=>({year:yearData.year,type,code:item.code,name:localized(item.name,lang),budget:item.budget,actual:item.actual,sharePercent:Number(pct(metricValue(item),scopeTotal).toFixed(2))})),`vahtikissa-budjetti-${yearData.year}-${type}`);
  root.querySelectorAll('[data-budget-route]').forEach(link=>link.onclick=event=>{event.preventDefault();navigate(link.getAttribute('href'))});
  root.querySelector('[data-budget-year]').onchange = event => navigate(budgetPath(event.target.value,type,codes));
  root.querySelectorAll('[data-budget-metric]').forEach(button => button.onclick=()=>{budgetState.metric=button.dataset.budgetMetric;renderBudgetContent(root,lang,escapeHTML,data,[yearData.year,type,...codes].join('/'))});
  root.querySelectorAll('[data-budget-metric], [data-budget-year]').forEach(control=>{const action=control.onclick||control.onchange;if(action){const event=control.tagName==='SELECT'?'onchange':'onclick';control[event]=e=>preserveFocus(root,()=>action(e))}});
  root.querySelector('[data-budget-search]').oninput = event => {const position=event.target.selectionStart;budgetState.query=event.target.value;renderBudgetContent(root,lang,escapeHTML,data,[yearData.year,type,...codes].join('/'));const input=root.querySelector('[data-budget-search]');input?.focus({preventScroll:true});input?.setSelectionRange(position,position)};
}

export async function renderBudget(root, lang, routeId, escapeHTML) {
  const requested=location.hash;
  if(!cache.has('./data/budget.json')) loading(root,lang);
  try { const data=await load('./data/budget.json');if(location.hash===requested&&document.documentElement.lang===lang)renderBudgetContent(root,lang,escapeHTML,data,routeId); }
  catch (error) { if(location.hash===requested)errorView(root,lang,escapeHTML,error,()=>renderBudget(root,lang,routeId,escapeHTML)); }
}

function electionStats(data,lang) {
  const stats=[['turnout',`${formatNumber(data.summary.turnout,lang,1)} %`],['voters',formatNumber(data.summary.voters,lang)],['eligible',formatNumber(data.summary.eligible,lang)],['seats',formatNumber(data.summary.seats,lang)]];
  return `<div class="civic-stat-grid">${stats.map(([key,value])=>`<div><span>${tr(lang,key)}</span><strong>${value}</strong></div>`).join('')}</div>`;
}

function renderElectionContent(root,lang,escapeHTML,data) {
  const districtName = code => localized(data.districts.find(item=>item.code===code)?.name,lang);
  const selectedDistrict=electionState.district;
  const allPartyRows=(selectedDistrict==='all'?data.parties:data.districtResults.filter(item=>item.locationCode===selectedDistrict).map(item=>({code:item.partyCode,name:item.party,votes:item.votes,share:item.share,seats:data.candidates.filter(c=>c.districtCode===selectedDistrict&&c.partyCode===item.partyCode).length}))).sort((a,b)=>b.votes-a.votes);
  const extra=extraState(`election-${electionState.tab}`,'votes'),partiesTab=electionState.tab==='parties';
  const config={label:tr(lang,'elections'),search:item=>[item.name?.fi,item.name?.sv,item.name,item.party?.fi,item.party?.sv],sorts:[{key:'votes',label:tr(lang,'votes'),value:item=>item.votes},{key:'name',label:lang==='sv'?'Namn':'Nimi',value:item=>typeof item.name==='string'?item.name:localized(item.name,lang)},partiesTab?{key:'seats',label:tr(lang,'seats'),value:item=>item.seats}:{key:'comparison',label:tr(lang,'comparison'),value:item=>item.comparison}],number:{label:tr(lang,'votes'),value:item=>item.votes},facets:[extraFacet(partiesTab?allPartyRows:data.candidates,'party',tr(lang,'party'),item=>item.partyCode||item.code,code=>localized(data.parties.find(item=>item.code===code)?.name,lang),lang),...(!partiesTab?[extraFacet(data.candidates,'district',tr(lang,'district'),item=>item.districtCode,districtName,lang)]:[])]};
  const partyRows=applyCollection(allPartyRows,extra,config,lang);
  const candidates=applyCollection(filterElectionCandidates(data.candidates,{query:electionState.query,party:electionState.party,district:electionState.district}),extra,config,lang);
  root.innerHTML=`<div class="page civic-page election-page">${pageHeader(lang,escapeHTML,lang==='sv'?'Statistikcentralen · officiell statistik':'Tilastokeskus · virallinen tilasto',tr(lang,'elections'),tr(lang,'electionLead'),data.metadata.generatedAt)}${electionStats(data,lang)}
    <div class="tab-list" role="tablist"><button role="tab" aria-selected="${electionState.tab==='parties'}" data-election-tab="parties">${tr(lang,'parties')}</button><button role="tab" aria-selected="${electionState.tab==='candidates'}" data-election-tab="candidates">${tr(lang,'elected')} <span>${data.candidates.length}</span></button></div>
    ${electionState.tab==='parties'?`<div class="civic-toolbar"><label class="filter-control"><span>${tr(lang,'district')}</span><select data-election-district><option value="all">${tr(lang,'wholeCountry')}</option>${data.districts.map(item=>`<option value="${item.code}" ${selectedDistrict===item.code?'selected':''}>${escapeHTML(localized(item.name,lang).replace(/^VP\d+\s*/,''))}</option>`).join('')}</select></label></div><div class="data-actions">${exportButtons('election',lang)}</div><div class="election-bars">${partyRows.map((party,index)=>`<article class="election-party" style="--party-color:${partyColors[party.code]||colors[index%colors.length]}"><div class="election-party-name"><span class="party-swatch"></span><strong>${escapeHTML(localized(party.name,lang))}</strong><span>${party.seats} ${tr(lang,'seats')}</span></div><div class="election-party-result"><strong>${formatNumber(party.share,lang,1)} %</strong><span>${formatNumber(party.votes,lang)} ${tr(lang,'votes')}</span></div><div class="election-track"><span style="width:${pct(party.share,Math.max(...partyRows.map(item=>item.share)))}%"></span></div></article>`).join('')}</div>`:
    `<div class="filters election-filters"><input data-candidate-search type="search" aria-label="${escapeHTML(tr(lang,'candidateSearch'))}" value="${escapeHTML(electionState.query)}" placeholder="${escapeHTML(tr(lang,'candidateSearch'))}"><select data-candidate-party aria-label="${tr(lang,'party')}"><option value="all">${tr(lang,'parties')}</option>${data.parties.map(item=>`<option value="${item.code}" ${electionState.party===item.code?'selected':''}>${escapeHTML(localized(item.name,lang))}</option>`).join('')}</select><select data-candidate-district aria-label="${tr(lang,'district')}"><option value="all">${tr(lang,'wholeCountry')}</option>${data.districts.map(item=>`<option value="${item.code}" ${electionState.district===item.code?'selected':''}>${escapeHTML(localized(item.name,lang).replace(/^VP\d+\s*/,''))}</option>`).join('')}</select></div><div class="data-actions"><p class="filter-summary" role="status" aria-live="polite">${candidates.length} ${tr(lang,'elected').toLocaleLowerCase(lang)}</p>${exportButtons('election',lang)}</div><div class="candidate-grid">${candidates.map(candidate=>`<article class="candidate-card"><div class="avatar">${escapeHTML(candidate.name.split(/\s+/).slice(0,2).map(part=>part[0]).join(''))}</div><div><h2>${escapeHTML(candidate.name)}</h2><p><span class="pill">${escapeHTML(localized(candidate.party,lang))}</span> ${escapeHTML(localized(candidate.district,lang).replace(/^VP\d+\s*/,''))}</p><strong>${formatNumber(candidate.votes,lang)} ${tr(lang,'votes')}</strong><small>${tr(lang,'comparison')} ${formatNumber(candidate.comparison,lang,0)}</small></div></article>`).join('')}</div>`}
    ${sourceNote(`${lang==='sv'?'Valresultaten är Statistikcentralens officiella statistik.':'Vaalitulokset ovat Tilastokeskuksen virallista tilastoa.'}`,[{href:'https://pxdata.stat.fi/PxWeb/pxweb/fi/StatFin/StatFin__evaa/',label:lang==='sv'?'Statistikcentralens databaser':'Tilastokeskuksen tietokannat'}])}</div>`;
  root.querySelectorAll('[data-election-tab]').forEach(button=>button.onclick=()=>{electionState.tab=button.dataset.electionTab;electionState.query='';electionState.party='all';electionState.district='all';renderElectionContent(root,lang,escapeHTML,data)});
  attachExtra(root,'election',extra,config,lang,'.data-actions',()=>renderElectionContent(root,lang,escapeHTML,data));
  setupViewButtons(root,'[data-election-tab]',lang);
  bindExportButtons(root,'election',()=>electionState.tab==='parties'?partyRows.map(party=>({district:districtName(selectedDistrict)||tr(lang,'wholeCountry'),party:localized(party.name,lang),votes:party.votes,sharePercent:party.share,seats:party.seats})):candidates.map(candidate=>({name:candidate.name,party:localized(candidate.party,lang),district:localized(candidate.district,lang).replace(/^VP\d+\s*/,''),votes:candidate.votes,comparison:candidate.comparison})),`vahtikissa-vaalit-2023-${electionState.tab}`);
  const district=root.querySelector('[data-election-district]');if(district)district.onchange=event=>{electionState.district=event.target.value;renderElectionContent(root,lang,escapeHTML,data)};
  const query=root.querySelector('[data-candidate-search]');if(query)query.oninput=event=>{electionState.query=event.target.value;renderElectionContent(root,lang,escapeHTML,data);root.querySelector('[data-candidate-search]')?.focus()};
  const party=root.querySelector('[data-candidate-party]');if(party)party.onchange=event=>{electionState.party=event.target.value;renderElectionContent(root,lang,escapeHTML,data)};
  const candidateDistrict=root.querySelector('[data-candidate-district]');if(candidateDistrict)candidateDistrict.onchange=event=>{electionState.district=event.target.value;renderElectionContent(root,lang,escapeHTML,data)};
  root.querySelectorAll('[data-election-district], [data-candidate-party], [data-candidate-district]').forEach(control=>{const action=control.onchange;control.onchange=event=>preserveFocus(root,()=>action(event))});
}

export async function renderElections(root,lang,escapeHTML) {
  const requested=location.hash;loading(root,lang);
  try { const data=await load('./data/elections-2023.json');if(location.hash===requested&&document.documentElement.lang===lang)renderElectionContent(root,lang,escapeHTML,data); }
  catch(error){ if(location.hash===requested)errorView(root,lang,escapeHTML,error,()=>renderElections(root,lang,escapeHTML)); }
}

const methodNames={fi:{meeting:'Tapaaminen',phone:'Puhelu',mail:'Sähköposti',social_media:'Sosiaalinen media',event:'Tilaisuus',online:'Verkkotapaaminen',other:'Muu'},sv:{meeting:'Möte',phone:'Telefonsamtal',mail:'E-post',social_media:'Sociala medier',event:'Evenemang',online:'Distansmöte',other:'Övrigt'}};
const influencePartyNames={kok:{fi:'Kokoomus',sv:'Samlingspartiet'},ps:{fi:'Perussuomalaiset',sv:'Sannfinländarna'},sd:{fi:'SDP',sv:'SDP'},kesk:{fi:'Keskusta',sv:'Centern'},vihr:{fi:'Vihreät',sv:'De gröna'},vas:{fi:'Vasemmistoliitto',sv:'Vänsterförbundet'},r:{fi:'RKP',sv:'SFP'},kd:{fi:'Kristillisdemokraatit',sv:'Kristdemokraterna'},liik:{fi:'Liike Nyt',sv:'Rörelse Nu'},sit:{fi:'Sitoutumaton',sv:'Obunden'}};
function methodName(method,lang){return methodNames[lang]?.[method]||methodNames.fi[method]||method.replaceAll('_',' ')}
function influencePartyName(party,lang){return influencePartyNames[party]?.[lang]||influencePartyNames[party]?.fi||String(party||'').toUpperCase()}

function oneTargetLabel(target,lang){const value=target?.[lang]||target?.fi||{};return [value.name,value.title,value.department||value.organization].filter(Boolean).join(' · ')}
function targetLabel(item,lang){
  const targets=item.targets||[item.target].filter(Boolean);
  const labels=targets.slice(0,3).map(target=>oneTargetLabel(target,lang)).filter(Boolean);
  if(targets.length>3)labels.push(lang==='sv'?`+ ${targets.length-3} andra`:`+ ${targets.length-3} muuta`);
  return labels.join('; ');
}

function primaryTargetKind(item){return item.targetKinds?.length===1?item.targetKinds[0]:item.targetKind||'all'}

function normalizePersonName(value){return String(value||'').trim().toLocaleLowerCase('fi').replace(/\s+/g,' ')}
function partyFromTarget(target,memberParties){
  const details=[target?.fi?.department,target?.sv?.department,target?.fi?.organization,target?.sv?.organization].filter(Boolean).join(' ').toLocaleLowerCase('fi');
  const named=memberParties.get(normalizePersonName(target?.fi?.name||target?.sv?.name));
  if(named)return named;
  const patterns=[['kok',/kokoom|samlings/],['ps',/perussuom|sannfin/],['sd',/sosialidem|socialdem/],['kesk',/keskusta|centern/],['vihr',/vihre|gröna/],['vas',/vasemmist|vänster/],['r',/ruotsal|svenska folk/],['kd',/kristillis|kristdem/],['liik',/liike nyt|rörelse nu/]];
  return patterns.find(([,pattern])=>pattern.test(details))?.[0]||'';
}

function prepareInfluenceData(data,members=[]){
  if(data.__filtersPrepared)return;
  const targets=new Map((data.targets||[]).map(target=>[target.id,target]));
  const memberParties=new Map([
    ...members.map(member=>[normalizePersonName(`${member.firstName||''} ${member.lastName||''}`),member.party]),
    ...(data.gifts||[]).map(gift=>[normalizePersonName(gift.mpName),gift.party])
  ]);
  for(const item of data.lobbying||[]){
    if(!item.targets)item.targets=(item.targetIds||[]).map(id=>targets.get(id)).filter(Boolean);
    item.mpNames=[...new Set(item.targets.filter(target=>target.kind==='mp').map(target=>target.fi?.name||target.sv?.name).filter(Boolean))];
    item.targetParties=[...new Set(item.targets.map(target=>partyFromTarget(target,memberParties)).filter(Boolean))];
  }
  Object.defineProperty(data,'__filtersPrepared',{value:true});
}

function influenceOptions(values,selected,label,escapeHTML,lang){
  return `<option value="all">${escapeHTML(label)}</option>${values.map(value=>`<option value="${escapeHTML(value)}" ${String(selected)===String(value)?'selected':''}>${escapeHTML(value)}</option>`).join('')}`;
}

function renderInfluenceContent(root,lang,escapeHTML,data){
  const source=influenceState.tab==='gifts'?data.gifts:influenceState.tab==='interests'?(data.interests||[]):data.lobbying;
  const years=[...new Set(source.map(item=>item.year||item.periodYear).filter(Boolean))].sort((a,b)=>b-a);
  const mpNames=[...new Set(source.flatMap(item=>item.mpNames||[item.mpName]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,lang));
  if(influenceState.mp!=='all'&&!mpNames.includes(influenceState.mp))mpNames.unshift(influenceState.mp);
  const parties=[...new Set(source.flatMap(item=>item.targetParties||[item.party]).filter(Boolean))].sort((a,b)=>influencePartyName(a,lang).localeCompare(influencePartyName(b,lang),lang));
  const categories=[...new Set(source.map(item=>item.industry).filter(Boolean))].sort((a,b)=>a.localeCompare(b,lang));
  const actors=[...new Set(source.map(item=>item.actor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,lang));
  const methods=[...new Set(source.flatMap(item=>item.methods||[]))].sort((a,b)=>methodName(a,lang).localeCompare(methodName(b,lang),lang));
  const extra=extraState(`influence-${influenceState.tab}`,'date'),gift=influenceState.tab==='gifts',lobby=influenceState.tab==='lobbying';
  const date=item=>gift?item.reported?.split('.').reverse().map(part=>part.padStart(2,'0')).join('-'):lobby?item.reported:`${item.year}-01-01`;
  const config={label:tr(lang,'influence'),date,sorts:[{key:'date',label:tr(lang,'updated'),value:date},{key:'name',label:lobby?tr(lang,'actor'):tr(lang,'recipient'),value:item=>item.actor||item.mpName},...(gift?[{key:'amount',label:tr(lang,'value'),value:item=>item.amount},{key:'donor',label:tr(lang,'donor'),value:item=>item.donor}]:lobby?[{key:'targets',label:tr(lang,'contacts'),value:item=>item.targetIds?.length||0},{key:'topic',label:tr(lang,'topic'),value:item=>item.topic}]:[{key:'category',label:lang==='sv'?'Kategori':'Luokka',value:item=>(lang==='sv'&&item.categorySv)||item.category}])],
    number:gift?{label:`${tr(lang,'value')} (€)`,value:item=>item.amount}:lobby?{label:tr(lang,'contacts'),value:item=>item.targetIds?.length||0}:null,
    facets:[extraFacet(source,'year',lang==='sv'?'År':'Vuosi',item=>item.year||item.periodYear,undefined,lang),extraFacet(source,'party',tr(lang,'party'),item=>item.targetParties||item.party,code=>influencePartyName(code,lang),lang),extraFacet(source,'mp',lang==='sv'?'Ledamot':'Kansanedustaja',item=>item.mpNames||item.mpName,undefined,lang),...(gift?[extraFacet(source,'donor',tr(lang,'donor'),item=>item.donor,undefined,lang)]:lobby?[extraFacet(source,'industry',tr(lang,'oneCategory'),item=>item.industry,undefined,lang),extraFacet(source,'actor',tr(lang,'actor'),item=>item.actor,undefined,lang),extraFacet(source,'method',tr(lang,'methods'),item=>item.methods,method=>methodName(method,lang),lang),extraFacet(source,'kind',lang==='sv'?'Måltyp':'Kohdetyyppi',item=>item.targetKinds,kind=>tr(lang,kind==='mp'?'mps':kind==='assistant'?'assistants':'parliament'),lang)]:[extraFacet(source,'type',lang==='sv'?'Uppgiftstyp':'Ilmoitustyyppi',item=>item.type,type=>type==='income'?(lang==='sv'?'Inkomst':'Tulo'):(lang==='sv'?'Bindning':'Sidonnaisuus'),lang),extraFacet(source,'declared',lang==='sv'?'Status':'Tila',item=>String(item.declared),value=>value==='true'?(lang==='sv'?'Anmäld uppgift':'Ilmoitettu tieto'):(lang==='sv'?'Inget att anmäla':'Ei ilmoitettavaa'),lang)])]
  };
  const filtered=applyCollection(filterInfluence(source,{...influenceState,excludedCategories:[...influenceState.excludedCategories]}),extra,config,lang);
  const shown=filtered.slice(0,influenceState.limit);
  const hasFilters=influenceState.query||['year','kind','mp','party','actor','method','category'].some(key=>influenceState[key]!=='all')||influenceState.excludedCategories.size;
  const kindLabel=influenceState.tab==='gifts'?tr(lang,'gifts'):influenceState.tab==='interests'?tr(lang,'interests'):tr(lang,'topics');
  const searchPlaceholder=influenceState.tab==='gifts'?(lang==='sv'?'Sök givare, ledamot eller gåva…':'Hae antajaa, edustajaa tai lahjaa…'):influenceState.tab==='interests'?(lang==='sv'?'Sök ledamot, bindning eller inkomst…':'Hae edustajaa, sidonnaisuutta tai tuloa…'):(lang==='sv'?'Sök anmälare, ämne eller mål…':'Hae ilmoittajaa, aihetta tai kohdetta…');
  root.innerHTML=`<div class="page civic-page influence-page">${pageHeader(lang,escapeHTML,lang==='sv'?'Riksdagen och öppenhetsregistret':'Eduskunta ja avoimuusrekisteri',tr(lang,'influence'),tr(lang,'influenceLead'),data.metadata.generatedAt)}
    <div class="civic-stat-grid influence-stats"><div><span>${tr(lang,'gifts')}</span><strong>${formatNumber(data.counts.gifts,lang)}</strong></div><div><span>${tr(lang,'interests')}</span><strong>${formatNumber(data.counts.interests||0,lang)}</strong></div><div><span>${tr(lang,'giftValue')}</span><strong>${formatMoney(data.counts.giftValue,lang,true)}</strong></div><div><span>${tr(lang,'contacts')}</span><strong>${formatNumber(data.counts.lobbying,lang)}</strong></div><div><span>${tr(lang,'actors')}</span><strong>${formatNumber(data.counts.actors,lang)}</strong></div></div>
    <div class="tab-list" role="tablist"><button role="tab" aria-selected="${influenceState.tab==='gifts'}" data-influence-tab="gifts">${tr(lang,'gifts')}</button><button role="tab" aria-selected="${influenceState.tab==='interests'}" data-influence-tab="interests">${tr(lang,'interests')}</button><button role="tab" aria-selected="${influenceState.tab==='lobbying'}" data-influence-tab="lobbying">${tr(lang,'lobbying')}</button></div>
    <section class="influence-filter-panel" aria-label="${lang==='sv'?'Avgränsa uppgifter':'Rajaa tietoja'}"><div class="filters influence-filters"><input data-influence-search type="search" aria-label="${escapeHTML(searchPlaceholder)}" value="${escapeHTML(influenceState.query)}" placeholder="${escapeHTML(searchPlaceholder)}"><label class="filter-control"><span>${lang==='sv'?'År':'Vuosi'}</span><select data-influence-filter="year">${influenceOptions(years.map(String),String(influenceState.year),tr(lang,'allYears'),escapeHTML,lang)}</select></label><label class="filter-control"><span>${lang==='sv'?'Ledamot':'Kansanedustaja'}</span><select data-influence-filter="mp">${influenceOptions(mpNames,influenceState.mp,tr(lang,'allMps'),escapeHTML,lang)}</select></label><label class="filter-control"><span>${tr(lang,'party')}</span><select data-influence-filter="party"><option value="all">${tr(lang,'allParties')}</option>${parties.map(party=>`<option value="${escapeHTML(party)}" ${influenceState.party===party?'selected':''}>${escapeHTML(influencePartyName(party,lang))}</option>`).join('')}</select></label>${influenceState.tab==='lobbying'?`<label class="filter-control"><span>${lang==='sv'?'Måltyp':'Kohdetyyppi'}</span><select data-influence-filter="kind"><option value="all">${tr(lang,'allTargets')}</option><option value="mp" ${influenceState.kind==='mp'?'selected':''}>${tr(lang,'mps')}</option><option value="assistant" ${influenceState.kind==='assistant'?'selected':''}>${tr(lang,'assistants')}</option><option value="parliament" ${influenceState.kind==='parliament'?'selected':''}>${tr(lang,'parliament')}</option></select></label><label class="filter-control"><span>${tr(lang,'oneCategory')}</span><select data-influence-filter="category">${influenceOptions(categories,influenceState.category,lang==='sv'?'Alla branscher':'Kaikki toimialat',escapeHTML,lang)}</select></label><label class="filter-control"><span>${tr(lang,'actor')}</span><select data-influence-filter="actor">${influenceOptions(actors,influenceState.actor,tr(lang,'allActors'),escapeHTML,lang)}</select></label><label class="filter-control"><span>${tr(lang,'methods')}</span><select data-influence-filter="method"><option value="all">${tr(lang,'allMethods')}</option>${methods.map(method=>`<option value="${escapeHTML(method)}" ${influenceState.method===method?'selected':''}>${escapeHTML(methodName(method,lang))}</option>`).join('')}</select></label>`:''}</div>
    ${influenceState.tab==='lobbying'?`<details class="category-exclusions" ${influenceState.exclusionOpen?'open':''}><summary>${tr(lang,'excludeCategories')} <span>${influenceState.excludedCategories.size}</span></summary><div class="category-exclusion-body"><input data-category-search type="search" aria-label="${lang==='sv'?'Sök bransch':'Hae toimialaa'}" value="${escapeHTML(influenceState.categoryQuery)}" placeholder="${escapeHTML(lang==='sv'?'Sök bransch…':'Hae toimialaa…')}"><div class="category-checklist">${categories.map(category=>`<label data-category-label="${escapeHTML(category.toLocaleLowerCase('fi'))}"><input type="checkbox" data-exclude-category value="${escapeHTML(category)}" ${influenceState.excludedCategories.has(category)?'checked':''}><span>${escapeHTML(category)}</span></label>`).join('')}</div></div></details>`:''}
    <div class="filter-actions"><p class="filter-summary" role="status" aria-live="polite">${formatNumber(filtered.length,lang)} ${kindLabel.toLocaleLowerCase(lang)}</p><div>${exportButtons('influence',lang)}${hasFilters?`<button type="button" data-influence-clear>${tr(lang,'clearFilters')}</button>`:''}</div></div></section>
    <div class="influence-list">${shown.length?shown.map(item=>influenceState.tab==='gifts'?`<article class="influence-card gift-card"><div class="influence-card-head"><div><span class="eyebrow">${escapeHTML(item.donor||tr(lang,'donor'))}</span><h2>${escapeHTML(item.mpName)}</h2></div><strong>${item.amount?formatMoney(item.amount,lang):'—'}</strong></div><p>${escapeHTML(lang==='sv'?(item.descriptionSv||item.description):item.description)}</p><dl><div><dt>${tr(lang,'party')}</dt><dd>${escapeHTML(String(item.party||'').toUpperCase())}</dd></div><div><dt>${tr(lang,'useTime')}</dt><dd>${escapeHTML(item.used||String(item.year))}</dd></div><div><dt>${lang==='sv'?'Anmäld':'Ilmoitettu'}</dt><dd>${escapeHTML(item.reported||'—')}</dd></div></dl></article>`:influenceState.tab==='interests'?`<article class="influence-card interest-card ${item.declared?'':'empty-declaration'}"><div class="influence-card-head"><div><span class="eyebrow">${escapeHTML(item.type==='income'?(lang==='sv'?'Inkomstanmälan':'Tuloilmoitus'):(lang==='sv'?'Bindningsanmälan':'Sidonnaisuusilmoitus'))}</span><h2>${escapeHTML(item.mpName)}</h2></div><span class="pill">${escapeHTML(String(item.year))}</span></div><h3>${escapeHTML(lang==='sv'?(item.categorySv||item.category):item.category)}</h3><p>${escapeHTML(lang==='sv'?(item.descriptionSv||item.description):item.description)}</p><dl><div><dt>${tr(lang,'party')}</dt><dd>${escapeHTML(influencePartyName(item.party,lang))}</dd></div><div><dt>${lang==='sv'?'Uppgiftstyp':'Ilmoitustyyppi'}</dt><dd>${item.type==='income'?(lang==='sv'?'Inkomst':'Tulo'):(lang==='sv'?'Bindning':'Sidonnaisuus')}</dd></div><div><dt>${lang==='sv'?'Status':'Tila'}</dt><dd>${item.declared?(lang==='sv'?'Anmäld uppgift':'Ilmoitettu tieto'):(lang==='sv'?'Inget att anmäla':'Ei ilmoitettavaa')}</dd></div></dl></article>`:
    `<article class="influence-card lobby-card"><div class="influence-card-head"><div><span class="eyebrow">${escapeHTML(item.industry||(lang==='sv'?'Bransch inte angiven':'Toimialaa ei ilmoitettu'))}</span><h2>${escapeHTML(item.actor)}</h2></div><span class="pill">${primaryTargetKind(item)==='mp'?tr(lang,'mps'):primaryTargetKind(item)==='assistant'?tr(lang,'assistants'):primaryTargetKind(item)==='parliament'?tr(lang,'parliament'):tr(lang,'allTargets')}</span></div><p class="lobby-topic">${escapeHTML(item.topic||'—')}</p><dl><div><dt>${tr(lang,'target')}</dt><dd>${escapeHTML(targetLabel(item,lang))}</dd></div><div><dt>${tr(lang,'party')}</dt><dd>${item.targetParties?.length?item.targetParties.map(party=>`<span class="pill">${escapeHTML(influencePartyName(party,lang))}</span>`).join(' '):'—'}</dd></div><div><dt>${tr(lang,'methods')}</dt><dd class="method-list">${item.methods.map(method=>`<span>${escapeHTML(methodName(method,lang))}</span>`).join('')||'—'}</dd></div><div><dt>${tr(lang,'period')}</dt><dd>${escapeHTML(item.period.start)}–${escapeHTML(item.period.end)}</dd></div></dl></article>`).join(''):`<div class="empty">${tr(lang,'noData')}</div>`}</div>
    ${shown.length<filtered.length?`<div class="load-more"><button data-influence-more>${tr(lang,'showMore')} <span>(${Math.min(100,filtered.length-shown.length)})</span></button><small>${shown.length} / ${filtered.length}</small></div>`:''}
    ${sourceNote(escapeHTML(influenceState.tab==='gifts'?tr(lang,'giftSourceText'):influenceState.tab==='interests'?tr(lang,'interestSourceText'):tr(lang,'sourceText')),[influenceState.tab==='lobbying'?{href:'https://www.avoimuusrekisteri.fi/',label:lang==='sv'?'Öppenhetsregistret':'Avoimuusrekisteri'}:{href:'https://api.eduskunta.fi/',label:lang==='sv'?'Riksdagens öppna data':'Eduskunnan avoin data'}])}</div>`;
  root.querySelectorAll('[data-influence-tab]').forEach(button=>button.onclick=()=>{influenceState.tab=button.dataset.influenceTab;Object.assign(influenceState,{query:'',year:'all',kind:'all',mp:'all',party:'all',actor:'all',method:'all',category:'all',categoryQuery:'',limit:100});influenceState.excludedCategories.clear();renderInfluenceContent(root,lang,escapeHTML,data)});
  attachExtra(root,'influence',extra,config,lang,'.filter-actions',()=>{influenceState.limit=100;renderInfluenceContent(root,lang,escapeHTML,data)});
  setupViewButtons(root,'[data-influence-tab]',lang);
  bindExportButtons(root,'influence',()=>filtered.map(item=>influenceState.tab==='gifts'?{mp:item.mpName,party:item.party,year:item.year,reported:item.reported,donor:item.donor,description:lang==='sv'?(item.descriptionSv||item.description):item.description,amount:item.amount,used:item.used}:influenceState.tab==='interests'?{mp:item.mpName,party:item.party,year:item.year,type:item.type,category:lang==='sv'?(item.categorySv||item.category):item.category,description:lang==='sv'?(item.descriptionSv||item.description):item.description,declared:item.declared}:{actor:item.actor,industry:item.industry,topic:item.topic,targets:targetLabel(item,lang),parties:item.targetParties,methods:item.methods,periodStart:item.period?.start,periodEnd:item.period?.end}),`vahtikissa-${influenceState.tab}`);
  const query=root.querySelector('[data-influence-search]');query.oninput=event=>{const position=event.target.selectionStart;influenceState.query=event.target.value;influenceState.limit=100;renderInfluenceContent(root,lang,escapeHTML,data);const input=root.querySelector('[data-influence-search]');input?.focus({preventScroll:true});input?.setSelectionRange(position,position)};
  root.querySelectorAll('[data-influence-filter]').forEach(select=>select.onchange=()=>{influenceState[select.dataset.influenceFilter]=select.value;if(select.dataset.influenceFilter==='category')influenceState.excludedCategories.delete(select.value);influenceState.limit=100;renderInfluenceContent(root,lang,escapeHTML,data)});
  const exclusions=root.querySelector('.category-exclusions');if(exclusions)exclusions.ontoggle=()=>{influenceState.exclusionOpen=exclusions.open};
  root.querySelectorAll('[data-exclude-category]').forEach(checkbox=>checkbox.onchange=()=>{checkbox.checked?influenceState.excludedCategories.add(checkbox.value):influenceState.excludedCategories.delete(checkbox.value);if(checkbox.checked&&influenceState.category===checkbox.value)influenceState.category='all';influenceState.exclusionOpen=true;influenceState.limit=100;renderInfluenceContent(root,lang,escapeHTML,data)});
  const categorySearch=root.querySelector('[data-category-search]');if(categorySearch)categorySearch.oninput=()=>{influenceState.categoryQuery=categorySearch.value;const normalized=categorySearch.value.trim().toLocaleLowerCase('fi');root.querySelectorAll('[data-category-label]').forEach(label=>label.hidden=Boolean(normalized&&!label.dataset.categoryLabel.includes(normalized)))};
  if(categorySearch&&influenceState.categoryQuery)categorySearch.dispatchEvent(new Event('input'));
  const clear=root.querySelector('[data-influence-clear]');if(clear)clear.onclick=()=>{Object.assign(influenceState,{query:'',year:'all',kind:'all',mp:'all',party:'all',actor:'all',method:'all',category:'all',categoryQuery:'',limit:100});influenceState.excludedCategories.clear();renderInfluenceContent(root,lang,escapeHTML,data)};
  const more=root.querySelector('[data-influence-more]');if(more)more.onclick=()=>{influenceState.limit+=100;renderInfluenceContent(root,lang,escapeHTML,data)};
  root.querySelectorAll('[data-influence-filter], [data-exclude-category], [data-influence-more], [data-influence-clear]').forEach(control=>{const event=control.tagName==='BUTTON'?'onclick':'onchange',action=control[event];control[event]=e=>preserveFocus(root,()=>action(e))});
}

export async function renderInfluence(root,lang,escapeHTML,members=[],memberId=''){
  const requested=location.hash;
  if(!cache.has('./data/influence.json')) loading(root,lang);
  try{
    const data=await load('./data/influence.json');
    prepareInfluenceData(data,members);
    if(memberId){
      const member=members.find(item=>String(item.id)===String(memberId));
      if(member){influenceState.mp=`${member.firstName||''} ${member.lastName||''}`.trim();influenceState.tab='interests';influenceState.limit=100;}
    }
    if(location.hash===requested&&document.documentElement.lang===lang)renderInfluenceContent(root,lang,escapeHTML,data);
  }catch(error){if(location.hash===requested)errorView(root,lang,escapeHTML,error,()=>renderInfluence(root,lang,escapeHTML,members))}
}
