import { escapeHTML as e, fetchJSONWithTimeout, localized, formatDate } from './app-utils.js';
import { exportButtons, bindExportButtons } from './data-tools.js';
import { speechSearchLink } from './speech-research.js';

let cloudPromise, profilePromise;
const loadClouds = () => cloudPromise ||= fetchJSONWithTimeout('./data/speech-wordclouds.json').catch(error=>{cloudPromise=null;throw error;});
const loadProfiles = () => profilePromise ||= fetchJSONWithTimeout('./data/member-profiles.json').catch(error=>{profilePromise=null;throw error;});

export function mountMemberInsights(container, member, lang) {
  const L = (fi,sv) => lang==='sv'?sv:fi, date = value => e(formatDate(value,lang==='sv'?'sv-FI':'fi-FI'));
  container.innerHTML = '<section class="member-wordcloud" id="member-vocabulary" tabindex="-1" data-wordcloud aria-busy="true"></section><section class="member-profile" id="member-about" tabindex="-1" data-member-profile aria-busy="true"></section>';
  const cloudRoot=container.querySelector('[data-wordcloud]'),profileRoot=container.querySelector('[data-member-profile]');
  const loading = '<p>'+L('Ladataan…','Laddar…')+'</p>';
  cloudRoot.innerHTML=loading;profileRoot.innerHTML=loading;
  const failure = (element,retry) => {
    if(!element.isConnected)return;
    element.setAttribute('aria-busy','false');
    element.innerHTML='<p role="alert">'+L('Tietoja ei voitu ladata.','Uppgifterna kunde inte laddas.')+'</p><button type="button" data-insights-retry>'+L('Yritä uudelleen','Försök igen')+'</button>';
    element.querySelector('button').onclick=retry;
  };
  async function clouds() {
    try {
      const snapshot=await loadClouds(); if(!cloudRoot.isConnected)return;
      const cloud=snapshot.members?.[member.id],terms=cloud?.terms || [],max=terms[0]?.score || 1,preview=24;
      cloudRoot.innerHTML='<div class="section-head"><div><span class="eyebrow">'+L('Puheiden sanasto','Ordförråd i anföranden')+'</span><h2>'+L('Ominaiset sanat','Utmärkande ord')+'</h2></div></div>'
        +'<p class="sub">'+(cloud?cloud.speeches.toLocaleString(lang):'0')+' '+L('puheenvuoroa','anföranden')+' · '+date(snapshot.generatedAt)+'</p>'
        +(terms.length?'<ul class="wordcloud" id="member-cloud-words" aria-label="'+L('Edustajalle ominaiset sanat; koko kuvaa erottuvuutta','Ledamotens utmärkande ord; storlek visar särprägel')+'">'+terms.map((term,index)=>'<li'+(index>=preview?' hidden':'')+'><a style="--word-size:'+Math.min(1.65,.85+.8*Math.sqrt(term.score/max)).toFixed(2)+'rem" href="'+e(speechSearchLink({query:term.word,mpId:member.id}))+'" aria-label="'+e(term.word+' · '+term.count+' '+L('esiintymää','förekomster')+' · '+term.speeches+' '+L('puheessa','anföranden'))+'">'+e(term.word)+'<small>'+term.count.toLocaleString(lang)+'</small></a></li>').join('')+'</ul>'+(terms.length>preview?'<button type="button" class="cloud-expand" data-cloud-expand aria-expanded="false" aria-controls="member-cloud-words">'+L('Näytä kaikki sanat','Visa alla ord')+' ('+terms.length+')</button>':''):'<p class="empty">'+L('Aineistossa ei ole riittävästi erottuvia sanoja tähän pilveen.','Materialet innehåller inte tillräckligt med utmärkande ord för detta moln.')+'</p>')
        +'<p class="research-note">'+L('Korostaa sanoja, joita edustaja käyttää suhteellisesti muita useammin. Valitse sana tutkiaksesi puheita.','Framhäver ord som ledamoten använder relativt oftare än andra. Välj ett ord för att undersöka anföranden.')+'</p>'
        +'<details><summary>'+L('Laskentatapa ja aineisto','Beräkningsmetod och material')+'</summary><p class="research-note">'+L('Yleiset suomen ja ruotsin sanat, eduskuntakielen perussanasto (esim. Suomi ja hallitus), puhuttelut ja hakasulkeiden toimitusmerkinnät poistetaan. Taivutusmuodot lasketaan erikseen. Kun edustajalla on vähintään viisi puhetta, sanalta vaaditaan kolme esiintymää vähintään kahdessa puheessa.','Vanliga finska och svenska ord, parlamentariskt grundordförråd (t.ex. Finland och regering), hälsningsfraser och redaktionella anteckningar inom hakparenteser tas bort. Böjningsformer räknas separat. Vid minst fem anföranden krävs tre förekomster i minst två anföranden.')+'</p><p class="research-note">'+L('Koko ja järjestys perustuvat pistemäärään √esiintymät × log₂(suhteellinen yleisyys). Yleisyys on sanan osuus edustajan suodatetuista sanoista verrattuna muiden edustajien sanoihin; laskennassa lisätään 0,5 esiintymää ja 1 sana. Vähimmäissuhde on 1,25. Jos vertailuaineisto puuttuu, käytetään √esiintymät. Koko ei ilmaise poliittista merkitystä.','Storlek och ordning baseras på poängen √förekomster × log₂(relativ frekvens). Frekvensen är ordets andel av ledamotens filtrerade ord jämfört med övriga ledamöters ord; 0,5 förekomster och 1 ord läggs till. Minimikvoten är 1,25. Utan jämförelsematerial används √förekomster. Storleken anger inte politisk betydelse.')+'</p><p class="sub">'+L('Vähintään kolme kirjainta; poikkeukset EU, YK ja FN. Poistosanalista','Minst tre bokstäver; undantag EU, YK och FN. Stoppordlista')+': <a href="./speech-research.js" target="_blank" rel="noreferrer">'+e(snapshot.method.stopwords)+'</a>.</p>'+exportButtons('wordcloud',lang)+'<div class="table-wrap"><table><caption>'+L('Pilven sanat','Orden i molnet')+'</caption><thead><tr><th scope="col">'+L('Sana','Ord')+'</th><th scope="col">'+L('Esiintymät','Förekomster')+'</th><th scope="col">'+L('Puheita','Anföranden')+'</th></tr></thead><tbody>'+terms.map(term=>'<tr><td data-label="'+L('Sana','Ord')+'">'+e(term.word)+'</td><td data-label="'+L('Esiintymät','Förekomster')+'">'+term.count+'</td><td data-label="'+L('Puheita','Anföranden')+'">'+term.speeches+'</td></tr>').join('')+'</tbody></table></div></details>';
      const expand=cloudRoot.querySelector('[data-cloud-expand]');
      if(expand)expand.onclick=()=>{
        const expanded=expand.getAttribute('aria-expanded')!=='true';
        cloudRoot.querySelectorAll('.wordcloud li').forEach((item,index)=>item.hidden=!expanded&&index>=preview);
        expand.setAttribute('aria-expanded',String(expanded));
        expand.textContent=expanded?L('Näytä vähemmän','Visa färre'):L('Näytä kaikki sanat','Visa alla ord')+' ('+terms.length+')';
      };
      bindExportButtons(cloudRoot,'wordcloud',()=>terms.map(term=>({mpId:member.id,...term,generatedAt:snapshot.generatedAt,stopwords:snapshot.method.stopwords,ranking:snapshot.method.ranking})),'vahtikissa-'+member.id+'-sanat');
      cloudRoot.setAttribute('aria-busy','false');
    }catch{failure(cloudRoot,clouds);}
  }
  async function profiles() {
    try {
      const snapshot=await loadProfiles();if(!profileRoot.isConnected)return;
      const p=snapshot.members?.[member.id];if(!p)throw new Error('Missing official member profile');
      const value = v => e(localized(v,lang)), missing=L('Ei julkaistu lähteessä','Inte publicerat i källan');
      const period = row => (row.from?date(row.from):'—')+' – '+(row.to?date(row.to):L('jatkuu lähdetiedoissa','fortgår enligt källan'));
      const row=(label,content)=>'<div><dt>'+label+'</dt><dd>'+(content||missing)+'</dd></div>';
      const list=(items,render)=>items.length?'<ul class="profile-list">'+items.map(item=>'<li>'+render(item)+'</li>').join('')+'</ul>':'<p class="sub">'+missing+'</p>';
      const day=snapshot.metadata.generatedAt.slice(0,10),current=row=>(!row.from||row.from<=day)&&(!row.to||row.to>=day);
      const committees=p.committees.filter(current);
      const status={Nykyinen:L('Nykyinen edustaja','Nuvarande ledamot'),Entinen:L('Entinen edustaja','Tidigare ledamot'),Keskeytynyt:L('Edustajantoimi keskeytynyt','Ledamotsuppdraget avbrutet')}[p.status] || e(p.status);
      const career=p.career[lang]?.length?p.career[lang]:p.career.fi;
      const bodies=p.bodies[lang]?.length?p.bodies[lang]:p.bodies.fi;
      const government=p.government[lang]?.length?p.government[lang]:p.government.fi;
      profileRoot.innerHTML='<div class="section-head"><div><span class="eyebrow">'+L('Eduskunnan julkaisema profiili','Profil publicerad av riksdagen')+'</span><h2>'+L('Tietoja edustajasta','Om ledamoten')+'</h2></div><a href="'+e(p.pageUrl)+'" target="_blank" rel="noreferrer">'+L('Edustajan virallinen sivu','Ledamotens officiella sida')+' ↗</a></div>'
        +'<p class="sub">'+L('Lähde: Eduskunta','Källa: Riksdagen')+' · '+date(snapshot.metadata.generatedAt)+'</p>'
        +'<div class="profile-grid"><dl class="profile-facts">'+row(L('Ammatti','Yrke'),value(p.occupation))+row(L('Vaalipiiri','Valkrets'),value(p.district))+row(L('Sähköposti','E-post'),p.email?'<a href="mailto:'+e(p.email)+'">'+e(p.email)+'</a>':'')+'</dl>'
        +'<section><h3>'+L('Valiokuntatehtävät','Utskottsuppdrag')+'</h3>'+list(committees,item=>'<strong>'+value(item.name)+'</strong><span>'+value(item.role)+' · '+period(item)+'</span>')+'</section></div>'
        +'<div class="profile-details"><details><summary>'+L('Yhteys- ja henkilötiedot','Kontakt- och personuppgifter')+'</summary><dl class="profile-facts">'+row(L('Edustajantoimi','Ledamotsuppdrag'),status)+row(L('Kotikunta','Hemkommun'),e(p.municipality))+row(L('Syntynyt','Född'),[p.birthYear,e(p.birthPlace)].filter(Boolean).join(' · '))+row(L('Puhelin','Telefon'),p.phone?'<a href="tel:'+e(p.phone.replace(/[^+\d]/g,''))+'">'+e(p.phone)+'</a>':'')+'</dl></details><details><summary>'+L('Koulutus','Utbildning')+' ('+p.education.length+')</summary>'+list(p.education,item=>'<strong>'+value(item.degree)+'</strong><span>'+[value(item.institution),item.year].filter(Boolean).join(' · ')+'</span>')+'</details>'
        +'<details><summary>'+L('Työhistoria','Arbetshistoria')+' ('+career.length+')</summary>'+list(career,item=>'<strong>'+e(item.title)+'</strong><span>'+e(item.period)+'</span>')+'</details>'
        +'<details><summary>'+L('Edustajakaudet ja keskeytykset','Ledamotsperioder och avbrott')+'</summary>'+list(p.terms,item=>period(item))+list(p.interruptions,item=>value(item.reason)+' · '+period(item))+'</details>'
        +'<details><summary>'+L('Valiokuntien, toimielinten ja ministeritehtävien historia','Historik över utskott, organ och ministeruppdrag')+'</summary>'+list(p.committees,item=>value(item.name)+' · '+value(item.role)+' · '+period(item))+list(bodies,item=>e(item.name)+' · '+e(item.role)+' · '+period(item))+list(government,item=>e(item.name)+' · '+period(item))+'</details><details><summary>'+L('Tietojen lähde','Uppgifternas källa')+'</summary>'+'<p class="research-note">'+L('Lähdetiedot haettu','Källuppgifter hämtade')+' '+date(snapshot.metadata.generatedAt)+'. '+L('Työhistoria ja koulutus esitetään lähteen sanamuodossa; ne eivät yksin kerro nykyisestä työsuhteesta.','Arbetshistoria och utbildning återges enligt källan; de anger inte i sig aktuell anställning.')+' <a href="'+e(p.sourceUrl)+'" target="_blank" rel="noreferrer">'+L('Alkuperäinen tietue','Ursprunglig datapost')+' ↗</a></p>'+'</details></div>';
      profileRoot.setAttribute('aria-busy','false');
    }catch{failure(profileRoot,profiles);}
  }
  clouds();profiles();
}
