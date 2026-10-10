import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const clean = value => typeof value==='string' ? value.normalize('NFC').replace(/\s+/gu,' ').trim() : '';
// SvelteKit's directory response encodes object properties as array references.
// Read only the expected contact fields; never evaluate the page's scripts.
export function directoryContacts(payload, memberId) {
  const data = payload?.nodes?.find(node=>node?.data?.[0]?.kansanedustaja!==undefined)?.data;
  if (!data) throw new Error('MP directory contact data is missing: '+memberId);
  const ref = index => Number.isInteger(index) && index>=0 ? data[index] : undefined;
  const member = ref(data[0].kansanedustaja);
  if (String(ref(member?.henkilonro))!==String(memberId)) throw new Error('MP directory identity mismatch: '+memberId);
  const assistants = ref(data[0].avustajat);
  if (!Array.isArray(assistants)) throw new Error('MP directory assistant list is missing: '+memberId);
  return assistants.map(index=>{
    const row=ref(index);
    const name=[clean(ref(row?.kutsumanimi)),clean(ref(row?.sukunimi))].filter(Boolean).join(' ');
    if (!name) throw new Error('MP directory assistant has no name: '+memberId);
    const email=clean(ref(row.sahkoposti));
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid published assistant email');
    return {name,email,phone:clean(ref(row.puhelin)),mobile:clean(ref(row.matkapuhelin))};
  });
}

export async function syncMemberContacts() {
  const profiles=JSON.parse(await readFile(new URL('../data/member-profiles.json',import.meta.url),'utf8'));
  const current=Object.values(profiles.members).filter(profile=>profile.status==='Nykyinen');
  if (!current.length) throw new Error('No current MPs to refresh');
  const members={};let cursor=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(cursor<current.length) {
      const p=current[cursor++];
      const pageUrl='https://www.eduskunta.fi/fi/kansanedustajat-ja-toimielimet/kansanedustajat/'+encodeURIComponent(p.id);
      const response=await fetch(pageUrl+'/__data.json',{signal:AbortSignal.timeout(45000)});
      if (!response.ok) throw new Error('MP directory request failed: '+response.status+' '+p.id);
      members[p.id]={pageUrl,assistants:directoryContacts(await response.json(),p.id)};
    }
  }));
  // Publish only a complete, validated snapshot; failed requests retain the old file.
  const output={metadata:{generatedAt:new Date().toISOString(),source:'https://www.eduskunta.fi/fi/kansanedustajat-ja-toimielimet/kansanedustajat/'},members:Object.fromEntries(Object.entries(members).sort(([a],[b])=>a.localeCompare(b)))};
  await writeFile(new URL('../data/member-contacts.json',import.meta.url),JSON.stringify(output)+'\n');
  console.log('Official directory contacts: '+current.length+' MPs, '+Object.values(members).reduce((n,m)=>n+m.assistants.length,0)+' assistant entries.');
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) await syncMemberContacts();
