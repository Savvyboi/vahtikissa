import { escapeHTML as e, fetchJSONWithTimeout } from './app-utils.js';
import { choiceList, control, input, mountFinanceList, select } from './campaign-finance-list.js';
import {
  businessId, campaignRows, campaignStats, candidateDatasets, elections2027, expires2023, financePartyCode,
  helsinkiDate, memberCampaign, normalized, partyBusinessIds, partyDatasets, partyReports, trackerGuidance, trackerRows
} from './campaign-finance-data.js';

const base = '#/elections/funding';
const snapshotUrl = './data/campaign-finance.json';
const registryUrl = 'https://public.api.avoimuusrekisteri.fi/open-data-activity-notification/diary-number/';
const text = lang => (fi, sv, en) => lang === 'en' ? en : lang === 'sv' ? sv : fi;
export const financeTitle = lang => text(lang)('Vaalirahoitus', 'Valfinansiering', 'Campaign finance');

let snapshotPromise;
const loadSnapshot = () => snapshotPromise ||= fetchJSONWithTimeout(snapshotUrl).catch(error => {
  snapshotPromise = null;
  throw error;
});

function copyFor(lang) {
  const L = text(lang);
  const locale = { fi: 'fi-FI', sv: 'sv-FI', en: 'en-IE' }[lang] || 'fi-FI';
  const euros = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const numbers = new Intl.NumberFormat(locale);
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const dates = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Europe/Helsinki' });
  return {
    L,
    money: cents => Number.isFinite(cents) ? euros.format(cents / 100) : '—',
    number: numbers.format,
    share: value => Number.isFinite(value) ? percent.format(value) : '—',
    date: value => value ? dates.format(new Date(value)) : '—',
    expense: L('Kampanjakulut', 'Kampanjkostnader', 'Campaign spending'),
    funding: L('Kampanjarahoitus', 'Kampanjfinansiering', 'Campaign funding'),
    party: L('Puolue', 'Parti', 'Party'),
    district: L('Vaalipiiri', 'Valkrets', 'Constituency'),
    source: L('Avaa VTV:n ilmoitus', 'Öppna revisionsverkets anmälan', 'Open VTV disclosure'),
    showMore: L('Näytä lisää', 'Visa fler', 'Show more'),
    noRows: L('Ei hakua vastaavia tietoja.', 'Inga uppgifter matchar sökningen.', 'No matching records.')
  };
}

const external = (url, label) => `<a href="${e(url)}" target="_blank" rel="noreferrer">${e(label)} ↗</a>`;
const metric = (label, value) => `<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`;
const sortName = (a, b) => a.name.localeCompare(b.name, 'fi');
const amountColumn = (key, label, money) => ({ key, label, direction: 'desc', render: row => e(money(row[key])) });
const numberColumn = (key, label, number) => ({
  key, label, direction: 'desc', render: row => e(row[key] == null ? '—' : number(row[key]))
});

function categories(L) {
  return {
    own: L('Omat varat', 'Egna medel', 'Own funds'),
    loans: L('Lainat', 'Lån', 'Loans'),
    individuals: L('Yksityishenkilöiden tuki', 'Stöd från privatpersoner', 'Individual contributions'),
    companies: L('Yritysten tuki', 'Stöd från företag', 'Company contributions'),
    party: L('Puolueen tuki', 'Stöd från partiet', 'Party contributions'),
    partyAssociations: L('Puolueyhdistysten tuki', 'Stöd från partiföreningar', 'Party association contributions'),
    other: L('Muu', 'Övrigt', 'Other'),
    transferred: L('Siitä välitettyä tukea', 'Varav förmedlat stöd', 'Of which transferred'),
    press: L('Lehtimainonta', 'Tidningsreklam', 'Newspaper and magazine advertising'),
    radio: L('Radio', 'Radio', 'Radio'),
    television: L('Televisio', 'Television', 'Television'),
    online: L('Tietoverkot', 'Datanät', 'Online advertising'),
    otherMedia: L('Muut viestintävälineet', 'Övriga medier', 'Other media'),
    outdoor: L('Ulkomainonta', 'Utomhusreklam', 'Outdoor advertising'),
    print: L('Painettu aineisto', 'Tryckt material', 'Printed material'),
    design: L('Mainonnan suunnittelu', 'Reklamplanering', 'Advertising design'),
    events: L('Vaalitilaisuudet', 'Valmöten', 'Campaign events'),
    fundraising: L('Vastikeellisen tuen hankinta', 'Insamling av stöd mot vederlag', 'Costs of fundraising for consideration')
  };
}

function breakdown(record, ui) {
  const { L, money, expense, funding } = ui;
  const labels = categories(L);
  const list = amounts => Object.entries(amounts).filter(([, cents]) => cents !== null)
    .map(([key, cents]) => metric(labels[key], money(cents))).join('');
  return `<div class="finance-breakdown">
    <div><strong>${funding}</strong><dl>${list(record.fundingSources)}</dl></div>
    <div><strong>${expense}</strong><dl>${list(record.expensesByType)}</dl></div>
  </div>`;
}

function filingDetails(row, ui, showSource = true) {
  const { L, date, source } = ui;
  const dates = [
    row.filed && `${L('Saapunut', 'Inkommen', 'Filed')} ${date(row.filed)}`,
    row.amended && `${L('Täydennetty', 'Kompletterad', 'Amended')} ${date(row.amended)}`
  ].filter(Boolean);
  if (showSource) dates.push(external(row.source, source));
  return `<details class="finance-details"><summary>${L('Ilmoituksen erittely', 'Specifikation', 'Disclosure breakdown')}</summary>
    ${breakdown(row, ui)}
    ${dates.length ? `<p class="finance-meta">${dates.join(' · ')}</p>` : ''}
  </details>`;
}

function candidateDonors(snapshot) {
  if (!Array.isArray(snapshot?.contributions)) return null;
  const byCandidate = new Map();
  for (const row of snapshot.contributions) {
    if (!byCandidate.has(row.candidateKey)) byCandidate.set(row.candidateKey, []);
    byCandidate.get(row.candidateKey).push(row);
  }
  for (const rows of byCandidate.values()) rows.sort((a, b) => b.amount - a.amount || sortName(a, b));
  return byCandidate;
}

function donorList(rows, ui) {
  const { L, money } = ui;
  return `<ul class="finance-donors" role="list">${rows.map(row => `<li>
    <span>${e(row.name)}${row.transferred ? ` <small>${L('Välitetty tuki', 'Förmedlat stöd', 'Transferred contribution')}</small>` : ''}</span>
    <strong>${e(money(row.amount))}</strong>
  </li>`).join('')}</ul>`;
}

function donorContents(rows, ui) {
  const { L } = ui;
  if (!rows) return `<p>${L('Tukijatietoja ei voitu ladata.', 'Uppgifterna om stödgivare kunde inte laddas.', 'Donor details are unavailable.')}</p>`;
  if (!rows.length) return `<p>${L('Ilmoituksessa ei ole nimettyjä tukijoita.', 'Anmälan innehåller inga namngivna stödgivare.', 'The disclosure lists no named donors.')}</p>`;
  return donorList(rows, ui);
}

function donorDetails(rows, ui) {
  const label = ui.L('Näytä tukijat', 'Visa stödgivare', 'Show donors');
  return `<details class="finance-details finance-donor-details"><summary>${label}${rows ? ` (${ui.number(rows.length)})` : ''}</summary>
    ${donorContents(rows, ui)}
  </details>`;
}

function profileDonors(rows, ui) {
  const { L, number } = ui;
  const limit = 3;
  const remainder = (rows?.length || 0) - limit;
  return `<div class="finance-profile-donors"><h3>${L('Ilmoituksessa nimetyt tukijat', 'Namngivna stödgivare', 'Donors named in the disclosure')}</h3>
    ${donorContents(rows?.slice(0, limit), ui)}
    ${remainder > 0 ? `<details class="finance-details finance-donor-details">
      <summary>${L(`Näytä loput ${number(remainder)}`, `Visa övriga ${number(remainder)}`, `Show ${number(remainder)} more`)}</summary>
      ${donorList(rows.slice(limit), ui)}
    </details>` : ''}
  </div>`;
}

function candidateView(host, snapshot, ui, params, members, view) {
  const { L, money, number, expense, funding } = ui;
  const rows = campaignRows(snapshot).toSorted(sortName);
  if (!rows.length) {
    const message = helsinkiDate() >= expires2023
      ? L('Vuoden 2023 ilmoitusten julkaisuaika on päättynyt.', 'Publiceringstiden för anmälningarna från 2023 har löpt ut.', 'The publication period for the 2023 filings has ended.')
      : L('Vuoden 2023 ilmoitusaineisto ei ole saatavilla.', 'Materialet för 2023 är inte tillgängligt.', 'The 2023 filings are currently unavailable.');
    host.innerHTML = `<p>${message}</p><p>${external(candidateDatasets, 'VTV')}</p>`;
    return;
  }

  const all = L('Kaikki', 'Alla', 'All');
  const title = L('Ehdokkaiden ilmoitukset', 'Kandidaternas anmälningar', 'Candidate disclosures');
  const elected = L('Valittu', 'Invald', 'Elected');
  const alternate = L('Varaedustaja', 'Ersättare', 'Alternate');
  const stateLabel = L('Vaalitulos', 'Valresultat', 'Election outcome');
  const votes = L('Ääniä', 'Röster', 'Votes');
  const donorIndex = candidateDonors(snapshot);
  const selected = rows.find(row => row.key === params.get('candidate'));
  const party = params.get('party')?.toUpperCase();
  const sourceStatus = snapshot.sources?.candidates;
  const retrievedAt = sourceStatus ? sourceStatus.updatedAt : snapshot.generatedAt;
  const retainedNote = sourceStatus?.state === 'retained'
    ? L('Näytetään viimeksi saatavilla ollut aineisto.', 'Det senast tillgängliga materialet visas.', 'Showing the last available data.') : '';
  host.innerHTML = `
    <p>${L('Mukana ovat eduskuntavaaleissa 2023 valitut ja varaedustajat. Luvut perustuvat heidän VTV:lle antamiinsa ilmoituksiin.', 'Uppgifterna avser valda kandidater och ersättare i riksdagsvalet 2023 och bygger på deras anmälningar till revisionsverket.', 'The figures come from disclosures filed by elected candidates and alternates in the 2023 parliamentary election.')}</p>
    <dl class="finance-metrics finance-overview" data-finance-overview></dl>
    <div data-candidate-list></div>
    <p class="finance-meta">${external(candidateDatasets, L('VTV:n tietoaineistot', 'Revisionsverkets data', 'VTV datasets'))}
      ${retrievedAt ? ` · ${L('Aineisto haettu', 'Data hämtade', 'Data retrieved')} ${ui.date(retrievedAt)}` : ''}${retainedNote ? ` · ${retainedNote}` : ''}</p>`;
  const overview = host.querySelector('[data-finance-overview]');
  const mpByCandidate = new Map();
  for (const member of members) {
    const record = memberCampaign(rows, member);
    if (record) mpByCandidate.set(record.key, member.id);
  }
  const candidateName = row => {
    const member = mpByCandidate.get(row.key);
    return member ? `<a href="#/members/${encodeURIComponent(member)}">${e(row.name)}</a>` : e(row.name);
  };
  const actions = row => donorDetails(donorIndex ? donorIndex.get(row.key) || [] : null, ui) + filingDetails(row, ui);
  const result = row => row.resultId ? elected : alternate;
  const voteCount = row => row.votes === null ? '—' : number(row.votes);
  const card = row => `<article class="finance-record"><h3>${candidateName(row)}</h3>
    <p class="finance-meta">${e(row.party)} · ${e(row.district)} · ${result(row)}</p>
    <dl class="finance-metrics">${metric(expense, money(row.expenses))}${metric(funding, money(row.funding))}
      ${row.votes !== null ? metric(votes, voteCount(row)) : ''}</dl>
    ${actions(row)}</article>`;
  mountFinanceList(host.querySelector('[data-candidate-list]'), ui, {
    id: 'finance', title, view, card, defaultSort: 'expenses', resultLabel: L('ilmoitusta', 'anmälningar', 'filings'),
    note: L('Tukijalista näyttää VTV:n aineistossa nimetyt tukijat.', 'Listan visar stödgivare som namnges i revisionsverkets material.', 'Donor lists show the names disclosed in VTV’s dataset.'),
    columns: [
      { key: 'name', label: L('Ehdokas', 'Kandidat', 'Candidate'), render: row => `<strong>${candidateName(row)}</strong><p class="finance-meta">${result(row)}</p>${actions(row)}` },
      { key: 'party', label: ui.party }, { key: 'district', label: ui.district },
      amountColumn('expenses', expense, money), amountColumn('funding', funding, money), numberColumn('votes', votes, number)
    ],
    filters: `
      ${control('finance-search', L('Hae ehdokasta', 'Sök kandidat', 'Find a candidate'), input('finance-search', selected?.name))}
      ${control('finance-party', ui.party, select('finance-party', [['', all], ...choiceList(rows.map(row => row.party))], party))}
      ${control('finance-district', ui.district, select('finance-district', [['', all], ...choiceList(rows.map(row => row.district))]))}
      ${control('finance-outcome', stateLabel, select('finance-outcome', [['', all], ['elected', elected], ['alternate', alternate]]))}`,
    rows: ({ 'finance-search': name, 'finance-party': party, 'finance-district': district, 'finance-outcome': outcome }) => {
      const query = normalized(name);
      return rows.filter(row => (!party || row.party === party) && (!district || row.district === district)
        && (!outcome || (outcome === 'elected') === Boolean(row.resultId)) && normalized(row.name).includes(query));
    },
    onFilter: shown => {
      const totals = campaignStats(shown);
      overview.innerHTML = metric(L('Kulujen mediaani', 'Median för utgifter', 'Median spending'), money(totals.medianExpenses)) +
        metric(L('Omien varojen osuus', 'Andel egna medel', 'Own-funds share'), ui.share(totals.ownShare));
    }
  });
}

function trackerView(host, snapshot, ui, view, today = helsinkiDate()) {
  const { L, date, money, expense, funding } = ui;
  const tracker = snapshot?.tracker;
  const advance = L('Ennakkoilmoitus', 'Förhandsanmälan', 'Advance disclosure');
  const final = L('Varsinainen ilmoitus', 'Slutlig anmälan', 'Final disclosure');
  const all = L('Kaikki', 'Alla', 'All');
  const types = {
    advance: L('Vain ennakkoilmoitus', 'Enbart förhandsanmälan', 'Advance only'),
    final: L('Vain varsinainen ilmoitus', 'Enbart slutlig anmälan', 'Final only'),
    both: L('Molemmat ilmoitukset', 'Båda anmälningarna', 'Both disclosures')
  };
  const rows = trackerRows(tracker?.advances, tracker?.finals, today).map(row => {
    const type = row.advance && row.final ? 'both' : row.final ? 'final' : 'advance';
    return { ...row, type, status: types[type], advanceExpenses: row.advance?.expenses, finalExpenses: row.final?.expenses,
      advanceFunding: row.advance?.funding, finalFunding: row.final?.funding };
  }).sort(sortName);
  const status = today < elections2027.advanceStart
    ? L('Vapaaehtoisten ennakkoilmoitusten tekeminen alkaa maaliskuussa.', 'Frivilliga förhandsanmälningar kan lämnas in från mars.', 'Voluntary advance disclosures open in March.')
    : today >= elections2027.expiresFrom
      ? L('Ilmoitusten julkaisuaika on päättynyt.', 'Publiceringstiden för anmälningarna har löpt ut.', 'The disclosure publication period has ended.')
      : L('Aineistossa ei vielä näy ilmoituksia.', 'Materialet innehåller ännu inga anmälningar.', 'No disclosures are available in this dataset yet.');
  host.innerHTML = `<p>${L('Ennakkoilmoitus voi sisältää suunniteltuja tai siihen mennessä toteutuneita summia. Vaaleissa valitut ja varaedustajat tekevät varsinaisen ilmoituksen.', 'En förhandsanmälan kan innehålla planerade belopp eller utfall hittills. Valda kandidater och ersättare lämnar in en slutlig anmälan.', 'An advance disclosure can contain planned figures or spending and funding to date. Elected candidates and alternates file the final disclosure.')}</p>
    <dl class="finance-metrics">
      ${metric(advance, date(elections2027.advanceStart) + ' – ' + date(elections2027.advanceEnd))}
      ${metric(L('Varsinaisen ilmoituksen määräpäivä', 'Sista dagen för slutlig anmälan', 'Final disclosure deadline'), date(elections2027.finalDeadline))}
    </dl>
    <p>${external(trackerGuidance, L('VTV:n ohje ja aikataulu', 'Revisionsverkets anvisningar och tidsplan', 'VTV guidance and schedule'))}</p>
    <div data-tracker-list></div>`;
  const sources = row => [[advance, row.advance], [final, row.final]].filter(([, disclosure]) => disclosure)
    .map(([label, disclosure]) => `<p class="finance-meta">${external(disclosure.source, label)}</p>`).join('');
  mountFinanceList(host.querySelector('[data-tracker-list]'), ui, {
    id: 'finance-tracker', view, title: L('Ehdokkaiden ilmoitukset 2027', 'Kandidaternas anmälningar 2027', '2027 candidate disclosures'),
    resultLabel: L('ehdokasta', 'kandidater', 'candidates'), emptyText: rows.length ? ui.noRows : status,
    columns: [
      { key: 'name', label: L('Ehdokas', 'Kandidat', 'Candidate'), render: row => `<strong>${e(row.name)}</strong>${sources(row)}` },
      { key: 'party', label: ui.party }, { key: 'district', label: ui.district },
      { key: 'status', label: L('Ilmoitukset', 'Anmälningar', 'Disclosures') },
      amountColumn('advanceExpenses', L('Ennakon kulut', 'Kostnader i förhandsanmälan', 'Advance spending'), money),
      amountColumn('advanceFunding', L('Ennakon rahoitus', 'Finansiering i förhandsanmälan', 'Advance funding'), money),
      amountColumn('finalExpenses', L('Varsinaiset kulut', 'Slutliga kostnader', 'Final spending'), money),
      amountColumn('finalFunding', L('Varsinainen rahoitus', 'Slutlig finansiering', 'Final funding'), money)
    ],
    filters: `
      ${control('finance-tracker-search', L('Hae ehdokasta', 'Sök kandidat', 'Find a candidate'), input('finance-tracker-search'))}
      ${control('finance-tracker-party', ui.party, select('finance-tracker-party', [['', all], ...choiceList(rows.map(row => row.party))]))}
      ${control('finance-tracker-district', ui.district, select('finance-tracker-district', [['', all], ...choiceList(rows.map(row => row.district))]))}
      ${control('finance-tracker-type', L('Ilmoitustyyppi', 'Typ av anmälan', 'Disclosure type'), select('finance-tracker-type', [['', all], ...Object.entries(types)]))}`,
    rows: ({ 'finance-tracker-search': name, 'finance-tracker-party': party, 'finance-tracker-district': district, 'finance-tracker-type': type }) => {
      const query = normalized(name);
      return rows.filter(row => (!party || row.party === party) && (!district || row.district === district)
        && (!type || row.type === type) && normalized(row.name).includes(query));
    },
    card: row => `<article class="finance-record"><h3>${e(row.name)}</h3><p class="finance-meta">${e(row.party)} · ${e(row.district)}</p>
      <div class="finance-breakdown">${[[advance, row.advance], [final, row.final]].map(([label, disclosure]) => `<div><h4>${label}</h4>
        ${disclosure ? `<dl>${metric(expense, money(disclosure.expenses))}${metric(funding, money(disclosure.funding))}</dl><p>${external(disclosure.source, ui.source)}</p>`
          : `<p>${L('Ilmoitus puuttuu aineistosta.', 'Anmälan saknas i materialet.', 'No filing in this dataset.')}</p>`}</div>`).join('')}</div></article>`
  });
}

const partyStatementsTitle = L => L('Puolueiden vaalikampanjat 2023', 'Partiernas valkampanjer 2023', 'Party campaigns in 2023');
const partyStatementsNote = L => L('Puolueiden valtakunnallisten organisaatioiden VTV:lle ilmoittamat kulut ja rahoitus.', 'Kostnader och finansiering som partiernas riksorganisationer har anmält till revisionsverket.', 'Spending and funding reported to VTV by the national party organisations.');
const partyStatementsSource = L => external(partyReports, L('VTV:n vaalikohtaiset raportit', 'Revisionsverkets valrapporter', 'VTV election reports'));

function partyStatementCard(row, ui) {
  const { money, expense, funding } = ui;
  return `<article class="finance-record"><h3>${e(row.name)}</h3>
    <dl class="finance-metrics">${metric(expense, money(row.expenses))}${metric(funding, money(row.funding))}</dl>
    <p>${external(row.source, ui.source)}</p></article>`;
}

function partyStatementsMarkup(statements, ui, titleFor) {
  const { L } = ui;
  return `<h2>${partyStatementsTitle(L)}</h2><p class="finance-meta">${partyStatementsNote(L)}</p>
    <div class="finance-list">${statements.map(row => partyStatementCard({ ...row, name: titleFor(row.party) }, ui)).join('')}</div>
    <p>${partyStatementsSource(L)}</p>`;
}

function partyStatementsView(host, statements, ui, view, titleFor) {
  const { L, expense, funding, money } = ui;
  const rows = statements.map(row => ({ ...row, name: titleFor(row.party) })).sort(sortName);
  host.innerHTML = `<div data-party-campaigns></div><p>${partyStatementsSource(L)}</p>`;
  mountFinanceList(host.querySelector('[data-party-campaigns]'), ui, {
    id: 'finance-statements', title: partyStatementsTitle(L), view, note: partyStatementsNote(L), defaultSort: 'expenses',
    resultLabel: L('puoluetta', 'partier', 'parties'), card: row => partyStatementCard(row, ui),
    columns: [
      { key: 'name', label: ui.party, render: row => `<strong>${e(row.name)}</strong><p class="finance-meta">${external(row.source, ui.source)}</p>` },
      amountColumn('expenses', expense, money), amountColumn('funding', funding, money)
    ],
    filters: control('finance-statements-party', ui.party, select('finance-statements-party',
      [['', L('Kaikki puolueet', 'Alla partier', 'All parties')], ...rows.map(row => [row.party, row.name])])),
    rows: ({ 'finance-statements-party': party }) => rows.filter(row => !party || row.party === party)
  });
}

function partyReceiptView(host, snapshot, ui, view, partyId = '') {
  const { L, money, number } = ui;
  const years = snapshot?.years || [];
  const receipts = snapshot?.receipts || [];
  const title = L('Vuosittaiset tuki-ilmoitukset', 'Årliga stödanmälningar', 'Annual contribution disclosures');
  const amountLabel = L('Ilmoitettu tuki', 'Anmält stöd', 'Disclosed contributions');
  const recordLabel = L('Tukirivejä', 'Stödrader', 'Contribution rows');
  const yearLabel = L('Tukivuosi', 'Stödår', 'Contribution year');
  const sourceLabel = L('Avaa lähdetiedosto', 'Öppna källfilen', 'Open source CSV');
  const note = partyId
    ? L('Tässä ovat puolueen valtakunnallisen organisaation ajantasaisissa ilmoituksissa näkyvät tuet.', 'Här visas stöd från riksorganisationens uppdaterade anmälningar.', 'These figures cover contributions in the national party organisation’s up-to-date disclosures.')
    : L('Hae ilmoitettuja tukia saajan mukaan. Mukana ovat puolueet, puolueyhdistykset ja lähiyhteisöt.', 'Sök anmälda stöd efter mottagare. Materialet omfattar partier, partiföreningar och närstående sammanslutningar.', 'Search disclosed contributions by recipient, including parties, party associations and affiliated entities.');
  host.innerHTML = `${years.length ? '<div data-annual-receipts></div>' : `<h2>${title}</h2><p>${L('Tukiaineisto ei ole saatavilla.', 'Stödmaterialet är inte tillgängligt.', 'The contributions dataset is unavailable.')}</p>`}
    <p>${external(partyDatasets, L('VTV:n vuositiedostot', 'Revisionsverkets årsfiler', 'VTV annual datasets'))}</p>`;
  if (!years.length) return;
  mountFinanceList(host.querySelector('[data-annual-receipts]'), ui, {
    id: 'finance-receipt', view, title, note, defaultSort: 'amount', resultLabel: L('vuosikohtaista tietuetta', 'årsvisa poster', 'annual records'),
    columns: [
      { key: 'recipient', label: L('Saaja', 'Mottagare', 'Recipient'), render: row => `<strong>${e(row.recipient)}</strong><p class="finance-meta">${external(row.source, sourceLabel)}</p>` },
      { key: 'year', label: yearLabel, direction: 'desc' }, amountColumn('amount', amountLabel, money), numberColumn('count', recordLabel, number)
    ],
    filters: `
      ${control('finance-receipt-year', yearLabel, select('finance-receipt-year', [['', L('Kaikki vuodet', 'Alla år', 'All years')], ...years.map(year => [year, year])], years[0]))}
      ${partyId ? '' : control('finance-receipt-search', L('Hae saajaa', 'Sök mottagare', 'Find a recipient'), input('finance-receipt-search'))}`,
    rows: ({ 'finance-receipt-year': year, 'finance-receipt-search': search }) => {
      const query = normalized(search);
      return receipts.filter(row => (!year || row.year === Number(year)) && (partyId ? row.id === partyId
        : normalized(row.recipient + ' ' + row.id).includes(query)));
    },
    card: row => `<article class="finance-record"><h3>${e(row.recipient)}</h3><p class="finance-meta">${e(row.year)}</p>
      <dl class="finance-metrics">${metric(amountLabel, money(row.amount))}${metric(recordLabel, number(row.count))}</dl>
      <p>${external(row.source, sourceLabel)}</p></article>`
  });
}

function donationGroups(snapshot) {
  const candidates = new Map(campaignRows(snapshot).map(row => [row.key, row]));
  const organisations = new Map();
  for (const row of snapshot?.contributions || snapshot?.donations || []) {
    const candidate = candidates.get(row.candidateKey);
    if (!row.id || !candidate) continue;
    if (!organisations.has(row.id)) organisations.set(row.id, { id: row.id, name: row.name, cases: [] });
    organisations.get(row.id).cases.push({ ...row, candidate });
  }
  return organisations;
}

async function organisationView(host, snapshot, ui, params, view, current) {
  const { L, money, number } = ui;
  const organisations = donationGroups(snapshot);
  const selected = organisations.get(params.get('org'));
  const all = L('Kaikki', 'Alla', 'All');
  const amountLabel = L('Ilmoitettu kampanjatuki', 'Anmält kampanjstöd', 'Disclosed campaign contributions');
  const countLabel = L('Tukirivejä', 'Stödrader', 'Contribution rows');
  const organisationLink = row => `<a href="${base}/organisations?org=${encodeURIComponent(row.id)}">${e(row.name)}</a>`;
  if (!selected) {
    host.innerHTML = `<p>${L('Vuoden 2023 ilmoituksissa erikseen nimetyt organisaatiot, joilla on Y-tunnus.', 'Organisationer med FO-nummer som anges separat i anmälningarna för 2023.', 'Organisations with Finnish Business IDs itemised in the 2023 candidate disclosures.')}</p>
      ${organisations.size ? '<div data-organisation-list></div>' : `<p>${ui.noRows}</p>`}
      <p>${external(candidateDatasets, 'VTV')}</p>`;
    if (!organisations.size) return;
    const rows = [...organisations.values()].sort(sortName);
    const identifier = L('Y-tunnus', 'FO-nummer', 'Business ID');
    const recipientParty = L('Saajan puolue', 'Mottagarens parti', 'Recipient party');
    mountFinanceList(host.querySelector('[data-organisation-list]'), ui, {
      id: 'finance-org', view, title: L('Tukea ilmoittaneet organisaatiot', 'Organisationer som gett stöd', 'Organisations named as donors'),
      resultLabel: L('organisaatiota', 'organisationer', 'organisations'),
      columns: [
        { key: 'name', label: L('Organisaatio', 'Organisation', 'Organisation'), render: organisationLink },
        { key: 'id', label: identifier }, amountColumn('amount', amountLabel, money), numberColumn('count', countLabel, number)
      ],
      filters: `
        ${control('finance-org-search', L('Hae nimellä tai Y-tunnuksella', 'Sök på namn eller FO-nummer', 'Search by name or Business ID'), input('finance-org-search'))}
        ${control('finance-org-party', recipientParty, select('finance-org-party',
          [['', all], ...choiceList(rows.flatMap(row => row.cases.map(record => record.candidate.party)))]))}`,
      rows: ({ 'finance-org-search': search, 'finance-org-party': party }) => {
        const query = normalized(search);
        return rows.filter(row => normalized(row.name + ' ' + row.id).includes(query)).flatMap(row => {
          const cases = party ? row.cases.filter(record => record.candidate.party === party) : row.cases;
          return cases.length ? [{ ...row, count: cases.length, amount: cases.reduce((total, record) => total + record.amount, 0) }] : [];
        });
      },
      card: row => `<article class="finance-record"><h3>${organisationLink(row)}</h3><p class="finance-meta">${e(row.id)}</p>
        <dl class="finance-metrics">${metric(amountLabel, money(row.amount))}${metric(countLabel, number(row.count))}</dl></article>`
    });
    return;
  }
  host.innerHTML = `<p><a href="${base}/organisations">${L('Kaikki organisaatiot', 'Alla organisationer', 'All organisations')}</a></p>
    <h2>${e(selected.name)}</h2><p class="finance-meta">${e(selected.id)}</p>
    <section data-organisation-contributions></section>
    <section class="finance-lobbying"><div data-finance-lobby><p role="status">${L('Ladataan lobbaustietoja…', 'Laddar uppgifter om lobbning…', 'Loading lobbying records…')}</p></div></section>`;
  const contributions = selected.cases.map(row => ({ ...row, name: row.candidate.name, party: row.candidate.party })).sort(sortName);
  const candidateLink = row => `<a href="${base}?candidate=${encodeURIComponent(row.candidateKey)}">${e(row.name)}</a>`;
  const sourceLink = row => `<p class="finance-meta">${external(row.candidate.source, ui.source)}</p>`;
  const transferred = L('Välitetty tuki', 'Förmedlat stöd', 'Transferred contribution');
  mountFinanceList(host.querySelector('[data-organisation-contributions]'), ui, {
    id: 'finance-org-contributions', view,
    title: L('Ilmoitettu kampanjatuki 2023', 'Anmält kampanjstöd 2023', 'Disclosed campaign contributions in 2023'),
    defaultSort: 'amount', resultLabel: L('tukiriviä', 'stödrader', 'contribution rows'),
    columns: [
      { key: 'name', label: L('Ehdokas', 'Kandidat', 'Candidate'), render: row => candidateLink(row) + sourceLink(row) },
      { key: 'party', label: ui.party },
      { ...amountColumn('amount', amountLabel, money), render: row => e(money(row.amount)) + (row.transferred ? `<p class="finance-meta">${transferred}</p>` : '') }
    ],
    filters: `
      ${control('finance-org-candidate', L('Hae ehdokasta', 'Sök kandidat', 'Find a candidate'), input('finance-org-candidate'))}
      ${control('finance-org-candidate-party', ui.party, select('finance-org-candidate-party', [['', all], ...choiceList(contributions.map(row => row.party))]))}`,
    rows: ({ 'finance-org-candidate': search, 'finance-org-candidate-party': party }) => {
      const query = normalized(search);
      return contributions.filter(row => (!party || row.party === party) && normalized(row.name).includes(query));
    },
    card: row => `<article class="finance-record"><h3>${candidateLink(row)}</h3><p class="finance-meta">${e(row.party)}</p>
      <p><strong>${money(row.amount)}</strong>${row.transferred ? ` · ${transferred}` : ''}</p>${sourceLink(row)}</article>`
  });
  const lobby = host.querySelector('[data-finance-lobby]');
  const lobbyTitle = L('Ilmoitettu lobbaus', 'Anmäld lobbning', 'Reported lobbying');
  try {
    const influence = await fetchJSONWithTimeout('./data/influence.json');
    if (!current()) return;
    const declarations = new Map();
    for (const row of influence.lobbying || []) {
      if (businessId(row.companyId) !== selected.id || !row.diaryNumber) continue;
      if (!declarations.has(row.diaryNumber)) declarations.set(row.diaryNumber, { ...row, topics: new Set() });
      declarations.get(row.diaryNumber).topics.add(row.topic);
    }
    if (!declarations.size) {
      lobby.innerHTML = `<h2>${lobbyTitle}</h2><p>${L('Tällä Y-tunnuksella ei löytynyt eduskuntaan liittyviä ilmoituksia sivuston lobbausaineistosta.', 'Inga anmälningar med detta FO-nummer hittades i webbplatsens material om lobbning riktad mot riksdagen.', 'No Parliament-related records with this Business ID were found in Vahtikissa’s lobbying data.')}</p>`;
      return;
    }
    const rows = [...declarations.values()].map(row => ({
      ...row, topics: [...row.topics].join(' · '), start: row.period?.start || null, end: row.period?.end || null
    }));
    const registerLink = row => external(registryUrl + encodeURIComponent(row.diaryNumber), L('Avaa ilmoitus', 'Öppna anmälan', 'Open register record'));
    mountFinanceList(lobby, ui, {
      id: 'finance-lobby', title: lobbyTitle, view, defaultSort: 'end', resultLabel: L('ilmoitusta', 'anmälningar', 'filings'),
      note: L('Rekisterien tiedot yhdistetään Y-tunnuksella.', 'Registeruppgifterna kopplas samman via FO-numret.', 'Records are linked across registers by Business ID.'),
      columns: [
        { key: 'topics', label: L('Aiheet', 'Ämnen', 'Topics'), render: row => `<p>${e(row.topics)}</p>${registerLink(row)}` },
        { key: 'start', label: L('Jakson alku', 'Periodens början', 'Period start'), direction: 'desc' },
        { key: 'end', label: L('Jakson loppu', 'Periodens slut', 'Period end'), direction: 'desc' }
      ],
      filters: control('finance-lobby-search', L('Hae aihetta tai diaarinumeroa', 'Sök ämne eller diarienummer', 'Find a topic or diary number'), input('finance-lobby-search')),
      rows: ({ 'finance-lobby-search': search }) => {
        const query = normalized(search);
        return rows.filter(row => normalized(row.topics + ' ' + row.diaryNumber).includes(query));
      },
      card: row => `<article class="finance-record"><p class="finance-meta">${e(row.start || '—')} – ${e(row.end || '—')}</p>
        <p>${e(row.topics)}</p><p>${registerLink(row)}</p></article>`
    });
  } catch {
    if (current()) lobby.innerHTML = `<h2>${lobbyTitle}</h2><p>${L('Lobbausaineistoa ei voitu ladata.', 'Lobbningens uppgifter kunde inte laddas.', 'Lobbying data could not be loaded.')}</p>`;
  }
}

export function financeEntry(lang) {
  return `<a class="finance-entry" href="${base}">${financeTitle(lang)} →</a>`;
}

export async function renderCampaignFinance(root, { lang, view, route, current, members, titleFor }) {
  const ui = copyFor(lang), { L } = ui;
  const paths = [
    ['', L('Ehdokkaat 2023', 'Kandidater 2023', '2023 candidates')],
    ['/2027', L('Seuranta 2027', 'Uppföljning 2027', '2027 tracker')],
    ['/organisations', L('Tukijat ja lobbaus', 'Stödgivare och lobbning', 'Organisations and lobbying')],
    ['/parties', L('Puoluerahoitus', 'Partifinansiering', 'Party funding')]
  ];
  const section = route.id.slice('funding'.length);
  const selected = paths.find(([path]) => path === section) || paths[0];
  const params = new URLSearchParams(location.hash.split('?')[1]);
  root.innerHTML = `<div class="${view === 'simple' ? 'easy-page' : 'page'} finance-page">
    <header class="page-head"><div><a href="#/elections">${L('Eduskuntavaalien 2023 tulokset', 'Resultat i riksdagsvalet 2023', '2023 election results')}</a>
    <h1 tabindex="-1">${selected[0] ? selected[1] : financeTitle(lang)}</h1></div></header>
    <nav class="finance-tabs" aria-label="${financeTitle(lang)}">${paths.map(([path, label]) => `<a href="${base + path}"${path === selected[0] ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>
    <div data-finance-content aria-busy="true"><p role="status">${L('Ladataan…', 'Laddar…', 'Loading…')}</p></div>
  </div>`;
  const host = root.querySelector('[data-finance-content]');
  async function paint() {
    host.setAttribute('aria-busy', 'true');
    const retry = host.querySelector('[data-finance-retry]');
    if (retry) retry.disabled = true;
    let snapshot;
    try {
      snapshot = await loadSnapshot();
    } catch {
      if (!current()) return;
      const source = selected[0] === '/2027' ? trackerGuidance : selected[0] === '/parties' ? partyDatasets : candidateDatasets;
      host.innerHTML = `<p role="alert">${L('Vaalirahoitusaineistoa ei voitu ladata.', 'Valfinansieringsmaterialet kunde inte laddas.', 'The campaign finance data could not be loaded.')}</p>
        <button type="button" class="finance-more" data-finance-retry>${L('Yritä uudelleen', 'Försök igen', 'Try again')}</button>
        <p>${external(source, 'VTV')}</p>`;
      const nextRetry = host.querySelector('[data-finance-retry]');
      nextRetry.onclick = paint;
      host.setAttribute('aria-busy', 'false');
      if (retry) nextRetry.focus({ preventScroll: true });
      return;
    }
    if (!current()) return;
    if (selected[0] === '/2027') trackerView(host, snapshot, ui, view);
    else if (selected[0] === '/organisations') await organisationView(host, snapshot, ui, params, view, current);
    else if (selected[0] === '/parties') {
      host.innerHTML = '<section data-party-receipts></section><section data-party-statements></section>';
      partyReceiptView(host.querySelector('[data-party-receipts]'), snapshot, ui, view);
      partyStatementsView(host.querySelector('[data-party-statements]'), snapshot?.statements || [], ui, view, code => partyLabel(code, titleFor));
    } else candidateView(host, snapshot, ui, params, members, view);
    if (!current()) return;
    host.setAttribute('aria-busy', 'false');
    if (retry) host.closest('.finance-page').querySelector('h1').focus({ preventScroll: true });
  }
  await paint();
}

function partyLabel(code, titleFor) {
  return titleFor(({ sdp: 'sd', rkp: 'r', liike: 'liik' })[code] || code);
}

export function mountFinanceProfile(root, { route, lang, members, current, titleFor }) {
  const ui = copyFor(lang), { L, expense, funding, money } = ui;
  const isMember = route.page === 'members';
  const member = isMember ? members.find(row => String(row.id) === route.id) : null;
  const party = isMember ? '' : financePartyCode(route.id);
  const partyId = partyBusinessIds[party];
  const target = isMember ? root.querySelector('.member-sidebar .member-insights,.easy-member-profile + .member-tabs') : root.querySelector('.programme-entry');
  if (!target || (isMember && !member) || (!isMember && !partyId)) return;
  const host = document.createElement('section');
  host.className = 'finance-profile finance-record';
  host.id = isMember ? 'member-finance' : 'party-finance';
  host.tabIndex = -1;
  const profileTitle = isMember ? financeTitle(lang) : L('Puoluerahoitus', 'Partifinansiering', 'Party funding');
  host.innerHTML = `<h2>${profileTitle}</h2><p><a class="finance-entry" href="${base + (isMember ? '' : '/parties')}">${profileTitle} →</a></p>`;
  if (target.matches('.member-insights')) target.before(host);
  else target.after(host);
  loadSnapshot().then(snapshot => {
    if (!current() || !host.isConnected) return;
    if (member) {
      const record = memberCampaign(campaignRows(snapshot), member);
      if (!record) return;
      const donors = candidateDonors(snapshot);
      host.innerHTML = `<h2>${profileTitle}</h2><p class="finance-meta">${L('Eduskuntavaalit', 'Riksdagsvalet', 'Parliamentary election')} ${record.year}</p>
        <dl class="finance-metrics">${metric(expense, money(record.expenses))}${metric(funding, money(record.funding))}</dl>
        ${profileDonors(donors ? donors.get(record.key) || [] : null, ui)}
        ${filingDetails(record, ui, false)}
        <p>${external(record.source, ui.source)}</p>
        <p><a href="${base}?candidate=${encodeURIComponent(record.key)}">${L('Tarkastele vaalirahoitusta', 'Utforska valfinansiering', 'Explore campaign finance')}</a></p>`;
      return;
    }
    host.innerHTML = `<h2>${L('Puoluerahoitus', 'Partifinansiering', 'Party funding')}</h2>
      <details class="finance-details"><summary>${L('Vuosittainen tuki', 'Årligt stöd', 'Annual contributions')}</summary><div data-party-receipts></div></details>
      <details class="finance-details"><summary>${L('Vaalikampanja 2023', 'Valkampanjen 2023', '2023 party campaign')}</summary>
        ${partyStatementsMarkup((snapshot.statements || []).filter(row => row.party === party), ui, () => titleFor(route.id))}
      </details>
      <p><a href="${base}/parties">${L('Katso kaikki puoluerahoituksen tiedot', 'Visa alla uppgifter om partifinansiering', 'Browse all party funding')}</a></p>`;
    partyReceiptView(host.querySelector('[data-party-receipts]'), snapshot, ui, 'simple', partyId);
  }).catch(() => { /* The profile retains its link to the finance view and its source links. */ });
}
