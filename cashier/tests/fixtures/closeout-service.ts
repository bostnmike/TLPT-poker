// Disposable multi-Worker/D1 harness. Never used by a deployment config.
import {EventCloseout} from '../../closeout-worker';
import {closeoutEvidence} from './closeout-evidence.mjs';
export {EventCloseout};
const nativeFetch=globalThis.fetch;
const fixtureNow=Date.parse('2020-01-02T06:30:00Z');
Date.now=()=>fixtureNow;
let open=true,offline=false;
globalThis.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
 const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
 if(url.startsWith('https://api.github.com/')||url.startsWith('https://raw.githubusercontent.com/')||url.startsWith('https://tlpt.org/')||url.startsWith('https://tlpt-rsvp.')){
  new Request(url,init); // Exercise workerd's actual request-option validation.
  if(offline)throw Error('Synthetic results outage');
  return closeoutEvidence({feed:{schemaVersion:1,revision:open?1:2,events:[{id:'stable-mtt',slot:'mtt',date:'2020-01-01',rsvpOpen:open}]}}).fetch(url);
 }
 return nativeFetch(input,init);
};
export default {async fetch(request:Request,env:{DB:D1Database;CASHIER_ENV:string}){
 if(env.CASHIER_ENV!=='local')return new Response('Fixture unavailable',{status:403});
 const path=new URL(request.url).pathname,db=env.DB;
 if(path==='/seed'){
  await db.batch(['mtt:2020-01-01','friday:2099-01-02'].map((id,i)=>db.prepare('INSERT INTO payments(id,source_id,event_id,payer,cents,kind,status,method,received_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind('fixture-'+i,'manual:fixture-'+i,id,'Fixture Test',3000,'entry','confirmed','cash','at','at','at')));
  return Response.json({ok:true});
 }
 if(path==='/freeze'){open=false;return Response.json({ok:true});}
 if(path==='/offline'){offline=true;return Response.json({ok:true});}
 if(path==='/late'){
  try{await db.prepare("INSERT INTO payments(id,source_id,event_id,payer,cents,kind,status,method,received_at,created_at,updated_at) VALUES('late','gmail:late','mtt:2020-01-01','Fixture',3000,'entry','review','venmo','at','at','at')").run();return Response.json({inserted:true});}catch{return Response.json({blocked:true},{status:409});}
 }
 return Response.json({payments:(await db.prepare('SELECT id,event_id,cents FROM payments ORDER BY id').all()).results,markers:(await db.prepare('SELECT * FROM event_history_clears').all()).results,receipts:(await db.prepare('SELECT * FROM event_closeouts').all()).results});
}};
