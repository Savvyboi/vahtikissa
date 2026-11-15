export const VTV = 'https://www.vaalirahoitusvalvonta.fi';
export const candidateDatasets = VTV + '/fi/index/vaalirahoitus/haetietoavaalirahoitusilmoituksista/tutkitietoaineistoja.html';
export const partyDatasets = VTV + '/en/frontpage/politicalpartyfunding/searchpoliticalpartyfundingdisclosures/Exploredatasets.html';
export const partyReports = VTV + '/en/frontpage/politicalpartyfunding/searchpoliticalpartyfundingdisclosures/fundingandcontributions.html';
export const trackerGuidance = VTV + '/fi/index/ajankohtaista/eduskuntavaalit2027-namaehdokkaanonmuistettavavaalirahoituksesta.html';
export const elections2027 = { advanceStart: '2027-03-18', advanceEnd: '2027-04-17', finalDeadline: '2027-06-21', limitedFrom: '2027-05-21', expiresFrom: '2032-04-21' };
export const expires2023 = '2028-04-05';

export const partyBusinessIds = {
  sdp: '0117005-2', ps: '1044184-6', kok: '0213498-5', kesk: '0201471-3', vihr: '0771677-3',
  vas: '0802437-3', rkp: '0215325-4', kd: '0215283-3', liike: '2943623-8'
};
export const financePartyCode = code => ({ sd: 'sdp', r: 'rkp', liik: 'liike' }[code] || code);

const finnishDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Helsinki', dateStyle: 'short' });
export const helsinkiDate = (date = new Date()) => finnishDate.format(date);
export const cleanText = value => String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ');
export const normalized = value => cleanText(value).toLocaleLowerCase('fi');

export function memberCampaign(candidates, member) {
  const given = normalized(member.firstName);
  const matches = candidates.filter(row => normalized(row.last) === normalized(member.lastName)
    && (normalized(row.first) === given || normalized(row.first).split(' ').includes(given)));
  return matches.length === 1 ? matches[0] : null;
}

export function businessId(value) {
  const code = cleanText(value);
  if (!/^\d{7}-\d$/u.test(code)) return '';
  const remainder = [7, 9, 10, 5, 8, 4, 2].reduce((sum, weight, index) => sum + weight * Number(code[index]), 0) % 11;
  return remainder !== 1 && Number(code[8]) === (remainder === 0 ? 0 : 11 - remainder) ? code : '';
}

export function campaignRows(snapshot, today = helsinkiDate()) {
  return today < expires2023 ? (snapshot?.candidates || []) : [];
}

export function trackerRows(advance, final, today = helsinkiDate()) {
  if (today < elections2027.advanceStart || today >= elections2027.expiresFrom) return [];
  const filings = new Map((final || []).map(row => [row.key, { ...row, final: row, advance: null }]));
  for (const row of advance || []) {
    const existing = filings.get(row.key);
    if (existing && normalized(existing.name) === normalized(row.name)) existing.advance = row;
    else if (!existing && today < elections2027.limitedFrom) filings.set(row.key, { ...row, advance: row, final: null });
  }
  return [...filings.values()];
}

export function campaignStats(rows) {
  const costs = rows.map(row => row.expenses).filter(Number.isFinite).sort((a, b) => a - b);
  const middle = Math.floor(costs.length / 2);
  const own = rows.filter(row => row.funding > 0 && Number.isFinite(row.fundingSources.own));
  const funding = own.reduce((sum, row) => sum + row.funding, 0);
  return {
    count: rows.length,
    medianExpenses: costs.length ? (costs[middle] + costs[Math.floor((costs.length - 1) / 2)]) / 2 : null,
    ownShare: funding ? own.reduce((sum, row) => sum + row.fundingSources.own, 0) / funding : null
  };
}
