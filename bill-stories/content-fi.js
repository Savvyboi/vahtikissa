const illustrations = 'Kuvakkeet: Health Icons (CC0)';
const abbreviations = 'Eduskunnan asiakirjalyhenteet (PDF)';
const oldNotice = 'Aiempi laki 230/2016, 16 a §';
const noticeLaw = 'Laki 594/2026, 16 a §';
const jpySubmission = 'JPY:n lausunto ministeriölle 6.3., s. 1';
const gamblingCheck = 'Rahapelilaki 10/2026, 10 §:n 2 momentin 8 kohta (PDF)';
const gamblingEnglish = 'Rahapelilaki 10/2026, 10 § (englanniksi)';
const registerGuide = 'https://www.avoimuusrekisteri.fi/ohjeita/mista-toiminnasta-ilmoitetaan';

const bill = ['HE … vp', 'HE tarkoittaa hallituksen esitystä. Vp on lyhenne sanasta valtiopäivät. Numero ja vuosi yksilöivät esityksen eduskunnassa.'];
const jpy = ['JPY', 'Jalkapallon Pelaajayhdistys edustaa Suomessa pelaavia jalkapalloilijoita.'];
const policy = ['Vakuutuksenottaja', 'Henkilö tai yhteisö, joka on ottanut vakuutuksen. Jos seura ottaa vakuutuksen pelaajalleen, seura on vakuutuksenottaja ja pelaaja on vakuutettu.'];
const section16 = ['16 a §', 'Urheilijoiden vakuutusturvaa koskevan lain pykälä, joka kertoo, milloin vakuutusyhtiön pitää ilmoittaa muutoksesta ja kenelle.'];
const submission = ['Lausunto', 'Kirjallinen kannanotto, jonka järjestö tai muu taho antaa ministeriön lausuntokierroksella tai eduskunnan valiokunnalle.'];
const healthReport = ['StVM 7/2026 vp', 'Eduskunnan sosiaali- ja terveysvaliokunnan mietintö tästä lakiesityksestä. Mietinnössä valiokunta perustelee ehdottamansa muutokset.'];
const administrationReport = ['HaVM 28/2025 vp', 'Hallintovaliokunnan mietintö rahapeliesityksestä. Se sisältää valiokunnan ehdotuksen eduskunnan päätökseksi.'];
const register = ['Avoimuusrekisteri', 'Julkinen rekisteri, johon ilmoitetaan eduskuntaan tai ministeriöihin kohdistuvasta lobbauksesta ja sen neuvonnasta.'];
const period = ['Ilmoitusjakso', 'Ajanjakso, jota rekisteri-ilmoitus koskee. Saman jakson yhteydenotot voivat ajoittua eri päiville.'];
const lookback = ['Tarkasteluaika', 'Ajanjakso ennen luvan arviointia, jolta viranomainen tarkistaa säännön piiriin kuuluvat kiellot ja maksut.'];
const lotteries = ['Arpajaislaki', 'Laki, jonka rikkomisesta annettuja kieltopäätöksiä ja seuraamusmaksuja käsitellään tässä kahden vuoden säännössä.'];

import { currentFrames } from './current-stories.js';

export const frames = {
  ...currentFrames(0),
  'sports-intro': {
    step: 'Mitä laki muuttaa',
    tag: 'Voimassa 1.7.2026 alkaen',
    title: 'Uusi vaihtoehto urheilijoiden eläketurvaan',
    lead: 'Suomi muutti eläketurvan sääntöjä, koska seurojen ja palkkaa saavien urheilijoiden oli vaikea saada eläkevakuutuksia.',
    chart: {caption: '', rows: [['Aiempi vaihtoehto', 'Säästöille kertyy korkoa'], ['Uusi vaihtoehto', 'Säästöt sidotaan sijoituksiin']]},
    notes: ['Seura järjestää yleensä vakuutuksen urheilijalle, jonka palkka yltää laissa säädettyyn rajaan. Uudessa vaihtoehdossa säästöjen arvo riippuu sijoitusten kehityksestä.'],
    more: [
      'Yksi eläkevakuuttaja lopetti tämän vakuutuksen tarjoamisen vuoden 2025 lopussa. Jäljelle jäänyt yhtiö tarjosi vakuutusta vain rajatulle ryhmälle. Moni urheilija oli vaarassa jäädä ilman eläkevakuutusta.',
      'Hallituksen mukaan vakuutusmarkkinoilla oli siirrytty sijoituksiin sidottuihin vakuutuksiin. Hallitus odotti muutoksen houkuttelevan lisää yhtiöitä tarjoamaan urheilijoiden eläkevakuutuksia.'
    ],
    sources: ['Laki 594/2026, 14 § ja voimaantulo', 'Hallituksen esitys, s. 2–3, uudistuksen tausta', 'Sosiaali- ja terveysministeriön tiedote', abbreviations, illustrations],
    terms: [bill, ['Eläkevakuutus', 'Vakuutus, johon kertyy säästöjä eläkkeen maksamista varten.'],
      ['Sijoitussidonnainen eläkevakuutus', 'Eläkevakuutus, jonka säästöjen arvo nousee tai laskee sen mukaan, miten sijoitukset kehittyvät.'],
      ['Palkkaraja', 'Vähimmäispalkka, jonka perusteella arvioidaan, onko seuran vakuutettava urheilija.']]
  },
  'sports-outcome': {
    step: 'Kenelle ilmoitus annetaan',
    tag: 'Ilmoituksen saajat',
    title: 'Vakuutuksen ottanut seura saa ilmoituksen',
    lead: 'Jos yhtiö aikoo supistaa urheilijavakuutusten tarjontaa tai lopettaa sen, sen on kerrottava siitä vakuutuksenottajalle. Tämä on usein urheilijan seura.',
    chart: {caption: 'Kenelle yhtiö ilmoittaa', rows: [['Ennen', 'Ministeriölle'], ['Nyt', 'Ministeriölle', 'Vakuutuksenottajalle']]},
    notes: ['Velvollisuus koskee lain mukaista tapaturma- ja eläketurvaa. Ilmoituksen saanut seura voi käyttää ajan uuden vakuuttajan etsimiseen.'],
    more: [
      'Kun seura ottaa vakuutuksen pelaajalleen, seura on vakuutuksenottaja ja pelaaja on vakuutettu. Lain ehdot täyttävä yksilöurheilija voi ottaa vakuutuksen itse ja olla molempia.',
      'Lain 16 a §:n mukainen ilmoitus menee sille, joka on tehnyt vakuutussopimuksen.'
    ],
    sources: [oldNotice, noticeLaw, 'Hallituksen esitys, kohta 2.1, vakuutusvelvollisuus'],
    terms: [policy, ['Vakuutettu urheilija', 'Urheilija, jolle vakuutus antaa tapaturma- tai eläketurvan.'], section16,
      ['Sosiaali- ja terveysministeriö (STM)', 'Ministeriö, joka valmisteli urheilijoiden vakuutusturvaa koskevan esityksen.']]
  },
  'sports-requests': {
    step: 'Mitä pelaajat pyysivät',
    tag: 'Lausunnot',
    title: 'Pelaajat halusivat tiedon aiemmin',
    lead: 'Jalkapallon Pelaajayhdistys (JPY) esitti muutoksia sekä ministeriölle että eduskunnalle.',
    chart: {rows: [['Kuinka ajoissa', 'Vähintään kaksi vuotta etukäteen'], ['Kenelle lisäksi', 'Vakuutuksenottajien ja urheilijoiden edustajille, kuten liigoille tai pelaajayhdistyksille']]},
    notes: ['Yhdistys teki ehdotukset maaliskuussa ministeriön lausuntokierroksella. Toukokuussa se toisti ne eduskunnan sosiaali- ja terveysvaliokunnalle.'],
    more: [
      'JPY:n mukaan urheilijoiden eläketurva ei voinut kestävästi nojata yhteen tarjoajaan. Yhdistys halusi ministeriölle tiedon vähintään kahta vuotta aiemmin. Ilmoitus olisi pitänyt antaa myös asianomaisille liigoille, lajiliitoille ja pelaajayhdistyksille.',
      'Myös Suomen Jääkiekkoilijat kannatti pidempää määräaikaa ja ilmoituksen laajentamista edustajille.'
    ],
    sources: [jpySubmission, 'JPY:n valiokuntalausunto, kuuleminen 12.5., kohta 1', 'Lausuntokierros, jalkapallo- ja jääkiekkopelaajien lausunnot', illustrations],
    terms: [jpy, submission, ['Edustava taho', 'Esimerkiksi liiga, lajiliitto tai pelaajayhdistys, joka puhuu seurojen tai urheilijoiden puolesta.'],
      ['Sosiaali- ja terveysvaliokunta (StV)', 'Eduskunnan valiokunta, joka kuuli asiantuntijoita ja antoi mietinnön tästä esityksestä.']]
  },
  'sports-deadline': {
    step: 'Milloin ilmoitus pitää antaa',
    tag: 'Määräaika',
    title: 'Vuodenvaihteen määräaika säilyi',
    lead: 'Vakuutusyhtiön pitää ilmoittaa vuoden loppuun mennessä, jos se aikoo muuttaa tarjontaansa seuraavan kalenterivuoden päätyttyä.',
    chart: {caption: 'Esimerkki', rows: [['31.12.2026', 'Viimeinen ilmoituspäivä'], ['1.1.2028', 'Yhtiö aikoo lopettaa vakuutuksen tarjoamisen']]},
    notes: ['Esimerkissä viimeisen ilmoituspäivän ja tarjonnan loppumisen väliin jää koko vuosi 2027. Yhtiön pitää ilmoittaa samaan määräaikaan mennessä sekä ministeriölle että vakuutuksenottajille.'],
    more: [
      'Jos yhtiö aikoo lopettaa tarjonnan 31.12.2028, määräaika on silti vuoden 2026 lopussa. Jos lopettamispäivä siirtyy 1.1.2029:ään, ilmoitus pitää antaa viimeistään 31.12.2027.',
      'JPY halusi vähintään kahden vuoden varoitusajan. Eduskunta säilytti kalenterivuoteen sidotun määräajan ja lisäsi vakuutuksenottajan ilmoituksen saajaksi.'
    ],
    sources: [oldNotice, noticeLaw, jpySubmission],
    terms: [['Ilmoitus', 'Ennakkotieto siitä, että yhtiö aikoo supistaa urheilijalain mukaista vakuutustarjontaa tai lopettaa sen.'],
      ['Kalenterivuosi', 'Aika tammikuun ensimmäisestä päivästä joulukuun viimeiseen päivään. Määräaika on sidottu vuodenvaihteeseen.'], policy, jpy]
  },
  'sports-versions': {
    step: 'Milloin pykälä muuttui',
    tag: 'Esitys eduskunnassa',
    title: 'Valiokunta lisäsi vakuutuksenottajan',
    lead: 'Ministeriö oli ollut ilmoituksen ainoa saaja vuodesta 2016.',
    chart: {rows: [
      ['Helmikuu 2026', 'Ministeriön luonnos', 'Ilmoitus ministeriölle'],
      ['16.4.2026', 'Esitys eduskuntaan', 'Ilmoitussääntö säilyy'],
      ['2.6.2026', 'Valiokunnan mietintö', 'Vakuutuksenottaja lisätään'],
      ['26.6.2026', 'Laki vahvistetaan', 'Molemmat saavat ilmoituksen']
    ]},
    notes: ['Huhtikuun esitys käsitteli urheilijoiden eläketurvan järjestämistä. Tässä tarkastelluista asiakirjoista vakuutuksenottaja ilmestyy ilmoituksen saajaksi ensimmäisen kerran valiokunnan mietinnössä.'],
    more: [
      'Helmikuussa ministeriö harkitsi erillistä eläkekassaa yhdeksi tavaksi järjestää turva. Luonnos olisi velvoittanut myös kassan ilmoittamaan, jos se aikoi supistaa vakuutustarjontaansa tai lopettaa sen.',
      'Hallitus luopui kassasta ennen esityksen antamista eduskunnalle. Eduskunta hyväksyi myöhemmin valiokunnan ehdotuksen ilmoituksen saajista.'
    ],
    sources: [oldNotice, 'Ministeriön helmikuun luonnos, 16 a § (Word)', 'Hallituksen esitys, lakiehdotus ja kohta 6',
      'Valiokunnan mietintö StVM 7/2026 vp, 16 a §', noticeLaw, 'Eduskunnan vastaus EV 83/2026 vp'],
    terms: [section16, ['Ministeriön luonnos', 'Lakitekstiehdotus, josta ministeriö pyytää palautetta ennen esityksen antamista eduskunnalle.'],
      healthReport, ['EV 83/2026 vp', 'Eduskunnan vastaus. Siitä käy ilmi, millaisen tekstin eduskunta hyväksyi.'],
      ['Laki 594/2026', 'Suomen säädöskokoelmassa julkaistun urheilijoiden vakuutusturvaa koskevan muutoslain numero.']]
  },
  'sports-reasons': {
    step: 'Miten valiokunta perusteli muutoksen',
    tag: 'Valiokunnan perustelut',
    title: 'Miksi myös vakuutuksenottaja?',
    lead: 'Ministeriön yhteenvedossa JPY oli yksi muutosta pyytäneistä tahoista. Hallitus käsitteli palautetta huhtikuun esityksessään. Valiokunta palasi asiaan kesäkuussa.',
    chart: {rows: [
      ['Miksi määräaika säilyi', 'Ministeriön mukaan pidempi varoitusaika voisi vähentää yhtiöiden halua tarjota vakuutuksia.'],
      ['Miksi vakuutuksenottaja lisättiin', 'Valiokunta katsoi, että ilmoitus auttaa turvaamaan vakuutuksen ottaneen seuran tai henkilön aseman.']
    ]},
    notes: ['Valiokunta käsitteli kuulemisissa esitettyjä pyyntöjä yhdessä. JPY:n osuus lopullisen sanamuodon synnyssä jää avoimeksi.'],
    more: [
      'Hallitus pelkäsi, että pidempi ilmoitusaika tai laajempi saajajoukko voisi vähentää yhtiöiden halua tarjota vakuutuksia. Se nosti esiin tämän huolen, kun se antoi lakiesityksen eduskunnalle.',
      'Valiokunta otti ministeriön huolen määräajasta huomioon. Se perusteli saajajoukon laajentamista vakuutussopimuksen tehneen tahon suojalla.'
    ],
    sources: ['Valiokunnan mietintö StVM 7/2026 vp, Ilmoitusvelvollisuus', 'Hallituksen esitys, kohta 6, lausuntopalaute',
      'Ministeriön lausuntoyhteenveto, s. 3', illustrations],
    terms: [jpy, policy, ['Lausuntoyhteenveto', 'Ministeriön kooste luonnokseen saadusta palautteesta. Siinä kerrotaan lausunnonantajien keskeiset näkemykset.'], healthReport]
  },
  'sports-disclosures': {
    step: 'Mitä JPY ilmoitti',
    tag: 'Avoimuusrekisteri',
    title: 'JPY ilmoitti lobbauksesta',
    lead: 'Pelaajayhdistys ilmoitti vaikuttaneensa ministeriöön urheilijoiden vakuutusturvaa koskevassa hankkeessa.',
    chart: {caption: 'Ilmoitusjakso', period: 'Tammi–kesäkuu 2026', months: ['Tammi', 'Helmi', 'Maalis', 'Huhti', 'Touko', 'Kesä']},
    notes: ['Rekisterissä näkyvät hankkeen nimi ja kuuden kuukauden ilmoitusjakso. JPY:n kirjallisilla lausunnoilla on omat päiväyksensä. Lobbausyhteydenottojen tarkat päivät eivät käy ilmi.'],
    more: [
      'Avoimuusrekisteriin ilmoitetaan eduskuntaan ja ministeriöihin kohdistuvasta lobbauksesta. Dokumentoiduista virallisista kuulemisista ei tarvitse ilmoittaa rekisteriin.',
      'Maaliskuun lausunnosta käy ilmi, millaista ilmoitusta JPY tavoitteli. Rekisterimerkintä kertoo, minkä hankkeen yhteydessä yhdistys ilmoitti lobanneensa.'
    ],
    sources: ['Avoimuusrekisteri, JAL-26-8286-T, aihe 35079', 'Avoimuusrekisterin ohje ilmoitettavasta toiminnasta', jpySubmission, illustrations],
    sourceURLs: {1: registerGuide},
    terms: [jpy, register, period, ['Dokumentoitu virallinen kuuleminen', 'Osa valmistelua, jossa viranomainen ottaa vastaan näkemyksiä ja kirjaa osallistujat tai annetut lausunnot.']]
  },
  'gambling-intro': {
    step: 'Mitä laki muuttaa',
    tag: 'Rahapeliuudistus',
    title: 'Suomi avaa vedonlyönnin kilpailulle',
    lead: 'Manner-Suomessa voi 1.7.2027 alkaen pelata myös valtion omistaman Veikkauksen kilpailijoilla, jos niillä on toimilupa.',
    chart: {caption: 'Esimerkkejä uuden lain piiristä', rows: [['Avautuu kilpailulle', 'Vedonlyönti ja nettikasinot'], ['Vain Veikkaus', 'Arvonnat ja raaputusarvat']]},
    notes: ['Hallituksen tavoitteena on saada suurempi osa pelaamisesta Suomen valvonnan piiriin ja vähentää pelihaittoja. Markkinoille tulevien yritysten on noudatettava pelaajien suojaa koskevia sääntöjä.'],
    more: [
      'Rahapeliyhtiöt saattoivat hakea toimilupia 1.3.2026 alkaen, ennen markkinoiden avaamista. Myös Veikkaus voi hakea kilpailulle avautuvien pelien toimilupia.',
      'Yksinoikeuteen jäävät esimerkiksi fyysiset kasinopelit ja raha-automaatit. Verkossa pelattava rahabingo puolestaan avautuu kilpailulle.'
    ],
    sources: ['Sisäministeriön tiedote uudesta rahapelilaista', 'Rahapelilaki 10/2026, 5–6 ja 106 § (PDF)', abbreviations, illustrations],
    sourceURLs: {0: 'https://valtioneuvosto.fi/sv/-/1410869/anordnandet-av-penningspel-oppnas-delvis-for-konkurrens?languageId=fi_FI'},
    terms: [bill, ['Veikkaus', 'Valtion omistama suomalainen rahapeliyhtiö. Osa sen yksinoikeuden piirissä olleista peleistä avautuu kilpailulle 1.7.2027.'],
      ['Rahapelitoimilupa', 'Viranomaisen lupa järjestää määrättyjä rahapelejä rahapelilain ehtojen mukaisesti.'],
      ['Yksinoikeustoimilupa', 'Lupa, joka varaa tietyt pelit yhdelle toimijalle. Esimerkkejä ovat arvonnat ja raaputusarvat.']]
  },
  'gambling-outcome': {
    step: 'Kuinka kauas lupatarkastus ulottuu',
    tag: 'Rahapelitoimiluvat',
    title: 'Vanhoja seuraamuksia katsotaan lyhyemmältä ajalta',
    lead: 'Aiempi kieltopäätös tai seuraamusmaksu voi yhä estää toimiluvan. Tarkasteluaika kertoo, kuinka kauas taaksepäin viranomainen katsoo.',
    chart: {caption: 'Kuinka kaukaa seuraamukset huomioidaan', rows: [['Ensimmäinen luonnos', '5 vuotta'], ['Vahvistettu laki', '2 vuotta']], axis: ['Kauempana menneisyydessä', 'Luvan arviointipäivä']},
    notes: ['Viranomainen on esimerkiksi voinut kieltää rahapelien markkinoinnin arpajaislain rikkomisen vuoksi. Tällainen päätös otetaan huomioon, jos se täyttää säännön aikarajat.'],
    more: [
      'Ratkaisevaa on kiellon antamis- tai maksun määräämispäivä. Päätös huomioidaan, jos se mahtuu kahden vuoden tarkasteluaikaan ja on tehty kiinteän rajapäivän jälkeen.',
      'Samassa pykälässä on erillinen kolmen vuoden tarkasteluaika tietyille kielloille ja maksuille, jotka koskevat rahapelien tarjoamista tai markkinointia ilman uuden lain edellyttämää lupaa.'
    ],
    sources: ['Heinäkuun 2024 luonnos, 10 §, s. 309', gamblingCheck, gamblingEnglish],
    terms: [lookback, lotteries, ['Kieltopäätös', 'Viranomaisen määräys lopettaa toiminta, kuten arpajaislain vastainen rahapelimarkkinointi.'],
      ['Seuraamusmaksu', 'Viranomaisen määräämä maksu lain rikkomisesta.']]
  },
  'gambling-requests': {
    step: 'Mitä Betsson pyysi',
    tag: 'Lausunto',
    title: 'Betsson pyysi poistamaan lupaesteen',
    lead: 'Rahapeliyhtiö esitti sisäministeriölle kaksi vaihtoehtoa elokuussa 2024 antamassaan lausunnossa.',
    chart: {rows: [['Ensisijainen pyyntö', 'Poistakaa aiempiin kieltoihin tai maksuihin perustuva lupaeste'], ['Jos este jää voimaan', 'Tarkastelkaa päätöksiä enintään kahden vuoden ajalta']]},
    notes: ['Betssonin mukaan lupasäännön soveltaminen aiempiin rikkomuksiin antaisi niille uusia seurauksia. Myös rahapeliyhtiö Kindred arvosteli viiden vuoden rajaa. Alan suomalainen yhdistys pyysi lyhyempää aikaa.'],
    more: [
      'Selinin tutkimuksessa useat kansainväliset yhtiöt ja etujärjestöt perustelivat kantaansa oikeudellisilla syillä. European Gaming and Betting Association toi samanlaisia huolia esiin eduskunnan kuulemisissa.',
      'Lopullisen lain kaksi vuotta vastaa Betssonin varavaihtoehtoa kyseisten seuraamusten osalta. Kiellot ja maksut säilyivät luvan epäämisen perusteena.'
    ],
    sources: ['Betssonin lausunto, s. 6 ja 15', 'Ministeriön lausuntoyhteenveto, 10 §', 'Jani Selinin tutkimus, tulokset ja pohdinta', illustrations],
    terms: [['Betsson Group', 'Rahapeliyhtiö, joka teki tässä kuvatut ehdotukset.'],
      ['Kindred', 'Verkkorahapeliyhtiö, joka antoi oman lausuntonsa luonnoksesta.'],
      ['EGBA', 'European Gaming and Betting Association, verkkorahapeliyhtiöiden eurooppalainen toimialajärjestö.'], submission]
  },
  'gambling-versions': {
    step: 'Mitä rajapäivä tarkoittaa',
    tag: 'Lain sanamuoto',
    title: 'Kahden vuoden säännössä on myös rajapäivä',
    lead: 'Viranomainen huomioi tietyt arpajaislain mukaiset päätökset, jotka on tehty luvan arviointia edeltäneiden kahden vuoden aikana ja 1.9.2024 jälkeen.',
    chart: {rows: [
      ['Heinäkuu 2024', 'Ministeriön luonnos', 'Viisi vuotta'],
      ['Maaliskuu 2025', 'Esitys eduskuntaan', 'Kaksi vuotta ja rajapäivä'],
      ['Joulukuu 2025', 'Valiokunnan mietintö', 'Sääntö säilyy'],
      ['Tammikuu 2026', 'Laki vahvistetaan', 'Sääntö säilyy']
    ]},
    notes: [
      'Kuvitellaan, että lupahakemus arvioidaan 1.3.2026. Heinäkuun 2024 päätös on alle kaksi vuotta vanha. Se jää säännön ulkopuolelle, koska se tehtiin ennen rajapäivää. Vastaava päätös 2.9.2024 mahtuu molempiin aikarajoihin.',
      'Tutkija Jani Selinin mukaan alan vastustus saattoi vaikuttaa tarkasteluajan lyhenemiseen. Betssonin osuus jää avoimeksi.'
    ],
    more: [
      'Sääntö koskee arpajaislain vastaisesta rahapelien tarjoamisesta tai markkinoinnista annettuja kieltoja ja määrättyjä seuraamusmaksuja. Hallitus perusteli pykälää tarpeella arvioida hakijan soveltuvuutta rahapelitoimintaan.',
      'Selin tutki 36 alan toimijoiden lausuntoa. Näistä 19 annettiin ministeriön lausuntokierroksella ja 17 eduskunnan kuulemisissa. Analyysi perustuu näihin julkisiin lausuntoihin.'
    ],
    sources: ['Ministeriön luonnos, 10 §, s. 309', 'Hallituksen esitys, 10 § ja sen perustelut', 'Hallintovaliokunnan mietintö HaVM 28/2025 vp, 10 §',
      gamblingCheck, 'Jani Selinin tutkimus (THL), pohdinta', gamblingEnglish],
    terms: [['Rajapäivä', 'Päivä, jonka jälkeen kiellon tai maksun täytyy olla määrätty, jotta se lasketaan mukaan. Tässä säännössä rajapäivä on 1.9.2024.'],
      lookback, lotteries, administrationReport, ['THL', 'Terveyden ja hyvinvoinnin laitos. Jani Selinin tutkimuksessa se on merkitty tutkijan taustaorganisaatioksi.']]
  },
  'gambling-pool-betting': {
    step: 'Mikä muuttuu hevospelissä',
    tag: 'Hevosvedonlyönti',
    title: 'Totopelit avautuvat kilpailulle',
    lead: 'Totopelissä panokset kootaan yhteiseen pottiin, josta voittajille maksetaan. Ruotsalainen rahapeliyhtiö ATG ehdotti, että Suomi avaisi totopelit kilpailulle.',
    chart: {caption: '', rows: [['Heinäkuun 2024 luonnos', 'Vain Veikkaus'], ['Vahvistettu laki', 'Avoin luvan saaneille']]},
    notes: [
      'Talouspoliittinen ministerivaliokunta linjasi 1.11.2024, että totopelit avataan kilpailulle muun vedonlyönnin tavoin. Lakiesitys oli silloin vielä valmisteilla.',
      'Myös Suomen Hippos kannatti avaamista. Paf halusi pitää totopelit yksinoikeuden piirissä. ATG:n vaikutus päätökseen jää avoimeksi.'
    ],
    more: [
      'Hallitus punnitsi, oliko perusteltua kohdella hevosvedonlyöntiä eri tavalla kuin muuta vedonlyöntiä. Esityksen mukaan toimiluvan saaneiden yhtiöiden kansainvälinen yhteistyö voisi parantaa hevospelien kilpailukykyä.',
      'Hallitus arvioi myös, voisiko kilpailun avaaminen lisätä markkinointia. Nämä perustelut sisältyivät eduskunnalle annettuun esitykseen.'
    ],
    sources: ['Ministeriön luonnos, 5–6 §, s. 307', 'ATG:n lausunto, s. 3–5', 'Ministeriön lausuntoyhteenveto, s. 18–22', 'Hallituksen linjaus 1.11.2024',
      'Hallituksen esitys, kohta 5.1.3 hevospelien asemasta (PDF)', 'Rahapelilaki 10/2026, 4–6 § (PDF)', illustrations],
    terms: [['Totopeli', 'Hevoskilpailuun perustuva peli, jossa panokset kootaan yhteen ja voittajille jaetaan voitoille varattu osuus.'],
      ['ATG', 'AB Trav och Galopp, ruotsalainen hevospeliyhtiö.'], ['Suomen Hippos', 'Suomen raviurheilun ja hevoskasvatuksen valtakunnallinen keskusjärjestö.'],
      ['Paf', 'Ålands Penningautomatförening, Ahvenanmaalla toimiva rahapeliyhtiö.'],
      ['Ministerivaliokunta', 'Ministerien muodostama ryhmä. Totopelien avaamisesta linjasi talouspoliittinen ministerivaliokunta.']]
  },
  'gambling-register': {
    step: 'Mitä Veikkaus ilmoitti',
    tag: 'Avoimuusrekisteri',
    title: 'Veikkaus ilmoitti lobbauksesta',
    lead: 'Valtion rahapeliyhtiö ilmoitti vaikuttaneensa ministeriöön ja eduskuntaan rahapeliuudistuksesta.',
    chart: {caption: 'Ilmoitusjakso', period: 'Huhti–kesäkuu 2024', months: ['Huhti', 'Touko', 'Kesä']},
    notes: ['Ilmoitusjakso päättyi ennen kuin ministeriö julkaisi luonnoksensa heinäkuussa 2024. Ilmoituksen aihe on uudistus kokonaisuudessaan. Yksittäisten yhteydenottojen tarkat päivät eivät käy ilmi.'],
    more: [
      'Rekisterin hankenumero vastaa sisäministeriön valmisteluasiakirjoissa olevaa tunnusta. Ministeriö asetti hankkeen lokakuussa 2023.',
      'Veikkaus ilmoitti omasta lobbaustoiminnastaan. Rekisteri kertoo ilmoitusjakson, aiheen ja vaikuttamisen kohteet.'
    ],
    sources: ['Avoimuusrekisteri, VEI-24-699-T, aihe 2864', 'Sisäministeriön hanke ja heinäkuun 2024 luonnos', 'Avoimuusrekisterin ohje ilmoitettavasta toiminnasta', illustrations],
    sourceURLs: {2: registerGuide},
    terms: [register, ['Lobbaus', 'Yhteydenpito päättäjiin tavoitteena vaikuttaa käsiteltävään asiaan. Tässä Veikkaus ilmoitti omasta toiminnastaan.'],
      period, ['Hanketunnus SM053:00/2023', 'Sisäministeriön rahapelihankkeen tunnus. Sen avulla rekisteri-ilmoitus voidaan yhdistää valmisteluasiakirjoihin.']]
  },
  'gambling-disclosures': {
    step: 'Mitä kansanedustaja ilmoitti',
    tag: 'Lahjailmoitus',
    title: 'Edustaja ilmoitti Veikkaukselta saadun lipun',
    lead: 'Ville Kaunisto oli talousvaliokunnan varapuheenjohtaja, kun valiokunta käsitteli rahapeliesitystä.',
    chart: {ticket: ['Koripallolippu', '490 €'], rows: [
      ['7.5.2025', 'Valiokunnan asiakirja', 'Kaunisto osallistuu lausunnon ratkaisevaan käsittelyyn'],
      ['27.8.2025', 'Lahjailmoitus', 'Ilmoitettu käyttöpäivä'],
      ['16.9.2025', 'Lahjailmoitus', 'Kaunisto jättää ilmoituksen']
    ]},
    notes: [
      'Lippu oli Suomen ja Ruotsin koripallo-otteluun. Lahjan antajaksi on merkitty Veikkaus, jonka yksinoikeutta esitys koski. Toukokuun päivämäärä on valiokunnan asiakirjasta. Myöhemmät päivät ovat Kauniston ilmoituksesta.',
      'Tarjoamis- ja vastaanottopäivät ovat tuntemattomia. Lipun mahdollinen vaikutus valiokunnan lausuntoon jää avoimeksi.'
    ],
    more: [
      'Talousvaliokunta antoi lakiesityksestä lausunnon. Esityksen käsittelystä vastasi hallintovaliokunta, joka antoi mietintönsä joulukuussa 2025.',
      'Osallistujaluettelo kertoo Kauniston tehtävästä valiokunnassa. Lipun käyttöpäivä ja arvo ovat hänen omasta ilmoituksestaan. Veikkauksen aiempi rekisterimerkintä koskee sen lobbausta rahapeliuudistuksesta.'
    ],
    sources: ['Talousvaliokunnan lausunto TaVL 12/2025 vp, osallistujat', 'Eduskunnan lahjailmoitus, edustaja 1425, vuoden 2025 merkintä 20',
      'Lahjan antajan ilmoitus uudistuksesta, aihe 2864', 'Hallintovaliokunnan mietintö HaVM 28/2025 vp'],
    terms: [['Kansanedustaja', 'Vaalilla eduskuntaan valittu edustaja. Lahjan ilmoitti kansanedustaja Ville Kaunisto.'],
      ['Lahjailmoitus', 'Kansanedustajan ilmoitus saadusta lahjasta tai edusta. Siinä voidaan ilmoittaa esimerkiksi antaja ja lahjan arvo.'],
      ['TaVL 12/2025 vp', 'Talousvaliokunnan lausunto rahapeliesityksestä. Valiokunta antoi siinä näkemyksensä esitystä käsittelevälle hallintovaliokunnalle.'],
      administrationReport]
  }
};
