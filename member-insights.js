import { escapeHTML as e, fetchJSONWithTimeout, localized, formatDate } from './app-utils.js';
import { exportButtons, bindExportButtons } from './data-tools.js';
import { speechSearchLink } from './speech-research.js';

let cloudPromise, profilePromise, contactsPromise;
const loadClouds = () => cloudPromise ||= fetchJSONWithTimeout('./data/speech-wordclouds.json').catch(error=>{cloudPromise=null;throw error;});
const loadProfiles = () => profilePromise ||= fetchJSONWithTimeout('./data/member-profiles.json').catch(error=>{profilePromise=null;throw error;});

const loadContacts = () => contactsPromise ||= fetchJSONWithTimeout('./data/member-contacts.json').catch(error=>{contactsPromise=null;throw error;});

const profileEnglish = {
  'Ladataan…':'Loading…', 'Tietoja ei voitu ladata.':'The records could not be loaded.', 'Yritä uudelleen':'Try again',
  'Ei ilmoitettu Eduskunnan tiedoissa':'Not published in Parliament’s records', 'Nykyinen kansanedustaja':'Current MP', 'Entinen kansanedustaja':'Former MP', 'Edustajantoimi keskeytynyt':'Parliamentary service interrupted',
  'Eduskunnan julkaisemista tiedoista':'From records published by Parliament', 'Tietoja edustajasta':'Background', 'Taustatiedot':'Background', 'Edustajan virallinen sivu':'Official MP page', 'Profiilitiedot tarkistettu':'Profile retrieved',
  'Edustajantoimi':'Parliamentary service', 'Ammatti tai tutkinto':'Occupation or degree', 'Eduskunnan ilmoittama taustatieto':'Background published by Parliament', 'Vaalipiiri':'Constituency',
  'Yhteystiedot':'Contact details', 'Sähköposti':'Email', 'Puhelin':'Phone', 'Henkilökohtaista numeroa ei ole julkaistu.':'No personal phone number has been published.',
  'Nykyiset tehtävät':'Current roles', 'Ei voimassa olevia valiokunta- tai toimielintehtäviä lähdetiedoissa.':'No current committee or parliamentary body roles in the source.',
  'Henkilötiedot':'Personal details', 'Kotikunta':'Municipality', 'Syntymävuosi ja -paikka':'Birth year and place', 'Koulutus':'Education', 'Koulutustietoja ei ole julkaistu.':'Education details have not been published.',
  'Työhistoria':'Employment history', 'Työhistoriaa ei ole julkaistu.':'Employment history has not been published.', 'Edustajakaudet ja keskeytykset':'Terms and interruptions', 'Edustajakaudet':'Parliamentary terms', 'Keskeytykset':'Interruptions', 'Ei kirjattuja keskeytyksiä.':'No recorded interruptions.',
  'Valiokunnat ja muut eduskunnan tehtävät':'Committees and other parliamentary roles', 'Ministeritehtävät':'Ministerial roles', 'Ei kirjattuja ministeritehtäviä.':'No recorded ministerial roles.', 'Tietojen lähde':'Source', 'Alkuperäinen tietue':'Original record',
  'Eduskunta-avustajat':'Parliamentary assistants', 'Eduskunta ei ole julkaissut avustajan yhteystietoja.':'Parliament has not published assistant contact details.', 'Avustajatiedot tarkistettu':'Assistant details retrieved', 'Yhteystietojen lähde':'Contact details source',
  'Ammatti, tutkinto ja työhistoria perustuvat Eduskunnan julkaisemiin taustatietoihin. Ne eivät välttämättä kuvaa nykyistä työtä. Puuttuva tieto ei tarkoita, ettei koulutusta tai työkokemusta olisi.':'Occupation, education and employment history come from Parliament’s published background records. They may describe earlier work. Missing records do not mean a person has no education or work experience.'
};
const profileText = lang => (fi, sv, en) => lang === 'en' ? en || profileEnglish[fi] || fi : lang === 'sv' ? sv : fi;
export function memberSectionNavigation(member, lang, { vocabulary = true } = {}) {
  const L = profileText(lang);
  return `<nav class="member-tabs" aria-label="${L('Edustajan sivun osiot','Avsnitt på ledamotens sida','Sections on this MP’s page')}">
    <button type="button" data-member-jump="member-votes">${L('Äänestykset','Omröstningar','Votes')}</button>
    <button type="button" data-member-jump="member-speeches">${L('Puheet','Anföranden','Speeches')}</button>
    <button type="button" data-member-jump="member-about">${L('Taustatiedot','Bakgrundsuppgifter','Background')}</button>
    <a href="#/influence/${encodeURIComponent(member.id)}">${L('Sidonnaisuudet ja lahjat','Bindningar och gåvor','Interests and gifts')}</a>
    ${vocabulary ? `<button type="button" data-member-jump="member-vocabulary">${L('Sanasto','Ordförråd','Vocabulary')}</button>` : ''}</nav>`;
}
export function bindMemberSections(root) {
  root.querySelectorAll('[data-member-jump]').forEach(button => button.onclick = () => {
    const target = root.querySelector('#' + button.dataset.memberJump);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  });
}
export function mountMemberInsights(container, member, lang, { wordcloud = true } = {}) {
  const L = profileText(lang), date = value => e(formatDate(value,lang==='en'?'en-GB':lang==='sv'?'sv-FI':'fi-FI'));
  container.innerHTML = (wordcloud ? '<section class="member-wordcloud" id="member-vocabulary" tabindex="-1" data-wordcloud aria-busy="true"></section>' : '') + '<section class="member-profile" id="member-about" tabindex="-1" data-member-profile aria-busy="true"></section>';
  const cloudRoot=container.querySelector('[data-wordcloud]'),profileRoot=container.querySelector('[data-member-profile]');
  const loading = '<p>'+L('Ladataan…','Laddar…')+'</p>';
  if (cloudRoot) cloudRoot.innerHTML=loading;profileRoot.innerHTML=loading;
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
        +'<details><summary>'+L('Laskentatapa ja aineisto','Beräkningsmetod och material')+'</summary><p class="research-note">'+L('Yleiset suomen ja ruotsin sanat, eduskuntakielen perussanasto (esim. Suomi ja hallitus), puhuttelut ja hakasulkeiden toimitusmerkinnät poistetaan. Taivutusmuodot lasketaan erikseen, mutta pilveen valitaan vain yksi yksinkertaisista päätevarianteista (esim. Nato ja Naton). Edustajien sukunimet ja irralliset yhdyssanan alkuosat ohitetaan. Kun edustajalla on vähintään viisi puhetta, sanalta vaaditaan kolme esiintymää vähintään kahdessa puheessa. Vähintään 20 puheen aineistossa vaaditaan viisi esiintymää, kolme puhetta ja kolme eri puhepäivää.','Vanliga finska och svenska ord, parlamentariskt grundordförråd (t.ex. Finland och regering), hälsningsfraser och redaktionella anteckningar inom hakparenteser tas bort. Böjningsformer räknas separat, men bara en av enkla ändelsevarianter (t.ex. Nato och Natos) väljs till molnet. Ledamöternas efternamn och fristående förled i sammansättningar utelämnas. Vid minst fem anföranden krävs tre förekomster i minst två anföranden. Vid minst 20 anföranden krävs fem förekomster, tre anföranden och tre olika dagar.')+'</p><p class="research-note">'+L('Koko ja järjestys perustuvat pistemäärään √esiintymät × log₂(suhteellinen yleisyys) × log₂(1 + puhujia / sanaa käyttäviä puhujia). Jälkimmäinen kerroin korostaa harvemmille edustajille ominaisia sanoja. Yleisyys on sanan osuus edustajan suodatetuista sanoista verrattuna muiden edustajien sanoihin; laskennassa lisätään 0,5 esiintymää ja 1 sana. Vähimmäissuhde on 1,5. Jos vertailuaineisto puuttuu, käytetään √esiintymät. Koko ei ilmaise poliittista merkitystä.','Storlek och ordning baseras på poängen √förekomster × log₂(relativ frekvens) × log₂(1 + talare / talare som använder ordet). Den sista faktorn framhäver ord som utmärker färre ledamöter. Frekvensen är ordets andel av ledamotens filtrerade ord jämfört med övriga ledamöters ord; 0,5 förekomster och 1 ord läggs till. Minimikvoten är 1,5. Utan jämförelsematerial används √förekomster. Storleken anger inte politisk betydelse.')+'</p><p class="sub">'+L('Vähintään kolme kirjainta; poikkeukset EU, YK ja FN. Poistosanalista','Minst tre bokstäver; undantag EU, YK och FN. Stoppordlista')+': <a href="./speech-research.js" target="_blank" rel="noreferrer">'+e(snapshot.method.stopwords)+'</a>.</p>'+exportButtons('wordcloud',lang)+'<div class="table-wrap"><table><caption>'+L('Pilven sanat','Orden i molnet')+'</caption><thead><tr><th scope="col">'+L('Sana','Ord')+'</th><th scope="col">'+L('Esiintymät','Förekomster')+'</th><th scope="col">'+L('Puheita','Anföranden')+'</th></tr></thead><tbody>'+terms.map(term=>'<tr><td data-label="'+L('Sana','Ord')+'">'+e(term.word)+'</td><td data-label="'+L('Esiintymät','Förekomster')+'">'+term.count+'</td><td data-label="'+L('Puheita','Anföranden')+'">'+term.speeches+'</td></tr>').join('')+'</tbody></table></div></details>';
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
      const [snapshot,contacts]=await Promise.all([loadProfiles(),loadContacts().catch(()=>null)]);if(!profileRoot.isConnected)return;
      const p=snapshot.members?.[member.id];if(!p)throw new Error('Missing official member profile');
      const value = v => e(localized(v,lang)), missing=L('Ei ilmoitettu Eduskunnan tiedoissa','Inte angivet i riksdagens uppgifter');
      const shortDate = v => e(new Intl.DateTimeFormat(lang==='en'?'en-GB':lang==='sv'?'sv-FI':'fi-FI',{day:'numeric',month:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(v)));
      const period = row => row.to ? (row.from?shortDate(row.from)+' – ':'')+shortDate(row.to) : row.from ? (lang==='en'?'From '+shortDate(row.from):lang==='sv'?'Från '+shortDate(row.from):shortDate(row.from)+' alkaen') : missing;
      const row=(label,content)=>'<div><dt>'+label+'</dt><dd>'+(content||missing)+'</dd></div>';
      const list=(items,render,empty=missing)=>items.length?'<ul class="profile-list">'+items.map(item=>'<li>'+render(item)+'</li>').join('')+'</ul>':'<p class="sub">'+empty+'</p>';
      const day=snapshot.metadata.generatedAt.slice(0,10),current=row=>(!row.from||row.from<=day)&&(!row.to||row.to>=day);
      const status={Nykyinen:L('Nykyinen kansanedustaja','Nuvarande riksdagsledamot'),Entinen:L('Entinen kansanedustaja','Tidigare riksdagsledamot'),Keskeytynyt:L('Edustajantoimi keskeytynyt','Ledamotsuppdraget avbrutet')}[p.status] || e(p.status);
      const career=p.career[lang]?.length?p.career[lang]:p.career.fi;
      const bodies=p.bodies[lang]?.length?p.bodies[lang]:p.bodies.fi;
      const government=p.government[lang]?.length?p.government[lang]:p.government.fi;
      const recent = rows => [...rows].sort((a,b)=>(b.from||'').localeCompare(a.from||''));
      const assignments=[...new Map([...p.committees.map(item=>({...item,name:localized(item.name,lang),role:localized(item.role,lang)})),...bodies].map(item=>[[item.name,item.role,item.from,item.to].join('|'),item])).values()];
      const contact=p.status==='Nykyinen'?contacts?.members?.[member.id]:null;
      const emailLink = email => '<a href="mailto:'+e(email)+'">'+e(email)+'</a>';
      const phoneLink = phone => '<a href="tel:'+e(phone.replace(/[^+\d]/g,''))+'">'+e(phone)+'</a>';
      const assistantDetails=contact?'<section class="profile-assistants"><h3>'+L('Eduskunta-avustajat','Riksdagsassistenter')+'</h3>'+list(contact.assistants,item=>'<strong>'+e(item.name)+'</strong><div class="profile-contact-links">'+[item.email?emailLink(item.email):'',...[...new Set([item.phone,item.mobile].filter(Boolean))].map(phoneLink)].filter(Boolean).join('')+'</div>',L('Eduskunta ei ole julkaissut avustajan yhteystietoja.','Riksdagen har inte publicerat kontaktuppgifter för en assistent.'))+'<p class="sub">'+L('Avustajatiedot tarkistettu','Assistentuppgifter kontrollerade')+' '+date(contacts.metadata.generatedAt)+'. <a href="'+e(contact.pageUrl)+'" target="_blank" rel="noreferrer">'+L('Yhteystietojen lähde','Källa för kontaktuppgifter')+' ↗</a></p></section>':'';
      profileRoot.innerHTML='<div class="section-head"><div><span class="eyebrow">'+L('Eduskunnan julkaisemista tiedoista','Ur riksdagens publicerade uppgifter')+'</span><h2>'+L('Taustatiedot','Bakgrundsuppgifter','Background')+'</h2></div><a href="'+e(p.pageUrl)+'" target="_blank" rel="noreferrer">'+L('Edustajan virallinen sivu','Ledamotens officiella sida')+' ↗</a></div>'
        +'<p class="sub">'+L('Profiilitiedot tarkistettu','Profiluppgifter kontrollerade')+' '+date(snapshot.metadata.generatedAt)+'</p>'
        +'<dl class="profile-facts profile-basics">'+row(L('Edustajantoimi','Ledamotsuppdrag'),status)+row(L('Ammatti tai tutkinto','Yrke eller examen'),value(p.occupation)+(value(p.occupation)?'<span class="sub">'+L('Eduskunnan ilmoittama taustatieto','Bakgrundsuppgift angiven av riksdagen')+'</span>':''))+row(L('Vaalipiiri','Valkrets'),value(p.district))+'</dl>'
        +'<div class="profile-background"><p class="research-note">'+L('Koulutus ja työhistoria ovat Eduskunnan julkaisemia taustatietoja. Työhistoria ei ole luettelo nykyisistä tehtävistä. Puuttuva tieto ei tarkoita koulutuksen tai työkokemuksen puuttumista.','Utbildning och arbetshistoria är bakgrundsuppgifter publicerade av riksdagen. Arbetshistoriken är inte en lista över nuvarande uppdrag. Saknade uppgifter betyder inte att utbildning eller arbetserfarenhet saknas.','Education and employment history are background records published by Parliament. Employment history is separate from current roles. Missing records do not mean a person has no education or work experience.')+'</p>'
        +'<details open data-profile-education><summary>'+L('Koulutus','Utbildning')+'</summary>'+list(p.education,item=>'<strong>'+value(item.degree)+'</strong><span>'+[value(item.institution),item.year].filter(Boolean).join(' · ')+'</span>',L('Koulutustietoja ei ole julkaistu.','Utbildningsuppgifter har inte publicerats.'))+'</details>'
        +'<details open data-profile-career><summary>'+L('Työhistoria','Arbetshistoria')+'</summary>'+list(career,item=>'<strong>'+e(item.title)+'</strong><span>'+e(item.period.replace(/^(\d{4})-\1$/,'$1').replace(/(\d{4})-(\d{4})/g,'$1–$2'))+'</span>',L('Työhistoriaa ei ole julkaistu.','Arbetshistorik har inte publicerats.'))+'</details>'
        +'</div>'
        +'<section class="profile-contacts"><h3>'+L('Yhteystiedot','Kontaktuppgifter')+'</h3><dl class="profile-facts">'+row(L('Sähköposti','E-post'),p.email?emailLink(p.email):'')+row(L('Puhelin','Telefon'),p.phone?phoneLink(p.phone):L('Henkilökohtaista numeroa ei ole julkaistu.','Ett personligt nummer har inte publicerats.'))+'</dl>'+assistantDetails+'</section>'
        +'<section class="profile-current"><h3>'+L('Nykyiset tehtävät','Nuvarande uppdrag')+'</h3>'+list(recent(assignments.filter(current)),item=>'<strong>'+e(item.name)+'</strong><span>'+e(item.role)+' · '+period(item)+'</span>',L('Ei voimassa olevia valiokunta- tai toimielintehtäviä lähdetiedoissa.','Inga gällande utskotts- eller organuppdrag i källuppgifterna.'))+list(government.filter(current),item=>'<strong>'+e(item.name)+'</strong><span>'+period(item)+'</span>','')+'</section>'
        +'<div class="profile-details"><details><summary>'+L('Henkilötiedot','Personuppgifter')+'</summary><dl class="profile-facts">'+row(L('Kotikunta','Hemkommun'),e(p.municipality))+row(L('Syntymävuosi ja -paikka','Födelseår och födelseort'),[p.birthYear,e(p.birthPlace)].filter(Boolean).join(' · '))+'</dl></details>'
        +'<details><summary>'+L('Edustajakaudet ja keskeytykset','Ledamotsperioder och avbrott')+'</summary><h3>'+L('Edustajakaudet','Ledamotsperioder')+'</h3>'+list(recent(p.terms),item=>period(item))+'<h3>'+L('Keskeytykset','Avbrott')+'</h3>'+list(recent(p.interruptions),item=>'<strong>'+value(item.reason)+'</strong><span>'+period(item)+'</span>',L('Ei kirjattuja keskeytyksiä.','Inga registrerade avbrott.'))+'</details>'
        +'<details><summary>'+L('Valiokunnat ja muut eduskunnan tehtävät','Utskott och övriga riksdagsuppdrag')+'</summary>'+list(recent(assignments),item=>'<strong>'+e(item.name)+'</strong><span>'+[e(item.role),period(item)].filter(Boolean).join(' · ')+'</span>')+'</details>'
        +'<details><summary>'+L('Ministeritehtävät','Ministeruppdrag')+'</summary>'+list(recent(government),item=>'<strong>'+e(item.name)+'</strong><span>'+period(item)+'</span>',L('Ei kirjattuja ministeritehtäviä.','Inga registrerade ministeruppdrag.'))+'</details>'
        +'<details><summary>'+L('Tietojen lähde','Uppgifternas källa')+'</summary><p class="research-note">'+L('Ammatti, tutkinto ja työhistoria perustuvat Eduskunnan julkaisemiin taustatietoihin. Ne eivät välttämättä kuvaa nykyistä työtä. Puuttuva tieto ei tarkoita, ettei koulutusta tai työkokemusta olisi.','Yrke, examen och arbetshistoria bygger på riksdagens publicerade bakgrundsuppgifter. De beskriver inte nödvändigtvis det nuvarande arbetet. Saknade uppgifter betyder inte att utbildning eller arbetserfarenhet saknas.')+' <a href="'+e(p.sourceUrl)+'" target="_blank" rel="noreferrer">'+L('Alkuperäinen tietue','Ursprunglig datapost')+' ↗</a></p></details></div>';
      profileRoot.setAttribute('aria-busy','false');
    }catch{failure(profileRoot,profiles);}
  }
  if (wordcloud) clouds();profiles();
}
