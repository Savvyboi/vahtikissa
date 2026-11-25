const checked = ['Tilanne 16.11.2026', 'Läget den 16 november 2026', 'Status on 16 November 2026'];
const novemberUpdate = ['Tilanne 25.11.2026', 'Läget den 25 november 2026', 'Status on 25 November 2026'];

const entries = [
  {
    id: 'vuokravakuus', proposal: 'HE 33/2026 vp', cover: 'insurance',
    frames: ['intro', 'withholding'],
    names: ['Vuokra\u00advakuus', 'Hyres\u00adsäkerhet', 'Rental deposit'],
    checked: novemberUpdate,
    status: ['Voimassa 1.10.2026 alkaen.', 'I kraft sedan den 1 oktober 2026.', 'In force since 1 October 2026.'],
    urls: [
      'https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/2026/531',
      'https://valtioneuvosto.fi/-/1410853/huoneenvuokralait-muuttuvat-lokakuussa',
      'https://www.finlex.fi/fi/hallituksen-esitykset/2026/33'
    ],
    news: [
      ['MTV Uutiset', '2026-08-18', 'https://www.mtvuutiset.fi/artikkeli/milloin-vuokravakuus-pitaa-palauttaa-vuokralaiselle-nain-laki-muuttuu/9379360',
        ['Miten uusi laki vaikuttaa vuokravakuuden palautukseen?', 'Hur påverkar lagen återbetalningen av hyressäkerheten?', 'How does the law change rental deposit returns?']]
    ],
    copy: [
      {
        sources: ['Muutoslaki 531/2026, 8 § · Finlex', 'Oikeusministeriön tiedote 29.9.', 'HE 33/2026 vp · Finlex'],
        frames: [
          ['Palautus', 'Milloin vuokravakuus on palautettava?', 'Vakuus on palautettava tai vapautettava viipymättä. Jos vuokranantaja pidättää vakuutta, siitä on ilmoitettava kirjallisesti.',
            [['Viimeistään 14 päivässä', 'Määräaika alkaa vuokrasopimuksen päättymisestä. Jos asunto luovutetaan vasta myöhemmin, aika alkaa luovutuksesta.'], ['Perusteltu este', 'Jos toimenpiteelle on perusteltu este, 14 päivän määräaika lasketaan esteen poistumisesta.']],
            'Palautusta ja pidätysilmoitusta koskeva sääntö koskee myös ennen lokakuuta 2026 tehtyjä sopimuksia.',
            ['Vuokravakuus', 'Raha tai muu vakuus, jolla turvataan vuokrasopimuksen velvoitteiden täyttäminen.']],
          ['Pidättäminen', 'Mitä ilmoituksessa on kerrottava?', 'Kirjallisessa ilmoituksessa on kerrottava, mihin saatava perustuu ja paljonko sen arvioidaan olevan.',
            [['Pidätettävä osuus', 'Pidätys saa yleensä vastata enintään saatavan määrää tai siitä annettua arviota.'], ['Vuokravakuustili', 'Tilille talletetun vakuuden saa pidättää kokonaan, kunnes saatavan määrä on selvinnyt.']],
            'Jos vakuuden aiheeton pidätys aiheuttaa vahinkoa, vuokranantaja voi joutua korvaamaan vahingon.',
            ['Saatava', 'Summa, jonka maksamista vuokranantaja voi vaatia esimerkiksi maksamattoman vuokran vuoksi.']]
        ]
      },
      {
        sources: ['Ändringslag 531/2026, 8 § · Finlex', 'Justitieministeriets meddelande den 29 september', 'RP 33/2026 rd · Finlex'],
        frames: [
          ['Återbetalning', 'När ska hyressäkerheten betalas tillbaka?', 'Säkerheten ska återbetalas eller frigöras utan dröjsmål. Om hyresvärden håller inne säkerheten ska hyresgästen få ett skriftligt meddelande.',
            [['Senast inom 14 dagar', 'Fristen börjar när hyresavtalet upphör. Om bostaden lämnas tillbaka senare räknas tiden från den dagen.'], ['Sakligt hinder', 'Om det finns ett sakligt hinder för åtgärden räknas de 14 dagarna från det att hindret upphör.']],
            'Regeln om återbetalning och meddelande gäller även avtal som ingicks före oktober 2026.',
            ['Hyressäkerhet', 'Pengar eller annan säkerhet för att skyldigheterna i hyresavtalet ska uppfyllas.']],
          ['Innehållande', 'Vad ska stå i meddelandet?', 'I det skriftliga meddelandet ska hyresvärden ange vad fordran gäller och uppskatta beloppet.',
            [['Beloppet', 'Hyresvärden får i regel hålla inne högst fordrans belopp eller det uppskattade beloppet.'], ['Konto för hyressäkerhet', 'Hela säkerheten på ett sådant konto får hållas inne tills fordrans belopp har klarlagts.']],
            'Om en obefogad innehållning orsakar skada kan hyresvärden bli ersättningsskyldig.',
            ['Fordran', 'Ett belopp som hyresvärden kan kräva, till exempel på grund av obetald hyra.']]
        ]
      },
      {
        sources: ['Act 531/2026, section 8 · Finlex', 'Ministry of Justice announcement, 29 September', 'Government bill HE 33/2026 · Finlex'],
        frames: [
          ['Returning the deposit', 'When is a rental deposit due back?', 'The deposit must be returned or released without delay. A landlord who withholds it must give written notice.',
            [['Within 14 days', 'The clock starts when the lease ends or when the property is handed back, if that happens later.'], ['Justified delay', 'If there is a valid obstacle, the 14 days run from when it is resolved.']],
            'The return and notice rules also apply to leases signed before October 2026.',
            ['Rental deposit', 'Money or another form of security for meeting obligations under the lease.']],
          ['Withholding', 'What must a withholding notice say?', 'The written notice must explain what the landlord is claiming and give a reasonable estimate of the amount.',
            [['How much', 'The amount withheld normally cannot exceed the claim or the estimate given in the notice.'], ['Deposit account', 'The full deposit in a dedicated account may be held until the amount of the claim is clear.']],
            'A landlord may have to compensate a tenant for loss caused by unjustifiably withholding a deposit.',
            ['Claim', 'An amount the landlord is entitled to demand, for example for unpaid rent.']]
        ]
      }
    ]
  },
  {
    id: 'saastovapaa', proposal: 'HE 118/2026 vp', cover: 'calendar',
    frames: ['intro', 'transition'],
    names: ['Säästövapaa', 'Sparad ledighet', 'Carried-over leave'],
    checked: novemberUpdate,
    status: ['Vahvistettu · voimaan 1.1.2027.', 'Stadfäst · träder i kraft den 1 januari 2027.', 'Enacted · takes effect on 1 January 2027.'],
    urls: [
      'https://www.finlex.fi/fi/lainsaadanto/2005/162',
      'https://www.finlex.fi/fi/hallituksen-esitykset/2026/118',
      'https://valtioneuvosto.fi/paatokset/paatos?decisionId=7335'
    ],
    news: [
      ['Uusi Suomi', '2026-10-08', 'https://www.uusisuomi.fi/uutiset/a/d49e84a6-20c9-439a-8f9d-39f09097186f',
        ['Eduskunta hyväksyi säästövapaan muutoksen', 'Riksdagen godkände ändringen om sparad ledighet', 'Parliament passes the change to carried-over leave']],
      ['SAK', '2026-10-22', 'https://www.sak.fi/ajankohtaista/uutiset/miten-saastovapaan-ajankohdasta-kannattaa-sopia-ja-mika-muuttuu-ensi-vuoden-alussa-lue-juristin-vastaukset/',
        ['Ammattiliiton juristi vastaa kysymyksiin säästövapaasta', 'En facklig jurist svarar på frågor om sparad ledighet', 'A union lawyer answers questions about carried-over leave']]
    ],
    copy: [
      {
        sources: ['Vuosilomalaki, 27 ja 27 a § sekä muutos 943/2026 · Finlex', 'HE 118/2026 vp · Finlex', 'Lain vahvistaminen · Valtioneuvosto'],
        frames: [
          ['Ajankohta', 'Kuka päättää säästövapaan ajankohdan?', 'Työntekijän ja työnantajan on pyrittävä sopimaan ajankohdasta. Vuoden 2027 alusta työnantaja voi tietyin perustein kieltäytyä ehdotetusta ajankohdasta.',
            [['Neljä kuukautta ennen', 'Jos päivistä ei ole sovittu, työntekijä pyytää vapaata viimeistään neljä kuukautta ennen toivottua aloitusta.'], ['Vastaus kuukaudessa', 'Työnantajan on vastattava kuukauden kuluessa pyynnöstä ja perusteltava vastauksensa.']],
            'Työnantaja voi kieltäytyä, jos vapaa haittaisi tuotantoa tai palveluja tavalla, jota ei voi välttää tavanomaisin työjärjestelyin. Myös lomien ja säästövapaiden tasapuolinen sijoittaminen voi estää ehdotetun ajankohdan hyväksymisen.',
            ['Säästövapaa', 'Vuosilomapäiviä, jotka säästetään pidettäviksi myöhemmin.']],
          ['Siirtymäaika', 'Mitä jo säästetyille lomapäiville tapahtuu?', 'Ennen vuodenvaihdetta säästetyille lomapäiville on oma siirtymäsääntö.',
            [['Päivistä on sovittu', 'Ennen lain voimaantuloa sovitussa ajankohdassa pysytään.'], ['Päivistä ei ole sovittu', 'Vapaan voi pitää vanhalla neljän kuukauden ilmoitusajalla, jos se päättyy viimeistään 31.10.2027.']],
            'Siirtymäsääntö koskee ennen 1.1.2027 säästettyä vuosilomaa. Työ- tai virkaehtosopimuksessa voi olla omia määräyksiä säästövapaasta.',
            ['Siirtymäsäännös', 'Sääntö, joka määrää, milloin vanhaa lakia sovelletaan vielä muutoksen jälkeen.']]
        ]
      },
      {
        sources: ['Semesterlagen, 27 och 27 a § samt ändring 943/2026 · Finlex', 'RP 118/2026 rd · Finlex', 'Stadfästelse av lagen · Statsrådet'],
        frames: [
          ['Ledighetens tidpunkt', 'Vem bestämmer när sparad ledighet tas ut?', 'Arbetstagaren och arbetsgivaren ska försöka komma överens. Från början av 2027 får arbetsgivaren under vissa förutsättningar tacka nej till den önskade tidpunkten.',
            [['Fyra månader i förväg', 'Om parterna saknar en överenskommelse ska arbetstagaren lämna in sin begäran senast fyra månader före önskad start.'], ['Svar inom en månad', 'Arbetsgivaren ska ge ett motiverat svar inom en månad från begäran.']],
            'Arbetsgivaren får neka om tidpunkten skulle störa produktionen eller servicen på ett sätt som vanliga arbetsarrangemang inte kan avhjälpa, eller hindra en jämlik förläggning av semestrar och sparad ledighet.',
            ['Sparad ledighet', 'Semesterdagar som sparas för att tas ut senare.']],
          ['Övergångstid', 'Vad händer med semesterdagar som redan sparats?', 'En särskild övergångsregel gäller för semesterdagar som sparats före årsskiftet.',
            [['Tidpunkten är avtalad', 'En tidpunkt som parterna avtalat om före ikraftträdandet gäller fortfarande.'], ['Tidpunkten är öppen', 'De gamla reglerna med fyra månaders anmälningstid gäller om ledigheten slutar senast den 31 oktober 2027.']],
            'Övergångsregeln gäller semester som sparats före den 1 januari 2027. Kollektivavtal kan ha egna bestämmelser om sparad ledighet.',
            ['Övergångsbestämmelse', 'En regel som anger när den tidigare lagen fortfarande gäller efter en ändring.']]
        ]
      },
      {
        sources: ['Annual Holidays Act, sections 27 and 27a and amendment 943/2026 · Finlex', 'Government bill HE 118/2026 · Finlex', 'Enactment · Finnish Government'],
        frames: [
          ['Choosing dates', 'Who decides when carried-over leave can be taken?', 'The worker and employer must try to agree on dates. From 2027 the employer can refuse a requested date on specified grounds.',
            [['Four months ahead', 'If no dates have been agreed, the worker must ask at least four months before the leave is due to start.'], ['Reply within a month', 'The employer must give a reasoned reply within one month of the request.']],
            'Employers can refuse if ordinary work arrangements cannot avoid disruption to production or services, or if the date would prevent fair scheduling of holidays and carried-over leave.',
            ['Carried-over leave', 'Annual leave days saved for use later.']],
          ['Transition', 'What happens to leave already saved?', 'A transition rule applies to annual leave saved before the end of 2026.',
            [['Dates already agreed', 'Dates agreed before the law takes effect still stand.'], ['Dates still open', 'A worker can use the old four-month notice rule if the leave ends by 31 October 2027.']],
            'The transition rule covers leave saved before 1 January 2027. Collective agreements can set their own rules for carried-over leave.',
            ['Transition rule', 'A rule that says when the previous law still applies after a change.']]
        ]
      }
    ]
  },
  {
    id: 'yleistuki', proposal: 'HE 112/2025 vp', cover: 'investment',
    frames: ['intro', 'income'],
    names: ['Yleistuki', 'Allmänt stöd', 'Kela benefit'],
    checked: novemberUpdate,
    status: ['Voimassa 1.5.2026 alkaen.', 'I kraft sedan den 1 maj 2026.', 'In force since 1 May 2026.'],
    urls: [
      'https://www.finlex.fi/fi/lainsaadanto/2026/48',
      'https://www.kela.fi/tyottomyys-yleistuki',
      'https://valtioneuvosto.fi/-/1271139/osittainen-varhennettu-vanhuuselake-ei-vaikuta-yleistuen-maaraan-jos-varhennetusta-elakkeesta-on-paatetty-ennen-1.5.2026'
    ],
    news: [
      ['Yle', '2026-10-30', 'https://yle.fi/aihe/a/20-10009825',
        ['Milloin osittainen varhennettu vanhuuseläke vaikuttaa yleistukeen?', 'När påverkar partiell förtida ålderspension det allmänna stödet?', 'When does a partial early old-age pension affect the benefit?']]
    ],
    copy: [
      {
        sources: ['Yleistukilaki 48/2026, erityisesti 2, 15–17 ja 55 § · Finlex', 'Yleistuki ja tulojen vaikutus · Kela', 'Eläkettä koskeva muutos · Sosiaali- ja terveysministeriö'],
        frames: [
          ['Työttömyystuki', 'Mitä yleistuki korvasi?', 'Yleistuki tuli Kelan työmarkkinatuen ja peruspäivärahan tilalle toukokuussa 2026.',
            [['Kenelle', 'Työttömälle työnhakijalle, jolla ei ole oikeutta ansiopäivärahaan tai jonka ansiopäivärahan enimmäisaika on täyttynyt.'], ['Siirtyminen', 'Työmarkkinatuen ja peruspäivärahan saajat siirtyivät yleistuelle ilman uutta hakemusta.']],
            'Vuonna 2026 täysi yleistuki on 37,21 euroa päivässä viideltä päivältä viikossa. Tulot voivat pienentää maksettavaa määrää.',
            ['Ansiopäiväraha', 'Työttömyyskassan maksama etuus, jonka määrään vaikuttaa aiempi palkka.']],
          ['Tulot', 'Miten palkka ja pääomatulot vaikuttavat yleistukeen?', 'Kela laskee palkan vaikutuksen eri tavalla kuin pääomatulojen ja muiden tarveharkinnassa huomioitavien tulojen vaikutuksen.',
            [['Palkka', 'Sovitellussa yleistuessa 200 euron bruttopalkka pienentää tukea 100 eurolla.'], ['Pääomatulo', 'Esimerkiksi 411 euron kuukausittaisesta vuokratulosta 100 euroa ylittää 311 euron rajan. Tuki pienenee 50 euroa.']],
            'Lokakuun lainmuutoksen mukaan ennen 1.5.2026 myönnettyä osittaista varhennettua vanhuuseläkettä ei lasketa tarveharkinnan tuloksi. Muutosta sovelletaan takautuvasti toukokuun alusta.',
            ['Tarveharkinta', 'Kela arvioi muiden kuin palkkatulojen vaikutuksen tuen määrään.']]
        ]
      },
      {
        sources: ['Lagen om allmänt stöd 48/2026, särskilt 2, 15–17 och 55 § · Finlex', 'Allmänt stöd och inkomsternas inverkan · FPA', 'Ändringen om pension · Social- och hälsovårdsministeriet'],
        frames: [
          ['Arbetslöshetsstöd', 'Vad ersatte det allmänna stödet?', 'Det allmänna stödet ersatte FPA:s arbetsmarknadsstöd och grunddagpenning i maj 2026.',
            [['Vem kan få stöd?', 'Arbetslösa arbetssökande som saknar rätt till inkomstrelaterad dagpenning eller har fått den under maximitiden.'], ['Övergången', 'De som fick arbetsmarknadsstöd eller grunddagpenning övergick till det allmänna stödet utan ny ansökan.']],
            'År 2026 är fullt allmänt stöd 37,21 euro per dag fem dagar i veckan. Inkomster kan minska beloppet.',
            ['Inkomstrelaterad dagpenning', 'En förmån som arbetslöshetskassan betalar ut och vars belopp påverkas av tidigare lön.']],
          ['Inkomster', 'Hur påverkar lön och kapitalinkomster stödet?', 'FPA räknar lön på ett annat sätt än kapitalinkomster och andra inkomster som ingår i behovsprövningen.',
            [['Lön', 'Vid jämkning minskar en bruttolön på 200 euro det allmänna stödet med 100 euro.'], ['Kapitalinkomst', 'Av en hyresinkomst på 411 euro i månaden överstiger 100 euro gränsen på 311 euro. Stödet minskar med 50 euro.']],
            'En lagändring i oktober undantar partiell förtida ålderspension som beviljats före den 1 maj 2026 från behovsprövningen. Ändringen tillämpas retroaktivt från början av maj.',
            ['Behovsprövning', 'FPA bedömer hur andra inkomster än lön påverkar stödbeloppet.']]
        ]
      },
      {
        sources: ['General Social Security Benefit Act 48/2026, especially sections 2, 15–17 and 55 · Finlex', 'General social security benefit and income · Kela', 'Pension amendment · Ministry of Social Affairs and Health'],
        frames: [
          ['Unemployment support', 'What did Kela’s new benefit replace?', 'The general social security benefit replaced Kela’s labour market subsidy and basic unemployment allowance in May 2026.',
            [['Who can qualify', 'Unemployed jobseekers without a right to earnings-related allowance, including those who have used up their maximum payment period.'], ['Switching over', 'People receiving either of the old Kela benefits transferred without a new application.']],
            'In 2026 the full benefit is €37.21 a day for five days a week. Income can reduce the amount paid.',
            ['Earnings-related allowance', 'An unemployment fund benefit whose amount depends on previous pay.']],
          ['Income', 'How do wages and capital income affect the benefit?', 'Kela uses different calculations for wages and for capital and other income subject to means testing.',
            [['Wages', 'Under the wage adjustment, €200 in gross wages reduces the benefit by €100.'], ['Capital income', 'Monthly rental income of €411 is €100 above the €311 threshold. The benefit goes down by €50.']],
            'An October amendment excludes partial early old-age pensions granted before 1 May 2026 from the means test. It applies retroactively from the start of May.',
            ['Means testing', 'Kela assesses how income other than wages affects the benefit amount.']]
        ]
      }
    ]
  },
  {
    id: 'digihenkkarit', proposal: 'HE 17/2026 vp', cover: 'laptop',
    frames: ['intro', 'rollout'],
    names: ['Digi\u00adhenkkarit', 'Digitalt id', 'Digital ID'],
    checked: novemberUpdate,
    status: ['Laki voimassa 1.10.2026 alkaen.', 'Lagen i kraft sedan den 1 oktober 2026.', 'Law in force since 1 October 2026.'],
    urls: [
      'https://www.finlex.fi/fi/lainsaadanto/saadoskokoelma/2026/812',
      'https://poliisi.fi/-/police-to-introduce-a-digital-identity-document-as-part-of-public-services-in-2027',
      'https://kehittajille.suomi.fi/palvelut/lompakko/mika-on-lompakko'
    ],
    news: [
      ['Uusi Suomi', '2026-05-28', 'https://www.uusisuomi.fi/uutiset/a/9bdac9fd-e718-4405-a2af-f12795cc07a5',
        ['Digilompakon käyttötavat ja käyttöönoton viivästyminen', 'Så kan den digitala plånboken användas och därför dröjer lanseringen', 'What the digital wallet can do and why its rollout is delayed']]
    ],
    copy: [
      {
        sources: ['Laki digitaalisesta henkilöllisyystodistuksesta 812/2026 · Finlex', 'Poliisin tiedote digitaalisesta henkilöllisyystodistuksesta', 'Suomi.fi-lompakon kuvaus ja julkaisuaikataulu'],
        frames: [
          ['Tietojen osoittaminen', 'Mitä digitaalisella henkilöllisyystodistuksella voi osoittaa?', 'Lain mukaan puhelimessa oleva digitaalinen henkilöllisyystodistus voi osoittaa henkilöllisyyden tai viranomaisen vahvistamia tietoja.',
            [['Henkilöllisyys', 'Todistus perustuu voimassa olevaan passiin tai henkilökorttiin.'], ['Ikätodiste', 'Käyttäjä voi osoittaa kuuluvansa tiettyyn ikäryhmään, esimerkiksi olevansa täysi-ikäinen.']],
            'Kun matkalla vaaditaan matkustusasiakirjaa, tarvitaan edelleen siihen kelpaava passi tai henkilökortti.',
            ['Ikätodiste', 'Vahvistetuista tiedoista johdettu todistus käyttäjän kuulumisesta tiettyyn ikäryhmään.']],
          ['Käyttöönotto', 'Milloin Suomi.fi-lompakon saa käyttöön?', 'Suomi.fi:n mukaan lompakkosovellus on tarkoitus julkaista loppuvuonna 2027.',
            [['Sovellus', 'Digi- ja väestötietovirasto tarjoaa puhelimeen ladattavan lompakon. Sen käyttö on vapaaehtoista.'], ['Todistuksen lisääminen', 'Sovellukseen lisättävä todistus perustuu asiakirjan sirulta luettuihin tietoihin. Tietojen on vastattava lompakon henkilötietoja.']],
            'Lompakolla on tarkoitus voida tunnistautua verkossa ja osoittaa tietoja myös paikan päällä palveluissa, jotka hyväksyvät lompakon.',
            ['Identiteettilompakko', 'Sovellus, jossa voi säilyttää ja esittää virallisia digitaalisia todistuksia.']]
        ]
      },
      {
        sources: ['Lag om digitalt identitetsbevis 812/2026 · Finlex', 'Polisens meddelande om digitalt identitetsbevis', 'Beskrivning och tidsplan för Suomi.fi-plånboken'],
        frames: [
          ['Styrkta uppgifter', 'Vad kan man visa med ett digitalt identitetsbevis?', 'Enligt lagen kan ett digitalt identitetsbevis i telefonen styrka identiteten eller uppgifter som en myndighet har bekräftat.',
            [['Identitet', 'Beviset grundar sig på ett giltigt pass eller identitetskort.'], ['Åldersbevis', 'Användaren kan styrka att hen hör till en viss åldersgrupp, till exempel att hen är myndig.']],
            'När en resehandling krävs används fortfarande ett pass eller identitetskort som godtas för resan.',
            ['Åldersbevis', 'Ett bevis som härleds från bekräftade uppgifter för att visa att användaren hör till en viss åldersgrupp.']],
          ['Lansering', 'När kan man börja använda Suomi.fi-plånboken?', 'Enligt Suomi.fi planeras plånboksappen lanseras i slutet av 2027.',
            [['Appen', 'Myndigheten för digitalisering och befolkningsdata erbjuder en plånbok som kan laddas ner till telefonen. Den är frivillig att använda.'], ['Lägga till beviset', 'Beviset som läggs till i appen grundar sig på uppgifter från handlingens chip. De ska stämma överens med personuppgifterna i plånboken.']],
            'Tanken är att plånboken ska fungera för identifiering på nätet och för att styrka uppgifter på plats hos tjänster som godtar den.',
            ['Identitetsplånbok', 'En app där man kan spara och visa officiella digitala bevis.']]
        ]
      },
      {
        sources: ['Digital Identity Document Act 812/2026 · Finlex', 'Police announcement on the digital ID', 'Suomi.fi wallet details and release schedule'],
        frames: [
          ['Proving information', 'What can you prove with a digital ID?', 'The law allows the digital ID on a phone to prove identity or information verified by a public authority.',
            [['Identity', 'The digital ID is based on a valid passport or identity card.'], ['Proof of age', 'Users can prove they are in an age group, for example that they are 18 or over.']],
            'When a travel document is required, travellers still use an accepted passport or identity card.',
            ['Proof of age', 'A credential based on verified information that shows the user belongs to a specified age group.']],
          ['Rollout', 'When will the Suomi.fi wallet be available?', 'Suomi.fi lists a planned release in late 2027.',
            [['The app', 'The Digital and Population Data Services Agency will provide the voluntary mobile wallet.'], ['Adding the ID', 'The app uses data read from the physical document’s chip. The information must match the personal data in the wallet.']],
            'The wallet is designed for online identification and for proving information in person at services that accept it.',
            ['Identity wallet', 'An app for storing and presenting official digital credentials.']]
        ]
      }
    ]
  },
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
  return Object.fromEntries(entries.flatMap(({ id, frames, status, checked: checkedOn = checked, copy }) => {
    const { sources, frames: text } = copy[language];
    return frames.map((frame, index) => {
      const [step, title, lead, rows, more, term] = text[index];
      return [`${id}-${frame}`, {
        step, tag: step, title, lead, chart: { rows }, more: [more],
        notes: [`${checkedOn[language]} · ${status[language]}`], sources, terms: [term]
      }];
    });
  }));
}
