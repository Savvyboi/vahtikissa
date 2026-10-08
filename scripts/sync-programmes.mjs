import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fetchParliamentMembers, parliamentaryGroupCode } from './parliament-members.mjs';
export const SOURCE='https://www.fsd.tuni.fi/pohtiva/vaalit/6';
const API='https://api.eduskunta.fi/api/v1';
const parties={
  kok:{fi:'Kansallinen Kokoomus',sv:'Samlingspartiet'},ps:{fi:'Perussuomalaiset',sv:'Sannfinländarna'},
  sd:{fi:'Suomen Sosialidemokraattinen Puolue',sv:'Finlands Socialdemokratiska Parti'},kesk:{fi:'Suomen Keskusta',sv:'Centern i Finland'},
  vihr:{fi:'Vihreä liitto',sv:'Gröna förbundet'},vas:{fi:'Vasemmistoliitto',sv:'Vänsterförbundet'},
  r:{fi:'Ruotsalainen kansanpuolue',sv:'Svenska folkpartiet'},kd:{fi:'Kristillisdemokraatit',sv:'Kristdemokraterna'},liik:{fi:'Liike Nyt',sv:'Rörelse Nu'}
};
function plain(value) {
  return String(value).replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
}
export function parseProgrammes(html, represented) {
  const output=[];
  for(const match of html.matchAll(/<h5[^>]*>([\s\S]*?)<\/h5>\s*<table[^>]*>([\s\S]*?)<\/table>/gi)) {
    const code=Object.keys(parties).find(code=>parties[code].fi===plain(match[1]));
    if(!code||!represented.has(code))continue;
    const programmes=[];
    for(const row of match[2].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells=[...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>m[1]);
      if(cells.length!==5)continue;
      const href=cells[0].match(/<a[^>]*href=["']([^"']+)["']/i)?.[1];
      const url=new URL(href||'',SOURCE);
      if(url.origin!=='https://www.fsd.tuni.fi'||!/^\/pohtiva\/ohjelmalistat\/[A-Z]+\/\d+$/.test(url.pathname))throw new Error('Unexpected programme URL');
      const programme={id:url.pathname.split('/').at(-1),title:plain(cells[0]),url:url.href,year:Number(plain(cells[2])),type:plain(cells[3]),language:plain(cells[4])};
      if(!programme.title||!Number.isInteger(programme.year)||!['FI','SV','EN'].includes(programme.language)||!['vaaliohjelma','yleisohjelma','tavoiteohjelma'].includes(programme.type))throw new Error('Invalid programme metadata');
      programmes.push(programme);
    }
    if(!programmes.length)throw new Error(`No programmes parsed for ${code}`);
    output.push({code,name:parties[code],seats:represented.get(code),programmes:programmes.sort((a,b)=>b.year-a.year||a.language.localeCompare(b.language))});
  }
  for(const code of represented.keys())if(parties[code]&&!output.some(p=>p.code===code))throw new Error(`Missing programme party: ${code}`);
  if(!output.length)throw new Error('No parliamentary programmes found');
  return output.sort((a,b)=>a.name.fi.localeCompare(b.name.fi,'fi'));
}
async function request(url, json=true) {
  let last;
  for(let attempt=0;attempt<3;attempt++){
    try{const response=await fetch(url,{signal:AbortSignal.timeout(60000),headers:{'user-agent':'Vahtikissa/1.0 (+open civic data)'}});if(!response.ok)throw new Error(`${response.status} ${url}`);return json?await response.json():await response.text();}
    catch(error){last=error;}
    await new Promise(resolve=>setTimeout(resolve,500*2**attempt));
  }
  throw last;
}
export async function syncProgrammes() {
  const [html, {members,activeIds}]=await Promise.all([request(SOURCE,false),fetchParliamentMembers(path=>request(`${API}${path}`),{activeOnly:true})]);
  const represented=new Map();
  members.forEach(member=>{const code=parliamentaryGroupCode(member);represented.set(code,(represented.get(code)||0)+1);});
  const output={metadata:{generatedAt:new Date().toISOString(),source:SOURCE,membershipSource:`${API}/reference-data/kansanedustajat`,collection:'Eduskuntavaalit 2023',activeMemberCount:activeIds.length},parties:parseProgrammes(html,represented)};
  await writeFile(new URL('../data/programmes.json',import.meta.url),JSON.stringify(output)+'\n');
  console.log(`Programmes: ${output.parties.length} represented parties, ${output.parties.reduce((n,p)=>n+p.programmes.length,0)} source documents; ${activeIds.length} current MPs checked.`);
  return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)syncProgrammes().catch(error=>{console.error(error);process.exitCode=1;});
