// Parliament exposes the member directory and individual records, but no bulk route.
// Fetch current and tracked former MPs with bounded concurrency.
export async function fetchParliamentMembers(request, { memberIds = [], activeOnly = false, requestIntervalMs = 400 } = {}) {
  const reference = await request('/reference-data/kansanedustajat');
  if (!Array.isArray(reference)) throw new Error('Invalid Parliament member response');
  const activeIds = [...new Set(reference.filter(member=>member.aktiivinen===true).map(member=>String(member.tunnus)))];
  if (!activeIds.length) throw new Error('Parliament returned no active members');
  const needed = activeOnly ? activeIds : [...new Set([...activeIds,...memberIds.map(String)])];
  const byId = new Map();
  // GET requests are limited to 180/minute/IP; leave room for retries and other API calls.
  let nextRequest = Promise.resolve();
  let cursor = 0;
  await Promise.all(Array.from({length:Math.min(6,needed.length)},async()=>{
    while(cursor<needed.length) {
      const id=needed[cursor++], ready=nextRequest;
      nextRequest=ready.then(()=>new Promise(resolve=>setTimeout(resolve,requestIntervalMs)));
      await ready;
      const member=await request(`/kansanedustajat/${encodeURIComponent(id)}`);
      if (String(member?.henkilonro)!==id) throw new Error(`Incomplete Parliament member record: ${id}`);
      byId.set(id,member);
    }
  }));
  return { members:needed.map(id=>byId.get(id)), activeIds };
}
export function parliamentaryGroupCode(member) {
  return String(member.viimeisinEduskuntaryhma?.tunnus||'').split('~')[0].replace(/\d+$/,'').toLowerCase();
}
