import { compareKeywords, phraseUptake } from './network-speech.js';
import { buildCommitteeAnalysis } from './network-institutions.js';
self.onmessage = ({data}) => {
  try {
    const {speeches,texts,settings,kind}=data;
    const result=kind==='committee-overlap'?buildCommitteeAnalysis(data.profiles,data.members,settings):kind==='phrase-uptake'?phraseUptake(speeches,texts,settings):compareKeywords(speeches,texts,settings);
    self.postMessage({result});
  } catch(error) {self.postMessage({error:error.message});}
};
