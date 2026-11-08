import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createIntegrationRun,boundedFetch as fetch} from './integration-runtime.mjs';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
const run=createIntegrationRun('closeout'),state=join(run.directory,'state');
try{
 const service=run.config('service',{name:'cashier-closeout-fixture',main:'tests/fixtures/closeout-service.ts',compatibility_date:'2026-05-15',compatibility_flags:['nodejs_compat'],vars:{CASHIER_ENV:'local'},services:[{binding:'CASHIER_RSVP',service:'cashier-closeout-client'}],d1_databases:[{binding:'DB',database_name:'closeout-fixture',database_id:'00000000-0000-4000-8000-000000000014',migrations_dir:'drizzle'}]});
 const client=run.config('client',{name:'cashier-closeout-client',main:'tests/fixtures/closeout-client.mjs',compatibility_date:'2026-05-15',services:[{binding:'CLOSEOUT',service:'cashier-closeout-fixture',entrypoint:'EventCloseout'},{binding:'INSPECT',service:'cashier-closeout-fixture'}]});
 run.migrate(service,state);const {base}=await run.start([client,service],{state,role:'closeout'});
 const call=async(path,input)=>await(await fetch(base+path,input?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)}:{})).json();
 await call('/seed');const before=await call('/state');
 const input={protocol:1,eventId:'mtt:2020-01-01',rsvpEventId:'stable-mtt',title:'Close-out test',confirmationDate:'2020-01-01',payoutsConfirmed:false,receiptsReviewed:false,resultsConfirmed:false};
 const p=await call('/preview',input);assert.equal(p.ok,true,JSON.stringify(p));assert.equal(p.records,1);assert.deepEqual(await call('/state'),before,'RPC preview must not write');
 const close={...input,payoutsConfirmed:true,receiptsReviewed:true,resultsConfirmed:true,expectedRevision:p.historyRevision,expectedResultsRevision:p.evidence.revision,requestId:crypto.randomUUID()};
 assert.equal((await call('/close',close)).code,'event-open');await call('/freeze');
 assert.equal((await call('/close',{...close,expectedRevision:p.historyRevision-1})).code,'ledger-changed');
 const closed=await call('/close',close);assert.equal(closed.ok,true,JSON.stringify(closed));assert.equal(closed.receipt.closed,true);
 const after=await call('/state');assert.deepEqual(after.payments,before.payments.filter(p=>p.event_id!=='mtt:2020-01-01'));assert.equal(after.markers.length,1);assert.equal(after.receipts.length,1);
 assert.equal((await fetch(base+'/late')).status,409,'Actual D1 trigger must block stale intake');
 await call('/offline');const replay=await call('/close',close);assert.equal(replay.alreadyClosed,true);assert.deepEqual(replay.receipt,closed.receipt);
 const previewAgain=await call('/preview',input);assert.equal(previewAgain.alreadyClosed,true);assert.deepEqual(previewAgain.receipt,closed.receipt);
 console.log('PASS: actual private Worker RPC and disposable D1 — bound public-feed callback despite HTTP403, read-only preview, open/stale denial, verified pre-6am closure, exact-event clearing, future ledger unchanged, database replay guard, and stable lost-response recovery while results are offline.');
}catch(error){console.error(run.logs());throw error;}finally{await run.cleanup();}
