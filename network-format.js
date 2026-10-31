// Lossless transfer encoding for repeated per-MP summaries. All rates are
// reconstructed from the original numerators/denominators, never rounded.
export function packPairs(pairs,memberId){
  return pairs.map(p=>[p.a===String(memberId)?p.b:p.a,p.common,p.agree,p.yesNo.common,p.yesNo.agree,p.contested.common,p.contested.agree,p.matterWeighted.common,p.matterWeighted.agree,p.sessionWeighted.common,p.sessionWeighted.agree]);
}
const statistic=(common,agree)=>({common,agree,agreement:common?agree/common:null});
export function unpackPairs(rows,memberId,minCommon=30){
  return rows.map(p=>({a:String(memberId),b:String(p[0]),...statistic(p[1],p[2]),yesNo:statistic(p[3],p[4]),contested:statistic(p[5],p[6]),matterWeighted:statistic(p[7],p[8]),sessionWeighted:statistic(p[9],p[10]),lowSupport:p[1]<minCommon,evidenceComplete:false}));
}
export function decodeNetworkData(data){
  if(data?.pairEncoding==='neighbour-1')return {...data,pairs:unpackPairs(data.pairs,data.memberId,data.method?.minCommon)};
  if(data?.layers)return {...data,layers:data.layers.map(layer=>layer.pairEncoding==='neighbour-1'?{...layer,relationships:unpackPairs(layer.relationships,data.memberId,layer.minCommon)}:layer)};
  if(data?.relationEncoding==='organisation-1'){
    const org=data.organisation,targets=new Map(data.targets.map(t=>[t.id,t])),declarations=new Map(data.declarations.map(d=>[d.id,d]));
    return {...data,relationships:data.relationships.map(r=>{
      const target=targets.get(r[3]),declaration=declarations.get(r[1]);
      return {id:r[0],declarationId:r[1],notificationId:r[1],topicId:r[2],targetId:r[3],periodId:r[4],identityStatus:r[5],sourceRecordIds:r[6],organisationId:org.id,companyId:org.companyId,organisation:org.label,targetLabel:target?.label||r[3],targetKind:target?.kind||'unknown',period:declaration?.period,diaryNumber:declaration?.diaryNumber||'',sourceUrl:declaration?.sourceUrl||'',...(target?.mpId?{mpId:target.mpId}:{})};
    })};
  }
  return data;
}
