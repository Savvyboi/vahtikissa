const illustrations = 'Ikoner från Health Icons (CC0)';
const abbreviations = 'Riksdagens förteckning över förkortningar (PDF)';
const oldNotice = 'Tidigare lydelse, lag 230/2016, 16 a §';
const noticeLaw = 'Lag 594/2026, 16 a §';
const jpySubmission = 'JPY:s yttrande till ministeriet den 6 mars, s. 1';
const gamblingCheck = 'Penningspelslagen 10/2026, 10 § 2 mom. 8 punkten (PDF)';
const gamblingEnglish = 'Penningspelslagen 10/2026, 10 § (på engelska)';
const gamblingLaw = 'https://www.finlex.fi/api/media/statute/901720/mainPdf/main.pdf?timestamp=2026-01-20T05%3A39%3A50.130Z';
const registerGuide = 'https://www.avoimuusrekisteri.fi/sv/ajankohtaista/kysymyksia-ja-vastauksia';

const bill = ['RP … rd', 'RP står för regeringens proposition. Rd står för riksdagen och anger riksmötet. Numret och året identifierar propositionen. På finska används HE … vp.'];
const jpy = ['JPY', 'Jalkapallon Pelaajayhdistys, föreningen som företräder fotbollsspelare i Finland.'];
const policy = ['Försäkringstagare', 'Den person eller organisation som har tecknat försäkringen. Om en förening försäkrar en spelare är föreningen försäkringstagare och spelaren försäkrad.'];
const section16 = ['16 a §', 'Paragrafen i lagen om idrottares försäkringsskydd som anger när försäkringsbolaget måste ge besked och vem som ska få det.'];
const submission = ['Yttrande', 'Ett skriftligt ställningstagande till ett ministerium under remissbehandlingen eller till ett riksdagsutskott som behandlar förslaget.'];
const healthReport = ['ShUB 7/2026 rd', 'Social- och hälsovårdsutskottets betänkande om förslaget. Utskottet lägger fram och motiverar sina ändringsförslag. På finska StVM 7/2026 vp.'];
const administrationReport = ['FvUB 28/2025 rd', 'Förvaltningsutskottets betänkande om penningspelsreformen. I det föreslår utskottet hur riksdagen ska besluta. På finska HaVM 28/2025 vp.'];
const register = ['Öppenhetsregistret', 'Ett offentligt register där organisationer anmäler lobbning och rådgivning om lobbning som riktar sig till riksdagen eller ministerierna.'];
const period = ['Rapporteringsperiod', 'De månader som registeranmälan gäller. Kontakterna kan ha ägt rum olika dagar inom perioden.'];
const lookback = ['Granskningsperiod', 'Hur långt tillbaka myndigheten går när den kontrollerar vilka tidigare förbud eller avgifter som kan påverka licensen.'];
const lotteries = ['Lotterilagen', 'Den lag som de förbud och påföljdsavgifter som omfattas av tvåårsregeln gäller.'];

import { currentFrames } from './current-stories.js';

export const frames = {
  ...currentFrames(1, {
    "vuokravakuus-versions": {
      step: "Varifrån kom 14 dagar?",
      tag: "Lagtexten",
      title: "Utkastets 30 dagar blev 14",
      lead: "Justitieministeriets arbetsgrupp kopplade en längre frist till standardersättning. Efter remissbehandlingen valde regeringen en kortare frist.",
      chart: { rows: [
        ["December 2024","Arbetsgruppens betänkande","30 dagar och standardersättning"],
        ["Mars 2026","Proposition till riksdagen","14 dagar"],
        ["20.5.2026","Miljöutskottet","14 dagar kvarstår"],
        ["16.6.2026","Lagen stadfästs","14 dagar kvarstår"]
      ] },
      notes: ["Standardersättningen skulle ha betalats efter fristens utgång utan att hyresgästen behövde visa en faktisk skada."],
      more: ["Regeringen motiverade den kortare fristen med att säkerheten kan vara en stor summa för hyresgästen. Den antagna lagen ger möjlighet till ersättning för skada vid obefogat innehållande."],
      sources: [
        "RP 33/2026 rd, avsnitt 6 och motiveringen till 8 §",
        "Miljöutskottets betänkande YmVM 8/2026 vp, säkerheten",
        "Lag 531/2026, 8 §"
      ],
      terms: [["Standardersättning","Ett på förhand bestämt ersättningsbelopp som inte beror på den exakta skadan."]]
    },
    "vuokravakuus-submissions": {
      step: "Vem ville ha en kortare frist?",
      tag: "Remissbehandling",
      title: "Hyresgästernas och hyresvärdarnas företrädare ville olika",
      lead: "Regeringens sammanfattning av remissvaren visar att både tidsfristen och följderna av ett dröjsmål delade åsikterna.",
      chart: { rows: [
        ["Hyresgästernas företrädare","Ville ha en kortare frist. De befarade att 30 dagar i praktiken skulle bli den vanliga väntetiden."],
        ["Hyresvärdarnas företrädare","Stödde arbetsgruppens frist på 30 dagar."]
      ] },
      notes: ["Vissa såg standardersättningen som ett skydd för hyresgästen. Andra ansåg att den kunde bli svår att tolka och leda till fler tvister."],
      more: ["Regeringen säger att remissvaren låg bakom justeringen. Sammanfattningen visar gruppernas ståndpunkter, medan enskilda yttrandens betydelse för valet är öppen."],
      sources: [
        "RP 33/2026 rd, avsnitt 6: remissvaren",
        "YmVM 8/2026 vp, behandlingen av säkerheten"
      ],
      terms: [["Remissbehandling","En fas då ministeriet ber om synpunkter på ett utkast innan regeringen lämnar propositionen."]]
    },
    "vuokravakuus-deadline": {
      step: "Hur räknas dagarna?",
      tag: "Exempel",
      title: "Bostaden lämnas tillbaka på måndag, räkningen börjar på tisdag",
      lead: "Tänk dig att hyresavtalet upphör den 4 oktober 2026 och hyresgästen lämnar tillbaka bostaden nästa dag.",
      chart: { rows: [
        ["5.10.2026","Bostaden lämnas tillbaka","Den dagen räknas inte med"],
        ["6.10.2026","Första dagen","14-dagarsfristen börjar"],
        ["19.10.2026","Fjortonde dagen","Sista dagen i exemplet"]
      ] },
      notes: ["Miljöutskottet förtydligade att räkningen börjar dagen efter att avtalet upphört eller bostaden lämnats tillbaka, om det sker senare."],
      more: ["Säkerheten ska återbetalas utan dröjsmål. Exemplet visar sista möjliga dag när det saknas ett sakligt hinder för återbetalning eller meddelande."],
      sources: [
        "YmVM 8/2026 vp, beräkning av fristen",
        "Lagen om beräknande av laga tid 150/1930, 2 och 5 §",
        "Lag 531/2026, 8 §"
      ],
      terms: [["Överlåtelse av besittningen","Bostaden lämnas tillbaka till hyresvärden, i praktiken exempelvis genom att lämna över nycklarna."]]
    },
    "vuokravakuus-notice-period": {
      step: "Vad ändrades också?",
      tag: "Uppsägningstid",
      title: "Avtalsdagen kan avgöra uppsägningstiden",
      lead: "Samma reform ändrade uppsägningstiden för tillsvidareavtal när hyresvärden säger upp avtalet.",
      chart: { rows: [
        ["Avtal före den 1 oktober 2026","6 månader när hyresförhållandet varat i minst ett år"],
        ["Nytt avtal från den 1 oktober 2026","4 månader när hyresförhållandet varat i minst två år"]
      ] },
      notes: ["I övriga fall är hyresvärdens uppsägningstid tre månader. Hyresgästens uppsägningstid är fortsatt en månad."],
      more: ["Parterna i ett äldre avtal kan efter ikraftträdandet avtala om att den nya regeln ska gälla. Regeln om återbetalning av säkerheten omfattar också äldre avtal."],
      sources: [
        "Lag 531/2026, 52 § och ikraftträdandet",
        "Justitieministeriets meddelande den 29 september 2026"
      ],
      terms: [["Tillsvidareavtal","Ett hyresavtal som löper vidare tills det upphör, till exempel genom uppsägning."]]
    },
    "saastovapaa-before-and-after": {
      step: "Från besked till begäran",
      tag: "Tidigare och ny regel",
      title: "Samma fyra månader, annan beslutanderätt",
      lead: "Utgångspunkten är att arbetstagaren och arbetsgivaren kommer överens. Ändringen gäller vad som händer när de inte kan enas.",
      chart: { rows: [
        ["Tidigare 27 §","Arbetstagaren meddelade tidpunkten fyra månader i förväg"],
        ["Nya 27 a §","Arbetstagaren begär en tidpunkt fyra månader i förväg"]
      ] },
      notes: ["Enligt den nya lagen ska arbetsgivaren ge ett motiverat svar inom en månad. En begäran får avslås på de grunder som lagen anger."],
      more: ["Tidpunkten och rätten att spara dagar regleras var för sig. Enligt 27 § får man i regel spara delen över 24 vardagar. Parterna kan avtala om att spara delen över 18 dagar."],
      sources: [
        "Semesterlagen, tidigare 27 § och nya 27 a §",
        "RP 118/2026 rd, avsnitt 2 och 7"
      ],
      terms: [["27 a §","Den nya paragrafen om att avtala om, begära och svara på en tidpunkt för sparad ledighet."]]
    },
    "saastovapaa-submissions": {
      step: "Vad bad remissinstanserna om?",
      tag: "Yttranden",
      title: "Rätten att neka delade remissinstanserna",
      lead: "Regeringens sammanfattning visar hur olika arbetsgivar- och löntagarsidan bedömde utkastet.",
      chart: { rows: [
        ["Arbetsgivarsidan","Ville få större rätt att bestämma om tidpunkten. Företagarna i Finland upprepade önskemålet till utskottet i september."],
        ["FFC","Motsatte sig ändringen. Om den gick igenom ville FFC kräva allvarlig olägenhet och begränsa upprepade avslag."]
      ] },
      notes: ["Justitiekanslern påpekade att kravet på att olägenheten inte kunde undvikas med vanliga arbetsarrangemang bara stod i utkastets motivering. I propositionen stod det också i paragrafen."],
      more: ["Den antagna lagen medger ett avslag vid olägenheter för produktion eller service som vanliga arbetsarrangemang inte kan avvärja, eller när det behövs för en jämlik semesterförläggning."],
      sources: [
        "RP 118/2026 rd, avsnitt 6.2: remissvar",
        "Företagarna i Finlands yttrande den 10 september 2026",
        "FFC:s yttrande till riksdagen, s. 1–2",
        "Semesterlagen, 27 a §"
      ],
      terms: [["Paragrafmotivering","Regeringens förklaring till varför en viss lagtext föreslås och hur den ska tillämpas."]]
    },
    "saastovapaa-decision": {
      step: "Hur beslutade riksdagen?",
      tag: "Riksdagsbehandling",
      title: "Lagpaketet godkändes med rösterna 109–53",
      lead: "Utskottets majoritet stödde ändringen. Fyra ledamöter föreslog i en reservation att lagförslaget om sparad ledighet skulle förkastas.",
      chart: { rows: [
        ["16.6.2026","Regeringens proposition","Ny 27 a §"],
        ["25.9.2026","Utskottets betänkande","Grunderna för avslag kvarstår"],
        ["7.10.2026","Andra behandlingen","109 för godkännande, 53 emot"],
        ["1.1.2027","Ikraftträdande","Den nya regeln om tidpunkten börjar gälla"]
      ] },
      notes: ["Enligt reservationen visade propositionen inga belägg för att den tidigare regeln skulle ha orsakat betydande problem."],
      more: ["Omröstningen gällde om lagförslagen skulle godkännas eller förkastas. Paketet innehöll också fyra andra lagändringar."],
      sources: [
        "Arbetslivs- och jämställdhetsutskottets betänkande TyVM 6/2026 vp och reservation",
        "Riksdagens omröstning den 7 oktober 2026",
        "Ändringen av semesterlagen 943/2026, ikraftträdande"
      ],
      terms: [["Reservation","En avvikande ståndpunkt från utskottsledamöter som publiceras med betänkandet."]]
    },
    "saastovapaa-worked-example": {
      step: "Hur fungerar övergången?",
      tag: "Exempel",
      title: "Ledighet i oktober kan följa de gamla reglerna",
      lead: "En arbetstagare sparade dagar 2026 utan att avtala om datum och vill vara ledig den 4–8 oktober 2027.",
      chart: { rows: [
        ["4.6.2027","Sista dagen att meddela tidpunkten i exemplet"],
        ["4.10.2027","Ledigheten börjar och slutar före den 31 oktober"]
      ] },
      notes: ["Det gamla förfarandet kan användas eftersom ledigheten slutar under övergångstiden och kan meddelas fyra månader i förväg."],
      more: ["Om arbetstagaren vill vara ledig i november gäller det nya förfarandet med en begäran. Datum som parterna redan kom överens om före årsskiftet gäller fortfarande."],
      sources: [
        "Semesterlagen, ändring 943/2026 och övergångsbestämmelsen",
        "RP 118/2026 rd, avsnitt 8: ikraftträdande"
      ],
      terms: [["Övergångstid","Här den tid efter ikraftträdandet då det gamla anmälningsförfarandet fortfarande kan användas för viss tidigare sparad ledighet."]]
    },
    "yleistuki-old-benefits": {
      step: "Hur skilde sig de tidigare stöden?",
      tag: "Före reformen",
      title: "Samma pension kunde påverka två förmåner på olika sätt",
      lead: "Partiell förtida ålderspension visar vad som hände när två FPA-förmåner slogs ihop.",
      chart: { rows: [
        ["Grunddagpenning","Förmånen var inte behovsprövad. Den här pensionen minskade inte dagpenningen."],
        ["Arbetsmarknadsstöd","Pensionen räknades vanligen som inkomst. Ett undantag gällde vissa personer som fyllt 55 år."]
      ] },
      notes: ["Det allmänna stödet har en egen behovsprövning. Pensionen kunde därför sänka stödet för personer vars tidigare arbetslöshetsförmån var opåverkad."],
      more: ["Social- och hälsovårdsutskottet tog upp skillnaden när höstens ändring behandlades. Pensionsbeslutet kan återtas inom tre månader från beslutsdagen."],
      sources: [
        "StVM 15/2026 vp, utskottets motivering",
        "Lagen om allmänt stöd 48/2026, 15–17 §",
        "FPA:s meddelande den 22 oktober 2026, tidigare regler"
      ],
      terms: [["Partiell förtida ålderspension","En del av den intjänade arbetspensionen som kan betalas ut före den egentliga ålderspensionen."]]
    },
    "yleistuki-pension-cutoff": {
      step: "Varför flyttades gränsen?",
      tag: "Från proposition till lag",
      title: "Utskottet flyttade gränsen för pensionsbeslut till våren",
      lead: "Regeringen ville undanta pensioner som beviljats innan lagen om allmänt stöd stadfästes. Utskottet valde lagens ikraftträdande som gräns.",
      chart: { rows: [
        ["16.1.2026","Regeringens föreslagna gränsdatum"],
        ["1.5.2026","Utskottets förslag och den antagna lagen"]
      ] },
      notes: ["Vid hörandet framkom att informationen nådde pensionssektorn sent. Ett gränsdatum mitt i januari kunde också behandla personer som sökt under samma månad olika."],
      more: ["Utskottet hänvisade till uppgifterna från de sakkunniga. Den antagna lagen undantar pensionsbeslut som meddelats före maj."],
      sources: [
        "RP 124/2026 rd, föreslaget gränsdatum och motivering",
        "StVM 15/2026 vp, hörande av sakkunniga och ändringsförslag",
        "Lagen om allmänt stöd, 55 § och ändring 934/2026"
      ],
      terms: [["Gränsdatum","Datumet som pensionsbeslutets beslutsdag jämförs med. Ett beslut från den 1 maj omfattas redan av den andra regeln."]]
    },
    "yleistuki-pension-votes": {
      step: "Vad röstade riksdagen om?",
      tag: "Två olika beslut",
      title: "Först valdes lagtexten, sedan godkändes ändringen",
      lead: "Pensionsändringen gick till omröstning både vid första och andra behandlingen. Ja och nej hade olika innebörd de två dagarna.",
      chart: { rows: [
        ["16.10.2026","Grund för behandlingen","93 för betänkandet, 81 för reservationens förslag"],
        ["21.10.2026","Godkännande","127 för, 48 emot"],
        ["2.11.2026","Ikraftträdande","Tillämpas retroaktivt från den 1 maj 2026"]
      ] },
      notes: ["Ett ja den 16 oktober betydde stöd för utskottets betänkande. Vid omröstningen den 21 oktober betydde ja att godkänna lagförslaget."],
      more: [
        "I reservationen föreslogs att partiell förtida ålderspension alltid skulle undantas från behovsprövningen. Reservanterna hänvisade till målen för pensionsreformen 2017.",
        "Undantaget som riksdagen godkände beror på pensionsbeslutets datum. FPA tillämpar det retroaktivt från det att det allmänna stödet infördes."
      ],
      sources: [
        "Omröstning vid första behandlingen den 16 oktober 2026",
        "Omröstning vid andra behandlingen den 21 oktober 2026",
        "StVM 15/2026 vp, reservationens förslag",
        "Social- och hälsovårdsministeriets meddelande den 29 oktober 2026"
      ],
      terms: [["Retroaktiv tillämpning","Ändringen tillämpas även för en period före den dag då den träder i kraft."]]
    },
    "yleistuki-pension-example": {
      step: "Vilket datum avgör?",
      tag: "Exempel",
      title: "Två pensioner från juni kan behandlas olika",
      lead: "Tänk dig två personer vars partiella pension börjar i juni. Deras beslut har meddelats olika dagar.",
      chart: { rows: [
        ["Beslut den 30 april 2026","Pensionen undantas från behovsprövningen"],
        ["Beslut den 5 maj 2026","Pensionen räknas som inkomst vid behovsprövningen"]
      ] },
      notes: ["Pensionsbeslutets datum avgör. Utbetalningarna kan börja samma månad i båda fallen."],
      more: ["Den 11 november 2026 meddelade FPA att myndigheten hade rättat omkring 3 000 stödbeslut. Rättelsen gjordes automatiskt för dem vars pension omfattades av undantaget men hade räknats som inkomst."],
      sources: [
        "FPA:s meddelande om rättade beslut den 11 november 2026",
        "Lagen om allmänt stöd, 55 §"
      ],
      terms: [["Rättelse","FPA ändrar ett tidigare beslut och betalar ut en eventuell mellanskillnad."]]
    },
    "digihenkkarit-age-proof": {
      step: "Vad får tjänsten veta?",
      tag: "Dataskydd",
      title: "En tjänst kan kontrollera åldersgränsen utan födelsedatum",
      lead: "Tänk dig att en tjänst bara behöver veta om användaren är myndig. Ett åldersbevis kan svara på just den frågan.",
      chart: { rows: [
        ["Tjänsten kontrollerar identiteten","Kan behöva namn och andra identifieringsuppgifter"],
        ["Tjänsten kontrollerar åldersgränsen","Åldersbeviset kan visa att användaren har fyllt 18 år"]
      ] },
      notes: ["Åldersbeviset härleds från uppgifter som en myndighet har bekräftat. EU-förordningen kräver att uppgifter kan delas selektivt ur plånboken."],
      more: ["En nättjänst som vill ta emot uppgifter från plånboken registrerar sitt syfte och uppger vilka uppgifter den tänker begära."],
      sources: [
        "Lag 812/2026, 2 och 4 §",
        "EU:s eIDAS-ändring, artikel 5a.4 och 5b",
        "Förvaltningsutskottets betänkande HaVM 15/2026 vp, minderåriga"
      ],
      terms: [["Selektiv delning","Att bara visa den del av uppgifterna i ett bevis som tjänsten behöver."]]
    },
    "digihenkkarit-age-limit": {
      step: "Varifrån kom 13-årsgränsen?",
      tag: "Minderåriga",
      title: "Från 13 år kan man aktivera plånboken på egen hand",
      lead: "EU:s plånboksregler anger ingen åldersgräns för aktivering. Finlands regering föreslog 13 år och förvaltningsutskottet stödde regeln.",
      chart: { rows: [
        ["Från 13 år","Den unga kan ta plånboken i bruk självständigt."],
        ["Under 13 år","En vårdnadshavares samtycke krävs."]
      ] },
      notes: ["Regeringen jämförde med dataskyddslagens 13-årsgräns för barns samtycke i informationssamhällets tjänster."],
      more: ["Enligt utskottet kan åldersbevis göra användningen tryggare. För en tjänst kan det räcka att veta att användaren hör till en viss åldersgrupp."],
      sources: [
        "Lag 810/2026, 10 §",
        "RP 17/2026 rd, motiveringen till 10 § och remissvar",
        "HaVM 15/2026 vp, minderåriga"
      ],
      terms: [["Aktivering","Här att ta plånboken i bruk. Enskilda tjänster kan ha egna åldersgränser."]]
    },
    "digihenkkarit-accessibility": {
      step: "Vad händer om man behöver hjälp?",
      tag: "Tillgänglighet",
      title: "Utskotten tog upp assistans och andra sätt att få tillgång till tjänster",
      lead: "Diskrimineringsombudsmannen uppmärksammade under remissen personer som behöver hjälp av en assistent för att använda plånboken.",
      chart: { rows: [
        ["Grundlagsutskottet","Ville trygga ett annat digitalt sätt att sköta ärenden åtminstone hos myndigheter."],
        ["Förvaltningsutskottet","Hänvisade till EU:s krav på tillgänglighet, frivillighet och att andra identifieringssätt ska finnas kvar."]
      ] },
      notes: ["Frågan väcktes eftersom plånboken enligt reglerna är personlig och ska användas omsorgsfullt."],
      more: ["Enligt EU-förordningen ska den som avstår från plånboken kunna använda offentliga och privata tjänster med andra befintliga identifieringssätt."],
      sources: [
        "RP 17/2026 rd, avsnitt 6 och 12.1",
        "Grundlagsutskottets utlåtande PeVL 32/2026 vp, punkterna 21–23",
        "HaVM 15/2026 vp, tillgänglighet och frivillighet",
        "eIDAS-ändringen, artikel 5a.15 och 5a.21"
      ],
      terms: [["Frivillighet","Den som väljer att avstå från plånboken ska ha samma tillgång till tjänster."]]
    },
    "digihenkkarit-versions": {
      step: "Hur gick projektet vidare?",
      tag: "Från EU till Finland",
      title: "Lagen trädde i kraft före lanseringen av plånboken",
      lead: "EU slog fast gemensamma regler för plånboken. Finlands lagar fördelade myndigheternas uppgifter och angav villkoren för det digitala identitetsbeviset.",
      chart: { rows: [
        ["April 2024","EU-förordningen","Gemensamma regler för plånböcker"],
        ["22.6.2026","Riksdagens andra behandling","Lagpaketet godkänns"],
        ["1.10.2026","Lagarna träder i kraft","Villkoren för det digitala beviset börjar gälla"],
        ["Slutet av 2027","Suomi.fi:s tidsplan","Planerad lansering av plånboken"]
      ] },
      notes: ["Polisen eller en annan behörig myndighet beviljar rätten till det digitala beviset. Myndigheten för digitalisering och befolkningsdata erbjuder beviset i plånboken och ansvarar för Suomi.fi-plånboken."],
      more: ["Traficom övervakar leverantörer av plånböcker och för register över tjänster som använder dem. Lagens ikraftträdande och appens lansering har skilda tidtabeller."],
      sources: [
        "EU:s eIDAS-ändring 2024/1183",
        "Riksdagens protokoll PTK 70/2026 vp, andra behandlingen",
        "Lag 812/2026, 7 och 15 §",
        "Lag 810/2026, 7 och 16 §",
        "Myndigheten för digitalisering och befolkningsdata, tidsplanen för Suomi.fi-plånboken"
      ],
      terms: [["eIDAS","EU:s gemensamma regler för elektronisk identifiering, digitala plånböcker och betrodda tjänster."]]
    }
  }),
  'sports-intro': {
    step: 'Vad ändras i lagen',
    tag: 'Gäller sedan 1 juli 2026',
    title: 'Ett nytt alternativ för idrottares pensioner',
    lead: 'Finland har ändrat reglerna för hur föreningar och avlönade idrottare kan ordna pensionsskydd. Bakgrunden var brist på pensionsförsäkringar.',
    chart: {caption: '', rows: [['Tidigare alternativ', 'Sparandet ger ränta'], ['Nytt alternativ', 'Sparandet knyts till placeringar']]},
    notes: ['Föreningarna brukar ordna försäkring för idrottare som når upp till lagens inkomstgräns. Med det nya alternativet beror sparandets värde på hur placeringarna utvecklas.'],
    more: [
      'Ett försäkringsbolag slutade erbjuda pensionsförsäkringen i slutet av 2025. Det bolag som fanns kvar erbjöd den bara till en begränsad grupp. Många idrottare riskerade därför att stå utan pensionsförsäkring.',
      'Enligt regeringen hade försäkringsmarknaden gått över till placeringsbundna försäkringar. Regeringen räknade med att ändringen skulle få fler bolag att erbjuda pensionsförsäkring till idrottare.'
    ],
    sources: ['Lag 594/2026, 14 § och ikraftträdande', 'Regeringens proposition, s. 2–3, bakgrunden till ändringen', 'Social- och hälsovårdsministeriets pressmeddelande', abbreviations, illustrations],
    terms: [bill, ['Pensionsförsäkring', 'En försäkring där sparpengar byggs upp för att ge inkomster under pensionen.'],
      ['Placeringsbunden pensionsförsäkring', 'En pensionsförsäkring där sparandets värde stiger eller sjunker med de placeringar som sparandet är knutet till.'],
      ['Inkomstgräns', 'Den lägsta lön som används för att avgöra om en förening är skyldig att försäkra en idrottare.']]
  },
  'sports-outcome': {
    step: 'Vem får besked',
    tag: 'Vem får besked',
    title: 'Föreningar som tecknat försäkring får besked',
    lead: 'Om ett bolag planerar att begränsa eller sluta erbjuda idrottsförsäkringar måste det meddela försäkringstagaren. Det är ofta idrottarens förening.',
    chart: {caption: 'Vem försäkringsbolaget måste meddela', rows: [['Förut', 'Ministeriet'], ['Nu', 'Ministeriet', 'Försäkringstagaren']]},
    notes: ['Skyldigheten gäller det olycksfalls- och pensionsskydd som lagen reglerar. En förening som får besked kan använda tiden till att leta efter ett annat försäkringsbolag.'],
    more: [
      'När en förening tecknar en försäkring åt en spelare är föreningen försäkringstagare och spelaren försäkrad. En individuell idrottare som uppfyller lagens villkor kan teckna sin försäkring själv och ha båda rollerna.',
      'Beskedet enligt 16 a § går till den som har ingått försäkringsavtalet.'
    ],
    sources: [oldNotice, noticeLaw, 'Regeringens proposition, avsnitt 2.1 om försäkringsskyldigheten'],
    terms: [policy, ['Försäkrad idrottare', 'Den idrottare som får olycksfalls- eller pensionsskydd genom försäkringen.'],
      section16, ['Social- och hälsovårdsministeriet (STM på finska)', 'Ministeriet som beredde propositionen om idrottarnas försäkringsskydd.']]
  },
  'sports-requests': {
    step: 'Vad spelarna ville ändra',
    tag: 'Yttranden',
    title: 'Spelarna ville ha besked tidigare',
    lead: 'Fotbollsspelarnas förening JPY föreslog ändringar för både ministeriet och riksdagen.',
    chart: {rows: [['Hur tidigt', 'Minst två år i förväg'], ['Vilka fler skulle få besked', 'Företrädare för försäkringstagarna och idrottarna, till exempel ligor eller spelarföreningar']]},
    notes: ['Föreningen lade fram förslagen i mars när ministeriet samlade in synpunkter på utkastet. I maj upprepade den dem för riksdagens social- och hälsovårdsutskott.'],
    more: [
      'JPY ansåg att idrottarnas pensionsskydd inte kunde vila på en enda försäkringsgivare. I yttrandet från mars bad föreningen att ministeriet skulle få minst två års förvarning och att berörda ligor, grenförbund och spelarföreningar också skulle få besked.',
      'Även de finländska ishockeyspelarnas förening ville ha en längre tidsfrist och besked till företrädarna.'
    ],
    sources: [jpySubmission, 'JPY:s yttrande till utskottet, hörandet den 12 maj, punkt 1',
      'Remissvaren från fotbolls- och ishockeyspelarnas föreningar', illustrations],
    terms: [jpy, submission, ['Företrädare', 'En grupp som talar för andra, till exempel en liga, ett grenförbund eller en spelarförening.'],
      ['Social- och hälsovårdsutskottet', 'Riksdagens utskott som hörde sakkunniga och lämnade ett betänkande om förslaget. På finska StV.']]
  },
  'sports-deadline': {
    step: 'När beskedet måste ges',
    tag: 'Tidsfristen',
    title: 'Tidsfristen vid årsskiftet blev kvar',
    lead: 'Bolaget måste ge besked före årets slut om det planerar att ändra sitt utbud efter utgången av följande kalenderår.',
    chart: {caption: 'Exempel', rows: [['31 dec. 2026', 'Sista dag att ge besked'], ['1 jan. 2028', 'Bolaget planerar att sluta erbjuda försäkringen']]},
    notes: ['I exemplet ligger hela 2027 mellan sista dagen att ge besked och det planerade stoppet. Samma tidsfrist gäller för beskedet till ministeriet och till försäkringstagarna.'],
    more: [
      'Om bolaget planerar att sluta erbjuda försäkringen den 31 december 2028 är tidsfristen fortfarande slutet av 2026. Flyttas stoppet till den 1 januari 2029 ska beskedet ges senast den 31 december 2027.',
      'JPY ville ha minst två års förvarning. Riksdagen behöll kalenderårsregeln och lade till försäkringstagaren bland dem som får besked.'
    ],
    sources: [oldNotice, noticeLaw, jpySubmission],
    terms: [['Besked', 'Förhandsinformation om att bolaget tänker begränsa eller sluta erbjuda det försäkringsskydd som lagen gäller.'],
      ['Kalenderår', 'Tiden från den 1 januari till den 31 december. Tidsfristen är knuten till årsskiftet.'], policy, jpy]
  },
  'sports-versions': {
    step: 'När lydelsen ändrades',
    tag: 'Förslaget i riksdagen',
    title: 'Utskottet lade till försäkringstagaren',
    lead: 'Ministeriet hade varit den enda mottagaren sedan 2016.',
    chart: {rows: [
      ['Feb. 2026', 'Ministeriets utkast', 'Besked till ministeriet'],
      ['16 april 2026', 'Proposition till riksdagen', 'Den gamla regeln blir kvar'],
      ['2 juni 2026', 'Utskottets betänkande', 'Försäkringstagaren läggs till'],
      ['26 juni 2026', 'Lagen stadfästs', 'Båda ska få besked']
    ]},
    notes: ['Aprilpropositionen gällde hur idrottarnas pensioner skulle kunna ordnas. Bland handlingarna som granskats här är utskottets betänkande det första där försäkringstagaren får rätt till besked.'],
    more: [
      'I februari övervägde ministeriet en separat pensionskassa som ett sätt att ordna skyddet. Enligt utkastet skulle även kassan ge besked om den planerade att begränsa eller sluta erbjuda försäkring.',
      'Regeringen slopade förslaget om en kassa före propositionen till riksdagen. Riksdagen antog senare utskottets lydelse om vem som ska få besked.'
    ],
    sources: [oldNotice, 'Ministeriets februariutkast, 16 a § (Word)', 'Regeringens proposition, lagförslaget och avsnitt 6',
      'Utskottets betänkande ShUB 7/2026 rd, 16 a §', noticeLaw, 'Riksdagens svar RSv 83/2026 rd'],
    terms: [section16, ['Ministeriets utkast', 'Förslag till lagtext som ministeriet ber om synpunkter på före propositionen till riksdagen.'],
      healthReport, ['RSv 83/2026 rd', 'Riksdagens formella svar, som visar vilken lydelse den antog. På finska EV 83/2026 vp.'],
      ['Lag 594/2026', 'Numret på den stadfästa ändringen av idrottarnas försäkringsskydd i Finlands författningssamling.']]
  },
  'sports-reasons': {
    step: 'Varför utskottet ändrade regeln',
    tag: 'Utskottets motivering',
    title: 'Varför ska försäkringstagaren få besked?',
    lead: 'Ministeriet nämnde JPY bland grupperna som ville ändra regeln. Regeringen tog upp synpunkterna i aprilpropositionen och utskottet behandlade frågan i juni.',
    chart: {rows: [
      ['Därför behöll utskottet tidsfristen', 'Enligt ministeriet kunde längre förvarning göra försäkringsbolagen mindre villiga att erbjuda skydd.'],
      ['Därför lades försäkringstagaren till', 'Utskottet ansåg att beskedet skulle skydda den person eller förening som tecknat försäkringen.']
    ]},
    notes: ['Utskottet behandlade önskemålen från hörandena tillsammans. Det förblir oklart vilken roll JPY spelade för slutresultatet.'],
    more: [
      'I propositionen till riksdagen tog regeringen upp risken för att utbudet skulle minska. En längre tidsfrist eller fler mottagare kunde enligt regeringen få försäkringsbolagen att tveka inför att erbjuda skydd.',
      'Utskottet beaktade ministeriets bedömning av tidsfristen. Det motiverade beslutet om mottagarna med att den som ingått försäkringsavtalet behöver skydd.'
    ],
    sources: ['Utskottets betänkande ShUB 7/2026 rd, anmälningsskyldigheten', 'Propositionen, avsnitt 6 om remissvaren',
      'Ministeriets remissammandrag, s. 3', illustrations],
    terms: [jpy, policy, ['Remissammandrag', 'Ministeriets sammanställning av de synpunkter som kom in om utkastet.'], healthReport]
  },
  'sports-disclosures': {
    step: 'Vad JPY anmälde',
    tag: 'Öppenhetsregistret',
    title: 'JPY anmälde lobbning',
    lead: 'Spelarföreningen anmälde lobbning gentemot ministeriet i projektet om idrottarnas försäkringsskydd.',
    chart: {caption: 'Rapporteringsperiod', period: 'Januari–juni 2026', months: ['Jan', 'Feb', 'Mars', 'Apr', 'Maj', 'Juni']},
    notes: ['Anmälan visar projektets namn och den sex månader långa rapporteringsperioden. JPY:s skriftliga yttranden har egna datum. När enskilda lobbykontakter ägde rum är okänt.'],
    more: [
      'Öppenhetsregistret gäller lobbning gentemot ministerierna och riksdagen. Deltagande i dokumenterade officiella höranden är undantaget från anmälningsplikten.',
      'Yttrandet från mars beskriver hur JPY ville att beskedet skulle ges. Registeranmälan anger vilket projekt föreningen anmälde lobbning om.'
    ],
    sources: ['Öppenhetsregistret, JAL-26-8286-T, ämne 35079', 'Öppenhetsregistrets guide till vad som ska anmälas', jpySubmission, illustrations],
    sourceURLs: {1: registerGuide},
    terms: [jpy, register, period, ['Dokumenterat officiellt hörande', 'Ett formellt tillfälle att lämna uppgifter eller synpunkter under beredningen. Deltagarna eller yttrandena dokumenteras.']]
  },
  'gambling-intro': {
    step: 'Vad ändras i lagen',
    tag: 'Penningspelsreformen',
    title: 'Finland öppnar vadhållningen för konkurrens',
    lead: 'Från den 1 juli 2027 kan spelare på det finländska fastlandet spela också hos konkurrenter till statliga Veikkaus, om de har licens.',
    chart: {caption: 'Exempel enligt den nya lagen', rows: [['Öppnas för konkurrens', 'Vadhållning och nätkasinon'], ['Bara Veikkaus', 'Lotterier och skraplotter']]},
    notes: ['Regeringen vill att mer av spelandet ska omfattas av finländsk tillsyn och att skadeverkningarna ska minska. Bolag som går in på marknaden måste följa regler för att skydda spelarna.'],
    more: [
      'Spelbolagen kunde börja ansöka om licens den 1 mars 2026, innan marknaden öppnade. Veikkaus kan också ansöka om licens för spel som öppnas för konkurrens.',
      'Fysiska kasinospel och spelautomater omfattas fortfarande av ensamrätten. Penningbingo på nätet hör till spelen som öppnas för konkurrens.'
    ],
    sources: ['Inrikesministeriets pressmeddelande om lagen', 'Penningspelslagen 10/2026, 5–6 och 106 § (PDF)', abbreviations, illustrations],
    sourceURLs: {0: 'https://valtioneuvosto.fi/sv/-/1410869/anordnandet-av-penningspel-oppnas-delvis-for-konkurrens', 1: gamblingLaw + '#page=3'},
    terms: [bill, ['Veikkaus', 'Finlands statsägda penningspelsbolag. Från den 1 juli 2027 öppnas delar av den marknad som bolaget haft ensamrätt till.'],
      ['Penningspelslicens', 'Myndighetens tillstånd att ordna bestämda penningspel enligt villkoren i penningspelslagen.'],
      ['Ensamrättslicens', 'En licens som förbehåller vissa spel åt en aktör. Lotterier och skraplotter är exempel.']]
  },
  'gambling-outcome': {
    step: 'Hur långt tillbaka myndigheten granskar',
    tag: 'Penningspelslicenser',
    title: 'Tidigare påföljder granskas för en kortare tid',
    lead: 'Ett tidigare förbud eller en påföljdsavgift kan fortfarande hindra ett bolag från att få licens. Granskningsperioden avgör hur långt tillbaka myndigheten går.',
    chart: {caption: 'Perioden för granskning av påföljder', rows: [['Första utkastet', '5 år'], ['Stadfäst lag', '2 år']], axis: ['Längre tillbaka', 'Dagen då licensen prövas']},
    notes: ['Myndigheten kan till exempel ha förbjudit ett bolag att marknadsföra penningspel för att bolaget brutit mot lotterilagen. Ett sådant beslut räknas med om det ryms inom tidsgränserna.'],
    more: [
      'Myndigheten ser på när förbudet beslutades eller avgiften påfördes. Beslutet ska ligga inom tvåårsperioden och vara fattat efter det fasta gränsdatumet.',
      'Samma paragraf har en särskild treårsperiod för vissa förbud och avgifter som gäller anordnande eller marknadsföring av penningspel utan den licens som den nya lagen kräver.'
    ],
    sources: ['Utkastet från juli 2024, 10 §, s. 309', gamblingCheck, gamblingEnglish],
    sourceURLs: {1: gamblingLaw + '#page=6'},
    terms: [lookback, lotteries, ['Förbudsbeslut', 'Myndighetens beslut om att en verksamhet måste upphöra, exempelvis marknadsföring som strider mot lotterilagen.'],
      ['Påföljdsavgift', 'En avgift som myndigheten påför när någon bryter mot lagen.']]
  },
  'gambling-requests': {
    step: 'Vad Betsson bad om',
    tag: 'Yttrande',
    title: 'Betsson ville slopa licenshindret',
    lead: 'Penningspelsbolaget gav inrikesministeriet två alternativ i sitt yttrande om utkastet i augusti 2024.',
    chart: {rows: [['Första önskemålet', 'Slopa licenshindret för tidigare förbud eller avgifter'], ['Om hindret blir kvar', 'Granska högst två år tillbaka']]},
    notes: ['Betsson hävdade att den nya licensregeln skulle ge tidigare överträdelser nya följder. Spelbolaget Kindred invände också mot femårsperioden. En finländsk branschförening ville ha en kortare period.'],
    more: [
      'I Selins studie framförde flera internationella bolag och branschorganisationer rättsliga invändningar mot licenskravet. European Gaming and Betting Association uttryckte liknande invändningar under riksdagens höranden.',
      'Tvåårsperioden i den antagna lagen motsvarar Betssons andrahandsalternativ för de angivna påföljderna. Förbuden och avgifterna kan fortfarande vara skäl att neka licens.'
    ],
    sources: ['Betssons yttrande, s. 6 och 15', 'Ministeriets remissammandrag, 10 §', 'Jani Selins studie, resultat och diskussion', illustrations],
    terms: [['Betsson Group', 'Penningspelsbolaget som lämnade de två förslagen i den här delen av berättelsen.'],
      ['Kindred', 'Ett nätspelsbolag som också lämnade synpunkter på utkastet.'],
      ['EGBA', 'European Gaming and Betting Association, en branschorganisation för nätspelsbolag.'], submission]
  },
  'gambling-versions': {
    step: 'Vad gränsdatumet betyder',
    tag: 'Lagens lydelse',
    title: 'Tvåårsregeln har också ett gränsdatum',
    lead: 'Myndigheten räknar med vissa förbud och avgifter enligt lotterilagen som beslutats under de två åren före licensprövningen och efter den 1 september 2024.',
    chart: {rows: [
      ['Juli 2024', 'Ministeriets utkast', 'Fem år'],
      ['Mars 2025', 'Proposition till riksdagen', 'Två år och fast gränsdatum'],
      ['Dec. 2025', 'Utskottets betänkande', 'Regeln blir kvar'],
      ['Jan. 2026', 'Lagen stadfästs', 'Regeln blir kvar']
    ]},
    notes: [
      'Tänk att en ansökan prövas den 1 mars 2026. Ett beslut från juli 2024 är mindre än två år gammalt. Det faller ändå utanför regeln eftersom det är från tiden före gränsdatumet. Ett motsvarande beslut från den 2 september 2024 uppfyller båda tidsvillkoren.',
      'Forskaren Jani Selin bedömer att branschens invändningar kan ha bidragit till den kortare perioden. Betssons roll förblir oklar.'
    ],
    more: [
      'Regeln gäller förbud eller påföljdsavgifter för anordnande eller marknadsföring av penningspel i strid med lotterilagen. Regeringen beskrev bestämmelsen som en del av bedömningen av om sökanden är lämplig som spelanordnare.',
      'Selin studerade 36 yttranden från branschen. Av dem gällde 19 ministeriets remiss och 17 lämnades till riksdagens höranden. Analysen bygger på de här offentliga yttrandena.'
    ],
    sources: ['Ministeriets utkast, 10 §, s. 309', 'Regeringens proposition, 10 § och motiveringen', 'Förvaltningsutskottets betänkande FvUB 28/2025 rd, 10 §',
      gamblingCheck, 'Jani Selins studie (THL), diskussion', gamblingEnglish],
    sourceURLs: {3: gamblingLaw + '#page=6'},
    terms: [['Gränsdatum', 'Ett fast datum. Förbudet eller avgiften måste ha beslutats efter det datumet för att räknas med. Här är datumet den 1 september 2024.'],
      lookback, lotteries, administrationReport, ['THL', 'Institutet för hälsa och välfärd, som anges som Jani Selins forskningsorganisation i studien.']]
  },
  'gambling-pool-betting': {
    step: 'Vad som ändras för hästspelen',
    tag: 'Spel på hästar',
    title: 'Totospelen öppnas för konkurrens',
    lead: 'I totospel samlas insatserna i en gemensam pott som vinsterna tas ur. Det svenska spelbolaget ATG ville att Finland skulle öppna totospelen för konkurrens.',
    chart: {caption: '', rows: [['Utkastet från juli 2024', 'Bara Veikkaus'], ['Stadfäst lag', 'Öppet för bolag med licens']]},
    notes: [
      'Den 1 november 2024 slog ekonomisk-politiska ministerutskottet fast att totospel, liksom annan vadhållning, skulle öppnas för konkurrens. Propositionen höll fortfarande på att beredas.',
      'Suomen Hippos stödde också att spelen öppnades. Paf ville behålla ensamrätten. Det är oklart vilken roll ATG spelade för beslutet.'
    ],
    more: [
      'Regeringen vägde om hästspel borde behandlas på samma sätt som övrig vadhållning. I propositionen bedömde den att internationellt samarbete mellan licensierade bolag kunde stärka hästspelens konkurrenskraft.',
      'Regeringen bedömde också om ett öppnande kunde leda till mer marknadsföring. De här resonemangen ingick i propositionen till riksdagen.'
    ],
    sources: ['Ministeriets utkast, 5–6 §, s. 307', 'ATG:s yttrande, s. 3–5', 'Ministeriets sammanställning av yttrandena, s. 18–22', 'Regeringens besked den 1 november 2024',
      'Regeringens proposition, avsnitt 5.1.3 om hästspel (PDF)', 'Penningspelslagen 10/2026, 4–6 § (PDF)', illustrations],
    sourceURLs: {5: gamblingLaw + '#page=2'},
    terms: [['Totospel', 'Spel på hästtävlingar där insatserna samlas och den del som avsatts för vinster fördelas mellan vinnarna.'],
      ['ATG', 'AB Trav och Galopp, ett svenskt spelbolag som erbjuder spel på hästar.'],
      ['Suomen Hippos', 'Finlands riksorganisation för travsport och hästuppfödning.'],
      ['Paf', 'Ålands Penningautomatförening, ett penningspelsbolag med säte på Åland.'],
      ['Ministerutskott', 'En grupp ministrar. Det ekonomisk-politiska ministerutskottet fattade beslutet om att öppna totospelen.']]
  },
  'gambling-register': {
    step: 'Vad Veikkaus anmälde',
    tag: 'Öppenhetsregistret',
    title: 'Veikkaus anmälde lobbning',
    lead: 'Det statsägda spelbolaget anmälde lobbning om reformen gentemot ministeriet och riksdagen.',
    chart: {caption: 'Rapporteringsperiod', period: 'April–juni 2024', months: ['Apr', 'Maj', 'Juni']},
    notes: ['Perioden slutade innan ministeriet publicerade sitt utkast i juli 2024. Anmälan gäller reformen som helhet. När de enskilda kontakterna ägde rum är okänt.'],
    more: [
      'Projektnumret i registret motsvarar det i inrikesministeriets beredningshandlingar. Ministeriet tillsatte projektet i oktober 2023.',
      'Veikkaus anmälde sin egen lobbning. Registret visar ämnet och vem lobbningen riktade sig till under perioden.'
    ],
    sources: ['Öppenhetsregistret, VEI-24-699-T, ämne 2864', 'Inrikesministeriets projekt och utkastet från juli 2024',
      'Öppenhetsregistrets guide till vad som ska anmälas', illustrations],
    sourceURLs: {1: 'https://valtioneuvosto.fi/sv/projektet?tunnus=SM053%3A00%2F2023', 2: registerGuide},
    terms: [register, ['Direkt lobbning', 'Kontakter med beslutsfattare för att påverka en fråga. Här har Veikkaus anmält sin egen lobbning.'],
      period, ['Projektnummer SM053:00/2023', 'Inrikesministeriets beteckning för projektet. Med den går det att koppla registeranmälan till beredningshandlingarna.']]
  },
  'gambling-disclosures': {
    step: 'Vad ledamoten anmälde',
    tag: 'Gåvoanmälan',
    title: 'En ledamot anmälde en biljett från Veikkaus',
    lead: 'Ville Kaunisto var vice ordförande i ekonomiutskottet när det behandlade penningspelspropositionen.',
    chart: {ticket: ['Basketbiljett', '490 €'], rows: [
      ['7 maj 2025', 'Utskottets handling', 'Kaunisto deltar i den avgörande behandlingen av utlåtandet'],
      ['27 aug. 2025', 'Gåvoanmälan', 'Anmäld dag då biljetten användes'],
      ['16 sep. 2025', 'Gåvoanmälan', 'Kaunisto lämnar in anmälan']
    ]},
    notes: [
      'Biljetten gällde en basketmatch mellan Finland och Sverige. Som givare anges Veikkaus, vars ensamrätt propositionen gällde. Datumet i maj kommer från utskottets handling. De två senare datumen kommer från Kaunistos anmälan.',
      'När biljetten erbjöds och togs emot är okänt. Vilken påverkan den eventuellt hade på utskottets utlåtande är oklart.'
    ],
    more: [
      'Ekonomiutskottet gav ett utlåtande om förslaget. Förvaltningsutskottet ansvarade för behandlingen och lade fram sitt betänkande i december 2025.',
      'Deltagarförteckningen visar Kaunistos roll i utskottet. Datumet då biljetten användes och biljettens värde kommer från hans egen anmälan. Veikkaus tidigare registeranmälan gäller bolagets lobbning om reformen.'
    ],
    sources: ['Ekonomiutskottets utlåtande EkUU 12/2025 rd, deltagare', 'Riksdagens gåvoanmälan, ledamot 1425, post 20 år 2025',
      'Givarens registeranmälan om reformen, ämne 2864', 'Förvaltningsutskottets betänkande FvUB 28/2025 rd'],
    terms: [['Riksdagsledamot', 'En person som valts in i riksdagen. Gåvoanmälan här gjordes av riksdagsledamoten Ville Kaunisto.'],
      ['Gåvoanmälan', 'En ledamots offentliga anmälan om en gåva eller förmån, till exempel vem som gav den och vad den var värd.'],
      ['EkUU 12/2025 rd', 'Ekonomiutskottets utlåtande om propositionen till utskottet som ansvarade för den. På finska TaVL 12/2025 vp.'],
      administrationReport]
  }
};
