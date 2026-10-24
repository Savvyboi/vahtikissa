import { escapeHTML as e } from './app-utils.js';
import { filterInfluence } from './civic-utils.js';
import { collectionState, applyCollection, activeFilterCount } from './collection-tools.js';

// Start of the parliamentary term represented by this collection (official MP terms).
export const TERM_START = '2023-04-05';
const tabs = ['gifts', 'interests', 'lobbying'];
const fields = ['query', 'year', 'mp', 'party', 'actor', 'method', 'category', 'kind', 'period'];
export const influenceText = lang => (fi, sv, en) => lang === 'en' ? en : lang === 'sv' ? sv : fi;
export function influenceSelection(mp = 'all') {
  return { query: '', year: 'all', mp, party: 'all', actor: 'all', method: 'all', category: 'all', kind: 'all', period: 'all', excludedCategories: [] };
}
export function influenceDate(item, tab) {
  if (tab === 'lobbying') return item.period?.end || '';
  if (tab === 'interests') return item.year ? `${item.year}-01-01` : '';
  const parts = String(item.reported || '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return parts ? `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}` : /^\d{4}-\d{2}-\d{2}$/.test(item.reported || '') ? item.reported : '';
}
export function influenceSorts(tab, lang) {
  const L = influenceText(lang);
  return [
    { key: 'date', label: tab === 'lobbying' ? L('Ilmoituskauden loppu', 'Anmälningsperiodens slut', 'Reporting period end') : tab === 'gifts' ? L('Ilmoituspäivä', 'Anmälningsdatum', 'Declaration date') : L('Ilmoitusvuosi', 'Anmälningsår', 'Declaration year'), value: item => influenceDate(item, tab) },
    { key: 'name', label: tab === 'lobbying' ? L('Ilmoittava organisaatio', 'Anmälande organisation', 'Reporting organisation') : L('Kansanedustaja', 'Ledamot', 'MP'), value: item => item.actor || item.mpName },
    ...(tab === 'gifts' ? [
      { key: 'amount', label: L('Lahjan arvo', 'Gåvans värde', 'Gift value'), value: item => item.amount },
      { key: 'donor', label: L('Antaja', 'Givare', 'Donor'), value: item => item.donor }
    ] : tab === 'lobbying' ? [
      { key: 'topic', label: L('Aihe', 'Ämne', 'Topic'), value: item => item.topic },
      { key: 'targets', label: L('Ilmoitettuja vastaanottajia', 'Anmälda mottagare', 'Reported recipients'), value: item => item.targetIds?.length ?? item.targets?.length ?? 0 }
    ] : [{ key: 'category', label: L('Luokka', 'Kategori', 'Category'), value: item => lang === 'sv' ? item.categorySv || item.category : item.category }])
  ];
}
export function influenceConfig(tab, lang) {
  const L = influenceText(lang), sorts = influenceSorts(tab, lang);
  return { sorts, date: sorts[0].value, dateLabel: sorts[0].label,
    search: item => [item.mpName,item.actor,item.donor,item.topic,item.description,item.descriptionSv,item.category,item.categorySv,...(item.mpNames||[])],
    number: tab === 'gifts' ? { label: L('Lahjan arvo (€)', 'Gåvans värde (€)', 'Gift value (€)'), value: item => item.amount } : tab === 'lobbying' ? { label: sorts.at(-1).label, value: sorts.at(-1).value } : null,
    facets: [
      ['year', item => item.year || item.periodYear], ['party', item => item.targetParties || item.party],
      ['mp', item => item.mpNames || item.mpName], ['donor', item => item.donor], ['industry', item => item.industry],
      ['actor', item => item.actor], ['method', item => item.methods], ['kind', item => item.targetKinds || item.targetKind],
      ['type', item => item.type], ['declared', item => String(item.declared)]
    ].map(([key, value]) => ({ key, value })) };
}
export function selectInfluence(items, state, extra, config, tab, lang) {
  const period = state.period || 'all';
  const inPeriod = item => {
    if (period === 'all') return true;
    const end = influenceDate(item, tab), start = tab === 'lobbying' ? item.period?.start || end : end;
    if (!end) return false;
    if (period === 'term') return tab === 'interests' ? Number(item.year) >= Number(TERM_START.slice(0,4)) : end >= TERM_START;
    return end >= `${period}-01-01` && start <= `${period}-12-31`;
  };
  return applyCollection(filterInfluence(items, state).filter(inPeriod), extra, config, lang);
}

// Both reading modes use the same URL schema, including advanced selections.
export function readInfluenceURL(hash, mp = 'all') {
  const params = new URLSearchParams(String(hash).split('?')[1] || '');
  const tab = tabs.includes(params.get('tab')) ? params.get('tab') : mp === 'all' ? 'gifts' : 'interests';
  const state = influenceSelection(mp), extra = collectionState('date', 'desc');
  for (const key of fields) if (params.has(key)) state[key] = params.get(key).slice(0, 2000);
  if (!/^(all|term|\d{4})$/.test(state.period)) state.period = 'all';
  state.excludedCategories = params.getAll('exclude');
  const [sort, direction] = (params.get('order') || 'date:desc').split(':');
  if (influenceSorts(tab, 'fi').some(item => item.key === sort)) extra.sort = sort;
  if (['asc', 'desc'].includes(direction)) extra.direction = direction;
  for (const key of ['from', 'to']) if (/^\d{4}-\d{2}-\d{2}$/.test(params.get(key) || '')) extra[key] = params.get(key);
  for (const key of ['min', 'max']) if (params.has(key) && params.get(key) !== '' && Number.isFinite(Number(params.get(key)))) extra[key] = params.get(key);
  extra.query = params.get('refineQuery') || '';
  try {
    const facets = JSON.parse(params.get('facets') || '{}');
    for (const [key, selection] of Object.entries(facets)) {
      if (!['year', 'party', 'mp', 'donor', 'industry', 'actor', 'method', 'kind', 'type', 'declared'].includes(key)) continue;
      extra.facets[key] = Object.fromEntries(['include', 'exclude'].map(mode => [mode, Array.isArray(selection?.[mode]) ? selection[mode].filter(value => typeof value === 'string') : []]));
    }
  } catch { /* An invalid optional refinement must not prevent opening a shared link. */ }
  return { tab, state, extra };
}
export function influenceHash(hash, tab, state, extra) {
  const params = new URLSearchParams(), defaults = influenceSelection();
  params.set('tab', tab);
  for (const key of fields) if (state[key] != null && state[key] !== defaults[key]) params.set(key, state[key]);
  if (/^#\/influence\/.+/.test(String(hash).split('?')[0])) params.set('mp', state.mp);
  params.set('order', `${extra.sort}:${extra.direction}`);
  for (const key of ['from', 'to', 'min', 'max']) if (extra[key] !== '') params.set(key, extra[key]);
  if (extra.query) params.set('refineQuery', extra.query);
  const facets = Object.fromEntries(Object.entries(extra.facets).filter(([, value]) => value.include?.length || value.exclude?.length));
  if (Object.keys(facets).length) params.set('facets', JSON.stringify(facets));
  for (const category of state.excludedCategories || []) params.append('exclude', category);
  return `${String(hash).split('?')[0]}?${params}`;
}
export function syncInfluenceURL(root, tab, state, extra) {
  const hash = influenceHash(location.hash, tab, state, extra);
  if (hash !== location.hash) history.replaceState(history.state, '', hash);
  root.dataset.route = hash;
}
export function influenceControls(items, state, extra, tab, lang) {
  const L = influenceText(lang), gift = tab === 'gifts';
  const years = [...new Set(items.flatMap(item => {
    const end = influenceDate(item, tab).slice(0, 4), start = tab === 'lobbying' ? item.period?.start?.slice(0, 4) : end;
    return [start, end].filter(Boolean);
  }))];
  if (/^\d{4}$/.test(state.period) && !years.includes(state.period)) years.push(state.period);
  years.sort().reverse();
  const thisYear = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Helsinki' }).format(new Date());
  const orders = [
    ['date:desc', tab === 'lobbying' ? L('Uusimmat ilmoituskaudet ensin', 'Nyaste anmälningsperioder först', 'Newest reporting periods first') : L('Uusimmat ensin', 'Nyaste först', 'Newest first')],
    ...(gift ? [['amount:desc', L('Suurimmat lahjat ensin', 'Största gåvor först', 'Largest gifts first')], ['amount:asc', L('Pienimmät lahjat ensin', 'Minsta gåvor först', 'Smallest gifts first')]] : []),
    ...influenceSorts(tab, lang).filter(sort => sort.key !== 'amount').flatMap(sort => [['asc', L('nouseva', 'stigande', 'ascending')], ['desc', L('laskeva', 'fallande', 'descending')]].filter(([dir]) => !(sort.key === 'date' && dir === 'desc')).map(([dir, label]) => [`${sort.key}:${dir}`, `${sort.label} · ${label}`]))
  ];
  const field = (label, html) => `<label class="filter-control"><span>${e(label)}</span>${html}</label>`;
  const option = (key, label, value) => `<option value="${e(key)}"${String(key) === String(value) ? ' selected' : ''}>${e(label)}</option>`;
  const periodLabel = state.period === 'term' ? L('Vaalikausi 2023–', 'Valperioden 2023–', 'Parliamentary term from 2023') : state.period === 'all' ? L('Kaikki saatavilla olevat tiedot', 'Alla tillgängliga uppgifter', 'All available records') : `${L('Vuosi', 'År', 'Year')} ${state.period}`;
  const orderLabel = orders.find(([key]) => key === `${extra.sort}:${extra.direction}`)?.[1] || '';
  const dates=items.flatMap(item=>tab==='lobbying'?[item.period?.start,item.period?.end]:[influenceDate(item,tab)]).filter(Boolean).sort();
  const coverage=dates.length ? tab==='interests' ? `${dates[0].slice(0,4)}–${dates.at(-1).slice(0,4)}` : `${dates[0]}–${dates.at(-1)}` : L('Ei päivämäärätietoja','Inga datumuppgifter','Dates unavailable');
  const active = fields.filter(key => key !== 'period' && state[key] !== influenceSelection()[key]).length + (state.excludedCategories?.size ?? state.excludedCategories?.length ?? 0) + activeFilterCount(extra);
  return `<div class="influence-common" data-visible-controls>
    ${field(L('Haku', 'Sök', 'Search'), `<input type="search" data-influence-common="query" value="${e(state.query)}" placeholder="${L('Edustaja, aihe tai ilmoittaja', 'Ledamot, ämne eller anmälare', 'MP, topic or organisation')}">`)}
    ${field(tab === 'gifts' ? L('Ajanjakso · ilmoituspäivä', 'Period · anmälningsdatum', 'Period · declaration date') : tab === 'lobbying' ? L('Ilmoituskausi', 'Anmälningsperiod', 'Reporting period') : L('Ilmoitusvuosi', 'Anmälningsår', 'Declaration year'), `<select data-influence-common="period">${option('all', L('Kaikki saatavilla olevat tiedot', 'Alla tillgängliga uppgifter', 'All available records'), state.period)}${option('term', L('Nykyinen vaalikausi · 5.4.2023–', 'Nuvarande valperiod · 5.4.2023–', 'Current parliamentary term · 5 Apr 2023–'), state.period)}${years.map(year => option(year, year === thisYear ? L(`Tämä vuosi (${year})`, `I år (${year})`, `This year (${year})`) : year, state.period)).join('')}</select>`)}
    ${field(L('Järjestys', 'Ordning', 'Order'), `<select data-influence-order>${orders.map(([key, label]) => option(key, label, `${extra.sort}:${extra.direction}`)).join('')}</select>`)}
    ${gift ? field(L('Lahjan vähimmäisarvo (€)', 'Gåvans minimivärde (€)', 'Minimum gift value (€)'), `<input type="number" min="0" step="any" data-influence-min value="${e(extra.min)}">`) : ''}
  </div><p class="influence-selection" role="status">${e(periodLabel)} · ${e(orderLabel)}${state.mp && state.mp !== 'all' ? ` · ${e(state.mp)}` : ''}${extra.min !== '' && gift ? ` · ≥ ${e(extra.min)} €` : ''}${active ? ` · ${active} ${L('lisärajausta', 'ytterligare avgränsningar', 'additional filters')}` : ''}</p>
  <p class="influence-date-note">${gift ? L('Ajanjakso ja uusin järjestys perustuvat ilmoituspäivään, eivät lahjan saantipäivään. Lähteen käyttöaika näytetään erikseen; saantipäivää ei ole erillisenä tietona.', 'Period och nyaste ordning bygger på anmälningsdatum, inte dagen gåvan togs emot. Källans användningstid visas separat; mottagningsdatum finns inte som separat uppgift.', 'Period and newest order use the declaration date, rather than the date a gift was received. The source’s period of use is shown separately; a separate receipt date is unavailable.') : tab === 'lobbying' ? L('Ajanjakso kattaa siihen osuvat ilmoituskaudet. Järjestys käyttää ilmoituskauden loppua. Vastaanottajien määrä ei ole tapaamisten tai vaikutuksen määrä.', 'Perioden omfattar överlappande anmälningsperioder. Ordningen använder periodens slut. Antalet mottagare anger inte antalet möten eller påverkan.', 'The period includes overlapping reporting periods. Ordering uses the reporting period end. Recipient counts do not measure meetings or influence.') : L('Ajanjakso perustuu ilmoitusvuoteen.', 'Perioden bygger på anmälningsåret.', 'The period uses the declaration year.')} <span class="influence-coverage">${L('Aineiston päivämäärät','Materialets datum','Dataset dates')}: ${e(coverage)}.</span></p>`;
}
export function bindInfluenceControls(root, state, extra, onChange) {
  root.querySelectorAll('[data-influence-common]').forEach(input => {
    input.addEventListener(input.type === 'search' ? 'input' : 'change', () => { state[input.dataset.influenceCommon] = input.value; onChange(); });
  });
  root.querySelector('[data-influence-order]').onchange = event => { [extra.sort, extra.direction] = event.target.value.split(':'); onChange(); };
  const min = root.querySelector('[data-influence-min]');
  if (min) min.onchange = () => { extra.min = min.value; onChange(); };
}
export function memberNameLink(item, members, name = item.mpName) {
  const normalize = value => String(value || '').trim().toLocaleLowerCase('fi').replace(/\s+/g, ' ');
  const matches = members.filter(member => String(member.id) === String(item.mpId) || [normalize(`${member.firstName} ${member.lastName}`), normalize(`${member.lastName} ${member.firstName}`)].includes(normalize(name)));
  const member = matches.length === 1 ? matches[0] : null;
  const id = member?.id || item.mpId;
  return id ? `<a class="mp-name-link" href="#/members/${encodeURIComponent(id)}">${e(name)}</a>` : e(name);
}
export function influenceTargetLink(target, members, lang) {
  const details=target[lang]||target.fi||target.sv||{},name=details.name||'';
  const label=target.kind==='mp'?memberNameLink({},members,name):e(name);
  return [label,e(details.title),e(details.department||details.organization)].filter(Boolean).join(' · ');
}
