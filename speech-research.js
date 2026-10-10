import { normalizeSpeechSearchText } from './app-utils.js';
import { LANGUAGE_STOPWORDS } from './speech-stopwords.js';

// Curated function words in both transcript languages and parliamentary salutations.
// Versioned with the code; policy subject words are deliberately retained.
export const STOPWORD_VERSION = 'fi-sv-2';
export const STOPWORDS = new Set(`
ai aivan alla alle aluksi aina ainakin ainoa ainoastaan aikana aikaisemmin aikoo aikovat
alas alueella asti asia asiaa asian asioita arvoisa arvoisat arvoisan
edelleen edessä edes ehkä ei eivät eikä eivätkä ellei emme en ennen ensin entinen entistä
eri erityisesti eräs et eteensä että ette ettei etten ettemme ettenkö
haluaa haluamme haluan he hei heidän heidät heille heiltä heissä heistä heitä
heitä hän hänen hänelle häneltä hänestä hänet häntä herra huolimatta huomattavasti
hyvin ihan itse itsensä itseään itselleen ja jo johon joiden joihin joilla joille joilta
joissa joista joita joka jokainen jokaisen joku jolla jolle jolta jonka jossa josta jota
joten jotta joudutaan juuri jälkeen jälleen jää jäädä jäi jäävät
kaiken kaikki kaikkia kaikkiaan kaikille kaikilla kaikissa kautta kans kanssa kauan kerran
kerta ketkä kiitos kohti koko kokonaan koska koskee kovin kuinka kuitenkin kuin kyllä
kuten kuuluu käy käydään käyttämään liian lisäksi lisätä luona läpi lähellä lähes lähtien
me meidän meidät meihin meillä meille meiltä meissä meistä meitä mieleen mielestä mielestäni
miksi mikä mikäli milloin millä mille miltä minkä missä mistä mitä miten monet monia moni
monen mukaan mukana mutta muu muualle muualla muut muuta muutaman muutamia muiden muille
muilla muissa muita myöhemmin myös myöskään ne niiden niin niihin niillä niille niiltä
niinpä niissä niistä niitä no noin nyt näin näiden näihin näillä näille näiltä näissä
näistä näitä nämä nähden ollut olleet ole olen olemme olemassa olemme olevan olevat oleva
olevaa olivat olivatkin olimme olin olisi olisivat olisimme olisin olisiko olkoon olla ollaan
ollut on ovat paikoillaan paljon paremmin paras parasta perin pian pois puhemies puhemiehen
puhemiehelle puhemiesneuvosto päin päällä pitää pitäisi pitääkin pitävät pyydän rouva
saakka saa saada saadaan saimme sain saisimme saisi saivat saattaa samalla sama samaa saman
samat samoin sanoa sanoi sanon se sen sitä siten sitten siellä sieltä sinne siinä siihen
sillä sille siltä siitä siis sinä sinua sinun sinulle sisällä suoraan suuri suurempi
tahansa taas tai takana takaisin takia tavalla tavoin te teidän teidät teille teillä teiltä
tiedä tietysti toki todella toinen toisen toisia toisaalta toinenkin tätä tämä tämän
tänne täällä täältä täytyy täysin tällainen tällaisia tällaisen tällöin tänään tuo tuon
tuota tuohon tuossa tuosta tuolloin tuolla tuolle tuolta tule tullut tulee tulevat tulisi
tulla tulivat tuskin täällä tänään vielä viisi viime viimeinen viimeksi voi voida voidaan
voimme voin voisi voisivat voitte voivat vuoksi vähän välillä vain varsin varsinkin vastaan
varten vaikka vaan vasten verran varmaan yleensä yhä yhden yhdessä yksi yksin ylös yli
ympäri sekä senkin silloinkin sitäkään sillekin tämäkin täälläkin
aderton adertonde adjö aldrig alla allas alls allt alltid alltså andra andras annan annat
annars anser att av bakom bara behöva behöver bland blev blivit bli blir borta bort bra
båda bådas dag dagar dagens de del dem den denna denne deras dess dessa det detta dig
din dina dit ditt dock du där därför därifrån då efter eftersom ej eller emellan emot en
enligt ens er era ert ett fem femte fick finnas finns fjorton fler flera flest flesta
fortfarande fram framför från fru få får fått för före förra första genom gärna gör göra
gjorde gjort god gott hade haft han hans har hellre heller helst helt henne hennes hit
hon honom hur här i ibland igen ingen inget inga inom inte ja jag jo just ju kan kanske
knappast kom komma kommer kommit kunde kunna kvar länge längre låt man många med mellan
men mer mest mig min mina mindre minst mitt mot mycket måste möjligen ni nio nog någon
någonting något några nu när och också ofta om oss oss själva redan samma sedan sen senare
sig sin sina sist sista sitt ska skall skulle som sådan sådana sådant stor stora sådan
så såväl såvida tack talman talmannen till tillsammans tio tjugo tre tredje två under upp
ur ut utan ute vad var vara varför varit varje vars vart vem vi vid vidare vilka vilken
vilket vill ville viss vissa visst vår våra vårt väl väldigt värderade än ännu är även åt
över övriga herr ledamot talmans
`.trim().split(/\s+/u));


for (const word of [...LANGUAGE_STOPWORDS.fi,...LANGUAGE_STOPWORDS.sv, ..."eli esimerkiksi erittäin nimenomaan nimenomaisesti myöskin tietenkin tietystikin tässäkin tähänkin tästäkin silläkin sitähän tämähän tässähän tällaiset tällaisissa sellainen sellaisia sellaisen sellaisessa sellaisista sellaiset sellaisille tuollainen tuollaisia tuollaisen tuollaiset jospa jotta kunhan minkään mikään mitään missään mistään mihinkään kenenkään kukaan ketään koskaan jossain jostain johonkin jollain jollekin joltakin jossakin jonkin joidenkin joitakin jotkut jotakin jokin jonkun jonkinlainen jotenkin jonne josta edelleenkin ainakin osalta kannalta yhteydessä yhteyteen enemmän vähemmän lisää tarpeen tarvitaan pitäisi tarvitse tarvitsevat tarvitsemaan tarvitsisi tullut tulossa tulee olemaan olisikin olisihan olikaan olihan olikin vaanhan saadaan saisi sanoisin sanottu sanoen sanottava haluaisin haluaisimme haluatte halutaan haluavat sanottuna käytännössä totta ehkäpä erityisen tärkeä tärkeää tärkeääkin hyvä parempi paremmin näinpä edustaja edustajat edustajaa edustajan edustajalle edustajien edustajilta puhuja puheenvuoro puheenvuoron fru herr talman talmannen talmans ledamot ledamoten ledamöter ärade exempel exempelvis verkligen naturligtvis alltså dessutom fortfarande också framförallt helt enkelt frågan fråga givetvis behövs".split(' ')]) STOPWORDS.add(word);

export function speechTokens(text) {
  return String(text || '').normalize('NFC').toLocaleLowerCase('fi').match(/\p{L}+/gu) || [];
}

// Country names and institutional boilerplate add little to a personal vocabulary.
// Explicit forms avoid stripping meaningful compounds such as hallitusohjelma.
export const PARLIAMENT_GENERIC_WORDS = new Set(`
suomi suomen suomea suomessa suomesta suomeen suomella suomelle suomelta
suomalainen suomalaisen suomalaista suomalaiset suomalaisten suomalaisia suomalaisille
hallitus hallituksen hallitusta hallituksessa hallituksesta hallitukseen hallituksella hallitukselle hallitukselta
hallitukset hallitusten hallituksia hallituksissa hallituksista hallituksiin hallituksille
eduskunta eduskunnan eduskuntaa eduskunnassa eduskunnasta eduskuntaan eduskunnalle
valiokunta valiokunnan valiokuntaa valiokunnassa valiokunnasta valiokuntaan valiokunnalle valiokunnat valiokuntien
ministeri ministerin ministeriä ministerille ministerit ministereiden ministerien
esitys esityksen esitystä esityksessä esityksestä esitykseen esityksiä esitysten
mietintö mietinnön mietintöä mietinnössä mietinnöstä
finland finlands finländsk finländska finländskt finländare
regering regeringen regeringens regeringar regeringarna regeringarnas
riksdag riksdagen riksdagens utskott utskottet utskottets utskotten utskottens
minister ministern ministerns ministrar ministrarna proposition propositionen propositionens propositioner
betänkande betänkandet betänkandets
`.trim().split(/\s+/u));
for (const word of 'tehdä tekee tekevät teemme teette tehdään tekemään tekemässä tekeminen tehnyt tehneet tehty tehtiin tehtävä tehtävät tehtävän tehtävää tehdyt tee teen tehdäänkin tekevän tekevä tekevämme tosi hyvinkin tosiaankin ylipäätänsä samaan aikaan eteen liikkeelle kaikkemme kysyi kysyn kysymys kysymyksen kysymykseen kysymystä vastaus vastauksessa vastauksessani kysymykset kysymyksiä tarkoittaa tarkoitan tarkoitti tarkoittavat tärkeätä tärkeät tärkeän tärkeässä keskeinen keskeistä keskeisen olennaista olennaisen tietoa toivon toivomme toivotaan uskon uskomme ajattelen ajattelemme näkisin pitäisin tuoda tuodaan tuon tuomme otetaan otan otamme ottamaan tullut tulemme tullaan hetkellä kyse osin osa enää vuonna vuoden vuosina vuotta tänä tälle tällähän toisaalta toisaalla nimittäin tietty tietyllä varsinainen varsinaisesti lähtökohtaisesti tavallaan sinänsä ylipäätään ylipäänsä ensinnäkin toiseksi kolmanneksi todeta totean totesi todetaan tiedämme tiedetään näkökulmasta tilanteessa tapauksessa varmasti eräänlainen eräänlaisia arvon ärendet ärende gäller enligt gällande tillfälle förslag förslaget förslagets'.split(' ')) STOPWORDS.add(word);

export function buildWordClouds(speeches, limit = 60, memberIds = []) {
  const members = new Map(memberIds.map(id=>[String(id),{speeches:0,words:0,filteredWords:0,terms:new Map()}]));
  const totals = new Map();
  let corpusWords = 0;
  for (const speech of speeches) {
    const id = String(speech.mpId || '');
    if (!id) continue;
    if (!members.has(id)) members.set(id, { speeches: 0, words: 0, filteredWords: 0, terms: new Map() });
    const bucket = members.get(id), tokens = speechTokens(String(speech.text||'').replace(/\[[^\]]*\]/gu,' '));
    bucket.speeches++; bucket.words += tokens.length;
    const seen = new Set();
    for (const word of tokens) {
      if ((word.length < 3 && !['eu','yk','fn'].includes(word)) || STOPWORDS.has(word) || PARLIAMENT_GENERIC_WORDS.has(word)) continue;
      bucket.filteredWords++; corpusWords++;
      totals.set(word,(totals.get(word)||0)+1);
      const term = bucket.terms.get(word) || { word, count: 0, speeches: 0 };
      term.count++; if (!seen.has(word)) term.speeches++;
      seen.add(word); bucket.terms.set(word, term);
    }
  }
  return {
    method: {
      stopwords: STOPWORD_VERSION, languages: ['fi', 'sv'], lemmatized: false,
      bracketedAnnotations: 'excluded', minLength: 3, shortExceptions: ['eu','yk','fn'], limit,
      ranking: 'sqrt-count-log2-relative-frequency', reference: 'other-mps', smoothing: 0.5,
      minimumRelativeFrequency: 1.25, repeatThreshold: { fromSpeeches: 5, occurrences: 3, speeches: 2 },
      corpusWords, corpusSpeakers: [...members.values()].filter(bucket=>bucket.filteredWords).length
    },
    members: Object.fromEntries([...members].map(([id, bucket]) => {
      const otherWords = corpusWords-bucket.filteredWords;
      const terms = [...bucket.terms.values()].filter(term=>bucket.speeches<5 || (term.count>=3 && term.speeches>=2)).map(term=>{
        // Compare rates, not totals, so different amounts of speech do not imply specificity.
        const corpusCount = totals.get(term.word);
        const relativeFrequency = otherWords ? ((term.count+0.5)/(bucket.filteredWords+1))/((corpusCount-term.count+0.5)/(otherWords+1)) : 1;
        const score = otherWords ? Math.sqrt(term.count)*Math.log2(relativeFrequency) : Math.sqrt(term.count);
        return {...term,corpusCount,relativeFrequency,score};
      }).filter(term=>!otherWords || term.relativeFrequency>=1.25)
        .sort((a,b)=>b.score-a.score || b.count-a.count || a.word.localeCompare(b.word,'fi')).slice(0,limit);
      return [id, {...bucket,terms}];
    }))
  };
}

// All modes ignore case and punctuation. Word/phrase matches respect token boundaries;
// contains intentionally supports Finnish/Swedish inflections through user-chosen stems.
export function matchRanges(text, query, mode = 'contains') {
  const value = normalizeSpeechSearchText(text), q = normalizeSpeechSearchText(query);
  if (!q) return [];
  const ranges = [];
  let from = 0;
  while (from <= value.length - q.length) {
    const start = value.indexOf(q, from);
    if (start < 0) break;
    const end = start + q.length;
    const accepted = mode === 'contains' || ((start === 0 || value[start-1] === ' ') && (end === value.length || value[end] === ' '));
    if (accepted) ranges.push({ start, end });
    from = accepted ? end : start + 1; // rejected partial words must not hide a later valid phrase
  }
  return ranges;
}

export function filterResearchSpeeches(speeches, texts, { query = '', exclude = '', mode = 'contains', scope = 'text' } = {}) {
  return speeches.filter(speech => {
    const text = texts[speech.id] ?? speech.text ?? '';
    const metadata = [speech.firstName,speech.lastName,speech.party,speech.agenda,speech.agendaSv,speech.type].join(' ');
    const include = !normalizeSpeechSearchText(query) || matchRanges(text,query,mode).length || (scope === 'all' && matchRanges(metadata,query,mode).length);
    return include && (!normalizeSpeechSearchText(exclude) || !matchRanges(text,exclude,mode).length);
  });
}

export function concordance(text, query, mode = 'contains', limit = 3, radius = 80) {
  const normalized = normalizeSpeechSearchText(text);
  return matchRanges(normalized,query,mode).slice(0,limit).map(({start,end}) => ({
    before: (start > radius ? '…' : '') + normalized.slice(Math.max(0,start-radius),start),
    match: normalized.slice(start,end),
    after: normalized.slice(end,end+radius) + (end+radius < normalized.length ? '…' : '')
  }));
}

export function researchSummary(speeches, texts, query, mode = 'contains') {
  const months = new Map();
  let occurrences = 0, words = 0, matchingSpeeches = 0;
  for (const speech of speeches) {
    const text = texts[speech.id] ?? speech.text ?? '';
    const count = matchRanges(text,query,mode).length, wordCount = normalizeSpeechSearchText(text).split(' ').filter(Boolean).length;
    const month = String(speech.date).slice(0,7);
    if (!months.has(month)) months.set(month,{month,speeches:0,matchingSpeeches:0,occurrences:0,words:0});
    const row = months.get(month);
    row.speeches++; row.words += wordCount; row.occurrences += count;
    if (count) {row.matchingSpeeches++;matchingSpeeches++;}
    occurrences += count; words += wordCount;
  }
  return { speeches:speeches.length, matchingSpeeches, occurrences, words,
    per10000Words: words ? occurrences/words*10000 : 0,
    months: [...months.values()].sort((a,b)=>a.month.localeCompare(b.month)).map(row=>({...row,per10000Words:row.words?row.occurrences/row.words*10000:0}))
  };
}

export function speechSearchLink({query = '', mpId = 'all', mode = 'word', scope = 'text'} = {}) {
  return '#/speeches?' + new URLSearchParams({q:query,mp:mpId,match:mode,scope});
}
