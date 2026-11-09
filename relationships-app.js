import { escapeHTML as e, policyTopicLabel, policyTopicOptions, formatDate } from './app-utils.js';
import { createNetworkLoader, relationshipExport, downloadRelationships, commonBallotEvidence } from './network-data.js';
import { relationshipLabel } from './relationship-labels.js';
import { createRelationshipTables } from './relationship-tables.js';
import { createRelationshipEvidence } from './relationship-evidence.js';
import { relationshipNavigation } from './relationship-navigation.js';
import { relationshipShell } from './relationship-shell.js';
import { votingComparisonRows, orderVotingComparisons, agreementWidth } from './relationship-visuals.js';
import { detailedAgendaTopicLabel } from './speech-topics.js';

const loader=createNetworkLoader();
const names={
  'topic-profiles':['Aiheisiin kohdistuva huomio','Uppmärksamhet per ämne','Topic attention'],
  'vote-neighbours':['Äänestysnaapurit','Röstningsgrannar','Voting neighbours'],
  'keyword-comparisons':['Ilmausten vertailu','Jämför uttryck','Keyword comparisons'],
  'party-heatmap':['Puolueiden yhtenevyys','Partiernas samstämmighet','Party agreement'],
  'emerging-phrases':['Nousevat ilmaukset','Växande uttryck','Emerging phrases']
};
const votingFeatures=new Set(['vote-neighbours','party-heatmap']);
const partyFeatures=new Set([...votingFeatures,'keyword-comparisons']);
const arr=x=>Array.isArray(x)?x:x&&typeof x==='object'?Object.values(x):[];

export async function renderRelationships(root,{lang='fi',view='full',current=()=>true}={}) {
  const explorerParams = new URLSearchParams(location.hash.split('?')[1] || '');
  if (!explorerParams.has('feature') || explorerParams.get('feature') === 'transparency') {
    const { renderTransparencyExplorer } = await import('./transparency-explorer.js');
    if (current()) return renderTransparencyExplorer(root, { lang, view, current });
    return;
  }
  const tr=(fi,sv,en)=>lang==='sv'?sv:lang==='en'?en:fi, title=key=>names[key]?.[lang==='sv'?1:lang==='en'?2:0]||key;
  const l=value=>relationshipLabel(value,lang);
  const number=(x,digits=3)=>typeof x==='number'&&Number.isFinite(x)?x.toLocaleString(lang==='en'?'en-GB':lang==='sv'?'sv-FI':'fi-FI',{maximumFractionDigits:digits}):'—';
  const percent=x=>x==null?'—':number(x*100,1)+' %';
  const sourceDate=value=>formatDate(value,lang==='sv'?'sv-FI':lang==='en'?'en-GB':'fi-FI');
  root.innerHTML=`<div class="page relationships-page">${relationshipNavigation(lang,'analysis')}<h1>${tr('Äänestykset & puheet','Omröstningar & anföranden','Votes & speeches')}</h1><p role="status">${tr('Ladataan analyysin lähdekuvausta…','Analysens källbeskrivning laddas…','Loading the analysis manifest…')}</p></div>`;
  const manifest=await loader.manifest();if(!current())return;
  const params=explorerParams;
  const requestedFeature=params.get('feature');
  let feature=Object.hasOwn(names,requestedFeature)?requestedFeature:'vote-neighbours',mp=manifest.members.some(m=>String(m.id)===params.get('mp'))?params.get('mp'):String(manifest.members[0]?.id||''),scope=manifest.scopes.find(s=>s.id===params.get('period'))?.id||'all',party=params.get('party')||'all',query=params.get('q')||'',rows=[],method={},revision=0;
  let analysisFilters={},presetIndex=0;
  let comparisonDirection=params.get('order')==='asc'?'asc':'desc',showLowSupport=params.get('low')==='1',neighbourLimit=12,comparisonMp=params.get('compare')||'';
  const overrides=new Map();
  const effectiveScope=()=>votingFeatures.has(feature)?scope:'all';
  const canPartyFilter=()=>partyFeatures.has(feature)&&!(feature==='keyword-comparisons'&&analysisFilters.groups?.some(group=>group.mpId));
  const memberMap=new Map(manifest.members.map(m=>[String(m.id),m]));
  const recordText=(record,key)=>lang==='sv'&&record[key+'Sv']||record[key]||'';
  const scopeLabel=scope=>scope?.topic?policyTopicLabel(scope.topic,lang):scope?.id==='all'?tr('Koko tallennettu jakso','Hela lagrade perioden','All stored votes'):scope?.label||'';
  const memberName=id=>{const m=memberMap.get(String(id));return m?`${m.firstName} ${m.lastName}`:String(id??'');};
  const memberLink=id=>`<a href="#/members/${encodeURIComponent(id)}">${e(memberName(id))}</a>`;
  const relationshipLink=id=>`<a href="#/relationships?${e(new URLSearchParams({feature,mp:String(id),period:scope}))}">${e(memberName(id))}</a>`;
  const parties=[...new Set(manifest.members.map(m=>m.party))].sort();
  root.innerHTML=relationshipShell({lang,manifest,feature,mp,scope,party,query,title,tr,memberName,scopeLabel,parties});
  const result=root.querySelector('[data-network-result]'),status=root.querySelector('.relationship-status'),evidence=root.querySelector('[data-network-evidence]'),form=root.querySelector('[data-network-form]');
  const evidencePanel=createRelationshipEvidence(evidence,{lang,current});
  const speechSources=new Map();let nextSources=0,pointEvidenceAction;
  const tables=createRelationshipTables({lang,onSort:(column,direction)=>{status.textContent=tr('Järjestetty: ','Sorterat: ','Sorted: ')+column+' · '+(direction==='asc'?tr('nousevasti','stigande','ascending'):tr('laskevasti','fallande','descending'));}});
  let currentData;
  function persist(){
    const p=new URLSearchParams({feature,mp,period:effectiveScope(),party,q:query});
    if(feature==='vote-neighbours'){
      if(comparisonDirection==='asc')p.set('order','asc');
      if(showLowSupport)p.set('low','1');
      if(comparisonMp)p.set('compare',comparisonMp);
    }
    history.replaceState(history.state,'', '#/relationships?'+p);
    root.dataset.route=location.hash;
  }
  function filtered(items){return items.filter(row=>(!canPartyFilter()||party==='all'||JSON.stringify(row).includes(`"${party}"`))&&(!query||JSON.stringify(row).toLocaleLowerCase('fi').includes(query.toLocaleLowerCase('fi'))));}
  function table(headers,data,render,caption=title(feature),values=[]){
    rows=filtered(data);
    return tables.render(headers,rows,render,caption,values);
  }
  const td=values=>'<tr>'+values.map(v=>`<td>${v??'—'}</td>`).join('')+'</tr>';
  const inspect=(a,b)=>`<button type="button" data-pair="${e(a)}" data-other="${e(b)}">${tr('Äänet','Röster','Ballots')}</button>`;
  const partyInspect=(a,b='')=>`<button type="button" data-party-a="${e(a)}" data-party-b="${e(b)}">${tr('Äänestykset','Omröstningar','Votes')}</button>`;
  function showEvidence(html,trigger){evidencePanel.open(()=>html,trigger);}
  async function showVote(file){const x=await loader.load(file);if(!current())return;return `<h4>${e(recordText(x.vote,'title'))}</h4><p>${e(x.vote.date)} · ${e(recordText(x.vote,'document'))}</p><p>${e(recordText(x.vote,'question'))}</p><a href="${e(x.vote.resultUrl)}" target="_blank" rel="noopener">${tr('Virallinen lähde','Officiell källa','Official source')}</a>${tables.render(['MP','Party','Choice'],x.ballots,b=>td([memberLink(b[1]),e(b[2]),e(l(b[3]))]),tr('Tallennetut äänet','Lagrade röster','Stored ballots'))}`;}
  async function showPair(a,b){
    const [left,right,index]=await Promise.all([loader.load(`ballots-${a}.json`),loader.load(`ballots-${b}.json`),loader.load('vote-index.json')]);if(!current())return;
    const active=manifest.scopes.find(s=>s.id===effectiveScope()),common=commonBallotEvidence(left,right,index,active),agree=common.filter(r=>r.agreement).length;
    const ballotTable=tables.render(['Date / Matter',memberName(a),memberName(b),'Source'],common,r=>td([e(r.date.slice(0,10))+' '+e(r.document),e(l(r.choiceA))+' · '+e(r.partyA),e(l(r.choiceB))+' · '+e(r.partyB),`<button type="button" data-vote-file="${e(r.file)}">${e(r.voteId)}</button>`]),tr('Kaikki yhteiset kelvolliset äänet','Alla gemensamma giltiga röster','All common eligible ballots'));
    return `<h4>${e(memberName(a))} / ${e(memberName(b))}</h4><p>${agree} / ${common.length} = ${percent(common.length?agree/common.length:null)} · ${e(scopeLabel(active))}</p><div data-ballot-list>${ballotTable}</div>`;
  }
  async function showPartyEvidence(a,b){

    const events=await loader.load('party-events.json'),index=await loader.load('vote-index.json');if(!current())return;
    const active=manifest.scopes.find(s=>s.id===effectiveScope()),voteFiles=new Map(index.map(v=>[v.id,v.file]));
    const selected=events.filter(row=>row.date.slice(0,10)>=active.from&&row.date.slice(0,10)<=active.to&&(!active.topic||row.topics.includes(active.topic))&&row.parties[a]&&(!b||(row.parties[a].modalChoice&&row.parties[b]?.modalChoice)));
    const same=b?selected.filter(row=>row.parties[a].modalChoice===row.parties[b].modalChoice).length:null;
    const partyCell=group=>e(l(group.modalChoice)||tr('Tasainen','Oavgjort','Tied'))+` · ${group.modalCount}/${group.eligible} · `+Object.entries(group.counts).map(([key,count])=>e(l(key))+': '+count).join(', ');
    return `<h4>${e(a.toUpperCase())}${b?' / '+e(b.toUpperCase()):''}</h4><p>${b?`${same} / ${selected.length} = ${percent(selected.length?same/selected.length:null)}`:tr('Moodin tuki ja tasaiset kannat ovat näkyvissä jokaisesta äänestyksestä.','Typvärdets stöd och oavgjorda positioner visas för varje omröstning.','Modal support and tied positions are shown for every event.')}</p>${tables.render(['Date / Matter',a.toUpperCase(),...(b?[b.toUpperCase()]:[]),'Source'],selected,row=>td([e(row.date.slice(0,10))+' '+e(row.document),partyCell(row.parties[a]),...(b?[partyCell(row.parties[b])]:[]),`<button type="button" data-vote-file="${e(voteFiles.get(row.id))}">${e(row.id)}</button>`]),tr('Kaikki tulokseen sisältyvät äänestykset','Alla ingående omröstningar','All contributing roll calls'))}`;
  }
  async function showSpeech(id,month,group){
    if(!month)throw Error('Speech date is missing from this evidence record.');
    const payload=await loader.load(`speeches-${month}.json`),speech=payload.speeches.find(s=>s.id===id);if(!speech)throw Error('Speech does not belong to the declared snapshot month.');if(!current())return;
    return `${speechPicker(group,id)}<h4>${e(memberName(speech.mpId))}</h4><p class="relationship-source-date"><time datetime="${e(speech.date)}">${e(sourceDate(speech.date))}</time></p><p>${e(recordText(speech,'agenda'))}</p><blockquote>${e(payload.texts[id])}</blockquote><p><a href="#/speeches/${encodeURIComponent(id)}">${tr('Avaa puheselaimessa (nykyinen aineisto)','Öppna i anförandevyn (aktuellt material)','Open speech browser (current collection)')}</a></p>`;
  }
  const speechButton=(record,label=tr('Puhe','Anförande','Speech'),group='',selected=false)=>`<button type="button" class="relationship-source-button" data-speech="${e(record.id||record.speechId)}" data-month="${e(String(record.date||'').slice(0,7))}"${group?` data-speech-group="${e(group)}" aria-pressed="${selected}"`:''} aria-label="${e(label+' · '+tr('Avaa lähdepuhe','Öppna källanförandet','Open source speech')+': '+memberName(record.mpId??record.speakerId)+' · '+String(record.date||'').slice(0,10))}">${e(label)}</button>`;
  const supporting=records=>{
    const sources=arr(records).slice(0,5);if(!sources.length)return '—';
    if(sources.length===1)return speechButton(sources[0]);
    const group=String(++nextSources);speechSources.set(group,sources);
    return `<button type="button" class="relationship-source-button" data-speech-sources="${group}">${tr('Puheet','Anföranden','Speeches')} (${sources.length})</button>`;
  };
  function speechPicker(group,id){
    const sources=speechSources.get(group);if(!sources)return '';
    return `<div class="relationship-source-picker" role="group" aria-label="${tr('Valitse lähdepuhe','Välj källanförande','Choose source speech')}"><span>${tr('Lähdepuheet','Källanföranden','Source speeches')}</span>${sources.map((record,index)=>speechButton(record,String(index+1),group,(record.id||record.speechId)===id)).join(' ')}</div>`;
  }
  function finish(content){
    result.removeAttribute('aria-busy');
    result.innerHTML=`<h2 id="network-result-heading">${e(title(feature))}</h2>${content}<div class="relationship-actions"><span>${tr('Lataa valitut rivit','Ladda ner valda rader','Download matching rows')}</span><button type="button" data-network-export="csv">CSV</button><button type="button" data-network-export="json">JSON</button></div>`;
    root.querySelector('[data-network-method]').textContent=JSON.stringify({method,coverage:currentData?.coverage,filters:{feature,mp:form.elements.mp.closest('label').hidden?undefined:mp,scope:effectiveScope(),party:canPartyFilter()?party:undefined,q:query,...analysisFilters},publicationGates:manifest.publicationGates},null,2);
    status.textContent=tr('Analyysi valmis.','Analysen är klar.','Analysis ready.');
  }
  function paintVotingNeighbours(data){
    tables.clear();
    const minimum=data.method?.minCommon??30,all=filtered(votingComparisonRows(data,mp,manifest.members)),low=all.filter(row=>row.lowSupport).length;
    const selected=orderVotingComparisons(all.filter(row=>showLowSupport||!row.lowSupport),comparisonDirection,lang),visible=selected.slice(0,neighbourLimit);
    const pair=selected.find(row=>row.neighbour===comparisonMp)||selected[0];comparisonMp=pair?.neighbour||'';
    analysisFilters={order:comparisonDirection,includeLowSupport:showLowSupport,minCommon:minimum,comparisonMp};
    const baseline=data.partyByMember?.[mp];
    const action=row=>`<button type="button" class="relationship-pair-action" data-pair="${e(mp)}" data-other="${e(row.neighbour)}" aria-label="${e(tr('Vertaa ääniä: ','Jämför röster: ','Compare ballots: ')+memberName(mp)+' / '+row.name)}">${tr('Äänet','Röster','Ballots')} <span aria-hidden="true">↗</span></button>`;
    const support=row=>`${number(row.agree)} / ${number(row.common)} ${tr('samaa ääntä','lika röster','matching ballots')}`;
    const comparison=pair?`<aside class="relationship-pair-card" aria-labelledby="relationship-pair-title"><h3 id="relationship-pair-title">${tr('Vertaa kahta edustajaa','Jämför två ledamöter','Compare two MPs')}</h3><p>${e(memberName(mp))}${baseline?` <span class="relationship-party">${e(baseline.toUpperCase())}</span>`:''}</p><label>${tr('Vertailuedustaja','Jämförelseledamot','Compare with')}<select data-compare-mp>${selected.map(row=>`<option value="${e(row.neighbour)}" ${row.neighbour===pair.neighbour?'selected':''}>${e(row.name)}${row.party?' · '+e(row.party.toUpperCase()):''}</option>`).join('')}</select></label><div class="relationship-donut" style="--agreement:${agreementWidth(pair.agreement)}%" role="img" aria-label="${e(support(pair)+', '+percent(pair.agreement))}"><strong aria-hidden="true">${percent(pair.agreement)}</strong></div><div class="relationship-pair-counts"><span><i aria-hidden="true"></i>${tr('Samoin','Lika','Same')} <strong>${number(pair.agree)}</strong></span><span><i aria-hidden="true"></i>${tr('Eri tavoin','Olika','Different')} <strong>${number(pair.common-pair.agree)}</strong></span></div>${pair.lowSupport?`<p class="relationship-low-support">${tr('Vähän näyttöä','Litet underlag','Low support')}: ${number(pair.common)} / ${minimum}</p>`:''}${action(pair)}<p class="relationship-caption">${tr('Avaa yhteiset äänestykset ja tarkista valinnat lähteistä.','Öppna gemensamma omröstningar och kontrollera valen i källorna.','Open the shared roll calls and check the choices against their sources.')}</p></aside>`:'';
    const fullTable=table(['MP','Agree / common','%','Yes/no %','Contested %','Matter %','Session %',tr('Lähde','Källa','Evidence')],selected,row=>td([relationshipLink(row.neighbour),`${row.agree} / ${row.common}${row.lowSupport?' · '+tr('Vähän näyttöä','Litet underlag','Low support'):''}`,percent(row.agreement),percent(row.yesNo?.agreement),percent(row.contested?.agreement),percent(row.matterWeighted?.agreement),percent(row.sessionWeighted?.agreement),inspect(mp,row.neighbour)]));
    finish(`<div class="relationship-result-context"><strong>${e(memberName(mp))}</strong>${baseline?`<span class="relationship-party">${e(baseline.toUpperCase())}</span>`:''}<span>${e(scopeLabel(manifest.scopes.find(item=>item.id===scope)))}</span></div><p class="relationship-caption">${tr('Prosentti kertoo, kuinka usein edustajat valitsivat samoin yhteisissä äänestyksissä. Mukana JAA, EI ja tyhjä; poissaolot ja puuttuvat äänet jäävät pois.','Procenten visar hur ofta ledamöterna valde lika i gemensamma omröstningar. JA, NEJ och blankt ingår; frånvaro och saknade röster utelämnas.','The percentage shows how often MPs made the same choice in shared roll calls. Yes, no and abstentions count; absence and missing ballots are excluded.')}</p><div class="relationship-vote-layout"><div class="relationship-neighbours"><div class="relationship-chart-toolbar"><label>${tr('Näytä ensin','Visa först','Show first')}<select data-neighbour-order><option value="desc"${comparisonDirection==='desc'?' selected':''}>${tr('Eniten samoin äänestäneet','Mest lika röster','Most alike')}</option><option value="asc"${comparisonDirection==='asc'?' selected':''}>${tr('Vähiten samoin äänestäneet','Minst lika röster','Least alike')}</option></select></label><span>${number(selected.length)} ${tr('vertailua','jämförelser','comparisons')} · 0–100 %</span></div><ul class="relationship-agreement-list" aria-label="${e(title(feature))}">${visible.map(row=>`<li><div class="relationship-neighbour-name">${relationshipLink(row.neighbour)}<small>${row.party?`<span class="relationship-party">${e(row.party.toUpperCase())}</span>`:tr('Puolue ei tiedossa','Parti okänt','Party unknown')}${row.lowSupport?` <span class="relationship-low-support">${tr('Vähän näyttöä','Litet underlag','Low support')}</span>`:''}</small></div><div class="relationship-agreement-value"><div><strong>${percent(row.agreement)}</strong><span>${support(row)}</span></div><span class="relationship-agreement-track" aria-hidden="true"><span style="width:${agreementWidth(row.agreement)}%"></span></span></div>${action(row)}</li>`).join('')||`<li class="relationship-empty">${tr('Ei vertailuja näillä rajauksilla. Kokeile toista hakua tai ota pienet aineistot mukaan.','Inga jämförelser med dessa filter. Prova en annan sökning eller inkludera små underlag.','No comparisons for these filters. Try another search or include small samples.')}</li>`}</ul>${visible.length<selected.length?`<button type="button" class="relationship-show-more" data-neighbours-more>${tr('Näytä seuraavat','Visa följande','Show next')} ${Math.min(12,selected.length-visible.length)} <span>(${visible.length} / ${selected.length})</span></button>`:''}<label class="relationship-support-toggle"><input type="checkbox" data-neighbour-low ${showLowSupport?'checked':''}>${tr('Näytä myös pienet aineistot','Visa även små underlag','Include small samples')} <span>(${low}; &lt; ${minimum} ${tr('yhteistä ääntä','gemensamma röster','shared ballots')})</span></label><p class="relationship-caption">${tr('Samat tarkat tulokset ovat tasatuloksia ja näkyvät aakkosjärjestyksessä. Näytetyt prosentit on pyöristetty.','Lika exakta resultat visas i alfabetisk ordning. Procenttalen är avrundade.','Equal underlying results are ties and appear alphabetically. Displayed percentages are rounded.')}</p></div>${comparison}</div><details class="relationship-detail-table"><summary>${tr('Kaikki mittarit taulukkona','Alla mått som tabell','All metrics as a table')}</summary><p class="relationship-caption">${tr('JAA/EI jättää tyhjät pois. Erimielisissä äänestyksissä vähintään 10 % poikkeaa enemmistöstä. Asia- ja istuntopainotus antaa jokaiselle asialle tai istunnolle saman painon.','JA/NEJ utelämnar blanka röster. I omstridda omröstningar avviker minst 10 % från flertalet. Ärende- och sessionsviktning ger varje ärende eller session samma vikt.','Yes/no excludes abstentions. In contested votes, at least 10% differ from the majority. Matter and session weighting give each matter or session equal weight.')}</p>${fullTable}</details>`);
    const repaint=focus=>{paintVotingNeighbours(data);persist();result.querySelector(focus)?.focus({preventScroll:true});};
    result.querySelector('[data-neighbour-order]').onchange=event=>{comparisonDirection=event.target.value;neighbourLimit=12;repaint('[data-neighbour-order]');};
    result.querySelector('[data-neighbour-low]').onchange=event=>{showLowSupport=event.target.checked;neighbourLimit=12;repaint('[data-neighbour-low]');};
    const compare=result.querySelector('[data-compare-mp]');if(compare)compare.onchange=event=>{comparisonMp=event.target.value;repaint('[data-compare-mp]');};
    const more=result.querySelector('[data-neighbours-more]');if(more)more.onclick=()=>{const previous=neighbourLimit;neighbourLimit+=12;paintVotingNeighbours(data);result.querySelectorAll('.relationship-agreement-list li')[previous]?.querySelector('a')?.focus({preventScroll:true});};
  }
  async function draw(){
    const ticket=++revision;status.textContent=tr('Ladataan valittu analyysi…','Vald analys laddas…','Loading the selected analysis…');evidencePanel.close({restoreFocus:false});speechSources.clear();pointEvidenceAction=null;
    result.setAttribute('aria-busy','true');result.querySelectorAll('button').forEach(button=>{button.disabled=true;});
    form.querySelector('[data-period-label]').hidden=!votingFeatures.has(feature);
    form.elements.mp.closest('label').hidden=['party-heatmap','emerging-phrases'].includes(feature);
    form.elements.party.closest('label').hidden=!partyFeatures.has(feature);
    form.elements.party.closest('label').firstChild.textContent=votingFeatures.has(feature)?tr('Puolue äänestysaineistossa','Parti i röstningsdata','Party in voting data'):tr('Aineiston puolue','Parti i materialet','Recorded party');
    root.querySelectorAll('[data-network-preset]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.networkPreset===feature)));
    const files={
      'vote-neighbours':scope+'-member-'+mp+'.json',
      'party-heatmap':scope+'-parties.json',
      'topic-profiles':'topics-member-'+mp+'.json',
      'emerging-phrases':'speech-emerging.json',
      'keyword-comparisons':'speech-keyword-comparisons.json'
    };
    const data=await loader.load(files[feature]);
    if(ticket!==revision||!current())return;
    currentData=data;method=data.method||data.analysis?.method||{};rows=[];analysisFilters={};
    tables.clear();
    if(feature==='vote-neighbours'){
      paintVotingNeighbours(data);
    } else if(feature==='party-heatmap'){
      const groups=arr(data.cohesion).map(r=>r.party).sort(),matrixRows=groups.filter(p=>(party==='all'||p===party)&&(!query||data.partyPairs.some(r=>(r.a===p||r.b===p)&&filtered([r]).length))),getPair=(a,b)=>data.partyPairs.find(p=>(p.a===a&&p.b===b)||(p.a===b&&p.b===a));
      const matrixData=matrixRows.map(p=>({party:p}));
      const matrix=tables.render(['Party',...groups.map(p=>p.toUpperCase())],matrixData,row=>`<tr><th scope="row">${e(row.party.toUpperCase())}</th>${groups.map(b=>{const p=getPair(row.party,b);return `<td>${row.party===b?'—':p&&filtered([p]).length?`<button type="button" data-party-a="${e(row.party)}" data-party-b="${e(b)}" style="--agreement:${agreementWidth(p.agreement)}%;background:color-mix(in srgb,var(--blue) ${Math.round(p.agreement*12)}%,var(--white))">${percent(p.agreement)}<small>${p.agree}/${p.common}${p.lowSupport?' · '+tr('Vähän näyttöä','Litet underlag','Low support'):''}</small></button>`:'—'}</td>`;}).join('')}</tr>`,tr('Puolueiden yhtenevyysmatriisi: prosentti ja sama / yhteinen','Partiernas samstämmighetsmatris: procent och lika / gemensamt','Party agreement matrix: percent and agree / common'),[r=>r.party,...groups.map(p=>r=>r.party===p?null:getPair(r.party,p)?.agreement)],{exportRows:false}).replace('class="relationship-table"','class="relationship-table relationship-matrix"');
      finish(`<p>${tr('Puolueen kanta on kelvollisten äänten yksikäsitteinen moodi. Tasaiset ja puuttuvat kannat ohitetaan. Kukin äänestys painaa yhtä paljon. Alle 30 yhteistä kantaa on vähän näyttöä.','Partiets position är det entydiga typvärdet bland giltiga röster. Oavgjorda och saknade positioner utelämnas. Färre än 30 gemensamma positioner ger litet underlag.','Party positions use unique modal eligible choices. Tied and missing positions are excluded. Each roll call has equal weight. Fewer than 30 common positions is low support.')}</p>${matrix}<details><summary>${tr('Parien haettava taulukko','Sökbar tabell över par','Searchable pair table')}</summary>${table(['Party A','Party B','Agree / common','%',tr('Lähteet','Källor','Evidence')],arr(data.partyPairs),r=>td([e(r.a),e(r.b),`${r.agree} / ${r.common}`,percent(r.agreement),partyInspect(r.a,r.b)]))}</details><h3>${tr('Puolueiden sisäinen yhtenäisyys','Sammanhållning inom partierna','Within-party cohesion')}</h3>${table(['Party','Votes','Equal-event modal support','Ballot-weighted modal support','Evidence'],arr(data.cohesion),r=>td([e(r.party),number(r.votes),percent(r.meanModalSupport),percent(r.modalSupport),partyInspect(r.party)]),'Cohesion')}`);
      // Export both numeric equivalents, without losing the heatmap rows to the second table.
      rows=[...filtered(arr(data.partyPairs)).map(r=>({...r,table:'party-agreement'})),...filtered(arr(data.cohesion)).map(r=>({...r,table:'cohesion'}))];
    } else if(feature==='topic-profiles'){
      paintTopics(data);
    } else if(feature==='emerging-phrases'){
      paintEmerging(data);
    } else {
      await paintSpeech(data,ticket);
    }
  }
  function paintTopics(data){
    const profile=data.results;
    const speechCount=count=>`${number(count)} ${tr('puhetta','anföranden','speeches')}`;
    const fallbackTopics=arr(profile?.topics);
    const unclassified=profile?.unclassifiedSpeeches??fallbackTopics.find(row=>row.topic==='other')?.speeches??0;
    const topics=filtered(arr(profile?.detailedTopics??fallbackTopics).filter(row=>row.topic!=='other').map(row=>({
      ...row,label:detailedAgendaTopicLabel(row.topic,lang)||policyTopicLabel(row.topic,lang)
    })));
    const agendas=filtered(arr(profile?.agendas).map(row=>({
      ...row,label:lang==='sv'&&row.titleSv?row.titleSv:row.title
    })));
    const agendaHeading=tr('Eduskunnan keskusteluotsikot','Riksdagens debattrubriker','Parliamentary debate titles');
    const empty=tr('Ei aiheita näillä rajauksilla.','Inga ämnen med dessa filter.','No topics for these filters.');
    const topicList=topics.slice(0,8).map(row=>`
      <li>
        <div class="relationship-neighbour-name"><strong>${e(row.label)}</strong><small>${speechCount(row.speeches)}</small></div>
        <div class="relationship-agreement-value"><strong>${percent(row.withinMpShare)}</strong><span class="relationship-agreement-track" aria-hidden="true"><span style="width:${agreementWidth(row.withinMpShare)}%"></span></span></div>
        ${supporting(row.evidence)}
      </li>`).join('');
    const agendaList=agendas.slice(0,5).map(row=>`
      <li>
        <div class="relationship-neighbour-name"><strong>${e(row.label)}</strong><small>${speechCount(row.speeches)}</small></div>
        ${supporting(row.evidence)}
      </li>`).join('');
    const topicTable=table(['Topic','Speeches','Share of MP speeches','Share of topic speeches','Share of MP words','Evidence'],topics,row=>td([
      e(row.label),number(row.speeches),percent(row.withinMpShare),percent(row.topicParticipationShare),percent(row.withinMpWordShare),supporting(row.evidence)
    ]));
    const agendaTable=profile?.agendas?table(['Topic','Speeches','Evidence'],agendas,row=>td([
      e(row.label),number(row.speeches),supporting(row.evidence)
    ]),agendaHeading):'';
    const matterTable=table(['Matter','Speeches','Share of MP speeches'],arr(profile?.matters),row=>td([
      `<a href="${e(row.url)}" target="_blank" rel="noopener">${e(row.matterId)}</a>`,number(row.speeches),percent(row.withinMpShare)
    ]));
    method={...method,topicClassification:'Detailed Finnish and Swedish agenda-title matches, with broad metadata categories as fallback; multiple topics allowed',agendaGrouping:'Exact archived agenda title, ignoring case and whitespace'};
    finish(`
      <div class="relationship-topic-summary">
        <div><strong>${e(memberName(mp))}</strong><span>${speechCount(profile?.speeches)} · ${number(profile?.words)} ${tr('sanaa','ord','words')}</span></div>
        <span>${e(profile?.start||'—')} – ${e(profile?.end||'—')}</span>
      </div>
      <div class="relationship-topic-sections">
        <section>
          <h3>${tr('Yleisimmät aihepiirit','Vanligaste ämnesområdena','Most frequent topics')}</h3>
          <p class="relationship-caption">${tr('Aihepiirit perustuvat keskusteluotsikoihin. Osuus lasketaan edustajan kaikista puheenvuoroista, ja puhe voi kuulua useaan aihepiiriin.','Ämnesområdena bygger på debattrubrikerna. Andelen beräknas av ledamotens alla anföranden, och ett anförande kan ha flera ämnesområden.','Topics use the debate titles. Shares are based on all the MP’s speeches, and a speech can appear in multiple topics.')}</p>
          <ul class="relationship-agreement-list relationship-topic-chart">${topicList||`<li class="relationship-empty">${empty}</li>`}</ul>
          ${unclassified?`<p class="relationship-caption">${tr('Ilman aihepiiriä','Utan ämnesområde','Without a topic label')} · ${speechCount(unclassified)}. ${tr('Voit silti selata niiden keskusteluotsikoita.','Du kan ändå bläddra bland deras debattrubriker.','You can still browse their debate titles.')}</p>`:''}
        </section>
        ${profile?.agendas?`<section>
          <h3>${agendaHeading}</h3>
          <p class="relationship-caption">${tr('Otsikot näyttävät konkreettiset asiat, joiden käsittelyssä edustaja puhui. Avaamalla lähdepuheen näet, mitä hän sanoi.','Rubrikerna visar vilka konkreta ärenden ledamoten talade om. Öppna källanförandet för att se vad ledamoten sade.','The titles show the specific items under debate. Open a source speech to read what the MP said.')}</p>
          <ul class="relationship-agreement-list relationship-agendas">${agendaList||`<li class="relationship-empty">${empty}</li>`}</ul>
        </section>`:''}
      </div>
      <details class="relationship-detail-table">
        <summary>${tr('Kaikki aiheet, otsikot ja mittarit','Alla ämnen, rubriker och mått','All topics, debate titles and metrics')}</summary>
        ${topicTable}${agendaTable}
        <h3>${tr('Valtiopäiväasiat','Riksdagsärenden','Parliamentary matters')}</h3>
        ${matterTable}
      </details>`);
  }
  function paintEmerging(data){
    const result=data.results;method={...data.method,...result.method,windows:result.windows};
    finish(`<p>${tr('Etsivä analyysi yhden ja kahden sanan ilmauksista. Ei merkitsevyystestiä eikä kielten yhdistämistä; taivutusmuodot erillisiä. Vähintään 5 esiintymää, 3 puhujaa ja 2 puoluetta yhdessä ikkunassa; heikko vertailupuoli merkitty.','Explorativ analys av ett- och tvåordsuttryck. Inga signifikanstester eller sammanslagningar av språk; böjningsformer behandlas separat. Minst 5 förekomster, 3 talare och 2 partier i ett fönster.','Exploratory one- and two-word candidates. No significance test, lemmatization or cross-language merging. At least 5 occurrences, 3 speakers and 2 parties in one window; weak comparison support is labelled.')}</p><p>${e(result.windows?.baseline?.start)} – ${e(result.windows?.baseline?.end)} → ${e(result.windows?.recent?.start)} – ${e(result.windows?.recent?.end)}. ${tr('Katso aineiston aukot menetelmästä.','Se luckor i metodbeskrivningen.','See method details for corpus gaps.')}</p>${table(['Phrase','Direction','Baseline count / rate','Recent count / rate','Recent speakers / parties','Support','Evidence'],arr(result.rows),r=>td([e(r.query),e(l(r.direction)),number(r.baseline.count)+' / '+number(r.baseline.per10000Words),number(r.recent.count)+' / '+number(r.recent.per10000Words),r.recent.distinctSpeakers+' / '+r.recent.partyBreadth,r.lowSupport?tr('Vähän näyttöä','Litet underlag','Low support'):'✓',supporting(r.recent.evidence.length?r.recent.evidence:r.baseline.evidence)]))}`);
  }
  async function paintSpeech(data,ticket){
    const options=arr(data.results);
    const loadPreset=option=>option?.file?loader.load(option.file):option;
    const selected=overrides.get(mp)||await loadPreset(options[presetIndex]);
    if(!current()||ticket!==revision)return;
    const presetGroups=new Map();
    options.forEach((option,index)=>{
      const group=option.topic||'';
      if(!presetGroups.has(group))presetGroups.set(group,[]);
      presetGroups.get(group).push(`<option value="${index}">${e(option.query)}</option>`);
    });
    const presetChoices=[...presetGroups].map(([topic,choices])=>topic
      ?`<optgroup label="${e(policyTopicLabel(topic,lang))}">${choices.join('')}</optgroup>`:choices.join('')).join('');
    const intro=tr('Valitse ilmaus ja katso, kuinka usein se esiintyy eri puolueiden puheissa.','Välj ett uttryck och se hur ofta det förekommer i partiernas anföranden.','Choose an expression to see how often it appears in speeches from different parties.');
    const monthOptions=manifest.speechMonths.map((month,index)=>
      `<option value="${e(month.month)}"${index===manifest.speechMonths.length-1?' selected':''}>${e(month.month)}</option>`).join('');
    const comparisonMembers=manifest.members.filter(member=>String(member.id)!==mp).map(member=>
      `<option value="${e(member.id)}">${e(memberName(member.id))}</option>`).join('');
    finish(`<div class="relationship-keyword-picker">
      <p>${intro}</p>
      <label>${tr('Valitse ilmaus','Välj uttryck','Choose an expression')}<select data-preset>${presetChoices}</select></label>
    </div>
    <details class="relationship-keyword-custom">
      <summary>${tr('Hae omaa ilmausta','Sök ett eget uttryck','Search for your own expression')}</summary>
      <p class="relationship-caption">${tr('Voit hakea 1–3 peräkkäiseltä kuukaudelta.','Du kan söka inom 1–3 månader i följd.','Search across 1–3 consecutive months.')}</p>
      <form class="relationship-controls" data-custom-speech>
        <label>${tr('Ilmaus','Uttryck','Expression')}<input name="query" required></label>
        <label>${tr('Poissulje','Uteslut','Exclude')}<input name="exclude"></label>
        <label>${tr('Hakutapa','Matchning','Match mode')}<select name="mode">
          <option value="contains">${tr('Sisältää','Innehåller','Contains')}</option>
          <option value="word">${tr('Kokonainen sana','Helt ord','Whole word')}</option>
          <option value="phrase">${tr('Ilmaus','Fras','Phrase')}</option>
        </select></label>
        <label>${tr('Hakualue','Sökområde','Search scope')}<select name="scope">
          <option value="text">${tr('Puheen teksti','Anförandetext','Transcript text')}</option>
          <option value="all">${tr('Teksti ja metadata','Text och metadata','Text and metadata')}</option>
        </select></label>
        <label>${tr('Aihe','Ämne','Topic')}<select name="topic">
          <option value="all">${tr('Kaikki','Alla','All')}</option>
          ${policyTopicOptions(lang).map(topic=>`<option value="${e(topic.key)}">${e(topic.label)}</option>`).join('')}
        </select></label>
        <label>${tr('Ensimmäinen kuukausi','Första månad','First month')}<select name="start">${monthOptions}</select></label>
        <label>${tr('Viimeinen kuukausi','Sista månad','Last month')}<select name="end">${monthOptions}</select></label>
        <label>${tr('Vertailuryhmä','Jämförelsegrupp','Comparison groups')}<select name="groups">
          <option value="parties">${tr('Puolueet','Partier','Parties')}</option>
          <option value="mp">${tr('Valittu edustaja ja kaikki puhujat','Vald ledamot och alla talare','Selected MP and all speakers')}</option>
        </select></label>
        <label>${tr('Vertaa kohteeseen','Jämför med','Compare with')}<select name="compareMp">
          <option value="all">${tr('Kaikki puhujat','Alla talare','All speakers')}</option>
          ${comparisonMembers}
        </select></label>
        <button>${tr('Laske valittu aineisto','Beräkna valt material','Calculate selected corpus')}</button>
      </form>
    </details>
    <div data-speech-results></div>`);
    const paint=value=>{
      tables.clear();
      speechSources.clear();
      pointEvidenceAction=null;
      const presetControl=result.querySelector('[data-preset]');
      presetControl.querySelector('[value="custom"]')?.remove();
      const isCustom=overrides.get(mp)===value;
      if(isCustom){const custom=document.createElement('option');custom.value='custom';custom.textContent=tr('Oma haku: ','Egen sökning: ','Custom query: ')+value.query;presetControl.append(custom);presetControl.value='custom';}
      method=value.method;analysisFilters={query:value.query,mode:value.mode,scope:value.scope||'text',...value.settings,corpusStart:value.corpusStart,corpusEnd:value.corpusEnd};form.elements.party.closest('label').hidden=!canPartyFilter();
      const holder=result.querySelector('[data-speech-results]');
      const points=value.series.flatMap(series=>series.points.map(point=>({
        ...point,series:series.label,group:series.id,party:series.settings?.party
      })));
      const visible=filtered(points);
      const groups=value.series.map(series=>{
        const months=visible.filter(point=>point.group===series.id);
        const mentions=months.reduce((sum,point)=>sum+point.occurrences,0);
        const words=months.reduce((sum,point)=>sum+point.words,0);
        const matches=months.reduce((sum,point)=>sum+point.matchingSpeeches,0);
        return {id:series.id,label:l(series.label),months,calendar:series.points.map(point=>point.month),mentions,words,matches,rate:words?mentions/words*10000:null};
      }).filter(group=>group.months.length);
      const ceiling=Math.max(1,...groups.map(group=>group.rate||0));
      const bar=(rate,max)=>rate==null?0:rate/max*100;
      const summary=groups.map(group=>`<li>
        <span class="relationship-keyword-group"><strong>${e(group.label)}</strong><small>${number(group.mentions,0)} ${tr('mainintaa','omnämnanden','mentions')} · ${number(group.matches,0)} ${tr('osuvaa puhetta','matchande anföranden','matching speeches')}</small></span>
        <span class="relationship-agreement-track" aria-hidden="true"><span style="width:${bar(group.rate,ceiling)}%"></span></span>
        <strong class="relationship-keyword-rate">${number(group.rate,1)}</strong>
      </li>`).join('');
      const trendTitle=tr('Kuukausittainen kehitys','Utveckling per månad','Monthly trend');
      const tableTitle=tr('Kaikki kuukausiluvut ja lähdepuheet','Alla månadsuppgifter och källanföranden','All monthly figures and source speeches');
      const monthlyTable=table(['Group','Month','Mentions','Words','Per 10,000','Matching speeches / corpus','Prevalence','Speakers','Coverage','Evidence'],points,r=>td([e(l(r.series)),e(r.month),r.occurrences,number(r.words),number(r.per10000Words),r.matchingSpeeches+' / '+r.speeches,percent(r.speechPrevalence),r.distinctSpeakers,r.coverageGap?tr('Aukko','Lucka','Gap'):r.partialMonth?tr('Vajaa kuukausi','Ofullständig månad','Partial month'):'✓',r.occurrences>0?`<button type="button" data-point="${e(r.group)}" data-month-point="${e(r.month)}">${tr('Puheet','Anföranden','Speeches')}</button>`:'—']));
      const corpusPeriod=visible.length
        ?`${visible.reduce((earliest,point)=>point.month<earliest?point.month:earliest,visible[0].month)} – ${visible.reduce((latest,point)=>point.month>latest?point.month:latest,visible[0].month)}`
        :'';
      holder.innerHTML=`<section class="relationship-keyword-summary" aria-labelledby="keyword-result-title">
        <h3 id="keyword-result-title">“${e(value.query)}” <span>${e(corpusPeriod)}</span></h3>
        <p class="relationship-caption">${tr('Mainintoja 10 000 sanaa kohti. Näin erikokoisia puheaineistoja voi verrata.','Omnämnanden per 10 000 ord gör grupper med olika mycket tal jämförbara.','Mentions per 10,000 words lets you compare groups with different amounts of speech.')}</p>
        ${summary?`<ul class="relationship-keyword-rates">${summary}</ul>`:`<p>${tr('Ei tuloksia näillä rajauksilla.','Inga resultat med dessa filter.','No results for these filters.')}</p>`}
        <p class="relationship-caption">${tr('Haku:','Sökning:','Match mode:')} ${e(l(value.mode))}. ${tr('Yksi puhe voi sisältää useita mainintoja.','Ett anförande kan innehålla flera omnämnanden.','One speech can contain several mentions.')}</p>
      </section>${groups.length?`<details class="relationship-detail-table">
        <summary>${trendTitle}</summary>
        <label class="relationship-keyword-trend-group">${tr('Ryhmä','Grupp','Group')}<select data-keyword-trend>${groups.map((group,index)=>`<option value="${index}">${e(group.label)}</option>`).join('')}</select></label>
        <div data-keyword-timeline></div>
      </details>`:''}<details class="relationship-detail-table"><summary>${tableTitle}</summary>${monthlyTable}</details>`;
      const trend=holder.querySelector('[data-keyword-trend]');
      if(trend){
        const timeline=holder.querySelector('[data-keyword-timeline]');
        const locale=lang==='sv'?'sv-FI':lang==='en'?'en-GB':'fi-FI';
        const longDate=new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'});
        const shortDate=new Intl.DateTimeFormat(locale,{month:'short',year:'numeric',timeZone:'UTC'});
        const monthDate=month=>new Date(month+'-01T00:00:00Z');
        const rateUnit=tr('mainintaa 10 000 sanaa kohti','omnämnanden per 10 000 ord','mentions per 10,000 words');
        const describeMonth=point=>{
          const rate=point.coverageGap
            ? tr('Ei puheita tässä ryhmässä','Inga anföranden i gruppen','No speeches in this group')
            : point.per10000Words==null
              ? tr('Ei puhetekstiä','Ingen anförandetext','No transcript words')
              : `${number(point.per10000Words)} ${rateUnit} · ${number(point.occurrences,0)} ${tr('mainintaa','omnämnanden','mentions')} / ${number(point.words,0)} ${tr('sanaa','ord','words')}`;
          const coverage=point.partialMonth?` · ${tr('Vajaa kuukausi','Ofullständig månad','Partial month')}`:'';
          return `${longDate.format(monthDate(point.month))} · ${rate}${coverage}`;
        };
        const paintTrend=()=>{
          const {months,calendar}=groups[Number(trend.value)];
          const firstMonth=months[0].month,lastMonth=months.at(-1).month;
          const dates=calendar.slice(calendar.indexOf(firstMonth),calendar.indexOf(lastMonth)+1);
          const pointsByMonth=new Map(months.map(point=>[point.month,point]));
          const priorMonth=timeline.querySelector('[data-keyword-month]')?.value;
          const max=Math.max(1,...months.map(point=>point.per10000Words||0));
          const ticks=(density,limit)=>{
            const count=Math.min(dates.length,limit);
            return `<div class="relationship-keyword-axis relationship-keyword-axis-${density}">${Array.from({length:count},(_,i)=>{
              const index=count===1?0:Math.round(i*(dates.length-1)/(count-1)),month=dates[index];
              const offset=i===0?0:i===count-1?100:(index+.5)/dates.length*100;
              return `<time datetime="${e(month)}" style="inset-inline-start:${offset}%">${e(shortDate.format(monthDate(month)))}</time>`;
            }).join('')}</div>`;
          };
          timeline.innerHTML=`<p class="relationship-caption">0–${number(max)} / 10 000 · ${tr('Katkoviiva: ei tekstiaineistoa. Viivoitus: vajaa kuukausi.','Streckad linje: textunderlag saknas. Skraffering: ofullständig månad.','Dashed line: no transcript data. Hatching: partial month.')}
            ${dates.length>months.length?tr('Tyhjät kohdat on suodatettu pois.','Tomma platser har filtrerats bort.','Blank positions are filtered out.'):''}</p>
            <div class="relationship-keyword-plot" aria-hidden="true">
              <div class="relationship-keyword-timeline">${dates.map(month=>{
                const point=pointsByMonth.get(month);
                if(!point)return '<span class="relationship-keyword-slot"></span>';
                const missing=point.per10000Words==null;
                return `<span class="relationship-keyword-slot" data-keyword-slot="${e(month)}" title="${e(describeMonth(point))}"><span class="relationship-bar${point.partialMonth?' relationship-bar-partial':''}${missing?' relationship-bar-gap':''}" style="height:${bar(point.per10000Words,max)}%"></span></span>`;
              }).join('')}</div>
              ${ticks('compact',3)}${ticks('medium',5)}${ticks('wide',7)}
            </div>
            <label class="relationship-keyword-trend-group relationship-keyword-month">${tr('Tarkastele kuukautta','Granska månad','Inspect a month')}<select data-keyword-month>${months.map(point=>`<option value="${e(point.month)}">${e(longDate.format(monthDate(point.month)))}</option>`).join('')}</select></label>
            <p class="relationship-keyword-month-detail" data-keyword-month-detail role="status"></p>`;
          const monthPicker=timeline.querySelector('[data-keyword-month]');
          const detail=timeline.querySelector('[data-keyword-month-detail]');
          let selectedSlot;
          const inspectMonth=()=>{
            const point=pointsByMonth.get(monthPicker.value);
            selectedSlot?.classList.remove('is-selected');
            selectedSlot=timeline.querySelector(`[data-keyword-slot="${point.month}"]`);
            selectedSlot.classList.add('is-selected');
            detail.textContent=describeMonth(point);
          };
          monthPicker.value=pointsByMonth.has(priorMonth)?priorMonth:lastMonth;
          monthPicker.onchange=inspectMonth;
          timeline.querySelector('.relationship-keyword-timeline').onclick=event=>{
            const slot=event.target.closest('[data-keyword-slot]');
            if(slot){monthPicker.value=slot.dataset.keywordSlot;inspectMonth();}
          };
          inspectMonth();
        };
        trend.onchange=paintTrend;
        paintTrend();
      }
      holder.onclick=event=>{
        const button=event.target.closest('[data-point]');if(!button||button.disabled)return;
        const point=points.find(p=>p.group===button.dataset.point&&p.month===button.dataset.monthPoint),series=value.series.find(s=>s.id===button.dataset.point);
        pointEvidenceAction=async()=>{
          const chunk=await loader.load(`speeches-${point.month}.json`);await loader.verifyCode();
          const {filterResearchSpeeches,matchRanges}=await import(`./data/networks/${manifest.id}/speech-research.js`),{filterSpeechesBySpeaker}=await import(`./data/networks/${manifest.id}/app-utils.js`);
          const supported=filterResearchSpeeches(filterSpeechesBySpeaker(chunk.speeches,{...value.settings,...series.settings}),chunk.texts,{...value.settings,query:value.query,mode:value.mode,scope:value.scope}).filter(s=>matchRanges(chunk.texts[s.id]||'',value.query,value.mode).length);
          return tables.render(['Speaker','Date','Evidence'],supported,r=>td([e(memberName(r.mpId)),e(r.date),speechButton(r)]),'Matching speeches');
        };
        showEvidence(`<p>${e(value.query)} · ${e(point.month)} · ${e(l(series.label))} · ${point.occurrences} / ${point.words} × 10000 = ${number(point.per10000Words)}</p><p>${supporting(point.evidence)}</p><button type="button" data-point-all>${tr('Avaa kaikki osuvat puheet tästä kuukaudesta','Öppna alla matchande anföranden i månaden','Open all matching speeches in this month')}</button>`,button);
      };
      root.querySelector('[data-network-method]').textContent=JSON.stringify({method:value.method,settings:value.settings,coverage:value.coverage,manifestId:manifest.id},null,2);
    };
    const customForm=result.querySelector('[data-custom-speech]');
    const toggleComparator=()=>{
      const enabled=customForm.elements.groups.value==='mp';
      const comparator=customForm.elements.compareMp;
      comparator.disabled=!enabled;
      comparator.closest('label').hidden=!enabled;
    };
    customForm.elements.groups.onchange=toggleComparator;
    toggleComparator();
    result.querySelector('[data-preset]').value=String(presetIndex);
    if(selected)paint(selected);
    result.querySelector('[data-preset]').onchange=event=>{
      if(event.target.value==='custom')return;
      const index=Number(event.target.value),request=++revision;
      guard(async()=>{
        status.textContent=tr('Ladataan ilmausta…','Uttrycket laddas…','Loading expression…');
        const value=await loadPreset(options[index]);
        if(!current()||request!==revision||!value)return;
        overrides.delete(mp);
        presetIndex=index;
        paint(value);
        status.textContent=tr('Analyysi valmis.','Analysen är klar.','Analysis ready.');
      });
    };
    customForm.onsubmit=event=>{event.preventDefault();guard(async()=>{
      const requestedMp=mp,requestRevision=++revision,settings=Object.fromEntries(new FormData(event.currentTarget)),months=manifest.speechMonths.filter(m=>m.month>=settings.start&&m.month<=settings.end);
      const monthIndex=month=>Number(month.slice(0,4))*12+Number(month.slice(5));
      if(!months.length||monthIndex(settings.end)-monthIndex(settings.start)>2)throw Error(tr('Valitse 1–3 peräkkäistä kuukautta.','Välj 1–3 på varandra följande månader.','Select 1–3 consecutive months.'));
      status.textContent=tr('Ladataan valitut kuukaudet ja lasketaan työprosessissa…','Valda månader laddas och beräknas i bakgrunden…','Loading selected months and calculating in a worker…');
      const payloads=await Promise.all(months.map(m=>loader.load(m.file))),speeches=payloads.flatMap(p=>p.speeches),texts=Object.assign({},...payloads.map(p=>p.texts));
      if(!current()||requestRevision!==revision)return;
      settings.dateFrom=settings.start+'-01';settings.dateTo=new Date(Date.UTC(Number(settings.end.slice(0,4)),Number(settings.end.slice(5,7)),0)).toISOString().slice(0,10);
      settings.coverageStart=manifest.coverage.from;settings.coverageEnd=manifest.coverage.to;settings.groups=settings.groups==='mp'?[{id:requestedMp,mpId:requestedMp,label:memberName(requestedMp)},settings.compareMp==='all'?{id:'all',label:l('All')}:{id:settings.compareMp,mpId:settings.compareMp,label:memberName(settings.compareMp)}]:parties.map(p=>({id:p,party:p,label:p.toUpperCase()}));
      const calculated=await runWorker({kind:'keyword-comparisons',speeches,texts,settings});if(!current()||requestRevision!==revision)return;overrides.set(requestedMp,calculated);paint(calculated);status.textContent=tr('Analyysi valmis.','Analysen är klar.','Analysis ready.');
    });};
  }
  async function runWorker(data){const id=await loader.verifyCode();return new Promise((resolve,reject)=>{const worker=new Worker(new URL(`./data/networks/${id}/network-worker.js`,import.meta.url),{type:'module'});worker.onmessage=({data})=>{worker.terminate();data.error?reject(Error(data.error)):resolve(data.result);};worker.onerror=event=>{worker.terminate();reject(Error(event.message));};worker.postMessage(data);});}
  async function guard(action){
    let owner=revision;
    try{const pending=action();owner=revision;await pending;}
    catch(error){
      if(!current()||owner!==revision)return;
      if(result.getAttribute('aria-busy')==='true'){result.replaceChildren();result.removeAttribute('aria-busy');}
      status.textContent=tr('Analyysi ei ole saatavilla: ','Analysen är inte tillgänglig: ','Analysis unavailable: ')+error.message;
    }
  }
  form.onsubmit=event=>event.preventDefault();
  form.onchange=event=>{if(event.target.name==='q')return;const values=Object.fromEntries(new FormData(form));({mp,party}=values);scope=values.period;neighbourLimit=12;persist();guard(draw);};
  let timer;form.elements.q.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{
    if(!current()||!form.isConnected)return;
    query=form.elements.q.value;persist();guard(draw);
  },180);};
  root.onclick=event=>{
    const preset=event.target.closest('[data-network-preset]');if(preset){if(feature!==preset.dataset.networkPreset){feature=preset.dataset.networkPreset;neighbourLimit=12;persist();guard(draw);}return;}
    if(result.getAttribute('aria-busy')==='true')return;
    if(tables.handleClick(event))return;
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.networkExport){const selected=tables.rows(result);downloadRelationships(relationshipExport(selected.length?selected:rows,{manifestId:manifest.id,feature,filters:{mp:form.elements.mp.closest('label').hidden?undefined:mp,scope:effectiveScope(),party:canPartyFilter()?party:undefined,q:query,...analysisFilters,tableSort:tables.settings()},method}),button.dataset.networkExport,`relationships-${feature}`);}
    else if(button.dataset.pair)evidencePanel.open(()=>showPair(button.dataset.pair,button.dataset.other),button);
    else if(button.dataset.voteFile)evidencePanel.open(()=>showVote(button.dataset.voteFile),button);
    else if(button.dataset.voteId)evidencePanel.open(async()=>{const index=await loader.load('vote-index.json');const vote=index.find(r=>r.id===button.dataset.voteId);if(vote)return showVote(vote.file);},button);
    else if(button.dataset.partyA)evidencePanel.open(()=>showPartyEvidence(button.dataset.partyA,button.dataset.partyB),button);
    else if(button.dataset.speechSources){const group=button.dataset.speechSources,record=speechSources.get(group)?.[0];if(record)evidencePanel.open(()=>showSpeech(record.id||record.speechId,String(record.date||'').slice(0,7),group),button);}
    else if(button.dataset.speech)evidencePanel.open(()=>showSpeech(button.dataset.speech,button.dataset.month,button.dataset.speechGroup),button);
    else if(button.hasAttribute('data-point-all')&&pointEvidenceAction)evidencePanel.open(pointEvidenceAction,button);
  };
  if(requestedFeature!==feature)persist();
  await guard(draw);
}
