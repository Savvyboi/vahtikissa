import { escapeHTML as e } from './app-utils.js';
import { relationshipLabel } from './relationship-labels.js';

const rawValues = {
  '%':r=>r.agreement, 'Yes/no %':r=>r.yesNo?.agreement, 'Contested %':r=>r.contested?.agreement,
  'Matter %':r=>r.matterWeighted?.agreement, 'Session %':r=>r.sessionWeighted?.agreement,
  'Agree / common':r=>r.common, 'Votes':r=>r.votes, 'Events':r=>r.events,
  'Equal-event modal support':r=>r.meanModalSupport, 'Ballot-weighted modal support':r=>r.modalSupport,
  'Group size':r=>r.availableGroupSizeMean, 'Alignment':r=>r.alignment,
  'Ballot weighted':r=>r.ballotWeightedAlignment, 'Matter weighted':r=>r.matterWeightedAlignment,
  'Shared body-days':r=>r.sharedDays, 'Size-corrected days':r=>r.weightedDays,
  'Score':r=>r.score, 'Sensitivity min':r=>r.min, 'Sensitivity max':r=>r.max,
  'Stable':r=>r.stable==null?null:Number(r.stable), 'Agreement':r=>r.weight??r.agreement,
  'Common':r=>r.common, 'Party changes':r=>r.partyChanged==null?null:Number(r.partyChanged),
  'Value':r=>r.value??(r.layer==='voting'?r.agreement:r.weightedDays),
  'Speeches':r=>r.speeches, 'Share of MP speeches':r=>r.withinMpShare,
  'Share of topic speeches':r=>r.topicParticipationShare, 'Share of MP words':r=>r.withinMpWordShare,
  'Baseline count / rate':r=>r.baseline.per10000Words, 'Recent count / rate':r=>r.recent.per10000Words,
  'Occurrences':r=>r.occurrences, 'Mentions':r=>r.occurrences, 'Words':r=>r.words,
  'Per 10,000':r=>r.per10000Words, 'Matching speeches / corpus':r=>r.matchingSpeeches,
  'Prevalence':r=>r.speechPrevalence, 'Speakers':r=>r.distinctSpeakers,
  'Quotation marker':r=>Number(r.quotationMarkerPresent)
};

export function tableSortValue(text) {
  const value=String(text ?? '').trim();
  if (!value || /^[—–−-]$/.test(value)) return null;
  // The first number also orders count/denominator cells and membership counts.
  const match=value.match(/^[+−-]?\d[\d\s\u00a0\u202f]*(?:[.,]\d+)?(?=\s*(?:%|\/|·|$))/u);
  return match ? Number(match[0].replace(/[\s\u00a0\u202f]/gu,'').replace(',','.').replace('−','-')) : value;
}

export function sortTableRows(rows, value, direction='asc', lang='fi') {
  const collator=new Intl.Collator(lang,{numeric:true,sensitivity:'base'});
  return [...rows].sort((a,b)=>{
    const av=value(a),bv=value(b),missing=x=>x==null||x===''||typeof x==='number'&&!Number.isFinite(x);
    if(missing(av))return missing(bv)?0:1;
    if(missing(bv))return -1;
    return (typeof av==='number'&&typeof bv==='number'?av-bv:collator.compare(String(av),String(bv)))*(direction==='desc'?-1:1);
  });
}

// Keep the entire filtered collection in the model: sorting precedes the display limit,
// and downloads use the same order and original, unrounded data.
export function createRelationshipTables({lang='fi',limit=300,onSort=()=>{}}={}) {
  const models=new Map(),orders=new Map();
  let next=0;
  const label=value=>relationshipLabel(value,lang);
  const action=()=>lang==='sv'?'Sortera efter':lang==='en'?'Sort by':'Järjestä sarakkeen mukaan';
  function ordered(model){
    const order=orders.get(model.key);
    return order?sortTableRows(model.entries,entry=>entry.values[order.column],order.direction,lang):model.entries;
  }
  function body(model){
    return ordered(model).slice(0,model.visible).map(entry=>entry.html).join('')||`<tr><td colspan="${model.headers.length}">${lang==='sv'?'Inga observationer med dessa avgränsningar.':lang==='en'?'No supported observations for these settings.':'Ei tuettuja havaintoja näillä rajauksilla.'}</td></tr>`;
  }
  function headers(model){
    const order=orders.get(model.key);
    return model.headers.map((header,column)=>{
      const selected=order?.column===column,direction=selected?order.direction:'none';
      const sortable=!['Evidence','Source','Lähde','Lähteet','Källa','Källor'].includes(header);
      return `<th scope="col"${sortable?` aria-sort="${direction==='asc'?'ascending':direction==='desc'?'descending':'none'}"`:''}>${sortable?`<button type="button" data-table-sort="${column}" aria-label="${e(action()+': '+label(header))}">${e(label(header))} <span aria-hidden="true">${selected?direction==='asc'?'↑':'↓':'↕'}</span></button>`:e(label(header))}</th>`;
    }).join('');
  }
  return {
    render(headersList,data,render,caption,values=[],{exportRows=true}={}) {
      const key=caption+'|'+headersList.join('|'),id=String(++next),template=document.createElement('template');
      template.innerHTML='<table><tbody>'+data.map(render).join('')+'</tbody></table>';
      const elements=[...template.content.querySelectorAll('tbody > tr')];
      const model={key,id,headers:headersList,caption,exportRows,visible:limit,entries:data.map((row,index)=>({row,html:elements[index].outerHTML,values:[...elements[index].cells].map((cell,column)=>{
        const value=values[column]||rawValues[headersList[column]];
        return value?value(row):tableSortValue(cell.textContent);
      })}))};
      models.set(id,model);
      return `<div class="relationship-scroll"><table class="relationship-table" data-sortable-table="${id}"><caption>${e(label(caption))} · ${data.length}</caption><thead><tr>${headers(model)}</tr></thead><tbody>${body(model)}</tbody></table></div>${data.length>limit?`<p>${lang==='sv'?`De första ${limit} raderna visas. Sortering och export omfattar alla valda rader.`:lang==='en'?`Showing the first ${limit} rows. Sorting and exports include all matching rows.`:`Näytetään aluksi ${limit} riviä. Järjestys ja vienti kattavat kaikki valitut rivit.`} <button type="button" data-table-more="${id}">${lang==='sv'?'Visa fler':lang==='en'?'Show more':'Näytä lisää'}</button></p>`:''}`;
    },
    handleClick(event) {
      const more=event.target.closest('[data-table-more]');
      if(more){const model=models.get(more.dataset.tableMore),table=more.closest('.relationships-page').querySelector(`[data-sortable-table="${more.dataset.tableMore}"]`);if(!model||!table)return false;model.visible+=limit;table.tBodies[0].innerHTML=body(model);if(model.visible>=model.entries.length)more.hidden=true;return true;}
      const button=event.target.closest('[data-table-sort]');if(!button)return false;
      const table=button.closest('[data-sortable-table]'),model=models.get(table?.dataset.sortableTable);if(!model)return false;
      event.preventDefault();
      const column=Number(button.dataset.tableSort),previous=orders.get(model.key);
      orders.set(model.key,{column,direction:previous?.column===column&&previous.direction==='asc'?'desc':'asc'});
      table.tBodies[0].innerHTML=body(model);
      // Keep header buttons mounted so keyboard focus stays on the activated control.
      [...table.tHead.rows[0].cells].forEach((cell,index)=>{
        if(!cell.querySelector('[data-table-sort]'))return;
        const selected=index===column,direction=orders.get(model.key).direction;
        cell.setAttribute('aria-sort',selected?direction==='asc'?'ascending':'descending':'none');
        cell.querySelector('[aria-hidden]').textContent=selected?direction==='asc'?'↑':'↓':'↕';
      });
      onSort(label(model.headers[column]),orders.get(model.key).direction);
      return true;
    },
    rows(root) {
      return [...root.querySelectorAll('[data-sortable-table]')].flatMap(table=>{
        const model=models.get(table.dataset.sortableTable);
        return model?.exportRows?ordered(model).map(entry=>({...entry.row,table:model.key})):[];
      });
    },
    settings:()=>Object.fromEntries(orders),
    clear:()=>models.clear()
  };
}
