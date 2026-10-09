import { budgetLevel, budgetChange, budgetTotals, budgetTreemap } from './budget-utils.js';
import { fetchJSONWithTimeout } from './app-utils.js';
import { exportButtons, bindExportButtons } from './data-tools.js';
import { filterBudgetItems } from './civic-utils.js';
import { collectionState, applyCollection, facetOptions, mountCollectionTools, preserveFocus } from './collection-tools.js';

let snapshot;
const state = { metric: 'budget', view: 'map', query: '', compare: false };
const filters = new Map();
const palette = ['#245b87','#7133a0','#386b30','#116a72','#8f3548','#776020','#39567b','#635299','#276650','#924a28','#455b71','#7d4870'];
const name = (item,lang) => item?.name?.[lang] || item?.name?.fi || item?.code || '';
const number = (n,lang,digits=1) => new Intl.NumberFormat(lang==='sv'?'sv-FI':'fi-FI',{maximumFractionDigits:digits}).format(n);
const money = (n,lang) => Math.abs(n)>=1e9 ? `${number(n/1e9,lang)} ${lang==='sv'?'md €':'mrd. €'}` : Math.abs(n)>=1e6 ? `${number(n/1e6,lang)} ${lang==='sv'?'mn €':'milj. €'}` : `${number(n,lang,0)} €`;
const path = (year,type,codes=[]) => `#/budget/${[year,type,...codes].join('/')}`;
const amount = item => Number(item?.[state.metric]) || 0;

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
    const route=String(id).split('/').filter(Boolean), years=snapshot.years;
    const year=years.find(y=>String(y.year)===route[0])||years.at(-1);
    const type=route[1]==='income'?'income':'expense', codes=route.slice(2);
    const level=budgetLevel(year,type,codes), previous=years.find(y=>y.year===year.year-1), old=budgetLevel(previous,type,codes);
    const totals=budgetTotals(year,state.metric), scope=level.node?amount(level.node):totals[type];
    const title=level.node?name(level.node,lang):L(type==='income'?'Mistä rahat tulevat?':'Mihin rahat menevät?',type==='income'?'Varifrån kommer pengarna?':'Vart går pengarna?');
    const key=`${year.year}-${type}-${codes.join('-')}`;
    if(!filters.has(key))filters.set(key,collectionState('amount','desc'));
    const extra=filters.get(key), config={label:L('Budjetti','Budget'),sorts:[{key:'amount',label:L('Summa','Belopp'),value:amount},{key:'name',label:L('Nimi','Namn'),value:item=>name(item,lang)},{key:'code',label:L('Tunnus','Kod'),value:item=>item.code}],number:{label:L('Summa (€)','Belopp (€)'),value:amount},facets:[{key:'code',label:L('Budjettikohdat','Budgetposter'),value:item=>item.code,options:facetOptions(level.items,item=>item.code,code=>name(level.items.find(x=>x.code===code),lang),lang)}]};
    const items=applyCollection(filterBudgetItems(level.items,state.query),extra,config,lang);
    const comparisonAllowed=state.metric!=='actual'||year.latestMonth===previous?.latestMonth;
    const delta=item=>comparisonAllowed?budgetChange(amount(item),old.valid?amount(old.items.find(x=>x.code===item.code)):0):null;
    const change=item=>delta(item)===null?'—':`${delta(item)>0?'+':''}${number(delta(item),lang)} %`;
    const color=item=>palette[(Number(item.code.slice(0,2))||0)%palette.length];
    const link=item=>path(year.year,type,[...codes,item.code]);
    const crumbs=[`<a data-budget-route href="${path(year.year,type)}">${L(type==='income'?'Tulot':'Menot',type==='income'?'Inkomster':'Utgifter')}</a>`,...codes.map((code,i)=>{const node=budgetLevel(year,type,codes.slice(0,i+1)).node;return `<a data-budget-route href="${path(year.year,type,codes.slice(0,i+1))}" ${i===codes.length-1?'aria-current="page"':''}>${e(name(node,lang)||code)}</a>`})];
    const labels=[['expense',L('Menot','Utgifter'),totals.expense],['income',L('Tulot ilman lainanottoa','Inkomster utan lån'),totals.revenue],['borrowing',L('Lainanotto (netto)','Upplåning (netto)'),totals.borrowing],['balance',L('Tasapaino ilman lainanottoa','Balans utan upplåning'),totals.balance]];
    root.dataset.route=location.hash;
    document.title=`${title} ${year.year} | ${L('Vahtikissa','Vaktkatt')}`;
    root.innerHTML=`<div class="page budget-page budget-remade">
      <div class="page-head"><div><div class="eyebrow">${L('Valtion talousarvio','Statsbudgeten')} · ${year.year}</div><h1>${L('Tutki budjettia','Utforska budgeten')}</h1><p class="lead">${L('Avaa kokonaisuus, seuraa euroja ja vertaile vuosia.','Öppna helheten, följ pengarna och jämför år.')}</p></div><div class="updated">${L('Päivitetty','Uppdaterad')} ${new Date(snapshot.metadata.generatedAt).toLocaleDateString(lang==='sv'?'sv-FI':'fi-FI')}</div></div>
      <div class="civic-toolbar budget-toolbar"><label class="filter-control"><span>${L('Vuosi','År')}</span><select data-budget-year>${[...years].reverse().map(y=>`<option value="${y.year}" ${y===year?'selected':''}>${y.year}</option>`).join('')}</select></label>
      <div class="segmented" role="group" aria-label="${L('Budjetin puoli','Budgetens sida')}">${['expense','income'].map(t=>`<a data-budget-route href="${path(year.year,t)}" class="${t===type?'active':''}" ${t===type?'aria-current="page"':''}>${L(t==='income'?'Tulot':'Menot',t==='income'?'Inkomster':'Utgifter')}</a>`).join('')}</div>
      <div class="segmented" role="group" aria-label="${L('Mittari','Mått')}">${['budget','original','actual'].map(m=>`<button data-budget-metric="${m}" aria-pressed="${state.metric===m}" class="${state.metric===m?'active':''}">${m==='budget'?L('Voimassa oleva','Gällande budget'):m==='original'?L('Alkuperäinen','Ursprunglig budget'):L('Toteuma','Utfall')}</button>`).join('')}</div></div>
      <section class="budget-overview" aria-label="${L('Budjetin kokonaisuus','Budgetens helhet')}">${labels.map(([key,label,value])=>`<div><span>${label}</span><strong class="${value<0?'negative':''}">${money(value,lang)}</strong></div>`).join('')}</section>
      <p class="budget-period">${L('Toteumatiedot','Utfallsuppgifter')}: ${year.latestMonth}/12 ${year.year}. ${L('Tulot sisältävät lainanoton. Tasapaino yllä lasketaan ilman lainanottoa.','Inkomsterna omfattar upplåning. Balansen ovan beräknas utan upplåning.')}</p>
      <nav class="budget-crumbs" aria-label="${L('Murupolku','Sökväg')}">${crumbs.join('<span aria-hidden="true">›</span>')}</nav>
      <section class="budget-explorer-head"><div><h2>${e(title)}</h2><p>${L('Laatikon pinta-ala näyttää summan. Avaa laatikko nähdäksesi tarkemman jaon. Kaikki kohdat löytyvät myös taulukosta.','Rutans yta visar beloppet. Öppna en ruta för en mer detaljerad fördelning. Alla poster finns också i tabellen.')}</p></div><div class="budget-scope-total"><span>${L('Valittu kokonaisuus','Vald helhet')}</span><strong>${money(scope,lang)}</strong></div></section>
      <div class="budget-view-tools"><div class="segmented" role="group" aria-label="${L('Kaavion tyyppi','Diagramtyp')}"><button data-budget-view="map" aria-pressed="${state.view==='map'}" class="${state.view==='map'?'active':''}">${L('Aluekartta','Ytkarta')}</button><button data-budget-view="bars" aria-pressed="${state.view==='bars'}" class="${state.view==='bars'?'active':''}">${L('Palkit','Staplar')}</button></div><label class="budget-compare"><input data-budget-compare type="checkbox" ${state.compare?'checked':''} ${!previous?'disabled':''}> ${L('Vertaa edellisvuoteen','Jämför med föregående år')} ${previous?.year||''}</label></div>
      ${state.compare&&!comparisonAllowed?`<p class="civic-note">${L('Vuosien toteumat kattavat eri määrän kuukausia. Prosenttivertailu näytetään vain samanpituisille jaksoille.','Årens utfall omfattar olika antal månader. Procentjämförelsen visas endast för lika långa perioder.')}</p>`:''}
      <div class="filters civic-search"><input data-budget-search type="search" value="${e(state.query)}" aria-label="${L('Hae budjettikohdista','Sök budgetposter')}" placeholder="${L('Hae nimellä tai tunnuksella…','Sök med namn eller kod…')}"></div>
      <p class="filter-summary" role="status" aria-live="polite">${items.length} ${L('kohtaa','poster')}</p>
      <div class="budget-chart-navigation">${codes.length?`<a data-budget-route class="budget-back" href="${path(year.year,type,codes.slice(0,-1))}">← ${L('Takaisin ylemmälle tasolle','Tillbaka till föregående nivå')}</a>`:''}<span>${e(title)} · ${money(scope,lang)}</span></div>
      ${!level.valid?`<div class="empty">${L('Budjettikohtaa ei löytynyt tältä vuodelta.','Budgetposten finns inte för detta år.')} <a data-budget-route href="${path(year.year,type)}">${L('Näytä kokonaisuus','Visa helheten')}</a></div>`:!items.length?`<div class="empty">${level.node&&!level.node.children?.length?L('Tämä on budjetin tarkin taso.','Detta är budgetens mest detaljerade nivå.'):L('Ei tietoja valituilla rajauksilla.','Inga uppgifter med dessa avgränsningar.')}</div>`:''}
      ${state.view==='map'&&items.length?`<div class="budget-map-layout"><div class="budget-treemap" role="group" aria-label="${L('Budjetin aluekartta','Budgetens ytkarta')}">${budgetTreemap(items,amount).map(rect=>{const item=rect.item,small=rect.width<12||rect.height<10,desc=`${name(item,lang)} · ${money(amount(item),lang)} · ${number(scope?amount(item)/scope*100:0,lang)} %`;return `<${small?'div role="img"':'a data-budget-route'} class="budget-tile ${small?'compact':''}" ${small?'':`href="${link(item)}"`} aria-label="${e(desc)}" style="left:${rect.x}%;top:${rect.y/65*100}%;width:${rect.width}%;height:${rect.height/65*100}%;--tile-color:${color(item)}"><span>${e(name(item,lang))}</span><strong>${state.compare?change(item):money(amount(item),lang)}</strong></${small?'div':'a'}>`}).join('')}</div><section class="budget-map-key" aria-label="${L('Aluekartan kaikki kohdat','Alla poster i ytkartan')}"><h3>${L('Aluekartan kohdat','Posterna i ytkartan')}</h3><p>${L('Lue koko nimi ja avaa kohta tästä.','Läs hela namnet och öppna posten här.')}</p><ul>${items.map(item=>`<li><a data-budget-route href="${link(item)}"><span class="budget-key-swatch" style="--tile-color:${color(item)}" aria-hidden="true"></span><span><small>${e(item.code)}</small><strong>${e(name(item,lang))}</strong><span>${money(amount(item),lang)} · ${number(scope?amount(item)/scope*100:0,lang)} %</span></span></a></li>`).join('')}</ul></section></div>`:''}
      ${state.view==='bars'?`<div class="budget-bars">${items.map(item=>`<a data-budget-route class="budget-row budget-row-link" href="${link(item)}" style="--budget-color:${color(item)}"><div class="budget-row-head"><strong>${e(name(item,lang))}</strong><strong>${state.compare?change(item):money(amount(item),lang)}</strong></div><div class="budget-track"><span style="width:${Math.max(0,Math.min(100,scope?amount(item)/scope*100:0))}%"></span></div></a>`).join('')}</div>`:''}
      <div data-budget-tools></div><div class="data-actions">${exportButtons('budget',lang)}</div>
      ${items.length?`<div class="table-wrap budget-detail-table"><table aria-label="${L('Budjettikohdat ja summat','Budgetposter och belopp')}"><thead><tr><th scope="col">${L('Kohde','Post')}</th><th scope="col">${L('Summa','Belopp')}</th><th scope="col">${L('Osuus','Andel')}</th>${state.compare?`<th scope="col">${L('Muutos','Förändring')} ${previous?.year||''}</th>`:''}</tr></thead><tbody>${items.map(item=>`<tr><td><a data-budget-route href="${link(item)}">${e(name(item,lang))}</a><span class="sub">${e(item.code)}</span></td><td>${money(amount(item),lang)}</td><td>${number(scope?amount(item)/scope*100:0,lang)} %</td>${state.compare?`<td>${change(item)}</td>`:''}</tr>`).join('')}</tbody></table></div>`:''}
      <aside class="civic-note"><p>${L('Voimassa oleva talousarvio sisältää lisätalousarviot. Toteuma on Valtiokonttorin julkaisema kertymä yllä ilmoitettuun kuukauteen asti. Yksityiskohtaiset nimet ovat lähdeaineistossa suomeksi.','Den gällande budgeten inkluderar tilläggsbudgetar. Utfallet är Statskontorets publicerade utfall fram till månaden ovan. Detaljerade benämningar är på finska i källmaterialet.')}</p><div class="source-links"><a href="https://avoindata.tutkihallintoa.fi/" target="_blank" rel="noreferrer">${L('Valtiokonttori · lähde','Statskontoret · källa')} ↗</a></div></aside>
    </div>`;
    const navigate=hash=>{state.query='';history.pushState(null,'',hash);draw(hash.replace(/^#\/budget\/?/,''));root.focus({preventScroll:true});const status=document.querySelector('#route-status');if(status)status.textContent=root.querySelector('h2')?.textContent||'';};
    root.querySelectorAll('[data-budget-route]').forEach(a=>a.onclick=event=>{if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();navigate(a.getAttribute('href'));});
    root.querySelector('[data-budget-year]').onchange=event=>preserveFocus(root,()=>navigate(path(event.target.value,type,codes)));
    for(const attr of ['metric','view'])root.querySelectorAll(`[data-budget-${attr}]`).forEach(button=>button.onclick=()=>preserveFocus(root,()=>{state[attr]=button.dataset[attr==='metric'?'budgetMetric':'budgetView'];draw([year.year,type,...codes].join('/'));}));
    root.querySelector('[data-budget-compare]').onchange=event=>preserveFocus(root,()=>{state.compare=event.target.checked;draw([year.year,type,...codes].join('/'));});
    root.querySelector('[data-budget-search]').oninput=event=>{state.query=event.target.value;preserveFocus(root,()=>draw([year.year,type,...codes].join('/')));};
    mountCollectionTools(root.querySelector('[data-budget-tools]'),'budget',extra,config,lang,()=>preserveFocus(root,()=>draw([year.year,type,...codes].join('/'))));
    bindExportButtons(root,'budget',()=>items.map(item=>({year:year.year,type,code:item.code,name:name(item,lang),budget:item.budget,original:item.original,actual:item.actual,sharePercent:scope?amount(item)/scope*100:0,changePercent:delta(item)})),`vahtikissa-budjetti-${year.year}-${type}`);
  }
}
