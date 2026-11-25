import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {retryDelayMs} from './http-retry.mjs';
const API='https://api.eduskunta.fi/api/v1/asiakirjat/eduskuntatunnus/';
const MATTER_API='https://api.eduskunta.fi/api/v1/valtiopaivaasiat/';
const DOCUMENT_ID=/^[A-Za-zÅÄÖåäö]+\s+\d+\/\d{4}\s+vp$/;
const hash=value=>createHash('sha256').update(value).digest('hex');
export function selectDocumentExcerpt(text){
 const clean=String(text||'').replace(/\r/g,'').replace(/[\t ]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
 const heading=/ESITYKSEN PÄÄASIALLINEN SISÄLTÖ|PROPOSITIONENS HUVUDSAKLIGA INNEHÅLL/i.exec(clean);
 const body=heading?clean.slice(heading.index+heading[0].length).split(/\n\s*(?:PERUSTELUT|MOTIVERING)\s*\n/i)[0].trim():clean;
 if(body.length<100)return '';
 const excerpt=body.slice(0,10000);
 const boundary=excerpt.lastIndexOf('\n');
 return body.length>10000 && boundary>5000?excerpt.slice(0,boundary):excerpt;
}
function originalDocuments(payload,identifier){
 const rows=Array.isArray(payload)?payload:payload?.asiakirjat;
 if(!Array.isArray(rows))throw new Error('Invalid Parliament document response');
 return rows.filter(d=>d.eduskuntatunnus===identifier && d.kielikoodi==='fi' && typeof d.fullText==='string')
  .sort((a,b)=>(Date.parse(b.viimeisinJulkaisuajankohta)||0)-(Date.parse(a.viimeisinJulkaisuajankohta)||0));
}
export function selectOriginalDocument(payload,identifier){
 return originalDocuments(payload,identifier)[0];
}

function createSourceReader(fetchImpl,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 let nextRequest=0, rateLimitedUntil=0, turn=Promise.resolve();
 return async url=>{
  for(let attempt=1;attempt<=3;attempt++){
   const start=turn.then(async()=>{
    let remaining=Math.max(nextRequest,rateLimitedUntil)-Date.now();
    while(remaining>0){
     await wait(remaining);
     remaining=Math.max(nextRequest,rateLimitedUntil)-Date.now();
    }
    nextRequest=Date.now()+400;
   });
   turn=start;
   await start;
   let response, problem;
   try{
    response=await fetchImpl(url,{signal:AbortSignal.timeout(60000)});
    if(response.status===404 || response.status===410)return null;
    if(response.ok)return await response.json();
    problem=new Error('HTTP '+response.status);
    if(response.status===429)rateLimitedUntil=Math.max(rateLimitedUntil,Date.now()+retryDelayMs(response,attempt));
   }catch(error){problem=error;}
   const status=response?.status;
   const retryable=!status || response.ok || status===408 || status===429 || status>=500;
   if(!retryable || attempt===3)throw new Error('Parliament source lookup failed for '+decodeURIComponent(new URL(url).pathname)+': '+problem.message,{cause:problem});
   if(status!==429)await wait(Math.min(retryDelayMs(response,attempt),60000));
  }
 };
}

function versionsOf(cached){
 if(!cached)return [];
 const {versions=[], ...latest}=cached;
 return [latest,...versions].filter(document=>document.text && document.sourceHash===hash(document.text));
}
const validAt=(document,cutoff)=>!cutoff || Date.parse(document.publishedAt)<=Date.parse(cutoff);
const newestFirst=(a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0);

export function createDocumentLoader({base,fetchImpl=fetch,readSource=createSourceReader(fetchImpl)}={}){
 const cacheReads=new Map(), requests=new Map();
 return async (identifier,{updatedAt,publishedBy}={})=>{
  if(!DOCUMENT_ID.test(identifier||''))return [];
  const file=base&&new URL('ai-sources/'+hash(identifier)+'.json',base);
  if(file&&!cacheReads.has(identifier))cacheReads.set(identifier,readFile(file,'utf8').then(JSON.parse).catch(error=>{
   if(error.code!=='ENOENT' && !(error instanceof SyntaxError))throw error;
  }));
  const cached=await cacheReads.get(identifier);
  const archive=versionsOf(cached).filter(document=>document.document===identifier);
  const fetchedAt=Date.parse(cached?.fetchedAt);
  if(archive.length && Date.now()-fetchedAt<86400000 && (!updatedAt || fetchedAt>=Date.parse(updatedAt))){
   const usable=(publishedBy?[...archive].sort(newestFirst):archive).find(document=>validAt(document,publishedBy));
   if(usable)return [usable];
   if(cached.versions)return [];
  }
  if(!requests.has(identifier))requests.set(identifier,(async()=>{
   const payload=await readSource(API+encodeURIComponent(identifier));
   const now=new Date().toISOString();
   const received=payload===null?[]:originalDocuments(payload,identifier).flatMap(original=>{
    const text=selectDocumentExcerpt(original.fullText);
    if(!text || !/^EDK-\d{4}-AK-\d+$/.test(original.edktunnus))return [];
    return [{document:identifier,title:original.nimeketeksti,language:'fi',edkId:original.edktunnus,url:'https://www.eduskunta.fi/asiat-ja-aanestykset/valtiopaivaasiat/asiakirjat/edktunnus/'+original.edktunnus,text,sourceHash:hash(text),publishedAt:original.viimeisinJulkaisuajankohta||null,fetchedAt:now,scope:'document-excerpt'}];
   });
   if(!received.length)return {received,archive};
   const versions=new Map();
   for(const document of [...received,...archive]){
    const key=JSON.stringify([document.edkId,document.publishedAt,document.sourceHash]);
    if(!versions.has(key))versions.set(key,document);
   }
   const all=[...versions.values()].sort(newestFirst);
   if(file){
    await mkdir(new URL('ai-sources/',base),{recursive:true});
    const temp=new URL(file.href+'.'+randomUUID()+'.tmp');
    await writeFile(temp,JSON.stringify({...received[0],versions:all.filter(document=>document!==received[0])})+'\n');
    await rename(temp,file);
   }
   return {received,archive:all};
  })());
  const result=await requests.get(identifier);
  const document=(publishedBy?result.archive:result.received).find(document=>validAt(document,publishedBy));
  return document?[document]:[];
 };
}
export function documentPassages(documents){
 return documents.flatMap((document,index)=>{
  const passages=[];
  for(let start=0;start<document.text.length;){
   let end=Math.min(start+650,document.text.length);
   if(end<document.text.length){const boundary=document.text.lastIndexOf(' ',end);if(boundary>start+200)end=boundary;}
   const quote=document.text.slice(start,end).trim();
   if(quote.length>=20)passages.push({id:'document-'+(index+1)+'-passage-'+(passages.length+1),document:document.document,url:document.url,quote});
   start=end;
  }
  return passages;
 });
}
export function validateDocumentEvidence(value,passages){
 if(!passages.length)return [];
 if(!Array.isArray(value?.evidenceIds)||!value.evidenceIds.length||value.evidenceIds.length>8)throw new Error('Select source-document evidence for the brief');
 const allowed=new Map(passages.map(p=>[p.id,p]));
 return [...new Set(value.evidenceIds)].map(id=>{if(!allowed.has(id))throw new Error('Unknown document evidence ID');return allowed.get(id);});
}

// Reports are included only when the matter explicitly links them and the
// published version predates the vote; a later report must not explain an old vote.
export function selectVoteReport(matter,asOf){
 return (matter?.keskeisetAsiakirjat?.fi||[]).filter(d=>/VM$/.test(d.asiakirjatyyppikoodi||'') && Date.parse(d.viimeisinJulkaisuajankohta||d.laadintapvm)<=Date.parse(asOf))
  .sort((a,b)=>String(b.laadintapvm||'').localeCompare(String(a.laadintapvm||'')))[0];
}
export function createRecordDocumentLoader(options={}){
 const readSource=createSourceReader(options.fetchImpl||fetch);
 const load=createDocumentLoader({...options,readSource}),matters=new Map();
 return async(identifier,{updatedAt,publishedBy,includeReport=false}={})=>{
  const original=await load(identifier,{updatedAt,publishedBy});
  if(!includeReport || !publishedBy || !DOCUMENT_ID.test(identifier||''))return original;
  if(!matters.has(identifier))matters.set(identifier,readSource(MATTER_API+encodeURIComponent(identifier)));
  const report=selectVoteReport(await matters.get(identifier),publishedBy);
  if(!report || report.eduskuntatunnus===identifier)return original;
  const related=await load(report.eduskuntatunnus,{updatedAt,publishedBy});
  return [...original,...related];
 };
}
