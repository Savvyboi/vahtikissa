import { escapeHTML, formatDate } from './app-utils.js';

export function snapshotNote(metadata, lang = 'fi') {
  const ui = (fi, sv, en) => lang === 'en' ? en : lang === 'sv' ? sv : fi;
  const locale = lang === 'en' ? 'en-GB' : lang === 'sv' ? 'sv-FI' : 'fi-FI';
  const time = value => '<time datetime="' + escapeHTML(value) + '">' + escapeHTML(formatDate(value, locale)) + '</time>';
  if (!metadata?.generatedAt) return '';
  return '<p class="data-freshness sub">' + ui('Aineisto tarkistettu', 'Materialet kontrollerat', 'Data checked') + ' ' + time(metadata.generatedAt) + '.'
    + (metadata.latest?.vote ? ' ' + ui('Viimeisin kirjattu äänestys', 'Senaste registrerade omröstning', 'Latest recorded vote') + ': ' + time(metadata.latest.vote) + '.' : '')
    + (metadata.latest?.speech ? ' ' + ui('Viimeisin puheenvuoro', 'Senaste anförande', 'Latest speech') + ': ' + time(metadata.latest.speech) + '.' : '')
    + ' ' + ui('Kaikissa istunnoissa ei äänestetä. Tiedot tulevat näkyviin, kun Eduskunta julkaisee ne.', 'Omröstningar hålls inte i varje plenum. Uppgifterna visas när riksdagen publicerar dem.', 'Not every session includes a recorded vote. Records appear when Parliament publishes them.') + '</p>';
}
