const checked = ['Tilanne 16.11.2026', 'Läget den 16 november 2026', 'Status on 16 November 2026'];

const entries = [
  {
    id: 'valmiuslaki', proposal: 'HE 294/2026 vp', cover: 'waves',
    frames: ['intro', 'powers'],
    names: ['Valmiuslaki', 'Beredskap', 'Emergency powers'],
    status: ['Esitys puolustusvaliokunnassa.', 'Propositionen i försvarsutskottet.', 'Bill with the Defence Committee.'],
    urls: [
      'https://data.finlex.fi/fi/hallituksen-esitykset/2026/294',
      'https://valtioneuvosto.fi/-/1410853/hallitus-esittaa-uutta-valmiuslakia-',
      'https://www.eduskunta.fi/asiat-ja-aanestykset/valtiopaivaasiat/HE%20294%2F2026%20vp'
    ],
    news: [
      ['Yle', '2026-11-05', 'https://yle.fi/uutiset/lyhyesti/74-20255321', ['Hallitus esittää uutta valmiuslakia', 'Regeringen föreslår en ny beredskapslag', 'Government proposes a new Emergency Powers Act']]
    ],
    copy: [
      {
        sources: ['HE 294/2026 vp · Finlex', 'Oikeusministeriön tiedote 5.11.', 'Asian käsittely · Eduskunta'],
        frames: [
          ['Juomavesi kriisissä', 'Miten veden säännöstely voitaisiin ottaa käyttöön?', 'Hallitus antoi 5.11. esityksen uudeksi valmiuslaiksi. Talousveden säännöstely on yksi ehdotetuista uusista valtuuksista.',
            [['Varautuminen', 'Viranomaisten velvoitteet häiriöihin varautumisessa täsmentyisivät.'], ['Poikkeusolot', 'Viranomaiset voisivat ottaa käyttöön erityisiä valtuuksia lain ehdoin.']],
            'Esitys sisältää uusia keinoja myös ruoantuotannon ja energiahuollon jatkuvuuden turvaamiseen.',
            ['Talousvesi', 'Esimerkiksi juomiseen ja ruoanlaittoon käytettävä vesi.']],
          ['Käyttöönotto', 'Kriisivaltuuksien käyttöönotto vaatisi erillisen päätöksen', 'Valtioneuvosto toteaisi poikkeusolot yhteistoiminnassa presidentin kanssa.',
            [['Valtioneuvosto', 'Lisävaltuudet otettaisiin käyttöön asetuksella.'], ['Eduskunta', 'Käsittelisi käyttöönottoasetuksen.']],
            'Lisävaltuuksien käyttö edellyttäisi, että tavalliset toimivaltuudet eivät riitä ja toimet ovat välttämättömiä ja oikeasuhtaisia. Eduskunta lähetti esityksen puolustusvaliokuntaan 11.11.',
            ['Käyttöönottoasetus', 'Valtioneuvoston asetus, jolla se määrittelee, mitä lisävaltuuksia otetaan käyttöön.']]
        ]
      },
      {
        sources: ['RP 294/2026 rd · Finlex', 'Justitieministeriets meddelande 5.11', 'Behandlingen · Riksdagen'],
        frames: [
          ['Dricksvatten i en kris', 'Hur skulle vattenransonering kunna införas i en kris?', 'Regeringen lade fram förslaget till ny beredskapslag den 5 november. Ransonering av hushållsvatten hör till de föreslagna nya befogenheterna.',
            [['Beredskap', 'Myndigheternas beredskapsskyldigheter skulle preciseras.'], ['Undantagsförhållanden', 'Myndigheterna skulle kunna använda särskilda befogenheter enligt lagens villkor.']],
            'Förslaget innehåller också nya verktyg för att trygga energi- och livsmedelsproduktionen.',
            ['Hushållsvatten', 'Vatten som används exempelvis till dryck och matlagning.']],
          ['Ibruktagande', 'Extra befogenheter skulle kräva ett särskilt beslut', 'Statsrådet skulle konstatera undantagsförhållanden i samverkan med presidenten.',
            [['Statsrådet', 'Tar i bruk befogenheter genom en förordning.'], ['Riksdagen', 'Behandlar förordningen.']],
            'Ordinarie befogenheter måste vara otillräckliga och åtgärderna nödvändiga och proportionerliga. Riksdagen remitterade förslaget till försvarsutskottet den 11 november.',
            ['Förordning om ibruktagande', 'Statsrådets förordning som anger vilka extra befogenheter som tas i bruk.']]
        ]
      },
      {
        sources: ['Government bill HE 294/2026 · Finlex', 'Ministry of Justice announcement, 5 Nov', 'Bill progress · Parliament'],
        frames: [
          ['Water in a crisis', 'How could water rationing be introduced in a crisis?', 'The government introduced its Emergency Powers Act bill on 5 November. Rationing water for household use is among the proposed new powers.',
            [['Preparedness', 'The bill would spell out how authorities should prepare for disruption.'], ['Emergency conditions', 'Authorities could use additional powers under the conditions in the bill.']],
            'The bill also proposes new tools to keep energy and food production running.',
            ['Water for household use', 'Water used for activities such as drinking and cooking.']],
          ['Activation', 'Emergency powers would require a separate decision', 'The government would determine that emergency conditions exist in cooperation with the president.',
            [['Government', 'Would activate additional powers by decree.'], ['Parliament', 'Would review the activation decree.']],
            'Ordinary powers must be insufficient and the measures necessary and proportionate. Parliament referred the bill to the Defence Committee on 11 November.',
            ['Activation decree', 'A government decree specifying which emergency powers take effect.']]
        ]
      }
    ]
  },
  {
    id: 'rajaturvallisuuslaki', proposal: 'HE 148/2026 vp', cover: 'border',
    frames: ['intro', 'parliament'],
    names: ['Rajalain jatko', 'Gränssäkerhet', 'Border security'],
    status: ['Ensimmäinen käsittely päättyi 12.11.2026.', 'Första behandlingen avslutades den 12 november 2026.', 'First reading ended on 12 November 2026.'],
    urls: [
      'https://data.finlex.fi/fi/hallituksen-esitykset/2026/148',
      'https://verkkolahetys.eduskunta.fi/fi/taysistunnot/taysistunto-111-2026?end=10480&start=21',
      'https://www.eduskunta.fi/asiat-ja-aanestykset/valtiopaivaasiat/HE%20148%2F2026%20vp'
    ],
    news: [
      ['Yle / STT', '2026-11-11', 'https://yle.fi/a/74-20256375', ['Hallintovaliokunta puoltaa rajalain jatkoa', 'Förvaltningsutskottet stöder en förlängning', 'Administration Committee backs an extension']],
      ['Yle', '2026-10-16', 'https://yle.fi/a/74-20251787', ['Perustuslakivaliokunnan kanta ja oikeuskanslerin huomiot', 'Grundlagsutskottets ståndpunkt och justitiekanslerns synpunkter', 'Constitutional Law Committee position and Chancellor of Justice concerns']]
    ],
    copy: [
      {
        sources: ['HE 148/2026 vp · Finlex', 'Ensimmäinen käsittely 12.11. · Eduskunta', 'Asian käsittely · Eduskunta'],
        frames: [
          ['Voimassaoloaika', 'Mitä rajalain kahden vuoden jatko tarkoittaisi?', 'Esitys muuttaisi 7 §:ää ja jatkaisi väliaikaista lakia vuoden 2028 loppuun.',
            [['Rajaturvallisuuslaki', 'Mahdollistaa suojeluhakemusten vastaanoton rajoittamisen rajatulla alueella, jos lain ehdot täyttyvät.'], ['Rajavartiolaki', 'Itärajan rajanylityspaikkojen sulku perustuu tämän lain 16 §:ään.']],
            'Voimassa olevan väliaikaisen lain päättymispäivä on 31.12.2026. Esitys siirtäisi sen päivään 31.12.2028.',
            ['Välineellistetty maahantulo', 'Maahantulon käyttäminen keinona painostaa toista valtiota.']],
          ['Eduskuntakäsittely', 'Ensimmäisessä käsittelyssä päätettiin sisällöstä', 'Eduskunta hyväksyi ehdotuksen sisällön hallintovaliokunnan mietinnön mukaisesti 12.11.',
            [['Hallintovaliokunta', 'Puolsi jatkoa turvallisuustilanteen vuoksi.'], ['Vastalause', 'Mietintöön liitettiin ehdotus lakiesityksen hylkäämisestä.']],
            'Lain hyväksymisestä tai hylkäämisestä päätetään toisessa käsittelyssä. Ajantasainen tilanne näkyy eduskunnan asiakortissa.',
            ['Ensimmäinen käsittely', 'Täysistunnon vaihe, jossa päätetään lakiehdotuksen sisällöstä.']]
        ]
      },
      {
        sources: ['RP 148/2026 rd · Finlex', 'Första behandlingen 12.11 · Riksdagen', 'Behandlingen · Riksdagen'],
        frames: [
          ['Giltighetstid', 'Vad skulle två år till med gränssäkerhetslagen innebära?', 'Förslaget skulle ändra 7 § och förlänga den tillfälliga lagen till slutet av 2028.',
            [['Gränssäkerhetslagen', 'Ger under vissa villkor befogenhet att begränsa mottagandet av skyddsansökningar inom ett avgränsat område.'], ['Gränsbevakningslagen', 'Östgränsens övergångsställen stängdes med stöd av 16 § i den lagen.']],
            'Den tillfälliga lagen gäller till den 31 december 2026. Förslaget skulle flytta datumet till den 31 december 2028.',
            ['Instrumentaliserad inresa', 'Att använda inresa som ett sätt att utöva påtryckningar mot en annan stat.']],
          ['Riksdagen', 'Första behandlingen avgjorde innehållet', 'Riksdagen godkände innehållet i enlighet med förvaltningsutskottets betänkande den 12 november.',
            [['Förvaltningsutskottet', 'Stödde förlängningen med hänvisning till säkerhetsläget.'], ['Reservation', 'En reservation till betänkandet föreslog att förslaget skulle förkastas.']],
            'Vid andra behandlingen avgör riksdagen om lagen antas eller förkastas. Följ det aktuella läget på riksdagens ärendesida.',
            ['Första behandlingen', 'Plenumskedet då innehållet i lagförslaget avgörs.']]
        ]
      },
      {
        sources: ['Government bill HE 148/2026 · Finlex', 'First reading, 12 Nov · Parliament', 'Bill progress · Parliament'],
        frames: [
          ['Proposed extension', 'What would two more years of the border law mean?', 'The bill would amend section 7 and extend the temporary law through the end of 2028.',
            [['Temporary border law', 'Allows restrictions on accepting protection applications within a specified area under conditions set in law.'], ['Border Guard Act', 'Section 16 is the legal basis for closing the eastern border crossings.']],
            'The temporary law runs until 31 December 2026. The bill would move that date to 31 December 2028.',
            ['Instrumentalised migration', 'Using migration as a way to put pressure on another state.']],
          ['Parliament', 'First reading settled the bill’s wording', 'Parliament agreed to the wording in the Administration Committee report on 12 November.',
            [['Administration Committee', 'Backed the extension on security grounds.'], ['Dissent', 'A dissent attached to the report proposed rejecting the bill.']],
            'Parliament decides whether to pass or reject the bill at second reading. The bill record shows its latest status.',
            ['First reading', 'The stage at which the plenary decides the wording of the bill.']]
        ]
      }
    ]
  },
  {
    id: 'ihmiskauppa', proposal: 'HE 127/2026 vp', cover: 'register',
    frames: ['intro', 'recording'],
    names: ['Ihmiskauppa', 'Människo\u00adhandel', 'Trafficking'],
    status: ['Vahvistettu · voimaan 1.12.2026.', 'Stadfäst · träder i kraft den 1 december 2026.', 'Enacted · takes effect on 1 December 2026.'],
    urls: [
      'https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/2026/976',
      'https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/2026/980',
      'https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/2026/981'
    ],
    news: [
      ['Yle', '2026-11-13', 'https://yle.fi/a/74-20256431', ['Taustaa · Poliisin ihmiskauppaepäily metsätöissä', 'Bakgrund · Misstänkt människohandel inom skogsarbete', 'Background · Suspected trafficking in forestry work']]
    ],
    copy: [
      {
        sources: ['Rikoslain muutos 976/2026', 'Oikeudenkäymiskaaren muutos 980/2026', 'Esitutkintalain muutos 981/2026'],
        frames: [
          ['Uusi rikosnimike', 'Ihmiskaupan uhrin palvelun tietoinen käyttö kriminalisoidaan', 'Uusi säännös koskee palvelua, jonka henkilö suorittaa ihmiskaupan uhrin asemassa. Palvelun käyttäjän on tiedettävä, että henkilö on ihmiskaupan uhri.',
            [['Rikoslaki', 'Rangaistus on sakkoa tai enintään kaksi vuotta vankeutta.'], ['Todistelu', 'Kuulustelutallenteen käyttö laajenee uuden rikoksen asianomistajiin.']],
            'Muutokset vahvistettiin 6.11.2026. Kuulustelutallenteen käyttämiselle on laissa omat ehtonsa.',
            ['Asianomistaja', 'Rikosasiassa henkilö, johon rikos on kohdistunut tai jonka oikeutta se on loukannut.']],
          ['Kuulustelutallenne', 'Milloin tallenne voi toimia todisteena?', 'Tallenne tehdään esitutkinnassa. Syytetylle on annettava asianmukainen mahdollisuus esittää kuulusteltavalle kysymyksiä.',
            [['15–17-vuotias', 'Tallennetta voidaan käyttää, jos asianomistaja ei halua tulla oikeudenkäyntiin kuultavaksi.'], ['Täysi-ikäinen', 'Oikeudessa kuulemisen pitäisi vaarantaa terveys tai aiheuttaa muuta vastaavaa merkittävää haittaa.']],
            'Näitä ikäryhmiä koskevaa sääntöä sovelletaan jo ihmiskauppaan ja törkeään ihmiskauppaan. Muutos ulottaa sen myös uuteen rikosnimikkeeseen.',
            ['Esitutkinta', 'Rikosepäilyn selvittäminen ennen mahdollista oikeudenkäyntiä.']]
        ]
      },
      {
        sources: ['Ändring av strafflagen 976/2026', 'Ändring av rättegångsbalken 980/2026', 'Ändring av förundersökningslagen 981/2026'],
        frames: [
          ['Nytt brott', 'Att med vetskap använda ett offers tjänst blir straffbart', 'Bestämmelsen gäller en tjänst som en person utför i egenskap av offer för människohandel. Den som använder tjänsten måste känna till personens situation.',
            [['Strafflagen', 'Straffet är böter eller fängelse i högst två år.'], ['Bevisning', 'Möjligheten att använda inspelade förhör utvidgas till målsägande i det nya brottet.']],
            'Ändringarna stadfästes den 6 november 2026. Lagen ställer särskilda villkor för att använda en inspelning.',
            ['Målsägande', 'En person som utsatts för brott eller vars rätt har kränkts genom det.']],
          ['Inspelat förhör', 'När kan inspelningen användas som bevis?', 'Inspelningen görs under förundersökningen. Den åtalade ska få en tillbörlig möjlighet att ställa frågor till den som förhörs.',
            [['15–17 år', 'Inspelningen kan användas om målsäganden inte vill höras vid rättegången.'], ['Vuxen', 'Förhör vid rättegången skulle äventyra hälsan eller medföra jämförbar betydande olägenhet.']],
            'Regeln för dessa åldersgrupper gäller redan människohandel och grov människohandel. Den utvidgas till det nya brottet.',
            ['Förundersökning', 'Utredning av ett misstänkt brott före en eventuell rättegång.']]
        ]
      },
      {
        sources: ['Criminal Code amendment 976/2026', 'Code of Judicial Procedure amendment 980/2026', 'Criminal Investigation Act amendment 981/2026'],
        frames: [
          ['New offence', 'Knowingly using a trafficking victim’s service becomes a crime', 'The new offence concerns a service performed by a person in their situation as a trafficking victim. The user of the service must know that the person is a victim.',
            [['Criminal Code', 'Punishable by a fine or up to two years in prison.'], ['Evidence', 'Recorded pre-trial interviews can be used for victims of the new offence under specified conditions.']],
            'The amendments were signed on 6 November 2026. The law sets specific conditions for using a recording.',
            ['Injured party', 'A person against whom a crime was committed or whose rights it violated.']],
          ['Recorded interview', 'When can a recording be used as evidence?', 'The interview is recorded during the pre-trial investigation. The accused must have a proper opportunity to put questions to the person interviewed.',
            [['Aged 15–17', 'A recording can be used if the injured party does not want to be heard at trial.'], ['Adults', 'Being heard at trial would endanger the person’s health or cause comparable significant harm.']],
            'The rule for these age groups already applies to trafficking and aggravated trafficking. The amendment adds the new offence.',
            ['Pre-trial investigation', 'The investigation of a suspected offence before a possible trial.']]
        ]
      }
    ]
  },
  {
    id: 'sosiaalihuoltolaki', proposal: 'HE 180/2026 vp', cover: 'discussion',
    frames: ['intro', 'access'],
    names: ['Sosiaali\u00adhuolto', 'Socialvård', 'Social welfare'],
    status: ['Esitys sosiaali- ja terveysvaliokunnassa.', 'Propositionen i social- och hälsovårdsutskottet.', 'Bill with the Social Affairs and Health Committee.'],
    urls: [
      'https://data.finlex.fi/fi/hallituksen-esitykset/2026/180',
      'https://valtioneuvosto.fi/-/1271139/hallitus-esittaa-sosiaalihuoltolain-uudistamista-tavoitteena-joustavammat-palvelut-ja-oikea-aikainen-tuki',
      'https://valtioneuvosto.fi/-/sosiaalihuoltolain-vaikutuksia-asiakkaille-arvioitava-tarkemmin',
      'https://www.eduskunta.fi/fi/asiat-ja-aanestykset/valtiopaivaasiat/HE%20180%2F2026%20vp'
    ],
    news: [
      ['Yle', '2026-02-11', 'https://yle.fi/a/74-20209488', ['Taustaa · Työryhmän ehdotukset sosiaalihuollon säästöistä', 'Bakgrund · Arbetsgruppens sparförslag', 'Background · Working group’s proposals for social welfare savings']]
    ],
    copy: [
      {
        sources: ['HE 180/2026 vp · Finlex', 'Sosiaali- ja terveysministeriön tiedote', 'Arviointineuvoston huomiot', 'Asian käsittely · Eduskunta'],
        frames: [
          ['Palvelut', 'Mitä kuntouttavan työtoiminnan tilalle ehdotetaan?', 'Hallitus yhdistäisi kuntouttavan työtoiminnan, sosiaalisen kuntoutuksen sekä kaksi vammaisten työ- ja työllistymispalvelua.',
            [['Uusi palvelu', 'Hyvinvointialue järjestäisi toimintakyvyn ja osallisuuden tukea.'], ['Käytännössä', 'Palveluun voisi kuulua esimerkiksi työtoimintaa, valmennusta tai ryhmätoimintaa.']],
            'Ehdotus on osa laajempaa sosiaalihuoltolain uudistusta. Sosiaali- ja terveysvaliokunta kuulee asiasta asiantuntijoita.',
            ['Hyvinvointialue', 'Sosiaali- ja terveyspalveluja järjestävä alueellinen toimija.']],
          ['Saatavuus', 'Miten uuden palvelun saatavuus turvattaisiin?', 'Osallistuminen olisi vapaaehtoista. Hyvinvointialue järjestäisi palvelua määrärahojensa puitteissa.',
            [['Vaikutusarvio', 'Arviointineuvosto pyysi valmistelussa tarkempaa arviota vaikutuksista työttömiin ja erityistä tukea tarvitseviin aikuisiin.'], ['Seurattavaa', 'Miten palvelun saatavuus toteutuisi eri hyvinvointialueilla?']],
            'Hyvinvointialueiden palvelujen saatavuus on avoin seurantakysymys. Eduskunnan asiakortista näet, miten käsittely etenee.',
            ['Määrärahasidonnainen', 'Palvelua järjestetään käytettävissä olevan rahoituksen puitteissa.']]
        ]
      },
      {
        sources: ['RP 180/2026 rd · Finlex', 'Social- och hälsovårdsministeriets meddelande', 'Bedömningsrådets synpunkter', 'Behandlingen · Riksdagen'],
        frames: [
          ['Tjänster', 'Vad föreslås ersätta rehabiliterande arbetsverksamhet?', 'Regeringen vill samla arbetsverksamhet i rehabiliteringssyfte, social rehabilitering och två arbets- och sysselsättningstjänster för personer med funktionsnedsättning.',
            [['Ny tjänst', 'Välfärdsområdet skulle ordna stöd för funktionsförmåga och delaktighet.'], ['I praktiken', 'Tjänsten kan omfatta arbetsverksamhet, handledning eller gruppverksamhet.']],
            'Förslaget ingår i en bredare reform av socialvårdslagen. Social- och hälsovårdsutskottet hör sakkunniga.',
            ['Välfärdsområde', 'Regional aktör som ordnar social- och hälsovårdstjänster.']],
          ['Tillgång', 'Hur skulle tillgången till den nya tjänsten tryggas?', 'Deltagandet skulle vara frivilligt. Välfärdsområdet skulle ordna tjänsten inom ramen för anslagen.',
            [['Konsekvenser', 'Bedömningsrådet efterlyste en närmare bedömning av följderna för arbetslösa och vuxna som behöver särskilt stöd.'], ['Att följa', 'Hur skulle tillgången fungera i olika välfärdsområden?']],
            'Tillgången i olika välfärdsområden är en öppen fråga. Följ beredningen på riksdagens ärendesida.',
            ['Anslagsbunden', 'Tjänsten ordnas inom ramen för tillgängliga anslag.']]
        ]
      },
      {
        sources: ['Government bill HE 180/2026 · Finlex', 'Ministry of Social Affairs and Health announcement', 'Impact assessment council’s findings', 'Bill progress · Parliament'],
        frames: [
          ['Services', 'What would replace rehabilitative work activity?', 'The government would combine rehabilitative work, social rehabilitation and two work and employment services for people with disabilities.',
            [['New service', 'Wellbeing services counties would provide support for functional capacity and participation.'], ['In practice', 'Support could include work activities, coaching or group activities.']],
            'The bill is part of a broader reform of the Social Welfare Act. The Social Affairs and Health Committee is hearing experts.',
            ['Wellbeing services county', 'A regional authority that organises social and healthcare services.']],
          ['Access', 'How would access to the new service be protected?', 'Participation would be voluntary. Counties would provide the service within available funding.',
            [['Impact assessment', 'The council asked for a clearer assessment of effects on unemployed people and adults needing special support.'], ['Question to follow', 'How would access work across different counties?']],
            'Access across counties remains an open question. The parliamentary bill record shows the progress of the proposal.',
            ['Subject to available funding', 'The service is provided within the available budget.']]
        ]
      }
    ]
  }
];

export const currentStories = entries.map(({ id, proposal, cover, frames, names, news }) => ({
  id, proposal, cover, frames, names, news,
  docket: 'https://www.eduskunta.fi/fi/asiat-ja-aanestykset/valtiopaivaasiat/' + encodeURIComponent(proposal)
}));

export const currentStructure = Object.fromEntries(entries.flatMap(({ id, frames, urls, cover }) =>
  frames.map(frame => [`${id}-${frame}`, { type: 'findings', icons: [cover, 'certificate'], urls }])
));

export function currentFrames(language) {
  return Object.fromEntries(entries.flatMap(({ id, frames, status, copy }) => {
    const { sources, frames: text } = copy[language];
    return frames.map((frame, index) => {
      const [step, title, lead, rows, more, term] = text[index];
      return [`${id}-${frame}`, {
        step, tag: step, title, lead, chart: { rows }, more: [more],
        notes: [`${checked[language]} · ${status[language]}`], sources, terms: [term]
      }];
    });
  }));
}
