import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpeech, normalizeMatter, splitSpeeches } from '../scripts/sync-data.mjs';

test('speech normalization preserves the complete speech and Swedish metadata', () => {
  const longSpeech = `Början ${'x'.repeat(1500)} slut`;
  const speech = normalizeSpeech({ puheenvuoro: {
    id: 'PUH 1', valtiopaivavuosi: '2024', taysistuntonumero: '1', aloitushetki: '2024-01-01T10:00:00+00:00',
    puhuja: { henkilonro: '1', etunimi: 'Ada', sukunimi: 'Test', lisatieto: 'r' },
    asia: {
      fi: { eduskuntatunnus: 'HE 1/2024 vp', nimeketeksti: 'Suomenkielinen otsikko' },
      sv: { eduskuntatunnus: 'RP 1/2024 rd', nimeketeksti: 'Svensk rubrik' }
    },
    puheenvuoro: longSpeech,
    asiakirjaviitteet: {
      fi: [{ eduskuntatunnus: 'HE 1/2024 vp', asiakirjatyyppi: 'Hallituksen esitys' }],
      sv: [{ eduskuntatunnus: 'RP 1/2024 rd', asiakirjatyyppi: 'Regeringens proposition' }]
    }
  }});
  assert.equal(speech.text, longSpeech);
  assert.equal(speech.agendaSv, 'Svensk rubrik');
  assert.deepEqual(speech.documentsSv, [{ name: 'Regeringens proposition', label: 'RP 1/2024 rd', url: '' }]);
});

test('speech splitting creates bounded chunks and records each chunk on speech metadata', () => {
  const speeches = [
    { id: 'PUH 1', text: 'Ensimmäinen', agenda: 'Asia 1' },
    { id: 'PUH 2', text: 'Toinen', agenda: 'Asia 2' },
    { id: 'PUH 3', text: 'Kolmas', agenda: 'Asia 3' }
  ];
  assert.deepEqual(splitSpeeches(speeches, 2), {
    speeches: [
      { id: 'PUH 1', agenda: 'Asia 1', textChunk: 0 },
      { id: 'PUH 2', agenda: 'Asia 2', textChunk: 0 },
      { id: 'PUH 3', agenda: 'Asia 3', textChunk: 1 }
    ],
    speechTextChunks: [
      { 'PUH 1': 'Ensimmäinen', 'PUH 2': 'Toinen' },
      { 'PUH 3': 'Kolmas' }
    ]
  });
});

test('matter normalization preserves Finnish and Swedish titles and stages', () => {
  const matter = normalizeMatter({ valtiopaivaasia: {
    eduskuntatunnus: { fi: 'HE 1/2024 vp', sv: 'RP 1/2024 rd' },
    nimeke: { fi: 'Esitys laiksi', sv: 'Förslag till lag' },
    laadintapvm: { fi: '2024-02-03', sv: '2024-02-03' },
    viimeisinKasittelyvaihe: { fi: 'Ensimmäinen käsittely', sv: 'Första behandlingen' },
    kokonaispaatosnimi: { fi: 'Hyväksytty', sv: 'Godkänd' }
  }});
  assert.deepEqual(matter, {
    id: 'HE 1/2024 vp', document: 'HE 1/2024 vp', documentSv: 'RP 1/2024 rd',
    title: 'Esitys laiksi', titleSv: 'Förslag till lag', firstDate: '2024-02-03', latestDate: '2024-02-03',
    stages: ['Ensimmäinen käsittely'], stagesSv: ['Första behandlingen'], decision: 'Hyväksytty', decisionSv: 'Godkänd',
    voteIds: [], amendmentCount: 0,
    url: 'https://www.eduskunta.fi/asiat-ja-aanestykset/valtiopaivaasiat/HE%201%2F2024%20vp'
  });
});

test('matter normalization keeps proposals even when only Swedish publication date exists', () => {
  const matter = normalizeMatter({ valtiopaivaasia: {
    eduskuntatunnus: { fi: 'HE 2/2024 vp', sv: 'RP 2/2024 rd' },
    nimeke: { fi: 'Esitys', sv: 'Proposition' },
    laadintapvm: { fi: '', sv: '2024-03-04' },
    viimeisinJulkaisuajankohta: { fi: '', sv: '2024-03-05T09:00:00+00:00' }
  }});
  assert.equal(matter.firstDate, '2024-03-04');
  assert.equal(matter.latestDate, '2024-03-05T09:00:00+00:00');
});
