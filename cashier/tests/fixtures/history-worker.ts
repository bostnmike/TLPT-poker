// Isolated integration fixture. Never referenced by production configuration.
import worker from '../../worker';
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(url==='https://tlpt.org/data/events.json')return Response.json({events:[
  {slot:'friday',title:'History test Friday',date:'2099-01-02'},
  {slot:'saturday',title:'History test Saturday',date:'2099-01-03'},
  {slot:'mtt',title:'History test past MTT',date:'2020-01-01',tables:2}
 ]});
 if(url==='https://tlpt.org/data/event-financials.json')return Response.json({events:{}});
 return nativeFetch(input,init);
};
export default worker;
