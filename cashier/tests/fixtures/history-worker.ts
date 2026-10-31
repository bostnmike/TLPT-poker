// Isolated integration fixture. Never referenced by production configuration.
import worker from '../../worker';
const nativeFetch=globalThis.fetch;
let saturdayCancelled=false,sundayOpen=false;
globalThis.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(url==='https://tlpt-rsvp.tlpt-bostnmike.workers.dev/api/public/events')return Response.json({schemaVersion:1,revision:1+(saturdayCancelled?1:0)+(sundayOpen?1:0),cancelledEvents:saturdayCancelled?[{id:'qa-saturday',date:'2099-01-03'}]:[],events:[
  {id:'qa-friday',slot:'friday',title:'History test Friday',date:'2099-01-02',rsvpOpen:true,rsvps:{},waitlist:[]},
  {id:'qa-saturday',slot:'saturday',title:'History test Saturday',date:'2099-01-03',rsvpOpen:true,rsvps:{},waitlist:[]},
  {id:'qa-sunday',slot:'sunday',day:'Sunday',title:'Sunday 50K test',date:'2099-01-04',tables:1,capacity:9,startingStack:50000,blindStructure:'40k',format:'50K Format',rsvpOpen:sundayOpen,rsvps:{bostnmike:'yes'},waitlist:[]},
  {id:'qa-mtt',slot:'mtt',title:'History test past MTT',date:'2020-01-01',tables:2,rsvpOpen:true,rsvps:{},waitlist:[]}
 ].filter(e=>!saturdayCancelled||e.id!=='qa-saturday')});
 if(url==='https://tlpt.org/data/event-financials.json')return Response.json({events:{}});
 return nativeFetch(input,init);
};
let clock=Date.parse('2020-01-01T20:00:00Z');
Date.now=()=>clock;
export default {fetch(request:Request,env:Cloudflare.Env){
 if(new URL(request.url).pathname==='/__test/cancel-saturday'){saturdayCancelled=true;clock+=61000;return Response.json({ok:true});}
 if(new URL(request.url).pathname==='/__test/open-sunday'){sundayOpen=true;clock+=61000;return Response.json({ok:true});}
 if(new URL(request.url).pathname==='/__test/close-sunday'){sundayOpen=false;clock+=61000;return Response.json({ok:true});}
 if(new URL(request.url).pathname==='/__test/advance'){clock=Date.parse('2020-01-02T12:00:00Z');return Response.json({ok:true});}
 return worker.fetch(request,env);
}};
