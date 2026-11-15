import test from 'node:test';
import assert from 'node:assert/strict';
import { businessId, campaignRows, campaignStats, memberCampaign, trackerRows } from '../campaign-finance-data.js';
import { parseCandidates, parseCandidateDonations, parsePartyReceipts, readVtvCsv, vtvLinks } from '../scripts/sync-campaign-finance.mjs';

test('VTV CSV parsing handles UTF-8, apostrophe-quoted fields and embedded delimiters', () => {
  assert.deepEqual(readVtvCsv("\uFEFF'Ehdokas';'Lisätietoja'\r\n'Mäkelä';'Rivi 1; rivi 2\nO''Brien'\r\n"), [
    ['Ehdokas', 'Lisätietoja'], ['Mäkelä', "Rivi 1; rivi 2 O'Brien"]
  ]);
  assert.deepEqual(readVtvCsv('Nimi;Summa\n"Yhdistys; ry";"1 000,50"'), [['Nimi', 'Summa'], ['Yhdistys; ry', '1 000,50']]);
});

test('VTV index links stay on the register origin and preserve the download version', () => {
  const base = 'https://www.vaalirahoitusvalvonta.fi/';
  assert.deepEqual(vtvLinks('<a href="/x.csv?dl=1&amp;type=report">X</a><a href="//other.example/y.csv">Y</a>', base),
    [base + 'x.csv?dl=1&type=report']);
});

test('parliamentary campaign results join on district and number with a name check', () => {
  const header = 'Ehdokasnumero;Etunimet;Sukunimi;Ammatti;Vaalipiiri/Kunta;Puolue;Saapumispäivä;Muokkauspäivä;Tukiryhmä;Vaalikampanjan kulut yhteensä;Vaalikampanjan rahoitus yhteensä;2.1 Rahoitus sisältää omia varoja yhteensä';
  const csv = header + '\n0068;Anna Maija;Mallikas;;Uudenmaan vaalipiiri;KOK;5.6.2023;; ;1 100,50;1 101;0';
  const elections = {
    districts: [{ code: '020000', name: { fi: 'VP02 Uudenmaan vaalipiiri' } }],
    candidates: [{ id: '02030068', name: 'Mallikas Anna', votes: 3412 }]
  };
  const [record] = parseCandidates(csv, elections, 2023, 'final');
  assert.equal(record.key, '020068');
  assert.equal(record.votes, 3412);
  assert.equal(record.expenses, 110050);
  assert.equal(record.fundingSources.own, 0);
  assert.equal(record.fundingSources.loans, null);
  assert.equal(record.filed, '2023-06-05');
  assert.equal(memberCampaign([record], { firstName: 'Anna', lastName: 'Mallikas' }), record);
  assert.equal(memberCampaign([record, record], { firstName: 'Anna', lastName: 'Mallikas' }), null);
  assert.throws(() => parseCandidates(csv.replace('Mallikas', 'Toinen'), elections, 2023, 'final'), /identity mismatch/);
});

test('named contributions include people and organisations while cross-register IDs require a valid organisation ID', () => {
  const csv = [
    'Tukija;Tukijan y-tunnus/yhdistysrekisterinumero jos on;Etunimet;Sukunimi;Kotikunta;Koodi;Laina;Laina-aika;Tuen maara;Ehdokas;Sukunimi;Vaalipiiri;Puolue;',
    'Esimerkki ry;0771677-3;;;;2.7;;;2200,50;Anna;Mallikas;Uudenmaan vaalipiiri;KOK',
    ';0771677-3;Esa;Esimerkki;Helsinki;2.3;;;1200;Anna;Mallikas;Uudenmaan vaalipiiri;KOK',
    'Esimerkki ry;0771677-3;;;;2.2;;;10000;Anna;Mallikas;Uudenmaan vaalipiiri;KOK',
    'Toinen ry;0771677-4;;;;2.8;;;10000;Anna;Mallikas;Uudenmaan vaalipiiri;KOK',
    'Eri tukija ry;0771677-3;;;;2.4;;;10000;Antti;Mallikas;Uudenmaan vaalipiiri;KOK'
  ].join('\n');
  assert.equal(businessId('0771677-4'), '');
  const candidate = { first: 'Anna', last: 'Mallikas', district: 'Uudenmaan vaalipiiri', party: 'KOK', key: '020068' };
  assert.deepEqual(parseCandidateDonations(csv, [candidate]), [
    { id: '0771677-3', name: 'Esimerkki ry', candidateKey: '020068', amount: 220050, transferred: false },
    { name: 'Esa Esimerkki', candidateKey: '020068', amount: 120000, transferred: false },
    { name: 'Toinen ry', candidateKey: '020068', amount: 1000000, transferred: true }
  ]);
});

test('party contribution totals count mirrored amounts once and recover a split organisation name', () => {
  const csv = [
    'Date;Amended;Recipient;Ilmoittajan rekisteritunnus;Month;Year;Organisation;ID;Tuen määrä;In kind;First;Last;Town;Amount;In kind;Transfer;Notes',
    '2026-10-07;;Esimerkkipuolue;0771677-3;06;2026;Esimerkki ry;Exempel rf;2219607-5;2 820,00;;;;;;;;',
    ['2026-10-07', '', 'Esimerkkipuolue', '0771677-3', '06', '2026', '', '', '2 000,00', '', 'Yksityinen', 'Henkilö', '', '2 000,00', '', '', ''].join(';')
  ].join('\n');
  assert.deepEqual(parsePartyReceipts(csv, '2026', 'source'), [
    { id: '0771677-3', recipient: 'Esimerkkipuolue', year: 2026, amount: 482000, count: 2, source: 'source' }
  ]);
});

test('2027 joins matching advance and final filings and stops showing advance-only records after expiry', () => {
  const advance = { key: '020068', name: 'Anna Mallikas', expenses: 110050 };
  const unmatched = { key: '020069', name: 'Antti Mallikas', expenses: 32000 };
  const final = { ...advance, expenses: 120000 };
  assert.deepEqual(trackerRows([advance], [final], '2027-03-17'), []);
  const beforeCutoff = trackerRows([advance, unmatched], [final], '2027-05-20');
  assert.equal(beforeCutoff.length, 2);
  assert.equal(beforeCutoff[0].advance.expenses, 110050);
  assert.equal(beforeCutoff[0].final.expenses, 120000);
  assert.deepEqual(trackerRows([advance, unmatched], [final], '2027-05-21').map(row => row.key), [advance.key]);
  assert.equal(trackerRows([{ ...advance, name: 'Another candidate' }], [final], '2027-05-21')[0].advance, null);
  assert.deepEqual(trackerRows([advance], [final], '2032-04-21'), []);
  assert.deepEqual(campaignRows({ candidates: [final] }, '2028-04-05'), []);
});

test('campaign summary reports the median and weights the own-funds share by funding', () => {
  const row = (expenses, funding, own) => ({ expenses, funding, fundingSources: { own } });
  assert.deepEqual(campaignStats([row(100, 100, 20), row(300, 300, 180), row(null, 500, null)]),
    { count: 3, medianExpenses: 200, ownShare: 0.5 });
});
