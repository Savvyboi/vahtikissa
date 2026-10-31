import { serializeCSV, safeFilename } from './data-tools.js';
import { decodeNetworkData } from './network-format.js';

/** Immutable per-analysis reads. A changed index never changes already loaded evidence. */
export function createNetworkLoader(fetcher = (...args) => fetch(...args)) {
  let manifestPromise;
  const cache = new Map();
  let codePromise;
  async function request(url,options={},read='text'){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{const response=await fetcher(url,{...options,signal:controller.signal});return {ok:response.ok,value:response.ok?await response[read]():null};}finally{clearTimeout(timer);}
  }
  async function manifest() {
    if (!manifestPromise) manifestPromise = request('./data/networks/index.json', {cache:'no-cache'},'json').then(async response => {
      if (!response.ok) throw Error('Relationship analysis has not been built. Run npm run build:networks.');
      const value = response.value;
      if (!/^[a-f0-9]{24}$/.test(value.id) || !value.files) throw Error('Invalid relationship manifest.');
      return value;
    }).catch(error => {manifestPromise = null; throw error;});
    return manifestPromise;
  }
  async function load(name) {
    const source = await manifest();
    if (!source.files[name] || !/^[a-z0-9-]+\.json$/.test(name)) throw Error('Payload is not declared by this analysis.');
    if (!cache.has(name)) cache.set(name, (async () => {
      const response = await request(`./data/networks/${source.id}/${name}`);
      if (!response.ok) throw Error('Snapshot evidence unavailable. Please rebuild the analysis.');
      const body = response.value;
      if (globalThis.crypto?.subtle) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
        const actual = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2,'0')).join('');
        if (actual !== source.files[name].sha256) throw Error('Analysis payload does not match its source manifest.');
      }
      const payload = JSON.parse(body);
      if (payload.manifestId !== source.id) throw Error('Analysis and evidence snapshots differ.');
      return decodeNetworkData(payload.data);
    })().catch(error => {cache.delete(name); throw error;}));
    return cache.get(name);
  }
  async function verifyCode(){
    if(!codePromise)codePromise=(async()=>{
      const source=await manifest();
      if(!source.code?.['network-worker.js'])throw Error('Pinned calculation code is unavailable. Rebuild the analysis.');
      for(const [name,expected] of Object.entries(source.code)){
        if(!/^[a-z-]+\.js$/.test(name))throw Error('Invalid calculation module path.');
        const response=await request(`./data/networks/${source.id}/${name}`);if(!response.ok)throw Error('Pinned calculation module is unavailable.');
        if(globalThis.crypto?.subtle){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(response.value));const actual=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');if(actual!==expected.sha256)throw Error('Calculation code does not match the analysis manifest.');}
      }
      return source.id;
    })().catch(error=>{codePromise=null;throw error;});
    return codePromise;
  }
  return {manifest,load,verifyCode};
}

export function relationshipExport(rows, {manifestId,feature,filters,method}) {
  const context={manifestId,feature,filters:JSON.stringify(filters),method:JSON.stringify(method)};
  return (rows.length ? rows : [{status:'No supported observations for these settings'}]).map(row=>({...row,...context}));
}

export function downloadRelationships(rows, format, filename) {
  const body=format==='json'?JSON.stringify(rows,null,2):'\uFEFF'+serializeCSV(rows);
  const blob=new Blob([body],{type:format==='json'?'application/json;charset=utf-8':'text/csv;charset=utf-8'});
  const link=document.createElement('a'),url=URL.createObjectURL(blob);
  link.href=url;link.download=safeFilename(filename)+'.'+format;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function commonBallotEvidence(a, b, voteIndex, scope = {}) {
  const eligible=new Set(['yes','no','abstain']),right=new Map(b.map(row=>[row[0],row]));
  const byId=new Map(voteIndex.map(v=>[v.id,v]));
  return a.flatMap(left=>{
    const other=right.get(left[0]),vote=byId.get(left[0]);
    if(!other||!vote||!eligible.has(left[3])||!eligible.has(other[3]))return [];
    const day=vote.date.slice(0,10);
    if((scope.from&&day<scope.from)||(scope.to&&day>scope.to)||(scope.topic&&!vote.topics.includes(scope.topic)))return [];
    return [{voteId:vote.id,date:vote.date,document:vote.document,title:vote.title,partyA:left[2],partyB:other[2],choiceA:left[3],choiceB:other[3],agreement:left[3]===other[3],file:vote.file}];
  });
}
