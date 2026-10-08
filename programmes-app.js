import { fetchJSONWithTimeout } from './app-utils.js';
import { preserveFocus } from './collection-tools.js';
let data;
const state = { query:'', type:'all', language:'all' };
export async function renderProgrammes(root,lang,escapeHTML) {
  const requested=location.hash, L=(fi,sv)=>lang==='sv'?sv:fi, e=escapeHTML;
  try {
    if(!data)data=await fetchJSONWithTimeout('./data/programmes.json');
    if(requested!==location.hash||document.documentElement.lang!==lang)return;
    draw();
  } catch(error) {
    if(requested!==location.hash)return;
    root.innerHTML=`<div class="page"><section class="load-error" role="alert"><h1>${L('Ohjelmia ei voitu ladata','Programmen kunde inte laddas')}</h1><p>${e(error.message)}</p><button data-programme-retry>${L('Yritä uudelleen','Försök igen')}</button></section></div>`;
    root.querySelector('[data-programme-retry]').onclick=()=>renderProgrammes(root,lang,e);
  }
  function draw() {
    const typeNames={vaaliohjelma:L('Vaaliohjelma','Valprogram'),yleisohjelma:L('Periaate- ja yleisohjelma','Princip- och partiprogram'),tavoiteohjelma:L('Tavoiteohjelma','Målprogram')};
    const query=state.query.trim().toLocaleLowerCase('fi');
    const parties=data.parties.map(party=>({...party,programmes:party.programmes.filter(p=>(state.type==='all'||p.type===state.type)&&(state.language==='all'||p.language===state.language)&&(!query||[p.title,party.name.fi,party.name.sv,party.code,p.year,p.type].some(v=>String(v).toLocaleLowerCase('fi').includes(query))))})).filter(p=>p.programmes.length);
    const total=parties.reduce((sum,p)=>sum+p.programmes.length,0);
    root.innerHTML=`<div class="page programmes-page"><div class="page-head"><div><div class="eyebrow">${L('Puolueiden tavoitteet','Partiernas mål')} · 2023</div><h1>${L('Puolueohjelmat','Partiprogram')}</h1><p class="lead">${L('Mitä eduskuntapuolueet lupaavat? Tutustu vaali- ja periaateohjelmiin alkuperäisessä lähteessä.','Vad lovar riksdagspartierna? Läs val- och principprogrammen i originalkällan.')}</p></div><div class="updated">${L('Tarkistettu','Kontrollerad')} ${new Date(data.metadata.generatedAt).toLocaleDateString(lang==='sv'?'sv-FI':'fi-FI')}</div></div>
    <aside class="civic-note"><p>${L('Ohjelmat ovat Pohtivan Eduskuntavaalit 2023 -kokoelmasta. Mukana ovat vain nykyisessä eduskunnassa edustetut puolueet, joille kokoelmassa on ohjelmia. Ohjelman vuosi ja kieli näkyvät jokaisen linkin yhteydessä. Vanhempi ohjelma ei välttämättä kuvaa puolueen nykyisiä tavoitteita.','Programmen kommer från Pohtivas samling för riksdagsvalet 2023. Endast partier representerade i den nuvarande riksdagen med program i samlingen ingår. År och språk anges vid varje länk. Ett äldre program beskriver inte nödvändigtvis partiets nuvarande mål.')}</p><div class="source-links"><a href="${e(data.metadata.source)}" target="_blank" rel="noreferrer">Pohtiva · ${L('Yhteiskuntatieteellinen tietoarkisto','Finlands samhällsvetenskapliga dataarkiv')} ↗</a></div></aside>
    <div class="programme-filters"><label>${L('Haku','Sök')}<input data-programme-query type="search" value="${e(state.query)}" placeholder="${L('Puolue tai ohjelma…','Parti eller program…')}"></label><label>${L('Ohjelmatyyppi','Programtyp')}<select data-programme-type><option value="all">${L('Kaikki ohjelmat','Alla program')}</option>${Object.entries(typeNames).map(([k,v])=>`<option value="${k}" ${state.type===k?'selected':''}>${v}</option>`).join('')}</select></label><label>${L('Ohjelman kieli','Programmets språk')}<select data-programme-language>${[['all',L('Kaikki kielet','Alla språk')],['FI','Suomi'],['SV','Svenska'],['EN','English']].map(([k,v])=>`<option value="${k}" ${state.language===k?'selected':''}>${v}</option>`).join('')}</select></label></div>
    <p class="programme-count" role="status" aria-live="polite">${parties.length} ${L('puoluetta','partier')} · ${total} ${L('ohjelmaa','program')}</p>
    <div class="programme-grid">${parties.map(party=>`<section class="programme-card"><h2>${e(party.name[lang]||party.name.fi)}</h2><p>${e(party.code.toUpperCase())} · ${party.seats} ${L('edustajaa','ledamöter')}</p><ul>${party.programmes.map(p=>`<li><a href="${e(p.url)}" target="_blank" rel="noreferrer" lang="${p.language.toLowerCase()}">${e(p.title)} ↗</a><p>${p.year} · ${e(typeNames[p.type]||p.type)} · ${p.language}</p></li>`).join('')}</ul><a class="party-link" href="#/parties/${party.code}">${L('Puolueen toiminta eduskunnassa','Partiets arbete i riksdagen')} →</a></section>`).join('')||`<p class="empty">${L('Ei ohjelmia valituilla rajauksilla.','Inga program med dessa avgränsningar.')}</p>`}</div></div>`;
    for(const key of ['query','type','language']){const control=root.querySelector(`[data-programme-${key}]`);control[key==='query'?'oninput':'onchange']=event=>{state[key]=event.target.value;preserveFocus(root,draw);};}
  }
}
