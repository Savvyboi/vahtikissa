// Agenda matches describe the subject being debated. Keep patterns specific to
// policy terms and allow Finnish and Swedish inflections after the stems.
const topics = [
  ['migration', 'Maahantulo ja turvapaikka', 'Inresa och asyl', 'Migration and asylum', /(?<![\p{L}\p{N}])(?:maahanmuut|maahantul|ulkomaalaisla|turvapaik|pakolais|kansalaisuusla|invandring|inresa|utlänningslag|asyl|flykting|medborgarskapslag)/iu],
  ['ukraine', 'Ukrainan sota ja tuki', 'Kriget i Ukraina och stöd', 'War in Ukraine and support', /(?<![\p{L}\p{N}])(?:ukrain|ukrainsk)/iu],
  ['middle-east', 'Gaza ja Palestiina', 'Gaza och Palestina', 'Gaza and Palestine', /(?<![\p{L}\p{N}])(?:gaza|palestiin|palestin)/iu],
  ['military-equipment', 'Puolustushankinnat ja asevalvonta', 'Försvarsupphandling och vapenkontroll', 'Defence procurement and arms control', /(?<![\p{L}\p{N}])(?:puolustushankin|jalkaväkimiin|rypälease|maamiino|asevalvont|asehankin|försvarsupphandl|antipersonellmin|truppmin|klustervapen|vapenkontroll|vapenanskaff)/iu],
  ['border-security', 'Rajaturvallisuus', 'Gränssäkerhet', 'Border security', /(?<![\p{L}\p{N}])(?:rajaturvall|rajavartio|itäraja|gränssäker|gränsbevak|östgräns)/iu],
  ['work', 'Työllisyys ja työehdot', 'Sysselsättning och arbetsvillkor', 'Employment and working conditions', /(?<![\p{L}\p{N}])(?:työllis|työttöm|työehto|työsopimu|työrauh|työmarkkin|työriito|työtaistel|työaikala|palkkamall|palkkatu|irtisanomisperus|irtisanomissuo|paikallisen sopimi|sysselsätt|arbetslös|arbetsvillkor|arbetsavtal|arbetsfred|arbetsmarknad|arbetstvist|stridsåtgärd|arbetstidslag|lönemodell|lönesubvention|uppsägningsskydd|uppsägningsgrund|lokala avtal)/iu],
  ['regional-development', 'Aluekehitys ja elinvoima', 'Regional utveckling och livskraft', 'Regional development', /(?<![\p{L}\p{N}])(?:elinvoim|aluekehity|aluepoli|alueellisesti|regional utveckling|regionalpolitik|livskraft)/iu],
  ['drugs', 'Huumeet ja päihdepalvelut', 'Narkotika och missbrukarvård', 'Drugs and addiction services', /(?<![\p{L}\p{N}])(?:huume|päihde|narkotik|missbrukarvård|rusmedel)/iu],
  ['housing', 'Asuminen ja rakentaminen', 'Boende och byggande', 'Housing and construction', /(?<![\p{L}\p{N}])(?:asumis|asunto|vuokra-as|rakennusal|rakentamis|kiinteistönhankin|boend|bostad|byggbransch|byggand|fastighetsförvärv)/iu],
  ['media', 'Yleisradio ja media', 'Rundradion och medier', 'Public broadcasting and media', /(?<![\p{L}\p{N}])(?:yleisradio|yle\b|rundradio|public service|mediestöd|mediatu)/iu],
  ['health-services', 'Terveydenhuolto ja hoitoon pääsy', 'Hälso- och sjukvård och tillgång till vård', 'Healthcare and access to care', /(?<![\p{L}\p{N}])(?:terveydenhuol|hoitotak|sairaal|terveyskesk|terveystieto|mielenterve|hälsovård|vårdgaranti|sjukhus|hälsocentral|hälsodata|psykisk hälsa)/iu],
  ['social-security', 'Sosiaaliturva ja etuudet', 'Social trygghet och förmåner', 'Social security and benefits', /(?<![\p{L}\p{N}])(?:sosiaalitur|toimeentulotu|yleistuk|asumistuk|perusturv|kansaneläk|lapsilis|social trygghet|utkomststöd|allmänt stöd|bostadsbidrag|grundtrygghet|folkpension|barnbidrag)/iu],
  ['child-services', 'Lastensuojelu ja perhepalvelut', 'Barnskydd och familjetjänster', 'Child protection and family services', /(?<![\p{L}\p{N}])(?:lastensuoj|perhepalvel|sijaisperh|barnskydd|familjetjänst|familjehem)/iu],
  ['education-levels', 'Koulut ja oppiminen', 'Skolor och lärande', 'Schools and learning', /(?<![\p{L}\p{N}])(?:perusopetu|oppimis|oppivelvol|varhaiskasv|lukiokoul|ammatillis.{0,12}koulut|grundläggande utbildn|inlärn|läroplikt|småbarnspedagog|gymnasieutbildn|yrkesutbildn)/iu],
  ['higher-education', 'Korkeakoulut ja tutkimus', 'Högskolor och forskning', 'Higher education and research', /(?<![\p{L}\p{N}])(?:korkeakoul|yliopisto|tutkimusrahoit|högskol|universitet|forskningsfinans)/iu],
  ['tax', 'Verotus ja veromuutokset', 'Beskattning och skatteändringar', 'Taxes and tax changes', /(?<![\p{L}\p{N}])(?:tulovero|arvonlisävero|valmistevero|verotu|verotuk|verolak|inkomstskatt|mervärdesskatt|punktskatt|beskattn|skattelag)/iu],
  ['public-finances', 'Budjetti ja julkinen talous', 'Budget och offentliga finanser', 'Budget and public finances', /(?<![\p{L}\p{N}])(?:talousarvio|lisätalousarvio|budjet|julkise.{0,12}talou|kehysriih|velkaantumi|liialli.{0,9}alijäämä|pääluokka \d|offentlig.{0,12}finans|ramförhandl|skuldsättn|alltför stort underskott|huvudtitel \d)/iu],
  ['criminal-justice', 'Rikokset ja seuraamukset', 'Brott och påföljder', 'Crime and sentencing', /(?<![\p{L}\p{N}])(?:rikosla|rikosoike|vankeus|seksuaalirik|väkivaltarik|rangaist|strafflag|straffrätt|fängelse|sexualbrott|våldsbrott|påföljd)/iu],
  ['policing', 'Sisäinen turvallisuus ja pelastustoimi', 'Inre säkerhet och räddningsväsende', 'Internal security and emergency services', /(?<![\p{L}\p{N}])(?:poliisi|pelastustoi|hätäkesk|turvallisuusviranom|sisäise.{0,4} turvallisuu|polis|räddningsväsend|nödcentral|säkerhetsmyndig|inre säkerhet)/iu],
  ['energy', 'Energiantuotanto ja sähkö', 'Energiproduktion och el', 'Energy production and electricity', /(?<![\p{L}\p{N}])(?:sähkömarkkin|energiantuot|tuulivoim|ydinvoim|ydinenergi|energiatuk|elmarknad|energiprodukt|vindkraft|kärnkraft|kärnenergi|energistöd)/iu],
  ['climate', 'Ilmastopolitiikka ja päästöt', 'Klimatpolitik och utsläpp', 'Climate policy and emissions', /(?<![\p{L}\p{N}])(?:ilmasto|päästökaup|hiiliniel|hiilineutraal|klimat|utsläppshandel|kolsänk|koldioxidneutral)/iu],
  ['forests', 'Metsät ja luonnonsuojelu', 'Skog och naturskydd', 'Forests and conservation', /(?<![\p{L}\p{N}])(?:metsätal|metsäla|luonnonsuoj|monimuotoisu|ennallistam|skogsbruk|skogslag|naturskydd|biologisk mångfald|restaureringsförordning)/iu],
  ['agriculture-food', 'Maatalous ja ruokaketju', 'Jordbruk och livsmedelskedja', 'Agriculture and food supply', /(?<![\p{L}\p{N}])(?:maatalou|viljelij|elintarvi|ruokaketj|jordbruk|lantbruk|livsmed)/iu],
  ['roads-rails', 'Tiet, radat ja joukkoliikenne', 'Vägar, järnvägar och kollektivtrafik', 'Roads, rail and public transport', /(?<![\p{L}\p{N}])(?:maanti|rautat|raideliik|joukkoliik|tieverk|landsväg|järnväg|spårtrafik|kollektivtrafik|vägnät)/iu],
  ['digital', 'Digipalvelut ja tietosuoja', 'Digitala tjänster och dataskydd', 'Digital services and data protection', /(?<![\p{L}\p{N}])(?:digitaal|digipalvel|tietosuo|tekoäly|kyberturv|digital|dataskydd|artificiell intelligens|cybersäkerhet)/iu],
  ['fundraising', 'Rahankeräys ja rahapelit', 'Penninginsamling och penningspel', 'Fundraising and gambling', /(?<![\p{L}\p{N}])(?:rahankeräy|rahapeli|arpajaisla|penninginsamling|penningspel|lotterilag)/iu],
  ['government-programme', 'Hallitusohjelma ja hallituksen linja', 'Regeringsprogrammet och regeringens politik', 'Government programme and policy', /(?<![\p{L}\p{N}])(?:hallitusohjelm|hallituksen ohjelma|pääministerin ilmoitus hallituksen politiik|regeringsprogram|statsministerns upplysning om regeringens politik)/iu],
  ['integration', 'Kotoutuminen', 'Integration', 'Integration', /(?<![\p{L}\p{N}])(?:kotoutumi|kotouttami|integrationsfrämj|främjande av integration)/iu],
  ['eldercare', 'Ikääntyminen ja vanhushoiva', 'Åldrande och äldreomsorg', 'Ageing and eldercare', /(?<![\p{L}\p{N}])(?:ikääntymi|vanhushoiv|vanhuspalvel|äldreomsorg|äldreservice|åldrande)/iu],
  ['cost-of-living', 'Köyhyys ja elinkustannukset', 'Fattigdom och levnadskostnader', 'Poverty and cost of living', /(?<![\p{L}\p{N}])(?:köyhyyd|köyhyys|elinkustannu|arjen kustannu|fattigdom|levnadskostnad)/iu],
  ['alcohol-tobacco', 'Alkoholi- ja tupakkasääntely', 'Alkohol- och tobaksreglering', 'Alcohol and tobacco regulation', /(?<![\p{L}\p{N}])(?:alkoholila|tupakkala|nikotiinipu|alkohollag|tobakslag|nikotinpås)/iu],
  ['industry', 'Teollisuuspolitiikka', 'Industripolitik', 'Industrial policy', /(?<![\p{L}\p{N}])(?:teollisuuspolitiik|industripolitik)/iu]
];

export function detailedAgendaTopics(speech) {
  const agenda = [speech.agenda, speech.agendaSv].filter(Boolean).join(' ');
  return topics.filter(([, , , , pattern]) => pattern.test(agenda)).map(([key]) => key);
}

export function detailedAgendaTopicLabel(key, lang) {
  const topic = topics.find(([id]) => key === id);
  return topic?.[lang === 'sv' ? 2 : lang === 'en' ? 3 : 1];
}
