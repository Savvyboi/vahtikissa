import { budgetLevel, budgetChange, budgetTotals, budgetTreemap, budgetEntries, searchBudgetEntries } from './budget-utils.js';
import { fetchJSONWithTimeout } from './app-utils.js';
import { exportButtons, bindExportButtons } from './data-tools.js';
import { collectionState, applyCollection, facetOptions, mountCollectionTools, preserveFocus } from './collection-tools.js';

let snapshot;
const state = { metric: 'budget', view: 'map', query: '', searchScope: 'all', compare: false };
const filters = new Map();
const palette = ['#245b87','#7133a0','#386b30','#116a72','#8f3548','#776020','#39567b','#635299','#276650','#924a28','#455b71','#7d4870'];
const name = (item,lang) => {
  const text=item?.name?.[lang] || item?.name?.fi || item?.code || '';
  return text && text===text.toLocaleUpperCase(lang) ? text[0]+text.slice(1).toLocaleLowerCase(lang) : text;
};
const number = (n,lang,digits=1) => new Intl.NumberFormat(lang==='sv'?'sv-FI':'fi-FI',{maximumFractionDigits:digits}).format(n);
const money = (n,lang) => Math.abs(n)>=1e9 ? `${number(n/1e9,lang)} ${lang==='sv'?'md €':'mrd. €'}` : Math.abs(n)>=1e6 ? `${number(n/1e6,lang)} ${lang==='sv'?'mn €':'milj. €'}` : `${number(n,lang,0)} €`;
const path = (year,type,codes=[]) => `#/budget/${[year,type,...codes].join('/')}`;
const amount = item => Number(item?.[state.metric]) || 0;
const codeLabel = code => String(code).match(/.{1,2}/g)?.join('.') || '';

export async function renderBudget(root,lang,routeId,escapeHTML) {
  const requested = location.hash;
  const L = (fi,sv) => lang==='sv'?sv:fi, e=escapeHTML;
  try {
    if (!snapshot) snapshot = await fetchJSONWithTimeout('./data/budget.json');
    if (requested!==location.hash || document.documentElement.lang!==lang) return;
    draw(routeId);
  } catch (error) {
    if (requested!==location.hash) return;
    root.innerHTML=`<div class="page"><section class="load-error" role="alert"><h1>${L('Budjettia ei voitu ladata','Budgeten kunde inte laddas')}</h1><p>${e(error.message)}</p><button data-budget-retry>${L('Yritä uudelleen','Försök igen')}</button></section></div>`;
    root.querySelector('[data-budget-retry]').onclick=()=>renderBudget(root,lang,routeId,e);
  }
  function draw(id='') {
    const route=String(id||'').split('/').filter(Boolean), years=snapshot.years;
    const foundYear=years.find(y=>String(y.year)===route[0]), year=foundYear||years.at(-1);
    const type=route[1]==='income'?'income':'expense', codes=route.slice(2);
    const level=route[0]&&!foundYear?{valid:false,node:null,items:[]}:budgetLevel(year,type,codes);
    const previous=years.find(y=>y.year===year.year-1), totals=budgetTotals(year,state.metric);
    const searching=Boolean(state.query.trim()) && level.valid, globalSearch=searching&&state.searchScope==='all';
    const scope=globalSearch?totals[type]:level.node?amount(level.node):totals[type];
    const title=globalSearch?L('Hakutulokset koko vuoden budjetista','Sökresultat i hela årets budget'):level.node?name(level.node,lang):L(type==='income'?'Mistä rahat tulevat?':'Mihin rahat menevät?',type==='income'?'Varifrån kommer pengarna?':'Vart går pengarna?');
    const pool=globalSearch?budgetEntries(year,type):level.items.map(item=>({...item,path:[...codes,item.code]}));
    const searched=searchBudgetEntries(pool,state.query);
    const key=`${year.year}-${type}-${codes.join('-')}-${globalSearch?'search':'level'}`;
    if(!filters.has(key))filters.set(key,collectionState('amount','desc'));
    const extra=filters.get(key);
    const config={label:L('Budjetti','Budget'),sorts:[{key:'amount',label:L('Summa','Belopp'),value:amount},{key:'name',label:L('Nimi','Namn'),value:item=>name(item,lang)},{key:'code',label:L('Tunnus','Kod'),value:item=>item.code}],number:{label:L('Summa (€)','Belopp (€)'),value:amount},facets:[{key:'code',label:L('Budjettikohdat','Budgetposter'),value:item=>item.code,options:facetOptions(pool,item=>item.code,code=>name(pool.find(x=>x.code===code),lang),lang)}]};
    const items=applyCollection(searched,extra,config,lang);
    const comparisonAllowed=state.metric!=='actual'||year.latestMonth===previous?.latestMonth;
    const delta=item=>{
      const old=budgetLevel(previous,type,item.path||codes);
      return comparisonAllowed&&old.valid&&old.node?budgetChange(amount(item),amount(old.node)):null;
    };
    const change=item=>delta(item)===null?'—':`${delta(item)>0?'+':''}${number(delta(item),lang)} %`;
    const share=item=>number(scope?amount(item)/scope*100:0,lang)+' %';
    const color=item=>palette[(Number(item.code.slice(0,2))||0)%palette.length];
    const link=item=>path(year.year,type,item.path);
    const metricLabel={budget:L('Voimassa oleva talousarvio','Gällande budget'),original:L('Alkuperäinen talousarvio','Ursprunglig budget'),actual:L('Toteuma','Utfall')}[state.metric];
    const actualEnd=new Intl.DateTimeFormat(lang==='sv'?'sv-FI':'fi-FI',{day:'numeric',month:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(year.year,year.latestMonth,0)));
    const metricNote=state.metric==='actual'?L(`Kertymä 1.1.–${actualEnd}. Keskeneräinen vuosi ei ole koko vuoden toteuma.`,`Ackumulerat utfall till och med månad ${year.latestMonth}/${year.year}. Ett pågående år visar inte helårsutfallet.`):state.metric==='original'?L('Eduskunnan hyväksymä alkuperäinen vuositason talousarvio, ilman lisätalousarvioita.','Den ursprungliga årsbudgeten som riksdagen godkänt, utan tilläggsbudgetar.'):L('Vuositason talousarvio, joka sisältää julkaistut lisätalousarviot.','Årsbudgeten inklusive publicerade tilläggsbudgetar.');
    const crumbs=[`<a data-budget-route href="${path(year.year,type)}" ${!codes.length?'aria-current="page"':''}>${L(type==='income'?'Tulot ja lainanotto':'Kaikki menot',type==='income'?'Inkomster och upplåning':'Alla utgifter')}</a>`,...codes.map((code,i)=>{const node=budgetLevel(year,type,codes.slice(0,i+1)).node;return `<a data-budget-route href="${path(year.year,type,codes.slice(0,i+1))}" ${i===codes.length-1?'aria-current="page"':''}>${e(codeLabel(code))} · ${e(name(node,lang)||code)}</a>`})];
    const labels=[[L('Menot','Utgifter'),totals.expense],[L('Tulot ilman lainanottoa','Inkomster utan lån'),totals.revenue],[L('Lainanotto (netto)','Upplåning (netto)'),totals.borrowing],[L('Tasapaino ilman lainanottoa','Balans utan upplåning'),totals.balance]];
    const leaf=level.valid&&level.node&&!level.items.length&&!globalSearch;
    const chart=items.length&&!globalSearch&&state.view!=='table';
    const ancestorLabel=item=>(item.ancestors||[]).map(node=>name(node,lang)).join(' › ');
    root.dataset.route=location.hash;
    document.title=`${title} ${year.year} | ${L('Vahtikissa','Vaktkatt')}`;
    root.innerHTML=`<div class="page budget-page budget-remade">
      <div class="page-head"><div><div class="eyebrow">${L('Valtion talousarvio','Statsbudgeten')}</div><h1>${L('Tutki budjettia','Utforska budgeten')}</h1><p class="lead">${L('Valitse vuosi ja avaa hallinnonala. Voit myös hakea suoraan budjetin tarkimmista kohdista.','Välj år och öppna ett förvaltningsområde. Du kan också söka direkt bland budgetens mest detaljerade poster.')}</p></div><div class="updated">${L('Päivitetty','Uppdaterad')} ${new Date(snapshot.metadata.generatedAt).toLocaleDateString(lang==='sv'?'sv-FI':'fi-FI')}</div></div>
      <div class="civic-toolbar budget-toolbar">
        <label class="filter-control"><span>${L('Budjettivuosi','Budgetår')}</span><select data-budget-year>${[...years].reverse().map(y=>`<option value="${y.year}" ${y===year?'selected':''}>${y.year}</option>`).join('')}</select></label>
        <div class="segmented" role="group" aria-label="${L('Budjetin puoli','Budgetens sida')}">${['expense','income'].map(t=>`<a data-budget-route href="${path(year.year,t)}" class="${t===type?'active':''}" ${t===type?'aria-current="page"':''}>${L(t==='income'?'Tulot':'Menot',t==='income'?'Inkomster':'Utgifter')}</a>`).join('')}</div>
        <div class="segmented budget-metrics" role="group" aria-label="${L('Mittari','Mått')}">${['budget','original','actual'].map(m=>`<button data-budget-metric="${m}" aria-pressed="${state.metric===m}" class="${state.metric===m?'active':''}">${m==='budget'?L('Voimassa oleva','Gällande budget'):m==='original'?L('Alkuperäinen','Ursprunglig budget'):L('Toteuma','Utfall')}</button>`).join('')}</div>
      </div>
      <p class="budget-period"><strong>${metricLabel} · ${year.year}.</strong> ${metricNote} ${L('Toteumatiedot','Utfallsuppgifter')}: ${year.latestMonth}/12 ${year.year}.</p>
      <section class="budget-overview" aria-label="${L('Koko vuoden budjetti valitulla mittarilla','Hela årets budget enligt valt mått')}">${labels.map(([label,value])=>`<div><span>${label}</span><strong class="${value<0?'negative':''}">${money(value,lang)}</strong></div>`).join('')}</section>
      <section class="budget-workspace" aria-label="${L('Budjetin selaus','Bläddra i budgeten')}">
      <div class="budget-chart-navigation">${codes.length?`<a data-budget-route class="budget-back" href="${path(year.year,type,codes.slice(0,-1))}">← ${L('Ylempi taso','Föregående nivå')}</a>`:''}<nav class="budget-crumbs" aria-label="${L('Murupolku','Sökväg')}">${crumbs.join('<span aria-hidden="true">›</span>')}</nav></div>
      <section class="budget-explorer-head"><div><span class="eyebrow">${globalSearch?L('Haku kaikilta tasoilta','Sökning på alla nivåer'):L(['Hallinnonalat','Luvut','Momentit','Momentti'][codes.length]||'Budjettikohta',['Förvaltningsområden','Kapitel','Moment','Moment'][codes.length]||'Budgetpost')}</span><h2>${e(title)}</h2><p>${leaf?L('Tämä on budjetin tarkin taso. Vertaa tämän kohdan alkuperäistä arviota, voimassa olevaa budjettia ja toteumaa alta.','Detta är budgetens mest detaljerade nivå. Jämför postens ursprungliga budget, gällande budget och utfall nedan.'):globalSearch?L('Avaa hakutulos nähdäksesi sen budjettikohdan. Tuloksissa voi olla päällekkäisiä tasoja; summia ei lasketa yhteen.','Öppna ett sökresultat för att se budgetposten. Resultaten kan omfatta överlappande nivåer; beloppen summeras inte.'):L('Avaa kohta nähdäksesi sen jaon. Osuudet lasketaan valitun kokonaisuuden summasta.','Öppna en post för att se dess fördelning. Andelarna beräknas av den valda helhetens belopp.')}</p></div>${!globalSearch?`<div class="budget-scope-total"><span>${metricLabel}</span><strong>${money(scope,lang)}</strong><small>${number(scope,lang,2)} €</small></div>`:''}</section>
      ${!level.valid?`<div class="empty">${L('Budjettikohtaa ei löytynyt tältä vuodelta.','Budgetposten finns inte för detta år.')} <a data-budget-route href="${path(year.year,type)}">${L('Näytä vuoden kokonaisuus','Visa hela året')}</a></div>`:''}
      ${leaf?`<dl class="budget-item-metrics">${['original','budget','actual'].map(m=>`<div><dt>${m==='original'?L('Alkuperäinen talousarvio','Ursprunglig budget'):m==='budget'?L('Voimassa oleva talousarvio','Gällande budget'):L('Toteuma','Utfall')+' · '+year.latestMonth+'/12'}</dt><dd>${money(level.node[m]||0,lang)}<small>${number(level.node[m]||0,lang,2)} €</small></dd></div>`).join('')}</dl>`:''}
      <div class="budget-search-controls"><label><span>${L('Hae nimellä tai tunnuksella','Sök med namn eller kod')}</span><input data-budget-search type="search" value="${e(state.query)}" aria-label="${L('Hae budjettikohdista','Sök budgetposter')}" placeholder="${L('Esim. asumistuki tai 33.10','T.ex. bostadsbidrag eller 33.10')}"></label><label><span>${L('Haun laajuus','Sökområde')}</span><select data-budget-search-scope><option value="all" ${state.searchScope==='all'?'selected':''}>${L('Koko vuoden menot tai tulot','Hela årets utgifter eller inkomster')}</option><option value="level" ${state.searchScope==='level'?'selected':''}>${L('Vain tämän tason kohdat','Bara poster på denna nivå')}</option></select></label></div>
      <div data-budget-tools></div>
      <div class="budget-view-tools"><div class="segmented" role="group" aria-label="${L('Esitystapa','Visningssätt')}">${[['map',L('Aluekartta','Ytkarta')],['bars',L('Palkit','Staplar')],['table',L('Taulukko','Tabell')]].map(([v,label])=>`<button data-budget-view="${v}" aria-pressed="${state.view===v}" class="${state.view===v?'active':''}">${label}</button>`).join('')}</div><label class="budget-compare"><input data-budget-compare type="checkbox" ${state.compare?'checked':''} ${!previous?'disabled':''}> ${L('Vertaa vuoteen','Jämför med')} ${previous?.year||'—'}</label></div>
      ${state.compare&&!comparisonAllowed?`<p class="civic-note">${L('Vuosien toteumat kattavat eri määrän kuukausia. Prosenttivertailu näytetään vain samanpituisille jaksoille.','Årens utfall omfattar olika antal månader. Procentjämförelsen visas endast för lika långa perioder.')}</p>`:''}
      <p class="filter-summary" role="status" aria-live="polite">${items.length} ${L('kohtaa','poster')}${searching?' · '+L('Hakusana','Sökord')+': '+e(state.query):''}</p>
      ${level.valid&&!items.length&&!leaf?`<div class="empty">${L('Ei kohtia valituilla rajauksilla. Kokeile toista hakusanaa tai poista rajaukset.','Inga poster med dessa avgränsningar. Prova ett annat sökord eller ta bort avgränsningarna.')}</div>`:''}
      ${chart&&state.view==='map'?`<div class="budget-map-layout"><div><p class="budget-chart-help">${L('Laatikon pinta-ala kuvaa summaa. Kaikki kohdat, myös pienet ja negatiiviset, ovat viereisessä luettelossa.','Rutans yta visar beloppet. Alla poster, även små och negativa, finns i listan intill.')}</p><div class="budget-treemap" role="group" aria-label="${L('Budjetin aluekartta','Budgetens ytkarta')}">${budgetTreemap(items,amount).map(rect=>{const item=rect.item,small=rect.width<20||rect.height<17,desc=`${name(item,lang)} · ${money(amount(item),lang)} · ${share(item)}`;return `<${small?'div role="img"':'a data-budget-route'} class="budget-tile ${small?'compact':''}" ${small?'':`href="${link(item)}"`} aria-label="${e(desc)}" style="left:${rect.x}%;top:${rect.y/65*100}%;width:${rect.width}%;height:${rect.height/65*100}%;--tile-color:${color(item)}"><span>${e(name(item,lang))}</span><strong>${money(amount(item),lang)}</strong></${small?'div':'a'}>`}).join('')}</div></div><section class="budget-map-key" aria-label="${L('Aluekartan kaikki kohdat','Alla poster i ytkartan')}"><h3>${L('Avaa budjettikohta','Öppna en budgetpost')}</h3><ul>${items.map(item=>`<li><a data-budget-route href="${link(item)}"><span class="budget-key-swatch" style="--tile-color:${color(item)}" aria-hidden="true"></span><span><small>${e(codeLabel(item.code))}</small><strong>${e(name(item,lang))}</strong><span>${money(amount(item),lang)} · ${share(item)}${state.compare?' · '+L('Muutos','Förändring')+' '+change(item):''}</span></span><span class="budget-key-arrow" aria-hidden="true">›</span></a></li>`).join('')}</ul></section></div>`:''}
      ${chart&&state.view==='bars'?`<div class="budget-bars">${items.map(item=>`<a data-budget-route class="budget-row budget-row-link" href="${link(item)}" style="--budget-color:${color(item)}"><div class="budget-row-head"><div><small>${e(codeLabel(item.code))}</small><strong>${e(name(item,lang))}</strong></div><div><strong>${money(amount(item),lang)}</strong><small>${share(item)}${state.compare?' · '+L('Muutos','Förändring')+' '+change(item):''}</small></div></div><div class="budget-track"><span style="width:${Math.max(0,Math.min(100,scope?amount(item)/scope*100:0))}%"></span></div></a>`).join('')}</div>`:''}
      ${items.length?`<details class="budget-table-details" data-budget-table ${state.view==='table'||globalSearch?'open':''}><summary>${L('Taulukko ja tarkat euromäärät','Tabell och exakta eurobelopp')} (${items.length})</summary><div class="table-wrap budget-detail-table"><table aria-label="${L('Budjettikohdat ja summat','Budgetposter och belopp')}"><thead><tr><th scope="col">${L('Kohde','Post')}</th><th scope="col">${L('Summa (€)','Belopp (€)')}</th><th scope="col">${L('Osuus','Andel')}</th>${state.compare?`<th scope="col">${L('Muutos','Förändring')} ${previous?.year||''}</th>`:''}</tr></thead><tbody>${items.map(item=>`<tr><td data-label="${L('Kohde','Post')}"><a data-budget-route href="${link(item)}">${e(name(item,lang))}</a><span class="sub">${e(codeLabel(item.code))}${globalSearch?' · '+e(ancestorLabel(item)):''}</span></td><td data-label="${L('Summa (€)','Belopp (€)')}">${number(amount(item),lang,2)} €<span class="sub">${money(amount(item),lang)}</span></td><td data-label="${L('Osuus','Andel')}">${share(item)}</td>${state.compare?`<td data-label="${L('Muutos','Förändring')}">${change(item)}</td>`:''}</tr>`).join('')}</tbody></table></div></details>`:''}
      ${state.compare&&comparisonAllowed?`<p class="budget-chart-help">${L('— tarkoittaa, ettei vertailutietoa ole tai edellisvuoden summa on nolla.','— betyder att jämförelseuppgifter saknas eller att föregående års belopp är noll.')}</p>`:''}
      <div class="data-actions">${exportButtons('budget',lang)}</div>
      </section>
      <aside class="civic-note"><p>${L('Tulot sisältävät lainanoton. Tasapaino lasketaan ilman lainanottoa. Yksityiskohtaiset nimet ovat lähdeaineistossa suomeksi.','Inkomsterna omfattar upplåning. Balansen beräknas utan upplåning. Detaljerade benämningar är på finska i källmaterialet.')}</p><div class="source-links"><a href="https://avoindata.tutkihallintoa.fi/" target="_blank" rel="noreferrer">${L('Valtiokonttori · lähde','Statskontoret · källa')} ↗</a></div></aside>
    </div>`;
    const navigate=(hash,scroll=true)=>{
      state.query='';history.pushState(null,'',hash);draw(hash.replace(/^#\/budget\/?/,''));root.focus({preventScroll:true});
      if(scroll)root.querySelector('.budget-workspace')?.scrollIntoView({block:'start',behavior:'instant'});
      const status=document.querySelector('#route-status');if(status)status.textContent=root.querySelector('h2')?.textContent||'';
    };
    root.querySelectorAll('[data-budget-route]').forEach(a=>a.onclick=event=>{if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(a.getAttribute('href'));});
    root.querySelector('[data-budget-year]').onchange=event=>preserveFocus(root,()=>navigate(path(event.target.value,type,codes),false));
    const redraw=()=>draw([year.year,type,...codes].join('/'));
    for(const attr of ['metric','view'])root.querySelectorAll(`[data-budget-${attr}]`).forEach(button=>button.onclick=()=>preserveFocus(root,()=>{state[attr]=button.dataset[attr==='metric'?'budgetMetric':'budgetView'];redraw();}));
    root.querySelector('[data-budget-compare]').onchange=event=>preserveFocus(root,()=>{state.compare=event.target.checked;redraw();});
    root.querySelector('[data-budget-search]').oninput=event=>{state.query=event.target.value;preserveFocus(root,redraw);};
    root.querySelector('[data-budget-search-scope]').onchange=event=>preserveFocus(root,()=>{state.searchScope=event.target.value;redraw();});
    mountCollectionTools(root.querySelector('[data-budget-tools]'),'budget',extra,config,lang,()=>preserveFocus(root,redraw));
    root.querySelector('[data-tool="direction"] option[value="asc"]').textContent=L('Nouseva','Stigande');
    root.querySelector('[data-tool="direction"] option[value="desc"]').textContent=L('Laskeva','Fallande');
    bindExportButtons(root,'budget',()=>items.map(item=>({year:year.year,type,metric:state.metric,actualThroughMonth:year.latestMonth,code:item.code,path:item.path.join('/'),name:name(item,lang),budget:item.budget,original:item.original,actual:item.actual,sharePercent:scope?amount(item)/scope*100:0,changePercent:delta(item)})),`vahtikissa-budjetti-${year.year}-${type}`);
  }
}
