import { escapeHTML as e, normalizeSpeechSearchText } from './app-utils.js';
import { concordance, matchRanges, researchSummary } from './speech-research.js';
import { exportButtons, bindExportButtons } from './data-tools.js';

export function mountResearchControls(root, settings, onChange) {
  const L=(fi,sv)=>settings.lang==='sv'?sv:fi;
  const controls=document.createElement('section');
  controls.className='research-controls';
  controls.setAttribute('aria-label',L('Puheiden tutkimustyökalut','Forskningsverktyg för anföranden'));
  controls.innerHTML='<div class="research-fields"><label class="filter-control"><span>'+L('Hakutapa','Söksätt')+'</span><select data-speech-match><option value="contains">'+L('Sisältää (myös sanan osa)','Innehåller (även del av ord)')+'</option><option value="word">'+L('Kokonainen sana','Helt ord')+'</option><option value="phrase">'+L('Tarkka ilmaus','Exakt fras')+'</option></select></label>'
    +'<label class="filter-control"><span>'+L('Hae kentistä','Sök i fält')+'</span><select data-speech-scope><option value="all">'+L('Puhe ja taustatiedot','Anförande och metadata')+'</option><option value="text">'+L('Vain puheteksti','Endast anförandetext')+'</option></select></label>'
    +'<label class="filter-control"><span>'+L('Sulje pois sana / ilmaus puhetekstistä','Uteslut ord / fras ur anförandetext')+'</span><input type="search" data-speech-exclude value="'+e(settings.exclude)+'"></label></div>'
    +'<p class="research-note">'+L('Haku ei erottele kirjainkokoa tai välimerkkejä. Tarkka ilmaus hakee peräkkäiset kokonaiset sanat. Kokeile sanan osaa, kun haluat mukaan taivutusmuotoja. Avaa lisärajaukset valitaksesi päivämäärät, puhetyypit ja vuodet.','Sökningen bortser från versaler och skiljetecken. Exakt fras söker hela ord i följd. Använd en orddel för böjningsformer. Öppna fler avgränsningar för datum, anförandetyper och år.')+'</p>'
    +'<a data-research-link href="#/speeches">'+L('Linkki tähän hakuun','Länk till denna sökning')+'</a>';
  root.querySelector('.speech-filters').after(controls);
  for(const key of ['match','scope']) {
    const field=controls.querySelector('[data-speech-'+key+']');
    field.value=settings[key==='match'?'mode':key];
    field.onchange=()=>{settings[key==='match'?'mode':key]=field.value;onChange();};
  }
  controls.querySelector('[data-speech-exclude]').oninput=event=>{settings.exclude=event.target.value;onChange();};
  const summary=document.createElement('section');summary.className='research-summary';summary.dataset.researchSummary='';
  root.querySelector('.speech-analytics').before(summary);
  return {
    update({corpus,filtered,texts,query,params,generatedAt}) {
      controls.querySelector('[data-research-link]').href='#/speeches/?'+params;
      if(!texts || !normalizeSpeechSearchText(query)) {summary.innerHTML='';return;}
      // Corpus uses the same speaker/topic/date/type filters and exclusion, before the positive query.
      const report=researchSummary(corpus,texts,query,settings.mode);
      const matching=filtered.filter(s=>matchRanges(texts[s.id],query,settings.mode).length);
      const months=report.months;
      summary.innerHTML='<div class="section-head"><h2>'+L('Hakutulokset tutkimukseen','Sökresultat för forskning')+'</h2>'+exportButtons('speech-months',settings.lang)+'</div>'
        +'<div class="research-stats"><div><strong>'+matching.length.toLocaleString(settings.lang)+'</strong><span>'+L('osumapuhetta /','träffande anföranden /')+' '+corpus.length.toLocaleString(settings.lang)+'</span></div><div><strong>'+matching.reduce((n,s)=>n+matchRanges(texts[s.id],query,settings.mode).length,0).toLocaleString(settings.lang)+'</strong><span>'+L('esiintymää tulospuheissa','förekomster i resultatanföranden')+'</span></div><div><strong>'+report.per10000Words.toLocaleString(settings.lang,{maximumFractionDigits:2})+'</strong><span>'+L('esiintymää / 10 000 sanaa','förekomster / 10 000 ord')+'</span></div></div>'
        +'<p class="research-note">'+L('Luvut koskevat vain puhetekstiä. Vertailuaineisto käyttää samoja rajauksia ja poissulkua ennen hakusanaa. Esiintymät eivät ole päällekkäisiä. Taustatietoihin osuneet tulokset voivat näkyä listassa ilman tekstiosumaa.','Siffrorna gäller endast anförandetext. Jämförelsematerialet använder samma avgränsningar och uteslutning före sökordet. Förekomster överlappar inte. Metadataträffar kan visas i listan utan textträff.')+'</p>'
        +'<details><summary>'+L('Kuukausittainen esiintymistiheys','Månatlig frekvens')+'</summary><div class="table-wrap"><table><caption>'+L('Samat rajaukset, ennen hakusanaa','Samma avgränsningar, före sökordet')+'</caption><thead><tr>'+[L('Kuukausi','Månad'),L('Puheita','Anföranden'),L('Osumapuheita','Träffande anföranden'),L('Esiintymät','Förekomster'),L('Sanoja','Ord'),L('/ 10 000 sanaa','/ 10 000 ord')].map(label=>'<th scope="col">'+label+'</th>').join('')+'</tr></thead><tbody>'+months.map(row=>'<tr><td>'+e(row.month)+'</td><td>'+row.speeches+'</td><td>'+row.matchingSpeeches+'</td><td>'+row.occurrences+'</td><td>'+row.words+'</td><td>'+row.per10000Words.toLocaleString(settings.lang,{maximumFractionDigits:2})+'</td></tr>').join('')+'</tbody></table></div></details>';
      bindExportButtons(summary,'speech-months',()=>months.map(row=>({...row,query,mode:settings.mode,scope:settings.scope,exclude:settings.exclude,generatedAt,filters:String(params)})),'vahtikissa-puheiden-kuukausitilasto');
    },
    annotate(items,texts,query) {
      if(!texts||!normalizeSpeechSearchText(query))return;
      root.querySelectorAll('[data-list] article.speech').forEach((article,index)=>{
        const speech=items[index];if(!speech)return;
        const contexts=concordance(texts[speech.id],query,settings.mode);
        if(!contexts.length)return;
        article.querySelector('h3').insertAdjacentHTML('afterend','<div class="concordance"><strong>'+L('Hakusana asiayhteydessä','Sökord i sitt sammanhang')+'</strong>'+contexts.map(c=>'<p>'+e(c.before)+'<mark>'+e(c.match)+'</mark>'+e(c.after)+'</p>').join('')+'<small>'+L('Normalisoitu hakuteksti: pienet kirjaimet, ei välimerkkejä. Enintään kolme osumaa.','Normaliserad söktext: gemener, inga skiljetecken. Högst tre träffar.')+'</small></div>');
      });
    }
  };
}
