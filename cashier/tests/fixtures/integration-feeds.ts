// Fixed public-source contracts: no CI dependency on real games or external HTTP.
import players from '../../lib/player-directory.json';
export function playerFeed(){return Response.json({players:players.map(p=>({...p,image:p.image.replace('https://tlpt.org/','')}))});}
export function fixedFeed(input:RequestInfo|URL){
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(url==='https://tlpt.org/data/player-metadata.json')return playerFeed();
 if(url.split('?')[0]==='https://tlpt.org/data/event-financials.json')return Response.json({events:{}});
 if(url==='https://tlpt-rsvp.tlpt-bostnmike.workers.dev/api/public/events')return Response.json({schemaVersion:1,revision:1,events:[
  {id:'integration-friday',slot:'friday',title:'Fixture Friday',date:'2026-11-13',rsvpOpen:true,rsvps:{},waitlist:[]},
  {id:'integration-saturday',slot:'saturday',title:'Fixture Saturday',date:'2026-11-14',rsvpOpen:true,rsvps:{},waitlist:[]},
  {id:'integration-mtt',slot:'mtt',title:'Fixture MTT',date:'2026-11-14',tables:2,rsvpOpen:true,rsvps:{},waitlist:[]},
  {id:'integration-pending',slot:'sunday',title:'Fixture pending',date:'TBD',rsvpOpen:false,rsvps:{},waitlist:[]}
 ]});
 throw Error('Unexpected external request in isolated integration: '+url);
}
export function ready(request:Request,env:{TEST_RUN_ID:string},role='register'){
 return new URL(request.url).pathname==='/__test/ready'?Response.json({runId:env.TEST_RUN_ID,role}):null;
}
