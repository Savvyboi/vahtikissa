export const SITE_URL = 'https://vahtikissa.fi/';
export const SITE_NAME = 'Vahtikissa';

const copy = {
  fi: {
    name: SITE_NAME,
    locale: 'fi_FI',
    imageAlt: 'Vahtikissa – riippumaton eduskunnan avoimen datan palvelu',
    title: 'Vahtikissa – eduskunnan äänestykset ja kansanedustajat',
    description: 'Seuraa kansanedustajien äänestyksiä, puheenvuoroja ja lakiasioita. Tutki puolueita, valtion budjettia ja sidonnaisuuksia Vahtikissan avoimesta datasta.',
    pages: {
      sessions: ['Eduskunnan täysistunnot', 'Selaa eduskunnan täysistuntoja ja tutki niiden äänestyksiä, puheenvuoroja ja käsiteltyjä asioita huhtikuusta 2023 alkaen.'],
      votes: ['Eduskunnan äänestykset', 'Miten kansanedustajat äänestivät? Tutki eduskunnan äänestystuloksia, äänestysvaihtoehtoja ja puolueiden kantoja huhtikuusta 2023 alkaen.'],
      members: ['Kansanedustajat ja heidän toimintansa', 'Hae kansanedustajia nimellä tai puolueella. Tutki edustajien äänestyksiä, puheenvuoroja, taustatietoja ja ilmoitettuja sidonnaisuuksia.'],
      parties: ['Eduskuntapuolueet', 'Vertaa eduskuntapuolueiden kansanedustajia, äänestyksiä, osallistumista ja puheenvuoroja eduskunnan avoimen datan avulla.'],
      programmes: ['Puolueohjelmat ja vaalilupaukset', 'Tutki eduskuntapuolueiden vuoden 2023 vaaliohjelmia aiheittain. Lue ohjelmien lähteet ja vertaa puolueiden tavoitteita.'],
      speeches: ['Kansanedustajien puheenvuorot', 'Hae eduskunnan puheenvuoroja puhujan, aiheen tai tekstin perusteella. Lue kokonaisia puheita ja tutki kansanedustajien puhetilastoja.'],
      legislation: ['Lakiasiat ja lakiehdotukset', 'Seuraa eduskunnan lakiasioiden käsittelyä, päätöksiä ja niihin liittyviä äänestyksiä. Avaa alkuperäiset asiakirjat virallisesta lähteestä.'],
      budget: ['Suomen valtion budjetti', 'Tutki valtion talousarviota vuodesta 2020 alkaen. Vertaa määrärahoja, toteutuneita menoja ja vuosia hallinnonaloittain.'],
      elections: ['Eduskuntavaalien 2023 tulokset', 'Tutki vuoden 2023 eduskuntavaalien tuloksia puolueittain, vaalipiireittäin ja ehdokkaittain Tilastokeskuksen avoimesta datasta.'],
      influence: ['Kansanedustajien sidonnaisuudet, lahjat ja lobbaus', 'Tutki kansanedustajien ilmoitettuja sidonnaisuuksia, lahjoja ja avoimuusrekisteriin ilmoitettuja lobbausyhteydenottoja lähdetietoineen.'],
      about: ['Tietoa Vahtikissasta ja datan lähteistä', 'Tutustu Vahtikissan virallisiin datalähteisiin, laskentamenetelmiin ja tietojen rajoituksiin. Riippumaton eduskunnan avoimen datan palvelu.']
    }
  },
  sv: {
    name: 'Vaktkatt',
    locale: 'sv_FI',
    imageAlt: 'Vaktkatt – en oberoende tjänst för riksdagens öppna data',
    title: 'Vaktkatt – riksdagens omröstningar och ledamöter',
    description: 'Följ riksdagsledamöternas omröstningar, anföranden och lagärenden. Utforska partier, statsbudgeten och bindningar med Vaktkatts öppna data.',
    pages: {
      sessions: ['Riksdagens plenum', 'Bläddra bland riksdagens plenum och utforska omröstningar, anföranden och behandlade ärenden från april 2023.'],
      votes: ['Riksdagens omröstningar', 'Hur röstade riksdagsledamöterna? Utforska omröstningsresultat, röstningsalternativ och partiernas ställningstaganden från april 2023.'],
      members: ['Riksdagsledamöter och deras arbete', 'Sök riksdagsledamöter efter namn eller parti. Utforska deras omröstningar, anföranden, bakgrund och redovisade bindningar.'],
      parties: ['Riksdagspartierna', 'Jämför riksdagspartiernas ledamöter, omröstningar, deltagande och anföranden med hjälp av riksdagens öppna data.'],
      programmes: ['Partiprogram och vallöften', 'Utforska riksdagspartiernas valprogram från 2023 efter ämne. Läs originalkällorna och jämför partiernas mål.'],
      speeches: ['Riksdagsledamöternas anföranden', 'Sök anföranden efter talare, ämne eller text. Läs hela anföranden och utforska statistik över ledamöternas tal.'],
      legislation: ['Riksdagsärenden och lagförslag', 'Följ behandlingen av riksdagsärenden, beslut och relaterade omröstningar. Öppna originalhandlingarna i den officiella källan.'],
      budget: ['Finlands statsbudget', 'Utforska statsbudgeten från 2020. Jämför anslag, utfall och år enligt förvaltningsområde.'],
      elections: ['Resultat i riksdagsvalet 2023', 'Utforska resultatet i riksdagsvalet 2023 efter parti, valkrets och kandidat med Statistikcentralens öppna data.'],
      influence: ['Ledamöternas bindningar, gåvor och lobbning', 'Utforska ledamöternas redovisade bindningar, gåvor och lobbykontakter som anmälts till öppenhetsregistret, med originalkällor.'],
      about: ['Om Vaktkatt och datakällorna', 'Läs om Vaktkatts officiella datakällor, beräkningsmetoder och begränsningar. En oberoende tjänst för riksdagens öppna data.']
    }
  },
  en: {
    name: SITE_NAME,
    locale: 'en_GB',
    imageAlt: 'Vahtikissa – an independent open data dashboard for the Finnish Parliament',
    title: 'Vahtikissa – Finnish Parliament votes and MPs',
    description: 'Follow Finnish MPs’ votes, speeches and legislation. Explore parties, the state budget and declared interests with Vahtikissa’s open data dashboard.',
    pages: {
      sessions: ['Finnish Parliament plenary sessions', 'Browse Finnish Parliament plenary sessions and explore their votes, speeches and agenda items from April 2023 onward.'],
      votes: ['Finnish Parliament votes', 'How did Finnish MPs vote? Explore parliamentary voting results, the voting alternatives and party positions from April 2023 onward.'],
      members: ['Finnish MPs and their parliamentary work', 'Find Finnish MPs by name or party. Explore their voting records, speeches, official backgrounds and declared interests.'],
      parties: ['Finnish parliamentary parties', 'Compare Finnish parliamentary parties, their MPs, voting participation and speeches using Parliament’s open data.'],
      programmes: ['Finnish party programmes and election pledges', 'Explore parliamentary parties’ 2023 election programmes by topic. Read the original sources and compare their goals.'],
      speeches: ['Speeches in the Finnish Parliament', 'Search Finnish parliamentary speeches by speaker, topic or text. Read full transcripts and explore MPs’ speech statistics.'],
      legislation: ['Finnish legislation and parliamentary matters', 'Follow parliamentary matters, their progress, decisions and related votes. Open the original documents from official sources.'],
      budget: ['Finland’s state budget', 'Explore Finland’s state budget from 2020 onward. Compare appropriations, actual spending and years by administrative branch.'],
      elections: ['Finland’s 2023 parliamentary election results', 'Explore Finland’s 2023 parliamentary election results by party, electoral district and candidate using Statistics Finland’s open data.'],
      influence: ['Finnish MPs’ declared interests, gifts and lobbying', 'Explore MPs’ declared interests, gifts and lobbying contacts reported to Finland’s Transparency Register, with original sources.'],
      about: ['About Vahtikissa and its data sources', 'Read about Vahtikissa’s official data sources, calculations and limitations. An independent dashboard for Finnish Parliament open data.']
    }
  }
};

function shorten(value, limit) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= limit) return text;
  const start = text.slice(0, limit - 1);
  const space = start.lastIndexOf(' ');
  return (space > limit * 0.6 ? start.slice(0, space) : start).trimEnd() + '…';
}

export function siteMetadata(lang = 'fi', route = { page: 'overview' }, heading = '') {
  const text = Object.hasOwn(copy, lang) ? copy[lang] : copy.fi;
  const page = Object.hasOwn(text.pages, route.page) ? text.pages[route.page] : null;
  const detail = route.id && shorten(heading, 100);
  return {
    title: detail ? `${detail} | ${text.name}` : page ? `${page[0]} | ${text.name}` : text.title,
    description: detail ? shorten(`${detail}. ${page?.[1] || text.description}`, 180) : page?.[1] || text.description,
    locale: text.locale,
    name: text.name,
    imageAlt: text.imageAlt
  };
}

export function updatePageMetadata({ lang = 'fi', route = { page: 'overview' }, heading = '' } = {}) {
  const metadata = siteMetadata(lang, route, heading);
  document.title = metadata.title;
  const values = {
    'meta[name="description"]': metadata.description,
    'meta[property="og:title"]': metadata.title,
    'meta[property="og:description"]': metadata.description,
    'meta[property="og:site_name"]': metadata.name,
    'meta[property="og:locale"]': metadata.locale,
    'meta[property="og:image:alt"]': metadata.imageAlt,
    'meta[name="twitter:title"]': metadata.title,
    'meta[name="twitter:description"]': metadata.description,
    'meta[name="twitter:image:alt"]': metadata.imageAlt
  };
  for (const [selector, value] of Object.entries(values)) {
    const element = document.querySelector(selector);
    if (element) element.content = value;
  }
  const alternates = Object.values(copy).map(text => text.locale).filter(locale => locale !== metadata.locale);
  document.querySelectorAll('meta[property="og:locale:alternate"]').forEach((element, index) => {
    element.content = alternates[index];
  });
  // All views share one HTML document. Fragments and reading preferences aren't indexable pages.
  // Keep the canonical and og:url in the original HTML stable across route/language changes.
}
