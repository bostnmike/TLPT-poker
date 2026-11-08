// Actual RSVP -> private Cashier RPC -> two disposable D1 databases. Never remote.
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {localHarness} from './lib/local-harness.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const root=resolve('..'),cashier=process.env.CASHIER_CLOSEOUT_FIXTURE_ROOT||join(root,'cashier');
const wrangler=resolve('node_modules/wrangler/bin/wrangler.js');
const harness=await localHarness({prefix:'tlpt-joint-closeout-',wrangler}),temp=harness.temp,persist=join(temp,'db'),base=harness.base;
const rsvpConfig=join(temp,'rsvp.json'),cashierConfig=join(temp,'cashier.json');
const key='c'.repeat(64),date='2020-01-01',title='Close-out test',rsvpId='stable-mtt';
const fetch=(...args)=>harness.fetch(...args);
const run=(args,config)=>harness.run([...args,'--config',config,'--persist-to',persist]);
const fixture={revision:1,sequence:1,updatedAt:new Date().toISOString(),adminHash:createHash('sha256').update(key).digest('hex'),adminGeneration:1,audit:[],players:[{slug:'bostnmike',name:'Host',generation:0},{slug:'test-player',name:'Test Player',generation:0}],events:[{id:rsvpId,capacity:2,open:true,metadata:{title,date,slot:'mtt',day:'MTT',format:'50K',structure:'Test',time:'1:00 PM',endTime:'11:00 PM',location:'Fixture room',address:'Cary'},responses:{bostnmike:{answer:'yes',order:0},'test-player':{answer:'yes',order:1}},coffeeOrders:{'test-player':{test:{drink:'coffee',temperature:'hot',caffeine:'decaf',milk:false,stevia:false,extraShot:false,status:'active',version:1}}}},{id:'future',capacity:9,open:true,metadata:{title:'Future Friday',date:'2099-01-02',slot:'friday',day:'Friday',format:'40K',structure:'Test',time:'7:00 PM',endTime:'11:30 PM',location:'Fixture room',address:'Cary'},responses:{}}]};
try{
 assert.ok(readFileSync(join(cashier,'CLOSEOUT-PROTOCOL.md'),'utf8').includes('requestId'));
 const production=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
 const config={name:'rsvp-closeout-fixture',main:join(temp,'rsvp-entry.mjs'),compatibility_date:production.compatibility_date,
 ...(production.compatibility_flags?{compatibility_flags:production.compatibility_flags}:{}),
 assets:{directory:resolve('public'),binding:'ASSETS',run_worker_first:true},
 d1_databases:[{binding:'DB',database_name:'rsvp-closeout-fixture',database_id:'00000000-0000-4000-8000-000000000041',migrations_dir:resolve('migrations')}],
 services:[{binding:'CASHIER_CLOSEOUT',service:'cashier-closeout-fixture',entrypoint:'EventCloseout'},{binding:'CASHIER_INSPECT',service:'cashier-closeout-fixture'}],
 vars:{REVISION:harness.runId},observability:{enabled:false}};
 writeFileSync(rsvpConfig,JSON.stringify(config));
 writeFileSync(cashierConfig,JSON.stringify({name:'cashier-closeout-fixture',main:join(temp,'cashier-entry.ts'),compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],services:[{binding:'RSVP_TEST',service:'rsvp-closeout-fixture'},{binding:'CASHIER_RSVP',service:'rsvp-closeout-fixture'}],d1_databases:[{binding:'DB',database_name:'cashier-closeout-fixture',database_id:'00000000-0000-4000-8000-000000000042',migrations_dir:join(cashier,'drizzle')}]}));
 writeFileSync(join(temp,'rsvp-entry.mjs'),`import worker from ${JSON.stringify(resolve('worker.mjs'))};import {diagnosticDb} from ${JSON.stringify(resolve('scripts/lib/diagnostics.mjs'))};export default {...worker,fetch(request,env,ctx){const path=new URL(request.url).pathname;if(path==='/__harness/ready')return Response.json({runId:${JSON.stringify(harness.runId)}});env={...env,DB:diagnosticDb(env.DB)};if(path.startsWith('/__cashier/'))return env.CASHIER_INSPECT.fetch(new Request('https://fixture.test/'+path.slice(11),request));return worker.fetch(request,{...env,GALLERY_FETCH:async()=>Response.json({folder:'images/fw',files:[]})},ctx);}};`);
 writeFileSync(join(temp,'cashier-entry.ts'),`
 import {EventCloseout as ProductionCloseout} from ${JSON.stringify(join(cashier,'closeout-worker.ts'))};
 import {closeoutEvidence} from ${JSON.stringify(join(cashier,'tests/fixtures/closeout-evidence.mjs'))};
 import {diagnosticDb} from ${JSON.stringify(resolve('scripts/lib/diagnostics.mjs'))};
 let rsvp:any,offline=false,lost=false,blocked:number|null=null;
 Date.now=()=>Date.parse('2020-01-02T06:30:00Z');
 export class EventCloseout extends ProductionCloseout {
  constructor(ctx:any,env:any){super(ctx,{...env,DB:diagnosticDb(env.DB)});rsvp=env.RSVP_TEST;}
  async close(input:any){
   const probe=await rsvp.fetch(new Request('https://tlpt-rsvp.tlpt-bostnmike.workers.dev/api/respond',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://tlpt-rsvp.tlpt-bostnmike.workers.dev'},body:JSON.stringify({eventId:'stable-mtt',slug:'test-player',answer:'no'})}));blocked=probe.status;
   const result=await super.close(input);
   if(lost&&result.ok){lost=false;throw Error('Synthetic lost RPC reply');}return result;
  }
 }
 globalThis.fetch=async(input:any,init?:RequestInit)=>{
  const request=new Request(input,init),url=request.url;
  if(url==='https://tlpt-rsvp.tlpt-bostnmike.workers.dev/api/public/events')return rsvp.fetch(request);
  if(url.startsWith('https://api.github.com/')||url.startsWith('https://raw.githubusercontent.com/')||url.startsWith('https://tlpt.org/')){if(offline)throw Error('Synthetic evidence outage');return closeoutEvidence().fetch(url);}
  throw Error('Unexpected external request in close-out fixture');
 };
 export default {async fetch(request:Request,env:any){
  const path=new URL(request.url).pathname,db=diagnosticDb(env.DB);rsvp=env.RSVP_TEST;
  if(path==='/seed'){await db.batch(['mtt:2020-01-01','friday:2099-01-02'].map((id,i)=>db.prepare('INSERT INTO payments(id,source_id,event_id,payer,cents,kind,status,method,received_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind('fixture-'+i,'manual:fixture-'+i,id,'Fixture',3000,'entry','confirmed','cash','at','at','at')));return Response.json({ok:true});}
  if(path==='/lost'){lost=true;return Response.json({ok:true});}
  if(path==='/offline'){offline=true;return Response.json({ok:true});}
  if(path==='/late'){try{await db.prepare(\"INSERT INTO payments(id,source_id,event_id,payer,cents,kind,status,method,received_at,created_at,updated_at) VALUES('late','gmail:late','mtt:2020-01-01','Fixture',3000,'entry','review','venmo','at','at','at')\").run();return Response.json({inserted:true});}catch{return Response.json({blocked:true},{status:409});}}
  return Response.json({blocked,payments:(await db.prepare('SELECT id,event_id,cents FROM payments ORDER BY id').all()).results,markers:(await db.prepare('SELECT * FROM event_history_clears').all()).results,receipts:(await db.prepare('SELECT * FROM event_closeouts').all()).results});
 }};`);
 run(['d1','migrations','apply','DB','--local'],rsvpConfig);run(['d1','migrations','apply','DB','--local'],cashierConfig);
 const sql=join(temp,'seed.sql');writeFileSync(sql,`INSERT INTO rsvp_state VALUES(1,1,'${JSON.stringify(fixture).replaceAll("'","''")}')`);run(['d1','execute','DB','--local','--file',sql],rsvpConfig);
 await harness.start(['dev','--local','--persist-to',persist,'--config',rsvpConfig,'--config',cashierConfig]);
 const post=(path,body,cookie='')=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)});
 const login=await post('/api/exchange',{key});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 await fetch(base+'/__cashier/seed');const beforeCashier=await(await fetch(base+'/__cashier/state')).json();
 const get=path=>fetch(base+path,{headers:{Cookie:cookie}});
 assert.equal((await fetch(base+'/api/closeout?eventId=stable-mtt')).status,401);
 const p=await(await get('/api/closeout?eventId=stable-mtt')).json();assert.equal(p.ok,true,JSON.stringify(p));assert.equal(p.cashier.records,1);assert.equal(p.coffeeOrders,1);assert.equal(beforeCashier.payments.length,2);
 assert.equal((await get('/api/closeout?eventId=future')).status,409);
 const close={eventId:rsvpId,confirmationDate:date,requestId:p.requestId,rsvpRevision:p.rsvpRevision,expectedRevision:p.cashier.historyRevision,expectedResultsRevision:p.cashier.evidence.revision,payoutsConfirmed:true,receiptsReviewed:true,resultsConfirmed:true};
 if(process.env.CI&&process.env.CLOSEOUT_PREVIEW==='1')throw Error('Interactive close-out preview is disabled in CI.');
 if(process.env.CLOSEOUT_PREVIEW==='1'){console.log('Local close-out preview ready at '+base+'/?commish=1');await new Promise(resolve=>{process.once('SIGTERM',resolve);process.once('SIGINT',resolve);});}else{
 await fetch(base+'/__cashier/lost');let result=await post('/api/closeout',close,cookie);assert.equal(result.status,503);assert.equal((await result.json()).pending,true);
 const pending=await(await get('/api/backup')).json();assert.ok(pending.events.find(e=>e.id===rsvpId).closeoutPending);assert.ok(pending.events.find(e=>e.id===rsvpId).coffeeOrders);
 const cleared=await(await fetch(base+'/__cashier/state')).json();assert.equal(cleared.blocked,409);assert.deepEqual(cleared.payments,beforeCashier.payments.filter(row=>row.event_id==='friday:2099-01-02'));assert.equal(cleared.markers.length,1);assert.equal(cleared.receipts.length,1);assert.equal((await fetch(base+'/__cashier/late')).status,409);
 await fetch(base+'/__cashier/offline');const again=await(await get('/api/closeout?eventId=stable-mtt')).json();assert.equal(again.cashier.alreadyClosed,true);assert.equal(again.requestId,p.requestId);
 result=await post('/api/closeout',{...close,rsvpRevision:again.rsvpRevision},cookie);assert.equal(result.status,200);const receipt=(await result.json()).receipt;
 const final=await(await get('/api/backup')).json();assert.ok(!final.events.some(e=>e.id===rsvpId));assert.ok(final.events.some(e=>e.id==='future'));assert.deepEqual(final.closeouts[0],receipt);
 assert.equal((await post('/api/closeout',close,cookie)).status,200);assert.deepEqual((await(await fetch(base+'/__cashier/state')).json()).payments,cleared.payments);
 console.log('PASS: actual RSVP -> named Cashier RPC -> isolated D1; authenticated read-only preview, exact freeze, confirmed financial cleanup, future ledgers preserved, late-receipt replay blocked, lost-reply pending/resume, offline stable receipt, RSVP purge and idempotent replay.');
 }
} catch(error){throw Error(harness.diagnostics(error));}
finally{await harness.close();}
