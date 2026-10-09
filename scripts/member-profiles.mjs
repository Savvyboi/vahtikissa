import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { fetchParliamentMembers } from './parliament-members.mjs';

const text = value => typeof value === 'string' ? value.trim() : '';
const bilingual = value => typeof value === 'string' ? {fi:text(value),sv:''} : {fi:text(value?.fi),sv:text(value?.sv)};
const period = row => ({from:text(row.alkupvm),to:text(row.loppupvm)});
export function normalizeMemberProfile(member) {
  const id = text(String(member.henkilonro || ''));
  if (!id) throw new Error('Official profile has no member ID');
  return {
    id, sourceUrl:'https://api.eduskunta.fi/api/v1/kansanedustajat/'+encodeURIComponent(id),
    pageUrl:'https://www.eduskunta.fi/kansanedustajat-ja-toimielimet/kansanedustajat/'+encodeURIComponent(id),
    status:text(member.edustajantoimenTila), municipality:text(member.kotikunta),
    birthYear:member.syntymavuosi || null, birthPlace:text(member.syntymapaikka),
    occupation:bilingual(member.ammatti), district:bilingual(member.viimeisinVaalipiiri?.nimi),
    email:text(member.sahkoposti), phone:text(member.puhelinnumero),
    terms:(member.edustajatoimet || []).map(period),
    interruptions:(member.edustajatoimiKeskeytynyt || []).map(row=>({...period(row),reason:bilingual(row.selite)})),
    education:(member.koulutukset || []).map(row=>({year:row.vuosi || null,degree:bilingual(row.nimi),institution:bilingual(row.oppilaitos)})),
    career:Object.fromEntries(['fi','sv'].map(language=>[language,(member.tyoura?.[language] || []).map(row=>({title:text(row.tyopaikka),period:text(row.aikajakso)}))])),
    committees:(member.valiokuntajasenyydet || []).map(row=>({id:text(row.valiokuntaTunnus),name:bilingual(row.valiokuntaNimi),role:bilingual(row.rooli),...period(row)})),
    // Keep language-specific histories independently: upstream ordering differs by language.
    bodies:Object.fromEntries(['fi','sv'].map(language=>[language,(member.toimielinjasenyydet?.[language] || []).map(row=>({name:text(row.nimi),role:text(row.rooli),...period(row)}))])),
    government:Object.fromEntries(['fi','sv'].map(language=>[language,(member.valtioneuvostonJasenyydet?.[language] || []).map(row=>({name:text(row.nimi),...period(row)}))]))
  };
}
export function buildMemberProfiles(members, ids, generatedAt = new Date().toISOString()) {
  const byId = new Map(members.map(member=>[String(member.henkilonro),member]));
  const profiles = ids.map(String).map(id=>{
    if (!byId.has(id)) throw new Error('Missing official profile: '+id);
    return [id,normalizeMemberProfile(byId.get(id))];
  });
  return {metadata:{generatedAt,source:'https://api.eduskunta.fi/api/v1/kansanedustajat',directory:'https://www.eduskunta.fi/kansanedustajat-ja-toimielimet/kansanedustajat'},members:Object.fromEntries(profiles)};
}
export async function syncMemberProfiles() {
  const data = JSON.parse(await readFile(new URL('../data/parliament.json',import.meta.url),'utf8'));
  const ids = data.members.map(member=>member.id);
  const request = async path => {
    const response = await fetch((process.env.EDUSKUNTA_API || 'https://api.eduskunta.fi/api/v1')+path,{signal:AbortSignal.timeout(60000)});
    if (!response.ok) throw new Error('Official profile request failed: '+response.status+' '+path);
    return response.json();
  };
  const {members} = await fetchParliamentMembers(request,{memberIds:ids});
  const output = buildMemberProfiles(members,ids);
  await writeFile(new URL('../data/member-profiles.json',import.meta.url),JSON.stringify(output)+'\n');
  console.log('Official profiles: '+ids.length+' MPs.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await syncMemberProfiles();
