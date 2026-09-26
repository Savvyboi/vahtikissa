import { filterBudgetItems, filterElectionCandidates, filterInfluence } from './civic-utils.js';

const cache = new Map();
const budgetState = { metric: 'budget', query: '' };
const electionState = { tab: 'parties', query: '', party: 'all', district: 'all' };
const influenceState = { tab: 'gifts', query: '', year: 'all', kind: 'all', limit: 100 };
const colors = ['#003b70', '#6f2da8', '#287b70', '#b45309', '#8f3548', '#47682c', '#335c81', '#795548', '#5c5aa7', '#1d6b52', '#9a4d22', '#596273'];
const partyColors = { '03':'#245b87', '02':'#40577a', '01':'#9a3948', '04':'#2f6b52', '05':'#4b7044', '06':'#9a4055', '07':'#95601e', '08':'#5a5684', '09':'#356c70' };
const text = {
  fi: {
    budget:'Valtion budjetti', budgetLead:'Tutki valtion tuloja ja menoja vuosittain pääluokasta yksittäiseen momenttiin.',
    elections:'Eduskuntavaalit 2023', electionLead:'Viralliset tulokset puolueittain, vaalipiireittäin ja valittuina kansanedustajina.',
    influence:'Lahjat ja lobbaus', influenceLead:'Kansanedustajien lahjailmoitukset ja avoimuusrekisteriin ilmoitetut yhteydenotot eduskuntaan.',
    updated:'Päivitetty', expense:'Menot', income:'Tulot', budgetMetric:'Talousarvio', actual:'Toteuma', search:'Hae nimellä tai tunnuksella…',
    compared:'edellisvuodesta', noData:'Ei tietoja valituilla rajauksilla.', officialTerms:'Yksityiskohtaiset budjettinimet ovat lähdeaineistossa suomeksi.',
    parties:'Puolueet', elected:'Valitut', votes:'ääntä', seats:'paikkaa', turnout:'Äänestysprosentti', voters:'Äänestäneitä', eligible:'Äänioikeutettuja', rejected:'Hylättyjä ääniä',
    wholeCountry:'Koko maa', district:'Vaalipiiri', party:'Puolue', candidateSearch:'Hae valittua nimellä…', candidate:'Valittu', comparison:'Vertausluku',
    gifts:'Lahjat', lobbying:'Lobbaus', contacts:'Yhteydenottoja', topics:'ilmoitettua aihetta', giftValue:'Ilmoitettu arvo', actors:'Ilmoittajaa', donor:'Antaja', recipient:'Vastaanottaja', value:'Arvo', useTime:'Käyttöaika',
    allYears:'Kaikki vuodet', allTargets:'Kaikki eduskuntakohteet', mps:'Kansanedustajat', assistants:'Avustajat', parliament:'Ryhmät ja eduskunta',
    actor:'Ilmoittaja', topic:'Aihe', target:'Kohde', methods:'Yhteydenpitotavat', period:'Ilmoituskausi', showMore:'Näytä lisää',
    sourceText:'Lähdetiedot ovat ilmoittajien itsensä toimittamia. Merkintä kertoo ilmoitetusta yhteydenotosta, ei sen vaikutuksesta päätöksiin.',
    giftSourceText:'Lahjat ovat Eduskunnan avoimen datan julkaisemia kansanedustajien lahjailmoituksia. Tekstit näytetään virallisen lähteen muodossa.'
  },
  sv: {
    budget:'Statsbudgeten', budgetLead:'Utforska statens inkomster och utgifter per år, från huvudtitel till enskilt moment.',
    elections:'Riksdagsvalet 2023', electionLead:'Officiella resultat per parti och valkrets samt alla invalda riksdagsledamöter.',
    influence:'Gåvor och lobbning', influenceLead:'Ledamöternas gåvoanmälningar och kontakter till riksdagen som anmälts till öppenhetsregistret.',
    updated:'Uppdaterad', expense:'Utgifter', income:'Inkomster', budgetMetric:'Budget', actual:'Utfall', search:'Sök med namn eller kod…',
    compared:'från föregående år', noData:'Inga uppgifter med de valda avgränsningarna.', officialTerms:'Detaljerade budgetbenämningar finns endast på finska i källdatan.',
    parties:'Partier', elected:'Invalda', votes:'röster', seats:'mandat', turnout:'Valdeltagande', voters:'Väljare', eligible:'Röstberättigade', rejected:'Kasserade röster',
    wholeCountry:'Hela landet', district:'Valkrets', party:'Parti', candidateSearch:'Sök invald med namn…', candidate:'Invald', comparison:'Jämförelsetal',
    gifts:'Gåvor', lobbying:'Lobbning', contacts:'Kontakter', topics:'anmälda ämnen', giftValue:'Anmält värde', actors:'Anmälare', donor:'Givare', recipient:'Mottagare', value:'Värde', useTime:'Användningstid',
    allYears:'Alla år', allTargets:'Alla riksdagsmål', mps:'Riksdagsledamöter', assistants:'Assistenter', parliament:'Grupper och riksdagen',
    actor:'Anmälare', topic:'Ämne', target:'Mål', methods:'Kontaktformer', period:'Anmälningsperiod', showMore:'Visa fler',
    sourceText:'Källuppgifterna har lämnats av anmälarna själva. En post visar en anmäld kontakt, inte dess inverkan på besluten.',
    giftSourceText:'Gåvorna är ledamöternas gåvoanmälningar som publicerats i riksdagens öppna data. Texten visas i den officiella källans form.'
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
  if (!cache.has(path)) cache.set(path, fetch(path).then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }).catch(error => { cache.delete(path); throw error; }));
  return cache.get(path);
}

function loading(root, lang) {
  root.innerHTML = `<section class="loading"><span class="spinner"></span><p>${lang === 'sv' ? 'Öppna data laddas…' : 'Ladataan avointa dataa…'}</p></section>`;
}

function errorView(root, lang, escapeHTML, error) {
  root.innerHTML = `<div class="page"><div class="empty"><h2>${lang === 'sv' ? 'Uppgifterna kunde inte laddas' : 'Tietoja ei voitu ladata'}</h2><p>${escapeHTML(error.message)}</p></div></div>`;
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

function renderBudgetContent(root, lang, escapeHTML, data, routeId = '') {
  const route = String(routeId || '').split('/').filter(Boolean);
  const latest = data.years.at(-1);
  const yearNumber = Number(route[0]);
  const yearData = data.years.find(item => item.year === yearNumber) || latest;
  const type = route[1] === 'income' ? 'income' : 'expense';
  const codes = route.slice(2, 4);
  const currentLevel = findBudgetLevel(yearData, codes);
  const allItems = currentLevel?.children || yearData[type];
  const items = filterBudgetItems(allItems || [], budgetState.query);
  const total = (yearData[type] || []).reduce((sum, item) => sum + metricValue(item), 0);
  const incomeTotal = yearData.income.reduce((sum, item) => sum + metricValue(item), 0);
  const expenseTotal = yearData.expense.reduce((sum, item) => sum + metricValue(item), 0);
  const previous = data.years.find(item => item.year === yearData.year - 1);
  const previousLevel = previous ? findBudgetLevel(previous, codes) : null;
  const previousItems = previousLevel?.children || previous?.[type] || [];
  const max = Math.max(1, ...items.map(metricValue));
  const crumbs = [
    `<a href="${budgetPath(yearData.year,type)}">${tr(lang,type)}</a>`,
    ...codes.map((code,index) => {
      const node = findBudgetLevel(yearData,codes.slice(0,index+1));
      return `<a href="${budgetPath(yearData.year,type,codes.slice(0,index+1))}">${escapeHTML(localized(node?.name,lang)||code)}</a>`;
    })
  ];
  root.innerHTML = `<div class="page civic-page budget-page">
    ${pageHeader(lang,escapeHTML,lang==='sv'?'Statskontoret · öppen data':'Valtiokonttori · avoin data',tr(lang,'budget'),tr(lang,'budgetLead'),data.metadata.generatedAt)}
    <div class="civic-toolbar budget-toolbar">
      <label class="filter-control"><span>${lang==='sv'?'År':'Vuosi'}</span><select data-budget-year>${data.years.map(item=>`<option value="${item.year}" ${item.year===yearData.year?'selected':''}>${item.year}${item.latestMonth<12?` · ${item.latestMonth}/${12}`:''}</option>`).join('')}</select></label>
      <div class="segmented" role="group" aria-label="${lang==='sv'?'Typ':'Tyyppi'}"><a class="${type==='expense'?'active':''}" href="${budgetPath(yearData.year,'expense')}">${tr(lang,'expense')}</a><a class="${type==='income'?'active':''}" href="${budgetPath(yearData.year,'income')}">${tr(lang,'income')}</a></div>
      <div class="segmented" role="group" aria-label="${lang==='sv'?'Mått':'Mittari'}"><button data-budget-metric="budget" class="${budgetState.metric==='budget'?'active':''}">${tr(lang,'budgetMetric')}</button><button data-budget-metric="actual" class="${budgetState.metric==='actual'?'active':''}">${tr(lang,'actual')}</button></div>
    </div>
    <section class="budget-summary" aria-label="${tr(lang,'budget')}"><div><span>${tr(lang,type)} ${yearData.year}</span><strong>${formatMoney(total,lang,true)}</strong></div><div><span>${tr(lang,'income')}</span><strong>${formatMoney(incomeTotal,lang,true)}</strong></div><div><span>${tr(lang,'expense')}</span><strong>${formatMoney(expenseTotal,lang,true)}</strong></div><div><span>${lang==='sv'?'Balans':'Tasapaino'}</span><strong class="${incomeTotal-expenseTotal<0?'negative':''}">${formatMoney(incomeTotal-expenseTotal,lang,true)}</strong></div></section>
    <nav class="budget-crumbs" aria-label="${lang==='sv'?'Sökväg':'Murupolku'}">${crumbs.join('<span>›</span>')}</nav>
    <div class="filters civic-search"><input data-budget-search type="search" value="${escapeHTML(budgetState.query)}" placeholder="${escapeHTML(tr(lang,'search'))}" aria-label="${escapeHTML(tr(lang,'search'))}"></div>
    <div class="budget-bars">${items.length?items.map((item,index)=>{
      const old=previousItems.find(previousItem=>previousItem.code===item.code),value=metricValue(item),oldValue=metricValue(old),delta=oldValue?(value-oldValue)/oldValue*100:null;
      const childCodes=[...codes,item.code];const hasChildren=item.children?.length;
      return `<article class="budget-row" style="--budget-color:${colors[(Number(item.code.slice(-2))||index)%colors.length]}"><div class="budget-row-head"><div><span class="pill">${escapeHTML(item.code)}</span>${hasChildren?`<a href="${budgetPath(yearData.year,type,childCodes)}">${escapeHTML(localized(item.name,lang))}</a>`:`<strong>${escapeHTML(localized(item.name,lang))}</strong>`}</div><div><strong>${formatMoney(value,lang,true)}</strong>${delta!==null?`<small class="${delta>0?'up':delta<0?'down':''}">${delta>0?'+':''}${formatNumber(delta,lang,1)} % ${tr(lang,'compared')}</small>`:''}</div></div><div class="budget-track" role="img" aria-label="${escapeHTML(localized(item.name,lang))}: ${formatMoney(value,lang)}"><span style="width:${pct(value,max)}%"></span></div></article>`;
    }).join(''):`<div class="empty">${tr(lang,'noData')}</div>`}</div>
    ${sourceNote(escapeHTML(tr(lang,'officialTerms')),[{href:'https://avoindata.tutkihallintoa.fi/api-details#api=valtiontalous&operation=BudjettitaloudenTapahtumatTiedostot',label:lang==='sv'?'Statskontorets budget-API':'Valtiokonttorin budjettirajapinta'}])}
  </div>`;
  root.querySelector('[data-budget-year]').onchange = event => { location.hash = budgetPath(event.target.value,type); };
  root.querySelectorAll('[data-budget-metric]').forEach(button => button.onclick=()=>{budgetState.metric=button.dataset.budgetMetric;renderBudgetContent(root,lang,escapeHTML,data,[yearData.year,type,...codes].join('/'))});
  root.querySelector('[data-budget-search]').oninput = event => {budgetState.query=event.target.value;renderBudgetContent(root,lang,escapeHTML,data,[yearData.year,type,...codes].join('/'));root.querySelector('[data-budget-search]')?.focus()};
}

export async function renderBudget(root, lang, routeId, escapeHTML) {
  loading(root,lang);
  try { renderBudgetContent(root,lang,escapeHTML,await load('./data/budget.json'),routeId); }
  catch (error) { errorView(root,lang,escapeHTML,error); }
}

function electionStats(data,lang) {
  const stats=[['turnout',`${formatNumber(data.summary.turnout,lang,1)} %`],['voters',formatNumber(data.summary.voters,lang)],['eligible',formatNumber(data.summary.eligible,lang)],['seats',formatNumber(data.summary.seats,lang)]];
  return `<div class="civic-stat-grid">${stats.map(([key,value])=>`<div><span>${tr(lang,key)}</span><strong>${value}</strong></div>`).join('')}</div>`;
}

function renderElectionContent(root,lang,escapeHTML,data) {
  const districtName = code => localized(data.districts.find(item=>item.code===code)?.name,lang);
  const selectedDistrict=electionState.district;
  const partyRows=(selectedDistrict==='all'?data.parties:data.districtResults.filter(item=>item.locationCode===selectedDistrict).map(item=>({code:item.partyCode,name:item.party,votes:item.votes,share:item.share,seats:data.candidates.filter(c=>c.districtCode===selectedDistrict&&c.partyCode===item.partyCode).length}))).sort((a,b)=>b.votes-a.votes);
  const candidates=filterElectionCandidates(data.candidates,{query:electionState.query,party:electionState.party,district:electionState.district});
  root.innerHTML=`<div class="page civic-page election-page">${pageHeader(lang,escapeHTML,lang==='sv'?'Statistikcentralen · officiell statistik':'Tilastokeskus · virallinen tilasto',tr(lang,'elections'),tr(lang,'electionLead'),data.metadata.generatedAt)}${electionStats(data,lang)}
    <div class="tab-list" role="tablist"><button role="tab" aria-selected="${electionState.tab==='parties'}" data-election-tab="parties">${tr(lang,'parties')}</button><button role="tab" aria-selected="${electionState.tab==='candidates'}" data-election-tab="candidates">${tr(lang,'elected')} <span>${data.candidates.length}</span></button></div>
    ${electionState.tab==='parties'?`<div class="civic-toolbar"><label class="filter-control"><span>${tr(lang,'district')}</span><select data-election-district><option value="all">${tr(lang,'wholeCountry')}</option>${data.districts.map(item=>`<option value="${item.code}" ${selectedDistrict===item.code?'selected':''}>${escapeHTML(localized(item.name,lang).replace(/^VP\d+\s*/,''))}</option>`).join('')}</select></label></div><div class="election-bars">${partyRows.map((party,index)=>`<article class="election-party" style="--party-color:${partyColors[party.code]||colors[index%colors.length]}"><div class="election-party-name"><span class="party-swatch"></span><strong>${escapeHTML(localized(party.name,lang))}</strong><span>${party.seats} ${tr(lang,'seats')}</span></div><div class="election-party-result"><strong>${formatNumber(party.share,lang,1)} %</strong><span>${formatNumber(party.votes,lang)} ${tr(lang,'votes')}</span></div><div class="election-track"><span style="width:${pct(party.share,Math.max(...partyRows.map(item=>item.share)))}%"></span></div></article>`).join('')}</div>`:
    `<div class="filters election-filters"><input data-candidate-search type="search" value="${escapeHTML(electionState.query)}" placeholder="${escapeHTML(tr(lang,'candidateSearch'))}"><select data-candidate-party aria-label="${tr(lang,'party')}"><option value="all">${tr(lang,'parties')}</option>${data.parties.map(item=>`<option value="${item.code}" ${electionState.party===item.code?'selected':''}>${escapeHTML(localized(item.name,lang))}</option>`).join('')}</select><select data-candidate-district aria-label="${tr(lang,'district')}"><option value="all">${tr(lang,'wholeCountry')}</option>${data.districts.map(item=>`<option value="${item.code}" ${electionState.district===item.code?'selected':''}>${escapeHTML(localized(item.name,lang).replace(/^VP\d+\s*/,''))}</option>`).join('')}</select></div><p class="filter-summary">${candidates.length} ${tr(lang,'elected').toLocaleLowerCase(lang)}</p><div class="candidate-grid">${candidates.map(candidate=>`<article class="candidate-card"><div class="avatar">${escapeHTML(candidate.name.split(/\s+/).slice(0,2).map(part=>part[0]).join(''))}</div><div><h3>${escapeHTML(candidate.name)}</h3><p><span class="pill">${escapeHTML(localized(candidate.party,lang))}</span> ${escapeHTML(localized(candidate.district,lang).replace(/^VP\d+\s*/,''))}</p><strong>${formatNumber(candidate.votes,lang)} ${tr(lang,'votes')}</strong><small>${tr(lang,'comparison')} ${formatNumber(candidate.comparison,lang,0)}</small></div></article>`).join('')}</div>`}
    ${sourceNote(`${lang==='sv'?'Valresultaten är Statistikcentralens officiella statistik.':'Vaalitulokset ovat Tilastokeskuksen virallista tilastoa.'}`,[{href:'https://pxdata.stat.fi/PxWeb/pxweb/fi/StatFin/StatFin__evaa/',label:lang==='sv'?'Statistikcentralens databaser':'Tilastokeskuksen tietokannat'}])}</div>`;
  root.querySelectorAll('[data-election-tab]').forEach(button=>button.onclick=()=>{electionState.tab=button.dataset.electionTab;electionState.query='';electionState.party='all';electionState.district='all';renderElectionContent(root,lang,escapeHTML,data)});
  const district=root.querySelector('[data-election-district]');if(district)district.onchange=event=>{electionState.district=event.target.value;renderElectionContent(root,lang,escapeHTML,data)};
  const query=root.querySelector('[data-candidate-search]');if(query)query.oninput=event=>{electionState.query=event.target.value;renderElectionContent(root,lang,escapeHTML,data);root.querySelector('[data-candidate-search]')?.focus()};
  const party=root.querySelector('[data-candidate-party]');if(party)party.onchange=event=>{electionState.party=event.target.value;renderElectionContent(root,lang,escapeHTML,data)};
  const candidateDistrict=root.querySelector('[data-candidate-district]');if(candidateDistrict)candidateDistrict.onchange=event=>{electionState.district=event.target.value;renderElectionContent(root,lang,escapeHTML,data)};
}

export async function renderElections(root,lang,escapeHTML) {
  loading(root,lang);
  try { renderElectionContent(root,lang,escapeHTML,await load('./data/elections-2023.json')); }
  catch(error){ errorView(root,lang,escapeHTML,error); }
}

const methodNames={fi:{meeting:'Tapaaminen',phone:'Puhelu',mail:'Sähköposti',social_media:'Sosiaalinen media',event:'Tilaisuus',other:'Muu'},sv:{meeting:'Möte',phone:'Telefonsamtal',mail:'E-post',social_media:'Sociala medier',event:'Evenemang',other:'Övrigt'}};
function methodName(method,lang){return methodNames[lang]?.[method]||methodNames.fi[method]||method.replaceAll('_',' ')}

function oneTargetLabel(target,lang){const value=target?.[lang]||target?.fi||{};return [value.name,value.title,value.department||value.organization].filter(Boolean).join(' · ')}
function targetLabel(item,lang){
  const targets=item.targets||[item.target].filter(Boolean);
  const labels=targets.slice(0,3).map(target=>oneTargetLabel(target,lang)).filter(Boolean);
  if(targets.length>3)labels.push(lang==='sv'?`+ ${targets.length-3} andra`:`+ ${targets.length-3} muuta`);
  return labels.join('; ');
}

function primaryTargetKind(item){return item.targetKinds?.length===1?item.targetKinds[0]:item.targetKind||'all'}

function renderInfluenceContent(root,lang,escapeHTML,data){
  const source=influenceState.tab==='gifts'?data.gifts:data.lobbying;
  const years=[...new Set(source.map(item=>item.year||item.periodYear).filter(Boolean))].sort((a,b)=>b-a);
  const filtered=filterInfluence(source,{query:influenceState.query,year:influenceState.year,kind:influenceState.kind});
  const shown=filtered.slice(0,influenceState.limit);
  root.innerHTML=`<div class="page civic-page influence-page">${pageHeader(lang,escapeHTML,lang==='sv'?'Riksdagen och öppenhetsregistret':'Eduskunta ja avoimuusrekisteri',tr(lang,'influence'),tr(lang,'influenceLead'),data.metadata.generatedAt)}
    <div class="civic-stat-grid influence-stats"><div><span>${tr(lang,'gifts')}</span><strong>${formatNumber(data.counts.gifts,lang)}</strong></div><div><span>${tr(lang,'giftValue')}</span><strong>${formatMoney(data.counts.giftValue,lang,true)}</strong></div><div><span>${tr(lang,'contacts')}</span><strong>${formatNumber(data.counts.lobbying,lang)}</strong></div><div><span>${tr(lang,'actors')}</span><strong>${formatNumber(data.counts.actors,lang)}</strong></div></div>
    <div class="tab-list" role="tablist"><button role="tab" aria-selected="${influenceState.tab==='gifts'}" data-influence-tab="gifts">${tr(lang,'gifts')}</button><button role="tab" aria-selected="${influenceState.tab==='lobbying'}" data-influence-tab="lobbying">${tr(lang,'lobbying')}</button></div>
    <div class="filters influence-filters"><input data-influence-search type="search" value="${escapeHTML(influenceState.query)}" placeholder="${escapeHTML(influenceState.tab==='gifts'?(lang==='sv'?'Sök givare, ledamot eller gåva…':'Hae antajaa, edustajaa tai lahjaa…'):(lang==='sv'?'Sök anmälare, ämne eller mål…':'Hae ilmoittajaa, aihetta tai kohdetta…'))}"><select data-influence-year><option value="all">${tr(lang,'allYears')}</option>${years.map(year=>`<option value="${year}" ${String(influenceState.year)===String(year)?'selected':''}>${year}</option>`).join('')}</select>${influenceState.tab==='lobbying'?`<select data-influence-kind><option value="all">${tr(lang,'allTargets')}</option><option value="mp" ${influenceState.kind==='mp'?'selected':''}>${tr(lang,'mps')}</option><option value="assistant" ${influenceState.kind==='assistant'?'selected':''}>${tr(lang,'assistants')}</option><option value="parliament" ${influenceState.kind==='parliament'?'selected':''}>${tr(lang,'parliament')}</option></select>`:''}</div>
    <p class="filter-summary">${formatNumber(filtered.length,lang)} ${influenceState.tab==='gifts'?tr(lang,'gifts').toLocaleLowerCase(lang):tr(lang,'topics')}</p>
    <div class="influence-list">${shown.length?shown.map(item=>influenceState.tab==='gifts'?`<article class="influence-card gift-card"><div class="influence-card-head"><div><span class="eyebrow">${escapeHTML(item.donor||tr(lang,'donor'))}</span><h2>${escapeHTML(item.mpName)}</h2></div><strong>${item.amount?formatMoney(item.amount,lang):'—'}</strong></div><p>${escapeHTML(lang==='sv'?(item.descriptionSv||item.description):item.description)}</p><dl><div><dt>${tr(lang,'party')}</dt><dd>${escapeHTML(String(item.party||'').toUpperCase())}</dd></div><div><dt>${tr(lang,'useTime')}</dt><dd>${escapeHTML(item.used||String(item.year))}</dd></div><div><dt>${lang==='sv'?'Anmäld':'Ilmoitettu'}</dt><dd>${escapeHTML(item.reported||'—')}</dd></div></dl></article>`:
    `<article class="influence-card lobby-card"><div class="influence-card-head"><div><span class="eyebrow">${escapeHTML(item.industry)}</span><h2>${escapeHTML(item.actor)}</h2></div><span class="pill">${primaryTargetKind(item)==='mp'?tr(lang,'mps'):primaryTargetKind(item)==='assistant'?tr(lang,'assistants'):primaryTargetKind(item)==='parliament'?tr(lang,'parliament'):tr(lang,'allTargets')}</span></div><p class="lobby-topic">${escapeHTML(item.topic||'—')}</p><dl><div><dt>${tr(lang,'target')}</dt><dd>${escapeHTML(targetLabel(item,lang))}</dd></div><div><dt>${tr(lang,'methods')}</dt><dd class="method-list">${item.methods.map(method=>`<span>${escapeHTML(methodName(method,lang))}</span>`).join('')||'—'}</dd></div><div><dt>${tr(lang,'period')}</dt><dd>${escapeHTML(item.period.start)}–${escapeHTML(item.period.end)}</dd></div></dl></article>`).join(''):`<div class="empty">${tr(lang,'noData')}</div>`}</div>
    ${shown.length<filtered.length?`<div class="load-more"><button data-influence-more>${tr(lang,'showMore')} <span>(${Math.min(100,filtered.length-shown.length)})</span></button><small>${shown.length} / ${filtered.length}</small></div>`:''}
    ${sourceNote(escapeHTML(influenceState.tab==='gifts'?tr(lang,'giftSourceText'):tr(lang,'sourceText')),[influenceState.tab==='gifts'?{href:'https://api.eduskunta.fi/',label:lang==='sv'?'Riksdagens öppna data':'Eduskunnan avoin data'}:{href:'https://www.avoimuusrekisteri.fi/',label:lang==='sv'?'Öppenhetsregistret':'Avoimuusrekisteri'}])}</div>`;
  root.querySelectorAll('[data-influence-tab]').forEach(button=>button.onclick=()=>{influenceState.tab=button.dataset.influenceTab;influenceState.query='';influenceState.year='all';influenceState.kind='all';influenceState.limit=100;renderInfluenceContent(root,lang,escapeHTML,data)});
  const query=root.querySelector('[data-influence-search]');query.oninput=event=>{influenceState.query=event.target.value;influenceState.limit=100;renderInfluenceContent(root,lang,escapeHTML,data);root.querySelector('[data-influence-search]')?.focus()};
  root.querySelector('[data-influence-year]').onchange=event=>{influenceState.year=event.target.value;influenceState.limit=100;renderInfluenceContent(root,lang,escapeHTML,data)};
  const kind=root.querySelector('[data-influence-kind]');if(kind)kind.onchange=event=>{influenceState.kind=event.target.value;influenceState.limit=100;renderInfluenceContent(root,lang,escapeHTML,data)};
  const more=root.querySelector('[data-influence-more]');if(more)more.onclick=()=>{influenceState.limit+=100;renderInfluenceContent(root,lang,escapeHTML,data)};
}

export async function renderInfluence(root,lang,escapeHTML){
  loading(root,lang);
  try{
    const data=await load('./data/influence.json');
    if(data.targets&&!data.lobbying[0]?.targets){const targets=new Map(data.targets.map(target=>[target.id,target]));for(const item of data.lobbying)item.targets=item.targetIds.map(id=>targets.get(id)).filter(Boolean)}
    renderInfluenceContent(root,lang,escapeHTML,data);
  }catch(error){errorView(root,lang,escapeHTML,error)}
}
