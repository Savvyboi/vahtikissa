// Parliament's bulk member response may be capped at 1,000 historical records.
// The reference endpoint contains every current member; supplement individually.
export async function fetchParliamentMembers(request, { memberIds = [], activeOnly = false } = {}) {
  const [bulk, reference] = await Promise.all([request('/kansanedustajat'),request('/reference-data/kansanedustajat')]);
  if (!Array.isArray(bulk.kansanedustajat) || !Array.isArray(reference)) throw new Error('Invalid Parliament member response');
  const activeIds = reference.filter(member=>member.aktiivinen===true).map(member=>String(member.tunnus));
  if (!activeIds.length) throw new Error('Parliament returned no active members');
  const needed = new Set([...activeIds,...memberIds.map(String)]);
  const byId = new Map(bulk.kansanedustajat.map(member=>[String(member.henkilonro),member]));
  const missing = [...needed].filter(id=>!byId.has(id));
  let cursor = 0;
  await Promise.all(Array.from({length:Math.min(6,missing.length)},async()=>{
    while(cursor<missing.length) {
      const id=missing[cursor++], member=await request(`/kansanedustajat/${encodeURIComponent(id)}`);
      if (String(member?.henkilonro)!==id) throw new Error(`Incomplete Parliament member record: ${id}`);
      byId.set(id,member);
    }
  }));
  return { members:[...byId.values()].filter(member=>!activeOnly||activeIds.includes(String(member.henkilonro))), activeIds };
}
export function parliamentaryGroupCode(member) {
  return String(member.viimeisinEduskuntaryhma?.tunnus||'').split('~')[0].replace(/\d+$/,'').toLowerCase();
}
