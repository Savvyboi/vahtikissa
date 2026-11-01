// Native dialogs keep source records visible on narrow screens and manage focus,
// Escape, and background interaction without moving the underlying results page.
export function createRelationshipEvidence(dialog,{lang='fi',current=()=>true}={}) {
  const tr=(fi,sv,en)=>lang==='sv'?sv:lang==='en'?en:fi;
  let revision=0,origin,lastAction;
  function render(content,busy=false){
    dialog.setAttribute('aria-busy',String(busy));
    dialog.innerHTML=`<header class="relationship-evidence-head"><h3 id="relationship-evidence-heading" tabindex="-1">${tr('Lähdetiedot','Källuppgifter','Source evidence')}</h3><button type="button" data-evidence-close aria-label="${tr('Sulje lähteet','Stäng källorna','Close evidence')}">×</button></header><div class="relationship-evidence-content">${content}</div>`;
    dialog.scrollTop=0;
  }
  const restore=()=>{if(origin?.isConnected)origin.focus({preventScroll:true});};
  function close({restoreFocus=true}={}){
    revision++;
    dialog.close();dialog.hidden=true;
    if(restoreFocus)restore();
  }
  async function open(action,trigger){
    const ticket=++revision;
    if(!dialog.open)origin=trigger||document.activeElement;
    lastAction=action;
    render(`<p role="status">${tr('Ladataan lähdettä…','Källan laddas…','Loading source evidence…')}</p>`,true);
    dialog.hidden=false;
    if(!dialog.open)dialog.showModal();
    try{
      const content=await action();
      if(ticket!==revision||!current()||!dialog.open)return;
      render(content||`<p>${tr('Ei lähdetietoja.','Inga källuppgifter.','No source records available.')}</p>`);
    }catch{
      if(ticket!==revision||!current()||!dialog.open)return;
      render(`<p role="alert">${tr('Lähdettä ei voitu ladata. Yritä uudelleen.','Källan kunde inte laddas. Försök igen.','The source could not be loaded. Please try again.')}</p><button type="button" data-evidence-retry>${tr('Yritä uudelleen','Försök igen','Try again')}</button>`);
    }
    dialog.querySelector('h3').focus({preventScroll:true});
  }
  dialog.addEventListener('click',event=>{
    if(event.target.closest('[data-evidence-close]'))close();
    else if(event.target.closest('[data-evidence-retry]'))open(lastAction);
  });
  dialog.addEventListener('close',()=>{if(!dialog.open){revision++;dialog.hidden=true;restore();}});
  return {open,close};
}
