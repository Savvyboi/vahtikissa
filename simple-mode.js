import { escapeHTML as e, formatDate, policyTopicKeys, policyTopicOptions, voteOutcome, voteAlternatives, choiceLabel, legislationStatusTone, speechParagraphs, parliamentMatterUrl } from './app-utils.js';
import { renderSimpleCivic } from './simple-civic.js';

const states = new Map();
const indexes = new WeakMap();
const PAGE_SIZE = 20;
let renderVersion = 0;
const href = (page, id) => `#/${page}${id == null ? '' : `/${encodeURIComponent(id)}`}`;
const name = member => [member.firstName, member.lastName].filter(Boolean).join(' ');
const stateFor = key => {
  if (!states.has(key)) states.set(key, { query: '', topic: 'all', party: 'all', status: 'all', choice: 'all', page: 1 });
  return states.get(key);
};
const normal = value => String(value || '').toLocaleLowerCase('fi').trim();
const matches = (query, values) => !normal(query) || values.some(value => normal(value).includes(normal(query)));
const original = (item, key, lang) => lang === 'sv' && item[`${key}Sv`] ? item[`${key}Sv`] : item[key] || '';
const newest = items => [...items].sort((a, b) => String(b.latestDate || b.date || '').localeCompare(String(a.latestDate || a.date || '')));
const locale = lang => lang === 'en' ? 'en-GB' : lang === 'sv' ? 'sv-FI' : 'fi-FI';
const englishTopics = {
  'social-health': 'Health and wellbeing', economy: 'Money and taxes', defence: 'Defence and security',
  environment: 'Environment and energy', education: 'Education and culture', justice: 'Justice and rights',
  transport: 'Transport and communication', agriculture: 'Farming and forestry', 'foreign-eu': 'World affairs and the EU',
  governance: 'Government and municipalities', other: 'Other topics'
};

function buildIndex(data) {
  if (indexes.has(data)) return indexes.get(data);
  const index = { votes: new Map(), members: new Map(), parties: new Map() };
  for (const value of data.ballots || []) {
    const ballot = Array.isArray(value) ? { voteId: value[0], mpId: String(value[1]), party: value[2], choice: value[3] } : value;
    if (!index.votes.has(ballot.voteId)) index.votes.set(ballot.voteId, []);
    index.votes.get(ballot.voteId).push(ballot);
    if (!index.members.has(String(ballot.mpId))) index.members.set(String(ballot.mpId), []);
    index.members.get(String(ballot.mpId)).push(ballot);
    if (!index.parties.has(ballot.voteId)) index.parties.set(ballot.voteId, new Map());
    const groups = index.parties.get(ballot.voteId);
    if (!groups.has(ballot.party)) groups.set(ballot.party, { yes: 0, no: 0, abstain: 0, absent: 0, other: 0, total: 0 });
    const tally = groups.get(ballot.party);
    tally[ballot.choice] = (tally[ballot.choice] || 0) + 1;
    tally.total += 1;
  }
  indexes.set(data, index);
  return index;
}

function createView(context) {
  const { data, lang = 'fi', titleFor } = context;
  const ui = (fi, sv, en) => lang === 'en' ? en : lang === 'sv' ? sv : fi;
  const date = value => formatDate(value, locale(lang));
  const number = value => Number(value || 0).toLocaleString(locale(lang));
  const party = code => titleFor ? titleFor(code) : String(code || '').toUpperCase();
  const label = {
    overview: ui('Etusivu', 'Startsida', 'Home'), votes: ui('Äänestykset', 'Omröstningar', 'Votes'),
    members: ui('Kansanedustajat', 'Ledamöter', 'MPs'), speeches: ui('Puheet', 'Anföranden', 'Speeches'),
    legislation: ui('Lakiasiat', 'Riksdagsärenden', 'Parliamentary matters'), sessions: ui('Istunnot', 'Plenum', 'Sessions'),
    parties: ui('Puolueet', 'Partier', 'Parties'), topic: ui('Aihe', 'Ämne', 'Topic'), party: ui('Puolue', 'Parti', 'Party'),
    search: ui('Hae', 'Sök', 'Search'), allTopics: ui('Kaikki aiheet', 'Alla ämnen', 'All topics'),
    allParties: ui('Kaikki puolueet', 'Alla partier', 'All parties'),
    full: ui('Avaa tarkka näkymä', 'Öppna den detaljerade vyn', 'Open detailed view'),
    official: ui('Avaa virallinen lähde', 'Öppna den officiella källan', 'Open official source'),
    yes: ui('JAA', 'JA', 'YES'), no: ui('EI', 'NEJ', 'NO'), abstain: ui('Tyhjää', 'Blankt', 'Abstained'), absent: ui('Poissa', 'Frånvarande', 'Absent')
  };
  const topic = key => lang === 'en' ? englishTopics[key] || key : policyTopicOptions(lang).find(item => item.key === key)?.label || key;
  const topicOptions = () => [['all', label.allTopics], ...policyTopicOptions(lang).map(item => [item.key, topic(item.key)])];
  const partyOptions = () => [['all', label.allParties], ...(data.parties || []).map(item => [item.code, party(item.code)]).sort((a, b) => a[1].localeCompare(b[1], lang))];
  const topicTags = item => {
    const keys = policyTopicKeys(item);
    return keys.length === 1 && keys[0] === 'other' ? '' : `<p class="easy-meta">${keys.map(key => e(topic(key))).join(' · ')}</p>`;
  };
  const fullButton = () => `<button type="button" data-full-view class="easy-link">${e(label.full)} <span aria-hidden="true">↗</span></button>`;
  const source = (url, text = label.official) => url && /^(https?:)?\/\//i.test(url) ? `<a class="easy-link" href="${e(url)}" target="_blank" rel="noreferrer">${e(text)} ↗</a>` : '';
  const languageNote = () => `<p class="easy-note">${ui('Otsikot ja puhetekstit ovat Eduskunnan alkuperäistä aineistoa. Aihemerkit muodostetaan automaattisesti ja voivat olla epätarkkoja.', 'Rubriker och taltexter kommer från riksdagens originalmaterial. Ämnesetiketter skapas automatiskt och kan vara inexakta.', 'Official titles and speech transcripts are shown in their original Finnish. Topic labels are assigned automatically and may be imprecise.')}</p>`;
  const breadcrumb = page => `<nav class="easy-breadcrumb" aria-label="${ui('Murupolku', 'Brödsmulor', 'Breadcrumb')}"><a href="${href('overview')}">${e(label.overview)}</a>${page && page !== 'overview' ? ` <span aria-hidden="true">/</span> <a href="${href(page)}">${e(label[page] || page)}</a>` : ''}</nav>`;
  const header = (page, title, lead, eyebrow = '') => `${breadcrumb(page)}<header class="easy-hero${page === 'overview' ? ' easy-hero-home' : ''}"><p class="easy-eyebrow">${e(eyebrow || ui('Eduskunta selkeästi', 'Riksdagen enkelt', 'Parliament, made clear'))}</p><h1>${e(title)}</h1>${lead ? `<p class="easy-lead">${e(lead)}</p>` : ''}</header>`;
  const empty = () => `<div class="easy-empty"><h3>${ui('Ei osumia tällä haulla', 'Inga träffar för sökningen', 'No matches for this search')}</h3><p>${ui('Kokeile toista sanaa tai poista rajauksia.', 'Prova ett annat ord eller ta bort filter.', 'Try another word or clear the filters.')}</p></div>`;
  const shortened = text => {
    const title = String(text || '').replace(/^Hallituksen esitys eduskunnalle\s+/i, '').replace(/^Regeringens proposition till riksdagen med förslag till\s+/i, '');
    return title ? title[0].toLocaleUpperCase(lang) + title.slice(1) : '';
  };
  const outcome = vote => voteOutcome(vote) === 'tie' ? ui('Yhtä paljon JAA- ja EI-ääniä', 'Lika många JA- och NEJ-röster', 'Equal YES and NO votes')
    : voteOutcome(vote) === 'moreYes' ? ui('Enemmän JAA-ääniä', 'Fler JA-röster', 'More YES votes') : ui('Enemmän EI-ääniä', 'Fler NEJ-röster', 'More NO votes');
  const bar = vote => {
    const keys = ['yes', 'no', 'abstain', 'absent'];
    const total = keys.reduce((sum, key) => sum + Number(vote[key] || 0), 0);
    const description = keys.map(key => `${number(vote[key])} ${label[key]}`).join(', ');
    return `<div class="easy-bar" role="img" aria-label="${e(description)}">${keys.map(key => `<span class="easy-bar-${key}" style="width:${total ? Number(vote[key] || 0) / total * 100 : 0}%"></span>`).join('')}</div><p class="easy-meta easy-vote-counts">${keys.map(key => `<span><strong>${number(vote[key])}</strong> ${e(label[key])}</span>`).join('')}</p>`;
  };
  const status = item => ({
    ongoing: ui('Käsittelyssä', 'Under behandling', 'Being considered'), approved: ui('Hyväksytty', 'Godkänd', 'Approved'),
    changed: ui('Hyväksytty muutettuna', 'Godkänd med ändringar', 'Approved with changes'), rejected: ui('Hylätty', 'Förkastad', 'Rejected'),
    withdrawn: ui('Peruutettu', 'Återtagen', 'Withdrawn'), expired: ui('Rauennut', 'Förfallen', 'Lapsed'), closed: ui('Käsitelty', 'Behandlad', 'Consideration ended')
  }[legislationStatusTone(item)]);
  const index = () => buildIndex(data);
  const voteCard = (vote, partyCode = 'all', memberChoice = '') => {
    const tally = partyCode !== 'all' ? index().parties.get(vote.id)?.get(partyCode) : vote;
    return `<article class="easy-card"><p class="easy-meta"><time datetime="${e(vote.date)}">${e(date(vote.date))}</time> · ${e(original(vote, 'document', lang))}</p><h3><a href="${href('votes', vote.id)}">${e(shortened(original(vote, 'title', lang)) || original(vote, 'question', lang))}</a></h3>${topicTags(vote)}${memberChoice ? `<p><strong>${e(choiceLabel(memberChoice, lang))}</strong> · ${ui('edustajan ääni', 'ledamotens röst', 'MP’s vote')}</p>` : ''}<p class="easy-note">${partyCode !== 'all' ? e(party(partyCode)) : e(outcome(vote))}</p>${tally ? bar(tally) : ''}<a class="easy-link" href="${href('votes', vote.id)}">${ui('Mistä äänestettiin?', 'Vad gällde omröstningen?', 'What was the vote about?')} <span aria-hidden="true">→</span></a></article>`;
  };
  const memberCard = member => `<article class="easy-card easy-member-card"><img class="easy-member-portrait" src="assets/members/${encodeURIComponent(member.id)}.webp" alt="" width="64" height="84" loading="lazy" decoding="async"><div><p class="easy-meta">${e(party(member.party))}</p><h3><a href="${href('members', member.id)}">${e(name(member))}</a></h3><p>${number(member.stats?.speeches)} ${ui('puheenvuoroa aineistossa', 'anföranden i materialet', 'speeches in the data')}</p><a class="easy-link" href="${href('members', member.id)}">${ui('Katso edustajan toiminta', 'Se ledamotens arbete', 'See their activity')} <span aria-hidden="true">→</span></a></div></article>`;
  const speechCard = speech => `<article class="easy-card"><p class="easy-meta"><time datetime="${e(speech.date)}">${e(date(speech.date))}</time> · ${e(party(speech.party))}</p><h3><a href="${href('speeches', speech.id)}">${e(original(speech, 'agenda', lang) || label.speeches)}</a></h3><p><a href="${href('members', speech.mpId)}">${e(name(speech))}</a></p>${topicTags(speech)}<a class="easy-link" href="${href('speeches', speech.id)}">${ui('Lue puhe', 'Läs anförandet', 'Read the speech')} <span aria-hidden="true">→</span></a></article>`;
  const lawCard = item => `<article class="easy-card"><p class="easy-meta">${e(original(item, 'document', lang))} · ${e(date(item.latestDate))}</p><h3><a href="${href('legislation', item.id)}">${e(shortened(original(item, 'title', lang)))}</a></h3>${topicTags(item)}<p><span class="easy-status easy-status-${legislationStatusTone(item)}">${e(status(item))}</span></p><p class="easy-note">${number(item.voteIds?.length)} ${ui('äänestystä tässä aineistossa', 'omröstningar i materialet', 'votes in this dataset')}</p><a class="easy-link" href="${href('legislation', item.id)}">${ui('Miten asia etenee?', 'Hur går ärendet vidare?', 'How is this progressing?')} <span aria-hidden="true">→</span></a></article>`;
  return { data, lang, ui, date, number, party, label, topic, topicOptions, partyOptions, topicTags, fullButton, source, languageNote, header, empty, shortened, outcome, bar, status, index, voteCard, memberCard, speechCard, lawCard };
}
const control = (key, label, options) => ({ key, label, options });

// Keep controls mounted when filtering, so typing never loses keyboard focus.
function mountCollection(parent, view, { key, items, card, filter, controls = [], title = '', note = '', queryLabel, onTopicChange }) {
  const { ui, number, empty } = view;
  const state = stateFor(key);
  const field = item => `<label class="easy-field"><span>${e(item.label)}</span><select data-easy-filter="${e(item.key)}">${item.options.map(([value, label]) => `<option value="${e(value)}"${String(state[item.key]) === String(value) ? ' selected' : ''}>${e(label)}</option>`).join('')}</select></label>`;
  parent.innerHTML = `${title ? `<div class="easy-section-head"><h2>${e(title)}</h2></div>` : ''}${note ? `<p class="easy-note">${e(note)}</p>` : ''}<div class="easy-toolbar"><label class="easy-field easy-search"><span>${e(queryLabel || view.label.search)}</span><input type="search" data-easy-filter="query" value="${e(state.query)}" autocomplete="off"></label>${controls.map(field).join('')}<button type="button" data-easy-clear>${ui('Tyhjennä', 'Rensa', 'Clear')}</button></div><p class="easy-note" data-easy-count role="status" aria-live="polite"></p><div class="easy-results easy-grid" data-easy-results></div><nav class="easy-pagination" data-easy-pagination aria-label="${e(title || queryLabel || view.label.search)}: ${ui('Tulossivut', 'Resultatsidor', 'Result pages')}"></nav>`;
  const results = parent.querySelector('[data-easy-results]');
  const pagination = parent.querySelector('[data-easy-pagination]');
  const redraw = () => {
    const filtered = filter ? items.filter(item => filter(item, state)) : items;
    const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.max(1, Math.min(state.page, pages));
    const start = (state.page - 1) * PAGE_SIZE;
    const shown = filtered.slice(start, start + PAGE_SIZE);
    parent.querySelector('[data-easy-count]').textContent = filtered.length ? `${number(start + 1)}–${number(start + shown.length)} / ${number(filtered.length)} ${ui('tulosta', 'resultat', 'results')}` : ui('0 tulosta', '0 resultat', '0 results');
    results.innerHTML = shown.length ? shown.map(item => card(item, state)).join('') : empty();
    pagination.innerHTML = pages > 1 ? `<button type="button" data-easy-page="${state.page - 1}"${state.page === 1 ? ' disabled' : ''}>← ${ui('Edellinen', 'Föregående', 'Previous')}</button><span>${ui('Sivu', 'Sida', 'Page')} ${number(state.page)} / ${number(pages)}</span><button type="button" data-easy-page="${state.page + 1}"${state.page === pages ? ' disabled' : ''}>${ui('Seuraava', 'Nästa', 'Next')} →</button>` : '';
  };
  parent.querySelectorAll('[data-easy-filter]').forEach(input => input.addEventListener(input.tagName === 'INPUT' ? 'input' : 'change', () => {
    state[input.dataset.easyFilter] = input.value;
    state.page = 1;
    if (input.dataset.easyFilter === 'topic') onTopicChange?.(state.topic);
    redraw();
  }));
  parent.querySelector('[data-easy-clear]').addEventListener('click', () => {
    Object.assign(state, { query: '', topic: 'all', party: 'all', status: 'all', choice: 'all', page: 1 });
    parent.querySelectorAll('[data-easy-filter]').forEach(input => { input.value = state[input.dataset.easyFilter]; });
    onTopicChange?.(state.topic);
    redraw();
  });
  pagination.addEventListener('click', event => {
    const button = event.target.closest('[data-easy-page]');
    if (!button || button.disabled) return;
    const next = Number(button.dataset.easyPage) > state.page;
    state.page = Number(button.dataset.easyPage);
    redraw();
    const replacement = next ? pagination.querySelector('button:last-child') : pagination.querySelector('button:first-child');
    (replacement?.disabled ? pagination.querySelector('button:not(:disabled)') : replacement)?.focus({ preventScroll: true });
  });
  redraw();
}


function overview(root, view) {
  const { data, ui, number, date, topicOptions, voteCard, header } = view;
  const state = stateFor('overview');
  root.innerHTML = `<div class="easy-page">${header('overview', ui('Miten eduskunta vaikuttaa arkeesi?', 'Vad gör riksdagen för din vardag?', 'What does Parliament do for your everyday life?'), ui('Eduskunnassa päätetään yhteisistä asioista. Katso, mistä äänestetään, mitä edustajasi sanoo ja mihin rahaa käytetään.', 'Riksdagen beslutar om våra gemensamma frågor. Se vad ledamöterna röstar om, vad de säger och hur pengar används.', 'Parliament makes decisions that affect us all. See what MPs vote on, what they say and how public money is used.'))}<div class="easy-callout easy-topic-picker"><label class="easy-field"><span>${ui('Mikä aihe kiinnostaa sinua?', 'Vilket ämne intresserar dig?', 'What matters to you?')}</span><select data-easy-home-topic>${topicOptions().map(([key, text]) => `<option value="${e(key)}"${state.topic === key ? ' selected' : ''}>${e(text)}</option>`).join('')}</select></label><div class="easy-choices"><a class="easy-link" data-easy-topic-target="votes" href="${href('votes')}">${ui('Katso äänestykset', 'Se omröstningarna', 'Explore votes')} →</a><a class="easy-link" data-easy-topic-target="legislation" href="${href('legislation')}">${ui('Seuraa lakiasioita', 'Följ riksdagsärenden', 'Follow proposals')} →</a></div></div><section class="easy-section"><div class="easy-stats"><div><strong>${number(data.votes?.length)}</strong><span>${ui('äänestystä', 'omröstningar', 'votes')}</span></div><div><strong>${number(data.speeches?.length)}</strong><span>${ui('puheenvuoroa', 'anföranden', 'speeches')}</span></div><div><strong>${number(data.members?.length)}</strong><span>${ui('edustajaa aineistossa', 'ledamöter i materialet', 'MPs in the data')}</span></div></div><p class="easy-note">${ui('Seuranta', 'Uppföljning sedan', 'Coverage from')} ${e(date(data.metadata?.startDate || '2023-04-02'))}. ${ui('Mukana on myös entisiä edustajia. Aineisto päivitetty', 'Även tidigare ledamöter ingår. Materialet uppdaterat', 'Includes former MPs. Data updated')} ${e(date(data.metadata?.generatedAt))}.</p></section><section class="easy-section"><div class="easy-section-head"><div><p class="easy-eyebrow">${ui('Päätösten äärellä', 'Nära besluten', 'Decisions in focus')}</p><h2>${ui('Mistä äänestettiin viimeksi?', 'Vad röstade riksdagen om senast?', 'What were the latest votes about?')}</h2></div><a class="easy-link" data-easy-topic-target="votes" href="${href('votes')}">${ui('Kaikki äänestykset', 'Alla omröstningar', 'All votes')} →</a></div><div class="easy-grid" data-easy-latest></div><p class="easy-note">${ui('JAA tai EI tarkoittaa aina äänestyksen omaa vaihtoehtoa. Äänimäärä ei yksin kerro, hyväksyttiinkö laki.', 'JA och NEJ syftar alltid på omröstningens egna alternativ. Röstetalet visar inte ensamt om en lag godkändes.', 'YES and NO refer to the alternatives in each vote. Vote totals alone do not tell you whether a law passed.')}</p></section><section class="easy-section"><div class="easy-section-head"><h2>${ui('Mitä haluat tietää?', 'Vad vill du veta?', 'What would you like to find out?')}</h2></div><div class="easy-grid">${[
    ['members', ui('Mitä oma edustajani tekee?', 'Vad gör min ledamot?', 'What does my MP do?'), ui('Hae edustaja nimellä. Katso hänen äänensä ja puheensa.', 'Sök en ledamot med namn. Se röster och anföranden.', 'Find an MP by name and explore their votes and speeches.')],
    ['speeches', ui('Mistä edustajat puhuvat?', 'Vad talar ledamöterna om?', 'What are MPs talking about?'), ui('Etsi puheita aiheen tai puhujan mukaan.', 'Hitta anföranden enligt ämne eller talare.', 'Find speeches by topic or speaker.')],
    ['budget', ui('Mihin yhteiset rahat menevät?', 'Vart går våra gemensamma pengar?', 'Where does public money go?'), ui('Tutustu valtion rahankäyttöön yksi aihe kerrallaan.', 'Utforska statens utgifter ett område i taget.', 'Explore state spending one area at a time.')],
    ['influence', ui('Kuka pyrkii vaikuttamaan?', 'Vem försöker påverka?', 'Who is trying to influence decisions?'), ui('Katso ilmoitetut sidonnaisuudet, lahjat ja lobbaus.', 'Se rapporterade bindningar, gåvor och lobbning.', 'Explore declared interests, gifts and lobbying.')],
    ['legislation', ui('Mitä asioita käsitellään?', 'Vilka ärenden behandlas?', 'What is being considered?'), ui('Seuraa ehdotuksia ja eduskunnan kirjattuja päätöksiä.', 'Följ förslag och riksdagens registrerade beslut.', 'Follow proposals and Parliament’s recorded decisions.')],
    ['parties', ui('Ketkä toimivat yhdessä?', 'Vilka arbetar tillsammans?', 'Who works together?'), ui('Tutustu eduskuntaryhmiin ja niiden edustajiin.', 'Lär känna riksdagsgrupperna och deras ledamöter.', 'Explore parliamentary groups and their MPs.')]
  ].map(([page, title, text]) => `<article class="easy-card"><h3><a href="${href(page)}"${['speeches', 'legislation'].includes(page) ? ` data-easy-topic-target="${page}"` : ''}>${e(title)}</a></h3><p>${e(text)}</p><a class="easy-link" href="${href(page)}"${['speeches', 'legislation'].includes(page) ? ` data-easy-topic-target="${page}"` : ''}>${ui('Tutustu', 'Utforska', 'Explore')} <span aria-hidden="true">→</span></a></article>`).join('')}</div></section><section class="easy-section"><h2>${ui('Tutki lisää', 'Utforska mer', 'Explore more')}</h2><div class="easy-choices"><a href="${href('sessions')}">${ui('Istunnot', 'Plenum', 'Sessions')} →</a><a href="${href('elections')}">${ui('Vaalit 2023', 'Valet 2023', '2023 election')} →</a><a href="${href('programmes')}">${ui('Puolueohjelmat', 'Partiprogram', 'Party programmes')} →</a><a href="${href('about')}">${ui('Tietoa palvelusta', 'Om tjänsten', 'About this service')} →</a></div></section><p class="easy-note">${ui('Haluatko kaikki taulukot ja hakutyökalut?', 'Vill du se alla tabeller och sökverktyg?', 'Want all tables and search tools?')} ${view.fullButton()}</p></div>`;
  const redraw = () => {
    const latest = newest(data.votes || []).filter(vote => state.topic === 'all' || policyTopicKeys(vote).includes(state.topic)).slice(0, 3);
    root.querySelector('[data-easy-latest]').innerHTML = latest.length ? latest.map(vote => voteCard(vote)).join('') : view.empty();
    root.querySelectorAll('[data-easy-topic-target]').forEach(link => {
      link.href = `${href(link.dataset.easyTopicTarget)}?topic=${encodeURIComponent(state.topic)}`;
    });
  };
  root.querySelector('[data-easy-home-topic]').addEventListener('change', event => { state.topic = event.target.value; redraw(); });
  redraw();
}

// Replace this history entry's topic, so returning from a detail keeps the current selection.
function syncTopicURL(root, page, topic) {
  const separator = location.hash.indexOf('?');
  const path = separator < 0 ? location.hash : location.hash.slice(0, separator);
  if (path !== href(page) || root.dataset.view !== 'simple') return;
  const params = new URLSearchParams(separator < 0 ? '' : location.hash.slice(separator + 1));
  params.set('topic', topic);
  const url = new URL(location.href);
  url.hash = `${path}?${params}`;
  history.replaceState(history.state, '', url);
  root.dataset.route = location.hash;
}

function listPage(root, view, page) {
  const { data, ui, label, topicOptions, partyOptions, header, index } = view;
  const commonTopic = control('topic', label.topic, topicOptions());
  const commonParty = control('party', label.party, partyOptions());
  const configs = {
    votes: {
      title: ui('Mistä eduskunta äänestää?', 'Vad röstar riksdagen om?', 'What does Parliament vote on?'),
      lead: ui('Valitse aihe. Avaa äänestys nähdäksesi vaihtoehdot ja jokaisen edustajan äänen.', 'Välj ett ämne. Öppna en omröstning för att se alternativen och varje ledamots röst.', 'Choose a topic. Open a vote to see the alternatives and how each MP voted.'),
      controls: [commonTopic, control('party', ui('Näytä puolueen äänet', 'Visa partiets röster', 'Show a party’s votes'), partyOptions())],
      items: newest(data.votes || []), card: (item, state) => view.voteCard(item, state.party),
      filter: (item, state) => (state.topic === 'all' || policyTopicKeys(item).includes(state.topic)) && (state.party === 'all' || index().parties.get(item.id)?.has(state.party)) && matches(state.query, [item.title, item.titleSv, item.question, item.questionSv, item.document, item.documentSv]),
      queryLabel: ui('Hae aiheella tai asiakirjan numerolla', 'Sök på ämne eller dokumentnummer', 'Search by topic or document number'),
      note: ui('JAA ja EI viittaavat äänestyksen omiin vaihtoehtoihin. Tulos ei yksin kerro lain hyväksymisestä. Puoluevalinta näyttää kyseisen ryhmän äänet.', 'JA och NEJ syftar på omröstningens egna alternativ. Resultatet visar inte ensamt om en lag godkändes. Partivalet visar den gruppens röster.', 'YES and NO refer to the alternatives in that vote. The totals alone do not show whether a law passed. Choose a party to see its recorded votes.')
    },
    speeches: {
      title: ui('Mistä edustajat puhuvat?', 'Vad talar ledamöterna om?', 'What are MPs talking about?'),
      lead: ui('Löydä aihe tai puhuja. Avaa kortti lukeaksesi koko puheen.', 'Hitta ett ämne eller en talare. Öppna kortet för att läsa hela anförandet.', 'Find a topic or speaker. Open a card to read the full speech.'),
      controls: [commonTopic, commonParty], items: newest(data.speeches || []), card: view.speechCard,
      filter: (item, state) => (state.topic === 'all' || policyTopicKeys(item).includes(state.topic)) && (state.party === 'all' || item.party === state.party) && matches(state.query, [item.firstName, item.lastName, name(item), item.agenda, item.agendaSv, item.party, view.party(item.party)]),
      queryLabel: ui('Hae puhujan nimellä tai puheen aiheella', 'Sök på talarens namn eller ämnet', 'Search by speaker’s name or agenda topic'),
      note: ui('Tämä haku etsii puhujien nimistä ja puheiden aiheista. Koko puhetekstin haku löytyy tarkasta näkymästä.', 'Sökningen söker i talarnas namn och ämnen. Sökning i hela taltexten finns i den detaljerade vyn.', 'This search covers speaker names and agenda topics. Full transcript search is available in the detailed view.')
    },
    members: {
      title: ui('Mitä edustajasi tekee?', 'Vad gör din ledamot?', 'What does your MP do?'),
      lead: ui('Etsi kansanedustaja ja katso hänen äänensä ja puheensa. Aineisto sisältää myös entisiä edustajia.', 'Hitta en ledamot och se röster och anföranden. Även tidigare ledamöter ingår i materialet.', 'Find an MP and explore their votes and speeches. The data also includes former MPs.'),
      controls: [commonParty], items: [...(data.members || [])].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, locale(view.lang))), card: view.memberCard,
      filter: (item, state) => (state.party === 'all' || item.party === state.party) && matches(state.query, [name(item), item.party, view.party(item.party)]),
      queryLabel: ui('Hae edustajan nimellä', 'Sök ledamotens namn', 'Search by MP’s name'),
      note: ui('Muotokuvat: Eduskunta. Edustajat on järjestetty sukunimen mukaan.', 'Porträtt: Riksdagen. Ledamöterna är ordnade enligt efternamn.', 'Portraits: Finnish Parliament. MPs are listed by surname.')
    },
    legislation: {
      title: ui('Mitä asioita eduskunnassa käsitellään?', 'Vilka ärenden behandlar riksdagen?', 'What is Parliament considering?'),
      lead: ui('Katso, missä vaiheessa asia on ja onko eduskunta kirjannut päätöksen. Kaikki asiat eivät ole lakiehdotuksia.', 'Se hur långt ärendet har kommit och om riksdagen har registrerat ett beslut. Alla ärenden är inte lagförslag.', 'See how a matter is progressing and whether Parliament has recorded a decision. These include matters other than bills.'),
      controls: [commonTopic, control('status', ui('Asian tila', 'Ärendets status', 'Status'), [['all', ui('Kaikki tilat', 'Alla statusar', 'All statuses')], ...['ongoing', 'approved', 'changed', 'rejected', 'withdrawn', 'expired', 'closed'].map(tone => [tone, view.status({ decision: { ongoing: '', approved: 'Hyväksytty', changed: 'Hyväksytty muutettuna', rejected: 'Hylätty', withdrawn: 'Peruutettu', expired: 'Rauennut', closed: 'Käsitelty' }[tone] })])]), control('party', ui('Puolue mukana äänestyksessä', 'Parti med i omröstningen', 'Party recorded in a linked vote'), partyOptions())],
      items: newest(data.legislation || []), card: view.lawCard,
      filter: (item, state) => (state.topic === 'all' || policyTopicKeys(item).includes(state.topic)) && (state.status === 'all' || legislationStatusTone(item) === state.status) && (state.party === 'all' || (item.voteIds || []).some(id => index().parties.get(id)?.has(state.party))) && matches(state.query, [item.title, item.titleSv, item.document, item.documentSv]),
      queryLabel: ui('Hae aiheella tai asiakirjan numerolla', 'Sök på ämne eller dokumentnummer', 'Search by topic or document number'),
      note: ui('Puoluerajaus näyttää vain asiat, joihin liittyvissä äänestyksissä puolueella on äänimerkintä. Se ei kerro, kuka teki aloitteen.', 'Partifiltret visar bara ärenden där partiet har registrerade röster. Det visar inte vem som lade fram initiativet.', 'The party filter shows matters with a linked voting record for that party. It does not identify who proposed the matter.')
    },
    sessions: {
      title: ui('Mitä istunnoissa tapahtui?', 'Vad hände i plenum?', 'What happened in the sessions?'),
      lead: ui('Näissä täysistunnoissa on aineistoon tallennettuja nimettyjä äänestyksiä.', 'Dessa plenum har namnupprop registrerade i materialet.', 'These plenary sessions have recorded votes in this dataset.'),
      controls: [], items: newest(data.sessions || []),
      card: item => `<article class="easy-card"><p class="easy-meta">${e(view.date(item.date))}</p><h3><a href="${href('sessions', item.id)}">${e(original(item, 'title', view.lang))}</a></h3><p>${view.number(item.voteIds?.length)} ${ui('äänestystä', 'omröstningar', 'votes')}</p><a class="easy-link" href="${href('sessions', item.id)}">${ui('Katso äänestykset', 'Se omröstningarna', 'See the votes')} →</a></article>`,
      filter: (item, state) => matches(state.query, [item.title, item.titleSv, item.id, item.date]), queryLabel: ui('Hae istuntoa tai päivämäärää', 'Sök plenum eller datum', 'Search a session or date')
    },
    parties: {
      title: ui('Ketkä toimivat yhdessä?', 'Vilka arbetar tillsammans?', 'Who works together?'),
      lead: ui('Eduskuntaryhmä kokoaa yhteen saman puolueen edustajia. Avaa ryhmä nähdäksesi sen edustajat.', 'En riksdagsgrupp samlar ledamöter från samma parti. Öppna gruppen för att se dess ledamöter.', 'Parliamentary groups bring MPs together. Open a group to find its MPs.'),
      controls: [], items: [...(data.parties || [])].sort((a, b) => view.party(a.code).localeCompare(view.party(b.code), locale(view.lang))),
      card: item => `<article class="easy-card"><p class="easy-eyebrow">${e(item.code.toUpperCase())}</p><h3><a href="${href('parties', item.code)}">${e(view.party(item.code))}</a></h3><p>${view.number((data.members || []).filter(member => member.party === item.code).length)} ${ui('edustajaa aineistossa', 'ledamöter i materialet', 'MPs in the dataset')}</p><a class="easy-link" href="${href('parties', item.code)}">${ui('Tutustu ryhmään', 'Utforska gruppen', 'Explore the group')} →</a></article>`,
      filter: (item, state) => matches(state.query, [view.party(item.code), item.code]), queryLabel: ui('Hae puoluetta', 'Sök parti', 'Search a party')
    }
  };
  const config = configs[page];
  root.innerHTML = `<div class="easy-page">${header(page, config.title, config.lead)}<section class="easy-section" data-easy-collection></section>${view.languageNote()}<p>${view.fullButton()}</p></div>`;
  mountCollection(root.querySelector('[data-easy-collection]'), view, {
    ...config, key: page,
    onTopicChange: ['votes', 'speeches', 'legislation'].includes(page) ? topic => syncTopicURL(root, page, topic) : undefined
  });
}


function voteDetail(root, view, id) {
  const vote = (view.data.votes || []).find(item => item.id === id);
  if (!vote) return notFound(root, view);
  const { ui, lang, label, header, index, party, bar, source } = view;
  const ballots = index().votes.get(id) || [];
  const alternatives = voteAlternatives(original(vote, 'question', lang), lang === 'sv' ? 'sv' : 'fi');
  const matter = (view.data.legislation || []).find(item => item.id === vote.document || (item.voteIds || []).includes(id));
  root.innerHTML = `<div class="easy-page">${header('votes', view.shortened(original(vote, 'title', lang)), view.date(vote.date), ui('Äänestys', 'Omröstning', 'Vote'))}<section class="easy-callout"><h2>${ui('Mistä äänestettiin?', 'Vad gällde omröstningen?', 'What was the vote about?')}</h2><p>${e(original(vote, 'question', lang) || ui('Vaihtoehtojen kuvaus puuttuu tästä aineistosta.', 'Beskrivningen av alternativen saknas i materialet.', 'The alternatives are not described in this dataset.'))}</p>${alternatives.yes && alternatives.no ? `<dl class="easy-choices"><div><dt>${e(label.yes)}</dt><dd>${e(alternatives.yes)}</dd></div><div><dt>${e(label.no)}</dt><dd>${e(alternatives.no)}</dd></div></dl>` : ''}<p class="easy-note">${alternatives.yes && alternatives.no ? ui('JAA ja EI viittaavat juuri näihin vaihtoehtoihin. EI ei aina tarkoita lain vastustamista.', 'JA och NEJ syftar på just dessa alternativ. NEJ betyder inte alltid att man motsätter sig en lag.', 'YES and NO refer to these specific alternatives. NO does not always mean opposing a law.') : ui('Tässä aineistossa vaihtoehtojen merkitys ei käy kokonaan ilmi. Tarkista se virallisesta lähteestä. JAA tai EI ei aina tarkoita lain kannattamista tai vastustamista.', 'Alternativens betydelse framgår inte helt av materialet. Kontrollera den officiella källan. JA eller NEJ betyder inte alltid stöd eller motstånd mot en lag.', 'The alternatives are not fully explained in this dataset. Check the official source. YES or NO does not always mean supporting or opposing a law.')}</p></section><section class="easy-section"><h2>${e(view.outcome(vote))}</h2>${bar(vote)}<p class="easy-note">${ui('Äänimäärät kuvaavat tätä äänestystä. Asian lopullinen päätös tarkistetaan lakiasian tiedoista tai virallisesta lähteestä.', 'Röstetalen gäller denna omröstning. Kontrollera det slutliga beslutet i ärendets uppgifter eller den officiella källan.', 'These totals describe this vote. Check the parliamentary matter or official source for the final decision.')}</p>${matter ? `<a class="easy-link" href="${href('legislation', matter.id)}">${ui('Katso asia ja sen kirjattu päätös', 'Se ärendet och det registrerade beslutet', 'See the matter and its recorded decision')} →</a>` : ''}</section><section class="easy-section"><div class="easy-section-head"><h2>${ui('Miten puolueet äänestivät?', 'Hur röstade partierna?', 'How did the parties vote?')}</h2></div><div class="easy-grid">${[...(index().parties.get(id) || new Map())].sort((a, b) => b[1].total - a[1].total).map(([code, tally]) => `<article class="easy-card"><h3><a href="${href('parties', code)}">${e(party(code))}</a></h3>${bar(tally)}</article>`).join('')}</div></section><section class="easy-section" data-easy-voters></section><details class="easy-detail"><summary>${ui('Alkuperäinen otsikko ja taustatiedot', 'Originalrubrik och bakgrund', 'Original title and background')}</summary><h2>${e(original(vote, 'title', lang))}</h2><p>${e(original(vote, 'stage', lang))}</p><p>${e(original(vote, 'document', lang))} · ${e(original(vote, 'minutes', lang))}</p><p>${source(vote.documentUrl, ui('Asian viralliset tiedot', 'Ärendets officiella uppgifter', 'Official matter details'))} ${source(vote.resultUrl)}</p></details>${view.languageNote()}<p>${view.fullButton()}</p></div>`;
  const members = new Map((view.data.members || []).map(member => [String(member.id), member]));
  mountCollection(root.querySelector('[data-easy-voters]'), view, {
    key: `vote-${id}`, title: ui('Miten edustajasi äänesti?', 'Hur röstade din ledamot?', 'How did your MP vote?'),
    queryLabel: ui('Hae edustajan nimellä', 'Sök ledamotens namn', 'Search by MP’s name'),
    items: ballots.map(ballot => ({ ...members.get(String(ballot.mpId)), ...ballot })).sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, locale(lang))),
    controls: [control('party', label.party, view.partyOptions()), control('choice', ui('Ääni', 'Röst', 'Vote'), [['all', ui('Kaikki äänet', 'Alla röster', 'All votes')], ...['yes', 'no', 'abstain', 'absent'].map(key => [key, label[key]])])],
    filter: (item, state) => (state.party === 'all' || item.party === state.party) && (state.choice === 'all' || item.choice === state.choice) && matches(state.query, [name(item), party(item.party)]),
    card: item => `<article class="easy-card"><h3><a href="${href('members', item.mpId)}">${e(name(item) || item.mpId)}</a></h3><p class="easy-meta">${e(party(item.party))}</p><p><strong>${e(choiceLabel(item.choice, lang))}</strong></p></article>`
  });
}

function memberDetail(root, view, id) {
  const member = (view.data.members || []).find(item => String(item.id) === id);
  if (!member) return notFound(root, view);
  const { data, ui, number, header, index } = view;
  const ballotMap = new Map((index().members.get(String(id)) || []).map(ballot => [ballot.voteId, ballot.choice]));
  root.innerHTML = `<div class="easy-page">${header('members', name(member), ui('Näin edustaja näkyy tämän palvelun äänestys- ja puheaineistossa.', 'Så syns ledamoten i tjänstens omröstnings- och anförandematerial.', 'This is the MP’s activity in the voting and speech records collected here.'))}<div class="easy-callout easy-member-profile"><img class="easy-member-portrait easy-member-portrait-large" src="assets/members/${encodeURIComponent(id)}.webp" alt="${e(name(member))}" width="112" height="148" decoding="async"><div><p class="easy-eyebrow">${ui('Eduskuntaryhmä aineistossa', 'Riksdagsgrupp i materialet', 'Group recorded in the data')}</p><h2><a href="${href('parties', member.party)}">${e(view.party(member.party))}</a></h2><p class="easy-note">${ui('Kuva: Eduskunta', 'Foto: Riksdagen', 'Photo: Finnish Parliament')}</p></div></div><section class="easy-section"><div class="easy-stats"><div><strong>${number(member.stats?.speeches)}</strong><span>${ui('puheenvuoroa', 'anföranden', 'speeches')}</span></div><div><strong>${number(member.stats?.participation)}%</strong><span>${ui('osallistuminen kirjattuihin äänestyksiin', 'deltagande i registrerade omröstningar', 'participation in recorded votes')}</span></div><div><strong>${number(member.stats?.votes)}</strong><span>${ui('äänimerkintää', 'röstnoteringar', 'voting records')}</span></div></div><p class="easy-note">${ui('Osallistuminen tarkoittaa JAA-, EI- ja TYHJÄÄ-äänten osuutta kaikista edustajan kirjatuista äänistä. Poissaolon syy ei käy ilmi tästä luvusta. Luvut eivät mittaa työn laatua.', 'Deltagande är andelen JA-, NEJ- och BLANKT-röster av ledamotens registrerade röster. Siffran berättar inte orsaken till frånvaro. Siffrorna mäter inte arbetets kvalitet.', 'Participation is the share of YES, NO and abstention records among the MP’s recorded votes. It does not explain absences. These figures do not measure the quality of their work.')}</p></section><section class="easy-section" data-easy-member-votes></section><section class="easy-section" data-easy-member-speeches></section>${view.languageNote()}<p>${view.fullButton()}</p></div>`;
  mountCollection(root.querySelector('[data-easy-member-votes]'), view, {
    key: `member-votes-${id}`, title: ui('Miten hän äänesti?', 'Hur röstade ledamoten?', 'How did they vote?'),
    queryLabel: ui('Hae äänestyksen aihetta', 'Sök omröstningens ämne', 'Search a voting topic'),
    controls: [control('topic', view.label.topic, view.topicOptions())],
    items: newest((data.votes || []).filter(vote => ballotMap.has(vote.id))),
    filter: (item, state) => (state.topic === 'all' || policyTopicKeys(item).includes(state.topic)) && matches(state.query, [item.title, item.titleSv, item.document, item.question]),
    card: item => view.voteCard(item, 'all', ballotMap.get(item.id))
  });
  mountCollection(root.querySelector('[data-easy-member-speeches]'), view, {
    key: `member-speeches-${id}`, title: ui('Mistä hän puhui?', 'Vad talade ledamoten om?', 'What did they speak about?'),
    queryLabel: ui('Hae puheen aihetta', 'Sök anförandets ämne', 'Search an agenda topic'),
    items: newest((data.speeches || []).filter(speech => String(speech.mpId) === id)),
    controls: [control('topic', view.label.topic, view.topicOptions())],
    filter: (item, state) => (state.topic === 'all' || policyTopicKeys(item).includes(state.topic)) && matches(state.query, [item.agenda, item.agendaSv]), card: view.speechCard
  });
}

async function speechDetail(root, view, id, context, current) {
  const speech = (view.data.speeches || []).find(item => item.id === id);
  if (!speech) return notFound(root, view);
  const { ui, lang, header, source } = view;
  const documents = lang === 'sv' && speech.documentsSv?.length ? speech.documentsSv : speech.documents || [];
  root.innerHTML = `<div class="easy-page">${header('speeches', original(speech, 'agenda', lang) || view.label.speeches, view.date(speech.date))}<section class="easy-callout"><h2><a href="${href('members', speech.mpId)}">${e(name(speech))}</a></h2><p><a href="${href('parties', speech.party)}">${e(view.party(speech.party))}</a></p>${view.topicTags(speech)}</section><section class="easy-section"><h2>${ui('Mitä hän sanoi?', 'Vad sade ledamoten?', 'What did they say?')}</h2><p class="easy-note">${ui('Tämä on Eduskunnan julkaisema puheteksti alkuperäisellä kielellä. Tekstiä ei ole lyhennetty tai kirjoitettu uudelleen.', 'Detta är riksdagens publicerade taltext på originalspråket. Texten har inte förkortats eller skrivits om.', 'This is the transcript published by Parliament, in its original language. It has not been shortened or rewritten.')}</p><div class="easy-transcript" data-easy-transcript aria-busy="true"><p role="status">${ui('Puhetekstiä ladataan…', 'Taltexten laddas…', 'Loading the transcript…')}</p></div></section>${documents.length ? `<section class="easy-section"><h2>${ui('Puheeseen liittyvät asiakirjat', 'Dokument som hör till anförandet', 'Documents connected to this speech')}</h2><p>${documents.map(document => source(document.url || parliamentMatterUrl(document.label), document.label || document.name)).filter(Boolean).join(' · ')}</p></section>` : ''}${view.languageNote()}<p>${view.fullButton()}</p></div>`;
  const paint = text => {
    if (!current()) return;
    const transcript = root.querySelector('[data-easy-transcript]');
    if (!transcript) return;
    transcript.setAttribute('aria-busy', 'false');
    transcript.innerHTML = text ? `<blockquote>${speechParagraphs(text).map(paragraph => `<p>${e(paragraph)}</p>`).join('')}</blockquote>` : `<p class="easy-empty">${ui('Puhetekstiä ei ole tässä aineistossa.', 'Taltexten saknas i materialet.', 'The transcript is not available in this dataset.')}</p>`;
  };
  if (context.speechTexts?.[id] || speech.text) return paint(context.speechTexts?.[id] || speech.text);
  try {
    const loaded = typeof context.loadSpeechTexts === 'function' ? await context.loadSpeechTexts([speech]) : {};
    paint(loaded?.[id] || context.speechTexts?.[id]);
  } catch {
    if (!current()) return;
    const transcript = root.querySelector('[data-easy-transcript]');
    transcript.setAttribute('aria-busy', 'false');
    transcript.innerHTML = `<p>${ui('Puhetekstiä ei saatu ladattua. Voit yrittää uudelleen.', 'Taltexten kunde inte laddas. Försök på nytt.', 'The transcript could not be loaded. You can try again.')}</p><button type="button" data-easy-retry>${ui('Yritä uudelleen', 'Försök igen', 'Try again')}</button>`;
    transcript.querySelector('[data-easy-retry]').addEventListener('click', () => speechDetail(root, view, id, context, current), { once: true });
  }
}

function legislationDetail(root, view, id) {
  const item = (view.data.legislation || []).find(matter => matter.id === id);
  if (!item) return notFound(root, view);
  const { ui, lang, header, data } = view;
  const stages = lang === 'sv' && item.stagesSv?.length ? item.stagesSv : item.stages || [];
  const tone = legislationStatusTone(item);
  const decision = original(item, 'decision', lang);
  root.innerHTML = `<div class="easy-page">${header('legislation', view.shortened(original(item, 'title', lang)), original(item, 'document', lang))}<section class="easy-callout"><p class="easy-eyebrow">${ui('Missä mennään?', 'Hur ligger det till?', 'Where does it stand?')}</p><h2>${e(view.status(item))}</h2>${decision ? `<p>${e(decision)}</p>` : `<p>${ui('Aineistossa ei ole vielä kirjattua lopullista päätöstä.', 'Materialet har inget registrerat slutligt beslut ännu.', 'No final decision is recorded in this dataset yet.')}</p>`}${stages.length ? `<p><strong>${ui('Viimeisin kirjattu vaihe', 'Senast registrerade skede', 'Latest recorded stage')}:</strong> ${e(stages.at(-1))}</p>` : ''}<p class="easy-note">${ui('Tieto päivitetty', 'Uppgiften uppdaterad', 'Record updated')} ${e(view.date(item.latestDate))}.</p>${view.source(item.url)}</section><section class="easy-section"><h2>${ui('Mitä tämä tarkoittaa?', 'Vad betyder det?', 'What does this mean?')}</h2><p>${tone === 'ongoing' ? ui('Asia on tämän aineiston mukaan vielä käsittelyssä. Edustajat voivat keskustella siitä ja valiokunta voi valmistella sitä.', 'Enligt materialet är ärendet fortfarande under behandling. Ledamöterna kan debattera det och ett utskott kan bereda det.', 'The record indicates that consideration is ongoing. MPs may debate the matter and a committee may prepare it.') : ui('Asiaan on kirjattu käsittelyn päättävä tieto. Tarkista virallisesta lähteestä päätöksen sisältö ja mahdollinen voimaantulopäivä.', 'En uppgift om avslutad behandling har registrerats. Kontrollera beslutets innehåll och eventuellt ikraftträdande i den officiella källan.', 'The record contains an outcome for this matter. Check the official source for the decision’s contents and any date when legislation takes effect.')}</p><details class="easy-detail"><summary>${ui('Miten lakiehdotus yleensä etenee?', 'Hur går ett lagförslag vanligtvis vidare?', 'How does a bill usually progress?')}</summary><ol><li>${ui('Ehdotus saapuu eduskuntaan.', 'Förslaget kommer till riksdagen.', 'A proposal reaches Parliament.')}</li><li>${ui('Edustajat keskustelevat siitä. Valiokunta kuulee asiantuntijoita ja valmistelee asian.', 'Ledamöterna debatterar förslaget. Ett utskott hör experter och bereder ärendet.', 'MPs debate it. A committee hears experts and prepares the matter.')}</li><li>${ui('Eduskunta päättää lain sisällöstä ja hyväksymisestä.', 'Riksdagen beslutar om lagens innehåll och om den ska godkännas.', 'Parliament decides the bill’s contents and whether to approve it.')}</li></ol><p class="easy-note">${ui('Kaikki valtiopäiväasiat eivät ole lakiehdotuksia. Niiden käsittely voi kulkea eri tavalla.', 'Alla riksdagsärenden är inte lagförslag. De kan behandlas på andra sätt.', 'Not all parliamentary matters are bills. Other types of matter can follow a different process.')}</p></details></section><section class="easy-section" data-easy-law-votes></section><details class="easy-detail"><summary>${ui('Alkuperäinen otsikko ja asian tiedot', 'Originalrubrik och ärendeuppgifter', 'Original title and matter details')}</summary><h2>${e(original(item, 'title', lang))}</h2><p>${ui('Vireille', 'Inkom', 'Introduced')}: ${e(view.date(item.firstDate))}</p>${stages.length ? `<ul>${stages.map(stage => `<li>${e(stage)}</li>`).join('')}</ul>` : ''}${item.committees?.length ? `<h3>${ui('Valiokunnat', 'Utskott', 'Committees')}</h3><ul>${item.committees.map(committee => `<li>${e(lang === 'sv' ? committee.nameSv || committee.name : committee.name || committee.nameSv)}</li>`).join('')}</ul>` : ''}</details>${view.languageNote()}<p>${view.fullButton()}</p></div>`;
  const voteIds = new Set(item.voteIds || []);
  mountCollection(root.querySelector('[data-easy-law-votes]'), view, {
    key: `law-votes-${id}`, title: ui('Asiaan liittyvät äänestykset', 'Omröstningar som hör till ärendet', 'Votes connected to this matter'),
    queryLabel: ui('Hae äänestyksen aihetta', 'Sök omröstningens ämne', 'Search a voting topic'),
    note: ui('Tässä näkyvät aineistoon yhdistetyt nimetyt äänestykset. Tyhjä lista ei tarkoita, ettei asiaa olisi käsitelty.', 'Här visas namnupprop som kopplats till ärendet i materialet. En tom lista betyder inte att ärendet inte behandlats.', 'These are recorded votes linked to this matter in the dataset. An empty list does not mean the matter was never considered.'),
    items: newest((data.votes || []).filter(vote => voteIds.has(vote.id))), card: item => view.voteCard(item),
    filter: (vote, state) => matches(state.query, [vote.title, vote.titleSv, vote.question, vote.questionSv])
  });
}

function groupDetail(root, view, page, id) {
  const { data, ui, header } = view;
  if (page === 'sessions') {
    const session = (data.sessions || []).find(item => item.id === id);
    if (!session) return notFound(root, view);
    const ids = new Set(session.voteIds || []);
    root.innerHTML = `<div class="easy-page">${header(page, original(session, 'title', view.lang), view.date(session.date))}<section class="easy-section" data-easy-group-list></section>${view.languageNote()}<p>${view.fullButton()}</p></div>`;
    mountCollection(root.querySelector('[data-easy-group-list]'), view, { key: `session-${id}`, title: ui('Istunnon äänestykset', 'Omröstningarna i plenum', 'Votes in this session'), items: newest((data.votes || []).filter(vote => ids.has(vote.id))), card: item => view.voteCard(item), controls: [control('topic', view.label.topic, view.topicOptions())], filter: (item, state) => (state.topic === 'all' || policyTopicKeys(item).includes(state.topic)) && matches(state.query, [item.title, item.titleSv, item.document]) });
    return;
  }
  const party = (data.parties || []).find(item => item.code === id);
  if (!party) return notFound(root, view);
  const members = (data.members || []).filter(member => member.party === id);
  root.innerHTML = `<div class="easy-page">${header(page, view.party(id), ui('Tutustu ryhmän edustajiin ja heidän toimintaansa.', 'Lär känna gruppens ledamöter och deras arbete.', 'Meet the group’s MPs and explore their activity.'))}<section class="easy-section"><div class="easy-stats"><div><strong>${view.number(members.length)}</strong><span>${ui('edustajaa aineistossa', 'ledamöter i materialet', 'MPs in the data')}</span></div><div><strong>${view.number(party.stats?.speeches)}</strong><span>${ui('puheenvuoroa', 'anföranden', 'speeches')}</span></div><div><strong>${view.number(party.stats?.participation)}%</strong><span>${ui('osallistuminen kirjattuihin äänestyksiin', 'deltagande i registrerade omröstningar', 'participation in recorded votes')}</span></div></div><p class="easy-note">${ui('Luvut koskevat seuranta-aineistoa ja voivat sisältää entisiä edustajia. Ne eivät mittaa työn laatua.', 'Siffrorna gäller materialet och kan omfatta tidigare ledamöter. De mäter inte arbetets kvalitet.', 'Figures cover the collected data and may include former MPs. They do not measure the quality of work.')}</p></section><section class="easy-section" data-easy-group-list></section><p>${view.fullButton()}</p></div>`;
  mountCollection(root.querySelector('[data-easy-group-list]'), view, { key: `party-${id}`, title: ui('Ryhmän edustajat', 'Gruppens ledamöter', 'MPs in this group'), queryLabel: ui('Hae edustajan nimellä', 'Sök ledamotens namn', 'Search by MP’s name'), items: members.sort((a, b) => a.lastName.localeCompare(b.lastName, locale(view.lang))), card: view.memberCard, filter: (item, state) => matches(state.query, [name(item)]) });
}

function notFound(root, view) {
  root.innerHTML = `<div class="easy-page">${view.header('overview', view.ui('Tietoa ei löytynyt', 'Uppgiften hittades inte', 'Record not found'), view.ui('Linkki voi olla vanhentunut. Palaa etusivulle ja kokeile hakua.', 'Länken kan vara gammal. Gå till startsidan och prova sökningen.', 'The link may be out of date. Go to the home page and try searching.'))}<a class="easy-link" href="${href('overview')}">${view.label.overview} →</a></div>`;
}

export function renderSimple(root, context) {
  const { route, lang = 'fi' } = context;
  const version = ++renderVersion;
  root.dataset.easyRender = String(version);
  if (['budget', 'elections', 'influence', 'programmes', 'about'].includes(route.page)) return renderSimpleCivic(root, context);
  const view = createView(context);
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  if (params.has('topic')) {
    const topic = params.get('topic');
    if (topic === 'all' || policyTopicOptions().some(item => item.key === topic)) {
      const state = stateFor(route.page);
      if (state.topic !== topic) { state.topic = topic; state.page = 1; }
    }
  }
  const hash = location.hash;
  const current = () => root.dataset.easyRender === String(version) && root.dataset.view === 'simple' && location.hash === hash && document.documentElement.lang === lang;
  if (route.page === 'overview') return overview(root, view);
  if (!['votes', 'members', 'speeches', 'legislation', 'sessions', 'parties'].includes(route.page)) return notFound(root, view);
  if (!route.id) return listPage(root, view, route.page);
  if (route.page === 'votes') return voteDetail(root, view, route.id);
  if (route.page === 'members') return memberDetail(root, view, route.id);
  if (route.page === 'speeches') return speechDetail(root, view, route.id, context, current);
  if (route.page === 'legislation') return legislationDetail(root, view, route.id);
  return groupDetail(root, view, route.page, route.id);
}
