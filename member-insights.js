import { escapeHTML as e, fetchJSONWithTimeout, localized, formatDate } from './app-utils.js';
import { exportButtons, bindExportButtons } from './data-tools.js';
import { speechSearchLink } from './speech-research.js';

let cloudPromise, profilePromise;
const loadClouds = () => cloudPromise ||= fetchJSONWithTimeout('./data/speech-wordclouds.json').catch(error=>{cloudPromise=null;throw error;});
const loadProfiles = () => profilePromise ||= fetchJSONWithTimeout('./data/member-profiles.json').catch(error=>{profilePromise=null;throw error;});

export function mountMemberInsights(container, member, lang) {
  const L = (fi,sv) => lang==='sv'?sv:fi, date = value => e(formatDate(value,lang==='sv'?'sv-FI':'fi-FI'));
  container.innerHTML = '<section class="member-wordcloud" data-wordcloud aria-busy="true"></section><section class="member-profile" data-member-profile aria-busy="true"></section>';
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
      const cloud=snapshot.members?.[member.id],terms=cloud?.terms || [],max=terms[0]?.count || 1;
      cloudRoot.innerHTML='<div class="section-head"><div><span class="eyebrow">'+L('Puheiden sanasto','Ordförråd i anföranden')+'</span><h2>'+L('Mistä edustaja puhuu?','Vad talar ledamoten om?')+'</h2></div>'+exportButtons('wordcloud',lang)+'</div>'
        +'<p class="sub">'+(cloud?cloud.speeches.toLocaleString(lang):'0')+' '+L('puheenvuoroa','anföranden')+' · '+L('Aineisto päivitetty','Materialet uppdaterat')+' '+date(snapshot.generatedAt)+'</p>'
        +(terms.length?'<ul class="wordcloud" aria-label="'+L('Yleisimmät sanat; koko vastaa esiintymien määrää','Vanligaste orden; storlek motsvarar antal förekomster')+'">'+terms.map(term=>'<li><a style="--word-size:'+Math.min(2.4,.9+1.5*Math.sqrt(term.count/max)).toFixed(2)+'rem" href="'+e(speechSearchLink({query:term.word,mpId:member.id}))+'" aria-label="'+e(term.word+' · '+term.count+' '+L('esiintymää','förekomster')+' · '+term.speeches+' '+L('puheessa','anföranden'))+'">'+e(term.word)+'<small>'+term.count.toLocaleString(lang)+'</small></a></li>').join('')+'</ul>':'<p class="empty">'+L('Seuranta-aineistossa ei ole sanoja tähän pilveen.','Inga ord i uppföljningsmaterialet för detta moln.')+'</p>')
        +'<p class="research-note">'+L('Valitse sana hakeaksesi sen tämän edustajan puheista. Yleisimmät suomen ja ruotsin sanat, puhuttelut ja hakasulkeissa olevat toimitukselliset merkinnät on poistettu. Taivutusmuodot lasketaan erikseen. Koko kuvaa lukumäärää, ei poliittista merkitystä.','Välj ett ord för att söka i ledamotens anföranden. Vanliga finska och svenska ord, hälsningsfraser och redaktionella anteckningar inom hakparenteser har tagits bort. Böjningsformer räknas separat. Storleken visar antal, inte politisk betydelse.')+'</p>'
        +'<details><summary>'+L('Sanat ja laskentatapa','Ord och beräkningsmetod')+'</summary><p>'+L('Pienet kirjaimet, vähintään kolme kirjainta (poikkeukset: EU, YK ja FN). Sama sana voi esiintyä monta kertaa yhdessä puheessa.','Gemener, minst tre bokstäver (undantag: EU, YK och FN). Samma ord kan förekomma flera gånger i ett anförande.')+' '+L('Poistosanalista','Stoppordlista')+': <a href="./speech-research.js" target="_blank" rel="noreferrer">'+e(snapshot.method.stopwords)+'</a>.</p><div class="table-wrap"><table><caption>'+L('Pilven sanat','Orden i molnet')+'</caption><thead><tr><th scope="col">'+L('Sana','Ord')+'</th><th scope="col">'+L('Esiintymät','Förekomster')+'</th><th scope="col">'+L('Puheita','Anföranden')+'</th></tr></thead><tbody>'+terms.map(term=>'<tr><td>'+e(term.word)+'</td><td>'+term.count+'</td><td>'+term.speeches+'</td></tr>').join('')+'</tbody></table></div></details>';
      bindExportButtons(cloudRoot,'wordcloud',()=>terms.map(term=>({mpId:member.id,...term,generatedAt:snapshot.generatedAt,stopwords:snapshot.method.stopwords})),'vahtikissa-'+member.id+'-sanat');
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
      profileRoot.innerHTML='<div class="section-head"><div><span class="eyebrow">'+L('Eduskunnan julkaisema profiili','Profil publicerad av riksdagen')+'</span><h2>'+L('Tausta ja tehtävät','Bakgrund och uppdrag')+'</h2></div><a href="'+e(p.pageUrl)+'" target="_blank" rel="noreferrer">'+L('Edustajan virallinen sivu','Ledamotens officiella sida')+' ↗</a></div>'
        +'<p class="research-note">'+L('Lähdetiedot haettu','Källuppgifter hämtade')+' '+date(snapshot.metadata.generatedAt)+'. '+L('Työhistoria ja koulutus esitetään lähteen sanamuodossa; ne eivät yksin kerro nykyisestä työsuhteesta.','Arbetshistoria och utbildning återges enligt källan; de anger inte i sig aktuell anställning.')+' <a href="'+e(p.sourceUrl)+'" target="_blank" rel="noreferrer">'+L('Alkuperäinen tietue','Ursprunglig datapost')+' ↗</a></p>'
        +'<div class="profile-grid"><dl class="profile-facts">'+row(L('Edustajantoimi','Ledamotsuppdrag'),status)+row(L('Vaalipiiri','Valkrets'),value(p.district))+row(L('Kotikunta','Hemkommun'),e(p.municipality))+row(L('Ammatti','Yrke'),value(p.occupation))+row(L('Syntynyt','Född'),[p.birthYear,e(p.birthPlace)].filter(Boolean).join(' · '))+row(L('Sähköposti','E-post'),p.email?'<a href="mailto:'+e(p.email)+'">'+e(p.email)+'</a>':'')+row(L('Puhelin','Telefon'),p.phone?'<a href="tel:'+e(p.phone.replace(/[^+\d]/g,''))+'">'+e(p.phone)+'</a>':'')+'</dl>'
        +'<section><h3>'+L('Valiokuntatehtävät lähdetietojen päivänä','Utskottsuppdrag vid hämtningstillfället')+'</h3>'+list(committees,item=>'<strong>'+value(item.name)+'</strong><span>'+value(item.role)+' · '+period(item)+'</span>')+'</section></div>'
        +'<div class="profile-details"><details><summary>'+L('Koulutus','Utbildning')+' ('+p.education.length+')</summary>'+list(p.education,item=>'<strong>'+value(item.degree)+'</strong><span>'+[value(item.institution),item.year].filter(Boolean).join(' · ')+'</span>')+'</details>'
        +'<details><summary>'+L('Työhistoria','Arbetshistoria')+' ('+career.length+')</summary>'+list(career,item=>'<strong>'+e(item.title)+'</strong><span>'+e(item.period)+'</span>')+'</details>'
        +'<details><summary>'+L('Edustajakaudet ja keskeytykset','Ledamotsperioder och avbrott')+'</summary>'+list(p.terms,item=>period(item))+list(p.interruptions,item=>value(item.reason)+' · '+period(item))+'</details>'
        +'<details><summary>'+L('Valiokuntien, toimielinten ja ministeritehtävien historia','Historik över utskott, organ och ministeruppdrag')+'</summary>'+list(p.committees,item=>value(item.name)+' · '+value(item.role)+' · '+period(item))+list(bodies,item=>e(item.name)+' · '+e(item.role)+' · '+period(item))+list(government,item=>e(item.name)+' · '+period(item))+'</details></div>';
      profileRoot.setAttribute('aria-busy','false');
    }catch{failure(profileRoot,profiles);}
  }
  clouds();profiles();
}
