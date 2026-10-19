import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
const API='https://api.eduskunta.fi/api/v1/asiakirjat/eduskuntatunnus/';
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
export function selectOriginalDocument(payload,identifier){
 const rows=Array.isArray(payload)?payload:payload?.asiakirjat||[];
 return rows.filter(d=>d.eduskuntatunnus===identifier && d.kielikoodi==='fi' && typeof d.fullText==='string')
  .sort((a,b)=>String(b.viimeisinJulkaisuajankohta||'').localeCompare(String(a.viimeisinJulkaisuajankohta||'')))[0];
}
export function createDocumentLoader({base,fetchImpl=fetch}={}){
 const pending=new Map(); let lastRequest=0;
 return (identifier,asOf)=>{
  if(!identifier || !/^[A-Za-zÅÄÖåäö]+\s+\d+\/\d{4}\s+vp$/.test(identifier))return Promise.resolve([]);
  const key=identifier+'|'+(asOf||'');
  if(!pending.has(key))pending.set(key,(async()=>{
   const file=base&&new URL('ai-sources/'+hash(identifier)+'.json',base);
   if(file){try{const cached=JSON.parse(await readFile(file,'utf8'));if(cached.document===identifier && cached.text && cached.sourceHash===hash(cached.text) && Date.parse(cached.fetchedAt)>=Date.parse(asOf||'1970-01-01') && Date.now()-Date.parse(cached.fetchedAt)<86400000)return [cached];}catch(error){if(error.code!=='ENOENT' && !(error instanceof SyntaxError))throw error;}}
   try{
    const waitMs=Math.max(0,400-(Date.now()-lastRequest)); if(waitMs)await new Promise(resolve=>setTimeout(resolve,waitMs)); lastRequest=Date.now();
    const response=await fetchImpl(API+encodeURIComponent(identifier),{signal:AbortSignal.timeout(60000)});
    if(!response.ok)return [];
    const original=selectOriginalDocument(await response.json(),identifier);
    if(!original || !/^EDK-\d{4}-AK-\d+$/.test(original.edktunnus))return [];
    const text=selectDocumentExcerpt(original.fullText);if(!text)return [];
    const document={document:identifier,title:original.nimeketeksti,language:'fi',edkId:original.edktunnus,url:'https://www.eduskunta.fi/asiat-ja-aanestykset/valtiopaivaasiat/asiakirjat/edktunnus/'+original.edktunnus,text,sourceHash:hash(text),publishedAt:original.viimeisinJulkaisuajankohta||null,fetchedAt:new Date().toISOString(),scope:'document-excerpt'};
    if(file){await mkdir(new URL('ai-sources/',base),{recursive:true});const temp=new URL(file.href+'.'+randomUUID()+'.tmp');await writeFile(temp,JSON.stringify(document)+'\n');await rename(temp,file);}
    return [document];
   }catch(error){if(error?.code==='ENOSPC'||error?.code==='EACCES')throw error;return [];}
  })());
  return pending.get(key);
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
 const load=createDocumentLoader(options),matters=new Map();
 return async(identifier,{asOf,includeReport=false}={})=>{
  const original=await load(identifier,asOf);
  if(!includeReport || !original.length)return original;
  if(!matters.has(identifier))matters.set(identifier,(async()=>{
   try{const r=await (options.fetchImpl||fetch)('https://api.eduskunta.fi/api/v1/valtiopaivaasiat/'+encodeURIComponent(identifier),{signal:AbortSignal.timeout(60000)});return r.ok?await r.json():null;}catch{return null;}
  })());
  const report=selectVoteReport(await matters.get(identifier),asOf);
  if(!report || report.eduskuntatunnus===identifier)return original;
  const related=await load(report.eduskuntatunnus,asOf);
  return [...original,...related.filter(document=>Date.parse(document.publishedAt)<=Date.parse(asOf))];
 };
}
