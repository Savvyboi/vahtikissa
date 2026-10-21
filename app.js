import { loadAIInsights, decorateAI, aiTagBadges, filterAIItems } from './ai-insights-app.js';
import { snapshotNote } from './data-freshness.js';
import { readingMode, readingModeURL } from './reading-mode.js';
import { createParliamentLoader } from './parliament-data.js';
import { setupBackToTop } from './back-to-top.js';
import { filterItems, percent, routeFromHash, pageSlice, choiceLabel, formatDate, escapeHTML, localizedSearchFields, memberMatchesQuery, parliamentMatterUrl, isLongSpeech, filterBallots, voteOutcome, filterVotes, filterAndSortMembers, paginationItems, searchSpeeches, voteAlternatives, brandName, decodeSpeechSearchIndex, filterAndSortLegislation, legislationMatterType, legislationStatusTone, legislationPhase, speechParagraphs, filterSpeechesBySpeaker, fetchJSONWithTimeout, policyTopicKeys, policyTopicLabel, policyTopicOptions, committeeOptions } from './app-utils.js';
import { mountMemberInsights } from './member-insights.js';
import { mountResearchControls } from './speech-research-app.js';
import { filterResearchSpeeches, matchRanges } from './speech-research.js';
import { bindExportButtons, exportButtons, safeFilename } from './data-tools.js';
import { collectionState, applyCollection, facetOptions, mountCollectionTools, preserveFocus, collapseQuickFilters } from './collection-tools.js';
import { currentScrollPosition, preservePageScroll, pushRoute, savedScrollPosition, trackScrollHistory } from './navigation.js';

const $ = selector => document.querySelector(selector);
const root = $('#content');
const e = escapeHTML;
let data;
const parliamentLoader = createParliamentLoader();
let routeRenderSequence = 0;
function loadViewModule(route, view) {
  if (view === 'simple') return import('./simple-mode.js');
  if (route.page === 'programmes') return import('./programmes-app.js');
  if (['budget', 'elections', 'influence'].includes(route.page)) return import('./civic-apps.js');
  return Promise.resolve(null);
}
// Preferences are optional: blocked storage must not prevent reading public data.
const preferences = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} }
};
let readingView = readingMode(location.search, preferences.get('vahtikissa-view'));
const speechTexts = {};
const speechTextPromises = new Map();
const speechTextErrors = new Map();
const loadedSpeechChunks = new Set();
let lang = ['fi','sv','en'].includes(preferences.get('vahtikissa-lang')) ? preferences.get('vahtikissa-lang') : 'fi';
let theme = ['light','dark','contrast'].includes(preferences.get('vahtikissa-theme')) ? preferences.get('vahtikissa-theme') : 'light';
const state = {
  votes: 1, speeches: 1, legislation: 1, memberVotes: 1, memberSpeeches: 1,
  voteFilters: { query: '', outcome: 'all', type: 'all', stage: 'all', topic: 'all', committee: 'all' },
  memberFilters: { query: '', party: 'all', sort: 'name' }
};
let speechSearchTexts;
let speechSearchPromise = null;
let speechAnalyticsPromise = null;
const PAGE = { votes: 50, speeches: 20, legislation: 50, memberVotes: 10, memberSpeeches: 5 };
const partyNames = {
  kok:{fi:'Kansallinen Kokoomus',sv:'Samlingspartiet'}, ps:{fi:'Perussuomalaiset',sv:'Sannfinländarna'}, sd:{fi:'Suomen Sosialidemokraattinen Puolue',sv:'Finlands Socialdemokratiska Parti'}, kesk:{fi:'Suomen Keskusta',sv:'Centern i Finland'}, vihr:{fi:'Vihreä liitto',sv:'Gröna förbundet'}, vas:{fi:'Vasemmistoliitto',sv:'Vänsterförbundet'}, r:{fi:'Ruotsalainen kansanpuolue',sv:'Svenska folkpartiet'}, kd:{fi:'Suomen Kristillisdemokraatit',sv:'Kristdemokraterna i Finland'}, liik:{fi:'Liike Nyt',sv:'Rörelse Nu'}, sit:{fi:'Sitoutumaton',sv:'Obunden'}
};
const copy = {
  fi:{overview:'Yleiskuva',sessions:'Istunnot',votes:'Äänestykset',members:'Kansanedustajat',parties:'Puolueet',programmes:'Puolueohjelmat',speeches:'Puheet',legislation:'Lakiasiat',budget:'Budjetti',elections:'Vaalit 2023',influence:'Sidonnaisuudet',search:'Hae',menu:'Valikko',loading:'Ladataan eduskunnan avointa dataa…',updated:'Päivitetty',day:'Päivä',matter:'Asia',result:'Tulos',yes:'jaa',no:'ei',abstain:'tyhjää',absent:'poissa',showMore:'Näytä lisää',showAll:'Näytä kaikki',readMore:'Lue koko puhe',readLess:'Näytä lyhyemmin',latestVotes:'Uusimmat äänestykset',parliament:'Eduskunta',hero:'Miten sinun edustajasi toimii?',heroLead:'Seuraa äänestyksiä, puheenvuoroja, ryhmälinjoja ja lakiasioiden etenemistä 2.4.2023 alkaen.',voteRecords:'yksittäistä kansanedustajan äänimerkintää seurannassa',participation:'Osallistuminen',partyLine:'Ryhmälinja',recordedVotes:'kirjattua ääntä',speechTurns:'puheenvuoroa',vote:'Äänestys',background:'Taustatiedot',stage:'Käsittelyvaihe',officialMatter:'Valtiopäiväasia',minutes:'Pöytäkirja',officialVote:'Virallinen äänestystieto',openOfficial:'Avaa Eduskunnan lähteessä ↗',votesByParty:'Äänet puolueittain',recentVotes:'Äänestykset',mpSpeeches:'Puheenvuorot',mpActivity:'Edustajan toiminta seuranta-ajanjaksolla.',howVoted:'Äänesti',allVotes:'Kaikki nimetyt täysistuntoäänestykset huhtikuusta 2023 alkaen.',allSpeeches:'Kansanedustajien puheenvuorot ja niihin liittyvät päiväjärjestysasiat.',allLaws:'Valtiopäiväasiat yhdistettynä äänestyksiin ja muutosehdotuksiin.',searchVotes:'Hae aiheella tai asiakirjatunnuksella…',searchSpeeches:'Hae sanaa, ilmausta, puhujaa tai aihetta…',searchMembers:'Hae nimellä tai puolueella…',searchLaws:'Hae asiakirjatunnuksella tai aiheella…',all:'Kaikki',moreYes:'Enemmän JAA-ääniä',moreNo:'Enemmän EI-ääniä',tie:'Tasatulos',whatWasVoted:'Mistä äänestettiin?',voterFilter:'Näytä edustajat äänivalinnan mukaan',voteMeaning:'JAA ja EI viittaavat yllä kuvattuihin vaihtoehtoihin.',noData:'Ei tietoja.',independent:'Riippumaton avoimen datan palvelu. Ei ole Eduskunnan virallinen palvelu.',about:'Tietoa palvelusta',data:'Data'},
  sv:{overview:'Översikt',sessions:'Plenum',votes:'Omröstningar',members:'Riksdagsledamöter',parties:'Partier',programmes:'Partiprogram',speeches:'Anföranden',legislation:'Riksdagsärenden',budget:'Budget',elections:'Valet 2023',influence:'Bindningar',search:'Sök',menu:'Meny',loading:'Riksdagens öppna data laddas…',updated:'Uppdaterad',day:'Datum',matter:'Ärende',result:'Resultat',yes:'ja',no:'nej',abstain:'blankt',absent:'frånvarande',showMore:'Visa fler',showAll:'Visa alla',readMore:'Läs hela anförandet',readLess:'Visa kortare',latestVotes:'Senaste omröstningarna',parliament:'Riksdagen',hero:'Hur agerar din riksdagsledamot?',heroLead:'Följ omröstningar, anföranden, grupplinjer och riksdagsärenden sedan 2.4.2023.',voteRecords:'registrerade individuella riksdagsröster',participation:'Deltagande',partyLine:'Grupplinje',recordedVotes:'registrerade röster',speechTurns:'anföranden',vote:'Omröstning',background:'Bakgrundsuppgifter',stage:'Behandlingsskede',officialMatter:'Riksdagsärende',minutes:'Protokoll',officialVote:'Officiella omröstningsuppgifter',openOfficial:'Öppna i riksdagens källa ↗',votesByParty:'Röster per parti',recentVotes:'Omröstningar',mpSpeeches:'Anföranden',mpActivity:'Ledamotens verksamhet under uppföljningsperioden.',howVoted:'Röstade',allVotes:'Alla namnupprop i plenum sedan april 2023.',allSpeeches:'Riksdagsledamöternas anföranden och relaterade dagordningsärenden.',allLaws:'Riksdagsärenden kopplade till omröstningar och ändringsförslag.',searchVotes:'Sök på ämne eller dokumentbeteckning…',searchSpeeches:'Sök ord, fras, talare eller ämne…',searchMembers:'Sök på namn eller parti…',searchLaws:'Sök på dokumentbeteckning eller ämne…',all:'Alla',moreYes:'Fler JA-röster',moreNo:'Fler NEJ-röster',tie:'Lika röstetal',whatWasVoted:'Vad röstade riksdagen om?',voterFilter:'Visa ledamöter enligt röst',voteMeaning:'JA och NEJ hänvisar till alternativen ovan.',noData:'Inga uppgifter.',independent:'En oberoende tjänst baserad på öppna data. Inte en officiell riksdagstjänst.',about:'Om tjänsten',data:'Data'}
};
copy.en = {overview:'Overview',sessions:'Plenary sessions',votes:'Votes',members:'Members of Parliament',parties:'Parties',programmes:'Party platforms',speeches:'Speeches',legislation:'Legislation',budget:'Budget',elections:'2023 elections',influence:'Interests & lobbying',search:'Search',menu:'Menu',loading:'Loading open parliamentary data…',updated:'Updated',day:'Date',matter:'Matter',result:'Result',yes:'yes',no:'no',abstain:'abstained',absent:'absent',showMore:'Show more',showAll:'Show all',readMore:'Read full speech',readLess:'Show less',latestVotes:'Latest votes',parliament:'Parliament',hero:'How does your MP act?',heroLead:'Explore votes, speeches, party positions and legislation since 2 April 2023.',voteRecords:'individual parliamentary votes recorded',participation:'Participation',partyLine:'Party alignment',recordedVotes:'recorded votes',speechTurns:'speeches',vote:'Vote',background:'Background',stage:'Stage',officialMatter:'Parliamentary matter',minutes:'Minutes',officialVote:'Official voting record',openOfficial:'Open parliamentary source ↗',votesByParty:'Votes by party',recentVotes:'Votes',mpSpeeches:'Speeches',mpActivity:'MP activity during the reporting period.',howVoted:'Voted',allVotes:'All recorded plenary votes since April 2023.',allSpeeches:'Speeches by MPs and their related agenda items.',allLaws:'Parliamentary matters linked to votes and amendments.',searchVotes:'Search by topic or document number…',searchSpeeches:'Search a word, phrase, speaker or topic…',searchMembers:'Search by name or party…',searchLaws:'Search by document number or topic…',all:'All',moreYes:'More YES votes',moreNo:'More NO votes',tie:'Tie',whatWasVoted:'What was the vote about?',voterFilter:'Filter MPs by vote',voteMeaning:'YES and NO refer to the alternatives described above.',noData:'No results.',independent:'An independent open data service. This is not an official service of the Finnish Parliament.',about:'About this service',data:'Data'};
const ui = (fi,sv,en=fi) => lang==='en'?en:lang==='sv'?sv:fi;
const locale = () => lang==='en'?'en-GB':lang==='sv'?'sv-FI':'fi-FI';
const t = key => copy[lang][key] || copy.fi[key] || key;
const titleFor = party => partyNames[party]?.[lang] || partyNames[party]?.fi || String(party || '').toUpperCase();
const href = (page,id) => `#/${page}${id ? `/${encodeURIComponent(id)}` : ''}`;
const choice = key => choiceLabel(key,lang);
const fmtDate = value => formatDate(value,locale());
const topicOptionsHTML = selected => `<option value="all">${lang==='sv'?'Alla ämnen':'Kaikki aihealueet'}</option>${policyTopicOptions(lang).map(topic=>`<option value="${e(topic.key)}" ${selected===topic.key?'selected':''}>${e(topic.label)}</option>`).join('')}`;
const topicTags = item => `<div class="topic-tags">${policyTopicKeys(item).map(key=>`<span class="topic-tag topic-${e(key)}">${e(policyTopicLabel(key,lang))}</span>`).join('')}</div>`;
const committeeTags = item => (item.committees||[]).length?`<div class="committee-tags">${item.committees.slice(0,3).map(committee=>`<span class="committee-tag" title="${e(lang==='sv'?committee.nameSv||committee.name:committee.name||committee.nameSv)}">${e(String(committee.id||'').replace(/01$/,''))}</span>`).join('')}</div>`:'';
const voteExportRows = items => items.map(vote=>({id:vote.id,date:vote.date,document:voteText(vote,'document'),title:voteText(vote,'title'),question:voteText(vote,'question'),stage:voteText(vote,'stage'),topics:policyTopicKeys(vote).map(key=>policyTopicLabel(key,lang)),committees:(vote.committees||[]).map(committee=>lang==='sv'?committee.nameSv||committee.name:committee.name||committee.nameSv),yes:vote.yes,no:vote.no,abstain:vote.abstain,absent:vote.absent,total:vote.total,officialUrl:vote.resultUrl}));
const ballotExportRows = ballots => ballots.map(ballot=>({voteId:ballot.voteId,mpId:ballot.mpId,name:memberName(ballot),party:ballot.party,choice:choice(ballot.choice)}));
const speechExportRows = items => items.map(speech=>({id:speech.id,date:speech.date,mpId:speech.mpId,name:memberName(speech),party:speech.party,topic:policyTopicKeys(speech).map(key=>policyTopicLabel(key,lang)),agenda:(lang==='sv'&&speech.agendaSv)||speech.agenda,type:speech.type,documents:(lang==='sv'&&speech.documentsSv?.length?speech.documentsSv:speech.documents)?.map(document=>document.label)}));
const speechElementId = id => `speech-${String(id || '').replace(/[^\p{L}\p{N}_-]+/gu,'-')}`;
const participationInfo = () => ui('Poissaolo voi johtua esimerkiksi äänestysparista, sairauslomasta tai ministeritehtävästä. Luku ei yksin kerro poissaolon syytä.','Frånvaro kan bero på bland annat kvittning, sjukfrånvaro eller ministeruppdrag. Siffran ensam berättar inte orsaken.','Absence may reflect an agreed voting pair, sick leave or ministerial duties. The percentage alone does not explain the reason.');
const participationMetric = value => `<details class="metric-help"><summary class="metric-with-help"><span>${e(value)}%</span> <span aria-hidden="true">ⓘ</span><span class="sr-only">${ui('Tietoa osallistumisesta','Om deltagande','About participation')}</span></summary><p class="metric-help-text">${e(participationInfo())}</p></details>`;

const collectionStates = new Map();
const toolState = (key, sort, direction = 'asc') => {
  if (!collectionStates.has(key)) collectionStates.set(key, collectionState(sort, direction));
  return collectionStates.get(key);
};
const label = (fi, sv) => lang === 'sv' ? sv : fi;
const facet = (key, name, items, value, display = value => value) => ({ key, label: name, value, options: facetOptions(items, value, display, lang) });
function voteTools(items) {
  const committees = new Map(committeeOptions(items, lang));
  return { label: t('votes'), date: vote => vote.date, search: vote => [vote.title, vote.titleSv, vote.question, vote.questionSv, vote.document, vote.documentSv],
    sorts: [{ key: 'date', label: t('day'), value: vote => vote.startsAt || vote.date }, { key: 'title', label: t('matter'), value: vote => voteText(vote, 'title') }, ...['yes','no','abstain','absent'].map(key => ({ key, label: t(key), value: vote => vote[key] }))],
    number: { label: t('absent'), value: vote => vote.absent },
    facets: [facet('year', label('Vuosi','År'), items, vote => String(vote.date).slice(0,4)), facet('topic', label('Aihealue','Ämne'), items, policyTopicKeys, key => policyTopicLabel(key,lang)), facet('committee',label('Valiokunta','Utskott'),items,vote=>(vote.committees||[]).map(committee=>String(committee.id||committee.code||committee.name)),key=>committees.get(key)||key), facet('outcome', t('result'), items, voteOutcome, t), facet('type',label('Tyyppi','Typ'),items,vote=>vote.isAmendment?'amendment':'other',key=>key==='amendment'?label('Muutosehdotus','Ändringsförslag'):label('Muu äänestys','Övrig omröstning'))] };
}
function memberTools(items) {
  return { label: t('members'), search: member => [memberName(member), titleFor(member.party)],
    sorts: [{key:'name',label:label('Sukunimi','Efternamn'),value:member=>`${member.lastName} ${member.firstName}`}, ...[['participation',t('participation')],['loyalty',t('partyLine')],['votes',t('votes')],['speeches',t('speeches')]].map(([key,label])=>({key,label,value:member=>member.stats?.[key]}))],
    number:{label:`${t('participation')} %`,value:member=>member.stats?.participation}, facets:[facet('party',label('Puolue','Parti'),items,member=>member.party,titleFor)] };
}
function speechTools(items) {
  return { label: t('speeches'), date: speech => speech.date,
    sorts:[{key:'date',label:t('day'),value:speech=>speech.date},{key:'name',label:t('members'),value:speech=>`${speech.lastName} ${speech.firstName}`},{key:'agenda',label:t('matter'),value:speech=>(lang==='sv'&&speech.agendaSv)||speech.agenda}],
    facets:[facet('party',label('Puolue','Parti'),items,speech=>speech.party,titleFor),facet('speaker',t('members'),items,speech=>String(speech.mpId),id=>memberName(items.find(speech=>String(speech.mpId)===id)||{})),facet('topic',label('Aihealue','Ämne'),items,policyTopicKeys,key=>policyTopicLabel(key,lang)),facet('type',label('Puhetyyppi','Anförandetyp'),items,speech=>speech.type),facet('year',label('Vuosi','År'),items,speech=>String(speech.date).slice(0,4))] };
}
function addTools(before, key, state, config, change) {
  const holder = document.createElement('div');
  before.before(holder);
  collapseQuickFilters(root,lang);
  const quick = [...holder.parentElement.children].filter(node => node.matches('[data-filter-panel]') && (node.compareDocumentPosition(holder) & Node.DOCUMENT_POSITION_FOLLOWING)).at(-1);
  if (quick) quick.append(holder);
  const hasSearch=root.querySelector('.filters input:not([type="checkbox"])');
  return mountCollectionTools(holder,key,state,hasSearch?{...config,search:undefined}:config,lang,change);
}

function updateFooterTimestamp(){if(!data?.metadata?.generatedAt)return;$('.footer-updated').textContent=ui('Eduskunnan data synkronoitu viimeksi','Riksdagens data senast synkroniserad','Parliamentary snapshot last updated')+' '+fmtDate(data.metadata.generatedAt)}
const englishGuides = {
  overview:'Follow the Finnish Parliament through votes, speeches and legislation. Choose a section in the navigation or search for an MP.',
  sessions:'Open a plenary session to see its votes and speeches. Sessions without recorded votes are included.',
  votes:'Search a topic or document number, then open a vote to see the alternatives and each MP’s recorded vote.',
  members:'Search for an MP by name or party. Open their profile to explore voting, participation and speeches.',
  parties:'Open a party to explore its members and parliamentary activity.',
  programmes:'Compare party platforms by topic. Source documents and detailed comparison controls are in Finnish or Swedish.',
  speeches:'Search speeches by speaker, topic or words in the text. The original language of each speech is preserved.',
  legislation:'Search a document number or topic, then open a matter to see its stage, related votes and official source.',
  elections:'Explore the 2023 parliamentary election results by party and candidate. Detailed filters use Finnish terminology.',
  influence:'Explore declared interests (Sidonnaisuudet), gifts (Lahjat) and lobbying (Lobbaus). These records are separate datasets.',
  about:'Read about the data sources and methods. The detailed methodology is currently available in Finnish or Swedish.'
};
function updateRouteContext(route,{announce=true}={}){
  const fallback=t(route.page)||t('overview'),heading=root.querySelector('h1')?.textContent?.trim(),label=heading||fallback;
  document.title=label+' | '+brandName(lang);root.setAttribute('aria-busy','false');
  if(readingView!=='simple'&&lang==='en'&&!root.querySelector('.load-error')&&englishGuides[route.page]&&!root.querySelector('.language-note')){
    const note=document.createElement('aside');note.className='language-note';note.setAttribute('aria-label','English guide');
    const guide=document.createElement('p');guide.textContent=englishGuides[route.page];note.append(guide);
    const detail=document.createElement('p');detail.textContent='English covers navigation and key guidance. Some detailed controls and source records remain in Finnish or Swedish.';note.append(detail);
    // Prepending guidance can move a focused main even when scroll anchoring is disabled.
    // Preserve the latest reader position before asynchronous route rendering finishes.
    const position=currentScrollPosition();
    (root.querySelector('.page')||root).prepend(note);
    window.scrollTo({left:position.x,top:position.y,behavior:'instant'});
  }
  if(['overview','votes','sessions','speeches'].includes(route.page) && !root.querySelector('.load-error,.data-freshness')) {
    const page=root.querySelector('.page,.easy-page'),position=currentScrollPosition();
    page?.querySelector('.hero,.page-head,.easy-hero')?.insertAdjacentHTML('afterend',snapshotNote(data.metadata,lang));
    window.scrollTo({left:position.x,top:position.y,behavior:'instant'});
  }
  if(announce){const status=$('#route-status');status.textContent='';requestAnimationFrame(()=>{status.textContent=ui(label+' avattu',label+' har öppnats',label+' opened')})}
}
function applyChrome(){
  const brand=brandName(lang),menuOpen=$('.menu-button').getAttribute('aria-expanded')==='true';document.documentElement.lang=lang;document.title=brand;
  document.querySelector('meta[name="description"]').content=ui('Vahtikissa näyttää Eduskunnan äänestykset, budjetin, vaalitulokset, lahjat ja lobbauksen.','Vaktkatt visar riksdagens omröstningar, budget, valresultat, gåvor och lobbning.','Explore Finland’s Parliament: votes, speeches, state budget, elections, gifts and lobbying.');
  $('.skip').textContent=ui('Siirry sisältöön','Hoppa till innehållet','Skip to content');$('.nav').setAttribute('aria-label',ui('Päänavigaatio','Huvudnavigation','Main navigation'));
  document.querySelectorAll('.brand').forEach(x=>x.setAttribute('aria-label',ui('Vahtikissan etusivu','Vaktkatts startsida','Vahtikissa home')));document.querySelectorAll('.brand > span:last-child').forEach(x=>x.textContent=brand);
  document.querySelectorAll('.nav a').forEach(a=>a.textContent=t(a.dataset.page));
  $('.menu-button').textContent=menuOpen?'×':t('menu');$('.menu-button').setAttribute('aria-label',menuOpen?ui('Sulje valikko','Stäng meny','Close menu'):ui('Avaa valikko','Öppna meny','Open menu'));
  $('[data-search-label]').textContent=t('search');$('.search-button').setAttribute('aria-label',ui('Avaa haku','Öppna sökning','Open search'));
  $('.search-button kbd').textContent=/Mac|iPhone|iPad/.test(navigator.platform)?'⌘ K':'Ctrl K';
  $('.site-footer-note').textContent=t('independent');$('.footer-data').textContent=t('data');
  $('.footer-cat').setAttribute('aria-label',ui('Avaa tarkempi ASCII-kuva uuteen välilehteen','Öppna ASCII-bilden i full storlek i en ny flik','Open the full-size ASCII cat image in a new tab'));
  $('.footer-cat').title=ui('Avaa tarkempi ASCII-kuva','Öppna en större ASCII-bild','Open the full-size ASCII cat image');
  $('.footer-cat .cat-character').alt=ui('Valokuvasta muunnettu ASCII-kissa korissa lelujen kanssa','ASCII-version av fotografiet med katten och leksakerna i korgen','ASCII version of a photograph of a cat in a basket with toys');
  $('.footer-open-data').textContent=ui('Suomen eduskunta · avoin data ↗','Finlands riksdag · öppna data ↗','Finnish Parliament · open data ↗');
  $('.footer-budget-data').textContent=ui('Valtiokonttori · budjetti ↗','Statskontoret · budget ↗','State Treasury · budget ↗');$('.footer-election-data').textContent=ui('Tilastokeskus · vaalit ↗','Statistikcentralen · val ↗','Statistics Finland · elections ↗');$('.footer-transparency-data').textContent=ui('Avoimuusrekisteri ↗','Öppenhetsregistret ↗','Transparency Register ↗');
  const language=$('.language-select');language.value=lang;language.setAttribute('aria-label',ui('Kieli','Språk','Language'));language.previousElementSibling.textContent=language.getAttribute('aria-label');
  $('.search-head label').textContent=t('search');$('#global-search').placeholder=ui('Kirjoita hakusana…','Skriv ett sökord…','Enter a search term…');$('.search-panel').setAttribute('aria-label',ui('Sivustohaku','Webbplatssökning','Site search'));$('.search-close').setAttribute('aria-label',ui('Sulje haku','Stäng sökning','Close search'));
}
function applyViewChrome(){
  readingView=readingMode(location.search,readingView);
  document.documentElement.dataset.view=readingView;root.dataset.view=readingView;
  const simple=readingView==='simple',toggle=$('.view-toggle'),name=ui('Helppo näkymä','Enkel vy','Simple view');
  toggle.setAttribute('aria-checked',String(simple));toggle.setAttribute('aria-label',name);$('[data-view-label]').textContent=name;
  toggle.title=simple?ui('Vaihda tarkkaan näkymään','Byt till detaljerad vy','Switch to the detailed view'):ui('Näytä asiat selkeästi ja lyhyesti','Visa saker enkelt och kort','Show shorter, simpler explanations');
  const names={overview:ui('Aloita tästä','Börja här','Start here'),members:ui('Edustajat','Ledamöter','MPs'),legislation:ui('Lait ja ehdotukset','Lagar och förslag','Laws and proposals'),influence:ui('Lahjat ja lobbaus','Gåvor och lobbning','Gifts and lobbying')};
  document.querySelectorAll('.nav a').forEach(a=>a.textContent=simple&&names[a.dataset.page]||t(a.dataset.page));
}
function setReadingView(mode){
  readingView=mode;preferences.set('vahtikissa-view',mode);
  history.replaceState(history.state,'',readingModeURL(location.href,mode));
  applyViewChrome();
  if(data)render();else if(lastLoadError)loadError(lastLoadError);else loadingView();
}
function applyLocalizedExtras(){
  const select=$('.theme-select'),labels=ui(['Vaalea','Tumma','Korkea kontrasti'],['Ljus','Mörk','Hög kontrast'],['Light','Dark','High contrast']);
  select.setAttribute('aria-label',ui('Väriteema','Färgtema','Colour theme'));select.previousElementSibling.textContent=select.getAttribute('aria-label');[...select.options].forEach((option,index)=>option.textContent=labels[index]);select.title=select.getAttribute('aria-label');
  $('.footer-data').textContent=ui('Data ja avoimuus','Data och öppenhet','Data and transparency');$('.footer-repository').textContent=ui('Lähdekoodi GitHubissa ↗','Källkod på GitHub ↗','Source code on GitHub ↗');$('.footer-about').textContent=ui('Tietoa palvelusta ja menetelmistä','Om tjänsten och metoderna','About this service and methods');
  document.querySelector('meta[property="og:title"]').content=ui('Vahtikissa – seuraa eduskunnan työtä','Vaktkatt – följ riksdagens arbete','Vahtikissa – follow Finland’s Parliament');document.querySelector('meta[property="og:description"]').content=document.querySelector('meta[name="description"]').content;updateFooterTimestamp();
}
function applyTheme(){document.documentElement.dataset.theme=theme;$('.theme-select').value=theme;$('.theme-select').title=ui('Väriteema','Färgtema','Colour theme');$('.theme-icon').textContent=theme==='dark'?'☾':theme==='contrast'?'◐':'☀';document.querySelector('meta[name="theme-color"]').content=theme==='dark'?'#101828':theme==='contrast'?'#000000':'#f5f2ea'}
function resultBar(v){const total=v.total||v.yes+v.no+v.abstain+v.absent||1;return `<div class="result" role="img" aria-label="${t('yes')} ${v.yes}, ${t('no')} ${v.no}, ${t('abstain')} ${v.abstain}, ${t('absent')} ${v.absent}"><span style="width:${percent(v.yes,total)}%"></span><span style="width:${percent(v.no,total)}%"></span><span style="width:${percent(v.abstain,total)}%"></span><span style="width:${percent(v.absent,total)}%"></span></div><div class="vote-numbers"><span><b>${v.yes}</b> ${t('yes')}</span><span><b>${v.no}</b> ${t('no')}</span><span>${v.abstain} ${t('abstain')}</span><span>${v.absent} ${t('absent')}</span></div>`}
function header(kicker,title,lead=''){return `<div class="page-head"><div><div class="eyebrow">${e(kicker)}</div><h1>${e(title)}</h1>${lead?`<p class="lead">${e(lead)}</p>`:''}</div><div class="updated">${t('updated')} ${fmtDate(data.metadata.generatedAt)}</div></div>`}
function voteText(v,key){return lang==='sv'&&(v[`${key}Sv`])||v[key]||''}
function voteRows(items,mpId=null){return items.map(v=>{const ballot=mpId?data.ballots.find(b=>b.voteId===v.id&&b.mpId===mpId):null;return `<tr><td class="date"><time datetime="${e(v.date)}">${fmtDate(v.date)}</time></td><td><a class="row-link" href="${href('votes',v.id)}">${e(voteText(v,'title')||voteText(v,'question')||t('vote'))}</a><span class="sub">${e(voteText(v,'document')||`${t('vote')} ${v.number}`)}${v.isAmendment?' · '+(lang==='sv'?'Ändringsförslag':'Muutosehdotus'):''}</span>${topicTags(v)}${aiTagBadges('votes',v,lang)}${committeeTags(v)}${v.resultUrl?`<a class="source-inline" href="${e(v.resultUrl)}" target="_blank" rel="noreferrer">${t('officialVote')} ↗</a>`:''}${ballot?`<span class="mp-choice"><strong>${t('howVoted')}:</strong> ${e(choice(ballot.choice))}</span>`:''}</td><td>${resultBar(v)}</td></tr>`}).join('')}
function memberName(m){return `${m.firstName||''} ${m.lastName||''}`.trim()||`${lang==='sv'?'Ledamot':'Edustaja'} ${m.id||m.mpId}`}
function table(head,body){const labeled=body.replace(/<tr>([\s\S]*?)<\/tr>/g,(_,cells)=>{let index=0;return `<tr>${cells.replace(/<td([^>]*)>/g,(match,attrs)=>`<td${attrs} data-label="${e(head[index++]||'')}">`)}</tr>`});return `<div class="table-wrap"><table aria-label="${e(head.join(' · '))}"><thead><tr>${head.map(h=>`<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${labeled}</tbody></table></div>`}
function pagination(key,total){const pages=Math.max(1,Math.ceil(total/PAGE[key])),current=Math.min(state[key],pages);if(pages<=1)return '';return `<nav class="pagination" data-pagination="${key}" aria-label="${e(t(key==='memberVotes'?'votes':key==='memberSpeeches'?'speeches':key))}: ${lang==='sv'?'Sidindelning':'Sivutus'}"><button type="button" data-page="${current-1}" ${current===1?'disabled':''} aria-label="${lang==='sv'?'Föregående sida':'Edellinen sivu'}">←</button>${paginationItems(current,pages).map(item=>item==='ellipsis'?'<span aria-hidden="true">…</span>':`<button type="button" data-page="${item}" ${item===current?'aria-current="page"':''}>${item}</button>`).join('')}<button type="button" data-page="${current+1}" ${current===pages?'disabled':''} aria-label="${lang==='sv'?'Nästa sida':'Seuraava sivu'}">→</button></nav>`}
function bindPagination(key,redraw){root.querySelectorAll(`[data-pagination="${key}"] button[data-page]`).forEach(button=>button.onclick=()=>{preserveFocus(root,()=>{state[key]=Number(button.dataset.page);redraw()})})}
function stats(){const c=data.metadata.counts;return `<div class="stat-strip"><div class="stat"><strong>${c.votes.toLocaleString(lang)}</strong><span>${t('votes').toLowerCase()}</span></div><div class="stat"><strong>${c.members}</strong><span>${t('members').toLowerCase()}</span></div><div class="stat"><strong>${c.speeches.toLocaleString(lang)}</strong><span>${t('speechTurns')}</span></div><div class="stat"><strong>${c.legislation.toLocaleString(lang)}</strong><span>${t('legislation').toLowerCase()}</span></div><div class="stat"><strong>${c.amendments.toLocaleString(lang)}</strong><span>${lang==='sv'?'ändringsförslag':'muutosehdotusta'}</span></div></div>`}
function memberPortrait(m,large=false){return `<img class="member-portrait${large?' member-portrait-large':''}" src="assets/members/${encodeURIComponent(m.id)}.webp" alt="${e(memberName(m))}" width="${large?160:48}" height="${large?235:64}" loading="lazy" decoding="async">`}
function memberRows(items){return items.map(m=>`<tr><td><div class="member-identity">${memberPortrait(m)}<div><a class="row-link" href="${href('members',m.id)}">${e(memberName(m))}</a><span class="sub"><span class="party-dot"></span>${e(titleFor(m.party))}</span></div></div></td><td>${participationMetric(m.stats?.participation??0)}<span class="sub">${m.stats?.votes??0} ${t('recordedVotes')}</span></td><td>${m.stats?.loyalty??0}%</td><td>${m.stats?.speeches??0}</td></tr>`).join('')}
function overview(){const latest=data.votes.slice(0,8);return `<div class="page"><section class="hero"><div><div class="eyebrow">${t('parliament')}</div><h1>${t('hero')}</h1><p class="lead">${t('heroLead')}</p></div><div class="hero-side"><strong>${data.metadata.counts.ballots.toLocaleString(lang)}</strong><span>${t('voteRecords')}</span></div></section>${stats()}<section class="section"><div class="section-head"><h2>${t('latestVotes')}</h2><a href="#/votes">${t('showAll')} →</a></div>${table([t('day'),t('matter'),t('result')],voteRows(latest))}</section></div>`}
function voteList(){
  const controls=state.voteFilters, extra=toolState('votes','date','desc'), config=voteTools(data.votes);
  const stages=[...new Map(data.votes.filter(v=>v.stage).map(v=>[v.stage,(lang==='sv'&&v.stageSv)||v.stage])).entries()].sort((a,b)=>a[1].localeCompare(b[1],lang));
  const committees=committeeOptions(data.votes,lang);
  root.innerHTML=`<div class="page">${header(t('parliament'),t('votes'),t('allVotes'))}<div class="filters vote-filters"><input data-vote-query aria-label="${e(t('searchVotes'))}" placeholder="${e(t('searchVotes'))}" value="${e(controls.query)}"><label class="filter-control"><span>${lang==='sv'?'Ämne':'Aihealue'}</span><select data-vote-topic>${topicOptionsHTML(controls.topic)}</select></label><label class="filter-control"><span>${lang==='sv'?'Utskott':'Valiokunta'}</span><select data-vote-committee><option value="all">${lang==='sv'?'Alla utskott':'Kaikki valiokunnat'}</option>${committees.map(([value,label])=>`<option value="${e(value)}" ${controls.committee===value?'selected':''}>${e(label)}</option>`).join('')}</select></label><label class="filter-control"><span>${lang==='sv'?'Resultat':'Tulos'}</span><select data-vote-outcome><option value="all">${lang==='sv'?'Alla resultat':'Kaikki tulokset'}</option><option value="moreYes">${e(t('moreYes'))}</option><option value="moreNo">${e(t('moreNo'))}</option><option value="tie">${e(t('tie'))}</option></select></label><label class="filter-control"><span>${lang==='sv'?'Typ':'Tyyppi'}</span><select data-vote-type><option value="all">${lang==='sv'?'Alla typer':'Kaikki tyypit'}</option><option value="amendment">${lang==='sv'?'Ändringsförslag':'Muutosehdotukset'}</option><option value="other">${lang==='sv'?'Övriga omröstningar':'Muut äänestykset'}</option></select></label><label class="filter-control"><span>${lang==='sv'?'Behandlingsskede':'Käsittelyvaihe'}</span><select data-vote-stage><option value="all">${lang==='sv'?'Alla skeden':'Kaikki vaiheet'}</option>${stages.map(([value,label])=>`<option value="${e(value)}">${e(label)}</option>`).join('')}</select></label></div><div class="data-actions"><p class="filter-summary" data-vote-count aria-live="polite"></p>${exportButtons('votes',lang)}</div><div data-list></div><div data-more></div></div>`;
  const query=$('[data-vote-query]'),topic=$('[data-vote-topic]'),committee=$('[data-vote-committee]'),outcome=$('[data-vote-outcome]'),type=$('[data-vote-type]'),stage=$('[data-vote-stage]');
  outcome.value=controls.outcome;type.value=controls.type;stage.value=controls.stage;topic.value=controls.topic;committee.value=controls.committee;
  let filtered=[];
  const redraw=()=>{filtered=applyCollection(filterVotes(filterAIItems('votes',data.votes),controls),extra,config,lang);state.votes=Math.max(1,Math.min(state.votes,Math.ceil(filtered.length/PAGE.votes)||1));const shown=pageSlice(filtered,state.votes,PAGE.votes);$('[data-vote-count]').textContent=lang==='sv'?`${filtered.length.toLocaleString('sv-FI')} omröstningar`:`${filtered.length.toLocaleString('fi-FI')} äänestystä`;$('[data-list]').innerHTML=filtered.length?table([t('day'),t('matter'),t('result')],voteRows(shown)):`<div class="empty">${t('noData')}</div>`;$('[data-more]').innerHTML=pagination('votes',filtered.length);bindPagination('votes',redraw)};
  query.oninput=event=>{controls.query=event.target.value;state.votes=1;redraw()};
  topic.onchange=event=>{controls.topic=event.target.value;state.votes=1;redraw()};
  committee.onchange=event=>{controls.committee=event.target.value;state.votes=1;redraw()};
  outcome.onchange=event=>{controls.outcome=event.target.value;state.votes=1;redraw()};
  type.onchange=event=>{controls.type=event.target.value;state.votes=1;redraw()};
  stage.onchange=event=>{controls.stage=event.target.value;state.votes=1;redraw()};
  addTools(root.querySelector('.data-actions'),'votes',extra,config,()=>{state.votes=1;redraw()});
  bindExportButtons(root,'votes',()=>voteExportRows(filtered),'vahtikissa-aanestykset');redraw();
}
function ballotRows(ballots){return ballots.length?ballots.map(b=>`<li><span class="ballot-person"><a href="${href('members',b.mpId)}">${e(memberName(b))}</a><a class="ballot-party" href="${href('parties',b.party)}">${e(titleFor(b.party))}</a></span><span class="pill choice-${e(b.choice)}">${e(choice(b.choice))}</span></li>`).join(''):`<li class="empty">${t('noData')}</li>`}
function voteContext(v){const question=voteText(v,'question')||voteText(v,'title'),alternatives=voteAlternatives(question,lang),matter=voteText(v,'title'),document=voteText(v,'document');return `<div class="vote-summary"><span class="outcome outcome-${voteOutcome(v)}">${t(voteOutcome(v))}</span><h2>${t('whatWasVoted')}</h2><dl class="vote-context"><dt>${t('matter')}</dt><dd>${e(matter||'—')}${document?` <strong>(${e(document)})</strong>`:''}</dd><dt>${lang==='sv'?'Exakt fråga':'Tarkka kysymys'}</dt><dd>${e(question||'—')}</dd>${alternatives.yes?`<dt>${lang==='sv'?'JA betyder':'JAA tarkoittaa'}</dt><dd>${e(alternatives.yes)}</dd><dt>${lang==='sv'?'NEJ betyder':'EI tarkoittaa'}</dt><dd>${e(alternatives.no)}</dd>`:''}<dt>${t('stage')}</dt><dd>${e(voteText(v,'stage')||'—')}</dd></dl><div class="source-links">${v.documentUrl?`<a href="${e(v.documentUrl)}" target="_blank" rel="noreferrer">${t('officialMatter')} ↗</a>`:''}${v.minutesUrl?`<a href="${e(v.minutesUrl)}" target="_blank" rel="noreferrer">${t('minutes')} ↗</a>`:''}${v.resultUrl?`<a href="${e(v.resultUrl)}" target="_blank" rel="noreferrer">${t('officialVote')} ↗</a>`:''}</div><small>${t('voteMeaning')}</small></div>`}
function voteDetail(id){const v=data.votes.find(x=>x.id===id);if(!v)return notFound();const ballots=data.ballots.filter(b=>b.voteId===id);const groups=Object.entries(groupBy(ballots,b=>b.party)).sort((a,b)=>b[1].length-a[1].length);const outcome=voteOutcome(v);return `<div class="page">${header(`${t('vote')} ${v.number} · ${fmtDate(v.date)}`,voteText(v,'title')||voteText(v,'question'))}<div class="detail-grid"><div>${voteContext(v)}<h2>${t('result')}</h2><div class="result-block">${resultBar(v)}</div><section class="section"><h2>${t('votesByParty')}</h2><div class="party-results">${groups.map(([party,bs])=>{const c={yes:0,no:0,abstain:0,absent:0,total:bs.length};bs.forEach(b=>c[b.choice]=(c[b.choice]||0)+1);return `<div class="party-result"><strong>${e(titleFor(party))}</strong>${resultBar(c)}</div>`}).join('')}</div></section><section class="section voter-section"><div class="section-head"><div><h2>${t('members')}</h2><p class="sub">${t('voterFilter')}</p></div></div><div class="choice-filters" role="group" aria-label="${e(t('voterFilter'))}">${['all','yes','no','abstain','absent'].map(key=>`<button type="button" data-choice="${key}" aria-pressed="${key==='all'}"><span>${e(t(key))}</span><strong>${key==='all'?ballots.length:v[key]}</strong></button>`).join('')}</div><p class="sr-status" data-voter-status aria-live="polite"></p><ul class="ballot-list voter-list" data-voter-list>${ballotRows(ballots)}</ul></section></div><aside class="aside"><h3>${t('background')}</h3><dl><dt>${t('stage')}</dt><dd>${e(voteText(v,'stage')||'—')}</dd><dt>${t('officialMatter')}</dt><dd>${v.documentUrl?`<a href="${e(v.documentUrl)}" target="_blank" rel="noreferrer">${e(voteText(v,'document'))} ↗</a>`:e(voteText(v,'document')||'—')}</dd><dt>${t('minutes')}</dt><dd>${e(voteText(v,'minutes')||'—')}</dd><dt>${t('officialVote')}</dt><dd><a href="${e(v.resultUrl)}" target="_blank" rel="noreferrer">${t('openOfficial')}</a></dd><dt>${t('result')}</dt><dd>${v.yes} ${t('yes')} · ${v.no} ${t('no')} · ${v.abstain} ${t('abstain')} · ${v.absent} ${t('absent')}</dd></dl></aside></div></div>`}
function bindVoteFilters(id){
  const ballots=data.ballots.filter(b=>b.voteId===id), extra=toolState(`ballots-${id}`,'name'), config={label:t('members'),search:memberName,sorts:[{key:'name',label:t('members'),value:ballot=>`${ballot.lastName} ${ballot.firstName}`},{key:'party',label:label('Puolue','Parti'),value:ballot=>titleFor(ballot.party)},{key:'choice',label:t('howVoted'),value:ballot=>choice(ballot.choice)}],facets:[facet('party',label('Puolue','Parti'),ballots,ballot=>ballot.party,titleFor),facet('choice',t('howVoted'),ballots,ballot=>ballot.choice,choice)]};let filtered=ballots, selected='all';
  root.querySelector('.choice-filters')?.insertAdjacentHTML('beforebegin',`<div class="data-actions">${exportButtons('ballots',lang)}</div>`);
  const redraw=()=>{filtered=applyCollection(filterBallots(ballots,selected),extra,config,lang);$('[data-voter-list]').innerHTML=ballotRows(filtered);$('[data-voter-status]').textContent=`${filtered.length} ${lang==='sv'?'ledamöter':'kansanedustajaa'}`};
  document.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>{selected=button.dataset.choice;document.querySelectorAll('[data-choice]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));redraw()});
  addTools(root.querySelector('.choice-filters'),'ballots',extra,config,redraw);redraw();
  bindExportButtons(root,'ballots',()=>ballotExportRows(filtered),`vahtikissa-aanestys-${id}`);
}
function members(id){
  if(id)return memberDetail(data.members.find(m=>m.id===id));
  const controls=state.memberFilters,extra=toolState('members','name'),config=memberTools(data.members),parties=[...new Set(data.members.map(m=>m.party).filter(Boolean))].sort((a,b)=>titleFor(a).localeCompare(titleFor(b),lang));
  const renderList=items=>items.length?table([t('members'),t('participation'),t('partyLine'),t('speeches')],memberRows(items)):`<div class="empty">${t('noData')}</div>`;
  root.innerHTML=`<div class="page">${header(t('parliament'),t('members'))}<p class="portrait-credit">${label('Viralliset muotokuvat: Eduskunta. Mukana myös seuranta-ajanjakson entiset edustajat.','Officiella porträtt: Riksdagen. Även tidigare ledamöter under uppföljningsperioden ingår.')} <a href="https://www.eduskunta.fi/kansanedustajat-ja-toimielimet/kansanedustajat" target="_blank" rel="noreferrer">${label('Kuvien lähde','Bildkälla')} ↗</a></p><div class="filters member-filters"><input data-member-query aria-label="${e(t('searchMembers'))}" placeholder="${e(t('searchMembers'))}" value="${e(controls.query)}"><label class="filter-control"><span>${lang==='sv'?'Parti':'Puolue'}</span><select data-member-party><option value="all">${lang==='sv'?'Alla partier':'Kaikki puolueet'}</option>${parties.map(party=>`<option value="${e(party)}">${e(titleFor(party))}</option>`).join('')}</select></label></div><div class="data-actions"><p class="filter-summary" data-member-count aria-live="polite"></p>${exportButtons('members',lang)}</div><div data-list></div></div>`;
  const query=$('[data-member-query]'),party=$('[data-member-party]');party.value=controls.party;
  let filtered=[];const redraw=()=>{filtered=applyCollection(filterAndSortMembers(data.members,controls,partyNames),extra,config,lang);$('[data-member-count]').textContent=lang==='sv'?`${filtered.length} ledamöter`:`${filtered.length} kansanedustajaa`;$('[data-list]').innerHTML=renderList(filtered)};
  query.oninput=event=>{controls.query=event.target.value;redraw()};party.onchange=event=>{controls.party=event.target.value;redraw()};addTools(root.querySelector('.data-actions'),'members',extra,config,redraw);redraw();
  bindExportButtons(root,'members',()=>filtered.map(member=>({id:member.id,name:memberName(member),party:titleFor(member.party),participationPercent:member.stats?.participation,votes:member.stats?.votes,partyLinePercent:member.stats?.loyalty,speeches:member.stats?.speeches})),'vahtikissa-kansanedustajat');
}
let activeMemberId=null;
async function loadSpeechTexts(items){
  const chunks=[...new Set(items.map(item=>item.textChunk).filter(Number.isInteger))];
  const results=await Promise.allSettled(chunks.map(chunk=>{
    if(!speechTextPromises.has(chunk))speechTextPromises.set(chunk,fetchJSONWithTimeout(`./data/speech-texts-${chunk}.json`).then(value=>{
      Object.assign(speechTexts,value);loadedSpeechChunks.add(chunk);speechTextErrors.delete(chunk);return value;
    }).catch(error=>{speechTextPromises.delete(chunk);speechTextErrors.set(chunk,error);throw error}));
    return speechTextPromises.get(chunk);
  }));
  const failed=results.find(result=>result.status==='rejected');
  if(failed)throw failed.reason;
  return speechTexts;
}
function loadSpeechSearchIndex(){if(!speechSearchPromise)speechSearchPromise=Promise.all([fetchJSONWithTimeout('./data/speech-search.json').then(decodeSpeechSearchIndex),parliamentLoader.loadSpeeches()]).then(([index,metadata])=>{if(index.length!==metadata.length)throw new Error('Speech search index does not match speech metadata');speechSearchTexts=index;return index}).catch(error=>{speechSearchPromise=null;throw error});return speechSearchPromise}
function loadSpeechAnalytics(){if(!speechAnalyticsPromise)speechAnalyticsPromise=fetchJSONWithTimeout('./data/speech-analytics.json').catch(error=>{speechAnalyticsPromise=null;throw error});return speechAnalyticsPromise}
function speechAnalyticsView(analytics,topic='all'){
  const bucket=analytics?.topics?.[topic]||analytics?.topics?.all||{members:[],parties:[]};
  const metric=item=>`${item.words.toLocaleString(lang)} ${lang==='sv'?'ord':'sanaa'} · ${item.speeches.toLocaleString(lang)} ${lang==='sv'?'anföranden':'puheenvuoroa'} · ${item.averageWords} ${lang==='sv'?'ord/anförande':'sanaa/puhe'}`;
  const rank=(items,label,name)=>`<section><h3>${label}</h3><ol role="list" aria-label="${e(label)}">${items.slice(0,5).map((item,index)=>`<li><span aria-hidden="true">${index+1}</span><div><strong>${e(name(item))}</strong><small>${e(metric(item))}</small></div><span class="analytics-bar" aria-hidden="true" style="--rank:${percent(item.words,items[0]?.words||1)}%"></span></li>`).join('')||`<li>${t('noData')}</li>`}</ol></section>`;
  return `<div class="section-head"><div><span class="eyebrow">${lang==='sv'?'Anförandeanalys':'Puheanalytiikka'}</span><h2>${topic==='all'?(lang==='sv'?'Vem talar mest?':'Ketkä puhuvat eniten?'):policyTopicLabel(topic,lang)}</h2><p class="sub">${lang==='sv'?'Hela uppföljningsmaterialet: endast ämnesvalet avgränsar denna jämförelse. Ordmängden beskriver längd; antalet beskriver frekvens.':'Koko seuranta-aineisto: vain aihevalinta rajaa tätä vertailua. Sanamäärä kuvaa pituutta ja puheenvuorojen määrä esiintymistiheyttä.'}</p></div></div><div class="speech-rankings">${rank(bucket.members,lang==='sv'?'Ledamöter':'Kansanedustajat',memberName)}${rank(bucket.parties,lang==='sv'?'Partier':'Puolueet',item=>titleFor(item.party))}</div>`;
}
function memberDetail(m){if(!m)return notFound();if(activeMemberId!==m.id){state.memberSpeeches=1;state.memberVotes=1}activeMemberId=m.id;
  const ballots=data.ballots.filter(ballot=>ballot.mpId===m.id),ids=new Set(ballots.map(ballot=>ballot.voteId));
  const votes=data.votes.filter(vote=>ids.has(vote.id)),speechesForMember=data.speeches.filter(speech=>speech.mpId===m.id);
  const voteState=toolState(`member-votes-${m.id}`,'date','desc'),speechState=toolState(`member-speeches-${m.id}`,'date','desc');
  const voteConfig=voteTools(votes),speechConfig={...speechTools(speechesForMember),search:speech=>[speech.agenda,speech.agendaSv,speech.type]};
  voteConfig.facets.push(facet('choice',t('howVoted'),votes,vote=>ballots.find(ballot=>ballot.voteId===vote.id)?.choice,choice));
  root.innerHTML=`<div class="page member-page">
    <header class="member-cover">
      <div class="member-cover-banner" aria-hidden="true"></div>
      <div class="member-identity">
        <div class="member-avatar">${memberPortrait(m,true)}</div>
        <div class="member-identity-text"><span class="eyebrow">${t('parliament')}</span><h1>${e(memberName(m))}</h1><a class="member-party-link" href="${href('parties',m.party)}">${e(titleFor(m.party))}</a><p class="sub">${t('mpActivity')}</p></div>
        <p class="portrait-credit">${label('Kuva: Eduskunta','Foto: Riksdagen')}</p>
      </div>
      <nav class="member-tabs" aria-label="${label('Edustajan profiili','Ledamotens profil')}"><button type="button" data-member-jump="member-activity">${label('Toiminta','Aktivitet')}</button><button type="button" data-member-jump="member-about">${label('Tietoja','Om ledamoten')}</button><button type="button" data-member-jump="member-vocabulary">${label('Sanasto','Ordförråd')}</button><a href="${href('influence',m.id)}">${label('Sidonnaisuudet ja lahjat','Bindningar och gåvor')}</a></nav>
    </header>
    <div class="member-columns">
      <div class="member-feed" id="member-activity" tabindex="-1">
        <section class="member-feed-card"><h2>${t('recentVotes')}</h2><div data-member-vote-tools></div><div class="data-actions">${exportButtons('member-votes',lang)}</div><p role="status" data-member-vote-count></p><div data-member-votes></div><div data-member-votes-more></div></section>
        <section class="member-feed-card"><h2>${t('mpSpeeches')}</h2><div data-member-speech-tools></div><div class="data-actions">${exportButtons('member-speeches',lang)}</div><p role="status" data-member-speech-count></p><div data-member-speeches></div><div data-member-speeches-more></div></section>
      </div>
      <aside class="member-sidebar" aria-label="${label('Edustajan tiedot','Uppgifter om ledamoten')}">
        <section class="member-summary"><h2>${label('Toimintaluvut','Aktivitetsmått')}</h2><dl class="member-metrics"><div><dt>${t('participation')}</dt><dd>${m.stats.participation}%</dd></div><div><dt>${t('partyLine')}</dt><dd>${m.stats.loyalty}%</dd></div><div><dt>${t('speeches')}</dt><dd>${m.stats.speeches.toLocaleString(lang)}</dd></div><div><dt>${t('votes')}</dt><dd>${m.stats.votes.toLocaleString(lang)}</dd></div></dl><p class="sub">${m.stats.yes} ${t('yes')} · ${m.stats.no} ${t('no')} · ${m.stats.abstain} ${t('abstain')}</p><details class="member-stats-note"><summary>${label('Miten luvut lasketaan?','Hur beräknas måtten?')}</summary><p class="sub">${e(participationInfo())}</p></details></section>
        <div class="member-insights"></div>
      </aside>
    </div>
  </div>`;
  mountMemberInsights(root.querySelector('.member-insights'),m,lang);
  root.querySelectorAll('[data-member-jump]').forEach(button=>button.onclick=()=>{
    const target=document.getElementById(button.dataset.memberJump);if(!target)return;
    target.focus({preventScroll:true});target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  });
  const memberSpeechList=$('[data-member-speeches]');
  let filteredVotes=[],filteredSpeeches=[],version=0;
  const redrawVotes=()=>{filteredVotes=applyCollection(votes,voteState,voteConfig,lang);$('[data-member-vote-count]').textContent=`${filteredVotes.length} ${t('votes').toLocaleLowerCase(lang)}`;$('[data-member-votes]').innerHTML=table([t('day'),t('matter'),t('result')],voteRows(pageSlice(filteredVotes,state.memberVotes,PAGE.memberVotes),m.id));$('[data-member-votes-more]').innerHTML=pagination('memberVotes',filteredVotes.length);bindPagination('memberVotes',redrawVotes)};
  const redrawSpeeches=()=>{
    const current=++version;filteredSpeeches=applyCollection(speechesForMember,speechState,speechConfig,lang);
    const shown=pageSlice(filteredSpeeches,state.memberSpeeches,PAGE.memberSpeeches);
    const paint=()=>{
      if(current!==version||!memberSpeechList.isConnected)return;
      preservePageScroll(root,()=>preserveFocus(memberSpeechList,()=>{memberSpeechList.innerHTML=speechList(shown);bindSpeechToggles(paint)}));
    };
    $('[data-member-speech-count]').textContent=`${filteredSpeeches.length} ${t('speechTurns')}`;
    paint();$('[data-member-speeches-more]').innerHTML=pagination('memberSpeeches',filteredSpeeches.length);bindPagination('memberSpeeches',redrawSpeeches);
    loadSpeechTexts(shown).then(paint,paint);
  };
  mountCollectionTools($('[data-member-vote-tools]'),'member-votes',voteState,voteConfig,lang,()=>{state.memberVotes=1;redrawVotes()});
  mountCollectionTools($('[data-member-speech-tools]'),'member-speeches',speechState,speechConfig,lang,()=>{state.memberSpeeches=1;redrawSpeeches()});
  bindExportButtons(root,'member-votes',()=>voteExportRows(filteredVotes).map(row=>({...row,choice:choice(ballots.find(ballot=>ballot.voteId===row.id)?.choice)})),`vahtikissa-${safeFilename(memberName(m))}-aanestykset`);
  bindExportButtons(root,'member-speeches',()=>speechExportRows(filteredSpeeches),`vahtikissa-${safeFilename(memberName(m))}-puheet`);
  redrawVotes();redrawSpeeches();
}
function speechList(items){return items.length?items.map(s=>{const documents=lang==='sv'&&s.documentsSv?.length?s.documentsSv:s.documents,text=speechTexts?.[s.id]??s.text,long=isLongSpeech(text),officialDocument=documents?.[0]?.label,partyKey=/^[a-z]+$/.test(s.party)?s.party:'other',articleId=speechElementId(s.id),textId=`${articleId}-text`,paragraphs=text?speechParagraphs(text):[],failed=speechTextErrors.has(s.textChunk),loaded=!Number.isInteger(s.textChunk)||loadedSpeechChunks.has(s.textChunk);return `<article class="speech speech-party-${partyKey}" id="${e(articleId)}" tabindex="-1"><div class="speech-meta"><time class="date" datetime="${e(s.date)}">${fmtDate(s.date)}</time><a class="speech-speaker" href="${href('members',s.mpId)}">${e(memberName(s))}</a><span class="speech-party">${e(titleFor(s.party))}</span></div><h3>${e((lang==='sv'&&s.agendaSv)||s.agenda||t('speeches'))}</h3>${text?`<blockquote id="${e(textId)}" class="speech-text${long?' collapsed':''}">${paragraphs.map(paragraph=>`<p>${e(paragraph)}</p>`).join('')}</blockquote>`:failed?`<div class="speech-load-error" role="alert"><p>${ui('Puhetekstiä ei saatu ladattua. Yritä uudelleen.','Taltexten kunde inte laddas. Försök igen.','The transcript could not be loaded. Please try again.')}</p><button type="button" data-speech-retry="${e(s.textChunk)}" data-speech-id="${e(s.id)}">${ui('Yritä uudelleen','Försök igen','Try again')}</button></div>`:loaded?`<p class="sub">${ui('Puhetekstiä ei ole tässä aineistossa.','Taltexten saknas i materialet.','The transcript is not available in this dataset.')}</p>`:`<p class="sub" role="status">${t('loading')}</p>`}${long?`<button class="speech-toggle" type="button" aria-expanded="false" aria-controls="${e(textId)}">${t('readMore')}</button>`:''}${documents?.length?`<p class="source-links">${documents.map(d=>officialDocument?`<a href="${e(parliamentMatterUrl(d.label))}" target="_blank" rel="noreferrer">${e(d.label||d.name)} ↗</a>`:`<span>${e(d.label||d.name)}</span>`).join(' · ')}</p>`:''}</article>`}).join(''):`<div class="empty">${t('noData')}</div>`}
function bindSpeechToggles(repaint){
  root.querySelectorAll('.speech-toggle').forEach(button=>button.onclick=()=>{const text=document.getElementById(button.getAttribute('aria-controls')),expanded=button.getAttribute('aria-expanded')==='true';if(!text)return;text.classList.toggle('collapsed',expanded);button.setAttribute('aria-expanded',String(!expanded));button.textContent=expanded?t('readMore'):t('readLess')});
  root.querySelectorAll('[data-speech-retry]').forEach(button=>button.onclick=async()=>{
    if(button.getAttribute('aria-busy')==='true')return;
    const speech=data.speeches.find(item=>item.id===button.dataset.speechId);if(!speech)return;
    button.setAttribute('aria-busy','true');button.setAttribute('aria-disabled','true');button.textContent=ui('Yritetään uudelleen…','Försöker igen…','Retrying…');
    try{
      await loadSpeechTexts([speech]);if(!button.isConnected)return;
      const restoreFocus=document.activeElement===button;
      repaint?.();
      if(restoreFocus)document.getElementById(speechElementId(speech.id))?.focus({preventScroll:true});
    }catch{
      if(button.isConnected){button.textContent=ui('Yritä uudelleen','Försök igen','Try again');button.removeAttribute('aria-busy');button.removeAttribute('aria-disabled')}
    }
  });
}
function speeches(targetId=null,{scrollToTarget=true}={}){
  const params=new URLSearchParams(targetId?'':location.hash.split('?')[1]||'');
  const researchSettings={lang,mode:['contains','word','phrase'].includes(params.get('match'))?params.get('match'):'contains',scope:params.get('scope')==='text'?'text':'all',exclude:params.get('exclude')||''};
  let indexedTexts;
  const parties=[...new Set(data.speeches.map(s=>s.party).filter(Boolean))].sort((a,b)=>titleFor(a).localeCompare(titleFor(b),lang));
  const speakers=[...new Map(data.speeches.map(s=>[String(s.mpId),s])).values()].sort((a,b)=>memberName(a).localeCompare(memberName(b),lang));
  let filtered=data.speeches,queryMatches=data.speeches,version=0,searchVersion=0,timer,targetPending=Boolean(targetId);
  const controls={party:params.get('party')||'all',mpId:params.get('mp')||'all',topic:params.get('topic')||'all'},extra=targetId||params.has('q')?collectionState('date','desc'):toolState('speeches','date','desc'),config=speechTools(data.speeches);
  for(const key of ['from','to'])if(/^\d{4}-\d{2}-\d{2}$/.test(params.get(key)||''))extra[key]=params.get(key);
  root.innerHTML=`<div class="page">${header(t('parliament'),t('speeches'),t('allSpeeches'))}<div class="filters speech-filters"><div class="speech-search-field"><input data-filter aria-label="${e(t('searchSpeeches'))}" placeholder="${e(t('searchSpeeches'))}"><span class="filter-note" data-search-status role="status" aria-live="polite"></span></div><label class="filter-control"><span>${lang==='sv'?'Ämne':'Aihealue'}</span><select data-speech-topic>${topicOptionsHTML(controls.topic)}</select></label><label class="filter-control"><span>${lang==='sv'?'Parti':'Puolue'}</span><select data-speech-party><option value="all">${lang==='sv'?'Alla partier':'Kaikki puolueet'}</option>${parties.map(party=>`<option value="${e(party)}">${e(titleFor(party))}</option>`).join('')}</select></label><label class="filter-control"><span>${lang==='sv'?'Ledamot':'Kansanedustaja'}</span><select data-speech-member><option value="all">${lang==='sv'?'Alla ledamöter':'Kaikki kansanedustajat'}</option></select></label></div><section class="speech-analytics" data-speech-analytics aria-busy="true"><p>${t('loading')}</p></section><div class="data-actions"><p class="filter-summary" data-speech-count aria-live="polite"></p>${exportButtons('speeches',lang)}</div><div data-list></div><div data-more></div></div>`;
  const input=$('[data-filter]'),topicSelect=$('[data-speech-topic]'),partySelect=$('[data-speech-party]'),memberSelect=$('[data-speech-member]'),searchStatus=$('[data-search-status]'),analyticsRoot=$('[data-speech-analytics]');
  input.value=params.get('q')||'';partySelect.value=controls.party;topicSelect.value=controls.topic;
  const researchUI=mountResearchControls(root,researchSettings,()=>runSearch());
  const shareParams=()=>{const values=new URLSearchParams({q:input.value.trim(),match:researchSettings.mode,scope:researchSettings.scope,exclude:researchSettings.exclude,mp:controls.mpId,party:controls.party,topic:controls.topic});for(const key of ['from','to'])if(extra[key])values.set(key,extra[key]);values.set('filters',JSON.stringify({facets:extra.facets,min:extra.min,max:extra.max,sort:extra.sort,direction:extra.direction}));return values;};
  if(params.has('filters')){try{const saved=JSON.parse(params.get('filters'));if(saved&&typeof saved==='object'){extra.facets=Object.fromEntries(config.facets.map(facet=>[facet.key,{include:Array.isArray(saved.facets?.[facet.key]?.include)?saved.facets[facet.key].include.map(String):[],exclude:Array.isArray(saved.facets?.[facet.key]?.exclude)?saved.facets[facet.key].exclude.map(String):[]} ]));extra.min=typeof saved.min==='string'?saved.min:'';extra.max=typeof saved.max==='string'?saved.max:'';if(config.sorts.some(sort=>sort.key===saved.sort))extra.sort=saved.sort;extra.direction=saved.direction==='asc'?'asc':'desc';}}catch{}}
  const updateMemberOptions=()=>{const available=speakers.filter(s=>controls.party==='all'||s.party===controls.party);if(!available.some(s=>String(s.mpId)===controls.mpId))controls.mpId='all';memberSelect.innerHTML=`<option value="all">${lang==='sv'?'Alla ledamöter':'Kaikki kansanedustajat'}</option>${available.map(s=>`<option value="${e(s.mpId)}">${e(memberName(s))}</option>`).join('')}`;memberSelect.value=controls.mpId};
  const redraw=()=>{
    const current=++version,shown=pageSlice(filtered,state.speeches,PAGE.speeches),list=$('[data-list]');
    const paint=()=>{
      if(current!==version||!input.isConnected)return;
      preservePageScroll(root,()=>preserveFocus(list,()=>{list.innerHTML=speechList(shown);researchUI.annotate(shown,indexedTexts,input.value);bindSpeechToggles(paint)}));
    };
    $('[data-speech-count]').textContent=lang==='sv'?`${filtered.length.toLocaleString('sv-FI')} anföranden`:`${filtered.length.toLocaleString('fi-FI')} puheenvuoroa`;
    paint();$('[data-more]').innerHTML=pagination('speeches',filtered.length);bindPagination('speeches',redraw);
    loadSpeechTexts(shown).then(paint,paint);
  };
  const updateAnalytics=()=>{analyticsRoot.setAttribute('aria-busy','true');loadSpeechAnalytics().then(analytics=>{if(analyticsRoot.isConnected){analyticsRoot.innerHTML=speechAnalyticsView(analytics,controls.topic);analyticsRoot.setAttribute('aria-busy','false')}}).catch(()=>{if(analyticsRoot.isConnected){analyticsRoot.innerHTML=`<p class="empty">${lang==='sv'?'Analysen kunde inte laddas.':'Analytiikkaa ei voitu ladata.'}</p>`;analyticsRoot.setAttribute('aria-busy','false')}})};
  const applyFilters=()=>{filtered=applyCollection(filterSpeechesBySpeaker(queryMatches,controls),extra,config,lang);const pages=Math.max(1,Math.ceil(filtered.length/PAGE.speeches));if(targetPending){targetPending=false;const targetIndex=filtered.findIndex(speech=>speech.id===targetId);if(targetIndex>=0)state.speeches=Math.floor(targetIndex/PAGE.speeches)+1}if(state.speeches>pages)state.speeches=1;redraw();const corpus=applyCollection(filterSpeechesBySpeaker(filterResearchSpeeches(data.speeches,indexedTexts||{}, {...researchSettings,query:''}),controls),extra,config,lang);researchUI.update({corpus,filtered,texts:indexedTexts,query:input.value.trim(),params:shareParams(),generatedAt:data.metadata.generatedAt});};
  partySelect.onchange=event=>{controls.party=event.target.value;state.speeches=1;updateMemberOptions();applyFilters()};
  memberSelect.onchange=event=>{controls.mpId=event.target.value;state.speeches=1;applyFilters()};
  topicSelect.onchange=event=>{controls.topic=event.target.value;state.speeches=1;applyFilters();updateAnalytics()};
  function runSearch(){clearTimeout(timer);const request=++searchVersion;timer=setTimeout(async()=>{if(!input.isConnected||request!==searchVersion)return;const query=input.value.trim();state.speeches=1;if(query||researchSettings.exclude){searchStatus.textContent=ui('Ladataan puheiden hakuindeksi…','Sökindexet laddas…','Loading the speech search index…');input.setAttribute('aria-busy','true');try{await loadSpeechSearchIndex();if(!input.isConnected||request!==searchVersion)return;indexedTexts=Object.fromEntries(data.speeches.map((speech,index)=>[speech.id,speechSearchTexts[index]]));queryMatches=filterResearchSpeeches(data.speeches,indexedTexts,{...researchSettings,query});searchStatus.textContent=''}catch{if(input.isConnected&&request===searchVersion)searchStatus.textContent=ui('Hakua ei voitu ladata.','Sökningen kunde inte laddas.','Search could not be loaded. Please try again.')}finally{if(input.isConnected&&request===searchVersion)input.setAttribute('aria-busy','false')}}else{queryMatches=data.speeches;searchStatus.textContent=''}if(!input.isConnected||request!==searchVersion)return;applyFilters()},250)}
  input.oninput=runSearch;
  addTools(root.querySelector('.speech-analytics'),'speeches',extra,config,()=>{state.speeches=1;applyFilters()});
  bindExportButtons(root,'speeches',async()=>{const items=[...filtered],rows=speechExportRows(items),query=input.value.trim(),settings={...researchSettings},filters=String(shareParams());await loadSpeechTexts(items);return rows.map((row,index)=>({...row,text:speechTexts[items[index].id]||'',occurrences:matchRanges(speechTexts[items[index].id],query,settings.mode).length,query,matchMode:settings.mode,searchScope:settings.scope,exclude:settings.exclude,filters,generatedAt:data.metadata.generatedAt}));},'vahtikissa-puheenvuorot');updateMemberOptions();applyFilters();updateAnalytics();if(input.value||researchSettings.exclude)runSearch();if(targetId&&scrollToTarget)setTimeout(()=>document.getElementById(speechElementId(targetId))?.scrollIntoView({block:'start'}),0)
}
const matterTypeNames={HE:{fi:'Hallituksen esitys',sv:'Regeringens proposition'},LA:{fi:'Lakialoite',sv:'Lagmotion'},KAA:{fi:'Kansalaisaloite',sv:'Medborgarinitiativ'},LVM:{fi:'Lepäämään jätetty lakiehdotus',sv:'Vilande lagförslag'},U:{fi:'EU-asia',sv:'EU-ärende'},E:{fi:'EU-selvitys',sv:'EU-utredning'},VNT:{fi:'Valtioneuvoston tiedonanto',sv:'Statsrådets meddelande'},VNS:{fi:'Valtioneuvoston selonteko',sv:'Statsrådets redogörelse'},VK:{fi:'Valtioneuvoston kirjelmä',sv:'Statsrådets skrivelse'}};
const legislationSteps={fi:['Vireilletulo','Lähetekeskustelu','Valiokunta','Pöydällepano','1. käsittely','2. käsittely','Eduskunnan vastaus'],sv:['Anhängig','Remissdebatt','Utskott','Bordläggning','1:a behandlingen','2:a behandlingen','Riksdagens svar']};
const legislationStepNotes={fi:['Esitys tai aloite on saapunut eduskuntaan.','Täysistunto päättää, mihin valiokuntaan asia lähetetään.','Valiokunta kuulee asiantuntijoita ja valmistelee mietinnön.','Valmistunut mietintö annetaan kansanedustajien tutustuttavaksi.','Eduskunta päättää lakiehdotuksen sisällöstä ja mahdollisista muutoksista.','Eduskunta päättää lakiehdotuksen hyväksymisestä tai hylkäämisestä.','Eduskunnan päätös toimitetaan valtioneuvostolle.'],sv:['Förslaget eller initiativet har kommit till riksdagen.','Plenum beslutar vilket utskott som ska behandla ärendet.','Utskottet hör sakkunniga och bereder ett betänkande.','Det färdiga betänkandet läggs på bordet för ledamöterna.','Riksdagen beslutar om lagförslagets innehåll och eventuella ändringar.','Riksdagen beslutar om lagförslaget ska godkännas eller förkastas.','Riksdagens beslut lämnas till statsrådet.']};
legislationSteps.en=['Introduction','Referral debate','Committee','Report tabled','First reading','Second reading','Parliament’s response'];
legislationStepNotes.en=['A proposal or initiative has arrived in Parliament.','The plenary refers the matter to a committee.','The committee hears experts and prepares its report.','The completed report is made available to MPs.','Parliament decides the bill’s contents and amendments.','Parliament decides whether to approve or reject the bill.','Parliament’s decision is delivered to the Government.'];
function matterTypeName(item){const code=legislationMatterType(item);return matterTypeNames[code]?.[lang]||matterTypeNames[code]?.fi||code}
function legislationToneLabel(tone){const labels={fi:{ongoing:'Käsittelyssä',approved:'Hyväksytty',changed:'Hyväksytty muutettuna',rejected:'Hylätty',withdrawn:'Peruutettu',expired:'Rauennut',closed:'Käsitelty'},sv:{ongoing:'Under behandling',approved:'Godkänd',changed:'Godkänd med ändringar',rejected:'Förkastad',withdrawn:'Återtagen',expired:'Förfallen',closed:'Behandlad'}};return labels[lang]?.[tone]||labels.fi[tone]||tone}
function legislation(id){
  if(id){
    const item=data.legislation.find(matter=>matter.id===id);if(!item)return notFound();
    const votes=data.votes.filter(vote=>item.voteIds.includes(vote.id));
    const document=lang==='sv'&&item.documentSv||item.document,title=lang==='sv'&&item.titleSv||item.title;
    const stages=lang==='sv'&&item.stagesSv?.length?item.stagesSv:item.stages;
    const decision=lang==='sv'&&item.decisionSv||item.decision,tone=legislationStatusTone(item),phase=legislationPhase(item),steps=legislationSteps[lang];
    const currentStage=stages.at(-1)||legislationToneLabel(tone);
    const nextText=tone==='ongoing'?(legislationStepNotes[lang][Math.min(phase+1,6)]):(lang==='sv'?'Behandlingen i riksdagen är avslutad. Öppna den officiella källan för beslut, dokument och ikraftträdande.':'Asian eduskuntakäsittely on päättynyt. Virallisesta lähteestä löydät päätökset, asiakirjat ja voimaantulotiedot.');
    const timeline=`<ol class="legislation-timeline" role="list" aria-label="${e(lang==='sv'?'Lagförslagets typiska behandling':'Lakiehdotuksen tyypillinen käsittely')}">${steps.map((step,index)=>`<li class="${index<phase?'done':index===phase?'current':'upcoming'}" ${index===phase?'aria-current="step"':''}><span aria-hidden="true">${index<phase?'✓':index+1}</span><span class="sr-only">${index<phase?ui('Aiempi vaihe','Tidigare skede','Earlier stage'):index===phase?ui('Nykyinen vaihe','Nuvarande skede','Current stage'):ui('Myöhempi vaihe','Senare skede','Later stage')}: </span><strong>${e(step)}</strong></li>`).join('')}</ol>`;
    return `<div class="page legislation-detail">${header(document,title,lang==='sv'?'Följ ärendets skede, beslut och omröstningar.':'Seuraa asian vaihetta, päätöstä ja siihen liittyviä äänestyksiä.')}<div class="matter-summary"><div><span class="matter-type">${e(matterTypeName(item))}</span><span class="status-pill status-${tone}">${e(decision||legislationToneLabel(tone))}</span></div><dl><div><dt>${lang==='sv'?'Inkom':'Vireille'}</dt><dd>${fmtDate(item.firstDate)}</dd></div><div><dt>${t('updated')}</dt><dd>${fmtDate(item.latestDate)}</dd></div><div><dt>${t('votes')}</dt><dd>${item.voteIds.length}</dd></div><div><dt>${lang==='sv'?'Ändringsförslag':'Muutosehdotukset'}</dt><dd>${item.amendmentCount}</dd></div></dl></div><section class="legislation-process"><div class="section-head"><div><span class="eyebrow">${lang==='sv'?'Nuvarande skede':'Nykyinen vaihe'}</span><h2>${e(currentStage)}</h2></div><span class="process-count">${Math.min(phase+1,7)} / 7</span></div>${timeline}<div class="process-explanation"><div><strong>${lang==='sv'?'Vad sker i detta skede?':'Mitä tässä vaiheessa tapahtuu?'}</strong><p>${e(legislationStepNotes[lang][phase])}</p></div><div><strong>${tone==='ongoing'?(lang==='sv'?'Vad händer härnäst?':'Mitä seuraavaksi?'):(lang==='sv'?'Behandlingen avslutad':'Käsittely päättynyt')}</strong><p>${e(nextText)}</p></div></div><p class="process-caveat">${lang==='sv'?'Processen är den typiska gången för lagförslag. Andra riksdagsärenden kan följa en annan ordning.':'Kuvattu prosessi on lakiehdotuksen tyypillinen eteneminen. Muut valtiopäiväasiat voivat noudattaa erilaista järjestystä.'}</p></section><div class="detail-grid legislation-detail-grid"><section><div class="section-head"><h2>${t('votes')}</h2><span class="count">${votes.length}</span></div>${votes.length?table([t('day'),t('vote'),t('result')],voteRows(votes)):`<div class="empty">${lang==='sv'?'Inga registrerade omröstningar i detta ärende.':'Asiaan ei liity nimettyjä täysistuntoäänestyksiä.'}</div>`}</section><aside class="aside"><h3>${lang==='sv'?'Ärendeuppgifter':'Asian tiedot'}</h3><dl><dt>${lang==='sv'?'Typ':'Tyyppi'}</dt><dd>${e(matterTypeName(item))}</dd><dt>${t('stage')}</dt><dd>${stages.map(stage=>e(stage)).join('<br>')||'—'}</dd>${decision?`<dt>${t('result')}</dt><dd><span class="status-pill status-${tone}">${e(decision)}</span></dd>`:''}<dt>${t('officialMatter')}</dt><dd><a href="${e(item.url)}" target="_blank" rel="noreferrer">${t('openOfficial')}</a></dd></dl></aside></div></div>`;
  }
  const types=[...new Set(data.legislation.map(legislationMatterType))].sort();
  const committees=committeeOptions(data.legislation,lang);
  const counts=data.legislation.reduce((result,item)=>{const tone=legislationStatusTone(item);result[tone]=(result[tone]||0)+1;return result},{});
  const controls={query:'',status:'all',type:'all',topic:'all',committee:'all',sort:'date-desc'},extra=toolState('legislation','date','desc'),config={
    ...voteTools(data.legislation),label:t('legislation'),date:item=>item.latestDate||item.firstDate,
    sorts:[{key:'date',label:t('updated'),value:item=>item.latestDate||item.firstDate},{key:'title',label:t('matter'),value:item=>(lang==='sv'&&item.titleSv)||item.title},{key:'votes',label:t('votes'),value:item=>item.voteIds.length},{key:'amendments',label:label('Muutosehdotukset','Ändringsförslag'),value:item=>item.amendmentCount}],
    number:{label:t('votes'),value:item=>item.voteIds.length},facets:[...voteTools(data.legislation).facets.filter(item=>['topic','committee'].includes(item.key)),facet('status',label('Tila','Status'),data.legislation,legislationStatusTone,legislationToneLabel),facet('type',label('Asiatyyppi','Ärendetyp'),data.legislation,legislationMatterType,key=>matterTypeNames[key]?.[lang]||key)]};
  let filtered=[];
  const renderRows=items=>items.map(item=>{const document=lang==='sv'&&item.documentSv||item.document,title=lang==='sv'&&item.titleSv||item.title,stages=lang==='sv'&&item.stagesSv?.length?item.stagesSv:item.stages,decision=lang==='sv'&&item.decisionSv||item.decision,tone=legislationStatusTone(item),phase=legislationPhase(item),status=decision||stages.at(-1)||legislationToneLabel(tone),updated=item.latestDate||item.firstDate;return `<tr><td><div class="matter-labels"><span class="matter-type">${e(matterTypeName(item))}</span><a class="row-link" href="${href('legislation',item.id)}">${e(document)}</a></div><span class="sub">${e(title)}</span>${item.url?`<a class="source-inline" href="${e(item.url)}" target="_blank" rel="noreferrer">${t('officialMatter')} ↗</a>`:''}</td><td><span class="status-pill status-${tone}">${e(status)}</span><span class="process-mini" title="${e(`${legislationSteps[lang][phase]} · ${phase+1}/7`)}"><span style="width:${percent(phase+1,7)}%"></span></span><span class="sub">${e(legislationSteps[lang][phase])} · ${phase+1}/7</span></td><td class="date"><time datetime="${e(updated)}">${fmtDate(updated)}</time></td><td>${item.voteIds.length}</td><td>${item.amendmentCount}</td></tr>`}).join('');
  const redraw=()=>{filtered=applyCollection(filterAndSortLegislation(filterAIItems('legislation',data.legislation),controls),extra,config,lang);state.legislation=Math.max(1,Math.min(state.legislation,Math.ceil(filtered.length/PAGE.legislation)||1));const shown=pageSlice(filtered,state.legislation,PAGE.legislation);$('[data-legislation-list]').innerHTML=filtered.length?table([t('matter'),lang==='sv'?'Status och skede':'Tila ja vaihe',t('updated'),t('votes'),lang==='sv'?'Ändringar':'Muutokset'],renderRows(shown)):`<div class="empty">${t('noData')}</div>`;root.querySelectorAll('[data-legislation-list] tbody tr').forEach((row,index)=>row.querySelector('td:first-child .sub')?.insertAdjacentHTML('afterend',`${topicTags(shown[index])}${aiTagBadges('legislation',shown[index],lang)}${committeeTags(shown[index])}`));$('[data-legislation-count]').textContent=lang==='sv'?`${filtered.length.toLocaleString('sv-FI')} ärenden`:`${filtered.length.toLocaleString('fi-FI')} asiaa`;$('[data-legislation-more]').innerHTML=pagination('legislation',filtered.length);bindPagination('legislation',redraw)};
  root.innerHTML=`<div class="page legislation-page">${header(t('parliament'),t('legislation'),lang==='sv'?'Se vilka förslag som behandlas, var i processen de befinner sig och hur riksdagen har beslutat.':'Näe, mitä ehdotuksia käsitellään, missä vaiheessa ne ovat ja miten eduskunta on päättänyt.')}<div class="legislation-stats"><div class="status-ongoing"><strong>${counts.ongoing||0}</strong><span>${legislationToneLabel('ongoing')}</span></div><div class="status-approved"><strong>${(counts.approved||0)+(counts.changed||0)}</strong><span>${legislationToneLabel('approved')}</span></div><div class="status-rejected"><strong>${counts.rejected||0}</strong><span>${legislationToneLabel('rejected')}</span></div><div><strong>${data.legislation.length}</strong><span>${lang==='sv'?'Alla ärenden':'Kaikki asiat'}</span></div></div><details class="process-guide"><summary>${lang==='sv'?'Hur blir ett lagförslag lag?':'Miten lakiehdotus etenee?'}</summary><ol>${legislationSteps[lang].map((step,index)=>`<li><span>${index+1}</span><div><strong>${e(step)}</strong><p>${e(legislationStepNotes[lang][index])}</p></div></li>`).join('')}</ol></details><div class="filters legislation-controls"><input data-legislation-filter aria-label="${e(t('searchLaws'))}" placeholder="${e(t('searchLaws'))}"><label class="filter-control"><span>${lang==='sv'?'Status':'Tila'}</span><select data-legislation-status><option value="all">${lang==='sv'?'Alla statusar':'Kaikki tilat'}</option>${['ongoing','approved','changed','rejected','withdrawn','expired','closed'].map(tone=>`<option value="__${tone}__">${e(legislationToneLabel(tone))}</option>`).join('')}</select></label><label class="filter-control"><span>${lang==='sv'?'Ärendetyp':'Asiatyyppi'}</span><select data-legislation-type><option value="all">${lang==='sv'?'Alla typer':'Kaikki tyypit'}</option>${types.map(type=>`<option value="${e(type)}">${e(matterTypeNames[type]?.[lang]||matterTypeNames[type]?.fi||type)} (${e(type)})</option>`).join('')}</select></label></div><p class="filter-summary" data-legislation-count aria-live="polite"></p><div data-legislation-list></div><div data-legislation-more></div></div>`;
  $('.legislation-controls').insertAdjacentHTML('beforeend',`<label class="filter-control"><span>${lang==='sv'?'Ämne':'Aihealue'}</span><select data-legislation-topic>${topicOptionsHTML(controls.topic)}</select></label><label class="filter-control"><span>${lang==='sv'?'Utskott':'Valiokunta'}</span><select data-legislation-committee><option value="all">${lang==='sv'?'Alla utskott':'Kaikki valiokunnat'}</option>${committees.map(([value,label])=>`<option value="${e(value)}">${e(label)}</option>`).join('')}</select></label>`);
  $('[data-legislation-count]').insertAdjacentHTML('afterend',`<div class="data-actions">${exportButtons('legislation',lang)}</div>`);
  $('[data-legislation-filter]').oninput=event=>{controls.query=event.target.value;state.legislation=1;redraw()};
  $('[data-legislation-status]').onchange=event=>{controls.status=event.target.value;state.legislation=1;redraw()};
  $('[data-legislation-type]').onchange=event=>{controls.type=event.target.value;state.legislation=1;redraw()};
  $('[data-legislation-topic]').onchange=event=>{controls.topic=event.target.value;state.legislation=1;redraw()};
  $('[data-legislation-committee]').onchange=event=>{controls.committee=event.target.value;state.legislation=1;redraw()};
  addTools(root.querySelector('[data-legislation-count]'),'legislation',extra,config,()=>{state.legislation=1;redraw()});
  bindExportButtons(root,'legislation',()=>filtered.map(item=>({document:lang==='sv'&&item.documentSv||item.document,title:lang==='sv'&&item.titleSv||item.title,type:legislationMatterType(item),topics:policyTopicKeys(item).map(key=>policyTopicLabel(key,lang)),committees:(item.committees||[]).map(committee=>lang==='sv'?committee.nameSv||committee.name:committee.name||committee.nameSv),status:lang==='sv'&&item.decisionSv||item.decision,firstDate:item.firstDate,latestDate:item.latestDate,votes:item.voteIds.length,amendments:item.amendmentCount,officialUrl:item.url})),'vahtikissa-lakiasiat');redraw();
}


function parties(id){if(id){const p=data.parties.find(x=>x.code===id);if(!p)return notFound();const ms=data.members.filter(m=>m.party===id);return `<div class="page">${header(lang==='sv'?'Riksdagsgrupp':'Eduskuntaryhmä',titleFor(id))}<div class="detail-grid"><div>${table([t('members'),t('participation'),t('partyLine'),t('speeches')],memberRows(ms))}</div><aside class="aside"><h2>${lang==='sv'?'Gruppstatistik':'Ryhmäluvut'}</h2><dl><dt>${t('participation')}</dt><dd>${p.stats.participation}%</dd><dt>${t('votes')}</dt><dd>${p.stats.votes.toLocaleString(lang)}</dd><dt>${t('speeches')}</dt><dd>${p.stats.speeches.toLocaleString(lang)}</dd></dl></aside></div></div>`}return `<div class="page parties-page">${header(t('parliament'),t('parties'))}<div class="cards">${data.parties.map(p=>`<a class="card" href="${href('parties',p.code)}"><span class="pill">${e(p.code.toUpperCase())}</span><h3>${e(titleFor(p.code))}</h3><div class="big">${p.stats.participation}%</div></a>`).join('')}</div></div>`}
function sessions(id){
  if(id){
    const session=data.sessions.find(item=>item.id===id);if(!session)return notFound();
    const ids=new Set(session.voteIds),votes=data.votes.filter(vote=>ids.has(vote.id));
    const rows=data.speeches.map(speech=>'<tr><td>'+fmtDate(speech.date)+'</td><td><a href="'+href('members',speech.mpId)+'">'+e(memberName(speech))+'</a><span class="sub">'+e(titleFor(speech.party))+'</span></td><td><a href="'+href('speeches',speech.id)+'">'+e(lang==='sv'&&speech.agendaSv||speech.agenda||t('speeches'))+'</a></td></tr>').join('');
    return '<div class="page">'+header(t('sessions'),lang==='sv'&&session.titleSv||session.title,fmtDate(session.date))+'<section class="section"><h2>'+t('votes')+'</h2>'+(votes.length?table([t('day'),t('matter'),t('result')],voteRows(votes)):'<p>'+ui('Istunnossa ei ole kirjattuja nimettyjä äänestyksiä.','Inga namnupprop är registrerade i detta plenum.','No recorded roll-call votes in this session.')+'</p>')+'</section><section class="section session-speeches"><h2>'+t('speeches')+' ('+data.speeches.length+')</h2>'+(rows?table([t('day'),t('members'),t('matter')],rows):'<p>'+t('noData')+'</p>')+'</section></div>';
  }
  return '<div class="page">'+header(t('parliament'),t('sessions'),ui('Istunnot, joissa on julkaistuja äänestyksiä tai puheenvuoroja.','Plenum med publicerade omröstningar eller anföranden.','Sessions with published votes or speeches.'))+'<div class="cards"></div></div>';
}
function about(){
  const fi=lang==='fi';
  const sections=fi?[
    ['Osallistuminen','Osallistumisprosentti = (JAA + EI + TYHJÄÄ) / kaikki edustajalle kirjatut nimetyt äänestykset. POISSA ei kerro poissaolon syytä. Taustalla voi olla esimerkiksi äänestyspari eli pariutuminen, sairausloma, ministeritehtävä tai muu hyväksyttävä este.'],
    ['Ryhmälinja','Ryhmälinja vertaa edustajan JAA-, EI- tai TYHJÄÄ-ääntä oman eduskuntaryhmän saman äänestyksen enemmistövalintaan. Tasatilanteet, poissaolot ja äänestykset ilman selvää ryhmäenemmistöä jätetään laskennan ulkopuolelle. Luku on kuvaileva, ei arvio edustajan työn laadusta.'],
    ['Luokittelut ja puheanalyysi','Aihealueet luokitellaan automaattisesti otsikoiden ja päiväjärjestysasioiden avainsanoista, joten sama asia voi saada useita tunnisteita. Valiokuntatiedot ovat Eduskunnan aineistosta. Puheen pituus on puhetekstin sanamäärä; esiintymistiheys on puheenvuorojen lukumäärä. Muutosehdotus on hakua helpottava heuristinen luokitus eikä oikeudellinen määritelmä.'],
    ['Päivitykset ja virheet','Eduskunnan, Valtiokonttorin, Tilastokeskuksen ja Avoimuusrekisterin tiedoista muodostetaan staattiset tilannekuvat päivittäin. Epäonnistunut synkronointi ei korvaa viimeistä hyväksyttyä aineistoa. Jokainen näkymä näyttää aineiston päivityspäivän.']
  ]:[
    ['Deltagande','Deltagandeprocenten = (JA + NEJ + BLANKT) / alla namnupprop som registrerats för ledamoten. FRÅNVARANDE berättar inte orsaken. Bakgrunden kan vara till exempel kvittning, sjukfrånvaro, ministeruppdrag eller ett annat godtagbart hinder.'],
    ['Grupplinje','Grupplinjen jämför ledamotens JA-, NEJ- eller BLANKT-röst med den vanligaste rösten i den egna riksdagsgruppen. Oavgjorda gruppresultat, frånvaro och omröstningar utan tydlig gruppmajoritet lämnas utanför. Siffran är beskrivande och bedömer inte arbetets kvalitet.'],
    ['Klassificeringar och anförandeanalys','Ämnesområden klassificeras automatiskt med nyckelord i rubriker och dagordningsärenden, så samma ärende kan få flera etiketter. Utskottsuppgifterna kommer från riksdagens data. Anförandets längd är ordmängden och frekvensen är antalet anföranden. Ändringsförslag är en heuristisk sökklassificering, inte en juridisk definition.'],
    ['Uppdateringar och fel','Statiska ögonblicksbilder skapas dagligen av riksdagens, Statskontorets, Statistikcentralens och Öppenhetsregistrets data. En misslyckad synkronisering ersätter inte det senast godkända materialet. Varje vy visar materialets uppdateringsdatum.']
  ];
  return `<div class="page about-page">${header(t('parliament'),t('about'),fi?'Näin tiedot, tunnusluvut ja luokittelut muodostetaan.':'Så här skapas uppgifterna, nyckeltalen och klassificeringarna.')}<p class="lead">${fi?'Vahtikissa on riippumaton, avoimen lähdekoodin palvelu. Se järjestää viranomaisten avointa dataa helpommin tutkittavaan muotoon. Tilastot ovat kuvailevia eivätkä mittaa poliittisen työn laatua.':'Vaktkatt är en oberoende tjänst med öppen källkod. Den ordnar myndigheternas öppna data i en mer lättillgänglig form. Statistiken är beskrivande och mäter inte kvaliteten på det politiska arbetet.'}</p><div class="method-grid">${sections.map(([title,body])=>`<section><h2>${e(title)}</h2><p>${e(body)}</p></section>`).join('')}</div><section class="section source-register"><h2>${fi?'Lähteet ja tarkistaminen':'Källor och verifiering'}</h2><p>${fi?'Äänestyksissä, puheissa ja lakiasioissa näytetään linkki viralliseen lähteeseen aina, kun lähdeaineisto sisältää yksilöivän tunnisteen. Virallinen lähde on ensisijainen, jos palvelun ja lähteen tiedoissa on eroa.':'Omröstningar, anföranden och riksdagsärenden länkas till den officiella källan när källmaterialet innehåller en identifierare. Den officiella källan gäller om uppgifterna skiljer sig åt.'}</p><div class="source-links"><a href="https://api.eduskunta.fi/" target="_blank" rel="noreferrer">${fi?'Eduskunnan avoin data':'Riksdagens öppna data'} ↗</a><a href="https://avoindata.tutkihallintoa.fi/" target="_blank" rel="noreferrer">${fi?'Valtiokonttorin avoin data':'Statskontorets öppna data'} ↗</a><a href="https://pxdata.stat.fi/" target="_blank" rel="noreferrer">${fi?'Tilastokeskus':'Statistikcentralen'} ↗</a><a href="https://www.avoimuusrekisteri.fi/" target="_blank" rel="noreferrer">${fi?'Avoimuusrekisteri':'Öppenhetsregistret'} ↗</a><a href="https://github.com/Savvyboi/vahtikissa" target="_blank" rel="noreferrer">GitHub ↗</a></div></section></div>`
}
function notFound(){return `<div class="page">${header('404',lang==='sv'?'Sidan hittades inte':'Sivua ei löytynyt')}</div>`}
function groupBy(items,key){return items.reduce((out,item)=>((out[key(item)]||=[]).push(item),out),{})}
function decorateLegislationDetail(item){
  const votes=data.votes.filter(vote=>item.voteIds.includes(vote.id));
  root.querySelector('.page-head')?.insertAdjacentHTML('afterend',`<div class="matter-taxonomy">${topicTags(item)}${committeeTags(item)}</div>`);
  const details=root.querySelector('.legislation-detail .aside dl');
  if(details&&(item.committees||[]).length)details.insertAdjacentHTML('afterbegin',`<dt>${lang==='sv'?'Utskott':'Valiokunnat'}</dt><dd>${(item.committees||[]).map(committee=>e(lang==='sv'?committee.nameSv||committee.name:committee.name||committee.nameSv)).join('<br>')}</dd>`);
  decorateTableCollection('matter-votes',votes,voteTools(votes),items=>table([t('day'),t('vote'),t('result')],voteRows(items)),voteExportRows,`vahtikissa-${safeFilename(item.document)}-aanestykset`);
}
function decorateTableCollection(key,items,config,rows,exportRows,filename,limit=null){
  const target=root.querySelector('.table-wrap')||root.querySelector('.legislation-detail-grid section .empty');if(!target)return;
  const extra=toolState(key,config.sorts[0].key,key.includes('members')?'asc':'desc');
  const holder=document.createElement('div'),list=document.createElement('div'),status=document.createElement('p');status.className='filter-summary';status.setAttribute('role','status');
  target.before(holder,status,list);target.remove();holder.insertAdjacentHTML('afterend',`<div class="data-actions">${exportButtons(key,lang)}</div>`);
  let filtered=[];const redraw=()=>{filtered=applyCollection(items,extra,config,lang);const shown=limit?filtered.slice(0,limit):filtered;status.textContent=`${shown.length} / ${filtered.length} ${label('tulosta','resultat')}`;list.innerHTML=shown.length?rows(shown):`<div class="empty">${t('noData')}</div>`};
  mountCollectionTools(holder,key,extra,config,lang,redraw);bindExportButtons(root,key,()=>exportRows(limit?filtered.slice(0,limit):filtered),filename);redraw();
}
function decorateCards(page){
  const target=root.querySelector('.cards');if(!target)return;
  const items=data[page],sessionsPage=page==='sessions';
  const config=sessionsPage?{label:t('sessions'),search:item=>[item.title,item.titleSv,item.id],date:item=>item.date,sorts:[{key:'date',label:t('day'),value:item=>item.date},{key:'votes',label:t('votes'),value:item=>item.voteIds.length},{key:'name',label:t('sessions'),value:item=>(lang==='sv'&&item.titleSv)||item.title}],number:{label:t('votes'),value:item=>item.voteIds.length},facets:[facet('year',label('Vuosi','År'),items,item=>item.year)]}:{label:t('parties'),search:item=>titleFor(item.code),sorts:[{key:'name',label:t('parties'),value:item=>titleFor(item.code)},...[['participation',t('participation')],['votes',t('votes')],['speeches',t('speeches')]].map(([key,label])=>({key,label,value:item=>item.stats[key]}))],facets:[facet('party',t('parties'),items,item=>item.code,titleFor)]};
  const extra=toolState(page,config.sorts[0].key,sessionsPage?'desc':'asc'),holder=document.createElement('div'),status=document.createElement('p');status.setAttribute('role','status');status.className='filter-summary';target.before(holder,status);
  const redraw=()=>{const filtered=applyCollection(items,extra,config,lang);status.textContent=`${filtered.length} ${t(page).toLocaleLowerCase(lang)}`;target.innerHTML=filtered.map(item=>sessionsPage?`<a class="card" href="${href(page,item.id)}"><time class="date" datetime="${e(item.date)}">${fmtDate(item.date)}</time><h2>${e((lang==='sv'&&item.titleSv)||item.title)}</h2><div class="big">${item.voteIds.length}</div><p>${t('votes')} · ${item.speechCount||0} ${t('speechTurns')}</p></a>`:`<a class="card" href="${href(page,item.code)}"><span class="pill">${e(item.code.toUpperCase())}</span><h2>${e(titleFor(item.code))}</h2><div class="big">${item.stats.participation}%</div><p>${t('participation')}</p></a>`).join('')||`<div class="empty">${t('noData')}</div>`};
  mountCollectionTools(holder,page,extra,config,lang,redraw);redraw();
}
function render(position){
  if(!data)return;
  readingView=readingMode(location.search,readingView);
  const sequence=++routeRenderSequence,r=routeFromHash(location.hash),routeKey=location.hash,renderLanguage=lang,view=readingView;
  const current=()=>sequence===routeRenderSequence&&location.hash===routeKey&&lang===renderLanguage&&readingView===view;
  return preservePageScroll(root,async()=>{
  try {
  root.setAttribute('aria-busy','true');
  if(!parliamentLoader.routeReady(r,view))loadingView();
  const [routeData,viewModule]=await Promise.all([parliamentLoader.loadRoute(r,view),loadViewModule(r,view),['votes','legislation','programmes'].includes(r.page)?loadAIInsights():Promise.resolve()]);
  if(!current())return;
  data=routeData;
  applyViewChrome();
  const previousView=root.dataset.route;
  root.dataset.route=location.hash;
  root.setAttribute('aria-busy','true');document.querySelectorAll('.nav a').forEach(a=>{const active=a.dataset.page===r.page;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  if(readingView==='simple'){
    const pending=viewModule.renderSimple(root,{data,lang,route:r,loadSpeechTexts,speechTexts,titleFor});
    if(previousView!==undefined&&previousView!==routeKey)root.focus({preventScroll:true});
    const finish=()=>{if(current()){decorateAI(root,{route:r,data,lang,rerender:render});updateRouteContext(r)}};
    if(pending?.then)return await pending.finally(finish);
    finish();return;
  }
  let html,pending=null;
  if(r.page==='overview')html=overview();else if(r.page==='votes')html=r.id?voteDetail(r.id):null;else if(r.page==='members')html=members(r.id);else if(r.page==='parties')html=parties(r.id);else if(r.page==='speeches')html=null;else if(r.page==='legislation')html=legislation(r.id);else if(r.page==='sessions')html=sessions(r.id);else if(r.page==='programmes')html=null;else if(r.page==='budget')html=null;else if(r.page==='elections')html=null;else if(r.page==='influence')html=null;else if(r.page==='about')html=about();else html=notFound();
  if(r.page==='votes'&&!r.id)voteList();else if(r.page==='speeches')speeches(r.id,{scrollToTarget:position===undefined&&previousView!==routeKey});else if(r.page==='programmes')pending=viewModule.renderProgrammes(root,lang,e);else if(r.page==='budget')pending=viewModule.renderBudget(root,lang,r.id,e);else if(r.page==='elections')pending=viewModule.renderElections(root,lang,e);else if(r.page==='influence')pending=viewModule.renderInfluence(root,lang,e,data.members,r.id);else if(typeof html==='string')root.innerHTML=html;
  if(r.page==='votes'&&r.id&&data.votes.some(vote=>vote.id===r.id))bindVoteFilters(r.id);
  if(r.page==='legislation'&&r.id){const item=data.legislation.find(matter=>matter.id===r.id);if(item)decorateLegislationDetail(item)}
  if(r.page==='overview')decorateTableCollection('overview-votes',data.votes,voteTools(data.votes),items=>table([t('day'),t('matter'),t('result')],voteRows(items)),voteExportRows,'vahtikissa-uusimmat-aanestykset',8);
  if(r.page==='sessions'&&r.id&&data.sessions.find(item=>item.id===r.id)?.voteIds.length){const session=data.sessions.find(item=>item.id===r.id),ids=new Set(session?.voteIds||[]);decorateTableCollection('session-votes',data.votes.filter(vote=>ids.has(vote.id)),voteTools(data.votes.filter(vote=>ids.has(vote.id))),items=>table([t('day'),t('matter'),t('result')],voteRows(items)),voteExportRows,`vahtikissa-istunto-${r.id}`)}
  if(r.page==='parties'&&r.id){const items=data.members.filter(member=>member.party===r.id);decorateTableCollection('party-members',items,memberTools(items),items=>table([t('members'),t('participation'),t('partyLine'),t('speeches')],memberRows(items)),items=>items.map(member=>({id:member.id,name:memberName(member),party:titleFor(member.party),...member.stats})),`vahtikissa-${r.id}-kansanedustajat`)}
  if(['sessions','parties'].includes(r.page)&&!r.id)decorateCards(r.page);
  if(previousView!==undefined&&previousView!==routeKey)root.focus({preventScroll:true});
  if(pending)return await pending.finally(()=>{if(current()){decorateAI(root,{route:r,data,lang,rerender:render});updateRouteContext(r)}});
  decorateAI(root,{route:r,data,lang,rerender:render});
  updateRouteContext(r);
  } catch(error) { if(current()){root.dataset.route=routeKey;loadError(error)} }
  },position);
}
document.addEventListener('click',event=>{if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const link=event.target.closest('a[href^="#/"]');if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;event.preventDefault();if(pushRoute(link.getAttribute('href')))render();if(data)root.focus({preventScroll:true})});
function setupSearch(onOpen=()=>{}){
  const panel=$('.search-panel'),button=$('.search-button'),input=$('#global-search'),results=$('.search-results'),status=$('.search-status');
  let timer,searchVersion=0;
  button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','site-search');panel.id='site-search';
  const clearResults=()=>{results.replaceChildren();status.textContent=''};
  const close=()=>{
    clearTimeout(timer);searchVersion++;
    const restore=panel.contains(document.activeElement);
    panel.hidden=true;button.setAttribute('aria-expanded','false');
    if(restore)button.focus({preventScroll:true});
  };
  const renderResults=async()=>{
    const request=++searchVersion,query=input.value.trim(),searchLanguage=lang;
    const current=()=>request===searchVersion&&!panel.hidden&&query===input.value.trim()&&lang===searchLanguage;
    if(!query){clearResults();return}
    if(!data){
      results.replaceChildren();
      status.textContent=lastLoadError?ui('Haku on käytettävissä, kun tiedot on ladattu.','Sökningen blir tillgänglig när uppgifterna har laddats.','Search will be available once the data has loaded.'):t('loading');
      return;
    }
    const members=data.members.filter(member=>memberMatchesQuery(member,query,partyNames)).slice(0,5);
    const votes=filterItems(data.votes,query,localizedSearchFields(['title','question','document'])).slice(0,5);
    const rows=[...members.map(item=>({href:href('members',item.id),title:memberName(item),type:t('members')})),...votes.map(item=>({href:href('votes',item.id),title:voteText(item,'title')||voteText(item,'question'),type:t('votes')}))];
    const showRows=(items,note='')=>{
      status.textContent=ui('Näytetään '+items.length+' tulosta',items.length+' resultat visas',items.length+' results shown')+(note?' · '+note:'');
      preserveFocus(results,()=>{
        results.innerHTML=items.length?`<ul>${items.map(row=>`<li><a href="${row.href}"><strong>${e(row.title)}</strong><span>${e(row.type)}</span></a></li>`).join('')}</ul>`:note?'':`<p class="empty">${t('noData')}</p>`;
      });
    };
    // MP and vote matches are already local; speech loading must not hold them back.
    showRows(rows,ui('Ladataan puheiden hakuindeksi…','Sökindexet laddas…','Loading the speech search index…'));
    try{
      await loadSpeechSearchIndex();
      if(!current())return;
      const allSpeeches=await parliamentLoader.loadSpeeches();
      if(!current())return;
      const speeches=searchSpeeches(allSpeeches,query,speechSearchTexts).slice(0,10);
      showRows([...rows,...speeches.map(item=>({href:href('speeches',item.id),title:(lang==='sv'&&item.agendaSv)||item.agenda,type:t('speeches')}))]);
    }catch{
      if(!current())return;
      showRows(rows,ui('Puheiden haku ei ole käytettävissä. Yritä uudelleen.','Sökning i anföranden är inte tillgänglig. Försök igen.','Speech search is unavailable. Please try again.'));
    }
  };
  const open=()=>{clearTimeout(timer);onOpen();panel.hidden=false;button.setAttribute('aria-expanded','true');input.focus({preventScroll:true});renderResults()};
  input.oninput=()=>{clearTimeout(timer);searchVersion++;clearResults();timer=setTimeout(renderResults,250)};
  button.onclick=()=>panel.hidden?open():close();$('.search-close').onclick=close;
  panel.onclick=event=>event.stopPropagation();
  document.addEventListener('click',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!button.contains(event.target))close()});
  document.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();open()}
    if(event.key==='Escape'&&!panel.hidden){close();button.focus({preventScroll:true})}
  });
  results.onclick=event=>{if(event.target.closest('a'))close()};
  return close;
}
function setup(){
  const menu=$('.menu-button'),nav=$('.nav');
  const closeMenu=(restore=false)=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label',ui('Avaa valikko','Öppna meny','Open menu'));menu.textContent=t('menu');document.body.classList.remove('menu-open');if(restore)menu.focus({preventScroll:true})};
  trackScrollHistory();
  setupBackToTop(document.querySelector('.back-to-top'),root);
  new ResizeObserver(()=>document.documentElement.style.setProperty('--site-header-height',document.querySelector('.site-header').offsetHeight+'px')).observe(document.querySelector('.site-header'));
  if(readingView==='simple'&&!new URLSearchParams(location.search).has('view'))history.replaceState(history.state,'',readingModeURL(location.href,readingView));
  applyChrome();applyViewChrome();applyLocalizedExtras();applyTheme();const closeSearch=setupSearch(()=>closeMenu());
  $('.view-toggle').onclick=()=>{closeSearch();closeMenu();setReadingView(readingView==='simple'?'full':'simple')};
  root.addEventListener('click',event=>{if(event.target.closest('[data-full-view]')){closeSearch();closeMenu();setReadingView('full');root.focus({preventScroll:true})}});
  $('.language-select').onchange=event=>{lang=event.target.value;preferences.set('vahtikissa-lang',lang);applyChrome();applyViewChrome();applyLocalizedExtras();closeSearch();closeMenu();if(data)render();else if(lastLoadError)loadError(lastLoadError);else loadingView()};
  $('.theme-select').onchange=event=>{theme=event.target.value;preferences.set('vahtikissa-theme',theme);applyTheme()};
  menu.onclick=()=>{closeSearch();const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',open);menu.setAttribute('aria-label',open?ui('Sulje valikko','Stäng meny','Close menu'):ui('Avaa valikko','Öppna meny','Open menu'));menu.textContent=open?'×':t('menu');document.body.classList.toggle('menu-open',open);if(open)nav.querySelector('a')?.focus({preventScroll:true});else menu.focus({preventScroll:true})};
  document.querySelectorAll('.nav a').forEach(link=>link.onclick=()=>{closeSearch();closeMenu()});
  document.addEventListener('click',event=>{if(!nav.contains(event.target)&&!menu.contains(event.target))closeMenu()});
  document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(nav.classList.contains('open'))closeMenu(true)});
  matchMedia('(max-width:1399px)').addEventListener('change',()=>closeMenu());
  const restoreRoute=()=>{closeMenu();if(root.dataset.route!==location.hash||root.dataset.view!==readingMode(location.search,readingView))render(savedScrollPosition())};
  window.addEventListener('hashchange',restoreRoute);window.addEventListener('popstate',restoreRoute);
  $('.skip').onclick=event=>{event.preventDefault();root.focus({preventScroll:true});root.scrollIntoView({block:'start',behavior:'instant'})};
}
let setupComplete=false,lastLoadError=null;
function loadingView(){root.setAttribute('aria-busy','true');root.innerHTML=`<section class="loading" role="status"><span class="spinner" aria-hidden="true"></span><p>${t('loading')}</p></section>`}
function loadError(error){lastLoadError=error;const timeout=error?.name==='TimeoutError';root.setAttribute('aria-busy','false');root.innerHTML=`<div class="page"><section class="load-error" role="alert"><span class="eyebrow">${ui('Latausvirhe','Laddningsfel','Loading error')}</span><h1>${ui('Tietoja ei voitu ladata','Uppgifterna kunde inte laddas','The data could not be loaded')}</h1><p>${lang==='en'?(timeout?'Loading took too long. Check your connection and try again.':'Check your connection and try again.'):lang==='sv'?(timeout?'Laddningen tog för lång tid. Kontrollera anslutningen och försök igen.':'Kontrollera anslutningen och försök igen.'):(timeout?'Lataus kesti liian kauan. Tarkista verkkoyhteys ja yritä uudelleen.':'Tarkista verkkoyhteys ja yritä uudelleen.')}</p><details><summary>${ui('Tekniset tiedot','Tekniska detaljer','Technical details')}</summary><code>${e(error?.message||'Unknown error')}</code></details><button type="button" data-retry>${ui('Yritä uudelleen','Försök igen','Try again')}</button></section></div>`;root.querySelector('[data-retry]').onclick=boot;if(!$('.search-panel').hidden)$('#global-search').dispatchEvent(new Event('input'));updateRouteContext({page:'overview'})}
async function boot(){const retrying=!!lastLoadError;lastLoadError=null;if(retrying)parliamentLoader.clear();if(!setupComplete){setup();setupComplete=true}applyChrome();applyViewChrome();applyLocalizedExtras();applyTheme();loadingView();try{data=await parliamentLoader.loadCore();applyChrome();applyViewChrome();applyLocalizedExtras();updateFooterTimestamp();await render(savedScrollPosition());if(!$('.search-panel').hidden)$('#global-search').dispatchEvent(new Event('input'))}catch(error){loadError(error)}}boot();
