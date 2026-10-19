import { foldFilterToolbars } from './filter-panels.js';
import { budgetLevel, budgetClosestPath, budgetShare, budgetChange, budgetTotals, budgetTreemap, budgetEntries, searchBudgetEntries } from './budget-utils.js';
import { fetchJSONWithTimeout } from './app-utils.js';
import { preservePageScroll, pushRoute } from './navigation.js';
import { exportButtons, bindExportButtons } from './data-tools.js';
import { collectionState, activeFilterCount, applyCollection, facetOptions, mountCollectionTools, preserveFocus } from './collection-tools.js';

let snapshot, lastRoute;
const state = { metric: 'budget', view: 'map', query: '', searchScope: 'all', compare: false, toolsOpen: false, notice: '' };
const filters = new Map();
const palette = ['#245b87','#7133a0','#386b30','#116a72','#8f3548','#776020','#39567b','#635299','#276650','#924a28','#455b71','#7d4870'];
const locale = lang => lang==='en'?'en-GB':lang==='sv'?'sv-FI':'fi-FI';
const name = (item,lang) => {
  const text=item?.name?.[lang] || item?.name?.fi || item?.code || '';
  return text && text===text.toLocaleUpperCase(lang) ? text[0]+text.slice(1).toLocaleLowerCase(lang) : text;
};
const number = (n,lang,digits=1) => new Intl.NumberFormat(locale(lang),{maximumFractionDigits:digits}).format(n);
const money = (n,lang) => Math.abs(n)>=1e9 ? `${number(n/1e9,lang)} ${lang==='en'?'bn €':lang==='sv'?'md €':'mrd. €'}` : Math.abs(n)>=1e6 ? `${number(n/1e6,lang)} ${lang==='en'?'m €':lang==='sv'?'mn €':'milj. €'}` : `${number(n,lang,0)} €`;
const path = (year,type,codes=[]) => `#/budget/${[year,type,...codes].join('/')}`;
const amount = item => Number.isFinite(Number(item?.[state.metric])) ? Number(item[state.metric]) : 0;
const codeLabel = code => String(code).match(/.{1,2}/g)?.join('.') || '';

export async function renderBudget(root,lang,routeId,escapeHTML) {
  const requested = location.hash;
  const L = (fi,sv,en=fi) => lang==='en'?en:lang==='sv'?sv:fi, e=escapeHTML;
  try {
    if (!snapshot) snapshot = await fetchJSONWithTimeout('./data/budget.json');
    if (!Array.isArray(snapshot.years) || !snapshot.years.length) throw new Error('Empty budget snapshot');
    if (requested!==location.hash || document.documentElement.lang!==lang || root.dataset.view==='simple') return;
    if (lastRoute!==requested) { state.query=''; state.notice=''; }
    draw(routeId);
    root.setAttribute('aria-busy','false');
  } catch (error) {
    if (requested!==location.hash || document.documentElement.lang!==lang || root.dataset.view==='simple') return;
    root.setAttribute('aria-busy','false');
    root.innerHTML=`<div class="page"><section class="load-error" role="alert"><h1>${L('Budjettia ei voitu ladata','Budgeten kunde inte laddas','The budget could not be loaded')}</h1><p>${L('Tallennettua budjettiaineistoa ei saatu avattua. Tarkista verkkoyhteys ja yritä uudelleen.','Det sparade budgetmaterialet kunde inte öppnas. Kontrollera anslutningen och försök igen.','The saved budget data could not be opened. Check your connection and try again.')}</p><button data-budget-retry>${L('Yritä uudelleen','Försök igen','Try again')}</button></section></div>`;
    root.querySelector('[data-budget-retry]').onclick=()=>{root.setAttribute('aria-busy','true');snapshot=undefined;renderBudget(root,lang,routeId,e);};
  }
  function draw(id='') {
    const route=String(id||'').split('/').filter(Boolean), years=snapshot.years;
    const foundYear=years.find(y=>String(y.year)===route[0]), year=foundYear||years.at(-1);
    const type=route[1]==='income'?'income':'expense', codes=route.slice(2);
    const level=route[0]&&!foundYear?{valid:false,node:null,items:[]}:budgetLevel(year,type,codes);
    const previous=years.find(y=>y.year===year.year-1), totals=budgetTotals(year,state.metric);
    if (level.valid && level.node && !level.items.length) state.searchScope='all';
    const searching=Boolean(state.query.trim()) && level.valid, globalSearch=searching&&state.searchScope==='all';
    const scope=globalSearch?totals[type]:level.node?amount(level.node):totals[type];
    const title=globalSearch?L('Hakutulokset koko vuoden budjetista','Sökresultat i hela årets budget','Search results across the annual budget'):level.node?name(level.node,lang):L(type==='income'?'Mistä rahat tulevat?':'Mihin rahat menevät?',type==='income'?'Varifrån kommer pengarna?':'Vart går pengarna?',type==='income'?'Where does the money come from?':'Where does the money go?');
    const itemName=item=>`<span lang="${item?.name?.[lang]?lang:item?.name?.fi?'fi':lang}">${e(name(item,lang))}</span>`;
    const pool=globalSearch?budgetEntries(year,type):level.items.map(item=>({...item,path:[...codes,item.code]}));
    const searched=searchBudgetEntries(pool,state.query);
    const key=`${year.year}-${type}-${codes.join('-')}-${globalSearch?'search':'level'}`;
    if(!filters.has(key))filters.set(key,collectionState('amount','desc'));
    const extra=filters.get(key), filterCount=activeFilterCount(extra), activeCount=filterCount+(searching?1:0);
    const config={label:L('Budjetti','Budget','Budget'),sorts:[{key:'amount',label:L('Summa','Belopp','Amount'),value:amount},{key:'name',label:L('Nimi','Namn','Name'),value:item=>name(item,lang)},{key:'code',label:L('Tunnus','Kod','Code'),value:item=>item.code}],number:{label:L('Summa (€)','Belopp (€)','Amount (€)'),value:amount},facets:[{key:'code',label:L('Budjettikohdat','Budgetposter','Budget items'),value:item=>item.code,options:facetOptions(pool,item=>item.code,code=>name(pool.find(x=>x.code===code),lang),lang)}]};
    const items=applyCollection(searched,extra,config,lang);
    const comparisonAllowed=state.metric!=='actual'||year.latestMonth===previous?.latestMonth;
    const delta=item=>{
      const old=budgetLevel(previous,type,item.path||codes);
      return comparisonAllowed&&old.valid&&old.node?budgetChange(amount(item),amount(old.node)):null;
    };
    const change=item=>{const value=delta(item);return value===null?'—':`${value>0?'+':''}${number(value,lang)} %`;};
    const share=item=>{const value=budgetShare(amount(item),scope);return value===null?'—':value>0&&value<.1?`< ${number(.1,lang)} %`:value<0&&value>-.1?`> −${number(.1,lang)} %`:number(value,lang)+' %';};
    const color=item=>palette[(Number(item.code.slice(0,2))||0)%palette.length];
    const link=item=>path(year.year,type,item.path);
    const metricLabel={budget:L('Voimassa oleva talousarvio','Gällande budget','Current budget'),original:L('Alkuperäinen talousarvio','Ursprunglig budget','Original budget'),actual:L('Toteuma','Utfall','Actual spending / income')}[state.metric];
    const actualEnd=new Intl.DateTimeFormat(locale(lang),{day:'numeric',month:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year.year,year.latestMonth,0)));
    const metricNote=state.metric==='actual'?L(`Kertymä 1.1.–${actualEnd}. Keskeneräinen vuosi ei ole koko vuoden toteuma.`,`Ackumulerat utfall till och med månad ${year.latestMonth}/${year.year}. Ett pågående år visar inte helårsutfallet.`,`Year to date, through ${actualEnd}. A partial year is not a full-year result.`):state.metric==='original'?L('Eduskunnan hyväksymä alkuperäinen vuositason talousarvio, ilman lisätalousarvioita.','Den ursprungliga årsbudgeten som riksdagen godkänt, utan tilläggsbudgetar.','The annual budget originally approved by Parliament, before supplementary budgets.'):L('Vuositason talousarvio, joka sisältää julkaistut lisätalousarviot.','Årsbudgeten inklusive publicerade tilläggsbudgetar.','The annual budget including published supplementary budgets.');
    const rootLabel=L(type==='income'?'Tulot ja lainanotto':'Kaikki menot',type==='income'?'Inkomster och upplåning':'Alla utgifter',type==='income'?'Income and borrowing':'All spending');
    const crumbs=[`<a data-budget-route href="${path(year.year,type)}" ${!codes.length?'aria-current="page"':''}>${rootLabel}</a>`,...codes.map((code,i)=>{const node=budgetLevel(year,type,codes.slice(0,i+1)).node;return `<a data-budget-route href="${path(year.year,type,codes.slice(0,i+1))}" ${i===codes.length-1?'aria-current="page"':''}>${e(codeLabel(code))} · ${itemName(node)}</a>`;})];
    const labels=[[L('Menot','Utgifter','Spending'),totals.expense],[L('Tulot ilman lainanottoa','Inkomster utan lån','Income excluding borrowing'),totals.revenue],[L('Lainanotto (netto)','Upplåning (netto)','Net borrowing'),totals.borrowing],[L('Tasapaino ilman lainanottoa','Balans utan upplåning','Balance excluding borrowing'),totals.balance]];
    const leaf=level.valid&&level.node&&!level.items.length&&!globalSearch;
    const chart=items.length&&!globalSearch&&state.view!=='table';
    const rectangles=chart&&state.view==='map'?budgetTreemap(items,amount):[];
    const nonPositive=items.filter(item=>amount(item)<=0).length;
    const maxBar=Math.max(...items.map(item=>Math.abs(amount(item))),0);
    const ancestorLabel=item=>(item.ancestors||[]).map(node=>name(node,lang)).join(' › ');
    const parent=budgetLevel(year,type,codes.slice(0,-1)).node;
    const backLink=codes.length?`<a data-budget-route class="budget-back" href="${path(year.year,type,codes.slice(0,-1))}"><span aria-hidden="true">←</span> <span>${L('Takaisin','Tillbaka','Back')}<small>${parent?itemName(parent):rootLabel}</small></span></a>`:'';
    const resultSummary=`${items.length} ${L('kohtaa','poster','items')}${items.length!==pool.length?' / '+pool.length:''}${searching?' · '+L('Hakusana','Sökord','Search')+': '+e(state.query):''}`;
    const resetLabel=L('Tyhjennä haku ja rajaukset','Rensa sökning och avgränsningar','Clear search and filters');
    const resetButton=activeCount?`<button type="button" data-budget-reset>${resetLabel}</button>`:'';
    const chartHelp=L('Avaa laatikko tai sen nimetty rivi. Riviltä näet aina koko nimen, summan ja osuuden. Laatikon numero vastaa luettelon numeroa.','Öppna en ruta eller dess namngivna rad. Raden visar alltid hela namnet, beloppet och andelen. Rutans nummer motsvarar numret i listan.','Open a box or its named row. Each row always shows the full name, amount and share. Box numbers match the list.');
    const areaNote=L('Pinta-alat kuvaavat näkyvien positiivisten summien keskinäistä suhdetta. Nolla- ja miinusmerkkiset kohdat löytyvät luettelosta.','Ytorna visar förhållandet mellan de synliga positiva beloppen. Nollposter och negativa poster finns i listan.','Areas show the relative size of the visible positive amounts. Zero and negative items remain available in the list.');
    lastRoute=location.hash;
    root.dataset.route=location.hash;
    document.title=`${title} ${year.year} | ${L('Vahtikissa','Vaktkatt','Vahtikissa')}`;
    root.innerHTML=`<div class="page budget-page budget-remade">
      <div class="page-head"><div><div class="eyebrow">${L('Valtion talousarvio','Statsbudgeten','State budget')}</div><h1>${L('Tutki budjettia','Utforska budgeten','Explore the budget')}</h1><p class="lead">${L('Mistä valtion rahat tulevat ja mihin ne käytetään? Avaa hallinnonala ja siirry luvuista yksittäisiin momentteihin, tai hae nimellä ja tunnuksella.','Varifrån kommer statens pengar och hur används de? Öppna ett förvaltningsområde och gå från kapitel till enskilda moment, eller sök med namn och kod.','Where does state funding come from and how is it used? Open a ministry, explore chapters and individual items, or search by name and code.')}</p></div><div class="updated">${L('Päivitetty','Uppdaterad','Updated')} ${new Date(snapshot.metadata.generatedAt).toLocaleDateString(locale(lang))}</div></div>
      <div class="civic-toolbar budget-toolbar">
        <label class="filter-control"><span>${L('Budjettivuosi','Budgetår','Budget year')}</span><select data-budget-year>${[...years].reverse().map(y=>`<option value="${y.year}" ${y===year?'selected':''}>${y.year}</option>`).join('')}</select></label>
        <div class="segmented" role="group" aria-label="${L('Budjetin puoli','Budgetens sida','Budget side')}">${['expense','income'].map(t=>`<a data-budget-route href="${path(year.year,t)}" class="${t===type?'active':''}" ${t===type?'aria-current="page"':''}>${L(t==='income'?'Tulot':'Menot',t==='income'?'Inkomster':'Utgifter',t==='income'?'Income':'Spending')}</a>`).join('')}</div>
        <div class="segmented budget-metrics" role="group" aria-label="${L('Mittari','Mått','Measure')}">${['budget','original','actual'].map(m=>`<button data-budget-metric="${m}" aria-pressed="${state.metric===m}" class="${state.metric===m?'active':''}">${m==='budget'?L('Voimassa oleva','Gällande budget','Current budget'):m==='original'?L('Alkuperäinen','Ursprunglig budget','Original budget'):L('Toteuma','Utfall','Actual')}</button>`).join('')}</div>
      </div>
      <p class="budget-period"><strong>${metricLabel} · ${year.year}.</strong> ${metricNote} ${L('Toteumatiedot','Utfallsuppgifter','Actual data')}: ${year.latestMonth}/12 ${year.year}.</p>
      <section class="budget-overview" aria-label="${L('Koko vuoden budjetti valitulla mittarilla','Hela årets budget enligt valt mått','Annual budget with the selected measure')}">${labels.map(([label,value])=>`<div><span>${label}</span><strong class="${value<0?'negative':''}">${money(value,lang)}</strong></div>`).join('')}</section>
      <section class="budget-workspace" aria-labelledby="budget-explorer-title">
      <nav class="budget-crumbs" aria-label="${L('Budjetin murupolku','Budgetens sökväg','Budget breadcrumb')}">${crumbs.join('<span aria-hidden="true">›</span>')}</nav>
      ${state.notice?`<p class="budget-navigation-note" role="status">${e(state.notice)}</p>`:''}
      <section class="budget-explorer-head"><div><span class="eyebrow">${globalSearch?L('Haku kaikilta tasoilta','Sökning på alla nivåer','Search across all levels'):L(['Hallinnonalat','Luvut','Momentit','Momentti'][codes.length]||'Budjettikohta',['Förvaltningsområden','Kapitel','Moment','Moment'][codes.length]||'Budgetpost',['Ministries and main classes','Chapters','Budget items','Budget item'][codes.length]||'Budget item')}${codes.length?' · '+e(codeLabel(codes.at(-1))):''}</span><h2 id="budget-explorer-title" tabindex="-1" ${level.node&&!globalSearch?`lang="${level.node.name?.[lang]?lang:'fi'}"`:''}>${e(title)}</h2><p>${leaf?L('Tämä on budjetin tarkin taso. Alla näet tämän momentin alkuperäisen talousarvion, voimassa olevan budjetin ja toteuman.','Detta är budgetens mest detaljerade nivå. Nedan visas momentets ursprungliga budget, gällande budget och utfall.','This is the most detailed level. Compare this item’s original budget, current budget and actual result below.'):globalSearch?L('Avaa hakutulos nähdäksesi sen budjettikohdan. Tuloksissa voi olla päällekkäisiä tasoja; summia ei lasketa yhteen.','Öppna ett sökresultat för att se budgetposten. Resultaten kan omfatta överlappande nivåer; beloppen summeras inte.','Open a result to explore the item. Results can include overlapping levels, so their amounts are not added together.'):L('Avaa kohta nähdäksesi sen jaon. Osuus kertoo, kuinka suuri osa tästä kokonaisuudesta kuuluu kohteelle.','Öppna en post för att se dess fördelning. Andelen visar hur stor del av denna helhet som tillhör posten.','Open an item to see its breakdown. Its share is measured against the total of this section.')}</p></div>${!globalSearch?`<div class="budget-scope-total"><span>${metricLabel}</span><strong>${money(scope,lang)}</strong><small>${number(scope,lang,2)} €</small></div>`:''}</section>
      ${!level.valid?`<div class="empty">${L('Budjettikohtaa ei löytynyt tältä vuodelta.','Budgetposten finns inte för detta år.','This budget item is unavailable for this year.')} <a data-budget-route href="${path(year.year,type)}">${L('Näytä vuoden kokonaisuus','Visa hela året','Show the annual budget')}</a></div>`:''}
      ${leaf?`<div class="budget-results-navigation budget-leaf-navigation">${backLink}<a data-budget-route href="${path(year.year,type)}">${L('Vuoden kokonaisuus','Hela året','Annual overview')}</a></div><dl class="budget-item-metrics">${['original','budget','actual'].map(m=>`<div><dt>${m==='original'?L('Alkuperäinen talousarvio','Ursprunglig budget','Original budget'):m==='budget'?L('Voimassa oleva talousarvio','Gällande budget','Current budget'):L('Toteuma','Utfall','Actual')+' · '+year.latestMonth+'/12'}</dt><dd>${money(level.node[m]||0,lang)}<small>${number(level.node[m]||0,lang,2)} €</small></dd></div>`).join('')}</dl>`:''}
      ${level.valid?`<div class="budget-search-controls"><label><span>${L('Hae nimellä tai tunnuksella','Sök med namn eller kod','Search by name or code')}</span><span class="budget-search-field"><input data-budget-search type="search" value="${e(state.query)}" aria-label="${L('Hae budjettikohdista','Sök budgetposter','Search budget items')}" placeholder="${L('Esim. asumistuki tai 33.10','T.ex. bostadsbidrag eller 33.10','E.g. asumistuki or 33.10')}"><button type="button" data-budget-clear-search ${!state.query?'hidden':''} aria-label="${L('Tyhjennä haku','Rensa sökningen','Clear search')}"><span aria-hidden="true">×</span></button></span></label><label><span>${L('Haun laajuus','Sökområde','Search scope')}</span><select data-budget-search-scope><option value="all" ${state.searchScope==='all'?'selected':''}>${L('Koko vuoden menot tai tulot','Hela årets utgifter eller inkomster','All spending or income for this year')}</option><option value="level" ${level.node&&!level.items.length? 'disabled' : ''} ${state.searchScope==='level'?'selected':''}>${L('Vain tämän tason kohdat','Bara poster på denna nivå','Items at this level only')}</option></select></label></div>`:''}
      ${level.valid&&lang!=='fi'?`<p class="budget-search-note">${L('','Detaljerade postnamn följer den finska källan. Sök med finska ord eller en kod, till exempel 33.10.','Detailed item names follow the Finnish source. Search with Finnish terms or a code, such as 33.10.')}</p>`:''}
      ${!leaf&&level.valid?`<div class="budget-browse-controls"><details class="budget-refine" data-budget-refine ${state.toolsOpen?'open':''}><summary>${L('Järjestä ja rajaa','Sortera och avgränsa','Sort and filter')}${filterCount?` <span>(${filterCount})</span>`:''}</summary><div data-budget-tools></div></details><div class="budget-view-tools">${!globalSearch?`<div class="segmented" role="group" aria-label="${L('Esitystapa','Visningssätt','View')}">${[['map',L('Kartta ja luettelo','Karta och lista','Map and list')],['bars',L('Palkit','Staplar','Bars')],['table',L('Taulukko','Tabell','Table')]].map(([v,label])=>`<button data-budget-view="${v}" aria-pressed="${state.view===v}" class="${state.view===v?'active':''}">${label}</button>`).join('')}</div>`:''}<label class="budget-compare"><input data-budget-compare type="checkbox" ${state.compare?'checked':''} ${!previous?'disabled':''}> ${L('Vertaa vuoteen','Jämför med','Compare with')} ${previous?.year||'—'}</label></div></div>`:''}
      ${state.compare&&!comparisonAllowed?`<p class="civic-note">${L('Vuosien toteumat kattavat eri määrän kuukausia. Prosenttivertailu näytetään vain samanpituisille jaksoille.','Årens utfall omfattar olika antal månader. Procentjämförelsen visas endast för lika långa perioder.','The actual results cover different numbers of months. Percentage changes are only shown for matching periods.')}</p>`:''}
      ${!leaf&&level.valid?`<div class="budget-results-navigation">${backLink}<p class="filter-summary" role="status" aria-live="polite">${resultSummary}</p>${resetButton}</div>`:''}
      ${level.valid&&!items.length&&!leaf?`<div class="empty"><p>${L('Ei kohtia valituilla rajauksilla. Kokeile toista hakusanaa tai tyhjennä rajaukset.','Inga poster med dessa avgränsningar. Prova ett annat sökord eller rensa avgränsningarna.','No items match the selected search and filters. Try another term or clear the filters.')}</p>${resetButton}</div>`:''}
      ${chart&&state.view==='map'?`<div class="budget-map-layout"><div class="budget-map-visual"><p class="budget-chart-help" id="budget-chart-help">${chartHelp}</p>${rectangles.length?`<div class="budget-treemap" role="group" aria-label="${L('Budjetin aluekartta; samat tiedot luettelossa','Budgetens ytkarta; samma uppgifter i listan','Budget treemap; equivalent information in the list')}" aria-describedby="budget-chart-help budget-map-method">${rectangles.map(rect=>{const item=rect.item,small=rect.width<20||rect.height<17,rank=items.indexOf(item)+1;return `<a data-budget-route href="${link(item)}" tabindex="-1" aria-hidden="true" class="budget-tile ${small?'compact':''}" style="left:${rect.x}%;top:${rect.y/65*100}%;width:${rect.width}%;height:${rect.height/65*100}%;--tile-color:${color(item)}"><b class="budget-tile-number">${rank}</b><span>${e(name(item,lang))}</span><strong>${money(amount(item),lang)}</strong></a>`;}).join('')}</div>`:`<p class="budget-map-unavailable">${L('Näillä kohdilla ei ole positiivista summaa. Kaikki kohdat löytyvät luettelosta.','Dessa poster har inga positiva belopp. Alla poster finns i listan.','These items have no positive amounts. Every item is available in the list.')}</p>`}<p class="budget-chart-help" id="budget-map-method">${areaNote}${nonPositive?' '+nonPositive+' '+L('kohtaa ilman pinta-alaa.','poster utan yta.','items have no area.'):''} ${scope===0?L('Osuutta ei lasketa, kun kokonaisuus on nolla.','Andel beräknas inte när totalen är noll.','A share cannot be calculated when the total is zero.'):''}</p></div><section class="budget-map-key" aria-labelledby="budget-items-title"><h3 id="budget-items-title">${L('Avaa budjettikohta','Öppna en budgetpost','Open a budget item')}</h3><p>${L('Koko nimi ja summa jokaiselle kohdalle.','Hela namnet och beloppet för varje post.','The full name and amount of every item.')}</p><ul>${items.map((item,index)=>`<li><a data-budget-route href="${link(item)}"><span class="budget-key-number" style="--tile-color:${color(item)}" aria-hidden="true">${index+1}</span><span><small>${e(codeLabel(item.code))} · ${item.children?.length?L('Avaa jaottelu','Öppna fördelningen','Open breakdown'):L('Näytä momentti','Visa momentet','View item')}</small><strong>${itemName(item)}</strong><span>${money(amount(item),lang)} · ${e(share(item))}${state.compare?' · '+L('Muutos','Förändring','Change')+' '+change(item):''}${amount(item)<=0?' · '+L('Ei pinta-alaa kartalla','Ingen yta i kartan','No area on map'):''}</span></span><span class="budget-key-arrow" aria-hidden="true">›</span></a></li>`).join('')}</ul></section></div>`:''}
      ${chart&&state.view==='bars'?`<p class="budget-chart-help">${L('Palkin pituutta verrataan tämän listan suurimpaan summaan. Osuus lasketaan koko valitusta kokonaisuudesta. Miinusmerkkiset summat on merkitty erikseen.','Stapelns längd jämförs med listans största belopp. Andelen beräknas av hela den valda helheten. Negativa belopp är särskilt markerade.','Bar lengths are relative to the largest amount in this list. Shares use the full selected section. Negative amounts are labelled separately.')}</p><div class="budget-bars">${items.map(item=>`<a data-budget-route class="budget-row budget-row-link ${amount(item)<0?'budget-row-negative':''}" href="${link(item)}" style="--budget-color:${color(item)}"><div class="budget-row-head"><div><small>${e(codeLabel(item.code))}</small><strong>${itemName(item)}</strong></div><div><strong>${money(amount(item),lang)}</strong><small>${e(share(item))}${state.compare?' · '+L('Muutos','Förändring','Change')+' '+change(item):''}${amount(item)<0?' · '+L('Negatiivinen summa','Negativt belopp','Negative amount'):''}</small></div></div><div class="budget-track" aria-hidden="true"><span style="width:${maxBar?Math.abs(amount(item))/maxBar*100:0}%"></span></div></a>`).join('')}</div>`:''}
      ${items.length?`<details class="budget-table-details" data-budget-table ${state.view==='table'||globalSearch?'open':''}><summary>${L('Taulukko ja tarkat euromäärät','Tabell och exakta eurobelopp','Table and exact euro amounts')} (${items.length})</summary><div class="table-wrap budget-detail-table"><table aria-label="${L('Budjettikohdat ja summat','Budgetposter och belopp','Budget items and amounts')}"><caption class="sr-only">${metricLabel} ${year.year}. ${L('Osuus valitun kokonaisuuden summasta.','Andel av den valda helhetens belopp.','Share of the selected section total.')} ${globalSearch?L('Hakutulosten tasot voivat olla päällekkäisiä; summia ei lasketa yhteen.','Sökresultatens nivåer kan överlappa; beloppen summeras inte.','Search results can overlap; amounts are not added together.'):''}</caption><thead><tr><th scope="col">${L('Kohde','Post','Item')}</th><th scope="col">${L('Summa (€)','Belopp (€)','Amount (€)')}</th><th scope="col">${L('Osuus','Andel','Share')}</th>${state.compare?`<th scope="col">${L('Muutos','Förändring','Change')} ${previous?.year||''}</th>`:''}</tr></thead><tbody>${items.map(item=>`<tr><td data-label="${L('Kohde','Post','Item')}"><a data-budget-route href="${link(item)}">${itemName(item)}</a><span class="sub">${e(codeLabel(item.code))}${globalSearch?' · '+e(ancestorLabel(item)):''}</span></td><td data-label="${L('Summa (€)','Belopp (€)','Amount (€)')}">${number(amount(item),lang,2)} €<span class="sub">${money(amount(item),lang)}</span></td><td data-label="${L('Osuus','Andel','Share')}">${e(share(item))}</td>${state.compare?`<td data-label="${L('Muutos','Förändring','Change')}">${change(item)}</td>`:''}</tr>`).join('')}</tbody></table></div></details>`:''}
      ${codes.length&&items.length>8?`<div class="budget-results-navigation budget-bottom-navigation">${backLink}<a data-budget-route href="${path(year.year,type)}">${L('Vuoden kokonaisuus','Hela året','Annual overview')}</a></div>`:''}
      ${state.compare&&comparisonAllowed?`<p class="budget-chart-help">${L('— tarkoittaa, ettei vertailutietoa ole tai edellisvuoden summa on nolla.','— betyder att jämförelseuppgifter saknas eller att föregående års belopp är noll.','— means there is no comparable previous-year value or it is zero.')}</p>`:''}
      ${items.length||leaf?`<div class="data-actions">${exportButtons('budget',lang)}</div>`:''}
      </section>
      <aside class="civic-note"><p>${L('Tulot sisältävät lainanoton. Tasapaino lasketaan ilman lainanottoa. Yksityiskohtaiset nimet ovat lähdeaineistossa suomeksi.','Inkomsterna omfattar upplåning. Balansen beräknas utan upplåning. Detaljerade benämningar är på finska i källmaterialet.','Income includes borrowing. The balance excludes borrowing. Budget item names follow the Finnish source; use Finnish names or item codes when searching.')}</p><div class="source-links"><a href="https://avoindata.tutkihallintoa.fi/" target="_blank" rel="noreferrer">${L('Valtiokonttori · lähde','Statskontoret · källa','State Treasury · source')} ↗</a></div></aside>
    </div>`;
    const focusExplorer=()=>root.querySelector('#budget-explorer-title')?.focus({preventScroll:true});
    const navigate=(hash,{notice=''}={})=>{
      state.query='';state.notice=notice;pushRoute(hash);
      preservePageScroll(root,()=>{draw(hash.replace(/^#\/budget\/?/,''));focusExplorer();});
      const status=document.querySelector('#route-status');if(status)status.textContent=root.querySelector('h2')?.textContent||'';
    };
    root.querySelectorAll('[data-budget-route]').forEach(a=>a.onclick=event=>{if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(a.getAttribute('href'));});
    root.querySelector('[data-budget-year]').onchange=event=>preserveFocus(root,()=>{
      const nextYear=years.find(value=>String(value.year)===event.target.value), nextCodes=budgetClosestPath(nextYear,type,codes);
      const notice=nextCodes.length<codes.length?L('Tätä kohtaa ei ole valitulla vuodella. Näytetään lähin käytettävissä oleva ylempi taso.','Posten finns inte för det valda året. Närmaste tillgängliga överordnade nivå visas.','This item is unavailable in the selected year. Showing its nearest available parent section.'):'';
      navigate(path(event.target.value,type,nextCodes),{notice});
    });
    const redraw=(preserveOpen=true)=>{
      const refine=root.querySelector('[data-budget-refine]');
      if(preserveOpen&&refine){
        state.toolsOpen=refine.open;
        refine.querySelectorAll('[data-advanced],[data-facet]').forEach(details=>{extra.open[details.dataset.facet||'__advanced']=details.open;});
      }
      draw([year.year,type,...codes].join('/'));
    };
    for(const attr of ['metric','view'])root.querySelectorAll(`[data-budget-${attr}]`).forEach(button=>button.onclick=()=>preserveFocus(root,()=>{state[attr]=button.dataset[attr==='metric'?'budgetMetric':'budgetView'];redraw();}));
    const compare=root.querySelector('[data-budget-compare]');if(compare)compare.onchange=event=>preserveFocus(root,()=>{state.compare=event.target.checked;redraw();});
    const search=root.querySelector('[data-budget-search]');
    if(search){
      search.oninput=event=>{state.query=event.target.value;preserveFocus(root,redraw);};
      search.onkeydown=event=>{if(event.key==='Escape'&&state.query){event.preventDefault();state.query='';preserveFocus(root,redraw);}};
      root.querySelector('[data-budget-clear-search]').onclick=()=>{state.query='';preserveFocus(root,redraw);root.querySelector('[data-budget-search]')?.focus({preventScroll:true});};
      root.querySelector('[data-budget-search-scope]').onchange=event=>preserveFocus(root,()=>{state.searchScope=event.target.value;redraw();});
    }
    root.querySelectorAll('[data-budget-reset]').forEach(button=>button.onclick=()=>{
      state.query='';state.searchScope='all';state.toolsOpen=false;
      // Search and level use separate filter states. Clear both escape paths together.
      for(const suffix of ['search','level'])filters.delete(`${year.year}-${type}-${codes.join('-')}-${suffix}`);
      redraw(false);focusExplorer();
    });
    const tools=root.querySelector('[data-budget-tools]');
    if(tools){
      mountCollectionTools(tools,'budget',extra,config,lang,()=>preserveFocus(root,redraw));
      const refine=root.querySelector('[data-budget-refine]');refine.addEventListener('toggle',()=>{if(refine.isConnected)state.toolsOpen=refine.open;});
      root.querySelector('[data-tool="direction"] option[value="asc"]').textContent=L('Nouseva','Stigande','Ascending');
      root.querySelector('[data-tool="direction"] option[value="desc"]').textContent=L('Laskeva','Fallande','Descending');
    }
    const combined = root.querySelector('[data-budget-refine]'), quickSearch = root.querySelector('.budget-search-controls');
    if (combined && quickSearch) {
      combined.classList.add('filter-panel'); combined.dataset.filterPanel = 'budget';
      combined.querySelector(':scope > summary').textContent = L('Haku, rajaukset ja järjestys','Sök, avgränsa och sortera','Search, filter and sort');
      combined.insertBefore(quickSearch, combined.children[1]);
    }
    foldFilterToolbars(root,lang);
    const exportItems=leaf?[{...level.node,path:codes}]:items;
    bindExportButtons(root,'budget',()=>exportItems.map(item=>({year:year.year,type,metric:state.metric,actualThroughMonth:year.latestMonth,code:item.code,path:item.path.join('/'),name:name(item,lang),budget:item.budget,original:item.original,actual:item.actual,sharePercent:budgetShare(amount(item),scope),changePercent:delta(item)})),`vahtikissa-budjetti-${year.year}-${type}`);
  }
}
